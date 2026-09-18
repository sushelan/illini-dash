/**
 * What a post does to the list.
 *
 * `announce.ts` reads an instructor's prose and says what it found;
 * this module decides what may be *done* about it. The decision is Sushi's
 * (2026-09-18): **auto-move known items, suggest new ones**, with the row saying
 * where the change came from and an undo beside it.
 *
 * The asymmetry is the whole design. Moving a deadline the student can already
 * see is reversible and self-evidencing — the row names the post and offers an
 * undo, and if the grammar got it wrong the student is looking at a date they
 * can check against work they know about. Inventing a *new* row is neither: the
 * student has nothing to compare it against, and a deadline this extension made
 * up out of a misread sentence is §11's worst outcome wearing a feature's
 * clothes. So one applies and the other asks.
 *
 * Pure: store-shaped facts in, outcomes out. Nothing here writes, and nothing
 * here is applied — `background.ts` does that inside `mutate()` so every write
 * goes through the queue (worker rule 4).
 */

import { extractDeadlineMentions, resolveMentions, type ReadMention } from "./announce.js";
import { itemId } from "./dedupe.js";
import { extractCourseCode, normalizeTitle } from "./normalize.js";
import { isInstant } from "./parsing.js";
import { memberKey, ParseError } from "../sources/types.js";
import type { DueOverride, Item, Overrides, Suggestion } from "../sources/types.js";

/** Where a post came from. Every value is a surface, not a parser. */
export type PostSource = Suggestion["source"];

/** One post, as an observer (or a later paste box) hands it over. */
export interface ObservedPost {
  /**
   * Stable for the post, within its source.
   *
   * This is the only thing that stops a correction being applied twice — an
   * observer re-reads the same Campuswire thread every time the page is opened
   * — so it has to come from the page's own id for the post, never from a hash
   * of the text, which changes when an instructor fixes a typo.
   */
  id: string;
  source: PostSource;
  /** The course the post was in, as the site names it. */
  courseHint?: string;
  /** ISO 8601 with offset. The anchor for every relative phrase in the text. */
  postedAt: string;
  text: string;
}

/** The one thing that may overrule the `seenPosts` guard. */
export interface IngestOptions {
  /**
   * This post has been edited since it was read, so read it again.
   *
   * `seenPosts` is keyed by the post and remembers nothing about *which
   * version* was read, so on its own it makes a corrected deadline in an edit
   * invisible — which is the shape the Piazza "Running Post" actually has (it
   * is edited weekly). The caller is the one holding the evidence: Piazza's
   * feed states when the body was last written (`editedSinceSeen`), and nothing
   * in here can tell an edit from a second sighting.
   *
   * The seen mark is still stamped at `now`, so one edit costs one re-reading
   * and not one per sync for ever.
   */
  reread?: boolean;
}

/** The store-shaped facts `ingestPost` reads. Deliberately not the whole store. */
export interface IngestInput {
  items: Item[];
  overrides: Overrides;
  suggestions: Suggestion[];
  seenPosts: Record<string, string>;
}

/** Everything the post produced, and everything it did not. */
export interface IngestResult {
  /** memberKey → the correction to write. Keyed like `hiddenKeys` (§3 amendment). */
  dueOverrides: Record<string, DueOverride>;
  /** New suggestions to append. Never ones already in `input.suggestions`. */
  suggestions: Suggestion[];
  /** postId → when, to merge into `seenPosts`. Empty when the post was skipped. */
  seenPosts: Record<string, string>;
  /**
   * Why each mention produced nothing, in the words the console will print.
   *
   * Every outcome is returned, including the refusals (worker rule 5): "the
   * post named nothing this extension knows" and "this module never ran" are
   * otherwise the same silence, and they want opposite fixes.
   */
  skipped: { reason: string }[];
  /**
   * How many **items** this post moved, as opposed to how many keys were
   * written.
   *
   * `dueOverrides` is keyed by every member of every moved item, so counting it
   * counts sources rather than deadlines: one assignment that Canvas and the
   * course page both list would be announced as two corrections. Added for the
   * Piazza row, which says how many deadlines a sync found (`core/piazza.ts`).
   */
  movedItems: number;
}

/**
 * The confidence a *move* has to clear to be applied without being asked.
 *
 * The ladder is `announce.ts`'s: 0.95 a stated date and time, 0.85 a bare date
 * whose 23:59 is ours, 0.75 an explicit reschedule read off a weekday, 0.65 a
 * bare weekday with no other anchor. 0.65 is the reading that is wrong in the
 * way a student cannot detect — "due by Friday" resolved to the wrong Friday
 * looks exactly like the right one — so it is the one that has to ask. Written
 * as `<` against 0.75 rather than `<=` against 0.65 so that a future rung
 * between them is refused by default rather than admitted by omission.
 */
export const AUTO_MOVE_CONFIDENCE = 0.75;

/** What the row says out loud. "Campuswire post 2026-09-18". */
const SOURCE_LABEL: Record<PostSource, string> = {
  piazza: "Piazza",
  campuswire: "Campuswire",
  paste: "Pasted",
};

export function describePost(post: ObservedPost): string {
  return `${SOURCE_LABEL[post.source]} post ${post.postedAt.slice(0, 10)}`;
}

/**
 * Deterministic in the post, the title and the instant.
 *
 * So ingesting the same post twice can only ever produce the same id, and the
 * `seenPosts` guard is a cheap first line rather than the only one. `itemId` is
 * reused rather than a second hash written here: two hashes is two things that
 * can drift, and this one has the same job — stable, not secret.
 */
export function suggestionId(postId: string, title: string, at: string): string {
  return itemId([`${postId}|${title}|${at}`]);
}

/** The local day a stated instant falls on, as the post stated it. */
function statedDay(at: string): string {
  return at.slice(0, 10);
}

function sameTitle(a: string, b: string): boolean {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (left.size === 0 || right.size === 0) return a.trim() === b.trim();
  if (left.size !== right.size) return false;
  for (const token of left) if (!right.has(token)) return false;
  return true;
}

/**
 * Whether this deadline is already waiting to be added.
 *
 * Same title tokens, same day — not the same instant. An instructor who posts
 * "due Friday" and then "due Friday at 11:59" has said one thing twice, and two
 * rows in the Attention tab for one deadline is the noise that makes a student
 * stop reading the section.
 */
function alreadySuggested(existing: readonly Suggestion[], title: string, at: string): boolean {
  return existing.some(
    (suggestion) =>
      statedDay(suggestion.at) === statedDay(at) && sameTitle(suggestion.title, title),
  );
}

function newSuggestion(
  post: ObservedPost,
  title: string,
  mention: ReadMention,
  now: string,
): Suggestion {
  const courseRaw = post.courseHint ?? "";
  const courseCode = extractCourseCode(courseRaw);
  return {
    id: suggestionId(post.id, title, mention.at),
    kind: "new",
    title,
    courseRaw,
    ...(courseCode ? { courseCode } : {}),
    at: mention.at,
    timeAssumed: mention.timeAssumed,
    // Verbatim, both of them. The span is the student's entire evidence that
    // this deadline was stated rather than invented, and `announce.ts`'s
    // `ground()` guarantees it is a substring of the post.
    span: mention.span,
    context: mention.context,
    source: post.source,
    postId: post.id,
    postedAt: post.postedAt,
    createdAt: now,
  };
}

/**
 * What one post does to the list.
 *
 * Nothing is applied here and nothing is written; the caller merges the three
 * maps inside `mutate()`. `now` and `zone` are parameters for the reason every
 * other decision in `core/` takes them: a clock read in here is a behaviour no
 * test can pin.
 */
export function ingestPost(
  input: IngestInput,
  post: ObservedPost,
  now: string,
  zone = "America/Chicago",
  options: IngestOptions = {},
): IngestResult {
  if (typeof post?.id !== "string" || post.id === "") {
    // A missing hook, not a bad value (house rule 1): without an id there is no
    // way to say this post has been read, so every future sight of it would
    // re-apply the same correction. Refusing loudly is the only safe answer.
    throw new ParseError("a post needs an id: nothing else can stop it applying twice");
  }
  if (!isInstant(now)) throw new ParseError(`now must be an instant with an offset: ${String(now)}`);

  const result: IngestResult = {
    dueOverrides: {},
    suggestions: [],
    seenPosts: {},
    skipped: [],
    movedItems: 0,
  };

  if (input.seenPosts[post.id] !== undefined && options.reread !== true) {
    result.skipped.push({
      reason: `post ${post.id} was already read at ${input.seenPosts[post.id]}`,
    });
    return result;
  }
  // Stamped whatever else happens, including when the post said nothing at all:
  // "read and found nothing" and "never read" have to be different, or every
  // page open re-runs the grammar over the same thread.
  result.seenPosts[post.id] = now;

  const mentions = extractDeadlineMentions(post.text, post.postedAt, zone);
  const resolutions = resolveMentions(mentions, input.items, post.courseHint);
  const byId = new Map(input.items.map((item) => [item.id, item]));
  const reason = describePost(post);
  /** Items this post has already moved, so a second sentence cannot re-move them. */
  const movedHere = new Set<string>();

  /**
   * Offer a row the post talked about but may not move, once.
   *
   * One spelling of the two branches that end in a suggestion (a row the
   * student typed, and a reading too weak to apply), because a second copy of
   * "when may this be offered" is mutation rule 3's case — loosen either and
   * the other masks it.
   *
   * The `dueAt` clause is what makes a re-read safe. Accepting a suggestion
   * turns it into a `manual` item and removes the suggestion, so the next
   * reading of the same post — which an edit now causes — would land in the
   * manual branch, find nothing in `suggestions`, and offer the student the
   * deadline they already added. A row that is already due then has nothing to
   * be told.
   */
  const offer = (title: string, mention: ReadMention, dueAt: string | undefined): void => {
    if (dueAt === mention.at) {
      result.skipped.push({ reason: `"${title}" is already due then` });
      return;
    }
    if (
      alreadySuggested(input.suggestions, title, mention.at) ||
      alreadySuggested(result.suggestions, title, mention.at)
    ) {
      return;
    }
    result.suggestions.push(newSuggestion(post, title, mention, now));
  };

  for (const resolution of resolutions) {
    const mention = resolution.mention;

    if (resolution.kind === "new") {
      if (
        alreadySuggested(input.suggestions, resolution.title, resolution.at) ||
        alreadySuggested(result.suggestions, resolution.title, resolution.at)
      ) {
        result.skipped.push({
          reason: `"${resolution.title}" on ${statedDay(resolution.at)} is already suggested`,
        });
        continue;
      }
      result.suggestions.push(newSuggestion(post, resolution.title, mention, now));
      continue;
    }

    const item = byId.get(resolution.itemId);
    if (!item) {
      // `resolveMentions` was given `input.items`, so this cannot happen today.
      // It stays because the two lists are separate arguments, and the day they
      // are not the same list is the day this returns a correction keyed to
      // nothing (mutation rule 2: unreachable, and cheap).
      result.skipped.push({ reason: `no item ${resolution.itemId} to move` });
      continue;
    }

    /*
     * A row the student typed is theirs.
     *
     * `manualItems` exist because the student wrote them down; overwriting one
     * from a post would edit their own words underneath them, and the edit
     * would be keyed by a memberKey the manual editor knows nothing about. It
     * becomes a suggestion instead — the student can add it, or look at their
     * row and see it is already right.
     */
    if (item.members.some((member) => member.source === "manual")) {
      result.skipped.push({
        reason: `"${item.title}" is your own row — suggesting instead of moving it`,
      });
      offer(item.title, mention, item.dueAt);
      continue;
    }

    if (mention.confidence < AUTO_MOVE_CONFIDENCE) {
      result.skipped.push({
        reason:
          `"${item.title}": ${JSON.stringify(mention.span)} is a ${mention.confidence} reading ` +
          `— suggesting instead of moving it`,
      });
      offer(item.title, mention, item.dueAt);
      continue;
    }

    if (movedHere.has(item.id)) {
      // Two sentences about one assignment: the first wins, so the outcome does
      // not depend on which way the loop happens to run.
      result.skipped.push({
        reason: `"${item.title}" was already moved by an earlier sentence in this post`,
      });
      continue;
    }

    if (item.dueAt === mention.at) {
      // Storing this would put "moved Fri → Fri · from a post" on a row that did
      // not move, and arm an undo for a change nobody made.
      result.skipped.push({ reason: `"${item.title}" is already due then` });
      continue;
    }

    movedHere.add(item.id);
    result.movedItems = movedHere.size;
    const entry: DueOverride = {
      at: mention.at,
      ...(resolution.from ? { from: resolution.from } : {}),
      reason,
      postId: post.id,
      appliedAt: now,
      // Worker rule 3: a post that names a day and no clock is 23:59 by this
      // code's invention, and the flag has to travel with the value or §5.3
      // will rank the invention above a real Canvas deadline.
      ...(mention.timeAssumed ? { timeAssumed: true } : {}),
    };
    // Every member key, like `hideItem` and `markDone`: `Item.id` is a hash of
    // the sorted member keys, so a correction keyed by it is spent the moment a
    // second source mirrors the row or the student splits it.
    for (const member of item.members) {
      result.dueOverrides[memberKey(member.source, member.sourceId)] = entry;
    }
  }

  return result;
}

/**
 * The detail line for a row a post moved: "moved Fri → Mon · from a post".
 *
 * Derived from `Item.movedBy`, not from `movedFrom`. `movedFrom` is computed per
 * sync from the previous list and is gone by the next one, so a row corrected on
 * Monday would stop saying so on Tuesday while still showing Monday's date —
 * which is the state a student cannot tell apart from the course having simply
 * printed a different deadline all along.
 */
export function movedByText(item: Item): string | undefined {
  const movedBy = item.movedBy;
  if (!movedBy) return undefined;
  const instant = item.dueAt ?? item.lateDueAt;
  if (instant === undefined) return undefined;
  const to = new Date(instant);
  if (Number.isNaN(to.getTime())) return undefined;
  const day = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const from = movedBy.from === undefined ? undefined : new Date(movedBy.from);
  if (from === undefined || Number.isNaN(from.getTime())) {
    // An item that had no date to move *from* still moved: it went from undated
    // to dated, which is the change a student most wants to see.
    return `now due ${day(to)} · from ${movedBy.reason}`;
  }
  return `moved ${day(from)} → ${day(to)} · from ${movedBy.reason}`;
}

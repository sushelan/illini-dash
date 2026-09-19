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

import {
  describeEmpty,
  extractDeadlineMentions,
  resolveMentions,
  type ReadMention,
} from "./announce.js";
import { itemId } from "./dedupe.js";
import { extractCourseCode, normalizeTitle } from "./normalize.js";
import { isInstant } from "./parsing.js";
import { movedRange } from "./provenance.js";
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
  /**
   * Every course code the class carries, primary first.
   *
   * Piazza names a cross-listed class with both codes at once — the captured
   * one is `"CS 425 / ECE 428: Distributed Systems"` — and a student registered
   * under the second code has rows filed under it. Optional because only the
   * observer knows: absent, the codes are read out of `courseHint`, which gets
   * the same answer for that spelling and a worse one for any other.
   */
  courseCodes?: string[];
  /**
   * The post's own subject line.
   *
   * The title of last resort for a deadline whose sentence names no assignment
   * (G2) or names only the form it was filled in on (G3). Optional, and the
   * first line of `text` is used when it is missing — every observer sends the
   * subject on its own line ahead of the body, so the fallback is the same
   * string by another route.
   */
  subject?: string;
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
function alreadySuggested(
  existing: readonly Suggestion[],
  title: string,
  at: string,
  course: string,
): boolean {
  return existing.some(
    (suggestion) =>
      courseOf(suggestion) === course &&
      statedDay(suggestion.at) === statedDay(at) &&
      sameTitle(suggestion.title, title),
  );
}

/**
 * The course a suggestion belongs to, for the comparison above (#25).
 *
 * Without it, two classes announcing "HW2 is due 9/25" in one sync collided:
 * `background.ts` ingests every class's payloads through one `mutate` and feeds
 * the growing list back in, so the second class's deadline was dropped as a
 * duplicate — and, its post being stamped read on the same pass, never offered
 * again. Badges are course-local by design and a UIUC week puts "HW2", "MP1"
 * and "Quiz 2" on the same Friday routinely.
 *
 * `courseCode` first, because two spellings of one class ("CS 425" and
 * "CS 425 / ECE 428") must not read as two courses; the raw name normalised is
 * the fallback for a class no code could be read out of.
 */
function courseOf(suggestion: { courseCode?: string; courseRaw?: string }): string {
  const raw = suggestion.courseRaw ?? "";
  // `courseCode` is what §5.1 files a row under; reading the same code back out
  // of the raw name is what keeps a suggestion written before that field
  // existed — or by a source that never sets it — from reading as a second
  // course. The upper-cased raw name is the last resort, for a class whose name
  // holds no code at all ("Distributed Systems Lab").
  return suggestion.courseCode ?? extractCourseCode(raw) ?? raw.trim().toUpperCase();
}

function newSuggestion(
  post: ObservedPost,
  title: string,
  mention: ReadMention,
  now: string,
): Suggestion {
  const courseRaw = post.courseHint ?? "";
  // The primary code the class is filed under, which is `courseCodes[0]` when
  // the observer knows and the hint's first code otherwise.
  const courseCode = post.courseCodes?.[0] ?? extractCourseCode(courseRaw);
  const subject = postSubjectOf(post);
  return {
    id: suggestionId(post.id, title, mention.at),
    kind: "new",
    title,
    courseRaw,
    ...(courseCode ? { courseCode } : {}),
    // Additive, and absent rather than empty: a suggestion written by an older
    // build has no subject, and the row keeps today's wording for it instead of
    // drawing an empty pair of quotes (parser rule 5 — `""` is not a value).
    ...(subject ? { postSubject: subject } : {}),
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
 * The post's subject line, from the observer or from the text it sent.
 *
 * Every observer builds `text` as the subject, a newline, then the body
 * (`postsToSend`), so the first line is the subject whether or not the field
 * came through. Read positively: a first line that is the whole post — no
 * newline after it — is a body, not a subject, and naming a row after it would
 * be the sentence-length title G2 exists to stop.
 */
export function postSubjectOf(post: ObservedPost): string {
  const stated = post.subject?.replace(/\s+/g, " ").trim() ?? "";
  if (stated !== "") return stated;
  const newline = post.text.indexOf("\n");
  if (newline <= 0) return "";
  return post.text.slice(0, newline).replace(/\s+/g, " ").trim();
}

/**
 * Where a subject line stops being a name and starts being an announcement.
 *
 * Every one of these is a *separator* an instructor writes when the subject has
 * already said what the post is about and they are adding the rest of the
 * sentence: "MP1 Demo Signups May have moved location (+ Reminder to TAG …)",
 * "HW1 (All students) Released - And Clarifications (Running Post)". Each is
 * spelled with its surrounding space so a name cannot be cut by its own
 * punctuation — "Proj-CNN" and "9:00" are hyphen and colon inside a word, and
 * neither is here.
 */
const SUBJECT_BREAKS = [" (", ": ", " — ", " – ", " - ", " + "];

/**
 * What the row is called, given what the reading called it and what the post
 * was titled.
 *
 * The cut applies to **a title that is the post's subject line and nothing
 * else**, whichever rung of `announce.ts`'s `titleFor` produced it — the
 * subject fallback, or the phrase scan reaching the subject because the
 * sentence named nothing of its own. Both are the same row from the student's
 * side: a sentence-length announcement standing in for a name.
 *
 * A title the *sentence* named is left alone, parentheses and all: "MP2",
 * "MP1 Report (4cr only, EXCEPT Coursera)". That is a name an instructor wrote
 * next to a date, and cutting it at its own punctuation would rename the
 * student's row after something narrower than the post said.
 *
 * Compared as whole trimmed strings rather than by prefix: `titleFor` and
 * `postSubjectOf` both collapse whitespace, and "is this the subject?" has to
 * be an equality or every title that merely *starts* like the subject is cut
 * too.
 */
export function rowTitle(title: string, postSubject: string): string {
  return title.trim() === postSubject.trim() ? shortSubjectTitle(postSubject) : title;
}

/**
 * The part of a subject line worth naming a row after.
 *
 * The floor is three characters rather than none, because the cut is a guess
 * and a two-character row ("HW", "Re") is a worse title than the long one it
 * replaced. When the guess comes back that short, the whole subject stands.
 *
 * The `Suggestion` keeps `postSubject` in full either way: the cut decides what
 * the row is *called*, and the grey line underneath still quotes what the post
 * was actually titled.
 */
export function shortSubjectTitle(subject: string): string {
  const full = subject.replace(/\s+/g, " ").trim();
  let cut = full.length;
  for (const mark of SUBJECT_BREAKS) {
    const at = full.indexOf(mark);
    if (at >= 0 && at < cut) cut = at;
  }
  const head = full.slice(0, cut).trim();
  return head.length < 3 ? full : head;
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
  if (mentions.length === 0) {
    // Worker rule 5, and parser rule 2 one level up: "the post states no
    // deadline" and "the grammar failed on one it states" are the same silence
    // otherwise, and they want opposite fixes. `describeEmpty` has said which
    // since wave 4 and nothing in `src/` was calling it.
    result.skipped.push({ reason: `no deadline read: ${describeEmpty(post.text)}` });
  }
  const subject = postSubjectOf(post);
  const resolutions = resolveMentions(mentions, input.items, post.courseHint, {
    ...(post.courseCodes ? { courseCodes: post.courseCodes } : {}),
    postSubject: subject,
  });
  const byId = new Map(input.items.map((item) => [item.id, item]));
  const reason = describePost(post);
  /** The course every suggestion from this post is filed under (#25). */
  const code = post.courseCodes?.[0];
  const course = courseOf({
    ...(code ? { courseCode: code } : {}),
    courseRaw: post.courseHint ?? "",
  });
  const readAt = Date.parse(now);
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
      alreadySuggested(input.suggestions, title, mention.at, course) ||
      alreadySuggested(result.suggestions, title, mention.at, course)
    ) {
      return;
    }
    result.suggestions.push(newSuggestion(post, title, mention, now));
  };

  for (const resolution of resolutions) {
    const mention = resolution.mention;

    if (resolution.kind === "drop") {
      result.skipped.push({ reason: resolution.reason });
      continue;
    }

    /*
     * A deadline that had already passed when it was read (G1).
     *
     * The first sync of a busy class reads a month of history at once: three of
     * the seven suggestions on Sushi's first real Piazza sync were for 11, 13
     * and 14 September, read on the 18th. A row telling a student to add a
     * deadline that is over is noise they have to dismiss, and moving a *known*
     * item back onto a past date from an old post is worse — it drags a row out
     * of the list's past and offers an undo for a change nothing asked for.
     *
     * Measured against `now`, the moment the post was read, rather than against
     * `postedAt`: an old post stating a future deadline is exactly what a
     * first sync should surface.
     */
    if (Date.parse(mention.at) < readAt) {
      const name =
        resolution.kind === "new" ? resolution.title : byId.get(resolution.itemId)?.title ?? "";
      result.skipped.push({
        reason:
          `${JSON.stringify(name)} at ${mention.at} had already passed when this post` +
          ` was read — nothing to add or move`,
      });
      continue;
    }

    if (resolution.kind === "new") {
      const title = rowTitle(resolution.title, subject);
      if (
        alreadySuggested(input.suggestions, title, resolution.at, course) ||
        alreadySuggested(result.suggestions, title, resolution.at, course)
      ) {
        result.skipped.push({
          reason:
            `"${title}" on ${statedDay(resolution.at)} is already suggested` +
            ` for ${course || "this class"}`,
        });
        continue;
      }
      result.suggestions.push(newSuggestion(post, title, mention, now));
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
  // `movedRange` also answers `undefined` when the two ends are the same
  // moment — a second "Give it a date" that restates the date it already held
  // is not a move, and a move line that reports no move is noise.
  const range = from === undefined ? undefined : movedRange(from, to);
  if (range === undefined) {
    // An item that had no date to move *from* still moved: it went from undated
    // to dated, which is the change a student most wants to see.
    return `now due ${day(to)} · from ${movedBy.reason}`;
  }
  return `moved ${range} · from ${movedBy.reason}`;
}

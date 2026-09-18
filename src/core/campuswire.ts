/**
 * Campuswire's class feed, read out of the page the student is already looking at.
 *
 * Campuswire renders its feed with JavaScript and fetches the posts with a
 * bearer token, so there is **no HTML to fetch**: a §4-style source would get
 * an empty shell however well it was authenticated. That is why this is an
 * observer (Sushi, 2026-09-18) — opt-in per site, read-only, and only ever over
 * a document the browser has already drawn for the student.
 *
 * This module is the pure half: a DOM in, `ObservedPost[]` out. It never
 * fetches, never stores, never messages. `src/observers/campuswire.ts` is the
 * content script that hands it a document and posts the results to the worker;
 * `core/suggest.ts` decides what a post *does*.
 *
 * Three facts about the markup shape everything here (fixtures/campuswire/README.md):
 *
 * 1. **The post number is the identity, not the DOM node.** The same post is
 *    rendered up to three times on one page — in the pinned block, in the dated
 *    list, and again in the hidden "at a glance" column — so a parser that
 *    treats each `.post-preview-wrapper` as a post reports the same deadline
 *    several times and `seenPosts` cannot stop it, because each copy would have
 *    to invent its own id.
 * 2. **A preview states a date and never a clock.** `05/17/26`, nothing more.
 *    Noon is this module's invention and is flagged as such; see `ASSUMED_HOUR`.
 * 3. **Whether a post is an announcement lives in a tooltip attribute**, not in
 *    a class: `.post-type-icon[data-tippy-content="This is a note"]`. Matched
 *    exactly (house rule 6) — "This question is resolved" is a question.
 */

import { wallClockToIso } from "./dates.js";
import { extractCourseCode } from "./normalize.js";
import { textOf } from "./parsing.js";
import { ParseError } from "../sources/types.js";

/** The origin this observer is ever allowed to look at. */
export const CAMPUSWIRE_ORIGIN = "https://campuswire.com";
/** The match pattern asked for at the switch, and registered with the script. */
export const CAMPUSWIRE_MATCH = "https://campuswire.com/*";

/** The feed list. Its presence is what makes a page a class feed. */
const FEED_SELECTOR = ".posts-list-wrap";
/** One rendered post preview, in either of the two shapes. */
const PREVIEW_SELECTOR = ".post-preview-wrapper";
/** The class name, as Campuswire writes it: "ECE 408: Applied Parallel Programming". */
const CLASS_TITLE_SELECTOR = ".sidebartitle-wrap h6";

/**
 * The tooltip an announcement carries, verbatim and entire.
 *
 * Exact equality, not `includes` (house rule 6): every other value of this
 * attribute is a question's state, and one of them — "This question is not yet
 * resolved" — contains no note wording but a looser test ("note") would still
 * be one instructor's post title away from matching the wrong thing.
 */
const NOTE_TOOLTIP = "This is a note";

/**
 * Noon, because a preview states a day and no clock.
 *
 * Not midnight and not 23:59. `postedAt` is the anchor every relative phrase in
 * the post resolves against — "due tomorrow", "11:59pm today", "this Friday" —
 * so the hour chosen decides which *day* those land on. 00:00 and 23:59 each
 * sit against a boundary that a timezone difference or a rounding step can slip
 * over; 12:00 is the only hour in the day that cannot, and a post is in any case
 * far likelier to have been written during the day than at either edge of it.
 *
 * It is still an invention, so it travels flagged (`extra.timeAssumed`, worker
 * rule 3) rather than being handed on as something Campuswire stated.
 */
export const ASSUMED_HOUR = 12;

/** Which posts the deadline pipeline is allowed to see. */
export interface SendOptions {
  /**
   * Send questions as well as notes.
   *
   * Off, and Sushi's decision: a student asking "is HW3 due Friday?" has not
   * stated a deadline, and `announce.ts` cannot tell an instructor's sentence
   * from a classmate's guess — it only reads the words. A wrong auto-move from
   * a question would land on a row the student cannot check against anything.
   * The flag exists because the answer may change once the Attention tab has
   * been lived with, and a flag is cheaper to flip than a filter to find.
   */
  includeQuestions?: boolean;
}

/** One post, deduplicated by its class-local number. */
export interface ObservedPost {
  /** `campuswire:<classCode>:<number>`. Stable across page loads and re-renders. */
  id: string;
  /** The class-local post number: `#682` → 682. The identity on the page. */
  number: number;
  title: string;
  /** The body as the list renders it, whitespace collapsed, Markdown left alone. */
  text: string;
  kind: "note" | "question";
  /**
   * ISO 8601 with offset, at `ASSUMED_HOUR` — or absent when the date could not
   * be read, which costs this field and not the post (house rule 1).
   */
  postedAt?: string;
  /** The class as Campuswire names it, for §5.1's extractor and for the row. */
  courseHint: string;
  courseCode?: string;
  /** Everything that was assumed or unreadable, never silently folded in. */
  extra: { timeAssumed?: true; unparsedDate?: string };
}

/** The page facts the DOM cannot carry: the class code lives in the URL. */
export interface PageContext {
  classCode: string;
  /** ISO instant the page was read. Carried for the caller's bookkeeping. */
  observedAt: string;
  zone?: string;
}

/**
 * Whether this document is a class feed at all.
 *
 * Campuswire is a whole site — a chat channel, a member list, a settings page —
 * and the observer runs on every one of them. Asking this first is what keeps
 * `parseFeed`'s missing-container `ParseError` meaning "the feed changed shape"
 * rather than "the student clicked something else", and what keeps the
 * extension out of the page's console on pages it has no business reading.
 */
export function isClassFeed(root: Document | Element): boolean {
  return root.querySelector(FEED_SELECTOR) !== null;
}

/**
 * The class code out of a feed URL's path: `/c/G794D32E4/feed` → `G794D32E4`.
 *
 * Anchored (house rule 5) and returned as `undefined` rather than `""` when the
 * path is not a class path, because `""` would build ids of the form
 * `campuswire::682` — colliding across every class the student is in, which is
 * house rule 4's failure with the collision moved into the id itself.
 */
export function classCodeFromPath(pathname: string): string | undefined {
  const match = /^\/c\/([A-Za-z0-9_-]+)(?:\/|$)/.exec(pathname);
  return match ? match[1] : undefined;
}

/** `#682` → 682, and nothing else. */
const POST_REF = /^#(\d{1,9})$/;
/**
 * The list shape's date, at the very end of `.post-time`.
 *
 * That element reads
 * `<span class="post-likes">…0</span><i class="far fa-clock"></i>05/17/26`, so its
 * collapsed `textContent` is `005/17/26`: the like count runs straight into the
 * date, because the clock is an empty element with no text of its own. A
 * pattern that looks for a date after a space finds nothing here and every post
 * on the page loses its date at once.
 *
 * End-anchored, so however many digits the like count contributes in front of
 * it, they cannot be read as a month. That anchor is UNREACHABLE today and
 * stays anyway (mutation house rule 2): a like count is digits with no slashes
 * in it, so the first unanchored match would be the right one regardless. It
 * costs one character and it is what keeps this honest the day Campuswire puts
 * an edit stamp — another date — in front of the posted one.
 */
const LIST_DATE = /(\d{2})\/(\d{2})\/(\d{2})$/;
/** The glance shape writes it out: "Posted on 04/28/26 STAFF-2". */
const GLANCE_DATE = /^Posted on (\d{2})\/(\d{2})\/(\d{2})(?:\s|$)/;

interface ReadDate {
  at?: string;
  unparsed?: string;
}

/**
 * The posted date, from whichever of the two shapes this preview is in.
 *
 * Returns the raw text under `unparsed` when the hook is there and the value is
 * not readable — a post whose date this module cannot read is still a post, and
 * dropping it would lose an announcement over a formatting change in a footer.
 * A preview with *neither* hook is a different thing and throws in the caller:
 * the page shape changed.
 */
function readPostedAt(raw: string, zone: string): ReadDate {
  // The glance shape first, because it is the anchored one: `.author-name` is
  // "Posted on 04/28/26 STAFF-2", which ends in a name and not in a date.
  const match = GLANCE_DATE.exec(raw) ?? LIST_DATE.exec(raw);
  if (!match) return { unparsed: raw.slice(0, 200) };
  const [, mm, dd, yy] = match;
  const year = 2000 + Number(yy);
  try {
    return {
      at: wallClockToIso(
        { year, month: Number(mm), day: Number(dd), hour: ASSUMED_HOUR, minute: 0 },
        zone,
      ),
    };
  } catch {
    // `13/40/26` reaches here: the shape matched and the date does not exist.
    return { unparsed: raw.slice(0, 200) };
  }
}

/**
 * Every post the feed is currently showing, once each.
 *
 * Throws when the container is there and nothing inside it matches (house rule
 * 2: a feed that renders no previews is a redesign, not an empty class), and
 * when a preview is missing a hook this parser cannot do without.
 */
export function parseFeed(root: Document | Element, page: PageContext): ObservedPost[] {
  const zone = page.zone ?? "America/Chicago";
  if (typeof page.classCode !== "string" || page.classCode === "") {
    throw new ParseError("a Campuswire feed needs its class code: ids collide across classes");
  }
  if (!isClassFeed(root)) {
    throw new ParseError(`no ${FEED_SELECTOR} on this document: it is not a class feed`);
  }

  const previews = [...root.querySelectorAll(PREVIEW_SELECTOR)];
  if (previews.length === 0) {
    throw new ParseError(
      `${FEED_SELECTOR} is present but no ${PREVIEW_SELECTOR} matched: the feed changed shape`,
    );
  }

  const courseHint = textOf(root.querySelector(CLASS_TITLE_SELECTOR));
  const courseCode = extractCourseCode(courseHint);

  /*
   * Keyed by number, deliberately — and this is the one place this project
   * dedupes rather than throwing on a repeated id (parser house rule 4). The
   * pinned block and the glance column *are* the same posts as the list by
   * design, so a `KeyGuard` here would throw on every healthy page. What rule 4
   * protects against is two different things wearing one key, so that is what
   * is checked below instead.
   */
  const byNumber = new Map<number, ObservedPost>();

  for (const preview of previews) {
    const refEl = preview.querySelector(".post-ref");
    if (refEl === null) {
      throw new ParseError("a Campuswire post preview has no .post-ref: the page changed shape");
    }
    const ref = POST_REF.exec(textOf(refEl));
    if (ref === null) {
      // Not a bad value that costs its own field: this *is* the identity. An
      // unreadable number leaves nothing to dedupe by and nothing for
      // `seenPosts` to remember, so the same correction would re-apply on every
      // page load — the one failure `ObservedPost.id` exists to prevent.
      throw new ParseError(`a Campuswire post number is unreadable: ${JSON.stringify(textOf(refEl))}`);
    }
    const number = Number(ref[1]);

    const titleEl = preview.querySelector(".post-title h3");
    if (titleEl === null) {
      throw new ParseError(`Campuswire post #${number} has no .post-title h3: the page changed shape`);
    }
    const title = textOf(titleEl);

    const icon = preview.querySelector(".post-type-icon[data-tippy-content]");
    if (icon === null) {
      /*
       * Also a missing hook, and the most dangerous one to soften.
       * "note or question" is what decides whether a post reaches the deadline
       * pipeline at all, so defaulting an absent marker either way is silent:
       * defaulting to "question" drops every announcement on the page with the
       * dots still green, and defaulting to "note" feeds the grammar every
       * classmate's guess.
       */
      throw new ParseError(
        `Campuswire post #${number} has no .post-type-icon[data-tippy-content]: ` +
          `nothing left to tell a note from a question`,
      );
    }
    const kind = icon.getAttribute("data-tippy-content") === NOTE_TOOLTIP ? "note" : "question";

    const timeEl = preview.querySelector(".post-time") ?? preview.querySelector(".author-name");
    if (timeEl === null) {
      throw new ParseError(
        `Campuswire post #${number} has neither .post-time nor .author-name: the page changed shape`,
      );
    }
    const date = readPostedAt(textOf(timeEl), zone);

    const post: ObservedPost = {
      id: `campuswire:${page.classCode}:${number}`,
      number,
      title,
      text: textOf(preview.querySelector(".post-text")),
      kind,
      ...(date.at ? { postedAt: date.at } : {}),
      courseHint,
      ...(courseCode ? { courseCode } : {}),
      extra: {
        ...(date.at ? { timeAssumed: true as const } : {}),
        ...(date.unparsed !== undefined ? { unparsedDate: date.unparsed } : {}),
      },
    };

    const seen = byNumber.get(number);
    if (seen === undefined) {
      byNumber.set(number, post);
      continue;
    }
    if (seen.title !== post.title) {
      // Rule 4's real case: one number, two posts. If that ever happens the
      // number is not the identity, and silently keeping the first would merge
      // two announcements into one and lose the other without a trace.
      throw new ParseError(
        `Campuswire #${number} appears twice with different titles ` +
          `(${JSON.stringify(seen.title)} vs ${JSON.stringify(post.title)})`,
      );
    }
    // Same post, second rendering. The first wins, so the result does not
    // depend on which column the page happened to draw first.
  }

  // Insertion order, which is document order: the pinned block first, then the
  // dated list, then the glance column — the order the student sees.
  return [...byNumber.values()];
}

/** What `post-observed` carries. `core/suggest.ts` owns this shape. */
export interface PostPayload {
  id: string;
  source: "campuswire";
  courseHint?: string;
  postedAt: string;
  text: string;
}

/** Posts the worker should hear about, and every reason one was held back. */
export interface SendPlan {
  payloads: PostPayload[];
  skipped: { number: number; reason: string }[];
}

/**
 * Which parsed posts become `post-observed` messages.
 *
 * In core rather than in the content script because every clause is a decision
 * (worker rule 1), and because "the observer sent nothing" and "the observer
 * never ran" are the same silence unless the refusals are enumerable — which is
 * what `skipped` is for (worker rule 5).
 */
export function postsToSend(posts: readonly ObservedPost[], options: SendOptions = {}): SendPlan {
  const plan: SendPlan = { payloads: [], skipped: [] };
  for (const post of posts) {
    if (post.kind !== "note" && options.includeQuestions !== true) {
      plan.skipped.push({ number: post.number, reason: "a question, not an announcement" });
      continue;
    }
    if (post.postedAt === undefined) {
      // Every relative phrase in the post resolves against `postedAt`, so
      // sending one without it would make the grammar anchor on a date this
      // code picked — which is exactly the invention worker rule 3 forbids.
      plan.skipped.push({
        number: post.number,
        reason: `its date is unreadable (${JSON.stringify(post.extra.unparsedDate ?? "")})`,
      });
      continue;
    }
    plan.payloads.push({
      id: post.id,
      source: "campuswire",
      ...(post.courseHint ? { courseHint: post.courseHint } : {}),
      postedAt: post.postedAt,
      // The title carried in front of the body, because an instructor routinely
      // puts the only subject in it ("Proj-CNN Mini Extension" over a body that
      // says only "extend the final deadline"). A newline rather than a space,
      // so the grammar treats it as its own sentence and cannot run the title
      // into the first line of the post.
      text: `${post.title}\n${post.text}`,
    });
  }
  return plan;
}

/** One observer's stored state, as the Settings row reads it. */
export interface ObserverFacts {
  enabled: boolean;
  lastObservedAt?: string;
  postsSeen?: number;
}

/**
 * What the Settings row says, derived from an attempt that happened.
 *
 * Worker rule 2, at the observer level: a switch the student merely flipped has
 * read nothing, and a row that says so is the difference between "it is broken"
 * and "open a class feed". There is no green "ok" to be had here until a page
 * has actually been seen.
 */
export function describeObserver(facts: ObserverFacts | undefined, now: Date = new Date()): string {
  if (!facts?.enabled) return "Off";
  if (facts.lastObservedAt === undefined) return "On · nothing read yet";
  const at = new Date(facts.lastObservedAt);
  const when = Number.isNaN(at.getTime())
    ? facts.lastObservedAt
    : at.toDateString() === now.toDateString()
      ? at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : at.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const seen = facts.postsSeen ?? 0;
  return `On · last read ${when} · ${seen} post${seen === 1 ? "" : "s"}`;
}

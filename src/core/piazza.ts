/**
 * Piazza's class feed, polled by the worker (§4.6, Sushi 2026-09-18).
 *
 * Campuswire is an observer because its feed is drawn by JavaScript behind a
 * bearer token: there is nothing to fetch. Piazza is the opposite — its feed is
 * one JSON POST that the browser's own session cookie authenticates — so Sushi
 * decided it should be a "background source, no page needed": the worker asks
 * for it on the sync schedule whether or not a Piazza tab is open.
 *
 * It is still **not** a `Source` and it is not in `PLANS`. A `Source` produces
 * `RawItem`s and gets a health dot from the sync loop; this produces *posts*,
 * which go to the same `core/suggest.ts` pipeline the Campuswire observer
 * feeds. What it does need, and an observer does not, is the evidence a fetch
 * leaves behind: an attempt, a login state and a failure — so `ObserverState`
 * carries those for this one entry and `describePiazza` derives the row's words
 * from them (worker rule 2: a green dot means "I fetched, and it was fine").
 *
 * Everything here is pure. `background.ts` owns the cookie, the two requests
 * and the store write; every clause that is a *decision* is in this file, where
 * the suite can mutate it (worker rule 1).
 *
 * The evidence is `docs/piazza-findings.md` and `fixtures/piazza/README.md`;
 * where this file and SPEC.md disagree, the capture won (house rule 9).
 */

import { extractCourseCodes } from "./normalize.js";
import { isInstant, KeyGuard, nonEmpty } from "./parsing.js";
import { backoffMinutes } from "./store.js";
import { POPUP_DEBOUNCE_MS } from "./sync.js";
import { ParseError } from "../sources/types.js";

/** The only origin this module ever describes a request to. */
export const PIAZZA_ORIGIN = "https://piazza.com";
/** The optional host permission, asked for from the Settings switch. */
export const PIAZZA_MATCH = "https://piazza.com/*";
/** Where the "Sign in" button on the Settings row goes. */
export const PIAZZA_LOGIN_URL = "https://piazza.com/login";
/**
 * The session cookie whose *value* is echoed as the `CSRF-Token` header.
 *
 * It is `HttpOnly`, so no page and no `fetch` can read it — only
 * `chrome.cookies.get`, which is why this feature needs the `cookies`
 * permission (docs/piazza-findings.md; Sushi confirmed the equality in
 * DevTools by comparing eight characters).
 */
export const PIAZZA_SESSION_COOKIE = "session_id";
/** The header the API insists on. Its value is the cookie above. */
export const PIAZZA_CSRF_HEADER = "CSRF-Token";
/** `limit` in the feed request. One page of posts per class, as the site asks. */
export const FEED_LIMIT = 150;
/**
 * How much of a post this build reads. Bumped when that answer changes.
 *
 * Version 1 read the feed's `content_snipet` — the first 120 characters — and
 * marked every post read at it. Version 2 fetches the whole body. The two are
 * not the same reading, and on an install that already ran version 1 the
 * difference is invisible without this number: `seenPosts` and `lastNr` both
 * say "dealt with", so the 29 notes Sushi's first live sync marked read at
 * their snippets would never be fetched again, and the HW1 deadline in the body
 * of note 28 would never reach him (PROGRESS.md, wave 6).
 *
 * So the version is stored with the posts it was read by, and a store written
 * by an older reader is re-read **once** — bounded by `MAX_BODIES_PER_SYNC` and
 * the `lastNr` cap, so a 106-post class costs 25 bodies a sync until it catches
 * up rather than 106 at once. Absent in the store means 1: the field was added
 * after the reader it names.
 */
export const PIAZZA_READER_VERSION = 2;
/** Every `seenPosts` key this source owns. `piazza:<nid>:<nr>`, from `parseFeed`. */
export const PIAZZA_POST_PREFIX = "piazza:";
/** How long a fetched class list is trusted before it is read again. */
export const CLASS_LIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** The class page: HTML with the enrolment list in a `const USER` object. */
export function classPageUrl(nid?: string): string {
  return nonEmpty(nid) === undefined ? `${PIAZZA_ORIGIN}/class` : `${PIAZZA_ORIGIN}/class/${nid}`;
}

/** One API call, as `background.ts` should send it. */
export interface PiazzaRequest {
  url: string;
  method: "POST";
  body: string;
}

/** `network.get_my_feed` for one class. 108 bytes on the wire, as captured. */
export function feedRequest(nid: string): PiazzaRequest {
  if (nonEmpty(nid) === undefined) {
    throw new ParseError("a Piazza feed request needs a class id");
  }
  return {
    url: `${PIAZZA_ORIGIN}/logic/api?method=network.get_my_feed`,
    method: "POST",
    body: JSON.stringify({
      method: "network.get_my_feed",
      params: { nid, limit: FEED_LIMIT, offset: 0 },
    }),
  };
}

/**
 * The full body of one post — **the seam, not the stage.**
 *
 * The feed carries `content_snipet`, which is the first 120 characters and
 * nothing more, so a deadline sentence further down a long instructor note is
 * invisible to a feed-only build. `content.get` returns the whole post; the
 * response is captured (`fixtures/piazza/post.json`) and `parsePostBody` below
 * reads it.
 *
 * Same endpoint, a different method name, taking the feed entry's `id` as
 * `cid`.
 */
export function postBodyRequest(cid: string, nid: string): PiazzaRequest {
  if (nonEmpty(cid) === undefined || nonEmpty(nid) === undefined) {
    throw new ParseError("a Piazza content.get request needs both a cid and a class id");
  }
  return {
    url: `${PIAZZA_ORIGIN}/logic/api?method=content.get`,
    method: "POST",
    body: JSON.stringify({ method: "content.get", params: { cid, nid } }),
  };
}

/* -------------------------------------------------------------------------- */
/* Post bodies (`content.get`)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Tags that are a line break when they are removed.
 *
 * The body is HTML written in Piazza's rich-text editor, and it reaches the
 * worker as a JSON string — there is no DOM in a service worker and linkedom is
 * a test-only dependency, so the tags come off here. What matters to the
 * grammar is not the markup but the **line structure**: `announce.ts` ends a
 * sentence at punctuation, at a blank line and after a title line, so a `</p>`
 * that vanished without a trace would run an instructor's last sentence into
 * the next paragraph's first one and let a trigger in one bind a date in the
 * other. Everything in this list is a block (or `<br>`), and everything not in
 * it — `<strong>`, `<a>`, `<em>` — is inline and leaves no gap.
 */
const BLOCK_TAG =
  /<\/?(?:p|div|br|li|ul|ol|tr|td|th|table|h[1-6]|blockquote|pre|section|article|header|footer|hr)\b[^>]*>/gi;
/** `<script>`/`<style>` take their contents with them; nothing in them is prose. */
const DROPPED_BLOCK = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
/** Whatever tags are left are inline, and come off without a space. */
const ANY_TAG = /<\/?[a-z][^>]*>/gi;

/**
 * One HTML post body as the text `announce.ts` reads.
 *
 * Exported because it is the one decision in this stage that a fixture cannot
 * fully pin: the capture's markup is well formed, and every way of getting this
 * wrong (eating the line breaks, decoding entities *before* the tags come off
 * so that `&lt;div&gt;` becomes a tag, leaving `&#39;` in a span quoted back at
 * the student) is invisible against it unless it is tested directly.
 *
 * Order is load-bearing and is the reverse of the tempting one: tags first,
 * entities **last**. A body that quotes markup at the student — Piazza posts
 * about `<code>` snippets do — encodes it, and decoding first would turn the
 * quotation into a tag and delete it.
 */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(DROPPED_BLOCK, " ")
    .replace(BLOCK_TAG, "\n")
    .replace(ANY_TAG, "");
  return decodeEntities(withBreaks)
    // A non-breaking space is a space, and `announce.ts`'s patterns spell `\s`.
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    // Three blank lines and one blank line mean the same thing to the sentence
    // splitter; collapsing them keeps a `context` string readable when it is
    // shown beside the post.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** What the caller knows about the request it made; the response is checked against it. */
export interface PostBodyContext {
  nid: string;
  /** The `cid` that was asked for. A response for another post is refused. */
  cid: string;
}

/** One post's current version, read out of a `content.get` response. */
export interface PostBody {
  /** What `ingestPost` reads: the subject on its own line, then the body. */
  text: string;
  subject: string;
  /** The body alone, tags off and entities decoded. */
  bodyText: string;
  /** Staff-written: `instructor-note` in `tags`, or `config.is_announcement`. */
  instructorNote: boolean;
  /** `history[0].created` — when *this version* was written. A real instant. */
  versionAt: string;
  cid: string;
  nr: number;
}

/**
 * The current version of one post.
 *
 * `history` is newest first and holds one entry per edit (five for the captured
 * note), so `history[0]` is the post as it reads now and every older version is
 * deliberately ignored: a deadline an instructor has since corrected is not a
 * deadline, and offering both would put two rows in front of the student for
 * one assignment.
 *
 * Validated positively, top down (house rule 5). Everything here is a **hook**
 * rather than a value — without `history[0].content` there is no body, which is
 * the entire point of this request — so every failure is a `ParseError` naming
 * its field, and `background.ts` isolates it to the one post (the others keep
 * their snippets).
 */
export function parsePostBody(json: unknown, ctx: PostBodyContext): PostBody {
  if (nonEmpty(ctx?.nid) === undefined || nonEmpty(ctx?.cid) === undefined) {
    throw new ParseError("a Piazza post body needs the class id and the cid it was asked for");
  }
  if (!isRecord(json)) {
    throw new ParseError(`the Piazza content.get response for ${ctx.cid} is not a JSON object`);
  }
  // `error` is present and `null` on a healthy response, exactly as in the feed:
  // only a non-empty string is an error (house rule 5).
  const error = nonEmpty(json["error"]);
  if (error !== undefined) {
    throw new ParseError(`Piazza answered with an error for ${ctx.cid}: ${error}`);
  }
  const result = json["result"];
  if (!isRecord(result)) {
    throw new ParseError(`the Piazza content.get response for ${ctx.cid} has no \`result\` object`);
  }

  const cid = nonEmpty(result["id"]);
  if (cid === undefined) {
    throw new ParseError(`the Piazza post body for ${ctx.cid} has no \`id\``);
  }
  if (cid !== ctx.cid) {
    /*
     * The body of one post under another post's id would be ingested against
     * the wrong `seenPosts` key and quoted back at the student as words the
     * post it names does not contain. Cheap to check, and the only check that
     * can catch a request that was answered out of order.
     */
    throw new ParseError(
      `Piazza answered with post ${cid} for a request about ${ctx.cid}`,
    );
  }
  const nr = result["nr"];
  if (typeof nr !== "number" || !Number.isInteger(nr) || nr < 0) {
    throw new ParseError(`the Piazza post body for ${ctx.cid} has no usable \`nr\``);
  }

  const history = result["history"];
  if (!Array.isArray(history) || history.length === 0 || !isRecord(history[0])) {
    // House rule 2: `history` is the container, and a `content.get` that
    // returned none is a redesign, never a post with no text.
    throw new ParseError(`the Piazza post body for ${ctx.cid} has no \`history[0]\``);
  }
  const version = history[0] as Record<string, unknown>;

  const content = version["content"];
  if (typeof content !== "string" || content.trim() === "") {
    throw new ParseError(`the Piazza post body for ${ctx.cid} has no \`history[0].content\``);
  }
  if (typeof version["subject"] !== "string") {
    throw new ParseError(`the Piazza post body for ${ctx.cid} has no \`history[0].subject\``);
  }
  const versionAt = version["created"];
  if (!isInstant(versionAt)) {
    throw new ParseError(
      `the Piazza post body for ${ctx.cid} has no readable \`history[0].created\`: ` +
        JSON.stringify(versionAt),
    );
  }

  const subject = decodeEntities(version["subject"]).trim();
  const bodyText = htmlToText(content);

  /*
   * Two positive markers, either of which is enough, and both exact (house rule
   * 6): `instructor-note` is a whole tag and never a substring of another, and
   * `config.is_announcement` is Piazza's own flag. A `type: "note"` can still
   * be a pinned *student* post — the capture has one ("Search for Teammates!",
   * tagged `pin`, `student`) — so "it is a note" is not the same claim.
   */
  const tags = result["tags"];
  const instructorNote =
    (Array.isArray(tags) && tags.some((tag) => tag === "instructor-note")) ||
    (isRecord(result["config"]) && Boolean(result["config"]["is_announcement"]));

  return {
    // The subject as its own line, exactly as the feed stage builds it, so the
    // grammar's title rule sees the same shape whichever stage read the post —
    // and so a span is grounded in *this* string and no other.
    text: subject === "" ? bodyText : `${subject}\n${bodyText}`,
    subject,
    bodyText,
    instructorNote,
    versionAt,
    cid,
    nr,
  };
}

/**
 * The feed's post, re-read with the body the second request returned.
 *
 * A pure seam rather than an object spread in the worker: the `nr` guard is a
 * decision, and worker house rule 1 says a decision belongs where the suite can
 * mutate it. `id`, `cid` and `postedAt` all stay the feed's — the id is what
 * `seenPosts` remembers, and `history[0].created` is when the latest *edit* was
 * made, which is not when the post was written and must not become the anchor
 * every relative phrase in it resolves against.
 */
export function withPostBody(post: ObservedPost, body: PostBody): ObservedPost {
  if (post.nr !== body.nr) {
    throw new ParseError(
      `Piazza post ${post.nr} was answered with the body of post ${body.nr}`,
    );
  }
  return {
    ...post,
    subject: body.subject === "" ? post.subject : body.subject,
    text: body.text,
    bodyRead: true,
  };
}

/* -------------------------------------------------------------------------- */
/* The class list                                                             */
/* -------------------------------------------------------------------------- */

/** One enrolment, reduced to what the poller and the Settings row need. */
export interface PiazzaClass {
  /** The network id: the class URL's last path segment, and the feed's `nid`. */
  nid: string;
  /** How Piazza names it: `my_name`, or `course_number` when that is all there is. */
  courseRaw: string;
  /** §5.1 over `course_number`. "CS 425 / ECE 428" keeps both codes. */
  courseCodes: string[];
  /** `fall2026`. Absent when the entry's term could not be read. */
  termKey?: string;
  /** Whether this class is in the term the clock says we are in. */
  active: boolean;
  /** What was unreadable, never silently folded in (house rule 1). */
  extra?: { unparsedTerm?: string };
}

/** A term key, as Piazza writes it. Anchored, because `""` must not pass. */
const TERM_KEY = /^(fall|spring|summer|winter)(\d{4})$/;
/** `"Fall 2026"` — the human form, used when `term_key` is missing. */
const TERM_TEXT = /^(fall|spring|summer|winter)\s+(\d{4})$/;

/**
 * Which term it is, from the clock: fall Aug–Dec, spring Jan–May, summer Jun–Jul.
 *
 * Sushi's boundaries, and the reason this exists at all is in the fixture: the
 * capture holds a **spring 2026 class that is still `status: "active"`** in
 * September. Filtering on `status` alone would poll it every half hour forever
 * and offer its stale announcements to the grammar, so the term is what decides
 * and `status` is not read (fixtures/piazza/README.md).
 */
export function currentTermKey(now: Date): string {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const season = month >= 8 ? "fall" : month >= 6 ? "summer" : "spring";
  return `${season}${year}`;
}

/** `term_key`, or the `term` text, normalized. `undefined` when neither reads. */
function readTermKey(entry: Record<string, unknown>): string | undefined {
  const key = nonEmpty(entry["term_key"])?.toLowerCase().replace(/\s+/g, "");
  if (key !== undefined && TERM_KEY.test(key)) return key;
  const text = nonEmpty(entry["term"])?.toLowerCase().trim();
  const match = text === undefined ? null : TERM_TEXT.exec(text);
  return match ? `${match[1]}${match[2]}` : undefined;
}

/** The one thing on a signed-in class page that a signed-out one never has. */
const USER_OBJECT = /const\s+USER\s*=\s*\{/;

/**
 * The splash's own login form, and nothing else on it.
 *
 * Piazza answers `/class/<nid>` for a signed-out student with its **marketing
 * page** — 200, the unchanged URL, an ordinary `<title>` — which is house rule
 * 11's case exactly: the parser runs, finds no enrolments, and throws
 * `parse_error` ("the page changed, go fix the selectors") at a student whose
 * entire fix is signing in.
 *
 * Of the four candidates the capture offers (`#loginModal`, `form#login-form`,
 * `body.new_splash`, `body.qa_homepage_container`) this one is the form,
 * anchored on **both** its id and its `action`. Two reasons for it over the
 * body class: a class attribute is a list, so `qa_homepage_container` can
 * acquire neighbours and can be reused on any Piazza page that borrows the
 * homepage shell, whereas a form that posts your password to
 * `https://piazza.com/class` *is* the sign-in prompt — if it is there, there is
 * something to click, which is the whole claim `needs_login` makes. The
 * `action` is matched literally, not by substring, because "a form somewhere on
 * the page" is the loose marker house rule 12 warns about.
 *
 * And the marker is never enough on its own: `classifyClassPage` requires the
 * `const USER` object to be **absent** as well, so a signed-in page that one
 * day ships a hidden login form cannot silently freeze this source on
 * "Sign in needed".
 */
const LOGIN_FORM = /<form\b[^>]*>/gi;

function hasLoginForm(html: string): boolean {
  LOGIN_FORM.lastIndex = 0;
  for (const tag of html.match(LOGIN_FORM) ?? []) {
    if (/\bid="login-form"/i.test(tag) && /\baction="https:\/\/piazza\.com\/class"/i.test(tag)) {
      return true;
    }
  }
  return false;
}

/** What a 200 from `/class/<nid>` actually is. */
export type ClassPageKind = "signed_in" | "signed_out" | "changed";

/**
 * Signed in, signed out, or neither — the three answers, named.
 *
 * `changed` is the one that has to exist. "No `const USER`" used to mean
 * `needs_login`, which is safe in the case it was written for and wrong the day
 * Piazza renames the object: the row would say "Sign in needed" to a student
 * who is signed in, the list would freeze at whatever it last held, and nothing
 * would say so (house rule 12). With a positive marker for the splash, a page
 * with **neither** is what it says it is: the page changed.
 */
export function classifyClassPage(html: string): ClassPageKind {
  if (typeof html !== "string") return "changed";
  if (USER_OBJECT.test(html)) return "signed_in";
  return hasLoginForm(html) ? "signed_out" : "changed";
}

/**
 * The `const USER = {…};` object the class page ships its enrolment list in.
 *
 * Found by an anchored marker and then read by matching braces rather than by a
 * regex: the object holds every folder name, every professor and a nested
 * config, so a lazy `\{.*\}` either stops at the first `}` inside it or eats
 * the rest of the script. String state is tracked so a `}` inside a post title
 * cannot end the object early.
 */
function readUserObject(html: string): Record<string, unknown> {
  const marker = USER_OBJECT.exec(html);
  if (marker === null) {
    /*
     * Reached only when the caller skipped `classifyClassPage`, which is the
     * function that decides between "sign in" and "the page changed". Kept as a
     * hard refusal rather than deleted: the alternative is reading an
     * enrolment list out of a page that has none.
     */
    throw new ParseError(
      "no `const USER =` on this Piazza class page: either nobody is signed in, or the page changed shape",
    );
  }

  const start = marker.index + marker[0].length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i += 1) {
    const char = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed: unknown = JSON.parse(html.slice(start, i + 1));
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new ParseError("Piazza's `const USER` is not an object");
          }
          return parsed as Record<string, unknown>;
        } catch (err) {
          if (err instanceof ParseError) throw err;
          throw new ParseError(
            `Piazza's \`const USER\` object could not be read as JSON: ${String(err)}`,
          );
        }
      }
    }
  }
  throw new ParseError("Piazza's `const USER` object is not closed: the page was truncated");
}

/** Every class the student is in, and which term the clock says it is. */
export interface ClassPage {
  networks: PiazzaClass[];
  /** `fall2026`. Carried out so the caller can log *why* a class was skipped. */
  currentTerm: string;
}

/**
 * The enrolment list out of a signed-in class page.
 *
 * Throws when the object is missing (above) and when `networks` is missing or
 * is not an array — a class page that renders a `USER` with no enrolment list
 * is a redesign, not a student in no classes, and returning `[]` there would
 * silently switch Piazza off for good (house rule 2).
 */
export function parseClassPage(html: string, now: Date): ClassPage {
  const user = readUserObject(html);
  const networks = user["networks"];
  if (!Array.isArray(networks)) {
    throw new ParseError(
      "Piazza's `const USER` has no `networks` array: the class list moved, and an empty " +
        "enrolment would switch this source off silently",
    );
  }

  const currentTerm = currentTermKey(now);
  // House rule 4, at the class level: two entries under one nid would merge into
  // one polled class and lose the other's feed with nothing said.
  const guard = new KeyGuard();
  const out: PiazzaClass[] = [];

  for (const entry of networks) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ParseError("a Piazza network entry is not an object: the class list changed shape");
    }
    const record = entry as Record<string, unknown>;
    const nid = nonEmpty(record["id"]);
    if (nid === undefined) {
      // The identity, like Campuswire's post number: without it there is
      // nothing to poll, nothing to key `lastNr` by and nothing to name in a
      // log line, so this is a missing hook and not a bad value.
      throw new ParseError("a Piazza network entry has no `id`: nothing left to poll it by");
    }
    guard.claim(nid, `Piazza class id ${nid}`);

    const courseNumber = nonEmpty(record["course_number"]);
    const myName = nonEmpty(record["my_name"]);
    const courseRaw = myName ?? courseNumber ?? nid;
    // §5.1 over `course_number` first: it is the codes and only the codes,
    // where `my_name` runs them into a title an instructor typed.
    const courseCodes = extractCourseCodes(courseNumber ?? myName ?? "");

    const termKey = readTermKey(record);
    out.push({
      nid,
      courseRaw,
      courseCodes,
      ...(termKey === undefined ? {} : { termKey }),
      // A class whose term cannot be read is kept and **not** polled: keeping it
      // means the Settings row can say a class was seen, and not polling it
      // means an unreadable term cannot resurrect a class from 2019.
      active: termKey === currentTerm,
      ...(termKey === undefined
        ? {
            extra: {
              // Whichever of the two actually said something: `term_key: ""`
              // is not the evidence, it is the absence of it (house rule 5).
              unparsedTerm: (nonEmpty(record["term_key"]) ?? nonEmpty(record["term"]) ?? "").slice(0, 120),
            },
          }
        : {}),
    });
  }

  return { networks: out, currentTerm };
}

/* -------------------------------------------------------------------------- */
/* The feed                                                                   */
/* -------------------------------------------------------------------------- */

/** One post, as the feed shows it. The body is not in here; see `postBodyRequest`. */
export interface ObservedPost {
  /** `piazza:<nid>:<nr>`. Stable for the post, which is what `seenPosts` needs. */
  id: string;
  /** The class-local post number. The identity on the page and in the URL. */
  nr: number;
  /** The content id `content.get` takes, kept for the stage that is not built. */
  cid: string;
  nid: string;
  kind: "note" | "question" | "other";
  subject: string;
  /** `content_snipet`: the first 120 characters of the body and no more. */
  snippet: string;
  /** What the grammar reads: the subject as its own line, then the snippet. */
  text: string;
  /**
   * True once `withPostBody` has replaced `text` with the whole post.
   *
   * The two stages are not interchangeable — a snippet stops at character 120,
   * and every deadline in this class's long posts is past it — so the log line
   * and `PiazzaFacts` have to be able to say which one a run actually read
   * (worker rule 2: "I fetched" and "I fell back" are different claims).
   */
  bodyRead?: boolean;
  /** A real instant Piazza stated (`log[0].t`). Never invented here. */
  postedAt?: string;
  /**
   * When the **body** was last written — the newest content edit, from the feed.
   *
   * Not `modified`, and that is the finding: `modified` (and its epoch twin
   * `m`) is the last *activity* of any kind, so a classmate's follow-up moves
   * it and re-reading on it would fetch bodies nobody has touched. The entry's
   * own `log[]` names each event, and the last one whose `n` is `update` (or
   * `create`, for a post never edited) is the edit itself. Both captures agree
   * to the second: nr 28's last `update` is `2026-09-13T22:22:48Z` and nr 179's
   * is `2026-09-18T03:12:18Z`, which are exactly the `history[0].created` of
   * `post-running.json` and `post.json` (fixtures/piazza/README.md).
   *
   * Absent when the value does not read as an instant — a bad value costs its
   * own field (house rule 1) — and an absent one means "not known to have been
   * edited", which skips a re-read rather than forcing one.
   */
  editedAt?: string;
  /** True when this post is being read again because it was edited since. */
  reread?: boolean;
  courseHint?: string;
  extra: { unparsedPostedAt?: string; unparsedType?: string; unparsedEditedAt?: string };
}

/** The page facts the response does not carry. */
export interface FeedContext {
  nid: string;
  courseHint?: string;
  /** ISO instant the response was read. Carried for the caller's bookkeeping. */
  fetchedAt: string;
}

/**
 * The handful of entities a JSON field can carry, undone.
 *
 * Campuswire's posts arrive through a DOM, which decodes these on the way in;
 * Piazza's arrive as JSON with the markup's entities intact — real subjects in
 * the capture read `MP1 &#34;Recommended&#34; solutions` and
 * `Registering ... &amp; 4cr`. Left alone they reach the student inside a
 * suggestion's own evidence span, which is the one string in this project that
 * must be quotable back at the post.
 */
function decodeEntities(raw: string): string {
  return raw
    .replace(/&#(\d{1,7});/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Last, or `&amp;lt;` decodes twice into a tag.
    .replace(/&amp;/g, "&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The `log[]` events that mean "the body now reads differently".
 *
 * Exact values, never a substring (house rule 6): the captured feed uses
 * `create`, `update`, `followup`, `feedback`, `s_answer`, `i_answer` and
 * `i_answer_update` — and `i_answer_update` **contains** `update` while being a
 * TA editing their own answer, which is a child and not the post. Matching
 * loosely would re-fetch a body on every answer edit for ever.
 */
const CONTENT_EDIT = new Set(["create", "update"]);

/** The last content edit in one feed entry's `log[]`, unvalidated. */
function lastContentEdit(log: readonly unknown[]): unknown {
  let found: unknown;
  for (const event of log) {
    if (!isRecord(event)) continue;
    if (typeof event["n"] === "string" && CONTENT_EDIT.has(event["n"])) found = event["t"];
  }
  return found;
}

/**
 * Whether a post that was already read has been edited since it was read.
 *
 * The whole point of the re-read, and the whole bound on it: the "Running Post"
 * is edited weekly and its deadline sentence changes with it, but a feed of 106
 * posts must not be re-fetched every half hour to find that out. Both instants
 * are compared numerically after `isInstant` has accepted them (house rule 5:
 * `Date.parse` takes a bare date, and two strings compared as strings put
 * `2026-09-9` after `2026-09-13`).
 *
 * Unknown either way is **false**: a post with no readable edit instant, or one
 * this store has never seen, is not evidence of a change.
 */
export function editedSinceSeen(post: ObservedPost, seenAt: string | undefined): boolean {
  if (!isInstant(post.editedAt) || !isInstant(seenAt)) return false;
  return Date.parse(post.editedAt) > Date.parse(seenAt);
}

/**
 * The posts in one `network.get_my_feed` response.
 *
 * Validated positively, top down (house rule 5): `typeof x === "string"` passes
 * `""`, and this response is a `unknown` off the network — the compile-time
 * type would be a claim about Piazza's build, not about these bytes.
 *
 * An **empty `result.feed`** is a legitimately empty class and returns `[]`.
 * That is the one place this file departs from house rule 2, and deliberately:
 * the container here is the JSON shape, which is checked above it, and a class
 * created for a term that has not started really does answer with no posts.
 * A missing `result`, or an `error` the server named, is a `ParseError`.
 */
export function parseFeed(json: unknown, page: FeedContext): ObservedPost[] {
  if (nonEmpty(page?.nid) === undefined) {
    throw new ParseError("a Piazza feed needs its class id: post ids collide across classes");
  }
  if (!isRecord(json)) {
    throw new ParseError("the Piazza feed response is not a JSON object");
  }
  /*
   * `error` is **present and `null`** on a healthy response (the capture says
   * so), so its presence proves nothing and only a non-empty string does. This
   * is house rule 5 in the shape that bites: `if (json.error)` would have been
   * right by luck, and `if ("error" in json)` would have thrown on every
   * successful sync.
   */
  const error = nonEmpty(json["error"]);
  if (error !== undefined) {
    throw new ParseError(`Piazza answered with an error: ${error}`);
  }
  const result = json["result"];
  if (!isRecord(result)) {
    throw new ParseError(
      "the Piazza feed response has no `result` object: nothing here is a feed",
    );
  }
  const feed = result["feed"];
  if (!Array.isArray(feed)) {
    throw new ParseError("`result.feed` is not an array: the feed changed shape");
  }

  const guard = new KeyGuard();
  const posts: ObservedPost[] = [];

  for (const entry of feed) {
    if (!isRecord(entry)) {
      throw new ParseError("a Piazza feed entry is not an object: the feed changed shape");
    }
    const nr = entry["nr"];
    if (typeof nr !== "number" || !Number.isInteger(nr) || nr < 0) {
      // The identity. An unreadable one leaves nothing for `seenPosts` to
      // remember, so the same correction would re-apply on every poll — the one
      // failure the id exists to prevent.
      throw new ParseError(`a Piazza post number is unreadable: ${JSON.stringify(nr)}`);
    }
    // House rule 4. `seenPosts` and `lastNr` are both keyed by this, so two
    // posts under one number would silently become one.
    guard.claim(`${nr}`, `Piazza post number ${nr}`);

    const cid = nonEmpty(entry["id"]);
    if (cid === undefined) {
      throw new ParseError(`Piazza post ${nr} has no \`id\`: its body could never be fetched`);
    }
    const type = nonEmpty(entry["type"]);
    if (type === undefined) {
      /*
       * The most dangerous field to default, exactly as in Campuswire: this is
       * what decides whether a post reaches the grammar at all. Defaulting to
       * "question" drops every announcement with the row still saying "ok";
       * defaulting to "note" feeds it every classmate's guess.
       */
      throw new ParseError(
        `Piazza post ${nr} has no \`type\`: nothing left to tell a note from a question`,
      );
    }
    if (typeof entry["subject"] !== "string") {
      throw new ParseError(`Piazza post ${nr} has no \`subject\`: the feed changed shape`);
    }
    const log = entry["log"];
    if (!Array.isArray(log) || log.length === 0 || !isRecord(log[0])) {
      throw new ParseError(`Piazza post ${nr} has no \`log[0]\`: the feed changed shape`);
    }

    // Exact match, never a substring (house rule 6): every other value is
    // something this build must not send, and an unknown one is not a note.
    const kind = type === "note" ? "note" : type === "question" ? "question" : "other";
    const subject = decodeEntities(entry["subject"]);
    // Piazza's own spelling, and the only place the body appears in a feed.
    const snippet =
      typeof entry["content_snipet"] === "string" ? decodeEntities(entry["content_snipet"]) : "";

    // The hook is there; the value may not be. That costs the field and not the
    // post (house rule 1) — and `postsToSend` then refuses to send it, because
    // every relative phrase in the text resolves against this instant.
    const at: unknown = (log[0] as Record<string, unknown>)["t"];
    const postedAt = isInstant(at) ? at : undefined;

    // The newest content edit, read off the log the feed already carries: no
    // second request, and never `modified`, which a follow-up moves.
    const editedRaw = lastContentEdit(log);
    const editedAt = isInstant(editedRaw) ? editedRaw : undefined;

    posts.push({
      id: `piazza:${page.nid}:${nr}`,
      nr,
      cid,
      nid: page.nid,
      kind,
      subject,
      snippet,
      // The subject on its own line, like Campuswire's title: instructors put
      // the only subject of a post in it ("HW1 ... Released"), and a newline
      // stops the grammar running it into the first sentence of the body.
      text: snippet === "" ? subject : `${subject}\n${snippet}`,
      ...(postedAt === undefined ? {} : { postedAt }),
      ...(editedAt === undefined ? {} : { editedAt }),
      ...(page.courseHint ? { courseHint: page.courseHint } : {}),
      extra: {
        ...(postedAt === undefined ? { unparsedPostedAt: String(at).slice(0, 120) } : {}),
        ...(kind === "other" ? { unparsedType: type.slice(0, 40) } : {}),
        ...(editedAt === undefined && editedRaw !== undefined
          ? { unparsedEditedAt: String(editedRaw).slice(0, 120) }
          : {}),
      },
    });
  }

  return posts;
}

/** Which posts the deadline pipeline is allowed to see. */
export interface SendOptions {
  /**
   * Send questions as well as notes. Off, and for Campuswire's reason: a
   * student asking "is HW3 due Friday?" has stated no deadline, and the grammar
   * cannot tell an instructor's sentence from a classmate's guess.
   */
  includeQuestions?: boolean;
  /** Skip posts at or below this number — the last one already read for this class. */
  sinceNr?: number;
  /**
   * `seenPosts` from the store: post id → when it was read.
   *
   * Only ever used to let an *edited* post past `sinceNr`. Omitted, nothing
   * below `sinceNr` is ever fetched again, which is what every sync before this
   * one did.
   */
  seenPosts?: Record<string, string>;
}

/** What `post-observed`'s handler path takes. `core/suggest.ts` owns this shape. */
export interface PostPayload {
  id: string;
  source: "piazza";
  courseHint?: string;
  postedAt: string;
  text: string;
}

export interface SendPlan {
  payloads: PostPayload[];
  /**
   * The posts those payloads were built from, in the same order.
   *
   * The body stage needs the `cid` and the `nr`, which a `PostPayload`
   * deliberately does not carry — and re-deriving "which posts would be sent"
   * from a second copy of the filters below is mutation house rule 3's case:
   * two spellings of one decision, where loosening either is masked by the
   * other staying strict.
   */
  sent: ObservedPost[];
  skipped: { nr: number; reason: string }[];
}

/**
 * Which parsed posts become posts the worker ingests.
 *
 * In core, with every refusal enumerated, because "Piazza sent nothing" and
 * "Piazza never ran" are the same silence otherwise (worker rule 5).
 */
export function postsToSend(posts: readonly ObservedPost[], options: SendOptions = {}): SendPlan {
  const plan: SendPlan = { payloads: [], sent: [], skipped: [] };
  for (const original of posts) {
    let post = original;
    if (options.sinceNr !== undefined && post.nr <= options.sinceNr) {
      /*
       * Already read — unless the instructor has written it again since.
       *
       * The "Running Post" is edited weekly and its deadline sentence changes
       * with it, while `seenPosts` is keyed by the post and says nothing about
       * *which version* was read. Without this, a correction in an edit is
       * something this source structurally cannot see. The test is the feed
       * entry's own edit instant against the instant this store read it: no
       * extra request, and an unedited post stays skipped.
       */
      if (!editedSinceSeen(post, options.seenPosts?.[post.id])) {
        // Not a failure: a 150-post feed re-read every half hour would otherwise
        // print 150 "already read" lines per class per poll, which is a log
        // nobody can read a real failure out of.
        plan.skipped.push({ nr: post.nr, reason: `already read (<= ${options.sinceNr})` });
        continue;
      }
      // Carried on the post rather than decided again downstream: `ingestPost`
      // refuses a post it has already seen, and this flag is the one thing that
      // may overrule it (mutation rule 3 — one spelling of one decision).
      post = { ...post, reread: true };
    }
    if (post.kind !== "note" && options.includeQuestions !== true) {
      plan.skipped.push({ nr: post.nr, reason: `a ${post.kind}, not an announcement` });
      continue;
    }
    if (post.postedAt === undefined) {
      plan.skipped.push({
        nr: post.nr,
        reason: `its posted date is unreadable (${JSON.stringify(post.extra.unparsedPostedAt ?? "")})`,
      });
      continue;
    }
    plan.payloads.push({
      id: post.id,
      source: "piazza",
      ...(post.courseHint ? { courseHint: post.courseHint } : {}),
      postedAt: post.postedAt,
      text: post.text,
    });
    plan.sent.push(post);
  }
  return plan;
}

/**
 * How many post bodies one sync will fetch for one class.
 *
 * A first sync on a class with a term's worth of posts would otherwise fire a
 * `content.get` for every one of them at once. The rest are not dropped — they
 * are read on the next sync, which is why `lastNr` below stops at the batch
 * rather than at the top of the feed.
 */
export const MAX_BODIES_PER_SYNC = 25;

export interface BodyBatch {
  /** The posts whose bodies this sync fetches, oldest first. */
  batch: ObservedPost[];
  /** How many new posts are left for the next sync. */
  deferred: number;
  /**
   * The highest post number this sync may remember having read.
   *
   * **Capped at the batch** when anything was deferred, and this is the whole
   * reason the batch is oldest-first. `seenPosts` and `lastNr` both say "this
   * post is dealt with": advancing either past a post whose body was never
   * fetched would leave it read at its 120-character snippet for good, which is
   * exactly the silent half-read this stage exists to end.
   */
  lastNr?: number;
}

/**
 * Which new posts get a second request this sync, and which wait.
 *
 * Pure, and given the whole feed as well as the sendable posts, because the
 * `lastNr` ceiling is a fact about the feed: when nothing was deferred, the
 * questions and the already-decided posts above the last note are dealt with
 * too and the mark can go to the top of the page.
 */
export function bodyBatch(
  sent: readonly ObservedPost[],
  all: readonly ObservedPost[],
  limit = MAX_BODIES_PER_SYNC,
): BodyBatch {
  const ordered = [...sent].sort((a, b) => a.nr - b.nr);
  const batch = ordered.slice(0, Math.max(0, limit));
  const deferred = ordered.length - batch.length;
  if (deferred > 0) {
    return { batch, deferred, lastNr: batch[batch.length - 1]!.nr };
  }
  const top = highestNr(all);
  return { batch, deferred: 0, ...(top === undefined ? {} : { lastNr: top }) };
}

/** The highest post number in a feed, for `lastNr`. `undefined` for an empty one. */
export function highestNr(posts: readonly ObservedPost[]): number | undefined {
  let top: number | undefined;
  for (const post of posts) if (top === undefined || post.nr > top) top = post.nr;
  return top;
}

/* -------------------------------------------------------------------------- */
/* Login, health and the plan                                                  */
/* -------------------------------------------------------------------------- */

export type PiazzaResponseKind = "ok" | "needs_login" | "http_error";

/** A login path, anchored on the path and never on words in the page (rule 12). */
const LOGIN_PATH = /^\/(login|signup|account\/login)(\/|$)/;
/** What an expired session says in a JSON `error`. Matched on the wording it uses. */
const LOGIN_ERROR = /\b(log ?in|sign ?in|logged ?out|session|not authenticated|no user)\b/i;

/**
 * Whether a Piazza response is an expired or absent session.
 *
 * **The status comes first** (house rule 8). Piazza's API does not redirect an
 * expired session anywhere: it answers at the unchanged URL, with JSON, and
 * either a 401/403 or a 200 carrying an `error`. A URL-and-body test alone
 * reads the first of those as "signed in" and then reports `parse_error` — the
 * one state that offers nothing to click, in the one case where clicking Sign
 * in is the entire fix.
 *
 * The body test is deliberately narrow: it reads the server's own `error`
 * string and never the page's prose, because "Log In" appears inside an
 * assignment called *Log Interpretation* (house rule 12).
 */
export function classifyPiazzaResponse(input: {
  status: number;
  finalUrl?: string;
  body?: unknown;
}): PiazzaResponseKind {
  if (input.status === 401 || input.status === 403) return "needs_login";

  if (input.finalUrl !== undefined) {
    try {
      const url = new URL(input.finalUrl);
      if (url.hostname.endsWith("piazza.com") && LOGIN_PATH.test(url.pathname)) return "needs_login";
    } catch {
      // An unparseable final URL decides nothing; the status and the body still do.
    }
  }

  if (isRecord(input.body)) {
    const error = nonEmpty(input.body["error"]);
    if (error !== undefined && LOGIN_ERROR.test(error)) return "needs_login";
  }

  if (input.status < 200 || input.status > 299) return "http_error";
  return "ok";
}
/** What the Settings row is allowed to assert, all of it from an attempt. */
export type PiazzaHealth = "pending" | "ok" | "needs_login" | "error";

/** The stored facts this module reads. A narrow view of `ObserverState`. */
export interface PiazzaFacts {
  enabled: boolean;
  /**
   * `pending` until a request is made — and back to `pending` for a run that
   * made **no request at all** (worker rule 2: `ok` means "I fetched, and it
   * was fine", never "I did not fetch"). A run with nothing to poll used to
   * record `ok`, so a between-terms store sat on a green row and a December
   * reading for months.
   */
  state?: PiazzaHealth;
  /** When a fetch was last *attempted*. The only thing `ok` may be derived from. */
  lastAttemptAt?: string;
  /** When posts were last actually read. */
  lastObservedAt?: string;
  /**
   * What the last attempt could not do, in the words the row shows.
   *
   * Not only failures: a run that read three classes of four, or that could not
   * open six post bodies, **succeeded and has something to say** — and with no
   * per-class field in the store (`migrateObservers` whitelists what it keeps)
   * this one sentence is where the caveat lives. `applyPiazzaResult` is the
   * only writer, `describePiazza` shows it beside the counts, and a clean run
   * clears it.
   */
  lastError?: string;
  postsSeen?: number;
  /**
   * How many deadlines those posts produced — moved rows plus suggestions.
   *
   * Separate from `postsSeen` and written only by a run that actually ingested,
   * because "25 posts" on its own reads as working while producing nothing:
   * that is the sentence that hid the feed stage finding zero deadlines on this
   * class for a day. `undefined` means no run has ever counted (an old store),
   * and the row says nothing rather than claiming "none" — worker rule 2: the
   * UI may only assert what an attempt recorded.
   */
  deadlinesFound?: number;
  classes?: PiazzaClass[];
  classesFetchedAt?: string;
  /** nid → the highest post number already read for that class. */
  lastNr?: Record<string, number>;
  /**
   * Which reader read those posts. Absent means 1, the snippet-only reader.
   *
   * Stamped only by a run that actually fetched, and in the same write as what
   * that run produced: a crash between the upgrade and the results must re-run
   * the upgrade next sync, not skip it.
   */
  readerVersion?: number;
  /** §6's ladder, one level down: the earliest next attempt after a failure. */
  nextAttemptAt?: string;
  /**
   * Consecutive attempts that produced no reading — failures **and** refusals.
   *
   * A sign-out used to reset this to zero and delete `nextAttemptAt` on
   * purpose, so that signing in was noticed at once. That is right for an
   * expired session and wrong for everything else `needs_login` also means: a
   * 403 from a server that has decided to refuse this client is retried on
   * every popup open, every alarm and every page load, for ever, with no
   * ladder — the pattern most likely to harden the refusal.
   * `PIAZZA_LOGIN_GRACE` keeps the prompt cheap and then puts the ladder back.
   */
  failures?: number;
}

/** One class to poll, and where the poll should start. */
export interface PiazzaPoll {
  nid: string;
  courseHint: string;
  sinceNr?: number;
}

export interface PiazzaPlan {
  /** Whether any request should be made at all. */
  fetch: boolean;
  /** Whether the class page must be read first. */
  refreshClasses: boolean;
  /** The classes to poll with the list currently stored. Empty until discovery. */
  poll: PiazzaPoll[];
  /** The sentence the worker logs, for both branches (worker rule 5). */
  reason: string;
  /**
   * Every post this source has read was read by an older reader: read them all
   * again.
   *
   * The plan says so rather than the worker working it out, because it is a
   * decision (worker rule 1) and because it has two halves that must agree —
   * the poll below already has its `sinceNr` dropped, and the worker's write
   * drops the matching `seenPosts` keys.
   */
  rereadAll?: true;
  /**
   * The state to record when `fetch` is false and the reason is not "off".
   *
   * A switch the student flipped is not a reading, and neither is a permission
   * that was revoked — but both are things the row has to be able to *say*,
   * which is what this carries. `undefined` leaves the stored state alone.
   */
  record?: { state: PiazzaHealth; lastError?: string };
}

/** The classes worth polling, with where each poll should resume. */
export function classesToPoll(
  classes: readonly PiazzaClass[] | undefined,
  lastNr: Record<string, number> | undefined,
): PiazzaPoll[] {
  return (classes ?? [])
    .filter((entry) => entry.active)
    .map((entry) => {
      const since = lastNr?.[entry.nid];
      return {
        nid: entry.nid,
        courseHint: entry.courseRaw,
        ...(typeof since === "number" && Number.isInteger(since) ? { sinceNr: since } : {}),
      };
    });
}

/**
 * The console line describing a class list, naming why each class is skipped.
 *
 * `parseClassPage` records `extra.unparsedTerm` for a class whose `term_key`
 * and `term` both failed their anchored regexes, and marks it inactive — and
 * the worker then printed "— other term" for it, asserting a term it had never
 * managed to read. Those two want opposite fixes ("it comes back in January"
 * against "this parser needs a new term format") and the evidence to tell them
 * apart was being collected and thrown away (worker rule 5).
 */
export function classListLine(classes: readonly PiazzaClass[], poll: readonly PiazzaPoll[]): string {
  const each = classes.map((entry) => {
    if (entry.active) return entry.courseRaw;
    const unparsed = entry.extra?.unparsedTerm;
    return unparsed === undefined
      ? `${entry.courseRaw} — ${entry.termKey ?? "no term"}, not this one`
      : `${entry.courseRaw} — its term could not be read (${JSON.stringify(unparsed)})`;
  });
  return (
    `class list: ${classes.length} enrolment(s), ${poll.length} in this term` +
    (each.length === 0 ? "" : ` (${each.join("; ")})`)
  );
}

/**
 * "This whole run is a login problem, not a failure."
 *
 * In core rather than in the worker because two decisions now turn on it —
 * whether a bad class-page URL is worth retrying, and whether one class's
 * refusal signs the whole source out — and both are pinned here (worker rule 1).
 */
export class PiazzaNeedsLogin extends Error {
  override readonly name = "PiazzaNeedsLogin";
}

/**
 * The class-page URLs to try, in order.
 *
 * The discovery URL was `/class/<the first stored class's nid>`, and that class
 * is exactly the one most likely to have gone away: the list keeps inactive and
 * archived enrolments, and Piazza's `networks` order is not "active first". Any
 * non-2xx for it ended the run — 404 became an error plus a growing backoff,
 * 403 became "Sign in needed" — and since neither branch clears `classes`, the
 * next refresh derived the same dead URL, for ever, with no user-reachable
 * recovery. `${PIAZZA_ORIGIN}/class` answers for any signed-in student, so it
 * is the fallback rather than a URL nothing ever tries.
 */
export function classPageAttempts(storedNid: string | undefined): (string | undefined)[] {
  return nonEmpty(storedNid) === undefined ? [undefined] : [storedNid, undefined];
}

/**
 * Read the class list, falling back off a stored class id that no longer works.
 *
 * Takes the fetch as a function so the retry — which is a decision — is pinned
 * here and the worker keeps only the request (worker rule 1). A sign-out is not
 * retried: it is the session, and the bare `/class` URL would answer it the
 * same way.
 */
export async function readClassList(
  storedNid: string | undefined,
  attempt: (nid: string | undefined) => Promise<PiazzaClass[]>,
  log: (line: string) => void,
): Promise<PiazzaClass[]> {
  const candidates = classPageAttempts(storedNid);
  let last: unknown;
  for (const [index, nid] of candidates.entries()) {
    try {
      const classes = await attempt(nid);
      // Both branches out loud (worker rule 5): "the stored id still works" and
      // "we fell back" are otherwise the same silence, and the second one is
      // the evidence that a stored class has gone away.
      if (index > 0) log(`the stored class id did not answer; ${classPageUrl(nid)} did`);
      return classes;
    } catch (err) {
      if (err instanceof PiazzaNeedsLogin) throw err;
      last = err;
      if (index + 1 < candidates.length) {
        log(
          `${classPageUrl(nid)} failed (${err instanceof Error ? err.message : String(err)}) — ` +
            `trying ${classPageUrl(candidates[index + 1])}`,
        );
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

/**
 * What this sync should do about Piazza, and why.
 *
 * Every branch names itself, because "off", "not granted", "resting" and
 * "nothing happened" are one silence in the console otherwise — and three of
 * those four are states the student can fix and the fourth is a bug.
 */
export function planPiazza(
  facts: PiazzaFacts | undefined,
  ctx: { granted: boolean; now: Date; trigger?: "manual" | "scheduled" | "popup" },
): PiazzaPlan {
  const rereadAll = readerVersionOf(facts) < PIAZZA_READER_VERSION;
  // The upgrade's first half: with `lastNr` ignored, the feed offers every post
  // again. Its second half — dropping the `seenPosts` marks so `ingestPost`
  // will look at them — is a write, and belongs to the worker.
  const poll = classesToPoll(facts?.classes, rereadAll ? undefined : facts?.lastNr);

  if (facts?.enabled !== true) {
    return { fetch: false, refreshClasses: false, poll: [], reason: "off" };
  }
  if (!ctx.granted) {
    return {
      fetch: false,
      refreshClasses: false,
      poll: [],
      reason: `on, but ${PIAZZA_MATCH} is not granted — nothing can be read until it is allowed again`,
      record: {
        state: "error",
        lastError: `Illini Dash is not allowed to read ${PIAZZA_ORIGIN} any more. Switch Piazza off and on again in Settings to ask for it.`,
      },
    };
  }

  const resting = facts.nextAttemptAt;
  if (
    ctx.trigger !== "manual" &&
    isInstant(resting) &&
    Date.parse(resting) > ctx.now.getTime()
  ) {
    // §6's ladder. A manual sync is the student saying to try now, which is
    // also the sync a failing source most needs.
    return {
      fetch: false,
      refreshClasses: false,
      poll: [],
      reason: `resting after a failure until ${resting}`,
    };
  }

  /*
   * §6's popup debounce, which used to stop at the loop.
   *
   * `runSync` returns `skipped` for a popup sync inside `POPUP_DEBOUNCE_MS`,
   * but the Piazza run sat outside that branch and had no debounce of its own —
   * so five popup opens in ten minutes were 20 `network.get_my_feed` POSTs to
   * the one host with a session cookie attached, where the loop made no request
   * at all. The decision lives here rather than in the worker so it can be
   * pinned (worker rule 1).
   */
  const attempted = facts.lastAttemptAt;
  if (
    ctx.trigger === "popup" &&
    isInstant(attempted) &&
    ctx.now.getTime() - Date.parse(attempted) < POPUP_DEBOUNCE_MS
  ) {
    return {
      fetch: false,
      refreshClasses: false,
      poll: [],
      reason: `the popup opened, and Piazza was last read at ${attempted} — inside the ${
        POPUP_DEBOUNCE_MS / 60_000
      }-minute debounce, so nothing is refetched`,
    };
  }

  const fetchedAt = facts.classesFetchedAt;
  const stale =
    !isInstant(fetchedAt) || ctx.now.getTime() - Date.parse(fetchedAt) >= CLASS_LIST_MAX_AGE_MS;
  /*
   * An empty list is *a list*, and re-reading it on every sync was a class-page
   * GET every half hour for ever — `CLASS_LIST_MAX_AGE_MS` defeated entirely,
   * and reported as staleness the list did not have. It is refreshed when it is
   * genuinely stale, and when the student presses Sync now, which is the button
   * to press after enrolling in something.
   */
  const refreshClasses =
    facts.classes === undefined || stale || (facts.classes.length === 0 && ctx.trigger === "manual");

  const why =
    facts.classes === undefined
      ? "none stored"
      : facts.classes.length === 0
        ? stale
          ? "the stored list is empty and a day old"
          : "the stored list is empty and you asked"
        : "a day old";
  const polling = refreshClasses
    ? `reading the class list (${why}), then polling`
    : `polling ${poll.length} class${poll.length === 1 ? "" : "es"}`;

  return {
    fetch: true,
    refreshClasses,
    poll,
    ...(rereadAll ? { rereadAll: true as const } : {}),
    reason: rereadAll
      ? `${polling} — every post here was read by reader ${readerVersionOf(facts)}, ` +
        `and this build is reader ${PIAZZA_READER_VERSION}: re-reading them in full`
      : polling,
  };
}

/**
 * Which reader last read this class's posts. `1` for anything unreadable.
 *
 * `typeof x === "number"` is not validation (house rule 5): this comes off
 * disk, and `0`, `-3`, `NaN` and `"2"` would each mean something different and
 * wrong. Anything that is not a positive integer is treated as the oldest
 * reader, which costs one re-read and never skips one.
 */
export function readerVersionOf(facts: PiazzaFacts | undefined): number {
  const stored = facts?.readerVersion;
  return typeof stored === "number" && Number.isInteger(stored) && stored > 0 ? stored : 1;
}

/** What the upgrade does to `seenPosts`, and the line the worker logs about it. */
export interface ReaderUpgrade {
  seenPosts: Record<string, string>;
  dropped: number;
  message: string;
}

/**
 * Forget that this source ever read a post, so the new reader can read it again.
 *
 * Only the keys this source owns: `seenPosts` is shared with the Campuswire
 * observer and the paste box, and an upgrade to the Piazza reader has nothing
 * to say about a Campuswire thread — dropping one would re-offer a correction
 * the student has already seen, from a source that did not change. Prefix
 * matched on `parseFeed`'s own id shape, through the one constant both spell.
 *
 * Pure, and it returns the sentence as well as the map, because "the upgrade
 * ran and there was nothing to drop" and "the upgrade never ran" are the same
 * silence otherwise (worker rule 5).
 */
export function readerUpgrade(
  seenPosts: Record<string, string> | undefined,
  from: number,
): ReaderUpgrade {
  const kept: Record<string, string> = {};
  let dropped = 0;
  for (const [key, at] of Object.entries(seenPosts ?? {})) {
    if (key.startsWith(PIAZZA_POST_PREFIX)) dropped += 1;
    else kept[key] = at;
  }
  return {
    seenPosts: kept,
    dropped,
    message:
      `reader upgraded ${from} → ${PIAZZA_READER_VERSION}: ` +
      `re-reading ${dropped} post${dropped === 1 ? "" : "s"} in full`,
  };
}

/* -------------------------------------------------------------------------- */
/* The body stage: what a failed `content.get` may and may not settle           */
/* -------------------------------------------------------------------------- */

/**
 * Posts that still need their body fetched.
 *
 * A post *above* `lastNr` may already have been ingested: when an earlier
 * sync's body fetch failed, `lastNr` stayed below it, so the feed offers every
 * post after it again on the next sync. Fetching those bodies a second time is
 * a request per post per sync for a post `ingestPost` will refuse anyway. A
 * re-read (`reread`) is the exception — that is an *edit*, and the new body is
 * the whole reason to look.
 */
export function postsNeedingBody(
  sent: readonly ObservedPost[],
  seenPosts: Record<string, string> | undefined,
): { fetch: ObservedPost[]; alreadyRead: number } {
  const seen = seenPosts ?? {};
  const fetch = sent.filter((post) => post.reread === true || seen[post.id] === undefined);
  return { fetch, alreadyRead: sent.length - fetch.length };
}

/**
 * Whether a body fetch may be asked again, or is a refusal to be given up on.
 *
 * The distinction is what bounds the retry with no per-post memory to bound it
 * with (`migrateObservers` keeps no such field). A timeout, a network error, a
 * 429 or a 5xx is the kind of failure that answers next time, so the post is
 * left unread and `lastNr` stays below it. Anything else — a 404, a 403, a body
 * that is not the JSON this endpoint returns — will answer the same way for
 * ever, so the post is taken at its 120-character snippet and marked read, with
 * the reason logged. That is what the code did for *every* failure, which is
 * how one transient 500 cost a term's deadline.
 */
export type BodyFailureKind = "transient" | "refused";

export function bodyFailureKind(status: number | undefined, unreadableBody = false): BodyFailureKind {
  if (unreadableBody) return "refused";
  if (status === undefined) return "transient";
  if (status === 408 || status === 429 || status >= 500) return "transient";
  if (status >= 400) return "refused";
  // A 2xx that produced no body is a shape we do not understand; asking again
  // is not going to change it.
  return "refused";
}

/** One post whose body this sync asked for, and what came back. */
export interface BodyAttempt {
  nid: string;
  courseHint: string;
  /** The post as it now reads — carrying its body when one arrived. */
  post: ObservedPost;
  /**
   * Absent when the body arrived and was read.
   *
   * `login` marks the one failure that may mean the *session* rather than the
   * post: a body that asked for a sign-in is never settled at its snippet, and
   * when every body says it, the run ends as a sign-out (`feedSignedOut`).
   */
  failure?: { kind: BodyFailureKind; message: string; login?: true };
}

export interface ResolvedBodies {
  /** Posts to ingest: read in full, or given up on and taken at the snippet. */
  ingest: BodyAttempt[];
  /** Posts to ask about again next sync. `lastNr` must stay below the lowest. */
  retry: BodyAttempt[];
  /** One line each, for the worker's console (worker rule 5). */
  notes: string[];
  bodiesRead: number;
  bodiesFailed: number;
}

/**
 * What the run may settle about each post whose body it asked for.
 *
 * `bodyBatch` exists so a post whose body was never fetched is never marked
 * read ("advancing either past a post whose body was never fetched would leave
 * it read at its 120-character snippet for good"), and the worker discarded
 * that guarantee the moment a fetch *failed* rather than being deferred: it
 * ingested the snippet and advanced both marks. One 500 on a note whose
 * deadline sentence is at character 400 cost that deadline for the term.
 */
export function resolveBodies(attempts: readonly BodyAttempt[]): ResolvedBodies {
  const resolved: ResolvedBodies = {
    ingest: [],
    retry: [],
    notes: [],
    bodiesRead: 0,
    bodiesFailed: 0,
  };
  for (const attempt of attempts) {
    if (attempt.failure === undefined) {
      resolved.bodiesRead += 1;
      resolved.ingest.push(attempt);
      continue;
    }
    resolved.bodiesFailed += 1;
    if (attempt.failure.kind === "transient") {
      resolved.retry.push(attempt);
      resolved.notes.push(
        `${attempt.courseHint} post ${attempt.post.nr}: body unread (${attempt.failure.message}) — ` +
          `left unread, and this class stops at post ${attempt.post.nr - 1} until it can be read`,
      );
      continue;
    }
    resolved.ingest.push(attempt);
    resolved.notes.push(
      `${attempt.courseHint} post ${attempt.post.nr}: body refused (${attempt.failure.message}) — ` +
        `giving up on it and reading its 120-character snippet instead`,
    );
  }
  return resolved;
}

/**
 * `lastNr` held below every post this run could not read.
 *
 * `planned` is what `bodyBatch` allowed; `floors` is each class's stored
 * `sinceNr`, because a cap must never move a class's mark *backwards* — that
 * would re-offer posts this store has already ingested.
 */
export function cappedLastNr(
  planned: Record<string, number>,
  retry: readonly { nid: string; post: ObservedPost }[],
  floors: Record<string, number> = {},
): Record<string, number> {
  const lowest = new Map<string, number>();
  for (const entry of retry) {
    const current = lowest.get(entry.nid);
    if (current === undefined || entry.post.nr < current) lowest.set(entry.nid, entry.post.nr);
  }
  const out: Record<string, number> = {};
  for (const [nid, nr] of Object.entries(planned)) {
    const blocked = lowest.get(nid);
    const capped = blocked === undefined ? nr : Math.min(nr, blocked - 1);
    out[nid] = Math.max(capped, floors[nid] ?? 0);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* The feed stage: whose sign-out is it                                        */
/* -------------------------------------------------------------------------- */

/** One class's feed, and what came back. */
export interface FeedOutcome {
  courseHint: string;
  kind: "ok" | "needs_login" | "failed";
  message?: string;
}

/**
 * Whether the *session* is signed out, or some classes were refused.
 *
 * `classifyPiazzaResponse` answers `needs_login` for a 401 **or a 403**, and
 * Piazza answers 403 for a class you have been removed from or that has been
 * archived — an access failure, not a session failure. Raised for the whole run
 * it threw away every healthy class's new notes, left `lastNr` unadvanced, and
 * put "Sign in needed" with a button that fixes nothing on a row whose other
 * three classes had just answered 200. House rule 8 says the status decides
 * whether this is a login problem; it does not say a 403 can only mean one
 * thing. So a refusal is that class's failure unless **every** class says so —
 * and the class page's own sign-out (`readClassList`) still ends the run,
 * because that one really is the session.
 */
export function feedSignedOut(outcomes: readonly FeedOutcome[]): boolean {
  return outcomes.length > 0 && outcomes.every((outcome) => outcome.kind === "needs_login");
}

/* -------------------------------------------------------------------------- */
/* What one run produced, and what the row may say about it                    */
/* -------------------------------------------------------------------------- */

/**
 * How many consecutive refusals are treated as "sign in" before the ladder.
 *
 * A real expiry is fixed in another tab within a minute or two, and the point
 * of the un-backed-off `needs_login` branch is that signing in is noticed at
 * once. Four attempts is enough for that; past it, the likelier story is a
 * server that is refusing this client, and §6's ladder applies. A page load on
 * piazza.com still overrides it (`piazzaNeedsRecheck` → a manual run), so the
 * student who does sign in is never waiting on the ladder.
 */
export const PIAZZA_LOGIN_GRACE = 4;

/** What one Piazza run produced. Every branch of it is recorded. */
export type PiazzaResult =
  | {
      kind: "ok";
      /**
       * How many HTTP requests this run actually made.
       *
       * The honesty fact, and required for that reason: worker rule 2's whole
       * sentence is "a green dot must mean *I fetched, and it was fine* — never
       * *I did not fetch*". A run with nothing to poll makes no request, and
       * used to record `ok` anyway.
       */
      requests: number;
      /** Classes polled this run. */
      classesPolled: number;
      /** Classes whose feed could not be read, and why. */
      classFailures?: { courseHint: string; message: string }[];
      /** Post bodies read in full. */
      bodiesRead?: number;
      /** Post bodies asked for and not received. */
      bodiesFailed?: number;
      /** Posts that reached `ingestPost` this run. */
      newPosts: number;
      /**
       * Deadlines those posts produced this run — moves plus suggestions.
       *
       * Optional, and absent rather than `0` when nothing was ingested at all,
       * so a run that read no new posts cannot reset the row's count to "none
       * with a deadline".
       */
      deadlines?: number;
      classes?: PiazzaClass[];
      /** nid → highest number read, merged over what was stored. */
      lastNr?: Record<string, number>;
    }
  | { kind: "needs_login" }
  | { kind: "error"; message: string };

/**
 * The one sentence a successful run still has to say, or `undefined`.
 *
 * Worker rule 2 at the stage level: "25 posts, 0 deadlines found" is a claim
 * about posts, and a run whose every `content.get` was refused never read one.
 * A class that fails every sync is the same defect a level up — the error was
 * deleted from the store on each `ok`, so it existed only in a console the
 * student is not looking at (UI rule 1).
 */
export function runNote(result: Extract<PiazzaResult, { kind: "ok" }>): string | undefined {
  const parts: string[] = [];
  const failures = result.classFailures ?? [];
  if (failures.length > 0) {
    parts.push(
      `${failures.length} of ${result.classesPolled} class${
        result.classesPolled === 1 ? "" : "es"
      } couldn't be read`,
    );
  }
  const unread = result.bodiesFailed ?? 0;
  if (unread > 0) parts.push(`${unread} post${unread === 1 ? "" : "s"} couldn't be opened`);
  return parts.length === 0 ? undefined : parts.join("; ");
}

/**
 * The stored facts after a run — **all of them**.
 *
 * Assign this, never spread it over the facts it was given: its recovery
 * contract is expressed with `delete` (`lastError`, `nextAttemptAt`), and a
 * spread of the old facts cannot delete a key. The worker wrote
 * `{ ...old, ...applyPiazzaResult(old, …) }`, which put back exactly the keys
 * this deleted — so a sync that succeeded after four failures was written
 * `state: "ok"` with a four-hour `nextAttemptAt` still on it, and Piazza then
 * fetched nothing for four hours after the student watched it work.
 *
 * `lastAttemptAt` is stamped on **every** branch, including the failures: it is
 * what `describePiazza` derives "this was tried" from. `lastObservedAt` is
 * stamped only when posts were actually read, so the row cannot claim a reading
 * it did not make.
 */
export function applyPiazzaResult(
  facts: PiazzaFacts | undefined,
  result: PiazzaResult,
  now: string,
): PiazzaFacts {
  if (!isInstant(now)) throw new ParseError(`now must be an instant with an offset: ${String(now)}`);
  const next: PiazzaFacts = { ...(facts ?? { enabled: true }), lastAttemptAt: now };
  delete next.lastError;

  if (result.kind === "ok") {
    next.failures = 0;
    delete next.nextAttemptAt;
    if (result.classes !== undefined) {
      next.classes = result.classes;
      next.classesFetchedAt = now;
    }
    if (result.lastNr !== undefined) {
      next.lastNr = { ...(facts?.lastNr ?? {}), ...result.lastNr };
    }
    if (result.requests === 0) {
      /*
       * Nothing was asked of piazza.com, so there is nothing to call healthy.
       * `pending` is the honest word this vocabulary has — and `describePiazza`
       * says *why* from the class list, which is the fact that put the run in
       * this state.
       */
      next.state = "pending";
      return next;
    }
    next.state = "ok";
    const note = runNote(result);
    if (note !== undefined) next.lastError = note;
    if (result.newPosts > 0) {
      next.lastObservedAt = now;
      next.postsSeen = (facts?.postsSeen ?? 0) + result.newPosts;
    }
    if (result.deadlines !== undefined) {
      // Written whenever posts were ingested, including when the answer is
      // zero: "we read them and none stated a deadline" is a finding, and it is
      // the one the row has to be able to say out loud.
      next.deadlinesFound = (facts?.deadlinesFound ?? 0) + result.deadlines;
    }
    return next;
  }

  if (result.kind === "needs_login") {
    next.state = "needs_login";
    /*
     * Counted, and backed off only after the grace. A login is fixed in another
     * tab and nothing tells us when, so the first few attempts are free — the
     * re-check is driven by the student's own navigation
     * (`piazzaNeedsRecheck`), which overrides the ladder. What the grace stops
     * is the *other* thing 401/403 means: a refusal that signing in cannot fix,
     * retried on every alarm for ever.
     */
    const refusals = (facts?.failures ?? 0) + 1;
    next.failures = refusals;
    if (refusals > PIAZZA_LOGIN_GRACE) {
      next.nextAttemptAt = new Date(
        Date.parse(now) + backoffMinutes(refusals - PIAZZA_LOGIN_GRACE) * 60_000,
      ).toISOString();
    } else {
      delete next.nextAttemptAt;
    }
    return next;
  }

  next.state = "error";
  next.lastError = result.message;
  const failures = (facts?.failures ?? 0) + 1;
  next.failures = failures;
  next.nextAttemptAt = new Date(Date.parse(now) + backoffMinutes(failures) * 60_000).toISOString();
  return next;
}

/** A stored instant as the row prints it: a time today, a date before that. */
function when(at: string, now: Date): string {
  const parsed = new Date(at);
  if (Number.isNaN(parsed.getTime())) return at;
  return parsed.toDateString() === now.toDateString()
    ? parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * What the Settings row says, derived from an attempt that happened.
 *
 * Worker rule 2. There is no "on and healthy" to be had before a fetch: a
 * switch the student has merely flipped says "nothing read yet", which is the
 * difference between "it is broken" and "wait for the next sync".
 */
export function describePiazza(facts: PiazzaFacts | undefined, now: Date = new Date()): string {
  if (!facts?.enabled) return "Off";
  if (facts.state === "needs_login") return "Sign in needed";
  if (facts.state === "error") return "Couldn't be read";

  /*
   * The class list decides before the counts do.
   *
   * A stored list with nothing active is the state in which this source makes
   * **no request at all**, every half hour, for as long as the term boundary
   * lasts — and the row went on printing "last read Dec 12 · 312 posts, 4
   * deadlines found" through all of it, indistinguishable from health. The list
   * is the fact that explains it, and it is already on disk.
   */
  if (facts.classes !== undefined) {
    if (facts.classes.length === 0) return "On · no Piazza classes found";
    if (!facts.classes.some((entry) => entry.active)) {
      /*
       * And the one surface `extra.unparsedTerm` has ever had. `parseClassPage`
       * records it for a class whose `term_key` and `term` both failed their
       * anchored regexes, marks the class inactive — and nothing read the field
       * again, so "this comes back in January" and "the term format changed and
       * this needs fixing" were the same sentence. They want opposite actions.
       */
      return facts.classes.every((entry) => entry.extra?.unparsedTerm !== undefined)
        ? "On · no class here has a term that could be read"
        : "On · no class in this term";
    }
  }

  const note = facts.lastError === undefined ? "" : ` · ${facts.lastError}`;
  if (facts.state !== "ok") return "On · nothing read yet";

  if (facts.lastObservedAt === undefined) {
    /*
     * A successful run that found no new notes is not a run that never
     * happened. `lastObservedAt` is only stamped when posts were ingested, so
     * the steady state of a working class — every note already read — said the
     * same words as a switch that had just been flipped. Both facts needed to
     * tell them apart were stored and ignored.
     */
    const attempted = isInstant(facts.lastAttemptAt)
      ? ` ${when(facts.lastAttemptAt, now)}`
      : "";
    return `On · checked${attempted}, nothing new${note}`;
  }

  const seen = facts.postsSeen ?? 0;
  const posts = `${seen} post${seen === 1 ? "" : "s"}`;
  /*
   * The honesty clause. "On · last read 10:32 · 25 posts" is what the row said
   * while the feed stage was finding **no** deadlines on this class at all: it
   * names an activity and implies a result, and a student reading it has no way
   * to tell "nothing was announced" from "this has never worked". Both halves
   * come from an attempt — `postsSeen` from posts that were ingested and
   * `deadlinesFound` from what they produced — and when the count has never
   * been recorded (a store written before this field) the row says neither.
   */
  const found = facts.deadlinesFound;
  const head = `On · last read ${when(facts.lastObservedAt, now)} · ${posts}`;
  if (found === undefined) return `${head}${note}`;
  return found === 0
    ? `${head}, none with a deadline${note}`
    : `${head}, ${found} deadline${found === 1 ? "" : "s"} found${note}`;
}

/**
 * Whether a page finishing on piazza.com should make this try again.
 *
 * `core/health.ts`'s `sourcesToRecheck` does exactly this job for the five
 * `Source`s, and is keyed by `Source` — which Piazza deliberately is not. The
 * rule is copied rather than the type widened: `needs_login` is the one state
 * whose fix happens where the extension cannot see it, and a navigation on the
 * site *is* the evidence that the last attempt is stale, so the comparison is
 * "has anything happened since we asked", not "how long has it been".
 */
export function piazzaNeedsRecheck(
  facts: PiazzaFacts | undefined,
  navigatedAtMs: number | undefined,
): boolean {
  if (facts?.enabled !== true) return false;
  if (facts.state !== "needs_login") return false;
  if (navigatedAtMs === undefined) return false;
  const attempted = isInstant(facts.lastAttemptAt) ? Date.parse(facts.lastAttemptAt) : undefined;
  // `>=`, as in health.ts: a re-check we did not need costs one request, and
  // one we skipped costs the student half an hour of "sign in needed" while
  // signed in. Self-limiting only because the worker stamps `lastAttemptAt`
  // when a run *starts* — stamped at the end, a burst of navigations during one
  // slow run each started another whole run.
  return attempted === undefined || navigatedAtMs >= attempted;
}

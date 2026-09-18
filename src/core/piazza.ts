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
 * A tag's attribute list, which does **not** end at the first `>`.
 *
 * `[^>]*` was the obvious spelling and it is wrong: `title="a > b"` ends the
 * match inside the tag, so the rest of the tag (`b">`) survives as prose and
 * the words before it are eaten. Real posts write arrows — `title="MP1 -> MP2"`
 * — and a `due` or a date can be among the words that vanish. A quoted value is
 * skipped whole, so only an unquoted `>` closes the tag.
 */
const TAG_TAIL = `(?:"[^"]*"|'[^']*'|[^'">])*>`;
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
const BLOCK_TAG = new RegExp(
  `</?(?:p|div|br|li|ul|ol|tr|td|th|table|h[1-6]|blockquote|pre|section|article|header|footer|hr)\\b${TAG_TAIL}`,
  "gi",
);
/** `<script>`/`<style>` take their contents with them; nothing in them is prose. */
const DROPPED_BLOCK = new RegExp(`<(script|style)\\b${TAG_TAIL}[\\s\\S]*?</\\1\\s*>`, "gi");
/** Whatever tags are left are inline, and come off without a space. */
const ANY_TAG = new RegExp(`</?[a-z][a-z0-9-]*${TAG_TAIL}`, "gi");
/**
 * A comment and everything inside it, dropped like `<script>` and for its reason.
 *
 * `ANY_TAG` cannot match `<!--`, so the delimiters *and the commented-out text*
 * used to survive into the string the grammar reads. An instructor editing the
 * weekly post leaves the old line inside a comment, and a Word or Google Docs
 * paste emits `<!--[if !supportLists]-->` — the first becomes a deadline the
 * post does not state, the second becomes literal markup inside the evidence
 * span quoted back at the student. The unterminated half is deliberate: a body
 * cut off mid-comment must not leak the comment it was cut inside.
 */
const COMMENT = /<!--[\s\S]*?-->|<!--[\s\S]*$/g;

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
    .replace(COMMENT, " ")
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
 * `seenPosts` remembers and `postedAt` is when the post was first written.
 *
 * `versionAt` rides along beside it, because the text this merges in is version
 * N and `postedAt` is version 0's instant: the captured "Running Post" was
 * created 2026-08-28 and last written 2026-09-13, so "this Friday" in the body
 * the second request returned resolved sixteen days early. `postAnchor` decides
 * between them in one place.
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
    versionAt: body.versionAt,
    // The body's own two markers beat the feed's tag: `config.is_announcement`
    // is only in the full post, and a post read in full is judged by what it
    // says about itself.
    instructorNote: body.instructorNote,
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
  /**
   * `history[0].created` of the version `withPostBody` merged in.
   *
   * The anchor, once the body has been read: `postAnchor` prefers it over the
   * feed's create instant, because the text that is parsed is the version that
   * was fetched and every relative phrase in it ("this Friday") resolves
   * against when *it* was written.
   */
  versionAt?: string;
  /**
   * Staff-written, from the feed's own `tags` and confirmed by the body.
   *
   * A `type: "note"` can be a pinned **student** post — the capture has four —
   * and a classmate's "I think MP2 is due 10/3" must not move an assignment.
   * `postsToSend` refuses one unless `includeStudentNotes` says otherwise, for
   * the reason questions are refused: the grammar cannot tell an instructor's
   * sentence from a classmate's guess.
   */
  instructorNote?: boolean;
  courseHint?: string;
  /**
   * Every §5.1 code of the class this post came from, primary first.
   *
   * `courseHint` is the class's raw name and the ingest side derives one code
   * from it, which loses the second half of a cross-listing: a CS 425 / ECE 428
   * post matched no ECE 428 item, so every announcement duplicated the student's
   * assignments instead of correcting them. The first element is the code
   * `courseHint` already yields; the rest are the ones it dropped.
   */
  courseCodes?: string[];
  extra: { unparsedPostedAt?: string; unparsedType?: string; unparsedEditedAt?: string };
}

/** The page facts the response does not carry. */
export interface FeedContext {
  nid: string;
  courseHint?: string;
  /** §5.1 over the class's `course_number`, primary first. `PiazzaClass.courseCodes`. */
  courseCodes?: string[];
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
    .replace(/&#(\d{1,7});/g, (match: string, code: string) => codePoint(match, Number(code)))
    .replace(/&#x([0-9a-f]{1,6});/gi, (match: string, code: string) =>
      codePoint(match, parseInt(code, 16)),
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Last, or `&amp;lt;` decodes twice into a tag.
    .replace(/&amp;/g, "&");
}

/**
 * One numeric entity, or the entity text verbatim when it names no character.
 *
 * `String.fromCodePoint` **throws** above 0x10FFFF, and a `RangeError` is not a
 * `ParseError`: one `&#9999999;` in one subject took the whole class's feed
 * with it, on every sync for ever, because the text is a stable property of the
 * page. House rule 1 — a bad value costs its own field, and the field here is
 * one character. A lone surrogate is left alone too: it names no scalar and
 * would put an unpaired code unit into a span quoted back at the student.
 */
function codePoint(raw: string, code: number): string {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return raw;
  if (code >= 0xd800 && code <= 0xdfff) return raw;
  return String.fromCodePoint(code);
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
    const tags = entry["tags"];
    if (!Array.isArray(tags)) {
      /*
       * A hook, not a value (house rule 1): `tags` is what tells a staff
       * announcement from a pinned classmate's note, and every entry in the
       * capture has it. Defaulting it would hold every announcement back
       * silently, which is the failure `type` above is guarded against for the
       * same reason.
       */
      throw new ParseError(
        `Piazza post ${nr} has no \`tags\`: nothing left to tell staff from a classmate`,
      );
    }

    // Exact match, never a substring (house rule 6): every other value is
    // something this build must not send, and an unknown one is not a note.
    const kind = type === "note" ? "note" : type === "question" ? "question" : "other";
    // The same exact marker `parsePostBody` reads, one stage earlier, so a post
    // whose body this sync never fetches is still judged by it.
    const instructorNote = tags.some((tag) => tag === "instructor-note");
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
      instructorNote,
      subject,
      snippet,
      // The subject on its own line, like Campuswire's title: instructors put
      // the only subject of a post in it ("HW1 ... Released"), and a newline
      // stops the grammar running it into the first sentence of the body.
      text: snippet === "" ? subject : `${subject}\n${snippet}`,
      ...(postedAt === undefined ? {} : { postedAt }),
      ...(editedAt === undefined ? {} : { editedAt }),
      ...(page.courseHint ? { courseHint: page.courseHint } : {}),
      ...(page.courseCodes && page.courseCodes.length > 0
        ? { courseCodes: [...page.courseCodes] }
        : {}),
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

/**
 * The instant the text this post carries was written.
 *
 * `announce.ts` calls `postedAt` "the anchor for every relative phrase and for
 * §3.2's year inference", and the feed's `log[0].t` is the **create** event.
 * That is the wrong instant for a post that has been edited, and both captures
 * say so: nr 28 was created 2026-08-28 and its last `update` is
 * 2026-09-13T22:22:48Z, which is exactly `history[0].created` in
 * `post-running.json` — and its `content_snipet` opens "[Last Updated Sep 13.]",
 * so the snippet is the edited text too. Anchoring either reading at the create
 * instant put "this Friday" sixteen days in the past.
 *
 * So the anchor is the instant the *version that was read* was written:
 * `versionAt` when the body stage fetched it, the feed's last content edit when
 * only the snippet was read, and the create instant when neither is readable (a
 * post that has never been edited has all three equal, which is why no capture
 * could show the difference).
 */
export function postAnchor(post: ObservedPost): string | undefined {
  if (post.bodyRead === true && isInstant(post.versionAt)) return post.versionAt;
  if (isInstant(post.editedAt)) return post.editedAt;
  return isInstant(post.postedAt) ? post.postedAt : undefined;
}

/** Which posts the deadline pipeline is allowed to see. */
export interface SendOptions {
  /**
   * Send questions as well as notes. Off, and for Campuswire's reason: a
   * student asking "is HW3 due Friday?" has stated no deadline, and the grammar
   * cannot tell an instructor's sentence from a classmate's guess.
   */
  includeQuestions?: boolean;
  /**
   * Send notes that staff did not write. Off, and for `includeQuestions`'s reason.
   *
   * A `type: "note"` is not a staff announcement: the capture has four pinned
   * student notes, and "I think MP2 is due 10/3" from a classmate would move a
   * real assignment. The marker is the feed's own `instructor-note` tag (or the
   * body's `config.is_announcement`), never a guess from the words.
   */
  includeStudentNotes?: boolean;
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
  /**
   * Every code of the class, primary first — the second half of a cross-listing
   * included. The ingest side must match an item on **any** of them.
   */
  courseCodes?: string[];
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
  /**
   * New posts refused for a reason that may not be true next sync.
   *
   * One refusal here is recoverable: a note whose posted date was unreadable.
   * It is not in `sent`, so its body is never fetched and it is never ingested
   * — and `bodyBatch` used to mark the whole feed read over its head, which
   * turned "unreadable this sync" into "skipped for ever". A question and a
   * classmate's note are *not* held: this build is never going to send them,
   * and holding them would freeze `lastNr` at the first one for ever.
   */
  held: ObservedPost[];
}

/**
 * Which parsed posts become posts the worker ingests.
 *
 * In core, with every refusal enumerated, because "Piazza sent nothing" and
 * "Piazza never ran" are the same silence otherwise (worker rule 5).
 */
export function postsToSend(posts: readonly ObservedPost[], options: SendOptions = {}): SendPlan {
  const plan: SendPlan = { payloads: [], sent: [], skipped: [], held: [] };
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
    if (
      post.kind === "note" &&
      post.instructorNote === false &&
      options.includeStudentNotes !== true
    ) {
      // Held back like a question, with its reason: the capture's pinned
      // "Search for Teammates!" is a note a classmate wrote, and the grammar
      // reads it exactly as it reads an instructor's announcement.
      plan.skipped.push({ nr: post.nr, reason: "a note a classmate wrote, not staff" });
      continue;
    }
    const postedAt = postAnchor(post);
    if (postedAt === undefined) {
      plan.skipped.push({
        nr: post.nr,
        reason: `its posted date is unreadable (${JSON.stringify(post.extra.unparsedPostedAt ?? "")})`,
      });
      // Recoverable, and the one refusal that is: `bodyBatch` must not run
      // `lastNr` past it, or Piazza's next readable answer arrives at a post
      // this store has already called read.
      plan.held.push(post);
      continue;
    }
    plan.payloads.push({
      id: post.id,
      source: "piazza",
      ...(post.courseHint ? { courseHint: post.courseHint } : {}),
      ...(post.courseCodes && post.courseCodes.length > 0
        ? { courseCodes: [...post.courseCodes] }
        : {}),
      postedAt,
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
  held: readonly ObservedPost[] = [],
): BodyBatch {
  const ordered = [...sent].sort((a, b) => a.nr - b.nr);
  const batch = ordered.slice(0, Math.max(0, limit));
  const deferred = ordered.length - batch.length;
  if (deferred > 0) {
    return { batch, deferred, lastNr: batch[batch.length - 1]!.nr };
  }
  const top = highestNr(all);
  if (top === undefined) return { batch, deferred: 0 };
  /*
   * The second way `lastNr` can run past a post nobody read, and the one no
   * test connected: `postsToSend` refuses a note whose posted date is
   * unreadable, nothing defers, and the mark goes to the top of the feed —
   * over the refused note's head, so it is "already read" for ever, even after
   * Piazza's log becomes readable again. The cap is the same one the deferred
   * path uses, one post lower.
   */
  const lowestHeld = held.reduce<number | undefined>(
    (low, post) => (low === undefined || post.nr < low ? post.nr : low),
    undefined,
  );
  const lastNr = lowestHeld === undefined ? top : Math.min(top, lowestHeld - 1);
  return { batch, deferred: 0, lastNr };
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
  state?: PiazzaHealth;
  /** When a fetch was last *attempted*. The only thing `ok` may be derived from. */
  lastAttemptAt?: string;
  /** When posts were last actually read. */
  lastObservedAt?: string;
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
 * What this sync should do about Piazza, and why.
 *
 * Every branch names itself, because "off", "not granted", "resting" and
 * "nothing happened" are one silence in the console otherwise — and three of
 * those four are states the student can fix and the fourth is a bug.
 */
export function planPiazza(
  facts: PiazzaFacts | undefined,
  ctx: { granted: boolean; now: Date; trigger?: "manual" | "scheduled" },
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

  const fetchedAt = facts.classesFetchedAt;
  const stale =
    !isInstant(fetchedAt) || ctx.now.getTime() - Date.parse(fetchedAt) >= CLASS_LIST_MAX_AGE_MS;
  const refreshClasses = facts.classes === undefined || facts.classes.length === 0 || stale;

  const polling = refreshClasses
    ? `reading the class list (${facts.classes === undefined ? "none stored" : "stale"}), then polling`
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

/** What one Piazza run produced. Every branch of it is recorded. */
export type PiazzaResult =
  | {
      kind: "ok";
      classes?: PiazzaClass[];
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
      /** nid → highest number read, merged over what was stored. */
      lastNr?: Record<string, number>;
    }
  | { kind: "needs_login" }
  | { kind: "error"; message: string };

/**
 * The stored facts after a run.
 *
 * `lastAttemptAt` is stamped on **every** branch, including the failures: it is
 * what `describePiazza` derives "this was tried" from, and a state word with no
 * attempt behind it is the defect worker rule 2 is about. `lastObservedAt` is
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
    next.state = "ok";
    next.failures = 0;
    delete next.nextAttemptAt;
    if (result.classes !== undefined) {
      next.classes = result.classes;
      next.classesFetchedAt = now;
    }
    if (result.lastNr !== undefined) {
      next.lastNr = { ...(facts?.lastNr ?? {}), ...result.lastNr };
    }
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
     * Not a failure, and deliberately not backed off. A login is fixed in
     * another tab and nothing tells us when — the re-check is driven by the
     * student's own navigation (`piazzaNeedsRecheck`), and a backoff here would
     * make signing in take up to four hours to be noticed.
     */
    next.failures = 0;
    delete next.nextAttemptAt;
    return next;
  }

  next.state = "error";
  next.lastError = result.message;
  const failures = (facts?.failures ?? 0) + 1;
  next.failures = failures;
  next.nextAttemptAt = new Date(Date.parse(now) + backoffMinutes(failures) * 60_000).toISOString();
  return next;
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
  if (facts.state !== "ok" || facts.lastObservedAt === undefined) return "On · nothing read yet";

  const at = new Date(facts.lastObservedAt);
  const when = Number.isNaN(at.getTime())
    ? facts.lastObservedAt
    : at.toDateString() === now.toDateString()
      ? at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : at.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  if (found === undefined) return `On · last read ${when} · ${posts}`;
  return found === 0
    ? `On · last read ${when} · ${posts}, none with a deadline`
    : `On · last read ${when} · ${posts}, ${found} deadline${found === 1 ? "" : "s"} found`;
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
  // signed in.
  return attempted === undefined || navigatedAtMs >= attempted;
}

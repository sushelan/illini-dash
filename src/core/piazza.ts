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
 * invisible to this build. `content.get` returns the whole post, and the shape
 * of its response has not been captured yet
 * (`fixtures/piazza/post.json`) — so no parser for it exists, because a parser
 * before its fixture is exactly what CLAUDE.md's build order forbids.
 *
 * What *is* known is the request, so it is written down here rather than
 * rediscovered: it is the same endpoint with a different method name, taking
 * the feed entry's `id` as `cid`. `fetchPostBody` is deliberately a throw: an
 * unimplemented stage that returned `[]` or `undefined` would be this project's
 * worst failure mode wearing a helper's clothes.
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

/** The second stage, once `fixtures/piazza/post.json` exists. Not yet written. */
export function fetchPostBody(): never {
  throw new ParseError(
    "Piazza post bodies are not read yet: fixtures/piazza/post.json (a content.get " +
      "response) has not been captured, and no parser is written before its fixture",
  );
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
  const marker = /const\s+USER\s*=\s*\{/.exec(html);
  if (marker === null) {
    /*
     * The positive signed-out marker this source does not have yet (house rule
     * 11 and 12). A student who has never signed in gets 200 at the unchanged
     * URL with an ordinary page, so the *absence* of the object is currently
     * the only evidence — which is the weaker form of the test, because it also
     * fires on a redesign. It is treated as `needs_login` by the caller rather
     * than as `parse_error` because signing in is the fix in the one case that
     * matters, and a wrong "sign in" prompt costs a click while a wrong
     * "the page changed" costs the deadlines. Recorded as VERIFY in
     * docs/piazza-findings.md: it is decided by a capture Sushi still owes.
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
  /** A real instant Piazza stated (`log[0].t`). Never invented here. */
  postedAt?: string;
  courseHint?: string;
  extra: { unparsedPostedAt?: string; unparsedType?: string };
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
      ...(page.courseHint ? { courseHint: page.courseHint } : {}),
      extra: {
        ...(postedAt === undefined ? { unparsedPostedAt: String(at).slice(0, 120) } : {}),
        ...(kind === "other" ? { unparsedType: type.slice(0, 40) } : {}),
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
  skipped: { nr: number; reason: string }[];
}

/**
 * Which parsed posts become posts the worker ingests.
 *
 * In core, with every refusal enumerated, because "Piazza sent nothing" and
 * "Piazza never ran" are the same silence otherwise (worker rule 5).
 */
export function postsToSend(posts: readonly ObservedPost[], options: SendOptions = {}): SendPlan {
  const plan: SendPlan = { payloads: [], skipped: [] };
  for (const post of posts) {
    if (options.sinceNr !== undefined && post.nr <= options.sinceNr) {
      // Not a failure: a 150-post feed re-read every half hour would otherwise
      // print 150 "already read" lines per class per poll, which is a log
      // nobody can read a real failure out of.
      plan.skipped.push({ nr: post.nr, reason: `already read (<= ${options.sinceNr})` });
      continue;
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
  }
  return plan;
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
  classes?: PiazzaClass[];
  classesFetchedAt?: string;
  /** nid → the highest post number already read for that class. */
  lastNr?: Record<string, number>;
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
  const poll = classesToPoll(facts?.classes, facts?.lastNr);

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

  return {
    fetch: true,
    refreshClasses,
    poll,
    reason: refreshClasses
      ? `reading the class list (${facts.classes === undefined ? "none stored" : "stale"}), then polling`
      : `polling ${poll.length} class${poll.length === 1 ? "" : "es"}`,
  };
}

/** What one Piazza run produced. Every branch of it is recorded. */
export type PiazzaResult =
  | {
      kind: "ok";
      classes?: PiazzaClass[];
      /** Posts that reached `ingestPost` this run. */
      newPosts: number;
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
  return `On · last read ${when} · ${seen} post${seen === 1 ? "" : "s"}`;
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

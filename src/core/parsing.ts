/**
 * Shared parser primitives.
 *
 * Every rule in here was written three or four times across the four source
 * modules before it lived in one place, and three of them were reintroduced as
 * defects *after* being fixed elsewhere — the "one bad value must not cost the
 * page" rule most of all. A shared implementation is not tidiness here; it is
 * the thing that stops the same defect class recurring per source.
 */

import { ParseError } from "../sources/types.js";

/** Element text with whitespace collapsed. Never null. */
export function textOf(node: Element | null | undefined): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** A string, or undefined when it is absent or empty. Empty must not shadow a fallback. */
export function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * Escapes a string for literal use inside a RegExp.
 *
 * Both callers build a pattern out of text nobody here wrote: `scrub.ts` out of
 * the student's own name, `site.ts` out of a registry entry's `duePhrase`. An
 * unescaped `(` in either is a SyntaxError that takes down the scrub or the
 * adapter, and an unescaped `.` silently matches a character it should not —
 * a `duePhrase` of `"due."` would hook "dues" as well.
 *
 * One copy, because there were two: mutation house rule 3 says a decision
 * written out twice cannot be mutation-tested, since loosening one is masked by
 * the other staying strict.
 */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * `RawItem.url` is documented as "absolute https URL on the source host"
 * (§3 / types.ts) and §8.1 refuses to render anything else.
 *
 * Resolving against a base almost never throws, so without an explicit check a
 * `//other.host/x`, a `javascript:` or a plain `http:` value sails through —
 * and a malformed href such as `http://[` throws, which uncaught would discard
 * every row on the page.
 */
export function sameOriginHttpsUrl(
  raw: string | null | undefined,
  origin: string,
  fallback: string,
  /**
   * What a *relative* href is resolved against. Defaults to `origin`, which is
   * right only when every href on the page is absolute or root-relative.
   *
   * ECE 374 A's homework page links `homeworks/hw1.pdf` from
   * `/cs374al1/fa2026/homeworks.html`, and resolving that against the bare
   * origin produced `https://courses.grainger.illinois.edu/homeworks/hw1.pdf` —
   * same origin, https, so it passed every check here and 404s in the browser.
   * A row that links nowhere is worse than one that links to the course page,
   * because the student has no way to tell which happened.
   */
  base: string = origin,
): string {
  if (typeof raw !== "string" || raw === "") return fallback;
  try {
    const url = new URL(raw, base);
    return url.protocol === "https:" && url.origin === origin ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

export interface LoggedOutOptions {
  /** The source's own login path, e.g. /gradescope\.com\/(login|auth)/. */
  loginPath?: RegExp;
  /** An extra body test, for sources whose logged-out response is recognisable. */
  bodyLooksLoggedOut?: (body: string) => boolean;
}

/**
 * §0 rule 2 / §4: a logged-out response must be reported as `needs_login` — a
 * yellow dot linking to the login page — and never as `parse_error`, which
 * means a red dot and §6's backoff.
 *
 * The status is load-bearing and was missing from the first version of this on
 * two sources: an expired session on an `/api/v1`-style path does not redirect
 * anywhere and does not return HTML, it returns 401 with a JSON error body at
 * the unchanged URL, which every URL-and-body test calls "logged in".
 */
export function looksLoggedOut(
  status: number,
  finalUrl: string,
  body: string,
  options: LoggedOutOptions = {},
): boolean {
  if (status === 401 || status === 403) return true;
  const url = finalUrl.toLowerCase();
  if (url.includes("shibboleth") || url.includes("login.illinois.edu")) return true;
  if (options.loginPath?.test(url)) return true;
  if (options.bodyLooksLoggedOut?.(body)) return true;
  return /<title>[^<]*\b(log ?in|sign ?in)\b/i.test(body);
}

/**
 * Guards against two rows on one page producing the same `sourceId`.
 *
 * §3's `raw` is a `Record<memberKey, RawItem>`, so a collision silently merges
 * two items into one — a real deadline lost with no ParseError and no change to
 * the source's health dot, which is §0 rule 3's worst case.
 */
export class KeyGuard {
  private readonly seen = new Set<string>();

  /** Records `key`, throwing if it was already taken. `label` shapes the message. */
  claim(key: string, label: string): void {
    if (this.seen.has(key)) throw new ParseError(`duplicate ${label} on one page`);
    this.seen.add(key);
  }

  has(key: string): boolean {
    return this.seen.has(key);
  }
}

export interface FieldResult<T> {
  /** Present when the value parsed. */
  value?: T;
  /** Present when it did not — the raw text, so the failure stays visible. */
  unparsed?: string;
}

/**
 * Parses one field, degrading to a recorded failure instead of throwing.
 *
 * This is the rule three separate reviews found violated, once per source: a
 * value the parser cannot read must cost **its own field**, not the page. A
 * `ParseError` escaping a row loop discards every other item on the page —
 * every assignment in a course, every assessment, or on a single-page source
 * like PrairieTest, the entire source.
 *
 * The distinction that matters: a missing *hook* (the element or attribute is
 * gone) is structural and must still throw, because that means the page shape
 * changed. An unreadable *value* inside a hook that is still there is one bad
 * row, and the other rows are still good.
 */
export function parseField<T>(
  raw: string,
  parse: (raw: string) => T,
  context: string,
): FieldResult<T> {
  try {
    return { value: parse(raw) };
  } catch (err) {
    console.warn(`[${context}] unreadable value:`, err instanceof Error ? err.message : String(err));
    return { unparsed: raw.slice(0, 200) };
  }
}

/**
 * §3.2: an instant stored anywhere must carry an offset.
 *
 * `Date.parse` is far laxer — it accepts a naive `2026-09-11T02:00:00`, which
 * resolves differently on every machine, and a bare `2026-09-11`, which in
 * America/Chicago lands at 7pm the previous day and would fire §7's −24h
 * reminder about 29 hours early.
 */
const RFC3339_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;

export function isInstant(value: unknown): value is string {
  return (
    typeof value === "string" && RFC3339_INSTANT.test(value) && !Number.isNaN(Date.parse(value))
  );
}

/**
 * The adapter registry (§4.5).
 *
 * A bundled copy ships with the extension; once a day the worker fetches the
 * same file from GitHub, validates it, and replaces the stored copy. That is
 * what lets a broken selector be fixed without a store re-review.
 *
 * It is also the only place the extension ingests data authored elsewhere, so
 * validation here is a trust boundary, not a formality: a rejected file must
 * leave the previous copy untouched (§4.5), and a partially-valid file must not
 * be half-applied.
 */

import { CANVAS_ORIGIN } from "../sources/canvas.js";
import { GRADESCOPE_ORIGIN } from "../sources/gradescope.js";
import { PRAIRIELEARN_ORIGIN } from "../sources/prairielearn.js";
import { PRAIRIETEST_ORIGIN } from "../sources/prairietest.js";
import { SMARTPHYSICS_ORIGIN } from "../sources/smartphysics.js";
import { supportedDateFormats } from "../sources/site.js";
import type { Adapter } from "../sources/types.js";

/**
 * Hosts the manifest grants permanently, and which an adapter must therefore
 * never name. Derived from the source modules rather than typed again, so a
 * sixth source cannot be added without this list learning about it.
 */
const GRANTED_HOSTS = new Set(
  [CANVAS_ORIGIN, GRADESCOPE_ORIGIN, PRAIRIELEARN_ORIGIN, PRAIRIETEST_ORIGIN, SMARTPHYSICS_ORIGIN].map(
    (origin) => new URL(origin).hostname,
  ),
);

export const REGISTRY_URL =
  "https://raw.githubusercontent.com/sushelan/illini-dash/main/adapters/registry.json";

/** §4.5: refreshed once a day, non-blocking on failure. */
export const REGISTRY_REFRESH_MS = 24 * 60 * 60 * 1000;

/** Remote data cannot be trusted to be small. */
const MAX_REGISTRY_BYTES = 512 * 1024;
const MAX_ADAPTERS = 200;

export interface ValidationResult {
  adapters: Adapter[];
  /** One line per rejected entry, for the options page and the console. */
  rejected: string[];
}

function isPlainString(value: unknown, max = 500): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

/**
 * A single adapter, or a reason it was refused.
 *
 * `hostPattern` and `url` are checked against each other because the pattern is
 * what the extension will ask `chrome.permissions.request` for: an entry whose
 * URL is not covered by its own pattern would prompt for one origin and then
 * fetch another.
 */
export function validateAdapter(value: unknown): { adapter?: Adapter; reason?: string } {
  if (!value || typeof value !== "object") return { reason: "not an object" };
  const a = value as Record<string, unknown>;
  const id = a["id"];
  if (!isPlainString(id, 80)) return { reason: "missing id" };

  const fail = (reason: string) => ({ reason: `${id}: ${reason}` });

  for (const field of ["label", "courseCode", "term", "rows", "title", "due", "timezone"]) {
    if (!isPlainString(a[field])) return fail(`missing ${field}`);
  }
  if (a["link"] !== undefined && !isPlainString(a["link"])) return fail("bad link");
  // A literal separator, and a short one: it is remote data applied to every row.
  if (a["splitTitle"] !== undefined && !isPlainString(a["splitTitle"], 8)) {
    return fail("bad splitTitle");
  }

  const url = a["url"];
  if (!isPlainString(url, 2000)) return fail("missing url");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return fail("url is not a URL");
  }
  if (parsed.protocol !== "https:") return fail("url is not https");

  /*
   * **AMENDED (2026-09-12).** This used to require `.illinois.edu`, because
   * §2.3 said course sites "live on many subdomains
   * (courses.grainger.illinois.edu, courses.engr.illinois.edu, cs.illinois.edu,
   * …)". That was not stale, it was incomplete when written: the CS
   * department's course sites are their own domains — cs124.org, cs128.org,
   * cs225.org — and those are among the highest-enrolment courses there are.
   * The rule excluded exactly the students most likely to want this feature.
   *
   * `optional_host_permissions` now covers every https host. That is only safe
   * because of the rule directly below: `hostPattern` must name this adapter's
   * own host exactly, so a registry entry can never ask for more than the one
   * site it describes, and the student sees that host in Chrome's own prompt.
   */

  /*
   * An adapter may not point at a host this extension *already* holds.
   *
   * Those need no `permissions.request`, so enabling one would prompt for
   * nothing and grant nothing — and the adapter would then read arbitrary pages
   * on Canvas or Gradescope under a permission the student granted at install
   * for a different purpose. Every other host at least puts the name in front of
   * them before anything is read. This is the one case the exact-`hostPattern`
   * rule below cannot cover, because there the pattern is exact *and* already
   * granted.
   */
  if (GRANTED_HOSTS.has(parsed.hostname)) {
    return fail(`url is on ${parsed.hostname}, which is already granted and needs no prompt`);
  }

  const hostPattern = a["hostPattern"];
  if (!isPlainString(hostPattern, 200)) return fail("missing hostPattern");
  // Exactly this adapter's host, not merely a pattern that covers it. The
  // pattern is what `chrome.permissions.request` asks for, so a wildcard that
  // the manifest's optional entry would grant — now any https host — must never
  // be accepted here: it would prompt once for the whole web. Worse, only
  // the adapter *id* is stored: a later daily registry refresh could then
  // repoint that adapter's `url` anywhere under the wildcard with no second
  // prompt and no user action at all.
  if (hostPattern !== `https://${parsed.hostname}/*`) {
    return fail(`hostPattern must be exactly https://${parsed.hostname}/*`);
  }

  const dateFormat = a["dateFormat"];
  if (!isPlainString(dateFormat, 40) || !supportedDateFormats().includes(dateFormat)) {
    return fail(`unsupported dateFormat (${supportedDateFormats().join(", ")})`);
  }

  // §4.5's trust boundary: `columns` is remote data that decides which cell a
  // deadline is read from, so it is validated as strictly as everything else.
  const columns = a["columns"];
  if (columns !== undefined) {
    if (typeof columns !== "object" || columns === null || Array.isArray(columns)) {
      return fail("bad columns");
    }
    const c = columns as Record<string, unknown>;
    for (const key of ["title", "due"]) {
      if (!isPlainString(c[key], 120)) return fail(`columns.${key} must be a header name`);
    }
    if (c["link"] !== undefined && !isPlainString(c["link"], 120)) return fail("bad columns.link");
    for (const key of Object.keys(c)) {
      if (!["title", "due", "link"].includes(key)) return fail(`unknown columns.${key}`);
    }
  }

  /*
   * The list-shaped page's three fields. Remote data that decides which line of
   * a list is a deadline, what it is called and what hour it lands at, so each
   * is bounded and each is checked positively — `typeof x === "string"` passes
   * `""`, and an empty label would match every unlabelled line on the page.
   */
  for (const field of ["titleFrom", "time"] as const) {
    if (a[field] !== undefined && !isPlainString(a[field], 200)) return fail(`bad ${field}`);
  }
  const dueLabel = a["dueLabel"];
  if (dueLabel !== undefined) {
    if (!isPlainString(dueLabel, 200)) return fail("bad dueLabel");
    const labels = dueLabel.split("|");
    if (labels.some((label) => label.trim() === "")) return fail("dueLabel has an empty label");
  }

  const filter = a["filter"];
  if (filter !== undefined) {
    if (typeof filter !== "object" || filter === null) return fail("bad filter");
    for (const key of ["include", "exclude"]) {
      const pattern = (filter as Record<string, unknown>)[key];
      if (pattern === undefined) continue;
      if (!isPlainString(pattern, 200)) return fail(`bad filter.${key}`);
      try {
        new RegExp(pattern);
      } catch {
        return fail(`filter.${key} is not a valid regex`);
      }
    }
  }

  if (!isPlainString(a["minExtensionVersion"], 20)) return fail("missing minExtensionVersion");

  return { adapter: value as unknown as Adapter };
}

/** `https://courses.grainger.illinois.edu/*` against a URL. */
export function matchesHostPattern(pattern: string, url: URL): boolean {
  const match = /^https:\/\/([^/]+)\/\*$/.exec(pattern);
  if (!match) return false;
  const host = match[1]!;
  if (host.startsWith("*.")) {
    const suffix = host.slice(1); // ".illinois.edu"
    return url.hostname.endsWith(suffix);
  }
  return url.hostname === host;
}

/**
 * Validates a whole registry document.
 *
 * Individual bad entries are dropped and reported rather than rejecting the
 * file: one broken adapter should not stop a fix for a different course from
 * reaching anyone. A file that is not a registry at all throws.
 */
export function validateRegistry(text: string): ValidationResult {
  if (text.length > MAX_REGISTRY_BYTES) {
    throw new Error(`registry is ${text.length} bytes, over the ${MAX_REGISTRY_BYTES} limit`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`registry is not JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const list = (parsed as { adapters?: unknown })?.adapters;
  if (!Array.isArray(list)) throw new Error("registry has no adapters array");
  if (list.length > MAX_ADAPTERS) throw new Error(`registry has ${list.length} adapters`);

  const adapters: Adapter[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();

  for (const entry of list) {
    const { adapter, reason } = validateAdapter(entry);
    if (!adapter) {
      rejected.push(reason ?? "invalid");
      continue;
    }
    if (seen.has(adapter.id)) {
      rejected.push(`${adapter.id}: duplicate id`);
      continue;
    }
    seen.add(adapter.id);
    adapters.push(adapter);
  }

  return { adapters, rejected };
}

/**
 * §4.5: whether the bundled copy should seed the stored one.
 *
 * The bundle is a *baseline*, not an update: it seeds only an empty list, so a
 * daily refresh that has already landed is never rolled back to whatever
 * shipped in the .crx. An empty list is the seed case rather than a no-op
 * because it is also what a permanently failing refresh leaves behind — and
 * with nothing stored the options page has no course sites to offer and no
 * adapter can ever be enabled.
 */
export function shouldSeedFromBundle(stored: Adapter[], bundled: Adapter[]): boolean {
  return bundled.length > 0 && stored.length === 0;
}

/** §4.5: adapters carry a term and expire; the UI hides stale ones. */
export function isCurrentTerm(adapter: Adapter, currentTerm: string): boolean {
  return adapter.term.toLowerCase() === currentTerm.toLowerCase();
}

/**
 * `fa26` for a date in autumn 2026. Terms are the extension's own shorthand,
 * never parsed out of a source — §4.2 is explicit that term strings on a site
 * are free text and must not be relied on.
 */
export function currentTermCode(now: Date): string {
  const year = String(now.getFullYear()).slice(2);
  const month = now.getMonth();
  if (month <= 4) return `sp${year}`;
  if (month <= 6) return `su${year}`;
  return `fa${year}`;
}

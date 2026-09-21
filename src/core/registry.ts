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

import { EXTENSION_VERSION } from "../build-info.js";
import { CANVAS_ORIGIN } from "../sources/canvas.js";
import { GRADESCOPE_ORIGIN } from "../sources/gradescope.js";
import { PRAIRIELEARN_ORIGIN } from "../sources/prairielearn.js";
import { PRAIRIETEST_ORIGIN } from "../sources/prairietest.js";
import { SMARTPHYSICS_ORIGIN } from "../sources/smartphysics.js";
import { DEFAULT_TIME, supportedDateFormats } from "../sources/site.js";
import type { Adapter, Kind } from "../sources/types.js";

/**
 * Every value `Adapter.kind` may take.
 *
 * A `Record<Kind, true>` so the compiler, not a reviewer, notices when `Kind`
 * gains a member: a missing key is a typecheck error here. `core/manual.ts`
 * keeps a second spelling of the same list for hand-entered items, and the two
 * should be folded into one — mutation house rule 3, two copies of one decision.
 */
const ADAPTER_KINDS: Record<Kind, true> = {
  assignment: true,
  quiz: true,
  exam: true,
  booking: true,
  event: true,
  other: true,
};

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

/* -------------------------------------------------------------------------- */
/* §4.5's version gate                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Every top-level key an adapter may carry.
 *
 * A `satisfies Record<keyof Adapter | "$comment", true>` rather than a list, so
 * the compiler — not a reviewer — notices when `Adapter` gains a field: a
 * missing key is a typecheck error here, and an extra one is too.
 *
 * Refusing unknown keys is what makes `minExtensionVersion` mean something. The
 * registry is one file read by every installed build, so a new field reaches
 * old builds the moment it is published; an old build that silently *ignored*
 * `duePhrase` would run the entry with its `due` selector and quietly emit the
 * wrong dates, which is worse than not running it at all. Refused-because-
 * unknown is the belt to the version gate's braces: whichever fires, the entry
 * is dropped with a reason a console can print.
 *
 * `$comment` is allowed because the shipped registry already uses it to say why
 * an entry is spelled the way it is, and a comment changes nothing at runtime.
 */
const KNOWN_FIELDS = {
  $comment: true,
  id: true,
  label: true,
  courseCode: true,
  term: true,
  url: true,
  hostPattern: true,
  rows: true,
  title: true,
  splitTitle: true,
  clauses: true,
  due: true,
  link: true,
  columns: true,
  dueLabel: true,
  duePhrase: true,
  duePrev: true,
  dueSlot: true,
  titleSlot: true,
  defaultTime: true,
  titleBefore: true,
  titleFrom: true,
  time: true,
  kind: true,
  dateFormat: true,
  timezone: true,
  filter: true,
  minExtensionVersion: true,
} satisfies Record<keyof Adapter | "$comment", true>;

/**
 * A dotted version, validated positively.
 *
 * House rule 5: `typeof x === "string"` passes `""`, and `Number("")` is 0 — so
 * a `minExtensionVersion` of `""` or `"latest"` compared numerically would come
 * out as 0.0.0 and be accepted by every build there has ever been, which is the
 * exact opposite of what the field is for.
 */
const VERSION = /^\d{1,5}(?:\.\d{1,5}){0,3}$/;

/**
 * `a` against `b`, numerically per component: −1, 0 or +1.
 *
 * Numeric and not string comparison, because `"1.10.0" < "1.9.0"` is true as
 * strings — so the tenth minor release of this extension would refuse every
 * entry written for the ninth.
 */
export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * Fields that did not exist before 1.1.0, and the version an entry using one
 * has to demand.
 *
 * Written as a list of *fields* rather than a hand-set number on each entry,
 * because the author of a new entry is the person least able to remember which
 * build learned `duePrev`. `adapterFromCandidate` calls this, so a proposal the
 * search makes carries the right floor without anyone deciding it.
 */
const FIELDS_ADDED_IN_1_1 = [
  "duePrev",
  "duePhrase",
  "dueSlot",
  "titleSlot",
  "titleBefore",
  "defaultTime",
] as const;

/**
 * And the same list for 1.2.0, which learned to read the clauses of one cell.
 *
 * A 1.1.0 build refuses an unknown field outright (`KNOWN_FIELDS`), so an entry
 * carrying `clauses` is dropped there with a reason either way. The floor is
 * what makes the refusal say *which version* to update to rather than "unknown
 * field clauses", which reads like a broken registry.
 */
const FIELDS_ADDED_IN_1_2 = ["clauses"] as const;

/** The lowest extension version that can run this entry. */
export function requiredVersionFor(entry: object): string {
  const record = entry as Record<string, unknown>;
  if (FIELDS_ADDED_IN_1_2.some((field) => record[field] !== undefined)) return "1.2.0";
  return FIELDS_ADDED_IN_1_1.some((field) => record[field] !== undefined) ? "1.1.0" : "0.1.0";
}

/**
 * Whether an update has a registry refresh window to clear.
 *
 * §4.5 rests the registry for a day after a fetch *or* a failed attempt, which
 * is right while the build is unchanged and wrong the moment it is not: the
 * entries this build refused as `needs extension 1.1.0` are exactly the ones a
 * 1.1.0 install should pick up, and making it wait up to 24 hours for them
 * means a student updates and still sees nothing. Cleared on update so the
 * first sync refetches.
 *
 * A `boolean` in core rather than the clearing itself in the worker, so both
 * branches can be pinned by a test and both can be logged (worker rule 5).
 */
export function registryDueForRefresh(registry: {
  fetchedAt?: string;
  attemptedAt?: string;
}): boolean {
  return registry.fetchedAt !== undefined || registry.attemptedAt !== undefined;
}

/**
 * A single adapter, or a reason it was refused.
 *
 * `hostPattern` and `url` are checked against each other because the pattern is
 * what the extension will ask `chrome.permissions.request` for: an entry whose
 * URL is not covered by its own pattern would prompt for one origin and then
 * fetch another.
 */
export function validateAdapter(
  value: unknown,
  buildVersion: string = EXTENSION_VERSION,
): { adapter?: Adapter; reason?: string } {
  if (!value || typeof value !== "object") return { reason: "not an object" };
  const a = value as Record<string, unknown>;
  const id = a["id"];
  if (!isPlainString(id, 80)) return { reason: "missing id" };

  const fail = (reason: string) => ({ reason: `${id}: ${reason}` });

  // Before anything else: a key this build has never heard of means the entry
  // was written for a later one, and running it on the fields we *do* recognise
  // would read the wrong cell rather than nothing. See `KNOWN_FIELDS`.
  for (const key of Object.keys(a)) {
    if (!Object.hasOwn(KNOWN_FIELDS, key)) return fail(`unknown field ${key}`);
  }

  for (const field of ["label", "courseCode", "term", "rows", "title", "due", "timezone"]) {
    if (!isPlainString(a[field])) return fail(`missing ${field}`);
  }
  if (a["link"] !== undefined && !isPlainString(a["link"])) return fail("bad link");
  // A literal separator, and a short one: it is remote data applied to every row.
  if (a["splitTitle"] !== undefined && !isPlainString(a["splitTitle"], 8)) {
    return fail("bad splitTitle");
  }
  // The same, one shape over: `clauses` cuts a cell into a deadline and the
  // occasions beside it. Also a literal, for the same reason.
  if (a["clauses"] !== undefined && !isPlainString(a["clauses"], 8)) {
    return fail("bad clauses");
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

  /*
   * `kind` names what the rows on this page are, and it is remote data that
   * decides which surface an item lands on — `examBoard` filters on
   * `kind === "exam"` — so it is checked against the union rather than passed
   * through. A typo would otherwise reach `Item.kind` as a value no `switch` in
   * the UI has a branch for.
   *
   * Written as a `Record<Kind, true>` rather than a list so a seventh kind fails
   * the typecheck here instead of being silently rejected at runtime.
   */
  const kind = a["kind"];
  if (kind !== undefined) {
    // `Object.hasOwn`, never `in`: `"constructor" in {}` is true, so an `in`
    // check on an object literal accepts every name on Object.prototype.
    if (typeof kind !== "string" || !Object.hasOwn(ADAPTER_KINDS, kind)) {
      return fail(`unsupported kind (${Object.keys(ADAPTER_KINDS).join(", ")})`);
    }
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

  /*
   * The prose-shaped page's two fields, checked the same way and for the same
   * reason: an empty keyword in `"due|"` would match at every position in every
   * sentence on the page, which is house rule 5's `""`-passes-a-typeof one
   * field over.
   */
  const duePhrase = a["duePhrase"];
  if (duePhrase !== undefined) {
    if (!isPlainString(duePhrase, 200)) return fail("bad duePhrase");
    if (duePhrase.split("|").some((word) => word.trim() === "")) {
      return fail("duePhrase has an empty keyword");
    }
  }
  // Short, like `splitTitle`: a literal applied to every row of remote data.
  if (a["titleBefore"] !== undefined && !isPlainString(a["titleBefore"], 8)) {
    return fail("bad titleBefore");
  }
  if (a["duePrev"] !== undefined && !isPlainString(a["duePrev"], 200)) return fail("bad duePrev");
  /*
   * A grid column index. `Number.isInteger`, not `typeof x === "number"`:
   * `NaN`, `1.5` and `-1` are all numbers, and each would index the grid to
   * `undefined` on every row — which reads as "this course has no deadlines"
   * rather than as a bad entry. Bounded at 99 because a table with a hundred
   * columns is not a course schedule.
   */
  for (const field of ["dueSlot", "titleSlot"] as const) {
    const slot = a[field];
    if (slot === undefined) continue;
    if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 0 || slot > 99) {
      return fail(`bad ${field} (a column index from 0 to 99)`);
    }
  }
  /*
   * `HH:mm`, checked with an anchored regex rather than split-and-Number.
   * House rule 5: `Number("")` is 0, so a malformed `defaultTime` would put
   * every deadline on the page at midnight — a whole day early, and looking
   * exactly like a real answer.
   */
  const defaultTime = a["defaultTime"];
  if (defaultTime !== undefined) {
    if (!isPlainString(defaultTime, 5) || !DEFAULT_TIME.test(defaultTime)) {
      return fail("bad defaultTime (HH:mm, 24-hour)");
    }
  }

  /*
   * Two answers to one question is not a precedence problem, it is an entry
   * that has not decided what the page looks like. Refused rather than silently
   * ranked, because the ranking would be invisible in the preview — what the
   * student approves would not be what the runner goes on reading.
   */
  const locators = (["columns", "dueSlot", "duePrev"] as const).filter(
    (field) => a[field] !== undefined,
  );
  if (locators.length > 1) {
    const named = locators.map((field) => (field === "columns" ? "columns.due" : field));
    return fail(`${named.join(" and ")} each locate the date cell; declare one`);
  }
  if (a["columns"] !== undefined && a["titleSlot"] !== undefined) {
    return fail("columns.title and titleSlot both locate the title cell; declare one");
  }
  if (dueLabel !== undefined && duePhrase !== undefined) {
    return fail("dueLabel and duePhrase both read the date out of the located text; declare one");
  }
  /*
   * And two rules cutting one cell is the same mistake one field over.
   *
   * `splitTitle` cuts a cell into several deadlines sharing one date;
   * `clauses` cuts it into one deadline and the occasions beside it. An entry
   * declaring both is claiming the page is two shapes at once, and whichever
   * ran first would decide what the other saw.
   */
  if (a["splitTitle"] !== undefined && a["clauses"] !== undefined) {
    return fail("splitTitle and clauses both cut a cell into parts; declare one");
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

  /*
   * §4.5's version gate, which until 1.1.0 was a string nothing ever read.
   *
   * The registry is one published file and every installed build reads it, so
   * an entry using a field added after a given build *will* reach that build.
   * Dropping it with a reason is the only honest answer: running it would mean
   * reading the date out of whichever hook the old code does understand, which
   * is a wrong deadline rather than a missing one (§11 ranks both badly, but a
   * confidently wrong date is the one a student acts on).
   */
  const min = a["minExtensionVersion"];
  if (!isPlainString(min, 20)) return fail("missing minExtensionVersion");
  if (!VERSION.test(min)) return fail("bad minExtensionVersion (a dotted version like 1.2.0)");
  if (compareVersions(min, buildVersion) > 0) {
    return fail(`needs extension ${min}, this is ${buildVersion}`);
  }

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
export function validateRegistry(
  text: string,
  buildVersion: string = EXTENSION_VERSION,
): ValidationResult {
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
    const { adapter, reason } = validateAdapter(entry, buildVersion);
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

/** A published entry that a local one stands in for, and why. */
export interface ShadowedAdapter {
  id: string;
  by: string;
  why: "id" | "url";
}

/**
 * Published and self-added adapters as one list.
 *
 * A locally added entry wins a duplicate id: the student chose theirs, and a
 * published entry arriving later must not silently replace what they are
 * already using without them noticing. It also wins a duplicate **url**. A
 * student who added CS 374 A's homework page on 2026-09-20 had
 * `cs374-fa26-homeworks-local`; the registry brought `cs374a-fa26-hw` for the
 * same page the next morning, and two adapters reading one page are two rows
 * per deadline — §3.1 keys a site row on the adapter's id, and §5.3 merges
 * across sources, never within one. The published entry is set aside, and the
 * worker says so, rather than either copy being deleted for the student.
 */
export function mergeAdapters(
  local: readonly Adapter[],
  published: readonly Adapter[],
): { adapters: Adapter[]; shadowed: ShadowedAdapter[] } {
  const byId = new Map(local.map((adapter) => [adapter.id, adapter] as const));
  const byUrl = new Map(local.map((adapter) => [pageKey(adapter.url), adapter] as const));
  const adapters: Adapter[] = [...local];
  const shadowed: ShadowedAdapter[] = [];
  for (const adapter of published) {
    const sameId = byId.get(adapter.id);
    const sameUrl = byUrl.get(pageKey(adapter.url));
    if (sameId) shadowed.push({ id: adapter.id, by: sameId.id, why: "id" });
    else if (sameUrl) shadowed.push({ id: adapter.id, by: sameUrl.id, why: "url" });
    else adapters.push(adapter);
  }
  return { adapters, shadowed };
}

/** One page, however its address was spelled: no fragment, no trailing slash. */
function pageKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href.replace(/\/$/, "");
  } catch {
    return url;
  }
}

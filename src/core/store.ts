/**
 * Storage (§3, §5.4).
 *
 * Everything lives in `chrome.storage.local` (§0 decision 1). This module owns
 * the schema, its defaults, and its migrations, so no other module has to guess
 * what a partially-written store looks like.
 */

import type {
  Adapter,
  DueOverride,
  Item,
  Overrides,
  RawItem,
  Settings,
  Source,
  SourceStatus,
  StoreV1,
  Suggestion,
} from "../sources/types.js";
import { isOlderThan } from "./dates.js";
import { isInstant } from "./parsing.js";
import { isGcalState, type GcalState } from "./gcal-auth.js";
// Type-only, so the runtime edge runs the other way: `core/piazza.ts` imports
// `backoffMinutes` from here, and a value import back would be a cycle.
import type { PiazzaClass, PiazzaHealth } from "./piazza.js";
import { validateAdapter } from "./registry.js";

/**
 * 2 since the first-run screen landed.
 *
 * The bump is load-bearing, not bookkeeping: it is how `migrate` tells a store
 * written before setup existed from one written after, which is the difference
 * between "this student set up days ago" and "this student just pressed Reset".
 */
export const SCHEMA_VERSION = 2 as const;
/**
 * Deliberately still the pre-rename name.
 *
 * The extension was renamed Illini Due → Illini Dash, but this key addresses
 * data that already exists in installed profiles. Renaming it would read an
 * absent key, hand `migrate` an empty store, and silently discard every
 * override, `notified` record and cached item — the unrecoverable loss §3.1 and
 * `migrateOverrides` are written to avoid. It is invisible to the user, so the
 * cost of keeping it is a comment; the cost of changing it is Sushi's store.
 * If it is ever renamed, it needs a read-old-write-new migration and a test
 * that loads a store written under the old key.
 */
export const STORAGE_KEY = "illiniDue";

export const ALL_SOURCES: Source[] = [
  "canvas",
  "gradescope",
  "prairielearn",
  "prairietest",
  "smartphysics",
  "site",
  "manual",
];

/**
 * The sources this extension actually reads from a site.
 *
 * `manual` is the student's own list: nothing is fetched for it, so it has no
 * health to report and must not appear in "n of m sources OK", in the sources
 * panel, or in the stale banner. Worker rule 2 says a green dot means "I
 * fetched, and it was fine" — a source that is never fetched cannot earn one,
 * and a dot that can only ever be the same colour is not information.
 *
 * One predicate rather than a `!== "manual"` at each surface, because there are
 * four surfaces and the one that forgets is the one that shows a dot nobody can
 * act on.
 */
export function isFetchedSource(source: Source): boolean {
  return source !== "manual";
}

export const FETCHED_SOURCES: Source[] = ALL_SOURCES.filter(isFetchedSource);

/** §3: leadTimes both, quiet hours 23–8, hide submitted, poll 30 (min 15). */
export const DEFAULT_SETTINGS: Settings = {
  leadTimes: ["24h", "2h"],
  quietHours: { start: 23, end: 8 },
  hideSubmitted: true,
  remindNotForCredit: false,
  pollMinutes: 30,
};

export const MIN_POLL_MINUTES = 15;
export const MAX_POLL_MINUTES = 120;

/**
 * §7's window is two local hours.
 *
 * `Number("")` is 0 and an `<input min max>` is decorative without a form, so a
 * cleared box would otherwise yield `{start: 23, end: 0}` — whose wrapping test
 * `hour >= 23 || hour < 0` leaves midnight to 08:00 loud — or `{0, 0}`, which
 * disables quiet hours while the checkbox still reads on.
 */
export function normalizeQuietHours(value: Settings["quietHours"]): Settings["quietHours"] {
  if (!value) return null;
  const hour = (candidate: unknown, fallback: number) => {
    const n = Number(candidate);
    return Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback;
  };
  const start = hour(value.start, DEFAULT_SETTINGS.quietHours!.start);
  const end = hour(value.end, DEFAULT_SETTINGS.quietHours!.end);
  // start === end would be a zero-length window that inQuietHours reads as off,
  // while the UI still shows it enabled. Treat it as off, explicitly.
  return start === end ? null : { start, end };
}

export interface StoreV1Plus extends StoreV1 {
  /** §5.4: consecutive syncs in which an undated raw item was not seen. */
  misses: Record<string, number>;
  lastSyncAt?: string;
  /** Per-source earliest next attempt, from §6's backoff ladder. */
  backoffUntil: Partial<Record<Source, string>>;
  /** §4.5: adapter ids the user switched on. The permission is checked separately. */
  enabledAdapters: string[];
  /**
   * Courses §4.1's term filter held back on the last Canvas sync.
   *
   * Persisted because they contribute no items, so `courseSummaries` — which is
   * built from `raw` — has nothing to hang them on, and Options would show
   * nothing at all. A filter the student cannot see is one they cannot correct,
   * which is the silent-exclusion failure worker rule 2 is about.
   */
  setAsideCourses: { id: string; name: string; courseCode?: string; reason: string }[];
  /**
   * When the student finished the first-run screen.
   *
   * Absent on every store written before it existed, which is why `needsSetup`
   * also treats "some source has succeeded" as finished — otherwise shipping
   * this puts a setup screen in front of every beta tester who set up days ago.
   */
  setupDoneAt?: string;
  /**
   * Course-site adapters this student added themselves (§4.5, self-serve).
   *
   * Kept apart from `registry.adapters`, which the daily refresh replaces
   * wholesale — a locally added course must survive that, and must never be
   * silently overwritten by a published entry the student did not choose.
   *
   * They go through `validateAdapter` exactly like a published one. It is the
   * same trust boundary: a URL and a set of selectors that decide what gets
   * fetched, whoever typed them.
   */
  localAdapters: Adapter[];
  /**
   * Deadlines the student typed in themselves (the `manual` source).
   *
   * A list beside `raw`, not entries in it. `raw` is what the sync loop replaces
   * per source and what §5.4's retention prunes: an undated row that no sync
   * reports is purged after three misses, and no sync will ever report these,
   * because nothing fetches them. Keeping them out of `raw` means
   * `applyRetention`, `dropItemsOf` and `withoutRows` cannot reach them — one
   * decision instead of three exemptions that each have to be remembered.
   *
   * They are spliced into the dedupe input instead, so a manual row still merges
   * with a Gradescope one, still honours hide / done / split / merge, and still
   * carries a memberKey like every other row.
   */
  manualItems: RawItem[];
  /**
   * Deadlines read out of an instructor's post that nothing else accounts for.
   *
   * A queue, not a list of rows: nothing here is on the calendar, nothing here
   * reminds, and nothing here becomes real until the student presses Add. See
   * `Suggestion` — prose is the one input where a confident misreading is
   * indistinguishable from a fact, so this extension proposes rather than
   * asserts.
   */
  suggestions: Suggestion[];
  /**
   * Post id → when it was read.
   *
   * The only thing that stops one post applying its correction twice. Kept as a
   * map rather than a list so the check is O(1) at the one call site that has
   * to be cheap (every post the observer sees, on every page load), and stamped
   * with a time so `pruneSeenPosts` can forget a semester's worth.
   */
  seenPosts: Record<string, string>;
  /**
   * Page observers, which read a rendered page instead of fetching one.
   *
   * Not a `Source`: nothing is fetched, nothing is synced, and a `SourceStatus`
   * would give it a health dot the loop could never fill in. What it has
   * instead is evidence of an attempt — worker rule 2 at the observer level.
   * `enabled` is the student's switch; the other two are set only by a page
   * that was actually read, so a switch that was merely flipped cannot claim a
   * reading it never made.
   */
  observers: Record<ObserverId, ObserverState>;
  /**
   * Google Calendar (§8.3, Sushi 2026-09-18).
   *
   * The one thing in this store that corresponds to data outside the browser,
   * which is why it holds an *index* rather than a copy: `byItemId` maps this
   * extension's own key for a deadline to the Google event id it was written to
   * and the hash of the body it was written with. That is what makes an
   * unchanged deadline cost no request, and it is also the only way to find an
   * event again in order to delete it when the student ticks the row off.
   *
   * `state` and the two `lastPush*` fields are kept apart on purpose (worker
   * rule 2): `state: "connected"` says a token was obtained, and only
   * `lastPushAt` / `lastPushCount` — which nothing but a push that returned ever
   * writes — can make the row say a number.
   */
  gcal: GcalStore;
}

export interface GcalStore {
  /** The student's switch. Off by default; §0 rule 1's one exception is opt-in. */
  enabled: boolean;
  /** The secondary calendar this extension created. Absent until it has. */
  calendarId?: string;
  /** `illiniDashId` → the Google event it lives in, and our last body's hash. */
  byItemId: Record<string, { eventId: string; hash: string }>;
  lastPushAt?: string;
  lastPushCount?: number;
  state: GcalState;
  lastError?: string;
}

/**
 * A stored `gcal` block that is actually usable.
 *
 * Validated positively like `manualItems` and for a sharper reason than either:
 * a half-written `byItemId` entry is an event id that will be sent to Google in
 * a URL. `""` passing a `typeof` check would build
 * `/calendars/<id>/events/` — a request against the *collection*, not the
 * event — so house rule 5 is load-bearing here rather than tidy.
 *
 * A `state` this build does not know about falls back to `never` rather than
 * being kept: an unknown state has no sentence, and a row with no sentence is
 * the one thing the Settings section must never be.
 */
function migrateGcal(stored: unknown): GcalStore {
  const value = isRecord(stored) ? stored : {};
  const text = (key: string) => typeof value[key] === "string" && (value[key] as string) !== "";
  const entries = isRecord(value["byItemId"]) ? Object.entries(value["byItemId"]) : [];
  return {
    enabled: value["enabled"] === true,
    ...(text("calendarId") ? { calendarId: value["calendarId"] as string } : {}),
    byItemId: Object.fromEntries(
      entries.filter((entry): entry is [string, { eventId: string; hash: string }] => {
        const row = entry[1];
        if (!isRecord(row)) return false;
        return (
          entry[0] !== "" &&
          typeof row["eventId"] === "string" &&
          row["eventId"] !== "" &&
          typeof row["hash"] === "string"
        );
      }),
    ),
    // An instant, not any string: this is what the Settings chip prints, and a
    // half-written value would render "Pushed 14 events · Invalid Date".
    ...(isInstant(value["lastPushAt"]) ? { lastPushAt: value["lastPushAt"] } : {}),
    ...(typeof value["lastPushCount"] === "number" &&
    Number.isInteger(value["lastPushCount"]) &&
    (value["lastPushCount"] as number) >= 0
      ? { lastPushCount: value["lastPushCount"] as number }
      : {}),
    // `pushing` is transient: a worker torn down mid-push leaves it on disk, and
    // restoring it would draw "Working…" forever over nothing happening.
    state: isGcalState(value["state"]) && value["state"] !== "pushing"
      ? value["state"]
      : "never",
    ...(text("lastError") ? { lastError: value["lastError"] as string } : {}),
  };
}

export function emptyGcal(): GcalStore {
  return { enabled: false, byItemId: {}, state: "never" };
}

/**
 * Every page observer this build knows about.
 *
 * `piazza` is here rather than in `Source` on purpose: it is fetched by the
 * worker on the sync schedule, but what it produces is *posts* for
 * `core/suggest.ts` and never a `RawItem`, so it has no place in `PLANS` and no
 * health dot the sync loop could fill in. What it borrows from a source is the
 * evidence of an attempt, which is the optional half of `ObserverState` below.
 */
export type ObserverId = "campuswire" | "piazza";

export const ALL_OBSERVERS: ObserverId[] = ["campuswire", "piazza"];

export interface ObserverState {
  enabled: boolean;
  /** When a page was last read. Absent until one has been. */
  lastObservedAt?: string;
  /** How many posts have reached the worker from it. Absent until one has. */
  postsSeen?: number;
  /** How many deadlines those posts produced. Absent until a run counted. */
  deadlinesFound?: number;

  /*
   * Fetched observers only (today, Piazza). A page observer leaves none of
   * these behind, because nothing about it is an attempt this extension made.
   * Every one is derived from a request that happened — worker rule 2 — and
   * `core/piazza.ts` owns every decision that reads or writes them.
   */
  /** `pending` until the first fetch. Never seeded `ok` (worker rule 2). */
  state?: PiazzaHealth;
  /** When a fetch was last attempted, successful or not. */
  lastAttemptAt?: string;
  /** Why the last attempt failed, in the words the row shows. */
  lastError?: string;
  /** The enrolment list, cached from the class page and refreshed daily. */
  classes?: PiazzaClass[];
  classesFetchedAt?: string;
  /** nid -> the highest post number already read, so a 150-post feed is read once. */
  lastNr?: Record<string, number>;
  /**
   * Which reader read them (`PIAZZA_READER_VERSION`). Absent means 1.
   *
   * "Read" is a claim about a *reader*, not about a post: version 1 read the
   * first 120 characters. Without this, an install that ran the snippet reader
   * would never look at those posts again.
   */
  readerVersion?: number;
  /** §6's ladder: the earliest next attempt after a failure. */
  nextAttemptAt?: string;
  failures?: number;
}

/**
 * A stored observer entry that is actually usable.
 *
 * House rule 5: `enabled` is checked for the boolean it must be, because a
 * store written before this field existed carries `undefined` — which is
 * falsy, and would read as "the student switched this off" rather than "there
 * was nothing to switch". The difference matters at exactly one moment: the
 * service worker re-registering the content script at startup.
 */
function isObserverHealth(value: unknown): value is PiazzaHealth {
  return value === "pending" || value === "ok" || value === "needs_login" || value === "error";
}

/** A cached enrolment entry that is actually usable. Validated, never cast. */
function isUsableClass(value: unknown): value is PiazzaClass {
  return (
    isRecord(value) &&
    typeof value["nid"] === "string" &&
    value["nid"] !== "" &&
    typeof value["courseRaw"] === "string" &&
    Array.isArray(value["courseCodes"]) &&
    value["courseCodes"].every((code) => typeof code === "string") &&
    typeof value["active"] === "boolean"
  );
}

/** nid -> post number, with anything that is not one dropped rather than trusted. */
function usableLastNr(value: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [nid, nr] of Object.entries(value)) {
    if (typeof nr === "number" && Number.isInteger(nr) && nr >= 0) out[nid] = nr;
  }
  return out;
}

function migrateObservers(stored: unknown): Record<ObserverId, ObserverState> {
  const out = {} as Record<ObserverId, ObserverState>;
  const value = isRecord(stored) ? stored : {};
  for (const id of ALL_OBSERVERS) {
    const entry = value[id];
    const from = isRecord(entry) ? entry : {};
    out[id] = {
      enabled: from["enabled"] === true,
      // An instant, not any string: this is what the Settings row prints, and
      // a half-written value would render "last read Invalid Date".
      ...(isInstant(from["lastObservedAt"]) ? { lastObservedAt: from["lastObservedAt"] } : {}),
      ...(typeof from["postsSeen"] === "number" && Number.isInteger(from["postsSeen"]) && from["postsSeen"] >= 0
        ? { postsSeen: from["postsSeen"] }
        : {}),
      // Validated exactly like `postsSeen`, and for one extra reason: the row
      // prints "none with a deadline" for `0` and prints nothing at all when
      // this is absent, so a half-written value would be the difference
      // between a claim and a silence.
      ...(typeof from["deadlinesFound"] === "number" &&
      Number.isInteger(from["deadlinesFound"]) &&
      from["deadlinesFound"] >= 0
        ? { deadlinesFound: from["deadlinesFound"] }
        : {}),
      /*
       * The fetched half, validated the same way and for the same reason: this
       * is a blob off disk, possibly written by a build that predates every
       * field here. A `state` of anything else would reach `describePiazza` and
       * be printed at the student, and a `lastAttemptAt` that is not an instant
       * would re-arm the login re-check on every navigation for ever.
       */
      ...(isObserverHealth(from["state"]) ? { state: from["state"] } : {}),
      ...(isInstant(from["lastAttemptAt"]) ? { lastAttemptAt: from["lastAttemptAt"] } : {}),
      ...(typeof from["lastError"] === "string" && from["lastError"] !== ""
        ? { lastError: from["lastError"] }
        : {}),
      ...(Array.isArray(from["classes"]) ? { classes: from["classes"].filter(isUsableClass) } : {}),
      ...(isInstant(from["classesFetchedAt"]) ? { classesFetchedAt: from["classesFetchedAt"] } : {}),
      ...(isRecord(from["lastNr"]) ? { lastNr: usableLastNr(from["lastNr"]) } : {}),
      /*
       * A positive integer or nothing. `0` and `-1` are not "an older reader",
       * they are a half-written field, and the difference matters in one
       * direction only: an unreadable value falls back to 1 and costs one
       * re-read of the class, where accepting a bogus large number would skip
       * the upgrade for ever (`readerVersionOf`).
       */
      ...(typeof from["readerVersion"] === "number" &&
      Number.isInteger(from["readerVersion"]) &&
      from["readerVersion"] > 0
        ? { readerVersion: from["readerVersion"] }
        : {}),
      ...(isInstant(from["nextAttemptAt"]) ? { nextAttemptAt: from["nextAttemptAt"] } : {}),
      ...(typeof from["failures"] === "number" && Number.isInteger(from["failures"]) && from["failures"] >= 0
        ? { failures: from["failures"] }
        : {}),
    };
  }
  return out;
}

/** §5.4's shape, one level up: a post read this long ago cannot recur. */
export const SEEN_POST_DAYS = 60;
/** A suggestion nobody pressed Add on in a month is not going to be pressed. */
export const SUGGESTION_AGE_DAYS = 30;
/** …nor is one whose deadline is a week gone. */
export const SUGGESTION_PAST_DAYS = 7;

/**
 * Forget posts read more than `SEEN_POST_DAYS` ago.
 *
 * Pure, and given `now` rather than reading a clock, because every other
 * retention rule in this project is tested by handing it a date (§5.4) and a
 * second style here would be a second thing to get wrong.
 */
export function pruneSeenPosts(
  seenPosts: Record<string, string>,
  now: string,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(seenPosts).filter(([, at]) => !isOlderThan(at, now, SEEN_POST_DAYS)),
  );
}

/**
 * Drop suggestions that have gone stale or whose deadline has passed.
 *
 * Two clocks, because they answer different questions: `createdAt` says nobody
 * is going to act on this, and `at` says acting on it would put a week-old
 * deadline on the calendar. Either one is enough.
 */
export function pruneSuggestions(suggestions: Suggestion[], now: string): Suggestion[] {
  return suggestions.filter(
    (suggestion) =>
      !isOlderThan(suggestion.createdAt, now, SUGGESTION_AGE_DAYS) &&
      !isOlderThan(suggestion.at, now, SUGGESTION_PAST_DAYS),
  );
}

/**
 * A stored `Suggestion` that is actually usable.
 *
 * Validated positively like `manualItems`, and for the sharper of the two
 * reasons: a suggestion exists in exactly one place, and the fields it is shown
 * by — the verbatim `span`, the instant — are the whole of the student's
 * evidence. A half-written one would render a deadline with no words behind it,
 * which is the one thing this feature promises never to do. House rule 5: a
 * `typeof` check passes `""`, so every required string is checked non-empty and
 * `at` has to be a real instant.
 */
function isUsableSuggestion(value: unknown): value is Suggestion {
  if (!isRecord(value)) return false;
  const text = (key: string) => typeof value[key] === "string" && (value[key] as string) !== "";
  if (value["kind"] !== "new") return false;
  if (!isInstant(value["at"] as string)) return false;
  if (!["piazza", "campuswire", "paste"].includes(value["source"] as string)) return false;
  /*
   * `postSubject` is optional and, when present, a real string (house rule 5).
   *
   * An empty one would pass `typeof` and render as `the Piazza post ""` — a row
   * claiming to name the post it came from and naming nothing. Absent is a
   * value this shape has ("an older build wrote me"); empty is not.
   */
  if (value["postSubject"] !== undefined && !text("postSubject")) return false;
  return (
    text("id") && text("title") && text("span") && text("postId") && text("createdAt")
  );
}

function defaultStatus(source: Source): SourceStatus {
  return {
    source,
    // §4.5: site adapters are off until the user enables one and grants the
    // host permission. smartPhysics is off for a different reason: it serves
    // PHYS 211–214 only, and a student who has never signed in there would
    // otherwise get a yellow "sign in" dot and a banner for a site they do not
    // use — the opposite of the honest-health work in `core/health.ts`. The
    // beta guide tells PHYS testers to switch it on.
    // `manual` is on and stays on: there is nothing to switch off, and a switch
    // over the student's own typed rows would be a control that does nothing.
    enabled: source !== "site" && source !== "smartphysics",
    // Not `ok`. Nothing has been fetched yet, and a state field that claims
    // success before the first request is the fresh-install green dot — worker
    // house rule 2. `core/health.ts` renders this grey and says "not checked".
    // `manual` is seeded `disabled` for the opposite reason to `site`: not
    // "nothing is configured", but "nothing will ever be fetched". It is the
    // one state every health surface already excludes, which is exactly what a
    // source with no attempt behind it needs (`isFetchedSource`).
    state:
      source === "site" || source === "smartphysics" || source === "manual"
        ? "disabled"
        : "pending",
    consecutiveFailures: 0,
  };
}

export function emptyStore(): StoreV1Plus {
  return {
    schemaVersion: SCHEMA_VERSION,
    raw: {},
    items: [],
    sources: Object.fromEntries(ALL_SOURCES.map((s) => [s, defaultStatus(s)])) as Record<
      Source,
      SourceStatus
    >,
    overrides: { mergeGroups: [], splitKeys: [], hiddenKeys: [], disabledCourses: [], doneKeys: [], keptCourses: [], courseNames: {}, dueOverrides: {} },
    settings: { ...DEFAULT_SETTINGS },
    registry: { adapters: [] },
    misses: {},
    backoffUntil: {},
    enabledAdapters: [],
    localAdapters: [],
    setAsideCourses: [],
    manualItems: [],
    suggestions: [],
    seenPosts: {},
    observers: Object.fromEntries(
      ALL_OBSERVERS.map((id) => [id, { enabled: false }]),
    ) as Record<ObserverId, ObserverState>,
    gcal: emptyGcal(),
  };
}

/**
 * Fills in anything missing from a stored blob.
 *
 * Written as a merge rather than a version switch because the failure that
 * matters is not a future migration — it is a store half-written by an
 * interrupted sync, or one written by a build that predates a field. Losing a
 * user's overrides to a missing key would be silent and unrecoverable.
 */
/**
 * A stored `RawItem` that is actually usable.
 *
 * Validated positively rather than cast. `value.raw as Record<string, RawItem>`
 * asserted a shape nobody had checked, so a half-written entry — an interrupted
 * sync, a build that predates a field — reached `dedupe`, `grouping` and
 * `schedule` as if it were real, and the first thing to touch its missing `url`
 * or `fetchedAt` threw somewhere far from the cause. House rule 5: `typeof x
 * === "string"` is not validation, so the required strings must also be
 * non-empty.
 */
function isUsableRaw(value: unknown): value is RawItem {
  if (!isRecord(value)) return false;
  const text = (key: string) => typeof value[key] === "string" && (value[key] as string) !== "";
  // `url` is *not* required. It became optional with the `manual` source, and a
  // required-field test is how a schema change silently deletes data: every
  // hand-typed deadline without a link would have been dropped on the next load,
  // with no error and nothing on screen to say a row had ever existed. When the
  // field is present it still has to be a non-empty string — `""` passing a
  // `typeof` check is house rule 5's own example.
  if (value["url"] !== undefined && !text("url")) return false;
  return text("source") && text("sourceId") && text("title") && text("fetchedAt");
}

/**
 * When setup was finished — stamped once for stores that predate the screen.
 *
 * `needsSetup` first asked "has any source ever succeeded?" live, which was
 * right for the upgrade and wrong for everything else: the popup fires a sync
 * the moment it opens, that sync succeeds because the browser is still signed
 * in, and setup completed itself about a second after Reset. Sushi pressed
 * Reset and watched the calendar come straight back.
 *
 * So the question is asked once, here, and only of a blob written by a build
 * that predates the field. After the first save the schema version is current
 * and this can never fire again — which is what makes Reset mean something.
 *
 * The timestamp is the newest success rather than "now", because that is the
 * moment this install demonstrably worked, and `migrate` has no clock.
 */
function migrateSetupDoneAt(
  value: Record<string, unknown> & { schemaVersion?: unknown },
  sources: Record<Source, SourceStatus>,
): string | undefined {
  if (typeof value.setupDoneAt === "string") return value.setupDoneAt;
  // A blob with no version at all is also pre-2; `undefined < 2` is false, so
  // it is compared as a number only when it is one.
  const stored = typeof value.schemaVersion === "number" ? value.schemaVersion : 0;
  if (stored >= SCHEMA_VERSION) return undefined;

  let newest: string | undefined;
  for (const status of Object.values(sources)) {
    const at = status?.lastSuccessAt;
    if (at === undefined) continue;
    if (newest === undefined || at > newest) newest = at;
  }
  return newest;
}

/** A stored `Item` that is actually usable. */
function isUsableItem(value: unknown): value is Item {
  if (!isRecord(value)) return false;
  if (typeof value["id"] !== "string" || value["id"] === "") return false;
  if (!Array.isArray(value["members"])) return false;
  if (typeof value["title"] !== "string") return false;
  return true;
}

/**
 * Migrations by stored `schemaVersion`, applied in order.
 *
 * Empty today, and the switch exists anyway: the repo has already changed a
 * `sourceId` derivation once (PrairieTest, docs/sourceid-decision.md) and
 * dropped stored hides once (`hiddenItemIds` → `hiddenKeys`). During a beta
 * week those changes ship to stores nobody can see or reset, and the place to
 * remap keys has to exist before it is needed rather than being invented in a
 * hurry over someone else's data.
 *
 * A migration receives and returns a raw blob; the field-filling below runs
 * afterwards either way, so a migration only has to handle what it changes.
 */
const MIGRATIONS: { to: number; apply: (blob: Record<string, unknown>) => Record<string, unknown> }[] =
  [];

/**
 * `now` is a parameter, not a clock read here.
 *
 * Two of this store's lists expire (`seenPosts`, `suggestions`), and the rule
 * that decides has to be pinnable by a test that hands it a date — the same
 * shape §5.4's retention already has. The default keeps every existing caller
 * unchanged.
 */
export function migrate(stored: unknown, now: string = new Date().toISOString()): StoreV1Plus {
  const base = emptyStore();
  if (!stored || typeof stored !== "object") return base;

  let blob = stored as Record<string, unknown>;
  const from = typeof blob["schemaVersion"] === "number" ? blob["schemaVersion"] : 0;
  for (const migration of MIGRATIONS) {
    if (from < migration.to) blob = migration.apply(blob);
  }
  const value = blob as Partial<StoreV1Plus>;

  const sources = { ...base.sources };
  for (const source of ALL_SOURCES) {
    const existing = value.sources?.[source];
    if (existing && typeof existing === "object") {
      sources[source] = { ...defaultStatus(source), ...existing, source };
    }
  }

  const settings = { ...base.settings, ...(value.settings ?? {}) };
  // A poll interval outside §8.2's range would either hammer the sites or make
  // the extension useless; §4.2 also promises Gradescope no faster than 15 min.
  settings.pollMinutes = Math.min(
    MAX_POLL_MINUTES,
    Math.max(MIN_POLL_MINUTES, Number(settings.pollMinutes) || DEFAULT_SETTINGS.pollMinutes),
  );
  if (!Array.isArray(settings.leadTimes)) settings.leadTimes = [...DEFAULT_SETTINGS.leadTimes];
  // `typeof x === "boolean"` rather than a truthiness test: a store written
  // before this setting existed carries `undefined`, which must fall back to the
  // default rather than silently reading as "off" by coincidence.
  if (typeof settings.remindNotForCredit !== "boolean") {
    settings.remindNotForCredit = DEFAULT_SETTINGS.remindNotForCredit;
  }
  settings.quietHours = normalizeQuietHours(settings.quietHours);

  return {
    schemaVersion: SCHEMA_VERSION,
    raw: isRecord(value.raw)
      ? Object.fromEntries(Object.entries(value.raw).filter(([, item]) => isUsableRaw(item)))
      : {},
    items: Array.isArray(value.items) ? value.items.filter(isUsableItem) : [],
    sources,
    overrides: migrateOverrides(value.overrides),
    settings,
    registry: {
      fetchedAt: value.registry?.fetchedAt,
      attemptedAt: value.registry?.attemptedAt,
      adapters: Array.isArray(value.registry?.adapters)
        ? (value.registry!.adapters as Adapter[])
        : [],
    },
    misses: isRecord(value.misses) ? (value.misses as Record<string, number>) : {},
    lastSyncAt: typeof value.lastSyncAt === "string" ? value.lastSyncAt : undefined,
    backoffUntil: isRecord(value.backoffUntil) ? value.backoffUntil : {},
    enabledAdapters: Array.isArray(value.enabledAdapters)
      ? value.enabledAdapters.filter((id): id is string => typeof id === "string")
      : [],
    setupDoneAt: migrateSetupDoneAt(value, sources),
    // Validated on the way back in, not merely cast: a stored adapter decides
    // what this extension fetches, so a half-written or hand-edited entry has
    // to clear the same bar a published one does.
    localAdapters: Array.isArray(value.localAdapters)
      ? value.localAdapters
          .map((entry) => validateAdapter(entry).adapter)
          .filter((adapter): adapter is Adapter => adapter !== undefined)
      : [],
    // Validated on the way back in like `localAdapters`, and for a sharper
    // reason: these rows exist in exactly one place. A fetched row that fails
    // validation comes back on the next sync; a hand-typed one is gone for good.
    manualItems: Array.isArray(value.manualItems) ? value.manualItems.filter(isUsableRaw) : [],
    // Validated and pruned on the way back in. A suggestion whose deadline is a
    // week past is worse than no suggestion: pressing Add would file a row that
    // is already overdue, in a list whose entire job is what is still ahead.
    suggestions: pruneSuggestions(
      Array.isArray(value.suggestions) ? value.suggestions.filter(isUsableSuggestion) : [],
      now,
    ),
    seenPosts: pruneSeenPosts(
      isRecord(value.seenPosts)
        ? Object.fromEntries(
            Object.entries(value.seenPosts).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "",
            ),
          )
        : {},
      now,
    ),
    observers: migrateObservers(value.observers),
    gcal: migrateGcal((value as Record<string, unknown>)["gcal"]),
    setAsideCourses: Array.isArray(value.setAsideCourses)
      ? value.setAsideCourses.filter(
          (entry): entry is StoreV1Plus["setAsideCourses"][number] =>
            isRecord(entry) && typeof entry["id"] === "string" && typeof entry["name"] === "string",
        )
      : [],
  };
}

/**
 * `hiddenItemIds` held `Item.id`s, which change whenever a group changes. There
 * is no way to map an old id back to member keys, so stored hides are dropped
 * rather than silently applied to the wrong rows — a small, one-time loss in
 * exchange for a hide that then actually sticks.
 */
function migrateOverrides(stored: unknown): Overrides {
  const base: Overrides = {
    mergeGroups: [],
    splitKeys: [],
    hiddenKeys: [],
    disabledCourses: [],
    doneKeys: [],
    keptCourses: [],
    courseNames: {},
    dueOverrides: {},
  };
  if (!stored || typeof stored !== "object") return base;
  const value = stored as Record<string, unknown>;
  const strings = (input: unknown): string[] =>
    Array.isArray(input) ? input.filter((v): v is string => typeof v === "string") : [];

  return {
    mergeGroups: Array.isArray(value["mergeGroups"])
      ? (value["mergeGroups"] as unknown[]).map(strings).filter((g) => g.length >= 2)
      : [],
    splitKeys: strings(value["splitKeys"]),
    hiddenKeys: strings(value["hiddenKeys"]),
    disabledCourses: strings(value["disabledCourses"]),
    // Absent in stores written before the tick-off existed, which is why every
    // field here is filled in rather than switched on `schemaVersion`.
    doneKeys: strings(value["doneKeys"]),
    keptCourses: strings(value["keptCourses"]),
    /*
     * Validated entry by entry, not trusted wholesale.
     *
     * This is the first override that stores *text the user typed*, and it is
     * rendered into the calendar, the filter strip and Settings. Parser rule 5
     * applies to the store as much as to a page: `typeof x === "string"` passes
     * an empty string, and an empty name would blank a course's label
     * everywhere at once with nothing to click to get it back. Length is capped
     * for the same reason a chip is — a 4000-character name is not a name.
     */
    courseNames: isRecord(value["courseNames"])
      ? Object.fromEntries(
          Object.entries(value["courseNames"]).filter(
            (entry): entry is [string, string] =>
              typeof entry[1] === "string" &&
              entry[1].trim().length > 0 &&
              entry[1].length <= 60 &&
              entry[0].length <= 200,
          ),
        )
      : {},
    /*
     * Validated entry by entry like `courseNames`, and with a harder bar.
     *
     * This is the only override that carries an *instant*, and `buildItem`
     * treats it as a stated one — the thing §5.3 ranks above everything else.
     * A `""` that passed a `typeof` check would reach `Date.parse` as a
     * deadline of some kind, so `at` is checked with the project's anchored
     * `isInstant` (house rule 5) and an entry that fails is dropped rather than
     * left to become a row with no date and no explanation.
     */
    dueOverrides: isRecord(value["dueOverrides"])
      ? Object.fromEntries(
          Object.entries(value["dueOverrides"]).filter(
            (entry): entry is [string, DueOverride] => isUsableDueOverride(entry[1]),
          ),
        )
      : {},
  };
}

function isUsableDueOverride(value: unknown): value is DueOverride {
  if (!isRecord(value)) return false;
  if (!isInstant(value["at"] as string)) return false;
  if (value["from"] !== undefined && !isInstant(value["from"] as string)) return false;
  const text = (key: string) => typeof value[key] === "string" && (value[key] as string) !== "";
  return text("reason") && text("postId") && text("appliedAt");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function loadStore(): Promise<StoreV1Plus> {
  const blob = await chrome.storage.local.get(STORAGE_KEY);
  return migrate(blob?.[STORAGE_KEY]);
}

export async function saveStore(store: StoreV1Plus): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

/* -------------------------------------------------------------------------- */
/* §6 backoff                                                                  */
/* -------------------------------------------------------------------------- */

/** §6: 30 min → 1 h → 2 h → 4 h cap, reset on success. */
const BACKOFF_MINUTES = [30, 60, 120, 240];

export function backoffMinutes(consecutiveFailures: number): number {
  const index = Math.min(Math.max(consecutiveFailures, 1), BACKOFF_MINUTES.length) - 1;
  return BACKOFF_MINUTES[index]!;
}

export function nextAttemptAt(consecutiveFailures: number, now: string): string {
  return new Date(Date.parse(now) + backoffMinutes(consecutiveFailures) * 60_000).toISOString();
}

/**
 * The sources whose §6 backoff a new build should lift.
 *
 * §11's mitigation for a Gradescope or PrairieLearn redesign is "fix fast with
 * a store update", but `onInstalled` fires `sync("install")` and `runSync`
 * honours the backoff for every trigger except a manual one — so a source
 * resting on the 240-minute rung stayed red for up to four hours after the fix
 * that repaired it had already been installed. During a beta week, when fixes
 * ship daily, that is most of the day.
 *
 * `needs_login` is deliberately left resting: no code change can log a student
 * in, and pressing "Sync now" after logging in already bypasses the ladder.
 */
export function sourcesToRetryAfterUpdate(store: StoreV1Plus): Source[] {
  return ALL_SOURCES.filter((source) => {
    const status = store.sources[source];
    if (!status?.enabled) return false;
    if (store.backoffUntil[source] === undefined) return false;
    return status.state === "parse_error" || status.state === "network_error";
  });
}

export function inBackoff(store: StoreV1Plus, source: Source, now: string): boolean {
  const until = store.backoffUntil[source];
  return until !== undefined && Date.parse(until) > Date.parse(now);
}

/* -------------------------------------------------------------------------- */
/* §4.5 local adapters                                                         */
/* -------------------------------------------------------------------------- */

/*
 * "Add a course site" and "remove it", as two decisions a test can reach
 * (worker rule 1).
 *
 * They lived inline in `background.ts`'s `add-local-adapter` and
 * `remove-local-adapter` handlers — the one file the suite cannot reach — and
 * both mutated the copy `loadStore()` hands back and then returned without
 * calling `saveStore`. `chrome.storage.local.get` returns a fresh object, so the
 * write went nowhere: a course site the student added survived exactly as long
 * as the service worker did, and vanished at the next wake with nothing failing
 * and nothing logged.
 */

/** Adds an adapter to the local list, replacing any earlier entry with its id. */
export function withLocalAdapter(store: StoreV1Plus, adapter: Adapter): StoreV1Plus {
  return {
    ...store,
    localAdapters: [
      ...store.localAdapters.filter((existing) => existing.id !== adapter.id),
      adapter,
    ],
  };
}

/**
 * Removes an adapter, and everything that referred to it.
 *
 * `enabledAdapters` goes with it: an id left enabled for an adapter that no
 * longer exists is a fetch the runner can never satisfy. And the `site` source
 * follows the count, because a source reporting `ok` while fetching nothing is
 * worker rule 2's green dot that means "I did not fetch".
 */
export function withoutLocalAdapter(store: StoreV1Plus, adapterId: string): StoreV1Plus {
  const enabledAdapters = store.enabledAdapters.filter((id) => id !== adapterId);
  return {
    ...store,
    localAdapters: store.localAdapters.filter((a) => a.id !== adapterId),
    enabledAdapters,
    sources: {
      ...store.sources,
      site: {
        ...store.sources.site,
        enabled: enabledAdapters.length > 0,
        state: enabledAdapters.length > 0 ? store.sources.site.state : "disabled",
      },
    },
  };
}

/**
 * Storage (§3, §5.4).
 *
 * Everything lives in `chrome.storage.local` (§0 decision 1). This module owns
 * the schema, its defaults, and its migrations, so no other module has to guess
 * what a partially-written store looks like.
 */

import type {
  Adapter,
  Item,
  Overrides,
  RawItem,
  Settings,
  Source,
  SourceStatus,
  StoreV1,
} from "../sources/types.js";
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
];

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
    enabled: source !== "site" && source !== "smartphysics",
    // Not `ok`. Nothing has been fetched yet, and a state field that claims
    // success before the first request is the fresh-install green dot — worker
    // house rule 2. `core/health.ts` renders this grey and says "not checked".
    state: source === "site" || source === "smartphysics" ? "disabled" : "pending",
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
    overrides: { mergeGroups: [], splitKeys: [], hiddenKeys: [], disabledCourses: [], doneKeys: [], keptCourses: [] },
    settings: { ...DEFAULT_SETTINGS },
    registry: { adapters: [] },
    misses: {},
    backoffUntil: {},
    enabledAdapters: [],
    localAdapters: [],
    setAsideCourses: [],
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
  return text("source") && text("sourceId") && text("title") && text("url") && text("fetchedAt");
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

export function migrate(stored: unknown): StoreV1Plus {
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
  };
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

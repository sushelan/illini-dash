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

export const SCHEMA_VERSION = 1 as const;
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
const STORAGE_KEY = "illiniDue";

export const ALL_SOURCES: Source[] = [
  "canvas",
  "gradescope",
  "prairielearn",
  "prairietest",
  "site",
];

/** §3: leadTimes both, quiet hours 23–8, hide submitted, poll 30 (min 15). */
export const DEFAULT_SETTINGS: Settings = {
  leadTimes: ["24h", "2h"],
  quietHours: { start: 23, end: 8 },
  hideSubmitted: true,
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
}

function defaultStatus(source: Source): SourceStatus {
  return {
    source,
    // §4.5: site adapters are off until the user enables one and grants the
    // host permission, so this source starts disabled while the rest do not.
    enabled: source !== "site",
    // Not `ok`. Nothing has been fetched yet, and a state field that claims
    // success before the first request is the fresh-install green dot — worker
    // house rule 2. `core/health.ts` renders this grey and says "not checked".
    state: source === "site" ? "disabled" : "pending",
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
    overrides: { mergeGroups: [], splitKeys: [], hiddenKeys: [], disabledCourses: [] },
    settings: { ...DEFAULT_SETTINGS },
    registry: { adapters: [] },
    misses: {},
    backoffUntil: {},
    enabledAdapters: [],
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
export function migrate(stored: unknown): StoreV1Plus {
  const base = emptyStore();
  if (!stored || typeof stored !== "object") return base;
  const value = stored as Partial<StoreV1Plus>;

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
  settings.quietHours = normalizeQuietHours(settings.quietHours);

  return {
    schemaVersion: SCHEMA_VERSION,
    raw: isRecord(value.raw) ? (value.raw as Record<string, RawItem>) : {},
    items: Array.isArray(value.items) ? (value.items as Item[]) : [],
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

export function inBackoff(store: StoreV1Plus, source: Source, now: string): boolean {
  const until = store.backoffUntil[source];
  return until !== undefined && Date.parse(until) > Date.parse(now);
}

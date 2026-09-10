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

export interface StoreV1Plus extends StoreV1 {
  /** §5.4: consecutive syncs in which an undated raw item was not seen. */
  misses: Record<string, number>;
  lastSyncAt?: string;
  /** Per-source earliest next attempt, from §6's backoff ladder. */
  backoffUntil: Partial<Record<Source, string>>;
}

function defaultStatus(source: Source): SourceStatus {
  return {
    source,
    // §4.5: site adapters are off until the user enables one and grants the
    // host permission, so this source starts disabled while the rest do not.
    enabled: source !== "site",
    state: source === "site" ? "disabled" : "ok",
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
    overrides: { mergeGroups: [], splitKeys: [], hiddenItemIds: [], disabledCourses: [] },
    settings: { ...DEFAULT_SETTINGS },
    registry: { adapters: [] },
    misses: {},
    backoffUntil: {},
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

  return {
    schemaVersion: SCHEMA_VERSION,
    raw: isRecord(value.raw) ? (value.raw as Record<string, RawItem>) : {},
    items: Array.isArray(value.items) ? (value.items as Item[]) : [],
    sources,
    overrides: { ...base.overrides, ...(value.overrides ?? {}) } as Overrides,
    settings,
    registry: {
      fetchedAt: value.registry?.fetchedAt,
      adapters: Array.isArray(value.registry?.adapters)
        ? (value.registry!.adapters as Adapter[])
        : [],
    },
    misses: isRecord(value.misses) ? (value.misses as Record<string, number>) : {},
    lastSyncAt: typeof value.lastSyncAt === "string" ? value.lastSyncAt : undefined,
    backoffUntil: isRecord(value.backoffUntil) ? value.backoffUntil : {},
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

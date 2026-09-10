/**
 * A diagnostics bundle a beta tester can paste, with nothing of theirs in it.
 *
 * The scarce resource in this project is Sushi's time in a browser, and with
 * ten testers every "it shows nothing" becomes three messages of back-and-forth
 * about which source is red and whether anything was fetched at all. The two
 * things that existed instead were "Export JSON" — the whole store, every
 * assignment title and Canvas course id — and the health dot's tooltip, which
 * the tester has to read out.
 *
 * The rule here is that a bundle is safe to paste into a public GitHub issue.
 * That means **counts and states, never content**: no titles, no URLs beyond a
 * host, no ids that identify a person. Course codes stay, because `CS357` is
 * the catalog's name for a course and not a fact about the student — and
 * without them "one course contributes nothing" is unactionable.
 */

import { summarize } from "./health.js";
import { groupItems } from "./grouping.js";
import type { Settings, Source, SourceStatus } from "../sources/types.js";
import type { StoreV1Plus } from "./store.js";

export interface DiagnosticsInput {
  store: StoreV1Plus;
  buildId: string;
  extensionVersion: string;
  /** `navigator.userAgent`, trimmed to the Chrome version by the caller. */
  browser: string;
  /** Origins currently granted, from `chrome.permissions.getAll`. */
  grantedOrigins: string[];
  /** Alarm names currently armed, from `chrome.alarms.getAll`. */
  alarms: string[];
  /** Whether Chrome is dropping this extension's notifications. */
  notificationsBlocked: boolean;
  now: Date;
}

export interface SourceDiagnostics {
  source: Source;
  enabled: boolean;
  state: string;
  items: number;
  consecutiveFailures: number;
  hoursSinceSuccess?: number;
  /** Shape of the last error, with anything page-derived removed. */
  lastError?: string;
}

export interface Diagnostics {
  buildId: string;
  extensionVersion: string;
  browser: string;
  generatedAt: string;
  notificationsBlocked: boolean;
  sources: SourceDiagnostics[];
  /** How many sources are ok, out of those actually being checked. */
  health: string;
  /** Per course: which sources contributed, and how many dated items each did. */
  courses: { course: string; bySource: Record<string, number>; dated: number }[];
  sections: Record<string, number>;
  totals: { raw: number; items: number; hidden: number; done: number; undated: number };
  overrides: { merges: number; splits: number; hidden: number; done: number; disabledCourses: number };
  settings: Settings;
  registry: { adapters: number; enabled: string[]; fetchedAt?: string; attemptedAt?: string };
  grantedOrigins: string[];
  alarms: { total: number; byLead: Record<string, number> };
  lastSyncAt?: string;
}

/**
 * Keeps the shape of an error and drops anything it quoted from a page.
 *
 * `NeedsLogin` deliberately carries 120 characters of the response body as
 * evidence, which is the right call for the console and the wrong one for a
 * public issue: on a logged-in page those characters can be a name.
 */
export function scrubError(message: string | undefined): string | undefined {
  if (!message) return undefined;
  return (
    message
      // The body snippet NeedsLogin appends after an em dash.
      .replace(/\s+—\s+.*$/s, " — <body omitted>")
      // Any URL becomes its origin: the path can carry course and student ids.
      .replace(/https?:\/\/([^\s/]+)\S*/g, "$1/…")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200)
  );
}

function hoursSince(iso: string | undefined, now: Date): number | undefined {
  if (!iso) return undefined;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return undefined;
  return Math.round(((now.getTime() - at) / 3_600_000) * 10) / 10;
}

export function buildDiagnostics(input: DiagnosticsInput): Diagnostics {
  const { store, now } = input;
  const summary = summarize(store.sources);

  const itemsBySource = new Map<Source, number>();
  for (const key of Object.keys(store.raw)) {
    const source = key.slice(0, key.indexOf(":")) as Source;
    itemsBySource.set(source, (itemsBySource.get(source) ?? 0) + 1);
  }

  const sources: SourceDiagnostics[] = Object.values(store.sources).map(
    (status: SourceStatus) => ({
      source: status.source,
      enabled: status.enabled,
      state: status.state,
      items: itemsBySource.get(status.source) ?? 0,
      consecutiveFailures: status.consecutiveFailures,
      hoursSinceSuccess: hoursSince(status.lastSuccessAt, now),
      lastError: scrubError(status.lastError),
    }),
  );

  // Per course, per source. This is the table that answers "why does my list
  // look empty" without anyone reading out a single assignment title: a course
  // that only one source knows about, or one where Canvas contributes zero
  // dated rows, is visible at a glance.
  const byCourse = new Map<string, { bySource: Record<string, number>; dated: number }>();
  for (const item of Object.values(store.raw)) {
    const course = item.courseCode ?? item.courseRaw.slice(0, 12) ?? "(unknown)";
    const entry = byCourse.get(course) ?? { bySource: {}, dated: 0 };
    entry.bySource[item.source] = (entry.bySource[item.source] ?? 0) + 1;
    if (item.dueAt !== undefined || item.lateDueAt !== undefined) entry.dated += 1;
    byCourse.set(course, entry);
  }

  const sections: Record<string, number> = {};
  for (const section of groupItems(store.items, now, store.settings)) {
    sections[section.name] = section.items.length;
  }

  const byLead: Record<string, number> = {};
  for (const name of input.alarms) {
    const lead = name.startsWith("notify:") ? (name.split(":").pop() ?? "?") : name;
    byLead[lead] = (byLead[lead] ?? 0) + 1;
  }

  return {
    buildId: input.buildId,
    extensionVersion: input.extensionVersion,
    browser: input.browser,
    generatedAt: now.toISOString(),
    notificationsBlocked: input.notificationsBlocked,
    sources,
    health: `${summary.ok.length}/${summary.checkable.length} ok`,
    courses: [...byCourse.entries()]
      .map(([course, entry]) => ({ course, ...entry }))
      .sort((a, b) => a.course.localeCompare(b.course)),
    sections,
    totals: {
      raw: Object.keys(store.raw).length,
      items: store.items.length,
      hidden: store.items.filter((item) => item.hidden).length,
      done: store.items.filter((item) => item.done).length,
      undated: store.items.filter(
        (item) => item.dueAt === undefined && item.lateDueAt === undefined,
      ).length,
    },
    overrides: {
      merges: store.overrides.mergeGroups.length,
      splits: store.overrides.splitKeys.length,
      hidden: store.overrides.hiddenKeys.length,
      done: store.overrides.doneKeys.length,
      disabledCourses: store.overrides.disabledCourses.length,
    },
    settings: store.settings,
    registry: {
      adapters: store.registry.adapters.length,
      enabled: [...store.enabledAdapters],
      fetchedAt: store.registry.fetchedAt,
      attemptedAt: store.registry.attemptedAt,
    },
    grantedOrigins: [...input.grantedOrigins].sort(),
    alarms: { total: input.alarms.length, byLead },
    lastSyncAt: store.lastSyncAt,
  };
}

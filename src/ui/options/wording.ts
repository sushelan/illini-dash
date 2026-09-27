/**
 * Two sentences at the top of Settings that were saying things in a dialect
 * the rest of the page does not speak.
 *
 * - The line under the title came from `healthPill` — "All 5 OK", "2 sites look
 *   different" — directly above chips reading "Connected" and "Couldn't read"
 *   about the same sources (copy-audit #7). The popup stopped drawing that pill
 *   on 2026-09-19, so the reason it was chosen ("so the two surfaces cannot
 *   disagree") had quietly become the reason they did. It is composed from
 *   `sourceRows` now, whose `word` is the same `STATE_WORD` every chip on the
 *   page draws.
 * - A worker on an older build produced **two** red banners opening with the
 *   same sentence, the second naming code fields — "missing: setAsideCourses,
 *   gcal" (options-live #7). One banner now, the sections in the student's
 *   words, and the raw evidence on its `title` and under Developer, where a
 *   maintainer looks (worker rule 8 still names what is missing).
 */

import type { SourceRow } from "../../core/health.js";

/**
 * "4 connected · 1 sign in needed · 1 off": one count per chip word, in the
 * order `sourceRows` ranks them (what is wrong first).
 *
 * Every word comes from the row, never from a table of its own here, so the
 * line cannot say a thing about a source that the source's own chip does not.
 */
export function settingsHeadline(rows: readonly SourceRow[]): string {
  if (rows.length === 0) return "No sources yet";
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.word, (counts.get(row.word) ?? 0) + 1);
  return [...counts]
    .map(([word, n]) => `${n} ${word.charAt(0).toLowerCase()}${word.slice(1)}`)
    .join(" · ");
}

/**
 * The sections of Settings a missing field leaves incomplete, in the student's
 * words. Keys are `core/compat.ts`'s field names for `get-options-state`.
 */
export const FIELD_SECTION: Readonly<Record<string, string>> = {
  courses: "Courses",
  courseNames: "course names",
  setAsideCourses: "Older courses",
  hiddenItems: "hidden items",
  doneItems: "ticked-off items",
  sources: "Sources",
  observers: "Piazza and Campuswire",
  "observers.piazza": "Piazza",
  "observers.campuswire": "Campuswire",
  gcal: "Google Calendar",
};

/** Section names for the missing fields, each once, in first-seen order. */
export function sectionsFor(missing: readonly string[]): string[] {
  const out: string[] = [];
  for (const field of missing) {
    const name = FIELD_SECTION[field] ?? "some settings";
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/** What is known about the worker being on another build. */
export interface StaleFacts {
  /** From the ping: this page's build and the worker's, when they differ. */
  builds?: { page: string; worker: string };
  /** From `normalizeOptionsState`: fields the worker's answer lacked. */
  missing?: readonly string[];
}

/** The one banner, or undefined when neither fact is present. */
export function staleWarning(facts: StaleFacts): { text: string; title: string } | undefined {
  const missing = facts.missing ?? [];
  if (facts.builds === undefined && missing.length === 0) return undefined;
  const sections = sectionsFor(missing);
  const list =
    sections.length <= 1
      ? (sections[0] ?? "")
      : `${sections.slice(0, -1).join(", ")} and ${sections[sections.length - 1]!}`;
  const text =
    "Illini Dash was updated, but the background part is still running the old version" +
    (sections.length > 0
      ? `, so ${list} ${sections.length === 1 ? "is" : "are"} missing from this page.`
      : ", so this page may be wrong.") +
    " Open chrome://extensions and click Reload on the Illini Dash card, then reopen this page.";
  const evidence: string[] = [];
  if (facts.builds) {
    evidence.push(`This page is build ${facts.builds.page}; the background part is build ${facts.builds.worker}.`);
  }
  if (missing.length > 0) evidence.push(`Missing from its answer: ${missing.join(", ")}.`);
  return { text, title: evidence.join(" ") };
}

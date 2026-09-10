/**
 * §8.1's sections, as a pure function so the date boundaries are testable.
 *
 * "This week (through Sunday)" and "overdue by ≤ 7 days" are the kind of rule
 * that is quietly wrong for a week at a time, so none of it is computed inline
 * in the renderer.
 */

import type { Item, Settings } from "../sources/types.js";

export type SectionName =
  | "Needs attention"
  | "Today"
  | "Tomorrow"
  | "This week"
  | "Later";

export const SECTION_ORDER: SectionName[] = [
  "Needs attention",
  "Today",
  "Tomorrow",
  "This week",
  "Later",
];

export interface Section {
  name: SectionName;
  items: Item[];
}

/** §8.1: overdue but recent enough to still act on. */
const OVERDUE_WINDOW_DAYS = 7;
/** §8.1: "Later (next 60 days)". */
const HORIZON_DAYS = 60;

/** Local midnight `days` after the day containing `now`. */
function startOfDay(now: Date, days = 0): number {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return d.getTime();
}

/**
 * The instant after the coming Sunday, local.
 *
 * §8.1 says "through Sunday", so a Sunday is the *end* of the current week, not
 * the start of the next one — on Sunday itself the section is empty rather than
 * covering the following seven days.
 */
function endOfWeek(now: Date): number {
  const daysUntilSunday = (7 - now.getDay()) % 7;
  return startOfDay(now, daysUntilSunday + 1);
}

function isDone(item: Item): boolean {
  return item.status === "submitted" || item.status === "graded";
}

export function sectionFor(item: Item, now: Date): SectionName | undefined {
  // §8.1: booking items always lead, because the window closes whether or not
  // the student has looked, and §7 nags daily until it is gone.
  if (item.kind === "booking") return "Needs attention";

  if (item.dueAt === undefined) return undefined;
  const due = Date.parse(item.dueAt);
  if (Number.isNaN(due)) return undefined;

  const today = startOfDay(now);
  if (due < now.getTime()) {
    // Past due. Only unfinished work needs attention, and only for a week.
    if (isDone(item)) return undefined;
    return now.getTime() - due <= OVERDUE_WINDOW_DAYS * 86_400_000
      ? "Needs attention"
      : undefined;
  }

  if (due < startOfDay(now, 1)) return "Today";
  if (due < startOfDay(now, 2)) return "Tomorrow";
  if (due < endOfWeek(now)) return "This week";
  if (due < today + HORIZON_DAYS * 86_400_000) return "Later";
  return undefined;
}

/**
 * §8.1: sections in order, empty ones omitted.
 *
 * `hideSubmitted` never hides an overdue-unsubmitted or booking row, because
 * those are the rows the section exists for.
 */
export function groupItems(items: Item[], now: Date, settings: Settings): Section[] {
  const buckets = new Map<SectionName, Item[]>(SECTION_ORDER.map((name) => [name, []]));

  for (const item of items) {
    if (item.hidden) continue;
    if (settings.hideSubmitted && isDone(item)) continue;
    const section = sectionFor(item, now);
    if (section) buckets.get(section)!.push(item);
  }

  return SECTION_ORDER.map((name) => ({ name, items: buckets.get(name)! })).filter(
    (section) => section.items.length > 0,
  );
}

/** `Thu 11:59 PM · in 2d`, or `2d ago` once past (§8.1's row format). */
export function formatDue(item: Item, now: Date): string {
  if (item.dueAt === undefined) return "no date";
  const due = new Date(item.dueAt);
  if (Number.isNaN(due.getTime())) return "no date";

  const clock = due.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const deltaMs = due.getTime() - now.getTime();
  const past = deltaMs < 0;
  const abs = Math.abs(deltaMs);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor(abs / 60_000);

  const span = days > 0 ? `${days}d` : hours > 0 ? `${hours}h` : `${minutes}m`;
  return `${clock} · ${past ? `${span} ago` : `in ${span}`}`;
}

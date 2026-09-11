/**
 * Where each item sits on a calendar (§8.1, revised).
 *
 * The sectioned list answered one question — what is next — by ordering rows.
 * A calendar answers a different one, what a day or a week looks like, by
 * putting rows in *positions*. Position is a decision, and every decision in
 * this project belongs where the suite can reach it (worker rule 1): the popup
 * is as untestable as `background.ts`.
 *
 * Three facts about this data shape the whole module, and none of them are true
 * of the meeting calendars this borrows its layout from:
 *
 * 1. **Most deadlines land on the same minute.** 11:59 PM is not a time anyone
 *    chose, it is the default, so an hour grid shows sixteen empty hours and a
 *    stack at the bottom. That is worth seeing rather than smoothing away, so
 *    items at the same instant stack rather than overlap.
 * 2. **Some rows have a day and no time**, because a course site printed a bare
 *    date and §4.5's runner filled in 23:59 (worker rule 3). Those must not be
 *    drawn at 11:59 PM, which is the invention wearing a friendly face. They go
 *    in a band above the grid, and the band says once what would otherwise be
 *    repeated on every row.
 * 3. **Some rows cannot be placed at all** — a date that would not parse, work
 *    with no date anywhere, a deadline already past. A grid has no square for
 *    any of them, and dropping them is the silent loss §11 ranks worst, so they
 *    have their own view.
 */

import { isItemDone, isTickedDone, opensAt } from "./dedupe.js";
import { liveDeadline } from "./grouping.js";
import { unreadableDeadline } from "./quality.js";
import type { Item, Settings } from "../sources/types.js";

export type ViewName = "day" | "week" | "month" | "attention";

/** Local midnight for `when`, offset by whole days. */
export function startOfDay(when: Date, days = 0): Date {
  return new Date(when.getFullYear(), when.getMonth(), when.getDate() + days);
}

/**
 * `2026-09-10` in *local* time, as a bucket key.
 *
 * Not `toISOString().slice(0,10)`, which is UTC: a deadline at 11:59 PM local
 * is already tomorrow in UTC for most of the United States, so every late-night
 * deadline — which is nearly all of them — would land on the wrong day.
 */
export function dayKey(when: Date): string {
  const month = String(when.getMonth() + 1).padStart(2, "0");
  const day = String(when.getDate()).padStart(2, "0");
  return `${when.getFullYear()}-${month}-${day}`;
}

/** Minutes from local midnight. */
export function minutesInto(when: Date): number {
  return when.getHours() * 60 + when.getMinutes();
}

/**
 * The instant an item is drawn at, and whether anyone actually stated it.
 *
 * A deadline first, then an opening time for work that has none yet. The flag
 * is what keeps §4.5's filled-in 23:59 off the hour axis.
 */
export interface Anchor {
  at: number;
  /** True when the clock part was invented by us, not stated by the source. */
  assumed: boolean;
  /** True when this is when the work opens, not when it is due. */
  opening: boolean;
}

export function anchorOf(item: Item, now: Date): Anchor | undefined {
  const live = liveDeadline(item, now);
  if (live !== undefined) {
    return { at: live.at, assumed: item.timeAssumed === true, opening: false };
  }
  const opens = opensAt(item);
  // An opening already past says nothing useful: by then the source states a
  // real deadline, or the row has nothing to place.
  if (opens === undefined || opens <= now.getTime()) return undefined;
  return { at: opens, assumed: false, opening: true };
}

/**
 * The items a view should draw at all.
 *
 * The same filter the list used, plus the course strip's. Hidden rows, ticked
 * rows and — when the setting is on — work a source reports finished. Bookings
 * are excluded here because they are not drawn on the grid: they live in the
 * strip above the tabs, where the point is that the window closes whether or
 * not the student has looked.
 */
export function visibleItems(
  items: Item[],
  settings: Settings,
  hiddenCourses: ReadonlySet<string> = new Set(),
): Item[] {
  return items.filter((item) => {
    if (item.hidden) return false;
    if (item.kind === "booking") return false;
    if (isTickedDone(item)) return false;
    if (settings.hideSubmitted && isItemDone(item)) return false;
    return !hiddenCourses.has(item.courseLabel);
  });
}

/** The bookings that belong in the strip above the tabs. */
export function bookings(items: Item[]): Item[] {
  return items.filter((item) => item.kind === "booking" && !item.hidden);
}

/* -------------------------------------------------------------------------- */
/* A day                                                                       */
/* -------------------------------------------------------------------------- */

export interface PlacedItem {
  item: Item;
  anchor: Anchor;
}

export interface DayContents {
  /** Stacks of items that share a slot, earliest first. */
  timed: PlacedItem[][];
  /** A day was stated and a time was not. Drawn in the band, never on the axis. */
  untimed: Item[];
}

/**
 * Items that share a slot are one stack, not overlapping blocks.
 *
 * Meeting calendars put simultaneous events side by side because they compete
 * for you. Deadlines do not: three things due at 11:59 PM is three things to
 * do, and splitting the width into thirds makes all three unreadable while
 * saying nothing true. They stack.
 *
 * The window is coarser than a minute so that 11:00 and 11:05 read as one pile,
 * which is what they are.
 */
const STACK_WINDOW_MINUTES = 20;

export function dayContents(items: Item[], day: Date, now: Date): DayContents {
  const key = dayKey(day);
  const timed: PlacedItem[] = [];
  const untimed: Item[] = [];

  for (const item of items) {
    const anchor = anchorOf(item, now);
    if (anchor === undefined) continue;
    const at = new Date(anchor.at);
    if (dayKey(at) !== key) continue;
    if (anchor.assumed) untimed.push(item);
    else timed.push({ item, anchor });
  }

  timed.sort((a, b) => a.anchor.at - b.anchor.at || a.item.title.localeCompare(b.item.title));

  const stacks: PlacedItem[][] = [];
  for (const placed of timed) {
    const slot = Math.floor(minutesInto(new Date(placed.anchor.at)) / STACK_WINDOW_MINUTES);
    const last = stacks[stacks.length - 1];
    const lastSlot =
      last === undefined
        ? undefined
        : Math.floor(minutesInto(new Date(last[0]!.anchor.at)) / STACK_WINDOW_MINUTES);
    if (last !== undefined && lastSlot === slot) last.push(placed);
    else stacks.push([placed]);
  }

  untimed.sort((a, b) => a.title.localeCompare(b.title));
  return { timed: stacks, untimed };
}

/**
 * The hours the day view draws.
 *
 * Not midnight to midnight: the first eight hours of an academic day hold
 * nothing, and spending a third of the grid on them pushes the 11:59 PM stack —
 * where nearly everything is — below the fold of a 600px popup.
 *
 * It still widens for anything outside those hours rather than hiding it, which
 * is the whole of §11 in one line. A 7:00 AM PrairieTest exam is exactly the
 * kind of row that must not be the one thing off the edge of the grid.
 */
export const DEFAULT_DAY_START = 8;
export const DEFAULT_DAY_END = 24;

export function hourRange(contents: DayContents): { start: number; end: number } {
  let start = DEFAULT_DAY_START;
  for (const stack of contents.timed) {
    const hour = Math.floor(minutesInto(new Date(stack[0]!.anchor.at)) / 60);
    if (hour < start) start = hour;
  }
  // Only the start moves. The end is midnight and an hour index cannot exceed
  // 23, so a matching "widen the end" branch could never fire — it survived
  // every mutation because nothing could reach it.
  return { start, end: DEFAULT_DAY_END };
}

/* -------------------------------------------------------------------------- */
/* A week                                                                      */
/* -------------------------------------------------------------------------- */

/** Sunday through Saturday containing `anchor`, as local midnights. */
export function weekDays(anchor: Date): Date[] {
  const sunday = startOfDay(anchor, -anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => startOfDay(sunday, i));
}

export interface WeekDay {
  date: Date;
  isToday: boolean;
  contents: DayContents;
}

export function weekContents(items: Item[], anchor: Date, now: Date): WeekDay[] {
  const todayKey = dayKey(now);
  return weekDays(anchor).map((date) => ({
    date,
    isToday: dayKey(date) === todayKey,
    contents: dayContents(items, date, now),
  }));
}

/* -------------------------------------------------------------------------- */
/* A month                                                                     */
/* -------------------------------------------------------------------------- */

export interface MonthCell {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  /** Every item on this day, timed and untimed, in the order it is drawn. */
  items: PlacedItem[];
}

/**
 * Whole weeks covering `anchor`'s month, so the grid is rectangular.
 *
 * Days from the neighbouring months are included rather than left blank: a
 * deadline on the 1st of October is what a student looking at late September
 * most needs to see, and an empty corner would hide it.
 */
export function monthCells(items: Item[], anchor: Date, now: Date): MonthCell[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const start = startOfDay(first, -first.getDay());
  const end = startOfDay(last, 6 - last.getDay());
  const todayKey = dayKey(now);

  const cells: MonthCell[] = [];
  for (let at = start; at <= end; at = startOfDay(at, 1)) {
    const contents = dayContents(items, at, now);
    cells.push({
      date: at,
      inMonth: at.getMonth() === anchor.getMonth(),
      isToday: dayKey(at) === todayKey,
      // Untimed last: a stated time is the more useful thing to fit in a cell
      // that only holds three rows.
      items: [
        ...contents.timed.flat(),
        ...contents.untimed.map((item) => ({
          item,
          anchor: { at: Date.parse(item.dueAt ?? ""), assumed: true, opening: false },
        })),
      ],
    });
  }
  return cells;
}

/* -------------------------------------------------------------------------- */
/* Everything a grid cannot place                                              */
/* -------------------------------------------------------------------------- */

export type AttentionName = "Overdue" | "Couldn't read" | "No date at all";

export const ATTENTION_ORDER: AttentionName[] = ["Overdue", "Couldn't read", "No date at all"];

export interface AttentionGroup {
  name: AttentionName;
  items: Item[];
}

/** §8.1's overdue window: a week, after which nothing can be done about it. */
const OVERDUE_WINDOW_DAYS = 7;

/**
 * Why a row has no square, for every row that has none.
 *
 * Each of the three is a different thing gone wrong and a different thing to do
 * about it, so they are separate groups rather than one "other" bucket — and
 * "Couldn't read" in particular is a deadline this extension is hiding, which
 * is not the same as one the student is late for.
 */
export function attentionGroups(items: Item[], now: Date): AttentionGroup[] {
  const buckets = new Map<AttentionName, Item[]>(ATTENTION_ORDER.map((name) => [name, []]));

  for (const item of items) {
    if (unreadableDeadline(item).length > 0) {
      buckets.get("Couldn't read")!.push(item);
      continue;
    }
    const anchor = anchorOf(item, now);
    if (anchor === undefined) {
      // No deadline, no opening time. Canvas's undated shells and a course
      // page's "TBD" row live here; an event that has already happened does
      // not, because it is over rather than outstanding.
      if (item.kind !== "event") buckets.get("No date at all")!.push(item);
      continue;
    }
    // No `!anchor.opening` here: `anchorOf` refuses an opening time that has
    // already passed, so an opening anchor is always ahead of now and can
    // never reach this branch.
    if (anchor.at < now.getTime()) {
      if (item.kind === "event") continue;
      if (now.getTime() - anchor.at <= OVERDUE_WINDOW_DAYS * 86_400_000) {
        buckets.get("Overdue")!.push(item);
      }
    }
  }

  for (const group of buckets.values()) {
    group.sort((a, b) => (anchorOf(b, now)?.at ?? 0) - (anchorOf(a, now)?.at ?? 0));
  }

  return ATTENTION_ORDER.map((name) => ({ name, items: buckets.get(name)! })).filter(
    (group) => group.items.length > 0,
  );
}

/** The number the Attention tab wears. */
export function attentionCount(items: Item[], now: Date): number {
  return attentionGroups(items, now).reduce((total, group) => total + group.items.length, 0);
}

/* -------------------------------------------------------------------------- */
/* Course colour                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Eight hues, chosen to stay apart at a 3px border in both themes.
 *
 * Small on purpose: a generated hue per course drifts into neighbours that are
 * indistinguishable at the size these are actually drawn.
 */
export const COURSE_COLOURS = 8;

/**
 * A colour per course, assigned across the courses that exist.
 *
 * The first attempt hashed the label, which is stable by construction — and
 * collided on the six courses this student actually takes, giving four colours
 * for six courses. A legend with two courses the same colour is worse than no
 * legend, because it silently asserts something false.
 *
 * So the assignment runs over the sorted course list instead, which guarantees
 * distinct colours up to the size of the palette. The cost is real and worth
 * stating: adding a course repaints every course after it alphabetically. That
 * happens about twice a year, and a collision happens every time you look.
 */
export function courseColours(courses: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  courses.forEach((course, index) => map.set(course, index % COURSE_COLOURS));
  return map;
}

/** Every course present, in the order the chips are drawn. */
export function coursesIn(items: Item[]): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    if (item.kind === "booking") continue;
    if (item.courseLabel) seen.add(item.courseLabel);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

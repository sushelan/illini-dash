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

export type ViewName = "day" | "week" | "month" | "exams" | "attention";

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
  now: Date = new Date(),
): Item[] {
  return items.filter((item) => {
    if (item.hidden) return false;
    if (item.kind === "booking") return false;
    if (isFinished(item, settings) && !isPast(item, now)) return false;
    return !hiddenCourses.has(item.courseLabel);
  });
}

function isFinished(item: Item, settings: Settings): boolean {
  if (isTickedDone(item)) return true;
  return settings.hideSubmitted && isItemDone(item);
}

/**
 * Whether the deadline has already gone.
 *
 * The whole reason finished work is hidden is to stop it cluttering what is
 * *ahead*. In a list that was the only direction there was, so the distinction
 * never came up. A calendar has a back arrow, and hiding what you handed in
 * turns last week — a week you know you worked through — into an empty grid,
 * which reads as the extension being broken rather than as you being finished.
 */
function isPast(item: Item, now: Date): boolean {
  const at = anchorOf(item, now);
  return at !== undefined && at.at < now.getTime();
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
  /** Stacks of items that share a slot, earliest first. Excludes end-of-day. */
  timed: PlacedItem[][];
  /**
   * Due at the end of the day rather than at an hour anyone chose.
   *
   * 11:59 PM is a default, not a decision. It means "by Tuesday", and putting
   * it at the bottom of a sixteen-hour axis gave it a precision it does not
   * have *and* pushed it below the fold of a 600px popup — so the commonest
   * deadline there is became the one you had to scroll to find. Hoisted above
   * the grid instead, which is where "by end of today" belongs.
   */
  endOfDay: PlacedItem[];
  /** A day was stated and a time was not. Never on the axis. */
  untimed: Item[];
}

/**
 * From this minute on, a deadline is "end of day" rather than an hour.
 *
 * 11:00 PM rather than 11:59 exactly, because the argument is about position
 * and not about the string: anything this late is both effectively "by end of
 * today" and at the very bottom of the axis. Nothing is lost by hoisting it —
 * the row still shows its own clock, so a real 11:00 PM deadline still reads
 * as 11:00 PM.
 */
export const END_OF_DAY_MINUTES = 23 * 60;

/** Everything with a clock, in order, for views that have no hour axis. */
export function allTimed(contents: DayContents): PlacedItem[] {
  return [...contents.timed.flat(), ...contents.endOfDay];
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

/**
 * A hidden row is hidden, whoever is asking.
 *
 * `visibleItems` filters `hidden` and the popup pipes everything through it, so
 * every view is correct today — by convention, not by construction. Audited
 * 2026-09-12 after a report that hiding "doesn't work on the calendar":
 * `dayContents`, `weekContents`, `monthCells` and `attentionGroups` all leave
 * the flag to their caller, and each one returns the hidden row happily if
 * handed an unfiltered list.
 *
 * That did not turn out to be the reported bug. It is still worth closing,
 * because of *how* it fails: silently, in one view, with the student looking at
 * a thing they have already told the extension to remove. A caller that forgets
 * gets no error — and §5.3's grouping, §7's reminders and the toolbar badge
 * each filter it for themselves for exactly this reason.
 *
 * The cost is one extra predicate on a list that is usually already filtered.
 */
function notHidden(items: Item[]): Item[] {
  return items.filter((item) => !item.hidden);
}

export function dayContents(rawItems: Item[], day: Date, now: Date): DayContents {
  const items = notHidden(rawItems);
  const key = dayKey(day);
  const timed: PlacedItem[] = [];
  const untimed: Item[] = [];

  const endOfDay: PlacedItem[] = [];

  for (const item of items) {
    const anchor = anchorOf(item, now);
    if (anchor === undefined) continue;
    const at = new Date(anchor.at);
    if (dayKey(at) !== key) continue;
    if (anchor.assumed) untimed.push(item);
    else if (minutesInto(at) >= END_OF_DAY_MINUTES) endOfDay.push({ item, anchor });
    else timed.push({ item, anchor });
  }

  const byTime = (a: PlacedItem, b: PlacedItem) =>
    a.anchor.at - b.anchor.at || a.item.title.localeCompare(b.item.title);
  timed.sort(byTime);
  endOfDay.sort(byTime);

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
  return { timed: stacks, endOfDay, untimed };
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
/**
 * The axis runs to the evening, not to midnight.
 *
 * It ended at midnight when end-of-day deadlines were drawn on it. They are
 * hoisted above the grid now, so the last five hours were empty ruled lines
 * whose only effect was to push everything below them out of a 600px popup.
 */
export const DEFAULT_DAY_END = 18;

export function hourRange(contents: DayContents): { start: number; end: number } {
  let start = DEFAULT_DAY_START;
  let end = DEFAULT_DAY_END;
  for (const stack of contents.timed) {
    const hour = Math.floor(minutesInto(new Date(stack[0]!.anchor.at)) / 60);
    if (hour < start) start = hour;
    // The hour *after* the item, so it is drawn inside the grid rather than on
    // its bottom border.
    if (hour + 1 > end) end = hour + 1;
  }
  return { start, end };
}

/* -------------------------------------------------------------------------- */
/* A day, as an agenda                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The same day, without an hour axis.
 *
 * The axis is the right shape for a calendar of *meetings*, where position
 * answers "how long until it, and what is next to it". Deadlines are not shaped
 * like that: fact 1 at the top of this file is that most of them land on the
 * same minute, so the axis spends its height on hours with nothing in them and
 * then stacks everything on one line at the bottom.
 *
 * Measured on a real day: a 9 AM checkpoint and a 9 PM exam produce eleven
 * empty ruled hours between them — about 290px, in a window that is 600px tall
 * and has already spent 215 of them on chrome. The exam ends up below the fold.
 * An agenda spends one row per item and nothing per empty hour.
 *
 * The grid stays in the full view, where the height exists and the position
 * genuinely helps.
 */
export type AgendaRow =
  | { kind: "heading"; text: string; note?: string }
  | { kind: "item"; placed: PlacedItem }
  /** A day with no time stated. Never drawn at 11:59 PM — that is our invention. */
  | { kind: "untimed"; item: Item }
  | { kind: "now" };

/** Said once above the rows it applies to, rather than on each of them. */
export const UNTIMED_HEADING = "Time not posted";
export const END_OF_DAY_HEADING = "By end of day";

export function agendaRows(contents: DayContents, now: Date, isToday: boolean): AgendaRow[] {
  const rows: AgendaRow[] = [];

  // Riskiest first. An invented time can hide a 5 PM cutoff; a stated 11:59 PM
  // cannot — the same reason "Couldn't read" leads the Attention tab.
  if (contents.untimed.length > 0) {
    rows.push({ kind: "heading", text: UNTIMED_HEADING });
    for (const item of contents.untimed) rows.push({ kind: "untimed", item });
  }

  const timed = contents.timed.flat();

  /*
   * Where "now" goes, and when it is worth drawing at all.
   *
   * Only on today, and only when it actually separates two rows. A rule at the
   * very top says the same thing as "nothing has passed yet", which the empty
   * space above the first row already says; a rule at the very bottom says the
   * day is over, which the absence of anything below it already says. In both
   * of those it is a line that costs a row and carries no information.
   *
   * End-of-day rows count as rows it can sit above: at 11:30 PM the marker
   * belongs between the timed list and the 11:59 pile, not before both.
   */
  const ordered = [...timed, ...contents.endOfDay];
  const firstAhead = ordered.findIndex((placed) => placed.anchor.at >= now.getTime());
  // `> 0` drops the all-ahead case and `findIndex`'s -1 drops the all-past one.
  const marker = isToday && firstAhead > 0 ? firstAhead : -1;

  let index = 0;
  let markerDrawn = false;
  const markHere = () => {
    if (markerDrawn || index !== marker) return;
    rows.push({ kind: "now" });
    markerDrawn = true;
  };

  for (const placed of timed) {
    markHere();
    rows.push({ kind: "item", placed });
    index += 1;
  }

  if (contents.endOfDay.length > 0) {
    // Before the heading rather than after it, when the marker lands exactly
    // between the two groups: "now" should separate rows, not separate a group
    // from its own label.
    markHere();
    rows.push({ kind: "heading", text: END_OF_DAY_HEADING });
    for (const placed of contents.endOfDay) {
      markHere();
      rows.push({ kind: "item", placed });
      index += 1;
    }
  }

  return rows;
}

/* -------------------------------------------------------------------------- */
/* A week                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Which seven days a "week" is.
 *
 * Two answers, and which one is right depends on the window rather than on
 * taste. In a tab there is room for a calendar week, and Sunday–Saturday is
 * what a calendar means by "week" — the columns line up with every other
 * calendar the student has ever seen.
 *
 * In a 400px popup it is the wrong seven days on five days out of seven. On a
 * Friday, Sunday–Saturday puts five days that have already happened — two
 * struck through, three reading "—" — above the only row anyone can still act
 * on, and today ends up the last thing on screen. `rolling` starts at today, so
 * the first row is always the one being asked about.
 */
export type WeekMode = "rolling" | "sunday";

export function weekDays(anchor: Date, mode: WeekMode = "sunday"): Date[] {
  const first = mode === "rolling" ? startOfDay(anchor) : startOfDay(anchor, -anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => startOfDay(first, i));
}

export interface WeekDay {
  date: Date;
  isToday: boolean;
  contents: DayContents;
}

export function weekContents(
  items: Item[],
  anchor: Date,
  now: Date,
  mode: WeekMode = "sunday",
): WeekDay[] {
  const todayKey = dayKey(now);
  return weekDays(anchor, mode).map((date) => ({
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
        ...allTimed(contents),
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

/**
 * The groups that are actually asking for something.
 *
 * "No date at all" is not one of them, and putting it in the tab's count was
 * wrong. Overdue work is late and unreadable dates may be hiding a deadline —
 * both are things to do. A row a source listed with no date anywhere on it asks
 * for nothing: often there is nothing to do, because it is an ungraded survey,
 * a Canvas shell, or an assessment whose instructor has not set a date yet.
 *
 * It is also the only group that never empties. Overdue work ages out after a
 * week and an unreadable date gets fixed in a build, but undated rows
 * accumulate all semester — so a badge that counts them creeps upward forever
 * and stops meaning anything. That is worker rule 2's principle applied to a
 * number instead of a dot: what the UI asserts has to be true.
 *
 * They stay *visible*, because a row a source listed and this extension then
 * dropped is the silent loss §11 ranks worst. Last, quiet, and uncounted.
 */
export const ATTENTION_ACTIONABLE: AttentionName[] = ["Overdue", "Couldn't read"];

export function isActionable(name: AttentionName): boolean {
  return ATTENTION_ACTIONABLE.includes(name);
}

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
export function attentionGroups(rawItems: Item[], now: Date): AttentionGroup[] {
  const buckets = new Map<AttentionName, Item[]>(ATTENTION_ORDER.map((name) => [name, []]));

  for (const item of notHidden(rawItems)) {
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
      // An exam that has been sat cannot be handed in late.
      //
      // "Overdue" means work whose window has closed and which you still owe.
      // An exam has no submission, so `isItemDone` can never become true for
      // one — which is exactly why it fell through to here and sat in Overdue
      // for a week. The Exams tab already calls the same row "Just sat", so
      // the two tabs contradicted each other about the same exam, and the one
      // in red was the wrong one.
      if (item.kind === "exam") continue;
      // Handed in. It is in the past and it is on the grid, but it is not
      // asking for anything — and it only reaches here at all because past
      // work stopped being filtered out of the views.
      if (isItemDone(item) || isTickedDone(item)) continue;
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

/**
 * The number the Attention tab wears.
 *
 * Only the groups asking for something. A tab reading 11 when one deadline is
 * actually late is a tab nobody reads twice.
 */
export function attentionCount(items: Item[], now: Date): number {
  return attentionGroups(items, now)
    .filter((group) => isActionable(group.name))
    .reduce((total, group) => total + group.items.length, 0);
}

/* -------------------------------------------------------------------------- */
/* Exams                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Everything you have to turn up to, on one screen.
 *
 * `exam` and `booking` and nothing else. That is not a stylistic line — it is
 * the one the sources already draw: §4.4 maps a PrairieTest reservation to
 * `exam` and an unbooked window to `booking`, and §4.1 promotes a Canvas
 * calendar event whose title says exam, midterm or final. Everything else a
 * student calls a quiz is work done from a laptop whenever, and including it
 * would refill this tab with most of PrairieLearn — the same dilution that made
 * Attention read 11 when one thing was late.
 *
 * **No horizon.** Every other view stops at 60 days, which is right for
 * homework and wrong for the one thing that is always further out than that: in
 * September a December final is invisible, and it is the deadline a student most
 * wants a month's warning about.
 */
export interface ExamBoard {
  /**
   * A booking window still open that nobody has used.
   *
   * The only thing here asking for something. §7 nags daily about these because
   * the window closes whether or not the student has looked.
   */
  unbooked: Item[];
  /** Booked or scheduled, soonest first. */
  upcoming: PlacedItem[];
  /** Sat in the last week, so a student can tell "done" from "never existed". */
  recent: PlacedItem[];
}

/** §5.4's window, reused: after a week there is nothing to say about an exam. */
const RECENT_EXAM_DAYS = 7;

function bookingWindowEnd(item: Item): number | undefined {
  for (const member of item.members) {
    const raw = member.extra?.["windowEnd"];
    if (raw === undefined) continue;
    const at = Date.parse(raw);
    if (!Number.isNaN(at)) return at;
  }
  return undefined;
}

export function examBoard(items: Item[], now: Date): ExamBoard {
  const unbooked: Item[] = [];
  const upcoming: PlacedItem[] = [];
  const recent: PlacedItem[] = [];

  for (const item of items) {
    if (item.hidden) continue;

    if (item.kind === "booking") {
      // A window that has closed is not a thing to book. It is also not worth
      // shouting about: the exam either happened or the student missed it, and
      // either way the source stops producing the row.
      const end = bookingWindowEnd(item);
      if (end === undefined || end > now.getTime()) unbooked.push(item);
      continue;
    }
    if (item.kind !== "exam") continue;

    const anchor = anchorOf(item, now);
    if (anchor === undefined) continue;
    if (anchor.at >= now.getTime()) upcoming.push({ item, anchor });
    else if (now.getTime() - anchor.at <= RECENT_EXAM_DAYS * 86_400_000) {
      recent.push({ item, anchor });
    }
  }

  const soonest = (a: PlacedItem, b: PlacedItem) => a.anchor.at - b.anchor.at;
  upcoming.sort(soonest);
  // Most recent first: the one you just sat is the one you are asking about.
  recent.sort((a, b) => b.anchor.at - a.anchor.at);
  unbooked.sort((a, b) => (bookingWindowEnd(a) ?? 0) - (bookingWindowEnd(b) ?? 0));

  return { unbooked, upcoming, recent };
}

/**
 * The number the Exams tab wears.
 *
 * Unbooked only. An exam you have already booked is not asking for anything,
 * and a badge that counts every exam in the term reads as a permanent alarm —
 * the same reason "No date at all" left the Attention count.
 */
export function examCount(items: Item[], now: Date): number {
  return examBoard(items, now).unbooked.length;
}

/* -------------------------------------------------------------------------- */
/* What a row is, in one word                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The state a drawn item is in, for whatever is drawing it.
 *
 * This lived inline in the popup's `renderRow` and nowhere else, so the month
 * grid — which draws pills rather than rows — knew none of it. Completed work
 * appeared there looking exactly like work still owed, and so did overdue work.
 * That was invisible until finished items started showing up on the calendar at
 * all; before that the month simply had nothing to get wrong.
 *
 * One function, because it is one decision, and the two surfaces disagreeing
 * about whether a deadline is done is the kind of thing nobody notices for a
 * month.
 */
export type ItemTone = "booking" | "done" | "event" | "overdue" | "late" | "open";

export function itemTone(item: Item, now: Date): ItemTone {
  // A booking is a window, not a deadline: it is never overdue and never done,
  // because there is nothing to hand in (§4.4).
  if (item.kind === "booking") return "booking";
  // Before `event`, because a Canvas event a student has somehow marked done is
  // still done. And before the deadline checks, because finished work is not
  // overdue however long ago it was due.
  if (isItemDone(item) || isTickedDone(item)) return "done";
  // An event is something that happens, not something owed, so it can never be
  // overdue — it is over.
  if (item.kind === "event") return "event";

  const live = liveDeadline(item, now);
  if (live === undefined) return "open";
  // Overdue red is for work that can no longer be handed in. A row whose full
  // credit has gone but whose late window is still open is amber: it is late,
  // not lost, and painting it red tells a student to give up on something
  // Gradescope is still accepting.
  if (live.at < now.getTime()) return "overdue";
  return live.late ? "late" : "open";
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

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

/**
 * The five tabs (brief D1).
 *
 * `"attention"` is gone as a *tab*, not as a set of rules. The groups it drew
 * were three different things wearing one name: overdue work, which is the
 * most urgent thing on the screen and now rides in the header pill; rows whose
 * date could not be read; and rows no source ever dated. The last two are the
 * same problem from the student's side — "this exists and I do not know when" —
 * and they get the `nodate` tab, which is the only place "Give it a date" makes
 * sense.
 *
 * A stored `"attention"` is not in this union, so the popup's `VIEWS.includes`
 * check falls it back to `day` without a migration.
 */
export type ViewName = "day" | "week" | "month" | "nodate" | "exams";

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
 * Hidden rows and rows whose course is switched off, always. Bookings are
 * excluded here because they are not drawn on the grid: they live in the strip
 * above the tabs, where the point is that the window closes whether or not the
 * student has looked.
 *
 * **Finished work is drawn, struck through.** It used to be dropped — finished
 * and not yet past — which is right for a *list* of what is next and wrong for
 * a calendar, where a square with nothing in it asserts that nothing was due. A
 * beta report put it plainly: "completed assignments from PrairieLearn don't
 * show up in the calendar". And because the test was a clock comparison, work
 * handed in at 2pm and due at 11:59pm vanished from today and reappeared at
 * midnight, while a finished undated row vanished for good.
 *
 * Sushi's decision, 2026-09-18: "Show it struck through, including hand-ticked
 * rows." So the drop is an opt-in the calendar never asks for, and the surfaces
 * that answer "what do I still owe" — the Attention tab, the toolbar badge
 * (`grouping.ts`), §7's reminders (`schedule.ts`) — keep asking for it.
 */
export interface VisibleOptions {
  /**
   * Drop work that is finished and not yet past.
   *
   * Past finished work stays either way: hiding what you handed in turns last
   * week — a week you know you worked through — into an empty grid.
   */
  dropFinished?: boolean;
}

export function visibleItems(
  items: Item[],
  settings: Settings,
  hiddenCourses: ReadonlySet<string> = new Set(),
  now: Date = new Date(),
  options: VisibleOptions = {},
): Item[] {
  return items.filter((item) => {
    if (item.hidden) return false;
    if (item.kind === "booking") return false;
    if (options.dropFinished === true && isFinished(item, settings) && !isPast(item, now)) {
      return false;
    }
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

/** Every item on a day, timed and untimed, for a view that counts them. */
function itemsOn(contents: DayContents): Item[] {
  return [...allTimed(contents).map((placed) => placed.item), ...contents.untimed];
}

/**
 * Whether a day is asking for anything.
 *
 * The week draws a 22px row for a day with nothing on it, because seven
 * full-height rows is the whole popup. That test used to be "no items", which
 * was the same question while finished work was dropped before it ever reached
 * a view. It is not the same question any more: a day whose four assignments
 * are all handed in is a day with four rows and nothing to do.
 *
 * Empty counts as quiet, which is what it has always been.
 */
export function quietDay(contents: DayContents, now: Date): boolean {
  return itemsOn(contents).every((item) => itemTone(item, now) === "done");
}

/**
 * How many rows fit a month cell before it has to say "+N more".
 *
 * Here rather than in the popup because `sinkDone` is only worth anything on
 * account of it: the cap is what turns an ordering into a row a student never
 * sees. A test can quote the same number the grid draws.
 */
export const MONTH_CELL_ROWS = 3;

/**
 * Finished pills sink below open ones, inside one day.
 *
 * A month cell draws three rows and then "+N more". Before finished work was
 * drawn, that cap only ever hid work that was still owed behind other work
 * still owed. Now three struck-through pills can push the one thing left to do
 * out of the cell entirely — and "which days are still heavy" is the only
 * question a month view answers.
 *
 * Stable within each group, so the timed-before-untimed order is kept.
 */
export function sinkDone(placed: PlacedItem[], now: Date): PlacedItem[] {
  const done = (one: PlacedItem) => itemTone(one.item, now) === "done";
  return [...placed.filter((one) => !done(one)), ...placed.filter(done)];
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
 * The axis runs to 10 PM, not to midnight and no longer to 6 PM.
 *
 * It ended at midnight when end-of-day deadlines were drawn on it. They are
 * hoisted above the grid now, so the last hours were empty ruled lines whose
 * only effect was to "push everything below them out of a 600px popup" — and
 * that was the whole argument for 6 PM.
 *
 * **It no longer holds, twice over.** The popup does not draw this grid at all
 * since the agenda landed: `renderDayView` sends the popup to `agendaRows` and
 * the axis to the full view, which is an ordinary tab with a window's height.
 * And the axis is now where a deadline is *added* — a drag is clamped to the
 * hours that are drawn, so an axis ending at 6 PM means an evening event can be
 * typed but not dragged, which is the gesture this exists for.
 *
 * 10 PM rather than midnight because `END_OF_DAY_MINUTES` hoists everything from
 * 11 PM off the axis anyway; hours nothing can ever be drawn in are the empty
 * ruled lines this comment started out about.
 */
export const DEFAULT_DAY_END = 22;

/**
 * How long something occupies the axis, in minutes, or nothing.
 *
 * Two sources state a span and neither used to be drawn. A `manual` row whose
 * student typed an end time carries `extra.endAt`, an instant; a PrairieTest
 * exam carries `extra.duration`, which that parser records as `"50min"`. Both
 * mean the same thing to a grid — this box is not a line, it is a sitting you
 * cannot be anywhere else during — and an exam drawn as a one-line row at 7 PM
 * says nothing about the two hours after it.
 *
 * Anchored, not `parseInt` (house rule 5): `Number("50min")` is `NaN` but
 * `parseInt` would happily read `"50 minutes or until the room closes"` as 50,
 * and `"1h"` as 1. A value that does not match is a value nobody stated, so the
 * row stays a line — that is the field costing its own field and nothing else.
 *
 * `endAt` wins over `duration` when a row somehow carries both: it is an
 * instant someone wrote down, and `duration` is a string that has to be read.
 */
const DURATION_MINUTES = /^(\d{1,4})\s*min$/;

export function spanMinutes(item: Item, anchor: Anchor): number | undefined {
  for (const m of item.members) {
    const endAt = m.extra?.["endAt"];
    if (endAt === undefined) continue;
    const end = Date.parse(endAt);
    if (Number.isNaN(end)) continue;
    const minutes = (end - anchor.at) / 60_000;
    // A span that ends before it starts is not a span. `manual.ts` refuses one
    // on the way in, so this can only be a row whose anchor is its *opening*
    // time or a member from another build; either way, drawing a negative box
    // is the one outcome that must not happen.
    if (minutes > 0) return minutes;
  }
  for (const m of item.members) {
    const match = DURATION_MINUTES.exec(m.extra?.["duration"]?.trim() ?? "");
    if (!match) continue;
    const minutes = Number(match[1]);
    if (minutes > 0) return minutes;
  }
  return undefined;
}

/**
 * The hours to draw, given what is on the day and what the student is doing.
 *
 * `include` is the second half, and it is new with drag-to-place: the axis is
 * now where a deadline is *added*, so a box dragged to 6:30 AM or an end time
 * typed as 21:30 has to be inside the grid the moment it exists. Without it the
 * ghost is drawn at a negative offset — above the grid, over the banners — which
 * is the same failure `grid--now` had at half past midnight.
 *
 * Fractional hours, because a drag lands on a quarter hour and the caller
 * should not have to know that the axis counts in whole ones.
 */
export function hourRange(
  contents: DayContents,
  include: readonly number[] = [],
): { start: number; end: number } {
  let start = DEFAULT_DAY_START;
  let end = DEFAULT_DAY_END;
  const cover = (from: number, to: number): void => {
    const first = Math.floor(from);
    // The hour *after* the item, so it is drawn inside the grid rather than on
    // its bottom border.
    const last = Math.max(first + 1, Math.ceil(to));
    if (first < start) start = first;
    if (last > end) end = last;
  };

  for (const stack of contents.timed) {
    const minutes = minutesInto(new Date(stack[0]!.anchor.at));
    let finishes = minutes + 1;
    for (const placed of stack) {
      const span = spanMinutes(placed.item, placed.anchor);
      if (span === undefined) continue;
      finishes = Math.max(finishes, minutesInto(new Date(placed.anchor.at)) + span);
    }
    cover(minutes / 60, finishes / 60);
  }

  /*
   * No `Number.isFinite` guard, deliberately.
   *
   * One was written here and did nothing: every comparison against `NaN` is
   * false, so `cover(NaN, NaN)` widens nothing, and dropping the guard did not
   * fail a single test. Mutation house rule 2 calls that redundant rather than
   * defensive — a second thing to read that rejects exactly what the code below
   * already rejects. The *behaviour* is still pinned by a test, because it is
   * the behaviour that matters: a half-typed clock must not produce a grid of
   * `NaN` rules.
   */
  for (const hour of include) cover(hour, hour);

  // A sitting that runs past midnight does not wrap onto the next day's axis;
  // it stops at the bottom of this one. The grid is a day, and an hour 25 would
  // be drawn as a label reading "1 AM" at the far end of the wrong day.
  return { start: Math.max(0, start), end: Math.min(24, end) };
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
      // that only holds three rows. Finished work last of all — see `sinkDone`.
      items: sinkDone(
        [
          ...allTimed(contents),
          ...contents.untimed.map((item) => ({
            item,
            anchor: { at: Date.parse(item.dueAt ?? ""), assumed: true, opening: false },
          })),
        ],
        now,
      ),
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

/**
 * The No date tab's two groups, undated first (brief D3).
 *
 * Undated leads because it is the larger, calmer half and the one the tab is
 * named after; "Couldn't read" follows, carrying the amber check chip, because
 * it is the half this extension is at fault for. That is the opposite of
 * `ATTENTION_ORDER`, where "Couldn't read" led a screen whose other group was
 * *overdue work* — there, a hidden deadline outranks an undated shell. Here
 * there is no overdue group to rank against, and putting four rows of "we
 * failed to read this" above the explainer makes the tab read as an error log.
 *
 * Derived from `attentionGroups` rather than re-deriving the buckets, so the
 * two surfaces cannot disagree about which row is undated and which is
 * unreadable — the `resolveColumn` lesson from the mutation house rules.
 */
export const NO_DATE_ORDER: AttentionName[] = ["No date at all", "Couldn't read"];

export function noDateGroups(items: Item[], now: Date): AttentionGroup[] {
  const groups = attentionGroups(items, now);
  return NO_DATE_ORDER.map((name) => groups.find((group) => group.name === name)).filter(
    (group): group is AttentionGroup => group !== undefined,
  );
}

/**
 * The No date tab's badge: both groups, unlike `attentionCount`.
 *
 * `ATTENTION_ACTIONABLE` deliberately left "No date at all" uncounted, because
 * that count sat on a tab whose *other* contents were late work — a badge
 * creeping upward all semester over rows asking for nothing. This badge is on
 * the tab those rows are the whole of. A count of 4 over a tab called "No date"
 * says how many are waiting; a count of 1 over four visible rows says nothing
 * at all. Mock 2c shows `4` over three undated rows and one unreadable one.
 */
export function noDateCount(items: Item[], now: Date): number {
  return noDateGroups(items, now).reduce((total, group) => total + group.items.length, 0);
}

/**
 * Late work, for the header pill's "N late" and the Needs-you screen (D2).
 *
 * The "Overdue" group exactly — including its seven-day window and its
 * exclusions for exams, events and work already handed in — so the number in
 * the pill and the rows behind it can never be counted by two different rules.
 */
export function overdueItems(items: Item[], now: Date): Item[] {
  return attentionGroups(items, now).find((group) => group.name === "Overdue")?.items ?? [];
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

/**
 * §8.1's sections, as a pure function so the date boundaries are testable.
 *
 * "This week (through Sunday)" and "overdue by ≤ 7 days" are the kind of rule
 * that is quietly wrong for a week at a time, so none of it is computed inline
 * in the renderer.
 */

import { isItemDone, isTickedDone } from "./dedupe.js";
import { unreadableDeadline } from "./quality.js";
import type { Item, Settings } from "../sources/types.js";

export type SectionName =
  | "Couldn't read"
  | "Needs attention"
  | "Today"
  | "Tomorrow"
  | "This week"
  | "Later";

/**
 * "Couldn't read" leads, above even Needs attention.
 *
 * It holds rows whose deadline the parser could not make sense of, so its
 * contents are by definition the deadlines this extension is least sure about —
 * and §11 ranks a silently missing deadline above every other failure. It is
 * empty on a healthy sync, which is what makes it tolerable at the top.
 */
export const SECTION_ORDER: SectionName[] = [
  "Couldn't read",
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

/** Local midnight `days` after the day containing `when`. */
function startOfDay(when: Date, days = 0): number {
  const d = new Date(when.getFullYear(), when.getMonth(), when.getDate() + days);
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


/**
 * §4.3: an assessment past its full-credit deadline has `dueAt` undefined and
 * `lateDueAt` set — "the UI shows 80% until Tue 11:59 PM". Gradescope reaches
 * the same shape when a row's only `<time>` is its late date. Reading `dueAt`
 * alone puts that row in no section at all.
 */
function instantOf(item: Item): string | undefined {
  return item.dueAt ?? item.lateDueAt;
}

export interface LiveDeadline {
  /** Epoch ms of the deadline that still matters. */
  at: number;
  /** True when it is the reduced-credit / late window rather than full credit. */
  late: boolean;
}

/**
 * The deadline the student can still act on.
 *
 * `dueAt ?? lateDueAt` was wrong for the shape both Gradescope and PrairieLearn
 * produce most often: full-credit deadline passed, late window still open. The
 * row read "Wed 5:00 PM · 1d ago" in overdue red, planned no reminder for the
 * date that was still live, and fell out of the list seven days later — while
 * Gradescope was still accepting the work and PrairieLearn was still paying 80%
 * for it. Saying "too late" when it is not is the same class of harm as saying
 * nothing at all (§11).
 *
 * Once *both* are behind, the full-credit instant is what the overdue window is
 * measured from, because that is the deadline the student actually missed.
 */
export function liveDeadline(item: Item, now: Date): LiveDeadline | undefined {
  const parse = (raw: string | undefined) => {
    if (raw === undefined) return undefined;
    const at = Date.parse(raw);
    return Number.isNaN(at) ? undefined : at;
  };
  const due = parse(item.dueAt);
  const late = parse(item.lateDueAt);

  if (due !== undefined && due > now.getTime()) return { at: due, late: false };
  if (late !== undefined && late > now.getTime()) return { at: late, late: true };
  if (due !== undefined) return { at: due, late: false };
  if (late !== undefined) return { at: late, late: true };
  return undefined;
}

export function sectionFor(item: Item, now: Date): SectionName | undefined {
  // Before anything else: a row whose date could not be read has no instant to
  // section by, so every branch below would drop it — which is how a row kept
  // deliberately (house rule 1) ended up displayed nowhere.
  if (unreadableDeadline(item).length > 0) return "Couldn't read";

  // §8.1: booking items always lead, because the window closes whether or not
  // the student has looked, and §7 nags daily until it is gone.
  if (item.kind === "booking") return "Needs attention";

  const live = liveDeadline(item, now);
  if (live === undefined) return undefined;
  const due = live.at;

  const today = startOfDay(now);
  if (due < now.getTime()) {
    // Past due. Only unfinished work needs attention, and only for a week.
    if (isItemDone(item)) return undefined;
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
 * `hideSubmitted` never hides a booking row: `kind` survives a merge but
 * `status` does not, so a booking merged with a graded row would otherwise
 * collapse to "done" and take §8.1's lead section with it.
 */
export function groupItems(items: Item[], now: Date, settings: Settings): Section[] {
  const buckets = new Map<SectionName, Item[]>(SECTION_ORDER.map((name) => [name, []]));

  for (const item of items) {
    if (item.hidden) continue;
    // The student's own tick, which is not conditional on `hideSubmitted`: that
    // setting is about trusting what a *source* reports, and this is not a
    // report. It is overridden when a source says the work is missing, so the
    // tick cannot silently swallow a real deadline.
    if (item.kind !== "booking" && isTickedDone(item)) continue;
    if (settings.hideSubmitted && item.kind !== "booking" && isItemDone(item)) continue;
    const section = sectionFor(item, now);
    if (section) buckets.get(section)!.push(item);
  }

  return SECTION_ORDER.map((name) => ({ name, items: buckets.get(name)! })).filter(
    (section) => section.items.length > 0,
  );
}

/**
 * "moved Tue → Fri" for a deadline the course changed since the last sync.
 *
 * Only the day is shown: the row already carries the new time, and the useful
 * fact is that it is not where the student last saw it.
 */
export function movedText(item: Item): string | undefined {
  if (!item.movedFrom) return undefined;
  const from = new Date(item.movedFrom);
  const instant = item.dueAt ?? item.lateDueAt;
  if (Number.isNaN(from.getTime()) || instant === undefined) return undefined;
  const to = new Date(instant);
  if (Number.isNaN(to.getTime())) return undefined;
  const day = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `moved ${day(from)} → ${day(to)}`;
}

export interface DueText {
  /** Short enough to sit beside the title: "Thu 11:59 PM · in 2d". */
  primary: string;
  /**
   * The qualifier, when there is one — a late window, an unstated time, a
   * deadline that moved. Rendered on its own line under the title.
   *
   * Split from `primary` because Tier 0a made this column much wordier, one
   * justified sentence at a time, and the row is a single flex line: "80% until
   * Tue, Sep 22, 11:59 PM · 13d left" is 219px of a 400px popup, and the title
   * beside it collapsed to 49. One row got **5 pixels** of title. Every one of
   * those strings was right on its own; together they crowded out the thing
   * that says which assignment the row is.
   */
  detail?: string;
}

/** A short weekday-and-clock, the common case: `Thu 11:59 PM`. */
function clockOf(due: Date): string {
  return due.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

/** `Sep 22`, for a date far enough out that a weekday alone is ambiguous. */
function dayOf(due: Date): string {
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Whole local days from today to `due`, negative for the past. */
function daysAway(due: Date, now: Date): number {
  return Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);
}

function relativeDays(delta: number): string {
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  return delta < 0 ? `${Math.abs(delta)}d ago` : `in ${delta}d`;
}

/**
 * §8.1's row text, as a short line plus an optional qualifier.
 *
 * The split is a layout constraint made explicit: whatever goes in `primary`
 * competes with the title for one line, and whatever goes in `detail` does not.
 * So `primary` answers "when", in as few characters as will do, and `detail`
 * carries anything the student needs to know *about* that answer.
 */
/**
 * How much of the date the row still has to say, given the heading above it.
 *
 * A row under **TODAY** that reads "Thu 11:59 PM · in 4h" is spending its
 * scarcest resource — the one line it shares with the title — restating the
 * heading. In a 400px popup that cost real characters: with the date spelled
 * out in full, eight of eleven titles were truncated.
 *
 * So the heading carries the coarse date and the row carries only what the
 * heading leaves open.
 */
function precisionFor(section: SectionName | undefined): "relative" | "time" | "weekday" | "date" {
  switch (section) {
    case "Today":
      // The clock and how long is left; the day is the heading.
      return "time";
    case "Tomorrow":
      return "time";
    case "This week":
      // Which day is the open question here, the date is not.
      return "weekday";
    case "Later":
      return "date";
    default:
      // Needs attention, or no section: how long ago is the whole point.
      return "relative";
  }
}

export function formatDue(item: Item, now: Date, section?: SectionName): DueText {
  const instant = instantOf(item);
  if (instant === undefined) return { primary: "no date" };
  const due = new Date(instant);
  if (Number.isNaN(due.getTime())) return { primary: "no date" };

  // §4.5's runner fills in 23:59 when a course page prints a bare date. Showing
  // that as "Fri 11:59 PM" is the §11 risk wearing a friendly face: it looks
  // like a stated deadline, and a student who trusts it misses a 5 PM cutoff.
  if (item.timeAssumed) {
    return {
      primary: `${dayOf(due)} · ${relativeDays(daysAway(due, now))}`,
      detail: "the course site gives no time",
    };
  }

  // Full credit gone, late window still open: Gradescope's "accepting late
  // submissions until…" and PrairieLearn's next credit tier. The row used to
  // read "1d ago" in overdue red for this, which is the opposite of the truth.
  const live = liveDeadline(item, now);
  if (live?.late && live.at > now.getTime()) {
    const until = new Date(live.at);
    const credit = item.members.find((m) => m.extra?.["creditRemaining"])?.extra?.[
      "creditRemaining"
    ];
    const left = Math.ceil((live.at - now.getTime()) / 86_400_000);
    return {
      primary: `${dayOf(until)} · ${left <= 1 ? "today" : `${left}d left`}`,
      detail: credit ? `${credit}% credit until ${clockOf(until)}` : `late until ${clockOf(until)}`,
    };
  }

  // §4.3's own wording for a row whose full-credit deadline has passed.
  if (item.dueAt === undefined) {
    const credit = item.members.find((m) => m.extra?.["creditRemaining"])?.extra?.[
      "creditRemaining"
    ];
    return {
      primary: clockOf(due),
      detail: credit ? `${credit}% credit remaining` : "late deadline",
    };
  }

  const deltaMs = due.getTime() - now.getTime();
  const past = deltaMs < 0;
  const abs = Math.abs(deltaMs);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor(abs / 60_000);
  const span = days > 0 ? `${days}d` : hours > 0 ? `${hours}h` : `${minutes}m`;

  const time = due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  switch (precisionFor(section)) {
    case "time":
      // Under Today, "in 4h" is the part that changes what you do next; under
      // Tomorrow nothing is imminent, so the clock alone is enough.
      return { primary: section === "Today" ? `${time} · in ${span}` : time };
    case "weekday":
      return { primary: clockOf(due) };
    case "date":
      // A month and day, because two rows both reading "Thu" can be eight days
      // apart, and "in 14d" adds nothing a date does not already say.
      return { primary: dayOf(due) };
    default:
      // Needs attention. Once something is more than a day late the clock has
      // stopped mattering — how late it is, is the whole question — and the
      // date places it. Inside a day the clock is still the useful half.
      if (past && days >= 1) return { primary: `${dayOf(due)} · ${span} ago` };
      return { primary: `${clockOf(due)} · ${past ? `${span} ago` : `in ${span}`}` };
  }
}

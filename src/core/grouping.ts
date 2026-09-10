/**
 * §8.1's sections, as a pure function so the date boundaries are testable.
 *
 * "This week (through Sunday)" and "overdue by ≤ 7 days" are the kind of rule
 * that is quietly wrong for a week at a time, so none of it is computed inline
 * in the renderer.
 */

import { isItemDone } from "./dedupe.js";
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

/** `Thu 11:59 PM · in 2d`, or `2d ago` once past (§8.1's row format). */
export function formatDue(item: Item, now: Date): string {
  const instant = instantOf(item);
  if (instant === undefined) return "no date";
  const due = new Date(instant);
  if (Number.isNaN(due.getTime())) return "no date";

  const clock = due.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  // Full credit gone, late window still open: Gradescope's "Accepting late
  // submissions until…" and PrairieLearn's next credit tier. The row used to
  // read "1d ago" in overdue red for this, which is the opposite of the truth.
  const live = liveDeadline(item, now);
  if (live?.late && live.at > now.getTime()) {
    const until = new Date(live.at).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const credit = item.members.find((m) => m.extra?.["creditRemaining"])?.extra?.[
      "creditRemaining"
    ];
    const left = Math.ceil((live.at - now.getTime()) / 86_400_000);
    const remaining = left <= 1 ? "today" : `${left}d left`;
    return credit ? `${credit}% until ${until} · ${remaining}` : `late until ${until} · ${remaining}`;
  }

  // §4.3's own wording for a row whose full-credit deadline has passed.
  if (item.dueAt === undefined) {
    const credit = item.members.find((m) => m.extra?.["creditRemaining"])?.extra?.[
      "creditRemaining"
    ];
    if (credit) return `${credit}% until ${clock}`;
    return `late due ${clock}`;
  }
  const deltaMs = due.getTime() - now.getTime();
  const past = deltaMs < 0;
  const abs = Math.abs(deltaMs);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor(abs / 60_000);

  const span = days > 0 ? `${days}d` : hours > 0 ? `${hours}h` : `${minutes}m`;
  return `${clock} · ${past ? `${span} ago` : `in ${span}`}`;
}

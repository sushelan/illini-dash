/**
 * §8.1's sections, as a pure function so the date boundaries are testable.
 *
 * "This week (through Sunday)" and "overdue by ≤ 7 days" are the kind of rule
 * that is quietly wrong for a week at a time, so none of it is computed inline
 * in the renderer.
 */

import { isItemDone, isTickedDone, opensAt } from "./dedupe.js";
import { unreadableDeadline } from "./quality.js";
import { movedRange } from "./provenance.js";
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
 * The deadline the student can still act on. **Sibling of `missedDeadline`,
 * which answers the other half: the deadline they already missed.**
 *
 * This one is for what the extension *plans* — §7's reminders, the countdown to
 * a window that is still open, "is there anything still to do". `missedDeadline`
 * is for where a row is *drawn* and what it is called. Splitting them is Sushi's
 * decision of 2026-09-21 ("if its late it should show up in late no matter what
 * even if its 80%"); before it, one function answered both and a row could not
 * be in the Late band and have a reminder planned for tonight at the same time.
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

  /*
   * Work already handed in has no live late window.
   *
   * The promotion below exists because a deadline that has passed is not the
   * one that matters while the work can still be handed in late. That premise
   * is simply false for work that *has* been handed in — and getting it wrong
   * made finished work disappear altogether, which is how it was found.
   *
   * Gradescope's PHYS 435 Homework 2: submitted, due Sep 9, late window open
   * until Sep 16. The promotion anchored it to Sep 16, so `isPast` said no, so
   * `visibleItems` hid it as finished-and-not-yet-past — and it was never drawn
   * on Sep 9 either, where a week you worked through is supposed to show what
   * you did. Every completed PrairieLearn assessment with a reduced-credit tail
   * ("100% until Sep 15, 80% until Sep 22") vanished the same way, which is
   * most of a semester's work by October.
   *
   * A finished item's deadline is the one it was finished against.
   */
  const finished = isItemDone(item) || isTickedDone(item);

  if (due !== undefined && due > now.getTime()) return { at: due, late: false };
  if (!finished && late !== undefined && late > now.getTime()) return { at: late, late: true };
  if (due !== undefined) return { at: due, late: false };
  if (late !== undefined) return { at: late, late: true };
  return undefined;
}

/**
 * The deadline the student **missed**: the one a row is banded and labelled by.
 * **Sibling of `liveDeadline`, which answers the other half: the deadline they
 * can still act on.** Nothing here decides what is *planned* — reminders,
 * retention and "is this still actionable" all keep asking `liveDeadline`.
 *
 * Sushi, 2026-09-21, looking at a PrairieLearn MP whose 100% deadline had gone
 * and whose 80% tier ran until that night: *"i think if its late it should show
 * up in late no matter what even if its 80%."* It was drawn under **By end of
 * day** in amber, beside work that was not late at all, because `liveDeadline`
 * had promoted it to the window it still had. The promotion is right about what
 * to *do* and wrong about what to *call* it.
 *
 * So: full credit if a source stated one, whatever the late window says. There
 * is no clock in the signature because the answer does not depend on one, which
 * is the cleanest statement of the difference from `liveDeadline`.
 *
 * **No special case for finished work, unlike `liveDeadline`.** That guard
 * exists there to undo the promotion for work already handed in; there is no
 * promotion here to undo, so a finished row's answer is the deadline it was
 * finished against either way. Keeping "is it done" out of the band is the
 * caller's — `attentionGroups` and `sectionFor` both refuse a finished row
 * before they ask, and `itemTone` answers `done` above everything.
 *
 * **§4.3's no-popover fallback is the one shape this cannot band.** A
 * PrairieLearn row rescued from the credit *cell* alone reads "80% until …" and
 * states no full-credit instant at all, so `dueAt` is undefined: full credit has
 * gone but nobody said when. There is no missed instant to measure a week from,
 * so such a row is still banded by the window it does state — and it is the one
 * state left wearing `row-late`'s amber.
 */
export function missedDeadline(item: Item): LiveDeadline | undefined {
  const parse = (raw: string | undefined) => {
    if (raw === undefined) return undefined;
    const at = Date.parse(raw);
    return Number.isNaN(at) ? undefined : at;
  };
  const due = parse(item.dueAt);
  if (due !== undefined) return { at: due, late: false };
  const late = parse(item.lateDueAt);
  return late === undefined ? undefined : { at: late, late: true };
}

/**
 * Has this row aged out of the "late" band?
 *
 * §8.1 gives overdue work a week, measured from the deadline it missed — but a
 * row whose reduced-credit window is *still open* has not aged out however long
 * ago full credit went. Dropping it is the defect `liveDeadline`'s comment
 * records from the other direction: CS 357's L4a vanished on day seven while
 * PrairieLearn went on paying 80% for another week.
 *
 * One function because both banders ask it, and two spellings of one week is
 * the `resolveColumn` finding.
 */
export function withinOverdueWindow(item: Item, missedAt: number, now: Date): boolean {
  const live = liveDeadline(item, now);
  if (live !== undefined && live.at > now.getTime()) return true;
  return now.getTime() - missedAt <= OVERDUE_WINDOW_DAYS * 86_400_000;
}

/**
 * §8.1's forward sections for one future instant.
 *
 * Extracted so a deadline and an opening time are placed by the same rule. Two
 * copies would drift, and the mutation lesson from `resolveColumn` is that a
 * second copy of a decision also hides the first from its tests.
 */
function sectionByInstant(at: number, now: Date): SectionName | undefined {
  if (at < startOfDay(now, 1)) return "Today";
  if (at < startOfDay(now, 2)) return "Tomorrow";
  if (at < endOfWeek(now)) return "This week";
  if (at < startOfDay(now) + HORIZON_DAYS * 86_400_000) return "Later";
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

  // An event is over when it is over. It has no submission, so `isItemDone` is
  // never true for one and the overdue branch below would hold it in "Needs
  // attention" for a week — which is how four instances of one office-hours
  // block and two class Zoom links came to outnumber the real work there.
  if (item.kind === "event") {
    const at = liveDeadline(item, now);
    if (at === undefined || at.at < now.getTime()) return undefined;
  }

  // `missedDeadline`, not `liveDeadline`: a row past full credit with a
  // reduced-credit window still open is *late*, and belongs under the heading
  // that says so (Sushi, 2026-09-21). It is undefined in exactly the cases
  // `liveDeadline` is, because both read the same two fields.
  const banded = missedDeadline(item);
  if (banded === undefined) {
    // No deadline stated. If a source said when it opens and that is still
    // ahead, this is upcoming work and belongs in the list — dropping it is
    // the silent loss §11 ranks worst. An opening time already past says
    // nothing useful on its own, so those still fall out.
    const opens = opensAt(item);
    if (opens === undefined || opens <= now.getTime()) return undefined;
    return sectionByInstant(opens, now);
  }
  const due = banded.at;

  if (due < now.getTime()) {
    // Past due. Only unfinished work needs attention, and only for a week —
    // or for as long as the late window runs, whichever is longer.
    if (isItemDone(item)) return undefined;
    return withinOverdueWindow(item, due, now) ? "Needs attention" : undefined;
  }

  return sectionByInstant(due, now);
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
 * Where an exam is and how long it runs.
 *
 * §4.4 has parsed these since the PrairieTest source was written — `location`,
 * `locationDetail`, `duration` — and nothing has ever displayed them. That is
 * the same defect `core/quality.ts` exists for one field over: a parser
 * carefully records something and no reader was written, so the work is done
 * and invisible.
 *
 * They belong on the row rather than behind a click, because an exam is the one
 * deadline where *where* is a question with a wrong answer. Knowing a midterm
 * is at 7 PM and not knowing it is at Grainger is most of the way to missing it.
 */
export function examDetail(item: Item): string | undefined {
  const read = (key: string) =>
    item.members.map((member) => member.extra?.[key]).find((value) => value && value !== "");

  const location = read("location");
  const room = read("locationDetail");
  const duration = read("duration");

  const where = location && room ? `${location} · ${room}` : (location ?? room);
  // Both, one, or neither: an exam with no room stated still has a length worth
  // knowing, and saying "undefined" for the other half is worse than silence.
  return [where, duration].filter(Boolean).join(" · ") || undefined;
}

/**
 * "moved Tue → Fri" for a deadline that changed since the last sync.
 *
 * The range is `movedRange`'s, shared with `movedByText`: day-only across days,
 * and the clock when both ends land on one — a same-day move rendered
 * "moved Sat, Sep 19 → Sat, Sep 19" and reported nothing.
 */
export function movedText(item: Item): string | undefined {
  if (!item.movedFrom) return undefined;
  const instant = item.dueAt ?? item.lateDueAt;
  if (instant === undefined) return undefined;
  const range = movedRange(new Date(item.movedFrom), new Date(instant));
  return range === undefined ? undefined : `moved ${range}`;
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

/**
 * The percentage a row is still worth, for the window ending at `until`.
 *
 * Two sources, because §4.3's parser has two paths and only one of them writes
 * the figure down. With no credit popover it rescues the row from the cell text
 * and records `creditRemaining: "80"`; *with* one it records the whole ladder as
 * `creditSchedule` and no `creditRemaining` at all — which is the path Sushi's
 * MP came down, and why his row read "late until Sun 11:59 PM" with the number
 * he wanted sitting in the JSON beside it.
 *
 * The tier is matched on its End rather than on "which one is open now":
 * `lateDueAt` *is* a tier's `end`, so the match is exact, and asking the clock
 * instead would let a row name one tier and count down to another.
 *
 * Parsed defensively even though this extension wrote it: a stored row can come
 * from an older build (worker rule 8), and `JSON.parse` on anything else throws
 * inside a renderer.
 */
function creditPercentFor(item: Item, until: Date): string | undefined {
  const stated = item.members
    .map((member) => member.extra?.["creditRemaining"])
    .find((value) => value !== undefined && /^\d{1,3}(?:\.\d+)?$/.test(value));
  if (stated !== undefined) return stated;

  for (const member of item.members) {
    const raw = member.extra?.["creditSchedule"];
    if (raw === undefined) continue;
    let tiers: unknown;
    try {
      tiers = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!Array.isArray(tiers)) continue;
    for (const tier of tiers as { credit?: unknown; end?: unknown }[]) {
      if (typeof tier?.end !== "string" || typeof tier.credit !== "number") continue;
      if (!Number.isFinite(tier.credit)) continue;
      if (Date.parse(tier.end) === until.getTime()) return String(tier.credit);
    }
  }
  return undefined;
}

/**
 * "80% until Sun 11:59 PM" — what a row past full credit is still worth.
 *
 * Sushi, 2026-09-21: *"it should appear in the late tab and it should say when
 * the 80% due date is."* The old wording was "late until Sun 11:59 PM", which
 * says the window is open and nothing about what it pays, and "80% credit
 * until" spent two of a 400px row's scarcest characters restating what a
 * percent sign already means.
 *
 * Where no percentage is known — Gradescope states a late date and never a
 * credit — the old wording stands rather than a number being invented for it
 * (worker rule 3).
 */
export function creditWindowText(item: Item, until: Date): string {
  const credit = creditPercentFor(item, until);
  return `${credit === undefined ? "late" : `${credit}%`} until ${clockOf(until)}`;
}

/**
 * §4.3 as amended (roadmap I37): a PrairieLearn row scored below 100 with
 * credit still on offer stays unfinished, and `extra.scorePercent` says how far
 * it got. "40% so far" is the difference between a row that has never been
 * opened and one that needs half an hour, and without it the two read alike.
 */
function scoreSoFar(item: Item): string | undefined {
  // Not on a finished row. A closed assessment that ended at 40 also carries
  // `scorePercent`, and "40% so far" on it reads as an invitation to go and
  // earn the rest, which is the one thing that can no longer be done.
  if (isItemDone(item) || isTickedDone(item)) return undefined;
  const percent = item.members.find((m) => m.extra?.["scorePercent"])?.extra?.["scorePercent"];
  return percent === undefined ? undefined : `${percent}% so far`;
}

/**
 * The right-hand column of a card row (brief D4, mock 1a).
 *
 * `formatDue` answers "when is this", which needs a clock and a date because it
 * is the only thing on the row that says so. The card layout puts the clock
 * under the title, so this column answers the other question — "how long have I
 * got" — and that turns out to have a different shape at every distance:
 *
 * - **Inside an hour**, minutes, because that is the difference between doing
 *   it now and missing it.
 * - **Inside a day**, hours. The hero card gets the minutes too (`"fine"`),
 *   because it is one line with room and "how long exactly" is the whole
 *   question it exists to answer; a row does not, and mock 1a shows the same
 *   11:59 PM deadline as "in 4h 12m" in the hero and "in 4h" in the list.
 * - **Tomorrow**, "in 1d" — a weekday would be the word the heading already
 *   carries.
 * - **Later this week**, the weekday, because "in 4d" makes a reader count.
 * - **Past**, how late, in the coarsest unit that is still true. Mock 1b's
 *   "1d late": once something is a day late the minutes stop mattering.
 *
 * Whole *local days* rather than 24-hour blocks, so it agrees with the section
 * the row is sitting under. 30 hours can be tomorrow or the day after, and a
 * row under **TOMORROW** reading "in 2d" is the kind of contradiction nobody
 * reports and everybody notices.
 */
export function countdown(
  instant: number | string,
  now: Date,
  precision: "coarse" | "fine" = "coarse",
): string {
  const at = typeof instant === "string" ? Date.parse(instant) : instant;
  // Not a countdown at all. A caller with nothing to count from gets nothing to
  // draw, rather than "in NaNd".
  if (!Number.isFinite(at)) return "";

  const delta = at - now.getTime();
  const abs = Math.abs(delta);
  const days = Math.abs(daysAway(new Date(at), now));
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor(abs / 60_000);

  if (delta < 0) {
    // Elapsed time, not calendar days: 23:00 read at 01:00 is two hours late,
    // and "1d late" there is not true (R3 L9).
    if (hours >= 24) return `${Math.floor(hours / 24)}d late`;
    if (hours >= 1) return `${hours}h late`;
    return `${minutes}m late`;
  }

  if (days === 0 || (days === 1 && hours < 24)) {
    // Still inside a day's reach even when the calendar has turned over: at
    // 11 PM, something due at 1 AM is "in 2h", not "in 1d".
    if (hours < 1) return `in ${minutes}m`;
    if (precision === "fine") {
      const spare = Math.floor((abs - hours * 3_600_000) / 60_000);
      return spare > 0 ? `in ${hours}h ${spare}m` : `in ${hours}h`;
    }
    return `in ${hours}h`;
  }
  if (days === 1) return "in 1d";
  if (days < 7) return new Date(at).toLocaleDateString(undefined, { weekday: "short" });
  // Past a week a weekday is two different days, and the one a reader assumes
  // is the near one.
  return dayOf(new Date(at));
}

export function formatDue(item: Item, now: Date, section?: SectionName): DueText {
  const text = dueTextFor(item, now, section);
  // Only where the row has nothing else to say. The credit wordings below are
  // about the deadline, which is the more urgent of the two, and `detail` is a
  // single line whose length already cost the title column its width once.
  if (text.detail !== undefined) return text;
  const soFar = scoreSoFar(item);
  return soFar === undefined ? text : { ...text, detail: soFar };
}

function dueTextFor(item: Item, now: Date, section?: SectionName): DueText {
  const instant = instantOf(item);
  if (instant === undefined) {
    // A row with no deadline but a stated opening time. "no date" would be a
    // lie by omission: the source told us something specific, and "opens Sep
    // 12" is the answer to the only question this row can answer yet.
    const opens = opensAt(item);
    if (opens !== undefined && opens > now.getTime()) {
      const at = new Date(opens);
      const when =
        precisionFor(section) === "date"
          ? dayOf(at)
          : precisionFor(section) === "weekday"
            ? clockOf(at)
            : at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return { primary: `opens ${when}`, detail: "not open yet" };
    }
    return { primary: "no date" };
  }
  const due = new Date(instant);
  if (Number.isNaN(due.getTime())) return { primary: "no date" };

  // §4.5's runner fills in 23:59 when a course page prints a bare date. Showing
  // that as "Fri 11:59 PM" is the §11 risk wearing a friendly face: it looks
  // like a stated deadline, and a student who trusts it misses a 5 PM cutoff.
  if (item.timeAssumed) {
    // An inline marker, not a second line. A course site with five timeless
    // deadlines produced five consecutive rows each carrying the sentence "the
    // course site gives no time" — one fact, restated until it is wallpaper,
    // for double the height.
    //
    // But not blank either: under Later a *stated* deadline also shows only a
    // date, because the heading already carries the rest. Drop the marker and
    // a real 11:59 PM and an invented one both read "Sep 23", which is the
    // whole thing §4.5's `timeAssumed` exists to keep apart. Four characters
    // does the same work as the sentence did.
    const day = dayOf(due);
    const when = precisionFor(section) === "date" ? day : relativeDays(daysAway(due, now));
    return { primary: `${when} · no time` };
  }

  // Full credit gone, late window still open: Gradescope's "accepting late
  // submissions until…" and PrairieLearn's next credit tier. The row used to
  // read "1d ago" in overdue red for this, which is the opposite of the truth.
  const live = liveDeadline(item, now);
  if (live?.late && live.at > now.getTime()) {
    const until = new Date(live.at);
    const left = Math.ceil((live.at - now.getTime()) / 86_400_000);
    return {
      primary: `${dayOf(until)} · ${left <= 1 ? "today" : `${left}d left`}`,
      // The same sentence the Late band draws, from the same function: this row
      // is now in that band, and two spellings of one window would drift.
      detail: creditWindowText(item, until),
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

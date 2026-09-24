/**
 * Notification scheduling (§7).
 *
 * Pure decisions here; `chrome.alarms` and `chrome.notifications` are driven
 * from the service worker. Notifications are the one part of this extension
 * that interrupts a person, so the rules that decide *not* to fire — already
 * fired, already done, deadline already passed, quiet hours — matter more than
 * the ones that do.
 */

import { isItemDone, isTickedDone } from "./dedupe.js";
import { examDetail, liveDeadline } from "./grouping.js";
import { nameList } from "./names.js";
import type { Item, Settings } from "../sources/types.js";

/**
 * `late24h` / `late2h` are the same two lead times aimed at a reduced-credit or
 * late window rather than the full-credit deadline.
 *
 * They need their own names because `notified` is keyed by lead: once the 24h
 * reminder had been spent on the full-credit deadline, reusing that key for the
 * late window meant the late reminder was suppressed as already-sent, which is
 * precisely the deadline the student still has a chance to meet.
 */
export type Lead = "24h" | "2h" | "booking" | "late24h" | "late2h" | "dayOf";

type TimedLead = "24h" | "2h" | "late24h" | "late2h";

const LEAD_MS: Record<TimedLead, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  late24h: 24 * 60 * 60 * 1000,
  late2h: 2 * 60 * 60 * 1000,
};

/** The late-window counterpart of each configured lead time. */
const LATE_LEAD: Record<"24h" | "2h", "late24h" | "late2h"> = {
  "24h": "late24h",
  "2h": "late2h",
};

/** §7: the daily booking nag fires at 10:00 local. */
export const BOOKING_HOUR = 10;

const ALARM_PREFIX = "notify";

export function alarmName(itemId: string, lead: Lead): string {
  return `${ALARM_PREFIX}:${itemId}:${lead}`;
}

export function parseAlarmName(name: string): { itemId: string; lead: Lead } | undefined {
  const match = /^notify:(.+):(late24h|late2h|24h|2h|booking|dayOf)$/.exec(name);
  if (!match) return undefined;
  return { itemId: match[1]!, lead: match[2] as Lead };
}

/* -------------------------------------------------------------------------- */
/* Quiet hours                                                                 */
/* -------------------------------------------------------------------------- */

/** Whether `when`'s local hour falls inside a possibly-midnight-wrapping window. */
export function inQuietHours(when: Date, quiet: Settings["quietHours"]): boolean {
  if (!quiet) return false;
  const { start, end } = quiet;
  if (start === end) return false;
  const hour = when.getHours();
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/**
 * §7: a notification that would land inside quiet hours is deferred to the end
 * of the window, not dropped.
 *
 * The default window is 23:00–08:00, and §7 notes the common case is
 * unaffected: a 2-hour lead on an 11:59 PM deadline fires at 9:59 PM.
 */
export function deferPastQuietHours(when: Date, quiet: Settings["quietHours"]): Date {
  if (!inQuietHours(when, quiet)) return when;
  const { start, end } = quiet!;
  const deferred = new Date(when);
  deferred.setHours(end, 0, 0, 0);
  // On the evening side of a wrapping window the window ends tomorrow morning.
  if (start > end && when.getHours() >= start) deferred.setDate(deferred.getDate() + 1);
  return deferred;
}

/* -------------------------------------------------------------------------- */
/* What to fire                                                                */
/* -------------------------------------------------------------------------- */

export interface PlannedNotification {
  alarmName: string;
  itemId: string;
  lead: Lead;
  /** When it should fire, after quiet hours are applied. */
  fireAt: string;
  /** True when the moment has already passed and it should fire immediately. */
  overdue: boolean;
  /**
   * Other leads for this same item whose moment also passed, which this plan
   * replaces rather than fires.
   *
   * §7's "Chrome was closed" catch-up used to fire every overdue lead: a laptop
   * opened on Thursday morning with an assignment due at 09:00 produced *two*
   * toasts for one deadline, and the 24h one said "due tomorrow" about
   * something due in forty minutes. Only the most urgent lead has anything
   * useful left to say, so the rest are recorded as handled without a toast —
   * recorded, not dropped, or they would fire again on the next pass.
   */
  superseded: Lead[];
}

/** §7: never notify about something hidden, finished, ticked off, or already notified. */
function isEligible(item: Item, settings: Settings): boolean {
  if (item.hidden || isItemDone(item) || isTickedDone(item)) return false;
  // Nothing is owed for an event, so there is nothing to be late for. A
  // recurring office-hours block would otherwise fire two reminders a day,
  // every day, which is the fastest way to get an extension muted.
  if (item.kind === "event") return false;
  // §4.3's filter. The row stays in the list either way — this only decides
  // whether the extension is willing to interrupt someone about it.
  if (item.forCredit === false && !settings.remindNotForCredit) return false;
  return true;
}

/**
 * §7: the booking nag repeats daily until the exam is booked — at which point
 * the item stops being produced at all, so its absence is what stops the nag.
 */
function planBooking(item: Item, settings: Settings, now: Date): PlannedNotification | undefined {
  const lastFired = item.notified.booking;
  const next = new Date(now);
  next.setHours(BOOKING_HOUR, 0, 0, 0);

  if (lastFired !== undefined) {
    const last = new Date(lastFired);
    // Already nagged today; the next one is tomorrow.
    if (!Number.isNaN(last.getTime()) && last.toDateString() === now.toDateString()) {
      next.setDate(next.getDate() + 1);
    }
  }
  // Past 10:00 with nothing fired today means fire now, not tomorrow.
  const overdue = next.getTime() <= now.getTime();
  const fireAt = deferPastQuietHours(overdue ? now : next, settings.quietHours);

  return {
    alarmName: alarmName(item.id, "booking"),
    itemId: item.id,
    lead: "booking",
    fireAt: fireAt.toISOString(),
    overdue,
    // The daily nag has no other lead to collapse with.
    superseded: [],
  };
}

/**
 * The single reminder an unknown-time deadline gets: the morning it is due.
 *
 * Deliberately not a lead time. The extension does not know when the work is
 * due, so it cannot honestly count down to it — the only true statement it can
 * make is which day. Quiet hours still apply, which is what puts it at 08:00
 * rather than at midnight.
 */
function planDayOf(
  item: Item,
  settings: Settings,
  now: Date,
  due: number,
): PlannedNotification | undefined {
  if (item.notified.dayOf !== undefined) return undefined;
  const dueDate = new Date(due);
  const morning = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const overdue = morning.getTime() <= now.getTime();
  const fireAt = deferPastQuietHours(overdue ? now : morning, settings.quietHours);
  // Never after the (assumed) deadline itself — at that point it is not a
  // reminder, and §7 says nothing fires stale.
  if (fireAt.getTime() >= due) return undefined;
  return {
    alarmName: alarmName(item.id, "dayOf"),
    itemId: item.id,
    lead: "dayOf",
    fireAt: fireAt.toISOString(),
    overdue,
    superseded: [],
  };
}

/**
 * Two overdue leads for one deadline are one reminder, not two.
 *
 * Both the 24h and the 2h moment have passed whenever Chrome was closed across
 * them, and firing both says the same thing twice in the same second — with the
 * older one carrying the more misleading wording. The most urgent surviving
 * lead is the only one with anything true left to say, so it fires and the rest
 * ride along in its `superseded` list to be recorded as handled.
 *
 * A lead that is *not* overdue is untouched: it still has a real moment in the
 * future and must keep its own alarm.
 */
function collapseOverdue(plans: PlannedNotification[]): PlannedNotification[] {
  const overdue = plans.filter((plan) => plan.overdue);
  if (overdue.length <= 1) return plans;

  // Most urgent = smallest lead window = closest to the deadline.
  const ranked = [...overdue].sort(
    (a, b) => (LEAD_MS[a.lead as TimedLead] ?? 0) - (LEAD_MS[b.lead as TimedLead] ?? 0),
  );
  const survivor = ranked[0]!;
  const replaced = ranked.slice(1).map((plan) => plan.lead);
  // `!plan.overdue` is unexercised with today's two lead times — if both 24h and
  // 2h are overdue there is no third lead left to be in the future, so a
  // mutation that drops this clause passes the whole suite. It is kept
  // deliberately: custom lead times are a planned change, and the moment a third
  // lead exists this is what stops a collapse from eating a reminder whose
  // moment has not arrived.
  return plans
    .filter((plan) => !plan.overdue || plan === survivor)
    .map((plan) => (plan === survivor ? { ...plan, superseded: replaced } : plan));
}

/**
 * Everything that should be scheduled right now.
 *
 * A lead whose moment has already passed is returned with `overdue: true` when
 * the deadline itself is still ahead — §7's "Chrome was closed" case — and
 * omitted entirely once the deadline has passed, so nothing fires stale.
 */
export function planNotifications(
  items: Item[],
  settings: Settings,
  now: Date,
): PlannedNotification[] {
  const planned: PlannedNotification[] = [];

  for (const item of items) {
    if (!isEligible(item, settings)) continue;

    if (item.kind === "booking") {
      const booking = planBooking(item, settings, now);
      if (booking) planned.push(booking);
      continue;
    }

    // §4.3 / §8.1: the deadline that is still ahead, which is the late or
    // reduced-credit window once full credit has passed. `dueAt ?? lateDueAt`
    // returned the *expired* full-credit instant for the commonest Gradescope
    // and PrairieLearn shape, so the loop bailed out one line later and planned
    // nothing at all for a window the student could still meet.
    const live = liveDeadline(item, now);
    if (live === undefined) continue;
    const due = live.at;
    // §7: past the deadline, a reminder is noise. Nothing fires stale.
    if (due <= now.getTime()) continue;

    // §4.5's runner fills in 23:59 when a course page prints only a date, and a
    // countdown against an invented instant is worse than none: if the real
    // cutoff is 5 PM, "due in 2 hours" fires at 9:59 PM — three hours after the
    // work was already late, in the confident voice of a real deadline.
    // One reminder, on the morning of the day, saying plainly that the time is
    // unknown. Worker house rule 3: what this code invented must never be
    // handed to something that treats it as stated.
    if (item.timeAssumed) {
      const dayOf = planDayOf(item, settings, now, due);
      if (dayOf) planned.push(dayOf);
      continue;
    }

    const forItem: PlannedNotification[] = [];
    for (const setting of settings.leadTimes) {
      const lead: TimedLead = live.late ? LATE_LEAD[setting] : setting;
      if (item.notified[lead] !== undefined) continue;
      const moment = new Date(due - LEAD_MS[lead]);
      const overdue = moment.getTime() <= now.getTime();
      const fireAt = deferPastQuietHours(overdue ? now : moment, settings.quietHours);
      // Deferring out of quiet hours must never push a reminder past the thing
      // it is reminding about.
      if (fireAt.getTime() >= due) continue;
      forItem.push({
        alarmName: alarmName(item.id, lead),
        itemId: item.id,
        lead,
        fireAt: fireAt.toISOString(),
        overdue,
        superseded: [],
      });
    }
    planned.push(...collapseOverdue(forItem));
  }

  return planned;
}

/**
 * Whether a plan is due to fire, or should be armed as an alarm.
 *
 * Extracted so the decision is testable: the worker previously branched on
 * `overdue` and ignored `fireAt`, which discarded the quiet-hours deferral for
 * exactly the case it was computed for — §7's "Chrome was closed" catch-up —
 * and woke people at 02:30.
 */
export function shouldFireNow(plan: PlannedNotification, now: Date): boolean {
  return Date.parse(plan.fireAt) <= now.getTime();
}

/* -------------------------------------------------------------------------- */
/* What it says                                                                */
/* -------------------------------------------------------------------------- */

export interface NotificationContent {
  /** The work, then what is happening to it. Chrome shows this first and big. */
  title: string;
  /** Course, clock, and — for an exam — where to turn up. */
  message: string;
  /** Which site said so. Chrome renders it small, under the message. */
  contextMessage?: string;
  /**
   * Where the toast's click should land, or `""` when there is nowhere.
   *
   * `Item.url` is optional since the `manual` source — a deadline the student
   * typed need not carry a link. The click handler already refuses a falsy
   * target and leaves the toast up rather than opening a blank tab.
   */
  url: string;
}

/**
 * Enough of the title that the urgency still fits beside it.
 *
 * Chrome gives a notification title roughly one line, and a real UIUC
 * assignment title uses most of it: "MP1 Report (4cr only, EXCEPT for students
 * in MC3)" is 48 characters before anything is said about when it is due. The
 * old title dodged this by leading with the course code — which put the one
 * thing a student already knows first and the thing they have to act on
 * second, and still truncated the title into the message.
 *
 * So the work leads, and **only the work is clamped** — the words after it are
 * appended afterwards, because they are the half a student acts on and cutting
 * them is the failure this exists to prevent. 44 characters is measured against
 * Chrome's own toast on a 1440px display.
 */
export const TITLE_BUDGET = 44;

export function clampTitle(title: string, budget = TITLE_BUDGET): string {
  const trimmed = title.trim();
  if (trimmed.length <= budget) return trimmed;
  // On a word boundary where there is one within reach, so it does not cut a
  // title mid-number and invent "HW1" out of "HW12".
  const cut = trimmed.slice(0, budget);
  const space = cut.lastIndexOf(" ");
  return `${(space > budget - 12 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function relative(due: Date, now: Date): string {
  const hours = Math.round((due.getTime() - now.getTime()) / 3_600_000);
  if (hours <= 0) return "now";
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

/**
 * How far off the deadline actually is, in words.
 *
 * The title used to be keyed on which lead fired — `"24h" ? "tomorrow" : "in 2
 * hours"` — which is true only if the reminder fires at the moment it was
 * planned for. It does not, whenever Chrome was closed: §7's catch-up fires a
 * 24h lead the instant the browser reopens, so a laptop opened at 08:30 for a
 * 09:00 deadline announced "due tomorrow". The number the student acts on has
 * to come from the clock, not from the alarm's name.
 */
export function urgency(due: Date | undefined, now: Date): string {
  if (!due || Number.isNaN(due.getTime())) return "soon";
  const ms = due.getTime() - now.getTime();
  if (ms <= 0) return "now";

  // The clock wins inside three hours, and it wins *before* the calendar does.
  // That ordering is the fix: something due at 09:00 tomorrow, seen at 08:30
  // today, is on the next calendar day and half an hour away, and "tomorrow"
  // is the answer that loses the student the deadline.
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(ms / 3_600_000);
  if (hours < 3) return `in ${hours} hour${hours === 1 ? "" : "s"}`;

  // Past that, the calendar reads better than an hour count: "tomorrow" beats
  // "in 23 hours". Counted in whole local days from today's midnight, so it
  // cannot call Wednesday "tomorrow" merely because it is 25 hours out.
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((due.getTime() - midnight.getTime()) / 86_400_000);
  if (days <= 0) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export function notificationContent(item: Item, lead: Lead, now: Date): NotificationContent {
  if (lead === "booking") {
    const start = item.members.find((m) => m.extra?.["windowStart"])?.extra?.["windowStart"];
    const end = item.members.find((m) => m.extra?.["windowEnd"])?.extra?.["windowEnd"];
    const window =
      start && end
        ? `${new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${new Date(
            end,
          ).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        : "soon";
    return {
      // §4.4: never phrase a booking as a deadline. The date is deliberately
      // early because slots fill; calling it "due" would be a lie. The verb
      // leads because there is exactly one thing to do about this one.
      title: `Book a seat: ${clampTitle(item.title.replace(/^Book a slot:\s*/i, ""))}`,
      message: `${item.courseLabel} · sessions ${window}`,
      ...sourceLine(item),
      url: item.url ?? "",
    };
  }

  // §4.3: a reduced-credit window is not a due date, and must not be worded as
  // one — the same care §4.4 takes with a booking. A late lead is by definition
  // about that window, whether or not `dueAt` survived — and so is its clock:
  // `dueAt` has already passed by the time a late lead fires, and counting down
  // to it said "late window closes now" a day early.
  const isLate = lead === "late24h" || lead === "late2h";
  const instant = isLate ? (item.lateDueAt ?? item.dueAt) : (item.dueAt ?? item.lateDueAt);
  const due = instant ? new Date(instant) : undefined;

  // An assumed time must not appear in a toast at all, in any form: not as a
  // clock, not as a countdown. The day is the only thing the source stated.
  if (item.timeAssumed && due) {
    const day = due.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    return {
      title: `${clampTitle(item.title)} — due ${urgency(due, now) === "now" ? "today" : day}`,
      message: `${item.courseLabel} · no time given — check the course page for the cutoff`,
      ...sourceLine(item),
      url: item.url ?? "",
    };
  }

  const when = due
    ? `${due.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })} · ${relative(due, now)}`
    : "";
  const credit = item.members.find((m) => m.extra?.["creditRemaining"])?.extra?.["creditRemaining"];
  const kindWord = isLate
    ? credit
      ? `${credit}% credit until`
      : "late window closes"
    : item.dueAt === undefined
      ? "reduced credit"
      : "due";
  // §4.4's room and duration. An exam is the one reminder where "where" has a
  // wrong answer, and the parser has had this all along without ever showing it
  // in a toast.
  const where = examDetail(item);
  return {
    title: `${clampTitle(item.title)} — ${kindWord} ${urgency(due, now)}`,
    message: [item.courseLabel, when, where].filter(Boolean).join(" · "),
    ...sourceLine(item),
    url: item.url ?? "",
  };
}

/**
 * Which site said so, as Chrome's small third line.
 *
 * It is the answer to "where do I go to do this", and it was nowhere in a toast
 * — a student with five sources had to open the popup to find out which one a
 * reminder came from.
 */
function sourceLine(item: Item): { contextMessage?: string } {
  const distinct = [...new Set(item.members.map((m) => m.source))];
  if (distinct.length === 0) return {};
  return { contextMessage: nameList(distinct) };
}

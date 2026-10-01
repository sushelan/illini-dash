/**
 * Notification scheduling (§7).
 *
 * Pure decisions here; `chrome.alarms` and `chrome.notifications` are driven
 * from the service worker. Notifications are the one part of this extension
 * that interrupts a person, so the rules that decide *not* to fire — already
 * fired, already done, deadline already passed, quiet hours — matter more than
 * the ones that do.
 */

import { courseSiteQuiz } from "./calendar.js";
import { isItemDone, isTickedDone } from "./dedupe.js";
import { creditWindowText, examDetail, liveDeadline } from "./grouping.js";
import { courseLabel, nameList } from "./names.js";
import { isInstant } from "./parsing.js";
import { assumedTimeNote } from "./provenance.js";
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
export type Lead =
  | "24h"
  | "2h"
  | "booking"
  | "late24h"
  | "late2h"
  | "dayOf"
  /** I18: a week out, for an exam only — a sitting needs a study runway, a homework does not. */
  | "7d"
  /** I40: the evening of the last day a CBTF seat can be reserved. */
  | "bookingLast"
  /** I40: the window closed and the booking item is still here — said once. */
  | "bookingMissed"
  /** I13: the one reminder a student asked for from a toast's Snooze button. */
  | "snooze";

/**
 * Every key `Item.notified` may carry: a lead that fired, plus `snoozeUntil`,
 * which is not a firing record but the instant a snoozed reminder is owed.
 *
 * `Item.notified`'s declared type lags this until `sources/types.ts` is widened
 * to it (lane H wiring note); reads go through `notifiedOf` so this file
 * compiles either way.
 */
export type NotifiedKey = Lead | "snoozeUntil";
export type Notified = Partial<Record<NotifiedKey, string>>;

function notifiedOf(item: Item): Notified {
  return item.notified as Notified;
}

type TimedLead = "24h" | "2h" | "late24h" | "late2h" | "7d";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const LEAD_MS: Record<TimedLead, number> = {
  "24h": DAY_MS,
  "2h": 2 * HOUR_MS,
  late24h: DAY_MS,
  late2h: 2 * HOUR_MS,
  "7d": 7 * DAY_MS,
};

/**
 * How urgent each lead is when two of them are overdue at once — smaller wins
 * the collapse. A timed lead ranks by its window; the student's own snooze
 * outranks everything, because it is the reminder they asked for.
 */
const URGENCY_RANK: Record<Lead, number> = {
  snooze: 0,
  dayOf: 1,
  bookingMissed: 1,
  bookingLast: 1,
  booking: 2,
  "2h": LEAD_MS["2h"],
  late2h: LEAD_MS.late2h,
  "24h": LEAD_MS["24h"],
  late24h: LEAD_MS.late24h,
  "7d": LEAD_MS["7d"],
};

/** The late-window counterpart of each configured lead time. */
const LATE_LEAD: Record<"24h" | "2h", "late24h" | "late2h"> = {
  "24h": "late24h",
  "2h": "late2h",
};

/** §7: the daily booking nag fires at 10:00 local. */
export const BOOKING_HOUR = 10;

/**
 * I40: the last-day escalation fires at 18:00 local — late enough that the
 * morning nag has been ignored, early enough that CBTF's evening slots are
 * still worth reserving before the window ends at 23:59:59.
 */
export const BOOKING_LAST_HOUR = 18;

/** §4.4: a missed reservation is worth saying for 3 days, then it is stale. */
export const MISSED_NOTICE_DAYS = 3;

/** I13: what one press of Snooze buys. */
export const SNOOZE_MS = HOUR_MS;

/**
 * I28: how many reminder alarms `reschedule` may arm at once.
 *
 * Chrome 117+ refuses an extension's 501st alarm. The sync alarm and whatever
 * else the worker keeps share that ceiling, so reminders get 400 and leave the
 * rest as headroom.
 */
export const ALARM_BUDGET = 400;

const LEAD_PATTERN = "late24h|late2h|24h|2h|7d|bookingLast|bookingMissed|booking|dayOf|snooze";

const ALARM_PREFIX = "notify";

export function alarmName(itemId: string, lead: Lead): string {
  return `${ALARM_PREFIX}:${itemId}:${lead}`;
}

export function parseAlarmName(name: string): { itemId: string; lead: Lead } | undefined {
  const match = new RegExp(`^notify:(.+):(${LEAD_PATTERN})$`).exec(name);
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

/** A booking's `windowEnd`, when the parser stated one that is an instant. */
function windowEndOf(item: Item): number | undefined {
  const raw = item.members.map((m) => m.extra?.["windowEnd"]).find((v) => v !== undefined && v !== "");
  // Parser rule 5: `Date.parse("2026-09-23")` is 7 PM the day before here, and
  // worker rule 3 says never invent an end — an unreadable one is no end.
  return isInstant(raw) ? Date.parse(raw) : undefined;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/**
 * §7: the booking nag repeats daily until the exam is booked — at which point
 * the item stops being produced at all, so its absence is what stops the nag.
 *
 * I40 adds two things around it, both keyed off the stated `windowEnd` and
 * neither when it is unknown: one evening reminder on the last day
 * (`bookingLast`), and — if the item is still here once the window has shut —
 * a single "missed" notice instead of a nag about a seat nobody can reserve.
 */
function planBooking(item: Item, settings: Settings, now: Date): PlannedNotification[] {
  const notified = notifiedOf(item);
  const end = windowEndOf(item);

  if (end !== undefined && end <= now.getTime()) {
    // Nagging "Book a seat" about a closed window is a lie; say once that it
    // closed, within §4.4's three days, and never again.
    if (notified.bookingMissed !== undefined) return [];
    if (now.getTime() - end > MISSED_NOTICE_DAYS * DAY_MS) return [];
    return [
      {
        alarmName: alarmName(item.id, "bookingMissed"),
        itemId: item.id,
        lead: "bookingMissed",
        fireAt: deferPastQuietHours(now, settings.quietHours).toISOString(),
        overdue: true,
        superseded: [],
      },
    ];
  }

  const plans: PlannedNotification[] = [];
  const lastFired = notified.booking;
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
  // Never nag past the end of the window: tomorrow's 10:00 after the last day
  // would be a nag about a seat that can no longer be had.
  if (end === undefined || fireAt.getTime() < end) {
    plans.push({
      alarmName: alarmName(item.id, "booking"),
      itemId: item.id,
      lead: "booking",
      fireAt: fireAt.toISOString(),
      overdue,
      superseded: [],
    });
  }

  if (end !== undefined && notified.bookingLast === undefined) {
    const lastDay = new Date(end);
    const evening = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), BOOKING_LAST_HOUR);
    const lastOverdue = evening.getTime() <= now.getTime();
    const lastAt = deferPastQuietHours(lastOverdue ? now : evening, settings.quietHours);
    if (lastAt.getTime() < end) {
      plans.push({
        alarmName: alarmName(item.id, "bookingLast"),
        itemId: item.id,
        lead: "bookingLast",
        fireAt: lastAt.toISOString(),
        overdue: lastOverdue,
        superseded: [],
      });
    }
  }
  return plans;
}

/**
 * Something the student turns up to: an exam, or a quiz a course site lists (a
 * CBTF sitting, `courseSiteQuiz`). The week-out lead (I18) is theirs alone — a
 * sitting needs a study runway, a homework does not, and a PrairieLearn quiz is
 * homework.
 */
function isSitting(item: Item): boolean {
  return item.kind === "exam" || courseSiteQuiz(item);
}

/**
 * The week-out reminder for a sitting whose page gave only the day: the
 * morning a week before, never a countdown. Not planned once that morning has
 * passed — the day-of reminder is the honest one by then, and a "week out"
 * toast four days out is a stale one.
 */
function planWeekOut(
  item: Item,
  settings: Settings,
  now: Date,
  due: number,
): PlannedNotification | undefined {
  if (notifiedOf(item)["7d"] !== undefined) return undefined;
  const dueDate = new Date(due);
  const morning = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate() - 7);
  if (morning.getTime() <= now.getTime()) return undefined;
  return {
    alarmName: alarmName(item.id, "7d"),
    itemId: item.id,
    lead: "7d",
    fireAt: deferPastQuietHours(morning, settings.quietHours).toISOString(),
    overdue: false,
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
  if (notifiedOf(item).dayOf !== undefined) return undefined;
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
  const ranked = [...overdue].sort((a, b) => URGENCY_RANK[a.lead] - URGENCY_RANK[b.lead]);
  const survivor = ranked[0]!;
  const replaced = ranked.slice(1).map((plan) => plan.lead);
  // `!plan.overdue` is reachable since the exam's 7d lead (I18): due in 23
  // hours, the 7d and 24h moments have passed and the 2h has not, and without
  // this clause the collapse would eat the 2h reminder whose moment is ahead.
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
/**
 * I13: the reminder a student asked for by pressing Snooze.
 *
 * `snoozeUntil` is validated positively (parser rule 5: a stored value is data
 * from an older build) and dropped at or past `limit`, the deadline it reminds
 * about — worker rule 3's "never re-fire past the stated deadline". Once it
 * fires, `recordFired` removes `snoozeUntil`, so it fires once.
 */
function planSnooze(
  item: Item,
  settings: Settings,
  now: Date,
  limit: number | undefined,
): PlannedNotification | undefined {
  const until = notifiedOf(item).snoozeUntil;
  if (!isInstant(until)) return undefined;
  const at = new Date(until);
  const overdue = at.getTime() <= now.getTime();
  const fireAt = deferPastQuietHours(overdue ? now : at, settings.quietHours);
  if (limit !== undefined && fireAt.getTime() >= limit) return undefined;
  return {
    alarmName: alarmName(item.id, "snooze"),
    itemId: item.id,
    lead: "snooze",
    fireAt: fireAt.toISOString(),
    overdue,
    superseded: [],
  };
}

export function planNotifications(
  items: Item[],
  settings: Settings,
  now: Date,
): PlannedNotification[] {
  const planned: PlannedNotification[] = [];

  for (const item of items) {
    if (!isEligible(item, settings)) continue;

    if (item.kind === "booking") {
      const forBooking = planBooking(item, settings, now);
      // Bounded by the window's end: a snooze on a closed window has nothing
      // left to say.
      const snooze = planSnooze(item, settings, now, windowEndOf(item));
      if (snooze) forBooking.push(snooze);
      planned.push(...collapseOverdue(forBooking));
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
    const snooze = planSnooze(item, settings, now, due);

    if (item.timeAssumed) {
      const dayOf = planDayOf(item, settings, now, due);
      // A sitting still gets its week out when only the day is known: the
      // runway is about the day, and an in-class midterm or a CBTF quiz window
      // is exactly the row a course page dates without a clock.
      const weekOut =
        isSitting(item) && !live.late && settings.leadTimes.length > 0
          ? planWeekOut(item, settings, now, due)
          : undefined;
      planned.push(
        ...collapseOverdue(
          [weekOut, dayOf, snooze].filter((p): p is PlannedNotification => p !== undefined),
        ),
      );
      continue;
    }

    const leads: TimedLead[] = settings.leadTimes.map((setting) =>
      live.late ? LATE_LEAD[setting] : setting,
    );
    // I18: a week out, for a sitting only (an exam, or a quiz a course site
    // lists — Sushi, 2026-10-01, "add reminders for quizzes too"). Off a
    // stated instant here; the `timeAssumed` branch above plans its own, by
    // the day. Gated on the student having any lead on at all: someone who
    // switched both off asked for no countdowns, and this is one.
    if (isSitting(item) && !live.late && leads.length > 0) leads.push("7d");

    const forItem: PlannedNotification[] = snooze ? [snooze] : [];
    for (const lead of leads) {
      if (notifiedOf(item)[lead] !== undefined) continue;
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

/**
 * I28: the plans to arm, soonest first, within Chrome's alarm ceiling.
 *
 * Soonest first is the whole decision: a reminder left over is a December one
 * that the next sync re-plans once September's have fired, while dropping the
 * sort would arm December and leave tomorrow's deadline silent. `overflow` is
 * how many were left out, for the worker's log line (worker rule 5).
 */
export function armable(
  plans: readonly PlannedNotification[],
  limit = ALARM_BUDGET,
): { armed: PlannedNotification[]; overflow: number } {
  const sorted = [...plans].sort((a, b) => Date.parse(a.fireAt) - Date.parse(b.fireAt));
  const armed = sorted.slice(0, Math.max(0, limit));
  return { armed, overflow: plans.length - armed.length };
}

/**
 * The `notified` record after `plan` fired at `at`.
 *
 * The lead is stamped, every lead it superseded is recorded as handled without
 * a toast of its own, and a fired snooze is spent: its
 * `snoozeUntil` goes, so it cannot fire a second time.
 */
export function recordFired(notified: Notified, plan: PlannedNotification, at: string): Notified {
  const next: Notified = { ...notified, [plan.lead]: at };
  for (const replaced of plan.superseded) next[replaced] = at;
  // Only a fired snooze is spent: it outranks every other lead in a collapse
  // (URGENCY_RANK), so it is never among the superseded.
  if (plan.lead === "snooze") delete next.snoozeUntil;
  return next;
}

/** I13: `notified` with a snooze owed at `until`. The lead that fired stays stamped. */
export function applySnooze(notified: Notified, until: Date): Notified {
  return { ...notified, snoozeUntil: until.toISOString() };
}

/* -------------------------------------------------------------------------- */
/* Buttons (I13)                                                              */
/* -------------------------------------------------------------------------- */

export interface ToastButton {
  title: string;
  action: "snooze" | "done";
}

const SNOOZE_BUTTON: ToastButton = { title: "Snooze 1h", action: "snooze" };
const DONE_BUTTON: ToastButton = { title: "Done", action: "done" };

/**
 * The buttons a toast carries, in `chrome.notifications` order.
 *
 * Chrome allows two, and the toast body is already Open (`onClicked`), so a
 * deadline gets Snooze and Done — Done being the student's own tick, the
 * existing `done` override, not Hide. A booking nag gets Snooze only: the item
 * leaves by itself once a seat is booked (§4.4), and "Done" there would read as
 * "booked" and silence the nag on a seat nobody reserved. The missed notice
 * is said once and has nothing to snooze.
 */
export function toastButtons(lead: Lead): ToastButton[] {
  if (lead === "bookingMissed") return [];
  if (lead === "booking" || lead === "bookingLast") return [SNOOZE_BUTTON];
  return [SNOOZE_BUTTON, DONE_BUTTON];
}

/**
 * Whether the toast stays up until answered (`requireInteraction`).
 *
 * The last reminder before a moment — the 2h lead, its late twin, the last
 * evening to book a seat — has nothing after it, so letting Chrome time it out
 * mid-lecture loses the only warning left. A snooze is the student asking to be
 * told again, so it stays too. The earlier leads auto-dismiss: a later one is
 * still coming. (macOS draws alerts vs banners itself and may ignore this.)
 */
export function requiresInteraction(lead: Lead): boolean {
  return lead === "2h" || lead === "late2h" || lead === "bookingLast" || lead === "snooze";
}

/** The toast id: the item, the lead, and a stamp so a re-fire is a new toast. */
export function notificationId(itemId: string, lead: Lead, now: Date): string {
  return `${itemId}:${lead}:${now.getTime()}`;
}

export function parseNotificationId(id: string): { itemId: string; lead: Lead } | undefined {
  const match = new RegExp(`^(.+):(${LEAD_PATTERN}):(\\d+)$`).exec(id);
  if (!match) return undefined;
  return { itemId: match[1]!, lead: match[2] as Lead };
}

export type ButtonAction =
  | { kind: "snooze"; itemId: string; until: string }
  | { kind: "done"; itemId: string };

/**
 * What a press of button `index` on toast `id` asks for, or `undefined` when
 * the id is not one of ours or the toast has no such button.
 *
 * Snooze: write `applySnooze(notified, until)` through the queue and
 * reschedule. Done: the existing `{ kind: "done" }` override.
 */
export function buttonAction(id: string, index: number, now: Date): ButtonAction | undefined {
  const parsed = parseNotificationId(id);
  if (!parsed) return undefined;
  const button = toastButtons(parsed.lead)[index];
  if (!button) return undefined;
  if (button.action === "done") return { kind: "done", itemId: parsed.itemId };
  return {
    kind: "snooze",
    itemId: parsed.itemId,
    until: new Date(now.getTime() + SNOOZE_MS).toISOString(),
  };
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

/**
 * "today", "tomorrow", or the weekday and date — counted in local calendar
 * days, never from the clock.
 *
 * The morning-of toast for an untimed deadline fires at 08:00 on the day, when
 * `urgency` still says "in 15 hours"; keying "today" on `urgency(…) === "now"`
 * meant it could only say so once the deadline had passed (copy-audit #12).
 */
function dayWord(due: Date, now: Date): string {
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(due) - midnight(now)) / DAY_MS);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return due.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

/** "Wed, Sep 23" — a date a student can place without a year. */
function shortDate(when: Date): string {
  return when.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/**
 * What a snoozed toast is really about: the lead the live deadline would carry
 * now. A snooze stores no lead of its own, so a snoozed late reminder still
 * words itself as a closing window and a snoozed nag is still a nag.
 */
function effectiveLead(item: Item, lead: Lead, now: Date): Lead {
  if (lead !== "snooze") return lead;
  if (item.kind === "booking") return "booking";
  // No `timeAssumed` case: the untimed branch below words every lead alike.
  return liveDeadline(item, now)?.late ? "late2h" : "2h";
}

/**
 * What a toast says.
 *
 * `courseNames` is the student's renames (`Overrides.courseNames`), resolved
 * through `courseLabel` like every other surface that names a course — the
 * raw `CS357` in a toast beside "CS 357" in the popup, or beside a rename, is
 * the drift PROGRESS 2026-09-12's one-resolver rule exists to stop.
 */
export function notificationContent(
  item: Item,
  requested: Lead,
  now: Date,
  courseNames: Record<string, string> = {},
): NotificationContent {
  const lead = effectiveLead(item, requested, now);
  const course = item.courseLabel ? courseLabel(item.courseLabel, courseNames) : "";
  const line = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" · ");
  const work = clampTitle(item.title.replace(/^Book a slot:\s*/i, ""));

  if (lead === "booking" || lead === "bookingLast" || lead === "bookingMissed") {
    const read = (key: string) => item.members.find((m) => m.extra?.[key])?.extra?.[key];
    const start = read("windowStart");
    const endRaw = read("windowEnd");
    const window =
      start && endRaw
        ? `${new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${new Date(
            endRaw,
          ).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        : "soon";
    const end = windowEndOf(item);

    if (lead === "bookingMissed" && end !== undefined) {
      // §4.4: the extension cannot know whether the student sat it another
      // way, so it says what it saw and who can help — not that they missed
      // the exam.
      return {
        title: `Missed the reservation window: ${work}`,
        message: line(
          course,
          `sessions ended ${shortDate(new Date(end))} and no seat was booked — contact course staff if you still need one`,
        ),
        ...sourceLine(item),
        url: item.url ?? "",
      };
    }

    // I40: the last day is a different message, whichever lead carries it.
    const lastDay = end !== undefined && end > now.getTime() && sameLocalDay(new Date(end), now);
    return {
      // §4.4: never phrase a booking as a deadline. The date is deliberately
      // early because slots fill; calling it "due" would be a lie. The verb
      // leads because there is exactly one thing to do about this one.
      title: lastDay ? `Last day to book a seat: ${work}` : `Book a seat: ${work}`,
      message: line(course, lastDay ? "sessions end today" : `sessions ${window}`),
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
  // Who left the hour out decides where to look (copy-audit #4): a post's day
  // sends the student to the post, their own row to nowhere, and only a course
  // site's bare date to the course page.
  if (item.timeAssumed && due && !Number.isNaN(due.getTime())) {
    if (lead === "7d") {
      // The week-out toast for a day with no stated time: the date, and the
      // same note on where the hour is, never a clock.
      const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const inAWeek = Math.round((midnight(due) - midnight(now)) / DAY_MS) === 7;
      return {
        title: `${clampTitle(item.title)} is ${inAWeek ? "in a week" : dayWord(due, now)}`,
        message: line(course, shortDate(due), assumedTimeNote(item)),
        ...sourceLine(item),
        url: item.url ?? "",
      };
    }
    return {
      title: `${clampTitle(item.title)} — due ${dayWord(due, now)}`,
      message: line(course, assumedTimeNote(item)),
      ...sourceLine(item),
      url: item.url ?? "",
    };
  }

  // §4.4's room and duration. An exam is the one reminder where "where" has a
  // wrong answer, and the parser has had this all along without ever showing it
  // in a toast.
  const where = examDetail(item);

  // I18: the week-out toast is a date to plan around, not a countdown — the
  // full date, and "a week" rather than "in 7 days" when it fires on time.
  if (lead === "7d" && due && !Number.isNaN(due.getTime())) {
    const words = urgency(due, now);
    const date = due.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return {
      title: `${clampTitle(item.title)} is ${words === "in 7 days" ? "in a week" : words}`,
      message: line(course, date, where),
      ...sourceLine(item),
      url: item.url ?? "",
    };
  }

  /*
   * One noun and one spelling for the window (copy-audit #15, 2026-09-27).
   *
   * The title names it — "late window closes tomorrow" — where it used to say
   * "80% credit until", "late window closes" or "reduced credit" depending on
   * the lead and the source. The body states it as a time through
   * `creditWindowText`, the formatter every popup surface uses, so the toast
   * says "80% until Tue 11:00 PM" beside the row that says the same.
   *
   * `windowed` covers §4.3's shape too — no `dueAt`, only `lateDueAt` — which a
   * full-credit lead can still reach (a lead planned before `dueAt` went); its
   * instant is the window's close all the same, and "reduced credit" was the
   * one spelling nothing else used.
   */
  const windowed = isLate || item.dueAt === undefined;
  const clock = due
    ? windowed
      ? creditWindowText(item, due)
      : due.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })
    : "";
  const when = due ? `${clock} · ${relative(due, now)}` : "";
  const kindWord = windowed ? "late window closes" : "due";
  return {
    title: `${clampTitle(item.title)} — ${kindWord} ${urgency(due, now)}`,
    message: line(course, when, where),
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

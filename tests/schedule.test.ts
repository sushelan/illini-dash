/**
 * §7 notifications. The rules that decide NOT to fire matter most — this is the
 * only part of the extension that interrupts a person.
 */

import { describe, expect, it } from "vitest";
import {
  ALARM_BUDGET,
  BOOKING_HOUR,
  BOOKING_LAST_HOUR,
  MISSED_NOTICE_DAYS,
  SNOOZE_MS,
  alarmName,
  applySnooze,
  armable,
  buttonAction,
  deferPastQuietHours,
  inQuietHours,
  clampTitle,
  notificationContent,
  notificationId,
  parseAlarmName,
  parseNotificationId,
  planNotifications,
  recordFired,
  requiresInteraction,
  shouldFireNow,
  toastButtons,
  urgency,
} from "../src/core/schedule.js";
import type { Notified } from "../src/core/schedule.js";
import { DEFAULT_SETTINGS, normalizeQuietHours } from "../src/core/store.js";
import { OWN_TIME_NOTE, POST_TIME_NOTE, SOURCE_TIME_NOTE } from "../src/core/provenance.js";
import type { Item, RawItem, Settings, Status } from "../src/sources/types.js";

function member(status: Status, extra?: Record<string, string>): RawItem {
  return {
    source: "gradescope",
    sourceId: `m${Math.random()}`,
    courseRaw: "CS 357",
    title: "m",
    kind: "assignment",
    url: "https://www.gradescope.com/",
    status,
    extra,
    fetchedAt: "2026-09-10T18:00:00.000Z",
  };
}

function item(partial: Partial<Item> = {}): Item {
  return {
    id: partial.id ?? "item1",
    members: [member("not_submitted")],
    courseLabel: "CS357",
    title: "HW3 Errors and Big-O",
    kind: "assignment",
    url: "https://www.gradescope.com/courses/1/assignments/2",
    status: "not_submitted",
    hidden: false,
    done: false,
    notified: {},
    ...partial,
  };
}

// Thursday 2026-09-10, 6:00 PM local.
const NOW = new Date(2026, 8, 10, 18, 0, 0);
const local = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m, d, h, min).toISOString();

describe("alarm names", () => {
  it("round-trip, including ids containing colons", () => {
    expect(parseAlarmName(alarmName("abc:def", "24h"))).toEqual({ itemId: "abc:def", lead: "24h" });
    expect(parseAlarmName(alarmName("x", "booking"))).toEqual({ itemId: "x", lead: "booking" });
    expect(parseAlarmName("sync")).toBeUndefined();
    expect(parseAlarmName("notify:x:5h")).toBeUndefined();
  });
});

describe("quiet hours (§7)", () => {
  const quiet = { start: 23, end: 8 };

  it("recognises a window that wraps midnight", () => {
    expect(inQuietHours(new Date(2026, 8, 10, 23, 30), quiet)).toBe(true);
    expect(inQuietHours(new Date(2026, 8, 10, 3, 0), quiet)).toBe(true);
    expect(inQuietHours(new Date(2026, 8, 10, 8, 0), quiet)).toBe(false);
    expect(inQuietHours(new Date(2026, 8, 10, 21, 59), quiet)).toBe(false);
  });

  it("handles a same-day window and a disabled one", () => {
    expect(inQuietHours(new Date(2026, 8, 10, 13, 0), { start: 12, end: 14 })).toBe(true);
    expect(inQuietHours(new Date(2026, 8, 10, 15, 0), { start: 12, end: 14 })).toBe(false);
    expect(inQuietHours(new Date(2026, 8, 10, 3, 0), null)).toBe(false);
  });

  it("defers to the end of the window, next morning on the evening side", () => {
    const evening = deferPastQuietHours(new Date(2026, 8, 10, 23, 30), quiet);
    expect(evening.getDate()).toBe(11);
    expect(evening.getHours()).toBe(8);

    const morning = deferPastQuietHours(new Date(2026, 8, 11, 3, 0), quiet);
    expect(morning.getDate()).toBe(11);
    expect(morning.getHours()).toBe(8);
  });

  it("leaves a time outside the window alone", () => {
    const at = new Date(2026, 8, 10, 21, 59);
    expect(deferPastQuietHours(at, quiet).getTime()).toBe(at.getTime());
  });

  it("does not defer §7's own worked example", () => {
    // "A 2-hour lead for an 11:59 PM deadline fires at 9:59 PM, which is outside
    // the window, so the common case is unaffected."
    const due = new Date(2026, 8, 11, 23, 59);
    const [plan] = planNotifications(
      [item({ dueAt: due.toISOString() })],
      { ...DEFAULT_SETTINGS, leadTimes: ["2h"] },
      NOW,
    );
    expect(new Date(plan!.fireAt).getHours()).toBe(21);
    expect(new Date(plan!.fireAt).getMinutes()).toBe(59);
  });
});

describe("planNotifications (§7)", () => {
  const dueFri = local(2026, 8, 11, 17); // Friday 5pm, 23h away

  it("plans one alarm per enabled lead", () => {
    const plans = planNotifications([item({ dueAt: dueFri })], DEFAULT_SETTINGS, NOW);
    expect(plans.map((p) => p.lead).sort()).toEqual(["24h", "2h"]);
  });

  it("never interrupts anyone about a calendar event", () => {
    // Nothing is owed for an event, so there is nothing to be late for. The
    // block that prompted this recurred daily, so leaving events eligible is
    // two toasts a day about office hours — the fastest way to get muted.
    expect(planNotifications([item({ kind: "event", dueAt: dueFri })], DEFAULT_SETTINGS, NOW))
      .toEqual([]);
  });

  it("still interrupts about an exam taken from the same calendar feed", () => {
    // §4.1 promotes a calendar_event whose title says exam. That is the one
    // calendar row worth a reminder, and this change must not silence it.
    expect(
      planNotifications([item({ kind: "exam", dueAt: dueFri })], DEFAULT_SETTINGS, NOW).length,
    ).toBeGreaterThan(0);
  });

  it("honours the lead-time setting", () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, leadTimes: ["2h"] };
    expect(planNotifications([item({ dueAt: dueFri })], settings, NOW).map((p) => p.lead)).toEqual([
      "2h",
    ]);
  });

  it("marks a lead whose moment has passed as overdue rather than skipping it", () => {
    // §7's "Chrome was closed" case: the 24h mark for a deadline 23h away is in
    // the past, but the deadline is not, so it should still fire.
    const plans = planNotifications([item({ dueAt: dueFri })], DEFAULT_SETTINGS, NOW);
    expect(plans.find((p) => p.lead === "24h")!.overdue).toBe(true);
    expect(plans.find((p) => p.lead === "2h")!.overdue).toBe(false);
  });

  it("never fires stale once the deadline has passed", () => {
    expect(
      planNotifications([item({ dueAt: local(2026, 8, 9, 17) })], DEFAULT_SETTINGS, NOW),
    ).toEqual([]);
  });

  it("does not re-fire something already notified", () => {
    const plans = planNotifications(
      [item({ dueAt: dueFri, notified: { "24h": NOW.toISOString() } })],
      DEFAULT_SETTINGS,
      NOW,
    );
    expect(plans.map((p) => p.lead)).toEqual(["2h"]);
  });

  it("stays silent about hidden, finished and undated items", () => {
    expect(planNotifications([item({ dueAt: dueFri, hidden: true })], DEFAULT_SETTINGS, NOW)).toEqual([]);
    expect(
      planNotifications(
        [item({ dueAt: dueFri, status: "graded", members: [member("graded")] })],
        DEFAULT_SETTINGS,
        NOW,
      ),
    ).toEqual([]);
    expect(planNotifications([item({})], DEFAULT_SETTINGS, NOW)).toEqual([]);
  });

  it("still notifies a merged item whose other half is outstanding", () => {
    // Same trap as the popup's hideSubmitted: a merged item's status is its
    // most-done member, so testing that alone silences a live deadline.
    const mixed = item({
      dueAt: dueFri,
      status: "graded",
      members: [member("graded"), member("not_submitted")],
    });
    expect(planNotifications([mixed], DEFAULT_SETTINGS, NOW).length).toBeGreaterThan(0);
  });

  it("never defers a reminder past the thing it reminds about", () => {
    // A 2am deadline's 2h lead lands at midnight, inside quiet hours; deferring
    // to 08:00 would arrive six hours after the deadline.
    const plans = planNotifications(
      [item({ dueAt: local(2026, 8, 11, 2) })],
      { ...DEFAULT_SETTINGS, leadTimes: ["2h"] },
      NOW,
    );
    expect(plans).toEqual([]);
  });
});

describe("the booking nag (§7)", () => {
  const booking = (notified?: string) =>
    item({
      id: "b1",
      kind: "booking",
      title: "Book a slot: CS 357: Quiz 2",
      members: [
        member("not_submitted", {
          windowStart: "2026-09-21T05:01:00.000Z",
          windowEnd: "2026-09-24T04:59:00.000Z",
        }),
      ],
      notified: notified ? { booking: notified } : {},
    });

  it("fires immediately when today's nag has not gone out", () => {
    // 6pm, past 10:00, nothing fired today.
    const [plan] = planNotifications([booking()], DEFAULT_SETTINGS, NOW);
    expect(plan!.lead).toBe("booking");
    expect(plan!.overdue).toBe(true);
  });

  it("waits until tomorrow at 10:00 once today's has fired", () => {
    const [plan] = planNotifications(
      [booking(new Date(2026, 8, 10, 10, 0).toISOString())],
      DEFAULT_SETTINGS,
      NOW,
    );
    const at = new Date(plan!.fireAt);
    expect(at.getDate()).toBe(11);
    expect(at.getHours()).toBe(BOOKING_HOUR);
    expect(plan!.overdue).toBe(false);
  });

  it("schedules today at 10:00 when it is still early", () => {
    const early = new Date(2026, 8, 10, 7, 0);
    const [plan] = planNotifications([booking()], DEFAULT_SETTINGS, early);
    const at = new Date(plan!.fireAt);
    expect(at.getDate()).toBe(10);
    expect(at.getHours()).toBe(BOOKING_HOUR);
  });

  it("nags regardless of date, since a booking has no real deadline", () => {
    // §4.4: dueAt on a booking is deliberately early, not a deadline, so the
    // "never fire stale" rule must not silence it.
    const past = booking();
    past.dueAt = local(2026, 8, 1, 0);
    // Rewritten 2026-09-27: this asserted exactly one plan, which pinned the
    // absence of I40's last-day reminder rather than the daily nag. The nag is
    // what this test is about; `bookingLast` (armed for Sep 23 at 18:00) is the
    // intended addition, pinned in "the booking nag escalates" below.
    const plans = planNotifications([past], DEFAULT_SETTINGS, NOW);
    expect(plans.filter((p) => p.lead === "booking")).toHaveLength(1);
    expect(plans.map((p) => p.lead).sort()).toEqual(["booking", "bookingLast"]);
  });
});

describe("notificationContent", () => {
  it("leads with the work, not with the course code", () => {
    /*
     * ux-plan m15. The old title was `CS357 — assignment due in 2 hours`: the
     * course code is the one thing a student already knows, and it went first,
     * while the thing they have to act on went into the message where Chrome
     * sets it smaller.
     */
    const content = notificationContent(item({ dueAt: local(2026, 8, 11, 17) }), "24h", NOW);
    expect(content.title).toBe("HW3 Errors and Big-O — due tomorrow");
    // Rewritten 2026-09-27: this asserted the raw "CS357", which is the
    // un-resolved form the popup never shows (copy-audit #3). See "names the
    // course the way the popup does" below.
    expect(content.message).toContain("CS 357");
    expect(content.url).toContain("gradescope.com");
  });

  it("says which site to go to", () => {
    // A student with five sources had to open the popup to find out where a
    // reminder came from.
    const content = notificationContent(item({ dueAt: local(2026, 8, 11, 17) }), "24h", NOW);
    expect(content.contextMessage).toBe("Gradescope");
  });

  it("tells you where an exam is, which the parser has known all along", () => {
    const exam = notificationContent(
      item({
        kind: "exam",
        title: "CS 357: Quiz 1",
        dueAt: local(2026, 8, 11, 19),
        members: [member("not_submitted", { location: "Grainger Library", duration: "50min" })],
      }),
      "24h",
      NOW,
    );
    expect(exam.message).toContain("Grainger Library");
  });

  it("keeps the urgency when the title is longer than the toast", () => {
    /*
     * "MP1 Report (4cr only, EXCEPT for students in MC3)" is 48 characters
     * before anything is said about when it is due — so without a clamp the
     * words a student acts on are the ones Chrome drops.
     */
    const long = notificationContent(
      item({
        title: "MP1 Report (4cr only, EXCEPT for students in MC3)",
        dueAt: local(2026, 8, 11, 17),
      }),
      "24h",
      NOW,
    );
    expect(long.title).toContain("due tomorrow");
    expect(long.title).toContain("…");
    expect(long.title.length).toBeLessThan(64);
  });

  it("does not cut a title mid-number", () => {
    // "HW12" clipped to "HW1" is not a shorter title, it is a different one.
    expect(clampTitle("Homework twelve is a reasonably long name HW12", 44)).not.toMatch(/HW1$/);
  });

  it("leaves a title that already fits completely alone", () => {
    expect(clampTitle("HW3 Errors and Big-O")).toBe("HW3 Errors and Big-O");
    expect(clampTitle("HW3 Errors and Big-O")).not.toContain("…");
  });

  it("never phrases a booking as a deadline (§4.4)", () => {
    const content = notificationContent(
      item({
        kind: "booking",
        title: "Book a slot: CS 357: Quiz 2",
        members: [
          member("not_submitted", {
            windowStart: "2026-09-21T05:01:00.000Z",
            windowEnd: "2026-09-24T04:59:00.000Z",
          }),
        ],
      }),
      "booking",
      NOW,
    );
    // The verb leads: there is exactly one thing to do about this one.
    expect(content.title).toBe("Book a seat: CS 357: Quiz 2");
    expect(content.message).toMatch(/sessions /);
    expect(content.title).not.toMatch(/\bdue\b/i);
    expect(content.message).not.toMatch(/\bdue\b/i);
  });
});

describe("regressions found by the steps 9–12 review", () => {
  it("does not fire a catch-up reminder during quiet hours", () => {
    // The worker branched on `overdue` and ignored `fireAt`, so a reminder whose
    // moment passed while the student slept fired the instant Chrome woke — at
    // 02:30 — discarding the deferral planNotifications had just computed.
    const night = new Date(2026, 8, 11, 2, 30);
    const [plan] = planNotifications(
      [item({ dueAt: local(2026, 8, 11, 20) })],
      { ...DEFAULT_SETTINGS, leadTimes: ["24h"] },
      night,
    );
    expect(plan!.overdue).toBe(true);
    expect(new Date(plan!.fireAt).getHours()).toBe(8);
    expect(shouldFireNow(plan!, night)).toBe(false);
    expect(shouldFireNow(plan!, new Date(2026, 8, 11, 8, 0))).toBe(true);
  });

  it("fires a catch-up immediately when it is not quiet hours", () => {
    const morning = new Date(2026, 8, 11, 9, 0);
    const [plan] = planNotifications(
      [item({ dueAt: local(2026, 8, 11, 20) })],
      { ...DEFAULT_SETTINGS, leadTimes: ["24h"] },
      morning,
    );
    expect(shouldFireNow(plan!, morning)).toBe(true);
  });

  it("notifies about a late window with no full-credit deadline, and does not call it 'due'", () => {
    // §4.3's shape: dueAt undefined, lateDueAt set. grouping.ts and ics.ts both
    // treat it as live; §7 read dueAt alone and stayed silent.
    const late = item({
      dueAt: undefined,
      lateDueAt: local(2026, 8, 11, 17),
      members: [member("not_submitted", { creditRemaining: "80" })],
    });
    const plans = planNotifications(late ? [late] : [], DEFAULT_SETTINGS, NOW);
    expect(plans.length).toBeGreaterThan(0);
    // A full-credit lead reaching this shape (one planned before `dueAt` went)
    // is still about the window. copy-audit #15: "the one noun is 'late
    // window'" — this said "reduced credit", which no other surface did.
    const content = notificationContent(late, "24h", NOW);
    expect(content.title).toBe("HW3 Errors and Big-O — late window closes tomorrow");
    expect(content.title).not.toMatch(/\bdue\b/);
    expect(content.message).toBe("CS 357 · 80% until Fri 5:00 PM · in 23h");
  });

  it("clamps an out-of-range or degenerate quiet-hours window", () => {
    expect(normalizeQuietHours({ start: 99, end: 8 })).toEqual({ start: 23, end: 8 });
    expect(normalizeQuietHours({ start: 23, end: -4 })).toEqual({ start: 23, end: 8 });
    expect(normalizeQuietHours({ start: 1.5, end: 8 })).toEqual({ start: 23, end: 8 });
    // A zero-length window reads as "off" to inQuietHours, so say so rather than
    // leaving the checkbox on over a window that does nothing.
    expect(normalizeQuietHours({ start: 0, end: 0 })).toBeNull();
    expect(normalizeQuietHours(null)).toBeNull();
    // {23, 0} is a legitimate one-hour window; it cannot be distinguished from a
    // cleared input here, which is why the options page refuses to send a blank.
    expect(normalizeQuietHours({ start: 23, end: 0 })).toEqual({ start: 23, end: 0 });
    expect(normalizeQuietHours({ start: 22, end: 7 })).toEqual({ start: 22, end: 7 });
  });
});

describe("catch-up after Chrome was closed (§7)", () => {
  // The trace this exists for: the laptop has been shut since Tuesday and is
  // opened at 08:30 on Thursday with CS 357 HW3 due at 09:00. Both the 24h and
  // the 2h moment passed while it was closed.
  const NOW_0830 = new Date(2026, 8, 10, 8, 30);
  const dueAt0900 = new Date(2026, 8, 10, 9, 0).toISOString();
  const quiet = { ...DEFAULT_SETTINGS, quietHours: null };

  it("fires one reminder, not one per overdue lead", () => {
    const plans = planNotifications([item({ dueAt: dueAt0900 })], quiet, NOW_0830);
    expect(plans).toHaveLength(1);
  });

  it("keeps the most urgent lead, which is the only one still saying anything true", () => {
    const [plan] = planNotifications([item({ dueAt: dueAt0900 })], quiet, NOW_0830);
    expect(plan!.lead).toBe("2h");
    expect(plan!.superseded).toEqual(["24h"]);
  });

  it("words the title from the clock, not from which alarm fired", () => {
    // The defect: the title was `lead === "24h" ? "tomorrow" : "in 2 hours"`, so
    // a 24h lead firing 30 minutes before the deadline announced "due tomorrow".
    const content = notificationContent(item({ dueAt: dueAt0900 }), "24h", NOW_0830);
    expect(content.title).toBe("HW3 Errors and Big-O — due in 30 minutes");
    expect(content.title).not.toContain("tomorrow");
  });

  it("leaves a lead whose moment is still ahead with its own alarm", () => {
    // Due in 10 hours: the 24h moment has passed, the 2h moment has not, so
    // there is nothing to collapse and the 2h reminder must survive.
    const dueLater = new Date(2026, 8, 10, 18, 30).toISOString();
    const plans = planNotifications([item({ dueAt: dueLater })], quiet, NOW_0830);
    expect(plans.map((p) => p.lead).sort()).toEqual(["24h", "2h"]);
    expect(plans.find((p) => p.lead === "24h")!.overdue).toBe(true);
    expect(plans.find((p) => p.lead === "2h")!.overdue).toBe(false);
    expect(plans.find((p) => p.lead === "24h")!.superseded).toEqual([]);
  });

  it("gives a booking nag an empty superseded list rather than undefined", () => {
    const booking = planNotifications(
      [item({ kind: "booking", dueAt: dueAt0900 })],
      quiet,
      NOW_0830,
    );
    expect(booking[0]!.superseded).toEqual([]);
  });
});

describe("urgency", () => {
  const now = new Date(2026, 8, 10, 18, 0);
  const at = (m: number, d: number, h: number, min = 0) =>
    new Date(2026, m, d, h, min);

  it("counts minutes inside the hour", () => {
    expect(urgency(at(8, 10, 18, 40), now)).toBe("in 40 minutes");
    expect(urgency(at(8, 10, 18, 1), now)).toBe("in 1 minute");
  });

  it("prefers the clock over the calendar for something due within the hour", () => {
    // 08:30 today, due 09:00 today — but the same rule must hold across
    // midnight, which is where "tomorrow" used to win and lose the deadline.
    const lateNight = new Date(2026, 8, 10, 23, 45);
    expect(urgency(at(8, 11, 0, 15), lateNight)).toBe("in 30 minutes");
  });

  it("says tomorrow when it really is the next day", () => {
    expect(urgency(at(8, 11, 17), now)).toBe("tomorrow");
  });

  it("does not call the day after tomorrow tomorrow, however few hours away", () => {
    // 23:00 Monday + 25h is Wednesday, and an hours-based rule would say
    // "tomorrow" for it.
    const lateMonday = new Date(2026, 8, 7, 23, 0);
    expect(urgency(at(8, 9, 0, 30), lateMonday)).toBe("in 2 days");
  });

  it("keeps hours for something later the same day", () => {
    expect(urgency(at(8, 10, 23), now)).toBe("in 5 hours");
  });

  it("says now rather than a negative count once the deadline has passed", () => {
    expect(urgency(at(8, 10, 17), now)).toBe("now");
  });

  it("does not throw on an unparseable instant", () => {
    expect(urgency(new Date("nonsense"), now)).toBe("soon");
    expect(urgency(undefined, now)).toBe("soon");
  });
});

describe("reminders for a late window (§4.2, §4.3)", () => {
  const quiet = { ...DEFAULT_SETTINGS, quietHours: null };
  // Full credit gone Wednesday, Gradescope still accepting until next Wednesday.
  const late = () =>
    item({
      dueAt: new Date(2026, 8, 9, 17).toISOString(),
      lateDueAt: new Date(2026, 8, 16, 17).toISOString(),
    });

  it("plans reminders for the window that is still open", () => {
    // The defect: `dueAt ?? lateDueAt` returned the expired full-credit instant,
    // the loop bailed out on "past the deadline", and nothing was ever planned
    // for the window the student could still meet.
    const plans = planNotifications([late()], quiet, new Date(2026, 8, 10, 12));
    expect(plans.map((p) => p.lead).sort()).toEqual(["late24h", "late2h"]);
  });

  it("is not suppressed by the full-credit lead having already fired", () => {
    const item0 = late();
    item0.notified = { "24h": "2026-09-08T17:00:00Z", "2h": "2026-09-09T20:00:00Z" };
    const plans = planNotifications([item0], quiet, new Date(2026, 8, 10, 12));
    expect(plans).toHaveLength(2);
  });

  it("words it as a closing window, never as a due date", () => {
    const content = notificationContent(late(), "late24h", new Date(2026, 8, 15, 17));
    expect(content.title).toContain("late window closes");
    expect(content.title).not.toMatch(/— due /);
    // Gradescope states a late date and never a credit, so the body says the
    // window's time the way the row does, with no percent invented for it
    // (`creditWindowText`, copy-audit #15).
    expect(content.message).toBe("CS 357 · late until Wed 5:00 PM · in 1d");
  });

  it("counts down to the late window, not the full-credit deadline already passed", () => {
    // The defect: content read `dueAt ?? lateDueAt`, so with `dueAt` present a
    // late lead counted down to Sep 9 — "late window closes now", a day early.
    // The window closes at 11 PM, not the full-credit 5 PM, so the two instants
    // cannot be mistaken for each other by weekday or clock either.
    const item0 = item({
      dueAt: new Date(2026, 8, 9, 17).toISOString(),
      lateDueAt: new Date(2026, 8, 16, 23).toISOString(),
    });
    const content = notificationContent(item0, "late24h", new Date(2026, 8, 15, 23));
    expect(content.title).toBe("HW3 Errors and Big-O — late window closes tomorrow");
    expect(content.message).toContain("in 1d");
    expect(content.message).not.toContain("now");
  });

  it("counts a full-credit lead down to the full-credit deadline, not the late one", () => {
    // The other half of the rule above: while full credit is still ahead, the
    // 24h lead is about `dueAt`, and a late window behind it must not stretch it.
    const item0 = item({
      dueAt: new Date(2026, 8, 9, 17).toISOString(),
      lateDueAt: new Date(2026, 8, 16, 23).toISOString(),
    });
    const content = notificationContent(item0, "24h", new Date(2026, 8, 8, 17));
    expect(content.title).toBe("HW3 Errors and Big-O — due tomorrow");
    expect(content.message).toContain("in 1d");
  });

  it("names the credit at stake when PrairieLearn stated one", () => {
    const pl = item({
      dueAt: new Date(2026, 8, 8, 11).toISOString(),
      lateDueAt: new Date(2026, 8, 22, 23).toISOString(),
      members: [member("not_submitted", { creditRemaining: "80" })],
    });
    // copy-audit #15: one noun in the title, and the window as a time in the
    // one spelling every popup surface uses — "80% until Tue 11:00 PM", where
    // the toast alone said "80% credit until tomorrow".
    const content = notificationContent(pl, "late24h", new Date(2026, 8, 21, 23));
    expect(content.title).toBe("HW3 Errors and Big-O — late window closes tomorrow");
    expect(content.message).toBe("CS 357 · 80% until Tue 11:00 PM · in 1d");
  });

  it("round-trips the new lead names through the alarm name", () => {
    expect(parseAlarmName(alarmName("abc", "late24h"))).toEqual({
      itemId: "abc",
      lead: "late24h",
    });
    expect(parseAlarmName(alarmName("abc", "late2h"))!.lead).toBe("late2h");
    // The bare names must still parse to themselves rather than being eaten by
    // the new alternation.
    expect(parseAlarmName(alarmName("abc", "24h"))!.lead).toBe("24h");
  });

  it("stops once the late window has passed too", () => {
    expect(planNotifications([late()], quiet, new Date(2026, 8, 20, 12))).toEqual([]);
  });
});

describe("reminders for a time this extension invented (§4.5, worker rule 3)", () => {
  const quiet = { ...DEFAULT_SETTINGS, quietHours: null };
  // CS 424: the schedule prints "HW2 Due" against a bare date, so the runner
  // fills in 23:59 and flags it.
  const assumed = () =>
    item({ dueAt: new Date(2026, 8, 18, 23, 59).toISOString(), timeAssumed: true });

  it("never plans a 2-hour countdown against an instant it invented", () => {
    // If the real cutoff is 5 PM, a 2h lead fires at 9:59 PM — three hours after
    // the work was late, in the confident voice of a real deadline.
    const plans = planNotifications([assumed()], quiet, new Date(2026, 8, 17, 12));
    expect(plans.map((p) => p.lead)).toEqual(["dayOf"]);
  });

  it("puts the one reminder on the morning of the day it is due", () => {
    const plans = planNotifications([assumed()], quiet, new Date(2026, 8, 17, 12));
    const fireAt = new Date(plans[0]!.fireAt);
    expect(fireAt.getDate()).toBe(18);
    expect(fireAt.getHours()).toBe(0);
  });

  it("still respects quiet hours, which is what puts it at 08:00", () => {
    const plans = planNotifications(
      [assumed()],
      { ...DEFAULT_SETTINGS, quietHours: { start: 23, end: 8 } },
      new Date(2026, 8, 17, 12),
    );
    expect(new Date(plans[0]!.fireAt).getHours()).toBe(8);
  });

  it("does not fire once, then fire again on the next pass", () => {
    const already = assumed();
    already.notified = { dayOf: "2026-09-18T13:00:00Z" };
    expect(planNotifications([already], quiet, new Date(2026, 8, 18, 12))).toEqual([]);
  });

  it("says no time in the toast, and shows no clock", () => {
    const content = notificationContent(assumed(), "dayOf", new Date(2026, 8, 18, 8));
    expect(content.message).toContain("no time");
    expect(content.title).not.toContain("11:59");
    expect(content.title).not.toContain("in 2 hours");
  });

  it("sends the student to whoever left the hour out (copy-audit #4)", () => {
    // The toast said "check the course page for the cutoff" for every assumed
    // time, including a post's day — whose course page says nothing of the kind
    // — and the student's own row, which has no page at all.
    const morning = new Date(2026, 8, 18, 8);
    expect(notificationContent(assumed(), "dayOf", morning).message).toBe(`CS 357 · ${SOURCE_TIME_NOTE}`);

    const fromPost = item({
      dueAt: new Date(2026, 8, 18, 23, 59).toISOString(),
      timeAssumed: true,
      movedBy: { reason: "Piazza post", postId: "pz-1" },
    });
    const post = notificationContent(fromPost, "dayOf", morning).message;
    expect(post).toBe(`CS 357 · ${POST_TIME_NOTE}`);
    expect(post).not.toContain("course page");

    const own = item({
      dueAt: new Date(2026, 8, 18, 23, 59).toISOString(),
      timeAssumed: true,
      members: [{ ...member("unknown"), source: "manual" }],
    });
    expect(notificationContent(own, "dayOf", morning).message).toBe(`CS 357 · ${OWN_TIME_NOTE}`);
  });

  it("leaves an item with a stated time on the normal leads", () => {
    const stated = item({ dueAt: new Date(2026, 8, 18, 17).toISOString() });
    const plans = planNotifications([stated], quiet, new Date(2026, 8, 17, 12));
    expect(plans.map((p) => p.lead).sort()).toEqual(["24h", "2h"]);
  });

  it("round-trips dayOf through the alarm name", () => {
    expect(parseAlarmName(alarmName("abc", "dayOf"))).toEqual({ itemId: "abc", lead: "dayOf" });
  });
});

describe("reminders for work the student ticked off", () => {
  const quiet = { ...DEFAULT_SETTINGS, quietHours: null };
  const soon = new Date(2026, 8, 11, 17).toISOString();

  it("plans nothing once it is ticked", () => {
    const ticked = item({ dueAt: soon, done: true, members: [member("unknown")] });
    expect(planNotifications([ticked], quiet, new Date(2026, 8, 10, 12))).toEqual([]);
  });

  it("still reminds when a source says the work is missing", () => {
    // The tick must not be able to silence a deadline the source says is
    // outstanding — that would be a silent miss the student caused themselves.
    const contradicted = item({ dueAt: soon, done: true, members: [member("missing")] });
    expect(planNotifications([contradicted], quiet, new Date(2026, 8, 10, 12)).length).toBeGreaterThan(0);
  });
});

describe("reminders for not-for-credit work (§4.3)", () => {
  const quiet = { ...DEFAULT_SETTINGS, quietHours: null };
  const now = new Date(2026, 8, 10, 12);
  const practice = () =>
    item({ dueAt: new Date(2026, 8, 11, 17).toISOString(), forCredit: false });

  it("stays quiet by default", () => {
    expect(planNotifications([practice()], quiet, now)).toEqual([]);
  });

  it("reminds when the student asks for it", () => {
    const on = { ...quiet, remindNotForCredit: true };
    expect(planNotifications([practice()], on, now).length).toBeGreaterThan(0);
  });

  it("still reminds about work that counts", () => {
    const real = item({ dueAt: new Date(2026, 8, 11, 17).toISOString() });
    expect(planNotifications([real], quiet, now).length).toBeGreaterThan(0);
  });
});

/**
 * The half of Sushi's 2026-09-21 decision that must NOT move.
 *
 * "if its late it should show up in late no matter what even if its 80%" is
 * about where a row is drawn and what it is called. What is *planned* against
 * it still follows `liveDeadline`: a reminder must fire for the 80% date, or
 * the row is announced as late and then silently misses the money that is
 * still on offer — which is the defect `liveDeadline`'s comment records.
 */
describe("a row banded Late still plans for its reduced-credit window", () => {
  const quiet = { ...DEFAULT_SETTINGS, quietHours: null, leadTimes: ["24h" as const] };
  const now = new Date(2026, 8, 10, 12);
  // Full credit went yesterday at 5 PM; 80% runs to Sep 12 at 11:59 PM.
  const mp = () =>
    item({
      dueAt: local(2026, 8, 9, 17),
      lateDueAt: local(2026, 8, 12, 23, 59),
      members: [member("not_submitted", { creditRemaining: "80" })],
    });

  it("plans the 24h lead against the late date, not the one that passed", () => {
    const planned = planNotifications([mp()], quiet, now);
    expect(planned).toHaveLength(1);
    expect(planned[0]!.fireAt).toBe(new Date(2026, 8, 11, 23, 59).toISOString());
  });

  it("plans nothing once the late window has gone too", () => {
    // §7: past the deadline a reminder is noise. The banding does not change
    // which deadline that sentence is about.
    expect(planNotifications([mp()], quiet, new Date(2026, 8, 13, 12))).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Lane H, 2026-09-27: budget, buttons, week-out, booking escalation, wording  */
/* -------------------------------------------------------------------------- */

describe("the alarm budget (I28)", () => {
  // Chrome 117+ refuses an extension's 501st alarm, and `reschedule` armed one
  // per (item, lead) in an awaited loop: the create that failed threw, and
  // every reminder after it was never armed, silently.
  const quiet = { ...DEFAULT_SETTINGS, quietHours: null, leadTimes: ["24h" as const] };
  // Latest first, so an implementation that keeps the first N plans *as given*
  // arms December and drops tomorrow.
  const many = Array.from({ length: 600 }, (_, i) =>
    item({ id: `i${i}`, dueAt: new Date(NOW.getTime() + (600 - i + 2) * 86_400_000).toISOString() }),
  );

  it("arms at most the budget, soonest first, and counts what is left over", () => {
    const plans = planNotifications(many, quiet, NOW);
    expect(plans).toHaveLength(600);
    const { armed, overflow } = armable(plans);
    expect(ALARM_BUDGET).toBe(400);
    expect(armed).toHaveLength(400);
    expect(overflow).toBe(200);
    const latestArmed = Math.max(...armed.map((p) => Date.parse(p.fireAt)));
    const armedNames = new Set(armed.map((p) => p.alarmName));
    const earliestLeft = Math.min(
      ...plans.filter((p) => !armedNames.has(p.alarmName)).map((p) => Date.parse(p.fireAt)),
    );
    expect(latestArmed).toBeLessThan(earliestLeft);
    // The soonest reminder of all is among them.
    expect(armedNames.has(alarmName("i599", "24h"))).toBe(true);
  });

  it("arms everything, and reports no overflow, under the budget", () => {
    const plans = planNotifications(many.slice(0, 10), quiet, NOW);
    expect(armable(plans)).toEqual({ armed: expect.any(Array), overflow: 0 });
    expect(armable(plans).armed).toHaveLength(10);
  });
});

describe("toast buttons (I13)", () => {
  const due = local(2026, 8, 10, 20); // two hours after NOW

  it("carries Snooze and Done on a deadline reminder, and never more than Chrome's two", () => {
    // chrome.notifications allows at most two buttons; Open is the toast body.
    expect(toastButtons("2h").map((b) => b.title)).toEqual(["Snooze 1h", "Done"]);
    expect(toastButtons("dayOf").map((b) => b.action)).toEqual(["snooze", "done"]);
    for (const lead of ["24h", "2h", "late24h", "late2h", "dayOf", "7d", "booking", "bookingLast", "bookingMissed", "snooze"] as const) {
      expect(toastButtons(lead).length).toBeLessThanOrEqual(2);
    }
  });

  it("offers no Done on a booking nag, whose item leaves by itself once booked (§4.4)", () => {
    expect(toastButtons("booking").map((b) => b.action)).toEqual(["snooze"]);
    expect(toastButtons("bookingMissed")).toEqual([]);
  });

  it("keeps the last reminder before a deadline up until it is answered", () => {
    expect(requiresInteraction("2h")).toBe(true);
    expect(requiresInteraction("late2h")).toBe(true);
    expect(requiresInteraction("bookingLast")).toBe(true);
    expect(requiresInteraction("24h")).toBe(false);
    expect(requiresInteraction("7d")).toBe(false);
  });

  it("round-trips the toast id, and refuses one it did not write", () => {
    const id = notificationId("abc", "late2h", NOW);
    expect(parseNotificationId(id)).toEqual({ itemId: "abc", lead: "late2h" });
    expect(parseNotificationId(`test:${NOW.getTime()}`)).toBeUndefined();
    expect(parseNotificationId("abc:5h:1")).toBeUndefined();
  });

  it("maps a press to snooze-for-an-hour or the student's own tick", () => {
    const id = notificationId("item1", "2h", NOW);
    expect(buttonAction(id, 0, NOW)).toEqual({
      kind: "snooze",
      itemId: "item1",
      until: new Date(NOW.getTime() + SNOOZE_MS).toISOString(),
    });
    expect(SNOOZE_MS).toBe(60 * 60 * 1000);
    expect(buttonAction(id, 1, NOW)).toEqual({ kind: "done", itemId: "item1" });
    expect(buttonAction(notificationId("b1", "booking", NOW), 1, NOW)).toBeUndefined();
    expect(buttonAction("nonsense", 0, NOW)).toBeUndefined();
  });

  it("re-plans a snoozed reminder once, an hour on, and not the lead it came from", () => {
    // §7 amendment: "once each" still holds per lead — the 2h lead is spent; the
    // snooze is its own, single, student-requested reminder.
    const at = NOW.toISOString();
    const snoozed = item({
      dueAt: due,
      notified: applySnooze({ "24h": at, "2h": at }, new Date(NOW.getTime() + SNOOZE_MS)),
    });
    const plans = planNotifications([snoozed], DEFAULT_SETTINGS, NOW);
    expect(plans.map((p) => p.lead)).toEqual(["snooze"]);
    expect(plans[0]!.fireAt).toBe(new Date(NOW.getTime() + SNOOZE_MS).toISOString());
    expect(plans[0]!.overdue).toBe(false);
    expect(parseAlarmName(plans[0]!.alarmName)).toEqual({ itemId: "item1", lead: "snooze" });

    // Once it fires, it is spent.
    snoozed.notified = recordFired(snoozed.notified, plans[0]!, new Date(NOW.getTime() + SNOOZE_MS).toISOString());
    expect(planNotifications([snoozed], DEFAULT_SETTINGS, new Date(NOW.getTime() + SNOOZE_MS))).toEqual([]);
  });

  it("never snoozes past the deadline it reminds about (worker rule 3)", () => {
    const soon = item({
      dueAt: local(2026, 8, 10, 18, 30),
      notified: applySnooze(
        { "24h": NOW.toISOString(), "2h": NOW.toISOString() },
        new Date(NOW.getTime() + SNOOZE_MS),
      ),
    });
    expect(planNotifications([soon], DEFAULT_SETTINGS, NOW)).toEqual([]);
  });

  it("drops a snooze once the student ticks the row off", () => {
    const ticked = item({
      dueAt: due,
      done: true,
      members: [member("unknown")],
      notified: applySnooze({}, new Date(NOW.getTime() + SNOOZE_MS)),
    });
    expect(planNotifications([ticked], DEFAULT_SETTINGS, NOW)).toEqual([]);
  });

  it("ignores a stored snooze instant that is not one (parser rule 5)", () => {
    for (const bad of ["", "2026-09-10", "tomorrow"]) {
      const stored: Notified = { "24h": "x", "2h": "x", snoozeUntil: bad };
      const odd = item({ dueAt: due, notified: stored });
      expect(planNotifications([odd], DEFAULT_SETTINGS, NOW)).toEqual([]);
    }
  });

  it("collapses a snooze and a lead whose moments both passed into one toast", () => {
    // 24h fired and was snoozed; Chrome was then closed across both the snooze
    // and the 2h moment. One reminder, and it is the one the student asked for.
    const at = new Date(2026, 8, 10, 12).toISOString();
    const closed = item({
      dueAt: local(2026, 8, 10, 19),
      notified: applySnooze({ "24h": at }, new Date(2026, 8, 10, 13)),
    });
    const plans = planNotifications([closed], { ...DEFAULT_SETTINGS, quietHours: null }, NOW);
    expect(plans.map((p) => p.lead)).toEqual(["snooze"]);
    expect(plans[0]!.superseded).toEqual(["2h"]);
    const after = recordFired(closed.notified, plans[0]!, NOW.toISOString());
    expect(after["2h"]).toBe(NOW.toISOString());
    expect(after.snoozeUntil).toBeUndefined();
  });

  it("words a snoozed toast from the live deadline, like the lead it replaced", () => {
    const content = notificationContent(item({ dueAt: due }), "snooze", new Date(2026, 8, 10, 19));
    expect(content.title).toBe("HW3 Errors and Big-O — due in 1 hour");
    // A snoozed late reminder is still about the closing window (§4.3), not
    // about the full-credit deadline that already passed.
    const late = item({ dueAt: local(2026, 8, 9, 17), lateDueAt: due });
    expect(notificationContent(late, "snooze", new Date(2026, 8, 10, 19)).title).toBe(
      "HW3 Errors and Big-O — late window closes in 1 hour",
    );
  });
});

describe("the week-out reminder for an exam (I18)", () => {
  const quiet = { ...DEFAULT_SETTINGS, quietHours: null };
  const exam = (partial: Partial<Item> = {}) =>
    item({
      kind: "exam",
      title: "CS 357: Quiz 1",
      dueAt: local(2026, 8, 20, 19), // Sunday Sep 20, 7 PM
      members: [member("unknown", { location: "Grainger Library", duration: "50min" })],
      ...partial,
    });

  it("plans a seventh-day lead for an exam, on top of the configured ones", () => {
    const plans = planNotifications([exam()], quiet, NOW);
    expect(plans.map((p) => p.lead).sort()).toEqual(["24h", "2h", "7d"]);
    expect(plans.find((p) => p.lead === "7d")!.fireAt).toBe(local(2026, 8, 13, 19));
  });

  it("keeps 24h and 2h for everything else", () => {
    const hw = item({ dueAt: local(2026, 8, 20, 19) });
    expect(planNotifications([hw], quiet, NOW).map((p) => p.lead).sort()).toEqual(["24h", "2h"]);
  });

  it("never counts a week down to a time this code invented", () => {
    /*
     * Until 2026-10-01 this said an assumed exam gets no week-out at all. The
     * requirement is the test's name: no countdown to an invented 23:59. A
     * week-out planned off the *day* — the morning a week before, worded with
     * the date and no clock — is not one, and without it an in-class midterm
     * or a CBTF quiz window, the rows a course page dates without a clock, had
     * no runway at all (Sushi: "add reminders for quizzes too").
     */
    const assumed = exam({ timeAssumed: true, dueAt: local(2026, 8, 20, 23, 59) });
    const plans = planNotifications([assumed], quiet, NOW);
    expect(plans.map((p) => p.lead).sort()).toEqual(["7d", "dayOf"]);
    expect(plans.find((p) => p.lead === "7d")!.fireAt).toBe(local(2026, 8, 13, 0));
    const content = notificationContent(assumed, "7d", new Date(2026, 8, 13, 8));
    expect(content.title).toBe("CS 357: Quiz 1 is in a week");
    expect(content.message.startsWith("CS 357 · Sun, Sep 20 · ")).toBe(true);
    expect(content.message).not.toMatch(/\d:\d\d|11:59/);
  });

  it("does not plan a week-out by the day once that morning has gone", () => {
    // Due in four days with no stated time: a "week out" toast now would be
    // stale, and the day-of reminder is the honest one.
    const soon = exam({ timeAssumed: true, dueAt: local(2026, 8, 14, 23, 59) });
    expect(planNotifications([soon], quiet, NOW).map((p) => p.lead)).toEqual(["dayOf"]);
  });

  it("gives a by-the-day week-out only to a sitting, and only with leads on", () => {
    const hw = item({ timeAssumed: true, dueAt: local(2026, 8, 20, 23, 59) });
    expect(planNotifications([hw], quiet, NOW).map((p) => p.lead)).toEqual(["dayOf"]);
    const assumed = exam({ timeAssumed: true, dueAt: local(2026, 8, 20, 23, 59) });
    expect(planNotifications([assumed], { ...quiet, leadTimes: [] }, NOW).map((p) => p.lead)).toEqual([
      "dayOf",
    ]);
  });

  it("never plans the by-the-day week-out off a late window either", () => {
    // The twin of the late-window case above, for a sitting with no stated
    // time. Deliberately unrealistic for the same reason: no exam source states
    // a late window, so this is the only way to reach the `!live.late` gate.
    const odd = exam({
      timeAssumed: true,
      dueAt: local(2026, 8, 9, 23, 59),
      lateDueAt: local(2026, 8, 20, 23, 59),
    });
    expect(planNotifications([odd], quiet, NOW).map((p) => p.lead)).not.toContain("7d");
  });

  it("does not plan the by-the-day week-out twice", () => {
    const assumed = exam({
      timeAssumed: true,
      dueAt: local(2026, 8, 20, 23, 59),
      notified: { "7d": "2026-09-13T13:00:00.000Z" },
    });
    expect(planNotifications([assumed], quiet, NOW).map((p) => p.lead)).toEqual(["dayOf"]);
  });

  describe("a quiz a course site lists", () => {
    // Sushi, 2026-10-01: "add reminders for quizzes too" — the CBTF quizzes
    // that are on the Exams tab get the exam's week-out lead.
    const quiz = (source: RawItem["source"], partial: Partial<Item> = {}) =>
      item({
        kind: "quiz",
        title: "Quiz 3",
        dueAt: local(2026, 8, 20, 19),
        members: [{ ...member("unknown"), source, kind: "quiz", title: "Quiz 3" }],
        ...partial,
      });

    it("gets the week-out lead", () => {
      expect(planNotifications([quiz("site")], quiet, NOW).map((p) => p.lead).sort()).toEqual([
        "24h",
        "2h",
        "7d",
      ]);
    });

    it("gets it by the day when the page gave no time", () => {
      const assumed = quiz("site", { timeAssumed: true, dueAt: local(2026, 8, 20, 23, 59) });
      expect(planNotifications([assumed], quiet, NOW).map((p) => p.lead).sort()).toEqual([
        "7d",
        "dayOf",
      ]);
    });

    it("is the course site's only — a PrairieLearn quiz is homework and gets none", () => {
      expect(planNotifications([quiz("prairielearn")], quiet, NOW).map((p) => p.lead).sort()).toEqual([
        "24h",
        "2h",
      ]);
    });
  });

  it("stays silent when the student turned the lead times off", () => {
    expect(planNotifications([exam()], { ...quiet, leadTimes: [] }, NOW)).toEqual([]);
  });

  it("is about the sitting, never about a late window", () => {
    // Deliberately unrealistic — no exam source states a late window — so that
    // the `!live.late` gate is reachable: a week-out lead aimed at a late
    // instant would count down to something that is not an exam.
    const odd = exam({ dueAt: local(2026, 8, 9, 19), lateDueAt: local(2026, 8, 20, 19) });
    expect(planNotifications([odd], quiet, NOW).map((p) => p.lead).sort()).toEqual([
      "late24h",
      "late2h",
    ]);
  });

  it("collapses a passed week-out into the 24h lead, and leaves the 2h lead its own alarm", () => {
    // The `!plan.overdue` clause in collapseOverdue, unreachable with two leads:
    // due in 23 hours, both the 7d and the 24h moments passed, the 2h has not.
    const plans = planNotifications([exam({ dueAt: local(2026, 8, 11, 17) })], quiet, NOW);
    expect(plans.map((p) => p.lead).sort()).toEqual(["24h", "2h"]);
    expect(plans.find((p) => p.lead === "24h")!.superseded).toEqual(["7d"]);
    expect(plans.find((p) => p.lead === "2h")!.overdue).toBe(false);
  });

  it("says a week, the date, and where", () => {
    const content = notificationContent(exam(), "7d", new Date(2026, 8, 13, 19));
    expect(content.title).toBe("CS 357: Quiz 1 is in a week");
    expect(content.message).toBe("CS 357 · Sun, Sep 20, 7:00 PM · Grainger Library · 50min");
  });

  it("counts the days from the clock when it fires late", () => {
    const content = notificationContent(exam(), "7d", new Date(2026, 8, 17, 9));
    expect(content.title).toBe("CS 357: Quiz 1 is in 3 days");
  });

  it("round-trips every new lead through the alarm name", () => {
    for (const lead of ["7d", "bookingLast", "bookingMissed", "snooze"] as const) {
      expect(parseAlarmName(alarmName("a:b", lead))).toEqual({ itemId: "a:b", lead });
    }
  });
});

describe("the booking nag escalates (I40)", () => {
  // Sessions Mon Sep 21 – Wed Sep 23; the parser stores the end as 23:59:59.
  const booking = (notified: Notified = {}) =>
    item({
      id: "b1",
      kind: "booking",
      title: "Book a slot: CS 357: Quiz 2",
      dueAt: local(2026, 8, 21, 0),
      members: [
        member("not_submitted", {
          windowStart: local(2026, 8, 21, 0),
          windowEnd: new Date(2026, 8, 23, 23, 59, 59).toISOString(),
        }),
      ],
      notified,
    });
  const quiet = { ...DEFAULT_SETTINGS, quietHours: null };

  it("says so on the last day of the window", () => {
    const content = notificationContent(booking(), "booking", new Date(2026, 8, 23, 10));
    expect(content.title).toBe("Last day to book a seat: CS 357: Quiz 2");
    expect(content.message).toContain("sessions end today");
    // A snoozed nag is still a nag — never "due", whatever `dueAt` says (§4.4).
    expect(notificationContent(booking(), "snooze", new Date(2026, 8, 23, 11)).title).toBe(
      "Last day to book a seat: CS 357: Quiz 2",
    );
  });

  it("does not say so the day before", () => {
    const content = notificationContent(booking(), "booking", new Date(2026, 8, 22, 23, 30));
    expect(content.title).toBe("Book a seat: CS 357: Quiz 2");
  });

  it("adds one evening reminder on the last day, before the window shuts", () => {
    const plans = planNotifications([booking()], quiet, new Date(2026, 8, 23, 9));
    expect(plans.map((p) => p.lead).sort()).toEqual(["booking", "bookingLast"]);
    const last = plans.find((p) => p.lead === "bookingLast")!;
    expect(last.fireAt).toBe(local(2026, 8, 23, BOOKING_LAST_HOUR));
    expect(BOOKING_LAST_HOUR).toBe(18);
  });

  it("arms the evening reminder ahead of time, and only once", () => {
    const early = planNotifications([booking()], quiet, new Date(2026, 8, 21, 12));
    expect(early.find((p) => p.lead === "bookingLast")!.fireAt).toBe(local(2026, 8, 23, 18));
    const spent = booking({ bookingLast: new Date(2026, 8, 23, 18).toISOString() });
    expect(
      planNotifications([spent], quiet, new Date(2026, 8, 23, 19)).map((p) => p.lead),
    ).toEqual(["booking"]);
  });

  it("does not nag tomorrow about a window that shuts tonight", () => {
    const nagged = booking({ booking: new Date(2026, 8, 23, 10).toISOString() });
    expect(planNotifications([nagged], quiet, new Date(2026, 8, 23, 11)).map((p) => p.lead)).toEqual([
      "bookingLast",
    ]);
  });

  it("skips the evening reminder when the window ends before it", () => {
    // Deliberately unrealistic (the parser always stores 23:59:59): a window
    // ending at 17:00 would put an 18:00 "last day" toast after it shut.
    const early = booking();
    early.members = [member("not_submitted", { windowEnd: new Date(2026, 8, 23, 17).toISOString() })];
    expect(
      planNotifications([early], quiet, new Date(2026, 8, 23, 9)).map((p) => p.lead),
    ).toEqual(["booking"]);
  });

  it("fires one toast, not two, when both are due at once", () => {
    const plans = planNotifications([booking()], quiet, new Date(2026, 8, 23, 19));
    expect(plans.map((p) => p.lead)).toEqual(["bookingLast"]);
    expect(plans[0]!.superseded).toEqual(["booking"]);
  });

  it("says once that the window closed with no seat, and stops nagging", () => {
    const after = new Date(2026, 8, 24, 12);
    const plans = planNotifications([booking()], quiet, after);
    expect(plans.map((p) => p.lead)).toEqual(["bookingMissed"]);
    expect(plans[0]!.overdue).toBe(true);
    const content = notificationContent(booking(), "bookingMissed", after);
    expect(content.title).toBe("Missed the reservation window: CS 357: Quiz 2");
    expect(content.message).toContain("no seat was booked");
    expect(content.title).not.toMatch(/\bdue\b/i);

    const told = booking({ bookingMissed: after.toISOString() });
    expect(planNotifications([told], quiet, new Date(2026, 8, 25, 12))).toEqual([]);
  });

  it("does not announce a window that closed long ago (§4.4's three days)", () => {
    expect(MISSED_NOTICE_DAYS).toBe(3);
    expect(planNotifications([booking()], quiet, new Date(2026, 8, 27, 12))).toEqual([]);
  });

  it("keeps the plain daily nag when the window end is unreadable (parser rule 5)", () => {
    const odd = booking();
    odd.members = [member("not_submitted", { windowEnd: "2026-09-23" })];
    const plans = planNotifications([odd], quiet, new Date(2026, 8, 30, 12));
    expect(plans.map((p) => p.lead)).toEqual(["booking"]);
    expect(notificationContent(odd, "booking", new Date(2026, 8, 23, 10)).title).toBe(
      "Book a seat: CS 357: Quiz 2",
    );
  });
});

describe("toast wording a student reads at a glance (copy-audit #3, #12)", () => {
  it("names the course the way the popup does, rename included", () => {
    // PROGRESS 2026-09-12: "a rename the calendar honours while the filter
    // strip ignores is worse than no rename".
    const hw = item({ dueAt: local(2026, 8, 11, 17) });
    expect(notificationContent(hw, "24h", NOW).message).toMatch(/^CS 357 · /);
    const renamed = notificationContent(hw, "24h", NOW, { CS357: "Numerical Methods" });
    expect(renamed.message).toMatch(/^Numerical Methods · /);
    expect(renamed.message).not.toContain("CS357");

    const booking = item({ kind: "booking", title: "Book a slot: Quiz 2" });
    expect(notificationContent(booking, "booking", NOW, { CS357: "Numerical Methods" }).message)
      .toMatch(/^Numerical Methods · /);

    const assumed = item({ dueAt: local(2026, 8, 18, 23, 59), timeAssumed: true });
    expect(notificationContent(assumed, "dayOf", NOW, { CS357: "Numerical Methods" }).message)
      .toMatch(/^Numerical Methods · /);
  });

  it("says 'due today' on the morning of an untimed deadline, not the date", () => {
    // The toast fires at 08:00 on the day; `urgency` said "now" only once the
    // deadline had passed, so the "today" branch could never be reached.
    const assumed = item({ dueAt: local(2026, 8, 18, 23, 59), timeAssumed: true });
    expect(notificationContent(assumed, "dayOf", new Date(2026, 8, 18, 8)).title).toBe(
      "HW3 Errors and Big-O — due today",
    );
    // Snoozed, it still shows no clock (worker rule 3).
    expect(notificationContent(assumed, "snooze", new Date(2026, 8, 18, 9)).title).toBe(
      "HW3 Errors and Big-O — due today",
    );
    expect(notificationContent(assumed, "dayOf", new Date(2026, 8, 17, 20)).title).toBe(
      "HW3 Errors and Big-O — due tomorrow",
    );
    expect(notificationContent(assumed, "dayOf", new Date(2026, 8, 15, 8)).title).toBe(
      "HW3 Errors and Big-O — due Friday, Sep 18",
    );
  });
});

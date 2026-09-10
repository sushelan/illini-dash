/**
 * §7 notifications. The rules that decide NOT to fire matter most — this is the
 * only part of the extension that interrupts a person.
 */

import { describe, expect, it } from "vitest";
import {
  BOOKING_HOUR,
  alarmName,
  deferPastQuietHours,
  inQuietHours,
  notificationContent,
  parseAlarmName,
  planNotifications,
} from "../src/core/schedule.js";
import { DEFAULT_SETTINGS } from "../src/core/store.js";
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
    expect(planNotifications([past], DEFAULT_SETTINGS, NOW)).toHaveLength(1);
  });
});

describe("notificationContent", () => {
  it("phrases a deadline with its lead", () => {
    const content = notificationContent(item({ dueAt: local(2026, 8, 11, 17) }), "24h", NOW);
    expect(content.title).toBe("CS357 — due tomorrow");
    expect(content.message).toContain("HW3 Errors and Big-O");
    expect(content.url).toContain("gradescope.com");
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
    expect(content.title).toBe("Not booked: CS357");
    expect(content.message).toMatch(/sessions .+ Reserve a seat/);
    expect(content.message).not.toMatch(/\bdue\b/i);
  });
});

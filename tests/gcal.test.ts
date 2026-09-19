/**
 * What goes on the Google Calendar (`src/core/gcal.ts`).
 *
 * The complaint this feature answers is a finished deadline still occupying a
 * slot, so the first table below is the exclusions, and every one of them was
 * mutation-checked: delete a clause and a named case here fails.
 */

import { describe, expect, it } from "vitest";
import { SOURCE_TIME_NOTE_ALL_DAY } from "../src/core/provenance.js";
import {
  ILLINI_DASH_ID,
  diffEvents,
  diffSize,
  eventBody,
  projectEvents,
  reminderOverrides,
  shouldProject,
  type ProjectedEvent,
  type RemoteEvent,
} from "../src/core/gcal.js";
import { DEFAULT_SETTINGS } from "../src/core/store.js";
import type { Item, RawItem, Settings, Status } from "../src/sources/types.js";

function member(source: string, status: Status = "not_submitted"): RawItem {
  return {
    source: source as RawItem["source"],
    sourceId: `${source}-1`,
    courseRaw: "CS 357",
    title: "HW5",
    kind: "assignment",
    url: "https://www.gradescope.com/courses/1",
    status,
    fetchedAt: "2026-09-18T12:00:00.000Z",
  } as RawItem;
}

function item(over: Partial<Item> = {}): Item {
  return {
    id: "abc123",
    members: [member("gradescope")],
    courseLabel: "CS357",
    title: "HW5 Rounding",
    kind: "assignment",
    dueAt: "2026-09-20T23:00:00.000Z",
    url: "https://www.gradescope.com/courses/1",
    status: "not_submitted",
    hidden: false,
    done: false,
    notified: {},
    ...over,
  } as Item;
}

const settings: Settings = { ...DEFAULT_SETTINGS };

describe("which deadlines belong on a calendar", () => {
  const cases: [string, Item, boolean][] = [
    ["an ordinary dated assignment", item(), true],
    ["a hidden row", item({ hidden: true }), false],
    [
      "a PrairieTest booking, which is a window rather than an instant",
      item({ kind: "booking" }),
      false,
    ],
    [
      "a row the student ticked off — the complaint this feature exists for",
      item({ done: true }),
      false,
    ],
    [
      "a row every source reports graded",
      item({ status: "graded", members: [member("gradescope", "graded")] }),
      false,
    ],
    [
      "a row the student ticked that a source now reports missing (contradictsDone)",
      item({ done: true, members: [member("gradescope", "missing")] }),
      true,
    ],
    ["a row with no instant at all", item({ dueAt: undefined }), false],
    [
      "a row with only a reduced-credit deadline",
      item({ dueAt: undefined, lateDueAt: "2026-09-22T23:00:00.000Z" }),
      true,
    ],
  ];

  for (const [name, subject, expected] of cases) {
    it(`${expected ? "keeps" : "drops"} ${name}`, () => {
      expect(shouldProject(subject)).toBe(expected);
      expect(projectEvents([subject], settings).length > 0).toBe(expected);
    });
  }

  it("deletes a finished row from the calendar rather than dimming it", () => {
    // The whole design: a calendar app has no strikethrough, so a deadline that
    // is done leaves. That is a *delete* against the stored index, not an
    // absence from a fresh push.
    const before = projectEvents([item()], settings);
    const index = new Map<string, RemoteEvent>([
      [before[0]!.key, { eventId: "ev1", hash: before[0]!.hash }],
    ]);
    const after = projectEvents([item({ done: true })], settings);
    const diff = diffEvents(after, index);
    expect(diff.deletes).toEqual([{ eventId: "ev1", key: "abc123" }]);
    expect(diff.inserts).toEqual([]);
    expect(diff.patches).toEqual([]);
  });
});

describe("the event body", () => {
  it("names the course the way the student does, and the way the .ics does", () => {
    const [event] = projectEvents([item()], settings, { CS357: "Numerical Methods" });
    expect(event!.summary).toBe("Numerical Methods: HW5 Rounding");
  });

  it("is a 15-minute event ending at the deadline, in America/Chicago", () => {
    const [event] = projectEvents([item()], settings);
    expect(event!.end).toEqual({
      dateTime: "2026-09-20T23:00:00.000Z",
      timeZone: "America/Chicago",
    });
    expect(event!.start).toEqual({
      dateTime: "2026-09-20T22:45:00.000Z",
      timeZone: "America/Chicago",
    });
  });

  it("files an invented time as all-day, never as a 23:59 event", () => {
    /*
     * Worker rule 3, and §4.5's runner is the thing that invents it: "a
     * calendar entry at 11:59 PM looks more authoritative than a row in a
     * popup, and it is the one the student will still be trusting in three
     * weeks". The deliberately unrealistic part is that the instant is a real
     * local 23:59 — a wrong implementation that emitted `dateTime` would still
     * put it on the right day, so the assertion is on the *shape*.
     */
    const assumed = item({ dueAt: "2026-09-20T23:59:00.000-05:00", timeAssumed: true });
    const [event] = projectEvents([assumed], settings);
    expect(event!.start).toEqual({ date: "2026-09-20" });
    // Exclusive, like the .ics DTEND.
    expect(event!.end).toEqual({ date: "2026-09-21" });
    expect(event!.description).toContain(SOURCE_TIME_NOTE_ALL_DAY);
  });

  it("carries the link and which sites said so", () => {
    const [event] = projectEvents([item({ members: [member("gradescope"), member("canvas")] })], settings);
    expect(event!.description).toContain("https://www.gradescope.com/courses/1");
    expect(event!.description).toContain("Gradescope");
    expect(event!.description).toContain("Canvas");
  });

  it("tags every event with the item it came from, inside Google's caps", () => {
    const [event] = projectEvents([item()], settings);
    const body = eventBody(event!) as {
      extendedProperties: { private: Record<string, string> };
    };
    expect(body.extendedProperties.private[ILLINI_DASH_ID]).toBe("abc123");
    expect(ILLINI_DASH_ID.length).toBeLessThanOrEqual(44);
    expect(event!.key.length).toBeLessThanOrEqual(1024);
  });

  it("never sends events.update's shape: the body carries the property every time", () => {
    // A patch that omitted `extendedProperties` would orphan the event on the
    // next list. Both calls build their body here, so one assertion covers both.
    for (const event of projectEvents([item(), item({ id: "def456" })], settings)) {
      expect(eventBody(event)).toHaveProperty("extendedProperties");
    }
  });
});

describe("the reduced-credit leg", () => {
  it("is a second event, keyed #late", () => {
    const events = projectEvents(
      [item({ lateDueAt: "2026-09-22T23:00:00.000Z" })],
      settings,
    );
    expect(events.map((e) => e.key)).toEqual(["abc123", "abc123#late"]);
    expect(events[1]!.description).toContain("Reduced-credit deadline.");
  });

  it("is absent when the source repeats the same instant in both fields", () => {
    // Two identical events on one slot is exactly the clutter this is for.
    const events = projectEvents(
      [item({ lateDueAt: "2026-09-20T23:00:00.000Z" })],
      settings,
    );
    expect(events.map((e) => e.key)).toEqual(["abc123"]);
  });
});

describe("reminders come from the student's own lead times", () => {
  it("is one popup per configured lead, longest first", () => {
    expect(reminderOverrides({ ...settings, leadTimes: ["24h", "2h"] })).toEqual([
      { method: "popup", minutes: 1440 },
      { method: "popup", minutes: 120 },
    ]);
  });

  it("is empty when the student turned every lead off, and never Google's default", () => {
    const events = projectEvents([item()], { ...settings, leadTimes: [] });
    expect(events[0]!.reminders).toEqual({ useDefault: false, overrides: [] });
  });

  it("de-duplicates, so a repeated lead cannot exceed Google's five", () => {
    expect(
      reminderOverrides({ ...settings, leadTimes: ["2h", "2h", "2h", "2h", "2h", "2h"] }),
    ).toHaveLength(1);
  });
});

describe("the diff, which is what makes a push cost nothing", () => {
  const projected = projectEvents([item(), item({ id: "def456", title: "MP2" })], settings);
  const full = new Map<string, RemoteEvent>(
    projected.map((event) => [event.key, { eventId: `ev-${event.key}`, hash: event.hash }]),
  );

  it("sends no request at all when nothing changed", () => {
    const diff = diffEvents(projected, full);
    expect(diffSize(diff)).toBe(0);
  });

  it("patches an item whose deadline moved, and only that one", () => {
    const moved = projectEvents(
      [item({ dueAt: "2026-09-21T23:00:00.000Z" }), item({ id: "def456", title: "MP2" })],
      settings,
    );
    const diff = diffEvents(moved, full);
    expect(diff.patches.map((p) => p.eventId)).toEqual(["ev-abc123"]);
    expect(diff.inserts).toEqual([]);
    expect(diff.deletes).toEqual([]);
  });

  it("patches an item whose title changed, because the hash covers the body", () => {
    const renamed = projectEvents(
      [item({ title: "HW5 Rounding and Cancellation" }), item({ id: "def456", title: "MP2" })],
      settings,
    );
    expect(diffEvents(renamed, full).patches).toHaveLength(1);
  });

  it("inserts what the index has never seen", () => {
    const diff = diffEvents(projected, new Map());
    expect(diff.inserts.map((e) => e.key)).toEqual(["abc123", "def456"]);
  });

  it("touches nothing the index does not know about", () => {
    // The structural half of the `calendar.app.created` promise: an event this
    // extension did not write has no entry, so no branch can reach it.
    const diff = diffEvents([], new Map([["someone-elses", { eventId: "x", hash: "h" }]]));
    expect(diff.deletes).toEqual([{ eventId: "x", key: "someone-elses" }]);
  });
});

describe("a merged item", () => {
  it("is one event, because dedupe already made it one row", () => {
    const merged = item({
      members: [member("gradescope"), member("canvas"), member("prairielearn")],
    });
    const events = projectEvents([merged], settings);
    expect(events).toHaveLength(1);
    expect(events[0]!.description).toContain("Gradescope");
  });
});

describe("the hash", () => {
  it("is stable across calls, so an unchanged item never re-sends", () => {
    const a = projectEvents([item()], settings)[0]!;
    const b = projectEvents([item()], settings)[0]!;
    expect(a.hash).toBe(b.hash);
  });

  it("changes when the reminders change, because the body does", () => {
    const a = projectEvents([item()], { ...settings, leadTimes: ["24h", "2h"] })[0]!;
    const b = projectEvents([item()], { ...settings, leadTimes: ["2h"] })[0]!;
    expect(a.hash).not.toBe(b.hash);
  });

  it("changes when the course is renamed, so the calendar follows the popup", () => {
    const a = projectEvents([item()], settings)[0]!;
    const b = projectEvents([item()], settings, { CS357: "Numerical Methods" })[0]!;
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("a row whose instant will not parse", () => {
  it("is dropped from the calendar and does not take the push with it", () => {
    // Parser house rule 1 one layer up: a bad value costs its own field. An
    // unreadable date is already shown as such in the popup.
    const events = projectEvents([item({ dueAt: "not a date" }), item({ id: "def456" })], settings);
    expect(events.map((e: ProjectedEvent) => e.key)).toEqual(["def456"]);
  });
});

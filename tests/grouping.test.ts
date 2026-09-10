/** §8.1's sections. The boundaries are the part that goes quietly wrong. */

import { describe, expect, it } from "vitest";
import { formatDue, groupItems, sectionFor } from "../src/ui/grouping.js";
import { DEFAULT_SETTINGS } from "../src/core/store.js";
import type { Item } from "../src/sources/types.js";

function item(partial: Partial<Item> = {}): Item {
  return {
    id: partial.id ?? "x",
    members: [],
    courseLabel: "CS357",
    title: "Thing",
    kind: "assignment",
    url: "https://example.invalid/",
    status: "not_submitted",
    hidden: false,
    notified: {},
    ...partial,
  };
}

// A Thursday, 6pm local.
const NOW = new Date(2026, 8, 10, 18, 0, 0);
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString();

describe("sectionFor (§8.1)", () => {
  it("puts booking items first, whatever their date", () => {
    expect(sectionFor(item({ kind: "booking", dueAt: at(2026, 10, 1) }), NOW)).toBe(
      "Needs attention",
    );
    // Even with no date at all — the window closes regardless.
    expect(sectionFor(item({ kind: "booking" }), NOW)).toBe("Needs attention");
  });

  it("buckets by day boundary, not by 24-hour spans", () => {
    // 11pm tonight is Today; 1am tomorrow is Tomorrow, only two hours later.
    expect(sectionFor(item({ dueAt: at(2026, 8, 10, 23) }), NOW)).toBe("Today");
    expect(sectionFor(item({ dueAt: at(2026, 8, 11, 1) }), NOW)).toBe("Tomorrow");
  });

  it("runs 'this week' through Sunday and no further", () => {
    // Thursday the 10th: Saturday and Sunday are this week, Monday is Later.
    expect(sectionFor(item({ dueAt: at(2026, 8, 12) }), NOW)).toBe("This week");
    expect(sectionFor(item({ dueAt: at(2026, 8, 13) }), NOW)).toBe("This week");
    expect(sectionFor(item({ dueAt: at(2026, 8, 14) }), NOW)).toBe("Later");
  });

  it("leaves 'this week' empty when today is Sunday", () => {
    // "Through Sunday" means Sunday ends the week; it must not silently become
    // the next seven days. Monday is still Tomorrow, which outranks both — the
    // property is that Tuesday falls through to Later rather than This week.
    const sunday = new Date(2026, 8, 13, 18, 0, 0);
    expect(sectionFor(item({ dueAt: at(2026, 8, 13, 23) }), sunday)).toBe("Today");
    expect(sectionFor(item({ dueAt: at(2026, 8, 14) }), sunday)).toBe("Tomorrow");
    expect(sectionFor(item({ dueAt: at(2026, 8, 15) }), sunday)).toBe("Later");
    expect(
      groupItems([item({ dueAt: at(2026, 8, 15) })], sunday, DEFAULT_SETTINGS).map((s) => s.name),
    ).toEqual(["Later"]);
  });

  it("surfaces overdue unfinished work for seven days, then drops it", () => {
    expect(sectionFor(item({ dueAt: at(2026, 8, 8) }), NOW)).toBe("Needs attention");
    expect(sectionFor(item({ dueAt: at(2026, 8, 1) }), NOW)).toBeUndefined();
  });

  it("does not nag about overdue work that is already done", () => {
    expect(sectionFor(item({ dueAt: at(2026, 8, 8), status: "submitted" }), NOW)).toBeUndefined();
    expect(sectionFor(item({ dueAt: at(2026, 8, 8), status: "graded" }), NOW)).toBeUndefined();
  });

  it("drops undated items and anything past the 60-day horizon", () => {
    expect(sectionFor(item({}), NOW)).toBeUndefined();
    expect(sectionFor(item({ dueAt: at(2027, 0, 1) }), NOW)).toBeUndefined();
  });
});

describe("groupItems", () => {
  it("omits empty sections and keeps §8.1's order", () => {
    const sections = groupItems(
      [
        item({ id: "a", dueAt: at(2026, 8, 14) }),
        item({ id: "b", kind: "booking" }),
        item({ id: "c", dueAt: at(2026, 8, 10, 23) }),
      ],
      NOW,
      DEFAULT_SETTINGS,
    );
    expect(sections.map((s) => s.name)).toEqual(["Needs attention", "Today", "Later"]);
  });

  it("respects hideSubmitted and hidden", () => {
    const done = item({ id: "d", dueAt: at(2026, 8, 11), status: "submitted" });
    expect(groupItems([done], NOW, DEFAULT_SETTINGS)).toEqual([]);
    expect(groupItems([done], NOW, { ...DEFAULT_SETTINGS, hideSubmitted: false })).toHaveLength(1);
    expect(
      groupItems([item({ dueAt: at(2026, 8, 11), hidden: true })], NOW, DEFAULT_SETTINGS),
    ).toEqual([]);
  });

  it("never hides a booking item, even with hideSubmitted on", () => {
    const booking = item({ kind: "booking", status: "not_submitted" });
    expect(groupItems([booking], NOW, DEFAULT_SETTINGS)).toHaveLength(1);
  });
});

describe("formatDue", () => {
  it("shows a clock time and a relative span", () => {
    expect(formatDue(item({ dueAt: at(2026, 8, 12, 18) }), NOW)).toMatch(/·\s+in 2d$/);
    expect(formatDue(item({ dueAt: at(2026, 8, 10, 20) }), NOW)).toMatch(/·\s+in 2h$/);
    expect(formatDue(item({ dueAt: at(2026, 8, 8, 18) }), NOW)).toMatch(/·\s+2d ago$/);
  });

  it("says so when there is no date", () => {
    expect(formatDue(item({}), NOW)).toBe("no date");
    expect(formatDue(item({ dueAt: "nonsense" }), NOW)).toBe("no date");
  });
});

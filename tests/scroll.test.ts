/**
 * The scroll decision, on its own (src/ui/popup/scroll.ts).
 *
 * `tests/popup-draw.test.ts` drives the same rule through the real entry, which
 * is what proves it is wired up; this pins the branches that are awkward to
 * reach from a document — a clamp against a scroller that reports nothing, and
 * a screen opened from a screen.
 */
import { describe, expect, it } from "vitest";
import { clampScroll, placeKey, scrollPlan, type Place } from "../src/ui/popup/scroll.js";

const list = (view: Place["view"] = "week", dayOffset = 0): Place => ({
  view,
  dayOffset,
  screen: undefined,
});
const screen = (id: string, view: Place["view"] = "week"): Place => ({
  view,
  dayOffset: 0,
  screen: `deadline:${id}`,
});

describe("placeKey", () => {
  it("separates a list from a screen, and a week from the next one", () => {
    expect(placeKey(list("week", 0))).not.toBe(placeKey(list("week", 7)));
    expect(placeKey(list("week"))).not.toBe(placeKey(list("month")));
    expect(placeKey(screen("a"))).not.toBe(placeKey(screen("b")));
    expect(placeKey(list("week"))).toBe(placeKey(list("week")));
  });
});

describe("scrollPlan", () => {
  it("keeps the offset when the same place is drawn again", () => {
    // Hide, a tick, a sync, the minute tick: the reported defect.
    expect(scrollPlan(list(), list(), 240, undefined)).toEqual({ y: 240, memory: undefined });
  });

  it("starts somewhere new at the top", () => {
    expect(scrollPlan(list("week"), list("month"), 240, undefined).y).toBe(0);
    expect(scrollPlan(list("week", 0), list("week", 7), 240, undefined).y).toBe(0);
  });

  it("starts the first draw of the document at the top", () => {
    expect(scrollPlan(undefined, list(), 0, undefined)).toEqual({ y: 0, memory: undefined });
  });

  it("remembers the list's offset when a screen opens, and gives it back", () => {
    const opened = scrollPlan(list(), screen("a"), 260, undefined);
    expect(opened.y).toBe(0);
    expect(opened.memory).toEqual({ key: placeKey(list()), y: 260 });
    const back = scrollPlan(screen("a"), list(), 40, opened.memory);
    expect(back.y).toBe(260);
    expect(back.memory, "spent, so a later visit to this tab starts at the top").toBeUndefined();
  });

  it("does not let a screen opened from a screen overwrite the list's offset", () => {
    // "Merge with…" opens a second deadline screen from the first. The offset
    // worth keeping is still the list's, which is where ‹ back ends up.
    const memory = { key: placeKey(list()), y: 260 };
    const next = scrollPlan(screen("a"), screen("b"), 40, memory);
    expect(next.y).toBe(0);
    expect(next.memory, "the list's offset is not replaced by a screen's").toBeUndefined();
  });

  it("drops the memory when the student goes somewhere other than back", () => {
    const memory = { key: placeKey(list("week")), y: 320 };
    const elsewhere = scrollPlan(screen("a"), list("month"), 0, memory);
    expect(elsewhere.y).toBe(0);
    expect(elsewhere.memory).toBeUndefined();
  });
});

describe("clampScroll", () => {
  it("holds the offset inside what the document can travel", () => {
    expect(clampScroll(240, { scrollHeight: 2000, clientHeight: 600 })).toBe(240);
    // The list got shorter — a row was hidden. The bottom, not a blank viewport.
    expect(clampScroll(240, { scrollHeight: 700, clientHeight: 600 })).toBe(100);
    // Shorter than the window: there is nowhere to scroll to.
    expect(clampScroll(240, { scrollHeight: 300, clientHeight: 600 })).toBe(0);
    expect(clampScroll(-5, { scrollHeight: 2000, clientHeight: 600 })).toBe(0);
  });

  it("answers rather than throwing when the scroller reports nothing", () => {
    // linkedom lays nothing out, and a document mid-teardown answers NaN.
    expect(clampScroll(240, { scrollHeight: NaN, clientHeight: 600 })).toBe(240);
    expect(clampScroll(NaN, { scrollHeight: 2000, clientHeight: 600 })).toBe(0);
  });
});

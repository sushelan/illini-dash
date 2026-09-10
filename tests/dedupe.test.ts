/**
 * §5.2 normalization and §5.3 dedupe.
 *
 * The table is built from titles that really appear in `fixtures/` — Canvas's
 * `Homework 3`, PrairieLearn's `HW3 Errors and Big-O`, Gradescope's
 * `Homework 1`, PrairieTest's `CS 357: Quiz 1` — because §10 step 7 asks for
 * table-driven tests from real titles, and invented ones would agree with a
 * wrong implementation.
 */

import { describe, expect, it } from "vitest";
import { isSubsetOf, jaccard, normalizeTitle } from "../src/core/normalize.js";
import {
  applyRetention,
  contradictsDone,
  datesCompatible,
  dedupe,
  isTickedDone,
  itemId,
  sameCourse,
  shouldMerge,
  titlesCompatible,
} from "../src/core/dedupe.js";
import type { Overrides, RawItem } from "../src/sources/types.js";

const NO_OVERRIDES: Overrides = {
  mergeGroups: [],
  splitKeys: [],
  hiddenKeys: [],
  disabledCourses: [],
  doneKeys: [],
};

function raw(partial: Partial<RawItem> & Pick<RawItem, "source" | "sourceId" | "title">): RawItem {
  return {
    courseRaw: "CS 357",
    courseCode: "CS357",
    kind: "assignment",
    url: "https://example.invalid/x",
    status: "not_submitted",
    fetchedAt: "2026-09-10T18:00:00.000Z",
    ...partial,
  };
}

describe("normalizeTitle (§5.2)", () => {
  const cases: [string, string[]][] = [
    // Real titles, one per source.
    ["Homework 3", ["hw3"]],
    ["HW3 Errors and Big-O", ["hw3", "errors", "big", "o"]],
    ["Homework 1", ["hw1"]],
    ["L4a Floating Point", ["l4a", "floating", "point"]],
    ["GA 1 Working with Python", ["ga1", "working", "with", "python"]],
    ["MP1: Distributed Logging", ["mp1", "distributed", "logging"]],
    // §5.2 step 2 synonyms.
    ["Machine Problem 2", ["mp2"]],
    ["Programming Assignment 4", ["pa4"]],
    ["Laboratory 3", ["lab3"]],
    // §5.2 step 3: leading zeros and split prefixes land in the same place.
    ["HW02", ["hw2"]],
    ["hw 02", ["hw2"]],
    ["Hw2", ["hw2"]],
    // §5.2 step 4: filler and years.
    ["Homework 3 submission due", ["hw3"]],
    ["CS425 ECE428 Fall 2026", ["cs425", "ece428"]],
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} → {${expected.join(", ")}}`, () => {
      expect([...normalizeTitle(input)]).toEqual(expected);
    });
  }

  it("keeps numbers attached, so quiz1 never equals quiz10 (§5.3's own worry)", () => {
    expect(normalizeTitle("Quiz 1")).not.toEqual(normalizeTitle("Quiz 10"));
    expect(titlesCompatible(normalizeTitle("Quiz 1"), normalizeTitle("Quiz 10"))).toBe(false);
  });
});

describe("jaccard / isSubsetOf", () => {
  it("computes overlap and containment", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3);
    expect(jaccard(new Set(), new Set())).toBe(0);
    expect(isSubsetOf(new Set(["a"]), new Set(["a", "b"]))).toBe(true);
    expect(isSubsetOf(new Set(["c"]), new Set(["a", "b"]))).toBe(false);
  });
});

describe("§5.3 conditions", () => {
  it("matches courses on any code, for cross-listings", () => {
    const ece = raw({ source: "canvas", sourceId: "1", title: "x", courseCode: "ECE391" });
    const cs = raw({
      source: "gradescope",
      sourceId: "2",
      title: "x",
      courseCode: "CS391",
      extra: { altCodes: "CS391 ECE391" },
    });
    expect(sameCourse(ece, cs)).toBe(true);
  });

  it("falls back to a courseRaw prefix only when neither side has a code", () => {
    const a = raw({ source: "canvas", sourceId: "1", title: "x", courseCode: undefined, courseRaw: "Senior Design" });
    const b = raw({ source: "gradescope", sourceId: "2", title: "x", courseCode: undefined, courseRaw: "Senior Design Fall" });
    expect(sameCourse(a, b)).toBe(true);
    // One side coded, the other not, is not a match — that guess is too weak.
    const c = raw({ source: "gradescope", sourceId: "3", title: "x", courseCode: "CS357" });
    expect(sameCourse(a, c)).toBe(false);
  });

  it("requires both dated within 24h, or both undated", () => {
    const at = (iso?: string) => raw({ source: "canvas", sourceId: "1", title: "x", dueAt: iso });
    expect(datesCompatible(at("2026-09-10T18:00:00Z"), at("2026-09-11T10:00:00Z"))).toBe(true);
    expect(datesCompatible(at("2026-09-10T18:00:00Z"), at("2026-09-12T10:00:00Z"))).toBe(false);
    expect(datesCompatible(at(undefined), at(undefined))).toBe(true);
    // The asymmetric case is exactly this account's Canvas: undated LTI shells
    // beside dated PrairieLearn originals. They must not merge.
    expect(datesCompatible(at("2026-09-10T18:00:00Z"), at(undefined))).toBe(false);
  });

  it("never merges two rows from the same source", () => {
    const a = raw({ source: "canvas", sourceId: "1", title: "Homework 3" });
    const b = raw({ source: "canvas", sourceId: "2", title: "Homework 3" });
    expect(shouldMerge(a, b, normalizeTitle(a.title), normalizeTitle(b.title))).toBe(false);
  });

  it("refuses a one-token subset, so Quiz cannot swallow Quiz 1", () => {
    expect(titlesCompatible(normalizeTitle("Quiz"), normalizeTitle("Quiz 1 Linear Algebra"))).toBe(
      false,
    );
  });

  it("accepts a two-token subset", () => {
    expect(
      titlesCompatible(normalizeTitle("Quiz 1 Linear Algebra"), normalizeTitle("Quiz 1 Linear")),
    ).toBe(true);
  });

  it("accepts a single badge token, which §5.3's own examples require", () => {
    // §5.2 step 3 collapses "Lab 3" to one token, which §5.3's >=2 rule would
    // then reject — refusing the very pair §5.3 says "will merge, which is
    // correct", and the badge match §4.3 calls the point of the badge.
    expect(titlesCompatible(normalizeTitle("Lab 3"), normalizeTitle("Lab 3 Report"))).toBe(true);
    expect(
      titlesCompatible(normalizeTitle("Homework 3"), normalizeTitle("HW3 Errors and Big-O")),
    ).toBe(true);
  });

  it("still refuses a bare word, which is what the >=2 rule was protecting", () => {
    // No digit, so not a badge: "quiz" must not swallow "quiz1 linear algebra".
    expect(titlesCompatible(normalizeTitle("Quiz"), normalizeTitle("Quiz 1 Linear Algebra"))).toBe(
      false,
    );
    expect(titlesCompatible(normalizeTitle("Lab"), normalizeTitle("Lab 3 Report"))).toBe(false);
  });
});

describe("dedupe", () => {
  const gs = raw({
    source: "gradescope",
    sourceId: "8398957",
    title: "Homework 1",
    dueAt: "2026-09-02T17:00:00-05:00",
    lateDueAt: "2026-09-09T17:00:00-05:00",
    url: "https://www.gradescope.com/courses/1/assignments/8398957",
    status: "submitted",
  });
  const canvas = raw({
    source: "canvas",
    sourceId: "assignment:9002",
    title: "Homework 1 for CS 357",
    dueAt: "2026-09-02T22:00:00Z",
    url: "https://canvas.illinois.edu/courses/1/assignments/9002",
    status: "not_submitted",
  });

  it("merges the same deadline seen by two sources", () => {
    const items = dedupe([gs, canvas], NO_OVERRIDES);
    expect(items).toHaveLength(1);
    expect(items[0]!.members).toHaveLength(2);
  });

  it("takes url and dueAt from the submission system, not from Canvas", () => {
    // §5.3: Canvas dates set by LTI sync are copies.
    const [item] = dedupe([canvas, gs], NO_OVERRIDES);
    expect(item!.url).toBe("https://www.gradescope.com/courses/1/assignments/8398957");
    expect(item!.dueAt).toBe("2026-09-02T17:00:00-05:00");
    expect(item!.lateDueAt).toBe("2026-09-09T17:00:00-05:00");
  });

  it("takes the most-done status and the longest title", () => {
    const [item] = dedupe([gs, canvas], NO_OVERRIDES);
    // Gradescope says submitted; Canvas has not synced. The student did submit.
    expect(item!.status).toBe("submitted");
    expect(item!.title).toBe("Homework 1 for CS 357");
  });

  it("does not use Canvas's opaque course_code as the label", () => {
    const [item] = dedupe([gs, canvas], NO_OVERRIDES);
    expect(item!.courseLabel).toBe("CS357");
  });

  it("merges transitively", () => {
    const pl = raw({
      source: "prairielearn",
      sourceId: "1:HW1",
      title: "HW1 Homework 1",
      dueAt: "2026-09-02T17:00:00-05:00",
    });
    expect(dedupe([gs, canvas, pl], NO_OVERRIDES)[0]!.members).toHaveLength(3);
  });

  it("keeps a group's id stable, so notifications are not re-fired", () => {
    const first = dedupe([gs, canvas], NO_OVERRIDES);
    first[0]!.notified = { "24h": "2026-09-01T17:00:00Z" };
    const second = dedupe([canvas, gs], NO_OVERRIDES, { previous: first });
    expect(second[0]!.id).toBe(first[0]!.id);
    expect(second[0]!.notified).toEqual({ "24h": "2026-09-01T17:00:00Z" });
  });

  it("gives a different id to a different group", () => {
    expect(itemId(["a:1", "b:2"])).toBe(itemId(["b:2", "a:1"]));
    expect(itemId(["a:1", "b:2"])).not.toBe(itemId(["a:1", "b:3"]));
  });

  describe("overrides", () => {
    it("splits a key the user pulled apart", () => {
      const items = dedupe([gs, canvas], {
        ...NO_OVERRIDES,
        splitKeys: ["canvas:assignment:9002"],
      });
      expect(items).toHaveLength(2);
    });

    it("merges a group the user forced together, across the date rule", () => {
      const far = raw({
        source: "prairietest",
        sourceId: "abc",
        title: "Completely unrelated",
        dueAt: "2026-11-01T00:00:00Z",
      });
      const items = dedupe([gs, far], {
        ...NO_OVERRIDES,
        mergeGroups: [["gradescope:8398957", "prairietest:abc"]],
      });
      expect(items).toHaveLength(1);
    });

    it("lets an explicit merge win over a split of the same key", () => {
      const items = dedupe([gs, canvas], {
        ...NO_OVERRIDES,
        splitKeys: ["canvas:assignment:9002"],
        mergeGroups: [["gradescope:8398957", "canvas:assignment:9002"]],
      });
      expect(items).toHaveLength(1);
    });

    it("hides an item by member keys and drops a disabled course entirely", () => {
      expect(dedupe([gs, canvas], { ...NO_OVERRIDES, hiddenKeys: ["gradescope:8398957", "canvas:assignment:9002"] })[0]!.hidden).toBe(
        true,
      );
      expect(dedupe([gs, canvas], { ...NO_OVERRIDES, disabledCourses: ["CS357"] })).toEqual([]);
    });

    it("ignores a mergeGroup naming keys that are not present", () => {
      const items = dedupe([gs], { ...NO_OVERRIDES, mergeGroups: [["gone:1", "alsogone:2"]] });
      expect(items).toHaveLength(1);
    });
  });

  it("sorts dated first by instant, undated last", () => {
    const later = raw({ source: "canvas", sourceId: "l", title: "Later", dueAt: "2026-10-01T00:00:00Z" });
    const undated = raw({ source: "canvas", sourceId: "u", title: "Undated" });
    const sorted = dedupe([undated, later, gs], NO_OVERRIDES);
    expect(sorted.map((i) => i.title)).toEqual(["Homework 1", "Later", "Undated"]);
  });
});

describe("regressions found by the dedupe/sync review", () => {
  it("refuses two titles whose badges differ, however much description they share", () => {
    // The Jaccard path was badge-blind: these score 0.667 and merged — the very
    // pair §5.3 cites as proof the rule is safe. That only held on the subset path.
    expect(
      titlesCompatible(
        normalizeTitle("Quiz 1: Linear Algebra + Python + Errors"),
        normalizeTitle("Quiz 10: Linear Algebra + Python + Errors"),
      ),
    ).toBe(false);
    expect(
      titlesCompatible(
        normalizeTitle("L19 Principal Component Analysis - PCA"),
        normalizeTitle("HW19 Principal Component Analysis - PCA"),
      ),
    ).toBe(false);
  });

  it("still merges when the badges agree, or when only one side has a badge", () => {
    expect(
      titlesCompatible(normalizeTitle("HW3 Errors and Big-O"), normalizeTitle("Homework 3")),
    ).toBe(true);
    expect(
      titlesCompatible(normalizeTitle("Lab 3"), normalizeTitle("Lab 3 Report")),
    ).toBe(true);
    expect(
      titlesCompatible(
        normalizeTitle("Homework 1"),
        normalizeTitle("Homework 1 for CS 357"),
      ),
    ).toBe(true);
  });

  it("keeps §5.2's join list and §5.3's badge shape in agreement", () => {
    // They disagreed above four letters, so identical exams merged or not purely
    // on whether staff typed "Exam" or "Midterm".
    expect(titlesCompatible(normalizeTitle("Midterm 1"), normalizeTitle("CS 357: Midterm 1"))).toBe(
      true,
    );
    expect(
      titlesCompatible(normalizeTitle("Discussion 4"), normalizeTitle("Discussion 4 Worksheet")),
    ).toBe(true);
    expect(titlesCompatible(normalizeTitle("Exam 1"), normalizeTitle("CS 357: Exam 1"))).toBe(true);
  });

  it("never lets transitivity put two rows of one source in a group", () => {
    // A(gs) merges B(cv), B merges C(cv) — the pairwise ban is on pairs, so
    // union-find routed around it and one Canvas deadline became unreachable
    // behind a row that looked like an honest two-source merge.
    const items = dedupe(
      [
        raw({ source: "gradescope", sourceId: "1", title: "MP2", dueAt: "2026-09-20T23:59:00-05:00" }),
        raw({ source: "canvas", sourceId: "a", title: "MP2 Checkpoint", dueAt: "2026-09-20T22:00:00-05:00" }),
        raw({ source: "canvas", sourceId: "b", title: "MP2 Final Submission", dueAt: "2026-09-21T12:00:00-05:00" }),
      ],
      NO_OVERRIDES,
    );
    expect(items).toHaveLength(2);
    for (const group of items) {
      const sources = group.members.map((m) => m.source);
      expect(new Set(sources).size, JSON.stringify(sources)).toBe(sources.length);
    }
  });

  it("does not merge the fixture's own two distinct GA rows", () => {
    // CS 357 ships both "GA 0" and "GA00"; §5.2 collapses both to `ga0`, which
    // falsifies "a badge is unique within a course". The same-source guard is
    // what keeps that survivable.
    const items = dedupe(
      [
        raw({ source: "prairielearn", sourceId: "1:GA 0", title: "GA 0 Get started with GAs" }),
        raw({ source: "prairielearn", sourceId: "1:GA00", title: "GA00 Workspaces" }),
        raw({ source: "gradescope", sourceId: "9", title: "GA0" }),
      ],
      NO_OVERRIDES,
    );
    for (const group of items) {
      const sources = group.members.map((m) => m.source);
      expect(new Set(sources).size).toBe(sources.length);
    }
  });
});

describe("applyRetention (§5.4)", () => {
  const now = "2026-09-10T18:00:00.000Z";
  const stored: Record<string, RawItem> = {
    "gradescope:old": raw({
      source: "gradescope",
      sourceId: "old",
      title: "Ancient",
      dueAt: "2026-06-01T00:00:00Z",
    }),
    "gradescope:recent": raw({
      source: "gradescope",
      sourceId: "recent",
      title: "Recent",
      dueAt: "2026-09-01T00:00:00Z",
    }),
    "site:undated": raw({ source: "site", sourceId: "undated", title: "No date" }),
  };

  it("purges items more than 60 days past due", () => {
    const result = applyRetention(stored, new Set(Object.keys(stored)), {}, NO_OVERRIDES, now);
    expect(result.purged).toEqual(["gradescope:old"]);
    expect(Object.keys(result.raw)).toContain("gradescope:recent");
  });

  it("purges an undated item only after three consecutive misses", () => {
    let misses: Record<string, number> = {};
    let raws = stored;
    for (let sync = 1; sync <= 3; sync += 1) {
      const result = applyRetention(raws, new Set(["gradescope:recent"]), misses, NO_OVERRIDES, now);
      misses = result.misses;
      raws = result.raw;
      if (sync < 3) expect(Object.keys(raws), `sync ${sync}`).toContain("site:undated");
      else expect(Object.keys(raws)).not.toContain("site:undated");
    }
  });

  it("resets the miss count when the item comes back", () => {
    const first = applyRetention(stored, new Set(), {}, NO_OVERRIDES, now);
    expect(first.misses["site:undated"]).toBe(1);
    const second = applyRetention(first.raw, new Set(["site:undated"]), first.misses, NO_OVERRIDES, now);
    expect(second.misses["site:undated"]).toBe(0);
  });

  it("drops overrides that reference purged keys", () => {
    const overrides: Overrides = {
      ...NO_OVERRIDES,
      splitKeys: ["gradescope:old", "gradescope:recent"],
      mergeGroups: [["gradescope:old", "gradescope:recent"], ["gradescope:recent", "site:undated"]],
    };
    const result = applyRetention(stored, new Set(Object.keys(stored)), {}, overrides, now);
    expect(result.overrides.splitKeys).toEqual(["gradescope:recent"]);
    // A group reduced to one member is no longer a group.
    expect(result.overrides.mergeGroups).toEqual([["gradescope:recent", "site:undated"]]);
  });
});

describe("a deadline that moved (§7's fired record is about a moment)", () => {
  const at = (day: number, hour = 17) =>
    `2026-09-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00-05:00`;

  const stated = (dueAt: string) =>
    raw({ source: "gradescope", sourceId: "1", title: "Homework 3", dueAt });

  it("re-arms both leads when the course grants an extension", () => {
    // The failure this fixes: the 24h lead was spent on Tuesday's date, the
    // course moves the deadline to Friday, and because the record survives
    // nothing ever fires again for the deadline that now exists.
    const before = dedupe([stated(at(8))], NO_OVERRIDES);
    before[0]!.notified = { "24h": "2026-09-07T17:00:00Z", "2h": "2026-09-08T15:00:00Z" };

    const after = dedupe([stated(at(11))], NO_OVERRIDES, { previous: before });
    expect(after[0]!.id).toBe(before[0]!.id);
    expect(after[0]!.notified["24h"]).toBeUndefined();
    expect(after[0]!.notified["2h"]).toBeUndefined();
  });

  it("records what it moved from, so the row can say so", () => {
    const before = dedupe([stated(at(8))], NO_OVERRIDES);
    const after = dedupe([stated(at(11))], NO_OVERRIDES, { previous: before });
    expect(Date.parse(after[0]!.movedFrom!)).toBe(Date.parse(at(8)));
  });

  it("keeps the fired record when the deadline did not move", () => {
    const before = dedupe([stated(at(8))], NO_OVERRIDES);
    before[0]!.notified = { "24h": "2026-09-07T17:00:00Z" };
    const after = dedupe([stated(at(8))], NO_OVERRIDES, { previous: before });
    expect(after[0]!.notified["24h"]).toBe("2026-09-07T17:00:00Z");
    expect(after[0]!.movedFrom).toBeUndefined();
  });

  it("ignores a sub-minute shift from re-parsing the same page", () => {
    const before = dedupe([stated("2026-09-08T17:00:00-05:00")], NO_OVERRIDES);
    before[0]!.notified = { "24h": "2026-09-07T17:00:00Z" };
    const after = dedupe([stated("2026-09-08T17:00:30-05:00")], NO_OVERRIDES, {
      previous: before,
    });
    expect(after[0]!.notified["24h"]).toBe("2026-09-07T17:00:00Z");
    expect(after[0]!.movedFrom).toBeUndefined();
  });

  it("does not blame the course when our own assumed 23:59 is replaced by a real time", () => {
    // §4.5's runner invents 23:59 for a course page that prints a bare date.
    // Learning the real time is this extension correcting itself (worker rule
    // 3), so the reminders re-arm but the row must not claim a move.
    const assumed = raw({
      source: "site",
      sourceId: "cs424:1",
      title: "HW1",
      dueAt: "2026-09-08T23:59:00-05:00",
      extra: { timeAssumed: "true" },
    });
    const before = dedupe([assumed], NO_OVERRIDES);
    expect(before[0]!.timeAssumed).toBe(true);
    before[0]!.notified = { "24h": "2026-09-07T17:00:00Z" };

    const real = raw({
      source: "site",
      sourceId: "cs424:1",
      title: "HW1",
      dueAt: "2026-09-08T17:00:00-05:00",
    });
    const after = dedupe([real], NO_OVERRIDES, { previous: before });
    expect(after[0]!.notified["24h"]).toBeUndefined();
    expect(after[0]!.movedFrom).toBeUndefined();
  });

  it("marks the item, not the merged row, when only an assumed member changed", () => {
    // A site row whose time was assumed, merged with a Canvas row that states
    // one: the stated instant wins, so the Item is not assumed at all.
    const site = raw({
      source: "site",
      sourceId: "cs424:1",
      title: "Homework 1",
      dueAt: "2026-09-08T23:59:00-05:00",
      extra: { timeAssumed: "true" },
    });
    const cv = raw({
      source: "canvas",
      sourceId: "assignment:9",
      title: "Homework 1",
      dueAt: "2026-09-08T17:00:00-05:00",
    });
    const merged = dedupe([site, cv], NO_OVERRIDES);
    expect(merged[0]!.members).toHaveLength(2);
    expect(merged[0]!.timeAssumed).toBeUndefined();
  });

  it("leaves the daily booking nag alone when its window shifts", () => {
    const booking = (day: number) =>
      raw({
        source: "prairietest",
        sourceId: "quiz1:booking",
        title: "Book a slot: Quiz 1",
        kind: "booking",
        dueAt: at(day, 0),
      });
    const before = dedupe([booking(21)], NO_OVERRIDES);
    before[0]!.notified = { booking: "2026-09-10T15:00:00Z" };
    const after = dedupe([booking(22)], NO_OVERRIDES, { previous: before });
    // §7 repeats it daily anyway, and its dueAt is a window start rather than a
    // deadline, so nothing was "fired for the wrong moment".
    expect(after[0]!.notified.booking).toBe("2026-09-10T15:00:00Z");
  });
});

describe("sort order for invented times", () => {
  it("puts a stated deadline ahead of an assumed one at the same instant", () => {
    // §4.5's runner puts every timeless course-site row at 23:59, so without a
    // tie-break a real 11:59 PM deadline and an invented one interleave by
    // title and the trustworthy row is not necessarily on top.
    const stated = raw({
      source: "gradescope",
      sourceId: "z",
      title: "Zebra homework",
      dueAt: "2026-09-18T23:59:00-05:00",
    });
    const invented = raw({
      source: "site",
      sourceId: "cs424:a",
      title: "Alpha homework",
      dueAt: "2026-09-18T23:59:00-05:00",
      extra: { timeAssumed: "true" },
    });
    const sorted = dedupe([invented, stated], NO_OVERRIDES);
    expect(sorted.map((i) => i.title)).toEqual(["Zebra homework", "Alpha homework"]);
  });
});

describe("the student's own tick (doneKeys)", () => {
  const siteRow = () =>
    raw({
      source: "site",
      sourceId: "cs424:hw1",
      title: "Homework 1",
      dueAt: "2026-09-18T23:59:00-05:00",
      // §4.5's runner emits every course-site row as `unknown` forever, which is
      // why a hand tick is the only way such a row can ever be finished.
      status: "unknown",
    });

  it("marks the item done when every member key is ticked", () => {
    const done = dedupe([siteRow()], { ...NO_OVERRIDES, doneKeys: ["site:cs424:hw1"] });
    expect(done[0]!.done).toBe(true);
  });

  it("does not mark a merged row done when only one half was ticked", () => {
    const cv = raw({
      source: "canvas",
      sourceId: "assignment:9",
      title: "Homework 1",
      dueAt: "2026-09-18T23:59:00-05:00",
    });
    const merged = dedupe([siteRow(), cv], { ...NO_OVERRIDES, doneKeys: ["site:cs424:hw1"] });
    expect(merged[0]!.members).toHaveLength(2);
    expect(merged[0]!.done).toBe(false);
  });

  it("lets a source contradict the tick when it says the work is missing", () => {
    // Otherwise the tick is a one-way door: the student says done, Gradescope
    // says nothing was submitted, and the extension believes the student.
    const missing = raw({
      source: "gradescope",
      sourceId: "7",
      title: "Homework 1",
      dueAt: "2026-09-18T23:59:00-05:00",
      status: "missing",
    });
    const item = dedupe([missing], { ...NO_OVERRIDES, doneKeys: ["gradescope:7"] })[0]!;
    expect(item.done).toBe(true);
    expect(contradictsDone(item)).toBe(true);
    expect(isTickedDone(item)).toBe(false);
  });

  it("prunes a tick whose work §5.4 purged, so it cannot re-arm later", () => {
    // Pruned like `hiddenKeys`, and by the same rule: a key for work that has
    // aged out stays armed forever otherwise, silently re-ticking any future row
    // that happens to reform the same member set.
    const stale = { ...NO_OVERRIDES, doneKeys: ["gradescope:gone", "gradescope:kept"] };
    const kept = raw({
      source: "gradescope",
      sourceId: "kept",
      title: "Kept",
      dueAt: "2026-09-18T23:59:00-05:00",
    });
    const gone = raw({
      source: "gradescope",
      sourceId: "gone",
      title: "Gone",
      // Past §5.4's 60-day purge horizon.
      dueAt: "2026-05-01T17:00:00-05:00",
    });
    const result = applyRetention(
      { "gradescope:kept": kept, "gradescope:gone": gone },
      new Set(["gradescope:kept", "gradescope:gone"]),
      {},
      stale,
      "2026-09-10T18:00:00.000Z",
    );
    expect(result.purged).toEqual(["gradescope:gone"]);
    expect(result.overrides.doneKeys).toEqual(["gradescope:kept"]);
  });
});

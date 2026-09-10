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
  datesCompatible,
  dedupe,
  itemId,
  sameCourse,
  shouldMerge,
  titlesCompatible,
} from "../src/core/dedupe.js";
import type { Overrides, RawItem } from "../src/sources/types.js";

const NO_OVERRIDES: Overrides = {
  mergeGroups: [],
  splitKeys: [],
  hiddenItemIds: [],
  disabledCourses: [],
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

    it("hides an item by id and drops a disabled course entirely", () => {
      const [item] = dedupe([gs, canvas], NO_OVERRIDES);
      expect(dedupe([gs, canvas], { ...NO_OVERRIDES, hiddenItemIds: [item!.id] })[0]!.hidden).toBe(
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

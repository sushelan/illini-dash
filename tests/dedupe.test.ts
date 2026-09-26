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
  isItemDone,
  isTickedDone,
  itemId,
  opensAt,
  sameCourse,
  shouldMerge,
  sortItems,
  titlesCompatible,
  withoutKeys,
} from "../src/core/dedupe.js";
import type { Item, Overrides, RawItem } from "../src/sources/types.js";

const NO_OVERRIDES: Overrides = {
  mergeGroups: [],
  splitKeys: [],
  hiddenKeys: [],
  disabledCourses: [],
  doneKeys: [],
  keptCourses: [],
  courseNames: {},
  dueOverrides: {},
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

  it("keeps a row whose full credit has gone and whose late window is open", () => {
    /*
     * The other half of Sushi's 2026-09-21 decision: such a row is *banded* as
     * late (`missedDeadline`), and nothing about that reaches retention, which
     * measures §5.4's 60 days from `dueAt` and is 53 days from purging this
     * one. If it ever stopped, the row would be announced as late and then
     * deleted while PrairieLearn was still paying 80% for it.
     */
    const ladder = {
      "prairielearn:mp1": raw({
        source: "prairielearn",
        sourceId: "mp1",
        title: "MP1",
        dueAt: "2026-09-09T23:59:00Z",
        lateDueAt: "2026-09-10T23:59:00Z",
      }),
    };
    const result = applyRetention(ladder, new Set(), {}, NO_OVERRIDES, now);
    expect(result.purged).toEqual([]);
    expect(Object.keys(result.raw)).toEqual(["prairielearn:mp1"]);
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

  it("drops an instructor's correction when the row it corrected is purged", () => {
    // Left behind it is an instant keyed to nothing, waiting to move whatever
    // future row reuses the key — and `buildItem` treats it as *stated*, so it
    // would win over the source outright.
    const entry = {
      at: "2026-10-02T23:59:00-05:00",
      reason: "Campuswire post 2026-09-18",
      postId: "cw-1",
      appliedAt: "2026-09-18T15:30:00-05:00",
    };
    const overrides: Overrides = {
      ...NO_OVERRIDES,
      dueOverrides: { "gradescope:old": entry, "gradescope:recent": entry },
    };
    const result = applyRetention(stored, new Set(Object.keys(stored)), {}, overrides, now);
    expect(Object.keys(result.overrides.dueOverrides)).toEqual(["gradescope:recent"]);
  });
});

describe("a deadline an instructor's post moved", () => {
  const override = (at: string, extra: Partial<Overrides["dueOverrides"][string]> = {}) => ({
    ...NO_OVERRIDES,
    dueOverrides: {
      "gradescope:mp3": {
        at,
        from: "2026-09-30T23:59:00-05:00",
        reason: "Campuswire post 2026-09-18",
        postId: "cw-1",
        appliedAt: "2026-09-18T15:30:00-05:00",
        ...extra,
      },
    },
  });

  const mp3 = (dueAt = "2026-09-30T23:59:00-05:00") =>
    raw({ source: "gradescope", sourceId: "mp3", title: "MP3", dueAt });

  it("is the item's stated instant, over what the source still prints", () => {
    // Not a second precedence rung: the instructor said it, so it *is* a stated
    // value, and §5.3 ranks sources by whose deadline is authoritative — which
    // is not Gradescope's cached copy of the date the course has replaced.
    const [item] = dedupe([mp3()], override("2026-10-02T23:59:00-05:00"));
    expect(item!.dueAt).toBe("2026-10-02T23:59:00-05:00");
    expect(item!.timeAssumed).toBeUndefined();
  });

  it("outranks a higher-ranked source's own date on a merged row", () => {
    const canvas = raw({
      source: "canvas",
      sourceId: "c-mp3",
      title: "MP3",
      dueAt: "2026-09-30T23:59:00-05:00",
    });
    const [item] = dedupe([mp3(), canvas], override("2026-10-02T23:59:00-05:00"));
    expect(item!.members).toHaveLength(2);
    expect(item!.dueAt).toBe("2026-10-02T23:59:00-05:00");
  });

  it("carries the post's own assumed 23:59 through as assumed", () => {
    // Worker rule 3: a post naming a day and no clock must not end up looking
    // like a time anybody stated.
    const [item] = dedupe([mp3()], override("2026-10-02T23:59:00-05:00", { timeAssumed: true }));
    expect(item!.timeAssumed).toBe(true);
  });

  it("says who moved it, so the row can offer an undo", () => {
    const [item] = dedupe([mp3()], override("2026-10-02T23:59:00-05:00"));
    expect(item!.movedBy).toEqual({
      reason: "Campuswire post 2026-09-18",
      from: "2026-09-30T23:59:00-05:00",
      postId: "cw-1",
    });
  });

  it("re-arms a fired 24h lead when the override lands", () => {
    // The whole point of treating this as a move: the 24h lead was spent on
    // 30 September, the instructor has moved the deadline to 2 October, and a
    // surviving record would silence the reminder for the deadline that now
    // exists — §7's record is about a moment, and that moment is gone.
    const before = dedupe([mp3()], NO_OVERRIDES);
    before[0]!.notified = { "24h": "2026-09-29T23:59:00-05:00", "2h": "2026-09-30T21:59:00-05:00" };

    const after = dedupe([mp3()], override("2026-10-02T23:59:00-05:00"), { previous: before });
    // Same members, so the same id — this is the *same row*, corrected.
    expect(after[0]!.id).toBe(before[0]!.id);
    expect(after[0]!.notified["24h"]).toBeUndefined();
    expect(after[0]!.notified["2h"]).toBeUndefined();
    expect(Date.parse(after[0]!.movedFrom!)).toBe(Date.parse("2026-09-30T23:59:00-05:00"));
  });

  it("leaves a row alone when the source already prints the override's instant", () => {
    const before = dedupe([mp3("2026-10-02T23:59:00-05:00")], NO_OVERRIDES);
    before[0]!.notified = { "24h": "2026-10-01T23:59:00-05:00" };
    const after = dedupe([mp3("2026-10-02T23:59:00-05:00")], override("2026-10-02T23:59:00-05:00"), {
      previous: before,
    });
    expect(after[0]!.notified["24h"]).toBe("2026-10-01T23:59:00-05:00");
  });

  it("takes the newest correction when a group holds two", () => {
    const canvas = raw({
      source: "canvas",
      sourceId: "c-mp3",
      title: "MP3",
      dueAt: "2026-09-30T23:59:00-05:00",
    });
    const overrides: Overrides = {
      ...NO_OVERRIDES,
      dueOverrides: {
        "gradescope:mp3": {
          at: "2026-10-02T23:59:00-05:00",
          reason: "Campuswire post 2026-09-18",
          postId: "cw-1",
          appliedAt: "2026-09-18T15:30:00-05:00",
        },
        "canvas:c-mp3": {
          at: "2026-10-05T23:59:00-05:00",
          reason: "Campuswire post 2026-09-19",
          postId: "cw-2",
          appliedAt: "2026-09-19T09:00:00-05:00",
        },
      },
    };
    const [item] = dedupe([mp3(), canvas], overrides);
    expect(item!.dueAt).toBe("2026-10-05T23:59:00-05:00");
    expect(item!.movedBy?.postId).toBe("cw-2");
  });

  it("gives an undated row a date, and says it moved", () => {
    const undated = raw({ source: "gradescope", sourceId: "mp3", title: "MP3" });
    const [item] = dedupe([undated], {
      ...NO_OVERRIDES,
      dueOverrides: {
        "gradescope:mp3": {
          at: "2026-10-02T23:59:00-05:00",
          reason: "Piazza post 2026-09-18",
          postId: "pz-1",
          appliedAt: "2026-09-18T15:30:00-05:00",
        },
      },
    });
    expect(item!.dueAt).toBe("2026-10-02T23:59:00-05:00");
    expect(item!.movedBy?.from).toBeUndefined();
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

describe("not-for-credit work (§4.3)", () => {
  const practice = (sourceId: string) =>
    raw({
      source: "prairielearn",
      sourceId,
      title: "PQ1 Practice Quiz 1 (NOT FOR CREDIT)",
      dueAt: "2026-09-11T17:00:00-05:00",
      extra: { forCredit: "false" },
    });
  const graded = (title: string) =>
    raw({
      source: "prairielearn",
      sourceId: "1:HW3",
      title,
      dueAt: "2026-09-11T17:00:00-05:00",
    });

  it("carries the parser's flag onto the item, which nothing read before", () => {
    expect(dedupe([practice("1:PQ1")], NO_OVERRIDES)[0]!.forCredit).toBe(false);
  });

  it("sorts it last among things due at the same moment", () => {
    // §4.3: "the popup sorts them last within their day". Alphabetically the
    // practice quiz would come first, which is how half of CS 357's page ended
    // up above real homework.
    const sorted = dedupe([practice("1:AAA"), graded("ZZZ Homework 3")], NO_OVERRIDES);
    expect(sorted.map((i) => i.title)).toEqual([
      "ZZZ Homework 3",
      "PQ1 Practice Quiz 1 (NOT FOR CREDIT)",
    ]);
  });

  it("does not demote a merged row that some other source grades", () => {
    // One source failing to label a practice quiz is not evidence that it
    // counts; a source that grades it is evidence that it does.
    const gs = raw({
      source: "gradescope",
      sourceId: "9",
      title: "PQ1 Practice Quiz 1",
      dueAt: "2026-09-11T17:00:00-05:00",
    });
    const merged = dedupe([practice("1:PQ1"), gs], NO_OVERRIDES);
    expect(merged[0]!.members).toHaveLength(2);
    expect(merged[0]!.forCredit).toBeUndefined();
  });
});

describe("ordering rows that have not opened yet", () => {
  const row = (title: string, releasedAt?: string, dueAt?: string): Item => ({
    id: title,
    members: releasedAt ? [raw({ source: "prairielearn", sourceId: title, title, extra: { releasedAt } })] : [],
    courseLabel: "ECE374",
    title,
    kind: "assignment",
    dueAt,
    url: "https://us.prairielearn.com/",
    status: "not_submitted",
    hidden: false,
    done: false,
    notified: {},
  });

  it("reads the opening instant off whichever member states one", () => {
    expect(opensAt(row("GPS4", "2026-09-12T09:00:00-05:00"))).toBe(
      Date.parse("2026-09-12T09:00:00-05:00"),
    );
    expect(opensAt(row("GPS4"))).toBeUndefined();
  });

  it("orders them by when they open, not by title", () => {
    // The real list: GPS4 opens Sep 12 and GPS11 opens Nov 28. Sorting undated
    // rows on title alone put Undecidability above Language Transformations,
    // and both below everything else.
    const order = sortItems([
      row("GPS11 Undecidability", "2026-11-28T09:00:00-06:00"),
      row("GPS4 Language Transformations", "2026-09-12T09:00:00-05:00"),
    ]).map((i) => i.title);
    expect(order[0]).toContain("GPS4");
  });

  it("still sorts a row with no instant at all to the end", () => {
    const order = sortItems([
      row("undated"),
      row("GPS4", "2026-09-12T09:00:00-05:00"),
      row("due", undefined, "2026-09-11T23:59:00-05:00"),
    ]).map((i) => i.title);
    expect(order).toEqual(["due", "GPS4", "undated"]);
  });
});

/**
 * The `manual` source in §5.3.
 *
 * Two questions: does a typed row merge with the fetched row for the same work
 * (it must, or the student sees their reminder twice), and can two typed rows
 * merge with each other (they must not, or adding the same title twice silently
 * loses one of the two dates).
 */
describe("a deadline the student typed in", () => {
  const typed = raw({
    source: "manual",
    sourceId: "uuid-1",
    title: "Homework 1",
    dueAt: "2026-09-09T17:00:00-05:00",
    status: "unknown",
    url: undefined,
  });

  it("merges with the submission system's row for the same work", () => {
    const gradescope = raw({
      source: "gradescope",
      sourceId: "8398957",
      title: "Homework 1",
      dueAt: "2026-09-09T17:00:00-05:00",
      url: "https://www.gradescope.com/courses/1/assignments/8398957",
    });
    const items = dedupe([typed, gradescope], NO_OVERRIDES);
    expect(items).toHaveLength(1);
    expect(items[0]!.members.map((m) => m.source).sort()).toEqual(["gradescope", "manual"]);
  });

  it("never merges with another typed row, however alike", () => {
    // §5.3's "never two rows from the same source", which is the whole defence
    // here: the student is the one who knows these are two different things —
    // two drafts of one essay, the same reading for two weeks — and nothing in
    // the title or the date can tell them apart.
    const second = raw({
      source: "manual",
      sourceId: "uuid-2",
      title: "Homework 1",
      dueAt: "2026-09-09T17:00:00-05:00",
      status: "unknown",
      url: undefined,
    });
    expect(dedupe([typed, second], NO_OVERRIDES)).toHaveLength(2);
    expect(shouldMerge(typed, second, normalizeTitle(typed.title), normalizeTitle(second.title)))
      .toBe(false);
  });

  it("owns the deadline against a course site and against Canvas", () => {
    // SOURCE_RANK: a student stating a time outranks §4.5's invented 23:59 and a
    // Canvas date that arrived as an LTI copy.
    const site = raw({
      source: "site",
      sourceId: "cs424-fa26:hw1",
      title: "Homework 1",
      dueAt: "2026-09-09T23:59:00-05:00",
      url: "https://courses.grainger.illinois.edu/cs424/fa2026/schedule.html",
      extra: { timeAssumed: "true" },
    });
    const merged = dedupe([site, typed], NO_OVERRIDES);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.dueAt).toBe("2026-09-09T17:00:00-05:00");
    // And it has no url of its own, so the site's link is what a click opens.
    expect(merged[0]!.url).toBe(site.url);
  });

  it("outranks Canvas even when Canvas states a real time", () => {
    /*
     * This is the rank itself, with nothing else deciding it.
     *
     * The course-site case above is settled before the rank is consulted — an
     * assumed 23:59 is the last resort however high its source sits — so it
     * passes just as happily with `manual` ranked last. Canvas states a real
     * instant here, and both rows carry a link, so the only thing that can pick
     * between them is SOURCE_RANK.
     *
     * §5.3's rank is about whose deadline is authoritative: a Canvas date is an
     * LTI copy, and the student typing one in is stating it first-hand.
     */
    const canvas = raw({
      source: "canvas",
      sourceId: "assignment:9002",
      title: "Homework 1",
      dueAt: "2026-09-09T09:00:00-05:00",
      url: "https://canvas.illinois.edu/courses/1/assignments/9002",
    });
    const typedWithLink = raw({
      source: "manual",
      sourceId: "uuid-3",
      title: "Homework 1",
      dueAt: "2026-09-09T17:00:00-05:00",
      status: "unknown",
      url: "https://piazza.com/class/abc",
    });
    const merged = dedupe([canvas, typedWithLink], NO_OVERRIDES);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.dueAt).toBe("2026-09-09T17:00:00-05:00");
    expect(merged[0]!.url).toBe("https://piazza.com/class/abc");
  });

  it("yields to the system the work is actually handed in to", () => {
    // Gradescope ranks above `manual` deliberately: if the two disagree, the
    // system that will refuse a late upload is the one that is right.
    const gradescope = raw({
      source: "gradescope",
      sourceId: "8398957",
      title: "Homework 1",
      dueAt: "2026-09-09T22:00:00-05:00",
      url: "https://www.gradescope.com/courses/1/assignments/8398957",
    });
    const merged = dedupe([typed, gradescope], NO_OVERRIDES);
    expect(merged[0]!.dueAt).toBe("2026-09-09T22:00:00-05:00");
    expect(merged[0]!.url).toBe(gradescope.url);
  });

  it("leaves an item with no link at all rather than inventing one", () => {
    const alone = dedupe([typed], NO_OVERRIDES);
    expect(alone[0]!.url).toBeUndefined();
  });
});

describe("withoutKeys", () => {
  it("drops every mention of a key, so a deleted row cannot re-apply later", () => {
    const overrides: Overrides = {
      ...NO_OVERRIDES,
      hiddenKeys: ["manual:uuid-1", "gradescope:1"],
      doneKeys: ["manual:uuid-1"],
      splitKeys: ["manual:uuid-1"],
      mergeGroups: [["manual:uuid-1", "gradescope:1"], ["gradescope:1", "canvas:2"]],
    };
    const after = withoutKeys(overrides, ["manual:uuid-1"]);
    expect(after.hiddenKeys).toEqual(["gradescope:1"]);
    expect(after.doneKeys).toEqual([]);
    expect(after.splitKeys).toEqual([]);
    // The group that is down to one member is not a merge any more.
    expect(after.mergeGroups).toEqual([["gradescope:1", "canvas:2"]]);
  });

  it("hands back the same overrides when there is nothing to drop", () => {
    expect(withoutKeys(NO_OVERRIDES, [])).toBe(NO_OVERRIDES);
  });

  it("drops a rename with its row, so it cannot name a future row that reuses the key", () => {
    const after = withoutKeys(
      { ...NO_OVERRIDES, titleNames: { "manual:uuid-1": "Mine", "gradescope:1": "Kept" } },
      ["manual:uuid-1"],
    );
    expect(after.titleNames).toEqual({ "gradescope:1": "Kept" });
  });
});

describe("isItemDone: a source with nothing to say does not vote", () => {
  const merged = (...statuses: RawItem["status"][]): Item => ({
    id: "hw1",
    members: statuses.map((status, at) =>
      raw({ source: at === 0 ? "gradescope" : "site", sourceId: `m${at}`, title: "HW1", status }),
    ),
    courseLabel: "CS425",
    title: "HW1",
    kind: "assignment",
    dueAt: "2026-09-20T23:59:00-05:00",
    url: "https://example.invalid/x",
    status: "submitted",
    hidden: false,
    done: false,
    notified: {},
  });

  it("counts work handed in on Gradescope as done when a course page merged into it", () => {
    /*
     * Sushi, 2026-09-21: CS 425 HW1, submitted on Gradescope, drawn in the Late
     * band at "45m late". §4.5 emits `status: "unknown"` on every course-site
     * row because a schedule page states a deadline and never a submission, and
     * `every` read that abstention as dissent — so any Gradescope submission
     * that merged with a course page was permanently unfinished.
     */
    expect(isItemDone(merged("submitted", "unknown"))).toBe(true);
    expect(isItemDone(merged("graded", "unknown", "unknown"))).toBe(true);
  });

  it("still refuses when a source that does track submissions says otherwise", () => {
    // The guarantee the `every` was written for, unchanged: one outstanding
    // member keeps the group outstanding, whatever the merged status reads.
    expect(isItemDone(merged("submitted", "not_submitted"))).toBe(false);
    expect(isItemDone(merged("graded", "missing"))).toBe(false);
  });

  it("needs someone to actually claim it, not merely nobody to deny it", () => {
    // Every member abstaining is not evidence of anything. A row nothing knows
    // about is outstanding, or a course site alone would finish its own rows.
    expect(isItemDone(merged("unknown", "unknown"))).toBe(false);
  });

  it("reads an unmerged row off its own status", () => {
    const alone = { ...merged(), members: [], status: "submitted" as const };
    expect(isItemDone(alone)).toBe(true);
    expect(isItemDone({ ...alone, status: "not_submitted" })).toBe(false);
  });
});

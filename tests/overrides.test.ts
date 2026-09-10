/**
 * §8.1's row menu and §8.2's course list. §9 gives G3 a budget of two manual
 * corrections a semester, so each one has to stick — and applying one must
 * never quietly undo another.
 */

import { describe, expect, it } from "vitest";
import {
  courseSummaries,
  hideItem,
  memberKeysOf,
  mergeItems,
  setCourseDisabled,
  splitItem,
  unhideItem,
} from "../src/core/overrides.js";
import { dedupe } from "../src/core/dedupe.js";
import type { Item, Overrides, RawItem } from "../src/sources/types.js";

const NO_OVERRIDES: Overrides = {
  mergeGroups: [],
  splitKeys: [],
  hiddenItemIds: [],
  disabledCourses: [],
};

function raw(source: RawItem["source"], sourceId: string, title: string, dueAt?: string): RawItem {
  return {
    source,
    sourceId,
    courseRaw: "CS 357",
    courseCode: "CS357",
    title,
    kind: "assignment",
    url: "https://example.invalid/",
    status: "not_submitted",
    dueAt,
    fetchedAt: "2026-09-10T18:00:00.000Z",
  };
}

const DUE = "2026-09-11T22:00:00.000Z";

function itemOf(members: RawItem[]): Item {
  return dedupe(members, NO_OVERRIDES)[0]!;
}

describe("hide", () => {
  it("adds and removes an id without duplicating it", () => {
    let o = hideItem(NO_OVERRIDES, "abc");
    o = hideItem(o, "abc");
    expect(o.hiddenItemIds).toEqual(["abc"]);
    expect(unhideItem(o, "abc").hiddenItemIds).toEqual([]);
  });
});

describe("split (§5.3)", () => {
  const merged = itemOf([
    raw("gradescope", "1", "HW3", DUE),
    raw("canvas", "2", "HW3 Errors and Big-O", DUE),
    raw("prairielearn", "3", "HW3 Errors", DUE),
  ]);

  it("marks every member, not just one", () => {
    // Splitting a three-way group by one key would leave the other two merged,
    // so the row the student complained about would still be there.
    const o = splitItem(NO_OVERRIDES, merged);
    expect(new Set(o.splitKeys)).toEqual(new Set(memberKeysOf(merged)));
    expect(dedupe(merged.members, o)).toHaveLength(3);
  });

  it("drops a stale mergeGroup that would immediately re-join them", () => {
    // dedupe applies mergeGroups after the automatic pass, so leaving one in
    // place would make the split appear to do nothing.
    const keys = memberKeysOf(merged);
    const withGroup: Overrides = { ...NO_OVERRIDES, mergeGroups: [keys] };
    const o = splitItem(withGroup, merged);
    expect(o.mergeGroups).toEqual([]);
    expect(dedupe(merged.members, o)).toHaveLength(3);
  });

  it("does nothing to a single-member item", () => {
    const single = itemOf([raw("gradescope", "1", "HW3", DUE)]);
    expect(splitItem(NO_OVERRIDES, single)).toBe(NO_OVERRIDES);
  });
});

describe("merge (§8.1's 'Merge with…')", () => {
  const a = itemOf([raw("gradescope", "1", "Reading response", DUE)]);
  const b = itemOf([raw("canvas", "2", "Weekly reflection", DUE)]);

  it("forces two items together across the automatic rule", () => {
    const o = mergeItems(NO_OVERRIDES, a, b);
    expect(dedupe([...a.members, ...b.members], o)).toHaveLength(1);
  });

  it("lifts the keys out of splitKeys, so changing your mind works", () => {
    // dedupe keeps split keys out of the automatic pass, so a merge that left
    // them marked would be fighting a rule the student no longer wants.
    const split: Overrides = { ...NO_OVERRIDES, splitKeys: ["gradescope:1", "canvas:2"] };
    const o = mergeItems(split, a, b);
    expect(o.splitKeys).toEqual([]);
    expect(dedupe([...a.members, ...b.members], o)).toHaveLength(1);
  });

  it("accumulates into one group rather than several overlapping ones", () => {
    const c = itemOf([raw("prairietest", "3", "Something else", DUE)]);
    let o = mergeItems(NO_OVERRIDES, a, b);
    o = mergeItems(o, b, c);
    expect(o.mergeGroups).toHaveLength(1);
    expect(new Set(o.mergeGroups[0])).toEqual(
      new Set(["gradescope:1", "canvas:2", "prairietest:3"]),
    );
    expect(dedupe([...a.members, ...b.members, ...c.members], o)).toHaveLength(1);
  });
});

describe("split then merge, and merge then split", () => {
  const members = [raw("gradescope", "1", "HW3", DUE), raw("canvas", "2", "HW3 Errors", DUE)];
  const merged = itemOf(members);

  it("round-trips without either override being stranded", () => {
    const split = splitItem(NO_OVERRIDES, merged);
    expect(dedupe(members, split)).toHaveLength(2);

    const parts = dedupe(members, split);
    const remerged = mergeItems(split, parts[0]!, parts[1]!);
    expect(dedupe(members, remerged)).toHaveLength(1);

    const resplit = splitItem(remerged, dedupe(members, remerged)[0]!);
    expect(dedupe(members, resplit)).toHaveLength(2);
  });
});

describe("courseSummaries (§8.2)", () => {
  const stored = {
    "gradescope:1": raw("gradescope", "1", "HW1", DUE),
    "canvas:2": raw("canvas", "2", "HW2", DUE),
    "prairietest:3": { ...raw("prairietest", "3", "Quiz", DUE), courseCode: "PHYS435" },
    "site:4": { ...raw("site", "4", "x", DUE), courseCode: undefined, courseRaw: "Senior Design" },
  };

  it("lists every course seen, with its sources and counts", () => {
    const summaries = courseSummaries(stored, NO_OVERRIDES);
    expect(summaries.map((s) => s.key)).toEqual(["CS357", "PHYS435", "Senior Design"]);
    expect(summaries[0]!.itemCount).toBe(2);
    expect(new Set(summaries[0]!.sources)).toEqual(new Set(["gradescope", "canvas"]));
  });

  it("marks the disabled ones and toggles cleanly", () => {
    const off = setCourseDisabled(NO_OVERRIDES, "CS357", true);
    expect(courseSummaries(stored, off)[0]!.disabled).toBe(true);
    expect(setCourseDisabled(off, "CS357", true)).toBe(off);
    expect(setCourseDisabled(off, "CS357", false).disabledCourses).toEqual([]);
  });

  it("still lists a course whose items are all filtered out", () => {
    // Built from raw, not items — otherwise a student could not re-enable
    // something they had switched off.
    const off = setCourseDisabled(NO_OVERRIDES, "CS357", true);
    expect(dedupe(Object.values(stored), off).some((i) => i.courseCode === "CS357")).toBe(false);
    expect(courseSummaries(stored, off).some((s) => s.key === "CS357")).toBe(true);
  });
});

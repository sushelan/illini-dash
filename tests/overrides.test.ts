/**
 * §8.1's row menu and §8.2's course list. §9 gives G3 a budget of two manual
 * corrections a semester, so each one has to stick — and applying one must
 * never quietly undo another.
 */

import { describe, expect, it } from "vitest";
import {
  courseSummaries,
  hideItem,
  markDone,
  markNotDone,
  memberKeysOf,
  mergeItems,
  setCourseDisabled,
  splitItem,
  unhideItem,
} from "../src/core/overrides.js";
import { applyRetention, dedupe } from "../src/core/dedupe.js";
import type { Item, Overrides, RawItem } from "../src/sources/types.js";

const NO_OVERRIDES: Overrides = {
  mergeGroups: [],
  splitKeys: [],
  hiddenKeys: [],
  disabledCourses: [],
  doneKeys: [],
  keptCourses: [],
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

describe("hide (§8.1)", () => {
  const single = itemOf([raw("gradescope", "1", "HW3", DUE)]);

  it("keys on member keys, not on the group id, without duplicating", () => {
    let o = hideItem(NO_OVERRIDES, single);
    o = hideItem(o, single);
    expect(o.hiddenKeys).toEqual(["gradescope:1"]);
    expect(dedupe(single.members, o)[0]!.hidden).toBe(true);
    expect(unhideItem(o, single).hiddenKeys).toEqual([]);
  });

  it("survives the group changing, which an id-keyed hide would not", () => {
    // Item.id is a hash of the sorted member keys, so a hide keyed by it is
    // spent the moment a second source mirrors the assignment.
    const hidden = hideItem(NO_OVERRIDES, single);
    const mirrored = [...single.members, raw("canvas", "2", "HW3 Errors and Big-O", DUE)];
    const regrouped = dedupe(mirrored, hidden);
    expect(regrouped).toHaveLength(1);
    expect(regrouped[0]!.id).not.toBe(single.id);
    // Every member hidden → still hidden.
    expect(dedupe(mirrored, hideItem(hidden, regrouped[0]!))[0]!.hidden).toBe(true);
  });

  it("does not hide a group where only one member was hidden", () => {
    const hidden = hideItem(NO_OVERRIDES, single);
    const mirrored = [...single.members, raw("canvas", "2", "HW3 Errors and Big-O", DUE)];
    expect(dedupe(mirrored, hidden)[0]!.hidden).toBe(false);
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

describe("retention prunes every override, including hides", () => {
  it("drops a hiddenKey whose item was purged (§5.4)", () => {
    const item = itemOf([raw("gradescope", "old", "Ancient", "2026-06-01T00:00:00Z")]);
    const hidden = hideItem(NO_OVERRIDES, item);
    expect(hidden.hiddenKeys).toEqual(["gradescope:old"]);

    const stored = { "gradescope:old": item.members[0]! };
    const result = applyRetention(
      stored,
      new Set(Object.keys(stored)),
      {},
      hidden,
      "2026-09-10T18:00:00.000Z",
    );
    // Left unpruned it stays armed for the life of the install, silently
    // re-hiding any future group that re-forms the same member set.
    expect(result.purged).toEqual(["gradescope:old"]);
    expect(result.overrides.hiddenKeys).toEqual([]);
  });
});

describe("a regrouped item keeps what it already fired (§7)", () => {
  const members = [raw("gradescope", "1", "HW3", DUE), raw("canvas", "2", "HW3 Errors", DUE)];

  it("carries notified across a split, so neither half re-fires", () => {
    // Item.id is a hash of the member keys, so a split mints new ids that miss
    // the id lookup — and mutate() reschedules two lines later, firing them at
    // once for a deadline the student was already reminded about.
    const merged = dedupe(members, NO_OVERRIDES);
    merged[0]!.notified = { "24h": "2026-09-10T18:00:00.000Z" };

    const split = splitItem(NO_OVERRIDES, merged[0]!);
    const parts = dedupe(members, split, { previous: merged });
    expect(parts).toHaveLength(2);
    for (const part of parts) expect(part.notified["24h"], part.title).toBe("2026-09-10T18:00:00.000Z");
  });

  it("carries notified across a merge, taking the union", () => {
    const separate = dedupe(members, splitItem(NO_OVERRIDES, dedupe(members, NO_OVERRIDES)[0]!));
    separate[0]!.notified = { "24h": "2026-09-10T18:00:00.000Z" };
    separate[1]!.notified = { "2h": "2026-09-10T19:00:00.000Z" };

    const remerged = dedupe(members, NO_OVERRIDES, { previous: separate });
    expect(remerged).toHaveLength(1);
    expect(remerged[0]!.notified).toEqual({
      "24h": "2026-09-10T18:00:00.000Z",
      "2h": "2026-09-10T19:00:00.000Z",
    });
  });
});

describe("marking work done by hand", () => {
  it("marks every member, so a later merge does not resurrect the row", () => {
    const item = {
      id: "x",
      members: [
        { source: "site", sourceId: "cs424:1" },
        { source: "canvas", sourceId: "assignment:9" },
      ],
    } as unknown as Parameters<typeof markDone>[1];
    const after = markDone(NO_OVERRIDES, item);
    expect(after.doneKeys.sort()).toEqual(["canvas:assignment:9", "site:cs424:1"]);
  });

  it("undoes cleanly and leaves other keys alone", () => {
    const item = {
      id: "x",
      members: [{ source: "site", sourceId: "cs424:1" }],
    } as unknown as Parameters<typeof markDone>[1];
    const done = markDone({ ...NO_OVERRIDES, doneKeys: ["gradescope:7"] }, item);
    expect(markNotDone(done, item).doneKeys).toEqual(["gradescope:7"]);
  });
});

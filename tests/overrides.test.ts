/**
 * §8.1's row menu and §8.2's course list. §9 gives G3 a budget of two manual
 * corrections a semester, so each one has to stick — and applying one must
 * never quietly undo another.
 */

import { describe, expect, it } from "vitest";
import {
  acceptSuggestion,
  applyDueOverride,
  courseSummaries,
  dismissSuggestion,
  hideItem,
  markDone,
  markNotDone,
  memberKeysOf,
  mergeItems,
  setCourseDisabled,
  splitItem,
  studentDueOverride,
  STUDENT_POST_ID,
  undoDueOverride,
  unhideItem,
} from "../src/core/overrides.js";
import { applyRetention, dedupe, sameCourse } from "../src/core/dedupe.js";
import { anchorOf, attentionGroups, dayKey, dayList, noDateCount } from "../src/core/calendar.js";
import { unreadableDeadline } from "../src/core/quality.js";
import { ManualItemError, newManualItem } from "../src/core/manual.js";
import type { DueOverride, Item, Overrides, RawItem, Suggestion } from "../src/sources/types.js";

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

/* -------------------------------------------------------------------------- */
/* Corrections from a post (Sushi, 2026-09-18)                                 */
/* -------------------------------------------------------------------------- */

describe("applyDueOverride / undoDueOverride", () => {
  const entry: DueOverride = {
    at: "2026-10-02T23:59:00-05:00",
    from: "2026-09-30T23:59:00-05:00",
    reason: "Campuswire post 2026-09-18",
    postId: "cw-1",
    appliedAt: "2026-09-18T15:30:00-05:00",
  };

  const twoSource = {
    id: "x",
    members: [
      { source: "gradescope", sourceId: "mp3" },
      { source: "canvas", sourceId: "c-mp3" },
    ],
  } as unknown as Item;

  it("marks every member, like a hide", () => {
    // `Item.id` is a hash of the sorted member keys, so a correction keyed by
    // it is spent the moment Canvas mirrors the row — and the instructor's new
    // date would revert to the source's old one with nothing to say why.
    const after = applyDueOverride(NO_OVERRIDES, twoSource, entry);
    expect(Object.keys(after.dueOverrides).sort()).toEqual(["canvas:c-mp3", "gradescope:mp3"]);
    expect(after.dueOverrides["canvas:c-mp3"]).toEqual(entry);
  });

  it("takes every key of the row back off, and leaves other rows alone", () => {
    const other = {
      id: "y",
      members: [{ source: "prairielearn", sourceId: "hw3" }],
    } as unknown as Item;
    const both = applyDueOverride(applyDueOverride(NO_OVERRIDES, twoSource, entry), other, entry);
    const after = undoDueOverride(both, memberKeysOf(twoSource));
    expect(Object.keys(after.dueOverrides)).toEqual(["prairielearn:hw3"]);
  });
});

describe("accepting and dismissing a suggestion", () => {
  const suggestion: Suggestion = {
    id: "s1",
    kind: "new",
    title: "Quiz 1",
    courseRaw: "CS 357",
    courseCode: "CS357",
    at: "2026-10-12T17:00:00-05:00",
    timeAssumed: false,
    span: "10/12 at 5 PM",
    context: "Quiz 1 is due 10/12 at 5 PM.",
    source: "campuswire",
    postId: "cw-1",
    postedAt: "2026-09-18T15:00:00-05:00",
    createdAt: "2026-09-18T15:30:00-05:00",
  };

  it("hands core/manual.ts the wall clock in the student's zone, not UTC", () => {
    // 5 PM central is 22:00 UTC the same day, but an 11:59 PM deadline is the
    // *next* day in UTC — so a `toISOString().slice(0, 10)` would file half the
    // suggestions on the wrong date. Checked at the hour that proves it.
    const late = { ...suggestion, at: "2026-10-12T23:59:00-05:00" };
    const accepted = acceptSuggestion([late], "s1", "America/Chicago")!;
    expect(accepted.input.date).toBe("2026-10-12");
    expect(accepted.input.time).toBe("23:59");
    expect(accepted.input.courseRaw).toBe("CS 357");
    expect(accepted.input.note).toContain("Quiz 1 is due");
    expect(accepted.suggestions).toEqual([]);
  });

  it("passes on no time at all when the clock was this code's invention", () => {
    // Worker rule 3: `newManualItem` fills in 23:59 and marks it assumed, and
    // passing "23:59" here would launder the invention into a time the student
    // appears to have typed — which §5.3 would then rank above Canvas.
    const assumed = { ...suggestion, timeAssumed: true };
    const accepted = acceptSuggestion([assumed], "s1", "America/Chicago")!;
    expect(accepted.input.time).toBeUndefined();
  });

  it("gives a course-less suggestion a course, because a row cannot have none", () => {
    const loose = { ...suggestion, courseRaw: "" };
    expect(acceptSuggestion([loose], "s1", "America/Chicago")!.input.courseRaw).toBe("From a post");
  });

  it("carries the class's course code through, so the row can merge (§5.1)", () => {
    /*
     * A Piazza/Campuswire class is addressed by its display name, and that name
     * need not carry a code — the class's `courseCodes` do. Dropping the code
     * here gives the accepted row `courseCode: undefined`, and `sameCourse`
     * reads "codes on one side only" as *not* the same course, so the row can
     * never merge with the student's CS 425 rows and the Merge picker never
     * offers it.
     */
    const bare = { ...suggestion, courseRaw: "Distributed Systems", courseCode: "CS425" };
    const accepted = acceptSuggestion([bare], "s1", "America/Chicago")!;
    expect(accepted.input.courseCode).toBe("CS425");

    const row = newManualItem(accepted.input, "2026-09-18T13:00:00.000Z", "America/Chicago");
    expect(row.courseCode).toBe("CS425");
    expect(row.courseRaw).toBe("Distributed Systems");
    const gradescope: RawItem = {
      source: "gradescope",
      sourceId: "g1",
      courseRaw: "CS425 ECE428 Fall 2026",
      courseCode: "CS425",
      title: "Quiz 1",
      kind: "quiz",
      status: "unknown",
      fetchedAt: "2026-09-18T13:00:00.000Z",
    };
    expect(sameCourse(row, gradescope)).toBe(true);
  });

  it("derives from the name when the class stated no code", () => {
    const { courseCode: _dropped, ...rest } = suggestion;
    const named = { ...rest, courseRaw: "CS 357 — Numerical Methods" };
    const accepted = acceptSuggestion([named], "s1", "America/Chicago")!;
    expect(accepted.input.courseCode).toBeUndefined();
    expect(
      newManualItem(accepted.input, "2026-09-18T13:00:00.000Z", "America/Chicago").courseCode,
    ).toBe("CS357");
  });

  it("does not pass on a course code of \"\"", () => {
    // House rule 5: `""` is a string, not a code. Passed on, it would sit in
    // `ManualInput` as a stated value and shadow the derivation behind it.
    const blank = { ...suggestion, courseRaw: "CS 357 — Numerical Methods", courseCode: "" };
    const accepted = acceptSuggestion([blank], "s1", "America/Chicago")!;
    expect("courseCode" in accepted.input).toBe(false);
  });

  it("carries the post as the accepted row's link (2026-09-19)", () => {
    /*
     * Every other row's `url` is where it came from, and for a row accepted
     * out of a post that is the post — so "Open ↗" on the deadline screen
     * lands on the sentence the row was read out of (Sushi: "if it says from
     * a piazza or campuswire post, i should be able to get linked to the
     * post"). `newManualItem` is what actually stores it, and it refuses
     * anything that is not https, so this asserts the row and not only the
     * input.
     */
    const posted = { ...suggestion, postId: "campuswire:G794D32E4:682" };
    const accepted = acceptSuggestion([posted], "s1", "America/Chicago")!;
    expect(accepted.input.url).toBe("https://campuswire.com/c/G794D32E4/feed/682");
    expect(
      newManualItem(accepted.input, "2026-09-18T13:00:00.000Z", "America/Chicago").url,
    ).toBe("https://campuswire.com/c/G794D32E4/feed/682");
  });

  it("leaves a pasted post's row with no link rather than a guess", () => {
    // A pasted post never existed on a site this extension knows, so there is
    // nothing to open. `url` is absent, not `""`: `newManualItem` refuses a
    // link it cannot parse, and `""` would be a refusal on every accept.
    const pasted = { ...suggestion, source: "paste" as const, postId: "paste:1758230000000" };
    const accepted = acceptSuggestion([pasted], "s1", "America/Chicago")!;
    expect("url" in accepted.input).toBe(false);
    expect(
      newManualItem(accepted.input, "2026-09-18T13:00:00.000Z", "America/Chicago").url,
    ).toBeUndefined();
  });

  it("answers undefined for an id that is no longer on the list", () => {
    expect(acceptSuggestion([suggestion], "gone", "America/Chicago")).toBeUndefined();
  });

  it("dismisses by id and leaves the rest", () => {
    const other = { ...suggestion, id: "s2" };
    expect(dismissSuggestion([suggestion, other], "s1")).toEqual([other]);
  });
});

describe('"Give it a date" for a source row (brief D3)', () => {
  const ZONE = "America/Chicago";
  const APPLIED = "2026-09-10T18:00:00.000Z";
  const NOW = new Date(2026, 8, 10, 18, 0, 0);

  /** A row Canvas listed and never dated — the commonest No date case. */
  const undated = () => itemOf([raw("canvas", "u1", "Course syllabus acknowledgement")]);
  /** A row whose date was there and could not be read. */
  const unreadable = () =>
    itemOf([
      {
        ...raw("site", "s1", "HW2 Due"),
        extra: { unparsedDueDate: "Week 4, TBD" },
      },
    ]);

  const give = (item: Item, date: string, time?: string) =>
    applyDueOverride(
      NO_OVERRIDES,
      item,
      studentDueOverride(time === undefined ? { date } : { date, time }, item, ZONE, APPLIED),
    );

  it("gives an undated row a stated instant, and it leaves the No date group", () => {
    const item = undated();
    expect(attentionGroups([item], NOW).map((g) => g.name)).toEqual(["No date at all"]);

    const after = dedupe(item.members, give(item, "2026-09-22", "17:00"))[0]!;
    expect(after.dueAt).toBe("2026-09-22T17:00:00-05:00");
    expect(attentionGroups([after], NOW)).toEqual([]);
    expect(noDateCount([after], NOW)).toBe(0);
  });

  it("does the same for a row whose date could not be read", () => {
    // `unreadableDeadline` returns nothing once `dueAt` is set, so the amber
    // "check" chip goes with it — the whole feature falls out of rules that
    // already existed.
    const item = unreadable();
    expect(attentionGroups([item], NOW).map((g) => g.name)).toEqual(["Couldn't read"]);

    const after = dedupe(item.members, give(item, "2026-09-22", "17:00"))[0]!;
    expect(unreadableDeadline(after)).toEqual([]);
    expect(attentionGroups([after], NOW)).toEqual([]);
  });

  it("puts the row on the calendar, with the time not marked as assumed", () => {
    const item = undated();
    const after = dedupe(item.members, give(item, "2026-09-22", "17:00"))[0]!;
    // The student stated the clock, so nothing downstream may treat it as an
    // invention: §5.3's precedence, the .ics export and §7's reminders all key
    // off this flag.
    expect(after.timeAssumed).toBeUndefined();
    const anchor = anchorOf(after, NOW)!;
    expect(anchor.assumed).toBe(false);
    expect(dayKey(new Date(anchor.at))).toBe("2026-09-22");
    expect(dayList([after], new Date(2026, 8, 22), NOW).map((r) => r.item.title)).toEqual([
      "Course syllabus acknowledgement",
    ]);
  });

  it("still marks the 23:59 it fills in when only a day was given", () => {
    /*
     * Worker house rule 3, and the one place this could quietly go wrong: the
     * button is called "Give it a date", and a student who gave a *day* has not
     * stated a clock. Marking it is what keeps §5.3 from ranking this 23:59
     * above a real deadline a source later reports for the same work, and keeps
     * §7 from announcing a time nobody said out loud.
     */
    const item = undated();
    const after = dedupe(item.members, give(item, "2026-09-22"))[0]!;
    expect(after.dueAt).toBe("2026-09-22T23:59:00-05:00");
    expect(after.timeAssumed).toBe(true);
    expect(anchorOf(after, NOW)!.assumed).toBe(true);
  });

  it("survives the group changing, and can be taken back off", () => {
    // Keyed to every member, exactly as an announcement's correction is: a
    // date keyed by `Item.id` is spent the moment a second source mirrors it.
    const item = undated();
    const overrides = give(item, "2026-09-22", "17:00");
    const mirrored = [...item.members, raw("gradescope", "g9", "Course syllabus acknowledgement")];
    const regrouped = dedupe(mirrored, overrides);
    expect(regrouped).toHaveLength(1);
    expect(regrouped[0]!.dueAt).toBe("2026-09-22T17:00:00-05:00");

    const undone = undoDueOverride(overrides, memberKeysOf(regrouped[0]!));
    expect(dedupe(mirrored, undone)[0]!.dueAt).toBeUndefined();
  });

  it("says the date came from the student, and does not claim it moved", () => {
    const item = undated();
    const entry = studentDueOverride({ date: "2026-09-22", time: "17:00" }, item, ZONE, APPLIED);
    expect(entry.reason).toBe("you");
    expect(entry.postId).toBe(STUDENT_POST_ID);
    expect(entry.appliedAt).toBe(APPLIED);
    // An item that had no date did not move, it arrived — "moved Tue → Fri"
    // would name a Tuesday that never existed. The key is *absent*, not present
    // holding undefined: `dueOverrides` goes through JSON on every save, and a
    // record whose shape depends on which build wrote it is worker rule 8's
    // problem waiting to happen.
    expect(entry.from).toBeUndefined();
    expect(Object.keys(entry)).not.toContain("from");
  });

  it("records where a dated row moved from, so Undo move can say so", () => {
    const dated = itemOf([raw("gradescope", "d1", "HW3", "2026-09-11T22:00:00.000Z")]);
    const entry = studentDueOverride({ date: "2026-09-22", time: "17:00" }, dated, ZONE, APPLIED);
    expect(entry.from).toBe("2026-09-11T22:00:00.000Z");
  });

  it("refuses a date nobody could have meant, in the editor's own words", () => {
    // One set of rules for "what counts as a date a student typed": this goes
    // through `core/manual.ts`'s anchored regexes, so the message cannot loosen
    // what the editor already refuses (house rule 5).
    const item = undated();
    expect(() => studentDueOverride({ date: "09/22/2026" }, item, ZONE, APPLIED)).toThrow(
      ManualItemError,
    );
    expect(() => studentDueOverride({ date: "2026-09-31" }, item, ZONE, APPLIED)).toThrow(
      /no such date/,
    );
    expect(() =>
      studentDueOverride({ date: "2026-09-22", time: "5 PM" }, item, ZONE, APPLIED),
    ).toThrow(/HH:MM/);
  });

  it("refuses a year outside this school year, so a typo cannot lose the row", () => {
    // R3 B3: 2016-09-22 measured end to end — the row left the No date tab,
    // matched no section and no board, and the only way to undo it was a
    // screen opened by pressing a row that no longer appeared anywhere.
    const item = undated();
    expect(() => studentDueOverride({ date: "2016-09-22" }, item, ZONE, APPLIED)).toThrow(
      /2016 is not this school year/,
    );
    expect(() => studentDueOverride({ date: "0226-09-22" }, item, ZONE, APPLIED)).toThrow(
      ManualItemError,
    );
    // One year either side is a school year that straddles December.
    expect(studentDueOverride({ date: "2027-01-15" }, item, ZONE, APPLIED).at).toMatch(/^2027-01-15/);
    expect(studentDueOverride({ date: "2025-12-15" }, item, ZONE, APPLIED).at).toMatch(/^2025-12-15/);
  });
});

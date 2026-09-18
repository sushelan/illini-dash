/**
 * `extractCourseCodes` (§5.1) — the function that decides what every row on the
 * calendar is labelled with.
 *
 * It had no direct test until 2026-09-12. It was covered through the parser
 * suites, which is why the one assertion that touched it was free to pin the
 * wrong requirement: `tests/gradescope.test.ts` asserted that an opaque slug
 * yields *no* code, and that is what put `ece_408_120261_257494` on the
 * calendar as a course name.
 */

import { describe, expect, it } from "vitest";
import { extractCourseCodes } from "../src/core/normalize.js";
import { courseLabel, displayCourseLabel } from "../src/core/names.js";
import { renameCourse } from "../src/core/overrides.js";

describe("extractCourseCodes", () => {
  it("reads a human-readable name", () => {
    expect(extractCourseCodes("Fall 2026-CS 357-Numerical Methods I")).toEqual(["CS357"]);
    expect(extractCourseCodes("PHYS435")).toEqual(["PHYS435"]);
  });

  it("reads every code in a cross-listing", () => {
    expect(extractCourseCodes("CS446/ECE449")).toEqual(["CS446", "ECE449"]);
    expect(extractCourseCodes("CS425 ECE428 Fall 2026")).toEqual(["CS425", "ECE428"]);
  });

  it("reads an underscore slug, which is a course name on two sources", () => {
    // AMENDED 2026-09-12. Canvas's `course_code` and Gradescope's shortname are
    // both slugs of this shape. Canvas has a human `name` to fall back on and
    // was amended to read it; Gradescope has none, so declining the slug put it
    // on screen verbatim.
    expect(extractCourseCodes("stat_425_120248_268442")).toEqual(["STAT425"]);
    expect(extractCourseCodes("ece_408_120261_257494")).toEqual(["ECE408"]);
    expect(extractCourseCodes("cs_357_120268_263847")).toEqual(["CS357"]);
  });

  it("reads a slug that carries a term prefix", () => {
    /*
     * **Deliberately not taken from a fixture** — no capture in this repo has a
     * prefixed slug, and that absence is exactly why a `\b` at the head of the
     * pattern survived its mutation. `\b` finds nothing here: the boundary it
     * needs is between `6` and `_`, and both are word characters, so `stat` is
     * never even tried. Only an explicit lookbehind reaches it.
     *
     * Parser rule 10, in the form house rule 12 describes: where a realistic
     * value cannot tell a right implementation from a wrong one, make one that
     * can and say in the test that it is invented.
     */
    expect(extractCourseCodes("fa26_stat_425_120248")).toEqual(["STAT425"]);
  });

  it("declines a slug with no course code in it", () => {
    // The FA25 admin course from canvas-findings.md, which exercises §5.1's
    // "no match, fall back to courseRaw" path. It must keep doing so.
    expect(extractCourseCodes("bus_ilbc_open_249233")).toEqual([]);
    expect(extractCourseCodes("FA25 IBC NDA and Code of Conduct Forms")).toEqual([]);
  });

  it("declines a number that is not three digits", () => {
    // A four-digit run is an id, not a course. `CS 3570` must not become CS357,
    // which is a different course that exists.
    expect(extractCourseCodes("CS 3570")).toEqual([]);
    expect(extractCourseCodes("120248_268442")).toEqual([]);
  });

  it("declines an assignment title that merely contains a number", () => {
    expect(extractCourseCodes("homework 2 (UG)")).toEqual([]);
    expect(extractCourseCodes("WA2 Order of Evaluation in Ocaml")).toEqual([]);
  });

  it("returns each code once", () => {
    expect(extractCourseCodes("CS 357 — CS357 — cs_357_1")).toEqual(["CS357"]);
  });
});

describe("displayCourseLabel (the space §5.1 drops)", () => {
  it("puts the space back into a bare code", () => {
    // §5.1 joins its two captures directly, so every recognised code arrived on
    // screen as `CS421` while an unrecognised name kept whatever spacing its
    // source used. Both sat in the same row of filter chips.
    expect(displayCourseLabel("CS421")).toBe("CS 421");
    expect(displayCourseLabel("STAT425")).toBe("STAT 425");
    expect(displayCourseLabel("CS357A")).toBe("CS 357A");
  });

  it("leaves a name it cannot read exactly as it found it", () => {
    // `CS 498DK2` is the case that started this: the regex declines the `DK2`
    // suffix, so the raw name falls through — and it already has its space.
    // There is no rule that improves arbitrary text and several that damage it.
    for (const raw of ["CS 498DK2", "Physics 435 Spring 2026", "stat_425_1", ""]) {
      expect(displayCourseLabel(raw), raw).toBe(raw);
    }
  });

  it("is display only, so it never becomes a key", () => {
    // The stored label groups rows, colours them and drives the filters.
    // Reformatting it would split every course in the store from its own
    // history until the next sync, so this runs on the way to the screen.
    expect(displayCourseLabel("CS 421")).toBe("CS 421");
  });
});

describe("courseLabel (a name the student gave it, or the one we derived)", () => {
  it("prefers the student's name", () => {
    expect(courseLabel("CS498DK2X", { CS498DK2X: "Deep Learning" })).toBe("Deep Learning");
  });

  it("falls back to the derived label, spaced", () => {
    expect(courseLabel("CS421", {})).toBe("CS 421");
    expect(courseLabel("CS 498DK2")).toBe("CS 498DK2");
  });

  it("treats a blank or whitespace name as no name", () => {
    /*
     * `migrateOverrides` refuses to store one, and this refuses to trust it
     * anyway: the store is data written by a previous build, and the build that
     * wrote it may not have had that rule (worker rule 8).
     *
     * The failure it prevents is bad in a specific way — a blank label is
     * invisible, so the course vanishes from the filter strip and its rows lose
     * their chip, and there is nothing left on screen to click to undo it.
     */
    for (const blank of ["", "   ", "\t"]) {
      expect(courseLabel("CS421", { CS421: blank }), JSON.stringify(blank)).toBe("CS 421");
    }
  });

  it("trims, so a stray space does not become the name", () => {
    expect(courseLabel("CS421", { CS421: "  Systems  " })).toBe("Systems");
  });

  it("ignores a name given to a different course", () => {
    expect(courseLabel("CS421", { CS425: "Distributed" })).toBe("CS 421");
  });
});

describe("renameCourse", () => {
  const base = {
    mergeGroups: [], splitKeys: [], hiddenKeys: [], disabledCourses: [],
    doneKeys: [], keptCourses: [], courseNames: {}, dueOverrides: {},
  };

  it("stores a name", () => {
    expect(renameCourse(base, "CS421", "Programming Languages").courseNames).toEqual({
      CS421: "Programming Languages",
    });
  });

  it("clearing the box removes the override rather than storing empty", () => {
    // This is how a student gets the derived label back, so it must delete.
    // Storing "" would blank the course everywhere at once and leave nothing on
    // screen to click in order to undo it.
    const named = renameCourse(base, "CS421", "PL");
    expect(renameCourse(named, "CS421", "").courseNames).toEqual({});
    expect(renameCourse(named, "CS421", "   ").courseNames).toEqual({});
  });

  it("caps the length, because a name is not an essay", () => {
    const long = renameCourse(base, "CS421", "x".repeat(200));
    expect(long.courseNames["CS421"]).toHaveLength(60);
  });

  it("leaves every other override alone", () => {
    const next = renameCourse({ ...base, hiddenKeys: ["gradescope:1"] }, "CS421", "PL");
    expect(next.hiddenKeys).toEqual(["gradescope:1"]);
  });
});

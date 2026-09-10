/**
 * Gradescope parser tests (§4.2), against real captured fixtures.
 * Evidence for the expected values is in docs/gradescope-findings.md.
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { parseGradescopeDateTime, shortHash } from "../src/core/dates.js";
import {
  GRADESCOPE_ORIGIN,
  currentTermCourses,
  isLoginResponse,
  mapStatus,
  parseCoursePage,
  parseDashboard,
} from "../src/sources/gradescope.js";
import { ParseError, type PageCtx } from "../src/sources/types.js";

function docOf(name: string): Document {
  const html = readFileSync(new URL(`../fixtures/gradescope/${name}`, import.meta.url), "utf8");
  return parseHTML(html).document as unknown as Document;
}

function docFrom(html: string): Document {
  return parseHTML(html).document as unknown as Document;
}

const coursePage: PageCtx = {
  url: `${GRADESCOPE_ORIGIN}/courses/1352838`,
  // Capture time. The 60-day drop rule is measured from here, so it is fixed.
  fetchedAt: "2026-09-03T05:29:00.000Z",
};

describe("parseGradescopeDateTime (§3.2)", () => {
  it("converts the non-ISO datetime attribute to ISO with an offset", () => {
    expect(parseGradescopeDateTime("2026-09-02 17:00:00 -0500")).toBe("2026-09-02T17:00:00-05:00");
    // CST side of the DST flip.
    expect(parseGradescopeDateTime("2026-12-09 23:59:59 -0600")).toBe("2026-12-09T23:59:59-06:00");
  });

  it("throws rather than guessing at an unexpected shape", () => {
    // The whole point of §3.2's rule: do not hand these to new Date().
    for (const bad of ["2026-09-02T17:00:00Z", "Sep 02 at 5:00PM", "", "2026-09-02 17:00:00"]) {
      expect(() => parseGradescopeDateTime(bad), bad).toThrow(ParseError);
    }
  });
});

describe("parseDashboard (real capture)", () => {
  const groups = parseDashboard(docOf("dashboard.html"));

  it("groups by term in DOM order with the current term first (§4.2)", () => {
    expect(groups.map((g) => g.term)).toEqual([
      "Fall 2026",
      "Spring 2026",
      "Fall 2025",
      "Spring 2025",
      "Fall 2024",
    ]);
  });

  it("returns only the current term's courses", () => {
    const courses = currentTermCourses(docOf("dashboard.html"));
    expect(courses.map((c) => c.id)).toEqual(["1353501", "1352838"]);
    expect(courses.map((c) => c.shortName)).toEqual(["CS425 ECE428 Fall 2026", "PHYS435"]);
  });

  it("does not invent a course from the 'add a course' button", () => {
    // <button class="courseBox courseBox-new js-enrollInCourse"> shares the class
    // and has no href. This pins the outcome, not the mechanism: the module
    // rejects it twice over (selector, then the id check), so loosening the
    // selector alone does not change the result.
    const all = groups.flatMap((g) => g.courses);
    expect(all).toHaveLength(15);
    expect(all.every((c) => /^\d+$/.test(c.id))).toBe(true);
    expect(all.every((c) => c.url.startsWith(`${GRADESCOPE_ORIGIN}/courses/`))).toBe(true);
  });

  it("reads the assignment count so empty courses need not be fetched", () => {
    const courses = currentTermCourses(docOf("dashboard.html"));
    expect(courses.find((c) => c.id === "1353501")!.assignmentCount).toBe(0);
    expect(courses.find((c) => c.id === "1352838")!.assignmentCount).toBe(2);
  });

  it("extracts course codes from shortnames, including cross-listings", () => {
    const all = groups.flatMap((g) => g.courses);
    expect(all.find((c) => c.id === "1353501")!.altCodes).toEqual(["CS425", "ECE428"]);
    expect(all.find((c) => c.id === "1231561")!.altCodes).toEqual(["CS446", "ECE449"]);
    // An opaque slug shortname, same pattern Canvas uses; §5.1 must decline it.
    expect(all.find((c) => c.id === "1273605")!.courseCode).toBeUndefined();
  });

  it("throws when the term headings are missing (§0 rule 3)", () => {
    expect(() => parseDashboard(docFrom("<div>nothing here</div>"))).toThrow(ParseError);
  });
});

describe("parseCoursePage (real capture)", () => {
  const items = parseCoursePage(docOf("course-1352838.html"), coursePage);

  it("finds both assignments and nothing else on the page", () => {
    // The page also holds a thead row and an unrelated dropzonePreview table.
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.title)).toEqual(["Homework 1", "Homework 2"]);
  });

  it("reads the assignment id from a link when the row has been submitted", () => {
    const hw1 = items[0]!;
    // href is /assignments/8398957/submissions/000000000 — the regex must not
    // be anchored to the end of the string.
    expect(hw1.sourceId).toBe("8398957");
    expect(hw1.url).toBe(`${GRADESCOPE_ORIGIN}/courses/1352838/assignments/8398957`);
    expect(hw1.extra?.["idFallback"]).toBeUndefined();
  });

  it("reads it from data-assignment-id when the row is an unsubmitted button", () => {
    // The same assignment switches from <button> to <a> when submitted; taking
    // only one form would change the memberKey at submit time (§3.1 amended).
    const hw2 = items[1]!;
    expect(hw2.sourceId).toBe("8398958");
    expect(hw2.url).toBe(`${GRADESCOPE_ORIGIN}/courses/1352838/assignments/8398958`);
    expect(hw2.extra?.["idFallback"]).toBeUndefined();
  });

  it("separates due from late due by aria-label, not by class", () => {
    // Both <time>s carry class submissionTimeChart--dueDate.
    expect(items[0]!.dueAt).toBe("2026-09-02T17:00:00-05:00");
    expect(items[0]!.lateDueAt).toBe("2026-09-09T17:00:00-05:00");
    expect(items[1]!.dueAt).toBe("2026-09-09T17:00:00-05:00");
    expect(items[1]!.lateDueAt).toBe("2026-09-16T17:00:00-05:00");
  });

  it("does not take the date from the hidden column, which is state-dependent", () => {
    // Homework 1's hidden "Due Date" cell holds 2026-09-09 — its *late* date,
    // because its due date had already passed at capture time. A parser reading
    // that column would report the wrong deadline for every past-due row.
    expect(items[0]!.dueAt).not.toBe("2026-09-09T17:00:00-05:00");
  });

  it("maps status from the text, ignoring the colour modifier classes", () => {
    expect(items[0]!.status).toBe("submitted"); // submissionStatus-complete
    expect(items[1]!.status).toBe("not_submitted"); // submissionStatus-warning
  });

  it("carries course identity, term and release date", () => {
    expect(items[0]!.courseRaw).toBe("PHYS435");
    expect(items[0]!.courseCode).toBe("PHYS435");
    expect(items[0]!.extra?.["term"]).toBe("Fall 2026");
    expect(items[0]!.extra?.["releasedAt"]).toBe("2026-08-24T07:59:00-05:00");
    expect(items[0]!.extra?.["lateStatus"]).toBe("Accepting late submissions");
    expect(items.every((i) => i.source === "gradescope" && i.kind === "assignment")).toBe(true);
    expect(items.every((i) => i.fetchedAt === coursePage.fetchedAt)).toBe(true);
  });
});

describe("parseCoursePage — structural rules (§0 rule 3)", () => {
  const bare = { url: `${GRADESCOPE_ORIGIN}/courses/999`, fetchedAt: "2026-09-03T05:00:00.000Z" };

  it("throws when the assignments table is gone", () => {
    expect(() =>
      parseCoursePage(docFrom(`<h1 class="courseHeader--title">X</h1><p>Assignments</p>`), bare),
    ).toThrow(/no assignments table/);
  });

  it("throws when only the unrelated dropzone table is present", () => {
    // A redesign that renamed the assignments table must not read as "empty
    // course" just because some other table survived on the page.
    expect(() =>
      parseCoursePage(
        docFrom(`<h1 class="courseHeader--title">X</h1><table class="dropzonePreview"></table>`),
        bare,
      ),
    ).toThrow(/no assignments table/);
  });

  it("accepts the assignments table with no rows as a legitimately empty course", () => {
    const doc = docFrom(
      `<h1 class="courseHeader--title">X</h1><table id="assignments-student-table">` +
        `<thead><tr><th>Name</th></tr></thead><tbody></tbody></table>`,
    );
    expect(parseCoursePage(doc, bare)).toEqual([]);
  });

  it("identifies the table by its caption when the id is absent", () => {
    const doc = docFrom(
      `<h1 class="courseHeader--title">X</h1><table><caption>Assignments List</caption>` +
        `<tbody></tbody></table>`,
    );
    expect(parseCoursePage(doc, bare)).toEqual([]);
  });

  it("drops rows more than 60 days past due", () => {
    const row = (title: string, due: string) =>
      `<tr><th class="table--primaryLink"><a href="/courses/999/assignments/${title.length}1">${title}</a></th>` +
      `<td class="submissionStatus"><div class="submissionStatus--text">Submitted</div></td>` +
      `<td><time class="submissionTimeChart--dueDate" aria-label="Due at x" datetime="${due}"></time></td></tr>`;
    const doc = docFrom(
      `<h1 class="courseHeader--title">X</h1><table id="assignments-student-table">${row("Old", "2026-05-01 17:00:00 -0500")}` +
        `${row("Recent", "2026-09-01 17:00:00 -0500")}</table>`,
    );
    expect(parseCoursePage(doc, bare).map((i) => i.title)).toEqual(["Recent"]);
  });

  it("throws on two rows that would share one key", () => {
    const row = `<tr><th class="table--primaryLink"><a href="/courses/999/assignments/5">A</a></th>` +
      `<td class="submissionStatus"><div class="submissionStatus--text">Submitted</div></td></tr>`;
    const doc = docFrom(`<h1 class="courseHeader--title">X</h1><table id="assignments-student-table">${row}${row}</table>`);
    expect(() => parseCoursePage(doc, bare)).toThrow(/duplicate assignment key/);
  });

  it("falls back to a hashed id only when the row carries neither form", () => {
    const doc = docFrom(
      `<h1 class="courseHeader--title">X</h1><table id="assignments-student-table"><tr>` +
        `<th class="table--primaryLink">Attendance</th>` +
        `<td class="submissionStatus"><div class="submissionStatus--text">Submitted</div></td>` +
        `</tr></table>`,
    );
    const [item] = parseCoursePage(doc, bare);
    expect(item!.sourceId).toBe(`999:${shortHash("attendance")}`);
    expect(item!.extra?.["idFallback"]).toBe("hashed");
  });
});

describe("regressions found by the adversarial review", () => {
  const bare = { url: `${GRADESCOPE_ORIGIN}/courses/999`, fetchedAt: "2026-09-03T05:00:00.000Z" };
  const wrap = (rows: string) =>
    docFrom(`<h1 class="courseHeader--title">X</h1><table id="assignments-student-table">${rows}</table>`);

  it("throws when the table has rows but none match the row selector", () => {
    // A renamed row class produces the identical outcome to a renamed table: a
    // page full of visible deadlines parsed to []. Guarding only the table
    // element missed this.
    const doc = wrap(
      `<tr><th class="table--renamedLink"><a href="/courses/999/assignments/5">HW1</a></th>` +
        `<td><time class="submissionTimeChart--dueDate" aria-label="Due at x" ` +
        `datetime="2026-09-09 17:00:00 -0500"></time></td></tr>`,
    );
    expect(() => parseCoursePage(doc, bare)).toThrow(/none match th.table--primaryLink/);
  });

  it("throws when the dashboard has term headings but no courses", () => {
    const doc = docFrom(
      `<div class="courseList"><div class="courseList--term">Fall 2026</div>` +
        `<div class="courseList--coursesForTerm">` +
        `<a class="courseBoxRenamed" href="/courses/1">X</a></div></div>`,
    );
    expect(() => parseDashboard(doc)).toThrow(/no course links/);
  });

  it("tolerates a legitimately empty current term when another term has courses", () => {
    // The enrol button lives in the first term's container, so the guard must be
    // on the total, not per group.
    const doc = docFrom(
      `<div class="courseList">` +
        `<div class="courseList--term">Fall 2026</div><div class="courseList--coursesForTerm">` +
        `<button class="courseBox courseBox-new"></button></div>` +
        `<div class="courseList--term">Spring 2026</div><div class="courseList--coursesForTerm">` +
        `<a class="courseBox" href="/courses/7"><h3 class="courseBox--shortname">CS 225</h3></a>` +
        `</div></div>`,
    );
    const groups = parseDashboard(doc);
    expect(groups[0]!.courses).toEqual([]);
    expect(groups[1]!.courses).toHaveLength(1);
    expect(currentTermCourses(doc)).toEqual([]);
  });

  it("does not report a late-only row's late date as its due date", () => {
    // The old `due ?? times[0]` fallback re-admitted the late element here and
    // reported a deadline a week late.
    const doc = wrap(
      `<tr><th class="table--primaryLink"><a href="/courses/999/assignments/5">HW1</a></th>` +
        `<td><time class="submissionTimeChart--dueDate" aria-label="Late Due Date at September 16" ` +
        `datetime="2026-09-16 17:00:00 -0500"></time></td></tr>`,
    );
    const [item] = parseCoursePage(doc, bare);
    expect(item!.dueAt).toBeUndefined();
    expect(item!.lateDueAt).toBe("2026-09-16T17:00:00-05:00");
  });

  it("uses the aria-label, not DOM order, when late precedes due", () => {
    // Both real rows emit due first, so DOM order and the label agree there and
    // the discriminator could regress unnoticed.
    const doc = wrap(
      `<tr><th class="table--primaryLink"><a href="/courses/999/assignments/5">HW1</a></th><td>` +
        `<time class="submissionTimeChart--dueDate" aria-label="Late Due Date at September 16" ` +
        `datetime="2026-09-16 17:00:00 -0500"></time>` +
        `<time class="submissionTimeChart--dueDate" aria-label="Due at September 09" ` +
        `datetime="2026-09-09 17:00:00 -0500"></time>` +
        `</td></tr>`,
    );
    const [item] = parseCoursePage(doc, bare);
    expect(item!.dueAt).toBe("2026-09-09T17:00:00-05:00");
    expect(item!.lateDueAt).toBe("2026-09-16T17:00:00-05:00");
  });

  it("falls back to class-independent <time> matching (§4.2's cheap insurance)", () => {
    const doc = wrap(
      `<tr><th class="table--primaryLink"><a href="/courses/999/assignments/5">HW1</a></th><td>` +
        `<time class="renamed--dueDate" aria-label="Due at September 09" ` +
        `datetime="2026-09-09 17:00:00 -0500"></time>` +
        `<time class="renamed--dueDate" aria-label="Late Due Date at September 16" ` +
        `datetime="2026-09-16 17:00:00 -0500"></time></td></tr>`,
    );
    const [item] = parseCoursePage(doc, bare);
    expect(item!.dueAt).toBe("2026-09-09T17:00:00-05:00");
    expect(item!.lateDueAt).toBe("2026-09-16T17:00:00-05:00");
  });

  it("keeps a dateless row rather than throwing", () => {
    const doc = wrap(
      `<tr><th class="table--primaryLink"><a href="/courses/999/assignments/5">Attendance</a></th></tr>`,
    );
    const [item] = parseCoursePage(doc, bare);
    expect(item!.dueAt).toBeUndefined();
    expect(item!.extra?.["unparsedDueDate"]).toBeUndefined();
  });

  it("lets one bad datetime cost its own field, not the page", () => {
    // A bad *release* date used to throw away every assignment in the course,
    // for a field §4.2 says is not even shown in v1.
    const doc = wrap(
      `<tr><th class="table--primaryLink"><a href="/courses/999/assignments/5">HW1</a></th><td>` +
        `<time class="submissionTimeChart--releaseDate" aria-label="Released at x" ` +
        `datetime="August 24, 2026 7:59 AM"></time>` +
        `<time class="submissionTimeChart--dueDate" aria-label="Due at September 09" ` +
        `datetime="2026-09-09 17:00:00 -0500"></time></td></tr>` +
        `<tr><th class="table--primaryLink"><a href="/courses/999/assignments/6">HW2</a></th></tr>`,
    );
    const items = parseCoursePage(doc, bare);
    expect(items).toHaveLength(2);
    expect(items[0]!.dueAt).toBe("2026-09-09T17:00:00-05:00");
    expect(items[0]!.extra?.["releasedAt"]).toBeUndefined();
    expect(items[0]!.extra?.["unparsedReleaseDate"]).toBe("August 24, 2026 7:59 AM");
  });

  it("records an unparseable or blank due date instead of dropping it silently", () => {
    for (const [raw, expected] of [["not a date", "not a date"], ["   ", "   "], ["", ""]]) {
      const doc = wrap(
        `<tr><th class="table--primaryLink"><a href="/courses/999/assignments/5">HW1</a></th><td>` +
          `<time class="submissionTimeChart--dueDate" aria-label="Due at x" datetime="${raw}"></time>` +
          `</td></tr>`,
      );
      const [item] = parseCoursePage(doc, bare);
      expect(item!.dueAt, raw).toBeUndefined();
      expect(item!.extra?.["unparsedDueDate"], raw).toBe(expected);
    }
  });

  it("throws on a non-numeric data-assignment-id rather than absorbing it", () => {
    // It becomes both the memberKey and a URL path segment; "../../../login"
    // builds a URL that still passes §8.1's scheme-and-host gate.
    const doc = wrap(
      `<tr><th class="table--primaryLink">` +
        `<button data-assignment-id="../../../login">HW1</button></th></tr>`,
    );
    expect(() => parseCoursePage(doc, bare)).toThrow(/not numeric/);
  });

  it("records an unrecognised status wording instead of guessing at it", () => {
    const doc = wrap(
      `<tr><th class="table--primaryLink"><a href="/courses/999/assignments/5">HW1</a></th>` +
        `<td class="submissionStatus"><div class="submissionStatus--text">Awaiting regrade</div></td></tr>`,
    );
    const [item] = parseCoursePage(doc, bare);
    expect(item!.status).toBe("unknown");
    expect(item!.extra?.["unknownStatus"]).toBe("Awaiting regrade");
  });
});

describe("mapStatus (§4.2)", () => {
  it("maps the observed and specified values", () => {
    expect(mapStatus("No Submission")).toBe("not_submitted");
    expect(mapStatus("Submitted")).toBe("submitted");
    expect(mapStatus("Graded")).toBe("graded");
    expect(mapStatus("18 / 20")).toBe("graded");
    expect(mapStatus("95%")).toBe("graded");
    expect(mapStatus("Something new")).toBe("unknown");
    expect(mapStatus("")).toBe("unknown");
  });

  it("does not file a negated status into the most-done bucket", () => {
    // Substring matching made "not submitted" contain "submitted" and every
    // "not graded" wording contain "graded" — the fail-silent direction.
    expect(mapStatus("Not Submitted")).toBe("not_submitted");
    expect(mapStatus("Unsubmitted")).toBe("unknown");
    expect(mapStatus("Not submitted yet")).toBe("unknown");
    expect(mapStatus("Ungraded")).toBe("unknown");
    expect(mapStatus("Not Graded")).toBe("unknown");
    expect(mapStatus("Not yet graded")).toBe("unknown");
  });
});

describe("isLoginResponse", () => {
  it("recognises an expired Gradescope session", () => {
    expect(isLoginResponse(200, `${GRADESCOPE_ORIGIN}/login`, "")).toBe(true);
    expect(isLoginResponse(401, `${GRADESCOPE_ORIGIN}/`, "")).toBe(true);
    expect(isLoginResponse(200, "https://shibboleth.illinois.edu/idp", "")).toBe(true);
  });

  it("does not mistake the real dashboard for a login page", () => {
    const html = readFileSync(
      new URL("../fixtures/gradescope/dashboard.html", import.meta.url),
      "utf8",
    );
    expect(isLoginResponse(200, `${GRADESCOPE_ORIGIN}/`, html)).toBe(false);
  });
});

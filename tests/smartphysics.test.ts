/**
 * smartPhysics parser, run against `fixtures/smartphysics/` — two real captures
 * from 2026-09-10.
 *
 * The course capture is a Fall 2025 PHYS 214, because the account that took it
 * has no current enrolment. That costs nothing the parser cares about: 29 real
 * assignments, real 8:00 AM deadlines, and the same markup a current course
 * serves. What it does mean is that nothing here has been checked against a
 * *live* term — see fixtures/smartphysics/README.md.
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import {
  SMARTPHYSICS_ORIGIN,
  courseUrl,
  isLoginResponse,
  parseAssignments,
  parseCourseList,
  parseDueText,
} from "../src/sources/smartphysics.js";
import { ParseError, type PageCtx } from "../src/sources/types.js";

function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/smartphysics/${name}`, import.meta.url), "utf8");
}
function docOf(name: string): Document {
  return parseHTML(fixture(name)).document as unknown as Document;
}
function docFrom(html: string): Document {
  return parseHTML(html).document as unknown as Document;
}

const page: PageCtx = {
  url: "https://smart.physics.illinois.edu/Course?enrollmentID=100001",
  fetchedAt: "2026-09-10T18:00:00.000Z",
};

describe("parseCourseList — the enrolment list", () => {
  const courses = parseCourseList(docOf("home.html"));

  it("finds every enrolment, once each", () => {
    // The action cell repeats the same link, so a naive pass double-counts.
    expect(courses).toHaveLength(2);
    expect(courses.map((c) => c.enrollmentId).sort()).toEqual(["100001", "100002"]);
  });

  it("ignores the nav and role links that share a course's URL", () => {
    // The real page has three links per course pointing at the same URL: the
    // nav "Home" link, the course title, and the row's role cell. A page-wide
    // query picks "Home" first and names the course after it.
    expect(courses.map((c) => c.name).sort()).toEqual([
      "Physics 213 Fall 2025",
      "Physics 214 Fall 2025",
    ]);
  });

  it("extracts the course code the popup will group on", () => {
    expect(courses.map((c) => c.courseCode).sort()).toEqual(["PHYS213", "PHYS214"]);
  });

  it("marks a course under Inactive as inactive", () => {
    // Both of this account's enrolments are Fall 2025 and listed as inactive,
    // which is what makes the source report "not used" rather than empty.
    expect(courses.every((c) => !c.active)).toBe(true);
  });

  it("does not classify courses backwards on a substring", () => {
    // "Inactive Courses" contains "active Courses". House rule 6: a substring
    // test on the wrong heading flips every course's state.
    const doc = docFrom(`
      <button id="CurrentEnrollments-tab">Active Courses</button>
      <button id="PastEnrollments-tab">Inactive Courses</button>
      <div id="CurrentEnrollments"><table><tr><td>
        <div class="course-title"><a href="/Course?enrollmentID=1">Physics 211 Fall 2026</a></div>
      </td></tr></table></div>
      <div id="PastEnrollments"><table><tr><td>
        <div class="course-title"><a href="/Course?enrollmentID=2">Physics 212 Fall 2025</a></div>
      </td></tr></table></div>
    `);
    const parsed = parseCourseList(doc);
    expect(parsed.find((c) => c.enrollmentId === "1")!.active).toBe(true);
    expect(parsed.find((c) => c.enrollmentId === "2")!.active).toBe(false);
  });

  it("throws when the table is there and no row matches (§0 rule 3)", () => {
    // A redesign, not an empty account. Guarding the container alone is the
    // mistake house rule 2 names.
    expect(() => parseCourseList(docFrom("<table><tr><td>Physics 211</td></tr></table>"))).toThrow(
      ParseError,
    );
  });

  it("throws when there is no course table at all", () => {
    expect(() => parseCourseList(docFrom("<p>hello</p>"))).toThrow(ParseError);
  });
});

describe("parseDueText", () => {
  const local = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  it("reads the real string, including the 8 AM the habit misses", () => {
    expect(local(parseDueText("Due: Aug. 25, 2025 at 8:00 AM for 100% credit")!)).toBe(
      "Aug 25, 2025, 08:00",
    );
  });

  it("handles PM and a full month name", () => {
    expect(local(parseDueText("Due: September 9, 2025 at 11:59 PM")!)).toBe("Sep 09, 2025, 23:59");
  });

  it("takes the year from the page, so §3.2's inference is not needed", () => {
    // Year inference is the riskiest date code in the project. This source
    // states the year, so it never runs.
    expect(local(parseDueText("Due: Jan. 5, 2027 at 8:00 AM")!)).toBe("Jan 05, 2027, 08:00");
  });

  it("refuses a date that does not exist rather than inventing one", () => {
    // `Sep 31` and `25:00` are shapes a hand-edited page really produces, and
    // formatting them verbatim yields an instant that is silently wrong.
    expect(() => parseDueText("Due: Sep. 31, 2025 at 8:00 AM")).toThrow(ParseError);
    expect(() => parseDueText("Due: Sep. 30, 2025 at 25:00 AM")).toThrow(ParseError);
  });

  it("throws on text that is not a due date, which is what parseField expects", () => {
    // Returning undefined would read as "no deadline here" and the row would
    // vanish; throwing lets house rule 1 keep it and record the text.
    for (const junk of ["", "Due: soon", "Opens Aug. 25, 2025 at 8:00 AM", "for 80% credit"]) {
      expect(() => parseDueText(junk), junk).toThrow(ParseError);
    }
  });
});

describe("parseAssignments — the real PHYS 214 capture", () => {
  const items = parseAssignments(docOf("course.html"), page);

  it("parses every assignment row on the page", () => {
    expect(items).toHaveLength(29);
  });

  it("dates all of them", () => {
    // 29 rows, 29 due dates in the capture. A silent partial parse here is the
    // failure §0 rule 3 exists for.
    expect(items.filter((i) => i.dueAt !== undefined)).toHaveLength(29);
  });

  it("qualifies bare titles with their unit, which is what makes them readable", () => {
    // A dozen rows are titled just "Checkpoint" or "Homework". Unqualified they
    // are indistinguishable in a mixed list, and §3.1's hashed fallback key
    // would collide across every one of them.
    const first = items[0]!;
    expect(first.title).toBe("Harmonic waves — Checkpoint - Waves");
    expect(items.filter((i) => i.title === "Checkpoint")).toHaveLength(0);
    expect(items.filter((i) => i.title === "Homework")).toHaveLength(0);
  });

  it("does not repeat the unit when the title already carries it", () => {
    const dup = parseAssignments(
      docFrom(`<div class="unit"><span class="UnitTitle">Harmonic waves</span>
        <div class="unit-assignment Homework-Type" id="1">
          <div class="unit-assignment-title"><a href="/Course/ViewItem?unitItemID=1">Harmonic waves homework</a></div>
          <div class="duedate">Due: Sep. 9, 2025 at 8:00 AM</div>
        </div></div>`),
      page,
    );
    expect(dup[0]!.title).toBe("Harmonic waves homework");
  });

  it("gives every row a distinct key", () => {
    // §3.1: the row's own id survives re-scrapes and, unlike the URL, does not
    // carry the student's enrolment id.
    expect(new Set(items.map((i) => i.sourceId)).size).toBe(items.length);
  });

  it("keeps the URL on the source origin and absolute (house rule 7)", () => {
    for (const item of items) {
      expect(item.url.startsWith(`${SMARTPHYSICS_ORIGIN}/`), item.url).toBe(true);
    }
  });

  it("maps a checkpoint to a quiz and homework to an assignment", () => {
    expect(items.some((i) => i.kind === "quiz")).toBe(true);
    expect(items.some((i) => i.kind === "assignment")).toBe(true);
  });

  it("records the credit tier in force, like §4.3's cell", () => {
    const reduced = items.filter((i) => i.extra?.["creditRemaining"] === "80");
    expect(reduced.length).toBeGreaterThan(0);
    expect(items.some((i) => i.extra?.["creditRemaining"] === "100")).toBe(true);
  });

  it("takes the course from the page, so §5.1 can group it", () => {
    expect(items[0]!.courseCode).toBe("PHYS214");
    expect(items[0]!.courseRaw).toContain("Physics 214");
  });

  it("keeps a row whose date is unreadable, and records the text", () => {
    // House rule 1: a bad value costs its field, not the page. Item 0a.8 then
    // surfaces the row under "Couldn't read" rather than dropping it.
    const bad = parseAssignments(
      docFrom(`<div class="unit-assignment Homework-Type" id="9">
        <div class="unit-assignment-title"><a href="/Course/ViewItem?unitItemID=9">HW</a></div>
        <div class="duedate">Due: whenever</div></div>`),
      page,
    );
    expect(bad).toHaveLength(1);
    expect(bad[0]!.dueAt).toBeUndefined();
    expect(bad[0]!.extra?.["unparsedDueDate"]).toContain("whenever");
  });

  it("throws when the unit sections are there and no assignment row is (§0 rule 3)", () => {
    expect(() =>
      parseAssignments(docFrom('<div class="units-box"><div class="unit">Waves</div></div>'), page),
    ).toThrow(ParseError);
  });

  it("throws on a page that is not a course page at all", () => {
    expect(() => parseAssignments(docFrom("<p>nothing</p>"), page)).toThrow(ParseError);
  });
});

describe("isLoginResponse (§0 rule 2)", () => {
  it("calls a real signed-in page signed in", () => {
    expect(isLoginResponse(200, `${SMARTPHYSICS_ORIGIN}/`, fixture("home.html"))).toBe(false);
    expect(isLoginResponse(200, page.url, fixture("course.html"))).toBe(false);
  });

  it("calls a page with no log-out control signed out", () => {
    // The site serves its own login form rather than redirecting, so without a
    // body marker an absent session reads as a broken page — the mistake
    // Gradescope and PrairieTest both made.
    expect(isLoginResponse(200, `${SMARTPHYSICS_ORIGIN}/`, "<html><body>Sign in</body></html>")).toBe(
      true,
    );
  });

  it("catches the LAS single sign-on host, which is not Shibboleth", () => {
    expect(isLoginResponse(200, "https://lassso.las.illinois.edu/login?target=x", "")).toBe(true);
  });
});

describe("courseUrl", () => {
  it("addresses a course by its per-student enrolment id", () => {
    // The reason this is a source and not a §4.5 adapter: no fixed URL can
    // serve two students.
    expect(courseUrl("151698")).toBe(
      "https://smart.physics.illinois.edu/Course?enrollmentID=151698",
    );
  });

  it("encodes whatever it is given", () => {
    expect(courseUrl("1&x=2")).toContain("1%26x%3D2");
  });
});

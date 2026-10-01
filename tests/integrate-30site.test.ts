/**
 * What merging the three 30-site lanes needed on top of each (2026-10-01).
 *
 * Each lane's own tests pass on its own branch; these are the four places the
 * pages showed something only the merged build gets wrong or right.
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import {
  adapterFromCandidate,
  isExamsOnly,
  proposeCandidates,
  type Candidate,
} from "../src/core/detect.js";
import { repeatedStructures } from "../src/core/skeleton.js";
import { requiredVersionFor, validateAdapter } from "../src/core/registry.js";
import { dateRole, runAdapter } from "../src/sources/site.js";
import type { Adapter } from "../src/sources/types.js";

const REFERENCE = "2026-10-01T15:00:00.000Z";
const ZONE = "America/Chicago";

const load = (name: string) =>
  parseHTML(readFileSync(new URL(`../fixtures/sites/${name}`, import.meta.url), "utf8"))
    .document as unknown as Document;

function propose(name: string): { doc: Document; found: Candidate[] } {
  const doc = load(name);
  return { doc, found: proposeCandidates(doc, REFERENCE, ZONE, repeatedStructures(doc, ZONE, REFERENCE)) };
}

function items(candidate: Candidate, doc: Document, url: string) {
  const adapter = validateAdapter(adapterFromCandidate(candidate, url, "X101", "fa26")).adapter as Adapter;
  return runAdapter(adapter, doc, { url, fetchedAt: REFERENCE }).map((item) => [
    item.title,
    item.kind,
    item.dueAt ?? null,
  ]);
}

describe("dateRole: what a label or header says its date is", () => {
  it("ranks a deadline above an event, and an event above the day it opens", () => {
    expect(dateRole("Submission due date")).toBe(2);
    expect(dateRole("CBTF quizzes during the period")).toBe(1);
    expect(dateRole("CBTF registration starts")).toBe(0);
    expect(dateRole("Release Date-Time")).toBe(0);
    // A label that names registration alone, without "starts" beside it.
    expect(dateRole("CBTF registration")).toBe(0);
  });
});

describe("CS 357's quiz cards", () => {
  const URL = "https://cs357.cs.illinois.edu/pages/quizzes.html";
  const { doc, found } = propose("cs357-fa2026-quizzes.html");

  it("reads the quiz window, not the day registration opens", () => {
    // Both labels date all seven cards; the first on the page —
    // `CBTF registration starts` — used to win the tie, and every quiz landed
    // on its booking day, as much as twelve days early.
    expect(found[0]!.dueLabel).toBe("CBTF quizzes during the period");
  });

  it("names each quiz from its own card's heading, and files it as a quiz", () => {
    // The section's first heading is "Quizzes"; each card has its own <h4>.
    const read = items(found[0]!, doc, URL);
    expect(read.slice(0, 2)).toEqual([
      ["Quiz 1: Linear Algebra + Python + Errors CBTF quizzes during the period", "quiz", "2026-09-08T23:59:00-05:00"],
      ["Quiz 2: Floating Point, Rounding, Taylor Series CBTF quizzes during the period", "quiz", "2026-09-21T23:59:00-05:00"],
    ]);
    expect(read.filter(([, kind]) => kind === "quiz")).toHaveLength(6);
  });
});

describe("ECE 220's schedule: a quiz row's own window beats the lecture column", () => {
  const URL = "https://courses.grainger.illinois.edu/ece220/fa2026/schedule/course_schedule/";
  const { doc, found } = propose("ece220-fa2026-schedule.html");

  it("offers no exams reading that dates quizzes by their lecture", () => {
    // `09-08 | … | Quiz due 09/07 - 09/10`: the exams reading skips the
    // deadline check (CS 425's midterm is on its lecture date), so before this
    // it put all seven quiz windows a day late.
    expect(found.some(isExamsOnly)).toBe(false);
  });

  it("reads each quiz at the start of the window its row states", () => {
    const read = items(found[0]!, doc, URL);
    expect(read[0]).toEqual(["Quiz due 09/07 - 09/10", "quiz", "2026-09-07T23:59:00-05:00"]);
    expect(read).toHaveLength(7);
  });
});

describe("PHYS 486: a homework cell spanning into a midterm's row is not the midterm's word", () => {
  it("keeps both midterms on their own dates", () => {
    // `10/8 | … | MIDTERM 1`, with the Homework cell of the row above spanning
    // down into it and saying "due 10/7". Counting that cell as the midterm's
    // own statement lost both midterms (the 2026-10-01 before/after sweep).
    const { found } = propose("phys486-fa2026-schedule.html");
    const exams = found.filter(isExamsOnly);
    expect(exams.map((c) => c.sample.map((row) => [row.title, row.due]))).toEqual([
      [
        ["MIDTERM 1", "2026-10-08T23:59:00-05:00"],
        ["MIDTERM 2", "2026-11-05T23:59:00-06:00"],
      ],
    ]);
  });
});

describe("CS 425's lectures: the midterm on its lecture's date still stands", () => {
  it("keeps the exams reading where the sitting row states no date of its own", () => {
    const { found } = propose("cs425-fa2026-lectures.html");
    const exams = found.filter(isExamsOnly);
    expect(exams.map((c) => c.sample.map((row) => [row.title, row.due]))).toEqual([
      [["IN-CLASS MIDTERM EXAM", "2026-10-08T23:59:00-05:00"]],
    ]);
  });
});

describe("a page's deadlines rank before its exams-only reading", () => {
  it("puts TAM 212's homework first though its quiz rows outnumber it", () => {
    // 36 quiz rows (each window once per lecture day) against 13 homeworks:
    // by count alone the exams reading came first.
    const { found } = propose("tam212-fa2026-schedule.html");
    expect(isExamsOnly(found[0]!)).toBe(false);
    expect(found[0]!.columns?.title).toBe("assignment due dates");
    const exams = found.find(isExamsOnly)!;
    expect(exams.dated).toBeGreaterThan(found[0]!.dated);
  });
});

describe("a list under its section's own heading stays section-scoped", () => {
  it("keeps ECE 411's syllabus titled by `section >> h3`", () => {
    // The nearer-heading rule is for headings inside a block of the rows' own
    // (CS 357's cards). A heading that is a direct child of the section is the
    // section's, and the scoped spelling is the one that survives the section
    // being moved.
    const { found } = propose("ece411-fa2026-assignments.html");
    expect(found.some((c) => c.titleFrom === "section >> h3")).toBe(true);
  });
});

describe("the version an entry using a new date format demands", () => {
  it("is 1.3.4 for MM-dd and d MMM, so an older build says to update", () => {
    expect(requiredVersionFor({ dateFormat: "MM-dd" })).toBe("1.3.4");
    expect(requiredVersionFor({ dateFormat: "d MMM" })).toBe("1.3.4");
    expect(requiredVersionFor({ dateFormat: "M/d" })).toBe("0.1.0");
    // A newer format with an older field still demands the newer build.
    expect(requiredVersionFor({ dateFormat: "MM-dd", duePrev: "dt" })).toBe("1.3.4");
  });

  it("is refused by 1.3.3 with that reason, not as a malformed entry", () => {
    const entry = {
      id: "x-fa26",
      label: "X",
      courseCode: "X101",
      term: "fa26",
      url: "https://courses.grainger.illinois.edu/x/fa2026/",
      hostPattern: "https://courses.grainger.illinois.edu/*",
      rows: "tr",
      title: "td",
      due: "td",
      dateFormat: "MM-dd",
      timezone: "America/Chicago",
      minExtensionVersion: "1.3.4",
    };
    expect(validateAdapter(entry, "1.3.3").reason).toContain("needs extension 1.3.4");
    expect(validateAdapter(entry, "1.3.4").adapter).toBeDefined();
  });
});

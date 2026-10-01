/**
 * The exam entries: one per course whose site states its exam dates.
 *
 * Until 2026-10-01 only ECE 411 had one, so every other course's midterms
 * never reached the Exams tab — the dates were on pages the registry already
 * fetched, or one page over, and nothing read them. Each entry is read out of
 * `adapters/registry.json` and run over the real capture, and each assertion
 * is the exact list the page holds.
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import {
  clockFromText,
  labelSuffix,
  parseAdapterDateParts,
  runAdapter,
  SITTING_EXCLUDE,
  SITTING_INCLUDE,
  sittingKind,
} from "../src/sources/site.js";
import { validateAdapter, validateRegistry } from "../src/core/registry.js";
import {
  adapterFromCandidate,
  candidateNotes,
  candidatesFoundLine,
  isExamsOnly,
  MAX_SHOWN,
  proposeCandidates,
  shownCandidates,
  type Candidate,
} from "../src/core/detect.js";
import { repeatedStructures } from "../src/core/skeleton.js";
import type { Adapter } from "../src/sources/types.js";

const registry = readFileSync(new URL("../adapters/registry.json", import.meta.url), "utf8");
const shipped = (id: string): Adapter => {
  const found = validateRegistry(registry).adapters.find((a) => a.id === id);
  if (!found) throw new Error(`no adapter ${id} in the bundled registry`);
  return found;
};
const load = (path: string) =>
  parseHTML(readFileSync(new URL(`../fixtures/${path}`, import.meta.url), "utf8"))
    .document as unknown as Document;

const run = (id: string, fixture: string) => {
  const adapter = shipped(id);
  return runAdapter(adapter, load(fixture), {
    url: adapter.url,
    fetchedAt: "2026-09-20T12:00:00.000Z",
  });
};
const summary = (items: ReturnType<typeof run>) =>
  items.map((i) => [i.title, i.dueAt ?? null, i.extra?.["timeAssumed"] === "true"]);

describe("every exam entry lists exams", () => {
  for (const [id, fixture] of [
    ["cs424-fa26-exams", "sites/cs424-fa2026-schedule.html"],
    ["ece310-fa26-exams", "sites/ece310-fa2026-index.html"],
    ["ece391-fa26-exams", "site/ece391-schedule.html"],
    ["cs425-fa26-exams", "sites/cs425-fa2026-lectures.html"],
    ["cs374a-fa26-exams", "sites/cs374a-fa2026-calendar.html"],
    ["phys435-fa26-exams", "sites/phys435-fa2026-schedule.html"],
  ] as const) {
    it(`${id} says kind: exam, which is what the Exams tab filters on`, () => {
      const items = run(id, fixture);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) expect(item.kind).toBe("exam");
    });
  }
});

describe("ECE 391: the schedule's exam rows", () => {
  it("reads both midterms at the hour the row states in prose", () => {
    // `<tr class="tue exam">` | `Tue, Oct 6` | `Midterm Exam 1 at 7pm (no lecture)`.
    // The date cell states no clock; without reading "at 7pm" the exam lands
    // at an invented 23:59, five hours after it ended.
    expect(summary(run("ece391-fa26-exams", "site/ece391-schedule.html"))).toEqual([
      ["Midterm Exam 1", "2026-10-06T19:00:00-05:00", false],
      ["Midterm Exam 2", "2026-11-12T19:00:00-06:00", false],
    ]);
  });
});

describe("CS 374 A: the course calendar", () => {
  it("keeps the exams out of 93 lectures and labs, at their stated start", () => {
    // `Mon Sep 28` / `Midterm 1:  7:00pm- 9:00pm`. The two "Conflict Midterm"
    // rows (time TBA) and the "Optional review for Midterm 1" asides are not
    // exams; the filter is anchored at the start of the row for that.
    expect(summary(run("cs374a-fa26-exams", "sites/cs374a-fa2026-calendar.html"))).toEqual([
      ["Midterm 1", "2026-09-28T19:00:00-05:00", false],
      ["Midterm 2", "2026-11-09T19:00:00-06:00", false],
      ["Final Exam", "2026-12-11T08:00:00-06:00", false],
    ]);
  });
});

describe("ECE 310: the Grading and Exams list", () => {
  it("dates each exam from its Date line, at the start of the range after it", () => {
    // `Date: Wednesday, September 30th, 7-9pm`. The final is "To be
    // announced" and stays undated rather than dropped: the page has one.
    expect(summary(run("ece310-fa26-exams", "sites/ece310-fa2026-index.html"))).toEqual([
      ["Midterm Exam 1", "2026-09-30T19:00:00-05:00", false],
      ["Midterm Exam 2", "2026-11-04T19:00:00-06:00", false],
      ["Final Exam", null, false],
    ]);
  });
});

describe("CS 424: the in-class midterms on the schedule", () => {
  it("reads both, and marks the time assumed because the page states none", () => {
    // The 12/9 "Recap, Take-home Final" is a lecture handing out a take-home,
    // not a sitting, and the filter leaves it out.
    expect(summary(run("cs424-fa26-exams", "sites/cs424-fa2026-schedule.html"))).toEqual([
      ["In-class Midterm", "2026-10-07T23:59:00-05:00", true],
      ["In-class Midterm", "2026-11-04T23:59:00-06:00", true],
    ]);
  });

  it("gives the two same-named midterms two sourceIds", () => {
    const items = run("cs424-fa26-exams", "sites/cs424-fa2026-schedule.html");
    expect(new Set(items.map((i) => i.sourceId)).size).toBe(2);
  });
});

describe("CS 425: the lectures table", () => {
  it("reads the midterm past the stray <p> that closes #Table3 early in linkedom", () => {
    expect(summary(run("cs425-fa26-exams", "sites/cs425-fa2026-lectures.html"))).toEqual([
      ["IN-CLASS MIDTERM EXAM", "2026-10-08T23:59:00-05:00", true],
      ["FINAL EXAM", null, false],
    ]);
  });
});

describe("PHYS 435: the schedule table", () => {
  it("names the exam from its bold line and dates it from the Date column", () => {
    // The Lecture cell also holds "Solutions", "Review", "Lectures 1-13" and
    // "Formula sheet"; the title is only the bold line naming the exam. The
    // final is "Finals week", which is not a date.
    expect(summary(run("phys435-fa26-exams", "sites/phys435-fa2026-schedule.html"))).toEqual([
      ["Hour Exam I", "2026-10-05T23:59:00-05:00", true],
      ["Hour Exam II", "2026-11-09T23:59:00-06:00", true],
      ["Final exam", null, false],
    ]);
  });
});

describe("clockFromText: a clock a sentence introduces", () => {
  it("reads the clock after 'at', '@' or a label's colon", () => {
    expect(clockFromText("Midterm Exam 1 at 7pm (no lecture)")).toEqual({ hour: 19, minute: 0 });
    expect(clockFromText("Midterm 1:  7:00pm- 9:00pm")).toEqual({ hour: 19, minute: 0 });
    expect(clockFromText("Final Exam: 8:00am-11:00am")).toEqual({ hour: 8, minute: 0 });
    expect(clockFromText("Quiz @ 10:30am")).toEqual({ hour: 10, minute: 30 });
  });

  it("reads a clock in parentheses after the exam's name", () => {
    // ECE 329's calendar: `9/21 | Midterm Exam 1 (7:00pm-8:15 pm)`.
    expect(clockFromText("Midterm Exam 1 (7:00pm-8:15 pm)")).toEqual({ hour: 19, minute: 0 });
  });

  it("does not read a date after a colon as a clock", () => {
    // ECE 220's exams table: a 7pm midterm row ends `Deadline: 09/27`, and the
    // leading zero made `09` a 24-hour 09:00 (found on the live page).
    expect(clockFromText("Midterm 1 Thu 10/01 Deadline: 09/27")).toBeUndefined();
    expect(clockFromText("Exam: 09-27 sign up")).toBeUndefined();
    expect(clockFromText("Midterm 1 (9/30, see Piazza)")).toBeUndefined();
  });

  it("does not read a clock's own minutes as a second clock", () => {
    // The colon in `10:30` is inside a clock. Read as an introducer, `30`
    // would be refused only by luck, and `9:15` would become 15:00.
    expect(clockFromText("Lecture 9:15 in 1002 ECEB")).toBeUndefined();
  });

  it("does not read a room, a lecture range or a bare hour", () => {
    expect(clockFromText("Location: ECEB 1002")).toBeUndefined();
    // Deliberately unrealistic (rule 10): a room numbered past 12 straight
    // after a colon. Without the lookahead that ends a clock at its digits,
    // `1702` reads as 17:00.
    expect(clockFromText("Room: 1702")).toBeUndefined();
    expect(clockFromText("Coverage: Lectures 1-13")).toBeUndefined();
    // A bare 7 could be either end of the day; guessing moves an exam 12 hours.
    expect(clockFromText("Midterm at 7")).toBeUndefined();
  });

  it("still reads ECE 411's labelled Time line past the room number", () => {
    expect(clockFromText("Location: ECEB 1002 Time: 7-9PM")).toEqual({ hour: 19, minute: 0 });
  });

  it("takes a Time label as the answer even when it is unreadable", () => {
    // Deliberately unrealistic: a labelled exam time with no meridiem and a
    // second clock later in the line. The label is this row's statement of
    // when the exam is; a review session it mentions is not the exam.
    expect(clockFromText("Time: 7-9, review session at 5pm")).toBeUndefined();
  });
});

describe("parseAdapterDateParts: a clock range after the date", () => {
  const read = (raw: string) =>
    parseAdapterDateParts(raw, "MMM d, h:mm a", "America/Chicago", "2026-09-20T12:00:00.000Z");

  it("reads the start of the range as a stated time", () => {
    const parsed = read("Wednesday, September 30th, 7-9pm");
    expect(parsed?.iso).toBe("2026-09-30T19:00:00-05:00");
    expect(parsed?.timeAssumed).toBe(false);
    expect(parsed?.unparsedTime).toBeUndefined();
  });

  it("lets a clock the cell states win over a range behind it", () => {
    // Deliberately unrealistic: no page writes two clocks after one date. If
    // one did, the one the date grammar read is the one beside the date.
    expect(read("September 30, 5:00 PM, 7-9pm")?.iso).toBe("2026-09-30T17:00:00-05:00");
  });

  it("still files an unreadable tail as unparsed", () => {
    // "7-9" has no meridiem anywhere: either end of the day.
    const parsed = read("Wednesday, September 30th, 7-9");
    expect(parsed?.timeAssumed).toBe(true);
    expect(parsed?.iso).toBe("2026-09-30T23:59:00-05:00");
  });
});

describe("labelSuffix", () => {
  it("drops Date as it drops Due, and keeps what names an item", () => {
    expect(labelSuffix("Date")).toBe("");
    expect(labelSuffix("Due Date")).toBe("");
    expect(labelSuffix("CP1 Due")).toBe("CP1");
    expect(labelSuffix("Midterm 1")).toBe("Midterm 1");
  });
});

describe("sittingKind: the whole title is an exam or a quiz sitting", () => {
  it("accepts the ways the fa26 pages name one", () => {
    for (const title of [
      "Midterm 1",
      "Midterm Exam 1",
      "Hour Exam I",
      "Hour Exam II",
      "IN-CLASS MIDTERM EXAM",
      "In-class Midterm (Open Book/Internet/AI)",
      "Final Exam",
      "Final",
      "Exam 2",
      "Mid-term 2",
      "Midterm #2",
      "Take-home Final",
      "Midterm 2: 7:00pm- 9:00pm",
      "Midterm Exam 1 at 7pm (no lecture)",
      "Exam 1 - Chapters 1-4",
    ]) {
      expect(sittingKind(title), title).toBe("exam");
    }
  });

  it("refuses rows that mention an exam without being one", () => {
    // Every one of these contains an exam word, and parser rule 6 is the
    // reason a substring match is not a test: "Optional review for Midterm 1"
    // is a no-lecture day on CS 374 A's calendar, and filing it as an exam puts
    // a review session on the Exams tab the day before the real one.
    for (const title of [
      "Optional review for Midterm 1",
      "Midterm 1 Review",
      "Midterm 1 (review session)",
      "Final Exam Review",
      "Lecture 36 Final Exam Review pdf",
      "Practice Midterm",
      "Exam 1 solutions",
      "Exam 2 grades released",
      "Midterm 1: formula sheet",
      "HW3 due before midterm",
      "Final project",
      "Final presentations",
      "Finals week",
      "Exams",
      "Midterm survey",
    ]) {
      expect(sittingKind(title), title).toBeUndefined();
    }
  });

  it("names the CBTF quizzes the course pages list as quizzes", () => {
    // Sushi, 2026-10-01: "yes quizzes should appear in exams". Every title
    // here is copied from a fa26 page: TAM 210/212/251, ECE 220, CS 128, CS
    // 357, CS 421.
    for (const title of [
      "Quiz 1",
      "Quiz 10",
      "Quiz 2 retake",
      "Quiz 4 retry",
      "Optional Quiz 1 Retry",
      "Quiz 1: Linear Algebra + Python + Errors",
      "Quiz due 09/07 - 09/10",
      "Quiz on Oct 27, 2026",
      "Quiz 6 Mon (12/8) - Wed (12/10)",
      "Extra Credit Quiz",
    ]) {
      expect(sittingKind(title), title).toBe("quiz");
    }
  });

  it("names the sitting by the word it is named by, not by any mention", () => {
    // CS 440's final row, verbatim: a final that happens to be numbered as a
    // quiz is still the final.
    expect(sittingKind("Our final (= Quiz 7) will be on Thurs Dec 17, sometime during the 8-11am timeslot.")).toBe("exam");
    expect(sittingKind("Quiz 3 (covers the midterm material)")).toBe("quiz");
  });

  it("refuses quiz headings, practice, and the quizzes that are homework", () => {
    for (const title of [
      "Quiz Schedule",
      "Quiz review",
      "Quizzes",
      "Practice Quizzes",
      "Quiz Preparation",
      "Quiz Retakes",
      "Mock Quiz",
      "Missed quiz:",
      "Quiz 1 Information:",
      "Scoring and Catch-Up Quiz Grading",
      // A lecture or reading quiz is done from a laptop, whenever — the
      // PrairieLearn kind, which the Exams tab keeps out on purpose.
      "Lecture Quiz 3",
      "Reading quiz 2",
      "Pre-lecture quiz 4",
      "Due before quiz",
    ]) {
      expect(sittingKind(title), title).toBeUndefined();
    }
  });

  it("refuses the header-and-label rows the live pages made of exams", () => {
    // ECE 313's "Midterm Exams: Time", ECE 220's "Exam schedule Deadline",
    // ECE 310's "Final Exam Date" — all seen in the multi-site probe.
    for (const title of ["Midterm Exams: Time", "Exam schedule Deadline", "No class Final"]) {
      expect(sittingKind(title), title).toBeUndefined();
    }
  });

  it("fits in a registry filter, because the proposer writes it into one", () => {
    // `validateAdapter` refuses a filter pattern over 200 characters, and a
    // refused filter would cost every exams reading the proposer offers.
    expect(SITTING_INCLUDE.length).toBeLessThanOrEqual(200);
    expect(SITTING_EXCLUDE.length).toBeLessThanOrEqual(200);
  });
});

describe("a row names its own kind when the entry does not", () => {
  const page = parseHTML(`<!doctype html><html><body><table id="t">
    <tr><td>9/8</td><td>HW1</td></tr>
    <tr><td>9/28</td><td>Midterm 1</td></tr>
    <tr><td>9/27</td><td>Midterm 1 Review</td></tr>
    <tr><td>10/6</td><td>Quiz 2 retake</td></tr>
  </table></body></html>`).document as unknown as Document;
  const entry = (kind?: string): Adapter =>
    validateAdapter({
      id: "x-fa26",
      label: "X",
      courseCode: "X101",
      term: "fa26",
      url: "https://courses.grainger.illinois.edu/x/fa2026/",
      hostPattern: "https://courses.grainger.illinois.edu/*",
      rows: "#t tr",
      title: "td:nth-child(2)",
      due: "td:nth-child(1)",
      dateFormat: "M/d",
      timezone: "America/Chicago",
      minExtensionVersion: "0.1.0",
      ...(kind ? { kind } : {}),
    }).adapter!;
  const kinds = (adapter: Adapter) =>
    runAdapter(adapter, page, { url: adapter.url, fetchedAt: "2026-09-20T12:00:00.000Z" }).map(
      (item) => [item.title, item.kind],
    );

  it("files the midterm as an exam and the review beside it as not one", () => {
    expect(kinds(entry())).toEqual([
      ["HW1", "assignment"],
      ["Midterm 1", "exam"],
      ["Midterm 1 Review", "assignment"],
      ["Quiz 2 retake", "quiz"],
    ]);
  });

  it("reads the default spelled out the same as the default omitted", () => {
    expect(kinds(entry("assignment"))).toEqual(kinds(entry()));
  });

  it("lets an entry that names another kind keep it for every row", () => {
    expect(kinds(entry("quiz")).map(([, kind]) => kind)).toEqual(["quiz", "quiz", "quiz", "quiz"]);
  });
});

describe("the proposer offers a page's exams on their own", () => {
  const REFERENCE = "2026-09-11T05:00:00.000Z";
  const ZONE = "America/Chicago";
  const propose = (path: string) => {
    const doc = load(path);
    return proposeCandidates(doc, REFERENCE, ZONE, repeatedStructures(doc, ZONE, REFERENCE));
  };
  const examsOf = (found: Candidate[]) =>
    found
      .filter(isExamsOnly)
      .map((candidate) => candidate.sample.map((row) => [row.title, row.due]));

  it("finds CS 424's midterms in the topic column, which the homework reading drops", () => {
    // The homework reading keeps rows whose cell says "due"; an exam row says
    // `In-class Midterm`, so it never reached the student at all.
    expect(examsOf(propose("sites/cs424-fa2026-schedule.html"))).toEqual([
      [
        ["In-class Midterm (Open Book/Internet/AI)", "2026-10-07T23:59:00-05:00"],
        ["In-class Midterm (Open Book/Internet/AI)", "2026-11-04T23:59:00-06:00"],
      ],
    ]);
  });

  it("reads ECE 391's at the hour its row states", () => {
    expect(examsOf(propose("site/ece391-schedule.html"))).toEqual([
      [
        ["Midterm Exam 1 at 7pm (no lecture)", "2026-10-06T19:00:00-05:00"],
        ["Midterm Exam 2 at 7pm (no lecture)", "2026-11-12T19:00:00-06:00"],
      ],
    ]);
  });

  it("reads CS 374 A's out of the calendar, named at the colon", () => {
    expect(examsOf(propose("sites/cs374a-fa2026-calendar.html"))).toEqual([
      [
        ["Midterm 1", "2026-09-28T19:00:00-05:00"],
        ["Conflict Midterm 1", "2026-09-29T23:59:00-05:00"],
        ["Midterm 2", "2026-11-09T19:00:00-06:00"],
        ["Conflict Midterm 2", "2026-11-10T23:59:00-06:00"],
        ["Final Exam", "2026-12-11T08:00:00-06:00"],
      ],
    ]);
  });

  it("keeps a review session out of the exams reading, not only out of the Exams tab", () => {
    // Deliberately unrealistic (parser rule 10): a schedule whose topic column
    // names a review session in an exam's own words. The include pattern alone
    // admits "Midterm 2 (review session)" — a note in parentheses is allowed —
    // so without the exclude half of the filter the exams-only entry keeps the
    // row, and the student who saved it for their midterms gets a review on it.
    const doc = parseHTML(`<!doctype html><html><body><table>
      <thead><tr><th>Date</th><th>Topic</th></tr></thead><tbody>
      <tr><td>9/1</td><td>Intro</td></tr>
      <tr><td>9/3</td><td>Sets</td></tr>
      <tr><td>9/8</td><td>Logic</td></tr>
      <tr><td>9/10</td><td>Proofs</td></tr>
      <tr><td>9/15</td><td>Midterm 1</td></tr>
      <tr><td>9/17</td><td>Midterm 2 (review session)</td></tr>
      <tr><td>9/22</td><td>Midterm 2</td></tr>
      </tbody></table></body></html>`).document as unknown as Document;
    const found = proposeCandidates(doc, REFERENCE, ZONE, repeatedStructures(doc, ZONE, REFERENCE));
    expect(examsOf(found)).toEqual([
      [
        ["Midterm 1", "2026-09-15T23:59:00-05:00"],
        ["Midterm 2", "2026-09-22T23:59:00-05:00"],
      ],
    ]);
  });

  it("offers nothing extra on a page with no exams", () => {
    expect(examsOf(propose("sites/cs374a-fa2026-homeworks.html"))).toEqual([]);
    expect(examsOf(propose("sites/cs425-fa2026-assignments.html"))).toEqual([]);
  });

  it("says what it is, in the sentence and on the proposal", () => {
    const found = propose("sites/cs424-fa2026-schedule.html");
    expect(candidatesFoundLine(found)).toBe(
      "Found one table that looks like a schedule. It can also read just the exams and quizzes.",
    );
    expect(candidatesFoundLine(found.filter(isExamsOnly))).toBe(
      "Found the exams and quizzes on that page.",
    );
    const exams = found.find(isExamsOnly)!;
    expect(candidateNotes(exams)).toContain(
      "Only the rows that name an exam or a quiz — the rest of this page is left alone.",
    );
  });

  it("saves as its own entry, so it cannot replace the homework from the same page", () => {
    const url = "https://courses.grainger.illinois.edu/cs424/fa2026/secure/schedule.html";
    const found = propose("sites/cs424-fa2026-schedule.html");
    const homework = adapterFromCandidate(found.find((c) => !isExamsOnly(c))!, url, "CS424", "fa26");
    // The picker left on its default, "assignment", as it is for a student who
    // never touched it.
    const exams = adapterFromCandidate(found.find(isExamsOnly)!, url, "CS424", "fa26");
    expect(homework.id).toBe("cs424-fa26-schedule-local");
    expect(exams.id).toBe("cs424-fa26-schedule-exams-local");
    // No page-wide kind: each row names itself, so a page whose sittings are
    // midterms and quizzes files each as what it is.
    expect(exams["kind"]).toBeUndefined();
    const adapter = validateAdapter(exams).adapter!;
    const items = runAdapter(adapter, load("sites/cs424-fa2026-schedule.html"), {
      url,
      fetchedAt: REFERENCE,
    });
    expect(items.map((item) => item.kind)).toEqual(["exam", "exam"]);
  });

  it("lets a kind chosen in the picker win over the proposal's", () => {
    const url = "https://courses.grainger.illinois.edu/cs424/fa2026/secure/schedule.html";
    const exams = propose("sites/cs424-fa2026-schedule.html").find(isExamsOnly)!;
    expect(adapterFromCandidate(exams, url, "CS424", "fa26", "quiz")["kind"]).toBe("quiz");
  });
});

describe("shownCandidates keeps an exams reading in view", () => {
  const fake = (rows: string, sittings?: "exam"): Candidate =>
    ({
      rows,
      dateFormat: "M/d",
      total: 1,
      dated: 1,
      sample: [],
      ...(sittings ? { filter: { include: SITTING_INCLUDE, exclude: SITTING_EXCLUDE } } : {}),
    }) as Candidate;

  it("moves the best one up into the last shown place when it ranks below", () => {
    // It dates two or three rows, so it sorts under every reading of twenty
    // homework rows — behind "Show N more", where nobody adding a page for
    // its midterms would look.
    const list = [...Array.from({ length: MAX_SHOWN + 2 }, (_, at) => fake(`r${at}`)), fake("e", "exam")];
    const { shown, hidden } = shownCandidates(list);
    expect(shown.map((c) => c.rows)).toEqual(["r0", "r1", "r2", "r3", "e"]);
    expect(hidden.map((c) => c.rows)).toEqual(["r4", "r5", "r6"]);
  });

  it("leaves the order alone when one is already shown", () => {
    const list = [fake("r0"), fake("e", "exam"), ...Array.from({ length: MAX_SHOWN }, (_, at) => fake(`r${at + 1}`))];
    expect(shownCandidates(list).shown.map((c) => c.rows)).toEqual(["r0", "e", "r1", "r2", "r3"]);
  });
});

/**
 * Exams the 2026-10-01 multi-site probe found on public fa2026 pages and the
 * proposer could not offer: a name before its date (CS 473, ECE 329), a date
 * before its name in one cell (CS 461), a final dated by its week (CS 440), and
 * an exam's line holding a nested `Time:` bullet (ECE 313).
 *
 * Every page here is a verbatim capture (fixtures/sites/README.md). Each
 * assertion is the exact list the "Add a course site" exams reading saves and
 * then runs — title, kind, instant and whether the hour was invented.
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
import { validateAdapter } from "../src/core/registry.js";
import {
  afterLeadingDate,
  clockFromText,
  labelSuffix,
  runAdapter,
  SITTING_EXCLUDE,
  SITTING_INCLUDE,
  sittingSentence,
} from "../src/sources/site.js";
import type { Adapter, RawItem } from "../src/sources/types.js";

const REFERENCE = "2026-10-01T15:00:00.000Z";
const ZONE = "America/Chicago";
const URL_OF: Record<string, string> = {
  "cs473-fa2026-index.html": "https://courses.grainger.illinois.edu/cs473/fa2026/",
  "cs461-fa2026-schedule.html": "https://courses.grainger.illinois.edu/cs461/fa2026/schedule.html",
  "cs440-fa2026-schedule.html": "https://courses.grainger.illinois.edu/cs440/fa2026/schedule.html",
  "ece313-fa2026-exams.html": "https://courses.grainger.illinois.edu/ece313/fa2026/Exams.html",
  "ece329-fa2026-exam.html": "https://courses.grainger.illinois.edu/ece329/fa2026/exam.html",
};

const parse = (html: string) => parseHTML(html).document as unknown as Document;
const load = (name: string) =>
  parse(readFileSync(new URL(`../fixtures/sites/${name}`, import.meta.url), "utf8"));
const propose = (doc: Document) =>
  proposeCandidates(doc, REFERENCE, ZONE, repeatedStructures(doc, ZONE, REFERENCE));

/** The exams reading, saved as a student would save it and run by the runner. */
function examsOf(doc: Document, url: string): RawItem[] {
  const found = propose(doc).filter(isExamsOnly);
  expect(found).toHaveLength(1);
  const { adapter } = validateAdapter(adapterFromCandidate(found[0]!, url, "TEST101", "fa26"));
  return runAdapter(adapter as Adapter, doc, { url, fetchedAt: REFERENCE });
}
const summary = (items: RawItem[]) =>
  items.map((i) => [i.title, i.kind, i.dueAt ?? null, i.extra?.["timeAssumed"] === "true"]);
const fixture = (name: string) => examsOf(load(name), URL_OF[name]!);

describe("CS 473: a name, then its date in parentheses", () => {
  it("reads both midterms at the hour the line states, and keeps the final undated", () => {
    // `<li> Midterm 1 (Sep 30 Wed 7:00pm-9:30pm, in Siebel 1404)` with a nested
    // list of instructions — practice exams, solutions, a conflict date — under
    // it. Before: "Found a list of 10 dated lines", the homework, and no exams.
    const items = fixture("cs473-fa2026-index.html");
    expect(summary(items)).toEqual([
      ["Midterm 1", "exam", "2026-09-30T19:00:00-05:00", false],
      ["Midterm 2", "exam", "2026-11-04T19:00:00-06:00", false],
      ["Final", "exam", null, false],
    ]);
    // `Final (TBA)`: a date the course has not set, not one this misread.
    expect(items[2]!.extra?.["unparsedDate"]).toBe("TBA)");
    // The room and the range end are the rest of the sentence, not a clock.
    expect(items[0]!.extra?.["unparsedTime"]).toBeUndefined();
  });

  it("reads Chrome's shape of the same list, where the three items are siblings", () => {
    // Deliberately reshaped (parser rule 10): linkedom nests `Midterm 2` and
    // `Final` inside Midterm 1's `<p>`, a browser closes each `<li>` at the
    // next. Here they are siblings, and Midterm 1 carries the nested list whose
    // words — "practice", "solutions", a dated conflict line — would fail the
    // exclude half of the filter if the title were the item's whole text.
    const doc = parse(`<!doctype html><html><body><h3>Exams</h3><ul>
      <li> Midterm 1 (Sep 30 Wed 7:00pm-9:30pm, in Siebel 1404)<p></p><ul>
        <li><a href="p.pdf">Some practice exam questions</a></li>
        <li><a href="s.pdf">a past midterm</a> with <a href="t.pdf">solutions</a></li>
        <li>Conflict exams (on Oct 1 Thu) will be offered only to students with a valid reason.</li>
      </ul><p></p></li>
      <li> Midterm 2 (Nov 4 Wed 7:00pm-9:30pm)</li>
      <li> Final (TBA)</li>
    </ul></body></html>`);
    expect(summary(examsOf(doc, URL_OF["cs473-fa2026-index.html"]!))).toEqual([
      ["Midterm 1", "exam", "2026-09-30T19:00:00-05:00", false],
      ["Midterm 2", "exam", "2026-11-04T19:00:00-06:00", false],
      ["Final", "exam", null, false],
    ]);
  });
});

describe("the proposer's floor for a name-first list", () => {
  it("reads a table by its columns, never its rows' text run together", () => {
    // Deliberately unrealistic: a Notes column that holds a date on two rows
    // of six. As a column it is under the share a date column needs, so it is
    // not one; run together, `Midterm 1 Sep 30, 7pm` would read as a sentence
    // and get round that floor. The space between the cells is what a page's
    // source puts there, and what makes the row read as one sentence.
    const doc = parse(`<table><thead><tr><th>Item</th><th>Notes</th></tr></thead><tbody>
      <tr><td>Midterm 1</td> <td>Sep 30, 7pm</td></tr>
      <tr><td>Midterm 2</td> <td>Nov 4, 7pm</td></tr>
      <tr><td>HW1</td><td>submit on PrairieLearn</td></tr>
      <tr><td>HW2</td><td>submit on PrairieLearn</td></tr>
      <tr><td>HW3</td><td>pairs allowed</td></tr>
      <tr><td>Project</td><td>groups of three</td></tr></tbody></table>`);
    expect(propose(doc).filter(isExamsOnly)).toEqual([]);
  });

  it("offers nothing for one dated sitting, as for any other reading", () => {
    // MIN_DATED_ROWS is two everywhere: a lone line naming an exam and a date
    // is as likely to be an announcement as a schedule.
    const one = parse(`<ul><li>Midterm 1 (Oct 7 Wed 7:00pm)</li><li>Office hours moved</li></ul>`);
    expect(propose(one).filter(isExamsOnly)).toEqual([]);
    const two = parse(
      `<ul><li>Midterm 1 (Oct 7 Wed 7:00pm)</li><li>Midterm 2 (Nov 4 Wed 7:00pm)</li><li>Office hours moved</li></ul>`,
    );
    expect(propose(two).filter(isExamsOnly)).toHaveLength(1);
  });
});

describe("ECE 329: a name, then its date, with no punctuation between", () => {
  it("reads the three midterms and the final at the start of their ranges", () => {
    // `<li><p>Exam 1 Sep. 21 Mon 7:00-8:15pm</p>`. The grammar reads `7:00` as
    // ambiguous; the range's `pm` is what says evening. Before: "Nothing on
    // that page looked like a schedule."
    expect(summary(fixture("ece329-fa2026-exam.html"))).toEqual([
      ["Exam 1", "exam", "2026-09-21T19:00:00-05:00", false],
      ["Exam 2", "exam", "2026-10-19T19:00:00-05:00", false],
      ["Exam 3", "exam", "2026-11-16T19:00:00-06:00", false],
      ["Final Exam", "exam", "2026-12-14T19:00:00-06:00", false],
    ]);
  });
});

describe("CS 461: the date, then the name, in one cell", () => {
  it("files the midterm as an exam and leaves the review sessions out", () => {
    // `<span>Oct 15</span><br/><strong>MIDTERM</strong> (in class)` in the
    // Thursday Lecture column, beside `Oct 13 Midterm review` on Tuesday.
    expect(summary(fixture("cs461-fa2026-schedule.html"))).toEqual([
      ["MIDTERM (in class)", "exam", "2026-10-15T23:59:00-05:00", true],
    ]);
  });
});

describe("CS 440: the final, dated by its week", () => {
  it("takes the day the row's own sentence names inside that week, at the slot's start", () => {
    // `<td>Dec 14-18</td>…<td colspan=5>Our final (= Quiz 7) will be on Thurs
    // Dec 17, sometime during the 8-11am timeslot.` Before: Dec 14, 23:59.
    const items = fixture("cs440-fa2026-schedule.html");
    expect(summary(items).at(-1)).toEqual([
      "Our final (= Quiz 7) will be on Thurs Dec 17, sometime during the 8-11am timeslot. Exact starting time TBD. 25 minutes long, like the previous quizzes.",
      "exam",
      "2026-12-17T08:00:00-06:00",
      false,
    ]);
    expect(summary(items.slice(0, -1)).map(([title, kind, at]) => [title, kind, at])).toEqual([
      ["Quiz 1", "quiz", "2026-09-07T23:59:00-05:00"],
      ["Quiz 2", "quiz", "2026-09-21T23:59:00-05:00"],
      ["Quiz 3", "quiz", "2026-10-05T23:59:00-05:00"],
      ["Quiz 4", "quiz", "2026-10-19T23:59:00-05:00"],
      ["Quiz 5", "quiz", "2026-11-02T23:59:00-06:00"],
      ["Quiz 6", "quiz", "2026-11-16T23:59:00-06:00"],
    ]);
  });
});

describe("ECE 313: each exam's line holds a nested Time: bullet", () => {
  it("names each exam by its own line, not by the heading over the list", () => {
    // `<li>Midterm Exam I:<ul><li>Time: Oct 12, 7-8:30 PM</li>…`. Before: four
    // assignments, each called "Midterm Exams: Time". The final's `Time:` is
    // still blank on the page, so it has no row yet.
    expect(summary(fixture("ece313-fa2026-exams.html"))).toEqual([
      ["Midterm Exam I", "exam", "2026-10-12T19:00:00-05:00", false],
      ["Conflict Exam I", "exam", "2026-10-13T08:00:00-05:00", false],
      ["Midterm Exam II", "exam", "2026-11-09T19:00:00-06:00", false],
      ["Conflict Exam II", "exam", "2026-11-10T08:00:00-06:00", false],
    ]);
  });

  it("is not offered when one exam's dated line is not the first under its name", () => {
    // Deliberately reordered: `due: "li"` reads an item's *first* nested line,
    // so with `Location:` first under Midterm Exam II the reading would keep
    // Midterm Exam I and drop the second midterm in silence.
    const doc = parse(`<!doctype html><html><body><h2>Midterm Exams:</h2><ul>
      <li>Midterm Exam I:<ul><li>Time: Oct 12, 7-8:30 PM</li><li>Location: 1002 ECEB</li></ul></li>
      <li>Midterm Exam II:<ul><li>Location: 1002 ECEB</li><li>Time: Nov 9, 7-8:30 PM</li></ul></li>
    </ul></body></html>`);
    expect(propose(doc).filter(isExamsOnly)).toEqual([]);
  });

  it("does not let an item that names no exam refuse the reading", () => {
    // Deliberately unrealistic: a review session laid out like the exams but
    // with its Time line second. It is not this reading's row, so its order is
    // not this reading's problem.
    const doc = parse(`<!doctype html><html><body><h2>Midterm Exams:</h2><ul>
      <li>Midterm Exam I:<ul><li>Time: Oct 12, 7-8:30 PM</li></ul></li>
      <li>Review session:<ul><li>Location: 1002 ECEB</li><li>Time: Oct 10, 5-7 PM</li></ul></li>
      <li>Midterm Exam II:<ul><li>Time: Nov 9, 7-8:30 PM</li></ul></li>
    </ul></body></html>`);
    const url = URL_OF["ece313-fa2026-exams.html"]!;
    expect(summary(examsOf(doc, url)).map(([title, , at]) => [title, at])).toEqual([
      ["Midterm Exam I", "2026-10-12T19:00:00-05:00"],
      ["Midterm Exam II", "2026-11-09T19:00:00-06:00"],
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* The decisions, each against the input that would make it wrong              */
/* -------------------------------------------------------------------------- */

/** A list read the way `sentenceExamTrialFor` proposes one. */
const sentenceAdapter = (dateFormat = "MMM d, h:mm a"): Adapter =>
  validateAdapter({
    id: "t",
    label: "T",
    courseCode: "TEST101",
    term: "fa26",
    url: "https://courses.grainger.illinois.edu/test/",
    hostPattern: "https://courses.grainger.illinois.edu/*",
    rows: "li",
    title: ".",
    due: ".",
    time: ".",
    dateFormat,
    timezone: ZONE,
    filter: { include: SITTING_INCLUDE, exclude: SITTING_EXCLUDE },
    minExtensionVersion: "0.0.0",
  }).adapter as Adapter;
const runList = (lis: string[], adapter = sentenceAdapter()) =>
  runAdapter(adapter, parse(`<ul>${lis.map((li) => `<li>${li}</li>`).join("")}</ul>`), {
    url: adapter.url,
    fetchedAt: REFERENCE,
  });

describe("a sitting's date is the one straight after its name", () => {
  it("takes no date from further along the sentence", () => {
    // Deliberately unrealistic: each line mentions a date that is not the
    // sitting's. A reader that took the first date anywhere would date all four.
    expect(sittingSentence("Midterm 1 (covers lectures through Oct 1)")).toBeUndefined();
    expect(sittingSentence("Midterm 1 review session Sep 29")).toBeUndefined();
    expect(sittingSentence("HW3 due before the midterm Oct 2")).toBeUndefined();
    expect(sittingSentence("Final exam grades posted Dec 20")).toBeUndefined();
  });

  it("backs off a number that is really the date's month", () => {
    expect(sittingSentence("Quiz 9/15 in class")).toEqual({ name: "Quiz", rest: "9/15 in class" });
  });

  it("still filters the name it cut, so a practice exam is not a sitting", () => {
    const items = runList([
      "Midterm 1 (Oct 7 Wed 7:00pm-9:00pm)",
      "Practice Midterm 1 (Oct 1 Thu 7:00pm)",
      "Midterm 2 (covers through Nov 1)",
      "Homework 3 Oct 9 10:00am",
    ]);
    expect(summary(items)).toEqual([
      ["Midterm 1", "exam", "2026-10-07T19:00:00-05:00", false],
      ["Midterm 2 (covers through Nov 1)", "exam", null, false],
    ]);
  });

  it("keeps the leftover as unparsed when the hour is still invented", () => {
    // The tail is only the rest of the sentence once a clock was read; with
    // none read, `7` is a time this failed to read (house rule 1).
    const [item] = runList(["Midterm 1 (Oct 7, 5:00)"]);
    expect(item!.extra?.["timeAssumed"]).toBe("true");
    expect(item!.extra?.["unparsedTime"]).toBe("5:00");
  });
});

describe("a date-led cell is retitled only when what follows names a sitting", () => {
  it("leaves a homework row's title alone", () => {
    expect(afterLeadingDate("Oct 15 HW 3", "MMM d, h:mm a", ZONE, REFERENCE)).toBe("HW 3");
    const adapter = { ...sentenceAdapter(), filter: undefined } as Adapter;
    expect(runList(["Oct 15 HW 3", "Oct 15 7pm Midterm 1"], adapter).map((i) => [i.title, i.kind])).toEqual([
      ["Oct 15 HW 3", "assignment"],
      ["Midterm 1", "exam"],
    ]);
  });

  it("keeps a clock written after the day as part of the date", () => {
    expect(afterLeadingDate("Oct 15 7pm Midterm", "MMM d, h:mm a", ZONE, REFERENCE)).toBe("Midterm");
    expect(afterLeadingDate("Midterm Oct 15", "MMM d, h:mm a", ZONE, REFERENCE)).toBeUndefined();
  });
});

describe("a week-dated sitting takes the day its sentence names in that week", () => {
  const table = (rows: [string, string][]) =>
    parse(`<table><thead><tr><th>Date</th><th>Topic</th></tr></thead><tbody>${rows
      .map(([date, topic]) => `<tr><td>${date}</td><td>${topic}</td></tr>`)
      .join("")}</tbody></table>`);
  const adapterIn = (dateFormat: string) => validateAdapter({
    id: "t",
    label: "T",
    courseCode: "TEST101",
    term: "fa26",
    url: "https://courses.grainger.illinois.edu/test/",
    hostPattern: "https://courses.grainger.illinois.edu/*",
    rows: "table tbody tr",
    title: "td",
    due: "td",
    columns: { title: "Topic", due: "Date" },
    dateFormat,
    timezone: ZONE,
    minExtensionVersion: "0.0.0",
  }).adapter as Adapter;
  const run = (rows: [string, string][], adapter = adapterIn("MMM d, h:mm a")) =>
    runAdapter(adapter, table(rows), { url: adapter.url, fetchedAt: REFERENCE }).map((i) => [
      i.title.slice(0, 12),
      i.dueAt,
    ]);

  it("only inside the week, only for a sitting, only from a span", () => {
    // Deliberately unrealistic, one trap per row: a day after the week, a day
    // before it, a homework row naming a day in its week, a sitting under a
    // single-day cell, and the real shape.
    expect(
      run([
        ["Dec 14-18", "Final exam (Dec 21, 8am)"],
        ["Dec 14-18", "Final exam, moved from Dec 11"],
        ["Dec 14-18", "HW 9 due Thurs Dec 17"],
        ["Dec 14", "Final exam on Dec 17"],
        ["Dec 7-11", "Final exam on Thu Dec 10"],
        ["Dec 7-11", "Final (Dec 9, 8am)"],
      ]),
    ).toEqual([
      ["Final exam (", "2026-12-14T23:59:00-06:00"],
      ["Final exam, ", "2026-12-14T23:59:00-06:00"],
      ["HW 9 due Thu", "2026-12-14T23:59:00-06:00"],
      ["Final exam o", "2026-12-14T23:59:00-06:00"],
      ["Final exam o", "2026-12-10T23:59:00-06:00"],
      ["Final (Dec 9", "2026-12-09T08:00:00-06:00"],
    ]);
  });

  it("does not take an ISO date's dashes for a span", () => {
    // `2026-12-14` holds `12-14`, which reads like a day range to a pattern
    // that does not look behind it.
    expect(
      run([["2026-12-14", "Final exam on 2026-12-17"]], adapterIn("yyyy-MM-dd")),
    ).toEqual([["Final exam o", "2026-12-14T23:59:00-06:00"]]);
  });
});

describe("clocks an exam line states without introducing them", () => {
  it("reads a range closed by a meridiem as its start", () => {
    expect(clockFromText("Exam 1 Sep. 21 Mon 7:00-8:15pm")).toEqual({ hour: 19, minute: 0 });
    expect(clockFromText("sometime during the 8-11am timeslot")).toEqual({ hour: 8, minute: 0 });
    // The meridiem is lent only where it keeps the range in order.
    expect(clockFromText("Final 11-1pm")).toEqual({ hour: 11, minute: 0 });
    expect(clockFromText("Final 11am-1pm")).toEqual({ hour: 11, minute: 0 });
  });

  it("does not read a room, a chapter range or a date", () => {
    expect(clockFromText("Final in Siebel 1404")).toBeUndefined();
    // Deliberately unrealistic: a range glued to the end of a room number must
    // not start inside it and read `04-5pm` as 4pm.
    expect(clockFromText("Final in Siebel 1404-5pm")).toBeUndefined();
    expect(clockFromText("Midterm covers chapters 3-5")).toBeUndefined();
    expect(clockFromText("Final Dec 14-18")).toBeUndefined();
  });

  it("drops a Time label from the title the way it drops Date", () => {
    expect(labelSuffix("Time")).toBe("");
  });
});

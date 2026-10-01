/**
 * The "Add a course site" proposer, over the public fa2026 pages the 2026-10-01
 * multi-site probe found it reading wrongly or not at all.
 *
 * Each case is the whole path a student's click takes: the page's inventory
 * (`repeatedStructures`), the search (`proposeCandidates`), the entry the
 * student would save (`adapterFromCandidate`), and the runner the sync loop
 * uses on it every morning (`runAdapter`). Every assertion is the exact list of
 * titles and instants that entry produces — a wrong column reads plausibly, so
 * anything less than the exact list lets it through.
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import {
  adapterFromCandidate,
  isExamsOnly,
  proposeCandidates,
  selectorForTable,
  type Candidate,
} from "../src/core/detect.js";
import { validateAdapter } from "../src/core/registry.js";
import { repeatedStructures } from "../src/core/skeleton.js";
import { runAdapter } from "../src/sources/site.js";
import type { Adapter } from "../src/sources/types.js";

const REFERENCE = "2026-10-01T15:00:00.000Z";
const ZONE = "America/Chicago";

const parse = (html: string) => parseHTML(html).document as unknown as Document;
const load = (file: string) =>
  parse(readFileSync(new URL(`../fixtures/sites/${file}`, import.meta.url), "utf8"));

const proposals = (doc: Document): Candidate[] =>
  proposeCandidates(doc, REFERENCE, ZONE, repeatedStructures(doc, ZONE, REFERENCE));

/** The first deadline proposal, saved and run: `[title, dueAt | null]` per item. */
function topDeadlines(doc: Document, url: string): (string | null)[][] {
  const top = proposals(doc).find((candidate) => !isExamsOnly(candidate));
  if (!top) throw new Error("no deadline proposal");
  const { adapter, reason } = validateAdapter(adapterFromCandidate(top, url, "X101", "fa26"));
  if (!adapter) throw new Error(reason);
  return runAdapter(adapter as Adapter, doc, { url, fetchedAt: REFERENCE }).map((item) => [
    item.title,
    item.dueAt ?? null,
  ]);
}

const at = (date: string, offset = "-05:00") => `${date}T23:59:00${offset}`;

describe("CS 421's MPs and WAs, two nested tables with row-header cells", () => {
  const doc = load("cs421-fa2026-mps.html");
  const url = "https://courses.grainger.illinois.edu/cs421/fa2026/mps.html";

  it("reads both tables as one proposal, named by each row's own <th>", () => {
    // Before: "Nothing on that page looked like a schedule." Each schedule is
    // nested in a layout table, so `table:nth-of-type(4)` named the wrong one;
    // the WA header row opens with a `<td>`, so it had no header at all.
    expect(topDeadlines(doc, url)).toEqual([
      ["MP1", at("2026-09-02")],
      // "Quiz Sep 10, 2026": the date grammar's question, not this search's.
      ["MP2", null],
      ["MP3", at("2026-09-15")],
      ["MP4", at("2026-09-22")],
      ["MP5", null],
      ["MP6", at("2026-10-20")],
      ["MP7", null],
      ["MP8", at("2026-11-03", "-06:00")],
      ["MP9", at("2026-11-17", "-06:00")],
      ["MP10", at("2026-12-01", "-06:00")],
      ["MP11", at("2026-12-08", "-06:00")],
      ["WA1", at("2026-09-03")],
      ["WA2", at("2026-09-10")],
      ["WA3XC", at("2026-09-17")],
      ["WA4", at("2026-10-01")],
      ["WA5", at("2026-10-08")],
      ["WA6", at("2026-10-22")],
      ["WA7", at("2026-10-29")],
      ["WA8", at("2026-11-05", "-06:00")],
      ["WA9", at("2026-11-19", "-06:00")],
      // WA10 and WA11 are missing here and present in Chrome: the page writes
      // WA10's row with no opening `<tr>`, which an HTML parser implies and
      // linkedom does not, so WA10's cells and WA11's row hang off the table.
    ]);
  });

  it("takes the hour from the due column's own header", () => {
    const top = proposals(doc)[0]!;
    // Each table by its own class under the layout table that holds it — the
    // fewest positional steps that still name exactly one table.
    expect(top.rows).toBe(
      "table.module:nth-of-type(2) table.schedule tr, table.module:nth-of-type(3) table.schedule tr",
    );
    expect(top.columns).toEqual({
      title: 'mp no.: link:|wa no."',
      due: "due at 23:59 ct (11:59pm ct) on:",
    });
    expect(top.defaultTime).toBe("23:59");
  });
});

describe("TAM 210's schedule, whose homework lives in one column of eight", () => {
  const doc = load("tam210-fa2026-schedule.html");

  it("titles rows from Assignment Due Dates, not from the Discussion column", () => {
    // Before: titled from "Discussion" — rowspan-repeated and linked every week,
    // "No Discussion" twelve times — so the homework never appeared.
    const rows = topDeadlines(doc, "https://courses.grainger.illinois.edu/tam210/fa2026/schedule.html");
    expect(rows).toEqual([
      // A rowspan of three in the title column repeats its cell on every day
      // it covers. Left for the student to see; nothing here can tell a
      // three-day resource from three deadlines.
      ["PL Tips", at("2026-08-24")],
      ["PL Tips", at("2026-08-26")],
      ["PL Tips", at("2026-08-28")],
      ["HW 1A", at("2026-09-02")],
      ["Discussion 1", at("2026-09-04")],
      ["HW 1B", at("2026-09-09")],
      ["Discussion 2", at("2026-09-11")],
      ["HW 2A", at("2026-09-16")],
      ["Discussion 3", at("2026-09-18")],
      ["HW 2B", at("2026-09-23")],
      ["Discussion 4", at("2026-09-25")],
      ["HW 3A", at("2026-09-30")],
      ["Discussion 5", at("2026-10-02")],
      ["HW 3B", at("2026-10-07")],
      ["Discussion 6", at("2026-10-09")],
      ["HW 4A", at("2026-10-14")],
      ["Discussion 7", at("2026-10-16")],
      ["HW 4B", at("2026-10-21")],
      ["Discussion 8", at("2026-10-23")],
      ["HW 4C", at("2026-10-28")],
      ["Discussion 9", at("2026-10-30")],
      ["HW 4D", at("2026-11-04", "-06:00")],
      ["Discussion 10", at("2026-11-06", "-06:00")],
      ["HW 5A (TAM 211 only)", at("2026-11-11", "-06:00")],
      ["Discussion 11 (TAM 211 only)", at("2026-11-13", "-06:00")],
      ["HW 5B (TAM 211 only)", at("2026-11-18", "-06:00")],
      ["Discussion 12 (TAM 211 only)", at("2026-11-20", "-06:00")],
      ["HW 6A (TAM 211 only)", at("2026-12-02", "-06:00")],
      ["Discussion 13 (TAM 211 only)", at("2026-12-04", "-06:00")],
      ["HW 6B Discussion 15 (TAM 211 only)", at("2026-12-09", "-06:00")],
    ]);
  });
});

describe("CS 128's syllabus, nine tables and two of them schedules", () => {
  const doc = load("cs128-2026c-syllabus.html");

  it("reads the quiz windows and the MPs together, each by its deadline column", () => {
    // Before: no proposal — the nine tables were one group with no common
    // header. Alone, each table's first reading was its *start* column: quizzes
    // at 00:01 on the day the window opened, MPs a week early.
    expect(topDeadlines(doc, "https://cs128.org/2026c/syllabus-1881")).toEqual([
      ["Quiz 1", at("2026-09-08")],
      ["Quiz 2", at("2026-09-14")],
      ["Quiz 3", at("2026-09-21")],
      ["Quiz 4", at("2026-09-28")],
      ["Quiz 5", at("2026-10-05")],
      ["Quiz 6", at("2026-10-12")],
      ["Quiz 7", at("2026-10-19")],
      ["Quiz 8", at("2026-10-26")],
      ["Quiz 9", at("2026-11-02", "-06:00")],
      ["Quiz 10", at("2026-11-09", "-06:00")],
      ["Quiz 11", at("2026-11-16", "-06:00")],
      ["Quiz 12", at("2026-11-20", "-06:00")],
      ["Quiz 13", at("2026-12-07", "-06:00")],
      ["MP 0", at("2026-09-17")],
      ["MP 1", at("2026-09-24")],
      ["MP 2", at("2026-10-01")],
      ["MP 3", at("2026-10-08")],
      ["MP 4", at("2026-10-15")],
      ["MP 5", at("2026-10-22")],
      ["MP 6", at("2026-10-29")],
      ["MP 7", at("2026-11-05", "-06:00")],
      ["MP 8", at("2026-11-12", "-06:00")],
      ["MP 9", at("2026-11-19", "-06:00")],
      ["MP 10", at("2026-12-03", "-06:00")],
    ]);
  });
});

describe("ECE 220's labs, `Day | Labs | Submission due date` with no <tbody>", () => {
  const doc = load("ece220-fa2026-labs.html");

  it("reads the submission column, not the lab day, and not the header row", () => {
    // Before: the Day column (two more rows dated) came first, two days early on
    // every lab, and its first item was `"Labs" unparsedDate="Day"`.
    expect(
      topDeadlines(doc, "https://courses.grainger.illinois.edu/ece220/fa2026/assignments/labs/"),
    ).toEqual([
      ["Lab 01 - Printing hexadecimals", at("2026-08-30")],
      ["Lab 02 - Problem solving with stack", at("2026-09-06")],
      ["Lab 03 - Computing a math function", at("2026-09-13")],
      ["Lab 04 - Printing Prime Numbers", at("2026-09-20")],
      ["Lab 05 - Random Numbers", at("2026-09-27")],
      ["Lab 06 - Matrix Multiplication in C", at("2026-10-04")],
      ["Lab 07 - Mini Sudoku", at("2026-10-11")],
      ["Lab 08 - 2048 Preparation", at("2026-10-18")],
      ["Lab 09 - Vectors", at("2026-10-25")],
      ["Lab 10 - Linked List", at("2026-11-01", "-06:00")],
      ["Help session on MP10", null],
      ["Lab 11 - C++ Classes", at("2026-11-15", "-06:00")],
      ["Lab 12 - Lowest Common Ancestor", at("2026-11-22", "-06:00")],
      ["No lab (Fall break)", null],
      ["Lab 13 + Help on MP12", at("2026-12-06", "-06:00")],
    ]);
  });
});

describe("CS 446's lecture table, a `[Slides]` link on every lecture", () => {
  const doc = load("cs446-fa2026-index.html");

  it("names rows by their description, not by the link every row shares", () => {
    // Before: 27 rows all titled "[Slides]". Still a reading of the lectures as
    // well as the assignments — the `tr.success` rows are the deadlines, and
    // this search has no way to prefer a narrower group that dates fewer rows.
    const rows = topDeadlines(doc, "https://courses.grainger.illinois.edu/cs446/fa2026/index.html");
    expect(rows).toHaveLength(45);
    expect(rows.filter(([title]) => /^Assignment \d Due$/.test(title!))).toEqual([
      ["Assignment 0 Due", at("2026-09-09")],
      ["Assignment 1 Due", at("2026-09-13")],
      ["Assignment 2 Due", at("2026-09-27")],
      ["Assignment 3 Due", at("2026-10-11")],
      ["Assignment 4 Due", at("2026-11-01", "-06:00")],
      ["Assignment 5 Due", at("2026-11-15", "-06:00")],
      ["Assignment 6 Due", at("2026-12-06", "-06:00")],
    ]);
    expect(rows.some(([title]) => title!.includes("[Slides]"))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* The decisions, one at a time                                                */
/* -------------------------------------------------------------------------- */

const run = (doc: Document) => {
  const top = proposals(doc)[0];
  if (!top) return { top, items: [] as (string | null)[][] };
  return { top, items: topDeadlines(doc, "https://courses.grainger.illinois.edu/x/fa2026/") };
};

describe("a table's selector names the table it was measured on", () => {
  it("through an ancestor path when the tables are not siblings", () => {
    // `table:nth-of-type(k)` counts among siblings: with the document-wide
    // index it named the layout table here, or nothing.
    const doc = parse(
      `<table class="layout"><tr><td><table class="s"><tr><td>a</td></tr></table></td></tr></table>` +
        `<div><table class="s"><tr><td>b</td></tr></table></div>`,
    );
    for (const table of doc.querySelectorAll("table")) {
      const selector = selectorForTable(table, doc);
      expect([...doc.querySelectorAll(selector)], selector).toEqual([table]);
    }
  });
});

describe("the header row is not an item", () => {
  it("in a table with <thead> and no <tbody>", () => {
    const doc = parse(
      `<table id="t"><thead><tr><th>Lab</th><th>Due</th></tr></thead>` +
        `<tr><td>Lab 1</td><td>9/4</td></tr><tr><td>Lab 2</td><td>9/11</td></tr></table>`,
    );
    expect(run(doc).items).toEqual([
      ["Lab 1", at("2026-09-04")],
      ["Lab 2", at("2026-09-11")],
    ]);
  });

  it("in a table whose header row has one <td> among its <th>s", () => {
    const doc = parse(
      `<table id="t"><tr><td>No.</td><th>Topic</th><th>Due</th></tr>` +
        `<tr><th>WA1</th><td>Evaluation</td><td>9/4</td></tr>` +
        `<tr><th>WA2</th><td>Order</td><td>9/11</td></tr></table>`,
    );
    const { top, items } = run(doc);
    expect(top?.columns?.due).toBe("due");
    expect(items).toEqual([
      ["WA1", at("2026-09-04")],
      ["WA2", at("2026-09-11")],
    ]);
  });

  it("but a body row that opens with a <th> is never taken for it", () => {
    // Deliberately unrealistic: the *first* row is a body row of one <th> and
    // one <td> — a tie, which is the boundary of the majority rule. It stays a
    // row and the table has no header; read as a grid, it needs a cell saying
    // "due", so nothing names a column at all.
    const doc = parse(
      `<table id="t"><tr><th>HW1</th><td>9/4</td></tr>` +
        `<tr><th>HW2</th><td>9/11</td></tr><tr><th>HW3</th><td>9/18</td></tr></table>`,
    );
    expect(proposals(doc).some((candidate) => candidate.columns !== undefined)).toBe(false);
  });
});

describe("which column names the rows", () => {
  it("a header that says the column holds the assignments, over a linked one", () => {
    const doc = parse(
      `<table id="t"><tr><th>Date</th><th>Discussion</th><th>Assignment</th></tr>` +
        `<tr><td>9/4</td><td><a href="/d1">Discussion 1</a></td><td>HW 1</td></tr>` +
        `<tr><td>9/11</td><td><a href="/d2">Discussion 2</a></td><td>HW 2</td></tr>` +
        `<tr><td>9/18</td><td><a href="/d3">Discussion 3</a></td><td>HW 3</td></tr></table>`,
    );
    expect(run(doc).top?.columns?.title).toBe("assignment");
  });

  it("a row-header <th> over a linked topic", () => {
    const doc = parse(
      `<table id="t"><tr><th>No.</th><th>Topic</th><th>Due</th></tr>` +
        `<tr><th>MP1</th><td><a href="/a">Basics</a></td><td>9/4</td></tr>` +
        `<tr><th>MP2</th><td><a href="/b">Recursion</a></td><td>9/11</td></tr></table>`,
    );
    expect(run(doc).top?.columns?.title).toBe("no.");
  });

  it("a column of distinct names over one link repeated on every row", () => {
    const doc = parse(
      `<table id="t"><tr><th>Event</th><th>Date</th><th>Slides</th></tr>` +
        `<tr><td>Intro</td><td>9/4</td><td><a href="/1">[Slides]</a></td></tr>` +
        `<tr><td>kNN</td><td>9/11</td><td><a href="/2">[Slides]</a></td></tr>` +
        `<tr><td>SVM</td><td>9/18</td><td><a href="/3">[Slides]</a></td></tr></table>`,
    );
    expect(run(doc).top?.columns?.title).toBe("event");
  });

  it("never a column of dates, whatever its header says", () => {
    // Deliberately unrealistic: a "Due" column offered as the *title* for a
    // reading by the Issued column, with one cell a date cannot be read from.
    const doc = parse(
      `<table id="t"><tr><th>Issued</th><th>Due</th></tr>` +
        `<tr><td>9/1</td><td>9/4</td></tr><tr><td>9/8</td><td>9/11</td></tr>` +
        `<tr><td>9/15</td><td>Quiz 9/18</td></tr></table>`,
    );
    expect(proposals(doc).filter((c) => c.columns?.title === "due")).toEqual([]);
  });

  it("never filler a column writes on the weeks it has nothing", () => {
    const doc = parse(
      `<table id="t"><tr><th>Date</th><th>Lab</th><th>Topic</th></tr>` +
        `<tr><td>9/4</td><td>No lab</td><td>Intro</td></tr>` +
        `<tr><td>9/11</td><td>No lab</td><td>Loops</td></tr>` +
        `<tr><td>9/18</td><td>Lab 1</td><td>Arrays</td></tr></table>`,
    );
    expect(run(doc).top?.columns?.title).toBe("topic");
  });
});

describe("which date column is the deadline", () => {
  for (const [start, end] of [
    ["Release", "Due"],
    ["Start", "End"],
    ["Opens", "Deadline"],
    ["Day", "Submission due date"],
    // Neither says deadline, and one says start: the one that does not wins.
    ["Released", "Date"],
  ]) {
    it(`"${end}" before "${start}", though "${start}" dates more`, () => {
      const doc = parse(
        `<table id="t"><tr><th>Name</th><th>${start}</th><th>${end}</th></tr>` +
          `<tr><td>HW A</td><td>9/1</td><td>9/4</td></tr>` +
          `<tr><td>HW B</td><td>9/8</td><td>9/11</td></tr>` +
          `<tr><td>HW C</td><td>9/15</td><td></td></tr></table>`,
      );
      expect(proposals(doc)[0]!.columns!.due).toBe(end!.toLowerCase());
    });
  }
});

describe("the hour a due column's header states", () => {
  it("stands against a different hour stated elsewhere on the page", () => {
    // The page-wide sentence is about homework in general; the header is
    // about this column, and it is nearer the rows.
    const doc = parse(
      `<p>Homework is due at 9pm.</p>` +
        `<table id="t"><tr><th>Lab</th><th>Due at 5pm on</th></tr>` +
        `<tr><td>Lab 1</td><td>9/4</td></tr><tr><td>Lab 2</td><td>9/11</td></tr></table>`,
    );
    expect(proposals(doc)[0]!.defaultTime).toBe("17:00");
  });
});

describe("the deadline column first, with deadline and exams readings kept apart", () => {
  it("never moves an exams reading above a deadline reading", () => {
    const doc = parse(
      `<table id="t"><tr><th>Name</th><th>Date</th><th>Due</th></tr>` +
        `<tr><td>Midterm 1</td><td>9/1</td><td>9/4</td></tr>` +
        `<tr><td>Midterm 2</td><td>9/8</td><td>9/11</td></tr>` +
        `<tr><td>HW 1</td><td>9/15</td><td>9/18</td></tr>` +
        `<tr><td>HW 2</td><td>9/22</td><td></td></tr></table>`,
    );
    expect(proposals(doc).map((c) => [isExamsOnly(c), c.columns?.due])).toEqual([
      [false, "due"],
      [false, "date"],
      [true, "due"],
      [true, "date"],
    ]);
  });
});

describe("several tables, one reading", () => {
  const table = (cls: string, title: string, due: string, rows: string[][]) =>
    `<div><table class="${cls}"><thead><tr><th>${title}</th><th>${due}</th></tr></thead><tbody>` +
    rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("") +
    `</tbody></table></div>`;

  it("joins two deadline tables whose columns are named differently", () => {
    const doc = parse(
      table("t", "Quiz", "End", [["Quiz 1", "9/4"], ["Quiz 2", "9/11"]]) +
        table("t", "MP", "Due", [["MP 1", "9/5"], ["MP 2", "9/12"]]),
    );
    const { top, items } = run(doc);
    expect(top?.columns).toEqual({ title: "quiz|mp", due: "end|due" });
    expect(items).toEqual([
      ["Quiz 1", at("2026-09-04")],
      ["Quiz 2", at("2026-09-11")],
      ["MP 1", at("2026-09-05")],
      ["MP 2", at("2026-09-12")],
    ]);
  });

  it("but not a table whose date column does not say deadline", () => {
    const doc = parse(
      table("t", "Lecture", "Date", [["Intro", "9/4"], ["Loops", "9/11"], ["Arrays", "9/18"]]) +
        table("t", "MP", "Due", [["MP 1", "9/5"], ["MP 2", "9/12"]]),
    );
    expect(proposals(doc).some((c) => c.rows.includes(","))).toBe(false);
  });

  it("nor a table whose dates are written differently from the rest", () => {
    // Three tables, so the join of the two that agree is still offered and
    // the third would be a member whose every row reads undated.
    const doc = parse(
      table("t", "Quiz", "End", [["Quiz 1", "9/4"], ["Quiz 2", "9/11"]]) +
        table("t", "MP", "Due", [["MP 1", "9/5"], ["MP 2", "9/12"]]) +
        table("t", "Lab", "Deadline", [["Lab 1", "Sep 6"], ["Lab 2", "Sep 13"]]),
    );
    const joins = proposals(doc).filter((c) => c.rows.includes(","));
    expect(joins.map((c) => c.columns)).toEqual([{ title: "quiz|mp", due: "end|due" }]);
  });

  it("from each table's deadline reading, not from its exams reading", () => {
    // The exams reading of the quiz table ties the deadline one and is pushed
    // first, so it ranks first; it titles by the sitting names and carries a
    // filter the join would drop. The join takes the deadline reading's title.
    const doc = parse(
      `<div><table class="t"><thead><tr><th>Quiz</th><th>Topic</th><th>End</th></tr></thead><tbody>` +
        `<tr><td>Quiz 1</td><td><a href="/a">Loops</a></td><td>9/4</td></tr>` +
        `<tr><td>Quiz 2</td><td><a href="/b">Arrays</a></td><td>9/11</td></tr></tbody></table></div>` +
        table("t", "MP", "Due", [["MP 1", "9/5"], ["MP 2", "9/12"]]),
    );
    const join = proposals(doc).find((c) => c.rows.includes(","));
    // In rank order, and the MP table's reading ranks first: it has no exams
    // reading tying it.
    expect(join?.columns).toEqual({ title: "mp|topic", due: "due|end", link: "topic" });
  });

  it("nor where a column name would resolve in both tables", () => {
    // A row whose own cell is empty would fall through `|` to the other
    // table's name — present here too — and read a column nobody chose.
    const doc = parse(
      `<div><table><thead><tr><th>Name</th><th>Due</th><th>End</th></tr></thead><tbody>` +
        `<tr><td>HW A</td><td>9/4</td><td>9/30</td></tr><tr><td>HW B</td><td>9/11</td><td>9/30</td></tr>` +
        `</tbody></table></div>` +
        table("t", "MP", "End", [["MP 1", "9/5"], ["MP 2", "9/12"]]),
    );
    expect(proposals(doc).some((c) => c.rows.includes(","))).toBe(false);
  });
});

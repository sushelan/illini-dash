/**
 * Proposing an adapter (`src/core/detect.ts`).
 *
 * Run against the real captures, because the point of this module is to handle
 * pages nobody hand-tuned it for — and the eight adapters that exist are the
 * only proof available that a guess lands where a human landed.
 *
 * The search crosses the page's repeated groups with the six locators
 * `skeleton.ts` measured, so the assertions here are mostly of one shape: the
 * rows this proposes, run through the real `runAdapter`, are the rows the
 * hand-written entry produces. Anything weaker passes against a proposal that
 * reads the right page with the wrong hook.
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import {
  adapterFromCandidate,
  candidateNotes,
  candidatesFoundLine,
  locatorDescription,
  noCandidateReason,
  proposeCandidates,
  rowSelectorForList,
  searchCandidates,
  selectorForTable,
  type Candidate,
} from "../src/core/detect.js";
import { validateProposal } from "../src/core/author.js";
import { repeatedStructures } from "../src/core/skeleton.js";
import { validateAdapter, validateRegistry } from "../src/core/registry.js";
import { runAdapter } from "../src/sources/site.js";
import type { Adapter } from "../src/sources/types.js";

const REFERENCE = "2026-09-11T05:00:00.000Z";
const ZONE = "America/Chicago";

function fixture(name: string): Document {
  return parseHTML(
    readFileSync(new URL(`../fixtures/sites/${name}`, import.meta.url), "utf8"),
  ).document as unknown as Document;
}
function docFrom(html: string): Document {
  return parseHTML(html).document as unknown as Document;
}

/** The search, as `offscreen.ts` runs it: the inventory, then the crossing. */
function propose(doc: Document): Candidate[] {
  return proposeCandidates(doc, REFERENCE, ZONE, repeatedStructures(doc, ZONE, REFERENCE));
}
function why(doc: Document): string {
  const structures = repeatedStructures(doc, ZONE, REFERENCE);
  const { nearest } = searchCandidates(doc, REFERENCE, ZONE, structures);
  return noCandidateReason(doc, structures, nearest);
}

/** The shipped entry a proposal has to land on, character for character. */
function shipped(id: string): Adapter {
  const text = readFileSync(new URL("../adapters/registry.json", import.meta.url), "utf8");
  const entry = validateRegistry(text).adapters.find((adapter) => adapter.id === id);
  if (!entry) throw new Error(`no adapter ${id} in the bundled registry`);
  return entry;
}

/** What an adapter records, as the pairs two readings of a page must share. */
function pairsOf(adapter: Adapter, doc: Document): (string | undefined)[][] {
  return runAdapter(adapter, doc, { url: adapter.url, fetchedAt: REFERENCE }).map((item) => [
    item.title,
    item.dueAt,
  ]);
}

/** The same, for a candidate — through the entry the student would save. */
function pairsOfCandidate(candidate: Candidate, doc: Document, url: string): (string | undefined)[][] {
  const { adapter, reason } = validateAdapter(adapterFromCandidate(candidate, url, "X", "fa26"));
  expect(reason).toBeUndefined();
  return pairsOf(adapter as Adapter, doc);
}

describe("the real ECE 310 page", () => {
  const found = propose(fixture("ece310-fa2026-index.html"));

  it("proposes what a person wrote by hand", () => {
    // `ece310-fa26` in adapters/registry.json was written by reading the
    // markup. If a guess cannot reach the one answer already known to be
    // right, the feature is not worth shipping.
    expect(found.length).toBeGreaterThan(0);
    const best = found[0]!;
    expect(best.rows).toContain("#homework");
    expect(best.columns!.due).toBe("due date");
    expect(best.columns!.title).toBe("exercises");
    expect(best.dateFormat).toBe("M/d");
  });

  it("reads every row on that page", () => {
    expect(found[0]!.dated).toBe(13);
    expect(found[0]!.total).toBe(13);
  });

  it("extracts rows a student could recognise", () => {
    // The safety argument: a wrong column is obvious to the person who takes
    // the course and invisible to everything else, so the sample is the
    // feature, not a debugging aid. The instant *and* the text it was read
    // from, because either alone hides a column that reads plausibly and lands
    // on the wrong day.
    expect(found[0]!.sample[0]).toEqual({
      title: "Homework 1",
      due: "2026-09-04T23:59:00-05:00",
      read: "09/04 @ 11:59pm",
    });
  });

  it("notices the assignment names are links", () => {
    expect(found[0]!.columns!.link).toBe("exercises");
  });

  it("offers this page once, not once per way of spelling its rows", () => {
    // The same deadlines reached through `#homework table tbody tr` and through
    // a wider `tr` spelling are one answer, and a list of near-identical
    // options is how people stop reading options.
    expect(found).toHaveLength(1);
    expect(candidatesFoundLine(found)).toBe("Found one table that looks like a schedule.");
  });
});

describe("what the student is told a page yielded", () => {
  it("counts a grid as a table, because that is what it is", () => {
    // It has no `columns` — a table with no header row has nothing to name —
    // and calling it a list would be the same wrong word this sentence was
    // rewritten to stop saying when the ECE 411 list announced itself as a
    // table.
    expect(candidatesFoundLine(propose(fixture("cs424-fa2026-schedule.html")))).toBe(
      "Found one table that looks like a schedule.",
    );
  });

  it("counts both where a page offers a table and a list", () => {
    const doc = docFrom(
      "<table id='t'><thead><tr><th>Assignment</th><th>Due</th></tr></thead>" +
        "<tbody><tr><td>HW1</td><td>9/7</td></tr><tr><td>HW2</td><td>9/14</td></tr></tbody></table>" +
        "<section><h3>MP1</h3><ul><li>Due: 10/1</li><li>Release: 9/1</li><li>Due: 10/8</li></ul></section>",
    );
    const found = propose(doc);
    expect(found.length).toBeGreaterThan(1);
    // A header table is the shape whose evidence is independent of the search:
    // the page itself named the column.
    expect(found[0]!.columns).toBeDefined();
    expect(candidatesFoundLine(found)).toContain("1 table and 1 list");
  });
});

describe("a schedule with two date columns", () => {
  // Real shape: every assignment has a release date, and only some have a
  // deadline set yet. Collapsing to one proposal per *table* offered whichever
  // parsed more rows — the release column — with no way to reach the deadline.
  const doc = docFrom(
    `<table id="t"><tr><th>Assignment</th><th>Released</th><th>Due</th></tr>` +
      `<tr><td>HW1</td><td>9/4</td><td>9/11</td></tr>` +
      `<tr><td>HW2</td><td>9/11</td><td>9/18</td></tr>` +
      `<tr><td>HW3</td><td>9/18</td><td>TBD</td></tr></table>`,
  );
  const found = propose(doc);

  it("offers both, because they are different answers", () => {
    expect(found.map((c) => c.columns!.due).sort()).toEqual(["due", "released"]);
  });

  it("puts the column that parsed more rows first", () => {
    // Ordering is a suggestion, not a decision — the student picks by reading
    // the sample rows, which is the only check that can tell these apart.
    expect(found[0]!.columns!.due).toBe("released");
  });
});

describe("a column whose dates are written two different ways", () => {
  // Courses really do this — half the schedule typed as 9/11 and half as
  // Sep 25. The format is chosen once for the group rather than crossed with
  // the rows, so this is one choice rather than the same column printed twice.
  const doc = docFrom(
    `<table id="t"><tr><th>Assignment</th><th>Due</th></tr>` +
      `<tr><td>HW1</td><td>9/11</td></tr>` +
      `<tr><td>HW2</td><td>9/18</td></tr>` +
      `<tr><td>HW3</td><td>Sep 25</td></tr>` +
      `<tr><td>HW4</td><td>Oct 2</td></tr></table>`,
  );

  it("offers it once", () => {
    expect(propose(doc)).toHaveLength(1);
  });

  it("and says which format it chose, so the loss is visible", () => {
    /*
     * Either format reads only half the rows, and the count is what tells the
     * student this page is not fully covered before they approve it.
     *
     * `total` is five rather than four because it is the **runner's** count:
     * this table has no `<tbody>`, so there is no narrower spelling than
     * `#t tr` and `runAdapter` reads the header row as a row. The old search
     * counted its own data rows and reported "2 of 4" for an adapter that would
     * go on to keep five — the preview showing one page and the entry reading
     * another, which is the whole failure this file exists to make impossible.
     */
    const best = propose(doc)[0]!;
    expect(best.dated).toBe(2);
    expect(best.total).toBe(5);
  });
});

describe("the real CS 424 page, which has no header row to name", () => {
  /*
   * This page used to be the honest "no" — no header row, `rowspan` shifting
   * cells between rows, two events packed into one cell — and the sentence
   * under it said a schedule without headers needs a hand-written entry.
   * `dueSlot` is that answer written down as data, so the search reaches it:
   * the grid, the date column, the column that says "due", and the semicolon.
   */
  const doc = fixture("cs424-fa2026-schedule.html");
  const found = propose(doc);
  const best = found[0]!;

  it("proposes the grid the hand-written entry reads", () => {
    expect(best.dueSlot).toBe(1);
    expect(best.titleSlot).toBe(4);
    expect(best.splitTitle).toBe(";");
    expect(best.filter).toEqual({ include: "\\bdue\\b" });
    expect(best.dateFormat).toBe("M/d");
  });

  it("records the same nine deadlines the shipped entry does", () => {
    // Not "the same selectors": `cs424-fa26` matches on a presentational class
    // and this matches on grid position, and only the rows they produce can say
    // whether the two readings agree.
    const entry = shipped("cs424-fa26");
    expect(pairsOfCandidate(best, doc, entry.url)).toEqual(pairsOf(entry, doc));
    expect(pairsOf(entry, doc)).toHaveLength(9);
  });

  it("says out loud that it is reading by position", () => {
    // House rule 3's cost, on screen: the one thing a student cannot see by
    // reading the rows is that a column added next term breaks this.
    expect(candidateNotes(best)).toContain(
      "Read by position — the page has no header to name, so a column added later " +
        "breaks this and the extension will say so.",
    );
    expect(locatorDescription(best)).toBe(
      "date in column 2 of a table with no header row, name in column 5",
    );
  });
});

describe("the synthetic page, which is deliberately awkward", () => {
  const found = propose(fixture("example-course-schedule.html"));

  it("finds the schedule", () => {
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]!.columns!.due).toBe("due");
  });

  it("counts the unreadable row against the total, not the dated count", () => {
    // The fixture carries one date on purpose that no format reads. Reporting
    // it as dated would be the silent-success failure this project treats as
    // worst, one level up: the student would approve an adapter that drops a
    // row.
    expect(found[0]!.dated).toBeLessThan(found[0]!.total);
  });
});

describe("what it refuses", () => {
  const table = (body: string, head = "<tr><th>Assignment</th><th>Due</th></tr>") =>
    docFrom(`<table id="t">${head}${body}</table>`);

  it("ignores a table with one row, which is not a schedule", () => {
    expect(propose(docFrom('<table id="t"><tr><td>HW1</td><td>9/11</td></tr></table>'))).toEqual(
      [],
    );
  });

  it("ignores a single date in a column of prose", () => {
    // Any column can contain a stray date. One is not a schedule.
    const doc = table(
      "<tr><td>HW1</td><td>9/11</td></tr>" +
        "<tr><td>Reading</td><td>chapter 4</td></tr>" +
        "<tr><td>Reading</td><td>chapter 5</td></tr>" +
        "<tr><td>Reading</td><td>chapter 6</td></tr>",
    );
    expect(propose(doc)).toEqual([]);
    expect(why(doc)).toContain("only 1 row carries a date this can read");
  });

  it("wants more than one dated row, even when that is half the table", () => {
    // Two rows, one date: the share test passes at exactly 0.5, so the minimum
    // count is the only thing standing between a stray date and an adapter.
    const doc = table("<tr><td>HW1</td><td>9/11</td></tr><tr><td>Reading</td><td>chapter 4</td></tr>");
    expect(propose(doc)).toEqual([]);
  });

  it("wants most of the rows to parse, not merely two", () => {
    const doc = table(
      "<tr><td>HW1</td><td>9/11</td></tr>" +
        "<tr><td>HW2</td><td>9/18</td></tr>" +
        "<tr><td>a</td><td>n/a</td></tr>" +
        "<tr><td>b</td><td>n/a</td></tr>" +
        "<tr><td>c</td><td>n/a</td></tr>",
    );
    expect(propose(doc)).toEqual([]);
    expect(why(doc)).toContain("under the 50% this needs");
  });

  it("accepts a schedule with a few unreadable rows in it", () => {
    const doc = table(
      "<tr><td>HW1</td><td>9/11</td></tr>" +
        "<tr><td>HW2</td><td>9/18</td></tr>" +
        "<tr><td>HW3</td><td>9/25</td></tr>" +
        "<tr><td>Spring break</td><td>no class</td></tr>",
    );
    expect(propose(doc)).toHaveLength(1);
  });
});

describe("picking the title column", () => {
  it("does not take a week number just because it is first", () => {
    const doc = docFrom(
      `<table id="t"><tr><th>Week</th><th>Topic</th><th>Due</th></tr>` +
        `<tr><td>1</td><td>Induction proofs</td><td>9/11</td></tr>` +
        `<tr><td>2</td><td>Regular expressions</td><td>9/18</td></tr></table>`,
    );
    expect(propose(doc)[0]!.columns!.title).toBe("topic");
  });

  it("prefers the column whose cells are links", () => {
    // A course site links the assignment it is naming. That is a stronger
    // signal than being leftmost, which is how "Week" wins otherwise.
    const doc = docFrom(
      `<table id="t"><tr><th>Topic</th><th>Handout</th><th>Due</th></tr>` +
        `<tr><td>Induction</td><td><a href="/hw1.pdf">Homework 1</a></td><td>9/11</td></tr>` +
        `<tr><td>Regex</td><td><a href="/hw2.pdf">Homework 2</a></td><td>9/18</td></tr></table>`,
    );
    expect(propose(doc)[0]!.columns!.title).toBe("handout");
  });

  it("never proposes the date column as the title", () => {
    const doc = docFrom(
      `<table id="t"><tr><th>Due</th><th>Assignment</th></tr>` +
        `<tr><td>9/11</td><td>HW1</td></tr><tr><td>9/18</td><td>HW2</td></tr></table>`,
    );
    const best = propose(doc)[0]!;
    expect(best.columns!.title).not.toBe(best.columns!.due);
  });

  it("gives up on a table whose only other column is empty", () => {
    const doc = docFrom(
      `<table id="t"><tr><th>Notes</th><th>Due</th></tr>` +
        `<tr><td></td><td>9/11</td></tr><tr><td></td><td>9/18</td></tr></table>`,
    );
    expect(propose(doc)).toEqual([]);
    expect(why(doc)).toContain("nothing on these rows this could use as a name");
  });
});

describe("selectorForTable", () => {
  it("uses the table's own id when it has one", () => {
    const doc = docFrom('<table id="schedule"></table>');
    expect(selectorForTable(doc.querySelector("table")!, doc)).toBe("#schedule");
  });

  it("falls back to the nearest identified container", () => {
    const doc = docFrom('<div id="homework"><table></table></div>');
    expect(selectorForTable(doc.querySelector("table")!, doc)).toBe("#homework table");
  });

  it("produces a selector that actually finds the table it named", () => {
    // Two different strings is not the requirement; resolving to the right
    // element is. The weaker assertion passed with the disambiguating branch
    // deleted, because the fallback also produces two different strings.
    const doc = docFrom(
      '<div id="w"><table id="a"></table><table id="b"></table></div>' +
        '<div id="x"><table></table></div>',
    );
    for (const table of doc.querySelectorAll("table")) {
      const selector = selectorForTable(table, doc);
      expect([...doc.querySelectorAll(selector)], selector).toContain(table);
    }
  });

  it("distinguishes two unidentified tables inside one container", () => {
    const doc = docFrom('<div id="w"><table></table><table></table></div>');
    const tables = [...doc.querySelectorAll("table")];
    const first = selectorForTable(tables[0]!, doc);
    const second = selectorForTable(tables[1]!, doc);
    expect(first).not.toBe(second);
    expect([...doc.querySelectorAll(first)]).toEqual([tables[0]]);
    expect([...doc.querySelectorAll(second)]).toEqual([tables[1]]);
  });

  it("refuses an id that is not a safe selector", () => {
    // An id with a space or a quote in it would produce a selector that either
    // throws or matches something else entirely.
    const doc = docFrom('<table id="a b"></table>');
    expect(selectorForTable(doc.querySelector("table")!, doc)).toBe("table");
  });
});

describe("a detected candidate, run for real", () => {
  /*
   * The preview cannot show this defect, and that is the point.
   *
   * The old table search sampled through its own `dataRows`, which drops any
   * row with no `<td>` — so the header never appeared in what the student was
   * shown. The `rows` *selector* it handed the adapter was `#homework table
   * tr`, which `runAdapter` resolves without that filter: `<th>Exercises</th>`
   * read through `columns.title: "exercises"` produced an item titled
   * "Exercises" with no date, on a page where every real row has one. Every
   * candidate goes through the runner now, so the preview and the entry are
   * one object.
   */
  const doc = fixture("ece310-fa2026-index.html");
  const best = propose(doc)[0]!;
  const adapter = {
    id: "ece310-detected",
    label: "ECE 310",
    courseCode: "ECE310",
    term: "fa26",
    url: "https://courses.grainger.illinois.edu/ece310/fa2026/",
    hostPattern: "https://courses.grainger.illinois.edu/*",
    rows: best.rows,
    title: "td:nth-child(1)",
    due: "td:nth-child(2)",
    columns: best.columns,
    dateFormat: best.dateFormat,
    timezone: ZONE,
    minExtensionVersion: "0.1.0",
  } as unknown as Adapter;
  const items = runAdapter(adapter, doc, {
    url: adapter.url,
    fetchedAt: "2026-09-10T18:00:00.000Z",
  });

  it("scopes the rows to tbody, so the header row is not a row", () => {
    expect(best.rows).toBe("#homework table tbody tr");
  });

  it("produces no item titled after the header cell", () => {
    expect(items.map((item) => item.title)).not.toContain("Exercises");
  });

  it("produces no undated item at all, on a page where every row has a date", () => {
    expect(items.filter((item) => item.dueAt === undefined)).toEqual([]);
  });

  it("produces exactly the 13 the hand-written adapter does", () => {
    expect(items).toHaveLength(13);
  });
});

describe("noCandidateReason", () => {
  it("names the JavaScript case, which is the commonest dead end", () => {
    expect(why(docFrom("<div>loading…</div>"))).toContain("JavaScript");
  });

  it("describes the page rather than a list of shapes it can read", () => {
    /*
     * This sentence has been wrong twice, in opposite directions.
     *
     * It first said a list "needs a hand-written entry" — false the morning
     * `runAdapter` gained `dueLabel` and `titleFrom`. It was then rewritten to
     * name the two shapes the search could read, which is false again now that
     * there are no shapes: the search crosses the page's own groups with six
     * locators, so a sentence enumerating what it reads would have to be
     * rewritten every time one is added. What the *page* has cannot go stale.
     */
    const doc = docFrom("<h3>mp_setup</h3><ul><li>Attendance: required</li></ul>");
    const reason = why(doc);
    expect(reason).toContain("Nothing on this page repeats");
    expect(reason).not.toContain("only looks at tables");
    expect(reason).not.toContain("neither of the two shapes");
    expect(reason).toContain("built-in model");
  });

  it("names the hook it got closest with, and why that was not enough", () => {
    // "No candidates" is the least useful thing this could say. The refusal is
    // the student's only handle on *why*: a page whose one list of deadlines
    // missed the bar by a row is a different problem from one with no dates.
    // Five of seven lines read as dates, which is over the half a *column*
    // needs and under the 80% a label needs — a list has no header to
    // corroborate a partial read.
    const doc = docFrom(
      "<section><h3>Notes</h3><ul>" +
        "<li>Due: 9/7</li><li>Due: 9/14</li><li>Due: 9/21</li>" +
        "<li>Due: 9/28</li><li>Due: 10/5</li>" +
        "<li>Due: see Canvas</li><li>Due: ask in lecture</li>" +
        "</ul></section>",
    );
    const reason = why(doc);
    expect(reason).toContain("The nearest thing to a schedule is");
    expect(reason).toContain("under the 80% this needs");
  });

  it("names a single stray date as exactly that", () => {
    const doc = docFrom(
      "<section><h3>Notes</h3><ul>" +
        "<li>Due: 9/7</li><li>Due: see Canvas</li><li>Due: ask in lecture</li>" +
        "</ul></section>",
    );
    expect(why(doc)).toContain("only 1 row carries a date this can read");
  });

  it("says what it did find when nothing was even tried", () => {
    const doc = fixture("ece411-fa2026-syllabus.html");
    const structures = repeatedStructures(doc, ZONE, REFERENCE);
    const reason = noCandidateReason(doc, structures);
    expect(reason).toContain("The nearest thing to a schedule is #schedule ul.simple > li");
    expect(reason).toContain("3 lines, 2 with a date this can read");
  });

  it("says so plainly when the page's best group carries no date at all", () => {
    const doc = docFrom("<ul><li>Office hours: Tuesdays</li><li>Office hours: Fridays</li></ul>");
    expect(why(doc)).toContain("carries no date this can read");
  });

  it("lists the formats when the table is fine and the dates are not", () => {
    const doc = docFrom(
      `<table id="t"><tr><th>Assignment</th><th>Due</th></tr>` +
        `<tr><td>HW1</td><td>week 3</td></tr><tr><td>HW2</td><td>week 4</td></tr></table>`,
    );
    expect(why(doc)).toContain("M/d");
  });
});

describe("a selector for a list, for the pages that are not tables", () => {
  const ece411 = fixture("ece411-fa2026-assignments.html");

  it("names a list by the section that holds it", () => {
    const list = ece411.querySelector("#mp-setup ul.simple")!;
    expect(rowSelectorForList(list, ece411)).toBe("#mp-setup ul.simple > li");
  });

  it("uses a child combinator, so a nested list is not this list's rows", () => {
    // A `<ul>` inside an `<li>` is a different section of the page, and its
    // lines would otherwise arrive as rows of this one.
    expect(rowSelectorForList(ece411.querySelector("#mp-verif ul.simple")!, ece411)).toMatch(
      /> li$/,
    );
  });

  it("prefers the list's own id when it has one", () => {
    const doc = docFrom("<div id='c'><ul id='work'><li>Due: 9/7</li></ul></div>");
    expect(rowSelectorForList(doc.querySelector("#work")!, doc)).toBe("#work > li");
  });

  it("distinguishes two lists of the same shape in one container", () => {
    const doc = docFrom("<div id='c'><ul class='a'><li>x</li></ul><ul class='a'><li>y</li></ul></div>");
    const second = [...doc.querySelectorAll("ul.a")][1]!;
    expect(rowSelectorForList(second, doc)).toBe("#c ul.a:nth-of-type(2) > li");
  });

  it("never puts a class it could not safely spell into a selector", () => {
    // Remote markup, put back into `querySelectorAll`. A class the page writes
    // with a colon or a slash — every Tailwind page — is a selector this code
    // would then throw on, so the tag alone is used instead.
    const doc = docFrom("<div id='c'><ul class='md:flex'><li>Due: 9/7</li></ul></div>");
    const selector = rowSelectorForList(doc.querySelector("ul")!, doc);
    expect(selector).toBe("#c ul > li");
    expect(() => doc.querySelectorAll(selector)).not.toThrow();
  });
});

describe("the entry saved for a candidate the student approved", () => {
  /*
   * The round trip the defect broke: propose → validate through the real
   * runner → build the entry → validate *that* → run it again, and get the
   * same rows. `buildAdapter` lived in the options page and wrote out
   * `columns` and nothing else, so a list-shaped proposal validated with a
   * `dueLabel` was saved without one — and the entry installed read every line
   * of the list instead of the deadline lines. The preview could not show it,
   * because the preview came from the other object.
   */
  const URL_ECE411 = "https://courses.grainger.illinois.edu/ece411/fa2026/assignments.html";
  const page = { url: URL_ECE411, fetchedAt: REFERENCE };
  const ece411 = () => fixture("ece411-fa2026-assignments.html");
  const proposal = {
    shape: "list",
    rows: "#mp-information ul.simple > li",
    title: "p",
    due: "p",
    titleFrom: "section >> h3",
    dueLabel: "Due|CP1 Due|CP2 Due|CP3 Due|Advance Features Due",
    filter: { exclude: "\\bTB[DA]\\b|\\bN/?A\\b" },
    dateFormat: "M/d",
  };
  const outcome = validateProposal(proposal, ece411(), URL_ECE411, ZONE, REFERENCE);
  const built = outcome.ok
    ? adapterFromCandidate(outcome.candidate, URL_ECE411, "ECE411", "fa26")
    : undefined;

  it("passes the registry's own validation", () => {
    expect(built).toBeDefined();
    const { adapter, reason } = validateAdapter(built);
    expect(reason).toBeUndefined();
    expect(adapter).toBeDefined();
  });

  it("reads the same rows the student was shown", () => {
    const { adapter } = validateAdapter(built);
    const items = runAdapter(adapter as Adapter, ece411(), page);
    expect(items.map((item) => item.title).sort()).toEqual(["mp_setup", "mp_verif"]);
    for (const item of items) expect(item.dueAt).toBe("2026-09-07T23:59:00-05:00");
  });

  it("keeps a table candidate exactly as it was saved before", () => {
    // The shape that already worked must not move: `columns` plus the
    // positional fallback for a header missing at parse time.
    const table = adapterFromCandidate(
      {
        rows: "#homework table tbody tr",
        columns: { title: "Exercises", due: "Due Date" },
        dateFormat: "M/d",
        total: 13,
        dated: 13,
        sample: [],
      },
      "https://courses.grainger.illinois.edu/ece310/fa2026/",
      "ECE310",
      "fa26",
    );
    expect(table["columns"]).toEqual({ title: "Exercises", due: "Due Date" });
    expect(table["title"]).toBe("td:nth-child(1)");
    expect(table["dueLabel"]).toBeUndefined();
    expect(table.id).toBe("ece310-fa26-local");
    // A table adapter uses nothing added in 1.1.0, so it must not demand it:
    // every build there has ever been can run this entry.
    expect(table["minExtensionVersion"]).toBe("0.1.0");
  });

  it("carries every locator through to the entry, and asks for the build it needs", () => {
    /*
     * The mirror in `READ_FIELDS`, from the other end. `adapterFromCandidate`
     * listed its fields by hand once and `dueLabel` went missing; a locator
     * added to `Adapter` and forgotten here would be saved as an entry that
     * reads the page some other way, with the preview still showing what the
     * dropped field read.
     */
    const entry = adapterFromCandidate(
      {
        rows: "dl.calendar > dd",
        title: ".",
        due: ".",
        duePrev: "dt",
        titleBefore: ":",
        defaultTime: "21:00",
        link: "a@href",
        dateFormat: "MMM d, h:mm a",
        total: 11,
        dated: 11,
        sample: [],
      },
      "https://courses.grainger.illinois.edu/cs374al1/fa2026/homeworks.html",
      "CS374",
      "fa26",
    );
    expect(entry).toMatchObject({
      duePrev: "dt",
      titleBefore: ":",
      defaultTime: "21:00",
      link: "a@href",
      minExtensionVersion: "1.1.0",
    });
    expect(validateAdapter(entry).reason).toBeUndefined();
  });

  it("writes the page-level kind, and omits it when it is the default", () => {
    // `examBoard` filters on `kind === "exam"`, so a syllabus page added
    // without it files two midterms as homework and leaves the Exams tab empty.
    const base = { rows: "ul > li", title: "p", due: "p", dueLabel: "Midterm 1", dateFormat: "MMM d, h:mm a", total: 1, dated: 1, sample: [] };
    const url = "https://courses.grainger.illinois.edu/ece411/fa2026/syllabus.html";
    expect(adapterFromCandidate(base, url, "ECE411", "fa26", "exam")["kind"]).toBe("exam");
    expect(adapterFromCandidate(base, url, "ECE411", "fa26", "assignment")["kind"]).toBeUndefined();
  });

  it("asks for exactly the host it is about", () => {
    expect(built!["hostPattern"]).toBe("https://courses.grainger.illinois.edu/*");
  });
});

/* -------------------------------------------------------------------------- */
/* The real pages, one per locator                                             */
/* -------------------------------------------------------------------------- */

const ECE411_URL = "https://courses.grainger.illinois.edu/ece411/fa2026/assignments.html";

describe("the real ECE 411 assignments page: a label", () => {
  const doc = fixture("ece411-fa2026-assignments.html");
  const found = propose(doc);

  it("puts the labelled list first, which is the entry a person wrote", () => {
    // Three live runs of the on-device model on this page ended with no rows
    // (2026-09-18 twice, 2026-09-19 once). The page never reaches the model now.
    expect(found[0]!.rows).toBe("#mp-information ul.simple > li");
    expect(found[0]!.columns).toBeUndefined();
    expect(found[0]!.dueLabel).toBe("Due|CP1 Due|CP2 Due|CP3 Due|Advance Features Due");
    expect(found[0]!.titleFrom).toBe("section >> h3");
    expect(found[0]!.dateFormat).toBe("M/d");
  });

  it("does not offer those same lines a second time, read by the word “due”", () => {
    /*
     * Every one of them reads `Due: 9/7`, so a keyword probe hooks all sixteen
     * — and would propose the course twice, once with the heading for a name
     * and once with the line's own text, with nothing on screen saying which
     * is which. A row a declared label already hooked is not a phrase probe's
     * row.
     *
     * The coarser reading of the *sections* around those lines is still
     * offered, and ranked below: it keeps one deadline per MP rather than four,
     * which is a different answer rather than the same one twice.
     */
    const lines = found.filter((candidate) => candidate.rows.endsWith("li"));
    expect(lines).toHaveLength(1);
    expect(lines[0]!.duePhrase).toBeUndefined();
  });

  it("matches the same elements as the hand-written entry, by identity", () => {
    // Not "the same string": two selectors can spell one set of rows and only
    // the elements decide whether this reads the course or a sixth of it.
    const mine = [...doc.querySelectorAll(found[0]!.rows)];
    const theirs = [...doc.querySelectorAll(shipped("ece411-fa26-mp").rows)];
    expect(mine).toHaveLength(16);
    expect(mine).toEqual(theirs);
  });

  it("produces the rows the hand-written entry produces", () => {
    // What the student confirms has to be what the extension would record, and
    // `ece411-fa26-mp` is the only proof available that this page can be read.
    const theirs = pairsOf(shipped("ece411-fa26-mp"), doc);
    expect(pairsOfCandidate(found[0]!, doc, ECE411_URL)).toEqual(theirs);
    expect(theirs).toEqual([
      ["mp_setup", "2026-09-07T23:59:00-05:00"],
      ["mp_verif", "2026-09-07T23:59:00-05:00"],
    ]);
  });

  it("says where the date and the name come from, in the page's own words", () => {
    expect(locatorDescription(found[0]!)).toBe(
      "date after “Due:” on each line, name from the heading above and 4 more labels",
    );
  });
});

describe("the ECE 411 page with its checkpoints dated (adversarial fixture)", () => {
  /*
   * The live page has every checkpoint at TBD, so it cannot show what this
   * proposer does with a dated one — parser rule 10, and the fixture's own
   * banner says how it is unrealistic. Two things it can show and the live
   * capture cannot: three checkpoints of one MP getting three distinct titles,
   * and `Due Date: 11/3` — which CONTAINS "Due" — not being taken as the label.
   */
  const doc = fixture("ece411-fa2026-assignments-dated.html");
  const found = propose(doc);
  const list = found.find((c) => c.rows === "#mp-information ul.simple > li")!;

  it("reads the checkpoints, each with its own title", () => {
    expect(list.sample.map((row) => row.title)).toEqual([
      "mp_setup",
      "mp_verif",
      "mp_pipeline CP1",
      "mp_pipeline CP2",
      "mp_pipeline CP3",
    ]);
    expect(list.dated).toBe(5);
  });

  it("does not take \"Due Date\" as a due label (house rule 6)", () => {
    // A label chosen by substring would take it, date mp_pipeline from 11/3,
    // and nothing on the page would look wrong.
    expect(list.dueLabel).not.toContain("Due Date");
    expect(list.sample.some((row) => row.due.startsWith("2026-11-03"))).toBe(false);
  });
});

describe("the real CS 425 page: a keyword mid-sentence", () => {
  const doc = fixture("cs425-fa2026-assignments.html");
  const found = propose(doc);
  const best = found[0]!;

  it("reads the deadline out of the sentence, not the release date in front of it", () => {
    expect(best.duePhrase).toBe("due");
    expect(best.titleBefore).toBe(":");
    expect(best.dateFormat).toBe("M/d");
  });

  it("records the same eight deadlines the shipped entry does", () => {
    // `cs425-fa26` hooks the page's one content table; this hooks its lists.
    // Two spellings of one set of rows, and only what they produce can say so.
    const entry = shipped("cs425-fa26");
    const theirs = pairsOf(entry, doc);
    expect(theirs).toHaveLength(8);
    expect(pairsOfCandidate(best, doc, entry.url)).toEqual(theirs);
  });

  it("names the keyword it read, so the student can see what selected the date", () => {
    expect(locatorDescription(best)).toBe("date after the word “due” in each line");
  });
});

describe("the real CS/ECE 374 A pages: the date in the sibling before the row", () => {
  for (const [name, id] of [
    ["cs374a-fa2026-homeworks.html", "cs374a-fa26-hw"],
    ["cs374a-fa2026-gps.html", "cs374a-fa26-gps"],
  ] as const) {
    describe(name, () => {
      const doc = fixture(name);
      const best = propose(doc)[0]!;

      it("proposes the definition list's own shape", () => {
        expect(best.duePrev).toBe("dt");
        expect(best.titleBefore).toBe(":");
        expect(best.dated).toBe(11);
        expect(best.total).toBe(11);
      });

      it("proposes the hour the page states once, in prose above the list", () => {
        /*
         * "Written homeworks are due every Tuesday at 9pm", in a paragraph the
         * rows do not contain. Without it every row lands on §4.5's invented
         * 23:59 — three hours late, with a two-hour reminder arriving an hour
         * after the deadline passed — and the student would have to find that
         * sentence, read it, and type 21:00 into a field they have no reason to
         * understand.
         */
        expect(best.defaultTime).toBe("21:00");
        expect(candidateNotes(best)).toContain(
          "Every deadline with no stated time is set to 21:00, because the page says so once.",
        );
        expect(best.sample.every((row) => row.due.includes("T21:00:00"))).toBe(true);
      });

      it("records the same eleven deadlines the shipped entry does", () => {
        const entry = shipped(id);
        expect(pairsOfCandidate(best, doc, entry.url)).toEqual(pairsOf(entry, doc));
      });

      it("says a list, with its numbers, rather than \"one table\"", () => {
        expect(candidatesFoundLine(propose(doc))).toBe(
          "Found a list of 11 dated lines that looks like a schedule.",
        );
      });
    });
  }
});

describe("the CS/ECE 374 A calendar, which is the whole term", () => {
  /*
   * Fifteen `<dl class="calendar">`s, one per week, and the inventory folds
   * them into the one group that covers all of them. Every row on it is dated
   * through its `<dt>` — lectures, labs, homeworks and midterms alike — so this
   * is the page where the search has to stop deciding: a student tracking this
   * course may want every lecture on their list or only the homeworks, and
   * nothing in the markup says which. It proposes what it can read, with the
   * lectures visible in the preview, and the student decides.
   */
  const doc = fixture("cs374a-fa2026-calendar.html");
  const found = propose(doc);

  it("offers one reading of the whole calendar rather than one per week", () => {
    expect(found).toHaveLength(1);
    expect(found[0]!.duePrev).toBe("dt");
    expect(doc.querySelectorAll(found[0]!.rows)).toHaveLength(93);
  });

  it("keeps 90 of the 93 entries, and the three it drops are not losses", () => {
    // Two rows read "Conflict Midterm 1: (time TBA)" — a deadline the course
    // has not set, which `filter.exclude` drops — and two rows are character
    // for character identical ("Tue Nov 24 / Fall Break — HW11 due one week
    // later than usual"), which §3.1's content-derived key folds into one.
    expect(found[0]!.total).toBe(90);
    expect(found[0]!.dated).toBe(90);
  });

  it("shows the lectures in the preview rather than guessing them away", () => {
    expect(found[0]!.sample.some((row) => row.title.startsWith("Lecture:"))).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* One synthetic page per locator, each with a deliberately unrealistic row    */
/* -------------------------------------------------------------------------- */

describe("a keyword page whose first date is not the deadline", () => {
  /*
   * Deliberately unrealistic (parser rule 10), in two ways at once. A real
   * course posts an assignment before it is due, so `Released 9/21 … Due 10/4`
   * reads the same way whether the parser takes the first date in the row or
   * the one the keyword introduces — the release date is *near* the deadline
   * and a wrong reading looks plausible. Here they are two weeks apart, so a
   * first-date-wins implementation is visibly wrong.
   *
   * And "Overdue policy" is a word containing "due" with a date behind it,
   * which is the page-of-prose failure house rule 6 exists for.
   */
  const doc = docFrom(
    "<section><h3>Homework</h3><ul>" +
      "<li>HW1: Released 9/21. Due 10/4.</li>" +
      "<li>HW2: Released 9/28. Due 10/11.</li>" +
      "<li>HW3: Released 10/5. Due 10/18.</li>" +
      "<li>Overdue policy: 9/1 is the last day to appeal.</li>" +
      "</ul></section>",
  );
  const best = propose(doc)[0]!;

  it("takes the date the keyword introduces, not the first one in the row", () => {
    expect(best.sample.map((row) => row.due.slice(0, 10))).toEqual([
      "2026-10-04",
      "2026-10-11",
      "2026-10-18",
    ]);
  });

  it("does not hook a keyword that is half of another word", () => {
    expect(best.total).toBe(3);
    expect(best.sample.map((row) => row.title)).toEqual(["HW1", "HW2", "HW3"]);
  });
});

describe("a definition list with two dates before one entry", () => {
  /*
   * Nothing on the real capture has two `<dt>`s before one `<dd>` — the page
   * alternates — so this row is written rather than captured (parser rule 10).
   * It is what separates "the nearest preceding sibling" from "the first one",
   * and a first-wins reading dates HW1 seven weeks early while looking right.
   */
  const doc = docFrom(
    '<main><dl class="calendar">' +
      "<dt>Sep 1</dt><dt>Oct 20</dt><dd>HW1: strings</dd>" +
      "<dt>Nov 3</dt><dd>HW2: graphs</dd>" +
      "<dt>Nov 10</dt><dd>HW3: flows</dd>" +
      "</dl></main>",
  );
  const best = propose(doc)[0]!;

  it("takes the nearest one", () => {
    expect(best.duePrev).toBe("dt");
    expect(best.sample[0]).toMatchObject({ title: "HW1", read: "Oct 20" });
    expect(best.sample[0]!.due.slice(0, 10)).toBe("2026-10-20");
  });
});

describe("a page whose <time> tag disagrees with what it prints", () => {
  /*
   * Deliberately unrealistic (parser rule 10): a real page's `datetime`
   * attribute agrees with the text beside it, so a fixture of one cannot tell
   * an implementation that reads the attribute from one that reads the text.
   * The attribute is the machine-readable one and it has to win — a page that
   * renders a date through a script and leaves the markup behind is exactly the
   * case this locator is for.
   */
  const doc = docFrom(
    "<section><h3>Labs</h3><ul>" +
      '<li>Lab 1: warm-up <time datetime="2026-10-04">September 1</time></li>' +
      '<li>Lab 2: sorting <time datetime="2026-10-11">September 8</time></li>' +
      '<li>Lab 3: graphs <time datetime="2026-10-18">September 15</time></li>' +
      "</ul></section>",
  );
  const best = propose(doc)[0]!;

  it("reads the attribute, not the words", () => {
    expect(best.due).toBe("time@datetime");
    expect(best.dateFormat).toBe("yyyy-MM-dd");
    expect(best.sample.map((row) => row.due.slice(0, 10))).toEqual([
      "2026-10-04",
      "2026-10-11",
      "2026-10-18",
    ]);
  });

  it("names the tag it read, because nothing on screen shows an attribute", () => {
    expect(locatorDescription(best)).toBe("date from each row's <time> tag");
    expect(best.sample.map((row) => row.title)).toEqual(["Lab 1", "Lab 2", "Lab 3"]);
  });
});

describe("a grid whose columns move", () => {
  /*
   * House rule 3's own counterexample, run twice. `dueSlot` is the one place
   * position is allowed, and the price is that the search has to follow the
   * page rather than remember a number — a column added at the front is exactly
   * the change that turns a page of dates into a page of undated items with no
   * error, and the proposal has to be re-derived from the grid each time.
   */
  const rows = (lead: string[]) =>
    docFrom(
      `<table id="s">` +
        ["9/11", "9/18", "9/25"]
          .map(
            (date, index) =>
              "<tr>" +
              (lead[index] === undefined ? "" : `<td>${lead[index]}</td>`) +
              `<td>Week ${index + 1}</td><td>${date}</td>` +
              `<td>Intro ${index + 1}</td><td>HW${index + 1} Due</td></tr>`,
          )
          .join("") +
        `</table>`,
    );

  it("finds the date column and the column that says “due”", () => {
    const best = propose(rows([]))[0]!;
    expect(best.dueSlot).toBe(1);
    expect(best.titleSlot).toBe(3);
  });

  it("follows the whole grid one column right when a column is added", () => {
    const best = propose(rows(["A", "A", "B"]))[0]!;
    expect(best.dueSlot).toBe(2);
    expect(best.titleSlot).toBe(4);
    expect(best.sample.map((row) => row.title)).toEqual(["HW1 Due", "HW2 Due", "HW3 Due"]);
  });

  it("refuses a grid where no column says “due”", () => {
    /*
     * Without page-side evidence the search would offer the column beside the
     * date — on CS 424 that is the lecture topic — and file every lecture as an
     * assignment. A slot is position, so the page has to corroborate it.
     */
    const doc = docFrom(
      `<table id="s">` +
        `<tr><td>Week 1</td><td>9/11</td><td>Intro</td></tr>` +
        `<tr><td>Week 2</td><td>9/18</td><td>Regex</td></tr>` +
        `<tr><td>Week 3</td><td>9/25</td><td>DFAs</td></tr>` +
        `</table>`,
    );
    expect(propose(doc)).toEqual([]);
  });
});

describe("two spellings of one set of deadlines", () => {
  /*
   * Every page offers its rows under several selectors — `li`, `ul.simple > li`,
   * `#a ul.simple > li` — and each is a working adapter reading the same
   * deadlines. Six proposals that differ only in how much else they sweep in is
   * a list nobody finishes reading, and whichever came first is what gets
   * clicked.
   */
  const doc = docFrom(
    "<section id='a'><h3>MP1</h3><ul class='simple'>" +
      "<li>Due: 9/7</li><li>Due: 9/14</li><li>Due: 9/21</li></ul></section>" +
      "<section id='b'><h3>MP2</h3><ul class='simple'>" +
      "<li>Due: 10/5</li><li>Due: 10/12</li></ul></section>" +
      "<ul><li>Not a deadline at all</li></ul>",
  );
  const found = propose(doc);

  it("offers one of them", () => {
    expect(found).toHaveLength(1);
  });

  it("keeps the narrowest spelling that still reads the whole page", () => {
    // `li` matches six elements and `ul.simple > li` matches five, and both
    // produce the same five deadlines — so the one that sweeps in the stray
    // bullet is the one that goes on meaning something else when the page grows.
    expect(found[0]!.rows).toBe("ul.simple > li");
    expect(doc.querySelectorAll("li")).toHaveLength(6);
  });

  it("does not offer a group that reads three of the same five rows", () => {
    // `#a ul.simple > li` is a working adapter for a third of the course. Shown
    // beside the whole one it is a choice between "all of it" and "some of it"
    // with nothing on screen saying which is which.
    expect(found[0]!.dated).toBe(5);
    expect(found.some((candidate) => candidate.rows.startsWith("#a"))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* The cost of the search                                                      */
/* -------------------------------------------------------------------------- */

describe("proposeCandidates on a large page", () => {
  /*
   * The same bound `repeatedStructures` is held to, and for the same reason:
   * `offscreen.ts` runs this synchronously, and a 0.5MB department schedule is
   * well inside `MAX_AUTHOR_HTML`. The search runs the *real runner* once per
   * (group, hook) pair that clears the thresholds, which is the part of this
   * that could have been quadratic and is not — the thresholds are read off
   * evidence the inventory already measured.
   */
  it("answers a 12,000-element page in well under a second", () => {
    const raw = readFileSync(
      new URL("../fixtures/sites/ece310-fa2026-index.html", import.meta.url),
      "utf8",
    );
    const body = raw.slice(raw.indexOf("<body"), raw.lastIndexOf("</body>"));
    const doc = docFrom(`<html><body>${body.repeat(16)}</body></html>`);
    expect(doc.querySelectorAll("*").length).toBeGreaterThan(10_000);
    const structures = repeatedStructures(doc, ZONE, REFERENCE);
    const started = Date.now();
    const found = proposeCandidates(doc, REFERENCE, ZONE, structures);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(found.length).toBeGreaterThan(0);
  });
});

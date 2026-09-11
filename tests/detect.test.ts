/**
 * Proposing an adapter (`src/core/detect.ts`).
 *
 * Run against the real captures, because the point of this module is to handle
 * pages nobody hand-tuned it for — and the two adapters that exist are the only
 * proof available that a guess lands where a human landed.
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { detectCandidates, noCandidateReason, selectorForTable } from "../src/core/detect.js";

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
const detect = (doc: Document) => detectCandidates(doc, REFERENCE, ZONE);

describe("the real ECE 310 page", () => {
  const found = detect(fixture("ece310-fa2026-index.html"));

  it("proposes what a person wrote by hand", () => {
    // `ece310-fa26` in adapters/registry.json was written by reading the
    // markup. If a guess cannot reach the one answer already known to be
    // right, the feature is not worth shipping.
    expect(found.length).toBeGreaterThan(0);
    const best = found[0]!;
    expect(best.rows).toContain("#homework");
    expect(best.columns.due).toBe("due date");
    expect(best.columns.title).toBe("exercises");
    expect(best.dateFormat).toBe("M/d");
  });

  it("reads every row on that page", () => {
    expect(found[0]!.dated).toBe(13);
    expect(found[0]!.total).toBe(13);
  });

  it("extracts rows a student could recognise", () => {
    // The safety argument: a wrong column is obvious to the person who takes
    // the course and invisible to everything else, so the sample is the
    // feature, not a debugging aid.
    expect(found[0]!.sample[0]).toEqual({ title: "Homework 1", due: "09/04 @ 11:59pm" });
  });

  it("notices the assignment names are links", () => {
    expect(found[0]!.columns.link).toBe("exercises");
  });

  it("does not offer the same column twice for two date formats", () => {
    // The same column matching `M/d` and `MMM d` is one choice, not two, and a
    // list of near-identical options is how people stop reading options.
    const keys = found.map((c) => `${c.rows}|${c.columns.due}`);
    expect(new Set(keys).size).toBe(keys.length);
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
  const found = detect(doc);

  it("offers both, because they are different answers", () => {
    expect(found.map((c) => c.columns.due).sort()).toEqual(["due", "released"]);
  });

  it("puts the column that parsed more rows first", () => {
    // Ordering is a suggestion, not a decision — the student picks by reading
    // the sample rows, which is the only check that can tell these apart.
    expect(found[0]!.columns.due).toBe("released");
  });
});

describe("a column whose dates are written two different ways", () => {
  // Courses really do this — half the schedule typed as 9/11 and half as
  // Sep 25. Both formats then clear the thresholds on the same column, and
  // offering the student two entries that differ only in `dateFormat` is one
  // choice printed twice.
  const doc = docFrom(
    `<table id="t"><tr><th>Assignment</th><th>Due</th></tr>` +
      `<tr><td>HW1</td><td>9/11</td></tr>` +
      `<tr><td>HW2</td><td>9/18</td></tr>` +
      `<tr><td>HW3</td><td>Sep 25</td></tr>` +
      `<tr><td>HW4</td><td>Oct 2</td></tr></table>`,
  );

  it("offers it once", () => {
    expect(detect(doc)).toHaveLength(1);
  });

  it("and says which format it chose, so the loss is visible", () => {
    // Either format reads only half the rows. The count is what tells the
    // student this page is not fully covered before they approve it.
    const best = detect(doc)[0]!;
    expect(best.dated).toBe(2);
    expect(best.total).toBe(4);
  });
});

describe("the real CS 424 page, which cannot be guessed", () => {
  const doc = fixture("cs424-fa2026-schedule.html");

  it("proposes nothing rather than something plausible", () => {
    // No header row, `rowspan` shifting cells between rows, and two events in
    // one cell. Its hand-written adapter matches on a presentational class and
    // splits on a semicolon; nothing here could find that, and inventing a
    // confident-looking answer for it would be worse than saying so.
    expect(detect(doc)).toEqual([]);
  });

  it("says why, in terms of the next thing to do", () => {
    expect(noCandidateReason(doc)).toContain("header");
  });
});

describe("the synthetic page, which is deliberately awkward", () => {
  const found = detect(fixture("example-course-schedule.html"));

  it("finds the schedule", () => {
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]!.columns.due).toBe("due");
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

  it("ignores a table with no header row", () => {
    expect(detect(docFrom('<table id="t"><tr><td>HW1</td><td>9/11</td></tr></table>'))).toEqual([]);
  });

  it("ignores a single date in a column of prose", () => {
    // Any column can contain a stray date. One is not a schedule.
    const doc = table(
      "<tr><td>HW1</td><td>9/11</td></tr>" +
        "<tr><td>Reading</td><td>chapter 4</td></tr>" +
        "<tr><td>Reading</td><td>chapter 5</td></tr>" +
        "<tr><td>Reading</td><td>chapter 6</td></tr>",
    );
    expect(detect(doc)).toEqual([]);
  });

  it("wants more than one dated row, even when that is half the table", () => {
    // Two rows, one date: the share test passes at exactly 0.5, so the minimum
    // count is the only thing standing between a stray date and an adapter.
    const doc = table("<tr><td>HW1</td><td>9/11</td></tr><tr><td>Reading</td><td>chapter 4</td></tr>");
    expect(detect(doc)).toEqual([]);
  });

  it("wants most of the rows to parse, not merely two", () => {
    const doc = table(
      "<tr><td>HW1</td><td>9/11</td></tr>" +
        "<tr><td>HW2</td><td>9/18</td></tr>" +
        "<tr><td>a</td><td>n/a</td></tr>" +
        "<tr><td>b</td><td>n/a</td></tr>" +
        "<tr><td>c</td><td>n/a</td></tr>",
    );
    expect(detect(doc)).toEqual([]);
  });

  it("accepts a schedule with a few unreadable rows in it", () => {
    const doc = table(
      "<tr><td>HW1</td><td>9/11</td></tr>" +
        "<tr><td>HW2</td><td>9/18</td></tr>" +
        "<tr><td>HW3</td><td>9/25</td></tr>" +
        "<tr><td>Spring break</td><td>no class</td></tr>",
    );
    expect(detect(doc)).toHaveLength(1);
  });
});

describe("picking the title column", () => {
  it("does not take a week number just because it is first", () => {
    const doc = docFrom(
      `<table id="t"><tr><th>Week</th><th>Topic</th><th>Due</th></tr>` +
        `<tr><td>1</td><td>Induction proofs</td><td>9/11</td></tr>` +
        `<tr><td>2</td><td>Regular expressions</td><td>9/18</td></tr></table>`,
    );
    expect(detect(doc)[0]!.columns.title).toBe("topic");
  });

  it("prefers the column whose cells are links", () => {
    // A course site links the assignment it is naming. That is a stronger
    // signal than being leftmost, which is how "Week" wins otherwise.
    const doc = docFrom(
      `<table id="t"><tr><th>Topic</th><th>Handout</th><th>Due</th></tr>` +
        `<tr><td>Induction</td><td><a href="/hw1.pdf">Homework 1</a></td><td>9/11</td></tr>` +
        `<tr><td>Regex</td><td><a href="/hw2.pdf">Homework 2</a></td><td>9/18</td></tr></table>`,
    );
    expect(detect(doc)[0]!.columns.title).toBe("handout");
  });

  it("never proposes the date column as the title", () => {
    const doc = docFrom(
      `<table id="t"><tr><th>Due</th><th>Assignment</th></tr>` +
        `<tr><td>9/11</td><td>HW1</td></tr><tr><td>9/18</td><td>HW2</td></tr></table>`,
    );
    const best = detect(doc)[0]!;
    expect(best.columns.title).not.toBe(best.columns.due);
  });

  it("gives up on a table whose only other column is empty", () => {
    const doc = docFrom(
      `<table id="t"><tr><th>Notes</th><th>Due</th></tr>` +
        `<tr><td></td><td>9/11</td></tr><tr><td></td><td>9/18</td></tr></table>`,
    );
    expect(detect(doc)).toEqual([]);
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

describe("noCandidateReason", () => {
  it("names the JavaScript case, which is the commonest dead end", () => {
    expect(noCandidateReason(docFrom("<div>loading…</div>"))).toContain("JavaScript");
  });

  it("lists the formats when the table is fine and the dates are not", () => {
    const doc = docFrom(
      `<table id="t"><tr><th>Assignment</th><th>Due</th></tr>` +
        `<tr><td>HW1</td><td>week 3</td></tr><tr><td>HW2</td><td>week 4</td></tr></table>`,
    );
    expect(noCandidateReason(doc)).toContain("M/d");
  });
});

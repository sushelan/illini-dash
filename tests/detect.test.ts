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
import {
  adapterFromCandidate,
  detectCandidates,
  noCandidateReason,
  rowSelectorForList,
  selectorForTable,
} from "../src/core/detect.js";
import { validateProposal } from "../src/core/author.js";
import { validateAdapter } from "../src/core/registry.js";
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

describe("a detected candidate, run for real", () => {
  /*
   * The preview cannot show this defect, and that is the point.
   *
   * `detectCandidates` samples through `dataRows`, which drops any row with no
   * `<td>` — so the header never appeared in what the student was shown. The
   * `rows` *selector* it handed the adapter was `#homework table tr`,
   * which `runAdapter` resolves without that filter: `<th>Exercises</th>` read
   * through `columns.title: "exercises"` produced an item titled "Exercises"
   * with no date, on a page where every real row has one. Only running the
   * proposal through the runner reaches it.
   */
  const doc = fixture("ece310-fa2026-index.html");
  const best = detect(doc)[0]!;
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
    expect(noCandidateReason(docFrom("<div>loading…</div>"))).toContain("JavaScript");
  });

  it("says a list can be read, because it can", () => {
    /*
     * The sentence used to end "or it is a list rather than a table — those
     * need a hand-written entry", and it was the only thing on screen after
     * Sushi pasted ECE 411's assignments page. Two things were wrong with it by
     * then: `runAdapter` had gained `dueLabel` and `titleFrom` that morning, so
     * a list *is* readable; and the model branch that could propose one had
     * just run, invisibly, immediately underneath it.
     */
    const reason = noCandidateReason(docFrom("<h3>mp_setup</h3><ul><li>Due: 9/7</li></ul>"));
    expect(reason).toContain("list rather than a table");
    expect(reason).toContain("can be read");
    expect(reason).toContain("built-in model");
    expect(reason).not.toContain("those need a hand-written entry");
  });

  it("lists the formats when the table is fine and the dates are not", () => {
    const doc = docFrom(
      `<table id="t"><tr><th>Assignment</th><th>Due</th></tr>` +
        `<tr><td>HW1</td><td>week 3</td></tr><tr><td>HW2</td><td>week 4</td></tr></table>`,
    );
    expect(noCandidateReason(doc)).toContain("M/d");
  });
});

describe("a selector for a list, for the pages that are not tables", () => {
  // The search itself never proposes one — it crosses a table's columns with
  // the date formats and that is all it does. `skeleton.ts` prints these so the
  // model has a working `rows` selector to name rather than one to invent.
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

/**
 * Rendering a page small enough to show a model (`src/core/skeleton.ts`).
 *
 * Run against the two real captures, because the thing that can go wrong here
 * is invisible on a hand-written fixture: a summary that fits the budget by
 * throwing away the schedule still looks like a summary, and the failure only
 * shows up as a model answering confidently about a table it never saw.
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { skeletonise } from "../src/core/skeleton.js";
import { ParseError } from "../src/sources/types.js";

function fixture(name: string): Document {
  return parseHTML(readFileSync(new URL(`../fixtures/sites/${name}`, import.meta.url), "utf8"))
    .document as unknown as Document;
}
function docFrom(html: string): Document {
  return parseHTML(html).document as unknown as Document;
}

/** What the Prompt API's ~9,216-token window leaves for the page. */
const REALISTIC = 30_000;

describe("the real ECE 310 page", () => {
  const doc = fixture("ece310-fa2026-index.html");
  const raw = readFileSync(
    new URL("../fixtures/sites/ece310-fa2026-index.html", import.meta.url),
    "utf8",
  );

  it("is a fraction of the markup it came from", () => {
    const text = skeletonise(doc, REALISTIC);
    // 33KB of markup down to about 13KB, which is what is left once the
    // stylesheets, the nav and the honour-code prose are gone and every content
    // table is still there in full.
    expect(raw.length).toBeGreaterThan(30_000);
    expect(text.length).toBeLessThan(raw.length / 2);
  });

  it("names the homework table by the selector the runner would use", () => {
    // The hand-written `ece310-fa26` entry carries
    // `#homework table.timetable tbody tr`. A summary that does not put a
    // working selector in front of the model is asking it to invent one — and
    // `tbody` is not decoration: `#homework table tr` also matches the header
    // row, which comes back as an undated assignment called "Exercises".
    const text = skeletonise(doc, REALISTIC);
    expect(text).toContain("rows selector: #homework table tbody tr");
  });

  it("keeps the header row, which is the only thing a column can be named by", () => {
    const text = skeletonise(doc, REALISTIC);
    expect(text).toContain("TH | Exercises | Due Date | Solution");
    expect(text).toContain("09/04 @ 11:59pm");
  });

  it("drops the stylesheets and the navigation", () => {
    const text = skeletonise(doc, REALISTIC);
    // 17 empty <style> blocks and a <nav> whose anchors repeat every section
    // heading on the page. Neither is something a selector for a deadline could
    // want, and the nav's copy of the headings is the more expensive of the two.
    expect(text).not.toContain("<style");
    // Each nav entry is its own <li>, so it would arrive as its own outline
    // line rather than as one run of text — which is how dropping NAV from the
    // list survived a check for the whole menu in one string.
    expect(text).not.toMatch(/^li: Teaching Staff$/m);
    expect(text).not.toMatch(/^li: Syllabus$/m);
  });

  it("names a container that holds a table without reprinting the table", () => {
    // `div#homework` is a handle a selector can use. Its `textContent` is the
    // whole schedule again, unstructured — a second copy for the model to quote
    // a date out of, in a prompt whose entire rule is "selectors, never values".
    const text = skeletonise(doc, REALISTIC);
    expect(text).toMatch(/^div#homework$/m);
    expect(text).not.toContain("div#homework: VII. Homework Material");
  });
});

describe("the budget", () => {
  const doc = fixture("ece310-fa2026-index.html");

  it("holds exactly, at every size", () => {
    for (const budget of [500, 900, 1500, 2500, 4000, 8000]) {
      expect(skeletonise(doc, budget).length).toBeLessThanOrEqual(budget);
    }
  });

  it("leaves the schedule table in when the page does not fit", () => {
    // ECE 310 renders to ~6,000 characters in full and keeps its homework
    // table *last*, after the staff tables, two timetables and an 18-week
    // syllabus. Truncating in document order would spend the budget on office
    // hours and drop the one table with deadlines in it, so each table gets its
    // own share of the budget rather than whatever the earlier ones left.
    const full = skeletonise(doc, 20_000);
    const cut = skeletonise(doc, 4000);
    expect(full.length).toBeGreaterThan(4000);
    expect(cut.length).toBeLessThanOrEqual(4000);
    expect(cut).toContain("rows selector: #homework table tbody tr");
    expect(cut).toContain("TH | Exercises | Due Date | Solution");
    expect(cut).toContain("09/04 @ 11:59pm");
  });

  it("says how many rows it dropped rather than pretending the table is short", () => {
    // A model shown four rows of a forty-row table and not told so proposes a
    // selector for a fragment. House rule 2's shape: a silent truncation reads
    // as a complete page.
    const cut = skeletonise(doc, 2500);
    expect(cut).toMatch(/… \d+ of \d+ rows shown/);
  });

  it("refuses a budget too small to hold a header and a row", () => {
    expect(() => skeletonise(doc, 120)).toThrow(/below the 400 minimum/);
  });
});

describe("the real CS 424 page", () => {
  // The page `detect.ts` cannot read: no header row, `rowspan` shifting cells
  // between rows, two events in one cell. That is precisely the page the model
  // branch exists for, so the summary has to carry the things that defeat the
  // deterministic proposer rather than smooth them away.
  const doc = fixture("cs424-fa2026-schedule.html");

  it("fits, and keeps the schedule", () => {
    const text = skeletonise(doc, REALISTIC);
    expect(text.length).toBeLessThanOrEqual(REALISTIC);
    expect(text).toContain("HW/MP");
    expect(text).toContain("HW1 Due; HW2 is Out");
  });

  it("marks the spanned cells that make the grid shift", () => {
    expect(skeletonise(doc, REALISTIC)).toContain("[span");
  });

  it("marks cells that link somewhere", () => {
    expect(skeletonise(doc, REALISTIC)).toContain("[link]");
  });
});

describe("what it refuses to summarise", () => {
  it("throws on a document with no elements rather than returning nothing", () => {
    // House rule 2 one level out: "" reads to the caller as "this page has no
    // structure", and the model would then answer about a page it was never
    // shown — confidently, because nothing in the prompt says otherwise.
    expect(() => skeletonise(docFrom(""), 4000)).toThrow(ParseError);
  });

  it("summarises a page with no table at all", () => {
    const text = skeletonise(
      docFrom("<h1>CS 999</h1><ul id='work'><li>MP1 due Friday</li></ul>"),
      4000,
    );
    expect(text).toContain("h1: CS 999");
    expect(text).toContain("MP1 due Friday");
  });

  it("puts a cell's id and classes where a selector could name them", () => {
    const text = skeletonise(
      docFrom("<div id='sched'><table class='grid'><tr><th>Due</th></tr><tr><td>9/4</td></tr></table></div>"),
      4000,
    );
    expect(text).toContain("TABLE table.grid");
    expect(text).toContain("rows selector: #sched table tr"); // no tbody in this markup
  });

  it("truncates one enormous cell instead of spending the page on it", () => {
    const text = skeletonise(
      docFrom(`<table><tr><th>Notes</th></tr><tr><td>${"x".repeat(5000)}</td></tr></table>`),
      4000,
    );
    expect(text.length).toBeLessThanOrEqual(4000);
    expect(text).not.toContain("x".repeat(200));
  });
});

/* -------------------------------------------------------------------------- */
/* The third page shape: `label: value` bullets under a heading                 */
/* -------------------------------------------------------------------------- */

describe("the real ECE 411 page, which has no table on it at all", () => {
  // The page Sushi pasted into "Add a course site" and got "No table on this
  // page" back from. Every deadline on it is an `<li>` reading `Due: 9/7` under
  // an `<h3>`, and a summary that prints those as loose outline lines gives the
  // model no `rows` selector to name and no sign that the heading above them is
  // where `titleFrom` points — so the one page the search cannot read was also
  // the one the model was structurally unable to answer about.
  const doc = fixture("ece411-fa2026-assignments.html");
  const text = skeletonise(doc, REALISTIC);

  it("keeps a section, its heading and its first lines together", () => {
    expect(text).toContain("rows selector: #mp-setup ul.simple > li");
    expect(text).toContain("heading: h3 mp_setup");
    expect(text).toContain("LI | Release: 8/25");
    expect(text).toContain("LI | Due: 9/7");
  });

  it("prints the titleFrom spec, which no selector on the row can reach", () => {
    // `section >> h3` is exactly what the shipped `ece411-fa26-mp` entry
    // carries. A model asked to invent that syntax from a flat outline invents
    // something else.
    expect(text).toContain("titleFrom: section >> h3");
  });

  it("offers the selector that reads every MP, not just the one section", () => {
    // The nearest handle to `mp_setup`'s list is `#mp-setup`, and an adapter
    // built on it silently covers a sixth of the course. `#mp-information
    // ul.simple > li` is what the hand-written entry uses.
    expect(text).toContain("every list like it: #mp-information ul.simple > li (5 lists)");
  });

  it("does not reprint a rendered list's lines in the outline underneath", () => {
    // The same rule that keeps `div#homework` from reprinting its table: a
    // second copy of the schedule is a second place for the model to read a
    // date out of, in a prompt whose whole rule is "selectors, never values".
    expect(text.match(/Release: 8\/25/g)).toHaveLength(2); // mp_setup and mp_verif, once each
  });

  it("holds the budget with lists in it, at every size", () => {
    for (const budget of [500, 900, 1500, 2500, 4000, 8000]) {
      expect(skeletonise(doc, budget).length).toBeLessThanOrEqual(budget);
    }
  });

  it("keeps the dated section when the page does not fit", () => {
    const cut = skeletonise(doc, 1500);
    expect(cut).toContain("rows selector: #mp-setup ul.simple > li");
    expect(cut).toContain("LI | Due: 9/7");
  });
});

describe("the ECE 411 syllabus, where the exams live", () => {
  const text = skeletonise(fixture("ece411-fa2026-syllabus.html"), REALISTIC);

  it("keeps the exam bullets and the clock that sits beside them", () => {
    // "Midterm 1: September 29" states no time; "Time: 7-9PM" is in the same
    // bullet's sub-list, and `time: "ul"` is what puts the exam at 19:00
    // instead of an invented 23:59.
    expect(text).toContain("rows selector: #schedule ul.simple > li");
    expect(text).toContain("Midterm 1: September 29");
    expect(text).toContain("Time: 7-9PM");
  });
});

describe("which lists are worth a share of the budget", () => {
  const listed = (html: string) => skeletonise(docFrom(html), 4000);

  it("offers a labelled list under a heading", () => {
    const text = listed(
      "<section id='hw'><h3>MP1</h3><ul><li>Release: 8/25</li><li>Due: 9/7</li></ul></section>",
    );
    expect(text).toContain("LIST ul");
    expect(text).toContain("rows selector: #hw ul > li");
  });

  it("ignores a list whose lines state no date", () => {
    // ECE 310's "Recommended Textbook: Applied Digital Signal Processing:
    // Theory and Practice" is a labelled list under a heading, and a share of
    // the structure budget spent on it is rows of the homework table dropped.
    const text = listed(
      "<section id='r'><h3>Books</h3><ul><li>Textbook: Oppenheim</li><li>Also: Proakis</li></ul></section>",
    );
    expect(text).not.toContain("LIST ul");
  });

  it("ignores a list with nothing above it to take a name from", () => {
    // A row in a list has no title of its own. With no heading, `runAdapter`
    // could only title every row "Due: 9/7".
    const text = listed("<div><ul><li>Due: 9/7</li><li>Due: 9/14</li></ul></div>");
    expect(text).not.toContain("LIST ul");
  });

  it("ignores prose that happens to contain a colon", () => {
    const text = listed(
      "<section id='p'><h3>Policy</h3><ul>" +
        "<li>Work handed in after 9/7 is worth less: the autograder stops accepting it</li>" +
        "<li>Nothing here is a deadline</li></ul></section>",
    );
    expect(text).not.toContain("LIST ul");
  });

  it("does not claim a nav menu as a schedule", () => {
    const text = listed(
      "<nav><h3>Navigation</h3><ul><li>Previous: 9/7 lecture</li><li>Next: 9/9 lecture</li></ul></nav>" +
        "<h1>CS 999</h1>",
    );
    expect(text).not.toContain("LIST ul");
  });
});

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
import {
  MAX_SKETCH_CHARS,
  renderStructures,
  repeatedStructures,
  skeletonise,
} from "../src/core/skeleton.js";
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
    // The inventory's spelling of those same two rows, because the enum is what
    // the model is allowed to answer with: `#sched tr` and `#sched table tr`
    // match the same elements and `repeatedStructures` keeps the shorter one.
    // (No tbody in this markup, so the header row is one of the rows.)
    expect(text).toContain("rows selector: #sched tr");
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
    // `#mp-setup li` rather than `#mp-setup ul.simple > li`: the same two
    // bullets, in the spelling the inventory offers and the schema's enum
    // accepts. A summary line the constrained decode cannot emit is a line the
    // model is invited to copy and then forbidden from answering with.
    expect(text).toContain("rows selector: #mp-setup li");
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
    expect(cut).toContain("rows selector: #mp-setup li");
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
    expect(text).toContain("rows selector: #hw li");
  });

  it("names this block's own rows, not every bullet on the page", () => {
    /*
     * The inventory's spelling has to be the *narrowest* entry covering the
     * block, not merely one that covers it. A bare `li` here matches the
     * reading list too, and it is a perfectly answerable selector — so
     * printing it as this block's `rows` would hand the model a line that is
     * in the enum, sits above the deadlines, and reads the wrong rows.
     */
    const text = listed(
      "<section id='hw'><h3>MP1</h3><ul><li>Release: 8/25</li><li>Due: 9/7</li></ul></section>" +
        "<section id='reading'><h3>Reading</h3><ul><li>chapter one</li><li>chapter two</li>" +
        "<li>chapter three</li></ul></section>",
    );
    expect(text).toContain("rows selector: #hw li");
    expect(text).not.toMatch(/^ {2}rows selector: (ul > )?li$/m);
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

/* -------------------------------------------------------------------------- */
/* The inventory                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What the page has, as the model is told it.
 *
 * The invented-selector defect this was written for is a live one, from
 * 2026-09-18: asked about ECE 411, Chrome's built-in model answered
 * `#schedule .event` three times. Nothing on that page carries either name.
 * These tests are about the one property that makes the list worth putting in
 * a prompt — **every selector in it matches, on this document, the count it
 * claims** — and about the cap not throwing the answer away.
 */
describe("the repeated structures a page offers", () => {
  const PAGES = [
    "ece310-fa2026-index.html",
    "ece411-fa2026-assignments.html",
    "ece411-fa2026-syllabus.html",
  ];

  for (const name of PAGES) {
    it(`only offers selectors that really match, on ${name}`, () => {
      const doc = fixture(name);
      const structures = repeatedStructures(doc);
      expect(structures.length).toBeGreaterThan(0);
      for (const structure of structures) {
        // The invariant the schema's `enum` and the grounding check both rest
        // on. A single entry that matched nothing would put the model straight
        // back where it started, with this file's blessing.
        expect(doc.querySelectorAll(structure.selector)).toHaveLength(structure.count);
        expect(structure.count).toBeGreaterThanOrEqual(2);
      }
      expect(structures.length).toBeLessThanOrEqual(12);
    });
  }

  it("offers the group the shipped ECE 411 entry reads, by element and not by spelling", () => {
    // `adapters/registry.json`'s `ece411-fa26-mp` uses
    // `#mp-information ul.simple > li`. What matters is that some entry reaches
    // the same sixteen `<li>`s — `#mp-information li` would be as good an
    // answer and is three words shorter, so a string comparison here would pin
    // the spelling rather than the requirement.
    const doc = fixture("ece411-fa2026-assignments.html");
    const shipped = [...doc.querySelectorAll("#mp-information ul.simple > li")];
    expect(shipped.length).toBeGreaterThan(1);
    const same = repeatedStructures(doc).filter((structure) => {
      const matched = [...doc.querySelectorAll(structure.selector)];
      return (
        matched.length === shipped.length && matched.every((element, i) => element === shipped[i])
      );
    });
    expect(same).not.toEqual([]);
  });

  it("offers the group the shipped ECE 310 entry reads", () => {
    const doc = fixture("ece310-fa2026-index.html");
    const shipped = [...doc.querySelectorAll("#homework table tbody tr")];
    const same = repeatedStructures(doc).filter((structure) => {
      const matched = [...doc.querySelectorAll(structure.selector)];
      return (
        matched.length === shipped.length && matched.every((element, i) => element === shipped[i])
      );
    });
    expect(same).not.toEqual([]);
  });

  it("ranks the groups that read like rows above the ones that do not", () => {
    // The cap is twelve and a page has dozens of repeated groups, so the order
    // *is* the filter. Ordering by selector length alone was measured on these
    // two captures and cut `#mp-information ul.simple > li` and
    // `#homework table tbody tr` — both answers — in favour of `#mp-setup li`
    // and `#staff td`.
    const structures = repeatedStructures(fixture("ece411-fa2026-assignments.html"));
    const firstOther = structures.findIndex((structure) => !structure.rowLike);
    if (firstOther >= 0) {
      expect(structures.slice(firstOther).some((structure) => structure.rowLike)).toBe(false);
    }
    expect(structures[0]!.rowLike).toBe(true);
  });

  it("does not offer a nav menu as a schedule", () => {
    const doc = docFrom(
      "<nav><ul><li>Previous: 9/7 lecture</li><li>Next: 9/9 lecture</li></ul></nav><h1>CS 999</h1>",
    );
    expect(repeatedStructures(doc)).toEqual([]);
  });

  it("never offers a group with one foot in the nav", () => {
    // The dangerous case is not a page that is all nav — it is a page where a
    // document-wide selector sweeps the nav's bullets in with the schedule's.
    // `ul > li` here would be four items, two of them the site menu, and an
    // adapter saved from it puts "Previous: 9/7 lecture" in a student's week.
    const doc = docFrom(
      "<nav><ul><li>Previous: 9/7 lecture</li><li>Next: 9/9 lecture</li></ul></nav>" +
        "<section id='hw'><h2>Homework</h2><ul><li>HW1: 9/7</li><li>HW2: 9/14</li></ul></section>",
    );
    const structures = repeatedStructures(doc);
    expect(structures).not.toEqual([]);
    for (const structure of structures) {
      for (const element of doc.querySelectorAll(structure.selector)) {
        expect(element.closest("nav")).toBeNull();
      }
    }
  });

  it("does not call one element a repeated structure", () => {
    // A page with a single bullet has nothing to propose `rows` against, and an
    // entry of one is how "this needs a hand-written entry" turns into a
    // proposal a student is asked to confirm.
    const doc = docFrom("<h1>CS 999</h1><section id='hw'><h2>HW</h2><ul><li>Due: 9/7</li></ul></section>");
    expect(repeatedStructures(doc).filter((structure) => structure.count < 2)).toEqual([]);
  });

  it("offers one spelling per group of elements, not three", () => {
    // `#mp-setup li`, `#mp-setup ul.simple > li` and `#mp-information ul.simple
    // > li:nth-of-type(-)` can all reach the same bullets. The cap is twelve, so
    // three spellings of one answer is two answers the model never sees.
    const doc = fixture("ece411-fa2026-assignments.html");
    const seen = new Set<string>();
    for (const structure of repeatedStructures(doc)) {
      const key = [...doc.querySelectorAll(structure.selector)]
        .map((element) => [...doc.querySelectorAll("*")].indexOf(element))
        .join(",");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("does not offer a table's rows plus its header row", () => {
    /*
     * `#homework tr` ×14 used to sit directly above `#homework table tbody tr`
     * ×13 in this list, and the sort is rowLike → count → length, so being one
     * element larger ranked the wrong spelling first on every table on every
     * page: `#staff tr` ×55 over ×39, `#syllabus tr` ×36 over ×34. It is the
     * selector `detect.ts` documents as a defect — "an undated item literally
     * titled *Exercises*, with the words 'Due Date' where its date should be" —
     * offered back to the model as a first-class choice, and the rejection it
     * earned named the row rather than the header.
     */
    const doc = fixture("ece310-fa2026-index.html");
    const offered = repeatedStructures(doc).map((structure) => structure.selector);
    expect(offered).toContain("#homework table tbody tr");
    for (const selector of ["#homework tr", "#staff tr", "#syllabus tr"]) {
      expect(offered).not.toContain(selector);
    }
  });

  it("says nothing at all for a page with nothing repeated", () => {
    // Not one made-up entry, and not a sentence claiming there is a list:
    // `author.ts` reads the empty case as "this page may need a hand-written
    // entry", and an invented group would send a student to confirm rows that
    // cannot exist.
    const doc = docFrom("<h1>CS 999</h1><p>Deadlines are announced in lecture.</p>");
    expect(repeatedStructures(doc)).toEqual([]);
    expect(renderStructures([])).toBe("");
  });

  it("prints the count and a sample, so a nav can be told from a schedule", () => {
    const doc = fixture("ece411-fa2026-assignments.html");
    const text = renderStructures(repeatedStructures(doc));
    expect(text).toContain("REPEATED STRUCTURES ON THIS PAGE");
    for (const structure of repeatedStructures(doc)) {
      expect(text).toContain(`${structure.selector}  ×${structure.count}`);
    }
    expect(text).toContain('"Release: 8/25"');
  });
});

/*
 * One inventory, two readers (wave-8 trace, the split author finding).
 *
 * `renderTable` and `renderList` printed a `rows selector:` for every block
 * they drew while `proposalSchema` closes `rows` over the inventory, and the
 * two lists were built by different code. The model was shown "rows selector:
 * X" directly above the block holding the deadlines, told "rows must be one of
 * the REPEATED STRUCTURES lines, character for character", and then forbidden
 * by the constrained decode from answering X — two spellings of one decision
 * (mutation rule 3). On ECE 411 the printed `#mp-setup ul.simple > li`
 * validates and previews 2 rows, so an unconstrained answer saves an adapter
 * reading a sixth of the course.
 */
describe("the summary's rows selectors and the inventory", () => {
  for (const name of [
    "ece310-fa2026-index.html",
    "ece411-fa2026-assignments.html",
    "cs424-fa2026-schedule.html",
  ]) {
    it(`prints no rows selector the schema forbids (${name})`, () => {
      const doc = fixture(name);
      const structures = repeatedStructures(doc);
      const text = skeletonise(doc, REALISTIC, structures);
      const printed = [...text.matchAll(/^ {2}rows selector: (.+)$/gm)].map((match) => match[1]!);
      const offered = new Set(structures.map((structure) => structure.selector));
      expect(printed.length).toBeGreaterThan(0);
      for (const selector of printed) expect(offered.has(selector)).toBe(true);
    });
  }
});

/*
 * The inventory is bounded, and so is the work it costs (wave-8 trace, #33).
 *
 * `repeatedStructures` ran a fresh `querySelectorAll` (plus `droppedAncestor`
 * and `textContent` over every match) per candidate group, and
 * `proposeWithModel` calls it synchronously on the options page's main thread —
 * so a 0.5MB department schedule, well inside `MAX_AUTHOR_HTML`, froze every
 * control on the page for seconds with no cancel. Measured: 518KB took 7.6s
 * under linkedom and 2.7s in Chrome, for 2,177 `consider` calls covering 15
 * distinct selector strings.
 */
describe("repeatedStructures on a large page", () => {
  /** The real capture's body, repeated — 16× is 518KB, a department schedule. */
  function repeated(times: number): Document {
    const raw = readFileSync(
      new URL("../fixtures/sites/ece310-fa2026-index.html", import.meta.url),
      "utf8",
    );
    const body = raw.slice(raw.indexOf("<body"), raw.lastIndexOf("</body>"));
    return docFrom(`<html><body>${body.repeat(times)}</body></html>`);
  }

  it("answers a 12,000-element page in well under a second", () => {
    const doc = repeated(16);
    expect(doc.querySelectorAll("*").length).toBeGreaterThan(10_000);
    const started = Date.now();
    const structures = repeatedStructures(doc);
    const took = Date.now() - started;
    // 10.1s before the memo on this machine, 337ms after, and it is the options
    // page's main thread that pays it — every other control frozen behind
    // "Asking the on-device model…", with no cancel.
    expect(took).toBeLessThan(2_000);
    expect(structures.length).toBeGreaterThan(0);
  });

  it("answers a 5,000-element page of repeated blocks", () => {
    const rows = Array.from(
      { length: 1250 },
      (_, i) =>
        `<div class="assignment"><span>HW${i}</span>` +
        `<span>9/${(i % 28) + 1}</span><a href="#">link</a></div>`,
    ).join("");
    const doc = docFrom(`<html><body><div id="schedule">${rows}</div></body></html>`);
    expect(doc.querySelectorAll("*").length).toBeGreaterThan(5_000);
    const started = Date.now();
    const structures = repeatedStructures(doc);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(structures.some((structure) => structure.selector.includes("div.assignment"))).toBe(
      true,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* What one row is made of                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The inventory said *which* groups a page has and nothing about what is inside
 * one — while `title` and `due` are selectors relative to one row. On ECE 411,
 * 2026-09-18, the model answered three times with no `title` at all; with the
 * schema fixed it has to name one, and `sketch` is where the right answer is
 * printed. `sample` cannot serve: it is a row's flattened text, which says
 * nothing about the `<p>` the text is in.
 */
describe("the row sketch", () => {
  it("names the tags and classes inside one row, deduplicated", () => {
    const doc = docFrom(
      `<ul id="s">
         <li><strong>MP1</strong><p>Due: 9/7</p><p>Release: 8/25</p> and a note</li>
         <li><strong>MP2</strong><p>Due: 9/14</p><p>Release: 9/1</p> and a note</li>
       </ul>`,
    );
    const structure = repeatedStructures(doc).find((s) => s.selector === "#s > li");
    // Three `<p>`s are one answer to "what is in here", and the budget is not
    // spent saying it three times; `text` is last, and it is what says that
    // `""` — the row's own text — is an option for `title`.
    expect(structure?.sketch).toBe("strong, p, text");
  });

  it("says nothing but the tags when the row has no text of its own", () => {
    const doc = docFrom(
      `<ul id="s"><li><span class="name">MP1</span></li><li><span class="name">MP2</span></li></ul>`,
    );
    const structure = repeatedStructures(doc).find((s) => s.selector === "#s > li");
    expect(structure?.sketch).toBe("span.name");
  });

  it("is 'text' for a row that is only text, which is itself the answer", () => {
    // It says `title: ""` — the row's own text — is what to answer for this
    // group, which is the one case the structures list could not express.
    const doc = docFrom(`<ul id="s"><li>9/4</li><li>9/11</li></ul>`);
    const structure = repeatedStructures(doc).find((s) => s.selector === "#s > li");
    expect(structure?.sketch).toBe("text");
  });

  it("is bounded by the number of parts it names", () => {
    const children = Array.from({ length: 30 }, (_, i) => `<span class="c${i}">x</span>`).join("");
    const doc = docFrom(`<ul id="s"><li>${children}</li><li>${children}</li></ul>`);
    const structure = repeatedStructures(doc).find((s) => s.selector === "#s > li");
    expect(structure!.sketch.length).toBeLessThanOrEqual(MAX_SKETCH_CHARS);
    expect(structure!.sketch.split(", ")).toHaveLength(6);
  });

  it("is bounded by characters too, which the part count alone does not do", () => {
    /*
     * Six parts of a normal class name fit inside the cap, so the clip is
     * unreachable through the test above — mutating it away survived, which is
     * mutation rule 2's "the adversarial input never reached the line". One
     * deliberately absurd class name is what reaches it, and the cap matters
     * because this line is in the first prompt and in every retry.
     */
    const long = `<span class="${"x".repeat(300)}">MP1</span>`;
    const doc = docFrom(`<ul id="s"><li>${long}</li><li>${long}</li></ul>`);
    const structure = repeatedStructures(doc).find((s) => s.selector === "#s > li");
    expect(structure!.sketch.length).toBeLessThanOrEqual(MAX_SKETCH_CHARS);
    expect(structure!.sketch.endsWith("\u2026")).toBe(true);
  });

  it("is printed for every structure the model is offered", () => {
    const doc = fixture("ece411-fa2026-assignments.html");
    const text = renderStructures(repeatedStructures(doc));
    for (const structure of repeatedStructures(doc)) {
      expect(structure.sketch).not.toBe("");
      expect(text).toContain(
        `${structure.selector}  ×${structure.count}  inside one row: ${structure.sketch}`,
      );
    }
  });

  it("reaches the rendered line, so the model sees it beside the selector", () => {
    const doc = docFrom(`<ul id="s"><li>9/4</li><li>9/11</li></ul>`);
    expect(renderStructures(repeatedStructures(doc))).toContain("#s > li  ×2  inside one row: text");
  });
});

/**
 * Asking a model for an adapter, and refusing to believe it
 * (`src/core/author.ts`).
 *
 * No model is involved anywhere in this file. `authorAdapter` takes its prompt
 * function as an argument precisely so the loop — ask, reject, feed the reason
 * back, accept — runs against recorded strings: the thing worth pinning is what
 * this code *does with an answer*, and a real model would make that
 * nondeterministic without testing any more of it.
 *
 * The proposals below are what a small model plausibly returns for the ECE 310
 * capture, including the wrong ones. The right one is the entry a person wrote
 * by hand in `adapters/registry.json`.
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import {
  authorAdapter,
  buildPrompt,
  htmlForAuthoring,
  MAX_AUTHOR_HTML,
  modelStatusLine,
  proposalSchema,
  skeletonBudgetChars,
  validateProposal,
} from "../src/core/author.js";
import { skeletonise } from "../src/core/skeleton.js";
import { supportedDateFormats } from "../src/sources/site.js";

const URL_ECE310 = "https://courses.grainger.illinois.edu/ece310/fa2026/";
const REFERENCE = "2026-09-11T05:00:00.000Z";
const ZONE = "America/Chicago";

function fixture(name: string): Document {
  return parseHTML(readFileSync(new URL(`../fixtures/sites/${name}`, import.meta.url), "utf8"))
    .document as unknown as Document;
}
const ece310 = () => fixture("ece310-fa2026-index.html");

/** What a model that read the ECE 310 page correctly answers. */
const GOOD = {
  // The model says which of the three shapes it saw. ECE 310 is a header
  // table, and saying so is what lets the validator refuse a proposal that
  // mixes a table's `columns` with a list's `dueLabel` — half of one answer and
  // half of another, of which `runAdapter` would read one half and the saved
  // entry would carry both.
  shape: "table",
  // `tbody tr`, not `table tr`: the header row read through a `columns.title`
  // of "Exercises" yields a row titled "Exercises" dated "Due Date" — an
  // undated assignment no course ever set. The hand-written `ece310-fa26`
  // entry scopes it the same way.
  rows: "#homework table tbody tr",
  columns: { title: "Exercises", due: "Due Date", link: "Exercises" },
  dateFormat: "M/d",
};

const check = (proposal: unknown, doc = ece310()) =>
  validateProposal(proposal, doc, URL_ECE310, ZONE, REFERENCE);

describe("the schema the model is constrained to", () => {
  const schema = proposalSchema() as {
    required: string[];
    additionalProperties: boolean;
    properties: Record<string, { enum?: string[] }>;
  };

  it("asks for exactly the fields the runner reads, and no others", () => {
    // Three fields every shape needs. Which of the rest are required is decided
    // per shape by `validateProposal`, because three branching sub-schemas make
    // a small model answer worse and a rejection costs one attempt.
    expect(schema.required.sort()).toEqual(["dateFormat", "rows", "shape"]);
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties).sort()).toEqual([
      "columns",
      "dateFormat",
      "due",
      "dueLabel",
      "filter",
      "kind",
      "rows",
      "shape",
      "time",
      "title",
      "titleFrom",
    ]);
  });

  it("offers the three shapes runAdapter can read, and no fourth", () => {
    expect(schema.properties["shape"]!.enum).toEqual(["table", "list", "rows"]);
  });

  it("closes kind over what the registry accepts", () => {
    // `examBoard` filters on `kind === "exam"`, so this is remote-ish data that
    // decides which surface an item lands on. `validateAdapter` is what
    // actually refuses a bad one; the enum is so the model rarely tries.
    expect(schema.properties["kind"]!.enum).toEqual([
      "assignment",
      "exam",
      "quiz",
      "event",
      "other",
    ]);
  });

  it("closes dateFormat over what site.ts actually supports", () => {
    // The closed set is why a bad adapter can produce a wrong selector but
    // never arbitrary matching behaviour, and the one untrusted author in the
    // project is not the place to make an exception.
    expect(schema.properties["dateFormat"]!.enum).toEqual(supportedDateFormats());
  });
});

describe("the prompt", () => {
  const { system, user } = buildPrompt("PAGE TITLE: ECE 310", URL_ECE310);

  it("asks for headers, never for a positional cell", () => {
    // House rule 3: `cells[2]` turns one added column into a page of mis-dated
    // items with no error. Banning it everywhere and then asking a model for it
    // would be perverse.
    expect(system).toContain("header text of");
    expect(system).toContain("Never answer with a positional selector");
  });

  it("forbids the model from reporting a date it read", () => {
    // Worker rule 3, one process over: a date the model read would be a value
    // this code invented, ranked above a real Canvas deadline by §5.3 and
    // impossible to audit. It names columns; `parseAdapterDate` reads them.
    expect(system).toContain("Never answer with a date");
  });

  it("carries the page and the address it came from", () => {
    expect(user).toContain(URL_ECE310);
    expect(user).toContain("PAGE TITLE: ECE 310");
  });
});

describe("the context budget", () => {
  it("reserves output room out of the window the model reports", () => {
    // 9,216 tokens shared with the output; ~16% held back, ~4 chars a token.
    expect(skeletonBudgetChars(9216, 0)).toBe(Math.floor(9216 * 0.84 * 4));
  });

  it("subtracts the prompt's own text, which is inside the same window", () => {
    expect(skeletonBudgetChars(9216, 2000)).toBe(skeletonBudgetChars(9216, 0) - 2000);
  });

  it("never returns a negative budget for a tiny window", () => {
    expect(skeletonBudgetChars(10, 5000)).toBe(0);
    expect(skeletonBudgetChars(Number.NaN, 0)).toBe(0);
  });
});

describe("a proposal that is right", () => {
  const outcome = check(GOOD);

  it("comes back as a candidate the existing preview can render", () => {
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.candidate.rows).toBe("#homework table tbody tr");
    expect(outcome.candidate.dated).toBe(13);
    expect(outcome.candidate.total).toBe(13);
  });

  it("shows the instant the extension recorded, not the text the page printed", () => {
    // The safety argument is the student reading these rows. A column that
    // reads plausibly and parses to the wrong day is exactly what that check
    // catches, and only the parsed instant shows it.
    if (!outcome.ok) throw new Error("expected ok");
    expect(outcome.candidate.sample[0]).toEqual({
      title: "Homework 1",
      due: "2026-09-04T23:59:00-05:00",
    });
  });
});

describe("a proposal that is wrong", () => {
  it("is refused when its selector matches nothing", () => {
    // §4.5: zero rows on a fetched page is the adapter's error. A model that
    // invented `#assignments` produces this and never reaches anybody.
    const outcome = check({ ...GOOD, rows: "#assignments tr" });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("no rows matched");
  });

  it("is refused when the header is a substring of the real one", () => {
    // House rule 6 and `headerIndex`'s own counterexample: this page has an
    // "Assessment Due" column whose cells hold "HW1" and a "Due Date" column
    // whose cells hold the dates. "Due" matches neither, exactly — and a
    // validator that matched by substring would date every row from an
    // assignment name and call it a pass.
    const outcome = check({ ...GOOD, columns: { title: "Exercises", due: "Due" } });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("no due column headed");
  });

  it("is refused when the column holds no dates", () => {
    const outcome = check({
      ...GOOD,
      columns: { title: "Exercises", due: "Solution" },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("no row's");
  });

  it("is refused when the format does not match the column", () => {
    const outcome = check({ ...GOOD, dateFormat: "yyyy-MM-dd" });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toMatch(/no row's|readable date/);
  });

  it("is refused when fewer than half the rows carry a date", () => {
    const doc = parseHTML(
      `<table id="t"><thead><tr><th>Work</th><th>Due</th></tr></thead><tbody>
       <tr><td>MP1</td><td>9/4</td></tr>
       <tr><td>MP2</td><td>TBD</td></tr>
       <tr><td>MP3</td><td>see Canvas</td></tr>
       <tr><td>MP4</td><td>ask staff</td></tr></tbody></table>`,
    ).document as unknown as Document;
    const outcome = validateProposal(
      { shape: "table", rows: "#t tbody tr", columns: { title: "Work", due: "Due" }, dateFormat: "M/d" },
      doc,
      URL_ECE310,
      ZONE,
      REFERENCE,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("only 1 of 4 rows carried a readable date");
  });

  it("is refused when a row's date was only half read", () => {
    // `extra.unparsedTime` means the page printed a cutoff the chosen format
    // could not consume, and the row would land at an invented 23:59 — six
    // hours late for an 18:00 deadline. Here a retry is free, so this is a
    // rejection rather than a mark on the row.
    const doc = parseHTML(
      `<table id="t"><thead><tr><th>Work</th><th>Due</th></tr></thead><tbody>
       <tr><td>MP1</td><td>9/4 at 5:00</td></tr>
       <tr><td>MP2</td><td>9/11 at 5:00</td></tr></tbody></table>`,
    ).document as unknown as Document;
    const outcome = validateProposal(
      { shape: "table", rows: "#t tbody tr", columns: { title: "Work", due: "Due" }, dateFormat: "M/d" },
      doc,
      URL_ECE310,
      ZONE,
      REFERENCE,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("could not fully read");
  });

  it("is refused when it names a field the runner does not read", () => {
    const outcome = check({ ...GOOD, script: "fetch('https://evil.example')" });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain('unknown field "script"');
  });

  it("is refused when it is not an object at all", () => {
    expect(check("the schedule is in the table").ok).toBe(false);
    expect(check([GOOD]).ok).toBe(false);
    expect(check(null).ok).toBe(false);
  });

  it("clears the same trust boundary a published adapter clears", () => {
    // `validateAdapter` is the one gate remote adapter data passes, and a model
    // is a less trustworthy author than the maintainer's own repository, not a
    // more trustworthy one. An unsupported format never reaches the runner.
    const outcome = check({ ...GOOD, dateFormat: "dd.MM.yyyy" });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("unsupported dateFormat");
  });

  it("cannot name a host the extension already holds", () => {
    // A proposal for a gradescope.com page would run under a permission the
    // student granted at install for something else, with no prompt naming it.
    const outcome = validateProposal(
      GOOD,
      ece310(),
      "https://www.gradescope.com/courses/1",
      ZONE,
      REFERENCE,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("already granted");
  });
});

describe("the page the worker carries back", () => {
  it("is sent whole or not at all", () => {
    // Half a document parses into a DOM that looks complete and is missing the
    // table. Truncating would hand the model a page that does not exist; the
    // branch says it declined instead.
    expect(htmlForAuthoring("<table><tr><td>MP1</td></tr></table>")).toBe(
      "<table><tr><td>MP1</td></tr></table>",
    );
    expect(htmlForAuthoring("x".repeat(MAX_AUTHOR_HTML + 1))).toBeUndefined();
    expect(htmlForAuthoring("")).toBeUndefined();
  });

  it("carries every course page captured so far", () => {
    // The largest of the two real captures is 33KB, which is not close.
    const raw = readFileSync(
      new URL("../fixtures/sites/ece310-fa2026-index.html", import.meta.url),
      "utf8",
    );
    expect(htmlForAuthoring(raw)).toBe(raw);
  });
});

describe("the retry loop", () => {
  function recorder(answers: string[]) {
    const seen: string[] = [];
    const prompt = async (text: string): Promise<string> => {
      seen.push(text);
      return answers[seen.length - 1] ?? "{}";
    };
    return { prompt, seen };
  }

  const run = (answers: string[], maxAttempts = 3) => {
    const { prompt, seen } = recorder(answers);
    return authorAdapter(
      prompt,
      ece310(),
      URL_ECE310,
      ZONE,
      REFERENCE,
      "PAGE TITLE: ECE 310",
      { maxAttempts },
    ).then((outcome) => ({ outcome, seen }));
  };

  it("accepts the first answer when it works", async () => {
    const { outcome, seen } = await run([JSON.stringify(GOOD)]);
    expect(outcome.ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(outcome.attempts).toBe(1);
  });

  it("feeds the reason back and accepts the correction", async () => {
    const { outcome, seen } = await run([
      JSON.stringify({ ...GOOD, columns: { title: "Exercises", due: "Due" } }),
      JSON.stringify(GOOD),
    ]);
    expect(outcome.ok).toBe(true);
    expect(seen).toHaveLength(2);
    // The reason is a fact about the page, which is the one kind of correction
    // a small model can act on.
    expect(seen[1]).toContain("Your previous answer was rejected");
    expect(seen[1]).toContain("no due column headed");
  });

  it("retries an answer that is not JSON at all", async () => {
    const { outcome, seen } = await run(["Sure! The table is #homework.", JSON.stringify(GOOD)]);
    expect(outcome.ok).toBe(true);
    expect(seen[1]).toContain("that was not JSON");
  });

  it("stops at the cap rather than asking forever", async () => {
    const bad = JSON.stringify({ ...GOOD, rows: "#nope tr" });
    const { outcome, seen } = await run([bad, bad, bad, bad, bad]);
    expect(seen).toHaveLength(3);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failed).toContain("gave up after 3 attempts");
    expect(outcome.failed).toContain("no rows matched");
  });

  it("honours a lower cap and refuses an absurd one", async () => {
    const bad = JSON.stringify({ ...GOOD, rows: "#nope tr" });
    expect((await run([bad, bad, bad], 1)).seen).toHaveLength(1);
    // The ceiling exists because every attempt is a student watching a button.
    expect((await run(Array(20).fill(bad), 50)).seen).toHaveLength(5);
  });

  it("gives up rather than retrying when the model itself throws", async () => {
    // A QuotaExceededError or a destroyed session throws the same way a second
    // later, so retrying spends a student's time to reach the same sentence.
    let calls = 0;
    const outcome = await authorAdapter(
      async () => {
        calls += 1;
        throw new Error("QuotaExceededError: input too large");
      },
      ece310(),
      URL_ECE310,
      ZONE,
      REFERENCE,
      "PAGE TITLE: ECE 310",
    );
    expect(calls).toBe(1);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failed).toContain("QuotaExceededError");
  });

  it("hands the model the schema alongside the text", async () => {
    let schema: unknown;
    await authorAdapter(
      async (_text, given) => {
        schema = given;
        return JSON.stringify(GOOD);
      },
      ece310(),
      URL_ECE310,
      ZONE,
      REFERENCE,
      "PAGE TITLE: ECE 310",
    );
    expect(schema).toEqual(proposalSchema());
  });
});

describe("end to end over the real capture", () => {
  it("summarises the page, answers from the summary, and validates against the page", async () => {
    // The one test that runs the whole shape: skeleton → prompt → answer →
    // real runner. The "model" here reads the selector back out of the summary
    // it was given, which is the least it would have to do to be useful.
    const doc = ece310();
    const skeleton = skeletonise(doc, 30_000);
    const outcome = await authorAdapter(
      async (text) => {
        expect(text).toContain("#homework table tbody tr");
        const header = /TH \| (\S+) \| (Due Date) \|/.exec(text);
        return JSON.stringify({
          shape: "table",
          rows: "#homework table tbody tr",
          columns: { title: header![1], due: header![2] },
          dateFormat: "M/d",
        });
      },
      doc,
      URL_ECE310,
      ZONE,
      REFERENCE,
      skeleton,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.candidate.dated).toBe(13);
  });
});

/* -------------------------------------------------------------------------- */
/* The list shape: ECE 411, the page that produced "No table on this page"     */
/* -------------------------------------------------------------------------- */

const URL_ECE411 = "https://courses.grainger.illinois.edu/ece411/fa2026/assignments.html";
const ece411 = () => fixture("ece411-fa2026-assignments.html");
const ece411Dated = () => fixture("ece411-fa2026-assignments-dated.html");

/**
 * The proposal a model that read ECE 411 correctly answers.
 *
 * Every field is the one the hand-written `ece411-fa26-mp` entry in
 * `adapters/registry.json` carries, because that entry is the only proof
 * available that this shape can be read at all — and a validator that accepts a
 * proposal the shipped entry would not survive is testing itself.
 */
const ECE411_PROPOSAL = {
  shape: "list",
  rows: "#mp-information ul.simple > li",
  title: "p",
  due: "p",
  titleFrom: "section >> h3",
  dueLabel: "Due|CP1 Due|CP2 Due|CP3 Due|Advance Features Due",
  filter: { exclude: "\\bTB[DA]\\b|\\bN/?A\\b" },
  dateFormat: "M/d",
};

describe("a list-shaped proposal for the real ECE 411 page", () => {
  const outcome = validateProposal(ECE411_PROPOSAL, ece411(), URL_ECE411, ZONE, REFERENCE);

  it("validates to exactly the rows the shipped entry produces", () => {
    // `tests/site.test.ts` runs `ece411-fa26-mp` over this same capture and
    // gets mp_setup and mp_verif at 2026-09-07T23:59-05:00. A proposal that
    // validates has to land on the same two rows, or the preview a student
    // confirms is not the adapter that then runs.
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.candidate.sample.map((row) => row.title).sort()).toEqual([
      "mp_setup",
      "mp_verif",
    ]);
    for (const row of outcome.candidate.sample) {
      expect(row.due).toBe("2026-09-07T23:59:00-05:00");
    }
  });

  it("filters the nine TBD lines away rather than keeping them undated", () => {
    // mp_cache, and every checkpoint of mp_pipeline and mp_ooo, read "TBD".
    // Kept as undated rows they would be eleven items claiming to be deadlines
    // whose date this merely failed to read — and two dated out of eleven is
    // under the half this refuses anyway, so "undated" is not a softer failure
    // than "filtered" here, it is a rejection of a correct proposal.
    if (!outcome.ok) throw new Error("expected ok");
    expect(outcome.candidate.total).toBe(2);
    expect(outcome.candidate.dated).toBe(2);
  });

  it("carries every field it was validated with into the candidate", () => {
    // The candidate is what `buildAdapter` saves. `dueLabel` dropped on this
    // hop means the entry saved reads every line of the list rather than the
    // deadline lines, and the preview the student approved came from neither.
    if (!outcome.ok) throw new Error("expected ok");
    expect(outcome.candidate.dueLabel).toBe(ECE411_PROPOSAL.dueLabel);
    expect(outcome.candidate.titleFrom).toBe("section >> h3");
    expect(outcome.candidate.filter).toEqual({ exclude: "\\bTB[DA]\\b|\\bN/?A\\b" });
    expect(outcome.candidate.columns).toBeUndefined();
    expect(outcome.candidate.title).toBe("p");
  });

  it("is refused when the same proposal drops the filter", () => {
    // Not a nicety: without it mp_cache's "Due: TBD" reaches the runner, lands
    // undated with `extra.unparsedDate`, and the whole proposal is refused with
    // a reason naming the row — which is the retry a model can act on.
    const { filter: _filter, ...noFilter } = ECE411_PROPOSAL;
    const refused = validateProposal(noFilter, ece411(), URL_ECE411, ZONE, REFERENCE);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toMatch(/could not fully read|carried a readable date/);
  });
});

describe("a list-shaped proposal that is wrong", () => {
  it('is refused when it asks for a label the page does not print ("Due Date")', () => {
    // House rule 6 from the other side. The page prints "Due" and "CP1 Due"; a
    // model that generalises them to "Due Date" names a label no line carries,
    // and `runAdapter` throws rather than returning nothing — which is the
    // sentence the next attempt is given.
    const outcome = validateProposal(
      { ...ECE411_PROPOSAL, dueLabel: "Due Date" },
      ece411(),
      URL_ECE411,
      ZONE,
      REFERENCE,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("none carried a due label");
  });

  it('does not let "Due" claim a "Due Date: 11/3" line', () => {
    // The adversarial fixture prints both. "Due Date" CONTAINS "Due", so a
    // substring match hands mp_pipeline a deadline off a line the adapter never
    // asked for, with nothing on screen looking wrong — and the extra rows it
    // would also claim are how this test notices.
    const outcome = validateProposal(
      { ...ECE411_PROPOSAL, dueLabel: "Due" },
      ece411Dated(),
      URL_ECE411,
      ZONE,
      REFERENCE,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.candidate.total).toBe(2);
    expect(outcome.candidate.sample.map((row) => row.title).sort()).toEqual([
      "mp_setup",
      "mp_verif",
    ]);
    expect(outcome.candidate.sample.some((row) => row.due.startsWith("2026-11-03"))).toBe(false);
  });

  it("is refused when its row selector matches nothing", () => {
    const outcome = validateProposal(
      { ...ECE411_PROPOSAL, rows: "#homework ul > li" },
      ece411(),
      URL_ECE411,
      ZONE,
      REFERENCE,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("no rows matched");
  });

  it("is refused when its titleFrom reaches no heading", () => {
    // Every row in a list inherits its section's heading, so a `titleFrom` that
    // resolves nowhere is a page whose rows have no names — and `runAdapter`
    // says so by name rather than producing eleven items called "Due: 9/7".
    const outcome = validateProposal(
      { ...ECE411_PROPOSAL, titleFrom: "section >> h5" },
      ece411(),
      URL_ECE411,
      ZONE,
      REFERENCE,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("no row reached a title");
  });
});

describe("what a shape is allowed to name", () => {
  it("refuses an answer that does not say which shape it saw", () => {
    const { shape: _shape, ...noShape } = ECE411_PROPOSAL;
    const outcome = validateProposal(noShape, ece411(), URL_ECE411, ZONE, REFERENCE);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("shape must be one of");
  });

  it("refuses a table that also carries a list's fields", () => {
    // Half of one answer and half of another. `runAdapter` reads `columns` and
    // ignores `dueLabel`, so the preview would come from the table while the
    // saved entry carried both — the student confirming one adapter and
    // installing a different one.
    const outcome = check({ ...GOOD, dueLabel: "Due" });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain('shape "table" does not take dueLabel');
  });

  it("refuses a list with no dueLabel", () => {
    const { dueLabel: _label, ...noLabel } = ECE411_PROPOSAL;
    const outcome = validateProposal(noLabel, ece411(), URL_ECE411, ZONE, REFERENCE);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain('shape "list" needs dueLabel');
  });

  it("refuses a selector that picks by position", () => {
    // House rule 3 as a rejection rather than only as a line in the prompt:
    // `p:nth-child(2)` is right until the course adds a bullet, and then every
    // MP is dated from its release line with no error anywhere.
    const outcome = validateProposal(
      { ...ECE411_PROPOSAL, due: "p:nth-child(2)" },
      ece411(),
      URL_ECE411,
      ZONE,
      REFERENCE,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("picks by position");
  });

  it("refuses a kind the registry does not accept", () => {
    // `examBoard` filters on `kind === "exam"`; a kind that is neither reaches
    // `Item.kind` as a value no `switch` in the UI has a branch for.
    const outcome = validateProposal(
      { ...ECE411_PROPOSAL, kind: "homework" },
      ece411(),
      URL_ECE411,
      ZONE,
      REFERENCE,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("unsupported kind");
  });

  it("keeps a kind the registry does accept, so an exam page files exams", () => {
    const outcome = validateProposal(
      { ...ECE411_PROPOSAL, kind: "exam" },
      ece411(),
      URL_ECE411,
      ZONE,
      REFERENCE,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.candidate.kind).toBe("exam");
  });

  it("refuses a filter whose regex does not compile", () => {
    const outcome = validateProposal(
      { ...ECE411_PROPOSAL, filter: { exclude: "\\bTB[DA" } },
      ece411(),
      URL_ECE411,
      ZONE,
      REFERENCE,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("not a valid regex");
  });

  it("refuses filter.include, which cannot be told from an empty term", () => {
    const outcome = validateProposal(
      { ...ECE411_PROPOSAL, filter: { include: "MP" } },
      ece411(),
      URL_ECE411,
      ZONE,
      REFERENCE,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("unknown filter.include");
  });

  it("refuses a filter that removes every row, and says which", () => {
    // §11 ranks a silently dropped deadline above every other failure, and an
    // empty preview is nothing for a student to confirm. The filter is matched
    // against the row's own text — "Due: 9/7" — before `titleFrom` renames it,
    // which is also why an over-broad one can empty a page that parses.
    const outcome = validateProposal(
      { ...ECE411_PROPOSAL, filter: { exclude: "9/7|\\bTB[DA]\\b" } },
      ece411(),
      URL_ECE411,
      ZONE,
      REFERENCE,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("removed every one");
  });
});

describe("the prompt explains the three shapes", () => {
  const { system } = buildPrompt("PAGE TITLE: ECE411 FA26", URL_ECE411);

  it("names each shape with an example the schema would accept", () => {
    for (const shape of ["table", "list", "rows"]) {
      expect(system).toContain(`shape "${shape}"`);
    }
    expect(system).toContain('"dueLabel": "Due|CP1 Due"');
    expect(system).toContain('"titleFrom": "section >> h3"');
  });

  it("still forbids positional selectors and values read off the page", () => {
    expect(system).toContain("Never answer with a positional selector");
    expect(system).toContain("Never answer with a date");
  });
});

describe("what the student is told the model did", () => {
  // Worker rule 2, one surface over: the line has to come from what happened.
  // Sushi ran this on ECE 411, saw "Asking the on-device model…", and then the
  // only thing left on screen was the sentence about tables from before it ran.
  it("says the model is not here, when it is not here", () => {
    expect(modelStatusLine({ state: "unavailable" })).toBe(
      "Chrome's built-in model is not available on this computer.",
    );
  });

  it("says it proposed something, and how many goes it took", () => {
    expect(modelStatusLine({ state: "proposed", attempts: 2 })).toContain(
      "proposed an entry (2 attempts)",
    );
    expect(modelStatusLine({ state: "proposed", attempts: 1 })).toContain("(1 attempt)");
  });

  it("quotes the validator when the model answered and the answer read nothing", () => {
    const line = modelStatusLine({
      state: "rejected",
      attempts: 3,
      reason: 'no rows matched "#schedule tr"',
    });
    expect(line).toContain("tried 3 attempts");
    expect(line).toContain("read no deadlines");
    expect(line).toContain('no rows matched "#schedule tr"');
  });

  it("does not claim a proposal read nothing when there was no proposal", () => {
    // A QuotaExceededError never produced an answer, so "its last proposal read
    // no deadlines" would be a sentence about something that does not exist.
    const line = modelStatusLine({ state: "failed", message: "QuotaExceededError" });
    expect(line).not.toContain("read no deadlines");
    expect(line).toContain("QuotaExceededError");
  });
});

describe("the retry loop over the list shape", () => {
  it("feeds the label back and accepts the correction", async () => {
    // The reason is a fact about the page — "none carried a due label", naming
    // the labels it tried — which is the one kind of correction a small model
    // can act on.
    const answers = [
      JSON.stringify({ ...ECE411_PROPOSAL, dueLabel: "Due Date" }),
      JSON.stringify(ECE411_PROPOSAL),
    ];
    const seen: string[] = [];
    const outcome = await authorAdapter(
      async (text) => {
        seen.push(text);
        return answers[seen.length - 1] ?? "{}";
      },
      ece411(),
      URL_ECE411,
      ZONE,
      REFERENCE,
      "PAGE TITLE: ECE411 FA26",
    );
    expect(outcome.ok).toBe(true);
    expect(seen).toHaveLength(2);
    expect(seen[1]).toContain("Your previous answer was rejected");
    expect(seen[1]).toContain("none carried a due label");
  });

  it("carries the validator's last word out for the status line", async () => {
    const bad = JSON.stringify({ ...ECE411_PROPOSAL, rows: "#nope > li" });
    const outcome = await authorAdapter(
      async () => bad,
      ece411(),
      URL_ECE411,
      ZONE,
      REFERENCE,
      "PAGE TITLE: ECE411 FA26",
      { maxAttempts: 2 },
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("no rows matched");
    expect(
      modelStatusLine({ state: "rejected", attempts: outcome.attempts, reason: outcome.reason }),
    ).toContain("no rows matched");
  });
});

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
import { describe, expect, it, vi } from "vitest";
import {
  authorAdapter,
  buildPrompt,
  CHARS_PER_TOKEN,
  groundingSelector,
  htmlForAuthoring,
  MAX_AUTHOR_HTML,
  MAX_RETRY_REASON_CHARS,
  modelOutcomeFor,
  modelStatusLine,
  OUTPUT_RESERVE,
  RETRY_SUFFIX_CHARS,
  retrySuffix,
  type AttemptInfo,
  proposalSchema,
  skeletonBudgetChars,
  validateProposal,
} from "../src/core/author.js";
import { repeatedStructures, skeletonise } from "../src/core/skeleton.js";
import { runAdapter, supportedDateFormats } from "../src/sources/site.js";

/*
 * The real runner, counted.
 *
 * The defect this file grew for is about *how many round trips a bad selector
 * costs*, so the assertion has to be that `runAdapter` was not called — the
 * reason string alone cannot tell "refused before the parse" from "refused
 * after it". The mock delegates to the real implementation, so every other test
 * in this file runs against the same code it always did.
 */
vi.mock("../src/sources/site.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/sources/site.js")>();
  return { ...actual, runAdapter: vi.fn(actual.runAdapter) };
});

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
    // invented `#assignments` produces this and never reaches anybody — and
    // now without the runner being asked, with the page's own groups named.
    const outcome = check({ ...GOOD, rows: "#assignments tr" });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain('no element matches rows "#assignments tr"');
    expect(outcome.reason).toContain("#homework table tbody tr (\u00d713)");
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
    // A rejection, not a throw: the model answered three times and the
    // validator refused all three, so the reason is a fact about this page.
    expect(outcome.kind).toBe("rejected");
    if (outcome.kind !== "rejected") return;
    expect(outcome.attempts).toBe(3);
    expect(outcome.reason).toContain('no element matches rows "#nope tr"');
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
    // And it says so. A throw reported as a rejection is what told Sushi that
    // a proposal "read no deadlines: An unknown error occurred: kErrorUnknown".
    if (outcome.kind !== "threw") throw new Error(`expected a throw, got ${outcome.kind}`);
    expect(outcome.message).toContain("QuotaExceededError");
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
    // The *grounded* schema, not the generic one: what makes a constrained
    // decode unable to invent `#schedule .event` is the enum of this page's own
    // row selectors, and a caller that rebuilt the schema itself would send the
    // unconstrained one while believing otherwise.
    expect(schema).toEqual(proposalSchema(supportedDateFormats(), repeatedStructures(ece310())));
    expect((schema as { properties: { rows: { enum?: string[] } } }).properties.rows.enum).toContain(
      "#homework table tbody tr",
    );
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
    expect(outcome.reason).toContain('no element matches rows "#homework ul > li"');
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
    expect(outcome.reason).toContain('no element matches titleFrom "section >> h5"');
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

  /*
   * The table, both rows, against the thing the page actually calls.
   *
   * The live defect was not in `modelStatusLine` — every sentence it can say
   * was already right. It was in the one expression that chose which one to
   * say, which lived in `proposeWithModel` where no test could reach it:
   * `{ state: "rejected", reason: outcome.reason ?? outcome.failed }` for every
   * `!ok`, so Chrome's thrown `kErrorUnknown` was announced as a proposal that
   * read no deadlines. `modelOutcomeFor` is that expression, moved.
   */
  it.each([
    [
      "a throw",
      {
        ok: false,
        kind: "threw",
        message: "An unknown error occurred: kErrorUnknown",
        attempts: 2,
      },
      { state: "failed", message: "An unknown error occurred: kErrorUnknown" },
      "could not be used on this page: An unknown error occurred: kErrorUnknown",
    ],
    [
      "a rejection",
      { ok: false, kind: "rejected", reason: 'no due column headed "Deadline"', attempts: 3 },
      { state: "rejected", attempts: 3, reason: 'no due column headed "Deadline"' },
      "read no deadlines",
    ],
    [
      "a proposal",
      { ok: true, candidate: {} as never, attempts: 1 },
      { state: "proposed", attempts: 1 },
      "proposed an entry (1 attempt)",
    ],
  ] as const)("maps %s to its own status line", (_what, outcome, state, sentence) => {
    expect(modelOutcomeFor(outcome)).toEqual(state);
    expect(modelStatusLine(modelOutcomeFor(outcome))).toContain(sentence);
  });

  it("never tells the student a throw was a proposal", () => {
    // The exact sentence Sushi read off ECE 411, and the two halves of why it
    // was wrong: there was no proposal, and nothing had been read.
    const line = modelStatusLine(
      modelOutcomeFor({
        ok: false,
        kind: "threw",
        message: "An unknown error occurred: kErrorUnknown",
        attempts: 2,
      }),
    );
    expect(line).not.toContain("read no deadlines");
    expect(line).not.toContain("proposal");
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
    if (outcome.ok || outcome.kind !== "rejected") return;
    expect(outcome.reason).toContain('no element matches rows "#nope > li"');
    expect(modelStatusLine(modelOutcomeFor(outcome))).toContain(
      'named parts of the page that do not exist (last: "#nope > li")',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* The invented selector: ECE 411, end to end, with no model                   */
/* -------------------------------------------------------------------------- */

/**
 * The run this was written for, reproduced offline.
 *
 * 2026-09-18, Sushi's machine, the real page: "Chrome's built-in model tried 3
 * attempts and its last proposal read no deadlines: adapter proposed: no rows
 * matched \"#schedule .event\"". Nothing on that page is called `#schedule` or
 * `.event` — it was the example selector in this file's own system prompt, for
 * a different course. Three ten-second round trips were spent on it.
 *
 * The fake model below answers exactly that, then answers from the inventory,
 * which is the least a real model has to do for the fix to be the fix.
 */
describe("a proposal that names elements the page has not got", () => {
  const INVENTED = { ...ECE411_PROPOSAL, rows: "#schedule .event" };

  it("is rejected without asking the runner, and the retry names what the page does have", async () => {
    const doc = ece411();
    const skeleton = skeletonise(doc, 30_000);
    const seen: string[] = [];
    const runner = vi.mocked(runAdapter);
    runner.mockClear();
    let runsBeforeTheSecondAttempt = -1;

    const outcome = await authorAdapter(
      async (text) => {
        seen.push(text);
        if (seen.length === 1) return JSON.stringify(INVENTED);
        runsBeforeTheSecondAttempt = runner.mock.calls.length;
        // Answered *out of the retry prompt*, not out of this file: if the
        // inventory were dropped from the retry this regex finds nothing and
        // the test fails on the line below rather than quietly passing with a
        // selector the test knew all along.
        const offered = /\n {2}(#mp-information \S+ > li)\s+×/.exec(text);
        expect(offered).not.toBeNull();
        return JSON.stringify({ ...ECE411_PROPOSAL, rows: offered![1]! });
      },
      doc,
      URL_ECE411,
      ZONE,
      REFERENCE,
      skeleton,
    );

    // The whole point: attempt 1 cost a `querySelectorAll`, not a parse of the
    // page. `runAdapter` is the expensive half and it was never reached.
    expect(runsBeforeTheSecondAttempt).toBe(0);
    // And the spy is wired to the real thing, so that zero is a fact rather
    // than a mock that never attached: attempt 2 did reach the runner.
    expect(runner.mock.calls.length).toBeGreaterThan(0);
    expect(seen).toHaveLength(2);
    expect(seen[1]).toContain("REPEATED STRUCTURES ON THIS PAGE");
    expect(seen[1]).toContain('#schedule .event');
    expect(seen[1]).toContain("#mp-information ul.simple > li");

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.attempts).toBe(2);
    expect(outcome.candidate.dated).toBeGreaterThanOrEqual(1);
    expect(outcome.candidate.sample.map((row) => row.title).sort()).toEqual([
      "mp_setup",
      "mp_verif",
    ]);
  });

  it("gives up after three inventions, naming the page's own groups", async () => {
    const doc = ece411();
    const outcome = await authorAdapter(
      async (_text, _schema) => JSON.stringify(INVENTED),
      doc,
      URL_ECE411,
      ZONE,
      REFERENCE,
      skeletonise(doc, 30_000),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok || outcome.kind !== "rejected") return;
    expect(outcome.attempts).toBe(3);
    expect(outcome.reason).toContain('no element matches rows "#schedule .event"');
    expect(outcome.reason).toContain("#mp-information ul.simple > li (×16)");
  });

  it("tells the student the selector was invented, not that the page held no deadlines", () => {
    // Two different next steps. "read no deadlines" sends a person to the page
    // to look for the deadlines it says were not read; on this page there was
    // never a `#schedule` to read them out of.
    const doc = ece411();
    const reason = validateProposal(INVENTED, doc, URL_ECE411, ZONE, REFERENCE);
    expect(reason.ok).toBe(false);
    if (reason.ok) return;
    const line = modelStatusLine({ state: "rejected", attempts: 3, reason: reason.reason });
    expect(line).toContain("named parts of the page that do not exist");
    expect(line).toContain('(last: "#schedule .event")');
    expect(line).toContain("A hand-written entry can still be written for it.");
    expect(line).not.toContain("read no deadlines");
  });

  it("still says 'read no deadlines' when the model found the page and read it wrong", () => {
    // The other branch, and the reason `groundingSelector` is an anchored match
    // on a sentinel rather than a search for the word "matches": a proposal
    // that named the right list and the wrong label *did* read no deadlines,
    // and that sentence is the true one for it.
    const wrongLabel = { ...ECE411_PROPOSAL, dueLabel: "Deadline" };
    const outcome = validateProposal(wrongLabel, ece411(), URL_ECE411, ZONE, REFERENCE);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(groundingSelector(outcome.reason)).toBeUndefined();
    expect(modelStatusLine({ state: "rejected", attempts: 1, reason: outcome.reason })).toContain(
      "read no deadlines",
    );
  });

  it("reads the grounding marker only at the start of the reason", () => {
    // Rule 12's "a marker must be absent from the healthy page", from the
    // direction a course could actually reach. `runAdapter`'s rejections quote
    // the row title, so this is the reason produced by an assignment *called*
    // `no element matches rows "#homework tbody tr"` — deliberately absurd,
    // because a realistic title cannot test this at all. The quotes arrive
    // escaped, the capture group needs a bare one, and the student gets the
    // sentence about the column rather than the one about the selector.
    const rowTitled =
      'row "no element matches rows \\"#homework tbody tr\\"" has a date this could not fully read (9/7 @ 5)';
    expect(groundingSelector(rowTitled)).toBeUndefined();
    expect(modelStatusLine({ state: "rejected", attempts: 2, reason: rowTitled })).toContain(
      "read no deadlines",
    );
  });

  it("refuses a per-row selector no row on the page contains", () => {
    // `rows` matching is not enough: a `due` of `.deadline` inside sixteen
    // `<li>`s that have no such element is the same invention one level down,
    // and the runner would have to parse every row to say so.
    const outcome = validateProposal(
      { ...ECE411_PROPOSAL, due: "span.deadline" },
      ece411(),
      URL_ECE411,
      ZONE,
      REFERENCE,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain('no element matches due "span.deadline"');
    expect(outcome.reason).toContain("#mp-information ul.simple > li");
  });

  it("grounds the one selector a table proposal may carry", () => {
    // `time` is not in the table shape's refused list, so it is the one field
    // whose selector a table proposal chooses. An early return on
    // `shape === "table"` would have left it the only selector in the file
    // reaching the runner ungrounded.
    const outcome = check({ ...GOOD, time: "span.cutoff" });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain('no element matches time "span.cutoff"');
  });

  it("does not refuse a per-row selector that only some rows carry", () => {
    // A labelled list is rows-per-*line*: `time` reaches a sibling bullet that
    // most lines have not got, and demanding every row would refuse the shipped
    // `ece411-fa26-exams` entry. One row reaching it is the test.
    const doc = fixture("ece411-fa2026-syllabus.html");
    const outcome = validateProposal(
      {
        shape: "list",
        rows: "#schedule > ul.simple > li",
        title: "p",
        due: "p",
        dueLabel: "Midterm 1|Midterm 2|Final",
        time: "ul",
        kind: "exam",
        filter: { exclude: "\\bTB[DA]\\b|\\bN/?A\\b" },
        dateFormat: "MMM d, h:mm a",
      },
      doc,
      "https://courses.grainger.illinois.edu/ece411/fa2026/syllabus.html",
      ZONE,
      REFERENCE,
    );
    expect(outcome.ok).toBe(true);
  });
});

describe("the schema a grounded page produces", () => {
  it("closes rows over the page's own groups, and leaves the per-row selectors open", () => {
    // (3): a constrained decode cannot emit `#schedule .event` if it is not in
    // the enum. `title` and `due` stay free text because their right answer is
    // any tag, class or `tag@attribute` inside one row — an enum guessed for
    // them would exclude correct answers, which costs the page rather than an
    // attempt.
    const doc = ece411();
    const structures = repeatedStructures(doc);
    const schema = proposalSchema(supportedDateFormats(), structures) as {
      properties: Record<string, { enum?: string[]; maxLength?: number }>;
    };
    expect(schema.properties["rows"]!.enum).toEqual(structures.map((s) => s.selector));
    expect(schema.properties["rows"]!.enum).not.toContain("#schedule .event");
    expect(schema.properties["rows"]!.enum).toContain("#mp-information ul.simple > li");
    expect(schema.properties["title"]!.enum).toBeUndefined();
    expect(schema.properties["due"]!.enum).toBeUndefined();
  });

  it("falls back to a free string when the page has no repeated group", () => {
    // An empty `enum` is not a schema a decode can satisfy — it would turn "we
    // found nothing to offer" into "the model produced no output at all", which
    // is `failed` rather than `rejected` and says nothing a student can act on.
    const schema = proposalSchema(supportedDateFormats(), []) as {
      properties: Record<string, { enum?: string[]; maxLength?: number }>;
    };
    expect(schema.properties["rows"]!.enum).toBeUndefined();
    expect(schema.properties["rows"]!.maxLength).toBe(200);
  });
});

describe("the prompt carries the page's groups and nobody else's selectors", () => {
  it("names no real selector from another course", () => {
    // The example that produced the live defect. Every `rows` in the system
    // half is now the placeholder ROWS, because an example selector beside a
    // page summary is an invitation to copy it.
    const { system } = buildPrompt("", URL_ECE411);
    expect(system).not.toContain("#schedule .event");
    expect(system).not.toContain("#mp-information ul.simple > li");
    expect(system).not.toContain("#homework table tbody tr");
    expect(system).toContain('"rows": "ROWS"');
    expect(system).toContain("REPEATED STRUCTURES");
  });

  it("puts the inventory in the half that is rebuilt per page", () => {
    // `proposeWithModel` creates one session with the system half in
    // `initialPrompts` before it has seen a page, so a page-derived list in the
    // system half would be the *previous* page's list.
    const doc = ece411();
    const structures = repeatedStructures(doc);
    const { system, user } = buildPrompt("PAGE TITLE: x", URL_ECE411, undefined, structures);
    expect(user).toContain("#mp-information ul.simple > li");
    expect(system).not.toContain("#mp-information ul.simple > li");
  });

  it("fits the window it was measured against, inventory included", () => {
    // (2): measured, not assumed. `proposeWithModel` measures the overhead with
    // the inventory in it and hands the rest to `skeletonise`, so the summary is
    // what gets cut when the two together do not fit.
    const doc = ece411();
    const structures = repeatedStructures(doc);
    const window = 9_216;
    const empty = buildPrompt("", URL_ECE411, undefined, structures);
    const overhead = empty.system.length + empty.user.length;
    const skeleton = skeletonise(doc, skeletonBudgetChars(window, overhead));
    const full = buildPrompt(skeleton, URL_ECE411, undefined, structures);
    expect(full.system.length + full.user.length).toBeLessThanOrEqual(
      Math.floor(window * (1 - OUTPUT_RESERVE) * CHARS_PER_TOKEN),
    );
    // And the inventory survived whole, which is the half that decides whether
    // the answer is spellable at all.
    expect(full.user).toContain("#mp-information ul.simple > li");
  });

  it("cuts the summary rather than the inventory when the window is tight", () => {
    const doc = ece411();
    const structures = repeatedStructures(doc);
    const window = 1_400;
    const empty = buildPrompt("", URL_ECE411, undefined, structures);
    const budget = skeletonBudgetChars(window, empty.system.length + empty.user.length);
    const skeleton = skeletonise(doc, budget);
    expect(skeleton.length).toBeLessThanOrEqual(budget);
    const full = buildPrompt(skeleton, URL_ECE411, undefined, structures);
    expect(full.user).toContain("#mp-information ul.simple > li");
    expect(full.system.length + full.user.length).toBeLessThanOrEqual(
      Math.floor(window * (1 - OUTPUT_RESERVE) * CHARS_PER_TOKEN),
    );
  });
});

describe("one session's worth of prompt per attempt", () => {
  /*
   * The budget, and what a retry is allowed to add to it.
   *
   * `skeletonBudgetChars` sizes the summary for an *empty* window, which is
   * only true if every attempt starts from one — and a retry still appends a
   * sentence, whose length is whatever the validator last said. Two reasons in
   * `author.ts` interpolate the page's whole inventory, so the cap is what
   * keeps the second prompt inside the window the first was measured for.
   */
  it("caps the reason it quotes back, however long the validator was", () => {
    const suffix = retrySuffix("z".repeat(5_000));
    expect(suffix.length).toBeLessThanOrEqual(RETRY_SUFFIX_CHARS);
    expect(suffix).toContain("z".repeat(MAX_RETRY_REASON_CHARS - 1));
    expect(suffix).not.toContain("z".repeat(MAX_RETRY_REASON_CHARS + 1));
    // The constant is what `proposeWithModel` reserves, so it has to bound the
    // worst case rather than describe the typical one.
    expect(RETRY_SUFFIX_CHARS).toBeGreaterThan(MAX_RETRY_REASON_CHARS);
  });

  it("reserves a cap that costs the page almost nothing", () => {
    /*
     * The assertion above is written in terms of the constant, so it survives
     * the constant being loosened to 5,000 — it pins "the cap is applied" and
     * says nothing about the cap being *small*, which is the requirement.
     *
     * The reserve is subtracted from the page summary, so a generous cap is
     * paid for in rows the model never sees, and the page is the thing it has
     * to answer about. Measured against the smallest window Chrome has shipped
     * for this API (4,096 tokens): the whole retry suffix must cost under a
     * twentieth of what the summary gets.
     */
    expect(RETRY_SUFFIX_CHARS).toBeLessThan(skeletonBudgetChars(4096, 0) / 20);
  });

  it("keeps a short reason whole", () => {
    expect(retrySuffix('no due column headed "Deadline"')).toContain(
      'Your previous answer was rejected: no due column headed "Deadline"',
    );
  });

  it("never sends a retry longer than the first prompt plus the reserve", async () => {
    // The `kErrorUnknown` defect, as an assertion. Attempt 2 used to be attempt
    // 1 plus attempt 1's answer plus the whole of `base` again, because one
    // session was prompted twice; now each attempt is `base` plus a bounded
    // suffix, and the caller reserves exactly that much.
    const sent: string[] = [];
    const doc = ece310();
    const skeleton = skeletonise(doc, 20_000);
    await authorAdapter(
      async (text) => {
        sent.push(text);
        return JSON.stringify({ ...GOOD, rows: "#nope tr" });
      },
      doc,
      URL_ECE310,
      ZONE,
      REFERENCE,
      skeleton,
      { maxAttempts: 3 },
    );
    expect(sent).toHaveLength(3);
    for (const text of sent.slice(1)) {
      expect(text.length).toBeLessThanOrEqual(sent[0]!.length + RETRY_SUFFIX_CHARS);
    }
    // And every attempt still carries the inventory, which is the one thing a
    // model that has just invented a selector needs in front of it.
    expect(sent[2]).toContain("REPEATED STRUCTURES");
  });
});

describe("what the console says happened", () => {
  // Worker rule 5. The live run left one line — the final status — and the two
  // candidate causes of a thrown second attempt (a bad answer, an overflowing
  // window) have opposite fixes and looked identical from it.
  const attempts = async (answers: string[], maxAttempts = 3) => {
    const seen: AttemptInfo[] = [];
    let i = 0;
    const outcome = await authorAdapter(
      async () => {
        const answer = answers[i];
        i += 1;
        if (answer === undefined) throw new Error("no more answers");
        return answer;
      },
      ece310(),
      URL_ECE310,
      ZONE,
      REFERENCE,
      "PAGE TITLE: ECE 310",
      { maxAttempts, onAttempt: (info) => seen.push(info) },
    );
    return { seen, outcome };
  };

  it("reports junk then a good proposal as two attempts, named apart", async () => {
    const { seen, outcome } = await attempts(["Sure! It is #homework.", JSON.stringify(GOOD)]);
    expect(outcome.ok).toBe(true);
    expect(seen.map((info) => [info.attempt, info.outcome])).toEqual([
      [1, "not-json"],
      [2, "proposed"],
    ]);
    expect(seen[0]!.reason).toBe("that was not JSON");
    expect(seen[0]!.answerChars).toBe("Sure! It is #homework.".length);
    // The retry is the longer prompt, and by how much is the fact that would
    // have identified the overflow from the console alone.
    expect(seen[1]!.promptChars).toBeGreaterThan(seen[0]!.promptChars);
    expect(seen[1]!.reason).toBeUndefined();
  });

  it("names a rejection and a throw as what they were", async () => {
    const { seen, outcome } = await attempts([JSON.stringify({ ...GOOD, rows: "#nope tr" })]);
    expect(outcome.ok).toBe(false);
    expect(seen.map((info) => info.outcome)).toEqual(["rejected", "threw"]);
    expect(seen[0]!.reason).toContain('no element matches rows "#nope tr"');
    expect(seen[1]!.reason).toBe("no more answers");
    // Nothing came back, so there is nothing to have counted.
    expect(seen[1]!.answerChars).toBe(0);
  });

  it("runs without a callback at all", async () => {
    // The options page passes one; the tests above mostly do not, and a loop
    // that only works when someone is watching is a loop with two behaviours.
    const outcome = await authorAdapter(
      async () => JSON.stringify(GOOD),
      ece310(),
      URL_ECE310,
      ZONE,
      REFERENCE,
      "PAGE TITLE: ECE 310",
    );
    expect(outcome.ok).toBe(true);
  });
});

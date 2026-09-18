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

/** What a model that read the page correctly answers. */
const GOOD = {
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
    expect(schema.required.sort()).toEqual(["columns", "dateFormat", "rows"]);
    expect(schema.additionalProperties).toBe(false);
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
    expect(system).toContain("exact header text");
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
      { rows: "#t tbody tr", columns: { title: "Work", due: "Due" }, dateFormat: "M/d" },
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
      { rows: "#t tbody tr", columns: { title: "Work", due: "Due" }, dateFormat: "M/d" },
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

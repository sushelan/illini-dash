/**
 * PrairieLearn parser tests (§4.3), against the real captured assessments page.
 * Evidence for the expected values is in docs/prairielearn-findings.md.
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import {
  PRAIRIELEARN_ORIGIN,
  creditStillOpen,
  deadlinesFromSchedule,
  isLoginResponse,
  mapStatus,
  parseAssessments,
  parseAvailableCell,
  parseCreditCell,
  parseCreditSchedule,
} from "../src/sources/prairielearn.js";
import { wallClockToIso } from "../src/core/dates.js";
import { formatDue } from "../src/core/grouping.js";
import {
  ParseError,
  type Item,
  type PageCtx,
  type RawItem,
  type Status,
} from "../src/sources/types.js";

const fixtureHtml = readFileSync(
  new URL("../fixtures/prairielearn/assessments-cs357.html", import.meta.url),
  "utf8",
);

function docFrom(html: string): Document {
  return parseHTML(html).document as unknown as Document;
}

const page: PageCtx = {
  url: `${PRAIRIELEARN_ORIGIN}/pl/course_instance/224254/assessments`,
  fetchedAt: "2026-09-03T05:34:00.000Z",
};

/** The real table's header row; column positions are read from it, not assumed. */
const HEADER_ROW =
  `<tr><th><span class="visually-hidden">Label</span></th>` +
  `<th><span class="visually-hidden">Title</span></th>` +
  `<th class="text-center">Available credit</th><th class="text-center">Score</th></tr>`;

const items = parseAssessments(docFrom(fixtureHtml), page);
const byBadge = (badge: string) => items.find((i) => i.extra?.["badge"] === badge)!;

describe("parseAssessments (real capture)", () => {
  it("returns one item per assessment row and no group-heading rows", () => {
    // 21 <tr>: 1 column header, 6 group headings, 14 assessments.
    expect(items).toHaveLength(14);
  });

  it("keys on the badge, not the href (§3.1 as amended)", () => {
    // Real hrefs point at /assessment_instance/{id}, which only exists once the
    // student opens the assessment — so the href changes mid-semester.
    expect(byBadge("HW3").sourceId).toBe("224254:HW3");
    expect(items.every((i) => i.sourceId.startsWith("224254:"))).toBe(true);
  });

  it("titles as badge + name, and keeps the group heading", () => {
    expect(byBadge("HW3").title).toBe("HW3 Errors and Big-O");
    expect(byBadge("HW3").extra?.["group"]).toBe("Module 3. Errors and Big-O");
    expect(byBadge("L4a").extra?.["group"]).toBe("Module 4. Floating Point");
  });

  it("reads the course from the page title", () => {
    expect(items[0]!.courseRaw).toBe("CS 357");
    expect(items[0]!.courseCode).toBe("CS357");
  });

  it("takes dueAt from the highest-credit tier and lateDueAt from the next", () => {
    // 100 → 80 → 50 → 0: due is the end of 100, late the end of 80. The 50%
    // tier is a semester-long tail nobody plans around (§4.3).
    const l4a = byBadge("L4a");
    expect(l4a.dueAt).toBe("2026-09-08T11:00:00-05:00");
    expect(l4a.lateDueAt).toBe("2026-09-22T23:59:59-05:00");
  });

  it("leaves lateDueAt undefined when the next tier is 0 credit", () => {
    // PQ1 runs 100 → 0. The "next tier" is the closed state, not a late window,
    // and its End is an em dash — §4.3's rule needed this amendment.
    const pq1 = byBadge("PQ1");
    expect(pq1.dueAt).toBe("2026-09-08T23:59:59-05:00");
    expect(pq1.lateDueAt).toBeUndefined();
  });

  it("handles a single-tier schedule", () => {
    const s1 = byBadge("S1");
    expect(s1.dueAt).toBe("2026-09-05T23:59:59-05:00");
    expect(s1.lateDueAt).toBeUndefined();
  });

  it("stores the whole schedule and the release date", () => {
    const tiers = JSON.parse(byBadge("HW3").extra!["creditSchedule"]!);
    expect(tiers.map((t: { credit: number }) => t.credit)).toEqual([100, 96, 50, 0]);
    // The 0-credit tier's end is an em dash in the source, i.e. no end.
    expect(tiers[3].end).toBeUndefined();
    expect(byBadge("HW3").extra?.["releasedAt"]).toBe("2026-08-27T08:00:01-05:00");
  });

  it("leaves an assessment with no credit cell undated", () => {
    // 6 of the 14 rows have an empty credit cell: closed, or always available.
    for (const badge of ["S3", "GA 1", "L1", "HW1", "GA 0", "GA00"]) {
      expect(byBadge(badge).dueAt, badge).toBeUndefined();
      expect(byBadge(badge).lateDueAt, badge).toBeUndefined();
      expect(byBadge(badge).extra?.["unparsedCredit"], badge).toBeUndefined();
    }
  });

  it("maps status from the score cell", () => {
    expect(byBadge("HW3").status).toBe("not_submitted"); // "Not started"
    expect(byBadge("HW2").status).toBe("graded"); // 100% bar
    expect(byBadge("GA 1").status).toBe("graded"); // 103% bar
    expect(byBadge("S1").status).toBe("not_submitted"); // 0% bar
  });

  it("flags work that does not count, without dropping it", () => {
    // §4.3: some "not for credit" surveys are still required.
    expect(byBadge("L1").extra?.["forCredit"]).toBe("false"); // NOT FOR CREDIT
    expect(byBadge("HW1").extra?.["forCredit"]).toBe("false"); // WILL NOT COUNT
    expect(byBadge("S3").extra?.["forCredit"]).toBe("false"); // extra credit
    expect(byBadge("HW3").extra?.["forCredit"]).toBeUndefined();
  });

  it("builds absolute urls, falling back to the page for a row with no link", () => {
    // `RawItem.url` is optional since the `manual` source, so "a fetched row
    // always has one" is now a claim this test has to make rather than one the
    // type makes for it — and it is the claim house rule 7's fallback exists for.
    const hw3 = byBadge("HW3").url;
    expect(hw3).toBeDefined();
    expect(hw3!.startsWith(`${PRAIRIELEARN_ORIGIN}/pl/`)).toBe(true);
    // PQ1 has no link in the capture.
    expect(byBadge("PQ1").url).toBe(page.url);
  });
});

describe("parseCreditSchedule", () => {
  const doc = docFrom("<div></div>");

  it("skips the header row and reads Credit/Start/End", () => {
    const tiers = parseCreditSchedule(
      doc,
      `<table><tr><th>Credit</th><th>Start</th><th>End</th></tr>` +
        `<tr><td>100</td><td>2026-09-01 08:00:01 (CDT)</td><td>2026-09-08 11:00:00 (CDT)</td></tr>` +
        `<tr><td>0</td><td>2026-12-09 23:59:59 (CST)</td><td>—</td></tr></table>`,
    );
    expect(tiers).toEqual([
      { credit: 100, start: "2026-09-01T08:00:01-05:00", end: "2026-09-08T11:00:00-05:00" },
      { credit: 0, start: "2026-12-09T23:59:59-06:00", end: undefined },
    ]);
  });

  it("throws when the popover holds no credit rows", () => {
    expect(() => parseCreditSchedule(doc, `<table><tr><th>Credit</th></tr></table>`)).toThrow(
      ParseError,
    );
  });

  it("throws on an unparseable date rather than guessing", () => {
    expect(() =>
      parseCreditSchedule(doc, `<table><tr><td>100</td><td>x</td><td>Sep 8 2026</td></tr></table>`),
    ).toThrow(ParseError);
  });
});

describe("deadlinesFromSchedule", () => {
  it("finds the highest tier even when it is not first and not 100", () => {
    // §4.3: some courses cap below 100; it is still the full-credit deadline.
    expect(
      deadlinesFromSchedule([
        { credit: 90, end: "A" },
        { credit: 50, end: "B" },
      ]),
    ).toEqual({ dueAt: "A", lateDueAt: "B" });
  });

  it("skips a 0-credit next tier", () => {
    expect(deadlinesFromSchedule([{ credit: 100, end: "A" }, { credit: 0, end: "B" }])).toEqual({
      dueAt: "A",
      lateDueAt: undefined,
    });
  });
});

describe("parseAvailableCell — an assessment that has not opened", () => {
  /*
   * Real cells from an ECE 374 assessments page, 2026-09-11. Eight guided
   * problem sets carried this shape, did not match the credit cell, and were
   * filed under "Couldn't read" as `prairielearn: credit` — at the very top of
   * the list, above everything actually due.
   *
   * Nothing about the text is unreadable. It answers a different question.
   */
  const reference = "2026-09-11T05:00:00.000Z";

  it("reads the opening instant in the course zone", () => {
    expect(parseAvailableCell("Available 09:00, Sat, Sep 12", reference)).toBe(
      "2026-09-12T09:00:00-05:00",
    );
  });

  it("reads every one of the eight real cells", () => {
    const real = [
      "Available 09:00, Sat, Sep 12",
      "Available 09:00, Sat, Sep 26",
      "Available 09:00, Sat, Oct 3",
      "Available 09:00, Sat, Oct 10",
      "Available 09:00, Sat, Oct 17",
      "Available 09:00, Sat, Oct 24",
      "Available 09:00, Sat, Nov 7",
      "Available 09:00, Sat, Nov 28",
    ];
    for (const text of real) expect(parseAvailableCell(text, reference), text).toBeDefined();
  });

  it("crosses into standard time with the rest of the calendar", () => {
    // Nov 28 is CST. A fixed -05:00 would place it an hour early, and the
    // opening time is the only instant these rows have.
    expect(parseAvailableCell("Available 09:00, Sat, Nov 28", reference)).toBe(
      "2026-11-28T09:00:00-06:00",
    );
  });

  it("is not the credit cell, and the credit cell is not it", () => {
    // Both shapes end identically. Matching either loosely would let a
    // deadline be read as an opening time, which is the more dangerous
    // direction: the row would stop being due.
    expect(parseAvailableCell("100% until 21:15, Mon, Sep 14", reference)).toBeUndefined();
    expect(parseCreditCell("Available 09:00, Sat, Sep 12", reference)).toBeUndefined();
  });

  it("refuses a date that does not exist rather than inventing one", () => {
    for (const bad of [
      "",
      "Available soon",
      "Available 09:00, Sat, Sep 31",
      "Available 25:00, Sat, Sep 12",
      "Available 09:00, Sep 12",
      "Not available",
      "Not Available 09:00, Sat, Sep 12",
      "Available 09:00, Sat, Sep 12 (extended)",
    ]) {
      expect(parseAvailableCell(bad, reference), bad).toBeUndefined();
    }
  });

  it("uses the weekday to correct a wrong year guess, like the credit cell", () => {
    // The shared instant resolution is the point: one copy, so loosening it
    // cannot be masked by the other shape staying strict.
    expect(parseAvailableCell("Available 09:00, Sun, Sep 12", reference)).toBe(
      "2027-09-12T09:00:00-05:00",
    );
  });
});

describe("parseCreditCell (§4.3 fallback)", () => {
  const reference = "2026-09-03T05:00:00.000Z";

  it("parses the cell text into an instant in the course zone", () => {
    // No year and no zone in the source; the weekday validates the inferred year.
    expect(parseCreditCell("100% until 23:59, Tue, Sep 8", reference)).toEqual({
      credit: 100,
      instant: "2026-09-08T23:59:00-05:00",
    });
  });

  it("uses the weekday to correct a wrong year guess (§3.2)", () => {
    // 2026-09-08 is a Tuesday; 2027-09-08 is a Wednesday.
    expect(parseCreditCell("100% until 23:59, Wed, Sep 8", reference)?.instant).toBe(
      "2027-09-08T23:59:00-05:00",
    );
  });

  it("returns undefined for anything that does not match", () => {
    for (const bad of ["", "100% until tomorrow", "Not started", "80% until 23:59, Sep 8"]) {
      expect(parseCreditCell(bad, reference), bad).toBeUndefined();
    }
  });
});

describe("credit-cell fallback inside a full row", () => {
  const bare: PageCtx = {
    url: `${PRAIRIELEARN_ORIGIN}/pl/course_instance/1/assessments`,
    fetchedAt: "2026-09-03T05:00:00.000Z",
  };
  const wrap = (credit: string) =>
    docFrom(
      `<title>Assessments — CS 999 | PrairieLearn</title>` +
        `<table aria-label="Assessments">${HEADER_ROW}<tr>` +
        `<td><span data-testid="assessment-set-badge">HW9</span></td>` +
        `<td><a href="/pl/course_instance/1/assessment/5">Thing</a></td>` +
        `<td>${credit}</td><td>Not started</td></tr></table>`,
    );

  it("routes an unopened assessment to its opening time, not to unreadable", () => {
    // The wiring, not the matcher: the eight ECE 374 rows reached the list as
    // `unparsedCredit` and led it under "Couldn't read". Nothing here is
    // unreadable, so neither the flag nor the warning belongs on the row.
    const [item] = parseAssessments(wrap("Available 09:00, Sat, Sep 12"), bare);
    expect(item!.extra?.["releasedAt"]).toBe("2026-09-12T09:00:00-05:00");
    expect(item!.extra?.["unparsedCredit"]).toBeUndefined();
  });

  it("invents no deadline from an opening time", () => {
    // Worker rule 3. §5.3 ranks instants across sources, so a fabricated
    // `dueAt` here would outrank a real deadline Canvas states for the same
    // work — and the row would claim to be due on the day it opens.
    const [item] = parseAssessments(wrap("Available 09:00, Sat, Sep 12"), bare);
    expect(item!.dueAt).toBeUndefined();
    expect(item!.lateDueAt).toBeUndefined();
  });

  it("accepts the cell only when that is the whole of it (house rule 12)", () => {
    // `creditText` is the entire cell. Matching a fragment of it means reading
    // an opening time off a cell that also says something else — and whatever
    // that something else is, it has just been discarded silently.
    //
    // Both strings are deliberately adversarial and absent from every capture,
    // which is the case house rule 12 says a real fixture cannot cover. The
    // prefix one is the dangerous direction: a fragment match turns the string
    // that means "you cannot start this" into a precise opening time.
    for (const text of [
      "Not Available 09:00, Sat, Sep 12",
      "Available 09:00, Sat, Sep 12 (extended)",
    ]) {
      const [item] = parseAssessments(wrap(text), bare);
      expect(item!.extra?.["releasedAt"], text).toBeUndefined();
      expect(item!.extra?.["unparsedCredit"], text).toBe(text);
    }
  });

  it("treats a 100% cell as the due date", () => {
    const [item] = parseAssessments(wrap("100% until 23:59, Tue, Sep 8"), bare);
    expect(item!.dueAt).toBe("2026-09-08T23:59:00-05:00");
    expect(item!.lateDueAt).toBeUndefined();
  });

  it("treats a sub-100% cell as a reduced-credit deadline, not a due date", () => {
    // §4.3: the full-credit deadline has already passed, so what is left is a
    // late window. Reporting it as `dueAt` would tell the student they have
    // until then for full marks.
    const [item] = parseAssessments(wrap("80% until 23:59, Tue, Sep 8"), bare);
    expect(item!.dueAt).toBeUndefined();
    expect(item!.lateDueAt).toBe("2026-09-08T23:59:00-05:00");
    expect(item!.extra?.["creditRemaining"]).toBe("80");
  });

  it("keeps an unreadable credit cell as an undated row, not a dead page", () => {
    const [item] = parseAssessments(wrap("100% until the heat death"), bare);
    expect(item!.dueAt).toBeUndefined();
    expect(item!.extra?.["unparsedCredit"]).toBe("100% until the heat death");
  });
});

describe("structural rules (§0 rule 3)", () => {
  const bare: PageCtx = {
    url: `${PRAIRIELEARN_ORIGIN}/pl/course_instance/1/assessments`,
    fetchedAt: "2026-09-03T05:00:00.000Z",
  };

  it("throws when the assessments table is missing", () => {
    expect(() => parseAssessments(docFrom("<p>hello</p>"), bare)).toThrow(/no assessments table/);
  });

  it("throws when the table has rows but none carry a badge", () => {
    const doc = docFrom(
      `<table aria-label="Assessments">${HEADER_ROW}` +
        `<tr><td><span class="renamed">HW1</span></td><td>Thing</td><td></td><td></td></tr></table>`,
    );
    expect(() => parseAssessments(doc, bare)).toThrow(/none carry an assessment badge/);
  });

  it("throws when two rows would share one badge key", () => {
    const row =
      `<tr><td><span data-testid="assessment-set-badge">HW1</span></td>` +
      `<td>x</td><td></td><td></td></tr>`;
    const doc = docFrom(`<table aria-label="Assessments">${HEADER_ROW}${row}${row}</table>`);
    expect(() => parseAssessments(doc, bare)).toThrow(/duplicate assessment badge/);
  });

  it("throws when the header does not name the columns it needs", () => {
    const doc = docFrom(
      `<table aria-label="Assessments"><tr><th>Label</th><th>Title</th></tr>` +
        `<tr><td><span data-testid="assessment-set-badge">HW1</span></td><td>x</td></tr></table>`,
    );
    expect(() => parseAssessments(doc, bare)).toThrow(/assessments table header is/);
  });

  it("throws when a row's cell count disagrees with the header", () => {
    const doc = docFrom(
      `<table aria-label="Assessments">${HEADER_ROW}` +
        `<tr><td><span data-testid="assessment-set-badge">HW1</span></td><td>x</td></tr></table>`,
    );
    expect(() => parseAssessments(doc, bare)).toThrow(/cells but the header declares/);
  });

  it("throws when the course instance id is not in the URL", () => {
    expect(() =>
      parseAssessments(docFrom(`<table aria-label="Assessments"></table>`), {
        url: "https://us.prairielearn.com/pl/",
        fetchedAt: bare.fetchedAt,
      }),
    ).toThrow(/course instance id/);
  });
});

describe("regressions found by the adversarial review", () => {
  const bare: PageCtx = {
    url: `${PRAIRIELEARN_ORIGIN}/pl/course_instance/1/assessments`,
    fetchedAt: "2026-09-03T05:00:00.000Z",
  };
  const GOOD =
    `<table><tr><th>Credit</th><th>Start</th><th>End</th></tr>` +
    `<tr><td>100</td><td>2026-09-01 08:00:01 (CDT)</td><td>2026-09-08 11:00:00 (CDT)</td></tr></table>`;

  const rowWith = (badge: string, popover: string | null, credit = "") =>
    `<tr><td><span data-testid="assessment-set-badge">${badge}</span></td>` +
    `<td><a href="/pl/course_instance/1/assessment/5">Thing</a></td>` +
    `<td>${credit}${popover === null ? "" : `<button data-bs-content="${popover}">?</button>`}</td>` +
    `<td>Not started</td></tr>`;
  const table = (rows: string) =>
    docFrom(
      `<title>Assessments — CS 999 | PrairieLearn</title>` +
        `<table aria-label="Assessments">${HEADER_ROW}${rows}</table>`,
    );

  it("lets one unreadable popover cost its own row, not all the others", () => {
    // A single (EDT) inside one payload used to return 0 of 14 items.
    const doc = table(
      rowWith("HW1", GOOD) +
        rowWith("HW2", GOOD.replace("(CDT)", "(EDT)")) +
        rowWith("HW3", GOOD),
    );
    const parsed = parseAssessments(doc, bare);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]!.dueAt).toBe("2026-09-08T11:00:00-05:00");
    expect(parsed[1]!.dueAt).toBeUndefined();
    expect(parsed[1]!.extra?.["unparsedSchedule"]).toContain("EDT");
    expect(parsed[2]!.dueAt).toBe("2026-09-08T11:00:00-05:00");
  });

  it("falls back to the credit cell beside a broken popover", () => {
    // The fallback used to be gated on the popover being absent, so a row with
    // a broken popover could not use the perfectly good text in the same cell.
    const doc = table(
      rowWith("HW1", GOOD.replace("(CDT)", "(EDT)"), "100% until 23:59, Tue, Sep 8"),
    );
    const [item] = parseAssessments(doc, bare);
    expect(item!.dueAt).toBe("2026-09-08T23:59:00-05:00");
    expect(item!.extra?.["unparsedSchedule"]).toBeDefined();
  });

  it("still throws when every popover fails and nothing rescues a date", () => {
    const broken = GOOD.replace("(CDT)", "(EDT)");
    expect(() =>
      parseAssessments(table(rowWith("HW1", broken) + rowWith("HW2", broken)), bare),
    ).toThrow(/all 2 credit schedule\(s\) failed to parse and no date was recovered/);
  });

  it("flags a credit cell that disagrees with its schedule (§4.3 cross-check)", () => {
    // Swapping two rows' payloads is a selector bug; it used to pass silently.
    // At the reference time the schedule's active tier is 100, so a cell saying
    // 80 means the popover belongs to a different row.
    const doc = table(rowWith("HW1", GOOD, "80% until 23:59, Tue, Sep 8"));
    const [item] = parseAssessments(doc, bare);
    expect(item!.extra?.["creditMismatch"]).toBe("cell=80 schedule=100");
    // The schedule still wins, per §4.3.
    expect(item!.dueAt).toBe("2026-09-08T11:00:00-05:00");
  });

  it("does not flag agreement", () => {
    const doc = table(rowWith("HW1", GOOD, "100% until 23:59, Tue, Sep 8"));
    expect(parseAssessments(doc, bare)[0]!.extra?.["creditMismatch"]).toBeUndefined();
  });

  it("rejects an empty Credit cell instead of reading it as 0", () => {
    // Number("") === 0 passes Number.isFinite, which would fabricate a 0-credit
    // tier and drag dueAt onto the 50% semester-long tail §4.3 rejects.
    const doc = docFrom("<div></div>");
    for (const credit of ["", " ", "1e3", "0x10"]) {
      expect(() =>
        parseCreditSchedule(
          doc,
          `<table><tr><td>${credit}</td><td>2026-09-01 08:00:01 (CDT)</td>` +
            `<td>2026-09-08 11:00:00 (CDT)</td></tr></table>`,
        ),
        JSON.stringify(credit),
      ).toThrow(/non-numeric credit/);
    }
  });

  it("takes the later window when two tiers tie for the highest credit", () => {
    // An extension authored as a second access rule. The earlier window would
    // otherwise be the deadline and the later one a "reduced-credit" deadline
    // that is actually still full credit.
    expect(
      deadlinesFromSchedule([
        { credit: 100, end: "2026-09-08T23:59:59-05:00" },
        { credit: 100, end: "2026-09-15T23:59:59-05:00" },
        { credit: 0, end: undefined },
      ]),
    ).toEqual({ dueAt: "2026-09-15T23:59:59-05:00", lateDueAt: undefined });
  });

  it("does not call a same-credit window a late deadline", () => {
    // best is the first tier (its end is later); the next tier is still 100%,
    // so it is another full-credit window, not a reduced-credit one.
    expect(
      deadlinesFromSchedule([
        { credit: 100, end: "2026-09-15T23:59:59-05:00" },
        { credit: 100, end: "2026-09-08T23:59:59-05:00" },
      ]),
    ).toEqual({ dueAt: "2026-09-15T23:59:59-05:00", lateDueAt: undefined });
  });

  it("reads columns from the header, not from fixed positions", () => {
    // An added leading column used to yield 14 undated rows reported `graded`,
    // because the status reader was handed the credit text — silently, behind a
    // green health dot.
    const doc = docFrom(
      `<title>Assessments — CS 999 | PrairieLearn</title>` +
        `<table aria-label="Assessments">` +
        `<tr><th>Pin</th><th><span class="visually-hidden">Label</span></th>` +
        `<th><span class="visually-hidden">Title</span></th>` +
        `<th class="text-center">Available credit</th><th class="text-center">Score</th></tr>` +
        `<tr><td></td><td><span data-testid="assessment-set-badge">HW1</span></td>` +
        `<td><a href="/pl/course_instance/1/assessment/5">Thing</a></td>` +
        `<td>100% until 23:59, Tue, Sep 8</td><td>Not started</td></tr></table>`,
    );
    const [item] = parseAssessments(doc, bare);
    expect(item!.title).toBe("HW1 Thing");
    expect(item!.dueAt).toBe("2026-09-08T23:59:00-05:00");
    expect(item!.status).toBe("not_submitted");
    expect(item!.extra?.["unparsedCredit"]).toBeUndefined();
  });

  it("rejects an impossible date rather than storing or throwing on it", () => {
    // The cell regex admits these; formatted verbatim they are either not real
    // instants or make Date throw a RangeError, which is not a ParseError and
    // would be misreported as a plumbing bug.
    for (const bad of [
      "100% until 23:59, Tue, Sep 31",
      "100% until 23:59, Tue, Sep 0",
      "100% until 25:00, Tue, Sep 8",
      "100% until 23:99, Tue, Sep 8",
    ]) {
      expect(parseCreditCell(bad, bare.fetchedAt), bad).toBeUndefined();
      const [item] = parseAssessments(table(rowWith("HW1", null, bad)), bare);
      expect(item!.dueAt, bad).toBeUndefined();
      expect(item!.extra?.["unparsedCredit"], bad).toBe(bad);
    }
  });

  it("refuses a date whose weekday contradicts every candidate year", () => {
    // Sep 8 is Mon/Tue/Wed in 2025/2026/2027, so Fri matches nothing. Falling
    // through to the 6-month rule would return one of the rejected years.
    expect(parseCreditCell("100% until 23:59, Fri, Sep 8", bare.fetchedAt)).toBeUndefined();
  });

  it("refuses an off-origin, non-https or malformed row link", () => {
    for (const href of ["//evil.example/x", "http://evil.example/x", "javascript:alert(1)"]) {
      const doc = table(
        `<tr><td><span data-testid="assessment-set-badge">HW1</span></td>` +
          `<td><a href="${href}">Thing</a></td><td></td><td>Not started</td></tr>`,
      );
      expect(parseAssessments(doc, bare)[0]!.url, href).toBe(bare.url);
    }
  });

  it("does not lose every row to one malformed href", () => {
    const doc = table(
      `<tr><td><span data-testid="assessment-set-badge">HW1</span></td>` +
        `<td><a href="http://[">Thing</a></td><td></td><td>Not started</td></tr>` +
        rowWith("HW2", GOOD),
    );
    const parsed = parseAssessments(doc, bare);
    expect(parsed).toHaveLength(2);
    expect(parsed[1]!.dueAt).toBe("2026-09-08T11:00:00-05:00");
  });
});

describe("the zone/DST path is pinned, not assumed", () => {
  const reference = "2026-09-03T05:00:00.000Z";

  it("resolves a winter date to CST, which a hardcoded -05:00 cannot", () => {
    // 2026-12-09 is a Wednesday. Every other credit-cell test uses September,
    // where CDT and a hardcoded -05:00 are indistinguishable.
    expect(parseCreditCell("100% until 23:59, Wed, Dec 9", reference)?.instant).toBe(
      "2026-12-09T23:59:00-06:00",
    );
  });

  it("needs the second offset pass to land on the right side of the fall-back", () => {
    // A single pass reads the offset at the UTC-interpreted instant and answers
    // -05:00 here; the correct answer after the 2am transition is -06:00.
    expect(
      wallClockToIso({ year: 2026, month: 11, day: 1, hour: 4, minute: 0 }, "America/Chicago"),
    ).toBe("2026-11-01T04:00:00-06:00");
  });

  it("considers the previous year as a candidate", () => {
    // 2025-09-08 is a Monday; dropping referenceYear-1 from the candidates would
    // make this unresolvable.
    expect(parseCreditCell("100% until 23:59, Mon, Sep 8", reference)?.instant).toBe(
      "2025-09-08T23:59:00-05:00",
    );
  });

  it("throws on wall-clock parts that name no real date", () => {
    expect(() =>
      wallClockToIso({ year: 2026, month: 2, day: 30, hour: 12, minute: 0 }, "America/Chicago"),
    ).toThrow(ParseError);
    expect(() =>
      wallClockToIso({ year: 2026, month: 13, day: 1, hour: 12, minute: 0 }, "America/Chicago"),
    ).toThrow(ParseError);
    // 2024 was a leap year, so Feb 29 is real.
    expect(
      wallClockToIso({ year: 2024, month: 2, day: 29, hour: 12, minute: 0 }, "America/Chicago"),
    ).toBe("2024-02-29T12:00:00-06:00");
  });
});

describe("mapStatus (§4.3)", () => {
  const cell = (html: string) => docFrom(`<td>${html}</td>`).querySelector("td");
  const bar = (percent: string) => cell(`<div class="progress-bar" style="width:${percent}%"></div>`);

  it("reads the score bar and the textual states", () => {
    expect(mapStatus(cell("Not started")).status).toBe("not_submitted");
    expect(mapStatus(cell("<button>New instance</button>")).status).toBe("not_submitted");
    expect(mapStatus(bar("0")).status).toBe("not_submitted");
    expect(mapStatus(bar("100")).status).toBe("graded");
    // A score above the maximum — extra credit — is still nothing left to earn.
    expect(mapStatus(bar("103")).status).toBe("graded");
    expect(mapStatus(cell("")).status).toBe("unknown");
    expect(mapStatus(null).status).toBe("unknown");
  });

  // §4.3 as amended (Sushi 2026-09-18, roadmap I37): "a percentage bar > 0% →
  // graded ... this is 'done' for our purposes" was wrong for a partial score
  // with credit still on offer. The old rule is what these two replace.
  it("calls a partial score done only once no credit is still open", () => {
    expect(mapStatus(bar("40"), true)).toEqual({ status: "not_submitted", scorePercent: 40 });
    expect(mapStatus(bar("40"), false)).toEqual({ status: "graded", scorePercent: 40 });
    // Full marks are done whether or not a later tier is still open.
    expect(mapStatus(bar("100"), true)).toEqual({ status: "graded" });
    // And nothing earned is still nothing earned.
    expect(mapStatus(bar("0"), true)).toEqual({ status: "not_submitted" });
    // The cell text is the same rule when there is no bar to read.
    expect(mapStatus(cell("40%"), true)).toEqual({ status: "not_submitted", scorePercent: 40 });
  });

  it("defaults to closed when nothing says the credit window is open", () => {
    // The default matters: it is what an unreadable schedule falls back to, and
    // re-opening a row on a guess produces one that never clears.
    expect(mapStatus(bar("40"))).toEqual({ status: "graded", scorePercent: 40 });
  });
});

describe("creditStillOpen (roadmap I37)", () => {
  const now = Date.parse("2026-09-03T05:34:00.000Z");
  const past = "2026-09-01T23:59:59-05:00";
  const future = "2026-09-10T23:59:59-05:00";

  it("is true only while a tier worth something is inside its window", () => {
    expect(creditStillOpen(now, [{ credit: 100, end: past }], undefined)).toBe(false);
    expect(creditStillOpen(now, [{ credit: 80, end: future }], undefined)).toBe(true);
    // The 0-credit tail of a closed assessment is open forever and worth nothing.
    expect(creditStillOpen(now, [{ credit: 0 }], undefined)).toBe(false);
    // A tier with no End is open indefinitely.
    expect(creditStillOpen(now, [{ credit: 50 }], undefined)).toBe(true);
    // Not started yet: the window has not opened.
    expect(creditStillOpen(now, [{ credit: 100, start: future }], undefined)).toBe(false);
    // Any open tier counts, not just the first.
    expect(
      creditStillOpen(
        now,
        [
          { credit: 100, end: past },
          { credit: 80, start: past, end: future },
        ],
        undefined,
      ),
    ).toBe(true);
  });

  it("falls back to the credit cell, and to closed with neither", () => {
    expect(creditStillOpen(now, undefined, { credit: 80, instant: future })).toBe(true);
    expect(creditStillOpen(now, undefined, { credit: 80, instant: past })).toBe(false);
    expect(creditStillOpen(now, undefined, { credit: 0, instant: future })).toBe(false);
    expect(creditStillOpen(now, undefined, undefined)).toBe(false);
  });
});

describe("partial scores over the constructed fixture", () => {
  // Constructed, not captured — the real capture has only 0%, 100% and 103%
  // bars, so it cannot tell the amended rule from the one it replaces. See
  // fixtures/prairielearn/README.md.
  const partialHtml = readFileSync(
    new URL("../fixtures/prairielearn/assessments-partial-scores.html", import.meta.url),
    "utf8",
  );
  const rows = parseAssessments(docFrom(partialHtml), page);
  const row = (badge: string) => rows.find((i) => i.extra?.["badge"] === badge)!;

  it("keeps a 40% homework open while its 80%-credit tier is", () => {
    expect(row("PS1").status).toBe("not_submitted");
    expect(row("PS1").extra?.["scorePercent"]).toBe("40");
  });

  it("calls the same 40% done once every tier has closed", () => {
    expect(row("PS2").status).toBe("graded");
    expect(row("PS2").extra?.["scorePercent"]).toBe("40");
  });

  it("leaves full marks done, and states no percentage for them", () => {
    expect(row("PS3").status).toBe("graded");
    expect(row("PS3").extra?.["scorePercent"]).toBeUndefined();
  });

  it("treats a row that states no credit window as closed", () => {
    expect(row("PS4").status).toBe("graded");
    expect(row("PS4").extra?.["scorePercent"]).toBe("40");
  });
});

/**
 * The wording lives in core/grouping.ts, but the fact it reports is this
 * parser's, so it is pinned beside the parser that produces `scorePercent`.
 */
describe("formatDue says how far a partial score got (roadmap I37)", () => {
  const NOW = new Date(2026, 8, 10, 18, 0, 0);
  const member = (status: Status, extra?: Record<string, string>): RawItem => ({
    source: "prairielearn",
    sourceId: `224254:${status}`,
    courseRaw: "CS 357",
    title: "m",
    kind: "assignment",
    url: `${PRAIRIELEARN_ORIGIN}/pl/course_instance/224254/assessments`,
    status,
    extra,
    fetchedAt: "2026-09-10T18:00:00.000Z",
  });
  const rowWith = (member_: RawItem, extra: Partial<Item> = {}): Item => ({
    id: "x",
    members: [member_],
    courseLabel: "CS357",
    title: "HW3 Errors and Big-O",
    kind: "assignment",
    url: `${PRAIRIELEARN_ORIGIN}/pl/course_instance/224254/assessments`,
    status: member_.status,
    hidden: false,
    done: false,
    notified: {},
    dueAt: new Date(2026, 8, 12, 23, 59).toISOString(),
    ...extra,
  });

  it("reads '40% so far' on an unfinished row", () => {
    const row = rowWith(member("not_submitted", { scorePercent: "40" }));
    expect(formatDue(row, NOW, "This week").detail).toBe("40% so far");
  });

  it("says nothing on a row that is finished or has no partial score", () => {
    expect(
      formatDue(rowWith(member("graded", { scorePercent: "40" })), NOW, "This week").detail,
    ).toBeUndefined();
    expect(formatDue(rowWith(member("not_submitted")), NOW, "This week").detail).toBeUndefined();
  });

  it("yields to the credit wording, which is about the deadline", () => {
    const late = rowWith(
      member("not_submitted", { scorePercent: "40", creditRemaining: "80" }),
      { dueAt: undefined, lateDueAt: new Date(2026, 8, 22, 12, 0).toISOString() },
    );
    expect(formatDue(late, NOW, "Later").detail).toBe("80% credit until Tue 12:00 PM");
  });
});

describe("isLoginResponse", () => {
  it("recognises an expired session and not the real page", () => {
    expect(isLoginResponse(401, page.url, "")).toBe(true);
    expect(isLoginResponse(200, `${PRAIRIELEARN_ORIGIN}/pl/login`, "")).toBe(true);
    expect(isLoginResponse(200, page.url, fixtureHtml)).toBe(false);
  });
});

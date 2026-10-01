/**
 * The date grammar, against three fa26 pages a 30-site probe found it could
 * not read (2026-10-01):
 *
 * - ECE 220's MP table writes every deadline `10-04` — month and day, dashed,
 *   no year. "Nothing on that page looked like a schedule."
 * - ECE 220's exam table writes `Thu 10/01 at 7.00-8.20pm`: the clock is a
 *   range with dotted minutes and one meridiem, at the end. The start read as
 *   an ambiguous `7.00`, the end was left over as an unread clock, and the row
 *   was refused.
 * - CS 357's quiz cards write `10 Dec - 16 Dec`: the day first.
 *
 * Every assertion is the exact list the runner produces over the committed
 * capture (`fixtures/sites/README.md`).
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { adapterFromCandidate, proposeCandidates } from "../src/core/detect.js";
import { validateAdapter } from "../src/core/registry.js";
import { isLabelledList, repeatedStructures } from "../src/core/skeleton.js";
import { parseAdapterDateParts, runAdapter, supportedDateFormats } from "../src/sources/site.js";
import type { Adapter } from "../src/sources/types.js";

const ZONE = "America/Chicago";
const REFERENCE = "2026-10-01T15:00:00.000Z";

const load = (path: string) =>
  parseHTML(readFileSync(new URL(`../fixtures/sites/${path}`, import.meta.url), "utf8"))
    .document as unknown as Document;

const read = (raw: string, format: string) => parseAdapterDateParts(raw, format, ZONE, REFERENCE);

function adapter(fields: Record<string, unknown>): Adapter {
  const { adapter: valid, reason } = validateAdapter({
    id: "grammar-test",
    label: "Grammar test",
    courseCode: "TEST100",
    term: "fa26",
    hostPattern: "https://courses.grainger.illinois.edu/*",
    timezone: ZONE,
    minExtensionVersion: "0.1.0",
    ...fields,
  });
  if (!valid) throw new Error(reason);
  return valid as Adapter;
}

describe("MM-dd: ECE 220's MP table", () => {
  const URL_MPS = "https://courses.grainger.illinois.edu/ece220/fa2026/assignments/mps/";

  it("is a format an adapter may declare", () => {
    expect(supportedDateFormats()).toContain("MM-dd");
  });

  it("is proposed, and reads all twelve MPs on the days the table states", () => {
    const doc = load("ece220-fa2026-mps.html");
    const [top] = proposeCandidates(doc, REFERENCE, ZONE, repeatedStructures(doc, ZONE, REFERENCE));
    expect(top).toBeDefined();
    const entry = adapterFromCandidate(top!, URL_MPS, "ECE220", "fa26");
    expect(entry["dateFormat"]).toBe("MM-dd");
    const items = runAdapter(validateAdapter(entry).adapter as Adapter, doc, {
      url: URL_MPS,
      fetchedAt: REFERENCE,
    });
    // The page's header row sits inside its `<thead>` along with every other
    // row (the markup never opens a `<tbody>`), so it comes back undated; that
    // is the row selector's business, not the grammar's, and is left out here.
    expect(items.filter((item) => item.dueAt).map((item) => [item.title, item.dueAt])).toEqual([
      ["MP 01 - Printing histogram", "2026-09-03T23:59:00-05:00"],
      ["MP 02 - Stack calculator", "2026-09-10T23:59:00-05:00"],
      ["MP 03 - Pascal's triangle", "2026-09-17T23:59:00-05:00"],
      ["MP 04 - Debugging with GDB", "2026-09-24T23:59:00-05:00"],
      ["MP 05 - Codebreaker", "2026-10-04T23:59:00-05:00"],
      ["MP 06 - Game of Life", "2026-10-08T23:59:00-05:00"],
      ["MP 07 - Sudoku Solver", "2026-10-15T23:59:00-05:00"],
      ["MP 08 - 2048", "2026-10-22T23:59:00-05:00"],
      ["MP 09 - Maze", "2026-10-29T23:59:00-05:00"],
      ["MP 10 - Sparse Matrix", "2026-11-12T23:59:00-06:00"],
      ["MP 11 - Introduction to C++", "2026-11-19T23:59:00-06:00"],
      ["MP 12 - Anagrams", "2026-12-10T23:59:00-06:00"],
    ]);
    // A bare date states no clock: 23:59 is this code's, and says so.
    for (const item of items.filter((i) => i.dueAt)) expect(item.extra?.["timeAssumed"]).toBe("true");
  });

  it("reads the shapes the page writes, and a time beside one", () => {
    expect(read("10-04 (extended)", "MM-dd")?.iso).toBe("2026-10-04T23:59:00-05:00");
    expect(read("12-10 (extended, no drop)", "MM-dd")?.iso).toBe("2026-12-10T23:59:00-06:00");
    expect(read("Thu 10-01 at 7:00pm", "MM-dd")).toEqual({
      iso: "2026-10-01T19:00:00-05:00",
      timeAssumed: false,
    });
  });

  /*
   * A dash between two numbers is a range far more often than a date. Each of
   * these is a real thing a course page writes in a cell, and none is a day.
   */
  it.each([
    ["1-13", "a lecture range, one digit"],
    ["7-9pm", "a session, one digit"],
    ["10-12pm", "a session that is two digits each side"],
    ["10-12 pm", "the same with a space"],
    ["11-12 noon", "a session ending at noon"],
    ["10-11:30", "a session with minutes on its end"],
    ["10-11.30", "the same, dotted"],
    ["01-02-03", "a run of numbers"],
    ["10-04-2026", "a date this format does not claim to read"],
    ["13-01", "no thirteenth month"],
    ["00-10", "no month zero"],
    ["10-00", "no day zero"],
    ["10-32", "no day 32"],
    ["2026-10-04", "ISO, which is yyyy-MM-dd's"],
    ["10/04", "a slash, which is M/d's"],
  ])("does not read %s (%s)", (raw) => {
    expect(read(raw, "MM-dd")).toBeUndefined();
  });

  it("leaves the other formats as they were", () => {
    // `M/d` did not learn the dash: an adapter that declared it keeps reading
    // exactly what it read, and a `12-14` lecture range in its column is not
    // suddenly December 14.
    expect(read("10-04", "M/d")).toBeUndefined();
    expect(read("12-14", "M/d")).toBeUndefined();
  });
});

describe("a clock range: ECE 220's exam table", () => {
  const URL_EXAMS = "https://courses.grainger.illinois.edu/ece220/fa2026/evaluation/exams/";

  it("reads both midterms at the start of the range, with the meridiem lent from its end", () => {
    const entry = adapter({
      url: URL_EXAMS,
      rows: "#exam_schedule + div.ita-table tr",
      title: "td",
      due: "td",
      columns: { title: "Exam", due: "Date & Time" },
      dateFormat: "M/d",
      kind: "exam",
    });
    const items = runAdapter(entry, load("ece220-fa2026-exams.html"), { url: URL_EXAMS, fetchedAt: REFERENCE });
    expect(
      items.map((i) => [i.title, i.dueAt ?? null, i.extra?.["timeAssumed"] ?? null, i.extra?.["unparsedTime"] ?? null]),
    ).toEqual([
      // No `["Exam", null, …]` header row: a column read of the table's own
      // header row returns nothing since the proposer lane's fix (2026-10-01).
      ["Midterm 1", "2026-10-01T19:00:00-05:00", null, null],
      ["Midterm 2", "2026-11-05T19:00:00-06:00", null, null],
      ["Final Exam", null, null, null],
    ]);
  });

  it("lends a meridiem the way a reader would, not blindly", () => {
    const at = (raw: string) => read(raw, "M/d");
    expect(at("Thu 10/01 at 7.00-8.20pm")).toEqual({ iso: "2026-10-01T19:00:00-05:00", timeAssumed: false });
    // A start that would land after its own end is on the other side of noon.
    expect(at("10/01 at 11.30-12.45pm")?.iso).toBe("2026-10-01T11:30:00-05:00");
    expect(at("10/01 at 11:00-1:00pm")?.iso).toBe("2026-10-01T11:00:00-05:00");
    expect(at("10/01 at 12:00-1:00pm")?.iso).toBe("2026-10-01T12:00:00-05:00");
    expect(at("10/01 at 9:30-10:45am")?.iso).toBe("2026-10-01T09:30:00-05:00");
    expect(at("10/01 at 7:00 to 9:00pm")?.iso).toBe("2026-10-01T19:00:00-05:00");
    // The end's minutes count: 11:30 is before 11:45 in the morning.
    expect(at("10/01 at 11:30-11:45am")?.iso).toBe("2026-10-01T11:30:00-05:00");
    // A start equal to its end is on the same side of noon (deliberately degenerate).
    expect(at("10/01 at 7:00-7:00pm")?.iso).toBe("2026-10-01T19:00:00-05:00");
    // `am` inside a word after the end is not a meridiem: the start stays ambiguous.
    expect(at("10/01 at 7:00-8 Amphitheatre")?.unparsedTime).toBe("7:00");
  });

  it("consumes a range's end when the start already said which half of the day", () => {
    // The end used to be left behind as an unread clock, and the row refused.
    expect(read("10/01 at 7:00pm-9:00pm", "M/d")).toEqual({
      iso: "2026-10-01T19:00:00-05:00",
      timeAssumed: false,
    });
    expect(read("10/01 09:00-10:30", "M/d")).toEqual({ iso: "2026-10-01T09:00:00-05:00", timeAssumed: false });
  });

  it("keeps a range with no meridiem anywhere ambiguous", () => {
    // `7.00-8.20` is either end of the day; guessing would move it twelve hours.
    expect(read("10/01 at 7.00-8.20", "M/d")).toEqual({
      iso: "2026-10-01T23:59:00-05:00",
      timeAssumed: true,
      unparsedTime: "7:00",
    });
  });
});

describe("d MMM: CS 357's quiz cards", () => {
  const URL_QUIZZES = "https://cs357.cs.illinois.edu/pages/quizzes.html";

  it("reads every quiz window's first day", () => {
    const entry = adapter({
      url: URL_QUIZZES,
      hostPattern: "https://cs357.cs.illinois.edu/*",
      rows: "p.card-text",
      title: ".",
      titleFrom: "h4.title",
      due: ".",
      dueLabel: "CBTF quizzes during the period",
      dateFormat: "d MMM",
      kind: "quiz",
    });
    const items = runAdapter(entry, load("cs357-fa2026-quizzes.html"), {
      url: URL_QUIZZES,
      fetchedAt: REFERENCE,
    });
    // The runner names a labelled line `<heading> <label>`, as it does ECE 411's.
    const suffix = " CBTF quizzes during the period";
    for (const item of items) expect(item.title.endsWith(suffix)).toBe(true);
    expect(items.filter((i) => i.dueAt).map((i) => [i.title.replace(suffix, ""), i.dueAt])).toEqual([
      ["Quiz 1: Linear Algebra + Python + Errors", "2026-09-08T23:59:00-05:00"],
      ["Quiz 2: Floating Point, Rounding, Taylor Series", "2026-09-21T23:59:00-05:00"],
      ["Quiz 3: Monte Carlo, Norms and Linear System of Equations", "2026-10-12T23:59:00-05:00"],
      ["Quiz 4: Sparse, Conditioning, Eigenvalues and Markov Chains", "2026-10-26T23:59:00-05:00"],
      ["Quiz 5: Finite Differences, Nonlinear equations, Optimization", "2026-11-09T23:59:00-06:00"],
      ["Quiz 6: Linear least-squares and SVD", "2026-11-30T23:59:00-06:00"],
      ["Final Exam (TENTATIVE SCHEDULE)", "2026-12-10T23:59:00-06:00"],
    ]);
  });

  it.each([
    ["10 Dec", "2026-12-10T23:59:00-06:00"],
    ["08 Sep - 10 Sep", "2026-09-08T23:59:00-05:00"],
    ["1st September", "2026-09-01T23:59:00-05:00"],
    ["3 Sept.", "2026-09-03T23:59:00-05:00"],
    ["Thu, 10 Dec at 5pm", "2026-12-10T17:00:00-06:00"],
    ["10 of December", "2026-12-10T23:59:00-06:00"],
  ])("reads %s", (raw, iso) => {
    expect(read(raw, "d MMM")?.iso).toBe(iso);
  });

  it.each([
    ["10 Decimal places", "a month's letters at the start of another word"],
    ["3 Marks", "the same, for March"],
    ["12 Junior students", "and June"],
    ["Dec 10", "month first, which is MMM d's"],
    ["32 Dec", "no day 32"],
  ])("does not read %s (%s)", (raw) => {
    expect(read(raw, "d MMM")).toBeUndefined();
  });
});

describe("the search's loose shape learned both", () => {
  // `isLabelledList` gives a list a share of the structure budget only if one
  // of its labelled lines could hold a date. Built so that the dashed or the
  // day-first date is the only date-shaped thing on it.
  const list = (lines: string[]) => {
    const { document } = parseHTML(
      `<html><body><h3>Machine Problems</h3><ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul></body></html>`,
    );
    return document.querySelector("ul") as unknown as Element;
  };

  it("counts a dashed month-day as a date", () => {
    expect(isLabelledList(list(["Due: 10-04", "Due: 10-11"]))).toBe(true);
  });

  it("counts a day-first date as a date", () => {
    expect(isLabelledList(list(["Due: 10 Dec", "Due: 17 Dec"]))).toBe(true);
  });

  it("does not count a lecture range or a session", () => {
    expect(isLabelledList(list(["Lectures: 1-13", "Session: 10-12pm"]))).toBe(false);
  });

  it("does not count a dash whose month or day cannot be one", () => {
    expect(isLabelledList(list(["Lectures: 13-14", "Room: 10-45"]))).toBe(false);
    // Nor the tail of a longer number: a room and its seats.
    expect(isLabelledList(list(["Room: ECEB 1110-12", "Seats: 2011-05"]))).toBe(false);
  });

  it("does not count a number before a word that only starts like a month", () => {
    expect(isLabelledList(list(["Rounding: 10 Decimal places", "Grade: 3 Marks"]))).toBe(false);
  });
});

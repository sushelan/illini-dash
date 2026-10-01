/**
 * Course-site adapters (§4.5).
 *
 * Adapters are **data**: URLs, CSS selectors and a date format. There is no
 * expression language, no JS and no eval — MV3 forbids remotely loaded code,
 * and remote *data* is what makes a broken selector fixable without a store
 * re-review (§0 decision 4). If a site needs logic, the schema grows a new
 * declarative field; it never grows a script.
 */

import { inferYear, isRealWallClock, monthIndex, wallClockToIso, weekdayOf } from "../core/dates.js";
import { extractCourseCodes } from "../core/normalize.js";
import { KeyGuard, escapeRegex, sameOriginHttpsUrl, textOf } from "../core/parsing.js";
import {
  cellAt,
  columnOf,
  formTableGrid,
  gridFor,
  rowIndex,
  type GridCache,
  type TableGrid,
} from "../core/table-grid.js";

// Re-exported so a caller that wants to run the locators can pass a cache
// without also knowing where the grid lives. `runAdapter` owns one per run.
export type { GridCache } from "../core/table-grid.js";
import { ParseError, type Adapter, type Kind, type PageCtx, type RawItem } from "./types.js";

/**
 * A selector, optionally reading an attribute instead of the text:
 * `time@datetime`, `a@href`. The only piece of syntax in the whole schema.
 */
function select(row: Element, spec: string): string | undefined {
  const [selector, attribute] = spec.split("@");
  const node = selector && selector !== "." ? row.querySelector(selector) : row;
  if (!node) return undefined;
  const value = attribute ? node.getAttribute(attribute) : textOf(node);
  return value?.trim() || undefined;
}

/**
 * Column indices resolved from a table's own header row.
 *
 * House rule 3 in declarative form. `td:nth-child(2)` is wrong the moment a
 * course adds a column, and it fails *silently* — the date column becomes the
 * solutions column and every row lands undated or, worse, dated from the wrong
 * text. Naming the header instead means the index is re-derived on every parse,
 * so an added column costs nothing.
 *
 * Labels are matched **exactly** after whitespace and case are normalised, not
 * by substring (house rule 6). This page is its own counterexample: ECE 310's
 * schedule table has a header called "Assessment Due" whose cells hold "HW1",
 * while its homework table has "Due Date" whose cells hold the dates. A
 * substring match on "due" picks the first and dates every row from an
 * assignment name.
 */
export function headerIndex(table: Element, grids: GridCache = new Map()): Map<string, number> {
  // Once per table, not once per row: the map is a property of the table and
  // the cache already holds one object per table to hang it on.
  let grid = grids.get(table);
  if (grid?.headers) return grid.headers;
  if (!grid) {
    grid = formTableGrid(table);
    grids.set(table, grid);
  }
  const headerRow =
    table.querySelector("thead tr") ??
    // Some pages skip <thead>; the first row that is all <th> is the header.
    [...table.querySelectorAll("tr")].find(
      (row) => row.querySelector("th") && !row.querySelector("td"),
    ) ??
    mostlyHeaderFirstRow(grid);
  const map = new Map<string, number>();
  grid.headers = map;
  if (!headerRow) return map;
  grid.headerRow = headerRow;
  /*
   * The **grid slot**, not the header cell's position among its siblings.
   *
   * A `<th colspan="2">` occupies two columns, so every header after it sits
   * one further right than counting children says — and `cellByHeader` would
   * then read the column before the one the adapter named, silently, on every
   * row. The grid is the one place that arithmetic lives.
   */
  // A header row this table's grid does not know is one inside a *nested*
  // table, which is not this table's header row at all.
  if (rowIndex(grid, headerRow) === undefined) return map;
  for (const cell of [...headerRow.children]) {
    const slot = columnOf(grid, cell);
    if (slot === undefined) continue;
    const label = textOf(cell).replace(/\s+/g, " ").trim().toLowerCase();
    // First wins: a table with two identically-named columns is ambiguous, and
    // silently taking the last would be a coin flip.
    if (label && !map.has(label)) map.set(label, slot);
  }
  return map;
}

/**
 * The table's first row, when more of its cells are `<th>` than `<td>`.
 *
 * CS 421's WA table opens `<td>WA No."</td><th>Topic:</th><th>Issued:</th>
 * <th>Due at 23:59 CT …</th>…` — a header row with one cell mistyped, which
 * the all-`<th>` rule above refuses, leaving a table with no header to name
 * and every column unreadable. Only the *first* row, and only by majority:
 * its body rows open with a row-header `<th>MP1</th>` and four `<td>`s, and a
 * body row is never the header because it has a `<th>` in it.
 */
function mostlyHeaderFirstRow(grid: TableGrid): Element | undefined {
  const first = [...grid.index].find(([, y]) => y === 0)?.[0];
  if (!first) return undefined;
  const cells = [...first.children];
  const th = cells.filter((cell) => cell.tagName === "TH").length;
  return th > cells.length - th ? first : undefined;
}

/**
 * The index of the column an adapter named, or undefined.
 *
 * The single place the matching rule lives. It was briefly written out twice —
 * once here and once in the "is this column present at all" guard — and a
 * mutation that loosened one was masked by the other still being strict, which
 * is a good sign that two copies of one decision is one copy too many.
 *
 * Exact after normalising whitespace and case, never a substring: see
 * `headerIndex` for the "Assessment Due" counterexample on this very page.
 */
function resolveColumn(headers: Map<string, number>, name: string): number | undefined {
  return headers.get(name.replace(/\s+/g, " ").trim().toLowerCase());
}

/**
 * One row's cell for a named column, or undefined when the header is absent.
 *
 * `wanted` may list alternatives (`"Due Date|Deadline"`), because the same
 * column is called different things across courses and an adapter should not
 * need editing when only the wording differs.
 */
function cellByHeader(
  row: Element,
  wanted: string,
  attribute?: string,
  grids: GridCache = new Map(),
): string | undefined {
  const table = row.closest("table");
  if (!table) return undefined;
  const headers = headerIndex(table, grids);
  const grid = gridFor(row, grids);
  if (!grid) return undefined;
  /*
   * The header row read through its own column names is the header's words —
   * an item titled "Labs" with "Day" where its date should be (ECE 220, PHYS
   * 325). A table with no `<tbody>` has no row selector that leaves it out, so
   * it is left out here, where every column read goes through.
   */
  if (grid.headerRow === row) return undefined;
  for (const name of wanted.split("|")) {
    const index = resolveColumn(headers, name);
    if (index === undefined) continue;
    // Through the grid, so a rowspan in an earlier row — or a colspan in the
    // header — moves the column rather than shifting this row's cells under it.
    const cell = cellAt(grid, row, index);
    if (!cell) continue;
    if (attribute) {
      const node = cell.querySelector(`[${attribute}]`);
      const value = node?.getAttribute(attribute) ?? cell.getAttribute(attribute);
      if (value?.trim()) return value.trim();
      continue;
    }
    const text = textOf(cell).trim();
    if (text) return text;
  }
  return undefined;
}

/**
 * Whether any of a column spec's alternatives exists in this row's table.
 *
 * Used to tell "the column is there and this row's cell is empty" — normal, a
 * header row or a week with no homework — from "the column is gone", which is
 * a redesign and must be loud (§0 rule 3).
 */
function headerExists(row: Element, wanted: string, grids: GridCache = new Map()): boolean {
  const table = row.closest("table");
  if (!table) return false;
  const headers = headerIndex(table, grids);
  return wanted.split("|").some((name) => resolveColumn(headers, name) !== undefined);
}

/**
 * The text of the cell covering one grid slot, and whether a cell is there at
 * all.
 *
 * Two answers because the page-level guards need to tell them apart: no cell is
 * "the row is narrower than this column", which for a whole page means the
 * column is gone; an empty cell is an ordinary week with no homework.
 */
function cellBySlot(
  row: Element,
  slot: number,
  grids: GridCache,
): { cell?: Element; text?: string } {
  const grid = gridFor(row, grids);
  const cell = grid ? cellAt(grid, row, slot) : undefined;
  if (!cell) return {};
  const text = textOf(cell).trim();
  return { cell, ...(text ? { text } : {}) };
}

/* -------------------------------------------------------------------------- */
/* Declarative date formats                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Exported so `core/announce.ts` reads instructor prose with the *same* month,
 * weekday and time vocabulary a course page is read with. Two copies of this
 * list would drift the first time one of them learned "Sept."
 */
export const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";

/**
 * The optional bits real course pages put around a date.
 *
 * `WEEKDAY` — "Tue Sep 08", "Friday, September 4". `SEP` — the separator before
 * a time, which pages write as a comma, "at", "@", or an ISO "T".
 */
/** The bare name, without the trailing punctuation a date cell puts after it. */
export const WEEKDAY_NAME = "(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*";
const WEEKDAY = `${WEEKDAY_NAME}\\.?,?\\s+`;
/**
 * `WEEKDAY`, with the name captured, for the three date formats only.
 *
 * A separate constant because the prose grammar below also uses `WEEKDAY` and a
 * second `(?<weekday>…)` in one pattern is a syntax error. The capture is read
 * by `statedWeekday`, which only believes an exact spelling.
 */
const WEEKDAY_LEAD = `(?<weekday>${WEEKDAY_NAME})\\.?,?\\s+`;
export const SEP = "[\\s,]*(?:at|@|T)?[\\s,]*";

/**
 * The weekday spellings, listed out and longest first.
 *
 * `WEEKDAY_NAME`'s `[a-z]*` tail is fine as a *prefix*, where whatever follows
 * has to be a date and a wrong guess simply fails to parse. It is not fine
 * after one: "9/1 Monthly report at 5pm" would have "Monthly" swallowed as a
 * weekday and then read 5pm as this deadline's cutoff. `announce.ts` learned
 * the same thing about "monthly" and "satisfied" and answered it with an exact
 * table; this is that table, for the trailing position only.
 *
 * The list alone is not enough — `mon` is on it, and it matches the first three
 * letters of "Monthly" quite happily — so `WEEKDAY_AFTER` puts a `\b` after it.
 * Longest first so "Tuesday" is not read as "Tue" with "sday" left over.
 */
const WEEKDAY_AFTER_NAME =
  "(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday" +
  "|sun|mon|tues|tue|weds|wed|thurs|thur|thu|fri|sat)";

/**
 * The weekday a page prints *after* the date, and the footnote mark after that.
 *
 * CS 374 A writes "Tue Sep 01" and ECE 310 writes "09/03 Thu."; CS 425 writes
 * "9/13 11.59 PM Central Time (Sun)". Without this the trailing name is
 * leftover text, which is harmless — until the leftover *also* holds the clock,
 * because the formats are start-anchored and stop at the first thing they
 * cannot read. "09/24, Thursday 11.59 PM" landed at an invented 23:59 that
 * happened to be right, and "09/24, Thursday 5 PM" would have landed six hours
 * late while looking stated (worker rule 3).
 *
 * The footnote marks are on the end because a schedule that footnotes a date
 * ("08/27 Thu¹ — no discussion that week") puts the mark between the weekday
 * and anything else, and a leftover "¹" is enough to make `timeLikeTail` look
 * at text the parser had no business stopping before.
 */
const WEEKDAY_AFTER = `(?:[\\s,]*\\(?(?<weekdayAfter>${WEEKDAY_AFTER_NAME})\\b\\)?\\.?[¹²³⁴⁵⁶⁷⁸⁹⁰*†‡]*)?`;

/**
 * A stated time, in the three shapes that are not ambiguous.
 *
 * `h:mm` (or `h.mm`) with optional am/pm, a bare hour that *must* carry am/pm,
 * or a four-digit 24-hour clock that the page itself labels `hrs`. A bare "5"
 * with no meridiem is not read as a time at all: on a course page it could be
 * either, and guessing would put a 5 PM deadline at 05:00 — worse than
 * admitting the time is unknown, because it looks stated.
 *
 * Two additions, both from real fa26 pages:
 *
 * - **`.` as the minute separator.** CS 425 writes every deadline as
 *   "11.59 PM Central Time", on all eight of them. With only `:` the format
 *   stopped at the date and invented 23:59 — which happens to be the same
 *   instant, and so was invisible, but carried `timeAssumed` and would
 *   therefore have lost to any Canvas row (§5.3 + worker rule 3).
 * - **`hhmm hrs`.** "Tue 9/8 0930 - 1045 hrs." is how a lab page writes a
 *   session. Four digits with no separator are only a clock when the page says
 *   `hrs`: "Sep 11 1045" is far more likely to be a room, a section or a
 *   fragment of a year, so it is left unread. A range gives its start, for the
 *   reason `clockFromText` does — the start is when a student has to be there.
 */
export const TIME =
  `(?:(?<hour24>[01]\\d|2[0-3])(?<minute24>[0-5]\\d)` +
  `(?:\\s*(?:[-–—]|to)\\s*\\d{3,4})?\\s*hrs?\\b` +
  `|(?<hour>\\d{1,2})[:.](?<minute>\\d{2})\\s*(?<ampm>am|pm)?` +
  `|(?<hour12>\\d{1,2})\\s*(?<ampm12>am|pm))`;

/**
 * The same clock, named so it can stand *before* the date in one expression.
 *
 * CS 425's lectures page writes `MP1 due 11.59 PM 9/13 (Sun)`: the clock
 * first, then the day. Every format below is anchored at the start, so without
 * this the row read no date at all — and a row that reads no date is "not this
 * adapter's row" to the phrase reader, which dropped the three MP rows without
 * a word (2026-09-20, live). JavaScript refuses a group name used twice in one
 * pattern, so the leading copy carries a suffix and `clockGroups` reads either.
 */
const TIME_BEFORE = TIME.replace(/\(\?<([a-z0-9]+)>/g, "(?<$1Before>");
const CLOCK_FIRST = `(?:${TIME_BEFORE}[\\s,]*(?:on|@)?[\\s,]*)?`;

/**
 * The course week a page prints in front of the date: `Week 8 · 2026-10-12 23:59`.
 *
 * CS 341's home page writes every deadline that way, and the formats are
 * start-anchored, so the date behind it read as nothing and the page proposed
 * no schedule at all. Only a whole word `Week`, a number, and a separator — the
 * separator is required, so a bare "Week 8" can never be taken for a prefix and
 * leave its number to be read as a day. The week number itself is discarded:
 * the date beside it is the stated value, and turning a week into a date would
 * mean inventing a term start (worker rule 3).
 */
const WEEK_FIRST = `(?:week\\s+\\d{1,2}\\s*[·•|,:–—-]\\s*)?`;

/**
 * `MM-DD`, the way ECE 220's MP table writes every deadline: `10-04 (extended)`.
 *
 * A dash between two numbers is far more often a range than a date — lectures
 * `1-13`, a session `7-9pm`, `10-12pm`, `10-11:30` — so this reads one only in
 * the narrowest shape that page uses: **two** digits each side, a month that
 * exists (01–12) and a day that could (01–31), and nothing after it that makes
 * it a clock or a longer run of numbers (`10-12pm`, `10-11:30`, `01-02-03`,
 * `10-04.5`). `12-14` as a lecture range still reads as December 14; that is
 * why this is a format of its own, chosen for a page, rather than a spelling
 * `M/d` learned for every page that already declares it.
 *
 * Exported for `core/skeleton.ts`'s `DATE_SHAPED`, so the shape the search
 * calls a date and the shape the runner reads cannot drift apart (mutation
 * house rule 3). The group names are stripped there.
 */
export const DASHED_MONTH_DAY =
  `(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])` +
  `(?![\\d:]|[.\\-–—/]\\d|\\s*(?:am|pm|a\\.m|p\\.m|noon)\\b)`;

/**
 * A month name spelled exactly, for the position where `[a-z]*` is not safe.
 *
 * `MMM d` can afford `${MONTHS}[a-z]*` because a number has to follow it. After
 * a number nothing does, so `10 Decimal places` would read as December 10 —
 * every spelling is listed and a letter may not follow it (parser rule 6).
 */
const MONTH_EXACT =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?" +
  "|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

/**
 * `10 Dec`, `1st September`: the day first, as CS 357's quiz page writes its
 * windows (`CBTF quizzes during the period: 10 Dec - 16 Dec`). Exported for
 * the same reason as `DASHED_MONTH_DAY`.
 */
export const DAY_FIRST_DATE =
  `(?<day>\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?<month>${MONTH_EXACT})\\.?(?![a-z])`;

/** One wall-clock reading: what a page stated, or what an adapter defaults to. */
export interface Clock {
  hour: number;
  minute: number;
}

/**
 * `defaultTime`'s shape: `HH:mm`, 24-hour, anchored.
 *
 * Positively, not `Number(x.split(":")[0])` — house rule 5: `Number("")` is 0,
 * so an empty or malformed `defaultTime` would land every deadline on the page
 * at midnight, which is a whole day early and looks exactly like a real answer.
 */
export const DEFAULT_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `"21:00"` → `{ hour: 21, minute: 0 }`, or undefined when it is not one. */
export function clockOf(hhmm: string): Clock | undefined {
  const match = DEFAULT_TIME.exec(hhmm);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : undefined;
}

/** `TIME`'s alternatives, coalesced — and the ambiguity rule, in one place. */
export interface ClockGroups {
  /**
   * The hour the text wrote, with the meridiem already applied. Undefined when
   * the text wrote no clock at all.
   */
  hour?: number;
  minute: number;
  /**
   * True when a clock is written but could mean either end of the day.
   *
   * A bare `h:mm` under 13 with no meridiem: "5:00" on a course page is
   * genuinely either, and reading it as 05:00 moves a 5 PM deadline twelve
   * hours while looking exactly like a stated time. A leading zero settles it
   * (nobody writes an evening deadline as "09:00"), and so does the page
   * writing `hrs`.
   */
  ambiguous: boolean;
  /** The clock as the text wrote it (`"5"`, `"5:00"`), for recording a failure. */
  written?: string;
}

/**
 * Reads `TIME`'s named groups into one clock.
 *
 * Exported and used by `core/announce.ts` as well, because instructor prose and
 * a course page must read a clock the same way — and the ambiguity rule above
 * is the single rule in this file most likely to be re-derived wrongly. It was
 * written out twice for a while, and mutation house rule 3 is exactly that
 * case: a mutation to one copy is masked by the other staying strict.
 *
 * The range check is deliberately *not* here. The two callers disagree about
 * what an out-of-range hour means — this file lets `isRealWallClock` reject the
 * whole date, `announce.ts` records it and falls back to 23:59 — and folding
 * one of those answers in here would change the other's behaviour silently.
 */
export function clockGroups(g: Record<string, string | undefined>): ClockGroups {
  const rawHour =
    g["hour"] ?? g["hour12"] ?? g["hour24"] ?? g["hourBefore"] ?? g["hour12Before"] ?? g["hour24Before"];
  if (rawHour === undefined) return { minute: 0, ambiguous: false };
  const rawMinute = g["minute"] ?? g["minute24"] ?? g["minuteBefore"] ?? g["minute24Before"];
  const ampm = (g["ampm"] ?? g["ampm12"] ?? g["ampmBefore"] ?? g["ampm12Before"])?.toLowerCase();
  // `0930 hrs` is 24-hour by the page's own say-so, so it is never ambiguous.
  const ambiguous =
    g["hour24"] === undefined &&
    g["hour24Before"] === undefined &&
    ampm === undefined &&
    rawMinute !== undefined &&
    Number(rawHour) < 13 &&
    !/^0\d$/.test(rawHour);
  let hour = Number(rawHour);
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  return {
    hour,
    minute: rawMinute === undefined ? 0 : Number(rawMinute),
    ambiguous,
    written: rawMinute === undefined ? rawHour : `${rawHour}:${rawMinute}`,
  };
}

/**
 * Token formats an adapter may declare. Deliberately a closed set: an adapter
 * cannot supply a pattern, only choose one, so a bad registry entry can produce
 * a wrong *selector* but never arbitrary matching behaviour.
 *
 * Each is anchored at the start only, because pages append things this parser
 * has no business understanding ("US Central time", "(no late work)"). What is
 * *not* ignored is a tail that still looks like a time: see `timeLikeTail`.
 */
const DATE_FORMATS: Record<string, RegExp> = {
  // 2026-09-11 · 2026-09-11 23:59 · Fri, 2026-09-11 at 18:00
  "yyyy-MM-dd": new RegExp(
    `^${WEEK_FIRST}(?:${WEEKDAY_LEAD})?${CLOCK_FIRST}(?<year>\\d{4})-(?<month>\\d{1,2})-(?<day>\\d{1,2})` +
      `${WEEKDAY_AFTER}(?:${SEP}${TIME})?`,
    "i",
  ),
  // Sep 11 · September 11 at 11:59pm · Tue, Sep 8 · Friday, September 4 at 18:00
  "MMM d, h:mm a": new RegExp(
    `^${WEEK_FIRST}(?:${WEEKDAY_LEAD})?${CLOCK_FIRST}(?<month>${MONTHS})[a-z]*\\.?\\s+(?<day>\\d{1,2})(?:st|nd|rd|th)?` +
      `${WEEKDAY_AFTER}(?:${SEP}${TIME})?`,
    "i",
  ),
  // 9/11 · 9/11/2026 · 09/04 @ 11:59pm · Tue 9/8 · 09/24, Thursday 11.59 PM · 11.59 PM 9/13
  "M/d": new RegExp(
    `^${WEEK_FIRST}(?:${WEEKDAY_LEAD})?${CLOCK_FIRST}(?<month>\\d{1,2})/(?<day>\\d{1,2})(?:/(?<year>\\d{2,4}))?` +
      `${WEEKDAY_AFTER}(?:${SEP}${TIME})?`,
    "i",
  ),
  // 10-04 · 10-04 (extended) · Thu 10-01 at 7:00pm — two digits each side, see DASHED_MONTH_DAY
  "MM-dd": new RegExp(
    `^${WEEK_FIRST}(?:${WEEKDAY_LEAD})?${CLOCK_FIRST}${DASHED_MONTH_DAY}` +
      `${WEEKDAY_AFTER}(?:${SEP}${TIME})?`,
    "i",
  ),
  // 10 Dec · 1st September at 5pm · Thu, 10 Dec
  "d MMM": new RegExp(
    `^${WEEK_FIRST}(?:${WEEKDAY_LEAD})?${CLOCK_FIRST}${DAY_FIRST_DATE}` +
      `${WEEKDAY_AFTER}(?:${SEP}${TIME})?`,
    "i",
  ),
};

/**
 * Whether the text this parser did not consume still looks like a time.
 *
 * The formats are start-anchored, so `09/04 @ 11:59pm` used to match `09/04`,
 * discard the rest, and report `timeAssumed` — inventing 23:59 while the real
 * cutoff sat unread in the same string. Now the leftover is inspected: if it
 * contains something time-shaped, that is an unreadable *value* and house rule
 * 1 says record it and keep the row, rather than quietly pretending the page
 * stated nothing.
 */
export function timeLikeTail(tail: string): string | undefined {
  const trimmed = tail.trim();
  if (trimmed === "") return undefined;
  // `\d{4}\s*hrs?` is here for the same reason the rest is: `TIME` reads
  // "0930 hrs" only where `SEP` can reach it, so a lab page that writes the
  // session further along the line leaves a clock behind, and an unflagged
  // leftover reads as "the page stated no time".
  //
  // `11.59` with no meridiem is deliberately *not* listed. `\d\s*(?:am|pm)`
  // already catches every dotted time a page actually writes — CS 425's is
  // "11.59 PM" — and `\d{1,2}\.\d{2}` on its own would flag "worth 12.50
  // points" as an unreadable clock on every row that says so.
  return /\d{1,2}\s*:\s*\d{2}|\d\s*(?:am|pm)\b|\bnoon\b|\bmidnight\b|\b\d{4}\s*hrs?\b/i.test(trimmed)
    ? trimmed.slice(0, 120)
    : undefined;
}

/**
 * A cutoff the row states in prose, when the date cell states none.
 *
 * ECE 391's schedule prints `Fri, Aug 28 | MP0 due at 18:00 US Central time` —
 * the date in one cell, the time in the other, inside the title. The date cell
 * parses cleanly and states no time, so `timeAssumed` fired and the row landed
 * at 23:59. **Six hours late, and a two-hour reminder for it would arrive at
 * 21:59 — nearly four hours after the deadline had passed.** A tracker that is
 * confidently wrong about a cutoff is worse than one that admits it does not
 * know, which is worker rule 3: whenever a default is filled in, ask what
 * downstream treats it as authoritative. §5.3 ranks `site` above `canvas`.
 *
 * Anchored on the word that makes it a deadline. A schedule row is full of
 * times — lecture slots, office hours, discussion sections — and the only one
 * that is this row's cutoff is the one the sentence attaches to "due". Matching
 * any time in the row would read "Lect 9:00, MP1 due" as a 9am deadline.
 *
 * The ambiguity rule from `parseAdapterDateParts` applies unchanged: a bare
 * `5:00` with no meridiem could be either end of the day, and guessing would
 * move a 5 PM deadline twelve hours. Ambiguous stays unstated.
 */
export function statedTimeInText(text: string): { hour: number; minute: number } | undefined {
  const match =
    /\bdue\b[^.;]{0,24}?\b(?:at|by)\s+(?:(\d{1,2})\s*:\s*(\d{2})\s*([ap]m)?|(\d{1,2})\s*([ap]m)|(noon|midnight))/i.exec(
      text,
    );
  if (!match) return undefined;

  const word = match[6]?.toLowerCase();
  if (word === "noon") return { hour: 12, minute: 0 };
  if (word === "midnight") return { hour: 0, minute: 0 };

  if (match[4] !== undefined) {
    let hour = Number(match[4]);
    const ampm = match[5]!.toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    return hour <= 23 ? { hour, minute: 0 } : undefined;
  }

  const raw = match[1]!;
  const minute = Number(match[2]);
  const ampm = match[3]?.toLowerCase();
  // Same test as the date parser: 24-hour only when it cannot mean anything
  // else — past noon, or written with a leading zero.
  if (ampm === undefined && Number(raw) < 13 && !/^0\d$/.test(raw)) return undefined;
  let hour = Number(raw);
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  return hour <= 23 && minute <= 59 ? { hour, minute } : undefined;
}

/* -------------------------------------------------------------------------- */
/* List-shaped pages: "label: value" lines under a heading                     */
/* -------------------------------------------------------------------------- */

/**
 * The one normalisation used for every exact name comparison in this file —
 * column headers, due labels, title prefixes. Whitespace collapsed, case
 * folded, nothing else. Kept as one function for the reason `resolveColumn`
 * exists: two copies of a matching rule means a mutation to one is masked by
 * the other (mutation house rule 3).
 */
function normalizeLabel(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** The scope separator in a `titleFrom` / `time` spec: `section >> h3`. */
const SCOPE_SEP = ">>";

export interface DueLabelMatch {
  /** The label as the **registry** spells it, not as the page does. */
  label: string;
  /** Everything after the first colon: what the date parser is handed. */
  rest: string;
}

/**
 * A `<label>: <value>` line, when the label is one the adapter declared.
 *
 * The third page shape. ECE 411's Sphinx page has no table at all — each MP is a
 * `<section>` with an `<h3>` and a `<ul>` of `Release: 8/25`, `Due: 9/7`,
 * `CP1 Due: TBD`. The date formats are `^`-anchored (deliberately: a format that
 * matched mid-string would read a date out of any prose), so `Due: 9/7` parses
 * as nothing at all until the label is taken off the front.
 *
 * Matched **exactly** after `normalizeLabel`, never by substring — house rule 6,
 * and the same rule `resolveColumn` follows for headers. `Due Date: 9/7` is a
 * different line from `Due: 9/7`, and a substring match on `Due` would claim
 * both; on a page that prints a `Release Due` line as well, that is a deadline
 * read off the release date. The label's *position* in the list varies by
 * section too — `mp_setup` puts `Due` second, `mp_ooo` has five labelled lines —
 * so `nth-child` is the wrong tool here for exactly house rule 3's reason.
 *
 * The declared spelling is returned rather than the page's, so the title suffix
 * below is decided by the registry and cannot be reworded by the page.
 */
export function matchDueLabel(text: string, spec: string): DueLabelMatch | undefined {
  const colon = text.indexOf(":");
  if (colon < 0) return undefined;
  const wanted = normalizeLabel(text.slice(0, colon));
  if (!wanted) return undefined;
  const rest = text.slice(colon + 1).replace(/\s+/g, " ").trim();
  if (!rest) return undefined;
  for (const candidate of spec.split("|")) {
    const declared = candidate.replace(/\s+/g, " ").trim();
    if (declared && normalizeLabel(declared) === wanted) return { label: declared, rest };
  }
  return undefined;
}

/**
 * What a matched label contributes to the title.
 *
 * `Due` contributes nothing: every deadline line on the page carries it, so it
 * names no item and `mp_setup Due` is just noise. What is left after it —
 * `CP1`, `Advance Features` — is the only thing telling three checkpoints of one
 * MP apart, and §3.1 hashes the title, so without it `mp_pipeline`'s CP1, CP2
 * and CP3 collide on one `sourceId` and `KeyGuard` keeps one of the three.
 */
export function labelSuffix(label: string): string {
  // `Date` is the same noun as `Due`: ECE 310's syllabus files each exam's
  // `Date: Wednesday, September 30th, 7-9pm` under the exam's name, and keeping
  // the label titled them `Midterm Exam 1 Date`.
  // `Time` is the same noun again: ECE 313 files each exam's `Time: Oct 12,
  // 7-8:30 PM` under the exam's own line, which is the whole name.
  return label
    .replace(/\s*\b(?:due(?:\s+date)?|date|time)\b\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Where `separator` first occurs as a separator, or -1.
 *
 * A colon inside a clock is not one: `HW1 due 9/20 11:59 PM (Sun)` has no
 * name before its colon, and cutting there titled the row `HW1 due 9/20 11`
 * (2026-09-20, the proposer offered it). Any other literal is taken as
 * written. Exported so the proposer decides "is every row named this way"
 * with the same rule the runner cuts by.
 */
export function titleSeparatorAt(text: string, separator: string): number {
  let from = 0;
  for (;;) {
    const at = text.indexOf(separator, from);
    if (at < 0) return -1;
    const inClock =
      separator === ":" && /\d$/.test(text.slice(0, at)) && /^\d\d/.test(text.slice(at + 1));
    if (!inClock) return at;
    from = at + 1;
  }
}

/**
 * The title a labelled row gets.
 *
 * Two shapes, one rule. When the row has a name of its own — ECE 411's `<h3>`,
 * reached by `titleFrom` — the suffix is appended to it: `mp_pipeline CP1`. When
 * the title cell *is* the due line (the syllabus prints `Midterm 1: September 29`
 * and nothing else), the cell carries no name beyond the label, so it is dropped
 * and the label is the whole title: `Midterm 1`.
 *
 * The fallback keeps a misconfigured adapter — `dueLabel: "Due"` with no
 * `titleFrom` — from producing an empty title rather than a visibly wrong one.
 */
export function titleWithLabel(base: string, label: string): string {
  const cleaned = base.replace(/\s+/g, " ").trim();
  const suffix = labelSuffix(label);
  const isDueLine = normalizeLabel(cleaned).startsWith(`${normalizeLabel(label)}:`);
  const joined = [isDueLine ? "" : cleaned, suffix].filter(Boolean).join(" ");
  return joined || cleaned;
}

/* -------------------------------------------------------------------------- */
/* Prose-shaped pages: the deadline is a clause in the middle of a sentence    */
/* -------------------------------------------------------------------------- */

/**
 * "No date yet", as course pages spell it — the vocabulary, not a whole rule.
 *
 * `core/detect.ts` builds `PLACEHOLDER_EXCLUDE` out of exactly these two
 * alternatives and should read them from here (mutation house rule 3). The
 * *questions* the two ask genuinely differ — detect asks whether a title
 * mentions a placeholder anywhere, this file asks whether the text right after
 * a due keyword *begins* with one — but the words are one decision.
 */
export const PLACEHOLDER_WORDS = "TB[DA]|N/?A";
const PENDING_AT_START = new RegExp(`^(?:${PLACEHOLDER_WORDS})\\b`, "i");

/**
 * A date token, loosely, anchored at the start.
 *
 * Its whole job is to decide whether a `duePhrase` keyword is *this row's
 * deadline keyword* or a word in a sentence. It has to be anchored: "Due for
 * the students on 9/13" would otherwise hook, and the text handed to the
 * start-anchored format begins "for the students", so the row would come out
 * undated with the date sitting unread inside `unparsedDate`.
 *
 * Deliberately looser than `DATE_FORMATS` — it accepts all three shapes at once
 * and does not care which the adapter declared — because being generous here
 * costs one attempt at parsing and being strict costs a row. `skeleton.ts` has
 * a `DATE_SHAPED` of the same vocabulary for the same reason; it cannot be
 * imported, because `skeleton.ts` imports this file and a value import back
 * would be a runtime cycle. Exported so the search reads it from here instead
 * of keeping a third copy.
 *
 * `MM-dd` and `d MMM` are deliberately **not** here, though `skeleton.ts`'s
 * copy has them. This one is also `firstDateIn`'s scanner, which tries every
 * word of a sentence: `Lectures 12-14 cover…` and `HW 1 may be late` would
 * stop it in front of a lecture range or a verb, ahead of the real date later
 * in the clause. Those two shapes are read where a page puts them in a cell of
 * their own, which is the only place either has been seen.
 */
export const DATE_SHAPED = new RegExp(
  `^(?:${WEEKDAY})?(?:\\d{1,2}[:.]\\d{2}\\s*(?:am|pm)?[\\s,]*(?:on|@)?[\\s,]*|\\d{1,2}\\s*(?:am|pm)[\\s,]*(?:on|@)?[\\s,]*)?` +
    `(?:\\d{1,2}/\\d{1,2}|\\d{4}-\\d{1,2}-\\d{1,2}` +
    `|(?:${MONTHS})[a-z]*\\.?\\s+\\d{1,2})\\b`,
  "i",
);

/**
 * What a page may put between the due keyword and the date.
 *
 * At most one connector word, and the punctuation around it: CS 425 writes
 * "Due @ 9/13", "HW2 due 10/4", "Due Date: TBD" and "Due @ 9/20 at 11.59 PM"
 * on the same page. Bounded on purpose — an unbounded skip would let "due for
 * the students on 9/13" hook, and then any sentence mentioning a deadline and a
 * date anywhere would become a row.
 *
 * `date` and `deadline` are here rather than in the keyword list because a
 * registry entry says `duePhrase: "due"` and should not have to enumerate every
 * noun a course writes after it.
 */
const DUE_CONNECTOR = /^[\s.,;:@\-–—]*(?:date|deadline)?[\s.,;:@\-–—]*(?:on|by|at)?[\s.,;:@\-–—]*/i;

/** One place in a row's text where the adapter's due keyword hooked. */
export interface DuePhraseHit {
  /** Everything after the keyword and its connector: what the parser is given. */
  rest: string;
  /**
   * The keyword was followed by TBD/TBA/N/A rather than a date.
   *
   * Still a hook — the page *is* naming this row's deadline, it just has not
   * set one — so the row is kept and reported undated rather than skipped as
   * "not this adapter's row". The two are different facts and §11 treats them
   * differently: a skipped row is silence, an undated one says "the course has
   * not said yet".
   */
  pending: boolean;
}

/**
 * Every place a `duePhrase` keyword introduces a date, in document order.
 *
 * The third page shape's answer to `matchDueLabel`. CS 425 has no table, no
 * `label: value` lines and no element around the date — the deadline is a
 * clause in the middle of a sentence:
 *
 *     [MP1 Specification Document]: Released 8/25. Due @ 9/13 11.59 PM
 *     Central Time (Sun). Demos on 9/14 (Mon).
 *
 * Three dates in one row and only the middle one is the deadline. So the
 * keyword is what selects it, matched as a **whole word** (house rule 6, and
 * this page is its own counterexample: "Overdue" and "the due-date" both
 * contain "due", and the row above would date from the release otherwise), and
 * a keyword only counts when something date-shaped follows it within one
 * connector. That last rule is what keeps `MPs are always due on a SUNDAY at
 * 11.59 PM Central Time` — a real bullet on this page, with no date in it at
 * all — from becoming an undated row claiming to be a deadline.
 *
 * Every occurrence is returned rather than the first, because the first may be
 * unreadable and the second the real one; the runner takes the first that
 * parses.
 */
export function matchDuePhrase(text: string, spec: string): DuePhraseHit[] {
  // The public shape is the two fields a caller has always had. `at` is dropped
  // here rather than added to `DuePhraseHit`, because it answers a different
  // question — see `duePhraseHits`.
  return duePhraseHits(text, spec).map(({ rest, pending }) => ({ rest, pending }));
}

/** A hook, and where in the text the keyword was. */
interface DuePhraseHitAt extends DuePhraseHit {
  /** The index of the keyword, so the caller can read what stands in front of it. */
  at: number;
}

/**
 * `matchDuePhrase`, with the position kept.
 *
 * `clauses` names an event after the row — `MP2` out of `MP2 due 11.59 PM
 * 9/27` — and the only thing that says where `MP2` ends is where the keyword
 * begins. Written here rather than by a second keyword regex at the call site:
 * "whole word, longest first, escaped" is one decision and a mutation to one
 * copy of it would be masked by the other staying strict (mutation house rule
 * 3).
 */
function duePhraseHits(text: string, spec: string): DuePhraseHitAt[] {
  const keywords = spec
    .split("|")
    .map((word) => word.trim())
    .filter(Boolean)
    // Longest first, so `"due|due date"` cannot have the short one shadow the
    // long one at the same position.
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex);
  if (keywords.length === 0) return [];

  const hits: DuePhraseHitAt[] = [];
  const pattern = new RegExp(`\\b(?:${keywords.join("|")})\\b`, "gi");
  for (const match of text.matchAll(pattern)) {
    const rest = text.slice(match.index + match[0].length).replace(DUE_CONNECTOR, "").trim();
    if (DATE_SHAPED.test(rest)) hits.push({ rest, pending: false, at: match.index });
    else if (PENDING_AT_START.test(rest)) hits.push({ rest, pending: true, at: match.index });
  }
  return hits;
}

/**
 * The part of a title cell before a literal separator (`titleBefore`).
 *
 * CS 425's rows are one sentence: `[HW1 Document]: Released 8/27. Due @ 9/20…`.
 * The name is everything before the colon; the rest is the sentence the date
 * was read out of, and keeping it would put a paragraph in the popup's title
 * column *and* — since §3.1 hashes the title — change the row's `sourceId`
 * every time the course edited a word of it, losing any override on it.
 *
 * A literal, never a regex: this is remote data applied to every row, and a
 * regex here would be a ReDoS run against the whole page.
 *
 * The brackets go because they are the page's own list punctuation rather than
 * part of the name — "[MP1 Specification Document]" is the course writing a
 * bullet, not naming an item "[MP1 …]". Only when they wrap the *whole* head,
 * so a title that genuinely contains brackets keeps them.
 */
export function titleBefore(text: string, separator: string): string {
  const whole = text.replace(/\s+/g, " ").trim();
  const at = titleSeparatorAt(whole, separator);
  const head = (at < 0 ? whole : whole.slice(0, at)).trim();
  const bracketed = /^\[(.+)\]$/.exec(head);
  // Never empty: a row whose text begins with the separator would otherwise be
  // titled "", and a blank row is less recoverable than a visibly wrong one —
  // the same reason `titleWithLabel` has a fallback.
  return (bracketed ? bracketed[1]!.trim() : head) || whole;
}

/**
 * A row's text for a spec that climbs out of the row.
 *
 * `section >> h3` means: `row.closest("section")`, then `h3` inside it. A row in
 * a list has no title of its own — the name is the heading above the list — and
 * a selector run against the row can never reach it.
 */
export function resolveScoped(row: Element, spec: string): string | undefined {
  const at = spec.indexOf(SCOPE_SEP);
  if (at < 0) return undefined;
  const scopeSel = spec.slice(0, at).trim();
  const inner = spec.slice(at + SCOPE_SEP.length).trim();
  if (!scopeSel || !inner) return undefined;
  const scope = row.closest(scopeSel);
  if (!scope) return undefined;
  return select(scope, inner);
}

/**
 * The nearest match **preceding** the row in document order.
 *
 * The no-scope branch of `titleFrom`, for pages that put a heading and its list
 * side by side with no wrapper to climb to — which is the older Sphinx output
 * and plenty of hand-written pages.
 */
function nearestPreceding(row: Element, selector: string): string | undefined {
  // Walked backwards rather than asked of `compareDocumentPosition`, which
  // linkedom does not implement faithfully — under it every heading on the page
  // answered "preceding", so the last one in the document won and every row on
  // the page inherited the same name. Silently, and with the right shape.
  for (let node = previousInDocumentOrder(row); node; node = previousInDocumentOrder(node)) {
    // An ancestor is reached by this walk too; a heading is never an ancestor of
    // a row, and a selector for which it could be would be a wrong selector.
    if (node.matches(selector)) return textOf(node) || undefined;
  }
  return undefined;
}

function previousInDocumentOrder(node: Element): Element | undefined {
  const sibling = node.previousElementSibling;
  if (!sibling) return node.parentElement ?? undefined;
  let last = sibling;
  while (last.lastElementChild) last = last.lastElementChild;
  return last;
}

/** §4.5's `titleFrom`: scoped, or the nearest preceding heading. */
export function resolveTitleFrom(row: Element, spec: string): string | undefined {
  return spec.includes(SCOPE_SEP) ? resolveScoped(row, spec) : nearestPreceding(row, spec);
}

/** `7`, `7:30`, `7:30 PM` — one clock, or undefined when it is not one. */
function readClock(
  rawHour: string,
  rawMinute: string | undefined,
  rawMeridiem: string | undefined,
): { hour: number; minute: number } | undefined {
  const ampm = rawMeridiem?.toLowerCase();
  // The same ambiguity rule as `parseAdapterDateParts` and `statedTimeInText`:
  // a bare hour under 13 with no meridiem could be either end of the day, and
  // reading `7` as 07:00 moves a 7 PM exam twelve hours while looking stated.
  if (ampm === undefined && Number(rawHour) < 13 && !/^0\d$/.test(rawHour)) return undefined;
  let hour = Number(rawHour);
  const minute = rawMinute === undefined ? 0 : Number(rawMinute);
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  return hour <= 23 && minute <= 59 ? { hour, minute } : undefined;
}

const CLOCK = "(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?";
const DASH = "(?:[-–—]|to)";
const CLOCK_RANGE = new RegExp(`^${CLOCK}\\s*${DASH}\\s*${CLOCK}\\.?$`, "i");
const CLOCK_ONE = new RegExp(`^${CLOCK}\\.?$`, "i");
/**
 * A clock, or a range, at the **start** of a text that goes on afterwards —
 * `7pm (no lecture)`, `7-9pm)`. The lookahead is what keeps `1002` from
 * reading as `10`: a clock ends where the digits and the meridiem end. A date
 * after a colon (`09/27`) is refused by `leadingClock`'s shape rule instead.
 */
const CLOCK_LEADING = new RegExp(
  `^${CLOCK}(?:\\s*${DASH}\\s*${CLOCK})?(?![a-z\\d:])`,
  "i",
);
/**
 * The words that introduce a clock in a sentence: `Midterm Exam 1 at 7pm`,
 * `Midterm 1:  7:00pm- 9:00pm`. A colon with a digit straight after it is
 * inside a clock, not in front of one — `10:30 lecture` must not read `30` as
 * a clock. "After a digit" was the first rule, and it lost `Midterm 1:`.
 */
const CLOCK_INTRODUCER = /(?:\bat\b|@|\(|:(?!\d))\s*/gi;

/**
 * In prose a clock has to *look* like one: minutes or a meridiem. `readClock`
 * takes a leading-zero `09` as 24-hour, which is right in a cell that holds a
 * time and wrong in a sentence — ECE 220's exam row ends `Deadline: 09/27`,
 * and the colon introduced `09`, so a 7pm midterm landed at 9am (2026-10-01,
 * found on the live page). `09-27` is the same mistake with a dash.
 */
function leadingClock(text: string): { hour: number; minute: number } | undefined {
  const match = CLOCK_LEADING.exec(text);
  if (!match) return undefined;
  const shaped = [match[2], match[3], match[5], match[6]].some((part) => part !== undefined);
  return shaped ? readClock(match[1]!, match[2], match[3] ?? match[6]) : undefined;
}

/**
 * The first clock a sentence introduces, for a row that states its exam's hour
 * in prose rather than in a cell of its own: ECE 391's `Midterm Exam 1 at 7pm`,
 * CS 374 A's `Midterm 1:  7:00pm- 9:00pm`, ECE 329's `Midterm Exam 1 (7:00pm-8:15
 * pm)`. Anchored on the introducing word for
 * `CLOCK_LABELLED`'s reason — a number after nothing is a room or a lecture.
 */
function introducedClock(text: string): { hour: number; minute: number } | undefined {
  for (const match of text.matchAll(CLOCK_INTRODUCER)) {
    const clock = leadingClock(text.slice(match.index + match[0].length));
    if (clock) return clock;
  }
  return undefined;
}
/**
 * Anchored on the word that makes a number a clock, exactly as
 * `statedTimeInText` is anchored on the word that makes one a deadline. A room
 * number is a number too: ECE 411's exam bullet reads
 * `Location: ECEB 1002 Time: 7-9PM`, and an unanchored search finds 1002 first.
 */
const CLOCK_LABELLED = new RegExp(
  `\\btime\\b\\s*:\\s*(${CLOCK}(?:\\s*${DASH}\\s*${CLOCK})?)`,
  "i",
);

/**
 * The clock an element states, for a page that prints the date and the time in
 * different places.
 *
 * ECE 411's syllabus lists `Midterm 1: September 29` with `Time: 7-9PM` in a
 * sibling `<li>`. Without this the date parses, states no time, and §4.5's
 * runner invents 23:59 — which worker rule 3 then lets outrank a real stated
 * deadline elsewhere, and which would put a two-hour reminder for a 7 PM exam
 * at 21:59, two hours after it ended.
 *
 * A range gives its **start**: an exam that runs 7-9PM starts at 7, and the
 * start is the instant a student has to be somewhere. A range written with one
 * meridiem (`7-9PM`) lends it to the start, which is what the page means.
 */
export function clockFromText(text: string): { hour: number; minute: number } | undefined {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return undefined;
  const labelled = CLOCK_LABELLED.exec(trimmed);
  const segment = labelled ? labelled[1]!.trim() : trimmed;

  const range = CLOCK_RANGE.exec(segment);
  if (range) return readClock(range[1]!, range[2], range[3] ?? range[6]);
  const one = CLOCK_ONE.exec(segment);
  if (one) return readClock(one[1]!, one[2], one[3]);
  // Reached only without a `Time:` label: a label captures a clock-shaped
  // segment, which one of the two above always matches and answers for.
  return introducedClock(trimmed) ?? meridiemRange(trimmed);
}

/**
 * A clock range that ends in a meridiem, anywhere in a sentence, as its start.
 *
 * The last resort, and the only clock read with nothing introducing it. ECE
 * 329 writes `Exam 1 Sep. 21 Mon 7:00-8:15pm`, where the grammar sees an
 * ambiguous `7:00`; CS 440 writes `sometime during the 8-11am timeslot`. Both
 * were exams landing at an invented 23:59. A *range closed by am/pm* is safe
 * to read bare where a lone number is not: a room is `1404`, a chapter range is
 * `3-5`, and neither ends in a meridiem.
 *
 * The meridiem is lent to the start only where that keeps the range in order:
 * `11-1pm` starts at 11am, not 11pm.
 */
const MERIDIEM_RANGE = new RegExp(
  `(?<![\\d:])${CLOCK}\\s*${DASH}\\s*(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)\\b`,
  "i",
);
function meridiemRange(text: string): { hour: number; minute: number } | undefined {
  const match = MERIDIEM_RANGE.exec(text);
  if (!match) return undefined;
  const end = readClock(match[4]!, match[5], match[6]);
  if (match[3] !== undefined) return readClock(match[1]!, match[2], match[3]);
  const lent = readClock(match[1]!, match[2], match[6]);
  if (!end || !lent) return lent;
  if (lent.hour * 60 + lent.minute <= end.hour * 60 + end.minute) return lent;
  return readClock(match[1]!, match[2], "am");
}

export function supportedDateFormats(): string[] {
  return Object.keys(DATE_FORMATS);
}

/**
 * Parses one date per the adapter's declared format and timezone.
 *
 * Returns undefined rather than throwing: §4.5 makes a zero-row page the
 * adapter's error, but one unreadable date is one row's problem — the same rule
 * every other source follows.
 */
export function parseAdapterDate(
  raw: string,
  format: string,
  timezone: string,
  reference: string,
): string | undefined {
  return parseAdapterDateParts(raw, format, timezone, reference)?.iso;
}

export interface AdapterDate {
  iso: string;
  /**
   * True when the source text carried a date but no time, so 23:59 local is
   * this code's invention rather than anything the course stated.
   *
   * It has to travel with the instant: §5.3 ranks `site` above `canvas` for
   * dueAt, which is right when the site prints a real time and wrong when it
   * prints none — a made-up 23:59 would otherwise silently overwrite a real
   * deadline an instructor set in Canvas, and the row would look authoritative.
   */
  timeAssumed: boolean;
  /**
   * A time that was there and could not be read confidently.
   *
   * Either a tail the format did not consume (`09/04 @ 11:59pm` used to match
   * `09/04` and silently drop the rest) or an ambiguous bare `5:00`. Surfaced
   * through `extra` so the popup marks the row rather than presenting an
   * invented 23:59 as if the page had said nothing.
   */
  unparsedTime?: string;
}

/** Exact weekday spellings, lower-case, to the "Sun".."Sat" `inferYear` reads. */
const WEEKDAY_SPELLINGS: Record<string, string> = {
  sun: "Sun", sunday: "Sun",
  mon: "Mon", monday: "Mon",
  tue: "Tue", tues: "Tue", tuesday: "Tue",
  wed: "Wed", weds: "Wed", wednesday: "Wed",
  thu: "Thu", thur: "Thu", thurs: "Thu", thursday: "Thu",
  fri: "Fri", friday: "Fri",
  sat: "Sat", saturday: "Sat",
};

/**
 * The weekday a date cell states, or undefined when it states none.
 *
 * Exact spellings only (parser rule 6). `WEEKDAY_NAME`'s `[a-z]*` tail lets
 * "Monthly" or "Saturnalia" through in front of a date, and slicing three
 * letters off those would turn a correct date into a contradiction and cost
 * the row its deadline. A word that is not a weekday is not a claim about one.
 */
function statedWeekday(name: string | undefined): string | undefined {
  if (name === undefined) return undefined;
  return Object.hasOwn(WEEKDAY_SPELLINGS, name.toLowerCase())
    ? WEEKDAY_SPELLINGS[name.toLowerCase()]
    : undefined;
}

/**
 * The end of a clock range the format stopped in front of, and what it settles.
 *
 * ECE 220 writes its midterms as `Thu 10/01 at 7.00-8.20pm`. `TIME` reads
 * `7.00` and stops: no meridiem, so the start is ambiguous, and `-8.20pm` is
 * left behind looking like an unread clock — the row was refused outright and
 * the exams table never proposed. A range written with one meridiem lends it
 * to the start, which is what the page means; `clockFromText` does the same
 * for `7-9PM`. Lent the way a reader would, not blindly: `11.30-12.45pm` starts
 * at 11:30, because a start that would land after its own end is on the other
 * side of noon.
 *
 * The end is consumed whether or not it settles anything, so `7:00pm-9:00pm`
 * and `09:00-10:30` stop reporting their end as an unparsed time. An end with
 * no meridiem (`7.00-8.20`) settles nothing, and the start stays ambiguous.
 */
const RANGE_END = /^\s*(?:[-–—]|to)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?(?![a-z\d:])\.?/i;

function rangeEnd(written: ClockGroups, rest: string): { written: ClockGroups; rest: string } {
  if (written.hour === undefined) return { written, rest };
  const end = RANGE_END.exec(rest);
  if (!end) return { written, rest };
  const consumed = rest.slice(end[0].length);
  const meridiem = end[3]?.toLowerCase();
  if (!written.ambiguous || meridiem === undefined) return { written, rest: consumed };
  const pm = meridiem === "pm" ? 12 : 0;
  const endAt = ((Number(end[1]) % 12) + pm) * 60 + Number(end[2] ?? 0);
  // No `% 12` on the start: a `12` that lands at 24 is past any end and wraps
  // to noon below, which is where `12:00-1:00pm` starts.
  let hour = written.hour + pm;
  if (hour * 60 + written.minute > endAt) hour = (hour + 12) % 24;
  return { written: { ...written, hour, ambiguous: false }, rest: consumed };
}

export function parseAdapterDateParts(
  raw: string,
  format: string,
  timezone: string,
  reference: string,
  /** A cutoff the row stated elsewhere; used only when this cell states none. */
  statedElsewhere?: Clock,
  /** §4.5's `defaultTime`: the hour this *page* says its work is due at. */
  defaultClock?: Clock,
): AdapterDate | undefined {
  const pattern = DATE_FORMATS[format];
  if (!pattern) return undefined;
  const match = pattern.exec(raw.trim());
  if (!match?.groups) return undefined;
  const g = match.groups;

  const month = g["month"]!.match(/^\d+$/)
    ? Number(g["month"])
    : monthIndex(g["month"]!.slice(0, 3).replace(/^./, (c) => c.toUpperCase()));
  if (month === undefined) return undefined;

  // TIME has three alternatives and the ambiguity rule is shared with
  // `announce.ts`, so both live in `clockGroups`.
  const { written, rest } = rangeEnd(clockGroups(g), raw.trim().slice(match[0].length));
  /*
   * A clock the grammar stopped short of. ECE 310 prints `Wednesday, September
   * 30th, 7-9pm`; the formats read no ranges, so the date parsed, the exam
   * landed at an invented 23:59 and `7-9pm` was filed as unparsed. A range
   * gives its start, the instant a student has to be in the room.
   */
  const trailing =
    written.hour === undefined ? leadingClock(rest.replace(/^\s*(?:,|\bat\b|@)?\s*/i, "")) : undefined;
  const stated = (written.hour !== undefined && !written.ambiguous) || trailing !== undefined;

  /*
   * Cell, then the row, then the page, then 23:59.
   *
   * The date cell wins: a time beside the date is this row's own answer. Then
   * `statedElsewhere` — a sentence in this row. Then `defaultClock`, which is a
   * rule the adapter wrote down about the *page* ("Written homeworks are due
   * every Tuesday at 9pm"), so a row that states something else means it and
   * has to win. Then the invention.
   *
   * That precedence is the `stated ?` and the `??` below and nowhere else. A
   * `stated ? undefined : statedElsewhere` guard was written here first and
   * **survived its mutation** — because these ternaries already reject exactly
   * what it rejected. Mutation house rule 2's third case: a second guard
   * duplicating a reachable one is not defence, it is another thing to read.
   */
  const fallback = statedElsewhere ?? defaultClock;
  const own = trailing ?? (stated ? { hour: written.hour!, minute: written.minute } : undefined);
  const hour = own ? own.hour : (fallback?.hour ?? 23);
  const minute = own ? own.minute : (fallback?.minute ?? 59);

  const parts = { month, day: Number(g["day"]), hour, minute };
  // Checked before inferYear, which builds candidate instants itself and would
  // otherwise throw out of a function whose contract is to return undefined.
  if (!isRealWallClock({ ...parts, year: 2000 })) return undefined;

  /*
   * §3.2: "if a weekday is present and doesn't match, try the adjacent years".
   * CS 374 A prints "Tue Sep 01", ECE 310 "09/03 Thu.", CS 425 "(Sun)" — the
   * weekday was consumed by the grammar and then thrown away, so a page that
   * contradicted itself was read as whichever half the parser liked. A weekday
   * no candidate year agrees with makes the date unreadable: undefined here,
   * and the runner keeps the row with the text in `unparsedDate` (rule 1).
   */
  const lead = statedWeekday(g["weekday"]);
  const after = statedWeekday(g["weekdayAfter"]);
  // "Tue 12/15 (Wed)" names two days for one date; neither half is believable.
  if (lead !== undefined && after !== undefined && lead !== after) return undefined;
  const weekday = lead ?? after;
  let year = g["year"] ? Number(g["year"]) : undefined;
  if (year !== undefined && year < 100) year += 2000;
  if (year === undefined) {
    year = inferYear(parts, weekday, reference, timezone);
    if (year === undefined) return undefined;
  } else if (weekday !== undefined) {
    // A stated year is not a guess, so there is no neighbour to try.
    if (!isRealWallClock({ ...parts, year })) return undefined;
    if (weekdayOf({ ...parts, year }, timezone) !== weekday) return undefined;
  }

  // Anything after the match that still looks like a time is a value this
  // parser failed to read, not text it was right to ignore.
  const leftover = trailing ? undefined : timeLikeTail(rest);
  const unparsedTime = written.ambiguous ? written.written : leftover;

  try {
    return {
      iso: wallClockToIso({ ...parts, year }, timezone),
      /*
       * Not assumed when the row said it, wherever in the row it said it — and
       * **still assumed** when it came from `defaultTime`, which is a rule an
       * adapter wrote down about the page rather than a clock this row states.
       * ECE 374 A prints "Written homeworks are due every Tuesday at 9pm" once,
       * in a paragraph above the list; 21:00 on a row is this extension's
       * inference from that sentence, and §5.3 must go on ranking a real Canvas
       * instant above it (worker rule 3).
       */
      timeAssumed: !stated && statedElsewhere === undefined,
      ...(unparsedTime ? { unparsedTime } : {}),
    };
  } catch {
    return undefined;
  }
}

/* -------------------------------------------------------------------------- */
/* Where the date is, and how it is read out of there                          */
/* -------------------------------------------------------------------------- */

/*
 * Two questions, answered separately and once each.
 *
 * "Where is this row's date" and "how is the date read out of that text" used
 * to be one tangle of `adapter.columns ? … : …` inside the runner, which meant
 * the *search* that proposes adapters had to re-derive both — and it derived
 * them slightly differently, which is how a proposal could validate against one
 * reading and be saved under another. Mutation house rule 3: one decision, one
 * copy. `core/detect.ts` calls these rather than guessing.
 */

/**
 * How many rows a positional column must date before it is believed, and what
 * share of the rows that have text there.
 *
 * A course schedule has section breaks, "no class" rows and the odd note, so
 * demanding every row is wrong. Demanding one is worse: any column with a stray
 * "9/11" in it would pass. The same two numbers decide whether the search
 * proposes a column at all, which is the point — a slot that clears the bar at
 * proposal time and stops clearing it later is a column that has moved, and
 * that is exactly what the runner has to be loud about.
 *
 * Also the home of `core/detect.ts`'s copies of these, which the search reads
 * from here (mutation house rule 3).
 */
export const MIN_DATED_ROWS = 2;
export const MIN_DATED_SHARE = 0.5;

/** Where a row's date text comes from. Ordered: the first one declared wins. */
export type DueLocator =
  | { kind: "column"; header: string }
  | { kind: "slot"; index: number }
  | { kind: "prev"; selector: string }
  | { kind: "selector"; spec: string };

/**
 * The nearest **preceding sibling** that matches, and its text.
 *
 * `duePrev`'s reader. ECE 374 A's homework page is a definition list — the date
 * is the `<dt>` and the assignment is the `<dd>` after it:
 *
 *     <dt>Tue Sep 01</dt><dd><a href="…">Homework 1</a>: Strings and induction</dd>
 *
 * The date is not inside the row, not in a cell of it, and not in an ancestor
 * either, so none of `select`, `cellByHeader` or `resolveScoped` can reach it.
 * `nearestPreceding` (which `titleFrom` uses) would, but it walks the whole
 * document backwards and would happily take a `<dt>` from the list above when a
 * row has no `<dt>` of its own — silently dating one assignment from another.
 * This stays inside the row's own parent for that reason.
 *
 * `@attr` is honoured, so a page that writes `<dt><time datetime="…">` can name
 * it; the plain form reads the whole element, which is what a wrapped
 * `<dt><em><strong>Wed Sep 09</strong></em></dt>` needs — the page uses that to
 * mark a week whose deadline moved, and a `dt > text()` reading would miss it.
 */
function previousSiblingMatching(row: Element, spec: string): string | undefined {
  const [selector, attribute] = spec.split("@");
  if (!selector) return undefined;
  for (let node = row.previousElementSibling; node; node = node.previousElementSibling) {
    if (!node.matches(selector)) continue;
    const value = attribute ? node.getAttribute(attribute) : textOf(node);
    return value?.trim() || undefined;
  }
  return undefined;
}

/** How the date is read out of the located text. */
export type DueReader =
  | { kind: "whole" }
  | { kind: "label"; labels: string }
  | { kind: "phrase"; keywords: string };

/**
 * `columns.due` beats `duePrev` beats `due`.
 *
 * They are mutually exclusive in the schema (`validateAdapter` refuses two), so
 * this order is belt to that braces; `due` is the fallback every entry carries
 * and is what an entry declaring neither of the others uses.
 */
export function dueLocatorOf(adapter: Adapter): DueLocator {
  if (adapter.columns) return { kind: "column", header: adapter.columns.due };
  if (adapter.dueSlot !== undefined) return { kind: "slot", index: adapter.dueSlot };
  if (adapter.duePrev) return { kind: "prev", selector: adapter.duePrev };
  return { kind: "selector", spec: adapter.due };
}

/**
 * `dueLabel` beats `duePhrase` beats the whole text.
 *
 * They are mutually exclusive in the schema (`validateAdapter` refuses both),
 * so the order here is belt to that braces rather than a real precedence.
 */
export function dueReaderOf(adapter: Adapter): DueReader {
  if (adapter.dueLabel) return { kind: "label", labels: adapter.dueLabel };
  if (adapter.duePhrase) return { kind: "phrase", keywords: adapter.duePhrase };
  return { kind: "whole" };
}

export interface DueLocation {
  /** The locator's hook is on the page: the column exists, the selector matched. */
  hookSeen: boolean;
  /** The reader hooked: a declared label matched, or a keyword introduced a date. */
  readerSeen: boolean;
  /** Candidate date texts in document order; the runner takes the first that parses. */
  texts: string[];
  /**
   * The located text itself, before the reader took the date out of it.
   *
   * What `clauses` cuts up, and what the search measures a separator against.
   * The reader's `texts` are everything *after* the keyword, so the words that
   * name the row — and every clause in front of the deadline's — are only here.
   */
  raw?: string;
  /** For `label`: the registry's spelling, which the title is built from. */
  label?: string;
  /** For `phrase`: every hook was a TBD/TBA/N/A placeholder, so no date exists yet. */
  pending?: boolean;
  /** For `phrase`: the text in front of the keyword, which is what names the row. */
  before?: string;
}

/**
 * The reader, applied to one string. The half of `locateDue` that is not a DOM.
 *
 * `clauses` asks the same question of each clause that `locateDue` asks of the
 * whole cell — "does this hook, and what would the date be read out of" — so
 * the rules live here once and both callers ask them (mutation house rule 3).
 */
function readDue(located: string, reader: DueReader): Omit<DueLocation, "hookSeen" | "raw"> {
  if (reader.kind === "whole") return { readerSeen: true, texts: [located] };
  if (reader.kind === "label") {
    const matched = matchDueLabel(located, reader.labels);
    return matched
      ? { readerSeen: true, texts: [matched.rest], label: matched.label }
      : { readerSeen: false, texts: [] };
  }
  const hits = duePhraseHits(located, reader.keywords);
  return {
    readerSeen: hits.length > 0,
    texts: hits.map((hit) => hit.rest),
    ...(hits.length > 0 && hits.every((hit) => hit.pending) ? { pending: true } : {}),
    ...(hits[0] ? { before: located.slice(0, hits[0].at).replace(/\s+/g, " ").trim() } : {}),
  };
}

/**
 * The date text(s) for one row, or why there are none.
 *
 * `hookSeen` and `readerSeen` are separate because the page-level guards below
 * need to tell "the hook is gone, the page was redesigned" from "the hook is
 * there and this row simply is not a deadline" — house rule 2's distinction,
 * and the only thing standing between a reworded page and a silent empty list.
 */
export function locateDue(row: Element, adapter: Adapter, grids: GridCache): DueLocation {
  const locator = dueLocatorOf(adapter);
  const slot = locator.kind === "slot" ? cellBySlot(row, locator.index, grids) : undefined;
  const located =
    locator.kind === "column"
      ? cellByHeader(row, locator.header, undefined, grids)
      : locator.kind === "slot"
        ? slot!.text
        : locator.kind === "prev"
          ? previousSiblingMatching(row, locator.selector)
          : select(row, locator.spec);
  const hookSeen =
    locator.kind === "column"
      ? headerExists(row, locator.header, grids)
      : locator.kind === "slot"
        ? slot!.cell !== undefined
        : located !== undefined;

  if (located === undefined) return { hookSeen, readerSeen: false, texts: [] };

  return { hookSeen, raw: located, ...readDue(located, dueReaderOf(adapter)) };
}

/** Where a row's title comes from. */
export type TitleLocator =
  | { kind: "column"; header: string }
  | { kind: "slot"; index: number }
  | { kind: "selector"; spec: string };

export function titleLocatorOf(adapter: Adapter): TitleLocator {
  if (adapter.columns) return { kind: "column", header: adapter.columns.title };
  if (adapter.titleSlot !== undefined) return { kind: "slot", index: adapter.titleSlot };
  return { kind: "selector", spec: adapter.title };
}

/** What the title guard says when no row reached one. */
function describeTitleLocator(locator: TitleLocator): string {
  if (locator.kind === "column") return `column ${JSON.stringify(locator.header)}`;
  if (locator.kind === "slot") return `column ${locator.index}`;
  return JSON.stringify(locator.spec);
}

export interface TitleLocation {
  /** The title cell is there at all. A header row legitimately has none. */
  hookSeen: boolean;
  /** The name, with `titleBefore` already applied. */
  text?: string;
}

export function locateTitle(row: Element, adapter: Adapter, grids: GridCache): TitleLocation {
  const locator = titleLocatorOf(adapter);
  const raw =
    locator.kind === "column"
      ? cellByHeader(row, locator.header, undefined, grids)
      : locator.kind === "slot"
        ? cellBySlot(row, locator.index, grids).text
        : select(row, locator.spec);
  if (raw === undefined) return { hookSeen: false };
  // Before `splitTitle` and before `filter`: both of those are written against
  // the name, and a filter matching a sentence the title cut off would keep
  // rows on the strength of words the student never sees.
  const text = adapter.titleBefore ? titleBefore(raw, adapter.titleBefore) : raw;
  return { hookSeen: true, ...(text ? { text } : {}) };
}

/* -------------------------------------------------------------------------- */
/* Several dated clauses in one cell (`clauses`)                               */
/* -------------------------------------------------------------------------- */

/**
 * One cell, cut at a literal separator.
 *
 * CS 425's lectures page puts two dated clauses in one cell — `MP2 due 11.59
 * PM 9/27 (Sun), Demos on 9/28 (Mon)` — and its assignments page puts three in
 * one `<li>`. Without the cut the demo is simply lost: the row is one item on
 * the deadline's day.
 *
 * A `.` between two digits is never a cut. The same page writes every deadline
 * as `11.59 PM`, so splitting there would leave `11` and `59 PM 9/27` and the
 * clock would be read as neither. `titleSeparatorAt` has the same rule for the
 * colon inside `11:59`, one field over and for the same page.
 */
export function splitClauses(text: string, separator: string): string[] {
  if (!separator) return [];
  const parts: string[] = [];
  let from = 0;
  // Advanced by the separator's own length, so a two-character one cannot match
  // overlapping itself and cut a part out of the middle of its predecessor.
  for (
    let at = text.indexOf(separator);
    at >= 0;
    at = text.indexOf(separator, at + separator.length)
  ) {
    if (separator === "." && /\d$/.test(text.slice(0, at)) && /^\d/.test(text.slice(at + 1))) {
      continue;
    }
    parts.push(text.slice(from, at));
    from = at + separator.length;
  }
  parts.push(text.slice(from));
  return parts.map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/**
 * A clause head that names a release rather than an occasion.
 *
 * `Released 8/25`, `HW2 out 9/21`, `MP4 out 11/10` are all real clauses on
 * these two pages, and every one of them carries a date. Nobody attends a
 * release: an event on that day is a line in the student's list for something
 * that needs no attendance and no submission, next to eight that do.
 */
/**
 * What a label or a column header says its date is: the deadline (2), the
 * start of something (0), or neither (1).
 *
 * CS 128's MP table is `# | Release Date-Time | Due Date-Time | Points`, and
 * both date columns read all eleven rows — so the proposer had nothing to
 * separate them and the release column, being first, was offered first: every
 * MP a week early. ECE 220's labs table is `Day | Labs | Submission due date`,
 * where `Day` dates two more rows and won on count, two days early on every
 * lab. CS 357's cards carry `CBTF registration starts: 27 Aug` above `CBTF
 * quizzes during the period: 08 Sep - 10 Sep`, and the label search took the
 * first — the day booking opens, not the quiz. One vocabulary for headers and
 * labels (mutation rule 3), here because `core/skeleton.ts` cannot import the
 * proposer.
 */
export const DEADLINE_WORDS = /\b(?:due|deadlines?|ends?|closes?)\b/i;
const START_WORDS =
  /\b(?:release[sd]?|start(?:s|ed)?|opens?|issued|assigned|out|begins?|day|registration|register)\b/i;

export function dateRole(text: string): 0 | 1 | 2 {
  if (DEADLINE_WORDS.test(text)) return 2;
  return START_WORDS.test(text) ? 0 : 1;
}

export const RELEASE_WORDS = /\b(?:released?|out|posted|available)\b/i;

/** What the words in front of a clause's date call it, and where the date starts. */
export interface ClauseDate {
  /** Everything before the date, with a trailing `on`/`@`/`:`/`,` taken off. */
  head: string;
  /** The clause from the date onward — what the date parser is handed. */
  text: string;
}

/** The connector a page puts between an event's name and its day. */
const HEAD_CONNECTOR = /(?:\s*[:,@]|\s+on)$/i;

/**
 * The first date in a clause, and what the clause calls it.
 *
 * The date formats are start-anchored (deliberately — a format that matched
 * mid-string would read a date out of any prose), so a clause has to be cut at
 * its date before it can be parsed at all. Only positions after whitespace are
 * tried, so `9/14` inside a word is not a date.
 *
 * The head is only the words **before** the date: `Demos on 9/14 (Mon)` is
 * "Demos", and `Review session on Sep 20 in ECEB 1002` is "Review session" and
 * not the room. Taking words from both sides would need a rule for where the
 * sentence ends, and every candidate for that rule is the separator this cell
 * was already cut at.
 *
 * So a clause that leads with its clock has no head at all — the clock is part
 * of the date token, because `11.59 PM 9/13` is how CS 425 writes one — and
 * `clauseEvents` drops it rather than inventing a name for it.
 */
export function firstDateIn(clause: string): ClauseDate | undefined {
  for (let at = 0; at < clause.length; at += 1) {
    if (at > 0 && !/\s/.test(clause[at - 1]!)) continue;
    if (!DATE_SHAPED.test(clause.slice(at))) continue;
    return {
      head: clause.slice(0, at).replace(/\s+/g, " ").trim().replace(HEAD_CONNECTOR, "").trim(),
      text: clause.slice(at),
    };
  }
  return undefined;
}

/** How long a name read off the front of a clause may be before it is a sentence. */
const EVENT_NAME_MAX = 40;

/** The clause the deadline is in, and what the row calls itself in front of it. */
interface DeadlineClause {
  at: number;
  text: string;
  /** The words before the keyword: `MP2` out of `MP2 due 11.59 PM 9/27`. */
  before: string;
}

/**
 * Which of a cell's clauses is the deadline.
 *
 * The reader decides, exactly as it does for a whole cell: the clause carrying
 * the keyword, or the declared label, or — with no reader — the first clause
 * that parses. Where several hook, the first that *parses* wins, which is the
 * occurrence rule the runner has always followed for a row with two "due"s in
 * it ("Due @ 12/13 … Resubmissions due @ 12/20").
 *
 * A hook that parses nothing still answers: `Due Date: TBD` is this row's
 * deadline clause and the course has simply not set a date.
 */
function deadlineClauseOf(
  parts: readonly string[],
  adapter: Adapter,
  timezone: string,
  reference: string,
): DeadlineClause | undefined {
  const reader = dueReaderOf(adapter);
  let first: DeadlineClause | undefined;
  for (const [at, text] of parts.entries()) {
    const read = readDue(text, reader);
    if (!read.readerSeen) continue;
    const hit = { at, text, before: read.before ?? "" };
    first ??= hit;
    if (
      read.texts.some((candidate) =>
        parseAdapterDateParts(candidate, adapter.dateFormat, timezone, reference),
      )
    ) {
      return hit;
    }
  }
  return first;
}

/** One dated clause that is not the deadline: something to turn up to. */
export interface ClauseEvent {
  title: string;
  dueAt: string;
  /** The clause stated no clock, so the instant carries this code's 23:59. */
  timeAssumed: boolean;
  /** The clause itself, for `extra.dueText`. */
  text: string;
}

/**
 * Every clause of one cell that is an occasion rather than the deadline.
 *
 * Pure over the located text, and the *only* implementation of these rules:
 * `runAdapter` calls it for the items it emits and the search calls it to
 * decide whether a separator is worth proposing, so a mutation to one of them
 * cannot be masked by the other reading the cell its own way (mutation house
 * rule 3).
 *
 * The name is the row's, not the clause's: `Demos on 9/28` says nothing about
 * which assignment's demo it is. The words in front of the keyword are used
 * where there are any — `MP2` out of `MP2 due 11.59 PM 9/27` — and the row's
 * own title otherwise, which is what the assignments page needs, where every
 * deadline clause starts with the word "Due".
 *
 * `filter.exclude` is applied here so an adapter can drop these; `filter.include`
 * deliberately is not. Include selects the rows that are deadlines — CS 424's
 * is `\bdue\b` — and applying it here would remove every demo on the page.
 */
export function clauseEvents(
  raw: string,
  adapter: Adapter,
  rowName: string,
  timezone: string,
  reference: string,
): ClauseEvent[] {
  if (!adapter.clauses) return [];
  const parts = splitClauses(raw, adapter.clauses);
  const deadline = deadlineClauseOf(parts, adapter, timezone, reference);
  // No clause hooks the reader, so nothing here is named as this row's
  // deadline and every dated clause would be guesswork.
  if (!deadline) return [];
  const name =
    deadline.before && deadline.before.length <= EVENT_NAME_MAX ? deadline.before : rowName;

  const exclude = adapter.filter?.exclude;
  const events: ClauseEvent[] = [];
  for (const [at, text] of parts.entries()) {
    if (at === deadline.at) continue;
    const found = firstDateIn(text);
    if (!found) continue;
    // A bare date is not an event: a clause that is nothing but a day has
    // nothing to put in a student's list.
    if (!found.head) continue;
    if (RELEASE_WORDS.test(found.head)) continue;
    /*
     * No `statedElsewhere` and no `defaultTime`.
     *
     * Both are answers to "when is this row's *deadline*" — the sentence that
     * says "due at 18:00", the page that says homework is due at 9pm — and a
     * demo is not the deadline. A clock inside the clause is read by the
     * grammar's own leading and trailing rules, and a clause with no clock is
     * marked assumed (worker rule 3).
     */
    const parsed = parseAdapterDateParts(found.text, adapter.dateFormat, timezone, reference);
    if (!parsed) continue;
    const title = name ? `${name}: ${found.head}` : found.head;
    if (exclude !== undefined && !matchesFilter(title, { exclude })) continue;
    events.push({ title, dueAt: parsed.iso, timeAssumed: parsed.timeAssumed, text });
  }
  return events;
}

/* -------------------------------------------------------------------------- */
/* The runner                                                                  */
/* -------------------------------------------------------------------------- */

function matchesFilter(title: string, filter: Adapter["filter"]): boolean {
  if (!filter) return true;
  try {
    if (filter.include && !new RegExp(filter.include, "i").test(title)) return false;
    if (filter.exclude && new RegExp(filter.exclude, "i").test(title)) return false;
  } catch {
    // A bad regex in remote data must not take the adapter down.
    return true;
  }
  return true;
}

/**
 * The loud check that pays for `dueSlot` being positional at all.
 *
 * House rule 3 forbids indexing cells by position because one added column
 * turns a page of dates into a page of undated, mis-statused items *with no
 * error*. `dueSlot` exists anyway, because CS 424's schedule has no header row
 * to anchor on and no class on its date cells either — there is nothing else to
 * name. So the guarantee has to come from the output instead of the input: a
 * date column reads as a date, and if it stops doing so on this page, the
 * column has moved and that is a redesign, not an empty term.
 *
 * Counted over **every matched row the reader hooks**, before the loop,
 * deliberately. A count
 * taken inside the loop would only see rows that already have a title, and on
 * a shifted grid those are a different, self-selected set — the check would be
 * asking the question of exactly the rows least able to answer it.
 *
 * The error names the column and both counts, because the fix is one registry
 * edit and the person making it needs to know whether the column moved by one
 * or vanished.
 */
function guardSlotHitRate(
  adapter: Adapter,
  rows: Element[],
  slot: number,
  page: PageCtx,
  grids: GridCache,
): void {
  let withText = 0;
  let dated = 0;
  for (const row of rows) {
    // Through the adapter's own reader, not the raw cell: under `duePhrase` a
    // slot's rows are the ones that say the word, and the rest are not this
    // adapter's rows at all. Counting every cell with text in it refused CS
    // 425's lectures table, where 8 of 33 lecture cells carry a deadline and
    // all 8 read (2026-09-20). With no reader declared this is the cell text.
    const located = locateDue(row, adapter, grids);
    if (!located.hookSeen || !located.readerSeen || located.texts.length === 0) continue;
    withText += 1;
    if (
      located.texts.some((text) =>
        parseAdapterDateParts(text, adapter.dateFormat, adapter.timezone, page.fetchedAt),
      )
    ) {
      dated += 1;
    }
  }
  if (withText === 0) {
    throw new ParseError(
      `adapter ${adapter.id}: ${rows.length} rows, none had a cell in column ${slot}`,
    );
  }
  if (dated < MIN_DATED_ROWS || dated / withText < MIN_DATED_SHARE) {
    throw new ParseError(
      `adapter ${adapter.id}: column ${slot} read as a date on ${dated} of ${withText} rows, ` +
        `below the floor of ${MIN_DATED_ROWS} rows and ${MIN_DATED_SHARE * 100}%; a column has moved`,
    );
  }
}

/**
 * Runs one adapter over one fetched page.
 *
 * §4.5: zero rows matched on a fetched page is a `ParseError` for that adapter
 * only. Other sources, and other adapters, are unaffected — which is the whole
 * reason adapters are separate rather than one source.
 */
export function runAdapter(adapter: Adapter, doc: Document, page: PageCtx): RawItem[] {
  const rows = Array.from(doc.querySelectorAll(adapter.rows));
  if (rows.length === 0) {
    throw new ParseError(`adapter ${adapter.id}: no rows matched ${JSON.stringify(adapter.rows)}`);
  }

  const items: RawItem[] = [];
  const keys = new KeyGuard();
  const codes = extractCourseCodes(adapter.courseCode);
  // One grid per table for the whole run. `formTableGrid` walks every cell, and
  // CS 424's schedule is 32 rows of 7 — rebuilding it per row per lookup is
  // four passes over the table for every row on the page.
  const grids: GridCache = new Map();

  // A `columns` adapter whose named header is nowhere on the page is a redesign,
  // not an empty week: without this the loop would find no titled row and
  // report a generic "no titles" error that says nothing about the cause.
  if (adapter.columns) {
    const first = rows[0]!;
    for (const [field, spec] of [
      ["title", adapter.columns.title],
      ["due", adapter.columns.due],
    ] as const) {
      if (!headerExists(first, spec, grids)) {
        throw new ParseError(
          `adapter ${adapter.id}: no ${field} column headed ${JSON.stringify(spec)} in this table`,
        );
      }
    }
  }

  const reader = dueReaderOf(adapter);
  const locator = dueLocatorOf(adapter);
  if (locator.kind === "slot") guardSlotHitRate(adapter, rows, locator.index, page, grids);
  // Read once for the page, not once per row: it is a constant of the adapter.
  const defaultClock = adapter.defaultTime ? clockOf(adapter.defaultTime) : undefined;
  let sawTitledRow = false;
  let sawDueReader = false;
  let sawDueHook = false;
  let sawTitleFrom = false;
  for (const row of rows) {
    const located = locateTitle(row, adapter, grids);
    // The `continue` stays: a header row legitimately has no title cell.
    if (!located.text) continue;
    const cell = located.text;
    sawTitledRow = true;

    /*
     * A labelled list is rows-per-*line*, not rows-per-deadline: `Release: 8/25`
     * and `Location: ECEB 1002` are the same `<li>` shape as `Due: 9/7` and
     * there is no selector that tells them apart. A prose page is the same
     * problem one step worse — CS 425's "MPs are always due on a SUNDAY" is the
     * same `<li>` as the one that dates MP1. A row the reader does not hook is
     * not this adapter's row, so it is skipped rather than emitted undated: an
     * undated "Release" or an undated policy sentence would look like a
     * deadline whose date this parser merely failed to read.
     *
     * Matched before the filter, deliberately: the page-level guard below asks
     * whether the *page* still has such rows, and a filter that excludes every
     * one (every checkpoint still TBD) is a normal week, not a redesign. That
     * is the same reason `sawTitledRow` is keyed on titles, not items.
     */
    const due = locateDue(row, adapter, grids);
    if (due.readerSeen) sawDueReader = true;
    if (due.hookSeen) sawDueHook = true;
    /*
     * A `prev` row with no preceding sibling is not this adapter's row.
     *
     * The other locators put the hook *inside* the row, so an empty due cell
     * means "this week has no homework" and an undated row is the honest
     * answer. `prev` puts it outside: in a definition list a `<dd>` with no
     * `<dt>` is not an item at all — it is a continuation or an annotation —
     * and emitting it undated would put a row in the student's list claiming to
     * be a deadline whose date this parser failed to read. Skipped for exactly
     * the reason a line whose label was not declared is skipped on ECE 411.
     */
    if (locator.kind === "prev" && !due.hookSeen) continue;
    if (reader.kind !== "whole" && !due.readerSeen) continue;

    // A row in a list inherits its section's heading. Unresolved for one row is
    // a fallback, not a throw — the page-level guard below is where "the
    // heading is gone" becomes loud, so one odd row cannot discard the others.
    //
    // Resolved before the filter for the same reason the label is: the guard
    // asks whether the *page* still has headings, and a term where every
    // deadline still reads TBD filters every row away without anything having
    // changed. Written after the filter first, and the all-filtered test caught
    // it — worker rule 2's "a green dot must mean I fetched", inverted.
    const inherited = adapter.titleFrom ? resolveTitleFrom(row, adapter.titleFrom) : undefined;
    if (inherited) sawTitleFrom = true;

    /*
     * §4.5's `clauses`: this cell holds several dated clauses, and one of them
     * is the deadline.
     *
     * The date is read out of that clause rather than out of the whole cell, so
     * `extra.dueText` names the sentence the instant came from and not the demo
     * behind it. A cell no clause of which hooks the reader leaves this
     * undefined, and the whole located text is read exactly as before: a
     * separator must never cost a row.
     */
    const clause =
      adapter.clauses && due.raw !== undefined
        ? deadlineClauseOf(
            splitClauses(due.raw, adapter.clauses),
            adapter,
            adapter.timezone,
            page.fetchedAt,
          )
        : undefined;
    let dueTexts = clause ? readDue(clause.text, reader).texts : due.texts;
    /*
     * The name, when the name and the date are the same cell.
     *
     * CS 425's lectures table has one cell per row, so the title *is* the whole
     * sentence — deadline, demo and all. Narrowed to the deadline's clause it
     * reads `MP2 due 11.59 PM 9/27 (Sun)`. Where the two come from different
     * places (the assignments page's `[MP1 Specification Document]:` head) the
     * title is already the row's name and nothing is cut.
     */
    let named =
      clause && due.raw !== undefined && normalizeLabel(cell) === normalizeLabel(due.raw)
        ? clause.text
        : cell;

    /*
     * A sitting whose name and date share one text, in either order.
     *
     * Only where the title *is* the due text, read whole: that is the one case
     * where the date is part of the name, and the name would otherwise carry
     * it into the filter, the kind and the `sourceId`. Date first — CS 461's
     * `Oct 15 MIDTERM (in class)` — the name is the words after it, and only
     * when those name a sitting, so no deadline row is retitled. Name first —
     * CS 473's `Midterm 1 (Sep 30 Wed 7:00pm…)` — the date is read from where
     * the name ends (`sittingSentence`), since the start-anchored formats
     * cannot read it from the front.
     */
    let fromSentence = false;
    if (
      reader.kind === "whole" &&
      !clause &&
      due.raw !== undefined &&
      normalizeLabel(cell) === normalizeLabel(due.raw)
    ) {
      const after = afterLeadingDate(cell, adapter.dateFormat, adapter.timezone, page.fetchedAt);
      const sentence = after === undefined ? sittingSentence(cell) : undefined;
      if (after !== undefined && sittingKind(after)) {
        named = after;
      } else if (sentence) {
        named = sentence.name;
        dueTexts = [sentence.rest];
        fromSentence = true;
      }
    }

    // §4.5: one cell can hold several events. Split first, then filter, so a
    // filter can reject one half of `HW5 Due; HW6 Out` and keep the other —
    // which it cannot do while they share a string.
    const titles = (adapter.splitTitle ? named.split(adapter.splitTitle) : [named])
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .filter((part) => matchesFilter(part, adapter.filter));
    if (titles.length === 0) continue;

    /*
     * A clock the row states somewhere other than the due cell. Falls back to
     * the prose form, so an adapter may declare `time` for the page's usual
     * shape and still pick up an ECE 391-style "due at 18:00" sentence.
     */
    const statedElsewhere =
      (adapter.time ? clockFromText(readTimeCell(row, adapter.time) ?? "") : undefined) ??
      // Read from the row's own text, not the whole page: the sentence that
      // states this deadline's cutoff is in this row.
      statedTimeInText(row.textContent ?? "");

    /*
     * Every text the reader hooked, tried in order; the first that parses wins.
     *
     * One text for a column, a selector or a label. Several for a phrase, where
     * one row can carry the keyword more than once — "Due @ 9/20 at 11.59 PM
     * Central Time. (HW1 is due on a SUNDAY!)" — and the one that is actually a
     * date is not always the first the page wrote.
     */
    let parsed: AdapterDate | undefined;
    let dueText: string | undefined;
    for (const text of dueTexts) {
      parsed = parseAdapterDateParts(
        text,
        adapter.dateFormat,
        adapter.timezone,
        page.fetchedAt,
        statedElsewhere,
        defaultClock,
      );
      if (parsed) {
        dueText = text;
        break;
      }
    }

    /*
     * A sitting dated by its week: the day its own sentence names in that week
     * is the sitting's (`dayWithinSpan`). Rows the adapter files as exams or
     * quizzes only — a homework row's sentence names release days and demos.
     */
    if (parsed && dueText !== undefined && !fromSentence) {
      const kind = kindOfRow(adapter, named);
      const within =
        kind === "exam" || kind === "quiz"
          ? dayWithinSpan(named, dueText, parsed, adapter, page.fetchedAt, statedElsewhere)
          : undefined;
      if (within) {
        parsed = within.parsed;
        dueText = within.text;
        fromSentence = true;
      }
    }
    // Read out of a sentence, what follows the date is the rest of the sentence
    // — `, in Siebel 1404)` — not a clock the grammar failed on. It is one only
    // while the instant still has no stated hour.
    if (parsed?.unparsedTime && fromSentence && !parsed.timeAssumed) {
      const { unparsedTime: _rest, ...kept } = parsed;
      parsed = kept;
    }
    // What the row *offered*, for the "nothing here parsed" record below. The
    // first hook rather than the last: it is the one a reader would look at.
    const rawDate = dueTexts[0];
    const dueAt = parsed?.iso;
    const linkHref = adapter.columns?.link
      ? cellByHeader(row, adapter.columns.link, "href", grids)
      : adapter.link
        ? select(row, adapter.link)
        : undefined;
    // Resolved against the *page*, not the origin: a course page writes
    // `homeworks/hw1.pdf`, and resolving that against the bare origin gives a
    // same-origin https URL that 404s.
    const url = sameOriginHttpsUrl(
      linkHref,
      new URL(adapter.url).origin,
      adapter.url,
      adapter.url,
    );

    /** The deadline this row produced, which is what its events are named after. */
    let deadlineTitle: string | undefined;
    for (const part of titles) {
      // The label is what tells three checkpoints of one MP apart, and §3.1
      // hashes the title — see `titleWithLabel`.
      const base = inherited ?? part;
      const title = due.label ? titleWithLabel(base, due.label) : base;
      // §3.1: course sites have no ids, so the key is content-derived and a
      // rename loses any override on it. Documented and accepted there.
      const sourceId = `${adapter.id}:${hashTitleAndDate(title, dueAt)}`;
      if (keys.has(sourceId)) continue; // a repeated row is not a second deadline
      keys.claim(sourceId, `row ${JSON.stringify(title)}`);

      const extra: Record<string, string> = { adapterId: adapter.id, term: adapter.term };
      if (rawDate && dueAt === undefined) extra["unparsedDate"] = rawDate.slice(0, 200);
      /*
       * The text the instant was read out of.
       *
       * A course site is the least trustworthy date in the project — no ids, no
       * API, a heuristic about where on the page the date lives — and this is
       * the one field that lets a student check it without opening the page.
       * The proposal preview's "Read from" column is the same string, so what
       * they approve is what the runner will go on reading.
       */
      if (dueText) extra["dueText"] = dueText.slice(0, 120);
      if (parsed?.timeAssumed) extra["timeAssumed"] = "true";
      // House rule 1: a time that was printed and could not be read costs its
      // own field and is recorded, rather than passing as "the page gave none".
      if (parsed?.unparsedTime) extra["unparsedTime"] = parsed.unparsedTime;
      if (codes.length > 1) extra["altCodes"] = codes.join(" ");

      items.push({
        source: "site",
        sourceId,
        courseRaw: adapter.label,
        courseCode: codes[0],
        title,
        // Defaults to "assignment", which is what this was hard-coded to and
        // what every entry written before `kind` existed meant. An exam page
        // says so: `examBoard` filters on `kind === "exam"`, so without it a
        // course with two midterms had an empty Exams tab (§4.5).
        kind: kindOfRow(adapter, title),
        dueAt,
        url,
        status: "unknown",
        extra,
        fetchedAt: page.fetchedAt,
      });
      deadlineTitle ??= title;
    }

    /*
     * The other dated clauses of the same cell: things to turn up to.
     *
     * Emitted beside the deadline they came from rather than collected at the
     * end, so a reading of the page — the proposal preview's sample most of all
     * — shows each demo under the assignment whose demo it is.
     */
    if (adapter.clauses && due.raw !== undefined && deadlineTitle !== undefined) {
      for (const event of clauseEvents(
        due.raw,
        adapter,
        deadlineTitle,
        adapter.timezone,
        page.fetchedAt,
      )) {
        const sourceId = `${adapter.id}:${hashTitleAndDate(event.title, event.dueAt)}`;
        // House rule 4, and one cell really can say the same thing twice.
        if (keys.has(sourceId)) continue;
        keys.claim(sourceId, `row ${JSON.stringify(event.title)}`);
        items.push({
          source: "site",
          sourceId,
          courseRaw: adapter.label,
          courseCode: codes[0],
          title: event.title,
          // Never the adapter's `kind`: a demo on an assignments page is not an
          // assignment, and §3's `event` is "a thing that happens at a time,
          // not work that is owed" — nothing marks it done and nothing is
          // submitted for it.
          kind: "event",
          dueAt: event.dueAt,
          url,
          status: "unknown",
          extra: {
            adapterId: adapter.id,
            term: adapter.term,
            // What this row is: read out of a clause beside a deadline rather
            // than from a row of its own, which is the one thing a student
            // checking it against the page needs to know.
            clause: "true",
            dueText: event.text.slice(0, 120),
            ...(event.timeAssumed ? { timeAssumed: "true" } : {}),
            // The cross-listing travels with the event as it does with the
            // deadline, or CS 425's demos would never meet an ECE 428 row.
            ...(codes.length > 1 ? { altCodes: codes.join(" ") } : {}),
          },
          fetchedAt: page.fetchedAt,
        });
      }
    }
  }

  // House rule 2 / §0 rule 3: rows matched but none carried a title, so the page
  // was redesigned. Keyed on titles rather than on `items.length`, because a
  // `filter` may legitimately exclude every row on a page that parses fine.
  if (!sawTitledRow) {
    throw new ParseError(
      `adapter ${adapter.id}: ${rows.length} rows, none matched title ` +
        describeTitleLocator(titleLocatorOf(adapter)),
    );
  }

  /*
   * House rule 2 again, one field over. A `dueLabel` page whose rows still match
   * but whose labels have all been reworded — `Due` becoming `Deadline` — yields
   * nothing at all, and "nothing" is indistinguishable from a term that has not
   * started. It is the list-shaped page's version of the named column that is no
   * longer on the table, and it fails the same way, naming what it looked for so
   * the fix is one registry edit.
   *
   * A `duePhrase` page fails identically and more quietly: CS 425 could drop the
   * word "Due" in favour of "Deadline" in one edit, every `<li>` would still
   * match, every one would still have a title, and the course would simply stop
   * producing deadlines.
   */
  if (reader.kind !== "whole" && !sawDueReader) {
    const what = reader.kind === "label" ? "due label" : "due phrase";
    const spec = reader.kind === "label" ? reader.labels : reader.keywords;
    throw new ParseError(
      `adapter ${adapter.id}: ${rows.length} rows, none carried a ${what} ${JSON.stringify(spec)}`,
    );
  }

  /*
   * House rule 2 again, one locator over.
   *
   * `duePrev` is the only locator whose hook lives *outside* the row, so it is
   * the only one that can vanish while the rows themselves are untouched: a
   * course reordering its definition list, or wrapping each pair in a `<div>`,
   * leaves every `<dd>` matching and every one titled, with no date on any of
   * them. That is a page of undated rows rather than a silent empty, which is
   * better — and still wrong, because it reads as "the course has set no dates"
   * when the truth is "the selectors need one edit".
   */
  if (locator.kind === "prev" && !sawDueHook) {
    throw new ParseError(
      `adapter ${adapter.id}: ${rows.length} rows, none had a preceding ${JSON.stringify(locator.selector)} sibling`,
    );
  }
  if (adapter.titleFrom && !sawTitleFrom) {
    throw new ParseError(
      `adapter ${adapter.id}: no row reached a title via ${JSON.stringify(adapter.titleFrom)}`,
    );
  }

  return items;
}

/** `time` takes the same scope mechanism as `titleFrom`, or is row-relative. */
function readTimeCell(row: Element, spec: string): string | undefined {
  return spec.includes(SCOPE_SEP) ? resolveScoped(row, spec) : select(row, spec);
}

/**
 * A title that names a sitting — an exam or a quiz the student turns up to —
 * and nothing else.
 *
 * Course pages put their exams and CBTF quizzes in the same table as their
 * lectures and homework, so an entry nobody marked `"kind": "exam"` — every page
 * a student adds, and every homework entry whose page also lists the midterms —
 * filed them as assignments and left the Exams tab empty. This is the row
 * deciding for itself. Quizzes joined on 2026-10-01: Sushi, *"yes quizzes should
 * appear in exams"* — TAM 2xx, ECE 220, CS 128 and CS 440 all list `Quiz N`
 * windows at the CBTF, which a student books and sits like an exam.
 *
 * Anchored at both ends, and the whole title has to be the sitting (parser rule
 * 6): `Optional review for Midterm 1`, `HW3 due before midterm`, `Final
 * project` and `Quiz Schedule` all *contain* the word and none of them is one.
 * Up to two words may come before it (`In-class`, `Hour`, `Extra Credit`), but
 * not `Lecture`, `Reading` or `Pre-lecture` — those quizzes are homework done
 * from a laptop. Then a number, a retake, and only what introduces a time or a
 * note: `: 7:00pm`, ` at 7pm`, ` (Open Book)`, ` - Chapters 1-4`, ` Mon (12/8)`.
 *
 * Two patterns, not one, because the proposer writes them into `filter.include`
 * and `filter.exclude`, which `validateAdapter` caps at 200 characters each —
 * and one pattern holding both halves is 272. `EXCLUDE` is the words that make
 * a row about the sitting rather than the sitting: review, solutions, practice,
 * grades, a formula sheet, a schedule, a policy, a mock.
 */
const SITTING_NAME = String.raw`(?:(?!due|lecture|reading|pre|no|miss)[a-z-]+ ){0,2}(mid-?term|final|quiz|exam)(?: exam)?(?: ?#?(?:\d+|[ivx]+)\b)?(?: re(?:take|try))?`;
export const SITTING_INCLUDE = String.raw`^${SITTING_NAME}(?: ?(?:[(:,@]|- |(?:at|on|due|mon|tue|wed|thu|fri) ).*)?$`;
export const SITTING_EXCLUDE = String.raw`\b(?:review|solution|practice|prep|grade|releas|score|sheet|feedback|schedul|polic|mock)`;
const SITTING_INCLUDE_RE = new RegExp(SITTING_INCLUDE, "i");
const SITTING_EXCLUDE_RE = new RegExp(SITTING_EXCLUDE, "i");

/**
 * `quiz` when the sitting is one, `exam` for any other, undefined for a row
 * that is neither. Decided by the word the title is *named* by, not by any
 * mention: CS 440 writes "Our final (= Quiz 7) will be on Thurs Dec 17", which
 * is the final.
 */
export function sittingKind(title: string): "exam" | "quiz" | undefined {
  const text = title.replace(/\s+/g, " ").trim();
  const match = SITTING_INCLUDE_RE.exec(text);
  if (!match || SITTING_EXCLUDE_RE.test(text)) return undefined;
  return match[1]!.toLowerCase() === "quiz" ? "quiz" : "exam";
}

/**
 * A sitting's name with its date straight after it: `Midterm 1 (Sep 30 Wed
 * 7:00pm-9:30pm, in Siebel 1404)` on CS 473, `Exam 1 Sep. 21 Mon 7:00-8:15pm`
 * on ECE 329, `Final (TBA)`.
 *
 * The date formats are start-anchored, so a line that names its exam before
 * dating it parsed as nothing, and both pages' midterms never reached the
 * Exams tab. This is the one shape where the row's own words say which date is
 * the sitting's: the name, at most one introducer (`(`, `:`, `,`, `@`, a dash,
 * `on`, `at`), and then the date — or a TBA. A date further on is not taken:
 * `Midterm 1 (covers through Oct 1)` is a sentence about the exam, and its
 * date is not the sitting's.
 *
 * `name` is what the row is titled by, so the room and the clock — which the
 * course edits — never reach the `sourceId`.
 */
const SITTING_LEAD = new RegExp(
  `^(${SITTING_NAME})\\s*(?:[(:,@–—-]\\s*)?(?:(?:on|at)\\s+)?` +
    // DATE_SHAPED without its anchor, or a placeholder: the date has to be here.
    `(?=${DATE_SHAPED.source.slice(1)}|(?:${PLACEHOLDER_WORDS})\\b)`,
  "i",
);
export function sittingSentence(text: string): { name: string; rest: string } | undefined {
  const squashed = text.replace(/\s+/g, " ").trim();
  const match = SITTING_LEAD.exec(squashed);
  if (!match) return undefined;
  return { name: match[1]!.trim(), rest: squashed.slice(match[0].length) };
}

/**
 * The words after a cell's leading date, when the cell *is* the date and the
 * name: CS 461's `<span>Oct 15</span><br/><strong>MIDTERM</strong> (in class)`
 * reads `Oct 15 MIDTERM (in class)`, and the sitting is `MIDTERM (in class)`.
 *
 * Measured with the parser rather than a pattern of this file's own: the date
 * ends at the shortest run of words that parses to the instant the whole text
 * does, so a clock written after the day (`Oct 15 7pm Midterm`) stays part of
 * the date. Undefined when the text does not lead with a date or has nothing
 * after it.
 */
export function afterLeadingDate(
  text: string,
  format: string,
  timezone: string,
  reference: string,
): string | undefined {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const whole = parseAdapterDateParts(words.join(" "), format, timezone, reference);
  if (!whole) return undefined;
  for (let n = 1; n < words.length; n += 1) {
    const head = parseAdapterDateParts(words.slice(0, n).join(" "), format, timezone, reference);
    if (head?.iso !== whole.iso) continue;
    return words.slice(n).join(" ").replace(/^[\s,;:·•|–—-]+/, "") || undefined;
  }
  return undefined;
}

/**
 * A day range in a date cell — `Dec 14-18`, `10/5-10/9`, `Sep 28 - Oct 2` —
 * and not a clock range (`7-9pm`, `7:00-8:15`) or an ISO date (`2026-12-14`).
 */
const DAY_SPAN = /(?<![\d-])\d{1,2}\s*(?:[-–—]|to)\s*(?:[a-z]{3,9}\.?\s*)?(?:\d{1,2}\/)?\d{1,2}\b(?!\s*(?::\d|am\b|pm\b))/i;
/** How far past a span's first day its last can be: a week. */
const SPAN_DAYS = 6;

/**
 * The day a sitting's own sentence names inside the week its date cell spans.
 *
 * CS 440's schedule dates a row by its week — `Dec 14-18` — and the row says
 * `Our final (= Quiz 7) will be on Thurs Dec 17, sometime during the 8-11am
 * timeslot`. The cell's reading is the 14th, three days early. A day the row
 * states *within* that week is the same claim made precisely; a day outside it
 * is something else the sentence mentions, and the cell stands.
 */
function dayWithinSpan(
  sentence: string,
  cell: string,
  start: AdapterDate,
  adapter: Adapter,
  reference: string,
  statedElsewhere: Clock | undefined,
): { parsed: AdapterDate; text: string } | undefined {
  if (!DAY_SPAN.test(cell)) return undefined;
  const dayOf = (iso: string): number => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000;
  const first = dayOf(start.iso);
  for (let at = 0; at < sentence.length; at += 1) {
    // After a space or an opening bracket: `Final (Dec 17, 8am)`.
    if (at > 0 && !/[\s(]/.test(sentence[at - 1]!)) continue;
    const text = sentence.slice(at);
    if (!DATE_SHAPED.test(text)) continue;
    const parsed = parseAdapterDateParts(text, adapter.dateFormat, adapter.timezone, reference, statedElsewhere);
    if (!parsed) continue;
    const offset = dayOf(parsed.iso) - first;
    if (offset >= 0 && offset <= SPAN_DAYS) return { parsed, text };
  }
  return undefined;
}

/**
 * What one row is. An entry that names a kind other than `assignment` has
 * said what its whole page is, and that stands. Otherwise — no kind, or the
 * default spelled out, which is what the options page saves when nobody
 * changes the picker — a row whose title names a sitting is that sitting.
 */
function kindOfRow(adapter: Adapter, title: string): Kind {
  if (adapter.kind !== undefined && adapter.kind !== "assignment") return adapter.kind;
  return sittingKind(title) ?? "assignment";
}

/** §3.1: `${adapterId}:${hash(normalizedTitle + dueDate)}`. */
function hashTitleAndDate(title: string, dueAt: string | undefined): string {
  const input = `${title.toLowerCase().replace(/\s+/g, " ").trim()}|${dueAt ?? ""}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(16).padStart(8, "0");
}

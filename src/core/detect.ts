/**
 * Proposing an adapter for a course page nobody has written one for (§4.5).
 *
 * Adding a course currently means capturing the page, sending it to Sushi,
 * having someone read the markup, and waiting for a push. That makes one person
 * the bottleneck for every course at the university, and it is the reason the
 * registry has two adapters in it.
 *
 * **This does not decide anything.** It proposes, and the student confirms by
 * reading the rows it extracted off their own course page — a page they know
 * better than any parser does. That confirmation step is what makes an
 * automatic guess safe: a wrong column produces visibly wrong titles and dates,
 * and the person looking at it is the one person who can tell.
 *
 * Nothing here is a language model, and the reason is the oracle. Finding the
 * date column is a search over a handful of candidates with a hard test for
 * each one — does every row in it parse as a date the runner already supports?
 * A search with a checkable answer does not need a model, and this way it is
 * deterministic, mutation-testable, needs no download, and works on every
 * machine rather than on the ones with 22GB free and the right GPU.
 *
 * What it deliberately cannot do is the hard half. CS 424's schedule has no
 * header row, uses `rowspan` so cells shift between rows, and packs two events
 * into one cell. No amount of guessing gets there, and the honest answer for
 * pages like it is to say so rather than to propose something plausible.
 */

import { headerIndex, supportedDateFormats, parseAdapterDate } from "../sources/site.js";
import type { Kind } from "../sources/types.js";

/** How many rows must yield a date before a table is worth proposing. */
const MIN_DATED_ROWS = 2;

/**
 * The share of rows that must parse.
 *
 * A course schedule has header rows, section breaks and the odd "no class"
 * line, so demanding every row is wrong. Demanding only one is worse: any
 * column containing a stray "9/11" would win.
 */
const MIN_DATED_SHARE = 0.5;

export interface DetectedRow {
  title: string;
  due: string;
}

/**
 * One proposal, in whichever of the three page shapes it was read from.
 *
 * `detectCandidates` below only ever produces the header-table shape, and that
 * has not changed. The optional fields exist because `core/author.ts` produces
 * candidates too, and a model may read a page the search cannot — a list of
 * `Due: 9/7` bullets under an `<h3>`, or a row selector with two selectors
 * hanging off it. Those shapes were supported by `runAdapter` and by a
 * hand-written registry entry from the day ECE 411 landed, and by nothing that
 * could *propose* one; a proposal that validated against the real runner then
 * lost its `dueLabel` on the way to the preview, so what was saved was not what
 * was checked.
 *
 * Everything here is carried straight through `buildAdapter` into the registry
 * entry, so the rule is: a field that changes what `runAdapter` reads must be
 * on this interface, or it must not be proposable.
 */
export interface Candidate {
  /** A CSS selector for this table's data rows, as the adapter would carry. */
  rows: string;
  /**
   * Header names, which survive a course adding a column (house rule 3).
   *
   * Absent for the two shapes that are not a header table, where `title` and
   * `due` below are row-relative selectors instead.
   */
  columns?: { title: string; due: string; link?: string };
  /** Row-relative selectors, for a page whose rows are not table cells. */
  title?: string;
  due?: string;
  /** §4.5's `label: value` list fields. See `Adapter` for what each means. */
  dueLabel?: string;
  titleFrom?: string;
  time?: string;
  splitTitle?: string;
  /** What the rows on this page are. Omitted means `assignment`. */
  kind?: Kind;
  /** `exclude` drops the TBD/TBA/N/A lines a course leaves in place. */
  filter?: { include?: string; exclude?: string };
  dateFormat: string;
  /** Rows the selector matched. */
  total: number;
  /** Rows whose date the runner could read. */
  dated: number;
  /**
   * What this candidate actually extracts, for the student to check.
   *
   * The whole safety argument rests on this being shown: a wrong column is
   * obvious to someone who knows the course and invisible to everything else.
   */
  sample: DetectedRow[];
}

/**
 * What the search below produces, which is only ever the header-table shape.
 *
 * Stated as a type rather than left to a comment: the search finds a table by
 * crossing its columns with the date formats, so `columns` is always there, and
 * every caller that reads `candidate.columns.due` off a *detected* candidate is
 * right to. A candidate from `core/author.ts` may be one of the other two
 * shapes, and there the compiler asks.
 */
export type TableCandidate = Candidate & { columns: NonNullable<Candidate["columns"]> };

/** Rows shown before the preview stops listing them. */
const SAMPLE_ROWS = 6;

function textOf(node: Element | null | undefined): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * A selector that finds this table again on the next fetch.
 *
 * An `id` when there is one, because that is what a page author meant as a
 * handle. Otherwise a positional path, which is brittle by nature — but the
 * adapter is data, so a page that moves its table is a one-line fix rather than
 * a build (§0 decision 4).
 */
export function selectorForTable(table: Element, doc: Document): string {
  const id = table.getAttribute("id");
  if (id && /^[A-Za-z][\w-]*$/.test(id)) return `#${id}`;

  const container = table.closest("[id]");
  const containerId = container?.getAttribute("id");
  const tables: Element[] = [...doc.querySelectorAll("table")];
  if (containerId && /^[A-Za-z][\w-]*$/.test(containerId)) {
    const within: Element[] = [...container!.querySelectorAll("table")];
    const index = within.indexOf(table);
    if (within.length === 1) return `#${containerId} table`;
    if (index >= 0) return `#${containerId} table:nth-of-type(${index + 1})`;
  }

  const index = tables.indexOf(table);
  return index <= 0 ? "table" : `table:nth-of-type(${index + 1})`;
}

/**
 * The selector this candidate would carry as its adapter's `rows`.
 *
 * `tbody tr` when the table has a tbody, because the header row is not a
 * deadline. A bare `… tr` matches the `<thead>` row too, and `columns.title` of
 * "Exercises" then reads `<th>Exercises</th>` — an undated item literally titled
 * *Exercises*, with the words "Due Date" where its date should be, that no
 * course ever set. `dataRows` below already excludes it from the preview, which
 * is why nothing on screen said the proposal was wrong: the defect only appeared
 * once the selector reached `runAdapter` for real.
 *
 * The same rule `core/skeleton.ts` prints for the on-device model, and what the
 * hand-written `ece310-fa26` entry uses (`#homework table.timetable tbody tr`).
 * Exported so `skeleton.ts`'s copy can be folded into this one — two spellings
 * of one decision is the shape mutation-check rule 3 warns about.
 */
export function rowSelectorForTable(table: Element, doc: Document): string {
  const selector = selectorForTable(table, doc);
  return table.querySelector("tbody") ? `${selector} tbody tr` : `${selector} tr`;
}

/**
 * The row `rowSelectorForTable` leaves out, recognised again.
 *
 * The same decision as the `tbody` branch above, read from the other end: given
 * a matched element, is this the header row a `… tr` spelling swept in? The
 * inventory in `skeleton.ts` drops a group containing one, and `author.ts`
 * refuses a `rows` that matches one by name — both of which are the sentence
 * above applied to a selector somebody else wrote, so it is one function and
 * not a third spelling of "the header row is not a deadline".
 *
 * `tbody` rather than `thead`: a table with no `<tbody>` has no other spelling
 * to offer, and `runAdapter` reads its header row as the header. It is the
 * presence of a tbody that makes `… tr` the *wrong* one of two spellings.
 */
export function isHeaderRowOutsideTbody(element: Element): boolean {
  if (element.tagName !== "TR" || element.closest("tbody")) return false;
  return element.closest("table")?.querySelector("tbody") != null;
}

/** An id or class this code may safely put back into a selector. */
const SAFE_TOKEN = /^[A-Za-z][\w-]*$/;

/** `ul.simple`, the narrowest thing a selector can call this list. */
function tagWithClass(list: Element): string {
  const first = (list.getAttribute("class") ?? "").trim().split(/\s+/)[0];
  const tag = list.tagName.toLowerCase();
  return first && SAFE_TOKEN.test(first) ? `${tag}.${first}` : tag;
}

/**
 * A selector that finds this list again on the next fetch.
 *
 * The same shape as `selectorForTable`, and for the same reason: an `id` is
 * what a page author meant as a handle, and a list rarely has one — ECE 411's
 * MPs are `<section id="mp-setup"><h3>…<ul class="simple">`, where the handle is
 * the section and the list is named relative to it.
 */
export function selectorForList(list: Element, doc: Document): string {
  const id = list.getAttribute("id");
  if (id && SAFE_TOKEN.test(id)) return `#${id}`;

  const self = tagWithClass(list);
  const container = list.closest("[id]");
  const containerId = container?.getAttribute("id");
  if (containerId && SAFE_TOKEN.test(containerId)) {
    const within: Element[] = [...container!.querySelectorAll(self)];
    if (within.length === 1) return `#${containerId} ${self}`;
    const index = within.indexOf(list);
    if (index >= 0) return `#${containerId} ${self}:nth-of-type(${index + 1})`;
  }

  const all: Element[] = [...doc.querySelectorAll(self)];
  const index = all.indexOf(list);
  return index <= 0 ? self : `${self}:nth-of-type(${index + 1})`;
}

/**
 * The selector a list-shaped adapter would carry as its `rows`.
 *
 * `> li`, not a descendant `li`: a nested list would otherwise contribute its
 * own items to the outer list's rows, and the two are different sections of the
 * page. The shipped `ece411-fa26-mp` entry is spelled exactly this way.
 */
export function rowSelectorForList(list: Element, doc: Document): string {
  return `${selectorForList(list, doc)} > li`;
}

/** The rows of a table that are not its header. */
function dataRows(table: Element): Element[] {
  return [...table.querySelectorAll("tr")].filter(
    (row) => row.querySelector("td") !== null,
  );
}

/**
 * Candidate adapters for a page, best first.
 *
 * "Best" is how many rows produced a readable date, because that is the only
 * thing here that can be checked without a human. Ties go to the table with
 * more rows: a schedule beats a two-line summary box.
 */
export function detectCandidates(doc: Document, reference: string, timezone: string): TableCandidate[] {
  const found: TableCandidate[] = [];

  for (const table of doc.querySelectorAll("table")) {
    const headers = headerIndex(table);
    const rows = dataRows(table);
    if (rows.length === 0) continue;

    const names = [...headers.keys()];
    const rowSelector = rowSelectorForTable(table, doc);

    for (const dueName of names) {
      const dueIndex = headers.get(dueName)!;
      for (const format of supportedDateFormats()) {
        const dated = rows.filter((row) => {
          const cells = [...row.querySelectorAll("td, th")];
          // No empty-string guard: the formats are anchored, so `""` already
          // fails to parse. A second check for it was unreachable.
          const text = textOf(cells[dueIndex]);
          return parseAdapterDate(text, format, timezone, reference) !== undefined;
        });
        if (dated.length < MIN_DATED_ROWS) continue;
        if (dated.length / rows.length < MIN_DATED_SHARE) continue;

        const titleName = pickTitleColumn(names, dueName, headers, dated);
        if (titleName === undefined) continue;
        const titleIndex = headers.get(titleName)!;

        found.push({
          rows: rowSelector,
          columns: {
            title: titleName,
            due: dueName,
            ...(hasLink(dated, titleIndex) ? { link: titleName } : {}),
          },
          dateFormat: format,
          total: rows.length,
          dated: dated.length,
          sample: dated.slice(0, SAMPLE_ROWS).map((row) => {
            const cells = [...row.querySelectorAll("td, th")];
            return { title: textOf(cells[titleIndex]), due: textOf(cells[dueIndex]) };
          }),
        });
      }
    }
  }

  // One proposal per *column*, not per table.
  //
  // The same column matched by two date formats is the same choice twice, and a
  // list of near-identical options is how people stop reading options. But a
  // schedule with both a "Released" and a "Due" column is two genuinely
  // different answers, and collapsing by table offered only whichever parsed
  // more rows — which on a page where every assignment has a release date and
  // some have no deadline yet is the wrong one, with no way to reach the right
  // one. Found by mutation: collapsing by table survived every test.
  const best = new Map<string, TableCandidate>();
  for (const candidate of found) {
    const key = `${candidate.rows}\u0000${candidate.columns.due}`;
    const seen = best.get(key);
    if (!seen || candidate.dated > seen.dated) best.set(key, candidate);
  }
  return [...best.values()].sort((a, b) => b.dated - a.dated || b.total - a.total);
}

/**
 * The column most likely to be an assignment name.
 *
 * Not the first column: plenty of schedules lead with a week number or a date.
 * Preferred in order — a column whose cells link somewhere (a course site links
 * the assignment), then the leftmost column with substantial text. A column
 * whose cells are mostly empty or numeric is never it.
 */
function pickTitleColumn(
  names: string[],
  dueName: string,
  headers: Map<string, number>,
  rows: Element[],
): string | undefined {
  let best: { name: string; score: number } | undefined;

  for (const name of names) {
    if (name === dueName) continue;
    const index = headers.get(name)!;
    let filled = 0;
    let linked = 0;
    for (const row of rows) {
      const cell = [...row.querySelectorAll("td, th")][index];
      const text = textOf(cell);
      // A bare number is a week or a unit, never an assignment name.
      if (text.length < 2 || /^\d+$/.test(text)) continue;
      filled += 1;
      if (cell?.querySelector("a[href]")) linked += 1;
    }
    if (filled === 0) continue;
    // A link is worth more than position, and position breaks the tie.
    const score = filled + linked * 2 - index * 0.01;
    if (!best || score > best.score) best = { name, score };
  }

  return best?.name;
}

function hasLink(rows: Element[], titleIndex: number): boolean {
  return rows.some((row) => {
    const cell = [...row.querySelectorAll("td, th")][titleIndex];
    return cell?.querySelector("a[href]") !== null && cell?.querySelector("a[href]") !== undefined;
  });
}

/**
 * Why a page produced nothing, in words a student can act on.
 *
 * "No candidates" is the least useful thing this could say. The three real
 * causes need three different next steps, and only one of them is "give up".
 */
export function noCandidateReason(doc: Document): string {
  const tables = [...doc.querySelectorAll("table")];
  if (tables.length === 0) {
    return (
      "No table on this page. Either the schedule is built by JavaScript after the page " +
      "loads, which this cannot read, or it is a list rather than a table. A list of " +
      "“Due: 9/7” lines under a heading can be read — this search only looks at " +
      "tables, but Chrome's built-in model can propose one for it on a computer that has " +
      "the model, and a hand-written entry can always be written for it."
    );
  }
  if (!tables.some((table) => headerIndex(table).size >= 2)) {
    return (
      "Found a table, but no header row naming its columns. A schedule without headers " +
      "needs a hand-written entry, because there is nothing stable to point at."
    );
  }
  return (
    "Found a table with headers, but no column whose dates could be read. The supported " +
    `formats are ${supportedDateFormats().join(", ")}.`
  );
}

/** §4.5 adapters are all UIUC, and UIUC runs on one clock. */
export const SITE_TIMEZONE = "America/Chicago";

/**
 * The registry entry for a candidate the student approved.
 *
 * In `core/` rather than in the options page because it is a decision — *which
 * fields of the thing that was validated survive into the thing that is saved*
 * — and the page is one of the two files the suite cannot reach (worker rule
 * 1). It was in the page, and it wrote out `columns` and nothing else: a
 * list-shaped proposal that had been validated through the real runner with a
 * `dueLabel` was saved without one, so the entry installed read every line of
 * the list rather than the deadline lines. Nothing in the preview could show
 * that, because the preview came from the other object.
 *
 * `hostPattern` is derived from the URL rather than asked for, because
 * `validateAdapter` requires it to be exactly the URL's own host — a wildcard
 * would be one prompt covering every illinois.edu site, and a later edit could
 * repoint the adapter anywhere under it with no second prompt.
 */
export function adapterFromCandidate(
  candidate: Candidate,
  url: string,
  courseCode: string,
  term: string,
  kind = "assignment",
): Record<string, unknown> & { id: string } {
  const host = new URL(url).origin;
  return {
    id: `${courseCode.toLowerCase()}-${term}-local`,
    label: `${courseCode} course site`,
    courseCode,
    term,
    url,
    hostPattern: `${host}/*`,
    rows: candidate.rows,
    // The table shape is unchanged: `columns`, plus the positional fallback for
    // a header that has gone missing at parse time. The other two shapes carry
    // their own row-relative `title` / `due`, and a list carries `dueLabel`,
    // `titleFrom`, `time` and `filter` with them.
    ...(candidate.columns
      ? { columns: candidate.columns, title: "td:nth-child(1)", due: "td:nth-child(2)" }
      : { title: candidate.title ?? "", due: candidate.due ?? "" }),
    ...(candidate.dueLabel ? { dueLabel: candidate.dueLabel } : {}),
    ...(candidate.titleFrom ? { titleFrom: candidate.titleFrom } : {}),
    ...(candidate.time ? { time: candidate.time } : {}),
    ...(candidate.splitTitle ? { splitTitle: candidate.splitTitle } : {}),
    ...(candidate.filter ? { filter: candidate.filter } : {}),
    // Omitted when it is the default, which is what every entry written before
    // `kind` existed means — a saved entry should read like a hand-written one
    // rather than carry a field it did not need.
    ...(kind && kind !== "assignment" ? { kind } : {}),
    dateFormat: candidate.dateFormat,
    timezone: SITE_TIMEZONE,
    minExtensionVersion: "0.1.0",
  };
}

/**
 * A course code read off the URL, as a starting point for the student to fix.
 *
 * UIUC course sites are overwhelmingly `/<dept><number>/<term>/`, so this is
 * right far more often than not — and it is a prefilled field rather than a
 * decision, because the student is looking straight at it.
 */
export function guessCourseCode(url: string): string | undefined {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return undefined;
  }
  for (const segment of path.split("/")) {
    const match = /^([a-z]{2,4})[\s_-]?(\d{3})$/i.exec(segment);
    if (match) return `${match[1]!.toUpperCase()}${match[2]}`;
  }
  return undefined;
}

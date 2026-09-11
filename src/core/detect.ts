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

export interface Candidate {
  /** A CSS selector for this table's data rows, as the adapter would carry. */
  rows: string;
  /** Header names, which survive a course adding a column (house rule 3). */
  columns: { title: string; due: string; link?: string };
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
export function detectCandidates(doc: Document, reference: string, timezone: string): Candidate[] {
  const found: Candidate[] = [];

  for (const table of doc.querySelectorAll("table")) {
    const headers = headerIndex(table);
    const rows = dataRows(table);
    if (rows.length === 0) continue;

    const names = [...headers.keys()];
    const rowSelector = `${selectorForTable(table, doc)} tr`;

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
  const best = new Map<string, Candidate>();
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
      "loads, which this cannot read, or it is a list rather than a table — those need a " +
      "hand-written entry."
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

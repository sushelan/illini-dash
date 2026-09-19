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

import {
  headerIndex,
  matchDueLabel,
  runAdapter,
  supportedDateFormats,
  parseAdapterDate,
} from "../sources/site.js";
import { validateAdapter } from "./registry.js";
import { ParseError, type Adapter, type Kind, type PageCtx } from "../sources/types.js";
// Type-only, and it has to stay that way: `core/skeleton.ts` imports the
// selector spellings below, so a *value* import back would be a runtime cycle.
// The inventory is passed in by the caller instead — `detectCandidates` and
// `proposeCandidates` take the structures rather than computing them.
import type { RepeatedStructure } from "./skeleton.js";

/** How many rows must yield a date before a table is worth proposing. */
const MIN_DATED_ROWS = 2;

/**
 * "No date yet", as both shipped entries spell it.
 *
 * One string, three readers (mutation rule 3): the `filter.exclude` a proposed
 * list adapter carries, the regex `skeleton.ts` counts a group's *pending* rows
 * with, and the sentence a findings doc quotes. A `Due: TBD` line is not a row
 * whose date could not be read — it is a deadline the course has not set, and
 * the difference decides whether a group of sixteen bullets with four dates is
 * a bad guess (4 of 16) or a term that has barely started (4 of 4 stated).
 */
export const PLACEHOLDER_EXCLUDE = "\\bTB[DA]\\b|\\bN/?A\\b";
export const PLACEHOLDER = new RegExp(PLACEHOLDER_EXCLUDE, "i");

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

/* -------------------------------------------------------------------------- */
/* The second shape the search can read: a labelled list                       */
/* -------------------------------------------------------------------------- */

/** A group this small is a summary box, not a schedule. */
const MIN_LIST_ROWS = 3;

/**
 * The share of a list's *stated* lines that must read as dates.
 *
 * Much stricter than the half a table's column needs, and for a reason: a
 * table's column is named by its header, so "most of it parses" is confirmation
 * of a choice the page itself made. A list has no header — the only evidence
 * that these lines are deadlines is that they read as dates — so a group where
 * one line in three does is not a schedule this read poorly, it is prose with a
 * date in it. `pending` lines (`Due: TBD`) are not counted against it: they are
 * deadlines the course has not set, and `filter.exclude` drops them.
 */
const MIN_LIST_DATED_SHARE = 0.8;

/**
 * Candidates for the list shape — `Due: 9/7` bullets under a heading.
 *
 * This is the half of §4.5 that had no proposer. The shape has been readable
 * since ECE 411 landed and writable only by hand, so the one page in the
 * project that is *not* a table went to the on-device model every time — and on
 * 2026-09-18, three builds running, the model answered with a small wrong group
 * because nothing it was shown said which group carried dates. It is a search
 * with a checkable answer, exactly like the table search above, and it belongs
 * here for the same reasons: deterministic, mutation-testable, no download, and
 * it works on the machines that will never have a model.
 *
 * Nothing is guessed. The group, its dated share and its `dueLabel` convention
 * are measured by `repeatedStructures`; the heading spec comes from the same
 * function that prints one for the model; and every candidate is then run
 * through the **real runner** over the real page, so what the student confirms
 * is what will be recorded.
 */
export function detectListCandidates(
  doc: Document,
  structures: readonly RepeatedStructure[],
  reference: string,
  timezone: string,
): Candidate[] {
  const found: Candidate[] = [];
  for (const structure of structures) {
    const { dated } = structure;
    const stated = dated.of - dated.pending;
    /*
     * `titleFrom` is also what keeps this off a table, and deliberately so.
     *
     * A row in a list has no name of its own, so a group with no heading over
     * it is one whose every row would be titled "Due" — and `repeatedStructures`
     * gives a group of table rows or cells no `titleFrom` at all, because a
     * heading over a table is not a row's name. An explicit "not a table" guard
     * here was measured redundant with that one (mutation rule 2) and deleted:
     * two spellings of one decision, with only one of them reachable, is the
     * shape rule 3 warns about.
     */
    if (structure.count < MIN_LIST_ROWS) continue;
    if (dated.rows === 0 || dated.label === undefined || structure.titleFrom === undefined) continue;
    if (stated <= 0 || dated.rows / stated < MIN_LIST_DATED_SHARE) continue;

    let rows: Element[];
    try {
      rows = [...doc.querySelectorAll(structure.selector)];
    } catch {
      continue;
    }
    if (rows.length === 0) continue;
    // A page that states the label but never with a date behind it is a page
    // this cannot read — the runner would return nothing, and §11 ranks a
    // silently dropped deadline above every other failure.
    if (!rows.some((row) => matchDueLabel(textOf(row), dated.label!) !== undefined)) continue;

    const candidate = runListCandidate(
      {
        rows: structure.selector,
        title: ".",
        due: ".",
        dueLabel: dated.label,
        titleFrom: structure.titleFrom,
        filter: { exclude: PLACEHOLDER_EXCLUDE },
        dateFormat: dated.format,
      },
      doc,
      reference,
      timezone,
    );
    if (candidate) found.push(candidate);
  }
  return found.sort((a, b) => b.dated - a.dated || b.total - a.total);
}

/**
 * One list proposal, put through the runner the sync loop will use.
 *
 * `undefined` rather than a reason: unlike the model's proposals there is no
 * one to tell. A search that produced an unreadable candidate drops it and the
 * page falls through to `noCandidateReason`, which says what the page *does*
 * have.
 *
 * The acceptance test is `validateProposal`'s, minus the half-of-rows clause:
 * every row this adapter keeps must carry a date the runner read whole. A list
 * has no header to corroborate a partial read, so "some of them parsed" is not
 * evidence here — see `MIN_LIST_DATED_SHARE`.
 */
function runListCandidate(
  proposed: Omit<Candidate, "total" | "dated" | "sample">,
  doc: Document,
  reference: string,
  timezone: string,
): Candidate | undefined {
  /*
   * A stand-in URL, because this path has not got the real one.
   *
   * The offscreen `detect-adapter` message carries the HTML, the reference and
   * the timezone — not the address (`messages.ts`), and the worker that sends
   * it is not this worker's to change. Nothing in a candidate depends on it: a
   * list adapter declares no `link`, so every row's `url` is the adapter's own,
   * and `adapterFromCandidate` writes the page's real address when the student
   * saves. `validateAdapter` wants a URL and a matching `hostPattern`, and an
   * invalid host is the honest way to say "not decided here" — a plausible one
   * would read like a claim about where this page lives.
   */
  const { adapter } = validateAdapter({
    id: "proposed",
    label: "proposed",
    courseCode: "PROPOSED",
    term: "proposed",
    url: "https://example.invalid/page",
    hostPattern: "https://example.invalid/*",
    ...proposed,
    timezone,
    minExtensionVersion: "0.1.0",
  });
  if (!adapter) return undefined;

  const page: PageCtx = { url: adapter.url, fetchedAt: reference };
  let items;
  try {
    items = runAdapter(adapter as Adapter, doc, page);
  } catch (err) {
    // A ParseError is the ordinary "this was not it" answer: no row matched, no
    // row carried the label, no row reached a heading.
    if (err instanceof ParseError) return undefined;
    throw err;
  }
  if (items.length === 0) return undefined;
  if (items.some((item) => item.title.trim() === "")) return undefined;
  /*
   * A value the runner could not read whole costs the whole candidate.
   *
   * This is also what makes every kept row dated, so there is no second count
   * to check: a list candidate always carries a `dueLabel`, so every row it
   * keeps handed the reader a non-empty value, and `runAdapter` records an
   * `unparsedDate` for every one of those it could not read (`site.ts`). A
   * `dated.length !== items.length` guard beside this one was measured
   * unreachable by mutation and deleted rather than left as a second thing to
   * read (mutation rule 2).
   */
  if (items.some((item) => item.extra?.["unparsedDate"] ?? item.extra?.["unparsedTime"])) {
    return undefined;
  }
  const dated = items.filter((item) => item.dueAt !== undefined);

  return {
    ...proposed,
    total: items.length,
    dated: dated.length,
    sample: dated.slice(0, SAMPLE_ROWS).map((item) => ({
      title: item.title,
      // The instant, not the text: a line that reads plausibly and lands on the
      // wrong day is what this preview exists to catch.
      due: item.dueAt ?? "",
    })),
  };
}

/**
 * Every candidate this page yields, both shapes, best first.
 *
 * Tables first, and not because they are more common: a header table is the
 * shape whose evidence is independent of the search — the page itself named the
 * column "Due Date" — while a list is proposed because its lines happen to read
 * as dates. Where a page offers both, the one the page labelled goes first.
 *
 * `structures` comes from `core/skeleton.ts`, which imports this file, so it is
 * passed in rather than computed here (see the type-only import above).
 */
export function proposeCandidates(
  doc: Document,
  reference: string,
  timezone: string,
  structures: readonly RepeatedStructure[] = [],
): Candidate[] {
  return [
    ...detectCandidates(doc, reference, timezone),
    ...detectListCandidates(doc, structures, reference, timezone),
  ];
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
export function noCandidateReason(
  doc: Document,
  /** The page's own inventory, which is what the last sentence is read off. */
  structures: readonly RepeatedStructure[] = [],
): string {
  const tables = [...doc.querySelectorAll("table")];
  const found = bestGroupSentence(structures);
  if (tables.length === 0) {
    /*
     * This sentence used to say the search "only looks at tables", and offered
     * the model and a hand-written entry as the two ways to read a list. It is
     * false as of `detectListCandidates`: a list of “Due: 9/7” lines under a
     * heading is the second shape this search reads. Rewritten rather than
     * annotated — a student reading a correction under a wrong sentence reads
     * the wrong sentence first — and it now says what the search *did* find, so
     * an unreadable page teaches something about itself.
     */
    return (
      "This page has neither of the two shapes this can read: a table with a header row " +
      "naming its columns, and a list of “Due: 9/7” lines under a heading. " +
      `${found}Either the schedule is built by JavaScript after the page loads, which this ` +
      "cannot read, or it is shaped like neither — Chrome's built-in model can still " +
      "propose an entry for it on a computer that has the model, and a hand-written entry " +
      "can always be written for it."
    );
  }
  if (!tables.some((table) => headerIndex(table).size >= 2)) {
    return (
      "Found a table, but no header row naming its columns, and no list of “Due: 9/7” " +
      `lines under a heading either. ${found}A schedule without headers needs a ` +
      "hand-written entry, because there is nothing stable to point at."
    );
  }
  return (
    "Found a table with headers, but no column whose dates could be read, and no list of " +
    `“Due: 9/7” lines under a heading either. ${found}The supported formats are ` +
    `${supportedDateFormats().join(", ")}.`
  );
}

/**
 * "The nearest thing to a schedule is …" — the page's own best group, measured.
 *
 * Ends with a space so it drops out of the sentences above when the inventory
 * was not supplied or the page repeats nothing; `""` is the whole of that case,
 * because a sentence about the best of nothing would be an invention.
 */
function bestGroupSentence(structures: readonly RepeatedStructure[]): string {
  const best = structures[0];
  if (!best) return "";
  const lines = `${best.count} line${best.count === 1 ? "" : "s"}`;
  return best.dated.rows === 0
    ? `The largest repeated group, ${best.selector} (${lines}), carries no date this can read. `
    : `The nearest thing to a schedule is ${best.selector}: ${lines}, ` +
        `${best.dated.rows} with a date this can read. `;
}

/**
 * What the student is told when the search *did* find something.
 *
 * In core rather than at the click handler for worker rule 1's reason: the
 * options page is one of the two files the suite cannot reach, and this
 * sentence used to say "table" whatever was found — so the ECE 411 list, the
 * one page this feature was extended for, would have announced itself as a
 * table. Every number in it comes from a candidate that ran.
 */
export function candidatesFoundLine(candidates: readonly Candidate[]): string {
  if (candidates.length === 0) return "Nothing on that page looked like a schedule.";
  if (candidates.length === 1) {
    const only = candidates[0]!;
    if (only.columns) return "Found one table that looks like a schedule.";
    const lines = `${only.dated} dated line${only.dated === 1 ? "" : "s"}`;
    return `Found a list of ${lines} that looks like a schedule.`;
  }
  const tables = candidates.filter((candidate) => candidate.columns).length;
  const lists = candidates.length - tables;
  const what =
    tables === 0
      ? `${lists} lists`
      : lists === 0
        ? `${tables} tables`
        : `${tables} table${tables === 1 ? "" : "s"} and ${lists} list${lists === 1 ? "" : "s"}`;
  return `Found ${what} that could be the schedule.`;
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

/**
 * Proposing an adapter for a course page nobody has written one for (§4.5).
 *
 * Adding a course currently means capturing the page, sending it to Sushi,
 * having someone read the markup, and waiting for a push. That makes one person
 * the bottleneck for every course at the university, and it is the reason the
 * registry has eight adapters in it.
 *
 * **This does not decide anything.** It proposes, and the student confirms by
 * reading the rows it extracted off their own course page — a page they know
 * better than any parser does. That confirmation step is what makes an
 * automatic guess safe: a wrong column produces visibly wrong titles and dates,
 * and the person looking at it is the one person who can tell.
 *
 * Nothing here is a language model, and the reason is the oracle. Finding the
 * date is a search over a handful of candidates with a hard test for each one —
 * does the *real runner* read this page when told to look there? A search with
 * a checkable answer does not need a model, and this way it is deterministic,
 * mutation-testable, needs no download, and works on every machine rather than
 * on the ones with 22GB free and the right GPU.
 *
 * What it used to be was a search over two hard-coded page *shapes* — a header
 * table, and a list of `Due: 9/7` lines — and three public UIUC course pages
 * students are actually in fell outside both. Each needed a different answer to
 * one question: **where is this row's date**. ECE 374 A puts it in the `<dt>`
 * before each `<dd>`; CS 425 writes it mid-sentence after the word "due"; CS
 * 424's schedule has no header row at all. So the question is a value now (a
 * *locator*, `site.ts`), the page's own groups are crossed with all six of
 * them (`locatorEvidence`, `skeleton.ts`), and this file is the part that
 * turns a measured hook into an adapter, runs it, and ranks what survived.
 *
 * Adding a seventh page shape is no longer a change here. Adding a seventh
 * *locator* is a field in `Adapter`, a branch in `locateDue`, and a probe.
 */

import { shortHash } from "./dates.js";
import {
  headerIndex,
  locateDue,
  MIN_DATED_ROWS,
  MIN_DATED_SHARE,
  parseAdapterDate,
  PLACEHOLDER_WORDS,
  runAdapter,
  statedTimeInText,
  supportedDateFormats,
  titleSeparatorAt,
} from "../sources/site.js";
import { requiredVersionFor, validateAdapter } from "./registry.js";
import { cellAt, gridFor, width, type GridCache } from "./table-grid.js";
import { ParseError, type Adapter, type Kind, type PageCtx } from "../sources/types.js";
// Type-only, and it has to stay that way: `core/skeleton.ts` imports the
// selector spellings below, so a *value* import back would be a runtime cycle.
// The inventory is passed in by the caller instead — `searchCandidates` and
// `proposeCandidates` take the structures rather than computing them. Every
// value the search needs off a locator is carried on the evidence for the same
// reason: `spec` is the string the probe measured *and* the string the trial
// adapter declares, so the two cannot drift.
import type { LocatorEvidence, LocatorKind, RepeatedStructure } from "./skeleton.js";

/**
 * "No date yet", as both shipped entries spell it.
 *
 * One vocabulary, three readers (mutation rule 3): the `filter.exclude` a
 * proposed adapter carries, the regex `skeleton.ts` counts a group's *pending*
 * rows with, and `site.ts`'s test for a due keyword with a placeholder behind
 * it. A `Due: TBD` line is not a row whose date could not be read — it is a
 * deadline the course has not set, and the difference decides whether a group
 * of sixteen bullets with four dates is a bad guess (4 of 16) or a term that
 * has barely started (4 of 4 stated). The words live in `site.ts`, because the
 * runner is the thing that has to agree with itself.
 */
export const PLACEHOLDER_EXCLUDE = `\\b(?:${PLACEHOLDER_WORDS})\\b`;
export const PLACEHOLDER = new RegExp(PLACEHOLDER_EXCLUDE, "i");

/**
 * The same words where the runner would have found a date, and did not.
 *
 * `filter.exclude` asks whether the *title* mentions a placeholder, which is
 * the right question for a labelled list — `CP1 Due: TBD` is the whole line and
 * the whole title. It is the wrong one the moment `titleBefore` is proposed as
 * well: CS 425's `[HW6 Document]: Due Date: TBD. Released 12/1.` is titled
 * "HW6 Document", the filter sees no placeholder, and the row is kept undated
 * with `TBD. Released 12/1.` in `extra.unparsedDate`. Read as an unreadable
 * value that refuses the whole page — which it did, on a fixture written to
 * check something else entirely — rather than as the deadline the course has
 * not set yet.
 */
const PENDING_AT_START = new RegExp(`^(?:${PLACEHOLDER_WORDS})\\b`, "i");

/**
 * The share of the rows a hook *reached* that must date, for every locator that
 * is not a named column.
 *
 * Much stricter than the half a table's column needs (`MIN_DATED_SHARE`), and
 * for a reason: a column is named by the page's own header, so "most of it
 * parses" confirms a choice the page made. A label, a keyword, a preceding
 * sibling or a `<time>` tag has no such corroboration — the only evidence that
 * these rows are deadlines is that they read as dates — so a group where one
 * hooked line in three does is not a schedule this read poorly, it is prose
 * with a date in it. Pending rows are in neither half: `filter.exclude` drops
 * them, and a deadline the course has not set is not a misread.
 */
const MIN_HOOKED_SHARE = 0.8;

export interface DetectedRow {
  title: string;
  /**
   * The instant, for every kind of candidate.
   *
   * It used to be the cell's text for a table and the instant for a list, so
   * the one preview that existed to catch "reads plausibly, lands on the wrong
   * day" showed the plausible text on exactly the shape most likely to do it.
   * The text is `read` below, beside it, which is the comparison that makes
   * either number worth showing.
   */
  due: string;
  /** The text the instant was read out of (`extra.dueText`), when there is one. */
  read?: string;
}

/**
 * One proposal: a `rows` selector, one locator, one format, and what it read.
 *
 * Everything here is carried straight through `adapterFromCandidate` into the
 * registry entry, and the rule is that a field which changes what `runAdapter`
 * reads must be on this interface or it must not be proposable. That was a
 * comment for a while and a comment is not a check — a list-shaped proposal
 * validated with a `dueLabel` was once saved without one, so the entry
 * installed read every line of the list rather than the deadline lines, and
 * nothing in the preview could show it because the preview came from the other
 * object. `READ_FIELDS` below is the same sentence written so the compiler
 * reads it.
 */
export interface Candidate {
  /** A CSS selector for this page's rows, as the adapter would carry. */
  rows: string;
  /**
   * Header names, which survive a course adding a column (house rule 3).
   *
   * Absent for every shape that is not a header table, where `title` and `due`
   * below are row-relative selectors or one of the slot/sibling/keyword fields
   * locates the date instead.
   */
  columns?: { title: string; due: string; link?: string };
  /** Row-relative selectors, for a page whose rows are not table cells. */
  title?: string;
  due?: string;
  link?: string;
  /** §4.5's `label: value` list fields. See `Adapter` for what each means. */
  dueLabel?: string;
  titleFrom?: string;
  time?: string;
  splitTitle?: string;
  /** The date is a clause in the row's own sentence, after this keyword. */
  duePhrase?: string;
  /** The date is in the nearest preceding sibling matching this selector. */
  duePrev?: string;
  /** Grid columns, for a table with no header row to name (`core/table-grid.ts`). */
  dueSlot?: number;
  titleSlot?: number;
  /** The title is the text before this literal separator. */
  titleBefore?: string;
  /** `HH:mm`: the hour the page states its work is due at, once, in prose. */
  defaultTime?: string;
  /** What the rows on this page are. Omitted means `assignment`. */
  kind?: Kind;
  /** `exclude` drops the TBD/TBA/N/A lines a course leaves in place. */
  filter?: { include?: string; exclude?: string };
  dateFormat: string;
  /** Rows the adapter kept. */
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

/** What an adapter *is*, as opposed to what it reads. */
type AdapterIdentity =
  | "id"
  | "label"
  | "courseCode"
  | "term"
  | "url"
  | "hostPattern"
  | "timezone"
  | "minExtensionVersion";

/** Every `Adapter` field that changes what `runAdapter` reads. */
type ReadFields = Exclude<keyof Adapter, AdapterIdentity>;

/**
 * Each of those fields, mirrored onto the `Candidate` field that carries it.
 *
 * `satisfies Record<ReadFields, keyof Candidate>` is the check: a seventh
 * locator added to `Adapter` and forgotten here is a typecheck error, not a
 * proposal that validates one way and saves another. `adapterFromCandidate`
 * walks this table rather than listing the fields a second time, so the mirror
 * is load-bearing rather than documentation.
 */
const READ_FIELDS = {
  rows: "rows",
  title: "title",
  due: "due",
  link: "link",
  splitTitle: "splitTitle",
  columns: "columns",
  dueLabel: "dueLabel",
  duePhrase: "duePhrase",
  duePrev: "duePrev",
  dueSlot: "dueSlot",
  titleSlot: "titleSlot",
  titleBefore: "titleBefore",
  defaultTime: "defaultTime",
  titleFrom: "titleFrom",
  time: "time",
  kind: "kind",
  dateFormat: "dateFormat",
  filter: "filter",
} satisfies Record<ReadFields, keyof Candidate>;

/** Rows shown before the preview stops listing them. */
const SAMPLE_ROWS = 6;

/** Proposals the options page draws before it offers a "Show N more" button. */
export const MAX_SHOWN = 5;

/**
 * Which proposals are drawn and which are behind the button.
 *
 * A decision, so it is in core where a test can reach it rather than in the one
 * file the suite cannot see (worker rule 1). The search crosses every repeated
 * group with every hook, so a busy page yields a dozen readings that all work —
 * and a list nobody finishes reading is one where the choice is made by
 * whichever came first. The rest are one click away rather than discarded,
 * because the sixth is sometimes the right one and nothing here can tell.
 */
export function shownCandidates(candidates: readonly Candidate[]): {
  shown: Candidate[];
  hidden: Candidate[];
} {
  return { shown: candidates.slice(0, MAX_SHOWN), hidden: candidates.slice(MAX_SHOWN) };
}

/** The button's own words, beside the count it is hiding. */
export function showMoreLabel(hidden: number): string {
  return `Show ${hidden} more`;
}

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
 * course ever set. A table with no `<tbody>` has no better spelling to offer,
 * and there the runner does read the header row: that is why the count under a
 * proposal is the *runner's*, so "2 of 5" says so on screen.
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

/* -------------------------------------------------------------------------- */
/* The search: every group the page repeats, crossed with every hook           */
/* -------------------------------------------------------------------------- */

/** Everything a trial adapter needs, which is a candidate minus its results. */
type Trial = Omit<Candidate, "total" | "dated" | "sample">;

/** One candidate that ran, with what it produced. */
interface Ran {
  candidate: Candidate;
  /** `title\0dueAt` for every dated item, sorted: this candidate's identity. */
  pairs: string[];
  /**
   * How many elements this candidate's `rows` selector matched.
   *
   * Not `total`, which is what the adapter *kept*: two spellings of one set of
   * deadlines — `li` and `#mp-information ul.simple > li` — keep the same rows
   * and differ only in how much else they sweep in, and the narrower one is the
   * one that goes on meaning the same thing when the page grows a section.
   */
  count: number;
  /** Every dated item landed on an hour this code invented, not one stated. */
  assumed: boolean;
  /** The rows this hook dated, for the nested-reading rule in `dedupe`. */
  datedRows: readonly Element[];
}

/** A (group, hook) pair the search looked at and would not propose. */
export interface Nearest {
  selector: string;
  kind: LocatorKind;
  dated: number;
  of: number;
  /** Why, as a clause that finishes "…, where ". */
  reason: string;
}

export interface SearchResult {
  candidates: Candidate[];
  /**
   * The refusal worth telling the student about, when there are no candidates.
   *
   * "Nothing on that page looked like a schedule" is the least useful thing
   * this could say about a page whose one list of deadlines missed the bar by
   * one row. The refused hook with the most dated rows is the one a person
   * would look at first, so it is the one named.
   */
  nearest?: Nearest;
}

/**
 * Every proposal this page yields, best first, and why the best refusal failed.
 *
 * `structures` comes from `core/skeleton.ts`, which imports this file, so it is
 * passed in rather than computed here (see the type-only import above).
 */
export function searchCandidates(
  doc: Document,
  reference: string,
  timezone: string,
  structures: readonly RepeatedStructure[] = [],
): SearchResult {
  const ran: Ran[] = [];
  const refused: Nearest[] = [];
  const grids: GridCache = new Map();

  for (const structure of structures) {
    let rows: Element[];
    try {
      rows = [...doc.querySelectorAll(structure.selector)];
    } catch {
      // A selector the inventory built that this DOM will not parse is a bug
      // there, not a proposal.
      continue;
    }
    // The inventory measured a different document, or the page moved under it.
    if (rows.length !== structure.count) continue;

    for (const evidence of structure.locators) {
      const refuse = (reason: string): void => {
        refused.push({
          selector: structure.selector,
          kind: evidence.kind,
          dated: evidence.dated,
          of: evidence.of,
          reason,
        });
      };

      if (evidence.dated < MIN_DATED_ROWS) {
        refuse(`only ${evidence.dated} row carries a date this can read`);
        continue;
      }
      const floor = evidence.kind === "header" ? MIN_DATED_SHARE : MIN_HOOKED_SHARE;
      const of =
        evidence.kind === "header"
          ? evidence.of
          : Math.max(1, evidence.hooked - evidence.pending);
      if (evidence.dated / of < floor) {
        refuse(
          `only ${evidence.dated} of ${of} rows carry a date this can read, ` +
            `which is under the ${Math.round(floor * 100)}% this needs`,
        );
        continue;
      }

      /*
       * A column read by position is refused when the rows themselves say a
       * different date after the word "due".
       *
       * CS 425's lectures table has a column of lecture dates and, in another
       * cell, `MP1 due 11.59 PM 9/13`. The column read 9/10 for that row and
       * was offered first, because it dated more rows than the sentence did.
       * A slot has no header to corroborate it, so the one check available is
       * the page's own words — and where they disagree on two or more rows,
       * the position is the reading that is wrong. The same holds for a header
       * that does not itself say "due".
       */
      const unspokenFor =
        evidence.kind === "slot" ||
        // A header that does not say "due" names a column, not a deadline: a
        // lecture table headed `Date | Topic` is the same trap with a label on
        // it. One headed `Due Date` is the page's own statement and stands.
        (evidence.kind === "header" && !DUE_WORD_RE.test(evidence.spec));
      if (unspokenFor) {
        const spoken = structure.locators.find(
          (other) =>
            other.kind === "phrase" &&
            other.cell !== undefined &&
            other.dated >= MIN_DATED_ROWS &&
            disagreements(rows, evidence, other, timezone, reference, grids) >= MIN_DATED_ROWS,
        );
        if (spoken) {
          refuse(
            `its rows say a different date after the word ${quote(spoken.spec)} ` +
              "than the column holds",
          );
          continue;
        }
      }

      const trial = trialFor(structure, evidence, rows, grids);
      if (!trial) {
        refuse("there is nothing on these rows this could use as a name");
        continue;
      }
      const outcome = runCandidate(trial, doc, reference, timezone);
      if (!outcome.ok) {
        refuse(outcome.reason);
        continue;
      }
      ran.push({ ...outcome, datedRows: evidence.datedAt.map((at) => rows[at]!) });
    }
  }

  withDefaultTime(ran, doc, reference, timezone);
  const candidates = dedupe(ran.sort(byRank));
  const nearest =
    candidates.length > 0
      ? undefined
      : refused.sort((a, b) => b.dated - a.dated || b.of - a.of)[0];
  return { candidates, ...(nearest ? { nearest } : {}) };
}

/** Every candidate this page yields, best first. */
export function proposeCandidates(
  doc: Document,
  reference: string,
  timezone: string,
  structures: readonly RepeatedStructure[] = [],
): Candidate[] {
  return searchCandidates(doc, reference, timezone, structures).candidates;
}

/**
 * How two proposals for one page are ordered.
 *
 * `dated` first, because it is the only thing here that can be checked without
 * a human. Then the share of what it keeps, so a reading that drops nothing
 * beats one that drops a third. Then **specificity**: where two hooks read the
 * same rows, the one the page corroborates most goes first — a named column is
 * the page's own word for what that cell is, a declared label nearly so, and a
 * grid slot is a guess about layout with nothing behind it but the fact that it
 * worked today. Ordering is a suggestion and not a decision: the student picks
 * by reading the rows, which is the only check that can tell these apart.
 */
const SPECIFICITY: Record<LocatorKind | "free", number> = {
  header: 6,
  label: 5,
  prev: 4,
  phrase: 3,
  attr: 2,
  slot: 1,
  free: 0,
};

function byRank(a: Ran, b: Ran): number {
  return (
    b.candidate.dated - a.candidate.dated ||
    b.candidate.dated / Math.max(1, b.candidate.total) -
      a.candidate.dated / Math.max(1, a.candidate.total) ||
    SPECIFICITY[locatorKindOf(b.candidate)] - SPECIFICITY[locatorKindOf(a.candidate)] ||
    a.count - b.count ||
    a.candidate.rows.length - b.candidate.rows.length
  );
}

/**
 * One proposal per set of rows, not one per way of spelling them.
 *
 * A page repeats the same bullets under half a dozen selectors — `li`,
 * `ul > li`, `#assignments ul.simple > li` — and every one of them reads the
 * same deadlines. Offered as six proposals that is a list nobody finishes
 * reading, and the one they pick is whichever they got to first rather than the
 * narrowest. Keyed on what the candidate *produced*, because that is what two
 * spellings of one answer have in common and what a wider group that also
 * catches the late-policy bullet does not.
 *
 * A proper subset goes too, but only within one kind: a reading that finds four
 * of another reading's five deadlines is the same answer with a row missing.
 * Across kinds it is a genuinely different reading of the page — the exams read
 * by their labels are a subset of every dated line on the syllabus — and the
 * student is the one who can say which they meant.
 */
function dedupe(ranked: readonly Ran[]): Candidate[] {
  const kept: Ran[] = [];
  for (const candidate of ranked) {
    const key = candidate.pairs.join("\n");
    const covered = kept.some((other) => {
      if (other.pairs.join("\n") === key) return true;
      if (locatorKindOf(other.candidate) !== locatorKindOf(candidate.candidate)) return false;
      const theirs = new Set(other.pairs);
      if (candidate.pairs.every((pair) => theirs.has(pair))) return true;
      return readsInside(candidate, other);
    });
    if (!covered) kept.push(candidate);
  }
  return kept.map((outcome) => outcome.candidate);
}

/**
 * Whether `inner` is a reading of the same deadlines from *inside* `outer`'s
 * rows.
 *
 * CS 425's assignments are `<li>[HW1 Document]: <span>Released 8/27. Due @
 * 9/20 …</span></li>`, and both the `li` and the `span` repeat, so the phrase
 * hook reads the same eight dates twice — once titled `HW1 Document`, once
 * titled by the whole sentence. The pairs differ (the titles do), so the
 * subset rule above does not see them as one answer, and the student was shown
 * a second box of sentence-length names under the right one. An element inside
 * a row is not a second row: when every one of a candidate's rows sits inside
 * one of a kept candidate's rows and it dates nothing the kept one does not,
 * it is the kept one read from further in, and the outer reading — which is
 * where the row's own name lives — is the one to show. Only the rows each hook
 * *dated* are compared: a bare `span` selector also matches the page's nav,
 * and those are nobody's rows.
 */
function readsInside(inner: Ran, outer: Ran): boolean {
  const outerDues = new Set(outer.pairs.map(dueOf));
  if (!inner.pairs.every((pair) => outerDues.has(dueOf(pair)))) return false;
  return inner.datedRows.every((row) =>
    outer.datedRows.some((host) => host !== row && host.contains(row)),
  );
}

/** The instant half of a `title\0dueAt` pair. */
function dueOf(pair: string): string {
  return pair.slice(pair.indexOf("\0") + 1);
}

/* -------------------------------------------------------------------------- */
/* Turning one measured hook into an adapter                                   */
/* -------------------------------------------------------------------------- */

/** A cell of the grid this row belongs to, the way the runner reads one. */
function cellOf(row: Element, slot: number, grids: GridCache): Element | undefined {
  const grid = gridFor(row, grids);
  return grid ? cellAt(grid, row, slot) : undefined;
}

/** A word that makes a cell an assignment rather than a lecture (CS 424). */
const DUE_WORD = "\\bdue\\b";
const DUE_WORD_RE = new RegExp(DUE_WORD, "i");

/** The `titleBefore` this search proposes, and how far into a row it looks. */
const TITLE_SEPARATOR = ":";
const TITLE_SEPARATOR_WITHIN = 60;

/**
 * The adapter one (group, hook) pair would be, or nothing.
 *
 * Every field here comes from something measured: the rows from the inventory,
 * the locator and the format from the evidence, the title column from the dated
 * rows themselves. Nothing is a default that happened to work on one page.
 */
/** Whether a row's text has its name in front of the separator, by the runner's own rule. */
function namedBySeparator(text: string): boolean {
  const at = titleSeparatorAt(text, TITLE_SEPARATOR);
  return at >= 0 && at < TITLE_SEPARATOR_WITHIN;
}

/** How many rows two readings both date, to different instants. */
function disagreements(
  rows: readonly Element[],
  column: LocatorEvidence,
  spoken: LocatorEvidence,
  timezone: string,
  reference: string,
  grids: GridCache,
): number {
  const byColumn = instantsByRow(rows, column, timezone, reference, grids);
  const bySentence = instantsByRow(rows, spoken, timezone, reference, grids);
  let differ = 0;
  for (const [at, instant] of bySentence) {
    const other = byColumn.get(at);
    if (other !== undefined && other !== instant) differ += 1;
  }
  return differ;
}

/** The instant each of an evidence's dated rows reads to, under its own hook and format. */
function instantsByRow(
  rows: readonly Element[],
  evidence: LocatorEvidence,
  timezone: string,
  reference: string,
  grids: GridCache,
): Map<number, string> {
  const fragment: Record<string, unknown> = { due: "." };
  if (evidence.cell && "slot" in evidence.cell) fragment["dueSlot"] = evidence.cell.slot;
  else if (evidence.cell) fragment["columns"] = { title: "", due: evidence.cell.header };
  else if (evidence.kind === "slot") fragment["dueSlot"] = Number(evidence.spec);
  else if (evidence.kind === "header") fragment["columns"] = { title: "", due: evidence.spec };
  if (evidence.kind === "phrase") fragment["duePhrase"] = evidence.spec;
  const adapter = fragment as unknown as Adapter;
  const instants = new Map<number, string>();
  for (const at of evidence.datedAt) {
    const located = locateDue(rows[at]!, adapter, grids);
    for (const text of located.texts) {
      const instant = parseAdapterDate(text, evidence.format, timezone, reference);
      if (instant !== undefined) {
        instants.set(at, instant);
        break;
      }
    }
  }
  return instants;
}

function trialFor(
  structure: RepeatedStructure,
  evidence: LocatorEvidence,
  rows: readonly Element[],
  grids: GridCache,
): Trial | undefined {
  const dated = evidence.datedAt.map((at) => rows[at]!);
  const base = { rows: structure.selector, dateFormat: evidence.format };

  if (evidence.kind === "header") {
    const table = dated[0]!.closest("table");
    if (!table) return undefined;
    const headers = headerIndex(table, grids);
    const dueSlot = headers.get(evidence.spec);
    if (dueSlot === undefined) return undefined;
    const title = pickTitleColumn(
      [...headers].map(([name, slot]) => ({ key: name, slot })),
      dueSlot,
      dated,
      grids,
    );
    if (!title) return undefined;
    const linked = dated.some((row) => cellOf(row, title.slot, grids)?.querySelector("a[href]"));
    return {
      ...base,
      columns: {
        title: title.key,
        due: evidence.spec,
        ...(linked ? { link: title.key } : {}),
      },
      // The positional fallback a header table has always been saved with, for
      // a header that has gone missing at parse time — declared here rather
      // than added at save time so what runs is what is written down.
      title: "td:nth-child(1)",
      due: "td:nth-child(2)",
    };
  }

  if (evidence.kind === "slot") {
    const dueSlot = Number(evidence.spec);
    const titleSlot = pickDueWordColumn(dueSlot, dated, grids);
    /*
     * No column saying "due" means no candidate, and that is the whole reason
     * a slot is proposable at all.
     *
     * A grid column is position, which house rule 3 forbids because one added
     * column silently re-dates a page. It is allowed here only where the page
     * leaves nothing else to name — and the price is that the *page* has to
     * corroborate the choice. On CS 424 the assignment column says "HW5 Due;
     * HW6 Out" on every row that carries a deadline; with no such column the
     * search would happily offer the lecture-topic column beside the date and
     * file every lecture as an assignment.
     */
    if (titleSlot === undefined) return undefined;
    const cells = dated.map((row) => textOf(cellOf(row, titleSlot, grids)));
    const split = cells.filter((text) => text.includes(";")).length >= MIN_DATED_ROWS;
    return {
      ...base,
      dueSlot,
      titleSlot,
      // `validateAdapter` wants both, and a grid adapter reads neither: the
      // slots are the locators. Deliberately inert rather than plausible — a
      // real-looking `td:nth-child(2)` here would stand in silently the day
      // someone deleted a slot.
      title: "td",
      due: "td",
      ...(split ? { splitTitle: ";" } : {}),
      filter: { include: DUE_WORD },
    };
  }

  if (evidence.cell) {
    // The keyword inside one cell: that cell is both the name and, after the
    // word, the date. `validateAdapter` wants `title` and `due` present; the
    // slots or headers are what read the row, so the strings are inert.
    const cell = evidence.cell;
    const texts = dated.map((row) => {
      const slot =
        "slot" in cell
          ? cell.slot
          : headerIndex(row.closest("table") ?? row, grids).get(cell.header);
      return slot === undefined ? "" : textOf(cellOf(row, slot, grids));
    });
    const named = texts.length > 0 && texts.every(namedBySeparator);
    return {
      ...base,
      ...("slot" in cell
        ? { dueSlot: cell.slot, titleSlot: cell.slot, title: "td", due: "td" }
        : {
            columns: { title: cell.header, due: cell.header },
            title: "td:nth-child(1)",
            due: "td:nth-child(2)",
          }),
      duePhrase: evidence.spec,
      filter: { exclude: PLACEHOLDER_EXCLUDE },
      ...(named ? { titleBefore: TITLE_SEPARATOR } : {}),
    };
  }

  // The four hooks that live outside a table. Their rows have no cells, so the
  // name is the row's own text (cut at `titleBefore`) or the heading above it.
  const whole: Trial = {
    ...base,
    title: ".",
    due: evidence.kind === "attr" ? evidence.spec : ".",
    filter: { exclude: PLACEHOLDER_EXCLUDE },
  };

  if (evidence.kind === "label") {
    /*
     * A row in a list has no name of its own, so a group with no heading over
     * it is one whose every row would be titled "Due" — and §3.1 hashes the
     * title, so three such rows collide on one `sourceId` and `KeyGuard` keeps
     * one of the three. `repeatedStructures` gives a group of table rows or
     * cells no `titleFrom` at all, which is what keeps this off a table.
     */
    if (structure.titleFrom === undefined) return undefined;
    return { ...whole, dueLabel: evidence.spec, titleFrom: structure.titleFrom };
  }

  const linked = dated.filter((row) => row.querySelector("a[href]")).length * 2 >= dated.length;
  const named = dated.every((row) => namedBySeparator(textOf(row))) && dated.length > 0;
  return {
    ...whole,
    ...(evidence.kind === "prev" ? { duePrev: evidence.spec } : {}),
    ...(evidence.kind === "phrase" ? { duePhrase: evidence.spec } : {}),
    // `a@href` only where most rows have one: a `link` that resolves on two
    // rows in eleven puts the course page on the other nine, which is what the
    // fallback already does, and makes the entry look like it read more than it
    // did.
    ...(linked && evidence.kind !== "phrase" ? { link: "a@href" } : {}),
    // The row is a whole sentence and the name is the head of it. Only when
    // *every* dated row is shaped that way: a separator that is present on half
    // of them cuts the other half's titles at a colon that means something else.
    ...(named ? { titleBefore: TITLE_SEPARATOR } : {}),
  };
}

interface Column {
  key: string;
  slot: number;
}

/**
 * The column most likely to be an assignment name.
 *
 * Not the first column: plenty of schedules lead with a week number or a date.
 * Preferred in order — a column whose cells link somewhere (a course site links
 * the assignment), then the leftmost column with substantial text. A column
 * whose cells are mostly empty or numeric is never it.
 *
 * Addressed by **grid slot** and reached through `cellAt`, so it answers the
 * same cell the runner will: counting a row's children puts every column after
 * a `rowspan` or a `<th colspan="2">` one place left of where it is drawn.
 */
function pickTitleColumn(
  columns: readonly Column[],
  dueSlot: number,
  rows: readonly Element[],
  grids: GridCache,
): Column | undefined {
  let best: { column: Column; score: number } | undefined;

  for (const column of columns) {
    if (column.slot === dueSlot) continue;
    let filled = 0;
    let linked = 0;
    for (const row of rows) {
      const cell = cellOf(row, column.slot, grids);
      const text = textOf(cell);
      // A bare number is a week or a unit, never an assignment name.
      if (text.length < 2 || /^\d+$/.test(text)) continue;
      filled += 1;
      if (cell?.querySelector("a[href]")) linked += 1;
    }
    if (filled === 0) continue;
    // A link is worth more than position, and position breaks the tie.
    const score = filled + linked * 2 - column.slot * 0.01;
    if (!best || score > best.score) best = { column, score };
  }

  return best?.column;
}

/**
 * The slot whose cells say "due" on the dated rows — a grid's title column.
 *
 * Most wins, and `pickTitleColumn`'s score breaks the tie, so a page with two
 * such columns still prefers the one that is filled and linked.
 */
function pickDueWordColumn(
  dueSlot: number,
  rows: readonly Element[],
  grids: GridCache,
): number | undefined {
  const grid = gridFor(rows[0]!, grids);
  if (!grid) return undefined;
  const counted: { slot: number; n: number }[] = [];
  for (let slot = 0; slot < width(grid); slot += 1) {
    if (slot === dueSlot) continue;
    const n = rows.filter((row) => DUE_WORD_RE.test(textOf(cellOf(row, slot, grids)))).length;
    if (n >= MIN_DATED_ROWS) counted.push({ slot, n });
  }
  if (counted.length === 0) return undefined;
  const most = Math.max(...counted.map((column) => column.n));
  const tied = counted.filter((column) => column.n === most);
  if (tied.length === 1) return tied[0]!.slot;
  return pickTitleColumn(
    tied.map((column) => ({ key: String(column.slot), slot: column.slot })),
    dueSlot,
    rows,
    grids,
  )?.slot;
}

/**
 * One proposal, put through the runner the sync loop will use.
 *
 * The oracle, and the reason none of this needs a model. What the student
 * confirms is produced by the same `runAdapter` that will read the page every
 * morning — not by a second reading of the same rules, which is how a proposal
 * used to validate against one reading and be saved under another.
 */
function runCandidate(
  trial: Trial,
  doc: Document,
  reference: string,
  timezone: string,
): ({ ok: true } & Omit<Ran, "datedRows">) | { ok: false; reason: string } {
  /*
   * A stand-in URL, because this path has not got the real one.
   *
   * The offscreen `detect-adapter` message carries the HTML, the reference and
   * the timezone — not the address (`messages.ts`). Nothing in a candidate
   * depends on it, and `adapterFromCandidate` writes the page's real address
   * when the student saves. `validateAdapter` wants a URL and a matching
   * `hostPattern`, and an invalid host is the honest way to say "not decided
   * here" — a plausible one would read like a claim about where this page lives.
   */
  const proposed = {
    id: "proposed",
    label: "proposed",
    courseCode: "PROPOSED",
    term: "proposed",
    url: "https://example.invalid/page",
    hostPattern: "https://example.invalid/*",
    ...trial,
    timezone,
    minExtensionVersion: requiredVersionFor(trial),
  };
  const { adapter, reason } = validateAdapter(proposed);
  if (!adapter) return { ok: false, reason: reason ?? "the entry this would save is not valid" };

  const page: PageCtx = { url: adapter.url, fetchedAt: reference };
  let items;
  try {
    items = runAdapter(adapter as Adapter, doc, page);
  } catch (err) {
    // A ParseError is the ordinary "this was not it" answer: no row matched, no
    // row carried the label, the column moved.
    if (err instanceof ParseError) return { ok: false, reason: err.message };
    throw err;
  }
  if (items.length === 0) return { ok: false, reason: "it keeps no rows at all" };
  if (items.some((item) => item.title.trim() === "")) {
    return { ok: false, reason: "one of the rows it keeps has no name" };
  }
  /*
   * A value the runner could not read whole costs the whole candidate — except
   * on a named column, where it does not.
   *
   * A list, a sentence or a sibling has no header to corroborate a partial
   * read: the only evidence those rows are deadlines is that they read as
   * dates, so a kept row with `unparsedDate` on it usually means the group or
   * the format is wrong rather than that one line is odd. A column the page
   * itself labelled "Due Date" is different — a schedule has section breaks,
   * "no class" weeks and the odd note, and refusing the whole table over one of
   * them would refuse most real schedules.
   */
  const unparsed = items.find((item) => {
    const value = item.extra?.["unparsedDate"] ?? item.extra?.["unparsedTime"];
    // A placeholder is a deadline the course has not set, not a value this
    // failed to read, and §11 treats the two differently — see
    // `PENDING_AT_START`.
    return value !== undefined && !PENDING_AT_START.test(value);
  });
  if (unparsed && locatorKindOf(trial) !== "header") {
    return {
      ok: false,
      reason:
        `row ${JSON.stringify(unparsed.title)} has a date this could not read whole ` +
        `(${unparsed.extra?.["unparsedDate"] ?? unparsed.extra?.["unparsedTime"]})`,
    };
  }
  const dated = items.filter((item) => item.dueAt !== undefined);
  if (dated.length === 0) return { ok: false, reason: "none of the rows it keeps carries a date" };

  return {
    ok: true,
    candidate: {
      ...trial,
      total: items.length,
      dated: dated.length,
      sample: dated.slice(0, SAMPLE_ROWS).map((item) => ({
        title: item.title,
        // The instant, not the text: a line that reads plausibly and lands on
        // the wrong day is what this preview exists to catch.
        due: item.dueAt ?? "",
        ...(item.extra?.["dueText"] ? { read: item.extra["dueText"] } : {}),
      })),
    },
    pairs: dated
      .map((item) => `${item.title.toLowerCase().replace(/\s+/g, " ").trim()} ${item.dueAt}`)
      .sort(),
    count: doc.querySelectorAll(adapter.rows).length,
    assumed: dated.every((item) => item.extra?.["timeAssumed"] === "true"),
  };
}

/* -------------------------------------------------------------------------- */
/* The hour a page states once, in prose, and never again                      */
/* -------------------------------------------------------------------------- */

/** Elements whose text is prose. A `<script>` is not one of them. */
const PROSE =
  "p, li, dt, dd, h1, h2, h3, h4, h5, h6, td, th, div, span, strong, em, b, i, blockquote, caption";

/**
 * `defaultTime`, when the page states one cutoff outside its own rows.
 *
 * ECE 374 A prints "Written homeworks are due every **Tuesday at 9pm**" in a
 * paragraph above the list and then writes bare dates, so every row lands on
 * §4.5's invented 23:59 — three hours late, with a two-hour reminder arriving
 * an hour after the deadline passed. The sentence is right there on the page
 * and the student would have to find it, read it, and type `21:00` into a field
 * they have no reason to understand. This is that sentence, proposed.
 *
 * Three conditions, and each one is load-bearing. **Outside every candidate's
 * rows**, because a cutoff inside a row is that row's own and `runAdapter`
 * already reads it — a page-wide default built from one row's sentence would
 * put that row's hour on all the others. **Exactly one** clock, because two
 * sentences stating different hours mean the page has no single default and
 * picking one of them is an invention. And **every dated item assumed**,
 * because a candidate whose rows already state their own times has nothing for
 * a default to do.
 *
 * `extra.timeAssumed` stays set on the rows either way (`site.ts`): 21:00 is
 * this extension's inference from a sentence about homework in general, and
 * §5.3 must go on ranking a real Canvas instant above it (worker rule 3).
 */
function statedDefaultTime(doc: Document, rows: readonly Element[]): string | undefined {
  const excluded = new Set<Element>();
  for (const row of rows) {
    excluded.add(row);
    // Descendants are *inside* a row; ancestors *contain* one, and their text
    // is the rows' text plus a wrapper.
    for (const inside of row.querySelectorAll("*")) excluded.add(inside);
    for (let node = row.parentElement; node; node = node.parentElement) excluded.add(node);
  }

  const clocks = new Set<string>();
  for (const element of doc.querySelectorAll(PROSE)) {
    if (excluded.has(element)) continue;
    const stated = clocksIn(textOf(element));
    if (stated.length === 0) continue;
    // The innermost element that states it, so one sentence in a `<p>` inside a
    // `<div>` is one statement rather than two.
    if ([...element.querySelectorAll(PROSE)].some((child) => clocksIn(textOf(child)).length > 0)) {
      continue;
    }
    for (const clock of stated) clocks.add(clock);
  }
  return clocks.size === 1 ? [...clocks][0] : undefined;
}

/**
 * Every cutoff a passage states, not the first one.
 *
 * `statedTimeInText` answers about a *row*, where one sentence is the whole
 * question. A paragraph is not a row: "Homeworks are due at 9pm. Labs are due by
 * 5pm." states two different defaults, and reading only the first turns a page
 * with no single answer into a confident one. Split on the sentence boundary
 * the reader itself cannot cross — its `[^.;]{0,24}` will not span a `.` or a
 * `;` — so nothing is lost by asking sentence by sentence. The whitespace in
 * the split is what keeps "11.59 PM" one token.
 */
function clocksIn(text: string): string[] {
  const found: string[] = [];
  for (const sentence of text.split(/(?<=[.;])\s+/)) {
    const stated = statedTimeInText(sentence);
    if (!stated) continue;
    found.push(
      `${String(stated.hour).padStart(2, "0")}:${String(stated.minute).padStart(2, "0")}`,
    );
  }
  return found;
}

/** A candidate read back as the adapter it came from — its results dropped. */
function trialOf(candidate: Candidate): Trial {
  const trial: Record<string, unknown> = {};
  for (const source of Object.values(READ_FIELDS) as (keyof Candidate)[]) {
    const value = candidate[source];
    if (value !== undefined) trial[source] = value;
  }
  return trial as unknown as Trial;
}

/** Re-runs every candidate the page's stated hour would change. */
function withDefaultTime(
  ran: Ran[],
  doc: Document,
  reference: string,
  timezone: string,
): void {
  if (!ran.some((outcome) => outcome.assumed)) return;
  const rows: Element[] = [];
  for (const outcome of ran) {
    try {
      rows.push(...doc.querySelectorAll(outcome.candidate.rows));
    } catch {
      continue;
    }
  }
  const defaultTime = statedDefaultTime(doc, rows);
  if (!defaultTime) return;

  for (const [index, outcome] of ran.entries()) {
    if (!outcome.assumed) continue;
    const again = runCandidate(
      { ...trialOf(outcome.candidate), defaultTime },
      doc,
      reference,
      timezone,
    );
    // A refusal here leaves the candidate as it was: the hour is an improvement
    // on an invented 23:59, never a reason to lose a reading that worked.
    if (again.ok) ran[index] = { ...again, datedRows: outcome.datedRows };
  }
}

/* -------------------------------------------------------------------------- */
/* What the student is told                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Which hook a candidate carries, derived from the fields rather than stored.
 *
 * `core/author.ts` produces candidates too, and a model may answer with a plain
 * row-relative `due` that is none of the six — `"free"` is that, and it is the
 * shape every hand-written entry had before locators existed.
 */
export function locatorKindOf(candidate: Trial): LocatorKind | "free" {
  // The reader names the kind before the cell does: a keyword read inside a
  // table cell is the sentence's reading, whatever addressed the cell.
  if (candidate.duePhrase) return "phrase";
  if (candidate.columns) return "header";
  if (candidate.dueSlot !== undefined) return "slot";
  if (candidate.duePrev) return "prev";
  if (candidate.dueLabel) return "label";
  if (candidate.due?.includes("@")) return "attr";
  return "free";
}

/** The tag an `attr` or `free` candidate reads, out of its `due` selector. */
function dueTag(candidate: Trial): string {
  return (candidate.due ?? "").split("@")[0] || ".";
}

/**
 * One line saying where this proposal reads each row's date and name.
 *
 * In core rather than at the click handler for worker rule 1's reason, and
 * written out per hook rather than printed as a selector because the heading is
 * the one thing a student reads before deciding whether the rows below it are
 * right. `#mp-information ul.simple > li · Due|CP1 Due|CP2 Due` is a true
 * sentence about the adapter and tells nobody anything about the page.
 */
export function locatorDescription(candidate: Candidate): string {
  const kind = locatorKindOf(candidate);
  if (kind === "header" && candidate.columns) {
    return (
      `date in the ${quote(candidate.columns.due)} column, ` +
      `name in the ${quote(candidate.columns.title)} column`
    );
  }
  if (kind === "slot") {
    return (
      `date in column ${(candidate.dueSlot ?? 0) + 1} of a table with no header row` +
      (candidate.titleSlot === undefined ? "" : `, name in column ${candidate.titleSlot + 1}`)
    );
  }
  if (kind === "label") {
    const labels = (candidate.dueLabel ?? "").split("|");
    const more = labels.length > 1 ? ` and ${labels.length - 1} more labels` : "";
    return (
      `date after ${quote(`${labels[0]}:`)} on each line, ` +
      `name from the heading above${more}`
    );
  }
  if (kind === "prev") return `date in the <${candidate.duePrev}> before each entry`;
  if (kind === "phrase") {
    const where =
      candidate.dueSlot !== undefined
        ? `in column ${candidate.dueSlot + 1} of a table with no header row`
        : candidate.columns
          ? `in the ${quote(candidate.columns.due)} column`
          : "in each line";
    return `date after the word ${quote(candidate.duePhrase ?? "due")} ${where}`;
  }
  if (kind === "attr") return "date from each row's <time> tag";
  return `date from ${quote(dueTag(candidate))} in each row`;
}

/** Curly quotes, because this is prose a student reads, not a code listing. */
function quote(text: string): string {
  return `“${text}”`;
}

/**
 * The short lines under a proposal's heading: what it matched and what it does.
 *
 * Every one of them is something a student cannot see by reading the rows. The
 * count is the first, because "13 of 13" and "6 of 20" are different answers
 * and the second means the page is not fully covered; the rest each name a
 * decision this search took on their behalf, which is the only chance they get
 * to disagree with it.
 */
export function candidateNotes(candidate: Candidate): string[] {
  const notes = [
    candidate.rows,
    `${candidate.dated} of ${candidate.total} rows have a date this can read.`,
  ];
  if (candidate.dueSlot !== undefined) {
    notes.push(
      "Read by position — the page has no header to name, so a column added later " +
        "breaks this and the extension will say so.",
    );
  }
  if (candidate.splitTitle) {
    notes.push(
      `Cells with ${quote(candidate.splitTitle)} are split into one deadline each; ` +
        "parts without the word “due” are dropped.",
    );
  }
  if (candidate.defaultTime) {
    notes.push(
      `Every deadline with no stated time is set to ${candidate.defaultTime}, ` +
        "because the page says so once.",
    );
  }
  return notes;
}

/**
 * Why a page produced nothing, in words a student can act on.
 *
 * "No candidates" is the least useful thing this could say. The four real
 * causes need four different next steps, and only one of them is "give up".
 * There is no list of *shapes* here any more, and that is the point: the search
 * no longer has two of them to be outside of, so a sentence naming them would
 * describe a version of this file that stopped existing.
 */
export function noCandidateReason(
  doc: Document,
  /** The page's own inventory, which the last sentence is read off. */
  structures: readonly RepeatedStructure[] = [],
  /** The refusal the search got closest with, when it looked at anything. */
  nearest?: Nearest,
): string {
  const formats = `The date formats this understands are ${supportedDateFormats().join(", ")}.`;
  if (nearest) {
    return (
      `The nearest thing to a schedule is ${nearest.selector}, where ${nearest.reason}. ` +
      `${formats}`
    );
  }
  const best = structures[0];
  if (!best) {
    /*
     * This sentence used to name the two shapes the search could read and offer
     * the model for everything else. Both halves were false by the time anyone
     * read them twice — first because `dueLabel` shipped, then because the list
     * proposer did — so it is written against what the *page* has instead,
     * which cannot go stale: nothing on it repeats, and a schedule is a
     * repetition or it is not a schedule.
     */
    return (
      "Nothing on this page repeats: no table with rows, no list with items, no run of " +
      "blocks. Either the schedule is built by JavaScript after the page loads, which this " +
      "cannot read, or the page has one deadline on it — Chrome's built-in model can still " +
      "propose an entry on a computer that has the model, and a hand-written entry can " +
      "always be written for it."
    );
  }
  const lines = `${best.count} line${best.count === 1 ? "" : "s"}`;
  if (best.dated.rows === 0 && best.locators.length === 0) {
    return `The largest repeated group, ${best.selector} (${lines}), carries no date this can read. ${formats}`;
  }
  const dated = Math.max(best.dated.rows, ...best.locators.map((locator) => locator.dated));
  return (
    `The nearest thing to a schedule is ${best.selector}: ${lines}, ` +
    `${dated} with a date this can read. ${formats}`
  );
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
  // A grid candidate is a table too — it is a table with nothing to name, which
  // is why it has no `columns` — and calling it a list would be the same wrong
  // word this sentence was rewritten to stop saying.
  const isTable = (candidate: Candidate): boolean => {
    const kind = locatorKindOf(candidate);
    return kind === "header" || kind === "slot";
  };
  if (candidates.length === 1) {
    const only = candidates[0]!;
    if (isTable(only)) return "Found one table that looks like a schedule.";
    const lines = `${only.dated} dated line${only.dated === 1 ? "" : "s"}`;
    return `Found a list of ${lines} that looks like a schedule.`;
  }
  const tables = candidates.filter(isTable).length;
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
 * Every read-affecting field is copied by walking `READ_FIELDS`, so the next
 * locator is carried here the day it is added to `Adapter` or the typecheck
 * fails. Listing them by hand is what let `dueLabel` go missing.
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
  const entry: Record<string, unknown> = {
    id: localAdapterId(courseCode, term, url),
    label: `${courseCode} course site`,
    courseCode,
    term,
    url,
    hostPattern: `${host}/*`,
  };
  for (const [field, source] of Object.entries(READ_FIELDS) as [string, keyof Candidate][]) {
    const value = candidate[source];
    if (value !== undefined) entry[field] = value;
  }
  // The table shape is unchanged: `columns`, plus the positional fallback for a
  // header that has gone missing at parse time. Every other shape carries its
  // own row-relative `title` / `due`, and `validateAdapter` wants both present
  // whichever locator actually reads the row.
  if (candidate.columns) {
    entry["title"] = candidate.title ?? "td:nth-child(1)";
    entry["due"] = candidate.due ?? "td:nth-child(2)";
  } else {
    entry["title"] = candidate.title ?? "";
    entry["due"] = candidate.due ?? "";
  }
  // The page decides what these rows are, not the proposal: a syllabus added
  // without `kind` files two midterms as homework and leaves the Exams tab
  // empty. Omitted when it is the default, so a saved entry reads like a
  // hand-written one rather than carrying a field it did not need.
  if (kind && kind !== "assignment") entry["kind"] = kind;
  else delete entry["kind"];
  entry["timezone"] = SITE_TIMEZONE;
  // The floor is read off the fields that were just written, so an entry using
  // a locator added in 1.1.0 says so without anyone remembering which build
  // learned it.
  entry["minExtensionVersion"] = requiredVersionFor(entry);
  return entry as Record<string, unknown> & { id: string };
}

/**
 * The id a self-added entry gets: course, term, the page, `local`.
 *
 * It was `${course}-${term}-local`, and a course keeps its deadlines on more
 * than one page — ECE 411's MPs and exams, CS 374 A's homeworks and guided
 * problem sets. The second page a student added replaced the first, silently,
 * because `withLocalAdapter` keys on the id (2026-09-20, live). The page's last
 * path segment tells them apart (`cs374-fa26-homeworks-local`,
 * `cs374-fa26-gps-local`); a site's index page, whose last segment is the term
 * or nothing, keeps the short id it always had. A segment that is not a plain
 * token is hashed rather than trusted into an id.
 */
export function localAdapterId(courseCode: string, term: string, url: string): string {
  const base = `${courseCode.toLowerCase()}-${term}`;
  const segment = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
  const page = segment.replace(/\.[a-z0-9]{1,5}$/i, "").toLowerCase();
  if (page === "" || page === "index" || /^(?:fa|sp|su|wi)\d{2,4}$/.test(page)) return `${base}-local`;
  if (/^[a-z][a-z0-9_-]{0,30}$/.test(page)) return `${base}-${page}-local`;
  return `${base}-${shortHash(segment)}-local`;
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
    // A section suffix (`cs374al1`, `ECE374BL1`) is part of the slug on the
    // Grainger host and no part of the code: the student saw "CS225" in that
    // box for a CS 374 page until this read past it. Letters then at most two
    // digits, so `fa2026` — four digits — still matches nothing.
    const match = /^([a-z]{2,4})[\s_-]?(\d{3})(?:[a-z]{1,3}\d{0,2})?$/i.exec(segment);
    if (match) return `${match[1]!.toUpperCase()}${match[2]}`;
  }
  return undefined;
}

/**
 * A course page, rendered small enough to show a model (§4.5 self-serve).
 *
 * `detect.ts` proposes an adapter by *search*: every column crossed with every
 * supported date format, kept when enough rows parse. That is deterministic and
 * needs no download, and it is the right answer whenever it finds one. It also
 * cannot read CS 424's schedule — no header row, `rowspan` shifting cells
 * between rows, two events packed into one cell — and for pages like it the
 * honest answer has been "this needs a hand-written entry", which means waiting
 * for one person to read the markup.
 *
 * Chrome's on-device model can read markup. It cannot read 33KB of it: the
 * Prompt API's window is about 9,216 tokens *shared with the output*. So the
 * page has to arrive as a summary — the tags, ids, classes and table structure
 * a selector could name, and none of the styling, scripts or navigation that
 * make up most of the bytes.
 *
 * This is a pure function over a DOM and nothing here decides anything: the
 * model's answer is run through the real runner and shown to the student before
 * it is saved (`author.ts`). What this file owes its caller is that the part of
 * the page a schedule actually lives in survives the budget — a summary that
 * truncates away the schedule table asks the model to invent one.
 */

import { ParseError } from "../sources/types.js";
import {
  isHeaderRowOutsideTbody,
  rowSelectorForList,
  rowSelectorForTable,
  selectorForTable,
} from "./detect.js";

/** Tags that are all bytes and no structure. */
const DROPPED = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "LINK",
  "META",
  "SVG",
  "PATH",
  "IFRAME",
  "NAV",
  "FOOTER",
  "TEMPLATE",
  "HEAD",
]);

/** One cell, before it is a wall of text. */
const MAX_CELL = 120;
/** One row of a table, all cells together. */
const MAX_ROW = 320;
/** One line of the page outline. */
const MAX_OUTLINE = 110;

/**
 * The share of the budget the page's *structure* gets before anything else is
 * written — its tables, and the labelled lists that are the third page shape.
 *
 * A summary that spends its budget on the department's address and truncates
 * the schedule away is worse than no summary: the model then answers from the
 * navigation, plausibly, and the student is asked to confirm a guess about a
 * page neither of them looked at.
 *
 * Lists are peers of tables here rather than outline lines underneath them.
 * ECE 411 is the reason: its page has **no table at all**, and every deadline
 * on it is a `<li>` reading `Due: 9/7` under an `<h3>`. Rendered only through
 * the outline, those bullets are the first thing a tight budget drops, printed
 * with no handle a `rows` selector could name and no sign that the `<h3>` above
 * them is where `titleFrom` would point — which is a page the model cannot
 * answer about even when it reads it correctly.
 */
const STRUCTURE_SHARE = 0.75;

/** Below this there is no room for a header and a row, so asking is pointless. */
const MIN_BUDGET = 400;

function squash(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** `div#homework.panel`, which is what a selector would have to name. */
function describe(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.getAttribute("id");
  const classes = squash(element.getAttribute("class"))
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .map((name) => `.${name}`)
    .join("");
  return `${tag}${id ? `#${id}` : ""}${classes}`;
}

function droppedAncestor(element: Element): boolean {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (DROPPED.has(node.tagName)) return true;
  }
  return false;
}

/** `body > div.main > div#homework`, so the model can see what is nameable. */
function ancestry(element: Element): string {
  const path: string[] = [];
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (node.tagName === "HTML") break;
    path.unshift(describe(node));
    if (path.length >= 4) break;
  }
  return path.join(" > ");
}

/**
 * The inventory's own spelling for a block's rows, or nothing.
 *
 * The summary and the schema's `rows` enum have to be one list (mutation rule
 * 3), and the enum is the one that decides — so a block's `rows selector:` line
 * is printed only where the inventory can answer it. The exact spelling first;
 * failing that the first inventory entry that *covers* these rows, which is how
 * ECE 411's `#mp-setup ul.simple > li` prints as `#mp-information ul.simple >
 * li` — the wide selector that reads all five MPs rather than the narrow one
 * that silently reads a sixth of the course.
 *
 * `undefined` where the inventory's twelve-entry cap dropped the group: a line
 * the model cannot copy is worse than no line, because the prompt tells it to
 * copy one character for character.
 */
interface Inventory {
  doc: Document;
  structures: readonly RepeatedStructure[];
  /** The same selectors as a set, because membership is asked once per block. */
  answerable: ReadonlySet<string>;
}

function answerableSelector(
  exact: string,
  rows: readonly Element[],
  inv: Inventory,
): string | undefined {
  if (inv.answerable.has(exact)) return exact;
  if (rows.length === 0) return undefined;
  /*
   * The *narrowest* group that covers this block, not the first one found.
   *
   * A bare `li` covers every list on the page, so "first that covers" would
   * print the page's every bullet as this block's rows — a selector that is
   * answerable and wrong, which is worse than no line. Narrowest keeps the
   * meaning the line has always had: these rows, with `every list like it`
   * below it offering the wider spelling by name.
   */
  let best: RepeatedStructure | undefined;
  for (const structure of inv.structures) {
    if (structure.count < rows.length) continue;
    if (best) {
      const narrower =
        structure.count < best.count ||
        (structure.count === best.count && structure.selector.length < best.selector.length);
      if (!narrower) continue;
    }
    let matched: Set<Element>;
    try {
      matched = new Set(inv.doc.querySelectorAll(structure.selector));
    } catch {
      continue;
    }
    if (rows.every((row) => matched.has(row))) best = structure;
  }
  return best?.selector;
}

function cellsOf(row: Element): string[] {
  return [...row.querySelectorAll("th, td")].map((cell) => {
    const text = clip(squash(cell.textContent), MAX_CELL);
    const span = cell.getAttribute("colspan") ?? cell.getAttribute("rowspan");
    const link = cell.querySelector("a[href]") ? " [link]" : "";
    // rowspan is the reason CS 424 defeats the deterministic proposer, so it is
    // the one attribute worth spending characters on.
    return `${text}${link}${span && span !== "1" ? ` [span ${span}]` : ""}`;
  });
}

/**
 * One table, header row first, within `budget` characters.
 *
 * Rows are dropped from the end and counted, never silently: "8 of 40 rows
 * shown" tells the model it is looking at a sample, which is the difference
 * between a selector proposed for a schedule and one proposed for a fragment.
 */
function renderTable(table: Element, selector: string, budget: number, inv: Inventory): string {
  const rows = [...table.querySelectorAll("tr")];
  /*
   * `tbody tr` when there is a tbody, because the header row is not a deadline.
   *
   * `<th>Exercises</th>` read through a `columns.title` of "Exercises" yields a
   * row *titled* "Exercises" with the words "Due Date" where its date should
   * be — an undated assignment in the student's list that no course ever set.
   * Offering `table tr` here is offering the selector that does that.
   */
  const scope = table.querySelector("tbody") ? `${selector} tbody tr` : `${selector} tr`;
  const dataRows = [...table.querySelectorAll(table.querySelector("tbody") ? "tbody tr" : "tr")];
  const printable = answerableSelector(scope, dataRows, inv);
  const head = [
    `TABLE ${describe(table)}`,
    ...(printable ? [`  rows selector: ${printable}`] : []),
    `  inside: ${ancestry(table)}`,
  ];
  const lines: string[] = [...head];
  let used = head.join("\n").length;
  let shown = 0;

  for (const row of rows) {
    const kind = row.querySelector("td") ? "TD" : "TH";
    const line = `  ${kind} | ${clip(cellsOf(row).join(" | "), MAX_ROW)}`;
    if (used + line.length + 1 > budget) break;
    lines.push(line);
    used += line.length + 1;
    shown += 1;
  }
  if (shown < rows.length) lines.push(`  … ${shown} of ${rows.length} rows shown`);
  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/* The third page shape: `label: value` lines under a heading                   */
/* -------------------------------------------------------------------------- */

/**
 * A line that states a label and a value, which is what makes a list a
 * schedule rather than prose.
 *
 * `Due: 9/7`, `Release: TBD`, `Midterm 1: September 29`. Anchored and bounded
 * on the label rather than a search for a colon anywhere: a sentence with a
 * colon in the middle of it is a paragraph that happens to be in a list, and a
 * page of those is not a page `dueLabel` can read.
 */
const LABEL_LINE = /^[^:]{1,60}:\s*\S/;

/** The share of a list's lines that must be labelled before it is offered. */
const MIN_LABELLED_SHARE = 0.5;

/**
 * A value that could be one of `site.ts`'s three date formats.
 *
 * Deliberately the same test `detectCandidates` applies to a table's column —
 * a block is only worth a share of the budget if a deadline could be read out
 * of it. Without it, ECE 310's "Recommended Textbook: Applied Digital Signal
 * Processing: Theory and Practice" is a labelled list under a heading, takes a
 * share of the structure budget, and pushes the rows of the one table that
 * holds the homework deadlines out of the summary.
 *
 * A loose shape rather than `parseAdapterDate` itself, which needs a timezone
 * and a reference instant this function has no business asking its caller for.
 * Being generous here costs a block's share; being strict would cost a page.
 */
const DATE_SHAPED = new RegExp(
  String.raw`\b\d{1,2}/\d{1,2}\b|\b\d{4}-\d{1,2}-\d{1,2}\b|` +
    String.raw`\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b`,
  "i",
);

/** Headings a list can take its rows' names from — what `titleFrom` points at. */
const HEADINGS = "h1, h2, h3, h4";

function directItems(list: Element): Element[] {
  return [...list.children].filter((child) => child.tagName === "LI");
}

/**
 * The heading a `titleFrom` would name for this list, and the spec that reaches
 * it.
 *
 * Two spellings because `runAdapter` has two: `section >> h3` climbs to the
 * row's enclosing section, and a bare `h3` takes the nearest heading preceding
 * the row in document order. The scoped form is preferred where the page gives
 * it, because it is the one that cannot drift when a section is moved.
 */
function headingFor(list: Element): { element: Element; spec: string } | undefined {
  for (const scope of ["section", "article"]) {
    const container = list.closest(scope);
    const heading = container?.querySelector(HEADINGS);
    if (heading && !droppedAncestor(heading)) {
      return { element: heading, spec: `${scope} >> ${heading.tagName.toLowerCase()}` };
    }
  }
  for (let node = previousInDocumentOrder(list); node; node = previousInDocumentOrder(node)) {
    if (node.matches(HEADINGS) && !droppedAncestor(node)) {
      return { element: node, spec: node.tagName.toLowerCase() };
    }
  }
  return undefined;
}

/** The same backwards walk `site.ts` uses, for the same linkedom reason. */
function previousInDocumentOrder(node: Element): Element | undefined {
  const sibling = node.previousElementSibling;
  if (!sibling) return node.parentElement ?? undefined;
  let last = sibling;
  while (last.lastElementChild) last = last.lastElementChild;
  return last;
}

/**
 * Whether this list is one the `dueLabel` shape could be written against.
 *
 * Two `<li>`s at least, half of them labelled, and a heading to take a name
 * from. The heading is a requirement rather than a nicety: a row in a list has
 * no title of its own, so a list with nothing above it is a list whose rows
 * `runAdapter` could only title `"Due: 9/7"`.
 */
export function isLabelledList(list: Element): boolean {
  const items = directItems(list);
  if (items.length < 2) return false;
  const labelled = items
    .map((item) => squash(item.textContent))
    .filter((text) => LABEL_LINE.test(text));
  if (labelled.length / items.length < MIN_LABELLED_SHARE) return false;
  if (!labelled.some((text) => DATE_SHAPED.test(text.slice(text.indexOf(":") + 1)))) return false;
  return headingFor(list) !== undefined;
}

/**
 * The selector that would read *every* list of this shape, not just this one.
 *
 * ECE 411's MPs are one `<section>` each, so the handle nearest a given list is
 * `#mp-setup` and the selector built from it reads one MP. The shipped entry
 * uses `#mp-information ul.simple > li`, which reads all of them — and a model
 * shown only the narrow selector proposes an adapter that silently covers a
 * sixth of the course. Printed alongside, with the count, so the choice is
 * visible rather than inferred.
 */
export function wideListSelector(list: Element, doc: Document): string | undefined {
  const self = tagOf(list);
  for (let node = list.parentElement; node; node = node.parentElement) {
    const id = node.getAttribute("id");
    if (!id || !SAFE_TOKEN.test(id)) continue;
    const within = [...node.querySelectorAll(self)];
    if (within.length > 1) return `#${id} ${self} > li`;
  }
  return doc.querySelectorAll(self).length > 1 ? `${self} > li` : undefined;
}

/**
 * The same selector with its list count, for the summary's own line.
 *
 * One spelling of the selector, two readers (mutation house rule 3): the
 * inventory below offers it to the model as a `rows` answer, and `renderList`
 * prints it with the count so the choice between the narrow and the wide form
 * is visible. When these were two functions the inventory could have offered
 * `#mp-information ul.simple > li (6 lists)`, which matches nothing.
 */
function siblingListSelector(list: Element, doc: Document): string | undefined {
  const wide = wideListSelector(list, doc);
  if (!wide) return undefined;
  const lists = doc.querySelectorAll(wide.slice(0, -" > li".length)).length;
  return `${wide} (${lists} lists)`;
}

/** An id or class this code may safely put back into a selector. */
const SAFE_TOKEN = /^[A-Za-z][\w-]*$/;

/** `ul.simple` — the tag and its first class, as `selectorForList` spells it. */
function tagOf(list: Element): string {
  const first = (list.getAttribute("class") ?? "").trim().split(/\s+/)[0];
  const tag = list.tagName.toLowerCase();
  return first && SAFE_TOKEN.test(first) ? `${tag}.${first}` : tag;
}

/**
 * One labelled list, heading first, within `budget` characters.
 *
 * The `rows` selector and the `titleFrom` spec are printed rather than left for
 * the model to derive, exactly as `renderTable` prints its own `rows` selector:
 * the two fields a list-shaped entry needs beyond a table's are the two a model
 * has no way to guess from a flat outline.
 */
function renderList(list: Element, doc: Document, budget: number, inv: Inventory): string {
  const items = directItems(list);
  const heading = headingFor(list);
  const printable = answerableSelector(rowSelectorForList(list, doc), items, inv);
  const wide = wideListSelector(list, doc);
  // Only when it is a *second*, wider answer: where the narrow spelling was cut
  // from the inventory, `printable` is already the wide one and printing it
  // twice says a page has two groups where it has one.
  const siblings =
    wide && wide !== printable && inv.answerable.has(wide)
      ? siblingListSelector(list, doc)
      : undefined;
  const head = [
    `LIST ${describe(list)}`,
    ...(printable ? [`  rows selector: ${printable}`] : []),
    ...(siblings ? [`  every list like it: ${siblings}`] : []),
    ...(heading
      ? [
          `  heading: ${describe(heading.element)} ${clip(squash(heading.element.textContent), MAX_CELL)}`,
          `  titleFrom: ${heading.spec}`,
        ]
      : []),
    `  inside: ${ancestry(list)}`,
  ];
  const lines: string[] = [...head];
  let used = head.join("\n").length;
  let shown = 0;

  for (const item of items) {
    const link = item.querySelector("a[href]") ? " [link]" : "";
    const line = `  LI | ${clip(squash(item.textContent), MAX_ROW)}${link}`;
    if (used + line.length + 1 > budget) break;
    lines.push(line);
    used += line.length + 1;
    shown += 1;
  }
  if (shown < items.length) lines.push(`  … ${shown} of ${items.length} lines shown`);
  return lines.join("\n");
}

/** What the outline looks at: things a selector could name, and text beside them. */
const OUTLINE_SELECTOR = "h1, h2, h3, h4, [id], li, p";

/**
 * Headings and identified containers, as context for the tables.
 *
 * Deliberately not the page's prose. Two rules keep it from becoming the page
 * again: a container that holds other outline elements is named and left silent
 * — `div#homework` is a handle a selector can use, and printing its
 * `textContent` reprints the whole schedule table a second time — and prose is
 * clipped hard, because the honour-code paragraph is not something a selector
 * gets written against. Without both, ECE 310's summary came to 18KB of a 33KB
 * page, which is not a summary.
 */
function renderOutline(doc: Document, budget: number, drawn: Element[]): string {
  const lines: string[] = [];
  let used = 0;
  for (const element of doc.querySelectorAll(OUTLINE_SELECTOR)) {
    if (DROPPED.has(element.tagName) || droppedAncestor(element)) continue;
    if (element.closest("table")) continue; // the tables are rendered in full above
    // And a list that was rendered in full above is not reprinted as a run of
    // loose `li:` lines underneath it — the same rule, and the same reason: a
    // second copy of the schedule is a second thing for the model to quote a
    // date out of, in a prompt whose whole rule is "selectors, never values".
    if (drawn.some((list) => list !== element && list.contains(element))) continue;
    const encloses = element.querySelector(OUTLINE_SELECTOR) !== null;
    const text = encloses ? "" : squash(element.textContent);
    if (!encloses && !text) continue;
    const line = text ? clip(`${describe(element)}: ${text}`, MAX_OUTLINE) : describe(element);
    if (used + line.length + 1 > budget) {
      lines.push("  … page outline truncated");
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join("\n");
}

/**
 * A compact rendering of `doc`, at most `budgetChars` long.
 *
 * Throws rather than returning "" for a document with no element in it: house
 * rule 2 one level out — an empty summary reads to the caller as "this page has
 * no structure", and the model would answer about a page it was never shown.
 */
export function skeletonise(
  doc: Document,
  budgetChars: number,
  /**
   * The inventory the caller will also put in the prompt and in the schema's
   * `rows` enum, so the summary prints no selector the model is forbidden to
   * answer with.
   *
   * These were two lists built by different code: `renderTable` and
   * `renderList` printed a `rows selector:` for every block they drew, while
   * `proposalSchema` closes `rows` over `repeatedStructures`' top twelve. On
   * ECE 310 six of the eight printed selectors — including the exams table and
   * the schedule table — were absent from the enum, so the model was shown a
   * selector directly above the deadlines, told to copy one "character for
   * character", and then forbidden from emitting it. Two spellings of one
   * decision (mutation rule 3); the enum is the one that decides.
   *
   * Defaulted rather than required so a caller that only wants a summary still
   * gets a truthful one — it is the same list, computed here.
   */
  structures: RepeatedStructure[] = repeatedStructures(doc),
): string {
  if (!Number.isFinite(budgetChars) || budgetChars < MIN_BUDGET) {
    throw new Error(`skeletonise: budget ${budgetChars} is below the ${MIN_BUDGET} minimum`);
  }
  // Not `doc.body`: a fragment parsed out of a partial capture has none, and
  // the whole document is what has to be searched either way.
  if (doc.querySelectorAll("*").length === 0) {
    throw new ParseError("skeletonise: the document has no elements");
  }

  const header = `PAGE TITLE: ${clip(squash(doc.title), MAX_CELL)}`;
  /*
   * Tables and labelled lists, in document order and sharing one budget.
   *
   * Two separate passes would have to decide which goes first, and either
   * answer is wrong on some page: a course with a table of homework and a list
   * of exams has its deadlines in both. One list of blocks with an equal share
   * each is the same rule the tables already had, one shape wider.
   */
  const blocks = [...doc.querySelectorAll("table, ul, ol")].filter(
    (element) =>
      !droppedAncestor(element) &&
      (element.tagName === "TABLE" ? true : isLabelledList(element)) &&
      // A list inside a table is that table's cell content, already rendered.
      !(element.tagName !== "TABLE" && element.closest("table")),
  );

  const inv: Inventory = {
    doc,
    structures,
    answerable: new Set(structures.map((structure) => structure.selector)),
  };
  const sections: string[] = [header];
  const drawnLists: Element[] = [];
  let remaining = budgetChars - header.length - 1;

  if (blocks.length > 0) {
    let structureBudget = Math.floor(budgetChars * STRUCTURE_SHARE);
    let drawn = 0;
    for (const [index, block] of blocks.entries()) {
      // Whatever an earlier block did not need flows to the next one, so a page
      // with one summary box and one schedule spends the budget on the schedule.
      const share = Math.floor(structureBudget / (blocks.length - index));
      if (share < 80) break;
      const text =
        block.tagName === "TABLE"
          ? renderTable(block, selectorForTable(block, doc), share, inv)
          : renderList(block, doc, share, inv);
      if (text.length + 1 > remaining) break;
      sections.push(text);
      if (block.tagName !== "TABLE") drawnLists.push(block);
      remaining -= text.length + 1;
      structureBudget -= text.length + 1;
      drawn += 1;
    }
    if (drawn < blocks.length) {
      const note = `… ${drawn} of ${blocks.length} tables and lists shown`;
      if (note.length + 1 <= remaining) {
        sections.push(note);
        remaining -= note.length + 1;
      }
    }
  }

  const OUTLINE_HEADING = "PAGE OUTLINE:";
  if (remaining > OUTLINE_HEADING.length + 60) {
    const outline = renderOutline(doc, remaining - OUTLINE_HEADING.length - 2, drawnLists);
    if (outline) sections.push(`${OUTLINE_HEADING}\n${outline}`);
  }

  // The accounting above keeps each section inside what was left, and this is
  // the guarantee rather than the estimate: the caller's budget is a hard limit
  // on the model's context, and a summary one character over it is a
  // QuotaExceededError instead of an answer.
  const text = sections.join("\n");
  return text.length <= budgetChars ? text : text.slice(0, budgetChars);
}

/* -------------------------------------------------------------------------- */
/* The inventory: the groups this page actually repeats                        */
/* -------------------------------------------------------------------------- */

/**
 * One repeated group of elements, and a selector that reaches it.
 *
 * Live evidence, 2026-09-18: asked about ECE 411's Sphinx page, Chrome's
 * built-in model answered `#schedule .event` three times running. Nothing on
 * that page is called `#schedule` or `.event` — it is the selector printed in
 * this file's sibling prompt as the *example* of the "rows" shape, for a
 * different course. The model was being shown a summary of one page and an
 * example from another, and it could not tell which it was allowed to quote.
 * Three ten-second round trips were spent on answers a `querySelectorAll` would
 * have refused in a millisecond.
 *
 * So the page is asked what it has, and the answer goes in the prompt. Every
 * `selector` here has been run against `doc` and matched `count` elements —
 * that is the invariant this type exists for, and `author.ts` may put the list
 * straight into the response schema's `enum` because of it: a constrained
 * decode cannot invent a group the page does not have.
 */
export interface RepeatedStructure {
  /** A CSS selector that matched, on this document, exactly `count` elements. */
  selector: string;
  count: number;
  /** The first match's text, clipped — so the model can tell a schedule from a nav. */
  sample: string;
  /**
   * Whether most of the group reads like a schedule row, which is what decides
   * the twelve.
   *
   * A page has dozens of repeated groups and the cap has to drop most of them.
   * Dropping by selector length alone was measured and it is wrong in both
   * directions: on ECE 411 it kept `#mp-setup li` and `#mp-cache li` — one MP
   * each — and cut the one group covering the whole course, and on ECE 310 it
   * cut `#homework table tbody tr`, which is the answer, in favour of `#staff
   * td`. The test is the one `isLabelledList` and `detectCandidates` already
   * apply: does the member state a date, or a `Label: value`?
   */
  rowLike: boolean;
  /**
   * What one row is made of, as tags and classes: `strong, p, text`.
   *
   * The inventory used to say *which* groups the page has and nothing about
   * what is inside one. `title` and `due` are selectors **relative to one row**,
   * so a model naming them off `sample` — a row's flattened text — is guessing
   * at markup it has never been shown, and on 2026-09-18 it did not name them
   * at all. With the sketch beside the selector, `"title": "strong"` is a choice
   * from something printed rather than an invention, and a rejection about a
   * row-relative field can quote the same line back (`retrySuffix`).
   *
   * A row that is only text sketches as `text`, which is itself the answer: it
   * says `""` — the row's own text — is the right `title`. The empty string is
   * left only for a row with neither text nor a nameable child, which no
   * capture has produced (such a row has no `sample` either and is dropped
   * before this runs); `rowSketchNote` still guards it rather than printing a
   * sentence with nothing after the colon.
   */
  sketch: string;
}

/** A row sketch names this many parts at most; a row is not an outline. */
const MAX_SKETCH_PARTS = 6;
/** And this many characters, because it is in the prompt and in every retry. */
export const MAX_SKETCH_CHARS = 64;

/**
 * One row's inside, as one line.
 *
 * Deduplicated: three `<p>`s are one answer to "what is in here", and `p, p, p`
 * spends the budget saying it three times. `text` is listed last and only when
 * the row states something of its own — which is what makes `""` (the row's own
 * text) a visible option for `title` on a `Due: 9/7` bullet.
 */
export function rowSketch(row: Element): string {
  const parts: string[] = [];
  for (const child of row.children) {
    if (DROPPED.has(child.tagName)) continue;
    const name = tagOf(child);
    if (!parts.includes(name)) parts.push(name);
    if (parts.length >= MAX_SKETCH_PARTS) break;
  }
  const ownText = [...row.childNodes].some(
    (node) => node.nodeType === 3 && squash(node.textContent) !== "",
  );
  if (ownText) parts.push("text");
  return clip(parts.join(", "), MAX_SKETCH_CHARS);
}

/** Shown to the model, and enumerated in the schema. Both want a short list. */
const MAX_STRUCTURES = 12;
/** One element is not a repeated structure. */
const MIN_REPEAT = 2;
const MAX_STRUCTURE_SAMPLE = 80;
/** The share of a group's members that must read like a row. */
const MIN_ROW_LIKE_SHARE = 0.5;

/**
 * A selector for the element a repeated group hangs off.
 *
 * An `id` is what a page author meant as a handle, the same reason
 * `selectorForTable` prefers one. Failing that the group is named at document
 * level — which is still a selector that *matches*, which is this function's
 * whole contract.
 */
function anchorSelector(parent: Element): string | undefined {
  const own = parent.getAttribute("id");
  if (own && SAFE_TOKEN.test(own)) return `#${own}`;
  for (let node = parent.parentElement; node; node = node.parentElement) {
    const id = node.getAttribute("id");
    if (id && SAFE_TOKEN.test(id)) return `#${id}`;
  }
  return undefined;
}

/**
 * The repeated element groups on `doc` worth proposing as an adapter's `rows`.
 *
 * Pure, and deliberately generous about *what* repeats: a course page's
 * deadlines are a table's rows, a list's bullets, or a run of sibling blocks,
 * and which of the three it is, is the thing the model is being asked. What it
 * is not generous about is whether the selector works — every entry is checked
 * against the document before it is emitted, and a group whose every member
 * sits inside `<nav>` or `<footer>` is dropped rather than offered as a
 * schedule.
 *
 * Deduplicated **by the elements matched, not by the selector string**: three
 * spellings of the same seventeen `<li>`s are one answer, and the shortest is
 * the one a model copies correctly.
 */
export function repeatedStructures(doc: Document): RepeatedStructure[] {
  const order = new Map<Element, number>();
  for (const [i, element] of [...doc.querySelectorAll("*")].entries()) order.set(element, i);

  const best = new Map<string, RepeatedStructure>();
  /*
   * One evaluation per distinct selector string, which is what makes this
   * linear enough to run on the options page's main thread.
   *
   * The general-case loop below asks about `#homework tr` once per `<tbody>`
   * and `#schedule div.assignment` once per block: measured on the real ECE 310
   * capture repeated 16× (518KB, 11,858 elements) it issued **2,177 `consider`
   * calls for 15 distinct selector strings**, each one a fresh
   * `querySelectorAll` plus `droppedAncestor` and `textContent` over every
   * match. That is the O(elements²) the page was paying: 7.6s at 518KB and 50s
   * at 1.28MB, synchronous, with every other control frozen behind "Asking the
   * on-device model…" and no cancel — while `MAX_AUTHOR_HTML` admits 2MB.
   *
   * The answer is unchanged by construction: a repeated call on the same string
   * matches the same elements and `best` already keeps the shortest spelling
   * per matched set, so the second evaluation could only ever re-decide the
   * same key the same way.
   */
  const evaluated = new Set<string>();
  const consider = (selector: string): void => {
    if (evaluated.has(selector)) return;
    evaluated.add(selector);
    let matched: Element[];
    try {
      matched = [...doc.querySelectorAll(selector)];
    } catch {
      // A selector this file built that the DOM will not parse is a bug here,
      // not a proposal — and offering it would break the invariant above.
      return;
    }
    if (matched.length < MIN_REPEAT) return;
    /*
     * The header-including spelling of a table is never the answer.
     *
     * `#homework tr` is exactly `#homework table tbody tr` plus the `<thead>`
     * row, and it is the selector `detect.ts` documents as a defect: read
     * through a `columns.title` of "Exercises" it yields a row *titled*
     * Exercises with the words "Due Date" where its date should be. The sort
     * below is rowLike → count → length, so being one element larger put it
     * above the right answer on every table on every page — and the rejection
     * it earned named the row, not the header, so a retry had nothing to act
     * on. `rowSelectorForTable` has already offered the `tbody` spelling.
     */
    if (matched.some(isHeaderRowOutsideTbody)) return;
    if (matched.some((element) => DROPPED.has(element.tagName) || droppedAncestor(element))) return;
    const texts = matched.map((element) => squash(element.textContent));
    const sample = clip(texts[0]!, MAX_STRUCTURE_SAMPLE);
    if (!sample) return;
    const key = matched.map((element) => order.get(element)).join(",");
    const seen = best.get(key);
    if (seen && seen.selector.length <= selector.length) return;
    const rows = texts.filter((text) => DATE_SHAPED.test(text) || LABEL_LINE.test(text)).length;
    best.set(key, {
      selector,
      count: matched.length,
      sample,
      rowLike: rows / matched.length >= MIN_ROW_LIKE_SHARE,
      sketch: rowSketch(matched[0]!),
    });
  };

  // The two shapes that already have a spelling, taken from the code that
  // spells them, so the inventory offers the same selector the summary prints
  // and the shipped registry entries use.
  for (const table of doc.querySelectorAll("table")) {
    if (droppedAncestor(table)) continue;
    consider(rowSelectorForTable(table, doc));
  }
  for (const list of doc.querySelectorAll("ul, ol")) {
    if (droppedAncestor(list) || directItems(list).length < MIN_REPEAT) continue;
    consider(rowSelectorForList(list, doc));
    const wide = wideListSelector(list, doc);
    if (wide) consider(wide);
  }

  // And the general case: any element with two children of the same shape.
  // This is what reaches a page whose deadlines are `div.assignment` blocks,
  // which neither of the two above can see.
  for (const parent of doc.querySelectorAll("*")) {
    if (DROPPED.has(parent.tagName) || droppedAncestor(parent)) continue;
    const counts = new Map<string, number>();
    for (const child of parent.children) {
      if (DROPPED.has(child.tagName)) continue;
      const name = tagOf(child);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const anchor = anchorSelector(parent);
    for (const [name, n] of counts) {
      if (n < MIN_REPEAT) continue;
      // `#id > name` when the group's own parent is the handle; otherwise the
      // nearest identified ancestor, as a descendant — a wider match than the
      // group, but `consider` reports the count it really has.
      consider(anchor ? `${anchor} ${parent.getAttribute("id") ? "> " : ""}${name}` : name);
    }
  }

  /*
   * Row-like groups first, then the *biggest*, and only then the shortest.
   *
   * Count before length was measured too. Ordering row-like groups by selector
   * length put `#assignments ul.simple > li` (20 bullets, the MPs plus the late
   * policy) in the last slot and cut `#mp-information ul.simple > li` (15, the
   * MPs) by one place — offering the model a wrong group and withholding the
   * right one, which is a worse failure than the invented selector this list
   * was written to prevent. A schedule has more rows than a summary box.
   */
  return [...best.values()]
    .sort(
      (a, b) =>
        Number(b.rowLike) - Number(a.rowLike) ||
        b.count - a.count ||
        a.selector.length - b.selector.length,
    )
    .slice(0, MAX_STRUCTURES);
}

/**
 * The inventory as the model is shown it.
 *
 * Here rather than in `author.ts` because the count and the sample come from
 * this file's budgeting vocabulary, and because `author.ts` quotes a rejected
 * selector against this same list — one rendering, two callers.
 */
export function renderStructures(structures: RepeatedStructure[]): string {
  if (structures.length === 0) return "";
  return [
    "REPEATED STRUCTURES ON THIS PAGE — the rows selector must be one of these:",
    ...structures.map(
      (s) =>
        `  ${s.selector}  ×${s.count}` +
        `  inside one row: ${s.sketch}` +
        `  e.g. ${JSON.stringify(s.sample)}`,
    ),
  ].join("\n");
}

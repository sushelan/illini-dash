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
import { rowSelectorForList, selectorForTable } from "./detect.js";

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
function renderTable(table: Element, selector: string, budget: number): string {
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
  const head = [
    `TABLE ${describe(table)}`,
    `  rows selector: ${scope}`,
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
function siblingListSelector(list: Element, doc: Document): string | undefined {
  const self = tagOf(list);
  for (let node = list.parentElement; node; node = node.parentElement) {
    const id = node.getAttribute("id");
    if (!id || !/^[A-Za-z][\w-]*$/.test(id)) continue;
    const within = [...node.querySelectorAll(self)];
    if (within.length > 1) return `#${id} ${self} > li (${within.length} lists)`;
  }
  return doc.querySelectorAll(self).length > 1 ? `${self} > li` : undefined;
}

/** `ul.simple` — the tag and its first class, as `selectorForList` spells it. */
function tagOf(list: Element): string {
  const first = (list.getAttribute("class") ?? "").trim().split(/\s+/)[0];
  const tag = list.tagName.toLowerCase();
  return first && /^[A-Za-z][\w-]*$/.test(first) ? `${tag}.${first}` : tag;
}

/**
 * One labelled list, heading first, within `budget` characters.
 *
 * The `rows` selector and the `titleFrom` spec are printed rather than left for
 * the model to derive, exactly as `renderTable` prints its own `rows` selector:
 * the two fields a list-shaped entry needs beyond a table's are the two a model
 * has no way to guess from a flat outline.
 */
function renderList(list: Element, doc: Document, budget: number): string {
  const items = directItems(list);
  const heading = headingFor(list);
  const siblings = siblingListSelector(list, doc);
  const head = [
    `LIST ${describe(list)}`,
    `  rows selector: ${rowSelectorForList(list, doc)}`,
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
export function skeletonise(doc: Document, budgetChars: number): string {
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
          ? renderTable(block, selectorForTable(block, doc), share)
          : renderList(block, doc, share);
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

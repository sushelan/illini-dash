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
import { selectorForTable } from "./detect.js";

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
 * The share of the budget tables get before anything else is written.
 *
 * A course schedule is a table far more often than it is anything else, and a
 * summary that spends its budget on the department's address and truncates the
 * schedule away is worse than no summary: the model then answers from the
 * navigation, plausibly, and the student is asked to confirm a guess about a
 * page neither of them looked at.
 */
const TABLE_SHARE = 0.75;

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
function renderOutline(doc: Document, budget: number): string {
  const lines: string[] = [];
  let used = 0;
  for (const element of doc.querySelectorAll(OUTLINE_SELECTOR)) {
    if (DROPPED.has(element.tagName) || droppedAncestor(element)) continue;
    if (element.closest("table")) continue; // the tables are rendered in full above
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
  const tables = [...doc.querySelectorAll("table")].filter((table) => !droppedAncestor(table));

  const sections: string[] = [header];
  let remaining = budgetChars - header.length - 1;

  if (tables.length > 0) {
    let tableBudget = Math.floor(budgetChars * TABLE_SHARE);
    let drawn = 0;
    for (const [index, table] of tables.entries()) {
      // Whatever an earlier table did not need flows to the next one, so a page
      // with one summary box and one schedule spends the budget on the schedule.
      const share = Math.floor(tableBudget / (tables.length - index));
      if (share < 80) break;
      const text = renderTable(table, selectorForTable(table, doc), share);
      if (text.length + 1 > remaining) break;
      sections.push(text);
      remaining -= text.length + 1;
      tableBudget -= text.length + 1;
      drawn += 1;
    }
    if (drawn < tables.length) {
      const note = `… ${drawn} of ${tables.length} tables shown`;
      if (note.length + 1 <= remaining) {
        sections.push(note);
        remaining -= note.length + 1;
      }
    }
  }

  const OUTLINE_HEADING = "PAGE OUTLINE:";
  if (remaining > OUTLINE_HEADING.length + 60) {
    const outline = renderOutline(doc, remaining - OUTLINE_HEADING.length - 2);
    if (outline) sections.push(`${OUTLINE_HEADING}\n${outline}`);
  }

  // The accounting above keeps each section inside what was left, and this is
  // the guarantee rather than the estimate: the caller's budget is a hard limit
  // on the model's context, and a summary one character over it is a
  // QuotaExceededError instead of an answer.
  const text = sections.join("\n");
  return text.length <= budgetChars ? text : text.slice(0, budgetChars);
}

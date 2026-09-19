/**
 * Asking a model for an adapter, and refusing to believe it (§4.5 self-serve).
 *
 * `detect.ts` says plainly why it is not a model: finding the date column is a
 * search with a hard test for every candidate, and a search with a checkable
 * answer does not need one. Nothing here contradicts that. The model is the
 * *second* answer, reached only when the search returns nothing, and it is held
 * to exactly the same test the search held itself to — the proposal is run
 * through `validateAdapter` and the real `runAdapter`, on the real page, and
 * what the student is shown is the rows that came out. A model that invents a
 * selector produces zero rows and never reaches anybody.
 *
 * Three rules this file exists to keep:
 *
 * 1. **It never runs in the sync loop.** This is reached from one click in
 *    Settings, on a page the student pasted, and its output is a registry entry
 *    a human pressed "Use this one" on. Nothing here is on the path a deadline
 *    travels.
 * 2. **Its absence is today's behaviour.** Most student laptops will report the
 *    model unavailable (22GB of disk and a 4GB GPU), so this is strictly an
 *    extra branch after the existing "nothing found" message, never a
 *    replacement for it.
 * 3. **The model is asked for selectors, never for dates.** A date it read off
 *    the page would be a value this code invented one process over (worker rule
 *    3), ranked above a real Canvas deadline by §5.3 and impossible to audit. It
 *    names columns; `parseAdapterDate` reads them, the same code as everywhere.
 *
 * Model-agnostic on purpose: the caller passes a `prompt` function, so the
 * tests run the whole loop — prompt, bad answer, reason fed back, good answer —
 * against recorded strings with no model anywhere near them.
 */

import { runAdapter, supportedDateFormats } from "../sources/site.js";
import { staleWorkerNotice } from "./compat.js";
import { ParseError, type Adapter, type Kind, type PageCtx } from "../sources/types.js";
import { isHeaderRowOutsideTbody, rowSelectorForTable } from "./detect.js";
import type { Candidate, DetectedRow } from "./detect.js";
import { validateAdapter } from "./registry.js";
import { renderStructures, repeatedStructures, type RepeatedStructure } from "./skeleton.js";

/**
 * The fields the model may name, in one place.
 *
 * The JSON Schema below and the unknown-key check are both built from this, so
 * the answer the model is constrained to and the answer this file accepts
 * cannot drift apart — two copies of one decision is one copy too many
 * (mutation house rule 3).
 *
 * This was `rows` + `columns` + `dateFormat` only, which is the header-table
 * shape and nothing else — while `runAdapter` had already grown `dueLabel`,
 * `titleFrom` and `time` for ECE 411's Sphinx page, whose deadlines are `<li>`s
 * reading `Due: 9/7` under an `<h3>` and which has no table on it at all. So the
 * one page that produced "No table on this page" in front of Sushi was also the
 * one page the model was structurally unable to answer about: it could only
 * propose a table, on a page with none. The three shapes below are the three
 * `runAdapter` can read.
 *
 * `splitTitle` stays out: it is a literal that cuts a cell in half, and the one
 * page that needs it (CS 424's `HW5 Due; HW6 Out`) needs a human to decide which
 * half is the deadline. `filter.include` stays out for a different reason — an
 * include that matches nothing empties the page and reads exactly like a term
 * that has not started.
 */
const PROPOSAL_FIELDS = [
  "shape",
  "rows",
  "title",
  "due",
  "dueLabel",
  "link",
  "titleFrom",
  "time",
  "kind",
  "filter",
  "dateFormat",
] as const;
const FILTER_FIELDS = ["exclude"] as const;

/**
 * Every field whose value is a string, which is every field but `filter`.
 *
 * Read in one loop so that one rule — **`""` is how the model says "this shape
 * has no use for this field"** — is written once. That rule is what lets the
 * schema require a key the shape does not use, which is the whole fix: the
 * schema now demands everything `validateProposal` can demand, so a constrained
 * decode cannot produce an answer that is refused for a *missing* key.
 */
const STRING_FIELDS = [
  "rows",
  "title",
  "due",
  "dueLabel",
  "link",
  "titleFrom",
  "time",
  "kind",
  "dateFormat",
] as const;

/**
 * The fields the schema demands of every shape, whatever the shape uses them for.
 *
 * Live, 2026-09-18, ECE 411: *"Chrome's built-in model tried 3 attempts and its
 * last proposal read no deadlines: shape \"rows\" needs title"* — three times,
 * every one the `rows` shape with no `title`. The schema required
 * `["shape", "rows", "dateFormat"]` and *which* fields each shape needs was
 * decided here, in `validateProposal`, where the model never saw it. A
 * constrained decode emits exactly the keys the schema requires and nothing it
 * does not, so the retry was feeding back a sentence about a key the decoder
 * was not allowed to write. Asking more nicely cannot change what a grammar
 * permits.
 *
 * Chrome's `responseConstraint` takes flat JSON Schema — `type`, `enum`,
 * `properties`, `required`, `items` — and `oneOf` branches would make a small
 * model answer worse even where they are honoured. So the requirement is flat
 * and the *meaning* is per shape, stated in the prompt and in each field's
 * `description`:
 *
 * | field      | shape "table"          | shapes "list" and "rows"                  |
 * | ---------- | ---------------------- | ----------------------------------------- |
 * | `title`    | the column's header    | a selector inside one row, or `""` for the row's own text |
 * | `due`      | the column's header    | likewise                                  |
 * | `dueLabel` | `""`                   | `"Due|CP1 Due"` for a list; `""` for rows |
 *
 * The invariant `tests/author.test.ts` pins: the minimal object this schema
 * permits, for every shape, is never rejected for a key that is *absent* — only
 * ever for a value that is wrong. A rejection a retry can act on is one about a
 * value it chose.
 */
const REQUIRED_OF_EVERY_SHAPE = ["shape", "rows", "title", "due", "dueLabel", "dateFormat"] as const;

/** The three shapes `runAdapter` can read, named so the model can say which. */
export const SHAPES = ["table", "list", "rows"] as const;
export type Shape = (typeof SHAPES)[number];

/**
 * What the rows on this page are, as the registry spells it.
 *
 * Kept here as a list only so the schema can offer it; the *validation* is
 * `validateAdapter`'s `ADAPTER_KINDS`, which this proposal passes through like
 * any other registry entry. A value that gets past this list and not past that
 * one is a rejection with a reason, not an item labelled with a `kind` no
 * `switch` in the UI has a branch for.
 */
const PROPOSAL_KINDS: readonly Kind[] = ["assignment", "exam", "quiz", "event", "other"];

/** A selector is a selector, not a document. Remote-ish data gets a length cap. */
const MAX_SELECTOR = 200;
const MAX_HEADER = 120;

/**
 * A selector that picks a cell by its position, which the model may not use.
 *
 * House rule 3, stated as a rejection rather than only as a sentence in the
 * prompt: `cells[2]` turns one added column into a page of undated, mis-statused
 * items with no error, and a rule that is only asked for politely is a rule a
 * small model breaks on the page where it matters. `rows` is exempt — the
 * summary itself offers `table:nth-of-type(2)` as a table's handle, and picking
 * the second table on a page is not picking the second cell of a row.
 */
const POSITIONAL =
  /:nth-child|:nth-of-type|:nth-last-child|:nth-last-of-type|:first-child|:last-child|:first-of-type|:last-of-type|:only-child/i;

/** The fields whose value is a selector the model chose. */
const MODEL_SELECTORS = ["title", "due", "titleFrom", "time"] as const;

export interface Proposal {
  shape: Shape;
  rows: string;
  /** A header's text for shape "table"; a row-relative selector for the others. */
  title: string;
  due: string;
  /** Only shape "list" uses it; `""` everywhere else. */
  dueLabel: string;
  /** Only shape "table" uses it: the header of a column whose cells link out. */
  link?: string;
  titleFrom?: string;
  time?: string;
  kind?: Kind;
  filter?: { exclude?: string };
  dateFormat: string;
}

/**
 * The JSON Schema handed to `prompt(..., { responseConstraint })`.
 *
 * `dateFormat` is an enum of what `site.ts` actually supports rather than a
 * free string: the closed set is the reason a bad adapter can produce a wrong
 * selector but never arbitrary matching behaviour, and there is no sense
 * letting the one untrusted author in the project be the exception.
 */
export function proposalSchema(
  supportedFormats: string[] = supportedDateFormats(),
  structures: RepeatedStructure[] = [],
): object {
  /*
   * `rows` is an enum of the page's own repeated groups; nothing else is.
   *
   * Every selector in the inventory was run against this document and matched,
   * so the set of right answers for `rows` is closed, small, and known before
   * the model is asked — which is exactly the shape `responseConstraint` is
   * for. A constrained decode cannot then emit `#schedule .event`, and the
   * cheapest fix for an invented selector is to make it unspellable rather than
   * to catch it afterwards.
   *
   * The per-row selectors are not enumerable the same way and must not be
   * faked. `title` and `due` are relative to *one row* and their right answer is
   * any of the tag, class and `tag@attribute` combinations inside it; an enum
   * built by guessing would exclude correct answers, which is a worse failure
   * than a wrong one — a rejection costs an attempt, a missing option costs the
   * page. They are grounded against the DOM in `validateProposal` instead,
   * before the runner is called.
   */
  const rowsSelectors = structures.map((structure) => structure.selector);
  return {
    type: "object",
    additionalProperties: false,
    // Everything `validateProposal` can demand, for every shape — see
    // `REQUIRED_OF_EVERY_SHAPE`. `""` is the answer where a shape has no use
    // for a field, so a key is never missing and a rejection is always about a
    // value the model chose.
    required: [...REQUIRED_OF_EVERY_SHAPE],
    properties: {
      shape: {
        type: "string",
        enum: [...SHAPES],
        description:
          "'table' for a table with a header row, 'list' for 'Label: value' bullets under a " +
          "heading, 'rows' for repeated blocks with no header row",
      },
      rows: {
        type: "string",
        ...(rowsSelectors.length > 0
          ? { enum: rowsSelectors }
          : { maxLength: MAX_SELECTOR }),
        description:
          "CSS selector matching every data row, copied exactly from the REPEATED STRUCTURES " +
          "list in the page summary",
      },
      title: {
        type: "string",
        maxLength: MAX_SELECTOR,
        description:
          "shape 'table': the exact header text of the column holding the assignment name. " +
          "shapes 'list' and 'rows': a CSS selector, relative to one row, for the text holding " +
          "its name, e.g. 'strong' — or \"\" when the row's own text is the name",
      },
      due: {
        type: "string",
        maxLength: MAX_SELECTOR,
        description:
          "shape 'table': the exact header text of the column holding the deadline. " +
          "shapes 'list' and 'rows': a CSS selector, relative to one row, for the text holding " +
          "its deadline, e.g. 'p' or 'time@datetime' — or \"\" when the row's own text is it",
      },
      dueLabel: {
        type: "string",
        maxLength: MAX_SELECTOR,
        description:
          "shape 'list': the '|'-separated labels that start a deadline line, copied exactly " +
          "from the page, e.g. 'Due|CP1 Due|CP2 Due'. \"\" for the other two shapes",
      },
      link: {
        type: "string",
        maxLength: MAX_HEADER,
        description:
          "shape 'table' only, optional: the header of a column whose cells link to the " +
          "assignment. \"\" when there is none",
      },
      titleFrom: {
        type: "string",
        maxLength: MAX_SELECTOR,
        description:
          "shape 'list': where a row with no name of its own gets one — the 'titleFrom' " +
          "printed above the list in the summary, e.g. 'section >> h3'",
      },
      time: {
        type: "string",
        maxLength: MAX_SELECTOR,
        description:
          "Optional: a selector whose text states the clock when the deadline line does not, " +
          "e.g. 'ul' for a sibling 'Time: 7-9PM' bullet",
      },
      kind: {
        type: "string",
        enum: [...PROPOSAL_KINDS],
        description: "What every row on this page is. 'assignment' unless the page lists exams",
      },
      filter: {
        type: "object",
        additionalProperties: false,
        description: "Optional: drop rows whose text matches, for lines reading TBD, TBA or N/A",
        properties: {
          exclude: {
            type: "string",
            maxLength: MAX_SELECTOR,
            description: "A regular expression, e.g. '\\\\bTB[DA]\\\\b|\\\\bN/?A\\\\b'",
          },
        },
      },
      dateFormat: { type: "string", enum: supportedFormats },
    },
  };
}

export interface PromptText {
  system: string;
  user: string;
}

/**
 * The prompt, in two halves because the API takes them separately
 * (`initialPrompts` for the system text, `prompt()` for the page).
 *
 * It asks for column *headers*, not `td:nth-child(2)`. House rule 3 is the
 * reason: a positional cell turns one added column into a page of mis-dated
 * items with no error, and it would be perverse to ban that everywhere and then
 * ask a model for it. The runner re-resolves a named header on every parse.
 */
export function buildPrompt(
  skeleton: string,
  url: string,
  supportedFormats: string[] = supportedDateFormats(),
  structures: RepeatedStructure[] = [],
): PromptText {
  const system = [
    "You read a summary of a university course web page and identify where its",
    "assignment deadlines are. Say which of three shapes you saw, and answer with",
    "JSON only, matching the supplied schema.",
    "",
    /*
     * Every `rows` in these examples is `ROWS`, and that is the whole point.
     *
     * The three examples used to carry real selectors from three real courses —
     * `#homework table tbody tr`, `#mp-information ul.simple > li` and
     * `#schedule .event`. Asked about ECE 411 on 2026-09-18, the model answered
     * `#schedule .event` three times running: it was the nearest thing to a
     * `rows` value anywhere in its context, and nothing in the prompt said it
     * belonged to another page. An example selector beside a page summary is an
     * invitation to copy it, so the only selectors left in this text are the
     * page's own, printed under REPEATED STRUCTURES by the user half.
     */
    'Always answer every one of shape, rows, title, due, dueLabel, dateFormat. Where the shape',
    'has no use for a field, answer "" — never leave the key out.',
    "",
    'shape "table" — a table with a header row naming its columns. title and due are the',
    "header TEXT of the column holding the name and of the column holding the deadline.",
    '  { "shape": "table", "rows": "ROWS", "title": "Exercises", "due": "Due Date",',
    '    "dueLabel": "", "dateFormat": "M/d" }',
    "",
    'shape "list" — a LIST block: bullets reading "Label: value" under a heading, where the',
    "heading is the assignment's name and each bullet is one line about it. title and due are",
    "CSS selectors inside one bullet.",
    '  { "shape": "list", "rows": "ROWS", "title": "p", "due": "p",',
    '    "dueLabel": "Due|CP1 Due", "titleFrom": "section >> h3",',
    '    "filter": { "exclude": "\\\\bTB[DA]\\\\b" }, "dateFormat": "M/d" }',
    "",
    'shape "rows" — repeated blocks with no header row, where the name and the date are each',
    "reachable by a selector inside one block. Pick title and due from the tags printed after",
    '"inside one row:" for the structure you chose; answer "" for whichever of the two the',
    "row's own text already states.",
    '  { "shape": "rows", "rows": "ROWS", "title": ".name", "due": ".date",',
    '    "dueLabel": "", "dateFormat": "MMM d, h:mm a" }',
    "",
    'Replace ROWS with one line copied exactly from REPEATED STRUCTURES. Never invent a',
    "selector, and never copy one out of these examples: they are from other courses.",
    "",
    `dateFormat is one of: ${supportedFormats.join(", ")}`,
    "",
    "Rules:",
    "- Header text and dueLabel text must be copied exactly from the summary, never shortened:",
    '  "Due" and "Due Date" are different lines and only the exact one is read.',
    '- title and due are header text for "table" and CSS selectors inside one row for "list"',
    '  and "rows". A selector must name something printed after "inside one row:", or be "".',
    "- rows must be one of the REPEATED STRUCTURES lines, character for character. Use the",
    "  'titleFrom' printed with a list.",
    "- Never answer with a positional selector such as td:nth-child(2) or li:first-child.",
    "- Never answer with a date, a title or any value read off the page: only selectors.",
    "- Pick the graded work. Ignore office hours, lecture topics, grade weights and staff lists.",
    "- If several tables or lists could be it, pick the one whose rows carry dates.",
    '- Set kind to "exam" when every row on the page is an exam; otherwise leave it out.',
    "- Add filter.exclude only for rows the page itself marks TBD, TBA or N/A.",
  ].join("\n");

  /*
   * The inventory goes in the *user* half, not the system half.
   *
   * `proposeWithModel` creates one session with `initialPrompts` holding the
   * system text and then prompts it per attempt, so the system half is fixed
   * before any page is known. A page-derived list in it would be the previous
   * page's list — the same class of mistake as the example selectors above, one
   * process over.
   */
  const inventory = renderStructures(structures);
  const user = [
    `Course page: ${url}`,
    ...(inventory ? ["", inventory] : []),
    "",
    "Summary of the page:",
    skeleton,
  ].join("\n");

  return { system, user };
}

/**
 * How much of the page fits, given the model's own window.
 *
 * The window is shared with the output, so a share of it is reserved rather
 * than spent; the rest is the prompt text plus the page summary. Read
 * `session.contextWindow` at runtime instead of hard-coding 9,216 — the number
 * is a property of whatever model Chrome shipped that week, and a summary one
 * token over it is a `QuotaExceededError` rather than an answer.
 */
export const OUTPUT_RESERVE = 0.16;
export const CHARS_PER_TOKEN = 4;

export function skeletonBudgetChars(contextWindow: number, overheadChars: number): number {
  if (!Number.isFinite(contextWindow) || contextWindow <= 0) return 0;
  return Math.max(
    0,
    Math.floor(contextWindow * (1 - OUTPUT_RESERVE) * CHARS_PER_TOKEN) - overheadChars,
  );
}

/**
 * The largest page this feature will carry back to the options page.
 *
 * A captured page has no size limit — `capture` reads whatever the server sent
 * — and a `chrome.runtime` message is structured-cloned in full, so an enormous
 * page would be copied for a branch that would then not fit it in a 9,216-token
 * window anyway. Two megabytes is far past every course site captured so far
 * (the largest is 33KB) and well under what the message channel will carry.
 */
export const MAX_AUTHOR_HTML = 2_000_000;

/**
 * The page HTML to send back with the candidates, or nothing.
 *
 * Returning `undefined` rather than a truncated page on purpose: half a
 * document parses into a DOM that looks complete and is missing the table, and
 * the model would then be asked about a page that does not exist. The branch
 * reports that it declined instead.
 */
export function htmlForAuthoring(body: string): string | undefined {
  return body.length > 0 && body.length <= MAX_AUTHOR_HTML ? body : undefined;
}

/**
 * Why the `detected` message carried no page, told apart at the boundary.
 *
 * `html` was added to that message in the same commit as this whole feature,
 * and Chrome keeps the running service worker while reloading extension pages
 * from disk — so a fresh options page routinely talks to a worker that has
 * never heard of the field (worker rule 8, the case `core/compat.ts` exists
 * for). The page read `if (!html)` and said "That page was too large to
 * summarise" about a 33KB page: a fact about the student's course site, when
 * the actual fix was one click on chrome://extensions, with the model branch
 * silently never run.
 *
 * Three causes, and they send a person to three different places:
 *
 * - the worker is older than this page — reload the extension;
 * - the page was over `MAX_AUTHOR_HTML` — nothing to do here;
 * - the fetch came back with a zero-length body — the site, not the size.
 *
 * `chrome.runtime` messages are JSON, which drops an `undefined` value along
 * with its key, so an absent `html` cannot by itself say which of the three it
 * was: the worker has to state the size decision positively (`htmlOmitted`),
 * and until it does, the stale-worker sentence names the cheap fix first and
 * the size second. Read here rather than in the page because it is a decision
 * (worker rule 1) and because the page is one of the two files the suite
 * cannot reach.
 */
export type AuthorPage =
  | { ok: true; html: string }
  | { ok: false; outcome: ModelOutcome };

export function pageForAuthoring(response: unknown): AuthorPage {
  const message = (response ?? {}) as { html?: unknown; htmlOmitted?: unknown };
  const html = message.html;
  if (typeof html === "string" && html.length > 0) return { ok: true, html };
  const omitted = message.htmlOmitted;
  if (omitted === "too-large") return { ok: false, outcome: { state: "page-too-large" } };
  if (omitted === "empty" || html === "") return { ok: false, outcome: { state: "empty-page" } };
  return { ok: false, outcome: { state: "stale-worker", missing: ["html"] } };
}

/* -------------------------------------------------------------------------- */
/* Grounding: does the page have what the proposal named?                       */
/* -------------------------------------------------------------------------- */

/**
 * The opening of every "you named something that is not on this page" reason.
 *
 * A sentinel rather than a guess, because two readers depend on telling this
 * class of rejection apart from the rest: the retry prompt, which quotes it
 * back, and `modelStatusLine`, which says a different sentence to the student
 * for it — "no deadlines on that page" and "that selector is not on that page"
 * send a person to two different places.
 */
const GROUNDING_PREFIX = "no element matches ";

/**
 * Anchored, and it captures the quoted selector (house rule 5).
 *
 * The anchor is **unreachable today** and stays: mutating `^` away survives the
 * suite, because every page-derived string that reaches a reason goes through
 * `JSON.stringify` first — a row titled `no element matches rows "x"` arrives
 * with its quotes escaped and the capture group, which must start on a bare
 * `"`, does not fire. It stays because that is a property of the *other*
 * reasons rather than of this regex: the first one to interpolate a page's own
 * text raw would let a course name an assignment into the wrong status line,
 * and an unanchored search is the kind of marker house rule 12 is about.
 */
const GROUNDED = new RegExp(
  `^${GROUNDING_PREFIX}(?:rows|title|due|titleFrom|time) ("(?:[^"\\\\]|\\\\.)*")`,
);

/**
 * The selector a grounding rejection was about, or nothing.
 *
 * `undefined` for every other rejection — a header that is not in the table, a
 * format that read no dates — because those are facts about a page the model
 * *did* find, and saying "named parts of the page that do not exist" about them
 * would be a sentence derived from something that did not happen.
 */
export function groundingSelector(reason: string | undefined): string | undefined {
  return reason === undefined ? undefined : (GROUNDED.exec(reason)?.[1] ?? undefined);
}

/** The page's own answer to "then what is here?", for a model and for a person. */
function inventorySentence(structures: RepeatedStructure[]): string {
  if (structures.length === 0) {
    return "This page has no repeated group of elements to point at, so it may need a hand-written entry.";
  }
  return `The repeated structures on this page are: ${structures
    .map((structure) => `${structure.selector} (×${structure.count})`)
    .join("; ")}.`;
}

function ungrounded(
  field: string,
  spec: string,
  where: string,
  structures: RepeatedStructure[],
): string {
  return `${GROUNDING_PREFIX}${field} ${JSON.stringify(spec)}${where}. ${inventorySentence(structures)}`;
}

/** The scope separator `runAdapter` reads in a `titleFrom` / `time` spec. */
const SCOPE_SEP = ">>";

/** `time@datetime` is a selector and an attribute; only the selector is searched. */
function selectorPart(spec: string): string {
  return spec.split("@")[0]!.trim();
}

/**
 * Every CSS selector inside a spec — *both* halves of a scoped one.
 *
 * The probe below used to compile `spec.split(">>")[0]`, so the inner half went
 * straight into `row.closest(scope)?.querySelector(inner)` with no try. A
 * SyntaxError there escaped `groundProposal`, escaped `validateProposal` and
 * escaped `authorAdapter`'s loop, which is not a rejection with a reason but
 * the end of the run: the remaining attempts lost, the model never told what
 * was wrong, and `Expected name, found :` — a CSS-parser message — shown to a
 * student on a page the model answered correctly on its second try. The
 * unscoped path was guarded the whole time; this is one decision written twice
 * with only one copy correct (mutation rule 3), so now it is written once.
 *
 * An empty half is not returned: `reachesFromRow` reads `section >> ` as "does
 * not reach", which is a grounding rejection naming the page's own structures
 * rather than a syntax complaint.
 */
function selectorParts(spec: string): string[] {
  if (spec.includes(SCOPE_SEP)) {
    const at = spec.indexOf(SCOPE_SEP);
    return [spec.slice(0, at).trim(), selectorPart(spec.slice(at + SCOPE_SEP.length))].filter(
      (part) => part !== "",
    );
  }
  const selector = selectorPart(spec);
  // `.` is the row itself, which `reachesFromRow` answers without the DOM.
  return selector === "" || selector === "." ? [] : [selector];
}

/** The "that is not CSS" rejection for a field, or nothing if every half compiles. */
function notASelector(field: string, spec: string, doc: Document): string | undefined {
  for (const part of selectorParts(spec)) {
    try {
      doc.querySelectorAll(part);
    } catch {
      return `${field} ${JSON.stringify(spec)} is not a CSS selector.`;
    }
  }
  return undefined;
}

/**
 * Whether a row-relative spec reaches an element from at least one row.
 *
 * "At least one", not "every one": a labelled list is rows-per-line and the
 * lines this adapter is not about legitimately have nothing in them. What this
 * refuses is the case the runner would take a fetch and a full parse to reach —
 * a selector no row on the page contains, anywhere.
 *
 * Every caller compiles the spec with `notASelector` first, so nothing here
 * throws; that order is the whole fix above.
 */
function reachesFromRow(rows: Element[], spec: string): boolean {
  if (spec.includes(SCOPE_SEP)) {
    const at = spec.indexOf(SCOPE_SEP);
    const scope = spec.slice(0, at).trim();
    const inner = selectorPart(spec.slice(at + SCOPE_SEP.length));
    if (!scope || !inner) return false;
    return rows.some((row) => row.closest(scope)?.querySelector(inner) != null);
  }
  const selector = selectorPart(spec);
  // `.` is the row itself, which is the one spec that cannot fail to match.
  if (selector === "" || selector === ".") return true;
  return rows.some((row) => row.querySelector(selector) !== null);
}

/**
 * Every selector in the proposal, checked against the real DOM, before the
 * runner is asked for anything.
 *
 * Live evidence, 2026-09-18: the model answered `#schedule .event` for ECE 411
 * three times, the runner rejected it three times, and each round trip was ten
 * seconds of a student watching a button — for an answer `querySelectorAll`
 * refuses in a millisecond. The runner still runs and still owns the verdict;
 * this only declines to pay for it when the page plainly has not got what the
 * proposal named, and it names what the page *does* have so the next attempt
 * has somewhere to go.
 *
 * Membership of the inventory is deliberately *not* what is checked. The
 * inventory is twelve entries out of a page's dozens, and a selector outside it
 * that matches is a right answer — the enum in `proposalSchema` is what keeps a
 * constrained decode inside the list, and this is what keeps every answer,
 * constrained or not, on the page.
 */
function groundProposal(
  rows: string | undefined,
  specs: Record<string, string | undefined>,
  doc: Document,
  structures: RepeatedStructure[],
): string | undefined {
  if (rows === undefined) return "rows must be a selector";
  let rowEls: Element[];
  try {
    rowEls = [...doc.querySelectorAll(rows)];
  } catch {
    return `rows ${JSON.stringify(rows)} is not a CSS selector. ${inventorySentence(structures)}`;
  }
  if (rowEls.length === 0) return ungrounded("rows", rows, "", structures);

  /*
   * The header row, named as the header row.
   *
   * `#homework tr` is `#homework table tbody tr` plus the `<thead>` line, and
   * read through a `columns.title` of "Exercises" it produces a row *titled*
   * Exercises with the words "Due Date" where its date should be. It used to be
   * refused two checks later, on the unparsed-date test, whose reason names the
   * row — so the retry was told an assignment called "Exercises" had an
   * unreadable date and a small model could repeat the selector until the
   * attempts ran out. The inventory no longer offers this spelling; an
   * unconstrained decode can still write it, and this is the sentence that
   * tells it exactly which selector to use instead.
   */
  const header = rowEls.find(isHeaderRowOutsideTbody);
  if (header) {
    const table = header.closest("table");
    const instead = table ? rowSelectorForTable(table, doc) : "the table's tbody rows";
    return (
      `rows ${JSON.stringify(rows)} matches the table's header row as well as its data rows. ` +
      `Use ${JSON.stringify(instead)}, which is the same rows without the header.`
    );
  }

  /*
   * A table's `columns` are header *text*, not selectors, so nothing below
   * looks at them — `runAdapter` owns that check and already names the missing
   * header in a sentence a retry can act on.
   *
   * There is no `shape === "table"` early return here, though, and that is
   * deliberate: `time` is the one selector field a table proposal is allowed to
   * carry (it is not in the `refused` list above), so an early return would
   * leave the table shape the only one whose selectors reach the runner
   * ungrounded. `title` and `due` are refused for a table and so are undefined,
   * and the loop skips them on their own.
   */
  const inRows = ` inside any of the ${rowEls.length} rows ${JSON.stringify(rows)} matched`;
  for (const [field, spec] of Object.entries(specs)) {
    if (spec === undefined || field === "titleFrom") continue;
    const malformed = notASelector(field, spec, doc);
    if (malformed) return malformed;
    if (!reachesFromRow(rowEls, spec)) return ungrounded(field, spec, inRows, structures);
  }

  const titleFrom = specs["titleFrom"];
  if (titleFrom !== undefined) {
    const malformed = notASelector("titleFrom", titleFrom, doc);
    if (malformed) return malformed;
    // The unscoped form is "the nearest heading preceding the row", which a
    // selector search cannot answer without walking every row backwards — so
    // this asks the weaker question the page can answer cheaply, and leaves the
    // rest to `runAdapter`'s own `no row reached a title via …`.
    // `selectorParts` returns nothing for `""` and `"."` — a bare `@datetime`,
    // or the row itself, neither of which names a heading — so those are "not
    // reached" rather than a query this would have to guard.
    const parts = selectorParts(titleFrom);
    const reached = titleFrom.includes(SCOPE_SEP)
      ? reachesFromRow(rowEls, titleFrom)
      : parts.length > 0 && doc.querySelectorAll(parts[0]!).length > 0;
    if (!reached) return ungrounded("titleFrom", titleFrom, "", structures);
  }
  return undefined;
}

export type ValidationOutcome =
  | { ok: true; candidate: Candidate }
  | { ok: false; reason: string };

/** Rows shown in the preview, matching what `detect.ts` offers. */
const SAMPLE_ROWS = 6;
/** The share of rows that must carry a readable date, as in `detect.ts`. */
const MIN_DATED_SHARE = 0.5;

/**
 * Whether a proposal survives the real runner on the real page.
 *
 * Everything the student is shown comes out of `runAdapter`, not out of the
 * model: the titles and instants in the preview are what the extension will
 * actually record, so a confirmation means something. The `reason` is written
 * to be read twice — once by the model on the next attempt, and once by a
 * person if every attempt fails.
 */
export function validateProposal(
  proposal: unknown,
  doc: Document,
  url: string,
  timezone: string,
  reference: string,
  /** Computed from `doc` when the caller has not already; `authorAdapter` has. */
  structures: RepeatedStructure[] = repeatedStructures(doc),
): ValidationOutcome {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    return { ok: false, reason: "the answer was not a JSON object" };
  }
  const p = proposal as Record<string, unknown>;
  for (const key of Object.keys(p)) {
    if (!(PROPOSAL_FIELDS as readonly string[]).includes(key)) {
      return { ok: false, reason: `unknown field ${JSON.stringify(key)}` };
    }
  }
  const shape = p["shape"];
  if (typeof shape !== "string" || !(SHAPES as readonly string[]).includes(shape)) {
    return { ok: false, reason: `shape must be one of ${SHAPES.join(", ")}` };
  }

  /*
   * One pass, one rule: a string field is *given* when it has non-blank text.
   *
   * `""` is how the schema lets a shape say "not this one" for a key it is
   * nonetheless required to answer, so every reading of `given` below is about
   * a value the model chose — and no branch in this function can ever refuse a
   * proposal for a key that is absent (`REQUIRED_OF_EVERY_SHAPE`).
   */
  const given: Record<string, string> = {};
  for (const key of STRING_FIELDS) {
    const value = p[key];
    if (value === undefined) continue;
    if (typeof value !== "string") return { ok: false, reason: `${key} must be a string` };
    const trimmed = value.trim();
    if (trimmed !== "") given[key] = trimmed;
  }

  const declared = p["filter"];
  if (declared !== undefined) {
    if (!declared || typeof declared !== "object" || Array.isArray(declared)) {
      return { ok: false, reason: "filter must be an object" };
    }
    for (const key of Object.keys(declared as Record<string, unknown>)) {
      if (!(FILTER_FIELDS as readonly string[]).includes(key)) {
        // `include` is refused rather than accepted: an include that matches
        // nothing empties the page and reads exactly like a term that has not
        // started, which is house rule 2's silent empty.
        return { ok: false, reason: `unknown filter.${key}` };
      }
    }
  }
  // `{ "exclude": "" }` is the same `""` the string fields use — "no filter",
  // not an empty pattern. `validateAdapter` would refuse it as `bad
  // filter.exclude`, which is a sentence about a key the model was told to
  // leave blank.
  const exclude = (declared as { exclude?: unknown } | undefined)?.exclude;
  const filter =
    declared === undefined || (typeof exclude === "string" && exclude.trim() === "")
      ? undefined
      : declared;

  /*
   * The shape decides what each field *means*, and which have no meaning at all.
   *
   * A proposal that names both a table's columns and a list's `dueLabel` is not
   * one this can half-apply: `runAdapter` reads `columns` and ignores the rest,
   * so the student would confirm a preview produced by one half of an answer
   * and save an entry carrying the other. Every rejection below is about a
   * *value* — a field the shape does not read carrying text, or one it does
   * read carrying none — because a missing key is no longer expressible
   * (`REQUIRED_OF_EVERY_SHAPE`).
   */
  const isTable = shape === "table";
  const refused = isTable ? ["dueLabel", "titleFrom"] : shape === "list" ? ["link"] : ["dueLabel", "titleFrom", "link"];
  for (const field of refused) {
    if (given[field] !== undefined) {
      return { ok: false, reason: `shape "${shape}" does not take ${field}` };
    }
  }

  if (isTable) {
    // Header text, not a selector: `runAdapter` re-resolves it against the
    // table's own header row on every parse (house rule 3).
    for (const [field, what] of [
      ["title", "the header text of the column holding the assignment name"],
      ["due", "the header text of the column holding the deadline"],
    ] as const) {
      if (given[field] === undefined) {
        return {
          ok: false,
          reason: `shape "table": ${field} must be ${what}, copied exactly from the page`,
        };
      }
    }
  } else if (shape === "list" && given["dueLabel"] === undefined) {
    return {
      ok: false,
      reason:
        'shape "list": dueLabel must be the text that starts a deadline line, copied exactly ' +
        'from the page, e.g. "Due" or "Due|CP1 Due"',
    };
  }

  /*
   * `""` for a row-relative field is the row's own text, which is `.` to the
   * runner — and on a `Due: 9/7` bullet it is the right answer, not a gap.
   * `select()` reads `.` as the row itself, `reachesFromRow` cannot fail on it,
   * and `validateAdapter` wants a non-empty string, so the translation happens
   * here rather than anywhere a `""` could reach the registry.
   */
  const selectors: Record<string, string | undefined> = isTable
    ? { time: given["time"] }
    : {
        title: given["title"] ?? ".",
        due: given["due"] ?? ".",
        titleFrom: given["titleFrom"],
        time: given["time"],
      };
  for (const field of MODEL_SELECTORS) {
    const value = selectors[field];
    if (value === undefined) continue;
    if (POSITIONAL.test(value)) {
      return {
        ok: false,
        reason:
          `${field} ${JSON.stringify(value)} picks by position. Name the element by its ` +
          "class, id or tag instead — a page that adds one element moves every position.",
      };
    }
  }

  // Before the runner, and before `validateAdapter`: a proposal naming elements
  // this page has not got costs a `querySelectorAll` to refuse and a full parse
  // to refuse the other way round.
  const ungroundedReason = groundProposal(given["rows"], selectors, doc, structures);
  if (ungroundedReason) return { ok: false, reason: ungroundedReason };

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { ok: false, reason: `${url} is not a URL` };
  }

  /*
   * The same trust boundary a published adapter clears, before the page is
   * touched. The placeholders are the fields the student fills in afterwards
   * (the course code) or the flow already derives (the host pattern); they are
   * not the model's to choose, and leaving them out of the schema is what stops
   * a proposal from ever naming a host other than the page it was read from.
   */
  const candidateAdapter = {
    id: "proposed",
    label: "proposed",
    courseCode: "PROPOSED",
    term: "proposed",
    url,
    hostPattern: `https://${host}/*`,
    rows: given["rows"],
    ...(isTable
      ? {
          columns: {
            title: given["title"],
            due: given["due"],
            ...(given["link"] === undefined ? {} : { link: given["link"] }),
          },
        }
      : {}),
    // `Adapter.title` and `Adapter.due` are required whatever the shape. For a
    // table they are the fallback for a header that is missing at parse time
    // and the named columns are what resolve; for the other two shapes they are
    // the answer itself, with `.` meaning the row's own text.
    title: isTable ? "td:nth-child(1)" : selectors["title"],
    due: isTable ? "td:nth-child(2)" : selectors["due"],
    ...(given["dueLabel"] === undefined ? {} : { dueLabel: given["dueLabel"] }),
    ...(given["titleFrom"] === undefined ? {} : { titleFrom: given["titleFrom"] }),
    ...(given["time"] === undefined ? {} : { time: given["time"] }),
    // Passed through to `validateAdapter` rather than checked here: it owns the
    // `Record<Kind, true>` the compiler watches, and a `kind` this file waved
    // past would reach `Item.kind` as a value no `switch` in the UI answers.
    // `filter.exclude` is data compiled into a regex, and it is refused there
    // if it does not compile.
    ...(given["kind"] === undefined ? {} : { kind: given["kind"] }),
    ...(filter === undefined ? {} : { filter }),
    dateFormat: given["dateFormat"],
    timezone,
    minExtensionVersion: "0.1.0",
  };

  const { adapter, reason } = validateAdapter(candidateAdapter);
  if (!adapter) return { ok: false, reason: (reason ?? "invalid").replace(/^proposed: /, "") };

  const page: PageCtx = { url, fetchedAt: reference };
  let items;
  try {
    items = runAdapter(adapter as Adapter, doc, page);
  } catch (err) {
    // A ParseError here is the ordinary case, not a surprise: it is what a
    // selector that matches nothing, or a header that is not on the page,
    // produces. It is the sentence the next attempt is given.
    if (err instanceof ParseError) return { ok: false, reason: err.message };
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }

  /*
   * Reachable now, and this is what it was left here for.
   *
   * `runAdapter` throws for the two ways a page yields nothing — no row matched
   * the selector, and no matched row had a title — and the remaining way to
   * reach `[]` is a `filter` that excludes every row, which the model *may* now
   * propose. A term where every checkpoint still reads TBD is exactly that: a
   * legitimate page for a hand-written entry and a useless one to show a
   * student, because there is nothing in the preview to confirm. §11 ranks a
   * silently dropped deadline above every other failure, so this is a rejection
   * with a reason the next attempt can act on rather than an empty preview.
   */
  if (items.length === 0) {
    return {
      ok: false,
      reason:
        `${adapter.rows} matched rows, but none produced an assignment` +
        (adapter.filter?.exclude
          ? ` — filter.exclude ${JSON.stringify(adapter.filter.exclude)} removed every one`
          : ""),
    };
  }
  if (items.some((item) => item.title.trim() === "")) {
    const titleName = adapter.columns?.title ?? adapter.title;
    return {
      ok: false,
      reason: `${titleName === "." ? "the row's own text" : JSON.stringify(titleName)} is empty on some rows`,
    };
  }

  /*
   * What the model called the deadline, in its own words.
   *
   * `.` is this file's translation of the `""` the schema invites for "the
   * row's own text", so quoting it back would be a rejection about a value the
   * model never wrote — and the one thing a retry has to be able to do is
   * recognise the answer it gave.
   */
  const dueName = adapter.columns
    ? `the ${JSON.stringify(adapter.columns.due)} column`
    : adapter.dueLabel
      ? `the lines labelled ${JSON.stringify(adapter.dueLabel)}`
      : adapter.due === "."
        ? "the row's own text"
        : `${JSON.stringify(adapter.due)} in each row`;
  const dated = items.filter((item) => item.dueAt !== undefined);
  if (dated.length === 0) {
    return {
      ok: false,
      reason:
        `nothing in ${dueName} read as a date in ${adapter.dateFormat} format. ` +
        `Check where the deadline is and the format (${supportedDateFormats().join(", ")}).`,
    };
  }
  if (dated.length / items.length < MIN_DATED_SHARE) {
    return {
      ok: false,
      reason: `only ${dated.length} of ${items.length} rows carried a readable date`,
    };
  }
  /*
   * A tail the date parser could not read is a rejection here, where a retry is
   * free — not a warning on a row. `extra.unparsedTime` means the page printed a
   * cutoff this column's format could not consume, and the row would land at an
   * invented 23:59; `extra.unparsedDate` means the cell was not a date at all.
   * Either usually means a different column or a different format is the answer,
   * which is exactly what the model can try again.
   */
  const unparsed = items.find(
    (item) => item.extra?.["unparsedDate"] ?? item.extra?.["unparsedTime"],
  );
  if (unparsed) {
    return {
      ok: false,
      reason:
        `row ${JSON.stringify(unparsed.title)} has a date this could not fully read ` +
        `(${unparsed.extra?.["unparsedDate"] ?? unparsed.extra?.["unparsedTime"]})`,
    };
  }

  const sample: DetectedRow[] = dated.slice(0, SAMPLE_ROWS).map((item) => ({
    title: item.title,
    // What the student checks is the instant the extension recorded, not the
    // text the page printed: a column that reads plausibly and parses to the
    // wrong day is the failure this preview exists to catch.
    due: item.dueAt ?? "",
  }));

  /*
   * Built out of the *validated adapter*, never out of the raw proposal.
   *
   * What the student confirms has to be what gets saved. A candidate assembled
   * from `p` could carry a field `validateAdapter` normalised or `runAdapter`
   * never read, and the preview below it would have been produced by the other
   * object — which is the defect this whole file exists to make impossible, one
   * hop later.
   */
  return {
    ok: true,
    candidate: {
      rows: adapter.rows,
      ...(adapter.columns
        ? { columns: adapter.columns }
        : { title: adapter.title, due: adapter.due }),
      ...(adapter.dueLabel ? { dueLabel: adapter.dueLabel } : {}),
      ...(adapter.titleFrom ? { titleFrom: adapter.titleFrom } : {}),
      ...(adapter.time ? { time: adapter.time } : {}),
      ...(adapter.kind ? { kind: adapter.kind } : {}),
      ...(adapter.filter ? { filter: adapter.filter } : {}),
      dateFormat: adapter.dateFormat,
      total: items.length,
      dated: dated.length,
      sample,
    },
  };
}

/**
 * How the loop ended, with the two failures named apart.
 *
 * This was one `{ ok: false; failed; reason? }` branch, and the caller mapped
 * every `!ok` to `{ state: "rejected", reason: reason ?? failed }` — so a
 * *throw* was announced to the student as "its last proposal read no
 * deadlines: An unknown error occurred: kErrorUnknown". There was no proposal.
 * `ModelOutcome` has had a `"failed"` state the whole time and nothing reached
 * it. A discriminant rather than an optional field, because the mapping is the
 * thing that went wrong: `kind` cannot be forgotten the way `reason` was.
 *
 * - `"threw"` — the prompt itself rejected (a quota, a destroyed session, a
 *   crash). There is no answer to quote and no fact about the page in it.
 * - `"rejected"` — the model answered `maxAttempts` times and the validator
 *   refused every one. `reason` is its last word about *this page*.
 */
export type AuthorOutcome =
  | { ok: true; candidate: Candidate; attempts: number }
  | { ok: false; kind: "threw"; message: string; attempts: number }
  | { ok: false; kind: "rejected"; reason: string; attempts: number };

/** One attempt, as it happened, for the log the student will be asked to read. */
export interface AttemptInfo {
  /** 1-based, as the status line counts them. */
  attempt: number;
  outcome: "proposed" | "rejected" | "threw" | "not-json";
  /** The validator's reason, or the thrown message; absent for "proposed". */
  reason?: string;
  /**
   * The `shape` the answer claimed, and the keys it carried.
   *
   * A rejection line without them says what this code thought of the answer and
   * nothing about the answer. The live run that started this — three attempts,
   * every one `shape "rows" needs title` — would have said in its first line
   * that the keys were `shape, rows, dateFormat` and never anything else, which
   * is the schema's fingerprint rather than the model's mistake. Absent when
   * the answer was not JSON, or not an object.
   */
  shape?: string;
  keys?: string[];
  /** Characters the model answered with; 0 when the prompt threw. */
  answerChars: number;
  /** Characters sent — the whole prompt, retry suffix included. */
  promptChars: number;
}

export interface AuthorOptions {
  maxAttempts?: number;
  /** Defaults to the grounded `proposalSchema`; injectable so a test can pin it. */
  schema?: object;
  /**
   * The page's repeated groups, when the caller has already computed them.
   *
   * `proposeWithModel` has: it needs them to *measure* the prompt before it can
   * decide how much summary fits, and computing them twice would let the
   * measured prompt and the sent prompt disagree.
   */
  structures?: RepeatedStructure[];
  /**
   * Called once per attempt, before the next one is sent (worker rule 5).
   *
   * Both branches of every decision in the loop, in the page's own console. The
   * live run that produced `kErrorUnknown` left nothing behind to say which
   * attempt had thrown or how big its prompt was, and the two candidate causes —
   * a bad answer and an overflowing window — have opposite fixes.
   */
  onAttempt?: (info: AttemptInfo) => void;
}

/**
 * The longest validator reason a retry will quote back.
 *
 * A reason is written for a person as well as for the model and some of them
 * interpolate the page ("the repeated structures on this page are: …" runs to
 * twelve selectors). The skeleton budget is measured once, before any reason
 * exists, so an unbounded suffix is a retry that is over the window by however
 * much the last rejection happened to say. Capped here, counted in the budget
 * by `RETRY_SUFFIX_CHARS`, and the model loses nothing: the first clause of a
 * reason is the fact, and the inventory after it is also in `base`.
 */
export const MAX_RETRY_REASON_CHARS = 300;

/** And the longest row sketch a retry will repeat; see `rowSketchNote`. */
export const MAX_SKETCH_NOTE_CHARS = 200;

/**
 * "Inside one `#mp-information ul.simple > li` row: p, text." — or nothing.
 *
 * The inventory prints this beside every structure, and a rejected attempt is
 * where it is worth printing twice: every rejection a retry can act on is a
 * different `title`, `due`, `titleFrom` or `time`, and each of those is a
 * choice from *inside a row* — markup the summary may have had no budget to
 * show below the structures list.
 *
 * Attached only when the proposal's `rows` is one of the page's own groups,
 * which is both the case where a sketch exists and the case where the rows
 * answer was right and only the inside of it was wrong. A `rows` the page has
 * not got earns `groundProposal`'s reason instead, which lists what it *does*
 * have.
 */
export function rowSketchNote(
  proposal: unknown,
  structures: RepeatedStructure[],
): string | undefined {
  const rows = (proposal as { rows?: unknown } | null | undefined)?.rows;
  if (typeof rows !== "string") return undefined;
  const structure = structures.find((candidate) => candidate.selector === rows);
  if (!structure || structure.sketch === "") return undefined;
  return `Inside one ${rows} row: ${structure.sketch}.`;
}

/** The text appended to `base` on every attempt after the first. */
export function retrySuffix(reason: string, sketch?: string): string {
  const quoted =
    reason.length > MAX_RETRY_REASON_CHARS
      ? `${reason.slice(0, MAX_RETRY_REASON_CHARS - 1)}…`
      : reason;
  // Clipped here rather than only where it is built: `RETRY_SUFFIX_CHARS` is
  // what the caller subtracts from the page summary before any attempt has
  // run, so the cap belongs on the one function that decides the length.
  const note =
    sketch === undefined
      ? ""
      : sketch.length > MAX_SKETCH_NOTE_CHARS
        ? `${sketch.slice(0, MAX_SKETCH_NOTE_CHARS - 1)}…\n`
        : `${sketch}\n`;
  return (
    `\n\nYour previous answer was rejected: ${quoted}\n` + note + "Answer again, correcting that."
  );
}

/**
 * The most a retry can add, which is what the budget has to reserve.
 *
 * Derived from `retrySuffix` rather than written down beside it, so the two
 * cannot drift: a longer sentence changes both at once (mutation rule 3). The
 * sketch is part of that, so it is measured at its cap rather than at whatever
 * the page happened to print.
 */
export const RETRY_SUFFIX_CHARS = retrySuffix(
  "x".repeat(MAX_RETRY_REASON_CHARS),
  "x".repeat(MAX_SKETCH_NOTE_CHARS),
).length;

const DEFAULT_ATTEMPTS = 3;
/**
 * A hard ceiling on retries.
 *
 * Every attempt is a second or two of a student staring at a button, and a
 * model that has produced three unusable answers is not one attempt away from a
 * good one. The cap also bounds the one loop in this feature that a caller
 * could otherwise make unbounded.
 */
const MAX_ATTEMPTS = 5;

/**
 * Ask, check, and ask again with the reason — up to `maxAttempts` times.
 *
 * The reason is fed back verbatim because it is a fact about the page ("no due
 * column headed \"Deadline\" in this table"), which is the one kind of
 * correction a small model can act on. Nothing is retried on the network: the
 * page was fetched once, and every attempt is run against that same DOM.
 */
export async function authorAdapter(
  prompt: (text: string, schema: object) => Promise<string>,
  doc: Document,
  url: string,
  timezone: string,
  reference: string,
  skeleton: string,
  options: AuthorOptions = {},
): Promise<AuthorOutcome> {
  const structures = options.structures ?? repeatedStructures(doc);
  const schema = options.schema ?? proposalSchema(supportedDateFormats(), structures);
  const limit = Math.min(Math.max(1, Math.floor(options.maxAttempts ?? DEFAULT_ATTEMPTS)), MAX_ATTEMPTS);
  // The inventory is in `base`, so it is in the first prompt and in every
  // retry — a retry that dropped it would be the attempt most likely to invent
  // a selector, having just been told the last one was invented.
  const base = buildPrompt(skeleton, url, supportedDateFormats(), structures).user;

  const say = options.onAttempt ?? (() => {});

  let reason = "";
  /** The row sketch the last rejection earned, repeated on the next attempt. */
  let sketch: string | undefined;
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    const text = attempt === 1 ? base : `${base}${retrySuffix(reason, sketch)}`;

    let answer: string;
    try {
      answer = await prompt(text, schema);
    } catch (err) {
      // A thrown prompt is the end of the loop, not a retry: it is a
      // QuotaExceededError or a destroyed session, and asking again produces
      // the same throw a second later.
      const message = err instanceof Error ? err.message : String(err);
      say({ attempt, outcome: "threw", reason: message, answerChars: 0, promptChars: text.length });
      return { ok: false, kind: "threw", message, attempts: attempt };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(answer);
    } catch {
      reason = "that was not JSON";
      sketch = undefined;
      say({
        attempt,
        outcome: "not-json",
        reason,
        answerChars: answer.length,
        promptChars: text.length,
      });
      continue;
    }

    // What the model emitted, for the line the student will be asked to read —
    // read off the answer itself, so a schema that permits the wrong thing is
    // visible in the console rather than only in this file.
    const emitted =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? {
            shape:
              typeof (parsed as Record<string, unknown>)["shape"] === "string"
                ? ((parsed as Record<string, unknown>)["shape"] as string)
                : undefined,
            keys: Object.keys(parsed as Record<string, unknown>),
          }
        : {};

    const outcome = validateProposal(parsed, doc, url, timezone, reference, structures);
    if (outcome.ok) {
      say({
        attempt,
        outcome: "proposed",
        ...emitted,
        answerChars: answer.length,
        promptChars: text.length,
      });
      return { ok: true, candidate: outcome.candidate, attempts: attempt };
    }
    reason = outcome.reason;
    sketch = rowSketchNote(parsed, structures);
    say({
      attempt,
      outcome: "rejected",
      reason,
      ...emitted,
      answerChars: answer.length,
      promptChars: text.length,
    });
  }

  return { ok: false, kind: "rejected", reason, attempts: limit };
}

/**
 * What the student is told, from what the loop did — the one mapping.
 *
 * In the page this was `outcome.reason ?? outcome.failed` at the return
 * statement, which is where the `kErrorUnknown` defect lived: an expression in
 * a function the suite cannot reach, collapsing two facts into the one branch
 * that quotes them as a proposal. Worker rule 1 — the decision moves to
 * `core/`, the page keeps the `chrome.*` calls, and both rows of the table are
 * pinned.
 */
/* -------------------------------------------------------------------------- */
/* Saving the candidate the student pressed "Use this one" on                  */
/* -------------------------------------------------------------------------- */

/** The three messages that turn an approved candidate into a running adapter. */
export type SaveRequest =
  | { type: "add-local-adapter"; adapter: unknown }
  | { type: "set-adapter-enabled"; adapterId: string; enabled: boolean }
  | { type: "sync"; trigger: "manual" };

/**
 * Save it, switch it on, sync — and say which of the three failed.
 *
 * This was three bare `await send(…)` calls in the click handler with no catch
 * and two unchecked responses. `send` *rejects* when the worker has no handler
 * for a message — the older-worker case (worker rule 8) — and it rejects with
 * the one sentence that names the fix, so the rejection became an unhandled
 * promise rejection: invisible in the page and in the worker's console, with
 * the button left disabled reading "Saving…" and the candidate unrecoverable
 * without re-running detect and the model (UI rules 2 and 4). A `{type:"error"}`
 * from either of the later two was dropped the same way, leaving an entry that
 * is saved and switched off while the page says "added".
 *
 * In core rather than in the handler because it is a decision about what
 * counts as saved, and because the page is one of the two files the suite
 * cannot reach.
 */
export async function saveProposedAdapter(
  send: (request: SaveRequest) => Promise<{ type: string; message?: string }>,
  adapter: { id: string } & Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const steps: SaveRequest[] = [
    { type: "add-local-adapter", adapter },
    { type: "set-adapter-enabled", adapterId: adapter.id, enabled: true },
    { type: "sync", trigger: "manual" },
  ];
  for (const step of steps) {
    let response: { type: string; message?: string };
    try {
      response = await send(step);
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
    if (response.type === "error") {
      return { ok: false, message: response.message ?? `"${step.type}" failed` };
    }
  }
  return { ok: true };
}

/**
 * One attempt, as one line in the page's console.
 *
 * Live evidence again, 2026-09-18: the second ECE 411 run is being re-run on a
 * build whose attempts each get a fresh session, and what a second round trip
 * of Sushi's time would buy is exactly the fields below. So the line carries
 * every one of them: which attempt, what became of it, the selector that was
 * refused when the rejection was about a selector (quoted out of the reason so
 * it is findable without reading the whole sentence), how big the prompt and
 * the answer were, and — appended by the caller, which is the only place that
 * can read them — the session's input usage against its quota.
 *
 * Here rather than inline in `proposeWithModel` for worker rule 1's reason: the
 * options page is as unreachable from the suite as the service worker, and a
 * log line nobody can pin drifts out of step with the status line beside it.
 */
export function attemptLogLine(info: AttemptInfo): string {
  const invented = groundingSelector(info.reason);
  const answered =
    info.shape === undefined && info.keys === undefined
      ? ""
      : ` — answered shape ${JSON.stringify(info.shape ?? null)}` +
        ` with keys [${(info.keys ?? []).join(", ")}]`;
  return (
    `[author] attempt ${info.attempt}: ${info.outcome}` +
    answered +
    (invented === undefined ? "" : ` — selector not on the page: ${invented}`) +
    ` (prompt ${info.promptChars} chars, answer ${info.answerChars} chars)` +
    (info.reason === undefined ? "" : ` — ${info.reason}`)
  );
}

export function modelOutcomeFor(outcome: AuthorOutcome): ModelOutcome {
  if (outcome.ok) return { state: "proposed", attempts: outcome.attempts };
  if (outcome.kind === "threw") return { state: "failed", message: outcome.message };
  return { state: "rejected", attempts: outcome.attempts, reason: outcome.reason };
}

/* -------------------------------------------------------------------------- */
/* What the student is told happened                                           */
/* -------------------------------------------------------------------------- */

/**
 * Every way this branch can end, as data.
 *
 * Worker rule 1: the options page is nearly as hard to reach from the suite as
 * the service worker is, and the defect this fixes lived there — the page said
 * "Asking the on-device model…", the model ran, and the only thing left on
 * screen afterwards was the generic "No table on this page" sentence from
 * *before* it ran. Three of these outcomes had no wording at all and the rest
 * were written inline at their branch. Deciding it here means a test can pin
 * each sentence, and the page keeps the `chrome.*` calls and the DOM.
 */
export type ModelOutcome =
  /** No `LanguageModel` at all, or `availability()` did not say "available". */
  | { state: "unavailable" }
  | { state: "downloadable" }
  | { state: "downloading" }
  /** The page was too large to summarise, so nothing was asked. */
  | { state: "page-too-large" }
  /** The fetch came back with a zero-length body: nothing to summarise. */
  | { state: "empty-page" }
  /** The worker sent no page at all, which is a build older than this page. */
  | { state: "stale-worker"; missing: string[] }
  | { state: "proposed"; attempts: number }
  | { state: "rejected"; attempts: number; reason?: string }
  /** The session or the prompt threw: a quota, a destroyed session, a crash. */
  | { state: "failed"; message: string };

function attemptCount(n: number): string {
  return `${n} attempt${n === 1 ? "" : "s"}`;
}

/**
 * The status line for one run of the model branch.
 *
 * The rule every sentence here follows is worker rule 2's, one surface over: a
 * line the student reads must be derived from what actually happened. "Nothing
 * found on that page" after the model ran says the search found nothing — true
 * when it was written, and silent about the second thing that then ran, failed,
 * and had a reason.
 */
export function modelStatusLine(outcome: ModelOutcome): string {
  switch (outcome.state) {
    case "unavailable":
      return "Chrome's built-in model is not available on this computer.";
    case "downloadable":
      return (
        "Chrome can run a built-in model on this computer, but has not downloaded it yet. " +
        "Try this page again later and it can have a second go at it."
      );
    case "downloading":
      return "Chrome is still downloading its built-in model. Try this page again once it has finished.";
    case "page-too-large":
      return "That page was too large to summarise for Chrome's built-in model.";
    case "empty-page":
      return "That page came back empty, so there was nothing to show Chrome's built-in model.";
    case "stale-worker":
      // The worker now states the size decision positively (`htmlOmitted`), so
      // an absent `html` means the worker alone: it predates this page.
      return staleWorkerNotice(outcome.missing);
    case "proposed":
      return (
        `Chrome's built-in model proposed an entry (${attemptCount(outcome.attempts)}). ` +
        "Check the rows before saving it — you are the only one who knows what this course sets."
      );
    case "rejected": {
      /*
       * Two rejections, two sentences.
       *
       * "its last proposal read no deadlines" is true of a proposal that found
       * the schedule and read the wrong column, and it is a lie about
       * `#schedule .event` — which found nothing because there is nothing of
       * that name on the page. Sushi read the first sentence off a real run and
       * went looking for the deadlines it said had not been read; there were
       * none to look for, and the words sent him to the page instead of to the
       * one fact that mattered.
       */
      const invented = groundingSelector(outcome.reason);
      if (invented !== undefined) {
        return (
          `Chrome's built-in model tried ${attemptCount(outcome.attempts)} and its proposals ` +
          `named parts of the page that do not exist (last: ${invented}). ` +
          "A hand-written entry can still be written for it."
        );
      }
      return (
        `Chrome's built-in model tried ${attemptCount(outcome.attempts)} and its last proposal ` +
        `read no deadlines: ${outcome.reason ?? "no reason given"}`
      );
    }
    case "failed":
      return `Chrome's built-in model could not be used on this page: ${outcome.message}`;
  }
}

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
import { ParseError, type Adapter, type PageCtx } from "../sources/types.js";
import type { Candidate, DetectedRow } from "./detect.js";
import { validateAdapter } from "./registry.js";

/**
 * The fields the model may name, in one place.
 *
 * The JSON Schema below and the unknown-key check are both built from this, so
 * the answer the model is constrained to and the answer this file accepts
 * cannot drift apart — two copies of one decision is one copy too many
 * (mutation house rule 3).
 *
 * `title` / `due` as raw CSS selectors, `splitTitle` and `filter` are
 * deliberately **not** here even though `Adapter` carries them. The value that
 * comes out of this file is a `Candidate`, which is what the existing preview
 * and "Use this one" path saves, and a `Candidate` cannot carry them — asking
 * for a field the save path then drops is how a student ends up confirming a
 * filter that was never applied. They stay the hand-written entry's job.
 */
const PROPOSAL_FIELDS = ["rows", "columns", "dateFormat"] as const;
const COLUMN_FIELDS = ["title", "due", "link"] as const;

/** A selector is a selector, not a document. Remote-ish data gets a length cap. */
const MAX_SELECTOR = 200;
const MAX_HEADER = 120;

export interface Proposal {
  rows: string;
  columns: { title: string; due: string; link?: string };
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
export function proposalSchema(supportedFormats: string[] = supportedDateFormats()): object {
  return {
    type: "object",
    additionalProperties: false,
    required: [...PROPOSAL_FIELDS],
    properties: {
      rows: {
        type: "string",
        maxLength: MAX_SELECTOR,
        description: "CSS selector matching every data row of the schedule, e.g. '#homework table tr'",
      },
      columns: {
        type: "object",
        additionalProperties: false,
        required: ["title", "due"],
        properties: {
          title: {
            type: "string",
            maxLength: MAX_HEADER,
            description: "The exact header text of the column holding the assignment name",
          },
          due: {
            type: "string",
            maxLength: MAX_HEADER,
            description: "The exact header text of the column holding the deadline",
          },
          link: {
            type: "string",
            maxLength: MAX_HEADER,
            description: "Optional: the header of a column whose cells link to the assignment",
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
): PromptText {
  const system = [
    "You read a summary of a university course web page and identify the table of",
    "assignment deadlines in it.",
    "",
    "Answer with JSON only, matching the supplied schema:",
    "  rows       — a CSS selector matching every data row of that table",
    "  columns.title — the exact header text of the column holding the assignment name",
    "  columns.due   — the exact header text of the column holding the deadline",
    "  columns.link  — optional, the header of a column whose cells link to the assignment",
    `  dateFormat — one of: ${supportedFormats.join(", ")}`,
    "",
    "Rules:",
    "- Header text must be copied exactly from the TH row shown in the summary.",
    "- Use the 'rows selector' printed above the table, which already skips the header row.",
    "- Never answer with a positional selector such as td:nth-child(2) for a column.",
    "- Never answer with a date, a title or any value read off the page: only selectors.",
    "- Pick the table of graded work. Ignore office hours, lecture topics and staff lists.",
    "- If several tables could be it, pick the one whose rows carry dates.",
  ].join("\n");

  const user = [
    `Course page: ${url}`,
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
  const columns = p["columns"];
  if (!columns || typeof columns !== "object" || Array.isArray(columns)) {
    return { ok: false, reason: "columns must be an object naming the title and due headers" };
  }
  for (const key of Object.keys(columns as Record<string, unknown>)) {
    if (!(COLUMN_FIELDS as readonly string[]).includes(key)) {
      return { ok: false, reason: `unknown columns.${key}` };
    }
  }

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
    rows: p["rows"],
    columns,
    // Required by the schema, and the fallback for a table whose header is
    // missing at parse time. The named columns are what actually resolve.
    title: "td:nth-child(1)",
    due: "td:nth-child(2)",
    dateFormat: p["dateFormat"],
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
   * Unreachable today, and it stays.
   *
   * `runAdapter` already throws for the two ways a page yields nothing — no row
   * matched the selector, and no matched row had a title — and the one
   * remaining way to reach `[]` is a `filter` that excludes every row, which
   * the schema above does not let the model propose. It is left here because
   * "the runner returned an empty list" must never become "shown to the
   * student" if `filter` is ever added to the schema, and because §11 ranks a
   * silently dropped deadline above every other failure.
   */
  if (items.length === 0) {
    return { ok: false, reason: `${adapter.rows} matched rows, but none produced an assignment` };
  }
  if (items.some((item) => item.title.trim() === "")) {
    return { ok: false, reason: `column ${JSON.stringify(adapter.columns?.title)} has empty cells` };
  }

  const dated = items.filter((item) => item.dueAt !== undefined);
  if (dated.length === 0) {
    return {
      ok: false,
      reason:
        `no row's ${JSON.stringify(adapter.columns?.due)} cell parsed as ${adapter.dateFormat}. ` +
        `Check the column and the format (${supportedDateFormats().join(", ")}).`,
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

  return {
    ok: true,
    candidate: {
      rows: adapter.rows,
      columns: adapter.columns ?? { title: "", due: "" },
      dateFormat: adapter.dateFormat,
      total: items.length,
      dated: dated.length,
      sample,
    },
  };
}

export type AuthorOutcome =
  | { ok: true; candidate: Candidate; attempts: number }
  | { ok: false; failed: string; attempts: number };

export interface AuthorOptions {
  maxAttempts?: number;
  /** Defaults to `proposalSchema()`; injectable so a test can pin what is sent. */
  schema?: object;
}

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
  const schema = options.schema ?? proposalSchema();
  const limit = Math.min(Math.max(1, Math.floor(options.maxAttempts ?? DEFAULT_ATTEMPTS)), MAX_ATTEMPTS);
  const base = buildPrompt(skeleton, url).user;

  let reason = "";
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    const text =
      attempt === 1
        ? base
        : `${base}\n\nYour previous answer was rejected: ${reason}\nAnswer again, correcting that.`;

    let answer: string;
    try {
      answer = await prompt(text, schema);
    } catch (err) {
      // A thrown prompt is the end of the loop, not a retry: it is a
      // QuotaExceededError or a destroyed session, and asking again produces
      // the same throw a second later.
      return {
        ok: false,
        failed: err instanceof Error ? err.message : String(err),
        attempts: attempt,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(answer);
    } catch {
      reason = "that was not JSON";
      continue;
    }

    const outcome = validateProposal(parsed, doc, url, timezone, reference);
    if (outcome.ok) return { ok: true, candidate: outcome.candidate, attempts: attempt };
    reason = outcome.reason;
  }

  return {
    ok: false,
    failed: `gave up after ${limit} attempt${limit === 1 ? "" : "s"}; last reason: ${reason}`,
    attempts: limit,
  };
}

/**
 * Course-site adapters (§4.5).
 *
 * Adapters are **data**: URLs, CSS selectors and a date format. There is no
 * expression language, no JS and no eval — MV3 forbids remotely loaded code,
 * and remote *data* is what makes a broken selector fixable without a store
 * re-review (§0 decision 4). If a site needs logic, the schema grows a new
 * declarative field; it never grows a script.
 */

import { inferYear, isRealWallClock, monthIndex, wallClockToIso } from "../core/dates.js";
import { extractCourseCodes } from "../core/normalize.js";
import { KeyGuard, sameOriginHttpsUrl, textOf } from "../core/parsing.js";
import { ParseError, type Adapter, type PageCtx, type RawItem } from "./types.js";

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

/* -------------------------------------------------------------------------- */
/* Declarative date formats                                                    */
/* -------------------------------------------------------------------------- */

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";

/**
 * Token formats an adapter may declare. Deliberately a closed set: an adapter
 * cannot supply a pattern, only choose one, so a bad registry entry can produce
 * a wrong *selector* but never arbitrary matching behaviour.
 */
const DATE_FORMATS: Record<string, RegExp> = {
  // 2026-09-11 or 2026-09-11 23:59
  "yyyy-MM-dd": /^(?<year>\d{4})-(?<month>\d{1,2})-(?<day>\d{1,2})(?:[ T](?<hour>\d{1,2}):(?<minute>\d{2}))?/i,
  // Sep 11, 11:59 pm  ·  September 11 at 11:59pm  ·  Sep 11
  "MMM d, h:mm a": new RegExp(
    `^(?<month>${MONTHS})[a-z]*\\.?\\s+(?<day>\\d{1,2})` +
      `(?:\\s*(?:,|at)?\\s*(?<hour>\\d{1,2})(?::(?<minute>\\d{2}))?\\s*(?<ampm>am|pm))?`,
    "i",
  ),
  // 9/11 or 9/11/2026, optional time
  "M/d": /^(?<month>\d{1,2})\/(?<day>\d{1,2})(?:\/(?<year>\d{2,4}))?(?:\s+(?<hour>\d{1,2}):(?<minute>\d{2})\s*(?<ampm>am|pm)?)?/i,
};

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
  const pattern = DATE_FORMATS[format];
  if (!pattern) return undefined;
  const match = pattern.exec(raw.trim());
  if (!match?.groups) return undefined;
  const g = match.groups;

  const month = g["month"]!.match(/^\d+$/)
    ? Number(g["month"])
    : monthIndex(g["month"]!.slice(0, 3).replace(/^./, (c) => c.toUpperCase()));
  if (month === undefined) return undefined;

  let hour = g["hour"] ? Number(g["hour"]) : 23;
  const minute = g["minute"] ? Number(g["minute"]) : g["hour"] ? 0 : 59;
  const ampm = g["ampm"]?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  const parts = { month, day: Number(g["day"]), hour, minute };
  // Checked before inferYear, which builds candidate instants itself and would
  // otherwise throw out of a function whose contract is to return undefined.
  if (!isRealWallClock({ ...parts, year: 2000 })) return undefined;

  let year = g["year"] ? Number(g["year"]) : undefined;
  if (year !== undefined && year < 100) year += 2000;
  if (year === undefined) {
    // §3.2's inference. Course sites rarely print a weekday, so there is
    // usually no cross-check available — which is why a site adapter is the
    // least trustworthy date in the project and is labelled as such.
    year = inferYear(parts, undefined, reference, timezone);
    if (year === undefined) return undefined;
  }

  try {
    return wallClockToIso({ ...parts, year }, timezone);
  } catch {
    return undefined;
  }
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

  let sawTitledRow = false;
  for (const row of rows) {
    const title = select(row, adapter.title);
    // The `continue` stays: a header row legitimately has no title cell.
    if (!title) continue;
    sawTitledRow = true;
    if (!matchesFilter(title, adapter.filter)) continue;

    const rawDate = select(row, adapter.due);
    const dueAt = rawDate
      ? parseAdapterDate(rawDate, adapter.dateFormat, adapter.timezone, page.fetchedAt)
      : undefined;

    // §3.1: course sites have no ids, so the key is content-derived and a
    // rename loses any override on it. Documented and accepted there.
    const sourceId = `${adapter.id}:${hashTitleAndDate(title, dueAt)}`;
    if (keys.has(sourceId)) continue; // a repeated row is not a second deadline
    keys.claim(sourceId, `row ${JSON.stringify(title)}`);

    const extra: Record<string, string> = { adapterId: adapter.id, term: adapter.term };
    if (rawDate && dueAt === undefined) extra["unparsedDate"] = rawDate.slice(0, 200);
    if (codes.length > 1) extra["altCodes"] = codes.join(" ");

    items.push({
      source: "site",
      sourceId,
      courseRaw: adapter.label,
      courseCode: codes[0],
      title,
      kind: "assignment",
      dueAt,
      url: sameOriginHttpsUrl(
        adapter.link ? select(row, adapter.link) : undefined,
        new URL(adapter.url).origin,
        adapter.url,
      ),
      status: "unknown",
      extra,
      fetchedAt: page.fetchedAt,
    });
  }

  // House rule 2 / §0 rule 3: rows matched but none carried a title, so the page
  // was redesigned. Keyed on titles rather than on `items.length`, because a
  // `filter` may legitimately exclude every row on a page that parses fine.
  if (!sawTitledRow) {
    throw new ParseError(
      `adapter ${adapter.id}: ${rows.length} rows, none matched title ${JSON.stringify(adapter.title)}`,
    );
  }

  return items;
}

/** §3.1: `${adapterId}:${hash(normalizedTitle + dueDate)}`. */
function hashTitleAndDate(title: string, dueAt: string | undefined): string {
  const input = `${title.toLowerCase().replace(/\s+/g, " ").trim()}|${dueAt ?? ""}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(16).padStart(8, "0");
}

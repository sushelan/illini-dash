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
 * The optional bits real course pages put around a date.
 *
 * `WEEKDAY` — "Tue Sep 08", "Friday, September 4". `SEP` — the separator before
 * a time, which pages write as a comma, "at", "@", or an ISO "T".
 */
const WEEKDAY = "(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*\\.?,?\\s+";
const SEP = "[\\s,]*(?:at|@|T)?[\\s,]*";

/**
 * A stated time, in the two shapes that are not ambiguous.
 *
 * `h:mm` with optional am/pm, or a bare hour that *must* carry am/pm. A bare
 * "5" with no meridiem is not read as a time at all: on a course page it could
 * be either, and guessing would put a 5 PM deadline at 05:00 — worse than
 * admitting the time is unknown, because it looks stated.
 */
const TIME =
  `(?:(?<hour>\\d{1,2}):(?<minute>\\d{2})\\s*(?<ampm>am|pm)?` +
  `|(?<hour12>\\d{1,2})\\s*(?<ampm12>am|pm))`;

/**
 * Token formats an adapter may declare. Deliberately a closed set: an adapter
 * cannot supply a pattern, only choose one, so a bad registry entry can produce
 * a wrong *selector* but never arbitrary matching behaviour.
 *
 * Each is anchored at the start only, because pages append things this parser
 * has no business understanding ("US Central time", "(no late work)"). What is
 * *not* ignored is a tail that still looks like a time: see `timeLikeTail`.
 */
const DATE_FORMATS: Record<string, RegExp> = {
  // 2026-09-11 · 2026-09-11 23:59 · Fri, 2026-09-11 at 18:00
  "yyyy-MM-dd": new RegExp(
    `^(?:${WEEKDAY})?(?<year>\\d{4})-(?<month>\\d{1,2})-(?<day>\\d{1,2})(?:${SEP}${TIME})?`,
    "i",
  ),
  // Sep 11 · September 11 at 11:59pm · Tue, Sep 8 · Friday, September 4 at 18:00
  "MMM d, h:mm a": new RegExp(
    `^(?:${WEEKDAY})?(?<month>${MONTHS})[a-z]*\\.?\\s+(?<day>\\d{1,2})(?:st|nd|rd|th)?` +
      `(?:${SEP}${TIME})?`,
    "i",
  ),
  // 9/11 · 9/11/2026 · 09/04 @ 11:59pm · Tue 9/8
  "M/d": new RegExp(
    `^(?:${WEEKDAY})?(?<month>\\d{1,2})/(?<day>\\d{1,2})(?:/(?<year>\\d{2,4}))?(?:${SEP}${TIME})?`,
    "i",
  ),
};

/**
 * Whether the text this parser did not consume still looks like a time.
 *
 * The formats are start-anchored, so `09/04 @ 11:59pm` used to match `09/04`,
 * discard the rest, and report `timeAssumed` — inventing 23:59 while the real
 * cutoff sat unread in the same string. Now the leftover is inspected: if it
 * contains something time-shaped, that is an unreadable *value* and house rule
 * 1 says record it and keep the row, rather than quietly pretending the page
 * stated nothing.
 */
export function timeLikeTail(tail: string): string | undefined {
  const trimmed = tail.trim();
  if (trimmed === "") return undefined;
  return /\d{1,2}\s*:\s*\d{2}|\d\s*(?:am|pm)\b|\bnoon\b|\bmidnight\b/i.test(trimmed)
    ? trimmed.slice(0, 120)
    : undefined;
}

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
  return parseAdapterDateParts(raw, format, timezone, reference)?.iso;
}

export interface AdapterDate {
  iso: string;
  /**
   * True when the source text carried a date but no time, so 23:59 local is
   * this code's invention rather than anything the course stated.
   *
   * It has to travel with the instant: §5.3 ranks `site` above `canvas` for
   * dueAt, which is right when the site prints a real time and wrong when it
   * prints none — a made-up 23:59 would otherwise silently overwrite a real
   * deadline an instructor set in Canvas, and the row would look authoritative.
   */
  timeAssumed: boolean;
  /**
   * A time that was there and could not be read confidently.
   *
   * Either a tail the format did not consume (`09/04 @ 11:59pm` used to match
   * `09/04` and silently drop the rest) or an ambiguous bare `5:00`. Surfaced
   * through `extra` so the popup marks the row rather than presenting an
   * invented 23:59 as if the page had said nothing.
   */
  unparsedTime?: string;
}

export function parseAdapterDateParts(
  raw: string,
  format: string,
  timezone: string,
  reference: string,
): AdapterDate | undefined {
  const pattern = DATE_FORMATS[format];
  if (!pattern) return undefined;
  const match = pattern.exec(raw.trim());
  if (!match?.groups) return undefined;
  const g = match.groups;

  const month = g["month"]!.match(/^\d+$/)
    ? Number(g["month"])
    : monthIndex(g["month"]!.slice(0, 3).replace(/^./, (c) => c.toUpperCase()));
  if (month === undefined) return undefined;

  // Two alternatives in TIME, so the groups are coalesced here.
  const rawHour = g["hour"] ?? g["hour12"];
  const ampm = (g["ampm"] ?? g["ampm12"])?.toLowerCase();

  // A bare `h:mm` with no meridiem is 24-hour notation only when it cannot mean
  // anything else: an hour past noon, or a leading zero (nobody writes an
  // evening deadline as "09:00"). "5:00" on a course page is genuinely
  // ambiguous, and reading it as 05:00 would move a 5 PM deadline twelve hours
  // earlier while looking like a stated time. Ambiguous is treated as unstated
  // and recorded, per house rule 5.
  const ambiguous =
    rawHour !== undefined &&
    ampm === undefined &&
    g["minute"] !== undefined &&
    Number(rawHour) < 13 &&
    !/^0\d$/.test(rawHour);

  const stated = rawHour !== undefined && !ambiguous;
  let hour = stated ? Number(rawHour) : 23;
  const minute = stated ? (g["minute"] ? Number(g["minute"]) : 0) : 59;
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

  // Anything after the match that still looks like a time is a value this
  // parser failed to read, not text it was right to ignore.
  const leftover = timeLikeTail(raw.trim().slice(match[0].length));
  const unparsedTime = ambiguous ? String(rawHour) + (g["minute"] ? `:${g["minute"]}` : "") : leftover;

  try {
    return {
      iso: wallClockToIso({ ...parts, year }, timezone),
      timeAssumed: !stated,
      ...(unparsedTime ? { unparsedTime } : {}),
    };
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
    const cell = select(row, adapter.title);
    // The `continue` stays: a header row legitimately has no title cell.
    if (!cell) continue;
    sawTitledRow = true;

    // §4.5: one cell can hold several events. Split first, then filter, so a
    // filter can reject one half of `HW5 Due; HW6 Out` and keep the other —
    // which it cannot do while they share a string.
    const titles = (adapter.splitTitle ? cell.split(adapter.splitTitle) : [cell])
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .filter((part) => matchesFilter(part, adapter.filter));
    if (titles.length === 0) continue;

    const rawDate = select(row, adapter.due);
    const parsed = rawDate
      ? parseAdapterDateParts(rawDate, adapter.dateFormat, adapter.timezone, page.fetchedAt)
      : undefined;
    const dueAt = parsed?.iso;
    const url = sameOriginHttpsUrl(
      adapter.link ? select(row, adapter.link) : undefined,
      new URL(adapter.url).origin,
      adapter.url,
    );

    for (const title of titles) {
      // §3.1: course sites have no ids, so the key is content-derived and a
      // rename loses any override on it. Documented and accepted there.
      const sourceId = `${adapter.id}:${hashTitleAndDate(title, dueAt)}`;
      if (keys.has(sourceId)) continue; // a repeated row is not a second deadline
      keys.claim(sourceId, `row ${JSON.stringify(title)}`);

      const extra: Record<string, string> = { adapterId: adapter.id, term: adapter.term };
      if (rawDate && dueAt === undefined) extra["unparsedDate"] = rawDate.slice(0, 200);
      if (parsed?.timeAssumed) extra["timeAssumed"] = "true";
      // House rule 1: a time that was printed and could not be read costs its
      // own field and is recorded, rather than passing as "the page gave none".
      if (parsed?.unparsedTime) extra["unparsedTime"] = parsed.unparsedTime;
      if (codes.length > 1) extra["altCodes"] = codes.join(" ");

      items.push({
        source: "site",
        sourceId,
        courseRaw: adapter.label,
        courseCode: codes[0],
        title,
        kind: "assignment",
        dueAt,
        url,
        status: "unknown",
        extra,
        fetchedAt: page.fetchedAt,
      });
    }
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

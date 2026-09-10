/**
 * Date handling (§3.2).
 *
 * Every instant is stored as ISO 8601 **with an offset**. A naive local time is
 * never stored, because it resolves to a different instant on every machine that
 * reads it back.
 *
 * Each source states its dates differently, so each gets an explicit parser
 * rather than being handed to `new Date()` and hoped over.
 */

import { ParseError } from "../sources/types.js";

/**
 * Gradescope's `<time datetime>` attribute: `2026-09-02 17:00:00 -0500`.
 *
 * §3.2: full date, 24-hour time, numeric offset — but *not* ISO. The separator
 * is a space and the offset has no colon, so `new Date()` must not be trusted
 * with it. Converted to `2026-09-02T17:00:00-05:00`.
 */
const GRADESCOPE_DATETIME = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/;

export function parseGradescopeDateTime(raw: string): string {
  const match = GRADESCOPE_DATETIME.exec(raw.trim());
  if (!match) throw new ParseError(`unrecognised Gradescope datetime: ${JSON.stringify(raw)}`);
  const [, date, time, offsetHours, offsetMinutes] = match;
  const iso = `${date}T${time}${offsetHours}:${offsetMinutes}`;
  if (Number.isNaN(Date.parse(iso))) {
    throw new ParseError(`Gradescope datetime is not a real instant: ${JSON.stringify(raw)}`);
  }
  return iso;
}

/** True when `iso` is more than `days` days before `reference`. */
export function isOlderThan(iso: string, reference: string, days: number): boolean {
  const then = Date.parse(iso);
  const now = Date.parse(reference);
  if (Number.isNaN(then) || Number.isNaN(now)) return false;
  return now - then > days * 86_400_000;
}

/**
 * A short, stable, deterministic hash for content-derived ids (§3.1).
 *
 * Not cryptographic and not meant to be: it only has to be stable across syncs
 * and collision-free enough within one course. `crypto.subtle` is async, which
 * would make every parser async for no benefit. djb2, hex, 8 chars.
 */
export function shortHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/* -------------------------------------------------------------------------- */
/* PrairieLearn (§4.3)                                                         */
/* -------------------------------------------------------------------------- */

/** §3.2: the only zone abbreviations UIUC courses use. */
const ZONE_OFFSETS: Record<string, string> = { CDT: "-05:00", CST: "-06:00" };

/**
 * The access-details schedule format: `2026-08-27 12:40:01 (CDT)`.
 *
 * Full date, seconds, and an abbreviation that flips CDT→CST across the
 * semester (observed at 2026-12-09 in a real capture), which is exactly why
 * §3.2 forbids a fixed −05:00.
 */
const PL_SCHEDULE_DATE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \((C[DS]T)\)$/;

export function parsePrairieLearnScheduleDate(raw: string): string {
  const value = raw.trim();
  const match = PL_SCHEDULE_DATE.exec(value);
  if (!match) throw new ParseError(`unrecognised PrairieLearn date: ${JSON.stringify(raw)}`);
  const [, date, time, zone] = match;
  const iso = `${date}T${time}${ZONE_OFFSETS[zone!]}`;
  if (Number.isNaN(Date.parse(iso))) {
    throw new ParseError(`PrairieLearn date is not a real instant: ${JSON.stringify(raw)}`);
  }
  return iso;
}

/**
 * The 0-credit row's End is an em dash, not an empty cell (real capture), so
 * "no end" has to be recognised rather than parsed.
 */
export function isNoEndMarker(raw: string): boolean {
  const value = raw.trim();
  return value === "" || value === "—" || value === "–" || value === "-";
}

/* -------------------------------------------------------------------------- */
/* Wall-clock in a named zone (§3.2)                                           */
/* -------------------------------------------------------------------------- */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Minutes east of UTC for `instant` in `timeZone`, via Intl — no library. */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"), get("month") - 1, get("day"),
    get("hour") % 24, get("minute"), get("second"),
  );
  return (asUtc - instant.getTime()) / 60_000;
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Whether these parts name a date that exists.
 *
 * The credit-cell regex admits `Sep 31`, `Sep 0`, `25:00` and `99:99`. Formatted
 * verbatim, `Sep 31` yields `2026-09-31T…`, which strict RFC 3339 consumers —
 * §8.3's `.ics` writer among them — reject, while V8 rolls it into October; the
 * others make `Date` throw a RangeError, which is not a ParseError and so would
 * be reported as a plumbing bug rather than a parse failure (§6).
 */
export function isRealWallClock(parts: {
  year: number; month: number; day: number; hour: number; minute: number; second?: number;
}): boolean {
  const { year, month, day, hour, minute, second = 0 } = parts;
  if (![year, month, day, hour, minute, second].every(Number.isInteger)) return false;
  if (month < 1 || month > 12) return false;
  if (hour > 23 || hour < 0 || minute > 59 || minute < 0 || second > 59 || second < 0) return false;
  const leap = month === 2 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day >= 1 && day <= DAYS_IN_MONTH[month - 1]! + (leap ? 1 : 0);
}

/**
 * §3.2's `parseLocalDate`: build an instant from wall-clock parts in a named
 * zone, computing the offset **for that specific date** rather than assuming one.
 *
 * Two passes: guess with the offset at the UTC-interpreted instant, then
 * recompute at the candidate. That settles every case except the two DST edges,
 * where a wall clock is not a bijection: the ambiguous fall-back hour resolves to
 * the earlier (daylight) reading, and the nonexistent spring-forward hour
 * resolves to the instant one hour earlier in standard time. Both are real
 * instants, which is what §3.2 requires.
 */
export function wallClockToIso(
  parts: { year: number; month: number; day: number; hour: number; minute: number; second?: number },
  timeZone: string,
): string {
  if (!isRealWallClock(parts)) {
    throw new ParseError(`not a real wall-clock time: ${JSON.stringify(parts)}`);
  }
  const { year, month, day, hour, minute, second = 0 } = parts;
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  let offset = zoneOffsetMinutes(new Date(naive), timeZone);
  offset = zoneOffsetMinutes(new Date(naive - offset * 60_000), timeZone);

  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return (
    `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

export function monthIndex(name: string): number | undefined {
  const index = MONTHS.indexOf(name.slice(0, 3));
  return index === -1 ? undefined : index + 1;
}

/**
 * §3.2 year inference for dates that carry no year.
 *
 * Try the reference year and its neighbours; prefer one whose weekday matches
 * the stated weekday, which catches almost every bad guess. With no weekday to
 * check against, fall back to §3.2's stated rule: assume the current year, and
 * add one if the result is more than 6 months in the past.
 *
 * Returns `undefined` when a weekday IS stated and matches no candidate year.
 * Falling through to the dateless rule there would return one of the very years
 * the weekday check just rejected — a confident deadline built from data the
 * parser knows to be self-contradictory, which then drives §7's reminders.
 */
export function inferYear(
  parts: { month: number; day: number; hour: number; minute: number },
  weekday: string | undefined,
  reference: string,
  timeZone: string,
): number | undefined {
  const referenceDate = new Date(reference);
  const referenceYear = Number.isNaN(referenceDate.getTime())
    ? new Date().getUTCFullYear()
    : referenceDate.getUTCFullYear();

  const candidates = [referenceYear, referenceYear + 1, referenceYear - 1];

  if (weekday) {
    const wanted = WEEKDAYS.indexOf(weekday.slice(0, 3));
    for (const year of candidates) {
      const iso = wallClockToIso({ ...parts, year }, timeZone);
      const actual = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" })
        .format(new Date(iso));
      if (WEEKDAYS.indexOf(actual) === wanted) return year;
    }
    // No candidate matches: the weekday contradicts the date, so the source has
    // changed shape. Say so instead of guessing.
    return undefined;
  }

  const sameYear = Date.parse(wallClockToIso({ ...parts, year: referenceYear }, timeZone));
  const sixMonths = 182 * 86_400_000;
  return referenceDate.getTime() - sameYear > sixMonths ? referenceYear + 1 : referenceYear;
}

/* -------------------------------------------------------------------------- */
/* PrairieTest (§4.4)                                                          */
/* -------------------------------------------------------------------------- */

/**
 * PrairieTest renders every time through a live-updating span that carries the
 * instant as JSON in an attribute:
 *
 *   data-format-date='{"date":"2026-09-11T02:00:00.000Z","timezone":"America/Chicago",…}'
 *   data-format-date-range='{"start":"…","end":"…","timezone":"America/Chicago",…}'
 *
 * So §4.4's regexes over the visible text are unnecessary, and §3.2's year
 * inference is not needed for this source at all. That matters more than it
 * looks: the visible text is not even a fixed format — a capture taken on the
 * day of an exam renders it as "today, 9pm (CDT)", which §4.4's regex would
 * reject outright.
 */
export function parseDateAttribute(raw: string): string {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new ParseError(`date attribute is not JSON: ${JSON.stringify(raw.slice(0, 80))}`);
  }
  const date = (payload as { date?: unknown })?.date;
  if (typeof date !== "string" || Number.isNaN(Date.parse(date))) {
    throw new ParseError(`date attribute has no usable date: ${JSON.stringify(raw.slice(0, 80))}`);
  }
  return date;
}

export function parseDateRangeAttribute(raw: string): { start: string; end: string } {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new ParseError(`date range is not JSON: ${JSON.stringify(raw.slice(0, 80))}`);
  }
  const { start, end } = (payload ?? {}) as { start?: unknown; end?: unknown };
  if (
    typeof start !== "string" || Number.isNaN(Date.parse(start)) ||
    typeof end !== "string" || Number.isNaN(Date.parse(end))
  ) {
    throw new ParseError(`date range is incomplete: ${JSON.stringify(raw.slice(0, 80))}`);
  }
  if (Date.parse(end) < Date.parse(start)) {
    throw new ParseError(`date range ends before it starts: ${start} → ${end}`);
  }
  return { start, end };
}

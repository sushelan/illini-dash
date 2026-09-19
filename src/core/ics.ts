/**
 * Calendar export (§8.3).
 *
 * Two one-way exports, deliberately. §1 rules out a subscribable feed (it needs
 * a URL, which needs a server, which §0 decision 1 forbids) and OAuth sync
 * (Calendar scopes are "sensitive"; an unverified app is capped and warns).
 * So an `.ics` here is a one-time copy, and §8.3 requires the UI to say so
 * rather than let a student believe it stays in sync.
 */

import { assumedTimeNote } from "./provenance.js";
import type { Item } from "../sources/types.js";

/** §8.3: a 15-minute event ending at the deadline. */
const EVENT_MINUTES = 15;

/** `20260910T180000Z` — RFC 5545 UTC form. */
export function icsTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`not a date: ${iso}`);
  return `${date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`;
}

/**
 * RFC 5545 §3.3.11: backslash, semicolon and comma are escaped, and a newline
 * becomes a literal `\n`. Getting this wrong corrupts every event after the bad
 * one, because the parser loses track of where the property ends — and course
 * titles really do contain commas ("MP1 Report (4cr only, EXCEPT...)").
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * RFC 5545 §3.1: lines are folded at 75 octets, continued with a leading space.
 * Folded on octets rather than characters so a multi-byte character is never
 * split across the fold.
 */
export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Do not split a UTF-8 sequence: continuation bytes are 10xxxxxx.
    while (end > start && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end -= 1;
    parts.push(new TextDecoder().decode(bytes.slice(start, end)));
    start = end;
    limit = 74; // continuation lines carry a leading space
  }
  return parts.join("\r\n ");
}

/** `20260918` — RFC 5545 DATE form, for an all-day event. */
export function icsDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`not a date: ${iso}`);
  // Local calendar day, not UTC: an invented 23:59 Central is the *next* day in
  // UTC, so `toISOString().slice(0, 10)` would file every timeless course-site
  // deadline one day late.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/** The day after `iso`, as a DATE — RFC 5545 makes DTEND exclusive. */
function icsDayAfter(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`not a date: ${iso}`);
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return icsDate(next.toISOString());
}

function event(item: Item, stamp: string): string[] {
  const instant = item.dueAt ?? item.lateDueAt;
  if (instant === undefined) return [];
  let end: string;
  let start: string;
  try {
    end = icsTimestamp(instant);
    start = icsTimestamp(new Date(Date.parse(instant) - EVENT_MINUTES * 60_000).toISOString());
  } catch {
    return [];
  }

  const summary = item.courseLabel ? `${item.courseLabel}: ${item.title}` : item.title;
  const description = [
    item.kind === "booking" ? "Not booked — reserve a seat." : undefined,
    item.dueAt === undefined ? "Reduced-credit deadline." : undefined,
    // Said in the event itself, because a calendar entry is read long after and
    // far away from the popup that could have explained it.
    item.timeAssumed ? assumedTimeNote(item, "allDay") : undefined,
    // A row the student typed may have no link at all; a falsy entry is dropped
    // by the filter below rather than exported as the string "undefined".
    item.url,
  ]
    .filter(Boolean)
    .join("\n");

  // §4.5's invented 23:59 must not be exported as a timed event. A calendar
  // entry at 11:59 PM looks more authoritative than a row in a popup, and it is
  // the one the student will still be trusting in three weeks.
  const timing = item.timeAssumed
    ? [`DTSTART;VALUE=DATE:${icsDate(instant)}`, `DTEND;VALUE=DATE:${icsDayAfter(instant)}`]
    : [`DTSTART:${start}`, `DTEND:${end}`];

  return [
    "BEGIN:VEVENT",
    // Stable across exports, so re-importing updates rather than duplicating.
    `UID:${item.id}@illini-dash`,
    `DTSTAMP:${stamp}`,
    ...timing,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    // RFC 5545 §3.3.13: URL's value type is URI, not TEXT — escaping a comma
    // here would corrupt the link rather than protect the property.
    //
    // Omitted entirely when there is none: `URL:` with an empty value is not a
    // valid property, and RFC 5545 consumers differ on whether they skip it or
    // reject the whole calendar.
    ...(item.url ? [`URL:${item.url.replace(/[\r\n]/g, "")}`] : []),
    "END:VEVENT",
  ];
}

/** §8.3: an `.ics` of the given items, CRLF-terminated as RFC 5545 requires. */
export function buildIcs(items: Item[], now: Date = new Date()): string {
  const stamp = icsTimestamp(now.toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//illini-dash//EN",
    "CALSCALE:GREGORIAN",
    ...items.flatMap((item) => event(item, stamp)),
    "END:VCALENDAR",
  ];
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

/**
 * §8.3: a Google Calendar template link. No OAuth, no scopes, no consent
 * screen — it opens a prefilled "create event" page the student confirms.
 */
export function googleCalendarUrl(item: Item): string | undefined {
  const instant = item.dueAt ?? item.lateDueAt;
  if (instant === undefined) return undefined;
  let dates: string;
  try {
    if (item.timeAssumed) {
      // Google's TEMPLATE link takes a bare YYYYMMDD pair for an all-day event,
      // with the end exclusive — the same reason the .ics uses a DATE value.
      dates = `${icsDate(instant)}/${icsDayAfter(instant)}`;
    } else {
      const end = icsTimestamp(instant);
      const start = icsTimestamp(
        new Date(Date.parse(instant) - EVENT_MINUTES * 60_000).toISOString(),
      );
      dates = `${start}/${end}`;
    }
  } catch {
    return undefined;
  }

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.courseLabel ? `${item.courseLabel}: ${item.title}` : item.title,
    dates,
    // `details` is required by URLSearchParams to be a string, and a row with no
    // link has nothing to put there but the note.
    details: item.timeAssumed
      ? `${item.url ?? ""}\n\n${assumedTimeNote(item, "allDay")}`.trimStart()
      : (item.url ?? ""),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

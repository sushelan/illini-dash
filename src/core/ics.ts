/**
 * Calendar export (§8.3).
 *
 * Two one-way exports, deliberately. §1 rules out a subscribable feed (it needs
 * a URL, which needs a server, which §0 decision 1 forbids) and OAuth sync
 * (Calendar scopes are "sensitive"; an unverified app is capped and warns).
 * So an `.ics` here is a one-time copy, and §8.3 requires the UI to say so
 * rather than let a student believe it stays in sync.
 */

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
    item.url,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "BEGIN:VEVENT",
    // Stable across exports, so re-importing updates rather than duplicating.
    `UID:${item.id}@illini-dash`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    // RFC 5545 §3.3.13: URL's value type is URI, not TEXT — escaping a comma
    // here would corrupt the link rather than protect the property.
    `URL:${item.url.replace(/[\r\n]/g, "")}`,
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
    const end = icsTimestamp(instant);
    const start = icsTimestamp(new Date(Date.parse(instant) - EVENT_MINUTES * 60_000).toISOString());
    dates = `${start}/${end}`;
  } catch {
    return undefined;
  }

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.courseLabel ? `${item.courseLabel}: ${item.title}` : item.title,
    dates,
    details: item.url,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

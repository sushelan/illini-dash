/**
 * Calendar export (§8.3).
 *
 * Two one-way exports, deliberately. §1 rules out a subscribable feed (it needs
 * a URL, which needs a server, which §0 decision 1 forbids) and OAuth sync
 * (Calendar scopes are "sensitive"; an unverified app is capped and warns).
 * So an `.ics` here is a one-time copy, and §8.3 requires the UI to say so
 * rather than let a student believe it stays in sync.
 */

import { courseLabel } from "./names.js";
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

/**
 * What an exported late leg says about itself, in the `.ics` and the Google
 * Calendar push alike (copy-audit #15, 2026-09-27).
 *
 * "Late window" is the one noun every surface uses for it; this said
 * "Reduced-credit deadline.", and §4.3 is explicit that the window is not a
 * deadline. One constant for both exports, which is what keeps them from
 * drifting the way I66's two copies of `exportLegs` did.
 *
 * Not `creditWindowText`, although it is the one spelling of the window as a
 * time: the event's own start and end already are that time, and on a
 * `timeAssumed` leg it would print the invented 11:59 PM inside an event that
 * is filed all-day precisely so that no clock appears (worker rule 3).
 */
export const LATE_LEG_NOTE = "Late window — reduced credit.";

/** One instant of one item that becomes a calendar event. */
export interface ExportLeg {
  /** `item.id`, or `item.id#late` for the late window. */
  key: string;
  instant: string;
  /** True when this instant is a reduced-credit or late deadline. */
  late: boolean;
}

/**
 * Which instants of one item become events — for the `.ics` and the Google
 * Calendar push alike (I66: two copies of this decision had already drifted,
 * the push carrying the late window and the `.ics` dropping it).
 *
 * `dueAt ?? lateDueAt` is the primary: an item with only a reduced-credit
 * deadline is still one thing to do, and hiding it because the full-credit
 * window is unknown would be the silent empty at the row level.
 *
 * The late leg exists only when both instants are stated *and differ*: a source
 * that repeats the same time in both fields would otherwise put two identical
 * events on the same slot.
 */
export function exportLegs(item: Item): ExportLeg[] {
  const primary = item.dueAt ?? item.lateDueAt;
  if (primary === undefined) return [];
  const out: ExportLeg[] = [{ key: item.id, instant: primary, late: item.dueAt === undefined }];
  if (item.dueAt !== undefined && item.lateDueAt !== undefined && item.lateDueAt !== item.dueAt) {
    out.push({ key: `${item.id}#late`, instant: item.lateDueAt, late: true });
  }
  return out;
}

/**
 * "CS 357: HW3", with the course named as every other surface names it —
 * `courseLabel` resolves the student's rename, then the display form.
 * `Item.title` is already the renamed row title (`buildItem`).
 */
export function eventSummary(item: Item, courseNames: Record<string, string> = {}): string {
  const label = item.courseLabel ? courseLabel(item.courseLabel, courseNames) : "";
  return label ? `${label}: ${item.title}` : item.title;
}

function event(item: Item, leg: ExportLeg, stamp: string, courseNames: Record<string, string>): string[] {
  const instant = leg.instant;
  let end: string;
  let start: string;
  try {
    end = icsTimestamp(instant);
    start = icsTimestamp(new Date(Date.parse(instant) - EVENT_MINUTES * 60_000).toISOString());
  } catch {
    return [];
  }

  const summary = eventSummary(item, courseNames);
  const description = [
    item.kind === "booking" ? "Not booked — reserve a seat." : undefined,
    // The same sentence the Google Calendar push writes on its late leg.
    leg.late ? LATE_LEG_NOTE : undefined,
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
    // The primary leg's key is `item.id`, so its UID is what it always was.
    `UID:${leg.key}@illini-dash`,
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
export function buildIcs(
  items: Item[],
  now: Date = new Date(),
  courseNames: Record<string, string> = {},
): string {
  const stamp = icsTimestamp(now.toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//illini-dash//EN",
    "CALSCALE:GREGORIAN",
    ...items.flatMap((item) => exportLegs(item).flatMap((leg) => event(item, leg, stamp, courseNames))),
    "END:VCALENDAR",
  ];
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

/**
 * §8.3: a Google Calendar template link. No OAuth, no scopes, no consent
 * screen — it opens a prefilled "create event" page the student confirms.
 */
export function googleCalendarUrl(
  item: Item,
  courseNames: Record<string, string> = {},
): string | undefined {
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
    text: eventSummary(item, courseNames),
    dates,
    // `details` is required by URLSearchParams to be a string, and a row with no
    // link has nothing to put there but the note.
    details: item.timeAssumed
      ? `${item.url ?? ""}\n\n${assumedTimeNote(item, "allDay")}`.trimStart()
      : (item.url ?? ""),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

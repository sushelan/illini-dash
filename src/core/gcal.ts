/**
 * What goes on the Google Calendar, and what changed since last time (§8.3).
 *
 * Pure: no `chrome`, no `fetch`, no clock except the one handed in. Every
 * decision about *which* deadlines become events and *what* those events say
 * lives here, so it can be pinned by a test and mutated (worker rule 1). The
 * HTTP is `gcal-client.ts`; the wiring is `background.ts` and does no deciding.
 *
 * The complaint that started this: a finished deadline still occupying a slot
 * in Google Calendar. The popup strikes finished work through, and a calendar
 * app has no strikethrough — so a row the student ticked, or one Gradescope
 * reports graded, is *deleted* from the calendar rather than dimmed.
 */

import { isItemDone, isTickedDone } from "./dedupe.js";
import { icsDate } from "./ics.js";
import { courseLabel, nameList } from "./names.js";
import {
  GCAL_TIMEZONE,
} from "./gcal-config.js";
import type { Item, Settings, Source } from "../sources/types.js";

/** §8.3: a 15-minute event ending at the deadline. Same as the `.ics`. */
export const EVENT_MINUTES = 15;

/**
 * The extended-property key every event this extension writes carries.
 *
 * Google caps a private extended-property key at 44 characters and its value at
 * 1024. This is 12 and the value is an item id (a sha1 hex string, 40) plus at
 * most `#late` — so both caps hold by construction, and `eventBody` asserts it
 * rather than trusting the arithmetic to stay true if `itemId` ever changes.
 */
export const ILLINI_DASH_ID = "illiniDashId";
const MAX_PROPERTY_KEY = 44;
const MAX_PROPERTY_VALUE = 1024;

/** Google's own cap: at most five reminder overrides, each under 4 weeks. */
export const MAX_REMINDERS = 5;
export const MAX_REMINDER_MINUTES = 40_320;

/** The sentence the `.ics` and the template link already use, word for word. */
export const TIME_ASSUMED_SENTENCE =
  "The course site gives no time; check the course page for the real cutoff.";

export type EventTime = { dateTime: string; timeZone: string } | { date: string };

export interface ProjectedEvent {
  /** The `illiniDashId` value: `<item.id>` or `<item.id>#late`. */
  key: string;
  itemId: string;
  summary: string;
  description: string;
  start: EventTime;
  end: EventTime;
  reminders: { useDefault: false; overrides: { method: "popup"; minutes: number }[] };
  /**
   * Everything above, in one comparable string.
   *
   * The whole point of the feature not costing a request per deadline per sync:
   * an item whose hash matches the one stored beside its event id is not sent
   * at all. It covers the fields we write and nothing else, so a change Google
   * makes on its own side (a colour, an etag) cannot look like a change of ours.
   */
  hash: string;
}

/** A calendar day, `2026-09-18`, in the *local* zone — see `icsDate`. */
function calendarDate(iso: string): string {
  // Derived from `icsDate` rather than re-implemented: it already owns the
  // "local calendar day, not UTC" decision, and the reason that decision exists
  // (an invented 23:59 Central is the next day in UTC, so a UTC slice files
  // every timeless course-site deadline a day late) applies identically here.
  const compact = icsDate(iso);
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

/** The day after, as a DATE. Google's all-day `end.date` is exclusive. */
function calendarDayAfter(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`not a date: ${iso}`);
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return calendarDate(next.toISOString());
}

/**
 * Minutes before the event for each configured lead.
 *
 * Derived from the same `settings.leadTimes` the notifications use, so a
 * student who set one lead gets one popup rather than Google's default ten
 * minutes on top of whatever this extension already said. Clamped to Google's
 * caps and de-duplicated, because a body it rejects fails the whole push and
 * takes every other event with it.
 */
export function reminderOverrides(settings: Settings): { method: "popup"; minutes: number }[] {
  const minutes = new Set<number>();
  for (const lead of settings.leadTimes ?? []) {
    const n = lead === "24h" ? 24 * 60 : lead === "2h" ? 120 : undefined;
    if (n === undefined) continue;
    if (n > MAX_REMINDER_MINUTES) continue;
    minutes.add(n);
  }
  return [...minutes]
    .sort((a, b) => b - a)
    .slice(0, MAX_REMINDERS)
    .map((m) => ({ method: "popup" as const, minutes: m }));
}

/**
 * FNV-1a over the event's own fields.
 *
 * A hash rather than a deep compare because it is what gets *stored*: the diff
 * runs against `store.gcal.byItemId`, which holds one short string per event,
 * and a stored copy of every event body would be the item list a second time.
 */
export function hashEvent(parts: unknown): string {
  const text = JSON.stringify(parts);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function describeSources(item: Item): string | undefined {
  const sources = [...new Set(item.members.map((member) => member.source as Source))];
  if (sources.length === 0) return undefined;
  return `From ${nameList(sources)}.`;
}

interface Leg {
  key: string;
  instant: string;
  late: boolean;
}

/**
 * Which instants of one item become events.
 *
 * `dueAt ?? lateDueAt` is the primary, exactly as the `.ics` and the template
 * link already choose it — an item with only a reduced-credit deadline is still
 * one thing to do, and hiding it because the full-credit window is unknown
 * would be the silent empty at the row level.
 *
 * The late leg exists only when both instants are stated *and differ*: a source
 * that repeats the same time in both fields would otherwise put two identical
 * events on the same slot, which is exactly the clutter this feature is for.
 */
function legs(item: Item): Leg[] {
  const primary = item.dueAt ?? item.lateDueAt;
  if (primary === undefined) return [];
  const out: Leg[] = [{ key: item.id, instant: primary, late: item.dueAt === undefined }];
  if (item.dueAt !== undefined && item.lateDueAt !== undefined && item.lateDueAt !== item.dueAt) {
    out.push({ key: `${item.id}#late`, instant: item.lateDueAt, late: true });
  }
  return out;
}

/**
 * Whether this deadline belongs on a calendar at all.
 *
 * Four exclusions, each for its own reason:
 * - **hidden** — the student said they do not want to see it, and a calendar
 *   they cannot see into from here is the worst place for a row they hid.
 * - **booking** — §4.4's "reserve a seat" nag is a task, not a time: it has a
 *   window rather than an instant, and an event at the end of the window would
 *   read as the exam.
 * - **finished** — `isItemDone` (every source says submitted or graded) or
 *   `isTickedDone` (the student ticked it and no source contradicts). This is
 *   the whole complaint: a done deadline still occupying a slot.
 * - **no instant** — nothing to put on a calendar. `legs` answers that.
 */
export function shouldProject(item: Item): boolean {
  if (item.hidden) return false;
  if (item.kind === "booking") return false;
  if (isItemDone(item) || isTickedDone(item)) return false;
  return legs(item).length > 0;
}

/**
 * Every deadline that belongs on the calendar, as an event.
 *
 * `courseNames` is the student's own renames: the calendar is read weeks later
 * and far from the popup, so "Distributed Systems: HW1" has to be what it says
 * there too rather than `CS424`.
 */
export function projectEvents(
  items: readonly Item[],
  settings: Settings,
  courseNames: Record<string, string> = {},
): ProjectedEvent[] {
  const reminders = { useDefault: false as const, overrides: reminderOverrides(settings) };
  const out: ProjectedEvent[] = [];

  for (const item of items) {
    if (!shouldProject(item)) continue;
    const label = item.courseLabel ? courseLabel(item.courseLabel, courseNames) : "";
    const summary = label ? `${label}: ${item.title}` : item.title;

    for (const leg of legs(item)) {
      let start: EventTime;
      let end: EventTime;
      try {
        if (item.timeAssumed) {
          // §4.5's invented 23:59 must never become a timed event. A calendar
          // entry at 11:59 PM looks more authoritative than a row in a popup,
          // and it is the one the student will still be trusting in three
          // weeks (worker rule 3: a value this code invented is not one the
          // source stated).
          start = { date: calendarDate(leg.instant) };
          end = { date: calendarDayAfter(leg.instant) };
        } else {
          const endMs = Date.parse(leg.instant);
          if (Number.isNaN(endMs)) throw new Error(`not a date: ${leg.instant}`);
          start = {
            dateTime: new Date(endMs - EVENT_MINUTES * 60_000).toISOString(),
            timeZone: GCAL_TIMEZONE,
          };
          end = { dateTime: new Date(endMs).toISOString(), timeZone: GCAL_TIMEZONE };
        }
      } catch {
        // A row whose instant will not parse is dropped from the calendar and
        // nothing else: it is still in the popup, where its unreadable date is
        // already shown as such.
        continue;
      }

      const description = [
        leg.late ? "Reduced-credit deadline." : undefined,
        item.timeAssumed ? TIME_ASSUMED_SENTENCE : undefined,
        item.url,
        describeSources(item),
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n");

      out.push({
        key: leg.key,
        itemId: item.id,
        summary,
        description,
        start,
        end,
        reminders,
        hash: hashEvent([summary, description, start, end, reminders]),
      });
    }
  }
  return out;
}

/** What `gcal-client.ts` posts. Separated so the shape is pinnable without HTTP. */
export function eventBody(event: ProjectedEvent): Record<string, unknown> {
  if (ILLINI_DASH_ID.length > MAX_PROPERTY_KEY) {
    throw new Error(`${ILLINI_DASH_ID} is longer than Google's ${MAX_PROPERTY_KEY}-character key cap`);
  }
  if (event.key.length > MAX_PROPERTY_VALUE) {
    throw new Error(`${event.key} is longer than Google's ${MAX_PROPERTY_VALUE}-character value cap`);
  }
  return {
    summary: event.summary,
    description: event.description,
    start: event.start,
    end: event.end,
    reminders: event.reminders,
    extendedProperties: { private: { [ILLINI_DASH_ID]: event.key } },
  };
}

export interface RemoteEvent {
  eventId: string;
  hash: string;
}

export interface EventDiff {
  inserts: ProjectedEvent[];
  patches: { eventId: string; event: ProjectedEvent }[];
  /** `key` is carried so the caller can forget the entry it just deleted. */
  deletes: { eventId: string; key: string }[];
}

/**
 * What to send, given what is already there.
 *
 * `remoteIndex` is `store.gcal.byItemId` — an event id and the hash of the body
 * this extension last wrote to it. An item whose hash is unchanged produces no
 * request at all, which is what makes a push after every sync (and after every
 * hide and tick) affordable.
 *
 * A key in the index that is not in `projected` is a delete, and that is how a
 * finished, hidden or vanished deadline leaves the calendar. There is no fourth
 * branch: anything the index does not know about is not ours to touch, which is
 * the promise the `calendar.app.created` scope already makes structurally.
 */
export function diffEvents(
  projected: readonly ProjectedEvent[],
  remoteIndex: ReadonlyMap<string, RemoteEvent>,
): EventDiff {
  const diff: EventDiff = { inserts: [], patches: [], deletes: [] };
  const wanted = new Set<string>();

  for (const event of projected) {
    wanted.add(event.key);
    const remote = remoteIndex.get(event.key);
    if (remote === undefined) {
      diff.inserts.push(event);
    } else if (remote.hash !== event.hash) {
      diff.patches.push({ eventId: remote.eventId, event });
    }
  }

  for (const [key, remote] of remoteIndex) {
    if (!wanted.has(key)) diff.deletes.push({ eventId: remote.eventId, key });
  }

  // Deterministic, so a test can assert a list rather than a set and so the
  // log line reads the same way twice.
  diff.inserts.sort((a, b) => a.key.localeCompare(b.key));
  diff.patches.sort((a, b) => a.event.key.localeCompare(b.event.key));
  diff.deletes.sort((a, b) => a.key.localeCompare(b.key));
  return diff;
}

/** How many requests a diff will cost. For the log line, and for the chip. */
export function diffSize(diff: EventDiff): number {
  return diff.inserts.length + diff.patches.length + diff.deletes.length;
}

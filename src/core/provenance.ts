/**
 * Where a row's date came from, and what may therefore be said about it.
 *
 * Worker house rule 3 — "a value this code invented is not a value the source
 * stated" — has a twin that cost two live reports on 2026-09-19, both on rows
 * Sushi had typed himself:
 *
 *   - the deadline screen headed his own edit **"Moved by an announcement"**,
 *     and
 *   - the assumed-time marker told him **"The course site gives a date but no
 *     time. Check the course page for the cutoff"** about a row that has no
 *     course site, no URL and no source but him.
 *
 * Both sentences were constants. A constant cannot be wrong about one row and
 * right about another, so the moment a second producer appeared the sentence
 * started asserting something no fact behind it supported — which is worker
 * rule 2's generalisation ("anything the UI asserts must be derived from an
 * attempt that happened") one surface over.
 *
 * So the sentences live here, keyed off the item, in `core` where a test can
 * mutate them (worker rule 1). The four surfaces that used to spell the
 * assumed-time sentence out — the row, the deadline screen, the `.ics` export
 * and the Google Calendar push — now ask one function, which is the
 * `resolveColumn` finding from the mutation house rules: one decision, one
 * copy, so loosening it cannot be masked by a second copy staying strict.
 *
 * Nothing here imports `grouping` or `suggest`: both import *this*, and the
 * move-range formatter has to be the one they share.
 */

import type { Item } from "../sources/types.js";
import { STUDENT_POST_ID } from "./overrides.js";

/**
 * A row the student typed, and only that.
 *
 * One `manual` member and no others. A merged row — a typed deadline that also
 * arrived from Gradescope — is *not* the student's own for this purpose: it has
 * a course site, and the course-site sentence is the true one for it.
 *
 * `soleManualMember` in `src/ui/popup/shell.ts` decides the same thing for the
 * row menu's Edit / Delete. That is a second copy and should delegate here; the
 * lane that owns `shell.ts` has the diff.
 */
export function isStudentsOwn(item: Item): boolean {
  return item.members.length === 1 && item.members[0]!.source === "manual";
}

/* -------------------------------------------------------------------------- */
/* "the time is ours, not theirs"                                              */
/* -------------------------------------------------------------------------- */

/** The row and the deadline screen: a tooltip beside "end of day". */
export const SOURCE_TIME_NOTE =
  "The course site gives a date but no time. Check the course page for the cutoff.";
/** The same fact inside an exported event, which is read far from the popup. */
export const SOURCE_TIME_NOTE_ALL_DAY =
  "The course site gives a date but no time. This is filed as an all-day event; check the course page for the real cutoff.";
/** Sushi's own words for his own row: there is no page to go and look at. */
export const OWN_TIME_NOTE = "No time specified.";
export const OWN_TIME_NOTE_ALL_DAY = "No time specified. This is filed as an all-day event.";

/**
 * Why this instant carries a 23:59 nobody stated.
 *
 * `allDay` is for the two exports, which file an assumed instant as an all-day
 * event and have to say so in the event itself — the popup that could have
 * explained it is not there when the calendar entry is read.
 *
 * Only ever called for `item.timeAssumed`; it does not test the flag itself,
 * because three of the five call sites are already inside that branch and the
 * fourth builds a string with it.
 */
export function assumedTimeNote(item: Item, form: "short" | "allDay" = "short"): string {
  if (isStudentsOwn(item)) return form === "allDay" ? OWN_TIME_NOTE_ALL_DAY : OWN_TIME_NOTE;
  return form === "allDay" ? SOURCE_TIME_NOTE_ALL_DAY : SOURCE_TIME_NOTE;
}

/* -------------------------------------------------------------------------- */
/* "who moved it"                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The four things that can put a deadline somewhere other than where the
 * student last saw it.
 *
 * `Item.movedBy` names a *correction* — a post, or "Give it a date" — and
 * survives until it is undone. `Item.movedFrom` is derived per sync and says
 * only *that* the instant changed since the last list; it carries no author at
 * all, which is precisely why it must not borrow the announcement's heading.
 */
export type DateOrigin = "student-override" | "announcement" | "student-edit" | "source-change";

const HEADING: Record<DateOrigin, string> = {
  "student-override": "You set this date",
  announcement: "Moved by an announcement",
  // A row with one `manual` member has exactly one author, and it is not a
  // course: the only way its instant can differ from last sync's is an edit.
  "student-edit": "You changed this date",
  "source-change": "The source now gives a different date",
};

export function dateOrigin(item: Item): DateOrigin | undefined {
  if (item.movedBy) {
    return item.movedBy.postId === STUDENT_POST_ID ? "student-override" : "announcement";
  }
  if (item.movedFrom === undefined) return undefined;
  return isStudentsOwn(item) ? "student-edit" : "source-change";
}

/** The heading over the move block, from the fact rather than from the block. */
export function movedHeading(item: Item): string | undefined {
  const origin = dateOrigin(item);
  return origin === undefined ? undefined : HEADING[origin];
}

/**
 * Re-parsing shifts an instant by a second; a deadline that moved never moves
 * by less than a minute. The same tolerance `dedupe` records a move with.
 */
const MOVE_TOLERANCE_MS = 60_000;

/**
 * "Fri, Oct 2 → Mon, Oct 5", or the clock when both ends are the same day.
 *
 * Day-only was right while the only producer was a course granting an
 * extension, which moves a deadline by days. It is wrong the moment the student
 * is a producer: editing their own 11 AM to 5 PM rendered **"moved Sat, Sep 19
 * → Sat, Sep 19"**, a move block reporting no move, which is noise in the place
 * the student goes to find out what changed.
 *
 * `undefined` when the two ends are the same moment — there is nothing to
 * report, and reporting it anyway is the same defect one step smaller.
 */
export function movedRange(from: Date, to: Date): string | undefined {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return undefined;
  if (Math.abs(to.getTime() - from.getTime()) < MOVE_TOLERANCE_MS) return undefined;
  const day = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const clock = (date: Date) =>
    date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  // `toDateString` rather than comparing the formatted day: two days in
  // different years format identically ("Sat, Sep 19") and are not the same day.
  if (from.toDateString() === to.toDateString()) {
    return `${day(from)}, ${clock(from)} → ${clock(to)}`;
  }
  return `${day(from)} → ${day(to)}`;
}

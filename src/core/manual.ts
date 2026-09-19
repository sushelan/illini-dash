/**
 * The `manual` source: deadlines the student types in (§3, §5.3).
 *
 * Pure, and in `core` rather than in the editor page or the worker, because
 * every line below is a *decision* — what counts as a date, what a blank time
 * means, whether a link is safe to open — and worker house rule 1 says a
 * decision belongs where the suite can mutate it. The UI's job is to collect
 * strings and show what this throws.
 *
 * Two properties are load-bearing and easy to lose:
 *
 * 1. **A manual row is a `RawItem` like any other.** It carries a memberKey, so
 *    hide / done / split / merge work on it unchanged, and it can merge with a
 *    Gradescope row for the same work. Nothing downstream needs a second code
 *    path for hand-typed deadlines.
 * 2. **A time nobody stated is marked as invented.** A blank time becomes 23:59
 *    with `extra.timeAssumed = "true"`, exactly as §4.5's adapter runner does —
 *    so §5.3 ranks a real deadline above it, the `.ics` export writes an all-day
 *    event rather than a hard 11:59 PM, and §7 never reads a clock the student
 *    did not give out loud (worker house rule 3).
 */

import { extractCourseCode } from "./normalize.js";
import { wallClockToIso } from "./dates.js";
import type { Kind, RawItem } from "../sources/types.js";

/** What the editor collects. Every field is a string the student typed. */
export interface ManualInput {
  title: string;
  courseRaw: string;
  /**
   * `YYYY-MM-DD`, in `zone`. Blank or absent means "no date yet".
   *
   * Optional since the editor grew a **No date yet** toggle (brief D11). A
   * student who knows a thing exists and not when it is due had two options
   * before: guess a date, which puts an invented deadline on the calendar and
   * fires a reminder for it, or not record it at all. Both are worse than a row
   * in the No date tab, which is where every *source* row in that position
   * already sits — and giving it a date later is an ordinary edit, so the hide,
   * the tick and the merge survive it (`editManualItem` keeps the `sourceId`).
   */
  /**
   * The course code the *source* stated, when it stated one.
   *
   * Optional, and only ever set by `acceptSuggestion`: the editor collects a
   * name, not a code. A Piazza or Campuswire class is addressed by its display
   * name, which need not carry a code at all — a class called "Distributed
   * Systems" whose `courseCodes` held `CS425` used to produce an accepted row
   * with no `courseCode`, and `sameCourse` (codes on one side only → false) can
   * never merge that with the student's CS 425 rows, nor can the Merge picker
   * offer it. So a code the source knew is carried through rather than
   * re-derived from a name that never had it.
   *
   * Preferred over `extractCourseCode(courseRaw)` when present: it is stated,
   * and the derivation is a guess at the same thing (worker house rule 3, the
   * general form — a value this code invented never outranks one a source gave).
   */
  courseCode?: string;
  date?: string;
  /** `HH:MM`, 24-hour, in `zone`. Blank means "no time was given". */
  time?: string;
  /** `HH:MM`, for work that occupies a span — an exam sitting, a lab. */
  endTime?: string;
  kind?: Kind;
  url?: string;
  note?: string;
}

/**
 * A refusal the student reads, not a `ParseError`.
 *
 * `ParseError` means "a page changed shape, go fix the selectors" and drives
 * §6's `parse_error` state. Nothing about a mistyped date is a source failing,
 * and reporting it as one would put a red dot on a source that is working. The
 * message is the whole UI for the error, so it says what to do, not what was
 * violated.
 */
export class ManualItemError extends Error {
  override readonly name = "ManualItemError";
}

/** §3's `Kind`s, as a value, so an unknown one is refused rather than stored. */
const KINDS: readonly Kind[] = ["assignment", "quiz", "exam", "booking", "event", "other"];

/**
 * Anchored, not `Date.parse` (house rule 5).
 *
 * `Date.parse("2026-09-11")` succeeds and lands at 7pm the previous day in
 * Chicago, and `Date.parse("09/30/2026")` succeeds too, in a different calendar
 * from half the world's. Both ends are anchored, so `2026-09-11T17:00` and
 * `2026-9-11` are refused rather than half-read.
 *
 * Surrounding whitespace is trimmed before this is applied: a pasted date
 * carries some often enough that refusing it would be a puzzle, and trimming
 * cannot turn one date into another.
 */
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** 24-hour wall clock. `24:00`, `7:5` and `09:60` are all refused. */
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** §8.1's row is one line; a 4000-character title is not a title. */
const MAX_TITLE = 200;
const MAX_COURSE = 120;
const MAX_NOTE = 500;

/** The time filled in when the student gave none — §4.5's runner uses the same. */
export const ASSUMED_TIME = { hour: 23, minute: 59 } as const;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * A wall clock in `zone`, as an instant — or a sentence the student can act on.
 *
 * `wallClockToIso` throws a `ParseError` for a date that does not exist, which
 * is the right error for a *page* that printed `Sep 31` and the wrong one here:
 * `ParseError` is §6's "the page changed, go fix the selectors", and nothing
 * about someone typing the 30th of February is a source failing. The message is
 * also unreadable — it names the parts as JSON. Translated at the boundary,
 * which is what this module is.
 */
function instantOf(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  zone: string,
  raw: string,
): string {
  try {
    return wallClockToIso(parts, zone);
  } catch {
    throw new ManualItemError(`There is no such date as ${raw}.`);
  }
}

function parseDate(raw: string): { year: number; month: number; day: number } {
  const match = DATE.exec(raw);
  if (!match) {
    throw new ManualItemError(`Give the date as YYYY-MM-DD, like 2026-09-18 — not "${raw}".`);
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function parseTime(raw: string, label: string): { hour: number; minute: number } {
  const match = TIME.exec(raw);
  if (!match) {
    throw new ManualItemError(`Give the ${label} as HH:MM on a 24-hour clock — not "${raw}".`);
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/**
 * A link the extension is willing to open in a tab.
 *
 * House rule 7 says a `RawItem.url` is https or it is nothing, and that rule
 * does not relax because a person typed the value instead of a page supplying
 * it: `javascript:` in this field would be opened by a click on the row. Refused
 * loudly rather than dropped, because a student who pasted a link and watched it
 * vanish has no way to know why.
 */
function parseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ManualItemError(`That link is not a web address: "${raw.slice(0, 80)}".`);
  }
  if (parsed.protocol !== "https:") {
    throw new ManualItemError(`A link has to start with https:// — "${raw.slice(0, 80)}" does not.`);
  }
  return parsed.toString();
}

/**
 * A day and an optional clock a student typed, as an instant.
 *
 * Exported because two surfaces now collect exactly this — the editor, for a
 * manual row, and "Give it a date" (brief D3), for a *source* row that gets a
 * `DueOverride` instead. Written twice, the second would be the looser one:
 * that is the shape every defect in this file has taken, which is why
 * `fieldsOf` exists at all. One function means "what counts as a date a student
 * typed" has one answer and one set of refusals.
 *
 * `timeAssumed` comes back rather than being folded in, because the two callers
 * store it in different places — `extra.timeAssumed` on a `RawItem`, the
 * `DueOverride.timeAssumed` field on a correction — and both need it for the
 * same reason (worker house rule 3).
 */
/**
 * How far from now a student-typed year may be. A typo'd year (2016 for 2026)
 * takes the row out of every tab — past the overdue window, past the horizon,
 * onto the Month tab a hundred presses away — and nothing prunes it (R3 B3).
 * One year either side covers a school year that straddles December.
 */
export const YEAR_SLACK = 1;

export function statedInstant(
  date: string,
  time: string | undefined,
  zone: string,
  now?: string,
): { at: string; timeAssumed: boolean } {
  const rawDate = text(date);
  const rawTime = text(time);
  const parts = parseDate(rawDate);
  if (now !== undefined) {
    const thisYear = new Date(now).getFullYear();
    if (Math.abs(parts.year - thisYear) > YEAR_SLACK) {
      throw new ManualItemError(
        `${parts.year} is not this school year. Give the date as YYYY-MM-DD, like ${thisYear}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}.`,
      );
    }
  }
  // A blank time is not midnight. §4.5 fills 23:59 for a course page that
  // prints a bare date and marks it assumed; a student who typed only a day is
  // in exactly that position, and the mark is what keeps §5.3 from ranking this
  // invention above a stated Canvas deadline.
  const timeAssumed = rawTime === "";
  const clock = timeAssumed ? ASSUMED_TIME : parseTime(rawTime, "time");
  // `instantOf` rejects a date that does not exist (Feb 30, month 13), so the
  // regex above does not have to know how long a month is.
  return { at: instantOf({ ...parts, ...clock }, zone, rawDate), timeAssumed };
}

/**
 * The fields of a manual row, from validated input.
 *
 * Shared by `newManualItem` and `editManualItem` so that an edit cannot end up
 * with looser rules than a create — which is the shape this defect always takes:
 * the second path is written later, from memory, and forgets one check.
 */
function fieldsOf(
  input: ManualInput,
  now: string,
  zone: string,
): Omit<RawItem, "source" | "sourceId"> {
  const title = text(input.title);
  if (title === "") throw new ManualItemError("Give this deadline a title.");
  if (title.length > MAX_TITLE) {
    throw new ManualItemError(`A title can be at most ${MAX_TITLE} characters.`);
  }

  const courseRaw = text(input.courseRaw);
  if (courseRaw === "") throw new ManualItemError("Say which course this is for.");
  if (courseRaw.length > MAX_COURSE) {
    throw new ManualItemError(`A course name can be at most ${MAX_COURSE} characters.`);
  }

  const kind = input.kind ?? "assignment";
  if (!KINDS.includes(kind)) throw new ManualItemError(`"${String(kind)}" is not a kind of work.`);

  const rawDate = text(input.date);
  const rawTime = text(input.time);
  const rawEnd = text(input.endTime);
  const extra: Record<string, string> = {};
  let dueAt: string | undefined;

  if (rawDate === "") {
    /*
     * No date at all — and therefore no clock either.
     *
     * A time with no day is not a deadline, it is half of one, and there is no
     * honest instant to build from it. Refused rather than dropped: a student
     * who typed 5:00 PM and watched it vanish has no way to know why, which is
     * the same argument `parseUrl` makes about a pasted link.
     *
     * No `timeAssumed` either. That flag says "this instant exists and we
     * invented its clock" (worker house rule 3); there is no instant here, and
     * marking one would hand every downstream reader a date to rank.
     */
    if (rawTime !== "" || rawEnd !== "") {
      throw new ManualItemError("Give this a date, or clear the time as well as the date.");
    }
  } else {
    const stated = statedInstant(rawDate, rawTime, zone, now);
    dueAt = stated.at;
    if (stated.timeAssumed) extra["timeAssumed"] = "true";

    if (rawEnd !== "") {
      const endAt = instantOf(
        { ...parseDate(rawDate), ...parseTime(rawEnd, "end time") },
        zone,
        rawDate,
      );
      // Not `>=`: a span that ends when it starts is a moment, and the student
      // meant one of the two. Saying so is cheaper than storing a zero-length
      // exam sitting that every consumer then has to decide what to do with.
      if (Date.parse(endAt) <= Date.parse(dueAt)) {
        throw new ManualItemError("The end time has to be after the start time.");
      }
      extra["endAt"] = endAt;
    }
  }

  const note = text(input.note);
  if (note.length > MAX_NOTE) {
    throw new ManualItemError(`A note can be at most ${MAX_NOTE} characters.`);
  }
  if (note !== "") extra["note"] = note;

  const url = text(input.url);
  // Stated beats derived. `text` first, so a `""` carried in by an older build
  // cannot shadow the fallback behind it (house rule 5: `typeof x === "string"`
  // is not validation).
  const statedCode = text(input.courseCode);
  const courseCode = statedCode !== "" ? statedCode : extractCourseCode(courseRaw);

  return {
    courseRaw,
    ...(courseCode ? { courseCode } : {}),
    title,
    kind,
    // Omitted rather than set to `undefined`, so a store round trip through
    // JSON cannot turn "no date" into a key that exists and holds nothing.
    ...(dueAt !== undefined ? { dueAt } : {}),
    ...(url !== "" ? { url: parseUrl(url) } : {}),
    // Never `not_submitted`: nothing is watching this row, so the extension
    // cannot know. `unknown` is also what keeps `contradictsDone` quiet, so a
    // manual row the student ticks off stays ticked.
    status: "unknown",
    ...(Object.keys(extra).length > 0 ? { extra } : {}),
    fetchedAt: now,
  };
}

/**
 * The key a manual row keeps for its whole life.
 *
 * Opaque, and deliberately not derived from the title or the date: every
 * override — hidden, done, split, merged — is keyed by `memberKey`, so a key
 * that changed when the student fixed a typo would silently spend all of them.
 * Editing keeps the id for exactly that reason.
 *
 * `memberKey` is `source + ":" + sourceId` and `diagnostics.ts` splits the
 * source back off at the first colon, so an id containing one would corrupt a
 * diagnostics line. A UUID cannot contain one; the check is unreachable today
 * and stays because the generator is the sort of thing that gets swapped.
 */
function newSourceId(): string {
  const id = crypto.randomUUID();
  if (id.includes(":")) throw new ManualItemError("Could not create an id for this deadline.");
  return id;
}

export function newManualItem(input: ManualInput, now: string, zone: string): RawItem {
  return { source: "manual", sourceId: newSourceId(), ...fieldsOf(input, now, zone) };
}

/**
 * The same row, restated.
 *
 * `sourceId` is carried over rather than regenerated, so the edit does not read
 * as a delete and an add: the hide, the tick, the merge and the `notified`
 * record all survive it.
 */
export function editManualItem(
  existing: RawItem,
  input: ManualInput,
  now: string,
  zone: string,
): RawItem {
  return { source: "manual", sourceId: existing.sourceId, ...fieldsOf(input, now, zone) };
}

/**
 * Everything `dedupe` should see.
 *
 * One function with three callers — the sync loop, `withoutRows`, and the
 * worker's `mutate` — because "the manual rows are also items" is a decision,
 * and the caller that forgets it drops every hand-typed deadline off the
 * calendar until the next write that remembers. That failure is silent, which
 * is the one this project ranks worst.
 */
export function dedupeInput(raw: Record<string, RawItem>, manualItems: RawItem[]): RawItem[] {
  return [...Object.values(raw), ...manualItems];
}

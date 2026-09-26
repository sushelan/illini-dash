/**
 * User overrides (§3, §5.3, §8.1's row menu).
 *
 * Pure functions over an `Overrides` record. These are the only way a student
 * can correct the auto-merge, and §9's G3 budget is two corrections a semester —
 * so each one has to stick, and applying one must never quietly undo another.
 */

import type { DueOverride, Item, Overrides, Suggestion } from "../sources/types.js";
import { memberKey } from "../sources/types.js";
import { statedInstant, type ManualInput } from "./manual.js";
import { postUrl } from "./post-link.js";

export function memberKeysOf(item: Item): string[] {
  return item.members.map((member) => memberKey(member.source, member.sourceId));
}

function withoutKeys(groups: string[][], keys: Set<string>): string[][] {
  return groups
    .map((group) => group.filter((key) => !keys.has(key)))
    .filter((group) => group.length >= 2);
}

/**
 * §8.1: hide a row, keyed by its member keys rather than by `Item.id`.
 *
 * `Item.id` is a hash of the sorted member keys, so it changes whenever the
 * group changes — hiding a Gradescope row and then having Canvas mirror it
 * would un-hide it, and the abandoned id would stay armed for the life of the
 * install, silently re-hiding any future group with the same members.
 */
export function hideItem(overrides: Overrides, item: Item): Overrides {
  return {
    ...overrides,
    hiddenKeys: [...new Set([...overrides.hiddenKeys, ...memberKeysOf(item)])],
  };
}

export function unhideItem(overrides: Overrides, item: Item): Overrides {
  const keys = new Set(memberKeysOf(item));
  return { ...overrides, hiddenKeys: overrides.hiddenKeys.filter((key) => !keys.has(key)) };
}

/**
 * The student's own tick, independent of what any source reports.
 *
 * Every member is marked, so a row that later merges with a second source stays
 * done rather than resurrecting — the same reason `hideItem` marks them all.
 */
export function markDone(overrides: Overrides, item: Item): Overrides {
  return {
    ...overrides,
    doneKeys: [...new Set([...overrides.doneKeys, ...memberKeysOf(item)])],
  };
}

export function markNotDone(overrides: Overrides, item: Item): Overrides {
  const keys = new Set(memberKeysOf(item));
  return { ...overrides, doneKeys: overrides.doneKeys.filter((key) => !keys.has(key)) };
}

/**
 * §5.3: pull an item's members apart into singletons.
 *
 * Every member is marked, not just one, because a three-way group split by one
 * key would silently leave the other two merged — and the row the student was
 * complaining about would still be there.
 *
 * Any explicit mergeGroup naming those keys is dropped at the same time, or the
 * split would appear to do nothing: `dedupe` applies mergeGroups after the
 * automatic pass, so a stale group would immediately re-join them.
 */
export function splitItem(overrides: Overrides, item: Item): Overrides {
  const keys = memberKeysOf(item);
  if (keys.length < 2) return overrides;
  const marked = new Set([...overrides.splitKeys, ...keys]);
  return {
    ...overrides,
    splitKeys: [...marked],
    mergeGroups: withoutKeys(overrides.mergeGroups, new Set(keys)),
  };
}

/**
 * §8.1's "Merge with…": force two items into one group.
 *
 * The keys are lifted out of `splitKeys` first. Without that, a student who
 * split a group and then changed their mind would find the merge ignored,
 * because `dedupe` keeps split keys out of the automatic pass — and the
 * explicit group would be fighting a rule they no longer want.
 */
export function mergeItems(overrides: Overrides, a: Item, b: Item): Overrides {
  const keys = [...memberKeysOf(a), ...memberKeysOf(b)];
  if (keys.length < 2) return overrides;

  const involved = new Set(keys);
  // Fold in any existing group that already touches these keys, so repeated
  // merges accumulate into one group rather than several overlapping ones.
  const untouched: string[][] = [];
  for (const group of overrides.mergeGroups) {
    if (group.some((key) => involved.has(key))) for (const key of group) involved.add(key);
    else untouched.push(group);
  }

  return {
    ...overrides,
    splitKeys: overrides.splitKeys.filter((key) => !involved.has(key)),
    mergeGroups: [...untouched, [...involved]],
  };
}

/* -------------------------------------------------------------------------- */
/* Deadlines an instructor's post moved                                        */
/* -------------------------------------------------------------------------- */

/**
 * Record a correction against every member of the item.
 *
 * Every member, exactly as `hideItem` and `markDone` do, and for the same
 * reason: `Item.id` is a hash of the sorted member keys, so a correction keyed
 * by it is spent the moment Canvas mirrors the row — and the instructor's new
 * date would silently revert to the source's old one with nothing on screen to
 * say why.
 */
export function applyDueOverride(overrides: Overrides, item: Item, entry: DueOverride): Overrides {
  const next = { ...overrides.dueOverrides };
  for (const key of memberKeysOf(item)) next[key] = entry;
  return { ...overrides, dueOverrides: next };
}

/**
 * "Give it a date" (brief D3), as a `DueOverride` entry.
 *
 * A source row has no field a student can edit — the next sync overwrites the
 * whole `RawItem` — so the only durable place to put a date they typed is the
 * same correction record an announcement writes. That record already outranks
 * every source in `buildItem`, which is exactly right here: nothing a page said
 * about this row's date was readable, and the student is the authority.
 *
 * **The instant is theirs, so the row leaves the No date group for good.**
 * `unreadableDeadline` returns nothing once `dueAt` is set, and `anchorOf` then
 * places the row on the calendar like any other — that is the whole of the
 * feature, and it falls out of rules that already existed.
 *
 * `timeAssumed` still follows worker house rule 3 rather than the button's
 * name: a student who typed a *day* has stated a day, and the 23:59 is still
 * this code's invention. Marking it keeps §5.3 from ranking the invention above
 * a real deadline a source later reports for the same work, and keeps §7 from
 * announcing a clock nobody said out loud. A student who typed a time gets no
 * mark, and the row is a stated instant like any other.
 *
 * `postId` is a constant rather than an id: nothing reads it back for a
 * correction that came from a person (`movedByText` shows `reason`), and
 * `dueOverrides` is keyed by memberKey, so it has no deduplicating work to do
 * here the way it does for a post.
 */
export const STUDENT_POST_ID = "student";

export function studentDueOverride(
  stated: { date: string; time?: string },
  item: Item,
  zone: string,
  now: string,
): DueOverride {
  const { at, timeAssumed } = statedInstant(stated.date, stated.time, zone, now);
  return {
    at,
    // Only when there was one. "from" drives "moved Tue → Fri"; an item that
    // had no date did not move, it arrived, and `movedByText` already says
    // "now due Fri" for that case.
    ...(item.dueAt !== undefined ? { from: item.dueAt } : {}),
    reason: "you",
    postId: STUDENT_POST_ID,
    appliedAt: now,
    ...(timeAssumed ? { timeAssumed: true } : {}),
  };
}

/**
 * Take the correction back off, by key.
 *
 * Keys rather than an `Item`, because undo is pressed on a row whose members
 * may have changed since the post landed — a merge since then means the item in
 * front of the student holds keys the override was never written to, and
 * `memberKeysOf` on the *current* item is what has to decide, at the call site
 * that has it.
 */
export function undoDueOverride(overrides: Overrides, memberKeys: readonly string[]): Overrides {
  const gone = new Set(memberKeys);
  return {
    ...overrides,
    dueOverrides: Object.fromEntries(
      Object.entries(overrides.dueOverrides).filter(([key]) => !gone.has(key)),
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Suggestions                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The wall clock of an instant in a named zone.
 *
 * `Date#toISOString` would answer in UTC, which is the *next* day for every
 * deadline after 7 PM here — so an 11:59 PM Friday would be filed as Saturday.
 */
function wallClockIn(at: string, zone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/**
 * What to hand `newManualItem` when the student presses Add.
 *
 * Returns the *input*, not the row: `core/manual.ts` owns validation, and a
 * second path that builds a `RawItem` directly is the shape this project's
 * defects take — the later path is written from memory and forgets a check.
 *
 * A suggestion whose time this code invented is passed on with **no time at
 * all**, so `newManualItem` fills in 23:59 and marks it assumed itself. Passing
 * `"23:59"` would launder an invention into a time the student appears to have
 * typed, and §5.3 would then rank it above a real Canvas deadline (worker rule
 * 3).
 */
export function acceptSuggestion(
  suggestions: readonly Suggestion[],
  id: string,
  zone: string,
): { input: ManualInput; suggestions: Suggestion[] } | undefined {
  const suggestion = suggestions.find((candidate) => candidate.id === id);
  if (!suggestion) return undefined;
  const { date, time } = wallClockIn(suggestion.at, zone);
  return {
    input: {
      title: suggestion.title,
      // Never "": `newManualItem` refuses a row with no course, and a
      // suggestion from a post with no course hint would be un-addable — the
      // one outcome a one-click control must not have.
      courseRaw: suggestion.courseRaw || "From a post",
      // The code the post's class *had*, not one re-read out of its name. A
      // class displayed as a bare "Distributed Systems" carries `CS425` here
      // and nothing in `courseRaw`, and without this the accepted row gets no
      // `courseCode` at all — which `sameCourse` treats as "codes on one side
      // only" and refuses to merge, and which the Merge picker never offers.
      // Guarded rather than spread unconditionally: `""` is not a code, and
      // setting it would shadow the derivation in `fieldsOf` behind a value
      // that matches nothing (house rule 5).
      ...(suggestion.courseCode ? { courseCode: suggestion.courseCode } : {}),
      date,
      ...(suggestion.timeAssumed ? {} : { time }),
      // The words the post used, kept on the row. A month later "MP3" in the
      // list and "MP3 is due Fri 10/2" in a note are the difference between
      // trusting the row and re-reading the thread.
      note: suggestion.context.replace(/\s+/g, " ").slice(0, 500),
      /*
       * And the thread itself, as the row's link (2026-09-19).
       *
       * Every other row's `url` is "where this came from", and for a row
       * accepted out of a post that is the post — so "Open ↗" on the deadline
       * screen lands on the sentence the row was read out of rather than
       * nowhere. `postUrl` is https on the source's own origin or it is
       * `undefined` (house rule 7), and `newManualItem` refuses anything else,
       * so a pasted post simply contributes no link. Spread rather than set to
       * `undefined`: `ManualInput.url` is optional and `""` is not a link.
       */
      ...(postUrl(suggestion.postId) ? { url: postUrl(suggestion.postId)! } : {}),
    },
    suggestions: dismissSuggestion(suggestions, id),
  };
}

/** Take a suggestion off the list. The student said no, or said yes. */
export function dismissSuggestion(suggestions: readonly Suggestion[], id: string): Suggestion[] {
  return suggestions.filter((suggestion) => suggestion.id !== id);
}

/** §8.2's per-course checkbox list. Matched on code or on the raw name. */
export function setCourseDisabled(
  overrides: Overrides,
  course: string,
  disabled: boolean,
): Overrides {
  const present = overrides.disabledCourses.includes(course);
  if (disabled === present) return overrides;
  return {
    ...overrides,
    disabledCourses: disabled
      ? [...overrides.disabledCourses, course]
      : overrides.disabledCourses.filter((name) => name !== course),
  };
}

/**
 * Give a course a name, or take the name away.
 *
 * An empty or whitespace-only string **removes** the override rather than
 * storing one, so clearing the box is how a student gets the derived label
 * back. Storing `""` would blank the course everywhere at once and leave
 * nothing on screen to click in order to undo it.
 */
export function renameCourse(overrides: Overrides, key: string, name: string): Overrides {
  const trimmed = name.trim().slice(0, 60);
  const next = { ...overrides.courseNames };
  if (trimmed) next[key] = trimmed;
  else delete next[key];
  return { ...overrides, courseNames: next };
}

/**
 * Give one assignment a name, or take the name away.
 *
 * Written to every member key, like `hideItem`. Empty, or the same as the
 * title the sources give, **removes** the rename rather than storing one — so
 * clearing the box or typing the original back is how a student undoes it, and
 * a rename that says what the source already says is never stored.
 */
export function renameItem(overrides: Overrides, item: Item, title: string): Overrides {
  const trimmed = title.replace(/\s+/g, " ").trim().slice(0, TITLE_NAME_MAX);
  const original = item.sourceTitle ?? item.title;
  const next = { ...(overrides.titleNames ?? {}) };
  for (const key of memberKeysOf(item)) {
    if (trimmed && trimmed !== original) next[key] = trimmed;
    else delete next[key];
  }
  return { ...overrides, titleNames: next };
}

/** Long enough for a real assignment name, short enough to fit a row. */
export const TITLE_NAME_MAX = 120;

export interface CourseSummary {
  /** The value stored in `disabledCourses` — a code when there is one. */
  key: string;
  label: string;
  sources: string[];
  itemCount: number;
  disabled: boolean;
}

/**
 * §8.2: every course seen across every source, for the checkbox list.
 *
 * Built from `raw` rather than from `items`, so a course whose items are all
 * currently hidden or filtered still appears — otherwise a student could not
 * re-enable something they had switched off.
 */
export function courseSummaries(
  raw: Record<string, { courseCode?: string; courseRaw: string; source: string }>,
  overrides: Overrides,
): CourseSummary[] {
  const byKey = new Map<string, CourseSummary>();
  const disabled = new Set(overrides.disabledCourses);

  for (const item of Object.values(raw)) {
    const key = item.courseCode ?? item.courseRaw;
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      existing.itemCount += 1;
      if (!existing.sources.includes(item.source)) existing.sources.push(item.source);
    } else {
      byKey.set(key, {
        key,
        label: item.courseCode ?? item.courseRaw,
        sources: [item.source],
        itemCount: 1,
        disabled: disabled.has(key),
      });
    }
  }

  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

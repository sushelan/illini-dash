/**
 * User overrides (§3, §5.3, §8.1's row menu).
 *
 * Pure functions over an `Overrides` record. These are the only way a student
 * can correct the auto-merge, and §9's G3 budget is two corrections a semester —
 * so each one has to stick, and applying one must never quietly undo another.
 */

import type { DueOverride, Item, Overrides, Suggestion } from "../sources/types.js";
import { memberKey } from "../sources/types.js";
import type { ManualInput } from "./manual.js";

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
      date,
      ...(suggestion.timeAssumed ? {} : { time }),
      // The words the post used, kept on the row. A month later "MP3" in the
      // list and "MP3 is due Fri 10/2" in a note are the difference between
      // trusting the row and re-reading the thread.
      note: suggestion.context.replace(/\s+/g, " ").slice(0, 500),
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

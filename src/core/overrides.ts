/**
 * User overrides (§3, §5.3, §8.1's row menu).
 *
 * Pure functions over an `Overrides` record. These are the only way a student
 * can correct the auto-merge, and §9's G3 budget is two corrections a semester —
 * so each one has to stick, and applying one must never quietly undo another.
 */

import type { Item, Overrides } from "../sources/types.js";
import { memberKey } from "../sources/types.js";

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

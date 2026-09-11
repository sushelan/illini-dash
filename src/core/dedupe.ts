/**
 * Dedupe (§5.3) and retention (§5.4).
 *
 * One deadline usually exists in more than one place: Gradescope assignments
 * reach Canvas through LTI, PrairieLearn assessments reach both. §5.3's job is
 * to present those as one row while never merging two genuinely different
 * deadlines, because a false merge hides a real due date.
 *
 * Pure functions over RawItems, so the whole rule is testable without a store.
 */

import { NUMBERED_PREFIX, isSubsetOf, jaccard, normalizeTitle } from "./normalize.js";
import { shortHash } from "./dates.js";
import type { Item, Overrides, RawItem, Source, Status } from "../sources/types.js";
import { memberKey } from "../sources/types.js";

/** §5.3's title threshold. Raised only with G3 evidence. */
const JACCARD_THRESHOLD = 0.6;
/** §5.3: dated items merge only if their instants are this close. */
const DUE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** §5.3: a subset match needs this many tokens, or "Quiz" would swallow "Quiz 1". */
const MIN_SUBSET_TOKENS = 2;

/**
 * A token that is a course's own label for a piece of work: letters bound to a
 * number, like `hw3`, `lab3`, `mp2`, `q1`, `l4a`.
 *
 * AMENDMENT to §5.3, needed because two spec rules interact badly. §5.2 step 3
 * joins `Lab 3` into the single token `lab3`, and §5.3 then rejects any subset
 * whose smaller side has fewer than two tokens — so the rule refuses both pairs
 * the spec names as its own purpose:
 *
 *   "Lab 3" / "Lab 3 Report"           §5.3: "will merge, which is correct"
 *   "Homework 3" / "HW3 Errors and Big-O"   §4.3: the badge match "is the point"
 *
 * A badge token carries a number, which a bare word does not, so `quiz` still
 * cannot swallow `quiz1 linear algebra`.
 *
 * This is a TRADE, not a free win, and an earlier version of this note wrongly
 * claimed it kept "every protection §5.3 wanted". It does not: the ≥2-token rule
 * also bounded the *larger* side, and dropping it lets `{mp2}` merge into
 * `{mp2, checkpoint}` — a real risk when a course splits one badge across two
 * deliverables. The premise that a badge is unique within a course is also
 * falsified by this repo's own fixture: CS 357 ships both `GA 0` and `GA00`,
 * which §5.2 collapses to the same token.
 *
 * The same-source group check below is what keeps that trade survivable, and
 * §5.3 makes G3 the arbiter of the threshold itself.
 */
const BADGE_TOKEN = new RegExp(`^${NUMBERED_PREFIX.source.replace(/^\^|\$$/g, "")}\\d+[a-z]?$`);

function badgesOf(tokens: Set<string>): string[] {
  return [...tokens].filter((token) => BADGE_TOKEN.test(token));
}

/**
 * §5.3 url/dueAt precedence: the system a student actually submits in owns its
 * own deadline. Canvas dates set by LTI sync are copies, and this account proves
 * why — 66 Canvas rows mirroring PrairieLearn assessments, none of them dated.
 */
const SOURCE_RANK: Record<Source, number> = {
  gradescope: 0,
  prairielearn: 1,
  prairietest: 2,
  // Above `site` and below the other submission systems: smartPhysics is where
  // the work is actually submitted, and it states a real clock time, so its
  // instant is authoritative. It sits under Gradescope and PrairieLearn only
  // because no course uses both for the same item.
  smartphysics: 3,
  site: 4,
  canvas: 5,
};

/** §5.3: "most done" wins, so a Canvas row that has not synced cannot undo it. */
const STATUS_RANK: Record<Status, number> = {
  graded: 0,
  submitted: 1,
  not_submitted: 2,
  missing: 3,
  unknown: 4,
};

function courseCodesOf(item: RawItem): string[] {
  const codes = item.courseCode ? [item.courseCode] : [];
  const alt = item.extra?.["altCodes"];
  if (alt) for (const code of alt.split(" ")) if (code && !codes.includes(code)) codes.push(code);
  return codes;
}

/**
 * §5.1: a match on *any* code counts, for cross-listed courses like
 * `ECE 391 / CS 391`. With no code on either side, fall back to comparing the
 * first 12 characters of `courseRaw` — weak, but those courses rarely appear in
 * more than one source.
 */
export function sameCourse(a: RawItem, b: RawItem): boolean {
  const codesA = courseCodesOf(a);
  const codesB = courseCodesOf(b);
  if (codesA.length > 0 && codesB.length > 0) {
    return codesA.some((code) => codesB.includes(code));
  }
  if (codesA.length > 0 || codesB.length > 0) return false;
  const prefix = (item: RawItem) => item.courseRaw.toLowerCase().slice(0, 12);
  return prefix(a) !== "" && prefix(a) === prefix(b);
}

/** §5.3: both dated and within 24h, or both undated. */
export function datesCompatible(a: RawItem, b: RawItem): boolean {
  if (a.dueAt === undefined && b.dueAt === undefined) return true;
  if (a.dueAt === undefined || b.dueAt === undefined) return false;
  const gap = Math.abs(Date.parse(a.dueAt) - Date.parse(b.dueAt));
  return Number.isFinite(gap) && gap <= DUE_WINDOW_MS;
}

/** §5.3: Jaccard ≥ 0.6, or a subset whose smaller side has ≥ 2 tokens. */
export function titlesCompatible(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;

  // Two titles that each carry a badge and share none are different work, however
  // much description they have in common. Without this the Jaccard path is
  // badge-blind: `Quiz 1: LA + Python + Errors` and `Quiz 10: LA + Python +
  // Errors` score 0.667 and merge — the very pair §5.3 names as proof the rule is
  // safe. That guarantee only ever held on the subset path.
  const badgesA = badgesOf(a);
  const badgesB = badgesOf(b);
  if (badgesA.length > 0 && badgesB.length > 0 && !badgesA.some((t) => badgesB.includes(t))) {
    return false;
  }

  if (jaccard(a, b) >= JACCARD_THRESHOLD) return true;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  if (!isSubsetOf(small, large)) return false;
  if (small.size >= MIN_SUBSET_TOKENS) return true;
  // The amendment above: one badge token is enough, a bare word is not.
  return small.size === 1 && BADGE_TOKEN.test([...small][0]!);
}

/** All four §5.3 conditions. Never merges two rows from the same source. */
export function shouldMerge(
  a: RawItem,
  b: RawItem,
  titleA: Set<string>,
  titleB: Set<string>,
): boolean {
  if (a.source === b.source) return false;
  if (!sameCourse(a, b)) return false;
  if (!datesCompatible(a, b)) return false;
  return titlesCompatible(titleA, titleB);
}

/* -------------------------------------------------------------------------- */
/* Union-find                                                                  */
/* -------------------------------------------------------------------------- */

class UnionFind {
  private readonly parent = new Map<string, string>();

  find(key: string): string {
    const seen: string[] = [];
    let current = key;
    while (this.parent.get(current) !== undefined && this.parent.get(current) !== current) {
      seen.push(current);
      current = this.parent.get(current)!;
    }
    if (this.parent.get(current) === undefined) this.parent.set(current, current);
    for (const node of seen) this.parent.set(node, current);
    return current;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }
}

/* -------------------------------------------------------------------------- */
/* Canonical fields (§5.3)                                                     */
/* -------------------------------------------------------------------------- */

function byPrecedence(members: RawItem[]): RawItem[] {
  return [...members].sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source]);
}

function canonicalStatus(members: RawItem[]): Status {
  return members.reduce<Status>(
    (best, item) => (STATUS_RANK[item.status] < STATUS_RANK[best] ? item.status : best),
    "unknown",
  );
}

/**
 * §5.3 says "Canvas `course_code` if present, else the shortest `courseRaw`".
 * Amended: on this Canvas instance `course_code` is an opaque slug
 * (`cs_357_120268_263847`), so the extracted §5.1 code is used instead and the
 * slug never reaches the UI. See docs/canvas-findings.md.
 */
function canonicalCourseLabel(members: RawItem[]): string {
  const code = members.find((item) => item.courseCode)?.courseCode;
  if (code) return code;
  const labels = members.map((item) => item.courseRaw).filter(Boolean);
  if (labels.length === 0) return "";
  return labels.reduce((shortest, label) => (label.length < shortest.length ? label : shortest));
}

/**
 * §5.3: sha1 of the sorted member keys, so an unchanged group keeps its id — and
 * with it its `notified` record — across syncs.
 *
 * A non-cryptographic 64-bit digest is used instead of sha1: `crypto.subtle` is
 * async, which would make the whole dedupe pass async for no benefit, and this
 * id needs determinism rather than collision resistance against an adversary.
 * The input is recoverable from `members`, so nothing depends on preimages.
 */
export function itemId(memberKeys: string[]): string {
  const joined = [...memberKeys].sort().join("|");
  return `${shortHash(joined)}${shortHash(`${joined}#2`)}`;
}

/**
 * Re-parsing the same page can shift an instant by a second; a deadline the
 * course moved never moves by less than a minute.
 */
const MOVE_TOLERANCE_MS = 60_000;

/** The instant the item is actually counting down to (§4.3, §8.1). */
function effectiveInstant(item: Item): number | undefined {
  const raw = item.dueAt ?? item.lateDueAt;
  if (raw === undefined) return undefined;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * What an item that survived this sync has already fired — and what it must
 * fire again because the deadline underneath it moved.
 *
 * §7 records a lead as fired against a *moment*. When a course grants an
 * extension, that moment stops existing, and keeping the record silences the
 * reminder for the new deadline for good: the 24h lead was spent on Tuesday's
 * date, the deadline is now Friday, and nothing will ever fire again. This is
 * the case the extension is for, and it failed exactly when it mattered.
 *
 * The booking nag is left alone: it repeats daily by design and its `dueAt` is
 * a window start rather than a deadline, so a shifted window is not a lead that
 * was spent on the wrong moment.
 */
function carryNotified(before: Item, item: Item): Item["notified"] {
  const wasAt = effectiveInstant(before);
  const nowAt = effectiveInstant(item);
  const moved =
    wasAt !== undefined && nowAt !== undefined && Math.abs(nowAt - wasAt) > MOVE_TOLERANCE_MS;
  if (!moved) return before.notified;

  const carried = { ...before.notified };
  delete carried["24h"];
  delete carried["2h"];
  // The late-window leads aim at their own instant, and `effectiveInstant`
  // resolves to it once full credit has passed — so a moved late window has to
  // re-arm them for the same reason.
  delete carried["late24h"];
  delete carried["late2h"];

  // Say so in the UI only when the source stated both instants. An assumed
  // 23:59 turning into a real 5 PM is this extension correcting its own
  // placeholder (worker house rule 3), and "moved to 5 PM" would attribute it
  // to the course. The reminders re-arm either way, because either way the
  // moment they were fired for is gone.
  if (!before.timeAssumed && !item.timeAssumed) {
    item.movedFrom = new Date(wasAt!).toISOString();
  }
  return carried;
}

function buildItem(members: RawItem[], hiddenKeys: Set<string>, doneKeys: Set<string>): Item {
  const ranked = byPrecedence(members);
  const keys = members.map((item) => memberKey(item.source, item.sourceId));
  const id = itemId(keys);

  // §5.3: the submission system owns its own deadline, so dueAt and url follow
  // the same precedence rather than being picked independently.
  // §5.3's rank orders sources by whose deadline is authoritative, which assumes
  // every instant is one the source actually stated. A course site that prints
  // "HW1 Due" against a bare date does not state a time, and §4.5's runner fills
  // in 23:59 — so ranking it above Canvas, as SOURCE_RANK rightly does for a
  // site that prints a real time, would let an invented instant overwrite a real
  // one. A member whose time was assumed is therefore the last resort, not the
  // first choice, however high its source ranks.
  const dated =
    ranked.find((item) => item.dueAt !== undefined && item.extra?.["timeAssumed"] !== "true") ??
    ranked.find((item) => item.dueAt !== undefined);
  const late = ranked.find((item) => item.lateDueAt !== undefined);
  const longestTitle = members.reduce((best, item) =>
    item.title.length > best.title.length ? item : best,
  );

  return {
    id,
    members,
    courseCode: ranked.find((item) => item.courseCode)?.courseCode,
    courseLabel: canonicalCourseLabel(ranked),
    title: longestTitle.title,
    // A booking pseudo-item must keep its kind even when merged, since §7 keys
    // the daily nag off it; otherwise the most specific kind wins.
    kind: members.find((item) => item.kind === "booking")?.kind ?? ranked[0]!.kind,
    dueAt: dated?.dueAt,
    // Whether the *winning* member's time was invented, not whether any member's
    // was: a CS 424 row merged with a dated Canvas one has a real instant, and
    // `members.some(...)` would wrongly mark the merged row as assumed.
    timeAssumed: dated?.extra?.["timeAssumed"] === "true" ? true : undefined,
    // §4.3. Only when *every* member says so: one source failing to label a
    // practice quiz is not evidence that it counts, but a row that some source
    // grades really does count, and demoting it would bury real work.
    forCredit: members.every((item) => item.extra?.["forCredit"] === "false") ? false : undefined,
    lateDueAt: late?.lateDueAt,
    url: ranked[0]!.url,
    status: canonicalStatus(members),
    // Hidden when every member is: hiding a row and then having a second source
    // mirror it should keep it hidden, not resurrect it.
    hidden: keys.length > 0 && keys.every((key) => hiddenKeys.has(key)),
    // Every member, like `hidden`: ticking a row off and then having a second
    // source mirror it should keep it done, not resurrect it.
    done: keys.length > 0 && keys.every((key) => doneKeys.has(key)),
    notified: {},
  };
}

/* -------------------------------------------------------------------------- */

export interface DedupeOptions {
  /** Carried across syncs so a group that survives keeps what it already fired. */
  previous?: Item[];
}

/**
 * §5.3: group RawItems into Items, honouring overrides, then §5.4's ordering.
 *
 * Merging is transitive via union-find, so A–B and B–C put all three together.
 * Overrides are applied after: `splitKeys` leave their auto-group and become
 * singletons, `mergeGroups` are unioned in.
 */
export function dedupe(
  raw: RawItem[],
  overrides: Overrides,
  options: DedupeOptions = {},
): Item[] {
  const items = raw.filter((item) => !isCourseDisabled(item, overrides));
  const keys = items.map((item) => memberKey(item.source, item.sourceId));
  const titles = items.map((item) => normalizeTitle(item.title));
  const split = new Set(overrides.splitKeys);

  const union = new UnionFind();
  /** Which sources each component already holds — see the check below. */
  const sourcesOf = new Map<string, Set<Source>>();
  for (let i = 0; i < keys.length; i += 1) {
    union.find(keys[i]!);
    sourcesOf.set(keys[i]!, new Set([items[i]!.source]));
  }

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      // A key the user pulled apart never joins an *automatic* group again.
      // Explicit mergeGroups below still apply, so "split then merge" works.
      if (split.has(keys[i]!) || split.has(keys[j]!)) continue;
      if (!shouldMerge(items[i]!, items[j]!, titles[i]!, titles[j]!)) continue;

      const rootI = union.find(keys[i]!);
      const rootJ = union.find(keys[j]!);
      if (rootI === rootJ) continue;
      const sourcesI = sourcesOf.get(rootI)!;
      const sourcesJ = sourcesOf.get(rootJ)!;
      // §5.3's "never two rows from the same source" is a property of the whole
      // group, not of a pair. Transitivity would otherwise route around the
      // pairwise test: A(gs) merges B(cv), B merges C(cv), and the group ends up
      // holding two Canvas rows — one of whose deadlines becomes unreachable,
      // behind a row that looks like an honest two-source merge.
      if ([...sourcesJ].some((source) => sourcesI.has(source))) continue;

      union.union(keys[i]!, keys[j]!);
      sourcesOf.set(union.find(keys[i]!), new Set([...sourcesI, ...sourcesJ]));
    }
  }

  const present = new Set(keys);
  for (const group of overrides.mergeGroups) {
    const known = group.filter((key) => present.has(key));
    for (let i = 1; i < known.length; i += 1) union.union(known[0]!, known[i]!);
  }

  const groups = new Map<string, RawItem[]>();
  for (let i = 0; i < items.length; i += 1) {
    const root = union.find(keys[i]!);
    const bucket = groups.get(root);
    if (bucket) bucket.push(items[i]!);
    else groups.set(root, [items[i]!]);
  }

  const hidden = new Set(overrides.hiddenKeys);
  const done = new Set(overrides.doneKeys);
  const previousById = new Map((options.previous ?? []).map((item) => [item.id, item]));
  // A split, merge or re-enabled course produces a *new* id for the same work,
  // which would miss the id lookup below, come back with an empty `notified`,
  // and be re-fired immediately by §7. Fall back to what its members fired.
  const firedByMember = new Map<string, Item["notified"]>();
  for (const before of options.previous ?? []) {
    for (const member of before.members) {
      firedByMember.set(memberKey(member.source, member.sourceId), before.notified);
    }
  }

  const built = [...groups.values()].map((members) => {
    const item = buildItem(members, hidden, done);
    // An unchanged group keeps its id, and with it what it has already fired —
    // otherwise every sync would re-notify every item (§5.3, §7).
    const before = previousById.get(item.id);
    if (before) {
      item.notified = carryNotified(before, item);
    } else {
      // Union across members, so a merge does not re-fire either half.
      const inherited: Item["notified"] = {};
      for (const key of members.map((m) => memberKey(m.source, m.sourceId))) {
        Object.assign(inherited, firedByMember.get(key) ?? {});
      }
      item.notified = inherited;
    }
    return item;
  });

  return sortItems(built);
}

/**
 * Undated last, then by instant, then by title so the order is stable.
 *
 * An assumed time sorts after a stated one at the same instant. §4.5's runner
 * puts every timeless course-site row at 23:59, so without this a real 11:59 PM
 * deadline and an invented one interleave by title, and the row the student can
 * actually trust is not the one on top.
 */
export function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    if (a.dueAt === undefined && b.dueAt === undefined) return a.title.localeCompare(b.title);
    if (a.dueAt === undefined) return 1;
    if (b.dueAt === undefined) return -1;
    const gap = Date.parse(a.dueAt) - Date.parse(b.dueAt);
    if (gap !== 0) return gap;
    // §4.3: "the popup sorts them last within their day".
    const credit = Number(a.forCredit === false) - Number(b.forCredit === false);
    if (credit !== 0) return credit;
    const assumed = Number(a.timeAssumed ?? false) - Number(b.timeAssumed ?? false);
    if (assumed !== 0) return assumed;
    return a.title.localeCompare(b.title);
  });
}

/** §8.2's per-course toggle, matched on code or on the raw name. */
function isCourseDisabled(item: RawItem, overrides: Overrides): boolean {
  if (overrides.disabledCourses.length === 0) return false;
  const disabled = new Set(overrides.disabledCourses);
  if (item.courseCode && disabled.has(item.courseCode)) return true;
  return disabled.has(item.courseRaw);
}

/* -------------------------------------------------------------------------- */
/* §5.4 Retention                                                              */
/* -------------------------------------------------------------------------- */

const PURGE_AFTER_DAYS = 60;
/** §5.4: an undated item missing this many syncs was removed at the source. */
const UNDATED_MISSES = 3;

export interface RetentionResult {
  raw: Record<string, RawItem>;
  /** memberKey → consecutive syncs in which it was not seen. */
  misses: Record<string, number>;
  overrides: Overrides;
  purged: string[];
}

/**
 * §5.4: purge raw items more than 60 days past due, and undated items not seen
 * in the last 3 syncs. Overrides referencing purged keys are dropped, or they
 * would accumulate forever and silently re-apply to a future item that happened
 * to reuse the key.
 */
export function applyRetention(
  stored: Record<string, RawItem>,
  seenThisSync: Set<string>,
  misses: Record<string, number>,
  overrides: Overrides,
  now: string,
): RetentionResult {
  const keptRaw: Record<string, RawItem> = {};
  const keptMisses: Record<string, number> = {};
  const purged: string[] = [];
  const nowMs = Date.parse(now);

  for (const [key, item] of Object.entries(stored)) {
    if (item.dueAt !== undefined) {
      const age = nowMs - Date.parse(item.dueAt);
      if (Number.isFinite(age) && age > PURGE_AFTER_DAYS * 86_400_000) {
        purged.push(key);
        continue;
      }
      keptRaw[key] = item;
      continue;
    }

    // Undated: count consecutive absences rather than deleting on the first,
    // so one failed fetch does not purge a course's worth of items.
    const missCount = seenThisSync.has(key) ? 0 : (misses[key] ?? 0) + 1;
    if (missCount >= UNDATED_MISSES) {
      purged.push(key);
      continue;
    }
    keptRaw[key] = item;
    keptMisses[key] = missCount;
  }

  const purgedSet = new Set(purged);
  const survives = (key: string) => !purgedSet.has(key);

  return {
    raw: keptRaw,
    misses: keptMisses,
    purged,
    overrides: {
      ...overrides,
      splitKeys: overrides.splitKeys.filter(survives),
      // Pruned like the rest. Left unpruned, a key for purged work stays armed
      // forever — which is what the docstring above already promised.
      hiddenKeys: overrides.hiddenKeys.filter(survives),
      // Same rule: an unpruned key for purged work stays armed forever and
      // would silently re-tick any future row that reformed the same members.
      doneKeys: overrides.doneKeys.filter(survives),
      mergeGroups: overrides.mergeGroups
        .map((group) => group.filter(survives))
        .filter((group) => group.length >= 2),
    },
  };
}

/**
 * Whether every member of an item is finished.
 *
 * Shared deliberately. A merged Item's `status` is its *most done* member
 * (§5.3), so testing that field alone treats a group as finished while half of
 * it is still outstanding — the defect that hid real deadlines from the popup.
 * §7 must not silence a reminder for the same reason, so both callers use this.
 */
/**
 * Whether a source flatly contradicts the student's own tick.
 *
 * A hand-ticked row that Gradescope later reports as `missing` must come back.
 * Without this the tick is a one-way door: the student says "done", the source
 * says "nothing was submitted", and the extension believes the student —
 * silently, which is the failure §11 calls catastrophic, one level down and
 * with the student's own click as the cause.
 */
export function contradictsDone(item: Item): boolean {
  return item.members.some((member) => member.status === "missing");
}

/** Ticked off by hand, and no source disagrees. */
export function isTickedDone(item: Item): boolean {
  return item.done && !contradictsDone(item);
}

export function isItemDone(item: Item): boolean {
  const done = (status: Status) => status === "submitted" || status === "graded";
  if (item.members.length === 0) return done(item.status);
  return item.members.every((member) => done(member.status));
}

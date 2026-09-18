/**
 * A message from the service worker is data from another build, not a typed
 * object.
 *
 * Chrome reloads an extension page from disk on every open but keeps the
 * running service worker until the extension itself is reloaded, so the two
 * routinely disagree about what a message contains. `options-state` gained
 * `setAsideCourses` in tier 0b.17; an options page from after that change,
 * talking to a worker from before it, read `state.setAsideCourses.length` and
 * threw. The page had already rendered sources, health and adapters, so the
 * result was a half-drawn page, an "Uncaught (in promise)" in the console, and
 * no hint that the fix is one click on chrome://extensions.
 *
 * This is parser house rule 5 one process over: a compile-time type is not
 * validation of something another process sent. The page must render what it
 * was given and say plainly what was missing.
 *
 * Kept in core rather than in `ui/options.ts` because it is a decision, and
 * worker house rule 1 applies to any file the suite cannot reach — the options
 * page is as unreachable as `background.ts`.
 */

import type { Settings } from "../sources/types.js";
import { DEFAULT_SETTINGS } from "./store.js";

/**
 * A field the receiving page dereferences, and the empty value that stands in
 * for it. `list` becomes `[]` and `map` becomes `{}` — both read as "none",
 * which is what the page said before the field existed.
 */
type FieldKind = "list" | "map";

/**
 * A name may be dotted, because the unit the page dereferences is not always a
 * top-level field.
 *
 * `observers` is a map, and a worker from before Piazza sends a perfectly good
 * record — `{campuswire: {…}}` — so the top-level check passed, nothing was
 * reported missing, and the page read `observers.piazza` as `undefined`. That
 * renders as "Off", which is indistinguishable from the student having switched
 * it off, and the switch is live: the click grants the host permission first
 * and only then reaches an old worker, which throws
 * "Cannot set properties of undefined" into the row hint. One key inside a map
 * is the unit here, so the table has to be able to name one.
 */
function pathParts(field: string): string[] {
  return field.split(".");
}

/** The `options-state` fields the options page dereferences. */
const OPTIONS_STATE_FIELDS: Record<string, FieldKind> = {
  courses: "list",
  hiddenItems: "list",
  doneItems: "list",
  setAsideCourses: "list",
  sources: "map",
  courseNames: "map",
  // Added in the same change as the field itself (worker rule 8). The
  // Campuswire row indexes into this to decide what its switch and its state
  // chip say, so a page from after the change talking to a worker from before
  // it would throw in the middle of the sources list.
  observers: "map",
  // The keys inside it, named one by one, because that is the unit the rows
  // dereference: a worker that has never heard of Piazza sends an `observers`
  // that is a record and is missing this, and the row would say "Off" with no
  // banner rather than "reload the extension".
  "observers.campuswire": "map",
  "observers.piazza": "map",
  // Added in the same change as the field itself. The Google Calendar section
  // reads `.enabled`, `.state` and the two `lastPush*` fields off this, and the
  // section is drawn *before* Courses — so a page from after the change talking
  // to a worker from before it would throw with two of eight sections painted.
  // `{}` is the right absence: `describeGcal` reads it as "Off", which is what
  // a worker that has never heard of this feature is in fact doing.
  gcal: "map",
};

/** The `state` fields the popup dereferences. */
const POPUP_STATE_FIELDS: Record<string, FieldKind> = {
  items: "list",
  sources: "map",
  // Every row draws a course label, so a worker on a build without this field
  // would throw once per row rather than once. An empty map is the right
  // absence: no renames, derived labels everywhere.
  courseNames: "map",
  // Added in the same change as the field itself (worker rule 8). The Attention
  // tab reads `.length` on this to draw its count, so a page from after the
  // change talking to a worker from before it would throw *after* drawing the
  // tabs and before drawing the list — the half-painted popup this module
  // exists for.
  suggestions: "list",
};

export interface NormalizedOptionsState<T> {
  /**
   * The message with every field the page reads guaranteed present.
   *
   * Typed as the message type because after this call that type is true. It
   * was not true of the input: that is the entire reason this exists.
   */
  state: T;
  /**
   * Field names the sender did not provide. Empty when the worker is the same
   * build as the page.
   */
  missing: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fill<T>(raw: unknown, fields: Record<string, FieldKind>): NormalizedOptionsState<T> {
  const source = isRecord(raw) ? raw : {};
  const missing: string[] = [];
  const state: Record<string, unknown> = { ...source };
  /**
   * Parents this call had to invent. A key inside one of them is filled in but
   * **not** named: the parent is already in the notice, and "observers,
   * observers.campuswire, observers.piazza" spends the student's attention on
   * one fact written three ways.
   */
  const invented = new Set<string>();

  for (const [field, kind] of Object.entries(fields)) {
    const parts = pathParts(field);
    /*
     * The parent is copied on the way down, so filling a key in does not write
     * into the object the message arrived in — and a parent listed after its
     * child (or not listed at all) cannot undo the fill, because each step
     * reads what the previous one wrote.
     */
    let parent = state;
    let reachable = true;
    for (const step of parts.slice(0, -1)) {
      const next = parent[step];
      if (!isRecord(next)) {
        reachable = false;
        break;
      }
      const copy = { ...next };
      parent[step] = copy;
      parent = copy;
    }
    // An unreachable parent is reported as missing in its own right by its own
    // entry; filling the child under a non-record parent would invent one.
    if (!reachable) continue;
    const leaf = parts[parts.length - 1]!;
    const value = parent[leaf];
    const present = kind === "list" ? Array.isArray(value) : isRecord(value);
    if (present) continue;
    const underInvented = parts
      .slice(0, -1)
      .some((_, index) => invented.has(parts.slice(0, index + 1).join(".")));
    if (!underInvented) missing.push(field);
    invented.add(field);
    parent[leaf] = kind === "list" ? [] : {};
  }

  return { state: state as T, missing };
}

/**
 * Fills in what an older worker did not send to the options page, and reports
 * what that was.
 *
 * `settings` is the one field not simply emptied, because every control on the
 * page is bound to it and an empty object would render five controls in states
 * the user never chose. The shipped defaults are the honest answer there, and
 * the banner says not to trust them.
 */
export function normalizeOptionsState<T>(raw: unknown): NormalizedOptionsState<T> {
  const { state, missing } = fill<Record<string, unknown>>(raw, OPTIONS_STATE_FIELDS);
  const settings = (raw as Record<string, unknown> | undefined)?.["settings"];
  if (isRecord(settings)) {
    // A field added to Settings by a later build is missing here too, so the
    // defaults fill in underneath whatever the worker did send.
    state["settings"] = { ...DEFAULT_SETTINGS, ...settings };
  } else {
    missing.push("settings");
    state["settings"] = { ...DEFAULT_SETTINGS };
  }
  return { state: state as T, missing };
}

/**
 * The same, for the popup's `state` message.
 *
 * The popup already carried a hand-written `response.settings ?? DEFAULT_SETTINGS`,
 * which is this defect found once and patched at one call site. `items` and
 * `sources` are dereferenced immediately after and were never guarded.
 */
export function normalizePopupState<T>(raw: unknown): NormalizedOptionsState<T> {
  const { state, missing } = fill<Record<string, unknown>>(raw, POPUP_STATE_FIELDS);
  const settings = (raw as Record<string, unknown> | undefined)?.["settings"];
  state["settings"] = isRecord(settings) ? { ...DEFAULT_SETTINGS, ...settings } : { ...DEFAULT_SETTINGS };
  return { state: state as T, missing };
}

/**
 * What to tell the user when fields were missing.
 *
 * Names the fields, because "something was missing" is not actionable and the
 * names are the only evidence of *which* build the worker is on. Ends with the
 * fix, because that is the whole point of noticing.
 */
export function staleWorkerNotice(missing: readonly string[]): string {
  return (
    `Illini Dash was updated, but the background part is still running the old ` +
    `version, so some of this page is incomplete (missing: ${missing.join(", ")}). ` +
    `Open chrome://extensions and click Reload on the Illini Dash card, then ` +
    `reopen this page.`
  );
}

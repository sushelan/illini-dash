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

/** The `options-state` fields the options page dereferences. */
const OPTIONS_STATE_FIELDS: Record<string, FieldKind> = {
  courses: "list",
  hiddenItems: "list",
  doneItems: "list",
  setAsideCourses: "list",
  sources: "map",
};

/** The `state` fields the popup dereferences. */
const POPUP_STATE_FIELDS: Record<string, FieldKind> = {
  items: "list",
  sources: "map",
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

  for (const [field, kind] of Object.entries(fields)) {
    const value = source[field];
    const present = kind === "list" ? Array.isArray(value) : isRecord(value);
    if (present) continue;
    missing.push(field);
    state[field] = kind === "list" ? [] : {};
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

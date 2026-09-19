/**
 * Everything the popup's modules share: the document's elements, the keys it
 * remembers things under, and the handful of values that change while it is
 * open.
 *
 * This module imports nothing from its siblings, which is the whole point of
 * it. `popup.ts` was one 3809-line file because every function could reach
 * every other one; split naively, the same reachability becomes a cycle —
 * `shell` needs `refresh`, which lives in the entry, which imports `shell`. So
 * the shared *values* live here, and the few functions that have to be called
 * across the split are late-bound on `app` below.
 *
 * Rendering rule from §8.1, which every module here inherits: every string that
 * came from a source is inserted with `textContent`, never `innerHTML`, and a
 * URL is only made clickable if `safeUrl` accepts it.
 */

import { applyStoredTheme } from "../theme-panel.js";
import { normalizeTweaks, TWEAK_KEYS, type Tweaks } from "../../core/theme.js";
import { dayKey, startOfDay, type ViewName, type WeekMode } from "../../core/calendar.js";
import type { Editor, EditorValues } from "../editor.js";
import type { Item, Source, SourceStatus, Suggestion } from "../../sources/types.js";

/* Before the first paint. See src/ui/theme-panel.ts.
 *
 * At the top of *this* module rather than of the entry: a module body runs
 * after its imports, so anything the entry did first would now happen last. */
applyStoredTheme();

// Set before the first paint so the full view never flashes at popup width.
if (new URLSearchParams(location.search).get("view") === "full") {
  document.documentElement.classList.add("view-full");
  // A tab has a title bar of its own to name; the popup does not.
  document.title = "Illini Dash — everything due";
}

/**
 * §8.1: only render a URL that is https.
 *
 * **AMENDED (2026-09-18).** This used to require `.illinois.edu` or one of the
 * four hosted sources, which was a copy of a rule `validateAdapter` had already
 * dropped: the CS department's course sites are their own domains — cs124.org,
 * cs128.org, cs225.org — and `optional_host_permissions` covers every https
 * host. So an adapter the registry accepts, whose permission the student granted
 * in Chrome's own prompt, produced rows that rendered as unclickable divs. Two
 * copies of one decision, and the stricter copy was the one with no test
 * reaching it (mutation house rule 3).
 *
 * The check that remains is the one that matters: `RawItem.url` is already
 * pinned to its source's origin by `sameOriginHttpsUrl`, so this refuses
 * `javascript:` and `http:` and nothing else needs refusing here.
 *
 * `string | undefined`, because `Item.url` is optional since the `manual`
 * source: a deadline the student typed need not have anywhere to go. Every
 * caller already treats `undefined` as "not a link", so widening the parameter
 * is what keeps that one decision in one place.
 */
export function safeUrl(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:") return url.toString();
  } catch {
    /* fall through */
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* The document                                                                */
/* -------------------------------------------------------------------------- */

export const viewEl = document.getElementById("view")!;
export const tabsEl = document.getElementById("tabs")!;
export const filtersEl = document.getElementById("filters")!;
export const dateNavEl = document.getElementById("nav")!;
export const healthEl = document.getElementById("health")!;
export const actionsEl = document.getElementById("actions")!;
export const bannersEl = document.getElementById("banners")!;
export const statusEl = document.getElementById("status")!;
/** The sticky strip at the foot of the document (D10). */
export const footerEl = document.getElementById("footer")!;

export const isFullView = document.documentElement.classList.contains("view-full");

/**
 * Chrome's own ceiling for a popup, and the number `placeFloating` budgets to.
 *
 * Documented in §8.1 and enforced by the browser: a popup is never taller than
 * this however tall the document is.
 */
export const MAX_POPUP_HEIGHT = 600;

/**
 * The class every floating panel carries, and the only way to ask whether one
 * is open.
 *
 * Written out as a literal in five places once, and **three of them spelled it
 * `.menu`** — which matches nothing, because a class selector matches whole
 * tokens. All three were redraw guards, so all three were dead: a store write
 * or a minute tick deleted an open menu from under the pointer, and since a
 * `click` only fires when mousedown and mouseup land on the same element, the
 * press was swallowed with nothing to show for it.
 *
 * A constant rather than a test. A test would have to know the right answer;
 * this makes the wrong answer unspellable.
 */
export const MENU_SELECTOR = ".menu-surface";
export const MENU_CLASS = MENU_SELECTOR.slice(1);

/* -------------------------------------------------------------------------- */
/* What this window remembers                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Which view is showing, which day it is anchored on, and which courses the
 * student has switched off.
 *
 * Kept in `localStorage` rather than the store: a popup closes on focus loss,
 * so losing the tab on every open would make the calendar unusable, and none of
 * it is worth a round trip to the worker. Every access is guarded because the
 * accessor itself throws in a profile with site data blocked.
 */
export const VIEW_KEY = "illini-dash.view";
export const HIDDEN_KEY = "illini-dash.hiddenCourses";
export const PIN_DISMISSED_KEY = "illini-dash.pinCardDismissed";
export const SYNCING_KEY = "illini-dash.syncing";
export const NAVIGATED_KEY = "illini-dash.navigated";

/**
 * Show the full view, without piling up tabs.
 *
 * The *view* half of the handoff goes through `localStorage`. Both documents
 * are the same extension origin, so writing here fires a `storage` event in an
 * already open tab; a tab that has yet to be created reads `VIEW_KEY` on load
 * instead. Two keys rather than one, because `VIEW_KEY` is written on every
 * ordinary tab change and a full view that followed the popup around would be a
 * surprise.
 */
export const HANDOFF_KEY = "illini-dash.openView";

export function readStored(key: string): string | undefined {
  try {
    return window.localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}
export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* A remembered tab is a convenience, never a requirement. */
  }
}

/* -------------------------------------------------------------------------- */
/* The tabs                                                                    */
/* -------------------------------------------------------------------------- */

export const VIEWS: ViewName[] = ["day", "week", "month", "nodate", "exams"];

/**
 * The names on the strip.
 *
 * D1 renames Day to **Today** and will add `nodate` ("No date") once
 * `core/calendar.ts` carries it; until then `attention` keeps its tab, because
 * dropping it before its replacement exists would lose the only route to the
 * undated rows. The strip is five equal columns either way, so the swap is a
 * line in this table rather than a layout change.
 */
export const VIEW_LABEL: Record<string, string> = {
  day: "Today",
  week: "Week",
  month: "Month",
  nodate: "No date",
  exams: "Exams",
  attention: "Attention",
};

/**
 * Views the 400px popup cannot hold, which open the full view instead.
 *
 * Empty — nothing is full-view-only. The month used to be, on the argument
 * that seven columns need about 100px each, which was an argument about the
 * *pills* rather than about the month: D6's popup month draws a dot per
 * deadline and names them in a list under the grid, so seven columns need
 * about 50px each and the tab fits. The set stays as the mechanism.
 */
export const FULL_VIEW_ONLY: ReadonlySet<ViewName> = new Set<ViewName>();

export function storedView(): ViewName {
  const raw = readStored(VIEW_KEY);
  return VIEWS.includes(raw as ViewName) ? (raw as ViewName) : "day";
}

export function hiddenCourses(): Set<string> {
  const raw = readStored(HIDDEN_KEY);
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : []);
  } catch {
    return new Set();
  }
}

/**
 * The two row tweaks (brief D14), from `localStorage` or their defaults.
 *
 * `normalizeTweaks` owns the fallback, so a key written by a later build or
 * lost to a cleared origin cannot leave a row half-drawn: `readStored` answers
 * `undefined` for a missing key and `undefined` is not `false`, which is the
 * distinction that keeps `showSourceNames` on for a fresh install.
 */
export function readTweaks(): Tweaks {
  return normalizeTweaks({
    urgencyEdge: readStored(TWEAK_KEYS.urgencyEdge),
    showSourceNames: readStored(TWEAK_KEYS.showSourceNames),
  });
}

/**
 * Seven days, starting today. In both windows.
 *
 * This was split — rolling in the popup, Sunday–Saturday in the tab, on the
 * argument that a tab has room for the past half of the week and that a
 * calendar week lines up with every other calendar. Opening the tab on a
 * Saturday settled it: Sunday–Saturday is then six days that have already
 * happened and today, so "this week" was an empty grid and the only way to see
 * anything was to press the forward arrow.
 *
 * That is the same reason the popup went rolling, and it does not get weaker in
 * a bigger window — it gets more visible, because there is room to render all
 * six empty rows. Making both rolling also buys the thing the other option was
 * supposed to: one definition of "week" in both windows.
 *
 * The **month** stays Sunday-first. That one is a grid of calendar weeks and
 * genuinely is a calendar; this is a list of the next seven days.
 */
export const WEEK_MODE: WeekMode = "rolling";

/**
 * Said once, above the rows it applies to.
 *
 * A course site with five bare dates produced five consecutive rows each
 * carrying the same sentence. The fact belongs to the group, not the row.
 *
 * Never "all day": that is the calendar convention and it is wrong here. It
 * tells a student they have until midnight, when the real cutoff may be 5 PM,
 * which is the whole reason this distinction exists.
 */
export const UNTIMED_NOTE =
  "The course site posted a day, not a time — check the page for the cutoff.";

/** How long "Deleted … · Undo" stays on screen. */
export const UNDO_MS = 10_000;

/* -------------------------------------------------------------------------- */
/* What changes while the window is open                                       */
/* -------------------------------------------------------------------------- */

/**
 * One object rather than a dozen module-level `let`s.
 *
 * A `let` cannot be assigned across a module boundary, and these are read in
 * one file and written in another — `view` is set by the tab strip and read by
 * every renderer, `syncing` is set by the footer's button and read by the
 * header's pill. A single mutable record keeps the old single-file semantics
 * exactly, and makes every cross-module write visible as `state.x = …`.
 */
export const state: {
  /** Which tab is showing. */
  view: ViewName;
  /** Whole days from today. The popup always opens on today; ‹ › moves this. */
  dayOffset: number;
  /** Courses the student switched off, from `HIDDEN_KEY`. */
  hidden: Set<string>;
  /** The two per-device row tweaks (D14), re-read when the panel changes one. */
  tweaks: Tweaks;
  /**
   * The student's own names for their courses, refreshed on every draw.
   *
   * Shared rather than threaded through: six render functions each draw one
   * course label, and passing a map through all of them would put the same
   * argument in six signatures to serve one lookup.
   */
  courseNames: Record<string, string>;
  /** All items currently rendered, so "Merge with…" can offer same-course rows. */
  currentItems: Item[];
  /** Deadlines a post stated that nothing in the store accounts for (§4.6). */
  currentSuggestions: Suggestion[];
  /**
   * What the last draw actually found.
   *
   * The first-run screen and the calendar are the same page, and `get-setup`
   * answers before `get-state` — so on the run where setup is still showing,
   * the counts are from whatever the previous draw saw. Undefined until then,
   * which is why `setupSummary` has to keep working without it.
   */
  lastFound: { items: number; courses: number } | undefined;
  /** The last state drawn, so the header can be repainted without a round trip. */
  lastHealth: { sources: Record<Source, SourceStatus>; lastSyncAt?: string } | undefined;
  /**
   * The sub-screen that has taken `#view` over, or nothing.
   *
   * A screen is not a view: `view` is the tab the student chose and is
   * remembered across opens, and a screen sits *in front of* it for one
   * question — so ‹ back is "stop showing this" and the tab comes back with the
   * next redraw, rather than a second copy of the tab-remembering rule.
   *
   * In flow, always (UI rule 8): every screen replaces `#view` rather than
   * floating over it, so Chrome has something to measure.
   */
  /** A sync this page started. */
  syncing: boolean;
  /**
   * A sync started by the worker rather than by this page.
   *
   * The navigation listener fires while the student is on Gradescope, not on
   * this page, so `syncing` above knows nothing about it — and the full view is
   * a tab that stays open through all of it. Without this, that window would
   * keep asserting the pre-sync answer for the whole fetch, which is the defect
   * this screen already had once.
   */
  workerSyncing: boolean;
  /**
   * The sub-screen that has replaced the list, if one has (brief D8, D11).
   *
   * An **id and a tab**, never an `Item`: the screen is re-rendered from the
   * fresh list on every draw (`renderOpenScreen`), so a countdown keeps
   * counting and a row that a sync deleted takes its screen with it rather than
   * leaving a stale copy on screen. The tab is what the screen was opened from
   * — a press on the tab strip while it is open means the student wants the
   * list, so the screen stands down rather than sitting on top of another view.
   */
  screen:
    | { kind: "deadline" | "editor"; itemId?: string; view: ViewName }
    | { kind: "needs-you" }
    | undefined;
  /**
   * The one editor that may be open, and the redraw it is holding off.
   *
   * One at a time by construction: a second "+" pressed while a form is open
   * closes the first. Two forms on screen would each claim the draft box on the
   * day grid, and only one of them could be right about it.
   */
  editor: { handle: Editor; el: HTMLElement } | undefined;
  editorOnClose: (() => void) | undefined;
  redrawAfterEditor: boolean;
  /**
   * A redraw that arrived while a menu was open, and is owed to the list.
   *
   * Six things redraw this page — the popup's own open-sync, a store write, the
   * worker's in-flight flag, the minute tick, `visibilitychange` and a manual
   * sync — and three of them checked for an open menu and *skipped*, while the
   * other three did not check at all and tore the menu down mid-press. Neither
   * is right: a skipped redraw leaves the list stale until the next one, and a
   * redraw under an open menu is how a click lands on the wrong row. So a
   * redraw that finds a menu open is deferred, and `closeMenus` runs it.
   */
  redrawAfterMenu: boolean;
  /**
   * A deletion that can still be taken back, and the fields to rebuild it from.
   *
   * Held here rather than in the banner element, because `renderBanners`
   * replaces its children on every draw — and a sync landing two seconds after
   * a delete would otherwise take the Undo away with it. The banner is
   * re-derived from this on each draw, so it survives every redraw until it
   * expires.
   *
   * The new row gets a new `sourceId`: the delete pruned the old key's
   * overrides (a hide, a tick), and reusing the id would re-arm them against a
   * row the student has just re-created. Undo means "put the deadline back",
   * not "put the corrections back".
   */
  pendingUndo: { title: string; values: EditorValues; until: number } | undefined;
  undoTimer: ReturnType<typeof setTimeout> | undefined;
} = {
  view: "day",
  dayOffset: 0,
  screen: undefined,
  hidden: hiddenCourses(),
  tweaks: readTweaks(),
  courseNames: {},
  currentItems: [],
  currentSuggestions: [],
  lastFound: undefined,
  lastHealth: undefined,
  syncing: false,
  workerSyncing: false,
  editor: undefined,
  editorOnClose: undefined,
  redrawAfterEditor: false,
  redrawAfterMenu: false,
  pendingUndo: undefined,
  undoTimer: undefined,
};

state.view = storedView();
if (!isFullView && FULL_VIEW_ONLY.has(state.view)) state.view = "day";

export const isSyncing = (): boolean => state.syncing || state.workerSyncing;

/** The day the views are anchored on: today, moved by `dayOffset`. */
export function anchorDate(now: Date): Date {
  return startOfDay(now, state.dayOffset);
}

/** The day currently being looked at, as `YYYY-MM-DD`. */
export function viewedDate(): string {
  return dayKey(anchorDate(new Date()));
}

/* -------------------------------------------------------------------------- */
/* Late-bound wiring                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The four things every module needs and none of them can import.
 *
 * `refresh` is owned by the entry — it is the one function that knows how to
 * ask the worker for state and hand it to a view — and every control on the
 * page ends by calling it. `openEditEditor` and `deleteManual` are owed to the
 * row menu, which lives in `shell.ts`, by `screens/editor.ts`, which imports
 * `shell.ts` for `closeMenus`. Both would be import cycles; neither is a
 * decision, so neither needs to be anywhere a test could reach.
 *
 * Assigned once, at the bottom of `popup.ts`. The no-op defaults are what runs
 * if a module is ever loaded on its own, which is only ever a test harness.
 */
export const app: {
  refresh: () => Promise<void>;
  runSync: () => Promise<void>;
  openAddEditor: () => void;
  openEditEditor: (item: Item, member: Item["members"][number]) => void;
  closeEditor: () => void;
  deleteManual: (item: Item, member: Item["members"][number], entry: HTMLElement) => void;
  undoDelete: () => void;
  /** Brief D8: the in-flow deadline screen for one row (screens/deadline.ts). */
  openDeadline: (item: Item) => void;
  /** Brief D3: "Give it a date" — the editor prefilled for a source or manual row. */
  openGiveDate: (item: Item) => void;
  /** Brief D2: the Needs-you screen the header pill opens (screens/needs-you.ts). */
  openNeedsYou: () => void;
  /** …and ‹ back off it, which the pill needs so it can be a toggle. */
  closeNeedsYou: () => void;
} = {
  refresh: () => Promise.resolve(),
  runSync: () => Promise.resolve(),
  openAddEditor: () => undefined,
  openEditEditor: () => undefined,
  closeEditor: () => undefined,
  deleteManual: () => undefined,
  undoDelete: () => undefined,
  openDeadline: () => undefined,
  openGiveDate: () => undefined,
  openNeedsYou: () => undefined,
  closeNeedsYou: () => undefined,
};

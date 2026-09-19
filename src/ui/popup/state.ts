import type { ObserverId, ObserverState } from "../../core/store.js";
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
import type { FocusRequest } from "./focus.js";
import type { Place, ScrollMemory } from "./scroll.js";

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

/**
 * The strip, left to right. **Sources** joined it on 2026-09-19.
 *
 * It is last on purpose: the first four tabs are the student's work and the
 * fifth is this extension's own plumbing — "a source with a button on it sits
 * below the student's own work" (the Alerts note), one level out. It is a tab
 * rather than a panel because a panel in this popup is a thing that opens
 * below the 600px fold, which is UI house rule 8's whole subject.
 */
export const VIEWS: ViewName[] = ["day", "week", "month", "nodate", "exams", "sources"];

/**
 * The names on the strip (brief D1). Day reads as **Today**.
 *
 * **Alerts** was "No Date", and before that the undated half of an Attention
 * tab. It is now the one destination for everything asking the student for
 * something — late work, a post's claim, an undated row, an unreadable date,
 * and a source with a button on it — so it is named for the question rather
 * than for one of the five answers (Sushi, 2026-09-19: "combine no date and
 * needs you in the same tab, pick better names").
 *
 * The **key stays `nodate`**, and that is deliberate. `VIEW_KEY` in
 * `localStorage` holds `"nodate"` for every install that exists, and renaming
 * the member would have to be paid for either by a migration in `storedView`
 * or by dropping every one of those students on Today. A label is a string on
 * screen; a key is a value on disk in a profile this build cannot reach.
 */
export const VIEW_LABEL: Record<ViewName, string> = {
  day: "Today",
  week: "Week",
  month: "Month",
  // Title Case, as the ZIP writes every tab (reference contract: "Active
  // navigation uses ... Title Case").
  nodate: "Alerts",
  exams: "Exams",
  // The health of the four sources and the two observers, expanded. The
  // footer strip's own sentence is the other way in.
  sources: "Sources",
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
 * `normalizeTweaks` owns the parsing, so a key written by a later build or lost
 * to a cleared origin cannot leave a row half-drawn. Both switches are off for a
 * fresh install as of 2026-09-19.
 */
export function readTweaks(): Tweaks {
  return normalizeTweaks({
    urgencyEdge: readStored(TWEAK_KEYS.urgencyEdge),
    // D14, flipped off 2026-09-19 ("there's just too much information being
    // shown"). The toggle stays, so it can be turned back on; only the
    // unset case changes, and `normalizeTweaks` still owns the parsing —
    // `"false"` goes in where nothing is stored rather than a second
    // default living beside `DEFAULT_TWEAKS`.
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
  currentObservers: Partial<Record<ObserverId, ObserverState>>;
  observerMissing: string[];
  /**
   * Where focus should land once the next draw has actually rebuilt the
   * document (see `popup/focus.ts` for the defect this replaces). Written by
   * `requestFocus` before a control asks for a redraw; consumed by the draw
   * that runs, which may be the deferred one after a held press.
   */
  focusAfterDraw: FocusRequest | undefined;
  /**
   * How far down the next draw should scroll, once it has actually rebuilt the
   * document (`popup/scroll.ts`), or `undefined` when no draw is owed one.
   *
   * The same shape as `focusAfterDraw` and for the same reason: a held press
   * defers the draw by a task, so the offset has to be read by the draw that
   * does the replacing and written back by that same draw. Set by `render`
   * just before the first `replaceChildren`; consumed after the footer.
   */
  scrollAfterDraw: number | undefined;
  /** The place the last draw rendered, which is how `scrollPlan` tells a redraw from a navigation. */
  lastPlace: Place | undefined;
  /**
   * The list's offset, kept across a sub-screen so ‹ back returns to the row.
   *
   * One slot, not a history: a tab pressed on the strip is a navigation however
   * long the student spent there before, and a stack of remembered offsets
   * would be four more states to be wrong about (`popup/scroll.ts`).
   */
  scrollMemory: ScrollMemory | undefined;
  /**
   * The last correction the worker refused, kept until the student dismisses
   * it or a later correction succeeds (`core/outcome.ts`).
   *
   * Held here, like `pendingUndo`, because `#status` is rewritten by every
   * draw — and a sync landing 150ms after a refused Hide used to take the
   * refusal with it (I03, 2026-09-19). Re-derived onto the status line on each
   * draw, so it survives every redraw until it is answered.
   */
  actionError: string | undefined;
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
  screen: { kind: "deadline" | "editor"; itemId?: string; view: ViewName } | undefined;
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
   * A redraw that arrived while a mouse button was down on the list.
   *
   * The same rule as `redrawAfterMenu`, one gesture wider, and found the same
   * way: a held press on a row's tick box logged `pointerdown` on the checkbox
   * and `click` on the **row**, because the open-sync's redraw replaced the
   * checkbox between the two. A `click` needs mousedown and mouseup on one
   * element; when the element under the finger is swapped mid-press the event
   * fires on the nearest surviving ancestor instead, so the box did nothing and
   * the row opened the deadline screen.
   *
   * Every harness passed it — a synthetic `.click()` is instantaneous and has
   * no gap for a redraw to land in (UI house rule 5).
   */
  redrawAfterPress: boolean;
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
  currentObservers: {},
  observerMissing: [],
  focusAfterDraw: undefined,
  scrollAfterDraw: undefined,
  lastPlace: undefined,
  scrollMemory: undefined,
  actionError: undefined,
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
  redrawAfterPress: false,
  pendingUndo: undefined,
  undoTimer: undefined,
};

state.view = storedView();
if (!isFullView && FULL_VIEW_ONLY.has(state.view)) state.view = "day";

export const isSyncing = (): boolean => state.syncing || state.workerSyncing;

/**
 * Ask the next *real* draw to focus something (popup/focus.ts).
 *
 * Last writer wins: a control that opens a screen and a redraw that arrives a
 * moment later both describe the same document, and the later request is the
 * one about the document that will actually exist.
 */
export function requestFocus(request: FocusRequest): void {
  state.focusAfterDraw = request;
}

/** The pending request, and there is none afterwards. Only a draw calls this. */
export function takeFocusRequest(): FocusRequest | undefined {
  const request = state.focusAfterDraw;
  state.focusAfterDraw = undefined;
  return request;
}

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
  /**
   * The five-field panel over the list (screens/editor.ts) — every add that
   * starts from a day, including the floating "+".
   */
  openAddEditor: () => void;
  /** The complete form as a screen: the header's "+", and nothing else. */
  openFullAdd: () => void;
  openEditEditor: (item: Item, member: Item["members"][number]) => void;
  closeEditor: () => void;
  deleteManual: (item: Item, member: Item["members"][number], entry: HTMLElement) => void;
  undoDelete: () => void;
  /** Brief D8: the in-flow deadline screen for one row (screens/deadline.ts). */
  openDeadline: (item: Item) => void;
  /** Brief D3: "Give it a date" — the editor prefilled for a source or manual row. */
  openGiveDate: (item: Item) => void;
} = {
  refresh: () => Promise.resolve(),
  runSync: () => Promise.resolve(),
  openAddEditor: () => undefined,
  openFullAdd: () => undefined,
  openEditEditor: () => undefined,
  closeEditor: () => undefined,
  deleteManual: () => undefined,
  undoDelete: () => undefined,
  openDeadline: () => undefined,
  openGiveDate: () => undefined,
};

/* -------------------------------------------------------------------------- */
/* A press in progress                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The "is a mouse button down on the list, and is a redraw owed?" machine.
 *
 * Here, DOM-free and injectable, rather than in `shell.ts`, because the whole
 * defect below is a question of *when* one function is called and the suite
 * cannot reach a service worker or a real press. Worker house rule 1, one
 * process over: `shell.ts` keeps the three `addEventListener` lines and this
 * keeps the decision.
 *
 * **The defect.** A redraw calls `viewEl.replaceChildren()`. A `click` is only
 * dispatched when mousedown and mouseup land on the *same* element, so a redraw
 * between the two deletes the element under the finger and the click fires on
 * the nearest surviving ancestor: pressing a card's tick box logged
 * `pointerdown` on the checkbox and `click` on the **row**, which opened the
 * deadline screen instead of ticking anything.
 *
 * Deferring the redraw to `pointerup` is not enough, and that is the part worth
 * remembering. `pointerup` is dispatched **before** `mouseup`, which is before
 * `click`; a refresh started from the `pointerup` handler is a chain of
 * `await`s, and every one of them resolves in a microtask that runs before the
 * browser gets to dispatch `mouseup`. So the deferred draw wiped the element in
 * exactly the gap the guard existed to protect — measured through Chrome's own
 * input pipeline (`pointerup -> row--tick`, then `mouseup -> MAIN`), with the
 * guard in place and working.
 *
 * So the release waits one **task**, not a microtask and not "the next await" —
 * the same rule the 2026-09-18 menu fix ends on, from the other side. The press
 * is still held for that task, so a redraw arriving between `pointerup` and
 * `click` is held too; there is no window in the gesture where the list can be
 * replaced.
 *
 * @param schedule how to wait one task. `setTimeout(run, 0)` in the page; a
 *   recorder in a test, which is the only way to say "the click has not
 *   happened yet" without a browser.
 */
export function createPressHold(schedule: (run: () => void) => void): {
  begin: (insideList: boolean) => void;
  hold: () => boolean;
  release: (run: () => void) => void;
} {
  let pressing = false;
  let owed = false;
  let releasing = false;
  return {
    begin(insideList: boolean): void {
      pressing = insideList;
      owed = false;
      releasing = false;
    },
    hold(): boolean {
      if (!pressing) return false;
      owed = true;
      return true;
    },
    release(run: () => void): void {
      // `pointerup` and `pointercancel` can both arrive for one gesture, and a
      // second scheduled release would run the owed draw twice.
      if (!pressing || releasing) return;
      releasing = true;
      schedule(() => {
        pressing = false;
        releasing = false;
        if (!owed) return;
        owed = false;
        run();
      });
    },
  };
}

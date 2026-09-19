/**
 * Popup (§8.1). The entry: it asks the worker for state, picks a view, and
 * wires the handful of things that keep an open window honest.
 *
 * Everything it draws lives in `src/ui/popup/`:
 *
 *     state.ts       the document's elements, what it remembers, what changes
 *     shell.ts       header, tabs, banners, status, footer, and every menu
 *     rows.ts        one deadline as a row
 *     views/         day, week, month, exams, attention
 *     screens/       setup, and the add/edit/delete editor
 *
 * This file was 3809 lines. The split is behaviour-preserving by construction —
 * every function moved whole, with the comment that explains it — and the only
 * decisions here are the four this layer actually owns: which view to draw,
 * what to do when the worker cannot answer, when a sync runs, and when the page
 * redraws itself.
 *
 * Rendering rule from §8.1: every string that came from a source is inserted
 * with `textContent`, never `innerHTML`, and a URL is only made clickable if it
 * parses as https. The parsers already enforce the second rule; `safeUrl` is
 * the second line of defence, because this is the layer where getting it wrong
 * is exploitable.
 */

import {
  noDateCount,
  courseColours,
  coursesIn,
  examCount,
  overdueItems,
  visibleItems,
  weekContents,
  type ViewName,
} from "../core/calendar.js";
import { normalizePopupState, staleWorkerNotice } from "../core/compat.js";
import { alertCount, emptyStateFor, sourcesToRecheck, type NavigatedAt } from "../core/health.js";
import { SOURCE_NAME } from "../core/names.js";
import { DEFAULT_SETTINGS, STORAGE_KEY } from "../core/store.js";
import { SYNC_SPINNER_CAP_MS } from "../core/sync.js";
import { send } from "../messages.js";
import type { Item, Settings, Source, SourceStatus } from "../sources/types.js";

import {
  HANDOFF_KEY,
  NAVIGATED_KEY,
  SYNCING_KEY,
  VIEWS,
  VIEW_KEY,
  WEEK_MODE,
  anchorDate,
  app,
  isFullView,
  requestFocus,
  safeUrl,
  state,
  tabsEl,
  takeFocusRequest,
  viewEl,
  writeStored,
} from "./popup/state.js";
import { findFocusTarget, focusRequestFor } from "./popup/focus.js";
import { clampScroll, scrollPlan, type Place } from "./popup/scroll.js";
import {
  drawIsHeld,
  makeRowsNavigable,
  renderHiddenNote,
  renderActions,
  renderBanners,
  renderDateNav,
  renderFooter,
  renderHealth,
  renderTabs,
  showStatus,
  signInUrl,
} from "./popup/shell.js";
import { emptyNote } from "./popup/rows.js";
import { renderTodayView } from "./popup/views/today.js";
import { renderWeekView } from "./popup/views/week.js";
import { renderMonthView } from "./popup/views/month.js";
import { renderExamsView } from "./popup/views/exams.js";
import { renderAlertsView } from "./popup/views/alerts.js";
import { renderSetup } from "./popup/screens/setup.js";
import {
  deleteManual,
  openAddEditor,
  openEditEditor,
  openGiveDate,
  undoDelete,
  closeEditor,
} from "./popup/screens/editor.js";
import { clearScreenMark, openDeadline, renderOpenScreen } from "./popup/screens/deadline.js";

/* -------------------------------------------------------------------------- */
/* Which view, and what it is anchored on                                      */
/* -------------------------------------------------------------------------- */

function navFor(view_: ViewName, now: Date): { label: string; step: number } {
  const anchor = anchorDate(now);
  switch (view_) {
    case "day":
      /*
       * No label and no arrows: the day view has no navigator at all.
       *
       * Today is anchored to now (brief D4), so there is nothing to step; and
       * the date belongs to the folio head `views/today.ts` draws above the
       * bands, which is the page's running head and also carries the item
       * count.
       *
       * The intervening version returned a label here, because the folio was
       * drawn only when the day had something on it (`if (total > 0)`) and a
       * quiet day therefore showed the date nowhere — Sushi, 2026-09-19:
       * "today doesnt even show the date". Putting it in the strip fixed the
       * quiet day and printed the date twice on every other one ("both the
       * popup and fullscreen say the date twice"). The folio is unconditional
       * now, which fixes the quiet day where the date actually lives, and this
       * goes back to having nothing to say.
       *
       * `renderDateNav` draws the strip whenever there is a label, so an empty
       * one is what hides it.
       */
      return { label: "", step: 0 };
    case "week": {
      const days = weekContents([], anchor, now, WEEK_MODE);
      const first = days[0]!.date;
      const last = days[6]!.date;
      const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      /*
       * "Sep 20 – Sep 26", with the month repeated, per the Classical spec §4.
       *
       * This used to collapse to "Sep 14 – 20" inside one month, on the
       * argument that the second month name is only worth its width when it
       * differs. That is a good argument about width and the wrong one about
       * this strip: the range is the page's running head, and a head that
       * changes shape depending on where the month boundary falls reads as two
       * different controls. The spec writes it out, and `renderDateNav` adds
       * the year, so the label is one shape every week of the term.
       */
      return { label: `${fmt(first)} – ${fmt(last)}`, step: 7 };
    }
    case "month":
      return {
        label: anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        // Whole weeks, so ‹ › lands on the same weekday and the grid does not
        // jump by a variable number of days.
        step: 28,
      };
    default:
      return { label: "", step: 0 };
  }
}

/**
 * The element that actually scrolls, in both windows.
 *
 * It is the document in each: the popup is scrolled by Chrome itself, and the
 * full view is an ordinary tab. Neither has an inner scroll container, and
 * neither may grow one — `body { max-height; overflow-y }` is what once opened
 * the popup at 800×600, because a `body` that scrolls itself leaves Chrome no
 * intrinsic height to measure (the note at the top of popup.css). So this is
 * `document.scrollingElement`, which is `<html>` in both, and the fallback is
 * for a document that answers `null` mid-teardown.
 */
function scroller(): HTMLElement | undefined {
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement ?? undefined;
}

/**
 * What this draw is about to render, for `scrollPlan`'s redraw-or-navigation
 * question.
 *
 * It has to be read *before* the replace and so before `renderOpenScreen` says
 * whether the screen actually drew, which means the two conditions under which
 * that function stands a screen down are asked here too:
 *
 *   - **A tab was pressed while the screen was open.** `renderOpenScreen`
 *     drops it (`screen.view !== state.view`) and the list comes back, so this
 *     draw is a *list* draw. Calling it a screen draw left the place reading
 *     `screen:…` for one more draw, and the offset remembered for the list the
 *     screen was opened from then survived the tab press and was handed to the
 *     next visit to that tab — which is the one thing the rule in scroll.ts
 *     says must not happen.
 *   - **The editor.** An open editor holds every draw (`drawIsHeld`), so a
 *     draw that gets here is one where the form has already closed and the
 *     list is what will be drawn. Which also means an editor is never a place:
 *     closing one leaves the offset where it was, since the list either side
 *     of it is the same place.
 *
 * Two readers of one rule rather than two copies of it would be better, and
 * `renderOpenScreen` is another lane's file today (mutation house rule 3 names
 * exactly this shape). Noted in lane-draw.md.
 */
function currentPlace(): Place {
  const screen = state.screen;
  const showing = screen?.kind === "deadline" && screen.view === state.view;
  return {
    view: state.view,
    dayOffset: state.dayOffset,
    screen: showing ? `deadline:${screen.itemId ?? ""}` : undefined,
  };
}

/**
 * Put the window back where `render` found it (popup/scroll.ts).
 *
 * After the footer and before focus: the offset is the coarse answer and an
 * explicit focus request is the fine one, so a row that has *moved* since the
 * offset was taken still gets scrolled into view by `applyFocusRequest` behind
 * this. An implicit request — a redraw nobody asked for — focuses with
 * `preventScroll`, so it cannot undo this.
 *
 * Called only after a draw that actually rebuilt the document. A held draw
 * never set a request, and the deferred draw that `endPress` or `closeMenus`
 * runs reads its own offset and applies its own answer.
 *
 * That last sentence is why the `if (drew)` this sits behind is, **for the
 * scroll half alone, unreachable**: `render` writes `scrollAfterDraw` only
 * after it has passed `drawIsHeld`, and there is no await between that write
 * and this read, so a held draw always finds `undefined` here and returns.
 * Moving this call out of the guard survives the suite (mutation M3, 2026-09-19)
 * and the guard stays anyway, because the same `drew` is load-bearing for
 * `applyFocusRequest` beneath it — one statement saying "the draw that drew
 * honours what it was asked for" reads better than two rules that differ.
 */
function applyScrollRequest(): void {
  const y = state.scrollAfterDraw;
  state.scrollAfterDraw = undefined;
  if (y === undefined) return;
  const el = scroller();
  if (!el) return;
  // Clamped rather than assigned: hiding a row makes the list shorter, so the
  // offset may be past the end of the document it is being applied to.
  el.scrollTop = clampScroll(y, { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });
}

/**
 * Draws the tabs, the navigator and `#view`. `false` means the draw was held
 * (a menu, a form, or a mouse button down on the list) and nothing was
 * replaced — so the caller must not treat the document as rebuilt.
 */
function render(
  items: Item[],
  settings: Settings,
  sources: Record<Source, SourceStatus>,
  now: Date,
): boolean {
  // An open menu closed over an Item from the previous list. Rather than pull
  // the list out from under it — the popup fires a sync on open, so that race
  // is the common case, not a corner one — the redraw waits for the menu to
  // close. Checked here, after the awaits in `draw`, and not only in `refresh`:
  // a menu can open while the state is in flight.
  if (drawIsHeld()) return false;
  /*
   * How far down the window is *now*, before the replace below takes the
   * document's height away and the browser clamps the offset to 0.
   *
   * Read here rather than chained onto `refresh()` for the same reason the
   * focus request is: a held press defers the draw by a task, so a caller's
   * `.then` would read the offset of a document that is about to be replaced by
   * a draw it knows nothing about. The draw that replaces is the draw that
   * reads. `scrollPlan` decides whether to keep it, drop it, or restore the one
   * kept from before a screen (popup/scroll.ts); `applyScrollRequest` writes
   * it back after the footer, clamped.
   */
  const place = currentPlace();
  const plan = scrollPlan(state.lastPlace, place, scroller()?.scrollTop ?? 0, state.scrollMemory);
  state.lastPlace = place;
  state.scrollMemory = plan.memory;
  state.scrollAfterDraw = plan.y;
  /*
   * What has focus *now*, before anything below destroys it.
   *
   * Nobody asked for focus on a background redraw — the open-sync, a store
   * write, the minute tick — and every one of them rebuilt the strip and the
   * list under a student who had tabbed to a tab or was arrowing through rows,
   * leaving `<body>` focused (I01, 2026-09-19). Derived here, as a request like
   * any other, so the same code that honours ‹ back's request puts a redraw's
   * focus back where it was. An explicit request outranks it.
   */
  if (!state.focusAfterDraw) {
    const implicit = focusRequestFor(
      document.activeElement,
      { view: viewEl, tabs: tabsEl, doc: document },
      state.view,
    );
    if (implicit) requestFocus({ ...implicit, implicit: true });
  }
  state.currentItems = items;
  viewEl.replaceChildren();
  delete viewEl.dataset["shape"];
  // What the full view's width cap keys off. A month may use 1400px; a list of
  // rows stops at 1100 so the clock does not end up a foot from the title. Set
  // from the view rather than from a media query, because Chrome lays the
  // document out to decide the popup's width and a width rule can feed itself.
  document.body.dataset["view"] = state.view;

  // Two lists, because the calendar and the Attention tab are asking different
  // questions. A grid says what was on a day, so finished work belongs on it,
  // struck through (Sushi, 2026-09-18). Attention is a list of what is still
  // owed, so it keeps `dropFinished` and keeps behaving exactly as before.
  const onGrid = visibleItems(items, settings, state.hidden, now);
  const owed = visibleItems(items, settings, state.hidden, now, { dropFinished: true });
  const colours = courseColours(coursesIn(visibleItems(items, settings, new Set(), now)));

  renderTabs({
    exams: examCount(items, now),
    /*
     * Everything the Alerts tab holds, counted by one derivation in core
     * (`alertCount`) rather than by this file adding four numbers up.
     *
     * It is not `noDateCount` any more: the tab gained late work, the
     * suggestions and the sources with a button on them when the Needs-you
     * screen was folded into it, and a badge that counted only the undated half
     * would send a student past three late assignments to a "2".
     */
    nodate: alertCount({
      sources,
      overdue: overdueItems(items, now).length,
      suggestions: state.currentSuggestions.length,
      undated: noDateCount(owed, now),
    }),
  });
  renderHiddenNote();
  // The header bar is sticky, so without this the tabs slide under it and
  // switching views means scrolling back to the top of the list. Measured
  // rather than hard-coded: the bar's height is a font metric.
  const bar = document.querySelector<HTMLElement>(".bar");
  if (bar) document.getElementById("tabs")!.style.top = `${bar.offsetHeight}px`;

  const nav = navFor(state.view, now);
  renderDateNav(nav.label, nav.step);

  // A sub-screen owns `#view` while it is open, and is re-rendered from this
  // draw's items rather than held over from the one that opened it (D8). The
  // shell above is drawn either way: the tab strip stays live, and pressing a
  // tab is how a student leaves the screen with the mouse.
  if (renderOpenScreen(now)) return true;
  clearScreenMark();

  if (state.view === "nodate") {
    // Alerts: everything asking the student for something, in one tab
    // (2026-09-19). `items` for the parts that must not be filtered away — a
    // late assignment in a switched-off course is still late — and `owed` for
    // the undated groups, which is the list this tab has always drawn.
    renderAlertsView(items, owed, sources, state.currentSuggestions, now, colours);
    makeRowsNavigable();
    return true;
  }
  if (state.view === "exams") {
    // From `items`, not `onGrid`: a booking is filtered out of the grid on
    // purpose, and an exam is exactly the row a course filter should not be
    // able to hide by accident.
    renderExamsView(items, now, colours);
    makeRowsNavigable();
    return true;
  }

  // "Nothing due in the next 60 days." is only true when every source was read
  // and every source was empty. Said over an expired session it reads as "you
  // are free" and means "I could not look" (§11).
  if (onGrid.length === 0) {
    const empty = emptyStateFor(sources, items.length > 0);
    viewEl.append(
      emptyNote(
        state.hidden.size > 0
          ? "Every course is switched off — turn one back on under ⋯ › Courses."
          : empty.text,
      ),
    );
    if (state.hidden.size === 0) {
      // A real button under the sentence. These used to be `.link` — text that
      // looked like the rest of the sentence it sat under, on the one screen
      // where there is nothing else to click.
      const actions = document.createElement("div");
      actions.className = "empty--actions";
      for (const source of empty.logins) {
        const url = signInUrl(source, sources[source]);
        if (!url) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-primary";
        button.textContent = `Sign in to ${SOURCE_NAME[source]}`;
        button.addEventListener("click", () => chrome.tabs.create({ url }));
        actions.append(button);
      }
      if (actions.childElementCount > 0) viewEl.append(actions);
    }
    return true;
  }

  if (state.view === "day") renderTodayView(onGrid, now, colours, sources);
  else if (state.view === "week") renderWeekView(onGrid, now, colours);
  else renderMonthView(onGrid, now, colours);
  makeRowsNavigable();
  return true;
}

/**
 * Honour the pending focus request against the document as just drawn.
 *
 * Called only after a draw that actually rebuilt the tabs, the list and the
 * footer. A held draw leaves the request in `state`, and the deferred draw
 * that `endPress` or `closeMenus` runs a moment later is the one that applies
 * it — which is the whole fix for the pointer paths in I01 and I02
 * (popup/focus.ts). A request nothing on screen can satisfy is dropped; focus
 * stays where the browser left it rather than jumping somewhere invented.
 */
function applyFocusRequest(): void {
  const request = takeFocusRequest();
  if (!request) return;
  const target = findFocusTarget(request, { view: viewEl, tabs: tabsEl, doc: document });
  // A redraw that is only putting focus back where it already was must not
  // scroll the window to do it; a screen closing wants its row in view.
  target?.focus({ preventScroll: request.implicit === true });
}

/**
 * Draws the popup, and never throws into a console nobody has open.
 *
 * A popup that fails halfway is a blank rectangle: there is no scrollback and
 * no obvious way in to the console, so an uncaught error here is invisible in
 * a way the same error on the options page is not. The status line is the only
 * channel this surface has, so everything ends up there.
 */
async function refresh(): Promise<void> {
  if (drawIsHeld()) return;
  try {
    await draw();
  } catch (err) {
    showStatus(
      `Illini Dash could not draw the list: ${
        err instanceof Error ? err.message : String(err)
      }. Open chrome://extensions and click Reload on the Illini Dash card.`,
    );
  }
}

async function draw(): Promise<void> {
  // Before anything else: a fresh install has nothing to draw a calendar from,
  // and the calendar shell over an empty grid reads as a broken app.
  const setup = await send({ type: "get-setup" });
  if (setup.type === "setup" && setup.rows !== undefined) {
    renderSetup(setup.rows, () => void recheckLogins());
    return;
  }
  document.body.classList.remove("setup");

  const response = await send({ type: "get-state" });
  if (response.type !== "state") {
    showStatus(response.type === "error" ? response.message : "Unexpected response.");
    return;
  }
  // A worker on an older build does not send every field read below, and
  // TypeScript cannot know that (see core/compat.ts).
  const { state: fromWorker, missing } = normalizePopupState<typeof response>(response);
  const now = new Date();
  // Recorded before anything is drawn, so the first-run screen — which is the
  // same page and runs before this on the draw where it shows — has a real
  // answer to put under its checklist on the next pass.
  const visible = fromWorker.items.filter((item) => !item.hidden);
  state.lastFound = { items: visible.length, courses: coursesIn(visible).length };
  state.courseNames = fromWorker.courseNames ?? {};
  // Normalized above, so an older worker that has never heard of suggestions
  // leaves this empty rather than making `render` throw on `.length`.
  state.currentSuggestions = fromWorker.suggestions ?? [];
  state.currentObservers = fromWorker.observers;
  state.observerMissing = missing;
  state.lastHealth = {
    sources: fromWorker.sources,
    ...(fromWorker.lastSyncAt ? { lastSyncAt: fromWorker.lastSyncAt } : {}),
  };
  renderHealth(fromWorker.sources, fromWorker.items, now);
  renderBanners(fromWorker);
  const drew = render(
    fromWorker.items,
    fromWorker.settings ?? DEFAULT_SETTINGS,
    fromWorker.sources,
    now,
  );
  // Last, because it reports on what the draw above just read — and because it
  // is the one strip that has to be present on every view (D10).
  renderFooter(fromWorker.sources, now);
  // Only when there is something wrong. On the happy path this element is
  // hidden and costs nothing (worker rule 8: an older worker does not send
  // every field this page reads, and that has to be visible, not thrown).
  // A refused correction, if one is pending, is re-drawn by `showStatus`
  // itself — it is state, not this draw's to clear (core/outcome.ts).
  showStatus(missing.length > 0 ? staleWorkerNotice(missing) : undefined);
  // After the footer: the scroll offset is measured against the whole document,
  // and a focus request may name the footer's own button.
  if (drew) {
    applyScrollRequest();
    applyFocusRequest();
  }
}

/* -------------------------------------------------------------------------- */
/* Syncing                                                                     */
/* -------------------------------------------------------------------------- */

/** Stops the spinner and lets the pill go back to reporting from the store. */
function endSync(): void {
  if (!state.syncing) return;
  state.syncing = false;
  repaintChrome();
}

/**
 * A sync, with its progress on the control that started it.
 *
 * "Syncing…" used to be written to a status line at the bottom of an 883px
 * document — feedback for a click, placed where the click could not see it. The
 * footer's button says it, the pill takes over from there, and both are drawn
 * from the same `state.syncing`.
 */
async function runSync(): Promise<void> {
  // A second click while one is in flight would spin a button that is already
  // spinning and queue a sync the worker is going to debounce anyway.
  if (state.syncing) return;
  state.syncing = true;
  // Repainted before the request rather than after it: a sync is five or six
  // fetches and takes five to ten seconds, and for all of that the header was
  // still asserting the outcome of the *previous* one.
  repaintChrome();
  // The first-run screen has no pill to repaint, so its rows are the only thing
  // that can say a sync is running — and they only redraw if asked.
  if (document.body.classList.contains("setup")) void refresh();
  showStatus(undefined);

  /*
   * The spinner is capped; the request is not.
   *
   * `chrome.runtime.sendMessage` does not reject when the service worker is
   * torn down mid-answer, so without this a dead worker leaves the button
   * disabled and turning with nothing behind it and no way to press it again.
   * The send is still awaited afterwards, so a late answer still redraws.
   */
  let capped = false;
  const cap = setTimeout(() => {
    capped = true;
    endSync();
    showStatus(
      "This is taking longer than usual. Illini Dash is still trying — if nothing " +
        "changes, open chrome://extensions and click Reload on the Illini Dash card.",
    );
  }, SYNC_SPINNER_CAP_MS);

  try {
    await send({ type: "sync", trigger: "manual" });
    if (capped) showStatus(undefined);
  } catch (err) {
    showStatus(
      `Illini Dash could not reach its own background part: ${
        err instanceof Error ? err.message : String(err)
      }. Open chrome://extensions and click Reload on the Illini Dash card.`,
    );
  } finally {
    clearTimeout(cap);
    endSync();
  }
  await refresh();
}

/**
 * The header and the footer, from the last state drawn.
 *
 * Both say something about a sync that is in flight, and neither needs a round
 * trip to say it — the only thing that changed is `state.syncing`, which this
 * page owns.
 */
function repaintChrome(): void {
  if (!state.lastHealth) return;
  const now = new Date();
  renderHealth(state.lastHealth.sources, state.currentItems, now);
  renderFooter(state.lastHealth.sources, now);
}

/**
 * Coming back to the page after signing in somewhere else.
 *
 * `visibilitychange` already redrew — but a redraw reads the store, and the
 * store still says "not signed in", because nothing fetched. Signing in happens
 * on another origin, in a tab this extension does not own, and no event crosses
 * back. So the screen that promised "come back and the dot clears itself"
 * redrew the same stale sentence forever, and only the Sync button cleared it.
 *
 * The sync two lines below does not cover it, twice over: `trigger: "popup"` is
 * debounced to five minutes, and a source that has failed a few times is in
 * backoff, which every trigger but `manual` skips. Signing in invalidates both
 * of those judgements — they are about a source that has not changed, and this
 * one just did.
 *
 * `sourcesToRecheck` decides which sources qualify and holds the debounce,
 * since this runs on every tab switch.
 */
let recheckInFlight = false;
async function recheckLogins(): Promise<void> {
  if (recheckInFlight || state.syncing) {
    console.log(
      `[illini-dash] back on the page — not re-checking logins: ${
        recheckInFlight ? "a re-check is already running" : "a sync is already running"
      }`,
    );
    return;
  }
  recheckInFlight = true;
  try {
    const response = await send({ type: "get-state" });
    if (response.type !== "state") return;
    // The same "has anything happened" rule the worker applies. Without it this
    // page would refuse a re-check that the worker would have made — which is
    // exactly the ten seconds Sushi had to wait out after signing in.
    const stored = await chrome.storage?.session?.get(NAVIGATED_KEY).catch(() => undefined);
    const navigated = (stored?.[NAVIGATED_KEY] ?? {}) as NavigatedAt;
    const due = sourcesToRecheck(response.sources ?? {}, Date.now(), navigated);
    // Both branches logged, or "came back, nothing was waiting on a login" and
    // "came back, the check never ran" are the same silence (worker rule 5).
    if (due.length === 0) {
      console.log("[illini-dash] back on the page — no source was waiting on a login");
      return;
    }
    console.log(`[illini-dash] back on the page — re-checking ${due.join(", ")}`);
    await runSync();
  } finally {
    recheckInFlight = false;
  }
}

/* -------------------------------------------------------------------------- */
/* Wiring                                                                      */
/* -------------------------------------------------------------------------- */

// The four calls that would otherwise be import cycles. See `app` in state.ts.
app.refresh = refresh;
app.runSync = runSync;
app.openAddEditor = () => openAddEditor();
app.openEditEditor = openEditEditor;
app.closeEditor = closeEditor;
app.deleteManual = deleteManual;
app.undoDelete = undoDelete;
app.openDeadline = openDeadline;
app.openGiveDate = openGiveDate;


renderActions();
void refresh();
// §6: opening the popup triggers a sync, debounced to 5 minutes worker-side.
void send({ type: "sync", trigger: "popup" }).then(refresh).catch(() => undefined);
// A popup is a fresh document on every open, so `visibilitychange` never fires
// for it — opening *is* the return, and it is the moment someone who has just
// signed in comes back to look.
void recheckLogins();

/**
 * The receiving half of the full-view handoff, in the tab.
 *
 * Only in the full view, and only for the handoff key: a `storage` event fires
 * for every write this origin makes, including the popup's own remembered tab.
 */
if (isFullView) {
  window.addEventListener("storage", (event) => {
    if (event.key !== HANDOFF_KEY || !event.newValue) return;
    try {
      const asked = JSON.parse(event.newValue) as { view?: string };
      if (!VIEWS.includes(asked.view as ViewName)) return;
      state.view = asked.view as ViewName;
      state.dayOffset = 0;
      writeStored(VIEW_KEY, state.view);
      void refresh();
    } catch {
      /* Written by a build that meant something else by it. */
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Keeping an open view honest                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Redraw when the store changes underneath.
 *
 * §6's alarm has always synced in the background; what was missing is that
 * nothing told the open page. A popup mostly gets away with it because it
 * closes on focus loss, but the full view is a tab — left open it kept showing
 * whatever it drew when it opened, so a deadline that arrived, moved or was
 * submitted half an hour ago was simply not there.
 *
 * While a menu is open the redraw is deferred, not skipped — `refresh` owns
 * that rule, so no caller here has to remember it.
 */
chrome.storage?.onChanged?.addListener((changes, area) => {
  // A sync the worker started — the poll, or a page finishing on a source's own
  // site — so this window can say "checking" about work it did not ask for.
  if (area === "session" && SYNCING_KEY in changes) {
    const next = changes[SYNCING_KEY]?.newValue === true;
    if (next !== state.workerSyncing) {
      state.workerSyncing = next;
      void refresh();
    }
    return;
  }
  if (area !== "local" || !(STORAGE_KEY in changes)) return;
  void refresh();
});

// And the state as it stands right now, since a sync may already be running
// when this document opens — which is the common case: the worker starts one
// the moment the student finishes signing in.
void chrome.storage?.session
  ?.get(SYNCING_KEY)
  .then((stored) => {
    if (stored?.[SYNCING_KEY] !== true) return;
    state.workerSyncing = true;
    void refresh();
  })
  .catch(() => undefined);

/**
 * And redraw on the clock, because half of what a row says is relative.
 *
 * "in 4h", "6d ago", the red now-line and the word "Today" are all answers to
 * a question whose answer changes while nobody touches anything. A tab left
 * open overnight showed yesterday under a heading reading Today, which is the
 * one thing a calendar must never do.
 *
 * Only when the minute actually changes, and only while the page is visible:
 * a redraw a second is a redraw that fights every scroll.
 */
const TICK_MS = 30_000;
let lastMinute = new Date().getMinutes();
setInterval(() => {
  if (document.hidden) return;
  const minute = new Date().getMinutes();
  if (minute === lastMinute) return;
  lastMinute = minute;
  void refresh();
}, TICK_MS);

// Coming back to a tab that sat hidden for hours is the case the tick above
// cannot cover, because a hidden page is throttled to roughly once a minute at
// best and frozen at worst.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  void refresh();
  void recheckLogins();
});

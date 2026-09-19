/**
 * The frame every view is drawn inside: header, tab strip, banners, the error
 * slot, the footer strip — and the menu machinery all of them share.
 *
 * It imports `state.ts` and nothing else from this folder. A view may reach for
 * the shell; the shell may never reach for a view, which is what keeps the
 * folder a tree rather than a mesh.
 *
 * The shape is D9/D10 of docs/design/brief.md:
 *
 *     [mark] Illini Dash                  [+] [⋯]
 *     ┌ Today │ Week │ Month │ Exams │ Attention ┐
 *     …
 *     [dot] 8 sources · synced 2m ago    Sync now
 *
 * The header's health pill went on 2026-09-19 (see `renderHealth`), and the
 * footer's source text took over opening the Needs-you screen it used to open.
 *
 * What it replaces on either end is the same failure twice. The header used to
 * carry five icon buttons in 400px beside a sentence that needed every pixel
 * it could get; the sync button is now the footer's only control and the other
 * three are one keystroke into the ⋯. And the footer used to be nothing at
 * all — the one line stating what had been read sat at the *bottom of the
 * document*, which in the week view is 1100px into a 600px window (UI rule 3).
 */

import {
  type SourceAction,
  actionFor,
  displayState,
  footerLine,
  sourceRows,
  staleNotice,
  summarize,
} from "../../core/health.js";
import { courseLabel, SOURCE_NAME, SOURCE_TITLE, timeAgo } from "../../core/names.js";
import { coursesIn, weekContents } from "../../core/calendar.js";
import { googleCalendarUrl } from "../../core/ics.js";
import { sameCourse } from "../../core/dedupe.js";
import { unreadableDeadline } from "../../core/quality.js";
import { downloadIcs } from "../download.js";
import { appMark, bookMark, type IconName, icon, iconButton } from "../icons.js";
import { renderThemePanel } from "../theme-panel.js";
import { send, type OverrideAction, type Request } from "../../messages.js";
import { type ActionOutcome, actionOutcome } from "../../core/outcome.js";
import { FOOT_HEALTH_CLASS, ROW_RING_SELECTOR } from "./focus.js";
import type { Item, Source, SourceState, SourceStatus } from "../../sources/types.js";
import type { ViewName } from "../../core/calendar.js";
import {
  MAX_POPUP_HEIGHT,
  MENU_CLASS,
  MENU_SELECTOR,
  VIEWS,
  VIEW_KEY,
  VIEW_LABEL,
  FULL_VIEW_ONLY,
  HANDOFF_KEY,
  HIDDEN_KEY,
  actionsEl,
  anchorDate,
  app,
  bannersEl,
  createPressHold,
  dateNavEl,
  filtersEl,
  footerEl,
  healthEl,
  isFullView,
  isSyncing,
  requestFocus,
  safeUrl,
  state,
  statusEl,
  tabsEl,
  WEEK_MODE,
  viewEl,
  writeStored,
} from "./state.js";

// The class and the selector for the footer's source button live with the
// focus lookup that reads them (popup/focus.ts); re-exported so every module
// that spelled it through this file still finds it here.
export { FOOT_HEALTH_CLASS };

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The header: the mark and the name on the left, `+` and `⋯` on the right (D9).
 *
 * What it replaces is six 9px dots and, 800px below them, a line of prose
 * restating what the dots meant. The dots were a colour-only signal (shapes
 * existed only in the High-contrast theme), the one that was clickable looked
 * exactly like the five that were not, and nobody scrolled to the line.
 *
 * **The health pill is gone from the bar (2026-09-19).** It was the fourth
 * thing on screen saying something about state, and its own best case said
 * "All clear" — three words that named nothing a student could act on, over a
 * list that already shows what is due. Late work is now the first thing on the
 * Today tab and source health is the footer strip, so the pill had nothing
 * left to say that was not already said twice. The Needs-you screen it used to
 * open is now opened by the footer's source text (`renderFooter`).
 *
 * The parameters are kept because two call sites in `popup.ts` pass them and
 * the header is where a future summary would go; nothing here reads them.
 */
export function renderHealth(
  _sources: Record<Source, SourceStatus>,
  _items: Item[],
  _now: Date,
): void {
  healthEl.replaceChildren();
  // Both marks, every time; the stylesheet shows one. Classical wants the book
  // glyph and every other design wants the squircle, and the design picker
  // swaps `data-design` on the root without redrawing this bar — so a branch
  // on the attribute here would leave the wrong mark on screen until something
  // unrelated happened to call this function again. See `bookMark`.
  healthEl.append(appMark(), bookMark(), renderWordmark());
}

/**
 * "Gradescope — Sign in needed · last read 2 days ago", one source per line.
 *
 * Plain text with newlines rather than markup, because it is a `title`: the
 * facts are `sourceRows`', including the exact stamp and the site's own error
 * message, which is the difference between "the cookie is not reaching us" and
 * "the page says something we misread".
 *
 * It hung off the header pill until 2026-09-19 and now hangs off the footer's
 * source button, because "which site was read, and when" is a question a
 * student asks without wanting to change anything, and making them open a
 * screen to read it is a worse trade than a hover. `sourceRows` is the same
 * list the screen draws, so the two can never disagree.
 */
function sourcesTooltip(sources: Record<Source, SourceStatus>, now: Date): string {
  const lines = sourceRows(sources, now).map((row) => {
    const when = row.lastReadExact ? ` · last read ${row.lastReadExact}` : "";
    const err = row.lastError ? ` (${row.lastError})` : "";
    return `${SOURCE_TITLE[row.source]} — ${row.word}${when}${err}`;
  });
  if (lines.length === 0) return "No sites are switched on";
  return ["Which sites were read, and when:", ...lines].join("\n");
}

/**
 * The name, in the accent, at the top left of both windows.
 *
 * A popup has no title bar and a tab's is four words of browser chrome, so
 * without this there is nothing on screen that says what the thing is — and the
 * full view is a page a student may land on from an install with no context at
 * all. `flex: none`, so it never gives up its width; since the pill went it has
 * the whole left side of the bar to itself.
 */
function renderWordmark(): HTMLElement {
  const mark = document.createElement("span");
  mark.className = "wordmark";
  /*
   * "Illini Dash", and nothing after it.
   *
   * It read "Illini Dash UIUC" on the argument that the extra word says what
   * the thing is for. Sushi, looking at it: "get rid of UIUC, just keep illini
   * dash." The word was never doing that work anyway — "Illini" already names
   * the university to anyone who would install this, so the suffix was a
   * second, louder copy of a fact the first word carries.
   */
  mark.textContent = "Illini Dash";
  return mark;
}

/**
 * The page that signs this source in, or nothing.
 *
 * Three surfaces open one — the first-run checklist, the empty state, and the
 * stale banner — and all three used to read `LOGIN_URL[source]` for themselves.
 * That is one decision in four places, and it was wrong in all of them for the
 * same source: a course website has no fixed login form, so `site` rendered
 * "Sign in needed" with nothing beside it. `actionFor` knows the page that
 * actually answered 401, and now everything asks it.
 *
 * `assume` is for the banner, which has already established that this source
 * needs a login and is describing how long ago rather than re-deriving it.
 */
export function signInUrl(
  source: Source,
  status: SourceStatus | undefined,
  assume?: SourceState,
): string | undefined {
  if (!status) return undefined;
  const action = actionFor(source, assume ?? displayState(status), status.loginUrl);
  return action?.kind === "login" ? action.url : undefined;
}

/**
 * The button for a `SourceAction`, or nothing when the source is fine.
 *
 * One place, so the pill and the popover offer the same thing — and so that
 * *every* failing state offers something. Only `needs_login` used to, which
 * meant a source that could not be reached rendered as a red row with no way
 * forward: you clicked "Gradescope couldn't be read", got a list, and the list
 * had nothing on it either.
 */
export function actionButton(action: SourceAction | undefined): HTMLButtonElement | undefined {
  if (!action) return undefined;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-secondary btn-sm";
  if (action.kind === "login") {
    button.textContent = "Sign in";
    button.title = `Open ${SOURCE_NAME[action.source]}'s login page`;
    button.addEventListener("click", () => chrome.tabs.create({ url: action.url }));
    return button;
  }
  if (action.kind === "open") {
    button.textContent = "Open";
    button.title = `Open ${SOURCE_NAME[action.source]} and see what the page looks like`;
    button.addEventListener("click", () => chrome.tabs.create({ url: action.url }));
    return button;
  }
  // Retry. A failed fetch is transient far more often than not, and pressing
  // this is the whole fix — which is what makes reporting it as "the page
  // changed" so expensive.
  //
  // One word rather than two: in the popup's bar this button sits between the
  // wordmark and three icons, and "Try again" cost the health sentence its last
  // four characters. The sentence is what says what is wrong; the button only
  // has to say what pressing it does, and "Retry" does.
  button.textContent = "Retry";
  button.title = `Read ${SOURCE_NAME[action.source]} again`;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    closeMenus();
    void app.runSync();
  });
  return button;
}

/** The four tones the pill, the popover and the chips all share. */
export function toneFor(state_: SourceState): "ok" | "warn" | "err" | "pending" | "off" {
  if (state_ === "ok") return "ok";
  if (state_ === "needs_login") return "warn";
  if (state_ === "disabled") return "off";
  if (state_ === "pending") return "pending";
  return "err";
}

/* -------------------------------------------------------------------------- */
/* The header's two controls                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `+` and `⋯`, and nothing else (D9).
 *
 * There were five icons here: add, sync, open-in-a-tab, export and settings.
 * Four of them are things a student does once a term or once a week, and all
 * five were competing for the width of a sentence that says whether the data on
 * screen can be trusted. Adding is the one that belongs beside the list, the
 * sync moved to the footer where its outcome is already reported, and the other
 * three are in the ⋯ — which also carries Courses, replacing the chip strip
 * that cost a permanent 36px row.
 *
 * Drawn once, at startup. Nothing in it depends on the state.
 */
export function renderActions(): void {
  actionsEl.replaceChildren();

  /*
   * "Open full view", first, and only in the popup (2026-09-19).
   *
   * It was a text link injected into the *date navigator* by the month view,
   * which left "August 2026", "Today", "Full view ↗" and the ‹ › pair sharing
   * one 400px bar with the arrows pinned to the window's edge — Sushi: "id also
   * like to move the full view button to the top banner instead of next to the
   * arrows since its squished".
   *
   * On **every** tab rather than only Month. The full view is the answer to "the
   * popup vanishes when I click the course page behind it", which is a question
   * about the window and not about the month; it was Month-only because that is
   * where there happened to be room in the navigator, and the ⋯ has offered
   * "Open full view" from every tab the whole time. That menu entry is gone with
   * this: one visible control beats a duplicate of it three clicks down, and two
   * routes to one destination is what the `#ledger` strip was removed for.
   *
   * `iconButton`, like ⋯ and the gear beside it, so it inherits `.btn-icon`'s
   * ink rather than naming a colour pair of its own — `--accent` on
   * `--accent-ink` measured 1.4:1 in Classical dark (see `renderQuickFab`). It
   * carries `aria-label` and `title` from `iconButton`, so the name survives the
   * glyph, and it is a `<button>` in the bar's own tab order.
   *
   * There is nowhere to go from the full view itself, so it is not drawn there.
   */
  if (!isFullView) {
    const full = iconButton("open-tab", "Open full view");
    full.addEventListener("click", (event) => {
      event.stopPropagation();
      // The tab the student is on, so the tab that opens lands where they were.
      openFullView(state.view);
    });
    actionsEl.append(full);
  }

  /*
   * The "+", first, because adding is now something this window does.
   *
   * Sushi: "maybe also just a + icon as well for a general event addition."
   * It prefills the day being *viewed* rather than today — pressing it while
   * looking at next Tuesday and getting a form dated today is the same class of
   * surprise as a calendar that jumps back to now when you scroll it.
   */
  const addButton = iconButton("plus", "Add a deadline");
  addButton.classList.add("btn-boxed");
  addButton.addEventListener("click", (event) => {
    // Otherwise `document`'s own click listener closes the panel this opens.
    event.stopPropagation();
    // The *complete* form, as a screen. Since 2026-09-19 the "+" on the list is
    // the five-field panel, and this is the only add Alerts and Exams have —
    // and the only route to Kind, the end time, the link and "No date yet".
    app.openFullAdd();
  });
  actionsEl.append(addButton);

  const more = iconButton("more", "More");
  more.setAttribute("aria-haspopup", "menu");
  more.addEventListener("click", (event) => {
    event.stopPropagation();
    if (more.getAttribute("aria-expanded") === "true") {
      closeMenus();
      return;
    }
    openHeaderMenu(more);
  });
  actionsEl.append(more);
  const settings = iconButton("settings", "Settings");
  settings.addEventListener("click", () => openOptions());
  actionsEl.append(settings);

  renderQuickFab();
}

/* -------------------------------------------------------------------------- */
/* The floating "+"                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The class the stylesheet draws and `screens/editor.ts` looks the control up
 * by. One constant for the selector and the class (UI house rule 7).
 */
export const QUICK_FAB_SELECTOR = ".qfab";
const QUICK_FAB_CLASS = QUICK_FAB_SELECTOR.slice(1);
/**
 * Written on `<body>` while the tab strip is pinned to the bottom of the
 * document, and read by exactly one rule in `popup-screens.css`. One constant
 * for the attribute and the selector that matches it (UI house rule 7).
 */
export const TABS_AT_BOTTOM_ATTR = "data-tabs-bottom";
/** Between the panel and the "+" it hangs over. */
const QUICK_GAP = 8;
/** What the panel keeps clear of the window's bottom edge when there is no "+". */
const QUICK_FLOOR = 12;

/**
 * A "+" that hovers over the list, on the three calendar tabs.
 *
 * Sushi asked for it on Day, Week and Month, and *which* tabs is a question
 * about the document rather than about this function: `render` writes
 * `body[data-view]` on every draw and a sub-screen writes `body[data-screen]`,
 * so the stylesheet already knows. Deciding it here instead would mean a second
 * copy of "which view is on screen" that only a draw could keep true.
 *
 * On `<body>`, drawn once, beside the header's controls — never inside `#view`,
 * which every redraw empties.
 */
function renderQuickFab(): void {
  // `renderActions` is called once, at startup; a second call must not leave two.
  document.querySelector(QUICK_FAB_SELECTOR)?.remove();
  const fab = document.createElement("button");
  fab.type = "button";
  // `.btn-primary`, and **not** `.btn-icon`: `iconButton` adds that, and
  // `.btn-icon` is declared after `.btn-primary` in `ui.css` with its own
  // `color: var(--muted)` and no background — so a filled "+" built with
  // `iconButton` came out as a muted glyph on the page's own surface. Measured
  // both ways; see the note in `popup-screens.css`.
  fab.className = "btn btn-primary";
  fab.title = "Add a deadline";
  fab.setAttribute("aria-label", "Add a deadline");
  fab.append(icon("plus"));
  /*
   * `.btn-primary` for the ink, rather than `--accent` and `--accent-ink` here.
   *
   * Measured, dark and light: a "+" painted `var(--accent)` on
   * `var(--accent-ink)` came out `rgb(141,180,242)` under `rgb(236,238,242)` in
   * the Classical dark palette — about 1.4:1, a glyph you cannot see. The pair
   * that is guaranteed to go together is the one the design already ships a
   * filled button in, so the floating "+" *is* that button and this file only
   * says where it sits and how big it is.
   */
  fab.classList.add("btn-primary", QUICK_FAB_CLASS);
  fab.addEventListener("click", (event) => {
    // The document's own click listeners close menus, and the quick panel's
    // closes the panel; neither should see the press that opens it.
    event.stopPropagation();
    if (fab.getAttribute("aria-expanded") === "true") {
      app.closeEditor();
      return;
    }
    app.openAddEditor();
  });
  document.body.append(fab);
}

/**
 * Lift the "+" clear of a tab strip that lives at the bottom.
 *
 * The Classical design moves `#tabs` under the list (`order: 2`, `position:
 * sticky; bottom: 0`), so a "+" at `bottom: 12px` sits **on top of the Exams
 * tab** — measured in the real document, dark, before this existed. Which
 * designs do that is not something to enumerate: it is read off the strip's own
 * box, so a design that moves it back to the top gets the low "+" with no rule
 * anywhere naming a design.
 *
 * Called from `renderTabs`, which runs on every draw, because the answer
 * changes with the strip rather than with the "+".
 */
export function placeQuickFab(): void {
  /*
   * Read from the strip's *style*, not from where it happens to be sitting.
   *
   * `renderTabs` runs in the middle of a draw, between `viewEl.replaceChildren()`
   * and the rows going back in — so for that moment the document is as short as
   * it ever gets and a strip stuck to the window's bottom is measured half way
   * up it. Asking whether it is pinned to the bottom, and how tall it is, are
   * both true at any moment of a draw; asking where it is is not. (Measured: a
   * rect-based version left the "+" exactly where it had been, on the Exams tab.)
   */
  // A draw must not throw into a console nobody has open, and this one runs on
  // every draw: a harness with no layout engine (linkedom) has no
  // `getComputedStyle` at all, and there the "+" keeps its floor.
  /*
   * Asked of every piece of chrome that can own the window's bottom edge, not
   * of the tab strip alone.
   *
   * This read `tabsEl` and nothing else, on the reasoning that the strip is the
   * thing a design moves. That is true and it is not the whole question: the
   * strip and the sources bar TRADE places. Classical puts `#tabs` at the
   * bottom and `#footer` at the top (`order: -1`); Plain leaves `#footer`
   * sticky at the bottom and the tabs at the top. So in Plain the strip is not
   * pinned, the "+" dropped to its floor, and the floor is where the sources
   * bar is — measured in Plain's popup, the "+" sat on top of "Sync Now"
   * (Sushi, 2026-09-19: "in the plain popup view the add button on the bottom
   * right covers the sync now"). Naming both, and summing, so a design that
   * stacks the two gets cleared of both and a design that pins neither still
   * gets the low "+". No design is named anywhere.
   */
  const measure = typeof getComputedStyle === "function" ? getComputedStyle : undefined;
  const bottomPinned = (el: HTMLElement): number => {
    const style = measure?.(el);
    if (style === undefined) return 0;
    const pinned = style.position === "sticky" || style.position === "fixed";
    if (!pinned || style.bottom === "auto" || parseFloat(style.bottom) >= 1) return 0;
    // `display: none` measures 0 anyway; an empty `.foot` is `display: none`
    // on the first-run screen and must not reserve a strip's worth of room.
    return el.offsetHeight;
  };
  const tabsHeight = bottomPinned(tabsEl);
  const chromeHeight = tabsHeight + bottomPinned(footerEl);
  const atBottom = tabsHeight > 0;

  /*
   * Tell the stylesheet the strip is the document's last thing, so the room a
   * panel reserves is taken from *above* it.
   *
   * Sushi, on the real popup: "in the day view, when i click the + the bottom
   * row for today, week, etc. disappears." Measured, Classical dark, a day with
   * nothing due: window 253 → 397 when the panel opened (the reserve working),
   * document 253 → 397, and `#tabs` **stayed at 200–253** with 144px of empty
   * page under it and the panel drawn across it.
   *
   * `position: sticky; bottom: 0` is only sticky *upwards*: it stops a box
   * dropping below the fold, it never pushes one down. The strip's flow
   * position is the end of the content, and `body` is a flex column, so every
   * pixel of a `min-height` reserve lands after it. `margin-top: auto` on the
   * strip absorbs that free space instead (`popup-screens.css`), which changes
   * nothing when the document is already taller than the window — the ordinary
   * case, where there is no free space to absorb.
   *
   * Derived here rather than named in a sheet because this is where the
   * question is already answered, and `placeFloating`'s menus reserve room the
   * same way — so the same one line keeps the strip under a menu too.
   *
   * Mutating `atBottom` to a constant `true` survives today, and that is a fact
   * about the other three designs rather than about this test: Editorial, Rams
   * and Timetable leave `body` `display: block`, where `margin-top: auto` is
   * 0 — measured, all three, strip unmoved at 44–86. It stays conditional
   * because it is the strip that is being asked about, not the design, and a
   * later design with a flex column and a strip on top would need the answer.
   */
  document.body.toggleAttribute(TABS_AT_BOTTOM_ATTR, atBottom);

  const fab = document.querySelector<HTMLElement>(QUICK_FAB_SELECTOR);
  if (!fab) return;
  fab.style.bottom = `${chromeHeight + QUICK_FLOOR}px`;
}

/**
 * Sit the quick panel over the list, in a window tall enough to show it.
 *
 * The same two obligations as `placeFloating`, for the same reason — a `fixed`
 * panel contributes nothing to the box Chrome measures — and one more that a
 * menu does not have: the window it is measured in **changes underneath it**,
 * because asking for the room is what makes Chrome resize the popup. So every
 * number here is measured from the *bottom* edge, which both the panel and the
 * "+" it hangs over are anchored to. A `top` computed from the old window would
 * leave the panel stranded half way up the new one.
 */
export function placeQuickPanel(panel: HTMLElement, anchor?: HTMLElement): void {
  const box = anchor?.getBoundingClientRect();
  const windowHeight = document.documentElement.clientHeight;
  // Just above the "+", or off the floor when this view has no "+" to clear.
  const bottom = box ? Math.max(QUICK_FLOOR, windowHeight - box.top + QUICK_GAP) : QUICK_FLOOR;
  panel.style.bottom = `${bottom}px`;

  // The full view is an ordinary tab and is however tall it is; the popup is
  // capped by Chrome whatever the document says.
  const ceiling = isFullView ? window.innerHeight : MAX_POPUP_HEIGHT;
  // Never taller than the window can ever be. A form that overflows scrolls
  // inside itself, which is a scrollbar rather than a Cancel button nobody can
  // reach — and it keeps its own scroll off the page behind it.
  panel.style.maxHeight = `${Math.max(140, ceiling - bottom - QUICK_FLOOR)}px`;

  // Measured after the cap, so this is the height the panel will occupy rather
  // than the one it would like. The full view needs no reserve: its window is
  // not sized from the document.
  if (!isFullView) {
    document.body.style.minHeight = `${Math.min(
      MAX_POPUP_HEIGHT,
      bottom + panel.offsetHeight + QUICK_FLOOR,
    )}px`;
  }
}

/** The room the panel asked for, given back the moment it closes. */
export function releaseQuickPanel(): void {
  document.body.style.minHeight = "";
}

/**
 * Everything the old header carried, one press further away.
 *
 * Order is by how often it is wanted, not by category: the full view and the
 * calendar file are what a student reaches for while looking at the list;
 * Courses replaces a strip that was on screen permanently; Appearance and
 * Settings are set once.
 */
function openHeaderMenu(anchor: HTMLElement): void {
  closeMenus();
  const menu = document.createElement("div");
  menu.className = MENU_CLASS;
  menu.setAttribute("role", "menu");
  menu.addEventListener("click", (event) => event.stopPropagation());

  const add = (label: string, glyph: IconName, onClick: (entry: HTMLElement) => void): void => {
    menu.append(menuItem(label, glyph, onClick));
  };

  /*
   * No "Open full view" here any more (2026-09-19).
   *
   * It is an icon button in the header bar, two elements to the left of the ⋯
   * this menu hangs off — see `renderActions`. Keeping both would be the
   * `#ledger` strip's duplicate again: one destination, two controls, and the
   * buried one is the one nobody presses.
   */

  /*
   * Export, here rather than four clicks into Settings.
   *
   * It was under Data & privacy, which is where you go to *understand* what
   * the extension stores — not where you go to put this week in your calendar.
   * Sushi: "there should be a calendar icon in the popup/full screen view at
   * the top right directly instead of having to go into settings each time."
   *
   * It stays a one-time file, and the label says so. A calendar that updated
   * itself would be a subscription, which needs a URL a calendar app can poll,
   * which needs a server — and this extension has none, by design and in its
   * published privacy policy. Promising "sync" here would be promising the one
   * thing the architecture rules out.
   */
  add("Download .ics", "calendar-out", () => {
    closeMenus();
    void send({ type: "get-state" })
      .then((response) => {
        if (response.type !== "state") return;
        const count = downloadIcs(response.items);
        showStatus(
          `Saved ${count} deadline${count === 1 ? "" : "s"} to illini-dash.ics — a one-time copy, ` +
            `not a subscription. Import it into Google Calendar, Apple Calendar or Outlook.`,
        );
      })
      .catch((err: unknown) => {
        showStatus(
          `Could not build the calendar file: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  });

  /*
   * Google Calendar, which the popup has never had a control for.
   *
   * The connect/disconnect/push-now buttons live on the options page and are
   * the only things that can drive `gcal-connect` — `getAuthToken({
   * interactive: true })` has to be called from a click on a page that stays
   * open, and a popup closes the moment Chrome's consent window takes focus.
   * So this opens that section rather than reimplementing it: one decision, in
   * the one place that can carry it out.
   */
  add("Google Calendar…", "tab-month", () => {
    closeMenus();
    openOptions("sec-gcal");
  });

  // Replaces the chip strip, which cost a permanent 36px row of a 600px window
  // to show a legend most of the time and a filter occasionally.
  add("Courses…", "tab-week", () => openCoursesMenu(menu, anchor));

  add("Appearance…", "settings", () => {
    closeMenus();
    openAppearance(anchor);
  });

  add("Settings", "settings", () => {
    closeMenus();
    openOptions();
  });

  document.body.append(menu);
  placeFloating(menu, anchor, "right");
  trapMenuKeys(menu, anchor);
}

export function openOptions(section?: string): void {
  if (isFullView || section) {
    // Already in a tab, so use it. `openOptionsPage` would leave two Illini
    // Dash tabs open, with the one being read behind the one now in front —
    // and it cannot carry a fragment, which is the only way to land on a
    // section rather than at the top of a 4000px page.
    const url = chrome.runtime.getURL(`options.html${section ? `#${section}` : ""}`);
    if (isFullView) location.href = url;
    else void chrome.tabs.create({ url });
    return;
  }
  chrome.runtime.openOptionsPage();
}

/**
 * The course list, as a second level of the same menu (D9).
 *
 * The chip strip it replaces was the colour legend and the filter in one
 * control, which was a good trade while it was the only place course
 * visibility lived — and a bad one once it was a permanent 36px strip above
 * every view. The colours are on the rows themselves; what was left up there
 * was a filter used a few times a term.
 *
 * A switched-off course stays on the list, unticked, rather than disappearing
 * from it. A filter that removes its own control gives the student no way back,
 * which is the failure §11 ranks worst.
 */
function openCoursesMenu(menu: HTMLElement, anchor: HTMLElement): void {
  const courses = coursesIn(state.currentItems);
  menu.replaceChildren();

  const heading = document.createElement("div");
  heading.className = "menu-heading";
  heading.textContent = courses.length > 0 ? "Show these courses" : "No courses on screen yet";
  menu.append(heading);

  for (const course of courses) {
    const on = !state.hidden.has(course);
    const entry = menuItem(courseLabel(course, state.courseNames), on ? "check" : "close", () => {
      if (state.hidden.has(course)) state.hidden.delete(course);
      else state.hidden.add(course);
      writeStored(HIDDEN_KEY, JSON.stringify([...state.hidden]));
      // Redrawn in place rather than closed: hiding four of six courses is four
      // presses, and a menu that shuts after each one makes it twelve.
      openCoursesMenu(menu, anchor);
      void app.refresh();
    });
    entry.setAttribute("role", "menuitemcheckbox");
    entry.setAttribute("aria-checked", String(on));
    if (!on) entry.classList.add("menu-item--off");
    menu.append(entry);
  }

  // The pressed entry was just removed with the rest, and focus with it; put it
  // on the first course so the arrows and Escape still work.
  menu.querySelector<HTMLElement>(".menu-item")?.focus();
  placeFloating(menu, anchor, "right");
}

/**
 * The theme picker, in the popup.
 *
 * `renderThemePanel` is the settings page's control, unchanged — every class it
 * uses is in `ui.css`, which both documents link, so it lifts across without a
 * line of new CSS. A floating panel rather than an in-flow screen because it is
 * a preference, not a place: the list behind it is what the student is checking
 * the colours against.
 */
function openAppearance(anchor: HTMLElement): void {
  closeMenus();
  const panel = document.createElement("div");
  panel.className = `${MENU_CLASS} popover popover--wide`;
  panel.dataset["survivesRedraw"] = "";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Appearance");
  panel.addEventListener("click", (event) => event.stopPropagation());
  renderThemePanel(panel);
  document.body.append(panel);
  placeFloating(panel, anchor, "right");
  trapMenuKeys(panel, anchor);
}

/**
 * Show the full view, without piling up tabs.
 *
 * The worker owns the "is it already open" half — a popup is destroyed the
 * moment it loses focus, so it has nowhere to remember the tab it opened, which
 * is why every click on Month used to spawn another one.
 */
export function openFullView(view_?: ViewName): void {
  if (view_) {
    // Remembered first, so a tab that opens fresh lands on the tab just clicked.
    writeStored(VIEW_KEY, view_);
    writeStored(HANDOFF_KEY, JSON.stringify({ view: view_, at: Date.now() }));
  }
  void send({ type: "open-full-view" }).catch((err: unknown) => {
    showStatus(
      `Could not open the full view: ${err instanceof Error ? err.message : String(err)}`,
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Five tabs, five names, five equal columns (D1).
 *
 * Only the *selected* tab used to carry a label, because five labelled tabs
 * measured 454px against a 400px document and a document wider than the popup
 * is what opened it at 800px once already. That was a real constraint answered
 * in the wrong place: the width came from 12.5px type, 11px of padding on each
 * side and a 14px icon on every tab.
 *
 * The mock drops the icons entirely and gives each tab `flex: 1`, which is what
 * makes the strip's width a function of the *document* rather than of the
 * labels. A longer label ellipses inside its fifth; it can no longer push. That
 * is the property worth having, because the thing on the other side of "it
 * fits with three pixels to spare" is a popup twice the size it should be.
 *
 * Four unlabelled icons is not a smaller version of five labelled ones. A bell
 * and a sheet of paper do not say "Attention" and "Exams" to somebody who has
 * not already been told, and there is nothing on the screen that tells them.
 */
export function renderTabs(counts: Partial<Record<ViewName, number>>): void {
  tabsEl.replaceChildren();
  for (const name of VIEWS) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(name === state.view));
    // A tab strip with `aria-selected` and no `role` is a row of buttons one of
    // which claims to be selected — the attribute means nothing without it.
    tab.tabIndex = name === state.view ? 0 : -1;

    /*
     * The glyph, which the shipped design does not draw.
     *
     * `popup.css` hides `.tabs .icon`, so this costs the popup nothing as it
     * stands; the Classical design turns it on and stacks it over the label.
     * Built here rather than in that stylesheet because an icon is markup —
     * a `background-image` would be a second, wronger copy of `icons.ts`.
     */
    tab.append(icon(`tab-${name}` as IconName));

    const label = document.createElement("span");
    label.className = "tab--label";
    label.textContent = VIEW_LABEL[name] ?? name;
    tab.append(label);

    const count = counts[name] ?? 0;
    if (count > 0) {
      // Exams counts what is asking for an action (an exam already booked is
      // not); Alerts counts everything on it that is asking, and says so.
      const badge = document.createElement("span");
      badge.className = name === "exams" ? "chip-count is-warn" : "chip-count";
      badge.textContent = String(count);
      tab.append(badge);
      tab.title =
        name === "nodate"
          ? `${count} thing${count === 1 ? "" : "s"} waiting for you`
          : name === "sources"
            ? `${count} source${count === 1 ? "" : "s"} with something to press`
            : `${VIEW_LABEL[name] ?? name} — ${count} need${count === 1 ? "s" : ""} attention`;
    }

    if (!isFullView && FULL_VIEW_ONLY.has(name)) {
      tab.title = "Opens the full view — a month needs more width than a popup has";
    }
    tab.addEventListener("click", () => selectTab(name));
    tab.addEventListener("keydown", (event) => {
      // ← → moves between tabs, which is what a tablist does; Tab leaves the
      // strip entirely rather than walking five buttons.
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      const next = VIEWS[(VIEWS.indexOf(name) + step + VIEWS.length) % VIEWS.length]!;
      selectTab(next);
    });
    tabsEl.append(tab);
  }
  // The floating "+" clears this strip, and where the strip is is a fact about
  // the document that only a draw knows.
  placeQuickFab();
}

export function selectTab(name: ViewName): void {
  if (!isFullView && FULL_VIEW_ONLY.has(name)) {
    openFullView(name);
    return;
  }
  // A tab pressed while the add/edit form owns the view: the student wants the
  // list. Close the form first, or the write below is remembered while the
  // redraw it asked for is held by the form (R2 M3).
  if (state.editor) app.closeEditor();
  state.view = name;
  state.dayOffset = 0;
  writeStored(VIEW_KEY, name);
  /*
   * The strip is rebuilt by the redraw, and the tab that had focus goes with
   * it: ArrowRight selected the next view and then left `<body>` focused, so
   * the second ArrowRight did nothing (I01, 2026-09-19). The draw that rebuilds
   * the strip puts focus on the selected tab (popup/focus.ts).
   */
  requestFocus({ kind: "tab", view: name });
  void app.refresh();
}

/* -------------------------------------------------------------------------- */
/* Banners                                                                     */
/* -------------------------------------------------------------------------- */

interface Banner {
  /** An extra class on the line, for a banner a view needs to be able to name. */
  className?: string;
  tone: "info" | "warn" | "err";
  glyph: IconName;
  text: string;
  action?: { label: string; run: () => void };
}

/**
 * One slot, one line each, one action each.
 *
 * Three separate elements used to live here — notifications blocked, a stale
 * source, and the booking strip — each with its own height, its own colours and
 * its own idea of what a banner is. All three can be on screen at once, which
 * is 146px of a 600px window before the first deadline.
 *
 * The rule that keeps them short: if a banner needs a second sentence, the
 * second sentence belongs on the page it links to.
 */
export function renderBanners(stateIn: {
  sources: Record<Source, SourceStatus>;
  notificationsBlocked: boolean;
  items: Item[];
}): void {
  bannersEl.replaceChildren();
  const banners: Banner[] = [];

  if (stateIn.notificationsBlocked) {
    banners.push({
      tone: "err",
      glyph: "warning",
      text: "Chrome is blocking reminders, so nothing will notify you",
      action: {
        label: "How to fix",
        run: () => chrome.runtime.openOptionsPage(),
      },
    });
  }

  const stale = staleNotice(stateIn.sources, new Date());
  if (stale) {
    // Short enough to fit one 32px line beside an icon and a button at 400px —
    // about 45 characters. The longer sentence it replaces wrapped, and a
    // wrapped banner is 41px, which is only nine pixels until three of them
    // are on screen at once.
    const age =
      stale.hours === undefined
        ? "never read — nothing from it is listed"
        : `signed out ${stale.hours}h — rows may be old`;
    const login = signInUrl(stale.source, stateIn.sources[stale.source], "needs_login");
    banners.push({
      /*
       * Marked, because the Sources tab opens with this same sentence at
       * greater length, drawn from the same `staleNotice` (it was Alerts until
       * the list moved, 2026-09-19). Leaving both on screen means the tab's
       * first two lines say "Gradescope signed you out" one above the other.
       * The stylesheet hides *this one* on that tab —
       * hiding `#banners` wholesale, which is what the Needs-you screen did,
       * would take the "Deleted … · Undo" strip with it, on the one tab where
       * Hide and Tick off are pressed.
       */
      className: "banner--stale",
      tone: "warn",
      glyph: "warning",
      text: `${SOURCE_NAME[stale.source]}: ${age}`,
      ...(stale.needsLogin && login
        ? { action: { label: "Sign in", run: () => chrome.tabs.create({ url: login }) } }
        : {}),
    });
  }

  /*
   * "Deleted … · Undo", for ten seconds.
   *
   * In `#banners` rather than in the status line at the foot of the document:
   * the week view is about 1100px in a 600px window, so a message down there is
   * one nobody sees (UI house rule 3) — and this one has a *deadline* on it.
   */
  if (state.pendingUndo && Date.now() < state.pendingUndo.until) {
    banners.push({
      tone: "info",
      glyph: "info",
      text: `Deleted “${state.pendingUndo.title}”`,
      action: { label: "Undo", run: () => app.undoDelete() },
    });
  }

  /*
   * There is no booking banner any more (2026-09-19).
   *
   * §4.4 pinned one above the tabs per unbooked exam, on the argument that a
   * booking window closes whether or not the student has looked. With three
   * open windows that is three permanent amber lines above every tab, in a
   * 600px window, restating rows the Exams tab already carries under a "Not
   * booked" heading with the same window text and the same link — and the
   * Exams tab wears a badge counting exactly them (`examCount` is
   * `examBoard().unbooked.length`), so nothing is unannounced.
   */

  for (const banner of banners) bannersEl.append(renderBanner(banner));
}

function renderBanner(banner: Banner): HTMLElement {
  const line = document.createElement("div");
  line.className = `banner-line banner-${banner.tone}${banner.className ? ` ${banner.className}` : ""}`;
  const text = document.createElement("span");
  text.className = "banner-line--text";
  text.textContent = banner.text;
  // The full sentence is kept where it cannot be truncated away: a banner is
  // one line by design, and a course title can be longer than one line.
  text.title = banner.text;
  line.append(icon(banner.glyph), text);
  if (banner.action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-quiet btn-sm";
    button.textContent = banner.action.label;
    button.addEventListener("click", banner.action.run);
    line.append(button);
  }
  return line;
}

/**
 * The one channel a popup has when it cannot draw itself.
 *
 * Hidden the rest of the time. It used to be a permanent line at the bottom of
 * an 883px document carrying "Checked 11:16 PM · 5 of 6 sources OK · build
 * 20260912T041431" — a fact the header now states, a build id no student can
 * use, and 800px below the thing it described.
 *
 * **`#status` now sits at the top of the document, beside `#banners`.** It was
 * at the bottom, under `#view`, with a `scrollIntoView` to compensate — and
 * that works on a short list and not at all on a long one, because the popup is
 * not a scroll container, it is a 600px window on a 1100px document. Every
 * failure it reported for a month landed below the fold (UI rule 3). A banner
 * in the banner slot is reachable by construction.
 */
/** The draw-level notice last shown, so a dismissed refusal redraws it alone. */
let lastNotice: string | undefined;

export function showStatus(text: string | undefined): void {
  lastNotice = text;
  const lines: Banner[] = [];
  if (text) lines.push({ tone: "err", glyph: "warning", text });
  /*
   * A refused correction stays until it is answered.
   *
   * Every draw ends by calling this with its own notice — usually `undefined` —
   * and that call is what used to erase a refusal about 150ms after it
   * appeared: `reportOverride` wrote it, the unconditional refresh behind it
   * wiped it, and the student saw a row that did not change and no reason
   * (I03, 2026-09-19). The refusal is `state` now, like `pendingUndo`, and is
   * re-drawn here on every call until Dismiss or a later success clears it
   * (core/outcome.ts decides which answers are refusals).
   */
  if (state.actionError) {
    lines.push({
      tone: "err",
      glyph: "warning",
      text: state.actionError,
      action: {
        label: "Dismiss",
        run: () => {
          state.actionError = undefined;
          showStatus(lastNotice);
        },
      },
    });
  }
  statusEl.replaceChildren(...lines.map(renderBanner));
  statusEl.hidden = lines.length === 0;
}

/* -------------------------------------------------------------------------- */
/* The footer strip                                                            */
/* -------------------------------------------------------------------------- */

/*
 * The class on the footer's source button is `FOOT_HEALTH_CLASS`, one constant
 * (UI rule 7), declared in popup/focus.ts beside the lookup that returns focus
 * to the button when the Needs-you screen closes.
 */

/**
 * `[dot] 8 sources · synced 2m ago · Sync now` (D10).
 *
 * Sticky, in flow, at the foot of the document — `position: sticky` rather than
 * `fixed`, so it still contributes its height to the box Chrome measures. A
 * fixed strip contributes nothing, which is the same mechanism that clipped the
 * source list half way down its fifth row.
 *
 * **Every word here is derived from an attempt that happened** (worker rule 2).
 * `summarize` decides the counts, and the "synced" clock is the newest
 * `lastSuccessAt` across the sources that are checkable — not `lastSyncAt`,
 * which the loop writes whether or not anything succeeded, and which is exactly
 * how the old status line came to read "Synced 10:32" over four failures.
 *
 * **The source text is the button that opens Needs you (2026-09-19).** It was
 * the header pill's job, and the pill is gone; without this the screen that
 * holds late work, the suggestions waiting for a yes and every per-source
 * action would have no entry point at all. It is the right place for it: the
 * strip is already the sentence about the sources, so pressing it to read the
 * rest of that sentence is the gesture the line invites. Toggling, like the
 * pill did — pressing a second time is what everybody tries first to dismiss
 * what they opened. The hover text is `sourcesTooltip`, moved across with it.
 */
export function renderFooter(
  sources: Record<Source, SourceStatus>,
  now: Date,
): void {
  footerEl.replaceChildren();
  // One derivation, in core, mutation-tested: the first merged build carried
  // a second copy here that said "4 sources" in green over three sources that
  // had never been read (R3 B1). The strip prints what `footerLine` says.
  const line = footerLine(sources, isSyncing(), now);

  const dot = document.createElement("i");
  dot.className = `foot--dot is-${line.dot}`;

  const count = document.createElement("span");
  count.className = "foot--count";
  count.textContent = line.sources === "no sources" ? "No sources on" : line.sources;

  const when = document.createElement("span");
  when.className = "foot--when";
  when.textContent = line.sources === "no sources" ? "switch one on in Settings" : line.synced;

  footerEl.classList.toggle("foot--warn", line.tone === "warn" || line.tone === "err");

  const sep = document.createElement("span");
  sep.className = "foot--sep";
  sep.textContent = "·";

  // The dot, the count and the clock, as one press (`.foot--health`).
  const health = document.createElement("button");
  health.type = "button";
  health.className = FOOT_HEALTH_CLASS;
  // The screen it opens is in document flow rather than a dialog, so
  // `aria-expanded` rather than the popup `aria-haspopup` would promise.
  /*
   * A tab selector since 2026-09-19, so it says which tab it selects.
   *
   * It used to open the Needs-you screen in front of the calendar and carried
   * `aria-expanded` for it. The list it opened is the **Sources** tab since
   * 2026-09-19, so this is one more way to reach a tab that is already on the
   * strip with a badge on it — `aria-pressed` states whether that tab is the
   * one showing, which is what a toggle button owes a screen reader.
   */
  health.setAttribute("aria-pressed", state.view === "sources" ? "true" : "false");
  health.title = sourcesTooltip(sources, now);
  health.append(dot, count, sep, when);
  health.addEventListener("click", (event) => {
    event.stopPropagation();
    // Nothing async behind this press — it selects a tab on the next redraw —
    // so there is no "Applying…" to show (UI rule 4). Not a toggle any more:
    // there is nothing to toggle back *to*, because the thing it used to open
    // no longer sits in front of another view.
    selectTab("sources");
  });

  /*
   * The sync button, moved off the header (D10).
   *
   * It belongs next to the sentence that reports what it did. In the header it
   * was one of five icons, and the only feedback a press produced was a
   * spinner 500px above the line that would eventually say whether it worked.
   */
  const sync = document.createElement("button");
  sync.type = "button";
  sync.className = "foot--sync";
  /*
   * The glyph, drawn always and shown only under Classical.
   *
   * Same argument as the two marks in `renderHealth`: the stylesheet is the
   * only thing that knows which design is on, and it is the only thing that
   * stays right when the design changes under an open popup. The label keeps
   * its own element so `text-transform` reaches the words and not the SVG.
   */
  sync.append(icon("sync"));
  const syncLabel = document.createElement("span");
  syncLabel.className = "foot--sync-label";
  syncLabel.textContent = state.syncing ? "Syncing…" : "Sync now";
  sync.append(syncLabel);
  sync.disabled = state.syncing;
  if (state.syncing) sync.dataset["busy"] = "true";
  sync.addEventListener("click", (event) => {
    event.stopPropagation();
    void app.runSync();
  });

  footerEl.append(health, sync);
  /*
   * Nothing after the strip.
   *
   * A `#ledger` row used to follow it with "Sources & needs-you ledger ›" and
   * "Full view". The first opened the sources list, which is what the health
   * button three lines above already reaches; the second called
   * `openFullView()`, which `openHeaderMenu` already offers. Two duplicates for
   * 45px of a 600px window (2026-09-19).
   */
}

/* -------------------------------------------------------------------------- */
/* Course chips — kept, no longer drawn                                        */
/* -------------------------------------------------------------------------- */

/**
 * The course chips: the colour legend and the filter, as one control.
 *
 * **Not rendered any more** — D9 moves course visibility into the header's ⋯,
 * and the strip cost a permanent 36px row of a 600px window. Kept, and kept
 * reachable, because it is the only control that shows a switched-off course
 * *on screen* rather than in a menu, and the "N hidden" note with it; if the
 * menu turns out to bury the fact that a course is off, this is the thing to
 * put back.
 *
 * A switched-off course stays on screen, hollow and struck through, with a
 * count of what it is hiding. A filter that silently removes work is the
 * failure §11 ranks worst, and this one persists across popup opens.
 */
/**
 * One line that says courses are off, while any are (inventory F35).
 *
 * The Courses menu is the only place a course is switched off since D9, and a
 * menu closes; a list that is quietly missing a course is the silent-empty
 * failure with a checkbox behind it. So the strip that used to hold the chips
 * holds one sentence and one button instead, and only while it is true.
 */
export function renderHiddenNote(): void {
  filtersEl.replaceChildren();
  const count = state.hidden.size;
  if (count === 0) return;
  const note = document.createElement("span");
  note.className = "fnote";
  note.textContent = count === 1 ? "1 course hidden" : `${count} courses hidden`;
  const show = document.createElement("button");
  show.type = "button";
  show.className = "btn btn-sm";
  show.textContent = "Show all";
  show.addEventListener("click", () => {
    state.hidden.clear();
    writeStored(HIDDEN_KEY, JSON.stringify([]));
    void app.refresh();
  });
  filtersEl.append(note, show);
}

export function renderFilters(items: Item[], colours: Map<string, number>): void {
  filtersEl.replaceChildren();
  const courses = coursesIn(items);
  if (courses.length < 2) return; // Nothing to filter between.

  for (const course of courses) {
    const on = !state.hidden.has(course);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `fchip course-${colours.get(course) ?? 0}`;
    chip.setAttribute("aria-pressed", String(on));
    chip.title = on
      ? `Hide ${courseLabel(course, state.courseNames)}`
      : `Show ${courseLabel(course, state.courseNames)} again`;
    const dot = document.createElement("i");
    const label = document.createElement("span");
    label.textContent = courseLabel(course, state.courseNames);
    chip.append(dot, label);
    chip.addEventListener("click", () => {
      if (state.hidden.has(course)) state.hidden.delete(course);
      else state.hidden.add(course);
      writeStored(HIDDEN_KEY, JSON.stringify([...state.hidden]));
      void app.refresh();
    });
    filtersEl.append(chip);
  }

  const buried = items.filter((item) => state.hidden.has(item.courseLabel)).length;
  if (buried > 0) {
    const note = document.createElement("span");
    note.className = "fhidden";
    note.textContent = `${buried} hidden`;
    note.title = "Switched off here, not gone. Click a struck-through course to bring it back.";
    filtersEl.append(note);
  }
}

/* -------------------------------------------------------------------------- */
/* Date navigator                                                              */
/* -------------------------------------------------------------------------- */

/**
 * ‹ Sat, Sep 12 ›, and a way back.
 *
 * The arrows sit either side of the label rather than at the two ends of a
 * 400px bar: they are a pair of controls that do the same thing in opposite
 * directions, and 340px apart they read as two unrelated buttons. The label is
 * what they act on, so it goes between them.
 *
 * "Today" appears only once there is somewhere to come back from. A button that
 * does nothing is a button that has to be read before it can be ignored.
 */
/**
 * The year the week on screen ends in — `Sep 20 – Sep 26, 2024` (spec §4).
 *
 * The month heading already carries its year and the day heading is anchored
 * on today, so the week was the one running head that named a date with no
 * year on it: `Sep 20 – 26` is the same seven words in 2024 and in 2026, and
 * this navigator is the only thing on screen that says which one you stepped
 * into.
 *
 * The **last** day's year, not the anchor's: the one week a year that straddles
 * New Year is the one week where the two disagree, and the reader is looking at
 * a range that ends in January. And it is `weekContents` that decides which
 * seven days those are — the same call `navFor` makes to build the label — so
 * this is a second *reader* of that decision rather than a second copy of it.
 * A local "the anchor, plus six" would be exactly the second copy, and would
 * drift the first time the week mode changes.
 */
function weekRangeYear(): number {
  const now = new Date();
  const days = weekContents([], anchorDate(now), now, WEEK_MODE);
  return days[days.length - 1]!.date.getFullYear();
}

/**
 * `step` says how far ‹ › move. It does **not** say whether the strip exists.
 *
 * It used to say both, and that cost Today its date (Sushi, 2026-09-19: "today
 * doesnt even show the date"). `navFor` builds `Today · Mon, Sep 22` and then
 * returns `step: 0`, because the day view's arrows were deliberately removed —
 * Today is anchored on now, and the week and the month are where a student
 * moves through time. This function read that 0 as "no strip", hid `#nav` and
 * returned before it appended anything, so the label was computed on every
 * draw and thrown away. One number answering two questions, and the view that
 * wanted a label with no arrows had no way to say so.
 *
 * So the two questions are separated: **the label decides whether the strip is
 * drawn** (`default:` in `navFor` returns `""`, which is the view that genuinely
 * has no running head), and **step decides whether the arrows are**. Week (7)
 * and Month (28) are unchanged in both, which is what keeps `views/week.ts`
 * and `views/month.ts` — both of which append controls into this strip after it
 * is built, one of them by looking `.datenav--label` up — working exactly as
 * they did.
 */
export function renderDateNav(label: string, step: number): void {
  dateNavEl.replaceChildren();
  dateNavEl.hidden = label === "";
  if (label === "") return;

  const text = document.createElement("span");
  text.className = "datenav--label";
  text.textContent = step === 7 ? `${label}, ${weekRangeYear()}` : label;

  if (step === 0) {
    // A running head and nothing to press. Today is the only view here, and
    // the arrows are not coming back (brief D4).
    dateNavEl.append(text);
  } else {
    // Named, not selected by position. The month sheet styled this pair with
    // `:first-child` / `:last-child`, and the "Today" pill is appended AFTER
    // `forward` whenever the student has stepped off today — so `forward`
    // stopped being the last child and silently lost both its `order` and its
    // rounded outer corners (measured radius 0px, square corners on the
    // outside of the pair). A class cannot be taken away by a sibling.
    const back = iconButton("left", "Back");
    back.classList.add("datenav--step", "datenav--back");
    back.classList.add("btn-sm");
    back.addEventListener("click", () => {
      state.dayOffset -= step;
      void app.refresh();
    });

    const forward = iconButton("right", "Forward");
    forward.classList.add("datenav--step", "datenav--fwd");
    forward.classList.add("btn-sm");
    forward.addEventListener("click", () => {
      state.dayOffset += step;
      void app.refresh();
    });

    dateNavEl.append(back, text, forward);
  }

  if (state.dayOffset !== 0) {
    const today = document.createElement("button");
    today.type = "button";
    today.className = "btn btn-quiet btn-sm datenav--today";
    today.textContent = "Today";
    today.addEventListener("click", () => {
      state.dayOffset = 0;
      void app.refresh();
    });
    dateNavEl.append(today);
  }
}

/* -------------------------------------------------------------------------- */
/* Menus                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Whether a redraw may run, and the note that it is owed if not.
 *
 * Two things on this page hold a draw off: an open row menu (see
 * `redrawAfterMenu`) and an open editor, which is the same argument one step
 * further — a redraw calls `viewEl.replaceChildren()`, so a student half way
 * through typing a title would watch the form vanish mid-word. Six things
 * redraw this page and none of them is the student.
 *
 * Deferred, never skipped: the list is stale until whichever panel is open
 * closes, and then it catches up. Both closers run the deferred draw.
 *
 * Any open editor blocks, not only a dirty one. The rule was written as
 * "an editor with unsaved input", and a clean editor is one whose date was
 * prefilled by the drag that opened it — losing that is losing the gesture.
 * `isDirty` is still read, for the confirmation on Escape.
 */
/**
 * Whether a mouse button is currently down inside the list.
 *
 * `pointerdown`/`pointerup` on the document in the capture phase, so no
 * handler can stop it being seen. `pointercancel` counts as a release: a
 * gesture that Chrome takes over (a scroll, a drag) will never produce a
 * `click`, and a flag left set there would hold every redraw until the next
 * press.
 */
const press = createPressHold((run) => setTimeout(run, 0));
function endPress(): void {
  press.release(() => {
    state.redrawAfterPress = false;
    void app.refresh();
  });
}
document.addEventListener(
  "pointerdown",
  (event) => {
    press.begin(event.target instanceof Element && !!event.target.closest("#view"));
  },
  { capture: true },
);
document.addEventListener("pointerup", endPress, { capture: true });
document.addEventListener("pointercancel", endPress, { capture: true });

export function drawIsHeld(): boolean {
  /*
   * A press in progress holds the draw — deferred, never skipped, like the
   * two below it.
   *
   * A redraw between mousedown and mouseup replaces the element under the
   * finger, and the `click` then fires on whatever ancestor survived: the tick
   * box did nothing and the row it sits on opened instead. Held here rather
   * than guarded at each of the six things that redraw, for the reason
   * `redrawAfterMenu` is: three of them checked and three did not.
   */
  if (press.hold()) {
    state.redrawAfterPress = true;
    return true;
  }
  const open = document.querySelector<HTMLElement>(MENU_SELECTOR);
  // A row menu is anchored to a row the redraw would replace, so the redraw
  // waits. The Appearance panel is anchored to the header, which no redraw
  // touches, and its two row tweaks are *for* watching the list change under
  // it (R1 seam 4: a tweak did nothing until the panel was dismissed).
  if (open && !("survivesRedraw" in open.dataset)) {
    state.redrawAfterMenu = true;
    return true;
  }
  if (state.editor) {
    state.redrawAfterEditor = true;
    return true;
  }
  return false;
}

/**
 * Which control opened which panel. `closeMenus` clears `aria-expanded` on
 * exactly these anchors: a sweep of every `[aria-expanded="true"]` in the
 * document also stripped it from the pill, whose expanded state means "the
 * Needs-you screen is open" and is nobody's panel (R2 M6).
 */
const menuAnchors = new WeakMap<Element, HTMLElement>();
/** Listeners a panel put on `window`, taken off when it closes. */
const menuCleanups = new WeakMap<Element, () => void>();

export function closeMenus(): void {
  const open = [...document.querySelectorAll<HTMLElement>(MENU_SELECTOR)];
  for (const panel of open) {
    menuAnchors.get(panel)?.removeAttribute("aria-expanded");
    menuCleanups.get(panel)?.();
    panel.remove();
  }
  // The room a panel asked for is given back the moment it closes, or the popup
  // stays that tall with nothing in the space. See `placeFloating`.
  document.body.style.minHeight = "";
  if (open.length > 0 && state.redrawAfterMenu) {
    state.redrawAfterMenu = false;
    void app.refresh();
  }
}

/**
 * Put a floating panel under its anchor, in a window that can hold it.
 *
 * The bug this exists for: the source list opened from the health pill was cut
 * off half way down its fifth row. A floating panel is positioned out of flow,
 * so it contributes **nothing** to the document's height — and Chrome sizes an
 * extension popup by measuring exactly that. On a tab with a short list the
 * window was 330px tall and the panel needed 240 from y=66, so the browser
 * simply clipped it. Nothing in the popup could scroll to reveal it, because
 * the popup was not scrollable; it was small.
 *
 * This is the same mechanism as the note at the top of popup.css, from the
 * other side. That one is about *taking away* the height Chrome measures; this
 * one is about a panel that never contributed any.
 *
 * So two things, and both are needed:
 *
 * 1. **Ask for the room.** A temporary `min-height` on `body` — in pixels, and
 *    removed on close — gives Chrome a taller box to measure, and it resizes an
 *    open popup when the document changes. This is not the forbidden thing from
 *    colour-layer.md: a percentage or a viewport unit removes the intrinsic
 *    height, a pixel minimum supplies one.
 * 2. **Cope without it.** The panel is capped at what a popup can ever be and
 *    scrolls inside itself, so the worst case is a scrollbar rather than a row
 *    that is not there.
 */
export function placeFloating(
  panel: HTMLElement,
  anchor: HTMLElement,
  align: "left" | "right",
): void {
  const box = anchor.getBoundingClientRect();
  panel.style.position = "fixed";
  panel.style.overflowY = "auto";

  // The full view is an ordinary tab and its window is however tall it is; the
  // popup is capped by the browser whatever the document says.
  const ceiling = isFullView ? window.innerHeight : MAX_POPUP_HEIGHT;

  /*
   * Downward if it fits, upward if it does not.
   *
   * This only ever opened downward, and the `Math.max(140, …)` floor below made
   * that worse: faced with 31 pixels of room it refused to shrink under 140 and
   * then ran off the bottom anyway. In the popup nothing can rescue that —
   * `MAX_POPUP_HEIGHT` is Chrome's cap, so growing the document cannot reveal
   * what is past it, and a panel positioned `fixed` does not scroll into view.
   *
   * Reported as "hide doesn't work in week view", which is what it looks like:
   * week is the tallest list there is — seven day rows, 1113px of document in a
   * 600px window — so its rows sit low far more often than a day's do, and
   * **Hide and Merge are the third and fourth of five menu items**. The menu
   * opened, the student saw the top of it, and the two entries they wanted were
   * below the fold. Measured: a menu for the last week row opened at y=561 and
   * ended at 711.
   *
   * Measured before a max-height is applied, so `offsetHeight` is the height the
   * panel actually wants rather than one this function has already clamped.
   */
  panel.style.maxHeight = "";
  const wanted = panel.offsetHeight;
  const below = ceiling - (box.bottom + 4) - 8;
  const above = box.top - 4 - 8;
  // Ties and near-ties go downward: that is where a menu is expected, and
  // flipping for a few pixels makes the control feel unpredictable.
  const flip = wanted > below && above > below;
  const top = flip ? Math.max(8, box.top - 4 - Math.min(wanted, above)) : box.bottom + 4;
  panel.style.top = `${top}px`;
  // The floor is what asks Chrome for room (see `minHeight` below), so it stays;
  // but it must never push the panel past the ceiling — with 120px below and a
  // 140px floor the menu ran 20px off the bottom of a document that cannot
  // grow. Clamped to what is left under `top`, and never so small as to be
  // unusable: 60px is two rows and a scrollbar.
  const room = flip ? above : below;
  let cap = Math.max(140, room);
  // An anchor can only sit past the ceiling in a harness whose viewport is
  // taller than a popup can be; there the ceiling says nothing about the room.
  const untilCeiling = ceiling - top - 8;
  if (untilCeiling > 0) cap = Math.min(cap, untilCeiling);
  panel.style.maxHeight = `${Math.max(60, cap)}px`;

  if (align === "right") {
    panel.style.right = `${Math.max(8, document.documentElement.clientWidth - box.right)}px`;
    panel.style.left = "";
  } else {
    const width = panel.offsetWidth;
    const max = document.documentElement.clientWidth - width - 8;
    panel.style.left = `${Math.max(8, Math.min(box.left, max))}px`;
    panel.style.right = "";
  }

  // Measured after the cap and the width are set, so this is the height the
  // panel will actually occupy rather than the one it would like. Only when it
  // opens downward: a panel that flipped upward is already inside the document
  // Chrome is showing, and growing `minHeight` for it would add empty space
  // under the list for nothing.
  //
  // And only in the popup. Asking for room is how a page makes Chrome grow a
  // popup window; the full view is an ordinary tab that is already as tall as
  // it is, so the same write there is a `min-height` SHORTER than the window
  // (this caps at 600) fighting the full view's own `min-height: 100vh`.
  // Measured with a held press on a row menu in the full view: `#tabs` was
  // yanked from y=947 to y=629.7 for as long as the menu stayed open.
  // `placeQuickPanel` already had this guard; this one did not, which is why
  // `popup.css` briefly needed an `!important` to out-rank it.
  if (!flip && !isFullView) {
    document.body.style.minHeight = `${Math.min(MAX_POPUP_HEIGHT, top + panel.offsetHeight + 8)}px`;
  }
}

document.addEventListener("click", closeMenus);
// A fixed panel does not travel with the document, so a page scrolled under an
// open menu would leave it pointing at a different row. Closing is what every
// other menu does, and it is the only option that cannot mislead.
window.addEventListener(
  "scroll",
  (event) => {
    // Capture on `window` sees every scroll, including the menu's own: it is
    // `overflow-y: auto` with a height floor below its content, so scrolling
    // to reach "Merge with…" deleted the menu being scrolled.
    const menu = document.querySelector(MENU_SELECTOR);
    if (menu && event.target instanceof Node && menu.contains(event.target)) return;
    closeMenus();
  },
  { passive: true, capture: true },
);
// Escape closes from anywhere, including from the row the menu was opened on.
// Without it the only way out of an open menu with the keyboard was Tab, which
// walked *into* it and then out the far side of the page.
document.addEventListener("keydown", (event) => {
  const menu = document.querySelector<HTMLElement>(MENU_SELECTOR);
  if (event.key === "Escape" && menu) {
    event.preventDefault();
    // This listener is registered first (import order), so the screens' own
    // Escape handlers run after it — and their "not while a menu is open"
    // guards would look at a document the menu has just left. One press, one
    // owner: the menu takes it and nothing behind it sees it (R2 M1).
    event.stopImmediatePropagation();
    const anchor = menuAnchors.get(menu);
    closeMenus();
    anchor?.focus();
  }
});

/**
 * Arrow keys inside an open menu, and focus back where it came from on close.
 *
 * A menu is a list, so ↑ ↓ Home End are what a list does — and `data-active`
 * rather than `:focus` for the highlight, so hovering the mouse over a
 * different row while arrowing does not leave two rows looking selected with
 * only one of them reachable by Enter.
 *
 * Returning focus to `anchor` is the part that is easy to leave out and
 * impossible to work around: without it, closing a menu drops focus onto
 * `<body>` and the next Tab starts again from the top of the popup.
 */
export function trapMenuKeys(menu: HTMLElement, anchor: HTMLElement): void {
  const items = () => [...menu.querySelectorAll<HTMLElement>(".menu-item:not(:disabled)")];
  anchor.setAttribute("aria-expanded", "true");
  menuAnchors.set(menu, anchor);

  const focusAt = (index: number) => {
    const all = items();
    if (all.length === 0) {
      // A panel of radios and switches (Appearance) has no `.menu-item`, and
      // a dialog focus cannot enter is one the keyboard cannot leave (R2 L6).
      menu.querySelector<HTMLElement>("input:not(:disabled), button:not(:disabled), [tabindex='0']")?.focus();
      return;
    }
    const wrapped = (index + all.length) % all.length;
    for (const item of all) delete item.dataset["active"];
    all[wrapped]!.dataset["active"] = "true";
    all[wrapped]!.focus();
  };

  menu.addEventListener("keydown", (event) => {
    const all = items();
    const here = all.findIndex((item) => item === document.activeElement);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(here + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(here - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(all.length - 1);
        break;
      default:
        break;
    }
  });

  /*
   * Losing focus out of the menu closes it. A menu left open behind the page it
   * no longer belongs to is how a click lands on the wrong row.
   *
   * **This is where every mouse press on the menu used to die.** `focusAt(0)`
   * puts focus inside the menu the instant it opens, so a real mousedown on
   * "Hide" moves focus from item 0 to the pressed button — and the browser
   * fires `focusout` *before* it updates `document.activeElement`. The old
   * version asked `queueMicrotask` to look; a microtask runs in exactly that
   * gap, saw `<body>`, and removed the menu between mousedown and mouseup. No
   * mouseup on the same element means no `click`, so the handler never ran,
   * "Applying…" never appeared, and the worker heard nothing. The health
   * popover shares this code and always worked, because it has no
   * `.menu-item` for `focusAt` to focus. A synthetic `.click()` and a
   * programmatic `blur()` never produce that sequence, which is why every
   * harness passed (UI house rule 5).
   *
   * `relatedTarget` is the element *gaining* focus and is known during the
   * event itself. A press on non-focusable menu chrome reports none.
   *
   * **And one task is not enough either** (2026-09-19, the Appearance panel).
   * A mousedown on a `<label>` — not focusable — blurs the radio that has
   * focus, with no `relatedTarget`; the radio only regains focus on the
   * *click*, which comes at mouseup. A machine press is over in 0ms and a
   * task queued at mousedown runs after the click, so every harness passed.
   * A human press holds for 80–150ms, so the task ran in the middle of it,
   * saw `<body>`, and removed the panel before mouseup; the release landed on
   * a row underneath and "Light" never applied. Reproduced with a 26ms held
   * press, which is the check to use (UI house rule 5).
   *
   * Two rules follow, and both are needed. A press on non-focusable chrome
   * inside the menu must not move focus at all — `preventDefault` on that
   * mousedown, which keeps focus where it was and still lets the click
   * activate the label. And the decision "has focus really left" is never
   * taken while a press that started inside the menu is still held: it waits
   * for the release, then one task, then looks.
   */
  let pressing = false;
  menu.addEventListener(
    "mousedown",
    (event) => {
      pressing = true;
      const target = event.target instanceof Element ? event.target : null;
      if (target && !target.closest("input, button, select, textarea, a[href], [tabindex]")) {
        event.preventDefault();
      }
    },
    true,
  );
  const released = () => {
    pressing = false;
  };
  window.addEventListener("mouseup", released, true);
  window.addEventListener("pointercancel", released, true);
  window.addEventListener("dragend", released, true);
  menuCleanups.set(menu, () => {
    window.removeEventListener("mouseup", released, true);
    window.removeEventListener("pointercancel", released, true);
    window.removeEventListener("dragend", released, true);
  });

  menu.addEventListener("focusout", (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && menu.contains(next)) return;
    const settle = () => {
      if (!menu.isConnected) return;
      if (pressing) {
        // A press is in flight; where focus lands is decided by its release.
        setTimeout(settle, 30);
        return;
      }
      if (menu.contains(document.activeElement)) return;
      // Through `closeMenus`, never `menu.remove()`: that is what consumes
      // `redrawAfterMenu` and gives back the body's min-height (R2 M2).
      closeMenus();
      anchor.removeAttribute("aria-expanded");
    };
    setTimeout(settle, 0);
  });

  focusAt(0);
}

/**
 * One entry. Shared by the row menu, the header menu and the deadline screen's
 * ⋯ (`screens/deadline.ts`), so all three behave alike.
 */
export function menuItem(
  label: string,
  glyph: IconName,
  onClick: (entry: HTMLElement) => void,
): HTMLButtonElement {
  const entry = document.createElement("button");
  entry.type = "button";
  entry.className = "menu-item";
  entry.setAttribute("role", "menuitem");
  entry.tabIndex = -1;
  entry.append(icon(glyph), document.createTextNode(label));
  entry.addEventListener("click", () => onClick(entry));
  return entry;
}

/* -------------------------------------------------------------------------- */
/* Corrections                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * "Applying…" on the pressed control, and the way to take it back.
 *
 * Feedback and a diagnostic at once (UI rule 4): a correction is a round trip
 * to the service worker, it was always wrong for that to look instantaneous,
 * and if this word never appears the click handler never ran — a different bug
 * from every one investigated so far, and one that says so without a console.
 * Four rounds of "I click Hide and nothing happens" produced no evidence
 * because every channel that could have carried it was somewhere nobody was
 * looking; the one place a student is definitely looking is the thing they
 * just clicked.
 *
 * The returned function puts the control back. A refusal now leaves the row as
 * it was (see `settleCorrection`), so the control has to say its own label
 * again and answer a second press — otherwise a refusal reads as "still
 * applying", forever.
 */
function markBusy(control: HTMLElement | undefined, busy: () => Node[]): () => void {
  if (!control) return () => undefined;
  const before = [...control.childNodes];
  const wasDisabled = control instanceof HTMLButtonElement && control.disabled;
  const siblings = [...(control.parentElement?.querySelectorAll("button") ?? [])].map(
    (other) => [other, other.disabled] as const,
  );
  control.replaceChildren(...busy());
  if (control instanceof HTMLButtonElement) control.disabled = true;
  for (const [other] of siblings) other.disabled = true;
  return () => {
    control.replaceChildren(...before);
    if (control instanceof HTMLButtonElement) control.disabled = wasDisabled;
    for (const [other, disabled] of siblings) other.disabled = disabled;
  };
}

/**
 * What happens to a correction's answer — the same for every correction.
 *
 * Success redraws, and clears whatever refusal was on screen: the list is
 * about to say what the store now says. A refusal does **not** redraw. It
 * used to — `send(…).then(reportOverride).then(() => refresh())` — and the
 * refresh's own `showStatus(undefined)` erased the refusal 150ms after
 * `reportOverride` wrote it, leaving a row that had not changed and no reason
 * (I03, 2026-09-19). Now the refusal is kept in `state.actionError`, the
 * pressed control is restored so it can be pressed again, and `showStatus`
 * keeps the sentence on screen through every later draw until it is dismissed
 * or a later correction succeeds. Which answers are refusals is
 * `core/outcome.ts`'s decision, where a test can reach it.
 *
 * The menu closes on either answer: it is anchored to a row that a redraw, or
 * the student's next press, is about to replace.
 */
function settleCorrection(outcome: ActionOutcome, restore: () => void): void {
  closeMenus();
  if (outcome.ok) {
    state.actionError = undefined;
    void app.refresh();
    return;
  }
  restore();
  state.actionError = outcome.message;
  showStatus(lastNotice);
}

/**
 * Add, Ignore and undo, with the same guarantees `applyOverrideAction` gives.
 *
 * Three things, every time, because each one was missing once and cost rounds
 * of Sushi's time: the pressed control says "Applying…" so "the click never
 * ran" and "the round trip failed" are distinguishable with no console (UI rule
 * 4); the `send` is `.catch`ed so a stale worker's explanation reaches the
 * screen rather than an unhandled rejection nobody sees (UI rule 2); and the
 * request is logged on this side, because the popup's console and the worker's
 * are different windows.
 */
export function applySuggestionRequest(request: Request, control?: HTMLElement): void {
  const restore = markBusy(control, () => [document.createTextNode("Applying…")]);
  console.log(`[illini-dash] ${request.type} requested`);
  void send(request)
    .then((response) => settleCorrection(actionOutcome(response), restore))
    .catch((error: unknown) => {
      settleCorrection(
        { ok: false, message: error instanceof Error ? error.message : String(error) },
        restore,
      );
    });
}

/**
 * Send one correction, and never lose the answer.
 *
 * All four of these — done, hide, split, merge — were written as
 * `void send(…).then(…).then(…)` with **no `.catch`**, so a rejection became an
 * unhandled promise rejection: nothing in the UI, and nothing in the service
 * worker's console either, because a popup's errors go to the popup's own
 * console and nobody opens that. Sushi, on the third round of this: "I'm
 * clicking on hide but nothing's hiding, doesn't show up in the backend
 * either." Both halves of that were literally true and neither was the bug —
 * they were two silent channels stacked on one.
 *
 * `send` rejects for a reason worth reading, too: it is the call that turns a
 * worker running older code than this page into a sentence telling you to
 * reload the extension. Swallowing it hid exactly the message that explains the
 * commonest cause.
 *
 * One function rather than four call sites, because four copies of an error
 * path is four chances for the next one to be written without it.
 */
export function applyOverrideAction(action: OverrideAction, entry?: HTMLElement): void {
  const restore = markBusy(entry, () => [icon("sync"), document.createTextNode("Applying…")]);
  // Logged on this side too, because the two consoles are different windows: a
  // popup's output never appears in the service worker's, and the worker's
  // never appears in the popup's. Chasing this across three rounds, both were
  // silent for different reasons and each looked like proof the other was at
  // fault. This line says the click was heard, before anything can go wrong.
  console.log(`[illini-dash] ${action.kind} requested for ${action.itemId}`);
  void send({ type: "override", action })
    .then((response) => settleCorrection(actionOutcome(response), restore))
    .catch((err: unknown) => {
      settleCorrection(
        {
          ok: false,
          message: `Could not ${action.kind} that row: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
        restore,
      );
    });
}

/**
 * §8.1's row menu: Hide, Split (if merged), Merge with…, Add to Google Calendar.
 *
 * §5.3 leans on this: a false merge is visible because the row shows two source
 * labels, and the fix is meant to be one click. G3 budgets two corrections a
 * semester, which only works if making one is trivial.
 */
export function openRowMenu(item: Item, anchor: HTMLElement): void {
  closeMenus();
  const menu = document.createElement("div");
  menu.className = MENU_CLASS;
  menu.setAttribute("role", "menu");
  menu.addEventListener("click", (event) => event.stopPropagation());

  const add = (label: string, glyph: IconName, onClick: (entry: HTMLElement) => void) => {
    menu.append(menuItem(label, glyph, onClick));
  };

  /*
   * First: done.
   *
   * It was second, under "Open in …", while the row carried a tick box of its
   * own — so the menu was the second way to mark something done and could
   * afford to lead with something else. The tick box went on 2026-09-19
   * ("why do you have 3 dots, a checkbox and an arrow, pick one bro"), which
   * makes this the **only** route to it, and the first item is where the only
   * route belongs. Two of the five sources can never report completion, so
   * without it a finished course-site row sits in the Alerts tab for a week
   * with only Hide as an escape.
   */
  add(item.done ? "Not done" : "Mark done", item.done ? "close" : "check", (entry) => {
    applyOverrideAction({ kind: item.done ? "undone" : "done", itemId: item.id }, entry);
  });

  /*
   * Then a date, for a row that has none (2026-09-19).
   *
   * The two undated groups on Alerts used to carry this as a filled button on
   * every card, beside Tick off and Hide. Sushi, on twelve of them: "i dont
   * like how theres 3 large choices, rather would just have it in the 3 dot
   * option to give a date, mark as done, or hide." Two of the three were
   * already here; this is the third, so the card can drop the line entirely
   * and a row's answers are in one place on every tab.
   *
   * **Only when the row has no date this extension trusts.** A student who
   * types a date over a *stated* one is a different feature (§5.3's open
   * decision on precedence) that this entry must not quietly become. So the
   * test is the pair of conditions that put a row in those two groups: no
   * instant at all, or an instant whose source text could not be read —
   * `unreadableDeadline`, the same derivation the card's amber chip and the
   * group itself use, rather than a third spelling of it here.
   *
   * It opens a form, so it reports nothing and must not say "Applying…" (UI
   * rule 4); `closeMenus` first, because the menu would otherwise outlive the
   * document the screen replaces.
   */
  if (item.dueAt === undefined || unreadableDeadline(item).length > 0) {
    add("Give it a date", "edit-calendar", () => {
      closeMenus();
      app.openGiveDate(item);
    });
  }

  /*
   * Then the site the row came from.
   *
   * Clicking the row already does this, but nothing on screen said so — the
   * only hint was a tooltip on a 40px column. Naming the site here is also the
   * one place a student learns which of five sites an assignment lives on
   * without hovering anything.
   */
  const open = safeUrl(item.url);
  if (open) {
    const primary = item.members[0]?.source;
    add(`Open in ${primary ? SOURCE_NAME[primary] : "the source"}`, "open-tab", () => {
      closeMenus();
      chrome.tabs.create({ url: open });
    });
  }

  add(item.hidden ? "Unhide" : "Hide", item.hidden ? "plus" : "close", (entry) => {
    applyOverrideAction({ kind: item.hidden ? "unhide" : "hide", itemId: item.id }, entry);
  });

  if (item.members.length > 1) {
    add(`Split (${item.members.length} sources)`, "more", (entry) => {
      applyOverrideAction({ kind: "split", itemId: item.id }, entry);
    });
  }

  // Only same-course rows are offered: §5.3 never merges across courses, so an
  // all-items picker would mostly be a list of things that cannot be chosen.
  // §5.1's own test, not the derived label. `courseLabel` is the *first*
  // member's code, while `sameCourse` matches on any code including altCodes —
  // so a cross-listed course ("CS425 ECE428", "ECE 391 / CS 391", both in this
  // repo's fixtures) could otherwise never be re-merged after a split.
  const candidates = state.currentItems.filter(
    (other) =>
      other.id !== item.id &&
      !other.hidden &&
      other.members.some((mine) => item.members.some((theirs) => sameCourse(mine, theirs))),
  );
  if (candidates.length > 0) {
    add("Merge with…", "plus", () => {
      menu.replaceChildren();
      const heading = document.createElement("div");
      heading.className = "menu-heading";
      heading.textContent = `Merge "${item.title}" with:`;
      menu.append(heading);
      for (const other of candidates.slice(0, 12)) {
        add(other.title, "plus", (entry) => {
          applyOverrideAction({ kind: "merge", itemId: item.id, otherItemId: other.id }, entry);
        });
      }
      // The pressed entry was just removed with the rest, and focus with it;
      // put it on the first candidate so the arrows and Escape still work.
      menu.querySelector<HTMLElement>(".menu-item")?.focus();
    });
  }

  const calendar = googleCalendarUrl(item);
  if (calendar) {
    add("Add to Google Calendar", "tab-month", () => chrome.tabs.create({ url: calendar }));
  }

  /*
   * A row the student typed is the only row they may rewrite or remove.
   *
   * Appended after the existing entries rather than led with: everything above
   * works the same way on every row, and a menu whose first two items move
   * about depending on where a deadline came from is one that has to be read
   * every time.
   */
  const mine = soleManualMember(item);
  if (mine) {
    add("Edit", "settings", () => {
      closeMenus();
      app.openEditEditor(item, mine);
    });
    add("Delete", "close", (entry) => app.deleteManual(item, mine, entry));
  }

  document.body.append(menu);
  placeFloating(menu, anchor, "right");
  trapMenuKeys(menu, anchor);
}

/**
 * The manual member of a row, when the row is *only* that.
 *
 * Edit and Delete are offered on a row with one member from the `manual`
 * source and no others. A merged row — a typed deadline the student also has on
 * Gradescope — is deliberately left alone: deleting it would take the typed
 * half out from under a row that stays on screen anyway, and editing it would
 * rewrite a title Gradescope may outrank. Split first, then edit the half that
 * is yours.
 */
export function soleManualMember(item: Item): Item["members"][number] | undefined {
  if (item.members.length !== 1) return undefined;
  const member = item.members[0]!;
  return member.source === "manual" ? member : undefined;
}

/* -------------------------------------------------------------------------- */
/* Keyboard                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One Tab stop for the whole list, then ↑ ↓ inside it.
 *
 * A roving tabindex rather than a tab stop per row: a day with fourteen
 * deadlines would otherwise be fourteen presses of Tab between the tab strip
 * and the settings button, and the popup is a 600px window someone opened to
 * look at one thing.
 *
 * Called after every draw, because the rows it is rolling over are replaced
 * wholesale on each one.
 */
function rowsInView(): HTMLElement[] {
  // The month has no `a.row` at all — it is a grid of pills — so the roving
  // tabindex found nothing there and ↑ ↓ did nothing. A pill is a `role=button`
  // that opens the same menu, so it belongs in the same ring.
  // `div.row` too: a manual row with no link is a div, and a ring that skips
  // it loses focus on the way back from its own screen (R2 L3).
  // One selector, shared with the focus lookup that returns a screen to its
  // row (popup/focus.ts): the two must agree about what a row is.
  return [...viewEl.querySelectorAll<HTMLElement>(ROW_RING_SELECTOR)];
}

export function makeRowsNavigable(): void {
  rowsInView().forEach((row, index) => {
    row.tabIndex = index === 0 ? 0 : -1;
  });
}

/*
 * Attached once, at module scope, rather than inside `makeRowsNavigable`.
 *
 * It was inside, and `makeRowsNavigable` runs after every draw — so the
 * listeners stacked, and after the popup's own open-sync had redrawn twice one
 * press of ArrowDown moved three rows. The keyboard walk found it in the real
 * document; nothing in the suite could have, because the bug is "how many times
 * was this function called", not "what does it do".
 */
viewEl.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const rows = rowsInView();
  const here = rows.findIndex((row) => row === document.activeElement);
  if (here === -1) return;
  event.preventDefault();
  const next =
    rows[Math.min(rows.length - 1, Math.max(0, here + (event.key === "ArrowDown" ? 1 : -1)))];
  if (!next) return;
  for (const row of rows) row.tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
});

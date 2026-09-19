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
 *     [mark] Illini Dash            [pill] [+] [⋯]
 *     ┌ Today │ Week │ Month │ Exams │ Attention ┐
 *     …
 *     [dot] 8 sources · synced 2m ago · Sync now
 *
 * What it replaces on either end is the same failure twice. The header used to
 * carry five icon buttons in 400px beside a sentence that needed every pixel
 * it could get; the sync button is now the footer's only control and the other
 * three are one keystroke into the ⋯. And the footer used to be nothing at
 * all — the one line stating what had been read sat at the *bottom of the
 * document*, which in the week view is 1100px into a 600px window (UI rule 3).
 */

import {
  type NeedsYouPill,
  type SourceAction,
  actionFor,
  displayState,
  needsYouPill,
  sourceRows,
  staleNotice,
  summarize,
} from "../../core/health.js";
import { courseLabel, SOURCE_NAME, SOURCE_TITLE, timeAgo } from "../../core/names.js";
import { bookings, coursesIn, overdueItems } from "../../core/calendar.js";
import { googleCalendarUrl } from "../../core/ics.js";
import { sameCourse } from "../../core/dedupe.js";
import { downloadIcs } from "../download.js";
import { appMark, type IconName, icon, iconButton } from "../icons.js";
import { renderThemePanel } from "../theme-panel.js";
import { send, type OverrideAction, type Request } from "../../messages.js";
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
  app,
  bannersEl,
  dateNavEl,
  filtersEl,
  footerEl,
  healthEl,
  isFullView,
  isSyncing,
  safeUrl,
  state,
  statusEl,
  tabsEl,
  viewEl,
  writeStored,
} from "./state.js";

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The header: the mark and the name on the left, the pill and two controls on
 * the right (D9).
 *
 * What it replaces is six 9px dots and, 800px below them, a line of prose
 * restating what the dots meant. The dots were a colour-only signal (shapes
 * existed only in the High-contrast theme), the one that was clickable looked
 * exactly like the five that were not, and nobody scrolled to the line.
 *
 * Everything the pill says comes from `needsYouPill` (D2), which derives every
 * branch from `summarize()` — so it cannot claim "All clear" over sources that
 * were never fetched. `healthPill` is still the wording for *which* source
 * broke, and the Needs-you screen is where that is printed, one row each.
 *
 * **The pill's action button is gone from the bar.** It existed because the
 * pill was the only thing up here that could be pressed and "Gradescope
 * couldn't be reached" had nowhere to send you. The same button is still one
 * press away, in the source list the pill opens, and at 400px a second control
 * beside the sentence costs the sentence the words that say what is wrong.
 */
export function renderHealth(
  sources: Record<Source, SourceStatus>,
  items: Item[],
  now: Date,
): void {
  healthEl.replaceChildren();
  healthEl.append(appMark(), renderWordmark());

  /*
   * One derivation, in core, for what the pill says (D2).
   *
   * `isSyncing()` rather than a second sentence written here: a sync in flight
   * outranks whatever the store still holds, because the store keeps the *last*
   * outcome and a real sync is five to ten seconds of the pill asserting the
   * thing the click is in the middle of fixing. `needsYouPill` owns that
   * branch, and every branch below it, so the pill cannot say "All clear" about
   * sources that were never fetched (worker rule 2).
   *
   * The counts are the screen's own: `overdueItems` is the Overdue group by the
   * same rule the screen draws, and the suggestions are the rows waiting for a
   * yes. A pill that counted differently from the screen it opens would be two
   * copies of one decision, and the copy is always the one that goes stale.
   */
  const pill: NeedsYouPill = needsYouPill({
    sources,
    syncing: isSyncing(),
    overdue: overdueItems(items, now).length,
    suggestions: state.currentSuggestions.length,
  });

  const button = document.createElement("button");
  button.type = "button";
  button.className = `pill is-${pill.tone}`;
  button.dataset["kind"] = pill.kind;
  // Still a button that opens something, and still says whether that thing is
  // open — the screen it opens is in document flow rather than a dialog, which
  // is what `aria-haspopup` would promise.
  button.setAttribute("aria-expanded", state.screen === "needs-you" ? "true" : "false");
  /*
   * The per-source facts, kept as the tooltip (inventory C).
   *
   * They were the popover's whole content, and the popover is gone — but "which
   * site was read, and when" is a question a student asks without wanting to
   * change anything, and making them open a screen to read it is a worse trade
   * than a hover. `sourceRows` is the same list the screen draws, so the two can
   * never disagree.
   */
  button.title = pillTooltip(sources, now);

  const dot = document.createElement("i");
  dot.className = "pill--dot";
  const text = document.createElement("span");
  text.className = "pill--text";
  text.textContent = pill.text;
  button.append(dot, text);

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    // A toggle, not an opener: pressing it a second time is the one gesture
    // everybody tries to dismiss what it opened with, and for a month that was
    // the gesture that could not work.
    if (state.screen === "needs-you") app.closeNeedsYou();
    else app.openNeedsYou();
  });
  healthEl.append(button);
}

/**
 * "Gradescope — Sign in needed · last read 2 days ago", one source per line.
 *
 * Plain text with newlines rather than markup, because it is a `title`: the
 * facts are `sourceRows`', including the exact stamp and the site's own error
 * message, which is the difference between "the cookie is not reaching us" and
 * "the page says something we misread".
 */
function pillTooltip(sources: Record<Source, SourceStatus>, now: Date): string {
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
 * all. `flex: none`, so it never gives up its width; the pill beside it is what
 * shrinks, and it has an ellipsis for exactly that.
 */
function renderWordmark(): HTMLElement {
  const mark = document.createElement("span");
  mark.className = "wordmark";
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
    app.openAddEditor();
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

  if (!isFullView) {
    // "⤢ full view" named the mechanism. What a student wants from it is that
    // the window stops vanishing when they click on the course page behind it.
    add("Open full view", "open-tab", () => {
      closeMenus();
      openFullView();
    });
  }

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

function openOptions(section?: string): void {
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
  void send({ type: "open-full-view" });
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

    const label = document.createElement("span");
    label.className = "tab--label";
    label.textContent = VIEW_LABEL[name] ?? name;
    tab.append(label);

    const count = counts[name] ?? 0;
    if (count > 0) {
      // Both counts mean "something here is asking for an action". An exam
      // already booked and a row with no date are not, and neither is counted —
      // a badge that only ever grows is a badge nobody reads.
      const badge = document.createElement("span");
      badge.className = name === "exams" ? "chip-count is-warn" : "chip-count";
      badge.textContent = String(count);
      tab.append(badge);
      tab.title = `${VIEW_LABEL[name] ?? name} — ${count} need${count === 1 ? "s" : ""} attention`;
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
}

export function selectTab(name: ViewName): void {
  if (!isFullView && FULL_VIEW_ONLY.has(name)) {
    openFullView(name);
    return;
  }
  state.view = name;
  state.dayOffset = 0;
  writeStored(VIEW_KEY, name);
  void app.refresh();
}

/* -------------------------------------------------------------------------- */
/* Banners                                                                     */
/* -------------------------------------------------------------------------- */

interface Banner {
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

  // §4.4: a booking window closes whether or not the student has looked, so it
  // is pinned above the tabs rather than filed under Exams. One line now: the
  // title, the window and the word "not booked" all fit on one at 12px.
  for (const item of bookings(stateIn.items)) {
    const title = item.title.replace(/^Book a slot:\s*/i, "");
    const url = safeUrl(item.url);
    const window_ = bookingWindowRange(item);
    // Not "· not booked" as well: an amber banner with a button reading Book on
    // it has already said that, and the words cost the course title its width.
    banners.push({
      tone: "warn",
      glyph: "tab-exams",
      text: window_ ? `${title} · ${window_}` : `${title} · not booked`,
      ...(url ? { action: { label: "Book", run: () => chrome.tabs.create({ url }) } } : {}),
    });
  }

  for (const banner of banners) bannersEl.append(renderBanner(banner));
}

function renderBanner(banner: Banner): HTMLElement {
  const line = document.createElement("div");
  line.className = `banner-line banner-${banner.tone}`;
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
export function showStatus(text: string | undefined): void {
  statusEl.replaceChildren();
  statusEl.hidden = !text;
  if (!text) return;
  statusEl.append(renderBanner({ tone: "err", glyph: "warning", text }));
}

/**
 * "sessions Sep 22–24", for the banner.
 *
 * The month is written once. `Sep 22–Sep 24` spends eight characters restating
 * it, on the one line where the course title is competing for every one.
 */
function bookingWindowRange(item: Item): string | undefined {
  const start = item.members.find((m) => m.extra?.["windowStart"])?.extra?.["windowStart"];
  const end = item.members.find((m) => m.extra?.["windowEnd"])?.extra?.["windowEnd"];
  if (!start || !end) return undefined;
  const from = new Date(start);
  const to = new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return undefined;
  const month = from.toLocaleDateString(undefined, { month: "short" });
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  return sameMonth
    ? `sessions ${month} ${from.getDate()}\u2013${to.getDate()}`
    : `sessions ${month} ${from.getDate()}\u2013${to.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

/* -------------------------------------------------------------------------- */
/* The footer strip                                                            */
/* -------------------------------------------------------------------------- */

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
 */
export function renderFooter(
  sources: Record<Source, SourceStatus>,
  now: Date,
): void {
  footerEl.replaceChildren();
  const summary = summarize(sources);
  const total = summary.checkable.length;
  const bad = summary.failing.length;

  const dot = document.createElement("i");
  dot.className = "foot--dot";

  const count = document.createElement("span");
  count.className = "foot--count";

  const when = document.createElement("span");
  when.className = "foot--when";

  let tone: "ok" | "warn" | "err" | "pending" = "ok";

  if (total === 0) {
    tone = "warn";
    count.textContent = "No sources on";
    when.textContent = "switch one on in Settings";
    footerEl.classList.add("foot--warn");
  } else {
    count.textContent =
      bad > 0
        ? `${summary.ok.length} of ${total} sources`
        : `${total} source${total === 1 ? "" : "s"}`;
    // The newest success across every checkable source. One of them failing
    // does not make the others' answers old, and a strip that said "not synced
    // yet" because Gradescope was down would be describing the wrong thing.
    const newest = summary.checkable
      .map((source) => sources[source]?.lastSuccessAt)
      .filter((at): at is string => typeof at === "string" && at !== "")
      .map((at) => Date.parse(at))
      .filter((at) => Number.isFinite(at))
      .sort((a, b) => b - a)[0];
    if (isSyncing()) {
      tone = "pending";
      when.textContent = "Syncing…";
    } else if (newest === undefined) {
      // "Not synced yet" and "synced, and it went badly" are different states
      // and used to render identically. `pending` is a real state.
      tone = "pending";
      when.textContent = "not synced yet";
    } else {
      tone = bad > 0 ? "warn" : "ok";
      when.textContent = `synced ${timeAgo(newest, now) ?? "just now"}`;
    }
    footerEl.classList.toggle("foot--warn", bad > 0);
  }
  dot.classList.add(`is-${tone}`);

  const sep = document.createElement("span");
  sep.className = "foot--sep";
  sep.textContent = "·";

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
  sync.textContent = state.syncing ? "Syncing…" : "Sync now";
  sync.disabled = state.syncing;
  if (state.syncing) sync.dataset["busy"] = "true";
  sync.addEventListener("click", (event) => {
    event.stopPropagation();
    void app.runSync();
  });

  footerEl.append(dot, count, sep, when, sync);
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
export function renderDateNav(label: string, step: number): void {
  dateNavEl.replaceChildren();
  dateNavEl.hidden = step === 0;
  if (step === 0) return;

  const back = iconButton("left", "Back");
  back.classList.add("btn-sm");
  back.addEventListener("click", () => {
    state.dayOffset -= step;
    void app.refresh();
  });

  const text = document.createElement("span");
  text.className = "datenav--label";
  text.textContent = label;

  const forward = iconButton("right", "Forward");
  forward.classList.add("btn-sm");
  forward.addEventListener("click", () => {
    state.dayOffset += step;
    void app.refresh();
  });

  dateNavEl.append(back, text, forward);

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
export function drawIsHeld(): boolean {
  if (document.querySelector(MENU_SELECTOR)) {
    state.redrawAfterMenu = true;
    return true;
  }
  if (state.editor) {
    state.redrawAfterEditor = true;
    return true;
  }
  return false;
}

export function closeMenus(): void {
  const open = [...document.querySelectorAll(MENU_SELECTOR)];
  for (const panel of open) panel.remove();
  // The expanded state belongs to the panel, and only the focusout path used
  // to clear it — so after every other kind of close the health pill's toggle
  // and the Escape handler kept finding a stale "expanded" anchor.
  for (const anchor of document.querySelectorAll('[aria-expanded="true"]')) {
    anchor.removeAttribute("aria-expanded");
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
  if (!flip) {
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
  if (event.key === "Escape" && document.querySelector(MENU_SELECTOR)) {
    event.preventDefault();
    const anchor = document.querySelector<HTMLElement>('[aria-expanded="true"]');
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

  const focusAt = (index: number) => {
    const all = items();
    if (all.length === 0) return;
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
   * event itself. A press on non-focusable menu chrome reports none, so that
   * case waits one task — a task, not a microtask — for focus to settle.
   */
  menu.addEventListener("focusout", (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && menu.contains(next)) return;
    setTimeout(() => {
      if (!menu.isConnected || menu.contains(document.activeElement)) return;
      menu.remove();
      anchor.removeAttribute("aria-expanded");
    }, 0);
  });

  focusAt(0);
}

/** One entry. Shared by the row menu and the header menu so they behave alike. */
function menuItem(
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

/** A correction that silently did nothing is worse than one that says so. */
export function reportOverride(response: Awaited<ReturnType<typeof send>>): void {
  if (response.type === "error") showStatus(response.message);
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
  if (control) {
    control.textContent = "Applying…";
    if (control instanceof HTMLButtonElement) control.disabled = true;
    for (const other of control.parentElement?.querySelectorAll("button") ?? []) {
      (other as HTMLButtonElement).disabled = true;
    }
  }
  console.log(`[illini-dash] ${request.type} requested`);
  void send(request)
    .then(reportOverride)
    .then(() => {
      void app.refresh();
    })
    .catch((error: unknown) => {
      showStatus(error instanceof Error ? error.message : String(error));
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
  /*
   * Say so on the control that was pressed, before anything can go wrong.
   *
   * Four rounds of "I click Hide and nothing happens" produced no evidence,
   * because every channel that could have carried it was somewhere nobody was
   * looking: the popup's console (not the worker's, which is the one people
   * open), a status line that rendered below the fold, and an unhandled
   * rejection that reached neither. The one place a student is definitely
   * looking is the thing they just clicked.
   *
   * So it is feedback and a diagnostic at once. A correction is a round trip to
   * the service worker and back — it was always wrong for that to look
   * instantaneous — and if this word never appears, the click handler never
   * ran, which is a different bug from every one investigated so far and says
   * so without a console.
   */
  if (entry) {
    entry.replaceChildren(icon("sync"), document.createTextNode("Applying…"));
    for (const other of entry.parentElement?.querySelectorAll("button") ?? []) {
      (other as HTMLButtonElement).disabled = true;
    }
  }
  // Logged on this side too, because the two consoles are different windows: a
  // popup's output never appears in the service worker's, and the worker's
  // never appears in the popup's. Chasing this across three rounds, both were
  // silent for different reasons and each looked like proof the other was at
  // fault. This line says the click was heard, before anything can go wrong.
  console.log(`[illini-dash] ${action.kind} requested for ${action.itemId}`);
  void send({ type: "override", action })
    .then(reportOverride)
    .then(() => {
      closeMenus();
      void app.refresh();
    })
    .catch((err: unknown) => {
      closeMenus();
      showStatus(
        `Could not ${action.kind} that row: ${err instanceof Error ? err.message : String(err)}`,
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
   * First: the site the row came from.
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

  // Then the one a student reaches for most: two of the five sources can never
  // report completion, so without it a finished course-site row sits in Needs
  // attention for a week with only Hide as an escape.
  add(item.done ? "Not done" : "Mark done", item.done ? "close" : "check", (entry) => {
    applyOverrideAction({ kind: item.done ? "undone" : "done", itemId: item.id }, entry);
  });

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
  return [...viewEl.querySelectorAll<HTMLElement>("a.row, .mpill[role='button']")];
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

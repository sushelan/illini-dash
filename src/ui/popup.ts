/**
 * Popup (§8.1). A list, deliberately plain — §0 decision 6 says ship ugly.
 *
 * Rendering rule from §8.1: every string that came from a source is inserted
 * with `textContent`, never `innerHTML`, and a URL is only made clickable if it
 * parses as https on a host we know. The parsers already enforce the second
 * rule; this is the second line of defence, because this is the layer where
 * getting it wrong is exploitable.
 */

import { applyStoredTheme } from "./theme-panel.js";
import { send, type OverrideAction } from "../messages.js";
import { normalizePopupState, staleWorkerNotice } from "../core/compat.js";
import {
  type SetupRow,
  loginsToOpen,
  setupProgress,
  setupSummary,
} from "../core/setup.js";
import { isItemDone, isTickedDone, sameCourse } from "../core/dedupe.js";
import { googleCalendarUrl } from "../core/ics.js";
import {
  type AgendaRow,
  type AttentionName,
  type DayContents,
  type PlacedItem,
  type ViewName,
  type WeekMode,
  END_OF_DAY_HEADING,
  UNTIMED_HEADING,
  agendaRows,
  allTimed,
  attentionCount,
  itemTone,
  examBoard,
  examCount,
  attentionGroups,
  isActionable,
  bookings,
  courseColours,
  coursesIn,
  dayContents,
  dayKey,
  hourRange,
  minutesInto,
  MONTH_CELL_ROWS,
  monthCells,
  quietDay,
  spanMinutes,
  startOfDay,
  visibleItems,
  weekContents,
} from "../core/calendar.js";
import {
  examDetail,
  formatDue,
  liveDeadline,
  movedText,
  type SectionName,
} from "../core/grouping.js";
import {
  type HealthPill,
  type SourceAction,
  type SourceRow,
  actionFor,
  displayState,
  emptyStateFor,
  healthPill,
  sourceRows,
  sourcesToRecheck,
  staleNotice,
  type NavigatedAt,
} from "../core/health.js";
import { downloadIcs } from "./download.js";
import {
  type Editor,
  type EditorValues,
  EDITOR_SELECTOR,
  createEditor,
} from "./editor.js";
import { type IconName, icon, iconButton } from "./icons.js";
import {
  courseLabel,
  LOGIN_URL,
  SOURCE_CODE,
  SOURCE_NAME,
  SOURCE_TITLE,
  timeAgo,
} from "../core/names.js";
import { qualityFlags, unreadableDeadline, unreadableSummary } from "../core/quality.js";
import { ALL_SOURCES, DEFAULT_SETTINGS, STORAGE_KEY } from "../core/store.js";
import { SYNC_SPINNER_CAP_MS } from "../core/sync.js";
import type { Item, Settings, Source, SourceState, SourceStatus } from "../sources/types.js";

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
function safeUrl(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:") return url.toString();
  } catch {
    /* fall through */
  }
  return undefined;
}

/* Before the first paint. See src/ui/theme-panel.ts. */
applyStoredTheme();

// Set before the first paint so the full view never flashes at popup width.
if (new URLSearchParams(location.search).get("view") === "full") {
  document.documentElement.classList.add("view-full");
  // A tab has a title bar of its own to name; the popup does not.
  document.title = "Illini Dash — everything due";
}

const viewEl = document.getElementById("view")!;
const tabsEl = document.getElementById("tabs")!;
const filtersEl = document.getElementById("filters")!;
const dateNavEl = document.getElementById("nav")!;
const healthEl = document.getElementById("health")!;
const actionsEl = document.getElementById("actions")!;
const bannersEl = document.getElementById("banners")!;
const statusEl = document.getElementById("status")!;

/**
 * The header: one pill on the left, three icon buttons on the right, 40px.
 *
 * What it replaces is six 9px dots and, 800px below them, a line of prose
 * restating what the dots meant. The dots were a colour-only signal (shapes
 * existed only in the High-contrast theme), the one that was clickable looked
 * exactly like the five that were not, and nobody scrolled to the line.
 *
 * Everything the pill says comes from `healthPill`, which derives it from
 * `summarize()` — so it cannot claim a source is fine when nothing was fetched.
 */
function renderHealth(
  sources: Record<Source, SourceStatus>,
  lastSyncAt: string | undefined,
  now: Date,
): void {
  healthEl.replaceChildren();
  healthEl.append(renderWordmark());
  /*
   * A sync in flight outranks whatever the store still holds.
   *
   * The store keeps the *last* outcome, so during a fetch the pill kept saying
   * "Gradescope couldn't be reached" — the thing the click was in the middle of
   * fixing. A real sync is five or six requests and takes five to ten seconds,
   * which is a long time to look at a stale claim with a spinner beside it.
   *
   * "Checking…" is not a guess: it is the one thing that is known while a
   * request is open, which is the whole of worker house rule 2.
   */
  const pill: HealthPill = syncing
    ? { tone: "pending", text: "Checking…" }
    : healthPill(sources, lastSyncAt, now);

  const button = document.createElement("button");
  button.type = "button";
  button.className = `pill is-${pill.tone}`;
  button.setAttribute("aria-haspopup", "dialog");
  button.title = "Which sites were read, and when";

  const dot = document.createElement("i");
  dot.className = "pill--dot";
  const text = document.createElement("span");
  text.className = "pill--text";
  text.textContent = pill.text;
  button.append(dot, text);
  // The chevron is the "there is more behind this" affordance. When an action
  // button sits beside the pill it is a second one saying the same thing, and
  // it costs the sentence 18 of the pixels it needs to finish.
  if (!pill.action) button.append(icon("right"));

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    // A toggle, not an opener. `openHealthPopover` closes whatever is open and
    // then opens its own, so pressing the pill a second time closed the panel
    // and immediately rebuilt it — the one gesture everybody tries to dismiss
    // it with was the one that could not.
    if (button.getAttribute("aria-expanded") === "true") {
      closeMenus();
      button.removeAttribute("aria-expanded");
      return;
    }
    openHealthPopover(sources, now, button);
  });
  healthEl.append(button);

  /*
   * The action, beside the pill rather than hidden inside it.
   *
   * Clicking the words "Gradescope couldn't be reached" opens a list, which is
   * a reasonable thing for it to do and not what anyone expects it to do — the
   * sentence names a site, so the click should go to the site. It does now, on
   * a button that says which, and the list is still one click away on the pill.
   */
  const action = actionButton(pill.action);
  if (action) {
    action.classList.remove("btn-secondary");
    action.classList.add("btn-quiet");
    healthEl.append(action);
  }
}

/**
 * Every source, with the one thing to do about each.
 *
 * The same facts Settings › Sources shows, from the same `sourceRows` — two
 * surfaces assembling this separately is how the popup came to say "read
 * successfully" where Settings said "ok", about the same source in the same
 * second.
 */
function openHealthPopover(
  sources: Record<Source, SourceStatus>,
  now: Date,
  anchor: HTMLElement,
): void {
  closeMenus();
  const menu = document.createElement("div");
  menu.className = `${MENU_CLASS} popover`;
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "Source health");
  menu.addEventListener("click", (event) => event.stopPropagation());

  for (const row of sourceRows(sources, now)) {
    menu.append(renderSourceRow(row));
  }

  // Appended first: `placeFloating` measures it, and an element outside the
  // document has no width or height to measure.
  document.body.append(menu);
  placeFloating(menu, anchor, "left");
  trapMenuKeys(menu, anchor);
}

function renderSourceRow(row: SourceRow): HTMLElement {
  const line = document.createElement("div");
  line.className = "srow";

  const dot = document.createElement("i");
  dot.className = `srow--dot is-${toneFor(row.state)}`;

  const name = document.createElement("span");
  name.className = "srow--name";
  // `SOURCE_TITLE`, not `SOURCE_NAME`: this is a label in a list, and "the
  // course website" reads as a sentence fragment sitting between Canvas and
  // PrairieTest.
  name.textContent = SOURCE_TITLE[row.source];

  const state = document.createElement("span");
  state.className = `srow--state is-${toneFor(row.state)}`;
  // "Connected · 5 min ago" rather than two facts in two columns: the second
  // one only makes sense as a qualifier on the first.
  state.textContent = row.lastRead && row.state === "ok" ? `${row.word} · ${row.lastRead}` : row.word;
  if (row.lastReadExact || row.lastError) {
    state.title = [row.lastError, row.lastReadExact && `last read ${row.lastReadExact}`]
      .filter(Boolean)
      .join("\n");
  }

  line.append(dot, name, state);
  const button = actionButton(row.action);
  if (button) line.append(button);
  return line;
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
function signInUrl(
  source: Source,
  status: SourceStatus | undefined,
  assume?: SourceState,
): string | undefined {
  if (!status) return undefined;
  const action = actionFor(source, assume ?? displayState(status), status.loginUrl);
  return action?.kind === "login" ? action.url : undefined;
}

function actionButton(action: SourceAction | undefined): HTMLButtonElement | undefined {
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
    void runSync();
  });
  return button;
}

/** The four tones the pill, the popover and the chips all share. */
function toneFor(state: SourceState): "ok" | "warn" | "err" | "pending" | "off" {
  if (state === "ok") return "ok";
  if (state === "needs_login") return "warn";
  if (state === "disabled") return "off";
  if (state === "pending") return "pending";
  return "err";
}

/** Sync, open-in-a-tab, settings. Drawn once; only the sync state changes. */
let syncButton: HTMLButtonElement | undefined;

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

function renderActions(): void {
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
  addButton.addEventListener("click", (event) => {
    // Otherwise `document`'s own click listener closes the panel this opens.
    event.stopPropagation();
    openAddEditor();
  });
  actionsEl.append(addButton);

  syncButton = iconButton("sync", "Sync now");
  syncButton.addEventListener("click", () => void runSync());
  actionsEl.append(syncButton);

  if (!isFullView) {
    // "⤢ full view" named the mechanism. What a student wants from it is that
    // the window stops vanishing when they click on the course page behind it.
    const full = iconButton("open-tab", "Open in a tab");
    full.addEventListener("click", () => openFullView());
    actionsEl.append(full);
  }

  /*
   * Export, in the header rather than four clicks into Settings.
   *
   * It was under Data & privacy, which is where you go to *understand* what
   * the extension stores — not where you go to put this week in your calendar.
   * Sushi: "there should be a calendar icon in the popup/full screen view at
   * the top right directly instead of having to go into settings each time."
   *
   * It stays a one-time file, and the title says so. A calendar that updated
   * itself would be a subscription, which needs a URL a calendar app can poll,
   * which needs a server — and this extension has none, by design and in its
   * published privacy policy. Promising "sync" here would be promising the one
   * thing the architecture rules out.
   */
  const exportIcs = iconButton("calendar-out", "Save this list as a calendar file (.ics)");
  exportIcs.addEventListener("click", () => {
    void send({ type: "get-state" }).then((response) => {
      if (response.type !== "state") return;
      const count = downloadIcs(response.items);
      showStatus(
        `Saved ${count} deadline${count === 1 ? "" : "s"} to illini-dash.ics — a one-time copy, ` +
          `not a subscription. Import it into Google Calendar, Apple Calendar or Outlook.`,
      );
    });
  });
  actionsEl.append(exportIcs);

  const settings = iconButton("settings", "Settings");
  settings.addEventListener("click", () => {
    if (isFullView) {
      // Already in a tab, so use it. `openOptionsPage` would leave two Illini
      // Dash tabs open, with the one being read behind the one now in front.
      location.href = chrome.runtime.getURL("options.html");
      return;
    }
    chrome.runtime.openOptionsPage();
  });
  actionsEl.append(settings);
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
function renderBanners(state: {
  sources: Record<Source, SourceStatus>;
  notificationsBlocked: boolean;
  items: Item[];
}): void {
  bannersEl.replaceChildren();
  const banners: Banner[] = [];

  if (state.notificationsBlocked) {
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

  const stale = staleNotice(state.sources, new Date());
  if (stale) {
    // Short enough to fit one 32px line beside an icon and a button at 400px —
    // about 45 characters. The longer sentence it replaces wrapped, and a
    // wrapped banner is 41px, which is only nine pixels until three of them
    // are on screen at once.
    const age =
      stale.hours === undefined
        ? "never read — nothing from it is listed"
        : `signed out ${stale.hours}h — rows may be old`;
    const login = signInUrl(stale.source, state.sources[stale.source], "needs_login");
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
  if (pendingUndo && Date.now() < pendingUndo.until) {
    banners.push({
      tone: "info",
      glyph: "info",
      text: `Deleted \u201c${pendingUndo.title}\u201d`,
      action: { label: "Undo", run: () => undoDelete() },
    });
  }

  // §4.4: a booking window closes whether or not the student has looked, so it
  // is pinned above the tabs rather than filed under Exams. One line now: the
  // title, the window and the word "not booked" all fit on one at 12px.
  for (const item of bookings(state.items)) {
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
 */
function showStatus(text: string | undefined): void {
  statusEl.replaceChildren();
  statusEl.hidden = !text;
  if (!text) return;
  statusEl.append(renderBanner({ tone: "err", glyph: "warning", text }));
  /*
   * Bring it into view, because this element sits at the bottom of the document.
   *
   * That is fine on a short list and invisible on a long one: the week view is
   * about 1100px of document in a 600px window, so every failure it reported
   * landed four hundred pixels below the fold. A student clicking Hide saw
   * nothing move and nothing explain itself — which is "none of the options
   * work at all", and is this project's own worst-ranked outcome, a silent
   * failure, produced by the one control written to prevent it.
   *
   * Scroll rather than a fixed overlay: the message can be two lines long and
   * pinning it over the list would cover the rows it is talking about.
   */
  statusEl.scrollIntoView({ block: "nearest" });
}

function renderRow(
  item: Item,
  now: Date,
  section: SectionName | undefined,
  dueText?: { primary: string; detail?: string },
  colours?: Map<string, number>,
): HTMLElement {
  /*
   * An `<a>`, not a `<div>` with a click handler.
   *
   * Every row in this list opened a page and none of them could be reached by
   * keyboard: Tab went from the tab strip straight past a screenful of
   * deadlines to whatever came after. A div also cannot be middle-clicked,
   * cannot be copied as a link, and announces as nothing.
   *
   * Rows with no safe URL stay a `<div>` — an `<a>` with no `href` is not
   * focusable and announces as a link that goes nowhere, which is worse than a
   * plain row.
   */
  const url = safeUrl(item.url);
  const row = document.createElement(url ? "a" : "div");
  row.className = "row";
  if (url && row instanceof HTMLAnchorElement) {
    row.href = url;
    // Rolled by `makeRowsNavigable` once the view is drawn: one stop for the
    // whole list, then ↑ ↓ inside it.
    row.tabIndex = -1;
    row.addEventListener("click", (event) => {
      // `chrome.tabs.create` rather than the browser's own navigation: a popup
      // navigating itself away leaves a 400px window showing Gradescope.
      event.preventDefault();
      chrome.tabs.create({ url });
    });
    row.addEventListener("keydown", (event) => {
      // Shift+F10 and the context-menu key are what a list row is expected to
      // answer; `.` is the shorthand every mail client uses.
      if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu" || event.key === ".") {
        event.preventDefault();
        const trigger = row.querySelector<HTMLElement>(".row--menu");
        if (trigger) openRowMenu(item, trigger);
      }
    });
  }
  // The course colour is on the row, not only in the legend: a chip strip you
  // have to look up is a lookup table, and the point of colour is to answer
  // "whose is this" without reading.
  if (colours?.has(item.courseLabel)) {
    row.classList.add(`course-${colours.get(item.courseLabel)!}`);
  }
  // The one decision, from core, so the month grid cannot disagree with the
  // list about whether a deadline is done. `open` earns no class.
  const tone = itemTone(item, now);
  if (tone !== "open") row.classList.add(`row-${tone}`);

  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = courseLabel(item.courseLabel, courseNames) || "—";

  const title = document.createElement("span");
  title.className = "row--title";
  title.textContent = item.title;
  title.title = item.title;

  // §4.3: not-for-credit work stays visible — some of those surveys are
  // required — but it is labelled, so half of a PrairieLearn course's page does
  // not sit in Needs attention looking exactly like graded homework.
  const practice = document.createElement("span");
  practice.className = "row--practice";
  if (item.forCredit === false) {
    practice.classList.add("chip", "chip-practice");
    practice.textContent = "practice";
    practice.title = "The source says this does not count toward your grade";
  }

  const sources = document.createElement("span");
  sources.className = "row--sources";
  // §5.3 wants these so "a false merge is visible and the user knows there is
  // something to split" — which is a fact about *merged* rows. A lone "PL" on a
  // single-source row serves nothing and costs the title 44px, on a list where
  // real UIUC titles ("HW5 Rounding and Cancellation") are already being cut.
  // The label the student needs is on the row that has two.
  // Shown on every row, not only merged ones.
  //
  // §5.3 gives one reason for these — "a merged row shows both icons, so a
  // false merge is visible" — and for a while that was read as the *only*
  // reason, so single-source rows dropped theirs to buy title width. That was
  // wrong twice over. Where an assignment lives is what tells a student which
  // site to open, and it is most of what makes a row believable; and the width
  // it was bought with came back anyway once the date column stopped repeating
  // the section heading.
  const distinct = [...new Set(item.members.map((m) => m.source))];
  sources.textContent = distinct.map((source) => SOURCE_CODE[source]).join(" ");
  sources.title =
    distinct.length > 1
      ? `One deadline, seen by ${distinct.length} sources: ` +
        `${distinct.map((source) => SOURCE_NAME[source]).join(" and ")}. ` +
        `If they are not really the same thing, use ⋯ → Split.`
      : distinct[0] === "manual"
        ? // Not "On your own list — click the row to open it": the student wrote
          // this row, so naming a site to visit would be a lie, and a link is
          // there only if they gave one.
          `You added this${item.url ? " — click the row to open the link you gave" : ""}`
        : `On ${SOURCE_NAME[distinct[0]!]}${item.url ? " — click the row to open it" : ""}`;

  // The row is a two-line grid: title and "when" compete for line one, and
  // everything that qualifies the deadline goes on line two, which nothing else
  // is competing for. Before this the qualifiers shared the line and one row
  // was left with five pixels of title.
  const due = document.createElement("span");
  due.className = "row--due";
  const details: { text: string; className: string; title?: string }[] = [];

  const unreadable = unreadableDeadline(item);
  if (unreadable.length > 0) {
    // A row whose date could not be read says so, rather than reading "no date"
    // — which is what a genuinely undated row says, and the two are opposites.
    due.classList.add("row--unreadable");
    due.textContent = "unreadable";
    details.push({
      text: unreadableSummary(unreadable)!,
      className: "row--detail row--detail-error",
      // The raw text the parser could not make sense of, as text so a hostile
      // page cannot use this path (§8.1's rendering rule).
      title: unreadable
        .map((flag) => `${flag.source} ${flag.field}: ${flag.detail ?? "(no value)"}`)
        .join("\n"),
    });
  } else if (dueText !== undefined) {
    // An empty primary is the untimed band's case: the band already said what
    // the column would, and §8.1's whole width argument is that a column
    // repeating its heading is spending the title's characters.
    due.textContent = dueText.primary;
    if (dueText.detail) details.push({ text: dueText.detail, className: "row--detail" });
  } else {
    const formatted = formatDue(item, now, section);
    due.textContent = formatted.primary;
    if (item.timeAssumed) {
      // The marker is terse by design; the sentence it replaced lives here, so
      // "no time" is explained on the one row a student stops to ask about.
      due.classList.add("row--assumed");
      due.title = "The course site gives a date but no time. Check the course page for the cutoff.";
    }
    if (formatted.detail) {
      details.push({ text: formatted.detail, className: "row--detail" });
    }
  }

  const soft = qualityFlags(item).filter((flag) => !flag.blocksDate);
  if (soft.length > 0 && unreadable.length === 0) {
    // Dated, but something else on the row did not parse. A mark, not a
    // section: the deadline itself is intact.
    const mark = document.createElement("span");
    mark.className = "row--flag";
    mark.textContent = "!";
    mark.title = soft
      .map((flag) => `${flag.source} ${flag.field}${flag.detail ? `: ${flag.detail}` : ""}`)
      .join("\n");
    due.append(document.createTextNode(" "), mark);
  }

  // A deadline that moved since the last sync says so. Without it the change is
  // absorbed silently: the row simply reads differently than it did yesterday,
  // and a student who planned around the old date has no reason to look twice.
  // §4.4's room and duration, parsed since the source was written and never
  // shown. An exam is the one deadline where "where" has a wrong answer.
  const exam = examDetail(item);
  if (exam) details.push({ text: exam, className: "row--detail row--detail-exam" });

  const moved = movedText(item);
  if (moved) details.push({ text: moved, className: "row--detail row--detail-moved" });

  // Visible at 35% rather than `opacity: 0` until hover. A control nobody can
  // see is a control nobody learns, and this one carries Mark done, Hide,
  // Split and Merge — the whole of §5.3's correction story.
  const menu = iconButton("more", "More actions");
  menu.classList.add("row--menu", "btn-sm");
  menu.tabIndex = -1;
  menu.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openRowMenu(item, menu);
  });

  // The practice chip lives *inside* the name cell rather than in a track of
  // its own. A conditional grid child shifts every column after it, and an
  // empty track still sizes differently from a filled one — either way the
  // dates stop lining up, which is the one thing fixed tracks are for. In the
  // name cell only the rows that have a chip pay for it, out of their own
  // title width.
  const name = document.createElement("span");
  name.className = "row--name";
  name.append(title);
  if (item.forCredit === false) name.append(practice);

  row.append(chip, name, sources, due, menu);

  for (const detail of details) {
    const line = document.createElement("span");
    line.className = detail.className;
    line.textContent = detail.text;
    if (detail.title) line.title = detail.title;
    row.append(line);
  }

  if (!url) row.classList.add("row--flat");
  return row;
}

/** All items currently rendered, so "Merge with…" can offer same-course rows. */
let currentItems: Item[] = [];

/**
 * What the last draw actually found.
 *
 * The first-run screen and the calendar are the same page, and `get-setup`
 * answers before `get-state` — so on the run where setup is still showing, the
 * counts are from whatever the previous draw saw. Undefined until then, which
 * is why `setupSummary` has to keep working without it.
 */
let lastFound: { items: number; courses: number } | undefined;

/** A correction that silently did nothing is worse than one that says so. */
function reportOverride(response: Awaited<ReturnType<typeof send>>): void {
  if (response.type === "error") showStatus(response.message);
}

/**
 * Chrome's own ceiling for a popup, and the number `placeFloating` budgets to.
 *
 * Documented in §8.1 and enforced by the browser: a popup is never taller than
 * this however tall the document is.
 */
const MAX_POPUP_HEIGHT = 600;

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
const MENU_SELECTOR = ".menu-surface";
const MENU_CLASS = MENU_SELECTOR.slice(1);

/*
 * `.menu-surface`, not `.menu`.
 *
 * Three redraw guards asked for `.menu` — the storage listener, the session
 * listener and the minute tick — and a menu's class is `menu-surface`. A class
 * selector matches whole tokens, so `.menu` matched **nothing**, and all three
 * guards were dead from the day they were written.
 *
 * What that costs: a redraw calls `closeMenus`, which removes the open panel.
 * The store changes on every sync and the tick fires on every minute boundary,
 * so an open menu could be deleted underneath the pointer — and a `click` only
 * fires when mousedown and mouseup land on the same element, so a menu removed
 * between them swallows the press entirely. Nothing happens, and nothing says
 * why.
 *
 * The popup starts a sync the moment it opens, which is exactly when a student
 * is reaching for a row.
 */
/**
 * A redraw that arrived while a menu was open, and is owed to the list.
 *
 * Six things redraw this page — the popup's own open-sync, a store write, the
 * worker's in-flight flag, the minute tick, `visibilitychange` and a manual
 * sync — and three of them checked for an open menu and *skipped*, while the
 * other three did not check at all and tore the menu down mid-press. Neither
 * is right: a skipped redraw leaves the list stale until the next one, and a
 * redraw under an open menu is how a click lands on the wrong row. So a redraw
 * that finds a menu open is deferred, and `closeMenus` runs it.
 */
let redrawAfterMenu = false;

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
function drawIsHeld(): boolean {
  if (document.querySelector(MENU_SELECTOR)) {
    redrawAfterMenu = true;
    return true;
  }
  if (editor) {
    redrawAfterEditor = true;
    return true;
  }
  return false;
}

function closeMenus(): void {
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
  if (open.length > 0 && redrawAfterMenu) {
    redrawAfterMenu = false;
    void refresh();
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
function placeFloating(panel: HTMLElement, anchor: HTMLElement, align: "left" | "right"): void {
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
  } else {
    const width = panel.offsetWidth;
    const max = document.documentElement.clientWidth - width - 8;
    panel.style.left = `${Math.max(8, Math.min(box.left, max))}px`;
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
    const anchor = document.querySelector<HTMLElement>("[aria-expanded=\"true\"]");
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
function trapMenuKeys(menu: HTMLElement, anchor: HTMLElement): void {
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

/**
 * §8.1's row menu: Hide, Split (if merged), Merge with…, Add to Google Calendar.
 *
 * §5.3 leans on this: a false merge is visible because the row shows two source
 * labels, and the fix is meant to be one click. G3 budgets two corrections a
 * semester, which only works if making one is trivial.
 */
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
function applyOverrideAction(action: OverrideAction, entry?: HTMLElement): void {
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
      void refresh();
    })
    .catch((err: unknown) => {
      closeMenus();
      showStatus(
        `Could not ${action.kind} that row: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
}

function openRowMenu(item: Item, anchor: HTMLElement): void {
  closeMenus();
  const menu = document.createElement("div");
  menu.className = MENU_CLASS;
  menu.setAttribute("role", "menu");
  menu.addEventListener("click", (event) => event.stopPropagation());

  const add = (label: string, glyph: IconName, onClick: (entry: HTMLElement) => void) => {
    const entry = document.createElement("button");
    entry.type = "button";
    entry.className = "menu-item";
    entry.setAttribute("role", "menuitem");
    entry.tabIndex = -1;
    entry.append(icon(glyph), document.createTextNode(label));
    entry.addEventListener("click", () => onClick(entry));
    menu.append(entry);
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
  const candidates = currentItems.filter(
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
      openEditEditor(item, mine);
    });
    add("Delete", "close", (entry) => deleteManual(item, mine, entry));
  }

  document.body.append(menu);
  placeFloating(menu, anchor, "right");
  trapMenuKeys(menu, anchor);
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
    ? `sessions ${month} ${from.getDate()}–${to.getDate()}`
    : `sessions ${month} ${from.getDate()}–${to.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

/**
 * §4.4: a booking row must read "sessions Sep 21–23, not booked", never
 * "due Sep 21" — the date is deliberately early because slots fill, and
 * presenting it as a deadline would be a lie.
 */
function bookingWindowText(item: Item): { primary: string; detail?: string } {
  const start = item.members.find((m) => m.extra?.["windowStart"])?.extra?.["windowStart"];
  const end = item.members.find((m) => m.extra?.["windowEnd"])?.extra?.["windowEnd"];
  // "not booked" is the part that needs to be next to the title; the window is
  // the explanation, and it goes on the second line like every other qualifier.
  if (!start || !end) return { primary: "not booked" };
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return { primary: "not booked", detail: `sessions ${fmt(start)}–${fmt(end)}` };
}

/* -------------------------------------------------------------------------- */
/* First run                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The first-run screen: which sites this student's courses actually use.
 *
 * It hides the calendar chrome entirely rather than sitting above it, because
 * the thing it replaces was a full calendar shell with one sentence of
 * explanation under it, which reads as a broken app rather than a first step.
 *
 * Nothing here blocks. "Show my calendar" is clickable from the first paint —
 * see the module comment in core/setup.ts for why a gate was the wrong answer.
 */
function renderSetup(rows: SetupRow[]): void {
  document.body.classList.add("setup");
  // The checklist says how each source is doing, which is the health pill's
  // whole job — leaving the pill in the bar as well would be the same fact
  // twice, in a header that has nothing else to do yet. The name instead.
  healthEl.replaceChildren();
  healthEl.append(renderWordmark());
  bannersEl.replaceChildren();
  tabsEl.replaceChildren();
  filtersEl.replaceChildren();
  dateNavEl.replaceChildren();
  dateNavEl.hidden = true;
  viewEl.replaceChildren();

  const page = document.createElement("div");
  page.className = "setup--page";

  const pin = renderPinCard();
  if (pin) page.append(pin);

  const heading = document.createElement("h1");
  heading.className = "setup--title";
  heading.textContent = "Which sites do your courses use?";

  const blurb = document.createElement("p");
  blurb.className = "setup--blurb";
  blurb.textContent =
    "Illini Dash reads your deadlines from these using the logins already in your browser. " +
    "It never sees a password, and nothing leaves your computer.";

  page.append(heading, blurb);

  for (const row of rows) {
    page.append(renderSetupRow(row));
  }

  const summary = document.createElement("p");
  summary.className = "setup--summary";
  // What was actually found, once anything has been. `found` comes from the
  // last draw's state, so on the first paint it is undefined and the line falls
  // back to the connection count — which is the only true thing available then.
  summary.textContent = setupSummary(setupProgress(rows), lastFound);

  // The line Sushi asked for. It goes under the list rather than in the blurb
  // because this is the worry the list creates — "what if I pick wrong" — and
  // the answer belongs next to the choice, not three paragraphs above it.
  const changeable = document.createElement("p");
  changeable.className = "setup--note";
  changeable.textContent = "You can change any of this later in Settings.";

  page.append(summary, changeable);

  const actions = document.createElement("div");
  actions.className = "setup--actions";

  // Resolved to URLs *before* the label is written. It used to count the
  // sources and then skip the ones with no page to open, so a button reading
  // "Open all 5 sign-in pages" could open four and say nothing about the fifth.
  const outstanding = loginsToOpen(rows)
    .map((source) => ({
      source,
      url: signInUrl(source, rows.find((row) => row.source === source)?.status) ?? LOGIN_URL[source],
    }))
    .filter((entry): entry is { source: Source; url: string } => entry.url !== undefined);
  if (outstanding.length > 0) {
    const all = document.createElement("button");
    all.className = "btn btn-secondary";
    all.textContent =
      outstanding.length === 1 ? "Open the sign-in page" : `Open all ${outstanding.length} sign-in pages`;
    all.title = "Opens a tab for each site you picked that is not signed in yet";
    all.addEventListener("click", () => {
      for (const { url } of outstanding) {
        // Not focused: four tabs stealing focus one after another would leave
        // the student on whichever opened last, with no idea where they are.
        chrome.tabs.create({ url, active: false });
      }
    });
    actions.append(all);
  }

  const done = document.createElement("button");
  done.className = "btn btn-primary";
  done.textContent = "Show my calendar";
  done.addEventListener("click", async () => {
    done.disabled = true;
    await send({ type: "complete-setup" });
    document.body.classList.remove("setup");
    await refresh();
    // Pressing this is the clearest "I have finished signing in" a student can
    // say, and it was landing on a calendar still asserting nobody was.
    void recheckLogins();
  });
  actions.append(done);

  page.append(actions);
  viewEl.append(page);
}

function renderSetupRow(row: SetupRow): HTMLElement {
  const line = document.createElement("div");
  line.className = "setup--row";

  const box = document.createElement("input");
  box.type = "checkbox";
  box.className = "switch";
  box.checked = row.enabled;
  box.id = `setup-${row.source}`;
  box.addEventListener("change", async () => {
    box.disabled = true;
    await send({ type: "set-source-enabled", source: row.source, enabled: box.checked });
    // A source just switched on has never been fetched, so ask for one now
    // rather than leaving the row pending until the next poll — the whole
    // screen is a checklist that is supposed to tick itself.
    if (box.checked) void send({ type: "sync", trigger: "manual" });
    await refresh();
  });

  const label = document.createElement("label");
  label.className = "setup--label";
  label.htmlFor = box.id;
  const name = document.createElement("span");
  name.className = "setup--name";
  name.textContent = SOURCE_NAME[row.source];
  const hint = document.createElement("span");
  hint.className = "setup--hint";
  hint.textContent = row.hint;
  label.append(name, hint);

  // The same chips Settings uses, so a student who has seen one screen can read
  // the other. "✓ connected", "needs sign-in", "could not read" and "not used"
  // were four wordings this screen invented for itself.
  const state = document.createElement("span");
  if (!row.enabled) {
    state.className = "chip-base chip-state";
    state.textContent = "Not used";
  } else if (isSyncing()) {
    /*
     * A sync is in flight, so every other word on this row is about the
     * *previous* one.
     *
     * The store is written once, at the end of a sync, so during the five to
     * ten seconds one takes these rows keep asserting the pre-sync answer with
     * nothing to say they are being re-read. Sushi, looking at a signed-in
     * Gradescope dashboard with this screen on top of it: "as u can see im in
     * gradescope and it still says not signed in. Either there's a really long
     * delay or it's waiting on something to trigger the sync." Both readings
     * were available because the screen offered no third one.
     *
     * The header pill has said "Checking…" throughout; this screen has no pill,
     * which is exactly why it needed its own.
     */
    state.className = "chip-base chip-state";
    state.textContent = "Checking…";
    state.title = "Reading this site now. This can take a few seconds.";
  } else if (row.status?.lastSuccessAt !== undefined) {
    state.className = "chip-base chip-state is-ok";
    state.textContent = "Connected";
  } else if (row.status?.state === "needs_login") {
    state.className = "chip-base chip-state is-warn";
    state.textContent = "Sign in needed";
    // What the site actually answered. It was already here for the two error
    // states and missing from the one people get stuck on — and it is the
    // difference between "the cookie is not reaching us" and "the page says
    // something we misread", which nothing else on this screen can tell apart.
    state.title = row.status.lastError ?? "";
  } else if (row.status?.state === "parse_error" || row.status?.state === "network_error") {
    state.className = "chip-base chip-state is-err";
    state.textContent = "Couldn't read";
    state.title = row.status.lastError ?? "";
  } else {
    state.className = "chip-base chip-state";
    state.textContent = "Checking…";
  }

  line.append(box, label, state);

  // The action, beside the state rather than instead of it: "Sign in needed"
  // and a button that does it are two different things, and replacing the first
  // with the second left a row whose state was a verb.
  const login = row.enabled ? signInUrl(row.source, row.status) : undefined;
  if (login) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-secondary btn-sm";
    button.textContent = "Sign in";
    button.addEventListener("click", () => chrome.tabs.create({ url: login }));
    line.append(button);
  }
  return line;
}

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

function makeRowsNavigable(): void {
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
  const next = rows[Math.min(rows.length - 1, Math.max(0, here + (event.key === "ArrowDown" ? 1 : -1)))];
  if (!next) return;
  for (const row of rows) row.tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
});

/**
 * "Pin Illini Dash", and the two clicks that do it.
 *
 * Chrome leaves a newly installed extension unpinned, which means the badge —
 * the only thing that ever tells a student something is due without them
 * asking — lives behind the puzzle-piece menu where nobody looks. Everything
 * else in this project is about not failing silently; an unpinned icon is that
 * failure at the operating-system level.
 *
 * Dismissible, and it stays dismissed: a card that reappears after being
 * dismissed is worse than one that was never shown.
 */
const PIN_DISMISSED_KEY = "illini-dash.pinCardDismissed";

function renderPinCard(): HTMLElement | undefined {
  /*
   * The tab only.
   *
   * This is the screen `onInstalled` opens, and the install is the moment the
   * advice is for. In a 400px popup the card costs about 90px of a 600px window
   * and pushes "Show my calendar" — the one thing on the screen that has to be
   * reachable — below the fold, to give advice to somebody who has just
   * demonstrated they can find the icon.
   */
  if (!isFullView) return undefined;
  if (readStored(PIN_DISMISSED_KEY) === "1") return undefined;

  const card = document.createElement("div");
  card.className = "pincard";

  const glyph = icon("puzzle");
  glyph.classList.add("pincard--glyph");

  const text = document.createElement("div");
  text.className = "pincard--text";
  const title = document.createElement("b");
  title.textContent = "Pin Illini Dash to your toolbar";
  const how = document.createElement("span");
  how.textContent =
    "Click the puzzle-piece icon at the top right of Chrome, then the pin beside Illini Dash. " +
    "Until you do, the badge that counts what is due is hidden behind that menu.";
  text.append(title, how);

  const dismiss = iconButton("close", "Dismiss");
  dismiss.classList.add("btn-sm");
  dismiss.addEventListener("click", () => {
    writeStored(PIN_DISMISSED_KEY, "1");
    card.remove();
  });

  card.append(glyph, text, dismiss);
  return card;
}

/* -------------------------------------------------------------------------- */
/* View state                                                                  */
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
const VIEW_KEY = "illini-dash.view";
const HIDDEN_KEY = "illini-dash.hiddenCourses";

function readStored(key: string): string | undefined {
  try {
    return window.localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}
function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* A remembered tab is a convenience, never a requirement. */
  }
}

const VIEWS: ViewName[] = ["day", "week", "month", "exams", "attention"];
const VIEW_LABEL: Record<ViewName, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  exams: "Exams",
  attention: "Attention",
};

/**
 * The month is the one view a 400px popup cannot hold.
 *
 * Seven columns need about 100px each to carry a course code and enough title
 * to recognise, which is 760px — nearly twice the popup. Rather than render it
 * badly, the tab opens the full view, which already exists.
 */
const FULL_VIEW_ONLY: ReadonlySet<ViewName> = new Set<ViewName>(["month"]);
const isFullView = document.documentElement.classList.contains("view-full");

function storedView(): ViewName {
  const raw = readStored(VIEW_KEY);
  return VIEWS.includes(raw as ViewName) ? (raw as ViewName) : "day";
}

let view: ViewName = storedView();
if (!isFullView && FULL_VIEW_ONLY.has(view)) view = "day";

/** Whole days from today. The popup always opens on today; this moves with ‹ ›. */
let dayOffset = 0;

function hiddenCourses(): Set<string> {
  const raw = readStored(HIDDEN_KEY);
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : []);
  } catch {
    return new Set();
  }
}
let hidden = hiddenCourses();

/* -------------------------------------------------------------------------- */
/* Chrome above the views                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The tabs. Named, all five, in both windows.
 *
 * Only the *selected* tab used to carry a label, because five labelled tabs
 * measured 454px against a 400px document and a document wider than the popup
 * is what opened it at 800px once already. That was a real constraint answered
 * in the wrong place: the width came from 12.5px type, 11px of padding on each
 * side and a 14px icon on every tab. Dropping the icon in the popup and taking
 * the type to 12px fits all five labels with room to spare — measured, not
 * estimated, by the width check in docs/colour-layer.md after every change.
 *
 * Four unlabelled icons is not a smaller version of five labelled ones. A bell
 * and a sheet of paper do not say "Attention" and "Exams" to somebody who has
 * not already been told, and there is nothing on the screen that tells them.
 */
function renderTabs(counts: Partial<Record<ViewName, number>>): void {
  tabsEl.replaceChildren();
  for (const name of VIEWS) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(name === view));
    // A tab strip with `aria-selected` and no `role` is a row of buttons one of
    // which claims to be selected — the attribute means nothing without it.
    tab.tabIndex = name === view ? 0 : -1;

    tab.append(icon(`tab-${name}` as IconName));
    const label = document.createElement("span");
    label.className = "tab--label";
    label.textContent = VIEW_LABEL[name];
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
      tab.title = `${VIEW_LABEL[name]} — ${count} need${count === 1 ? "s" : ""} attention`;
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

function selectTab(name: ViewName): void {
  if (!isFullView && FULL_VIEW_ONLY.has(name)) {
    openFullView(name);
    return;
  }
  view = name;
  dayOffset = 0;
  writeStored(VIEW_KEY, name);
  void refresh();
}

/**
 * Show the full view, without piling up tabs.
 *
 * The worker owns the "is it already open" half — a popup is destroyed the
 * moment it loses focus, so it has nowhere to remember the tab it opened, which
 * is why every click on Month used to spawn another one.
 *
 * The *view* half is handed over through `localStorage`. Both documents are the
 * same extension origin, so writing here fires a `storage` event in an already
 * open tab; a tab that has yet to be created reads `VIEW_KEY` on load instead.
 * Two keys rather than one, because `VIEW_KEY` is written on every ordinary tab
 * change and a full view that followed the popup around would be a surprise.
 */
const HANDOFF_KEY = "illini-dash.openView";

function openFullView(view_?: ViewName): void {
  if (view_) {
    // Remembered first, so a tab that opens fresh lands on the tab just clicked.
    writeStored(VIEW_KEY, view_);
    writeStored(HANDOFF_KEY, JSON.stringify({ view: view_, at: Date.now() }));
  }
  void send({ type: "open-full-view" });
}

/**
 * The receiving half, in the tab.
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
      view = asked.view as ViewName;
      dayOffset = 0;
      writeStored(VIEW_KEY, view);
      void refresh();
    } catch {
      /* Written by a build that meant something else by it. */
    }
  });
}

/**
 * The course chips: the colour legend and the filter, as one control.
 *
 * Course visibility used to be reachable only from Settings, which nobody
 * opens. Once courses carry colours the legend has to be on screen anyway, so
 * making it the filter costs no space that was not already spent.
 *
 * A switched-off course stays on screen, hollow and struck through, with a
 * count of what it is hiding. A filter that silently removes work is the
 * failure §11 ranks worst, and this one persists across popup opens.
 */
function renderFilters(items: Item[], colours: Map<string, number>): void {
  filtersEl.replaceChildren();
  const courses = coursesIn(items);
  if (courses.length < 2) return; // Nothing to filter between.

  for (const course of courses) {
    const on = !hidden.has(course);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `fchip course-${colours.get(course) ?? 0}`;
    chip.setAttribute("aria-pressed", String(on));
    chip.title = on
      ? `Hide ${courseLabel(course, courseNames)}`
      : `Show ${courseLabel(course, courseNames)} again`;
    const dot = document.createElement("i");
    const label = document.createElement("span");
    label.textContent = courseLabel(course, courseNames);
    chip.append(dot, label);
    chip.addEventListener("click", () => {
      if (hidden.has(course)) hidden.delete(course);
      else hidden.add(course);
      writeStored(HIDDEN_KEY, JSON.stringify([...hidden]));
      void refresh();
    });
    filtersEl.append(chip);
  }

  const buried = items.filter((item) => hidden.has(item.courseLabel)).length;
  if (buried > 0) {
    const note = document.createElement("span");
    note.className = "fhidden";
    note.textContent = `${buried} hidden`;
    note.title = "Switched off here, not gone. Click a struck-through course to bring it back.";
    filtersEl.append(note);
  }
}

function anchorDate(now: Date): Date {
  return startOfDay(now, dayOffset);
}

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
function renderDateNav(label: string, step: number): void {
  dateNavEl.replaceChildren();
  dateNavEl.hidden = step === 0;
  if (step === 0) return;

  const back = iconButton("left", "Back");
  back.classList.add("btn-sm");
  back.addEventListener("click", () => {
    dayOffset -= step;
    void refresh();
  });

  const text = document.createElement("span");
  text.className = "datenav--label";
  text.textContent = label;

  const forward = iconButton("right", "Forward");
  forward.classList.add("btn-sm");
  forward.addEventListener("click", () => {
    dayOffset += step;
    void refresh();
  });

  dateNavEl.append(back, text, forward);

  if (dayOffset !== 0) {
    const today = document.createElement("button");
    today.type = "button";
    today.className = "btn btn-quiet btn-sm datenav--today";
    today.textContent = "Today";
    today.addEventListener("click", () => {
      dayOffset = 0;
      void refresh();
    });
    dateNavEl.append(today);
  }
}

/* -------------------------------------------------------------------------- */
/* The untimed band                                                            */
/* -------------------------------------------------------------------------- */

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
const UNTIMED_NOTE = "The course site posted a day, not a time — check the page for the cutoff.";

function renderUntimedBand(items: Item[], now: Date, colours: Map<string, number>): HTMLElement | undefined {
  if (items.length === 0) return undefined;
  const band = document.createElement("div");
  band.className = "band";
  const note = document.createElement("p");
  note.className = "band--note";
  note.textContent = UNTIMED_NOTE;
  band.append(note);
  for (const item of items) {
    band.append(renderRow(item, now, undefined, { primary: "" }, colours));
  }
  return band;
}

/* -------------------------------------------------------------------------- */
/* Typing a deadline in                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The one editor that may be open, and the redraw it is holding off.
 *
 * One at a time by construction: a second "+" pressed while a form is open
 * closes the first. Two forms on screen would each claim the draft box on the
 * day grid, and only one of them could be right about it.
 */
let editor: { handle: Editor; el: HTMLElement } | undefined;
let redrawAfterEditor = false;

/** How long "Deleted … · Undo" stays on screen. */
const UNDO_MS = 10_000;

/**
 * A deletion that can still be taken back, and the fields to rebuild it from.
 *
 * Held here rather than in the banner element, because `renderBanners` replaces
 * its children on every draw — and a sync landing two seconds after a delete
 * would otherwise take the Undo away with it. The banner is re-derived from
 * this on each draw, so it survives every redraw until it expires.
 *
 * The new row gets a new `sourceId`: the delete pruned the old key's overrides
 * (a hide, a tick), and reusing the id would re-arm them against a row the
 * student has just re-created. Undo means "put the deadline back", not "put the
 * corrections back".
 */
let pendingUndo: { title: string; values: EditorValues; until: number } | undefined;
let undoTimer: ReturnType<typeof setTimeout> | undefined;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** `HH:MM` on a 24-hour clock — what `<input type="time">` and §3 both use. */
function timeValue(when: Date): string {
  return `${pad2(when.getHours())}:${pad2(when.getMinutes())}`;
}

/**
 * The fields of a manual row, as the editor's strings.
 *
 * Read from the *member*, not from the merged `Item`: a manual row can be
 * merged with a Gradescope one, and then `item.title` and `item.url` are
 * whichever member §5.3 ranked highest. Editing would silently rewrite the
 * student's own row to say what Gradescope says.
 *
 * A time the extension invented comes back blank. `extra.timeAssumed` is the
 * mark worker rule 3 exists for, and pre-filling 23:59 from it would turn an
 * invention into a value the student had apparently stated the moment they
 * opened the form to fix a typo in the title.
 */
function valuesOfMember(member: Item["members"][number]): EditorValues {
  const due = member.dueAt ? new Date(member.dueAt) : undefined;
  const assumed = member.extra?.["timeAssumed"] === "true";
  const endRaw = member.extra?.["endAt"];
  const end = endRaw ? new Date(endRaw) : undefined;
  const dated = due !== undefined && !Number.isNaN(due.getTime());
  return {
    title: member.title,
    courseRaw: member.courseRaw,
    date: dated ? dayKey(due!) : viewedDate(),
    time: dated && !assumed ? timeValue(due!) : "",
    endTime: end !== undefined && !Number.isNaN(end.getTime()) ? timeValue(end) : "",
    kind: member.kind,
    url: member.url ?? "",
  };
}

/** The course labels on screen, offered as suggestions and not as a closed list. */
function courseChoices(): string[] {
  return coursesIn(currentItems).map((course) => courseLabel(course, courseNames));
}

/**
 * Hand the fields to the worker, and turn a refusal into something to read.
 *
 * `core/manual.ts` is the only thing that judges these, so this does no
 * checking of its own — it forwards strings and rethrows the sentence. The
 * `.catch` lives in the editor, which is the surface that has somewhere to put
 * it (UI house rule 2: a `send` without one is silent in the page *and* in the
 * worker's console).
 */
async function saveManual(values: EditorValues, sourceId?: string): Promise<void> {
  const input = {
    title: values.title,
    courseRaw: values.courseRaw,
    date: values.date,
    time: values.time,
    endTime: values.endTime,
    kind: values.kind,
    url: values.url,
  };
  const response = await send(
    sourceId === undefined
      ? { type: "add-manual-item", input }
      : { type: "edit-manual-item", sourceId, input },
  );
  if (response.type === "error") throw new Error(response.message);
}

interface EditorRequest {
  /** Where the form goes. In the popup this is always a node already in flow. */
  container: HTMLElement;
  where?: "start" | "end";
  heading: string;
  submitLabel: string;
  values: Partial<EditorValues>;
  /** Present when this is an edit rather than a new row. */
  sourceId?: string;
  /** Follows the clock fields; the day grid uses it to move the draft box. */
  onChange?: (values: EditorValues) => void;
  /** Run when the form goes away, however it goes away. */
  onClose?: () => void;
}

let editorOnClose: (() => void) | undefined;

function closeEditor(): void {
  if (!editor) return;
  const el = editor.el;
  editor = undefined;
  el.remove();
  const after = editorOnClose;
  editorOnClose = undefined;
  after?.();
  if (redrawAfterEditor) {
    redrawAfterEditor = false;
    void refresh();
  }
}

function openEditor(request: EditorRequest): void {
  closeMenus();
  closeEditor();
  const handle = createEditor({
    heading: request.heading,
    submitLabel: request.submitLabel,
    courses: courseChoices(),
    values: request.values,
    ...(request.onChange ? { onChange: request.onChange } : {}),
    onSave: async (values) => {
      await saveManual(values, request.sourceId);
      closeEditor();
      // Not deferred: the form is gone, and the row it just created is the
      // whole point of having pressed Save.
      await refresh();
    },
    onCancel: () => closeEditor(),
  });
  editor = { handle, el: handle.el };
  editorOnClose = request.onClose;
  if (request.where === "end") request.container.append(handle.el);
  else request.container.prepend(handle.el);
  handle.focus();
  // The form is taller than most rows, and in the week and month views it opens
  // well down a document that may be scrolled. `nearest`, so a form already in
  // view does not move the page under the pointer that opened it.
  handle.el.scrollIntoView({ block: "nearest" });
}

/** The day currently being looked at, as `YYYY-MM-DD`. */
function viewedDate(): string {
  return dayKey(anchorDate(new Date()));
}

/** The bar's "+", and the week and month "+"s, all end up here. */
function openAddEditor(request: Partial<EditorRequest> = {}): void {
  openEditor({
    container: viewEl,
    where: "start",
    heading: "Add a deadline",
    submitLabel: "Add",
    ...request,
    values: { date: viewedDate(), kind: "assignment", ...(request.values ?? {}) },
  });
}

function openEditEditor(item: Item, member: Item["members"][number]): void {
  openEditor({
    container: viewEl,
    where: "start",
    heading: `Edit \u201c${item.title}\u201d`,
    submitLabel: "Save",
    values: valuesOfMember(member),
    sourceId: member.sourceId,
  });
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
function soleManualMember(item: Item): Item["members"][number] | undefined {
  if (item.members.length !== 1) return undefined;
  const member = item.members[0]!;
  return member.source === "manual" ? member : undefined;
}

function clearUndo(): void {
  pendingUndo = undefined;
  if (undoTimer !== undefined) clearTimeout(undoTimer);
  undoTimer = undefined;
}

function deleteManual(item: Item, member: Item["members"][number], entry: HTMLElement): void {
  // Said on the control that was pressed, before anything can go wrong — the
  // same reason `applyOverrideAction` does it (UI house rule 4).
  entry.replaceChildren(icon("sync"), document.createTextNode("Deleting\u2026"));
  for (const other of entry.parentElement?.querySelectorAll("button") ?? []) {
    (other as HTMLButtonElement).disabled = true;
  }
  console.log(`[illini-dash] delete requested for manual:${member.sourceId}`);
  const values = valuesOfMember(member);
  void send({ type: "delete-manual-item", sourceId: member.sourceId })
    .then((response) => {
      if (response.type === "error") {
        showStatus(response.message);
        return;
      }
      clearUndo();
      pendingUndo = { title: item.title, values, until: Date.now() + UNDO_MS };
      undoTimer = setTimeout(() => {
        clearUndo();
        void refresh();
      }, UNDO_MS);
    })
    .catch((err: unknown) => {
      showStatus(
        `Could not delete that deadline: ${err instanceof Error ? err.message : String(err)}`,
      );
    })
    .finally(() => {
      closeMenus();
      void refresh();
    });
}

function undoDelete(): void {
  const undo = pendingUndo;
  if (!undo) return;
  clearUndo();
  void saveManual(undo.values)
    .catch((err: unknown) => {
      showStatus(
        `Could not put that deadline back: ${err instanceof Error ? err.message : String(err)}`,
      );
    })
    .finally(() => void refresh());
}

/* -------------------------------------------------------------------------- */
/* Day                                                                         */
/* -------------------------------------------------------------------------- */

const HOUR_PX = 26;

function clockOf(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function hourLabel(hour: number): string {
  if (hour === 12) return "noon";
  if (hour === 0 || hour === 24) return "12 AM";
  return `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "AM" : "PM"}`;
}

/**
 * The grid, and a callback that sizes it once it is in the document.
 *
 * Stacks are absolutely positioned, so they do not grow their container — and
 * an 11:59 PM deadline starts one pixel before the bottom of a grid that ends
 * at midnight, then draws its two wrapped lines straight over the status line
 * underneath. The overlap was worst for exactly the commonest deadline there
 * is, which is why it survived the preview: the fixture day had nothing at
 * 11:59 PM on it.
 *
 * The height cannot be computed up front because a row's height depends on how
 * its title wraps, which depends on layout. So it is measured after insertion.
 */
function renderDayGrid(
  contents: DayContents,
  now: Date,
  colours: Map<string, number>,
  include: readonly number[] = [],
): { grid: HTMLElement; fit: () => void; slots: HTMLElement; start: number; end: number } {
  const { start, end } = hourRange(contents, include);
  const grid = document.createElement("div");
  grid.className = "grid";

  const hours = document.createElement("div");
  hours.className = "grid--hours";
  for (let hour = start; hour < end; hour += 1) {
    const cell = document.createElement("div");
    cell.className = "grid--hour";
    cell.textContent = hourLabel(hour);
    hours.append(cell);
  }

  const slots = document.createElement("div");
  slots.className = "grid--slots";
  slots.style.height = `${(end - start) * HOUR_PX}px`;
  for (let hour = start; hour < end; hour += 1) {
    const line = document.createElement("div");
    line.className = "grid--line";
    line.style.top = `${(hour - start) * HOUR_PX}px`;
    slots.append(line);
  }

  for (const stack of contents.timed) {
    const box = document.createElement("div");
    box.className = "grid--stack";
    const minutes = minutesInto(new Date(stack[0]!.anchor.at));
    box.style.top = `${(minutes / 60 - start) * HOUR_PX - 2}px`;
    for (const placed of stack) {
      const row = renderPlaced(placed, now, colours);
      /*
       * Something that lasts is a box as tall as it lasts, not a line.
       *
       * An exam sitting and a typed event both say how long they take —
       * `spanMinutes` reads PrairieTest's `"50min"` and the `endAt` a student
       * typed — and a 110-minute midterm drawn as one 26px row says nothing
       * about the two hours it actually occupies. `min-height`, not `height`:
       * a title still wraps to as many lines as it needs, and the row grows
       * past its span rather than clipping it.
       */
      const span = spanMinutes(placed.item, placed.anchor);
      if (span !== undefined) {
        row.classList.add("row-span");
        row.style.minHeight = `${Math.max(HOUR_PX, (span / 60) * HOUR_PX)}px`;
      }
      box.append(row);
    }
    slots.append(box);
  }

  // Where "now" is — on today, and only when now is on the axis at all.
  //
  // The axis starts at 8 AM, so between midnight and then the line's offset is
  // negative and it draws *above* the grid, straight across the booking strip.
  // At 12:30 AM it was a red rule through "not booked", which reads as a
  // strikethrough on the one control that matters most.
  const nowHour = minutesInto(now) / 60;
  if (dayOffset === 0 && nowHour >= start && nowHour < end) {
    const line = document.createElement("div");
    line.className = "grid--now";
    line.style.top = `${(nowHour - start) * HOUR_PX}px`;
    slots.append(line);
  }

  grid.append(hours, slots);
  const floor = (end - start) * HOUR_PX;
  return {
    grid,
    slots,
    start,
    end,
    fit: () => {
      let lowest = floor;
      for (const box of slots.querySelectorAll<HTMLElement>(".grid--stack")) {
        lowest = Math.max(lowest, box.offsetTop + box.offsetHeight);
      }
      slots.style.height = `${lowest}px`;
    },
  };
}

function renderPlaced(placed: PlacedItem, now: Date, colours: Map<string, number>): HTMLElement {
  // The clock alone: the grid already says which day, and "opens" cost the
  // title thirty pixels to repeat what the dashed edge and the tooltip say.
  const row = renderRow(placed.item, now, undefined, { primary: clockOf(placed.anchor.at) }, colours);
  if (placed.anchor.opening) {
    row.classList.add("row-opening");
    row.title = `Not open yet — opens ${clockOf(placed.anchor.at)}`;
  }
  return row;
}

/**
 * Due today, at no hour anyone chose. Above the grid, not at the bottom of it.
 *
 * Sushi's report, and it was a flaw in the reasoning behind the grid rather
 * than a bug in it: the module comment says the 11:59 PM pile-up "is worth
 * seeing", and the layout then put it below the fold of a 600px popup. A
 * deadline you have to scroll to find is one you do not know about.
 */
function renderEndOfDay(
  placed: PlacedItem[],
  now: Date,
  colours: Map<string, number>,
): HTMLElement | undefined {
  if (placed.length === 0) return undefined;
  const box = document.createElement("div");
  box.className = "band band--eod";
  const heading = document.createElement("p");
  heading.className = "band--head";
  heading.textContent = "By end of day";
  box.append(heading);
  for (const one of placed) box.append(renderPlaced(one, now, colours));
  return box;
}

function renderDayView(items: Item[], now: Date, colours: Map<string, number>): void {
  const day = anchorDate(now);
  const contents = dayContents(items, day, now);
  // The hour axis needs height to be worth its cost, and the popup does not
  // have any. Sushi's decision; the reasoning is on `agendaRows`.
  if (isFullView) renderDayGridView(contents, now, colours);
  else renderAgenda(contents, now, colours, dayOffset === 0);
}

/**
 * The popup's day: one row per item and nothing per empty hour.
 *
 * The sequence is decided in `agendaRows` and only drawn here — where the "now"
 * rule goes and whether it is drawn at all are decisions, and decisions in this
 * project live where the suite can mutate them.
 */
function renderAgenda(
  contents: DayContents,
  now: Date,
  colours: Map<string, number>,
  isToday: boolean,
): void {
  // What the narrower "when" column keys off: an agenda row carries a clock,
  // and the date navigator above it already said which day.
  viewEl.dataset["shape"] = "agenda";
  const rows = agendaRows(contents, now, isToday);
  if (rows.length === 0) {
    viewEl.append(emptyNote("Nothing due this day."));
    return;
  }
  for (const row of rows) viewEl.append(renderAgendaRow(row, now, colours));
}

function renderAgendaRow(
  row: AgendaRow,
  now: Date,
  colours: Map<string, number>,
): HTMLElement {
  switch (row.kind) {
    case "heading": {
      const heading = document.createElement("p");
      heading.className = "band--head";
      heading.textContent = row.text;
      // Said once, above the rows it applies to. Five consecutive course-site
      // rows each carrying the same sentence is what this replaced; the fact
      // belongs to the group, not to the row.
      if (row.text === UNTIMED_HEADING) heading.title = UNTIMED_NOTE;
      if (row.text === END_OF_DAY_HEADING) {
        heading.title = "11:59 PM is the site's default, not an hour anyone picked.";
      }
      return heading;
    }
    case "untimed":
      return renderRow(row.item, now, undefined, { primary: "" }, colours);
    case "item":
      return renderPlaced(row.placed, now, colours);
    case "now": {
      const rule = document.createElement("div");
      rule.className = "nowrule";
      const label = document.createElement("span");
      label.textContent = now.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      rule.append(label);
      return rule;
    }
  }
}

/**
 * The full view's day, which has the height an hour axis is worth.
 *
 * **The empty day draws the grid too, which reverses an earlier decision.**
 * That decision — "no grid at all rather than ten empty ruled hours, which say
 * nothing and push what is above them off the screen" — was right while the
 * axis was only somewhere deadlines were *shown*. It is now where they are
 * *added*: a press on 3 PM is how a student puts something at 3 PM, and an
 * empty day is exactly the day they are most likely to be filling in. A blank
 * page with nothing to press is the one shape that makes the gesture
 * undiscoverable.
 *
 * The "nothing due" note stays, above the grid rather than instead of it, so
 * the day still says what it holds before it offers somewhere to write.
 */
function renderDayGridView(
  contents: DayContents,
  now: Date,
  colours: Map<string, number>,
): void {
  const band = renderUntimedBand(contents.untimed, now, colours);
  if (band) viewEl.append(band);
  const eod = renderEndOfDay(contents.endOfDay, now, colours);
  if (eod) viewEl.append(eod);

  if (contents.timed.length === 0) {
    viewEl.append(
      emptyNote(
        contents.endOfDay.length + contents.untimed.length > 0
          ? "Nothing else at a set time today. Drag on the grid to add something."
          : "Nothing due this day. Drag on the grid to add something.",
      ),
    );
  }

  mountDayGrid(viewEl, contents, now, colours);
}

/* -------------------------------------------------------------------------- */
/* Dragging a box onto the hour axis                                           */
/* -------------------------------------------------------------------------- */

/**
 * Quarter hours.
 *
 * A grid hour is 26px, so one pixel is a little over two minutes and an
 * unsnapped drag would produce "4:37\u20135:09 PM" — a precision the gesture does
 * not have and a deadline nobody meant. Fifteen minutes is 6.5px, which is
 * still finer than the hand is.
 */
const SNAP_MINUTES = 15;

/**
 * How far the pointer must travel before this is a drag rather than a press.
 *
 * Under this, the gesture is a click: one instant, no end time. A press that
 * wobbles two pixels and silently becomes a five-minute event is the kind of
 * thing that makes a control feel broken.
 */
const DRAG_SLOP_PX = 4;

interface DayGridRef {
  host: HTMLElement;
  el: HTMLElement;
  slots: HTMLElement;
  start: number;
  end: number;
  contents: DayContents;
  now: Date;
  colours: Map<string, number>;
}

/** The grid currently on screen, so the draft box can be re-placed on it. */
let dayGrid: DayGridRef | undefined;

/** Where the student is putting something, in minutes from local midnight. */
let draft: { startMin: number; endMin?: number } | undefined;

/**
 * The hours the axis must cover because of the draft, on top of the day's own.
 *
 * Both ends: a box dragged from 9 PM to 10:30 needs the axis to reach 10:30, or
 * the ghost is drawn past the bottom of the grid it is supposed to be inside.
 */
function draftHours(): number[] {
  if (!draft) return [];
  const hours = [draft.startMin / 60];
  if (draft.endMin !== undefined) hours.push(draft.endMin / 60);
  return hours;
}

function mountDayGrid(
  host: HTMLElement,
  contents: DayContents,
  now: Date,
  colours: Map<string, number>,
): void {
  const built = renderDayGrid(contents, now, colours, draftHours());
  host.append(built.grid);
  // Only measurable once it is in the document.
  built.fit();
  dayGrid = {
    host,
    el: built.grid,
    slots: built.slots,
    start: built.start,
    end: built.end,
    contents,
    now,
    colours,
  };
  wireDayDrag(dayGrid);
  paintDraft();
}

/**
 * Rebuild only the grid, leaving everything else in `#view` alone.
 *
 * A typed time outside the current axis has to widen it, and the obvious way to
 * widen it is a redraw — which would take the editor that is being typed into
 * with it. So the grid element is replaced in place and the form above it never
 * moves.
 */
function rebuildDayGrid(): void {
  const current = dayGrid;
  if (!current || !current.el.isConnected) return;
  const built = renderDayGrid(current.contents, current.now, current.colours, draftHours());
  current.el.replaceWith(built.grid);
  built.fit();
  dayGrid = { ...current, el: built.grid, slots: built.slots, start: built.start, end: built.end };
  wireDayDrag(dayGrid);
  paintDraft();
}

function clockAt(minutes: number): string {
  const when = anchorDate(new Date());
  when.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * "3:00\u20134:30 PM", with the meridiem written once when it is the same one.
 *
 * Not a cosmetic saving: the label sits inside a box that can be 13px tall at
 * the narrow end of a quarter-hour drag, and "3:00 PM\u20134:30 PM" is what makes
 * it wrap out of its own box.
 */
function draftLabel(startMin: number, endMin?: number): string {
  const from = clockAt(startMin);
  if (endMin === undefined) return from;
  const to = clockAt(endMin);
  const suffix = / (AM|PM)$/.exec(to)?.[1];
  const trimmed = suffix && from.endsWith(` ${suffix}`) ? from.slice(0, -suffix.length - 1) : from;
  return `${trimmed}\u2013${to}`;
}

function paintDraft(): void {
  const grid = dayGrid;
  if (!grid) return;
  for (const old of grid.slots.querySelectorAll(".grid--draft")) old.remove();
  if (!draft) return;

  const box = document.createElement("div");
  box.className = "grid--draft";
  const top = (draft.startMin / 60 - grid.start) * HOUR_PX;
  const minutes = draft.endMin === undefined ? SNAP_MINUTES : draft.endMin - draft.startMin;
  box.style.top = `${top}px`;
  box.style.height = `${Math.max(12, (minutes / 60) * HOUR_PX)}px`;

  const label = document.createElement("span");
  label.className = "grid--draft-label";
  label.textContent = draftLabel(draft.startMin, draft.endMin);
  box.append(label);
  grid.slots.append(box);
}

/** Put the draft here, widening the axis first when it no longer fits on it. */
function setDraft(startMin: number, endMin?: number): void {
  draft = endMin === undefined ? { startMin } : { startMin, endMin };
  const grid = dayGrid;
  const covered =
    grid !== undefined &&
    startMin >= grid.start * 60 &&
    (endMin ?? startMin) <= grid.end * 60;
  if (covered) paintDraft();
  else rebuildDayGrid();
}

function clearDraft(): void {
  if (!draft) return;
  draft = undefined;
  // Rebuilt rather than only repainted, so the axis gives back the hours it
  // widened by. A grid left stretched to 11 PM after a cancelled drag is a day
  // that quietly looks different from every other day.
  rebuildDayGrid();
}

/** `HH:MM` back to minutes, for a time the student typed into the editor. */
function minutesOfClock(value: string): number | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  // Deliberately not a refusal: `core/manual.ts` is what judges this string.
  // All this decides is whether the ghost can be drawn, and a half-typed time
  // simply leaves it where it was.
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}

function wireDayDrag(ref: DayGridRef): void {
  const minutesAt = (clientY: number): number => {
    const rect = ref.slots.getBoundingClientRect();
    const raw = ref.start * 60 + ((clientY - rect.top) / HOUR_PX) * 60;
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    return Math.min(ref.end * 60, Math.max(ref.start * 60, snapped));
  };

  ref.slots.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const target = event.target;
    // A press on a deadline is a press on that deadline. `.grid--line` and
    // `.grid--now` are decoration stretched across the whole width, so they are
    // deliberately *not* excluded — a student aiming at 4 PM will land on the
    // 4 PM rule about half the time.
    if (target instanceof Element && target.closest(".row, .grid--stack, .editor")) return;
    event.preventDefault();

    const anchorMin = minutesAt(event.clientY);
    const fromY = event.clientY;
    let moved = false;
    setDraft(anchorMin);
    // Capture, so a drag that leaves the grid — upward past the banners, or out
    // of the window — still reports its moves and its release here.
    ref.slots.setPointerCapture(event.pointerId);

    const move = (moveEvent: PointerEvent): void => {
      if (Math.abs(moveEvent.clientY - fromY) >= DRAG_SLOP_PX) moved = true;
      const other = minutesAt(moveEvent.clientY);
      const from = Math.min(anchorMin, other);
      const to = Math.max(anchorMin, other);
      setDraft(from, moved && to > from ? to : undefined);
    };

    const finish = (upEvent: PointerEvent, cancelled: boolean): void => {
      ref.slots.removeEventListener("pointermove", move);
      ref.slots.removeEventListener("pointerup", up);
      ref.slots.removeEventListener("pointercancel", cancel);
      if (ref.slots.hasPointerCapture(upEvent.pointerId)) {
        ref.slots.releasePointerCapture(upEvent.pointerId);
      }
      if (cancelled) {
        clearDraft();
        return;
      }
      const current = draft;
      if (!current) return;
      openDraftEditor(current.startMin, current.endMin);
    };
    const up = (upEvent: PointerEvent): void => finish(upEvent, false);
    const cancel = (cancelEvent: PointerEvent): void => finish(cancelEvent, true);

    ref.slots.addEventListener("pointermove", move);
    ref.slots.addEventListener("pointerup", up);
    ref.slots.addEventListener("pointercancel", cancel);
  });
}

/**
 * The form for a box just dragged onto the axis.
 *
 * A dragged *span* opens as an Event, not a deadline: the student said when it
 * starts and when it ends, and the end time field only exists for the kinds
 * that have one — opening it as a deadline would throw away half of what the
 * gesture stated. A press with no drag stays a deadline, which is what the
 * other 95% of this list is.
 */
function openDraftEditor(startMin: number, endMin?: number): void {
  const time = `${pad2(Math.floor(startMin / 60))}:${pad2(startMin % 60)}`;
  const endTime =
    endMin === undefined ? "" : `${pad2(Math.floor(endMin / 60))}:${pad2(endMin % 60)}`;
  openAddEditor({
    values: {
      date: viewedDate(),
      time,
      endTime,
      kind: endMin === undefined ? "assignment" : "event",
    },
    onChange: (values) => {
      // The ghost follows what is typed, so the two controls for one fact — the
      // box and the clock fields — cannot disagree about where it is.
      const from = minutesOfClock(values.time);
      if (from === undefined) return;
      const to = minutesOfClock(values.endTime);
      setDraft(from, to !== undefined && to > from ? to : undefined);
    },
    onClose: () => clearDraft(),
  });
}

function emptyNote(text: string): HTMLElement {
  const note = document.createElement("p");
  note.className = "muted empty";
  note.textContent = text;
  return note;
}

/* -------------------------------------------------------------------------- */
/* Week                                                                        */
/* -------------------------------------------------------------------------- */

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
const WEEK_MODE: WeekMode = "rolling";

function renderWeekView(items: Item[], now: Date, colours: Map<string, number>): void {
  for (const day of weekContents(items, anchorDate(now), now, WEEK_MODE)) {
    const row = document.createElement("div");
    row.className = "wrow";
    if (day.isToday) row.classList.add("wrow--today");

    const head = document.createElement("div");
    head.className = "wday";
    const dow = document.createElement("div");
    dow.className = "wday--dow";
    dow.textContent = day.date.toLocaleDateString(undefined, { weekday: "short" });
    const num = document.createElement("div");
    num.className = "wday--num";
    num.textContent = String(day.date.getDate());
    head.append(dow, num);

    const box = document.createElement("div");
    box.className = "witems";
    /*
     * Anywhere in the row that is not a deadline is somewhere to add one.
     *
     * A week row has no hour axis to aim at, so there is nothing to drag — but
     * "press the empty part of Tuesday" is the same gesture every calendar
     * answers, and the day is already written on the left of it.
     */
    box.addEventListener("click", (event) => {
      if (event.target !== box) return;
      openAddEditor({ container: box, where: "end", values: { date: dayKey(day.date) } });
    });
    const addHere = iconButton("plus", `Add something on ${
      day.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
    }`);
    // Visible on hover and whenever it has focus: a control that only exists
    // under a pointer is one no keyboard can ever reach.
    addHere.classList.add("btn-sm", "wadd");
    addHere.addEventListener("click", (event) => {
      event.stopPropagation();
      openAddEditor({ container: box, where: "end", values: { date: dayKey(day.date) } });
    });
    const timed = allTimed(day.contents);
    // A day nobody owes anything on gets the tight header, whether it is empty
    // or holds four things already handed in. The decision is `quietDay`'s;
    // this only draws it.
    if (quietDay(day.contents, now)) row.classList.add("wrow--quiet");
    if (timed.length === 0 && day.contents.untimed.length === 0) {
      // A 22px row rather than a full-height one. An empty day is worth a line
      // saying it is empty and nothing more — seven of them at full height is
      // the whole popup.
      box.classList.add("witems--empty");
      box.textContent = "—";
    } else {
      for (const placed of timed) box.append(renderPlaced(placed, now, colours));
      if (day.contents.untimed.length > 0) {
        const label = document.createElement("div");
        label.className = "wuntimed";
        label.textContent = "time not posted —";
        label.title = UNTIMED_NOTE;
        box.append(label);
        for (const item of day.contents.untimed) {
          box.append(renderRow(item, now, undefined, { primary: "" }, colours));
        }
      }
    }

    box.append(addHere);
    row.append(head, box);
    viewEl.append(row);
  }
}

/* -------------------------------------------------------------------------- */
/* Month                                                                       */
/* -------------------------------------------------------------------------- */

function renderMonthView(items: Item[], now: Date, colours: Map<string, number>): void {
  const anchor = anchorDate(now);
  const head = document.createElement("div");
  head.className = "mhead";
  for (let i = 0; i < 7; i += 1) {
    const label = document.createElement("div");
    label.textContent = startOfDay(new Date(2026, 8, 6), i).toLocaleDateString(undefined, {
      weekday: "short",
    });
    head.append(label);
  }

  const grid = document.createElement("div");
  grid.className = "mgrid";
  for (const cell of monthCells(items, anchor, now)) {
    const box = document.createElement("div");
    box.className = "mcell";
    if (!cell.inMonth) box.classList.add("mcell--out");
    if (cell.isToday) box.classList.add("mcell--today");

    const num = document.createElement("div");
    num.className = "mnum";
    num.textContent = String(cell.date.getDate());

    /*
     * The "+" at the head of the cell, and a press on the empty part of it.
     *
     * Positioned rather than placed inside `.mnum`: today's number is a 24px
     * circle with `place-items: center`, and a second child in it would push
     * the date out of its own ring.
     *
     * The form itself opens at the top of the view rather than inside the cell.
     * A month cell is about 100px tall and a seventh of the window wide, so a
     * form in it would push six other weeks off the screen to show three
     * truncated fields.
     */
    const addDay = iconButton("plus", `Add something on ${
      cell.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
    }`);
    addDay.classList.add("btn-sm", "madd");
    const addOnThisDay = (): void => openAddEditor({ values: { date: dayKey(cell.date) } });
    addDay.addEventListener("click", (event) => {
      event.stopPropagation();
      addOnThisDay();
    });
    box.addEventListener("click", (event) => {
      if (event.target !== box) return;
      addOnThisDay();
    });
    box.append(num, addDay);

    for (const placed of cell.items.slice(0, MONTH_CELL_ROWS)) {
      box.append(renderMonthPill(placed, now, colours));
    }
    if (cell.items.length > MONTH_CELL_ROWS) {
      const more = document.createElement("button");
      more.className = "mmore";
      more.textContent = `+${cell.items.length - MONTH_CELL_ROWS} more`;
      more.addEventListener("click", () => {
        // The day view is where the rest fits, so go there rather than growing
        // a cell that would push five other weeks off the screen.
        dayOffset = Math.round((cell.date.getTime() - startOfDay(now).getTime()) / 86_400_000);
        view = "day";
        writeStored(VIEW_KEY, view);
        void refresh();
      });
      box.append(more);
    }
    grid.append(box);
  }
  viewEl.append(head, grid);
}

/**
 * A month cell is 100px, so a pill is a course code and as much title as fits.
 *
 * Truncation is deliberate here: three recognisable rows beat one complete one,
 * because the question a month answers is "which days are heavy", and the full
 * title is one click away in the day view.
 */
function renderMonthPill(
  placed: PlacedItem,
  now: Date,
  colours: Map<string, number>,
): HTMLElement {
  const { item, anchor } = placed;
  const pill = document.createElement("div");
  pill.className = `mpill course-${colours.get(item.courseLabel) ?? 0}`;
  if (item.kind === "event") pill.classList.add("mpill--event");
  else if (item.kind === "exam") pill.classList.add("mpill--exam");
  if (anchor.opening) pill.classList.add("mpill--opening");
  if (anchor.assumed) pill.classList.add("mpill--untimed");
  // The same tone the list uses. Without it a month of finished work looked
  // exactly like a month of work still owed, which is the one question a month
  // is for.
  const tone = itemTone(item, now);
  if (tone !== "open") pill.classList.add(`mpill--${tone}`);

  const code = document.createElement("span");
  code.className = "mpill--code";
  code.textContent = courseLabel(item.courseLabel, courseNames);
  const name = document.createElement("span");
  name.className = "mpill--name";
  name.textContent = item.title;
  pill.append(code, name);

  pill.title = anchor.assumed
    ? `${item.title} — ${UNTIMED_NOTE}`
    : `${item.title} — ${anchor.opening ? "opens " : ""}${clockOf(anchor.at)}`;

  /*
   * The pill opens the row menu, not the source.
   *
   * "For month, there's none of those options" — a beta report, and it was
   * exactly right: Mark done, Hide, Split and Merge were unreachable from the
   * month entirely, and so was the keyboard, because this was a `div` with a
   * click handler and no role.
   *
   * A `⋯` of its own does not fit. A month cell holds three pills and each is a
   * course code plus a title in the width of a seventh of the window; a control
   * beside that would take the title's remaining characters, and the title is
   * the only thing that says which assignment this is.
   *
   * So the pill *is* the control, and it costs one click on the open path
   * rather than removing it: `openRowMenu` leads with "Open in Gradescope",
   * which is the same destination this used to go to directly. That trade reads
   * the right way round for a month — it is the view you plan in, not the one
   * you work from, and everything else a student can do to a row was missing.
   */
  pill.setAttribute("role", "button");
  pill.tabIndex = -1;
  const open = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    openRowMenu(item, pill);
  };
  pill.addEventListener("click", open);
  pill.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") open(event);
  });
  return pill;
}

/* -------------------------------------------------------------------------- */
/* Exams                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Everything you have to turn up to, with no 60-day horizon.
 *
 * Every other view stops at 60 days, which is right for homework and wrong for
 * the one thing always further out: in September a December final is invisible,
 * and it is the deadline a student most wants a month's warning about.
 */
function renderExamsView(items: Item[], now: Date, colours: Map<string, number>): void {
  const board = examBoard(items, now);

  if (board.unbooked.length === 0 && board.upcoming.length === 0 && board.recent.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted empty";
    // Not "no exams": that is a claim about the term, and all this knows is
    // that no source mentioned one. PrairieTest is where most of them come
    // from, and it is a source a student may have switched off.
    empty.textContent = "No exams or quizzes from any source you have switched on.";
    viewEl.append(empty);
    return;
  }

  if (board.unbooked.length > 0) {
    viewEl.append(examHeading("Not booked", board.unbooked.length, "err"));
    for (const item of board.unbooked) {
      // "Book a slot: " is PrairieTest's own prefix, and under a heading that
      // already reads "Not booked" it is the third time the row says the same
      // thing — at the cost of the exam's actual name.
      const row = renderRow(item, now, undefined, bookingWindowText(item), colours);
      const title = row.querySelector<HTMLElement>(".row--title");
      if (title) {
        title.textContent = item.title.replace(/^Book a slot:\s*/i, "");
        title.title = item.title;
      }
      viewEl.append(row);
    }
  }

  if (board.upcoming.length > 0) {
    viewEl.append(examHeading("Coming up", board.upcoming.length));
    for (const placed of board.upcoming) {
      viewEl.append(renderRow(placed.item, now, undefined, examWhen(placed, now), colours));
    }
  }

  if (board.recent.length > 0) {
    // A week of them, so "I already sat that" and "this never existed" are
    // different answers. They drop out on their own after that.
    viewEl.append(examHeading("Just sat", board.recent.length));
    for (const placed of board.recent) {
      const row = renderRow(placed.item, now, undefined, examWhen(placed, now), colours);
      row.classList.add("row-sat");
      viewEl.append(row);
    }
  }
}

function examHeading(text: string, count: number, tone?: "err"): HTMLElement {
  const heading = document.createElement("h2");
  heading.className = "section";
  if (tone === "err") heading.classList.add("section--err");
  heading.textContent = `${text} (${count})`;
  return heading;
}

/**
 * The date *and* the day, unlike every other view.
 *
 * Elsewhere the grid or the heading already says which day, so the row carries
 * only a clock. This list spans a whole term, so a bare "7:00 PM" would be the
 * least useful thing it could say.
 */
function examWhen(placed: PlacedItem, now: Date): { primary: string; detail?: string } {
  const at = new Date(placed.anchor.at);
  const day = at.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const clock = at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const days = Math.round((startOfDay(at).getTime() - startOfDay(now).getTime()) / 86_400_000);
  const away = days === 0 ? "today" : days === 1 ? "tomorrow" : days > 0 ? `in ${days}d` : undefined;
  return { primary: `${day} ${clock}`, detail: away };
}

/* -------------------------------------------------------------------------- */
/* Attention                                                                   */
/* -------------------------------------------------------------------------- */

const ATTENTION_NOTE: Record<AttentionName, string> = {
  Overdue: "Past its deadline in the last week.",
  "Couldn't read":
    "The source printed a date this extension could not make sense of, so these have no place on the calendar. They are the deadlines it is least sure about.",
  "No date at all": "Listed by a source with no deadline on it anywhere.",
};

function renderAttentionView(items: Item[], now: Date, colours: Map<string, number>): void {
  const groups = attentionGroups(items, now);
  if (groups.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted empty";
    empty.textContent = "Nothing needs attention.";
    viewEl.append(empty);
    return;
  }
  for (const group of groups) {
    if (!isActionable(group.name)) {
      // Folded away. It never empties — undated rows accumulate all semester —
      // so left open it buries the two groups that are actually asking for
      // something. Still here, because dropping a row a source listed is the
      // silent loss §11 ranks worst.
      viewEl.append(renderFoldedGroup(group, now, colours));
      continue;
    }
    const heading = document.createElement("h2");
    heading.className = "section";
    if (group.name === "Couldn't read") heading.classList.add("section--err");
    heading.textContent = `${group.name} (${group.items.length})`;
    heading.title = ATTENTION_NOTE[group.name];
    viewEl.append(heading);
    for (const item of group.items) {
      viewEl.append(renderRow(item, now, "Needs attention", undefined, colours));
    }
  }
}

function renderFoldedGroup(
  group: { name: AttentionName; items: Item[] },
  now: Date,
  colours: Map<string, number>,
): HTMLElement {
  const fold = document.createElement("details");
  fold.className = "fold";
  const summary = document.createElement("summary");
  summary.className = "fold--summary";
  // An SVG chevron rather than "▸ " as `content`: a text glyph is whatever the
  // installed font has, and this one sat on the text baseline rather than on
  // the label's centre.
  summary.append(icon("right"), document.createTextNode(`${group.name} (${group.items.length})`));
  summary.title = ATTENTION_NOTE[group.name];
  fold.append(summary);

  for (const item of group.items) {
    fold.append(renderRow(item, now, "Needs attention", undefined, colours));
  }
  return fold;
}

/* -------------------------------------------------------------------------- */
/* The whole popup                                                             */
/* -------------------------------------------------------------------------- */

function navFor(view_: ViewName, now: Date): { label: string; step: number } {
  const anchor = anchorDate(now);
  switch (view_) {
    case "day":
      return {
        label:
          dayOffset === 0
            ? `Today · ${anchor.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`
            : anchor.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
        step: 1,
      };
    case "week": {
      const days = weekContents([], anchor, now, WEEK_MODE);
      const first = days[0]!.date;
      const last = days[6]!.date;
      const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

function render(
  items: Item[],
  settings: Settings,
  sources: Record<Source, SourceStatus>,
  now: Date,
): void {
  // An open menu closed over an Item from the previous list. Rather than pull
  // the list out from under it — the popup fires a sync on open, so that race
  // is the common case, not a corner one — the redraw waits for the menu to
  // close. Checked here, after the awaits in `draw`, and not only in `refresh`:
  // a menu can open while the state is in flight.
  if (drawIsHeld()) return;
  currentItems = items;
  viewEl.replaceChildren();
  // The grid that was on screen is gone with those children, and so is anything
  // that was being dragged onto it. A draw only ever happens with no editor
  // open (see `drawIsHeld`), so nothing is being typed that this discards.
  dayGrid = undefined;
  draft = undefined;
  delete viewEl.dataset["shape"];
  // What the full view's width cap keys off. A month may use 1400px; a list of
  // rows stops at 1100 so the clock does not end up a foot from the title. Set
  // from the view rather than from a media query, because Chrome lays the
  // document out to decide the popup's width and a width rule can feed itself.
  document.body.dataset["view"] = view;

  // Two lists, because the calendar and the Attention tab are asking different
  // questions. A grid says what was on a day, so finished work belongs on it,
  // struck through (Sushi, 2026-09-18). Attention is a list of what is still
  // owed, so it keeps `dropFinished` and keeps behaving exactly as before.
  const onGrid = visibleItems(items, settings, hidden, now);
  const owed = visibleItems(items, settings, hidden, now, { dropFinished: true });
  const colours = courseColours(coursesIn(visibleItems(items, settings, new Set(), now)));

  renderTabs({
    exams: examCount(items, now),
    attention: attentionCount(owed, now),
  });
  // The header bar is sticky, so without this the tabs slide under it and
  // switching views means scrolling back to the top of the list. Measured
  // rather than hard-coded: the bar's height is a font metric.
  const bar = document.querySelector<HTMLElement>(".bar");
  if (bar) tabsEl.style.top = `${bar.offsetHeight}px`;
  renderFilters(visibleItems(items, settings, new Set(), now), colours);

  const nav = navFor(view, now);
  renderDateNav(nav.label, nav.step);

  if (view === "attention") {
    renderAttentionView(owed, now, colours);
    makeRowsNavigable();
    return;
  }
  if (view === "exams") {
    // From `items`, not `onGrid`: a booking is filtered out of the grid on
    // purpose, and an exam is exactly the row a course filter should not be
    // able to hide by accident.
    renderExamsView(items, now, colours);
    makeRowsNavigable();
    return;
  }

  // "Nothing due in the next 60 days." is only true when every source was read
  // and every source was empty. Said over an expired session it reads as "you
  // are free" and means "I could not look" (§11).
  if (onGrid.length === 0) {
    const state = emptyStateFor(sources, items.length > 0);
    viewEl.append(
      emptyNote(hidden.size > 0 ? "Every course is switched off above." : state.text),
    );
    if (hidden.size === 0) {
      // A real button under the sentence. These used to be `.link` — text that
      // looked like the rest of the sentence it sat under, on the one screen
      // where there is nothing else to click.
      const actions = document.createElement("div");
      actions.className = "empty--actions";
      for (const source of state.logins) {
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
    return;
  }

  if (view === "day") renderDayView(onGrid, now, colours);
  else if (view === "week") renderWeekView(onGrid, now, colours);
  else renderMonthView(onGrid, now, colours);
  makeRowsNavigable();
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
    renderSetup(setup.rows);
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
  const { state, missing } = normalizePopupState<typeof response>(response);
  const now = new Date();
  // Recorded before anything is drawn, so the first-run screen — which is the
  // same page and runs before this on the draw where it shows — has a real
  // answer to put under its checklist on the next pass.
  const visible = state.items.filter((item) => !item.hidden);
  lastFound = { items: visible.length, courses: coursesIn(visible).length };
  courseNames = state.courseNames ?? {};
  lastHealth = { sources: state.sources, ...(state.lastSyncAt ? { lastSyncAt: state.lastSyncAt } : {}) };
  renderHealth(state.sources, state.lastSyncAt, now);
  renderBanners(state);
  render(state.items, state.settings ?? DEFAULT_SETTINGS, state.sources, now);
  // Only when there is something wrong. On the happy path this element is
  // hidden and costs nothing (worker rule 8: an older worker does not send
  // every field this page reads, and that has to be visible, not thrown).
  showStatus(missing.length > 0 ? staleWorkerNotice(missing) : undefined);
}

/**
 * A sync, with its progress on the control that started it.
 *
 * "Syncing…" used to be written to a status line at the bottom of an 883px
 * document — feedback for a click, placed where the click could not see it.
 * The button spins and the pill takes over from there.
 */
let syncing = false;
/**
 * A sync started by the worker rather than by this page.
 *
 * The navigation listener fires while the student is on Gradescope, not on this
 * page, so `syncing` above knows nothing about it — and the full view is a tab
 * that stays open through all of it. Without this, that window would keep
 * asserting the pre-sync answer for the whole fetch, which is the defect this
 * screen already had once.
 */
let workerSyncing = false;
const SYNCING_KEY = "illini-dash.syncing";
const NAVIGATED_KEY = "illini-dash.navigated";
const isSyncing = () => syncing || workerSyncing;

/** Stops the spinner and lets the pill go back to reporting from the store. */
function endSync(): void {
  if (!syncing) return;
  syncing = false;
  if (syncButton) {
    delete syncButton.dataset["busy"];
    syncButton.disabled = false;
  }
}

async function runSync(): Promise<void> {
  // A second click while one is in flight would spin a button that is already
  // spinning and queue a sync the worker is going to debounce anyway.
  if (syncing) return;
  syncing = true;
  if (syncButton) {
    syncButton.dataset["busy"] = "true";
    syncButton.disabled = true;
  }
  // Repainted before the request rather than after it: a sync is five or six
  // fetches and takes five to ten seconds, and for all of that the header was
  // still asserting the outcome of the *previous* one.
  paintHealth();
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
    paintHealth();
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
 * The student's own names for their courses, refreshed on every draw.
 *
 * Module-level for the same reason `lastHealth` is: six render functions each
 * draw one course label, and threading a map through all of them would put the
 * same argument in six signatures to serve one lookup.
 */
let courseNames: Record<string, string> = {};

/** The last state drawn, so the header can be repainted without a round trip. */
let lastHealth: { sources: Record<Source, SourceStatus>; lastSyncAt?: string } | undefined;

function paintHealth(): void {
  if (!lastHealth) return;
  renderHealth(lastHealth.sources, lastHealth.lastSyncAt, new Date());
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
  if (recheckInFlight || syncing) return;
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
    if (due.length === 0) return;
    // Both branches logged, or "came back, nothing was waiting on a login" and
    // "came back, the check never ran" are the same silence (worker rule 5).
    console.log(`[illini-dash] back on the page — re-checking ${due.join(", ")}`);
    await runSync();
  } finally {
    recheckInFlight = false;
  }
}

renderActions();
void refresh();
// §6: opening the popup triggers a sync, debounced to 5 minutes worker-side.
void send({ type: "sync", trigger: "popup" }).then(refresh).catch(() => undefined);
// A popup is a fresh document on every open, so `visibilitychange` never fires
// for it — opening *is* the return, and it is the moment someone who has just
// signed in comes back to look.
void recheckLogins();

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
    if (next !== workerSyncing) {
      workerSyncing = next;
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
    workerSyncing = true;
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

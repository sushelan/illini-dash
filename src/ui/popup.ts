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
import { send } from "../messages.js";
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
  monthCells,
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
  emptyStateFor,
  healthPill,
  sourceRows,
  staleNotice,
} from "../core/health.js";
import { type IconName, icon, iconButton } from "./icons.js";
import {
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

const ALLOWED_HOSTS = new Set([
  "canvas.illinois.edu",
  "www.gradescope.com",
  "us.prairielearn.com",
  "us.prairietest.com",
]);

/** §8.1: only render a URL that is https on a known host. */
function safeUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return undefined;
    if (ALLOWED_HOSTS.has(url.hostname) || url.hostname.endsWith(".illinois.edu")) {
      return url.toString();
    }
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
  menu.className = "menu-surface popover";
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "Source health");
  menu.addEventListener("click", (event) => event.stopPropagation());

  for (const row of sourceRows(sources, now)) {
    menu.append(renderSourceRow(row));
  }

  const box = anchor.getBoundingClientRect();
  menu.style.top = `${box.bottom + window.scrollY + 4}px`;
  menu.style.left = `${Math.max(8, box.left)}px`;
  document.body.append(menu);
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
  button.textContent = "Try again";
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

function renderActions(): void {
  actionsEl.replaceChildren();

  syncButton = iconButton("sync", "Sync now");
  syncButton.addEventListener("click", () => void runSync());
  actionsEl.append(syncButton);

  if (!isFullView) {
    // "⤢ full view" named the mechanism. What a student wants from it is that
    // the window stops vanishing when they click on the course page behind it.
    const full = iconButton("open-tab", "Open in a tab");
    full.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?view=full") });
    });
    actionsEl.append(full);
  }

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
    const login = LOGIN_URL[stale.source];
    banners.push({
      tone: "warn",
      glyph: "warning",
      text: `${SOURCE_NAME[stale.source]}: ${age}`,
      ...(stale.needsLogin && login
        ? { action: { label: "Sign in", run: () => chrome.tabs.create({ url: login }) } }
        : {}),
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
  if (item.kind === "booking") {
    row.classList.add("row-booking");
  } else if (isItemDone(item) || isTickedDone(item)) {
    // Only reachable in the past now: finished work is still filtered out of
    // everything ahead. It reads as done so it cannot be mistaken for a thing
    // still owed while looking back over a week.
    row.classList.add("row-done");
  } else if (item.kind === "event") {
    // An event is something that happens, not something owed. It reads as
    // background so a list of deadlines still looks like a list of deadlines —
    // and it can never be overdue, so it takes neither of the classes below.
    row.classList.add("row-event");
  } else {
    // Overdue red is for work that can no longer be handed in. A row whose full
    // credit has gone but whose late or reduced-credit window is still open is
    // amber: it is late, not lost, and painting it red told the student to give
    // up on something Gradescope was still accepting.
    const live = liveDeadline(item, now);
    if (live && live.at < now.getTime()) row.classList.add("row-overdue");
    else if (live?.late) row.classList.add("row-late");
  }

  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = item.courseLabel || "—";

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

function closeMenus(): void {
  for (const open of document.querySelectorAll(".menu-surface")) open.remove();
}
document.addEventListener("click", closeMenus);
// Escape closes from anywhere, including from the row the menu was opened on.
// Without it the only way out of an open menu with the keyboard was Tab, which
// walked *into* it and then out the far side of the page.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.querySelector(".menu-surface")) {
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

  // Losing focus out of the menu closes it. A menu left open behind the page it
  // no longer belongs to is how a click lands on the wrong row.
  menu.addEventListener("focusout", () => {
    queueMicrotask(() => {
      if (!menu.isConnected || menu.contains(document.activeElement)) return;
      menu.remove();
      anchor.removeAttribute("aria-expanded");
    });
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
function openRowMenu(item: Item, anchor: HTMLElement): void {
  closeMenus();
  const menu = document.createElement("div");
  menu.className = "menu-surface";
  menu.setAttribute("role", "menu");
  menu.addEventListener("click", (event) => event.stopPropagation());

  const add = (label: string, glyph: IconName, onClick: () => void) => {
    const entry = document.createElement("button");
    entry.type = "button";
    entry.className = "menu-item";
    entry.setAttribute("role", "menuitem");
    entry.tabIndex = -1;
    entry.append(icon(glyph), document.createTextNode(label));
    entry.addEventListener("click", onClick);
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
  add(item.done ? "Not done" : "Mark done", item.done ? "close" : "check", () => {
    void send({
      type: "override",
      action: { kind: item.done ? "undone" : "done", itemId: item.id },
    })
      .then(reportOverride)
      .then(() => {
        closeMenus();
        void refresh();
      });
  });

  add(item.hidden ? "Unhide" : "Hide", item.hidden ? "plus" : "close", () => {
    void send({
      type: "override",
      action: { kind: item.hidden ? "unhide" : "hide", itemId: item.id },
    })
      .then(reportOverride)
      .then(() => {
        closeMenus();
        void refresh();
      });
  });

  if (item.members.length > 1) {
    add(`Split (${item.members.length} sources)`, "more", () => {
      void send({ type: "override", action: { kind: "split", itemId: item.id } })
        .then(reportOverride)
        .then(() => {
          closeMenus();
          void refresh();
        });
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
        add(other.title, "plus", () => {
          void send({
            type: "override",
            action: { kind: "merge", itemId: item.id, otherItemId: other.id },
          })
            .then(reportOverride)
            .then(() => {
              closeMenus();
              void refresh();
            });
        });
      }
    });
  }

  const calendar = googleCalendarUrl(item);
  if (calendar) {
    add("Add to Google Calendar", "tab-month", () => chrome.tabs.create({ url: calendar }));
  }

  const box = anchor.getBoundingClientRect();
  menu.style.top = `${box.bottom + window.scrollY}px`;
  menu.style.right = "10px";
  document.body.append(menu);
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
  const name = document.createElement("span");
  name.className = "setup--brand";
  name.textContent = "Illini Dash";
  healthEl.append(name);
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

  const outstanding = loginsToOpen(rows);
  if (outstanding.length > 0) {
    const all = document.createElement("button");
    all.className = "btn btn-secondary";
    all.textContent =
      outstanding.length === 1 ? "Open the sign-in page" : `Open all ${outstanding.length} sign-in pages`;
    all.title = "Opens a tab for each site you picked that is not signed in yet";
    all.addEventListener("click", () => {
      for (const source of outstanding) {
        const url = LOGIN_URL[source];
        // Not focused: four tabs stealing focus one after another would leave
        // the student on whichever opened last, with no idea where they are.
        if (url) chrome.tabs.create({ url, active: false });
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
  } else if (row.status?.lastSuccessAt !== undefined) {
    state.className = "chip-base chip-state is-ok";
    state.textContent = "Connected";
  } else if (row.status?.state === "needs_login") {
    state.className = "chip-base chip-state is-warn";
    state.textContent = "Sign in needed";
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
  const login = row.enabled && row.status?.state === "needs_login" ? LOGIN_URL[row.source] : undefined;
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
  return [...viewEl.querySelectorAll<HTMLElement>("a.row")];
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

    // Icons only where there is room for both. In the popup the label is the
    // thing that has to survive.
    if (isFullView) tab.append(icon(`tab-${name}` as IconName));
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
    // Remembered first, so the tab that opens is the one just clicked.
    writeStored(VIEW_KEY, name);
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?view=full") });
    return;
  }
  view = name;
  dayOffset = 0;
  writeStored(VIEW_KEY, name);
  void refresh();
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
    chip.title = on ? `Hide ${course}` : `Show ${course} again`;
    const dot = document.createElement("i");
    const label = document.createElement("span");
    label.textContent = course;
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
): { grid: HTMLElement; fit: () => void } {
  const { start, end } = hourRange(contents);
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
      box.append(renderPlaced(placed, now, colours));
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

/** The full view's day, which has the height an hour axis is worth. */
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
    // No grid at all rather than ten empty ruled hours, which say nothing and
    // push what is above them off the screen.
    viewEl.append(
      emptyNote(
        contents.endOfDay.length + contents.untimed.length > 0
          ? "Nothing else at a set time today."
          : "Nothing due this day.",
      ),
    );
    return;
  }

  const { grid, fit } = renderDayGrid(contents, now, colours);
  viewEl.append(grid);
  // Only measurable once it is in the document.
  fit();
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
    const timed = allTimed(day.contents);
    if (timed.length === 0 && day.contents.untimed.length === 0) {
      // A 22px row rather than a full-height one. An empty day is worth a line
      // saying it is empty and nothing more — seven of them at full height is
      // the whole popup.
      row.classList.add("wrow--quiet");
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

    row.append(head, box);
    viewEl.append(row);
  }
}

/* -------------------------------------------------------------------------- */
/* Month                                                                       */
/* -------------------------------------------------------------------------- */

/** How many rows fit a month cell before it has to say "+N more". */
const MONTH_CELL_ROWS = 3;

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
    box.append(num);

    for (const placed of cell.items.slice(0, MONTH_CELL_ROWS)) {
      box.append(renderMonthPill(placed, colours));
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
function renderMonthPill(placed: PlacedItem, colours: Map<string, number>): HTMLElement {
  const { item, anchor } = placed;
  const pill = document.createElement("div");
  pill.className = `mpill course-${colours.get(item.courseLabel) ?? 0}`;
  if (item.kind === "event") pill.classList.add("mpill--event");
  else if (item.kind === "exam") pill.classList.add("mpill--exam");
  if (anchor.opening) pill.classList.add("mpill--opening");
  if (anchor.assumed) pill.classList.add("mpill--untimed");

  const code = document.createElement("span");
  code.className = "mpill--code";
  code.textContent = item.courseLabel;
  const name = document.createElement("span");
  name.className = "mpill--name";
  name.textContent = item.title;
  pill.append(code, name);

  pill.title = anchor.assumed
    ? `${item.title} — ${UNTIMED_NOTE}`
    : `${item.title} — ${anchor.opening ? "opens " : ""}${clockOf(anchor.at)}`;

  const url = safeUrl(item.url);
  if (url) pill.addEventListener("click", () => chrome.tabs.create({ url }));
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
  // An open menu closed over an Item from the previous list. Leaving it up
  // across a re-render lets it act on ids that no longer exist — and the popup
  // fires a sync on open, so that race is the common case, not a corner one.
  closeMenus();
  currentItems = items;
  viewEl.replaceChildren();
  delete viewEl.dataset["shape"];
  // What the full view's width cap keys off. A month may use 1400px; a list of
  // rows stops at 1100 so the clock does not end up a foot from the title. Set
  // from the view rather than from a media query, because Chrome lays the
  // document out to decide the popup's width and a width rule can feed itself.
  document.body.dataset["view"] = view;

  const onGrid = visibleItems(items, settings, hidden, now);
  const colours = courseColours(coursesIn(visibleItems(items, settings, new Set(), now)));

  renderTabs({
    exams: examCount(items, now),
    attention: attentionCount(onGrid, now),
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
    renderAttentionView(onGrid, now, colours);
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
        const url = LOGIN_URL[source];
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

/** The last state drawn, so the header can be repainted without a round trip. */
let lastHealth: { sources: Record<Source, SourceStatus>; lastSyncAt?: string } | undefined;

function paintHealth(): void {
  if (!lastHealth) return;
  renderHealth(lastHealth.sources, lastHealth.lastSyncAt, new Date());
}

renderActions();
void refresh();
// §6: opening the popup triggers a sync, debounced to 5 minutes worker-side.
void send({ type: "sync", trigger: "popup" }).then(refresh).catch(() => undefined);

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
 * Guarded on a menu being open: the row menu closes over an Item, and pulling
 * the list out from under an open menu is how a click lands on the wrong row.
 */
chrome.storage?.onChanged?.addListener((changes, area) => {
  if (area !== "local" || !(STORAGE_KEY in changes)) return;
  if (document.querySelector(".menu")) return;
  void refresh();
});

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
  if (document.querySelector(".menu")) return;
  void refresh();
}, TICK_MS);

// Coming back to a tab that sat hidden for hours is the case the tick above
// cannot cover, because a hidden page is throttled to roughly once a minute at
// best and frozen at worst.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void refresh();
});

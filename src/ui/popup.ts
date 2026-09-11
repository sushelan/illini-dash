/**
 * Popup (§8.1). A list, deliberately plain — §0 decision 6 says ship ugly.
 *
 * Rendering rule from §8.1: every string that came from a source is inserted
 * with `textContent`, never `innerHTML`, and a URL is only made clickable if it
 * parses as https on a host we know. The parsers already enforce the second
 * rule; this is the second line of defence, because this is the layer where
 * getting it wrong is exploitable.
 */

import { BUILD_ID } from "../build-info.js";
import { send } from "../messages.js";
import { normalizePopupState, staleWorkerNotice } from "../core/compat.js";
import { sameCourse } from "../core/dedupe.js";
import { googleCalendarUrl } from "../core/ics.js";
import {
  type AttentionName,
  type DayContents,
  type PlacedItem,
  type ViewName,
  attentionCount,
  attentionGroups,
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
import { formatDue, liveDeadline, movedText, type SectionName } from "../core/grouping.js";
import { displayState, emptyStateFor, staleNotice, statusLine } from "../core/health.js";
import { qualityFlags, unreadableDeadline, unreadableSummary } from "../core/quality.js";
import { ALL_SOURCES, DEFAULT_SETTINGS } from "../core/store.js";
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

const SOURCE_LABEL: Record<Source, string> = {
  canvas: "CV",
  gradescope: "GS",
  prairielearn: "PL",
  prairietest: "PT",
  smartphysics: "SP",
  site: "WEB",
};

/** Full names, for the places where two letters are not enough. */
const SOURCE_NAME: Record<Source, string> = {
  canvas: "Canvas",
  gradescope: "Gradescope",
  prairielearn: "PrairieLearn",
  prairietest: "PrairieTest",
  smartphysics: "smartPhysics",
  site: "the course website",
};

const LOGIN_URL: Partial<Record<Source, string>> = {
  canvas: "https://canvas.illinois.edu/login",
  gradescope: "https://www.gradescope.com/login",
  prairielearn: "https://us.prairielearn.com/pl/",
  prairietest: "https://us.prairietest.com/pt/",
  smartphysics: "https://smart.physics.illinois.edu/",
};

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
const bookingEl = document.getElementById("booking")!;
const dotsEl = document.getElementById("dots")!;
const statusEl = document.getElementById("status")!;
const staleEl = document.getElementById("stale")!;
const blockedEl = document.getElementById("blocked")!;

/** Wording for the state a dot is showing, since the raw enum is for the log. */
const STATE_WORDS: Record<SourceState, string> = {
  ok: "read successfully",
  pending: "not checked yet",
  needs_login: "needs you to sign in",
  parse_error: "the page was not what we expected",
  network_error: "could not be reached",
  disabled: "switched off",
};

function renderDots(sources: Record<Source, SourceStatus>, lastSyncAt?: string): void {
  dotsEl.replaceChildren();
  for (const source of ALL_SOURCES) {
    const status = sources[source];
    if (!status) continue;
    // Not `status.state`: a source that has never been attempted has no result
    // to show, and rendering the seeded value painted a fresh install green.
    const state = displayState(status);
    const dot = document.createElement("span");
    dot.className = `dot dot-${state}`;
    const when = status.lastSuccessAt
      ? `last read ${new Date(status.lastSuccessAt).toLocaleString()}`
      : "never read successfully";
    dot.title = `${SOURCE_LABEL[source]} — ${STATE_WORDS[state]}\n${when}${
      status.lastError ? `\n${status.lastError}` : ""
    }`;
    if (state === "needs_login" && LOGIN_URL[source]) {
      dot.addEventListener("click", () => chrome.tabs.create({ url: LOGIN_URL[source]! }));
    }
    dotsEl.append(dot);
  }
  // §8.1's line, from core so the "n of m" rule is testable: `lastSyncAt` is set
  // whether or not any source succeeded, so "Synced 10:32" was equally cheerful
  // after four failures.
  statusEl.textContent = `${statusLine(sources, lastSyncAt, new Date())} · build ${BUILD_ID}`;
}

/**
 * §11's catastrophic case, made visible: a source that failed keeps its old
 * rows, so the list still looks complete while it silently stops updating.
 */
function renderStaleBanner(sources: Record<Source, SourceStatus>): void {
  staleEl.replaceChildren();
  const notice = staleNotice(sources, new Date());
  if (!notice) {
    staleEl.hidden = true;
    return;
  }
  staleEl.hidden = false;

  const age =
    notice.hours === undefined
      ? "has never been read successfully"
      : `hasn't been read successfully for ${notice.hours}h`;
  const text = document.createElement("span");
  text.textContent = `${SOURCE_LABEL[notice.source]} ${age}. Anything it lists may be out of date.`;
  staleEl.append(text);

  const login = LOGIN_URL[notice.source];
  if (notice.needsLogin && login) {
    const button = document.createElement("button");
    button.className = "link";
    button.textContent = "Sign in";
    button.addEventListener("click", () => chrome.tabs.create({ url: login }));
    staleEl.append(button);
  }
}

/**
 * Chrome's notification switch, which one click in any toast can flip.
 *
 * Worth a banner rather than a line in Settings: while it is off every reminder
 * is silently dropped, and a student who never opens Settings would only find
 * out by missing something.
 */
function renderBlockedBanner(blocked: boolean): void {
  blockedEl.replaceChildren();
  blockedEl.hidden = !blocked;
  if (!blocked) return;
  blockedEl.textContent =
    "Chrome is blocking reminders from Illini Dash, so nothing will notify you. " +
    "Turn them back on in Chrome's notification settings.";
}

function renderRow(
  item: Item,
  now: Date,
  section: SectionName | undefined,
  dueText?: { primary: string; detail?: string },
  colours?: Map<string, number>,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "row";
  // The course colour is on the row, not only in the legend: a chip strip you
  // have to look up is a lookup table, and the point of colour is to answer
  // "whose is this" without reading.
  if (colours?.has(item.courseLabel)) {
    row.classList.add(`course-${colours.get(item.courseLabel)!}`);
  }
  if (item.kind === "booking") {
    row.classList.add("row-booking");
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
  sources.textContent = distinct.map((source) => SOURCE_LABEL[source]).join(" ");
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
  const moved = movedText(item);
  if (moved) details.push({ text: moved, className: "row--detail row--detail-moved" });

  const menu = document.createElement("button");
  menu.className = "row--menu";
  menu.textContent = "⋯";
  menu.title = "More";
  menu.addEventListener("click", (event) => {
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

  const url = safeUrl(item.url);
  if (url) row.addEventListener("click", () => chrome.tabs.create({ url }));
  else row.style.cursor = "default";
  return row;
}

/** All items currently rendered, so "Merge with…" can offer same-course rows. */
let currentItems: Item[] = [];

/** A correction that silently did nothing is worse than one that says so. */
function reportOverride(response: Awaited<ReturnType<typeof send>>): void {
  if (response.type === "error") statusEl.textContent = response.message;
}

function closeMenus(): void {
  for (const open of document.querySelectorAll(".menu")) open.remove();
}
document.addEventListener("click", closeMenus);

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
  menu.className = "menu";
  menu.addEventListener("click", (event) => event.stopPropagation());

  const add = (label: string, onClick: () => void) => {
    const entry = document.createElement("button");
    entry.className = "menu--item";
    entry.textContent = label;
    entry.addEventListener("click", onClick);
    menu.append(entry);
  };

  // First, because it is the one a student reaches for most: two of the five
  // sources can never report completion, so without it a finished course-site
  // row sits in Needs attention for a week with only Hide as an escape.
  add(item.done ? "Not done" : "Mark done", () => {
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

  add(item.hidden ? "Unhide" : "Hide", () => {
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
    add(`Split (${item.members.length} sources)`, () => {
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
    add("Merge with…", () => {
      menu.replaceChildren();
      const heading = document.createElement("div");
      heading.className = "menu--heading";
      heading.textContent = `Merge "${item.title}" with:`;
      menu.append(heading);
      for (const other of candidates.slice(0, 12)) {
        add(other.title, () => {
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
  if (calendar) add("Add to Google Calendar", () => chrome.tabs.create({ url: calendar }));

  const box = anchor.getBoundingClientRect();
  menu.style.top = `${box.bottom + window.scrollY}px`;
  menu.style.right = "10px";
  document.body.append(menu);
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

const VIEWS: ViewName[] = ["day", "week", "month", "attention"];
const VIEW_LABEL: Record<ViewName, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
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

function renderTabs(attention: number): void {
  tabsEl.replaceChildren();
  for (const name of VIEWS) {
    const tab = document.createElement("button");
    tab.className = "tab";
    if (name === "attention" && attention > 0) tab.classList.add("tab-err");
    tab.setAttribute("aria-selected", String(name === view));
    tab.textContent = VIEW_LABEL[name];
    if (name === "attention" && attention > 0) {
      const count = document.createElement("span");
      count.className = "tab--count";
      count.textContent = String(attention);
      tab.append(" ", count);
    }
    if (!isFullView && FULL_VIEW_ONLY.has(name)) {
      tab.title = "Opens the full view — a month needs more width than a popup has";
    }
    tab.addEventListener("click", () => {
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
    });
    tabsEl.append(tab);
  }
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

/** §4.4's booking, pinned above the tabs because the window closes regardless. */
function renderBookingStrip(items: Item[]): void {
  bookingEl.replaceChildren();
  for (const item of bookings(items)) {
    const strip = document.createElement("div");
    strip.className = "book";
    const text = document.createElement("span");
    text.className = "book--text";
    const title = document.createElement("b");
    title.textContent = item.title.replace(/^Book a slot:\s*/i, "");
    const when = document.createElement("span");
    const window_ = bookingWindowText(item);
    when.textContent = window_.detail ? `${window_.detail} · not booked` : "not booked";
    text.append(title, when);

    const go = document.createElement("button");
    go.className = "book--go";
    go.textContent = "Book";
    const url = safeUrl(item.url);
    if (url) go.addEventListener("click", () => chrome.tabs.create({ url }));
    else go.disabled = true;

    strip.append(text, go);
    bookingEl.append(strip);
  }
}

function anchorDate(now: Date): Date {
  return startOfDay(now, dayOffset);
}

function renderDateNav(label: string, step: number): void {
  dateNavEl.replaceChildren();
  dateNavEl.hidden = step === 0;
  if (step === 0) return;

  const back = document.createElement("button");
  back.className = "datenav--arrow";
  back.textContent = "‹";
  back.title = "Back";
  back.addEventListener("click", () => {
    dayOffset -= step;
    void refresh();
  });

  const text = document.createElement("span");
  text.className = "datenav--label";
  text.textContent = label;

  const forward = document.createElement("button");
  forward.className = "datenav--arrow";
  forward.textContent = "›";
  forward.title = "Forward";
  forward.addEventListener("click", () => {
    dayOffset += step;
    void refresh();
  });

  dateNavEl.append(back, text, forward);

  if (dayOffset !== 0) {
    const today = document.createElement("button");
    today.className = "datenav--today";
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

function renderDayGrid(contents: DayContents, now: Date, colours: Map<string, number>): HTMLElement {
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

  // Where "now" is, but only on the day that actually is now: on any other day
  // the line would be a red mark at an hour that means nothing.
  if (dayOffset === 0) {
    const line = document.createElement("div");
    line.className = "grid--now";
    line.style.top = `${(minutesInto(now) / 60 - start) * HOUR_PX}px`;
    slots.append(line);
  }

  grid.append(hours, slots);
  return grid;
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

function renderDayView(items: Item[], now: Date, colours: Map<string, number>): void {
  const day = anchorDate(now);
  const contents = dayContents(items, day, now);
  const band = renderUntimedBand(contents.untimed, now, colours);
  if (band) viewEl.append(band);
  viewEl.append(renderDayGrid(contents, now, colours));
}

/* -------------------------------------------------------------------------- */
/* Week                                                                        */
/* -------------------------------------------------------------------------- */

function renderWeekView(items: Item[], now: Date, colours: Map<string, number>): void {
  for (const day of weekContents(items, anchorDate(now), now)) {
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
    const timed = day.contents.timed.flat();
    if (timed.length === 0 && day.contents.untimed.length === 0) {
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
/* Attention                                                                   */
/* -------------------------------------------------------------------------- */

const ATTENTION_NOTE: Record<AttentionName, string> = {
  Overdue: "Past its deadline in the last week.",
  "Couldn't read":
    "The source printed a date this extension could not make sense of, so these have no place on the calendar. They are the deadlines it is least sure about.",
  "No date at all": "Listed by a source with no deadline anywhere on it.",
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
      const days = weekContents([], anchor, now);
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

  const onGrid = visibleItems(items, settings, hidden);
  const colours = courseColours(coursesIn(visibleItems(items, settings)));

  renderBookingStrip(items);
  renderTabs(attentionCount(onGrid, now));
  renderFilters(visibleItems(items, settings), colours);

  const nav = navFor(view, now);
  renderDateNav(nav.label, nav.step);

  if (view === "attention") {
    renderAttentionView(onGrid, now, colours);
    return;
  }

  // "Nothing due in the next 60 days." is only true when every source was read
  // and every source was empty. Said over an expired session it reads as "you
  // are free" and means "I could not look" (§11).
  if (onGrid.length === 0) {
    const state = emptyStateFor(sources, items.length > 0);
    const empty = document.createElement("p");
    empty.className = "muted empty";
    empty.textContent = hidden.size > 0 ? "Every course is switched off above." : state.text;
    viewEl.append(empty);
    if (hidden.size === 0) {
      for (const source of state.logins) {
        const url = LOGIN_URL[source];
        if (!url) continue;
        const button = document.createElement("button");
        button.className = "link";
        button.textContent = `Sign in to ${SOURCE_LABEL[source]}`;
        button.addEventListener("click", () => chrome.tabs.create({ url }));
        const line = document.createElement("p");
        line.className = "empty";
        line.append(button);
        viewEl.append(line);
      }
    }
    return;
  }

  if (view === "day") renderDayView(onGrid, now, colours);
  else if (view === "week") renderWeekView(onGrid, now, colours);
  else renderMonthView(onGrid, now, colours);
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
    statusEl.textContent =
      `Could not draw the list: ${err instanceof Error ? err.message : String(err)}. ` +
      `Reload the extension at chrome://extensions.`;
  }
}

async function draw(): Promise<void> {
  const response = await send({ type: "get-state" });
  if (response.type !== "state") {
    statusEl.textContent = response.type === "error" ? response.message : "Unexpected response.";
    return;
  }
  // A worker on an older build does not send every field read below, and
  // TypeScript cannot know that (see core/compat.ts).
  const { state, missing } = normalizePopupState<typeof response>(response);
  renderDots(state.sources, state.lastSyncAt);
  renderBlockedBanner(state.notificationsBlocked);
  renderStaleBanner(state.sources);
  render(state.items, state.settings ?? DEFAULT_SETTINGS, state.sources, new Date());
  if (missing.length > 0) {
    statusEl.textContent = staleWorkerNotice(missing);
  }
}

document.getElementById("sync")!.addEventListener("click", async () => {
  statusEl.textContent = "Syncing…";
  await send({ type: "sync", trigger: "manual" });
  await refresh();
});
document.getElementById("full")!.addEventListener("click", (event) => {
  event.preventDefault();
  // §8.1: popups close on focus loss, which is maddening while cross-checking
  // against a course page. The marker is what lets the stylesheet tell a tab
  // from a popup — Chrome tells the page nothing, and inferring it from the
  // window width would feed back into how Chrome sizes the popup.
  chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?view=full") });
});
if (document.documentElement.classList.contains("view-full")) {
  // Already there. Offering it again just opens a duplicate tab.
  document.getElementById("full")!.remove();
}
document.getElementById("settings")!.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

void refresh();
// §6: opening the popup triggers a sync, debounced to 5 minutes worker-side.
void send({ type: "sync", trigger: "popup" }).then(refresh).catch(() => undefined);

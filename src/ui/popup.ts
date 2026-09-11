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
import { sameCourse } from "../core/dedupe.js";
import { googleCalendarUrl } from "../core/ics.js";
import {
  formatDue,
  groupItems,
  liveDeadline,
  movedText,
  type SectionName,
} from "../core/grouping.js";
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

const listEl = document.getElementById("list")!;
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
  section: SectionName,
  dueText?: { primary: string; detail?: string },
): HTMLElement {
  const row = document.createElement("div");
  row.className = "row";
  if (item.kind === "booking") {
    row.classList.add("row-booking");
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
  const labels = [...new Set(item.members.map((m) => SOURCE_LABEL[m.source]))];
  if (labels.length > 1) sources.textContent = labels.join(" ");
  // Still reachable for a single source, just not spending a column on it.
  else if (labels[0]) sources.title = labels[0];

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
    due.textContent = dueText.primary;
    if (dueText.detail) details.push({ text: dueText.detail, className: "row--detail" });
  } else {
    const formatted = formatDue(item, now, section);
    due.textContent = formatted.primary;
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
  listEl.replaceChildren();
  const sections = groupItems(items, now, settings);

  if (sections.length === 0) {
    // "Nothing due in the next 60 days." is only true when every source was
    // read and every source was empty. Said over an expired session it reads as
    // "you are free" and means "I could not look" (§11).
    const state = emptyStateFor(sources, items.length > 0);
    const empty = document.createElement("p");
    empty.className = "muted empty";
    empty.textContent = state.text;
    listEl.append(empty);
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
      listEl.append(line);
    }
    return;
  }

  for (const section of sections) {
    const heading = document.createElement("h2");
    heading.className = "section";
    heading.textContent = `${section.name} (${section.items.length})`;
    listEl.append(heading);
    for (const item of section.items) {
      const dueText = item.kind === "booking" ? bookingWindowText(item) : undefined;
      listEl.append(renderRow(item, now, section.name, dueText));
    }
  }
}

async function refresh(): Promise<void> {
  const response = await send({ type: "get-state" });
  if (response.type !== "state") {
    statusEl.textContent = response.type === "error" ? response.message : "Unexpected response.";
    return;
  }
  renderDots(response.sources, response.lastSyncAt);
  renderBlockedBanner(response.notificationsBlocked);
  renderStaleBanner(response.sources);
  render(response.items, response.settings ?? DEFAULT_SETTINGS, response.sources, new Date());
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

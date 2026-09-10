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
import { formatDue, groupItems } from "./grouping.js";
import { ALL_SOURCES, DEFAULT_SETTINGS } from "../core/store.js";
import type { Item, Settings, Source, SourceStatus } from "../sources/types.js";

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
  site: "WEB",
};

const LOGIN_URL: Partial<Record<Source, string>> = {
  canvas: "https://canvas.illinois.edu/login",
  gradescope: "https://www.gradescope.com/login",
  prairielearn: "https://us.prairielearn.com/pl/",
  prairietest: "https://us.prairietest.com/pt/",
};

const listEl = document.getElementById("list")!;
const dotsEl = document.getElementById("dots")!;
const statusEl = document.getElementById("status")!;

function renderDots(sources: Record<Source, SourceStatus>, lastSyncAt?: string): void {
  dotsEl.replaceChildren();
  for (const source of ALL_SOURCES) {
    const status = sources[source];
    if (!status) continue;
    const dot = document.createElement("span");
    dot.className = `dot dot-${status.enabled ? status.state : "disabled"}`;
    const when = status.lastSuccessAt
      ? `last ok ${new Date(status.lastSuccessAt).toLocaleString()}`
      : "never synced";
    dot.title = `${SOURCE_LABEL[source]} — ${status.enabled ? status.state : "disabled"}\n${when}${
      status.lastError ? `\n${status.lastError}` : ""
    }`;
    if (status.state === "needs_login" && LOGIN_URL[source]) {
      dot.addEventListener("click", () => chrome.tabs.create({ url: LOGIN_URL[source]! }));
    }
    dotsEl.append(dot);
  }
  statusEl.textContent = lastSyncAt
    ? `Synced ${new Date(lastSyncAt).toLocaleTimeString()} · build ${BUILD_ID}`
    : "Not synced yet.";
}

function renderRow(item: Item, now: Date, dueText?: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "row";
  if (item.kind === "booking") row.classList.add("row-booking");
  else if (item.dueAt && Date.parse(item.dueAt) < now.getTime()) row.classList.add("row-overdue");

  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = item.courseLabel || "—";

  const title = document.createElement("span");
  title.className = "row--title";
  title.textContent = item.title;
  title.title = item.title;

  const sources = document.createElement("span");
  sources.className = "row--sources";
  // §5.3: a merged row shows both icons, so a false merge is visible and the
  // user knows there is something to split.
  sources.textContent = [...new Set(item.members.map((m) => SOURCE_LABEL[m.source]))].join(" ");

  const due = document.createElement("span");
  due.className = "row--due";
  due.textContent = dueText ?? formatDue(item, now);

  row.append(chip, title, sources, due);

  const url = safeUrl(item.url);
  if (url) row.addEventListener("click", () => chrome.tabs.create({ url }));
  else row.style.cursor = "default";
  return row;
}

/**
 * §4.4: a booking row must read "sessions Sep 21–23, not booked", never
 * "due Sep 21" — the date is deliberately early because slots fill, and
 * presenting it as a deadline would be a lie.
 */
function bookingWindowText(item: Item): string | undefined {
  const start = item.members.find((m) => m.extra?.["windowStart"])?.extra?.["windowStart"];
  const end = item.members.find((m) => m.extra?.["windowEnd"])?.extra?.["windowEnd"];
  if (!start || !end) return undefined;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `sessions ${fmt(start)}–${fmt(end)}, not booked`;
}

function render(items: Item[], settings: Settings, now: Date): void {
  listEl.replaceChildren();
  const sections = groupItems(items, now, settings);

  if (sections.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted empty";
    empty.textContent = "Nothing due in the next 60 days.";
    listEl.append(empty);
    return;
  }

  for (const section of sections) {
    const heading = document.createElement("h2");
    heading.className = "section";
    heading.textContent = `${section.name} (${section.items.length})`;
    listEl.append(heading);
    for (const item of section.items) {
      const dueText = item.kind === "booking" ? bookingWindowText(item) : undefined;
      listEl.append(renderRow(item, now, dueText));
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
  render(response.items, response.settings ?? DEFAULT_SETTINGS, new Date());
}

document.getElementById("sync")!.addEventListener("click", async () => {
  statusEl.textContent = "Syncing…";
  await send({ type: "sync", trigger: "manual" });
  await refresh();
});
document.getElementById("full")!.addEventListener("click", (event) => {
  event.preventDefault();
  // §8.1: popups close on focus loss, which is maddening while cross-checking
  // against a course page.
  chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
});
document.getElementById("settings")!.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

void refresh();
// §6: opening the popup triggers a sync, debounced to 5 minutes worker-side.
void send({ type: "sync", trigger: "popup" }).then(refresh).catch(() => undefined);

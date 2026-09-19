/**
 * Options page. Build step 2 only carries the Gate 0 spike (§10 step 2);
 * the real options UI is step 10.
 *
 * All source-derived text is inserted with textContent (§8.1).
 */

import { BUILD_ID } from "../build-info.js";
import { applyStoredTheme, renderThemePanel } from "./theme-panel.js";
import {
  adapterFromCandidate,
  candidatesFoundLine,
  SITE_TIMEZONE,
  type Candidate,
} from "../core/detect.js";
import {
  attemptLogLine,
  authorAdapter,
  buildPrompt,
  modelOutcomeFor,
  modelStatusLine,
  pageForAuthoring,
  saveProposedAdapter,
  RETRY_SUFFIX_CHARS,
  skeletonBudgetChars,
  type ModelOutcome,
} from "../core/author.js";
import { repeatedStructures, skeletonise } from "../core/skeleton.js";
import { currentTermCode } from "../core/registry.js";
import { normalizeOptionsState, staleWorkerNotice } from "../core/compat.js";
import {
  CAMPUSWIRE_MATCH,
  describeObserver,
  type ObserverFacts,
} from "../core/campuswire.js";
import {
  describePiazza,
  piazzaChipState,
  PIAZZA_LOGIN_URL,
  PIAZZA_MATCH,
  type PiazzaFacts,
} from "../core/piazza.js";
import { coursesUrl } from "../sources/canvas.js";
import { downloadFile, downloadIcs } from "./download.js";
import { MAX_POLL_MINUTES, MIN_POLL_MINUTES, STORAGE_KEY } from "../core/store.js";
import {
  isGrantedUpFront,
  originPattern,
  reportUrlFromHash,
  type CaptureResult,
} from "../capture.js";
import { actionFor, displayState, healthPill, sourceRows, sourcesToRecheck } from "../core/health.js";
import { describeGcal, type GcalFacts } from "../core/gcal-auth.js";
import { GCAL_MATCH } from "../core/gcal-config.js";
import {
  courseLabel,
  displayCourseLabel,
  SOURCE_HINT,
  SOURCE_TITLE,
  STATE_WORD,
  fullStamp,
  timeAgo,
} from "../core/names.js";
import { icon } from "./icons.js";
import { probeMarkers } from "../core/markers.js";
import { scrubHtml } from "../core/scrub.js";
import type { Gate0Result } from "../gate0.js";
import { send, type Response } from "../messages.js";

const runButton = document.getElementById("run-gate0") as HTMLButtonElement;
const copyButton = document.getElementById("copy-gate0") as HTMLButtonElement;
const statusEl = document.getElementById("gate0-status")!;
const resultsEl = document.getElementById("gate0-results")!;

let lastResults: Gate0Result[] = [];

/* Before the first paint. See src/ui/theme-panel.ts. */
applyStoredTheme();

/* ---- Build identity -------------------------------------------------------
 * Chrome reloads this page from disk but keeps the old service worker until the
 * extension is reloaded, so page and worker can disagree. Say so out loud.
 */
const buildInfo = document.getElementById("build-info")!;

/**
 * Where the build ids go when nothing is wrong.
 *
 * They are evidence for exactly one question — is the worker running the same
 * code as this page — and "Service worker alive, build 20260912T041431" was the
 * first line of Settings, above anything a student came here to change.
 */
const devBuild = document.getElementById("dev-build");

void (async () => {
  const mine = `This page: build ${BUILD_ID}.`;
  try {
    const resp = await send({ type: "ping" });
    if (resp.type !== "pong") {
      setWarning(
        "build",
        "The background part of Illini Dash answered something unexpected. Open " +
          "chrome://extensions and click Reload on the Illini Dash card.",
      );
      if (devBuild) devBuild.textContent = `${mine} Worker answered: ${JSON.stringify(resp)}`;
      return;
    }
    // Both branches written out, because "already fine" and "never ran" were
    // indistinguishable here (worker rule 5).
    if (devBuild) devBuild.textContent = `${mine} Service worker: build ${resp.buildId}.`;
    if (resp.buildId === BUILD_ID) {
      setWarning("build", undefined);
      return;
    }
    // The build ids stay in the sentence: this is the one warning they are the
    // evidence for. Everything before them says what happened and what to do.
    setWarning(
      "build",
      "Illini Dash was updated, but the background part is still running the old " +
        "version, so this page may be wrong. Open chrome://extensions and click " +
        `Reload on the Illini Dash card. (This page is build ${BUILD_ID}; the ` +
        `background part is build ${resp.buildId}.)`,
    );
  } catch (err) {
    setWarning(
      "build",
      "The background part of Illini Dash is not answering, so nothing on this " +
        "page can be changed. Open chrome://extensions and click Reload on the " +
        "Illini Dash card.",
    );
    if (devBuild) {
      devBuild.textContent = `${mine} Worker unreachable: ${
        err instanceof Error ? err.message : String(err)
      }`;
    }
  }
})();

/**
 * One warning slot, two possible warnings.
 *
 * Both are about the same thing — the page and the worker are different builds
 * — but they are found at different moments: the ping answers asynchronously,
 * and the missing fields only show up once a message arrives. Two children of
 * one container rather than two loose elements, so neither can race the other
 * into invisibility and neither can escape the page's own margins.
 */
function setWarning(key: "build" | "fields" | "draw", text: string | undefined): void {
  let line = buildInfo.querySelector<HTMLElement>(`[data-warning="${key}"]`);
  if (!text) {
    line?.remove();
    buildInfo.hidden = buildInfo.childElementCount === 0;
    return;
  }
  if (!line) {
    line = document.createElement("p");
    line.dataset["warning"] = key;
    buildInfo.append(line);
  }
  line.textContent = text;
  buildInfo.hidden = false;
}

function showMissingFields(missing: readonly string[]): void {
  setWarning("fields", missing.length === 0 ? undefined : staleWorkerNotice(missing));
}

function row(dl: HTMLElement, label: string, value: string): void {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  dl.append(dt, dd);
}

function render(results: Gate0Result[]): void {
  resultsEl.replaceChildren();
  for (const r of results) {
    const box = document.createElement("div");
    box.className = "result";

    const heading = document.createElement("h3");
    heading.textContent = r.label;
    const verdict = document.createElement("span");
    verdict.className = `verdict-${r.verdict}`;
    verdict.textContent = ` — ${r.verdict.replace("_", " ")}`;
    heading.append(verdict);
    box.append(heading);

    const dl = document.createElement("dl");
    row(dl, "request", r.requestUrl);
    if (r.status !== undefined) row(dl, "status", `${r.status} ${r.statusText ?? ""}`.trim());
    if (r.finalUrl) row(dl, "final URL", r.finalUrl);
    if (r.redirected !== undefined) row(dl, "redirected", String(r.redirected));
    if (r.contentType) row(dl, "content-type", r.contentType);
    if (r.bodyLength !== undefined) row(dl, "body length", String(r.bodyLength));
    row(dl, "took", `${r.durationMs} ms`);
    if (r.note) row(dl, "note", r.note);
    if (r.error) row(dl, "error", r.error);
    box.append(dl);

    if (r.bodyPreview !== undefined) {
      const pre = document.createElement("pre");
      pre.textContent = r.bodyPreview || "(empty body)";
      box.append(pre);
    }

    resultsEl.append(box);
  }
}

runButton.addEventListener("click", async () => {
  runButton.disabled = true;
  copyButton.disabled = true;
  statusEl.textContent = "Running…";
  resultsEl.replaceChildren();
  try {
    const resp = await send({ type: "gate0" });
    if (resp.type !== "gate0") {
      statusEl.textContent =
        resp.type === "error" ? `Worker error: ${resp.message}` : "Unexpected response.";
      return;
    }
    lastResults = resp.results;
    render(lastResults);
    const passed = lastResults.filter((r) => r.verdict === "logged_in").length;
    statusEl.textContent = `${passed} of ${lastResults.length} sources returned logged-in content.`;
    copyButton.disabled = false;
  } catch (err) {
    statusEl.textContent = `Could not reach the service worker: ${
      err instanceof Error ? err.message : String(err)
    }`;
  } finally {
    runButton.disabled = false;
  }
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(JSON.stringify(lastResults, null, 2));
  statusEl.textContent = "Results copied to clipboard.";
});

/* ---- Offscreen round-trip (build step 3) ---------------------------------- */

const selftestButton = document.getElementById("run-selftest") as HTMLButtonElement;
const selftestStatus = document.getElementById("selftest-status")!;
const selftestResults = document.getElementById("selftest-results")!;

selftestButton.addEventListener("click", async () => {
  selftestButton.disabled = true;
  selftestStatus.textContent = "Running\u2026";
  selftestResults.replaceChildren();
  try {
    const resp = await send({ type: "parse-selftest" });
    if (resp.type !== "parse-selftest") {
      selftestStatus.textContent =
        resp.type === "error" ? `Worker error: ${resp.message}` : "Unexpected response.";
      return;
    }
    for (const c of resp.cases) {
      const box = document.createElement("div");
      box.className = "result";
      const heading = document.createElement("h3");
      heading.textContent = c.name;
      const verdict = document.createElement("span");
      verdict.className = c.passed ? "verdict-logged_in" : "verdict-error";
      verdict.textContent = c.passed ? " \u2014 pass" : " \u2014 FAIL";
      heading.append(verdict);
      const dl = document.createElement("dl");
      row(dl, "expected", c.expectation);
      row(dl, "got", c.detail);
      box.append(heading, dl);
      selftestResults.append(box);
    }
    const passed = resp.cases.filter((c) => c.passed).length;
    selftestStatus.textContent = `${passed} of ${resp.cases.length} checks passed.`;
  } catch (err) {
    selftestStatus.textContent = `Could not reach the service worker: ${
      err instanceof Error ? err.message : String(err)
    }`;
  } finally {
    selftestButton.disabled = false;
  }
});

/* ---- Fixture capture (build step 4) --------------------------------------- */

const captureUrl = document.getElementById("capture-url") as HTMLInputElement;
const captureButton = document.getElementById("run-capture") as HTMLButtonElement;
const captureStatus = document.getElementById("capture-status")!;
const captureResult = document.getElementById("capture-result")!;
const presets = document.getElementById("capture-presets")!;
const netidInput = document.getElementById("scrub-netid") as HTMLInputElement;
const nameInput = document.getElementById("scrub-name") as HTMLInputElement;

/** Canvas's planner window is relative to now (§4.1). */
function plannerUrl(): string {
  const day = 86_400_000;
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  const now = Date.now();
  return (
    `https://canvas.illinois.edu/api/v1/planner/items` +
    `?start_date=${iso(now - 7 * day)}&end_date=${iso(now + 60 * day)}&per_page=100`
  );
}

/**
 * The G1 list (§9). Entries needing an id you have to fill in are marked; the
 * button just seeds the box so you can edit it.
 */
const PRESETS: { label: string; url: string; note?: string }[] = [
  { label: "Gradescope dashboard", url: "https://www.gradescope.com/" },
  {
    label: "Gradescope course",
    url: "https://www.gradescope.com/courses/",
    note: "append a course id",
  },
  { label: "PrairieLearn home", url: "https://us.prairielearn.com/pl/" },
  {
    label: "PrairieLearn assessments",
    url: "https://us.prairielearn.com/pl/course_instance//assessments",
    note: "insert a course_instance id",
  },
  { label: "PrairieTest home", url: "https://us.prairietest.com/pt/" },
  {
    label: "Canvas courses",
    url: coursesUrl(),
  },
  { label: "Canvas planner", url: plannerUrl() },
  {
    label: "Canvas course assignments",
    url: "https://canvas.illinois.edu/api/v1/courses//assignments?per_page=100",
    note: "insert a course id",
  },
];

for (const preset of PRESETS) {
  const button = document.createElement("button");
  button.className = "btn btn-quiet btn-sm";
  button.textContent = preset.note ? `${preset.label} (${preset.note})` : preset.label;
  button.addEventListener("click", () => {
    captureUrl.value = preset.url;
    captureUrl.focus();
  });
  presets.append(button);
}

/** fixtures/gradescope/courses-1352838.html and friends. */
function suggestFilename(url: string, contentType: string | undefined): string {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./, "").split(".")[0] ?? "capture";
  const path =
    parsed.pathname.replace(/^\/|\/$/g, "").replace(/[^a-zA-Z0-9]+/g, "-") || "index";
  const ext = contentType?.includes("json") ? "json" : "html";
  return `${host}-${path}.${ext}`;
}

function renderCapture(result: CaptureResult): void {
  captureResult.replaceChildren();

  const box = document.createElement("div");
  box.className = "result";

  const heading = document.createElement("h3");
  heading.textContent = result.finalUrl;
  const verdict = document.createElement("span");
  verdict.className = result.needsLogin
    ? "verdict-needs_login"
    : result.status === 200
      ? "verdict-logged_in"
      : "verdict-error";
  verdict.textContent = result.needsLogin
    ? " — landed on a login page"
    : ` — ${result.status}`;
  heading.append(verdict);
  box.append(heading);

  const dl = document.createElement("dl");
  row(dl, "status", `${result.status} ${result.statusText}`.trim());
  if (result.contentType) row(dl, "content-type", result.contentType);
  row(dl, "redirected", String(result.redirected));
  row(dl, "bytes", String(result.bytes));
  row(dl, "took", `${result.durationMs} ms`);
  box.append(dl);

  // Scrub before anything is shown or offered for download.
  const { html: scrubbed, report } = scrubHtml(result.body, {
    netid: netidInput.value.trim() || undefined,
    name: nameInput.value.trim() || undefined,
  });

  const scrubHeading = document.createElement("h3");
  scrubHeading.textContent = "Scrub report (Appendix A)";
  box.append(scrubHeading);

  const scrubList = document.createElement("dl");
  const entries = Object.entries(report.counts);
  if (entries.length === 0) {
    row(scrubList, "replacements", "none — nothing identifying was recognized");
  } else {
    for (const [label, count] of entries) row(scrubList, label, `${count} replaced`);
  }
  for (const warning of report.warnings) {
    const dt = document.createElement("dt");
    dt.textContent = warning.severity === "blocker" ? "MUST FIX" : "note";
    const dd = document.createElement("dd");
    if (warning.severity === "blocker") dd.className = "verdict-error";
    dd.textContent = warning.message;
    scrubList.append(dt, dd);
  }

  const blockers = report.warnings.filter((w) => w.severity === "blocker");
  box.append(scrubList);

  // §12 open questions are answered by what is or is not in this body.
  const probes = probeMarkers(result.finalUrl, result.body);
  for (const probe of probes) {
    const probeHeading = document.createElement("h3");
    probeHeading.textContent = `Markers — ${probe.group}`;
    box.append(probeHeading);
    const probeList = document.createElement("dl");
    for (const hit of probe.hits) {
      const dt = document.createElement("dt");
      dt.textContent = hit.needle;
      const dd = document.createElement("dd");
      dd.className = hit.count > 0 ? "verdict-logged_in" : "verdict-error";
      dd.textContent = `${hit.count > 0 ? `found ×${hit.count}` : "NOT FOUND"} — ${hit.why}`;
      probeList.append(dt, dd);
    }
    box.append(probeList);
  }

  const preview = document.createElement("pre");
  preview.textContent = scrubbed.slice(0, 1500);
  box.append(preview);

  const filename = suggestFilename(result.finalUrl, result.contentType);
  const mime = result.contentType?.includes("json") ? "application/json" : "text/html";

  const saveScrubbed = document.createElement("button");
  saveScrubbed.textContent = blockers.length
    ? `Download anyway (${blockers.length} unresolved — do not commit)`
    : `Download scrubbed (${filename})`;
  saveScrubbed.addEventListener("click", () => downloadFile(filename, scrubbed, mime));

  const saveRaw = document.createElement("button");
  saveRaw.textContent = "Download raw (do not commit)";
  saveRaw.style.marginLeft = "8px";
  saveRaw.addEventListener("click", () =>
    downloadFile(`RAW-DO-NOT-COMMIT-${filename}`, result.body, mime),
  );

  const buttons = document.createElement("p");
  buttons.append(saveScrubbed, saveRaw);
  box.append(buttons);

  captureResult.append(box);
}

captureButton.addEventListener("click", async () => {
  const url = captureUrl.value.trim();
  if (!url) {
    captureStatus.textContent = "Enter a URL first.";
    return;
  }
  if (!(await ensureHostPermission(url))) {
    captureStatus.textContent =
      `Chrome did not grant access to ${url}. That host is an optional ` +
      `permission, so it cannot be fetched until you allow it.`;
    return;
  }
  captureButton.disabled = true;
  captureStatus.textContent = "Fetching…";
  captureResult.replaceChildren();
  try {
    const resp = await send({ type: "capture", url });
    if (resp.type === "error") {
      captureStatus.textContent = resp.message;
      return;
    }
    if (resp.type !== "capture") {
      captureStatus.textContent = "Unexpected response.";
      return;
    }
    renderCapture(resp.result);
    captureStatus.textContent = resp.result.needsLogin
      ? "That fetch landed on a login page — log in to the site and retry."
      : `Fetched ${resp.result.bytes} bytes.`;
  } catch (err) {
    captureStatus.textContent = err instanceof Error ? err.message : String(err);
  } finally {
    captureButton.disabled = false;
  }
});


/* ---- §8.2 options ---------------------------------------------------------
 * All source-derived text goes in with textContent (§8.1's rendering rule);
 * this page displays course names the extension did not author.
 */

const PRIVACY_TEXT =
  "Illini Dash runs entirely in your browser. It reads assignment and exam information " +
  "from Canvas, Gradescope, PrairieLearn, PrairieTest, and course websites you " +
  "explicitly enable, using the login sessions already in your browser. It never sees " +
  "or stores your password. All data is stored locally in your browser's extension " +
  "storage and is never transmitted to the developer or any third party. The extension " +
  "makes one network request to GitHub once a day to update its list of supported " +
  "course websites; that request contains no personal data. Uninstalling the extension " +
  "deletes all stored data.";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

/**
 * One settings row: a switch, a name, a line saying what it is, and a state.
 *
 * A real `<input type="checkbox">` under the switch — not a div with a click
 * handler — so the keyboard behaviour, the label association and the
 * announcement all come for free rather than being reimplemented badly.
 */
function switchRow(options: {
  name: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}): HTMLElement {
  const row = el("div", undefined, "srow2");
  const box = el("input");
  box.type = "checkbox";
  box.className = "switch srow2--lead";
  box.checked = options.checked;
  box.disabled = options.disabled === true;
  const id = `sw-${Math.random().toString(36).slice(2)}`;
  box.id = id;

  const label = el("label", options.name, "srow2--name");
  label.htmlFor = id;
  box.addEventListener("change", () => options.onChange(box.checked));

  row.append(box, label);
  if (options.hint) row.append(el("span", options.hint, "srow2--hint"));
  return row;
}

/** A plain row with no switch — a course that was set aside, a hidden item. */
function plainRow(name: string, hint?: string): HTMLElement {
  const row = el("div", undefined, "srow2");
  const label = el("span", name, "srow2--name");
  // An empty cell where the switch would be, so a row with a switch and a row
  // without line up down the list.
  row.append(el("span", undefined, "srow2--lead"), label);
  if (hint) row.append(el("span", hint, "srow2--hint"));
  return row;
}

/**
 * The state, as a chip rather than a sentence.
 *
 * A student scanning six rows for the broken one is scanning for a colour, and
 * "needs you to sign in" set in muted grey beside five other muted greys is not
 * one. The exact stamp and the error stay in the tooltip.
 */
function stateChip(
  state: string,
  detail?: string,
  title?: string,
): HTMLElement {
  const tone =
    state === "ok"
      ? "is-ok"
      : state === "needs_login"
        ? "is-warn"
        : state === "disabled" || state === "pending"
          ? ""
          : "is-err";
  const word = STATE_WORD[state] ?? state;
  const chip = el(
    "span",
    detail ? `${word} · ${detail}` : word,
    `chip-base chip-state ${tone}`.trim(),
  );
  if (title) chip.title = title;
  return chip;
}

/* ---- Course-site adapters, grouped by course -----------------------------
 *
 * One course can have several pages (§4.5's "an adapter is one fixed URL", and
 * a course that keeps assignments on one page and exams on another needs two).
 * These four helpers are what turns that list into a grouped one; the render
 * pass in `renderOptions` only decides the order.
 */

/** One entry of the `get-adapters` answer, as this page sees it. */
type AdapterEntry = Extract<Response, { type: "adapters" }>["adapters"][number];

/**
 * Whether the student added this one themselves.
 *
 * `local` is not on the `adapters` response type — the worker sets it — so it
 * is read defensively rather than declared (worker rule 8: a message is data
 * from another build). An older worker omits it, and `undefined !== true`
 * leaves the Remove button off, which is the harmless direction: a published
 * adapter has nothing to remove.
 */
function isLocalAdapter(adapter: AdapterEntry): boolean {
  return (adapter as { local?: unknown }).local === true;
}

/**
 * The page an adapter reads, as the student would say it: `assignments.html`.
 *
 * Two rows for one course are otherwise identical — same course code, same
 * hostname, same "course site" label — so this is the field that tells them
 * apart. The last non-empty path segment, so a directory URL ending in `/`
 * gives its own name rather than an empty string.
 */
function adapterPagePath(url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return url;
  }
  const segments = pathname.split("/").filter((segment) => segment !== "");
  return segments.length > 0 ? segments[segments.length - 1]! : "/";
}

/**
 * The row's name: the adapter's label with the course code taken off the front.
 *
 * The code is the heading directly above, so repeating it in every row under it
 * spends the widest column on the one thing the row does not distinguish.
 * `ECE 411 assignments` becomes `assignments`. A label that is not prefixed
 * with its code — every published one today is `CS 424 course site` — is left
 * exactly as it is rather than guessed at, and a label that is *only* the code
 * keeps the whole label, because an empty row name is worse than a repeated one.
 */
function adapterPageName(adapter: AdapterEntry): string {
  for (const prefix of [displayCourseLabel(adapter.courseCode), adapter.courseCode]) {
    if (!adapter.label.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    const rest = adapter.label.slice(prefix.length).trim();
    if (rest !== "") return rest;
  }
  return adapter.label;
}

/**
 * How long "Removed ECE 411 · Undo" stays on screen.
 *
 * A removal is one click away from being a mistake and the JSON to put it back
 * is already in hand, so the undo is offered rather than the removal being
 * confirmed first — one click to do it, one to take it back, against two clicks
 * every time for a dialog nobody reads.
 */
const UNDO_WINDOW_MS = 10_000;

interface Removal {
  id: string;
  courseCode: string;
  pageName: string;
  /** Whether it was switched on, so Undo can put that back too. */
  enabled: boolean;
  /** Exactly what `add-local-adapter` will be handed again. */
  adapter: Record<string, unknown>;
  expiresAt: number;
}

/**
 * The one local adapter that was just removed.
 *
 * Module state rather than a node in the section, because every control on this
 * page redraws all of it: a notice appended to the DOM would be thrown away by
 * the `refreshOptions` that follows the removal it is announcing.
 */
let removal: Removal | undefined;
let removalTimer: ReturnType<typeof setTimeout> | undefined;

function noteRemoval(adapter: AdapterEntry): void {
  /*
   * The page's own fields are stripped before the JSON is kept.
   *
   * `enabled`, `granted`, `local` and `currentTerm` are this page's view of an
   * adapter rather than part of one, and `add-local-adapter` stores what it is
   * handed — so handing them back would write four invented fields into the
   * store on every undo.
   */
  const rest = { ...(adapter as unknown as Record<string, unknown>) };
  for (const key of ["enabled", "granted", "local", "currentTerm"]) delete rest[key];
  removal = {
    id: adapter.id,
    courseCode: adapter.courseCode,
    pageName: adapterPageName(adapter),
    enabled: adapter.enabled,
    adapter: rest,
    expiresAt: Date.now() + UNDO_WINDOW_MS,
  };
  if (removalTimer !== undefined) clearTimeout(removalTimer);
  removalTimer = setTimeout(() => {
    removal = undefined;
    void refreshOptions();
  }, UNDO_WINDOW_MS);
}

function clearRemoval(): void {
  removal = undefined;
  if (removalTimer !== undefined) clearTimeout(removalTimer);
  removalTimer = undefined;
}

/**
 * The removal still worth offering back, if there is one.
 *
 * The deadline is checked here as well as fired by the timer: a background tab
 * can have its timers throttled for minutes, and an undo line that outlives its
 * own window by five minutes is a control whose label is a lie.
 */
function pendingUndo(): Removal | undefined {
  if (!removal) return undefined;
  if (Date.now() >= removal.expiresAt) {
    clearRemoval();
    return undefined;
  }
  return removal;
}

/** `Removed ECE 411 assignments · Undo`, inline, for about ten seconds. */
function undoLine(pending: Removal): HTMLElement {
  const line = el("p", undefined, "agroup--undo");
  const said = el(
    "span",
    `Removed ${displayCourseLabel(pending.courseCode)} ${pending.pageName} · `,
  );
  const undo = el("button", "Undo", "btn btn-quiet btn-sm");
  // Asynchronous, so it says so on itself (UI rule 4): "Undo" that stays
  // "Undo" cannot tell "the click never ran" from "the round trip failed".
  const note = el("span", undefined, "opt-note");
  undo.addEventListener("click", () => {
    undo.disabled = true;
    undo.textContent = "Adding back…";
    void send({ type: "add-local-adapter", adapter: pending.adapter })
      .then(async (response) => {
        if (response.type === "error") {
          undo.disabled = false;
          undo.textContent = "Undo";
          note.textContent = response.message;
          return;
        }
        // Removing switched it off as well as deleting it, so putting it back
        // switched off would be half an undo. Chrome's host permission is not
        // touched by a removal, so this cannot need a prompt.
        if (pending.enabled) {
          const on = await send({
            type: "set-adapter-enabled",
            adapterId: pending.id,
            enabled: true,
          });
          if (on.type === "error") note.textContent = on.message;
        }
        clearRemoval();
        await refreshOptions();
      })
      .catch((err: unknown) => {
        // Every `send` from a page needs this (UI rule 2): `send` rejects with
        // the sentence that explains the commonest cause, and swallowing it
        // hides the one line that ends the investigation.
        undo.disabled = false;
        undo.textContent = "Undo";
        note.textContent = err instanceof Error ? err.message : String(err);
      });
  });
  line.append(said, undo, note);
  return line;
}

/** One course: its code, its pages, and any undo it is still owed. */
function adapterGroup(
  courseCode: string,
  list: AdapterEntry[],
  statusEl: HTMLElement,
): HTMLElement {
  const group = el("div", undefined, "agroup");
  const head = el("h4", displayCourseLabel(courseCode), "agroup--head");
  // Only when there is more than one, because "1 page" beside every single-page
  // course is a column of noise saying nothing.
  if (list.length > 1) head.append(el("span", `${list.length} pages`, "agroup--count"));
  group.append(head);
  if (list.length > 0) {
    const box = el("div", undefined, "rows");
    for (const adapter of list) box.append(adapterRow(adapter, statusEl));
    group.append(box);
  }
  const pending = pendingUndo();
  if (pending && pending.courseCode === courseCode) group.append(undoLine(pending));
  return group;
}

/** One page of one course: a switch, the page it reads, and what is wrong. */
function adapterRow(adapter: AdapterEntry, statusEl: HTMLElement): HTMLElement {
  const row = switchRow({
    name: adapterPageName(adapter),
    // The page path first: it is what distinguishes this row from the one above
    // it. The hostname stays, because a course site on a host nobody recognises
    // is the thing worth noticing before granting it.
    hint: `${adapterPagePath(adapter.url)} · ${new URL(adapter.url).hostname}`,
    checked: adapter.enabled && adapter.granted,
    onChange: (enabled) => {
      // Requested here, synchronously in the handler: a user gesture does
      // not survive an await, so asking from the service worker — as this
      // first did — meant Chrome refused the prompt and the checkbox
      // silently reverted with no diagnostic.
      const asked = enabled
        ? chrome.permissions.request({ origins: [adapter.hostPattern] })
        : Promise.resolve(true);
      void asked.then((granted) => {
        if (!granted) {
          // Returned, not followed by a refresh, or the refresh overwrites
          // the only explanation the student gets.
          statusEl.textContent = "Permission denied, so that site stays off.";
          return;
        }
        return send({ type: "set-adapter-enabled", adapterId: adapter.id, enabled }).then(
          (response) => {
            if (response.type === "error") statusEl.textContent = response.message;
            else void refreshOptions();
          },
        );
      });
    },
  });

  // Two controls can share this cell now — Allow and Remove — and the grid
  // places one child per cell, so they go in together or they land on top of
  // each other.
  const actions = el("span", undefined, "srow2--actions");

  if (adapter.enabled && !adapter.granted) {
    // Switched on, but Chrome never granted the host — so it reads nothing
    // and says nothing. A chip and a button rather than a note, because
    // there is exactly one thing to do about it.
    // Not "Sign in needed": nothing about this is a login. Chrome was
    // asked for permission to read one host and did not grant it, and the
    // button beside this asks again.
    const chip = stateChip("needs_login", undefined, "Chrome has not granted access to this site");
    chip.textContent = "Permission missing";
    row.append(chip);
    const allow = el("button", "Allow", "btn btn-secondary btn-sm");
    allow.addEventListener("click", () => {
      void chrome.permissions
        .request({ origins: [adapter.hostPattern] })
        .then((granted) => (granted ? refreshOptions() : undefined));
    });
    actions.append(allow);
  }

  if (isLocalAdapter(adapter)) {
    const remove = el("button", "Remove", "btn btn-secondary btn-sm");
    remove.title =
      `Removes ${adapter.label} from this browser. You added it yourself, so nobody ` +
      `else loses it — and you can put it back for a few seconds afterwards.`;
    remove.addEventListener("click", () => {
      remove.disabled = true;
      remove.textContent = "Removing…";
      const restore = (text: string): void => {
        remove.disabled = false;
        remove.textContent = "Remove";
        statusEl.textContent = text;
      };
      void send({ type: "remove-local-adapter", adapterId: adapter.id })
        .then((response) => {
          if (response.type === "error") {
            restore(response.message);
            return;
          }
          noteRemoval(adapter);
          return refreshOptions();
        })
        .catch((err: unknown) => restore(err instanceof Error ? err.message : String(err)));
    });
    actions.append(remove);
  }

  if (actions.childElementCount > 0) row.append(actions);
  return row;
}

/**
 * The section list down the left, built from the sections themselves.
 *
 * One list rather than two that can disagree, and `data-nav` on the `<section>`
 * is the single place a section's name is written.
 */
function renderPageNav(): void {
  const nav = document.getElementById("pagenav");
  if (!nav) return;
  nav.replaceChildren();
  const sections = [...document.querySelectorAll<HTMLElement>("section[data-nav]")];
  for (const section of sections) {
    const link = el("a", section.dataset["nav"] ?? section.id);
    link.href = `#${section.id}`;
    nav.append(link);
  }

  // Which one you are in. `IntersectionObserver` rather than a scroll handler:
  // a scroll handler on a 1900px page runs on every frame of every scroll to
  // answer a question that changes a handful of times.
  const links = [...nav.querySelectorAll("a")];
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const link of links) {
          link.setAttribute(
            "aria-current",
            String(link.getAttribute("href") === `#${entry.target.id}`),
          );
        }
      }
    },
    { rootMargin: "-10% 0px -70% 0px" },
  );
  for (const section of sections) observer.observe(section);
}

/**
 * Draws the page, and survives a worker that is on another build.
 *
 * Every control here calls this again after it writes, so a throw anywhere in
 * it leaves the page frozen in a half-drawn state with nothing but an
 * "Uncaught (in promise)" to go on. It is called as `void refreshOptions()` in
 * a dozen places, so the catch has to live here rather than at the call sites.
 */
async function refreshOptions(): Promise<void> {
  try {
    await renderOptions();
  } catch (err) {
    setWarning(
      "draw",
      `The settings page could not finish drawing: ` +
        `${err instanceof Error ? err.message : String(err)}. ` +
        `Open chrome://extensions, click Reload on the Illini Dash card, and reopen this page. ` +
        `If it happens again, that message is the bug report.`,
    );
  }
}

async function renderOptions(): Promise<void> {
  const message = await send({ type: "get-options-state" });
  if (message.type !== "options-state") return;

  // Not `message` directly: an older worker does not send every field this
  // page reads, and TypeScript cannot know that (see core/compat.ts).
  const { state, missing } = normalizeOptionsState<typeof message>(message);
  showMissingFields(missing);

  const now = new Date();
  document.getElementById("privacy")!.textContent = PRIVACY_TEXT;

  /* The line under the title: version, last check, and how many answered.
     From `healthPill`, so this page and the popup's header cannot disagree. */
  const pill = healthPill(state.sources, state.lastSyncAt, now);
  // Guarded: `getManifest` is one `chrome.*` call inside a function that draws
  // the whole page, and a throw here used to take the other eight sections
  // with it. Worker rule 8 — never let a render function reject into a console
  // the user does not have open.
  let version = "";
  try {
    version = `Illini Dash ${chrome.runtime.getManifest().version} · `;
  } catch {
    /* A harness, or a page opened outside the extension. */
  }
  document.getElementById("page-sub")!.textContent = `${version}${pill.text}`;

  /* Sources */
  const sources = document.getElementById("sources")!;
  sources.replaceChildren();
  const byState = new Map(sourceRows(state.sources, now).map((row) => [row.source, row]));
  for (const [key, status] of Object.entries(state.sources)) {
    // §4.5 owns this source through the adapter list below, and a second
    // control with the same name is what sent the first live sync into a green
    // dot with nothing behind it: Sushi ticked "Course websites" here, which
    // enables the source, while every adapter stayed off. `set-adapter-enabled`
    // sets this flag anyway. Its health is rendered under Course websites.
    if (key === "site") continue;
    // Nothing is fetched for the student's own list, so it has no health, no
    // last-read time and no switch that would do anything — a permanently grey
    // row saying "Off" beside five real ones (`isFetchedSource`).
    if (key === "manual") continue;
    const source = key as keyof typeof SOURCE_TITLE;
    const row = switchRow({
      name: SOURCE_TITLE[source] ?? key,
      hint: SOURCE_HINT[source],
      checked: status.enabled,
      onChange: (enabled) => {
        void send({ type: "set-source-enabled", source: source as never, enabled }).then(
          refreshOptions,
        );
      },
    });

    // `displayState`, not `status.state`: a source that has never been attempted
    // has no result, and the stored value seeded before the first fetch used to
    // render as a healthy "ok" here too.
    const shown = displayState(status);
    const facts = byState.get(source as never);
    row.append(
      stateChip(
        shown,
        shown === "ok" ? facts?.lastRead : undefined,
        [status.lastError, facts?.lastReadExact && `last read ${facts.lastReadExact}`]
          .filter(Boolean)
          .join("\n") || undefined,
      ),
    );
    const signIn = actionFor(source as never, shown, status.loginUrl);
    if (signIn?.kind === "login") {
      const login = el("button", "Sign in", "btn btn-secondary btn-sm");
      login.addEventListener("click", () => chrome.tabs.create({ url: signIn.url }));
      row.append(login);
    }
    sources.append(row);
  }

  /*
   * Campuswire, under the same heading as the sources.
   *
   * It belongs here and not under Course websites because what it produces is
   * deadlines, from a place the student thinks of as a place deadlines come
   * from — and because a row about reading a page has nothing to do with the
   * adapter machinery below, which is about fetching URLs. It is appended to
   * this list rather than given a section of its own because `options.html` is
   * not this change's to edit; if it grows a second observer it wants a heading.
   *
   * It is not a `Source`: nothing is fetched, there is no health to report, and
   * the chip says what has actually been read rather than what the switch says
   * (`describeObserver`, worker rule 2).
   */
  const observers = (state.observers ?? {}) as Record<string, ObserverFacts | undefined>;
  const campuswire = observers["campuswire"];
  /*
   * Held as variables rather than looked up by class when the switch is used.
   * Three redraw guards in the popup asked for `.menu` while the class was
   * `menu-surface` and were dead from the day they were written (UI rule 7); a
   * reference cannot be misspelled.
   */
  const cwChip = stateChip(
    "disabled",
    undefined,
    "Illini Dash reads a Campuswire class feed only while you have it open.",
  );
  cwChip.textContent = describeObserver(campuswire);
  const cwRow = switchRow({
    name: "Campuswire",
    hint:
      "Reads deadlines out of the class feeds you open, on this computer. " +
      "Nothing is sent to Campuswire and no posts are stored.",
    checked: campuswire?.enabled === true,
    onChange: (enabled) => {
      const box = cwRow.querySelector("input");
      // The control says it is doing something (UI rule 4): this round trip
      // includes a permission prompt and a content-script registration, and
      // without this a denied prompt and a click that never ran look identical.
      if (box) box.disabled = true;
      cwChip.textContent = enabled ? "Asking\u2026" : "Turning off\u2026";
      const restore = (text: string): void => {
        if (box) {
          box.disabled = false;
          box.checked = campuswire?.enabled === true;
        }
        cwChip.textContent = describeObserver(campuswire);
        // On the row, not in the page's status line: `#gate0-status` is in
        // another section entirely, and a report that lands where the error did
        // not happen is not a channel (UI rule 3).
        cwHint.textContent = text;
      };
      // Requested here, synchronously inside the handler: a user gesture does
      // not survive an await, so the worker cannot ask for this (see the
      // adapter row above, where asking from the worker silently failed).
      const asked = enabled
        ? chrome.permissions.request({ origins: [CAMPUSWIRE_MATCH] })
        : Promise.resolve(true);
      void asked
        .then((granted) => {
          if (!granted) {
            restore("Permission denied, so Campuswire stays off.");
            return undefined;
          }
          return send({ type: "set-observer-enabled", observer: "campuswire", enabled }).then(
            (response) => {
              if (response.type === "error") restore(response.message);
              else void refreshOptions();
            },
          );
        })
        // Every send from a page gets one (UI rule 2): without it a stale
        // worker rejects into nothing at all and the switch just springs back.
        .catch((err: unknown) => restore(err instanceof Error ? err.message : String(err)));
    },
  });
  const cwHint = cwRow.querySelector(".srow2--hint") ?? el("span", undefined, "srow2--hint");
  cwRow.append(cwChip);
  sources.append(cwRow);

  /*
   * Piazza, beside Campuswire and switched on the same way.
   *
   * It says more than Campuswire's row can, because it is *fetched*: there is a
   * login state, a failure and an attempt behind every word, and all of them
   * come from `describePiazza` rather than from the switch (worker rule 2). The
   * Sign in button is the point of the `needs_login` state — the state that
   * says "sign in" with nothing to press is the defect this project has hit
   * more than once.
   */
  const piazza = observers["piazza"] as PiazzaFacts | undefined;
  /*
   * The tone comes from the state, like every Source row below (`displayState`).
   * It was the literal "disabled", so "Couldn't be read" and "Sign in needed"
   * were painted the same neutral grey as "Off" — on a page whose other rows
   * use colour as the scanning signal, which left this row's failure legible
   * only word by word. The words still come from `describePiazza`.
   */
  const pzState = (): string => piazzaChipState(piazza);
  const pzChip = stateChip(
    pzState(),
    undefined,
    "Illini Dash reads your Piazza class feeds in the background, on each sync.",
  );
  pzChip.textContent = describePiazza(piazza);
  if (piazza?.lastError) pzChip.title = piazza.lastError;
  const pzRow = switchRow({
    name: "Piazza",
    hint:
      "Reads the announcements in your Piazza classes on each sync, using the session " +
      "already in this browser. Nothing is posted and no post is stored.",
    checked: piazza?.enabled === true,
    onChange: (enabled) => {
      const box = pzRow.querySelector("input");
      // The control says it is working (UI rule 4): this round trip includes a
      // permission prompt and a first poll, and without it a denied prompt and
      // a click that never ran look identical.
      if (box) box.disabled = true;
      // Working, not broken: the tone goes back to neutral while the round trip
      // is in flight, or a failing row keeps its red under the word "Asking".
      pzChip.className = "chip-base chip-state";
      pzChip.textContent = enabled ? "Asking\u2026" : "Turning off\u2026";
      const restore = (text: string): void => {
        if (box) {
          box.disabled = false;
          box.checked = piazza?.enabled === true;
        }
        // The chip goes back to the state it was drawn in, tone and all.
        pzChip.className = stateChip(pzState()).className;
        pzChip.textContent = describePiazza(piazza);
        // On the row, where the error happened (UI rule 3).
        pzHint.textContent = text;
      };
      // Inside the click, synchronously: a user gesture does not survive an
      // await, so the worker cannot ask for this.
      const asked = enabled
        ? chrome.permissions.request({ origins: [PIAZZA_MATCH] })
        : Promise.resolve(true);
      void asked
        .then((granted) => {
          if (!granted) {
            restore("Permission denied, so Piazza stays off.");
            return undefined;
          }
          return send({ type: "set-observer-enabled", observer: "piazza", enabled }).then(
            (response) => {
              if (response.type === "error") restore(response.message);
              else void refreshOptions();
            },
          );
        })
        // UI rule 2: without this a stale worker rejects into nothing at all
        // and the switch just springs back.
        .catch((err: unknown) => restore(err instanceof Error ? err.message : String(err)));
    },
  });
  const pzHint = pzRow.querySelector(".srow2--hint") ?? el("span", undefined, "srow2--hint");
  pzRow.append(pzChip);
  if (missing.includes("observers.piazza")) {
    /*
     * The worker is older than this page and has no Piazza observer at all.
     * Without this the row says "Off", which is the student's own switch, and
     * the click would grant the host permission and only then reach a worker
     * that throws on it. The banner at the top says it too; this says it where
     * the control is (UI rule 3).
     */
    const box = pzRow.querySelector("input");
    if (box) box.disabled = true;
    pzHint.textContent =
      "The background part of Illini Dash is still running an older version that has no " +
      "Piazza support. Open chrome://extensions, click Reload on the Illini Dash card, " +
      "then reopen this page.";
  }
  if (piazza?.enabled === true && piazza.state === "needs_login") {
    const login = el("button", "Sign in", "btn btn-secondary btn-sm");
    login.addEventListener("click", () => chrome.tabs.create({ url: PIAZZA_LOGIN_URL }));
    pzRow.append(login);
  }
  sources.append(pzRow);

  // The site source's state still has to be visible somewhere, or a failing
  // adapter loses its only signal (worker rule 2).
  const siteHealth = document.getElementById("site-health")!;
  siteHealth.replaceChildren();
  const siteStatus = state.sources.site;
  if (siteStatus) {
    const shown = displayState(siteStatus);
    const facts = byState.get("site");
    // A labelled row, not a floating chip. A state word with nothing beside it
    // reads as a state of *the section*, and this is the state of one source.
    const box = el("div", undefined, "rows");
    const row = plainRow(
      "Reading course websites",
      "How the last attempt at every switched-on site went.",
    );
    row.append(
      stateChip(shown, shown === "ok" ? facts?.lastRead : undefined, siteStatus.lastError),
    );
    /*
     * The button this row never had.
     *
     * A course website has no entry in `LOGIN_URL` — there is no one page to
     * open, by construction — so this said "Sign in needed" with nothing beside
     * it, on the only source where the student cannot guess the address either.
     * `actionFor` now falls back to the page the last attempt found locked,
     * which for a Shibboleth-protected course page is both the sign-in trigger
     * and the destination.
     */
    const siteAction = actionFor("site", shown, siteStatus.loginUrl);
    if (siteAction?.kind === "login") {
      const login = el("button", "Sign in", "btn btn-secondary btn-sm");
      login.title = `Opens ${new URL(siteAction.url).hostname}, which signs you in and lands on the page`;
      login.addEventListener("click", () => chrome.tabs.create({ url: siteAction.url }));
      row.append(login);
    }
    box.append(row);
    siteHealth.append(box);
  }

  /* Courses (§8.2) */
  const courses = document.getElementById("courses")!;
  courses.replaceChildren();
  if (state.courses.length === 0) {
    courses.append(plainRow("No courses yet", "Nothing has been read from a source yet."));
  }
  for (const course of state.courses) {
    const row = switchRow({
        name: courseLabel(course.label, state.courseNames ?? {}),
        // Names, not source keys: `prairielearn, canvas` under a course code is
        // the storage layer leaking onto the one screen a student comes to in
        // order to recognise their own courses.
        hint: `${course.itemCount} item${course.itemCount === 1 ? "" : "s"} · ${course.sources
          .map((source) => SOURCE_TITLE[source as never] ?? source)
          .join(", ")}`,
        checked: !course.disabled,
        onChange: (enabled) => {
          void send({
            type: "set-course-disabled",
            course: course.key,
            disabled: !enabled,
          }).then(refreshOptions);
        },
      });

    /*
     * Renaming, for the names no rule can derive.
     *
     * A text box rather than a dialog: the thing being renamed is one short
     * string, and a dialog to change one short string is three clicks around a
     * keystroke. It shows the *derived* label as its placeholder, so an empty
     * box is visibly "the name it works out for itself" rather than blank — and
     * clearing the box is how the student gets that back, which is why
     * `renameCourse` deletes on empty rather than storing one.
     *
     * Saved on `change` (blur or Enter), not on every keystroke: each save is a
     * queued store write and a redraw of every surface, and doing that per
     * character would fight the typing.
     */
    const rename = el("input", undefined, "srow2--rename") as HTMLInputElement;
    rename.type = "text";
    rename.maxLength = 60;
    rename.placeholder = displayCourseLabel(course.label);
    rename.value = (state.courseNames ?? {})[course.label] ?? "";
    rename.title = `Rename ${displayCourseLabel(course.label)}. Clear the box to go back to this name.`;
    rename.setAttribute("aria-label", `Name for ${displayCourseLabel(course.label)}`);
    rename.addEventListener("change", () => {
      void send({
        type: "set-course-name",
        course: course.label,
        name: rename.value,
      }).then(refreshOptions);
    });
    row.append(rename);
    courses.append(row);
  }

  /* Course-site adapters (§4.5) */
  const adaptersEl = document.getElementById("adapters")!;
  const registryStatus = document.getElementById("registry-status")!;
  const adapterState = await send({ type: "get-adapters" });
  adaptersEl.replaceChildren();
  if (adapterState.type === "adapters") {
    // `List updated 9/11/2026, 6:19:34 PM` was eight tokens answering a
    // question whose real answer is "recently". The exact stamp moves to the
    // tooltip, where it is still there for anyone debugging.
    const fetched = timeAgo(adapterState.fetchedAt, now);
    registryStatus.textContent = fetched ? `Updated ${fetched}` : "Not fetched yet";
    registryStatus.title = fullStamp(adapterState.fetchedAt) ?? "";
    // §4.5: adapters carry a term and expire; stale ones are hidden.
    const current = adapterState.adapters.filter((a) => a.currentTerm);
    if (current.length === 0) {
      const box = el("div", undefined, "rows");
      box.append(
        plainRow(
          "None for this term yet",
          "They are published separately, so this list can fill in without updating the extension.",
        ),
      );
      adaptersEl.append(box);
    }

    /*
     * Grouped by course, because a course is no longer one page.
     *
     * ECE 411 keeps assignments on one page and exams on another, and a flat
     * list showed those as two rows both called "ECE 411 course site" — the
     * same name, the same hostname, and no way to tell which switch turned off
     * the exams. The course code is the heading; each row is named for its page
     * and carries that page's own switch, state and path.
     *
     * Insertion order, not sorted: the registry lists a course's pages in the
     * order they were written, and reordering them here would make "the second
     * ECE 411 row" mean different things in two places.
     */
    const groups = new Map<string, typeof current>();
    for (const adapter of current) {
      const list = groups.get(adapter.courseCode);
      if (list) list.push(adapter);
      else groups.set(adapter.courseCode, [adapter]);
    }
    for (const [courseCode, list] of groups) {
      adaptersEl.append(adapterGroup(courseCode, list, registryStatus));
    }

    /*
     * The undo line for a course that no longer has a group.
     *
     * Removing a course's only page removes its heading too, so the notice has
     * nowhere to hang — and that is exactly the removal a student is most
     * likely to want back. It gets a group of its own, with no rows.
     */
    const pending = pendingUndo();
    if (pending && !groups.has(pending.courseCode)) {
      adaptersEl.append(adapterGroup(pending.courseCode, [], registryStatus));
    }
  }

  /* Older courses — §4.1's term filter, made visible and reversible */
  const setAside = document.getElementById("set-aside")!;
  setAside.replaceChildren();
  if (state.setAsideCourses.length === 0) {
    setAside.append(plainRow("None", "Every Canvas course is in the current term."));
  }
  for (const course of state.setAsideCourses) {
    const row = plainRow(`${course.courseCode ?? ""} ${course.name}`.trim(), course.reason);
    const keep = el("button", "Put back", "btn btn-secondary btn-sm");
    keep.addEventListener("click", () => {
      void send({ type: "keep-course", courseId: course.id, keep: true }).then(refreshOptions);
    });
    row.append(keep);
    setAside.append(row);
  }

  /* Reminders (§7, §8.2) */
  const reminders = document.getElementById("reminders")!;
  reminders.replaceChildren();

  // Chrome's own switch, which one click in any toast flips. While it is off,
  // every reminder is created and dropped, so this section would otherwise
  // describe settings that cannot possibly take effect.
  if (state.notificationsBlocked) {
    const banner = el("div", undefined, "banner-line banner-err");
    banner.append(
      icon("warning"),
      el(
        "span",
        "Chrome is blocking reminders from Illini Dash, so none of these will reach you.",
        "banner-line--text",
      ),
    );
    banner.style.borderRadius = "8px";
    banner.style.marginBottom = "10px";
    reminders.append(banner);
  }

  const remindRows = el("div", undefined, "rows");

  /* When. Two lead times, because §7 has two and a third cannot exist. */
  const leads = el("div", undefined, "srow2");
  leads.append(el("span"), el("span", "When to remind me", "srow2--name"));
  leads.append(el("span", "Before the deadline the source states.", "srow2--hint"));
  const leadBox = el("span", undefined, "row-actions");
  leadBox.style.margin = "0";
  for (const lead of ["24h", "2h"] as const) {
    const on = state.settings.leadTimes.includes(lead);
    const chip = el("button", lead === "24h" ? "24 hours" : "2 hours", "chip-base");
    chip.setAttribute("aria-pressed", String(on));
    if (on) {
      chip.style.background = "var(--accent-wash)";
      chip.style.borderColor = "var(--accent)";
    } else {
      chip.style.opacity = ".55";
    }
    chip.addEventListener("click", () => {
      const leadTimes = on
        ? state.settings.leadTimes.filter((l) => l !== lead)
        : [...new Set([...state.settings.leadTimes, lead])];
      void send({ type: "update-settings", settings: { leadTimes } }).then(refreshOptions);
    });
    leadBox.append(chip);
  }
  leads.append(leadBox);
  remindRows.append(leads);

  remindRows.append(
    switchRow({
      name: "Remind me about not-for-credit work",
      hint: "Practice quizzes and surveys stay in the list either way — this is only about interrupting you.",
      checked: state.settings.remindNotForCredit,
      onChange: (remindNotForCredit) => {
        void send({ type: "update-settings", settings: { remindNotForCredit } }).then(
          refreshOptions,
        );
      },
    }),
  );
  remindRows.append(
    switchRow({
      name: "Hide submitted and graded work",
      hint: "Finished work still shows on days that have already passed, so a week you worked through does not look empty.",
      checked: state.settings.hideSubmitted,
      onChange: (hideSubmitted) => {
        void send({ type: "update-settings", settings: { hideSubmitted } }).then(refreshOptions);
      },
    }),
  );

  /* Quiet hours: two clocks, not two numbers between 0 and 23. */
  const quiet = state.settings.quietHours;
  const quietRow = switchRow({
    name: "Quiet hours",
    hint: "Reminders due in this window wait until it ends.",
    checked: quiet !== null,
    onChange: (enabled) => {
      void send({
        type: "update-settings",
        settings: { quietHours: enabled ? { start: 23, end: 8 } : null },
      }).then(refreshOptions);
    },
  });
  if (quiet) {
    const times = el("span", undefined, "row-actions");
    times.style.margin = "0";
    const hourField = (value: number) => {
      const input = el("input", undefined, "field") as HTMLInputElement;
      input.type = "time";
      input.step = "3600";
      input.value = `${String(value).padStart(2, "0")}:00`;
      return input;
    };
    const from = hourField(quiet.start);
    const to = hourField(quiet.end);
    const push = () => {
      // `Number("")` is 0, which is a legitimate hour, so a cleared box would
      // silently become midnight and narrow the window rather than being
      // rejected. `<input type=time>` can still be empty, so this checks.
      const hour = (input: HTMLInputElement): number | undefined => {
        const match = /^(\d{2}):/.exec(input.value);
        if (!match) return undefined;
        const n = Number(match[1]);
        return Number.isInteger(n) && n >= 0 && n <= 23 ? n : undefined;
      };
      const start = hour(from);
      const end = hour(to);
      if (start === undefined || end === undefined) {
        dataStatus().textContent = "Quiet hours need a start and an end.";
        void refreshOptions();
        return;
      }
      void send({ type: "update-settings", settings: { quietHours: { start, end } } }).then(
        refreshOptions,
      );
    };
    from.addEventListener("change", push);
    to.addEventListener("change", push);
    times.append(el("span", "from", "opt-note"), from, el("span", "to", "opt-note"), to);
    quietRow.append(times);
  }
  remindRows.append(quietRow);

  /* How often. A select, because the useful values are four and the box let
     you type 17 minutes and wonder why nothing changed. */
  const pollRow = el("div", undefined, "srow2");
  pollRow.append(el("span"), el("span", "Check for changes", "srow2--name"));
  pollRow.append(
    el("span", "Opening the popup also checks, at most once every five minutes.", "srow2--hint"),
  );
  const poll = el("select", undefined, "field") as HTMLSelectElement;
  for (const minutes of [15, 30, 60, 120]) {
    if (minutes < MIN_POLL_MINUTES || minutes > MAX_POLL_MINUTES) continue;
    const option = document.createElement("option");
    option.value = String(minutes);
    option.textContent = minutes < 60 ? `Every ${minutes} minutes` : `Every ${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
    option.selected = minutes === state.settings.pollMinutes;
    poll.append(option);
  }
  // A stored value that is not one of the four — set by an older build, or by
  // hand — would otherwise silently select the first option and then save it.
  if (!offersValue(poll, state.settings.pollMinutes)) {
    const option = document.createElement("option");
    option.value = String(state.settings.pollMinutes);
    option.textContent = `Every ${state.settings.pollMinutes} minutes`;
    option.selected = true;
    poll.append(option);
  }
  poll.addEventListener("change", () => {
    void send({
      type: "update-settings",
      settings: { pollMinutes: Number(poll.value) },
    }).then(refreshOptions);
  });
  pollRow.append(poll);
  remindRows.append(pollRow);

  const testRow = el("div", undefined, "srow2");
  testRow.append(el("span"), el("span", "Send a test reminder", "srow2--name"));
  const testResult = el("span", "One notification, now, so you can see what they look like.", "srow2--hint");
  testRow.append(testResult);
  const testButton = el("button", "Send", "btn btn-secondary btn-sm");
  testButton.addEventListener("click", () => {
    testResult.textContent = "Sending…";
    void send({ type: "test-notification" }).then((response) => {
      // Says which of the two things happened, rather than going quiet on the
      // failure that matters (worker house rule 5, in the UI).
      testResult.textContent =
        response.type === "error"
          ? response.message
          : "Sent. If nothing appeared, Chrome or the operating system is hiding it.";
    });
  });
  testRow.append(testButton);
  remindRows.append(testRow);
  reminders.append(remindRows);

  /* Hidden items (§8.1's Hide, undoable) */
  const hidden = document.getElementById("hidden")!;
  hidden.replaceChildren();
  if (state.hiddenItems.length === 0) hidden.append(plainRow("Nothing hidden"));
  for (const item of state.hiddenItems) {
    const row = plainRow(item.title, item.courseLabel);
    const unhide = el("button", "Unhide", "btn btn-secondary btn-sm");
    unhide.addEventListener("click", () => {
      void send({ type: "override", action: { kind: "unhide", itemId: item.id } }).then(
        refreshOptions,
      );
    });
    row.append(unhide);
    hidden.append(row);
  }

  /* Ticked off by hand — the only way back for a row the popup no longer shows */
  const done = document.getElementById("done")!;
  done.replaceChildren();
  if (state.doneItems.length === 0) done.append(plainRow("Nothing ticked off"));
  for (const item of state.doneItems) {
    const row = plainRow(item.title, item.courseLabel);
    const undo = el("button", "Not done", "btn btn-secondary btn-sm");
    undo.addEventListener("click", () => {
      void send({ type: "override", action: { kind: "undone", itemId: item.id } }).then(
        refreshOptions,
      );
    });
    row.append(undo);
    done.append(row);
  }

  /* Google Calendar (§8.3) — see `renderGcal`. */
  renderGcal((state as { gcal?: GcalFacts }).gcal);

  renderPageNav();
}


/* ---- Google Calendar (§8.3) --------------------------------------------
 *
 * Its own section, built here rather than in `options.html`, because the
 * markup is not this change's to edit and because a section that only exists
 * when the build knows about it is the honest shape: an options page talking to
 * an older worker gets `gcal: {}` from `core/compat.ts`, which reads as "Off".
 *
 * Inserted after Reminders and before Appearance: a student looking for it is
 * looking near the other things that tell them about a deadline, not near the
 * export buttons.
 */

/** Created once and reused, so a redraw cannot leave two of them. */
function gcalSection(): HTMLElement {
  const existing = document.getElementById("sec-gcal");
  if (existing) return existing;
  const section = el("section");
  section.id = "sec-gcal";
  // `renderPageNav` reads this attribute; it is the one place a section's name
  // is written, and it runs at the end of every render, so a section added here
  // reaches the nav on the same pass.
  section.dataset["nav"] = "Google Calendar";
  const heading = el("h2", "Google Calendar");
  const lede = el(
    "p",
    "Optional, and off until you turn it on. Illini Dash can keep a calendar of " +
      "your deadlines in your own Google account.",
    "lede",
  );
  const rows = el("div", undefined, "rows");
  rows.id = "gcal-rows";
  section.append(heading, lede, rows);
  const before = document.getElementById("sec-appearance");
  (before?.parentElement ?? document.body).insertBefore(section, before ?? null);
  return section;
}

function renderGcal(facts: GcalFacts | undefined): void {
  const rows = gcalSection().querySelector("#gcal-rows")!;
  rows.replaceChildren();
  const described = describeGcal(facts, new Date());

  /*
   * Held as variables, never looked up by class later (UI rule 7): three redraw
   * guards in the popup asked for `.menu` while the class was `menu-surface`
   * and were dead from the day they were written.
   */
  const chip = stateChip("disabled", undefined, described.sentence);
  chip.textContent = described.chip;
  if (described.tone === "ok") chip.className = "chip-base chip-state is-ok";
  else if (described.tone === "warn") chip.className = "chip-base chip-state is-warn";
  else if (described.tone === "err") chip.className = "chip-base chip-state is-err";

  const row = switchRow({
    name: "Sync to Google Calendar",
    hint: described.sentence,
    checked: facts?.enabled === true,
    onChange: (enabled) => {
      const box = row.querySelector("input");
      const restore = (text: string): void => {
        if (box) {
          box.disabled = false;
          box.checked = facts?.enabled === true;
        }
        chip.textContent = describeGcal(facts, new Date()).chip;
        // On the row, where the error happened — not in `#gate0-status`, which
        // is in another section entirely (UI rule 3).
        hint.textContent = text;
      };
      if (box) box.disabled = true;
      // The control says it is doing something (UI rule 4): this round trip
      // includes a Chrome permission prompt, a Google consent window and a
      // calendar being created, and without this a closed consent window and a
      // click that never ran look identical.
      chip.textContent = enabled ? "Connecting\u2026" : "Disconnecting\u2026";

      // Requested synchronously inside the handler: a user gesture does not
      // survive an await, so the worker cannot ask (see the Campuswire row).
      const asked = enabled
        ? chrome.permissions.request({ origins: [GCAL_MATCH] })
        : Promise.resolve(true);
      void asked
        .then((granted) => {
          if (!granted) {
            restore("Permission denied, so Google Calendar stays off.");
            return undefined;
          }
          return send({ type: enabled ? "gcal-connect" : "gcal-disconnect" }).then((response) => {
            if (response.type === "error") restore(response.message);
            else if (response.type === "permission") {
              restore("Chrome did not grant access to the Google Calendar API.");
            } else void refreshOptions();
          });
        })
        // Every send from a page gets one (UI rule 2): without it a stale worker
        // rejects into nothing at all and the switch just springs back.
        .catch((err: unknown) => restore(err instanceof Error ? err.message : String(err)));
    },
  });
  const hint = row.querySelector(".srow2--hint") ?? el("span", undefined, "srow2--hint");
  row.append(chip);

  if (facts?.enabled) {
    const push = el("button", "Push now", "btn btn-secondary btn-sm");
    push.addEventListener("click", () => {
      push.disabled = true;
      const was = push.textContent;
      push.textContent = "Pushing\u2026";
      void send({ type: "gcal-push-now" })
        .then((response) => {
          if (response.type === "error") hint.textContent = response.message;
          return refreshOptions();
        })
        .catch((err: unknown) => {
          hint.textContent = err instanceof Error ? err.message : String(err);
        })
        .finally(() => {
          push.disabled = false;
          push.textContent = was;
        });
    });
    row.append(push);
  }
  rows.append(row);

  if (facts?.enabled) {
    // Said plainly beside the switch rather than only in the privacy policy:
    // this is the one place in the extension where something leaves the
    // browser, and the student is standing in front of the switch that does it.
    rows.append(
      plainRow(
        "What is sent",
        "The course, title, time and link of each unfinished deadline — to a " +
          "calendar named “Illini Dash” in your own Google account, and nowhere " +
          "else. Turning this off deletes that calendar.",
      ),
    );
  }
}

/** Whether a `<select>` already offers this value. */
function offersValue(select: HTMLSelectElement, value: number): boolean {
  return [...select.options].some((option) => option.value === String(value));
}

/**
 * §2.3 keeps course-site hosts out of the up-front permission request, so any
 * illinois.edu host other than the four sources needs a runtime grant before it
 * can be fetched at all. Asked here rather than in the worker: a user gesture
 * does not survive the message hop, and Chrome refuses the prompt without one.
 */
async function ensureHostPermission(url: string): Promise<boolean> {
  try {
    if (isGrantedUpFront(url)) return true;
    const origins = [originPattern(url)];
    if (await chrome.permissions.contains({ origins })) return true;
    return await chrome.permissions.request({ origins });
  } catch {
    return false;
  }
}

const dataStatus = () => document.getElementById("data-status")!;

document.getElementById("download-ics")!.addEventListener("click", async () => {
  const state = await send({ type: "get-state" });
  if (state.type !== "state") return;
  const count = downloadIcs(state.items);
  dataStatus().textContent = `Exported ${count} items. This is a one-time copy, not a subscription.`;
});

document.getElementById("copy-diagnostics")!.addEventListener("click", async () => {
  const dataStatus = document.getElementById("data-status")!;
  dataStatus.textContent = "Collecting…";
  const response = await send({ type: "get-diagnostics" });
  if (response.type !== "diagnostics") {
    dataStatus.textContent =
      response.type === "error" ? response.message : "Unexpected response.";
    return;
  }
  await navigator.clipboard.writeText(response.report);
  dataStatus.textContent = `Diagnostics copied (${response.report.length} characters). Paste it into the issue.`;
});

document.getElementById("export")!.addEventListener("click", async () => {
  const response = await send({ type: "export" });
  if (response.type !== "export") return;
  downloadFile("illini-dash-export.json", response.json, "application/json");
  dataStatus().textContent = "Exported.";
});

document.getElementById("restart-setup")!.addEventListener("click", async () => {
  const status = document.getElementById("restart-setup-status")!;
  status.textContent = "Reopening…";
  const response = await send({ type: "restart-setup" });
  if (response.type === "error") {
    status.textContent = response.message;
    return;
  }
  // Straight there rather than leaving a note telling them to go and look:
  // this button has exactly one outcome and it is a page.
  location.href = chrome.runtime.getURL("popup.html?view=full");
});

document.getElementById("reset")!.addEventListener("click", async () => {
  // Irreversible and it takes the user's overrides with it, so it asks.
  if (!confirm("Delete all stored data, including your hide/merge corrections?")) return;
  await send({ type: "reset" });
  dataStatus().textContent = "Everything reset.";
  await refreshOptions();
});

void refreshOptions();

document.getElementById("refresh-registry")!.addEventListener("click", async () => {
  document.getElementById("registry-status")!.textContent = "Checking…";
  await send({ type: "refresh-registry" });
  await refreshOptions();
});


/* ---- §8.2's "report a broken page" ---------------------------------------
 * The same capture + scrub path the fixture tool uses, packaged for someone who
 * is not building the extension: it adds the diagnostic context a maintainer
 * would otherwise have to ask for, and it never transmits anything.
 */

const reportNetid = document.getElementById("report-netid") as HTMLInputElement;
const reportName = document.getElementById("report-name") as HTMLInputElement;
const reportStatus = () => document.getElementById("report-status")!;
const reportResult = () => document.getElementById("report-result")!;

document.getElementById("report-fetch")!.addEventListener("click", async () => {
  const url = (document.getElementById("report-url") as HTMLInputElement).value.trim();
  if (!url) {
    reportStatus().textContent = "Paste the URL of the page that is not working.";
    return;
  }
  if (!(await ensureHostPermission(url))) {
    reportStatus().textContent =
      `Chrome did not grant access to ${url}, so that page cannot be read.`;
    return;
  }
  reportStatus().textContent = "Fetching…";
  reportResult().replaceChildren();

  const captured = await send({ type: "capture", url });
  if (captured.type === "error") {
    reportStatus().textContent = captured.message;
    return;
  }
  if (captured.type !== "capture") return;

  const { html, report } = scrubHtml(captured.result.body, {
    netid: reportNetid.value.trim() || undefined,
    name: reportName.value.trim() || undefined,
  });
  // §8.2: this file is meant for a public issue, so "no name was supplied" is a
  // blocker here even though it is only a note elsewhere. A scrub that never
  // had a name to remove is not a scrubbed file, whatever the counts say — and
  // these inputs previously lived two sections away in the debug tools, so they
  // were always empty and the button always read "Download report".
  const blockers = report.warnings.filter(
    (w) => w.severity === "blocker" || /^No (name|NetID) given/.test(w.message),
  );

  const state = await send({ type: "get-options-state" });
  const sources = state.type === "options-state" ? state.sources : undefined;

  // Context a maintainer would otherwise have to ask for, one round trip saved.
  const context = [
    `illini-dash report`,
    `build: ${BUILD_ID}`,
    `generated: ${new Date().toISOString()}`,
    `url: ${captured.result.requestUrl}`,
    `final url: ${captured.result.finalUrl}`,
    `status: ${captured.result.status} ${captured.result.statusText}`,
    `content-type: ${captured.result.contentType ?? "unknown"}`,
    `bytes: ${captured.result.bytes}`,
    "",
    "source health:",
    ...(sources
      ? Object.values(sources).map(
          (s) =>
            `  ${s.source}: ${s.enabled ? s.state : "disabled"}` +
            `${s.lastError ? ` — ${s.lastError}` : ""}` +
            `${s.lastSuccessAt ? ` (last ok ${s.lastSuccessAt})` : ""}`,
        )
      : ["  unavailable"]),
    "",
    "scrubbing applied:",
    ...Object.entries(report.counts).map(([label, count]) => `  ${label}: ${count}`),
    ...report.warnings.map((w) => `  ${w.severity.toUpperCase()}: ${w.message}`),
    "",
    "The HTML below was fetched from the page above and scrubbed in the browser.",
    "Read it before attaching it to a public issue.",
    "=".repeat(70),
    "",
  ].join("\n");

  const box = document.createElement("div");
  box.className = "result";
  const heading = document.createElement("h3");
  heading.textContent = "Report ready";
  box.append(heading);

  const dl = document.createElement("dl");
  row(dl, "page", captured.result.finalUrl);
  row(dl, "status", String(captured.result.status));
  for (const [label, count] of Object.entries(report.counts)) row(dl, label, `${count} replaced`);
  for (const warning of report.warnings) {
    const dt = document.createElement("dt");
    dt.textContent = warning.severity === "blocker" ? "MUST FIX" : "note";
    const dd = document.createElement("dd");
    if (warning.severity === "blocker") dd.className = "verdict-error";
    dd.textContent = warning.message;
    dl.append(dt, dd);
  }
  box.append(dl);

  const save = document.createElement("button");
  save.textContent = blockers.length
    ? `Download anyway (${blockers.length} unresolved — read it first)`
    : "Download report";
  save.addEventListener("click", () => {
    downloadFile(
      `illini-dash-report-${Date.now()}.txt`,
      `${context}${html}`,
      "text/plain",
    );
  });
  box.append(save);

  const note = document.createElement("p");
  note.className = "muted";
  note.textContent =
    "Attach the downloaded file to an issue. It contains the page's HTML, so read " +
    "it first — anything the scrubber could not recognise as yours is still in there.";
  box.append(note);

  reportResult().append(box);
  reportStatus().textContent = blockers.length
    ? `Prepared, but ${blockers.length} thing(s) still look identifying.`
    : "Prepared.";
});

/* ---- Right-click "Report this page" hand-off ------------------------------
 * The worker opens this page with the page URL in the fragment. It is untrusted
 * input, so `reportUrlFromHash` validates it before it reaches the field.
 */
void (() => {
  const target = reportUrlFromHash(location.hash);
  if (!target) return;
  const field = document.getElementById("report-url") as HTMLInputElement | null;
  if (!field) return;
  field.value = target;
  // The whole report form is behind a disclosure now, so filling it in without
  // opening it would put the URL somewhere nobody can see.
  (document.getElementById("report-box") as HTMLDetailsElement | null)?.setAttribute("open", "");
  field.scrollIntoView({ block: "center" });
  field.focus();
  const status = document.getElementById("report-status");
  if (status) {
    status.textContent =
      "Filled in from the page you right-clicked. Press Prepare report to fetch and scrub it.";
  }
})();

/* -------------------------------------------------------------------------- */
/* Adding a course site yourself (§4.5, self-serve)                            */
/* -------------------------------------------------------------------------- */

/**
 * The whole flow: read a page, show what was found, save what is approved.
 *
 * Adding a course used to mean capturing a page, sending it to the maintainer,
 * waiting for someone to read the markup and push. That made one person the
 * bottleneck for every course at the university, and it is why two adapters
 * exist rather than two hundred.
 *
 * Nothing is saved until the student has looked at the rows. That is the whole
 * safety argument: a wrong column produces visibly wrong titles and dates, and
 * the person who takes the course is the only one who can tell.
 */
const addSiteUrl = document.getElementById("add-site-url") as HTMLInputElement;
const addSiteStatus = document.getElementById("add-site-status")!;
const addSiteResult = document.getElementById("add-site-result")!;

document.getElementById("add-site-go")!.addEventListener("click", async () => {
  const url = addSiteUrl.value.trim();
  addSiteResult.replaceChildren();
  if (!url) {
    addSiteStatus.textContent = "Paste the address of the page first.";
    return;
  }
  // Inside the click, because Chrome refuses a permission prompt without a
  // user gesture and a gesture does not survive an await.
  if (!(await ensureHostPermission(url))) {
    addSiteStatus.textContent = `Chrome did not grant access to ${url}, so it cannot be read.`;
    return;
  }
  addSiteStatus.textContent = "Reading…";
  const response = await send({ type: "detect-adapter", url });
  if (response.type === "error") {
    addSiteStatus.textContent = response.message;
    return;
  }
  if (response.type !== "detected") return;

  if (response.candidates.length === 0) {
    /*
     * The deterministic proposer is the answer whenever it has one. This is the
     * second answer, for the pages it cannot read — and it runs only here, on a
     * page the student pasted, never in the sync loop.
     *
     * The status line is written *after* it, from what it did. It used to be
     * written before: "Nothing found on that page", then "Asking the on-device
     * model…", and then, whatever the model did, the generic sentence about
     * tables was the only thing left on screen. Sushi ran exactly that on ECE
     * 411 and could not tell from the page whether the model had answered, been
     * refused, or never existed (worker rule 2: what the UI asserts has to come
     * from an attempt that happened).
     */
    const outcome = await proposeWithModel(response, response.url, response.courseCodeGuess);
    // This page's console, not the worker's (UI rule 1): the one line that says
    // which branch ran, with the validator's reason when there was one.
    console.info("[author] on-device model:", outcome);
    addSiteStatus.textContent = modelStatusLine(outcome);
    if (outcome.state !== "proposed") {
      // Why the search itself found nothing, under what the model did — both
      // facts, in the order they happened.
      addSiteResult.append(el("p", response.reason ?? "", "muted"));
    }
    return;
  }
  // The sentence is `core/detect.ts`'s, because it is a fact about what ran —
  // and because said here it said "table" about a list (worker rule 1).
  addSiteStatus.textContent = candidatesFoundLine(response.candidates);
  renderCandidates(response.candidates, response.url, response.courseCodeGuess);
});

/**
 * The second answer: Chrome's on-device model, when there is no first answer.
 *
 * Every branch out of here is deliberate, because the common case on a student
 * laptop is "no model at all" — the Prompt API needs 22GB of free disk and
 * either a 4GB GPU or 16GB of RAM. When it is missing, or Chrome reports it
 * unavailable, this returns having done nothing and the page reads exactly as
 * it did before this existed: "Nothing found on that page", and the sentence
 * saying which of the three dead ends it was.
 *
 * Nothing it produces is saved. The proposal is run through the real runner
 * against the page that was just fetched, and what the student sees is the rows
 * that came out — the same preview, the same "Use this one", the same registry
 * entry. A model that invents a selector produces no rows and reaches nobody.
 */
async function proposeWithModel(
  /** The whole `detected` message: whether it carries `html` is itself a fact. */
  detected: unknown,
  url: string,
  codeGuess?: string,
): Promise<ModelOutcome> {
  if (!("LanguageModel" in self)) return { state: "unavailable" };

  let availability: LanguageModelAvailability;
  try {
    availability = await LanguageModel.availability();
  } catch {
    // An API that is present and throws is an API that is not there.
    return { state: "unavailable" };
  }
  // Said out loud rather than silently skipped: "nothing found" and "there is a
  // thing that could have tried and has not been downloaded" are different
  // answers, and only one of them is worth coming back for.
  if (availability === "downloadable") return { state: "downloadable" };
  if (availability === "downloading") return { state: "downloading" };
  if (availability !== "available") return { state: "unavailable" };

  // Not `if (!html)`: an absent field, a 2MB page and an empty body are three
  // different answers and only `core/author.ts` decides which (worker rule 8).
  const page = pageForAuthoring(detected);
  if (!page.ok) return page.outcome;
  const html = page.html;

  addSiteStatus.textContent = "Asking the on-device model…";
  const doc = new DOMParser().parseFromString(html, "text/html");
  // The inventory is what the model is allowed to answer with, so it is written
  // before the summary and measured with it: if the two together do not fit,
  // the summary is what gets cut. A model shown a short summary and a correct
  // list of selectors can still answer; one shown the whole page and no list
  // invents `#schedule .event`, which is the run this came from.
  // One instant for the whole run: the inventory's "carries a date" counts are
  // measured with the runner's reader, and a second `new Date()` at the
  // `authorAdapter` call below would let the list shown to the model and the
  // validation of its answer disagree about which year a bare `9/7` is in.
  const reference = new Date().toISOString();
  const structures = repeatedStructures(doc, SITE_TIMEZONE, reference);
  // The system half is fixed, so its size comes out of the same window the page
  // summary has to fit in; `buildPrompt` with an empty page measures it.
  const empty = buildPrompt("", url, undefined, structures);
  // The retry suffix is part of the overhead, not a surprise on attempt 2: a
  // budget measured before any rejection exists is a budget that does not know
  // how long the rejection will be (`MAX_RETRY_REASON_CHARS` bounds it).
  const overhead = empty.system.length + empty.user.length + RETRY_SUFFIX_CHARS;

  const create = (): Promise<LanguageModelSession> =>
    LanguageModel.create({
      initialPrompts: [{ role: "system", content: empty.system }],
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });

  let pristine: LanguageModelSession | undefined;
  /** Said once, not once per attempt. */
  let logged = false;
  /** 1-based, and the same number `onAttempt` reports (worker rule 5). */
  let asked = 0;
  try {
    pristine = await create();
    const budget = skeletonBudgetChars(pristine.contextWindow, overhead);
    // The summary and the inventory are the two halves of what the model is
    // shown, and the enum size is the number that says whether the answer it
    // was allowed to give was even on the list. Both here, before attempt 1,
    // so the console explains an outcome without a second round trip.
    const skeleton = skeletonise(doc, budget, structures);
    console.info(
      `[author] window ${pristine.contextWindow} tokens, summary ${skeleton.length}/${budget} chars, ` +
        `rows enum ${structures.length} selectors: ${structures.map((s) => s.selector).join(" | ")}`,
    );
    const outcome = await authorAdapter(
      // The schema `authorAdapter` hands in, not one built here: it carries the
      // enum of *this page's* row selectors, and a second copy built in the
      // page would be the unconstrained one — two spellings of one decision,
      // with the constrained decode silently switched off (mutation rule 3).
      async (text, schema) => {
        /*
         * One fresh session per attempt, cloned from the pristine one.
         *
         * A `LanguageModel` session keeps its history, so prompting the same
         * one again put the whole of `base` — skeleton plus inventory — on top
         * of attempt 1's prompt *and* attempt 1's answer. `skeletonBudgetChars`
         * sizes the summary for an empty window, so attempt 2 was roughly twice
         * the budget: Chrome answered the second prompt with a throw, which
         * reached Sushi as "An unknown error occurred: kErrorUnknown". The
         * first live run survived three attempts only because that page's
         * summary happened to fit twice.
         *
         * The budget is the reason, and there is a second one: a retry that
         * could see its own previous answer is a retry tempted to repeat it,
         * when what it was asked for is a different answer. `clone()` copies
         * the initial prompts — the system half — and nothing else.
         */
        /*
         * `clone()` where Chrome has it, a whole new session where it does not.
         *
         * Both branches logged (worker rule 5): the two are the same *prompt*
         * and a different cost, and if a build turns up without `clone` the
         * console says so in the same place as everything else — rather than
         * spending a round trip of Sushi's time on "clone is not a function".
         */
        const cloneable = typeof pristine!.clone === "function";
        if (!logged) {
          console.info(
            cloneable
              ? "[author] fresh session per attempt via clone()"
              : "[author] this build has no clone(); creating a session per attempt instead",
          );
          logged = true;
        }
        const session = cloneable ? await pristine!.clone() : await create();
        asked += 1;
        const attempt = asked;
        try {
          return await session.prompt(text, { responseConstraint: schema });
        } finally {
          // Read before `destroy()`, and guarded: these are optional members of
          // the Prompt API and a build without them must not throw here, in the
          // one path whose whole job is to explain a throw. Numbered, because
          // "which attempt overflowed the window" is the question this answers
          // and an unnumbered line cannot.
          if (typeof session.inputUsage === "number" && typeof session.inputQuota === "number") {
            console.info(
              `[author] attempt ${attempt} input usage ${session.inputUsage}/${session.inputQuota} tokens`,
            );
          }
          session.destroy();
        }
      },
      doc,
      url,
      SITE_TIMEZONE,
      reference,
      skeleton,
      {
        structures,
        // UI rule 1 and worker rule 5: this page's console, every attempt,
        // both branches. "Nothing happened" and "three answers were refused
        // for three different reasons" looked identical from the status line.
        // `attemptLogLine` decides the wording in core, where a test can pin
        // it; this page keeps the `console` call.
        onAttempt: (info) => console.info(attemptLogLine(info)),
      },
    );
    if (outcome.ok) renderCandidates([outcome.candidate], url, codeGuess);
    return modelOutcomeFor(outcome);
  } catch (err) {
    // UI rule 2: a rejection with no catch is invisible in the page *and* in
    // the worker's console, and this branch is the one nobody will have devtools
    // open for.
    return { state: "failed", message: err instanceof Error ? err.message : String(err) };
  } finally {
    pristine?.destroy();
  }
}

function renderCandidates(candidates: Candidate[], url: string, codeGuess?: string): void {
  addSiteResult.replaceChildren();

  const code = el("input") as HTMLInputElement;
  code.type = "text";
  code.value = codeGuess ?? "";
  code.placeholder = "CS225";
  code.id = "add-site-code";
  const codeRow = el("p", undefined, "muted");
  const codeLabel = el("label", "Course code ");
  codeLabel.htmlFor = code.id;
  codeRow.append(codeLabel, code);

  /*
   * What the rows on this page *are*, for the whole page.
   *
   * A course site splits by page — ECE 411 keeps its MPs on `assignments.html`
   * and its two midterms on `syllabus.html` — and `examBoard` filters on
   * `kind === "exam"`, so a student who adds the syllabus page without this
   * gets two midterms filed as homework and an Exams tab that stays empty. The
   * page is what knows; the parser cannot tell an exam row from an assignment
   * row by looking at it.
   *
   * It is a picker rather than part of the proposal because `kind` changes no
   * selector and no instant: the preview below is the same rows either way, so
   * changing it after the validation cannot make the saved entry differ from
   * the one that was checked.
   */
  const kind = el("select") as HTMLSelectElement;
  kind.id = "add-site-kind";
  for (const [value, label] of [
    ["assignment", "assignments"],
    ["exam", "exams"],
    ["quiz", "quizzes"],
    ["event", "events"],
    ["other", "something else"],
  ] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    kind.append(option);
  }
  kind.value = candidates[0]?.kind ?? "assignment";
  const kindLabel = el("label", " These rows are ");
  kindLabel.htmlFor = kind.id;
  codeRow.append(kindLabel, kind);
  addSiteResult.append(codeRow);

  for (const candidate of candidates) {
    const box = el("div", undefined, "result");
    const heading = el(
      "h3",
      candidate.columns
        ? `${candidate.columns.title} · ${candidate.columns.due}`
        : `${candidate.rows} · ${candidate.dueLabel ?? candidate.due ?? ""}`,
    );
    box.append(heading);

    // The count, before the rows. "13 of 13" and "6 of 20" are different
    // answers and the second one means this page is not fully covered.
    box.append(
      el(
        "p",
        `${candidate.dated} of ${candidate.total} rows have a date this can read.`,
        candidate.dated === candidate.total ? "muted" : "verdict-needs_login",
      ),
    );

    const table = document.createElement("table");
    table.className = "preview";
    for (const row of candidate.sample) {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = row.title;
      const due = document.createElement("td");
      due.textContent = row.due;
      tr.append(name, due);
      table.append(tr);
    }
    box.append(table);

    const use = el("button", "Use this one");
    const status = el("span", "", "opt-note");
    use.addEventListener("click", async () => {
      const courseCode = code.value.trim().toUpperCase();
      if (!/^[A-Z]{2,4}\d{3}$/.test(courseCode)) {
        status.textContent = "Course code should look like CS225.";
        return;
      }
      use.disabled = true;
      status.textContent = "Saving…";
      const adapter = buildAdapter(candidate, url, courseCode, kind.value);
      // Three sends, every failure named, and the button comes back (UI rules
      // 2 and 4). `saveProposedAdapter` owns which of them counts as saved.
      const saved = await saveProposedAdapter(send, adapter);
      if (!saved.ok) {
        status.textContent = saved.message;
        use.disabled = false;
        return;
      }
      addSiteResult.replaceChildren();
      addSiteStatus.textContent = `${courseCode} added. Its deadlines appear after the next sync.`;
      await refreshOptions();
    });

    const share = el("button", "Copy for sharing");
    share.style.marginLeft = "8px";
    share.title =
      "Puts this entry on your clipboard. Send it to whoever maintains Illini Dash and " +
      "everyone in the course gets it, instead of each person adding it themselves.";
    share.addEventListener("click", async () => {
      const courseCode = code.value.trim().toUpperCase() || "COURSE";
      await navigator.clipboard.writeText(
        JSON.stringify(buildAdapter(candidate, url, courseCode, kind.value), null, 2),
      );
      status.textContent = "Copied. Send it over and everyone in the course gets it.";
    });

    const actions = el("p");
    actions.append(use, share, status);
    box.append(actions);
    addSiteResult.append(box);
  }
}

/**
 * The registry entry for a candidate the student approved.
 *
 * The decision itself is `adapterFromCandidate` in `core/detect.ts`, where a
 * test can reach it: it decides which of the validated fields survive into the
 * saved entry, and this page is one of the two files the suite cannot see.
 * This wrapper is the one thing that has to happen here — reading the clock.
 */
function buildAdapter(
  candidate: Candidate,
  url: string,
  courseCode: string,
  kind = "assignment",
): Record<string, unknown> & { id: string } {
  return adapterFromCandidate(candidate, url, courseCode, currentTermCode(new Date()), kind);
}


renderThemePanel();

/**
 * Redraw when the store changes underneath.
 *
 * The popup has had this since the calendar landed; this page never did, so a
 * sync finishing while Settings was open changed nothing on screen. Switching
 * a course site on showed "Checking…" and kept showing it — the read had
 * happened, the store said Connected, and the only way to find out was to
 * reload the page.
 *
 * Guarded on a focused control: `refreshOptions` replaces the switch you are
 * standing on, and having it move under the keyboard mid-interaction is worse
 * than a stale row for a second.
 */
chrome.storage?.onChanged?.addListener((changes, area) => {
  if (area !== "local" || !(STORAGE_KEY in changes)) return;
  const focused = document.activeElement;
  if (focused && focused !== document.body && document.querySelector(".rows")?.contains(focused)) {
    return;
  }
  void refreshOptions();
});

/**
 * And a source waiting on a login is re-checked when you come back.
 *
 * Settings is where a "Sign in" button sends you to another origin, so it has
 * the same hole the first-run screen had: signing in fixes the source somewhere
 * this extension cannot observe, nothing crosses back, and the row keeps saying
 * what it said before you left. `sourcesToRecheck` holds the rule and the
 * debounce; `trigger: "manual"` is deliberate, because a source in backoff is
 * exactly the one being re-checked here.
 */
let recheckInFlight = false;
document.addEventListener("visibilitychange", () => {
  if (document.hidden || recheckInFlight) return;
  recheckInFlight = true;
  void (async () => {
    try {
      const response = await send({ type: "get-state" });
      if (response.type !== "state") return;
      const due = sourcesToRecheck(response.sources ?? {}, Date.now());
      if (due.length === 0) return;
      console.log(`[illini-dash] back in Settings — re-checking ${due.join(", ")}`);
      await send({ type: "sync", trigger: "manual" });
      await refreshOptions();
    } finally {
      recheckInFlight = false;
    }
  })();
});

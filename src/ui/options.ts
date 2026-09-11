/**
 * Options page. Build step 2 only carries the Gate 0 spike (§10 step 2);
 * the real options UI is step 10.
 *
 * All source-derived text is inserted with textContent (§8.1).
 */

import { BUILD_ID } from "../build-info.js";
import {
  DEFAULT_THEME,
  THEMES,
  THEME_KEY,
  allThemeClasses,
  normalizeTheme,
  themeClass,
} from "../core/theme.js";
import { SITE_TIMEZONE, type Candidate } from "../core/detect.js";
import { currentTermCode } from "../core/registry.js";
import { normalizeOptionsState, staleWorkerNotice } from "../core/compat.js";
import { coursesUrl } from "../sources/canvas.js";
import { buildIcs } from "../core/ics.js";
import { MAX_POLL_MINUTES, MIN_POLL_MINUTES } from "../core/store.js";
import {
  isGrantedUpFront,
  originPattern,
  reportUrlFromHash,
  type CaptureResult,
} from "../capture.js";
import { displayState } from "../core/health.js";
import { probeMarkers } from "../core/markers.js";
import { scrubHtml } from "../core/scrub.js";
import type { Gate0Result } from "../gate0.js";
import { send } from "../messages.js";

/** Plain wording for a source's state; the raw enum is for the console. */
const STATE_WORDS: Record<string, string> = {
  ok: "read successfully",
  pending: "not checked yet",
  needs_login: "needs you to sign in",
  parse_error: "page was not what we expected",
  network_error: "could not be reached",
  disabled: "switched off",
};

const runButton = document.getElementById("run-gate0") as HTMLButtonElement;
const copyButton = document.getElementById("copy-gate0") as HTMLButtonElement;
const statusEl = document.getElementById("gate0-status")!;
const resultsEl = document.getElementById("gate0-results")!;

let lastResults: Gate0Result[] = [];

/* ---- Colour scheme ----
 * Read before the first paint, which is why it is in `localStorage` and not the
 * store: anything in the store costs a message to the service worker, and that
 * is a flash of the wrong colours on every single open.
 */
applyStoredTheme();

function applyStoredTheme(): void {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_KEY);
  } catch {
    /* A blocked storage accessor throws on read; the default is fine. */
  }
  const root = document.documentElement;
  root.classList.remove(...allThemeClasses());
  root.classList.add(themeClass(normalizeTheme(stored)));
}

/* ---- Build identity -------------------------------------------------------
 * Chrome reloads this page from disk but keeps the old service worker until the
 * extension is reloaded, so page and worker can disagree. Say so out loud.
 */
const buildInfo = document.getElementById("build-info")!;

void (async () => {
  try {
    const resp = await send({ type: "ping" });
    if (resp.type !== "pong") {
      buildInfo.textContent = `Service worker answered unexpectedly: ${JSON.stringify(resp)}`;
      buildInfo.className = "verdict-error";
      return;
    }
    if (resp.buildId === BUILD_ID) {
      buildInfo.textContent = `Service worker alive, build ${resp.buildId}.`;
      return;
    }
    buildInfo.textContent =
      `STALE SERVICE WORKER: this page is build ${BUILD_ID}, the worker is build ` +
      `${resp.buildId}. Open chrome://extensions and click Reload on the Illini Dash ` +
      `card before trusting anything below.`;
    buildInfo.className = "verdict-error";
  } catch (err) {
    buildInfo.textContent = `Service worker unreachable: ${
      err instanceof Error ? err.message : String(err)
    }`;
    buildInfo.className = "verdict-error";
  }
})();

/**
 * Reports fields an older worker did not send.
 *
 * Its own element rather than `buildInfo`, because the ping above writes that
 * one asynchronously and would race this into invisibility.
 */
let missingFieldsEl: HTMLElement | null = null;

function showMissingFields(missing: readonly string[]): void {
  if (missing.length === 0) {
    missingFieldsEl?.remove();
    missingFieldsEl = null;
    return;
  }
  if (!missingFieldsEl) {
    missingFieldsEl = document.createElement("p");
    missingFieldsEl.className = "verdict-error";
    buildInfo.after(missingFieldsEl);
  }
  missingFieldsEl.textContent = staleWorkerNotice(missing);
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
  button.textContent = preset.note ? `${preset.label} (${preset.note})` : preset.label;
  button.style.margin = "0 6px 6px 0";
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

function download(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoke on the next task so the download has taken the reference.
  setTimeout(() => URL.revokeObjectURL(url), 0);
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
  saveScrubbed.addEventListener("click", () => download(filename, scrubbed, mime));

  const saveRaw = document.createElement("button");
  saveRaw.textContent = "Download raw (do not commit)";
  saveRaw.style.marginLeft = "8px";
  saveRaw.addEventListener("click", () =>
    download(`RAW-DO-NOT-COMMIT-${filename}`, result.body, mime),
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

const SOURCE_NAMES: Record<string, string> = {
  canvas: "Canvas",
  gradescope: "Gradescope",
  prairielearn: "PrairieLearn",
  prairietest: "PrairieTest",
  smartphysics: "smartPhysics",
  site: "Course websites",
};

const SOURCE_LOGIN: Record<string, string> = {
  canvas: "https://canvas.illinois.edu/login",
  gradescope: "https://www.gradescope.com/login",
  prairielearn: "https://us.prairielearn.com/pl/",
  prairietest: "https://us.prairietest.com/pt/",
  smartphysics: "https://smart.physics.illinois.edu/",
};

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

function checkboxRow(
  labelText: string,
  checked: boolean,
  note: string,
  onChange: (checked: boolean) => void,
): HTMLElement {
  const row = el("div", undefined, "opt-row");
  const box = el("input");
  box.type = "checkbox";
  box.checked = checked;
  const id = `chk-${Math.random().toString(36).slice(2)}`;
  box.id = id;
  const label = el("label", labelText);
  label.htmlFor = id;
  box.addEventListener("change", () => onChange(box.checked));
  row.append(box, label, el("span", note, "opt-note"));
  return row;
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
    buildInfo.textContent =
      `The settings page could not finish drawing: ` +
      `${err instanceof Error ? err.message : String(err)}. ` +
      `Open chrome://extensions, click Reload on the Illini Dash card, and reopen this page. ` +
      `If it happens again, that message is the bug report.`;
    buildInfo.className = "verdict-error";
  }
}

async function renderOptions(): Promise<void> {
  const message = await send({ type: "get-options-state" });
  if (message.type !== "options-state") return;

  // Not `message` directly: an older worker does not send every field this
  // page reads, and TypeScript cannot know that (see core/compat.ts).
  const { state, missing } = normalizeOptionsState<typeof message>(message);
  showMissingFields(missing);

  document.getElementById("privacy")!.textContent = PRIVACY_TEXT;

  /* Sources */
  const sources = document.getElementById("sources")!;
  sources.replaceChildren();
  for (const [source, status] of Object.entries(state.sources)) {
    // §4.5 owns this source through the adapter list below, and a second
    // control with the same name is what sent the first live sync into a green
    // dot with nothing behind it: Sushi ticked "Course websites" here, which
    // enables the source, while every adapter stayed off. `set-adapter-enabled`
    // sets this flag anyway. Its health is rendered under Course websites.
    if (source === "site") continue;
    const row = checkboxRow(
      SOURCE_NAMES[source] ?? source,
      status.enabled,
      "",
      (enabled) => {
        void send({ type: "set-source-enabled", source: source as never, enabled }).then(
          refreshOptions,
        );
      },
    );
    // `displayState`, not `status.state`: a source that has never been attempted
    // has no result, and the stored value seeded before the first fetch used to
    // render as a healthy "ok" here too.
    const shown = displayState(status);
    const stateLabel = el("span", STATE_WORDS[shown] ?? shown, `opt-note state-${shown}`);
    if (status.lastError) stateLabel.title = status.lastError;
    row.append(stateLabel);
    if (shown === "needs_login" && SOURCE_LOGIN[source]) {
      const login = el("a", "log in");
      login.href = SOURCE_LOGIN[source]!;
      login.target = "_blank";
      login.className = "opt-note";
      row.append(login);
    }
    sources.append(row);
  }

  // The site source's state still has to be visible somewhere, or a failing
  // adapter loses its only signal (worker rule 2).
  const siteHealth = document.getElementById("site-health")!;
  siteHealth.replaceChildren();
  const siteStatus = state.sources.site;
  if (siteStatus) {
    const shown = displayState(siteStatus);
    const label = el("span", `Course websites — ${STATE_WORDS[shown] ?? shown}`, `state-${shown}`);
    if (siteStatus.lastError) label.title = siteStatus.lastError;
    siteHealth.append(label);
  }

  /* Courses (§8.2) */
  const courses = document.getElementById("courses")!;
  courses.replaceChildren();
  if (state.courses.length === 0) {
    courses.append(el("p", "No courses seen yet — sync first.", "muted"));
  }
  for (const course of state.courses) {
    courses.append(
      checkboxRow(
        course.label,
        !course.disabled,
        `${course.itemCount} item${course.itemCount === 1 ? "" : "s"} · ${course.sources.join(", ")}`,
        (enabled) => {
          void send({
            type: "set-course-disabled",
            course: course.key,
            disabled: !enabled,
          }).then(refreshOptions);
        },
      ),
    );
  }

  /* Course-site adapters (§4.5) */
  const adaptersEl = document.getElementById("adapters")!;
  const registryStatus = document.getElementById("registry-status")!;
  const adapterState = await send({ type: "get-adapters" });
  adaptersEl.replaceChildren();
  if (adapterState.type === "adapters") {
    registryStatus.textContent = adapterState.fetchedAt
      ? `List updated ${new Date(adapterState.fetchedAt).toLocaleString()}`
      : "List not fetched yet";
    // §4.5: adapters carry a term and expire; stale ones are hidden.
    const current = adapterState.adapters.filter((a) => a.currentTerm);
    if (current.length === 0) {
      adaptersEl.append(
        el(
          "p",
          "No course-site adapters available for this term yet. They are published " +
            "separately, so this list can fill in without updating the extension.",
          "muted",
        ),
      );
    }
    for (const adapter of current) {
      const row = checkboxRow(
        adapter.label,
        adapter.enabled && adapter.granted,
        `${adapter.courseCode} · ${new URL(adapter.url).hostname}`,
        (enabled) => {
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
              registryStatus.textContent = "Permission denied, so that site stays off.";
              return;
            }
            return send({ type: "set-adapter-enabled", adapterId: adapter.id, enabled }).then(
              (response) => {
                if (response.type === "error") registryStatus.textContent = response.message;
                else void refreshOptions();
              },
            );
          });
        },
      );
      if (adapter.enabled && !adapter.granted) {
        row.append(el("span", "permission missing", "opt-note state-needs_login"));
      }
      adaptersEl.append(row);
    }
  }

  /* Older courses — §4.1's term filter, made visible and reversible */
  const setAside = document.getElementById("set-aside")!;
  setAside.replaceChildren();
  if (state.setAsideCourses.length === 0) {
    setAside.append(el("p", "None — every Canvas course is in the current term.", "muted"));
  }
  for (const course of state.setAsideCourses) {
    const row = el("div", undefined, "opt-row");
    row.append(el("span", `${course.courseCode ?? ""} ${course.name}`.trim()));
    row.append(el("span", course.reason, "opt-note"));
    const keep = el("button", "Put back");
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
    const warning = el(
      "p",
      "Chrome is blocking notifications from Illini Dash, so none of these will reach you. " +
        "Turn them back on in Chrome's notification settings for this extension.",
      "verdict-error",
    );
    reminders.append(warning);
  }
  const testRow = el("p", "", "muted");
  const testButton = el("button", "Send a test reminder");
  const testResult = el("span", "", "opt-note");
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
  testRow.append(testButton, testResult);
  reminders.append(testRow);

  for (const lead of ["24h", "2h"] as const) {
    reminders.append(
      checkboxRow(
        lead === "24h" ? "24 hours before" : "2 hours before",
        state.settings.leadTimes.includes(lead),
        "",
        (checked) => {
          const leadTimes = checked
            ? [...new Set([...state.settings.leadTimes, lead])]
            : state.settings.leadTimes.filter((l) => l !== lead);
          void send({ type: "update-settings", settings: { leadTimes } }).then(refreshOptions);
        },
      ),
    );
  }
  reminders.append(
    checkboxRow(
      "Remind me about not-for-credit work",
      state.settings.remindNotForCredit,
      "Practice quizzes and surveys still appear in the list either way.",
      (remindNotForCredit) => {
        void send({ type: "update-settings", settings: { remindNotForCredit } }).then(
          refreshOptions,
        );
      },
    ),
  );
  reminders.append(
    checkboxRow(
      "Hide submitted and graded work",
      state.settings.hideSubmitted,
      "",
      (hideSubmitted) => {
        void send({ type: "update-settings", settings: { hideSubmitted } }).then(refreshOptions);
      },
    ),
  );

  const quiet = state.settings.quietHours;
  const quietRow = checkboxRow("Quiet hours", quiet !== null, "", (enabled) => {
    void send({
      type: "update-settings",
      settings: { quietHours: enabled ? { start: 23, end: 8 } : null },
    }).then(refreshOptions);
  });
  if (quiet) {
    const from = el("input");
    from.type = "number";
    from.min = "0";
    from.max = "23";
    from.value = String(quiet.start);
    const to = el("input");
    to.type = "number";
    to.min = "0";
    to.max = "23";
    to.value = String(quiet.end);
    const push = () => {
      // `Number("")` is 0, which is a legitimate hour, so a cleared box would
      // silently become midnight and narrow the window rather than being
      // rejected. `<input min max>` is decorative outside a form, so check here.
      const hour = (input: HTMLInputElement): number | undefined => {
        const value = input.value.trim();
        if (value === "") return undefined;
        const n = Number(value);
        return Number.isInteger(n) && n >= 0 && n <= 23 ? n : undefined;
      };
      const start = hour(from);
      const end = hour(to);
      if (start === undefined || end === undefined) {
        dataStatus().textContent = "Quiet hours must be two hours between 0 and 23.";
        void refreshOptions();
        return;
      }
      void send({ type: "update-settings", settings: { quietHours: { start, end } } }).then(
        refreshOptions,
      );
    };
    from.addEventListener("change", push);
    to.addEventListener("change", push);
    quietRow.append(el("span", "from", "opt-note"), from, el("span", "to", "opt-note"), to);
  }
  reminders.append(quietRow);

  const pollRow = el("div", undefined, "opt-row");
  const pollLabel = el("label", "Check every");
  const poll = el("input");
  poll.type = "number";
  poll.min = String(MIN_POLL_MINUTES);
  poll.max = String(MAX_POLL_MINUTES);
  poll.value = String(state.settings.pollMinutes);
  poll.addEventListener("change", () => {
    void send({
      type: "update-settings",
      settings: { pollMinutes: Number(poll.value) },
    }).then(refreshOptions);
  });
  pollRow.append(
    pollLabel,
    poll,
    el("span", `minutes (${MIN_POLL_MINUTES}–${MAX_POLL_MINUTES})`, "opt-note"),
  );
  reminders.append(pollRow);

  /* Hidden items (§8.1's Hide, undoable) */
  const hidden = document.getElementById("hidden")!;
  hidden.replaceChildren();
  if (state.hiddenItems.length === 0) {
    hidden.append(el("p", "Nothing hidden.", "muted"));
  }
  for (const item of state.hiddenItems) {
    const row = el("div", undefined, "opt-row");
    row.append(el("span", `${item.courseLabel} — ${item.title}`));
    const unhide = el("button", "Unhide");
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
  if (state.doneItems.length === 0) {
    done.append(el("p", "Nothing ticked off.", "muted"));
  }
  for (const item of state.doneItems) {
    const row = el("div", undefined, "opt-row");
    row.append(el("span", `${item.courseLabel} — ${item.title}`));
    const undo = el("button", "Not done");
    undo.addEventListener("click", () => {
      void send({ type: "override", action: { kind: "undone", itemId: item.id } }).then(
        refreshOptions,
      );
    });
    row.append(undo);
    done.append(row);
  }
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
  const visible = state.items.filter((item) => !item.hidden);
  download("illini-dash.ics", buildIcs(visible), "text/calendar");
  dataStatus().textContent = `Exported ${visible.length} items. This is a one-time copy, not a subscription.`;
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
  download("illini-dash-export.json", response.json, "application/json");
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
    download(
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
    addSiteStatus.textContent = "Nothing found on that page.";
    const why = el("p", response.reason ?? "", "muted");
    addSiteResult.append(why);
    return;
  }
  addSiteStatus.textContent =
    response.candidates.length === 1
      ? "Found one table that looks like a schedule."
      : `Found ${response.candidates.length} tables that could be the schedule.`;
  renderCandidates(response.candidates, response.url, response.courseCodeGuess);
});

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
  addSiteResult.append(codeRow);

  for (const candidate of candidates) {
    const box = el("div", undefined, "result");
    const heading = el("h3", `${candidate.columns.title} · ${candidate.columns.due}`);
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
      const adapter = buildAdapter(candidate, url, courseCode);
      const saved = await send({ type: "add-local-adapter", adapter });
      if (saved.type === "error") {
        status.textContent = saved.message;
        use.disabled = false;
        return;
      }
      await send({ type: "set-adapter-enabled", adapterId: adapter.id, enabled: true });
      await send({ type: "sync", trigger: "manual" });
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
        JSON.stringify(buildAdapter(candidate, url, courseCode), null, 2),
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
 * `hostPattern` is derived from the URL rather than asked for, because the
 * validator requires it to be exactly the URL's own host — a wildcard would be
 * a prompt that covers every illinois.edu site at once, and a later edit could
 * then repoint the adapter anywhere under it with no second prompt.
 */
function buildAdapter(
  candidate: Candidate,
  url: string,
  courseCode: string,
): Record<string, unknown> & { id: string } {
  const host = new URL(url).origin;
  const term = currentTermCode(new Date());
  return {
    id: `${courseCode.toLowerCase()}-${term}-local`,
    label: `${courseCode} course site`,
    courseCode,
    term,
    url,
    hostPattern: `${host}/*`,
    rows: candidate.rows,
    columns: candidate.columns,
    // Required by the schema and the fallback when a header is missing at
    // parse time; the named columns are what actually resolve.
    title: "td:nth-child(1)",
    due: "td:nth-child(2)",
    dateFormat: candidate.dateFormat,
    timezone: SITE_TIMEZONE,
    minExtensionVersion: "0.1.0",
  };
}


/* -------------------------------------------------------------------------- */
/* Appearance                                                                  */
/* -------------------------------------------------------------------------- */

function renderThemes(): void {
  const host = document.getElementById("themes");
  if (!host) return;
  let current: string | null = null;
  try {
    current = window.localStorage.getItem(THEME_KEY);
  } catch {
    /* Default it is. */
  }
  const chosen = normalizeTheme(current);

  host.replaceChildren();
  for (const theme of THEMES) {
    const row = el("div", undefined, "opt-row");
    const radio = el("input") as HTMLInputElement;
    radio.type = "radio";
    radio.name = "theme";
    radio.id = `theme-${theme.name}`;
    radio.checked = theme.name === chosen;
    radio.addEventListener("change", () => {
      try {
        window.localStorage.setItem(THEME_KEY, theme.name);
      } catch {
        /* Nothing to do: the choice simply will not persist. */
      }
      // Applied here rather than on reload, so the page recolours under the
      // click. A theme you have to reload to see is one nobody tries twice.
      document.documentElement.classList.remove(...allThemeClasses());
      document.documentElement.classList.add(themeClass(theme.name));
    });
    const label = el("label", theme.label);
    label.htmlFor = radio.id;
    row.append(radio, label, el("span", theme.hint, "opt-note"));
    host.append(row);
  }
  void DEFAULT_THEME;
}

renderThemes();

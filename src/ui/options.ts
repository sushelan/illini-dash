/**
 * Options page. Build step 2 only carries the Gate 0 spike (§10 step 2);
 * the real options UI is step 10.
 *
 * All source-derived text is inserted with textContent (§8.1).
 */

import { BUILD_ID } from "../build-info.js";
import { buildIcs } from "../core/ics.js";
import { MAX_POLL_MINUTES, MIN_POLL_MINUTES } from "../core/store.js";
import { isGrantedUpFront, originPattern, type CaptureResult } from "../capture.js";
import { probeMarkers } from "../core/markers.js";
import { scrubHtml } from "../core/scrub.js";
import type { Gate0Result } from "../gate0.js";
import { send } from "../messages.js";

const runButton = document.getElementById("run-gate0") as HTMLButtonElement;
const copyButton = document.getElementById("copy-gate0") as HTMLButtonElement;
const statusEl = document.getElementById("gate0-status")!;
const resultsEl = document.getElementById("gate0-results")!;

let lastResults: Gate0Result[] = [];

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
    url: "https://canvas.illinois.edu/api/v1/courses?enrollment_state=active&per_page=100",
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
  site: "Course websites",
};

const SOURCE_LOGIN: Record<string, string> = {
  canvas: "https://canvas.illinois.edu/login",
  gradescope: "https://www.gradescope.com/login",
  prairielearn: "https://us.prairielearn.com/pl/",
  prairietest: "https://us.prairietest.com/pt/",
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

async function refreshOptions(): Promise<void> {
  const state = await send({ type: "get-options-state" });
  if (state.type !== "options-state") return;

  document.getElementById("privacy")!.textContent = PRIVACY_TEXT;

  /* Sources */
  const sources = document.getElementById("sources")!;
  sources.replaceChildren();
  for (const [source, status] of Object.entries(state.sources)) {
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
    const stateLabel = el("span", status.enabled ? status.state : "disabled", `opt-note state-${status.enabled ? status.state : "disabled"}`);
    if (status.lastError) stateLabel.title = status.lastError;
    row.append(stateLabel);
    if (status.state === "needs_login" && SOURCE_LOGIN[source]) {
      const login = el("a", "log in");
      login.href = SOURCE_LOGIN[source]!;
      login.target = "_blank";
      login.className = "opt-note";
      row.append(login);
    }
    sources.append(row);
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

  /* Reminders (§7, §8.2) */
  const reminders = document.getElementById("reminders")!;
  reminders.replaceChildren();
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

document.getElementById("export")!.addEventListener("click", async () => {
  const response = await send({ type: "export" });
  if (response.type !== "export") return;
  download("illini-dash-export.json", response.json, "application/json");
  dataStatus().textContent = "Exported.";
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

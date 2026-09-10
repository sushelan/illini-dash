/**
 * Options page. Build step 2 only carries the Gate 0 spike (§10 step 2);
 * the real options UI is step 10.
 *
 * All source-derived text is inserted with textContent (§8.1).
 */

import { BUILD_ID } from "../build-info.js";
import type { CaptureResult } from "../capture.js";
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
      `${resp.buildId}. Open chrome://extensions and click Reload on the Illini Due ` +
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

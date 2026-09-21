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
  candidateNotes,
  candidatesFoundLine,
  locatorDescription,
  showMoreLabel,
  shownCandidates,
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
import { currentTermCode, emptyCourseGroup, groupHasCourse } from "../core/registry.js";
import { el, stateChip } from "./options/dom.js";
import {
  adapterPageName,
  courseIsDrawn,
  courseRow,
  isLocalAdapter,
  renderCourseSites,
  UNDO_CLASS,
  type AdapterEntry,
  type CourseSiteActions,
} from "./options/course-sites.js";
import { normalizeOptionsState, staleWorkerNotice } from "../core/compat.js";
import { isDevHash, normalizePageUrl } from "../core/page-url.js";
import {
  CAMPUSWIRE_MATCH,
  describeObserver,
  type ObserverFacts,
} from "../core/campuswire.js";
import {
  describePiazza,
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
import { send, type Response, type TidyItem } from "../messages.js";
import { trashable } from "../core/manual.js";

const runButton = document.getElementById("run-gate0") as HTMLButtonElement;
const copyButton = document.getElementById("copy-gate0") as HTMLButtonElement;
const statusEl = document.getElementById("gate0-status")!;
const resultsEl = document.getElementById("gate0-results")!;

let lastResults: Gate0Result[] = [];

/* Before the first paint. See src/ui/theme-panel.ts. */
applyStoredTheme();
document.getElementById("back")?.replaceChildren(icon("book"), document.createTextNode("Illini Dash"));

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
  const typed = captureUrl.value.trim();
  if (!typed) {
    captureStatus.textContent = "Enter a URL first.";
    return;
  }
  // Before the permission, not after it (I04): text that is not an address
  // makes `ensureHostPermission` return false without ever asking Chrome, and
  // every sentence past this point would blame Chrome for the refusal.
  const address = normalizePageUrl(typed);
  if (!address.ok) {
    captureStatus.textContent = address.reason;
    return;
  }
  const url = address.url;
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

/* ---- Piazza and Campuswire ----------------------------------------------
 *
 * Two sources that are drawn as sources.
 *
 * Until 2026-09-19 each had its own hand-built block: the chip's words came
 * from `describeObserver` / `describePiazza`, its colour from `piazzaChipState`
 * for one of them and from the literal "disabled" for the other, and neither
 * row could say "read successfully" in the vocabulary the six rows above it
 * use. So a Campuswire that was working and a Campuswire that was off were the
 * same grey, and the page had two dialects for one question.
 *
 * `core/observer-ui.ts`'s `observerRows` derives the popup's version of this and
 * is not edited from here. It could not serve this row as it stands: its tone is
 * never `ok`, so it cannot express "I read it, and it was fine" — the whole of
 * what was asked for — and it knows nothing about the host permission. The state
 * is therefore derived below from the same `ObserverState` fields it reads, into
 * the sources' own vocabulary, and the *words* inside the chip still come from
 * the two describe functions the suite already pins.
 */

interface ObserverSpec {
  id: "campuswire" | "piazza";
  name: string;
  hint: string;
  /** The optional host permission the row cannot read anything without (§2.3). */
  match: string;
  /** What the chip's tooltip says this source actually does. */
  title: string;
  /** Where a student who has to sign in elsewhere is sent. */
  loginUrl?: string;
}

const OBSERVERS: readonly ObserverSpec[] = [
  {
    id: "campuswire",
    name: "Campuswire",
    match: CAMPUSWIRE_MATCH,
    // The row says what it reads; `title` keeps the longer sentence for a hover
    // (2026-09-20, "make the settings less text heavy").
    hint: "Reads the class feeds you open. Nothing is sent, and no post is stored.",
    title: "Illini Dash reads a Campuswire class feed only while you have it open.",
  },
  {
    id: "piazza",
    name: "Piazza",
    match: PIAZZA_MATCH,
    loginUrl: PIAZZA_LOGIN_URL,
    hint: "Reads your classes' announcements on each sync. Nothing is posted or stored.",
    title: "Illini Dash reads your Piazza class feeds in the background, on each sync.",
  },
];

/**
 * Whether the optional host permission behind a row has actually been granted.
 *
 * Asked rather than assumed. The switch is in our own state and the permission
 * is Chrome's: a student who revokes the host in chrome://extensions leaves the
 * switch on, and the row then reported "nothing read yet" for ever — a pending
 * state for a source that can never read anything again.
 *
 * A throw here is not a finding about the source, and a render function must
 * never reject into a console nobody has open (worker rule 8), so it reads as
 * granted and the row falls back to what the stored facts say.
 */
async function hasOrigin(match: string): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: [match] });
  } catch {
    return true;
  }
}

/**
 * The state to show for an observer, in the same words as a fetched source.
 *
 * Worker rule 2 decides every branch. `ok` is returned only where something has
 * actually been read — a Piazza attempt that happened, a Campuswire page that
 * was seen — so a source the student has just switched on is `pending` and
 * never green. A stored `ok` with no `lastAttemptAt` is not proof either: it is
 * what a seed or an older build writes, which is exactly the defect
 * `displayState` exists for one row up.
 */
function observerState(
  spec: ObserverSpec,
  facts: ObserverFacts | undefined,
  granted: boolean,
): string {
  if (facts?.enabled !== true) return "disabled";
  if (!granted) return "needs_permission";
  if (spec.id === "campuswire") return facts.lastObservedAt === undefined ? "pending" : "ok";
  const piazza = facts as PiazzaFacts;
  if (piazza.state === "needs_login") return "needs_login";
  if (piazza.state === "error") return "parse_error";
  return piazza.state === "ok" && piazza.lastAttemptAt !== undefined ? "ok" : "pending";
}

/** The "On · …" tail of a describe line — the facts, without its own state word. */
function observerDetail(
  spec: ObserverSpec,
  facts: ObserverFacts | undefined,
  now: Date,
): string | undefined {
  const line =
    spec.id === "piazza"
      ? describePiazza(facts as PiazzaFacts | undefined, now)
      : describeObserver(facts, now);
  return line.startsWith("On \u00b7 ") ? line.slice(5) : undefined;
}

/**
 * The chip's text: the state word from the family, the facts from the describe
 * functions.
 *
 * Two words are the observers' own. "Permission needed" has no equivalent among
 * the fetched sources, which are granted up front. And Campuswire is not
 * *checking* anything while it waits — it reads a feed the student opens, so
 * `STATE_WORD.pending`'s "Checking…" would claim an activity that is not
 * happening, which is the same lie as a green dot over a source that never
 * fetched.
 */
function observerChipText(
  spec: ObserverSpec,
  shown: string,
  facts: ObserverFacts | undefined,
  now: Date,
): string {
  const word =
    shown === "needs_permission"
      ? "Permission needed"
      : shown === "pending" && spec.id === "campuswire"
        ? "Waiting for a feed"
        : (STATE_WORD[shown] ?? shown);
  /*
   * Only a state that *is* about reading carries the reading facts. With the
   * permission revoked the same line read "Permission needed · last read
   * 11:14 AM · 3 posts" — a state word and a detail that contradict each
   * other, and the half a student believes is the cheerful one.
   */
  const detail = shown === "ok" || shown === "pending" ? observerDetail(spec, facts, now) : undefined;
  // "nothing read yet" is what both pending words already say.
  return detail === undefined || detail === "nothing read yet" ? word : `${word} \u00b7 ${detail}`;
}

/**
 * One observer row: the sources' switch, the sources' chip, one button.
 *
 * The button is the point of the two states that need a person. `needs_login`
 * with nothing to press is the defect this project has hit more than once, and
 * a missing permission that reports itself as a failure sends a student to look
 * for a bug instead of at a Chrome prompt.
 */
async function observerRow(
  spec: ObserverSpec,
  facts: ObserverFacts | undefined,
  missing: readonly string[],
  now: Date,
): Promise<HTMLElement> {
  const unavailable = missing.includes("observers") || missing.includes(`observers.${spec.id}`);
  const granted = await hasOrigin(spec.match);
  const shown = unavailable ? "pending" : observerState(spec, facts, granted);

  /*
   * Held as variables rather than looked up by class when the switch is used.
   * Three redraw guards in the popup asked for `.menu` while the class was
   * `menu-surface` and were dead from the day they were written (UI rule 7); a
   * reference cannot be misspelled.
   */
  const chip = stateChip(shown, undefined, spec.title);
  chip.textContent = observerChipText(spec, shown, facts, now);
  const lastError = (facts as PiazzaFacts | undefined)?.lastError;
  if (lastError !== undefined) chip.title = lastError;

  const row = switchRow({
    name: spec.name,
    hint: spec.hint,
    checked: facts?.enabled === true,
    onChange: (enabled) => {
      const box = row.querySelector("input");
      // The control says it is doing something (UI rule 4): this round trip
      // includes a permission prompt and a first read, and without this a
      // denied prompt and a click that never ran look identical.
      if (box) box.disabled = true;
      // Working, not broken: the tone goes back to neutral while the round trip
      // is in flight, or a failing row keeps its red under the word "Asking".
      chip.className = "chip-base chip-state";
      chip.textContent = enabled ? "Asking\u2026" : "Turning off\u2026";
      const restore = (text: string): void => {
        if (box) {
          box.disabled = false;
          box.checked = facts?.enabled === true;
        }
        // The chip goes back to the state it was drawn in, tone and all.
        chip.className = stateChip(shown).className;
        chip.textContent = observerChipText(spec, shown, facts, now);
        // On the row, not in the page's status line: `#gate0-status` is in
        // another section entirely, and a report that lands where the error did
        // not happen is not a channel (UI rule 3).
        hint.textContent = text;
      };
      // Requested here, synchronously inside the handler: a user gesture does
      // not survive an await, so the worker cannot ask for this.
      const asked = enabled
        ? chrome.permissions.request({ origins: [spec.match] })
        : Promise.resolve(true);
      void asked
        .then((ok) => {
          if (!ok) {
            restore(`Permission denied, so ${spec.name} stays off.`);
            return undefined;
          }
          return send({ type: "set-observer-enabled", observer: spec.id, enabled }).then(
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
  const hint = row.querySelector(".srow2--hint") ?? el("span", undefined, "srow2--hint");
  row.append(chip);

  if (unavailable) {
    /*
     * The worker is older than this page and has no state for this observer.
     * Without this the row says "Off", which is the student's own switch, and
     * the click would grant the host permission and only then reach a worker
     * that throws on it. The banner at the top says it too; this says it where
     * the control is (UI rule 3).
     */
    const box = row.querySelector("input");
    if (box) box.disabled = true;
    chip.textContent = "Reload needed";
    hint.textContent =
      `The background part of Illini Dash is still running an older version that has no ` +
      `${spec.name} support. Open chrome://extensions, click Reload on the Illini Dash ` +
      `card, then reopen this page.`;
    return row;
  }

  if (shown === "needs_permission") {
    const allow = el("button", "Allow", "btn btn-secondary btn-sm");
    allow.addEventListener("click", () => {
      allow.disabled = true;
      allow.textContent = "Asking\u2026";
      const back = (text: string): void => {
        allow.disabled = false;
        allow.textContent = "Allow";
        hint.textContent = text;
      };
      // Synchronously inside the click, for the same reason as the switch.
      void chrome.permissions
        .request({ origins: [spec.match] })
        .then((ok) => {
          if (!ok) back(`Permission denied, so ${spec.name} cannot be read.`);
          else void refreshOptions();
        })
        .catch((err: unknown) => back(err instanceof Error ? err.message : String(err)));
    });
    row.append(allow);
  } else if (shown === "needs_login" && spec.loginUrl !== undefined) {
    const url = spec.loginUrl;
    const login = el("button", "Sign in", "btn btn-secondary btn-sm");
    login.addEventListener("click", () => chrome.tabs.create({ url }));
    row.append(login);
  }
  return row;
}

/* ---- Course-site adapters, one row per course ----------------------------
 *
 * The row itself is `ui/options/course-sites.ts`, which draws it and owns the
 * decisions in it. What stays here is everything that needs the worker: the
 * undo window, and the three actions a control on a row calls.
 */

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
  const line = el("p", undefined, UNDO_CLASS);
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

/**
 * What a control on a course row does.
 *
 * Every one of these needs the worker, Chrome's permission API, or both, which
 * is the line this module is split on: the row is a document, and everything
 * that can only happen in an extension is here.
 *
 * Each is handed the row's own `note`, so what it has to say lands on the
 * course it happened to rather than in a line under a list that can be a
 * screenful below the switch that was pressed (UI rule 3).
 */
const courseSiteActions: CourseSiteActions = {
  toggle(adapter, enabled, note, control) {
    // Requested here, synchronously in the handler: a user gesture does not
    // survive an await, so asking from the service worker — as this first did
    // — meant Chrome refused the prompt and the checkbox silently reverted
    // with no diagnostic.
    const asked = enabled
      ? chrome.permissions.request({ origins: [adapter.hostPattern] })
      : Promise.resolve(true);
    void asked
      .then((granted) => {
        if (!granted) {
          // A refusal is not a state change, so nothing is redrawn — and the
          // control is put back by hand, or the switch shows an "on" that is
          // not on and the sentence beside it reads as a transient.
          control.checked = !enabled;
          note("Permission denied, so that site stays off.");
          return;
        }
        return send({ type: "set-adapter-enabled", adapterId: adapter.id, enabled }).then(
          (response) => {
            if (response.type === "error") {
              control.checked = !enabled;
              note(response.message);
            } else void refreshOptions();
          },
        );
      })
      .catch((err: unknown) => {
        // Every `send` and every `chrome.*` promise from a page needs this
        // (UI rule 2): a rejection with no catch is invisible in the UI *and*
        // in the worker's console.
        control.checked = !enabled;
        note(err instanceof Error ? err.message : String(err));
      });
  },
  allow(adapter, note) {
    void chrome.permissions
      .request({ origins: [adapter.hostPattern] })
      .then((granted) => {
        if (granted) return refreshOptions();
        note("Permission denied, so that site stays off.");
        return undefined;
      })
      .catch((err: unknown) => note(err instanceof Error ? err.message : String(err)));
  },
  remove(adapter, note, button) {
    const restore = (text: string): void => {
      button.disabled = false;
      button.textContent = "Remove";
      note(text);
    };
    void send({ type: "remove-local-adapter", adapterId: adapter.id })
      .then((response) => {
        if (response.type === "error") {
          restore(response.message);
          return undefined;
        }
        noteRemoval(adapter);
        return refreshOptions();
      })
      .catch((err: unknown) => restore(err instanceof Error ? err.message : String(err)));
  },
  undoLine(group) {
    const pending = pendingUndo();
    // `groupHasCourse` and not a string compare: the removal remembers
    // `CS425` and the row now reads `CS 425 / ECE 428`.
    return pending && groupHasCourse(group, pending.courseCode) ? undoLine(pending) : undefined;
  },
};

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
   * Piazza and Campuswire, in the rows the sources above use.
   *
   * They belong under this heading because what they produce is deadlines, from
   * places a student thinks of as places deadlines come from. Everything that
   * decides what each row says is in `observerRow` and its three helpers above;
   * this loop only decides the order.
   */
  const observers = (state.observers ?? {}) as Record<string, ObserverFacts | undefined>;
  for (const spec of OBSERVERS) {
    sources.append(await observerRow(spec, observers[spec.id], missing, now));
  }

  // The site source's state still has to be visible somewhere, or a failing
  // adapter loses its only signal (worker rule 2).
  const siteHealth = document.getElementById("site-health")!;
  siteHealth.replaceChildren();
  const siteStatus = state.sources.site;
  if (siteStatus) {
    const shown = displayState(siteStatus);
    const facts = byState.get("site");
    /*
     * Beside the heading, not in a row of its own under it.
     *
     * It *was* a labelled row — "Reading course websites · The last attempt at
     * all of them." — on the reasoning that a state word with nothing beside it
     * reads as a state of the section. But the section is called Course
     * websites, so the row restated the heading directly beneath it and then
     * said the same thing a third way ("the last attempt at all of them"),
     * which is the reading Sushi gave it: "why does it say course websites and
     * reading course websites again" (2026-09-21). The state *is* the section's
     * here: one source reads every one of these pages.
     */
    const row = el("div", undefined, "site-health--bar");
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
    siteHealth.append(row);
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
      adaptersEl.append(
        plainRow(
          "None for this term yet",
          "They are published separately, so this list can fill in without updating the extension.",
        ),
      );
    }

    /*
     * One row per course, and only the student's own courses.
     *
     * Sushi, 2026-09-21: "courses that have more than one source are filling up
     * new rows instead of along the row" — ECE 411 was a heading and two rows,
     * four lines for two pages — and "when theres more adapters for students,
     * they shouldnt be able to see courses that they havent selected", which is
     * the disclosure that used to hold the rest of the catalogue. Both are
     * `renderCourseSites`, which forms the course *before* the split (so no
     * course is drawn twice, whatever standing its pages have) and keeps
     * registry order inside it.
     *
     * `others` is computed and dropped; what that costs is written on
     * `courseGroupsForYou`, where the next reader will look for it.
     */
    const { rows, yours } = renderCourseSites(
      current,
      state.courses.map((course) => course.key),
      courseSiteActions,
    );
    adaptersEl.append(...rows);
    if (yours.length === 0 && current.length > 0) {
      adaptersEl.append(
        plainRow(
          "None of your courses yet",
          "Add the page that lists your deadlines below, and it appears here.",
        ),
      );
    }

    /*
     * The undo line for a course that no longer has a row.
     *
     * Removing a course's only page removes its row too, so the notice has
     * nowhere to hang — and that is exactly the removal a student is most
     * likely to want back. It gets a row of its own, with no switches.
     */
    const pending = pendingUndo();
    if (pending && !courseIsDrawn(yours, pending.courseCode)) {
      adaptersEl.append(
        courseRow(emptyCourseGroup<AdapterEntry>(pending.courseCode), courseSiteActions),
      );
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
      hint: "They stay in the list either way — this is only about interrupting you.",
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
      hint: "Days already past still show what you finished.",
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

  reminders.append(remindRows);

  /* Hidden, and ticked off (§8.1's Hide and tick, both undoable) */
  renderTidy(state.hiddenItems, state.doneItems);

  /* Google Calendar (§8.3) — see `renderGcal`. */
  renderGcal((state as { gcal?: GcalFacts }).gcal);

  renderPageNav();
}


/* ---- Hidden and ticked off ------------------------------------------------
 *
 * One line inside Your data, not a nav section of its own.
 *
 * It was a whole heading in the sidebar — "Hidden & done" — for two lists that
 * are empty on most installs, and a student reading the ten entries had to read
 * past it to reach Appearance. Sushi, 2026-09-21: "theres so many buttons and
 * text can u make the settings page more intuitive."
 *
 * A `<details>` is built here rather than written in `options.html` because the
 * empty case is not a disclosure at all: a `<details>` with nothing behind it
 * still opens, onto nothing, which reads as "it broke" rather than "there is
 * nothing here".
 */
function renderTidy(hiddenItems: TidyItem[], doneItems: TidyItem[]): void {
  const host = document.getElementById("tidy");
  if (!host) return;
  host.replaceChildren();

  if (hiddenItems.length === 0 && doneItems.length === 0) {
    host.append(el("p", "Nothing hidden, nothing ticked off.", "opt-note"));
    return;
  }

  const count = (n: number, word: string): string => `${n} ${word}`;
  const details = el("details", undefined, "why");
  const summary = el("summary", [count(hiddenItems.length, "hidden"), count(doneItems.length, "ticked off")].join(", "));
  details.append(summary);

  const list = (
    items: TidyItem[],
    heading: string,
    empty: string,
    button: string,
    kind: "unhide" | "undone",
  ): void => {
    details.append(el("h4", heading));
    /*
     * Said once, above the rows, because most of them will not have a Trash.
     *
     * A Trash on a row a source states would mean "hide, and lie about it" —
     * the next sync writes it back. The student still needs to know *why* the
     * button is missing from the row they want gone, and what the other one
     * does instead.
     */
    details.append(
      el(
        "p",
        "Only deadlines you typed in yourself can be deleted; the rest come back " +
          "on the next check, so Unhide is the only thing that changes them.",
        "opt-note",
      ),
    );
    const rows = el("div", undefined, "rows");
    if (items.length === 0) rows.append(plainRow(empty));
    for (const item of items) {
      const row = plainRow(item.title, item.courseLabel);
      const undo = el("button", button, "btn btn-secondary btn-sm");
      undo.addEventListener("click", () => {
        void send({ type: "override", action: { kind, itemId: item.id } }).then(refreshOptions);
      });
      row.append(undo);
      const ids = trashable(item.members);
      if (ids !== null) row.append(trashButton(item, ids));
      rows.append(row);
    }
    details.append(rows);
  };

  list(hiddenItems, "Hidden", "Nothing hidden", "Unhide", "unhide");
  list(doneItems, "Ticked off", "Nothing ticked off", "Not done", "undone");
  host.append(details);
}

/**
 * Deletes a hand-typed row for good — the row and its correction both.
 *
 * `delete-manual-item` per member rather than a new message: the worker already
 * drops the `manualItems` entry *and* the override keyed on it, and a second
 * path that did the same thing would be the second copy of a decision that
 * drifts (mutation-check rule 3). An item is a group, so a group of two
 * hand-typed rows is two deletes.
 *
 * It says "Deleting…" on the control (UI rule 4) and reports a refusal on the
 * row rather than in `#data-status`, which is somewhere else on a long page
 * (UI rule 3), and it carries a `.catch` (UI rule 2) — without one a worker on
 * an older build rejects into a console nobody has open and the button just
 * sits there.
 */
function trashButton(item: TidyItem, sourceIds: string[]): HTMLElement {
  const button = el("button", "Trash", "btn btn-secondary btn-sm");
  button.title = `Deletes “${item.title}” and the corrections on it. You typed it in, so nothing else loses it.`;
  button.addEventListener("click", () => {
    button.disabled = true;
    button.textContent = "Deleting\u2026";
    const restore = (text: string): void => {
      button.disabled = false;
      button.textContent = "Trash";
      const hint = button.parentElement?.querySelector(".srow2--hint");
      if (hint) hint.textContent = text;
    };
    void Promise.all(sourceIds.map((sourceId) => send({ type: "delete-manual-item", sourceId })))
      .then((responses) => {
        const failed = responses.find((response) => response.type === "error");
        if (failed !== undefined && failed.type === "error") {
          restore(failed.message);
          return undefined;
        }
        return refreshOptions();
      })
      .catch((err: unknown) => restore(err instanceof Error ? err.message : String(err)));
  });
  return button;
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
  // A `<div>` inside Reminders, not a `<section data-nav>` of its own.
  //
  // It was the tenth entry in the sidebar, and it is one switch. A student
  // looking for it is looking for the other things that tell them about a
  // deadline before it is due, which is what Reminders is — so it is the second
  // heading in that section rather than a heading beside it.
  const section = el("div");
  section.id = "sec-gcal";
  const heading = el("h3", "Google Calendar");
  const lede = el("p", "Off until you turn it on.", "lede");
  const rows = el("div", undefined, "rows");
  rows.id = "gcal-rows";
  section.append(heading, lede, rows);
  (document.getElementById("sec-reminders") ?? document.body).append(section);
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

  // No "Push now": every sync pushes, so the button's only effect was to do
  // sooner what the next check does anyway — and it was the second control on
  // a row whose first one is the decision.
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

document.getElementById("export")!.addEventListener("click", async () => {
  const response = await send({ type: "export" });
  if (response.type !== "export") return;
  downloadFile("illini-dash-export.json", response.json, "application/json");
  dataStatus().textContent = "Exported.";
});

/*
 * Under Developer (`#dev`) since 2026-09-21, not deleted.
 *
 * The pass that cut the repetitive controls listed this one as "folds into the
 * Piazza row", which the code contradicts: it clears `setupDoneAt` and opens
 * the first-run screen, and no Piazza control does any part of that. Deleting
 * it outright would leave Reset as the only way back to that screen — which is
 * exactly the substitution `background.ts` records Sushi making, at the cost of
 * every hide, merge and tick. So it moved to the section a student never sees
 * rather than off the page.
 */
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
  const typed = (document.getElementById("report-url") as HTMLInputElement).value.trim();
  if (!typed) {
    reportStatus().textContent = "Paste the URL of the page that is not working.";
    return;
  }
  // I04, as in the capture tool above: a string that is not an address is this
  // page's finding to report, not Chrome's.
  const address = normalizePageUrl(typed);
  if (!address.ok) {
    reportStatus().textContent = address.reason;
    return;
  }
  const url = address.url;
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
/* The Developer section, at an address rather than in the sidebar             */
/* -------------------------------------------------------------------------- */

/**
 * Shown only at `options.html#dev` (`core/page-url.ts` owns which addresses).
 *
 * Re-run on `hashchange` as well as at load: a student who types the address
 * into the bar of a Settings tab that is already open gets no navigation, and a
 * section that appears only on reload is one whose address looks broken.
 */
function applyDevVisibility(): void {
  const section = document.getElementById("sec-dev");
  if (!section) return;
  section.hidden = !isDevHash(location.hash);
}
applyDevVisibility();
window.addEventListener("hashchange", applyDevVisibility);

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
  const typed = addSiteUrl.value.trim();
  addSiteResult.replaceChildren();
  if (!typed) {
    addSiteStatus.textContent = "Paste the address of the page first.";
    return;
  }
  // I04: `not a url` used to reach the permission check, which returned false
  // because the string never parsed, and the page said Chrome had refused a
  // host it was never asked about. Say what is wrong with the text instead.
  const address = normalizePageUrl(typed);
  if (!address.ok) {
    addSiteStatus.textContent = address.reason;
    return;
  }
  const url = address.url;
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

  /**
   * One proposal, drawn.
   *
   * The heading says where the date and the name come from *in the page's own
   * terms* — `locatorDescription`, in core where a test can read it. It used to
   * be the selector and the label spec, which is a true sentence about the
   * adapter and tells a student nothing about their course page; with six
   * locators it would also have printed `[object Object]` for a grid.
   */
  const candidateBox = (candidate: Candidate): HTMLElement => {
    const box = el("div", undefined, "result");
    box.append(el("h3", locatorDescription(candidate)));

    // The notes, before the rows: the count ("13 of 13" and "6 of 20" are
    // different answers, and the second means this page is not fully covered),
    // then every decision the search took that the rows below cannot show.
    const [selector, count, ...rest] = candidateNotes(candidate);
    box.append(el("p", selector, "muted"));
    box.append(
      el("p", count, candidate.dated === candidate.total ? "muted" : "verdict-needs_login"),
    );
    for (const note of rest) box.append(el("p", note, "muted"));

    const table = document.createElement("table");
    table.className = "preview";
    for (const row of candidate.sample) {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = row.title;
      const due = document.createElement("td");
      due.textContent = row.due;
      // What the page printed, beside what it was read as. The instant alone
      // cannot show "reads plausibly, lands on the wrong day", which is the one
      // failure this preview exists to catch.
      const read = document.createElement("td");
      read.className = "muted";
      read.textContent = row.read ?? "";
      tr.append(name, due, read);
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
    return box;
  };

  // Five, and a button for the rest. Which five is `shownCandidates`, in core
  // where a test can reach it (worker rule 1); this file draws them.
  const { shown, hidden } = shownCandidates(candidates);
  for (const candidate of shown) addSiteResult.append(candidateBox(candidate));
  if (hidden.length > 0) {
    const more = el("button", showMoreLabel(hidden.length));
    more.addEventListener("click", () => {
      more.remove();
      for (const candidate of hidden) addSiteResult.append(candidateBox(candidate));
    });
    addSiteResult.append(more);
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

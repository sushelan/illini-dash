/** Reference-driven evidence, not an automatic declaration that the UI is good.
 * See docs/design/ui-acceptance/README.md. No runtime dependencies. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openBrowser } from "./ui-browser.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const spec = join(root, "docs/design/ui-acceptance");
const runs = join(root, "artifacts/ui-acceptance");
const CLOCK = "2026-09-22T16:14:00Z";
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function filesIn(path) {
  return readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((e) => e.isDirectory() ? filesIn(join(path, e.name)) : [join(path, e.name)]);
}
export function sourceDigest() {
  const files = ["src", "public", "scripts", "tests", "adapters", "docs/design/ui-acceptance", ".agents/skills/illini-ui-acceptance"]
    .flatMap((p) => filesIn(join(root, p)));
  files.push(...["package.json", "package-lock.json", "build.mjs", "SPEC.md", "AGENTS.md", "tsconfig.json", "vitest.config.ts"].map((p) => join(root, p)));
  return hash(files.sort().map((p) => `${relative(root, p)}\0${hash(readFileSync(p))}`).join("\n"));
}
export function verifyReferences() {
  const manifest = read(join(spec, "reference-manifest.json"));
  for (const entry of manifest.files) {
    const path = resolve(root, entry.path);
    if (!path.startsWith(join(root, "docs/design/classical-mock") + sep) || hash(readFileSync(path)) !== entry.sha256) {
      throw new Error(`Reference changed: ${entry.path}. Compare with the original ZIP; don't bless drift automatically.`);
    }
  }
  return hash(JSON.stringify(manifest));
}

// Capture identifiers stay stable so a baseline and a candidate can be paired.
export const STATES = [
  ...["day", "week", "month", "nodate", "exams", "sources"].map((tab) => ({ id: `reference-${tab}`, query: `tab=${tab}&dataset=reference` })),
  { id: "stress-day", query: "tab=day&dataset=stress" },
  { id: "stress-week", query: "tab=week&dataset=stress" },
  { id: "empty", query: "tab=day&dataset=empty" },
  { id: "sources", query: "tab=nodate&dataset=stress", press: ".foot--health" },
  { id: "editor", query: "tab=day&dataset=reference", press: '.qfab' },
  { id: "deadline", query: "tab=day&dataset=reference", press: "#view .row" },
  { id: "setup", query: "setup=1&dataset=empty" },
  { id: "network", query: "fail=network&dataset=stress" },
  { id: "parse", query: "fail=parse&dataset=stress" },
  { id: "settings", query: "page=options&dataset=reference", size: [1280, 900] },
  { id: "settings-stale", query: "page=options&stale=1&dataset=stress", size: [1280, 900] },
  { id: "settings-denied", query: "page=options&permission=denied&dataset=stress", size: [1280, 900] },
  ...["off", "pending", "read", "login", "error"].map((state) => ({ id: `observers-${state}`, query: `page=options&observer=${state}&dataset=reference`, size: [1280, 900] })),
  ...["day", "week", "month", "nodate", "exams", "sources"].map((tab) => ({ id: `full-${tab}`, query: `tab=${tab}&view=full&dataset=stress`, size: [1280, 800] })),
  { id: "fresh-default", query: "dataset=reference", modes: ["default"] },
];
export const captureMatrix = () => STATES.flatMap((state) => (state.modes ?? ["dark", "light"]).map((mode) => ({ id: `${state.id}-${mode}`, state: state.id, mode, status: "pending", review: "pending", evidence: [] })));

function runDirectory(id) {
  if (!/^[a-z0-9][a-z0-9-]{0,70}$/.test(id ?? "")) throw new Error("Use a run name of lowercase letters, digits and hyphens (max 71).");
  return join(runs, id);
}
function init(id) {
  const dir = runDirectory(id);
  if (existsSync(dir)) throw new Error(`Run exists: ${id}. Use a new name to preserve evidence.`);
  const referenceDigest = verifyReferences();
  const journeys = read(join(spec, "journeys.json")).journeys;
  mkdirSync(dir, { recursive: true });
  const pending = () => ({ status: "pending", evidence: [], notes: "" });
  const run = { schemaVersion: 1, id, createdAt: new Date().toISOString(),
    gitHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    sourceDigest: sourceDigest(), referenceDigest, clock: CLOCK, timezone: "America/Chicago", locale: "en-US", dpr: 1,
    captures: captureMatrix(),
    journeys: journeys.map((j) => ({ id: j.id, environment: j.environment, ...pending() })),
    reviews: Object.fromEntries(["visual", "interaction", "integration"].map((r) => [r, { ...pending(), reviewer: "" }])),
    checks: Object.fromEntries(["typecheck", "tests", "mutation-evidence"].map((r) => [r, pending()])),
    findings: [],
  };
  write(join(dir, "run.json"), run);
  gallery(dir, run);
  console.log(`Created ${relative(root, dir)}; ${run.journeys.length} journeys start pending.`);
}

function evidenceExists(dir, entry) {
  return Array.isArray(entry.evidence) && entry.evidence.length > 0 && entry.evidence.every((p) => {
    if (typeof p !== "string" || !p) return false;
    const path = resolve(dir, p);
    return path.startsWith(resolve(dir) + sep) && existsSync(path) && readFileSync(path).length > 0;
  });
}
export function checkRun(dir, run, expected, digest, referenceDigest) {
  const failures = [];
  if (run.sourceDigest !== digest) failures.push("Source changed since this run; create a new candidate run.");
  if (run.referenceDigest !== referenceDigest) failures.push("Reference set changed.");
  const complete = (entry, name) => {
    if (!entry || !["pass", "accepted-deviation"].includes(entry.status)) failures.push(`${name}: ${entry?.status ?? "missing"}`);
    else if (!evidenceExists(dir, entry)) failures.push(`${name}: missing local evidence`);
    else if (entry.status === "accepted-deviation" && (!entry.decision || !entry.notes)) failures.push(`${name}: deviation needs decision attribution and reason`);
  };
  const unique = (entries, label) => {
    if (!Array.isArray(entries) || new Set(entries.map((e) => e.id)).size !== entries.length) failures.push(`${label}: missing list or duplicate identifiers`);
  };
  unique(run.journeys, "journeys"); unique(run.captures, "captures");
  for (const journey of expected.journeys) {
    const result = run.journeys?.find((r) => r.id === journey.id);
    complete(result, journey.id);
    if (result && (journey.environment === "chrome" && result.environment !== "chrome" || !["preview", "chrome"].includes(result.environment))) failures.push(`${journey.id}: preview evidence cannot replace Chrome evidence`);
    if (result?.environment === "chrome" && ["pass", "accepted-deviation"].includes(result.status) && !result.observedBy) failures.push(`${journey.id}: record who observed real Chrome`);
  }
  for (const entry of captureMatrix()) {
    const result = run.captures?.find((r) => r.id === entry.id);
    if (result?.status !== "captured") failures.push(`${entry.id}: not captured`);
    complete(result && { ...result, status: result.review }, `${entry.id} visual review`);
    if (result?.status === "captured" && evidenceExists(dir, result)) {
      if (!result.evidence.includes(`${entry.id}.png`) || !result.evidence.includes(`${entry.id}.json`)) failures.push(`${entry.id}: screenshot and metrics must both be attached`);
      const metricsPath = result.evidence.find((p) => p.endsWith(".json"));
      if (!metricsPath) failures.push(`${entry.id}: missing metrics`);
      else {
        const metrics = read(resolve(dir, metricsPath));
        const state = STATES.find((s) => s.id === entry.state);
        const [width, height] = state.size ?? [400, 600];
        if (metrics.sourceDigest !== run.sourceDigest || metrics.captureId !== entry.id || metrics.clock !== CLOCK || metrics.timezone !== "America/Chicago" || metrics.viewport?.dpr !== 1 || metrics.viewport.width !== width || metrics.viewport.height !== height || metrics.dark !== (entry.mode === "dark")) failures.push(`${entry.id}: stale or mismatched capture metadata`);
      }
    }
  }
  for (const name of ["visual", "interaction", "integration"]) {
    complete(run.reviews?.[name], `${name} review`);
    if (!run.reviews?.[name]?.reviewer) failures.push(`${name}: reviewer identity missing`);
  }
  if (run.reviews?.visual?.reviewer && run.reviews.visual.reviewer === run.reviews?.interaction?.reviewer) failures.push("Visual and interaction reviewers must be independent.");
  for (const name of ["typecheck", "tests", "mutation-evidence"]) complete(run.checks?.[name], name);
  if (!Array.isArray(run.findings)) failures.push("Findings ledger missing");
  for (const finding of run.findings ?? []) {
    if (!["fixed", "accepted-deviation", "refuted"].includes(finding.status) || !evidenceExists(dir, finding)) failures.push(`Finding ${finding.id}: unresolved or missing verification`);
    if (finding.status === "accepted-deviation" && (!finding.decision || !finding.notes)) failures.push(`Finding ${finding.id}: deviation needs decision attribution and reason`);
  }
  return failures;
}

function gallery(dir, run) {
  const cards = run.captures.map((capture) => `<article><h2>${escape(capture.id)}</h2><p>${escape(capture.status)} · review ${escape(capture.review)}</p>${capture.status === "captured" ? `<a href="${escape(capture.id)}.json">Measurements</a><img src="${escape(capture.id)}.png" alt="${escape(capture.id)}">` : ""}</article>`).join("");
  writeFileSync(join(dir, "index.html"), `<!doctype html><meta charset="utf-8"><title>UI evidence — ${escape(run.id)}</title><style>body{font:16px system-ui;background:#eee;color:#222;margin:24px}main{display:flex;flex-wrap:wrap;gap:24px}article{background:white;padding:16px;max-width:100%;overflow:auto}h2{font-size:17px}img{display:block;max-width:100%;height:auto;margin-top:12px}code{overflow-wrap:anywhere}</style><h1>${escape(run.id)}</h1><p>Observed screenshots, not approved goldens. Journeys and reviews remain in <a href="run.json">run.json</a>.</p><p>Fixed clock ${CLOCK} · America/Chicago · DPR 1 · source <code>${run.sourceDigest}</code></p><main>${cards}</main>`);
}

async function capture(id, only) {
  const dir = runDirectory(id), path = join(dir, "run.json"), run = read(path);
  if (run.sourceDigest !== sourceDigest() || run.referenceDigest !== verifyReferences()) throw new Error("Inputs changed; create a new run before capturing.");
  const selected = only ? only.split(",") : STATES.map((s) => s.id);
  for (const name of selected) if (!STATES.some((s) => s.id === name)) throw new Error(`Unknown capture state: ${name}`);
  execFileSync(process.execPath, ["build.mjs"], { cwd: root, stdio: "inherit" });
  execFileSync(process.execPath, ["scripts/preview.mjs"], { cwd: root, stdio: "inherit" });
  const browser = await openBrowser(join(root, "dist"));
  try {
    const version = await browser.send("Browser.getVersion");
    for (const state of STATES.filter((s) => selected.includes(s.id))) {
      for (const result of run.captures.filter((c) => c.state === state.id)) {
        if (result.status === "captured") continue;
        try {
          const query = new URLSearchParams(state.query);
          query.set("at", CLOCK); query.set("acceptance", "1");
          if (result.mode !== "default") query.set("mode", result.mode);
          const [width, height] = state.size ?? [400, 600];
          await browser.navigate(`shot.html?${query}`, width, height, "dark");
          if (state.press) await browser.press(state.press);
          const metrics = await browser.evaluate(readFileSync(join(root, "scripts/ui-measure.js"), "utf8"));
          const actualFonts = {};
          await browser.send("DOM.enable"); await browser.send("CSS.enable");
          const { root: documentNode } = await browser.send("DOM.getDocument");
          for (const selector of ["body", ".wordmark", "h1", ".row--title", ".row--code"]) {
            const { nodeId } = await browser.send("DOM.querySelector", { nodeId: documentNode.nodeId, selector });
            if (nodeId) actualFonts[selector] = (await browser.send("CSS.getPlatformFontsForNode", { nodeId })).fonts;
          }
          metrics.actualFonts = actualFonts;
          Object.assign(metrics, { sourceDigest: run.sourceDigest, captureId: result.id, browser: version, runtimeEvents: [...browser.events] });
          if (metrics.clock !== CLOCK || metrics.viewport.width !== width || metrics.viewport.height !== height || metrics.dark !== (result.mode === "dark")) throw new Error("Capture environment did not match requested clock, size or mode");
          if (browser.events.some((e) => e.kind === "exception" || e.kind === "harness-error")) throw new Error("Runtime exception during capture (see error record)");
          writeFileSync(join(dir, `${result.id}.png`), await browser.screenshot());
          write(join(dir, `${result.id}.json`), metrics);
          Object.assign(result, { status: "captured", review: "pending", evidence: [`${result.id}.png`, `${result.id}.json`] });
          console.log(`Captured ${result.id}`);
        } catch (error) {
          Object.assign(result, { status: "failed", error: error.message });
          write(join(dir, `${result.id}-error.json`), { message: error.message, events: browser.events });
          console.error(`FAILED ${result.id}: ${error.message}`);
        }
        write(path, run); gallery(dir, run);
      }
    }
  } finally { await browser.close(); }
  if (run.captures.some((c) => selected.includes(c.state) && c.status === "failed")) process.exitCode = 1;
}

function compare(beforeId, afterId) {
  const beforeDir = runDirectory(beforeId), afterDir = runDirectory(afterId);
  const before = read(join(beforeDir, "run.json")), after = read(join(afterDir, "run.json"));
  if (before.referenceDigest !== after.referenceDigest) throw new Error("Reference sets differ; resolve before comparing.");
  const rows = after.captures.filter((c) => c.status === "captured").map((c) => {
    const previous = before.captures.find((p) => p.id === c.id && p.status === "captured");
    if (!previous) return `<h2>${escape(c.id)}</h2><p>No baseline capture. Comparison incomplete.</p>`;
    const a = read(join(beforeDir, `${c.id}.json`)), b = read(join(afterDir, `${c.id}.json`));
    const environment = (m) => JSON.stringify([m.clock, m.timezone, m.locale, m.viewport, m.dark, m.browser.product]);
    if (environment(a) !== environment(b)) throw new Error(`Environment differs for ${c.id}; recapture with the same browser, clock and viewport.`);
    return `<section><h2>${escape(c.id)}</h2><div class="pair"><figure><figcaption>Before</figcaption><img src="../${escape(beforeId)}/${escape(c.id)}.png"></figure><figure><figcaption>Candidate</figcaption><img src="${escape(c.id)}.png"></figure></div><label>Overlay <input type="range" min="0" max="1" step="0.05" value="0.5" oninput="this.closest('section').querySelector('.top').style.opacity=this.value"></label><div class="overlay"><img src="../${escape(beforeId)}/${escape(c.id)}.png"><img class="top" src="${escape(c.id)}.png"></div></section>`;
  }).join("");
  writeFileSync(join(afterDir, "compare.html"), `<!doctype html><meta charset="utf-8"><title>UI comparison</title><style>body{font:16px system-ui;margin:24px}section{margin-bottom:40px;overflow:auto}.pair{display:flex;gap:24px}figure{margin:0}.overlay{position:relative;width:max-content}.overlay img{display:block}.top{position:absolute;inset:0;opacity:.5}</style><h1>${escape(beforeId)} → ${escape(afterId)}</h1><p>Same data and environment. Differences require review; captures do not approve themselves.</p>${rows}`);
  console.log(relative(root, join(afterDir, "compare.html")));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, id, extra] = process.argv.slice(2);
    if (command === "init") init(id);
    else if (command === "capture") await capture(id, extra?.replace(/^--only=/, ""));
    else if (command === "compare") compare(id, extra);
    else if (command === "check") {
      const dir = runDirectory(id);
      const failures = checkRun(dir, read(join(dir, "run.json")), read(join(spec, "journeys.json")), sourceDigest(), verifyReferences());
      if (failures.length) { console.error(`INCOMPLETE (${failures.length})\n${failures.join("\n")}`); process.exitCode = 1; }
      else console.log("ACCEPTED: all required evidence and reviews are recorded.");
    } else if (command === "references") console.log(`Reference hashes verified: ${verifyReferences()}`);
    else console.log("Usage: npm run ui:acceptance -- init NAME | capture NAME [--only=reference-week,settings] | compare BEFORE AFTER | check NAME | references");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

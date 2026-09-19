import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { checkRun, captureMatrix, STATES } from "./ui-acceptance.mjs";

/*
 * The two harness entry points must press the same control.
 *
 * `npm run ui:acceptance` presses `STATES`' `press`; `shot.html?open=health`
 * and the journeys in `journeys.json` go through `preview-open.js`'s table.
 * They were written a day apart and disagreed: the preview still pressed the
 * header pill (`.pill`) that was removed on 2026-09-19, so `open=health` did
 * nothing at all and a "Sources" screenshot taken through it was a screenshot
 * of the calendar — with no error anywhere, which is the silent-empty failure
 * one level up. Nothing but a test can keep two spellings of one control in
 * step (UI house rule 7).
 */
test("both harness entry points open Needs you with the same control", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  // No `document`: the file is browser-side, and the guard that keeps it from
  // pressing anything outside a page is part of what this evaluates.
  const context = vm.createContext({ URLSearchParams, location: { search: "" } });
  vm.runInContext(readFileSync(join(here, "preview-open.js"), "utf8"), context);
  const targets = vm.runInContext("__PREVIEW_OPEN__.targets", context);
  assert.equal(targets.health, STATES.find((s) => s.id === "sources").press);
  assert.equal(targets.editor, STATES.find((s) => s.id === "editor").press);
});

// Requirement: screenshots and a green suite alone may never claim full UI acceptance.
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "illini-gate-test-"));
  const evidence = ["review.md"];
  writeFileSync(join(dir, "review.md"), "Observed steps and limitations, test evidence only.");
  const done = { status: "pass", evidence };
  const run = {
    sourceDigest: "current", referenceDigest: "original",
    journeys: [{ id: "preview", environment: "preview", ...done }, { id: "chrome", environment: "chrome", observedBy: "test-observer", ...done }],
    captures: captureMatrix().map((entry) => {
      const state = STATES.find((s) => s.id === entry.state), [width, height] = state.size ?? [400, 600];
      writeFileSync(join(dir, `${entry.id}.png`), "test-only image evidence");
      writeFileSync(join(dir, `${entry.id}.json`), JSON.stringify({ sourceDigest: "current", captureId: entry.id, clock: "2026-09-22T16:14:00Z", timezone: "America/Chicago", viewport: { width, height, dpr: 1 }, dark: entry.mode === "dark" }));
      return { ...entry, status: "captured", review: "pass", evidence: [`${entry.id}.png`, `${entry.id}.json`] };
    }),
    reviews: { visual: { ...done, reviewer: "visual-agent" }, interaction: { ...done, reviewer: "interaction-agent" }, integration: { ...done, reviewer: "integrator" } },
    checks: { typecheck: { ...done }, tests: { ...done }, "mutation-evidence": { ...done } }, findings: [],
  };
  const expected = { journeys: [{ id: "preview", environment: "preview" }, { id: "chrome", environment: "chrome" }] };
  return { run, dir, check: () => checkRun(dir, run, expected, "current", "original"), clean: () => rmSync(dir, { recursive: true, force: true }) };
}
test("gate accepts a complete evidence record, not a claim of tested product behavior", () => {
  const f = fixture(); try { assert.deepEqual(f.check(), []); } finally { f.clean(); }
});
test("real Chrome can resolve a preview journey only with attributed evidence", () => {
  const f = fixture(); try {
    f.run.journeys[0].environment = "chrome";
    assert.ok(f.check().some((e) => e.includes("who observed real Chrome")));
    f.run.journeys[0].observedBy = "test-observer";
    assert.deepEqual(f.check(), []);
  } finally { f.clean(); }
});
for (const [name, mutate, expected] of [
  ["unobserved journey", (r) => { r.journeys[0].status = "pending"; }, "preview: pending"],
  ["deleted journey", (r) => { r.journeys.pop(); }, "chrome: missing"],
  ["blocked path", (r) => { r.journeys[0].status = "blocked"; }, "preview: blocked"],
  ["stale code", (r) => { r.sourceDigest = "old"; }, "Source changed"],
  ["changed reference", (r) => { r.referenceDigest = "drift"; }, "Reference set changed"],
  ["same reviewer", (r) => { r.reviews.interaction.reviewer = "visual-agent"; }, "must be independent"],
  ["unsupported Chrome substitution", (r) => { r.journeys[1].environment = "preview"; }, "cannot replace Chrome"],
  ["unattributed Chrome observation", (r) => { delete r.journeys[1].observedBy; }, "who observed real Chrome"],
  ["auto-approved capture", (r) => { r.captures[0].review = "pending"; }, "visual review: pending"],
  ["missing screenshot", (r) => { r.captures[0].evidence.shift(); }, "screenshot and metrics"],
  ["unsupported deviation", (r) => { r.journeys[0].status = "accepted-deviation"; }, "decision attribution"],
  ["open finding", (r) => { r.findings.push({ id: "F1", status: "open", evidence: ["review.md"] }); }, "Finding F1"],
  ["missing evidence", (r) => { r.journeys[0].evidence = ["missing.md"]; }, "missing local evidence"],
]) test(`gate rejects ${name}`, () => {
  const f = fixture(); try { mutate(f.run); assert.ok(f.check().some((e) => e.includes(expected)), expected); } finally { f.clean(); }
});
for (const kind of ["theme", "viewport"]) test(`gate rejects mislabeled ${kind} evidence`, () => {
  const f = fixture(); try {
    const p = join(f.dir, `${f.run.captures[0].id}.json`);
    writeFileSync(p, JSON.stringify({ sourceDigest: "current", captureId: f.run.captures[0].id, clock: "2026-09-22T16:14:00Z", timezone: "America/Chicago", viewport: { width: kind === "viewport" ? 800 : 400, height: 600, dpr: 1 }, dark: kind !== "theme" }));
    assert.ok(f.check().some((e) => e.includes("mismatched capture metadata")));
  } finally { f.clean(); }
});

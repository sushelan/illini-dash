import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { buildSync } from "esbuild";
import { parseHTML } from "linkedom";
import { referenceItems } from "../scripts/preview-reference.js";
import type { Source, SourceStatus } from "../src/sources/types.js";

describe("repeatable UI evidence", () => {
  it("freezes Date() and Date.now before both data and UI without changing constructors", () => {
    const context = vm.createContext({ URLSearchParams, location: { search: "?at=2026-09-22T16%3A14%3A00Z" } });
    vm.runInContext(readFileSync("scripts/preview-clock.js", "utf8"), context);
    expect(vm.runInContext("new Date().toISOString()", context)).toBe("2026-09-22T16:14:00.000Z");
    expect(vm.runInContext("Date.now()", context)).toBe(Date.parse("2026-09-22T16:14:00Z"));
    expect(vm.runInContext("new Date(0).toISOString()", context)).toBe("1970-01-01T00:00:00.000Z");
    expect(vm.runInContext("new Date() instanceof Date", context)).toBe(true);
    expect(vm.runInContext("Date.parse(Date())", context)).toBe(Date.parse("2026-09-22T16:14:00Z"));
  });
  it("rejects ambiguous local capture clocks", () => {
    const context = vm.createContext({ URLSearchParams, location: { search: "?at=2026-09-22" } });
    expect(() => vm.runInContext(readFileSync("scripts/preview-clock.js", "utf8"), context)).toThrow("UTC ISO");
  });
  it("makes a repeatable coherent reference day with distinct dated, undated and booking shapes", () => {
    const now = Date.parse("2026-09-22T16:14:00Z");
    const items = referenceItems(now);
    expect(referenceItems(now)).toEqual(items);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(items.find((i) => i.id === "reference-late")?.dueAt).toBe("2026-09-22T04:59:00.000Z");
    expect(items.find((i) => i.id === "reference-homework")?.dueAt).toBe("2026-09-23T04:59:00.000Z");
    expect(items.find((i) => i.id === "reference-proposal")?.dueAt).toBeUndefined();
    expect(items.find((i) => i.kind === "booking")?.members[0]?.extra?.windowEnd).toBe("2026-09-29T04:59:00.000Z");
    expect(items.find((i) => i.id === "reference-ambiguous")?.members[0]?.extra?.unparsedDueDate).toContain("window closes");
  });
});

// Exercise the whole stub: testing the sample factory alone missed later rows
// being appended to both the reference and supposedly empty datasets.
const stub = buildSync({ entryPoints: ["scripts/preview-data.ts"], bundle: true,
  write: false, format: "iife", define: { __MANIFEST_VERSION__: '"test"' } }).outputFiles[0]!.text;
function preview(query: string) {
  const context = vm.createContext({ URL, URLSearchParams, location: { search: `?acceptance=1&at=2026-09-22T16%3A14%3A00Z&${query}` }, crypto: webcrypto, setTimeout, console });
  vm.runInContext(readFileSync("scripts/preview-clock.js", "utf8"), context);
  vm.runInContext(stub, context);
  return context;
}
describe("acceptance preview tells the truth about its evidence", () => {
  it.each(["reference", "empty"])("keeps the %s dataset free of unrelated seeded rows", async (dataset) => {
    const context = preview(`dataset=${dataset}`);
    const state = await vm.runInContext('chrome.runtime.sendMessage({type:"get-state"})', context);
    expect(state.items.map((i: { id: string }) => i.id)).toEqual(dataset === "empty" ? [] : referenceItems(Date.parse("2026-09-22T16:14:00Z")).map((i) => i.id));
    expect(state.suggestions).toEqual([]);
  });
  it("refuses unsupported writes instead of pretending settings saved", async () => {
    const context = preview("dataset=empty");
    const result = await vm.runInContext('chrome.runtime.sendMessage({type:"set-course-name", key:"CS425", name:"Changed"})', context);
    expect(result.type).toBe("error");
    expect(result.message).toContain("does not simulate set-course-name");
    expect(vm.runInContext('__UI_ACCEPTANCE__.events.at(-1).kind', context)).toBe("unsupported");
  });
  it.each(["pending", "error"])("uses a real Piazza state in the %s front preview", async (state) => {
    const context = preview(`dataset=reference&observer=${state}`);
    const result = await vm.runInContext('chrome.runtime.sendMessage({type:"get-state"})', context);
    expect(result.observers.piazza.state).toBe(state);
  });
  it("simulates denial and observed data without turning Campuswire into a fetcher", async () => {
    const context = preview("dataset=reference&permission=denied&observer=read");
    expect(await vm.runInContext("chrome.permissions.request()", context)).toBe(false);
    const state = await vm.runInContext('chrome.runtime.sendMessage({type:"get-options-state"})', context);
    expect(state.observers.piazza.state).toBe("ok");
    expect(state.observers.campuswire.lastObservedAt).toBe("2026-09-22T16:14:00.000Z");
    expect(state.observers.campuswire.lastAttemptAt).toBeUndefined();
    expect(vm.runInContext('__UI_ACCEPTANCE__.events[0].granted', context)).toBe(false);
  });
});

/*
 * `?open=…` has to name a control the popup *renders*, not one it used to.
 *
 * The header pill went on 2026-09-19 and the preview kept pressing `.pill` for
 * `open=health`, so the parameter did nothing and a "Sources" capture taken
 * through it was a capture of the calendar — with nothing in any console to
 * say so. A test that only compared two spellings would have agreed with both
 * of them, so this one resolves each target against the real shell: the same
 * `renderFooter`, `renderActions` and `renderRow` the extension runs.
 *
 * The linkedom setup is `tests/press-hold.test.ts`'s, one document further:
 * `state.ts` reads the elements by id as its body runs, so they have to exist
 * before the dynamic import below.
 */
const popup = parseHTML(
  "<!doctype html><html><body><header class='bar'><div id='health'></div>" +
    "<div class='bar--right' id='actions'></div></header><div id='banners'></div>" +
    "<div id='status' hidden></div><nav id='tabs' class='tabs'></nav>" +
    "<div id='filters' class='filters'></div><div id='nav' class='datenav'></div>" +
    "<main id='view'></main><footer id='footer' class='foot'></footer>" +
    "</body></html>",
);
const globals = globalThis as unknown as Record<string, unknown>;
globals["document"] = popup.document;
globals["window"] = popup.window;
// `renderRow` asks `row instanceof HTMLAnchorElement` before setting `href`:
// a row with no safe URL is a `<div>`, and only the anchor gets one.
globals["HTMLAnchorElement"] = popup.HTMLAnchorElement;
globals["location"] = { search: "" };
globals["localStorage"] = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};
const shell = await import("../src/ui/popup/shell.js");
const { renderRow } = await import("../src/ui/popup/rows.js");

/** The one table, read the way the browser reads it — no `document` needed. */
function openTargets(): Record<string, string> {
  const context = vm.createContext({ URLSearchParams, location: { search: "" } });
  vm.runInContext(readFileSync("scripts/preview-open.js", "utf8"), context);
  return vm.runInContext("__PREVIEW_OPEN__.targets", context) as Record<string, string>;
}

describe("every preview open= target resolves against the rendered popup", () => {
  const targets = openTargets();
  const now = new Date("2026-09-22T16:14:00Z");
  const SOURCES: Source[] = [
    "canvas", "gradescope", "prairielearn", "prairietest", "smartphysics", "site", "manual",
  ];
  const sources = Object.fromEntries(
    SOURCES.map((source) => [
      source,
      { source, enabled: false, state: "disabled", consecutiveFailures: 0 } satisfies SourceStatus,
    ]),
  ) as Record<Source, SourceStatus>;

  it("presses the footer's source button for health, not the removed header pill", () => {
    shell.renderFooter(sources, now);
    const el = popup.document.querySelector(targets["health"]!);
    expect(el, `open=health matched nothing: ${targets["health"]}`).not.toBeNull();
    // Both halves: it is the footer's own button, and it carries the class the
    // shell spells once (UI rule 7) rather than a second copy of the spelling.
    expect(el!.classList.contains(shell.FOOT_HEALTH_CLASS)).toBe(true);
    expect(el).toBe(popup.document.getElementById("footer")!.firstElementChild);
  });

  it("presses the floating + for the editor", () => {
    // The bar's "+" was removed on 2026-09-19 ("theres already one at the
    // bottom right"), and a harness target that outlives the control it names
    // is UI house rule 4's finding — `open=health` went on pressing `.pill`
    // for a day. So the target is held against `QUICK_FAB_SELECTOR`, the one
    // place that class is spelled.
    shell.renderActions();
    expect(targets["editor"]).toBe(shell.QUICK_FAB_SELECTOR);
    const el = popup.document.querySelector(targets["editor"]!);
    expect(el, `?editor=1 matched nothing: ${targets["editor"]}`).not.toBeNull();
    expect(el!.getAttribute("aria-label")).toBe("Add a deadline");
    // On `<body>`, not in the bar: it is drawn once and survives every redraw.
    expect(el!.parentElement).toBe(popup.document.body);
  });

  it("presses a real row for the deadline screen", () => {
    const item = referenceItems(now.getTime()).find((i) => i.id === "reference-homework")!;
    const row = renderRow(item, now, "Today");
    popup.document.getElementById("view")!.append(row);
    const el = popup.document.querySelector(targets["deadline"]!);
    expect(el, `open=deadline matched nothing: ${targets["deadline"]}`).toBe(row);
    expect(el!.textContent).toContain(item.title);
  });
});

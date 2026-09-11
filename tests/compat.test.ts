/**
 * Cross-build messages (`src/core/compat.ts`).
 *
 * The defect these pin was real and user-visible: an options page on build
 * 20260911T011632 asked a worker still running a pre-0b.17 build for
 * `options-state`, read `state.setAsideCourses.length`, and threw
 * "Cannot read properties of undefined (reading 'length')" — after drawing
 * four sections and before drawing five.
 */

import { describe, expect, it } from "vitest";
import {
  normalizeOptionsState,
  normalizePopupState,
  staleWorkerNotice,
} from "../src/core/compat.js";
import { DEFAULT_SETTINGS } from "../src/core/store.js";

/** What a current worker sends. */
function current(): Record<string, unknown> {
  return {
    type: "options-state",
    settings: { ...DEFAULT_SETTINGS, pollMinutes: 45 },
    notificationsBlocked: false,
    sources: { canvas: { source: "canvas", enabled: true, state: "ok" } },
    courses: [{ key: "CS424", label: "CS 424", itemCount: 3, sources: ["canvas"] }],
    overrides: {},
    itemCount: 3,
    hiddenItems: [],
    doneItems: [],
    setAsideCourses: [{ id: "1", name: "Old course", reason: "not in the current term" }],
    lastSyncAt: "2026-09-10T18:00:00.000Z",
  };
}

describe("normalizeOptionsState", () => {
  it("reports nothing missing, and changes nothing, for a same-build message", () => {
    const message = current();
    const { state, missing } = normalizeOptionsState<Record<string, unknown>>(message);
    expect(missing).toEqual([]);
    expect(state).toEqual(message);
  });

  it("fills the field whose absence crashed the page, and names it", () => {
    const old = current();
    delete old["setAsideCourses"];
    const { state, missing } = normalizeOptionsState<Record<string, unknown>>(old);
    expect(missing).toEqual(["setAsideCourses"]);
    // The dereference that threw.
    expect((state["setAsideCourses"] as unknown[]).length).toBe(0);
  });

  it("names every missing field, not just the first", () => {
    // A worker several builds behind is the case worth surviving; stopping at
    // the first omission would send the user round the loop once per field.
    const { missing } = normalizeOptionsState<Record<string, unknown>>({ type: "options-state" });
    // Sorted: the order they are reported in is not a requirement, the set is.
    expect([...missing].sort()).toEqual([
      "courses",
      "doneItems",
      "hiddenItems",
      "setAsideCourses",
      "settings",
      "sources",
    ]);
  });

  it("substitutes empty, never a guess", () => {
    const { state } = normalizeOptionsState<Record<string, unknown>>({ type: "options-state" });
    expect(state["courses"]).toEqual([]);
    expect(state["hiddenItems"]).toEqual([]);
    expect(state["doneItems"]).toEqual([]);
    expect(state["setAsideCourses"]).toEqual([]);
    expect(state["sources"]).toEqual({});
  });

  it("treats a field of the wrong type as missing", () => {
    // House rule 5 one process over: an older build that sent `null`, or an
    // object where the page expects a list, is not a field the page can read.
    const wrong = { ...current(), courses: null, hiddenItems: {}, sources: [] };
    const { missing, state } = normalizeOptionsState<Record<string, unknown>>(wrong);
    expect(missing).toContain("courses");
    expect(missing).toContain("hiddenItems");
    expect(missing).toContain("sources");
    expect(state["sources"]).toEqual({});
  });

  it("fills settings from the shipped defaults so every control has a state", () => {
    const old = current();
    delete old["settings"];
    const { state, missing } = normalizeOptionsState<Record<string, unknown>>(old);
    expect(missing).toContain("settings");
    expect(state["settings"]).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps what the worker did send about settings, and backfills the rest", () => {
    // A setting added after the worker's build is missing from an otherwise
    // valid settings object, and `state.settings.leadTimes.includes` would
    // throw exactly like setAsideCourses did.
    const partial = { ...current(), settings: { pollMinutes: 90 } };
    const { state, missing } = normalizeOptionsState<Record<string, unknown>>(partial);
    const settings = state["settings"] as Record<string, unknown>;
    expect(settings["pollMinutes"]).toBe(90);
    expect(settings["leadTimes"]).toEqual(DEFAULT_SETTINGS.leadTimes);
    // The object was there, so this is not a missing field — the page renders
    // it without a banner, which is correct: nothing is unaccounted for.
    expect(missing).not.toContain("settings");
  });

  it("survives a response that is not an object at all", () => {
    for (const junk of [undefined, null, "options-state", 42, []]) {
      const { missing } = normalizeOptionsState<Record<string, unknown>>(junk);
      expect(missing.length, String(junk)).toBe(6);
    }
  });

  it("does not mutate the message it was given", () => {
    const old = current();
    delete old["setAsideCourses"];
    normalizeOptionsState<Record<string, unknown>>(old);
    expect("setAsideCourses" in old).toBe(false);
  });
});

describe("staleWorkerNotice", () => {
  it("names the fields and ends with the fix", () => {
    const text = staleWorkerNotice(["setAsideCourses", "settings"]);
    expect(text).toContain("setAsideCourses, settings");
    expect(text).toContain("chrome://extensions");
    expect(text).toContain("Reload");
  });
});

describe("normalizePopupState", () => {
  function currentState(): Record<string, unknown> {
    return {
      type: "state",
      items: [{ id: "a", title: "HW6" }],
      sources: { canvas: { source: "canvas", enabled: true, state: "ok" } },
      settings: { ...DEFAULT_SETTINGS },
      notificationsBlocked: false,
      lastSyncAt: "2026-09-10T18:00:00.000Z",
    };
  }

  it("passes a same-build message through untouched", () => {
    const message = currentState();
    const { state, missing } = normalizePopupState<Record<string, unknown>>(message);
    expect(missing).toEqual([]);
    expect(state).toEqual(message);
  });

  it("guards the two fields the popup dereferences immediately", () => {
    // `renderDots` iterates sources and `render` iterates items, both before
    // anything is drawn — so either one missing is a blank popup.
    const { state, missing } = normalizePopupState<Record<string, unknown>>({ type: "state" });
    expect([...missing].sort()).toEqual(["items", "sources"]);
    expect(state["items"]).toEqual([]);
    expect(state["sources"]).toEqual({});
  });

  it("backfills a settings object an older worker sent without every field", () => {
    // The `?? DEFAULT_SETTINGS` the popup carried only fires when settings is
    // absent entirely. A worker that predates `hideSubmitted` sends an object
    // without it, and `render` then reads undefined as "show everything".
    const partial = { ...currentState(), settings: { pollMinutes: 90 } };
    const { state } = normalizePopupState<Record<string, unknown>>(partial);
    const settings = state["settings"] as Record<string, unknown>;
    expect(settings["pollMinutes"]).toBe(90);
    expect(settings["hideSubmitted"]).toBe(DEFAULT_SETTINGS.hideSubmitted);
    expect(settings["leadTimes"]).toEqual(DEFAULT_SETTINGS.leadTimes);
  });

  it("does not report settings, which the popup already defaulted", () => {
    // The popup carried `response.settings ?? DEFAULT_SETTINGS` before any of
    // this existed. Reporting it now would raise a banner on builds that were
    // already handling it correctly.
    const without = currentState();
    delete without["settings"];
    const { state, missing } = normalizePopupState<Record<string, unknown>>(without);
    expect(missing).toEqual([]);
    expect(state["settings"]).toEqual(DEFAULT_SETTINGS);
  });
});

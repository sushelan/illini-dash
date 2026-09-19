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
    courseNames: { CS424: "Distributed Systems" },
    /*
     * Both keys, because both rows index into this map by name and "a current
     * worker" is what the same-build case means: a page that reads
     * `observers.piazza` off a worker that has never heard of Piazza gets
     * `undefined`, which renders as "Off" — the student's own switch — with no
     * banner to say the worker is the stale half.
     */
    observers: {
      campuswire: { enabled: true, postsSeen: 3 },
      piazza: { enabled: false },
    },
    /*
     * Added when Google Calendar landed, in the same change as the field.
     *
     * This test's list is what "a current worker" means, so leaving the new
     * field out of it would have made the same-build case report `gcal` as
     * missing forever — the banner crying wolf on the happy path, which is the
     * defect the preview harness already had to be fixed for.
     */
    gcal: { enabled: false, byItemId: {}, state: "never" },
    lastSyncAt: "2026-09-10T18:00:00.000Z",
  };
}

describe("normalizeOptionsState", () => {
  it("empties observers an older worker never sent, rather than throwing on them", () => {
    // Worker rule 8, on the field this change added, in the same change. The
    // Campuswire row indexes into this to decide what its switch says, so a
    // worker from before it would throw in the middle of the sources list.
    const old = current();
    delete old["observers"];
    const { state, missing } = normalizeOptionsState<Record<string, unknown>>(old);
    // Once, not three times: the keys inside it are filled in under a parent
    // the notice already names.
    expect(missing).toEqual(["observers"]);
    expect(state["observers"]).toEqual({ campuswire: {}, piazza: {} });
  });

  it("names the observer key an older worker does not know about", () => {
    /*
     * The trace's case, and the reason a top-level "map" is not enough: a
     * pre-Piazza worker sends `observers: {campuswire: {…}}`, which is a
     * perfectly good record. Nothing was reported missing, the row read
     * `observers.piazza` as undefined and said "Off" — the student's own
     * switch — and the click that followed granted the host permission and
     * *then* reached a worker with no such observer, which put
     * "Cannot set properties of undefined" in the row hint instead of the one
     * sentence that ends the investigation.
     */
    const old = current();
    old["observers"] = { campuswire: { enabled: true, postsSeen: 3 } };
    const { state, missing } = normalizeOptionsState<Record<string, unknown>>(old);
    expect(missing).toEqual(["observers.piazza"]);
    expect(staleWorkerNotice(missing)).toContain("observers.piazza");
    const observers = state["observers"] as Record<string, unknown>;
    expect(observers["piazza"]).toEqual({});
    // What the worker did send is left exactly as it was.
    expect(observers["campuswire"]).toEqual({ enabled: true, postsSeen: 3 });
    // And the message it was given is not written into (`does not mutate`).
    expect((old["observers"] as Record<string, unknown>)["piazza"]).toBeUndefined();
  });

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
      "courseNames",
      "courses",
      "doneItems",
      // The Google Calendar section reads `.enabled` and `.state` off this and
      // is drawn before Courses, so an older worker would have taken the page
      // down with two of eight sections painted.
      "gcal",
      "hiddenItems",
      "observers",
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
    // An older worker sends no renames, and "no renames" is the derived label
    // everywhere — never a guess at what the student might have called it.
    expect(state["courseNames"]).toEqual({});
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
      // Every field the page dereferences, named. The count moves whenever a
      // field is added — it was 8 before `gcal` — and that is the point: a new
      // field the page reads and `compat.ts` does not know about is the next
      // half-drawn options page.
      expect(missing.length, String(junk)).toBe(9);
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
      courseNames: {},
      suggestions: [],
      observers: { piazza: { enabled: false }, campuswire: { enabled: false } },
      lastSyncAt: "2026-09-10T18:00:00.000Z",
    };
  }

  it("passes a same-build message through untouched", () => {
    const message = currentState();
    const { state, missing } = normalizePopupState<Record<string, unknown>>(message);
    expect(missing).toEqual([]);
    expect(state).toEqual(message);
  });

  it("guards the fields the popup dereferences immediately", () => {
    // `renderDots` iterates sources and `render` iterates items, both before
    // anything is drawn — so either one missing is a blank popup. `courseNames`
    // joined them when renaming landed: every row looks a course up in it, so
    // an older worker's message would throw once per row rather than once.
    const { state, missing } = normalizePopupState<Record<string, unknown>>({ type: "state" });
    // `suggestions` joined them with the post observer: the Attention tab reads
    // `.length` on it to draw its count, so a worker from before that field
    // existed would throw after the tabs were drawn and before the list was.
    expect([...missing].sort()).toEqual(["courseNames", "items", "observers", "sources", "suggestions"]);
    expect(state["items"]).toEqual([]);
    expect(state["sources"]).toEqual({});
  });

  it("empties suggestions an older worker never sent, rather than throwing on them", () => {
    // Worker rule 8, on the field this change added. `[]` is the right absence:
    // it is what the tab said before suggestions existed.
    const without = currentState();
    delete without["suggestions"];
    const { state, missing } = normalizePopupState<Record<string, unknown>>(without);
    expect(missing).toEqual(["suggestions"]);
    expect(state["suggestions"]).toEqual([]);
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

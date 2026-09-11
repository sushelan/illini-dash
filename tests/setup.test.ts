/**
 * First run (`src/core/setup.ts`).
 *
 * The decision this module exists to get right is *when not to show*. A setup
 * screen in front of someone who set up last week is worse than no setup screen
 * at all: it looks like the extension forgot everything.
 */

import { describe, expect, it } from "vitest";
import {
  loginsToOpen,
  needsSetup,
  setupProgress,
  setupRows,
  setupSummary,
} from "../src/core/setup.js";
import { emptyStore } from "../src/core/store.js";
import type { Source, SourceState } from "../src/sources/types.js";
import type { StoreV1Plus } from "../src/core/store.js";

function storeWith(
  sources: Partial<Record<Source, { enabled?: boolean; state?: SourceState; lastSuccessAt?: string }>>,
  extra: Partial<StoreV1Plus> = {},
): StoreV1Plus {
  const store = { ...emptyStore(), ...extra };
  for (const [source, patch] of Object.entries(sources)) {
    const key = source as Source;
    store.sources[key] = { ...store.sources[key]!, ...patch };
  }
  return store;
}

describe("needsSetup", () => {
  it("shows the screen on a genuinely fresh install", () => {
    expect(needsSetup(emptyStore())).toBe(true);
  });

  it("never shows it again once it has been finished", () => {
    expect(needsSetup(storeWith({}, { setupDoneAt: "2026-09-11T00:00:00.000Z" }))).toBe(false);
  });

  it("treats an install that has already read something as set up", () => {
    // The clause that matters on the day this ships. Every beta tester has a
    // working install and no `setupDoneAt`, so without this they get a setup
    // screen over data they already have — an upgrade that looks like a wipe.
    expect(needsSetup(storeWith({ canvas: { lastSuccessAt: "2026-09-10T18:00:00.000Z" } }))).toBe(
      false,
    );
  });

  it("is not satisfied by a source that was merely attempted", () => {
    // `lastAttemptAt` without `lastSuccessAt` is a failed fetch, which is the
    // state a student who is not signed in yet is actually in.
    expect(needsSetup(storeWith({ canvas: { state: "needs_login" } }))).toBe(true);
  });
});

describe("setupRows", () => {
  const rows = setupRows(emptyStore());

  it("offers the five sources a student chooses between", () => {
    expect(rows.map((row) => row.source)).toEqual([
      "canvas",
      "gradescope",
      "prairielearn",
      "prairietest",
      "smartphysics",
    ]);
  });

  it("does not offer course websites, which are chosen one at a time", () => {
    // §4.5 adapters need a per-site host permission, so a single checkbox for
    // "course websites" cannot mean anything — it was the exact control that
    // produced a green dot over nothing (worker rule 2).
    expect(rows.some((row) => row.source === "site")).toBe(false);
  });

  it("carries each source's default, so the common case needs no clicks", () => {
    const enabled = Object.fromEntries(rows.map((row) => [row.source, row.enabled]));
    expect(enabled["canvas"]).toBe(true);
    expect(enabled["gradescope"]).toBe(true);
    // Off by default: it serves PHYS 211-214 only, and everyone else would get
    // a sign-in prompt for a site they have never heard of.
    expect(enabled["smartphysics"]).toBe(false);
  });

  it("says who each site is for", () => {
    // A checklist of names nobody recognises cannot be answered, and the
    // expensive mistake here is unchecking something you do need.
    for (const row of rows) expect(row.hint.length, row.source).toBeGreaterThan(0);
    expect(rows.find((row) => row.source === "smartphysics")!.hint).toContain("211");
  });

  it("reflects a choice the student has already made", () => {
    const rows2 = setupRows(storeWith({ prairietest: { enabled: false } }));
    expect(rows2.find((row) => row.source === "prairietest")!.enabled).toBe(false);
  });
});

describe("loginsToOpen", () => {
  it("opens only the sites the student said they use", () => {
    const rows = setupRows(storeWith({ prairietest: { enabled: false } }));
    expect(loginsToOpen(rows)).not.toContain("prairietest");
  });

  it("includes a source that has not been fetched yet", () => {
    // On a first run everything is pending. A strict "needs_login only" list
    // would be empty at exactly the moment this button exists for.
    expect(loginsToOpen(setupRows(emptyStore()))).toContain("canvas");
  });

  it("skips a source that is already working", () => {
    const rows = setupRows(
      storeWith({ canvas: { state: "ok", lastSuccessAt: "2026-09-10T18:00:00.000Z" } }),
    );
    expect(loginsToOpen(rows)).not.toContain("canvas");
  });

  it("includes one that asked for a sign-in", () => {
    expect(loginsToOpen(setupRows(storeWith({ gradescope: { state: "needs_login" } })))).toContain(
      "gradescope",
    );
  });

  it("skips one that failed for a reason signing in will not fix", () => {
    // A parse error means the page changed. Opening its login page tells the
    // student to do something that cannot help.
    const rows = setupRows(storeWith({ gradescope: { state: "parse_error" } }));
    expect(loginsToOpen(rows)).not.toContain("gradescope");
  });
});

describe("setupProgress and setupSummary", () => {
  const ok = "2026-09-10T18:00:00.000Z";

  it("counts only the sources the student chose", () => {
    const rows = setupRows(
      storeWith({
        canvas: { lastSuccessAt: ok },
        prairietest: { enabled: false, lastSuccessAt: ok },
      }),
    );
    const progress = setupProgress(rows);
    expect(progress.chosen).toBe(3);
    expect(progress.connected).toBe(1);
  });

  it("never claims a source works before anything has been read", () => {
    // The fresh-install green dot, one level up (worker rule 2): "connected"
    // has to mean a fetch happened and succeeded.
    expect(setupProgress(setupRows(emptyStore()))).toMatchObject({ connected: 0, working: false });
  });

  it("says what is left rather than only how far along it is", () => {
    const rows = setupRows(storeWith({ canvas: { lastSuccessAt: ok } }));
    expect(setupSummary(setupProgress(rows))).toContain("sign in");
  });

  it("handles the student who unchecked everything", () => {
    const none = setupRows(
      storeWith({
        canvas: { enabled: false },
        gradescope: { enabled: false },
        prairielearn: { enabled: false },
        prairietest: { enabled: false },
      }),
    );
    expect(setupProgress(none).chosen).toBe(0);
    expect(setupSummary(setupProgress(none))).toContain("Nothing selected");
  });

  it("says so when everything chosen is working", () => {
    const all = setupRows(
      storeWith({
        canvas: { lastSuccessAt: ok },
        gradescope: { lastSuccessAt: ok },
        prairielearn: { lastSuccessAt: ok },
        prairietest: { lastSuccessAt: ok },
      }),
    );
    expect(setupSummary(setupProgress(all))).toBe("All 4 connected.");
  });

  it("counts one site as a site, not sites", () => {
    const one = setupRows(
      storeWith({
        gradescope: { enabled: false },
        prairielearn: { enabled: false },
        prairietest: { enabled: false },
      }),
    );
    expect(setupSummary(setupProgress(one))).toContain("1 site.");
  });
});

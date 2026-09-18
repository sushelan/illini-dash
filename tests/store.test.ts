/**
 * Loading a store written by an older build.
 *
 * During a beta week fixes ship to stores nobody can see or reset, so the
 * question this pins is not "does a future migration work" but "does today's
 * build read yesterday's data without losing anything the student did".
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { migrate } from "../src/core/store.js";

const V1 = JSON.parse(
  readFileSync(new URL("../fixtures/store/v1.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

describe("a committed schemaVersion 1 store", () => {
  const store = migrate(structuredClone(V1));

  it("keeps every correction the student made", () => {
    // These are the fields whose silent loss would be unrecoverable and
    // invisible: the student would simply find their split re-merged.
    expect(store.overrides.hiddenKeys).toEqual(["site:cs424-fa26:hw1"]);
    expect(store.overrides.splitKeys).toEqual(["prairielearn:224254:HW3"]);
    expect(store.overrides.disabledCourses).toEqual(["BUS_ILBC_OPEN"]);
    expect(store.overrides.mergeGroups).toEqual([
      ["canvas:assignment:9002", "gradescope:8398957"],
    ]);
  });

  it("keeps what has already been notified, so nothing re-fires", () => {
    expect(store.items[0]!.notified).toEqual({ "24h": "2026-09-08T17:00:00.000Z" });
  });

  it("keeps per-source health, backoff, misses and enabled adapters", () => {
    expect(store.sources.gradescope.state).toBe("needs_login");
    expect(store.sources.gradescope.consecutiveFailures).toBe(3);
    expect(store.sources.gradescope.lastError).toContain("401");
    expect(store.backoffUntil.gradescope).toBe("2026-09-10T15:00:00.000Z");
    expect(store.misses["site:cs424-fa26:hw1"]).toBe(1);
    expect(store.enabledAdapters).toEqual(["cs424-fa26"]);
    expect(store.lastSyncAt).toBe("2026-09-10T13:00:00.000Z");
  });

  it("fills in fields the older build never wrote", () => {
    // Added after this snapshot: the tick-off list and the not-for-credit
    // reminder switch. A store missing them must not lose the rest.
    expect(store.overrides.doneKeys).toEqual([]);
    expect(store.settings.remindNotForCredit).toBe(false);
  });

  it("drops a half-written raw entry instead of passing it on as real", () => {
    // `gradescope:junk` has no sourceId, url or fetchedAt. `gradescope:empty`
    // has all of them and an empty `sourceId`, which `typeof x === "string"`
    // accepts — house rule 5's whole point, and the one that would produce a
    // memberKey of `gradescope:` shared by every such row. Cast rather than
    // checked, both reached dedupe, grouping and schedule looking real.
    expect(Object.keys(store.raw).sort()).toEqual([
      "gradescope:8398957",
      "site:cs424-fa26:hw1",
    ]);
  });

  it("drops items that are not items, and keeps the one that is", () => {
    expect(store.items).toHaveLength(1);
    expect(store.items[0]!.id).toBe("abc123def456");
  });

  it("keeps a usable raw item whole, including extra", () => {
    const site = store.raw["site:cs424-fa26:hw1"]!;
    expect(site.extra?.["timeAssumed"]).toBe("true");
    expect(site.dueAt).toBe("2026-09-08T23:59:00-05:00");
  });

  it("does not mutate the stored blob it was handed", () => {
    const before = JSON.stringify(V1);
    migrate(structuredClone(V1));
    expect(JSON.stringify(V1)).toBe(before);
  });

  it("survives a store that is not a store at all", () => {
    for (const junk of [null, undefined, 42, "text", []]) {
      expect(() => migrate(junk)).not.toThrow();
    }
    expect(migrate(null).items).toEqual([]);
  });
});

describe("setupDoneAt — the upgrade, exactly once", () => {
  /*
   * The clause that decides whether a beta tester's next update looks like a
   * wipe. `needsSetup` originally asked "has any source ever succeeded?" live,
   * which covered the upgrade and broke Reset: the popup fires a sync on open,
   * that sync succeeds because the browser is still signed in, and setup
   * completed itself about a second after Reset was pressed.
   *
   * So the question is asked once, of a blob written by a build that predates
   * the field, and never again.
   */
  const OK = "2026-09-10T18:00:00.000Z";
  const LATER = "2026-09-10T20:00:00.000Z";

  function stored(patch: Record<string, unknown>): Record<string, unknown> {
    return {
      schemaVersion: 1,
      raw: {},
      items: [],
      sources: {},
      overrides: {},
      settings: {},
      ...patch,
    };
  }

  it("stamps a working install written before the field existed", () => {
    const store = migrate(
      stored({ sources: { canvas: { source: "canvas", enabled: true, state: "ok", lastSuccessAt: OK, consecutiveFailures: 0 } } }),
    );
    expect(store.setupDoneAt).toBe(OK);
  });

  it("stamps the real v1 capture, which is what a tester actually has", () => {
    expect(migrate(V1).setupDoneAt).toBeDefined();
  });

  it("uses the newest success, not whichever source came first", () => {
    const store = migrate(
      stored({
        sources: {
          canvas: { source: "canvas", enabled: true, state: "ok", lastSuccessAt: OK, consecutiveFailures: 0 },
          gradescope: { source: "gradescope", enabled: true, state: "ok", lastSuccessAt: LATER, consecutiveFailures: 0 },
        },
      }),
    );
    expect(store.setupDoneAt).toBe(LATER);
  });

  it("leaves an old install that never worked needing setup", () => {
    // Installed, never signed in. That student never finished setting up, so
    // the screen is exactly what they should get.
    const store = migrate(
      stored({ sources: { canvas: { source: "canvas", enabled: true, state: "needs_login", consecutiveFailures: 1 } } }),
    );
    expect(store.setupDoneAt).toBeUndefined();
  });

  it("does not stamp a current store, however well it is doing", () => {
    // The Reset case. After `chrome.storage.local.clear()` the next save is at
    // the current version, so a sync that succeeds cannot retroactively claim
    // the student finished a screen they never saw.
    const store = migrate(
      stored({
        schemaVersion: 2,
        sources: { canvas: { source: "canvas", enabled: true, state: "ok", lastSuccessAt: OK, consecutiveFailures: 0 } },
      }),
    );
    expect(store.setupDoneAt).toBeUndefined();
  });

  it("keeps a stamp the student earned by finishing the screen", () => {
    expect(migrate(stored({ schemaVersion: 2, setupDoneAt: OK })).setupDoneAt).toBe(OK);
  });

  it("treats a blob with no version at all as pre-2", () => {
    // `undefined` is not a number, and comparing it as one is how a very old
    // store would have been mistaken for a current one.
    const store = migrate({
      sources: { canvas: { source: "canvas", enabled: true, state: "ok", lastSuccessAt: OK, consecutiveFailures: 0 } },
    });
    expect(store.setupDoneAt).toBe(OK);
  });
});

/**
 * `manualItems` — the one list in the store that exists in exactly one place.
 *
 * A fetched row that is dropped on load comes back on the next sync. A
 * hand-typed one does not come back at all, so both directions matter: nothing
 * valid may be discarded, and nothing half-written may be kept.
 */
describe("the student's own deadlines, across a reload", () => {
  const typed = {
    source: "manual",
    sourceId: "uuid-1",
    courseRaw: "RHET 105",
    title: "Essay draft",
    kind: "assignment",
    dueAt: "2026-09-30T23:59:00-05:00",
    status: "unknown",
    extra: { timeAssumed: "true" },
    fetchedAt: "2026-09-18T13:00:00.000Z",
  };

  it("keeps a row that has no link, which is the whole point of the field", () => {
    // `isUsableRaw` required a non-empty `url` until `RawItem.url` became
    // optional. Left alone, every hand-typed deadline without a link would have
    // been dropped on the next load — silently, and with nothing to restore it.
    const store = migrate({ manualItems: [typed] });
    expect(store.manualItems).toHaveLength(1);
    expect(store.manualItems[0]!.title).toBe("Essay draft");
    expect(store.manualItems[0]!.extra?.["timeAssumed"]).toBe("true");
  });

  it("still refuses a half-written one", () => {
    // Same bar the fetched rows clear: a missing sourceId would produce the
    // memberKey `manual:`, shared by every such row (house rule 4), and an empty
    // string passes `typeof x === "string"` (house rule 5).
    const store = migrate({
      manualItems: [
        typed,
        { source: "manual", title: "no id, no stamp" },
        { ...typed, sourceId: "" },
        { ...typed, url: "" },
        "not an object",
      ],
    });
    expect(store.manualItems.map((item) => item.sourceId)).toEqual(["uuid-1"]);
  });

  it("is an empty list in a store written before the field existed", () => {
    expect(migrate(structuredClone(V1)).manualItems).toEqual([]);
    expect(migrate({ manualItems: "nope" }).manualItems).toEqual([]);
  });
});

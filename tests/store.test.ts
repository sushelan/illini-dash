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

/**
 * The sync gate (`core/sync-gate.ts`).
 *
 * Regression for the gate that was `if (running) { await running; return {
 * skipped: true } }` in the worker: the recheck that fires when a student lands
 * back on PrairieLearn after signing in arrived while another sync was running
 * and was thrown away, so the source kept `needs_login` until the next alarm
 * (PROGRESS.md, "Still open — PrairieLearn and PrairieTest have a delay to show
 * connected").
 */

import { describe, expect, it } from "vitest";
import { createSyncGate } from "../src/core/sync-gate.js";
import type { SyncTrigger } from "../src/core/sync.js";

interface Harness {
  gate: ReturnType<typeof createSyncGate<string>>;
  /** Triggers in the order `run` was called. */
  runs: SyncTrigger[];
  /** Finish the nth run (0-based); `fail` rejects it instead. */
  finish(n: number, fail?: boolean): Promise<void>;
  lines: string[];
  /** Whether run n had started when run n-1 had not yet settled. */
  overlaps: boolean;
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

function harness(onRun?: (trigger: SyncTrigger) => string): Harness {
  const runs: SyncTrigger[] = [];
  const settles: { resolve: (v: string) => void; reject: (e: unknown) => void }[] = [];
  const lines: string[] = [];
  let active = 0;
  const h: Harness = {
    runs,
    lines,
    overlaps: false,
    gate: createSyncGate<string>(
      (trigger) => {
        runs.push(trigger);
        active += 1;
        if (active > 1) h.overlaps = true;
        const value = onRun ? onRun(trigger) : `${trigger}#${runs.length}`;
        return new Promise<string>((resolve, reject) => {
          settles.push({
            resolve: () => {
              active -= 1;
              resolve(value);
            },
            reject: (e) => {
              active -= 1;
              reject(e);
            },
          });
        });
      },
      { log: (line) => lines.push(line) },
    ),
    async finish(n, fail = false) {
      const s = settles[n]!;
      if (fail) s.reject(new Error("offline"));
      else s.resolve("");
      await flush();
    },
  };
  return h;
}

describe("createSyncGate", () => {
  it("runs a request at once when nothing is in flight", async () => {
    const h = harness();
    const done = h.gate.request("alarm");
    expect(h.runs).toEqual(["alarm"]);
    expect(h.gate.inFlight()).toBe("alarm");
    await h.finish(0);
    await expect(done).resolves.toBe("alarm#1");
    expect(h.gate.inFlight()).toBeUndefined();
  });

  it("a recheck during a run produces exactly one follow-up, after the run", async () => {
    const h = harness();
    void h.gate.request("popup");
    const recheck = h.gate.request("recheck");
    await flush();
    // Not started while the first is in flight: two runs would race on the store.
    expect(h.runs).toEqual(["popup"]);
    await h.finish(0);
    expect(h.runs).toEqual(["popup", "recheck"]);
    await h.finish(1);
    await expect(recheck).resolves.toBe("recheck#2");
    await flush();
    expect(h.runs).toEqual(["popup", "recheck"]);
    expect(h.overlaps).toBe(false);
    expect(h.lines).toContain(
      "[sync] recheck requested while a popup sync is in flight — queued as a follow-up",
    );
  });

  it("three requests during a run produce one follow-up, with the strongest trigger", async () => {
    const h = harness();
    void h.gate.request("alarm");
    const a = h.gate.request("recheck");
    const b = h.gate.request("manual");
    const c = h.gate.request("recheck");
    await h.finish(0);
    expect(h.runs).toEqual(["alarm", "manual"]);
    await h.finish(1);
    // Every coalesced caller is answered by the one follow-up.
    await expect(Promise.all([a, b, c])).resolves.toEqual(["manual#2", "manual#2", "manual#2"]);
    await flush();
    expect(h.runs).toHaveLength(2);
    expect(h.lines).toContain(
      "[sync] manual requested while a alarm sync is in flight — coalesced into the pending manual",
    );
    // A weaker request does not downgrade the pending follow-up.
    expect(h.lines).toContain(
      "[sync] recheck requested while a alarm sync is in flight — coalesced into the pending manual",
    );
  });

  it("strength is ordered, not first-come: an alarm then an install follows up as install", async () => {
    const h = harness();
    void h.gate.request("popup");
    void h.gate.request("alarm");
    void h.gate.request("install");
    await h.finish(0);
    expect(h.runs).toEqual(["popup", "install"]);
  });

  it("an alarm during a run is still followed up: the run in flight may be a debounced popup that read nothing", async () => {
    // Dropping it would cost a whole poll interval (FOLLOW_UP_STRENGTH's comment).
    const h = harness();
    void h.gate.request("popup");
    const alarm = h.gate.request("alarm");
    await h.finish(0);
    expect(h.runs).toEqual(["popup", "alarm"]);
    await h.finish(1);
    await expect(alarm).resolves.toBe("alarm#2");
  });

  it("two rechecks coalesce into one", async () => {
    const h = harness();
    void h.gate.request("manual");
    void h.gate.request("recheck");
    void h.gate.request("recheck");
    await h.finish(0);
    await h.finish(1);
    expect(h.runs).toEqual(["manual", "recheck"]);
  });

  it("a popup request during a run is not followed up, and is answered by the run in flight", async () => {
    const h = harness();
    const first = h.gate.request("alarm");
    const popup = h.gate.request("popup");
    await h.finish(0);
    expect(h.runs).toEqual(["alarm"]);
    await expect(popup).resolves.toBe(await first);
    expect(h.lines).toContain(
      "[sync] popup requested while a alarm sync is in flight — not followed up (popup)",
    );
  });

  it("the follow-up runs after the first settles even when the first rejects", async () => {
    const h = harness();
    const first = h.gate.request("popup");
    first.catch(() => undefined);
    const recheck = h.gate.request("recheck");
    await h.finish(0, true);
    await expect(first).rejects.toThrow("offline");
    expect(h.runs).toEqual(["popup", "recheck"]);
    await h.finish(1);
    await expect(recheck).resolves.toBe("recheck#2");
  });

  it("a follow-up that rejects rejects every caller it served", async () => {
    const h = harness();
    void h.gate.request("popup");
    const a = h.gate.request("recheck");
    const b = h.gate.request("manual");
    a.catch(() => undefined);
    b.catch(() => undefined);
    await h.finish(0);
    await h.finish(1, true);
    await expect(a).rejects.toThrow("offline");
    await expect(b).rejects.toThrow("offline");
  });

  it("a request during the follow-up queues again", async () => {
    const h = harness();
    void h.gate.request("popup");
    void h.gate.request("recheck");
    await h.finish(0);
    expect(h.gate.inFlight()).toBe("recheck");
    const again = h.gate.request("manual");
    await flush();
    expect(h.runs).toEqual(["popup", "recheck"]);
    await h.finish(1);
    expect(h.runs).toEqual(["popup", "recheck", "manual"]);
    await h.finish(2);
    await expect(again).resolves.toBe("manual#3");
    expect(h.overlaps).toBe(false);
  });

  it("the follow-up is planned when it starts, so it sees a source switched on mid-run", async () => {
    // `run` reads the store when it is called — `syncOnce` loads it in its plan
    // hold — so a follow-up started after the first run settles sees the switch.
    let prairielearnEnabled = false;
    const h = harness(() => (prairielearnEnabled ? "attempted prairielearn" : "without it"));
    const first = h.gate.request("popup");
    prairielearnEnabled = true; // set-source-enabled lands mid-run…
    const afterEnable = h.gate.request("manual"); // …and syncAfterEnable asks.
    await h.finish(0);
    await h.finish(1);
    await expect(first).resolves.toBe("without it");
    await expect(afterEnable).resolves.toBe("attempted prairielearn");
  });

  it("a run that throws synchronously still settles and still starts its follow-up", async () => {
    let calls = 0;
    const gate = createSyncGate<string>(
      (trigger) => {
        calls += 1;
        if (calls === 1) throw new Error("sync threw");
        return Promise.resolve(trigger);
      },
      { log: () => undefined },
    );
    const first = gate.request("alarm");
    const second = gate.request("recheck");
    await expect(first).rejects.toThrow("sync threw");
    await expect(second).resolves.toBe("recheck");
  });
});

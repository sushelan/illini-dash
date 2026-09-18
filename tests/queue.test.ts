/**
 * The store's serializing queue (§3).
 *
 * The exclusion tests are the regression for the defect the re-entrancy flag
 * caused: `held` stayed true across every await the holder made, so a click
 * arriving while `sync()` was fetching ran unqueued and was then overwritten by
 * the sync's own `saveStore` — worker house rule 4's exact symptom, inside the
 * primitive written to prevent it.
 *
 * What used to be here — "does not deadlock when work re-enters the queue" and
 * three siblings — pinned the *mechanism of the bug* (worker rule 6), so no
 * mutation could ever surface it. They are gone: re-entrancy is not supported,
 * the callers were restructured so none of them needs it (`core/sync.ts`'s
 * plan → fetch → apply, and the worker's short holds), and a section that
 * wedges the queue is reported by `slowHoldMs` instead.
 */

import { describe, expect, it } from "vitest";
import { createStoreQueue, SLOW_HOLD_MS } from "../src/core/queue.js";

const settled = <T>(promise: Promise<T>): Promise<"pending" | T> =>
  Promise.race([promise, new Promise<"pending">((r) => setTimeout(() => r("pending"), 25))]);

/** A deferred, for a section that is held open while something else arrives. */
function deferred(): { promise: Promise<void>; release: () => void } {
  let release = (): void => undefined;
  const promise = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  return { promise, release };
}

describe("createStoreQueue", () => {
  it("serializes overlapping work", async () => {
    const withStore = createStoreQueue();
    const order: string[] = [];
    const slow = async (name: string, ms: number) => {
      order.push(`${name}:start`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`${name}:end`);
    };
    await Promise.all([
      withStore(() => slow("a", 20)),
      withStore(() => slow("b", 1)),
    ]);
    // Not a:start, b:start, b:end, a:end — that is the interleaving §3 forbids.
    expect(order).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });

  it("makes a caller that arrives while a section is awaiting wait for it", async () => {
    // The repro from the trace: a section that awaits (a sync's fetches) and a
    // second caller that arrives during the await (a click). The old queue ran
    // the second caller immediately — `['outer:start','other','outer:end']`.
    const withStore = createStoreQueue();
    const gate = deferred();
    const order: string[] = [];

    const outer = withStore(async () => {
      order.push("outer:start");
      await gate.promise;
      order.push("outer:end");
    });
    // Arrives after the holder has started and gone to sleep.
    await new Promise((r) => setTimeout(r, 5));
    const other = withStore(async () => {
      order.push("other");
    });

    expect(await settled(other)).toBe("pending");
    expect(order).toEqual(["outer:start"]);
    gate.release();
    await Promise.all([outer, other]);
    expect(order).toEqual(["outer:start", "outer:end", "other"]);
  });

  it("keeps the write of a caller that arrived during a held section", async () => {
    /*
     * The same thing at the level the student sees it: a "sync" that loads the
     * store, awaits its fetches and writes back, and a "hide" that lands in the
     * middle. With the old queue the hide was written and then overwritten by
     * the sync's copy, with no error and a control that sprang back; here it is
     * applied to the store the sync leaves behind.
     */
    const withStore = createStoreQueue();
    let store = { hidden: [] as string[], items: [] as string[] };
    const load = async () => ({ hidden: [...store.hidden], items: [...store.items] });
    const save = async (next: typeof store) => {
      store = next;
    };
    const fetches = deferred();

    const sync = withStore(async () => {
      const loaded = await load();
      await fetches.promise;
      loaded.items = ["hw1"];
      await save(loaded);
    });
    await new Promise((r) => setTimeout(r, 5));
    const hide = withStore(async () => {
      const loaded = await load();
      loaded.hidden = [...loaded.hidden, "hw1"];
      await save(loaded);
    });

    fetches.release();
    await Promise.all([sync, hide]);
    expect(store).toEqual({ hidden: ["hw1"], items: ["hw1"] });
  });

  it("lets a later caller through after an earlier one throws", async () => {
    // A rejection must not strand everything queued behind it.
    const withStore = createStoreQueue();
    const failed = withStore(async () => {
      throw new Error("boom");
    });
    await expect(failed).rejects.toThrow("boom");
    expect(await settled(withStore(async () => "after"))).toBe("after");
  });

  it("names a section that holds the store too long", async () => {
    // The only way a deadlock or a fetch inside a hold says anything at all.
    const lines: string[] = [];
    let clock = 0;
    const withStore = createStoreQueue({
      now: () => clock,
      warn: (line) => lines.push(line),
      slowHoldMs: 100,
    });
    await withStore(async () => {
      clock = 3_400;
    }, "sync: apply");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('"sync: apply"');
    expect(lines[0]).toContain("3.4s");
  });

  it("says nothing about a section that holds the store briefly", async () => {
    const lines: string[] = [];
    let clock = 0;
    const withStore = createStoreQueue({
      now: () => clock,
      warn: (line) => lines.push(line),
      slowHoldMs: 100,
    });
    await withStore(async () => {
      clock = 99;
    }, "mutate");
    expect(lines).toEqual([]);
  });

  it("reports a section that threw as well as one that returned", async () => {
    // The wedge case throws as often as it returns, and a warning that only
    // fires on the happy path would be silent exactly when it is needed.
    const lines: string[] = [];
    let clock = 0;
    const withStore = createStoreQueue({
      now: () => clock,
      warn: (line) => lines.push(line),
      slowHoldMs: 100,
    });
    await expect(
      withStore(async () => {
        clock = 5_000;
        throw new Error("boom");
      }, "gcal: push"),
    ).rejects.toThrow("boom");
    expect(lines[0]).toContain('"gcal: push"');
  });

  it("holds a real default threshold", () => {
    // A store write is single-digit milliseconds; two seconds is the network.
    expect(SLOW_HOLD_MS).toBe(2_000);
  });
});

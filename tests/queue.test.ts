/**
 * The store's serializing queue (§3).
 *
 * The re-entrancy tests are a regression for a deadlock that lived in the
 * service worker, which the suite could not reach: sync() held the queue for a
 * whole run and called reschedule() → fireNotification(), which asked for the
 * queue again. The inner request chained onto a tail that could not resolve
 * until the outer work returned, and the outer work was awaiting the inner.
 *
 * It wedged the queue permanently — `running` never cleared, so every later
 * sync returned skipped until Chrome happened to tear the worker down. It fired
 * the first time a reminder came due during a sync, which on real data was
 * about twenty minutes away.
 */

import { describe, expect, it } from "vitest";
import { createStoreQueue } from "../src/core/queue.js";

const settled = <T>(promise: Promise<T>): Promise<"pending" | T> =>
  Promise.race([promise, new Promise<"pending">((r) => setTimeout(() => r("pending"), 25))]);

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

  it("does not deadlock when work re-enters the queue", async () => {
    const withStore = createStoreQueue();
    const outer = withStore(async () => {
      await withStore(async () => "inner");
      return "outer";
    });
    expect(await settled(outer)).toBe("outer");
  });

  it("does not deadlock three levels deep", async () => {
    // sync → reschedule → fireNotification is two; leave headroom.
    const withStore = createStoreQueue();
    const deep = withStore(() =>
      withStore(() => withStore(async () => "bottom")),
    );
    expect(await settled(deep)).toBe("bottom");
  });

  it("keeps serializing after a re-entrant call", async () => {
    // The re-entrancy flag must be cleared on the way out, or the very next
    // caller runs unqueued and the queue silently stops being a queue.
    const withStore = createStoreQueue();
    await withStore(() => withStore(async () => undefined));

    const order: string[] = [];
    await Promise.all([
      withStore(async () => {
        order.push("a:start");
        await new Promise((r) => setTimeout(r, 20));
        order.push("a:end");
      }),
      withStore(async () => {
        order.push("b:start");
      }),
    ]);
    expect(order).toEqual(["a:start", "a:end", "b:start"]);
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

  it("clears the re-entrancy flag when re-entrant work throws", async () => {
    const withStore = createStoreQueue();
    await expect(
      withStore(async () => {
        await withStore(async () => {
          throw new Error("inner boom");
        });
      }),
    ).rejects.toThrow("inner boom");
    expect(await settled(withStore(async () => "after"))).toBe("after");
  });
});

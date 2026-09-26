/**
 * Pushes and Disconnect, one at a time (`src/core/gcal-lane.ts`).
 *
 * The defect is from a live log (2026-09-25): a Disconnect pressed during
 * Connect's first push removed "0 events" because the push had not saved its
 * index yet, and the push then finished onto a calendar being deleted.
 */

import { describe, expect, it } from "vitest";
import { createGcalLane } from "../src/core/gcal-lane.js";

function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

describe("the Google Calendar lane", () => {
  it("makes a Disconnect wait for the push already under way", async () => {
    const lane = createGcalLane();
    const log: string[] = [];
    const g = gate();
    const push = lane.run("push", async () => {
      log.push("push start");
      await g.opened;
      log.push("push saved its index");
    });
    const disconnect = lane.run("disconnect", async () => {
      log.push("disconnect reads the index");
    });
    await Promise.resolve();
    g.open();
    await Promise.all([push, disconnect]);
    expect(log).toEqual(["push start", "push saved its index", "disconnect reads the index"]);
  });

  it("answers a second push request with the one still waiting", async () => {
    // A burst of clicks is a push each; the waiting one reads the store when it
    // starts, so it already covers them all.
    const lane = createGcalLane();
    const g = gate();
    const started = gate();
    let runs = 0;
    const running = lane.run("push", async () => {
      runs += 1;
      started.open();
      await g.opened;
    });
    await started.opened;
    const waiting = lane.run("push", async () => {
      runs += 1;
    });
    const coalesced = lane.run("push", async () => {
      runs += 1;
    });
    g.open();
    await Promise.all([running, waiting, coalesced]);
    expect(runs).toBe(2);
  });

  it("never folds a push into one queued before a Disconnect", async () => {
    // The push asked for after Disconnect must run after it — where it finds
    // sync off — not be answered by a push that ran while sync was still on.
    const lane = createGcalLane();
    const g = gate();
    const log: string[] = [];
    const started = gate();
    const first = lane.run("push", async () => {
      started.open();
      await g.opened;
      log.push("push 1");
    });
    await started.opened;
    const second = lane.run("push", async () => void log.push("push 2"));
    const off = lane.run("disconnect", async () => void log.push("disconnect"));
    const third = lane.run("push", async () => void log.push("push 3"));
    g.open();
    await Promise.all([first, second, off, third]);
    expect(log).toEqual(["push 1", "push 2", "disconnect", "push 3"]);
  });

  it("folds a request into a push that has not started yet", async () => {
    // Not started means it has not read the store, so it will see whatever the
    // second request was for.
    const lane = createGcalLane();
    let runs = 0;
    await Promise.all([
      lane.run("push", async () => void (runs += 1)),
      lane.run("push", async () => void (runs += 1)),
    ]);
    expect(runs).toBe(1);
  });

  it("does not strand the next operation behind one that failed", async () => {
    const lane = createGcalLane();
    const failed = lane.run("push", async () => {
      throw new Error("google is down");
    });
    await expect(failed).rejects.toThrow("google is down");
    await expect(lane.run("disconnect", async () => "ran")).resolves.toBe("ran");
  });
});

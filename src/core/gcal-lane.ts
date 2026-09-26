/**
 * One Google Calendar operation at a time: pushes and Disconnect.
 *
 * A push is dozens of Google requests, so it cannot hold the store queue
 * (worker rule 4) — and nothing else stopped two of them overlapping. On
 * 2026-09-25 a Disconnect pressed during Connect's first push read an index
 * that push had not saved yet, "removed 0 events", and the push then finished
 * and reported 37 events on a calendar being deleted under it. It came out
 * right only because deleting the calendar takes its events with it; a refused
 * calendar delete would have left 37 untracked events in the student's Google
 * account, and a push finishing after Disconnect's reset would have written the
 * dead calendar's id back. Two overlapping pushes are the same shape: both
 * insert the same new deadline and the calendar shows it twice.
 *
 * Its own lane, not the store queue: every write inside a push still takes the
 * store queue for a moment and lets clicks through, while this only makes
 * Google operations wait for each other.
 *
 * **Pushes coalesce.** A push is triggered after every sync and every override,
 * so a burst of clicks would otherwise queue a push per click. A push that is
 * still *waiting* already reads the store when it starts, so a second request
 * for one is answered by it. A Disconnect never coalesces, and a push requested
 * after a Disconnect was queued runs after it — where it finds sync switched off
 * and does nothing.
 */

export type GcalOp = "push" | "disconnect";

export interface GcalLane {
  run<T>(op: GcalOp, work: () => Promise<T>): Promise<T | undefined>;
}

export function createGcalLane(): GcalLane {
  let tail: Promise<unknown> = Promise.resolve();
  // The push that is queued and has not started, if any.
  let waitingPush: Promise<unknown> | undefined;

  return {
    run<T>(op: GcalOp, work: () => Promise<T>): Promise<T | undefined> {
      if (op === "push" && waitingPush !== undefined) {
        return waitingPush as Promise<T | undefined>;
      }
      const next = tail.then(() => {
        if (op === "push" && waitingPush === next) waitingPush = undefined;
        return work();
      });
      if (op === "push") waitingPush = next;
      else waitingPush = undefined; // a later push must queue behind this
      // The swallowed copy, as in `core/queue.ts`: one caller's rejection is
      // delivered to that caller and must not strand everything behind it.
      tail = next.catch(() => undefined);
      return next;
    },
  };
}

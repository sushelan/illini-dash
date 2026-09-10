/**
 * The store's serializing queue (§3).
 *
 * `chrome.storage.local.get` hands back a fresh copy, so two overlapping
 * read-modify-writes lose one side wholesale: a sync landing over a
 * notification restores the empty `notified` and §7 fires the same reminder
 * again, and a sync landing over a hide reverts it — spending one of §9 G3's
 * two corrections a semester.
 *
 * Lives here rather than in the service worker because it is a concurrency
 * primitive with no `chrome` dependency, and because the worker is the one file
 * the test suite cannot reach — which is exactly where a deadlock hid.
 */
export interface StoreQueue {
  /** Runs `work` with exclusive access, re-entrantly if already inside. */
  <T>(work: () => Promise<T>): Promise<T>;
}

export function createStoreQueue(): StoreQueue {
  let tail: Promise<unknown> = Promise.resolve();
  /** True while queued work is on the stack — a marker, not a lock. */
  let held = false;

  return function withStore<T>(work: () => Promise<T>): Promise<T> {
    // Re-entrant by design, because the queue deadlocks otherwise: the sync
    // loop holds it across a whole run and calls reschedule(), which calls
    // fireNotification(), which asks for the queue again. The inner request
    // chains onto a tail that cannot resolve until the outer work returns, and
    // the outer work is awaiting the inner — so the queue wedges permanently
    // and every later sync is skipped until the worker is torn down.
    //
    // Running the inner work directly is safe rather than a shortcut: JS is
    // single-threaded, `held` is only true while an outer work function is on
    // the stack, and that outer holder already owns the section the inner work
    // needs. Exclusion against *other* callers is unaffected.
    if (held) return work();

    const run = async (): Promise<T> => {
      held = true;
      try {
        return await work();
      } finally {
        held = false;
      }
    };
    const next = tail.then(run);
    // The tail is the swallowed copy, never `next` itself: one caller's
    // rejection is delivered to that caller and must not strand everyone queued
    // behind it. (This is also why `.then(run)` needs no rejection handler —
    // `tail` cannot reject.)
    tail = next.catch(() => undefined);
    return next;
  };
}

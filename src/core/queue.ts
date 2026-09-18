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
 *
 * **Strictly exclusive.** It used to be re-entrant, marked by a module-level
 * `held` flag, and the comment claimed the flag was "only true while an outer
 * work function is on the stack". It is not: it stays true across every `await`
 * the holder makes, and the holder was `sync()`, which held the queue across
 * every fetch of a run — the whole loop plus all of Piazza's class, feed and
 * body requests. Any caller arriving in that window — a Hide, a tick, a rename,
 * an accept-suggestion, a tab event — saw `held === true`, ran unqueued, wrote
 * its change, and was overwritten seconds later by the sync's `saveStore` of a
 * store loaded before the click. No error; the control springs back. That is
 * worker house rule 4's exact defect, resurrected inside the primitive written
 * to prevent it, because a flag cannot tell a nested call from a concurrent one.
 *
 * So there is no fast path: every caller chains onto the tail and waits. Two
 * obligations follow, and they are on the *callers*:
 *
 * 1. **Nothing long-running may hold a section.** A fetch inside a section is
 *    now a fetch every click waits behind. `sync` is plan → fetch → apply: two
 *    short holds with the network in between (`core/sync.ts`).
 * 2. **No section may call `withStore` again**, directly or through anything it
 *    awaits — that deadlocks, permanently. There is no ambient way to detect it
 *    (a flag cannot distinguish the holder's own nested call from someone
 *    else's concurrent one, which is the bug above), so instead a section that
 *    outstays `slowHoldMs` says so by name. A deadlock is then one line in the
 *    console rather than a queue that silently stops.
 */
export interface StoreQueue {
  /**
   * Runs `work` with exclusive access to the store.
   *
   * `label` names the section in the slow-hold warning; it is the only thing
   * that tells a wedged queue apart from a slow one.
   */
  <T>(work: () => Promise<T>, label?: string): Promise<T>;
}

/**
 * How long a section may hold the store before it is reported.
 *
 * A queued section is a read, a change and a write of one `chrome.storage.local`
 * blob: single-digit milliseconds. Two seconds means something is awaiting the
 * network, or another `withStore` that can never start.
 */
export const SLOW_HOLD_MS = 2_000;

export interface QueueOptions {
  now?: () => number;
  /** Where the slow-hold line goes. Injected so the warning itself is testable. */
  warn?: (line: string) => void;
  slowHoldMs?: number;
}

export function createStoreQueue(options: QueueOptions = {}): StoreQueue {
  const now = options.now ?? (() => Date.now());
  const warn = options.warn ?? ((line: string) => console.warn(line));
  const slowHoldMs = options.slowHoldMs ?? SLOW_HOLD_MS;
  let tail: Promise<unknown> = Promise.resolve();

  return function withStore<T>(work: () => Promise<T>, label = "unnamed"): Promise<T> {
    const run = async (): Promise<T> => {
      const startedAt = now();
      try {
        return await work();
      } finally {
        const held = now() - startedAt;
        if (held >= slowHoldMs) {
          // Worker rule 5, for the one decision nobody can see: "the queue is
          // busy" and "the queue is wedged" are the same silence otherwise, and
          // the second one stops every click in the extension.
          warn(
            `[queue] "${label}" held the store for ${(held / 1000).toFixed(1)}s — ` +
              `nothing long-running may hold it, and a section that calls withStore ` +
              `again never returns (worker rule 4)`,
          );
        }
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

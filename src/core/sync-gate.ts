/**
 * One sync at a time — and a sync asked for during one is never dropped.
 *
 * The worker's gate used to be `if (running) { await running; return { skipped:
 * true } }`: a second request was not queued, not coalesced and not logged. On
 * the path a student takes right after signing in, that is the request that
 * mattered. The popup fires its open-sync and then its login recheck
 * (`trigger: "manual"`); PrairieLearn's and PrairieTest's login pages are on
 * their own hosts, so the login page itself fires a `recheck` that finds them
 * still signed out and the post-SSO landing's recheck arrives while that one is
 * in flight; and switching a source on in Settings asks for a `manual` sync that
 * the open-sync swallowed, with a plan made before the switch. Each time the one
 * run that would have attempted the source was the one thrown away, so the dot
 * stayed on "Sign in" / "Checking…" until the next alarm — the "delay to show
 * connected" PROGRESS.md had open since 2026-09-12.
 *
 * Here, rather than in `background.ts`, because it is a decision (worker rule 1)
 * and the worker is the file the suite cannot reach. It has no `chrome`
 * dependency and knows nothing about the store: `run` is the whole of one sync,
 * and it is called *when the follow-up starts*, so a follow-up plans against the
 * store as it is then — a source switched on mid-run is attempted.
 *
 * It holds no store queue (worker rule 4): a follow-up is started only after the
 * previous run has settled, and each run takes and releases the queue itself.
 */

import type { SyncTrigger } from "./sync.js";

/**
 * How strongly a trigger asks for a follow-up; a missing entry means none.
 *
 * - `manual` — a person asked, or a source was just switched on. It overrides
 *   §6's backoff *and* is what Piazza reads as a request for itself
 *   (`piazzaTrigger`), so it carries everything `recheck` does and more.
 * - `recheck` — a page finished loading on a source waiting on a login. It
 *   overrides the backoff for the loop's sources, which is the whole point.
 * - `install` — an install or update; `retryAfterUpdate` may just have cleared a
 *   backoff, and the run in flight planned before it did.
 * - `alarm` — the scheduled loop. Weakest, but still followed up: the run in
 *   flight may be a debounced popup that fetched nothing, and dropping the
 *   alarm then costs a whole poll interval. The worst case the other way is one
 *   extra read of the sources that are not resting, which §6's ladder and the
 *   per-host pool already bound.
 *
 * `popup` is absent on purpose. A popup sync is debounced on `lastSyncAt`
 * (`planSync`, `POPUP_DEBOUNCE_MS`), and the run in flight sets `lastSyncAt`
 * when it applies — so a popup follow-up would plan, find itself inside the
 * debounce and skip. The in-flight run is the answer it wanted; the caller is
 * handed that run's result instead.
 *
 * Two requests coalesce into one follow-up with the strongest trigger: a
 * follow-up re-reads every source a weaker one would, so a second follow-up
 * would be the same requests again.
 */
const FOLLOW_UP_STRENGTH: Partial<Record<SyncTrigger, number>> = {
  manual: 4,
  recheck: 3,
  install: 2,
  alarm: 1,
};

export interface SyncGate<R> {
  /**
   * Run a sync now, or — if one is in flight — arrange for it.
   *
   * Resolves with the result of the run that serves this request: its own run,
   * the follow-up it was queued or coalesced into, or (for `popup`) the run
   * already in flight.
   */
  request(trigger: SyncTrigger): Promise<R>;
  /** The trigger of the run in flight, if any. */
  inFlight(): SyncTrigger | undefined;
}

export interface SyncGateOptions {
  /** Where the both-branches lines go (worker rule 5). Injected for the tests. */
  log?: (line: string) => void;
}

interface Pending<R> {
  trigger: SyncTrigger;
  promise: Promise<R>;
  resolve: (value: R) => void;
  reject: (reason: unknown) => void;
}

export function createSyncGate<R>(
  run: (trigger: SyncTrigger) => Promise<R>,
  options: SyncGateOptions = {},
): SyncGate<R> {
  const log = options.log ?? ((line: string) => console.log(line));
  let current: { trigger: SyncTrigger; promise: Promise<R> } | undefined;
  let pending: Pending<R> | undefined;

  const start = (trigger: SyncTrigger): Promise<R> => {
    // `async` so a `run` that throws synchronously still settles this promise
    // and so still reaches the follow-up below.
    const promise = (async () => run(trigger))();
    current = { trigger, promise };
    // Both arms, not `finally`: `finally` returns a promise that rejects with
    // the run's error, and nobody would be listening to it.
    const settle = (): void => {
      current = undefined;
      const next = pending;
      if (next === undefined) return;
      pending = undefined;
      log(`[sync] starting the queued ${next.trigger} follow-up`);
      start(next.trigger).then(next.resolve, next.reject);
    };
    promise.then(settle, settle);
    return promise;
  };

  return {
    inFlight: () => current?.trigger,
    request(trigger) {
      if (current === undefined) return start(trigger);
      const prefix = `[sync] ${trigger} requested while a ${current.trigger} sync is in flight`;

      const strength = FOLLOW_UP_STRENGTH[trigger];
      if (strength === undefined) {
        log(`${prefix} — not followed up (${trigger})`);
        return current.promise;
      }
      if (pending !== undefined) {
        if (strength > (FOLLOW_UP_STRENGTH[pending.trigger] ?? 0)) pending.trigger = trigger;
        log(`${prefix} — coalesced into the pending ${pending.trigger}`);
        return pending.promise;
      }

      let resolve!: (value: R) => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<R>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      pending = { trigger, promise, resolve, reject };
      log(`${prefix} — queued as a follow-up`);
      return promise;
    },
  };
}

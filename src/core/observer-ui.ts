/** Presentation of discussion sources; their enable switch is never proof of a read. */
import { CAMPUSWIRE_ORIGIN, describeObserver } from "./campuswire.js";
import { describePiazza, piazzaChipState, PIAZZA_LOGIN_URL } from "./piazza.js";
import type { ObserverId, ObserverState } from "./store.js";

export function observerRows(
  observers: Partial<Record<ObserverId, ObserverState>>,
  missing: readonly string[],
  now: Date,
) {
  return (["piazza", "campuswire"] as const).map((id) => {
    const facts = observers[id];
    const unavailable = missing.includes("observers") || missing.includes(`observers.${id}`);
    const piazza = id === "piazza";
    const state = piazza ? piazzaChipState(facts) : facts?.enabled ? "pending" : "disabled";
    const status = unavailable ? "Reload the extension to read this source's state" : piazza ? describePiazza(facts, now) : describeObserver(facts, now);
    /*
     * The dot, and it may only be green off an attempt that happened.
     *
     * Piazza and Campuswire are drawn in the Alerts tab's Sources section as
     * rows of the same shape as Canvas and Gradescope (2026-09-19), so the dot
     * has to mean what `toneFor` means beside them. `ok` is the only green:
     * for Piazza it is `facts.state === "ok"`, which `applyPiazzaResult` writes
     * only after a run that actually fetched; for Campuswire, which fetches
     * nothing and reads a feed the student has open, it is `lastObservedAt`
     * being set, which is stamped only when posts were read. "Enabled but
     * never read" stays `pending` — an empty ring, not a green dot (worker
     * rule 2), and `off` is its own grey rather than borrowing pending's.
     */
    const read = piazza ? state === "ok" : facts?.enabled === true && facts.lastObservedAt !== undefined;
    const tone = unavailable
      ? "warn"
      : state === "needs_login"
        ? "warn"
        : state === "error"
          ? "err"
          : state === "disabled"
            ? "off"
            : read
              ? "ok"
              : "pending";
    const action = unavailable || !facts?.enabled ? "configure" : piazza && (state === "pending" || state === "error") ? "retry" : "open";
    const label = unavailable ? "Reload instructions" : action === "configure" ? "Configure" : action === "retry" ? "Retry" : piazza ? state === "needs_login" ? "Sign in" : "Open Piazza" : "Open a class feed";
    return { id, name: piazza ? "Piazza" : "Campuswire", status, tone, action, label,
      url: piazza ? state === "needs_login" ? PIAZZA_LOGIN_URL : "https://piazza.com/" : CAMPUSWIRE_ORIGIN,
      detail: unavailable ? "Open chrome://extensions, click Reload on Illini Dash, then reopen it." : piazza ? "Reads instructor posts when you sync." : "Reads deadlines only from class feeds you have open.",
    };
  });
}

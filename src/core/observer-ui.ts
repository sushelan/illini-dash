/** Presentation of discussion sources; their enable switch is never proof of a read. */
import { CAMPUSWIRE_ORIGIN, describeObserver } from "./campuswire.js";
import { describePiazza, PIAZZA_LOGIN_URL, type PiazzaFacts } from "./piazza.js";
import { STATE_WORD } from "./names.js";
import type { ObserverId, ObserverState } from "./store.js";

/**
 * The state an observer shows, in the sources' vocabulary, for **both** pages.
 *
 * Settings had this derivation as a private `observerState` while the Sources
 * tab printed `describePiazza`'s own words, so one Piazza failure read
 * "Couldn't read" on one page and "Couldn't be read" on the other
 * (copy-audit #13, 2026-09-27). One function now, and `observerStatus` below
 * puts the word on it.
 *
 * `granted` is Settings' half: a switch that is on over a revoked host
 * permission reads nothing, and says so as `needs_permission`. The Sources
 * tab does not check permissions and passes nothing.
 *
 * Green only from an attempt (worker rule 2): Piazza's `ok` needs a
 * `lastAttemptAt` behind it, and Campuswire's needs `lastObservedAt`, stamped
 * only when posts were read.
 */
export function observerShownState(
  id: ObserverId,
  facts: ObserverState | undefined,
  granted = true,
): string {
  if (facts?.enabled !== true) return "disabled";
  if (!granted) return "needs_permission";
  if (id === "campuswire") return facts.lastObservedAt === undefined ? "pending" : "ok";
  if (facts.state === "needs_login") return "needs_login";
  if (facts.state === "error") return "parse_error";
  return facts.state === "ok" && facts.lastAttemptAt !== undefined ? "ok" : "pending";
}

/**
 * The chip's word for an observer state.
 *
 * Two words are the observers' own. "Permission needed" has no equivalent
 * among the fetched sources, which are granted up front. And Campuswire is not
 * *checking* anything while it waits — it reads a feed the student opens, so
 * `STATE_WORD.pending`'s "Checking…" would claim an activity that is not
 * happening, which is the same lie as a green dot over a source that never
 * fetched.
 */
export function observerWord(id: ObserverId, shown: string): string {
  if (shown === "needs_permission") return "Permission needed";
  if (shown === "pending" && id === "campuswire") return "Waiting for a feed";
  return STATE_WORD[shown] ?? shown;
}

/**
 * The state word, then the facts from the describe functions: "Connected ·
 * last read 10:32 · 3 posts".
 *
 * Only a state that *is* about reading carries the reading facts. With the
 * permission revoked the same line read "Permission needed · last read 11:14
 * AM · 3 posts" — a state word and a detail that contradict each other, and
 * the half a student believes is the cheerful one.
 */
export function observerStatus(
  id: ObserverId,
  shown: string,
  facts: ObserverState | undefined,
  now: Date,
): string {
  const word = observerWord(id, shown);
  if (shown !== "ok" && shown !== "pending") return word;
  const line =
    id === "piazza" ? describePiazza(facts as PiazzaFacts | undefined, now) : describeObserver(facts, now);
  const detail = line.startsWith("On · ") ? line.slice(5) : undefined;
  // "nothing read yet" is what both pending words already say.
  return detail === undefined || detail === "nothing read yet" ? word : `${word} · ${detail}`;
}

export function observerRows(
  observers: Partial<Record<ObserverId, ObserverState>>,
  missing: readonly string[],
  now: Date,
) {
  return (["piazza", "campuswire"] as const).map((id) => {
    const facts = observers[id];
    const unavailable = missing.includes("observers") || missing.includes(`observers.${id}`);
    const piazza = id === "piazza";
    const shown = observerShownState(id, facts);
    const status = unavailable ? "Reload the extension to read this source's state" : observerStatus(id, shown, facts, now);
    /*
     * The dot, and it may only be green off an attempt that happened.
     *
     * Piazza and Campuswire are drawn in the Sources tab as rows of the same
     * shape as Canvas and Gradescope (2026-09-19), so the dot has to mean what
     * `toneOf` means beside them. `ok` is the only green, and
     * `observerShownState` gives it only for a read that happened. "Enabled but
     * never read" stays `pending` — an empty ring, not a green dot (worker
     * rule 2), and `off` is its own grey rather than borrowing pending's.
     */
    const tone = unavailable
      ? "warn"
      : shown === "needs_login"
        ? "warn"
        : shown === "parse_error"
          ? "err"
          : shown === "disabled"
            ? "off"
            : shown === "ok"
              ? "ok"
              : "pending";
    const raw = facts?.state ?? "pending";
    const action = unavailable || !facts?.enabled ? "configure" : piazza && (raw === "pending" || raw === "error") ? "retry" : "open";
    const label = unavailable ? "Reload instructions" : action === "configure" ? "Configure" : action === "retry" ? "Retry" : piazza ? shown === "needs_login" ? "Sign in" : "Open Piazza" : "Open a class feed";
    return { id, name: piazza ? "Piazza" : "Campuswire", status, tone, action, label,
      url: piazza ? shown === "needs_login" ? PIAZZA_LOGIN_URL : "https://piazza.com/" : CAMPUSWIRE_ORIGIN,
      detail: unavailable ? "Open chrome://extensions, click Reload on Illini Dash, then reopen it." : piazza ? "Reads instructor posts when you sync." : "Reads deadlines only from class feeds you have open.",
    };
  });
}

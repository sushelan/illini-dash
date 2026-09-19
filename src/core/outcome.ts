/**
 * Whether the worker's answer to a correction was a success or a refusal.
 *
 * Small on purpose, and in `core/` on purpose. `applyOverrideAction` and
 * `applySuggestionRequest` used to do `send(…).then(reportOverride).then(() =>
 * refresh())`: `reportOverride` wrote an `error` response's message to the
 * status line, and the unconditional `refresh()` behind it ended with
 * `showStatus(undefined)`, which wiped the message about 150ms later. On the
 * real document (interaction review of 2026-09-19, I03) a MutationObserver saw
 * the sentence arrive and vanish; the student saw a row that did not change
 * and no reason. The decision "did this succeed, and what do we do about
 * each answer" had no home a test could reach (worker house rule 1).
 *
 * Parser house rule 5 applies to the shape: `type === "error"` with an empty
 * message is still a failure — `""` must not read as "nothing to say" — so the
 * message falls back to a sentence rather than to silence. And a response of
 * a type this build does not know is not a failure: an older or newer worker
 * answers `{ type: "ok" }`, `{ type: "state", … }` or something else entirely,
 * and refusing to redraw on every unknown shape would freeze the list for
 * exactly the students worker rule 8 is about.
 */

export type ActionOutcome =
  | { ok: true }
  | { ok: false; message: string };

/** What a refusal says when the worker said nothing. */
export const UNEXPLAINED_REFUSAL =
  "The background part of Illini Dash refused that change but gave no reason. " +
  "Open chrome://extensions and click Reload on the Illini Dash card, then try again.";

export function actionOutcome(response: unknown): ActionOutcome {
  if (
    typeof response === "object" &&
    response !== null &&
    (response as { type?: unknown }).type === "error"
  ) {
    const message = (response as { message?: unknown }).message;
    return {
      ok: false,
      message: typeof message === "string" && message.trim() !== "" ? message : UNEXPLAINED_REFUSAL,
    };
  }
  return { ok: true };
}

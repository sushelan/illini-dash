/**
 * `core/outcome.ts`: which answers to a correction are refusals.
 *
 * Pinned from the finding it fixes (interaction review, 2026-09-19, I03):
 *
 *   "Real input sent `override` with `kind: done`, and the acceptance stub
 *    explicitly returned an error … A MutationObserver captured the full error
 *    message being inserted into `#status`. At the ordinary post-click
 *    observation 150ms later, the same element had empty text and
 *    `hidden=true`; the row was unchanged."
 *
 * The decision "was this a refusal" used to be implicit in two `.then` chains
 * in shell.ts, where no test could reach it (worker house rule 1).
 */
import { describe, expect, it } from "vitest";
import { UNEXPLAINED_REFUSAL, actionOutcome } from "../src/core/outcome.js";

describe("actionOutcome", () => {
  it("reads an error response as a refusal carrying the worker's sentence", () => {
    const message = "Preview does not simulate override. This journey needs a stateful stub.";
    expect(actionOutcome({ type: "error", message })).toEqual({ ok: false, message });
  });

  it("treats every non-error answer as success, whatever build sent it", () => {
    // `ok` is what the worker sends today; `state` and an unknown shape are
    // what an older or newer worker might send (worker house rule 8). None of
    // them is a reason to leave the list stale.
    expect(actionOutcome({ type: "ok" })).toEqual({ ok: true });
    expect(actionOutcome({ type: "state", items: [] })).toEqual({ ok: true });
    expect(actionOutcome({ type: "something-newer" })).toEqual({ ok: true });
  });

  it("does not let an empty message turn a refusal into silence", () => {
    // Parser house rule 5: `""` passes `typeof x === "string"` and would have
    // shadowed the fallback. Whitespace is the same case wearing a coat.
    expect(actionOutcome({ type: "error", message: "" })).toEqual({
      ok: false,
      message: UNEXPLAINED_REFUSAL,
    });
    expect(actionOutcome({ type: "error", message: "   " })).toEqual({
      ok: false,
      message: UNEXPLAINED_REFUSAL,
    });
    expect(actionOutcome({ type: "error" })).toEqual({ ok: false, message: UNEXPLAINED_REFUSAL });
  });

  it("does not throw on an answer that is not an object", () => {
    // `send` already rejects on `undefined`; anything else odd is a success
    // as far as this decision is concerned — the redraw will show the truth.
    expect(actionOutcome(null)).toEqual({ ok: true });
    expect(actionOutcome("error")).toEqual({ ok: true });
  });
});

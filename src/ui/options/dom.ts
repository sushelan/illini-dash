/**
 * The two builders every part of the settings page uses.
 *
 * They were private to `ui/options.ts` until the course list moved into its own
 * module (2026-09-21). Importing them back out of `options.ts` would be a
 * cycle, and a second copy of `el` is a second thing that can drift, so they
 * live here and both files import them.
 */

import { STATE_WORD } from "../../core/names.js";
import { toneOf } from "../../core/health.js";
import { isSourceState } from "../../sources/types.js";

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

/**
 * The state, as a chip rather than a sentence.
 *
 * A student scanning six rows for the broken one is scanning for a colour, and
 * "needs you to sign in" set in muted grey beside five other muted greys is not
 * one. The exact stamp and the error stay in the tooltip.
 */
export function stateChip(state: string, detail?: string, title?: string): HTMLElement {
  /*
   * The colour is `toneOf`'s — the setup screen's chip and the Sources tab's
   * dot read the same function — so a state cannot be grey on one screen and
   * red on another. This was its own if-chain, and it painted `empty` ("No
   * courses", I46) `is-err` because `empty` was not in its grey list.
   *
   * Two words are not source states: `needs_permission` is the observers' own
   * and is a warning, not a failure — nothing is broken, and the fix is the
   * button beside it (see `observerRow`). Anything else unknown stays red, as
   * it always did: a word this build cannot place is not a healthy one.
   */
  const shade =
    state === "needs_permission" ? "warn" : isSourceState(state) ? toneOf(state) : "err";
  const tone = shade === "ok" ? "is-ok" : shade === "warn" ? "is-warn" : shade === "err" ? "is-err" : "";
  const word = STATE_WORD[state] ?? state;
  const chip = el(
    "span",
    detail ? `${word} · ${detail}` : word,
    `chip-base chip-state ${tone}`.trim(),
  );
  if (title) chip.title = title;
  return chip;
}

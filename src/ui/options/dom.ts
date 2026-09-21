/**
 * The two builders every part of the settings page uses.
 *
 * They were private to `ui/options.ts` until the course list moved into its own
 * module (2026-09-21). Importing them back out of `options.ts` would be a
 * cycle, and a second copy of `el` is a second thing that can drift, so they
 * live here and both files import them.
 */

import { STATE_WORD } from "../../core/names.js";

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
  const tone =
    state === "ok"
      ? "is-ok"
      : // `needs_permission` is a warning and not a failure: nothing is broken,
        // and the fix is the button beside it (see `observerRow`).
        state === "needs_login" || state === "needs_permission"
        ? "is-warn"
        : state === "disabled" || state === "pending"
          ? ""
          : "is-err";
  const word = STATE_WORD[state] ?? state;
  const chip = el(
    "span",
    detail ? `${word} · ${detail}` : word,
    `chip-base chip-state ${tone}`.trim(),
  );
  if (title) chip.title = title;
  return chip;
}

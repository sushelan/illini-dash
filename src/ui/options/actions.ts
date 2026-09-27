/**
 * What every plain control on Settings does once it has asked the worker for a
 * change: read the answer, and either redraw or put the control back and say
 * why on the row.
 *
 * Until 2026-09-27 eleven controls were written `void send({…}).then(refreshOptions)`
 * — the answer never read and no `.catch`. `background.ts`'s `answer()` turns
 * every handler throw (a failed `mutate`, a queue timeout) into
 * `{ type: "error" }`, so a refused write redrew the page from a store that had
 * not changed and the switch the student had just pressed sprang back with no
 * sentence anywhere; a rejected `send` (the stale-worker case UI rule 2 was
 * written from) became an unhandled rejection invisible in the page. Driven
 * with real held presses on the acceptance stub, the Gradescope switch, a
 * course switch, the "24 hours" chip and a course rename all did exactly that
 * (options-live #2).
 *
 * The popup fixed this class on 2026-09-19 with `core/outcome.ts`; Settings
 * never adopted it. This is that adoption, in one place a test can reach
 * (worker rule 1): which answers are refusals is `actionOutcome`'s, and what a
 * refusal does to the page — restore the control, write the sentence on the
 * row, and **do not redraw**, because nothing in the store changed and a
 * redraw is what erased the sentence in the popup (ZIP rule 2) — is here.
 */

import { actionOutcome } from "../../core/outcome.js";

/** Where a sentence about this control goes, and how to put the control back. */
export interface ChangeUi {
  /** Writes a sentence on the row the control is on (UI rule 3). */
  note: (text: string) => void;
  /** Puts the control back the way it was drawn: unchecks, re-types, reselects. */
  restore: () => void;
  /**
   * The pressed control. A button is disabled while the round trip runs, and
   * when `busyText` is given says it on itself (UI rule 4): "Hide" becoming
   * "Applying…" tells "the click never ran" from "the round trip failed" with
   * no console at all.
   *
   * A switch, a select or a text box is marked `aria-busy` instead of being
   * disabled: disabling the element that has focus drops the keyboard onto
   * `<body>`, so a student who pressed Space on a switch that was then refused
   * would have to find their place again.
   */
  control?: HTMLButtonElement | HTMLInputElement | HTMLSelectElement;
  busyText?: string;
}

/** The sentence inside a rejection, whatever was thrown. */
export function messageOf(err: unknown): string {
  if (err instanceof Error && err.message.trim() !== "") return err.message;
  const text = String(err);
  return text.trim() === "" ? "Something went wrong talking to the background part of Illini Dash." : text;
}

/**
 * Settles one change. Resolves whatever happened — it never rejects into a
 * console the student does not have open (worker rule 8).
 *
 * Two-argument `then`, not `.then().catch()`: the catch is for the *send*, and
 * a catch placed after `refresh` would also restore a control the redraw had
 * already replaced.
 */
export function applyChange(
  pending: Promise<unknown>,
  ui: ChangeUi,
  refresh: () => Promise<void>,
): Promise<void> {
  const control = ui.control;
  // By tag, not `instanceof`: the DOM test's linkedom document has no global
  // `HTMLButtonElement`, and a check that is false there tests nothing.
  const isButton = control?.tagName === "BUTTON";
  const label = isButton ? control!.textContent : null;
  const release = (): void => {
    if (!control) return;
    if (!isButton) {
      control.removeAttribute("aria-busy");
      return;
    }
    control.disabled = false;
    if (label !== null && ui.busyText !== undefined) control.textContent = label;
  };
  if (control && !isButton) control.setAttribute("aria-busy", "true");
  if (control && isButton) {
    control.disabled = true;
    if (ui.busyText !== undefined) control.textContent = ui.busyText;
  }
  return pending.then(
    (response) => {
      const outcome = actionOutcome(response);
      if (!outcome.ok) {
        release();
        ui.restore();
        ui.note(outcome.message);
        return undefined;
      }
      // Released before the redraw rather than after it: on success the redraw
      // replaces this control, and if the redraw itself fails (`refreshOptions`
      // reports that in its own banner) the control must not stay dead.
      release();
      return refresh();
    },
    (err: unknown) => {
      release();
      ui.restore();
      ui.note(messageOf(err));
    },
  );
}

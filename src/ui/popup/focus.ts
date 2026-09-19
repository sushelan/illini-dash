/**
 * Where focus goes after a redraw — decided here, applied by the draw.
 *
 * Every redraw calls `replaceChildren()` on the strip or the list, which
 * destroys the element that had focus and leaves `document.activeElement` on
 * `<body>`. Five controls used to compensate with
 * `void app.refresh().then(() => …focus())`, and all five were right only when
 * the refresh actually drew. It does not when a mouse button is down inside the
 * list (`drawIsHeld`, the press-hold of 2026-09-19): `refresh()` returns at
 * once, the `.then` runs against the *old* document, finds nothing or focuses
 * an element the deferred draw is about to remove, and the real draw — one
 * task later, from `endPress` — moves focus nowhere. Measured on the real
 * document with a held CDP press (interaction review of 2026-09-19, I01 and
 * I02): pointer-opening a deadline left `BODY` focused, pointer Back left
 * `BODY` focused, and one ArrowRight on the tab strip worked while the second
 * did nothing because the strip had been rebuilt under the focused tab.
 *
 * So focus is a **request**, not a call: a control writes what should be
 * focused into `state.focusAfterDraw` before it asks for the redraw, and the
 * draw that finally rebuilds the document consumes it (`applyFocusRequest`
 * in popup.ts, after the footer). A held or deferred draw leaves the request
 * where it is, and the one that runs applies it. No caller has to know which
 * of the two it got.
 *
 * Pure over DOM: everything here takes the elements it reads, so a linkedom
 * test can pin the lookup and the derivation without a browser (worker house
 * rule 1 — the decision lives where a test can reach it; the `.focus()` call
 * stays in the entry).
 */

import type { ViewName } from "../../core/calendar.js";

export type FocusRequest = (
  /** The selected tab, after the strip is rebuilt (I01). */
  | { kind: "tab"; view: ViewName }
  /** ‹ back on whichever screen the draw just rendered (I02, entry). */
  | { kind: "screen-back" }
  /** The row a screen was opened from, by title, else the first row (I02, exit). */
  | { kind: "row"; title: string }
  /** The footer's source button, which the Needs-you screen returns to. */
  | { kind: "footer-health" }
) & {
  /**
   * Derived from `document.activeElement` by a redraw nobody asked for, rather
   * than requested by a control. Applied without scrolling: the element is
   * where it already was, and a background redraw must not move the window.
   */
  implicit?: boolean;
};

/**
 * The roving ring `makeRowsNavigable` rolls over, in one place.
 *
 * `rowsInView` in shell.ts and the row lookup here have to agree about what a
 * row is, or a screen could return focus to an element ↑ ↓ then refuse to
 * leave (UI house rule 7: one constant, so the wrong answer is unspellable).
 * The month has no `a.row` at all — its pills are `role=button`; a manual row
 * with no link is a `div.row`.
 */
export const ROW_RING_SELECTOR = "a.row, div.row, .mpill[role='button']";

/** The class on the footer's source button; shell.ts re-exports it. */
export const FOOT_HEALTH_CLASS = "foot--health";

export interface FocusScope {
  /** `#view`. */
  view: ParentNode;
  /** `#tabs`. */
  tabs: ParentNode;
  /** The document, for the footer button. */
  doc: ParentNode;
}

/**
 * The element a request names in the document as it stands *now*.
 *
 * `undefined` when the request cannot be honoured — the tab strip is hidden
 * behind a screen, the row was deleted by the sync that redrew — and the
 * caller leaves focus where the browser put it rather than guessing.
 */
export function findFocusTarget(
  request: FocusRequest,
  scope: FocusScope,
): HTMLElement | undefined {
  switch (request.kind) {
    case "tab": {
      const tabs = [...scope.tabs.querySelectorAll<HTMLElement>("[role='tab']")];
      // The *selected* tab, which is the one with `tabIndex 0`, rather than
      // the one named: `selectTab` has already written `state.view`, and the
      // strip was rebuilt from it, so the two agree — but if they ever did
      // not, the roving ring's own stop is the element the keyboard can use.
      return (
        tabs.find((tab) => tab.getAttribute("aria-selected") === "true") ??
        tabs.find((tab) => tab.textContent?.trim() === request.view)
      );
    }
    case "screen-back":
      return scope.view.querySelector<HTMLElement>(".screen-bar button") ?? undefined;
    case "row": {
      const rows = [...scope.view.querySelectorAll<HTMLElement>(ROW_RING_SELECTOR)];
      // By title, not by reference: the row that was pressed was destroyed by
      // the redraw that closed the screen. Two rows with one title in one
      // view is itself a merge defect (§5.3), so the first match is the row.
      return (
        rows.find((row) => row.querySelector(".row--title")?.textContent === request.title) ??
        rows[0]
      );
    }
    case "footer-health":
      return scope.doc.querySelector<HTMLElement>(`.${FOOT_HEALTH_CLASS}`) ?? undefined;
    default:
      return undefined;
  }
}

/**
 * What a redraw should put focus back on when nobody asked for anything.
 *
 * The popup's own open-sync lands about two seconds after it opens and rebuilds
 * the strip and the list; the minute tick and every store write do the same.
 * A student who had tabbed to the strip or was arrowing through rows lost
 * focus to `<body>` on each of them. Read *before* the draw, from the element
 * that has focus, so the same request mechanism restores it afterwards.
 *
 * Only the four things the draw rebuilds. Focus anywhere else — the header's
 * controls, a form field, a menu (which holds the draw anyway) — is left
 * alone, because those elements survive a redraw.
 */
export function focusRequestFor(
  active: Element | null,
  scope: FocusScope,
  selectedView: ViewName,
): FocusRequest | undefined {
  if (!active || !(active instanceof HTMLElement)) return undefined;
  if (scope.tabs.contains(active)) return { kind: "tab", view: selectedView };
  if (active.classList.contains(FOOT_HEALTH_CLASS)) return { kind: "footer-health" };
  if (!scope.view.contains(active)) return undefined;
  if (active.matches(".screen-bar button")) return { kind: "screen-back" };
  const row = active.closest<HTMLElement>(ROW_RING_SELECTOR);
  if (row) return { kind: "row", title: row.querySelector(".row--title")?.textContent ?? "" };
  return undefined;
}

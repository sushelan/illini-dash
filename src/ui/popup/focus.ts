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
  /**
   * A control in the date navigator, which `renderDateNav` rebuilds whole on
   * every draw (2026-09-22). Named, not held by reference, for the same reason
   * a row is: the element the student pressed no longer exists by the time
   * this is honoured.
   */
  | { kind: "date-nav"; control: DateNavControl }
  /**
   * Any other button a draw rebuilds — Sync now, a banner's Sign in, a view's
   * Mark done, the deadline screen's own ⋯ (2026-09-27).
   *
   * The five kinds above are the controls someone thought about; this is the
   * rest, and the keyboard found every one of them by landing on `<body>`
   * after pressing it: `renderFooter`, `renderBanners` and every view call
   * `replaceChildren()` on the element that had focus. Named by region, class
   * and label, because the element itself is gone by the time this is read.
   */
  | ControlRequest
) & {
  /**
   * Derived from `document.activeElement` by a redraw nobody asked for, rather
   * than requested by a control. Applied without scrolling: the element is
   * where it already was, and a background redraw must not move the window.
   */
  implicit?: boolean;
};

/** The regions a draw rebuilds wholesale, by the id each one carries in popup.html. */
export type ControlRegion = "view" | "footer" | "banners" | "status";

/** See `FocusRequest`'s last member. */
export interface ControlRequest {
  kind: "control";
  region: ControlRegion;
  /** The control's whole `class` attribute, which is what the draw writes. */
  className: string;
  /** Its day (a month cell), else its accessible name: `aria-label`, else its trimmed text. */
  label: string;
}

/**
 * The class on the element inside a row that takes focus.
 *
 * A row used to *be* the link — `<a class="row">` with the ⋯ `<button>` inside
 * it — which is invalid interactive nesting and made every row announce as
 * "MP 2 CS 411 8:00 PM More actions" (a11y review, 2026-09-27). The row is a
 * `div.row` now, the title is the link (or, for a typed row with no URL, a
 * `role=button`), and the ⋯ is its sibling. This class is the ring stop.
 */
export const ROW_LINK_CLASS = "row--link";

/**
 * The roving ring `makeRowsNavigable` rolls over, in one place.
 *
 * `rowsInView` in shell.ts and the row lookup here have to agree about what a
 * row is, or a screen could return focus to an element ↑ ↓ then refuse to
 * leave (UI house rule 7: one constant, so the wrong answer is unspellable).
 * The month has no `a.row` at all — its pills are `role=button`; a manual row
 * with no link is a `div.row`.
 */
export const ROW_RING_SELECTOR = `.${ROW_LINK_CLASS}, .mpill[role='button']`;

/**
 * The title a ring stop stands for, which is how a request names a row after
 * the draw that destroyed it. The stop is the title element in a list row and
 * holds one in anything else that ever joins the ring.
 */
export function ringTitle(stop: Element): string {
  const title = stop.matches(".row--title") ? stop : stop.querySelector(".row--title");
  return title?.textContent ?? "";
}

/**
 * The ring stop a control belongs to, when the control itself is not one.
 *
 * The row's ⋯ is `tabIndex −1` — the ring is one stop per row — so returning
 * focus to it after its menu closes (Escape, or an entry that closed the menu
 * itself) stranded the keyboard on an element ↑ ↓ does not recognise and Tab
 * leaves (a11y review, 2026-09-27, #5). Its row's stop is where it goes
 * instead. Anything with a real tab stop of its own is returned as it is.
 */
export function ringStopFor(control: HTMLElement): HTMLElement {
  // The attribute, not `tabIndex`: they agree in a browser for everything that
  // reaches here, and the attribute is the one a DOM with no focus model reads.
  if (control.getAttribute("tabindex") !== "-1" || control.matches(ROW_RING_SELECTOR)) return control;
  const row = control.closest(".row");
  return row?.querySelector<HTMLElement>(`.${ROW_LINK_CLASS}`) ?? control;
}

/**
 * Make `stop` the ring's one Tab stop and every other one `−1`.
 *
 * One copy of the roving rule, used by the arrow keys, by `makeRowsNavigable`'s
 * callers and by a menu handing focus back — a second copy is how the ⋯ ended
 * up focused with no stop in the ring at all.
 */
export function rollRingTo(ring: readonly HTMLElement[], stop: HTMLElement): void {
  for (const each of ring) each.tabIndex = each === stop ? 0 : -1;
}

/** The class on the footer's source button; shell.ts re-exports it. */
export const FOOT_HEALTH_CLASS = "foot--health";

/** The three pressable things `renderDateNav` builds. */
export type DateNavControl = "back" | "forward" | "today";

/**
 * The class each date-navigator control carries, in one place.
 *
 * `renderDateNav` adds these and this file looks them up, which is UI house
 * rule 7's "one constant, so the wrong answer is unspellable" — three redraw
 * guards were once dead because they asked for `.menu` while the element was
 * `menu-surface`, and this is the same shape of lookup.
 *
 * The names are the ones the design sheets already style (`datenav--fwd`, not
 * `datenav--forward`); the *request* spells the control out because
 * `"forward"` is what the code around it reads as.
 */
export const DATE_NAV_CLASS: Record<DateNavControl, string> = {
  back: "datenav--back",
  forward: "datenav--fwd",
  today: "datenav--today",
};

/** Every date-navigator control, in document order (‹, ›, Today). */
export const DATE_NAV_SELECTOR = `.${DATE_NAV_CLASS.back}, .${DATE_NAV_CLASS.forward}, .${DATE_NAV_CLASS.today}`;

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
      return rows.find((row) => ringTitle(row) === request.title) ?? rows[0];
    }
    case "control":
      return findControl(request, scope);
    case "footer-health":
      return scope.doc.querySelector<HTMLElement>(`.${FOOT_HEALTH_CLASS}`) ?? undefined;
    case "date-nav": {
      const named = scope.doc.querySelector<HTMLElement>(`.${DATE_NAV_CLASS[request.control]}`);
      if (named) return named;
      /*
       * The control the student pressed can be gone from the strip the draw
       * built, and in one case it always is: pressing **Today** sets
       * `dayOffset` to 0, and the pill only exists while the offset is not 0.
       * So it removes itself under the finger, and a request that insisted on
       * its own name would leave `<body>` focused — which is the defect this
       * case was added for, one button over.
       *
       * Any remaining control in the strip, in document order, keeps the
       * student in the navigator they were using: after Today that is ‹, which
       * still steps. An empty strip — Day draws a label and no arrows — has
       * nothing to offer, and focus is left where the browser put it.
       */
      return scope.doc.querySelector<HTMLElement>(DATE_NAV_SELECTOR) ?? undefined;
    }
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
 * Only the things the draw rebuilds. Focus anywhere else — the header's
 * controls, a form field, a menu (which holds the draw anyway) — is left
 * alone, because those elements survive a redraw.
 *
 * The date navigator is one of them and was missing until 2026-09-22:
 * `renderDateNav` calls `dateNavEl.replaceChildren()` on every draw, so ‹, ›
 * and Today are destroyed exactly like a tab, and `#nav` sits outside both
 * `#view` and `#tabs` — so the `scope.view.contains` test below answered "not
 * ours" and every redraw left the navigator's user on `<body>`. Tested before
 * that test, for that reason.
 */
export function focusRequestFor(
  active: Element | null,
  scope: FocusScope,
  selectedView: ViewName,
): FocusRequest | undefined {
  if (!active || !(active instanceof HTMLElement)) return undefined;
  if (scope.tabs.contains(active)) return { kind: "tab", view: selectedView };
  if (active.classList.contains(FOOT_HEALTH_CLASS)) return { kind: "footer-health" };
  // `closest` rather than `matches`, to match the row branch below: focus
  // lands on the button itself today, but a control that grows a wrapper
  // should not silently stop being recognised. (The `<svg>` glyph inside
  // `iconButton` never reaches here — it is an `SVGElement`, which the
  // `instanceof HTMLElement` guard above already refuses.)
  const nav = active.closest<HTMLElement>(DATE_NAV_SELECTOR);
  if (nav) {
    for (const control of ["back", "forward", "today"] as const) {
      if (nav.classList.contains(DATE_NAV_CLASS[control])) return { kind: "date-nav", control };
    }
  }
  if (!scope.view.contains(active)) return controlRequestFor(active, scope);
  // ‹ back is the screen bar's first button. The bar's ⋯ is a different
  // control, and mapping every bar button to ‹ moved focus off the ⋯ the
  // student had just used (a11y review, 2026-09-27, #2).
  if (active.matches(".screen-bar button") && isScreenBack(active)) return { kind: "screen-back" };
  // The row's own stop, or anything inside the row — the ⋯, an undo — whose
  // row the redraw is about to replace.
  const row = active.closest<HTMLElement>(`${ROW_RING_SELECTOR}, .row`);
  if (row) {
    const stop = row.matches(ROW_RING_SELECTOR)
      ? row
      : row.querySelector<HTMLElement>(`.${ROW_LINK_CLASS}`);
    if (stop) return { kind: "row", title: ringTitle(stop) };
  }
  return controlRequestFor(active, scope);
}

/** The screen bar's ‹, which is its first button. */
function isScreenBack(button: HTMLElement): boolean {
  return button.parentElement?.querySelector("button") === button;
}

const REGION_IDS: readonly ControlRegion[] = ["view", "footer", "banners", "status"];

function regionOf(active: HTMLElement): ControlRegion | undefined {
  for (const region of REGION_IDS) {
    if (active.closest(`#${region}`)) return region;
  }
  return undefined;
}

/**
 * What tells one control from its siblings: a month cell's day (its name
 * carries a count that a sync can change), else the accessible name.
 */
function labelOf(control: Element): string {
  return (
    control.getAttribute("data-day") ??
    control.getAttribute("aria-label") ??
    control.textContent ??
    ""
  ).trim();
}

const firstClass = (className: string): string => className.trim().split(/\s+/)[0] ?? "";

/**
 * A request for any other button a draw rebuilds, or nothing for a control no
 * draw touches (the header, a form field, a floating menu).
 */
export function controlRequestFor(
  active: HTMLElement,
  scope: FocusScope,
): ControlRequest | undefined {
  if (!active.matches("button, [role='button'], a[href]")) return undefined;
  const region = regionOf(active);
  if (!region) return undefined;
  // The view region is `scope.view`; the others are found through the
  // document, which is what the draw rebuilds them in.
  if (region === "view" && !scope.view.contains(active)) return undefined;
  return { kind: "control", region, className: active.className, label: labelOf(active) };
}

/**
 * The control a `ControlRequest` names in the document as drawn now.
 *
 * Same class and same name first — "Sign in" on the Gradescope banner, not on
 * Canvas's. Then the same class alone, because the draw may have changed the
 * words on the very control that was pressed: "Sync now" is "Syncing…" by the
 * time the footer is rebuilt — which also carries a pressed "Tick off" on to
 * the next card's, once its own card has gone. A control of another kind is
 * never substituted: a request nothing matches is dropped rather than sent
 * somewhere the student was not.
 */
function findControl(request: ControlRequest, scope: FocusScope): HTMLElement | undefined {
  const region =
    request.region === "view"
      ? scope.view
      : scope.doc.querySelector<HTMLElement>(`#${request.region}`);
  if (!region) return undefined;
  // By the first class, which is the control's kind (`mday`, `btn`,
  // `foot--sync`); the rest are states (`mday--on`) a redraw may have changed.
  const kind = firstClass(request.className);
  const candidates = [
    ...region.querySelectorAll<HTMLElement>("button, [role='button'], a[href]"),
  ].filter((control) => firstClass(control.className) === kind);
  return (
    candidates.find(
      (control) => labelOf(control) === request.label && control.className === request.className,
    ) ??
    candidates.find((control) => labelOf(control) === request.label) ??
    candidates.find((control) => control.className === request.className)
  );
}

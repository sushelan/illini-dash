/**
 * The preview popup's `?open=…` and `?editor=1`: the states that need a press.
 *
 * The source list is a click away, so `npm run shots` could never see it — and
 * it shipped clipped half way down its fifth row, because a floating panel adds
 * nothing to the document height that Chrome measures a popup by. A state the
 * harness cannot reach is a state nothing checks.
 *
 * Appended after the page bundle by `scripts/preview.mjs` rather than built
 * into it: this is harness scaffolding and has no business in the extension.
 * It is its own file rather than a template literal inside that script because
 * a target spelled inside a string is a target no test can read — `open=health`
 * went on pressing `.pill` for the whole day after the header pill was removed,
 * silently, and every "Sources" shot taken through it was a picture of the
 * calendar. `globalThis.__PREVIEW_OPEN__.targets` is the one table, and
 * `scripts/ui-acceptance.test.mjs` holds it against `STATES`' own presses.
 */
;(() => {
  /**
   * What each entry point presses, spelled once.
   *
   * `health` is the **footer's** source button (`FOOT_HEALTH_CLASS` in
   * `src/ui/popup/shell.ts`), not the header pill: the pill went on
   * 2026-09-19 and the footer strip took over opening the Needs-you screen.
   * UI house rule 7 — a selector and the class it matches belong to one
   * constant, or the guard is dead from the day it is written.
   */
  const targets = {
    health: ".foot--health",
    deadline: "#view a.row, #view .row",
    // The floating "+" on `<body>`, since the bar's one was removed on
    // 2026-09-19 ("theres already one at the bottom right"). `QUICK_FAB_SELECTOR`
    // in `src/ui/popup/shell.ts` is the one spelling of this class, and
    // `tests/preview-acceptance.test.ts` holds this string against it.
    editor: '.qfab',
  };

  /** The retry interval, and the wait before the first attempt. */
  const RETRY_MS = 120;
  // After the popup's own open-sync has landed and redrawn: a render calls
  // closeMenus(), so clicking earlier opens a panel that is closed again a
  // second later, and the shot catches the wrong moment.
  const FIRST_MS = 1900;

  /** Which entry of `targets` a query string asks for, if any. */
  const kindFor = (search) => {
    const q = new URLSearchParams(search ?? "");
    const open = q.get("open");
    if (open === "health" || open === "deadline") return open;
    return q.has("editor") ? "editor" : undefined;
  };

  const press = (el) => {
    const box = el.getBoundingClientRect();
    // `cancelable: true` is the whole difference between a press and a
    // gesture nothing can refuse. It defaults to **false**, and a click that
    // cannot be cancelled ignores every `preventDefault` on its way up — so
    // the row's own handler ran, called `chrome.tabs.create`, and the browser
    // then followed the link anyway, taking preview-popup.html to
    // gradescope.com. The shot was of a login page.
    const at = {
      clientX: box.left + box.width / 2,
      clientY: box.top + 10,
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
    };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...at, isPrimary: true, button: 0 }));
    el.dispatchEvent(new MouseEvent("mousedown", { ...at, button: 0 }));
    el.focus();
    el.dispatchEvent(new PointerEvent("pointerup", { ...at, isPrimary: true, button: 0 }));
    el.dispatchEvent(new MouseEvent("mouseup", { ...at, button: 0 }));
    el.dispatchEvent(new MouseEvent("click", { ...at, button: 0 }));
  };

  /**
   * Press the target for `kind`, retrying until the popup has drawn it.
   *
   * `?editor=1` opens the add form on load. Same argument as `?open=health`:
   * a state that needs a click is a state `npm run shots` can never see, and
   * the editor is now the tallest thing this document can grow by. It is a
   * synthetic click and proves nothing about *pressing* the button (UI house
   * rule 5) — it only gets the harness into the state.
   *
   * `?open=deadline` presses the first row, which is the only way into the
   * deadline screen (brief D8). A **real pointer sequence**, not `.click()`:
   * the row menu bug of 2026-09-18 was invisible to every harness precisely
   * because a synthetic click fires no pointerdown, no mousedown and no focus
   * change (UI house rule 5), and a screen opened from a press is the state
   * worth shooting.
   */
  const open = (kind) => {
    const el = document.querySelector(targets[kind]);
    if (!el) {
      setTimeout(() => open(kind), RETRY_MS);
      return;
    }
    if (kind !== "deadline") {
      el.click();
      return;
    }
    press(el);
    // No fallback: a press that does not open the screen is a defect the shot
    // must show, not one the harness papers over.
  };

  /** Arm the press this URL asks for; answer whether it asked for one. */
  const start = (search) => {
    const kind = kindFor(search);
    if (!kind) return false;
    setTimeout(() => open(kind), FIRST_MS);
    return true;
  };

  globalThis.__PREVIEW_OPEN__ = { targets, kindFor, press, open, start, RETRY_MS, FIRST_MS };

  // Only when this URL asks for a state, and only in a document. The table
  // above is read by a node test that evaluates this file in a bare `vm`
  // context, where there is neither a `document` nor anything to press.
  if (typeof document === "undefined") return;
  start(typeof location === "undefined" ? "" : location.search);
})();

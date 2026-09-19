/**
 * A redraw that arrives while a press is in progress must not run until the
 * press has produced its `click`.
 *
 * The defect this pins, measured through Chrome's own input pipeline on the
 * real popup document (`scripts/held-press.mjs`'s prologue, 120ms hold): a
 * held press on a card's tick box logged
 *
 *     pointerdown -> row--tick   mousedown -> row--tick
 *     <redraw>
 *     pointerup   -> row--tick   mouseup -> MAIN
 *
 * and no `click` at all, so `applyOverrideAction` never ran and the press fell
 * through to the row, which opens the deadline screen. A `click` is dispatched
 * only when mousedown and mouseup land on the same element, and a redraw calls
 * `viewEl.replaceChildren()`.
 *
 * The first guard deferred the redraw to `pointerup` and did not fix it, which
 * is the part with teeth. `pointerup` is dispatched **before** `mouseup`, and a
 * refresh started from a `pointerup` handler resolves its `await`s in
 * microtasks that all run before the browser dispatches `mouseup`. So the
 * deferred draw wiped the element inside the very gap it was added to protect.
 *
 * Hence `createPressHold`'s `schedule`: the release waits one *task*. That is
 * what these tests pin, and it is the only part a suite can reach — a synthetic
 * `.click()` has no gap in it at all (CLAUDE.md, UI house rule 5).
 */
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";

/*
 * `state.ts` is a popup module: it reads the document and `localStorage` as its
 * body runs. The function under test touches neither — it is here, and not in
 * `shell.ts`, precisely so a node suite can reach it (worker house rule 1) —
 * but the import still has to survive. A linkedom document and a null-answering
 * `localStorage` are the whole of what that takes, and the dynamic import below
 * is what puts them in place first.
 */
const { document, window } = parseHTML(
  "<!doctype html><html><body><main id='view'></main><div id='tabs'></div>" +
    "<div id='filters'></div><div id='nav'></div><div id='health'></div>" +
    "<div id='actions'></div><div id='banners'></div><div id='status'></div>" +
    "<div id='footer'></div></body></html>",
);
const globals = globalThis as unknown as Record<string, unknown>;
globals["document"] = document;
globals["window"] = window;
globals["location"] = { search: "" };
globals["localStorage"] = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};
const { createPressHold } = await import("../src/ui/popup/state.js");

/** A `schedule` that never runs on its own, so a test can say "not yet". */
function recorder(): { schedule: (run: () => void) => void; runAll: () => number } {
  const queued: (() => void)[] = [];
  return {
    schedule: (run) => queued.push(run),
    runAll: () => {
      const n = queued.length;
      for (const run of queued.splice(0)) run();
      return n;
    },
  };
}

describe("a press in progress", () => {
  it("holds a redraw that arrives between pointerdown and pointerup", () => {
    const clock = recorder();
    const press = createPressHold(clock.schedule);
    press.begin(true);
    expect(press.hold()).toBe(true);
  });

  it("does not hold a redraw when no button is down", () => {
    const clock = recorder();
    const press = createPressHold(clock.schedule);
    expect(press.hold()).toBe(false);
  });

  it("does not hold a redraw for a press that started outside the list", () => {
    // The header's ⋯ and the footer are not redrawn by `render`, and holding
    // every draw on them would freeze the list for a press that cannot lose
    // anything.
    const clock = recorder();
    const press = createPressHold(clock.schedule);
    press.begin(false);
    expect(press.hold()).toBe(false);
  });

  /*
   * The regression. `release` must not run the owed draw synchronously, and it
   * must keep holding until the scheduled task runs — because `mouseup` and
   * `click` are dispatched after `pointerup` and before that task.
   */
  it("still holds a redraw that arrives after pointerup, before the click", () => {
    const clock = recorder();
    const press = createPressHold(clock.schedule);
    let drawn = 0;
    press.begin(true);
    press.release(() => drawn++);
    expect(drawn, "the owed draw ran inside the pointerup handler").toBe(0);
    // This is `mouseup`/`click` time: the element under the finger must survive.
    expect(press.hold(), "a draw arriving before the click was let through").toBe(true);
    expect(drawn).toBe(0);
    clock.runAll();
    expect(drawn).toBe(1);
  });

  it("runs the owed draw once the task after the click arrives", () => {
    const clock = recorder();
    const press = createPressHold(clock.schedule);
    let drawn = 0;
    press.begin(true);
    press.hold();
    press.release(() => drawn++);
    expect(drawn).toBe(0);
    expect(clock.runAll()).toBe(1);
    expect(drawn).toBe(1);
  });

  it("runs nothing when the press owed no draw", () => {
    // Deferred, never skipped, is one half; the other is that an ordinary press
    // with nothing owed must not manufacture a redraw of its own.
    const clock = recorder();
    const press = createPressHold(clock.schedule);
    let drawn = 0;
    press.begin(true);
    press.release(() => drawn++);
    clock.runAll();
    expect(drawn).toBe(0);
  });

  it("lets a draw through once the press is over", () => {
    const clock = recorder();
    const press = createPressHold(clock.schedule);
    press.begin(true);
    press.release(() => undefined);
    clock.runAll();
    expect(press.hold()).toBe(false);
  });

  it("runs the owed draw once when pointerup and pointercancel both arrive", () => {
    // Both are wired to `endPress`, and a gesture can produce both. Two
    // scheduled releases would draw twice for one press.
    const clock = recorder();
    const press = createPressHold(clock.schedule);
    let drawn = 0;
    press.begin(true);
    press.hold();
    press.release(() => drawn++);
    press.release(() => drawn++);
    clock.runAll();
    expect(drawn).toBe(1);
  });

  it("owes nothing to a new press from the one before it", () => {
    const clock = recorder();
    const press = createPressHold(clock.schedule);
    let drawn = 0;
    press.begin(true);
    press.hold();
    press.release(() => drawn++);
    clock.runAll();
    expect(drawn).toBe(1);
    press.begin(true);
    press.release(() => drawn++);
    clock.runAll();
    expect(drawn).toBe(1);
  });
});

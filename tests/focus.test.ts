/**
 * `popup/focus.ts`: where focus goes after a redraw, decided over a document.
 *
 * The lookup and the derivation are pure over DOM, so linkedom can pin them
 * without a browser. The *timing* half — that a request survives a held draw
 * and is applied by the deferred one — is pinned in `popup-draw.test.ts`,
 * which loads the real entry.
 */
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import {
  FOOT_HEALTH_CLASS,
  ROW_RING_SELECTOR,
  findFocusTarget,
  focusRequestFor,
  type FocusScope,
} from "../src/ui/popup/focus.js";

// `focusRequestFor` asks `active instanceof HTMLElement`; node has no such
// global, so linkedom's class stands in for it (the same one its elements are).
(globalThis as unknown as Record<string, unknown>)["HTMLElement"] =
  parseHTML("<!doctype html><html><body></body></html>").HTMLElement;

function scopeOf(html: string): FocusScope & { document: Document } {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const doc = document as unknown as Document;
  return {
    document: doc,
    view: doc.getElementById("view")!,
    tabs: doc.getElementById("tabs")!,
    doc,
  };
}

const TABS =
  `<nav id="tabs"><button role="tab" aria-selected="false" tabindex="-1">Today</button>` +
  `<button role="tab" aria-selected="true" tabindex="0">Week</button>` +
  `<button role="tab" aria-selected="false" tabindex="-1">Month</button></nav>`;

describe("findFocusTarget", () => {
  it("names the selected tab after the strip is rebuilt (I01)", () => {
    const scope = scopeOf(`${TABS}<main id="view"></main>`);
    const target = findFocusTarget({ kind: "tab", view: "week" }, scope);
    expect(target?.textContent).toBe("Week");
    expect(target?.getAttribute("aria-selected")).toBe("true");
  });

  it("names ‹ back on whichever screen is drawn (I02, entry)", () => {
    const scope = scopeOf(
      `<nav id="tabs"></nav><main id="view"><section class="screen">` +
        `<div class="screen-bar"><button class="btn btn-icon">‹</button>` +
        `<div class="screen-bar--title">Deadline</div><button>⋯</button></div></section></main>`,
    );
    const target = findFocusTarget({ kind: "screen-back" }, scope);
    expect(target?.textContent).toBe("‹");
  });

  it("returns a screen to the row it came from, by title, else the first row (I02, exit)", () => {
    const scope = scopeOf(
      `<nav id="tabs"></nav><main id="view">` +
        `<a class="row" href="https://x.test/1"><span class="row--title">MP 2</span></a>` +
        `<div class="row"><span class="row--title">Lab 1</span></div>` +
        `<a class="row" href="https://x.test/3"><span class="row--title">Quiz</span></a></main>`,
    );
    expect(findFocusTarget({ kind: "row", title: "Lab 1" }, scope)?.textContent).toBe("Lab 1");
    expect(findFocusTarget({ kind: "row", title: "Quiz" }, scope)?.textContent).toBe("Quiz");
    // The row a sync deleted while its screen was open: the first row, not
    // nothing, so the keyboard is not stranded on <body>.
    expect(findFocusTarget({ kind: "row", title: "gone" }, scope)?.textContent).toBe("MP 2");
  });

  it("finds a month pill, which is a row for the keyboard's purposes", () => {
    const scope = scopeOf(
      `<nav id="tabs"></nav><main id="view"><div class="mpill" role="button">CS 225 MP</div></main>`,
    );
    expect(findFocusTarget({ kind: "row", title: "" }, scope)?.textContent).toBe("CS 225 MP");
  });

  it("names the footer's source button through the one shared constant", () => {
    const scope = scopeOf(
      `<nav id="tabs"></nav><main id="view"></main>` +
        `<footer id="footer"><button class="${FOOT_HEALTH_CLASS}">6 sources</button></footer>`,
    );
    expect(findFocusTarget({ kind: "footer-health" }, scope)?.textContent).toBe("6 sources");
    expect(FOOT_HEALTH_CLASS).toBe("foot--health");
  });

  it("answers nothing when the document cannot satisfy the request", () => {
    const scope = scopeOf(`<nav id="tabs"></nav><main id="view"><p class="empty">Nothing.</p></main>`);
    expect(findFocusTarget({ kind: "row", title: "x" }, scope)).toBeUndefined();
    expect(findFocusTarget({ kind: "screen-back" }, scope)).toBeUndefined();
    expect(findFocusTarget({ kind: "footer-health" }, scope)).toBeUndefined();
    expect(findFocusTarget({ kind: "tab", view: "day" }, scope)).toBeUndefined();
  });
});

describe("focusRequestFor — what a redraw nobody asked for should put back", () => {
  const html =
    `<header class="bar"><div id="actions"><button id="add">+</button></div></header>${TABS}` +
    `<main id="view"><section class="screen"><div class="screen-bar"><button id="back">‹</button></div></section>` +
    `<a class="row" href="https://x.test/1"><span class="row--title">MP 2</span><span class="row--due">11:59 PM</span></a>` +
    `<div class="row"><span class="row--title">Lab 1</span><button class="row--menu">⋯</button></div></main>` +
    `<footer id="footer"><button class="${FOOT_HEALTH_CLASS}">6 sources</button><button class="foot--sync">Sync</button></footer>`;

  it("keeps focus on the strip when a tab had it", () => {
    const scope = scopeOf(html);
    const tab = scope.tabs.querySelectorAll("[role='tab']")[2]!;
    expect(focusRequestFor(tab, scope, "month")).toEqual({ kind: "tab", view: "month" });
  });

  it("keeps focus on the footer's source button", () => {
    const scope = scopeOf(html);
    const button = scope.doc.querySelector(`.${FOOT_HEALTH_CLASS}`)!;
    expect(focusRequestFor(button, scope, "day")).toEqual({ kind: "footer-health" });
  });

  it("keeps focus on ‹ back of an open screen", () => {
    const scope = scopeOf(html);
    expect(focusRequestFor(scope.document.getElementById("back"), scope, "day")).toEqual({
      kind: "screen-back",
    });
  });

  it("keeps focus on the row that had it, even from a control inside it", () => {
    const scope = scopeOf(html);
    const row = scope.view.querySelector("a.row")!;
    expect(focusRequestFor(row, scope, "day")).toEqual({ kind: "row", title: "MP 2" });
    const menu = scope.view.querySelector(".row--menu")!;
    expect(focusRequestFor(menu, scope, "day")).toEqual({ kind: "row", title: "Lab 1" });
  });

  it("leaves everything a redraw does not rebuild alone", () => {
    const scope = scopeOf(html);
    expect(focusRequestFor(scope.document.getElementById("add"), scope, "day")).toBeUndefined();
    expect(focusRequestFor(scope.doc.querySelector(".foot--sync"), scope, "day")).toBeUndefined();
    expect(focusRequestFor(scope.document.body, scope, "day")).toBeUndefined();
    expect(focusRequestFor(null, scope, "day")).toBeUndefined();
  });

  it("agrees with the roving ring about what a row is", () => {
    // shell.ts's `rowsInView` and this file's lookup share the constant; a
    // month pill is in it because ↑ ↓ walks pills too.
    expect(ROW_RING_SELECTOR).toContain("a.row");
    expect(ROW_RING_SELECTOR).toContain("div.row");
    expect(ROW_RING_SELECTOR).toContain(".mpill[role='button']");
  });
});

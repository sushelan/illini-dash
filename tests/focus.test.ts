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
  DATE_NAV_CLASS,
  DATE_NAV_SELECTOR,
  FOOT_HEALTH_CLASS,
  ROW_LINK_CLASS,
  ROW_RING_SELECTOR,
  findFocusTarget,
  focusRequestFor,
  ringStopFor,
  ringTitle,
  rollRingTo,
  type FocusScope,
} from "../src/ui/popup/focus.js";

/*
 * A row as `renderRow` draws it since 2026-09-27: a `div.row` whose title is
 * the link (or, with no URL, a `role=button`) and whose ⋯ is the link's
 * sibling — not a `<button>` nested inside an `<a class="row">`, which is
 * invalid interactive nesting (a11y review #12). The fixtures below were
 * rewritten to that shape; what they assert about *which row* is unchanged.
 */
const linkRow = (title: string, n: number): string =>
  `<div class="row"><span class="row--main"><a class="row--title ${ROW_LINK_CLASS}" href="https://x.test/${n}" tabindex="-1">${title}</a></span>` +
  `<button class="btn btn-icon row--menu btn-sm" tabindex="-1" aria-label="More actions for ${title}">⋯</button></div>`;
const flatRow = (title: string): string =>
  `<div class="row row--flat"><span class="row--main"><span class="row--title ${ROW_LINK_CLASS}" role="button" tabindex="-1">${title}</span></span>` +
  `<button class="btn btn-icon row--menu btn-sm" tabindex="-1" aria-label="More actions for ${title}">⋯</button></div>`;

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
      `<nav id="tabs"></nav><main id="view">${linkRow("MP 2", 1)}${flatRow("Lab 1")}${linkRow("Quiz", 3)}</main>`,
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

  /*
   * The date navigator, found 2026-09-22.
   *
   * `renderDateNav` `replaceChildren()`s `#nav` on every draw, so ‹, › and
   * Today are destroyed by the draw the student's own press started: Month ›
   * advanced September to October and left `BODY` focused, so the second
   * Enter did nothing. `#nav` is a sibling of `#view` and `#tabs`, which is
   * why neither of the branches above ever saw it.
   */
  const NAV =
    `<nav id="tabs"></nav><div id="nav" class="datenav">` +
    `<button class="btn btn-icon datenav--step ${DATE_NAV_CLASS.back}" aria-label="Back">` +
    `<svg class="glyph"></svg></button>` +
    `<span class="datenav--label">September 2026</span>` +
    `<button class="btn btn-icon datenav--step ${DATE_NAV_CLASS.forward}" aria-label="Forward">` +
    `<svg class="glyph"></svg></button>` +
    `<button class="btn btn-quiet ${DATE_NAV_CLASS.today}">Today</button>` +
    `</div><main id="view"></main>`;

  it("names each date-navigator control the draw rebuilt", () => {
    const scope = scopeOf(NAV);
    expect(findFocusTarget({ kind: "date-nav", control: "back" }, scope)?.getAttribute("aria-label")).toBe("Back");
    expect(findFocusTarget({ kind: "date-nav", control: "forward" }, scope)?.getAttribute("aria-label")).toBe("Forward");
    expect(findFocusTarget({ kind: "date-nav", control: "today" }, scope)?.textContent).toBe("Today");
  });

  it("falls back to the rest of the strip when the control removed itself", () => {
    // Pressing Today sets `dayOffset` to 0, and the pill exists only while the
    // offset is not 0 — so this request is *never* satisfiable by its own
    // name. Insisting on it would leave `<body>` focused, which is the defect
    // one button over. ‹ is the first control left, and it still steps.
    const scope = scopeOf(NAV.replace(/<button class="btn btn-quiet[^]*?<\/button>/, ""));
    expect(scope.doc.querySelector(`.${DATE_NAV_CLASS.today}`)).toBeNull();
    const target = findFocusTarget({ kind: "date-nav", control: "today" }, scope);
    expect(target?.getAttribute("aria-label")).toBe("Back");
  });

  it("offers nothing on a strip with no controls, rather than inventing one", () => {
    // Today (the view) draws a running head and no arrows — `navFor` returns
    // `step: 0` — so a request left over from Month has nowhere to go and
    // focus stays where the browser put it.
    const scope = scopeOf(
      `<nav id="tabs"></nav><div id="nav" class="datenav">` +
        `<span class="datenav--label">Today · Mon, Sep 22</span></div><main id="view"></main>`,
    );
    expect(findFocusTarget({ kind: "date-nav", control: "forward" }, scope)).toBeUndefined();
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
    `<main id="view"><section class="screen"><div class="screen-bar"><button id="back">‹</button>` +
    `<div class="screen-bar--title">Deadline</div><button id="screen-more" class="btn btn-icon" aria-label="More actions">⋯</button></div></section>` +
    `${linkRow("MP 2", 1)}${flatRow("Lab 1")}<button id="tick" class="btn btn-sm">Tick off</button></main>` +
    `<div id="banners"><div class="banner-line"><span>Gradescope: signed out</span><button class="btn btn-quiet btn-sm">Sign in</button></div></div>` +
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

  it("keeps focus on the row that had it, even from a control beside its link", () => {
    const scope = scopeOf(html);
    const link = scope.view.querySelector(`a.${ROW_LINK_CLASS}`)!;
    expect(focusRequestFor(link, scope, "day")).toEqual({ kind: "row", title: "MP 2" });
    // The ⋯ is the link's sibling now, not its child: the row is found through
    // the card, and the request still names the row rather than the ⋯.
    const menu = scope.view.querySelectorAll(".row--menu")[1]!;
    expect(focusRequestFor(menu, scope, "day")).toEqual({ kind: "row", title: "Lab 1" });
  });

  /*
   * Rewritten 2026-09-27. This test used to assert that `.foot--sync` gets no
   * request, under the heading "everything a redraw does not rebuild" — but
   * `renderFooter` does rebuild it, on every draw and at the start of every
   * sync, so the assertion was pinning the defect: Enter on Sync now left
   * `<body>` focused for the whole sync (a11y review #2; worker rule 6). What
   * it should pin is the *header*, a form field and `<body>`, which no draw
   * touches.
   */
  it("leaves everything a redraw does not rebuild alone", () => {
    const scope = scopeOf(html);
    expect(focusRequestFor(scope.document.getElementById("add"), scope, "day")).toBeUndefined();
    expect(focusRequestFor(scope.document.body, scope, "day")).toBeUndefined();
    expect(focusRequestFor(null, scope, "day")).toBeUndefined();
  });

  it("names any other control a draw rebuilds by region, class and label", () => {
    const scope = scopeOf(html);
    expect(focusRequestFor(scope.doc.querySelector(".foot--sync"), scope, "day")).toEqual({
      kind: "control",
      region: "footer",
      className: "foot--sync",
      label: "Sync",
    });
    expect(focusRequestFor(scope.doc.querySelector("#banners button"), scope, "day")).toEqual({
      kind: "control",
      region: "banners",
      className: "btn btn-quiet btn-sm",
      label: "Sign in",
    });
    expect(focusRequestFor(scope.document.getElementById("tick"), scope, "day")).toEqual({
      kind: "control",
      region: "view",
      className: "btn btn-sm",
      label: "Tick off",
    });
  });

  it("keeps the screen bar's ⋯ as itself, and only ‹ as ‹ back", () => {
    // Every `.screen-bar button` used to map to ‹ back, so pressing the bar's
    // ⋯ and closing its menu moved focus to "Back to the list" (a11y #2).
    const scope = scopeOf(html);
    expect(focusRequestFor(scope.document.getElementById("back"), scope, "day")).toEqual({
      kind: "screen-back",
    });
    expect(focusRequestFor(scope.document.getElementById("screen-more"), scope, "day")).toEqual({
      kind: "control",
      region: "view",
      className: "btn btn-icon",
      label: "More actions",
    });
  });

  it("keeps focus in the date navigator, which every draw rebuilds", () => {
    const scope = scopeOf(
      `${TABS}<div id="nav" class="datenav">` +
        `<button class="datenav--step ${DATE_NAV_CLASS.back}"><svg class="glyph"></svg></button>` +
        `<span class="datenav--label">September 2026</span>` +
        `<button class="datenav--step ${DATE_NAV_CLASS.forward}"><svg class="glyph"></svg></button>` +
        `<button class="${DATE_NAV_CLASS.today}">Today</button>` +
        `<span class="datenav--week">This Week</span></div><main id="view"></main>`,
    );
    const nav = scope.document.getElementById("nav")!;
    expect(focusRequestFor(nav.querySelector(`.${DATE_NAV_CLASS.back}`), scope, "month")).toEqual({
      kind: "date-nav",
      control: "back",
    });
    expect(focusRequestFor(nav.querySelector(`.${DATE_NAV_CLASS.forward}`), scope, "month")).toEqual({
      kind: "date-nav",
      control: "forward",
    });
    expect(focusRequestFor(nav.querySelector(`.${DATE_NAV_CLASS.today}`), scope, "month")).toEqual({
      kind: "date-nav",
      control: "today",
    });
    // The glyph inside the arrow is an `SVGElement`, which the `instanceof
    // HTMLElement` guard refuses before it gets here — focus never lands on
    // it, and a request naming it would be a request for something that is
    // not a stop.
    expect(focusRequestFor(nav.querySelector(`.${DATE_NAV_CLASS.forward} .glyph`), scope, "month")).toBeUndefined();
    // The label and week.ts's "This Week" pill are not controls and have no
    // focus to keep; asking for one would move focus somewhere nobody was.
    expect(focusRequestFor(nav.querySelector(".datenav--label"), scope, "month")).toBeUndefined();
    expect(focusRequestFor(nav.querySelector(".datenav--week"), scope, "month")).toBeUndefined();
  });

  it("agrees with the roving ring about what a row is", () => {
    // shell.ts's `rowsInView` and this file's lookup share the constant; a
    // month pill is in it because ↑ ↓ walks pills too. The row's stop is its
    // link since 2026-09-27 — the card itself holds the ⋯ beside it.
    expect(ROW_RING_SELECTOR).toContain(`.${ROW_LINK_CLASS}`);
    expect(ROW_RING_SELECTOR).toContain(".mpill[role='button']");
    const scope = scopeOf(`${TABS}<main id="view">${linkRow("MP 2", 1)}${flatRow("Lab 1")}</main>`);
    const ring = [...scope.view.querySelectorAll(ROW_RING_SELECTOR)];
    expect(ring.map((stop) => ringTitle(stop))).toEqual(["MP 2", "Lab 1"]);
    // The card is not a stop and the ⋯ is not one either.
    expect(ring.some((stop) => stop.classList.contains("row"))).toBe(false);
    expect(ring.some((stop) => stop.classList.contains("row--menu"))).toBe(false);
  });

  it("spells the navigator's classes once, where shell.ts adds them", () => {
    // UI house rule 7: `renderDateNav` adds these classes from this same map,
    // so a rename cannot leave the lookup asking for a class nothing carries —
    // which is how three redraw guards asking for `.menu` were dead from the
    // day they were written.
    expect(DATE_NAV_CLASS).toEqual({
      back: "datenav--back",
      forward: "datenav--fwd",
      today: "datenav--today",
    });
    for (const cls of Object.values(DATE_NAV_CLASS)) expect(DATE_NAV_SELECTOR).toContain(`.${cls}`);
  });
});

describe("findFocusTarget — the rest of the controls a draw rebuilds (2026-09-27)", () => {
  const html =
    `${TABS}<main id="view"><button class="btn btn-sm">Tick off</button><button class="btn btn-sm">Tick off</button>` +
    `<button class="mday mday--on" data-day="2026-09-27" aria-label="Sunday, Sep 27 — 2 due">27</button>` +
    `<button class="mday" data-day="2026-09-28" aria-label="Monday, Sep 28 — nothing due">28</button></main>` +
    `<div id="banners"><button class="btn btn-quiet btn-sm">Undo</button><button class="btn btn-quiet btn-sm">Sign in</button></div>` +
    `<footer id="footer"><button class="${FOOT_HEALTH_CLASS}">6 sources</button><button class="foot--sync" aria-disabled="true"><span>Syncing…</span></button></footer>`;

  it("finds the banner button with the same name, not the first of its class", () => {
    const scope = scopeOf(html);
    const target = findFocusTarget(
      { kind: "control", region: "banners", className: "btn btn-quiet btn-sm", label: "Sign in" },
      scope,
    );
    expect(target?.textContent).toBe("Sign in");
  });

  it("finds Sync now after the press renamed it Syncing…", () => {
    const scope = scopeOf(html);
    const target = findFocusTarget(
      { kind: "control", region: "footer", className: "foot--sync", label: "Sync now" },
      scope,
    );
    expect(target?.classList.contains("foot--sync")).toBe(true);
  });

  it("finds a month cell by its day when its count and state classes changed", () => {
    const scope = scopeOf(html);
    const target = findFocusTarget(
      { kind: "control", region: "view", className: "mday", label: "2026-09-28" },
      scope,
    );
    expect(target?.getAttribute("data-day")).toBe("2026-09-28");
  });

  it("never substitutes a control of another kind", () => {
    const scope = scopeOf(html);
    expect(
      findFocusTarget(
        { kind: "control", region: "view", className: "btn btn-primary", label: "Sign in to Canvas" },
        scope,
      ),
    ).toBeUndefined();
    expect(
      findFocusTarget({ kind: "control", region: "status", className: "btn", label: "Dismiss" }, scope),
    ).toBeUndefined();
  });
});

describe("ringStopFor / rollRingTo — where a closed row menu hands focus", () => {
  it("sends the tabIndex −1 ⋯ to its row's link, and leaves a real stop alone", () => {
    const scope = scopeOf(`${TABS}<main id="view">${linkRow("MP 2", 1)}</main><button id="more">⋯</button>`);
    const dots = scope.view.querySelector<HTMLElement>(".row--menu")!;
    expect(ringStopFor(dots)).toBe(scope.view.querySelector(`.${ROW_LINK_CLASS}`));
    const header = scope.document.getElementById("more")!;
    expect(ringStopFor(header)).toBe(header);
  });

  it("makes exactly one stop in the ring tabbable", () => {
    const scope = scopeOf(`${TABS}<main id="view">${linkRow("A", 1)}${linkRow("B", 2)}${flatRow("C")}</main>`);
    const ring = [...scope.view.querySelectorAll<HTMLElement>(ROW_RING_SELECTOR)];
    // Read as the attribute: linkedom's `tabIndex` getter answers −1 for
    // everything, whatever was set.
    const stops = () => ring.map((stop) => stop.getAttribute("tabindex"));
    rollRingTo(ring, ring[2]!);
    expect(stops()).toEqual(["-1", "-1", "0"]);
    rollRingTo(ring, ring[0]!);
    expect(stops()).toEqual(["0", "-1", "-1"]);
  });
});

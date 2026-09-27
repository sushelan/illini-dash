/**
 * The popup's draw, driven end to end under linkedom: what a redraw does to
 * focus, and what a refused correction leaves on screen.
 *
 * Three findings from the interaction review of 2026-09-19, each measured on
 * the real 400×600 document with a held CDP press, and each a question of
 * *when* something ran rather than what it did — which is why this loads the
 * real entry (`src/ui/popup.ts`) with `chrome` stubbed, rather than a module
 * at a time:
 *
 *   I01  ArrowRight selected the next tab, then left `<body>` focused, so the
 *        second ArrowRight did nothing: the strip was rebuilt under the tab.
 *   I02  Pointer-opening a deadline, pointer ‹ back, and Needs-you's ‹ back
 *        left `<body>` focused, while Escape restored the row: every
 *        `refresh().then(focus)` ran before the deferred draw that a held
 *        press holds off (`createPressHold`).
 *   I03  A refused override was written to `#status` and erased ~150ms later
 *        by the unconditional refresh behind it.
 *
 * linkedom lays nothing out and does not move focus, so two things are
 * shimmed and nothing else: `HTMLElement.prototype.focus` records the element,
 * and `document.activeElement` reads it back. A press is two plain events on
 * the document, which is all `shell.ts`'s capture-phase listeners read.
 */
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/core/store.js";
import type { Item, Source, SourceStatus, Suggestion } from "../src/sources/types.js";
import { referenceItems } from "../scripts/preview-reference.js";

const popup = parseHTML(
  "<!doctype html><html><body><header class='bar'><div id='health'></div>" +
    "<div class='bar--right' id='actions'></div></header><div id='banners'></div>" +
    "<div id='status' hidden></div><nav id='tabs' class='tabs' role='tablist'></nav>" +
    "<div id='filters' class='filters'></div><div id='nav' class='datenav'></div>" +
    "<main id='view'></main><footer id='footer' class='foot'></footer>" +
    "</body></html>",
);
const document = popup.document as unknown as Document;

/* ---- focus, tracked ---------------------------------------------------- */
let focused: Element | null = null;
(popup.HTMLElement as { prototype: { focus: (o?: unknown) => void } }).prototype.focus =
  function (this: Element) {
    focused = this;
  };
/*
 * …and a node the draw removed is *not* focused, which is the whole defect.
 *
 * Chrome moves focus to `<body>` the moment the focused element leaves the
 * document, so the stale node stops receiving keys — Month › advanced once and
 * the second Enter went nowhere (2026-09-22). A harness that kept answering
 * with the detached button would let a broken build pass every assertion here
 * *and* let a second synthetic Enter "work" on a node no keyboard could reach.
 * Mutating this back to `focused ?? body` **survives** the suite, because the
 * assertions below compare against the *live* control (`toBe(fwd())`) and a
 * stale node fails that on identity alone. It stays anyway, and this is why:
 * without it a click dispatched at `document.activeElement` still runs the
 * handler of a button the draw removed, so "the second activation advanced
 * too" would be a statement about a node no keyboard could reach. The check
 * makes the second press a real one rather than a fiction.
 */
Object.defineProperty(popup.document, "activeElement", {
  get: () =>
    focused && popup.document.contains(focused as unknown as Node)
      ? focused
      : popup.document.body,
  configurable: true,
});

/* ---- `<select>.value`, which linkedom leaves read-only -------------------
 *
 * The editor's Kind control is a real `<select>`, and `select.value = …` is
 * how it is prefilled — so without this the *whole* editor path throws on
 * construction and nothing about the add form can be tested here at all. The
 * shim is the one line of the DOM spec linkedom is missing, not a stand-in for
 * the behaviour under test: nothing below asserts on a `<select>`.
 */
// `scrollIntoView` — the screen form asks for it; there is nothing to scroll.
(popup.HTMLElement as { prototype: { scrollIntoView: () => void } }).prototype.scrollIntoView =
  function () {
    /* no layout here */
  };
// `input.select()` — the same gap, one element over: the editor selects the
// title it focuses so an edit can be typed straight over.
(popup.HTMLInputElement as { prototype: { select: () => void } }).prototype.select =
  function () {
    /* no selection model here; the call must simply not throw */
  };
Object.defineProperty(popup.HTMLSelectElement.prototype, "value", {
  get(this: Element) {
    return this.getAttribute("value") ?? "";
  },
  set(this: Element, next: string) {
    this.setAttribute("value", next);
  },
  configurable: true,
});

/* ---- the scroller, faked, including the clamp that causes the defect ----
 *
 * linkedom lays nothing out, so `scrollTop`, `scrollHeight` and `clientHeight`
 * are whatever this says they are. Two of the three are just numbers; the third
 * is the mechanism under test and has to be simulated or nothing here is
 * load-bearing.
 *
 * **The mechanism.** `render` calls `viewEl.replaceChildren()`. For the moment
 * between that and the re-append the document has no height, so the browser
 * clamps the offset to 0 — that is why Hide "brings the screen back up to the
 * top" (Sushi, 2026-09-19). So `#view`'s `replaceChildren` zeroes `page.top`
 * here exactly as Chrome does, which is what makes "read the offset *before*
 * the replace" a thing a test can fail on: read it afterwards and it is 0, in
 * this harness and in Chrome alike.
 *
 * What this still cannot prove is the number itself — whether 240 is the same
 * place on screen after a row is gone is a question about layout, and there is
 * none here. See lane-draw.md.
 */
const page = { top: 0, scrollHeight: 2000, clientHeight: 600 };
const root = popup.document.documentElement as unknown as HTMLElement;
Object.defineProperty(root, "scrollTop", {
  get: () => page.top,
  set: (y: number) => {
    page.top = y;
  },
  configurable: true,
});
Object.defineProperty(root, "scrollHeight", { get: () => page.scrollHeight, configurable: true });
Object.defineProperty(root, "clientHeight", { get: () => page.clientHeight, configurable: true });
Object.defineProperty(popup.document, "scrollingElement", { get: () => root, configurable: true });
{
  const viewNode = popup.document.getElementById("view")!;
  const real = viewNode.replaceChildren.bind(viewNode) as (...nodes: unknown[]) => void;
  (viewNode as unknown as { replaceChildren: (...nodes: unknown[]) => void }).replaceChildren = (
    ...nodes: unknown[]
  ) => {
    page.top = 0; // the document loses its height; Chrome clamps
    real(...nodes);
  };
}

/* ---- the clock, pinned --------------------------------------------------
 *
 * Tuesday 2026-09-22, 11:14 CDT — the instant `scripts/preview-clock.js` and
 * `tests/preview-acceptance.test.ts` already pin, so the reference dataset here
 * is the one the harness draws.
 *
 * Unpinned, three rail tests failed every evening from 22:00 to midnight
 * (tests-health #1, 2026-09-27; PROGRESS recorded two such evening runs): the
 * rail's rows are cloned at now±1h, the past one is Late's, and from 22:00 the
 * future one is past `END_OF_DAY_MINUTES` and lands in "By end of day" — so no
 * rail was drawn, and a test about the rail failed for a reason that was the
 * clock's. Only `Date` is faked: `settle()` still needs a real `setTimeout`.
 * Not in `setupFiles` — a global fake makes `Date.now() - started` zero in the
 * suite's three perf bounds, which then pass vacuously.
 */
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-09-22T16:14:00Z"));
afterAll(() => {
  vi.useRealTimers();
});

/* ---- the worker, stubbed ------------------------------------------------ */
const now = Date.now();
const items: Item[] = referenceItems(now);
const SOURCES: Source[] = [
  "canvas", "gradescope", "prairielearn", "prairietest", "smartphysics", "site", "manual",
];
const sources = Object.fromEntries(
  SOURCES.map((source) => [
    source,
    { source, enabled: false, state: "disabled", consecutiveFailures: 0 } satisfies SourceStatus,
  ]),
) as Record<Source, SourceStatus>;
const REFUSAL =
  "Preview does not simulate override. This journey needs a stateful stub or an isolated Chrome check.";
/** What the next correction is answered with. */
let answer: () => unknown = () => ({ type: "ok" });
/** The worker's "found in a post" list; a test pushes and empties it. */
const suggestions: Suggestion[] = [];
const sent: { type: string }[] = [];

const globals = globalThis as unknown as Record<string, unknown>;
globals["document"] = popup.document;
globals["window"] = popup.window;
globals["HTMLElement"] = popup.HTMLElement;
// `shell.ts`'s press listener asks `event.target instanceof Element`.
globals["Element"] = popup.Element;
globals["Node"] = popup.Node;
globals["HTMLAnchorElement"] = popup.HTMLAnchorElement;
globals["HTMLButtonElement"] = popup.HTMLButtonElement;
// `trapMenuKeys` asks whether a key landed in the rename box.
globals["HTMLInputElement"] = popup.HTMLInputElement;
globals["location"] = { search: "" };
globals["localStorage"] = {
  // The week: every day has rows in the reference dataset, and Today may draw
  // its quiet card when no source has answered, which has nothing to press.
  getItem: (key: string) => (key === "illini-dash.view" ? "week" : null),
  setItem: () => undefined,
  removeItem: () => undefined,
};
// The minute tick would keep the worker alive for nothing.
globals["setInterval"] = () => 0;
globals["chrome"] = {
  runtime: {
    sendMessage: async (request: { type: string }) => {
      sent.push(request);
      switch (request.type) {
        case "get-setup":
          return { type: "setup" };
        case "get-state":
          return {
            type: "state",
            items,
            sources,
            settings: DEFAULT_SETTINGS,
            courseNames: {},
            suggestions,
            observers: { piazza: { enabled: false }, campuswire: { enabled: false } },
            lastSyncAt: new Date(now).toISOString(),
          };
        case "override":
        case "accept-suggestion":
        case "dismiss-suggestion":
        case "undo-move":
          return answer();
        default:
          return { type: "ok" };
      }
    },
    getURL: (path: string) => path,
  },
  tabs: { create: () => undefined },
};

const { MENU_CLASS, VIEWS, VIEW_LABEL, app, state } = await import("../src/ui/popup/state.js");

/**
 * The rules of one stylesheet, as `{selector, decls}` — the same reader
 * `row-order.test.ts` uses, because what a rule says is the only thing a
 * document with no layout engine can check about it.
 */
const rulesOf = (path: string): { selector: string; decls: Record<string, string> }[] => {
  const css = readFileSync(new URL(`../public/${path}`, import.meta.url), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const out: { selector: string; decls: Record<string, string> }[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls: Record<string, string> = {};
    for (const decl of match[2]!.split(";")) {
      const colon = decl.indexOf(":");
      if (colon === -1) continue;
      decls[decl.slice(0, colon).trim()] = decl.slice(colon + 1).trim();
    }
    out.push({ selector: match[1]!.trim().replace(/\s+/g, " "), decls });
  }
  return out;
};
const shell = await import("../src/ui/popup/shell.js");
await import("../src/ui/popup.js");

const settle = (ms = 25) => new Promise((resolve) => setTimeout(resolve, ms));
const view = () => document.getElementById("view")!;
const tabs = () => document.getElementById("tabs")!;
const status = () => document.getElementById("status")!;
const press = (el: Element) => el.dispatchEvent(new popup.Event("pointerdown", { bubbles: true }));
const release = (el: Element) => el.dispatchEvent(new popup.Event("pointerup", { bubbles: true }));
const click = (el: Element) => el.dispatchEvent(new popup.Event("click", { bubbles: true }));
const keydown = (el: Element, key: string) => {
  const event = new popup.Event("keydown", { bubbles: true });
  Object.defineProperty(event, "key", { value: key });
  el.dispatchEvent(event);
};
const rowOf = (title: string) =>
  [...view().querySelectorAll<HTMLElement>("a.row, div.row")].find(
    (row) => row.querySelector(".row--title")?.textContent === title,
  );
/**
 * A row's keyboard stop: its link, or a typed row's `role=button` title.
 *
 * Since 2026-09-27 the card is a `div.row` holding the link and the ⋯ side by
 * side (a11y review #12), so the element focus lands on is the link inside the
 * card, not the card. Tests that asserted focus on "the row" assert it on this.
 */
const stopOf = (row: Element | undefined) =>
  row?.querySelector<HTMLElement>(".row--link") ?? undefined;

beforeAll(async () => {
  // The entry's own open-sync and first draw.
  await settle(60);
});

describe("the document after the entry's first draw", () => {
  it("drew the week with rows and no stale-worker notice", () => {
    expect(state.view).toBe("week");
    expect(view().querySelectorAll("a.row, div.row").length).toBeGreaterThan(0);
    expect(status().hidden).toBe(true);
    expect(state.observerMissing).toEqual([]);
  });
});

describe("I02 — a screen opened or closed by a held press focuses the right control", () => {
  it("opens a deadline from a held press and focuses ‹ back on the deferred draw", async () => {
    const row = rowOf(items[0]!.title) ?? view().querySelector<HTMLElement>("a.row, div.row")!;
    const title = row.querySelector(".row--title")!.textContent!;
    const item = state.currentItems.find((candidate) => candidate.title === title)!;

    press(row); // mousedown inside #view: the draw is now held
    row.focus();
    app.openDeadline(item);
    await settle();
    // Held: nothing was drawn, and the request is still waiting.
    expect(view().querySelector(".screen-bar")).toBeNull();
    expect(state.focusAfterDraw).toEqual({ kind: "screen-back" });
    expect(document.activeElement).toBe(row);

    release(row); // one task later, `endPress` runs the owed draw
    await settle();
    const back = view().querySelector<HTMLElement>(".screen-bar button");
    expect(back, "the deferred draw rendered the screen").not.toBeNull();
    expect(document.activeElement).toBe(back);
    expect(state.focusAfterDraw).toBeUndefined();
  });

  it("keeps the request when the press begins while the state is in flight", async () => {
    // The other order: the refresh has passed its own held check and is
    // waiting on the worker when the button goes down. `render` is the second
    // guard, and a draw it declines must not count as one that consumed the
    // request (mutation M1: `render` returning true while held survived every
    // other test here, because they press before they refresh).
    const back = view().querySelector<HTMLElement>(".screen-bar button")!;
    click(back); // closeScreen: request the row, refresh not held yet
    await settle();
    const row = view().querySelector<HTMLElement>("a.row, div.row")!;
    const title = row.querySelector(".row--title")!.textContent!;
    const item = state.currentItems.find((candidate) => candidate.title === title)!;
    app.openDeadline(item); // request ‹ back; the refresh passes its check…
    press(row); // …and the button goes down before the worker answers
    await settle();
    expect(view().querySelector(".screen-bar"), "render declined the held draw").toBeNull();
    expect(state.focusAfterDraw).toEqual({ kind: "screen-back" });
    release(row);
    await settle();
    const drawn = view().querySelector<HTMLElement>(".screen-bar button");
    expect(drawn).not.toBeNull();
    expect(document.activeElement).toBe(drawn);
  });

  it("returns to the row it came from when ‹ back is pressed with the pointer", async () => {
    const back = view().querySelector<HTMLElement>(".screen-bar button")!;
    const wanted = state.currentItems.find((candidate) => candidate.id === (state.screen as { itemId?: string }).itemId)!;
    press(back);
    back.focus();
    click(back); // `closeScreen`: the refresh is held by the press
    await settle();
    expect(view().querySelector(".screen-bar"), "still held").not.toBeNull();
    release(back);
    await settle();
    expect(view().querySelector(".screen-bar")).toBeNull();
    const row = rowOf(wanted.title);
    expect(row).toBeDefined();
    expect(document.activeElement).toBe(stopOf(row));
  });

  /*
   * The footer's source button opens **Sources**, which has no tab.
   *
   * It used to open the Needs-you *screen* in front of the calendar; then, for
   * about an hour on 2026-09-19, a sixth tab. Sushi took the tab off — "theres
   * alr a sources tab at the top, no need for one at the bottom right" — and
   * the thing at the top is this button. So the press has to do three things
   * that a tab would otherwise have done for it: draw the view, leave no
   * `.screen-bar` behind, and put focus somewhere real. There is no tab to
   * focus, so the draw returns it to the rebuilt button (I01's mechanism,
   * applied to a view with no stop on the strip).
   */
  it("opens Sources from the footer's source button, and keeps focus on it", async () => {
    shell.selectTab("day");
    await settle();
    const health = document.querySelector<HTMLElement>(`.${shell.FOOT_HEALTH_CLASS}`)!;
    expect(health.getAttribute("aria-pressed")).toBe("false");
    click(health); // outside #view: not held, draws at once
    await settle();
    expect(state.view).toBe("sources");
    expect(view().querySelector(".screen-bar")).toBeNull();
    expect(view().querySelector(".sources")).not.toBeNull();
    // No sixth tab, and no tab selected while Sources is showing.
    const labels = [...tabs().querySelectorAll("[role='tab']")].map((t) => t.textContent);
    expect(labels.length).toBe(5);
    expect(labels.some((label) => label?.includes(VIEW_LABEL.sources))).toBe(false);
    expect(tabs().querySelector("[role='tab'][aria-selected='true']")).toBeNull();
    // Focus is on the strip's button, rebuilt by the draw — not on `<body>`.
    const rebuilt = document.querySelector<HTMLElement>(`.${shell.FOOT_HEALTH_CLASS}`)!;
    expect(rebuilt).not.toBe(health);
    expect(document.activeElement).toBe(rebuilt);
    expect(rebuilt.getAttribute("aria-pressed")).toBe("true");
    // Back to a tab, so the next test starts on the strip.
    shell.selectTab("week");
    await settle();
  });
});

describe("I01 — arrow keys keep working across the strip's redraws", () => {
  it("moves selection and focus together, twice in a row", async () => {
    const selected = () =>
      tabs().querySelector<HTMLElement>("[role='tab'][aria-selected='true']")!;
    selected().focus();
    const before = state.view;
    keydown(selected(), "ArrowRight");
    await settle();
    expect(state.view).not.toBe(before);
    expect(document.activeElement).toBe(selected());
    expect(selected().textContent).toContain(VIEW_LABEL[state.view]);

    const second = state.view;
    keydown(document.activeElement!, "ArrowRight"); // the *new* tab, not a stale node
    await settle();
    expect(state.view).not.toBe(second);
    expect(document.activeElement).toBe(selected());
  });

  it("moves focus to the tab a control elsewhere selected", async () => {
    // The quiet day's "See the week" and any other caller of `selectTab`
    // that is not on the strip: focus was on a control the redraw destroys,
    // and nothing implicit can put it back (mutation M3: with focus already
    // on the strip the implicit request masks the explicit one).
    const add = document.querySelector<HTMLElement>("#actions button")!;
    add.focus();
    shell.selectTab("month");
    await settle();
    expect(state.view).toBe("month");
    const selected = tabs().querySelector<HTMLElement>("[role='tab'][aria-selected='true']")!;
    expect(selected.textContent).toContain(VIEW_LABEL.month);
    expect(document.activeElement).toBe(selected);
  });

  it("puts focus back on the strip after a redraw nobody asked for", async () => {
    const selected = () =>
      tabs().querySelector<HTMLElement>("[role='tab'][aria-selected='true']")!;
    const stale = selected();
    stale.focus();
    await app.refresh(); // a store write, the minute tick, the open-sync
    expect(selected()).not.toBe(stale);
    expect(document.activeElement).toBe(selected());
  });

  it("puts focus back on the row that had it after a redraw nobody asked for", async () => {
    state.view = "week";
    await app.refresh();
    const rows = [...view().querySelectorAll<HTMLElement>("a.row, div.row")];
    const card = rows[1] ?? rows[0]!;
    const title = card.querySelector(".row--title")!.textContent!;
    const stale = stopOf(card)!;
    stale.focus();
    await app.refresh();
    const fresh = stopOf(rowOf(title))!;
    expect(fresh).not.toBe(stale);
    expect(document.activeElement).toBe(fresh);
  });
});

describe("the Alerts tab gathers what is asking, in one order", () => {
  /*
   * Sushi, 2026-09-19: "combine no date and needs you in the same tab." The
   * order is what has a deadline behind it first and what is merely unfinished
   * last — Late, Found in a post, then the two undated groups. The sources
   * themselves left this tab later the same day ("the sources page in alerts
   * should be in the sources tab"), and the sections below pin that they are
   * *gone* from here rather than merely last: a section drawn out of that
   * order is a student meeting this extension's problems before their own.
   */
  it("draws the sections in the written order, and no source list", async () => {
    shell.selectTab("nodate");
    await settle();
    const wrap = view().querySelector<HTMLElement>(".needsyou")!;
    expect(wrap, "the Alerts tab drew its own screen").not.toBeNull();

    // Section names in the order they appear, whichever of them this dataset
    // produces. Named by their headings rather than by index: a dataset with no
    // late rows must not make this test assert a position that is not there.
    const heads = [...wrap.querySelectorAll<HTMLElement>(".section-head")].map(
      (head) => head.firstElementChild?.textContent ?? "",
    );
    const wanted = ["Late", "Found in a post", "No date at all", "Couldn't read"];
    expect(heads.filter((name) => wanted.includes(name))).toEqual(
      wanted.filter((name) => heads.includes(name)),
    );
    // The sources are on their own tab: not the last section here, not any
    // section here, and no source row left behind either.
    expect(heads).not.toContain("Sources");
    expect(wrap.querySelector(".needsyou--source")).toBe(null);
    expect(wrap.querySelector(".needsyou--notice")).toBe(null);
    // …and nothing follows the last group. A dashed "Add something by hand"
    // card used to close the tab; it was removed on 2026-09-19 ("remove the add
    // something by hand in the alerts"). Adding by hand is the header's `+` on
    // every tab and the floating `+` on Day, Week and Month.
    expect(wrap.querySelector(".nodate-add")).toBe(null);
  });

  it("puts Piazza and Campuswire in the Sources tab's list, as rows of the same shape", async () => {
    shell.selectTab("sources");
    await settle();
    // "why is needs you in sources" — they were two cards of a different shape
    // under the list, which said in layout that they were a different kind of
    // thing. They are sources.
    const list = view().querySelector<HTMLElement>(".needsyou--list")!;
    const names = [...list.querySelectorAll(".needsyou--source-name")].map((n) => n.textContent);
    expect(names).toContain("Piazza");
    expect(names).toContain("Campuswire");
    for (const row of list.querySelectorAll<HTMLElement>(".needsyou--source")) {
      expect(row.firstElementChild?.classList.contains("needsyou--dot")).toBe(true);
    }
    // Both are switched off in this fixture, so neither may wear a green dot
    // (worker rule 2). The two observer rows are the last two in the list.
    const tail = [...list.querySelectorAll<HTMLElement>(".needsyou--source")].slice(-2);
    expect(tail.map((row) => row.querySelector(".needsyou--source-name")?.textContent)).toEqual([
      "Piazza",
      "Campuswire",
    ]);
    for (const row of tail) {
      const dot = row.querySelector<HTMLElement>(".needsyou--dot")!;
      expect(dot.classList.contains("is-ok")).toBe(false);
      expect(dot.classList.contains("is-off")).toBe(true);
    }
  });
});

describe("the Alerts tab's two undated counts", () => {
  it("gives only the Couldn't-read section the soft count (V02)", async () => {
    // The reference dataset: three undated rows and one unreadable one. The
    // mock draws section 1's count as the navy block and keeps the peach for
    // "Couldn't read" alone; a modifier on every count, or on none, would
    // make the two sections read as equals with nothing thrown.
    shell.selectTab("nodate");
    await settle();
    const counts = [...view().querySelectorAll<HTMLElement>(".nodate-group--count")];
    expect(counts.length).toBe(2);
    expect(counts.map((count) => count.classList.contains("nodate-group--count--soft"))).toEqual([
      false,
      true,
    ]);
    expect(counts[1]!.textContent).toBe("1 ambiguous");
    // And no trailing glyph at all. This asserted four of them, one per card,
    // on the argument that each said only what the data said. That was true
    // about the *meaning* and beside the point about the appearance: a 20px
    // outlined box in a card's top-right corner reads as a button, and it sat
    // 8px from the ⋯ that actually is one — the second trailing control Sushi
    // had already ruled out once ("pick one bro. just pick the 3 dots",
    // 2026-09-19, commit e60f4c4). The facts they carried are still on the
    // card in words: the section heading, the amber "Ambiguous date text" chip,
    // the quoted source text, and the card's own tooltip. They were
    // `aria-hidden`, so nothing was announced and nothing is lost.
    expect(view().querySelectorAll(".nodate-glyph").length).toBe(0);
  });
});

describe("I03 — a refused correction stays on screen and does not redraw", () => {
  let refreshes = 0;
  const real = app.refresh;
  app.refresh = () => {
    refreshes += 1;
    return real();
  };
  const box = document.createElement("div");
  const tick = document.createElement("button");
  tick.type = "button";
  tick.textContent = "Tick off";
  const hide = document.createElement("button");
  hide.type = "button";
  hide.textContent = "Hide";
  box.append(tick, hide);
  document.body.append(box);

  it("keeps the worker's refusal visible, restores the control, and does not refresh", async () => {
    answer = () => ({ type: "error", message: REFUSAL });
    const drawsBefore = refreshes;
    shell.applyOverrideAction({ kind: "done", itemId: "reference-late" }, tick);
    expect(tick.textContent).toContain("Applying…");
    expect(tick.disabled).toBe(true);
    expect(hide.disabled).toBe(true);
    await settle();

    expect(refreshes).toBe(drawsBefore);
    expect(status().hidden).toBe(false);
    expect(status().textContent).toContain(REFUSAL);
    expect(state.actionError).toBe(REFUSAL);
    expect(tick.textContent).toBe("Tick off");
    expect(tick.disabled).toBe(false);
    expect(hide.disabled).toBe(false);
  });

  it("survives the draw that used to erase it", async () => {
    await real(); // a draw ends with `showStatus(<no notice>)`
    expect(status().hidden).toBe(false);
    expect(status().textContent).toContain(REFUSAL);
  });

  it("goes away on Dismiss, and nowhere else", () => {
    const dismiss = [...status().querySelectorAll("button")].find(
      (button) => button.textContent === "Dismiss",
    );
    expect(dismiss).toBeDefined();
    click(dismiss!);
    expect(status().hidden).toBe(true);
    expect(state.actionError).toBeUndefined();
  });

  it("names a rejected send the same way, with the action in the sentence", async () => {
    answer = () => {
      throw new Error("boom");
    };
    shell.applyOverrideAction({ kind: "hide", itemId: "reference-late" }, tick);
    await settle();
    expect(status().textContent).toContain("Could not hide that row: boom");
    expect(tick.textContent).toBe("Tick off");
  });

  it("treats a suggestion's refusal the same way", async () => {
    answer = () => ({ type: "error", message: "no such suggestion" });
    const drawsBefore = refreshes;
    shell.applySuggestionRequest({ type: "accept-suggestion", id: "s1" }, hide);
    await settle();
    expect(refreshes).toBe(drawsBefore);
    expect(status().textContent).toContain("no such suggestion");
    expect(hide.textContent).toBe("Hide");
  });

  it("clears the refusal and redraws when a later correction succeeds", async () => {
    answer = () => ({ type: "ok" });
    const drawsBefore = refreshes;
    shell.applyOverrideAction({ kind: "done", itemId: "reference-late" }, tick);
    await settle();
    expect(refreshes).toBe(drawsBefore + 1);
    expect(state.actionError).toBeUndefined();
    expect(status().hidden).toBe(true);
    expect(sent.filter((request) => request.type === "override").length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* The scroll position across a redraw (Sushi, 2026-09-19)                     */
/* -------------------------------------------------------------------------- */

/*
 * "clicking a button shifts the location in the popup/full screen page, like
 * hiding a button brings the screen back up to the top after i already scrolled
 * down midway."
 *
 * The rule, written out in `src/ui/popup/scroll.ts`: a redraw keeps your place,
 * a navigation starts at the top, and coming back from a screen returns you to
 * where you left. These are the four cases of that sentence plus the clamp.
 */
describe("a redraw keeps the student's place", () => {
  const scrollTo = (y: number) => {
    page.top = y;
  };

  it("keeps the offset across a redraw of the same view", async () => {
    shell.selectTab("week");
    await settle();
    scrollTo(240);
    await app.refresh(); // a store write, a Hide, the minute tick, the open-sync
    expect(page.top).toBe(240);
  });

  it("restores it on the draw that actually drew, not on the held one", async () => {
    shell.selectTab("week");
    await settle();
    scrollTo(300);
    const row = view().querySelector<HTMLElement>("a.row, div.row")!;
    press(row); // a mouse button down inside the list: the draw is held
    await app.refresh();
    expect(page.top, "nothing was replaced, so nothing moved").toBe(300);
    expect(state.scrollAfterDraw, "a held draw asks for nothing").toBeUndefined();
    release(row); // one task later, `endPress` runs the owed draw
    await settle();
    expect(page.top).toBe(300);
  });

  it("clamps to the end of a document the redraw made shorter", async () => {
    // Hiding a row is the case: the list is shorter than the offset the draw
    // remembered, and the answer is its bottom — never a blank viewport.
    shell.selectTab("week");
    await settle();
    scrollTo(240);
    page.scrollHeight = 700; // 700 - 600 of viewport = 100 of travel left
    await app.refresh();
    expect(page.top).toBe(100);
    page.scrollHeight = 2000;
  });

  it("starts a tab the student switched to at the top", async () => {
    shell.selectTab("week");
    await settle();
    scrollTo(240);
    shell.selectTab("exams");
    await settle();
    expect(page.top).toBe(0);
  });

  it("starts the next week at the top, and keeps the place within it", async () => {
    // ‹ › does not change the tab, so the place has to be the tab *and* the day
    // it is anchored on, or stepping a week would drop the student into the
    // middle of seven days they have not seen.
    shell.selectTab("week");
    await settle();
    scrollTo(240);
    state.dayOffset += 7;
    await app.refresh();
    expect(page.top).toBe(0);
    scrollTo(180);
    await app.refresh();
    expect(page.top).toBe(180);
    state.dayOffset = 0;
    await app.refresh();
  });

  it("opens a screen at the top and comes back to the row it was opened from", async () => {
    shell.selectTab("week");
    await settle();
    scrollTo(260);
    const row = view().querySelector<HTMLElement>("a.row, div.row")!;
    const title = row.querySelector(".row--title")!.textContent!;
    const item = state.currentItems.find((candidate) => candidate.title === title)!;

    app.openDeadline(item);
    await settle();
    expect(view().querySelector(".screen-bar"), "the screen is showing").not.toBeNull();
    expect(page.top, "a screen is new content").toBe(0);

    scrollTo(40); // the student read down the screen a little
    const back = view().querySelector<HTMLElement>(".screen-bar button")!;
    click(back);
    await settle();
    expect(view().querySelector(".screen-bar")).toBeNull();
    expect(page.top, "back to the list, where it was left").toBe(260);
  });

  it("does not hand a remembered offset to a tab the student pressed instead", async () => {
    // The memory is for the screen round trip only. Leaving the list for a
    // screen and then pressing a tab must not restore anything, and must not
    // leave the offset lying in wait for the next visit to that tab either.
    shell.selectTab("week");
    await settle();
    scrollTo(320);
    const row = view().querySelector<HTMLElement>("a.row, div.row")!;
    const title = row.querySelector(".row--title")!.textContent!;
    app.openDeadline(state.currentItems.find((candidate) => candidate.title === title)!);
    await settle();
    shell.selectTab("month");
    await settle();
    expect(page.top).toBe(0);
    shell.selectTab("week");
    await settle();
    expect(page.top, "a tab press is a navigation, however long you spent there").toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* The date strip (Sushi, 2026-09-19: "today doesnt even show the date")       */
/* -------------------------------------------------------------------------- */

describe("the date strip says what is being looked at", () => {
  const nav = () => document.getElementById("nav")!;

  /*
   * This asserted the opposite — that Today draws a strip reading "Today · …" —
   * and it was pinning a bug. The date was always on the day view, in the folio
   * head above the bands; what was missing was the folio itself on a day with
   * nothing due (`if (total > 0)`). Putting the date in the strip fixed that one
   * case and duplicated it on every other (Sushi: "both the popup and
   * fullscreen say the date twice"). The folio is unconditional now, so the
   * requirement is: exactly one date on the day view, busy or quiet.
   */
  it("gives Today no strip, because its folio head carries the date", async () => {
    shell.selectTab("day");
    await settle();
    expect(nav().hidden, "the day view has no navigator").toBe(true);
    const folio = view().querySelector<HTMLElement>(".folio--date");
    expect(folio, "the folio head is drawn").not.toBeNull();
    expect(folio!.textContent).toMatch(/\w+day, \w+ \d+/);
    // And the date is said once: nothing else on the tab repeats it.
    const shown = [...view().querySelectorAll<HTMLElement>(".folio--date, .datenav--label")];
    expect(shown).toHaveLength(1);
  });

  it("still draws the folio head when the day is empty", async () => {
    // The case the "no date" report was actually about. `renderDateNav` cannot
    // cover it — the day view has no strip — so the head has to be drawn
    // whether or not the day has anything on it.
    shell.selectTab("day");
    await settle();
    expect(view().querySelector(".folio--date"), "folio on a drawn day").not.toBeNull();
  });

  it("keeps Week's and Month's arrows either side of their label", async () => {
    for (const [tab, step] of [["week", 7], ["month", 28]] as const) {
      shell.selectTab(tab);
      await settle();
      expect(nav().hidden).toBe(false);
      expect(nav().querySelector("[aria-label='Back']")).not.toBeNull();
      expect(nav().querySelector("[aria-label='Forward']")).not.toBeNull();
      // `views/week.ts` and `views/month.ts` both append into this strip after
      // it is built, and `month.ts` finds its anchor by looking the label up.
      const children = [...nav().children];
      const label = nav().querySelector<HTMLElement>(".datenav--label")!;
      expect(children.indexOf(label), "the label sits between the two arrows").toBe(1);
      expect(step > 0).toBe(true);
    }
  });

  it("hides the strip for a view with no running head at all", async () => {
    // `navFor`'s `default:` — Alerts and Exams return `label: ""`, and an empty
    // strip is a bar of padding above the list.
    for (const tab of ["nodate", "exams"] as const) {
      shell.selectTab(tab);
      await settle();
      expect(nav().hidden).toBe(true);
      expect(nav().children.length).toBe(0);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The date navigator's own focus (2026-09-22)                                 */
/* -------------------------------------------------------------------------- */

/**
 * I01, one strip over.
 *
 * Measured on the real 400×600 popup with Chrome's own input pipeline: focus
 * Month ›, press Enter — September becomes October and `document.activeElement`
 * becomes `BODY`, so the second Enter does nothing and the view sits on
 * October. Pointer activation stranded focus the same way.
 * (`artifacts/ui-acceptance/uiuc-readiness-20260922/interaction/`
 * `keyboard-date-navigation.json`, `month-next.json`.)
 *
 * `renderDateNav` `replaceChildren()`s `#nav` on every draw, so the arrow the
 * student pressed is destroyed by the draw its own press started — and `#nav`
 * is a sibling of `#view` and `#tabs`, so `focusRequestFor` never looked at it
 * either. Both halves of the mechanism were missing, and both are wanted: the
 * tests below are arranged so each one can only pass by the half it names.
 */
describe("the date navigator survives the draw its own press starts", () => {
  const nav = () => document.getElementById("nav")!;
  const fwd = () => nav().querySelector<HTMLElement>(".datenav--fwd");
  const back = () => nav().querySelector<HTMLElement>(".datenav--back");
  const todayPill = () => nav().querySelector<HTMLElement>(".datenav--today");
  const addButton = () => document.querySelector<HTMLElement>("#actions button")!;

  /**
   * What Chrome does for Enter on a focused `<button>`: the keydown's default
   * action is a `click`. Nothing in the popup listens for keydown on this
   * strip, so the click handler is the whole keyboard path — and dispatching
   * the keydown as well is what makes that claim checkable rather than assumed.
   */
  const enter = (el: Element) => {
    keydown(el, "Enter");
    click(el);
  };

  /** A pointer press that does not focus: `pointerdown`, `click`, `pointerup`. */
  const tap = (el: Element) => {
    press(el);
    click(el);
    release(el);
  };

  async function onMonth(): Promise<void> {
    shell.selectTab("month");
    await settle();
    state.dayOffset = 0;
    await app.refresh();
  }

  /*
   * A press this block began and did not finish holds **every** later draw.
   *
   * Two of the tests below put a mouse button down on the list on purpose. If
   * one of them fails before its `release`, `createPressHold`'s flag is left
   * set for the rest of the file and `drawIsHeld` declines every redraw after
   * it — which is how removing the fix turned nine failures into twenty-three,
   * across five describes that have nothing to do with the navigator. The
   * cascade is not a second defect; it is this file lying about the blast
   * radius of the first one.
   */
  afterEach(() => {
    release(document.body);
  });

  // Every test here leaves the calendar stepped off today on purpose, and the
  // describes after this one read the *current* week. Put back, so a failure
  // in this block is one failure rather than a cascade through five others.
  afterAll(async () => {
    state.dayOffset = 0;
    shell.selectTab("week");
    await settle();
  });

  it("advances twice in a row from the keyboard, and keeps › focused", async () => {
    await onMonth();
    const first = fwd()!;
    first.focus();

    enter(first);
    await settle();
    expect(state.dayOffset, "one step of whole weeks").toBe(28);
    // The arrow was rebuilt, so this is a *different* element — and focus has
    // to be on the new one. Before the fix it was on `first`, which the draw
    // had removed, which Chrome reports as `<body>`.
    expect(fwd()).not.toBe(first);
    expect(document.activeElement).toBe(fwd());

    // The second Enter goes wherever focus actually is — the whole defect is
    // that a student's second press lands on `<body>` and does nothing.
    enter(document.activeElement!);
    await settle();
    expect(state.dayOffset, "the second Enter advanced too").toBe(56);
    expect(document.activeElement).toBe(fwd());
  });

  it("advances twice in a row from the pointer, which never focused anything", async () => {
    // This one can only pass by the **explicit** request: nothing calls
    // `.focus()`, so `document.activeElement` is `<body>` when the draw reads
    // it and `focusRequestFor` has nothing to derive from.
    await onMonth();
    const first = fwd()!;
    tap(first);
    await settle();
    expect(state.dayOffset).toBe(28);
    expect(document.activeElement).toBe(fwd());

    tap(fwd()!);
    await settle();
    expect(state.dayOffset).toBe(56);
    expect(document.activeElement).toBe(fwd());
  });

  it("does the same for ‹ back, and on Week as well as Month", async () => {
    // `renderDateNav(label, step)` is one function for both views and both
    // arrows; the defect was never about one button.
    shell.selectTab("week");
    await settle();
    state.dayOffset = 0;
    await app.refresh();
    const first = back()!;
    first.focus();
    enter(first);
    await settle();
    expect(state.dayOffset, "a week backwards").toBe(-7);
    expect(back()).not.toBe(first);
    expect(document.activeElement).toBe(back());
    enter(document.activeElement!);
    await settle();
    expect(state.dayOffset).toBe(-14);
  });

  it("leaves focus in the strip when Today removes the pill under the finger", async () => {
    await onMonth();
    enter(fwd()!);
    await settle();
    const pill = todayPill();
    expect(pill, "the pill appears once the offset is not 0").not.toBeNull();
    pill!.focus();
    enter(pill!);
    await settle();
    expect(state.dayOffset).toBe(0);
    // The pill only exists while the offset is not 0, so it is gone — and the
    // request falls back to the first control left rather than to `<body>`.
    expect(todayPill()).toBeNull();
    expect(document.activeElement).toBe(back());
  });

  it("puts focus back on the arrow after a redraw nobody asked for", async () => {
    // The **implicit** half on its own: the minute tick, a store write and the
    // popup's open-sync all rebuild this strip under a student who has just
    // tabbed to it, and no control asked for anything.
    await onMonth();
    const stale = fwd()!;
    stale.focus();
    expect(state.focusAfterDraw).toBeUndefined();
    await app.refresh();
    expect(state.dayOffset, "a background redraw moves nothing").toBe(0);
    expect(fwd()).not.toBe(stale);
    expect(document.activeElement).toBe(fwd());
  });

  it("honours the explicit request when focus was never on the strip", async () => {
    // And the **explicit** half on its own, the way `selectTab`'s mutation M3
    // had to be separated: with focus on a control the redraw does not rebuild,
    // `focusRequestFor` returns undefined, so only the request the handler
    // wrote can land focus on ›.
    await onMonth();
    addButton().focus();
    click(fwd()!);
    await settle();
    expect(state.dayOffset).toBe(28);
    expect(document.activeElement).toBe(fwd());
  });

  it("keeps the request across a draw a held press deferred", async () => {
    /*
     * The ordering the suite had never reached (CLAUDE.md, mutation house rule
     * 5): every other test here activates a control *before* anything holds
     * the draw. Here a mouse button is already down inside the list — a
     * scroll-drag, or the student steadying the popup — so `render` declines,
     * and the draw that finally rebuilds the strip is the deferred one
     * `endPress` runs a task later. It must honour a request it never saw
     * made, which is the whole reason focus is a request and not a `.then`.
     *
     * Focus is left on the header's + so nothing implicit can mask it: the
     * deferred draw has only the explicit request to work from.
     */
    await onMonth();
    const row = view().querySelector<HTMLElement>("a.row, div.row, .mpill[role='button']")!;
    addButton().focus();
    press(row); // the draw is now held
    click(fwd()!);
    await settle();
    expect(state.dayOffset, "the handler ran; only the draw waited").toBe(28);
    expect(state.focusAfterDraw, "still owed").toEqual({ kind: "date-nav", control: "forward" });
    expect(document.activeElement).toBe(addButton());

    release(row); // `endPress` runs the owed draw
    await settle();
    expect(state.focusAfterDraw).toBeUndefined();
    expect(document.activeElement).toBe(fwd());
  });

  it("keeps the request when the press begins while the state is in flight", async () => {
    // The other order, and the one a student reaches by accident: › is pressed,
    // its refresh passes `drawIsHeld` and goes to the worker, and the button
    // goes down on the list before the answer comes back. `render` is the
    // second guard and a draw it declines must not consume the request.
    await onMonth();
    addButton().focus();
    const row = view().querySelector<HTMLElement>("a.row, div.row, .mpill[role='button']")!;
    click(fwd()!); // the refresh is away…
    press(row); // …and the button goes down before the worker answers
    await settle();
    expect(state.focusAfterDraw, "render declined the held draw").toEqual({
      kind: "date-nav",
      control: "forward",
    });
    release(row);
    await settle();
    expect(document.activeElement).toBe(fwd());
  });

  it("drops a request the strip it drew cannot satisfy", async () => {
    // Today has no arrows at all (`navFor` returns `step: 0`), so a request
    // left over from Month names nothing. Focus stays where the browser put
    // it rather than jumping somewhere invented.
    shell.selectTab("day");
    await settle();
    addButton().focus();
    state.focusAfterDraw = { kind: "date-nav", control: "forward" };
    await app.refresh();
    expect(nav().hidden, "no strip on the day view").toBe(true);
    expect(state.focusAfterDraw, "the draw consumed it either way").toBeUndefined();
    expect(document.activeElement).toBe(addButton());
  });
});

/* -------------------------------------------------------------------------- */
/* The Alerts tab's glyph (Sushi, 2026-09-19: "should be a ring bell icon")     */
/* -------------------------------------------------------------------------- */

describe("the Alerts tab draws a bell", () => {
  it("draws the bell, in both weights, and no crossed-out calendar", async () => {
    shell.selectTab("day");
    await settle();
    const tab = [...tabs().querySelectorAll<HTMLElement>("[role='tab']")].find(
      (candidate) => candidate.querySelector(".tab--label")?.textContent === VIEW_LABEL.nodate,
    )!;
    const material = tab.querySelector<SVGElement>(".icon-material")!;
    // A filled weight, like Month's and Exams', for when the tab is selected:
    // `design-classical.css` swaps the two groups on `aria-selected`.
    expect(material.querySelector(".icon-material-outline")).not.toBeNull();
    expect(material.querySelector(".icon-material-fill")).not.toBeNull();
    const ds = [...material.querySelectorAll("path")].map((path) => path.getAttribute("d") ?? "");
    // Upstream `notifications`: the bell's body starts at the strike-line under
    // the clapper. The calendar it replaced started at its crossed-out date.
    for (const d of ds) expect(d.startsWith("M192-216v-72h48")).toBe(true);
    // And the legacy 16px set, which the non-Classical designs draw.
    const legacy = tab.querySelector<SVGElement>(".icon-legacy")!.getAttribute("d") ?? "";
    expect(legacy).toContain("a3.5 3.5 0 0 0-3.5 3.5"); // the bell's shoulder
    expect(legacy).not.toContain("M3 4h10v9H3z"); // the calendar's box
  });
});

/* ==========================================================================
 * The floating "+" and the quick add panel (2026-09-19)
 *
 * Sushi: "the add should be in a hovering + on a tab in the day, week, and
 * month that doesnt take up the whole screen, it should just be a small popup
 * for date, time, name, course, and add/cancel."
 *
 * Everything about *where* the panel lands is a question about layout and was
 * measured in Chrome with held presses (lane-add.md); linkedom lays nothing
 * out, so what is pinned here is what a press, a redraw and a refusal do —
 * which is the half that no screenshot can answer.
 * ====================================================================== */

const fab = () => document.querySelector<HTMLElement>(".qfab")!;
const quick = () => document.querySelector<HTMLElement>(".editor--quick");
const fieldsOf = (form: HTMLElement) =>
  [...form.querySelectorAll<HTMLElement>(".editor--grid [data-field]")].map(
    (el) => el.dataset["field"],
  );

describe("the floating +", () => {
  it("opens a panel of exactly the five things it was asked for", async () => {
    shell.selectTab("day");
    await settle();
    expect(fab()).not.toBeNull();
    click(fab());
    await settle();
    const form = quick()!;
    expect(form).not.toBeNull();
    // Date, time, name, course — and Add/Cancel. Not Kind, not the end time,
    // not the link, not "No date yet".
    expect(fieldsOf(form)).toEqual(["date", "time", "title", "courseRaw"]);
    expect(form.querySelector("[data-field='noDate']")).toBeNull();
    expect(
      [...form.querySelectorAll<HTMLElement>(".editor--actions button")].map((b) =>
        b.textContent?.trim(),
      ),
    ).toEqual(["Add", "Cancel"]);
    // On `<body>`, not in `#view`: the list is redrawn by eight things nobody
    // asked for, and every one of them calls `viewEl.replaceChildren()`.
    expect(form.parentElement).toBe(document.body);
    expect(view().contains(form)).toBe(false);
    expect(fab().getAttribute("aria-expanded")).toBe("true");
    // A second press on the same control closes it; one form at a time.
    click(fab());
    await settle();
    expect(quick()).toBeNull();
  });

  it("closes on Escape and puts focus back on the +", async () => {
    click(fab());
    await settle();
    keydown(quick()!.querySelector("[data-field='title']")!, "Escape");
    await settle();
    expect(quick()).toBeNull();
    expect(focused).toBe(fab());
    expect(fab().getAttribute("aria-expanded")).toBeNull();
  });

  it("closes on Cancel and puts focus back on the +", async () => {
    click(fab());
    await settle();
    click(quick()!.querySelector(".btn-quiet")!);
    await settle();
    expect(quick()).toBeNull();
    expect(focused).toBe(fab());
  });

  it("survives every redraw nobody asked for, with what was typed", async () => {
    click(fab());
    await settle();
    const title = quick()!.querySelector<HTMLInputElement>("[data-field='title']")!;
    title.value = "half typed";
    // The open-sync, a store write, the minute tick: all of them end in this.
    await app.refresh();
    await settle();
    expect(quick()).not.toBeNull();
    expect(
      quick()!.querySelector<HTMLInputElement>("[data-field='title']")!.value,
    ).toBe("half typed");
    // Deferred, never skipped — the list is owed a draw and gets it on close.
    expect(state.redrawAfterEditor).toBe(true);
    click(quick()!.querySelector(".btn-quiet")!);
    await settle();
    expect(state.redrawAfterEditor).toBe(false);
  });

  it("closes on a click outside, and leaves focus where that click put it", async () => {
    click(fab());
    await settle();
    // Armed one task later, deliberately: two of the callers open the panel
    // from a click that is still on its way to `document`.
    focused = null;
    document.body.dispatchEvent(new popup.Event("click", { bubbles: true }));
    await settle();
    expect(quick()).toBeNull();
    // Not the "+": the click has already put focus somewhere, and taking it
    // back is the steal the focus rule exists to prevent.
    expect(focused).toBeNull();
  });

  it("survives the click that opened it, when that click came from the list", async () => {
    /*
     * The week's empty day, the month's per-day "+", Today's quiet card and
     * Alerts' dashed card all open the panel from a `click` that is still on
     * its way to `document` — and a listener added to `document` *during* that
     * propagation is called by that very event. So the dismiss listener is
     * armed one task later, and this is the input that tells the two apart.
     */
    const opener = document.createElement("div");
    opener.addEventListener("click", () => app.openAddEditor());
    view().append(opener);
    opener.dispatchEvent(new popup.Event("click", { bubbles: true }));
    await settle();
    expect(quick()).not.toBeNull();
    opener.remove();
    click(quick()!.querySelector(".btn-quiet")!);
    await settle();
  });

  it("is gone on the tabs that have no list to add a day to", async () => {
    // Drawn once and shown by CSS off `body[data-view]`, so what a test can see
    // is the attribute the stylesheet keys on.
    for (const view of ["day", "week", "month"] as const) {
      shell.selectTab(view);
      await settle();
      expect(document.body.dataset["view"]).toBe(view);
    }
    shell.selectTab("nodate");
    await settle();
    expect(document.body.dataset["view"]).toBe("nodate");
    shell.selectTab("day");
    await settle();
  });
});

describe("the bar has no +, and the floating one is on every tab", () => {
  /*
   * Sushi, 2026-09-19: "theres no need to have a + at the top right to add cuz
   * theres already one at the bottom right." Two controls for one destination
   * is the `#ledger` strip's defect; the buried one is the one nobody presses,
   * and here the *bar's* was the buried one.
   */
  it("draws no add button in the header", async () => {
    shell.selectTab("day");
    await settle();
    const actions = document.getElementById("actions")!;
    const labels = [...actions.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));
    expect(labels).not.toContain("Add a deadline");
    // The three that stay: the full view, the ⋯ and the gear.
    expect(labels).toEqual(["Open full view", "More", "Settings"]);
  });

  it("shows the floating + on the tabs the bar's + used to serve", () => {
    /*
     * Drawn once on `<body>` and shown by CSS off `body[data-view]`, so what a
     * test without a layout engine can read is the rule. It used to name the
     * three calendar tabs; Alerts, Exams and Sources had only the bar's "+",
     * and removing that would have left them with no way to type a row at all.
     */
    const rules = rulesOf("popup-screens.css");
    const shown = rules.find(
      (rule) => rule.selector.trim() === ".qfab" && rule.decls["display"] === "inline-flex",
    );
    expect(shown, "`.qfab` is shown unconditionally").toBeTruthy();
    // …and still hidden over a sub-screen and on first run, which is the whole
    // of what may hide it.
    const hidden = rules.filter((rule) => /\.qfab/.test(rule.selector) && rule.decls["display"] === "none");
    expect(hidden.length).toBe(1);
    expect(hidden[0]!.selector).toContain("[data-screen]");
    expect(hidden[0]!.selector).toContain(".setup");
    // No rule keys the "+" on a particular tab any more.
    expect(rules.filter((rule) => /data-view.*\.qfab/.test(rule.selector))).toEqual([]);
  });

  it("has no Settings entry in the header ⋯, because the gear is beside it", async () => {
    // "theres alr a settings button so theres no need for one in the 3 dots."
    const more = document.querySelector<HTMLElement>('#actions button[aria-label="More"]')!;
    click(more);
    await settle();
    const menu = document.querySelector<HTMLElement>(`.${MENU_CLASS}`)!;
    const labels = [...menu.querySelectorAll(".menu-item")].map((e) => e.textContent);
    expect(labels).not.toContain("Settings");
    // The two that name Settings *sections* stay: neither is reachable from
    // the gear without scrolling a 4000px page.
    expect(labels).toContain("Google Calendar…");
    expect(labels).toContain("Appearance…");
    shell.closeMenus();
  });
});

describe("a refusal in the quick panel", () => {
  it("shows a sentence about a field it does not draw at the foot of the form", async () => {
    const { createEditor } = await import("../src/ui/editor.js");
    // §4 of `core/manual.ts`'s wording, routed by `ERROR_FIELD` to `endTime` —
    // a field this shape has no slot for. The failure to avoid is a refusal
    // with nowhere to go, not one in the wrong place.
    const handle = createEditor({
      compact: true,
      heading: "Add",
      submitLabel: "Add",
      courses: [],
      values: { date: "2026-09-22" },
      onSave: () => Promise.reject(new Error("Give the end time as HH:MM.")),
      onCancel: () => undefined,
    });
    document.body.append(handle.el);
    handle.el.dispatchEvent(new popup.Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    const shown = [...handle.el.querySelectorAll<HTMLElement>(".editor--error")].filter(
      (slot) => !slot.hidden,
    );
    expect(shown.length).toBe(1);
    expect(shown[0]!.textContent).toBe("Give the end time as HH:MM.");
    expect(shown[0]!.classList.contains("editor--error-form")).toBe(true);
    handle.el.remove();
  });
});

/* -------------------------------------------------------------------------- */
/* The month, in the popup                                                     */
/* -------------------------------------------------------------------------- */

/** The `course-N` on an element, or `"none"` when it carries no hue at all. */
const hueOf = (el: Element): string =>
  [...el.classList].find((name) => name.startsWith("course-")) ?? "none";
/** Every hue the dot grid actually paints. `.mdot-more` draws no colour. */
const gridHues = () =>
  new Set([...view().querySelectorAll(".mdots .mday--dots .mdot")].map(hueOf));
/** Every hue the key underneath explains. */
const legendHues = () => new Set([...view().querySelectorAll(".mlegend--item")].map(hueOf));

const showMonth = async (): Promise<void> => {
  state.view = "month";
  state.dayOffset = 0;
  await app.refresh();
  await settle();
};

describe("the month's key accounts for every hue the grid draws", () => {
  /*
   * The defect, in the shape Sushi met it: August 2026 drew a blue dot on the
   * 31st, three brown on Sep 1, a purple on Sep 2 and a brown on Sep 3, and the
   * key underneath read "CS 425" — because `renderLegend` skipped
   * `cell.outside` while `renderDotCell` does not.
   *
   * The out-of-month day is read off the rendered grid rather than computed
   * from a date, because *which* trailing days a month has depends on the
   * weekday its last day falls on — a month ending on a Saturday has none. The
   * assertion is then about a day the grid demonstrably drew.
   */
  let outsideDay: string;

  it("draws trailing days of the next month, and they can carry work", async () => {
    await showMonth();
    const out = [...view().querySelectorAll<HTMLElement>(".mdots .mday--out")];
    expect(out.length, "the grid is rectangular, so a month has neighbour days").toBeGreaterThan(0);
    // An empty one where the dataset offers one, so the dot asserted below is
    // demonstrably the one this test added.
    outsideDay = (out.find((c) => c.querySelector(".mday--dots") === null) ?? out.at(-1)!)
      .dataset["day"]!;
    const [y, m, d] = outsideDay.split("-").map(Number) as [number, number, number];
    // A course with no other deadline anywhere, so its hue exists on screen in
    // exactly one place: an out-of-month cell. `ECE 999` is deliberately not a
    // course in the reference dataset (parser house rule 10: a realistic value
    // here would let the old implementation pass).
    items.push({
      id: "lane-month-outside",
      courseLabel: "ECE 999",
      courseCode: "ECE 999",
      title: "Outside-the-month checkpoint",
      kind: "assignment",
      status: "not_submitted",
      url: "https://illinois.edu/",
      members: [
        {
          source: "manual",
          sourceId: "lane-month-outside",
          courseRaw: "ECE 999",
          courseCode: "ECE 999",
          title: "Outside-the-month checkpoint",
          kind: "assignment",
          status: "not_submitted",
          dueAt: new Date(y, m - 1, d, 17, 0).toISOString(),
          url: "https://illinois.edu/",
          fetchedAt: new Date(now).toISOString(),
        },
      ],
      dueAt: new Date(y, m - 1, d, 17, 0).toISOString(),
      hidden: false,
      done: false,
      notified: {},
    });
    await showMonth();
    const cell = view().querySelector<HTMLElement>(`.mday[data-day="${outsideDay}"]`)!;
    expect(cell.classList.contains("mday--out")).toBe(true);
    const mine = [...view().querySelectorAll(".mlegend--item")].find(
      (entry) => entry.textContent === "ECE 999",
    )!;
    expect(mine, "the key names it").toBeDefined();
    expect([...cell.querySelectorAll(".mday--dots .mdot")].map(hueOf)).toContain(hueOf(mine));
  });

  it("names the course whose only dot is on a day outside the month", () => {
    const names = [...view().querySelectorAll(".mlegend--item")].map((e) => e.textContent);
    expect(names).toContain("ECE 999");
  });

  /*
   * The invariant `renderLegend` states, as a test: the set of hues drawn in
   * the grid and the set of hues in the key are the same set. Both directions —
   * a colour with nothing to explain it is the defect above, and a key entry
   * with no dot on screen would be the opposite lie.
   */
  it("holds the invariant: grid hues === legend hues", () => {
    expect([...legendHues()].sort()).toEqual([...gridHues()].sort());
  });

  it("holds it on a month whose neighbours are empty too", async () => {
    // Far enough out that nothing in the dataset falls anywhere on the grid.
    state.view = "month";
    state.dayOffset = 400;
    await app.refresh();
    await settle();
    expect(gridHues().size).toBe(0);
    expect(legendHues().size).toBe(0);
    state.dayOffset = 0;
  });
});

describe("\"Open full view\" is in the header bar, not the date navigator", () => {
  const fullButton = () =>
    [...document.getElementById("actions")!.querySelectorAll<HTMLElement>("button")].find(
      (b) => b.getAttribute("aria-label") === "Open full view",
    );

  it("is an icon button in the bar, with an accessible name and a title", () => {
    const button = fullButton();
    expect(button, "the bar carries it").toBeDefined();
    expect(button!.className).toBe("btn btn-icon");
    expect(button!.title).toBe("Open full view");
    expect(button!.querySelector("svg")).not.toBeNull();
  });

  it("is on every tab, not only Month", async () => {
    for (const name of ["day", "week", "month", "exams"] as const) {
      state.view = name;
      await app.refresh();
      await settle();
      expect(fullButton(), `${name} carries it`).toBeDefined();
      expect(
        document.getElementById("nav")!.querySelector(".mfull"),
        `${name}'s navigator does not`,
      ).toBeNull();
    }
    state.view = "month";
    await app.refresh();
    await settle();
  });

  it("asks the worker to open the full view, on the tab being looked at", async () => {
    sent.length = 0;
    click(fullButton()!);
    await settle();
    expect(sent.map((request) => request.type)).toContain("open-full-view");
  });

  it("is not duplicated in the ⋯ menu", async () => {
    const more = [...document.getElementById("actions")!.querySelectorAll<HTMLElement>("button")]
      .find((b) => b.getAttribute("aria-label") === "More")!;
    click(more);
    await settle();
    const labels = [...document.querySelectorAll(".menu-surface .menu-item")].map(
      (entry) => entry.textContent,
    );
    expect(labels.length, "the menu opened").toBeGreaterThan(0);
    expect(labels).not.toContain("Open full view");
    shell.closeMenus();
  });
});

/* -------------------------------------------------------------------------- */
/* Today: the three bands, and the marker on the rail                          */
/* -------------------------------------------------------------------------- */

const showDay = async (): Promise<void> => {
  shell.selectTab("day");
  state.dayOffset = 0;
  await app.refresh();
  await settle();
};
/*
 * Two deadlines on today's rail, for the length of one test.
 *
 * The reference set is a *week* of realistic rows and today's share of it has
 * no stated hour, so the rail is not drawn at all — which would make both tests
 * below vacuous rather than failing (parser house rule 10's case: a fixture
 * that defeats itself looks exactly like a gap). One an hour before `now` and
 * one an hour after: the past one is overdue and is drawn under Late, so it is
 * the future one that puts the rail on screen, with the marker at its top.
 * That only holds while now+1h is before 23:00, which is why the clock above
 * is pinned.
 *
 * Spliced into the array the worker stub answers with and taken out again,
 * because every other test in this file reads the same set.
 */
const withTimedToday = async (body: () => Promise<void>): Promise<void> => {
  const clone = (at: number, id: string): Item => {
    const base = items.find((one) => one.members.length === 1)!;
    const member = { ...base.members[0]!, sourceId: id, dueAt: new Date(at).toISOString() };
    delete (member as { extra?: unknown }).extra;
    return { ...base, id, dueAt: member.dueAt, members: [member] };
  };
  const added = [clone(now - 60 * 60 * 1000, "rail-past"), clone(now + 60 * 60 * 1000, "rail-next")];
  items.push(...added);
  try {
    await showDay();
    await body();
  } finally {
    for (const one of added) items.splice(items.indexOf(one), 1);
    await showDay();
  }
};

/** Every band heading on the tab, as `[label, count]`. */
const bands = (): [string, string | undefined][] =>
  [...view().querySelectorAll<HTMLElement>(".tsection > .section-head")].map((head) => [
    head.firstElementChild!.textContent!.trim(),
    head.children.length > 1 ? head.lastElementChild!.textContent!.trim() : undefined,
  ]);

describe("the rail is a band, and it says so", () => {
  /*
   * Sushi, 2026-09-19: "it should say 'timeline' as a header above the
   * timeline, like 'by end of day' is." "Like" is the load-bearing word — the
   * heading has to be the same object as its siblings, not a third spelling of
   * one, so this asserts on the shared `.tsection > .section-head` shape rather
   * than on a selector only the rail could match.
   */
  it("carries a heading and a count of the rows on it, like its siblings", async () => {
    await withTimedToday(async () => {
    const rail = view().querySelector<HTMLElement>(".timeline")!;
    expect(rail).not.toBeNull();
    // The rail is *inside* a band, which is what gives it the band's gutter and
    // puts its heading on the same left edge as the cards above it.
    const band = rail.closest(".tsection");
    expect(band).not.toBeNull();
    expect(band!.firstElementChild!.classList.contains("section-head")).toBe(true);

    const labels = bands().map(([label]) => label);
    expect(labels).toContain("Timeline");
    // Last of the three: `todaySchedule` orders them Late, end of day, timed.
    expect(labels[labels.length - 1]).toBe("Timeline");

    // The count is the rows on the rail. The "now" marker and the collapsed-gap
    // segments are drawn between rows and are not rows, so a day with three
    // deadlines and a marker between two of them still says "3 items".
    const rows = rail.querySelectorAll(".tline").length;
    expect(rows).toBeGreaterThan(0);
    expect(rail.querySelectorAll(".tnow").length).toBeGreaterThan(0);
    expect(bands().find(([label]) => label === "Timeline")![1]).toBe(
      `${rows} item${rows === 1 ? "" : "s"}`,
    );
    });
  });
});

describe("\"now\" is a time in the clock column, not a filled pill", () => {
  /*
   * Sushi, 2026-09-19: "id rather have the time for now appear on the left side
   * in orange text instead of being filled in an orange bubble."
   *
   * The assertion that matters is *where in the DOM* it is: the marker's time
   * has to be inside the line's own `.tclock` — the same grid cell the row
   * clocks use — because that is what makes it share their left edge and their
   * type without a number being repeated in a stylesheet. An offset that
   * happened to line up would pass a screenshot and fail the next time the
   * column's width changed.
   */
  it("prints the hour inside the marker's own clock cell", async () => {
    await withTimedToday(async () => {
    const marker = view().querySelector<HTMLElement>(".tnow")!;
    expect(marker).not.toBeNull();
    const clockCell = marker.querySelector<HTMLElement>(".tclock")!;
    const stamp = marker.querySelector<HTMLElement>(".tnow--clock")!;
    expect(stamp).not.toBeNull();
    expect(stamp.parentElement).toBe(clockCell);
    // The same cell, in the same position, as a row's clock: first child of the
    // line, before the rail.
    expect(marker.firstElementChild).toBe(clockCell);
    expect(marker.children[1]!.classList.contains("trail")).toBe(true);

    // A bare time, formatted by the one formatter the rows use — and one that
    // says nothing about "now", which is why the line below has to.
    const rowClock = view().querySelector<HTMLElement>(".tline .tclock")!;
    expect(stamp.textContent).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/);
    expect(rowClock.textContent).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/);

    // The pill is gone, and nothing builds one any more.
    expect(view().querySelector(".tnow--label")).toBeNull();

    // A screen reader is never left with a bare time it cannot tell from a
    // deadline: the line carries the sentence, and the stamp is hidden from it
    // so the time is not announced twice.
    expect(marker.getAttribute("role")).toBe("separator");
    expect(marker.getAttribute("aria-label")).toMatch(/^Now, \d{1,2}:\d{2}\s?(AM|PM)$/);
    expect(marker.getAttribute("aria-label")).toBe(`Now, ${stamp.textContent}`);
    expect(stamp.getAttribute("aria-hidden")).toBe("true");
    });
  });
});

describe("editing a row opens the panel, not a screen", () => {
  /*
   * Sushi, 2026-09-19: "the edit is too large." It was `#view` replaced by a
   * full-height form while *adding* a row was a 336px panel over the list.
   *
   * What this pins is the pair: the panel's own class (which is what
   * `popup-screens.css` draws a floating box from) **and** the complete field
   * set — because the two used to be one flag, and the shape of the defect is
   * getting one without the other.
   */
  it("is the add panel, with the fields an edit needs", async () => {
    await showDay();
    const mine = items.find((item) =>
      item.members.length === 1 && item.members[0]!.source === "manual",
    );
    expect(mine, "the reference set has a row the student typed").toBeDefined();
    app.openEditEditor(mine!, mine!.members[0]!);
    await settle();

    const form = quick();
    expect(form, "the edit form is the floating panel").not.toBeNull();
    // Floating, over the list — not inside `#view`, which every draw empties.
    expect(form!.parentElement).toBe(document.body);
    expect(view().querySelector(".editor")).toBeNull();
    expect(state.screen?.kind).toBe(undefined);
    expect(form!.getAttribute("role")).toBe("dialog");

    // Every field the screen had. Kind and "No date yet" are the two an edit
    // cannot do without: an exam must not be silently saved as a deadline, and
    // the toggle is the only way to take a date off a row.
    expect(fieldsOf(form!)).toEqual([
      "title", "courseRaw", "kind", "date", "time", "noDate", "endTime", "url",
    ]);
    expect(form!.querySelector(".editor--more")).not.toBeNull();

    // ‹ back is gone and × stays: in a panel there is nothing to go back to,
    // and two dismissals a centimetre apart is one too many.
    expect(
      [...form!.querySelectorAll<HTMLElement>(".editor--head button")].map((b) =>
        b.getAttribute("aria-label"),
      ),
    ).toEqual(["Close this form"]);

    app.closeEditor();
    await settle();
  });
});

describe("a band does not make its rows repeat its heading", () => {
  /*
   * Sushi, 2026-09-19: "also end of day is being repeated twice, the header is
   * already end of day but the row says it again." And the same shape one band
   * down: the rail prints "3:00 PM" in its clock column and the card under it
   * printed "3:00 PM" again.
   *
   * `data-design="classical"` because that is the design with a clock slot at
   * all — `cardDesign()` reads the root attribute, and the other designs draw
   * the one-line row, which has never carried a `.row--due`. Set and put back,
   * since every other test here draws in the default.
   */
  const asCard = async (body: () => Promise<void>): Promise<void> => {
    const root = document.documentElement;
    const was = root.getAttribute("data-design");
    root.setAttribute("data-design", "classical");
    try {
      await body();
    } finally {
      if (was === null) root.removeAttribute("data-design");
      else root.setAttribute("data-design", was);
      await app.refresh();
      await settle();
    }
  };
  /** A row due today whose time the runner filled in — worker rule 3's mark. */
  const withAssumedToday = async (body: () => Promise<void>): Promise<void> => {
    const base = items.find((one) => one.members.length === 1)!;
    const at = new Date(now);
    at.setHours(23, 59, 0, 0);
    const member = {
      ...base.members[0]!,
      sourceId: "eod-row",
      dueAt: at.toISOString(),
      extra: { timeAssumed: "true" },
    };
    const added: Item = { ...base, id: "eod-row", dueAt: member.dueAt, members: [member] };
    items.push(added);
    try {
      await showDay();
      await body();
    } finally {
      items.splice(items.indexOf(added), 1);
      await showDay();
    }
  };

  it("drops \"end of day\" under the heading that says it, and keeps the marker", async () => {
    await asCard(async () => {
      await withAssumedToday(async () => {
        const band = [...view().querySelectorAll<HTMLElement>(".tsection")].find(
          (one) => one.firstElementChild!.textContent!.startsWith("By end of day"),
        );
        expect(band, "the day has an end-of-day band").toBeDefined();
        const card = band!.querySelector<HTMLElement>(".row")!;
        expect(card).not.toBeNull();

        // The heading said it; the card does not say it again. The clock slot
        // is not merely blank — it is not built, so it claims no line of its
        // own under the title.
        expect(card.textContent).not.toContain("end of day");
        expect(card.querySelector(".row--when")).toBeNull();

        // The marker stays, with the sentence that says who assumed the time.
        // That is a different fact from "by end of day" and no heading says it.
        const mark = card.querySelector<HTMLElement>(".row--meta .row--assumed")!;
        expect(mark, "the time-assumed marker survives").not.toBeNull();
        expect(mark.textContent).toBe("time assumed");
        expect(mark.title.length).toBeGreaterThan(0);
      });
    });
  });

  it("drops the card's clock under a rail that has just printed it", async () => {
    await asCard(async () => {
      await withTimedToday(async () => {
        const lines = [...view().querySelectorAll<HTMLElement>(".timeline .tline")];
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) {
          const clock = line.querySelector<HTMLElement>(".tclock")!.textContent!;
          expect(clock).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/);
          // The rail says it once, 45px to the left. The card must not.
          expect(line.querySelector(".row")!.textContent).not.toContain(clock);
          expect(line.querySelector(".row .row--when")).toBeNull();
        }
      });
    });
  });

  it("leaves the Late band's rows saying both their hour and how late they are", async () => {
    /*
     * The control for the two above. "Late" is not a time, so nothing on that
     * heading is repeated by the row — and "8:00 AM" and "3h late" are two
     * different facts, not one said twice. A suppression scoped to the tab
     * rather than to the band would take them both.
     */
    await asCard(async () => {
      await showDay();
      const band = view().querySelector<HTMLElement>(".tsection--late");
      expect(band, "the reference day has a late row").not.toBeNull();
      const card = band!.querySelector<HTMLElement>(".row")!;
      expect(card.querySelector(".row--when")).not.toBeNull();
      expect(card.querySelector<HTMLElement>(".row--due")!.textContent).toMatch(
        /^\d{1,2}:\d{2}\s?(AM|PM)$/,
      );
      expect(card.querySelector<HTMLElement>(".row--rel")!.textContent).toMatch(/late$/);
    });
  });
});

/**
 * Sushi, 2026-09-21: *"i think if its late it should show up in late no matter
 * what even if its 80%. i think 80% deadline shouldnt be yellow its confusing
 * to see that. i think it should appear in the late tab and it should say when
 * the 80% due date is."*
 *
 * `core/grouping.ts` and `core/calendar.ts` own every decision below; what is
 * asserted here is the one thing they cannot see — which of the two deadlines
 * the drawn row puts in its clock slot. Counted from the window it still has,
 * a row under **Late** reads "11:59 PM · in 5h", which is the reduced-credit
 * date wearing the clothes of the deadline beside the words saying it is gone.
 */
describe("a row past full credit with its 80% window still open", () => {
  /** Full credit went 26 hours ago; 80% runs until 11:59 tonight. */
  const withEightyPercent = async (body: (missedAt: Date) => Promise<void>): Promise<void> => {
    const base = items.find((one) => one.members.length === 1)!;
    const missedAt = new Date(now - 26 * 60 * 60 * 1000);
    missedAt.setMinutes(0, 0, 0);
    const until = new Date(now);
    until.setHours(23, 59, 0, 0);
    const member = {
      ...base.members[0]!,
      sourceId: "mp-80",
      dueAt: missedAt.toISOString(),
      lateDueAt: until.toISOString(),
      status: "not_submitted" as const,
      extra: {
        creditSchedule: JSON.stringify([
          { credit: 100, end: missedAt.toISOString() },
          { credit: 80, start: missedAt.toISOString(), end: until.toISOString() },
        ]),
      },
    };
    const added: Item = {
      ...base,
      id: "mp-80",
      title: "MP1 80% tail",
      status: "not_submitted",
      done: false,
      dueAt: member.dueAt,
      lateDueAt: member.lateDueAt,
      members: [member],
    };
    items.push(added);
    try {
      await showDay();
      await body(missedAt);
    } finally {
      items.splice(items.indexOf(added), 1);
      await showDay();
    }
  };

  it("draws it under Late, clocked to the deadline it missed", async () => {
    await withEightyPercent(async (missedAt) => {
      const band = view().querySelector<HTMLElement>(".tsection--late")!;
      expect(band, "the day has a Late band").not.toBeNull();
      const card = [...band.querySelectorAll<HTMLElement>(".row")].find(
        (row) => row.querySelector(".row--title")?.textContent === "MP1 80% tail",
      );
      expect(card, "the 80% row is in the Late band").toBeDefined();

      // The clock is the missed deadline's, not the window's 11:59 PM.
      const clock = missedAt.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      // The window's own hour, which the slot must *not* be showing.
      expect(clock).not.toBe("11:59 PM");
      expect(card!.querySelector<HTMLElement>(".row--due")!.textContent).toBe(clock);
      expect(card!.querySelector<HTMLElement>(".row--rel")!.textContent).toMatch(/late$/);

      // And no amber: `row-late` is the warn edge Sushi called yellow.
      expect(card!.classList.contains("row-late")).toBe(false);
      expect(card!.classList.contains("row-overdue")).toBe(true);
    });
  });

  it("says how late it is on the Alerts tab, which passes no status word", async () => {
    /*
     * The Today band hands the row `weekStatus`, so its right-hand column is
     * decided in core. The Alerts tab's Late section hands it nothing and the
     * row falls back to its own `countdown` — a second place the choice of
     * instant is made, and from the still-open window it reads "in 5h" under a
     * heading that says Late.
     */
    await withEightyPercent(async () => {
      shell.selectTab("nodate");
      await app.refresh();
      await settle();
      const card = [...view().querySelectorAll<HTMLElement>(".needsyou--item .row")].find(
        (row) => row.querySelector(".row--title")?.textContent === "MP1 80% tail",
      );
      expect(card, "the 80% row is in the Alerts tab's Late section").toBeDefined();
      expect(card!.querySelector<HTMLElement>(".row--rel")!.textContent).toMatch(/late$/);
      expect(card!.textContent).toContain("80% until");
    });
    shell.selectTab("day");
    await app.refresh();
    await settle();
  });

  it("says when the 80% deadline is, and is counted in the heading", async () => {
    await withEightyPercent(async () => {
      const band = view().querySelector<HTMLElement>(".tsection--late")!;
      const card = [...band.querySelectorAll<HTMLElement>(".row")].find(
        (row) => row.querySelector(".row--title")?.textContent === "MP1 80% tail",
      )!;
      expect(card.textContent).toContain("80% until");
      expect(card.textContent).not.toContain("late until");

      const count = Number(band.querySelector(".section-head")!.lastElementChild!.textContent!.replace(/\D/g, ""));
      expect(count).toBe(band.querySelectorAll(".row").length);
    });
  });
});

/* ========================================================================== */
/* The keyboard, 2026-09-27                                                    */
/* ========================================================================== */

/*
 * The a11y review of 2026-09-27 drove the real popup with CDP key events and
 * recorded `document.activeElement` after each one. Every test below replays
 * one of its sequences against the real entry, with keys rather than
 * `.click()` wherever the finding was about a key (UI rule 5). A `click` is
 * dispatched only where the browser's own default action for the key is a
 * click on a `<button>` — Enter on a focused button — and says so.
 */
const keyWith = (el: Element, key: string, init: { shiftKey?: boolean } = {}) => {
  const event = new popup.Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "key", { value: key });
  Object.defineProperty(event, "shiftKey", { value: init.shiftKey === true });
  el.dispatchEvent(event);
  return event;
};
const menuOpen = () => document.querySelector<HTMLElement>(`.${MENU_CLASS}`);
const entryNamed = (label: string) =>
  [...(menuOpen()?.querySelectorAll<HTMLElement>(".menu-item") ?? [])].find(
    (entry) => entry.textContent?.trim() === label,
  );
const announced = () => document.getElementById(shell.ANNOUNCE_ID)?.textContent ?? "";
const escape = async () => {
  keyWith(document.activeElement ?? document.body, "Escape");
  await settle();
};
const showWeek = async (): Promise<void> => {
  shell.selectTab("week");
  state.dayOffset = 0;
  await app.refresh();
  await settle();
};

describe("a row is a link and a ⋯ side by side (a11y #1, #12)", () => {
  /*
   * A typed deadline with no link, dated two hours from the pinned now so it
   * lands in this week's first day with a stated hour. Spliced into the
   * worker's answer and taken out again, like `withTimedToday`.
   */
  const FLAT = "Keyboard test row";
  const withFlatRow = async (body: () => Promise<void>): Promise<void> => {
    const base = items.find((one) => one.members.length === 1 && one.members[0]!.source === "manual")!;
    const dueAt = new Date(now + 2 * 60 * 60 * 1000).toISOString();
    const member = { ...base.members[0]!, sourceId: "flat-row", title: FLAT, dueAt };
    delete (member as { url?: string }).url;
    delete (member as { extra?: unknown }).extra;
    const flat: Item = { ...base, id: "flat-row", title: FLAT, dueAt, members: [member] };
    delete (flat as { url?: string }).url;
    items.push(flat);
    try {
      await showWeek();
      await body();
    } finally {
      items.splice(items.indexOf(flat), 1);
      state.screen = undefined;
      await app.refresh();
      await settle();
    }
  };

  it("draws every card as a div whose title is the stop, with the ⋯ beside it", async () => {
    await showWeek();
    const cards = [...view().querySelectorAll<HTMLElement>(".row")];
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.tagName).toBe("DIV");
      const stop = stopOf(card)!;
      expect(stop, "every card has one stop").toBeDefined();
      expect(stop.classList.contains("row--title")).toBe(true);
      const menu = card.querySelector(".row--menu")!;
      // A sibling of the link, never inside it: HTML forbids interactive
      // content in an `<a>`, and the nested button's name was being folded
      // into every row's ("… More actions").
      expect(stop.contains(menu)).toBe(false);
      expect(menu.getAttribute("aria-haspopup")).toBe("menu");
      const name = stop.getAttribute("aria-label")!;
      expect(name.startsWith(stop.textContent!)).toBe(true);
      expect(name).not.toContain("More actions");
    }
    // A row with a URL is still a real link, so it can be middle-clicked,
    // copied and announced as one.
    expect(view().querySelector("a.row--link[href]")).not.toBeNull();
  });

  it("opens a typed row with no link from the keyboard: Enter, Space and `.`", async () => {
    await withFlatRow(async () => {
      const card = rowOf(FLAT)!;
      expect(card, "the flat row was drawn").toBeDefined();
      const stop = stopOf(card)!;
      expect(stop.tagName).toBe("SPAN");
      expect(stop.getAttribute("role")).toBe("button");
      stop.focus();

      keyWith(stop, ".");
      expect(menuOpen(), "`.` opens the row's menu").not.toBeNull();
      await escape();
      expect(menuOpen()).toBeNull();

      // Read through a function: TypeScript narrows `state.screen` to
      // `undefined` after the assignment below and cannot see the keydown set it.
      const screenKind = (): string | undefined => state.screen?.kind;
      keyWith(stop, "Enter");
      expect(screenKind()).toBe("deadline");
      state.screen = undefined;
      await app.refresh();
      await settle();

      const again = stopOf(rowOf(FLAT))!;
      keyWith(again, " ");
      expect(screenKind(), "Space opens a role=button too").toBe("deadline");
    });
  });
});

describe("a menu hands focus back when it closes itself (a11y #3, #5)", () => {
  afterEach(async () => {
    if (menuOpen()) shell.closeMenus();
    state.actionError = undefined;
    answer = () => ({ type: "ok" });
    await app.refresh();
    await settle();
  });

  it("returns Escape to the row's stop, not the tabIndex −1 ⋯, and ↓ still walks", async () => {
    await showWeek();
    const stops = [...view().querySelectorAll<HTMLElement>(".row--link")];
    const first = stops[0]!;
    const title = first.textContent!;
    first.focus();
    keyWith(first, ".");
    expect(menuOpen()).not.toBeNull();
    expect(menuOpen()!.contains(document.activeElement)).toBe(true);
    await escape();
    const back = stopOf(rowOf(title))!;
    expect(document.activeElement).toBe(back);
    expect(back.getAttribute("tabindex")).toBe("0");
    keyWith(back, "ArrowDown");
    expect(document.activeElement).not.toBe(back);
    expect((document.activeElement as HTMLElement).classList.contains("row--link")).toBe(true);
  });

  it("rolls the ring onto a row whose ⋯ the pointer opened, so Tab comes back to it", async () => {
    // The order the keyboard test above cannot reach (mutation rule 5): there
    // the student arrowed to the row first, which had already rolled it. A
    // pointer press on the third row's ⋯ rolls nothing, so the hand-back has
    // to, or the next Shift+Tab into the list lands on the first row instead.
    await showWeek();
    const cards = [...view().querySelectorAll<HTMLElement>(".row")];
    const card = cards[2]!;
    const title = stopOf(card)!.textContent!;
    expect(stopOf(card)!.getAttribute("tabindex")).toBe("-1");
    click(card.querySelector(".row--menu")!);
    expect(menuOpen()).not.toBeNull();
    await escape();
    const back = stopOf(rowOf(title))!;
    expect(document.activeElement).toBe(back);
    expect(back.getAttribute("tabindex")).toBe("0");
    const tabbable = [...view().querySelectorAll(".row--link")].filter(
      (stop) => stop.getAttribute("tabindex") === "0",
    );
    expect(tabbable).toEqual([back]);
  });

  it("puts focus on the header ⋯ after an entry that closes the menu itself", async () => {
    await showWeek();
    const more = document.querySelector<HTMLElement>('#actions button[aria-label="More"]')!;
    more.focus();
    click(more);
    expect(menuOpen()).not.toBeNull();
    // Enter on a focused menu entry is a click (the browser's default action).
    click(entryNamed("Google Calendar…")!);
    expect(menuOpen()).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it("returns a refused correction to the row it was made on", async () => {
    await showWeek();
    const first = view().querySelector<HTMLElement>(".row--link")!;
    const title = first.textContent!;
    first.focus();
    keyWith(first, ".");
    answer = () => ({ type: "error", message: REFUSAL });
    click(entryNamed("Mark done")!);
    await settle();
    expect(state.actionError).toBe(REFUSAL);
    expect(menuOpen()).toBeNull();
    expect(document.activeElement).toBe(stopOf(rowOf(title)));
  });
});

describe("Tab inside a menu walks the menu (a11y #4, diff review #4)", () => {
  afterEach(async () => {
    if (menuOpen()) shell.closeMenus();
    await app.refresh();
    await settle();
  });

  const openMenu = async () => {
    await showWeek();
    const first = view().querySelector<HTMLElement>(".row--link")!;
    first.focus();
    keyWith(first, ".");
    return menuOpen()!;
  };

  it("moves Tab to the next entry and Shift+Tab from the first to the last, menu still open", async () => {
    const menu = await openMenu();
    const entries = [...menu.querySelectorAll<HTMLElement>(".menu-item")];
    expect(document.activeElement).toBe(entries[0]);
    const tab = keyWith(entries[0]!, "Tab");
    expect(tab.defaultPrevented, "the browser's own Tab would leave the document").toBe(true);
    expect(document.activeElement).toBe(entries[1]);
    keyWith(entries[1]!, "Tab", { shiftKey: true });
    expect(document.activeElement).toBe(entries[0]);
    keyWith(entries[0]!, "Tab", { shiftKey: true });
    expect(document.activeElement).toBe(entries[entries.length - 1]);
    expect(menuOpen()).toBe(menu);
  });

  it("keeps a typed name when Tab leaves the rename box for Save", async () => {
    const menu = await openMenu();
    click(entryNamed("Rename…")!);
    const input = menu.querySelector<HTMLInputElement>(".menu-input")!;
    expect(document.activeElement).toBe(input);
    input.value = "My own name";
    keyWith(input, "Tab");
    expect(document.activeElement?.textContent?.trim()).toBe("Save");
    expect(menuOpen()).toBe(menu);
    expect(input.value).toBe("My own name");
    keyWith(document.activeElement!, "Tab", { shiftKey: true });
    expect(document.activeElement).toBe(input);
  });

  it("reaches Save with ↓ and the last entry with ↑, and leaves ← → to the caret", async () => {
    const menu = await openMenu();
    click(entryNamed("Rename…")!);
    const input = menu.querySelector<HTMLInputElement>(".menu-input")!;
    const left = keyWith(input, "ArrowLeft");
    expect(left.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input);
    keyWith(input, "ArrowDown");
    expect(document.activeElement?.textContent?.trim()).toBe("Save");
    input.focus();
    keyWith(input, "ArrowUp");
    const entries = [...menu.querySelectorAll<HTMLElement>(".menu-item")];
    expect(document.activeElement).toBe(entries[entries.length - 1]);
  });

  it("names the row menu after its row", async () => {
    const menu = await openMenu();
    expect(menu.getAttribute("aria-label")).toMatch(/^Actions for /);
  });
});

describe("the Courses menu keeps focus on the course just toggled (a11y #10)", () => {
  it("rebuilds the list and focuses the same entry, not the first", async () => {
    await showWeek();
    const more = document.querySelector<HTMLElement>('#actions button[aria-label="More"]')!;
    click(more);
    click(entryNamed("Courses…")!);
    const entries = () => [...menuOpen()!.querySelectorAll<HTMLElement>(".menu-item")];
    expect(entries().length, "the reference set has at least three courses").toBeGreaterThanOrEqual(3);
    const name = entries()[2]!.textContent;
    click(entries()[2]!); // Enter on the focused entry
    expect(document.activeElement).toBe(entries()[2]);
    expect(document.activeElement?.textContent).toBe(name);
    expect(entries()[2]!.getAttribute("aria-checked")).toBe("false");
    click(entries()[2]!); // and back on
    expect(entries()[2]!.getAttribute("aria-checked")).toBe("true");
    shell.closeMenus();
    await app.refresh();
    await settle();
  });
});

describe("focus survives the redraw of a control outside the ring (a11y #2)", () => {
  const sync = () => document.querySelector<HTMLElement>(".foot--sync")!;

  it("keeps Sync now focused through the sync it starts", async () => {
    await showWeek();
    const before = sync();
    before.focus();
    click(before); // Enter on a focused button
    // The footer was rebuilt the instant the sync began.
    expect(sync()).not.toBe(before);
    expect(document.activeElement).toBe(sync());
    expect(sync().getAttribute("aria-disabled")).toBe("true");
    expect(sync().getAttribute("aria-busy")).toBe("true");
    expect(announced()).toBe("Syncing…");
    await settle(80);
    expect(document.activeElement).toBe(sync());
    expect(sync().getAttribute("aria-disabled")).toBeNull();
    expect(announced()).toMatch(/^Sync finished: /);
  });

  it("keeps a banner's button focused across a redraw nobody asked for", async () => {
    state.pendingUndo = { title: "Lab 9", values: {} as never, until: Date.now() + 10_000 };
    await app.refresh();
    const undo = () =>
      [...document.querySelectorAll<HTMLElement>("#banners button")].find(
        (button) => button.textContent === "Undo",
      )!;
    const stale = undo();
    stale.focus();
    await app.refresh();
    expect(undo()).not.toBe(stale);
    expect(document.activeElement).toBe(undo());
    expect(announced()).toContain("Lab 9");
    state.pendingUndo = undefined;
    await app.refresh();
  });
});

describe("a refusal is said once, and shown whole (a11y #6, popup-live #2)", () => {
  it("writes the refusal to the live region once, however many draws re-show it", async () => {
    answer = () => ({ type: "error", message: REFUSAL });
    const control = document.createElement("button");
    document.body.append(control);
    shell.applyOverrideAction({ kind: "hide", itemId: "reference-late" }, control);
    await settle();
    expect(announced()).toBe(REFUSAL);
    // Blank it, then draw twice: a live region rewritten by each draw would
    // read the refusal out every minute.
    document.getElementById(shell.ANNOUNCE_ID)!.textContent = "";
    await app.refresh();
    await app.refresh();
    expect(status().textContent).toContain(REFUSAL);
    expect(announced()).toBe("");
    state.actionError = undefined;
    answer = () => ({ type: "ok" });
    control.remove();
    await app.refresh();
  });

  it("wraps a notice in #status instead of clipping it to one line", () => {
    const rule = rulesOf("popup.css").find((r) => r.selector === "#status .banner-line--text");
    expect(rule?.decls["white-space"]).toBe("normal");
    expect(rule?.decls["overflow"]).toBe("visible");
    // And the stale banners stay one line: nothing here widens `.banner-line--text` itself.
    expect(rulesOf("popup.css").some((r) => r.selector === ".banner-line--text")).toBe(false);
  });
});

describe("the month grid is one stop with arrow keys (a11y #7)", () => {
  it("rolls one tabbable day, names each day, and moves with the arrows", async () => {
    await showMonth();
    const cells = () => [...view().querySelectorAll<HTMLElement>(".mday")];
    expect(cells().length).toBeGreaterThanOrEqual(28);
    const tabbable = cells().filter((cell) => cell.getAttribute("tabindex") === "0");
    expect(tabbable.length).toBe(1);
    expect(tabbable[0]!.classList.contains("mday--on")).toBe(true);
    for (const cell of cells()) expect(cell.getAttribute("aria-label")).toMatch(/— (nothing due|\d+ due)$/);

    const start = tabbable[0]!;
    start.focus();
    keyWith(start, "ArrowRight");
    const index = cells().indexOf(start);
    expect(document.activeElement).toBe(cells()[index + 1]);
    expect(cells()[index + 1]!.getAttribute("tabindex")).toBe("0");
    expect(start.getAttribute("tabindex")).toBe("-1");
    keyWith(document.activeElement!, "ArrowUp");
    expect(document.activeElement).toBe(cells()[index + 1 - 7] ?? cells()[index + 1]);
    keyWith(document.activeElement!, "End");
    const inMonth = cells().filter((cell) => !cell.classList.contains("mday--out"));
    expect(document.activeElement).toBe(inMonth[inMonth.length - 1]);
    keyWith(document.activeElement!, "Home");
    expect(document.activeElement).toBe(inMonth[0]);
    await showWeek();
  });
});

describe("the add panel is a named, modal dialog that keeps Tab (a11y #8)", () => {
  it("is labelled by its heading and wraps Tab at both ends", async () => {
    shell.selectTab("day");
    await settle();
    click(fab());
    await settle();
    const form = quick()!;
    const id = form.getAttribute("aria-labelledby")!;
    expect(id).toBeTruthy();
    expect(document.getElementById(id)?.textContent).toBe("Add");
    expect(form.getAttribute("aria-modal")).toBe("true");
    const stops = [...form.querySelectorAll<HTMLElement>("input, select, textarea, button")].filter(
      (el) => el.getAttribute("tabindex") !== "-1" && !el.closest("[hidden]") && !(el as HTMLButtonElement).disabled,
    );
    const first = stops[0]!;
    const last = stops[stops.length - 1]!;
    last.focus();
    keyWith(last, "Tab");
    expect(document.activeElement).toBe(first);
    keyWith(first, "Tab", { shiftKey: true });
    expect(document.activeElement).toBe(last);
    app.closeEditor();
    await settle();
  });

  it("names the tab an undated row goes to by the tab's own label (copy #6)", async () => {
    await showDay();
    const mine = items.find((item) => item.members.length === 1 && item.members[0]!.source === "manual")!;
    app.openEditEditor(mine, mine.members[0]!);
    await settle();
    const note = quick()!.querySelector(".editor--nodate-text")!.textContent!;
    expect(note).toContain(`the ${VIEW_LABEL.nodate} tab`);
    expect(note).not.toContain("No date tab");
    app.closeEditor();
    await settle();
  });
});

describe("the tab strip and the document order (a11y #11, #13)", () => {
  it("answers Home and End, and names the panel it controls", async () => {
    await showWeek();
    const selected = () => tabs().querySelector<HTMLElement>("[role='tab'][aria-selected='true']")!;
    selected().focus();
    keyWith(selected(), "End");
    await settle();
    expect(state.view).toBe(VIEWS[VIEWS.length - 1]);
    expect(document.activeElement).toBe(selected());
    keyWith(selected(), "Home");
    await settle();
    expect(state.view).toBe(VIEWS[0]);
    for (const tab of tabs().querySelectorAll("[role='tab']")) {
      expect(tab.getAttribute("aria-controls")).toBe("view");
    }
    expect(view().getAttribute("role")).toBe("tabpanel");
    expect(view().getAttribute("aria-labelledby")).toBe(selected().id);
    await showWeek();
  });

  it("puts the footer under the header and the tab strip last, as they are drawn", () => {
    const html = readFileSync(new URL("../public/popup.html", import.meta.url), "utf8").replace(
      /<!--[\s\S]*?-->/g,
      "",
    );
    const at = (needle: string) => {
      const index = html.indexOf(needle);
      expect(index, needle).toBeGreaterThan(-1);
      return index;
    };
    expect(at("</header>")).toBeLessThan(at('id="footer"'));
    expect(at('id="footer"')).toBeLessThan(at('id="banners"'));
    expect(at('id="nav"')).toBeLessThan(at('id="view"'));
    expect(at('id="view"')).toBeLessThan(at('id="tabs"'));
    // Nothing focusable after the strip: the live region, then the script.
    expect(at('id="tabs"')).toBeLessThan(at('id="announce"'));
    expect(at('id="announce"')).toBeLessThan(at("<script"));
  });
});

describe("a source with nothing to read offers Turn off (item 6)", () => {
  afterEach(() => {
    answer = () => ({ type: "ok" });
    state.actionError = undefined;
  });

  it("says what it does, says so while it runs, and asks the worker to switch it off", async () => {
    const button = shell.actionButton({ kind: "off", source: "prairielearn" })!;
    document.body.append(button);
    expect(button.textContent).toBe("Turn off");
    expect(button.title).toBe("Stop reading PrairieLearn. You can switch it back on in Settings.");
    const before = sent.length;
    click(button);
    expect(button.textContent).toBe("Turning off…");
    expect(button.disabled).toBe(true);
    await settle();
    expect(sent.slice(before)).toContainEqual({
      type: "set-source-enabled",
      source: "prairielearn",
      enabled: false,
    });
    button.remove();
  });

  it("puts the button back and shows the refusal when the worker says no", async () => {
    answer = () => ({ type: "error", message: "no" });
    const button = shell.actionButton({ kind: "off", source: "prairielearn" })!;
    document.body.append(button);
    // `set-source-enabled` is answered by the stub's default branch; route it
    // through `answer` for this one test.
    const real = (globalThis as unknown as { chrome: { runtime: { sendMessage: (r: { type: string }) => Promise<unknown> } } }).chrome.runtime;
    const was = real.sendMessage;
    real.sendMessage = async (request) =>
      request.type === "set-source-enabled" ? answer() : was(request);
    click(button);
    await settle();
    real.sendMessage = was;
    expect(button.textContent).toBe("Turn off");
    expect(button.disabled).toBe(false);
    expect(status().textContent).toContain("no");
    button.remove();
    await app.refresh();
  });
});

describe("row and footer tooltips speak the student's language (copy #10, #18)", () => {
  it("names the modifier key this machine has", async () => {
    const { modifierKeyName } = await import("../src/ui/popup/rows.js");
    expect(modifierKeyName("MacIntel")).toBe("⌘");
    expect(modifierKeyName("iPad")).toBe("⌘");
    expect(modifierKeyName("Win32")).toBe("Ctrl");
    expect(modifierKeyName("Linux x86_64")).toBe("Ctrl");
    // Anything unrecognised, including no answer at all, is not a Mac.
    expect(modifierKeyName("")).toBe("Ctrl");
  });

  it("says Gradescope, not the storage key, in an unreadable date's tooltip", async () => {
    const { renderRow } = await import("../src/ui/popup/rows.js");
    const base = items.find((one) => one.members.length === 1)!;
    const member = { ...base.members[0]!, source: "gradescope" as const, extra: { unparsedDueDate: "Sept 31" } };
    delete (member as { dueAt?: string }).dueAt;
    const item: Item = { ...base, members: [member] };
    delete (item as { dueAt?: string }).dueAt;
    delete (item as { lateDueAt?: string }).lateDueAt;
    const row = renderRow(item, new Date(now), undefined);
    const detail = row.querySelector<HTMLElement>(".row--detail-error")!;
    expect(detail.title).toBe("Gradescope due date: Sept 31");
  });

  it("keeps a site's own answer in the footer's hover, and drops a parser's", () => {
    const failing = {
      ...sources,
      prairielearn: {
        source: "prairielearn",
        enabled: true,
        state: "parse_error",
        consecutiveFailures: 1,
        lastAttemptAt: new Date(now).toISOString(),
        lastError: "prairielearn: no course instances on the student home page",
      },
      gradescope: {
        source: "gradescope",
        enabled: true,
        state: "network_error",
        consecutiveFailures: 1,
        lastAttemptAt: new Date(now).toISOString(),
        lastError: "Failed to fetch",
      },
    } as Record<Source, SourceStatus>;
    shell.renderFooter(failing, new Date(now));
    const hover = document.querySelector<HTMLElement>(`.${shell.FOOT_HEALTH_CLASS}`)!.title;
    expect(hover).toContain("PrairieLearn");
    expect(hover).not.toContain("no course instances");
    expect(hover).toContain("Failed to fetch");
    shell.renderFooter(sources, new Date(now));
  });
});

/* ========================================================================== */
/* Wiring from the 2026-09-27 wave                                             */
/* ========================================================================== */

describe("a Week card on the day a late window closes (popup-live #5)", () => {
  /*
   * `week.ts` hands the row `weekCardStatus`, and only this harness draws the
   * week: swapping it for `weekStatus` survived every other test (F2's
   * mutation). Full credit went yesterday at 5 PM; the late window runs to 5 PM
   * six days out, which is the last day of the rolling week.
   */
  it("says the window, not how late the row already is", async () => {
    const base = items.find((one) => one.members.length === 1)!;
    const missed = new Date(now);
    missed.setDate(missed.getDate() - 1);
    missed.setHours(17, 0, 0, 0);
    const until = new Date(now);
    until.setDate(until.getDate() + 6);
    until.setHours(17, 0, 0, 0);
    const member = {
      ...base.members[0]!,
      sourceId: "week-window",
      kind: "assignment" as const,
      dueAt: missed.toISOString(),
      lateDueAt: until.toISOString(),
      status: "not_submitted" as const,
    };
    delete (member as { extra?: unknown }).extra;
    const added: Item = {
      ...base,
      id: "week-window",
      title: "HW window row",
      kind: "assignment",
      status: "not_submitted",
      done: false,
      hidden: false,
      dueAt: member.dueAt,
      lateDueAt: member.lateDueAt,
      members: [member],
    };
    items.push(added);
    try {
      await showWeek();
      const row = rowOf("HW window row");
      expect(row, "the row is on the week").toBeDefined();
      expect(row!.closest(".wrow"), "on a day card").not.toBeNull();
      expect(row!.querySelector<HTMLElement>(".row--rel")!.textContent).toMatch(/^late until /);
    } finally {
      items.splice(items.indexOf(added), 1);
      await showWeek();
    }
  });
});

describe("a post's unstated hour on the Alerts tab (copy-audit #11)", () => {
  /*
   * `alerts.ts` reads `suggestion.timeAssumed` into `suggestionDueText`; wiring
   * `false` there survived every other test (F2's mutation), because only this
   * harness draws the tab.
   */
  it("says end of day, never the 11:59 PM the observer filled in", async () => {
    const day = new Date(now);
    day.setDate(day.getDate() + 3);
    const pad = (n: number) => String(n).padStart(2, "0");
    const key = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    const stamp = new Date(now).toISOString();
    suggestions.push({
      id: "sug-eod",
      kind: "new",
      title: "Project proposal",
      courseRaw: "CS 425",
      courseCode: "CS425",
      at: `${key}T23:59`,
      timeAssumed: true,
      span: "Friday",
      context: "The proposal is due Friday.",
      source: "piazza",
      postId: "sug-eod-post",
      postedAt: stamp,
      createdAt: stamp,
    });
    try {
      shell.selectTab("nodate");
      await app.refresh();
      await settle();
      const due = view().querySelector<HTMLElement>(".sug-row .row--due");
      expect(due, "the suggestion is drawn").not.toBeNull();
      expect(due!.textContent).toMatch(/· end of day$/);
      expect(due!.textContent).not.toContain("11:59");
    } finally {
      suggestions.splice(0);
      await showWeek();
    }
  });
});

describe("the full view's month lands on today once (popup-live #3)", () => {
  /*
   * The pure half of `renderMonthView`'s landing: the harness draws the popup,
   * never the full view (`isFullView` is read off the root at import), so the
   * decision is pinned here and the draw only measures and hands it over.
   */
  it("centres a today below the fold, and never moves a redraw", async () => {
    const { todayLanding } = await import("../src/ui/popup/views/month.js");
    const cell = { top: 720, height: 128 };
    // First draw, today in week five of a 700px window: centred.
    expect(todayLanding("2026-9", undefined, cell, 0, 700)).toBe(720 - (700 - 128) / 2);
    // The same month drawn again — a store write, the minute tick — stays put.
    expect(todayLanding("2026-9", "2026-9", cell, 0, 700)).toBeUndefined();
    // Stepping to another month is a first draw of that month.
    expect(todayLanding("2026-9", "2026-10", cell, 0, 700)).toBe(434);
    // Already inside the window the draw will land on: left alone. The edge
    // itself is inside; one pixel past it is not.
    expect(todayLanding("2026-9", undefined, { top: 572, height: 128 }, 0, 700)).toBeUndefined();
    expect(todayLanding("2026-9", undefined, { top: 573, height: 128 }, 0, 700)).toBe(287);
    // Judged against where the draw lands, not where the window is mid-draw:
    // above a landing of 1200 is out of view, and inside one of 400 is not.
    expect(todayLanding("2026-9", undefined, cell, 1200, 700)).toBe(434);
    expect(todayLanding("2026-9", undefined, cell, 400, 700)).toBeUndefined();
    // No today in the grid: nothing to land on.
    expect(todayLanding("2026-10", "2026-9", undefined, 0, 700)).toBeUndefined();
  });
});

describe("the Sources tab's hover agrees with the footer's (copy #18)", () => {
  it("drops a parser's own message and keeps what the site answered", async () => {
    const { SOURCE_TITLE } = await import("../src/core/names.js");
    const was = { prairielearn: sources.prairielearn, gradescope: sources.gradescope };
    const at = new Date(now).toISOString();
    sources.prairielearn = {
      source: "prairielearn",
      enabled: true,
      state: "parse_error",
      consecutiveFailures: 1,
      lastAttemptAt: at,
      lastSuccessAt: at,
      lastError: "prairielearn: no course instances on the student home page",
    };
    sources.gradescope = {
      source: "gradescope",
      enabled: true,
      state: "network_error",
      consecutiveFailures: 1,
      lastAttemptAt: at,
      lastSuccessAt: at,
      lastError: "Failed to fetch",
    };
    try {
      shell.selectTab("sources");
      await app.refresh();
      await settle();
      const detailOf = (source: Source) =>
        [...view().querySelectorAll<HTMLElement>(".needsyou--source")]
          .find((line) => line.querySelector(".needsyou--source-name")?.textContent === SOURCE_TITLE[source])
          ?.querySelector<HTMLElement>(".needsyou--source-detail");
      expect(detailOf("prairielearn"), "PrairieLearn has a row").toBeDefined();
      expect(detailOf("prairielearn")!.title).toContain("last read");
      expect(detailOf("prairielearn")!.title).not.toContain("no course instances");
      expect(detailOf("gradescope")!.title).toContain("Failed to fetch");
    } finally {
      sources.prairielearn = was.prairielearn;
      sources.gradescope = was.gradescope;
      await showWeek();
    }
  });
});

describe("an unbooked exam's name drops PrairieTest's prefix for a screen reader too", () => {
  it("strips \"Book a slot:\" from the stop's accessible name", async () => {
    const base = items.find((one) => one.members.length === 1)!;
    const member = { ...base.members[0]!, sourceId: "book-q9", source: "prairietest" as const, kind: "booking" as const, title: "Book a slot: CS 357: Quiz 9" };
    delete (member as { dueAt?: string }).dueAt;
    delete (member as { extra?: unknown }).extra;
    const added: Item = {
      ...base,
      id: "book-q9",
      title: "Book a slot: CS 357: Quiz 9",
      kind: "booking",
      hidden: false,
      members: [member],
    };
    delete (added as { dueAt?: string }).dueAt;
    delete (added as { lateDueAt?: string }).lateDueAt;
    items.push(added);
    try {
      shell.selectTab("exams");
      await app.refresh();
      await settle();
      const title = [...view().querySelectorAll<HTMLElement>(".row--title")].find(
        (one) => one.textContent === "CS 357: Quiz 9",
      );
      expect(title, "the booking is on the board, prefix gone").toBeDefined();
      const name = title!.getAttribute("aria-label") ?? "";
      expect(name.startsWith("CS 357: Quiz 9")).toBe(true);
      expect(name).not.toContain("Book a slot");
    } finally {
      items.splice(items.indexOf(added), 1);
      await showWeek();
    }
  });
});

describe("the footer's sync button and count (popup-live #11, copy-audit #16)", () => {
  afterEach(() => {
    state.workerSyncing = false;
    shell.renderFooter(sources, new Date(now));
  });

  it("says Syncing… for a sync the worker started, not only for a press", () => {
    const label = () => document.querySelector<HTMLElement>(".foot--sync-label")!.textContent;
    state.workerSyncing = true;
    shell.renderFooter(sources, new Date(now));
    expect(label()).toBe("Syncing…");
    state.workerSyncing = false;
    shell.renderFooter(sources, new Date(now));
    expect(label()).toBe("Sync now");
  });

  it("says sites, in prose, when none is switched on", () => {
    // Every source in this harness is off.
    shell.renderFooter(sources, new Date(now));
    expect(document.querySelector<HTMLElement>(".foot--count")!.textContent).toBe("No sites on");
  });
});

describe("the stale banner says what is known, and signs in to the open tab", () => {
  /*
   * Copy-audit #5: "signed out 13h" named a moment this extension does not
   * know; the words are core's `staleBannerText` now. And I60: "Sign in" brings
   * forward the tab already showing the login page rather than opening a
   * second — `chrome.tabs` is stubbed with one such tab, so a press that still
   * went to `create` fails here.
   */
  it("reads 'last read 13h' and focuses the existing tab", async () => {
    const chromeStub = (globalThis as unknown as { chrome: Record<string, unknown> }).chrome;
    const was = { gradescope: sources.gradescope, tabs: chromeStub["tabs"], windows: chromeStub["windows"] };
    const status: SourceStatus = {
      source: "gradescope",
      enabled: true,
      state: "needs_login",
      consecutiveFailures: 1,
      lastAttemptAt: new Date(now).toISOString(),
      lastSuccessAt: new Date(now - 13 * 3_600_000 - 5 * 60_000).toISOString(),
    };
    sources.gradescope = status;
    const login = shell.signInUrl("gradescope", status, "needs_login");
    expect(login, "Gradescope has a sign-in page").toBeDefined();
    const focusedTabs: number[] = [];
    const created: string[] = [];
    chromeStub["tabs"] = {
      query: async () => [{ id: 41, url: login, windowId: 3 }],
      update: async (id: number) => {
        focusedTabs.push(id);
        return {};
      },
      create: async ({ url }: { url: string }) => {
        created.push(url);
        return {};
      },
    };
    chromeStub["windows"] = {
      getLastFocused: async () => ({ id: 3 }),
      update: async () => ({}),
    };
    try {
      await showWeek();
      const banner = document.querySelector<HTMLElement>("#banners .banner--stale");
      expect(banner, "the stale banner is drawn").not.toBeNull();
      expect(banner!.textContent).toContain("Gradescope: ");
      expect(banner!.textContent).toContain("· last read 13h");
      expect(banner!.textContent).not.toContain("signed out");
      const signIn = [...banner!.querySelectorAll("button")].find((b) => b.textContent === "Sign in");
      expect(signIn, "a Sign in button").toBeDefined();
      click(signIn!);
      await settle();
      expect(focusedTabs).toEqual([41]);
      expect(created).toEqual([]);
    } finally {
      sources.gradescope = was.gradescope;
      chromeStub["tabs"] = was.tabs;
      chromeStub["windows"] = was.windows;
      await showWeek();
    }
  });
});

describe("the .ics file names a course the way the popup does (copy-audit #3)", () => {
  it("carries the student's rename into the calendar file", async () => {
    const { downloadIcs } = await import("../src/ui/download.js");
    const blobs: Blob[] = [];
    const url = URL as unknown as {
      createObjectURL: (blob: Blob) => string;
      revokeObjectURL: (href: string) => void;
    };
    const was = { create: url.createObjectURL, revoke: url.revokeObjectURL };
    url.createObjectURL = (blob) => {
      blobs.push(blob);
      return "blob:ics";
    };
    url.revokeObjectURL = () => undefined;
    try {
      const one = items.find((item) => !item.hidden && item.dueAt !== undefined && item.courseLabel !== "")!;
      expect(downloadIcs([one], { [one.courseLabel]: "Renamed For The Test" })).toBe(1);
      expect(blobs.length).toBe(1);
      expect(await blobs[0]!.text()).toContain("Renamed For The Test");
    } finally {
      url.createObjectURL = was.create;
      url.revokeObjectURL = was.revoke;
    }
  });
});

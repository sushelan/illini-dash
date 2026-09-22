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
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/core/store.js";
import type { Item, Source, SourceStatus } from "../src/sources/types.js";
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
            suggestions: [],
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

const { MENU_CLASS, VIEW_LABEL, app, state } = await import("../src/ui/popup/state.js");

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
    expect(document.activeElement).toBe(row);
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
    const stale = rows[1] ?? rows[0]!;
    const title = stale.querySelector(".row--title")!.textContent!;
    stale.focus();
    await app.refresh();
    const fresh = rowOf(title)!;
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
 * that defeats itself looks exactly like a gap). Two hours apart and either
 * side of `now`, so the marker lands between them rather than at an end.
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

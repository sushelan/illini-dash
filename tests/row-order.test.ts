/**
 * Where each part of a row *is*, rather than whether it fits.
 *
 * The defect this file exists for (Sushi, 2026-09-19: "why is the name of the
 * assignment on the needs you page to the right, like mp3 is on the right
 * side"): `renderSuggestions` built its row as `row row--flat row--suggestion`,
 * and `design-classical.css` gives every `#view .row` a three-column card grid
 * with the areas `main tick menu` / `when when menu`. The suggestion's children
 * carried none of `.row--main`, `.row--when`, `.row--tick` or `.row--menu`, so
 * they auto-placed in source order: the chip took the flexible 224px column and
 * the **title landed in the 34px `auto` column** beside it.
 *
 * Every existing check passed. `preview-acceptance` asserts overflow and
 * clipping, the theme tests assert contrast, `popup-draw` asserts focus and
 * reachability — and none of them asserts that a part of a row is *where it
 * belongs*. That is the gap, and it is checkable with no browser at all:
 * linkedom lays nothing out, so `getBoundingClientRect` is worthless here, but
 * **document order and containment** are exactly what broke. A part in the
 * wrong parent is a part in the wrong column.
 *
 * Two halves:
 *
 *   1. Per row type — the suggestion row, the calendar row, the No date card
 *      and the exam card — the reading order and the nesting each one promises.
 *   2. The rule that generalises it, read out of the stylesheet rather than
 *      restated here: **no child of a `#view .row` may name no grid area.**
 *      `design-classical.css` is parsed for its `grid-template-areas`, the
 *      sheets are parsed for what they place into those areas, and every
 *      rendered row's children are checked against that. Had this existed, the
 *      suggestion row would have failed the day it was written.
 *
 * The harness is `popup-draw.test.ts`'s — the real entry (`src/ui/popup.ts`)
 * booted whole with `chrome` stubbed — with two differences: the root carries
 * `data-design="classical"`, because the grid under test is that design's, and
 * `get-state` answers with a suggestion so the Needs-you screen has a row.
 */
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/core/store.js";
import type { Item, Source, SourceStatus, Suggestion } from "../src/sources/types.js";
import { referenceItems } from "../scripts/preview-reference.js";

const popup = parseHTML(
  // `data-design="classical"` on the root: `rows.ts` and `views/exams.ts` both
  // ask `documentElement.dataset.design`, and the card grid this file is about
  // exists only under that design.
  "<!doctype html><html data-design='classical'><body><header class='bar'><div id='health'></div>" +
    "<div class='bar--right' id='actions'></div></header><div id='banners'></div>" +
    "<div id='status' hidden></div><nav id='tabs' class='tabs' role='tablist'></nav>" +
    "<div id='filters' class='filters'></div><div id='nav' class='datenav'></div>" +
    "<main id='view'></main><footer id='footer' class='foot'></footer>" +
    "</body></html>",
);
const document = popup.document as unknown as Document;

/* ---- focus, tracked (linkedom moves none) ------------------------------- */
let focused: Element | null = null;
(popup.HTMLElement as { prototype: { focus: (o?: unknown) => void } }).prototype.focus =
  function (this: Element) {
    focused = this;
  };
Object.defineProperty(popup.document, "activeElement", {
  get: () => focused ?? popup.document.body,
  configurable: true,
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

/**
 * One suggestion, with a `postSubject` that differs from the title.
 *
 * Both halves on purpose: a subject equal to the title makes `renderSuggestions`
 * take the *other* provenance branch, and this row has to exercise the one that
 * builds the longer sentence — the sentence whose wrapping is why `.sug-actions`
 * comes first in source order.
 */
const SUGGESTIONS: Suggestion[] = [
  {
    id: "sug-1",
    kind: "new",
    title: "MP 3: Trees",
    courseRaw: "CS225",
    courseCode: "CS225",
    at: new Date(now + 3 * 86_400_000).toISOString(),
    timeAssumed: false,
    span: "due Friday at 11:59pm",
    context: "MP3 is due Friday at 11:59pm, no extensions.",
    source: "piazza",
    // A real Piazza id, so the provenance is the link it is on a live install
    // (`postUrl`). `"p1"` matched nothing and left the row on the branch a
    // student never sees.
    postId: "piazza:k5p6s9m2d1x:412",
    postSubject: "MP3 deadline",
    postedAt: new Date(now).toISOString(),
    createdAt: new Date(now).toISOString(),
  },
];

/** Every URL a control asked Chrome to open, newest last. */
const opened: string[] = [];

const globals = globalThis as unknown as Record<string, unknown>;
globals["document"] = popup.document;
globals["window"] = popup.window;
globals["HTMLElement"] = popup.HTMLElement;
globals["Element"] = popup.Element;
globals["Node"] = popup.Node;
globals["HTMLAnchorElement"] = popup.HTMLAnchorElement;
globals["HTMLButtonElement"] = popup.HTMLButtonElement;
globals["location"] = { search: "" };
globals["localStorage"] = {
  getItem: (key: string) => (key === "illini-dash.view" ? "day" : null),
  setItem: () => undefined,
  removeItem: () => undefined,
};
globals["setInterval"] = () => 0;
globals["chrome"] = {
  runtime: {
    sendMessage: async (request: { type: string }) => {
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
            suggestions: SUGGESTIONS,
            observers: { piazza: { enabled: false }, campuswire: { enabled: false } },
            lastSyncAt: new Date(now).toISOString(),
          };
        default:
          return { type: "ok" };
      }
    },
    getURL: (path: string) => path,
  },
  tabs: {
    create: (options: { url: string }) => {
      opened.push(options.url);
    },
  },
};

// Dynamic, with the rest: a static import of anything under `src/ui/popup/`
// pulls in `applyStoredTheme`, which touches `document` at module scope —
// before the stubs below exist.
const { ATTENTION_NOTE } = await import("../src/ui/popup/views/alerts.js");
const { app } = await import("../src/ui/popup/state.js");
const shell = await import("../src/ui/popup/shell.js");
await import("../src/ui/popup.js");

const settle = (ms = 25) => new Promise((resolve) => setTimeout(resolve, ms));
const view = () => document.getElementById("view")!;
const rows = () => [...view().querySelectorAll<HTMLElement>("a.row, div.row")];

/** The children of `el`, in document order, as `tag.class.class`. */
const shape = (el: Element): string[] =>
  [...el.children].map(
    (child) => `${child.tagName.toLowerCase()}${[...child.classList].map((c) => `.${c}`).join("")}`,
  );

/** Where `needle` sits among `haystack`'s element children; -1 if elsewhere. */
const indexIn = (haystack: Element, needle: Element | null): number =>
  needle === null ? -1 : [...haystack.children].indexOf(needle);

beforeAll(async () => {
  // The entry's own open-sync and first draw.
  await settle(80);
});

/* ========================================================================== */
/* 1. Each row type, part by part                                             */
/* ========================================================================== */

describe("a suggestion row (Alerts › Found in a post)", () => {
  let row: HTMLElement;

  beforeAll(async () => {
    shell.selectTab("nodate");
    await settle();
    // The list's first child, *not* `.sug-row` — a selector naming the class
    // under test turns "the row is a card again" into a null dereference three
    // tests over instead of the assertion below.
    row = view().querySelector<HTMLElement>(".sug-list")!.firstElementChild as HTMLElement;
  });

  it("is not a calendar card, and is not inside one", () => {
    // The defect in one line. `.row` is a promise about a three-column grid
    // (`design-classical.css`), and this row makes none of the four placements
    // that promise requires — so it must not claim the class.
    expect(row, "a suggestion was rendered").toBeTruthy();
    expect(row.classList.contains("sug-row")).toBe(true);
    expect(row.classList.contains("row")).toBe(false);
    expect(row.closest(".row")).toBeNull();
    expect(shape(row)).toEqual(["div.sug-head", "div.sug-line"]);
  });

  it("puts the course chip before the title, both on line one", () => {
    const head = row.querySelector(".sug-head")!;
    const chip = head.querySelector(".chip");
    const title = head.querySelector(".sug-title");
    // Containment: Sushi's report was the title in the wrong *column*, which
    // under linkedom is the title in the wrong *parent*.
    expect(chip?.parentElement).toBe(head);
    expect(title?.parentElement).toBe(head);
    // Order: "it should be right next to course number" — chip, then title.
    expect(indexIn(head, chip)).toBe(0);
    expect(indexIn(head, title)).toBe(1);
    expect(title?.textContent).toBe("MP 3: Trees");
  });

  it("puts the two answers before the facts on line two, because they float", () => {
    const line = row.querySelector(".sug-line")!;
    const actions = line.querySelector(".sug-actions");
    const facts = line.querySelector(".sug-facts");
    expect(actions?.parentElement).toBe(line);
    expect(facts?.parentElement).toBe(line);
    // `.sug-actions { float: right }` (design-classical-shell.css): a float
    // only shortens the lines *after* it in source order, so this ordering is
    // what lets a wrapped provenance reclaim the row's full width underneath.
    // Swap the two and the sentence loses the buttons' width on every line.
    expect(indexIn(line, actions)).toBeLessThan(indexIn(line, facts));
  });

  it("keeps Add and Ignore in the actions, and the date and provenance in the facts", () => {
    const actions = row.querySelector(".sug-actions")!;
    expect([...actions.querySelectorAll("button")].map((b) => b.textContent)).toEqual([
      "Add",
      "Ignore",
    ]);
    const facts = row.querySelector(".sug-facts")!;
    // The provenance is a **button** when the post can be addressed, which it
    // can be for every Piazza and Campuswire suggestion a live sync produces
    // (2026-09-19). Still one child in the same slot with the same class.
    expect(shape(facts)).toEqual(["span.row--due", "span.row--sep", "button.link.needsyou--from"]);
    expect(facts.querySelector(".needsyou--from")?.textContent).toContain("MP3 deadline");
    // Nothing that belongs to line two may be drawn on line one, and nothing
    // from line one on line two.
    expect(row.querySelector(".sug-head .sug-actions")).toBeNull();
    expect(row.querySelector(".sug-line .sug-title")).toBeNull();
  });

  /*
   * Sushi, 2026-09-19: "if it says from a piazza or campuswire post, i should
   * be able to get linked to the post in reference."
   *
   * The sentence names a thread the student cannot otherwise reach, and the
   * id the observer recorded is enough to address it. A press has to reach
   * `chrome.tabs.create` with the post's own page — not the class, not the
   * site — because a link that lands one level up is a link that makes them
   * search for the post by hand.
   */
  it("opens the post the suggestion was read out of", () => {
    const link = row.querySelector<HTMLElement>(".needsyou--from")!;
    expect(link.tagName.toLowerCase()).toBe("button");
    // The evidence is still on it, and it says what pressing does.
    expect(link.getAttribute("title")).toContain("due Friday at 11:59pm");
    expect(link.getAttribute("title")).toContain("Opens the post");
    const before = opened.length;
    link.dispatchEvent(new popup.Event("click", { bubbles: true }));
    expect(opened.slice(before)).toEqual(["https://piazza.com/class/k5p6s9m2d1x/post/412"]);
  });
});

describe("a calendar row (renderRow)", () => {
  let row: HTMLElement;

  beforeAll(async () => {
    shell.selectTab("day");
    await settle();
    row = rows()[0]!;
  });

  it("keeps the title and the meta line inside .row--main", () => {
    const main = row.querySelector(".row--main");
    expect(main?.parentElement).toBe(row);
    expect(row.querySelector(".row--title")?.parentElement).toBe(main);
    expect(row.querySelector(".row--meta")?.parentElement).toBe(main);
    // The title first: `.row--meta { order: 0 }` puts the code line above it in
    // paint, and that reordering is the sheet's to make, not the markup's.
    expect(indexIn(main!, row.querySelector(".row--title"))).toBe(0);
    expect(indexIn(main!, row.querySelector(".row--meta"))).toBe(1);
  });

  it("keeps the relative and the clock inside .row--when", () => {
    const when = row.querySelector(".row--when");
    expect(when?.parentElement).toBe(row);
    expect(row.querySelector(".row--rel")?.parentElement).toBe(when);
    expect(row.querySelector(".row--due")?.parentElement).toBe(when);
    expect(indexIn(when!, row.querySelector(".row--rel"))).toBeLessThan(
      indexIn(when!, row.querySelector(".row--due")),
    );
  });

  it("hangs the ⋯ off the row itself, not off a column", () => {
    /*
     * It is placed by `grid-area: menu`, so it has to be a direct child: a grid
     * places its own children and nothing deeper.
     *
     * This asserted a `.row--tick` beside it until 2026-09-19. Sushi, on the
     * running extension: "why do you have 3 dots, a checkbox and an arrow, pick
     * one bro. just pick the 3 dots." `rows.ts` stopped building the checkbox
     * and the Month's rows stopped building the `›`, so the assertion pinned a
     * control that no longer exists — and a test that pins a removed control
     * fails for the one reason that is not a defect.
     */
    const menu = row.querySelector(".row--menu");
    expect(menu, "the Classical card draws its ⋯").not.toBeNull();
    expect(menu!.parentElement).toBe(row);
  });
});

describe("a No Date card", () => {
  let card: HTMLElement;

  beforeAll(async () => {
    shell.selectTab("nodate");
    await settle();
    card = view().querySelector<HTMLElement>(".nodate-card")!;
  });

  it("draws the row, then the three things that can be done to it", () => {
    const order = shape(card);
    const row = order.findIndex((name) => /^a\.row|^div\.row/.test(name));
    const actions = order.indexOf("div.nodate-actions");
    expect(row).toBeGreaterThanOrEqual(0);
    expect(actions).toBeGreaterThan(row);
    // The actions are the card's own line, under the row — not inside it, where
    // they would be three unplaced children of the card grid.
    expect(card.querySelector(".nodate-actions")!.parentElement).toBe(card);
    expect(card.querySelector(".row .nodate-actions")).toBeNull();
  });

  it("offers Give it a date, Tick off and Hide, in that order", () => {
    const actions = card.querySelector(".nodate-actions")!;
    expect(shape(actions).length).toBe(3);
    expect([...actions.querySelectorAll("button")].map((b) => b.textContent)).toEqual([
      "Give it a date",
      "Tick off",
      "Hide",
    ]);
  });

  /*
   * One trailing control, which is e60f4c4's rule ("why do you have 3 dots, a
   * checkbox and an arrow, pick one bro. just pick the 3 dots") applied to the
   * one card that kept a second one: an 18px `nodate-glyph` at `top: 8px;
   * right: 8px`, 18px above the ⋯ and looking exactly like a button.
   *
   * Counted in the DOM, because that is what linkedom can see. `.row--tick` is
   * the third candidate and it *is* in the markup — `rows.ts` builds it for
   * every row — so the assertion below would be wrong to ignore it silently;
   * the sheet is read for the rule that hides it instead, which is the same
   * `rulesOf` the bottom half of this file uses.
   */
  it("carries exactly one trailing control, and it is the ⋯", () => {
    const corner = [...card.querySelectorAll(".nodate-glyph, .row--menu, .row--tick")];
    const hidden = rulesOf("design-classical-nodate.css").some(
      (rule) =>
        /\.nodate-card\b/.test(rule.selector) &&
        targetClasses(rule.selector).includes("row--tick") &&
        rule.decls["display"] === "none",
    );
    expect(hidden, "the sheet hides .row--tick on this card").toBe(true);
    const visible = corner.filter((el) => !el.classList.contains("row--tick"));
    expect(visible.map((el) => el.className.split(" ").at(-1))).toEqual(["btn-sm"]);
    expect(visible.length, "one trailing control on a No date card").toBe(1);
    expect(visible[0]!.classList.contains("row--menu")).toBe(true);
    expect(card.querySelector(".nodate-glyph"), "no second corner glyph").toBeNull();
  });

  /*
   * The note over the first group, saying each thing once.
   *
   * It rendered as "Listed by a source with no deadline on it anywhere. A
   * source listed these but gave no date anywhere. They are kept out of …" —
   * the same sentence twice, four lines deep, above the first card (Sushi's
   * capture of the real tab, 2026-09-19).
   *
   * "The same sentence" is not computable, so the proxy is the fact both
   * sentences stated: a source gave no date. It may be said once. The proxy is
   * named here rather than hidden in a regex, because a later note that says it
   * twice in words this pattern misses would pass — what this pins is the
   * defect that happened, and it fails on it.
   */
  it("says each thing once in the group note", () => {
    const note = view().querySelector(".nodate-group--note")!.textContent!;
    const sentences = note.split(/(?<=\.)\s+/).filter(Boolean);
    const undated = sentences.filter((line) => /no (deadline|date)\b/i.test(line));
    expect(undated.length, `one sentence says it, not ${undated.length}: ${undated.join(" | ")}`).toBe(1);
    // And the record is still the thing being shown: `ATTENTION_NOTE` is what
    // the row tooltip uses, and the note opens with it.
    expect(note.startsWith(ATTENTION_NOTE["No date at all"])).toBe(true);
    expect(new Set(sentences).size, "no sentence is repeated verbatim either").toBe(
      sentences.length,
    );
  });
});

describe("an exam card", () => {
  let booking: HTMLElement;

  beforeAll(async () => {
    shell.selectTab("exams");
    await settle();
    booking = view().querySelector<HTMLElement>(".row-booking")!;
  });

  it("keeps the source pill on the meta line and the glyph lines on the row", () => {
    // `decorateExamRow` turns `.row--sources` into the mock's pill *in place*:
    // it stays where `renderRow` put it, inside `.row--main`'s meta line. A
    // pill lifted to the row would be a fifth unplaced child of the grid.
    const pill = booking.querySelector(".row--sources.exam-src")!;
    expect(pill.closest(".row--meta")).not.toBeNull();
    expect(pill.closest(".row--main")).not.toBeNull();

    // The glyph-led lines are the row's own, and they span it (`grid-column:
    // 1 / -1` in design-classical-exams.css).
    const lines = [...booking.querySelectorAll(".exam-line")];
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line.parentElement).toBe(booking);
  });

  it("puts Reserve a seat last, under everything it is about", () => {
    const reserve = booking.querySelector(".exam-reserve");
    expect(reserve, "an unbooked sitting with a URL offers the button").not.toBeNull();
    expect(reserve!.parentElement).toBe(booking);
    expect(indexIn(booking, reserve)).toBe(booking.children.length - 1);
    // And after every `.exam-line`, so the button does not sit between the room
    // and the booking window.
    const lastLine = [...booking.querySelectorAll(".exam-line")].pop()!;
    expect(indexIn(booking, lastLine)).toBeLessThan(indexIn(booking, reserve));
  });
});

/* ========================================================================== */
/* 2. The rule, stated once and read out of the stylesheet                    */
/* ========================================================================== */

interface Rule {
  selector: string;
  decls: Record<string, string>;
}

/** Every `selector { … }` in a sheet, comments stripped. */
function rulesOf(path: string): Rule[] {
  const css = readFileSync(new URL(`../public/${path}`, import.meta.url), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const out: Rule[] = [];
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
}

/**
 * The class tokens of every right-most compound the rule targets.
 *
 * Every comma-separated selector, not just the first: `#view .row--detail,
 * #view .row--detail-moved, #view .row--detail-error { grid-column: 1 / -1 }`
 * is one rule placing three classes, and reading only the head of it credited
 * `.row--detail` while calling its two siblings unplaced.
 */
function targetClasses(selector: string): string[] {
  return selector.split(",").flatMap((part) => {
    const last = part.trim().split(/[\s>+~]+/).pop() ?? "";
    return [...last.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1]!);
  });
}

/**
 * The sheets that place a child of a row.
 *
 * `popup-rows.css` is in the list because two of the row's own children are
 * placed there (`.row--detail*` spans the card), and a rule the test cannot see
 * is a rule the test would report as a defect.
 */
const SHEETS = [
  "design-classical.css",
  "design-classical-exams.css",
  "design-classical-week.css",
  "design-classical-nodate.css",
  "design-classical-month.css",
  "design-classical-today.css",
  "design-classical-shell.css",
  "popup-rows.css",
];

/** The area names in one `grid-template-areas` value. */
const areasIn = (value: string): string[] =>
  [...value.matchAll(/"([^"]*)"/g)]
    .flatMap((m) => m[1]!.trim().split(/\s+/))
    .filter((name) => name !== "" && name !== ".");

describe("every child of the Classical card grid names an area", () => {
  /** The areas `design-classical.css` gives `#view .row`. */
  const grid = rulesOf("design-classical.css").find(
    (rule) => rule.decls["grid-template-areas"] !== undefined && /#view \.row$/.test(rule.selector),
  );

  /**
   * Every area any Classical sheet declares, not only the base card's.
   *
   * A row inside the Month's day list redeclares the grid with a fourth column
   * — `"main tick menu chev"` — and `.row--chev` is placed into it. Reading
   * only `design-classical.css` reported that properly placed child as a
   * defect, which is the check indicting itself: the rule is "a child names an
   * area", and the areas are wherever the sheets declare them.
   */
  const areas = new Set(
    SHEETS.flatMap((sheet) =>
      rulesOf(sheet).flatMap((rule) => areasIn(rule.decls["grid-template-areas"] ?? "")),
    ),
  );

  /**
   * Classes the sheets place into that grid: by `grid-area: <one of the areas>`,
   * or by spanning the row outright with **`grid-column: 1 / -1`** and nothing
   * looser.
   *
   * Any `grid-column` would be the hole this whole file exists to close, in the
   * same shape: `grid-column: 2` is a child sitting in a named column it was
   * never given a name for, which is precisely what the suggestion row did by
   * accident. Nothing in the sheets uses a numeric column today, so narrowing
   * this costs nothing — and if a numeric one is ever wanted, changing this
   * line is the deliberate act that should carry the reason.
   */
  const FULL_SPAN = /^1\s*\/\s*-1$/;
  const placed = new Set<string>();
  for (const sheet of SHEETS) {
    for (const rule of rulesOf(sheet)) {
      const area = rule.decls["grid-area"];
      const column = rule.decls["grid-column"];
      if ((area !== undefined && areas.has(area)) || FULL_SPAN.test(column ?? "")) {
        for (const name of targetClasses(rule.selector)) placed.add(name);
      }
    }
  }

  /**
   * The two children the grid never places, each because the sheet takes it
   * out of the flow entirely. Written here rather than derived, because
   * "exempt" is a judgement — but the judgement is checked against the sheet
   * below, so it cannot quietly become a lie (house rule 12's shape).
   */
  const EXEMPT: Record<string, { sheet: string; decl: [string, string] }> = {
    "row--dot": { sheet: "design-classical.css", decl: ["display", "none"] },
    "row--edge": { sheet: "popup-rows.css", decl: ["position", "absolute"] },
  };

  it("read a grid out of design-classical.css", () => {
    expect(grid, "`#view .row` still declares grid-template-areas").toBeDefined();
    // `menu` spans both rows, and `when` stops at the column before it. It used
    // to be `"when when when"` with the ⋯ positioned `absolute` over the row's
    // right end — which put the button on top of the clock on every row in the
    // app once it was drawn unconditionally rather than on hover. Measured at
    // 400px: it covered the last 19px of a week time and 27px of a day time,
    // and `elementFromPoint` at the time's last glyph returned the button.
    // (Sushi, 2026-09-19: "the 3 dots are covering the times".)
    expect(areasIn(grid!.decls["grid-template-areas"]!).sort()).toEqual([
      "main",
      "menu",
      "menu",
      "tick",
      "when",
      "when",
    ]);
    // The four placements that make the areas real. If one of these selectors
    // is renamed, every row on the tab auto-places and this test is the only
    // thing that would say so.
    for (const name of ["row--main", "row--when", "row--menu", "row--tick"]) {
      expect(placed.has(name), `${name} is placed by a sheet`).toBe(true);
    }
    // And the children that are not in an area at all but span the row: the
    // exam card's two glyph lines, its Reserve button, and the qualifier lines
    // every view can draw. These are the only shape of `grid-column` credited.
    for (const name of ["exam-line", "exam-reserve", "row--detail", "row--detail-error"]) {
      expect(placed.has(name), `${name} spans the row`).toBe(true);
    }
    // Nothing is credited by a numeric column, because nothing uses one.
    const numeric = SHEETS.flatMap((sheet) =>
      rulesOf(sheet)
        .filter((rule) => {
          const column = rule.decls["grid-column"];
          return column !== undefined && !FULL_SPAN.test(column);
        })
        .map((rule) => `${sheet}: ${rule.selector} { grid-column: ${rule.decls["grid-column"]} }`),
    );
    expect(numeric, "no sheet places a row child by number").toEqual([]);
  });

  it("only exempts a child the sheet really takes out of the grid", () => {
    for (const [name, { sheet, decl }] of Object.entries(EXEMPT)) {
      const removed = rulesOf(sheet).some(
        (rule) => targetClasses(rule.selector).includes(name) && rule.decls[decl[0]] === decl[1],
      );
      expect(removed, `${name} is ${decl[0]}: ${decl[1]} in ${sheet}`).toBe(true);
      expect(placed.has(name), `${name} is not also placed`).toBe(false);
    }
  });

  it.each(["day", "week", "month", "nodate", "exams"] as const)(
    "leaves no unplaced child on any row of the %s tab",
    async (tab) => {
      shell.selectTab(tab);
      await settle();
      const drawn = rows();
      expect(drawn.length, `the ${tab} tab drew rows`).toBeGreaterThan(0);
      const stray: string[] = [];
      for (const row of drawn) {
        for (const child of row.children) {
          const names = [...child.classList];
          if (names.some((name) => placed.has(name) || name in EXEMPT)) continue;
          stray.push(
            `${row.querySelector(".row--title")?.textContent ?? "(row)"} › ` +
              `${child.tagName.toLowerCase()}${names.map((n) => `.${n}`).join("")}`,
          );
        }
      }
      // A child that names no area does not disappear — it auto-places into
      // whichever column is free, which is how a title ended up in a 34px one.
      expect(stray, "every row child is placed by the sheet").toEqual([]);
    },
  );

  it("leaves no unplaced child on the Alerts tab's own sections either", async () => {
    shell.selectTab("nodate");
    await settle();
    const screen = view().querySelector(".needsyou")!;
    // The guard names the *list*, not the row's class. Naming `.sug-row` here
    // would make a row that went back to being a `.row` fail on the guard, one
    // line before the scan that is the point of this test (mutation-check rule
    // 4: an input that never reaches the line proves nothing about it).
    expect(screen.querySelector(".sug-list")?.children.length, "a suggestion is on screen").toBe(1);
    const stray: string[] = [];
    for (const row of screen.querySelectorAll<HTMLElement>("a.row, div.row")) {
      for (const child of row.children) {
        const names = [...child.classList];
        if (names.some((name) => placed.has(name) || name in EXEMPT)) continue;
        stray.push(`${child.tagName.toLowerCase()}${names.map((n) => `.${n}`).join("")}`);
      }
    }
    expect(stray).toEqual([]);
  });
});

/* ========================================================================== */

/**
 * Where each **section** of the Alerts tab starts, rather than each row child.
 *
 * The second half of this file asks whether a part of a row is in the right
 * column. This asks the same question one level out, for the defect Sushi
 * reported the same afternoon ("no date at all text is shifted too"): the two
 * undated groups were written when No date was its own *screen*, sitting
 * straight inside `#view`, so `design-classical-nodate.css` gave every block in
 * them the mock's own 16px gutter. On the Alerts tab they are three of five
 * sections inside `.screen.needsyou`, which already spends 10px on that job —
 * so the cards measured at x=26 while the Late row, the suggestion rows and the
 * source rows beside them sat at 10, and the group note started 12px right of
 * the heading it explains.
 *
 * linkedom lays nothing out, so the browser did the measuring (the run is in
 * the 2026-09-19 lane report). What is checkable here, and what would have
 * caught it, is the *claim the sheet makes*: *the screen owns the horizontal
 * gutter, and no block inside it states one of its own.*
 */
describe("the Alerts tab's undated sections take the screen's gutter", () => {
  const nodate = rulesOf("design-classical-nodate.css");

  /** The left and right of a box shorthand, or of its `-inline` form. */
  const sides = (value: string): [string, string] => {
    const parts = value.split(/\s+/);
    if (parts.length === 1) return [parts[0]!, parts[0]!];
    return [parts[3] ?? parts[1]!, parts[1]!];
  };

  /**
   * Every horizontal margin/padding `design-classical-nodate.css` states for a
   * class, in source order — the last one wins, as it would in the browser.
   */
  const gutter = (name: string): string[] => {
    const out: string[] = [];
    for (const rule of nodate) {
      if (!targetClasses(rule.selector).includes(name)) continue;
      for (const [property, value] of Object.entries(rule.decls)) {
        if (property === "margin" || property === "padding") out.push(...sides(value));
        else if (property.endsWith("-inline")) out.push(...sides(value));
        else if (/-(left|right)$/.test(property) && /^(margin|padding)/.test(property))
          out.push(value);
      }
    }
    return out;
  };

  const zero = (value: string): boolean => /^0(px)?$/.test(value);

  it.each(["nodate-stack", "nodate-rule"])(
    "%s states no horizontal gutter of its own",
    (name) => {
      const stated = gutter(name);
      expect(stated.length, `${name} is styled by the sheet`).toBeGreaterThan(0);
      expect(stated.filter((value) => !zero(value)), `${name}'s own gutter`).toEqual([]);
    },
  );

  // The "the dashed Add card is full width inside that gutter" test that sat
  // here is gone with the card itself (2026-09-19). It pinned
  // `width: 100%` against `popup-views.css`'s `calc(100% - 20px)`; with
  // nothing building a `.nodate-add`, it would have pinned a rule no document
  // can reach — which is the shape of a test that passes against a wrong
  // implementation.

  it("the group note starts where the group heading's text does", () => {
    // Not "4px" restated: read out of `.section-head`, which is what the
    // heading beside it actually gets. If that indent moves, this moves.
    const head = rulesOf("popup.css").find((rule) => rule.selector === ".section-head");
    const [, headLeft] = sides(head!.decls["padding"]!);
    // Its `margin: 0 0 6px` contributes two zeros; what is asserted is that
    // the one non-zero gutter it states is the heading's own indent.
    expect(gutter("nodate-group--note").filter((value) => !zero(value))).toEqual([
      headLeft,
      headLeft,
    ]);
  });

  /*
   * The D14 course-hue bar is `position: absolute; inset: 0 auto 0 0` (see
   * `popup-rows.css`), so it reserves no space: any row whose left padding has
   * been flattened draws its own first glyph underneath it, and a row with
   * `overflow: hidden` then clips that glyph away. The week entry and the Month
   * agenda row each learned this on 2026-09-19; the No date card, whose row is
   * `padding: 0`, was the third and was still clipping ("CSt1 Code Studio…" for
   * "PrairieLearn CSt1 Code Studio…", measured: bar x=35..39, title left x=35).
   *
   * The inset is read out of the two sheets that already got it right rather
   * than restated, so the three cannot drift apart — `resolveColumn`'s finding
   * applied to a constant instead of to a rule.
   */
  it("makes room for the D14 edge bar, by the same inset week and month use", () => {
    const inset = (path: string): string[] =>
      rulesOf(path)
        .filter((rule) => /:has\(>\s*\.row--edge\)/.test(rule.selector))
        .map((rule) => rule.decls["padding-left"] ?? "(none)");
    const week = inset("design-classical-week.css");
    expect(week, "the week entry still states the inset this reads").toEqual(["9px"]);
    expect(inset("design-classical-month.css"), "month agrees with week").toEqual(week);
    expect(inset("design-classical-nodate.css"), "the No date card agrees too").toEqual(week);
    // And the card's other blocks step past the bar with it, or the title ends
    // up 9px right of the quote box and the actions' rule under it.
    const siblings = nodate.filter(
      (rule) => /\.nodate-card:has\(\.row--edge\)/.test(rule.selector),
    );
    expect(siblings.map((rule) => rule.decls["margin-left"])).toEqual(week);
  });

  it("no rule in the sheet still addresses these blocks as children of #view", () => {
    // `#view > .nodate-group--head` set a 16px gutter and its own margins, and
    // had matched nothing since the groups moved inside `.screen.needsyou` —
    // a rule that loses loses silently, and a *dead* one loses more quietly
    // still. The descendant form (`#view .nodate-card`) is fine and is used
    // deliberately, to outrank `#view .row`.
    const dead = nodate
      .map((rule) => rule.selector)
      .filter((selector) => /#view\s*>\s*\.nodate-/.test(selector));
    expect(dead, "the Alerts screen sits between #view and these blocks").toEqual([]);
  });
});

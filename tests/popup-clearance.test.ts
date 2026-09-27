/**
 * Who wins `margin-bottom` on the last thing in the list — across every sheet
 * the popup loads, in load order.
 *
 * The room under the last row that lets it out from under the floating "+"
 * (`design-classical-week.css`, `design-classical-month.css`,
 * `popup-views.css`) is a *number*, and a number is only worth what the cascade
 * leaves of it. The ZIP acceptance pass already has this defect written down:
 * a shared sheet's `.section-head > :last-child:not(:first-child)` at (0,4,1)
 * beat a view sheet's (0,2,1) and drew muted 11px text on a badge that had just
 * painted itself navy — "nothing failed: the typecheck passed, the suite
 * passed, and the lane that wrote the view sheet had no browser".
 *
 * A test that greps for the declaration would pin nothing: the declaration can
 * be there and lose. So this resolves the cascade instead — every rule in every
 * sheet `popup.html` links, in order, matched against the real element with a
 * real selector engine, specificity computed, highest (specificity, order)
 * wins. If a later rule anywhere outranks the clearance, this fails and names
 * the rule that took the room.
 *
 * What it cannot do is check the *value*: nothing here has a layout engine, so
 * "43px is enough to clear a 40px button" is a browser measurement and is
 * recorded as one. This pins that the 43px is the one that applies.
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";

/** A style rule, flattened out of any at-rule that wraps it, in load order. */
interface Rule {
  sheet: string;
  selector: string;
  body: string;
  order: number;
  /** The at-rule prelude this rule sits inside, or "" at the top level. */
  media: string;
}

/** The sheets `popup.html` links, in the order the browser applies them. */
function sheets(): { name: string; css: string }[] {
  const html = readFileSync(new URL("../public/popup.html", import.meta.url), "utf8");
  const hrefs = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map((m) => m[1]!);
  expect(hrefs.length).toBeGreaterThan(5);
  return hrefs.map((name) => ({
    name,
    css: readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8"),
  }));
}

/**
 * Brace-depth scan rather than a regex over `{…}`.
 *
 * `@media` and `@supports` hold nested rules, and a regex that stops at the
 * first `}` splits them down the middle — which silently drops every rule in a
 * dark-mode block, i.e. exactly the half of the stylesheet nobody looks at.
 * Rules inside a condition are flattened in and treated as competitors, which
 * is the conservative direction: a conditional rule that could take the room is
 * reported rather than ignored.
 */
function rulesIn(name: string, css: string, out: Rule[], media = ""): void {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let prelude = "";
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i]!;
    if (ch !== "{") {
      prelude += ch;
      continue;
    }
    let depth = 1;
    let j = i + 1;
    for (; j < clean.length && depth > 0; j += 1) {
      if (clean[j] === "{") depth += 1;
      else if (clean[j] === "}") depth -= 1;
    }
    const block = clean.slice(i + 1, j - 1);
    const selector = prelude.trim();
    if (selector.startsWith("@")) {
      // A condition wrapping rules (`@media`), or a declaration block with no
      // selectors of its own (`@font-face`, `@keyframes`) — recursing into the
      // second finds nothing, which is right.
      if (/\{/.test(block)) rulesIn(name, block, out, selector);
    } else if (selector !== "") {
      out.push({ sheet: name, selector, body: block, order: out.length, media });
    }
    prelude = "";
    i = j - 1;
  }
}

function allRules(): Rule[] {
  const out: Rule[] = [];
  for (const { name, css } of sheets()) rulesIn(name, css, out);
  return out;
}

/** Does this block decide a bottom margin — by the longhand or the shorthand? */
function setsBottomMargin(body: string): boolean {
  return /(^|[;{\s])margin(-bottom)?\s*:/.test(body);
}

/** (ids, classes+attributes+pseudo-classes, elements+pseudo-elements). */
function specificity(selector: string): [number, number, number] {
  // `:where(…)` counts for nothing, whatever it holds — which is how both
  // palettes' token blocks are written, so they compete on order alone.
  const unwhere = selector.replace(/:where\((?:[^()]|\([^)]*\))*\)/g, "");
  const stripped = unwhere.replace(/\[[^\]]*\]|\([^)]*\)/g, (m) => (m.startsWith("[") ? "[]" : "()"));
  const ids = (stripped.match(/#[\w-]+/g) ?? []).length;
  const classes =
    (stripped.match(/\.[\w-]+/g) ?? []).length +
    (stripped.match(/\[\]/g) ?? []).length +
    (stripped.match(/(?<!:):(?!:)[\w-]+/g) ?? []).length;
  const elements =
    (stripped.match(/(?:^|[\s>+~(])([a-zA-Z][\w-]*)/g) ?? []).length +
    (stripped.match(/::[\w-]+/g) ?? []).length;
  return [ids, classes, elements];
}

function beats(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < 3; i += 1) {
    if (a[i]! !== b[i]!) return a[i]! > b[i]!;
  }
  return false;
}

/**
 * The rule that actually decides `margin-bottom` on this element.
 *
 * A selector the engine cannot evaluate is not quietly skipped: if it sets a
 * margin it is a possible competitor, and ignoring it would be a false pass of
 * exactly the kind this file exists to prevent.
 */
function winner(el: Element, rules: Rule[], sets: (body: string) => boolean = setsBottomMargin): Rule {
  let best: { rule: Rule; spec: [number, number, number] } | undefined;
  for (const rule of rules) {
    if (!sets(rule.body)) continue;
    for (const one of rule.selector.split(",").map((s) => s.trim())) {
      if (one === "") continue;
      // Two kinds of selector are skipped, by name, because neither can decide
      // the element at rest: a pseudo-element styles a box that is not this
      // element, and a user-action state is not the state being resolved.
      // Anything else the engine cannot evaluate still throws.
      if (/::|:(hover|focus|focus-visible|focus-within|active|visited)\b/.test(one)) continue;
      let hit: boolean;
      try {
        hit = el.matches(one);
      } catch {
        throw new Error(`cannot evaluate a competing selector: ${rule.sheet} — ${one}`);
      }
      if (!hit) continue;
      const spec = specificity(one);
      if (!best || !beats(best.spec, spec)) best = { rule, spec };
    }
  }
  if (!best) throw new Error(
    sets === setsBottomMargin ? "nothing sets a bottom margin on this element" : "nothing sets this property on this element",
  );
  return best.rule;
}

function element(markup: string, selector: string): Element {
  const { document } = parseHTML(`<!doctype html>${markup}`);
  const el = document.querySelector(selector);
  if (!el) throw new Error(`no ${selector}`);
  return el;
}

describe("the room under the last row survives the cascade", () => {
  const rules = allRules();

  it("reads every sheet the popup links, including inside media conditions", () => {
    expect(new Set(rules.map((r) => r.sheet)).size).toBeGreaterThan(5);
    // The scan is only worth anything if it descends: `ui.css`'s palettes live
    // in class blocks and its dark half in conditions, so a split-at-the-first-
    // brace scan would come back with a fraction of this.
    expect(rules.length).toBeGreaterThan(400);
  });

  it("gives the week's seventh card the clearance, not a later rule elsewhere", () => {
    const last = element(
      `<html data-design="classical"><body data-view="week"><div id="view">` +
        `<div class="wrow"></div><div class="wrow"><div class="witems">` +
        `<div class="row"><button class="row--menu"></button></div></div></div>` +
        `</div></body></html>`,
      ".wrow:last-child",
    );
    const won = winner(last, rules);
    expect(won.sheet).toBe("design-classical-week.css");
    expect(won.body).toContain("43px");
  });

  it("leaves the six cards above it alone", () => {
    const first = element(
      `<html data-design="classical"><body data-view="week"><div id="view">` +
        `<div class="wrow"></div><div class="wrow"></div></div></body></html>`,
      ".wrow:first-child",
    );
    expect(() => winner(first, rules)).toThrow("nothing sets a bottom margin");
  });

  it("gives the month's agenda the clearance, over its own `margin: 16px`", () => {
    const list = element(
      `<html data-design="classical"><body data-view="month"><div id="view">` +
        `<div class="mdow"></div><div class="mdots"></div><div class="mday-list">` +
        `<div class="mday-rows"><div class="row"><button class="row--menu"></button></div></div>` +
        `</div></div></body></html>`,
      ".mday-list",
    );
    const won = winner(list, rules);
    expect(won.sheet).toBe("design-classical-month.css");
    expect(won.body).toContain("55px");
  });

  it("keeps Day's own 58px, which is the measurement these two were derived from", () => {
    const band = element(
      `<html data-design="classical"><body data-view="day"><div id="view">` +
        `<div class="tsection"></div><div class="tsection"></div></div></body></html>`,
      ".tsection:last-child",
    );
    const won = winner(band, rules);
    expect(won.sheet).toBe("popup-views.css");
    expect(won.body).toContain("58px");
  });
});

/** Does this block set `prop` — the longhand, or (with `shorthand`) its shorthand? */
function sets(prop: string, shorthand?: string): (body: string) => boolean {
  const names = [prop, ...(shorthand ? [shorthand] : [])].map((n) => n.replace(/[-]/g, "\\-"));
  const re = new RegExp(`(^|[;{\\s])(${names.join("|")})\\s*:`);
  return (body) => re.test(body);
}

/** The value a block gives `prop`, the last declaration of it in the block. */
function declared(body: string, prop: string): string {
  const re = new RegExp(`(?:^|[;{\\s])${prop.replace(/[-]/g, "\\-")}\\s*:\\s*([^;]+)`, "g");
  let last: string | undefined;
  for (const m of body.matchAll(re)) last = m[1]!.trim();
  if (last === undefined) throw new Error(`${prop} is not declared here`);
  return last;
}

describe("the Exams board's last card clears the floating + (popup-live #1)", () => {
  const rules = allRules();
  const board = (tail: string) =>
    `<html data-design="classical"><body data-view="exams"><div id="view">` +
    `<div class="folio exam-folio"></div><div class="section-head exam-head"></div>` +
    `<div class="exam-stack"><a class="row"></a></div>` +
    `<div class="section-head exam-head"></div>${tail}</div></body></html>`;

  it("gives the last stack 62px — 6 of card margin + 62 − the 52 the + hangs = Day's 16", () => {
    const last = element(board(`<div class="exam-stack"><a class="row"></a></div>`), ".exam-stack:last-child");
    const won = winner(last, rules);
    expect(won.sheet).toBe("design-classical-exams.css");
    expect(declared(won.body, "margin-bottom")).toBe("62px");
  });

  it("leaves the stacks above it alone", () => {
    // `.exam-stack` alone finds the first of the two.
    const first = element(board(`<div class="exam-stack"><a class="row"></a></div>`), ".exam-stack");
    expect(first.matches(":last-child")).toBe(false);
    expect(() => winner(first, rules)).toThrow("nothing sets a bottom margin");
  });

  it("is keyed to the Exams tab, not to every exam-stack", () => {
    const elsewhere = element(
      `<html data-design="classical"><body data-view="day"><div id="view">` +
        `<div class="exam-stack"></div></div></body></html>`,
      ".exam-stack",
    );
    expect(() => winner(elsewhere, rules)).toThrow("nothing sets a bottom margin");
  });
});

describe("an empty state has room under it for the + (popup-live #9)", () => {
  const rules = allRules();
  const view = (name: string, inner: string) =>
    `<html data-design="classical"><body data-view="${name}"><div id="view">${inner}</div></body></html>`;

  it("gives Day/Week/Month's 'Nothing due' 48px under its 24px of padding", () => {
    for (const name of ["day", "week", "month"]) {
      const note = element(view(name, `<p class="muted empty">Nothing due in the next 60 days.</p>`), ".empty");
      const won = winner(note, rules);
      expect(won.sheet).toBe("popup-views.css");
      expect(declared(won.body, "margin-bottom")).toBe("48px");
    }
  });

  it("moves the room under the sign-in buttons when they are last", () => {
    const markup = view("day", `<p class="muted empty">x</p><div class="empty--actions"><button></button></div>`);
    expect(declared(winner(element(markup, ".empty--actions"), rules).body, "margin-bottom")).toBe("48px");
    // The sentence above them is no longer last, so it keeps `p`'s own 8px.
    expect(winner(element(markup, ".empty"), rules).sheet).toBe("ui.css");
  });

  it("gives the empty exam board's card the full 68px", () => {
    const note = element(view("exams", `<div class="card view-note">No exams</div>`), ".view-note");
    const won = winner(note, rules);
    expect(won.sheet).toBe("popup-views.css");
    expect(declared(won.body, "margin-bottom")).toBe("68px");
  });

  it("gives the empty Alerts card 54px on top of the screen's 14", () => {
    const clear = element(
      view("nodate", `<div class="screen needsyou alerts"><p class="needsyou--clear card">Nothing needs you</p></div>`),
      ".needsyou--clear",
    );
    const won = winner(clear, rules);
    expect(won.sheet).toBe("popup-views.css");
    expect(declared(won.body, "margin-bottom")).toBe("54px");
  });

  it("does not reach the month agenda's own 'nothing that day', which its card clears", () => {
    const inner = element(
      view("month", `<div class="mday-list"><div class="mday-rows"><p class="muted empty">x</p></div></div>`),
      ".empty",
    );
    expect(winner(inner, rules).selector).toBe(".mday-list .empty");
  });
});

describe("a Late card owns its two answers (popup-live #6)", () => {
  const rules = allRules();
  const markup =
    `<html data-design="classical"><body data-view="nodate"><div id="view"><div class="screen needsyou alerts">` +
    `<section class="needsyou--group"><div class="needsyou--item">` +
    `<a class="row row-overdue course-3"><span class="row--main"></span></a>` +
    `<div class="needsyou--actions"><button class="btn">Mark done</button></div>` +
    `</div></section></div></div></body></html>`;

  it("draws the card on the item, not on the row", () => {
    const item = element(markup, ".needsyou--item");
    const won = winner(item, rules, sets("border"));
    expect(won.sheet).toBe("design-classical-nodate.css");
    expect(declared(won.body, "border")).toBe("1px solid var(--card-line)");
  });

  it("takes the row's own border and margin away, over the overdue row's rules", () => {
    const row = element(markup, ".row");
    const border = winner(row, rules, sets("border"));
    expect(border.sheet).toBe("design-classical-nodate.css");
    expect(declared(border.body, "border")).toBe("0");
    // Over `#view .row.row-overdue`'s (1,3,1) border-color too: nothing paints
    // an edge on a border that is gone, but a later sheet widening it would.
    expect(winner(row, rules, sets("border-color", "border")).sheet).toBe("design-classical-nodate.css");
    const margin = winner(row, rules);
    expect(margin.sheet).toBe("design-classical-nodate.css");
    expect(declared(margin.body, "margin")).toBe("0");
  });

  it("puts the actions behind a hairline inside the card", () => {
    const actions = element(markup, ".needsyou--actions");
    const won = winner(actions, rules, sets("border-top"));
    expect(won.sheet).toBe("design-classical-nodate.css");
    expect(declared(won.body, "border-top")).toContain("var(--nd-act-rule)");
  });
});

describe("the plain design's overdue edge (open-bugs #15, which was wrong in part)", () => {
  /*
   * The finding: `#view .row-overdue { border-color: var(--err) }` "has never
   * won and is doubly dead", delete it. Resolved: it loses the LEFT edge and
   * wins the other three, so deleting it would change the plain design's
   * overdue cards with no test failing. These pin both halves, so the decision
   * Sushi makes about it is a visible edit rather than a silent one.
   */
  const rules = allRules();
  const row = () =>
    element(
      `<html><body data-view="day"><div id="view"><a class="row row-overdue course-3"></a></div></body></html>`,
      ".row",
    );

  it("loses the left edge to the course rule", () => {
    const won = winner(row(), rules, sets("border-left-color", "border-left"));
    expect(won.sheet).toBe("popup-rows.css");
    expect(won.selector).toContain('[class*="course-"]');
  });

  it("wins the top edge — the rule is live, not dead", () => {
    const won = winner(row(), rules, sets("border-top-color", "border-color"));
    expect(won.selector).toBe("#view .row-overdue");
    expect(declared(won.body, "border-color")).toBe("var(--err)");
  });
});

describe("the full view's tab strip (popup-live #4)", () => {
  const rules = allRules();
  const strip =
    `<html data-design="classical" class="view-full"><body><nav id="tabs" class="tabs">` +
    `<button class="tab"><svg class="icon"></svg><span class="tab--label">Alerts</span>` +
    `<span class="chip-count is-warn">12</span></button></nav></body></html>`;

  it("gives each tab a 96px track instead of its icon's width", () => {
    const won = winner(element(strip, ".tab"), rules, sets("flex"));
    expect(won.sheet).toBe("design-classical-shell.css");
    expect(declared(won.body, "flex")).toBe("0 0 96px");
  });

  it("centres the strip", () => {
    const won = winner(element(strip, ".tabs"), rules, sets("justify-content"));
    expect(won.sheet).toBe("design-classical-shell.css");
  });

  it("hangs the count off the icon's centre, not the tab's edge", () => {
    const badge = element(strip, ".chip-count");
    expect(declared(winner(badge, rules, sets("left")).body, "left")).toBe("calc(50% + 12px)");
    expect(declared(winner(badge, rules, sets("right")).body, "right")).toBe("auto");
  });

  it("leaves the popup's strip as it was", () => {
    const popup = strip.replace(' class="view-full"', "");
    expect(winner(element(popup, ".tab"), rules, sets("flex")).sheet).not.toBe("design-classical-shell.css");
    expect(declared(winner(element(popup, ".chip-count"), rules, sets("right")).body, "right")).toBe("9px");
  });
});

describe("the week card's clock column fits a late window (popup-live #5)", () => {
  it("caps at 120px, so '80% until 11:59 PM' is not cut to '80% un'", () => {
    const rules = allRules();
    const when = element(
      `<html data-design="classical"><body data-view="week"><div id="view"><div class="wrow">` +
        `<div class="witems"><a class="row"><span class="row--when"></span></a></div></div></div></body></html>`,
      ".row--when",
    );
    const won = winner(when, rules, sets("max-width"));
    expect(won.sheet).toBe("design-classical-week.css");
    expect(declared(won.body, "max-width")).toBe("120px");
  });
});

/* ---- colour, resolved through the tokens --------------------------------- */

/** A custom property's value on the root, through every `var()` it names. */
function token(root: Element, name: string, rules: Rule[], depth = 0): string {
  if (depth > 12) throw new Error(`var() loop at ${name}`);
  const top = rules.filter((r) => r.media === "");
  const won = winner(root, top, sets(name));
  return resolve(root, declared(won.body, name), rules, depth + 1);
}

function resolve(root: Element, value: string, rules: Rule[], depth = 0): string {
  return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => token(root, name, rules, depth));
}

function rgb(value: string): [number, number, number, number] {
  const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value.trim());
  if (hex) {
    const n = hex[1]!;
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)).concat(
      hex[2] ? parseInt(hex[2], 16) / 255 : 1,
    ) as [number, number, number, number];
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(value.trim());
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3]), fn[4] === undefined ? 1 : Number(fn[4])];
  throw new Error(`not a colour this test reads: ${value}`);
}

/** `top` composited over an opaque `under`, as the page paints it. */
function over(top: string, under: string): string {
  const [r, g, b, a] = rgb(top);
  const [R, G, B] = rgb(under);
  const mix = (x: number, y: number) => Math.round(x * a + y * (1 - a));
  return `rgb(${mix(r, R)}, ${mix(g, G)}, ${mix(b, B)})`;
}

function contrast(ink: string, ground: string): number {
  const lum = (c: string) => {
    const [r, g, b] = rgb(c).map((v, i) => (i < 3 ? v / 255 : v)) as number[];
    const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
  };
  const [lo, hi] = [lum(ink), lum(ground)].sort((x, y) => x - y);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("the Exams tab's accent text reads in light (popup-live #7)", () => {
  const rules = allRules();
  const root = (dark: boolean) =>
    element(`<html data-design="classical"${dark ? ' class="is-dark"' : ""}><body></body></html>`, "html");

  it("draws the booking card's course code and 'Not booked' in --ex-alert", () => {
    // Which rule decides the ink — so the ratio below is about what is drawn.
    const card = element(
      `<html data-design="classical"><body data-view="exams"><div id="view"><div class="exam-stack">` +
        `<a class="row row-booking"><span class="row--main"><span class="row--meta"><b class="row--code">CS 357</b>` +
        `</span></span></a></div></div></body></html>`,
      ".row--code",
    );
    expect(declared(winner(card, rules, sets("color")).body, "color")).toBe("var(--ex-alert)");
    const head = element(
      `<html data-design="classical"><body data-view="exams"><div id="view">` +
        `<div class="section-head exam-head section-head--err"><span class="exam-head--label">Not booked</span></div>` +
        `</div></body></html>`,
      ".exam-head",
    );
    expect(declared(winner(head, rules, sets("color")).body, "color")).toBe("var(--ex-alert)");
  });

  for (const dark of [false, true]) {
    it(`clears 4.5:1 on the booking card and on the page (${dark ? "dark" : "light"})`, () => {
      const ink = token(root(dark), "--ex-alert", rules);
      const card = token(root(dark), "--ex-book-bg", rules);
      const page = token(root(dark), "--bg", rules);
      // Light: expected 4.97 and 5.24; the shipped #df6e50 measured 2.93 / 3.08.
      expect(contrast(ink, card)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(ink, page)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("the warn count and the 'Ambiguous date text' chip clear 4.5:1 on their washes in light", () => {
    const light = root(false);
    const ink = token(light, "--warn-ink", rules);
    const wash = token(light, "--warn-wash", rules);
    const strong = token(light, "--warn-wash-strong", rules);
    // The selected tab's ground is `--bg-active-tab`; the chip sits on a card.
    expect(contrast(ink, over(wash, token(light, "--bg-active-tab", rules)))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ink, over(wash, token(light, "--surface", rules)))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ink, over(strong, token(light, "--surface-raised", rules)))).toBeGreaterThanOrEqual(4.5);
  });

  it("paints both with --warn-ink", () => {
    const tab = element(
      `<html data-design="classical"><body><nav class="tabs"><button class="tab"><span class="chip-count is-warn">1</span></button></nav></body></html>`,
      ".chip-count",
    );
    expect(declared(winner(tab, rules, sets("color")).body, "color")).toBe("var(--warn-ink)");
    const chip = element(
      `<html data-design="classical"><body><div class="nodate-flag"><span class="chip-check">Ambiguous date text</span></div></body></html>`,
      ".chip-check",
    );
    expect(winner(chip, rules, sets("color")).body).toContain("var(--warn-ink)");
  });
});

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
function rulesIn(name: string, css: string, out: Rule[]): void {
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
      if (/\{/.test(block)) rulesIn(name, block, out);
    } else if (selector !== "") {
      out.push({ sheet: name, selector, body: block, order: out.length });
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
  const stripped = selector.replace(/\[[^\]]*\]|\([^)]*\)/g, (m) => (m.startsWith("[") ? "[]" : "()"));
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
function winner(el: Element, rules: Rule[]): Rule {
  let best: { rule: Rule; spec: [number, number, number] } | undefined;
  for (const rule of rules) {
    if (!setsBottomMargin(rule.body)) continue;
    for (const one of rule.selector.split(",").map((s) => s.trim())) {
      if (one === "") continue;
      let hit: boolean;
      try {
        hit = el.matches(one);
      } catch {
        throw new Error(`cannot evaluate a margin-setting selector: ${rule.sheet} — ${one}`);
      }
      if (!hit) continue;
      const spec = specificity(one);
      if (!best || !beats(best.spec, spec)) best = { rule, spec };
    }
  }
  if (!best) throw new Error("nothing sets a bottom margin on this element");
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

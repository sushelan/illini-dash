/**
 * The icon set (`src/ui/icons.ts`).
 *
 * Two things here are worth pinning and neither is about how an icon looks.
 *
 * An icon button with no accessible name is announced as "button" — and every
 * icon control in this project used to be either an `<a>` with a glyph in it or
 * a `<button>` whose entire content was `⋯`. And a path that is empty or
 * malformed renders as nothing at all: an invisible control in the exact place
 * a control is supposed to be, which is the same class of failure as the
 * invisible primary button in Phase A.
 *
 * `linkedom` gives a DOM without a browser, which is what the parsers already
 * use. It does not lay anything out, so this checks structure and naming — the
 * *shapes* are checked by eye on `dist/components.html`, which renders all of
 * them side by side in every theme.
 */

import { parseHTML } from "linkedom";
import { beforeAll, describe, expect, it } from "vitest";
import { ICON_PATHS, type IconName, icon, iconButton } from "../src/ui/icons.js";

beforeAll(() => {
  const { document } = parseHTML("<!doctype html><html><body></body></html>");
  (globalThis as unknown as { document: Document }).document = document as unknown as Document;
});

const NAMES = Object.keys(ICON_PATHS) as IconName[];

describe("the paths", () => {
  it("has a path for every name, and none of them is empty", () => {
    // An empty `d` is an invisible control where a control should be.
    expect(NAMES.length).toBeGreaterThan(10);
    for (const name of NAMES) {
      expect(ICON_PATHS[name].length, name).toBeGreaterThan(4);
      expect(ICON_PATHS[name], name).toMatch(/^[Mm]/);
    }
  });

  it("stays inside the 16×16 box every icon declares", () => {
    /*
     * A coordinate outside the viewBox is clipped, so half an icon simply
     * disappears — and at 16px nobody reads it as clipping, they read it as a
     * differently-shaped icon. A stroke of 1.5 means the usable range is
     * roughly -0.75 to 16.75; anything past 17 is a typo.
     */
    for (const name of NAMES) {
      const numbers = ICON_PATHS[name].match(/-?\d+(\.\d+)?/g) ?? [];
      for (const raw of numbers) {
        expect(Math.abs(Number(raw)), `${name}: ${raw}`).toBeLessThanOrEqual(17);
      }
    }
  });

  it("draws a distinct shape for each tab", () => {
    // `tab-day` and `tab-month` were the same calendar with two dots between
    // them, which at 16px is not a difference anyone can use.
    const tabs = NAMES.filter((name) => name.startsWith("tab-")).map((name) => ICON_PATHS[name]);
    expect(new Set(tabs).size).toBe(tabs.length);
  });
});

describe("icon", () => {
  it("hides itself from the accessibility tree", () => {
    // The name belongs on the control. An SVG that also announces itself makes
    // every icon button read its label twice.
    const svg = icon("sync");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelector("title")).toBeNull();
  });

  it("declares an intrinsic size, so nothing jumps before the CSS lands", () => {
    // A bare <svg> with only a viewBox lays out at 300×150.
    const svg = icon("settings");
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("height")).toBe("16");
    expect(svg.getAttribute("viewBox")).toBe("0 0 16 16");
  });

  it("takes its colour from the text around it", () => {
    // So a selected tab's icon and its label cannot disagree about being
    // selected, which is what a hard-coded fill would allow.
    const svg = icon("check");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("fill")).toBe("none");
  });
});

describe("iconButton", () => {
  it("always has an accessible name", () => {
    const button = iconButton("more", "More");
    expect(button.getAttribute("aria-label")).toBe("More");
    expect(button.title).toBe("More");
  });

  it("is a button that cannot submit anything by accident", () => {
    // These sit inside `<label>`s and, on the options page, near form fields.
    // A `<button>` with no `type` defaults to `submit`.
    expect(iconButton("sync", "Sync now").type).toBe("button");
  });

  it("carries the shared button classes rather than a style of its own", () => {
    const button = iconButton("settings", "Settings");
    expect(button.className.split(" ")).toContain("btn");
    expect(button.className.split(" ")).toContain("btn-icon");
  });
});

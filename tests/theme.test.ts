/**
 * Colour schemes (`src/core/theme.ts`).
 *
 * Small, but it runs before the first paint on every page open, so the failure
 * mode is an unstyled interface rather than a wrong colour.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  THEMES,
  THEME_KEY,
  allThemeClasses,
  isThemeName,
  normalizeTheme,
  themeClass,
} from "../src/core/theme.js";

describe("normalizeTheme", () => {
  it("keeps a name it knows", () => {
    for (const theme of THEMES) expect(normalizeTheme(theme.name)).toBe(theme.name);
  });

  it("falls back rather than throwing on anything else", () => {
    // A value written by a later build, or edited by hand. Throwing here leaves
    // the page unstyled, which is worse than the wrong palette.
    for (const junk of [undefined, null, "", "dark", 42, {}, []]) {
      expect(normalizeTheme(junk), String(junk)).toBe(DEFAULT_THEME);
    }
  });

  it("defaults to the university's own colours", () => {
    expect(DEFAULT_THEME).toBe("illini");
    expect(normalizeTheme(null)).toBe("illini");
  });
});

describe("the preset list", () => {
  it("offers a neutral option, so the palette is not compulsory", () => {
    expect(THEMES.map((t) => t.name)).toContain("neutral");
  });

  it("offers one built for telling things apart", () => {
    // Course colour is the only thing identifying a row at a glance, and the
    // default palette's green and orange collapse toward each other under
    // red-green colour blindness.
    const contrast = THEMES.find((t) => t.name === "contrast");
    expect(contrast?.hint).toContain("colour blindness");
  });

  it("says something about every preset, because the names do not explain themselves", () => {
    for (const theme of THEMES) {
      expect(theme.label.length, theme.name).toBeGreaterThan(0);
      expect(theme.hint.length, theme.name).toBeGreaterThan(0);
    }
  });

  it("has no duplicate names", () => {
    expect(new Set(THEMES.map((t) => t.name)).size).toBe(THEMES.length);
  });
});

describe("classes", () => {
  it("namespaces the class so it cannot collide with a layout class", () => {
    // `view-full` already lives on the same element.
    expect(themeClass("illini")).toBe("theme-illini");
  });

  it("lists every class, so switching removes the one before it", () => {
    // Adding rather than swapping leaves two themes applied at once, and which
    // one wins is then a question about stylesheet order.
    const all = allThemeClasses();
    for (const theme of THEMES) expect(all).toContain(themeClass(theme.name));
    expect(all).toHaveLength(THEMES.length);
  });

  it("uses one storage key, because two pages share one origin", () => {
    // The popup reads it and the options page writes it.
    expect(THEME_KEY).toBe("illini-dash.theme");
  });
});

describe("isThemeName", () => {
  it("accepts exactly the presets", () => {
    expect(isThemeName("illini")).toBe(true);
    expect(isThemeName("Illini")).toBe(false);
    expect(isThemeName("theme-illini")).toBe(false);
  });
});

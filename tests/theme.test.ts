/**
 * Colour schemes (`src/core/theme.ts`).
 *
 * Small, but it runs before the first paint on every page open, so the failure
 * mode is an unstyled interface rather than a wrong colour.
 */

import { describe, expect, it } from "vitest";
import {
  DARK_CLASS,
  DEFAULT_MODE,
  DEFAULT_THEME,
  MODES,
  MODE_KEY,
  isModeName,
  normalizeMode,
  resolveDark,
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

describe("light or dark", () => {
  /*
   * The palette and the mode are two questions: which hues carry meaning, and
   * which end of the range they sit at. They were one setting only because the
   * mode was never a setting at all — every dark value lived behind
   * `@media (prefers-color-scheme: dark)`, so a student on a dark machine could
   * not have a light calendar and one on a light machine could not have a dark
   * one.
   */
  it("follows the machine unless told otherwise", () => {
    expect(DEFAULT_MODE).toBe("system");
    expect(resolveDark("system", true)).toBe(true);
    expect(resolveDark("system", false)).toBe(false);
  });

  it("lets the choice beat the machine, in both directions", () => {
    // The whole point. Either override alone would be half a feature.
    expect(resolveDark("light", true)).toBe(false);
    expect(resolveDark("dark", false)).toBe(true);
  });

  it("falls back rather than throwing on anything else", () => {
    // A value written by a later build, or edited by hand. Throwing here leaves
    // the page unstyled, which is worse than the wrong mode.
    for (const junk of [undefined, null, "", "auto", 42, {}, []]) {
      expect(normalizeMode(junk), String(junk)).toBe(DEFAULT_MODE);
    }
  });

  it("accepts exactly the three modes", () => {
    expect(MODES.map((m) => m.name)).toEqual(["system", "light", "dark"]);
    expect(isModeName("system")).toBe(true);
    expect(isModeName("System")).toBe(false);
  });

  it("says something about every mode, because the names do not explain themselves", () => {
    // "Match my system" is not obvious to everyone, and neither is what happens
    // to it when the machine changes its mind.
    for (const mode of MODES) {
      expect(mode.label.length, mode.name).toBeGreaterThan(0);
      expect(mode.hint.length, mode.name).toBeGreaterThan(0);
    }
  });

  it("keeps its own storage key, separate from the palette", () => {
    // Changing the palette must not reset the mode, or the reverse.
    expect(MODE_KEY).toBe("illini-dash.mode");
    expect(MODE_KEY).not.toBe(THEME_KEY);
  });

  it("keys the stylesheet on one class rather than a media query", () => {
    // A media query cannot be overridden by a setting without writing every
    // dark value twice, and two copies of a palette is colour-layer.md rule 3.
    expect(DARK_CLASS).toBe("is-dark");
  });
});

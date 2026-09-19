/**
 * Colour schemes (`src/core/theme.ts`).
 *
 * Small, but it runs before the first paint on every page open, so the failure
 * mode is an unstyled interface rather than a wrong colour.
 */

import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import {
  DARK_CLASS,
  DEFAULT_MODE,
  DEFAULT_TWEAKS,
  normalizeTweaks,
  TWEAK_KEYS,
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
  it("opens on the design's light palette unless told otherwise", () => {
    // Since the redesign (2026-09-19): the approved mocks are light and have no
    // dark version yet, so a dark machine on "system" opened on a palette
    // nobody had designed. `system` still works, it is just not the default.
    expect(DEFAULT_MODE).toBe("light");
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

describe("tweaks (brief D14)", () => {
  it("is off for the edge and off for the source names", () => {
    // The mock's own note: urgency is carried by *text* — "in 4h", red once it
    // is past — so the edge is decoration. Source names went off on 2026-09-19
    // ("too much information being shown"); the deadline screen still says who.
    expect(normalizeTweaks({})).toEqual({ urgencyEdge: false, showSourceNames: false });
    expect(DEFAULT_TWEAKS).toEqual({ urgencyEdge: false, showSourceNames: false });
  });

  it("reads what localStorage actually returns, which is strings", () => {
    expect(normalizeTweaks({ urgencyEdge: "true", showSourceNames: "false" })).toEqual({
      urgencyEdge: true,
      showSourceNames: false,
    });
    expect(normalizeTweaks({ urgencyEdge: true, showSourceNames: false })).toEqual({
      urgencyEdge: true,
      showSourceNames: false,
    });
  });

  it("falls back to the default rather than to false, for every junk value", () => {
    /*
     * `Boolean(stored)` would read a missing or unparsed `showSourceNames` as
     * "off" and silently strip the source from every row on a fresh install.
     * Worker rule 8, one origin over: a stored value is data from another
     * build, not a typed object — and house rule 5, because `""` and `"0"` both
     * pass `typeof x === "string"`.
     */
    for (const junk of [undefined, null, "", "0", "yes", "TRUE", 1, 0, {}, []]) {
      const tweaks = normalizeTweaks({ urgencyEdge: junk, showSourceNames: junk });
      expect(tweaks, String(junk)).toEqual(DEFAULT_TWEAKS);
    }
  });

  it("reads each tweak independently, so one junk value cannot spend the other", () => {
    expect(normalizeTweaks({ urgencyEdge: "maybe", showSourceNames: "true" })).toEqual({
      urgencyEdge: false,
      showSourceNames: true,
    });
  });

  it("gives each tweak its own key, beside the palette and the mode", () => {
    // Not one JSON blob: a blob means every write re-states every other value,
    // so two pages open at once silently undo each other's change.
    expect(TWEAK_KEYS.urgencyEdge).toBe("illini-dash.tweak.urgencyEdge");
    expect(TWEAK_KEYS.showSourceNames).toBe("illini-dash.tweak.showSourceNames");
    const keys = [...Object.values(TWEAK_KEYS), THEME_KEY, MODE_KEY];
    expect(new Set(keys).size).toBe(keys.length);
  });
});

/* -------------------------------------------------------------------------- */
/* The design radio (src/ui/theme-panel.ts)                                    */
/* -------------------------------------------------------------------------- */

/*
 * A DOM, because the thing under test is what the radio *does*, not what
 * `core/theme.ts` computes. The setup is `tests/preview-acceptance.test.ts`'s,
 * one document smaller: `theme-panel.ts` reads `window`, `document` and
 * `localStorage` as its body runs, so all three exist before the import below.
 */
const panelDom = parseHTML("<!doctype html><html><body><div id='themes'></div></body></html>");
const panelGlobals = globalThis as unknown as Record<string, unknown>;
panelGlobals["document"] = panelDom.document;
panelGlobals["window"] = panelDom.window;
// `new Event(…)` inside the panel resolves to the *global* constructor, and
// Node's own `Event` is not one linkedom's `dispatchEvent` can fill in.
panelGlobals["Event"] = panelDom.window.Event;
const panelStore = new Map<string, string>();
panelGlobals["localStorage"] = {
  getItem: (key: string) => panelStore.get(key) ?? null,
  setItem: (key: string, value: string) => void panelStore.set(key, value),
  removeItem: (key: string) => void panelStore.delete(key),
};
const panel = await import("../src/ui/theme-panel.js");

describe("choosing a design redraws the list", () => {
  /*
   * §the defect, 2026-09-19: "in full screen when i go to appearance and click
   * plain and click back on illini dash on top left i see the messed up rows".
   *
   * A design is **markup**, not paint. `rows.ts`'s `cardDesign()` reads
   * `data-design` at render time and builds a two-line card with `.row--main`
   * and `.row--when` for Classical, against the one-line `.row--compact` every
   * other design gets. Flipping the attribute without redrawing leaves one
   * design's children under the other's grid, and the children auto-place into
   * whatever tracks the new sheet names: measured in the real document, the
   * title of a compact row left behind under `design-classical.css` moved from
   * 9px to **638px** from the row's left edge on an 842px row (and 90px on a
   * 264px one) — Sushi's "messed up rows", and the same failure
   * `views/alerts.ts` documents for the suggestion row.
   *
   * The event is what `rows.ts` listens for, so this is the line that makes
   * the two designs' markup follow their stylesheets.
   */
  function designPanel(): { radios: Record<string, HTMLInputElement>; heard: string[] } {
    const host = panelDom.document.getElementById("themes") as unknown as HTMLElement;
    panel.renderThemePanel(host);
    const heard: string[] = [];
    panelDom.window.addEventListener(panel.TWEAKS_EVENT, () => heard.push("redraw"));
    const radios: Record<string, HTMLInputElement> = {};
    for (const radio of host.querySelectorAll("input[name='design']")) {
      radios[(radio as HTMLInputElement).id] = radio as unknown as HTMLInputElement;
    }
    return { radios, heard };
  }

  it("offers Classical and Plain, and Classical is what an unset profile is on", () => {
    panelStore.clear();
    panel.applyStoredTheme();
    const { radios } = designPanel();
    expect(Object.keys(radios).sort()).toEqual(["design-classical", "design-default"]);
    // Nothing stored is a *choice* since 2026-09-19, not an absence.
    expect(panelDom.document.documentElement.dataset["design"]).toBe("classical");
  });

  it("announces a redraw when Plain is chosen, not only the attribute", () => {
    panelStore.clear();
    const { radios, heard } = designPanel();
    radios["design-default"]!.checked = true;
    radios["design-default"]!.dispatchEvent(new panelDom.window.Event("change"));
    // The attribute is gone, so every sheet scoped to `html[data-design=…]` is
    // off — which is exactly when the rows built for one must be rebuilt.
    expect(panelDom.document.documentElement.dataset["design"]).toBeUndefined();
    expect(heard).toEqual(["redraw"]);
  });

  it("announces a redraw when Classical is chosen, which is the direction that strands the title", () => {
    panelStore.clear();
    panelStore.set("illini-dash.design", "none");
    const { radios, heard } = designPanel();
    radios["design-classical"]!.checked = true;
    radios["design-classical"]!.dispatchEvent(new panelDom.window.Event("change"));
    expect(panelDom.document.documentElement.dataset["design"]).toBe("classical");
    expect(heard).toEqual(["redraw"]);
  });
});

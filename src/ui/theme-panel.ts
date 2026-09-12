/**
 * The Appearance panel, and the one line that applies a theme before paint.
 *
 * Split out of `options.ts` so the colour layer is a thing you can hand to
 * someone. Changing the palette should mean touching this file, `core/theme.ts`
 * and the two stylesheets — not reading thirteen hundred lines of settings code
 * to find forty that matter.
 *
 * The whole layer is four files:
 *
 *   public/ui.css        every token, every theme, light and dark
 *   public/popup.css     where the tokens are spent
 *   src/core/theme.ts    the theme list, the default, and validation
 *   src/ui/theme-panel.ts  this — the picker, and applying the choice
 *
 * See docs/colour-layer.md for the contract a new theme has to satisfy.
 */

import {
  THEMES,
  THEME_KEY,
  allThemeClasses,
  normalizeTheme,
  themeClass,
  type ThemeName,
} from "../core/theme.js";

/** The stored choice, or the default. Never throws. */
export function storedTheme(): ThemeName {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(THEME_KEY);
  } catch {
    // The accessor itself throws in a profile with site data blocked. The
    // default is a perfectly good answer.
  }
  return normalizeTheme(raw);
}

/**
 * Puts the theme class on the root element.
 *
 * Called at the top of both pages, before the first paint, which is the whole
 * reason the choice lives in `localStorage` rather than the store: reading the
 * store costs a message to the service worker, and that is a visible flash of
 * the wrong colours on every open.
 */
export function applyStoredTheme(): void {
  const root = document.documentElement;
  root.classList.remove(...allThemeClasses());
  root.classList.add(themeClass(storedTheme()));
}

function remember(name: ThemeName): void {
  try {
    window.localStorage.setItem(THEME_KEY, name);
  } catch {
    // Nothing to do. The choice applies to this page and will not persist.
  }
}

/**
 * The picker in Settings.
 *
 * Mounts into `#themes`. It uses the page's row and swatch classes but takes no
 * *code* from `options.ts`, so this file still lifts out whole — the dependency
 * is on the stylesheet the whole extension shares, not on the settings page.
 *
 * Real `<input type="radio">` elements under the swatches: one choice out of
 * three is what a radio group is, and reimplementing it with divs would mean
 * reimplementing arrow keys, the label association and the announcement.
 */
export function renderThemePanel(host: HTMLElement = document.getElementById("themes")!): void {
  if (!host) return;
  const chosen = storedTheme();
  host.replaceChildren();

  const rows = document.createElement("div");
  rows.className = "rows";

  for (const theme of THEMES) {
    const row = document.createElement("label");
    row.className = "srow2 themerow";
    row.htmlFor = `theme-${theme.name}`;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "theme";
    radio.id = `theme-${theme.name}`;
    radio.className = "srow2--lead";
    radio.checked = theme.name === chosen;
    radio.addEventListener("change", () => {
      remember(theme.name);
      // Applied under the click rather than on reload. A theme you have to
      // reload to see is one nobody tries twice, so nobody finds the one that
      // suits them.
      const root = document.documentElement;
      root.classList.remove(...allThemeClasses());
      root.classList.add(themeClass(theme.name));
    });

    const label = document.createElement("span");
    label.className = "srow2--name";
    label.textContent = theme.label;

    const hint = document.createElement("span");
    hint.className = "srow2--hint";
    hint.textContent = theme.hint;

    /*
     * Three swatches per row: the page, the accent, and a course colour.
     *
     * A list of names is not a colour picker. "High contrast" and "Neutral" do
     * not say what they look like, and the whole reason this panel exists is
     * that the choice is visual — so the row shows the thing it is offering.
     * Rendered in the theme's own class, so each row paints itself.
     */
    const swatches = document.createElement("span");
    swatches.className = `swatches ${themeClass(theme.name)}`;
    for (const token of ["--bg", "--accent", "--course-1"]) {
      const chip = document.createElement("i");
      chip.style.background = `var(${token})`;
      swatches.append(chip);
    }

    row.append(radio, label, hint, swatches);
    rows.append(row);
  }
  host.append(rows);
}

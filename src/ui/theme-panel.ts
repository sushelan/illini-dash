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
 * The radio list in Settings.
 *
 * Mounts into `#themes`. It builds its own rows rather than taking a row
 * helper from `options.ts`, so this file has no dependency on the rest of the
 * settings page and can be lifted out whole.
 */
export function renderThemePanel(host: HTMLElement = document.getElementById("themes")!): void {
  if (!host) return;
  const chosen = storedTheme();
  host.replaceChildren();

  for (const theme of THEMES) {
    const row = document.createElement("div");
    row.className = "opt-row";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "theme";
    radio.id = `theme-${theme.name}`;
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

    const label = document.createElement("label");
    label.htmlFor = radio.id;
    label.textContent = theme.label;

    const hint = document.createElement("span");
    hint.className = "opt-note";
    hint.textContent = theme.hint;

    row.append(radio, label, hint);
    host.append(row);
  }
}

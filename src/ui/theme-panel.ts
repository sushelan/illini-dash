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
  DARK_CLASS,
  MODES,
  MODE_KEY,
  THEMES,
  THEME_KEY,
  allThemeClasses,
  normalizeMode,
  normalizeTheme,
  resolveDark,
  themeClass,
  type ModeName,
  type ThemeName,
} from "../core/theme.js";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // The accessor itself throws in a profile with site data blocked. The
    // default is a perfectly good answer.
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to do. The choice applies to this page and will not persist.
  }
}

/** The stored choice, or the default. Never throws. */
export function storedTheme(): ThemeName {
  return normalizeTheme(read(THEME_KEY));
}

/** Light, dark, or follow the machine. */
export function storedMode(): ModeName {
  return normalizeMode(read(MODE_KEY));
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    // No `matchMedia` is not a dark machine; it is no information.
    return false;
  }
}

/**
 * Puts `is-dark` on the root, or takes it off.
 *
 * The stylesheet keys on this one class rather than on a media query, so that
 * the setting can win. Resolved here, once, from the choice and the machine.
 */
export function applyMode(mode: ModeName = storedMode()): void {
  const dark = resolveDark(mode, systemPrefersDark());
  document.documentElement.classList.toggle(DARK_CLASS, dark);
  syncSwatchMode(dark);
}

/**
 * The theme swatches preview a palette, so they have to preview it in the mode
 * that is actually on.
 *
 * Each swatch carries its own `.theme-*` class in order to paint itself, and
 * dark used to arrive through a media query, which applied to them for free.
 * Now it is a class on the root — which a descendant does not inherit — so
 * without this the picker showed three light palettes on a dark page: a preview
 * that shows the wrong thing is worse than no preview.
 */
function syncSwatchMode(dark: boolean): void {
  for (const swatch of document.querySelectorAll(".swatches")) {
    swatch.classList.toggle(DARK_CLASS, dark);
  }
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
  applyMode();
}

/*
 * A machine that changes its mind while the page is open.
 *
 * Only matters on `system`, which is the default and so the common case: a
 * laptop switching to dark at sunset should take the calendar with it rather
 * than leaving a white rectangle open on a dark desktop.
 */
try {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (storedMode() === "system") applyMode("system");
    });
} catch {
  /* No `matchMedia`. The class set at load stands. */
}

function remember(name: ThemeName): void {
  write(THEME_KEY, name);
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
    if (document.documentElement.classList.contains(DARK_CLASS)) {
      swatches.classList.add(DARK_CLASS);
    }
    for (const token of ["--bg", "--accent", "--course-1"]) {
      const chip = document.createElement("i");
      chip.style.background = `var(${token})`;
      swatches.append(chip);
    }

    row.append(radio, label, hint, swatches);
    rows.append(row);
  }
  host.append(rows);
  host.append(renderModePanel());
}

/**
 * Light, dark, or follow the machine.
 *
 * Its own group under the palette, because they are two questions: the palette
 * says which hues carry meaning, the mode says which end of the range they sit
 * at. They were one setting only because the mode was never a setting — every
 * dark value lived behind a media query, so a student on a dark machine could
 * not have a light calendar and one on a light machine could not have a dark
 * one.
 */
function renderModePanel(): HTMLElement {
  const chosen = storedMode();
  const wrap = document.createElement("div");

  const heading = document.createElement("h3");
  heading.textContent = "Light or dark";
  wrap.append(heading);

  const rows = document.createElement("div");
  rows.className = "rows";
  for (const mode of MODES) {
    const row = document.createElement("label");
    row.className = "srow2 themerow";
    row.htmlFor = `mode-${mode.name}`;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "mode";
    radio.id = `mode-${mode.name}`;
    radio.className = "srow2--lead";
    radio.checked = mode.name === chosen;
    radio.addEventListener("change", () => {
      write(MODE_KEY, mode.name);
      // Applied under the click. A mode you have to reload to see is one nobody
      // tries twice, which is the same reason the palette applies immediately.
      applyMode(mode.name);
    });

    const label = document.createElement("span");
    label.className = "srow2--name";
    label.textContent = mode.label;
    const hint = document.createElement("span");
    hint.className = "srow2--hint";
    hint.textContent = mode.hint;

    row.append(radio, label, hint);
    rows.append(row);
  }
  wrap.append(rows);
  return wrap;
}

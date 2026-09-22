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
  TWEAK_KEYS,
  allThemeClasses,
  normalizeMode,
  normalizeTheme,
  normalizeTweaks,
  resolveDark,
  resolveDesign,
  themeClass,
  type ModeName,
  type ThemeName,
  type Tweaks,
} from "../core/theme.js";

/**
 * Fired on `window` when a tweak changes, so the list can redraw itself.
 *
 * An event rather than a call: this panel is drawn in **two** documents — the
 * options page and the popup's Appearance menu — and only one of them has a
 * list of deadlines to redraw. Importing the popup's `app` here would make the
 * settings page import the popup's state module, whose first line reaches for
 * `#view`.
 */
export const TWEAKS_EVENT = "illini-dash:tweaks";

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

/**
 * Where the design was stored while there were four of them.
 *
 * Read and thrown away by `resolveDesign`, never written: a device that chose
 * `rams` or Plain last week opens on Classical like every other device, and the
 * key is left alone rather than cleared so nothing has to run a cleanup pass.
 */
const DESIGN_KEY = "illini-dash.design";

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
  // One design, always set. `core/theme.ts` owns the value and the migration
  // off the three stubs; this line is the only place it reaches the document.
  root.dataset.design = resolveDesign(read(DESIGN_KEY));
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
     * Three swatches per row: the palette's identity and its canvas.
     *
     * A course colour is data, not identity. Using `--course-1` here made the
     * Illini preview brown and High contrast green, even though neither hue
     * described the choice. These preview roles live with the palette values
     * in ui.css and stay independent of whichever theme paints the page.
     */
    const swatches = document.createElement("span");
    swatches.className = `swatches ${themeClass(theme.name)}`;
    if (document.documentElement.classList.contains(DARK_CLASS)) {
      swatches.classList.add(DARK_CLASS);
    }
    for (const token of ["--preview-brand", "--preview-accent", "--preview-canvas"]) {
      const chip = document.createElement("i");
      chip.style.background = `var(${token})`;
      swatches.append(chip);
    }

    row.append(radio, label, hint, swatches);
    rows.append(row);
  }
  host.append(rows);
  host.append(renderModePanel());
  host.append(renderTweakPanel());
}

/** The stored tweaks, or their defaults. Never throws. */
export function storedTweaks(): Tweaks {
  return normalizeTweaks({
    urgencyEdge: read(TWEAK_KEYS.urgencyEdge),
    // D14, flipped off 2026-09-19 ("there's just too much information being
    // shown"). The toggle stays, so it can be turned back on; only the
    // unset case changes, and `normalizeTweaks` still owns the parsing —
    // `"false"` goes in where nothing is stored rather than a second
    // default living beside `DEFAULT_TWEAKS`.
    showSourceNames: read(TWEAK_KEYS.showSourceNames),
  });
}

/**
 * Two switches for the rows themselves (brief D14).
 *
 * Here rather than in Settings for the reason `core/theme.ts` states: neither
 * carries meaning. A tweak that could hide a deadline would be the colour
 * picker's failure with a checkbox in front of it, and this panel is the one
 * place where "it only changes how it looks" is the entry requirement.
 *
 * Real `<input type="checkbox">` elements, like the radios above: two
 * independent switches are what a checkbox is, and a div would mean
 * reimplementing the label association, the space key and the announcement.
 */
function renderTweakPanel(): HTMLElement {
  const current = storedTweaks();
  const wrap = document.createElement("div");

  const heading = document.createElement("h3");
  heading.textContent = "Deadline rows";
  wrap.append(heading);

  const rows = document.createElement("div");
  rows.className = "rows";
  const switches: { key: keyof Tweaks; label: string; hint: string }[] = [
    {
      key: "urgencyEdge",
      label: "Urgency edge",
      hint: "A colour bar down the left of each row, in the course's colour",
    },
    {
      key: "showSourceNames",
      label: "Source names",
      hint: "Say which site each deadline came from",
    },
  ];
  for (const one of switches) {
    const row = document.createElement("label");
    row.className = "srow2 themerow";
    row.htmlFor = `tweak-${one.key}`;

    const box = document.createElement("input");
    box.type = "checkbox";
    box.id = `tweak-${one.key}`;
    box.className = "srow2--lead";
    box.checked = current[one.key];
    box.addEventListener("change", () => {
      write(TWEAK_KEYS[one.key], String(box.checked));
      // Applied under the click, like the palette and the mode. The list is in
      // another part of the document — and on the options page, in another
      // document entirely — so the change is announced rather than called.
      window.dispatchEvent(new Event(TWEAKS_EVENT));
    });

    const label = document.createElement("span");
    label.className = "srow2--name";
    label.textContent = one.label;
    const hint = document.createElement("span");
    hint.className = "srow2--hint";
    hint.textContent = one.hint;

    row.append(box, label, hint);
    rows.append(row);
  }
  wrap.append(rows);
  return wrap;
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

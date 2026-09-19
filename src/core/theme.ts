/**
 * Which colour scheme the interface uses.
 *
 * A display preference for one device, like the open tab and the course chips —
 * so it lives in `localStorage` rather than the store. That is not laziness: it
 * has to be readable *before the first paint*, and anything in the store costs
 * a message round trip to the service worker, which is a flash of the wrong
 * colours on every open.
 *
 * Three presets rather than a colour picker, and the reason is that colour here
 * carries meaning. Red is overdue, amber is a window still open, green is a
 * source that answered — a free picker lets someone choose a scheme in which
 * two of those are the same colour, and the result looks fine and lies.
 */

export type ThemeName = "illini" | "neutral" | "contrast";

export const THEMES: { name: ThemeName; label: string; hint: string }[] = [
  {
    name: "illini",
    label: "Illini",
    hint: "Illini Blue and Orange",
  },
  {
    name: "neutral",
    label: "Neutral",
    hint: "Grey, with colour only where it means something",
  },
  {
    name: "contrast",
    label: "High contrast",
    hint: "Stronger text, and course colours chosen to stay apart for colour blindness",
  },
];

export const DEFAULT_THEME: ThemeName = "illini";

/** The key, shared by the popup and the options page — one origin, one setting. */
export const THEME_KEY = "illini-dash.theme";

export function isThemeName(value: unknown): value is ThemeName {
  return THEMES.some((theme) => theme.name === value);
}

/**
 * The stored name, or the default.
 *
 * Anything unrecognised falls back rather than throwing: a value written by a
 * later build, or edited by hand, must not leave the page unstyled.
 */
export function normalizeTheme(stored: unknown): ThemeName {
  return isThemeName(stored) ? stored : DEFAULT_THEME;
}

/** The class the stylesheet keys on. */
export function themeClass(name: ThemeName): string {
  return `theme-${name}`;
}

/** Every class a theme could have set, so switching removes the old one. */
export function allThemeClasses(): string[] {
  return THEMES.map((theme) => themeClass(theme.name));
}

/* -------------------------------------------------------------------------- */
/* Light or dark                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Light, dark, or whatever the machine says — and the last one is the default.
 *
 * The palette and the mode are two separate choices. "Illini" describes which
 * hues carry meaning; "dark" describes which end of the range they sit at. They
 * were one setting only because the mode was never a setting at all: every dark
 * value lived behind `@media (prefers-color-scheme: dark)`, so a student on a
 * dark machine could not have a light calendar and one on a light machine could
 * not have a dark one.
 *
 * `system` stays the default because it is right almost always, and because it
 * is the only value that keeps following the machine after the student stops
 * thinking about it.
 */
export type ModeName = "system" | "light" | "dark";

export const MODES: { name: ModeName; label: string; hint: string }[] = [
  { name: "system", label: "Match my system", hint: "Follows your computer's light or dark setting" },
  { name: "light", label: "Light", hint: "Always light, whatever the computer says" },
  { name: "dark", label: "Dark", hint: "Always dark, whatever the computer says" },
];

/**
 * Light, since the redesign (2026-09-19). The mocks Sushi approved are light —
 * pale blue ground, white cards — and there is no dark version of them yet;
 * a dark machine opening on "system" got the pre-redesign dark palette and
 * read as "you didn't match the colour scheme at all". The popup opens on the
 * design; Appearance › Dark is one press away.
 */
export const DEFAULT_MODE: ModeName = "light";

/** Its own key: changing the palette must not reset the mode, or the reverse. */
export const MODE_KEY = "illini-dash.mode";

export function isModeName(value: unknown): value is ModeName {
  return MODES.some((mode) => mode.name === value);
}

export function normalizeMode(stored: unknown): ModeName {
  return isModeName(stored) ? stored : DEFAULT_MODE;
}

/**
 * Which end of the range to actually paint, given the choice and the machine.
 *
 * The stylesheet keys on **one class**, `is-dark`, rather than on a media
 * query. A media query cannot be overridden by a setting without writing every
 * dark value twice — once inside it and once for the forced case — and two
 * copies of a palette is the failure `docs/colour-layer.md` rule 3 is about.
 * Resolving it here means the media query is consulted once, in one place, and
 * the answer is a class.
 */
export function resolveDark(mode: ModeName, systemPrefersDark: boolean): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return systemPrefersDark;
}

/** The class the stylesheet keys on for the dark end of every palette. */
export const DARK_CLASS = "is-dark";

/* -------------------------------------------------------------------------- */
/* Tweaks (brief D14)                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Two switches in the theme panel, and neither carries meaning.
 *
 * That is the test they had to pass to live beside the palette rather than in
 * Settings: the palette comment above says a free colour picker "lets someone
 * choose a scheme in which two of those are the same colour, and the result
 * looks fine and lies". A tweak that could hide a deadline would be the same
 * defect with a checkbox in front of it.
 *
 * - `urgencyEdge` adds a 4px course-hue edge to each row. The mock's own note
 *   says urgency is carried by *text* — "in 4h", red once it is past — so the
 *   edge is decoration, and off by default because it turns a list of white
 *   cards into eight competing colours.
 * - `showSourceNames` adds the "· Gradescope" to every row. Off by default
 *   since 2026-09-19 (Sushi: "there's just too much information being shown");
 *   who said so is one click away on the deadline screen, and the toggle
 *   stays for a student who wants it on every row.
 *
 * `localStorage`, like the theme and the mode, and for the same two reasons:
 * they are per-device display preferences, and they have to be readable before
 * the first paint — anything in the store costs a round trip to the worker,
 * which is a visible flash of the other layout on every open.
 */
export interface Tweaks {
  urgencyEdge: boolean;
  showSourceNames: boolean;
}

export const DEFAULT_TWEAKS: Tweaks = { urgencyEdge: false, showSourceNames: false };

/**
 * One key per tweak, like `THEME_KEY` and `MODE_KEY`.
 *
 * Not one JSON blob: a blob means every write re-states every other value, so
 * two pages open at once silently undo each other's change — and a blob that
 * fails to parse takes both settings with it rather than one.
 */
export const TWEAK_KEYS: Record<keyof Tweaks, string> = {
  urgencyEdge: "illini-dash.tweak.urgencyEdge",
  showSourceNames: "illini-dash.tweak.showSourceNames",
};

/**
 * The stored values, or the defaults — never a throw and never `undefined`.
 *
 * Same contract as `normalizeMode`: a value written by a later build, edited by
 * hand, or lost to a cleared origin must not leave the page unstyled. The
 * accepted forms are `true`/`false` and the strings `"true"`/`"false"`, because
 * `localStorage` returns strings and a caller that forgot to parse is the
 * likelier mistake than one that passed a boolean.
 *
 * **Anything else falls back to the default rather than to `false`.**
 * `Boolean(stored)` would read a missing `urgencyEdge` as "off" whatever the
 * default said, and a stored `"yes"` as "on" — the defect worker rule 8
 * describes, one origin over: a stored value is data from another build, not a
 * typed object.
 */
export function normalizeTweaks(stored: Partial<Record<keyof Tweaks, unknown>>): Tweaks {
  const read = (key: keyof Tweaks): boolean => {
    const value = stored[key];
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return DEFAULT_TWEAKS[key];
  };
  return { urgencyEdge: read("urgencyEdge"), showSourceNames: read("showSourceNames") };
}

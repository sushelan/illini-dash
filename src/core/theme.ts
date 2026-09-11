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

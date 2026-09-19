/**
 * One icon set, drawn as inline SVG.
 *
 * What it replaces: `⚙`, `⤢`, `⋯`, `‹`, `›`, `▸` — text glyphs standing in for
 * icons. Three things are wrong with that and only the third is cosmetic. A
 * glyph is whatever the installed font has, so it differs per machine and can
 * be missing entirely; it sits on the text baseline, so it never aligns with
 * the label beside it; and it has no hit area of its own, so the target is
 * however wide the character happens to be.
 *
 * **Built with `createElementNS`, never from a markup string.** §8.1's
 * rendering rule is that nothing is inserted as markup on these pages — the
 * rule exists for source-derived text, but keeping one rendering path means
 * there is no `innerHTML` anywhere for a later change to reach for. The tab
 * icons were already drawn this way; this generalises them.
 *
 * Every icon is a 16×16 viewBox, 1.5 stroke, round caps, `currentColor`, and
 * `aria-hidden`. The name goes on the *button* as a `title` and an
 * `aria-label`, never on the SVG: a title inside an SVG is announced
 * inconsistently and shows a tooltip over the glyph rather than over the
 * control.
 */

const NS = "http://www.w3.org/2000/svg";

/**
 * The paths. One entry per icon, so adding one is a line rather than a file.
 *
 * `tab-*` are the five view icons, which the popup drew from its own table
 * before this existed. Kept on the same grid as the rest so a tab icon and a
 * header icon are the same weight.
 */
export const ICON_PATHS = {
  /**
   * Export to a calendar file.
   *
   * A calendar outline with an arrow leaving it downward, rather than a bare
   * download tray: the tray says "a file arrives" and says nothing about what
   * is in it, and this button sits beside a sync icon and a tab icon that both
   * already mean "something moves". The month tab glyph is deliberately not
   * reused — the tab switches a view, this one produces a file.
   */
  "calendar-out":
    "M5 1.5v2.5M11 1.5v2.5M2 6.5h12M2.5 3.5h11a.5.5 0 0 1 .5.5v3.5M2.5 3.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h6M12 9.5V15m0 0 2-2m-2 2-2-2",
  sync: "M14 4v3.5h-3.5M2 12V8.5h3.5M3.6 6.6a5.5 5.5 0 0 1 9.2-1.6M12.4 9.4a5.5 5.5 0 0 1-9.2 1.6",
  "open-tab": "M9 2.5h4.5V7M13 3 8 8M12 9.5V13a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 3 13V5a.5.5 0 0 1 .5-.5H7",
  settings:
    "M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 1.8l.9 1.6 1.8-.3.5 1.8 1.6.9-.9 1.6.9 1.6-1.6.9-.5 1.8-1.8-.3L8 14.2l-.9-1.6-1.8.3-.5-1.8-1.6-.9.9-1.6-.9-1.6 1.6-.9.5-1.8 1.8.3z",
  more: "M3.5 8h.01M8 8h.01M12.5 8h.01",
  left: "M10 3 5 8l5 5",
  right: "M6 3l5 5-5 5",
  down: "M3.5 6 8 10.5 12.5 6",
  check: "M3 8.5 6.5 12 13 4.5",
  warning: "M8 2.5 14.5 13.5h-13zM8 6.5v3M8 11.8h.01",
  info: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 7.5v3.5M8 5.2h.01",
  bell: "M8 2a3.5 3.5 0 0 0-3.5 3.5c0 2.6-1 3.5-1 3.5h9s-1-.9-1-3.5A3.5 3.5 0 0 0 8 2zM6.8 12a1.3 1.3 0 0 0 2.4 0",
  pin: "M6 2h4M8 2v5M4.5 12h7l-1.6-3.4a1 1 0 0 1-.1-.4V7h-3.6v1.2a1 1 0 0 1-.1.4zM8 12v2.5",
  plus: "M8 3.5v9M3.5 8h9",
  close: "M4 4l8 8M12 4l-8 8",
  /* Chrome's extensions menu, so the pin card can point at the real thing. */
  puzzle:
    "M6.5 2.2a1.7 1.7 0 0 1 3 0c0 .5-.2.9-.2 1.3h2.6a.6.6 0 0 1 .6.6v2.6c.4 0 .8-.2 1.3-.2a1.7 1.7 0 0 1 0 3c-.5 0-.9-.2-1.3-.2v2.6a.6.6 0 0 1-.6.6H9.3c0-.4.2-.8.2-1.3a1.7 1.7 0 0 0-3 0c0 .5.2.9.2 1.3H4.1a.6.6 0 0 1-.6-.6V9.3c-.4 0-.8.2-1.3.2a1.7 1.7 0 0 1 0-3c.5 0 .9.2 1.3.2V4.1a.6.6 0 0 1 .6-.6h2.6c0-.4-.2-.8-.2-1.3z",
  /* ---- the exam board's metadata glyphs (Classical exams view) ----
   *
   * The mock sets a Material Symbol beside every fact on an exam card —
   * `schedule` for the sitting, `pin_drop` for the room, `check_circle` for a
   * source the extension actually read the booking from. These are those three
   * on this file's own 16×16 / 1.5-stroke grid, so an exam card's glyphs are
   * the same weight as the tab strip's. `tab-day` doubles as the mock's
   * `date_range` (a booking window is a range of days) and `warning` as its
   * `notification_important`; neither needed a new path.
   */
  clock: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 4.7V8l2.3 1.5",
  verified: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM5.4 8.1 7.2 10l3.4-3.6",
  place:
    "M8 14.4c2.6-3 4.2-5.3 4.2-7.3a4.2 4.2 0 1 0-8.4 0c0 2 1.6 4.3 4.2 7.3zM9.5 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z",
  "tab-day": "M3 4h10v9H3zM3 7h10M5 2v2M11 2v2M5.5 10h5",
  "tab-week": "M2 4h12v8H2zM6 4v8M10 4v8M2 7h12",
  "tab-month": "M3 4h10v9H3zM3 7h10M6 2v2M10 2v2M6 10h1M9 10h1",
  "tab-exams": "M4 2h8v12H4zM6 5h4M6 8h4M6 11h2",
  /* The No date tab. The month glyph with its dates struck out: the day is a
     box that stayed empty, which is exactly what the tab holds. */
  "tab-nodate": "M3 4h10v9H3zM3 7h10M6 2v2M10 2v2M6.5 9.5l3 3M9.5 9.5l-3 3",
} as const;

/**
 * The open book, the Classical design's mark — on a 24 grid, not this file's 16.
 *
 * Kept out of `ICON_PATHS` deliberately. Every entry there is a 16×16 viewBox
 * by contract (`icon()` hard-codes it), and these two paths are the spec's own
 * coordinates on a 24 box; putting them in the table would mean either
 * rewriting the curves — which is how a mark stops being the mark — or leaving
 * a member of the table that `icon()` draws wrong. They are a pair, they are
 * only ever drawn together, and `bookMark()` is the only thing that reads them.
 *
 * Verbatim from `docs/design/classical-spec.md` §2: two leaves meeting at a
 * spine, stroked in `currentColor` so the bar's ink carries it (navy in light,
 * the gold accent in dark).
 */
const BOOK_PATHS = [
  "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z",
  "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
] as const;

export type IconName = keyof typeof ICON_PATHS;

/**
 * An `<svg>` for `name`, sized by CSS rather than by an attribute.
 *
 * `width`/`height` are set so the element has an intrinsic size before the
 * stylesheet loads — a bare `<svg>` with only a viewBox lays out at 300×150,
 * which is a visible jump on a popup that opens and paints in one frame.
 */
export function icon(name: IconName): SVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  // The name lives on the control, not here. See the module comment.
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("icon");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", ICON_PATHS[name]);
  svg.append(path);
  return svg;
}

/**
 * An icon-only button: 28×28, labelled for anyone who cannot see the glyph.
 *
 * The label is mandatory rather than optional. An icon button with no
 * accessible name is a button that screen readers announce as "button", and
 * every icon button in this project was previously either a `<a>` with a glyph
 * inside it or a `<button>` whose only content was `⋯`.
 */
export function iconButton(name: IconName, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-icon";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.append(icon(name));
  return button;
}

/**
 * The app mark: the squircle, the orange bar and the check (D9, mock 1a/2a).
 *
 * The one graphic in this project that is not `currentColor` — it is an
 * identity, so the fill has to be the same shape in every theme rather than
 * whatever colour the surrounding text happens to be. Both values are tokens:
 * `--brand-mark` is a real ink in all six theme/mode combinations (navy-orange
 * in light Illini, the accent in dark, plain `--fg` in Neutral and
 * High-contrast), and `--surface-raised` is the card colour, so the bar and the
 * check read as cut out of the square rather than painted on it.
 *
 * Drawn with `createElementNS` like every other icon here, never from a markup
 * string: §8.1's rendering rule is that nothing on these pages is inserted as
 * markup, and keeping one path means there is no `innerHTML` for a later change
 * to reach for.
 */
export function appMark(): SVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 128 128");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("appmark");

  const plate = document.createElementNS(NS, "rect");
  plate.setAttribute("width", "128");
  plate.setAttribute("height", "128");
  plate.setAttribute("rx", "26");
  plate.setAttribute("fill", "var(--brand-mark)");

  const bar = document.createElementNS(NS, "rect");
  bar.setAttribute("x", "22");
  bar.setAttribute("y", "34");
  bar.setAttribute("width", "84");
  bar.setAttribute("height", "20");
  bar.setAttribute("rx", "10");
  bar.setAttribute("fill", "var(--surface-raised)");
  bar.setAttribute("opacity", "0.62");

  const tick = document.createElementNS(NS, "path");
  tick.setAttribute("d", "M30 84 L52 104 L100 62");
  tick.setAttribute("fill", "none");
  tick.setAttribute("stroke", "var(--surface-raised)");
  tick.setAttribute("stroke-width", "17");
  tick.setAttribute("stroke-linecap", "round");
  tick.setAttribute("stroke-linejoin", "round");

  svg.append(plate, bar, tick);
  return svg;
}

/**
 * The Classical bar's mark: the book glyph, 16px, in the bar's own ink.
 *
 * A second function rather than a branch inside `appMark()`, because that mark
 * is shared with the options page and the full view's own chrome and none of
 * those is being restyled this pass — a branch there would move a graphic on
 * three surfaces to fix one.
 *
 * Both are rendered, always, and the stylesheet picks: `design-classical-shell.css`
 * hides this one by default and swaps the pair under
 * `html[data-design="classical"]`. The alternative was asking
 * `dataset.design` here, and the design picker changes that attribute without
 * redrawing the popup — so the wrong mark would stay on screen until something
 * else happened to redraw the header.
 *
 * `currentColor`, unlike `appMark`: this is a line drawing that sits in a bar
 * of navy type and reads as part of it, and the dark half of the palette has
 * no navy at all.
 */
export function bookMark(): SVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("appmark-book");
  for (const d of BOOK_PATHS) {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

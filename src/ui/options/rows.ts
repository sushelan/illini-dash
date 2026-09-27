/**
 * The row builders Settings draws everything but the course list with.
 *
 * They lived inside `ui/options.ts`, which needs a worker, `chrome.*` and a
 * browser to run at all, so nothing a row *is* could be asserted: that two
 * buttons on one row share a cell, that a time box has a name, where a refusal
 * lands. Moved here (2026-09-27) for the same reason `course-sites.ts` was:
 * `tests/options-dom.test.ts` builds these over a linkedom document.
 */

import { el } from "./dom.js";

/*
 * Every class a test or a stylesheet looks for, in one place (UI house rule 7).
 *
 * Labels are tied with `setAttribute("for", …)` rather than `.htmlFor`: the
 * two are the same thing in Chrome, and only the attribute is visible to the
 * linkedom document the DOM test asserts over.
 */
export const ROW_CLASS = "srow2";
export const ROW_NAME_CLASS = "srow2--name";
export const ROW_HINT_CLASS = "srow2--hint";
export const ROW_LEAD_CLASS = "srow2--lead";
/**
 * The trailing cell for a row with more than one button.
 *
 * `public/ui.css` places every `.srow2 > .btn` in column 4, rows 1–2 — so two
 * bare buttons on one row are drawn in the *same* cell, one over the other.
 * That is how Unhide came to be painted under Trash on a hand-typed hidden row
 * (options-live #1: `elementFromPoint` at Unhide's centre returned Trash, and
 * Trash is the irreversible one). The rule for this class was already written;
 * the tidy row never used it.
 */
export const ROW_ACTIONS_CLASS = "srow2--actions";
/** A hint that is carrying a refusal rather than a caption. */
export const ROW_REFUSAL_CLASS = "is-refusal";

/**
 * One settings row: a switch, a name, a line saying what it is.
 *
 * A real `<input type="checkbox">` under a real `<label for>`. `onChange` gets
 * the box too, so a refusal can put it back.
 */
export function switchRow(options: {
  name: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean, box: HTMLInputElement) => void;
}): HTMLElement {
  const row = el("div", undefined, ROW_CLASS);
  const box = el("input");
  box.type = "checkbox";
  box.className = `switch ${ROW_LEAD_CLASS}`;
  box.checked = options.checked;
  box.disabled = options.disabled === true;
  box.id = nextId("sw");

  const label = el("label", options.name, ROW_NAME_CLASS);
  label.setAttribute("for", box.id);
  box.addEventListener("change", () => options.onChange(box.checked, box));

  row.append(box, label);
  if (options.hint) row.append(el("span", options.hint, ROW_HINT_CLASS));
  return row;
}

/** A plain row with no switch — a course that was set aside, a hidden item. */
export function plainRow(name: string, hint?: string): HTMLElement {
  const row = el("div", undefined, ROW_CLASS);
  // An empty cell where the switch would be, so a row with a switch and a row
  // without line up down the list.
  row.append(el("span", undefined, ROW_LEAD_CLASS), el("span", name, ROW_NAME_CLASS));
  if (hint) row.append(el("span", hint, ROW_HINT_CLASS));
  return row;
}

let idSeq = 0;
function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

/**
 * A writer for the sentence on this row: its own hint line, created if the row
 * has none. The caption it replaces comes back on the next redraw.
 *
 * Looked up from any element on the row, so a control inside a wrapper (the
 * tidy row's actions cell) still finds its row's hint — `parentElement` would
 * have found the wrapper and written nowhere.
 */
export function rowNote(from: Element): (text: string) => void {
  return (text) => {
    const row = from.closest(`.${ROW_CLASS}`) ?? from;
    let hint = row.querySelector<HTMLElement>(`.${ROW_HINT_CLASS}`);
    if (!hint) {
      hint = el("span", undefined, ROW_HINT_CLASS);
      row.append(hint);
    }
    hint.textContent = text;
    hint.classList.toggle(ROW_REFUSAL_CLASS, text !== "");
  };
}

/**
 * One hidden or ticked-off item, with its buttons.
 *
 * One button stays a direct child of the row, the way every other one-button
 * row is drawn. Two go into one `.srow2--actions` cell, which lays them out
 * side by side.
 */
export function tidyRow(
  item: { title: string; courseLabel?: string },
  buttons: { undo: HTMLElement; trash?: HTMLElement },
): HTMLElement {
  const row = plainRow(item.title, item.courseLabel);
  if (buttons.trash === undefined) {
    row.append(buttons.undo);
    return row;
  }
  const actions = el("span", undefined, ROW_ACTIONS_CLASS);
  actions.append(buttons.undo, buttons.trash);
  row.append(actions);
  return row;
}

/* ---- Quiet hours ---------------------------------------------------------- */

export type QuietHoursReading =
  | { ok: true; start: number; end: number }
  | { ok: false; message: string };

export const QUIET_HOURS_INCOMPLETE = "Quiet hours need a start and an end.";

/**
 * Reads the two clocks as whole hours.
 *
 * `Number("")` is 0, which is a legitimate hour, so a cleared box would
 * silently become midnight and narrow the window rather than being rejected.
 * `<input type=time>` can still be empty, so the shape is checked positively
 * (parser rule 5).
 */
export function readQuietHours(from: string, to: string): QuietHoursReading {
  const hour = (value: string): number | undefined => {
    const match = /^(\d{2}):\d{2}(?::\d{2})?$/.exec(value);
    if (!match) return undefined;
    const n = Number(match[1]);
    return n >= 0 && n <= 23 ? n : undefined;
  };
  const start = hour(from);
  const end = hour(to);
  if (start === undefined || end === undefined) {
    return { ok: false, message: QUIET_HOURS_INCOMPLETE };
  }
  return { ok: true, start, end };
}

/** "23:00" for 23. */
export function clockValue(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * The two time boxes, each with a name a screen reader can say.
 *
 * They sat between two `opt-note` spans reading "from" and "to" and had no
 * accessible name at all (a11y #9: `INPUT.field name=""`). The words are
 * `<label for>` now, so pressing "from" focuses the box, and each box also
 * carries a full `aria-label`, because "from" alone does not say from what.
 */
export function quietHoursFields(quiet: { start: number; end: number }): {
  cell: HTMLElement;
  from: HTMLInputElement;
  to: HTMLInputElement;
} {
  const cell = el("span", undefined, "row-actions");
  cell.style.margin = "0";
  const field = (value: number, word: string, name: string): HTMLInputElement => {
    const input = el("input", undefined, "field") as HTMLInputElement;
    input.type = "time";
    input.step = "3600";
    input.value = clockValue(value);
    input.id = nextId("quiet");
    input.setAttribute("aria-label", name);
    const label = el("label", word, "opt-note");
    label.setAttribute("for", input.id);
    cell.append(label, input);
    return input;
  };
  const from = field(quiet.start, "from", "Quiet hours start");
  const to = field(quiet.end, "to", "Quiet hours end");
  return { cell, from, to };
}

/* ---- How often to sync ---------------------------------------------------- */

/**
 * The poll interval's row: a name that is the select's `<label for>`, and the
 * select.
 *
 * The name was a `<span>`, so the select was announced as an unnamed combobox
 * named only by whichever option was showing (a11y #9). The words are the
 * footer button's — “Sync now” — rather than “Check for changes”, which named
 * the same action a third way (copy-audit #14).
 */
export function pollRow(
  options: readonly { value: number; text: string }[],
  selected: number,
): { row: HTMLElement; select: HTMLSelectElement } {
  const row = el("div", undefined, ROW_CLASS);
  const select = el("select", undefined, "field") as HTMLSelectElement;
  select.id = nextId("poll");
  for (const option of options) {
    const node = document.createElement("option");
    node.value = String(option.value);
    node.textContent = option.text;
    node.selected = option.value === selected;
    select.append(node);
  }
  const name = el("label", "How often to sync", ROW_NAME_CLASS);
  name.setAttribute("for", select.id);
  row.append(
    el("span"),
    name,
    el("span", "Opening the popup also syncs, at most once every five minutes.", ROW_HINT_CLASS),
    select,
  );
  return { row, select };
}

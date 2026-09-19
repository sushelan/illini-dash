/**
 * The month grid. Full view only, for now.
 *
 * D6 gives the popup a month of its own — seven columns of dots, one per
 * deadline in the course hue, tapping a day lists it underneath — and leaves
 * this renderer to the tab, which is the one window with the width for titles.
 */

import {
  type PlacedItem,
  MONTH_CELL_ROWS,
  dayKey,
  itemTone,
  monthCells,
  startOfDay,
} from "../../../core/calendar.js";
import { courseLabel } from "../../../core/names.js";
import { iconButton } from "../../icons.js";
import type { Item } from "../../../sources/types.js";
import {
  UNTIMED_NOTE,
  VIEW_KEY,
  anchorDate,
  app,
  state,
  viewEl,
  writeStored,
} from "../state.js";
import { clockOf } from "../rows.js";
import { openRowMenu } from "../shell.js";
import { openAddEditor } from "../screens/editor.js";

export function renderMonthView(items: Item[], now: Date, colours: Map<string, number>): void {
  const anchor = anchorDate(now);
  const head = document.createElement("div");
  head.className = "mhead";
  for (let i = 0; i < 7; i += 1) {
    const label = document.createElement("div");
    label.textContent = startOfDay(new Date(2026, 8, 6), i).toLocaleDateString(undefined, {
      weekday: "short",
    });
    head.append(label);
  }

  const grid = document.createElement("div");
  grid.className = "mgrid";
  for (const cell of monthCells(items, anchor, now)) {
    const box = document.createElement("div");
    box.className = "mcell";
    if (!cell.inMonth) box.classList.add("mcell--out");
    if (cell.isToday) box.classList.add("mcell--today");

    const num = document.createElement("div");
    num.className = "mnum";
    num.textContent = String(cell.date.getDate());

    /*
     * The "+" at the head of the cell, and a press on the empty part of it.
     *
     * Positioned rather than placed inside `.mnum`: today's number is a 24px
     * circle with `place-items: center`, and a second child in it would push
     * the date out of its own ring.
     *
     * The form itself opens at the top of the view rather than inside the cell.
     * A month cell is about 100px tall and a seventh of the window wide, so a
     * form in it would push six other weeks off the screen to show three
     * truncated fields.
     */
    const addDay = iconButton(
      "plus",
      `Add something on ${cell.date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })}`,
    );
    addDay.classList.add("btn-sm", "madd");
    const addOnThisDay = (): void => openAddEditor({ values: { date: dayKey(cell.date) } });
    addDay.addEventListener("click", (event) => {
      event.stopPropagation();
      addOnThisDay();
    });
    box.addEventListener("click", (event) => {
      if (event.target !== box) return;
      addOnThisDay();
    });
    box.append(num, addDay);

    for (const placed of cell.items.slice(0, MONTH_CELL_ROWS)) {
      box.append(renderMonthPill(placed, now, colours));
    }
    if (cell.items.length > MONTH_CELL_ROWS) {
      const more = document.createElement("button");
      more.className = "mmore";
      more.textContent = `+${cell.items.length - MONTH_CELL_ROWS} more`;
      more.addEventListener("click", () => {
        // The day view is where the rest fits, so go there rather than growing
        // a cell that would push five other weeks off the screen.
        state.dayOffset = Math.round(
          (cell.date.getTime() - startOfDay(now).getTime()) / 86_400_000,
        );
        state.view = "day";
        writeStored(VIEW_KEY, state.view);
        void app.refresh();
      });
      box.append(more);
    }
    grid.append(box);
  }
  viewEl.append(head, grid);
}

/**
 * A month cell is 100px, so a pill is a course code and as much title as fits.
 *
 * Truncation is deliberate here: three recognisable rows beat one complete one,
 * because the question a month answers is "which days are heavy", and the full
 * title is one click away in the day view.
 */
function renderMonthPill(
  placed: PlacedItem,
  now: Date,
  colours: Map<string, number>,
): HTMLElement {
  const { item, anchor } = placed;
  const pill = document.createElement("div");
  pill.className = `mpill course-${colours.get(item.courseLabel) ?? 0}`;
  if (item.kind === "event") pill.classList.add("mpill--event");
  else if (item.kind === "exam") pill.classList.add("mpill--exam");
  if (anchor.opening) pill.classList.add("mpill--opening");
  if (anchor.assumed) pill.classList.add("mpill--untimed");
  // The same tone the list uses. Without it a month of finished work looked
  // exactly like a month of work still owed, which is the one question a month
  // is for.
  const tone = itemTone(item, now);
  if (tone !== "open") pill.classList.add(`mpill--${tone}`);

  const code = document.createElement("span");
  code.className = "mpill--code";
  code.textContent = courseLabel(item.courseLabel, state.courseNames);
  const name = document.createElement("span");
  name.className = "mpill--name";
  name.textContent = item.title;
  pill.append(code, name);

  pill.title = anchor.assumed
    ? `${item.title} — ${UNTIMED_NOTE}`
    : `${item.title} — ${anchor.opening ? "opens " : ""}${clockOf(anchor.at)}`;

  /*
   * The pill opens the row menu, not the source.
   *
   * "For month, there's none of those options" — a beta report, and it was
   * exactly right: Mark done, Hide, Split and Merge were unreachable from the
   * month entirely, and so was the keyboard, because this was a `div` with a
   * click handler and no role.
   *
   * A `⋯` of its own does not fit. A month cell holds three pills and each is a
   * course code plus a title in the width of a seventh of the window; a control
   * beside that would take the title's remaining characters, and the title is
   * the only thing that says which assignment this is.
   *
   * So the pill *is* the control, and it costs one click on the open path
   * rather than removing it: `openRowMenu` leads with "Open in Gradescope",
   * which is the same destination this used to go to directly. That trade reads
   * the right way round for a month — it is the view you plan in, not the one
   * you work from, and everything else a student can do to a row was missing.
   */
  pill.setAttribute("role", "button");
  pill.tabIndex = -1;
  const open = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    openRowMenu(item, pill);
  };
  pill.addEventListener("click", open);
  pill.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") open(event);
  });
  return pill;
}

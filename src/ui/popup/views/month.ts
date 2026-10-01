/**
 * The month, in two drawings of the same month.
 *
 * The **full view** keeps the grid of titled pills below: a cell there is
 * ~100px wide and can carry three of them, which is what a month is for in a
 * window that has the width for it.
 *
 * The **popup** (D6, mock 2a) cannot carry a word in a seventh of 400px, so it
 * draws weight rather than titles — one 4px dot per deadline in the course hue,
 * capped at `MONTH_DOT_CAP` — and the titles live under the grid, for the one
 * day the student taps. That is what took `month` out of `FULL_VIEW_ONLY`: the
 * tab was full-view-only because of the pills, not because of the month.
 *
 * `renderMonthView` branches rather than the entry, so `popup.ts` has one line
 * for the month either way and the two drawings cannot drift apart about which
 * month they are on (both read `anchorDate`, both go through `monthCells`).
 */

import { DISPLAY_LOCALE } from "../../../core/dates.js";
import {
  type MonthDotCell,
  type PlacedItem,
  MONTH_CELL_ROWS,
  dayKey,
  dayList,
  itemTone,
  monthCells,
  monthDots,
  startOfDay,
} from "../../../core/calendar.js";
import { courseLabel } from "../../../core/names.js";
import { assumedTimeNote } from "../../../core/provenance.js";
import { icon, iconButton } from "../../icons.js";
import type { Item } from "../../../sources/types.js";
import {
  VIEW_KEY,
  anchorDate,
  app,
  isFullView,
  state,
  viewEl,
  writeStored,
} from "../state.js";
import { clockOf, emptyNote, renderRow } from "../rows.js";
import { makeRowsNavigable, openRowMenu } from "../shell.js";
import { openAddEditor } from "../screens/editor.js";

export function renderMonthView(items: Item[], now: Date, colours: Map<string, number>): void {
  if (!isFullView) {
    renderDotMonth(items, now, colours);
    return;
  }
  const anchor = anchorDate(now);
  const head = document.createElement("div");
  head.className = "mhead";
  for (let i = 0; i < 7; i += 1) {
    const label = document.createElement("div");
    label.textContent = startOfDay(new Date(2026, 8, 6), i).toLocaleDateString(DISPLAY_LOCALE, {
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
     * The form itself is the five-field panel over the list, carrying this
     * day, rather than anything inside the cell: a month cell is about 100px
     * tall and a seventh of the window wide, so a form in it would push six
     * other weeks off the screen to show three truncated fields.
     */
    const addDay = iconButton(
      "plus",
      `Add something on ${cell.date.toLocaleDateString(DISPLAY_LOCALE, {
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
        // The week is where the rest fits, so go there rather than growing a
        // cell that would push five other weeks off the screen. The week, not
        // Today: since D4 Today is anchored on now and reads no offset (R1
        // F100), while the week is drawn from `anchorDate`, which does.
        state.dayOffset = Math.round(
          (cell.date.getTime() - startOfDay(now).getTime()) / 86_400_000,
        );
        state.view = "week";
        writeStored(VIEW_KEY, state.view);
        void app.refresh();
      });
      box.append(more);
    }
    grid.append(box);
  }
  viewEl.append(head, grid);

  /*
   * Bring today into the window on the first draw of a month (popup-live #3).
   *
   * Handed to the draw as its scroll request rather than done here with
   * `scrollIntoView`: `render` applies `scrollPlan`'s offset *after* the view
   * is drawn (popup.ts, `applyScrollRequest`), and for a navigation that
   * offset is 0, so a scroll made here would be undone before anyone saw it.
   */
  const monthKey = `${anchor.getFullYear()}-${anchor.getMonth() + 1}`;
  const page = document.scrollingElement as HTMLElement | null;
  const todayBox = grid.querySelector<HTMLElement>(".mcell--today");
  // A draw must not throw into a console nobody has open, and a document with
  // no layout engine (linkedom) has no rect to read.
  const rect =
    todayBox && typeof todayBox.getBoundingClientRect === "function"
      ? todayBox.getBoundingClientRect()
      : undefined;
  const scrolled = page?.scrollTop ?? 0;
  const landing = todayLanding(
    monthKey,
    landedMonth,
    rect ? { top: rect.top + scrolled, height: rect.height } : undefined,
    state.scrollAfterDraw ?? scrolled,
    page?.clientHeight ?? innerHeight,
  );
  landedMonth = monthKey;
  if (landing !== undefined) state.scrollAfterDraw = landing;
}

/** The month the full view last drew, so a redraw of it never moves the window. */
let landedMonth: string | undefined;

/**
 * Where the full view should land so today's cell is on screen, or `undefined`
 * to leave the draw's own offset alone (popup-live #3).
 *
 * Even with auto-height rows, today in the fifth week of a month starts about
 * 720px down a 1000x700 window, so the month opened on weeks that are over.
 *
 * Only on the **first** draw of a month (`drawn !== last`) — opening the full
 * view, or stepping to another month. A store write, the minute tick or a Hide
 * redraws the same month, and moving the window then would move it under the
 * student (ZIP rule 1, and `scrollPlan`'s "a redraw keeps your place").
 *
 * `today.top` is the cell's offset in the document, and `landing` is where the
 * draw is about to put the window (`scrollPlan`'s answer, 0 for a navigation) —
 * not where it happens to be mid-draw, which is an offset about to be replaced.
 * A cell already inside that window is left where it is; otherwise it is
 * centred, as `scrollIntoView({ block: "center" })` would put it. The draw
 * clamps the answer to the document.
 */
export function todayLanding(
  drawn: string,
  last: string | undefined,
  today: { top: number; height: number } | undefined,
  landing: number,
  viewport: number,
): number | undefined {
  if (drawn === last || today === undefined) return undefined;
  if (today.top >= landing && today.top + today.height <= landing + viewport) return undefined;
  return today.top - (viewport - today.height) / 2;
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
    ? `${item.title} — ${assumedTimeNote(item)}`
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

/* -------------------------------------------------------------------------- */
/* The popup's month (D6, mock 2a)                                             */
/* -------------------------------------------------------------------------- */

/**
 * The day the student last tapped, as `YYYY-MM-DD`.
 *
 * Module scope rather than `state`, because nothing outside this view has any
 * business asking which day is outlined — and because a draw is not the right
 * place to forget it: six things redraw this page (a store write, the minute
 * tick, the popup's own open-sync), and a selection that survived none of them
 * would snap back to today under the student's finger.
 *
 * Ignored whenever it falls outside the month being shown, so ‹ › lands on the
 * sensible default rather than on a day that is not on screen.
 */
let selectedKey: string | undefined;

/**
 * Seven columns of dots, and the tapped day's list underneath.
 *
 * Every cell is a `<button>`: it is a control, so it answers Tab, Enter and
 * Space for free and announces itself with `aria-pressed`. A `<div>` with a
 * click handler is what the full view's pills were before the beta found them
 * unreachable by keyboard, and there is no reason to write that twice.
 */
function renderDotMonth(items: Item[], now: Date, colours: Map<string, number>): void {
  const anchor = anchorDate(now);
  const cells = monthDots(items, anchor, now);
  const inMonth = cells.filter((cell) => !cell.outside);
  /*
   * Today if it is on screen, else the 1st of the month being shown.
   *
   * Not "whatever was tapped last, wherever it is": the list under the grid is
   * headed "Tue, Sep 22", and a list from a month the grid is not showing is
   * the one thing a calendar must never do.
   */
  const todayCell = cells.find((cell) => cell.isToday && !cell.outside);
  const fallback = todayCell ?? inMonth[0];
  const selected =
    (selectedKey !== undefined
      ? inMonth.find((cell) => dayKey(cell.date) === selectedKey)
      : undefined) ?? fallback;

  /*
   * No "Full view ↗" here any more (2026-09-19).
   *
   * It used to be injected into the date navigator, after `.datenav--label`,
   * which put four things — the month's name, "Today", this, and the ‹ › pair —
   * on one 400px bar and jammed the arrows against the window's edge (Sushi:
   * "its squished"). It is now an icon button in the header bar beside +, ⋯ and
   * the gear (`renderActions`), which is where the window's other
   * whole-document controls already live, and it is on every tab rather than
   * only this one: the full view is useful from Week and Exams too, and being
   * Month-only was an accident of where there happened to be room.
   */
  const head = document.createElement("div");
  head.className = "mdow";
  // Sunday-first, one letter each, taken from a known Sunday — never a
  // hand-written "S M T W T F S", which is right in one locale and a lie in
  // every other.
  for (let i = 0; i < 7; i += 1) {
    const day = startOfDay(new Date(2026, 8, 6), i);
    const label = document.createElement("div");
    label.textContent = day.toLocaleDateString(DISPLAY_LOCALE, { weekday: "narrow" });
    label.title = day.toLocaleDateString(DISPLAY_LOCALE, { weekday: "long" });
    head.append(label);
  }

  const grid = document.createElement("div");
  grid.className = "mdots";
  grid.addEventListener("keydown", (event) => gridKeys(grid, event));
  const list = document.createElement("div");
  list.className = "mday-list";

  for (const cell of cells) {
    grid.append(
      renderDotCell(cell, colours, selected, (tapped) => {
        selectedKey = dayKey(tapped.date);
        /*
         * Repainted here rather than through `app.refresh()`.
         *
         * A refresh is a round trip to the worker and a redraw of the whole
         * document, and tapping a day changes nothing the worker knows about.
         * `makeRowsNavigable` runs again because the rows it was rolling have
         * just been replaced.
         */
        for (const other of grid.querySelectorAll<HTMLElement>(`.${MONTH_CELL_CLASS}`)) {
          const on = other.dataset["day"] === selectedKey;
          other.classList.toggle("mday--on", on);
          other.setAttribute("aria-pressed", String(on));
          other.tabIndex = on ? 0 : -1;
        }
        paintDayList(list, items, tapped, now, colours);
        makeRowsNavigable();
      }),
    );
  }

  viewEl.append(head, grid, renderLegend(cells, colours), list);
  if (selected) paintDayList(list, items, selected, now, colours);
}

/**
 * The key under the grid: one coloured dot and one course code per course the
 * grid is actually showing a dot for.
 *
 * A dot is 4px of colour with no text on it, so without this the grid says
 * "three things are due that week" and nothing about *which class* — which is
 * the question the colour was spent to answer. It is drawn from the cells
 * rather than from `items`, so the key names exactly the hues on screen and
 * cannot list a course whose only deadline is in another month.
 *
 * **Invariant: the set of hues the grid draws and the set of hues in this key
 * are the same set.** Pinned in `tests/popup-draw.test.ts`.
 *
 * It was not, until 2026-09-19: this loop began `if (cell.outside) continue`,
 * while `renderDotCell` draws dots on the leading and trailing days of the
 * neighbouring months too. August 2026 has no in-month deadline after the 31st,
 * so the grid drew one blue, three brown and a purple dot across Sep 1–3 and
 * the key underneath read "CS 425" alone — five colours on screen that nothing
 * accounted for (Sushi: "sometimes the month courses dont fully show up like
 * theres only one for august"). The trailing days are *kept* — "three things
 * are due the day after this month ends" is exactly what a student pages
 * forward to find out — so it is the filter that goes, not the dots.
 *
 * `cell.dots` and not `cell.more`: a capped cell says "+3" and draws no hue for
 * them, so a course that is only ever hidden behind a "+N" contributes no
 * colour to explain. The invariant is about what is *drawn*.
 *
 * Order is the colour index, not first appearance: the palette is assigned by
 * `courseIndex` and stays put for the whole term, so the key does too rather
 * than reshuffling itself every time the student pages to another month.
 */
function renderLegend(cells: MonthDotCell[], colours: Map<string, number>): HTMLElement {
  const seen = new Set<string>();
  for (const cell of cells) {
    for (const dot of cell.dots) seen.add(dot.courseLabel);
  }
  const legend = document.createElement("div");
  legend.className = "mlegend";
  const labels = [...seen].sort(
    (a, b) => (colours.get(a) ?? 99) - (colours.get(b) ?? 99) || a.localeCompare(b),
  );
  for (const label of labels) {
    const hue = colours.get(label);
    const entry = document.createElement("span");
    entry.className = hue === undefined ? "mlegend--item" : `mlegend--item course-${hue}`;
    const mark = document.createElement("span");
    mark.className = "mdot";
    const name = document.createElement("span");
    name.textContent = courseLabel(label, state.courseNames);
    entry.append(mark, name);
    legend.append(entry);
  }
  return legend;
}

/** The class every day cell carries, and the one the grid's keys look up (UI rule 7). */
export const MONTH_CELL_CLASS = "mday";

/**
 * The month grid's arrow keys (a11y review, 2026-09-27, #7).
 *
 * The grid was 35 Tab stops between the date strip and the first row, with no
 * arrows at all. Now it is one stop, and ← → move a day, ↑ ↓ a week, Home and
 * End go to the first and last day of the month being shown. Moving focus does
 * not pick the day — Enter and Space do, as they do on any button — so walking
 * across the month does not repaint the list under the grid at every step.
 */
export function gridKeys(grid: HTMLElement, event: KeyboardEvent): void {
  const cells = [...grid.querySelectorAll<HTMLElement>(`.${MONTH_CELL_CLASS}`)];
  const here = cells.indexOf(event.target as HTMLElement);
  if (here === -1) return;
  const inMonth = cells.filter((cell) => !cell.classList.contains("mday--out"));
  let next: HTMLElement | undefined;
  switch (event.key) {
    case "ArrowLeft":
      next = cells[here - 1];
      break;
    case "ArrowRight":
      next = cells[here + 1];
      break;
    case "ArrowUp":
      next = cells[here - 7];
      break;
    case "ArrowDown":
      next = cells[here + 7];
      break;
    case "Home":
      next = inMonth[0];
      break;
    case "End":
      next = inMonth[inMonth.length - 1];
      break;
    default:
      return;
  }
  // Past either edge of the grid the key does nothing — paging a month is ‹ ›'s job.
  event.preventDefault();
  if (!next) return;
  for (const cell of cells) cell.tabIndex = cell === next ? 0 : -1;
  next.focus();
}

function renderDotCell(
  cell: MonthDotCell,
  colours: Map<string, number>,
  selected: MonthDotCell | undefined,
  onPick: (cell: MonthDotCell) => void,
): HTMLElement {
  const box = document.createElement("button");
  box.type = "button";
  box.className = MONTH_CELL_CLASS;
  box.dataset["day"] = dayKey(cell.date);
  if (cell.outside) box.classList.add("mday--out");
  if (cell.isToday) box.classList.add("mday--today");
  const on = selected !== undefined && dayKey(selected.date) === dayKey(cell.date);
  if (on) box.classList.add("mday--on");
  box.setAttribute("aria-pressed", String(on));
  const named = cell.date.toLocaleDateString(DISPLAY_LOCALE, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const due = cell.dots.length + cell.more;
  // A dot is 4px and carries no text at all, so the cell has to say what it
  // means to somebody who cannot see it — and to anybody hovering it.
  //
  // The name as well as the title (2026-09-27): a button's accessible name
  // comes from its content, so the sentence in `title` never reached a screen
  // reader, which heard "30", "1", "27 +2" — not which month the leading 30
  // belongs to, and not what "+2" counts (a11y review #7).
  const sentence = due === 0 ? `${named} — nothing due` : `${named} — ${due} due`;
  box.title = sentence;
  box.setAttribute("aria-label", sentence);
  // One Tab stop for the grid, on the day the list below is showing; the
  // arrows walk the rest (`gridKeys`).
  box.tabIndex = on ? 0 : -1;

  const num = document.createElement("span");
  num.className = "mday--num";
  num.textContent = String(cell.date.getDate());
  box.append(num);

  if (cell.dots.length > 0) {
    const dots = document.createElement("span");
    dots.className = "mday--dots";
    for (const dot of cell.dots) {
      const mark = document.createElement("span");
      const hue = colours.get(dot.courseLabel);
      mark.className = hue === undefined ? "mdot" : `mdot course-${hue}`;
      // Dimmed, never dropped: a month of finished work must not look like a
      // month of work still owed, and must not look like an empty month
      // either.
      if (dot.done) mark.classList.add("mdot--done");
      dots.append(mark);
    }
    if (cell.more > 0) {
      // `MONTH_DOT_CAP` dots fit across a seventh of 400px; the rest are said
      // rather than drawn, because a cell that quietly drew four of nine would
      // be the silent-empty failure in miniature.
      const more = document.createElement("span");
      more.className = "mdot-more";
      more.textContent = `+${cell.more}`;
      dots.append(more);
    }
    box.append(dots);
  }

  box.addEventListener("click", () => onPick(cell));
  return box;
}

/**
 * The tapped day, under the grid: a heading, a count, and the rows.
 *
 * `renderRow` as every other view calls it, so a deadline here is the same
 * object it is on Today and in the Week — including its ⋯, its tone, and the
 * way it marks a time this extension invented.
 */
function paintDayList(
  list: HTMLElement,
  items: Item[],
  cell: MonthDotCell,
  now: Date,
  colours: Map<string, number>,
): void {
  list.replaceChildren();
  const placed = dayList(items, cell.date, now);

  const heading = document.createElement("div");
  heading.className = "section-head mday-head";
  const when = document.createElement("span");
  /*
   * "Agenda for Tuesday, Sep 22", named in full (mock 2a).
   *
   * The grid above it is a field of bare numbers, so the one line that says
   * which of them is open is the only place the weekday is written out; "Tue,
   * Sep 22" was the abbreviation of a heading that has the width for the word.
   * It is one line at 400px: the longest real value measures ~200px of 14px
   * Georgia against the ~300px the count leaves it, and it ellipses rather
   * than wrapping if a locale spells it longer.
   */
  when.textContent = `Agenda for ${cell.date.toLocaleDateString(DISPLAY_LOCALE, {
    weekday: "long",
    month: "short",
    day: "numeric",
  })}`;
  /*
   * The mock's `event_note`, ahead of the words.
   *
   * Prepended after the text rather than appended before it, because
   * `textContent =` replaces every child — writing the glyph first would throw
   * it away. It is an `<svg>`, so it carries no text of its own and
   * `when.textContent` is still exactly the heading; it is `aria-hidden` from
   * `icon()`, which is right for a glyph that only repeats the word beside it.
   */
  when.prepend(icon("event-note"));
  const count = document.createElement("span");
  count.textContent = `${placed.length} ${placed.length === 1 ? "item" : "items"}`;
  heading.append(when, count);
  list.append(heading);

  if (placed.length === 0) {
    list.append(emptyNote("Nothing due on this day."));
    return;
  }

  const stack = document.createElement("div");
  stack.className = "mday-rows";
  for (const item of placed) stack.append(renderDayRow(item, now, colours));
  list.append(stack);
}

function renderDayRow(placed: PlacedItem, now: Date, colours: Map<string, number>): HTMLElement {
  /*
   * "EOD" for a time this extension invented, never "11:59 PM".
   *
   * `dayList` marks those `assumed`, and worker house rule 3 is that a value
   * this code filled in must not be presented as one the source stated. The
   * heading above already says which day, so the column has nothing else it
   * has to carry.
   */
  const primary = Number.isNaN(placed.anchor.at)
    ? ""
    : placed.anchor.assumed
      ? "EOD"
      : `${placed.anchor.opening ? "opens " : ""}${clockOf(placed.anchor.at)}`;
  const row = renderRow(placed.item, now, undefined, { primary }, colours);
  // Names who left the time out — a course page, a post, or the student's own
  // row — rather than always blaming "the course site" (copy audit #4).
  if (placed.anchor.assumed) row.title = assumedTimeNote(placed.item);
  /*
   * No `›` at the end of the line.
   *
   * §5's agenda row drew one, and with the card's checkbox it made three
   * trailing controls on one row (Sushi, 2026-09-19: "pick one bro. just pick
   * the 3 dots."). It was `aria-hidden` decoration — the row is already a link
   * and the ⋯ is the real control — so removing it removes nothing a student
   * could press.
   */
  return row;
}

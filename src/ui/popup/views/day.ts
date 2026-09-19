/**
 * The day: an agenda in the popup, an hour axis in the full view, and the
 * drag-to-draft gesture that lives on the axis.
 *
 * **Kept as it was.** D4 replaces all of this with a grouped "Today" list —
 * Next up / Also today / Tomorrow / This week — and the hour grid and its drag
 * go with it. That is a separate piece of work; this file is the behaviour the
 * split had to preserve, moved whole.
 */

import {
  type AgendaRow,
  type DayContents,
  type PlacedItem,
  END_OF_DAY_HEADING,
  UNTIMED_HEADING,
  agendaRows,
  dayContents,
  hourRange,
  minutesInto,
  spanMinutes,
} from "../../../core/calendar.js";
import type { Item } from "../../../sources/types.js";
import { UNTIMED_NOTE, anchorDate, isFullView, state, viewEl, viewedDate } from "../state.js";
import { clockOf, emptyNote, renderRow } from "../rows.js";
import { openAddEditor, pad2 } from "../screens/editor.js";

const HOUR_PX = 26;

function hourLabel(hour: number): string {
  if (hour === 12) return "noon";
  if (hour === 0 || hour === 24) return "12 AM";
  return `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "AM" : "PM"}`;
}

/**
 * The grid, and a callback that sizes it once it is in the document.
 *
 * Stacks are absolutely positioned, so they do not grow their container — and
 * an 11:59 PM deadline starts one pixel before the bottom of a grid that ends
 * at midnight, then draws its two wrapped lines straight over the status line
 * underneath. The overlap was worst for exactly the commonest deadline there
 * is, which is why it survived the preview: the fixture day had nothing at
 * 11:59 PM on it.
 *
 * The height cannot be computed up front because a row's height depends on how
 * its title wraps, which depends on layout. So it is measured after insertion.
 */
function renderDayGrid(
  contents: DayContents,
  now: Date,
  colours: Map<string, number>,
  include: readonly number[] = [],
): { grid: HTMLElement; fit: () => void; slots: HTMLElement; start: number; end: number } {
  const { start, end } = hourRange(contents, include);
  const grid = document.createElement("div");
  grid.className = "grid";

  const hours = document.createElement("div");
  hours.className = "grid--hours";
  for (let hour = start; hour < end; hour += 1) {
    const cell = document.createElement("div");
    cell.className = "grid--hour";
    cell.textContent = hourLabel(hour);
    hours.append(cell);
  }

  const slots = document.createElement("div");
  slots.className = "grid--slots";
  slots.style.height = `${(end - start) * HOUR_PX}px`;
  for (let hour = start; hour < end; hour += 1) {
    const line = document.createElement("div");
    line.className = "grid--line";
    line.style.top = `${(hour - start) * HOUR_PX}px`;
    slots.append(line);
  }

  for (const stack of contents.timed) {
    const box = document.createElement("div");
    box.className = "grid--stack";
    const minutes = minutesInto(new Date(stack[0]!.anchor.at));
    box.style.top = `${(minutes / 60 - start) * HOUR_PX - 2}px`;
    for (const placed of stack) {
      const row = renderPlaced(placed, now, colours);
      /*
       * Something that lasts is a box as tall as it lasts, not a line.
       *
       * An exam sitting and a typed event both say how long they take —
       * `spanMinutes` reads PrairieTest's `"50min"` and the `endAt` a student
       * typed — and a 110-minute midterm drawn as one 26px row says nothing
       * about the two hours it actually occupies. `min-height`, not `height`:
       * a title still wraps to as many lines as it needs, and the row grows
       * past its span rather than clipping it.
       */
      const span = spanMinutes(placed.item, placed.anchor);
      if (span !== undefined) {
        row.classList.add("row-span");
        row.style.minHeight = `${Math.max(HOUR_PX, (span / 60) * HOUR_PX)}px`;
      }
      box.append(row);
    }
    slots.append(box);
  }

  // Where "now" is — on today, and only when now is on the axis at all.
  //
  // The axis starts at 8 AM, so between midnight and then the line's offset is
  // negative and it draws *above* the grid, straight across the booking strip.
  // At 12:30 AM it was a red rule through "not booked", which reads as a
  // strikethrough on the one control that matters most.
  const nowHour = minutesInto(now) / 60;
  if (state.dayOffset === 0 && nowHour >= start && nowHour < end) {
    const line = document.createElement("div");
    line.className = "grid--now";
    line.style.top = `${(nowHour - start) * HOUR_PX}px`;
    slots.append(line);
  }

  grid.append(hours, slots);
  const floor = (end - start) * HOUR_PX;
  return {
    grid,
    slots,
    start,
    end,
    fit: () => {
      let lowest = floor;
      for (const box of slots.querySelectorAll<HTMLElement>(".grid--stack")) {
        lowest = Math.max(lowest, box.offsetTop + box.offsetHeight);
      }
      slots.style.height = `${lowest}px`;
    },
  };
}

export function renderPlaced(
  placed: PlacedItem,
  now: Date,
  colours: Map<string, number>,
): HTMLElement {
  // The clock alone: the grid already says which day, and "opens" cost the
  // title thirty pixels to repeat what the dashed edge and the tooltip say.
  const row = renderRow(
    placed.item,
    now,
    undefined,
    { primary: clockOf(placed.anchor.at) },
    colours,
  );
  if (placed.anchor.opening) {
    row.classList.add("row-opening");
    row.title = `Not open yet — opens ${clockOf(placed.anchor.at)}`;
  }
  return row;
}

/**
 * Due today, at no hour anyone chose. Above the grid, not at the bottom of it.
 *
 * Sushi's report, and it was a flaw in the reasoning behind the grid rather
 * than a bug in it: the module comment says the 11:59 PM pile-up "is worth
 * seeing", and the layout then put it below the fold of a 600px popup. A
 * deadline you have to scroll to find is one you do not know about.
 */
function renderEndOfDay(
  placed: PlacedItem[],
  now: Date,
  colours: Map<string, number>,
): HTMLElement | undefined {
  if (placed.length === 0) return undefined;
  const box = document.createElement("div");
  box.className = "band band--eod";
  const heading = document.createElement("p");
  heading.className = "band--head";
  heading.textContent = "By end of day";
  box.append(heading);
  for (const one of placed) box.append(renderPlaced(one, now, colours));
  return box;
}

export function renderUntimedBand(
  items: Item[],
  now: Date,
  colours: Map<string, number>,
): HTMLElement | undefined {
  if (items.length === 0) return undefined;
  const band = document.createElement("div");
  band.className = "band";
  const note = document.createElement("p");
  note.className = "band--note";
  note.textContent = UNTIMED_NOTE;
  band.append(note);
  for (const item of items) {
    band.append(renderRow(item, now, undefined, { primary: "" }, colours));
  }
  return band;
}

export function renderDayView(items: Item[], now: Date, colours: Map<string, number>): void {
  const day = anchorDate(now);
  const contents = dayContents(items, day, now);
  // The hour axis needs height to be worth its cost, and the popup does not
  // have any. Sushi's decision; the reasoning is on `agendaRows`.
  if (isFullView) renderDayGridView(contents, now, colours);
  else renderAgenda(contents, now, colours, state.dayOffset === 0);
}

/**
 * The popup's day: one row per item and nothing per empty hour.
 *
 * The sequence is decided in `agendaRows` and only drawn here — where the "now"
 * rule goes and whether it is drawn at all are decisions, and decisions in this
 * project live where the suite can mutate them.
 */
function renderAgenda(
  contents: DayContents,
  now: Date,
  colours: Map<string, number>,
  isToday: boolean,
): void {
  // What the narrower "when" column keys off: an agenda row carries a clock,
  // and the date navigator above it already said which day.
  viewEl.dataset["shape"] = "agenda";
  const rows = agendaRows(contents, now, isToday);
  if (rows.length === 0) {
    viewEl.append(emptyNote("Nothing due this day."));
    return;
  }
  for (const row of rows) viewEl.append(renderAgendaRow(row, now, colours));
}

function renderAgendaRow(row: AgendaRow, now: Date, colours: Map<string, number>): HTMLElement {
  switch (row.kind) {
    case "heading": {
      const heading = document.createElement("p");
      heading.className = "band--head";
      heading.textContent = row.text;
      // Said once, above the rows it applies to. Five consecutive course-site
      // rows each carrying the same sentence is what this replaced; the fact
      // belongs to the group, not to the row.
      if (row.text === UNTIMED_HEADING) heading.title = UNTIMED_NOTE;
      if (row.text === END_OF_DAY_HEADING) {
        heading.title = "11:59 PM is the site's default, not an hour anyone picked.";
      }
      return heading;
    }
    case "untimed":
      return renderRow(row.item, now, undefined, { primary: "" }, colours);
    case "item":
      return renderPlaced(row.placed, now, colours);
    case "now": {
      const rule = document.createElement("div");
      rule.className = "nowrule";
      const label = document.createElement("span");
      label.textContent = now.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      rule.append(label);
      return rule;
    }
  }
}

/**
 * The full view's day, which has the height an hour axis is worth.
 *
 * **The empty day draws the grid too, which reverses an earlier decision.**
 * That decision — "no grid at all rather than ten empty ruled hours, which say
 * nothing and push what is above them off the screen" — was right while the
 * axis was only somewhere deadlines were *shown*. It is now where they are
 * *added*: a press on 3 PM is how a student puts something at 3 PM, and an
 * empty day is exactly the day they are most likely to be filling in. A blank
 * page with nothing to press is the one shape that makes the gesture
 * undiscoverable.
 *
 * The "nothing due" note stays, above the grid rather than instead of it, so
 * the day still says what it holds before it offers somewhere to write.
 */
function renderDayGridView(contents: DayContents, now: Date, colours: Map<string, number>): void {
  const band = renderUntimedBand(contents.untimed, now, colours);
  if (band) viewEl.append(band);
  const eod = renderEndOfDay(contents.endOfDay, now, colours);
  if (eod) viewEl.append(eod);

  if (contents.timed.length === 0) {
    viewEl.append(
      emptyNote(
        contents.endOfDay.length + contents.untimed.length > 0
          ? "Nothing else at a set time today. Drag on the grid to add something."
          : "Nothing due this day. Drag on the grid to add something.",
      ),
    );
  }

  mountDayGrid(viewEl, contents, now, colours);
}

/* -------------------------------------------------------------------------- */
/* Dragging a box onto the hour axis                                           */
/* -------------------------------------------------------------------------- */

/**
 * Quarter hours.
 *
 * A grid hour is 26px, so one pixel is a little over two minutes and an
 * unsnapped drag would produce "4:37–5:09 PM" — a precision the gesture does
 * not have and a deadline nobody meant. Fifteen minutes is 6.5px, which is
 * still finer than the hand is.
 */
const SNAP_MINUTES = 15;

/**
 * How far the pointer must travel before this is a drag rather than a press.
 *
 * Under this, the gesture is a click: one instant, no end time. A press that
 * wobbles two pixels and silently becomes a five-minute event is the kind of
 * thing that makes a control feel broken.
 */
const DRAG_SLOP_PX = 4;

interface DayGridRef {
  host: HTMLElement;
  el: HTMLElement;
  slots: HTMLElement;
  start: number;
  end: number;
  contents: DayContents;
  now: Date;
  colours: Map<string, number>;
}

/** The grid currently on screen, so the draft box can be re-placed on it. */
let dayGrid: DayGridRef | undefined;

/** Where the student is putting something, in minutes from local midnight. */
let draft: { startMin: number; endMin?: number } | undefined;

/**
 * Forgotten with the children `render()` just replaced.
 *
 * A draw only ever happens with no editor open (see `drawIsHeld`), so nothing
 * being typed is discarded by this.
 */
export function resetDayGrid(): void {
  dayGrid = undefined;
  draft = undefined;
}

/**
 * The hours the axis must cover because of the draft, on top of the day's own.
 *
 * Both ends: a box dragged from 9 PM to 10:30 needs the axis to reach 10:30, or
 * the ghost is drawn past the bottom of the grid it is supposed to be inside.
 */
function draftHours(): number[] {
  if (!draft) return [];
  const hours = [draft.startMin / 60];
  if (draft.endMin !== undefined) hours.push(draft.endMin / 60);
  return hours;
}

function mountDayGrid(
  host: HTMLElement,
  contents: DayContents,
  now: Date,
  colours: Map<string, number>,
): void {
  const built = renderDayGrid(contents, now, colours, draftHours());
  host.append(built.grid);
  // Only measurable once it is in the document.
  built.fit();
  dayGrid = {
    host,
    el: built.grid,
    slots: built.slots,
    start: built.start,
    end: built.end,
    contents,
    now,
    colours,
  };
  wireDayDrag(dayGrid);
  paintDraft();
}

/**
 * Rebuild only the grid, leaving everything else in `#view` alone.
 *
 * A typed time outside the current axis has to widen it, and the obvious way to
 * widen it is a redraw — which would take the editor that is being typed into
 * with it. So the grid element is replaced in place and the form above it never
 * moves.
 */
function rebuildDayGrid(): void {
  const current = dayGrid;
  if (!current || !current.el.isConnected) return;
  const built = renderDayGrid(current.contents, current.now, current.colours, draftHours());
  current.el.replaceWith(built.grid);
  built.fit();
  dayGrid = { ...current, el: built.grid, slots: built.slots, start: built.start, end: built.end };
  wireDayDrag(dayGrid);
  paintDraft();
}

function clockAt(minutes: number): string {
  const when = anchorDate(new Date());
  when.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * "3:00–4:30 PM", with the meridiem written once when it is the same one.
 *
 * Not a cosmetic saving: the label sits inside a box that can be 13px tall at
 * the narrow end of a quarter-hour drag, and "3:00 PM–4:30 PM" is what makes
 * it wrap out of its own box.
 */
function draftLabel(startMin: number, endMin?: number): string {
  const from = clockAt(startMin);
  if (endMin === undefined) return from;
  const to = clockAt(endMin);
  const suffix = / (AM|PM)$/.exec(to)?.[1];
  const trimmed = suffix && from.endsWith(` ${suffix}`) ? from.slice(0, -suffix.length - 1) : from;
  return `${trimmed}–${to}`;
}

function paintDraft(): void {
  const grid = dayGrid;
  if (!grid) return;
  for (const old of grid.slots.querySelectorAll(".grid--draft")) old.remove();
  if (!draft) return;

  const box = document.createElement("div");
  box.className = "grid--draft";
  const top = (draft.startMin / 60 - grid.start) * HOUR_PX;
  const minutes = draft.endMin === undefined ? SNAP_MINUTES : draft.endMin - draft.startMin;
  box.style.top = `${top}px`;
  box.style.height = `${Math.max(12, (minutes / 60) * HOUR_PX)}px`;

  const label = document.createElement("span");
  label.className = "grid--draft-label";
  label.textContent = draftLabel(draft.startMin, draft.endMin);
  box.append(label);
  grid.slots.append(box);
}

/** Put the draft here, widening the axis first when it no longer fits on it. */
function setDraft(startMin: number, endMin?: number): void {
  draft = endMin === undefined ? { startMin } : { startMin, endMin };
  const grid = dayGrid;
  const covered =
    grid !== undefined && startMin >= grid.start * 60 && (endMin ?? startMin) <= grid.end * 60;
  if (covered) paintDraft();
  else rebuildDayGrid();
}

function clearDraft(): void {
  if (!draft) return;
  draft = undefined;
  // Rebuilt rather than only repainted, so the axis gives back the hours it
  // widened by. A grid left stretched to 11 PM after a cancelled drag is a day
  // that quietly looks different from every other day.
  rebuildDayGrid();
}

/** `HH:MM` back to minutes, for a time the student typed into the editor. */
function minutesOfClock(value: string): number | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  // Deliberately not a refusal: `core/manual.ts` is what judges this string.
  // All this decides is whether the ghost can be drawn, and a half-typed time
  // simply leaves it where it was.
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}

function wireDayDrag(ref: DayGridRef): void {
  const minutesAt = (clientY: number): number => {
    const rect = ref.slots.getBoundingClientRect();
    const raw = ref.start * 60 + ((clientY - rect.top) / HOUR_PX) * 60;
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    return Math.min(ref.end * 60, Math.max(ref.start * 60, snapped));
  };

  ref.slots.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const target = event.target;
    // A press on a deadline is a press on that deadline. `.grid--line` and
    // `.grid--now` are decoration stretched across the whole width, so they are
    // deliberately *not* excluded — a student aiming at 4 PM will land on the
    // 4 PM rule about half the time.
    if (target instanceof Element && target.closest(".row, .grid--stack, .editor")) return;
    event.preventDefault();

    const anchorMin = minutesAt(event.clientY);
    const fromY = event.clientY;
    let moved = false;
    setDraft(anchorMin);
    // Capture, so a drag that leaves the grid — upward past the banners, or out
    // of the window — still reports its moves and its release here.
    ref.slots.setPointerCapture(event.pointerId);

    const move = (moveEvent: PointerEvent): void => {
      if (Math.abs(moveEvent.clientY - fromY) >= DRAG_SLOP_PX) moved = true;
      const other = minutesAt(moveEvent.clientY);
      const from = Math.min(anchorMin, other);
      const to = Math.max(anchorMin, other);
      setDraft(from, moved && to > from ? to : undefined);
    };

    const finish = (upEvent: PointerEvent, cancelled: boolean): void => {
      ref.slots.removeEventListener("pointermove", move);
      ref.slots.removeEventListener("pointerup", up);
      ref.slots.removeEventListener("pointercancel", cancel);
      if (ref.slots.hasPointerCapture(upEvent.pointerId)) {
        ref.slots.releasePointerCapture(upEvent.pointerId);
      }
      if (cancelled) {
        clearDraft();
        return;
      }
      const current = draft;
      if (!current) return;
      openDraftEditor(current.startMin, current.endMin);
    };
    const up = (upEvent: PointerEvent): void => finish(upEvent, false);
    const cancel = (cancelEvent: PointerEvent): void => finish(cancelEvent, true);

    ref.slots.addEventListener("pointermove", move);
    ref.slots.addEventListener("pointerup", up);
    ref.slots.addEventListener("pointercancel", cancel);
  });
}

/**
 * The form for a box just dragged onto the axis.
 *
 * A dragged *span* opens as an Event, not a deadline: the student said when it
 * starts and when it ends, and the end time field only exists for the kinds
 * that have one — opening it as a deadline would throw away half of what the
 * gesture stated. A press with no drag stays a deadline, which is what the
 * other 95% of this list is.
 */
function openDraftEditor(startMin: number, endMin?: number): void {
  const time = `${pad2(Math.floor(startMin / 60))}:${pad2(startMin % 60)}`;
  const endTime =
    endMin === undefined ? "" : `${pad2(Math.floor(endMin / 60))}:${pad2(endMin % 60)}`;
  openAddEditor({
    values: {
      date: viewedDate(),
      time,
      endTime,
      kind: endMin === undefined ? "assignment" : "event",
    },
    onChange: (values) => {
      // The ghost follows what is typed, so the two controls for one fact — the
      // box and the clock fields — cannot disagree about where it is.
      const from = minutesOfClock(values.time);
      if (from === undefined) return;
      const to = minutesOfClock(values.endTime);
      setDraft(from, to !== undefined && to > from ? to : undefined);
    },
    onClose: () => clearDraft(),
  });
}

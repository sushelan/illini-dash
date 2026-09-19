/**
 * Today: what is next, what else is today, tomorrow, and the rest of the week
 * (brief D4, mock 1a).
 *
 * **This replaces the day view.** The hour axis, the drag-to-draft gesture on
 * it and the day ‹ › navigator are gone, in both windows — `docs/ux-plan.md` §0
 * had already found the hour axis the wrong shape for data that lands on the
 * same minute (a column of 11:59 PMs and fifteen empty hours above it), and the
 * mock keeps no grid. Adding a deadline is the header's `+` now, which works on
 * every tab instead of only on the one with an axis to aim at.
 *
 * Nothing here decides anything: `todayBoard` owns the grouping, `quietState`
 * owns "is this a quiet week or a broken one", and this file draws what they
 * answer.
 */

import { todayBoard, type TodayBoard } from "../../../core/calendar.js";
import { quietState, type QuietState } from "../../../core/health.js";
import { icon } from "../../icons.js";
import type { Item, Source, SourceStatus } from "../../../sources/types.js";
import { app, state, viewEl } from "../state.js";
import { selectTab } from "../shell.js";
import { emptyNote, renderRow } from "../rows.js";

export function renderTodayView(
  items: Item[],
  now: Date,
  colours: Map<string, number>,
  sources: Partial<Record<Source, SourceStatus>> = {},
): void {
  /*
   * The quiet state comes first, and only `quietState` may decide it.
   *
   * "Nothing due for 3 days" is a claim about every source having answered. Said
   * over one expired session it reads as "you are free" and means "I could not
   * look" (§11) — so the check is `core/health.ts`'s, which returns nothing
   * unless every checkable source succeeded, and the failure cases keep
   * `emptyStateFor`'s wording with its sign-in buttons.
   */
  const quiet = quietState(items, sources, now, state.courseNames);
  if (quiet) {
    viewEl.append(renderQuiet(quiet));
    return;
  }

  const board = todayBoard(items, now);
  if (board.nextUp) {
    viewEl.append(renderRow(board.nextUp, now, "Today", undefined, colours, { hero: true }));
  }

  const dayLabel = (offset: number): string => {
    const when = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return when.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  };

  appendSection("Also today", dayLabel(0), board.alsoToday, now, colours);
  appendSection("Tomorrow", dayLabel(1), board.tomorrow, now, colours);
  appendSection(
    "This week",
    // The heading counts what the card left out (`WEEK_PREVIEW_ROWS`), so a
    // capped list never reads as the whole week.
    board.weekMore > 0 ? `${board.weekMore} more` : "",
    board.thisWeek,
    now,
    colours,
  );

  if (isEmptyBoard(board)) {
    // Rows exist — `render` handles the list being empty outright — but none of
    // them are this week, and some source did not answer, so `quietState`
    // refused to promise the student is free.
    viewEl.append(emptyNote("Nothing due in the next few days."));
  }
}

function isEmptyBoard(board: TodayBoard): boolean {
  return (
    board.nextUp === undefined &&
    board.alsoToday.length === 0 &&
    board.tomorrow.length === 0 &&
    board.thisWeek.length === 0
  );
}

function appendSection(
  label: string,
  note: string,
  items: Item[],
  now: Date,
  colours: Map<string, number>,
): void {
  if (items.length === 0) return;
  const section = document.createElement("div");
  section.className = "tsection";

  const head = document.createElement("p");
  head.className = "section-head";
  const name = document.createElement("span");
  name.textContent = label;
  head.append(name);
  if (note) {
    const right = document.createElement("span");
    right.textContent = note;
    head.append(right);
  }
  section.append(head);

  // `section` is passed through to `formatDue`, which words its qualifier by
  // the heading above the row — the one place the row is allowed to assume what
  // the reader has already been told.
  const sectionName = label === "Tomorrow" ? "Tomorrow" : label === "This week" ? "This week" : "Today";
  for (const item of items) {
    section.append(renderRow(item, now, sectionName, undefined, colours));
  }
  viewEl.append(section);
}

/**
 * A week with nothing in it, said as a fact rather than as an absence (D13).
 *
 * Both buttons are things to *do*, because the one screen with nothing on it is
 * the one where a student is most likely to wonder whether the extension is
 * working: "See the week" proves the list is there, and "Add something" is the
 * answer if it is not.
 */
function renderQuiet(quiet: QuietState): HTMLElement {
  const card = document.createElement("div");
  card.className = "card quiet";

  const mark = document.createElement("span");
  mark.className = "quiet--mark";
  mark.append(icon("check"));

  const headline = document.createElement("p");
  headline.className = "quiet--headline";
  headline.textContent = quiet.headline;

  const detail = document.createElement("p");
  detail.className = "quiet--detail";
  detail.textContent = quiet.detail;

  const actions = document.createElement("div");
  actions.className = "quiet--actions";

  const week = document.createElement("button");
  week.type = "button";
  week.className = "btn";
  week.textContent = "See the week";
  // The tab strip's own mechanism, so the stored view, the reset offset and the
  // redraw all happen exactly once each and in one place.
  week.addEventListener("click", () => selectTab("week"));

  const add = document.createElement("button");
  add.type = "button";
  add.className = "btn";
  add.textContent = "Add something";
  add.addEventListener("click", () => app.openAddEditor());

  actions.append(week, add);
  card.append(mark, headline, detail, actions);
  return card;
}

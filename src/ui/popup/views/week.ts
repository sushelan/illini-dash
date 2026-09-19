/**
 * The week, as seven day cards (brief D5, mock 1b).
 *
 * `[DOW / date]` in a 44px column, the day's deadlines beside it as compact
 * cards, and one status word per row — `weekStatus`, which is the whole
 * right-hand column here: `done`, `late ok`, `1d late`, `EOD`, or the clock. A
 * day with nothing says "Nothing due"; today's card is tinted and captioned.
 *
 * What the redesign kept from the ruled version: rolling days (`WEEK_MODE`),
 * `quietDay` deciding which cards collapse, and a press on the empty part of a
 * day adding something to it. The per-day "+" went on 2026-09-19 (see below).
 */

import { allTimed, dayKey, quietDay, weekContents, weekStatus } from "../../../core/calendar.js";
import type { Item } from "../../../sources/types.js";
import { WEEK_MODE, anchorDate, dateNavEl, state, viewEl } from "../state.js";
import { renderRow } from "../rows.js";
import { openAddEditor } from "../screens/editor.js";

export function renderWeekView(items: Item[], now: Date, colours: Map<string, number>): void {
  markThisWeek();
  for (const day of weekContents(items, anchorDate(now), now, WEEK_MODE)) {
    const card = document.createElement("div");
    card.className = "wrow";
    if (day.isToday) card.classList.add("wrow--today");

    const head = document.createElement("div");
    head.className = "wday";
    const dow = document.createElement("div");
    dow.className = "wday--dow";
    dow.textContent = day.date.toLocaleDateString(undefined, { weekday: "short" });
    const num = document.createElement("div");
    num.className = "wday--num";
    num.textContent = String(day.date.getDate());
    head.append(dow, num);
    if (day.isToday) {
      // Said in words as well as in the tint: a colour-only signal is the thing
      // the high-contrast theme exists to avoid, and this one decides which of
      // seven identical cards the student is standing on.
      const caption = document.createElement("div");
      caption.className = "wday--today";
      caption.textContent = "today";
      head.append(caption);
    }

    const box = document.createElement("div");
    box.className = "witems";
    /*
     * Anywhere in the card that is not a deadline is somewhere to add one.
     *
     * A week card has no hour axis to aim at, so there is nothing to drag — but
     * "press the empty part of Tuesday" is the same gesture every calendar
     * answers, and the day is already written on the left of it.
     */
    box.addEventListener("click", (event) => {
      if (event.target !== box) return;
      openAddEditor({ container: box, where: "end", values: { date: dayKey(day.date) } });
    });
    // No per-day "+" any more (Sushi, 2026-09-19): it sat under the rows as a
    // row of its own, so a one-item day was as tall as a two-item day. The
    // header's "+" and the press on the empty part of the day both remain.

    // A day nobody owes anything on gets the tight card, whether it is empty or
    // holds four things already handed in. The decision is `quietDay`'s; this
    // only draws it.
    if (quietDay(day.contents, now)) card.classList.add("wrow--quiet");

    // Timed first, then the ones whose time the site never posted — which are
    // rows like any other now, carrying `EOD` where the others carry a clock,
    // rather than a labelled band inside the day.
    const rows: Item[] = [
      ...allTimed(day.contents).map((placed) => placed.item),
      ...day.contents.untimed,
    ];
    if (rows.length === 0) {
      box.classList.add("witems--empty");
      box.textContent = "Nothing due";
    } else {
      for (const item of rows) {
        box.append(
          renderRow(item, now, undefined, undefined, colours, {
            compact: true,
            status: weekStatus(item, now),
          }),
        );
      }
    }

    card.append(head, box);
    viewEl.append(card);
  }
}

/**
 * The navigator's right-hand pill, when the anchor is now.
 *
 * `renderDateNav` already builds the arrows, the range label and — once there
 * is somewhere to come back from — a "Today" button, which is the same pill
 * doing something. What it has no reason to build is the *other* state of it:
 * the mock's "This Week", which says the range you are reading is the current
 * one. So it is added here, where the view that wants it is drawn.
 *
 * Appended rather than built into the navigator because `renderDateNav`
 * replaces its children on every draw and runs before this (popup.ts) — the
 * month view re-appends its own control the same way, for the same reason.
 *
 * Only under the Classical design: it is that mock's element, and the other
 * three designs have no place drawn for it.
 */
function markThisWeek(): void {
  if (document.documentElement.dataset.design !== "classical") return;
  if (state.dayOffset !== 0) return;
  const pill = document.createElement("span");
  pill.className = "datenav--week";
  pill.textContent = "This Week";
  dateNavEl.append(pill);
}

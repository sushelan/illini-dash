/**
 * The week, as seven day cards (brief D5, mock 1b).
 *
 * `[DOW / date]` in a 44px column, the day's deadlines beside it as compact
 * cards, and one status word per row — `weekStatus`, which is the whole
 * right-hand column here: `done`, `late ok`, `1d late`, `EOD`, or the clock. A
 * day with nothing says "Nothing due"; today's card is tinted and captioned.
 *
 * What the redesign kept from the ruled version: rolling days (`WEEK_MODE`),
 * `quietDay` deciding which cards collapse, a press on the empty part of a day
 * adding something to it, and the per-day "+".
 */

import { allTimed, dayKey, quietDay, weekContents, weekStatus } from "../../../core/calendar.js";
import { iconButton } from "../../icons.js";
import type { Item } from "../../../sources/types.js";
import { WEEK_MODE, anchorDate, viewEl } from "../state.js";
import { renderRow } from "../rows.js";
import { openAddEditor } from "../screens/editor.js";

export function renderWeekView(items: Item[], now: Date, colours: Map<string, number>): void {
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
    const addHere = iconButton(
      "plus",
      `Add something on ${day.date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })}`,
    );
    // Visible on hover and whenever it has focus: a control that only exists
    // under a pointer is one no keyboard can ever reach.
    addHere.classList.add("btn-sm", "wadd");
    addHere.addEventListener("click", (event) => {
      event.stopPropagation();
      openAddEditor({ container: box, where: "end", values: { date: dayKey(day.date) } });
    });

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

    box.append(addHere);
    card.append(head, box);
    viewEl.append(card);
  }
}

/**
 * The week, as seven day rows.
 *
 * D5 restyles these as cards with a right-hand status word and a ‹ › range
 * nav; the structure below — one row per day, `quietDay` deciding which of them
 * collapse, and a press on the empty part of a day adding something to it — is
 * what that has to keep.
 */

import { allTimed, dayKey, quietDay, weekContents } from "../../../core/calendar.js";
import { iconButton } from "../../icons.js";
import type { Item } from "../../../sources/types.js";
import { UNTIMED_NOTE, WEEK_MODE, anchorDate, viewEl } from "../state.js";
import { renderRow } from "../rows.js";
import { renderPlaced } from "./day.js";
import { openAddEditor } from "../screens/editor.js";

export function renderWeekView(items: Item[], now: Date, colours: Map<string, number>): void {
  for (const day of weekContents(items, anchorDate(now), now, WEEK_MODE)) {
    const row = document.createElement("div");
    row.className = "wrow";
    if (day.isToday) row.classList.add("wrow--today");

    const head = document.createElement("div");
    head.className = "wday";
    const dow = document.createElement("div");
    dow.className = "wday--dow";
    dow.textContent = day.date.toLocaleDateString(undefined, { weekday: "short" });
    const num = document.createElement("div");
    num.className = "wday--num";
    num.textContent = String(day.date.getDate());
    head.append(dow, num);

    const box = document.createElement("div");
    box.className = "witems";
    /*
     * Anywhere in the row that is not a deadline is somewhere to add one.
     *
     * A week row has no hour axis to aim at, so there is nothing to drag — but
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
    const timed = allTimed(day.contents);
    // A day nobody owes anything on gets the tight header, whether it is empty
    // or holds four things already handed in. The decision is `quietDay`'s;
    // this only draws it.
    if (quietDay(day.contents, now)) row.classList.add("wrow--quiet");
    if (timed.length === 0 && day.contents.untimed.length === 0) {
      // A 22px row rather than a full-height one. An empty day is worth a line
      // saying it is empty and nothing more — seven of them at full height is
      // the whole popup.
      box.classList.add("witems--empty");
      box.textContent = "—";
    } else {
      for (const placed of timed) box.append(renderPlaced(placed, now, colours));
      if (day.contents.untimed.length > 0) {
        const label = document.createElement("div");
        label.className = "wuntimed";
        label.textContent = "time not posted —";
        label.title = UNTIMED_NOTE;
        box.append(label);
        for (const item of day.contents.untimed) {
          box.append(renderRow(item, now, undefined, { primary: "" }, colours));
        }
      }
    }

    box.append(addHere);
    row.append(head, box);
    viewEl.append(row);
  }
}

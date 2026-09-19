/**
 * Everything you have to turn up to, with no 60-day horizon.
 *
 * Every other view stops at 60 days, which is right for homework and wrong for
 * the one thing always further out: in September a December final is invisible,
 * and it is the deadline a student most wants a month's warning about.
 */

import { type PlacedItem, examBoard, startOfDay } from "../../../core/calendar.js";
import type { Item } from "../../../sources/types.js";
import { viewEl } from "../state.js";
import { bookingWindowText, renderRow } from "../rows.js";

export function renderExamsView(items: Item[], now: Date, colours: Map<string, number>): void {
  const board = examBoard(items, now);

  if (board.unbooked.length === 0 && board.upcoming.length === 0 && board.recent.length === 0) {
    const empty = document.createElement("div");
    // The card language's explainer, which is what this sentence always was:
    // a paragraph saying why the screen is empty. Same words as before.
    empty.className = "card view-note";
    // Not "no exams": that is a claim about the term, and all this knows is
    // that no source mentioned one. PrairieTest is where most of them come
    // from, and it is a source a student may have switched off.
    empty.textContent = "No exams or quizzes from any source you have switched on.";
    viewEl.append(empty);
    return;
  }

  if (board.unbooked.length > 0) {
    viewEl.append(examHeading("Not booked", board.unbooked.length, "err"));
    const stack = examStack();
    for (const item of board.unbooked) {
      // "Book a slot: " is PrairieTest's own prefix, and under a heading that
      // already reads "Not booked" it is the third time the row says the same
      // thing — at the cost of the exam's actual name.
      const row = renderRow(item, now, undefined, bookingWindowText(item), colours);
      const title = row.querySelector<HTMLElement>(".row--title");
      if (title) {
        title.textContent = item.title.replace(/^Book a slot:\s*/i, "");
        title.title = item.title;
      }
      stack.append(row);
    }
    viewEl.append(stack);
  }

  if (board.upcoming.length > 0) {
    viewEl.append(examHeading("Coming up", board.upcoming.length));
    const stack = examStack();
    for (const placed of board.upcoming) {
      stack.append(renderRow(placed.item, now, undefined, examWhen(placed, now), colours));
    }
    viewEl.append(stack);
  }

  if (board.recent.length > 0) {
    // A week of them, so "I already sat that" and "this never existed" are
    // different answers. They drop out on their own after that.
    viewEl.append(examHeading("Just sat", board.recent.length));
    const stack = examStack();
    for (const placed of board.recent) {
      const row = renderRow(placed.item, now, undefined, examWhen(placed, now), colours);
      row.classList.add("row-sat");
      stack.append(row);
    }
    viewEl.append(stack);
  }
}

/** The gap between cards, once per section. Rows are cards now (D7). */
function examStack(): HTMLElement {
  const stack = document.createElement("div");
  stack.className = "exam-stack";
  return stack;
}

/**
 * The label over a group of exams, in the card language's `.section-head`.
 *
 * The count moved out of the text and into its own span — `Not booked` with a
 * `2` at the right edge rather than `Not booked (2)` — which is the same
 * information in the shape every other heading in the redesign uses. The words,
 * the order and the red on "Not booked" are unchanged.
 */
function examHeading(text: string, count: number, tone?: "err"): HTMLElement {
  const heading = document.createElement("div");
  heading.className = "section-head";
  if (tone === "err") heading.classList.add("section-head--err");
  const label = document.createElement("span");
  label.textContent = text;
  const badge = document.createElement("span");
  badge.textContent = String(count);
  heading.append(label, badge);
  return heading;
}

/**
 * The date *and* the day, unlike every other view.
 *
 * Elsewhere the grid or the heading already says which day, so the row carries
 * only a clock. This list spans a whole term, so a bare "7:00 PM" would be the
 * least useful thing it could say.
 */
function examWhen(placed: PlacedItem, now: Date): { primary: string; detail?: string } {
  const at = new Date(placed.anchor.at);
  const day = at.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const clock = at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const days = Math.round((startOfDay(at).getTime() - startOfDay(now).getTime()) / 86_400_000);
  const away = days === 0 ? "today" : days === 1 ? "tomorrow" : days > 0 ? `in ${days}d` : undefined;
  return { primary: `${day} ${clock}`, detail: away };
}

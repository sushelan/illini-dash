/**
 * Everything you have to turn up to, with no 60-day horizon.
 *
 * Every other view stops at 60 days, which is right for homework and wrong for
 * the one thing always further out: in September a December final is invisible,
 * and it is the deadline a student most wants a month's warning about.
 */

import {
  type PlacedItem,
  examBoard,
  startOfDay,
} from "../../../core/calendar.js";
import type { Item } from "../../../sources/types.js";
import { icon, type IconName } from "../../icons.js";
import { safeUrl, viewEl } from "../state.js";
import { bookingWindowText, renderRow } from "../rows.js";

/**
 * Whether the board is drawn as the Classical mock draws it.
 *
 * The same question `rows.ts` asks, asked the same way — the root's
 * `data-design`, which is what `theme-panel.ts` writes and what every
 * stylesheet keys on, so there is no second copy of the choice to fall out of
 * step. It is asked here for the same reason it is asked there: the mock's
 * card is **markup**, not paint. A glyph in front of a room, a source turned
 * into a pill, a Reserve button at the foot of the slip — none of those can be
 * added by a stylesheet, and none of them has a rule outside
 * `design-classical-exams.css`, so building them under the shipped design
 * would put four unstyled elements on every exam card.
 */
function classical(): boolean {
  return document.documentElement.dataset.design === "classical";
}

export function renderExamsView(
  items: Item[],
  now: Date,
  colours: Map<string, number>,
): void {
  const board = examBoard(items, now);
  const mock = classical();

  if (
    board.unbooked.length === 0 &&
    board.upcoming.length === 0 &&
    board.recent.length === 0
  ) {
    const empty = document.createElement("div");
    // The card language's explainer, which is what this sentence always was:
    // a paragraph saying why the screen is empty. Same words as before.
    empty.className = "card view-note";
    // Not "no exams": that is a claim about the term, and all this knows is
    // that no source mentioned one. PrairieTest is where most of them come
    // from, and it is a source a student may have switched off.
    empty.textContent =
      "No exams or quizzes from any source you have switched on.";
    viewEl.append(empty);
    return;
  }

  // `popup.css` hides `.folio` in every other design, but building it there
  // would still put a heading in the accessibility tree that nobody can see.
  if (mock) viewEl.append(examFolio());

  if (board.unbooked.length > 0) {
    viewEl.append(
      examHeading(
        "Not booked",
        // The mock's "Action Required" badge, which says what the count said
        // and adds why it matters. With more than one there is a number to
        // carry, and "Action required" would be hiding it.
        board.unbooked.length === 1
          ? "Action Required"
          : `${board.unbooked.length} to book`,
        "warning",
        "err",
      ),
    );
    const stack = examStack();
    for (const item of board.unbooked) {
      // "Book a slot: " is PrairieTest's own prefix, and under a heading that
      // already reads "Not booked" it is the third time the row says the same
      // thing — at the cost of the exam's actual name.
      const row = renderRow(
        item,
        now,
        undefined,
        bookingWindowText(item),
        colours,
      );
      const title = row.querySelector<HTMLElement>(".row--title");
      if (title) {
        title.textContent = item.title.replace(/^Book a slot:\s*/i, "");
        title.title = item.title;
      }
      if (mock) {
        // "not booked" is a warning, not a clock: the mock puts
        // `notification_important` on this card and a `schedule` on the others.
        decorateExamRow(row, "warning", false);
        /*
         * §7's `Window open: …` line.
         *
         * `bookingWindowText` writes PrairieTest's own phrasing — "sessions
         * Sep 29–Oct 1" — and §7 labels the same range. The label is prefixed
         * rather than the text rewritten, and the source's own "sessions" is
         * dropped only where it is there, so nothing is invented and nothing
         * says the same word twice.
         */
        const window = plainDetail(row);
        if (window) {
          window.textContent = window.textContent?.replace(/^sessions\s+/i, "") ?? "";
          const label = document.createElement("span");
          label.className = "exam-line--label";
          label.textContent = "Window open:";
          row.append(examLine("tab-day", label, window));
        }
        const reserve = reserveButton(item);
        if (reserve) row.append(reserve);
      }
      stack.append(row);
    }
    viewEl.append(stack);
  }

  if (board.upcoming.length > 0) {
    // Not "confirmed": nothing in the store says a seat was taken, only that a
    // sitting exists. See the report note on "Desk Roster Verified".
    viewEl.append(
      examHeading(
        "Coming up",
        `${board.upcoming.length} scheduled`,
        "verified",
      ),
    );
    const stack = examStack();
    for (const placed of board.upcoming) {
      const row = renderRow(
        placed.item,
        now,
        undefined,
        examWhen(placed, now),
        colours,
      );
      if (mock) decorateExamRow(row, "clock");
      stack.append(row);
    }
    viewEl.append(stack);
  }

  if (board.recent.length > 0) {
    // A week of them, so "I already sat that" and "this never existed" are
    // different answers. They drop out on their own after that.
    viewEl.append(examHeading("Just sat", "past week", "tab-exams"));
    const stack = examStack();
    for (const placed of board.recent) {
      const row = renderRow(
        placed.item,
        now,
        undefined,
        examWhen(placed, now),
        colours,
      );
      row.classList.add("row-sat");
      if (mock) decorateExamRow(row, "clock");
      // The mock's "✓ Graded" tag. It says "Taken" instead, because no source
      // this extension reads reports a grade — see the report note.
      const when = mock ? row.querySelector<HTMLElement>(".row--when") : null;
      if (when) {
        const tag = document.createElement("span");
        tag.className = "exam-tag";
        tag.append(icon("check"), document.createTextNode("Taken"));
        when.append(tag);
      }
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
 *
 * The mock adds two things to that: a glyph in front of the label, and a note
 * where the bare number was ("Action Required", "2 Confirmed", "Past week
 * exams"). `note` still carries the count wherever a count is the fact — see
 * the call sites for the one place it is deliberately a phrase instead.
 */
function examHeading(
  text: string,
  note: string,
  glyph: IconName,
  tone?: "err",
): HTMLElement {
  const heading = document.createElement("div");
  heading.className = "section-head exam-head";
  if (tone === "err") heading.classList.add("section-head--err");
  const label = document.createElement("span");
  label.className = "exam-head--label";
  // The glyph is the mock's and has a rule only in the mock's stylesheet.
  if (classical()) label.append(icon(glyph));
  label.append(document.createTextNode(text));
  const badge = document.createElement("span");
  badge.className = "exam-head--note";
  badge.textContent = note;
  heading.append(label, badge);
  return heading;
}

/**
 * The running head the mock draws over the board — "Exams & Reservations",
 * with the horizon named beside it.
 *
 * `.folio` rather than a new element: Today already builds one, `popup.css`
 * hides it in every other design, and the Classical sheet already styles it as
 * a page's running head with its rule underneath. This is the second entry in
 * the one class, not a second class.
 *
 * The mock's "Fall 2024" is not here because nothing in the store states a
 * term. What it says instead is the thing this view is actually for: every
 * other tab stops at 60 days and this one does not.
 */
function examFolio(): HTMLElement {
  const head = document.createElement("div");
  head.className = "folio exam-folio";
  const title = document.createElement("h1");
  title.className = "folio--date";
  title.textContent = "Exams & reservations";
  const horizon = document.createElement("span");
  horizon.className = "folio--count";
  horizon.textContent = "all-term";
  head.append(title, horizon);
  return head;
}

/**
 * The mock's icon-led metadata rows, made out of what `renderRow` already built.
 *
 * Nothing here invents a fact. The clock, the room and the source name are all
 * on the card already — the room as one chunk of the meta line, the source as
 * another — and the mock gives each of them its own line with a glyph in front.
 * So this moves the room onto its own line and turns the source into the
 * mock's verified pill, rather than asking `rows.ts` for a third row shape.
 */
function decorateExamRow(
  row: HTMLElement,
  whenGlyph: IconName,
  inlineRelative = true,
): void {
  const when = row.querySelector<HTMLElement>(".row--when");
  if (when) {
    when.classList.add("exam-when");
    when.prepend(icon(whenGlyph));
    // "today", "in 24d" — `examWhen`'s qualifier, which `rows.ts` gives a full
    // line of its own. The mock states a sitting on one line, and a card that
    // spends a whole line on two words has one line less for the room.
    if (inlineRelative) {
      const relative = plainDetail(row);
      if (relative) {
        relative.classList.add("exam-rel");
        when.append(relative);
      }
    }
  }

  const source = row.querySelector<HTMLElement>(".row--sources");
  if (source) {
    // A tick only where the extension read the booking from the system that
    // owns it. Everything else is the mock's plain "Canvas / Gradescope" pill.
    const verified = source.textContent === "PrairieTest";
    source.classList.add("exam-src");
    if (verified) source.classList.add("exam-src--verified");
    source.prepend(icon(verified ? "verified" : "sync"));
    dropSeparator(source);
  }

  const where = row.querySelector<HTMLElement>(".row--detail-exam");
  if (where) {
    dropSeparator(where);
    row.append(examLine("place", where));
  }
}

/**
 * The card's own qualifier line — the one `rows.ts` writes from a caller's
 * `dueText.detail`, and not the ones it writes for a moved or unreadable
 * deadline, which say something this view has no better place for.
 */
function plainDetail(row: HTMLElement): HTMLElement | null {
  return row.querySelector<HTMLElement>(
    ".row--detail:not(.row--detail-moved):not(.row--detail-error)",
  );
}

/** One glyph-led line across the card's grid. */
function examLine(glyph: IconName, ...body: Node[]): HTMLElement {
  const line = document.createElement("span");
  line.className = "exam-line";
  line.append(icon(glyph), ...body);
  return line;
}

/** The "·" `rows.ts` puts before a meta chunk, once that chunk has left the line. */
function dropSeparator(el: Element): void {
  const previous = el.previousElementSibling;
  if (previous?.classList.contains("row--sep")) previous.remove();
}

/**
 * "Reserve a seat" — the one high-contrast control in the whole design.
 *
 * A `<button>`, not an `<a>`: the card is itself an `<a>` on every booking that
 * has a URL, and a nested anchor is invalid markup — the browser closes the
 * outer one and the press opens the row's link instead. Same reason the undo
 * control in `rows.ts` is a button, and the same two `event` calls, for the
 * same reason.
 *
 * No URL, no button. PrairieTest is where a sitting is booked, and a button
 * that goes nowhere is worse than a card that tells you to go there yourself.
 */
function reserveButton(item: Item): HTMLElement | undefined {
  const url = safeUrl(item.url);
  if (!url) return undefined;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "exam-reserve";
  button.title = "Open the booking page for this exam";
  const label = document.createElement("span");
  label.className = "exam-reserve--label";
  const dot = document.createElement("span");
  dot.className = "exam-reserve--dot";
  dot.setAttribute("aria-hidden", "true");
  label.append(dot, document.createTextNode("Reserve a seat"));
  const arrow = document.createElement("span");
  arrow.className = "exam-reserve--arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "→";
  button.append(label, arrow);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    chrome.tabs.create({ url });
  });
  return button;
}

/**
 * The date *and* the day, unlike every other view.
 *
 * Elsewhere the grid or the heading already says which day, so the row carries
 * only a clock. This list spans a whole term, so a bare "7:00 PM" would be the
 * least useful thing it could say.
 */
function examWhen(
  placed: PlacedItem,
  now: Date,
): { primary: string; detail?: string } {
  const at = new Date(placed.anchor.at);
  const day = at.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const clock = at.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const days = Math.round(
    (startOfDay(at).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
  const away =
    days === 0
      ? "today"
      : days === 1
        ? "tomorrow"
        : days > 0
          ? `in ${days}d`
          : undefined;
  return { primary: `${day} ${clock}`, detail: away };
}

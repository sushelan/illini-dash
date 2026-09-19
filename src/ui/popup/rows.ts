/**
 * One deadline, as a row, plus the small formatters every view shares.
 *
 * Every view in this folder ends up here: the agenda, the week's day boxes, the
 * exam board and the attention groups all draw the same element, which is why
 * "a false merge is visible" (§5.3) and "a time we invented is in italics"
 * (worker rule 3) only have to be true in one place.
 */

import { movedByText } from "../../core/suggest.js";
import { itemTone } from "../../core/calendar.js";
import { examDetail, formatDue, movedText, type SectionName } from "../../core/grouping.js";
import { courseLabel, SOURCE_CODE, SOURCE_NAME } from "../../core/names.js";
import { qualityFlags, unreadableDeadline, unreadableSummary } from "../../core/quality.js";
import { iconButton } from "../icons.js";
import type { Item } from "../../sources/types.js";
import { safeUrl, state } from "./state.js";
import { applySuggestionRequest, openRowMenu } from "./shell.js";

export function renderRow(
  item: Item,
  now: Date,
  section: SectionName | undefined,
  dueText?: { primary: string; detail?: string },
  colours?: Map<string, number>,
): HTMLElement {
  /*
   * An `<a>`, not a `<div>` with a click handler.
   *
   * Every row in this list opened a page and none of them could be reached by
   * keyboard: Tab went from the tab strip straight past a screenful of
   * deadlines to whatever came after. A div also cannot be middle-clicked,
   * cannot be copied as a link, and announces as nothing.
   *
   * Rows with no safe URL stay a `<div>` — an `<a>` with no `href` is not
   * focusable and announces as a link that goes nowhere, which is worse than a
   * plain row.
   */
  const url = safeUrl(item.url);
  const row = document.createElement(url ? "a" : "div");
  row.className = "row";
  if (url && row instanceof HTMLAnchorElement) {
    row.href = url;
    // Rolled by `makeRowsNavigable` once the view is drawn: one stop for the
    // whole list, then ↑ ↓ inside it.
    row.tabIndex = -1;
    row.addEventListener("click", (event) => {
      // `chrome.tabs.create` rather than the browser's own navigation: a popup
      // navigating itself away leaves a 400px window showing Gradescope.
      event.preventDefault();
      chrome.tabs.create({ url });
    });
    row.addEventListener("keydown", (event) => {
      // Shift+F10 and the context-menu key are what a list row is expected to
      // answer; `.` is the shorthand every mail client uses.
      if (
        (event.shiftKey && event.key === "F10") ||
        event.key === "ContextMenu" ||
        event.key === "."
      ) {
        event.preventDefault();
        const trigger = row.querySelector<HTMLElement>(".row--menu");
        if (trigger) openRowMenu(item, trigger);
      }
    });
  }
  // The course colour is on the row, not only in the legend: a chip strip you
  // have to look up is a lookup table, and the point of colour is to answer
  // "whose is this" without reading.
  if (colours?.has(item.courseLabel)) {
    row.classList.add(`course-${colours.get(item.courseLabel)!}`);
  }
  // The one decision, from core, so the month grid cannot disagree with the
  // list about whether a deadline is done. `open` earns no class.
  const tone = itemTone(item, now);
  if (tone !== "open") row.classList.add(`row-${tone}`);

  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = courseLabel(item.courseLabel, state.courseNames) || "—";

  const title = document.createElement("span");
  title.className = "row--title";
  title.textContent = item.title;
  title.title = item.title;

  // §4.3: not-for-credit work stays visible — some of those surveys are
  // required — but it is labelled, so half of a PrairieLearn course's page does
  // not sit in Needs attention looking exactly like graded homework.
  const practice = document.createElement("span");
  practice.className = "row--practice";
  if (item.forCredit === false) {
    practice.classList.add("chip", "chip-practice");
    practice.textContent = "practice";
    practice.title = "The source says this does not count toward your grade";
  }

  const sources = document.createElement("span");
  sources.className = "row--sources";
  // Shown on every row, not only merged ones.
  //
  // §5.3 gives one reason for these — "a merged row shows both icons, so a
  // false merge is visible" — and for a while that was read as the *only*
  // reason, so single-source rows dropped theirs to buy title width. That was
  // wrong twice over. Where an assignment lives is what tells a student which
  // site to open, and it is most of what makes a row believable; and the width
  // it was bought with came back anyway once the date column stopped repeating
  // the section heading.
  const distinct = [...new Set(item.members.map((m) => m.source))];
  sources.textContent = distinct.map((source) => SOURCE_CODE[source]).join(" ");
  sources.title =
    distinct.length > 1
      ? `One deadline, seen by ${distinct.length} sources: ` +
        `${distinct.map((source) => SOURCE_NAME[source]).join(" and ")}. ` +
        `If they are not really the same thing, use ⋯ → Split.`
      : distinct[0] === "manual"
        ? // Not "On your own list — click the row to open it": the student wrote
          // this row, so naming a site to visit would be a lie, and a link is
          // there only if they gave one.
          `You added this${item.url ? " — click the row to open the link you gave" : ""}`
        : `On ${SOURCE_NAME[distinct[0]!]}${item.url ? " — click the row to open it" : ""}`;

  // The row is a two-line grid: title and "when" compete for line one, and
  // everything that qualifies the deadline goes on line two, which nothing else
  // is competing for. Before this the qualifiers shared the line and one row
  // was left with five pixels of title.
  const due = document.createElement("span");
  due.className = "row--due";
  const details: {
    text: string;
    className: string;
    title?: string;
    /** An item id turns this line into one with an "undo" beside it. */
    undo?: string;
  }[] = [];

  const unreadable = unreadableDeadline(item);
  if (unreadable.length > 0) {
    // A row whose date could not be read says so, rather than reading "no date"
    // — which is what a genuinely undated row says, and the two are opposites.
    due.classList.add("row--unreadable");
    due.textContent = "unreadable";
    details.push({
      text: unreadableSummary(unreadable)!,
      className: "row--detail row--detail-error",
      // The raw text the parser could not make sense of, as text so a hostile
      // page cannot use this path (§8.1's rendering rule).
      title: unreadable
        .map((flag) => `${flag.source} ${flag.field}: ${flag.detail ?? "(no value)"}`)
        .join("\n"),
    });
  } else if (dueText !== undefined) {
    // An empty primary is the untimed band's case: the band already said what
    // the column would, and §8.1's whole width argument is that a column
    // repeating its heading is spending the title's characters.
    due.textContent = dueText.primary;
    if (dueText.detail) details.push({ text: dueText.detail, className: "row--detail" });
  } else {
    const formatted = formatDue(item, now, section);
    due.textContent = formatted.primary;
    if (item.timeAssumed) {
      // The marker is terse by design; the sentence it replaced lives here, so
      // "no time" is explained on the one row a student stops to ask about.
      due.classList.add("row--assumed");
      due.title =
        "The course site gives a date but no time. Check the course page for the cutoff.";
    }
    if (formatted.detail) {
      details.push({ text: formatted.detail, className: "row--detail" });
    }
  }

  const soft = qualityFlags(item).filter((flag) => !flag.blocksDate);
  if (soft.length > 0 && unreadable.length === 0) {
    // Dated, but something else on the row did not parse. A mark, not a
    // section: the deadline itself is intact.
    const mark = document.createElement("span");
    mark.className = "row--flag";
    mark.textContent = "!";
    mark.title = soft
      .map((flag) => `${flag.source} ${flag.field}${flag.detail ? `: ${flag.detail}` : ""}`)
      .join("\n");
    due.append(document.createTextNode(" "), mark);
  }

  // §4.4's room and duration, parsed since the source was written and never
  // shown. An exam is the one deadline where "where" has a wrong answer.
  const exam = examDetail(item);
  if (exam) details.push({ text: exam, className: "row--detail row--detail-exam" });

  // A post's correction says so permanently and offers a way out; a deadline
  // that simply differed from last sync's says so until the next one. Both are
  // "moved", and only the first has anywhere to press: `movedFrom` is derived
  // per sync and would have nothing to undo.
  const movedByPost = movedByText(item);
  if (movedByPost) {
    details.push({
      text: movedByPost,
      className: "row--detail row--detail-moved",
      title: item.movedBy?.reason,
      undo: item.id,
    });
  } else {
    const moved = movedText(item);
    if (moved) details.push({ text: moved, className: "row--detail row--detail-moved" });
  }

  // Visible at 35% rather than `opacity: 0` until hover. A control nobody can
  // see is a control nobody learns, and this one carries Mark done, Hide,
  // Split and Merge — the whole of §5.3's correction story.
  const menu = iconButton("more", "More actions");
  menu.classList.add("row--menu", "btn-sm");
  menu.tabIndex = -1;
  menu.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openRowMenu(item, menu);
  });

  // The practice chip lives *inside* the name cell rather than in a track of
  // its own. A conditional grid child shifts every column after it, and an
  // empty track still sizes differently from a filled one — either way the
  // dates stop lining up, which is the one thing fixed tracks are for. In the
  // name cell only the rows that have a chip pay for it, out of their own
  // title width.
  const name = document.createElement("span");
  name.className = "row--name";
  name.append(title);
  if (item.forCredit === false) name.append(practice);

  row.append(chip, name, sources, due, menu);

  for (const detail of details) {
    const line = document.createElement("span");
    line.className = detail.className;
    line.textContent = detail.text;
    if (detail.title) line.title = detail.title;
    if (detail.undo !== undefined) {
      // A `<button>`, not a link: it is inside an `<a>` row on every row that
      // has a URL, and a nested anchor is invalid — the browser closes the
      // outer one and the press opens Gradescope instead of undoing anything.
      const undo = document.createElement("button");
      undo.type = "button";
      undo.className = "link row--undo";
      undo.textContent = "undo";
      undo.title = "Put this deadline back to what the source says";
      const itemId = detail.undo;
      undo.addEventListener("click", (event) => {
        // The row is a link and the menu trigger is a sibling; without both of
        // these the press opens the assignment and the undo never runs.
        event.preventDefault();
        event.stopPropagation();
        applySuggestionRequest({ type: "undo-move", itemId }, undo);
      });
      line.append(document.createTextNode(" "), undo);
    }
    row.append(line);
  }

  if (!url) row.classList.add("row--flat");
  return row;
}

/* -------------------------------------------------------------------------- */
/* Shared formatters                                                           */
/* -------------------------------------------------------------------------- */

export function clockOf(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function emptyNote(text: string): HTMLElement {
  const note = document.createElement("p");
  note.className = "muted empty";
  note.textContent = text;
  return note;
}

/**
 * §4.4: a booking row must read "sessions Sep 21–23, not booked", never
 * "due Sep 21" — the date is deliberately early because slots fill, and
 * presenting it as a deadline would be a lie.
 */
export function bookingWindowText(item: Item): { primary: string; detail?: string } {
  const start = item.members.find((m) => m.extra?.["windowStart"])?.extra?.["windowStart"];
  const end = item.members.find((m) => m.extra?.["windowEnd"])?.extra?.["windowEnd"];
  // "not booked" is the part that needs to be next to the title; the window is
  // the explanation, and it goes on the second line like every other qualifier.
  if (!start || !end) return { primary: "not booked" };
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return { primary: "not booked", detail: `sessions ${fmt(start)}–${fmt(end)}` };
}

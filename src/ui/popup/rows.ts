/**
 * One deadline, as a card, plus the small formatters every view shares.
 *
 * Every view in this folder ends up here: Today, the week's day cards, the exam
 * board and the No date groups all draw the same element, which is why "a false
 * merge is visible" (§5.3) and "a time we invented is in italics" (worker rule
 * 3) only have to be true in one place.
 *
 * **The shape is mock 1a's (brief D7).** `[course dot] Title / CODE · Source ·
 * detail` on the left, `relative / clock` on the right, on a white
 * `--surface-raised` card. Two shapes, one function:
 *
 *   default   the card above.
 *   compact   one line — `[dot] Title CODE [status]` — used by the Week's day
 *             cards and by Today's schedule. Sushi, 2026-09-19: "each item per
 *             day is too large … there's just too much information being shown".
 *
 * Everything the ruled row carried is still here; it moved lines rather than
 * disappearing. The qualifiers that are one short phrase (source, room, "opens
 * 9 AM", "time assumed", "+2 more") live on the meta line under the title,
 * which nothing else competes for; the ones that are a sentence with a control
 * in them (a move with its undo, an unreadable date) keep their own full-width
 * line under the card's grid.
 */

import { movedByText } from "../../core/suggest.js";
import { anchorOf, itemTone } from "../../core/calendar.js";
import { countdown, examDetail, formatDue, movedText, type SectionName } from "../../core/grouping.js";
import { courseLabel, SOURCE_CODE, SOURCE_NAME } from "../../core/names.js";
import { assumedTimeNote } from "../../core/provenance.js";
import { qualityFlags, unreadableDeadline, unreadableSummary } from "../../core/quality.js";
import { iconButton } from "../icons.js";
import { TWEAKS_EVENT } from "../theme-panel.js";
import type { Item } from "../../sources/types.js";
import { app, readTweaks, safeUrl, state } from "./state.js";
import { applySuggestionRequest, openRowMenu } from "./shell.js";

export interface RowOptions {
  /** One line: dot, title, code, one status word. Today and the Week. */
  compact?: boolean;
  /** A word that replaces the countdown — `weekStatus`, in the week. */
  status?: string;
  /**
   * The band this row is being drawn in has already stated its *when*, so the
   * row must not state it again.
   *
   * Sushi, 2026-09-19: "also end of day is being repeated twice, the header is
   * already end of day but the row says it again." The same shape is on the
   * rail one band down: the timeline prints "3:00 PM" in its clock column and
   * the card under it printed "3:00 PM" again.
   *
   * **Passed in, never inferred.** A row must not look upward — at a parent
   * class, at `closest()`, at the design — to decide what it says: the view is
   * the thing that knows which band it is filling, and a row that reads its own
   * surroundings is a second copy of that decision which only a draw can keep
   * true. The Week, the Month's agenda and the deadline screen do not pass it,
   * and there the row still says "end of day" and its hour, because nothing
   * else on those screens does.
   *
   * It suppresses the *clock slot only*. The "time assumed" marker beside it is
   * a different fact — worker rule 3's, that nobody stated a time and 23:59 was
   * filled in — and no heading says it, so it stays with its tooltip.
   */
  whenSaidAbove?: boolean;
}

/**
 * A tweak changed in the Appearance panel, which is a different document region
 * from the list.
 *
 * At module scope, once, rather than in a render function — the panel is drawn
 * and thrown away on every open, and a listener per open is the defect
 * `makeRowsNavigable` already had (one ArrowDown moving three rows). `state`
 * carries the answer so the row asks one place, and the redraw is what applies
 * it: a CSS-only toggle would leave the source name in the accessibility tree
 * of a student who asked for it to be gone.
 */
window.addEventListener(TWEAKS_EVENT, () => {
  state.tweaks = readTweaks();
  void app.refresh();
});

/**
 * Whether the row is drawn as a card slip rather than as a line.
 *
 * The one thing in this file that asks which design is on, and it asks the
 * root element — the same attribute `theme-panel.ts` writes and the stylesheet
 * keys on, so there is no second copy of the choice to fall out of step.
 *
 * It exists because the two shapes are **markup**, not paint. The compact row
 * never builds the source name at all, so no stylesheet can put "smartPhysics"
 * back on a card that is supposed to carry it; and the Classical design's whole
 * row is the two-line shape with a title over a meta line, which this file has
 * built all along for the list views.
 *
 * Note this reverses a decision from the same day in the *other* design, on
 * purpose: Sushi asked for one-line rows in the shipped popup ("each item per
 * day is too large"), and the Classical mock asks for card slips with the
 * source named. Both are true of their own design; neither is true of both.
 */
function cardDesign(): boolean {
  return document.documentElement.dataset.design === "classical";
}

export function renderRow(
  item: Item,
  now: Date,
  section: SectionName | undefined,
  dueText?: { primary: string; detail?: string },
  colours?: Map<string, number>,
  options: RowOptions = {},
): HTMLElement {
  // A card slip is the two-line shape, whoever asked for the one-line one.
  const asCard = cardDesign();
  if (asCard && options.compact) options = { ...options, compact: false };
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
  // A div row joins the roving ring too (R2 L3); `makeRowsNavigable` rolls it.
  if (!url) row.tabIndex = -1;
  if (options.compact) row.classList.add("row--compact");
  if (url && row instanceof HTMLAnchorElement) {
    row.href = url;
    // Rolled by `makeRowsNavigable` once the view is drawn: one stop for the
    // whole list, then ↑ ↓ inside it.
    row.tabIndex = -1;
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
    // Middle click keeps opening the source. It does not fire `click` in
    // Chrome, so the ordinary handler below cannot see it — without this the
    // press would do nothing at all, which is worse than either answer.
    row.addEventListener("auxclick", (event) => {
      if (event.button !== 1) return;
      event.preventDefault();
      chrome.tabs.create({ url });
    });
  }
  row.addEventListener("click", (raw) => {
    const event = raw as MouseEvent;
    // `chrome.tabs.create` rather than the browser's own navigation: a popup
    // navigating itself away leaves a 400px window showing Gradescope.
    event.preventDefault();
    // ⌘ / Ctrl still means "open the source in a tab" — the gesture every list
    // of links answers, and the one a student uses to get to Gradescope without
    // reading anything here first. A plain press is now the deadline screen
    // (D8), where every action on this row lives.
    if ((event.metaKey || event.ctrlKey) && url) {
      chrome.tabs.create({ url });
      return;
    }
    app.openDeadline(item);
  });
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

  const code = courseLabel(item.courseLabel, state.courseNames) || "—";

  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = code;

  const title = document.createElement("span");
  title.className = "row--title";
  title.textContent = item.title;
  title.title = item.title;

  // §4.3: not-for-credit work stays visible — some of those surveys are
  // required — but it is labelled, so half of a PrairieLearn course's page does
  // not sit in the list looking exactly like graded homework.
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
  // site to open, and it is most of what makes a row believable.
  //
  // The card has room for the *name* where the ruled row had room for a code,
  // so one source reads "Gradescope"; two or more keep the codes, because
  // "Gradescope and Course site" is the whole meta line.
  const distinct = [...new Set(item.members.map((m) => m.source))];
  sources.textContent =
    distinct.length === 1
      ? SOURCE_NAME[distinct[0]!]
      : distinct.map((source) => SOURCE_CODE[source]).join(" ");
  sources.title =
    distinct.length > 1
      ? `One deadline, seen by ${distinct.length} sources: ` +
        `${distinct.map((source) => SOURCE_NAME[source]).join(" and ")}. ` +
        `If they are not really the same thing, use ⋯ → Split.`
      : distinct[0] === "manual"
        ? // Not "On your own list — click the row to open it": the student wrote
          // this row, so naming a site to visit would be a lie, and a link is
          // there only if they gave one.
          `You added this${item.url ? " — ⌘-click to open the link you gave" : ""}`
        : `On ${SOURCE_NAME[distinct[0]!]}${item.url ? " — ⌘-click to open it" : ""}`;

  /* ---- the right-hand column, and what it is allowed to claim ------------ */

  const due = document.createElement("span");
  due.className = "row--due";
  const rel = document.createElement("span");
  rel.className = "row--rel";

  /** Short phrases under the title. A sentence with a control goes below. */
  const meta: HTMLElement[] = [];
  const details: {
    text: string;
    className: string;
    title?: string;
    /** An item id turns this line into one with an "undo" beside it. */
    undo?: string;
  }[] = [];

  const anchor = anchorOf(item, now);
  /** The clock column holds a real stated hour, not "no date" or "end of day". */
  let statedClock = false;
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
    // What the exam board and the booking strip state for themselves: "not
    // booked", a sitting's date. An empty primary is a caller saying the column
    // would only repeat what it has already written.
    due.textContent = dueText.primary;
    if (dueText.detail) details.push({ text: dueText.detail, className: "row--detail" });
  } else if (anchor === undefined) {
    due.textContent = "no date";
  } else if (anchor.opening) {
    // Nothing is due yet, so the clock slot has nothing true to put in it; the
    // meta line says what the source did state.
    meta.push(plain(`opens ${clockOf(anchor.at)}`));
    row.classList.add("row-opening");
  } else if (anchor.assumed) {
    // §4.5's runner fills in 23:59 when a course page prints a bare date, and
    // worker rule 3 is that an invented value is never presented as a stated
    // one. "end of day" is what the source actually implies; the marker beside
    // it says who said so, and carries the sentence the untimed band used to.
    // Not under a heading that is this sentence. `whenSaidAbove` is Today's
    // "By end of day" band and nothing else; the marker below it stays either
    // way, because "a time was assumed" is not what the heading said.
    if (!options.whenSaidAbove) {
      due.textContent = "end of day";
      due.classList.add("row--assumed");
    }
    // Said on the row rather than over a band of rows (brief D4) — and said
    // about *this* row: "the course site gives a date but no time" is a lie on
    // a deadline the student typed, which has no course site (2026-09-19).
    const note = assumedTimeNote(item);
    due.title = note;
    const assumed = plain("time assumed");
    assumed.classList.add("row--assumed");
    assumed.title = note;
    meta.push(assumed);
  } else {
    // The rail prints this row's hour in its own clock column, 45px to the
    // left of the card, so the card printing it again is the same duplication
    // as "end of day" one band up.
    if (!options.whenSaidAbove) due.textContent = clockOf(anchor.at);
    statedClock = true;
  }

  if (options.status !== undefined) {
    // The week's one word — `weekStatus` — which is the whole right-hand column
    // there. It already accounts for done, a late window and an assumed time,
    // so a countdown beside it would be a second answer to one question.
    rel.textContent = options.status;
  } else if (anchor !== undefined && unreadable.length === 0 && dueText === undefined) {
    rel.textContent = countdown(anchor.at, now, "coarse");
  }
  /** Inside a day of now — before it as well as after, which the colour wants. */
  const soonest = anchor !== undefined && anchor.at - now.getTime() < 86_400_000;
  /*
   * "in 16h" and "8:00 PM" are the same fact twice (Sushi, 2026-09-19: "there's
   * just too much information being shown"), so only one of them is drawn — and
   * which one depends on what the other would have told you.
   *
   * Inside a day the hour is the useful half: "8:00 PM" is where you have to be,
   * and "in 4h" is arithmetic you can do from the clock on your own screen.
   * Beyond a day the hour is the useless half — an 11:59 PM three days out says
   * nothing a student acts on — so the relative keeps the slot.
   *
   * Only a *stated* clock collapses, and only while the instant is still ahead.
   * "no date", "unreadable", "end of day" and the exam board's own `dueText` are
   * not the countdown said twice — and neither is "2h late" beside "8:00 AM",
   * where the relative is the half that says the row is *overdue* and the clock
   * says only when it went by. A late row keeps both.
   */
  const ahead = anchor !== undefined && anchor.at >= now.getTime();
  if (statedClock && ahead && options.status === undefined && rel.textContent) {
    if (soonest) rel.textContent = "";
    else due.textContent = "";
  }

  if (rel.textContent) {
    // Red once it is past, accent inside a day, muted after that. Urgency is
    // carried by this text (the mock's own note), which is why the course edge
    // beside it is a tweak and off by default.
    const late = tone === "overdue" || rel.textContent.endsWith("late");
    if (tone === "done") rel.classList.add("row--rel-done");
    else if (late) rel.classList.add("row--rel-late");
    else if (soonest) rel.classList.add("row--rel-soon");
  }

  if (dueText === undefined && unreadable.length === 0 && anchor?.opening !== true) {
    // Only the qualifier half: the primary is the clock above, which this card
    // has its own slot for. `formatDue` still owns the late window and the
    // credit remaining — but not its "not open yet", which is the meta line's
    // "opens 9:00 AM" said twice on one card.
    const formatted = formatDue(item, now, section);
    if (formatted.detail) details.push({ text: formatted.detail, className: "row--detail" });
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
  if (exam) {
    const where = plain(exam);
    where.classList.add("row--detail-exam");
    meta.push(where);
  }

  // §5.3: a merged row says how many things it is. On the meta line rather than
  // in the source slot, because it is a fact about this row and not about who
  // reported it.
  if (item.members.length > 1) meta.push(plain(`+${item.members.length - 1} more`));

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
  // see is a control nobody learns — and now that a press opens the deadline
  // screen, this is the only thing on the card that still reaches Split, Merge
  // and Rename without leaving the list.
  const menu = iconButton("more", "More actions");
  menu.classList.add("row--menu", "btn-sm");
  menu.tabIndex = -1;
  menu.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openRowMenu(item, menu);
  });

  /* ---- assembly --------------------------------------------------------- */

  const dot = document.createElement("span");
  dot.className = "row--dot";

  if (options.compact) {
    /*
     * One line, 28px: `[dot] Title  CODE  [room]  [status]`.
     *
     * The shape Today and the Week now share (Sushi, 2026-09-19: "each item per
     * day is too large", "there's just too much information being shown"). What
     * it drops is the meta line entire — the source name, the relative text, the
     * "time assumed" marker, "+N more" — none of which is lost: a press opens
     * the deadline screen, which states every one of them (D8).
     *
     * The exam room goes too (Sushi, 2026-09-19, on the first build of this
     * row). It had been kept back as the one qualifier with a *wrong* answer,
     * but "Grainger Library · Room 57…" is a second clause competing with the
     * title on a 400px line, and the two surfaces a student reads a room off —
     * the Exams tab and the deadline screen — both still carry it in full.
     */
    const short = document.createElement("b");
    short.className = "row--code";
    short.textContent = code;
    row.append(dot, title, short);
    if (item.forCredit === false) row.append(practice);
    row.append(rel, menu);
    return row;
  }

  const metaLine = document.createElement("span");
  metaLine.className = "row--meta";
  const codeEl = document.createElement("b");
  codeEl.className = "row--code";
  codeEl.textContent = code;
  metaLine.append(codeEl);
  // D14: the source word is a per-device preference, not a default. Off means
  // the element is never built — hiding it in CSS would leave it in the
  // accessibility tree of the one student who asked for it to be gone.
  // D14 makes the source word a per-device preference. The Classical card
  // states it by construction — it is a line of the card the mock draws, not
  // an extra — so there the tweak cannot turn it off.
  if (state.tweaks.showSourceNames || asCard) metaLine.append(sep(), sources);
  for (const part of meta) metaLine.append(sep(), part);
  if (item.forCredit === false) metaLine.append(sep(), practice);

  // D14, off by default: a 4px course-hue edge. An absolutely positioned
  // child rather than a border, so switching it on does not move the text.
  if (state.tweaks.urgencyEdge) {
    const edge = document.createElement("span");
    edge.className = "row--edge";
    row.append(edge);
  }
  const main = document.createElement("span");
  main.className = "row--main";
  main.append(title, metaLine);
  const when = document.createElement("span");
  when.className = "row--when";
  when.append(rel, due);
  row.append(dot, main);
  /*
   * Only when it has something to say.
   *
   * `.row--when` is `grid-area: when` in the Classical card, an `auto` row of
   * its own — so an element with two empty children still claims a line box of
   * leading under the title, which is a blank line where the duplicate used to
   * be. Left out, the named row collapses to nothing.
   */
  if (rel.textContent || due.textContent || due.childElementCount > 0) row.append(when);
  row.append(menu);

  /*
   * One trailing control per row, and it is the ⋯.
   *
   * The card used to carry a checkbox of its own here, and the Month's agenda
   * row a `›` as well, so a row ended in a tick, a ⋯ and a chevron at once
   * (Sushi, 2026-09-19: "you have 3 dots, a checkbox and an arrow, pick one
   * bro. just pick the 3 dots."). Nothing is lost: **Mark done** is the ⋯
   * menu's first item after Open, and the tick only ever called the same
   * `applyOverrideAction`.
   *
   * The No Date card's own "Tick off" button is a different control on a
   * different line and stays.
   */

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

  // Not a link, but still something to press: the deadline screen is where a
  // manual row without a URL says everything it has to say.
  if (!url) row.classList.add("row--flat");
  return row;
}

/** One chunk of the meta line. */
function plain(text: string): HTMLElement {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

/** The "·" between meta chunks. Decoration, so it is not announced. */
function sep(): HTMLElement {
  const dot = document.createElement("span");
  dot.className = "row--sep";
  dot.setAttribute("aria-hidden", "true");
  dot.textContent = "·";
  return dot;
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

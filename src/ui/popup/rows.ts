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
 * `--surface-raised` card. Three variants, one function:
 *
 *   default   the card above.
 *   hero      mock 1a's "Next up": kicker, fine countdown, 14.5px title.
 *   compact   the week's day card — code, title, one status word.
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
import { qualityFlags, unreadableDeadline, unreadableSummary } from "../../core/quality.js";
import { iconButton } from "../icons.js";
import { TWEAKS_EVENT } from "../theme-panel.js";
import type { Item } from "../../sources/types.js";
import { app, readTweaks, safeUrl, state } from "./state.js";
import { applySuggestionRequest, openRowMenu } from "./shell.js";

/** Said on the row rather than over a band of rows (brief D4). */
const ASSUMED_NOTE =
  "The course site gives a date but no time. Check the course page for the cutoff.";

export interface RowOptions {
  /** The week's day card: code, title, status word, nothing else. */
  compact?: boolean;
  /** Mock 1a's "Next up" card. */
  hero?: boolean;
  /** A word that replaces the countdown — `weekStatus`, in the week. */
  status?: string;
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

export function renderRow(
  item: Item,
  now: Date,
  section: SectionName | undefined,
  dueText?: { primary: string; detail?: string },
  colours?: Map<string, number>,
  options: RowOptions = {},
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
  if (options.hero) row.classList.add("row--hero");
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
    due.textContent = "end of day";
    due.classList.add("row--assumed");
    due.title = ASSUMED_NOTE;
    const assumed = plain("time assumed");
    assumed.classList.add("row--assumed");
    assumed.title = ASSUMED_NOTE;
    meta.push(assumed);
  } else {
    due.textContent = clockOf(anchor.at);
  }

  if (options.status !== undefined) {
    // The week's one word — `weekStatus` — which is the whole right-hand column
    // there. It already accounts for done, a late window and an assumed time,
    // so a countdown beside it would be a second answer to one question.
    rel.textContent = options.status;
  } else if (anchor !== undefined && unreadable.length === 0 && dueText === undefined) {
    rel.textContent = countdown(anchor.at, now, options.hero ? "fine" : "coarse");
  }
  if (rel.textContent) {
    // Red once it is past, accent inside a day, muted after that. Urgency is
    // carried by this text (the mock's own note), which is why the course edge
    // beside it is a tweak and off by default.
    const late = tone === "overdue" || rel.textContent.endsWith("late");
    const soon = anchor !== undefined && anchor.at - now.getTime() < 86_400_000;
    if (tone === "done") rel.classList.add("row--rel-done");
    else if (late) rel.classList.add("row--rel-late");
    else if (soon) rel.classList.add("row--rel-soon");
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

  if (options.compact) {
    // The week's card: 44px of date on the left of it already, and a status
    // word on the right. Everything else is on the Today tab or one press away.
    const short = document.createElement("b");
    short.className = "row--code";
    short.textContent = code;
    row.append(short, title, rel, menu);
    if (item.forCredit === false) title.after(practice);
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
  if (state.tweaks.showSourceNames) metaLine.append(sep(), sources);
  for (const part of meta) metaLine.append(sep(), part);
  if (item.forCredit === false) metaLine.append(sep(), practice);

  if (options.hero) {
    const head = document.createElement("span");
    head.className = "row--kicker";
    const kicker = document.createElement("span");
    kicker.className = "row--kicker-text";
    kicker.textContent = "Next up";
    const rule = document.createElement("span");
    rule.className = "row--kicker-rule";
    head.append(kicker, rule, rel);
    row.append(head, title, metaLine, menu);
    // The hero states its own clock on the meta line: it has one line for
    // "when", and a second column beside a 14.5px title would take the title's
    // width to repeat what the countdown already said.
    if (due.textContent) metaLine.append(sep(), due);
  } else {
    // D14, off by default: a 4px course-hue edge. An absolutely positioned
    // child rather than a border, so switching it on does not move the text.
    if (state.tweaks.urgencyEdge) {
      const edge = document.createElement("span");
      edge.className = "row--edge";
      row.append(edge);
    }
    const dot = document.createElement("span");
    dot.className = "row--dot";
    const main = document.createElement("span");
    main.className = "row--main";
    main.append(title, metaLine);
    const when = document.createElement("span");
    when.className = "row--when";
    when.append(rel, due);
    row.append(dot, main, when, menu);
  }

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

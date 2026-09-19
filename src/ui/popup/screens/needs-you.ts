/**
 * "Needs you" (brief D2, mock 1e): everything that is asking the student for
 * something, on one screen behind the footer strip.
 *
 * It replaces the health popover, and the replacement is the point. A popover
 * is a floating panel, and a floating panel contributes no height to the box
 * Chrome measures — the source list shipped clipped half way down its fifth row
 * for exactly that reason (UI rule 8). This renders **in document flow**: it
 * replaces `#view`, pushes nothing off the bottom edge that a scroll cannot
 * reach, and can be as tall as it needs to be.
 *
 * It also gathers three things that were in three places and are one question.
 * The Attention tab's *Overdue* group was work already late; `renderSuggestions`
 * was a post's claim waiting for a yes or a no; the popover was a source with a
 * button on it. All three are "something is waiting for you", and a student who
 * wants to know whether anything is has been made to look in three places to
 * find out. The header pill used to answer that in three words and open this;
 * the pill went on 2026-09-19 (too much on screen, and "All clear" named
 * nothing), so the footer strip's source text opens it instead.
 *
 * Every count and every sentence about a source is derived from an attempt that
 * happened — `sourceRows`, `staleNotice` and `actionFor`, the same three
 * functions Settings › Sources uses (worker rule 2).
 */

import { courseColours, coursesIn, overdueItems } from "../../../core/calendar.js";
import {
  type SourceRow,
  type StaleNotice,
  actionFor,
  sourceRows,
  staleNotice,
} from "../../../core/health.js";
import { SOURCE_NAME, SOURCE_TITLE, courseLabel } from "../../../core/names.js";
import { icon, iconButton } from "../../icons.js";
import type { Item, Source, SourceStatus, Suggestion } from "../../../sources/types.js";
import { MENU_SELECTOR, app, state, viewEl } from "../state.js";
import { renderRow } from "../rows.js";
import {
  FOOT_HEALTH_CLASS,
  actionButton,
  applyOverrideAction,
  applySuggestionRequest,
  closeMenus,
  toneFor,
} from "../shell.js";

/**
 * The body class the shell's own strips key off while this is open.
 *
 * The tab strip, the filter strip and the date navigator all describe the
 * calendar underneath, and none of them is answerable from here — the same
 * argument `.setup` makes, and the same mechanism, so there is one way a screen
 * takes the window over rather than two.
 */
const OPEN_CLASS = "needsyou";

export function needsYouIsOpen(): boolean {
  return state.screen?.kind === "needs-you";
}

/**
 * Open it, remembering nothing — the tab is already remembered.
 *
 * `state.view` is untouched, so ‹ back is "stop showing this screen" and the
 * tab that was on screen comes back with the redraw. A screen that stored and
 * restored the view itself would be a second copy of a decision `state.view`
 * already owns, and the copy would be the one that went stale.
 */
export function openNeedsYou(): void {
  if (needsYouIsOpen()) return;
  // Whatever menu the opening click left open. A menu placed against the
  // header would hang over a screen that has just replaced the document.
  closeMenus();
  state.screen = { kind: "needs-you" };
  document.body.classList.add(OPEN_CLASS);
  document.addEventListener("keydown", onKeyDown);
  // Focus lands on ‹ back once the screen is drawn: a screen that takes the
  // document over and leaves focus on <body> strands the keyboard (R2 L2).
  void app.refresh().then(() => {
    viewEl.querySelector<HTMLElement>(".screen-bar button")?.focus();
  });
}

/** ‹ back and Escape: the same thing, and focus goes back where it came from. */
/**
 * Stand the screen down without redrawing or moving focus — for a screen that
 * is about to take its place (a Late row pressed here opens the deadline
 * screen, brief D8). Back from *that* screen returns to the tab, not here.
 */
export function leaveNeedsYou(): void {
  if (!needsYouIsOpen()) return;
  state.screen = undefined;
  document.body.classList.remove(OPEN_CLASS);
  document.removeEventListener("keydown", onKeyDown);
}

export function closeNeedsYou(): void {
  if (!needsYouIsOpen()) return;
  leaveNeedsYou();
  void app.refresh().then(() => {
    // The footer is rebuilt by the redraw, so this has to run after it —
    // focusing the old button would put focus on an element no longer in the
    // document, which Chrome resolves to `<body>` and a keyboard user reads as
    // "focus vanished". One constant for the class and the selector (UI rule 7);
    // this was `.pill` until the header pill went on 2026-09-19.
    document.querySelector<HTMLElement>(`.${FOOT_HEALTH_CLASS}`)?.focus();
  });
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  // Not when a menu is open: the menu's own trap owns Escape, and closing the
  // screen out from under it would take the thing being dismissed with it.
  if (document.querySelector(MENU_SELECTOR)) return;
  event.preventDefault();
  closeNeedsYou();
}

/* -------------------------------------------------------------------------- */
/* The screen                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Drawn from whatever the last `get-state` returned, on every draw.
 *
 * **Re-rendered, not held.** A redraw that finds this screen open rebuilds it,
 * because everything on it is a claim about the store — "Gradescope signed you
 * out", "3 late", "12 items last reported" — and a screen that froze them would
 * keep asserting them after a sync fixed them. The one thing a rebuild could
 * interrupt is a menu, and `drawIsHeld` already defers a redraw for that.
 */
export function renderNeedsYou(
  items: Item[],
  sources: Record<Source, SourceStatus>,
  suggestions: readonly Suggestion[],
  now: Date,
): void {
  viewEl.replaceChildren();
  const screen = document.createElement("div");
  screen.className = "screen needsyou";

  screen.append(renderBar());

  const notice = staleNotice(sources, now);
  const banner = notice ? renderNotice(notice, sources) : undefined;
  if (banner) screen.append(banner);

  const late = overdueItems(items, now);
  const rows = sourceRows(sources, now);
  const actionable = rows.filter((row) => row.action !== undefined).length;

  if (!banner && late.length === 0 && suggestions.length === 0 && actionable === 0) {
    const clear = document.createElement("p");
    clear.className = "needsyou--clear card";
    clear.textContent = "Nothing needs you.";
    screen.append(clear);
  }

  if (late.length > 0) screen.append(renderLate(late, now));
  if (suggestions.length > 0) screen.append(renderSuggestions(suggestions));
  screen.append(renderSources(rows));
  if (notice) {
    const kept = renderKeptNote(notice, items, sources, now);
    if (kept) screen.append(kept);
  }

  viewEl.append(screen);
}

function renderBar(): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "screen-bar";
  const back = iconButton("left", "Back");
  back.addEventListener("click", () => closeNeedsYou());
  const title = document.createElement("div");
  title.className = "screen-bar--title";
  title.textContent = "Needs you";
  bar.append(back, title);
  return bar;
}

/* -------------------------------------------------------------------------- */
/* (a) The one sentence at the top                                             */
/* -------------------------------------------------------------------------- */

/**
 * The source most worth saying something about, said in one sentence.
 *
 * `staleNotice` picks it — never-succeeded first, then a login, then oldest —
 * and `actionFor` decides the button, so this cannot name a source as broken
 * and then offer nothing to press, which is the defect the popover had for a
 * month.
 */
function renderNotice(
  notice: StaleNotice,
  sources: Record<Source, SourceStatus>,
): HTMLElement | undefined {
  const line = document.createElement("div");
  line.className = "needsyou--notice";
  const glyph = icon("warning");
  glyph.classList.add("needsyou--notice-glyph");

  const text = document.createElement("span");
  text.className = "needsyou--notice-text";
  text.textContent = noticeSentence(notice);

  line.append(glyph, text);
  const button = actionButton(
    actionFor(notice.source, notice.state, sources[notice.source]?.loginUrl),
  );
  if (button) line.append(button);
  // The exact message the site answered with, for the one student in ten who
  // wants to know whether it is the cookie or the page.
  if (notice.lastError) line.title = notice.lastError;
  return line;
}

function noticeSentence(notice: StaleNotice): string {
  const name = SOURCE_NAME[notice.source];
  if (notice.hours === undefined) {
    return notice.needsLogin
      ? `${name} has never been signed in, so nothing from it is listed.`
      : `${name} has never been read, so nothing from it is listed.`;
  }
  const ago = notice.hours < 48 ? `${notice.hours} hours ago` : `${Math.floor(notice.hours / 24)} days ago`;
  if (notice.needsLogin) return `${name} signed you out ${ago}.`;
  if (notice.state === "parse_error") return `${name} last looked different ${ago}.`;
  return `${name} last answered ${ago}.`;
}

/* -------------------------------------------------------------------------- */
/* (b) Late                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The Attention tab's Overdue group, with its two answers on the row.
 *
 * On the tab these were rows with a ⋯ on them, which is where every correction
 * in this project used to live and where the row-menu bug hid for four days. A
 * late deadline has exactly two answers — you did it, or you do not want to see
 * it — so both are buttons, and both go through `applyOverrideAction`, which
 * owns the "Applying…" caption, the `.catch` and the log line (UI rules 2 and
 * 4).
 */
function renderLate(late: Item[], now: Date): HTMLElement {
  const wrap = document.createElement("section");
  wrap.className = "needsyou--group";
  wrap.append(sectionHead("Late", String(late.length)));

  const colours = courseColours(coursesIn(late));
  for (const item of late) {
    const holder = document.createElement("div");
    holder.className = "needsyou--item";
    // The same row the calendar draws. "Needs attention" is what makes the due
    // column relative ("3d ago") rather than a clock nobody needs on something
    // already past.
    holder.append(renderRow(item, now, "Needs attention", undefined, colours));

    const actions = document.createElement("div");
    actions.className = "needsyou--actions";
    const done = document.createElement("button");
    done.type = "button";
    done.className = "btn btn-secondary btn-sm";
    done.textContent = "Mark done";
    done.title = "Take it off the list — you handed it in";
    done.addEventListener("click", () => {
      applyOverrideAction({ kind: "done", itemId: item.id }, done);
    });
    const hide = document.createElement("button");
    hide.type = "button";
    hide.className = "btn btn-sm";
    hide.textContent = "Hide";
    hide.title = "Take it off the list without saying it is done";
    hide.addEventListener("click", () => {
      applyOverrideAction({ kind: "hide", itemId: item.id }, hide);
    });
    actions.append(done, hide);
    holder.append(actions);
    wrap.append(holder);
  }
  return wrap;
}

/* -------------------------------------------------------------------------- */
/* (c) Found in a post                                                         */
/* -------------------------------------------------------------------------- */

/** What the row calls each observer. "from a Campuswire post". */
const SUGGESTION_SOURCE: Record<Suggestion["source"], string> = {
  piazza: "Piazza post",
  campuswire: "Campuswire post",
  paste: "pasted post",
};

/**
 * Deadlines a post stated that no source lists (§4.6), with Add and Ignore.
 *
 * Moved here from the Attention tab unchanged in every respect a student can
 * see: the same two buttons, the same provenance line, the same verbatim span
 * as the tooltip rather than as a label — the row has to stay one line, and the
 * sentence the instructor typed is evidence a student wants only when they
 * doubt the row.
 */
function renderSuggestions(suggestions: readonly Suggestion[]): HTMLElement {
  const wrap = document.createElement("section");
  wrap.className = "needsyou--group";
  const head = sectionHead("Found in a post", String(suggestions.length));
  head.title =
    "Deadlines read out of an instructor's post that no source lists. " +
    "Nothing here is on your calendar until you add it.";
  wrap.append(head);

  for (const suggestion of suggestions) {
    const row = document.createElement("div");
    row.className = "row row--flat row--suggestion";

    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent =
      courseLabel(suggestion.courseCode ?? suggestion.courseRaw, state.courseNames) || "—";

    const name = document.createElement("span");
    name.className = "row--name";
    const title = document.createElement("span");
    title.className = "row--title";
    title.textContent = suggestion.title;
    title.title = suggestion.title;
    name.append(title);

    const when = new Date(suggestion.at);
    const due = document.createElement("span");
    due.className = "row--due";
    due.textContent = Number.isNaN(when.getTime())
      ? "—"
      : when.toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
    if (suggestion.timeAssumed) {
      // Worker rule 3 at the surface: the post named a day, this code named the
      // hour, and the row must not present the two as the same kind of fact.
      due.classList.add("row--assumed");
      due.title = "The post gives a day but no time. 11:59 PM is this extension's guess.";
    }

    const actions = document.createElement("span");
    actions.className = "row--detail row--suggestion-actions";
    const provenance = document.createElement("span");
    provenance.className = "muted needsyou--from";
    /*
     * Name the post when the suggestion knows it — but only when the name says
     * something the title has not.
     *
     * "from a Piazza post" is true of all seven rows the first live sync
     * produced, which makes it useless for telling them apart. And a
     * subject-derived title quoted back one line below itself drew the same 90
     * characters twice, which is what Sushi's live Attention tab did. Older
     * suggestions have no `postSubject` at all (worker rule 8's shape, one
     * store version down) and keep the original sentence.
     */
    const postSubject = typeof suggestion.postSubject === "string" ? suggestion.postSubject : "";
    const names = postSubject !== "" && postSubject.trim() !== suggestion.title.trim();
    provenance.textContent = names
      ? `from the ${SUGGESTION_SOURCE[suggestion.source] ?? "post"} “${postSubject}”`
      : `from a ${SUGGESTION_SOURCE[suggestion.source] ?? "post"}`;
    // The instructor's own words, as text. §8.1's rendering rule: a post is
    // remote content and never becomes markup here.
    provenance.title = names ? `${postSubject}\n\n${suggestion.span}` : suggestion.span;
    actions.append(provenance);

    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn-primary btn-sm";
    add.textContent = "Add";
    add.title = "Add this to your own list";
    add.addEventListener("click", () => {
      applySuggestionRequest({ type: "accept-suggestion", id: suggestion.id }, add);
    });

    const ignore = document.createElement("button");
    ignore.type = "button";
    ignore.className = "btn btn-sm";
    ignore.textContent = "Ignore";
    ignore.title = "Take this suggestion off the list";
    ignore.addEventListener("click", () => {
      applySuggestionRequest({ type: "dismiss-suggestion", id: suggestion.id }, ignore);
    });

    actions.append(add, ignore);
    row.append(chip, name, due, actions);
    // The whole row is the tooltip's home as well, so a student who hovers
    // anywhere on it sees the sentence rather than having to find the label.
    row.title = suggestion.context;
    wrap.append(row);
  }
  return wrap;
}

/* -------------------------------------------------------------------------- */
/* (d) Sources                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Every source, its state, when it was last read, and the one thing to do.
 *
 * The popover's `.srow` in a card, with the same three facts and the same
 * `actionButton` — so Sign in, Allow, Turn on and Retry all behave exactly as
 * they did, including the recheck-on-return that `NAVIGATED_KEY` drives and the
 * permission request that has to happen inside the click.
 *
 * **The detail line says only what `sourceRows` gives it.** Mock 1e shows "6
 * courses · 2m ago" and "31 items" beside each source; core counts neither, and
 * a number this file invented would be a number the student trusts (worker rule
 * 3). The state word and the last read are what an attempt actually produced.
 */
function renderSources(rows: SourceRow[]): HTMLElement {
  const wrap = document.createElement("section");
  wrap.className = "needsyou--group";
  wrap.append(sectionHead("Sources"));

  const list = document.createElement("div");
  list.className = "needsyou--list";

  for (const row of rows) {
    const line = document.createElement("div");
    line.className = "needsyou--source";

    const dot = document.createElement("i");
    dot.className = `needsyou--dot is-${toneFor(row.state)}`;

    const text = document.createElement("div");
    text.className = "needsyou--source-text";
    const name = document.createElement("div");
    name.className = "needsyou--source-name";
    // `SOURCE_TITLE`, not `SOURCE_NAME`: this is a label in a list, and "the
    // course website" reads as a sentence fragment between Canvas and
    // PrairieTest.
    name.textContent = SOURCE_TITLE[row.source];
    const detail = document.createElement("div");
    detail.className = `needsyou--source-detail is-${toneFor(row.state)}`;
    detail.textContent = row.lastRead ? `${row.word} · last read ${row.lastRead}` : row.word;
    if (row.lastReadExact || row.lastError) {
      detail.title = [row.lastError, row.lastReadExact && `last read ${row.lastReadExact}`]
        .filter(Boolean)
        .join("\n");
    }
    text.append(name, detail);

    line.append(dot, text);
    const button = actionButton(row.action);
    if (button) line.append(button);
    list.append(line);
  }

  wrap.append(list);
  return wrap;
}

/* -------------------------------------------------------------------------- */
/* (e) "Nothing was dropped"                                                   */
/* -------------------------------------------------------------------------- */

/**
 * What a failed source did *not* cost, in one sentence.
 *
 * `runSync`'s failure branch keeps a source's previously fetched rows on
 * purpose, so the list does not go blank — and nothing on screen ever said so.
 * A student who reads "Gradescope signed you out 6 days ago" has every reason
 * to assume six days of Gradescope deadlines are missing, and the reassurance
 * is the difference between fixing it today and fixing it in a panic.
 *
 * Only when there is something to reassure about: a source that has never
 * succeeded has no rows behind it, and the sentence would be a lie in the exact
 * shape §11 ranks worst.
 */
function renderKeptNote(
  notice: StaleNotice,
  items: Item[],
  sources: Record<Source, SourceStatus>,
  now: Date,
): HTMLElement | undefined {
  if (notice.hours === undefined) return undefined;
  const kept = items.filter((item) =>
    item.members.some((member) => member.source === notice.source),
  ).length;
  if (kept === 0) return undefined;
  const lastRead = sourceRows(sources, now).find((row) => row.source === notice.source)?.lastRead;
  if (!lastRead) return undefined;

  const note = document.createElement("p");
  note.className = "needsyou--kept card";
  const lead = document.createTextNode(
    `Nothing was dropped while ${SOURCE_NAME[notice.source]} was out — the ${kept} item${
      kept === 1 ? "" : "s"
    } it last reported ${kept === 1 ? "is" : "are"} still on your calendar, marked `,
  );
  const stamp = document.createElement("b");
  stamp.textContent = `last seen ${lastRead}`;
  note.append(lead, stamp, document.createTextNode("."));
  return note;
}

/* -------------------------------------------------------------------------- */

function sectionHead(label: string, count?: string): HTMLElement {
  const head = document.createElement("div");
  head.className = "section-head";
  const text = document.createElement("span");
  text.textContent = label;
  head.append(text);
  if (count !== undefined) {
    const right = document.createElement("span");
    right.textContent = count;
    head.append(right);
  }
  return head;
}

/**
 * **Alerts** (2026-09-19): one tab for everything that is asking the student
 * for something.
 *
 * It replaces two destinations. The No date tab held rows a source listed
 * without a date and rows whose date could not be read; the Needs-you *screen*,
 * opened from the footer strip, held late work, deadlines found in posts, and
 * every source with a button on it. Sushi, looking at the running extension:
 * "why is needs you in sources … combine no date and needs you in the same tab,
 * pick better names." He is right that they were one question — *is anything
 * waiting for me?* — asked in two places, one of which was a screen with no tab
 * and no badge, reachable only by pressing a status line.
 *
 * So it is a view, not a screen: it is remembered like any tab, it wears a
 * badge that counts what is on it (`alertCount`), and the footer's source
 * button selects it rather than opening something in front of the calendar.
 *
 * The order is "what has a deadline behind it" first and "what is merely
 * unfinished" last: the stale-source notice (which may mean *everything* below
 * it is incomplete, so it goes above everything), then Late, then a post's
 * claim waiting for a yes, then the two undated groups, then the sources
 * themselves, then the two reassurances. A source with a button on it sits
 * below the student's own work on purpose — it is this extension's problem, and
 * the tab is about theirs.
 *
 * Every count and every sentence about a source is derived from an attempt that
 * happened — `sourceRows`, `staleNotice`, `actionFor` and `observerRows`
 * (worker rule 2). §8.1's rendering rule holds throughout: every string that
 * came off a page is inserted with `textContent`.
 */

import {
  type AttentionName,
  courseColours,
  coursesIn,
  noDateCount,
  noDateGroups,
  overdueItems,
} from "../../../core/calendar.js";
import {
  type SourceRow,
  type StaleNotice,
  actionFor,
  sourceRows,
  staleNotice,
} from "../../../core/health.js";
import { SOURCE_NAME, SOURCE_TITLE, courseLabel } from "../../../core/names.js";
import { unreadableDeadline } from "../../../core/quality.js";
import { icon } from "../../icons.js";
import type { Item, Source, SourceStatus, Suggestion } from "../../../sources/types.js";
import { app, state, viewEl } from "../state.js";
import { renderRow } from "../rows.js";
import { renderObserverRows } from "../observers.js";
import { actionButton, applyOverrideAction, applySuggestionRequest, toneFor } from "../shell.js";

/**
 * What each group means, as the tooltip on its rows.
 *
 * All three, including `Overdue`, whose sentence the Late section does not draw
 * but whose meaning is defined here with the other two: the record is the one
 * place these sentences are written, and two copies would be the
 * `resolveColumn` finding in prose.
 */
export const ATTENTION_NOTE: Record<AttentionName, string> = {
  Overdue: "Past its deadline in the last week.",
  "Couldn't read":
    "The source printed a date this extension could not make sense of, so these have no place on the calendar. They are the deadlines it is least sure about.",
  "No date at all": "Listed by a source with no deadline on it anywhere.",
};

/**
 * Said once, over the two undated groups, rather than on every row.
 *
 * It answers the question those groups raise — "why is this not on my calendar,
 * and is it about to ambush me?" — and the answer is the same for every row
 * under it. Only that answer: it used to open with "A source listed these but
 * gave no date anywhere", which is `ATTENTION_NOTE["No date at all"]` said a
 * second time in different words, printed directly under it (Sushi, 2026-09-19,
 * on the real tab). Four lines above the first card, in the popup whose
 * recurring bug is height — and the sentence was not even true of the second
 * group it was written to cover, whose rows *did* carry a date nobody could
 * read. `ATTENTION_NOTE` stays the one record of what a group means; this says
 * the one thing it does not, which is what happens to the rows.
 */
const UNDATED_EXPLAINER =
  "They are kept out of the calendar and out of the badge, so they cannot bury anything " +
  "that is actually due.";

export function renderAlertsView(
  items: Item[],
  owed: Item[],
  sources: Record<Source, SourceStatus>,
  suggestions: readonly Suggestion[],
  now: Date,
  colours: Map<string, number>,
): void {
  const wrap = document.createElement("div");
  // `needsyou` stays the class, though the tab is called Alerts: it is what
  // three stylesheets spell, and renaming it would be an edit in two sheets
  // another pass owns to change nothing anyone can see.
  wrap.className = "screen needsyou alerts";

  const notice = staleNotice(sources, now);
  const banner = notice ? renderNotice(notice, sources) : undefined;
  if (banner) wrap.append(banner);

  const late = overdueItems(items, now);
  const rows = sourceRows(sources, now);
  const actionable = rows.filter((row) => row.action !== undefined).length;
  const undated = noDateCount(owed, now);

  if (
    !banner &&
    late.length === 0 &&
    suggestions.length === 0 &&
    undated === 0 &&
    actionable === 0
  ) {
    // Not "nothing here": that would be a claim about the term. This says what
    // was actually checked.
    const clear = document.createElement("p");
    clear.className = "needsyou--clear card";
    clear.textContent = "Nothing needs you — everything a source listed has a date.";
    wrap.append(clear);
  }

  if (late.length > 0) wrap.append(renderLate(late, now));
  if (suggestions.length > 0) wrap.append(renderSuggestions(suggestions));
  wrap.append(...renderUndated(owed, now, colours));
  wrap.append(renderSources(rows, now));
  if (notice) {
    const kept = renderKeptNote(notice, items, sources, now);
    if (kept) wrap.append(kept);
  }
  // The dashed "Add something by hand" card that used to close this tab is gone
  // (Sushi, 2026-09-19: "remove the add something by hand in the alerts"). Adding
  // by hand is the header's `+` on every tab, and the floating `+` on Day, Week and
  // Month; this screen is for what the sources DID report and could not place.
  viewEl.append(wrap);
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
 * Work already past its deadline, with its two answers on the row.
 *
 * A late deadline has exactly two answers — you did it, or you do not want to
 * see it — so both are buttons rather than a ⋯, and both go through
 * `applyOverrideAction`, which owns the "Applying…" caption, the `.catch` and
 * the log line (UI rules 2 and 4).
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
 * The same two buttons, the same provenance line, the same verbatim span as the
 * tooltip rather than as a label — the row has to stay one line, and the
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

  /*
   * One list, hairline-ruled, rather than four floating rows.
   *
   * The same card the Sources section below is drawn as, so the two halves of
   * this tab read as siblings.
   */
  const list = document.createElement("div");
  list.className = "sug-list";

  for (const suggestion of suggestions) {
    /*
     * **Not `.row`.** It was `row row--flat row--suggestion`, and that is the
     * defect Sushi reported on 2026-09-19: "why is the name of the assignment
     * on the needs you page to the right, like mp3 is on the right side."
     *
     * `design-classical.css` gives every `#view .row` a card grid —
     * `minmax(0,1fr) auto auto`, areas `main tick menu` over `when when when`.
     * This row's four children carried none of `.row--main`, `.row--when` or
     * `.row--menu`, so they auto-placed in source order: the course chip took
     * the 224px flexible column, the **title landed in a 34px `auto` column**
     * and the date took the 93px after it. Measured on the real document, that
     * is a title stranded near the right edge of its own row.
     *
     * So the row stops claiming to be a calendar card and states its own two
     * lines: the course and the title together, then everything about them.
     */
    const row = document.createElement("div");
    row.className = "sug-row";

    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent =
      courseLabel(suggestion.courseCode ?? suggestion.courseRaw, state.courseNames) || "—";

    // Line one: the code, then the title beside it. "it should be right next to
    // course number" — the shape the Week's rows already use.
    const head = document.createElement("div");
    head.className = "sug-head";
    const title = document.createElement("span");
    title.className = "sug-title";
    title.textContent = suggestion.title;
    title.title = suggestion.title;
    head.append(chip, title);

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
    actions.className = "sug-actions";
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
    /*
     * Line two: the two answers, then the facts.
     *
     * The buttons come **first in source order** because they float right; a
     * float only shortens the lines beside it, so a wrapped provenance
     * reclaims the row's full width underneath them. As a flex item they would
     * take their width out of every line of the sentence instead.
     */
    const line = document.createElement("div");
    line.className = "sug-line";
    const facts = document.createElement("span");
    facts.className = "sug-facts";
    facts.append(due, sep(), provenance);
    line.append(actions, facts);

    row.append(head, line);
    // The whole row is the tooltip's home as well, so a student who hovers
    // anywhere on it sees the sentence rather than having to find the label.
    row.title = suggestion.context;
    list.append(row);
  }
  wrap.append(list);
  return wrap;
}

/** The "·" between two facts. Decoration, so it is not announced. */
function sep(): HTMLElement {
  const dot = document.createElement("span");
  dot.className = "row--sep";
  dot.setAttribute("aria-hidden", "true");
  dot.textContent = "·";
  return dot;
}

/* -------------------------------------------------------------------------- */
/* (d) No date at all, and Couldn't read                                       */
/* -------------------------------------------------------------------------- */

/**
 * The two undated groups, each a heading, its note and its cards.
 *
 * Nothing here is folded. On the old Attention tab, "No date at all" was a
 * `<details>` because it never empties and it was burying the actionable
 * groups; here the actionable groups are *above* it, so the argument for
 * folding is gone. What these rows get instead is three buttons each — **Give
 * it a date**, **Tick off**, **Hide** — because "listed with no date" is a
 * state a student can end, and the old tab offered no way to end it.
 *
 * The section headings lost their "Section 1 ·" ordinals when this became the
 * Alerts tab: they counted the groups on a tab those two groups were the whole
 * of, and on a page where they are the third and fourth of five sections the
 * number is simply false.
 */
function renderUndated(owed: Item[], now: Date, colours: Map<string, number>): HTMLElement[] {
  const out: HTMLElement[] = [];
  let first = true;
  for (const group of noDateGroups(owed, now)) {
    if (group.items.length === 0) continue;
    if (!first) {
      // The classical double rule between the two sections.
      const rule = document.createElement("div");
      rule.className = "nodate-rule";
      out.push(rule);
    }

    const heading = document.createElement("div");
    heading.className = "section-head nodate-group--head";
    const label = document.createElement("span");
    label.className = "nodate-group--name";
    const name = document.createElement("span");
    name.textContent = group.name;
    const hair = document.createElement("span");
    hair.className = "nodate-group--hair";
    label.append(name, hair);
    const count = document.createElement("span");
    count.className = "nodate-group--count";
    // "3 items", not "3": the number sits over two sections and a bare digit
    // beside a heading reads as an index.
    //
    // "Couldn't read" counts in `1 ambiguous` rather than in items, and that is
    // a true statement about it: every row in it is one whose date text this
    // extension could not resolve. "No date at all"'s rows are not ambiguous —
    // they have no date text at all — so they keep the plain count.
    //
    // One predicate, two consequences. Section one's count is a navy block and
    // the peach is kept for "Couldn't read" alone, so the sections do not read
    // as equals; the sheet's base rule is the navy one and this class is what
    // switches the second back. Written once rather than tested twice.
    const ambiguous = group.name === "Couldn't read";
    if (ambiguous) count.classList.add("nodate-group--count--soft");
    const n = group.items.length;
    count.textContent = ambiguous ? `${n} ambiguous` : n === 1 ? "1 item" : `${n} items`;
    heading.append(label, count);

    const groupNote = document.createElement("p");
    groupNote.className = "nodate-group--note";
    // The first of the two carries the sentence that explains both, because it
    // is the first one a student meets; the second says only what it is.
    groupNote.textContent = first
      ? `${ATTENTION_NOTE[group.name]} ${UNDATED_EXPLAINER}`
      : ATTENTION_NOTE[group.name];

    const stack = document.createElement("div");
    stack.className = "nodate-stack";
    for (const item of group.items) stack.append(renderNoDateCard(item, group.name, now, colours));
    out.push(heading, groupNote, stack);
    first = false;
  }
  return out;
}

/**
 * One row, and the three things that can be done to it.
 *
 * The row itself is `renderRow` — the same object it is on every other tab,
 * with the same ⋯, the same course colour and the same "unreadable" column —
 * and the actions are a line under it rather than a menu, because this tab
 * exists to be *answered* and a correction behind two clicks is one nobody
 * makes.
 */
function renderNoDateCard(
  item: Item,
  group: AttentionName,
  now: Date,
  colours: Map<string, number>,
): HTMLElement {
  const card = document.createElement("div");
  card.className = "card nodate-card";
  // The group's sentence, on the row it applies to. The section heading above
  // names the group; this is what it means, for the student who hovers.
  card.title = ATTENTION_NOTE[group];

  const unreadable = group === "Couldn't read" ? unreadableDeadline(item) : [];
  // Read once: the peach edge and the flag chip are two faces of the same fact,
  // and two copies of the test are two chances to disagree. (There was a third,
  // the trailing glyph, until it became the second control in the corner.)
  const unread = unreadable.length > 0;

  /*
   * No trailing glyph.
   *
   * There used to be one at the card's top right — a tray for "listed without a
   * date", a question mark for "date text could not be read" — and its defence
   * was semantic: decorative, `aria-hidden`, asserting only what the card
   * knows. That defence answers a question nobody asked. Sushi's objection is
   * about what the corner *looks like*, and he made it once already, of the
   * calendar row, in these words: "why do you have 3 dots, a checkbox and an
   * arrow, pick one bro. just pick the 3 dots." An 18px outlined box sitting
   * 18px above the ⋯ reads as a second button whether or not it is one; it was
   * measured at (347, 781) with the menu at (338, 789), which is the same
   * corner. e60f4c4 took the extra control off every other row and this card
   * was the one that kept it.
   *
   * Both glyphs go, not just the tray, because the objection does not care
   * which icon it is. Nothing is lost that was not already on the card in
   * words: "listed without a date" is the section heading two blocks up, and
   * "the date text could not be read" is the amber **Ambiguous date text** chip
   * on its own line below, the peach edge on the card, and the quoted source
   * text under the title. The `title` tooltips go with them — both repeated
   * `ATTENTION_NOTE[group]`, which is still the card's own `title`.
   */

  if (unread) {
    card.classList.add("nodate-card--unread");
    /*
     * The amber marker, on a line of its own above the row.
     *
     * Beside the course chip would mean reaching into `rows.ts`'s row to insert
     * a child, which is how two files end up owning one. A line above it is the
     * same mark in the same colour, and this file keeps owning every element it
     * builds.
     */
    const flag = document.createElement("div");
    flag.className = "nodate-flag";
    const chip = document.createElement("span");
    chip.className = "chip chip-check";
    chip.append(icon("warning"));
    const chipText = document.createElement("span");
    chipText.textContent = "Ambiguous date text";
    chip.append(chipText);
    chip.title = ATTENTION_NOTE["Couldn't read"];
    flag.append(chip);
    card.append(flag);
  }

  // `"Needs attention"` so `formatDue` keeps its relative precision.
  card.append(renderRow(item, now, "Needs attention", undefined, colours));

  /*
   * The source text, quoted.
   *
   * `parseField` kept the text it could not read in `extra.unparsed*` and
   * `qualityFlags` hands it back as `detail`, so this quotes what the page
   * actually printed rather than a phrase invented here. A flag with no
   * `detail` — the parser recorded the failure but not the value — draws no
   * box at all; an empty quotation mark pair would be a claim the source said
   * nothing, which is the opposite of what happened.
   */
  const quoted = unreadable.find((flag) => flag.detail !== undefined && flag.detail !== "");
  if (quoted !== undefined) {
    const box = document.createElement("blockquote");
    box.className = "nodate-source";
    // The quotation mark at the head of the box. The label and the quotation go
    // in one block beside it so the mark stays outside the text and a wrapped
    // quotation lines up under itself rather than under it.
    box.append(icon("format-quote"));
    const body = document.createElement("span");
    body.className = "nodate-source--body";
    const boxLabel = document.createElement("span");
    boxLabel.className = "nodate-source--label";
    // `SOURCE TEXT: "…"`, one line of running text rather than a field and a
    // value — the colon is what makes the quotation read as evidence.
    boxLabel.textContent = "Source text:";
    const text = document.createElement("span");
    text.className = "nodate-source--text";
    // `textContent`, never markup: the string came off a page this extension
    // does not control (§8.1's rendering rule).
    text.textContent = `“${quoted.detail!}”`;
    body.append(boxLabel, text);
    box.append(body);
    card.append(box);
  }

  const actions = document.createElement("div");
  actions.className = "nodate-actions";

  const give = document.createElement("button");
  give.type = "button";
  /*
   * One appearance for all three: white ground, `#dcd4c3` edge, 4px radius,
   * 10px serif — they differ only in ink. An earlier pass filled this one on
   * the unreadable card, which made the row with the *least* certain date carry
   * the loudest control on the tab; the emphasis belongs to the ink instead,
   * and the card's peach edge is what marks the row.
   */
  give.className = "btn btn-sm btn-secondary nodate-act nodate-act--give";
  give.append(icon("edit-calendar"), document.createTextNode("Give it a date"));
  give.title = "Put a date on this yourself. The source's own answer is kept underneath.";
  // Not an override sent from here: it opens the editor prefilled, and the
  // student's date is applied on save (`studentDueOverride`). The button that
  // opens a form has nothing to report and must not say "Applying…".
  give.addEventListener("click", () => app.openGiveDate(item));

  const tick = document.createElement("button");
  tick.type = "button";
  tick.className = "btn btn-sm btn-secondary nodate-act nodate-act--tick";
  tick.append(icon("check"), document.createTextNode("Tick off"));
  tick.title = "Mark this done, so it stops asking";
  // `applyOverrideAction` owns the round trip: it writes "Applying…" onto the
  // control, logs the request in *this* console, and turns a rejection into a
  // sentence on screen (UI rules 2 and 4).
  tick.addEventListener("click", () => {
    applyOverrideAction({ kind: "done", itemId: item.id }, tick);
  });

  const hide = document.createElement("button");
  hide.type = "button";
  hide.className = "btn btn-sm btn-secondary nodate-act nodate-act--hide";
  hide.append(icon("hide"), document.createTextNode("Hide"));
  hide.title = "Take this off the list entirely";
  hide.addEventListener("click", () => {
    applyOverrideAction({ kind: "hide", itemId: item.id }, hide);
  });

  actions.append(give, tick, hide);
  card.append(actions);
  return card;
}

/* -------------------------------------------------------------------------- */
/* (e) Sources                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Every source, its state, when it was last read, and the one thing to do.
 *
 * The same three facts and the same `actionButton` the popover had — so Sign
 * in, Allow, Turn on and Retry all behave exactly as they did, including the
 * recheck-on-return that `NAVIGATED_KEY` drives and the permission request that
 * has to happen inside the click.
 *
 * **Piazza and Campuswire are in this list** (2026-09-19). They were two cards
 * of a different shape underneath it, which said in layout that they were a
 * different kind of thing; they are not. `renderObserverRows` draws them as the
 * same row with the same dot, and `observerRows` keeps owning every word.
 *
 * **The detail line says only what `sourceRows` gives it.** A number this file
 * invented would be a number the student trusts (worker rule 3). The state word
 * and the last read are what an attempt actually produced.
 */
function renderSources(rows: SourceRow[], now: Date): HTMLElement {
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

  list.append(...renderObserverRows(now));

  wrap.append(list);
  return wrap;
}

/* -------------------------------------------------------------------------- */
/* (f) "Nothing was dropped", and the one card for what nothing lists          */
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

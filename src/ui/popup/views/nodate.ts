/**
 * The No date tab (D3, mock 2c): listed somewhere, dated nowhere.
 *
 * Two of the old Attention tab's three groups live here — "No date at all" and
 * "Couldn't read" — and the third, Overdue, went to the Needs-you screen with
 * the suggestions (D2). That split is the whole point of this tab: Attention
 * mixed *late work* with *rows that are not asking for anything yet*, so its
 * badge crept upward all semester and the one genuinely late row was buried
 * eleven deep.
 *
 * Nothing here is folded. On Attention, "No date at all" was a `<details>`
 * because it never empties and it was burying the actionable groups; on a tab
 * this group is the whole of, folding it would leave a screen with one word on
 * it. What it gets instead is three buttons per row — **Give it a date**,
 * **Tick off**, **Hide** — because "listed with no date" is a state a student
 * can end, and the old tab offered no way to end it.
 */

import { type AttentionName, noDateCount, noDateGroups } from "../../../core/calendar.js";
import { unreadableDeadline } from "../../../core/quality.js";
import { icon } from "../../icons.js";
import type { Item } from "../../../sources/types.js";
import { app, viewEl } from "../state.js";
import { emptyNote, renderRow } from "../rows.js";
import { applyOverrideAction } from "../shell.js";

/**
 * What each group means, as the tooltip on its rows.
 *
 * All three, including `Overdue`, which this tab does not draw: the record is
 * the one place these sentences are written, and the Needs-you screen needs the
 * third one. Two copies would be the `resolveColumn` finding in prose.
 */
export const ATTENTION_NOTE: Record<AttentionName, string> = {
  Overdue: "Past its deadline in the last week.",
  "Couldn't read":
    "The source printed a date this extension could not make sense of, so these have no place on the calendar. They are the deadlines it is least sure about.",
  "No date at all": "Listed by a source with no deadline on it anywhere.",
};

/**
 * Said once, at the top, rather than on every row.
 *
 * It answers the question the tab raises — "why is this not on my calendar, and
 * is it about to ambush me?" — and the answer is the same for every row on the
 * screen.
 */
const EXPLAINER =
  "A source listed these but gave no date anywhere. They are kept out of the calendar " +
  "and out of the badge, so they cannot bury anything that is actually due.";

export function renderNoDateView(items: Item[], now: Date, colours: Map<string, number>): void {
  const groups = noDateGroups(items, now);
  const total = noDateCount(items, now);

  // The mock's folio banner: the title, the count beside it, and the lead
  // paragraph under a rule. It keeps `.card view-note` so the designs that are
  // not Classical still get the prose card this replaces.
  const note = document.createElement("div");
  note.className = "card view-note nodate-banner";
  const head = document.createElement("div");
  head.className = "nodate-banner--head";
  const title = document.createElement("h2");
  title.className = "nodate-banner--title";
  // §6's own words. "Items" rather than a bare "Undated & unparsed" because
  // the header is the one place the tab names what is on it.
  title.textContent = "Undated & Unparsed Items";
  head.append(title);
  if (total > 0) {
    const count = document.createElement("span");
    count.className = "nodate-banner--count";
    // §6: `4 tasks`. A task is the thing a student can end — which is what the
    // three buttons under each card are for — and "items" was this tab's word
    // for the same set before the spec named it.
    count.textContent = total === 1 ? "1 task" : `${total} tasks`;
    head.append(count);
  }
  const lead = document.createElement("p");
  lead.className = "nodate-banner--lead";
  lead.textContent = EXPLAINER;
  note.append(head, lead);
  viewEl.append(note);

  if (total === 0) {
    // Not "nothing here": that would be a claim about the term. This says what
    // was actually checked — every row a source listed carries a date.
    viewEl.append(emptyNote("Everything a source listed has a date."));
    viewEl.append(renderAddCard());
    return;
  }

  /*
   * Two sections, not one list.
   *
   * The mock names them — "No date at all" and "Couldn't read" — because they
   * are answers to different questions: one is a source that never stated a
   * deadline, the other is a deadline this extension failed to read. Drawing
   * them in one stack left the card's `title` attribute as the only place that
   * distinction survived, which is nowhere a student looks.
   */
  let first = true;
  // §6 numbers the sections — `SECTION 1 · NO DATE AT ALL`. The ordinal counts
  // the sections actually drawn, not the position in `groups`: with the first
  // group empty, a hard-coded "2" would be the only section on screen.
  let ordinal = 0;
  for (const group of groups) {
    if (group.items.length === 0) continue;
    ordinal += 1;
    if (!first) {
      // The mock's classical double rule between the two sections.
      const rule = document.createElement("div");
      rule.className = "nodate-rule";
      viewEl.append(rule);
    }
    first = false;

    const heading = document.createElement("div");
    heading.className = "section-head nodate-group--head";
    const label = document.createElement("span");
    label.className = "nodate-group--name";
    const ord = document.createElement("span");
    ord.className = "nodate-group--ord";
    ord.textContent = `Section ${ordinal} \u00B7`;
    const name = document.createElement("span");
    name.textContent = group.name;
    const hair = document.createElement("span");
    hair.className = "nodate-group--hair";
    label.append(ord, name, hair);
    const count = document.createElement("span");
    count.className = "nodate-group--count";
    // "3 items", not "3": the mock counts in words because the number sits over
    // two sections and a bare digit beside a heading reads as an index.
    //
    // §6 counts section 2 in `1 ambiguous` rather than in items, and that is a
    // true statement about it: every row in "Couldn't read" is one whose date
    // text this extension could not resolve. Section 1's rows are not ambiguous
    // — they have no date text at all — so they keep the plain count.
    const n = group.items.length;
    count.textContent =
      group.name === "Couldn't read"
        ? `${n} ambiguous`
        : n === 1
          ? "1 item"
          : `${n} items`;
    heading.append(label, count);

    const groupNote = document.createElement("p");
    groupNote.className = "nodate-group--note";
    groupNote.textContent = ATTENTION_NOTE[group.name];

    const stack = document.createElement("div");
    stack.className = "nodate-stack";
    for (const item of group.items) stack.append(renderNoDateCard(item, group.name, now, colours));
    viewEl.append(heading, groupNote, stack);
  }
  viewEl.append(renderAddCard());
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
  if (unreadable.length > 0) {
    card.classList.add("nodate-card--unread");
    /*
     * The amber marker (mock 2c), on a line of its own above the row.
     *
     * The mock sets it beside the course chip, which lives inside `rows.ts`'s
     * row — reaching into that element to insert a child is how two files end
     * up owning one. A line above it is the same mark in the same colour, and
     * this file keeps owning every element it builds.
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

  // `"Needs attention"` so `formatDue` keeps its relative precision, exactly as
  // the Attention tab passed it.
  card.append(renderRow(item, now, "Needs attention", undefined, colours));

  /*
   * The source text, quoted (mock 2c's SOURCE TEXT box).
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
    const boxLabel = document.createElement("span");
    boxLabel.className = "nodate-source--label";
    // §6: `SOURCE TEXT: "…"`, one line of running text rather than a field and
    // a value — the colon is what makes the quotation read as evidence.
    boxLabel.textContent = "Source text:";
    const text = document.createElement("span");
    text.className = "nodate-source--text";
    // `textContent`, never markup: the string came off a page this extension
    // does not control (§8.1's rendering rule).
    text.textContent = `\u201C${quoted.detail!}\u201D`;
    box.append(boxLabel, text);
    card.append(box);
  }

  const actions = document.createElement("div");
  actions.className = "nodate-actions";

  const give = document.createElement("button");
  give.type = "button";
  /*
   * One appearance for all three (§6): white ground, `#dcd4c3` edge, 4px
   * radius, 10px serif — they differ only in ink. An earlier pass filled this
   * one on the unreadable card, which made the row with the *least* certain
   * date carry the loudest control on the tab; §6 gives the emphasis to the
   * ink instead, and the card's peach edge is what marks the row.
   */
  give.className = "btn btn-sm btn-secondary nodate-act nodate-act--give";
  give.textContent = "Give it a date";
  give.title = "Put a date on this yourself. The source's own answer is kept underneath.";
  // Not an override sent from here: it opens the editor prefilled, and the
  // student's date is applied on save (`studentDueOverride`). The button that
  // opens a form has nothing to report and must not say "Applying…".
  give.addEventListener("click", () => app.openGiveDate(item));

  const tick = document.createElement("button");
  tick.type = "button";
  tick.className = "btn btn-sm btn-secondary nodate-act nodate-act--tick";
  tick.textContent = "Tick off";
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
  hide.textContent = "Hide";
  hide.title = "Take this off the list entirely";
  hide.addEventListener("click", () => {
    applyOverrideAction({ kind: "hide", itemId: item.id }, hide);
  });

  actions.append(give, tick, hide);
  card.append(actions);
  return card;
}

/**
 * "Add something by hand", at the foot of the tab.
 *
 * Dashed, because it is the one card on the screen that is not a thing that
 * exists yet. It is here rather than only in the header's `+` because this is
 * the tab a student lands on when a deadline they know about is missing — the
 * question "where do I put the one nothing listed" is asked here.
 */
function renderAddCard(): HTMLElement {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "card card--dashed nodate-add";
  const plus = icon("plus");
  const label = document.createElement("span");
  label.className = "nodate-add--label";
  label.textContent = "Add something by hand";
  const hint = document.createElement("span");
  hint.className = "muted";
  hint.textContent = "no site lists it";
  card.append(plus, label, hint);
  card.addEventListener("click", () => app.openAddEditor());
  return card;
}

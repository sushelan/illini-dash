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
  const note = document.createElement("div");
  note.className = "card view-note";
  note.textContent = EXPLAINER;
  viewEl.append(note);

  const groups = noDateGroups(items, now);
  const total = noDateCount(items, now);

  if (total === 0) {
    // Not "nothing here": that would be a claim about the term. This says what
    // was actually checked — every row a source listed carries a date.
    viewEl.append(emptyNote("Everything a source listed has a date."));
    viewEl.append(renderAddCard());
    return;
  }

  const heading = document.createElement("div");
  heading.className = "section-head";
  const label = document.createElement("span");
  label.textContent = "Waiting on a date";
  const count = document.createElement("span");
  count.textContent = String(total);
  heading.append(label, count);
  viewEl.append(heading);

  const stack = document.createElement("div");
  stack.className = "nodate-stack";
  for (const group of groups) {
    for (const item of group.items) stack.append(renderNoDateCard(item, group.name, now, colours));
  }
  viewEl.append(stack, renderAddCard());
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
  // The group's sentence, on the row it applies to. The two groups are drawn in
  // one list (mock 2c) rather than under two headings, so the row is the only
  // place left that knows which of them it came from.
  card.title = ATTENTION_NOTE[group];

  // `"Needs attention"` so `formatDue` keeps its relative precision, exactly as
  // the Attention tab passed it.
  card.append(renderRow(item, now, "Needs attention", undefined, colours));

  const actions = document.createElement("div");
  actions.className = "nodate-actions";

  if (group === "Couldn't read") {
    /*
     * The amber `check` chip (mock 2c).
     *
     * On the actions line rather than inside the row: the row is
     * `rows.ts`'s object and reaching into it to insert a child is how two
     * files end up owning one element. The row already says "unreadable" in
     * its date column and names the field underneath it; this is the mark
     * that the *card* is the one this extension is at fault for.
     */
    const chip = document.createElement("span");
    chip.className = "chip chip-check";
    chip.textContent = "check";
    chip.title = ATTENTION_NOTE["Couldn't read"];
    actions.append(chip);
  }

  const give = document.createElement("button");
  give.type = "button";
  give.className = "btn btn-sm btn-secondary";
  give.textContent = "Give it a date";
  give.title = "Put a date on this yourself. The source's own answer is kept underneath.";
  // Not an override sent from here: it opens the editor prefilled, and the
  // student's date is applied on save (`studentDueOverride`). The button that
  // opens a form has nothing to report and must not say "Applying…".
  give.addEventListener("click", () => app.openGiveDate(item));

  const tick = document.createElement("button");
  tick.type = "button";
  tick.className = "btn btn-sm btn-secondary";
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
  hide.className = "btn btn-sm btn-secondary";
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

/**
 * The suggestion rows a post produced (§4.6), and what the row calls each
 * observer.
 *
 * Lifted out of `views/attention.ts` unchanged when D3 split that tab in two.
 * The undated half became `views/nodate.ts`; these rows belong to the Needs-you
 * screen behind the header pill (D2), which is another file again — so they
 * wait here rather than being rewritten twice.
 *
 * `renderSuggestions` appends to `viewEl` exactly as it did on the Attention
 * tab, and is exported so the Needs-you screen can call it.
 */

import { courseLabel } from "../../core/names.js";
import type { Suggestion } from "../../sources/types.js";
import { state, viewEl } from "./state.js";
import { applySuggestionRequest } from "./shell.js";

/** What the row calls each observer. "from a Campuswire post". */
export const SUGGESTION_SOURCE: Record<Suggestion["source"], string> = {
  piazza: "Piazza post",
  campuswire: "Campuswire post",
  paste: "pasted post",
};

/**
 * Deadlines a post stated, at the top of the Attention tab.
 *
 * At the top because it is the only section here that is asking a question. The
 * rest of this tab reports; these two buttons are the whole of Sushi's decision
 * that a *new* deadline is suggested rather than applied, and a suggestion
 * folded below three groups of undated rows is a suggestion nobody answers.
 *
 * The verbatim span is the tooltip rather than the label: the row has to be one
 * line, and the sentence the instructor actually typed is the evidence a
 * student wants only when they doubt the row.
 */
export function renderSuggestions(suggestions: readonly Suggestion[]): void {
  if (suggestions.length === 0) return;
  const heading = document.createElement("h2");
  heading.className = "section";
  heading.textContent = `Found in a post (${suggestions.length})`;
  heading.title =
    "Deadlines read out of an instructor's post that no source lists. " +
    "Nothing here is on your calendar until you add it.";
  viewEl.append(heading);

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
    // Laid out here rather than in `popup.css`, which another change owns this
    // week. `.row--detail` is one clipped line of prose — the buttons landed on
    // top of the sentence — and this is the whole of the difference.
    actions.style.display = "flex";
    actions.style.alignItems = "center";
    actions.style.gap = "6px";
    const provenance = document.createElement("span");
    provenance.className = "muted";
    /*
     * Name the post when the suggestion knows it.
     *
     * "from a Piazza post" is true of all seven rows the first live sync
     * produced, which makes it useless for deciding whether any one of them is
     * the deadline you were looking for. The subject is what the student saw on
     * Piazza. Older suggestions have no `postSubject` — worker rule 8's shape,
     * one store version down — and keep the original sentence rather than
     * drawing empty quotes.
     */
    const postSubject = typeof suggestion.postSubject === "string" ? suggestion.postSubject : "";
    /*
     * …but only when it says something the title has not.
     *
     * A subject-derived title is now cut at its first break, so the usual row
     * is "MP1 Demo Signups May have moved location" over the whole subject in
     * quotes, which is worth the line. When the title *is* the whole subject —
     * a short one, with nothing to cut — the line quoted the row's own title
     * back at it, one line below itself. Sushi's live Attention tab drew the
     * same 90 characters twice for exactly this reason.
     */
    const names = postSubject !== "" && postSubject.trim() !== suggestion.title.trim();
    provenance.textContent = names
      ? `from the ${SUGGESTION_SOURCE[suggestion.source]} “${postSubject}”`
      : `from a ${SUGGESTION_SOURCE[suggestion.source]}`;
    /*
     * One line, clipped — UI rule 8, and the reason the span is a tooltip
     * rather than a label.
     *
     * A post's subject is as long as the instructor felt like making it, and
     * without this the provenance wrapped onto a second line, grew the row, and
     * pushed Add and Ignore down. Every height bug in this popup is the same
     * 600px ceiling in a different costume, and a suggestion whose buttons are
     * below the fold is one nobody answers.
     */
    provenance.style.flex = "1 1 auto";
    provenance.style.minWidth = "0";
    provenance.style.overflow = "hidden";
    provenance.style.textOverflow = "ellipsis";
    provenance.style.whiteSpace = "nowrap";
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
    viewEl.append(row);
  }
}

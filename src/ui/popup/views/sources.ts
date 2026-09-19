/**
 * **Sources** (2026-09-19): every source, what it last did, and the one thing
 * to press.
 *
 * It was the last section of the Alerts tab, under late work, a post's claims
 * and two groups of undated rows — about 900px down a 600px window, which is
 * UI house rule 8 in its usual costume. Sushi, on the running extension: "the
 * sources page in alerts should be in the sources tab after i click on it at
 * the top of the popup." So the sources are a tab of their own, reached from
 * the strip like every other destination and from the footer strip's health
 * button, which is the sentence about the sources and now selects the tab that
 * expands it.
 *
 * Three things move here together, because all three are statements about a
 * *source* rather than about the student's work: the stale notice ("Gradescope
 * signed you out 6 days ago", with its button), the list itself, and the
 * "nothing was dropped" reassurance that only makes sense beside the notice.
 * Alerts keeps what is asking the student for something.
 *
 * Every word on this tab is derived from an attempt that happened —
 * `sourceRows`, `staleNotice`, `actionFor` and `observerRows` (worker rule 2).
 * A source that is off, unconfigured or never read says that, and a green dot
 * means "I fetched, and it was fine".
 */

import {
  type SourceRow,
  type StaleNotice,
  actionFor,
  sourceRows,
  staleNotice,
} from "../../../core/health.js";
import { SOURCE_NAME, SOURCE_TITLE } from "../../../core/names.js";
import { icon } from "../../icons.js";
import type { Item, Source, SourceStatus } from "../../../sources/types.js";
import { viewEl } from "../state.js";
import { renderObserverRows } from "../observers.js";
import { actionButton, toneFor } from "../shell.js";
import { sectionHead } from "./section.js";

export function renderSourcesView(
  items: Item[],
  sources: Record<Source, SourceStatus>,
  now: Date,
): void {
  const wrap = document.createElement("div");
  // The same two classes the section wore on the Alerts tab, so every
  // `needsyou--*` rule in three stylesheets keeps applying to the same
  // elements; `.sources` is what a later sheet can key on. Renaming the
  // hooks would be an edit in sheets this pass does not own, to change
  // nothing anyone can see.
  wrap.className = "screen needsyou sources";

  const notice = staleNotice(sources, now);
  if (notice) {
    const banner = renderNotice(notice, sources);
    if (banner) wrap.append(banner);
  }

  wrap.append(renderSources(sourceRows(sources, now), now));

  if (notice) {
    const kept = renderKeptNote(notice, items, sources, now);
    if (kept) wrap.append(kept);
  }

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

export function noticeSentence(notice: StaleNotice): string {
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
/* (b) The list                                                                */
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
/* (c) "Nothing was dropped"                                                   */
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

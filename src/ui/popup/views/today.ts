/**
 * Today, as a schedule for the day (Sushi, 2026-09-19).
 *
 * In his words: "I look at everything for today and whether anything is late.
 * Next up is way too loud. I'd like the day tab to look like a schedule for the
 * day. If there's anything due at the EOD it appears at the top cuz there's no
 * time associated with it. 11:59 should be EOD. Agenda with collapsed gaps (not
 * an hour rail)."
 *
 * And, on the first build of it: *"I really prefer the timeline look, it's just
 * hard to look at the info presented otherwise."* Which is why the third band is
 * a rail rather than a flat list — the collapsed gaps stayed, the axis did not
 * come back.
 *
 * So three bands, in that order:
 *
 *   Late            everything unfinished whose instant has gone.
 *   By end of day   today's untimed rows, and the ones stated at/after 11 PM.
 *   (the timeline)  today's clocked rows on a rail, clock on the left, with a
 *                   "now" marker and the empty hours collapsed away.
 *
 * **This replaces both the hour grid and the "Next up" hero.** The hero was the
 * loud half of D4 and said in a 14.5px title what the first row of the timeline
 * says in 12px. The hour *grid* is gone for the reason `docs/ux-plan.md` §0
 * gave — an axis is the wrong shape for data that lands on the same minute — and
 * the rail below is not one: nothing is drawn to scale, no empty hour gets a
 * row, and two hours with nothing in them are one 14px dotted segment. The day
 * ‹ › navigator is gone with them — Today is anchored to now, the Week tab
 * moves.
 *
 * Nothing here decides anything: `todaySchedule` owns the three bands and their
 * order, `weekStatus` owns the word on a late row, and `quietState` owns "is
 * this a quiet day or a broken one". This file draws what they answer.
 */

import { END_OF_DAY_HEADING, LATE_HEADING, todaySchedule, weekStatus } from "../../../core/calendar.js";
import { quietState, type QuietState } from "../../../core/health.js";
import { icon } from "../../icons.js";
import type { Item, Source, SourceStatus } from "../../../sources/types.js";
import { app, state, viewEl } from "../state.js";
import { selectTab } from "../shell.js";
import { clockOf, emptyNote, renderRow } from "../rows.js";

export function renderTodayView(
  items: Item[],
  now: Date,
  colours: Map<string, number>,
  sources: Partial<Record<Source, SourceStatus>> = {},
): void {
  /*
   * The quiet state comes first, and only `quietState` may decide it.
   *
   * "Nothing due for 3 days" is a claim about every source having answered. Said
   * over one expired session it reads as "you are free" and means "I could not
   * look" (§11) — so the check is `core/health.ts`'s, which returns nothing
   * unless every checkable source succeeded, and the failure cases keep
   * `emptyStateFor`'s wording with its sign-in buttons.
   */
  const quiet = quietState(items, sources, now, state.courseNames);
  if (quiet) {
    viewEl.append(renderQuiet(quiet));
    return;
  }

  const day = todaySchedule(items, now);

  const total = day.late.length + day.endOfDay.length + day.timed.length;
  if (total > 0) viewEl.append(folio(now, total));

  if (day.late.length > 0) {
    const band = section(LATE_HEADING, day.late.length, "late");
    for (const item of day.late) {
      // `weekStatus` reads "1h late" / "2d late" on an overdue row and "late ok"
      // while a late window is still open. One formatter for the two screens
      // that say how late something is, rather than two spellings that drift.
      band.append(row(item, now, colours, weekStatus(item, now)));
    }
    viewEl.append(band);
  }

  if (day.endOfDay.length > 0) {
    // No clock and no status on these rows: the heading has already said when,
    // and a repeated "11:59 PM" down the band would be presenting an invented
    // time as a stated one (worker house rule 3) eight times over.
    const band = section(END_OF_DAY_HEADING, day.endOfDay.length);
    // `""`, not `undefined`: an absent status lets the row fall back to its own
    // countdown, and "in 13h" under a heading that already says "by end of day"
    // is the duplication this redesign exists to remove.
    for (const item of day.endOfDay) band.append(row(item, now, colours, ""));
    viewEl.append(band);
  }

  if (day.timed.length > 0) {
    viewEl.append(timeline(day.timed, now, colours));
  }

  if (day.late.length === 0 && day.endOfDay.length === 0 && day.timed.length === 0) {
    // Rows exist — `render` handles the list being empty outright — but none of
    // them are today, and some source did not answer, so `quietState` refused to
    // promise the student is free.
    viewEl.append(emptyNote("Nothing on the schedule today."));
  }
}

/**
 * The timed half of the day, as a timeline rather than a list with times on it.
 *
 * Sushi, 2026-09-19, on the first build of this tab: *"I really prefer the
 * timeline look, it's just hard to look at the info presented otherwise."* So
 * the rail is back — but it is still not an hour rail, which is the thing §0 of
 * `docs/ux-plan.md` ruled out: nothing here is drawn to scale, no empty hour
 * gets a row, and a stretch of more than two hours between two deadlines is a
 * 14px dotted segment rather than fourteen empty ones.
 *
 * Three columns on every line, so the clock, the rail and the row line up down
 * the section without a subgrid: `[clock] [rail] [row]`. The rail is a
 * pseudo-element on the middle cell of each line, so consecutive lines make one
 * continuous stroke and a line that is a gap or the "now" marker draws its own
 * variant of it.
 */
const TWO_HOURS = 2 * 60 * 60 * 1000;

function timeline(
  timed: { item: Item; anchor: { at: number } }[],
  now: Date,
  colours: Map<string, number>,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "timeline";

  /** One line of the rail: the clock cell, the rail cell, and whatever follows. */
  const line = (className: string): { el: HTMLElement; rail: HTMLElement } => {
    const el = document.createElement("div");
    el.className = className;
    const clock = document.createElement("span");
    clock.className = "tclock";
    const rail = document.createElement("span");
    rail.className = "trail";
    el.append(clock, rail);
    return { el, rail };
  };

  /*
   * The marker is drawn at the ends as well as between two rows.
   *
   * `agendaRows` deliberately refused to: a rule above the first row of a list
   * says nothing the list did not already say. A rail is the opposite case —
   * its whole job is "where am I along this", and a rail with no mark on it
   * cannot answer that, so an all-upcoming day marks the top and a day that is
   * over marks the bottom.
   */
  const marker = (): HTMLElement => {
    const { el, rail } = line("tnow");
    const mark = document.createElement("span");
    mark.className = "tnow--mark";
    rail.append(mark);
    /*
     * The anchor's own words, `Now · 11:14 AM` (classical spec §3.4).
     *
     * The bar alone says "here" and not "when", and the rail's clocks are the
     * only other times on the screen — so without the hour on it the marker
     * cannot be read against them. `aria-hidden`, because the line already
     * carries the sentence as its `aria-label` and a separator that announces
     * its label *and* its text says the time twice.
     *
     * Every design builds it; only the Classical sheet draws it
     * (`design-classical-today.css` hides it elsewhere), so no other design
     * gains an element it was not drawn with.
     */
    const label = document.createElement("span");
    label.className = "tnow--label";
    label.textContent = `Now · ${clockOf(now.getTime())}`;
    label.setAttribute("aria-hidden", "true");
    el.append(label);
    // Announced, because the marker is the one thing on this screen that is
    // pure geometry: a screen reader gets the sentence instead of the bar.
    el.setAttribute("role", "separator");
    el.setAttribute("aria-label", `Now, ${clockOf(now.getTime())}`);
    return el;
  };

  let placed = false;
  let previous: number | undefined;
  for (const entry of timed) {
    const upcoming = entry.anchor.at >= now.getTime();
    if (upcoming && !placed) {
      placed = true;
      wrap.append(marker());
    } else if (previous !== undefined && entry.anchor.at - previous > TWO_HOURS) {
      // Hours with nothing in them, said once and without a number. Between the
      // marker and a row it would be a second separator in a row, so it only
      // goes where the marker did not.
      const { el } = line("tgap");
      el.setAttribute("aria-hidden", "true");
      wrap.append(el);
    }
    previous = entry.anchor.at;

    const { el, rail } = line(upcoming ? "tline" : "tline tline--past");
    // The hue comes from the wrapper rather than from the row, because the dot
    // that carries it now sits on the rail, outside the row. `--course` is a
    // custom property, so the row inside still inherits the same value.
    const hue = colours.get(entry.item.courseLabel);
    if (hue !== undefined) el.classList.add(`course-${hue}`);
    el.firstElementChild!.textContent = clockOf(entry.anchor.at);
    const dot = document.createElement("span");
    dot.className = "tdot";
    rail.append(dot);
    // `""` rather than no status: the clock is on the left of this row, and
    // "in 4h" on the right of it is that said twice.
    el.append(row(entry.item, now, colours, ""));
    wrap.append(el);
  }
  if (!placed) wrap.append(marker());
  return wrap;
}

/** One band: its heading, then its rows. */
function section(label: string, count?: number, tone?: "late"): HTMLElement {
  const band = document.createElement("div");
  band.className = "tsection";
  const head = document.createElement("p");
  head.className = "section-head";
  /*
   * The late band's heading is the one that is coloured (classical spec §3.2:
   * the heading in terracotta, its count on the overdue wash inside a peach
   * edge). `section-head--err` is the class `popup-views.css` already uses for
   * exactly this — a band heading in `--err` — rather than a second spelling
   * of it, and the band takes a modifier of its own so the count badge can be
   * reached without a selector that also matches "By end of day".
   */
  if (tone === "late") {
    band.classList.add("tsection--late");
    head.classList.add("section-head--err");
  }
  const name = document.createElement("span");
  name.textContent = label;
  head.append(name);
  /*
   * The count, which `.section-head span:last-child` pushes to the right edge.
   *
   * "1 item" rather than "1": the band's heading is a sentence fragment
   * ("Overdue", "End of day") and a bare numeral beside one reads as a rank.
   * Spelled here rather than at each call site so the two bands cannot
   * disagree about the plural.
   */
  if (count !== undefined) {
    const tally = document.createElement("span");
    tally.textContent = `${count} item${count === 1 ? "" : "s"}`;
    head.append(tally);
  }
  band.append(head);
  return band;
}

/**
 * The folio header: what day this is, how much is on it, and which term.
 *
 * Above the bands rather than inside the first one — it is the running head of
 * the page, and the bands are its entries. The heading has to survive a 400px
 * window, so the date is the long form the mock asks for and the term is
 * dropped by CSS when the two cannot share a line.
 */
function folio(now: Date, count: number): HTMLElement {
  const head = document.createElement("div");
  head.className = "folio";

  const date = document.createElement("h1");
  date.className = "folio--date";
  date.textContent = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const tally = document.createElement("span");
  tally.className = "folio--count";
  tally.textContent = `${count} item${count === 1 ? "" : "s"}`;

  head.append(date, tally);
  return head;
}

/** The one-line row Today and the Week share. */
function row(item: Item, now: Date, colours: Map<string, number>, status?: string): HTMLElement {
  return renderRow(item, now, undefined, undefined, colours, { compact: true, status });
}

/**
 * A week with nothing in it, said as a fact rather than as an absence (D13).
 *
 * Both buttons are things to *do*, because the one screen with nothing on it is
 * the one where a student is most likely to wonder whether the extension is
 * working: "See the week" proves the list is there, and "Add something" is the
 * answer if it is not.
 */
function renderQuiet(quiet: QuietState): HTMLElement {
  const card = document.createElement("div");
  card.className = "card quiet";

  const mark = document.createElement("span");
  mark.className = "quiet--mark";
  mark.append(icon("check"));

  const headline = document.createElement("p");
  headline.className = "quiet--headline";
  headline.textContent = quiet.headline;

  const detail = document.createElement("p");
  detail.className = "quiet--detail";
  detail.textContent = quiet.detail;

  const actions = document.createElement("div");
  actions.className = "quiet--actions";

  const week = document.createElement("button");
  week.type = "button";
  week.className = "btn";
  week.textContent = "See the week";
  // The tab strip's own mechanism, so the stored view, the reset offset and the
  // redraw all happen exactly once each and in one place.
  week.addEventListener("click", () => selectTab("week"));

  const add = document.createElement("button");
  add.type = "button";
  add.className = "btn";
  add.textContent = "Add something";
  add.addEventListener("click", () => app.openAddEditor());

  actions.append(week, add);
  card.append(mark, headline, detail, actions);
  return card;
}

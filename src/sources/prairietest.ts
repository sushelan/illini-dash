/**
 * PrairieTest source (§4.4) — the CBTF exam and booking feature.
 *
 * Pure functions over a `Document`. Evidence for every selector is in
 * docs/prairietest-findings.md; where this disagrees with §4.4 the disagreement
 * is called out in a comment.
 */

import { parseDateAttribute, parseDateRangeAttribute, shortHash } from "../core/dates.js";
import { extractCourseCodes } from "../core/normalize.js";
import { KeyGuard, looksLoggedOut, sameOriginHttpsUrl, textOf } from "../core/parsing.js";
import { ParseError, type PageCtx, type RawItem } from "./types.js";

export const PRAIRIETEST_ORIGIN = "https://us.prairietest.com";

const RESERVATIONS_HEADING = "Exam reservations";
const AVAILABLE_HEADING = "Exams available for reservations";

/**
 * §0 rule 3: an empty card is legitimate and must not read as a parse error.
 * There is one wording per card — §4.4 recorded only one of them, and
 * attributed it to the wrong card. They are pooled rather than bound to their
 * own card because the spec already got that pairing wrong once; the binding
 * that matters is to a *row* (see `isEmptyRow`), not to a card.
 */
const EMPTY_CARD = [
  "You don't have any upcoming reservations",
  "You don't currently have any exams available for reservations",
];


export function isLoginResponse(status: number, finalUrl: string, body: string): boolean {
  return looksLoggedOut(status, finalUrl, body, { loginPath: /prairietest\.com\/pt\/login/ });
}


/** §4.4: `CS 357 (Fa26): Quiz 1` → title without the term, plus the term. */
export function splitTerm(raw: string): { title: string; term?: string } {
  const found = /\s*\(((?:Fa|Sp|Su|Wi)\s*\d{2})\)\s*/i.exec(raw);
  if (!found) return { title: raw.trim() };
  return {
    title: (raw.slice(0, found.index) + " " + raw.slice(found.index + found[0].length))
      .replace(/\s+/g, " ")
      .replace(/\s+:/g, ":")
      .trim(),
    term: found[1],
  };
}

/**
 * §3.1 as amended (docs/sourceid-decision.md): keyed on the exam title, because
 * the booked row links to `/pt/student/reservation/{id}` and that id changes
 * whenever the student reschedules — observed directly, 3573947 → 3607740 for
 * the same Quiz 1 between two captures a week apart.
 */
export function examKey(title: string): string {
  return shortHash(title.toLowerCase().replace(/\s+/g, " ").trim());
}

/** The card whose `h2` heading matches, or undefined when it is not present. */
function cardFor(doc: Document, heading: string): Element | undefined {
  return Array.from(doc.querySelectorAll(".card")).find(
    (card) => textOf(card.querySelector(".card-header h2")) === heading,
  );
}

/**
 * An empty-state row: no data hook, and one of the cards' own wordings.
 *
 * Both halves matter. Matching the marker anywhere in the card's subtree — as
 * this first did — lets an exam titled "…You don't have any upcoming
 * reservations quiz", or a CSS-hidden empty-state element left in the DOM
 * beside a real row, blank the entire card with no error. Requiring the absence
 * of `[data-testid="exam"]` alone would be worse still: an unrecognised
 * wording would then make every empty card look like a redesign.
 */
function isEmptyRow(row: Element): boolean {
  if (row.querySelector('[data-testid="exam"]')) return false;
  return EMPTY_CARD.some((marker) => textOf(row).includes(marker));
}

/** Real rows only. An empty-state row is not a row. */
function rowsOf(card: Element): Element[] {
  return Array.from(card.querySelectorAll("li.list-group-item")).filter(
    (row) => !isEmptyRow(row),
  );
}

/** Empty only when the card has rows and every one of them says so. */
function isEmptyCard(card: Element): boolean {
  const all = Array.from(card.querySelectorAll("li.list-group-item"));
  return all.length > 0 && all.every(isEmptyRow);
}

/* -------------------------------------------------------------------------- */

export function parseHome(doc: Document, page: PageCtx): RawItem[] {
  const reservations = cardFor(doc, RESERVATIONS_HEADING);
  const available = cardFor(doc, AVAILABLE_HEADING);

  // Both cards are rendered on a logged-in home page, empty or not, in both
  // captures. Requiring only that *one* survive meant a single reworded heading
  // silently deleted that card's whole contents: a booked exam vanishing with
  // no error, or §4.4's booking pseudo-item and its §7 daily nag ceasing to
  // exist. The card is named so §6's health text says which one moved.
  //
  // VERIFY (n=1 for the empty case): whether PrairieTest renders the available
  // card at all for a student with no CBTF-enabled courses. If it does not,
  // this trades a silent drop for a spurious parse_error and the reservations
  // card should be the only unconditional one. See PROGRESS.md.
  if (!reservations || !available) {
    const missing = [
      reservations ? undefined : RESERVATIONS_HEADING,
      available ? undefined : AVAILABLE_HEADING,
    ]
      .filter(Boolean)
      .join(" and ");
    throw new ParseError(`missing PrairieTest card: ${missing}`);
  }

  const items: RawItem[] = [];
  /** Titles that are booked, for §4.4's cross-card check. */
  const bookedTitles = new Set<string>();
  /**
   * Emitted keys. This source's key is purely content-derived — no course
   * instance, no term — so a collision is likelier here than anywhere else, and
   * §3's `raw` map is keyed by memberKey: two items sharing one key silently
   * become one, losing a real exam session or a daily nag.
   */
  const keys = new KeyGuard();

  /* ---- Booked exams ------------------------------------------------------ */

  if (reservations && !isEmptyCard(reservations)) {
    const rows = rowsOf(reservations);
    if (rows.length === 0) {
      throw new ParseError("reservations card is neither empty nor has rows");
    }

    for (const row of rows) {
      const examCell = row.querySelector('[data-testid="exam"]');
      const raw = textOf(examCell);
      if (!raw) throw new ParseError("reservation row with no exam title");

      const { title, term } = splitTerm(raw);
      const key = examKey(title);
      keys.claim(key, `exam key for ${JSON.stringify(title)}`);
      bookedTitles.add(key);

      // §4.4: the right-hand column's instant. Read from the attribute, never
      // from the visible text, which is not a fixed format — on the day of an
      // exam it renders as "today, 9pm (CDT)".
      const dateSpan = row.querySelector('[data-testid="date"] [data-format-date]');
      const dateAttr = dateSpan?.getAttribute("data-format-date");
      // A missing hook is structural and stays loud. An unreadable *value* costs
      // its own field, matching Gradescope and PrairieLearn: one bad attribute
      // must not discard the other card's items, and PrairieTest is a single
      // page, so a throw here is 100% of the source rather than one course.
      if (!dateAttr) throw new ParseError(`reservation "${title}" has no date attribute`);

      const extra: Record<string, string> = {};
      let dueAt: string | undefined;
      try {
        dueAt = parseDateAttribute(dateAttr);
      } catch (err) {
        extra["unparsedDate"] = dateAttr.slice(0, 200);
        console.warn(
          `[prairietest] unreadable date for ${title}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
      if (term) extra["term"] = term;

      const locationCell = row.querySelector('[data-testid="location"]');
      if (locationCell) {
        const link = textOf(locationCell.querySelector("a"));
        if (link) extra["location"] = link;
        const detail = textOf(locationCell.querySelector("small"));
        if (detail) extra["locationDetail"] = detail;
      }

      // §4.4: "50min, In-person, No accommodations" — the only column with no
      // testid, so it is found by elimination rather than by position.
      const columns = Array.from(row.querySelectorAll("div[class*='col-']"));
      const detailsCell = columns.find((column) => !column.hasAttribute("data-testid"));
      const details = textOf(detailsCell).split(",").map((part) => part.trim()).filter(Boolean);
      if (details[0]) extra["duration"] = details[0];
      if (details[1]) extra["format"] = details[1];
      if (details[2]) extra["accommodations"] = details[2];

      const href = examCell?.querySelector("a[href]")?.getAttribute("href");
      const reservationId = /\/reservation\/(\d+)/.exec(href ?? "")?.[1];
      // Recorded but deliberately not used as the key: it changes on reschedule.
      if (reservationId) extra["reservationId"] = reservationId;

      const codes = extractCourseCodes(title);
      if (codes.length > 1) extra["altCodes"] = codes.join(" ");

      items.push({
        source: "prairietest",
        sourceId: key,
        courseRaw: codes[0] ?? title,
        courseCode: codes[0],
        title,
        kind: "exam",
        dueAt,
        url: sameOriginHttpsUrl(href, PRAIRIETEST_ORIGIN, page.url),
        // §4.4: `status` means "submitted", which is not meaningful for a seat.
        status: "unknown",
        extra,
        fetchedAt: page.fetchedAt,
      });
    }
  }

  /* ---- Exams open for booking but not booked ----------------------------- */

  if (available && !isEmptyCard(available)) {
    const rows = rowsOf(available);
    if (rows.length === 0) {
      throw new ParseError("available card is neither empty nor has rows");
    }

    for (const row of rows) {
      const raw = textOf(row.querySelector('[data-testid="exam"]'));
      if (!raw) throw new ParseError("available row with no exam title");

      const { title, term } = splitTerm(raw);
      const key = examKey(title);

      // §4.4: unbooked = present in the available card AND absent from the
      // reservations card. Matched on title, because the two cards carry
      // different ids — the booked row has only a reservation id.
      if (bookedTitles.has(key)) continue;

      // Checked *after* the cross-card skip: a booked exam that also remains
      // listed as available is the case §4.4 deliberately refuses to depend on,
      // and must not start throwing.
      const bookingKey = `${key}:booking`;
      keys.claim(bookingKey, `booking key for ${JSON.stringify(title)}`);

      const rangeSpan = row.querySelector('[data-testid="dates"] [data-format-date-range]');
      const rangeAttr = rangeSpan?.getAttribute("data-format-date-range");
      if (!rangeAttr) throw new ParseError(`available exam "${title}" has no date range`);

      const extra: Record<string, string> = {
        // §4.4: dueAt is deliberately early — slots fill, and by the time the
        // window opens the good ones are gone. The UI must word this as
        // "sessions Sep 21–23, not booked", never "due Sep 21".
        deadlineIsEstimate: "true",
      };
      let window: { start: string; end: string } | undefined;
      try {
        window = parseDateRangeAttribute(rangeAttr);
        extra["windowStart"] = window.start;
        extra["windowEnd"] = window.end;
      } catch (err) {
        // Emitted undated rather than dropped: an un-booked exam the student
        // still has to reserve is exactly what §0 rule 3 forbids losing.
        extra["unparsedDateRange"] = rangeAttr.slice(0, 200);
        console.warn(
          `[prairietest] unreadable reservation window for ${title}:`,
          err instanceof Error ? err.message : String(err),
        );
      }

      const href = row.querySelector('[data-testid="action"] a[href]')?.getAttribute("href");
      const examId = /\/exam\/(\d+)/.exec(href ?? "")?.[1];
      if (term) extra["term"] = term;
      // Present only on this card; the booked row has no exam id at all.
      if (examId) extra["examId"] = examId;

      const codes = extractCourseCodes(title);
      if (codes.length > 1) extra["altCodes"] = codes.join(" ");

      items.push({
        source: "prairietest",
        sourceId: bookingKey,
        courseRaw: codes[0] ?? title,
        courseCode: codes[0],
        title: `Book a slot: ${title}`,
        kind: "booking",
        dueAt: window?.start,
        url: sameOriginHttpsUrl(href, PRAIRIETEST_ORIGIN, page.url),
        status: "not_submitted",
        extra,
        fetchedAt: page.fetchedAt,
      });
    }
  }

  return items;
}

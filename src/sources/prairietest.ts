/**
 * PrairieTest source (§4.4) — the CBTF exam and booking feature.
 *
 * Pure functions over a `Document`. Evidence for every selector is in
 * docs/prairietest-findings.md; where this disagrees with §4.4 the disagreement
 * is called out in a comment.
 */

import { parseDateAttribute, parseDateRangeAttribute, shortHash } from "../core/dates.js";
import { extractCourseCodes } from "../core/normalize.js";
import { ParseError, type PageCtx, type RawItem } from "./types.js";

export const PRAIRIETEST_ORIGIN = "https://us.prairietest.com";

const RESERVATIONS_HEADING = "Exam reservations";
const AVAILABLE_HEADING = "Exams available for reservations";

/**
 * §0 rule 3: an empty card is legitimate and must not read as a parse error.
 * One string per card — §4.4 recorded only the reservations one, and attributed
 * it to the wrong card.
 */
const EMPTY_CARD = [
  "You don't have any upcoming reservations",
  "You don't currently have any exams available for reservations",
];

function textOf(node: Element | null | undefined): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function isLoginResponse(status: number, finalUrl: string, body: string): boolean {
  if (status === 401 || status === 403) return true;
  const url = finalUrl.toLowerCase();
  if (url.includes("shibboleth") || url.includes("login.illinois.edu")) return true;
  if (/prairietest\.com\/pt\/login/.test(url)) return true;
  return /<title>[^<]*\b(log ?in|sign ?in)\b/i.test(body);
}

function absoluteUrl(raw: string | null | undefined, fallback: string): string {
  if (typeof raw !== "string" || raw === "") return fallback;
  try {
    const url = new URL(raw, PRAIRIETEST_ORIGIN);
    return url.protocol === "https:" && url.origin === PRAIRIETEST_ORIGIN
      ? url.toString()
      : fallback;
  } catch {
    return fallback;
  }
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

function isEmptyCard(card: Element): boolean {
  const text = textOf(card);
  return EMPTY_CARD.some((marker) => text.includes(marker));
}

function rowsOf(card: Element): Element[] {
  return Array.from(card.querySelectorAll("li.list-group-item"));
}

/* -------------------------------------------------------------------------- */

export function parseHome(doc: Document, page: PageCtx): RawItem[] {
  const reservations = cardFor(doc, RESERVATIONS_HEADING);
  const available = cardFor(doc, AVAILABLE_HEADING);

  // Both cards are always rendered on a logged-in home page, empty or not.
  // Neither present means this is not the page we think it is (§0 rule 3).
  if (!reservations && !available) {
    throw new ParseError("no exam reservation cards on the PrairieTest home page");
  }

  const items: RawItem[] = [];
  /** Titles that are booked, for §4.4's cross-card check. */
  const bookedTitles = new Set<string>();

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
      bookedTitles.add(key);

      // §4.4: the right-hand column's instant. Read from the attribute, never
      // from the visible text, which is not a fixed format — on the day of an
      // exam it renders as "today, 9pm (CDT)".
      const dateSpan = row.querySelector('[data-testid="date"] [data-format-date]');
      const dateAttr = dateSpan?.getAttribute("data-format-date");
      if (!dateAttr) throw new ParseError(`reservation "${title}" has no date attribute`);
      const dueAt = parseDateAttribute(dateAttr);

      const extra: Record<string, string> = {};
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
        url: absoluteUrl(href, page.url),
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

      const rangeSpan = row.querySelector('[data-testid="dates"] [data-format-date-range]');
      const rangeAttr = rangeSpan?.getAttribute("data-format-date-range");
      if (!rangeAttr) throw new ParseError(`available exam "${title}" has no date range`);
      const { start, end } = parseDateRangeAttribute(rangeAttr);

      const href = row.querySelector('[data-testid="action"] a[href]')?.getAttribute("href");
      const examId = /\/exam\/(\d+)/.exec(href ?? "")?.[1];

      const extra: Record<string, string> = {
        windowStart: start,
        windowEnd: end,
        // §4.4: dueAt is deliberately early — slots fill, and by the time the
        // window opens the good ones are gone. The UI must word this as
        // "sessions Sep 21–23, not booked", never "due Sep 21".
        deadlineIsEstimate: "true",
      };
      if (term) extra["term"] = term;
      // Present only on this card; the booked row has no exam id at all.
      if (examId) extra["examId"] = examId;

      const codes = extractCourseCodes(title);
      if (codes.length > 1) extra["altCodes"] = codes.join(" ");

      items.push({
        source: "prairietest",
        sourceId: `${key}:booking`,
        courseRaw: codes[0] ?? title,
        courseCode: codes[0],
        title: `Book a slot: ${title}`,
        kind: "booking",
        dueAt: start,
        url: absoluteUrl(href, page.url),
        status: "not_submitted",
        extra,
        fetchedAt: page.fetchedAt,
      });
    }
  }

  return items;
}

/**
 * PrairieLearn source (§4.3).
 *
 * Pure functions over a `Document`. Evidence for every selector is in
 * docs/prairielearn-findings.md, which also records three places where the real
 * markup differs from §4.3's example; each is called out in a comment below.
 */

import {
  isNoEndMarker,
  isRealWallClock,
  inferYear,
  monthIndex,
  parsePrairieLearnScheduleDate,
  wallClockToIso,
} from "../core/dates.js";
import { extractCourseCodes } from "../core/normalize.js";
import {
  KeyGuard,
  looksLoggedOut,
  sameOriginHttpsUrl,
  textOf,
} from "../core/parsing.js";
import {
  ParseError,
  type PageCtx,
  type RawItem,
  type Status,
} from "./types.js";

export const PRAIRIELEARN_ORIGIN = "https://us.prairielearn.com";

/** §4.3: UIUC course instances are America/Chicago; the cell text carries no zone. */
const COURSE_ZONE = "America/Chicago";

export interface CreditTier {
  credit: number;
  start?: string;
  end?: string;
}

export function isLoginResponse(
  status: number,
  finalUrl: string,
  body: string,
): boolean {
  return looksLoggedOut(status, finalUrl, body, {
    loginPath: /prairielearn\.com\/pl\/login/,
  });
}

/* -------------------------------------------------------------------------- */
/* The access-details schedule (§4.3 primary)                                  */
/* -------------------------------------------------------------------------- */

/**
 * Parses the credit schedule out of the `?` button's `data-bs-content`.
 *
 * §12 open question 1, resolved: the table is server-rendered into that
 * attribute as an escaped HTML string, so the schedule — the best-structured
 * deadline data in the project — is available without a click.
 *
 * `getAttribute` returns the *decoded* markup, which is then parsed with a
 * detached element. That is inert (no scripts, no loads) and, unlike a bare
 * `DOMParser`, works identically under linkedom.
 */
export function parseCreditSchedule(
  doc: Document,
  attributeValue: string,
): CreditTier[] {
  const holder = doc.createElement("div");
  holder.innerHTML = attributeValue;

  const rows = Array.from(holder.querySelectorAll("tr"));
  const tiers: CreditTier[] = [];

  for (const row of rows) {
    // The real table opens with <tr><th>Credit</th><th>Start</th><th>End</th></tr>
    // and has no <tbody> — §4.3's example showed the reverse of both — so data
    // rows are "rows with tds", not "rows in tbody".
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 3) continue;

    const creditText = textOf(cells[0]).replace("%", "");
    const credit = Number(creditText);
    // Number("") is 0 and passes Number.isFinite, so an empty or whitespace
    // Credit cell — the likeliest degradation — would become a real 0-credit
    // tier and drag `dueAt` onto the 50% semester-long tail §4.3 rejects.
    // `1e3` and `0x10` slip through the same hole, so validate the shape.
    if (!/^\d+(?:\.\d+)?$/.test(creditText) || !Number.isFinite(credit)) {
      throw new ParseError(
        `credit schedule: non-numeric credit ${JSON.stringify(creditText)}`,
      );
    }

    const startText = textOf(cells[1]);
    const endText = textOf(cells[2]);
    tiers.push({
      credit,
      // The 0-credit row's End is an em dash, not an empty cell.
      start: isNoEndMarker(startText)
        ? undefined
        : parsePrairieLearnScheduleDate(startText),
      end: isNoEndMarker(endText)
        ? undefined
        : parsePrairieLearnScheduleDate(endText),
    });
  }

  if (tiers.length === 0) {
    throw new ParseError("credit schedule: popover present but no credit rows");
  }
  return tiers;
}

/**
 * §4.3: `dueAt` is the End of the highest-credit tier; `lateDueAt` is the End of
 * the tier immediately after it.
 *
 * Amended against the real capture: that next tier is skipped when its credit is
 * 0. One observed assessment runs `100 → 0`, where the "next tier" is simply the
 * closed state — its End is an em dash, and calling it a late deadline would be
 * wrong even if it had a date.
 */
export function deadlinesFromSchedule(tiers: CreditTier[]): {
  dueAt?: string;
  lateDueAt?: string;
} {
  let bestIndex = 0;
  for (let i = 1; i < tiers.length; i += 1) {
    const tier = tiers[i]!;
    const best = tiers[bestIndex]!;
    if (tier.credit > best.credit) bestIndex = i;
    // A tie means two full-credit windows — an extension authored as a second
    // access rule. Take the later end, or the first would be reported as the
    // deadline and the second as a "reduced-credit" one while still full credit.
    else if (
      tier.credit === best.credit &&
      best.end &&
      (!tier.end || tier.end > best.end)
    ) {
      bestIndex = i;
    }
  }
  const next = tiers[bestIndex + 1];
  return {
    dueAt: tiers[bestIndex]!.end,
    // Only a genuine drop is a late window: not a 0-credit close, and not
    // another tier at the same credit.
    lateDueAt:
      next && next.credit > 0 && next.credit < tiers[bestIndex]!.credit
        ? next.end
        : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/* The credit cell text (§4.3 fallback)                                        */
/* -------------------------------------------------------------------------- */

const CREDIT_CELL =
  /^(\d{1,3})% until (\d{1,2}):(\d{2}), (Sun|Mon|Tue|Wed|Thu|Fri|Sat), ([A-Z][a-z]{2}) (\d{1,2})$/;

/** The same shape, for an assessment that has not opened yet. */
const AVAILABLE_CELL =
  /^Available (\d{1,2}):(\d{2}), (Sun|Mon|Tue|Wed|Thu|Fri|Sat), ([A-Z][a-z]{2}) (\d{1,2})$/;

export interface CreditCell {
  credit: number;
  instant: string;
}

/**
 * §4.3's fallback: `100% until 23:59, Tue, Sep 8`. 24-hour time, a weekday, no
 * year and no zone. The zone is the course instance's (America/Chicago) and the
 * year is inferred with the weekday as a check (§3.2).
 */
/**
 * `21:15, Mon, Sep 14` → an instant, or `undefined` if it is not a real one.
 *
 * Shared by both cell shapes below. They differ only in what precedes the
 * time, and writing the resolution out twice is the mistake `resolveColumn`
 * was extracted to fix: two copies of one decision, where loosening either is
 * masked by the other staying strict.
 */
function instantFromCell(
  hour: string,
  minute: string,
  weekday: string,
  month: string,
  day: string,
  reference: string,
): string | undefined {
  const monthNumber = monthIndex(month);
  if (monthNumber === undefined) return undefined;

  const parts = {
    month: monthNumber,
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
  // The regexes admit Sep 31, Sep 0, 25:00 and 99:99. Rejecting them here sends
  // the row down the `unparsedCredit` path instead of storing a date that does
  // not exist or throwing a RangeError that would take the page with it.
  if (!isRealWallClock({ ...parts, year: 2000 })) return undefined;

  const year = inferYear(parts, weekday, reference, COURSE_ZONE);
  // The weekday contradicted every candidate year (§3.2's cross-check failing).
  if (year === undefined) return undefined;
  return wallClockToIso({ ...parts, year }, COURSE_ZONE);
}

export function parseCreditCell(
  text: string,
  reference: string,
): CreditCell | undefined {
  const match = CREDIT_CELL.exec(text.trim());
  if (!match) return undefined;
  const [, credit, hour, minute, weekday, month, day] = match;
  const instant = instantFromCell(
    hour!,
    minute!,
    weekday!,
    month!,
    day!,
    reference,
  );
  return instant === undefined
    ? undefined
    : { credit: Number(credit), instant };
}

/**
 * `Available 09:00, Sat, Sep 12` — the cell an assessment shows *before* it
 * opens.
 *
 * This is an opening time, not a deadline, and it was the single largest
 * source of noise in a real list: eight ECE 374 guided problem sets sat under
 * "Couldn't read" flagged `prairielearn: credit`, because the shape did not
 * match the credit cell and the row fell down house rule 1's unreadable path.
 * Nothing about it is unreadable. It simply answers a different question, and
 * a due date must never be invented from it (worker rule 3).
 */
export function parseAvailableCell(
  text: string,
  reference: string,
): string | undefined {
  const match = AVAILABLE_CELL.exec(text.trim());
  if (!match) return undefined;
  const [, hour, minute, weekday, month, day] = match;
  return instantFromCell(hour!, minute!, weekday!, month!, day!, reference);
}

/* -------------------------------------------------------------------------- */
/* Status (§4.3)                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The highest score this row can still reach at `now` — its **ceiling** — or
 * `undefined` when the page does not say.
 *
 * A tier counts as open when `now` falls inside its window; a tier with no End
 * stays open. PrairieLearn caps what a submission in a tier can earn at that
 * tier's credit, so the best open tier *is* the ceiling: once the 100% window
 * has passed and an 80% one is running, 80 is full marks.
 *
 * With no schedule the credit cell answers the same question one tier at a
 * time: `80% until 23:59, Tue, Sep 8` is an 80-credit tier open until that
 * instant. With neither, the answer is "not known" — and every caller below
 * treats not-known as the old behaviour, so a row we cannot read is never
 * re-opened, nor closed, on a guess.
 *
 * Tiers present but none open is a ceiling of **0**, which is a statement (the
 * work is closed) and not the same answer as `undefined`.
 */
export function creditCeiling(
  now: number,
  tiers: CreditTier[] | undefined,
  cell: CreditCell | undefined,
): number | undefined {
  if (tiers) {
    const open = tiers.filter(
      (tier) =>
        (!tier.start || Date.parse(tier.start) <= now) &&
        (!tier.end || now < Date.parse(tier.end)),
    );
    return open.length === 0 ? 0 : Math.max(...open.map((tier) => tier.credit));
  }
  if (cell) return Date.parse(cell.instant) > now ? cell.credit : 0;
  return undefined;
}

/** What the Score cell said, and what that means for the row's status. */
export interface ScoreReading {
  status: Status;
  /** The bar's percentage when it is a partial one, for `extra.scorePercent`. */
  scorePercent?: number;
  /**
   * The ceiling this score met, when it met one below 100 — `extra.scoreCeiling`.
   *
   * Only set on a row this function called finished *because* of the cap, so it
   * doubles as the reason: without it a row flips from "10d late" to "done" with
   * nothing on screen or in an export saying why.
   */
  scoreCeiling?: number;
}

/**
 * Absorbs the rendering of a score, not a lost point.
 *
 * The bar's width is written into a style attribute and can come back as
 * `79.99999999999999` for a score the page prints as 80. A hundredth of a
 * percent cannot separate two scores a student would tell apart, and anything
 * larger would start calling a genuinely short score full marks — which is the
 * §11 failure this whole file is careful about, in its most quiet form.
 */
const SCORE_EPSILON = 0.01;

/**
 * §4.3 as amended (docs/prairielearn-findings.md, Sushi 2026-09-18): a partial
 * score is only "done" once nothing more can be earned.
 *
 * The spec read "a percentage bar > 0% → graded ... this is 'done' for our
 * purposes", which hid a 40% homework with an open 80%-credit tier behind the
 * done filter while the window to fix it was still open — the one case where
 * the row most needs to be on the list. So:
 *
 * - `>= 100` → graded. Nothing is left to earn whatever the schedule says.
 * - `0` → not_submitted (opened, nothing earned).
 * - `< 100` with credit still open → not_submitted, and the percentage is kept
 *   so the popup can say "40% so far".
 * - `< 100` with no open tier → graded. The work is closed; a student can do
 *   nothing about it, and re-opening it would be a row that never clears.
 *
 * Amended again (Sushi, 2026-09-21): *"there needs to be a way for it to detect
 * the max score on prairielearn and if the user has gotten that score … then it
 * should still be marked as done"*. The rule above compares against 100, and
 * 100 is only the ceiling while the full-credit window is open. Past it, a CS
 * 357 lecture worth 80% that the student scored 80 on had nothing left to earn
 * and sat in the Late band for ten days telling them to go and do it again. So
 * the comparison is against `ceiling` — what `creditCeiling` says is on offer
 * — and 100 is only the default for a row that does not say.
 */
export function mapStatus(
  scoreCell: Element | null | undefined,
  ceiling?: number,
): ScoreReading {
  if (!scoreCell) return { status: "unknown" };
  const text = textOf(scoreCell);
  if (/not started/i.test(text)) return { status: "not_submitted" };
  if (/new instance/i.test(text)) return { status: "not_submitted" };

  const bar = scoreCell.querySelector(".progress-bar");
  if (bar) {
    const width = /width:\s*([\d.]+)%/.exec(
      bar.getAttribute("style") ?? "",
    )?.[1];
    const percent = width === undefined ? Number.NaN : Number(width);
    if (Number.isFinite(percent)) return readingFor(percent, ceiling);
  }
  const percentText = /(\d+(?:\.\d+)?)%/.exec(text)?.[1];
  if (percentText !== undefined)
    return readingFor(Number(percentText), ceiling);
  return { status: "unknown" };
}

function readingFor(
  percent: number,
  ceiling: number | undefined,
): ScoreReading {
  // Full marks are done whatever the schedule says, and that stays ahead of the
  // ceiling test on purpose: PrairieLearn writes credit above 100 for an
  // early-submission bonus, and a student sitting on 100 with a 110% tier open
  // should not be told their finished homework is unfinished.
  if (percent >= 100) return { status: "graded" };
  if (percent <= 0) return { status: "not_submitted" };
  // A partial score: the percentage is reported either way, because "40% so
  // far" is worth showing on a closed row too.
  if (ceiling === undefined || ceiling <= 0)
    return { status: "graded", scorePercent: percent };
  if (percent + SCORE_EPSILON >= ceiling) {
    return { status: "graded", scorePercent: percent, scoreCeiling: ceiling };
  }
  return { status: "not_submitted", scorePercent: percent };
}

/* -------------------------------------------------------------------------- */
/* The assessments page                                                        */
/* -------------------------------------------------------------------------- */

/** §4.3: these mark work that still appears but sorts last and can be filtered. */
const NOT_FOR_CREDIT = /\b(not for credit|will not count|extra credit)\b/i;

function courseInstanceIdFrom(page: PageCtx): string {
  const id = /\/pl\/course_instance\/(\d+)/.exec(page.url)?.[1];
  if (!id)
    throw new ParseError("assessments: cannot determine course instance id");
  return id;
}

export function parseAssessments(doc: Document, page: PageCtx): RawItem[] {
  const courseInstanceId = courseInstanceIdFrom(page);

  const table =
    doc.querySelector('table[aria-label="Assessments"]') ??
    Array.from(doc.querySelectorAll("table")).find((t) =>
      /assessments/i.test(t.getAttribute("aria-label") ?? ""),
    );
  if (!table) throw new ParseError("no assessments table");

  // `Assessments — CS 357 |  PrairieLearn`
  const pageTitle = textOf(doc.querySelector("title"));
  const courseRaw = pageTitle
    .replace(/^Assessments\s*[—-]\s*/, "")
    .replace(/\|.*$/, "")
    .trim();
  const codes = extractCourseCodes(courseRaw);

  const rows = Array.from(table.querySelectorAll("tr"));

  // Column positions come from the table's own header row, never from fixed
  // indices. With `cells[1..3]` an added column silently produced 14 undated
  // rows, every URL fallen back to the page, and 8 rows reported `graded`
  // because the status reader was handed the credit text — all behind a green
  // health dot. Gradescope avoids this by never indexing positionally; this
  // table has no per-cell hooks, so the header is the anchor.
  const headerCells = Array.from(
    rows
      .find(
        (row) => row.querySelector("th") && !row.querySelector("[data-testid]"),
      )
      ?.querySelectorAll("th") ?? [],
  ).map(textOf);
  const columnFor = (pattern: RegExp) =>
    headerCells.findIndex((cell) => pattern.test(cell));
  const titleColumn = columnFor(/title/i);
  const creditColumn = columnFor(/available credit/i);
  const scoreColumn = columnFor(/^score$/i);
  if (titleColumn < 0 || creditColumn < 0 || scoreColumn < 0) {
    throw new ParseError(
      `assessments table header is ${JSON.stringify(headerCells)}`,
    );
  }

  const items: RawItem[] = [];
  const keys = new KeyGuard();
  let group = "";
  let sawAssessmentRow = false;
  let popoversSeen = 0;
  let popoversFailed = 0;

  for (const row of rows) {
    // Group heading rows are kept for display but produce no item (§4.3).
    const heading = row.querySelector(
      '[data-testid="assessment-group-heading"]',
    );
    if (heading) {
      group = textOf(heading);
      continue;
    }

    const badgeCell = row.querySelector('[data-testid="assessment-set-badge"]');
    if (!badgeCell) continue; // the column-header row
    sawAssessmentRow = true;

    const badge = textOf(badgeCell);
    if (!badge) throw new ParseError("assessment row with an empty badge");

    // `td, th` because the name cell is a <th scope="row"> in some layouts.
    const cells = Array.from(row.querySelectorAll("td, th"));
    if (cells.length !== headerCells.length) {
      throw new ParseError(
        `assessment row has ${cells.length} cells but the header declares ${headerCells.length}`,
      );
    }
    const nameCell = cells[titleColumn];
    const creditCell = cells[creditColumn];
    const scoreCell = cells[scoreColumn];

    const name = textOf(nameCell);
    // §4.3: the badge takes part in title normalisation, because Canvas names
    // the same thing "Homework 3", which normalises to the badge's own "hw3".
    const title = name ? `${badge} ${name}` : badge;

    // §3.1 as amended (docs/sourceid-decision.md): keyed on the badge, because
    // the row's href switches from /assessment/{id} to /assessment_instance/{id}
    // the first time the student opens it.
    const sourceId = `${courseInstanceId}:${badge}`;
    keys.claim(sourceId, `assessment badge ${JSON.stringify(badge)}`);

    const extra: Record<string, string> = { badge };
    if (group) extra["group"] = group;
    if (codes.length > 1) extra["altCodes"] = codes.join(" ");
    if (NOT_FOR_CREDIT.test(title)) extra["forCredit"] = "false";

    let dueAt: string | undefined;
    let lateDueAt: string | undefined;

    const popover = creditCell?.querySelector("[data-bs-content]");
    const scheduleHtml = popover?.getAttribute("data-bs-content");
    let tiers: CreditTier[] | undefined;
    if (scheduleHtml) {
      popoversSeen += 1;
      try {
        tiers = parseCreditSchedule(doc, scheduleHtml);
        ({ dueAt, lateDueAt } = deadlinesFromSchedule(tiers));
        extra["creditSchedule"] = JSON.stringify(tiers);
        if (tiers[0]?.start) extra["releasedAt"] = tiers[0].start;
      } catch (err) {
        // One unreadable popover must cost one row's schedule, not the page —
        // the same rule already applied to Gradescope's dates. The row can
        // still be rescued by the credit cell in the very same <td>.
        tiers = undefined;
        popoversFailed += 1;
        extra["unparsedSchedule"] = scheduleHtml.slice(0, 500);
        console.warn(
          `[prairielearn] unreadable credit schedule for ${badge}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    // The cell text is the fallback, and also a cross-check when both exist.
    const creditText = creditCell
      ? textOf(creditCell).replace(/\s*\?\s*$/, "")
      : "";
    const cell = creditText
      ? parseCreditCell(creditText, page.fetchedAt)
      : undefined;
    const now = Date.parse(page.fetchedAt);

    if (tiers && cell) {
      // §4.3: with both present, use the schedule but assert the cell agrees
      // with what the schedule says for *now*. A mismatch means the popover
      // belongs to a different row — a selector bug — and is logged, not fatal.
      // Compared by tier, not by instant: the cell is minute-precision (23:59)
      // while the schedule End carries seconds (23:59:59).
      const active = tiers.find(
        (tier) =>
          (!tier.start || Date.parse(tier.start) <= now) &&
          (!tier.end || now < Date.parse(tier.end)),
      );
      if (active && active.credit !== cell.credit) {
        extra["creditMismatch"] =
          `cell=${cell.credit} schedule=${active.credit}`;
        console.warn(
          `[prairielearn] credit cell disagrees with schedule for ${badge}: ` +
            `cell=${cell.credit} schedule=${active.credit}`,
        );
      }
    }

    // Gated on a *usable* schedule, not merely a present one, so a row whose
    // popover failed still falls back to the credit cell beside it.
    if (!tiers && cell) {
      if (cell.credit >= 100) {
        dueAt = cell.instant;
      } else {
        // §4.3: a tier below 100 means the full-credit deadline has passed, so
        // what remains is a reduced-credit deadline, not a due date.
        lateDueAt = cell.instant;
        extra["creditRemaining"] = String(cell.credit);
      }
    } else if (!tiers && creditText) {
      const opens = parseAvailableCell(creditText, page.fetchedAt);
      if (opens !== undefined) {
        // Not yet open. It has no deadline to state, and none is invented from
        // the opening time — §5.3 would rank an invented instant against real
        // ones from other sources.
        extra["releasedAt"] = opens;
      } else {
        // §4.3: one unreadable row must not take the whole course down. The row
        // is still emitted, undated, with the raw text kept.
        extra["unparsedCredit"] = creditText;
        // §4.3 requires the unreadable row to be logged with its raw text.
        console.warn(
          `[prairielearn] unreadable credit cell for ${badge}: ${creditText}`,
        );
      }
    }

    const score = mapStatus(scoreCell, creditCeiling(now, tiers, cell));
    if (score.scorePercent !== undefined)
      extra["scorePercent"] = String(score.scorePercent);
    if (score.scoreCeiling !== undefined)
      extra["scoreCeiling"] = String(score.scoreCeiling);

    items.push({
      source: "prairielearn",
      sourceId,
      courseRaw,
      courseCode: codes[0],
      title,
      kind: "assignment",
      dueAt,
      lateDueAt,
      url: sameOriginHttpsUrl(
        nameCell?.querySelector("a[href]")?.getAttribute("href"),
        PRAIRIELEARN_ORIGIN,
        page.url,
      ),
      status: score.status,
      extra,
      fetchedAt: page.fetchedAt,
    });
  }

  // A course instance with a table but no assessment rows is possible, but a
  // table whose rows stopped matching looks identical and is a redesign. Rows
  // exist, none matched → structural surprise (§0 rule 3).
  if (!sawAssessmentRow && rows.length > 1) {
    throw new ParseError(
      `assessments table has ${rows.length} rows but none carry an assessment badge`,
    );
  }

  // Per-row recovery must not hide a redesign: one bad popover is a weird row,
  // but every popover failing is a format change, and §0 rule 3 says that is an
  // error rather than a page of quietly undated items.
  //
  // Qualified on the outcome rather than on the failures alone: if the credit
  // cells supplied dates anyway, the page is not silently undated and the
  // fallback did exactly its job.
  const anyDated = items.some(
    (item) => item.dueAt !== undefined || item.lateDueAt !== undefined,
  );
  if (popoversSeen > 0 && popoversFailed === popoversSeen && !anyDated) {
    throw new ParseError(
      `all ${popoversSeen} credit schedule(s) failed to parse and no date was recovered`,
    );
  }

  return items;
}

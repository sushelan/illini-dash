/**
 * Gradescope source (§4.2).
 *
 * Pure functions over a `Document`, so they run unchanged in the offscreen
 * document and under linkedom in tests (§2.1). Evidence for every selector below
 * is in docs/gradescope-findings.md; where this disagrees with §4.2 the
 * disagreement is called out in a comment.
 */

import { isOlderThan, parseGradescopeDateTime, shortHash } from "../core/dates.js";
import { extractCourseCodes } from "../core/normalize.js";
import { KeyGuard, looksLoggedOut, parseField, textOf } from "../core/parsing.js";
import { ParseError, type PageCtx, type RawItem, type Status } from "./types.js";

export const GRADESCOPE_ORIGIN = "https://www.gradescope.com";

/** §5.4 / §4.2: rows this far past their deadline are dropped at parse time. */
const DROP_AFTER_DAYS = 60;

export interface GradescopeCourse {
  id: string;
  url: string;
  /** `PHYS435`, `CS425 ECE428 Fall 2026`, or an opaque slug. */
  shortName: string;
  /** `Advanced Electromagnetism I`. */
  fullName: string;
  term: string;
  courseCode?: string;
  altCodes: string[];
  /** From "2 assignments" on the card; a 0 means the page need not be fetched. */
  assignmentCount?: number;
}

/* -------------------------------------------------------------------------- */
/* Login detection (§4)                                                        */
/* -------------------------------------------------------------------------- */

export function isLoginResponse(status: number, finalUrl: string, body: string): boolean {
  return looksLoggedOut(status, finalUrl, body, {
    // §4.2: an *expired* session redirects the dashboard fetch to /login.
    loginPath: /gradescope\.com\/(login|auth)/,
    // A student who has **never** signed in gets something else entirely: 200,
    // no redirect, `<title>Gradescope</title>`, and the marketing splash page.
    // None of the generic tests catch that, so the parser ran on the splash,
    // found no course cards, and threw — a red "the page changed" dot with no
    // way to log in, for the one situation where logging in is the whole fix.
    // §0 rule 2 exists for exactly this.
    //
    // `js-logInButton` is the hook on the splash page's Log In control. It is
    // absent from the real logged-in dashboard capture, which is what makes it
    // safe: a marker that appears on both would turn every healthy sync into a
    // needs_login (house rule 6 — match the smallest specific thing).
    bodyLooksLoggedOut: (page) => page.includes("js-logInButton"),
  });
}

/* -------------------------------------------------------------------------- */
/* Dashboard (§4.2 step 1)                                                     */
/* -------------------------------------------------------------------------- */


/**
 * Courses from the account dashboard, in DOM order, grouped by term.
 *
 * §4.2: term strings are free text (`Fall 2026`) and must never be parsed; the
 * current term is simply the first group. Confirmed against a real dashboard of
 * 5 terms and 15 courses.
 */
export function parseDashboard(doc: Document): { term: string; courses: GradescopeCourse[] }[] {
  const termHeadings = Array.from(doc.querySelectorAll(".courseList--term"));
  if (termHeadings.length === 0) {
    // A logged-in dashboard always has at least one term. Zero means the page
    // is not the page we think it is (§0 rule 3).
    throw new ParseError("dashboard: no .courseList--term headings");
  }

  const groups: { term: string; courses: GradescopeCourse[] }[] = [];

  for (const heading of termHeadings) {
    const container = heading.nextElementSibling;
    const term = textOf(heading);
    const courses: GradescopeCourse[] = [];

    // The "add a course" control is a <button class="courseBox courseBox-new">
    // with no href. The selector excludes it; the `if (!id) continue` below is
    // the load-bearing guard, since a <button> yields a null href and is dropped
    // there too. Both are kept deliberately — the selector states the intent.
    for (const box of Array.from(
      container?.querySelectorAll('a.courseBox[href^="/courses/"]') ?? [],
    )) {
      const href = box.getAttribute("href") ?? "";
      const id = /\/courses\/(\d+)/.exec(href)?.[1];
      if (!id) continue;

      const shortName = textOf(box.querySelector(".courseBox--shortname"));
      const countText = textOf(box.querySelector(".courseBox--assignments"));
      const count = /^(\d+)\s+assignment/.exec(countText)?.[1];
      const codes = extractCourseCodes(shortName);

      courses.push({
        id,
        url: `${GRADESCOPE_ORIGIN}/courses/${id}`,
        shortName,
        fullName: textOf(box.querySelector(".courseBox--name")),
        term,
        courseCode: codes[0],
        altCodes: codes,
        assignmentCount: count === undefined ? undefined : Number(count),
      });
    }

    groups.push({ term, courses });
  }

  // Term headings but no courses anywhere means the course-card markup moved:
  // a renamed .courseBox, site-wide absolute hrefs, or an element inserted
  // between a heading and its container. Each yields healthy-looking empty
  // groups and, at step 8, a green health dot over a list missing every
  // Gradescope deadline (§0 rule 3, §11).
  //
  // Guarded on the total, not per group: the enrol button lives inside the
  // first term's container, so a student whose current term is legitimately
  // empty must not trip this.
  if (groups.every((group) => group.courses.length === 0)) {
    throw new ParseError("dashboard: term headings present but no course links");
  }

  return groups;
}

/** §4.2: take the first group in DOM order; the options page re-enables older ones. */
export function currentTermCourses(doc: Document): GradescopeCourse[] {
  return parseDashboard(doc)[0]?.courses ?? [];
}

/* -------------------------------------------------------------------------- */
/* Course page (§4.2 step 2)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * §4.2: `No Submission` → not_submitted, `Submitted` → submitted, a percentage
 * or `Graded` → graded, anything else → unknown. The `submissionStatus-*`
 * modifier classes encode colour, not meaning, and are deliberately ignored.
 */
export function mapStatus(text: string): Status {
  const value = text.trim().toLowerCase();
  if (value === "") return "unknown";
  // Matched exactly, not by substring. "not submitted" contains "submitted" and
  // "not yet graded" contains "graded", so substring matching files a negated
  // status into the most-done bucket — and `unknown` is the fail-safe bucket
  // (still shown, still notified) while `submitted`/`graded` is the one that
  // makes an item disappear, and would then win §5.3's "most done" merge.
  if (value === "no submission" || value === "not submitted") return "not_submitted";
  if (value === "submitted") return "submitted";
  if (value === "graded") return "graded";
  if (/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(value)) return "graded";
  if (/^\d+(\.\d+)?%$/.test(value)) return "graded";
  return "unknown";
}

/** §4.2: an unrecognised status wording is logged once, not once per row. */
const loggedStatuses = new Set<string>();

function courseIdFrom(page: PageCtx, doc: Document): string {
  const fromUrl = /\/courses\/(\d+)/.exec(page.url)?.[1];
  if (fromUrl) return fromUrl;
  // §4.2: the page header prints "Course ID: 1352838".
  const fromBody = /Course ID:\s*(\d+)/.exec(doc.body?.textContent ?? "")?.[1];
  if (fromBody) return fromBody;
  throw new ParseError("course page: cannot determine course id");
}

/**
 * The assignment id for a row (§3.1, as amended in docs/sourceid-decision.md).
 *
 * A row is an `<a>` once the student has submitted and a `<button>` before, and
 * both carry the same assignment id. Reading only one of them would change the
 * memberKey at the moment of submission, breaking every override on the item and
 * re-firing its notifications.
 */
function assignmentIdFor(cell: Element): string | undefined {
  const href = cell.querySelector("a[href]")?.getAttribute("href") ?? "";
  // Not anchored: the real href is /courses/{c}/assignments/{a}/submissions/{s}.
  const fromHref = /\/courses\/\d+\/assignments\/(\d+)/.exec(href)?.[1];
  if (fromHref) return fromHref;

  const fromButton = cell
    .querySelector("[data-assignment-id]")
    ?.getAttribute("data-assignment-id")
    ?.trim();
  if (!fromButton) return undefined;
  // The <a> carrier admits only digits, so the <button> carrier must too. A
  // silent /^\d+$/ guard would be worse than throwing: it would drop the row to
  // the hashed fallback while the submitted form still reads the numeric href,
  // so the memberKey would still flip at submit time — the exact hazard
  // docs/sourceid-decision.md exists to prevent. It is also interpolated into a
  // URL, so a non-numeric value would build a URL that still passes §8.1's gate.
  if (!/^\d+$/.test(fromButton)) {
    throw new ParseError(`assignment id is not numeric: ${JSON.stringify(fromButton)}`);
  }
  return fromButton;
}

/** The `<time>` whose aria-label starts with `prefix`, else by DOM order. */
function dueTimes(row: Element): { due?: Element; late?: Element } {
  let times = Array.from(row.querySelectorAll("time.submissionTimeChart--dueDate"));

  // §4.2 keeps a class-independent fallback as "cheap insurance" against a
  // redesign, and §11 names it the mitigation for one. It matches on the
  // aria-label of any <time datetime>, and deliberately never reads the hidden
  // Due Date column, which holds whichever deadline is next actionable.
  if (times.length === 0) {
    times = Array.from(row.querySelectorAll("time[datetime]")).filter((t) => {
      const label = (t.getAttribute("aria-label") ?? "").trim();
      return label.startsWith("Due at") || label.startsWith("Late Due Date");
    });
  }
  const labelled = (prefix: string) =>
    times.find((t) => (t.getAttribute("aria-label") ?? "").trim().startsWith(prefix));

  // §4.2: due and late-due share a class, so the aria-label prefix is the
  // discriminator, with DOM order as the fallback if that label text changes.
  const late = labelled("Late Due Date");
  // No `?? times[0]` fallback: when the row's only <time> IS the late date,
  // that fallback would re-admit it as the due date and report a deadline a week
  // late — the same wrong-deadline failure the hidden-column rule exists to stop.
  const due = labelled("Due at") ?? times.find((t) => t !== late);
  return { due, late: late ?? (times.length > 1 ? times[1] : undefined) };
}

/**
 * §4.2: always parse the `datetime` attribute, never the visible text — and never
 * the hidden "Due Date" column, which holds whichever deadline is next actionable
 * and therefore shows the *late* date once due has passed
 * (docs/gradescope-findings.md).
 */
function isoFromTime(node: Element | undefined): { iso?: string; unparsed?: string } {
  if (!node) return {};
  const raw = node.getAttribute("datetime") ?? "";
  if (raw.trim() === "") return { unparsed: raw };
  const result = parseField(raw, parseGradescopeDateTime, "gradescope");
  return { iso: result.value, unparsed: result.unparsed };
}

/**
 * Assignments from one course page.
 *
 * A table with zero rows is a legitimately empty course. **No** table on a page
 * that is not a login page is a ParseError (§4.2, §0 rule 3).
 */
export function parseCoursePage(doc: Document, page: PageCtx): RawItem[] {
  const courseId = courseIdFrom(page, doc);
  const courseRaw =
    textOf(doc.querySelector(".courseHeader--title")) || `Gradescope course ${courseId}`;
  const term = textOf(doc.querySelector(".courseHeader--term"));
  const codes = extractCourseCodes(courseRaw);

  // The assignments table identifies itself, so "table is missing" and "course
  // is empty" stay distinguishable (§4.2). The page carries a second, unrelated
  // dropzonePreview table, so "is there a <table>" would not be enough: a
  // redesign that renamed the assignments table would look like an empty course
  // and silently drop every deadline — the failure §11 calls catastrophic.
  const table =
    doc.querySelector("#assignments-student-table") ??
    Array.from(doc.querySelectorAll("table")).find((t) =>
      /assignments list/i.test(t.querySelector("caption")?.textContent ?? ""),
    );
  if (!table) throw new ParseError("no assignments table");

  // Rows are `tr`s containing th.table--primaryLink, which excludes the thead row.
  const allRows = Array.from(table.querySelectorAll("tr")).filter((tr) =>
    tr.querySelector("th.table--primaryLink"),
  );

  // Guarding the table element alone is not enough: a renamed *row* class gives
  // the identical outcome — a table full of visible deadlines parsed to []. An
  // empty course has no body rows at all, so the two stay distinguishable.
  const bodyRows = Array.from(table.querySelectorAll("tr")).filter((tr) => !tr.closest("thead"));
  if (allRows.length === 0 && bodyRows.length > 0) {
    throw new ParseError(
      `assignments table has ${bodyRows.length} row(s) but none match th.table--primaryLink`,
    );
  }

  const items: RawItem[] = [];
  const keys = new KeyGuard();

  for (const row of allRows) {
    const cell = row.querySelector("th.table--primaryLink")!;
    const title =
      textOf(cell) || cell.querySelector("[data-assignment-title]")?.getAttribute("data-assignment-title") || "";
    if (!title) throw new ParseError("assignment row with no title");

    const assignmentId = assignmentIdFor(cell);
    // §3.1's hashed fallback, kept for a row carrying neither form of id.
    const sourceId = assignmentId ?? `${courseId}:${shortHash(title.toLowerCase())}`;
    keys.claim(sourceId, `assignment key ${sourceId}`);

    const { due, late } = dueTimes(row);
    const dueParsed = isoFromTime(due);
    const lateParsed = isoFromTime(late);
    const dueAt = dueParsed.iso;
    const lateDueAt = lateParsed.iso;

    // §4.2: rows more than 60 days past due are dropped at parse time.
    if (dueAt && isOlderThan(dueAt, page.fetchedAt, DROP_AFTER_DAYS)) continue;

    const extra: Record<string, string> = {};
    if (term) extra["term"] = term;
    const releaseParsed = isoFromTime(
      row.querySelector("time.submissionTimeChart--releaseDate") ?? undefined,
    );
    if (releaseParsed.iso) extra["releasedAt"] = releaseParsed.iso;
    // A rejected date costs its own field and nothing else, and stays visible.
    if (dueParsed.unparsed !== undefined) extra["unparsedDueDate"] = dueParsed.unparsed;
    if (lateParsed.unparsed !== undefined) extra["unparsedLateDate"] = lateParsed.unparsed;
    if (releaseParsed.unparsed !== undefined) {
      extra["unparsedReleaseDate"] = releaseParsed.unparsed;
    }
    if (codes.length > 1) extra["altCodes"] = codes.join(" ");
    const statusText = textOf(row.querySelector(".submissionStatus--text"));
    const status = mapStatus(statusText);
    if (status === "unknown" && statusText !== "") {
      // §4.2: "anything else → unknown and log once". Recorded on the item too,
      // so a wording change is visible in source health rather than only in a
      // console nobody is watching.
      extra["unknownStatus"] = statusText;
      if (!loggedStatuses.has(statusText)) {
        loggedStatuses.add(statusText);
        console.warn(`[gradescope] unrecognised submission status: ${statusText}`);
      }
    }

    const lateStatus = textOf(row.querySelector(".submissionTimeChart--lateStatus"));
    if (lateStatus) extra["lateStatus"] = lateStatus;
    if (!assignmentId) extra["idFallback"] = "hashed";

    items.push({
      source: "gradescope",
      sourceId,
      courseRaw,
      courseCode: codes[0],
      title,
      kind: "assignment",
      dueAt,
      lateDueAt,
      url: assignmentId
        ? `${GRADESCOPE_ORIGIN}/courses/${courseId}/assignments/${assignmentId}`
        : `${GRADESCOPE_ORIGIN}/courses/${courseId}`,
      status,
      extra,
      fetchedAt: page.fetchedAt,
    });
  }

  return items;
}

/**
 * smartPhysics source — the prelecture / checkpoint / homework list for
 * PHYS 211–214.
 *
 * **Not an adapter.** §4.5's declarative runner fetches one fixed URL, and every
 * smartPhysics course page is addressed by a per-*student* enrolment id
 * (`/Course?enrollmentID=151698`). No fixed URL can serve two students, so this
 * is a source with a two-stage plan — the same shape as Gradescope's dashboard →
 * course pages.
 *
 * Evidence: `fixtures/smartphysics/home.html` and `course.html`, real captures
 * from 2026-09-10. Both are server-rendered: 79 KB of the home page is the app
 * bundle, but the content is in the HTML, so no content script is needed.
 *
 * Why it matters for §7: these deadlines are at **8:00 AM**, not 11:59 PM. A
 * student running on the usual habit is the one who misses them, which is the
 * case a reminder is actually for.
 */

import { monthIndex, shortHash, wallClockToIso } from "../core/dates.js";
import { extractCourseCodes } from "../core/normalize.js";
import {
  KeyGuard,
  looksLoggedOut,
  nonEmpty,
  parseField,
  sameOriginHttpsUrl,
  textOf,
} from "../core/parsing.js";
import { ParseError, type Kind, type PageCtx, type RawItem } from "./types.js";

export const SMARTPHYSICS_ORIGIN = "https://smart.physics.illinois.edu";

/** Every UIUC smartPhysics course is Central time; the site states no zone. */
const TIMEZONE = "America/Chicago";

export function courseUrl(enrollmentId: string): string {
  return `${SMARTPHYSICS_ORIGIN}/Course?enrollmentID=${encodeURIComponent(enrollmentId)}`;
}

/**
 * §0 rule 2. Signed out, the site serves its own login form rather than
 * redirecting, and the LAS single sign-on host is not one `looksLoggedOut`
 * knows — so without a body marker an absent session would read as a broken
 * page, which is the mistake Gradescope and PrairieTest both made.
 */
export function isLoginResponse(status: number, finalUrl: string, body: string): boolean {
  return looksLoggedOut(status, finalUrl, body, {
    loginPath: /(smart\.physics\.illinois\.edu\/Account\/(Login|SignIn)|lassso\.las\.illinois\.edu)/i,
    // The log-out control only exists once there is a session to end.
    bodyLooksLoggedOut: (page) => !page.includes("/Account/LogOff"),
  });
}

/* -------------------------------------------------------------------------- */
/* Stage 1: the enrolment list                                                 */
/* -------------------------------------------------------------------------- */

export interface SmartPhysicsCourse {
  enrollmentId: string;
  /** "Physics 214 Fall 2025", exactly as displayed. */
  name: string;
  /** "PHYS214" where §5.1 can find it. */
  courseCode?: string;
  /** False for a course the site lists under Inactive. */
  active: boolean;
}

/**
 * The courses on the home page, active and not.
 *
 * Inactive ones are returned rather than dropped so the caller can say why a
 * course is missing. §0 rule 3's shape: a student with only inactive
 * enrolments has a legitimately empty *active* list, and that is different
 * from a page whose rows stopped matching.
 */
export function parseCourseList(doc: Document): SmartPhysicsCourse[] {
  // Scoped to `.course-title`, not every link carrying an enrolment id. The nav
  // "Home" link and each row's role link point at the same URL, so a page-wide
  // query returns three links for one course and the first one is titled
  // "Home" — house rule 3's lesson in a different shape: anchor on the
  // structural hook rather than on position.
  const links = [...doc.querySelectorAll(".course-title a[href*='/Course?enrollmentID=']")];
  const table = doc.querySelector("table");
  if (links.length === 0 && !table) {
    throw new ParseError("smartphysics: no course table and no course links on the home page");
  }

  const courses: SmartPhysicsCourse[] = [];
  const guard = new KeyGuard();
  for (const link of links) {
    const href = link.getAttribute("href") ?? "";
    const enrollmentId = /enrollmentID=(\d+)/i.exec(href)?.[1];
    if (!enrollmentId) continue;
    const name = textOf(link);
    // The row's own action cell repeats the link, so the same enrolment appears
    // more than once. First occurrence wins, and only a *name* is required.
    if (guard.has(`c:${enrollmentId}`)) continue;
    if (!nonEmpty(name)) continue;
    guard.claim(`c:${enrollmentId}`, "smartphysics enrolment");

    courses.push({
      enrollmentId,
      name,
      courseCode: courseCodesFor(name)[0],
      active: isActiveEnrollment(link),
    });
  }

  if (courses.length === 0 && table) {
    // A table with no parseable course link is a redesign, not an empty account
    // — house rule 2: guarding the container is not enough, the rows count too.
    throw new ParseError("smartphysics: course table present but no enrolment links matched");
  }
  return courses;
}

/**
 * Whether a course link sits in the Active or the Inactive tab.
 *
 * The page is two Bootstrap tab panes with stable ids — `#CurrentEnrollments`
 * and `#PastEnrollments` — rather than headings over tables, which is a better
 * hook than reading the label text: "Inactive Courses" *contains* "active
 * Courses", so a text match on the wrong one classifies every course backwards
 * (house rule 6).
 *
 * Unknown container means active. §11's asymmetry: listing a stale course's
 * deadlines is untidy and §5.4 purges them at 60 days, while hiding a live
 * course is the failure that matters.
 */
function isActiveEnrollment(link: Element): boolean {
  let node: Element | null = link.parentElement;
  while (node) {
    const id = node.getAttribute("id");
    if (id === "PastEnrollments") return false;
    if (id === "CurrentEnrollments") return true;
    node = node.parentElement;
  }
  return true;
}

/**
 * smartPhysics writes "Physics 214 Fall 2025".
 *
 * §5.1's regex wants two to four letters before the number and "Physics" is
 * seven, so it finds nothing — and a row with no course code cannot merge with
 * the Gradescope or Canvas copy of the same course, which is the point of §5.3.
 * Scoped to this source because this source only ever serves Physics.
 */
function courseCodesFor(name: string): string[] {
  const direct = extractCourseCodes(name);
  if (direct.length > 0) return direct;
  const number = /\bPhysics\s+(\d{3}[A-Z]?)\b/i.exec(name)?.[1];
  return number ? [`PHYS${number.toUpperCase()}`] : [];
}


/* -------------------------------------------------------------------------- */
/* Stage 2: one course's assignments                                           */
/* -------------------------------------------------------------------------- */

/**
 * `Due: Aug. 25, 2025 at 8:00 AM for 100% credit`
 *
 * The year is present, so §3.2's year inference — the riskiest date code in the
 * project — is not needed here. The credit figure is captured separately; it is
 * the tier in force *now*, the same semantics as PrairieLearn's cell (§4.3).
 */
const DUE = new RegExp(
  String.raw`Due:\s*` +
    String.raw`(?<month>[A-Za-z]{3,9})\.?\s+(?<day>\d{1,2}),\s*(?<year>\d{4})` +
    String.raw`\s+at\s+(?<hour>\d{1,2}):(?<minute>\d{2})\s*(?<ampm>AM|PM)`,
  "i",
);
const CREDIT = /for\s+(\d{1,3})%\s+credit/i;

/**
 * The instant in `Due: …`.
 *
 * Throws rather than returning undefined, because that is the contract
 * `parseField` is built on: it catches, records the raw text in
 * `extra.unparsedDueDate`, and keeps the row. Returning undefined would read as
 * "there is no deadline here", which is a quieter and different claim — and
 * the row would then vanish instead of surfacing under "Couldn't read".
 */
export function parseDueText(raw: string): string {
  const match = DUE.exec(raw.replace(/\s+/g, " "));
  if (!match?.groups) {
    throw new ParseError(`smartphysics: unreadable due text "${raw.slice(0, 80)}"`);
  }
  const g = match.groups;

  const month = monthIndex(g["month"]!.slice(0, 3).replace(/^./, (c) => c.toUpperCase()));
  if (month === undefined) throw new ParseError(`smartphysics: unknown month "${g["month"]}"`);

  let hour = Number(g["hour"]);
  const ampm = g["ampm"]!.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  // `Sep. 31` and `25:00` are shapes a hand-edited page really produces, and
  // `wallClockToIso` rejects both with a `ParseError` — that check used to be
  // duplicated here with `isRealWallClock`, which no test could distinguish
  // from this line because the two are equivalent. `parseField` records the raw
  // text either way, so the duplicate bought nothing but a branch to read.
  return wallClockToIso(
    { year: Number(g["year"]), month, day: Number(g["day"]), hour, minute: Number(g["minute"]) },
    TIMEZONE,
  );
}

/** §4.1-style kind mapping, from the row's own type class. */
function kindOf(row: Element): Kind {
  const cls = row.getAttribute("class") ?? "";
  // Exact tokens, not substrings: `Checkpoint-Type` and `Homework-Type` are the
  // site's own markers and both contain "Type".
  if (/\bCheckpoint-Type\b/.test(cls)) return "quiz";
  if (/\bExam-Type\b/.test(cls)) return "exam";
  return "assignment";
}

/**
 * The nearest unit title above a row, e.g. "Harmonic waves".
 *
 * Most rows are titled bare "Checkpoint" or "Homework" — twelve of the 29 in
 * the real capture — so without the unit the list is a column of identical
 * names, and §3.1's content-derived key would collide on every one of them.
 */
function unitTitle(row: Element): string | undefined {
  let node: Element | null = row;
  while (node) {
    const own = node.querySelector(".UnitTitle");
    if (own) {
      const text = textOf(own);
      if (nonEmpty(text)) return text;
    }
    node = node.parentElement;
  }
  return undefined;
}

/**
 * One course page's assignments.
 *
 * §0 rule 3: a course with a section list but no assignment rows is a redesign,
 * not an empty course.
 */
export function parseAssignments(doc: Document, page: PageCtx): RawItem[] {
  const rows = [...doc.querySelectorAll(".unit-assignment")];
  if (rows.length === 0) {
    const shell = doc.querySelector(".unit, .accordion, .units-box");
    if (shell) {
      throw new ParseError("smartphysics: unit sections present but no .unit-assignment rows");
    }
    // No shell either: nothing on this page claims to be a course.
    throw new ParseError("smartphysics: no assignment rows and no unit sections");
  }

  const courseRaw = textOf(doc.querySelector("title")) || page.extra?.["courseName"] || "";
  const codes = courseCodesFor(courseRaw);
  const items: RawItem[] = [];
  const guard = new KeyGuard();

  for (const row of rows) {
    const link = row.querySelector(".unit-assignment-title a");
    const ownTitle = textOf(link ?? row.querySelector(".unit-assignment-title"));
    if (!nonEmpty(ownTitle)) {
      // The hook is there and the value is not: house rule 1 says that costs
      // the row, but a row with no title at all is not a deadline anyone can
      // act on, so it is skipped loudly rather than emitted nameless.
      console.warn("[smartphysics] assignment row with no title, skipped");
      continue;
    }

    const unit = unitTitle(row);
    // "Harmonic waves — Checkpoint". Bare "Checkpoint" appears a dozen times on
    // one page and would be unreadable in a mixed list.
    const title = unit && !ownTitle.toLowerCase().includes(unit.toLowerCase())
      ? `${unit} — ${ownTitle}`
      : ownTitle;

    const dueText = textOf(row.querySelector(".duedate"));
    const due = parseField(dueText, parseDueText, "smartphysics due date");
    const credit = CREDIT.exec(dueText)?.[1];

    const extra: Record<string, string> = {};
    if (unit) extra["unit"] = unit;
    if (due.unparsed !== undefined) extra["unparsedDueDate"] = due.unparsed;
    if (credit !== undefined) extra["creditRemaining"] = credit;
    if (codes.length > 1) extra["altCodes"] = codes.join(" ");

    // §3.1: the row's own id is a database key that survives re-scrapes, and
    // unlike the URL it does not carry the student's enrolment id.
    const rowId = nonEmpty(row.getAttribute("id"));
    const sourceId = rowId ?? shortHash(`${courseRaw}|${title}`);
    if (!rowId) extra["idFallback"] = "hashed";
    guard.claim(sourceId, "smartphysics assignment id");

    items.push({
      source: "smartphysics",
      sourceId,
      courseRaw,
      courseCode: codes[0],
      title,
      kind: kindOf(row),
      dueAt: due.value,
      url: sameOriginHttpsUrl(
        link?.getAttribute("href") ?? undefined,
        SMARTPHYSICS_ORIGIN,
        page.url,
      ),
      status: "unknown",
      extra,
      fetchedAt: page.fetchedAt,
    });
  }

  if (items.length === 0) {
    throw new ParseError("smartphysics: assignment rows present but none produced an item");
  }
  return items;
}

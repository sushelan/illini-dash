/**
 * Canvas source (§4.1). Canvas has a real REST API that works with session
 * cookies, so this module parses JSON and never touches the offscreen document.
 *
 * Everything here is a pure function over already-fetched text: the fetch plan
 * is expressed as URLs, and the sync loop in step 8 does the fetching. That
 * keeps the whole module testable against `fixtures/canvas/`.
 */

import { extractCourseCodes } from "../core/normalize.js";
import { isInstant, looksLoggedOut, nonEmpty, sameOriginHttpsUrl } from "../core/parsing.js";
import { ParseError, type Kind, type PageCtx, type RawItem, type Status } from "./types.js";

export const CANVAS_ORIGIN = "https://canvas.illinois.edu";

/** One active enrolment, reduced to what the rest of the extension needs. */
export interface CanvasCourse {
  id: number;
  /** Canvas's `name`, which is where the real course code lives on this instance. */
  name: string;
  /** Canvas's `course_code`. An opaque slug here; kept only for diagnostics. */
  rawCourseCode: string;
  /** §5.1, extracted from `name` — see docs/canvas-findings.md. */
  courseCode?: string;
  altCodes: string[];
  termId?: number;
  endAt?: string;
  /** Canvas reports a per-course zone; §3.2 otherwise assumes America/Chicago. */
  timeZone?: string;
}

/* -------------------------------------------------------------------------- */
/* Fetch plan (§4.1)                                                           */
/* -------------------------------------------------------------------------- */

export function coursesUrl(): string {
  return `${CANVAS_ORIGIN}/api/v1/courses?enrollment_state=active&per_page=100`;
}

/** The planner window is now−7d to now+60d (§4.1). */
export function plannerUrl(now: Date): string {
  const day = 86_400_000;
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  const start = iso(now.getTime() - 7 * day);
  const end = iso(now.getTime() + 60 * day);
  return `${CANVAS_ORIGIN}/api/v1/planner/items?start_date=${start}&end_date=${end}&per_page=100`;
}

/* -------------------------------------------------------------------------- */
/* Response handling                                                           */
/* -------------------------------------------------------------------------- */

const WHILE_PREFIX = "while(1);";

/**
 * §4.1: Canvas may prepend `while(1);` to JSON when a browser session is used
 * instead of a bearer token. Detected rather than sliced blindly — the
 * canvas.illinois.edu deployment does **not** send it (docs/gate0-results.md),
 * so requiring it would break every response.
 */
export function stripWhilePrefix(body: string): string {
  const trimmed = body.trimStart();
  return trimmed.startsWith(WHILE_PREFIX) ? trimmed.slice(WHILE_PREFIX.length) : body;
}

/** §4.1: pagination is via the `Link` header. Returns the `rel="next"` URL. */
export function linkHeaderNext(header: string | null | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(",")) {
    const match = /^\s*<([^>]+)>\s*;\s*(.+)$/.exec(part);
    if (!match) continue;
    if (/\brel\s*=\s*"?next"?/.test(match[2]!)) return match[1];
  }
  return undefined;
}

/**
 * Detects a logged-out response so §6 reports `needs_login` (yellow dot, link to
 * the login page) rather than `parse_error` (red dot, backoff) — §0 rule 2.
 *
 * Takes the status, not just the URL: an expired session on an `/api/v1` path
 * does not redirect anywhere and does not return HTML. Canvas answers with a
 * 401 and a JSON error object at the unchanged request URL, which every
 * URL-and-body test here would call "logged in", and which `parseCourses` would
 * then reject as a structural surprise. §4's contract takes the whole
 * `Response` for exactly this reason.
 *
 * No logged-out Canvas response has been captured yet (Gate 0 ran fully
 * authenticated), so the status check is the load-bearing part and the body
 * checks are belt-and-braces.
 */
export function isLoginResponse(status: number, finalUrl: string, body: string): boolean {
  // Canvas differs from the HTML sources: an /api/v1 path answering with *any*
  // HTML is already proof of a logged-out response.
  return looksLoggedOut(status, finalUrl, body, {
    loginPath: /\/login(\/|\?|$)/,
    bodyLooksLoggedOut: (text) => /^\s*<(!doctype|html)/i.test(text),
  });
}

function parseJsonArray(body: string, what: string): unknown[] {
  let value: unknown;
  try {
    value = JSON.parse(stripWhilePrefix(body));
  } catch (err) {
    throw new ParseError(`${what}: body is not JSON (${(err as Error).message})`);
  }
  if (!Array.isArray(value)) {
    // Canvas reports permission problems as {"status":"unauthenticated"} etc.
    const shape =
      value && typeof value === "object"
        ? Object.keys(value as object).slice(0, 5).join(", ")
        : typeof value;
    throw new ParseError(`${what}: expected a JSON array, got {${shape}}`);
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/* Courses (§4.1)                                                              */
/* -------------------------------------------------------------------------- */

/**
 * An empty array is allowed: a student between terms genuinely has no active
 * enrolments. It is the sync loop's job to notice that Canvas contributed
 * nothing and show it on the per-source dot (§8.1).
 */
export function parseCourses(body: string): CanvasCourse[] {
  const rows = parseJsonArray(body, "courses");
  const courses: CanvasCourse[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const course = row as Record<string, unknown>;
    const id = course["id"];
    const name = course["name"];
    if (typeof id !== "number" || typeof name !== "string") {
      throw new ParseError(`courses: row without a numeric id and string name`);
    }
    const codes = extractCourseCodes(name);
    courses.push({
      id,
      name,
      rawCourseCode: typeof course["course_code"] === "string" ? course["course_code"] : "",
      courseCode: codes[0],
      altCodes: codes,
      termId:
        typeof course["enrollment_term_id"] === "number"
          ? course["enrollment_term_id"]
          : undefined,
      endAt: typeof course["end_at"] === "string" ? course["end_at"] : undefined,
      timeZone: typeof course["time_zone"] === "string" ? course["time_zone"] : undefined,
    });
  }
  return courses;
}

export function courseMap(courses: CanvasCourse[]): Map<number, CanvasCourse> {
  return new Map(courses.map((course) => [course.id, course]));
}

/* -------------------------------------------------------------------------- */
/* Planner items (§4.1)                                                        */
/* -------------------------------------------------------------------------- */

/** §4.1 kind mapping. `undefined` means "skip this row entirely". */
export function mapKind(plannableType: string, title: string): Kind | undefined {
  switch (plannableType) {
    case "quiz":
      return "quiz";
    case "assignment":
      return "assignment";
    case "discussion_topic":
      return "assignment";
    case "calendar_event":
      return /\b(exam|midterm|final)\b/i.test(title) ? "exam" : "other";
    case "planner_note":
    case "announcement":
    case "wiki_page":
      return undefined;
    default:
      // Not in §4.1's table. Emitted as "other" rather than dropped: silently
      // losing a deadline is the failure mode §11 calls catastrophic, and an
      // unexpected row in the list is visible and cheap to hide.
      return "other";
  }
}

/**
 * §4.1: `submissions` is either `false` or an object. `late` is a modifier, not
 * a state, so it is recorded in `extra` rather than folded into `status`.
 */
export function mapStatus(submissions: unknown): Status {
  if (submissions === false || submissions == null) return "not_submitted";
  if (typeof submissions !== "object") return "unknown";
  const s = submissions as Record<string, unknown>;
  // "excused" means nothing is owed, which is "done" for our purposes.
  if (s["excused"] === true) return "graded";
  if (s["graded"] === true) return "graded";
  if (s["submitted"] === true) return "submitted";
  if (s["missing"] === true) return "missing";
  return "not_submitted";
}




/**
 * Parses one page of `/api/v1/planner/items`.
 *
 * `[]` is a legitimate result and is **not** a ParseError: it was confirmed on
 * a real account that publishes 67 assignments, none of which carry a `due_at`
 * (docs/canvas-findings.md). §4.1 documents that undated assignments never
 * appear in the planner. A non-array body, by contrast, is structural surprise.
 */
export function parsePlannerItems(
  body: string,
  courses: Map<number, CanvasCourse>,
  page: PageCtx,
): RawItem[] {
  const rows = parseJsonArray(body, "planner items");
  const items: RawItem[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const entry = row as Record<string, unknown>;

    const plannableType = entry["plannable_type"];
    if (typeof plannableType !== "string") {
      throw new ParseError("planner items: row without a plannable_type");
    }

    const plannable = (entry["plannable"] ?? {}) as Record<string, unknown>;
    const title = nonEmpty(plannable["title"]) ?? nonEmpty(plannable["name"]);

    // Decide whether the row is wanted *before* insisting it is well formed.
    // §4.1 says to skip planner_note, announcement and wiki_page outright, and
    // throwing over a missing title on a row we are about to discard would take
    // down every real deadline on the same page.
    const kind = mapKind(plannableType, title ?? "");
    if (kind === undefined) continue;

    if (title === undefined) {
      throw new ParseError(`planner items: ${plannableType} row without a title`);
    }

    const plannableId = entry["plannable_id"] ?? plannable["id"];
    if (typeof plannableId !== "number" && typeof plannableId !== "string") {
      throw new ParseError(`planner items: ${plannableType} row without a plannable_id`);
    }

    const courseId = typeof entry["course_id"] === "number" ? entry["course_id"] : undefined;
    const course = courseId === undefined ? undefined : courses.get(courseId);
    const contextName =
      typeof entry["context_name"] === "string" ? entry["context_name"] : undefined;
    // §4.1 names context_name as the course string; the course map is richer
    // when the id resolves, and is the only place the §5.1 code comes from.
    const courseRaw = course?.name ?? contextName ?? "";

    // §5.1: a cross-listed course ("ECE 391 / CS 391") yields several codes; the
    // first is the key and the rest are stashed so §5.3 can match on any of them.
    // `extra` is Record<string, string>, so they travel space-separated.
    const courseCodes = course?.altCodes ?? (contextName ? extractCourseCodes(contextName) : []);

    // §4.1 specifies plannable.due_at. `plannable_date` is Canvas's own
    // per-type date field and is used only as a fallback; which one was used is
    // recorded because the fallback is not yet confirmed against real data.
    // Each candidate must be a real instant with an offset (§3.2). A value that
    // is a string but not a date — "TBD", "", "Sep 12 at 11:59pm" — must not
    // become `dueAt`, and must not shadow a usable value in the other field.
    let dueAt: string | undefined;
    let dateField: string | undefined;
    if (isInstant(plannable["due_at"])) {
      dueAt = plannable["due_at"];
      dateField = "plannable.due_at";
    } else if (isInstant(entry["plannable_date"])) {
      dueAt = entry["plannable_date"];
      dateField = "plannable_date";
    }

    const extra: Record<string, string> = { plannableType };
    if (dateField) extra["dateField"] = dateField;
    // A rejected date is recorded rather than thrown: one unparseable date must
    // not discard the whole page, but it must not vanish silently either.
    if (dueAt === undefined) {
      const rejected = plannable["due_at"] ?? entry["plannable_date"];
      if (typeof rejected === "string") extra["unparsedDate"] = rejected;
    }
    if (course === undefined && courseId !== undefined) {
      extra["unknownCourseId"] = String(courseId);
    }
    if (courseCodes.length > 1) extra["altCodes"] = courseCodes.join(" ");
    const submissions = entry["submissions"];
    if (submissions && typeof submissions === "object") {
      const s = submissions as Record<string, unknown>;
      if (s["late"] === true) extra["late"] = "true";
      if (s["excused"] === true) extra["excused"] = "true";
    }

    items.push({
      source: "canvas",
      // §3.1: `${plannable_type}:${plannable_id}`.
      sourceId: `${plannableType}:${plannableId}`,
      courseRaw,
      courseCode: courseCodes[0],
      title,
      kind,
      dueAt,
      url: sameOriginHttpsUrl(
        typeof entry["html_url"] === "string" ? entry["html_url"] : undefined,
        CANVAS_ORIGIN,
        CANVAS_ORIGIN,
      ),
      status: mapStatus(submissions),
      extra,
      fetchedAt: page.fetchedAt,
    });
  }

  return items;
}

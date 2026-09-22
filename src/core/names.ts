/**
 * The words this extension uses on screen: what a source is called, what a
 * state is called, and how a time is said.
 *
 * There were three copies of this decision — `SOURCE_LABEL` and `SOURCE_NAME`
 * in `ui/popup.ts`, `SOURCE_NAMES` in `ui/options.ts`, and the raw enum leaking
 * straight into prose from `core/health.ts` and `core/quality.ts`. They
 * disagreed: the popup said "GS hasn't been read successfully" while the
 * options page said "Gradescope", and the badge said "gradescope". A student
 * who has just installed this has no way to know those are the same thing.
 *
 * So one file holds the values, the way `ui.css` holds the colours, and core
 * can reach it — which matters because the sentences that name a source are
 * built in core, not in the pages (worker rule 1).
 *
 * **A code is not a name.** `GS` is legible in a 40px column beside a row that
 * also carries a course and a clock, and illegible in a sentence. The two are
 * separate exports so that a caller has to choose, rather than reaching for
 * whichever is shorter.
 */

import { extractCourseCode } from "./normalize.js";
import type { Source } from "../sources/types.js";

/**
 * A course label as a human writes it: `CS 421`, not `CS421`.
 *
 * Two paths produce a label and they disagreed about the space. §5.1 joins its
 * captures directly, so a recognised code came out `CS421`; a name the regex
 * cannot read falls through untouched, so `CS 498DK2` kept the space its source
 * gave it. Both appeared in the same row of filter chips, which is where Sushi
 * noticed: "there's a space between CS 498DK2 but not between CS421".
 *
 * **Display only.** The stored `courseLabel` is a grouping key — it decides
 * colour, filtering, and which rows are one course — so reformatting it would
 * split every existing course in the store from its own history until the next
 * sync. The space is added on the way to the screen and nowhere else.
 *
 * Anything that is not a bare code is returned untouched, because there is no
 * rule that improves arbitrary text and several that would damage it.
 */
const BARE_CODE = /^([A-Z]{2,4})(\d{3}[A-Z]?)$/;

export function displayCourseLabel(label: string): string {
  const match = BARE_CODE.exec(label);
  return match ? `${match[1]} ${match[2]}` : label;
}

/**
 * What a course is called on screen: the student's name for it if they gave
 * one, otherwise the derived label.
 *
 * The whole chain lives here so the four surfaces that show a course cannot
 * end up disagreeing — a rename that the calendar honours and the filter strip
 * ignores is worse than no rename, because the student then has two names for
 * one course and no way to tell which is which.
 *
 * A blank or whitespace-only override is *not* a name and falls through.
 * `migrateOverrides` refuses to store one, and this refuses to trust it anyway:
 * the store is data from a previous build, and the one that wrote it may not
 * have had that rule (worker rule 8).
 */
export function courseLabel(label: string, names: Record<string, string> = {}): string {
  const custom = names[label]?.trim();
  return custom ? custom : displayCourseLabel(label);
}

/**
 * The name to use in a sentence: "Sign in to Gradescope".
 *
 * `site` is lower case and takes an article because it is a category rather
 * than a product — there is no site called "Course Websites", and capitalising
 * it in the middle of a sentence makes it look like one.
 */
export const SOURCE_NAME: Record<Source, string> = {
  canvas: "Canvas",
  gradescope: "Gradescope",
  prairielearn: "PrairieLearn",
  prairietest: "PrairieTest",
  smartphysics: "smartPhysics",
  site: "the course website",
  // Lower case and possessive for the same reason `site` is: it is not a
  // product, and "Sign in to Manual" is not a sentence anybody could act on.
  // "your own list" is what the student will call it, because they made it.
  manual: "your own list",
};

/** The same, as a heading or a row label, where an article would read oddly. */
export const SOURCE_TITLE: Record<Source, string> = {
  ...SOURCE_NAME,
  site: "Course websites",
  // The heading answers "where did this row come from", and the answer is the
  // student. "Your own list" as a label would read as a place to go.
  manual: "Added by you",
};

/**
 * The two-letter code, for the row's source column and nowhere else.
 *
 * §5.3 wants it on the row so a merged deadline shows both of its sources in
 * the width a row has. It is never a substitute for the name in prose.
 */
export const SOURCE_CODE: Record<Source, string> = {
  canvas: "CV",
  gradescope: "GS",
  prairielearn: "PL",
  prairietest: "PT",
  smartphysics: "SP",
  site: "WEB",
  // Not "MAN", which reads as a word rather than a code beside CV and GS.
  manual: "ME",
};

/**
 * Who each site is actually for.
 *
 * The reason the first-run list can be answered at all: a student who does not
 * recognise "PrairieTest" cannot decide whether they need it, and a checklist
 * that cannot be answered is worse than no checklist. Unchecking something you
 * do need is the expensive mistake here.
 *
 * Here rather than in `core/setup.ts` because Settings shows the same list and
 * had no hints at all — two surfaces asking the same question, one of them
 * without the information needed to answer it.
 */
export const SOURCE_HINT: Record<Source, string> = {
  // The caveat is the hint. This extension reads the Canvas *planner*, and
  // §4.1 says an assignment with no `due_at` "appear[s] nowhere in the planner
  // window" — so undated work is structurally absent, not missed. Without the
  // second clause a green Canvas dot reads as "all your coursework is here",
  // which is worker rule 2's failure in the student's head rather than in the
  // store: the dot is honest about the fetch and the sentence beside it was
  // not honest about what the fetch can contain.
  // (`docs/canvas-findings.md`, which had inferred the opposite and was wrong
  // in both directions — Canvas contributes more than zero, and less than all.)
  canvas: "Every UIUC course — but only work with a due date; undated assignments never reach the planner",
  gradescope: "Most CS, ECE and Math courses",
  prairielearn: "CS and ECE homework and quizzes",
  prairietest: "Exams booked at the CBTF",
  smartphysics: "PHYS 211, 212, 213 and 214 only",
  site: "Courses that keep their schedule on their own page",
  manual: "Deadlines you add yourself",
};

/**
 * Where to send someone who needs to sign in.
 *
 * `site` has none by construction: a course website is whatever host the
 * adapter points at, and there is no single page to open.
 */
export const LOGIN_URL: Partial<Record<Source, string>> = {
  canvas: "https://canvas.illinois.edu/login",
  gradescope: "https://www.gradescope.com/login",
  prairielearn: "https://us.prairielearn.com/pl/",
  prairietest: "https://us.prairietest.com/pt/",
  smartphysics: "https://smart.physics.illinois.edu/",
};

/**
 * The site's own front page.
 *
 * Not `LOGIN_URL`: when a source fails for any reason *other* than a login, the
 * useful thing to open is the page itself — so the student can see whether the
 * site is down, whether it looks different, or whether the deadline really is
 * there. Sending them to a login form for a session that is already valid is
 * an answer to a question nobody asked.
 */
export const SOURCE_HOME: Partial<Record<Source, string>> = {
  canvas: "https://canvas.illinois.edu/",
  gradescope: "https://www.gradescope.com/",
  prairielearn: "https://us.prairielearn.com/pl/",
  prairietest: "https://us.prairietest.com/pt/",
  smartphysics: "https://smart.physics.illinois.edu/",
};

/**
 * "Gradescope", "Gradescope and Canvas", "Gradescope, Canvas and PrairieLearn".
 *
 * A list in a sentence, so the sentence stays a sentence. `join(", ")` produced
 * "gradescope, canvas need you to sign in", which is neither.
 */
export function nameList(sources: readonly Source[]): string {
  const names = sources.map((source) => SOURCE_NAME[source]);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]!}`;
}

/**
 * Plain wording for a stored state, for any surface a student reads.
 *
 * The enum is for the console and the diagnostics file. §5 of the UX plan:
 * never `parse_error`, `needs_login` or `pending` on screen.
 */
export const STATE_WORD: Record<string, string> = {
  ok: "Connected",
  pending: "Checking…",
  needs_login: "Sign in needed",
  parse_error: "Couldn't read",
  network_error: "Unreachable",
  disabled: "Off",
};

/** The same states as a sentence fragment: "Gradescope could not be reached". */
export const STATE_PHRASE: Record<string, string> = {
  ok: "was read successfully",
  pending: "has not been checked yet",
  needs_login: "needs you to sign in",
  parse_error: "was not the page we expected",
  network_error: "could not be reached",
  disabled: "is switched off",
};

/**
 * "just now", "5 min ago", "3h ago", "yesterday", "6 Sep".
 *
 * `toLocaleString()` was what the Settings page showed for "last read", and
 * `List updated 9/11/2026, 6:19:34 PM` is eight tokens to answer a question
 * whose real answer is "recently". The exact stamp is still available — every
 * caller puts it in a `title` — but it stops being the thing on screen.
 *
 * A decision rather than a format string: where the boundaries fall changes
 * what the line claims. "just now" covers under a minute because a sync that
 * finished while the page was opening should not read "0 min ago", and the
 * absolute date takes over after a week because "9d ago" is arithmetic the
 * reader has to do.
 */
export function timeAgo(at: Date | number | string | undefined, now: Date): string | undefined {
  if (at === undefined) return undefined;
  const then = typeof at === "string" ? Date.parse(at) : at instanceof Date ? at.getTime() : at;
  if (!Number.isFinite(then)) return undefined;
  const seconds = Math.round((now.getTime() - then) / 1000);
  // A clock that is behind the source's, or a stamp written a moment ago by a
  // worker on a different tick. Reading "in -3 min" is worse than rounding.
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The full stamp, for the tooltip behind every `timeAgo`. */
export function fullStamp(at: Date | number | string | undefined): string | undefined {
  if (at === undefined) return undefined;
  const then = typeof at === "string" ? Date.parse(at) : at instanceof Date ? at.getTime() : at;
  if (!Number.isFinite(then)) return undefined;
  return new Date(then).toLocaleString();
}

/**
 * The department a course label belongs to: `CS357` → `CS`, `stat_425_120248`
 * → `STAT`, an instructor's free text → `undefined`.
 *
 * `extractCourseCode` is §5.1's reading of what a course code is, including
 * the underscore-separated Gradescope form and cross-listings; this is the
 * letters off the front of its answer and nothing more. Writing a second
 * regex here would be a second copy of that decision — mutation rule 3 — and
 * the two would drift the first time a source invented a new separator.
 *
 * `undefined` is the honest answer for a label with no code in it. A caller
 * that needs a colour for one has to say what it does with that, rather than
 * being handed a fake department that could collide with a real one.
 */
export function courseDepartment(label: string): string | undefined {
  const code = extractCourseCode(label);
  return code ? /^[A-Z]+/.exec(code)![0] : undefined;
}

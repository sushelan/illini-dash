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

import type { Source } from "../sources/types.js";

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
};

/** The same, as a heading or a row label, where an article would read oddly. */
export const SOURCE_TITLE: Record<Source, string> = {
  ...SOURCE_NAME,
  site: "Course websites",
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

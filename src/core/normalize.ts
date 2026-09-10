/**
 * Normalization (§5).
 *
 * Only §5.1 (course-code extraction) is implemented here, because the Canvas
 * module in build step 5 needs it to fill `RawItem.courseCode`. Title
 * normalization (§5.2) and the rest arrive with step 7.
 */

/**
 * §5.1. Two to four letters, optional separator, three digits, optional letter.
 *
 * Deliberately does not match an underscore separator: Canvas's `course_code`
 * on this instance is an opaque slug like `cs_357_120268_263847`, and matching
 * it would produce `CS357` from a string that also contains `120268` and
 * `266229` — see docs/canvas-findings.md. Run this against a human-readable
 * course *name*, not against Canvas's `course_code`.
 */
const COURSE_CODE = /\b([A-Z]{2,4})\s*-?\s*(\d{3}[A-Z]?)\b/g;

/**
 * Every course code in a raw course string, in order of appearance.
 * Cross-listed courses ("ECE 391 / CS 391") yield more than one (§5.1).
 */
export function extractCourseCodes(raw: string): string[] {
  const seen = new Set<string>();
  for (const match of raw.toUpperCase().matchAll(COURSE_CODE)) {
    seen.add(`${match[1]}${match[2]}`);
  }
  return [...seen];
}

/** The first code, which §5.1 makes the key. `undefined` when nothing matches. */
export function extractCourseCode(raw: string): string | undefined {
  return extractCourseCodes(raw)[0];
}

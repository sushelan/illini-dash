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
 * **AMENDED 2026-09-12: an underscore is a separator too.**
 *
 * It was excluded because Canvas's `course_code` is an opaque slug
 * (`cs_357_120268_263847`), and canvas-findings.md recorded declining it as
 * correct — which it was, *for Canvas*, where a human-readable `name` carries
 * the code and the amendment was to read that instead.
 *
 * Gradescope has the identical shape and no such fallback. A course whose
 * instructor never set a display name comes through as
 * `stat_425_120248_268442`, and with the underscore excluded that reached the
 * calendar as the course label — the exact outcome §5.3's amendment 2 forbids,
 * one source over. Read as a separator it yields `STAT425`, which is right.
 *
 * `\b` cannot express this: an underscore **is** a word character, so there is
 * no boundary between `425` and the `_` after it, and a `\b`-anchored pattern
 * declines `stat_425_120248` no matter what separators it allows in the middle.
 * Both ends are explicit lookarounds instead.
 *
 * The trailing ids stay safe because the tail lookahead refuses a digit:
 * `120248` offers no `\d{3}` that is not followed by another digit, and
 * `bus_ilbc_open_249233` — the admin course that exercises §5.1's no-match
 * path — still matches nothing.
 */
const COURSE_CODE = /(?<![A-Z0-9])([A-Z]{2,4})[\s_-]*(\d{3}[A-Z]?)(?![0-9A-Z])/g;

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

/* -------------------------------------------------------------------------- */
/* §5.2 Title normalization                                                    */
/* -------------------------------------------------------------------------- */

/**
 * §5.2 step 2. Applied to the whole string before tokenising, longest first so
 * "programming assignment" is not eaten by "assignment".
 *
 * The badge forms matter as much as the words: PrairieLearn titles its rows
 * `HW3 Errors and Big-O` while Canvas calls the same thing `Homework 3`, and
 * §4.3 notes that the badge is exactly what makes those two meet.
 */
const SYNONYMS: [RegExp, string][] = [
  [/\bprogramming assignments?\b/g, "pa"],
  [/\bmachine problems?\b/g, "mp"],
  [/\bhomeworks?\b/g, "hw"],
  [/\blaboratory\b/g, "lab"],
  [/\bassignments?\b/g, "hw"],
  [/\bpractice quiz(?:zes)?\b/g, "pq"],
];

/**
 * §5.2 step 4. Words that carry no identity.
 *
 * Season and year words are here because course titles carry them
 * inconsistently across sources — Gradescope's `CS425 ECE428 Fall 2026` against
 * Canvas's `Fall 2026-CS 425-…` — and a bare 4-digit year is stripped by rule
 * rather than listed, so this does not rot in January.
 */
const FILLER = new Set([
  "due", "submission", "submit", "the", "a", "an", "and", "of", "for", "to",
  "fall", "spring", "summer", "winter", "sp", "fa", "su", "wi",
]);

/**
 * Prefixes that bind to a following bare number: `mp 3` → `mp3` (§5.2 step 3).
 *
 * Exported because §5.3's badge rule must be derived from it. When the two were
 * written separately they disagreed above four letters, so §5.2 manufactured a
 * one-token title (`midterm1`) that §5.3 then refused — identical exams merged
 * or not purely on whether staff typed "Exam" or "Midterm".
 */
export const NUMBERED_PREFIX = /^(mp|hw|pa|lab|quiz|pq|ga|exam|midterm|final|discussion|ex|q|l|s|e)$/;

/**
 * §5.2: a token set for comparison only. The displayed title is never altered.
 *
 * Returns a Set, because §5.3 compares these by Jaccard similarity and by
 * subset — both set operations, and duplicate tokens would skew the first.
 */
export function normalizeTitle(raw: string): Set<string> {
  let text = raw.toLowerCase();
  for (const [pattern, replacement] of SYNONYMS) text = text.replace(pattern, replacement);

  // Step 1, after synonyms so that hyphens inside "Big-O" do not fuse tokens.
  text = text.replace(/[^a-z0-9]+/g, " ").trim();

  const words = text.split(" ").filter(Boolean);
  const tokens: string[] = [];

  for (let i = 0; i < words.length; i += 1) {
    let word = words[i]!;

    // Step 3: join a bare prefix to the number that follows it, and strip
    // leading zeros so `hw 02`, `hw2` and `HW02` all land on `hw2`.
    if (NUMBERED_PREFIX.test(word) && i + 1 < words.length && /^\d+$/.test(words[i + 1]!)) {
      word = `${word}${Number(words[i + 1])}`;
      i += 1;
    } else {
      // The same normalisation for an already-joined badge: `hw02` → `hw2`.
      const joined = /^([a-z]+)0*(\d+)([a-z]*)$/.exec(word);
      if (joined && NUMBERED_PREFIX.test(joined[1]!)) {
        word = `${joined[1]}${Number(joined[2])}${joined[3]}`;
      }
    }

    if (FILLER.has(word)) continue;
    // A bare year, so this rule does not need editing every August.
    if (/^(19|20)\d{2}$/.test(word)) continue;
    tokens.push(word);
  }

  return new Set(tokens);
}

/** |A ∩ B| / |A ∪ B| (§5.3). 0 when both are empty. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export function isSubsetOf(small: Set<string>, large: Set<string>): boolean {
  for (const token of small) if (!large.has(token)) return false;
  return true;
}

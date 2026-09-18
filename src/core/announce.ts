/**
 * A grammar for instructor announcements (for the later Piazza source and the
 * Campuswire observer).
 *
 * An announcement is prose, not a table, so every rule the DOM parsers get for
 * free has to be stated here. Three things shape the whole module:
 *
 * 1. **Grounding.** Every `Mention.span` is a verbatim substring of the input.
 *    A deadline this code shows a student has to be traceable to the words an
 *    instructor typed — "MP3 due 10/3" is a claim the post can be checked
 *    against, a reassembled "October 3, 2026" is not. `ground()` is the only
 *    way a span is built, and it throws rather than return anything else.
 * 2. **An invented time is marked** (worker house rule 3). Prose states a clock
 *    time about half the time; the rest lands on 23:59 with `timeAssumed`, so
 *    §5.3's precedence can keep ranking a stated instant above an assumed one.
 * 3. **Date-like but unreadable is reported, never dropped** (parser rule 1),
 *    and an input with no dates at all is distinguishable from one this grammar
 *    failed on (parser rule 2) — see `describeEmpty`.
 *
 * This module is pure: text in, facts out. Nothing here fetches, stores, or
 * decides to show anything.
 */

import { inferYear, isRealWallClock, monthIndex, wallClockToIso } from "./dates.js";
import { extractCourseCode, isSubsetOf, jaccard, normalizeTitle } from "./normalize.js";
import { isInstant } from "./parsing.js";
import { MONTHS, SEP, TIME, WEEKDAY_NAME } from "../sources/site.js";
import { ParseError } from "../sources/types.js";
import type { Item } from "../sources/types.js";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * What the sentence was doing with the date.
 *
 * `moved` covers both an explicit reschedule ("pushed back to Tuesday") and the
 * adverb form ("HW3 is *now* due Thursday") — "now due" is only ever written
 * when a previously stated date is being replaced, and the distinction matters
 * downstream: a `moved` mention that matches an existing item is a correction
 * to show, a plain `due` one may be the first anyone has heard of it.
 *
 * `event` is a *sitting*, not a deadline: "Your exam is on Tuesday, May 5th,
 * from 7:00 PM to 10:00 PM". The real feed made the distinction unavoidable
 * (wave 4). An exam has a start a student has to be in a room for, and reading
 * it as a "due" would put it in the list beside things you submit and, worse,
 * would let §4.5's 23:59 invention anywhere near it. `at` is the **start** of
 * the sitting — the moment the student has to be there — and it is always
 * stated, because a sitting with no clock is not a sitting this grammar reads.
 */
export type MentionKind = "due" | "extended" | "moved" | "released" | "event" | "other";

/** A mention this grammar could turn into an instant. */
export interface ReadMention {
  /** Verbatim: the substring of the input that stated the date/time. */
  span: string;
  /** The sentence the span sits in, verbatim. Used as a title of last resort. */
  context: string;
  /** ISO 8601 with offset (§3.2). */
  at: string;
  /** True when 23:59 (or any other part of `at`) is this code's invention. */
  timeAssumed: boolean;
  /** The assignment the sentence is about, verbatim ("MP3", "HW 2"), or "". */
  subject: string;
  kind: Exclude<MentionKind, "other">;
  confidence: 0.65 | 0.75 | 0.85 | 0.95;
  /**
   * A time that was stated and could not be read confidently — an ambiguous
   * bare `5:00`, or a vaguer "morning"/"afternoon". Mirrors
   * `AdapterDate.unparsedTime`: the row is kept, the invented 23:59 is flagged,
   * and the UI can say the post named a time this grammar declined to guess at.
   */
  unparsedTime?: string;
}

/**
 * A date-like phrase this grammar could not read (parser rule 1).
 *
 * `at` and `timeAssumed` are declared as `undefined` rather than left off so
 * that `Mention` is a discriminated union a caller cannot dereference blindly.
 * An `at: ""` would pass `typeof x === "string"` and shadow every fallback
 * behind it, which is parser rule 5's whole complaint.
 */
export interface UnreadableMention {
  span: string;
  context: string;
  at?: undefined;
  timeAssumed?: undefined;
  subject: string;
  kind: "other";
  confidence: 0.55;
  /** Why it could not be read; goes in a warning, never in a deadline. */
  reason: string;
}

export type Mention = ReadMention | UnreadableMention;

/** A correction to an item that already exists. */
export interface MoveSuggestion {
  kind: "move";
  itemId: string;
  /**
   * The instant the item currently holds. Absent when the item is undated —
   * a move onto an undated item is still worth suggesting, and `""` would read
   * as a real value one `typeof` check later.
   */
  from?: string;
  to: string;
  mention: ReadMention;
}

/** A deadline nothing in the store accounts for. */
export interface NewSuggestion {
  kind: "new";
  title: string;
  at: string;
  timeAssumed: boolean;
  mention: ReadMention;
}

export type Suggestion = MoveSuggestion | NewSuggestion;

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Weekday words, spelled out exactly.
 *
 * `WEEKDAY_NAME` from site.ts is `(?:sun|mon|…)[a-z]*`, which is fine inside a
 * date cell where a real date follows it and wrong in prose: it matches
 * "monthly", "satisfied" and "wednesdayish". House rule 6 — match markers
 * exactly. The loose pattern still does the *finding* (one weekday vocabulary
 * in the project), and this table does the accepting.
 */
const WEEKDAY_WORDS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const WEEKDAY_EXACT = Object.keys(WEEKDAY_WORDS).sort((a, b) => b.length - a.length).join("|");

const CAP3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Assignment badges, for `Mention.subject`.
 *
 * Every bare word here is also a `NUMBERED_PREFIX` in §5.2, which is what makes
 * `resolveMentions` able to match a subject against an item title at all; a
 * test asserts that, so the two lists cannot drift apart silently. The
 * single-letter prefixes §5.2 allows (`q`, `l`, `s`, `e`) are deliberately not
 * here: in prose they would match words a sentence writes by accident.
 */
export const SUBJECT_WORDS = [
  "mp", "hw", "pa", "lab", "quiz", "pq", "ga", "exam", "midterm", "final", "discussion",
];

const BADGE = new RegExp(
  `\\b(?:final|midterm)\\s+exam\\b` +
    `|\\b(?:${SUBJECT_WORDS.join("|")})\\s*#?\\s*\\d{1,2}[a-z]?\\b` +
    `|\\b(?:exam|midterm|final|quiz|lab|discussion)\\b`,
  "gi",
);

/**
 * "the final deadline is **May 4**" — `final` there is an adjective.
 *
 * `BADGE`'s bare-word arm exists for "the final is on Tuesday", and on the real
 * ECE 408 feed it fired on *every* post that wrote "the final deadline",
 * naming the deadline `final` and hiding the subject the sentence actually had
 * ("Milestone 3", one sentence earlier). Narrow on purpose: only the one bare
 * word that is also an ordinary English adjective, and only directly in front
 * of the noun it modifies.
 */
const ADJECTIVAL_BADGE = /^final$/i;
const MODIFIED_NOUN = /^\s+(?:deadline|due\s+date)/i;

/**
 * Words that a *phrase* subject may be built from, beyond `BADGE`.
 *
 * Instructors name assignments in plain English at least as often as with a
 * badge — "CNN project", "Milestone 3", "Subjective Evaluation Form",
 * "Regrade requests", "CNN competition" — and before wave 4 every one of those
 * came back as `""`, which means `resolveMentions` could never find the item
 * the post was about and every reading became a new suggestion.
 *
 * Deliberately *not* here: `deadline`, `date`, `grades`, `week`. They are what
 * the sentence says *about* the subject, so including them would extend
 * "CNN competition" into "CNN competition deadline".
 */
const PHRASE_NOUNS = new Set([
  ...SUBJECT_WORDS,
  "project", "projects", "competition", "assignment", "assignments", "homework",
  "report", "form", "request", "requests", "survey", "evaluation", "submission",
  "presentation", "paper", "essay", "proposal", "writeup", "write-up",
]);

/**
 * Capitalised words that start sentences rather than name assignments.
 *
 * A phrase subject leans on capitalisation, so every capitalised word that is
 * not a noun phrase has to be named. Weekdays and months are in here for the
 * same reason and a sharper one: "Friday" is capitalised, is a date, and is
 * never what a deadline is *for*.
 */
const PHRASE_STOPWORDS = new Set([
  "a", "an", "the", "this", "that", "these", "those", "there", "here", "it",
  "we", "i", "you", "your", "our", "my", "all", "as", "at", "in", "on", "of",
  "for", "and", "but", "so", "also", "to", "if", "when", "while", "with",
  "since", "after", "before", "because", "hi", "hello", "hey", "good", "best",
  "thanks", "thank", "please", "note", "prior", "due", "extra", "now", "today",
  "tonight", "tomorrow", "next", "last", "several", "every", "each", "both",
  "per", "reminder", "congratulations", "let", "us", "no", "not", "is", "are",
  "sun", "sunday", "mon", "monday", "tue", "tues", "tuesday", "wed", "weds",
  "wednesday", "thu", "thur", "thurs", "thursday", "fri", "friday", "sat",
  "saturday", "january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december",
]);

/** A run of subject words, capped: a five-word title is already a sentence. */
const MAX_PHRASE_WORDS = 5;

/**
 * A phrase subject has to be at least two words.
 *
 * One capitalised word is the start of a sentence far more often than it is an
 * assignment — "Solutions are posted Monday" would otherwise be *about*
 * "Solutions". A single word that really is a subject is a badge, and `BADGE`
 * has already had its turn by the time this runs.
 */
const MIN_PHRASE_WORDS = 2;

/**
 * The words that make a date in a sentence a *deadline* rather than scenery.
 *
 * Anchored on the verb, and scoped to the sentence: an announcement is full of
 * dates ("we met Tuesday", "the paper came out in 2019") and only the ones
 * attached to one of these are this grammar's business. Order inside the
 * alternation is load-bearing — "is now due" has to win over "due".
 */
const TRIGGER = new RegExp(
  "\\b(?:" +
    // "available until Monday" is a closing time, not a release. It has to win
    // over `released`'s bare "available", so it is spelled out first: leftmost
    // alternative wins at a given position, and both start on the same word.
    "(?<until>(?:available|open|accepted|accepting)\\s+(?:until|through|till))" +
    // "please complete the Subjective Evaluation Form linked below by Friday".
    // The verb and the "by" are the two halves of one deadline, with the thing
    // itself between them — which is also where the subject is, so the filler
    // is captured rather than skipped.
    //
    // **The verb is what makes the "by" a deadline**, and it is the only thing
    // that does. A bare "by <date-ish>" is far more often an attribution —
    // "slides by Prof. STAFF-9", "posted by the TAs on Friday", "written by
    // last year's staff" — so there is deliberately no arm here that reads a
    // "by" on its own, and `tests/announce.test.ts` pins each of those three
    // shapes producing nothing.
    //
    // `register`, `sign up` and `respond` joined the list on 2026-09-18, off
    // the real CS 425 feed: "Reminder: Register Your MP Group **by** EOD Today
    // 8/31!" is the hardest deadline on that page (miss it and you get no VM)
    // and the old list — which was written from the ECE 408 capture, where
    // every deadline was a submission — declined every one of them.
    `|(?<byDo>(?:complete|submit|turn\\s+in|hand\\s+in|fill\\s+out|finish|return|upload` +
      `|register|sign\\s+up|respond)\\b(?<byObj>[^.;:]{0,80}?)\\s+by)` +
    "|(?<moved>(?:is\\s+|are\\s+)?now\\s+due(?:\\s+(?:on|by|at))?" +
    "|(?:pushed\\s+back|pushed|moved|postponed|rescheduled|bumped)\\s+(?:to|until|back\\s+to))" +
    // "extend the final deadline of CNN project to 11:59pm today" — the object
    // between the verb and the preposition is the commonest shape on the real
    // feed, and the old adjacent-only `extend(ed) to` read none of them.
    `|(?<extended>extend(?:ed|ing|s)?\\s+(?<extObj>[^.;:]{0,60}?)\\s*\\b(?:to|until|through)` +
    "|extension\\s+(?:to|until))" +
    // A sitting, not a deadline: "Your exam is on Tuesday, May 5th, from 7:00
    // PM to 10:00 PM". Anchored on the noun *before* the verb, so "this
    // Saturday … is the review session" — a sentence about an optional extra,
    // written the other way round — is not swept in with it.
    `|(?<event>(?<evObj>final\\s+exam|exam|midterm|quiz|review\\s+session|lecture)\\b` +
    "[^.;:]{0,40}?\\s+(?:is|are|will\\s+be)\\s+(?:on|at)" +
    "|(?:is|are|will\\s+be)\\s+scheduled\\s+for)" +
    "|(?<released>(?:released|posted|available)(?:\\s+(?:on|at))?)" +
    "|(?<due>due\\s+date\\s*(?:is|:)?|due(?:\\s+(?:on|by|at))?|deadline\\s*(?:is|:)?)" +
    ")",
  "gdi",
);

/**
 * A time, or a word that names one.
 *
 * `TIME` and `SEP` come from site.ts so that prose and course pages read the
 * same clock — including the refusal of an ambiguous bare `5:00`, which is the
 * one rule here most likely to be re-derived wrongly (site.ts's
 * `parseAdapterDateParts`).
 *
 * `part` is the vaguer tail a sentence adds: "night" is the only one this
 * grammar assigns a time to (23:59, assumed), because "Sunday night" names the
 * end of Sunday and "Sunday morning" names nothing this code can put a clock on.
 */
/**
 * `SEP`, plus the separators prose uses and a date cell never does.
 *
 * "Tuesday, May 5th, **from** 7:00 PM to 10:00 PM" is how a sitting is written
 * and `SEP` stops at "at|@|T", so the whole clock was being dropped and the
 * sitting landed on an invented 23:59. A strict superset of `SEP`: everything
 * site.ts accepts still reads identically here.
 */
const PROSE_SEP = "[\\s,]*(?:at|@|T|from|starting(?:\\s+at)?|beginning(?:\\s+at)?)?[\\s,]*";

const TIME_PART =
  `(?:${PROSE_SEP}(?:${TIME}|(?<word>noon|midnight)))?` +
  `(?:\\s*(?<part>night|morning|afternoon|evening))?`;

const WEEKDAY_PREFIX = `(?:(?<weekday>${WEEKDAY_NAME})\\.?,?\\s+)?`;

/** "Friday, October 3 at 11:59 PM" · "Oct. 10" · "November 3, 2026 at 18:00" */
const CAL_MONTH = new RegExp(
  `^${WEEKDAY_PREFIX}(?<month>${MONTHS})[a-z]*\\.?\\s+(?<day>\\d{1,2})(?:st|nd|rd|th)?` +
    `(?:,?\\s*(?<year>\\d{4}))?${TIME_PART}`,
  "i",
);

/** "Fri 10/3 at 11:59pm" · "10/12" · "9/4/26" */
const CAL_NUM = new RegExp(
  `^${WEEKDAY_PREFIX}(?<month>\\d{1,2})/(?<day>\\d{1,2})(?:/(?<year>\\d{2,4}))?${TIME_PART}`,
  "i",
);

/**
 * "11:59pm today" · "noon Friday" — the clock first, the day after.
 *
 * Its own pattern rather than another optional group on `CAL_REL`, because
 * `TIME` names its capture groups and a regex cannot carry two copies of them.
 * Without it, "extend the final deadline of CNN project **to 11:59pm today**"
 * read as nothing at all: `CAL_REL` wants the day word first.
 */
const CAL_TIME_FIRST = new RegExp(
  `^(?:${TIME}|(?<word>noon|midnight))\\s+(?<rel>${WEEKDAY_NAME}|tonight|tomorrow|today)\\b`,
  "i",
);

/** "next Friday 11:59pm" · "Tuesday" · "tonight" · "end of day Friday" */
const CAL_REL = new RegExp(
  `^(?:(?<eod>end\\s+of\\s+(?:the\\s+)?day|eod)\\s+(?:on\\s+)?)?` +
    `(?:(?<qual>next|this|coming)\\s+)?` +
    `(?<rel>${WEEKDAY_NAME}|tonight|tomorrow|today)${TIME_PART}`,
  "i",
);

/**
 * Date-shaped text this grammar could not read.
 *
 * Reached only after all three patterns have declined, and its whole job is to
 * make "the instructor stated a date I cannot parse" visible as a 0.55 `other`
 * mention instead of silence (parser rule 1). Weekdays are spelled out exactly
 * here for the same reason as above — "due monthly" is not a date.
 */
const DATE_LIKE = new RegExp(
  `^(?:(?:the\\s+)?week\\s+of\\b[^.;]{0,30}` +
    `|(?:sometime|soon|shortly|after|before|around|late|early|mid)\\b[^.;]{0,30}` +
    `|\\d{1,2}/\\d{1,3}(?:/\\d{1,4})?` +
    `|(?:${MONTHS})[a-z]*\\.?\\s*\\d{1,3}(?:st|nd|rd|th)?` +
    `|(?:${WEEKDAY_EXACT})\\b)`,
  "i",
);

/** Anything that could be a date word at all — used only by `describeEmpty`. */
const DATE_WORDISH = new RegExp(
  `\\b(?:${MONTHS})[a-z]*\\b|\\b(?:${WEEKDAY_EXACT})\\b` +
    `|\\b(?:today|tonight|tomorrow|noon|midnight|week)\\b|\\d{1,2}/\\d{1,2}`,
  "i",
);

/* -------------------------------------------------------------------------- */
/* Grounding                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The only way a span is built.
 *
 * Every span is a slice of the input, so the `includes` check is a tautology
 * today — which is the point: it is the assertion that the tautology still
 * holds. The tempting edits (trim the span, collapse its whitespace, rebuild it
 * from the parsed parts so it reads nicely) all break grounding, and all of them
 * fail here on the first announcement written with two spaces in it.
 *
 * **Deleting the check survives the suite, and that is expected** (mutation
 * house rule 2, the unreachable case): no input this function accepts can reach
 * it while every span is a slice. It stays because the edit it guards against
 * is a change to *how the span is built*, which a test cannot anticipate — the
 * re-spacing mutation of exactly that kind is killed by
 * `fixtures/announcements/mp3-due-friday.txt`.
 */
function ground(text: string, start: number, end: number): string {
  const span = text.slice(start, end);
  if (span === "" || !text.includes(span)) {
    throw new ParseError(`span is not a substring of the announcement: ${JSON.stringify(span)}`);
  }
  return span;
}

/* -------------------------------------------------------------------------- */
/* Markdown                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Markdown blanked out, **without moving a single character**.
 *
 * Instructors write dates in bold — "is due on `**May 1**`", "due tomorrow,
 * `**5/18 at 12:00 PM**`" — and every pattern here is anchored, so an asterisk
 * in front of the month made the whole phrase unreadable. Over the real ECE 408
 * feed that alone cost three of the nine posts their deadline.
 *
 * Replacing each markup character with a *space* rather than deleting it is the
 * whole trick: the masked text is the same length as the original, so every
 * offset a match produces still points at the same character of the input and
 * `ground()` keeps meaning what it says. Removing the characters instead would
 * need an index map, and the first mistake in that map is a span quoting words
 * the instructor did not write.
 */
const MARKUP = /[*`]/g;

function maskMarkup(text: string): string {
  return text.replace(MARKUP, " ");
}

/* -------------------------------------------------------------------------- */
/* Sentences                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A title line: the first line, with no sentence punctuation in it, followed by
 * a line that starts a new sentence.
 *
 * The observers put the post's title in front of its body (`postsToSend`), and
 * a title is the subject of last resort — "Proj-CNN Mini Extension" over a body
 * that only says "extend the final deadline". The capital letter after the
 * newline is what tells a title from a hard wrap: `HW 2 is\nextended to Oct 10`
 * continues in lower case, and must stay one sentence.
 *
 * Spelled **once**, in two pieces, because the rule is needed twice — as a
 * sentence boundary and as the title's own extent — and the two spellings
 * differ (one consumes the line, one looks behind it). Two copies is mutation
 * house rule 3's case exactly: loosening either one alone is masked by the
 * other staying strict, and no test can reach it.
 */
const TITLE_HEAD = "[^\\n.!?;]{1,120}";
const TITLE_TAIL = "\\n(?=[A-Z])";
const TITLE_LINE = new RegExp(`^${TITLE_HEAD}${TITLE_TAIL}`);

/**
 * A sentence ends at punctuation, at a blank line, or after a title line —
 * **not** at every newline.
 *
 * Announcements are hard-wrapped, and a single `\n` falls wherever the editor's
 * column ran out. Treating it as a boundary cut `HW 2 is\nextended to Friday`
 * in half: the trigger and the date stayed together by luck, the subject did
 * not, and the post produced a dateless-looking suggestion titled after nothing.
 * The third arm is `TITLE_LINE` and nothing else — one rule, spelled once, in
 * the two places that need it.
 */
const BOUNDARY = new RegExp(
  `(?<=[.!?;])\\s+|\\n\\s*\\n|(?<=^${TITLE_HEAD})${TITLE_TAIL}`,
  "g",
);

/** The post's title, or "" when the text does not start with one. */
function titleOf(text: string): string {
  const match = TITLE_LINE.exec(text);
  return match === null ? "" : match[0].trim();
}

interface Sentence {
  /** The sentence with its markup masked — what every pattern matches against. */
  masked: string;
  /** Offset of `masked[0]` in the whole text; the two are the same length. */
  start: number;
}

/**
 * Sentences with their offsets into the original text.
 *
 * Scoping to a sentence is what keeps "It is due. Friday we review." from
 * reading as a Friday deadline: the date must follow the trigger inside one
 * sentence, with nothing but whitespace between them.
 */
function sentences(masked: string): Sentence[] {
  const out: Sentence[] = [];
  let last = 0;
  for (const match of masked.matchAll(BOUNDARY)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ masked: masked.slice(last, index), start: last });
    last = index + match[0].length;
  }
  if (last < masked.length) out.push({ masked: masked.slice(last), start: last });
  return out.filter((s) => s.masked.trim() !== "");
}

/* -------------------------------------------------------------------------- */
/* Clock                                                                       */
/* -------------------------------------------------------------------------- */

interface Clock {
  hour: number;
  minute: number;
  timeAssumed: boolean;
  unparsedTime?: string;
}

/** §4.5's invention, in one place so it is greppable: end of the stated day. */
const ASSUMED_CLOCK = { hour: 23, minute: 59, timeAssumed: true } as const;

function readClock(g: Record<string, string | undefined>): Clock {
  const word = g["word"]?.toLowerCase();
  // "midnight Friday" is read as 00:00 on Friday, the same reading site.ts's
  // `statedTimeInText` gives it. Colloquially it often means the end of Friday;
  // the two readings are 24 hours apart and nothing in the text distinguishes
  // them, so this follows the literal one rather than inventing a preference.
  if (word === "noon") return { hour: 12, minute: 0, timeAssumed: false };
  if (word === "midnight") return { hour: 0, minute: 0, timeAssumed: false };

  const rawHour = g["hour"] ?? g["hour12"];
  const ampm = (g["ampm"] ?? g["ampm12"])?.toLowerCase();
  if (rawHour !== undefined) {
    // site.ts's rule, unchanged: a bare `h:mm` under 13 with no meridiem and no
    // leading zero could be either end of the day, and reading "5:00" as 05:00
    // moves a 5 PM deadline twelve hours while looking stated.
    const ambiguous =
      ampm === undefined &&
      g["minute"] !== undefined &&
      Number(rawHour) < 13 &&
      !/^0\d$/.test(rawHour);
    const minute = g["minute"] ? Number(g["minute"]) : 0;
    let hour = Number(rawHour);
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    if (!ambiguous && hour <= 23 && minute <= 59) return { hour, minute, timeAssumed: false };
    return {
      ...ASSUMED_CLOCK,
      unparsedTime: g["minute"] === undefined ? rawHour : `${rawHour}:${g["minute"]}`,
    };
  }

  const part = g["part"]?.toLowerCase();
  if (part !== undefined && part !== "night") return { ...ASSUMED_CLOCK, unparsedTime: part };
  return { ...ASSUMED_CLOCK };
}

/* -------------------------------------------------------------------------- */
/* Calendar arithmetic                                                         */
/* -------------------------------------------------------------------------- */

interface LocalDay {
  year: number;
  month: number;
  day: number;
  weekday: number;
}

/** The calendar day `instant` falls on in `zone`, and its weekday. */
function localDay(instant: string, zone: string): LocalDay {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: CAP3.indexOf(get("weekday")),
  };
}

/** Pure calendar arithmetic — no zone involved, so no DST edge to fall into. */
function addDays(day: LocalDay, days: number): { year: number; month: number; day: number } {
  const moved = new Date(Date.UTC(day.year, day.month - 1, day.day + days));
  return {
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate(),
  };
}

/**
 * "due by Friday", resolved to the next Friday strictly after the post.
 *
 * Strictly: a Friday post saying "Friday" means the Friday a week out, not the
 * day it was written — an instructor announcing a deadline for today writes
 * "today" or "tonight". `next`/`this`/`coming` do not change the arithmetic;
 * "next Friday" in these posts means the coming one, and reading it as +14
 * would put a deadline a week after the course expects it.
 */
function nextWeekday(
  posted: LocalDay,
  weekday: number,
): { year: number; month: number; day: number } {
  const delta = (weekday - posted.weekday + 7) % 7 || 7;
  return addDays(posted, delta);
}

/* -------------------------------------------------------------------------- */
/* The scan                                                                    */
/* -------------------------------------------------------------------------- */

interface DateReading {
  /** Length of the matched phrase, from the start of the remainder. */
  length: number;
  /** The instant, or the reason it could not be built. */
  at?: string;
  timeAssumed?: boolean;
  unparsedTime?: string;
  reason?: string;
  specificity: "calendar" | "relative";
}

function readDatePhrase(
  rest: string,
  posted: LocalDay,
  postedAt: string,
  zone: string,
): DateReading | undefined {
  for (const [pattern, specificity] of [
    [CAL_MONTH, "calendar"],
    [CAL_NUM, "calendar"],
    [CAL_TIME_FIRST, "relative"],
    [CAL_REL, "relative"],
  ] as const) {
    const match = pattern.exec(rest);
    if (!match?.groups) continue;
    const g = match.groups;
    const clock = readClock(g);
    const carry = {
      length: match[0].length,
      specificity,
      timeAssumed: clock.timeAssumed,
      ...(clock.unparsedTime ? { unparsedTime: clock.unparsedTime } : {}),
    };

    if (specificity === "relative") {
      const word = g["rel"]!.toLowerCase();
      let date: { year: number; month: number; day: number };
      if (word === "today" || word === "tonight") {
        date = addDays(posted, 0);
      } else if (word === "tomorrow") {
        date = addDays(posted, 1);
      } else {
        const weekday = WEEKDAY_WORDS[word];
        // "monthly", "satisfied": `WEEKDAY_NAME` found it, the exact table
        // refuses it, and the phrase falls through to the other patterns.
        if (weekday === undefined) continue;
        date = nextWeekday(posted, weekday);
      }
      const at = wallClockToIso({ ...date, hour: clock.hour, minute: clock.minute }, zone);
      if (clock.timeAssumed) {
        const restated = restatedAsCalendar(rest.slice(match[0].length), at, posted, postedAt, zone);
        if (restated) return { ...restated, length: match[0].length + restated.length };
      }
      return { ...carry, at };
    }

    const month = /^\d+$/.test(g["month"]!)
      ? Number(g["month"])
      : monthIndex(g["month"]!.slice(0, 3).replace(/^./, (c) => c.toUpperCase()));
    if (month === undefined) {
      return { ...carry, reason: `unknown month ${JSON.stringify(g["month"])}` };
    }

    const parts = { month, day: Number(g["day"]), hour: clock.hour, minute: clock.minute };
    if (!isRealWallClock({ ...parts, year: 2000 })) {
      return { ...carry, reason: `not a real date: ${JSON.stringify(match[0])}` };
    }

    let year = g["year"] ? Number(g["year"]) : undefined;
    if (year !== undefined && year < 100) year += 2000;
    if (year === undefined) {
      // §3.2's inference, with the stated weekday as the cross-check it was
      // written for — prose states one far more often than a course page does.
      const weekdayWord = g["weekday"]?.toLowerCase();
      const known = weekdayWord !== undefined && WEEKDAY_WORDS[weekdayWord] !== undefined;
      year = inferYear(
        parts,
        known ? CAP3[WEEKDAY_WORDS[weekdayWord!]!] : undefined,
        postedAt,
        zone,
      );
      if (year === undefined) {
        return { ...carry, reason: `weekday contradicts the date: ${JSON.stringify(match[0])}` };
      }
      /*
       * An announcement never states a deadline in a previous year.
       *
       * §3.2's inference tries the reference year and both neighbours and
       * prefers the one whose weekday matches, which is right for a course
       * page listing a whole semester and wrong here: "Fri 10/3" written in
       * September 2026 is a typo — 10/3/2026 is a Saturday — and the only year
       * where the two agree is 2025. Taking it would put a year-old deadline in
       * the list looking as confident as any other. The weekday and the date
       * contradict each other, so this is parser rule 1's bad *value*: reported
       * as `other`, kept, and never turned into an instant.
       *
       * Narrow on purpose. A past date in the reference year is ordinary
       * ("HW2 was due Sep 10, late work closes Friday") and still reads.
       */
      if (year !== posted.year) {
        const candidate = wallClockToIso({ ...parts, year }, zone);
        if (Date.parse(candidate) < Date.parse(postedAt)) {
          return {
            ...carry,
            reason:
              `${JSON.stringify(match[0])} only agrees with ${year}, before the post` +
              ` — the weekday and the date contradict each other`,
          };
        }
      }
    }
    return { ...carry, at: wallClockToIso({ ...parts, year }, zone) };
  }
  return undefined;
}

/** The same calendar day in `zone`, whatever clock each instant carries. */
function sameLocalDay(a: string, b: string, zone: string): boolean {
  const left = localDay(a, zone);
  const right = localDay(b, zone);
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

/**
 * "due tomorrow, **5/18 at 12:00 PM** (noon) CDT" — the day twice, the second
 * time with a clock.
 *
 * A relative day carries no time, so §4.5's 23:59 gets invented for it. When
 * the instructor then restates the same day precisely *in the same clause*,
 * that 23:59 is not merely unstated, it is **contradicted** — the post says
 * noon and the list would have said midnight, twelve hours late, looking as
 * settled as anything else in it. Worker rule 3 in reverse: a value this code
 * invented must never outrank one the source stated.
 *
 * Deliberately narrow. The restatement is taken only when it is an explicit
 * calendar date (not a second relative word), only when it states a clock, and
 * only when it lands on the **same day** the relative phrase already resolved
 * to. A disagreement is left alone: two different days in one clause is not
 * something this grammar should be picking a winner in.
 */
function restatedAsCalendar(
  tail: string,
  relativeAt: string,
  posted: LocalDay,
  postedAt: string,
  zone: string,
): DateReading | undefined {
  const skip = /^[\s,(\-–—]*/.exec(tail)![0].length;
  const reading = readDatePhrase(tail.slice(skip), posted, postedAt, zone);
  if (
    reading?.at === undefined ||
    reading.specificity !== "calendar" ||
    reading.timeAssumed !== false ||
    !sameLocalDay(reading.at, relativeAt, zone)
  ) {
    return undefined;
  }
  return { ...reading, length: skip + reading.length };
}

function confidenceFor(
  specificity: "calendar" | "relative",
  timeAssumed: boolean,
): ReadMention["confidence"] {
  if (specificity === "calendar") return timeAssumed ? 0.85 : 0.95;
  return timeAssumed ? 0.65 : 0.75;
}

/**
 * The assignment a sentence is about.
 *
 * Nearest badge *before* the trigger ("HW3 is now due Thursday"), else the
 * first one after the date ("due Friday — this is for MP2"). Verbatim, because
 * it becomes a title the student reads and §5.2's normalisation is applied to
 * it at comparison time, never to what is displayed.
 */
function badgeIn(sentence: string, from: number, to: number, pick: "first" | "last"): Span | undefined {
  let found: Span | undefined;
  for (const match of sentence.matchAll(BADGE)) {
    const index = match.index ?? 0;
    if (index < from || index + match[0].length > to) continue;
    // "the final deadline is May 4" is not a deadline for something called
    // "final".
    if (
      ADJECTIVAL_BADGE.test(match[0]) &&
      MODIFIED_NOUN.test(sentence.slice(index + match[0].length))
    ) {
      continue;
    }
    if (pick === "first") return { start: index, end: index + match[0].length };
    found = { start: index, end: index + match[0].length };
  }
  return found;
}

interface Span {
  start: number;
  end: number;
}

/** A word and where it sits, for the phrase scan. */
const WORD = /[A-Za-z0-9#][A-Za-z0-9#'’-]*/g;

/**
 * The longest runs of subject-ish words in a region, in order.
 *
 * A word joins a run when it is capitalised and not an ordinary sentence word,
 * or is one of `PHRASE_NOUNS`, or is a bare number directly after either. A run
 * breaks on anything else and on any punctuation between two words, so the
 * span stays a clean slice of the input rather than a phrase with a comma
 * through it.
 */
function phraseRuns(region: string): Span[] {
  const words = [...region.matchAll(WORD)];
  const runs: Span[] = [];
  let run: Span | undefined;
  let count = 0;
  let previousEnd = -1;

  const close = () => {
    if (run && count >= MIN_PHRASE_WORDS) runs.push(run);
    run = undefined;
    count = 0;
  };

  for (const word of words) {
    const index = word.index ?? 0;
    const text = word[0];
    const lower = text.toLowerCase();
    const numeric = /^#?\d{1,3}$/.test(text);
    const adjacent = previousEnd >= 0 && /^\s+$/.test(region.slice(previousEnd, index));
    const modifier =
      ADJECTIVAL_BADGE.test(text) && MODIFIED_NOUN.test(region.slice(index + text.length));

    const isNoun = modifier
      ? false
      : numeric
        ? run !== undefined && adjacent
        : !PHRASE_STOPWORDS.has(lower) &&
          (PHRASE_NOUNS.has(lower) || BADGE_WORD.test(text) || /^[A-Z][A-Za-z-]*$/.test(text));

    if (!isNoun || (run !== undefined && !adjacent) || count >= MAX_PHRASE_WORDS) close();
    if (isNoun) {
      if (run === undefined) run = { start: index, end: index + text.length };
      else run.end = index + text.length;
      count += 1;
    }
    previousEnd = index + text.length;
  }
  close();
  return runs;
}

/** A badge written as one word — "HW3", "MP2" — inside a phrase run. */
const BADGE_WORD = new RegExp(`^(?:${SUBJECT_WORDS.join("|")})#?\\d{1,2}[a-z]?$`, "i");

/**
 * The assignment a sentence is about.
 *
 * Four places to look, in the order a reader would:
 *
 * 1. **The trigger's own object**, when it has one — "extend the final deadline
 *    of *CNN project* to", "complete the *Subjective Evaluation Form* … by".
 *    The **last** run wins here, because the object of a preposition chain sits
 *    at its end: "the deadline of X" is about X, not about the deadline.
 * 2. **A badge before the trigger** — "HW3 is now due Thursday". Nearest one.
 * 3. **A phrase before the trigger**, first run, because the subject of an
 *    English clause comes before its verb: "*CNN competition* deadline has been
 *    extended", "*Milestone 3* for both the CNN and GPT projects is due on".
 * 4. **After the date**, badge then phrase — "Due Friday: HW 7, all four parts".
 *
 * Verbatim in every case, because it becomes a title the student reads; §5.2's
 * normalisation is applied to it at comparison time, never to what is shown.
 */
function subjectFor(
  sentence: string,
  triggerIndex: number,
  spanEnd: number,
  object?: Span,
): Span | undefined {
  if (object && object.end > object.start) {
    const region = sentence.slice(object.start, object.end);
    const runs = phraseRuns(region);
    const last = runs[runs.length - 1];
    if (last) return { start: object.start + last.start, end: object.start + last.end };
    const badge = badgeIn(sentence, object.start, object.end, "first");
    if (badge) return badge;
  }

  const before = badgeIn(sentence, 0, triggerIndex, "last");
  if (before) return before;

  const beforeRuns = phraseRuns(sentence.slice(0, triggerIndex));
  if (beforeRuns[0]) return beforeRuns[0];

  const after = badgeIn(sentence, spanEnd, sentence.length, "first");
  if (after) return after;

  const afterRuns = phraseRuns(sentence.slice(spanEnd));
  const first = afterRuns[0];
  return first ? { start: spanEnd + first.start, end: spanEnd + first.end } : undefined;
}

function kindOf(groups: Record<string, string | undefined>): Exclude<MentionKind, "other"> {
  if (groups["moved"] !== undefined) return "moved";
  if (groups["extended"] !== undefined) return "extended";
  if (groups["event"] !== undefined) return "event";
  if (groups["released"] !== undefined) return "released";
  // `until` ("available until Monday") and `byDo` ("complete … by Friday") are
  // both plain deadlines; they are separate groups only so they can be spelled
  // ahead of `released` and `due` in the alternation.
  return "due";
}

/** Where the trigger's object sits in the sentence, when it has one. */
function objectOf(match: RegExpExecArray): Span | undefined {
  const groups = match.indices?.groups;
  const range = groups?.["extObj"] ?? groups?.["byObj"] ?? groups?.["evObj"];
  return range ? { start: range[0], end: range[1] } : undefined;
}

/**
 * Every deadline the post states, in order of appearance.
 *
 * `postedAt` is the anchor for every relative phrase and for §3.2's year
 * inference, so it is required to be a real instant with an offset: a missing
 * or naive one is a missing hook, not a bad value, and house rule 1 says throw.
 */
export function extractDeadlineMentions(
  text: string,
  postedAt: string,
  zone = "America/Chicago",
): Mention[] {
  if (typeof text !== "string") throw new ParseError("announcement text is not a string");
  if (!isInstant(postedAt)) {
    throw new ParseError(`postedAt must be an instant with an offset: ${JSON.stringify(postedAt)}`);
  }
  const posted = localDay(postedAt, zone);
  if (posted.weekday === -1 || !Number.isInteger(posted.year)) {
    throw new ParseError(`cannot place ${JSON.stringify(postedAt)} in zone ${JSON.stringify(zone)}`);
  }

  const masked = maskMarkup(text);
  const title = titleOf(text);
  const mentions: Mention[] = [];
  /*
   * The subject of the last mention, for a sentence that states none.
   *
   * "Milestone 3 … is due on May 1. With the 3-day extension, the final
   * deadline is May 4." The second sentence names nothing, and the student
   * needs both dates filed under the same assignment — an announcement is
   * about one thing, and a sentence that introduces a *different* assignment
   * names it (every such sentence on the real feed does). Only ever consulted
   * when the sentence itself yielded nothing.
   */
  let carried = "";

  for (const sentence of sentences(masked)) {
    TRIGGER.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TRIGGER.exec(sentence.masked)) !== null) {
      const triggerIndex = match.index;
      const afterTrigger = triggerIndex + match[0].length;
      const rest = sentence.masked.slice(afterTrigger);
      const gap = /^\s*/.exec(rest)![0].length;
      const phrase = rest.slice(gap);
      const phraseStart = sentence.start + afterTrigger + gap;
      const kind = kindOf(match.groups ?? {});
      const object = objectOf(match);
      // `context` is sliced from the input, never from the masked copy: it is
      // shown beside the post and has to read as the instructor typed it.
      const context = text.slice(sentence.start, sentence.start + sentence.masked.length).trim();

      const describe = (spanLength: number) => {
        const found = subjectFor(
          sentence.masked,
          triggerIndex,
          afterTrigger + gap + spanLength,
          object,
        );
        const subject =
          found === undefined
            ? carried || title
            : ground(text, sentence.start + found.start, sentence.start + found.end);
        if (subject !== "") carried = subject;
        return subject;
      };

      const reading = readDatePhrase(phrase, posted, postedAt, zone);
      if (reading) {
        const span = ground(text, phraseStart, phraseStart + trimmedLength(phrase, reading.length));
        const subject = describe(reading.length);
        if (reading.at === undefined) {
          mentions.push({
            span,
            context,
            subject,
            kind: "other",
            confidence: 0.55,
            reason: reading.reason ?? "unreadable date",
          });
        } else {
          mentions.push({
            span,
            context,
            at: reading.at,
            timeAssumed: reading.timeAssumed ?? true,
            subject,
            kind,
            confidence: confidenceFor(reading.specificity, reading.timeAssumed ?? true),
            ...(reading.unparsedTime ? { unparsedTime: reading.unparsedTime } : {}),
          });
        }
        TRIGGER.lastIndex = afterTrigger + gap + reading.length;
        continue;
      }

      // Parser rule 1: a phrase that is clearly a date and clearly unreadable is
      // the caller's problem to show, not this function's to drop.
      const vague = DATE_LIKE.exec(phrase);
      if (vague) {
        mentions.push({
          span: ground(text, phraseStart, phraseStart + trimmedLength(phrase, vague[0].length)),
          context,
          subject: describe(vague[0].length),
          kind: "other",
          confidence: 0.55,
          reason: "date-like phrase this grammar cannot read",
        });
        TRIGGER.lastIndex = afterTrigger + gap + vague[0].length;
      }
    }
  }

  return mentions;
}

/**
 * The matched length with masked trailing whitespace taken off.
 *
 * A span is cut from the *input*, so a match that ended on a masked `**` would
 * quote the asterisks back at the student — and `DATE_LIKE`'s "the week of …"
 * arm can end on real whitespace too. Measured against the masked copy so both
 * cases come off in one place.
 */
function trimmedLength(maskedPhrase: string, length: number): number {
  let end = length;
  while (end > 0 && /\s/.test(maskedPhrase[end - 1]!)) end -= 1;
  return end;
}

/* -------------------------------------------------------------------------- */
/* Telling "no dates" from "could not read" (parser rule 2)                    */
/* -------------------------------------------------------------------------- */

/**
 * Why `extractDeadlineMentions` returned nothing.
 *
 * `trigger-and-date-words-unmatched` is the alarming one: the post says "due"
 * *and* says something date-shaped, and this grammar joined neither to the
 * other. Silent empty is the worst outcome — a caller that logs this and
 * nothing else still learns when the grammar has stopped keeping up with how
 * instructors write.
 */
export type EmptyReason =
  | "no-text"
  | "no-date-words"
  | "date-words-without-trigger"
  | "trigger-without-date-words"
  | "trigger-and-date-words-unmatched";

/**
 * Describes the *text*, not a result, so it can be called after an empty
 * extraction without re-running it and without needing `postedAt`.
 */
export function describeEmpty(text: string): EmptyReason {
  if (typeof text !== "string" || text.trim() === "") return "no-text";
  // Masked, so that a bolded date is not reported as "no date words" by the
  // one function whose job is to say why the grammar found nothing.
  const masked = maskMarkup(text);
  TRIGGER.lastIndex = 0;
  const hasTrigger = TRIGGER.test(masked);
  TRIGGER.lastIndex = 0;
  const hasDate = DATE_WORDISH.test(masked);
  if (hasTrigger && hasDate) return "trigger-and-date-words-unmatched";
  if (hasTrigger) return "trigger-without-date-words";
  if (hasDate) return "date-words-without-trigger";
  return "no-date-words";
}

/* -------------------------------------------------------------------------- */
/* Resolution against the store                                                */
/* -------------------------------------------------------------------------- */

function courseMatches(item: Item, code: string | undefined): boolean {
  if (code === undefined) return true;
  return item.courseCode === code;
}

/** Tie-break only: dated before undated, earlier before later, then by id. */
function earlier(candidate: Item, incumbent: Item): boolean {
  const a = candidate.dueAt ?? "";
  const b = incumbent.dueAt ?? "";
  if (a !== b) {
    if (a === "") return false;
    if (b === "") return true;
    return a < b;
  }
  return candidate.id < incumbent.id;
}

/**
 * Turns mentions into suggestions against the items already known.
 *
 * A subject that names an existing item of the same course is a *move* — the
 * announcement is correcting a deadline the student can already see. Anything
 * else is a *new* deadline, which is the case a source cannot see at all and
 * the reason this grammar exists.
 *
 * `other` mentions produce nothing: they carry no instant, and a suggestion
 * built from one would be a deadline this code invented outright. They stay
 * visible in the `Mention[]` the caller already holds.
 *
 * Matching is §5.2's, not a second copy of it: `normalizeTitle` on both sides,
 * subset first (a subject is a fragment of a title — "HW3" against "HW 3:
 * Errors and Big-O"), then the best Jaccard. Ties are broken by the earlier
 * `dueAt` and then by id, so the same post always produces the same suggestion.
 */
export function resolveMentions(
  mentions: Mention[],
  items: Item[],
  courseHint?: string,
): Suggestion[] {
  const code = courseHint === undefined ? undefined : extractCourseCode(courseHint);
  const pool = items.filter((item) => courseMatches(item, code));
  const out: Suggestion[] = [];

  for (const mention of mentions) {
    if (mention.kind === "other") continue;
    const subjectTokens = normalizeTitle(mention.subject);

    let best: { item: Item; score: number } | undefined;
    if (subjectTokens.size > 0) {
      for (const item of pool) {
        const titleTokens = normalizeTitle(item.title);
        if (!isSubsetOf(subjectTokens, titleTokens)) continue;
        const score = jaccard(subjectTokens, titleTokens);
        if (
          best === undefined ||
          score > best.score ||
          (score === best.score && earlier(item, best.item))
        ) {
          best = { item, score };
        }
      }
    }

    if (best) {
      out.push({
        kind: "move",
        itemId: best.item.id,
        ...(best.item.dueAt ? { from: best.item.dueAt } : {}),
        to: mention.at,
        mention,
      });
    } else {
      out.push({
        kind: "new",
        // A subjectless mention still has to be nameable, and the sentence is
        // the only thing left that says what the deadline is for. Wrapping
        // whitespace is collapsed here and only here: `context` stays verbatim
        // so it can be shown beside the post, but a title with a newline in it
        // lands in a row, an `.ics` SUMMARY and a notification.
        title:
          mention.subject !== ""
            ? mention.subject
            : mention.context.replace(/\s+/g, " ").slice(0, 80),
        at: mention.at,
        timeAssumed: mention.timeAssumed,
        mention,
      });
    }
  }

  return out;
}

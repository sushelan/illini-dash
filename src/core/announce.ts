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
 */
export type MentionKind = "due" | "extended" | "moved" | "released" | "other";

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
 * The words that make a date in a sentence a *deadline* rather than scenery.
 *
 * Anchored on the verb, and scoped to the sentence: an announcement is full of
 * dates ("we met Tuesday", "the paper came out in 2019") and only the ones
 * attached to one of these are this grammar's business. Order inside the
 * alternation is load-bearing — "is now due" has to win over "due".
 */
const TRIGGER = new RegExp(
  "\\b(?:" +
    "(?<moved>(?:is\\s+|are\\s+)?now\\s+due(?:\\s+(?:on|by|at))?" +
    "|(?:pushed\\s+back|pushed|moved|postponed|rescheduled|bumped)\\s+(?:to|until|back\\s+to))" +
    "|(?<extended>extend(?:ed|ing|s)?\\s+(?:to|until|through)|extension\\s+(?:to|until))" +
    "|(?<released>(?:released|posted|available)(?:\\s+(?:on|at))?)" +
    "|(?<due>due\\s+date\\s*(?:is|:)?|due(?:\\s+(?:on|by|at))?|deadline\\s*(?:is|:)?)" +
    ")",
  "gi",
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
const TIME_PART =
  `(?:${SEP}(?:${TIME}|(?<word>noon|midnight)))?` +
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
/* Sentences                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A sentence ends at punctuation, or at a blank line — **not** at a newline.
 *
 * Announcements are hard-wrapped, and a single `\n` falls wherever the editor's
 * column ran out. Treating it as a boundary cut `HW 2 is\nextended to Friday`
 * in half: the trigger and the date stayed together by luck, the subject did
 * not, and the post produced a dateless-looking suggestion titled after nothing.
 */
const BOUNDARY = /(?<=[.!?;])\s+|\n\s*\n/g;

/**
 * Sentences with their offsets into the original text.
 *
 * Scoping to a sentence is what keeps "It is due. Friday we review." from
 * reading as a Friday deadline: the date must follow the trigger inside one
 * sentence, with nothing but whitespace between them.
 */
function sentences(text: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  let last = 0;
  for (const match of text.matchAll(BOUNDARY)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ text: text.slice(last, index), start: last });
    last = index + match[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), start: last });
  return out.filter((s) => s.text.trim() !== "");
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
      return {
        ...carry,
        at: wallClockToIso({ ...date, hour: clock.hour, minute: clock.minute }, zone),
      };
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
function subjectFor(sentence: string, triggerIndex: number, spanEnd: number): string {
  let before: RegExpMatchArray | undefined;
  let after: RegExpMatchArray | undefined;
  for (const match of sentence.matchAll(BADGE)) {
    const index = match.index ?? 0;
    if (index + match[0].length <= triggerIndex) before = match;
    else if (index >= spanEnd && after === undefined) after = match;
  }
  return (before ?? after)?.[0] ?? "";
}

function kindOf(groups: Record<string, string | undefined>): Exclude<MentionKind, "other"> {
  if (groups["moved"] !== undefined) return "moved";
  if (groups["extended"] !== undefined) return "extended";
  if (groups["released"] !== undefined) return "released";
  return "due";
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

  const mentions: Mention[] = [];

  for (const sentence of sentences(text)) {
    TRIGGER.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TRIGGER.exec(sentence.text)) !== null) {
      const triggerIndex = match.index;
      const afterTrigger = triggerIndex + match[0].length;
      const rest = sentence.text.slice(afterTrigger);
      const gap = /^\s*/.exec(rest)![0].length;
      const phrase = rest.slice(gap);
      const phraseStart = sentence.start + afterTrigger + gap;
      const kind = kindOf(match.groups ?? {});

      const reading = readDatePhrase(phrase, posted, postedAt, zone);
      if (reading) {
        const span = ground(text, phraseStart, phraseStart + reading.length);
        const context = sentence.text.trim();
        const subject = subjectFor(sentence.text, triggerIndex, afterTrigger + gap + reading.length);
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
          span: ground(text, phraseStart, phraseStart + vague[0].trimEnd().length),
          context: sentence.text.trim(),
          subject: subjectFor(sentence.text, triggerIndex, afterTrigger + gap + vague[0].length),
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
  TRIGGER.lastIndex = 0;
  const hasTrigger = TRIGGER.test(text);
  TRIGGER.lastIndex = 0;
  const hasDate = DATE_WORDISH.test(text);
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

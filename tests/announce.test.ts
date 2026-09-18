import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import {
  describeEmpty,
  extractDeadlineMentions,
  resolveMentions,
  SUBJECT_WORDS,
  type Mention,
  type ReadMention,
  type UnreadableMention,
} from "../src/core/announce.js";
import { NUMBERED_PREFIX } from "../src/core/normalize.js";
import { ParseError, type Item } from "../src/sources/types.js";

/**
 * Friday, 18 September 2026, 3 PM central.
 *
 * A Friday on purpose: "next Friday" posted on a Friday is the one weekday case
 * where +0, +7 and +14 are all defensible readings, so every relative assertion
 * below is anchored on the day that distinguishes them.
 */
const POSTED = "2026-09-18T15:00:00-05:00";

function item(partial: Partial<Item> = {}): Item {
  return {
    id: partial.title ?? "x",
    members: [],
    courseLabel: "CS225",
    title: "Thing",
    kind: "assignment",
    url: "https://example.invalid/",
    status: "not_submitted",
    hidden: false,
    done: false,
    notified: {},
    ...partial,
  };
}

function only(text: string): Mention {
  const mentions = extractDeadlineMentions(text, POSTED);
  expect(mentions, `expected exactly one mention in ${JSON.stringify(text)}`).toHaveLength(1);
  return mentions[0]!;
}

function read(text: string): ReadMention {
  const mention = only(text);
  if (mention.kind === "other") throw new Error(`expected a readable mention, got ${mention.reason}`);
  return mention;
}

/** The union is discriminated on purpose; `.reason` only exists on one side. */
function unreadable(text: string): UnreadableMention {
  const mention = only(text);
  if (mention.kind !== "other") throw new Error(`expected an unreadable mention, got ${mention.at}`);
  return mention;
}

/* -------------------------------------------------------------------------- */
/* The grammar, one row per phrase                                             */
/* -------------------------------------------------------------------------- */

describe("the phrases instructors actually write", () => {
  const rows: [
    phrase: string,
    at: string,
    timeAssumed: boolean,
    kind: ReadMention["kind"],
    subject: string,
    confidence: ReadMention["confidence"],
  ][] = [
    // Calendar dates with a stated time: the most confident thing prose offers.
    ["MP3 is due Fri 10/2 at 11:59pm.", "2026-10-02T23:59:00-05:00", false, "due", "MP3", 0.95],
    [
      "HW 2 is due Friday, October 2 at 11:59 PM.",
      "2026-10-02T23:59:00-05:00", false, "due", "HW 2", 0.95,
    ],
    // A bare date: 23:59 is this code's, and says so.
    ["Quiz 1 is due 10/12.", "2026-10-12T23:59:00-05:00", true, "due", "Quiz 1", 0.85],
    ["Lab 4 is due by Friday.", "2026-09-25T23:59:00-05:00", true, "due", "Lab 4", 0.65],
    [
      "The deadline has been extended to Oct 10.",
      "2026-10-10T23:59:00-05:00", true, "extended", "", 0.85,
    ],
    [
      "MP4 extended to next Friday 11:59pm.",
      "2026-09-25T23:59:00-05:00", false, "extended", "MP4", 0.75,
    ],
    [
      "Exam 2 has been pushed back to Tuesday.",
      "2026-09-22T23:59:00-05:00", true, "moved", "Exam 2", 0.65,
    ],
    ["Discussion 5 moved to 10/12.", "2026-10-12T23:59:00-05:00", true, "moved", "Discussion 5", 0.85],
    ["HW5 is now due Monday.", "2026-09-21T23:59:00-05:00", true, "moved", "HW5", 0.65],
    // "night" is not a clock time; 23:59 stays assumed.
    ["The deadline is Sunday night.", "2026-09-20T23:59:00-05:00", true, "due", "", 0.65],
    ["MP2 is due tonight.", "2026-09-18T23:59:00-05:00", true, "due", "MP2", 0.65],
    ["HW6 is due tomorrow.", "2026-09-19T23:59:00-05:00", true, "due", "HW6", 0.65],
    ["PA1 is due end of day Friday.", "2026-09-25T23:59:00-05:00", true, "due", "PA1", 0.65],
    ["HW3 is now due Thursday at noon.", "2026-09-24T12:00:00-05:00", false, "moved", "HW3", 0.75],
    // 24-hour, which needs no meridiem to be unambiguous.
    ["Lab 4 is due Friday at 18:00.", "2026-09-25T18:00:00-05:00", false, "due", "Lab 4", 0.75],
    [
      "The write-up is due 10/12 at 09:00.",
      "2026-10-12T09:00:00-05:00", false, "due", "", 0.95,
    ],
    // §3.2: the offset is computed for the date, not assumed. November is -06:00.
    [
      "The milestone is due November 6 at 9:00 pm.",
      "2026-11-06T21:00:00-06:00", false, "due", "", 0.95,
    ],
    ["Solutions are posted Monday.", "2026-09-21T23:59:00-05:00", true, "released", "", 0.65],
  ];

  for (const [phrase, at, timeAssumed, kind, subject, confidence] of rows) {
    it(`reads ${JSON.stringify(phrase)}`, () => {
      const mention = read(phrase);
      expect(mention.at).toBe(at);
      expect(mention.timeAssumed).toBe(timeAssumed);
      expect(mention.kind).toBe(kind);
      expect(mention.subject).toBe(subject);
      expect(mention.confidence).toBe(confidence);
      expect(phrase).toContain(mention.span);
    });
  }
});

describe("the weekday arithmetic", () => {
  // The decision, quoted: "the next such day after postedAt". Posted on a
  // Friday, "Friday" is the Friday a week out — an instructor announcing
  // something due the day they wrote it writes "today" or "tonight".
  it("resolves a weekday to the next one strictly after the post", () => {
    expect(read("HW1 is due by Friday.").at).toBe("2026-09-25T23:59:00-05:00");
  });

  it("gives 'next Friday' the same answer as 'Friday', not a week further", () => {
    expect(read("HW1 is due next Friday.").at).toBe(read("HW1 is due by Friday.").at);
    expect(read("HW1 is due this Friday.").at).toBe("2026-09-25T23:59:00-05:00");
  });

  it("wraps across a month boundary without touching the clock", () => {
    // Posted Friday 18 Sep; the next Wednesday is 23 Sep, the next Thursday 24.
    expect(read("HW1 is due Wednesday.").at).toBe("2026-09-23T23:59:00-05:00");
    expect(read("HW1 is due Thursday.").at).toBe("2026-09-24T23:59:00-05:00");
  });

  it("crosses the DST change with the offset the date has, not the post's", () => {
    // Posted in CDT; 1 November 2026 is a Sunday on the CST side of the change.
    const mention = read("The reading response is due November 1 at 9:00 pm.");
    expect(mention.at).toBe("2026-11-01T21:00:00-06:00");
  });

  it("refuses a weekday-shaped word that is not a weekday", () => {
    // House rule 6: "monthly" starts with "mon". A substring match would put a
    // deadline on the next Monday for a sentence about office hours.
    expect(extractDeadlineMentions("Office hours are due monthly.", POSTED)).toEqual([]);
  });
});

describe("times this grammar refuses to guess at", () => {
  it("refuses a bare 5:00 and records it instead of inventing 05:00", () => {
    // site.ts's rule, unchanged: reading it as 05:00 moves a 5 PM deadline
    // twelve hours earlier while looking like a stated time.
    const mention = read("HW9 is due Friday at 5:00.");
    expect(mention.at).toBe("2026-09-25T23:59:00-05:00");
    expect(mention.timeAssumed).toBe(true);
    expect(mention.unparsedTime).toBe("5:00");
  });

  it("accepts the same clock when it cannot be morning", () => {
    expect(read("HW9 is due Friday at 17:00.").timeAssumed).toBe(false);
    expect(read("HW9 is due Friday at 05:00.").at).toBe("2026-09-25T05:00:00-05:00");
    expect(read("HW9 is due Friday at 5:00 pm.").at).toBe("2026-09-25T17:00:00-05:00");
  });

  it("records a vague time of day rather than pretending none was stated", () => {
    const mention = read("HW9 is due Friday morning.");
    expect(mention.unparsedTime).toBe("morning");
    expect(mention.timeAssumed).toBe(true);
  });

  it("reads noon and midnight literally", () => {
    expect(read("HW9 is due Friday at noon.").at).toBe("2026-09-25T12:00:00-05:00");
    expect(read("HW9 is due Friday at midnight.").at).toBe("2026-09-25T00:00:00-05:00");
  });
});

describe("date-like phrases that cannot be read (parser rule 1)", () => {
  it("reports a vague phrase instead of dropping it", () => {
    const mention = only("MP7 is due sometime next week.");
    expect(mention.kind).toBe("other");
    expect(mention.confidence).toBe(0.55);
    expect(mention.at).toBeUndefined();
    expect(mention.span).toBe("sometime next week");
    expect(mention.subject).toBe("MP7");
  });

  it("reports a date that does not exist", () => {
    const mention = unreadable("HW8 is due Oct 32.");
    expect(mention.reason).toContain("not a real date");
  });

  it("reports a weekday that contradicts its date rather than reaching back a year", () => {
    // 2026-10-03 is a Saturday. §3.2's inference would take 2025, where "Fri"
    // and "10/3" agree — a year-old deadline that looks as confident as any
    // other. An announcement never states a deadline in a previous year.
    const mention = unreadable("MP5 is due Fri 10/3 at 11:59pm.");
    expect(mention.at).toBeUndefined();
    expect(mention.reason).toContain("2025");
  });

  it("still reads a past date inside the post's own year", () => {
    // "HW2 was due Sep 10, late work closes Friday" is ordinary. The guard above
    // is scoped to a year the inference reached back into, not to the past.
    expect(read("HW2 was due Sep 10.").at).toBe("2026-09-10T23:59:00-05:00");
  });

  it("reads a next-year date in a December post", () => {
    const mention = extractDeadlineMentions(
      "The final report is due Jan 5.",
      "2026-12-20T15:00:00-06:00",
    )[0]!;
    expect(mention.at).toBe("2027-01-05T23:59:00-06:00");
  });
});

describe("scope and grounding", () => {
  it("keeps every span a verbatim substring of the input", () => {
    // The grounding rule. Two spaces inside the phrase, which no instructor
    // types on purpose — a span rebuilt from the parsed parts, or re-spaced to
    // read nicely, stops being findable in the post it claims to quote.
    const text = "MP3 is due Fri 10/2 at  11:59pm.";
    const mention = read(text);
    expect(mention.span).toBe("Fri 10/2 at  11:59pm");
    expect(text.includes(mention.span)).toBe(true);
  });

  it("does not read a date in the next sentence as this sentence's deadline", () => {
    expect(extractDeadlineMentions("The MP is due. Friday we review it.", POSTED)).toEqual([]);
  });

  it("reads a sentence that the editor hard-wrapped", () => {
    // A single newline is where the column ran out, not where the sentence
    // ended; treating it as a boundary loses the subject on the line above.
    const mention = read("Because of the outage, HW 2 is\nextended to Oct 10.");
    expect(mention.subject).toBe("HW 2");
    expect(mention.kind).toBe("extended");
  });

  it("finds both deadlines in a two-sentence post, in order", () => {
    const mentions = extractDeadlineMentions(
      "MP2 is due tonight. PQ 4 is due tomorrow.",
      POSTED,
    ) as ReadMention[];
    expect(mentions.map((m) => [m.subject, m.at])).toEqual([
      ["MP2", "2026-09-18T23:59:00-05:00"],
      ["PQ 4", "2026-09-19T23:59:00-05:00"],
    ]);
  });

  it("takes the subject from after the date when none precedes the trigger", () => {
    expect(read("Due Friday: HW 7, all four parts.").subject).toBe("HW 7");
  });

  it("refuses a postedAt that is not an instant with an offset", () => {
    // A missing hook throws (house rule 1): every relative phrase is measured
    // from it, and a naive "2026-09-18" is a different instant per machine.
    expect(() => extractDeadlineMentions("HW1 is due Friday.", "2026-09-18")).toThrow(ParseError);
    expect(() => extractDeadlineMentions("HW1 is due Friday.", "")).toThrow(ParseError);
  });
});

describe("telling 'no dates' from 'could not read' (parser rule 2)", () => {
  it("reports an empty post", () => {
    expect(describeEmpty("   ")).toBe("no-text");
  });

  it("reports a post with nothing date-shaped in it", () => {
    const text = "Regrade requests go through Gradescope, not email.";
    expect(extractDeadlineMentions(text, POSTED)).toEqual([]);
    expect(describeEmpty(text)).toBe("no-date-words");
  });

  it("reports dates that were never deadlines", () => {
    const text = "We are in Loomis 151 on Monday and Wednesday for the rest of October.";
    expect(extractDeadlineMentions(text, POSTED)).toEqual([]);
    expect(describeEmpty(text)).toBe("date-words-without-trigger");
  });

  it("reports a deadline word with no date near it", () => {
    expect(describeEmpty("Submissions are due once the autograder is fixed.")).toBe(
      "trigger-without-date-words",
    );
  });

  it("reports the alarming case: both present, neither joined", () => {
    // This is the one a caller must log. It means the grammar has stopped
    // keeping up with how instructors write, and silence would hide that.
    const text = "Due date: consult the Friday handout for the real one.";
    expect(describeEmpty(text)).toBe("trigger-and-date-words-unmatched");
  });
});

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

describe("resolveMentions", () => {
  const items = [
    item({ id: "i-mp3", title: "MP 3: Machine Problem 3", courseCode: "CS225", dueAt: "2026-10-01T23:59:00-05:00" }),
    item({ id: "i-hw2", title: "Homework 2", courseCode: "CS225", dueAt: "2026-09-30T23:59:00-05:00" }),
    item({ id: "i-other", title: "MP 3", courseCode: "ECE391", dueAt: "2026-10-05T23:59:00-05:00" }),
  ];

  it("matches a subject to an existing item through §5.2's normalisation", () => {
    const suggestions = resolveMentions(
      extractDeadlineMentions("MP3 is now due Thursday at noon.", POSTED),
      items,
      "CS 225",
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      kind: "move",
      itemId: "i-mp3",
      from: "2026-10-01T23:59:00-05:00",
      to: "2026-09-24T12:00:00-05:00",
    });
  });

  it("matches the synonym forms §5.2 already knows (HW 2 ↔ Homework 2)", () => {
    const suggestions = resolveMentions(
      extractDeadlineMentions("HW 2 is extended to Oct 10.", POSTED),
      items,
      "CS225",
    );
    expect(suggestions[0]).toMatchObject({ kind: "move", itemId: "i-hw2" });
  });

  it("does not move another course's item with the same title", () => {
    const suggestions = resolveMentions(
      extractDeadlineMentions("MP3 is now due Thursday at noon.", POSTED),
      items,
      "ECE 391",
    );
    expect(suggestions[0]).toMatchObject({ kind: "move", itemId: "i-other" });
  });

  it("suggests a new deadline when nothing matches", () => {
    const suggestions = resolveMentions(
      extractDeadlineMentions("MP9 is due Friday.", POSTED),
      items,
      "CS225",
    );
    expect(suggestions[0]).toMatchObject({
      kind: "new",
      title: "MP9",
      at: "2026-09-25T23:59:00-05:00",
      timeAssumed: true,
    });
  });

  it("names a subjectless deadline after its sentence, on one line", () => {
    const suggestions = resolveMentions(
      extractDeadlineMentions("The reading response is\ndue Friday.", POSTED),
      items,
    );
    expect(suggestions[0]).toMatchObject({
      kind: "new",
      title: "The reading response is due Friday.",
    });
  });

  it("omits `from` rather than inventing one for an undated item", () => {
    const suggestions = resolveMentions(
      extractDeadlineMentions("MP3 is due Friday.", POSTED),
      [item({ id: "i-undated", title: "MP 3", courseCode: "CS225" })],
      "CS225",
    );
    expect(suggestions[0]).toMatchObject({ kind: "move", itemId: "i-undated" });
    expect((suggestions[0] as { from?: string }).from).toBeUndefined();
  });

  it("builds no suggestion from an unreadable mention", () => {
    // A suggestion from an `other` mention would be a deadline this code
    // invented outright; the mention itself stays visible to the caller.
    const mentions = extractDeadlineMentions("MP3 is due sometime next week.", POSTED);
    expect(mentions).toHaveLength(1);
    expect(resolveMentions(mentions, items, "CS225")).toEqual([]);
  });

  it("breaks a tie the same way every time", () => {
    const tied = [
      item({ id: "b", title: "MP 3", courseCode: "CS225", dueAt: "2026-10-09T23:59:00-05:00" }),
      item({ id: "a", title: "MP 3", courseCode: "CS225", dueAt: "2026-10-02T23:59:00-05:00" }),
    ];
    const forwards = resolveMentions(extractDeadlineMentions("MP3 is due Friday.", POSTED), tied, "CS225");
    const backwards = resolveMentions(
      extractDeadlineMentions("MP3 is due Friday.", POSTED),
      [...tied].reverse(),
      "CS225",
    );
    expect(forwards).toEqual(backwards);
    expect(forwards[0]).toMatchObject({ itemId: "a" });
  });
});

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const FIXTURES = new URL("../fixtures/announcements/", import.meta.url);

function fixture(name: string): string {
  return readFileSync(new URL(name, FIXTURES), "utf8");
}

describe("the constructed announcement fixtures", () => {
  const names = readdirSync(FIXTURES).filter((n) => n.endsWith(".txt")).sort();

  it("has the fixtures these tests are written against", () => {
    // A fixture directory that quietly emptied would turn every loop below into
    // a pass over nothing — silent empty, one level up.
    expect(names.length).toBeGreaterThanOrEqual(10);
  });

  it("grounds every span in every fixture", () => {
    for (const name of names) {
      const text = fixture(name);
      for (const mention of extractDeadlineMentions(text, POSTED)) {
        expect(text.includes(mention.span), `${name}: ${JSON.stringify(mention.span)}`).toBe(true);
      }
    }
  });

  it("finds a deadline in every fixture that states one", () => {
    for (const name of names) {
      if (name === "no-dates.txt" || name === "dates-without-trigger.txt") continue;
      expect(extractDeadlineMentions(fixture(name), POSTED).length, name).toBeGreaterThan(0);
    }
  });

  const expected: Record<string, Partial<ReadMention>[]> = {
    "mp3-due-friday.txt": [
      { span: "Fri 10/2 at  11:59pm", at: "2026-10-02T23:59:00-05:00", timeAssumed: false, subject: "MP3", kind: "due", confidence: 0.95 },
    ],
    "hw2-extended-october.txt": [
      { at: "2026-10-02T23:59:00-05:00", timeAssumed: false, subject: "HW 2", kind: "extended" },
    ],
    "quiz1-bare-date.txt": [
      { span: "10/12", at: "2026-10-12T23:59:00-05:00", timeAssumed: true, subject: "Quiz 1" },
    ],
    "lab-due-by-friday.txt": [
      { span: "Friday", at: "2026-09-25T23:59:00-05:00", timeAssumed: true, subject: "Lab 4" },
    ],
    "exam2-pushed-back.txt": [
      { at: "2026-09-22T23:59:00-05:00", kind: "moved", subject: "Exam 2" },
    ],
    "deadline-sunday-night.txt": [
      { span: "Sunday night", at: "2026-09-20T23:59:00-05:00", timeAssumed: true },
    ],
    "tonight-and-tomorrow.txt": [
      { span: "tonight", at: "2026-09-18T23:59:00-05:00", subject: "MP2" },
      { span: "tomorrow", at: "2026-09-19T23:59:00-05:00", subject: "PQ 4" },
    ],
    "hw3-now-due-thursday.txt": [
      { at: "2026-09-24T12:00:00-05:00", timeAssumed: false, kind: "moved", subject: "HW3" },
    ],
    "eod-friday.txt": [
      { span: "end of day Friday", at: "2026-09-25T23:59:00-05:00", timeAssumed: true, subject: "PA1" },
    ],
    "twenty-four-hour.txt": [
      { span: "10/12", at: "2026-10-12T23:59:00-05:00", kind: "moved", subject: "Discussion 5" },
      { span: "Friday at 18:00", at: "2026-09-25T18:00:00-05:00", timeAssumed: false },
    ],
    "november-dst.txt": [
      { at: "2026-11-06T21:00:00-06:00", timeAssumed: false, confidence: 0.95 },
    ],
    "ambiguous-five.txt": [
      { at: "2026-09-25T23:59:00-05:00", timeAssumed: true, unparsedTime: "5:00", subject: "HW9" },
    ],
  };

  for (const [name, mentions] of Object.entries(expected)) {
    it(`reads ${name}`, () => {
      const actual = extractDeadlineMentions(fixture(name), POSTED);
      expect(actual).toHaveLength(mentions.length);
      mentions.forEach((want, i) => expect(actual[i]).toMatchObject(want));
    });
  }

  it("reads the deliberately contradictory fixture as unreadable, not as 2025", () => {
    const mentions = extractDeadlineMentions(fixture("contradictory-weekday.txt"), POSTED);
    expect(mentions).toHaveLength(1);
    expect(mentions[0]!.kind).toBe("other");
    expect(mentions[0]!.at).toBeUndefined();
  });

  it("reads the vague fixture as unreadable, not as nothing", () => {
    const mentions = extractDeadlineMentions(fixture("vague-week-of.txt"), POSTED);
    expect(mentions[0]).toMatchObject({ kind: "other", confidence: 0.55, subject: "MP7" });
  });

  it("says why the two dateless fixtures are dateless", () => {
    expect(describeEmpty(fixture("no-dates.txt"))).toBe("no-date-words");
    expect(describeEmpty(fixture("dates-without-trigger.txt"))).toBe("date-words-without-trigger");
  });
});

describe("the subject vocabulary and §5.2 cannot drift apart", () => {
  it("every badge word this grammar looks for is a §5.2 numbered prefix", () => {
    // `resolveMentions` matches a subject to an item title through
    // `normalizeTitle`, which only joins a bare word to the number after it when
    // the word is a NUMBERED_PREFIX. A badge word missing from that list finds
    // nothing, silently, for that assignment type only.
    for (const word of SUBJECT_WORDS) {
      expect(NUMBERED_PREFIX.test(word), word).toBe(true);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* What the real feed taught it (wave 4)                                       */
/* -------------------------------------------------------------------------- */

/**
 * The nine real announcements live in `tests/announce-real.test.ts`, over the
 * Campuswire capture. These are the constructed cases that go *with* them: the
 * boundaries of each new rule, and — parser house rules 10 and 12 — the
 * deliberately unrealistic inputs a real capture cannot supply, where a wrong
 * implementation and a right one would otherwise produce the same answer.
 */
describe("markup, and the spans that survive it", () => {
  it("reads a date an instructor bolded", () => {
    // Every pattern is anchored, so before wave 4 the `**` in front of the
    // month made the whole phrase unreadable. Three of the nine real posts.
    expect(read("MP3 is due on **May 1**.").at).toBe("2026-05-01T23:59:00-05:00");
  });

  it("reads a date inside inline code", () => {
    expect(read("MP3 is due on `Oct 2` at 11:59pm.").at).toBe("2026-10-02T23:59:00-05:00");
  });

  it("keeps the span a literal substring even when markup runs through it", () => {
    /*
     * The grounding rule under masking. The text is deliberately awkward — two
     * spaces and a bold marker inside one date phrase, which no instructor
     * types on purpose — because an implementation that stripped the asterisks
     * and matched on the *shortened* text would produce a span offset by two
     * characters, and against ordinary markup that span would still look like
     * a plausible date.
     */
    const text = "HW4 is due **Fri 10/2  at 11:59pm**.";
    const mention = read(text);
    expect(mention.span).toBe("Fri 10/2  at 11:59pm");
    expect(text).toContain(mention.span);
    expect(mention.at).toBe("2026-10-02T23:59:00-05:00");
  });

  it("does not leave a masked asterisk on the end of a span", () => {
    expect(read("HW4 is due **Oct 2**.").span).toBe("Oct 2");
  });
});

describe("a clock stated beside a relative day", () => {
  it("prefers the stated clock to the invented 23:59", () => {
    // Worker rule 3 in reverse: 23:59 is this code's invention and the post
    // says noon, so the invention would be twelve hours late and look settled.
    const mention = read("HW5 is due tomorrow, 9/19 at 12:00 PM.");
    expect(mention.at).toBe("2026-09-19T12:00:00-05:00");
    expect(mention.timeAssumed).toBe(false);
    expect(mention.confidence).toBe(0.95);
    expect(mention.span).toBe("tomorrow, 9/19 at 12:00 PM");
  });

  it("leaves the relative reading alone when the restatement is a different day", () => {
    /*
     * Deliberately contradictory, and no real post writes it: "tomorrow" is the
     * 19th and the restatement says the 22nd. Two different days in one clause
     * is not something this grammar should pick a winner in, so it keeps the
     * day it already resolved and the 23:59 that goes with it. A rule that
     * simply took the later clock would pass every realistic case.
     */
    const mention = read("HW5 is due tomorrow, 9/22 at 12:00 PM.");
    expect(mention.at).toBe("2026-09-19T23:59:00-05:00");
    expect(mention.timeAssumed).toBe(true);
    expect(mention.span).toBe("tomorrow");
  });

  it("leaves it alone when the restatement states no clock of its own", () => {
    const mention = read("HW5 is due tomorrow, 9/19.");
    expect(mention.at).toBe("2026-09-19T23:59:00-05:00");
    expect(mention.timeAssumed).toBe(true);
  });

  it("reads a clock written before its day", () => {
    // "extend … to 11:59pm today" — `CAL_REL` wants the day word first, so
    // this shape read as nothing at all until it had its own pattern.
    const mention = read("MP2 is extended to 11:59pm today.");
    expect(mention.at).toBe("2026-09-18T23:59:00-05:00");
    expect(mention.timeAssumed).toBe(false);
    expect(mention.kind).toBe("extended");
  });
});

describe("the triggers the real feed writes", () => {
  it("reads 'extend the final deadline of X to <when>'", () => {
    const mention = read("We'll extend the final deadline of the CNN project to Oct 9.");
    expect(mention.kind).toBe("extended");
    expect(mention.subject).toBe("CNN project");
    expect(mention.at).toBe("2026-10-09T23:59:00-05:00");
  });

  it("reads 'available until <when>' as a closing time, not a release", () => {
    const mention = read("Regrade requests are available until Monday at noon.");
    expect(mention.kind).toBe("due");
    expect(mention.at).toBe("2026-09-21T12:00:00-05:00");
    expect(mention.subject).toBe("Regrade requests");
  });

  it("still reads 'available Monday' as a release", () => {
    // The two start on the same word, so the order of the alternation is
    // load-bearing; this is the half that must not have changed.
    expect(read("Solutions are available Monday.").kind).toBe("released");
  });

  it("reads 'complete … by <when>'", () => {
    const mention = read("Please complete the Course Evaluation Survey by Friday at 5 pm.");
    expect(mention.kind).toBe("due");
    expect(mention.subject).toBe("Course Evaluation Survey");
    expect(mention.at).toBe("2026-09-25T17:00:00-05:00");
  });

  it("reads 'register … by <when>', off the real Piazza feed", () => {
    /*
     * The trigger table was written from the Campuswire capture, where every
     * deadline was a submission, so nothing in it covered the hardest deadline
     * on the Piazza page: "Reminder: Register Your MP Group by EOD Today
     * 8/31!" (miss it and you get no VM). `tests/piazza-real.test.ts` holds the
     * post itself; this is the phrase.
     */
    const mention = read("Please register your MP Group by Friday.");
    expect(mention.kind).toBe("due");
    expect(mention.subject).toBe("MP Group");
    expect(mention.at).toBe("2026-09-25T23:59:00-05:00");
  });

  it("reads 'sign up … by' and 'respond … by' too", () => {
    expect(read("Sign up for a demo slot by Monday at 5 pm.").at).toBe(
      "2026-09-21T17:00:00-05:00",
    );
    expect(read("Please respond to the partner survey by Tuesday.").at).toBe(
      "2026-09-22T23:59:00-05:00",
    );
  });

  it("reads 'by EOD <day>' as the end of that day, and says the time is ours", () => {
    // 23:59 is this code's invention, not a clock the instructor typed — the
    // same reading `fixtures/announcements/eod-friday.txt` pins for the
    // spelled-out "end of day Friday", rather than a second convention for the
    // abbreviation.
    const mention = read("Register your group by EOD Friday.");
    expect(mention.at).toBe("2026-09-25T23:59:00-05:00");
    expect(mention.timeAssumed).toBe(true);
  });

  it("never reads a bare 'by <name>': an attribution is not a deadline", () => {
    /*
     * The verb is the only thing that makes a "by" a deadline, and these are
     * the sentences that would break if a bare "by <date-ish>" arm were ever
     * added: an announcement says "by" about who wrote something far more often
     * than about when it is due. Each one is a sentence off a real feed's
     * shape, and each must produce nothing at all.
     */
    for (const text of [
      "Today's slides by Prof. STAFF-9 are on the website.",
      "The solutions were posted by the TAs on Friday.",
      "This guide was written by last year's staff on Monday.",
      "The recording by STAFF-1 from Tuesday is up.",
    ]) {
      expect(extractDeadlineMentions(text, POSTED), text).toEqual([]);
    }
  });

  it("does not join a 'by' in the next clause to a verb in this one", () => {
    // ":" and ";" end the object, so "submit … : … by Friday" is not one
    // deadline. Without that the filler would reach across a whole list.
    expect(
      extractDeadlineMentions("Submit your work: grading closes by Friday.", POSTED),
    ).toHaveLength(0);
  });

  it("reads a sitting as an event at its start", () => {
    const mention = read("Your exam is on Tuesday, October 6th, from 7:00 PM to 10:00 PM.");
    expect(mention.kind).toBe("event");
    expect(mention.at).toBe("2026-10-06T19:00:00-05:00");
    expect(mention.timeAssumed).toBe(false);
    expect(mention.subject).toBe("exam");
  });

  it("does not read a sitting written the other way round", () => {
    // "This Saturday … is the review session" is on the real page, describes an
    // optional extra, and would put a third row on the calendar for one post.
    expect(
      extractDeadlineMentions(
        "This Saturday, October 3rd, from 3:00 PM to 5:30 PM is the review session.",
        POSTED,
      ),
    ).toEqual([]);
  });
});

describe("phrase subjects", () => {
  it("names the noun phrase in front of the verb", () => {
    expect(read("CNN competition deadline has been extended to Oct 10.").subject).toBe(
      "CNN competition",
    );
  });

  it("stops before the head noun the sentence is making a claim about", () => {
    // "CNN competition deadline" would be the subject if `deadline` counted;
    // the deadline is what is being *said*, not what it is for.
    expect(read("The Milestone 3 deadline is Oct 10.").subject).toBe("Milestone 3");
  });

  it("does not read 'final' in 'the final deadline' as an assignment", () => {
    // `BADGE`'s bare arm fired on every real post that wrote this, naming the
    // deadline "final" and hiding the subject the post actually had.
    expect(read("With the extension, the final deadline is Oct 10.").subject).toBe("");
  });

  it("still reads a bare 'final' that is an assignment", () => {
    // The guard is scoped to the one word directly in front of "deadline";
    // everywhere else `BADGE`'s bare arm keeps working.
    expect(read("The final is due Friday at 7 pm.").subject).toBe("final");
  });

  it("refuses a one-word phrase", () => {
    // "Solutions" starts the sentence; a single capitalised word is the start
    // of a sentence far more often than it is an assignment. A real subject of
    // one word is a badge, and `BADGE` has already had its turn.
    expect(read("Solutions are posted Monday.").subject).toBe("");
  });

  it("does not run a phrase through punctuation", () => {
    expect(read("Milestone 3, Part B is due Oct 10.").subject).toBe("Milestone 3");
  });
});

describe("the title, as a subject of last resort", () => {
  it("names a deadline after the post's title when the sentence names nothing", () => {
    const mention = read("Reading response 4\nThe deadline is Friday.");
    expect(mention.subject).toBe("Reading response 4");
  });

  it("treats the title as its own sentence", () => {
    // Otherwise the title's words are in front of the trigger and the phrase
    // scan reads the subject out of them — "CNN Competition Deadline Extended"
    // over a body that says something narrower.
    expect(read("Quiz 3 posted\nMP1 is due Friday.").context).toBe("MP1 is due Friday.");
  });

  it("does not mistake a hard-wrapped first line for a title", () => {
    /*
     * The one rule that tells them apart is the capital letter after the
     * newline: an editor's wrap continues in lower case. Deliberately
     * adversarial (house rule 12): a title fallback that fired on any first
     * line would name this deadline "Because of the outage, HW 2 is", which is
     * a plausible-looking string no assertion over the real capture would ever
     * reach, because every real post has a real title.
     */
    const mention = read("Because of the outage, HW 2 is\nextended to Oct 10.");
    expect(mention.subject).toBe("HW 2");
    expect(mention.context).toBe("Because of the outage, HW 2 is\nextended to Oct 10.");
  });

  it("prefers the sentence's own subject to the title", () => {
    expect(read("Everything about MP1\nMP2 is due Friday.").subject).toBe("MP2");
  });

  it("carries a subject forward to a sentence that states none", () => {
    // "Milestone 3 … is due on May 1. With the 3-day extension, the final
    // deadline is May 4." The second sentence is about the first's assignment.
    const mentions = extractDeadlineMentions(
      "Milestone 3 is due on Oct 1. With the extension, the final deadline is Oct 4.",
      POSTED,
    ) as ReadMention[];
    expect(mentions.map((m) => m.subject)).toEqual(["Milestone 3", "Milestone 3"]);
  });

  it("does not carry a subject over one the sentence states itself", () => {
    const mentions = extractDeadlineMentions("MP2 is due tonight. PQ 4 is due tomorrow.", POSTED);
    expect(mentions.map((m) => m.subject)).toEqual(["MP2", "PQ 4"]);
  });
});

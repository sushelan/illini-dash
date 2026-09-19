/**
 * `core/suggest.ts` — what a post does to the list.
 *
 * Table-driven over `fixtures/announcements/*.txt`, because the decisions here
 * are about *which* reading of a sentence is safe to apply without asking, and
 * the fixtures are the sentences. The item list is small and deliberate: the
 * titles are the ones the fixtures name, so a resolution that matches the wrong
 * row is visible rather than absorbed.
 *
 * Sushi's decision (2026-09-18): "Auto-move known items, suggest new ones
 * (marked as moved from a post, with undo)." Every assertion below is that
 * sentence, split into its cases.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  AUTO_MOVE_CONFIDENCE,
  describePost,
  ingestPost,
  movedByText,
  suggestionId,
  type IngestInput,
  type ObservedPost,
} from "../src/core/suggest.js";
import { ParseError, type Item, type Overrides, type RawItem, type Suggestion } from "../src/sources/types.js";

/** The fixtures' own anchor: a Friday (see fixtures/announcements/README.md). */
const POSTED = "2026-09-18T15:00:00-05:00";
const NOW = "2026-09-18T15:30:00-05:00";

const NO_OVERRIDES: Overrides = {
  mergeGroups: [],
  splitKeys: [],
  hiddenKeys: [],
  disabledCourses: [],
  doneKeys: [],
  keptCourses: [],
  courseNames: {},
  dueOverrides: {},
};

function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/announcements/${name}.txt`, import.meta.url), "utf8");
}

function member(partial: Partial<RawItem> & Pick<RawItem, "source" | "sourceId">): RawItem {
  return {
    courseRaw: "CS 357",
    courseCode: "CS357",
    title: "Thing",
    kind: "assignment",
    status: "not_submitted",
    fetchedAt: NOW,
    ...partial,
  };
}

function item(title: string, dueAt: string | undefined, members: RawItem[]): Item {
  return {
    id: title,
    members,
    courseCode: "CS357",
    courseLabel: "CS357",
    title,
    kind: "assignment",
    ...(dueAt ? { dueAt } : {}),
    status: "not_submitted",
    hidden: false,
    done: false,
    notified: {},
  };
}

/** The list a CS 357 student would actually have on 18 September. */
function items(): Item[] {
  return [
    item("MP3: Distributed Logging", "2026-09-30T23:59:00-05:00", [
      member({ source: "gradescope", sourceId: "mp3", title: "MP3: Distributed Logging" }),
      member({ source: "canvas", sourceId: "c-mp3", title: "MP3" }),
    ]),
    item("HW3 Errors and Big-O", "2026-09-22T23:59:00-05:00", [
      member({ source: "prairielearn", sourceId: "hw3", title: "HW3 Errors and Big-O" }),
    ]),
    item("Exam 2", "2026-10-06T19:00:00-05:00", [
      member({ source: "prairietest", sourceId: "e2", title: "Exam 2" }),
    ]),
    item("Lab 4 Checkoff", "2026-09-21T23:59:00-05:00", [
      member({ source: "site", sourceId: "lab4", title: "Lab 4 Checkoff" }),
    ]),
  ];
}

function input(partial: Partial<IngestInput> = {}): IngestInput {
  return {
    items: items(),
    overrides: NO_OVERRIDES,
    suggestions: [],
    seenPosts: {},
    ...partial,
  };
}

function post(partial: Partial<ObservedPost> & Pick<ObservedPost, "text">): ObservedPost {
  return {
    id: "cw-1",
    source: "campuswire",
    courseHint: "CS 357",
    postedAt: POSTED,
    ...partial,
  };
}

/* -------------------------------------------------------------------------- */
/* The fixtures, one row per outcome                                           */
/* -------------------------------------------------------------------------- */

describe("what each announcement does to the list", () => {
  const rows: [
    fixtureName: string,
    moves: number,
    suggestions: number,
    note: string,
  ][] = [
    // A stated date and time against a title the store already holds: the case
    // the whole feature is for. Two member keys, because MP3 is a merged row.
    ["mp3-due-friday", 2, 0, "moves a known MP, on every member key"],
    // "now due Thursday at noon" — a weekday with a stated clock, which is the
    // 0.75 rung: exactly at the bar, and therefore applied.
    ["hw3-now-due-thursday", 1, 0, "moves a known homework off an explicit reschedule"],
    // "pushed back to Tuesday" is a bare weekday, 0.65 — the reading that is
    // wrong in the way a student cannot detect. A known exam, and it still asks.
    ["exam2-pushed-back", 0, 1, "downgrades a bare-weekday reschedule of a known exam"],
    // The same rung, reached from "due by Friday" rather than a reschedule.
    ["lab-due-by-friday", 0, 1, "downgrades a bare weekday to a suggestion"],
    // Nothing in the store is called Quiz 1, so it is new work.
    ["quiz1-bare-date", 0, 1, "suggests a deadline no source lists"],
    // …nor HW 2, whose extension is the most confident thing prose offers.
    ["hw2-extended-october", 0, 1, "suggests an extension to work no source lists"],
    // The time is refused, the day is not: `announce.ts` keeps the date and
    // marks 23:59 as its own, and the suggestion carries the mark on.
    ["ambiguous-five", 0, 1, "suggests the day of a post whose clock it would not guess at"],
    // A post with no dates in it at all produces nothing, and does not throw.
    ["no-dates", 0, 0, "reads a post with no deadline in it and says nothing"],
    ["dates-without-trigger", 0, 0, "leaves dates that are not deadlines alone"],
    // Date-shaped but unreadable: `announce.ts` returns these as `other`, which
    // carries no instant, so nothing here may invent one.
    ["contradictory-weekday", 0, 0, "refuses a weekday that contradicts its date"],
    ["vague-week-of", 0, 0, "refuses a week that names no day"],
  ];

  for (const [name, moves, suggestions, note] of rows) {
    it(note, () => {
      const result = ingestPost(input(), post({ text: fixture(name) }), NOW);
      expect(Object.keys(result.dueOverrides)).toHaveLength(moves);
      expect(result.suggestions).toHaveLength(suggestions);
      // Read is read, whatever it found: otherwise every page open re-runs the
      // grammar over the same thread.
      expect(result.seenPosts).toEqual({ "cw-1": NOW });
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Moves                                                                       */
/* -------------------------------------------------------------------------- */

describe("a move", () => {
  it("is written to every member key of the item, like a hide", () => {
    const result = ingestPost(input(), post({ text: fixture("mp3-due-friday") }), NOW);
    expect(Object.keys(result.dueOverrides).sort()).toEqual([
      "canvas:c-mp3",
      "gradescope:mp3",
    ]);
    const entry = result.dueOverrides["gradescope:mp3"]!;
    expect(entry.at).toBe("2026-10-02T23:59:00-05:00");
    // The instant the row held, so the row can say what it moved *from* long
    // after `movedFrom` has been recomputed away.
    expect(entry.from).toBe("2026-09-30T23:59:00-05:00");
    expect(entry.reason).toBe("Campuswire post 2026-09-18");
    expect(entry.postId).toBe("cw-1");
    expect(entry.appliedAt).toBe(NOW);
    // The post stated 11:59pm, so nothing here was invented.
    expect(entry.timeAssumed).toBeUndefined();
  });

  it("carries timeAssumed when the post named a day and no clock", () => {
    // Worker rule 3: `announce.ts` fills 23:59 for a bare date, and §5.3 has to
    // go on preferring a stated instant to this one even though an instructor
    // supplied the day.
    const result = ingestPost(input(), post({ text: "HW3 is now due 10/12." }), NOW);
    const entry = result.dueOverrides["prairielearn:hw3"]!;
    expect(entry.at).toBe("2026-10-12T23:59:00-05:00");
    expect(entry.timeAssumed).toBe(true);
  });

  it("is refused below the confidence bar, and suggested instead", () => {
    const result = ingestPost(input(), post({ text: fixture("lab-due-by-friday") }), NOW);
    expect(result.dueOverrides).toEqual({});
    expect(result.suggestions[0]!.title).toBe("Lab 4 Checkoff");
    expect(result.skipped.map((entry) => entry.reason).join(" ")).toContain("suggesting instead");
  });

  it("leaves a row the student typed alone", () => {
    // The student owns `manualItems`; a post may not edit their own words
    // underneath them. It becomes a suggestion so they can act on it.
    const mine = item("MP3: Distributed Logging", "2026-09-30T23:59:00-05:00", [
      member({ source: "manual", sourceId: "uuid-1", title: "MP3: Distributed Logging" }),
    ]);
    const result = ingestPost(
      input({ items: [mine] }),
      post({ text: fixture("mp3-due-friday") }),
      NOW,
    );
    expect(result.dueOverrides).toEqual({});
    expect(result.suggestions).toHaveLength(1);
    expect(result.skipped[0]!.reason).toContain("your own row");
  });

  it("does not record a move to the instant the row already holds", () => {
    const already = [
      item("MP3: Distributed Logging", "2026-10-02T23:59:00-05:00", [
        member({ source: "gradescope", sourceId: "mp3", title: "MP3: Distributed Logging" }),
      ]),
    ];
    const result = ingestPost(
      input({ items: already }),
      post({ text: fixture("mp3-due-friday") }),
      NOW,
    );
    expect(result.dueOverrides).toEqual({});
    expect(result.skipped[0]!.reason).toContain("already due then");
  });

  it("lets the first sentence about an item win over the second", () => {
    const text =
      "HW3 is now due Thursday at noon. On reflection HW3 is now due Friday at noon.";
    const result = ingestPost(input(), post({ text }), NOW);
    expect(result.dueOverrides["prairielearn:hw3"]!.at).toBe("2026-09-24T12:00:00-05:00");
    expect(result.skipped.map((entry) => entry.reason).join(" ")).toContain(
      "already moved by an earlier sentence",
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Suggestions                                                                 */
/* -------------------------------------------------------------------------- */

describe("a suggestion", () => {
  it("keeps the instructor's own words, verbatim", () => {
    const text = fixture("quiz1-bare-date");
    const result = ingestPost(input(), post({ text }), NOW);
    const suggestion = result.suggestions[0]!;
    expect(suggestion.title).toBe("Quiz 1");
    expect(suggestion.at).toBe("2026-10-12T23:59:00-05:00");
    // A bare date: the 23:59 is ours and the row has to say so.
    expect(suggestion.timeAssumed).toBe(true);
    // Grounded — the span is a substring of the post the student can check.
    expect(text).toContain(suggestion.span);
    expect(text).toContain(suggestion.context);
    expect(suggestion.source).toBe("campuswire");
    expect(suggestion.postId).toBe("cw-1");
    expect(suggestion.courseRaw).toBe("CS 357");
    expect(suggestion.courseCode).toBe("CS357");
    expect(suggestion.createdAt).toBe(NOW);
  });

  it("is not made twice for the same deadline on the same day", () => {
    const existing: Suggestion = {
      id: "already",
      kind: "new",
      title: "Quiz 1",
      courseRaw: "CS 357",
      at: "2026-10-12T17:00:00-05:00",
      timeAssumed: false,
      span: "10/12 at 5 PM",
      context: "Quiz 1 is due 10/12 at 5 PM.",
      source: "piazza",
      postId: "pz-9",
      postedAt: POSTED,
      createdAt: NOW,
    };
    const result = ingestPost(
      input({ suggestions: [existing] }),
      post({ id: "cw-2", text: fixture("quiz1-bare-date") }),
      NOW,
    );
    // Same title tokens, same day — a different clock is the same deadline
    // stated twice, and two rows for it is what stops a student reading the
    // section at all.
    expect(result.suggestions).toEqual([]);
    expect(result.skipped[0]!.reason).toContain("already suggested");
  });

  it("is still made when the same name lands on a different day", () => {
    // Same title, different day, so not the same deadline: a course that runs a
    // quiz every fortnight states "Quiz 1" once and "Quiz 2" once, but a course
    // that re-uses a name — a weekly Lab 4 checkoff, a resit — states the same
    // words about two real deadlines, and suppressing the second would drop one
    // silently, which is §11's worst outcome.
    const earlier: Suggestion = {
      id: "already",
      kind: "new",
      title: "Quiz 1",
      courseRaw: "CS 357",
      at: "2026-10-05T23:59:00-05:00",
      timeAssumed: true,
      span: "10/5",
      context: "Quiz 1 is due 10/5.",
      source: "piazza",
      postId: "pz-9",
      postedAt: POSTED,
      createdAt: NOW,
    };
    const result = ingestPost(
      input({ suggestions: [earlier] }),
      post({ id: "cw-2", text: fixture("quiz1-bare-date") }),
      NOW,
    );
    expect(result.suggestions.map((entry) => entry.at)).toEqual(["2026-10-12T23:59:00-05:00"]);
  });

  it("is still made when a different deadline already sits on that day", () => {
    // The day alone is not the deadline. A Friday holds a quiz and an MP in
    // every week of this semester, and matching on the date would show one and
    // silently drop the other.
    const sameDay: Suggestion = {
      id: "already",
      kind: "new",
      title: "MP4",
      courseRaw: "CS 357",
      at: "2026-10-12T23:59:00-05:00",
      timeAssumed: true,
      span: "10/12",
      context: "MP4 is due 10/12.",
      source: "piazza",
      postId: "pz-9",
      postedAt: POSTED,
      createdAt: NOW,
    };
    const result = ingestPost(
      input({ suggestions: [sameDay] }),
      post({ id: "cw-2", text: fixture("quiz1-bare-date") }),
      NOW,
    );
    expect(result.suggestions.map((entry) => entry.title)).toEqual(["Quiz 1"]);
  });

  it("is deterministic in the post, the title and the instant", () => {
    const a = ingestPost(input(), post({ text: fixture("quiz1-bare-date") }), NOW);
    const b = ingestPost(input(), post({ text: fixture("quiz1-bare-date") }), "2026-09-19T09:00:00-05:00");
    expect(a.suggestions[0]!.id).toBe(b.suggestions[0]!.id);
    expect(a.suggestions[0]!.id).toBe(
      suggestionId("cw-1", "Quiz 1", "2026-10-12T23:59:00-05:00"),
    );
  });

  it("names the surface it came from", () => {
    expect(describePost(post({ text: "", source: "piazza" }))).toBe("Piazza post 2026-09-18");
    // A paste box does not exist yet; the message that would feed one does.
    expect(describePost(post({ text: "", source: "paste" }))).toBe("Pasted post 2026-09-18");
  });
});

/* -------------------------------------------------------------------------- */
/* Reading a post twice                                                        */
/* -------------------------------------------------------------------------- */

describe("a post that has already been read", () => {
  it("does nothing at all, and says which post and when", () => {
    const result = ingestPost(
      input({ seenPosts: { "cw-1": "2026-09-18T15:05:00-05:00" } }),
      post({ text: fixture("mp3-due-friday") }),
      NOW,
    );
    expect(result.dueOverrides).toEqual({});
    expect(result.suggestions).toEqual([]);
    // Deliberately empty: re-stamping would move the 60-day expiry forward
    // every time an observer looked at the thread.
    expect(result.seenPosts).toEqual({});
    expect(result.skipped[0]!.reason).toContain("already read at 2026-09-18T15:05:00-05:00");
  });

  it("is only the same post when the id is the same", () => {
    const result = ingestPost(
      input({ seenPosts: { "cw-0": NOW } }),
      post({ text: fixture("mp3-due-friday") }),
      NOW,
    );
    expect(Object.keys(result.dueOverrides)).toHaveLength(2);
  });
});

describe("refusals", () => {
  it("refuses a post with no id, because nothing could stop it applying twice", () => {
    expect(() => ingestPost(input(), { ...post({ text: "x" }), id: "" }, NOW)).toThrow(ParseError);
  });

  it("refuses a `now` that is not an instant with an offset", () => {
    // House rule 5: `Date.parse("2026-09-18")` succeeds and lands the previous
    // evening here, and this value is stamped on every correction.
    expect(() => ingestPost(input(), post({ text: "x" }), "2026-09-18")).toThrow(ParseError);
  });
});

describe("the confidence bar", () => {
  it("is 0.75, the rung an explicit reschedule reaches", () => {
    // Quoted rather than re-derived: `announce.ts`'s ladder is 0.95 / 0.85 /
    // 0.75 / 0.65, and 0.65 is the bare weekday that has to ask.
    expect(AUTO_MOVE_CONFIDENCE).toBe(0.75);
  });
});

/* -------------------------------------------------------------------------- */
/* What the row says                                                           */
/* -------------------------------------------------------------------------- */

describe("movedByText", () => {
  const moved = (partial: Partial<Item>): Item => ({
    ...item("MP3", "2026-10-05T23:59:00-05:00", []),
    movedBy: { reason: "Campuswire post 2026-09-18", from: "2026-10-02T23:59:00-05:00", postId: "cw-1" },
    ...partial,
  });

  it("names both ends and where the change came from", () => {
    expect(movedByText(moved({}))).toBe(
      "moved Fri, Oct 2 → Mon, Oct 5 · from Campuswire post 2026-09-18",
    );
  });

  it("says 'now due' when there was nothing to move from", () => {
    const item_ = moved({ movedBy: { reason: "Piazza post 2026-09-18", postId: "pz-1" } });
    expect(movedByText(item_)).toBe("now due Mon, Oct 5 · from Piazza post 2026-09-18");
  });

  it("says nothing about a row no post touched", () => {
    expect(movedByText(item("MP3", "2026-10-05T23:59:00-05:00", []))).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/* Piazza's first seven suggestions, read as evidence (2026-09-18)             */
/* -------------------------------------------------------------------------- */

/**
 * The live post, transcribed from the Attention tab of Sushi's own install.
 *
 * Posted on Monday 7 September, stating "this Friday" — 11 September — and read
 * on the 18th, because a fresh install's first sync reads a busy class's whole
 * history at once. Three of the seven rows it produced were like this one:
 * deadlines that were already over when they were found.
 */
const DEMO_POSTED = "2026-09-07T09:00:00-05:00";

function demoPost(partial: Partial<ObservedPost> = {}): ObservedPost {
  return {
    id: "pz-demo",
    source: "piazza",
    courseHint: "CS 425 / ECE 428: Distributed Systems",
    postedAt: DEMO_POSTED,
    text: fixture("demo-signup-live"),
    ...partial,
  };
}

describe("a deadline that had already passed when it was read (G1)", () => {
  it("offers nothing for the 11 September demo sign-up read on the 18th", () => {
    const result = ingestPost(input({ items: [] }), demoPost(), "2026-09-18T12:00:00-05:00");
    expect(result.suggestions).toEqual([]);
    expect(result.dueOverrides).toEqual({});
    // Recorded, not silently dropped: worker rule 5, and the console line is
    // the only thing that tells "read and past" from "never read".
    expect(result.skipped.map((entry) => entry.reason).join(" ")).toContain(
      "had already passed when this post was read",
    );
    // Still stamped read, or the same month of history comes back every sync.
    expect(result.seenPosts).toEqual({ "pz-demo": "2026-09-18T12:00:00-05:00" });
  });

  it("offers it to a student reading the same post on the 9th", () => {
    /*
     * The other half, and the one that makes the guard a *time* rule rather
     * than a ban on this post: nothing about the text changes between the two
     * readings. The title is the post's subject, with no Markdown in it (G2).
     */
    const result = ingestPost(input({ items: [] }), demoPost(), "2026-09-09T12:00:00-05:00");
    expect(result.suggestions).toHaveLength(1);
    const only = result.suggestions[0]!;
    expect(only.at).toBe("2026-09-11T23:59:00-05:00");
    expect(only.title).toBe("MP1 Demo Sign-up Sheet");
    expect(only.title).not.toContain("*");
    expect(only.span).toBe("this Friday at 11:59 pm");
    expect(fixture("demo-signup-live")).toContain(only.span);
  });

  /** The same week's other post, naming a row the student already has. */
  function mp1Post(): ObservedPost {
    return {
      id: "pz-mp1",
      source: "piazza",
      courseHint: "CS 357",
      postedAt: DEMO_POSTED,
      text: "MP1 sign-ups\nMP1 is due this Friday at 11:59 pm.",
    };
  }

  function mp1Row(): Item[] {
    return [
      item("MP1", "2026-09-30T23:59:00-05:00", [
        member({ source: "gradescope", sourceId: "mp1", title: "MP1" }),
      ]),
    ];
  }

  it("does not move a known row backwards onto a past date either", () => {
    /*
     * Moving is the branch with no click in it, so an old post dragging a live
     * row into the past is worse than an ignorable suggestion: the row's date
     * changes under the student with an undo they have to find.
     */
    const result = ingestPost(
      input({ items: mp1Row() }),
      mp1Post(),
      "2026-09-18T12:00:00-05:00",
    );
    expect(result.dueOverrides).toEqual({});
    expect(result.movedItems).toBe(0);
    expect(result.skipped.map((entry) => entry.reason).join(" ")).toContain("already passed");
  });

  it("moves the same row when the post is read before the deadline", () => {
    // So the guard cannot be "never move off this post".
    const result = ingestPost(
      input({ items: mp1Row() }),
      mp1Post(),
      "2026-09-09T12:00:00-05:00",
    );
    // 0.75 — a relative day with a stated clock — which is exactly the bar.
    expect(result.movedItems).toBe(1);
    expect(result.dueOverrides["gradescope:mp1"]?.at).toBe("2026-09-11T23:59:00-05:00");
  });
});

describe("the row says which post (G4)", () => {
  it("carries the post's subject on the suggestion", () => {
    const result = ingestPost(input({ items: [] }), demoPost(), "2026-09-09T12:00:00-05:00");
    expect(result.suggestions[0]!.postSubject).toBe("MP1 Demo Sign-up Sheet");
  });

  it("prefers the subject the observer states to the first line of the text", () => {
    const result = ingestPost(
      input({ items: [] }),
      demoPost({ subject: "MP1 Demo Sign-up Sheet (updated)" }),
      "2026-09-09T12:00:00-05:00",
    );
    expect(result.suggestions[0]!.postSubject).toBe("MP1 Demo Sign-up Sheet (updated)");
  });

  it("leaves it off when the post is one line with no subject", () => {
    // Absent, never `""` (house rule 5): the row then draws the wording it drew
    // before this field existed rather than an empty pair of quotes.
    const result = ingestPost(
      input({ items: [] }),
      post({ text: "Quiz 9 is due 10/12 at 5:00 pm." }),
      NOW,
    );
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]!.postSubject).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/* …and the row is not named after the whole announcement                      */
/* -------------------------------------------------------------------------- */

/**
 * Sushi's Attention tab on the 19th drew one row titled *"MP1 Demo Signups May
 * have moved location (+ Reminder to TAG your MP1 report on Gradescope)"* with
 * the same ninety characters quoted on the grey line beneath it. The subject
 * fallback was right — the sentence named nothing — and the *title* was the
 * announcement rather than the thing due.
 */
describe("a title taken from the subject is cut to the name in front of it", () => {
  /** The real subject of note 145, as `fixtures/piazza/feed.json` spells it. */
  const LONG = "MP1 Demo Signups May have moved location (+ Reminder to TAG your MP1 report on Gradescope)";

  function subjectTitled(subject: string, body: string, now = NOW): Suggestion[] {
    return ingestPost(
      input({ items: [] }),
      post({ id: "pz-145", source: "piazza", subject, text: `${subject}\n${body}` }),
      now,
    ).suggestions;
  }

  it("cuts the live row at its first parenthesis and keeps the subject whole", () => {
    const [only] = subjectTitled(LONG, "Please sign up by 9/20 at 11:59pm.");
    expect(only!.title).toBe("MP1 Demo Signups May have moved location");
    // The evidence line still has the whole thing to quote — the cut renames
    // the row, it does not throw the subject away.
    expect(only!.postSubject).toBe(LONG);
  });

  it("cuts at a colon, a dash and a plus as well", () => {
    // Each of the four other separators, one post each, so a regression in any
    // one of them cannot hide behind the parenthesis above.
    const cases: [subject: string, title: string][] = [
      ["Quiz 3: everything you need to know", "Quiz 3"],
      ["Lab 4 — room change and a reminder", "Lab 4"],
      ["Lab 5 – room change and a reminder", "Lab 5"],
      ["Homework 6 - graded and returned", "Homework 6"],
      ["Project checkpoint + the demo slots", "Project checkpoint"],
    ];
    for (const [subject, title] of cases) {
      const [only] = subjectTitled(subject, "Please sign up by 9/20 at 11:59pm.");
      expect(only!.title).toBe(title);
      expect(only!.postSubject).toBe(subject);
    }
  });

  it("leaves punctuation inside a word alone", () => {
    // Campuswire's real #645 subject, and a clock: a hyphen with no spaces
    // around it is part of a name, and "11:59" is a time. Cutting on the bare
    // character would have made these "Proj" and "Sign up by 9/20 at 11".
    for (const subject of ["Proj-CNN Mini Extension", "Sign up by 9/20 at 11:59pm"]) {
      const [only] = subjectTitled(subject, "Please sign up by 9/20 at 11:59pm.");
      expect(only!.title).toBe(subject);
    }
  });

  it("keeps the whole subject when the cut would leave fewer than three characters", () => {
    // "HW" is not a row anybody can act on. The floor is deliberately hit by a
    // subject nobody would write (house rule 10): a realistic one cuts to
    // something long enough to pass either way.
    const subject = "HW (All students) — the signup";
    const [only] = subjectTitled(subject, "Please sign up by 9/20 at 11:59pm.");
    expect(only!.title).toBe(subject);
  });

  it("does not touch a title the sentence itself named", () => {
    /*
     * The row is named after the assignment whatever the subject says around
     * it — the cut is for a title that *is* the subject, and this one is not.
     * Both halves matter: the title is neither the whole subject nor the cut
     * one, so a rule that rewrote every title from the subject would fail here
     * twice.
     */
    const [only] = subjectTitled(
      LONG,
      "MP2 is due 9/20 at 11:59pm.",
      "2026-09-18T12:00:00-05:00",
    );
    expect(only!.title).toBe("MP2");
    expect(only!.postSubject).toBe(LONG);
  });

  it("does not cut the sentence a titleless post falls back to", () => {
    /*
     * The bottom rung of `titleFor`: no subject and no name in the sentence, so
     * the row is called after the sentence. Cutting *that* at its first dash
     * would drop the half of it that says what is due, and the row would read
     * as a name it never had.
     *
     * The sentence is deliberately one nobody would write (house rule 10): two
     * " - " breaks, so a cut applied here is visible rather than plausible.
     */
    const text = "Please turn in the reflection - the short one - by 9/20 at 11:59pm.";
    const [only] = ingestPost(
      input({ items: [] }),
      post({ id: "pz-nosubject", source: "piazza", text }),
      "2026-09-18T12:00:00-05:00",
    ).suggestions;
    expect(only!.title).toBe(text);
    expect(only!.postSubject).toBeUndefined();
  });

  it("leaves a phrase's own punctuation to the phrase scan", () => {
    /*
     * "MP1 Report (4cr only, EXCEPT Coursera)" was one of the four rows on the
     * Attention tab, and it is the case this cut must not reach. Today's
     * grammar never hands one back: the phrase scan stops at the same
     * separators, so it reads **"MP1"** out of the sentence below and the
     * parenthetical is gone before any of this runs. Pinned here because that
     * is the thing being relied on — a phrase scan that started keeping its
     * parentheses would put the decision back in this module's hands, and this
     * assertion is where it would say so.
     */
    const [only] = subjectTitled(
      "Some MP1 logistics (please read)",
      "MP1 Report (4cr only, EXCEPT Coursera) is due 9/20 at 11:59pm.",
      "2026-09-18T12:00:00-05:00",
    );
    expect(only!.title).toBe("MP1");
  });
});

/* -------------------------------------------------------------------------- */
/* The seven-segment trace, through the pipeline                               */
/* -------------------------------------------------------------------------- */

describe("what the trace findings do to the list", () => {
  it("does not move a deadline off a sentence about a release (#20)", () => {
    const known = [
      item("HW3 Errors and Big-O", "2026-09-22T23:59:00-05:00", [
        member({ source: "prairielearn", sourceId: "hw3", title: "HW3 Errors and Big-O" }),
      ]),
    ];
    const result = ingestPost(
      input({ items: known }),
      post({ text: "HW3 solutions will be posted 9/23 at 3:00 pm." }),
      NOW,
    );
    expect(result.dueOverrides).toEqual({});
    expect(result.movedItems).toBe(0);
    // …and it does not become a new row either: a release is not a deadline.
    expect(result.suggestions).toEqual([]);
    expect(result.skipped.map((entry) => entry.reason).join(" ")).toContain("not a deadline");
  });

  it("does not move a deadline off a sentence about office hours (#21)", () => {
    const known = [
      item("HW3 Errors and Big-O", "2026-09-22T23:59:00-05:00", [
        member({ source: "prairielearn", sourceId: "hw3", title: "HW3 Errors and Big-O" }),
      ]),
    ];
    const result = ingestPost(
      input({ items: known }),
      post({
        text:
          "HW3 Released\nHW3 is due 9/22 at 11:59 pm.\n\n" +
          "Office hours are moved to 9/24 at 3:00 pm.",
      }),
      NOW,
    );
    // The one thing that must not happen: HW3 landing on the office-hours time.
    expect(Object.values(result.dueOverrides).map((entry) => entry.at)).not.toContain(
      "2026-09-24T15:00:00-05:00",
    );
  });

  it("moves a cross-listed class's item, and files a new row under it (#22)", () => {
    const ece = item("HW1", "2026-09-20T23:59:00-05:00", [
      member({ source: "gradescope", sourceId: "g1", title: "HW1", courseCode: "ECE428" }),
    ]);
    ece.courseCode = "ECE428";
    ece.courseLabel = "ECE428";
    const result = ingestPost(
      input({ items: [ece] }),
      post({
        source: "piazza",
        courseHint: "CS 425 / ECE 428: Distributed Systems",
        text: "HW1 is now due 9/25 at 11:59 pm.",
      }),
      NOW,
    );
    expect(result.movedItems).toBe(1);
    expect(result.dueOverrides["gradescope:g1"]?.at).toBe("2026-09-25T23:59:00-05:00");
    expect(result.suggestions).toEqual([]);
  });

  it("says why it read no deadline at all (#24)", () => {
    // `describeEmpty` has distinguished "no dates" from "dates this grammar
    // failed on" since wave 4, and nothing in `src/` was calling it.
    const result = ingestPost(input(), post({ text: fixture("no-dates") }), NOW);
    expect(result.skipped.map((entry) => entry.reason).join(" ")).toContain(
      "no deadline read: no-date-words",
    );
  });

  it("reads an EOD deadline stated as a calendar date (#24)", () => {
    const result = ingestPost(
      input(),
      post({ text: "Quiz 9 logistics\nPlease submit Quiz 9 by EOD 10/12." }),
      NOW,
    );
    expect(result.suggestions.map((entry) => entry.at)).toEqual(["2026-10-12T23:59:00-05:00"]);
  });

  it("offers two classes the same badge on the same day (#25)", () => {
    /*
     * `background.ts` ingests every class's payloads in one `mutate`, feeding
     * the growing list back in, so without the course in the comparison the
     * second class's HW2 was dropped as a duplicate — and, its post stamped
     * read on the same pass, never offered again. Badges are course-local and a
     * UIUC week puts "HW2" on the same Friday in two classes routinely.
     */
    const text = "HW2 is due 10/2 at 11:59 pm.";
    const first = ingestPost(
      input({ items: [] }),
      post({ id: "pz-1", source: "piazza", courseHint: "CS 425", text }),
      NOW,
    );
    expect(first.suggestions).toHaveLength(1);
    const second = ingestPost(
      input({ items: [], suggestions: first.suggestions }),
      post({ id: "pz-2", source: "piazza", courseHint: "ECE 411", text }),
      NOW,
    );
    expect(second.suggestions).toHaveLength(1);
    expect(second.suggestions[0]!.courseCode).toBe("ECE411");
  });

  it("still refuses the same class's deadline twice, and names the course (#25)", () => {
    const text = "HW2 is due 10/2 at 11:59 pm.";
    const first = ingestPost(
      input({ items: [] }),
      post({ id: "pz-1", source: "piazza", courseHint: "CS 425", text }),
      NOW,
    );
    const again = ingestPost(
      input({ items: [], suggestions: first.suggestions }),
      post({ id: "pz-3", source: "piazza", courseHint: "CS 425", text }),
      NOW,
    );
    expect(again.suggestions).toEqual([]);
    const reason = again.skipped.map((entry) => entry.reason).join(" ");
    expect(reason).toContain("already suggested");
    // Without the course, this sentence cannot tell a real repeat from a
    // collision between two classes — which is what cost the ECE 411 deadline.
    expect(reason).toContain("CS425");
  });
});

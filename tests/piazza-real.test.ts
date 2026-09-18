/**
 * The announcement grammar over the **real Piazza feed** — the second corpus.
 *
 * `tests/announce-real.test.ts` runs over nine captured Campuswire posts, and
 * every deadline in them is a submission ("regrade requests are due tomorrow",
 * "extend the final deadline of CNN project to"). That corpus is what the
 * grammar's trigger table was written from, and it is why the table had no verb
 * for *registering* for anything: `announce.ts` read zero deadlines out of all
 * the notes on this CS 425 / ECE 428 page (docs/piazza-findings.md).
 *
 * **20, not 25** since 2026-09-18: five of the feed's `type: "note"` entries are
 * pinned posts a *classmate* wrote (1, 5, 9, 19, 147 — "Search for Teammates!",
 * "Looking for an MP partner"), and `postsToSend` now holds those back the way
 * it holds questions back, because the grammar cannot tell an instructor's
 * sentence from a classmate's guess. They are asserted below as held, with
 * their reason, so the corpus stays exhaustive over the feed.
 *
 * So this file is the scorecard, asserted note by note: what each of the staff
 * notes yields, and — where it yields nothing — *which* nothing, because
 * "the post states no deadline" and "the grammar failed on one" want opposite
 * fixes (parser rule 2, `describeEmpty`).
 *
 * The table below is the whole feed, and it is deliberately exhaustive. A
 * change to the grammar that starts reading a date out of note 68 or note 28 —
 * the two that say both a trigger word and a date-shaped word without joining
 * them — has to come here and say so.
 *
 * Every note reaches the grammar as `subject + "\n" + content_snipet`, which is
 * the **first 120 characters** of the body and no more: the deadlines the long
 * "Running Post" notes state are far past it and are unreachable from this
 * response, whatever the grammar learns. `parsePostBody` and the body stage in
 * `background.ts` are what reach those; this file measures the feed alone.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  parseFeed,
  parsePostBody,
  postsToSend,
  withPostBody,
  type PostBody,
  type PostPayload,
} from "../src/core/piazza.js";
import { describeEmpty, extractDeadlineMentions, type EmptyReason } from "../src/core/announce.js";
import { ingestPost } from "../src/core/suggest.js";
import {
  memberKey,
  type Item,
  type Overrides,
  type RawItem,
  type Suggestion,
} from "../src/sources/types.js";

const FEED: unknown = JSON.parse(
  readFileSync(new URL("../fixtures/piazza/feed.json", import.meta.url), "utf8"),
);

const PAGE = {
  nid: "mswcsieiaip5ju",
  courseHint: "CS 425 / ECE 428: Distributed Systems",
  fetchedAt: "2026-09-18T12:00:00-05:00",
};

function notes(): Map<number, PostPayload> {
  const byNumber = new Map<number, PostPayload>();
  for (const payload of postsToSend(parseFeed(FEED, PAGE)).payloads) {
    byNumber.set(Number(payload.id.split(":")[2]), payload);
  }
  return byNumber;
}

const NOTES = notes();

/**
 * The one deadline the feed states, with the working written out.
 *
 * Note 42's subject is *"Reminder: Register Your MP Group by EOD Today 8/31!"*
 * and its snippet says the same thing again — this is the hardest deadline on
 * the page (the post's next sentence is "After the deadline, you will not
 * receive a VM"), and until 2026-09-18 the grammar declined both: it wanted a
 * due-word, and "by" was not one. "register … by" is now a trigger.
 *
 * The instant: the post was logged at 2026-08-31T15:33:29Z, which is 10:33 on
 * the 31st in Chicago, so "Today" is the 31st and EOD is 23:59 on it —
 * `2026-08-31T23:59:00-05:00`, CDT. `timeAssumed` is **true**, following
 * `fixtures/announcements/eod-friday.txt`: "end of day" has always been this
 * grammar's own 23:59 rather than a clock the instructor typed, and "EOD" is
 * the same phrase abbreviated. Confidence 0.65 is the relative-day-with-an
 * -assumed-time rung, which is below `AUTO_MOVE_CONFIDENCE`: this is offered,
 * never applied silently.
 */
const REGISTRATION = {
  span: "EOD Today",
  at: "2026-08-31T23:59:00-05:00",
  timeAssumed: true,
  kind: "due",
  subject: "MP Group",
  confidence: 0.65,
} as const;

/** Every note in the capture: what it yields, or why it yields nothing. */
const EXPECTED: Record<number, EmptyReason | "read"> = {
  179: "trigger-without-date-words",
  168: "date-words-without-trigger",
  164: "trigger-without-date-words",
  145: "date-words-without-trigger",
  125: "no-date-words",
  105: "no-date-words",
  95: "no-date-words",
  86: "no-date-words",
  80: "trigger-without-date-words",
  /*
   * "Group/VM mapping (updated 9/9)" — a date, and "available" in the subject,
   * which do not belong to each other. The grammar says so instead of joining
   * them, and that is the outcome this reason exists to make visible.
   */
  68: "trigger-and-date-words-unmatched",
  59: "date-words-without-trigger",
  42: "read",
  /* "[Last Updated Sep 13.] … Please pull the latest HW1.pdf" — same shape. */
  28: "trigger-and-date-words-unmatched",
  26: "trigger-without-date-words",
  24: "no-date-words",
  16: "no-date-words",
  15: "no-date-words",
  11: "date-words-without-trigger",
  10: "no-date-words",
  6: "no-date-words",
};

/**
 * The five pinned notes a classmate wrote, and the reason they are held back.
 *
 * `tags` on each of these has `student` and not `instructor-note`, and the body
 * confirms it (`config.is_announcement` is 0). Before 2026-09-18 they were sent
 * with the staff notes: a classmate's "I think MP2 is due 10/3" was ingested as
 * an announcement and could move a real assignment.
 */
const STUDENT_NOTES = [1, 5, 9, 19, 147];

describe("the 20 real instructor notes", () => {
  it("holds the five classmate notes back, and says which and why", () => {
    const plan = postsToSend(parseFeed(FEED, PAGE));
    const held = plan.skipped
      .filter((entry) => entry.reason === "a note a classmate wrote, not staff")
      .map((entry) => entry.nr)
      .sort((a, b) => a - b);
    expect(held).toEqual(STUDENT_NOTES);
    // And they really are notes: without the staff marker they would sail past
    // the `kind !== "note"` filter, which is the defect this replaced.
    const posts = parseFeed(FEED, PAGE);
    for (const nr of STUDENT_NOTES) {
      expect(posts.find((post) => post.nr === nr)!.kind).toBe("note");
    }
    // The opt-in exists, so the refusal is a policy and not a deletion.
    const withThem = postsToSend(posts, { includeStudentNotes: true });
    expect(withThem.payloads).toHaveLength(plan.payloads.length + STUDENT_NOTES.length);
  });

  it("is the whole feed, and nothing else", () => {
    expect([...NOTES.keys()].sort((a, b) => a - b)).toEqual(
      Object.keys(EXPECTED)
        .map(Number)
        .sort((a, b) => a - b),
    );
  });

  it("reads exactly one deadline across all of them", () => {
    const read = [...NOTES.entries()].filter(
      ([, payload]) => extractDeadlineMentions(payload.text, payload.postedAt).length > 0,
    );
    expect(read.map(([nr]) => nr)).toEqual([42]);
  });

  for (const [nr, outcome] of Object.entries(EXPECTED)) {
    it(`note ${nr}: ${outcome}`, () => {
      const payload = NOTES.get(Number(nr))!;
      const mentions = extractDeadlineMentions(payload.text, payload.postedAt);
      if (outcome === "read") {
        // Twice in one post — the subject states it and the snippet restates
        // it. Both are real readings; `ingestPost` is what collapses them into
        // one suggestion (`tests/piazza.test.ts`).
        expect(mentions).toHaveLength(2);
        for (const mention of mentions) expect(mention).toMatchObject(REGISTRATION);
        for (const mention of mentions) expect(payload.text).toContain(mention.span);
        return;
      }
      expect(mentions).toEqual([]);
      expect(describeEmpty(payload.text)).toBe(outcome);
    });
  }
});

/* -------------------------------------------------------------------------- */
/* The Running Post, read in full                                             */
/* -------------------------------------------------------------------------- */

/**
 * The deadline that made the body stage necessary — the whole way through.
 *
 * `fixtures/piazza/post-running.json` is the real `content.get` for note 28,
 * *"HW1 (All students) Released - And Clarifications (Running Post)"*, and its
 * newest version states **"HW1 is due 9/20 (Sun) 11:59 pm US Central Time.
 * This is a hard deadline"** some 1,800 characters into the body. The same post
 * reads `trigger-and-date-words-unmatched` in the table above: its snippet is
 * the *"[Last Updated Sep 13.]"* line, and no grammar can reach past it.
 *
 * What this section measures is therefore not the grammar but the delivery:
 * from the captured response to the one row a student sees.
 */
const RUNNING: unknown = JSON.parse(
  readFileSync(new URL("../fixtures/piazza/post-running.json", import.meta.url), "utf8"),
);

/** Six days before the deadline, one day after the newest version was written. */
const NOW_28 = "2026-09-14T09:00:00-05:00";
/** The feed's `log[0].t` for note 28: when it was written, not when it was edited. */
const POSTED_28 = "2026-08-28T01:32:51Z";
/**
 * When the body this test reads was actually written — the anchor.
 *
 * The feed's last `update` for note 28 and `history[0].created` in
 * `post-running.json` are the same instant to the second, sixteen days after
 * the create event above. Anchoring the newest body at `POSTED_28` put every
 * relative phrase in it sixteen days early, which is why `postAnchor` exists.
 */
const EDITED_28 = "2026-09-13T22:22:48Z";
const ID_28 = `piazza:${PAGE.nid}:28`;

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

function runningBody(): PostBody {
  return parsePostBody(RUNNING, { nid: PAGE.nid, cid: "post-28" });
}

/**
 * The payload as the worker builds it: the feed entry, the body merged in, the
 * send plan. Built through the real seams rather than by hand, so the anchor
 * this corpus measures against is the one a sync would use.
 */
function runningPayload(): PostPayload {
  const entry = parseFeed(FEED, PAGE).find((post) => post.nr === 28)!;
  const plan = postsToSend([withPostBody(entry, runningBody())]);
  expect(plan.skipped).toEqual([]);
  return plan.payloads[0]!;
}

function ingest(items: Item[], suggestions: Suggestion[] = []) {
  return ingestPost(
    { items, overrides: NO_OVERRIDES, suggestions, seenPosts: {} },
    runningPayload(),
    NOW_28,
  );
}

/** A Gradescope "HW1" for this class, due whenever the argument says. */
function gradescopeHw1(dueAt: string): Item {
  const member: RawItem = {
    source: "gradescope",
    sourceId: "hw1-425",
    courseRaw: "CS 425 / ECE 428: Distributed Systems",
    courseCode: "CS425",
    title: "HW1",
    kind: "assignment",
    status: "not_submitted",
    dueAt,
    fetchedAt: NOW_28,
  };
  return {
    id: "hw1",
    members: [member],
    courseCode: "CS425",
    courseLabel: "CS425",
    title: "HW1",
    kind: "assignment",
    dueAt,
    status: "not_submitted",
    hidden: false,
    done: false,
    notified: {},
  };
}

describe("note 28, the Running Post, read in full", () => {
  it("is anchored at the version it read, not at the day it was created", () => {
    /*
     * The trace's split finding, decided on the evidence both captures give:
     * `parsePostBody` deliberately reads `history[0]`, the **newest** version,
     * and `withPostBody` used to keep the feed's create instant as the anchor —
     * so version N was parsed against version 0's clock. The Running Post is
     * the case: created 2026-08-28, last written 2026-09-13, and its own first
     * line says "[Last Updated Sep 13.]".
     *
     * The snippet is the edited text too, so the snippet-only reading is
     * anchored at the feed's last content edit — the same instant — and only a
     * post whose log names no readable edit falls back to the create instant.
     */
    const body = runningBody();
    const entry = parseFeed(FEED, PAGE).find((post) => post.nr === 28)!;
    expect(entry.postedAt).toBe(POSTED_28);
    expect(entry.editedAt).toBe(EDITED_28);
    expect(body.versionAt).toBe(EDITED_28);
    expect(withPostBody(entry, body).versionAt).toBe(EDITED_28);
    expect(runningPayload().postedAt).toBe(EDITED_28);
    // Snippet-only: the same instant, because "[Last Updated Sep 13.]" is what
    // `content_snipet` holds.
    expect(postsToSend([entry]).payloads[0]!.postedAt).toBe(EDITED_28);

    /*
     * What the wrong anchor costs, made visible with a sentence the post does
     * not contain (house rule 10): the capture's own deadline is an absolute
     * date, so it reads the same against either instant and cannot tell a
     * right implementation from a wrong one.
     */
    const relative = "HW9 is due this Friday at 11:59pm.";
    expect(extractDeadlineMentions(relative, EDITED_28)[0]!.at).toBe(
      "2026-09-18T23:59:00-05:00",
    );
    expect(extractDeadlineMentions(relative, POSTED_28)[0]!.at).toBe(
      "2026-08-28T23:59:00-05:00",
    );
  });

  it("reads the newest version and not the one pasted from last year", () => {
    /*
     * `history` is trimmed to two versions on purpose (fixtures/piazza/README.md):
     * `history[0]` is 2026-09-13, `history[1]` is 2026-08-28 and was pasted
     * from the previous year with *different* deadlines. Reading the wrong one,
     * or reading both, produces a wrong deadline rather than none — which is
     * the failure a student cannot detect.
     */
    const body = runningBody();
    expect(body.versionAt).toBe("2026-09-13T22:22:48Z");
    expect(body.text).toContain("HW1 is due 9/20 (Sun) 11:59 pm US Central Time");
    expect(body.text).not.toContain("9/18 (Thu) 2 pm");
    expect(body.text).not.toContain("MP1 is due 9/14");
    expect(body.instructorNote).toBe(true);
    expect(body.nr).toBe(28);
  });

  it("does not read the follow-ups underneath it", () => {
    // A TA's answer says "the deadline"; both it and the student question above
    // it are `children[]`, which is student text this stage never reads. Either
    // reaching the grammar would put a classmate's guess in the list under an
    // instructor's name.
    const body = runningBody();
    const children = (RUNNING as { result: { children: { subject?: string }[] } }).result.children;
    expect(children.length).toBeGreaterThan(0);
    for (const child of children) {
      const subject = child.subject?.trim() ?? "";
      if (subject !== "") expect(body.text).not.toContain(subject.slice(0, 40));
    }
  });

  it("produces exactly one suggestion: HW1, Sunday 20 September, 11:59 pm", () => {
    const out = ingest([]);
    expect(out.suggestions).toHaveLength(1);
    const only = out.suggestions[0]!;
    expect(only.title).toBe("HW1");
    expect(only.at).toBe("2026-09-20T23:59:00-05:00");
    /*
     * **Stated, not assumed.** The post types the clock — "11:59 pm US Central
     * Time" — and until this wave the grammar dropped it: `PROSE_SEP` stopped
     * at the "(" of "(Sun)", so the reading fell back to §4.5's invented 23:59
     * with `timeAssumed: true`. The two instants are equal, which is what makes
     * it dangerous rather than visible: §5.3 ranks an assumed time below a
     * stated one, so a Canvas date would have outranked an instructor sentence
     * saying the same thing (worker rule 3). `announce.ts` now reads a
     * bracketed weekday between the date and the clock (docs/piazza-findings.md).
     */
    expect(only.timeAssumed).toBe(false);
    // The student's whole evidence, and it has to be quotable back at the post.
    expect(only.span).toBe("9/20 (Sun) 11:59 pm");
    expect(runningPayload().text).toContain(only.span);
    // The sentence, which is where the span sits — the next sentence ("This is
    // a hard deadline") is the instructor's emphasis and belongs to the post,
    // not to this reading.
    expect(only.context).toBe("HW1 is due 9/20 (Sun) 11:59 pm US Central Time.");
    expect(only.source).toBe("piazza");
    expect(only.courseCode).toBe("CS425");
    expect(out.seenPosts).toEqual({ [ID_28]: NOW_28 });
  });

  it("reads none of the other dates in it as a deadline", () => {
    /*
     * The post is a clarifications list: "9/5:", "9/10:", "9/13: Q1b." are
     * update markers an instructor writes in front of a note, not deadlines,
     * and each one becoming a row is the failure this fixture makes visible. So
     * the assertion is the whole set rather than the one we wanted — a grammar
     * that starts reading "9/13: Q1b." has to come here and say so.
     */
    const at = ingest([]).suggestions.map((suggestion) => suggestion.at);
    expect(at).toEqual(["2026-09-20T23:59:00-05:00"]);
    const mentions = extractDeadlineMentions(runningPayload().text, POSTED_28);
    expect(mentions.map((mention) => mention.span)).toEqual(["9/20 (Sun) 11:59 pm"]);
  });

  it("does not offer a second row for a deadline the list already shows", () => {
    // The commonest real case: Gradescope already lists HW1 at the instant the
    // post states. Nothing to move and nothing to say — a row repeating what is
    // already on screen is the noise that makes the Attention tab stop being read.
    const out = ingest([gradescopeHw1("2026-09-20T23:59:00-05:00")]);
    expect(out.suggestions).toEqual([]);
    expect(out.dueOverrides).toEqual({});
    expect(out.movedItems).toBe(0);
    expect(out.skipped.map((entry) => entry.reason).join(" ")).toContain("already due then");
  });

  it("does not re-offer a deadline the student has already added", () => {
    /*
     * The case a re-read creates. Accepting a suggestion turns it into a
     * `manual` item and *removes* the suggestion, so the next reading of this
     * post — which an edit now causes, weekly — finds a row it may not move (a
     * row the student typed is theirs) and an empty suggestion list, and would
     * offer them the deadline they just added. A row already due then has
     * nothing to be told.
     */
    const own = gradescopeHw1("2026-09-20T23:59:00-05:00");
    own.members = [{ ...own.members[0]!, source: "manual", sourceId: "own-hw1" }];
    const out = ingest([own]);
    expect(out.suggestions).toEqual([]);
    expect(out.dueOverrides).toEqual({});
    const reasons = out.skipped.map((entry) => entry.reason).join(" ");
    expect(reasons).toContain("your own row");
    expect(reasons).toContain("already due then");
  });

  it("still offers a student's own row the deadline when it disagrees", () => {
    // The other half, so the guard above cannot be "never offer a manual row".
    const own = gradescopeHw1("2026-09-18T23:59:00-05:00");
    own.members = [{ ...own.members[0]!, source: "manual", sourceId: "own-hw1" }];
    const out = ingest([own]);
    expect(out.suggestions.map((suggestion) => suggestion.at)).toEqual([
      "2026-09-20T23:59:00-05:00",
    ]);
    expect(out.dueOverrides).toEqual({});
  });

  it("offers a student's own row the same correction only once", () => {
    // The re-read's other half: the post is read again a week later, the row
    // still disagrees, and the offer from the first reading is still sitting in
    // the Attention tab. Two rows for one deadline is what makes that tab stop
    // being read.
    const own = gradescopeHw1("2026-09-18T23:59:00-05:00");
    own.members = [{ ...own.members[0]!, source: "manual", sourceId: "own-hw1" }];
    const first = ingest([own]);
    expect(first.suggestions).toHaveLength(1);
    const again = ingestPost(
      { items: [own], overrides: NO_OVERRIDES, suggestions: first.suggestions, seenPosts: {} },
      runningPayload(),
      "2026-09-16T09:00:00-05:00",
    );
    expect(again.suggestions).toEqual([]);
  });

  it("reads a bracketed weekday as the year cross-check it is", () => {
    /*
     * The second half of the amendment, and the half the Running Post cannot
     * exercise: "(Sun)" agrees with 9/20/2026, so dropping it from §3.2's
     * cross-check changes no answer there. A *contradicting* one must be
     * refused exactly as the prefix spelling is — 10/3/2026 is a Saturday, and
     * the only year where "Fri 10/3" holds is 2025, which is before the post.
     * Reading it anyway would put a year-old deadline in the list looking as
     * confident as any other.
     */
    const posted = "2026-09-14T09:00:00-05:00";
    const bracketed = extractDeadlineMentions("HW9 is due 10/3 (Fri) 11:59 pm.", posted);
    const prefixed = extractDeadlineMentions("HW9 is due Fri 10/3 11:59 pm.", posted);
    for (const [mention] of [bracketed, prefixed]) {
      expect(mention).toBeDefined();
      expect(mention).toMatchObject({ kind: "other", confidence: 0.55 });
      expect("at" in mention!).toBe(false);
      expect((mention as { reason?: string }).reason).toContain("contradict");
    }
    // And an agreeing one still reads, so this is a cross-check and not a ban.
    expect(
      extractDeadlineMentions("HW9 is due 10/3 (Sat) 11:59 pm.", posted)[0],
    ).toMatchObject({ at: "2026-10-03T23:59:00-05:00", timeAssumed: false });
  });

  it("moves a Gradescope HW1 that still says the 18th, without asking", () => {
    /*
     * Applied rather than offered, and `suggest.ts`'s ladder is why: the post
     * states a calendar date *and* a clock, which is the 0.95 rung, above
     * `AUTO_MOVE_CONFIDENCE`. A move is reversible, self-evidencing and carries
     * an undo; inventing a row is none of those.
     */
    const out = ingest([gradescopeHw1("2026-09-18T23:59:00-05:00")]);
    expect(out.suggestions).toEqual([]);
    expect(out.movedItems).toBe(1);
    const override = out.dueOverrides[memberKey("gradescope", "hw1-425")];
    expect(override).toMatchObject({
      at: "2026-09-20T23:59:00-05:00",
      from: "2026-09-18T23:59:00-05:00",
      postId: ID_28,
    });
    // Worker rule 3: absent, because the clock is the instructor's. A
    // `timeAssumed: true` here would derank a deadline the source stated.
    expect(override?.timeAssumed).toBeUndefined();
  });
});

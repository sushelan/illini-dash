/**
 * The announcement grammar over **real instructor posts**.
 *
 * `tests/announce.test.ts` runs over `fixtures/announcements/`, which I wrote.
 * Those fixtures pin the arithmetic and the refusals, and they are worth
 * keeping — but they were constructed from the spec, so the grammar they pin is
 * the grammar I imagined instructors write. Worker house rule 7: live data is a
 * source of truth the fixtures are not. Over the nine announcements Sushi
 * captured (`fixtures/campuswire/feed-ece408-sp26.html`) the grammar found a
 * subject for none of them, read #682's stated noon as an invented 23:59, and
 * returned nothing at all for seven of the nine.
 *
 * So this file runs the pipeline the browser runs — `parseFeed` →
 * `postsToSend` → `extractDeadlineMentions` — over the capture, with the real
 * text, Markdown asterisks and all. Every expected instant below is worked out
 * by hand from the post's own preview date, and the working is written down,
 * because an expectation copied from the implementation pins nothing.
 *
 * All of May 2026 is CDT, so every instant here carries `-05:00`. The weekdays
 * the posts state are the cross-check §3.2's year inference uses: 2026-05-01 is
 * a Friday, so 05-04 is a Monday, 05-05 a Tuesday, 05-11 a Monday, 05-15 a
 * Friday and 05-18 a Monday — every one agrees with the post that states it.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { parseFeed, postsToSend, type PostPayload } from "../src/core/campuswire.js";
import {
  describeEmpty,
  extractDeadlineMentions,
  resolveMentions,
  type EmptyReason,
  type Mention,
  type ReadMention,
} from "../src/core/announce.js";
import type { Item } from "../src/sources/types.js";

const HTML = readFileSync(
  new URL("../fixtures/campuswire/feed-ece408-sp26.html", import.meta.url),
  "utf8",
);

/** Exactly what the observer sends: title, newline, body, at the preview's noon. */
function feed(): Map<number, PostPayload> {
  const document = parseHTML(HTML).document as unknown as Document;
  const posts = parseFeed(document, {
    classCode: "G794D32E4",
    observedAt: "2026-09-18T12:00:00-05:00",
  });
  const byNumber = new Map<number, PostPayload>();
  for (const payload of postsToSend(posts).payloads) {
    byNumber.set(Number(payload.id.split(":")[2]), payload);
  }
  return byNumber;
}

const POSTS = feed();

function mentionsOf(number: number): Mention[] {
  const post = POSTS.get(number);
  if (post === undefined) throw new Error(`#${number} is not in the capture`);
  return extractDeadlineMentions(post.text, post.postedAt);
}

interface Expected {
  at: string;
  timeAssumed: boolean;
  kind: ReadMention["kind"];
  subject: string;
  confidence: ReadMention["confidence"];
  /** The literal words the deadline was read out of. */
  span: string;
}

/* -------------------------------------------------------------------------- */
/* The nine announcements                                                      */
/* -------------------------------------------------------------------------- */

const EXPECTED: Record<number, Expected[]> = {
  /*
   * #682, posted 05/17 at noon. "Regrade requests are due tomorrow, **5/18 at
   * 12:00 PM** (noon) CDT."
   *
   * "tomorrow" measured from the 17th is the 18th, and the same clause restates
   * that day with a clock. The clock wins: 23:59 would be this code's
   * invention and the post says noon, twelve hours earlier. The span covers
   * both halves and therefore runs across the opening `**` — that is the
   * grounding rule doing its job, not a defect: the span has to be findable in
   * the post verbatim, and the instructor's asterisk is in the middle of it.
   */
  682: [
    {
      at: "2026-05-18T12:00:00-05:00",
      timeAssumed: false,
      kind: "due",
      subject: "Regrade requests",
      confidence: 0.95,
      span: "tomorrow, **5/18 at 12:00 PM",
    },
  ],

  /*
   * #680, posted 05/16. "Regrade requests are available until Monday, 05/18 at
   * 12:00 PM CT (noon)."
   *
   * "available until" is a closing time, not a release — the one reading a
   * student can act on. The "CT (noon)" tail is ignored, the stated 12:00 is
   * not.
   */
  680: [
    {
      at: "2026-05-18T12:00:00-05:00",
      timeAssumed: false,
      kind: "due",
      subject: "Regrade requests",
      confidence: 0.95,
      span: "Monday, 05/18 at 12:00 PM",
    },
  ],

  /*
   * #675, posted 05/14. "please complete the **Subjective Evaluation Form**
   * linked below by Friday, May 15th, 11:59 PM Central Time."
   *
   * The deadline is split across the sentence — the verb at one end, the "by"
   * at the other — and the thing itself sits between them, which is where the
   * subject comes from. "Central Time" is a tail this grammar reads past.
   */
  675: [
    {
      at: "2026-05-15T23:59:00-05:00",
      timeAssumed: false,
      kind: "due",
      subject: "Subjective Evaluation Form",
      confidence: 0.95,
      span: "Friday, May 15th, 11:59 PM",
    },
  ],

  /*
   * #645, posted 05/04. "We'll extend the final deadline of CNN project to
   * 11:59pm today."
   *
   * 23:59 on the 4th — but **stated**, not assumed, and the difference is the
   * whole point of asserting it. §5.3 ranks a stated instant above an invented
   * one, and every other reading in this file that lands on 23:59 got there by
   * invention. `timeAssumed: false` is what a wrong implementation cannot fake
   * here (parser rule 10: the realistic value makes the two look identical).
   *
   * Confidence is 0.75 and not 0.95 because "today" is relative: the clock is
   * stated, the day is inferred from `postedAt`, which is itself Campuswire's
   * assumed noon. The ladder stays honest.
   */
  645: [
    {
      at: "2026-05-04T23:59:00-05:00",
      timeAssumed: false,
      kind: "extended",
      subject: "CNN project",
      confidence: 0.75,
      span: "11:59pm today",
    },
  ],

  /*
   * #567, posted 04/28. "CNN competition deadline has been extended to May 11."
   *
   * A bare date: 23:59 is this code's and says so. The subject comes from in
   * front of the verb — "CNN competition deadline has been extended" is about
   * the competition, not about the deadline, so the head noun is dropped.
   */
  567: [
    {
      at: "2026-05-11T23:59:00-05:00",
      timeAssumed: true,
      kind: "extended",
      subject: "CNN competition",
      confidence: 0.85,
      span: "May 11",
    },
  ],

  /*
   * #534, posted 04/24. "Milestone 3 for both the CNN and GPT projects is due
   * on **May 1**. With the 3-day extension, the final deadline is **May 4**."
   *
   * Two deadlines for one assignment, and both are wanted: the second sentence
   * names nothing at all, so its subject is carried from the first. Reading it
   * as a deadline for something called "final" — which is what `BADGE`'s bare
   * arm did — is the reading this file rules out.
   *
   * AMBIGUOUS, and the student's reading is taken: May 4 is the date to work
   * to. Both mentions are kept rather than only the later one, because
   * `resolveMentions` applies them in order and the last one wins, so the item
   * lands on May 4 while the post's own words stay traceable.
   */
  534: [
    {
      at: "2026-05-01T23:59:00-05:00",
      timeAssumed: true,
      kind: "due",
      subject: "Milestone 3",
      confidence: 0.85,
      span: "May 1",
    },
    {
      at: "2026-05-04T23:59:00-05:00",
      timeAssumed: true,
      kind: "due",
      subject: "Milestone 3",
      confidence: 0.85,
      span: "May 4",
    },
  ],

  /*
   * #597, posted 05/01. "Your exam is on **Tuesday, May 5th, from 7:00 PM to
   * 10:00 PM**."
   *
   * DECIDED: a sitting is an `event` at its **start**, not a `due` at its end.
   * A student has to be in the room at 7, and the row is about being there;
   * filing it as a deadline would put it beside things you submit and would let
   * §4.5's 23:59 invention near a time the post states exactly. The end of the
   * range is not read — nothing downstream would do anything with it today.
   *
   * The other two sittings in this post are deliberately **not** read: the
   * review session and the office hours are written the other way round ("This
   * Saturday … is the review session"), they are optional, and a grammar that
   * swept them in would put three rows on the calendar for one announcement.
   * If that turns out to be wanted, it is a new trigger, not a looser one.
   */
  597: [
    {
      at: "2026-05-05T19:00:00-05:00",
      timeAssumed: false,
      kind: "event",
      subject: "exam",
      confidence: 0.95,
      span: "Tuesday, May 5th, from 7:00 PM",
    },
  ],
};

/** The two that state no deadline, and what the grammar says about each. */
const EMPTY: Record<number, EmptyReason> = {
  // "Lab grades have been uploaded to Canvas." Nothing date-shaped anywhere.
  640: "no-date-words",
  // "No Office Hours This Friday (Final Week)" — a weekday, and no deadline
  // verb attached to it. Not a failure of this grammar, and it says which.
  638: "date-words-without-trigger",
};

describe("the grammar over the real ECE 408 feed", () => {
  it("has all nine announcements to read", () => {
    // Silent empty one level up: if the capture or the observer stopped
    // producing posts, every assertion below would pass vacuously.
    expect([...POSTS.keys()].sort((a, b) => a - b)).toEqual([
      534, 567, 597, 638, 640, 645, 675, 680, 682,
    ]);
  });

  for (const [number, expected] of Object.entries(EXPECTED)) {
    it(`reads #${number}`, () => {
      const actual = mentionsOf(Number(number));
      expect(actual).toHaveLength(expected.length);
      expected.forEach((want, i) => {
        const got = actual[i]!;
        expect(got).toMatchObject({
          at: want.at,
          timeAssumed: want.timeAssumed,
          kind: want.kind,
          subject: want.subject,
          confidence: want.confidence,
          span: want.span,
        });
        // The grounding rule, over text nobody wrote for this test.
        expect(POSTS.get(Number(number))!.text).toContain(got.span);
        expect(POSTS.get(Number(number))!.text).toContain(got.subject);
      });
    });
  }

  for (const [number, reason] of Object.entries(EMPTY)) {
    it(`finds no deadline in #${number}, and says why`, () => {
      const post = POSTS.get(Number(number))!;
      expect(extractDeadlineMentions(post.text, post.postedAt)).toEqual([]);
      expect(describeEmpty(post.text)).toBe(reason);
    });
  }

  it("names every post it read something from", () => {
    // The defect this whole file exists for: nine posts, a subject for none.
    for (const number of Object.keys(EXPECTED)) {
      for (const mention of mentionsOf(Number(number))) {
        expect(mention.subject, `#${number}`).not.toBe("");
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Against the student's own list (§5.2)                                       */
/* -------------------------------------------------------------------------- */

function item(id: string, title: string, dueAt?: string): Item {
  return {
    id,
    members: [
      {
        source: "gradescope",
        sourceId: id,
        title,
        url: "https://www.gradescope.com/courses/1/assignments/1",
        ...(dueAt ? { dueAt } : {}),
      },
    ],
    courseCode: "ECE408",
    courseLabel: "ECE 408",
    title,
    kind: "assignment",
    ...(dueAt ? { dueAt } : {}),
    status: "not_submitted",
    hidden: false,
    done: false,
    notified: {},
  } as unknown as Item;
}

describe("a phrase subject against an existing item", () => {
  /*
   * §5.2's normalisation is the *only* matcher — `resolveMentions` applies no
   * threshold of its own. `isSubsetOf` is the gate (every token of the subject
   * must appear in the item's title) and `jaccard` only ranks the candidates
   * that already passed it. So the question a phrase subject raises is not
   * "does it score high enough" but "is it a subset", and a longer phrase is
   * therefore *safer*, not riskier: three words all have to land.
   */
  it("matches 'CNN project' to an item titled 'Project CNN Milestone 3'", () => {
    const items = [item("m3", "Project CNN Milestone 3", "2026-05-01T23:59:00-05:00")];
    const [suggestion] = resolveMentions(mentionsOf(645), items, "ECE 408");
    expect(suggestion).toMatchObject({
      kind: "move",
      itemId: "m3",
      from: "2026-05-01T23:59:00-05:00",
      to: "2026-05-04T23:59:00-05:00",
    });
    // {cnn, project} ⊂ {project, cnn, milestone, 3}: a subset, Jaccard 0.5.
    // Nothing rejects it for the 0.5 — `jaccard` would only matter against a
    // second candidate that also passed the subset gate.
  });

  it("does not match a phrase whose words the title lacks", () => {
    const items = [item("m3", "Project CNN Milestone 3", "2026-05-01T23:59:00-05:00")];
    // "Subjective Evaluation Form" shares no token with the row, so the post
    // is news rather than a correction — the case the grammar exists for.
    expect(resolveMentions(mentionsOf(675), items, "ECE 408")[0]).toMatchObject({
      kind: "new",
      title: "Subjective Evaluation Form",
    });
  });

  it("leaves #597's sitting unmatched against 'Exam 2', and here is why", () => {
    /*
     * FINDING, not an assertion of something good. §5.2 fuses a numbered badge
     * into one token, so "Exam 2" normalises to {exam2} and the sentence's bare
     * "exam" to {exam} — not a subset, no match, and the sitting arrives as a
     * new row beside the student's existing Exam 2. The post's *title* says
     * "Exam 2 Resources", so the information is on the page; joining the two
     * would mean either a looser §5.2 or a title-aware subject, and both are
     * changes to files this worker does not own.
     */
    const items = [item("e2", "Exam 2", "2026-05-05T23:59:00-05:00")];
    expect(resolveMentions(mentionsOf(597), items, "ECE 408")[0]).toMatchObject({ kind: "new" });
  });
});

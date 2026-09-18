/**
 * The announcement grammar over the **real Piazza feed** — the second corpus.
 *
 * `tests/announce-real.test.ts` runs over nine captured Campuswire posts, and
 * every deadline in them is a submission ("regrade requests are due tomorrow",
 * "extend the final deadline of CNN project to"). That corpus is what the
 * grammar's trigger table was written from, and it is why the table had no verb
 * for *registering* for anything: `announce.ts` read zero deadlines out of all
 * 25 instructor notes on this CS 425 / ECE 428 page (docs/piazza-findings.md).
 *
 * So this file is the scorecard, asserted note by note: what each of the 25
 * real notes yields, and — where it yields nothing — *which* nothing, because
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
import { parseFeed, postsToSend, type PostPayload } from "../src/core/piazza.js";
import { describeEmpty, extractDeadlineMentions, type EmptyReason } from "../src/core/announce.js";

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
  147: "no-date-words",
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
  19: "no-date-words",
  16: "no-date-words",
  15: "no-date-words",
  11: "date-words-without-trigger",
  10: "no-date-words",
  9: "no-date-words",
  6: "no-date-words",
  5: "no-date-words",
  1: "no-date-words",
};

describe("the 25 real instructor notes", () => {
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

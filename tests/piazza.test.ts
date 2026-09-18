/**
 * `core/piazza.ts` — the class list and the announcement feed.
 *
 * Over `fixtures/piazza/class-page.html` and `fixtures/piazza/feed.json`, both
 * real captures (fixtures/piazza/README.md). Cases that edit the capture first
 * say so and say why: the capture contains no duplicate post number, no signed
 * out page and no unreadable term, so a parser that merged two posts or trusted
 * `status` instead of the term would pass every assertion made against it as it
 * stands (parser house rules 10 and 12).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  applyPiazzaResult,
  classesToPoll,
  classifyPiazzaResponse,
  classPageUrl,
  currentTermKey,
  describePiazza,
  bodyBatch,
  classifyClassPage,
  feedRequest,
  highestNr,
  htmlToText,
  parseClassPage,
  parseFeed,
  parsePostBody,
  piazzaNeedsRecheck,
  planPiazza,
  postBodyRequest,
  postsToSend,
  readerUpgrade,
  readerVersionOf,
  withPostBody,
  editedSinceSeen,
  MAX_BODIES_PER_SYNC,
  PIAZZA_MATCH,
  PIAZZA_READER_VERSION,
  type ObservedPost,
  type PiazzaClass,
  type PiazzaFacts,
} from "../src/core/piazza.js";
import { describeEmpty, extractDeadlineMentions } from "../src/core/announce.js";
import { ingestPost } from "../src/core/suggest.js";
import { ParseError, type Item, type Overrides, type RawItem } from "../src/sources/types.js";

const HTML = readFileSync(new URL("../fixtures/piazza/class-page.html", import.meta.url), "utf8");
const SIGNED_OUT = readFileSync(
  new URL("../fixtures/piazza/class-page-signed-out.html", import.meta.url),
  "utf8",
);
const POST = JSON.parse(
  readFileSync(new URL("../fixtures/piazza/post.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

/** A fresh deep copy of the `content.get` capture. */
function post(): Record<string, unknown> {
  return structuredClone(POST);
}

function result(json: Record<string, unknown>): Record<string, unknown> {
  return json["result"] as Record<string, unknown>;
}

function history0(json: Record<string, unknown>): Record<string, unknown> {
  return (result(json)["history"] as Record<string, unknown>[])[0]!;
}
const FEED = JSON.parse(
  readFileSync(new URL("../fixtures/piazza/feed.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

/** The fall-2026 class the feed was captured from. */
const NID = "mswcsieiaip5ju";
const NOW = new Date("2026-09-18T12:00:00-05:00");
const NOW_ISO = "2026-09-18T12:00:00-05:00";
const PAGE = {
  nid: NID,
  courseHint: "CS 425 / ECE 428: Distributed Systems",
  fetchedAt: NOW_ISO,
};

/** A fresh deep copy, so a test that edits the response cannot leak into another. */
function feed(): Record<string, unknown> {
  return structuredClone(FEED);
}

function posts(json: unknown = feed()): ObservedPost[] {
  return parseFeed(json, PAGE);
}

function entries(json: Record<string, unknown>): Record<string, unknown>[] {
  return (json["result"] as { feed: Record<string, unknown>[] }).feed;
}

/* -------------------------------------------------------------------------- */
/* The class page                                                             */
/* -------------------------------------------------------------------------- */

describe("parseClassPage over the real capture", () => {
  it("reads all four enrolments out of `const USER`", () => {
    const { networks, currentTerm } = parseClassPage(HTML, NOW);
    expect(networks).toHaveLength(4);
    expect(currentTerm).toBe("fall2026");
    expect(networks.map((entry) => entry.nid)).toEqual([
      "mtmnudq9p9k2pc",
      NID,
      "mkjhf5908xg4gy",
      "m5yccp4jza15ry",
    ]);
  });

  it("keeps every code of a cross-listed class (§5.1)", () => {
    // "CS 425 / ECE 428" is one class with two codes, and a student thinks of
    // it by whichever one their registration says.
    const cs425 = parseClassPage(HTML, NOW).networks.find((entry) => entry.nid === NID);
    expect(cs425?.courseCodes).toEqual(["CS425", "ECE428"]);
    expect(cs425?.courseRaw).toBe("CS 425 / ECE 428: Distributed Systems");
    // The comma form too: "CS 446, ECE 449".
    expect(
      parseClassPage(HTML, NOW).networks.find((entry) => entry.nid === "mkjhf5908xg4gy")
        ?.courseCodes,
    ).toEqual(["CS446", "ECE449"]);
  });

  it("decides the term by the term, not by `status`", () => {
    /*
     * The capture's whole reason for existing. The spring 2026 class is still
     * `status: "active"` in September — Piazza does not close a class when the
     * term ends — so a filter on `status` would poll last spring's feed every
     * half hour and offer its announcements to the grammar as current.
     */
    const byNid = new Map(parseClassPage(HTML, NOW).networks.map((entry) => [entry.nid, entry]));
    expect(byNid.get(NID)?.active).toBe(true);
    expect(byNid.get("mtmnudq9p9k2pc")?.active).toBe(true);
    expect(byNid.get("mkjhf5908xg4gy")).toMatchObject({ termKey: "spring2026", active: false });
    expect(byNid.get("m5yccp4jza15ry")).toMatchObject({ termKey: "spring2025", active: false });
    expect(parseClassPage(HTML, NOW).networks.filter((entry) => entry.active)).toHaveLength(2);
  });

  it("moves with the clock rather than with a year written down", () => {
    // Fall Aug–Dec, spring Jan–May, summer Jun–Jul (Sushi's boundaries).
    expect(currentTermKey(new Date("2026-08-01T12:00:00-05:00"))).toBe("fall2026");
    expect(currentTermKey(new Date("2026-12-31T12:00:00-06:00"))).toBe("fall2026");
    expect(currentTermKey(new Date("2027-01-02T12:00:00-06:00"))).toBe("spring2027");
    expect(currentTermKey(new Date("2027-05-31T12:00:00-05:00"))).toBe("spring2027");
    expect(currentTermKey(new Date("2027-06-01T12:00:00-05:00"))).toBe("summer2027");
    // …and in January the spring class the fixture calls stale is the current one.
    const jan = parseClassPage(HTML, new Date("2026-03-01T12:00:00-06:00"));
    expect(jan.currentTerm).toBe("spring2026");
    expect(jan.networks.filter((entry) => entry.active).map((entry) => entry.nid)).toEqual([
      "mkjhf5908xg4gy",
    ]);
  });

  it("keeps a class whose term is unreadable, and does not poll it", () => {
    // Deliberately unrealistic: the capture's four terms all read, so nothing
    // in it reaches this branch (house rule 10).
    const broken = HTML.replace('"term_key":"fall2026","start_date":"2026-08-24', '"term_key":"","start_date":"2026-08-24').replace(
      '"term":"Fall 2026","id":"mswcsieiaip5ju"',
      '"term":"whenever","id":"mswcsieiaip5ju"',
    );
    const found = parseClassPage(broken, NOW).networks.find((entry) => entry.nid === NID);
    expect(found?.active).toBe(false);
    expect(found?.termKey).toBeUndefined();
    expect(found?.extra?.unparsedTerm).toBe("whenever");
    // The other three are untouched: a bad value costs its own field (rule 1).
    expect(parseClassPage(broken, NOW).networks).toHaveLength(4);
  });

  it("throws when `const USER` is absent — the signed-out page, until one is captured", () => {
    expect(() => parseClassPage("<html><body>Piazza</body></html>", NOW)).toThrow(ParseError);
    expect(() => parseClassPage("<html><body>Piazza</body></html>", NOW)).toThrow(/const USER/);
  });

  it("is not fooled by the words a login page would use", () => {
    /*
     * House rule 12, in its dangerous direction. A marker like "Log In" or
     * "sign in" would match a *signed-in* class page — the capture's own header
     * carries a sign-out link — and every successful sync would report
     * needs_login while freezing the list at whatever it last held.
     */
    expect(parseClassPage(`${HTML}\n<a href="/login">Log In</a>`, NOW).networks).toHaveLength(4);
    // And a class actually called "Log Interpretation" is still a class.
    const named = HTML.replace(
      '"my_name":"CS 424: CS 424"',
      '"my_name":"GEOL 415: Log Interpretation"',
    );
    expect(parseClassPage(named, NOW).networks[0]?.courseRaw).toBe(
      "GEOL 415: Log Interpretation",
    );
  });

  it("throws when `networks` is missing, rather than reporting no classes", () => {
    // House rule 2: an empty enrolment would switch this source off silently
    // and for good — there would be nothing left to poll and nothing said.
    const gone = HTML.replace('"networks":[', '"netwrks":[');
    expect(() => parseClassPage(gone, NOW)).toThrow(/networks/);
  });

  it("throws when two enrolments share a class id", () => {
    // House rule 4 at the class level: `lastNr` is keyed by nid, so a collision
    // would make one class's read position apply to another class's feed.
    const dup = HTML.replace('"id":"mtmnudq9p9k2pc"', `"id":"${NID}"`);
    expect(() => parseClassPage(dup, NOW)).toThrow(/duplicate/);
  });
});

/* -------------------------------------------------------------------------- */
/* The feed                                                                   */
/* -------------------------------------------------------------------------- */

describe("parseFeed over the real response", () => {
  it("reads every entry, notes and questions alike", () => {
    const all = posts();
    expect(all).toHaveLength(31);
    expect(all.filter((post) => post.kind === "note")).toHaveLength(25);
    expect(all.filter((post) => post.kind === "question")).toHaveLength(6);
  });

  it("identifies a post by its class-local number", () => {
    const hw1 = posts().find((post) => post.nr === 28);
    expect(hw1).toMatchObject({
      id: `piazza:${NID}:28`,
      cid: "mtca1sh8pfk6ze",
      nid: NID,
      kind: "note",
      subject: "HW1 (All students) Released - And Clarifications (Running Post)",
      postedAt: "2026-08-28T01:32:51Z",
      courseHint: PAGE.courseHint,
    });
    // `log[0].t` verbatim: a real instant with a zone, never one this code made up.
    expect(hw1?.text.startsWith("HW1 (All students) Released")).toBe(true);
    expect(hw1?.snippet.startsWith("[Last Updated Sep 13.]")).toBe(true);
  });

  it("undoes the entities the JSON carries, because the span is quoted back", () => {
    // `MP1 &#34;Recommended&#34; solutions` reaches a suggestion's evidence
    // span, which is the one string that has to be quotable at the post.
    expect(posts().find((post) => post.nr === 179)?.subject).toBe(
      'MP1 "Recommended" solutions (On-campus MPs only)',
    );
    expect(posts().find((post) => post.nr === 16)?.subject).toContain("& 4cr MCS-Chicago");
  });

  it("sends the notes and holds the questions back", () => {
    const plan = postsToSend(posts());
    expect(plan.payloads).toHaveLength(25);
    expect(plan.payloads.every((payload) => payload.source === "piazza")).toBe(true);
    expect(plan.skipped).toHaveLength(6);
    expect(plan.skipped.every((entry) => entry.reason.includes("not an announcement"))).toBe(true);
    // The flag exists for the day the Attention tab has been lived with.
    expect(postsToSend(posts(), { includeQuestions: true }).payloads).toHaveLength(31);
  });

  it("skips what it has already read, by number", () => {
    const plan = postsToSend(posts(), { sinceNr: 100 });
    expect(plan.payloads.map((payload) => payload.id)).toEqual([
      `piazza:${NID}:179`,
      `piazza:${NID}:168`,
      `piazza:${NID}:164`,
      `piazza:${NID}:147`,
      `piazza:${NID}:145`,
      `piazza:${NID}:125`,
      `piazza:${NID}:105`,
    ]);
    expect(highestNr(posts())).toBe(184);
    // Everything at or below the mark is refused by name, not silently gone.
    expect(plan.skipped.some((entry) => entry.reason.includes("already read"))).toBe(true);
  });

  it("returns [] for a class with an empty feed, which is a real thing", () => {
    // The container is the JSON shape and it was checked above; a class created
    // before its term starts genuinely answers with no posts.
    const empty = feed();
    (empty["result"] as { feed: unknown[] }).feed = [];
    expect(parseFeed(empty, PAGE)).toEqual([]);
  });

  it("throws when `result` is missing", () => {
    expect(() => parseFeed({ feed: [] }, PAGE)).toThrow(/result/);
    expect(() => parseFeed("<html>", PAGE)).toThrow(ParseError);
  });

  it("throws naming the error the server stated", () => {
    expect(() => parseFeed({ error: "bad nid" }, PAGE)).toThrow(/bad nid/);
  });

  it("does not read the healthy response's `error: null` as an error", () => {
    // The capture carries `"error": null` on a perfectly good response, so
    // `"error" in json` would have failed every successful sync (house rule 5).
    expect(FEED["error"]).toBeNull();
    expect(posts().length).toBeGreaterThan(0);
  });

  it("throws when two entries share a post number", () => {
    // Deliberately unrealistic: the capture has 31 distinct numbers. `seenPosts`
    // and `lastNr` are both keyed by this, so a collision would silently drop an
    // announcement and mark it read (house rule 4).
    const dup = feed();
    entries(dup)[1] = { ...entries(dup)[1]!, nr: entries(dup)[0]!["nr"] };
    expect(() => parseFeed(dup, PAGE)).toThrow(/duplicate/);
  });

  it("throws when the number or the type is gone, and not when a date is unreadable", () => {
    const noNr = feed();
    delete entries(noNr)[0]!["nr"];
    expect(() => parseFeed(noNr, PAGE)).toThrow(/post number/);

    const noType = feed();
    delete entries(noType)[0]!["type"];
    expect(() => parseFeed(noType, PAGE)).toThrow(/type/);

    const noLog = feed();
    delete entries(noLog)[0]!["log"];
    expect(() => parseFeed(noLog, PAGE)).toThrow(/log/);

    /*
     * House rule 1's other half: the hook is there and the *value* is not an
     * instant, so it costs the field and not the other 30 posts — and
     * `postsToSend` then refuses to send that one, because every relative
     * phrase in the post would otherwise resolve against a date nobody stated.
     */
    const badDate = feed();
    entries(badDate)[19] = {
      ...entries(badDate)[19]!,
      log: [{ t: "8/28/2026", n: "create" }],
    };
    const parsed = parseFeed(badDate, PAGE);
    expect(parsed).toHaveLength(31);
    const broken = parsed[19]!;
    expect(broken.postedAt).toBeUndefined();
    expect(broken.extra.unparsedPostedAt).toBe("8/28/2026");
    const plan = postsToSend(parsed);
    expect(plan.payloads.some((payload) => payload.id === broken.id)).toBe(false);
    expect(plan.skipped.some((entry) => entry.reason.includes("unreadable"))).toBe(true);
  });

  it("refuses a feed with no class id, because ids would collide across classes", () => {
    expect(() => parseFeed(feed(), { ...PAGE, nid: "" })).toThrow(/class id/);
  });
});

/* -------------------------------------------------------------------------- */
/* Login classification                                                       */
/* -------------------------------------------------------------------------- */

describe("classifyPiazzaResponse", () => {
  it("reads the status before anything else (house rule 8)", () => {
    // An expired session on the API does not redirect and does not return HTML:
    // it answers at the unchanged URL. Without the status this is "signed in",
    // and the row then says "the page changed" to someone who needs to sign in.
    for (const status of [401, 403]) {
      expect(
        classifyPiazzaResponse({
          status,
          finalUrl: "https://piazza.com/logic/api?method=network.get_my_feed",
          body: { result: { feed: [] } },
        }),
      ).toBe("needs_login");
    }
  });

  it("reads the server's own error string, and only that", () => {
    expect(classifyPiazzaResponse({ status: 200, body: { error: "login required" } })).toBe(
      "needs_login",
    );
    expect(classifyPiazzaResponse({ status: 200, body: { error: "not authenticated" } })).toBe(
      "needs_login",
    );
    // A different failure is a failure, not a login.
    expect(classifyPiazzaResponse({ status: 200, body: { error: "bad nid" } })).toBe("ok");
    // And the page's prose is never read: an assignment called Log
    // Interpretation must not sign the student out (house rule 12).
    expect(
      classifyPiazzaResponse({
        status: 200,
        finalUrl: `https://piazza.com/class/${NID}`,
        body: { result: { feed: [{ subject: "Log Interpretation — sign in sheet" }] } },
      }),
    ).toBe("ok");
  });

  it("reads a landing on the login path, anchored on the path", () => {
    expect(classifyPiazzaResponse({ status: 200, finalUrl: "https://piazza.com/login" })).toBe(
      "needs_login",
    );
    expect(
      classifyPiazzaResponse({ status: 200, finalUrl: `https://piazza.com/class/${NID}` }),
    ).toBe("ok");
    // A class whose id merely begins with the word is not a login page.
    expect(
      classifyPiazzaResponse({ status: 200, finalUrl: "https://piazza.com/class/loginabc" }),
    ).toBe("ok");
  });

  it("separates a failure from a login, because §6 treats them differently", () => {
    expect(classifyPiazzaResponse({ status: 500 })).toBe("http_error");
    expect(classifyPiazzaResponse({ status: 200 })).toBe("ok");
  });
});

/* -------------------------------------------------------------------------- */
/* The plan and the state                                                     */
/* -------------------------------------------------------------------------- */

const CS425: PiazzaClass = {
  nid: NID,
  courseRaw: "CS 425 / ECE 428: Distributed Systems",
  courseCodes: ["CS425", "ECE428"],
  termKey: "fall2026",
  active: true,
};
const OLD: PiazzaClass = { ...CS425, nid: "old", termKey: "spring2025", active: false };

describe("planPiazza", () => {
  it("off means no request and no state", () => {
    const plan = planPiazza({ enabled: false }, { granted: true, now: NOW });
    expect(plan).toEqual({ fetch: false, refreshClasses: false, poll: [], reason: "off" });
  });

  it("on without the permission is a state, not a fetch", () => {
    // Chrome can revoke it from its own UI without telling this extension, and
    // a registration-less silence would look exactly like "it works".
    const plan = planPiazza({ enabled: true, classes: [CS425] }, { granted: false, now: NOW });
    expect(plan.fetch).toBe(false);
    expect(plan.reason).toContain(PIAZZA_MATCH);
    expect(plan.record?.state).toBe("error");
    expect(plan.record?.lastError).toContain("Settings");
  });

  it("asks for the class list when there is none, or when it is a day old", () => {
    expect(planPiazza({ enabled: true }, { granted: true, now: NOW }).refreshClasses).toBe(true);
    const fresh = planPiazza(
      { enabled: true, classes: [CS425], classesFetchedAt: "2026-09-18T09:00:00-05:00" },
      { granted: true, now: NOW },
    );
    expect(fresh.refreshClasses).toBe(false);
    expect(fresh.poll).toEqual([{ nid: NID, courseHint: CS425.courseRaw }]);
    const stale = planPiazza(
      { enabled: true, classes: [CS425], classesFetchedAt: "2026-09-16T09:00:00-05:00" },
      { granted: true, now: NOW },
    );
    expect(stale.refreshClasses).toBe(true);
  });

  it("polls this term's classes only, from where it left off", () => {
    expect(classesToPoll([CS425, OLD], { [NID]: 184 })).toEqual([
      { nid: NID, courseHint: CS425.courseRaw, sinceNr: 184 },
    ]);
  });

  it("rests after a failure, and tries anyway when the student asks", () => {
    const resting: PiazzaFacts = {
      enabled: true,
      classes: [CS425],
      classesFetchedAt: NOW_ISO,
      nextAttemptAt: "2026-09-18T12:30:00-05:00",
    };
    expect(planPiazza(resting, { granted: true, now: NOW }).fetch).toBe(false);
    expect(planPiazza(resting, { granted: true, now: NOW }).reason).toContain("resting");
    expect(planPiazza(resting, { granted: true, now: NOW, trigger: "manual" }).fetch).toBe(true);
    // And the rest ends when it ends.
    expect(
      planPiazza(resting, { granted: true, now: new Date("2026-09-18T12:31:00-05:00") }).fetch,
    ).toBe(true);
  });
});

describe("applyPiazzaResult and the row it feeds", () => {
  it("never claims a reading it did not make", () => {
    // Worker rule 2: a switch the student flipped has read nothing.
    expect(describePiazza({ enabled: true })).toBe("On · nothing read yet");
    expect(describePiazza({ enabled: false })).toBe("Off");
    expect(describePiazza({ enabled: true, state: "ok" })).toBe("On · nothing read yet");
  });

  it("stamps an attempt on every branch, and a reading only on a success", () => {
    const ok = applyPiazzaResult({ enabled: true }, { kind: "ok", newPosts: 3 }, NOW_ISO);
    expect(ok).toMatchObject({
      state: "ok",
      lastAttemptAt: NOW_ISO,
      lastObservedAt: NOW_ISO,
      postsSeen: 3,
      failures: 0,
    });
    // A successful poll that found nothing new is an attempt, not a reading.
    const quiet = applyPiazzaResult(ok, { kind: "ok", newPosts: 0 }, "2026-09-18T13:00:00-05:00");
    expect(quiet.lastAttemptAt).toBe("2026-09-18T13:00:00-05:00");
    expect(quiet.lastObservedAt).toBe(NOW_ISO);
    expect(quiet.postsSeen).toBe(3);
  });

  it("arms §6's ladder on a failure and clears it on the next success", () => {
    const once = applyPiazzaResult({ enabled: true }, { kind: "error", message: "boom" }, NOW_ISO);
    expect(once).toMatchObject({ state: "error", lastError: "boom", failures: 1 });
    expect(Date.parse(once.nextAttemptAt!)).toBeGreaterThan(Date.parse(NOW_ISO));
    const twice = applyPiazzaResult(once, { kind: "error", message: "boom" }, NOW_ISO);
    expect(Date.parse(twice.nextAttemptAt!)).toBeGreaterThan(Date.parse(once.nextAttemptAt!));
    const better = applyPiazzaResult(twice, { kind: "ok", newPosts: 1 }, NOW_ISO);
    expect(better.nextAttemptAt).toBeUndefined();
    expect(better.lastError).toBeUndefined();
    expect(better.failures).toBe(0);
  });

  it("does not back off a login, because the fix is a tab away", () => {
    const out = applyPiazzaResult({ enabled: true }, { kind: "needs_login" }, NOW_ISO);
    expect(out).toMatchObject({ state: "needs_login", failures: 0 });
    expect(out.nextAttemptAt).toBeUndefined();
    expect(describePiazza(out)).toBe("Sign in needed");
    expect(describePiazza({ enabled: true, state: "error", lastError: "boom" })).toBe(
      "Couldn't be read",
    );
  });

  it("re-checks a login when a Piazza page finishes loading, and not otherwise", () => {
    const waiting: PiazzaFacts = {
      enabled: true,
      state: "needs_login",
      lastAttemptAt: NOW_ISO,
    };
    expect(piazzaNeedsRecheck(waiting, Date.parse("2026-09-18T12:05:00-05:00"))).toBe(true);
    // A page that finished *before* the attempt proves nothing new.
    expect(piazzaNeedsRecheck(waiting, Date.parse("2026-09-18T11:00:00-05:00"))).toBe(false);
    // And a healthy source is not re-fetched on every page view.
    expect(
      piazzaNeedsRecheck({ ...waiting, state: "ok" }, Date.parse("2026-09-18T12:05:00-05:00")),
    ).toBe(false);
    expect(piazzaNeedsRecheck(waiting, undefined)).toBe(false);
  });

  it("says the time, the count, and what the posts produced", () => {
    /*
     * "On · last read 10:32 · 25 posts" reads as working while producing
     * nothing, which is exactly what this source did for a day: a number that
     * names an activity and implies a result. Both halves come from an attempt
     * (worker rule 2) — `postsSeen` from posts that were ingested,
     * `deadlinesFound` from what they produced.
     */
    const read = {
      enabled: true,
      state: "ok",
      lastObservedAt: "2026-09-18T10:32:00-05:00",
      postsSeen: 25,
    } as const;
    expect(describePiazza({ ...read, deadlinesFound: 1 }, NOW)).toMatch(
      /^On · last read .* · 25 posts, 1 deadline found$/,
    );
    expect(describePiazza({ ...read, deadlinesFound: 3 }, NOW)).toMatch(
      /^On · last read .* · 25 posts, 3 deadlines found$/,
    );
    expect(describePiazza({ ...read, deadlinesFound: 0 }, NOW)).toMatch(
      /^On · last read .* · 25 posts, none with a deadline$/,
    );
  });

  it("says nothing about deadlines a run never counted", () => {
    // A store written before the count existed. "none with a deadline" would be
    // a claim about an attempt that never recorded one.
    const row = describePiazza(
      { enabled: true, state: "ok", lastObservedAt: "2026-09-18T10:32:00-05:00", postsSeen: 3 },
      NOW,
    );
    expect(row).toMatch(/^On · last read .* · 3 posts$/);
  });

  it("counts deadlines across runs, and only from a run that ingested", () => {
    const first = applyPiazzaResult(
      { enabled: true },
      { kind: "ok", newPosts: 2, deadlines: 1 },
      NOW_ISO,
    );
    expect(first.deadlinesFound).toBe(1);
    // A later sync that read no new posts passes no count, and must not reset
    // the row to "none with a deadline".
    const second = applyPiazzaResult(first, { kind: "ok", newPosts: 0 }, NOW_ISO);
    expect(second.deadlinesFound).toBe(1);
    // And a later sync that found more adds to it, rather than replacing it:
    // the row's count is "since this source was switched on", like `postsSeen`.
    expect(applyPiazzaResult(second, { kind: "ok", newPosts: 4, deadlines: 2 }, NOW_ISO)
      .deadlinesFound).toBe(3);
    // A sync that read posts and found nothing does record the zero.
    const third = applyPiazzaResult(
      { enabled: true },
      { kind: "ok", newPosts: 25, deadlines: 0 },
      NOW_ISO,
    );
    expect(third.deadlinesFound).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Requests, and the stage that is not built                                  */
/* -------------------------------------------------------------------------- */

describe("the requests this module describes", () => {
  it("builds the feed request the live client sends", () => {
    const request = feedRequest(NID);
    expect(request.url).toBe("https://piazza.com/logic/api?method=network.get_my_feed");
    expect(JSON.parse(request.body)).toEqual({
      method: "network.get_my_feed",
      params: { nid: NID, limit: 150, offset: 0 },
    });
    expect(classPageUrl(NID)).toBe(`https://piazza.com/class/${NID}`);
    expect(classPageUrl()).toBe("https://piazza.com/class");
  });

  it("asks content.get for one post by its cid", () => {
    expect(JSON.parse(postBodyRequest("mtca1sh8pfk6ze", NID).body)).toEqual({
      method: "content.get",
      params: { cid: "mtca1sh8pfk6ze", nid: NID },
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Post bodies                                                                */
/* -------------------------------------------------------------------------- */

/** The cid and nr of the captured `content.get` response (fixtures README). */
const CID = "mu6b814nxeb4ko";
const CTX = { nid: NID, cid: CID };

describe("htmlToText", () => {
  /*
   * Tested directly rather than only through the capture, because every way of
   * getting this wrong is invisible against well-formed markup: the capture has
   * no `<script>`, no encoded markup and no tag-less line that would notice a
   * missing break. Deliberately unrealistic inputs, house rule 10.
   */
  it("turns block tags into line breaks and inline tags into nothing", () => {
    // A paragraph is a blank line, which is one of `announce.ts`'s sentence
    // boundaries; a `<br>` is a single break, which is the other.
    expect(htmlToText("<p>HW2 is out.</p><p>It is <strong>due</strong> Friday.</p>")).toBe(
      "HW2 is out.\n\nIt is due Friday.",
    );
    expect(htmlToText("line one<br>line two")).toBe("line one\nline two");
  });

  it("keeps a sentence boundary the grammar depends on", () => {
    // The point of the break: with the tags merely deleted the two sentences
    // would read "It is due.Friday we review", and a trigger in one would be
    // free to bind the date in the other.
    expect(htmlToText("<div>It is due.</div><div>Friday we review.</div>")).toBe(
      "It is due.\n\nFriday we review.",
    );
  });

  it("decodes entities last, so quoted markup is not eaten as a tag", () => {
    expect(htmlToText("<p>write &lt;div&gt; here</p>")).toBe("write <div> here");
    expect(htmlToText("<p>MP1 &#34;Recommended&#34; &#43; more&nbsp;now</p>")).toBe(
      'MP1 "Recommended" + more now',
    );
  });

  it("drops scripts and styles with their contents", () => {
    expect(htmlToText("<p>a</p><script>var due = '9/25';</script><p>b</p>")).toBe("a\n\nb");
  });
});

describe("parsePostBody over the real content.get capture", () => {
  it("reads the newest version, its subject and the text the grammar sees", () => {
    const body = parsePostBody(post(), CTX);
    expect(body.nr).toBe(179);
    expect(body.cid).toBe(CID);
    expect(body.subject).toBe('MP1 "Recommended" solutions (On-campus MPs only)');
    // `history` is newest first and holds five versions; this is version 0's
    // own timestamp, not the post's `created` (2026-09-18T01:58:47Z).
    expect(body.versionAt).toBe("2026-09-18T03:12:18Z");
    expect(body.instructorNote).toBe(true);
    expect(body.text.startsWith(`${body.subject}\n`)).toBe(true);
    expect(body.bodyText).toContain("Dear 4cr On-campus + Chicago students,");
    // Past character 120 — the whole reason this request exists.
    expect(body.bodyText).toContain("START MP2 NOW!");
    expect(body.bodyText).not.toContain("<");
    expect(body.bodyText).not.toContain("&#");
  });

  it("states no deadline, and says which kind of nothing that is", () => {
    // The capture is a real instructor note announcing solutions, so the honest
    // answer is none — and `describeEmpty` tells it from a post this grammar
    // failed on (parser rule 2).
    const body = parsePostBody(post(), CTX);
    expect(extractDeadlineMentions(body.text, "2026-09-18T01:58:47Z")).toEqual([]);
    expect(describeEmpty(body.text)).toBe("trigger-without-date-words");
  });

  it("reads a deadline out of a deliberately edited copy of the same post", () => {
    /*
     * Deliberately edited (house rule 10). The capture states no deadline, so
     * it cannot tell "the body stage works" from "the body stage is dead" — and
     * the sentence below sits far past the 120th character, where no snippet
     * could ever have reached it.
     */
    const edited = post();
    const version = history0(edited);
    version["content"] = `${String(version["content"])}<p>Also: MP2 is due 10/3 at 11:59pm.</p>`;
    const body = parsePostBody(edited, CTX);
    expect(body.bodyText.indexOf("MP2 is due")).toBeGreaterThan(120);
    const mentions = extractDeadlineMentions(body.text, "2026-09-18T01:58:47Z");
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toMatchObject({
      at: "2026-10-03T23:59:00-05:00",
      timeAssumed: false,
      subject: "MP2",
      kind: "due",
    });
    // Grounded in the text that was handed to the grammar, not in the HTML.
    expect(body.text).toContain(mentions[0]!.span);
  });

  it("marks a staff post from either marker, and a student post from neither", () => {
    const tagged = post();
    result(tagged)["config"] = {};
    expect(parsePostBody(tagged, CTX).instructorNote).toBe(true);

    const announced = post();
    result(announced)["tags"] = ["pin"];
    expect(parsePostBody(announced, CTX).instructorNote).toBe(true);

    const student = post();
    result(student)["tags"] = ["pin", "student"];
    result(student)["config"] = { is_announcement: 0 };
    expect(parsePostBody(student, CTX).instructorNote).toBe(false);
  });

  it("matches the tag exactly, never as a substring", () => {
    // House rule 6: `instructor-notes` is not `instructor-note`.
    const near = post();
    result(near)["tags"] = ["instructor-notes"];
    result(near)["config"] = {};
    expect(parsePostBody(near, CTX).instructorNote).toBe(false);
  });

  it("throws, naming the field, when history[0] is unreadable", () => {
    const cases: [string, (json: Record<string, unknown>) => void, RegExp][] = [
      ["no history", (json) => { delete result(json)["history"]; }, /history\[0\]/],
      ["empty history", (json) => { result(json)["history"] = []; }, /history\[0\]/],
      ["no content", (json) => { delete history0(json)["content"]; }, /history\[0\]\.content/],
      ["empty content", (json) => { history0(json)["content"] = "   "; }, /history\[0\]\.content/],
      ["no subject", (json) => { delete history0(json)["subject"]; }, /history\[0\]\.subject/],
      [
        "naive created",
        (json) => { history0(json)["created"] = "2026-09-18 03:12:18"; },
        /history\[0\]\.created/,
      ],
    ];
    for (const [name, edit, message] of cases) {
      const json = post();
      edit(json);
      expect(() => parsePostBody(json, CTX), name).toThrow(message);
    }
  });

  it("refuses an error body, and a body for another post", () => {
    const failed = post();
    failed["error"] = "content not found";
    expect(() => parsePostBody(failed, CTX)).toThrow(/content not found/);

    // `error: null` is what a healthy response carries, so its presence proves
    // nothing (house rule 5).
    expect(POST["error"]).toBeNull();
    expect(() => parsePostBody(post(), CTX)).not.toThrow();

    // A response for a different post would be ingested under this post's id
    // and quoted back at the student as words it does not contain.
    expect(() => parsePostBody(post(), { nid: NID, cid: "mother1postid" })).toThrow(
      /mu6b814nxeb4ko/,
    );
  });

  it("replaces the snippet without moving the id or the posted instant", () => {
    const feedPost = posts().find((entry) => entry.nr === 179)!;
    const merged = withPostBody(feedPost, parsePostBody(post(), CTX));
    expect(merged.id).toBe(feedPost.id);
    // `history[0].created` is when the latest *edit* was made; every relative
    // phrase in the post resolves against when it was written.
    expect(merged.postedAt).toBe(feedPost.postedAt);
    expect(merged.bodyRead).toBe(true);
    expect(merged.text).toContain("START MP2 NOW!");
    expect(merged.text.length).toBeGreaterThan(feedPost.text.length);
  });

  it("refuses a body that belongs to another post number", () => {
    const feedPost = posts().find((entry) => entry.nr === 42)!;
    expect(() => withPostBody(feedPost, parsePostBody(post(), CTX))).toThrow(/42/);
  });
});

describe("postsToSend carries the posts, not only the payloads", () => {
  it("hands back every sent post, in the payloads' order", () => {
    // The body stage reads `cid` and `nr` off these; an empty `sent` would
    // fetch no bodies at all and leave every post at its 120-character
    // snippet, with the log still saying the feed was read.
    const plan = postsToSend(posts());
    expect(plan.sent.map((post) => post.id)).toEqual(plan.payloads.map((payload) => payload.id));
    expect(plan.sent).toHaveLength(25);
    expect(plan.sent.every((post) => post.cid !== "")).toBe(true);
  });

  it("leaves out everything it skipped", () => {
    const plan = postsToSend(posts(), { sinceNr: 100 });
    expect(plan.sent.every((post) => post.nr > 100)).toBe(true);
    expect(plan.sent.every((post) => post.kind === "note")).toBe(true);
  });
});

describe("bodyBatch", () => {
  const stub = (nr: number): ObservedPost => ({ nr, id: `piazza:${NID}:${nr}` }) as ObservedPost;

  it("takes the oldest first and stops the mark at the batch", () => {
    // The deferred posts are read next sync, so `lastNr` may not run ahead of
    // them: a post marked read at its snippet never gets its body.
    const batch = bodyBatch([stub(5), stub(9), stub(7)], [stub(5), stub(7), stub(9), stub(11)], 2);
    expect(batch.batch.map((entry) => entry.nr)).toEqual([5, 7]);
    expect(batch.deferred).toBe(1);
    expect(batch.lastNr).toBe(7);
  });

  it("marks the whole feed read when nothing was deferred", () => {
    // Including the questions above the last note: they were decided this sync.
    const batch = bodyBatch([stub(5), stub(7)], [stub(5), stub(7), stub(11)], 25);
    expect(batch.deferred).toBe(0);
    expect(batch.lastNr).toBe(11);
  });

  it("defaults to 25 bodies per sync per class", () => {
    expect(MAX_BODIES_PER_SYNC).toBe(25);
    const many = Array.from({ length: 30 }, (_, i) => stub(i + 1));
    const batch = bodyBatch(many, many);
    expect(batch.batch).toHaveLength(25);
    expect(batch.deferred).toBe(5);
    expect(batch.lastNr).toBe(25);
  });
});

/* -------------------------------------------------------------------------- */
/* Signed in, signed out, or changed                                          */
/* -------------------------------------------------------------------------- */

describe("classifyClassPage", () => {
  it("calls the real signed-out capture signed out", () => {
    expect(classifyClassPage(SIGNED_OUT)).toBe("signed_out");
  });

  it("calls the real signed-in capture signed in", () => {
    expect(classifyClassPage(HTML)).toBe("signed_in");
  });

  it("is not fooled by a class called Log In, or by a link to /login", () => {
    /*
     * House rule 12, in its most dangerous form: a marker that also matches a
     * signed-in page turns every successful sync into "Sign in needed" and
     * freezes the list, silently. Neither capture can show that, so this page is
     * deliberately adversarial — a real signed-in page carrying the words a
     * loose marker would match.
     */
    const adversarial =
      HTML.replace('"CS 424: CS 424"', '"CS 424: Log Interpretation"') +
      '<a href="/login">Log In</a><div class="qa_homepage_container">Log in to proceed</div>' +
      // And the marker itself, on a page that is signed in: a login form in a
      // hidden modal is markup a signed-in shell could ship any day, and a
      // marker that fired on it would freeze this source on "Sign in needed"
      // for every student at once. `const USER` decides first, always.
      '<form id="login-form" method="post" action="https://piazza.com/class"></form>';
    expect(adversarial).toContain("Log In");
    expect(classifyClassPage(adversarial)).toBe("signed_in");
  });

  it("calls a page with neither marker a redesign, not a sign-in", () => {
    // "No `const USER`" used to mean needs_login on its own. With a positive
    // marker, a page that has neither is what it says it is.
    expect(classifyClassPage("<html><body><h1>Piazza</h1></body></html>")).toBe("changed");
    expect(classifyClassPage(SIGNED_OUT.replace('id="login-form"', 'id="search-form"'))).toBe(
      "changed",
    );
  });

  it("wants the form's own action, not any form on the page", () => {
    expect(
      classifyClassPage(SIGNED_OUT.replace('action="https://piazza.com/class"', 'action="/search"')),
    ).toBe("changed");
  });
});

/* -------------------------------------------------------------------------- */
/* End to end: the feed through the pipeline that already exists              */
/* -------------------------------------------------------------------------- */

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

function ingestAll(json: unknown = feed()): {
  suggestions: { title: string; at: string; span: string }[];
  seen: Record<string, string>;
} {
  const plan = postsToSend(posts(json));
  const suggestions: { title: string; at: string; span: string }[] = [];
  const seen: Record<string, string> = {};
  for (const payload of plan.payloads) {
    const out = ingestPost(
      { items: [], overrides: NO_OVERRIDES, suggestions: [], seenPosts: seen },
      payload,
      NOW_ISO,
    );
    Object.assign(seen, out.seenPosts);
    for (const suggestion of out.suggestions) {
      suggestions.push({
        title: suggestion.title,
        at: suggestion.at,
        span: suggestion.span,
      });
    }
  }
  return { suggestions, seen };
}

describe("the real feed through ingestPost", () => {
  it("reads all 25 notes, and finds the one deadline their snippets state", () => {
    /*
     * The scorecard, recorded rather than assumed away
     * (docs/piazza-findings.md). It was **zero** until 2026-09-18, when
     * `announce.ts` learned that "<verb> … by <date>" is a deadline: post 42
     * says "Reminder: Register Your MP Group by EOD Today 8/31!" in its subject
     * and again in its snippet, and the grammar declined both because "by" was
     * not a due-word.
     *
     * One suggestion, not two: the snippet restates the subject's deadline, and
     * `alreadySuggested` collapses one deadline stated twice into one row.
     *
     * Every other note's deadlines are still inside the post, past the 120th
     * character `content_snipet` stops at — which is what `parsePostBody` and
     * the body stage in `background.ts` are for, and why this number is a
     * floor rather than a finding about the class.
     */
    const { suggestions, seen } = ingestAll();
    expect(Object.keys(seen)).toHaveLength(25);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toEqual({
      title: "MP Group",
      // Posted 2026-08-31T15:33:29Z — 10:33 in Chicago — so "Today" is the
      // 31st, and EOD is 23:59 on it. `timeAssumed` stays true: "end of day"
      // has been this grammar's own 23:59 since `eod-friday.txt`, and "EOD"
      // follows that convention rather than inventing a second one.
      at: "2026-08-31T23:59:00-05:00",
      span: "EOD Today",
    });
  });

  it("produces another when a second snippet states one", () => {
    /*
     * Deliberately unrealistic (house rule 10): the wiring — subject, snippet,
     * `postedAt` as the anchor, the id `seenPosts` remembers — is either
     * correct or silently dead, and the capture above cannot tell the two
     * apart because it produces nothing either way.
     */
    const stated = feed();
    entries(stated)[13] = {
      ...entries(stated)[13]!,
      subject: "HW2 released",
      content_snipet: "HW2 is out. It is due 9/25 at 11:59pm. Start early.",
    };
    const { suggestions } = ingestAll(stated);
    expect(suggestions).toHaveLength(2);
    const hw2 = suggestions.find((entry) => entry.title === "HW2 released")!;
    expect(hw2).toMatchObject({ at: "2026-09-25T23:59:00-05:00" });
    expect(hw2.span).toContain("9/25");
  });

  it("reads each post once, whatever the poll returns next time", () => {
    const { seen } = ingestAll();
    const again = ingestPost(
      { items: [], overrides: NO_OVERRIDES, suggestions: [], seenPosts: seen },
      postsToSend(posts())!.payloads[0]!,
      "2026-09-18T13:00:00-05:00",
    );
    expect(again.suggestions).toEqual([]);
    expect(again.skipped[0]?.reason).toContain("already read");
  });
});

/* -------------------------------------------------------------------------- */
/* The reader version: an install that already read every post at its snippet  */
/* -------------------------------------------------------------------------- */

/**
 * Sushi's first live sync marked all 29 notes read with the snippet reader, so
 * the body stage would never have fetched one of them — including note 28,
 * whose body is the HW1 deadline (PROGRESS.md, wave 6). "Read" is a claim about
 * a *reader*, and the store has to say which one made it.
 */
describe("the reader version", () => {
  const stored = (extra: Partial<PiazzaFacts> = {}): PiazzaFacts => ({
    enabled: true,
    classes: [CS425],
    classesFetchedAt: NOW_ISO,
    lastNr: { [NID]: 184 },
    ...extra,
  });

  it("reads an absent, zero or fractional version as the oldest reader", () => {
    // House rule 5, on a field off disk: `typeof x === "number"` passes `0` and
    // `NaN`, and each of them would mean "some reader" while naming none. The
    // fallback is 1, which costs one re-read and can never skip one.
    expect(readerVersionOf(undefined)).toBe(1);
    expect(readerVersionOf({ enabled: true })).toBe(1);
    expect(readerVersionOf({ enabled: true, readerVersion: 0 })).toBe(1);
    expect(readerVersionOf({ enabled: true, readerVersion: -2 })).toBe(1);
    expect(readerVersionOf({ enabled: true, readerVersion: 1.5 })).toBe(1);
    expect(readerVersionOf({ enabled: true, readerVersion: Number.NaN })).toBe(1);
    expect(readerVersionOf({ enabled: true, readerVersion: 2 })).toBe(2);
  });

  it("this build is reader 2, the one that reads whole bodies", () => {
    expect(PIAZZA_READER_VERSION).toBe(2);
  });

  it("plans a re-read of everything when the store was written by reader 1", () => {
    const plan = planPiazza(stored(), { granted: true, now: NOW });
    expect(plan.rereadAll).toBe(true);
    // The first half of the upgrade: with `lastNr` ignored, the feed offers
    // every post again. Leaving `sinceNr` on would re-read nothing at all.
    expect(plan.poll).toEqual([{ nid: NID, courseHint: CS425.courseRaw }]);
    expect(plan.reason).toContain("reader 1");
    expect(plan.reason).toContain(`reader ${PIAZZA_READER_VERSION}`);
  });

  it("plans nothing extra once the store says reader 2", () => {
    // Idempotence: the second sync after an upgrade is an ordinary sync, and a
    // `rereadAll` that stayed on would re-read 25 bodies every half hour for ever.
    const plan = planPiazza(stored({ readerVersion: 2 }), { granted: true, now: NOW });
    expect(plan.rereadAll).toBeUndefined();
    expect(plan.poll).toEqual([{ nid: NID, courseHint: CS425.courseRaw, sinceNr: 184 }]);
    expect(plan.reason).not.toContain("reader");
  });

  it("drops this source's seen marks and nothing else", () => {
    /*
     * `seenPosts` is shared with the Campuswire observer and the paste box. An
     * upgrade to *this* reader says nothing about a Campuswire thread, and
     * dropping one would re-offer a correction the student has already seen —
     * from a source that did not change.
     */
    const upgrade = readerUpgrade(
      {
        [`piazza:${NID}:28`]: "2026-09-17T10:00:00-05:00",
        [`piazza:${NID}:42`]: "2026-09-17T10:00:00-05:00",
        "campuswire:cs357:9": "2026-09-17T10:00:00-05:00",
        "paste:abc": "2026-09-17T10:00:00-05:00",
      },
      1,
    );
    expect(Object.keys(upgrade.seenPosts).sort()).toEqual(["campuswire:cs357:9", "paste:abc"]);
    expect(upgrade.dropped).toBe(2);
    expect(upgrade.message).toBe("reader upgraded 1 → 2: re-reading 2 posts in full");
  });

  it("says so even when there was nothing to drop", () => {
    // Worker rule 5: "the upgrade ran and the store was empty" and "the upgrade
    // never ran" are the same silence otherwise, and they want opposite fixes.
    expect(readerUpgrade({}, 1).message).toBe("reader upgraded 1 → 2: re-reading 0 posts in full");
    expect(readerUpgrade(undefined, 1).dropped).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Edited posts: the Running Post is rewritten every week                     */
/* -------------------------------------------------------------------------- */

describe("the feed's own modification signal", () => {
  it("is the last content edit in `log[]`, not `modified`", () => {
    /*
     * The evidence, and it is exact: nr 28's last `update` entry is
     * `2026-09-13T22:22:48Z` and nr 179's is `2026-09-18T03:12:18Z`, which are
     * precisely the `history[0].created` of `post-running.json` and
     * `post.json`. `modified` (and its epoch twin `m`) is **later than both** —
     * it moves on any activity, including a classmate's follow-up, so re-reading
     * on it would fetch bodies nobody has touched.
     */
    const byNr = new Map(posts().map((post) => [post.nr, post]));
    expect(byNr.get(28)?.editedAt).toBe("2026-09-13T22:22:48Z");
    expect(byNr.get(179)?.editedAt).toBe("2026-09-18T03:12:18Z");
    const raw = entries(feed()).find((entry) => entry["nr"] === 28)!;
    expect(raw["modified"]).toBe("2026-09-17T03:20:42Z");
    expect(byNr.get(28)?.editedAt).not.toBe(raw["modified"]);
  });

  it("falls back to the creation entry for a post never edited", () => {
    const byNr = new Map(posts().map((post) => [post.nr, post]));
    // nr 184's log has no `update` at all; "created and never rewritten" is a
    // real edit instant, not a missing one.
    expect(byNr.get(184)?.editedAt).toBe("2026-09-18T09:09:00Z");
    expect(byNr.get(184)?.postedAt).toBe("2026-09-18T09:09:00Z");
  });

  it("does not count a TA editing their own answer", () => {
    /*
     * Deliberately unrealistic, and this is house rule 6's trap in the file:
     * `i_answer_update` **contains** `update`, and the capture happens to hold
     * no post where the two disagree — so a substring match would pass against
     * it unchanged and then re-read a body on every answer edit for ever. The
     * entry below is appended with a later instant than the real edit, so a
     * loose match is visible as a moved `editedAt`.
     */
    const edited = feed();
    const entry = entries(edited).find((item) => item["nr"] === 28)!;
    entry["log"] = [
      ...(entry["log"] as unknown[]),
      { t: "2026-09-16T12:00:00Z", u: "uid-2", n: "i_answer_update" },
    ];
    const post = parseFeed(edited, PAGE).find((item) => item.nr === 28)!;
    expect(post.editedAt).toBe("2026-09-13T22:22:48Z");
  });

  it("costs its own field when the instant does not read", () => {
    // House rule 1: the hook (`log[]`) is there and the value is not, so the
    // post keeps every other field — and an absent `editedAt` simply means "not
    // known to have been edited", which skips a re-read rather than forcing one.
    const broken = feed();
    const entry = entries(broken).find((item) => item["nr"] === 28)!;
    entry["log"] = [
      { t: "2026-08-28T01:32:51Z", u: "uid-8", n: "create" },
      { t: "13 September", u: "uid-8", n: "update" },
    ];
    const post = parseFeed(broken, PAGE).find((item) => item.nr === 28)!;
    expect(post.editedAt).toBeUndefined();
    expect(post.extra.unparsedEditedAt).toBe("13 September");
    expect(post.postedAt).toBe("2026-08-28T01:32:51Z");
    expect(editedSinceSeen(post, "2026-09-01T00:00:00Z")).toBe(false);
  });

  it("compares the two instants, and answers false for either unknown", () => {
    const post = { editedAt: "2026-09-13T22:22:48Z" } as ObservedPost;
    expect(editedSinceSeen(post, "2026-09-09T00:00:00Z")).toBe(true);
    expect(editedSinceSeen(post, "2026-09-14T00:00:00Z")).toBe(false);
    // Equal is not later: a post read at the instant of its edit was read as it
    // now reads, and re-reading it would be a request for nothing.
    expect(editedSinceSeen(post, "2026-09-13T22:22:48Z")).toBe(false);
    /*
     * Neither a bare date nor an absence is evidence of a change (house rule
     * 5). The date below is deliberately *before* the edit: a `typeof seenAt
     * === "string"` here would parse it, find the edit later, and re-read the
     * post — and a bare date a day the *other* side of the edit produces the
     * right answer for the wrong reason, which is how this mutation first
     * survived (mutation rule 4).
     */
    expect(editedSinceSeen(post, "2026-09-12")).toBe(false);
    expect(editedSinceSeen(post, undefined)).toBe(false);
    expect(editedSinceSeen({} as ObservedPost, "2026-09-09T00:00:00Z")).toBe(false);
  });
});

describe("postsToSend and a post that was edited after it was read", () => {
  /** After every edit in the capture — the newest is 2026-09-18T03:12:18Z. */
  const seenAt = "2026-09-19T09:00:00-05:00";

  it("skips an already-read post that has not been rewritten", () => {
    /*
     * The bound on the whole feature. Every post in the capture was last
     * edited before this store read it, so there is nothing new in any of them;
     * a build that re-read them anyway would fetch 106 bodies every half hour.
     */
    const plan = postsToSend(posts(), {
      sinceNr: 184,
      seenPosts: Object.fromEntries(posts().map((post) => [post.id, seenAt])),
    });
    expect(plan.sent).toEqual([]);
    expect(plan.skipped.some((entry) => entry.nr === 28)).toBe(true);
  });

  it("sends one that was, and marks it as a re-reading", () => {
    // Read on the 9th, edited on the 13th: the version this store read is not
    // the version on the page, which is the only thing `seenPosts` cannot say.
    const plan = postsToSend(posts(), {
      sinceNr: 184,
      seenPosts: Object.fromEntries(posts().map((post) => [post.id, "2026-09-09T09:00:00-05:00"])),
    });
    expect(plan.sent.map((post) => post.nr)).toContain(28);
    expect(plan.sent.every((post) => post.reread === true)).toBe(true);
    // `cid` and `nr` survive, because the body stage fetches with them.
    expect(plan.sent.find((post) => post.nr === 28)?.cid).toBe("mtca1sh8pfk6ze");
  });

  it("re-reads nothing at all when the caller hands over no seen marks", () => {
    // Which is every sync before this wave: without the marks there is no
    // "since when", and guessing one would re-read the feed on every poll.
    const plan = postsToSend(posts(), { sinceNr: 184 });
    expect(plan.sent).toEqual([]);
  });

  it("leaves a post above the mark alone: it is new, not re-read", () => {
    const plan = postsToSend(posts(), { sinceNr: 100, seenPosts: {} });
    expect(plan.sent.every((post) => post.nr > 100)).toBe(true);
    expect(plan.sent.every((post) => post.reread === undefined)).toBe(true);
  });
});

describe("a re-read post through ingestPost", () => {
  /** Note 42's payload — the one post in the capture whose snippet states a date. */
  function note42(json: unknown = feed()): (typeof NOTE42_HOLDER)[number] {
    return postsToSend(posts(json)).payloads.find((payload) => payload.id.endsWith(":42"))!;
  }
  const NOTE42_HOLDER = postsToSend(posts()).payloads;

  it("offers a row one suggestion when one post states its deadline twice", () => {
    /*
     * Note 42 says "Register Your MP Group by EOD Today 8/31" in its subject
     * and again in its snippet, and both readings resolve to the same row. The
     * reading is 0.65 — a relative day with a clock this code invented — so it
     * is offered rather than applied, twice, unless the offer made a moment ago
     * in *this* post counts. It does.
     */
    const member: RawItem = {
      source: "gradescope",
      sourceId: "mp-group",
      courseRaw: "CS 425 / ECE 428: Distributed Systems",
      courseCode: "CS425",
      title: "MP Group",
      kind: "assignment",
      status: "not_submitted",
      dueAt: "2026-09-05T23:59:00-05:00",
      fetchedAt: NOW_ISO,
    };
    const item: Item = {
      id: "mp-group",
      members: [member],
      courseCode: "CS425",
      courseLabel: "CS425",
      title: "MP Group",
      kind: "assignment",
      dueAt: "2026-09-05T23:59:00-05:00",
      status: "not_submitted",
      hidden: false,
      done: false,
      notified: {},
    };
    const out = ingestPost(
      { items: [item], overrides: NO_OVERRIDES, suggestions: [], seenPosts: {} },
      note42(),
      NOW_ISO,
    );
    expect(out.dueOverrides).toEqual({});
    expect(out.suggestions.map((suggestion) => suggestion.at)).toEqual([
      "2026-08-31T23:59:00-05:00",
    ]);
  });

  it("refuses a second reading unless the caller says it was edited", () => {
    // The guard that stops every poll re-applying the same correction stays
    // exactly as strict; `reread` is the one thing that may overrule it.
    const seen = { [note42().id]: "2026-09-01T10:00:00-05:00" };
    const out = ingestPost(
      { items: [], overrides: NO_OVERRIDES, suggestions: [], seenPosts: seen },
      note42(),
      NOW_ISO,
    );
    expect(out.suggestions).toEqual([]);
    expect(out.skipped[0]?.reason).toContain("already read");
  });

  it("does not offer the same deadline twice when the edit did not change it", () => {
    /*
     * The commonest re-read by far: the "Running Post" is edited weekly and
     * most edits are clarifications. Two rows in the Attention tab for one
     * deadline is the noise that makes a student stop reading the section, so
     * `alreadySuggested` — same title, same stated day — is what has to hold.
     */
    const first = ingestPost(
      { items: [], overrides: NO_OVERRIDES, suggestions: [], seenPosts: {} },
      note42(),
      NOW_ISO,
    );
    expect(first.suggestions).toHaveLength(1);
    const again = ingestPost(
      {
        items: [],
        overrides: NO_OVERRIDES,
        suggestions: first.suggestions,
        seenPosts: { [note42().id]: NOW_ISO },
      },
      note42(),
      "2026-09-19T12:00:00-05:00",
      undefined,
      { reread: true },
    );
    expect(again.suggestions).toEqual([]);
    // The seen mark still moves, so one edit costs one re-reading and not one
    // per sync for ever.
    expect(again.seenPosts).toEqual({ [note42().id]: "2026-09-19T12:00:00-05:00" });
  });

  it("offers the corrected deadline when the edit moved it", () => {
    /*
     * Deliberately unrealistic (house rule 10): the capture cannot hold two
     * versions of one feed entry, and a build that re-read the post but ignored
     * what it now says would pass every assertion above.
     */
    const corrected = feed();
    const entry = entries(corrected).find((item) => item["nr"] === 42)!;
    entry["content_snipet"] = "Correction: register your MP group by 9/3 at 5pm instead.";
    const first = ingestPost(
      { items: [], overrides: NO_OVERRIDES, suggestions: [], seenPosts: {} },
      note42(),
      NOW_ISO,
    );
    const again = ingestPost(
      {
        items: [],
        overrides: NO_OVERRIDES,
        suggestions: first.suggestions,
        seenPosts: { [note42().id]: NOW_ISO },
      },
      note42(corrected),
      "2026-09-19T12:00:00-05:00",
      undefined,
      { reread: true },
    );
    expect(again.suggestions).toHaveLength(1);
    expect(again.suggestions[0]?.at).toBe("2026-09-03T17:00:00-05:00");
  });
});

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
  feedRequest,
  fetchPostBody,
  highestNr,
  parseClassPage,
  parseFeed,
  piazzaNeedsRecheck,
  planPiazza,
  postBodyRequest,
  postsToSend,
  PIAZZA_MATCH,
  type ObservedPost,
  type PiazzaClass,
  type PiazzaFacts,
} from "../src/core/piazza.js";
import { ingestPost } from "../src/core/suggest.js";
import { ParseError, type Overrides } from "../src/sources/types.js";

const HTML = readFileSync(new URL("../fixtures/piazza/class-page.html", import.meta.url), "utf8");
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

  it("says the time and the count once something has been read", () => {
    const row = describePiazza(
      { enabled: true, state: "ok", lastObservedAt: "2026-09-18T10:32:00-05:00", postsSeen: 3 },
      NOW,
    );
    expect(row).toMatch(/^On · last read .* · 3 posts$/);
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

  it("writes down content.get without pretending to parse it", () => {
    // The request is known; the response is not captured, so there is no
    // parser — and the seam throws rather than returning an empty answer.
    expect(JSON.parse(postBodyRequest("mtca1sh8pfk6ze", NID).body)).toEqual({
      method: "content.get",
      params: { cid: "mtca1sh8pfk6ze", nid: NID },
    });
    expect(() => fetchPostBody()).toThrow(/post\.json/);
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
  it("reads all 25 notes, and finds no deadline in any of them", () => {
    /*
     * The finding, recorded rather than assumed away (docs/piazza-findings.md).
     * Every note in this class states its deadlines *inside the post*, past the
     * 120th character that `content_snipet` stops at — the running posts that
     * carry the real dates are the longest ones on the page — and the two
     * subjects that do carry a date say "Register Your MP Group by EOD Today
     * 8/31", which `announce.ts` does not read: it wants a due-word, and "by
     * EOD" is not one.
     *
     * So the snippet stage's value is **unproven on this class**, and the case
     * below is what would have to change for it to produce anything. The point
     * of asserting zero rather than loosening the assertion is that the day
     * `content.get` lands, this number has to move.
     */
    const { suggestions, seen } = ingestAll();
    expect(Object.keys(seen)).toHaveLength(25);
    expect(suggestions).toEqual([]);
  });

  it("does produce a suggestion when a snippet states one", () => {
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
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ at: "2026-09-25T23:59:00-05:00" });
    expect(suggestions[0]!.span).toContain("9/25");
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

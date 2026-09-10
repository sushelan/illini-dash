/**
 * Canvas parser tests (§4.1), run against `fixtures/canvas/`.
 *
 * The course and assignment fixtures are real captures. The planner fixture is
 * hand-written and its limits are documented in fixtures/canvas/README.md — the
 * real account has no dated Canvas assignments at all, so the mapping cannot yet
 * be exercised by a capture.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CANVAS_ORIGIN,
  courseMap,
  coursesUrl,
  isLoginResponse,
  linkHeaderNext,
  mapKind,
  mapStatus,
  parseCourses,
  parsePlannerItems,
  plannerUrl,
  stripWhilePrefix,
} from "../src/sources/canvas.js";
import { ParseError, type PageCtx } from "../src/sources/types.js";

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/canvas/${name}`, import.meta.url), "utf8");

const page: PageCtx = {
  url: `${CANVAS_ORIGIN}/api/v1/planner/items`,
  fetchedAt: "2026-09-03T05:00:00.000Z",
};

describe("stripWhilePrefix", () => {
  it("removes the prefix when present and leaves the body alone when absent", () => {
    expect(stripWhilePrefix('while(1);[{"id":1}]')).toBe('[{"id":1}]');
    // canvas.illinois.edu does not send it (docs/gate0-results.md).
    expect(stripWhilePrefix('[{"id":1}]')).toBe('[{"id":1}]');
  });
});

describe("linkHeaderNext", () => {
  it("finds rel=next among several links", () => {
    const header =
      '<https://c/api/v1/courses?page=1>; rel="current",' +
      '<https://c/api/v1/courses?page=2>; rel="next",' +
      '<https://c/api/v1/courses?page=9>; rel="last"';
    expect(linkHeaderNext(header)).toBe("https://c/api/v1/courses?page=2");
  });

  it("returns undefined when there is no next page or no header", () => {
    expect(linkHeaderNext('<https://c/x?page=1>; rel="current"')).toBeUndefined();
    expect(linkHeaderNext(null)).toBeUndefined();
  });
});

describe("isLoginResponse", () => {
  it("treats SSO landings and HTML bodies as logged out", () => {
    expect(isLoginResponse(200, "https://shibboleth.illinois.edu/idp", "{}")).toBe(true);
    expect(isLoginResponse(200, "https://canvas.illinois.edu/login/canvas", "{}")).toBe(true);
    expect(
      isLoginResponse(200, "https://canvas.illinois.edu/api/v1/courses", "<!DOCTYPE html>"),
    ).toBe(true);
  });

  it("treats a 401/403 on an unchanged API URL as logged out (§0 rule 2)", () => {
    // An expired session on /api/v1 does not redirect and does not return HTML.
    // Without the status this reads as "logged in" and parseCourses then throws,
    // turning a session expiry into a red parse_error dot instead of a yellow
    // needs_login one.
    const body = '{"status":"unauthenticated","errors":[{"message":"user authorization required"}]}';
    expect(isLoginResponse(401, coursesUrl(), body)).toBe(true);
    expect(isLoginResponse(403, coursesUrl(), body)).toBe(true);
  });

  it("does not mistake real JSON for a login page", () => {
    expect(
      isLoginResponse(200, `${CANVAS_ORIGIN}/api/v1/courses`, fixture("courses-active.json")),
    ).toBe(false);
  });
});

describe("plannerUrl", () => {
  it("spans now-7d to now+60d (§4.1)", () => {
    expect(plannerUrl(new Date("2026-09-03T05:00:00Z"))).toBe(
      `${CANVAS_ORIGIN}/api/v1/planner/items` +
        `?start_date=2026-08-27&end_date=2026-11-02&per_page=100`,
    );
  });
});

describe("parseCourses (real capture)", () => {
  const courses = parseCourses(fixture("courses-active.json"));

  it("reads all three active enrolments", () => {
    expect(courses).toHaveLength(3);
  });

  it("extracts the course code from name, not from the opaque course_code slug", () => {
    const cs357 = courses.find((c) => c.id === 72393)!;
    expect(cs357.rawCourseCode).toBe("cs_357_120268_263847");
    expect(cs357.courseCode).toBe("CS357");
    expect(courses.find((c) => c.id === 74798)!.courseCode).toBe("CS425");
  });

  it("leaves courseCode undefined when neither field carries a code", () => {
    // The stale FA25 admin course; §5.1 falls back to courseRaw comparison.
    expect(courses.find((c) => c.id === 58438)!.courseCode).toBeUndefined();
  });

  it("keeps the per-course time zone Canvas reports", () => {
    expect(courses.every((c) => c.timeZone === "America/Chicago")).toBe(true);
  });

  it("throws on a non-array body rather than returning nothing", () => {
    expect(() => parseCourses('{"status":"unauthenticated"}')).toThrow(ParseError);
    expect(() => parseCourses("<!DOCTYPE html><html>")).toThrow(ParseError);
  });
});

describe("parsePlannerItems — the real, empty capture", () => {
  it("accepts [] as a legitimate result, because it is one here", () => {
    // 0 of 67 published assignments on this account carry a due_at, so the
    // planner is correctly empty (docs/canvas-findings.md). This is the one
    // place where empty is NOT a parse error under §0 rule 3.
    const items = parsePlannerItems(fixture("planner-items-empty.json"), new Map(), page);
    expect(items).toEqual([]);
  });
});

describe("parsePlannerItems — synthetic fixture (see fixtures/canvas/README.md)", () => {
  const courses = courseMap(parseCourses(fixture("courses-active.json")));
  const items = parsePlannerItems(fixture("planner-items-SYNTHETIC.json"), courses, page);
  const byId = (sourceId: string) => items.find((i) => i.sourceId === sourceId)!;

  it("skips planner_note, announcement and wiki_page (§4.1)", () => {
    expect(items.map((i) => i.sourceId)).not.toContain("planner_note:9009");
    expect(items.map((i) => i.sourceId)).not.toContain("announcement:9010");
    expect(items.map((i) => i.sourceId)).not.toContain("wiki_page:9011");
    expect(items).toHaveLength(14);
  });

  it("builds sourceId as plannable_type:plannable_id (§3.1)", () => {
    expect(byId("quiz:9001").title).toBe("Quiz 3: Monte Carlo");
  });

  it("maps kinds per §4.1, including the calendar_event title test", () => {
    expect(byId("quiz:9001").kind).toBe("quiz");
    expect(byId("assignment:9002").kind).toBe("assignment");
    expect(byId("discussion_topic:9008").kind).toBe("assignment");
    expect(byId("calendar_event:9006").kind).toBe("exam"); // "Midterm Exam 1"
    expect(byId("calendar_event:9007").kind).toBe("other"); // "Guest lecture"
  });

  it("emits an unknown plannable_type as other rather than dropping it", () => {
    // Silently losing a deadline is the failure §11 calls catastrophic.
    const peer = byId("assessment_request:9012");
    expect(peer.kind).toBe("other");
    expect(peer.extra?.["plannableType"]).toBe("assessment_request");
  });

  it("maps every submissions state", () => {
    expect(byId("quiz:9001").status).toBe("graded");
    expect(byId("assignment:9002").status).toBe("not_submitted"); // submissions === false
    expect(byId("assignment:9003").status).toBe("submitted");
    expect(byId("assignment:9004").status).toBe("missing");
    expect(byId("assignment:9005").status).toBe("graded"); // excused
    expect(byId("discussion_topic:9008").status).toBe("not_submitted");
  });

  it("records late and excused as modifiers, not as status", () => {
    expect(byId("assignment:9003").extra?.["late"]).toBe("true");
    expect(byId("assignment:9005").extra?.["excused"]).toBe("true");
  });

  it("prefers plannable.due_at over plannable_date when the two disagree", () => {
    // Row 9002 carries due_at 09-12 and plannable_date 09-13 deliberately, so
    // this assertion fails if the parser reads the wrong field. With the two
    // identical (as they are in real Canvas data) the precedence is unpinnable.
    const hw = byId("assignment:9002");
    expect(hw.courseCode).toBe("CS357");
    expect(hw.courseRaw).toBe("Fall 2026-CS 357-Numerical Methods I-Sections AL1, CSP, OL1");
    expect(hw.dueAt).toBe("2026-09-12T04:59:00Z");
    expect(hw.extra?.["dateField"]).toBe("plannable.due_at");
  });

  it("dates calendar_events, not just classifies them", () => {
    expect(byId("calendar_event:9006").dueAt).toBe("2026-10-01T18:00:00Z");
    expect(byId("calendar_event:9007").dueAt).toBe("2026-09-11T15:00:00Z");
  });

  it("leaves a row with no date field undated", () => {
    const undated = byId("assignment:9015");
    expect(undated.dueAt).toBeUndefined();
    expect(undated.extra?.["dateField"]).toBeUndefined();
    expect(undated.extra?.["unparsedDate"]).toBeUndefined();
  });

  it("rejects a non-instant date, records it, and does not throw (§3.2)", () => {
    // "TBD" is a string but not an instant. Storing it would violate the
    // RawItem contract; throwing would discard every other row on the page.
    const tbd = byId("assignment:9016");
    expect(tbd.dueAt).toBeUndefined();
    expect(tbd.extra?.["unparsedDate"]).toBe("TBD");
  });

  it("prefers the course map's name over a stale context_name", () => {
    // Row 9003's context_name deliberately differs from the mapped course name.
    expect(byId("assignment:9003").courseRaw).toBe(
      "Fall 2026-CS 425-Distributed Systems-Sections CSP, DS3, DS4, MC3, MC4, SG, SU",
    );
  });

  it("refuses an off-host html_url and falls back to the Canvas origin", () => {
    expect(byId("assignment:9017").url).toBe(CANVAS_ORIGIN);
  });

  it("falls back to plannable_date when due_at is absent, and says so", () => {
    const survey = byId("assignment:9014");
    expect(survey.dueAt).toBe("2026-09-28T04:59:00Z");
    expect(survey.extra?.["dateField"]).toBe("plannable_date");
  });

  it("absolutises relative html_urls and keeps absolute ones", () => {
    expect(byId("quiz:9001").url).toBe(`${CANVAS_ORIGIN}/courses/72393/quizzes/9001`);
    expect(byId("assignment:9002").url).toBe(
      `${CANVAS_ORIGIN}/courses/72393/assignments/9002`,
    );
  });

  it("falls back to context_name when the course id is not in the map", () => {
    const orphan = byId("assignment:9013");
    expect(orphan.extra?.["unknownCourseId"]).toBe("999999");
    expect(orphan.courseRaw).toBe("ECE 391 / CS 391 Computer Systems Engineering");
    expect(orphan.courseCode).toBe("ECE391"); // §5.1 keeps the first of a cross-listing
    expect(orphan.extra?.["altCodes"]).toBe("ECE391 CS391"); // …and stashes the rest
  });

  it("stamps fetchedAt from the page context", () => {
    expect(items.every((i) => i.fetchedAt === page.fetchedAt)).toBe(true);
  });
});

describe("parsePlannerItems — structural surprises throw (§0 rule 3)", () => {
  it("rejects a non-array body", () => {
    expect(() => parsePlannerItems('{"errors":[]}', new Map(), page)).toThrow(ParseError);
  });

  it("rejects a row missing plannable_type, plannable_id or title", () => {
    expect(() => parsePlannerItems('[{"plannable":{"title":"x"}}]', new Map(), page)).toThrow(
      ParseError,
    );
    expect(() =>
      parsePlannerItems('[{"plannable_type":"assignment","plannable":{}}]', new Map(), page),
    ).toThrow(ParseError);
    expect(() =>
      parsePlannerItems(
        '[{"plannable_type":"assignment","plannable":{"title":"x"}}]',
        new Map(),
        page,
      ),
    ).toThrow(ParseError);
  });
});

describe("field hygiene", () => {
  it("treats an empty title as absent and falls back to plannable.name", () => {
    // "" is a string, so a typeof check alone both accepts it as the title and
    // shadows the name fallback — which would also demote an exam to "other".
    const body = JSON.stringify([
      {
        plannable_type: "calendar_event",
        plannable_id: 1,
        plannable: { title: "", name: "Midterm Exam 2", due_at: "2026-10-01T18:00:00Z" },
        html_url: "/courses/1/calendar_events/1",
      },
    ]);
    const [item] = parsePlannerItems(body, new Map(), page);
    expect(item!.title).toBe("Midterm Exam 2");
    expect(item!.kind).toBe("exam");
  });

  it("does not throw over a missing title on a row it is about to skip", () => {
    // §4.1 discards announcements; insisting they be well formed would take the
    // real deadline on the same page down with them.
    const body = JSON.stringify([
      { plannable_type: "announcement", plannable_id: 1, plannable: {} },
      {
        plannable_type: "assignment",
        plannable_id: 2,
        plannable: { title: "HW1", due_at: "2026-09-10T04:59:00Z" },
        html_url: "/courses/1/assignments/2",
      },
    ]);
    const items = parsePlannerItems(body, new Map(), page);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("HW1");
  });

  it("rejects a naive local time, which would mean a different instant per machine", () => {
    const body = JSON.stringify([
      {
        plannable_type: "assignment",
        plannable_id: 1,
        plannable: { title: "HW1", due_at: "2026-09-12T23:59:00" },
        html_url: "/courses/1/assignments/1",
      },
    ]);
    const [item] = parsePlannerItems(body, new Map(), page);
    expect(item!.dueAt).toBeUndefined();
    expect(item!.extra?.["unparsedDate"]).toBe("2026-09-12T23:59:00");
  });

  it("does not let an empty due_at shadow a usable plannable_date", () => {
    const body = JSON.stringify([
      {
        plannable_type: "assignment",
        plannable_id: 1,
        plannable_date: "2026-09-20T04:59:00Z",
        plannable: { title: "HW1", due_at: "" },
        html_url: "/courses/1/assignments/1",
      },
    ]);
    const [item] = parsePlannerItems(body, new Map(), page);
    expect(item!.dueAt).toBe("2026-09-20T04:59:00Z");
    expect(item!.extra?.["dateField"]).toBe("plannable_date");
  });

  it("refuses non-https and off-origin urls", () => {
    const cases: [string, string][] = [
      ["//evil.example/p", CANVAS_ORIGIN],
      ["javascript:alert(1)", CANVAS_ORIGIN],
      ["https://evil.example/phish", CANVAS_ORIGIN],
      ["http://canvas.illinois.edu/insecure", CANVAS_ORIGIN],
      ["/courses/1/assignments/2", `${CANVAS_ORIGIN}/courses/1/assignments/2`],
    ];
    for (const [href, expected] of cases) {
      const body = JSON.stringify([
        {
          plannable_type: "assignment",
          plannable_id: 1,
          plannable: { title: "x", due_at: "2026-09-10T04:59:00Z" },
          html_url: href,
        },
      ]);
      expect(parsePlannerItems(body, new Map(), page)[0]!.url, href).toBe(expected);
    }
  });
});

describe("mapKind / mapStatus units", () => {
  it("matches exam words only as whole words", () => {
    expect(mapKind("calendar_event", "Final Review")).toBe("exam");
    expect(mapKind("calendar_event", "Examine the data")).toBe("other");
  });

  it("treats a missing submissions field as not submitted", () => {
    expect(mapStatus(undefined)).toBe("not_submitted");
    expect(mapStatus(false)).toBe("not_submitted");
    expect(mapStatus("weird")).toBe("unknown");
  });
});

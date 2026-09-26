/**
 * The Google Calendar calls (`src/core/gcal-client.ts`), against a fake fetch.
 *
 * The three things worth pinning here are not the URLs: they are that a 401
 * reads as the token rather than as a broken calendar, that a 404 means two
 * different things depending on what was being addressed, and that
 * `events.update` is never used — one `PUT` would drop `extendedProperties` and
 * orphan every event on the calendar.
 */

import { describe, expect, it } from "vitest";
import {
  GcalError,
  classifyStatus,
  createCalendar,
  deleteEvent,
  listEvents,
  patchEvent,
  purgeCalendar,
  pushEvents,
  retryDelay,
  withRetry,
} from "../src/core/gcal-client.js";
import { projectEvents, type RemoteEvent } from "../src/core/gcal.js";
import { DEFAULT_SETTINGS } from "../src/core/store.js";
import type { Item } from "../src/sources/types.js";

interface Call {
  url: string;
  method: string;
  body?: unknown;
}

function fakeFetch(answers: (Response | (() => Response))[], calls: Call[] = []) {
  let i = 0;
  const fn = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    const next = answers[Math.min(i, answers.length - 1)]!;
    i += 1;
    return typeof next === "function" ? next() : next;
  };
  return { fn, calls };
}

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const fail = (status: number) => new Response(JSON.stringify({ error: { message: "no" } }), { status });

function item(over: Partial<Item> = {}): Item {
  return {
    id: "abc123",
    members: [],
    courseLabel: "CS357",
    title: "HW5",
    kind: "assignment",
    dueAt: "2026-09-20T23:00:00.000Z",
    status: "not_submitted",
    hidden: false,
    done: false,
    notified: {},
    ...over,
  } as Item;
}

describe("what an HTTP status means here", () => {
  it("reads 401 as the token, never as a broken calendar", () => {
    // House rule 8's shape: an expired grant answers 401 at the unchanged URL
    // with JSON, not a redirect. Without this it would read as "the page
    // changed" one API over.
    expect(classifyStatus(401, "calendar")).toBe("token_invalid");
    expect(classifyStatus(401, "event")).toBe("token_invalid");
  });

  it("reads 403 and 429 as a rate limit, which is the only retryable one", () => {
    expect(classifyStatus(403, "calendar")).toBe("rate_limited");
    expect(classifyStatus(429, "event")).toBe("rate_limited");
    expect(classifyStatus(503, "calendar")).toBe("rate_limited");
  });

  it("tells a deleted calendar from an already-deleted event", () => {
    /*
     * The conflation would be silent and user-visible: every push would
     * announce "your calendar is gone" the first time a student deleted one
     * event by hand in Google Calendar.
     */
    expect(classifyStatus(404, "calendar")).toBe("calendar_missing");
    expect(classifyStatus(404, "event")).toBe("not_found");
  });
});

describe("the calls", () => {
  it("creates one secondary calendar named Illini Dash", async () => {
    const { fn, calls } = fakeFetch([ok({ id: "cal-1" })]);
    const id = await createCalendar({ token: "t", fetch: fn });
    expect(id).toBe("cal-1");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toContain("/calendar/v3/calendars");
    expect(calls[0]!.body).toMatchObject({ summary: "Illini Dash", timeZone: "America/Chicago" });
  });

  it("refuses a calendars.insert that answered without an id", async () => {
    // House rule 5 at the API boundary: `""` would be stored and then used to
    // build every later URL, which is a 404 per event with nothing on screen.
    const { fn } = fakeFetch([ok({ id: "" })]);
    await expect(createCalendar({ token: "t", fetch: fn })).rejects.toThrow(/no calendar id/);
  });

  it("patches an event rather than replacing it, and keeps the tag", async () => {
    const { fn, calls } = fakeFetch([ok({})]);
    const event = projectEvents([item()], DEFAULT_SETTINGS)[0]!;
    await patchEvent({ token: "t", fetch: fn }, "cal-1", "ev-1", event);
    expect(calls[0]!.method).toBe("PATCH");
    expect(calls[0]!.method).not.toBe("PUT");
    expect(calls[0]!.body).toHaveProperty("extendedProperties");
  });

  it("treats an event that is already gone as removed", async () => {
    for (const status of [404, 410]) {
      const { fn } = fakeFetch([fail(status)]);
      await expect(deleteEvent({ token: "t", fetch: fn }, "cal-1", "ev-1")).resolves.toBeUndefined();
    }
  });

  it("still reports a 401 from a delete, because that is not "+"a missing event", async () => {
    const { fn } = fakeFetch([fail(401)]);
    await expect(deleteEvent({ token: "t", fetch: fn }, "cal-1", "ev-1")).rejects.toMatchObject({
      failure: "token_invalid",
    });
  });

  it("adopts only events that carry our tag", async () => {
    const { fn } = fakeFetch([
      ok({
        items: [
          { id: "ev-1", extendedProperties: { private: { illiniDashId: "abc123" } } },
          { id: "ev-2" },
          { id: "", extendedProperties: { private: { illiniDashId: "x" } } },
        ],
      }),
    ]);
    const index = await listEvents({ token: "t", fetch: fn }, "cal-1");
    expect([...index.keys()]).toEqual(["abc123"]);
  });

  it("follows every page, so a semester's events are all found", async () => {
    const { fn, calls } = fakeFetch([
      ok({ items: [{ id: "a", extendedProperties: { private: { illiniDashId: "1" } } }], nextPageToken: "p2" }),
      ok({ items: [{ id: "b", extendedProperties: { private: { illiniDashId: "2" } } }] }),
    ]);
    const index = await listEvents({ token: "t", fetch: fn }, "cal-1");
    expect(index.size).toBe(2);
    expect(calls[1]!.url).toContain("pageToken=p2");
  });
});

describe("one push", () => {
  const events = projectEvents([item(), item({ id: "def456", title: "MP2" })], DEFAULT_SETTINGS);

  it("costs no request when nothing changed", async () => {
    const index = new Map<string, RemoteEvent>(
      events.map((e) => [e.key, { eventId: `ev-${e.key}`, hash: e.hash }]),
    );
    const { fn, calls } = fakeFetch([ok({})]);
    const result = await pushEvents({ token: "t", fetch: fn }, "cal-1", events, index);
    expect(calls).toEqual([]);
    expect(result.total).toBe(2);
  });

  it("removes a finished deadline before it adds a new one", async () => {
    /*
     * Deletes first: the removal is what the student asked for, and an insert
     * that then hits a rate limit must not cost them the thing they pressed.
     */
    const index = new Map<string, RemoteEvent>([["gone", { eventId: "ev-gone", hash: "h" }]]);
    const { fn, calls } = fakeFetch([ok({}), ok({ id: "ev-new1" }), ok({ id: "ev-new2" })]);
    await pushEvents({ token: "t", fetch: fn }, "cal-1", events, index);
    expect(calls[0]!.method).toBe("DELETE");
    expect(calls.slice(1).map((c) => c.method)).toEqual(["POST", "POST"]);
  });

  it("keeps what Google answered when a later call fails, and nothing else", async () => {
    /*
     * Worker rule 6: this test used to assert only that the push rejected — and
     * the rejection took the index with it, so the caller kept the one from
     * before the push and inserted the first event again next time. It passed
     * against exactly that. Now the index comes back with the failure, holding
     * the insert that landed and not the one that did not.
     */
    const { fn } = fakeFetch([ok({ id: "ev-1" }), fail(500)]);
    const result = await pushEvents({ token: "t", fetch: fn }, "cal-1", events, new Map());
    expect(result.failure).toBeInstanceOf(GcalError);
    expect([...result.index.entries()]).toEqual([
      [events[0]!.key, { eventId: "ev-1", hash: events[0]!.hash }],
    ]);
    expect(result.inserted).toBe(1);
  });

  it("forgets a delete that landed, so a failed push does not repeat it", async () => {
    // The other half of the Cloud console's 44.72%: a delete that succeeded and
    // was then forgotten is sent again next push, and Google answers 410.
    const index = new Map<string, RemoteEvent>([["gone", { eventId: "ev-gone", hash: "h" }]]);
    const { fn } = fakeFetch([ok({}), fail(500)]);
    const result = await pushEvents({ token: "t", fetch: fn }, "cal-1", events, index);
    expect(result.failure).toBeDefined();
    expect(result.index.has("gone")).toBe(false);
  });

  it("stops at a 401 rather than collecting two hundred copies of it", async () => {
    const many = projectEvents(
      Array.from({ length: 5 }, (_, i) => item({ id: `id${i}` })),
      DEFAULT_SETTINGS,
    );
    const { fn, calls } = fakeFetch([fail(401)]);
    const result = await pushEvents({ token: "t", fetch: fn }, "cal-1", many, new Map());
    expect(result.failure).toMatchObject({ failure: "token_invalid" });
    expect(calls).toHaveLength(1);
  });

  describe("an event deleted in Google by hand", () => {
    const stale = () =>
      new Map<string, RemoteEvent>(events.map((e) => [e.key, { eventId: `ev-${e.key}`, hash: "old" }]));

    it("goes back on as a new event instead of blocking every later push", async () => {
      for (const status of [404, 410]) {
        const { fn, calls } = fakeFetch([fail(status), ok({ id: "ev-fresh" }), ok({})]);
        const result = await pushEvents({ token: "t", fetch: fn }, "cal-1", events, stale());
        expect(result.failure, String(status)).toBeUndefined();
        expect(calls.map((c) => c.method)).toEqual(["PATCH", "POST", "PATCH"]);
        expect(result.index.get(events[0]!.key)).toEqual({ eventId: "ev-fresh", hash: events[0]!.hash });
        expect(result.inserted).toBe(1);
        expect(result.patched).toBe(1);
      }
    });

    it("still stops on any other failed patch", async () => {
      const { fn, calls } = fakeFetch([fail(400)]);
      const result = await pushEvents({ token: "t", fetch: fn }, "cal-1", events, stale());
      expect(result.failure).toMatchObject({ status: 400 });
      expect(calls).toHaveLength(1);
    });
  });
});

describe("disconnect", () => {
  it("removes the events first, then the calendar", async () => {
    // §0 rule 1's amended wording promises "turning it off deletes that
    // calendar's events", and that has to hold even if the calendar delete is
    // refused.
    const { fn, calls } = fakeFetch([ok({})]);
    await purgeCalendar(
      { token: "t", fetch: fn },
      "cal-1",
      new Map([["a", { eventId: "ev-a", hash: "" }], ["b", { eventId: "ev-b", hash: "" }]]),
    );
    expect(calls.map((c) => c.method)).toEqual(["DELETE", "DELETE", "DELETE"]);
    expect(calls[0]!.url).toContain("/events/ev-a");
    expect(calls[2]!.url).toMatch(/\/calendars\/cal-1$/);
  });
});

describe("the backoff", () => {
  it("retries only what retrying can fix", async () => {
    let tries = 0;
    const work = async () => {
      tries += 1;
      throw new GcalError("token_invalid", 401, "no");
    };
    await expect(withRetry(work, async () => undefined)).rejects.toMatchObject({
      failure: "token_invalid",
    });
    expect(tries).toBe(1);
  });

  it("retries a rate limit, then gives up rather than hammering", async () => {
    let tries = 0;
    const work = async () => {
      tries += 1;
      throw new GcalError("rate_limited", 429, "slow down");
    };
    await expect(withRetry(work, async () => undefined, 3)).rejects.toMatchObject({
      failure: "rate_limited",
    });
    expect(tries).toBe(3);
  });

  it("grows, truncates, and jitters", () => {
    expect(retryDelay(0, () => 1)).toBe(1000);
    expect(retryDelay(1, () => 1)).toBe(2000);
    // Truncated: a tenth attempt waits no longer than the fourth.
    expect(retryDelay(9, () => 1)).toBe(retryDelay(3, () => 1));
    // Jittered, or every install retries a Google outage on the same second.
    expect(retryDelay(0, () => 0)).toBe(500);
  });
});

describe("the calendar list", () => {
  it("is never called: calendar.app.created cannot reach it", async () => {
    /*
     * `calendarList.patch` (the colour) failed 9 of 9 in the Cloud console and
     * answered 401 Invalid Credentials live, from a token that had just created
     * the calendar. `classifyStatus` reads any 401 as a dead token, so a second
     * call to that endpoint would throw a working token away.
     */
    const { readFileSync } = await import("node:fs");
    for (const file of ["../src/core/gcal-client.ts", "../src/background.ts"]) {
      const code = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(code.includes('"/users/me/calendarList'), file).toBe(false);
      expect(code.includes("`/users/me/calendarList"), file).toBe(false);
    }
  });
});

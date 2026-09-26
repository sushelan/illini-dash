/**
 * The Google Calendar REST calls, as thin functions over an injected `fetch`.
 *
 * Thin on purpose: every decision — what to write, what changed, what a failure
 * means to the student — is in `gcal.ts` and `gcal-auth.ts`. What is left here
 * is the URL, the body and the status-to-state mapping, and that mapping is the
 * one thing in this file that is a decision, so it is a pure exported function
 * with its own tests.
 *
 * **Never `events.update`.** It replaces the resource, which drops any property
 * not in the body — including `extendedProperties`, the only thing tying an
 * event back to a deadline. One `update` and every event on the calendar
 * becomes an orphan this extension can neither find nor delete.
 */

import {
  GCAL_CALENDAR_DESCRIPTION,
  GCAL_CALENDAR_NAME,
  GCAL_TIMEZONE,
} from "./gcal-config.js";
import {
  ILLINI_DASH_ID,
  diffEvents,
  diffSize,
  eventBody,
  type ProjectedEvent,
  type RemoteEvent,
} from "./gcal.js";

const API = "https://www.googleapis.com/calendar/v3";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface GcalHttp {
  token: string;
  fetch: FetchLike;
}

/** What a failed call means, in the vocabulary `gcal-auth.ts` transitions on. */
export type GcalFailure = "token_invalid" | "rate_limited" | "calendar_missing" | "not_found" | "http";

export class GcalError extends Error {
  override readonly name = "GcalError";
  constructor(
    readonly failure: GcalFailure,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * HTTP status → what it means here.
 *
 * `scope` is what a 404 is about, and it is the whole reason this is a function
 * rather than a table. A 404 from `events.delete` means the event is already
 * gone — which is success, not a missing calendar — while a 404 from
 * `events.list` means the calendar itself was deleted in Google, and that is a
 * state with a button on it. Deciding by status alone conflates them, and the
 * conflation is silent: every push would announce "your calendar is gone" the
 * first time a student deleted one event by hand.
 *
 * 401 is the token, always: Google answers an expired or revoked access token
 * with 401 at the unchanged URL and a JSON body, never a redirect (house rule
 * 8's shape, one API over).
 *
 * 403 is Google's rate-limit status as well as a permission refusal, and both
 * want the same behaviour here — back off and try later — so they share a
 * state rather than guessing from the error body's `reason`.
 */
export function classifyStatus(status: number, scope: "calendar" | "event"): GcalFailure {
  if (status === 401) return "token_invalid";
  if (status === 403 || status === 429) return "rate_limited";
  if (status >= 500) return "rate_limited";
  if (status === 404) return scope === "calendar" ? "calendar_missing" : "not_found";
  return "http";
}

async function call(
  http: GcalHttp,
  method: string,
  path: string,
  scope: "calendar" | "event",
  body?: unknown,
): Promise<unknown> {
  const response = await http.fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${http.token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    // The body is read for the message and nothing else: Google's error JSON is
    // the only place that says *which* of several 403s this is, and a failure
    // with no detail is the one that costs a round trip in Sushi's browser.
    let detail = "";
    try {
      detail = (await response.text()).slice(0, 300).replace(/\s+/g, " ");
    } catch {
      /* A body that cannot be read must not replace the status. */
    }
    throw new GcalError(
      classifyStatus(response.status, scope),
      response.status,
      `${method} ${path} — ${response.status} ${detail}`,
    );
  }
  if (response.status === 204) return undefined;
  try {
    return await response.json();
  } catch {
    // A 200 with no JSON is what `events.delete` answers on some paths.
    return undefined;
  }
}

/** §8.3: one secondary calendar, created by the extension, named "Illini Dash". */
export async function createCalendar(http: GcalHttp): Promise<string> {
  const created = (await call(http, "POST", "/calendars", "calendar", {
    summary: GCAL_CALENDAR_NAME,
    description: GCAL_CALENDAR_DESCRIPTION,
    timeZone: GCAL_TIMEZONE,
  })) as { id?: unknown };
  // House rule 5 at the API boundary: `typeof x === "string"` passes `""`, and
  // an empty calendar id would be stored, then used to build every later URL —
  // which is a 404 per event with nothing on screen to say the id was never
  // real.
  if (typeof created?.id !== "string" || created.id === "") {
    throw new GcalError("http", 200, "calendars.insert returned no calendar id");
  }
  return created.id;
}

/*
 * No calendar colour. `calendarList.patch` is the only place Google keeps one —
 * it belongs to the entry in the student's list, not to the calendar — and
 * `calendar.app.created` does not reach the list: every call failed, 9 of 9 in
 * the Cloud console, and the live answer was `401 Invalid Credentials` from the
 * same token that had just created the calendar (2026-09-25). A 401 that is not
 * about the token is also exactly what `classifyStatus` would misread as one.
 * Asking for the colour would mean asking for a wider scope; the calendar is
 * named "Illini Dash", which is enough to find it.
 */

/**
 * Every event this extension has on the calendar, keyed the way it keys them.
 *
 * A full list rather than a `privateExtendedProperty` filter, because the
 * calendar holds nothing else: the scope cannot reach any other calendar, and
 * this one was created by us. A filter would be a second thing to get wrong and
 * would hide any event that somehow lost its property — which is precisely the
 * event a reconciliation needs to find and delete.
 *
 * `showDeleted=false` and a page size, because a semester is a few hundred
 * events and Google's default page is 250.
 */
export async function listEvents(
  http: GcalHttp,
  calendarId: string,
): Promise<Map<string, RemoteEvent>> {
  const index = new Map<string, RemoteEvent>();
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({ maxResults: "2500", showDeleted: "false" });
    if (pageToken) query.set("pageToken", pageToken);
    const page = (await call(
      http,
      "GET",
      `/calendars/${encodeURIComponent(calendarId)}/events?${query.toString()}`,
      "calendar",
    )) as { items?: unknown; nextPageToken?: unknown };

    const items = Array.isArray(page?.items) ? page.items : [];
    for (const raw of items) {
      const event = raw as {
        id?: unknown;
        extendedProperties?: { private?: Record<string, unknown> };
      };
      const key = event?.extendedProperties?.private?.[ILLINI_DASH_ID];
      if (typeof event?.id !== "string" || event.id === "") continue;
      if (typeof key !== "string" || key === "") continue;
      // An empty hash, not a real one: this index is adopted from Google, so
      // nothing here is a body *we* wrote. An empty hash never matches a
      // projected one, so every adopted event is patched once and then settles
      // — which is the honest answer, and cheap, because it happens only at
      // connect time or after a reconciliation.
      index.set(key, { eventId: event.id, hash: "" });
    }
    pageToken = typeof page?.nextPageToken === "string" ? page.nextPageToken : undefined;
  } while (pageToken !== undefined);
  return index;
}

export async function insertEvent(
  http: GcalHttp,
  calendarId: string,
  event: ProjectedEvent,
): Promise<string> {
  const created = (await call(
    http,
    "POST",
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    "calendar",
    eventBody(event),
  )) as { id?: unknown };
  if (typeof created?.id !== "string" || created.id === "") {
    throw new GcalError("http", 200, "events.insert returned no event id");
  }
  return created.id;
}

/** `PATCH`, never `PUT` — see this module's header. */
export async function patchEvent(
  http: GcalHttp,
  calendarId: string,
  eventId: string,
  event: ProjectedEvent,
): Promise<void> {
  await call(
    http,
    "PATCH",
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    "event",
    eventBody(event),
  );
}

/**
 * Removes one event. An event that is already gone counts as removed.
 *
 * Google answers a second delete with 410 as well as 404, and both mean the
 * same thing here: the row the student ticked is off the calendar. Treating
 * either as a failure would arm a backoff over an outcome we wanted.
 */
export async function deleteEvent(
  http: GcalHttp,
  calendarId: string,
  eventId: string,
): Promise<void> {
  try {
    await call(
      http,
      "DELETE",
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      "event",
    );
  } catch (err) {
    if (err instanceof GcalError && (err.status === 404 || err.status === 410)) return;
    throw err;
  }
}

/**
 * Deletes the calendar itself, on Disconnect.
 *
 * `calendars.delete` is permitted under `calendar.app.created` for a calendar
 * this app created, which is the only kind it can address. A calendar that is
 * already gone counts as deleted, for the same reason an event does.
 */
export async function deleteCalendar(http: GcalHttp, calendarId: string): Promise<void> {
  try {
    await call(http, "DELETE", `/calendars/${encodeURIComponent(calendarId)}`, "calendar");
  } catch (err) {
    if (err instanceof GcalError && (err.status === 404 || err.status === 410)) return;
    throw err;
  }
}

/**
 * §6's ladder, in miniature: truncated exponential backoff with jitter.
 *
 * Returned as a list rather than slept through here, so the wait is the
 * caller's (and a test's) to control — the same shape `nextAttemptAt` has, and
 * for the same reason: a delay hidden inside the thing being tested makes the
 * test slow or the code untestable, and this project has already chosen which.
 */
export const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000];

export function retryDelay(attempt: number, random = Math.random): number {
  const base = RETRY_DELAYS_MS[Math.min(Math.max(attempt, 0), RETRY_DELAYS_MS.length - 1)]!;
  // Jittered, because every one of this extension's installs would otherwise
  // retry a Google outage on the same second.
  return Math.round(base * (0.5 + random() * 0.5));
}

/**
 * Runs `work`, retrying only what retrying can fix.
 *
 * `rate_limited` is the one failure a retry helps with. A `token_invalid` needs
 * a new token, a `calendar_missing` needs a new calendar, and an `http` is a bad
 * request that will be exactly as bad the second time — retrying any of those
 * is three more requests and the same answer, delaying the sentence the student
 * needs by eight seconds.
 */
export async function withRetry<T>(
  work: () => Promise<T>,
  sleep: (ms: number) => Promise<void>,
  attempts = RETRY_DELAYS_MS.length,
  random = Math.random,
): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await work();
    } catch (err) {
      last = err;
      if (!(err instanceof GcalError) || err.failure !== "rate_limited") throw err;
      if (attempt === attempts - 1) break;
      await sleep(retryDelay(attempt, random));
    }
  }
  throw last;
}

/** What one push did, for the log line and for the chip. */
export interface PushResult {
  /**
   * The new `store.gcal.byItemId`: every call Google answered, and nothing
   * else. Returned on failure too — see `failure`.
   */
  index: Map<string, RemoteEvent>;
  inserted: number;
  patched: number;
  deleted: number;
  /** Total events on the calendar afterwards — what "Pushed N events" counts. */
  total: number;
  /**
   * The error that stopped the push, when one did.
   *
   * Returned rather than thrown, because a throw took `index` with it: the
   * caller kept the index from *before* the push, so every event inserted
   * before the failure was inserted again next time — a duplicate on the
   * student's calendar — and every delete was repeated into a 404. That is
   * what 44.72% errors on `events.delete` in the Cloud console was (2026-09-25).
   * The caller saves `index` first and then acts on this.
   */
  failure?: unknown;
}

/**
 * Applies one diff, and reports what is on the calendar afterwards.
 *
 * Here rather than in `background.ts` because it contains two decisions and the
 * worker is the file the suite cannot reach (worker rule 1):
 *
 * 1. **Deletes first.** A student who ticked one deadline and added another in
 *    the same minute should see the finished one leave even if the insert then
 *    hits a rate limit. The removal is the thing they asked for; the addition
 *    comes back on the next sync for free.
 * 2. **The index is rebuilt from what actually succeeded.** An entry is written
 *    only after Google answered, and an event whose call failed keeps its old
 *    entry rather than a new hash — so the next push retries it instead of
 *    believing a write that never landed. This is worker rule 2 at the event
 *    level: the stored hash is evidence, not intent.
 *
 * Any failure stops the push and comes back in `failure`, with `index` holding
 * what had already landed: a `token_invalid`, `calendar_missing` or
 * `rate_limited` is a state with a sentence and a button, and grinding through
 * two hundred more requests to collect two hundred copies of the same failure
 * helps nobody.
 */
export async function pushEvents(
  http: GcalHttp,
  calendarId: string,
  projected: readonly ProjectedEvent[],
  remoteIndex: ReadonlyMap<string, RemoteEvent>,
  log: (line: string) => void = () => undefined,
): Promise<PushResult> {
  const diff = diffEvents(projected, remoteIndex);
  const index = new Map(remoteIndex);
  let inserted = 0;
  let patched = 0;
  let deleted = 0;

  try {
    for (const entry of diff.deletes) {
      await deleteEvent(http, calendarId, entry.eventId);
      index.delete(entry.key);
      deleted += 1;
    }
    for (const { eventId, event } of diff.patches) {
      try {
        await patchEvent(http, calendarId, eventId, event);
        index.set(event.key, { eventId, hash: event.hash });
        patched += 1;
      } catch (err) {
        // The event is gone from Google — the student deleted it by hand, most
        // likely — so the stored id points at nothing. Left as a failure it
        // stopped every later push at the same event, forever; the deadline
        // still belongs on the calendar, so it goes back on as a new event.
        if (!(err instanceof GcalError && (err.status === 404 || err.status === 410))) throw err;
        const fresh = await insertEvent(http, calendarId, event);
        index.set(event.key, { eventId: fresh, hash: event.hash });
        inserted += 1;
      }
    }
    for (const event of diff.inserts) {
      const eventId = await insertEvent(http, calendarId, event);
      index.set(event.key, { eventId, hash: event.hash });
      inserted += 1;
    }
  } catch (failure) {
    log(`[gcal] stopped after +${inserted} ~${patched} -${deleted}; kept what Google answered`);
    return { index, inserted, patched, deleted, total: index.size, failure };
  }

  // Both branches out loud (worker rule 5): "nothing to do" and "the push never
  // ran" are otherwise the same silence in the console, and that ambiguity is
  // what costs a round trip in Sushi's browser.
  log(
    diffSize(diff) === 0
      ? `[gcal] nothing changed — ${index.size} events already on the calendar`
      : `[gcal] +${inserted} ~${patched} -${deleted} — ${index.size} events on the calendar`,
  );

  return { index, inserted, patched, deleted, total: index.size };
}

/**
 * Removes every event this extension put on the calendar, then the calendar.
 *
 * Disconnect's promise, in the order that keeps it under a partial failure: the
 * events go first, so a `calendars.delete` that is refused still leaves nothing
 * of the student's coursework behind. SPEC §0 rule 1's amended wording says
 * "turning it off deletes that calendar's events" — that sentence has to be
 * true even on the unhappy path.
 */
export async function purgeCalendar(
  http: GcalHttp,
  calendarId: string,
  remoteIndex: ReadonlyMap<string, RemoteEvent>,
  log: (line: string) => void = () => undefined,
): Promise<void> {
  for (const [, remote] of remoteIndex) {
    await deleteEvent(http, calendarId, remote.eventId);
  }
  log(`[gcal] disconnect — removed ${remoteIndex.size} events`);
  await deleteCalendar(http, calendarId);
  log(`[gcal] disconnect — removed the calendar itself`);
}

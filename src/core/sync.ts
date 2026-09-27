/**
 * The sync loop (§6).
 *
 * Orchestration only: what to fetch, in what order, what a failure means, and
 * what gets written. Fetching, parsing and the clock are injected, so the whole
 * loop is testable in Node without a browser — which matters because its
 * failure modes (a source going dark, a backoff that never lifts, a partial
 * write) are exactly the ones that are invisible in manual testing.
 */

import { applyRetention, dedupe } from "./dedupe.js";
import { dedupeInput } from "./manual.js";
import { looksLoggedOut } from "./parsing.js";
import { inBackoff, nextAttemptAt, type StoreV1Plus } from "./store.js";
import type { StoreQueue } from "./queue.js";
import * as canvas from "../sources/canvas.js";
import * as gradescope from "../sources/gradescope.js";
import * as prairielearn from "../sources/prairielearn.js";
import * as prairietest from "../sources/prairietest.js";
import * as smartphysics from "../sources/smartphysics.js";
import {
  ParseError,
  memberKey,
  type Adapter,
  type PageCtx,
  type RawItem,
  type Source,
  type SourceState,
} from "../sources/types.js";

/** §4: 20 s per request, at most 4 concurrent per host. */
export const REQUEST_TIMEOUT_MS = 20_000;

/**
 * How long a spinner is allowed to keep claiming something is happening.
 *
 * A real sync is five or six requests and takes five to ten seconds, which is
 * already long enough to wonder whether the click registered. What it must not
 * do is spin forever: `chrome.runtime.sendMessage` does not reject when the
 * service worker is torn down mid-answer, so a dead worker left the button
 * disabled and turning with nothing behind it and no way to press it again.
 *
 * One request timeout plus slack. A sync that has produced nothing by then is
 * not going to, and the honest thing is to hand the screen back.
 */
export const SYNC_SPINNER_CAP_MS = REQUEST_TIMEOUT_MS + 10_000;
export const MAX_CONCURRENT_PER_HOST = 4;
/** §6: a popup-triggered sync inside this window is a no-op. */
export const POPUP_DEBOUNCE_MS = 5 * 60_000;

export interface FetchedPage {
  url: string;
  finalUrl: string;
  status: number;
  body: string;
}

export interface SyncDeps {
  /**
   * §4.5's runner, in the offscreen document. Separate from `parseHtml` because
   * an adapter parse needs the adapter itself.
   */
  runAdapter(adapter: Adapter, html: string, page: PageCtx): Promise<RawItem[]>;
  /** Enabled adapters whose host permission has actually been granted. */
  enabledAdapters(): Promise<Adapter[]>;
  /** Canvas course ids the student forced back in past §4.1's term filter. */
  keptCourses(): ReadonlySet<string>;
  /** Records what the term filter held back, so the UI can offer it back. */
  reportSetAsideCourses(courses: StoreV1Plus["setAsideCourses"]): void;
  /** One authenticated GET. Throws on network failure. */
  fetchPage(url: string): Promise<FetchedPage>;
  /** Runs a parser in the offscreen document (§2.1). */
  parseHtml(source: Source, html: string, page: PageCtx): Promise<RawItem[]>;
  /**
   * Gradescope's dashboard yields courses rather than RawItems, so it cannot go
   * through `parseHtml`'s protocol. Injected rather than held in module state so
   * the loop has no hidden globals.
   */
  parseGradescopeDashboard(html: string): Promise<gradescope.GradescopeCourse[]>;
  /** Same shape: the enrolment list yields courses, not items. */
  parseSmartPhysicsCourses(html: string): Promise<smartphysics.SmartPhysicsCourse[]>;
  /**
   * PrairieLearn's student home (§4.3 step 1): the course instances, or the
   * page's own statement that there are none (roadmap I46).
   */
  parsePrairieLearnHome(html: string): Promise<prairielearn.HomeReading>;
  now(): string;
}

/**
 * What started this sync.
 *
 * "recheck" is a page finishing on a source's own site while that source is
 * waiting on a login — the only evidence this extension gets that a sign-in
 * happened, since it happens in a tab it does not own. It is *not* "manual":
 * a page load on Gradescope is not the student asking for Piazza, and treating
 * it as one defeated §6's ladder for every student who browses the other sites
 * (`planPiazza`, which maps it to a scheduled run).
 */
export type SyncTrigger = "alarm" | "popup" | "install" | "manual" | "recheck";

export interface SourceOutcome {
  source: Source;
  /**
   * `SourceState` rather than the five attempt results, because a source that
   * is *resting* in §6's backoff reports the state that put it there without
   * being attempted — and since `defaultStatus` now seeds `pending`, that
   * carried-over state can in principle be `pending`.
   *
   * `syncOneSource` itself never returns `pending`: it always attempts, so it
   * always has a result. The backoff branch in `runSync` pushes its outcome and
   * `continue`s, so a `pending` outcome never reaches the ok / disabled / empty
   * / failure branches below and cannot be mistaken for a failed attempt.
   *
   * The loop's terminal answers are therefore: `ok` (read, and here is what it
   * says), `disabled` (nothing configured to read), `empty` (read, and the page
   * itself says there is nothing for this student), and a failure.
   */
  state: SourceState;
  items: RawItem[];
  error?: string;
  requests: number;
  /**
   * Course sites only: what each adapter answered (§4.5).
   *
   * One adapter failing among several used to report `ok` — and the ok branch
   * dropped every `site:` row before re-adding the survivors', so the failed
   * course's deadlines vanished behind a green dot (roadmap I47). With this,
   * `applySync` replaces rows per adapter and keeps the failed one's.
   */
  adapters?: AdapterOutcome[];
  /**
   * What the page listed this time, for the N→0 guard: PrairieLearn's course
   * instance ids. A held row from an instance the home no longer lists has
   * left the page by the page's own rule, not by a parser short-circuiting.
   */
  scope?: string[];
  /** Only for `needs_login`, and only where the page is not a fixed login form. */
  loginUrl?: string;
  /**
   * Wall-clock milliseconds this source took.
   *
   * Logged per source because "the sync feels slow" is not actionable and
   * "prairielearn: ok (12 items, 9 requests, 8.4s)" is — it says whether a
   * source is doing a lot of work or sitting on one request until the 20s
   * timeout, and those want opposite fixes. Worker rule 5: add the line rather
   * than spend another round trip in Sushi's browser.
   */
  ms?: number;
}

/**
 * Raised when a fetch looks logged out, so §6 reports needs_login.
 *
 * Carries the evidence. "session expired" alone is useless when the student is
 * demonstrably logged in and one source still says otherwise — the only way to
 * tell a real expiry from a misfiring heuristic is which request, what status,
 * and where it landed.
 */
class NeedsLogin extends Error {
  override readonly name = "NeedsLogin";
  constructor(readonly page: FetchedPage) {
    super(
      `${page.status} at ${page.finalUrl}` +
        (page.finalUrl !== page.url ? ` (from ${page.url})` : "") +
        ` — ${page.body.slice(0, 120).replace(/\s+/g, " ")}`,
    );
  }
}

/**
 * An HTTP status this loop refuses, carrying the status itself.
 *
 * `new Error("404 from …")` lost the one fact the caller needs to tell a broken
 * adapter from a site having a bad afternoon.
 */
class HttpStatusError extends Error {
  override readonly name = "HttpStatusError";
  constructor(readonly status: number, url: string) {
    super(`${status} from ${url}`);
  }
}

/**
 * Whether an adapter's failure means *this adapter is broken* or *the network
 * is*.
 *
 * The first live run after Tier 0a produced `TypeError: Failed to fetch` for the
 * CS 424 site on the sync that fires immediately after an extension reload, and
 * the loop reported the source as `parse_error` — §6's "the page changed, show a
 * red dot" state. It self-healed on the next sync, but the label would have sent
 * someone to debug selectors that were fine, and it is the wrong half of §6's
 * own distinction: a parse error is not retried hopefully, a network error is.
 *
 * Only 404 and 410 are structural: they say the URL is gone, moved, or was
 * never right. Every other status says nothing about the page — a 5xx is the
 * site's afternoon, and a 429 or 408 is the site asking us to slow down or
 * try again. The old rule called every 4xx structural, which put a red "the
 * page changed" dot and §6's backoff on a rate limit (decided 2026-09-24).
 */
export function adapterFailureKind(err: unknown): "parse" | "network" {
  if (err instanceof ParseError) return "parse";
  if (err instanceof HttpStatusError) return err.status === 404 || err.status === 410 ? "parse" : "network";
  return "network";
}

type LoginTest = (status: number, finalUrl: string, body: string) => boolean;

/**
 * One GET, refused before any parser sees it when it is not a page to parse.
 *
 * The login test comes first — a 401 is a sign-in, not a broken page (§0 rule
 * 2) — and the status second: an error page has none of a parser's hooks, so
 * handed on it throws ParseError and reports a 502 as "the page changed".
 * `adapterFailureKind` decides what the status means.
 */
async function fetchChecked(url: string, deps: SyncDeps, isLoginResponse: LoginTest): Promise<FetchedPage> {
  const page = await deps.fetchPage(url);
  if (isLoginResponse(page.status, page.finalUrl, page.body)) throw new NeedsLogin(page);
  if (page.status >= 400) throw new HttpStatusError(page.status, page.url);
  return page;
}

/**
 * `run` over `items`, at most `limit` at a time, results in input order.
 *
 * A pool, not batches: with batches of four, one slow request held three free
 * slots until it finished. Rejects with the first rejection, like
 * `Promise.all`, which is what every caller wants — a login page or a network
 * failure on one course page is the source's answer.
 */
export async function pooled<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await run(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** §4: at most 4 concurrent requests per host. Every URL here is one source's host. */
async function fetchAll(
  urls: string[],
  deps: SyncDeps,
  isLoginResponse: LoginTest,
): Promise<FetchedPage[]> {
  return pooled(urls, MAX_CONCURRENT_PER_HOST, (url) => fetchChecked(url, deps, isLoginResponse));
}

/* -------------------------------------------------------------------------- */
/* Per-source plans                                                            */
/* -------------------------------------------------------------------------- */

/**
 * What a plan read. `items` is the answer; the rest is evidence the loop needs
 * to judge it (see `SourceOutcome`).
 */
interface PlanResult {
  items: RawItem[];
  adapters?: AdapterOutcome[];
  scope?: string[];
}

async function syncCanvas(deps: SyncDeps): Promise<PlanResult> {
  const fetchedAt = deps.now();
  const coursesPage = await fetchChecked(canvas.coursesUrl(), deps, canvas.isLoginResponse);

  // §4.1's concluded-course filter. The map keeps *every* course, so a planner
  // row for a held-back course still resolves its name rather than becoming an
  // `unknownCourseId` — which means something different and would be a lie.
  // The rows themselves are dropped below, and what was held back is reported
  // so the loop can persist it for the UI.
  const all = canvas.parseCourses(coursesPage.body);
  const { setAside } = canvas.currentTermCourses(all, new Date(fetchedAt), deps.keptCourses());
  const held = new Set(setAside.map((entry) => entry.course.id));
  deps.reportSetAsideCourses(
    setAside.map((entry) => ({
      id: String(entry.course.id),
      name: entry.course.name,
      courseCode: entry.course.courseCode,
      reason: entry.reason,
    })),
  );
  if (setAside.length > 0) {
    console.log(
      `[canvas] ${setAside.length} course(s) set aside: ${setAside
        .map((entry) => `${entry.course.courseCode ?? entry.course.name} (${entry.reason})`)
        .join("; ")}`,
    );
  } else {
    // Both branches (worker rule 5): "nothing was stale" and "the filter never
    // ran" are otherwise the same silence.
    console.log(`[canvas] term filter kept all ${all.length} course(s)`);
  }
  const courses = canvas.courseMap(all);

  const plannerPage = await fetchChecked(
    canvas.plannerUrl(new Date(fetchedAt)),
    deps,
    canvas.isLoginResponse,
  );
  const items = canvas.parsePlannerItems(plannerPage.body, courses, {
    url: plannerPage.finalUrl,
    fetchedAt,
  });
  if (held.size === 0) return { items };
  return {
    items: items.filter((item) => {
      const courseId = item.extra?.["canvasCourseId"];
      return courseId === undefined || !held.has(Number(courseId));
    }),
  };
}

async function syncGradescope(deps: SyncDeps): Promise<PlanResult> {
  const fetchedAt = deps.now();
  const dashboard = await fetchChecked(
    `${gradescope.GRADESCOPE_ORIGIN}/`,
    deps,
    gradescope.isLoginResponse,
  );

  // Parsed in the offscreen document like any other HTML, but it yields courses
  // rather than items, so it goes through its own call.
  const courses = await deps.parseGradescopeDashboard(dashboard.body);
  // §4.2's card states "0 assignments"; fetching those pages would be a request
  // per empty course for nothing.
  const worthFetching = courses.filter((course) => course.assignmentCount !== 0);

  const pages = await fetchAll(
    worthFetching.map((course) => course.url),
    deps,
    gradescope.isLoginResponse,
  );
  const items: RawItem[] = [];
  for (const page of pages) {
    items.push(
      ...(await deps.parseHtml("gradescope", page.body, { url: page.finalUrl, fetchedAt })),
    );
  }
  return { items };
}


async function syncPrairieLearn(deps: SyncDeps): Promise<PlanResult> {
  const fetchedAt = deps.now();
  const home = await fetchChecked(
    `${prairielearn.PRAIRIELEARN_ORIGIN}/pl/`,
    deps,
    prairielearn.isLoginResponse,
  );

  // §4.3 step 1 as amended 2026-09-27: the *student* Courses table, read in
  // the offscreen document. This was a regex over the whole body, which swept
  // up instructor and expired instances and called a student with no course a
  // parse error — "Couldn't read" for every CS student over a break (I46).
  const reading = await deps.parsePrairieLearnHome(home.body);
  if (reading.kind === "none") {
    // Both branches logged (worker rule 5): a false "empty" deletes rows, so it
    // has to be diagnosable from the console.
    console.log(`[prairielearn] home: ${reading.reason} — nothing to read`);
    throw new SourceEmpty(prairielearn.emptyReason(reading));
  }
  const instanceIds = reading.courseInstanceIds;
  console.log(
    `[prairielearn] home: ${instanceIds.length} course instance(s) [${instanceIds.join(", ")}]` +
      (reading.invitations > 0 ? `, ${reading.invitations} invitation(s) not accepted` : ""),
  );

  const pages = await fetchAll(
    instanceIds.map((id) => `${prairielearn.PRAIRIELEARN_ORIGIN}/pl/course_instance/${id}/assessments`),
    deps,
    prairielearn.isLoginResponse,
  );
  const items: RawItem[] = [];
  for (const page of pages) {
    items.push(
      ...(await deps.parseHtml("prairielearn", page.body, { url: page.finalUrl, fetchedAt })),
    );
  }
  return { items, scope: instanceIds };
}

async function syncPrairieTest(deps: SyncDeps): Promise<PlanResult> {
  const fetchedAt = deps.now();
  const home = await fetchChecked(
    `${prairietest.PRAIRIETEST_ORIGIN}/pt/`,
    deps,
    prairietest.isLoginResponse,
  );
  return {
    items: await deps.parseHtml("prairietest", home.body, { url: home.finalUrl, fetchedAt }),
  };
}

/**
 * smartPhysics, in two stages like Gradescope.
 *
 * Every course page is addressed by a per-student enrolment id, so the list has
 * to be discovered rather than configured — which is why this is a source and
 * not a §4.5 adapter.
 */
async function syncSmartPhysics(deps: SyncDeps): Promise<PlanResult> {
  const fetchedAt = deps.now();
  const home = await fetchChecked(
    `${smartphysics.SMARTPHYSICS_ORIGIN}/`,
    deps,
    smartphysics.isLoginResponse,
  );

  const courses = await deps.parseSmartPhysicsCourses(home.body);
  const active = courses.filter((course) => course.active);
  if (active.length === 0) {
    // Not a ParseError. A student with no current PHYS 21x enrolment — most
    // students, most terms — has a legitimately empty active list, and calling
    // that a broken page would put a red dot on every non-physics tester.
    // Worker rule 2's third branch: report *that*, do not report `ok` with
    // nothing behind it either.
    //
    // `empty`, not `disabled` (2026-09-27): the student switched this on, and
    // `disabled` printed "Off" beside a switch that was on. The page was read
    // and said there is nothing here, which is what `empty` means.
    throw new SourceEmpty(
      courses.length === 0
        ? "smartPhysics lists no enrolments for you"
        : `smartPhysics lists no active course (${courses.length} inactive)`,
    );
  }

  const pages = await fetchAll(
    active.map((course) => smartphysics.courseUrl(course.enrollmentId)),
    deps,
    smartphysics.isLoginResponse,
  );
  const items: RawItem[] = [];
  for (const page of pages) {
    items.push(
      ...(await deps.parseHtml("smartphysics", page.body, { url: page.finalUrl, fetchedAt })),
    );
  }
  return { items };
}

/** What one course-site adapter answered in one sync (§4.5). */
export interface AdapterOutcome {
  id: string;
  state: "ok" | "parse_error" | "network_error";
  /** Empty when it failed; its previous rows are kept by `applySync`. */
  items: RawItem[];
  error?: string;
}

/** The host an adapter fetches from, which is what §4's per-host cap counts. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    // An unparseable URL fails in `fetchPage` and is reported against its
    // adapter there; it still needs a pool, and one of its own is harmless.
    return url;
  }
}

/**
 * §4.5: every enabled adapter, each isolated.
 *
 * One adapter's failure must not take the others down — that is the whole
 * reason course sites are adapters rather than a fifth hand-written parser —
 * so a throw is recorded against that adapter and the rest still run. The
 * source only fails outright when *every* adapter failed, which means the
 * runner or the registry is broken rather than one course's page.
 *
 * Each adapter's answer is returned, not only the survivors' rows: the loop
 * replaces rows per adapter and keeps the failed one's (roadmap I47).
 *
 * Fetched through one flat pool per host (worker rule 9), all hosts at once.
 * They used to run strictly one after another, so the source took the sum of
 * its adapters — two slow course sites outlasted the popup's 30 s spinner cap
 * on a sync where nothing was wrong. Results stay in registry order.
 */
async function syncSites(deps: SyncDeps): Promise<PlanResult> {
  const adapters = await deps.enabledAdapters();
  // Not `return []`. A source that fetched nothing because nothing is
  // configured is not a source that succeeded: reporting `ok` painted a green
  // dot over a course-site source with no adapter enabled, which is exactly the
  // silent-empty §0 rule 3 forbids. It cost a real user two rounds of
  // "why don't I see any WEB rows" — the dot said everything was fine.
  if (adapters.length === 0) throw new SourceDisabled("no course sites are enabled");

  const fetchedAt = deps.now();

  const readOne = async (adapter: Adapter): Promise<AdapterOutcome> => {
    try {
      const page = await deps.fetchPage(adapter.url);
      // §4.5: "sites behind Shibboleth work only while the SSO session is alive;
      // same needs_login handling". Checked before the status test, because a
      // protected course page answers 401 *in place* rather than redirecting to
      // an SSO host — verified against a real one — so a plain `status >= 400`
      // would report an expired session as a broken adapter and back off
      // instead of telling the student to log in (§0 rule 2).
      if (looksLoggedOut(page.status, page.finalUrl, page.body)) throw new NeedsLogin(page);
      if (page.status >= 400) throw new HttpStatusError(page.status, adapter.url);
      const rows = await deps.runAdapter(adapter, page.body, { url: page.finalUrl, fetchedAt });
      // The success branch, logged (worker rule 5): "site: ok (19 items, 2
      // requests)" cannot say which adapter read how many, and on 2026-09-20 it
      // cost a question that this line answers.
      console.log(`[site] adapter ${adapter.id}: ${rows.length} item(s)`);
      return { id: adapter.id, state: "ok", items: rows };
    } catch (err) {
      if (err instanceof NeedsLogin) throw err;
      const kind = adapterFailureKind(err);
      // The kind is in the line, so a recurrence is diagnosable from the console
      // without another trip to the browser (worker rule 5).
      console.warn(`[site] adapter ${adapter.id} failed (${kind}):`, err);
      return {
        id: adapter.id,
        state: kind === "parse" ? "parse_error" : "network_error",
        items: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };

  const byHost = new Map<string, Adapter[]>();
  for (const adapter of adapters) {
    const host = hostOf(adapter.url);
    byHost.set(host, [...(byHost.get(host) ?? []), adapter]);
  }
  const answered = new Map<string, AdapterOutcome>();
  await Promise.all(
    [...byHost.values()].map(async (group) => {
      const results = await pooled(group, MAX_CONCURRENT_PER_HOST, readOne);
      for (const result of results) answered.set(result.id, result);
    }),
  );
  const results = adapters.map((adapter) => answered.get(adapter.id)!);

  const failures = results.filter((result) => result.state !== "ok");
  if (failures.length === adapters.length) {
    const detail = `every adapter failed — ${failures
      .map((failure) => `${failure.id}: ${failure.error}`)
      .join("; ")}`;
    // Only a *structural* failure earns `parse_error`. A source that could not
    // be reached is a network error, which is what §6's two branches are for.
    throw failures.some((failure) => failure.state === "parse_error")
      ? new ParseError(detail)
      : new Error(detail);
  }
  return { items: results.flatMap((result) => result.items), adapters: results };
}

const PLANS: Partial<Record<Source, (deps: SyncDeps) => Promise<PlanResult>>> = {
  canvas: syncCanvas,
  gradescope: syncGradescope,
  prairielearn: syncPrairieLearn,
  prairietest: syncPrairieTest,
  smartphysics: syncSmartPhysics,
  site: syncSites,
};

/* -------------------------------------------------------------------------- */

/**
 * A source that is switched off or unconfigured, as opposed to one that broke.
 *
 * It has to be distinguishable from a failure at the `runSync` level: the
 * failure branch increments `consecutiveFailures` and arms §6's backoff ladder,
 * and neither belongs to a source nobody has configured — it would sit in a
 * 30-minute backoff for being turned off.
 */
export class SourceDisabled extends Error {}

/**
 * A source that was read and whose page *positively* says there is nothing for
 * this student — PrairieLearn's "no courses" home, smartPhysics with no
 * enrolment (roadmap I46).
 *
 * A sibling of `SourceDisabled`, never a subclass: the `instanceof` chain in
 * `syncOneSource` must keep them apart. `disabled` means nobody configured it
 * and printed "Off" beside a switch that was on; `empty` means the student did,
 * the read succeeded, and the answer is none. It arms no backoff, so joining a
 * course flips it to `ok` on the next poll with no click.
 */
export class SourceEmpty extends Error {}

/**
 * §6's ranking of the two failure kinds, worst last: a page that changed is
 * worse than a site having a bad afternoon (health.ts's `TROUBLE_RANK` orders
 * them the same way).
 */
function worstAdapterState(failed: readonly AdapterOutcome[]): "parse_error" | "network_error" {
  return failed.some((adapter) => adapter.state === "parse_error") ? "parse_error" : "network_error";
}

export async function syncOneSource(source: Source, deps: SyncDeps): Promise<SourceOutcome> {
  const plan = PLANS[source];
  if (!plan) return { source, state: "disabled", items: [], requests: 0 };

  const startedAt = Date.now();
  let requests = 0;
  const counting: SyncDeps = {
    ...deps,
    fetchPage: (url) => {
      requests += 1;
      return deps.fetchPage(url);
    },
  };

  const ms = () => Date.now() - startedAt;
  try {
    const { items, adapters, scope } = await plan(counting);
    const failed = adapters?.filter((adapter) => adapter.state !== "ok") ?? [];
    if (adapters && failed.length > 0) {
      // Some adapters answered and some did not: not `ok` (worker rule 2 — the
      // dot must not say every course site was read), and the answered rows go
      // through, for `applySync` to replace per adapter.
      return {
        source,
        state: worstAdapterState(failed),
        items,
        adapters,
        error:
          `${failed.length} of ${adapters.length} course sites failed — ` +
          failed.map((adapter) => `${adapter.id}: ${adapter.error}`).join("; "),
        requests,
        ms: ms(),
      };
    }
    return {
      source,
      state: "ok",
      items,
      ...(adapters ? { adapters } : {}),
      ...(scope ? { scope } : {}),
      requests,
      ms: ms(),
    };
  } catch (err) {
    if (err instanceof SourceDisabled) {
      return { source, state: "disabled", items: [], error: err.message, requests, ms: ms() };
    }
    if (err instanceof SourceEmpty) {
      return { source, state: "empty", items: [], error: err.message, requests, ms: ms() };
    }
    if (err instanceof NeedsLogin) {
      // `page.url` — what we asked for — rather than `finalUrl`, which is
      // wherever the SSO bounced to. Opening the request URL signs the student
      // in *and* lands them on the page they were missing.
      return {
        source,
        state: "needs_login",
        items: [],
        error: err.message,
        loginUrl: err.page.url,
        requests,
        ms: ms(),
      };
    }
    // §6 distinguishes these: a ParseError or a 404 means the page changed and
    // the user should see a red dot; anything else is treated as a network
    // problem, which is the recoverable one. One rule for every source and every
    // adapter (`adapterFailureKind`), so the two cannot drift apart again.
    const message = err instanceof Error ? err.message : String(err);
    return {
      source,
      state: adapterFailureKind(err) === "parse" ? "parse_error" : "network_error",
      items: [],
      error: message,
      requests,
      ms: ms(),
    };
  }
}

/**
 * The key prefix for everything one source contributed.
 *
 * One function, because the prefix rule is a decision and it now has three
 * callers. The colon is **unreachable defence today and stays anyway**: no
 * current source name is a prefix of another (`prairielearn` and `prairietest`
 * share only "prairie"), so removing it changes nothing and no test can catch
 * that — a mutation confirmed it. It stays because the next source added is one
 * `site` / `site2` away from silently taking another source's rows with it, and
 * because house rule 6 is exactly this: match markers exactly, never by
 * substring.
 */
export function sourcePrefix(source: Source): string {
  return `${source}:`;
}

/** And for one course-site adapter: `site:cs424-fa26:`. */
export function adapterPrefix(adapterId: string): string {
  return `site:${adapterId}:`;
}

/**
 * The store with every row under `prefix` removed, and the list rebuilt.
 *
 * Called the moment a switch is flipped, not on the next sync. The loop applies
 * the same rule, but the next loop is up to a poll interval away — so without
 * this, Settings says "Off" and the calendar keeps showing that source's work
 * for half an hour, which is the contradiction this whole change is about.
 *
 * Returns the store unchanged when there was nothing to drop, so a caller can
 * skip a write.
 */
export function withoutRows(store: StoreV1Plus, prefix: string): StoreV1Plus {
  const raw = { ...store.raw };
  let dropped = 0;
  for (const key of Object.keys(raw)) {
    if (key.startsWith(prefix)) {
      delete raw[key];
      dropped += 1;
    }
  }
  if (dropped === 0) return store;
  return {
    ...store,
    raw,
    // The student's own rows are not under any source's prefix and must survive
    // a source being switched off — but they are not in `raw` either, so
    // rebuilding the list from `raw` alone would drop every one of them until
    // the next sync happened to put them back.
    items: dedupe(dedupeInput(raw, store.manualItems), store.overrides, {
      previous: store.items,
    }),
  };
}

export interface SyncResult {
  store: StoreV1Plus;
  outcomes: SourceOutcome[];
  skipped: boolean;
}

/**
 * What this sync is going to do, decided in one short read of the store.
 *
 * §6's loop used to be one function that loaded the store, fetched everything
 * and wrote the result — and the worker ran the whole of it inside one hold of
 * the store queue. With the queue strictly exclusive (`core/queue.ts`) that
 * would make every click in the extension wait behind the network; with the
 * queue re-entrant, which is how it was, it did something worse: a hide or a
 * tick that landed during the fetches ran unqueued and was then overwritten by
 * the sync's own `saveStore` of a store loaded before the click.
 *
 * So the loop is three pieces: a **plan** made in a short hold, the **fetches**
 * with no hold at all, and an **apply** in a second short hold over a store
 * that has just been loaded again. Anything the student did while the fetches
 * were in flight is in that store, and the results are merged onto it.
 */
export interface SyncPlan {
  trigger: SyncTrigger;
  /** When the plan was made; `applySync` is given its own, later instant. */
  at: string;
  /** §6's popup debounce: this sync is a no-op and nothing may be written. */
  skipped: boolean;
  /** The sources to read now, in `PLANS` order. */
  attempt: Source[];
  /** Enabled but resting in §6's ladder — reported without being read. */
  resting: Source[];
}

/**
 * Whether this trigger is a person asking, which §6's ladder gives way to.
 *
 * "manual" is Sync now and the per-source retry. "recheck" is a page finishing
 * on a source's own site while that source is waiting on a login — evidence
 * about *that* source, and the commonest reason a failing source is worth
 * asking again. Neither an alarm nor a popup opening is a person asking.
 */
/** When a held PrairieTest row stops being something its page would still list. */
function heldUntil(item: RawItem): number | undefined {
  const raw = item.kind === "booking" ? item.extra?.["windowEnd"] : item.dueAt;
  if (raw === undefined) return undefined;
  const at = Date.parse(raw);
  return Number.isNaN(at) ? undefined : at;
}

/**
 * The earliest instant Canvas's planner still lists, read off the very URL the
 * loop fetches (`canvas.plannerUrl`), so the guard and the fetch cannot
 * disagree about the window (mutation rule 3).
 *
 * `start_date` is a bare date; UTC midnight of it is the earliest edge any
 * interpretation of that date can have (America/Chicago's midnight is later),
 * so a row due before it is off the page whichever way Canvas reads it.
 * `undefined` when the URL no longer carries one — then nothing is judged gone.
 */
function canvasPlannerStart(at: number): number | undefined {
  const date = /[?&]start_date=(\d{4}-\d{2}-\d{2})(?:&|$)/.exec(canvas.plannerUrl(new Date(at)))?.[1];
  return date === undefined ? undefined : Date.parse(`${date}T00:00:00Z`);
}

/**
 * Per source: would its page still list this held row, now?
 *
 * The N→0 guard below asks this of every row a source held. A source with no
 * entry keeps past work on its page (Gradescope, a course site), so for it
 * every row is still listed and any N→0 trips the guard.
 *
 * - **PrairieTest** lists only upcoming reservations and *open* booking
 *   windows — its own empty sentence is "You don't have any upcoming
 *   reservations" — so an exam leaves once sat and a window once closed.
 * - **Canvas**'s planner is a window, now−7d..now+60d (SPEC §4.1). A row due
 *   before its trailing edge has left the page by design, so a term break
 *   read as "Canvas looks different" and never cleared (open-bugs 2). An
 *   undated row stays listed: planner rows are always dated, so an undated
 *   one is the likelier story of a parser gone wrong.
 * - **PrairieLearn**'s rows belong to course instances, and the home page is
 *   the authority on which it lists. A row from an instance the home no longer
 *   lists — a closed term — has left the page; one from a listed instance has
 *   not. Without the scope (no home read), every row is still listed.
 */
type StillListed = (item: RawItem, at: number, scope: ReadonlySet<string> | undefined) => boolean;

const STILL_LISTED: Partial<Record<Source, StillListed>> = {
  prairietest: (item, at) => {
    const until = heldUntil(item);
    return until === undefined || until > at;
  },
  canvas: (item, at) => {
    const due = item.dueAt === undefined ? Number.NaN : Date.parse(item.dueAt);
    const start = canvasPlannerStart(at);
    if (Number.isNaN(due) || start === undefined) return true;
    return due >= start;
  },
  prairielearn: (item, _at, scope) =>
    scope === undefined || scope.has(item.sourceId.split(":")[0]!),
};

/**
 * The rows `source` held that its page should still be listing now — the
 * evidence behind the N→0 guard, and what the console names when it fires.
 */
export function stillExpected(
  source: Source,
  raw: Record<string, RawItem>,
  now: string,
  scope?: readonly string[],
): RawItem[] {
  // `sourcePrefix`, not a hand-spelled `${source}:` (open-bugs 20): one copy of
  // the prefix rule. Dropping the colon survives a mutation check — no source
  // name is a prefix of another today — which is the unreachable defence the
  // helper's own comment records, kept for the same reason.
  const held = Object.entries(raw)
    .filter(([key]) => key.startsWith(sourcePrefix(source)))
    .map(([, item]) => item);
  const listed = STILL_LISTED[source];
  if (!listed) return held;
  const at = Date.parse(now);
  const inScope = scope === undefined ? undefined : new Set(scope);
  return held.filter((item) => listed(item, at, inScope));
}

/**
 * Whether a source going from N items to 0 is the short-circuit the N→0 guard
 * exists for, rather than the page emptying the way it is meant to.
 *
 * Sushi, 2026-09-23: *"if prairietest doesnt show an exam cuz a student takes
 * an exam, it says unable to connect instead of connected."* One booked exam,
 * sat, gone from the page: 1→0, and the guard called it `parse_error`. It never
 * cleared either, because a failed sync keeps the old rows, so every later sync
 * was 1→0 again. Canvas over a term break was the same shape, and so was
 * PrairieLearn when a closed term's instance left the home in the same sync a
 * new instance with nothing published appeared.
 *
 * So 0 is expected once every row it held has left the page by that page's own
 * rule (`STILL_LISTED`). One row the page should still list, or one with no
 * time to judge by, and the guard still fires — a parser returning nothing is
 * the likelier story.
 */
export function vanishedUnexpectedly(
  source: Source,
  raw: Record<string, RawItem>,
  now: string,
  scope?: readonly string[],
): boolean {
  return stillExpected(source, raw, now, scope).length > 0;
}

function overridesBackoff(trigger: SyncTrigger): boolean {
  return trigger === "manual" || trigger === "recheck";
}

export function planSync(store: StoreV1Plus, trigger: SyncTrigger, now: string): SyncPlan {
  const plan: SyncPlan = { trigger, at: now, skipped: false, attempt: [], resting: [] };

  if (
    trigger === "popup" &&
    store.lastSyncAt !== undefined &&
    Date.parse(now) - Date.parse(store.lastSyncAt) < POPUP_DEBOUNCE_MS
  ) {
    return { ...plan, skipped: true };
  }

  for (const source of Object.keys(PLANS) as Source[]) {
    // Switched off in Settings: not attempted, and `applySync` drops its rows.
    if (!store.sources[source].enabled) continue;
    /*
     * §6's backoff exists to stop a *scheduled* loop hammering a site that is
     * failing. A person pressing "Sync now" is not that loop, and the commonest
     * reason to press it is having just fixed the thing that failed — logging
     * back in. Making them wait out a 30-minute ladder would ignore the user and
     * leave a stale error on screen with no way to refresh it.
     */
    if (overridesBackoff(trigger) || !inBackoff(store, source, now)) plan.attempt.push(source);
    else plan.resting.push(source);
  }
  return plan;
}

/**
 * Every source the plan named, read with **no hold on the store**.
 *
 * They all start before any of them is awaited, so the sync takes the slowest
 * source rather than the sum of them: with a 20s request timeout and six
 * sources, one site that hangs used to delay every other one behind it, and
 * since the store is written once at the end the screen showed the pre-sync
 * answer for all of it ("I signed in and it still says not connected").
 *
 * Safe because the fetches were already concurrent one level down —
 * `MAX_CONCURRENT_PER_HOST` runs four requests per source at a time. Different
 * sources are different hosts, so nothing here shares a rate limit either. The
 * results are returned in `PLANS` order, so the store this produces does not
 * depend on which site answered first.
 */
export async function fetchSync(plan: SyncPlan, deps: SyncDeps): Promise<SourceOutcome[]> {
  const attempts = plan.attempt.map((source) => syncOneSource(source, deps));
  const outcomes: SourceOutcome[] = [];
  for (const attempt of attempts) outcomes.push(await attempt);
  return outcomes;
}

/**
 * §6's loop, applied to a store that was loaded **after** the fetches finished.
 *
 * The load-bearing property is that raw items are replaced **per source**: a
 * Gradescope outage must not wipe Canvas's items, and a source that fails keeps
 * whatever it last returned so the list does not silently shrink.
 *
 * Pure, and given the store rather than loading one, so the worker can hand it
 * a fresh copy — which is what makes a click that landed during the fetches
 * survive the sync that was running when it was made.
 */
export function applySync(
  store: StoreV1Plus,
  plan: SyncPlan,
  outcomes: readonly SourceOutcome[],
  now: string,
): SyncResult {
  const next: StoreV1Plus = {
    ...store,
    sources: { ...store.sources },
    backoffUntil: { ...store.backoffUntil },
  };
  const applied: SourceOutcome[] = [];
  const fetched = new Map(outcomes.map((outcome) => [outcome.source, outcome]));
  const raw = { ...store.raw };
  const seenThisSync = new Set<string>();

  const keysOf = (source: Source) =>
    Object.keys(raw).filter((key) => key.startsWith(sourcePrefix(source)));

  /**
   * A source nobody is reading contributes no rows.
   *
   * This is the third branch the disabled cases needed and never had. Keeping
   * them looked like caution — "do not delete history the user may re-enable" —
   * and it is the opposite: a row on the calendar is a claim that some source
   * *currently* reports this deadline, and a source that is switched off
   * reports nothing. The rows could never update, never go stale (`staleNotice`
   * skips `disabled`), and never be corrected. Settings said "Off" while the
   * list still showed its work.
   *
   * Nothing is lost that was not already going to be refetched: switching a
   * source back on triggers a sync, which is where those rows come from.
   */
  const dropItemsOf = (source: Source) => {
    for (const key of keysOf(source)) delete raw[key];
  };

  for (const source of Object.keys(PLANS) as Source[]) {
    // The *fresh* store's switch, never the plan's copy of it: a source the
    // student turned off while the fetches were in flight is off, and an
    // outcome fetched before that click must not put its rows back.
    const status = next.sources[source];
    if (!status.enabled) {
      dropItemsOf(source);
      continue;
    }

    const outcome = fetched.get(source);
    if (!outcome) {
      /*
       * Nothing was read for this source. Either it is resting in §6's ladder,
       * or it was switched on while the fetches were in flight — and in both
       * cases the honest thing is to write nothing about it (worker rule 2).
       * Its previous keys count as seen, or §5.4 would purge undated items
       * belonging to a source that is about to be read again.
       */
      if (plan.resting.includes(source)) {
        // Resting, not off: it reports the state that put it there, with no
        // attempt behind this row.
        applied.push({ source, state: status.state, items: [], requests: 0 });
      }
      for (const key of keysOf(source)) seenThisSync.add(key);
      continue;
    }

    /*
     * §0 rule 3 at the loop level. A source that held items and now reports none
     * has more likely short-circuited than emptied — Gradescope's dashboard
     * guard, for instance, passes if *any* term has courses while its only
     * consumer reads the current term alone. The `ok` branch below would delete
     * every key for this source and leave a green dot over the gap, and it
     * happens before §5.4, so the 3-miss grace never applies.
     *
     * Keyed on N→0 rather than on emptiness, so Canvas's legitimately empty
     * planner (0→0 on this account) stays green.
     */
    let result: SourceOutcome = outcome;
    const heldBefore = keysOf(source).length;
    if (outcome.state === "ok" && outcome.items.length === 0 && heldBefore > 0) {
      const expected = stillExpected(source, raw, now, outcome.scope);
      if (expected.length > 0) {
        const named = expected
          .slice(0, 3)
          .map((item) => `${JSON.stringify(item.title)}${item.dueAt ? ` (due ${item.dueAt})` : ""}`)
          .join(", ");
        const more = expected.length > 3 ? `, +${expected.length - 3} more` : "";
        result = {
          ...outcome,
          state: "parse_error",
          error: `${source}: 0 items where it previously had some — still expected ${named}${more}`,
        };
        console.warn(`[sync] ${result.error}`);
      } else {
        // The other branch (worker rule 5): 0 accepted, and why.
        console.log(
          `[sync] ${source}: 0 items after ${heldBefore} — every held row has left the page by its own rule`,
        );
      }
    }
    applied.push(result);

    // Neither branch below fits: the success branch would claim `ok`, and the
    // failure branch would count a failure and arm a backoff against a source
    // that is merely unconfigured. The rows go, though — nothing is reading
    // them, which is the whole meaning of this state.
    if (result.state === "disabled") {
      dropItemsOf(source);
      next.sources[source] = {
        ...status,
        state: "disabled",
        lastAttemptAt: plan.at,
        lastError: result.error,
        consecutiveFailures: 0,
      };
      delete next.backoffUntil[source];
      continue;
    }

    /*
     * Read fine, and the page itself says there is nothing for this student
     * (roadmap I46). Not the failure branch — nothing failed, so no failure is
     * counted and no backoff armed, and the next poll reads it again — and not
     * `ok` either, which would claim something was read.
     *
     * The rows go: the page says there is nothing, and keeping them would be a
     * claim it does not make. Logged when there were any, because a false
     * empty deletes rows and has to be diagnosable from the console.
     * `lastSuccessAt` is stamped because the fetch and the read *did* succeed.
     */
    if (result.state === "empty") {
      const held = keysOf(source).length;
      dropItemsOf(source);
      if (held > 0) console.log(`[sync] ${source}: empty — dropped ${held} row(s) it previously held`);
      next.sources[source] = {
        ...status,
        state: "empty",
        lastAttemptAt: plan.at,
        lastSuccessAt: now,
        lastError: result.error,
        loginUrl: undefined,
        consecutiveFailures: 0,
      };
      delete next.backoffUntil[source];
      continue;
    }

    /*
     * Some course sites answered and some did not (roadmap I47). Rows are
     * replaced per adapter: an answered adapter's rows are this sync's, a failed
     * adapter's previous rows stay and count as seen — the failing-source rule,
     * one adapter down. Rows under `site:` that belong to neither (an adapter
     * no longer enabled) go, as the ok branch has always done.
     *
     * The source is a failure, since not everything was read: the worst
     * adapter's kind, with `lastError` naming each failed adapter and how many
     * of its rows are being kept, and §6's ladder as for any failure.
     */
    const failedAdapters = result.adapters?.filter((adapter) => adapter.state !== "ok") ?? [];
    if (result.state !== "ok" && failedAdapters.length > 0) {
      const kept = new Map<string, number>();
      for (const key of keysOf(source)) {
        const owner = failedAdapters.find((adapter) => key.startsWith(adapterPrefix(adapter.id)));
        if (owner) {
          seenThisSync.add(key);
          kept.set(owner.id, (kept.get(owner.id) ?? 0) + 1);
        } else {
          delete raw[key];
        }
      }
      for (const item of result.items) {
        const key = memberKey(item.source, item.sourceId);
        raw[key] = item;
        seenThisSync.add(key);
      }
      for (const adapter of result.adapters ?? []) {
        if (adapter.state === "ok") {
          console.log(`[sync] ${source}: ${adapter.id} answered — ${adapter.items.length} row(s) replaced`);
        } else {
          console.warn(
            `[sync] ${source}: ${adapter.id} failed (${adapter.state}) — kept ${kept.get(adapter.id) ?? 0} row(s) from its last read`,
          );
        }
      }
      const failures = status.consecutiveFailures + 1;
      next.sources[source] = {
        ...status,
        state: result.state,
        lastAttemptAt: plan.at,
        lastError:
          `${failedAdapters.length} of ${result.adapters!.length} course sites failed — ` +
          failedAdapters
            .map(
              (adapter) =>
                `${adapter.id}: ${adapter.error} (kept ${kept.get(adapter.id) ?? 0} row(s))`,
            )
            .join("; "),
        loginUrl: undefined,
        consecutiveFailures: failures,
      };
      next.backoffUntil[source] = nextAttemptAt(failures, now);
      continue;
    }

    if (result.state === "ok") {
      // Atomic per source (§6): drop this source's old keys, then add the new.
      dropItemsOf(source);
      for (const item of result.items) {
        const key = memberKey(item.source, item.sourceId);
        raw[key] = item;
        seenThisSync.add(key);
      }
      next.sources[source] = {
        ...status,
        state: "ok",
        // The attempt's start, not the apply: a sign-in that finished during
        // the fetches is newer than this attempt, and `sourcesToRecheck` must
        // see it that way (open-bugs 3). `lastSuccessAt` is the write instant.
        lastAttemptAt: plan.at,
        lastSuccessAt: now,
        lastError: undefined,
        consecutiveFailures: 0,
      };
      delete next.backoffUntil[source];
    } else {
      const failures = status.consecutiveFailures + 1;
      next.sources[source] = {
        ...status,
        state: result.state,
        lastAttemptAt: plan.at,
        lastError: result.error,
        // Cleared, not merged, when this attempt was not a logout: a stale URL
        // from a previous 401 would offer "Sign in" over a network error.
        loginUrl: result.loginUrl,
        consecutiveFailures: failures,
      };
      next.backoffUntil[source] = nextAttemptAt(failures, now);
      // A failing source keeps its previous items rather than going blank, and
      // they count as seen so §5.4 does not purge them out from under it. This
      // is the case the "keep the rows" argument is actually for: a transient
      // failure, where the source is still being read and will answer again.
      for (const key of keysOf(source)) seenThisSync.add(key);
    }
  }

  const retained = applyRetention(raw, seenThisSync, next.misses, next.overrides, now);
  next.raw = retained.raw;
  next.misses = retained.misses;
  next.overrides = retained.overrides;
  /*
   * The student's typed rows join the fetched ones here, and nowhere earlier.
   *
   * Not in `raw`, because `raw` is what this loop replaces per source and what
   * §5.4 prunes: `seenThisSync` is only filled from the `PLANS` loops above, so
   * an undated manual row would be absent from three consecutive syncs — by
   * construction, since nothing fetches it — and `applyRetention` would delete
   * it on the third, along with its hide and its tick. `PLANS` has no `manual`
   * entry for the same reason: there is nothing to fetch.
   */
  next.items = dedupe(dedupeInput(retained.raw, next.manualItems), retained.overrides, {
    previous: store.items,
  });
  next.lastSyncAt = now;

  return { store: next, outcomes: applied, skipped: false };
}

/**
 * §6's loop over one store: plan, fetch, apply.
 *
 * The composition, for callers with no queue to hold — the tests, and anything
 * that is not the service worker. The worker runs the three pieces itself, so
 * that the store it applies onto is loaded **after** the fetches
 * (`src/background.ts`, `sync`).
 */
export async function runSync(
  store: StoreV1Plus,
  trigger: SyncTrigger,
  deps: SyncDeps,
): Promise<SyncResult> {
  const plan = planSync(store, trigger, deps.now());
  if (plan.skipped) return { store, outcomes: [], skipped: true };
  const outcomes = await fetchSync(plan, deps);
  return applySync(store, plan, outcomes, deps.now());
}

/**
 * One queued sync: a short hold to plan, the fetches with no hold, a short hold
 * to apply — and the apply reads the store **again**.
 *
 * This is the whole of worker rule 4's fix, and it is here rather than in
 * `background.ts` because the worker is the file the suite cannot reach
 * (worker rule 1) — which is exactly where the lost click lived. The load
 * inside the second hold is the load-bearing line: a hide, a tick, a rename or
 * an accepted suggestion that was queued while the fetches were in flight has
 * already been written by then, so it is in `fresh`, and `applySync` merges
 * this sync's rows onto it instead of over it.
 */
export interface QueuedSyncIo {
  /** The store queue. Every hold here is short, and none of them nests. */
  withStore: StoreQueue;
  load(): Promise<StoreV1Plus>;
  save(store: StoreV1Plus): Promise<void>;
  /**
   * Inside the planning hold, with the store the plan was made from.
   *
   * §4.1's term filter needs `keptCourses` before the fetches start, and it is
   * read here rather than loaded again mid-fetch so that the whole run sees one
   * consistent answer.
   */
  onPlanned?(store: StoreV1Plus, plan: SyncPlan): void;
  /** Inside the apply hold, on the freshly loaded store, before it is written. */
  beforeSave?(store: StoreV1Plus): void;
}

export async function syncOnce(
  trigger: SyncTrigger,
  deps: SyncDeps,
  io: QueuedSyncIo,
): Promise<SyncResult> {
  const planned = await io.withStore(async () => {
    const store = await io.load();
    const plan = planSync(store, trigger, deps.now());
    io.onPlanned?.(store, plan);
    return { store, plan };
  }, "sync: plan");

  if (planned.plan.skipped) return { store: planned.store, outcomes: [], skipped: true };

  // Outside every hold: this is seconds of network, and a click must not wait
  // behind it — nor be overwritten by it.
  const outcomes = await fetchSync(planned.plan, deps);

  return io.withStore(async () => {
    const fresh = await io.load();
    io.beforeSave?.(fresh);
    const result = applySync(fresh, planned.plan, outcomes, deps.now());
    await io.save(result.store);
    return result;
  }, "sync: apply");
}

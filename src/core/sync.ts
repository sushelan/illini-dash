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
import { inBackoff, nextAttemptAt, type StoreV1Plus } from "./store.js";
import * as canvas from "../sources/canvas.js";
import * as gradescope from "../sources/gradescope.js";
import * as prairielearn from "../sources/prairielearn.js";
import * as prairietest from "../sources/prairietest.js";
import { ParseError, memberKey, type PageCtx, type RawItem, type Source } from "../sources/types.js";

/** §4: 20 s per request, at most 4 concurrent per host. */
export const REQUEST_TIMEOUT_MS = 20_000;
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
  now(): string;
}

export type SyncTrigger = "alarm" | "popup" | "install" | "manual";

export interface SourceOutcome {
  source: Source;
  state: "ok" | "needs_login" | "parse_error" | "network_error" | "disabled";
  items: RawItem[];
  error?: string;
  requests: number;
}

/** Raised when a fetch lands on a login page, so §6 reports needs_login. */
class NeedsLogin extends Error {
  override readonly name = "NeedsLogin";
}

/** §4: at most 4 concurrent requests per host. */
async function fetchAll(
  urls: string[],
  deps: SyncDeps,
  isLoginResponse: (status: number, finalUrl: string, body: string) => boolean,
): Promise<FetchedPage[]> {
  const results: FetchedPage[] = [];
  for (let i = 0; i < urls.length; i += MAX_CONCURRENT_PER_HOST) {
    const batch = urls.slice(i, i + MAX_CONCURRENT_PER_HOST);
    const pages = await Promise.all(batch.map((url) => deps.fetchPage(url)));
    for (const page of pages) {
      // Checked before parsing, or a session expiry surfaces as parse_error and
      // §6 backs off instead of telling the student to log in (§0 rule 2).
      if (isLoginResponse(page.status, page.finalUrl, page.body)) throw new NeedsLogin(page.url);
      results.push(page);
    }
  }
  return results;
}

/* -------------------------------------------------------------------------- */
/* Per-source plans                                                            */
/* -------------------------------------------------------------------------- */

async function syncCanvas(deps: SyncDeps): Promise<RawItem[]> {
  const fetchedAt = deps.now();
  const coursesPage = await deps.fetchPage(canvas.coursesUrl());
  if (canvas.isLoginResponse(coursesPage.status, coursesPage.finalUrl, coursesPage.body)) {
    throw new NeedsLogin(coursesPage.url);
  }
  const courses = canvas.courseMap(canvas.parseCourses(coursesPage.body));

  const plannerPage = await deps.fetchPage(canvas.plannerUrl(new Date(fetchedAt)));
  if (canvas.isLoginResponse(plannerPage.status, plannerPage.finalUrl, plannerPage.body)) {
    throw new NeedsLogin(plannerPage.url);
  }
  return canvas.parsePlannerItems(plannerPage.body, courses, {
    url: plannerPage.finalUrl,
    fetchedAt,
  });
}

async function syncGradescope(deps: SyncDeps): Promise<RawItem[]> {
  const fetchedAt = deps.now();
  const dashboard = await deps.fetchPage(`${gradescope.GRADESCOPE_ORIGIN}/`);
  if (gradescope.isLoginResponse(dashboard.status, dashboard.finalUrl, dashboard.body)) {
    throw new NeedsLogin(dashboard.url);
  }

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
  return items;
}


async function syncPrairieLearn(deps: SyncDeps): Promise<RawItem[]> {
  const fetchedAt = deps.now();
  const home = await deps.fetchPage(`${prairielearn.PRAIRIELEARN_ORIGIN}/pl/`);
  if (prairielearn.isLoginResponse(home.status, home.finalUrl, home.body)) {
    throw new NeedsLogin(home.url);
  }

  // §4.3 step 1: the student home lists course instances.
  const instanceIds = [...home.body.matchAll(/\/pl\/course_instance\/(\d+)/g)]
    .map((match) => match[1]!)
    .filter((id, index, all) => all.indexOf(id) === index);
  if (instanceIds.length === 0) {
    throw new ParseError("prairielearn: no course instances on the student home page");
  }

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
  return items;
}

async function syncPrairieTest(deps: SyncDeps): Promise<RawItem[]> {
  const fetchedAt = deps.now();
  const home = await deps.fetchPage(`${prairietest.PRAIRIETEST_ORIGIN}/pt/`);
  if (prairietest.isLoginResponse(home.status, home.finalUrl, home.body)) {
    throw new NeedsLogin(home.url);
  }
  return deps.parseHtml("prairietest", home.body, { url: home.finalUrl, fetchedAt });
}

const PLANS: Partial<Record<Source, (deps: SyncDeps) => Promise<RawItem[]>>> = {
  canvas: syncCanvas,
  gradescope: syncGradescope,
  prairielearn: syncPrairieLearn,
  prairietest: syncPrairieTest,
};

/* -------------------------------------------------------------------------- */

export async function syncOneSource(source: Source, deps: SyncDeps): Promise<SourceOutcome> {
  const plan = PLANS[source];
  if (!plan) return { source, state: "disabled", items: [], requests: 0 };

  let requests = 0;
  const counting: SyncDeps = {
    ...deps,
    fetchPage: (url) => {
      requests += 1;
      return deps.fetchPage(url);
    },
  };

  try {
    return { source, state: "ok", items: await plan(counting), requests };
  } catch (err) {
    if (err instanceof NeedsLogin) {
      return { source, state: "needs_login", items: [], error: "session expired", requests };
    }
    // §6 distinguishes these: a ParseError means the page changed and the user
    // should see a red dot; anything else is treated as a network problem, which
    // is the recoverable one.
    const message = err instanceof Error ? err.message : String(err);
    return {
      source,
      state: err instanceof ParseError ? "parse_error" : "network_error",
      items: [],
      error: message,
      requests,
    };
  }
}

export interface SyncResult {
  store: StoreV1Plus;
  outcomes: SourceOutcome[];
  skipped: boolean;
}

/**
 * §6's loop.
 *
 * The load-bearing property is that raw items are replaced **per source**: a
 * Gradescope outage must not wipe Canvas's items, and a source that fails keeps
 * whatever it last returned so the list does not silently shrink.
 */
export async function runSync(
  store: StoreV1Plus,
  trigger: SyncTrigger,
  deps: SyncDeps,
): Promise<SyncResult> {
  const now = deps.now();

  if (
    trigger === "popup" &&
    store.lastSyncAt !== undefined &&
    Date.parse(now) - Date.parse(store.lastSyncAt) < POPUP_DEBOUNCE_MS
  ) {
    return { store, outcomes: [], skipped: true };
  }

  const next: StoreV1Plus = {
    ...store,
    sources: { ...store.sources },
    backoffUntil: { ...store.backoffUntil },
  };
  const outcomes: SourceOutcome[] = [];
  const raw = { ...store.raw };
  const seenThisSync = new Set<string>();

  for (const source of Object.keys(PLANS) as Source[]) {
    const status = next.sources[source];
    if (!status.enabled) {
      // Its items stay in `raw` deliberately: disabling a source in the options
      // page should not delete history the user may re-enable.
      continue;
    }
    if (inBackoff(next, source, now)) {
      outcomes.push({ source, state: status.state, items: [], requests: 0 });
      // Its previous keys count as seen, or §5.4 would purge undated items
      // belonging to a source that is merely resting.
      for (const key of Object.keys(raw)) if (key.startsWith(`${source}:`)) seenThisSync.add(key);
      continue;
    }

    const outcome = await syncOneSource(source, deps);
    outcomes.push(outcome);

    if (outcome.state === "ok") {
      // Atomic per source (§6): drop this source's old keys, then add the new.
      for (const key of Object.keys(raw)) if (key.startsWith(`${source}:`)) delete raw[key];
      for (const item of outcome.items) {
        const key = memberKey(item.source, item.sourceId);
        raw[key] = item;
        seenThisSync.add(key);
      }
      next.sources[source] = {
        ...status,
        state: "ok",
        lastAttemptAt: now,
        lastSuccessAt: now,
        lastError: undefined,
        consecutiveFailures: 0,
      };
      delete next.backoffUntil[source];
    } else {
      const failures = status.consecutiveFailures + 1;
      next.sources[source] = {
        ...status,
        state: outcome.state,
        lastAttemptAt: now,
        lastError: outcome.error,
        consecutiveFailures: failures,
      };
      next.backoffUntil[source] = nextAttemptAt(failures, now);
      // A failing source keeps its previous items rather than going blank, and
      // they count as seen so §5.4 does not purge them out from under it.
      for (const key of Object.keys(raw)) if (key.startsWith(`${source}:`)) seenThisSync.add(key);
    }
  }

  const retained = applyRetention(raw, seenThisSync, next.misses, next.overrides, now);
  next.raw = retained.raw;
  next.misses = retained.misses;
  next.overrides = retained.overrides;
  next.items = dedupe(Object.values(retained.raw), retained.overrides, { previous: store.items });
  next.lastSyncAt = now;

  return { store: next, outcomes, skipped: false };
}

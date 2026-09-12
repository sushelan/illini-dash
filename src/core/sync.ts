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
import { looksLoggedOut } from "./parsing.js";
import { inBackoff, nextAttemptAt, type StoreV1Plus } from "./store.js";
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
  now(): string;
}

export type SyncTrigger = "alarm" | "popup" | "install" | "manual";

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
   * `continue`s, so a `pending` outcome never reaches the ok / disabled /
   * failure branches below and cannot be mistaken for a failed attempt.
   */
  state: SourceState;
  items: RawItem[];
  error?: string;
  requests: number;
  /** Only for `needs_login`, and only where the page is not a fixed login form. */
  loginUrl?: string;
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
 * A 4xx is treated as structural because the adapter is asking for a URL the
 * site will not serve — gone, moved, or never right. A 5xx is the site's
 * problem, not the adapter's.
 */
export function adapterFailureKind(err: unknown): "parse" | "network" {
  if (err instanceof ParseError) return "parse";
  if (err instanceof HttpStatusError) return err.status >= 400 && err.status < 500 ? "parse" : "network";
  return "network";
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
      if (isLoginResponse(page.status, page.finalUrl, page.body)) throw new NeedsLogin(page);
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
    throw new NeedsLogin(coursesPage);
  }

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

  const plannerPage = await deps.fetchPage(canvas.plannerUrl(new Date(fetchedAt)));
  if (canvas.isLoginResponse(plannerPage.status, plannerPage.finalUrl, plannerPage.body)) {
    throw new NeedsLogin(plannerPage);
  }
  const items = canvas.parsePlannerItems(plannerPage.body, courses, {
    url: plannerPage.finalUrl,
    fetchedAt,
  });
  if (held.size === 0) return items;
  return items.filter((item) => {
    const courseId = item.extra?.["canvasCourseId"];
    return courseId === undefined || !held.has(Number(courseId));
  });
}

async function syncGradescope(deps: SyncDeps): Promise<RawItem[]> {
  const fetchedAt = deps.now();
  const dashboard = await deps.fetchPage(`${gradescope.GRADESCOPE_ORIGIN}/`);
  if (gradescope.isLoginResponse(dashboard.status, dashboard.finalUrl, dashboard.body)) {
    throw new NeedsLogin(dashboard);
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
    throw new NeedsLogin(home);
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
    throw new NeedsLogin(home);
  }
  return deps.parseHtml("prairietest", home.body, { url: home.finalUrl, fetchedAt });
}

/**
 * smartPhysics, in two stages like Gradescope.
 *
 * Every course page is addressed by a per-student enrolment id, so the list has
 * to be discovered rather than configured — which is why this is a source and
 * not a §4.5 adapter.
 */
async function syncSmartPhysics(deps: SyncDeps): Promise<RawItem[]> {
  const fetchedAt = deps.now();
  const home = await deps.fetchPage(`${smartphysics.SMARTPHYSICS_ORIGIN}/`);
  if (smartphysics.isLoginResponse(home.status, home.finalUrl, home.body)) {
    throw new NeedsLogin(home);
  }

  const courses = await deps.parseSmartPhysicsCourses(home.body);
  const active = courses.filter((course) => course.active);
  if (active.length === 0) {
    // Not a ParseError. A student with no current PHYS 21x enrolment — most
    // students, most terms — has a legitimately empty active list, and calling
    // that a broken page would put a red dot on every non-physics tester.
    // Worker rule 2's third branch: report *that*, do not report `ok` with
    // nothing behind it either.
    throw new SourceDisabled(
      courses.length === 0
        ? "no smartPhysics enrolments"
        : `no active smartPhysics course (${courses.length} inactive)`,
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
  return items;
}

/**
 * §4.5: every enabled adapter, each isolated.
 *
 * One adapter's failure must not take the others down — that is the whole
 * reason course sites are adapters rather than a fifth hand-written parser —
 * so a throw is recorded against that adapter and the rest still run. The
 * source only fails outright when *every* adapter failed, which means the
 * runner or the registry is broken rather than one course's page.
 */
async function syncSites(deps: SyncDeps): Promise<RawItem[]> {
  const adapters = await deps.enabledAdapters();
  // Not `return []`. A source that fetched nothing because nothing is
  // configured is not a source that succeeded: reporting `ok` painted a green
  // dot over a course-site source with no adapter enabled, which is exactly the
  // silent-empty §0 rule 3 forbids. It cost a real user two rounds of
  // "why don't I see any WEB rows" — the dot said everything was fine.
  if (adapters.length === 0) throw new SourceDisabled("no course sites are enabled");

  const fetchedAt = deps.now();
  const items: RawItem[] = [];
  const failures: { id: string; message: string; kind: "parse" | "network" }[] = [];

  for (const adapter of adapters) {
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
      items.push(
        ...(await deps.runAdapter(adapter, page.body, { url: page.finalUrl, fetchedAt })),
      );
    } catch (err) {
      if (err instanceof NeedsLogin) throw err;
      const kind = adapterFailureKind(err);
      failures.push({
        id: adapter.id,
        message: err instanceof Error ? err.message : String(err),
        kind,
      });
      // The kind is in the line, so a recurrence is diagnosable from the console
      // without another trip to the browser (worker rule 5).
      console.warn(`[site] adapter ${adapter.id} failed (${kind}):`, err);
    }
  }

  if (failures.length === adapters.length) {
    const detail = `every adapter failed — ${failures
      .map((failure) => `${failure.id}: ${failure.message}`)
      .join("; ")}`;
    // Only a *structural* failure earns `parse_error`. A source that could not
    // be reached is a network error, which is what §6's two branches are for.
    throw failures.some((failure) => failure.kind === "parse")
      ? new ParseError(detail)
      : new Error(detail);
  }
  return items;
}

const PLANS: Partial<Record<Source, (deps: SyncDeps) => Promise<RawItem[]>>> = {
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
    if (err instanceof SourceDisabled) {
      return { source, state: "disabled", items: [], error: err.message, requests };
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
      };
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
    items: dedupe(Object.values(raw), store.overrides, { previous: store.items }),
  };
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
    const status = next.sources[source];
    if (!status.enabled) {
      // Switched off in Settings. Its rows go with it — see `dropItemsOf`.
      dropItemsOf(source);
      continue;
    }
    // §6's backoff exists to stop a *scheduled* loop hammering a site that is
    // failing. A person pressing "Sync now" is not that loop, and the commonest
    // reason to press it is having just fixed the thing that failed — logging
    // back in. Making them wait out a 30-minute ladder would ignore the user and
    // leave a stale error on screen with no way to refresh it.
    if (trigger !== "manual" && inBackoff(next, source, now)) {
      outcomes.push({ source, state: status.state, items: [], requests: 0 });
      // Resting, not off. Its previous keys count as seen, or §5.4 would purge
      // undated items belonging to a source that is about to be read again.
      for (const key of keysOf(source)) seenThisSync.add(key);
      continue;
    }

    const outcome = await syncOneSource(source, deps);

    // §0 rule 3 at the loop level. A source that held items and now reports none
    // has more likely short-circuited than emptied — Gradescope's dashboard
    // guard, for instance, passes if *any* term has courses while its only
    // consumer reads the current term alone. The `ok` branch below would delete
    // every key for this source and leave a green dot over the gap, and it
    // happens before §5.4, so the 3-miss grace never applies.
    //
    // Keyed on N→0 rather than on emptiness, so Canvas's legitimately empty
    // planner (0→0 on this account) stays green.
    if (
      outcome.state === "ok" &&
      outcome.items.length === 0 &&
      Object.keys(raw).some((key) => key.startsWith(`${source}:`))
    ) {
      outcome.state = "parse_error";
      outcome.error = `${source}: 0 items where it previously had some`;
    }
    outcomes.push(outcome);

    // Neither branch below fits: the success branch would claim `ok`, and the
    // failure branch would count a failure and arm a backoff against a source
    // that is merely unconfigured. The rows go, though — nothing is reading
    // them, which is the whole meaning of this state.
    if (outcome.state === "disabled") {
      dropItemsOf(source);
      next.sources[source] = {
        ...status,
        state: "disabled",
        lastAttemptAt: now,
        lastError: outcome.error,
        consecutiveFailures: 0,
      };
      delete next.backoffUntil[source];
      continue;
    }

    if (outcome.state === "ok") {
      // Atomic per source (§6): drop this source's old keys, then add the new.
      dropItemsOf(source);
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
        // Cleared, not merged, when this attempt was not a logout: a stale URL
        // from a previous 401 would offer "Sign in" over a network error.
        loginUrl: outcome.loginUrl,
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
  next.items = dedupe(Object.values(retained.raw), retained.overrides, { previous: store.items });
  next.lastSyncAt = now;

  return { store: next, outcomes, skipped: false };
}

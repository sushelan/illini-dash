/**
 * The sync loop (§6) and the store (§3, §5.4).
 *
 * Driven by the real fixtures through the real parsers, so this is close to an
 * end-to-end run of everything built so far: fetch → parse → normalize → dedupe
 * → store, with only the network and the offscreen boundary faked.
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import {
  backoffMinutes,
  emptyStore,
  inBackoff,
  migrate,
  nextAttemptAt,
  sourcesToRetryAfterUpdate,
  type StoreV1Plus,
} from "../src/core/store.js";
import { createStoreQueue } from "../src/core/queue.js";
import { coursesUrl } from "../src/sources/canvas.js";
import { ParseError } from "../src/sources/types.js";
import {
  POPUP_DEBOUNCE_MS,
  adapterFailureKind,
  adapterPrefix,
  planSync,
  runSync,
  sourcePrefix,
  syncOnce,
  withoutRows,
  syncOneSource,
  type SyncDeps,
} from "../src/core/sync.js";
import { currentTermCourses, parseCoursePage } from "../src/sources/gradescope.js";
import { parseAssessments } from "../src/sources/prairielearn.js";
import { parseHome } from "../src/sources/prairietest.js";
import { parseCourseList as parseSmartPhysicsCourseList } from "../src/sources/smartphysics.js";
import { runAdapter } from "../src/sources/site.js";
import type { PageCtx, RawItem, Source } from "../src/sources/types.js";

const fixture = (path: string) =>
  readFileSync(new URL(`../fixtures/${path}`, import.meta.url), "utf8");
const doc = (html: string) => parseHTML(html).document as unknown as Document;

const NOW = "2026-09-10T18:00:00.000Z";

/** The real pages, keyed by the URL the sync loop will ask for. */
const PAGES: Record<string, string> = {
  // Keyed off the real builder, so a change to the query cannot silently turn
  // every Canvas test into an "unexpected fetch" network error again.
  [coursesUrl()]:
    fixture("canvas/courses-active.json"),
  "https://canvas.illinois.edu/api/v1/planner/items?start_date=2026-09-03&end_date=2026-11-09&per_page=100":
    fixture("canvas/planner-items-SYNTHETIC.json"),
  "https://www.gradescope.com/": fixture("gradescope/dashboard.html"),
  "https://www.gradescope.com/courses/1352838": fixture("gradescope/course-1352838.html"),
  "https://us.prairielearn.com/pl/": fixture("prairielearn/assessments-cs357.html"),
  "https://us.prairielearn.com/pl/course_instance/224254/assessments":
    fixture("prairielearn/assessments-cs357.html"),
  "https://us.prairietest.com/pt/": fixture("prairietest/home-booked-and-available.html"),
};

function deps(overrides: Partial<SyncDeps> = {}): SyncDeps {
  return {
    keptCourses: () => new Set<string>(),
    reportSetAsideCourses: () => undefined,
    async parseSmartPhysicsCourses(html: string) {
      return parseSmartPhysicsCourseList(doc(html));
    },
    async fetchPage(url) {
      const body = PAGES[url];
      if (body === undefined) throw new Error(`unexpected fetch: ${url}`);
      return { url, finalUrl: url, status: 200, body };
    },
    async parseHtml(source: Source, html: string, page: PageCtx): Promise<RawItem[]> {
      if (source === "gradescope") return parseCoursePage(doc(html), page);
      if (source === "prairielearn") return parseAssessments(doc(html), page);
      if (source === "prairietest") return parseHome(doc(html), page);
      throw new Error(`no parser for ${source}`);
    },
    async parseGradescopeDashboard(html) {
      return currentTermCourses(doc(html));
    },
    async runAdapter(adapter, html, ctx) {
      return runAdapter(adapter, doc(html), ctx);
    },
    async enabledAdapters() {
      return [];
    },
    now: () => NOW,
    ...overrides,
  };
}

/**
 * Reported 2026-09-12: "there's a delay when I log into gradescope,
 * prairielearn and prairietest and on the sign in screen it says they're not
 * connected. It takes some time, maybe it gets hung."
 *
 * It was hung, in the sense that mattered: the loop awaited each source in
 * turn, so a sync cost the **sum** of its sources. With a 20-second request
 * timeout and six of them, one slow site delayed every source queued behind it,
 * and since the store is written once at the end the screen showed the pre-sync
 * answer for the whole wait.
 *
 * Timing is not asserted here — a wall-clock test would be flaky and would
 * measure the machine. What is asserted is the property that makes the timing
 * true: **every source has begun fetching before any of them has finished.**
 */
describe("the sync reads its sources at the same time, not one after another", () => {
  /** Resolves nothing until `release()` is called, recording who asked. */
  function gate() {
    const started: string[] = [];
    let release!: () => void;
    const open = new Promise<void>((resolve) => {
      release = resolve;
    });
    return {
      started,
      release: () => release(),
      async fetchPage(url: string) {
        started.push(url);
        await open;
        const body = PAGES[url];
        if (body === undefined) throw new Error(`unexpected fetch: ${url}`);
        return { url, finalUrl: url, status: 200, body };
      },
    };
  }

  it("has every source in flight before the first response arrives", async () => {
    const g = gate();
    const store = emptyStore();
    const running = runSync(store, "manual", deps({ fetchPage: g.fetchPage }));

    // Let every synchronously-reachable fetch be issued. Nothing can have
    // *completed*: the gate is still shut.
    await Promise.resolve();
    await Promise.resolve();

    const hosts = new Set(g.started.map((url) => new URL(url).hostname));
    // Four hosted sources reach the network on their first step; smartPhysics
    // is off by default and `site` has no adapters enabled here.
    expect(hosts, `only ${[...hosts].join(", ")} had started`).toEqual(
      new Set([
        "canvas.illinois.edu",
        "www.gradescope.com",
        "us.prairielearn.com",
        "us.prairietest.com",
      ]),
    );

    g.release();
    const { outcomes } = await running;
    // Applied in `PLANS` order regardless of which host answered first, so the
    // store this produces does not depend on the network's timing. `site` and
    // `smartphysics` are off by default and contribute no outcome.
    expect(outcomes.map((o) => o.source)).toEqual([
      "canvas",
      "gradescope",
      "prairielearn",
      "prairietest",
    ]);
  });

  it("does not start a source that is resting in backoff", async () => {
    // The decision of *whether* to read is still made before the fetch, so
    // starting them all does not quietly defeat §6's backoff.
    const g = gate();
    const store = emptyStore();
    store.backoffUntil.gradescope = "2026-09-10T19:00:00.000Z";
    const running = runSync(store, "alarm", deps({ fetchPage: g.fetchPage }));
    await Promise.resolve();
    await Promise.resolve();
    expect(g.started.some((url) => url.includes("gradescope"))).toBe(false);
    g.release();
    await running;
  });
});

describe("migrate (§3)", () => {
  it("fills an empty or junk store with defaults", () => {
    for (const junk of [undefined, null, 42, "x", {}]) {
      const store = migrate(junk);
      expect(store.schemaVersion).toBe(2);
      expect(store.settings.pollMinutes).toBe(30);
      // `manual` is a Source and so has a `SourceStatus` like the rest, even
      // though nothing is ever fetched for it — `isFetchedSource` is what keeps
      // it out of the health surfaces, not its absence from this map.
      expect(Object.keys(store.sources).sort()).toEqual([
        "canvas",
        "gradescope",
        "manual",
        "prairielearn",
        "prairietest",
        "site",
        "smartphysics",
      ]);
    }
  });

  it("keeps a user's overrides rather than resetting them", () => {
    // The failure that matters is not a future migration, it is a half-written
    // store: losing overrides to a missing key would be unrecoverable.
    const store = migrate({ overrides: { hiddenKeys: ["gradescope:1"] }, items: undefined });
    expect(store.overrides.hiddenKeys).toEqual(["gradescope:1"]);
    expect(store.overrides.splitKeys).toEqual([]);
  });

  it("clamps the poll interval to §8.2's range", () => {
    expect(migrate({ settings: { pollMinutes: 1 } }).settings.pollMinutes).toBe(15);
    expect(migrate({ settings: { pollMinutes: 9999 } }).settings.pollMinutes).toBe(120);
    expect(migrate({ settings: { pollMinutes: "junk" } }).settings.pollMinutes).toBe(30);
  });

  it("starts site adapters disabled, since they need a permission grant", () => {
    expect(emptyStore().sources.site.enabled).toBe(false);
    expect(emptyStore().sources.canvas.enabled).toBe(true);
  });
});

describe("backoff (§6)", () => {
  it("climbs 30m → 1h → 2h → 4h and caps", () => {
    expect([1, 2, 3, 4, 5, 99].map(backoffMinutes)).toEqual([30, 60, 120, 240, 240, 240]);
  });

  it("blocks a source until its window passes", () => {
    const store = emptyStore();
    store.backoffUntil.canvas = nextAttemptAt(1, NOW);
    expect(inBackoff(store, "canvas", NOW)).toBe(true);
    expect(inBackoff(store, "canvas", "2026-09-10T18:31:00.000Z")).toBe(false);
    expect(inBackoff(store, "gradescope", NOW)).toBe(false);
  });
});

describe("syncOneSource against the real fixtures", () => {
  it("reads Canvas courses and planner items", async () => {
    const outcome = await syncOneSource("canvas", deps());
    expect(outcome.state).toBe("ok");
    expect(outcome.items.length).toBeGreaterThan(0);
    expect(outcome.requests).toBe(2);
  });

  it("skips Gradescope courses the dashboard says have 0 assignments", async () => {
    const outcome = await syncOneSource("gradescope", deps());
    expect(outcome.state).toBe("ok");
    // The current term has two courses; CS425 reports "0 assignments", so only
    // PHYS435's page is fetched. 1 dashboard + 1 course page.
    expect(outcome.requests).toBe(2);
    expect(outcome.items.map((i) => i.title)).toEqual(["Homework 1", "Homework 2"]);
  });

  it("reads PrairieLearn and PrairieTest", async () => {
    expect((await syncOneSource("prairielearn", deps())).items).toHaveLength(14);
    const pt = await syncOneSource("prairietest", deps());
    expect(pt.items.map((i) => i.kind).sort()).toEqual(["booking", "exam"]);
  });

  it("reports a login landing as needs_login, not parse_error (§0 rule 2)", async () => {
    const outcome = await syncOneSource(
      "gradescope",
      deps({
        async fetchPage(url) {
          return { url, finalUrl: "https://www.gradescope.com/login", status: 200, body: "" };
        },
      }),
    );
    expect(outcome.state).toBe("needs_login");
  });

  it("reports a structural surprise as parse_error", async () => {
    const outcome = await syncOneSource(
      "prairietest",
      deps({
        async fetchPage(url) {
          return { url, finalUrl: url, status: 200, body: "<p>nothing here</p>" };
        },
      }),
    );
    expect(outcome.state).toBe("parse_error");
    expect(outcome.error).toMatch(/missing PrairieTest card/);
  });

  it("reports a thrown fetch as network_error", async () => {
    const outcome = await syncOneSource(
      "canvas",
      deps({
        async fetchPage() {
          throw new Error("net::ERR_INTERNET_DISCONNECTED");
        },
      }),
    );
    expect(outcome.state).toBe("network_error");
  });
});

describe("runSync (§6)", () => {
  it("collects every source into one deduped list", async () => {
    const { store, outcomes } = await runSync(emptyStore(), "alarm", deps());
    // `site` and `smartphysics` both start disabled — one needs a permission
    // grant (§4.5), the other serves PHYS 211–214 only — so neither is
    // attempted and neither reports an outcome.
    expect(outcomes.map((o) => o.state)).toEqual(["ok", "ok", "ok", "ok"]);
    expect(Object.keys(store.raw).length).toBeGreaterThan(20);
    expect(store.items.length).toBeGreaterThan(0);
    expect(store.lastSyncAt).toBe(NOW);
    for (const source of ["canvas", "gradescope", "prairielearn", "prairietest"] as const) {
      expect(store.sources[source].state, source).toBe("ok");
      expect(store.sources[source].lastSuccessAt, source).toBe(NOW);
    }
  });

  it("does not let one source's failure wipe another's items", async () => {
    // §6's load-bearing property. A Gradescope outage must not blank Canvas.
    const first = await runSync(emptyStore(), "alarm", deps());
    const gradescopeKeys = Object.keys(first.store.raw).filter((k) => k.startsWith("gradescope:"));
    expect(gradescopeKeys.length).toBeGreaterThan(0);

    const second = await runSync(
      first.store,
      "alarm",
      deps({
        async fetchPage(url) {
          if (url.includes("gradescope")) throw new Error("down");
          const body = PAGES[url];
          if (body === undefined) throw new Error(`unexpected fetch: ${url}`);
          return { url, finalUrl: url, status: 200, body };
        },
      }),
    );
    expect(second.store.sources.gradescope.state).toBe("network_error");
    expect(second.store.sources.canvas.state).toBe("ok");
    // Gradescope's items survive rather than the list silently shrinking.
    for (const key of gradescopeKeys) expect(Object.keys(second.store.raw)).toContain(key);
  });

  it("sets a backoff on failure and skips the source until it lifts", async () => {
    const failing = deps({
      async fetchPage() {
        throw new Error("down");
      },
    });
    const first = await runSync(emptyStore(), "alarm", failing);
    expect(first.store.sources.canvas.consecutiveFailures).toBe(1);
    expect(first.store.backoffUntil.canvas).toBe(nextAttemptAt(1, NOW));

    // Immediately after, every source is resting: no requests are made at all.
    let requests = 0;
    const second = await runSync(
      first.store,
      "alarm",
      deps({
        fetchPage: async (url) => {
          requests += 1;
          return { url, finalUrl: url, status: 200, body: PAGES[url] ?? "" };
        },
      }),
    );
    expect(requests).toBe(0);
    expect(second.outcomes.every((o) => o.requests === 0)).toBe(true);
  });

  it("lets a manual sync bypass backoff, since the user just fixed something", async () => {
    // The commonest reason to press "Sync now" is having just logged back in.
    // Skipping the source would ignore the user and leave a stale error on
    // screen with no way to refresh it.
    const failed = await runSync(
      emptyStore(),
      "alarm",
      deps({ async fetchPage() { throw new Error("down"); } }),
    );
    expect(failed.store.backoffUntil.canvas).toBeDefined();

    // Same instant, so the backoff has definitely not lapsed.
    const manual = await runSync(failed.store, "manual", deps());
    expect(manual.store.sources.canvas.state).toBe("ok");
    expect(manual.store.backoffUntil.canvas).toBeUndefined();

    // An alarm at the same instant still respects it.
    const alarm = await runSync(failed.store, "alarm", deps());
    expect(alarm.outcomes.every((o) => o.requests === 0)).toBe(true);
  });

  it("clears the backoff and the error once a source recovers", async () => {
    const failed = await runSync(
      emptyStore(),
      "alarm",
      deps({ async fetchPage() { throw new Error("down"); } }),
    );
    const later = "2026-09-10T22:00:00.000Z";
    const recovered = await runSync(failed.store, "alarm", deps({ now: () => later }));
    expect(recovered.store.sources.canvas.state).toBe("ok");
    expect(recovered.store.sources.canvas.consecutiveFailures).toBe(0);
    expect(recovered.store.sources.canvas.lastError).toBeUndefined();
    expect(recovered.store.backoffUntil.canvas).toBeUndefined();
  });

  it("debounces a popup-triggered sync inside 5 minutes (§6)", async () => {
    const first = await runSync(emptyStore(), "alarm", deps());
    const soon = new Date(Date.parse(NOW) + POPUP_DEBOUNCE_MS - 1000).toISOString();
    const skipped = await runSync(first.store, "popup", deps({ now: () => soon }));
    expect(skipped.skipped).toBe(true);
    expect(skipped.store).toBe(first.store);

    const later = new Date(Date.parse(NOW) + POPUP_DEBOUNCE_MS + 1000).toISOString();
    const ran = await runSync(first.store, "popup", deps({ now: () => later }));
    expect(ran.skipped).toBe(false);
    // An alarm is never debounced.
    expect((await runSync(first.store, "alarm", deps({ now: () => soon }))).skipped).toBe(false);
  });

  it("does not fetch a disabled source, and takes its rows with it", async () => {
    /*
     * Reported from a live run: Settings said "Course websites — Off" and the
     * CS 424 rows were still on the calendar.
     *
     * This test used to assert the opposite — "disabling a source must not
     * delete its history" — and it was pinning the defect rather than a
     * requirement (worker rule 6). A row on the calendar is a claim that some
     * source *currently* reports this deadline; a source that is switched off
     * reports nothing, and its rows could never update, never go stale
     * (`staleNotice` skips `disabled`) and never be corrected.
     *
     * Nothing is lost that was not going to be refetched anyway: switching a
     * source back on runs a sync, which is where the rows come from.
     */
    const first = await runSync(emptyStore(), "alarm", deps());
    const before = Object.keys(first.store.raw).filter((k) => k.startsWith("prairietest:"));
    expect(before.length).toBeGreaterThan(0);

    const store: StoreV1Plus = {
      ...first.store,
      sources: {
        ...first.store.sources,
        prairietest: { ...first.store.sources.prairietest, enabled: false },
      },
    };
    const second = await runSync(store, "alarm", deps());
    expect(second.outcomes.map((o) => o.source)).not.toContain("prairietest");
    for (const key of before) expect(Object.keys(second.store.raw)).not.toContain(key);
    expect(second.store.items.some((i) => i.members.some((m) => m.source === "prairietest"))).toBe(
      false,
    );
  });

  it("leaves every other source alone when one is switched off", async () => {
    // That the drop is scoped at all. It does *not* exercise the colon in the
    // prefix: no current source name is a prefix of another, so removing the
    // colon passes this and everything else — confirmed by mutation, and noted
    // where the colon is written.
    const first = await runSync(emptyStore(), "alarm", deps());
    const others = Object.keys(first.store.raw).filter((k) => !k.startsWith("prairielearn:"));
    expect(others.some((k) => k.startsWith("prairietest:"))).toBe(true);

    const store: StoreV1Plus = {
      ...first.store,
      sources: {
        ...first.store.sources,
        prairielearn: { ...first.store.sources.prairielearn, enabled: false },
      },
    };
    const second = await runSync(store, "alarm", deps());
    for (const key of others) expect(Object.keys(second.store.raw), key).toContain(key);
  });

  it("brings the rows back when the source is switched on again", async () => {
    // The other half of the argument: dropping them is only reasonable because
    // re-enabling refetches them.
    const first = await runSync(emptyStore(), "alarm", deps());
    const before = Object.keys(first.store.raw).filter((k) => k.startsWith("prairietest:"));

    const off: StoreV1Plus = {
      ...first.store,
      sources: {
        ...first.store.sources,
        prairietest: { ...first.store.sources.prairietest, enabled: false },
      },
    };
    const cleared = await runSync(off, "alarm", deps());
    const on: StoreV1Plus = {
      ...cleared.store,
      sources: {
        ...cleared.store.sources,
        prairietest: { ...cleared.store.sources.prairietest, enabled: true },
      },
    };
    const back = await runSync(on, "manual", deps());
    for (const key of before) expect(Object.keys(back.store.raw), key).toContain(key);
  });

  it("treats a source that had items and now returns none as a parse error", async () => {
    // The `ok` branch deleted every key for the source and left a green dot over
    // the gap — and it runs before §5.4, so the 3-miss grace never applied.
    const first = await runSync(emptyStore(), "alarm", deps());
    const before = Object.keys(first.store.raw).filter((k) => k.startsWith("gradescope:"));
    expect(before.length).toBeGreaterThan(0);

    const second = await runSync(
      first.store,
      "alarm",
      deps({
        // A dashboard whose current term parses to zero courses: no fetches, no
        // items, and previously no error either.
        async parseGradescopeDashboard() {
          return [];
        },
      }),
    );
    expect(second.store.sources.gradescope.state).toBe("parse_error");
    expect(second.store.sources.gradescope.lastError).toMatch(/0 items where it previously had/);
    for (const key of before) expect(Object.keys(second.store.raw)).toContain(key);
  });

  it("leaves a legitimately empty source green, rather than crying wolf", async () => {
    // Canvas's planner really is empty on this account (0 of 67 assignments are
    // dated), so 0 -> 0 must stay ok. The rule keys on N -> 0.
    const store = await runSync(
      emptyStore(),
      "alarm",
      deps({
        async fetchPage(url) {
          if (url.includes("planner")) return { url, finalUrl: url, status: 200, body: "[]" };
          const body = PAGES[url];
          if (body === undefined) throw new Error(`unexpected fetch: ${url}`);
          return { url, finalUrl: url, status: 200, body };
        },
      }),
    );
    expect(store.store.sources.canvas.state).toBe("ok");
  });

  it("does not purge a resting source's undated items", async () => {
    /*
     * §5.4's miss counter must not run on a source that is merely in backoff —
     * three syncs would delete undated rows belonging to a source that is about
     * to be read again.
     *
     * This used to test the same thing for a *disabled* source, which is the
     * case that turned out to be wrong: those rows go immediately now, so there
     * is nothing left for the miss counter to purge. Backoff is the state the
     * protection is actually for.
     */
    const first = await runSync(emptyStore(), "alarm", deps());
    const undated = Object.entries(first.store.raw)
      .filter(([key, item]) => key.startsWith("prairielearn:") && item.dueAt === undefined)
      .map(([key]) => key);
    expect(undated.length).toBeGreaterThan(0);

    let store: StoreV1Plus = {
      ...first.store,
      backoffUntil: { ...first.store.backoffUntil, prairielearn: "2026-09-11T00:00:00.000Z" },
    };
    for (let sync = 0; sync < 4; sync += 1) {
      store = (await runSync(store, "alarm", deps())).store;
    }
    for (const key of undated) expect(Object.keys(store.raw), key).toContain(key);
  });

  it("keeps notification state across syncs for an unchanged group", async () => {
    const first = await runSync(emptyStore(), "alarm", deps());
    const target = first.store.items.find((i) => i.dueAt !== undefined)!;
    target.notified = { "24h": NOW };
    const second = await runSync(first.store, "alarm", deps());
    expect(second.store.items.find((i) => i.id === target.id)!.notified).toEqual({ "24h": NOW });
  });

  it("re-parses to the same items, so a quiet sync changes nothing", async () => {
    const first = await runSync(emptyStore(), "alarm", deps());
    const second = await runSync(first.store, "alarm", deps());
    expect(second.store.items.map((i) => i.id)).toEqual(first.store.items.map((i) => i.id));
  });
});

describe("course-site adapters in the loop (§4.5)", () => {
  const ADAPTER = {
    id: "cs999-fa26",
    label: "CS 999 course site",
    courseCode: "CS999",
    term: "fa26",
    url: "https://courses.grainger.illinois.edu/cs999/fa2026/schedule",
    hostPattern: "https://courses.grainger.illinois.edu/*",
    rows: "#schedule tr.assignment",
    title: ".name",
    due: ".due",
    dateFormat: "MMM d, h:mm a",
    timezone: "America/Chicago",
    minExtensionVersion: "0.1.0",
  };
  const SITE_HTML = fixture("sites/example-course-schedule.html");

  const withAdapters = (adapters: typeof ADAPTER[], pages: Record<string, string> = {}) =>
    deps({
      async enabledAdapters() {
        return adapters as never;
      },
      async fetchPage(url) {
        const body = pages[url] ?? PAGES[url] ?? (url.includes("illinois.edu/cs") ? SITE_HTML : undefined);
        if (body === undefined) throw new Error(`unexpected fetch: ${url}`);
        return { url, finalUrl: url, status: 200, body };
      },
    });

  const enableSite = (store: StoreV1Plus): StoreV1Plus => ({
    ...store,
    sources: { ...store.sources, site: { ...store.sources.site, enabled: true, state: "ok" } },
  });

  describe("why it failed, not just that it did (§6's two branches)", () => {
    it("calls a failed fetch a network error, not a broken page", () => {
      // The live run after Tier 0a: `TypeError: Failed to fetch` for the CS 424
      // site on the sync that fires right after an extension reload. It healed
      // on the next sync, but it was reported as `parse_error` — the state that
      // means "the page changed, go fix the selectors".
      expect(adapterFailureKind(new TypeError("Failed to fetch"))).toBe("network");
    });

    it("calls zero matched rows a parse error, because that adapter really is broken", () => {
      expect(adapterFailureKind(new ParseError('no rows matched "table tr"'))).toBe("parse");
    });

    it("reports network_error when the only adapter could not be fetched", async () => {
      const failing = deps({
        async enabledAdapters() {
          return [ADAPTER] as never;
        },
        async fetchPage() {
          throw new TypeError("Failed to fetch");
        },
      });
      const result = await runSync(enableSite(emptyStore()), "manual", failing);
      const site = result.outcomes.find((o) => o.source === "site")!;
      expect(site.state).toBe("network_error");
      expect(site.error).toContain("Failed to fetch");
    });

    it("still reports parse_error when the adapter matched nothing", async () => {
      const broken = deps({
        async enabledAdapters() {
          return [ADAPTER] as never;
        },
        async fetchPage(url) {
          return { url, finalUrl: url, status: 200, body: "<html></html>" };
        },
        async runAdapter() {
          throw new ParseError('no rows matched "#schedule tr.assignment"');
        },
      });
      const result = await runSync(enableSite(emptyStore()), "manual", broken);
      expect(result.outcomes.find((o) => o.source === "site")!.state).toBe("parse_error");
    });

    it("treats a 4xx as structural and a 5xx as the site's problem", async () => {
      const withStatus = (status: number) =>
        deps({
          async enabledAdapters() {
            return [ADAPTER] as never;
          },
          async fetchPage(url) {
            return { url, finalUrl: url, status, body: "" };
          },
        });
      const gone = await runSync(enableSite(emptyStore()), "manual", withStatus(404));
      expect(gone.outcomes.find((o) => o.source === "site")!.state).toBe("parse_error");
      const down = await runSync(enableSite(emptyStore()), "manual", withStatus(503));
      expect(down.outcomes.find((o) => o.source === "site")!.state).toBe("network_error");
    });
  });

  it("runs an enabled adapter and folds its items into the list", async () => {
    const { store } = await runSync(enableSite(emptyStore()), "alarm", withAdapters([ADAPTER]));
    expect(store.sources.site.state).toBe("ok");
    const siteKeys = Object.keys(store.raw).filter((k) => k.startsWith("site:"));
    expect(siteKeys.length).toBeGreaterThan(0);
    expect(store.items.some((i) => i.courseCode === "CS999")).toBe(true);
  });

  it("reports the source disabled when no adapter is enabled, never ok", async () => {
    // Regression: this returned `ok` with 0 items, so the options page painted a
    // green dot on a course-site source that had no adapter enabled and was
    // fetching nothing. A real user read that dot as "working" and spent two
    // rounds asking why no WEB rows appeared.
    const { store, outcomes } = await runSync(enableSite(emptyStore()), "alarm", withAdapters([]));
    expect(store.sources.site.state).toBe("disabled");
    expect(outcomes.find((o) => o.source === "site")?.state).toBe("disabled");
    expect(store.sources.site.lastError).toMatch(/no course sites are enabled/);
  });

  it("does not count being switched off as a failure", async () => {
    // §6's ladder exists to stop hammering a *broken* site. A source nobody has
    // configured must not accumulate failures or sit in a backoff for it —
    // enabling an adapter would then appear to do nothing until the wait ran out.
    let store = enableSite(emptyStore());
    for (let i = 0; i < 4; i += 1) {
      store = (await runSync(store, "alarm", withAdapters([]))).store;
    }
    expect(store.sources.site.consecutiveFailures).toBe(0);
    expect(store.backoffUntil.site).toBeUndefined();
  });

  it("takes its rows with it when the last adapter is switched off", async () => {
    /*
     * Sushi's report, in one assertion: Settings said "Course websites — Off"
     * and the CS 424 rows were still on the calendar. They had been fetched
     * once, the adapter was then switched off, and nothing ever removed them —
     * so the list asserted a deadline no source was standing behind, on a row
     * that could never update and could never even be flagged stale, because
     * `staleNotice` skips `disabled`.
     *
     * This test asserted the opposite until that happened. It was pinning the
     * defect, which is worker rule 6's warning about exactly this shape.
     */
    const first = await runSync(enableSite(emptyStore()), "alarm", withAdapters([ADAPTER]));
    expect(Object.keys(first.store.raw).some((k) => k.startsWith("site:"))).toBe(true);

    const { store } = await runSync(first.store, "alarm", withAdapters([]));
    expect(store.sources.site.state).toBe("disabled");
    expect(Object.keys(store.raw).filter((k) => k.startsWith("site:"))).toEqual([]);
    // And the dedupe output, which is what the calendar actually draws.
    expect(store.items.some((i) => i.members.some((m) => m.source === "site"))).toBe(false);
  });

  it("never says a source is off while still showing its rows", async () => {
    // The invariant behind the report, stated once: whatever the reason a
    // source is not being read, the list must not keep claiming its deadlines.
    for (const adapters of [[], [ADAPTER]]) {
      const first = await runSync(enableSite(emptyStore()), "alarm", withAdapters([ADAPTER]));
      const { store } = await runSync(first.store, "alarm", withAdapters(adapters));
      const off = store.sources.site.state === "disabled";
      const hasRows = Object.keys(store.raw).some((k) => k.startsWith("site:"));
      expect(off && hasRows, `adapters=${adapters.length}`).toBe(false);
    }
  });

  it("isolates one failing adapter from the others (§4.5)", async () => {
    // The whole reason course sites are adapters rather than a fifth parser.
    const broken = { ...ADAPTER, id: "broken-fa26", rows: ".nothing-matches" };
    const { store } = await runSync(
      enableSite(emptyStore()),
      "alarm",
      withAdapters([broken, ADAPTER]),
    );
    expect(store.sources.site.state).toBe("ok");
    expect(Object.keys(store.raw).some((k) => k.startsWith("site:cs999-fa26"))).toBe(true);
  });

  it("fails the source only when every adapter fails", async () => {
    const broken = { ...ADAPTER, rows: ".nothing-matches" };
    const { store } = await runSync(enableSite(emptyStore()), "alarm", withAdapters([broken]));
    expect(store.sources.site.state).toBe("parse_error");
    expect(store.sources.site.lastError).toMatch(/every adapter failed/);
  });

  it("reports a 401 in place as needs_login, not a broken adapter", async () => {
    // A real protected course page (cs424/fa2026/secure/schedule.html) answers
    // 401 without redirecting anywhere, so a status-only check would call an
    // expired SSO session a parse failure and back off (§4.5, §0 rule 2).
    const expired = deps({
      async enabledAdapters() {
        return [ADAPTER] as never;
      },
      async fetchPage(url) {
        if (url.includes("cs999")) return { url, finalUrl: url, status: 401, body: "" };
        return { url, finalUrl: url, status: 200, body: PAGES[url] ?? "" };
      },
    });
    const { store } = await runSync(enableSite(emptyStore()), "alarm", expired);
    expect(store.sources.site.state).toBe("needs_login");
    /*
     * And it records *which* page, which is the half the UI needs.
     *
     * "For reading the cs424 website it just says sign in needed but it doesnt
     * link me to the sign in page" (2026-09-12). `LOGIN_URL` has no entry for
     * `site` and cannot have one — a course website is whatever host an adapter
     * points at — so the row had the words and nothing to press. The URL that
     * answered 401 is the answer, and this is the only place that knows it.
     *
     * The requested URL, not `finalUrl`: opening it triggers SSO *and* lands
     * the student on the page they were missing.
     */
    expect(store.sources.site.loginUrl).toBe(ADAPTER.url);
  });

  it("clears the recorded page when the next failure is not a login", async () => {
    // Otherwise a stale 401 leaves a "Sign in" button over a network error,
    // which is worse than no button: it sends the student to sign into a
    // session that is already valid.
    const flaky = deps({
      async enabledAdapters() {
        return [ADAPTER] as never;
      },
      async fetchPage(url) {
        if (url.includes("cs999")) throw new TypeError("Failed to fetch");
        return { url, finalUrl: url, status: 200, body: PAGES[url] ?? "" };
      },
    });
    const before = enableSite(emptyStore());
    before.sources.site = { ...before.sources.site, loginUrl: ADAPTER.url };
    const { store } = await runSync(before, "alarm", flaky);
    expect(store.sources.site.state).not.toBe("needs_login");
    expect(store.sources.site.loginUrl).toBeUndefined();
  });

  it("still reports a 404 as an adapter failure, not a login problem", async () => {
    const missing = deps({
      async enabledAdapters() {
        return [ADAPTER] as never;
      },
      async fetchPage(url) {
        if (url.includes("cs999")) return { url, finalUrl: url, status: 404, body: "" };
        return { url, finalUrl: url, status: 200, body: PAGES[url] ?? "" };
      },
    });
    const { store } = await runSync(enableSite(emptyStore()), "alarm", missing);
    expect(store.sources.site.state).toBe("parse_error");
    expect(store.sources.site.lastError).toMatch(/404/);
  });

  it("reports a Shibboleth landing as needs_login", async () => {
    const login = deps({
      async enabledAdapters() {
        return [ADAPTER] as never;
      },
      async fetchPage(url) {
        if (url.includes("cs999")) {
          return {
            url,
            finalUrl: "https://shibboleth.illinois.edu/idp/profile/SAML2",
            status: 200,
            body: "",
          };
        }
        return { url, finalUrl: url, status: 200, body: PAGES[url] ?? "" };
      },
    });
    const { store } = await runSync(enableSite(emptyStore()), "alarm", login);
    expect(store.sources.site.state).toBe("needs_login");
    /*
     * The course page, **not** the SSO host it bounced to.
     *
     * This is the only fixture where the two differ — the 401-in-place case
     * above has `url === finalUrl`, so it cannot tell them apart, and a
     * `finalUrl` mutation survived there. Sending the student to
     * `shibboleth.illinois.edu/idp/profile/SAML2` directly is sending them to
     * the middle of a handshake with no course page on the other side of it.
     */
    expect(store.sources.site.loginUrl).toBe(ADAPTER.url);
    expect(store.sources.site.loginUrl).not.toContain("shibboleth");
  });

  it("fetches nothing when no adapter is enabled", async () => {
    // This test used to assert `state: "ok"` here, which is how the green-dot
    // defect above survived a suite that was otherwise mutation-checked: the
    // test pinned the bug rather than the requirement.
    const { store } = await runSync(enableSite(emptyStore()), "alarm", withAdapters([]));
    expect(store.sources.site.state).toBe("disabled");
    expect(Object.keys(store.raw).some((k) => k.startsWith("site:"))).toBe(false);
  });
});

describe("a new build lifts §6's backoff (§11's fix-fast mitigation)", () => {
  function resting(state: "parse_error" | "network_error" | "needs_login") {
    const store = emptyStore();
    store.sources.gradescope = {
      ...store.sources.gradescope,
      enabled: true,
      state,
      consecutiveFailures: 4,
    };
    store.backoffUntil.gradescope = "2026-09-10T22:00:00.000Z";
    return store;
  }

  it("retries a source whose page a code change could have fixed", () => {
    // Without this, a source on the 240-minute rung stays red for up to four
    // hours after the build that repaired it is already installed.
    expect(sourcesToRetryAfterUpdate(resting("parse_error"))).toEqual(["gradescope"]);
    expect(sourcesToRetryAfterUpdate(resting("network_error"))).toEqual(["gradescope"]);
  });

  it("leaves a session expiry resting, which no code change can fix", () => {
    expect(sourcesToRetryAfterUpdate(resting("needs_login"))).toEqual([]);
  });

  it("ignores a source that is not resting at all", () => {
    const healthy = emptyStore();
    healthy.sources.gradescope = { ...healthy.sources.gradescope, state: "ok" };
    expect(sourcesToRetryAfterUpdate(healthy)).toEqual([]);
  });

  it("ignores a failing source that has no backoff armed", () => {
    // A failure whose ladder already expired, or was cleared by an earlier
    // update. Nothing needs lifting, and naming it in the log would report
    // work that did not happen — the ambiguity worker rule 5 exists to stop.
    const noLadder = resting("parse_error");
    delete noLadder.backoffUntil.gradescope;
    expect(sourcesToRetryAfterUpdate(noLadder)).toEqual([]);
  });

  it("ignores a source the student switched off", () => {
    const off = resting("parse_error");
    off.sources.gradescope = { ...off.sources.gradescope, enabled: false };
    expect(sourcesToRetryAfterUpdate(off)).toEqual([]);
  });
});

describe("the term filter inside the loop (§4.1)", () => {
  const inTerm = "2026-09-10T18:00:00.000Z";

  it("drops planner rows belonging to a set-aside course", async () => {
    // The stale FA25 course publishes nothing dated today, so this uses a
    // planner row invented for it — the point is that the loop would list it.
    const planner = JSON.stringify([
      {
        course_id: 58438,
        plannable_id: 1,
        plannable_type: "assignment",
        plannable: { id: 1, title: "NDA acknowledgement", due_at: "2026-09-17T04:59:59Z" },
        html_url: "/courses/58438/assignments/1",
        context_name: "FA25 IBC NDA and Code of Conduct Forms",
        submissions: { submitted: false, graded: false, missing: false, excused: false },
      },
    ]);
    const reported: unknown[] = [];
    const withStale = deps({
      now: () => inTerm,
      reportSetAsideCourses: (courses) => reported.push(...courses),
      async fetchPage(url) {
        if (url === coursesUrl()) return { url, finalUrl: url, status: 200, body: fixture("canvas/courses-active-term.json") };
        if (url.includes("planner")) return { url, finalUrl: url, status: 200, body: planner };
        return { url, finalUrl: url, status: 200, body: PAGES[url] ?? "" };
      },
    });
    const { store } = await runSync(emptyStore(), "manual", withStale);
    expect(Object.keys(store.raw).filter((k) => k.startsWith("canvas:"))).toEqual([]);
    expect(reported).toHaveLength(1);
  });

  it("keeps rows for courses in the current term", async () => {
    const kept = deps({
      now: () => inTerm,
      async fetchPage(url) {
        if (url === coursesUrl()) return { url, finalUrl: url, status: 200, body: fixture("canvas/courses-active-term.json") };
        if (url.includes("planner")) return { url, finalUrl: url, status: 200, body: fixture("canvas/planner-items.json") };
        return { url, finalUrl: url, status: 200, body: PAGES[url] ?? "" };
      },
    });
    const { store } = await runSync(emptyStore(), "manual", kept);
    // CS 424's quiz, in term 262.
    expect(Object.keys(store.raw).filter((k) => k.startsWith("canvas:"))).toEqual([
      "canvas:quiz:438909",
    ]);
  });
});

describe("withoutRows (the switch takes effect when you flip it)", () => {
  /*
   * The loop drops a disabled source's rows, but the next loop is up to a poll
   * interval away — so between flipping the switch and the next sync, Settings
   * said "Off" over rows the calendar was still showing. That gap is what
   * Sushi saw; this is what the message handlers call to close it.
   */
  it("removes exactly one source's rows and rebuilds the list", async () => {
    const { store } = await runSync(emptyStore(), "alarm", deps());
    expect(store.items.some((i) => i.members.some((m) => m.source === "prairietest"))).toBe(true);

    const after = withoutRows(store, sourcePrefix("prairietest"));
    expect(Object.keys(after.raw).some((k) => k.startsWith("prairietest:"))).toBe(false);
    expect(Object.keys(after.raw).some((k) => k.startsWith("canvas:"))).toBe(true);
    // The list, not just the raw store: the calendar draws `items`.
    expect(after.items.some((i) => i.members.some((m) => m.source === "prairietest"))).toBe(false);
    expect(after.items.length).toBeLessThan(store.items.length);
  });

  it("keeps the user's own corrections", async () => {
    // Dropping rows must not drop the hide/merge/tick decisions attached to
    // them — those are the two-a-semester corrections G3 budgets for, and a
    // source switched off and on again would otherwise forget them.
    const { store } = await runSync(emptyStore(), "alarm", deps());
    const withOverride: StoreV1Plus = {
      ...store,
      overrides: { ...store.overrides, hiddenKeys: ["prairietest:whatever"] },
    };
    const after = withoutRows(withOverride, sourcePrefix("prairietest"));
    expect(after.overrides.hiddenKeys).toEqual(["prairietest:whatever"]);
  });

  it("returns the same store when there is nothing to drop", async () => {
    // So a caller can skip a write, and so flipping a switch on a source that
    // never produced anything does not churn the store.
    const { store } = await runSync(emptyStore(), "alarm", deps());
    expect(withoutRows(store, sourcePrefix("site"))).toBe(store);
  });

  it("names one adapter's rows without naming the source's", () => {
    // `site:` is the source; `site:<adapterId>:` is one adapter. Switching one
    // course site off must not empty the others, which share the source — and
    // the source prefix must not be mistaken for an adapter's.
    expect(adapterPrefix("cs424-fa26")).toBe("site:cs424-fa26:");
    expect(adapterPrefix("cs424-fa26").startsWith(sourcePrefix("site"))).toBe(true);
    expect("site:phys214-fa26:ccc".startsWith(adapterPrefix("cs424-fa26"))).toBe(false);
    expect("site:cs424-fa26:aaa".startsWith(adapterPrefix("cs424-fa26"))).toBe(true);
    // The trailing colon is load-bearing here, unlike on the source prefix:
    // adapter ids really can prefix each other (`cs424-fa26` / `cs424-fa26b`).
    expect("site:cs424-fa26b:x".startsWith(adapterPrefix("cs424-fa26"))).toBe(false);
  });
});

/**
 * The `manual` source through the loop (§5.4, §6).
 *
 * The trap is §5.4's retention. `applyRetention` purges an undated raw item
 * after UNDATED_MISSES=3 syncs in which it was not seen, and `seenThisSync` is
 * only ever filled inside the `PLANS` loops — so a row nobody fetches is absent
 * from every sync *by construction* and would be deleted on the third, taking
 * its hide and its tick with it. Keeping manual rows out of `store.raw` is the
 * decision that sidesteps it; these tests are what say so.
 */
describe("a deadline the student typed in", () => {
  const typed: RawItem = {
    source: "manual",
    sourceId: "b3f1c0de-0000-4000-8000-000000000001",
    courseRaw: "RHET 105",
    courseCode: "RHET105",
    title: "Essay draft",
    kind: "assignment",
    // Deliberately undated: this is the exact shape §5.4 purges after three
    // misses, and a dated row would pass this test against a broken loop.
    status: "unknown",
    fetchedAt: NOW,
  };

  function storeWith(items: RawItem[]): StoreV1Plus {
    const store = emptyStore();
    store.manualItems = items;
    // Nothing enabled: this is about what the loop does to rows it never
    // fetches, and every source being off is the harshest version of that —
    // `dropItemsOf` runs for all six.
    for (const source of Object.keys(store.sources) as Source[]) {
      store.sources[source] = { ...store.sources[source]!, enabled: false };
    }
    return store;
  }

  it("survives three syncs, which is where §5.4 would have purged it", async () => {
    let store = storeWith([typed]);
    for (let i = 0; i < 3; i += 1) {
      store = (await runSync(store, "manual", deps())).store;
    }
    expect(store.manualItems).toHaveLength(1);
    expect(store.items.map((item) => item.title)).toEqual(["Essay draft"]);
    // And it never entered `raw`, which is what keeps retention away from it.
    expect(Object.keys(store.raw)).toEqual([]);
    expect(store.misses["manual:b3f1c0de-0000-4000-8000-000000000001"]).toBeUndefined();
  });

  it("is on the list after a sync in which nothing was fetched at all", async () => {
    // The splice, stated on its own: without it the list is rebuilt from `raw`
    // and every hand-typed deadline disappears the moment a sync runs.
    const { store } = await runSync(storeWith([typed]), "manual", deps());
    expect(store.items).toHaveLength(1);
    expect(store.items[0]!.members[0]!.source).toBe("manual");
  });

  it("is not dropped when a source is switched off", () => {
    // `withoutRows` rebuilds the list from `raw` when an adapter is turned off.
    // The student's rows are not under any prefix and must come through.
    const store = storeWith([typed]);
    store.raw["site:cs424-fa26:hw1"] = {
      source: "site",
      sourceId: "cs424-fa26:hw1",
      courseRaw: "CS424",
      title: "HW1 Due",
      kind: "assignment",
      dueAt: "2026-09-20T23:59:00-05:00",
      url: "https://courses.grainger.illinois.edu/cs424/fa2026/schedule.html",
      status: "unknown",
      fetchedAt: NOW,
    };
    const after = withoutRows(store, adapterPrefix("cs424-fa26"));
    expect(Object.keys(after.raw)).toEqual([]);
    expect(after.items.map((item) => item.title)).toEqual(["Essay draft"]);
  });

  it("is never attempted, so it cannot report a failure", async () => {
    const { outcomes } = await runSync(storeWith([typed]), "manual", deps());
    // `PLANS` has no `manual` entry: there is nothing to fetch, and an outcome
    // for it would be a state the health surfaces then have to explain away.
    expect(outcomes.map((outcome) => outcome.source)).not.toContain("manual");
  });
});

/**
 * The click that lands while a sync is fetching (worker rule 4).
 *
 * `sync()` held the store queue across every fetch of a run — the whole loop
 * plus all of Piazza's requests — and the queue's re-entrancy flag let any
 * caller that arrived during that window run unqueued. So a Hide pressed three
 * seconds into a sync was written, and then overwritten by the sync's
 * `saveStore` of the store it had loaded before the click: no error, and the
 * control sprang back.
 *
 * `syncOnce` is the fix and it lives here, not in the worker, because the
 * worker is the file the suite cannot reach (worker rule 1). The load-bearing
 * line is the second `io.load()`: the results are applied to a store read
 * **after** the fetches.
 */
describe("syncOnce: a change made during the fetches survives the sync", () => {
  function deferred(): { promise: Promise<void>; release: () => void } {
    let release = (): void => undefined;
    const promise = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    return { promise, release };
  }

  /** A store on "disk", plus the one queue every writer in the worker uses. */
  function io(initial: StoreV1Plus) {
    let disk = initial;
    const withStore = createStoreQueue();
    return {
      withStore,
      load: async () => JSON.parse(JSON.stringify(disk)) as StoreV1Plus,
      save: async (store: StoreV1Plus) => {
        disk = store;
      },
      read: () => disk,
    };
  }

  const HIDDEN_KEY = "gradescope:8398957";

  /**
   * Deps whose every fetch waits on a gate, and which queue `click` through the
   * store the first time a request goes out — the popup pressing something
   * while the sync is on the network, which is when this went wrong.
   */
  function gatedDeps(gate: { promise: Promise<void> }, click: () => void) {
    let clicked = false;
    return deps({
      async fetchPage(url: string) {
        if (!clicked) {
          clicked = true;
          click();
        }
        await gate.promise;
        const body = PAGES[url];
        if (body === undefined) throw new Error(`unexpected fetch: ${url}`);
        return { url, finalUrl: url, status: 200, body };
      },
    });
  }

  it("keeps a hide that was queued while the sources were being fetched", async () => {
    const gate = deferred();
    const store = io(emptyStore());
    let hide: Promise<void> | undefined;
    const slow = gatedDeps(gate, () => {
      hide = store.withStore(async () => {
        const fresh = await store.load();
        fresh.overrides = { ...fresh.overrides, hiddenKeys: [HIDDEN_KEY] };
        await store.save(fresh);
      }, "mutate: hide");
    });

    const running = syncOnce("manual", slow, store);
    // One turn of the loop, so the hide is queued and — because the fetches
    // hold nothing — has already run.
    await new Promise((resolve) => setTimeout(resolve, 5));
    gate.release();
    const result = await running;
    await hide;

    // Both halves: the click is in the store the sync wrote, and the sync's own
    // rows arrived.
    expect(result.store.overrides.hiddenKeys).toEqual([HIDDEN_KEY]);
    expect(store.read().overrides.hiddenKeys).toEqual([HIDDEN_KEY]);
    expect(Object.keys(store.read().raw).length).toBeGreaterThan(20);
  });

  it("dedupes over the overrides the fresh store holds, not the ones it planned with", async () => {
    // The hide has to reach `dedupe`, or the row comes back visible until the
    // next sync — which is the same springing-back control, one redraw later.
    const gate = deferred();
    const store = io(emptyStore());
    let hide: Promise<void> | undefined;
    const slow = gatedDeps(gate, () => {
      hide = store.withStore(async () => {
        const fresh = await store.load();
        fresh.overrides = { ...fresh.overrides, hiddenKeys: [HIDDEN_KEY] };
        await store.save(fresh);
      }, "mutate: hide");
    });

    const running = syncOnce("manual", slow, store);
    await new Promise((resolve) => setTimeout(resolve, 5));
    gate.release();
    const result = await running;
    await hide;

    expect(result.store.items.filter((item) => item.hidden)).toHaveLength(1);
  });

  it("does not make a click wait for the network", async () => {
    // The other half of the same property: the queue is held to plan and to
    // apply, never across a fetch, so a press during a sync answers at once.
    const gate = deferred();
    const store = io(emptyStore());
    let clicked = false;
    let click: Promise<void> | undefined;
    const slow = gatedDeps(gate, () => {
      click = store.withStore(async () => {
        clicked = true;
      }, "mutate: tick");
    });

    const running = syncOnce("manual", slow, store);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(clicked).toBe(true);

    gate.release();
    await Promise.all([running, click]);
  });

  it("writes nothing when §6's popup debounce says the sync is a no-op", async () => {
    const store = io(emptyStore());
    await syncOnce("alarm", deps(), store);
    const after = store.read();

    const soon = new Date(Date.parse(NOW) + POPUP_DEBOUNCE_MS - 1000).toISOString();
    const skipped = await syncOnce("popup", deps({ now: () => soon }), store);
    expect(skipped.skipped).toBe(true);
    expect(store.read()).toEqual(after);
  });
});

/**
 * Which triggers §6's ladder gives way to.
 *
 * "manual" is the student pressing Sync now, and the ladder gives way to it
 * because the commonest reason to press it is having just fixed the thing that
 * failed. "recheck" is a page finishing on a source's own site while that
 * source waits on a login — evidence about that source, so it counts too. An
 * alarm and a popup opening are neither, and a navigation that counted as
 * "manual" is how a student who browses Gradescope defeated Piazza's ladder
 * forever (`planPiazza` maps "recheck" to a scheduled run).
 */
describe("planSync and §6's backoff ladder", () => {
  const resting = (): StoreV1Plus => {
    const store = emptyStore();
    store.sources.gradescope = {
      ...store.sources.gradescope,
      state: "network_error",
      consecutiveFailures: 3,
    };
    store.backoffUntil.gradescope = new Date(Date.parse(NOW) + 60_000).toISOString();
    return store;
  };

  it("rests a source on an alarm", () => {
    const plan = planSync(resting(), "alarm", NOW);
    expect(plan.resting).toContain("gradescope");
    expect(plan.attempt).not.toContain("gradescope");
  });

  it("rests a source when the popup opens", () => {
    // Opening the popup is not the student asking for this source.
    const plan = planSync(resting(), "popup", NOW);
    expect(plan.resting).toContain("gradescope");
  });

  it("rests a source on install", () => {
    const plan = planSync(resting(), "install", NOW);
    expect(plan.resting).toContain("gradescope");
  });

  it("reads a resting source when the student presses Sync now", () => {
    const plan = planSync(resting(), "manual", NOW);
    expect(plan.attempt).toContain("gradescope");
    expect(plan.resting).toEqual([]);
  });

  it("reads a resting source when a page finished on its own site", () => {
    const plan = planSync(resting(), "recheck", NOW);
    expect(plan.attempt).toContain("gradescope");
  });

  it("leaves a source that is switched off out of both lists", () => {
    const store = resting();
    store.sources.gradescope = { ...store.sources.gradescope, enabled: false };
    const plan = planSync(store, "manual", NOW);
    expect(plan.attempt).not.toContain("gradescope");
    expect(plan.resting).not.toContain("gradescope");
  });
});

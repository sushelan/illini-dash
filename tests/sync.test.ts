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
  type StoreV1Plus,
} from "../src/core/store.js";
import { POPUP_DEBOUNCE_MS, runSync, syncOneSource, type SyncDeps } from "../src/core/sync.js";
import { currentTermCourses, parseCoursePage } from "../src/sources/gradescope.js";
import { parseAssessments } from "../src/sources/prairielearn.js";
import { parseHome } from "../src/sources/prairietest.js";
import type { PageCtx, RawItem, Source } from "../src/sources/types.js";

const fixture = (path: string) =>
  readFileSync(new URL(`../fixtures/${path}`, import.meta.url), "utf8");
const doc = (html: string) => parseHTML(html).document as unknown as Document;

const NOW = "2026-09-10T18:00:00.000Z";

/** The real pages, keyed by the URL the sync loop will ask for. */
const PAGES: Record<string, string> = {
  "https://canvas.illinois.edu/api/v1/courses?enrollment_state=active&per_page=100":
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
    now: () => NOW,
    ...overrides,
  };
}

describe("migrate (§3)", () => {
  it("fills an empty or junk store with defaults", () => {
    for (const junk of [undefined, null, 42, "x", {}]) {
      const store = migrate(junk);
      expect(store.schemaVersion).toBe(1);
      expect(store.settings.pollMinutes).toBe(30);
      expect(Object.keys(store.sources)).toHaveLength(5);
    }
  });

  it("keeps a user's overrides rather than resetting them", () => {
    // The failure that matters is not a future migration, it is a half-written
    // store: losing overrides to a missing key would be unrecoverable.
    const store = migrate({ overrides: { hiddenItemIds: ["abc"] }, items: undefined });
    expect(store.overrides.hiddenItemIds).toEqual(["abc"]);
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

  it("does not fetch a disabled source, but keeps what it already had", async () => {
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
    // Disabling a source in the options page must not delete its history.
    for (const key of before) expect(Object.keys(second.store.raw)).toContain(key);
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

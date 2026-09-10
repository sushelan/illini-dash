/**
 * §4.5's declarative adapter runner and its registry.
 *
 * The registry is the only place this extension ingests data authored
 * elsewhere, so its validation is a trust boundary rather than a formality.
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { parseAdapterDate, runAdapter, supportedDateFormats } from "../src/sources/site.js";
import {
  currentTermCode,
  isCurrentTerm,
  matchesHostPattern,
  shouldSeedFromBundle,
  validateAdapter,
  validateRegistry,
} from "../src/core/registry.js";
import { normalizeTitle } from "../src/core/normalize.js";
import { ParseError, type Adapter, type PageCtx } from "../src/sources/types.js";

const doc = (html: string) => parseHTML(html).document as unknown as Document;
const fixture = doc(
  readFileSync(new URL("../fixtures/sites/example-course-schedule.html", import.meta.url), "utf8"),
);

const page: PageCtx = {
  url: "https://courses.grainger.illinois.edu/cs999/fa2026/schedule",
  fetchedAt: "2026-09-10T18:00:00.000Z",
};

const ADAPTER: Adapter = {
  id: "cs999-fa26",
  label: "CS 999 course site",
  courseCode: "CS999",
  term: "fa26",
  url: "https://courses.grainger.illinois.edu/cs999/fa2026/schedule",
  hostPattern: "https://courses.grainger.illinois.edu/*",
  rows: "#schedule tr.assignment",
  title: ".name",
  due: ".due",
  link: ".name a@href",
  dateFormat: "MMM d, h:mm a",
  timezone: "America/Chicago",
  filter: { exclude: "no submission" },
  minExtensionVersion: "0.1.0",
};

describe("parseAdapterDate", () => {
  const ref = "2026-09-10T18:00:00.000Z";

  it("parses each supported format in the declared zone", () => {
    expect(parseAdapterDate("Sep 11, 11:59 pm", "MMM d, h:mm a", "America/Chicago", ref)).toBe(
      "2026-09-11T23:59:00-05:00",
    );
    expect(parseAdapterDate("2026-09-11 23:59", "yyyy-MM-dd", "America/Chicago", ref)).toBe(
      "2026-09-11T23:59:00-05:00",
    );
    expect(parseAdapterDate("9/11 11:59 pm", "M/d", "America/Chicago", ref)).toBe(
      "2026-09-11T23:59:00-05:00",
    );
  });

  it("defaults a dateless entry to end of day, as a schedule page means it", () => {
    expect(parseAdapterDate("Oct 2", "MMM d, h:mm a", "America/Chicago", ref)).toBe(
      "2026-10-02T23:59:00-05:00",
    );
  });

  it("respects the declared timezone rather than the host's", () => {
    expect(parseAdapterDate("Sep 11, 11:59 pm", "MMM d, h:mm a", "America/New_York", ref)).toBe(
      "2026-09-11T23:59:00-04:00",
    );
  });

  it("returns undefined instead of guessing", () => {
    expect(parseAdapterDate("TBD", "MMM d, h:mm a", "America/Chicago", ref)).toBeUndefined();
    expect(parseAdapterDate("Sep 31", "MMM d, h:mm a", "America/Chicago", ref)).toBeUndefined();
    expect(parseAdapterDate("Sep 11", "no-such-format", "America/Chicago", ref)).toBeUndefined();
  });
});

describe("runAdapter (§4.5)", () => {
  const items = runAdapter(ADAPTER, fixture, page);

  it("produces one item per matching row", () => {
    // Five rows: a header with no .name, an excluded exam, and a duplicate.
    expect(items.map((i) => i.title)).toEqual([
      "MP1: Warm-up",
      "MP2: Scheduling",
      "MP3: Unscheduled",
    ]);
  });

  it("honours the declared filter", () => {
    expect(items.some((i) => i.title.includes("Midterm"))).toBe(false);
  });

  it("keeps an unparseable date as an undated row rather than dropping it", () => {
    const tbd = items.find((i) => i.title === "MP3: Unscheduled")!;
    expect(tbd.dueAt).toBeUndefined();
    expect(tbd.extra?.["unparsedDate"]).toBe("TBD");
  });

  it("resolves the row link, and refuses one off the adapter's own origin", () => {
    expect(items[0]!.url).toBe("https://courses.grainger.illinois.edu/cs999/fa2026/mp1");
    const offHost = runAdapter(
      { ...ADAPTER, link: undefined },
      doc(`<table id="schedule"><tr class="assignment"><td class="name">X</td><td class="due">Sep 11</td></tr></table>`),
      page,
    );
    expect(offHost[0]!.url).toBe(ADAPTER.url);
  });

  it("throws when zero rows match, for this adapter only (§4.5)", () => {
    expect(() => runAdapter({ ...ADAPTER, rows: ".nope" }, fixture, page)).toThrow(ParseError);
  });

  it("throws when rows match but none carries a title", () => {
    // House rule 2: guarding the container is not enough. A site that keeps its
    // table and renames the title class would otherwise yield [] with no error,
    // and the sync loop's N->0 guard keys on the whole `site:` source — so a
    // second healthy adapter keeps the dot green while these deadlines vanish.
    expect(() => runAdapter({ ...ADAPTER, title: ".renamed" }, fixture, page)).toThrow(
      /none matched title/,
    );
  });

  it("does not confuse an empty result from a filter with a broken page", () => {
    // Every row parses fine; the filter simply excludes them all.
    const items = runAdapter({ ...ADAPTER, filter: { include: "nothing matches this" } }, fixture, page);
    expect(items).toEqual([]);
  });

  it("keys on title and date, so a repeated row is not a second deadline", () => {
    expect(new Set(items.map((i) => i.sourceId)).size).toBe(items.length);
    expect(items.every((i) => i.sourceId.startsWith("cs999-fa26:"))).toBe(true);
    expect(items.every((i) => i.source === "site")).toBe(true);
  });
});

describe("registry validation (§4.5) — a trust boundary", () => {
  it("accepts a well-formed adapter", () => {
    expect(validateAdapter(ADAPTER).adapter).toBeDefined();
  });

  it("refuses anything not https on illinois.edu", () => {
    // §2.3 requests optional permission for *.illinois.edu only, so an adapter
    // pointing elsewhere could never be granted and must not be offered.
    expect(validateAdapter({ ...ADAPTER, url: "http://courses.grainger.illinois.edu/x" }).reason).toMatch(
      /https/,
    );
    expect(validateAdapter({ ...ADAPTER, url: "https://evil.example/x" }).reason).toMatch(
      /illinois\.edu/,
    );
  });

  it("refuses a hostPattern broader than the adapter's own host", () => {
    // `https://*.illinois.edu/*` is the manifest's own optional entry, so Chrome
    // would grant it — one prompt covering every illinois.edu site. And since
    // only the adapter *id* is stored, a later registry refresh could repoint
    // its url anywhere under that wildcard with no second prompt.
    expect(
      validateAdapter({ ...ADAPTER, hostPattern: "https://*.illinois.edu/*" }).reason,
    ).toMatch(/hostPattern must be exactly/);
    expect(
      validateAdapter({ ...ADAPTER, hostPattern: "https://*.grainger.illinois.edu/*" }).reason,
    ).toMatch(/hostPattern must be exactly/);
  });

  it("refuses an adapter whose hostPattern does not cover its own url", () => {
    // The pattern is what chrome.permissions.request asks for; a mismatch would
    // prompt for one origin and then fetch another.
    expect(
      validateAdapter({ ...ADAPTER, hostPattern: "https://other.illinois.edu/*" }).reason,
    ).toMatch(/hostPattern/);
  });

  it("refuses an unsupported date format", () => {
    const reason = validateAdapter({ ...ADAPTER, dateFormat: "RFC-9999" }).reason!;
    expect(reason).toMatch(/dateFormat/);
    for (const format of supportedDateFormats()) expect(reason).toContain(format);
  });

  it("refuses a filter that is not a valid regex", () => {
    expect(validateAdapter({ ...ADAPTER, filter: { include: "([" } }).reason).toMatch(/regex/);
  });

  it("refuses missing required fields", () => {
    for (const field of ["id", "label", "rows", "title", "due", "timezone", "minExtensionVersion"]) {
      const broken = { ...ADAPTER } as Record<string, unknown>;
      delete broken[field];
      expect(validateAdapter(broken).adapter, field).toBeUndefined();
    }
  });

  it("drops bad entries but keeps the good ones", () => {
    // One broken adapter must not stop a fix for a different course reaching
    // anyone.
    const result = validateRegistry(
      JSON.stringify({ adapters: [ADAPTER, { id: "broken" }, { ...ADAPTER, id: "cs998-fa26" }] }),
    );
    expect(result.adapters.map((a) => a.id)).toEqual(["cs999-fa26", "cs998-fa26"]);
    expect(result.rejected).toEqual(["broken: missing label"]);
  });

  it("drops a duplicate id rather than letting it shadow", () => {
    const result = validateRegistry(JSON.stringify({ adapters: [ADAPTER, ADAPTER] }));
    expect(result.adapters).toHaveLength(1);
    expect(result.rejected[0]).toMatch(/duplicate id/);
  });

  it("throws on a document that is not a registry, so the old copy is kept", () => {
    expect(() => validateRegistry("not json")).toThrow(/not JSON/);
    expect(() => validateRegistry("{}")).toThrow(/no adapters array/);
    expect(() => validateRegistry(JSON.stringify({ adapters: "x" }))).toThrow(/no adapters/);
    expect(() => validateRegistry(`{"adapters":[]}` + " ".repeat(600_000))).toThrow(/over the/);
  });

  it("accepts the bundled registry that actually ships", () => {
    const bundled = readFileSync(new URL("../adapters/registry.json", import.meta.url), "utf8");
    const result = validateRegistry(bundled);
    expect(result.rejected).toEqual([]);
  });
});

describe("host patterns and terms", () => {
  it("matches an exact host and a wildcard subdomain", () => {
    const url = new URL("https://courses.grainger.illinois.edu/cs999/x");
    expect(matchesHostPattern("https://courses.grainger.illinois.edu/*", url)).toBe(true);
    expect(matchesHostPattern("https://*.illinois.edu/*", url)).toBe(true);
    expect(matchesHostPattern("https://cs.illinois.edu/*", url)).toBe(false);
    expect(matchesHostPattern("http://courses.grainger.illinois.edu/*", url)).toBe(false);
    expect(matchesHostPattern("courses.grainger.illinois.edu", url)).toBe(false);
  });

  it("derives a term code from the date", () => {
    expect(currentTermCode(new Date(2026, 8, 10))).toBe("fa26");
    expect(currentTermCode(new Date(2026, 1, 10))).toBe("sp26");
    expect(currentTermCode(new Date(2026, 5, 10))).toBe("su26");
  });

  it("hides an adapter from another term (§4.5: adapters expire)", () => {
    expect(isCurrentTerm(ADAPTER, "fa26")).toBe(true);
    expect(isCurrentTerm(ADAPTER, "sp27")).toBe(false);
  });
});

describe("the CS 424 seed adapter, against its real captured page", () => {
  const registry = JSON.parse(
    readFileSync(new URL("../adapters/registry.json", import.meta.url), "utf8"),
  ) as { adapters: Adapter[] };
  const cs424 = registry.adapters.find((a) => a.id === "cs424-fa26")!;
  const schedule = doc(
    readFileSync(new URL("../fixtures/sites/cs424-fa2026-schedule.html", import.meta.url), "utf8"),
  );
  const ctx: PageCtx = { url: cs424.url, fetchedAt: "2026-09-10T18:00:00.000Z" };
  const items = runAdapter(cs424, schedule, ctx);

  it("ships a valid adapter", () => {
    expect(validateAdapter(cs424).adapter).toBeDefined();
  });

  it("finds every deadline on the page and nothing else", () => {
    expect(items.map((i) => i.title)).toEqual([
      "HW1 Due",
      "HW2 Due",
      "HW3 Due",
      "MP1 Due",
      "HW4 Due",
      "MP2 Due",
      "HW5 Due",
      "HW6 Due",
      "MP3 Due",
    ]);
  });

  it("dates all of them, across the CDT→CST flip", () => {
    expect(items.every((i) => i.dueAt !== undefined)).toBe(true);
    expect(items.find((i) => i.title === "HW2 Due")!.dueAt).toBe("2026-09-23T23:59:00-05:00");
    // November is on the other side of the DST boundary.
    expect(items.find((i) => i.title === "HW5 Due")!.dueAt).toBe("2026-11-18T23:59:00-06:00");
  });

  it("splits a cell holding two events and keeps only the deadline", () => {
    // The HW/MP column reads "HW5 Due; HW6 Out" — one deadline and one release.
    // Without splitTitle the row yields a single nonsense title, and `filter`
    // cannot reach inside it to reject the half that is not a deadline.
    expect(items.some((i) => i.title.includes("Out"))).toBe(false);
    expect(items.filter((i) => i.title.startsWith("HW5")).map((i) => i.title)).toEqual(["HW5 Due"]);
  });

  it("emits nothing for a row that only announces a release", () => {
    // "HW3 Out" on 9/25 is not a deadline; a phantom item there would cost G2
    // precision as surely as a missing one costs recall.
    expect(items.some((i) => i.dueAt?.startsWith("2026-09-25"))).toBe(false);
  });

  it("reads the date column despite rowspan shifting every row's cell count", () => {
    // Rows carry 7, 6, 5, 4 or 1 cells depending on whether they open a unit
    // block, so nth-child is wrong half the time and nth-last-child is wrong for
    // the 5-cell rows. The spacer cells are the ones marked .auto-style6.
    expect(items.find((i) => i.title === "HW1 Due")!.dueAt).toBe("2026-09-16T23:59:00-05:00"); // 5 cells
    expect(items.find((i) => i.title === "HW3 Due")!.dueAt).toBe("2026-10-02T23:59:00-05:00"); // 6 cells
    expect(items.find((i) => i.title === "MP3 Due")!.dueAt).toBe("2026-12-09T23:59:00-06:00"); // 7 cells, spacer has no rowspan
  });

  it("normalizes to badges that could merge with another source", () => {
    // "HW3 Due" → {hw3}: "due" is filler (§5.2), so this would meet a Gradescope
    // "Homework 3" if CS 424 ever posted one there.
    expect([...normalizeTitle(items[2]!.title)]).toEqual(["hw3"]);
  });
});

/**
 * The bundled registry (§4.5).
 *
 * These are regression tests for a shipped bug: `adapters/registry.json` was
 * copied into `dist/` by the build and then never read by anything. The only
 * code path that filled `store.registry.adapters` was the daily GitHub fetch,
 * so with no registry published at that URL the stored list stayed empty
 * forever — the options page listed no course sites, the CS 424 adapter could
 * not be enabled, and no item was ever labelled `WEB`.
 */
describe("the bundled registry", () => {
  const text = readFileSync(new URL("../adapters/registry.json", import.meta.url), "utf8");

  it("is what the extension actually ships", () => {
    // Guards the build step that copies it: a registry that never reaches
    // dist/ cannot be fetched from chrome.runtime.getURL at runtime.
    const shipped = readFileSync(new URL("../dist/adapters/registry.json", import.meta.url), "utf8");
    expect(JSON.parse(shipped)).toEqual(JSON.parse(text));
  });

  it("validates with nothing rejected", () => {
    const { adapters, rejected } = validateRegistry(text);
    // A bundled entry that fails validation is a mistake in this repo, not
    // untrusted remote data, so unlike a fetched file it must be clean.
    expect(rejected).toEqual([]);
    expect(adapters.length).toBeGreaterThan(0);
  });

  it("seeds an empty store and leaves a refreshed one alone", () => {
    const { adapters } = validateRegistry(text);
    expect(shouldSeedFromBundle([], adapters)).toBe(true);
    // A refresh that has already landed is newer than whatever shipped in the
    // .crx; seeding over it would undo the fix the refresh exists to deliver.
    expect(shouldSeedFromBundle(adapters, adapters)).toBe(false);
    expect(shouldSeedFromBundle([], [])).toBe(false);
  });
});

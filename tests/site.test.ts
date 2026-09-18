/**
 * §4.5's declarative adapter runner and its registry.
 *
 * The registry is the only place this extension ingests data authored
 * elsewhere, so its validation is a trust boundary rather than a formality.
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import {
  clockFromText,
  matchDueLabel,
  parseAdapterDate,
  parseAdapterDateParts,
  resolveTitleFrom,
  runAdapter,
  statedTimeInText,
  supportedDateFormats,
  titleWithLabel,
} from "../src/sources/site.js";
import {
  currentTermCode,
  isCurrentTerm,
  matchesHostPattern,
  shouldSeedFromBundle,
  validateAdapter,
  validateRegistry,
} from "../src/core/registry.js";
import { normalizeTitle } from "../src/core/normalize.js";
import { dedupe } from "../src/core/dedupe.js";
import { examBoard } from "../src/core/calendar.js";
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

  it("refuses anything that is not https", () => {
    expect(validateAdapter({ ...ADAPTER, url: "http://courses.grainger.illinois.edu/x" }).reason).toMatch(
      /https/,
    );
  });

  /**
   * AMENDED 2026-09-12. This test used to require `.illinois.edu` and was
   * therefore pinning the defect: §2.3 assumed course sites were subdomains of
   * illinois.edu, and the CS department's are their own domains — cs124.org,
   * cs128.org, cs225.org — so the rule excluded the students most likely to
   * want the feature. `optional_host_permissions` covers every https host now,
   * and the exact-`hostPattern` rule below is what keeps that safe.
   */
  it("accepts a course site on its own domain, not just illinois.edu", () => {
    const own = { ...ADAPTER, url: "https://cs124.org/fall2026/", hostPattern: "https://cs124.org/*" };
    expect(validateAdapter(own).adapter).toBeDefined();
  });

  it("refuses a host the extension has already been granted", () => {
    // Those need no `permissions.request`, so enabling one would prompt for
    // nothing and read Canvas under a permission granted at install for
    // something else. The exact-hostPattern rule cannot catch this: the pattern
    // is exact *and* already held.
    const sneaky = {
      ...ADAPTER,
      url: "https://canvas.illinois.edu/courses/1/anything",
      hostPattern: "https://canvas.illinois.edu/*",
    };
    expect(validateAdapter(sneaky).reason).toMatch(/already granted/);
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

  it("marks every one of those times as assumed", () => {
    // The page prints "HW1 Due" against a bare date and no time at all, so the
    // 23:59 on every row is §4.5's default, not something CS 424 stated. The
    // flag is what stops §5.3 preferring it over a real Canvas deadline, so the
    // runner has to actually set it — not just be capable of setting it.
    expect(items.every((i) => i.extra?.["timeAssumed"] === "true")).toBe(true);
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

/**
 * An assumed time must not outrank a real one (§5.3 + §4.5).
 *
 * Regression for a defect found on live data: CS 424's schedule page prints
 * "HW1 Due" against a bare date and no time, §4.5's runner fills in 23:59, and
 * SOURCE_RANK puts `site` above `canvas` — so the invented instant replaced the
 * real Canvas deadline on the merged row, which then looked authoritative.
 */
describe("assumed times in a merge", () => {
  const dueRow = (extra: Record<string, string>, dueAt: string) => ({
    source: "site",
    sourceId: `x:${dueAt}`,
    courseRaw: "CS 424 course site",
    courseCode: "CS424",
    title: "HW1 Due",
    kind: "assignment",
    dueAt,
    url: "https://courses.grainger.illinois.edu/cs424/",
    status: "unknown",
    extra,
    fetchedAt: "2026-09-10T12:00:00.000Z",
  });

  const canvasRow = (dueAt: string) => ({
    source: "canvas",
    sourceId: "c1",
    courseRaw: "CS 424",
    courseCode: "CS424",
    title: "Homework 1",
    kind: "assignment",
    dueAt,
    url: "https://canvas.illinois.edu/courses/1/assignments/1",
    status: "unknown",
    extra: {},
    fetchedAt: "2026-09-10T12:00:00.000Z",
  });

  const overrides = { mergeGroups: [], splitKeys: [], hiddenKeys: [], disabledCourses: [], doneKeys: [], keptCourses: [], courseNames: {} };

  it("prefers Canvas's real instant over the runner's 23:59", () => {
    const real = "2026-09-16T17:00:00.000-05:00";
    const items = dedupe(
      [dueRow({ timeAssumed: "true" }, "2026-09-16T23:59:00.000-05:00"), canvasRow(real)] as never,
      overrides,
    );
    const row = items.find((i) => i.courseCode === "CS424")!;
    expect(row.members).toHaveLength(2);
    expect(row.dueAt).toBe(real);
  });

  it("still lets a site that prints a real time win, as §5.3 intends", () => {
    const stated = "2026-09-16T17:00:00.000-05:00";
    const items = dedupe(
      [dueRow({}, stated), canvasRow("2026-09-16T23:59:00.000-05:00")] as never,
      overrides,
    );
    expect(items.find((i) => i.courseCode === "CS424")!.dueAt).toBe(stated);
  });

  it("falls back to the assumed time when it is the only one", () => {
    const assumed = "2026-09-16T23:59:00.000-05:00";
    const items = dedupe([dueRow({ timeAssumed: "true" }, assumed)] as never, overrides);
    expect(items[0]!.dueAt).toBe(assumed);
  });

  it("marks a bare date assumed and a stated time not assumed", () => {
    const at = (raw: string) =>
      parseAdapterDateParts(raw, "M/d", "America/Chicago", "2026-09-10T12:00:00.000Z");
    expect(at("9/16")!.timeAssumed).toBe(true);
    expect(at("9/16 5:00 pm")!.timeAssumed).toBe(false);
  });
});

describe("adapter date grammar against real fa26 course pages (§4.5)", () => {
  const TZ = "America/Chicago";
  const REF = "2026-09-10T18:00:00.000Z";
  const parse = (raw: string, format: string) => parseAdapterDateParts(raw, format, TZ, REF);
  /** Local wall clock of the parsed instant, so the assertions read as a page does. */
  const local = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      timeZone: TZ,
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  it("reads a time after @, which used to be dropped silently", () => {
    // ECE 310 prints "09/04 @ 11:59pm". The format matched "09/04", ignored the
    // rest, and reported timeAssumed — inventing 23:59 while the real cutoff
    // sat unread in the same string. It landed on the right instant only by the
    // coincidence that the invention and the truth agreed.
    const at = parse("09/04 @ 11:59pm", "M/d")!;
    expect(at.timeAssumed).toBe(false);
    expect(local(at.iso)).toBe("Sep 04, 23:59");
  });

  it("reads a 24-hour time after 'at'", () => {
    // ECE 391: "Due Friday, September 4 at 18:00 US Central time" — the trailing
    // zone text is ignored, the time is not.
    const at = parse("Friday, September 4 at 18:00 US Central time", "MMM d, h:mm a")!;
    expect(at.timeAssumed).toBe(false);
    expect(local(at.iso)).toBe("Sep 04, 18:00");
  });

  it("accepts a weekday prefix", () => {
    // CS 374 prints "Tue Sep 08"; CS 357's own page prints "Tue, Sep 08".
    expect(local(parse("Tue Sep 08", "MMM d, h:mm a")!.iso)).toBe("Sep 08, 23:59");
    expect(local(parse("Tue, Sep 08", "MMM d, h:mm a")!.iso)).toBe("Sep 08, 23:59");
    expect(parse("Tue Sep 08", "MMM d, h:mm a")!.timeAssumed).toBe(true);
  });

  it("accepts an ISO date with a 24-hour time", () => {
    const at = parse("2026-09-11 23:59", "yyyy-MM-dd")!;
    expect(at.timeAssumed).toBe(false);
    expect(local(at.iso)).toBe("Sep 11, 23:59");
  });

  it("refuses to guess an ambiguous bare time, and records it", () => {
    // "5:00" could be either. Reading it as 05:00 would move a 5 PM deadline
    // twelve hours earlier while looking exactly like a stated time.
    const at = parse("Sep 11 at 5:00", "MMM d, h:mm a")!;
    expect(at.timeAssumed).toBe(true);
    expect(at.unparsedTime).toBe("5:00");
  });

  it("accepts a leading-zero hour as 24-hour, which is unambiguous", () => {
    // Nobody writes an evening deadline as "09:00".
    const at = parse("Sep 11 at 09:00", "MMM d, h:mm a")!;
    expect(at.timeAssumed).toBe(false);
    expect(local(at.iso)).toBe("Sep 11, 09:00");
  });

  it("still assumes 23:59 when the page really states no time", () => {
    const at = parse("Sep 11", "MMM d, h:mm a")!;
    expect(at.timeAssumed).toBe(true);
    expect(at.unparsedTime).toBeUndefined();
    expect(local(at.iso)).toBe("Sep 11, 23:59");
  });

  it("ignores trailing text that is not a time", () => {
    const at = parse("Sep 11 (no late work accepted)", "MMM d, h:mm a")!;
    expect(at.unparsedTime).toBeUndefined();
    expect(at.timeAssumed).toBe(true);
  });

  it("records a tail that looks like a time it could not read", () => {
    expect(parse("Sep 11 — due by 11:59 pm sharp", "MMM d, h:mm a")!.unparsedTime).toContain(
      "11:59",
    );
  });

  it("keeps a 12-hour time with a meridiem working", () => {
    expect(local(parse("Sep 11, 11:59 pm", "MMM d, h:mm a")!.iso)).toBe("Sep 11, 23:59");
    expect(local(parse("September 11 at 5pm", "MMM d, h:mm a")!.iso)).toBe("Sep 11, 17:00");
  });
});

describe("header-anchored columns, against the real ECE 310 page", () => {
  const ADAPTER = {
    id: "ece310-fa26",
    label: "ECE 310 course site",
    courseCode: "ECE310",
    term: "fa26",
    url: "https://courses.grainger.illinois.edu/ece310/fa2026/",
    hostPattern: "https://courses.grainger.illinois.edu/*",
    rows: "#homework table.timetable tbody tr",
    columns: { title: "Exercises", due: "Due Date|Deadline", link: "Exercises" },
    title: "td:nth-child(1)",
    due: "td:nth-child(2)",
    dateFormat: "M/d",
    timezone: "America/Chicago",
    minExtensionVersion: "0.1.0",
  } as unknown as Adapter;

  const doc = () =>
    parseHTML(
      readFileSync(new URL("../fixtures/sites/ece310-fa2026-index.html", import.meta.url), "utf8"),
    ).document as unknown as Document;
  const page = { url: ADAPTER.url, fetchedAt: "2026-09-10T18:00:00.000Z" };
  const local = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  it("reads every homework off the real page", () => {
    expect(runAdapter(ADAPTER, doc(), page)).toHaveLength(13);
  });

  it("gets the dates right, and the time the page actually states", () => {
    // "09/04 @ 11:59pm". Before the `@` separator was understood, the format
    // matched "09/04", threw the time away and invented 23:59 — landing on the
    // right instant only by the coincidence that the two agree.
    const items = runAdapter(ADAPTER, doc(), page);
    expect(local(items[0]!.dueAt!)).toBe("09/04, 23:59");
    expect(local(items[1]!.dueAt!)).toBe("09/11, 23:59");
    expect(items.every((i) => i.extra?.["timeAssumed"] === undefined)).toBe(true);
  });

  it("survives a column being inserted, which nth-child does not", () => {
    // House rule 3, the whole reason `columns` exists. A course adding a
    // "Points" column shifts every index by one; the header is re-read each
    // parse, so nothing moves.
    const shifted = doc();
    for (const row of shifted.querySelectorAll("#homework table.timetable tr")) {
      const cell = shifted.createElement(row.querySelector("th") ? "th" : "td");
      cell.textContent = row.querySelector("th") ? "Points" : "10";
      row.insertBefore(cell, row.firstChild);
    }
    const items = runAdapter(ADAPTER, shifted, page);
    expect(items).toHaveLength(13);
    expect(local(items[0]!.dueAt!)).toBe("09/04, 23:59");
    // The title has to move with it. Reading nth-child(1) here would name every
    // row after the inserted cell.
    expect(items[0]!.title).toBe("Homework 1");

    // And the positional fallback really would have broken, which is what makes
    // the point above worth anything.
    const positional = { ...ADAPTER, columns: undefined } as unknown as Adapter;
    expect(local(runAdapter(positional, shifted, page)[0]!.dueAt!)).not.toBe("09/04, 23:59");
  });

  it("does not pick a column whose header merely contains 'due'", () => {
    // This very page is the counterexample: its *schedule* table has a header
    // "Assessment Due" whose cells hold "HW1", not dates. A substring match on
    // "due" reads an assignment name as a deadline (house rule 6).
    const wrong = { ...ADAPTER, columns: { title: "Exercises", due: "Due" } } as unknown as Adapter;
    expect(() => runAdapter(wrong, doc(), page)).toThrow(ParseError);
  });

  it("throws when a named column is gone, rather than parsing nothing", () => {
    const renamed = {
      ...ADAPTER,
      columns: { title: "Exercises", due: "Deadline" },
    } as unknown as Adapter;
    // §0 rule 3: the header vanishing is a redesign, and the error has to name
    // the column so the fix is one registry edit.
    expect(() => runAdapter(renamed, doc(), page)).toThrow(/Deadline/);
  });

  it("takes the first of two identically named columns, not the last", () => {
    // A table with two columns of one name is ambiguous, and silently taking
    // whichever came last is a coin flip that changes with a page edit.
    const doubled = parseHTML(`<table>
      <thead><tr><th>Exercises</th><th>Due Date</th><th>Due Date</th></tr></thead>
      <tbody><tr><td>Homework 1</td><td>09/04 @ 11:59pm</td><td>12/25 @ 11:59pm</td></tr></tbody>
    </table>`).document as unknown as Document;
    const simple = { ...ADAPTER, rows: "tbody tr" } as unknown as Adapter;
    expect(local(runAdapter(simple, doubled, page)[0]!.dueAt!)).toBe("09/04, 23:59");
  });

  it("falls back to the adapter URL, because the page links over http", () => {
    // The homework PDFs are linked as `http://…`. House rule 7: an insecure or
    // off-origin href is not silently upgraded, it is the fallback.
    for (const item of runAdapter(ADAPTER, doc(), page)) {
      expect(item.url).toBe(ADAPTER.url);
    }
  });
});

/**
 * ECE 391's schedule, captured 2026-09-12 from the live public page after a
 * beta tester reported "it's not reading the ece 391 page that well".
 *
 * The report turned out to be three separate things, and only one was a bug:
 *
 * 1. The adapter was pointed at the course's landing page, whose only `<table>`
 *    is instructor office hours. There are no deadlines on it to read.
 * 2. `exams.html` says "Time and location to be determined" for all three
 *    exams. There is nothing there either — the extension was right to show
 *    nothing, and the tester could not tell that apart from a failure.
 * 3. `schedule.html` **can** be read, and reading it exposed the real defect:
 *    every deadline landed at 23:59 when the page plainly says 18:00.
 *
 * The 9-digit numbers in this fixture are MediaSpace channel ids on public
 * lecture-recording links, not student identifiers.
 */
describe("ECE 391's schedule (a real page, a real beta report)", () => {
  const doc = () =>
    parseHTML(
      readFileSync(new URL("../fixtures/site/ece391-schedule.html", import.meta.url), "utf8"),
    ).document as unknown as Document;

  const ECE391 = {
    id: "ece391-fa26",
    label: "ECE 391 course site",
    courseCode: "ECE391",
    term: "fa26",
    url: "https://courses.grainger.illinois.edu/ece391/fa2026/schedule.html",
    hostPattern: "https://courses.grainger.illinois.edu/*",
    rows: "table tr",
    title: "td:nth-child(2)",
    due: "td:nth-child(1)",
    dateFormat: "MMM d, h:mm a",
    timezone: "America/Chicago",
    // Most rows are lectures and discussions. The word that makes a row a
    // deadline is the one that selects it.
    filter: { include: "\\bdue\\b" },
    minExtensionVersion: "1.0.0",
  } as never;

  const run = () =>
    runAdapter(ECE391, doc(), {
      url: "https://courses.grainger.illinois.edu/ece391/fa2026/schedule.html",
      fetchedAt: "2026-09-12T18:00:00.000Z",
    });

  it("finds the machine problems and none of the lectures", () => {
    const items = run();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.title.toLowerCase()).toContain("due");
    expect(items.some((i) => i.title.startsWith("MP0"))).toBe(true);
  });

  it("reads the 18:00 the page states, rather than inventing 23:59", () => {
    /*
     * The defect this fixture exists for. The date cell is `Fri, Aug 28` and
     * states no time, so `timeAssumed` fired and the row landed at 23:59 —
     * **six hours late**, and a two-hour reminder for it would have arrived at
     * 21:59, nearly four hours after the deadline passed.
     *
     * Worker rule 3: whenever a default is filled in, ask what downstream
     * treats it as authoritative. §5.3 ranks `site` above `canvas` for `dueAt`,
     * so this invention could also overwrite a real instructor-set deadline.
     */
    const mp0 = run().find((i) => i.title.startsWith("MP0"))!;
    expect(mp0.dueAt).toMatch(/T18:00/);
    expect(mp0.extra?.["timeAssumed"]).toBeUndefined();
  });
});

/**
 * `statedTimeInText` on constructed strings.
 *
 * The ECE 391 fixture proves the fix works and cannot prove much else: every
 * one of its rows says "due at 18:00", so precedence, ambiguity and the
 * anchoring all survived mutation against it. Parser rule 10 — where a
 * realistic capture cannot tell a right implementation from a wrong one, the
 * values are built on purpose and said to be built on purpose.
 */
describe("statedTimeInText", () => {
  it("reads a cutoff the row states in prose", () => {
    expect(statedTimeInText("MP0 due at 18:00 US Central time")).toEqual({ hour: 18, minute: 0 });
    expect(statedTimeInText("Homework 3 due by 11:59 pm")).toEqual({ hour: 23, minute: 59 });
    expect(statedTimeInText("Lab due at 5pm")).toEqual({ hour: 17, minute: 0 });
    expect(statedTimeInText("Quiz due at noon")).toEqual({ hour: 12, minute: 0 });
    expect(statedTimeInText("Essay due by midnight")).toEqual({ hour: 0, minute: 0 });
  });

  it("ignores a time that is not this row's deadline", () => {
    // A schedule row is full of times — lecture slots, office hours, discussion
    // sections. Matching any of them would read this as a 9am deadline.
    expect(statedTimeInText("Lect at 9:00, MP1 due")).toBeUndefined();
    expect(statedTimeInText("Office hours at 4pm")).toBeUndefined();
  });

  it("refuses a bare time that could mean either end of the day", () => {
    // The same rule the date parser uses. Guessing `5:00` as 05:00 would move a
    // 5 PM deadline twelve hours earlier while looking like a stated time.
    expect(statedTimeInText("MP2 due at 5:00")).toBeUndefined();
    expect(statedTimeInText("MP2 due at 05:00")).toEqual({ hour: 5, minute: 0 });
    expect(statedTimeInText("MP2 due at 17:00")).toEqual({ hour: 17, minute: 0 });
  });

  it("finds nothing in a row that states no time", () => {
    for (const text of ["MP3 due", "Disc: RISC-V Assembly", ""]) {
      expect(statedTimeInText(text), text).toBeUndefined();
    }
  });

  it("is only consulted when the date cell states no time of its own", () => {
    /*
     * A time beside the date is this row's own answer. If the cell says
     * `Sep 4, 11:59 pm` and the title says "due at 5pm", the cell wins — it is
     * the field the adapter was pointed at, and the prose is a fallback for
     * when that field is silent, not a competitor to it.
     */
    const withTime = parseAdapterDateParts(
      "Sep 4, 11:59 pm",
      "MMM d, h:mm a",
      "America/Chicago",
      "2026-09-01T12:00:00.000Z",
      { hour: 17, minute: 0 },
    );
    expect(withTime?.iso).toMatch(/T23:59/);
    expect(withTime?.timeAssumed).toBe(false);

    const withoutTime = parseAdapterDateParts(
      "Sep 4",
      "MMM d, h:mm a",
      "America/Chicago",
      "2026-09-01T12:00:00.000Z",
      { hour: 17, minute: 0 },
    );
    expect(withoutTime?.iso).toMatch(/T17:00/);
    expect(withoutTime?.timeAssumed).toBe(false);
  });

  it("still invents 23:59 when nothing anywhere states a time", () => {
    // And still says so, because §5.3 ranks `site` above `canvas` and an
    // invented instant must never outrank a real one silently.
    const guessed = parseAdapterDateParts(
      "Sep 4",
      "MMM d, h:mm a",
      "America/Chicago",
      "2026-09-01T12:00:00.000Z",
    );
    expect(guessed?.iso).toMatch(/T23:59/);
    expect(guessed?.timeAssumed).toBe(true);
  });
});

/**
 * ECE 411 — §4.5's third page shape, and a course split over two pages.
 *
 * Neither of the first two shapes fits. CS 424's rowspan grid and ECE 310's
 * header table are tables; this is a Sphinx page whose deadlines are
 * `Due: 9/7` lines in a `<ul>` under an `<h3>`, and whose exam dates are on a
 * different page from its assignments — "an adapter is one fixed URL", so the
 * course is two registry entries rather than one adapter that can only ever
 * read half of it.
 *
 * Both fixtures are unmodified `curl` captures of the public pages (no login),
 * taken 2026-09-18.
 */
describe("ECE 411: a list-shaped page, and a course on two pages", () => {
  const registryText = readFileSync(
    new URL("../adapters/registry.json", import.meta.url),
    "utf8",
  );
  const shipped = (id: string): Adapter => {
    const found = validateRegistry(registryText).adapters.find((a) => a.id === id);
    if (!found) throw new Error(`no adapter ${id} in the bundled registry`);
    return found;
  };
  const load = (name: string) =>
    doc(readFileSync(new URL(`../fixtures/sites/${name}`, import.meta.url), "utf8"));

  // A Friday in the middle of the term, so §3.2's year inference resolves both
  // "9/7" (just behind it) and "September 29" (just ahead) to 2026.
  const fa26: PageCtx = {
    url: "https://courses.grainger.illinois.edu/ece411/fa2026/assignments.html",
    fetchedAt: "2026-09-18T12:00:00.000Z",
  };

  describe("the MP page", () => {
    const items = runAdapter(shipped("ece411-fa26-mp"), load("ece411-fa2026-assignments.html"), fa26);

    it("reads the two MPs that have a date, and titles them from their heading", () => {
      // The `<li>` says only "Due: 9/7". The name is the `<h3>` above the list,
      // which no row-relative selector can reach — that is what `titleFrom` is.
      expect(items.map((i) => i.title).sort()).toEqual(["mp_setup", "mp_verif"]);
      for (const item of items) expect(item.dueAt).toBe("2026-09-07T23:59:00-05:00");
    });

    it("says the 23:59 is its own invention", () => {
      // Worker rule 3: the page states a date and no clock. §5.3 ranks `site`
      // above `canvas`, so an unmarked invention would overwrite a real
      // instructor-set deadline and look authoritative doing it.
      for (const item of items) expect(item.extra?.["timeAssumed"]).toBe("true");
    });

    it("emits nothing at all for a TBD line — not even an undated row", () => {
      // mp_cache, and every checkpoint of mp_pipeline and mp_ooo, read "TBD".
      // An undated row for each would be eleven items claiming to be deadlines
      // whose date this parser merely failed to read, which is the opposite of
      // what the page says.
      expect(items).toHaveLength(2);
      expect(items.some((i) => i.dueAt === undefined)).toBe(false);
      expect(items.some((i) => i.extra?.["unparsedDate"] !== undefined)).toBe(false);
    });

    it("ignores a line whose label it was not told about", () => {
      // "Release: 8/25" is the same `<li>` shape as "Due: 9/7" and parses just
      // as cleanly. Nothing but the label says it is not a deadline.
      expect(items.some((i) => i.dueAt?.startsWith("2026-08-25"))).toBe(false);
    });

    it("gives every row a url on the source origin", () => {
      for (const item of items) expect(item.url).toBe(fa26.url);
    });
  });

  /**
   * The live page has every checkpoint at "TBD", so it cannot show what happens
   * when they are dated — parser rule 10's case exactly. The dated fixture is
   * derived from it and is deliberately unrealistic; its own banner says how.
   */
  describe("the MP page with its checkpoints dated (adversarial fixture)", () => {
    const items = runAdapter(
      shipped("ece411-fa26-mp"),
      load("ece411-fa2026-assignments-dated.html"),
      fa26,
    );

    it("titles each checkpoint with its MP and its label", () => {
      expect(items.map((i) => i.title)).toContain("mp_pipeline CP1");
      expect(items.map((i) => i.title)).toContain("mp_pipeline CP2");
      expect(items.map((i) => i.title)).toContain("mp_pipeline CP3");
      expect(items.find((i) => i.title === "mp_pipeline CP1")!.dueAt).toBe(
        "2026-09-22T23:59:00-05:00",
      );
    });

    it("gives the three checkpoints three sourceIds", () => {
      // §3.1 hashes the title, and §3's `raw` is keyed by memberKey, so three
      // rows titled "mp_pipeline" would silently collapse into one (house rule
      // 4). The label suffix is the only thing preventing that.
      const cps = items.filter((i) => i.title.startsWith("mp_pipeline"));
      expect(new Set(cps.map((i) => i.sourceId)).size).toBe(cps.length);
      expect(cps).toHaveLength(3);
    });

    it("does not read 'Due Date: 11/3' as the 'Due' label", () => {
      // House rule 6. "Due Date" contains "Due"; a substring match dates
      // mp_pipeline from a line the adapter never asked for, and nothing on the
      // page would look wrong.
      expect(items.some((i) => i.dueAt?.startsWith("2026-11-03"))).toBe(false);
      expect(items.some((i) => i.title === "mp_pipeline")).toBe(false);
    });

    it("drops an N/A line the same way it drops TBD", () => {
      expect(items.some((i) => i.title === "mp_pipeline Advance Features")).toBe(false);
    });

    it("keeps 'Due' out of the title it builds", () => {
      // Every deadline line on the page carries it, so it names nothing:
      // "mp_setup Due" is noise, "mp_pipeline CP1 Due" doubly so.
      for (const item of items) expect(item.title).not.toMatch(/\bDue\b/);
    });
  });

  describe("the syllabus page, where the exams live", () => {
    const items = runAdapter(
      shipped("ece411-fa26-exams"),
      load("ece411-fa2026-syllabus.html"),
      { ...fa26, url: "https://courses.grainger.illinois.edu/ece411/fa2026/syllabus.html" },
    );

    it("puts Midterm 1 at the hour the sibling bullet states", () => {
      // "Midterm 1: September 29" states no clock; "Time: 7-9PM" is in a
      // different `<li>`. Without `time` this lands at 23:59 — four and a half
      // hours after the exam ended, and a two-hour reminder for it would fire
      // at 21:59, after it ended too.
      const mt1 = items.find((i) => i.title === "Midterm 1")!;
      expect(mt1.dueAt).toBe("2026-09-29T19:00:00-05:00");
      expect(mt1.extra?.["timeAssumed"]).toBeUndefined();
    });

    it("reads Midterm 2 across the DST boundary", () => {
      const mt2 = items.find((i) => i.title === "Midterm 2")!;
      expect(mt2.dueAt).toBe("2026-11-10T19:00:00-06:00");
      expect(mt2.extra?.["timeAssumed"]).toBeUndefined();
    });

    it("excludes the final, which is TBD in both fields", () => {
      expect(items.map((i) => i.title)).toEqual(["Midterm 1", "Midterm 2"]);
    });

    it("calls them exams, because that is what this page lists", () => {
      /*
       * `runAdapter` stamped `kind: "assignment"` on every row it ever produced,
       * so this page — whose only rows are Midterm 1, Midterm 2 and the final —
       * put two midterms into the homework list and left the Exams tab empty for
       * a course that has them. The registry entry now says `"kind": "exam"`,
       * and that is the only page-level fact that decides it.
       */
      for (const item of items) expect(item.kind).toBe("exam");
    });

    it("reaches the popup's Exams tab, which is the point of the field", () => {
      /*
       * `kind` is only worth having if it survives to the surface that reads it.
       * `examBoard` keeps `kind === "exam"` and drops everything else, so before
       * this field a course with two midterms on its syllabus had an empty Exams
       * tab — the one place a student looks for exactly these two rows.
       *
       * The wrapping here is what `core/dedupe.ts` does to a RawItem; only
       * `kind` and `dueAt` matter to the board.
       */
      const board = examBoard(
        items.map((raw) => ({
          id: raw.sourceId,
          members: [raw],
          courseLabel: raw.courseCode ?? raw.courseRaw,
          title: raw.title,
          kind: raw.kind,
          dueAt: raw.dueAt,
          url: raw.url,
          status: raw.status,
          hidden: false,
          done: false,
          notified: {},
        })),
        new Date("2026-09-11T05:00:00.000Z"),
      );
      expect(board.upcoming.map((p) => p.item.title)).toEqual(["Midterm 1", "Midterm 2"]);
    });

    it("titles the exam from the label, not from the whole due line", () => {
      // Here the title cell *is* the due line — "Midterm 1: September 29" — so
      // the cell carries no name beyond the label.
      expect(items.some((i) => i.title.includes("September"))).toBe(false);
    });
  });

  describe("the registry entries", () => {
    it("ships two ids under one courseCode", () => {
      // The whole point: an adapter has one fixed `url`, and this course keeps
      // assignments and exams on different pages, so half of it could never be
      // read by a single entry. Only `id` has to be unique.
      const { adapters, rejected } = validateRegistry(registryText);
      expect(rejected).toEqual([]);
      const ece411 = adapters.filter((a) => a.courseCode === "ECE411");
      expect(ece411.map((a) => a.id)).toEqual(["ece411-fa26-mp", "ece411-fa26-exams"]);
      expect(new Set(ece411.map((a) => a.url)).size).toBe(2);
    });

    it("carries the exam page's kind through validation", () => {
      // `kind` is remote data that decides which surface an item lands on, so
      // it clears the trust boundary like everything else — and a validator
      // that dropped it would leave the page labelled assignments again.
      const { adapters } = validateRegistry(registryText);
      expect(adapters.find((a) => a.id === "ece411-fa26-exams")!.kind).toBe("exam");
      expect(adapters.find((a) => a.id === "ece411-fa26-mp")!.kind).toBeUndefined();
    });
  });

  describe("`kind` as a validated field", () => {
    const base = JSON.parse(registryText).adapters.find(
      (a: { id: string }) => a.id === "ece411-fa26-exams",
    ) as Record<string, unknown>;

    it("refuses a kind outside the union", () => {
      // A typo would otherwise reach `Item.kind` as a value no UI switch has a
      // branch for.
      const { adapter, reason } = validateAdapter({ ...base, kind: "midterm" });
      expect(adapter).toBeUndefined();
      expect(reason).toContain("kind");
    });

    it("refuses a kind that is not a string at all", () => {
      expect(validateAdapter({ ...base, kind: 3 }).adapter).toBeUndefined();
    });

    it("refuses a kind borrowed from Object.prototype", () => {
      // `kind in ADAPTER_KINDS` is an `in` check, and `"constructor" in {}` is
      // true. A deliberately unrealistic value, because a realistic one cannot
      // tell a prototype-walking check from a correct one (parser rule 10).
      expect(validateAdapter({ ...base, kind: "constructor" }).adapter).toBeUndefined();
      expect(validateAdapter({ ...base, kind: "toString" }).adapter).toBeUndefined();
    });

    it("accepts every kind the union names", () => {
      for (const kind of ["assignment", "quiz", "exam", "booking", "event", "other"]) {
        expect(validateAdapter({ ...base, kind }).adapter, kind).toBeDefined();
      }
    });

    it("accepts an entry that names no kind, like every entry written before it", () => {
      const { kind, ...without } = base;
      void kind;
      expect(validateAdapter(without).adapter).toBeDefined();
    });
  });
});

describe("the list-shaped page's three fields, in isolation", () => {
  const rowsOf = (html: string, selector: string) =>
    Array.from(doc(html).querySelectorAll(selector));

  describe("matchDueLabel", () => {
    it("matches a declared label exactly, after normalising space and case", () => {
      expect(matchDueLabel("  CP1   due :  9/22 ", "Due|CP1 Due")).toEqual({
        label: "CP1 Due",
        rest: "9/22",
      });
    });

    it("refuses a label that merely contains a declared one", () => {
      // House rule 6, and the reason the adversarial fixture exists.
      expect(matchDueLabel("Due Date: 9/7", "Due")).toBeUndefined();
      expect(matchDueLabel("Soft Due: 9/7", "Due")).toBeUndefined();
    });

    it("returns the registry's spelling, not the page's", () => {
      // The title is built from it, so a page that reworded its own label must
      // not rename the item under it — §3.1 hashes the title.
      expect(matchDueLabel("cp1 DUE: 9/22", "CP1 Due")?.label).toBe("CP1 Due");
    });

    it("refuses a line with no colon, and one with nothing after it", () => {
      expect(matchDueLabel("Due 9/7", "Due")).toBeUndefined();
      expect(matchDueLabel("Due:   ", "Due")).toBeUndefined();
    });
  });

  describe("titleWithLabel", () => {
    it("appends what is left of the label after 'Due'", () => {
      expect(titleWithLabel("mp_pipeline", "CP1 Due")).toBe("mp_pipeline CP1");
      expect(titleWithLabel("mp_ooo", "Advance Features Due")).toBe("mp_ooo Advance Features");
    });

    it("appends nothing for a bare 'Due'", () => {
      expect(titleWithLabel("mp_setup", "Due")).toBe("mp_setup");
    });

    it("drops a title cell that is itself the due line", () => {
      expect(titleWithLabel("Midterm 1: September 29", "Midterm 1")).toBe("Midterm 1");
    });

    it("never produces an empty title", () => {
      // A `dueLabel: "Due"` adapter with no `titleFrom` is misconfigured; a
      // visibly wrong title is recoverable, a blank row is not.
      expect(titleWithLabel("Due: 9/7", "Due")).toBe("Due: 9/7");
    });
  });

  describe("clockFromText", () => {
    it("takes the start of a range that carries one meridiem at the end", () => {
      // "7-9PM" means 7 PM to 9 PM, and the start is when a student has to be
      // in the room.
      expect(clockFromText("Location: ECEB 1002 Time: 7-9PM")).toEqual({ hour: 19, minute: 0 });
      expect(clockFromText("Time: 6:30 - 8:30 pm")).toEqual({ hour: 18, minute: 30 });
    });

    it("does not read a room number as an hour", () => {
      // Anchored on the word that makes a number a clock, exactly as
      // statedTimeInText is anchored on the word that makes one a deadline.
      expect(clockFromText("Location: ECEB 1002")).toBeUndefined();
    });

    it("refuses a bare hour with no meridiem", () => {
      // Reading "7-9" as 07:00 moves a 7 PM exam twelve hours while looking
      // like something the page stated.
      expect(clockFromText("Time: 7-9")).toBeUndefined();
      expect(clockFromText("Time: TBD")).toBeUndefined();
    });

    it("reads a 24-hour clock that cannot mean anything else", () => {
      expect(clockFromText("Time: 19:00")).toEqual({ hour: 19, minute: 0 });
      expect(clockFromText("18:00")).toEqual({ hour: 18, minute: 0 });
    });
  });

  describe("resolveTitleFrom", () => {
    const page = `<section id="a"><h3>mp_one</h3><ul><li>Due: 9/7</li></ul></section>
      <section id="b"><h3>mp_two</h3><ul><li>Due: 9/8</li></ul></section>`;

    it("climbs to the scope and reads the heading inside it", () => {
      const rows = rowsOf(page, "li");
      expect(resolveTitleFrom(rows[0]!, "section >> h3")).toBe("mp_one");
      expect(resolveTitleFrom(rows[1]!, "section >> h3")).toBe("mp_two");
    });

    it("falls back to the nearest heading that precedes the row", () => {
      // For a page that puts a heading and its list side by side with no
      // wrapper to climb to. "Nearest preceding", not "first" and not "any":
      // the second row must not inherit the first section's name.
      const flat = `<h3>alpha</h3><ul><li>Due: 9/7</li></ul><h3>beta</h3><ul><li>Due: 9/8</li></ul>`;
      const rows = rowsOf(flat, "li");
      expect(resolveTitleFrom(rows[0]!, "h3")).toBe("alpha");
      expect(resolveTitleFrom(rows[1]!, "h3")).toBe("beta");
    });

    it("is undefined when the scope is not there", () => {
      expect(resolveTitleFrom(rowsOf(page, "li")[0]!, "table >> h3")).toBeUndefined();
    });
  });

  describe("the page-level guards", () => {
    const listAdapter: Adapter = {
      ...ADAPTER,
      id: "list-99",
      rows: "li",
      title: "p",
      due: "p",
      titleFrom: "section >> h3",
      dueLabel: "Due|CP1 Due",
      dateFormat: "M/d",
      filter: undefined,
    };
    const listPage = `<section><h3>mp_one</h3><ul><li><p>Due: 9/7</p></li></ul></section>`;

    it("parses the healthy page (so the guards below mean something)", () => {
      expect(runAdapter(listAdapter, doc(listPage), page)).toHaveLength(1);
    });

    it("throws, naming the labels, when the page reworded every one of them", () => {
      // House rule 2 one field over. Rows still match and still have titles, so
      // neither existing guard fires — and silently returning [] would freeze
      // the course's list at whatever it last held.
      const reworded = `<section><h3>mp_one</h3><ul><li><p>Deadline: 9/7</p></li></ul></section>`;
      expect(() => runAdapter(listAdapter, doc(reworded), page)).toThrow(ParseError);
      expect(() => runAdapter(listAdapter, doc(reworded), page)).toThrow(/due label.*CP1 Due/);
    });

    it("returns nothing, without throwing, when the filter excludes every row", () => {
      // A term where nothing is dated yet is a normal week, not a redesign, so
      // the label guard is keyed on labels the page *has* rather than on items
      // that survived the filter — the same reason `sawTitledRow` is keyed on
      // titles and not on `items.length`. Getting this backwards turns the
      // first three weeks of every course into a red source.
      const filtered = { ...listAdapter, filter: { exclude: "\\bTBD\\b" } };
      const allTbd = `<section><h3>mp_one</h3><ul>
        <li><p>Due: TBD</p></li><li><p>CP1 Due: TBD</p></li></ul></section>`;
      expect(runAdapter(filtered, doc(allTbd), page)).toEqual([]);
    });

    it("throws, naming the selector, when no row can reach a title any more", () => {
      const headless = `<section><ul><li><p>Due: 9/7</p></li></ul></section>`;
      expect(() => runAdapter(listAdapter, doc(headless), page)).toThrow(/section >> h3/);
    });
  });
});

describe("registry validation of the list-shaped fields", () => {
  it("accepts all three", () => {
    expect(
      validateAdapter({
        ...ADAPTER,
        dueLabel: "Due|CP1 Due",
        titleFrom: "section >> h3",
        time: "ul",
      }).adapter,
    ).toBeDefined();
  });

  it("refuses an empty label inside dueLabel", () => {
    // `"Due|"` splits to an empty string, and an empty label matches the empty
    // prefix of every line on the page — house rule 5's "" passing a typeof
    // check, one field over.
    expect(validateAdapter({ ...ADAPTER, dueLabel: "Due|" }).reason).toMatch(/empty label/);
    expect(validateAdapter({ ...ADAPTER, dueLabel: " | Due" }).reason).toMatch(/empty label/);
  });

  it("refuses an empty or oversized field", () => {
    expect(validateAdapter({ ...ADAPTER, dueLabel: "" }).reason).toMatch(/bad dueLabel/);
    expect(validateAdapter({ ...ADAPTER, titleFrom: "" }).reason).toMatch(/bad titleFrom/);
    expect(validateAdapter({ ...ADAPTER, time: "" }).reason).toMatch(/bad time/);
    expect(validateAdapter({ ...ADAPTER, titleFrom: "x".repeat(201) }).reason).toMatch(
      /bad titleFrom/,
    );
    expect(validateAdapter({ ...ADAPTER, time: "x".repeat(201) }).reason).toMatch(/bad time/);
    expect(validateAdapter({ ...ADAPTER, dueLabel: "x".repeat(201) }).reason).toMatch(
      /bad dueLabel/,
    );
  });

  it("refuses a non-string", () => {
    expect(validateAdapter({ ...ADAPTER, dueLabel: ["Due"] }).reason).toMatch(/bad dueLabel/);
    expect(validateAdapter({ ...ADAPTER, time: 7 }).reason).toMatch(/bad time/);
  });
});

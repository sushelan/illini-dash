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
  parseAdapterDate,
  parseAdapterDateParts,
  runAdapter,
  supportedDateFormats,
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

  const overrides = { mergeGroups: [], splitKeys: [], hiddenKeys: [], disabledCourses: [], doneKeys: [], keptCourses: [] };

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

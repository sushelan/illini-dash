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
  clauseEvents,
  clockFromText,
  clockGroups,
  clockOf,
  firstDateIn,
  matchDueLabel,
  matchDuePhrase,
  parseAdapterDate,
  parseAdapterDateParts,
  RELEASE_WORDS,
  resolveTitleFrom,
  runAdapter,
  splitClauses,
  statedTimeInText,
  supportedDateFormats,
  timeLikeTail,
  titleBefore,
  titleSeparatorAt,
  titleWithLabel,
} from "../src/sources/site.js";
import {
  byDepartment,
  courseGroupsForYou,
  groupHasCourse,
  compareVersions,
  currentTermCode,
  isCurrentTerm,
  matchesHostPattern,
  registryDueForRefresh,
  requiredVersionFor,
  shouldSeedFromBundle,
  validateAdapter,
  validateRegistry,
} from "../src/core/registry.js";
import { EXTENSION_VERSION } from "../src/build-info.js";
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

/**
 * §4.5's `minExtensionVersion`, which until 1.1.0 was a string nothing read.
 *
 * The registry is one published file that every installed build fetches, so an
 * entry written for a field added later *will* reach an older build. Dropping
 * it with a reason is the only honest answer: running it means reading the date
 * out of whichever hook the old code does understand, which is a wrong deadline
 * rather than a missing one.
 */
describe("the minExtensionVersion gate", () => {
  it("runs an entry the build is new enough for", () => {
    expect(validateAdapter({ ...ADAPTER, minExtensionVersion: "1.1.0" }, "1.1.0").adapter).toBeDefined();
    expect(validateAdapter({ ...ADAPTER, minExtensionVersion: "0.1.0" }, "1.1.0").adapter).toBeDefined();
  });

  it("drops one that needs a newer build, and says which", () => {
    const { adapter, reason } = validateAdapter(
      { ...ADAPTER, minExtensionVersion: "1.1.0" },
      "1.0.0",
    );
    expect(adapter).toBeUndefined();
    expect(reason).toBe("cs999-fa26: needs extension 1.1.0, this is 1.0.0");
  });

  it("compares components as numbers, not as strings", () => {
    // `"1.10.0" < "1.9.0"` as strings, so a string compare would make the tenth
    // minor release refuse every entry written for the ninth — silently, and
    // only after a release nobody would connect to it.
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    expect(compareVersions("1.9.0", "1.10.0")).toBe(-1);
    expect(validateAdapter({ ...ADAPTER, minExtensionVersion: "1.9.0" }, "1.10.0").adapter)
      .toBeDefined();
  });

  it("treats a missing component as zero", () => {
    expect(compareVersions("1.1", "1.1.0")).toBe(0);
    expect(compareVersions("1.1", "1.1.1")).toBe(-1);
    expect(validateAdapter({ ...ADAPTER, minExtensionVersion: "1.1" }, "1.1.0").adapter).toBeDefined();
  });

  it("refuses a version that is not a dotted number", () => {
    // House rule 5: `typeof x === "string"` passes "latest", which would then
    // compare as 0.0.0 — accepted by every build there has ever been, which is
    // the exact opposite of what the field is for.
    for (const bad of ["latest", "1.x", "v1.1.0", "1.1.0-beta", "1..0", "-1"]) {
      expect(validateAdapter({ ...ADAPTER, minExtensionVersion: bad }, "1.1.0").reason, bad).toMatch(
        /bad minExtensionVersion/,
      );
    }
  });

  it("refuses an empty version rather than reading it as 0.0.0", () => {
    expect(validateAdapter({ ...ADAPTER, minExtensionVersion: "" }, "1.1.0").reason).toMatch(
      /missing minExtensionVersion/,
    );
  });

  it("carries the build version through the whole file", () => {
    const text = JSON.stringify({
      adapters: [
        { ...ADAPTER, id: "old-fa26", minExtensionVersion: "0.1.0" },
        { ...ADAPTER, id: "new-fa26", minExtensionVersion: "2.0.0" },
      ],
    });
    const result = validateRegistry(text, "1.1.0");
    expect(result.adapters.map((a) => a.id)).toEqual(["old-fa26"]);
    expect(result.rejected).toEqual(["new-fa26: needs extension 2.0.0, this is 1.1.0"]);
  });

  it("derives the floor from the fields an entry uses", () => {
    // The author of a new entry is the person least able to remember which
    // build learned `duePrev`, so the number is derived rather than typed.
    expect(requiredVersionFor({ rows: "tr", due: "." })).toBe("0.1.0");
    for (const field of [
      "duePrev",
      "duePhrase",
      "dueSlot",
      "titleSlot",
      "titleBefore",
      "defaultTime",
    ]) {
      expect(requiredVersionFor({ rows: "tr", [field]: "x" }), field).toBe("1.1.0");
    }
  });

  it("does not count a field that is merely present and undefined", () => {
    // `{ ...candidate, duePrev: undefined }` is what a spread of an optional
    // field produces, and demanding 1.1.0 for it would put every proposal out
    // of reach of a 1.0.x install for no reason.
    expect(requiredVersionFor({ rows: "tr", duePrev: undefined })).toBe("0.1.0");
  });
});

/**
 * A key this build has never heard of means the entry was written for a later
 * one, and running it on the fields we *do* recognise reads the wrong cell.
 */
describe("unknown top-level fields", () => {
  it("refuses one, naming it", () => {
    expect(validateAdapter({ ...ADAPTER, dueSideways: "x" }).reason).toBe(
      "cs999-fa26: unknown field dueSideways",
    );
  });

  it("allows $comment, which the shipped registry already uses", () => {
    expect(validateAdapter({ ...ADAPTER, $comment: "why this is spelled so" }).adapter).toBeDefined();
  });

  it("is not fooled by a name on Object.prototype", () => {
    // `"constructor" in KNOWN_FIELDS` is true for every object literal, so an
    // `in` check would wave through a field called `constructor` and then hand
    // it to a spread. Deliberately unrealistic — a realistic key cannot tell a
    // prototype-walking check from a correct one (parser rule 10).
    expect(validateAdapter({ ...ADAPTER, constructor: "x" }).reason).toMatch(/unknown field/);
    expect(validateAdapter({ ...ADAPTER, toString: "x" }).reason).toMatch(/unknown field/);
  });
});

/** Worker rule 5: both branches of a decision the student will have to debug. */
describe("registryDueForRefresh", () => {
  it("is true when the registry has rested on either timestamp", () => {
    expect(registryDueForRefresh({ fetchedAt: "2026-09-19T00:00:00.000Z" })).toBe(true);
    expect(registryDueForRefresh({ attemptedAt: "2026-09-19T00:00:00.000Z" })).toBe(true);
  });

  it("is false on a store that has never fetched it", () => {
    // Seeding from the bundle deliberately leaves both unset, and clearing what
    // is already clear must not be announced as if it had done something.
    expect(registryDueForRefresh({})).toBe(false);
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

  /**
   * The grid spelling of the same adapter, pinned against it by row identity.
   *
   * CS 424's schedule has **no header row** — its first row is seven `<td>`s —
   * so `columns` has nothing to resolve, and its date cells carry no class.
   * `dueSlot`/`titleSlot` are the only thing left to name, which is house rule
   * 3 knowingly broken. The shipped entry stays as it is; this proves the slots
   * are the same columns, and the two tests after it prove the loud guard that
   * pays for the positional reading.
   *
   * The grid: slot 0 is the rowspan spacer, 1 Date, 2 Lecture, 3 Slides,
   * 4 HW/MP, 5 Discussions, 6 Comments.
   */
  describe("the same page read by grid slot", () => {
    /*
     * `title` and `due` are deliberately dead selectors here.
     *
     * They have to be *something* — `validateAdapter` requires both — and
     * leaving the shipped ones in place made the whole describe block prove
     * nothing: removing the `titleSlot` branch from `titleLocatorOf` fell
     * through to `title: "td:nth-last-child(3)"`, which produces the same nine
     * rows, so the mutation survived (mutation house rule 4 — the adversarial
     * input never reached the line). With these, the slots are doing all of the
     * work and nothing else can stand in for them.
     */
    const bySlot = {
      ...cs424,
      title: ".no-such-title-column",
      due: ".no-such-due-column",
      dueSlot: 1,
      titleSlot: 4,
    } as unknown as Adapter;

    it("yields exactly the nine rows the shipped selectors do", () => {
      const slotItems = runAdapter(bySlot, schedule, ctx);
      expect(slotItems.map((i) => [i.title, i.dueAt])).toEqual(
        items.map((i) => [i.title, i.dueAt]),
      );
    });

    it("throws, naming the column and both counts, when the slot is not a date column", () => {
      /*
       * The whole payment for indexing by position. Slot 2 is the lecture topic
       * — plenty of text, no dates — and without this the adapter would report
       * nine rows with the lecture title where the date should be, or none at
       * all, with nothing failing.
       */
      expect(() => runAdapter({ ...bySlot, dueSlot: 2 } as Adapter, schedule, ctx)).toThrow(
        "adapter cs424-fa26: column 2 read as a date on 0 of 32 rows, " +
          "below the floor of 2 rows and 50%; a column has moved",
      );
      // 32 is every matched row, not the nine that end up with a title: a count
      // taken inside the loop would ask the question of a self-selected set —
      // on a shifted grid, exactly the rows least able to answer it.
      expect(schedule.querySelectorAll(cs424.rows)).toHaveLength(32);
    });

    it("throws rather than reading the next column when one is inserted", () => {
      // House rule 3's actual failure mode, and the pattern the ECE 310 test
      // uses: a course adding a column shifts every index by one. `columns`
      // survives it by re-reading the header; a slot cannot, so it has to be
      // loud instead of quietly reading the spacer.
      const shifted = doc(
        readFileSync(new URL("../fixtures/sites/cs424-fa2026-schedule.html", import.meta.url), "utf8"),
      );
      for (const row of shifted.querySelectorAll("table tr")) {
        const cell = shifted.createElement("td");
        cell.textContent = "10";
        row.insertBefore(cell, row.firstChild);
      }
      expect(() => runAdapter(bySlot, shifted, ctx)).toThrow(ParseError);
      // Slot 1 is now the rowspan spacer, which has text on 28 of the 32 rows
      // (the unit headings carry down) and a date on none of them.
      expect(() => runAdapter(bySlot, shifted, ctx)).toThrow(
        /column 1 read as a date on 0 of 28 rows/,
      );
    });

    it("reads the date column through the rowspan, not through nth-child", () => {
      // Rows carry 7, 6, 5, 4 or 1 children depending on whether they open a
      // unit block. The grid is what makes one index right on all of them.
      const slotItems = runAdapter(bySlot, schedule, ctx);
      expect(slotItems.find((i) => i.title === "HW1 Due")!.dueAt).toBe("2026-09-16T23:59:00-05:00");
      expect(slotItems.find((i) => i.title === "MP3 Due")!.dueAt).toBe("2026-12-09T23:59:00-06:00");
    });

    it("throws when the column mostly holds words, even with two real dates in it", () => {
      /*
       * The share half of the floor, which the CS 424 page cannot exercise:
       * every wrong slot on it dates *zero* rows, so the row-count half fires
       * first and the share test was never reached (mutation house rule 2 —
       * untested, not unreachable).
       *
       * Constructed for that reason. Two dates out of six rows with text is
       * exactly the shape a column that has shifted by one produces on a real
       * schedule: a stray date or two among the lecture topics, which passes a
       * "at least two dated rows" bar and is nowhere near a date column.
       */
      const mostly = doc(`<table>
        <tr><td>Intro</td><td>Week 1</td></tr>
        <tr><td>9/16</td><td>HW1 Due</td></tr>
        <tr><td>9/23</td><td>HW2 Due</td></tr>
        <tr><td>Reading week</td><td>HW3 Due</td></tr>
        <tr><td>Project week</td><td>HW4 Due</td></tr>
        <tr><td>Revision</td><td>HW5 Due</td></tr>
      </table>`);
      const adapter = { ...bySlot, rows: "tr", dueSlot: 0, titleSlot: 1 } as unknown as Adapter;
      expect(() => runAdapter(adapter, mostly, ctx)).toThrow(
        "adapter cs424-fa26: column 0 read as a date on 2 of 6 rows, " +
          "below the floor of 2 rows and 50%; a column has moved",
      );
    });

    it("throws when one dated row is the whole sample", () => {
      /*
       * The other half of the floor, and the reason it is two numbers rather
       * than one: 1 of 1 is a 100% hit rate and still a single sample, so any
       * column holding one stray date would pass a share-only test. Constructed
       * because CS 424's every wrong slot dates zero rows, so the share half
       * always fires there first.
       */
      const thin = doc(`<table>
        <tr><td>9/16</td><td>HW1 Due</td></tr>
        <tr><td></td><td>HW2 Due</td></tr>
      </table>`);
      const adapter = { ...bySlot, rows: "tr", dueSlot: 0, titleSlot: 1 } as unknown as Adapter;
      expect(() => runAdapter(adapter, thin, ctx)).toThrow(
        "adapter cs424-fa26: column 0 read as a date on 1 of 1 rows, " +
          "below the floor of 2 rows and 50%; a column has moved",
      );
    });

    it("says the column is not there at all, rather than that it has moved", () => {
      /*
       * A different diagnosis for a different cause, and worth its own branch:
       * "column 9 read as a date on 0 of 0 rows" sends someone to look at what
       * the column holds, and the answer is that the table is seven columns
       * wide. The share test would reject this too — 0 dated is below the row
       * floor — which is exactly why the message has to come first.
       */
      expect(() => runAdapter({ ...bySlot, dueSlot: 9 } as Adapter, schedule, ctx)).toThrow(
        "adapter cs424-fa26: 32 rows, none had a cell in column 9",
      );
    });

    it("is refused by the registry if it also names columns", () => {
      // Two answers to one question is an entry that has not decided what the
      // page looks like, and whichever won would be invisible in the preview.
      expect(
        validateAdapter({ ...bySlot, columns: { title: "Exercises", due: "Due Date" } }).reason,
      ).toMatch(/each locate the date cell; declare one/);
    });
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

  it("holds back the entries a 1.0.0 build could not run", () => {
    /*
     * The gate against the build that is actually in the store. These entries
     * use `duePhrase`, `duePrev` or `defaultTime`, none of which a 1.0.0
     * runner has, and running one there would read the date out of
     * whichever hook it *does* understand — a wrong deadline, not a missing
     * one. Every other entry must still come through, because a registry that
     * refuses wholesale on one new field would break the shipped courses.
     */
    const { adapters, rejected } = validateRegistry(text, "1.0.0");
    expect(rejected.map((line) => line.split(":")[0])).toEqual([
      "cs425-fa26",
      "cs374a-fa26-hw",
      "cs374a-fa26-gps",
    ]);
    // Each says which version to update to, and CS 425 is the one that says
    // 1.2.0: it reads the clauses of one cell, which is a 1.2.0 field.
    expect(rejected[0]).toContain("needs extension 1.2.0, this is 1.0.0");
    for (const line of rejected.slice(1)) {
      expect(line).toContain("needs extension 1.1.0, this is 1.0.0");
    }
    expect(adapters.map((a) => a.id)).toEqual([
      "cs424-fa26",
      "ece310-fa26",
      "ece391-fa26",
      "ece411-fa26-mp",
      "ece411-fa26-exams",
    ]);
  });

  it("is runnable by the version the manifest actually ships", () => {
    /*
     * Read out of `public/manifest.json` rather than typed here: the bundled
     * registry is the baseline every fresh install starts from, so an entry
     * demanding a version above the manifest's would ship as a course that can
     * never be enabled — and a retyped number in this test would agree with
     * itself while disagreeing with Chrome.
     */
    const version = (
      JSON.parse(readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8")) as {
        version: string;
      }
    ).version;
    expect(validateRegistry(text, version).rejected).toEqual([]);
    // And the define the bundle carries is that same number.
    expect(EXTENSION_VERSION).toBe(version);
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

  const overrides = { mergeGroups: [], splitKeys: [], hiddenKeys: [], disabledCourses: [], doneKeys: [], keptCourses: [], courseNames: {}, dueOverrides: {} };

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

  /**
   * The weekday a page writes *after* the date.
   *
   * Harmless as leftover text right up until the leftover also holds the clock:
   * the formats are start-anchored and stop at the first thing they cannot
   * read, so a trailing weekday hid every time printed behind it.
   */
  describe("a trailing weekday", () => {
    it("reads a date that ends in one, with nothing left over", () => {
      for (const raw of ["09/03 Thu.", "09/24, Thursday", "08/27 Thu¹", "9/13 (Sun)"]) {
        const at = parse(raw, "M/d")!;
        expect(at, raw).toBeDefined();
        expect(at.unparsedTime, raw).toBeUndefined();
        expect(at.timeAssumed, raw).toBe(true);
      }
      expect(local(parse("09/03 Thu.", "M/d")!.iso)).toBe("Sep 03, 23:59");
      expect(local(parse("08/27 Thu¹", "M/d")!.iso)).toBe("Aug 27, 23:59");
    });

    it("reads the clock that used to be hidden behind it", () => {
      // The whole reason this is not cosmetic. Without the trailing weekday the
      // match stopped at "09/24", the "11.59 PM" became leftover, and the row
      // landed on an *invented* 23:59 — the same instant here, and six hours
      // early the moment a course writes "Thursday 5 PM" (worker rule 3).
      const at = parse("09/24, Thursday 11.59 PM", "M/d")!;
      expect(at.timeAssumed).toBe(false);
      expect(local(at.iso)).toBe("Sep 24, 23:59");
    });

    it("works after a month name and after an ISO date too", () => {
      expect(local(parse("Sep 24 Thursday 5 pm", "MMM d, h:mm a")!.iso)).toBe("Sep 24, 17:00");
      expect(local(parse("2026-09-24 Thursday 17:00", "yyyy-MM-dd")!.iso)).toBe("Sep 24, 17:00");
    });

    it("does not swallow a word that merely starts like one", () => {
      /*
       * Deliberately unrealistic, because a realistic page cannot tell the
       * exact table from `WEEKDAY_NAME`'s `[a-z]*` tail (parser rule 10).
       * "Monthly" starts with "mon"; the loose pattern eats it and then reads
       * the 5pm behind it as this deadline's cutoff, which is a six-hour error
       * wearing a stated time's clothes. `announce.ts` learned this about
       * "monthly" and "satisfied" and answered it the same way.
       */
      const at = parse("9/1 Monthly report 5 pm", "M/d")!;
      expect(at.timeAssumed).toBe(true);
      expect(at.unparsedTime).toBe("Monthly report 5 pm");
    });
  });

  /** The two clock shapes fa26 pages write that this grammar could not read. */
  describe("11.59 PM and 0930 hrs", () => {
    it("reads a dot as the minute separator, which CS 425 uses on every row", () => {
      // All eight CS 425 deadlines are "11.59 PM Central Time". With only `:`
      // the format stopped at the date and invented 23:59 — the same instant,
      // so invisible, but carrying `timeAssumed`, so it would lose to any
      // Canvas row for this course (§5.3).
      const at = parse("9/20 at 11.59 PM Central Time", "M/d")!;
      expect(at.timeAssumed).toBe(false);
      expect(at.unparsedTime).toBeUndefined();
      expect(local(at.iso)).toBe("Sep 20, 23:59");
    });

    it("reads a four-digit clock the page labels hrs, and takes the start of a range", () => {
      const at = parse("Tue 9/8 0930 - 1045 hrs.", "M/d")!;
      expect(at.timeAssumed).toBe(false);
      expect(local(at.iso)).toBe("Sep 08, 09:30");
      expect(parse("9/8 1045 hrs", "M/d")!.timeAssumed).toBe(false);
      expect(local(parse("9/8 1045 hrs", "M/d")!.iso)).toBe("Sep 08, 10:45");
    });

    it("leaves four bare digits alone, because they are usually not a clock", () => {
      // A room, a section, half a year. Only the page saying "hrs" makes four
      // digits with no separator a time.
      const at = parse("Sep 11 1045", "MMM d, h:mm a")!;
      expect(at.timeAssumed).toBe(true);
      expect(at.unparsedTime).toBeUndefined();
      expect(local(at.iso)).toBe("Sep 11, 23:59");
    });

    it("still refuses a bare hour, with or without a weekday in front", () => {
      // Reading "5" as 05:00 moves a 5 PM deadline eighteen hours earlier than
      // the 23:59 this admits to inventing.
      const at = parse("Thu 9/3 5", "M/d")!;
      expect(at.timeAssumed).toBe(true);
      expect(local(at.iso)).toBe("Sep 03, 23:59");
      expect(local(at.iso)).not.toContain("05:00");
    });

    it("refuses 2500 hrs rather than pretending it read one", () => {
      // `[01]\d|2[0-3]` is the hour, positively: `\d{2}` would accept 25 and
      // then `isRealWallClock` would throw the whole date away.
      const at = parse("9/8 2500 hrs", "M/d")!;
      expect(at.timeAssumed).toBe(true);
      expect(at.unparsedTime).toBe("2500 hrs");
    });
  });

  describe("timeLikeTail", () => {
    it("flags a leftover that still looks like a clock", () => {
      expect(timeLikeTail(" — due by 11:59 pm sharp")).toContain("11:59");
      expect(timeLikeTail(" at 5pm")).toContain("5pm");
      expect(timeLikeTail(" at noon")).toContain("noon");
      // The new one: "0930 hrs" is a clock this grammar can read, so a leftover
      // holding it means the parser stopped short of something it understands.
      expect(timeLikeTail(" session 0930 hrs")).toContain("0930");
    });

    it("says nothing about a leftover that is not a time", () => {
      expect(timeLikeTail("")).toBeUndefined();
      expect(timeLikeTail(" (no late work accepted)")).toBeUndefined();
      expect(timeLikeTail(" US Central time")).toBeUndefined();
      expect(timeLikeTail(" 1045")).toBeUndefined();
      // A decimal that is not a clock. `\d{1,2}\.\d{2}` here would put an
      // unparsedTime on every row of a page that prints point values.
      expect(timeLikeTail(" worth 12.50 points")).toBeUndefined();
    });
  });

  /**
   * `clockGroups` is the one copy of `TIME`'s coalescing and its ambiguity
   * rule; `announce.ts` reads prose with it too (mutation house rule 3 — two
   * copies means a mutation to one is masked by the other staying strict).
   */
  describe("clockGroups", () => {
    const groupsOf = (raw: string, format: string) => {
      const at = parse(raw, format);
      return at;
    };

    it("coalesces all three of TIME's alternatives", () => {
      expect(clockGroups({ hour: "11", minute: "59", ampm: "pm" })).toMatchObject({
        hour: 23,
        minute: 59,
        ambiguous: false,
      });
      expect(clockGroups({ hour12: "5", ampm12: "pm" })).toMatchObject({ hour: 17, minute: 0 });
      expect(clockGroups({ hour24: "09", minute24: "30" })).toMatchObject({ hour: 9, minute: 30 });
    });

    it("calls a bare h:mm under 13 ambiguous, and an hrs clock never", () => {
      expect(clockGroups({ hour: "5", minute: "00" })).toMatchObject({
        ambiguous: true,
        written: "5:00",
      });
      expect(clockGroups({ hour: "05", minute: "00" }).ambiguous).toBe(false);
      expect(clockGroups({ hour: "17", minute: "00" }).ambiguous).toBe(false);
      // "0930 hrs" is 24-hour by the page's own say-so.
      expect(clockGroups({ hour24: "09", minute24: "30" }).ambiguous).toBe(false);
    });

    it("says nothing at all when the text wrote no clock", () => {
      expect(clockGroups({}).hour).toBeUndefined();
      expect(clockGroups({ word: "noon" }).hour).toBeUndefined();
    });

    it("is what the date formats actually use", () => {
      // The shared function reached through the real parser, so a change to it
      // that this file's direct calls miss still fails here.
      expect(groupsOf("Sep 11 at 5:00", "MMM d, h:mm a")!.unparsedTime).toBe("5:00");
      expect(groupsOf("Sep 11 at 05:00", "MMM d, h:mm a")!.timeAssumed).toBe(false);
    });
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

  it("survives a colspan header, which counting children does not", () => {
    /*
     * DELIBERATELY UNREALISTIC (parser rule 10). No captured page puts a
     * `colspan` on a header, and with a realistic table "the header's position
     * among its siblings" and "the header's grid column" are the same number —
     * so a right implementation and a wrong one read every fixture identically.
     *
     * A `<th colspan="2">` occupies two columns, so every header after it sits
     * one further right than counting children says. Reading `Due Date` at the
     * child index would give each row the cell *before* its date — which on
     * this page is the assignment name, so the page would come back with 13
     * undated items and nothing would look wrong.
     */
    const widened = doc();
    for (const row of widened.querySelectorAll("#homework table.timetable tr")) {
      const header = row.querySelector("th");
      const cell = widened.createElement(header ? "th" : "td");
      if (header) {
        cell.setAttribute("colspan", "2");
        cell.textContent = "Week";
        row.insertBefore(cell, row.firstChild);
      } else {
        // Two `<td>`s under the one two-wide header, so the data rows stay the
        // same width as the header row.
        cell.textContent = "1";
        const second = widened.createElement("td");
        second.textContent = "Mon";
        row.insertBefore(second, row.firstChild);
        row.insertBefore(cell, row.firstChild);
      }
    }
    const items = runAdapter(ADAPTER, widened, page);
    expect(items).toHaveLength(13);
    expect(items[0]!.title).toBe("Homework 1");
    expect(local(items[0]!.dueAt!)).toBe("09/04, 23:59");
  });

  it("follows a named column through a rowspan in the body", () => {
    /*
     * The other half of resolving `columns` through the grid, and the half a
     * child index gets wrong on the *data* rows rather than the header one.
     *
     * Deliberately constructed (parser rule 10): ECE 310's homework table has
     * no rowspan, so on it "the cell's position among its siblings" and "the
     * cell's grid column" are the same number on every row — a right
     * implementation and a wrong one are indistinguishable.
     *
     * Here the name spans two due dates, which is how a course writes one
     * assignment with a checkpoint. The second row has ONE child and TWO
     * columns, so reading `children[1]` finds nothing for the date and
     * `children[0]` names the row after its own deadline: an item literally
     * titled "09/11 @ 11:59pm", undated, sitting in the student's list.
     */
    const spanned = parseHTML(`<table>
      <thead><tr><th>Exercises</th><th>Due Date</th></tr></thead>
      <tbody>
        <tr><td rowspan="2">Homework 1</td><td>09/04 @ 11:59pm</td></tr>
        <tr><td>09/11 @ 11:59pm</td></tr>
      </tbody>
    </table>`).document as unknown as Document;
    const simple = { ...ADAPTER, rows: "tbody tr" } as unknown as Adapter;
    const items = runAdapter(simple, spanned, page);
    expect(items.map((i) => [i.title, local(i.dueAt!)])).toEqual([
      ["Homework 1", "09/04, 23:59"],
      ["Homework 1", "09/11, 23:59"],
    ]);
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

/**
 * CS 425 / ECE 428 — §4.5's fourth page shape: the deadline is a clause.
 *
 * There is no table, no `label: value` line and no element around the date.
 * Each item is one `<li>` holding a whole sentence with two or three dates in
 * it, and the only thing that says which one is the deadline is the word "Due":
 *
 *     [MP1 Specification Document]: Released 8/25. Due @ 9/13 11.59 PM
 *     Central Time (Sun). Demos on 9/14 (Mon).
 *
 * Unmodified `curl` capture of the public page, taken 2026-09-18 (no login).
 */
describe("CS 425: a deadline in the middle of a sentence", () => {
  const registryText = readFileSync(new URL("../adapters/registry.json", import.meta.url), "utf8");
  const cs425 = validateRegistry(registryText).adapters.find((a) => a.id === "cs425-fa26")!;
  const load = (name: string) =>
    doc(readFileSync(new URL(`../fixtures/sites/${name}`, import.meta.url), "utf8"));
  // Mid-term, so §3.2's year inference resolves 8/27 behind it and 12/6 ahead.
  const ctx: PageCtx = { url: cs425.url, fetchedAt: "2026-09-18T12:00:00.000Z" };
  const run = (file: string) => runAdapter(cs425, load(file), ctx);

  describe("the real page", () => {
    const items = run("cs425-fa2026-assignments.html");

    it("ships a valid adapter", () => {
      expect(validateAdapter(cs425).adapter).toBeDefined();
    });

    /** The deadlines, as opposed to the demos `clauses` reads beside them. */
    const deadlines = items.filter((i) => i.kind !== "event");

    it("finds all eight deadlines, and the four demos beside them", () => {
      /*
       * 42 `<li>`s match the rows selector. Eight of them carry the keyword
       * followed by a date; the rest are instructions, regrade policy, exam
       * prose and solution links.
       *
       * Each MP's sentence dates its demo a day later, and `clauses` is what
       * keeps it: an event under the deadline it belongs to, in the order the
       * page writes them. "Released 8/25" carries a date too and is not one —
       * nobody attends a release.
       */
      expect(items.map((i) => [i.title, i.kind, i.dueAt])).toEqual([
        ["MP1 Specification Document", "assignment", "2026-09-13T23:59:00-05:00"],
        ["MP1 Specification Document: Demos", "event", "2026-09-14T23:59:00-05:00"],
        ["MP2 Specification Document", "assignment", "2026-09-27T23:59:00-05:00"],
        ["MP2 Specification Document: Demos", "event", "2026-09-28T23:59:00-05:00"],
        ["MP3 Specification Document", "assignment", "2026-11-08T23:59:00-06:00"],
        ["MP3 Specification Document: Demos", "event", "2026-11-09T23:59:00-06:00"],
        ["MP4 Specification Document", "assignment", "2026-12-06T23:59:00-06:00"],
        ["MP4 Specification Document: Demos", "event", "2026-12-07T23:59:00-06:00"],
        ["HW1 Document", "assignment", "2026-09-20T23:59:00-05:00"],
        ["HW2 Document", "assignment", "2026-10-04T23:59:00-05:00"],
        ["HW3 Document", "assignment", "2026-11-01T23:59:00-06:00"],
        ["HW4 Document", "assignment", "2026-12-03T23:59:00-06:00"],
      ]);
    });

    it("carries the cross-listing on a demo as on its deadline", () => {
      // `CS425/ECE428`: the second code rides in `extra.altCodes` so §5.1 can
      // meet an ECE 428 row. An event read out of the same sentence gets it too.
      const events = items.filter((i) => i.kind === "event");
      expect(events.length).toBeGreaterThan(0);
      expect(events.every((i) => i.extra?.["altCodes"] === "CS425 ECE428")).toBe(true);
      expect(items.find((i) => i.kind === "assignment")?.extra?.["altCodes"]).toBe("CS425 ECE428");
    });

    it("says a demo's hour is assumed, and the deadline's is not", () => {
      /*
       * "Demos on 9/14 (Mon)" states no clock, so 23:59 is this code's
       * invention and §5.3 must not rank it above anything (worker rule 3).
       * The deadlines state theirs: before the grammar learned a dotted clock
       * every row here carried `timeAssumed`, and any Canvas row could then
       * have overwritten a deadline CS 425 had stated plainly.
       */
      for (const item of deadlines) expect(item.extra?.["timeAssumed"], item.title).toBeUndefined();
      for (const item of items.filter((i) => i.kind === "event")) {
        expect(item.extra?.["timeAssumed"], item.title).toBe("true");
        // And says what it is, so a student checking the row against the page
        // knows it was read out of a clause beside a deadline.
        expect(item.extra?.["clause"], item.title).toBe("true");
        expect(item.extra?.["dueText"], item.title).toMatch(/^Demos on \d+\/\d+ \(Mon\)$/);
      }
    });

    it("reads the 11.59 PM the page states, on every one of them", () => {
      for (const item of deadlines) expect(item.dueAt?.slice(11, 16)).toBe("23:59");
    });

    it("takes the deadline and not the release date beside it", () => {
      // Every row prints its release first: "Released 8/25. Due @ 9/13". A
      // reader that took the first date on the line would be 19 days early on
      // MP1 and would look completely normal doing it.
      expect(items.some((i) => i.dueAt?.startsWith("2026-08-25"))).toBe(false);
      expect(items.some((i) => i.dueAt?.startsWith("2026-08-27"))).toBe(false);
      expect(items.some((i) => i.dueAt?.startsWith("2026-09-15"))).toBe(false);
    });

    it("takes the deadline and not the demo date after it", () => {
      // "Demos on 9/14 (Mon)" is in the same sentence, one clause later. It is
      // a row of its own now, and it must still never be the *deadline*: a
      // reminder aimed at the demo fires a day after the work was owed.
      expect(deadlines.some((i) => i.dueAt?.startsWith("2026-09-14"))).toBe(false);
      expect(deadlines.some((i) => i.dueAt?.startsWith("2026-12-07"))).toBe(false);
    });

    it("emits nothing for the policy bullet that says 'due' with no date", () => {
      /*
       * "MPs are always due on a SUNDAY at 11.59 PM Central Time, and DEMOS are
       * on the subsequent MONDAY." is a real `<li>` on this page and matches the
       * rows selector. It carries the keyword and no date, so it is not this
       * adapter's row — emitting it undated would put a deadline called "MPs are
       * always due on a SUNDAY" in the student's list.
       */
      expect(items.some((i) => i.title.startsWith("MPs are always due"))).toBe(false);
      expect(items.some((i) => i.dueAt === undefined)).toBe(false);
    });

    it("is not fooled by 'the due-date' or by 'deadlines'", () => {
      // Two more real bullets: "Homeworks are due at 11.59 PM Central Time on
      // the due-date" and "We try to stagger HW deadlines". Neither is followed
      // by a date, and neither may become a row.
      expect(deadlines).toHaveLength(8);
      expect(items).toHaveLength(12);
    });

    it("titles each row from the head of its sentence, without the brackets", () => {
      // §3.1 hashes the title. Without `titleBefore` every sourceId would carry
      // the whole sentence, and a one-word edit to the page would orphan every
      // override on the row.
      expect(items[0]!.title).toBe("MP1 Specification Document");
      expect(items.every((i) => !i.title.includes("Released"))).toBe(true);
      expect(items.every((i) => !i.title.startsWith("["))).toBe(true);
    });

    it("records the text each date was read out of", () => {
      // The one field that lets a student check a course-site date without
      // opening the page, and what the proposal preview's "Read from" shows.
      expect(items[0]!.extra?.["dueText"]).toContain("9/13 11.59 PM");
      for (const item of items) expect(item.extra?.["dueText"]!.length).toBeLessThanOrEqual(120);
    });

    it("carries the cross-listing, with ECE 428 as an alternate code", () => {
      // §5.1: the course is CS 425 *and* ECE 428, and a Gradescope or Canvas
      // row for either has to be able to find it.
      expect(items[0]!.courseCode).toBe("CS425");
      expect(items[0]!.extra?.["altCodes"]).toBe("CS425 ECE428");
    });

    it("gives every row a url on the source origin", () => {
      /*
       * Three of the eight rows link a PDF, and the entry deliberately does not
       * follow it: that file is the assignment *text*, and this page says in as
       * many words that everything is submitted on Gradescope. §5.3 defines
       * `url` as where you actually submit, so the course page — which links
       * Gradescope and the entry code — is the better answer than a PDF.
       */
      for (const item of items) expect(item.url).toBe(cs425.url);
    });

    it("gives twelve rows twelve sourceIds", () => {
      // House rule 4. §3's `raw` is keyed by memberKey, so a collision merges
      // two deadlines into one with nothing failing — and four demos titled
      // "Demos" are exactly the shape that collides, which is why the row's
      // name is in front of every one of them.
      expect(new Set(items.map((i) => i.sourceId)).size).toBe(12);
    });

    it("throws, naming the keyword, if the page reworded every 'due'", () => {
      // House rule 2. Every `<li>` would still match and still have a title, so
      // without this the course simply stops producing deadlines and the dot
      // stays green.
      const reworded = { ...cs425, duePhrase: "deadline" } as unknown as Adapter;
      expect(() => runAdapter(reworded, load("cs425-fa2026-assignments.html"), ctx)).toThrow(
        /none carried a due phrase "deadline"/,
      );
    });
  });

  /**
   * The live page reads identically under a right implementation and several
   * wrong ones, so the difference is built on purpose (parser rule 10). The
   * fixture's own banner says exactly which rows are invented and why.
   */
  describe("the adversarial fixture", () => {
    const items = run("cs425-fa2026-assignments-adversarial.html");
    const by = (name: string) => items.find((i) => i.title === name)!;

    it("keeps the eight real rows untouched", () => {
      expect(by("MP1 Specification Document").dueAt).toBe("2026-09-13T23:59:00-05:00");
      // Eleven deadlines, and seven clauses beside them that carry a date of
      // their own: four demos, and the three this fixture invented to trap a
      // substring match — "Overdue 12/15", "Undue 12/16" and a resubmission
      // window. They are events, which is what the rule says they are; none of
      // them is a deadline, which is what the fixture exists to check.
      expect(items.filter((i) => i.kind !== "event")).toHaveLength(11);
      expect(items).toHaveLength(18);
    });

    it("skips a 'due' that introduces no date, and takes the one that does", () => {
      // HW5: "To be Released 12/1, due to the printer's schedule. Due @ 12/10".
      // Hooking on the keyword alone dates it 12/1 — nine days early.
      expect(by("HW5 Document").dueAt).toBe("2026-12-10T23:59:00-06:00");
    });

    it("keeps a TBD row undated rather than dating it from the release", () => {
      /*
       * HW6: "Due Date: TBD. Released 12/1." The keyword is this row's deadline
       * keyword — the course has simply not set a date — so the row is kept and
       * reported undated. It must never take 12/1, and it must not be silently
       * skipped either: "no deadline set yet" and "not a deadline at all" are
       * different facts.
       */
      const hw6 = by("HW6 Document");
      expect(hw6.dueAt).toBeUndefined();
      // The clause, not the rest of the line: `clauses` cuts "Released 12/1."
      // off the front of what could not be read, and the release is dropped
      // rather than becoming an event.
      expect(hw6.extra?.["unparsedDate"]).toBe("TBD");
      expect(items.some((i) => i.dueAt?.startsWith("2026-12-01"))).toBe(false);
    });

    it("does not read 'Overdue' or 'Undue' as the keyword", () => {
      // House rule 6, and the reason this fixture exists. A substring match
      // takes 12/15 and every date on the page would look plausible.
      expect(by("HW7 Document").dueAt).toBe("2026-12-13T23:59:00-06:00");
      const deadlines = items.filter((i) => i.kind !== "event");
      expect(deadlines.some((i) => i.dueAt?.startsWith("2026-12-15"))).toBe(false);
      expect(deadlines.some((i) => i.dueAt?.startsWith("2026-12-16"))).toBe(false);
    });

    it("takes the first hooked occurrence, not the last", () => {
      // HW7 carries two real ones: "Due @ 12/13" and "Resubmissions due @
      // 12/20". The deadline is the first; the resubmission window is not this
      // row's cutoff and a two-hour reminder aimed at it would fire a week late.
      expect(by("HW7 Document").dueAt).not.toContain("12-20");
    });

    it("says the placeholder exclude does not reach this row", () => {
      /*
       * `filter.exclude` is matched against the **title**, and HW6's title is
       * "HW6 Document" — the "TBD" is in the due text, which no filter sees. So
       * unlike ECE 411 (where the whole `<li>` is "Due: TBD" and the filter does
       * drop it), a placeholder on a prose page survives as an undated row.
       * Deliberate: the row names a real assignment, and §11 ranks a silently
       * dropped deadline above every other failure.
       */
      const filtered = {
        ...cs425,
        filter: { exclude: "\\bTB[DA]\\b|\\bN/?A\\b" },
      } as unknown as Adapter;
      const withFilter = runAdapter(filtered, load("cs425-fa2026-assignments-adversarial.html"), ctx);
      expect(withFilter.some((i) => i.title === "HW6 Document")).toBe(true);
    });
  });
});

/**
 * CS/ECE 374 A — §4.5's fifth page shape: the date is the row's *sibling*.
 *
 * A definition list. The date is the `<dt>` and the assignment is the `<dd>`
 * after it, so the date is outside the row and no selector, column or scope
 * reaches it. And the clock is stated once, in a paragraph above the list:
 * "Written homeworks are due every **Tuesday at 9pm**".
 *
 * Both pages are unmodified `curl` captures of the public pages, 2026-09-18.
 */
describe("ECE 374 A: the date is the dt before each dd", () => {
  const registryText = readFileSync(new URL("../adapters/registry.json", import.meta.url), "utf8");
  const shipped = (id: string): Adapter =>
    validateRegistry(registryText).adapters.find((a) => a.id === id)!;
  const load = (name: string) =>
    doc(readFileSync(new URL(`../fixtures/sites/${name}`, import.meta.url), "utf8"));
  const at = { fetchedAt: "2026-09-18T12:00:00.000Z" };

  describe("the homeworks page", () => {
    const hw = shipped("cs374a-fa26-hw");
    const items = runAdapter(hw, load("cs374a-fa2026-homeworks.html"), { url: hw.url, ...at });

    it("ships a valid adapter", () => {
      expect(validateAdapter(hw).adapter).toBeDefined();
    });

    it("reads all eleven homeworks, each from the dt before it", () => {
      expect(items.map((i) => [i.title, i.dueAt])).toEqual([
        ["Homework 1", "2026-09-01T21:00:00-05:00"],
        ["Homework 2", "2026-09-09T21:00:00-05:00"],
        ["Homework 3", "2026-09-15T21:00:00-05:00"],
        ["Homework 4", "2026-09-22T21:00:00-05:00"],
        ["Homework 5", "2026-10-06T21:00:00-05:00"],
        ["Homework 6", "2026-10-13T21:00:00-05:00"],
        ["Homework 7", "2026-10-20T21:00:00-05:00"],
        ["Homework 8", "2026-10-27T21:00:00-05:00"],
        ["Homework 9", "2026-11-03T21:00:00-06:00"],
        ["Homework 10", "2026-11-17T21:00:00-06:00"],
        ["Homework 11", "2026-12-01T21:00:00-06:00"],
      ]);
    });

    it("reads a date the page wrapped in <em><strong>", () => {
      // "Wed Sep 09" is the one deadline that moved off a Tuesday, and the page
      // marks it by bolding the whole `<dt>`. `duePrev` reads the element, not
      // its first text node, so the emphasis costs nothing.
      expect(items[1]!.extra?.["dueText"]).toBe("Wed Sep 09");
    });

    it("puts every one at 21:00 and still calls the clock assumed", () => {
      /*
       * Worker rule 3, and the reason `defaultTime` does not clear the flag.
       * The page states 9pm once, in prose, about homework in general — 21:00
       * on a row is this extension's inference from that sentence, not a clock
       * the row carries. §5.3 ranks `site` above `canvas`, so an unflagged
       * inference would silently replace a real instructor-set Canvas deadline.
       */
      for (const item of items) expect(item.extra?.["timeAssumed"], item.title).toBe("true");
      expect(items.every((i) => i.dueAt!.includes("T21:00:00"))).toBe(true);
    });

    it("would land three hours late without it", () => {
      // The whole point: §4.5's fallback is 23:59, and a 2-hour reminder aimed
      // at that fires at 21:59 — an hour after the real deadline passed.
      const without = { ...hw, defaultTime: undefined } as unknown as Adapter;
      const late = runAdapter(without, load("cs374a-fa2026-homeworks.html"), { url: hw.url, ...at });
      expect(late[0]!.dueAt).toBe("2026-09-01T23:59:00-05:00");
    });

    it("titles each row from the head of the dd", () => {
      // "Homework 1: Strings and induction — [solutions]". §3.1 hashes the
      // title, so the topic (which the course edits) must not be in it.
      expect(items.every((i) => /^Homework \d+$/.test(i.title))).toBe(true);
    });

    it("links the four homeworks that have a PDF, resolved against the page", () => {
      /*
       * The href is `homeworks/hw1.pdf` — relative to the page, not to the
       * origin. Resolving it against the bare origin gives
       * `https://courses.grainger.illinois.edu/homeworks/hw1.pdf`: same origin,
       * https, passes every check in `sameOriginHttpsUrl`, and 404s.
       */
      expect(items[0]!.url).toBe(
        "https://courses.grainger.illinois.edu/cs374al1/fa2026/homeworks/hw1.pdf",
      );
      // The later homeworks are not posted yet and carry no link at all.
      expect(items[10]!.url).toBe(hw.url);
    });

    it("throws, naming duePrev, when no row has a preceding dt", () => {
      /*
       * House rule 2, and the one locator that can fail this way: the hook is
       * outside the row, so a course wrapping each pair in a `<div>` leaves
       * every `<dd>` matching and every one titled, and the course simply stops
       * producing dates.
       */
      const moved = { ...hw, duePrev: "h4" } as unknown as Adapter;
      expect(() =>
        runAdapter(moved, load("cs374a-fa2026-homeworks.html"), { url: hw.url, ...at }),
      ).toThrow(/none had a preceding "h4" sibling/);
    });
  });

  describe("the guided problem sets page", () => {
    const gps = shipped("cs374a-fa26-gps");
    const items = runAdapter(gps, load("cs374a-fa2026-gps.html"), { url: gps.url, ...at });

    it("reads all eleven, on the Mondays the page states", () => {
      expect(items).toHaveLength(11);
      expect(items[0]!.title).toBe("Guided problem set 1");
      expect(items[0]!.dueAt).toBe("2026-08-31T21:00:00-05:00");
      expect(items[10]!.dueAt).toBe("2026-12-07T21:00:00-06:00");
    });

    it("falls every row back to the course page, because the links are off-origin", () => {
      // House rule 7: every GPS links us.prairielearn.com. An off-origin href
      // is the fallback, never silently accepted.
      for (const item of items) expect(item.url).toBe(gps.url);
    });

    it("is a separate entry under the same courseCode", () => {
      // An adapter has one fixed url and this course keeps homeworks and GPSs
      // on two pages, so half of it could never be read by one entry.
      expect(items[0]!.courseCode).toBe("CS374");
      expect(gps.url).not.toBe(shipped("cs374a-fa26-hw").url);
    });
  });

  /**
   * The live page is eleven well-formed pairs, so a right implementation and
   * several wrong ones read it identically (parser rule 10). The fixture's own
   * banner says which rows are invented and what each one is for.
   */
  describe("the adversarial fixture", () => {
    const hw = shipped("cs374a-fa26-hw");
    const items = runAdapter(hw, load("cs374a-fa2026-homeworks-adversarial.html"), {
      url: hw.url,
      ...at,
    });
    const by = (name: string) => items.find((i) => i.title === name);

    it("skips a dd that has no dt before it, rather than reaching out of the list", () => {
      // `titleFrom`'s document-order walk would reach past the `<hr>` into the
      // `<ul>` above and date this row from whatever it found — one assignment
      // dated from another, with nothing looking wrong.
      expect(by("Homework 0")).toBeUndefined();
    });

    it("takes the nearest of two dts, not the first", () => {
      expect(by("Homework 13")!.dueAt).toBe("2026-12-08T21:00:00-06:00");
      expect(items.some((i) => i.dueAt?.startsWith("2026-12-07"))).toBe(false);
    });

    it("keeps a row whose dt is not a date, and records what it said", () => {
      // House rule 1's other half: the hook is there and the *value* is
      // unreadable, so it costs its own field rather than the row.
      const hw14 = by("Homework 14")!;
      expect(hw14.dueAt).toBeUndefined();
      expect(hw14.extra?.["unparsedDate"]).toBe("Mid-semester break");
    });

    it("lets a clock the row states beat the page's default hour", () => {
      /*
       * Precedence: the date cell, then this row, then `defaultTime`, then
       * 23:59. A page-wide default that overrode a row would be the worst of
       * both — an inference outranking a statement — and it would not even be
       * visible, since both instants are on the right day.
       */
      const hw15 = by("Homework 15")!;
      expect(hw15.dueAt).toBe("2026-12-15T23:59:00-06:00");
      expect(hw15.extra?.["timeAssumed"]).toBeUndefined();
    });

    it("leaves the eleven real rows exactly as they were", () => {
      expect(by("Homework 1")!.dueAt).toBe("2026-09-01T21:00:00-05:00");
      expect(items).toHaveLength(14);
    });
  });

  /**
   * The assumed-time merge, mirrored for `defaultTime`.
   *
   * `tests/site.test.ts`'s "assumed times in a merge" pins the same rule for
   * §4.5's 23:59. This is the one that would be easy to get wrong: 21:00 looks
   * much more like a real deadline than 23:59 does, and it is still an
   * inference from one sentence of prose.
   */
  describe("a defaultTime row in a merge", () => {
    const overrides = {
      mergeGroups: [],
      splitKeys: [],
      hiddenKeys: [],
      disabledCourses: [],
      doneKeys: [],
      keptCourses: [],
      courseNames: {},
      dueOverrides: {},
    };

    it("loses to a stated Canvas instant, as §5.3 intends", () => {
      const hw = shipped("cs374a-fa26-hw");
      const site = runAdapter(hw, load("cs374a-fa2026-homeworks.html"), { url: hw.url, ...at })[0]!;
      const real = "2026-09-01T17:00:00.000-05:00";
      const merged = dedupe(
        [
          site,
          {
            source: "canvas",
            sourceId: "c1",
            courseRaw: "CS 374",
            courseCode: "CS374",
            title: "Homework 1",
            kind: "assignment",
            dueAt: real,
            url: "https://canvas.illinois.edu/courses/1/assignments/1",
            status: "unknown",
            extra: {},
            fetchedAt: "2026-09-18T12:00:00.000Z",
          },
        ] as never,
        overrides,
      );
      const row = merged.find((i) => i.courseCode === "CS374")!;
      expect(row.members).toHaveLength(2);
      expect(row.dueAt).toBe(real);
    });
  });
});

describe("clockOf and defaultTime validation", () => {
  it("reads a 24-hour HH:mm", () => {
    expect(clockOf("21:00")).toEqual({ hour: 21, minute: 0 });
    expect(clockOf("00:00")).toEqual({ hour: 0, minute: 0 });
    expect(clockOf("23:59")).toEqual({ hour: 23, minute: 59 });
  });

  it("refuses anything else rather than reading it as midnight", () => {
    // House rule 5: `Number("")` is 0, and split-and-Number would put every
    // deadline on the page at 00:00 — a whole day early, looking like a real
    // answer.
    for (const bad of ["", "9pm", "9:00", "24:00", "21:60", "21", "2100", "21:0", " 21:00"]) {
      expect(clockOf(bad), bad).toBeUndefined();
    }
  });

  it("is what the registry checks", () => {
    expect(validateAdapter({ ...ADAPTER, defaultTime: "21:00" }).adapter).toBeDefined();
    for (const bad of ["9pm", "24:00", "", "9:00"]) {
      expect(validateAdapter({ ...ADAPTER, defaultTime: bad }).reason, bad).toMatch(
        /defaultTime/,
      );
    }
  });

  it("refuses an entry that locates the date twice", () => {
    const both = {
      ...ADAPTER,
      columns: { title: "Exercises", due: "Due Date" },
      duePrev: "dt",
    };
    expect(validateAdapter(both).reason).toMatch(/declare one/);
  });

  it("refuses an empty or oversized duePrev", () => {
    expect(validateAdapter({ ...ADAPTER, duePrev: "" }).reason).toMatch(/bad duePrev/);
    expect(validateAdapter({ ...ADAPTER, duePrev: "x".repeat(201) }).reason).toMatch(
      /bad duePrev/,
    );
  });
});

describe("registry validation of the slot fields", () => {
  it("accepts a pair of column indices", () => {
    expect(validateAdapter({ ...ADAPTER, dueSlot: 1, titleSlot: 4 }).adapter).toBeDefined();
    expect(validateAdapter({ ...ADAPTER, dueSlot: 0 }).adapter).toBeDefined();
  });

  it("refuses anything that is not a whole index in range", () => {
    /*
     * `typeof x === "number"` passes NaN, 1.5 and -1, and each of those indexes
     * the grid to `undefined` on every row — which reads as "this course has no
     * deadlines" rather than as a bad entry. House rule 5, one type over.
     */
    for (const bad of [NaN, 1.5, -1, 100, "1", null, Infinity]) {
      for (const field of ["dueSlot", "titleSlot"]) {
        expect(
          validateAdapter({ ...ADAPTER, [field]: bad }).reason,
          `${field}=${String(bad)}`,
        ).toBe(`cs999-fa26: bad ${field} (a column index from 0 to 99)`);
      }
    }
  });

  it("refuses an entry that locates the title twice", () => {
    expect(
      validateAdapter({
        ...ADAPTER,
        columns: { title: "Exercises", due: "Due Date" },
        titleSlot: 4,
      }).reason,
    ).toBe("cs999-fa26: columns.title and titleSlot both locate the title cell; declare one");
  });

  it("names both locators when an entry declares two of them", () => {
    expect(validateAdapter({ ...ADAPTER, dueSlot: 1, duePrev: "dt" }).reason).toBe(
      "cs999-fa26: dueSlot and duePrev each locate the date cell; declare one",
    );
  });

  it("demands 1.1.0 for either of them", () => {
    expect(requiredVersionFor({ rows: "tr", dueSlot: 1 })).toBe("1.1.0");
    expect(requiredVersionFor({ rows: "tr", titleSlot: 0 })).toBe("1.1.0");
  });
});

describe("matchDuePhrase and titleBefore, in isolation", () => {
  describe("matchDuePhrase", () => {
    it("hooks a keyword followed by a date, through one connector", () => {
      for (const text of ["Due @ 9/13 x", "Due 9/13 x", "Due: 9/13 x", "due on 9/13 x", "Due Date: 9/13 x"]) {
        expect(matchDuePhrase(text, "due"), text).toEqual([{ rest: "9/13 x", pending: false }]);
      }
    });

    it("does not hook a keyword with no date behind it", () => {
      // The real bullet this exists for.
      expect(
        matchDuePhrase("MPs are always due on a SUNDAY at 11.59 PM Central Time.", "due"),
      ).toEqual([]);
      expect(matchDuePhrase("Homeworks are due at 11.59 PM on the due-date, no excuses.", "due"))
        .toEqual([]);
    });

    it("refuses to skip more than one connector", () => {
      // Unbounded skipping would make any sentence mentioning a deadline and a
      // date anywhere into a row.
      expect(matchDuePhrase("Due for the students on 9/13", "due")).toEqual([]);
    });

    it("matches whole words only", () => {
      expect(matchDuePhrase("Overdue 12/15.", "due")).toEqual([]);
      expect(matchDuePhrase("Undue 12/16.", "due")).toEqual([]);
      // And still matches when the punctuation is what ends the word.
      expect(matchDuePhrase("(due 12/16)", "due")).toHaveLength(1);
    });

    it("returns every occurrence in document order", () => {
      const hits = matchDuePhrase("Due @ 12/13. Resubmissions due @ 12/20.", "due");
      expect(hits.map((h) => h.rest)).toEqual(["12/13. Resubmissions due @ 12/20.", "12/20."]);
    });

    it("hooks a placeholder and marks it pending", () => {
      for (const word of ["TBD", "TBA", "N/A", "NA"]) {
        expect(matchDuePhrase(`Due Date: ${word}. Released 12/1.`, "due"), word).toEqual([
          { rest: `${word}. Released 12/1.`, pending: true },
        ]);
      }
    });

    it("takes several keywords, longest first", () => {
      expect(matchDuePhrase("Turn in by 9/13", "due|turn in")).toEqual([
        { rest: "9/13", pending: false },
      ]);
    });

    it("escapes a keyword rather than compiling it", () => {
      // The keyword is remote data. An unescaped `(` is a SyntaxError that takes
      // the adapter down; an unescaped `.` matches a character it should not.
      expect(() => matchDuePhrase("x", "due (final)")).not.toThrow();
      expect(matchDuePhrase("dues 9/13", "due.")).toEqual([]);
    });

    it("has nothing to say about an empty spec", () => {
      // `validateAdapter` refuses one, so this is the second line of defence:
      // an empty keyword compiles to a pattern that matches everywhere.
      expect(matchDuePhrase("Due 9/13", "")).toEqual([]);
      expect(matchDuePhrase("Due 9/13", " | ")).toEqual([]);
    });
  });

  describe("titleBefore", () => {
    it("takes the head of the sentence", () => {
      expect(titleBefore("[HW1 Document]: Released 8/27. Due @ 9/20.", ":")).toBe("HW1 Document");
      expect(titleBefore("Homework 1: Strings and induction", ":")).toBe("Homework 1");
    });

    it("keeps the whole text when the separator is not there", () => {
      expect(titleBefore("Homework 1", ":")).toBe("Homework 1");
    });

    it("drops brackets only when they wrap the whole head", () => {
      expect(titleBefore("[MP1 Specification Document]: x", ":")).toBe("MP1 Specification Document");
      expect(titleBefore("Read [chapter 3] and [4]: x", ":")).toBe("Read [chapter 3] and [4]");
    });

    it("never produces an empty title", () => {
      // A blank row is less recoverable than a visibly wrong one, which is the
      // same rule `titleWithLabel` follows.
      expect(titleBefore(": nothing before it", ":")).toBe(": nothing before it");
    });

    it("collapses whitespace, because a title crosses into a hash", () => {
      expect(titleBefore("  HW1\n  Document : x", ":")).toBe("HW1 Document");
    });
  });
});

describe("registry validation of the prose-shaped fields", () => {
  it("accepts both", () => {
    expect(
      validateAdapter({ ...ADAPTER, duePhrase: "due|turn in", titleBefore: ":" }).adapter,
    ).toBeDefined();
  });

  it("refuses an empty keyword inside duePhrase", () => {
    // `"due|"` splits to an empty string, and an empty keyword matches at every
    // position in every sentence on the page.
    expect(validateAdapter({ ...ADAPTER, duePhrase: "due|" }).reason).toMatch(/empty keyword/);
    expect(validateAdapter({ ...ADAPTER, duePhrase: " | due" }).reason).toMatch(/empty keyword/);
  });

  it("refuses an empty or oversized field", () => {
    expect(validateAdapter({ ...ADAPTER, duePhrase: "" }).reason).toMatch(/bad duePhrase/);
    expect(validateAdapter({ ...ADAPTER, duePhrase: "x".repeat(201) }).reason).toMatch(
      /bad duePhrase/,
    );
    expect(validateAdapter({ ...ADAPTER, titleBefore: "" }).reason).toMatch(/bad titleBefore/);
    // Short like `splitTitle`: a literal applied to every row of remote data.
    expect(validateAdapter({ ...ADAPTER, titleBefore: "x".repeat(9) }).reason).toMatch(
      /bad titleBefore/,
    );
    expect(validateAdapter({ ...ADAPTER, duePhrase: ["due"] }).reason).toMatch(/bad duePhrase/);
  });

  it("refuses an entry that declares both readers", () => {
    // Two readers of one text is not a precedence question, it is an entry that
    // has not decided what the page looks like — and whichever won would be
    // invisible in the preview.
    const both = { ...ADAPTER, dueLabel: "Due", duePhrase: "due" };
    expect(validateAdapter(both).reason).toMatch(/declare one/);
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

describe("a clock before the date (CS 425's lectures page, 2026-09-20)", () => {
  const ZONE = "America/Chicago";
  const REF = "2026-09-20T12:00:00.000Z";

  it("reads `11.59 PM 9/13` as the 13th at 23:59, stated", () => {
    // `MP1 due 11.59 PM 9/13 (Sun)`: the clock first, then the day. Every
    // format is anchored at the start, so this read no date at all — and to the
    // phrase reader a row with no date after "due" is not its row, so the three
    // MP rows vanished without a word.
    const parts = parseAdapterDateParts("11.59 PM 9/13 (Sun), MP1 demos on 9/14 (Mon)", "M/d", ZONE, REF);
    expect(parts?.iso).toBe("2026-09-13T23:59:00-05:00");
    expect(parts?.timeAssumed).toBe(false);
    expect(parts?.unparsedTime).toBeUndefined();
  });

  it("reads `5pm on Sep 20` and `18:00, 2026-09-20` the same way", () => {
    expect(parseAdapterDateParts("5pm on Sep 20", "MMM d, h:mm a", ZONE, REF)?.iso).toBe("2026-09-20T17:00:00-05:00");
    expect(parseAdapterDateParts("18:00, 2026-09-20", "yyyy-MM-dd", ZONE, REF)?.iso).toBe("2026-09-20T18:00:00-05:00");
  });

  it("still refuses a bare number in front of the date as a clock", () => {
    // `5 9/13` is not five o'clock on the 13th; it is a date with a stray digit.
    const parts = parseAdapterDateParts("5 9/13", "M/d", ZONE, REF);
    expect(parts).toBeUndefined();
    expect(parseAdapterDateParts("9/13", "M/d", ZONE, REF)?.timeAssumed).toBe(true);
  });
});

describe("titleSeparatorAt: a clock's colon is not a separator", () => {
  it("skips the colon inside 11:59", () => {
    // `HW1 due 9/20 11:59 PM (Sun)` has no name in front of its colon; cutting
    // there titled the row `HW1 due 9/20 11` (2026-09-20, proposed live).
    expect(titleSeparatorAt("HW1 due 9/20 11:59 PM (Sun)", ":")).toBe(-1);
    expect(titleBefore("HW1 due 9/20 11:59 PM (Sun)", ":")).toBe("HW1 due 9/20 11:59 PM (Sun)");
  });

  it("finds the separator when one comes before or after a clock", () => {
    expect(titleSeparatorAt("[HW1 Document]: Released 8/27.", ":")).toBe(14);
    expect(titleSeparatorAt("Lab 3: due 5:00 PM", ":")).toBe(5);
    expect(titleSeparatorAt("Due 5:00 PM: Lab 3", ":")).toBe(11);
  });

  it("takes any other literal as written", () => {
    expect(titleSeparatorAt("Homework 4 — [solutions]", "—")).toBe(11);
  });
});

describe("the slot guard counts the rows its reader hooks", () => {
  // Six lecture rows; two of them carry a deadline in the topic cell. Read by
  // position alone that column is two dates in six, and the guard threw
  // (2026-09-20) — but under `duePhrase` the four rows without the word are not
  // this adapter's rows, and the two that are both read.
  const page = doc(
    "<table id='s'><tbody>" +
      "<tr><td>9/8</td><td>Intro to consensus</td></tr>" +
      "<tr><td>9/10</td><td>Paxos, part 1. MP1 due 9/13 (Sun)</td></tr>" +
      "<tr><td>9/15</td><td>Paxos, part 2</td></tr>" +
      "<tr><td>9/17</td><td>Raft. HW1 due 9/20 at 11:59 PM</td></tr>" +
      "<tr><td>9/22</td><td>Byzantine faults</td></tr>" +
      "<tr><td>9/24</td><td>Midterm review</td></tr>" +
      "</tbody></table>",
  );
  const adapter = {
    id: "lect-fa26",
    label: "Lectures",
    courseCode: "CS425",
    term: "fa26",
    url: "https://courses.grainger.illinois.edu/cs425/fa2026/lectures.html",
    hostPattern: "https://courses.grainger.illinois.edu/*",
    rows: "#s tr",
    title: "td",
    due: "td",
    dueSlot: 1,
    titleSlot: 1,
    duePhrase: "due",
    dateFormat: "M/d",
    timezone: "America/Chicago",
    minExtensionVersion: "1.1.0",
  } as unknown as Adapter;
  const ctx: PageCtx = { url: adapter.url, fetchedAt: "2026-09-09T12:00:00.000Z" };

  it("reads the two rows that say due, and does not throw over the four that do not", () => {
    const items = runAdapter(adapter, page, ctx);
    expect(items.map((i) => [i.title, i.dueAt])).toEqual([
      ["Paxos, part 1. MP1 due 9/13 (Sun)", "2026-09-13T23:59:00-05:00"],
      ["Raft. HW1 due 9/20 at 11:59 PM", "2026-09-20T23:59:00-05:00"],
    ]);
  });

  it("still throws for a plain slot read of the same column, which is not a date column", () => {
    const plain = { ...adapter, duePhrase: undefined, dueSlot: 1, titleSlot: 0 } as unknown as Adapter;
    expect(() => runAdapter(plain, page, ctx)).toThrow("column 1 read as a date on 0 of 6 rows");
  });
});

/**
 * `clauses`: one cell, a deadline and the occasions beside it.
 *
 * CS 425's lectures page writes `MP2 due 11.59 PM 9/27 (Sun), Demos on 9/28
 * (Mon)` in one cell, so the demo — a thing the student has to turn up to — was
 * not a row this read badly, it was a row nothing ever offered.
 *
 * Two rows here are **deliberately unrealistic** (parser rule 10): no course
 * writes a bare `, 9/21` or a clause that is only "bring a laptop". They are
 * the two cases where a wrong implementation and a right one read the real page
 * identically — a missing head check and a missing date check both produce
 * nothing visible on CS 425.
 */
describe("clauses: several dated clauses in one cell", () => {
  const cells = doc(
    "<table id='s'><tbody>" +
      "<tr><td>9/22</td><td>MP2 due 11.59 PM 9/27 (Sun), Demos on 9/28 (Mon)</td></tr>" +
      "<tr><td>9/24</td><td>HW1 due 9/20 11:59 PM (Sun), Released 8/25, 9/21</td></tr>" +
      "<tr><td>9/29</td><td>HW2 due 10/4 at 11:59 PM (Sun), bring a laptop</td></tr>" +
      "</tbody></table>",
  );
  const base = {
    id: "lect-fa26",
    label: "Lectures",
    courseCode: "CS425",
    term: "fa26",
    url: "https://courses.grainger.illinois.edu/cs425/fa2026/lectures.html",
    hostPattern: "https://courses.grainger.illinois.edu/*",
    rows: "#s tr",
    title: "td",
    due: "td",
    dueSlot: 1,
    titleSlot: 1,
    duePhrase: "due",
    dateFormat: "M/d",
    timezone: "America/Chicago",
    minExtensionVersion: "1.2.0",
  } as unknown as Adapter;
  const cut = { ...base, clauses: "," } as unknown as Adapter;
  const ctx: PageCtx = { url: base.url, fetchedAt: "2026-09-09T12:00:00.000Z" };
  const run = (adapter: Adapter, page = cells) => runAdapter(adapter, page, ctx);

  it("reads the deadline out of its own clause and names the row by it", () => {
    // The title cell *is* the due cell here, so without the cut the row is
    // called "MP2 due 11.59 PM 9/27 (Sun), Demos on 9/28 (Mon)" — a sentence
    // in the popup's title column, and §3.1 hashes it.
    const items = run(cut);
    expect([items[0]!.title, items[0]!.kind, items[0]!.dueAt]).toEqual([
      "MP2 due 11.59 PM 9/27 (Sun)",
      "assignment",
      "2026-09-27T23:59:00-05:00",
    ]);
    expect(items[0]!.extra?.["dueText"]).toBe("11.59 PM 9/27 (Sun)");
    expect(items[0]!.extra?.["timeAssumed"]).toBeUndefined();
  });

  it("makes the demo an event on its own day, named after the row", () => {
    const demo = run(cut).find((item) => item.kind === "event")!;
    // "Demos on 9/28" says nothing about whose demo it is, and four rows
    // titled "Demos" collide on one sourceId (house rule 4).
    expect(demo.title).toBe("MP2: Demos");
    expect(demo.dueAt).toBe("2026-09-28T23:59:00-05:00");
    // The clause states no clock, so 23:59 is this code's (worker rule 3).
    expect(demo.extra?.["timeAssumed"]).toBe("true");
    expect(demo.extra?.["clause"]).toBe("true");
    expect(demo.extra?.["dueText"]).toBe("Demos on 9/28 (Mon)");
    expect(demo.status).toBe("unknown");
    expect(demo.url).toBe(base.url);
  });

  it("drops a release, a bare date and a clause with no date at all", () => {
    const items = run(cut);
    // Nobody attends a release; a bare date has nothing to put in a list; and
    // "bring a laptop" is not an occasion, it is the rest of the sentence.
    expect(items.map((i) => i.dueAt)).toEqual([
      "2026-09-27T23:59:00-05:00",
      "2026-09-28T23:59:00-05:00",
      "2026-09-20T23:59:00-05:00",
      "2026-10-04T23:59:00-05:00",
    ]);
    expect(items.some((i) => /Released|laptop/i.test(i.title))).toBe(false);
  });

  it("emits the events beside the deadline they came from", () => {
    // Document order, so the proposal preview shows each demo under the
    // assignment whose demo it is rather than in a block at the end.
    expect(run(cut).map((i) => i.kind)).toEqual(["assignment", "event", "assignment", "assignment"]);
  });

  it("lets filter.exclude drop the events and keep the deadline", () => {
    const filtered = { ...cut, filter: { exclude: "Demos" } } as unknown as Adapter;
    const items = run(filtered);
    expect(items.some((i) => i.kind === "event")).toBe(false);
    expect(items.map((i) => i.dueAt)).toEqual([
      "2026-09-27T23:59:00-05:00",
      "2026-09-20T23:59:00-05:00",
      "2026-10-04T23:59:00-05:00",
    ]);
  });

  it("does not apply filter.include to an event", () => {
    /*
     * `include` selects the rows that are deadlines — CS 424's is `\bdue\b`,
     * proposed on every grid — and no demo clause says "due". Applied here it
     * would remove every event on the page, which is the one thing this field
     * exists to produce.
     */
    const filtered = { ...cut, filter: { include: "\\bdue\\b" } } as unknown as Adapter;
    expect(run(filtered).find((i) => i.kind === "event")?.title).toBe("MP2: Demos");
  });

  it("changes nothing at all without the field", () => {
    const items = run(base);
    expect(items.map((i) => [i.title, i.kind])).toEqual([
      ["MP2 due 11.59 PM 9/27 (Sun), Demos on 9/28 (Mon)", "assignment"],
      ["HW1 due 9/20 11:59 PM (Sun), Released 8/25, 9/21", "assignment"],
      ["HW2 due 10/4 at 11:59 PM (Sun), bring a laptop", "assignment"],
    ]);
  });

  describe("a page that writes its clauses as sentences", () => {
    const sentences = doc(
      "<table id='s'><tbody>" +
        "<tr><td>9/22</td><td>MP2 due 11.59 PM 9/27 (Sun). Demos on 9/28 (Mon).</td></tr>" +
        "<tr><td>10/6</td><td>MP3 due 11.59 PM 10/11 (Sun). Demos on 10/12 (Mon).</td></tr>" +
        "</tbody></table>",
    );
    const dotted = { ...base, clauses: "." } as unknown as Adapter;

    it("never cuts inside 11.59, so the clock stays stated", () => {
      // Split at that dot the deadline clause is "MP2 due 11" — nothing hooks,
      // the cut falls back to the whole cell, and the demo disappears.
      const items = run(dotted, sentences);
      expect(items.map((i) => [i.title, i.dueAt])).toEqual([
        ["MP2 due 11.59 PM 9/27 (Sun)", "2026-09-27T23:59:00-05:00"],
        ["MP2: Demos", "2026-09-28T23:59:00-05:00"],
        ["MP3 due 11.59 PM 10/11 (Sun)", "2026-10-11T23:59:00-05:00"],
        ["MP3: Demos", "2026-10-12T23:59:00-05:00"],
      ]);
      expect(items[0]!.extra?.["timeAssumed"]).toBeUndefined();
    });
  });
});

describe("splitClauses, firstDateIn and clauseEvents, in isolation", () => {
  const ZONE = "America/Chicago";
  const REF = "2026-09-20T12:00:00.000Z";

  describe("splitClauses", () => {
    it("cuts at the literal and trims what is left", () => {
      expect(splitClauses("MP2 due 9/27, Demos on 9/28", ",")).toEqual([
        "MP2 due 9/27",
        "Demos on 9/28",
      ]);
    });

    it("never cuts a dot that sits between two digits", () => {
      // CS 425 writes every deadline as `11.59 PM`, on both its pages.
      expect(splitClauses("MP2 due 11.59 PM 9/27 (Sun). Demos on 9/28.", ".")).toEqual([
        "MP2 due 11.59 PM 9/27 (Sun)",
        "Demos on 9/28",
      ]);
    });

    it("drops the empty parts a trailing separator leaves", () => {
      expect(splitClauses("a,,b,", ",")).toEqual(["a", "b"]);
      expect(splitClauses("", ",")).toEqual([]);
      expect(splitClauses("a,b", "")).toEqual([]);
    });
  });

  describe("firstDateIn", () => {
    it("names a clause by the words in front of its date", () => {
      expect(firstDateIn("Demos on 9/14 (Mon)")).toEqual({
        head: "Demos",
        text: "9/14 (Mon)",
      });
      expect(firstDateIn("Quiz @ Sep 20")).toEqual({ head: "Quiz", text: "Sep 20" });
      expect(firstDateIn("Review: 2026-09-20")).toEqual({ head: "Review", text: "2026-09-20" });
    });

    it("takes only the words before the date, never the ones after", () => {
      /*
       * A clause that goes on after the day would need a rule for where the
       * sentence ends, and every candidate for that is the separator the cell
       * was already cut at.
       *
       * So a clause that leads with its clock has no head at all — the clock is
       * part of the date token (`11.59 PM 9/13` is how CS 425 writes one) — and
       * `clauseEvents` drops it rather than inventing a name for it.
       */
      expect(firstDateIn("Review session on Sep 20 in ECEB 1002")).toEqual({
        head: "Review session",
        text: "Sep 20 in ECEB 1002",
      });
      expect(firstDateIn("5pm on Sep 20 review session")?.head).toBe("");
    });

    it("says nothing about a clause with no date, or a clause that is one", () => {
      expect(firstDateIn("bring a laptop")).toBeUndefined();
      expect(firstDateIn("9/21")?.head).toBe("");
    });

    it("only looks where a word starts", () => {
      // `mp9/14` is a filename, not a day.
      expect(firstDateIn("see mp9/14 for details")).toBeUndefined();
    });
  });

  describe("clauseEvents", () => {
    const adapter = {
      clauses: ",",
      duePhrase: "due",
      due: ".",
      dateFormat: "M/d",
    } as unknown as Adapter;

    it("is the one implementation the runner and the search both call", () => {
      expect(
        clauseEvents(
          "MP2 due 11.59 PM 9/27 (Sun), Demos on 9/28 (Mon)",
          adapter,
          "row name",
          ZONE,
          REF,
        ),
      ).toEqual([
        {
          title: "MP2: Demos",
          dueAt: "2026-09-28T23:59:00-05:00",
          timeAssumed: true,
          text: "Demos on 9/28 (Mon)",
        },
      ]);
    });

    it("falls back to the row's name when the deadline clause has none", () => {
      // The assignments page: every deadline clause starts with the word "Due",
      // so there is nothing in front of the keyword to name the demo after.
      const events = clauseEvents(
        "Due @ 9/13 11.59 PM Central Time (Sun), Demos on 9/14 (Mon)",
        adapter,
        "MP1 Specification Document",
        ZONE,
        REF,
      );
      expect(events.map((event) => event.title)).toEqual([
        "MP1 Specification Document: Demos",
      ]);
    });

    it("has nothing to say about a cell no clause of which is a deadline", () => {
      expect(clauseEvents("Paxos, Demos on 9/28", adapter, "row", ZONE, REF)).toEqual([]);
    });

    it("keeps a release out of the list, by the words alone", () => {
      for (const word of ["Released", "released", "out", "posted", "available"]) {
        expect(RELEASE_WORDS.test(`MP4 ${word}`), word).toBe(true);
      }
      expect(RELEASE_WORDS.test("Demos")).toBe(false);
      // "Outline" is not "out": a substring match would drop a real occasion.
      expect(RELEASE_WORDS.test("Outline review")).toBe(false);
    });
  });
});

describe("registry validation of clauses", () => {
  it("accepts a short literal", () => {
    expect(validateAdapter({ ...ADAPTER, clauses: "." }).adapter).toBeDefined();
  });

  it("refuses an empty one, a long one and a non-string", () => {
    // House rule 5: `typeof x === "string"` passes `""`, and an empty separator
    // would cut every row into nothing.
    expect(validateAdapter({ ...ADAPTER, clauses: "" }).reason).toMatch(/bad clauses/);
    expect(validateAdapter({ ...ADAPTER, clauses: "x".repeat(9) }).reason).toMatch(/bad clauses/);
    expect(validateAdapter({ ...ADAPTER, clauses: [","] }).reason).toMatch(/bad clauses/);
  });

  it("refuses an entry that also declares splitTitle", () => {
    // Two rules cutting one cell, and whichever ran first would decide what the
    // other saw — the same refusal `columns.due` and `dueSlot` get.
    expect(validateAdapter({ ...ADAPTER, clauses: ".", splitTitle: ";" }).reason).toMatch(
      /splitTitle and clauses both cut a cell into parts; declare one/,
    );
  });

  it("demands 1.2.0, which is the build that learned the field", () => {
    expect(requiredVersionFor({ clauses: "." })).toBe("1.2.0");
    expect(requiredVersionFor({ duePhrase: "due" })).toBe("1.1.0");
    expect(requiredVersionFor({ due: ".due" })).toBe("0.1.0");
  });
});


describe("courseGroupsForYou: one course, one place", () => {
  const entry = (
    courseCode: string,
    id = courseCode,
    extra: Partial<{ enabled: boolean; local: boolean }> = {},
  ) => ({ id, courseCode, enabled: false, local: false, ...extra });

  const labels = (groups: { label: string }[]) => groups.map((group) => group.label);
  const ids = (group: { adapters: { id: string }[] }) => group.adapters.map((a) => a.id);

  it("keeps a course whose pages differ in standing on one side", () => {
    /*
     * Bug 1, 2026-09-21. CS 374 was drawn under "yours" for the `gps.html` Sushi
     * added (local) *and* inside the "4 more courses" disclosure for the
     * published `homeworks.html`, because the partition ran over adapters and
     * the grouping ran after it. One course, torn in half, half of it filed
     * under other people's courses.
     */
    const { yours, others } = courseGroupsForYou(
      [
        entry("CS374", "cs374-gps", { local: true }),
        entry("CS374", "cs374-hw"),
        entry("ECE310", "ece310"),
      ],
      [],
    );
    expect(labels(yours)).toEqual(["CS 374"]);
    expect(ids(yours[0]!)).toEqual(["cs374-gps", "cs374-hw"]);
    expect(labels(others)).toEqual(["ECE 310"]);
  });

  it("is one course when a cross-listed entry and a single-code one share a code", () => {
    /*
     * Bug 2, same screenshot: "CS 425" (his local `lectures.html`) and
     * "CS425/ECE428" (the published `assignments.html`) were two headings, one
     * of them unformatted, because the key was the `courseCode` string.
     */
    const { yours } = courseGroupsForYou(
      [
        entry("CS425", "cs425-lectures", { local: true }),
        entry("CS425/ECE428", "cs425-assignments"),
      ],
      [],
    );
    expect(yours).toHaveLength(1);
    expect(yours[0]!.label).toBe("CS 425 / ECE 428");
    expect(yours[0]!.codes).toEqual(["CS425", "ECE428"]);
    expect(ids(yours[0]!)).toEqual(["cs425-lectures", "cs425-assignments"]);
  });

  it("joins two groups a later cross-listed entry turns out to bridge", () => {
    // `CS425` and `ECE428` stand alone until `CS425/ECE428` arrives and says
    // they were always one course; the pages stay in registry order.
    const { others } = courseGroupsForYou(
      [entry("CS425", "a"), entry("ECE428", "b"), entry("CS425", "c"), entry("CS425/ECE428", "d")],
      [],
    );
    expect(others).toHaveLength(1);
    // Registry order, not merge order: `c` joined the `CS425` group before `d`
    // merged the `ECE428` one into it, so an unsorted merge reads a, c, b, d.
    expect(ids(others[0]!)).toEqual(["a", "b", "c", "d"]);
    expect(others[0]!.label).toBe("CS 425 / ECE 428");
  });

  it("keeps a group whose course a source has seen on this account", () => {
    const { yours, others } = courseGroupsForYou(
      [entry("CS424"), entry("ECE310"), entry("ECE411")],
      ["CS424", "PHYS435"],
    );
    expect(labels(yours)).toEqual(["CS 424"]);
    expect(labels(others)).toEqual(["ECE 310", "ECE 411"]);
  });

  it("matches a cross-listed group on either of the student's codes", () => {
    expect(courseGroupsForYou([entry("CS425/ECE428")], ["CS425"]).yours).toHaveLength(1);
    expect(courseGroupsForYou([entry("CS425/ECE428")], ["ECE428"]).yours).toHaveLength(1);
  });

  it("reads the codes out of a course key that is its name", () => {
    /*
     * `CourseSummary.key` is "a code when there is one" — and when there is not
     * it is the raw name. Gradescope calls this one "CS425 ECE428 Fall 2026",
     * so the student's side is split into codes exactly as the adapter's is.
     */
    const { yours } = courseGroupsForYou([entry("CS425/ECE428")], ["CS425 ECE428 Fall 2026"]);
    expect(yours).toHaveLength(1);
  });

  it("keeps one the student added or switched on, whatever the sources have seen", () => {
    const { yours, others } = courseGroupsForYou(
      [
        entry("CS374", "cs374", { local: true }),
        entry("ECE391", "ece391", { enabled: true }),
        entry("ECE310", "ece310"),
      ],
      [],
    );
    expect(labels(yours)).toEqual(["CS 374", "ECE 391"]);
    expect(labels(others)).toEqual(["ECE 310"]);
  });

  it("keeps the order the registry wrote, on both sides", () => {
    // `adapterGroup` says why: reordering makes "the second ECE 411 row" mean
    // two different things in two places.
    const { yours, others } = courseGroupsForYou(
      [
        entry("ECE411", "a", { enabled: true }),
        entry("ECE310", "b"),
        entry("CS374", "c", { local: true }),
        entry("ECE391", "d"),
        entry("CS233", "e"),
      ],
      [],
    );
    expect(labels(yours)).toEqual(["ECE 411", "CS 374"]);
    expect(labels(others)).toEqual(["ECE 310", "ECE 391", "CS 233"]);
  });

  it("puts everything in others when no course is known yet", () => {
    const { yours, others } = courseGroupsForYou([entry("CS424"), entry("ECE310")], []);
    expect(yours).toEqual([]);
    expect(others).toHaveLength(2);
  });

  it("gives a course with no derivable code its raw name, alone", () => {
    const { others } = courseGroupsForYou([entry("Rhetoric seminar"), entry("Music studio")], []);
    expect(labels(others)).toEqual(["Rhetoric seminar", "Music studio"]);
    expect(others[0]!.department).toBe("Other");
  });

  it("names the department from the first code", () => {
    const { others } = courseGroupsForYou([entry("ECE310"), entry("CS425/ECE428")], []);
    expect(others.map((group) => group.department)).toEqual(["ECE", "CS"]);
  });
});

describe("groupHasCourse: the undo line lands under the right heading", () => {
  const group = courseGroupsForYou(
    [{ courseCode: "CS425/ECE428", enabled: false, local: false }],
    [],
  ).others[0]!;

  it("matches the raw code of a removed page of that course", () => {
    // The removal remembers `CS425`; the heading now reads `CS 425 / ECE 428`,
    // and comparing the strings put "Removed CS 425 · Undo" under no heading.
    expect(groupHasCourse(group, "CS425")).toBe(true);
    expect(groupHasCourse(group, "ECE428")).toBe(true);
    expect(groupHasCourse(group, "CS425/ECE428")).toBe(true);
  });

  it("refuses another course", () => {
    expect(groupHasCourse(group, "ECE310")).toBe(false);
  });

  it("matches a codeless course on its name", () => {
    const named = courseGroupsForYou(
      [{ courseCode: "Rhetoric seminar", enabled: false, local: false }],
      [],
    ).others[0]!;
    expect(groupHasCourse(named, "Rhetoric seminar")).toBe(true);
    expect(groupHasCourse(named, "Music studio")).toBe(false);
  });
});

describe("byDepartment: the catalogue is by major, the yours list is not", () => {
  const entry = (courseCode: string) => ({ courseCode, enabled: false, local: false });

  it("groups the catalogue by department, first-appearance order", () => {
    const { others } = courseGroupsForYou(
      [entry("ECE310"), entry("CS233"), entry("ECE391"), entry("MATH241"), entry("CS374")],
      [],
    );
    expect(
      byDepartment(others).map((dept) => [dept.department, dept.courses.map((c) => c.label)]),
    ).toEqual([
      ["ECE", ["ECE 310", "ECE 391"]],
      ["CS", ["CS 233", "CS 374"]],
      ["MATH", ["MATH 241"]],
    ]);
  });

  it("files a course whose codes span two departments once", () => {
    const { others } = courseGroupsForYou([entry("ECE310"), entry("CS425/ECE428")], []);
    const departments = byDepartment(others);
    expect(departments.flatMap((dept) => dept.courses.map((c) => c.label))).toEqual([
      "ECE 310",
      "CS 425 / ECE 428",
    ]);
    expect(departments.map((dept) => dept.department)).toEqual(["ECE", "CS"]);
  });
});

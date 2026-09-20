/**
 * Adapters a student added themselves (§4.5, self-serve).
 *
 * The store is the trust boundary here, not the UI: a locally added adapter
 * decides what this extension fetches, and it clears the same bar a published
 * one does. Whoever typed it changes nothing about what a bad `url` or
 * `hostPattern` could do.
 */

import { describe, expect, it } from "vitest";
import { emptyStore, migrate, withLocalAdapter, withoutLocalAdapter } from "../src/core/store.js";
import { guessCourseCode } from "../src/core/detect.js";
import type { Adapter } from "../src/sources/types.js";

const VALID = {
  id: "cs225-fa26-local",
  label: "CS 225 course site",
  courseCode: "CS225",
  term: "fa26",
  url: "https://courses.grainger.illinois.edu/cs225/fa2026/",
  hostPattern: "https://courses.grainger.illinois.edu/*",
  rows: "#schedule tr",
  title: "td:nth-child(1)",
  due: "td:nth-child(2)",
  dateFormat: "M/d",
  timezone: "America/Chicago",
  minExtensionVersion: "0.1.0",
};

function stored(localAdapters: unknown[]): Record<string, unknown> {
  return { schemaVersion: 2, raw: {}, items: [], sources: {}, overrides: {}, settings: {}, localAdapters };
}

describe("localAdapters in the store", () => {
  it("starts empty", () => {
    expect(emptyStore().localAdapters).toEqual([]);
  });

  it("keeps one that validates", () => {
    expect(migrate(stored([VALID])).localAdapters).toHaveLength(1);
  });

  it("drops one that is not https", () => {
    const insecure = { ...VALID, url: "http://cs124.org/x", hostPattern: "http://cs124.org/*" };
    expect(migrate(stored([insecure])).localAdapters).toEqual([]);
  });

  it("keeps one on a course site's own domain", () => {
    // AMENDED 2026-09-12: this used to be dropped for not being illinois.edu,
    // which excluded cs124.org, cs128.org and cs225.org — the course sites with
    // the largest enrolments there are.
    const own = { ...VALID, url: "https://cs225.org/fall2026/", hostPattern: "https://cs225.org/*" };
    expect(migrate(stored([own])).localAdapters).toHaveLength(1);
  });

  it("drops one pointing at a host already granted at install", () => {
    const sneaky = {
      ...VALID,
      url: "https://www.gradescope.com/courses/1",
      hostPattern: "https://www.gradescope.com/*",
    };
    expect(migrate(stored([sneaky])).localAdapters).toEqual([]);
  });

  it("drops one whose hostPattern is broader than its url", () => {
    // The pattern is what `chrome.permissions.request` asks for. A wildcard
    // prompts once for every illinois.edu site, and since only the id is
    // stored, a later edit could repoint the url anywhere under it with no
    // second prompt.
    const wide = { ...VALID, hostPattern: "https://*.illinois.edu/*" };
    expect(migrate(stored([wide])).localAdapters).toEqual([]);
  });

  it("drops one with a date format the runner does not have", () => {
    expect(migrate(stored([{ ...VALID, dateFormat: "whenever" }])).localAdapters).toEqual([]);
  });

  it("keeps the good ones when one entry is bad", () => {
    const bad = { ...VALID, id: "bad", url: "http://insecure.illinois.edu/" };
    expect(migrate(stored([VALID, bad])).localAdapters.map((a) => a.id)).toEqual([VALID.id]);
  });

  it("survives a store blob that has no such field", () => {
    const { localAdapters, ...without } = stored([]);
    void localAdapters;
    expect(migrate(without).localAdapters).toEqual([]);
  });

  it("ignores a field that is not a list at all", () => {
    expect(migrate(stored([]) && { ...stored([]), localAdapters: "yes" }).localAdapters).toEqual([]);
  });
});

describe("withLocalAdapter / withoutLocalAdapter (§4.5)", () => {
  const adapter = VALID as unknown as Adapter;
  const other = { ...VALID, id: "ece310-fa26-local" } as unknown as Adapter;

  it("adds one to an empty store", () => {
    expect(withLocalAdapter(emptyStore(), adapter).localAdapters).toEqual([adapter]);
  });

  it("does not disturb the store it was handed, because the caller saves the result", () => {
    // The defect this pair exists for: `background.ts` mutated the object
    // `loadStore()` returned and never wrote it back, so the add was lost at the
    // next worker wake. A helper that mutates its argument would let that shape
    // of call keep looking right.
    const before = emptyStore();
    withLocalAdapter(before, adapter);
    expect(before.localAdapters).toEqual([]);
  });

  it("replaces an earlier entry with the same id rather than adding a second", () => {
    const renamed = { ...VALID, label: "CS 225 (spring site)" } as unknown as Adapter;
    const store = withLocalAdapter(withLocalAdapter(emptyStore(), adapter), renamed);
    expect(store.localAdapters).toHaveLength(1);
    expect(store.localAdapters[0]!.label).toBe("CS 225 (spring site)");
  });

  it("keeps the other adapters when one is removed", () => {
    const both = withLocalAdapter(withLocalAdapter(emptyStore(), adapter), other);
    const left = withoutLocalAdapter(both, adapter.id);
    expect(left.localAdapters.map((a) => a.id)).toEqual([other.id]);
  });

  it("takes the removed adapter's id out of enabledAdapters", () => {
    // An id enabled for an adapter that no longer exists is a fetch the runner
    // can never satisfy.
    const store = {
      ...withLocalAdapter(withLocalAdapter(emptyStore(), adapter), other),
      enabledAdapters: [adapter.id, other.id],
    };
    expect(withoutLocalAdapter(store, adapter.id).enabledAdapters).toEqual([other.id]);
  });

  it("switches the site source off when the last enabled adapter goes", () => {
    // Worker rule 2: a source with nothing to fetch reports that, rather than
    // wearing a green dot for a fetch that never happened.
    const seeded = withLocalAdapter(emptyStore(), adapter);
    const store = {
      ...seeded,
      enabledAdapters: [adapter.id],
      sources: { ...seeded.sources, site: { ...seeded.sources.site, enabled: true, state: "ok" as const } },
    };
    const after = withoutLocalAdapter(store, adapter.id);
    expect(after.sources.site.enabled).toBe(false);
    expect(after.sources.site.state).toBe("disabled");
  });

  it("leaves the site source alone while another adapter is still enabled", () => {
    const seeded = withLocalAdapter(withLocalAdapter(emptyStore(), adapter), other);
    const store = {
      ...seeded,
      enabledAdapters: [adapter.id, other.id],
      sources: { ...seeded.sources, site: { ...seeded.sources.site, enabled: true, state: "ok" as const } },
    };
    const after = withoutLocalAdapter(store, adapter.id);
    expect(after.sources.site.enabled).toBe(true);
    expect(after.sources.site.state).toBe("ok");
  });

  it("is a no-op for an id that is not there", () => {
    const store = withLocalAdapter(emptyStore(), adapter);
    expect(withoutLocalAdapter(store, "nobody").localAdapters).toEqual([adapter]);
  });
});

describe("guessCourseCode", () => {
  it("reads the department and number out of a course URL", () => {
    expect(guessCourseCode("https://courses.grainger.illinois.edu/cs225/fa2026/")).toBe("CS225");
    expect(guessCourseCode("https://courses.grainger.illinois.edu/ece310/fa2026/")).toBe("ECE310");
  });

  it("reads past a section suffix, which the Grainger host puts in the slug", () => {
    // Live, 2026-09-20: the box read "CS225" (its placeholder) for both CS 374 A
    // pages, because `cs374al1` is not `cs374`.
    expect(guessCourseCode("https://courses.grainger.illinois.edu/cs374al1/fa2026/homeworks.html")).toBe("CS374");
    expect(guessCourseCode("https://courses.grainger.illinois.edu/ECE374BL1/fa2026/")).toBe("ECE374");
  });

  it("is not fooled by the term, which is also letters and digits", () => {
    // `fa2026` is four digits, and a course number is three.
    expect(guessCourseCode("https://x.illinois.edu/fa2026/")).toBeUndefined();
  });

  it("has nothing to say about a URL with no course in it", () => {
    expect(guessCourseCode("https://illinois.edu/")).toBeUndefined();
    expect(guessCourseCode("not a url")).toBeUndefined();
  });

  it("uppercases the department, because a course code is not free text", () => {
    expect(guessCourseCode("https://x.illinois.edu/psyc100/")).toBe("PSYC100");
  });
});

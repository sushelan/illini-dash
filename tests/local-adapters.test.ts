/**
 * Adapters a student added themselves (§4.5, self-serve).
 *
 * The store is the trust boundary here, not the UI: a locally added adapter
 * decides what this extension fetches, and it clears the same bar a published
 * one does. Whoever typed it changes nothing about what a bad `url` or
 * `hostPattern` could do.
 */

import { describe, expect, it } from "vitest";
import { emptyStore, migrate } from "../src/core/store.js";
import { guessCourseCode } from "../src/core/detect.js";

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

  it("drops one whose url is not https on an illinois host", () => {
    // §2.3 requests the optional permission for that suffix only, so anything
    // else could never be granted — and must not be offered, typed or fetched.
    const evil = { ...VALID, url: "https://evil.example/x", hostPattern: "https://evil.example/*" };
    expect(migrate(stored([evil])).localAdapters).toEqual([]);
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

describe("guessCourseCode", () => {
  it("reads the department and number out of a course URL", () => {
    expect(guessCourseCode("https://courses.grainger.illinois.edu/cs225/fa2026/")).toBe("CS225");
    expect(guessCourseCode("https://courses.grainger.illinois.edu/ece310/fa2026/")).toBe("ECE310");
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

/**
 * §0 rule 3's other half: the parsers already record what they could not read,
 * and until now nothing looked.
 */

import { describe, expect, it } from "vitest";
import { qualityFlags, unreadableDeadline, unreadableSummary } from "../src/core/quality.js";
import type { Item, RawItem, Source } from "../src/sources/types.js";

function member(source: Source, extra: Record<string, string>): RawItem {
  return {
    source,
    sourceId: `${source}-1`,
    courseRaw: "CS 357",
    title: "Homework 3",
    kind: "assignment",
    url: "https://example.invalid/",
    status: "not_submitted",
    extra,
    fetchedAt: "2026-09-10T18:00:00.000Z",
  };
}

function item(partial: Partial<Item> = {}): Item {
  return {
    id: "x",
    members: [],
    courseLabel: "CS357",
    title: "Homework 3",
    kind: "assignment",
    url: "https://example.invalid/",
    status: "not_submitted",
    hidden: false,
    done: false,
    notified: {},
    ...partial,
  };
}

describe("qualityFlags", () => {
  it("finds every unparsed field the parsers actually write", () => {
    // The real key names, from gradescope.ts, canvas.ts, prairielearn.ts,
    // prairietest.ts and site.ts. A typo here is a flag nobody ever sees.
    const keys = [
      "unparsedDueDate",
      "unparsedDate",
      "unparsedLateDate",
      "unparsedDateRange",
      "unparsedSchedule",
      "unparsedCredit",
      "unparsedReleaseDate",
      "creditMismatch",
      "unknownStatus",
      "idFallback",
    ];
    for (const key of keys) {
      const flags = qualityFlags(item({ members: [member("gradescope", { [key]: "value" })] }));
      expect(flags.map((f) => f.key), key).toEqual([key]);
    }
  });

  it("matches a key exactly, so unparsedDate does not swallow unparsedDateRange", () => {
    // House rule 6: one is a prefix of the other, and a prefix match would
    // report the wrong field name for a PrairieTest window.
    const flags = qualityFlags(
      item({ members: [member("prairietest", { unparsedDateRange: "bad range" })] }),
    );
    expect(flags[0]!.field).toBe("reservation window");
  });

  it("ignores extra keys that are not quality flags", () => {
    const flags = qualityFlags(
      item({ members: [member("prairielearn", { badge: "HW3", creditRemaining: "80" })] }),
    );
    expect(flags).toEqual([]);
  });

  it("separates flags that hide a deadline from flags that do not", () => {
    const flags = qualityFlags(
      item({
        members: [member("gradescope", { unparsedDueDate: "junk", unknownStatus: "Weird" })],
      }),
    );
    expect(flags.find((f) => f.key === "unparsedDueDate")!.blocksDate).toBe(true);
    expect(flags.find((f) => f.key === "unknownStatus")!.blocksDate).toBe(false);
  });

  it("does not show idFallback's marker text as if it were an unreadable value", () => {
    const flags = qualityFlags(item({ members: [member("gradescope", { idFallback: "hashed" })] }));
    expect(flags[0]!.detail).toBeUndefined();
  });
});

describe("unreadableDeadline", () => {
  it("reports a row whose date failed to parse and which therefore has none", () => {
    const flags = unreadableDeadline(
      item({ members: [member("gradescope", { unparsedDueDate: "2026-09-31 17:00:00 -0500" })] }),
    );
    expect(flags).toHaveLength(1);
    expect(flags[0]!.detail).toBe("2026-09-31 17:00:00 -0500");
  });

  it("stays quiet when the row still has a deadline", () => {
    // The late date failed but the due date parsed: the row is listed correctly
    // and the failure costs its own field, exactly as house rule 1 intends.
    expect(
      unreadableDeadline(
        item({
          dueAt: "2026-09-11T17:00:00-05:00",
          members: [member("gradescope", { unparsedLateDate: "junk" })],
        }),
      ),
    ).toEqual([]);
  });

  it("stays quiet for a row that is simply undated", () => {
    expect(unreadableDeadline(item({ members: [member("canvas", {})] }))).toEqual([]);
  });

  it("stays quiet for an undated row whose only failure cannot hide a date", () => {
    // A Canvas LTI shell is legitimately undated, and an odd submission status
    // on it says nothing about a missing deadline. Calling that "couldn't read"
    // would fill the section that is meant to be empty on a healthy sync with
    // rows that are working exactly as intended.
    expect(
      unreadableDeadline(item({ members: [member("canvas", { unknownStatus: "Excused" })] })),
    ).toEqual([]);
    expect(
      unreadableDeadline(item({ members: [member("gradescope", { idFallback: "hashed" })] })),
    ).toEqual([]);
  });

  it("counts a lateDueAt as a deadline, so a reduced-credit row is not called broken", () => {
    expect(
      unreadableDeadline(
        item({
          lateDueAt: "2026-09-22T23:59:00-05:00",
          members: [member("prairielearn", { unparsedCredit: "junk" })],
        }),
      ),
    ).toEqual([]);
  });
});

describe("unreadableSummary", () => {
  it("names the source and the field", () => {
    const flags = unreadableDeadline(
      item({ members: [member("gradescope", { unparsedDueDate: "junk" })] }),
    );
    expect(unreadableSummary(flags)).toBe("gradescope: due date unreadable");
  });

  it("counts the rest rather than listing them all in a 400px row", () => {
    const flags = unreadableDeadline(
      item({
        members: [member("gradescope", { unparsedDueDate: "a", unparsedLateDate: "b" })],
      }),
    );
    expect(unreadableSummary(flags)).toContain("+1 more");
  });

  it("returns nothing when there is nothing wrong", () => {
    expect(unreadableSummary([])).toBeUndefined();
  });
});

describe("the flag tables and the parsers agree", () => {
  it("knows every extra key the source modules actually write", async () => {
    // The tests above compare quality.ts against itself: a key misspelled in
    // both the table and the test would agree and the flag would never appear.
    // This reads the parsers instead, so a new `unparsed*` key in any source —
    // or a rename of an existing one — fails here rather than going unnoticed
    // in the popup.
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");

    const dir = new URL("../src/sources/", import.meta.url).pathname;
    const written = new Set<string>();
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
      const source = readFileSync(join(dir, file), "utf8");
      for (const match of source.matchAll(/extra\["(unparsed[A-Za-z]*|creditMismatch|unknownStatus|idFallback)"\]\s*=/g)) {
        written.add(match[1]!);
      }
    }

    expect(written.size).toBeGreaterThan(5);
    const known = new Set<string>();
    for (const key of written) {
      const flags = qualityFlags(item({ members: [member("gradescope", { [key]: "v" })] }));
      if (flags.length > 0) known.add(key);
    }
    expect([...written].filter((key) => !known.has(key)).sort()).toEqual([]);
  });
});

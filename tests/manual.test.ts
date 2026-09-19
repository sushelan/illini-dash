/**
 * The `manual` source (`core/manual.ts`).
 *
 * Everything here is input a student typed, so every test is really about one
 * of two failures: accepting something that becomes a wrong deadline (house
 * rule 5 — `Date.parse` accepts a bare date and lands it 7pm the day before),
 * or refusing something with a message nobody can act on.
 *
 * The values are deliberately awkward rather than tidy — a date at the end of a
 * month, a time either side of midnight, a DST boundary — because a realistic
 * fixture makes a wrong implementation indistinguishable from a right one
 * (parser house rule 10).
 */

import { describe, expect, it } from "vitest";
import {
  ManualItemError,
  dedupeInput,
  editManualItem,
  newManualItem,
  type ManualInput,
} from "../src/core/manual.js";
import { memberKey, type RawItem } from "../src/sources/types.js";
import { attentionGroups, noDateCount } from "../src/core/calendar.js";
import { dedupe } from "../src/core/dedupe.js";
import { sectionFor } from "../src/core/grouping.js";
import { badgeFor } from "../src/core/health.js";
import { DEFAULT_SETTINGS, emptyStore } from "../src/core/store.js";

const NOW = "2026-09-18T13:00:00.000Z";
const ZONE = "America/Chicago";

function input(patch: Partial<ManualInput> = {}): ManualInput {
  return { title: "Essay draft", courseRaw: "RHET 105", date: "2026-09-30", ...patch };
}

const make = (patch: Partial<ManualInput> = {}) => newManualItem(input(patch), NOW, ZONE);

describe("newManualItem — the row it builds", () => {
  it("is a RawItem on the manual source, keyed like every other row", () => {
    const item = make();
    expect(item.source).toBe("manual");
    // `diagnostics.ts` splits the source back off at the first colon, so an id
    // containing one would corrupt every diagnostics line it appears in.
    expect(item.sourceId).not.toContain(":");
    expect(item.sourceId).not.toBe("");
    expect(memberKey(item.source, item.sourceId)).toBe(`manual:${item.sourceId}`);
  });

  it("gives each row its own id, so two identical entries stay two rows", () => {
    // §3's `raw` is keyed by memberKey and a collision silently merges two
    // deadlines into one (parser house rule 4). Someone adding "Read chapter 4"
    // twice for two different weeks must get two rows.
    const ids = new Set([make().sourceId, make().sourceId, make().sourceId]);
    expect(ids.size).toBe(3);
  });

  it("states the instant with an offset, in the zone it was given (§3.2)", () => {
    expect(make({ time: "17:00" }).dueAt).toBe("2026-09-30T17:00:00-05:00");
  });

  it("uses the offset in force on that date, not a fixed one", () => {
    // 2026-11-05 is after the US clocks go back, so the same wall clock is CST.
    // A hard-coded -05:00 would put this an hour wrong — §3.2's whole point.
    expect(make({ date: "2026-11-05", time: "17:00" }).dueAt).toBe("2026-11-05T17:00:00-06:00");
  });

  it("marks a blank time as invented rather than pretending 23:59 was stated", () => {
    // Worker house rule 3: "a value this code invented is not a value the
    // source stated". §5.3 ranks a stated instant above an assumed one, the
    // .ics writes an all-day event, and §7 never announces a clock time.
    const item = make();
    expect(item.dueAt).toBe("2026-09-30T23:59:00-05:00");
    expect(item.extra?.["timeAssumed"]).toBe("true");
  });

  it("does not mark a time the student actually typed", () => {
    expect(make({ time: "23:59" }).extra?.["timeAssumed"]).toBeUndefined();
  });

  it("records an end instant for work that occupies a span", () => {
    const item = make({ time: "09:00", endTime: "11:30" });
    expect(item.dueAt).toBe("2026-09-30T09:00:00-05:00");
    expect(item.extra?.["endAt"]).toBe("2026-09-30T11:30:00-05:00");
  });

  it("derives the §5.1 course code, and keeps the name as typed", () => {
    const item = make({ courseRaw: "CS 357 — Numerical Methods" });
    expect(item.courseCode).toBe("CS357");
    expect(item.courseRaw).toBe("CS 357 — Numerical Methods");
  });

  it("leaves the code off a course name no rule can read", () => {
    const item = make({ courseRaw: "Marching Illini" });
    expect(item.courseCode).toBeUndefined();
    expect(item.courseRaw).toBe("Marching Illini");
  });

  it("is `unknown`, because nothing is watching it", () => {
    // And because `contradictsDone` only fires on `missing`: a manual row the
    // student ticks off must stay ticked, since no source can disagree.
    expect(make().status).toBe("unknown");
  });

  it("defaults to an assignment and takes any other §3 kind", () => {
    expect(make().kind).toBe("assignment");
    expect(make({ kind: "exam" }).kind).toBe("exam");
  });

  it("carries no url at all when the student gave none", () => {
    // Not `""`. An empty string passes `typeof x === "string"` and would make a
    // row that renders as a link to nowhere (house rule 5).
    expect(make()).not.toHaveProperty("url");
    expect(make({ url: "  " })).not.toHaveProperty("url");
  });

  it("keeps an https link", () => {
    expect(make({ url: "https://piazza.com/class/abc" }).url).toBe("https://piazza.com/class/abc");
  });

  it("trims whitespace off a pasted date rather than making a puzzle of it", () => {
    expect(make({ date: " 2026-09-30 ", time: " 17:00 " }).dueAt).toBe("2026-09-30T17:00:00-05:00");
  });

  it("trims the title and the course rather than storing the whitespace", () => {
    const item = make({ title: "  Essay draft \n", courseRaw: " RHET 105 " });
    expect(item.title).toBe("Essay draft");
    expect(item.courseRaw).toBe("RHET 105");
  });

  it("keeps a note, and omits `extra` entirely when there is nothing to put in it", () => {
    expect(make({ time: "17:00", note: "bring the printed copy" }).extra).toEqual({
      note: "bring the printed copy",
    });
    expect(make({ time: "17:00" }).extra).toBeUndefined();
  });

  it("stamps when it was written", () => {
    expect(make().fetchedAt).toBe(NOW);
  });
});

describe("newManualItem — what it refuses, and what it says", () => {
  /** [what is wrong, the input, a phrase the student should see]. */
  const cases: [string, Partial<ManualInput>, RegExp][] = [
    ["no title", { title: "" }, /title/i],
    ["a title that is only whitespace", { title: "   " }, /title/i],
    ["a title past 200 characters", { title: "x".repeat(201) }, /200/],
    ["no course", { courseRaw: "" }, /course/i],
    // Every one of these is accepted by `Date.parse`, and the bare date lands
    // at 7pm the previous day in this zone — house rule 5's own example.
    ["a US-style date", { date: "09/30/2026" }, /YYYY-MM-DD/],
    ["a written date", { date: "Sep 30 2026" }, /YYYY-MM-DD/],
    ["a single-digit month", { date: "2026-9-30" }, /YYYY-MM-DD/],
    ["a date with something after it", { date: "2026-09-30T17:00" }, /YYYY-MM-DD/],
    ["a day that does not exist", { date: "2026-02-30" }, /no such date as 2026-02-30/],
    ["a 13th month", { date: "2026-13-01" }, /no such date/],
    ["a 12-hour time", { time: "5:00 PM" }, /HH:MM/],
    ["a time with no leading zero", { time: "9:05" }, /HH:MM/],
    ["a 24th hour", { time: "24:00" }, /HH:MM/],
    ["a 60th minute", { time: "09:60" }, /HH:MM/],
    ["an end time before the start", { time: "11:00", endTime: "09:00" }, /after the start/i],
    ["an end time equal to the start", { time: "11:00", endTime: "11:00" }, /after the start/i],
    ["a bad end time", { endTime: "half past" }, /HH:MM/],
    // House rule 7 does not relax because a person typed the value: this URL
    // would be opened by a click on the row.
    ["a javascript: link", { url: "javascript:alert(1)" }, /https:\/\//],
    ["an http link", { url: "http://courses.illinois.edu/x" }, /https:\/\//],
    ["a protocol-relative link", { url: "//evil.test/x" }, /not a web address|https:\/\//],
    ["something that is not a link", { url: "piazza" }, /not a web address/],
    ["a note past 500 characters", { note: "x".repeat(501) }, /500/],
    ["a kind that is not a kind", { kind: "homework" as never }, /kind of work/],
  ];

  for (const [what, patch, message] of cases) {
    it(`refuses ${what}`, () => {
      expect(() => make(patch)).toThrow(ManualItemError);
      expect(() => make(patch)).toThrow(message);
    });
  }

  it("refuses with a ManualItemError, never a ParseError", () => {
    // A ParseError means "a page changed shape, go fix the selectors" and drives
    // §6's `parse_error` state. A mistyped date is not a source failing, and
    // reporting it as one would put a red dot on a source that is working.
    try {
      make({ date: "tomorrow" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as Error).name).toBe("ManualItemError");
    }
  });
});

describe("editManualItem", () => {
  const before = newManualItem(
    input({ title: "Essay draft", time: "17:00", url: "https://example.illinois.edu/a" }),
    NOW,
    ZONE,
  );

  it("keeps the id, so the hide, the tick and the merge all survive an edit", () => {
    // The overrides are keyed by memberKey (§3.1). A new id on every save would
    // silently spend every correction the student had made to this row.
    const after = editManualItem(before, input({ title: "Essay final", time: "09:00" }), NOW, ZONE);
    expect(after.sourceId).toBe(before.sourceId);
    expect(memberKey(after.source, after.sourceId)).toBe(memberKey(before.source, before.sourceId));
    expect(after.title).toBe("Essay final");
    expect(after.dueAt).toBe("2026-09-30T09:00:00-05:00");
  });

  it("clears a field the student emptied rather than keeping the old value", () => {
    // A restatement, not a patch: the editor shows every field, so a cleared box
    // means "there is no link", and carrying the old one forward would make a
    // row whose link the student cannot get rid of.
    const after = editManualItem(before, input({ time: "17:00" }), NOW, ZONE);
    expect(after).not.toHaveProperty("url");
  });

  it("applies exactly the rules a create does", () => {
    // The second path is the one written later, from memory, that forgets a
    // check — so it is the same `fieldsOf` or it will drift.
    expect(() => editManualItem(before, input({ date: "09/30/2026" }), NOW, ZONE)).toThrow(
      ManualItemError,
    );
    expect(() => editManualItem(before, input({ title: "" }), NOW, ZONE)).toThrow(ManualItemError);
  });
});

describe("dedupeInput", () => {
  const manual = make();
  const fetched: RawItem = {
    source: "gradescope",
    sourceId: "1",
    courseRaw: "CS 357",
    title: "HW1",
    kind: "assignment",
    url: "https://www.gradescope.com/courses/1/assignments/1",
    status: "not_submitted",
    fetchedAt: NOW,
  };

  it("hands dedupe the fetched rows and the typed ones together", () => {
    const all = dedupeInput({ "gradescope:1": fetched }, [manual]);
    expect(all).toHaveLength(2);
    expect(all.map((item) => item.source).sort()).toEqual(["gradescope", "manual"]);
  });

  it("is still the fetched rows when nothing has been typed", () => {
    expect(dedupeInput({ "gradescope:1": fetched }, [])).toEqual([fetched]);
  });
});

describe("a manual row with no date (brief D11)", () => {
  const undated = (patch: Partial<ManualInput> = {}) =>
    newManualItem({ title: "Read chapter 4", courseRaw: "CS 357", ...patch }, NOW, ZONE);

  it("has no instant at all, rather than an invented one", () => {
    /*
     * The two things this must not become. `dueAt: undefined` and not a key
     * holding nothing, so a store round trip through JSON cannot turn "no date"
     * into something a reader has to interpret; and **no `timeAssumed`**, which
     * says "this instant exists and we invented its clock" (worker house rule
     * 3) and would hand §5.3 a date to rank.
     */
    const item = undated();
    expect(item.dueAt).toBeUndefined();
    expect(Object.keys(item)).not.toContain("dueAt");
    expect(item.lateDueAt).toBeUndefined();
    expect(item.extra?.["timeAssumed"]).toBeUndefined();
  });

  it("is a normal row otherwise, keyed and validated like any other", () => {
    const item = undated({ note: "chapter 4 only", url: "https://example.edu/x" });
    expect(item.source).toBe("manual");
    expect(item.courseCode).toBe("CS357");
    expect(item.status).toBe("unknown");
    expect(item.extra?.["note"]).toBe("chapter 4 only");
    expect(() => undated({ title: "  " })).toThrow(ManualItemError);
    expect(() => undated({ courseRaw: "" })).toThrow(ManualItemError);
  });

  it("refuses a time with no day, rather than dropping it silently", () => {
    // A time with no day is half a deadline and there is no honest instant to
    // build from it. A student who typed 5:00 PM and watched it vanish has no
    // way to know why — the same argument `parseUrl` makes about a link.
    expect(() => undated({ time: "17:00" })).toThrow(ManualItemError);
    expect(() => undated({ time: "17:00" })).toThrow(/Give this a date/);
    expect(() => undated({ endTime: "19:00" })).toThrow(ManualItemError);
  });

  it("still refuses a bad date rather than treating it as no date", () => {
    // The one failure that would make this change dangerous: a typo silently
    // becoming an undated row, so the deadline the student typed is gone and
    // nothing says so.
    expect(() => newManualItem(input({ date: "2026-9-30" }), NOW, ZONE)).toThrow(ManualItemError);
    expect(() => newManualItem(input({ date: "2026-09-31" }), NOW, ZONE)).toThrow(ManualItemError);
  });

  it("lands in the No date group, where every undated source row already sits", () => {
    const item = undated();
    const [built] = dedupe([item], emptyStore().overrides);
    const groups = attentionGroups([built!], new Date(NOW));
    expect(groups.map((g) => g.name)).toEqual(["No date at all"]);
    expect(groups[0]!.items[0]!.title).toBe("Read chapter 4");
    expect(noDateCount([built!], new Date(NOW))).toBe(1);
  });

  it("takes a date later without spending the hide, the tick or the merge", () => {
    // `editManualItem` carries the `sourceId` over, and every override is keyed
    // by memberKey — so "Give it a date" is an ordinary edit rather than a
    // delete and an add.
    const before = undated();
    const after = editManualItem(
      before,
      { title: "Read chapter 4", courseRaw: "CS 357", date: "2026-09-30", time: "17:00" },
      NOW,
      ZONE,
    );
    expect(after.sourceId).toBe(before.sourceId);
    expect(memberKey("manual", after.sourceId)).toBe(memberKey("manual", before.sourceId));
    expect(after.dueAt).toBeDefined();
    expect(after.extra?.["timeAssumed"]).toBeUndefined();

    const [built] = dedupe([after], emptyStore().overrides);
    expect(attentionGroups([built!], new Date(NOW))).toEqual([]);
    expect(built!.dueAt).toBe(after.dueAt);
  });

  it("can have its date taken away again", () => {
    const dated = newManualItem(input(), NOW, ZONE);
    const cleared = editManualItem(dated, { title: "x", courseRaw: "CS 357" }, NOW, ZONE);
    expect(cleared.dueAt).toBeUndefined();
    expect(cleared.sourceId).toBe(dated.sourceId);
  });

  it("does not choke the store or the sync path", () => {
    // Undated *source* rows have always existed, so this is a confirmation
    // rather than a new guarantee — and the one place it could go wrong is the
    // manual rows being merged in on a different path (`dedupeInput`).
    const item = undated();
    const store = emptyStore();
    store.manualItems = [item];
    const items = dedupe(dedupeInput(store.raw, store.manualItems), store.overrides);
    expect(items.map((one) => one.title)).toEqual(["Read chapter 4"]);
    expect(items[0]!.dueAt).toBeUndefined();
    expect(sectionFor(items[0]!, new Date(NOW))).toBeUndefined();
    expect(badgeFor(items, store.sources, DEFAULT_SETTINGS, new Date(NOW)).text).toBe("");
  });
});

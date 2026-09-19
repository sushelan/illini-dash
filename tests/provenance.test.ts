/**
 * Two live reports on 2026-09-19, both on rows Sushi typed himself:
 *
 *   "when i change the date of my own item, it says moved by announcement."
 *   "when i hover over end of day, it says course site doesnt mention a time,
 *    but it should really just be 'no time specified'."
 *
 * Both sentences were constants, so both asserted something no fact behind them
 * supported — worker house rule 3's general form. These tests pin the three
 * things that were wrong, and each was mutation-checked with a count assertion
 * before it was written down (see scratchpad/lane-provenance.md).
 */

import { describe, expect, it } from "vitest";
import {
  OWN_TIME_NOTE,
  OWN_TIME_NOTE_ALL_DAY,
  SOURCE_TIME_NOTE,
  SOURCE_TIME_NOTE_ALL_DAY,
  assumedTimeNote,
  dateOrigin,
  isStudentsOwn,
  movedHeading,
  movedRange,
} from "../src/core/provenance.js";
import { movedText } from "../src/core/grouping.js";
import { movedByText } from "../src/core/suggest.js";
import { STUDENT_POST_ID } from "../src/core/overrides.js";
import type { Item, RawItem, Source } from "../src/sources/types.js";

function member(source: Source): RawItem {
  return {
    source,
    sourceId: `${source}-1`,
    courseRaw: "CS 357",
    title: "Thing",
    kind: "assignment",
    status: "unknown",
    fetchedAt: "2026-09-19T12:00:00.000Z",
  };
}

function item(partial: Partial<Item> = {}): Item {
  return {
    id: "x",
    members: [member("manual")],
    courseLabel: "CS357",
    title: "Thing",
    kind: "assignment",
    status: "unknown",
    hidden: false,
    done: false,
    notified: {},
    ...partial,
  };
}

const iso = (h: number, min = 0, day = 19) =>
  new Date(2026, 8, day, h, min).toISOString();

describe("isStudentsOwn", () => {
  it("is one manual member and nothing else", () => {
    expect(isStudentsOwn(item())).toBe(true);
    expect(isStudentsOwn(item({ members: [member("gradescope")] }))).toBe(false);
  });

  it("is false for a typed row a source also reports", () => {
    // A merged row *does* have a course site, so the course-site sentence is
    // the true one for it — and the Edit/Delete rule in the row menu draws the
    // same line for the same reason.
    expect(isStudentsOwn(item({ members: [member("manual"), member("gradescope")] }))).toBe(false);
  });
});

describe("assumedTimeNote", () => {
  it("does not send the student to a course page their own row does not have", () => {
    expect(assumedTimeNote(item())).toBe(OWN_TIME_NOTE);
    expect(assumedTimeNote(item(), "allDay")).toBe(OWN_TIME_NOTE_ALL_DAY);
    expect(assumedTimeNote(item())).not.toContain("course site");
  });

  it("keeps the instruction where there is a page to act on", () => {
    const sourced = item({ members: [member("prairielearn")] });
    expect(assumedTimeNote(sourced)).toBe(SOURCE_TIME_NOTE);
    expect(assumedTimeNote(sourced, "allDay")).toBe(SOURCE_TIME_NOTE_ALL_DAY);
  });
});

describe("dateOrigin / movedHeading", () => {
  it("does not call the student's own edit an announcement", () => {
    // `movedFrom` is derived per sync and carries no author at all; on a row
    // with one manual member the only thing that can have changed it is an
    // edit. This is the reported defect.
    const edited = item({ movedFrom: iso(11), dueAt: iso(17) });
    expect(dateOrigin(edited)).toBe("student-edit");
    expect(movedHeading(edited)).toBe("You changed this date");
    expect(movedHeading(edited)).not.toContain("announcement");
  });

  it("does not blame an announcement for a source simply printing a new date", () => {
    const moved = item({ members: [member("gradescope")], movedFrom: iso(11), dueAt: iso(17) });
    expect(dateOrigin(moved)).toBe("source-change");
    expect(movedHeading(moved)).toBe("The source now gives a different date");
  });

  it("still names an announcement when a post wrote the correction", () => {
    const post = item({
      members: [member("gradescope")],
      dueAt: iso(17),
      movedBy: { reason: "Campuswire post 2026-09-18", from: iso(11), postId: "cw-1" },
    });
    expect(dateOrigin(post)).toBe("announcement");
    expect(movedHeading(post)).toBe("Moved by an announcement");
  });

  it("still names the student when 'Give it a date' wrote it", () => {
    const own = item({
      members: [member("gradescope")],
      dueAt: iso(17),
      movedBy: { reason: "you", from: iso(11), postId: STUDENT_POST_ID },
    });
    expect(dateOrigin(own)).toBe("student-override");
    expect(movedHeading(own)).toBe("You set this date");
  });

  it("says nothing about a row that did not move", () => {
    expect(dateOrigin(item({ dueAt: iso(17) }))).toBeUndefined();
    expect(movedHeading(item({ dueAt: iso(17) }))).toBeUndefined();
  });
});

describe("movedRange", () => {
  it("shows the clock when both ends are the same day", () => {
    // The reported defect: "moved Sat, Sep 19 → Sat, Sep 19" — a move block
    // reporting no move.
    const text = movedRange(new Date(iso(11)), new Date(iso(17)));
    expect(text).toContain("→");
    expect(text).toMatch(/Sat, Sep 19, \d/);
    expect(text!.split("→")[0]).not.toBe(text!.split("→")[1]);
  });

  it("stays day-only across days, which is what an extension looks like", () => {
    expect(movedRange(new Date(iso(12, 0, 19)), new Date(iso(12, 0, 22)))).toBe(
      "Sat, Sep 19 → Tue, Sep 22",
    );
  });

  it("reports nothing when nothing moved", () => {
    expect(movedRange(new Date(iso(17)), new Date(iso(17)))).toBeUndefined();
    // Re-parsing the same page shifts an instant by a second, which is not a move.
    expect(movedRange(new Date(iso(17, 0)), new Date(Date.parse(iso(17, 0)) + 5_000))).toBeUndefined();
  });

  it("refuses an unreadable end rather than rendering 'Invalid Date'", () => {
    expect(movedRange(new Date("nope"), new Date(iso(17)))).toBeUndefined();
  });
});

describe("the two surfaces that render a move", () => {
  it("movedText no longer collapses a same-day move to one repeated day", () => {
    const edited = item({ movedFrom: iso(11), dueAt: iso(17) });
    expect(movedText(edited)).not.toBe("moved Sat, Sep 19 → Sat, Sep 19");
    expect(movedText(edited)).toMatch(/^moved Sat, Sep 19, /);
  });

  it("movedByText falls back to 'now due' when the override restates the date it held", () => {
    const same = item({
      members: [member("gradescope")],
      dueAt: iso(17),
      movedBy: { reason: "you", from: iso(17), postId: STUDENT_POST_ID },
    });
    expect(movedByText(same)).toBe("now due Sat, Sep 19 · from you");
  });
});

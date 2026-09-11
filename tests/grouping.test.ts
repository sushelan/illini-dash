/** §8.1's sections. The boundaries are the part that goes quietly wrong. */

import { describe, expect, it } from "vitest";
import {
  formatDue,
  groupItems,
  liveDeadline,
  sectionFor,
  type SectionName,
} from "../src/core/grouping.js";
import { DEFAULT_SETTINGS } from "../src/core/store.js";
import type { Item, RawItem, Status } from "../src/sources/types.js";

function member(status: Status, extra?: Record<string, string>): RawItem {
  return {
    source: "gradescope",
    sourceId: `${status}${Math.random()}`,
    courseRaw: "CS 357",
    title: "m",
    kind: "assignment",
    url: "https://www.gradescope.com/",
    status,
    extra,
    fetchedAt: "2026-09-10T18:00:00.000Z",
  };
}

function item(partial: Partial<Item> = {}): Item {
  return {
    id: partial.id ?? "x",
    members: [],
    courseLabel: "CS357",
    title: "Thing",
    kind: "assignment",
    url: "https://example.invalid/",
    status: "not_submitted",
    hidden: false,
    done: false,
    notified: {},
    ...partial,
  };
}

// A Thursday, 6pm local.
const NOW = new Date(2026, 8, 10, 18, 0, 0);
const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m, d, h, min).toISOString();

describe("sectionFor (§8.1)", () => {
  it("puts booking items first, whatever their date", () => {
    expect(sectionFor(item({ kind: "booking", dueAt: at(2026, 10, 1) }), NOW)).toBe(
      "Needs attention",
    );
    // Even with no date at all — the window closes regardless.
    expect(sectionFor(item({ kind: "booking" }), NOW)).toBe("Needs attention");
  });

  it("buckets by day boundary, not by 24-hour spans", () => {
    // 11pm tonight is Today; 1am tomorrow is Tomorrow, only two hours later.
    expect(sectionFor(item({ dueAt: at(2026, 8, 10, 23) }), NOW)).toBe("Today");
    expect(sectionFor(item({ dueAt: at(2026, 8, 11, 1) }), NOW)).toBe("Tomorrow");
  });

  it("runs 'this week' through Sunday and no further", () => {
    // Thursday the 10th: Saturday and Sunday are this week, Monday is Later.
    expect(sectionFor(item({ dueAt: at(2026, 8, 12) }), NOW)).toBe("This week");
    expect(sectionFor(item({ dueAt: at(2026, 8, 13) }), NOW)).toBe("This week");
    expect(sectionFor(item({ dueAt: at(2026, 8, 14) }), NOW)).toBe("Later");
  });

  it("leaves 'this week' empty when today is Sunday", () => {
    // "Through Sunday" means Sunday ends the week; it must not silently become
    // the next seven days. Monday is still Tomorrow, which outranks both — the
    // property is that Tuesday falls through to Later rather than This week.
    const sunday = new Date(2026, 8, 13, 18, 0, 0);
    expect(sectionFor(item({ dueAt: at(2026, 8, 13, 23) }), sunday)).toBe("Today");
    expect(sectionFor(item({ dueAt: at(2026, 8, 14) }), sunday)).toBe("Tomorrow");
    expect(sectionFor(item({ dueAt: at(2026, 8, 15) }), sunday)).toBe("Later");
    expect(
      groupItems([item({ dueAt: at(2026, 8, 15) })], sunday, DEFAULT_SETTINGS).map((s) => s.name),
    ).toEqual(["Later"]);
  });

  it("surfaces overdue unfinished work for seven days, then drops it", () => {
    expect(sectionFor(item({ dueAt: at(2026, 8, 8) }), NOW)).toBe("Needs attention");
    expect(sectionFor(item({ dueAt: at(2026, 8, 1) }), NOW)).toBeUndefined();
  });

  it("does not nag about overdue work that is already done", () => {
    expect(sectionFor(item({ dueAt: at(2026, 8, 8), status: "submitted" }), NOW)).toBeUndefined();
    expect(sectionFor(item({ dueAt: at(2026, 8, 8), status: "graded" }), NOW)).toBeUndefined();
  });

  it("drops undated items and anything past the 60-day horizon", () => {
    expect(sectionFor(item({}), NOW)).toBeUndefined();
    expect(sectionFor(item({ dueAt: at(2027, 0, 1) }), NOW)).toBeUndefined();
  });
});

describe("an assessment that has not opened yet", () => {
  /*
   * PrairieLearn prints `Available 09:00, Sat, Sep 12` for work that is listed
   * but not yet open. It has no deadline, so before this every such row either
   * sat under "Couldn't read" (when the cell text was kept as unreadable) or
   * vanished from the list entirely (when it was not) — eight ECE 374 problem
   * sets, in the first case.
   */
  const opens = (iso: string, rest: Partial<Item> = {}) =>
    item({ title: "GPS4 Language Transformations", members: [member("not_submitted", { releasedAt: iso })], ...rest });

  it("places the row by when it opens", () => {
    expect(sectionFor(opens(at(2026, 8, 11, 9)), NOW)).toBe("Tomorrow");
    expect(sectionFor(opens(at(2026, 8, 25, 9)), NOW)).toBe("Later");
  });

  it("says when it opens instead of 'no date'", () => {
    const text = formatDue(opens(at(2026, 8, 25, 9)), NOW, "Later");
    expect(text.primary).toBe("opens Sep 25");
    expect(text.detail).toBe("not open yet");
  });

  it("never invents a deadline from the opening time", () => {
    // Worker rule 3: §5.3 ranks instants across sources, and an invented one
    // would outrank a real deadline another source states for the same work.
    const row = opens(at(2026, 8, 25, 9));
    expect(row.dueAt).toBeUndefined();
    expect(row.lateDueAt).toBeUndefined();
  });

  it("drops the row once the opening time has passed", () => {
    // By then the source states a real deadline, or the row has nothing to say.
    expect(sectionFor(opens(at(2026, 8, 10, 9)), NOW)).toBeUndefined();
  });

  it("stays out of the list past the 60-day horizon", () => {
    expect(sectionFor(opens(at(2026, 11, 20, 9)), NOW)).toBeUndefined();
  });

  it("lets a real deadline win over an opening time on the same row", () => {
    // Gradescope records `releasedAt` for work that is already open and dated.
    // The deadline is what the student acts on.
    const both = opens(at(2026, 8, 25, 9), { dueAt: at(2026, 8, 11, 23, 59) });
    expect(sectionFor(both, NOW)).toBe("Tomorrow");
    expect(formatDue(both, NOW, "Tomorrow").primary).not.toContain("opens");
  });

  it("still says 'no date' for a row that genuinely has none", () => {
    expect(formatDue(item({ members: [member("not_submitted")] }), NOW, "Later").primary).toBe(
      "no date",
    );
  });
});

describe("a calendar event is not unfinished work", () => {
  /*
   * From a real list: "Needs attention" held seven rows, and six were Canvas
   * calendar events — the same "Fall 2026 Office Hours" block on four days, and
   * a class Zoom link twice. An event has no submission, so `isItemDone` is
   * never true and the overdue branch held each one for a full week. The one
   * row that actually needed attention was outnumbered six to one.
   */
  const event = (dueAt: string) => item({ kind: "event", title: "Office Hours", dueAt });

  it("drops an event once it has happened", () => {
    expect(sectionFor(event(at(2026, 8, 10, 15)), NOW)).toBeUndefined();
  });

  it("never files an event under Needs attention, however recent", () => {
    // One minute past is the case the overdue window is most eager to keep.
    expect(sectionFor(event(at(2026, 8, 10, 17, 59)), NOW)).not.toBe("Needs attention");
  });

  it("still shows an event that has not happened yet", () => {
    expect(sectionFor(event(at(2026, 8, 11, 15)), NOW)).toBe("Tomorrow");
    expect(sectionFor(event(at(2026, 8, 10, 20)), NOW)).toBe("Today");
  });

  it("leaves overdue assignments exactly where they were", () => {
    // The guard is keyed on `kind`, and widening it to every undone row would
    // empty the section this whole change exists to protect.
    expect(sectionFor(item({ dueAt: at(2026, 8, 10, 15) }), NOW)).toBe("Needs attention");
  });

  it("does not rescue an unknown plannable type, which may be real work", () => {
    // §4.1 maps an unlisted plannable_type to `other` deliberately: it might be
    // a deadline, and §11 ranks a silently dropped deadline worst of all.
    expect(sectionFor(item({ kind: "other", dueAt: at(2026, 8, 10, 15) }), NOW)).toBe(
      "Needs attention",
    );
  });

  it("keeps an exam on the course calendar in the list", () => {
    // §4.1 promotes a calendar_event whose title says exam, and that promotion
    // has to survive this change or a midterm silently becomes furniture.
    expect(sectionFor(item({ kind: "exam", dueAt: at(2026, 8, 10, 15) }), NOW)).toBe(
      "Needs attention",
    );
  });
});

describe("groupItems", () => {
  it("omits empty sections and keeps §8.1's order", () => {
    const sections = groupItems(
      [
        item({ id: "a", dueAt: at(2026, 8, 14) }),
        item({ id: "b", kind: "booking" }),
        item({ id: "c", dueAt: at(2026, 8, 10, 23) }),
      ],
      NOW,
      DEFAULT_SETTINGS,
    );
    expect(sections.map((s) => s.name)).toEqual(["Needs attention", "Today", "Later"]);
  });

  it("respects hideSubmitted and hidden", () => {
    const done = item({ id: "d", dueAt: at(2026, 8, 11), status: "submitted" });
    expect(groupItems([done], NOW, DEFAULT_SETTINGS)).toEqual([]);
    expect(groupItems([done], NOW, { ...DEFAULT_SETTINGS, hideSubmitted: false })).toHaveLength(1);
    expect(
      groupItems([item({ dueAt: at(2026, 8, 11), hidden: true })], NOW, DEFAULT_SETTINGS),
    ).toEqual([]);
  });

  it("never hides a booking item, even with hideSubmitted on", () => {
    const booking = item({ kind: "booking", status: "not_submitted" });
    expect(groupItems([booking], NOW, DEFAULT_SETTINGS)).toHaveLength(1);
  });
});

describe("regressions found by the dedupe/sync review", () => {
  it("does not hide a merged row whose other half is still outstanding", () => {
    // A merged Item's status is its MOST done member (§5.3), so testing the
    // Item's status alone removed the row that still needed doing — silently,
    // because hideSubmitted is on by default.
    const mixed = item({
      dueAt: at(2026, 8, 11),
      status: "graded",
      members: [member("graded"), member("not_submitted")],
    });
    expect(groupItems([mixed], NOW, DEFAULT_SETTINGS)).toHaveLength(1);

    const allDone = item({
      dueAt: at(2026, 8, 11),
      status: "graded",
      members: [member("graded"), member("submitted")],
    });
    expect(groupItems([allDone], NOW, DEFAULT_SETTINGS)).toEqual([]);
  });

  it("still surfaces a mixed overdue row, which had no escape hatch at all", () => {
    // The overdue branch tested the same collapsed status, so turning
    // hideSubmitted off did not bring the row back either.
    const overdue = item({
      dueAt: at(2026, 8, 8),
      status: "graded",
      members: [member("graded"), member("not_submitted")],
    });
    expect(sectionFor(overdue, NOW)).toBe("Needs attention");
    expect(groupItems([overdue], NOW, { ...DEFAULT_SETTINGS, hideSubmitted: false })).toHaveLength(
      1,
    );
  });

  it("never hides a booking row, whatever its collapsed status says", () => {
    // `kind` survives a merge but `status` does not. With members present the
    // mixed-status fix already covers this; the exemption is what holds when
    // only the collapsed status is available — an Item read back from an older
    // store, or any future path that builds one without members.
    const merged = item({
      kind: "booking",
      status: "graded",
      members: [member("graded"), member("not_submitted")],
    });
    expect(groupItems([merged], NOW, DEFAULT_SETTINGS)).toHaveLength(1);

    const collapsed = item({ kind: "booking", status: "graded", members: [] });
    expect(groupItems([collapsed], NOW, DEFAULT_SETTINGS)).toHaveLength(1);
  });

  it("sections a row whose only deadline is a reduced-credit window (§4.3)", () => {
    // dueAt undefined, lateDueAt set: twelve days of partial credit still
    // available, previously shown nowhere and labelled "no date".
    const late = item({
      lateDueAt: at(2026, 8, 22),
      members: [member("not_submitted", { creditRemaining: "80" })],
    });
    expect(sectionFor(late, NOW)).toBe("Later");
    expect(formatDue(late, NOW, "Later").detail).toBe("80% credit until Tue 12:00 PM");
  });

  it("labels a late-due row without a credit figure as a still-open late window", () => {
    // Gradescope reaches this shape when a row's only <time> is its late date.
    // Wording changed deliberately from "late due Sat 12:00 PM": while the
    // window is still open the fact the student acts on is how much of it is
    // left, and the date has to carry a month because it is not this week's
    // weekday any more.
    const late = item({ lateDueAt: at(2026, 8, 12), members: [member("not_submitted")] });
    expect(sectionFor(late, NOW)).toBe("This week");
    expect(formatDue(late, NOW, "This week").primary).toBe("Sep 12 · 2d left");
    expect(formatDue(late, NOW, "This week").detail).toBe("late until Sat 12:00 PM");
  });
});

describe("formatDue", () => {
  it("shows a clock time and a relative span", () => {
    // With no section the row says everything, which is what the overdue
    // "Needs attention" case needs.
    expect(formatDue(item({ dueAt: at(2026, 8, 8, 18) }), NOW).primary).toMatch(/·\s+2d ago$/);
    // Under a heading the row drops what the heading already said. Repeating
    // "Thu" under TODAY cost the title eight of eleven rows' worth of width.
    expect(formatDue(item({ dueAt: at(2026, 8, 10, 20) }), NOW, "Today").primary).toBe(
      "8:00 PM · in 2h",
    );
    expect(formatDue(item({ dueAt: at(2026, 8, 11, 18) }), NOW, "Tomorrow").primary).toBe("6:00 PM");
    expect(formatDue(item({ dueAt: at(2026, 8, 12, 18) }), NOW, "This week").primary).toBe(
      "Sat 6:00 PM",
    );
    expect(formatDue(item({ dueAt: at(2026, 8, 24, 18) }), NOW, "Later").primary).toBe("Sep 24");
  });

  it("says so when there is no date", () => {
    expect(formatDue(item({}), NOW).primary).toBe("no date");
    expect(formatDue(item({ dueAt: "nonsense" }), NOW).primary).toBe("no date");
  });
});

describe("a late window that is still open (§4.2, §4.3)", () => {
  // The real Gradescope shape: PHYS 435 Homework 2 was due Wed Sep 9 at 5 PM
  // and Gradescope accepts it until Wed Sep 16 at 5 PM. NOW is Thu Sep 10.
  const gradescopeLate = item({
    dueAt: at(2026, 8, 9, 17),
    lateDueAt: at(2026, 8, 16, 17),
    members: [member("not_submitted")],
  });

  it("counts down to the deadline that is still ahead, not the one that passed", () => {
    const live = liveDeadline(gradescopeLate, NOW);
    expect(live?.late).toBe(true);
    expect(live?.at).toBe(Date.parse(at(2026, 8, 16, 17)));
  });

  it("sections the row by the open window rather than parking it in Needs attention", () => {
    // It used to read "Wed 5:00 PM · 1d ago" in overdue red.
    expect(sectionFor(gradescopeLate, NOW)).toBe("Later");
  });

  it("says the window is open and how long is left", () => {
    const text = formatDue(gradescopeLate, NOW, "Later");
    expect(text.primary).toBe("Sep 16 · 6d left");
    expect(text.detail).toBe("late until Wed 5:00 PM");
  });

  it("keeps the row past the 7-day overdue window while the late window is open", () => {
    // The defect: CS 357 L4a and HW4a vanished from the list seven days after
    // the full-credit deadline while 80% credit ran for another week. Full
    // credit went on Sep 8, 80% runs to Sep 22, and this is Sep 17 — nine days
    // past the old drop point, five days before the money actually runs out.
    const plLadder = item({
      dueAt: at(2026, 8, 8, 11),
      lateDueAt: at(2026, 8, 22, 23),
      members: [member("not_submitted", { creditRemaining: "80" })],
    });
    const nineDaysLater = new Date(2026, 8, 17, 12);
    expect(sectionFor(plLadder, nineDaysLater)).toBe("Later");
    expect(formatDue(plLadder, nineDaysLater, "Later").detail).toContain("80% credit");
  });

  it("falls back to the full-credit instant once both have passed", () => {
    const after = new Date(2026, 8, 20, 12);
    const live = liveDeadline(gradescopeLate, after);
    // The deadline the student actually missed is the one the overdue window is
    // measured from, so a row does not linger a second week on its late date.
    expect(live?.late).toBe(false);
    expect(sectionFor(gradescopeLate, after)).toBeUndefined();
  });

  it("shows the credit figure when PrairieLearn gives one", () => {
    const pl = item({
      dueAt: at(2026, 8, 8, 11),
      lateDueAt: at(2026, 8, 22, 23),
      members: [member("not_submitted", { creditRemaining: "80" })],
    });
    expect(formatDue(pl, NOW, "Later").detail).toContain("80% credit");
  });
});

describe("times this extension invented (§4.5, worker rule 3)", () => {
  // Every CS 424 row: the course schedule prints "HW1 Due" against a bare date
  // and §4.5's runner fills in 23:59.
  const assumed = item({ dueAt: at(2026, 8, 18, 23, 59), timeAssumed: true });

  it("never shows an invented time as a clock", () => {
    const text = formatDue(assumed, NOW, "Later");
    expect(text.primary).not.toContain("11:59");
    // The invented time is not shown, and the row still says so — inline, not
    // on a second line. A course site with five timeless deadlines otherwise
    // repeated one sentence five times for double the height.
    expect(text.primary).toContain("no time");
    expect(text.detail).toBeUndefined();
  });

  it("still shows the date, which the course site did state", () => {
    expect(formatDue(assumed, NOW, "Later").primary).toContain("Sep 18");
  });

  it("counts whole days rather than a false hour precision", () => {
    // Under Later the heading places it, so the row is the date plus the marker.
    // The marker is what a *stated* Later deadline does not have — that row
    // reads "Sep 18" — and dropping it would make the two indistinguishable.
    expect(formatDue(assumed, NOW, "Later").primary).toBe("Sep 18 · no time");
    expect(formatDue(item({ dueAt: at(2026, 8, 18, 23, 59) }), NOW, "Later").primary).toBe(
      "Sep 18",
    );
    expect(
      formatDue(item({ dueAt: at(2026, 8, 10, 23, 59), timeAssumed: true }), NOW, "Today").primary,
    ).toBe("today · no time");
    expect(
      formatDue(item({ dueAt: at(2026, 8, 11, 23, 59), timeAssumed: true }), NOW, "Tomorrow")
        .primary,
    ).toBe("tomorrow · no time");
  });

  it("leaves a stated time alone", () => {
    expect(formatDue(item({ dueAt: at(2026, 8, 18, 17) }), NOW, "This week").primary).toContain(
      "5:00",
    );
  });
});

describe("a row the student ticked off", () => {
  const ticked = (partial: Partial<Item> = {}) =>
    item({
      dueAt: at(2026, 8, 11),
      done: true,
      // A course-site row: `unknown` forever, so no source will ever finish it.
      members: [{ ...member("unknown"), source: "site" }],
      ...partial,
    });

  it("leaves the list", () => {
    expect(groupItems([ticked()], NOW, DEFAULT_SETTINGS)).toEqual([]);
  });

  it("leaves it even with hideSubmitted off, because a tick is not a source report", () => {
    // `hideSubmitted` decides whether to trust what a *source* says. The
    // student's own tick is not a report, so it is not governed by that switch.
    expect(groupItems([ticked()], NOW, { ...DEFAULT_SETTINGS, hideSubmitted: false })).toEqual([]);
  });

  it("comes back when a source says the work is missing", () => {
    const contradicted = ticked({ members: [member("missing")] });
    expect(groupItems([contradicted], NOW, DEFAULT_SETTINGS)).toHaveLength(1);
  });

  it("never removes a booking row, whose window closes regardless", () => {
    expect(
      groupItems([ticked({ kind: "booking" })], NOW, DEFAULT_SETTINGS),
    ).toHaveLength(1);
  });
});

describe("a date the parser could not read (§0 rule 3, §11)", () => {
  // House rule 1 keeps the row and files the raw text; before this the row was
  // then shown nowhere, so a Gradescope format change would silently drop a
  // deadline behind a green dot.
  const unreadable = item({
    dueAt: undefined,
    members: [member("not_submitted", { unparsedDueDate: "2026-09-31 17:00:00 -0500" })],
  });

  it("leads the list rather than vanishing", () => {
    expect(sectionFor(unreadable, NOW)).toBe("Couldn't read");
    expect(groupItems([unreadable], NOW, DEFAULT_SETTINGS).map((s) => s.name)).toEqual([
      "Couldn't read",
    ]);
  });

  it("is not confused with a row that genuinely has no date", () => {
    // Canvas's undated LTI shells and a course page's "TBD" belong nowhere in a
    // list of deadlines; a date that failed to parse is a hidden deadline.
    const undated = item({ dueAt: undefined, members: [member("not_submitted")] });
    expect(sectionFor(undated, NOW)).toBeUndefined();
  });

  it("does not claim a dated row is unreadable because something else failed", () => {
    const dated = item({
      dueAt: at(2026, 8, 11),
      members: [member("not_submitted", { unparsedReleaseDate: "junk" })],
    });
    expect(sectionFor(dated, NOW)).toBe("Tomorrow");
  });

  it("sorts above Needs attention, because it is the least certain thing there", () => {
    const overdue = item({ id: "o", dueAt: at(2026, 8, 8), members: [member("not_submitted")] });
    const sections = groupItems([overdue, unreadable], NOW, DEFAULT_SETTINGS);
    expect(sections.map((s) => s.name)).toEqual(["Couldn't read", "Needs attention"]);
  });
});

describe("the row text fits beside a title (§8.1's one line)", () => {
  // Tier 0a made this column wordier one justified sentence at a time, and the
  // row is one line shared with the title: at its worst a title had five
  // pixels. These cap what `primary` may cost. They are crude on purpose —
  // character count is the thing the layout actually spends.
  const LIMIT = 18;

  it("keeps every primary short enough to sit beside a title", () => {
    const cases: [Item, SectionName][] = [
      [item({ dueAt: at(2026, 8, 10, 23, 59) }), "Today"],
      [item({ dueAt: at(2026, 8, 11, 23, 59) }), "Tomorrow"],
      [item({ dueAt: at(2026, 8, 13, 23, 59) }), "This week"],
      [item({ dueAt: at(2026, 8, 24, 23, 59) }), "Later"],
      [item({ dueAt: at(2026, 8, 8, 17) }), "Needs attention"],
      [item({ dueAt: at(2026, 8, 24, 23, 59), timeAssumed: true }), "Later"],
      [
        item({
          dueAt: at(2026, 8, 9, 17),
          lateDueAt: at(2026, 8, 22, 23),
          members: [member("not_submitted", { creditRemaining: "80" })],
        }),
        "Later",
      ],
    ];
    for (const [row, section] of cases) {
      const { primary } = formatDue(row, NOW, section);
      expect(primary.length, `${section}: ${primary}`).toBeLessThanOrEqual(LIMIT);
    }
  });

  it("puts the long explanation on the second line, not beside the title", () => {
    const late = item({
      dueAt: at(2026, 8, 9, 17),
      lateDueAt: at(2026, 8, 22, 23),
      members: [member("not_submitted", { creditRemaining: "80" })],
    });
    const { primary, detail } = formatDue(late, NOW, "Later");
    expect(primary).toBe("Sep 22 · 13d left");
    expect(detail).toBe("80% credit until Tue 11:00 PM");
  });
});

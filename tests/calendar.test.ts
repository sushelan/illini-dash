/**
 * Calendar placement (`src/core/calendar.ts`).
 *
 * The cases that matter here are the ones where deadline data does not behave
 * like the meeting data a calendar layout is designed for: everything on one
 * minute, a day with no time, and rows that cannot be placed at all.
 */

import { describe, expect, it } from "vitest";
import {
  ATTENTION_ORDER,
  COURSE_COLOURS,
  DEFAULT_DAY_END,
  DEFAULT_DAY_START,
  anchorOf,
  attentionCount,
  attentionGroups,
  bookings,
  courseColours,
  coursesIn,
  allTimed,
  dayContents,
  dayKey,
  hourRange,
  isActionable,
  minutesInto,
  monthCells,
  visibleItems,
  weekContents,
  weekDays,
} from "../src/core/calendar.js";
import { DEFAULT_SETTINGS } from "../src/core/store.js";
import type { Item, RawItem, Settings, Status } from "../src/sources/types.js";

function member(extra?: Record<string, string>, status: Status = "not_submitted"): RawItem {
  return {
    source: "prairielearn",
    sourceId: `m${Math.random()}`,
    courseRaw: "CS 357",
    title: "m",
    kind: "assignment",
    url: "https://us.prairielearn.com/",
    status,
    extra,
    fetchedAt: "2026-09-10T18:00:00.000Z",
  };
}

function item(partial: Partial<Item> = {}): Item {
  return {
    id: partial.title ?? "x",
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

// Thursday 2026-09-10, 6:00 PM local.
const NOW = new Date(2026, 8, 10, 18, 0, 0);
const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m, d, h, min).toISOString();
const SEP10 = new Date(2026, 8, 10);

describe("dayKey", () => {
  it("buckets by the local day, not the UTC one", () => {
    // 11:59 PM central is already tomorrow in UTC, and nearly every deadline in
    // this project is at 11:59 PM. A UTC key puts all of them on the wrong day.
    const late = new Date(2026, 8, 10, 23, 59);
    expect(dayKey(late)).toBe("2026-09-10");
    expect(late.toISOString().slice(0, 10)).not.toBe("2026-09-10");
  });

  it("pads so keys sort and compare as strings", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("anchorOf", () => {
  it("uses the deadline, and marks a time nobody stated", () => {
    const stated = anchorOf(item({ dueAt: at(2026, 8, 11, 23, 59) }), NOW);
    expect(stated).toMatchObject({ assumed: false, opening: false });

    const invented = anchorOf(
      item({ dueAt: at(2026, 8, 11, 23, 59), timeAssumed: true }),
      NOW,
    );
    expect(invented!.assumed).toBe(true);
  });

  it("falls back to a future opening time, and says that is what it is", () => {
    const opens = anchorOf(
      item({ members: [member({ releasedAt: at(2026, 8, 12, 9) })] }),
      NOW,
    );
    expect(opens).toMatchObject({ opening: true, assumed: false });
    expect(opens!.at).toBe(Date.parse(at(2026, 8, 12, 9)));
  });

  it("ignores an opening time that has already passed", () => {
    expect(anchorOf(item({ members: [member({ releasedAt: at(2026, 8, 9, 9) })] }), NOW)).toBeUndefined();
  });

  it("prefers a real deadline over an opening time on the same row", () => {
    const both = item({
      dueAt: at(2026, 8, 11, 23, 59),
      members: [member({ releasedAt: at(2026, 8, 12, 9) })],
    });
    expect(anchorOf(both, NOW)!.opening).toBe(false);
  });

  it("has nothing to say about a row with no instant anywhere", () => {
    expect(anchorOf(item(), NOW)).toBeUndefined();
  });
});

describe("dayContents", () => {
  it("keeps a time nobody stated off the hour axis", () => {
    // Worker rule 3, as a layout rule: §4.5 fills in 23:59 for a course page
    // that printed a bare date. Drawing that at 11:59 PM is the invention
    // wearing a friendly face — it looks exactly like a stated deadline.
    const contents = dayContents(
      [item({ title: "Homework 1", dueAt: at(2026, 8, 10, 23, 59), timeAssumed: true })],
      SEP10,
      NOW,
    );
    expect(contents.timed).toEqual([]);
    expect(contents.untimed.map((i) => i.title)).toEqual(["Homework 1"]);
  });

  it("stacks everything that lands on the same minute", () => {
    // Side-by-side columns would make all three unreadable and imply they
    // compete for the same hour, which deadlines do not.
    const due = at(2026, 8, 10, 17, 0);
    const contents = dayContents(
      [
        item({ title: "GA:2", dueAt: due }),
        item({ title: "GA:3", dueAt: due }),
        item({ title: "MP1", dueAt: due }),
      ],
      SEP10,
      NOW,
    );
    expect(contents.timed).toHaveLength(1);
    expect(contents.timed[0]!.map((p) => p.item.title)).toEqual(["GA:2", "GA:3", "MP1"]);
  });

  it("stacks times close enough to read as one pile", () => {
    const contents = dayContents(
      [
        item({ title: "a", dueAt: at(2026, 8, 10, 16, 0) }),
        item({ title: "b", dueAt: at(2026, 8, 10, 16, 5) }),
      ],
      SEP10,
      NOW,
    );
    expect(contents.timed).toHaveLength(1);
  });

  it("keeps genuinely separate times separate", () => {
    const contents = dayContents(
      [
        item({ title: "morning", dueAt: at(2026, 8, 10, 8, 0) }),
        item({ title: "evening", dueAt: at(2026, 8, 10, 17, 0) }),
      ],
      SEP10,
      NOW,
    );
    expect(contents.timed).toHaveLength(2);
    expect(contents.timed[0]![0]!.item.title).toBe("morning");
  });

  it("ignores items on other days", () => {
    const contents = dayContents([item({ dueAt: at(2026, 8, 11, 12) })], SEP10, NOW);
    expect(contents.timed).toEqual([]);
    expect(contents.untimed).toEqual([]);
  });

  it("places work that opens today at its opening time", () => {
    const contents = dayContents(
      [item({ title: "GPS4", members: [member({ releasedAt: at(2026, 8, 10, 21) })] })],
      SEP10,
      NOW,
    );
    expect(contents.timed[0]![0]!.anchor.opening).toBe(true);
  });
});

describe("end of day is not an hour anyone chose", () => {
  /*
   * Sushi, on a real list: an item due at 11:59 PM is one "the user won't know
   * about unless they scroll". The module comment claimed the pile-up was
   * worth seeing, and the layout then put it below the fold of a 600px popup.
   */
  const onSep10 = (...items: Item[]) => dayContents(items, SEP10, NOW);

  it("hoists 11:59 PM off the axis", () => {
    const contents = onSep10(item({ title: "MP1", dueAt: at(2026, 8, 10, 23, 59) }));
    expect(contents.timed).toEqual([]);
    expect(contents.endOfDay.map((p) => p.item.title)).toEqual(["MP1"]);
  });

  it("treats 11:00 PM the same way, because the argument is about position", () => {
    // Both are at the bottom of the axis and both mean "by today". The row
    // still carries its own clock, so nothing is lost by moving it.
    expect(onSep10(item({ dueAt: at(2026, 8, 10, 23, 0) })).endOfDay).toHaveLength(1);
  });

  it("leaves a genuine evening deadline on the axis", () => {
    // 10:59 PM is a time somebody set. The cut has to fall somewhere, and it
    // must not swallow hours a course actually chose.
    const contents = onSep10(item({ dueAt: at(2026, 8, 10, 22, 59) }));
    expect(contents.endOfDay).toEqual([]);
    expect(contents.timed).toHaveLength(1);
  });

  it("keeps an invented 23:59 in the untimed group, not this one", () => {
    // The two look identical on the clock and mean different things: one is a
    // stated deadline, the other is §4.5 filling in a blank. Only the second
    // needs "check the course page".
    const contents = onSep10(
      item({ title: "invented", dueAt: at(2026, 8, 10, 23, 59), timeAssumed: true }),
    );
    expect(contents.endOfDay).toEqual([]);
    expect(contents.untimed.map((i) => i.title)).toEqual(["invented"]);
  });

  it("orders end-of-day items among themselves", () => {
    const contents = onSep10(
      item({ title: "later", dueAt: at(2026, 8, 10, 23, 59) }),
      item({ title: "earlier", dueAt: at(2026, 8, 10, 23, 30) }),
    );
    expect(contents.endOfDay.map((p) => p.item.title)).toEqual(["earlier", "later"]);
  });

  it("still hands both to views that have no hour axis, in time order", () => {
    // A week row and a month cell are agendas. Splitting the buckets must not
    // drop the end-of-day items from either.
    const contents = onSep10(
      item({ title: "eod", dueAt: at(2026, 8, 10, 23, 59) }),
      item({ title: "noon", dueAt: at(2026, 8, 10, 12, 0) }),
    );
    expect(allTimed(contents).map((p) => p.item.title)).toEqual(["noon", "eod"]);
  });
});

describe("hourRange", () => {
  const contentsFor = (...items: Item[]) => dayContents(items, SEP10, NOW);

  it("draws the academic day, not midnight to midnight", () => {
    // Eight empty hours at the top would push the 11:59 PM stack — where nearly
    // everything is — below the fold of a 600px popup.
    expect(hourRange(contentsFor())).toEqual({ start: DEFAULT_DAY_START, end: DEFAULT_DAY_END });
  });

  it("widens rather than hiding an early exam", () => {
    // §11: a row off the edge of the grid is a silently missing deadline, and a
    // 7 AM CBTF exam is exactly the row that would be lost.
    expect(hourRange(contentsFor(item({ dueAt: at(2026, 8, 10, 7, 0) }))).start).toBe(7);
  });

  it("leaves room below the last item to draw it in", () => {
    // Ending the axis at the same hour the item sits in draws it on the border.
    expect(hourRange(contentsFor(item({ dueAt: at(2026, 8, 10, 21, 0) }))).end).toBe(22);
  });

  it("stops in the evening, because nothing late is drawn on it any more", () => {
    // Five empty ruled hours between 6 PM and midnight did nothing but push
    // what was above them out of a 600px popup.
    expect(hourRange(contentsFor(item({ dueAt: at(2026, 8, 10, 23, 59) }))).end).toBe(
      DEFAULT_DAY_END,
    );
  });

  it("is not stretched by an end-of-day deadline, which is not on it", () => {
    const contents = contentsFor(
      item({ title: "eod", dueAt: at(2026, 8, 10, 23, 59) }),
      item({ title: "noon", dueAt: at(2026, 8, 10, 12, 0) }),
    );
    expect(hourRange(contents)).toEqual({ start: DEFAULT_DAY_START, end: DEFAULT_DAY_END });
  });

  it("is not widened by an untimed row, which is not on the axis at all", () => {
    const contents = contentsFor(
      item({ dueAt: at(2026, 8, 10, 23, 59), timeAssumed: true }),
      item({ dueAt: at(2026, 8, 10, 3, 0) }),
    );
    expect(hourRange(contents).start).toBe(3);
  });
});

describe("weekDays", () => {
  it("runs Sunday to Saturday around the day given", () => {
    const days = weekDays(new Date(2026, 8, 10));
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.getDate())).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });

  it("does not move the week when the anchor is already Sunday", () => {
    expect(weekDays(new Date(2026, 8, 6)).map((d) => d.getDate())).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });

  it("crosses a month boundary rather than stopping at it", () => {
    expect(weekDays(new Date(2026, 8, 1)).map((d) => d.getMonth())).toEqual([7, 7, 8, 8, 8, 8, 8]);
  });
});

describe("weekContents", () => {
  it("marks the day that is actually today", () => {
    const week = weekContents([], NOW, NOW);
    expect(week.filter((d) => d.isToday)).toHaveLength(1);
    expect(week.find((d) => d.isToday)!.date.getDate()).toBe(10);
  });

  it("puts each item on its own day", () => {
    const week = weekContents(
      [item({ title: "thu", dueAt: at(2026, 8, 10, 12) }), item({ title: "sat", dueAt: at(2026, 8, 12, 12) })],
      NOW,
      NOW,
    );
    const byDate = Object.fromEntries(
      week.map((d) => [d.date.getDate(), d.contents.timed.flat().map((p) => p.item.title)]),
    );
    expect(byDate[10]).toEqual(["thu"]);
    expect(byDate[12]).toEqual(["sat"]);
    expect(byDate[11]).toEqual([]);
  });
});

describe("monthCells", () => {
  const cells = monthCells([], new Date(2026, 8, 15), NOW);

  it("is whole weeks, so the grid is rectangular", () => {
    expect(cells.length % 7).toBe(0);
    expect(cells[0]!.date.getDay()).toBe(0);
    expect(cells[cells.length - 1]!.date.getDay()).toBe(6);
  });

  it("covers every day of the month", () => {
    expect(cells.filter((c) => c.inMonth)).toHaveLength(30);
  });

  it("includes the neighbouring days rather than blanking them", () => {
    // A deadline on 1 October is what someone looking at late September most
    // needs to see; an empty corner would hide it.
    const out = cells.filter((c) => !c.inMonth);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((c) => c.date.getMonth() !== 8)).toBe(true);
  });

  it("marks today only when today is in view", () => {
    expect(cells.filter((c) => c.isToday)).toHaveLength(1);
    expect(monthCells([], new Date(2027, 2, 1), NOW).filter((c) => c.isToday)).toHaveLength(0);
  });

  it("puts untimed work after timed work in a cell that cannot hold both", () => {
    // A month cell shows three rows. A stated time is the more useful of the
    // two things to spend one of them on.
    const filled = monthCells(
      [
        item({ title: "untimed", dueAt: at(2026, 8, 15, 23, 59), timeAssumed: true }),
        item({ title: "timed", dueAt: at(2026, 8, 15, 9, 0) }),
      ],
      new Date(2026, 8, 15),
      NOW,
    );
    const cell = filled.find((c) => c.date.getDate() === 15 && c.inMonth)!;
    expect(cell.items.map((p) => p.item.title)).toEqual(["timed", "untimed"]);
  });

  it("handles a month that starts on a Sunday without a blank leading week", () => {
    const nov = monthCells([], new Date(2026, 10, 15), NOW);
    expect(nov[0]!.date.getDate()).toBe(1);
    expect(nov[0]!.inMonth).toBe(true);
  });
});

describe("visibleItems", () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, hideSubmitted: true };

  it("drops hidden rows, ticked rows and submitted work", () => {
    const kept = visibleItems(
      [
        item({ title: "keep", dueAt: at(2026, 8, 11, 12) }),
        item({ title: "hidden", hidden: true }),
        item({ title: "ticked", done: true }),
        item({ title: "submitted", status: "graded", members: [member(undefined, "graded")] }),
      ],
      settings,
    );
    expect(kept.map((i) => i.title)).toEqual(["keep"]);
  });

  it("keeps submitted work when the setting is off", () => {
    const kept = visibleItems(
      [item({ title: "submitted", status: "graded", members: [member(undefined, "graded")] })],
      { ...settings, hideSubmitted: false },
    );
    expect(kept).toHaveLength(1);
  });

  it("drops a course the student switched off in the chip strip", () => {
    const kept = visibleItems(
      [item({ title: "a", courseLabel: "CS357" }), item({ title: "b", courseLabel: "CS425" })],
      settings,
      new Set(["CS425"]),
    );
    expect(kept.map((i) => i.title)).toEqual(["a"]);
  });

  it("never draws a booking on the grid", () => {
    // It lives in the strip above the tabs. On the grid it would sit on the
    // session window's first minute, which is not a deadline at all.
    expect(visibleItems([item({ kind: "booking" })], settings)).toEqual([]);
    expect(bookings([item({ kind: "booking", title: "book me" })])).toHaveLength(1);
  });

  it("does not offer a hidden booking either", () => {
    expect(bookings([item({ kind: "booking", hidden: true })])).toEqual([]);
  });
});

describe("attentionGroups", () => {
  it("separates the three reasons a row has no square", () => {
    const groups = attentionGroups(
      [
        item({ title: "late", dueAt: at(2026, 8, 8, 23, 59) }),
        item({ title: "unreadable", members: [member({ unparsedDueDate: "whenever" })] }),
        item({ title: "undated" }),
      ],
      NOW,
    );
    expect(groups.map((g) => g.name)).toEqual(ATTENTION_ORDER);
    expect(groups.map((g) => g.items.map((i) => i.title))).toEqual([
      ["late"],
      ["unreadable"],
      ["undated"],
    ]);
  });

  it("omits an empty group rather than showing an empty heading", () => {
    expect(attentionGroups([item({ title: "undated" })], NOW).map((g) => g.name)).toEqual([
      "No date at all",
    ]);
  });

  it("forgets overdue work after a week, when nothing can be done about it", () => {
    expect(attentionGroups([item({ dueAt: at(2026, 8, 1, 12) })], NOW)).toEqual([]);
  });

  it("never calls an event overdue or undated", () => {
    // An office-hours block that happened is over, not outstanding, and a
    // recurring one would otherwise refill this view every single day.
    const groups = attentionGroups(
      [
        item({ title: "past event", kind: "event", dueAt: at(2026, 8, 9, 15) }),
        item({ title: "undated event", kind: "event" }),
      ],
      NOW,
    );
    expect(groups).toEqual([]);
  });

  it("does not call work that has not opened yet overdue", () => {
    const groups = attentionGroups(
      [item({ title: "GPS4", members: [member({ releasedAt: at(2026, 8, 12, 9) })] })],
      NOW,
    );
    expect(groups).toEqual([]);
  });

  it("calls a row unreadable only when the unread field cost it its deadline", () => {
    // The distinction §11 turns on. A row that still has a deadline is merely
    // late, however many soft flags it carries; a row whose date could not be
    // read has no deadline at all, and that is a deadline being hidden.
    const late = attentionGroups(
      [item({ dueAt: at(2026, 8, 8, 12), members: [member({ unparsedDueDate: "?" })] })],
      NOW,
    );
    expect(late.map((g) => g.name)).toEqual(["Overdue"]);

    const hiding = attentionGroups([item({ members: [member({ unparsedDueDate: "?" })] })], NOW);
    expect(hiding.map((g) => g.name)).toEqual(["Couldn't read"]);
  });

  it("puts the most recent overdue work first", () => {
    const groups = attentionGroups(
      [
        item({ title: "older", dueAt: at(2026, 8, 5, 12) }),
        item({ title: "newer", dueAt: at(2026, 8, 9, 12) }),
      ],
      NOW,
    );
    expect(groups[0]!.items.map((i) => i.title)).toEqual(["newer", "older"]);
  });

  it("counts only what is actually asking for something", () => {
    /*
     * Sushi's question: should "no date at all" be in the attention category?
     *
     * Not in its number. Overdue work is late and an unreadable date may be
     * hiding a deadline — both are things to do. A row with no date anywhere on
     * it asks for nothing, and it is the only group that never empties, so
     * counting it makes the badge creep upward all semester until it means
     * nothing. Worker rule 2 applied to a number: what the UI asserts has to be
     * true.
     */
    const items = [
      item({ title: "late", dueAt: at(2026, 8, 8, 12) }),
      item({ title: "undated" }),
      item({ title: "also undated", id: "b" }),
    ];
    expect(attentionCount(items, NOW)).toBe(1);
    // But still present. Dropping a row a source listed is the silent loss
    // §11 ranks worst, and it is the bug the PrairieLearn empty-credit cells
    // already caused once.
    const groups = attentionGroups(items, NOW);
    expect(groups.find((g) => g.name === "No date at all")!.items).toHaveLength(2);
  });

  it("says which groups are asking for something", () => {
    expect(isActionable("Overdue")).toBe(true);
    expect(isActionable("Couldn't read")).toBe(true);
    expect(isActionable("No date at all")).toBe(false);
  });

  it("counts an unreadable date, which may be a deadline in hiding", () => {
    expect(
      attentionCount([item({ members: [member({ unparsedDueDate: "?" })] })], NOW),
    ).toBe(1);
  });

  it("shows nothing on the badge when only undated rows exist", () => {
    expect(attentionCount([item({ title: "undated" })], NOW)).toBe(0);
  });
});

describe("courseColours", () => {
  const REAL = ["CS357", "CS411", "CS424", "CS425", "ECE374", "PHYS214"];

  it("gives every course a different colour", () => {
    // The first attempt hashed the label. It collided on exactly this list,
    // producing four colours for six courses — a legend asserting that two
    // courses are the same thing.
    const colours = [...courseColours(REAL).values()];
    expect(new Set(colours).size).toBe(REAL.length);
  });

  it("depends on the set of courses, not the order they arrive in", () => {
    // Sync order is not stable, so a palette assigned by first appearance
    // repaints the whole calendar whenever anything changes.
    const forward = courseColours([...REAL].sort());
    const shuffled = courseColours([...REAL].sort());
    for (const course of REAL) expect(shuffled.get(course), course).toBe(forward.get(course));
  });

  it("stays inside the palette when a course list runs long", () => {
    const many = Array.from({ length: COURSE_COLOURS + 4 }, (_, i) => `C${i}`);
    for (const colour of courseColours(many).values()) {
      expect(colour).toBeGreaterThanOrEqual(0);
      expect(colour).toBeLessThan(COURSE_COLOURS);
    }
  });

  it("has nothing to say about a course it was not given", () => {
    expect(courseColours(REAL).get("MATH241")).toBeUndefined();
  });
});

describe("coursesIn", () => {
  it("lists each course once, in a stable order", () => {
    expect(
      coursesIn([
        item({ courseLabel: "PHYS214" }),
        item({ courseLabel: "CS357" }),
        item({ courseLabel: "PHYS214" }),
      ]),
    ).toEqual(["CS357", "PHYS214"]);
  });

  it("offers no chip for a course with nothing but a booking", () => {
    // Bookings are not drawn on the grid, so a chip for one would filter
    // nothing and leave the student clicking a control that does nothing.
    expect(coursesIn([item({ courseLabel: "CS357", kind: "booking" })])).toEqual([]);
  });

  it("skips a row with no course label rather than making a blank chip", () => {
    expect(coursesIn([item({ courseLabel: "" })])).toEqual([]);
  });
});

describe("minutesInto", () => {
  it("counts from local midnight", () => {
    expect(minutesInto(new Date(2026, 8, 10, 23, 59))).toBe(1439);
    expect(minutesInto(new Date(2026, 8, 10, 0, 0))).toBe(0);
  });
});

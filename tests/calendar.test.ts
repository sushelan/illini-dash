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
  COURSE_GROUPS,
  SLOTS_PER_GROUP,
  courseColour,
  courseColours,
  courseGroup,
  coursesIn,
  agendaRows,
  allTimed,
  dayContents,
  examBoard,
  examCount,
  dayKey,
  hourRange,
  spanMinutes,
  isActionable,
  itemTone,
  minutesInto,
  MONTH_CELL_ROWS,
  monthCells,
  todaySchedule,
  END_OF_DAY_MINUTES,
  MONTH_DOT_CAP,
  monthDots,
  dayList,
  NO_DATE_ORDER,
  noDateCount,
  noDateGroups,
  overdueItems,
  quietDay,
  visibleItems,
  weekContents,
  weekStatus,
  weekDays,
} from "../src/core/calendar.js";
import { countdown } from "../src/core/grouping.js";
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

  it("runs 8 AM to 10 PM \u2014 the hours a box can be dragged onto", () => {
    /*
     * The numbers themselves, because every other test here asserts a
     * *relationship* to the constants and so says nothing about their values
     * (mutation house rule 3: a decision no test can reach).
     *
     * The end moved from 6 PM with drag-to-place. The 6 PM argument was that
     * the last hours were "empty ruled lines whose only effect was to push
     * everything below them out of a 600px popup" \u2014 and the popup does not
     * draw this grid at all any more (it gets `agendaRows`), while a drag is
     * clamped to the hours drawn, so a 6 PM axis makes an evening event
     * untouchable by the gesture the axis now exists for.
     */
    expect([DEFAULT_DAY_START, DEFAULT_DAY_END]).toEqual([8, 22]);
  });

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

  /*
   * The axis is where a deadline is added now, so it has to cover a time that
   * only exists because someone is in the middle of typing or dragging it.
   */
  it("covers an hour the student is dragging to, outside the day's own range", () => {
    expect(hourRange(contentsFor(), [6.5])).toEqual({ start: 6, end: DEFAULT_DAY_END });
    expect(hourRange(contentsFor(), [22.5])).toEqual({ start: DEFAULT_DAY_START, end: 23 });
  });

  it("leaves a whole hour below a typed time, so the ghost is inside the grid", () => {
    // Exactly on the hour: `Math.ceil(22)` is 22, which would end the axis on
    // the line the box is drawn at.
    expect(hourRange(contentsFor(), [22]).end).toBe(23);
  });

  it("ignores an unreadable hour rather than producing a grid of NaN rules", () => {
    expect(hourRange(contentsFor(), [Number.NaN])).toEqual({
      start: DEFAULT_DAY_START,
      end: DEFAULT_DAY_END,
    });
  });

  it("stops at midnight when a sitting runs past it", () => {
    // An hour 25 would be labelled "1 AM" at the bottom of the wrong day.
    const contents = contentsFor(
      item({
        dueAt: at(2026, 8, 10, 22, 0),
        members: [member({ endAt: at(2026, 8, 11, 2, 0) })],
      }),
    );
    expect(hourRange(contents).end).toBe(24);
  });

  it("makes room for how long an exam lasts, not only when it starts", () => {
    // A 9 PM exam with a 110-minute sitting ends at 10:50; an axis stopping at
    // 10 PM would draw the box straight through the bottom of the grid.
    const contents = contentsFor(
      item({ dueAt: at(2026, 8, 10, 21, 0), members: [member({ duration: "110min" })] }),
    );
    expect(hourRange(contents).end).toBe(23);
  });
});

describe("spanMinutes", () => {
  const anchor = (h: number, min = 0) => ({
    at: new Date(2026, 8, 10, h, min).getTime(),
    assumed: false,
    opening: false,
  });

  it("measures a typed end time from the anchor", () => {
    const one = item({ members: [member({ endAt: at(2026, 8, 10, 15, 30) })] });
    expect(spanMinutes(one, anchor(14, 0))).toBe(90);
  });

  it("reads PrairieTest's own duration string", () => {
    expect(spanMinutes(item({ members: [member({ duration: "50min" })] }), anchor(9))).toBe(50);
  });

  it("prefers a stated instant over a string that has to be read", () => {
    const both = item({
      members: [member({ endAt: at(2026, 8, 10, 15, 0), duration: "50min" })],
    });
    expect(spanMinutes(both, anchor(14))).toBe(60);
  });

  it("refuses a duration it cannot read rather than guessing at the number in it", () => {
    // House rule 5: `parseInt` would read both of these, and "1h" as one minute.
    for (const duration of ["50 minutes or until the room closes", "1h", "", "-20min", "min"]) {
      expect(spanMinutes(item({ members: [member({ duration })] }), anchor(9)), duration).toBe(
        undefined,
      );
    }
  });

  it("never returns a negative span, however the members disagree", () => {
    // A box with a negative height is drawn upward over the rows above it.
    const backwards = item({ members: [member({ endAt: at(2026, 8, 10, 8, 0) })] });
    expect(spanMinutes(backwards, anchor(14))).toBe(undefined);
  });

  it("is nothing at all for an ordinary deadline, which is a line and not a box", () => {
    expect(spanMinutes(item({ members: [member()] }), anchor(14))).toBe(undefined);
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

  const mixed = () => [
    item({ title: "keep", dueAt: at(2026, 8, 11, 12) }),
    item({ title: "hidden", hidden: true }),
    item({ title: "ticked", done: true, dueAt: at(2026, 8, 11, 12) }),
    item({
      title: "submitted",
      status: "graded",
      dueAt: at(2026, 8, 11, 12),
      members: [member(undefined, "graded")],
    }),
  ];

  it("with dropFinished, drops hidden rows, ticked rows and submitted work still ahead", () => {
    // What the Attention tab, the badge and §7's reminders still want: a list
    // of what is owed. It was the *default* until 2026-09-18, and the calendar
    // was the caller it was wrong for.
    const kept = visibleItems(mixed(), settings, new Set(), NOW, { dropFinished: true });
    expect(kept.map((i) => i.title)).toEqual(["keep"]);
  });

  it("by default keeps finished work, because a calendar draws it struck through", () => {
    /*
     * Sushi, 2026-09-18: "Show it struck through, including hand-ticked rows."
     * The beta report it answers: "completed assignments from PrairieLearn
     * don't show up in the calendar."
     *
     * Hidden is still hidden — that is the student having asked for the row to
     * go, not a report about whether it is finished.
     */
    const kept = visibleItems(mixed(), settings, new Set(), NOW);
    expect(kept.map((i) => i.title)).toEqual(["keep", "ticked", "submitted"]);
  });

  it("keeps finished work whose deadline has already gone", () => {
    /*
     * Sushi: "why don't the past assignments show up on the calendar". Because
     * `hideSubmitted` filtered the whole list regardless of date — which is
     * right for a list, where forward is the only direction, and wrong the
     * moment there is a back arrow. Last week is a week you know you worked
     * through, and an empty grid for it reads as a broken extension rather
     * than as a finished week.
     */
    const kept = visibleItems(
      [
        item({
          title: "handed in",
          status: "graded",
          dueAt: at(2026, 8, 8, 23, 59),
          members: [member(undefined, "graded")],
        }),
        item({ title: "ticked off", done: true, dueAt: at(2026, 8, 8, 23, 59) }),
      ],
      settings,
      new Set(),
      NOW,
      // Even the caller that asked to drop finished work keeps the past: this
      // is the `!isPast` half of the clause, and nothing else pins it.
      { dropFinished: true },
    );
    expect(kept.map((i) => i.title)).toEqual(["handed in", "ticked off"]);
  });

  it("with dropFinished, still hides finished work that is ahead", () => {
    const kept = visibleItems(
      [
        item({
          title: "done early",
          status: "graded",
          dueAt: at(2026, 8, 20, 23, 59),
          members: [member(undefined, "graded")],
        }),
      ],
      settings,
      new Set(),
      NOW,
      { dropFinished: true },
    );
    expect(kept).toEqual([]);
  });

  it("with dropFinished, hides finished undated work, which has no past to belong to", () => {
    const kept = visibleItems(
      [item({ title: "done", status: "graded", members: [member(undefined, "graded")] })],
      settings,
      new Set(),
      NOW,
      { dropFinished: true },
    );
    expect(kept).toEqual([]);
  });

  it("by default keeps finished undated work, which used to vanish for good", () => {
    // The worst case of the old default: no deadline means `isPast` can never
    // become true, so a finished undated row was dropped on every day there
    // is. It belongs in the untimed band, like any other undated row.
    const kept = visibleItems(
      [item({ title: "done", status: "graded", members: [member(undefined, "graded")] })],
      settings,
      new Set(),
      NOW,
    );
    expect(kept.map((i) => i.title)).toEqual(["done"]);
  });

  it("keeps submitted work when the setting is off", () => {
    const kept = visibleItems(
      [
        item({
          title: "submitted",
          status: "graded",
          dueAt: at(2026, 8, 20, 12),
          members: [member(undefined, "graded")],
        }),
      ],
      { ...settings, hideSubmitted: false },
      new Set(),
      NOW,
    );
    expect(kept).toHaveLength(1);
  });

  it("with dropFinished, hides a ticked row whatever the setting says", () => {
    // The tick is the student's own statement, not a report from a source, so
    // `hideSubmitted` — which is about trusting sources — does not govern it.
    const kept = visibleItems(
      [item({ title: "ticked", done: true, dueAt: at(2026, 8, 20, 12) })],
      { ...settings, hideSubmitted: false },
      new Set(),
      NOW,
      { dropFinished: true },
    );
    expect(kept).toEqual([]);
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

  it("never calls finished work overdue", () => {
    // It reaches this function now only because past work stopped being
    // filtered out of the views. It is in the past and on the grid, and it is
    // not asking for anything.
    const groups = attentionGroups(
      [
        item({
          title: "handed in",
          status: "graded",
          dueAt: at(2026, 8, 8, 12),
          members: [member(undefined, "graded")],
        }),
        item({ title: "ticked off", done: true, dueAt: at(2026, 8, 8, 12) }),
      ],
      NOW,
    );
    expect(groups).toEqual([]);
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

  it("never calls an exam that has been sat overdue", () => {
    /*
     * An exam sat two hours ago was listed under "Overdue (2)" while the Exams
     * tab called the same row "Just sat". Overdue means work whose window has
     * closed and which you still owe; an exam has no submission, so
     * `isItemDone` is never true for one and it fell through to the past
     * branch for a week.
     *
     * The booking beside it is the other half: a window that has closed is not
     * a thing you are late for either.
     */
    const groups = attentionGroups(
      [
        item({ title: "CS 357 Quiz 1", kind: "exam", dueAt: at(2026, 8, 10, 9) }),
        item({ title: "ECE 374 Midterm 1", kind: "exam", dueAt: at(2026, 8, 8, 19) }),
      ],
      NOW,
    );
    expect(groups).toEqual([]);
  });

  it("still calls an exam with no date at all undated", () => {
    // The exemption is about the *past*, not about exams. A row a source
    // listed with no date anywhere is still a row with nowhere to go.
    const groups = attentionGroups([item({ title: "TBD final", kind: "exam" })], NOW);
    expect(groups.map((g) => g.name)).toEqual(["No date at all"]);
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

describe("todaySchedule (Sushi, 2026-09-19)", () => {
  // "Today is a schedule for the day. Late work at the top, then anything due
  // by end of day (no time stated, OR a stated time at/after 11:00 PM — 11:59
  // PM is functionally end of day), then everything timed in clock order with
  // gaps collapsed (an agenda, not an hour rail)."
  //
  // NOW is Thursday 2026-09-10, 6:00 PM.

  it("partitions a realistic day into late, end-of-day and timed", () => {
    const rows = [
      item({ title: "yesterday", dueAt: at(2026, 8, 9, 12) }),
      item({ title: "no time posted", dueAt: at(2026, 8, 10, 23, 59), timeAssumed: true }),
      item({ title: "stated 11:59", dueAt: at(2026, 8, 10, 23, 59) }),
      // Exactly END_OF_DAY_MINUTES (23 * 60), the inclusive edge.
      item({ title: "stated 11:00", dueAt: at(2026, 8, 10, 23, 0) }),
      // 22:59 — one minute under the threshold. A deliberately unrealistic
      // deadline (nobody sets 10:59 PM), chosen because a realistic value on
      // either side of 23:00 cannot tell `>=` from `>` (parser house rule 10).
      item({ title: "stated 10:59", dueAt: at(2026, 8, 10, 22, 59) }),
      item({ title: "nine am", dueAt: at(2026, 8, 10, 9, 0) }),
      item({ title: "eight pm", dueAt: at(2026, 8, 10, 20, 0) }),
      item({ title: "tomorrow", dueAt: at(2026, 8, 11, 12) }),
      item({ title: "hidden", hidden: true, dueAt: at(2026, 8, 10, 20, 0) }),
    ];
    const schedule = todaySchedule(rows, NOW);

    expect(END_OF_DAY_MINUTES).toBe(23 * 60);
    // Most-recently-overdue first, which is `overdueItems`' own order: this
    // morning's 9 AM row is late as surely as yesterday's (Sushi, 2026-09-19).
    expect(schedule.late.map((i) => i.title)).toEqual(["nine am", "yesterday"]);
    expect(schedule.endOfDay.map((i) => i.title)).toEqual([
      "no time posted",
      "stated 11:00",
      "stated 11:59",
    ]);
    // No "nine am": it is in `late`, and a row is never drawn twice.
    expect(schedule.timed.map((p) => p.item.title)).toEqual(["eight pm", "stated 10:59"]);
  });

  it("puts assumed times above stated end-of-day ones", () => {
    // An invented 11:59 PM can be hiding a 5 PM cutoff; a stated one cannot.
    const schedule = todaySchedule(
      [
        item({ title: "stated", dueAt: at(2026, 8, 10, 23, 30) }),
        item({ title: "assumed", dueAt: at(2026, 8, 10, 23, 59), timeAssumed: true }),
      ],
      NOW,
    );
    expect(schedule.endOfDay.map((i) => i.title)).toEqual(["assumed", "stated"]);
  });

  it("sinks finished work to the bottom of end-of-day, and only there", () => {
    const schedule = todaySchedule(
      [
        item({
          title: "assumed done",
          dueAt: at(2026, 8, 10, 23, 59),
          timeAssumed: true,
          done: true,
        }),
        item({ title: "stated open", dueAt: at(2026, 8, 10, 23, 30) }),
      ],
      NOW,
    );
    // Done sinks below a *stated* row it would otherwise outrank.
    expect(schedule.endOfDay.map((i) => i.title)).toEqual(["stated open", "assumed done"]);
  });

  it("keeps finished work in chronological position in the timed band", () => {
    // A schedule is a record of the day: a handed-in 9 AM quiz shown under
    // 8 PM would be a claim that it happened at 8. It is finished, so it is not
    // `late` either — only unfinished rows are subtracted from this band.
    const schedule = todaySchedule(
      [
        item({ title: "seven pm", dueAt: at(2026, 8, 10, 19) }),
        item({ title: "nine done", done: true, dueAt: at(2026, 8, 10, 9) }),
        item({ title: "eight pm", dueAt: at(2026, 8, 10, 20) }),
      ],
      NOW,
    );
    expect(schedule.late).toEqual([]);
    expect(schedule.timed.map((p) => p.item.title)).toEqual([
      "nine done",
      "seven pm",
      "eight pm",
    ]);
  });

  it("shows a late row in late and nowhere else", () => {
    const rows = [item({ title: "yesterday", dueAt: at(2026, 8, 9, 12) })];
    const schedule = todaySchedule(rows, NOW);
    expect(schedule.late.map((i) => i.title)).toEqual(["yesterday"]);
    expect(schedule.endOfDay).toEqual([]);
    expect(schedule.timed).toEqual([]);
  });

  it("puts this morning's unfinished row in Late, not in the timed band", () => {
    // Sushi, 2026-09-19: "is anything late" is the second thing this screen is
    // read for, and a row that went by at 9 AM this morning is the commonest
    // answer to it. It leaves the schedule entirely rather than being drawn in
    // both places.
    const schedule = todaySchedule([item({ title: "nine am", dueAt: at(2026, 8, 10, 9) })], NOW);
    expect(schedule.late.map((i) => i.title)).toEqual(["nine am"]);
    expect(schedule.timed).toEqual([]);
    expect(schedule.endOfDay).toEqual([]);
  });

  it("takes a late end-of-day row out of the end-of-day band too", () => {
    // The only hour at which a row can be both: after 11 PM, today's own
    // end-of-day band is in the past, so a stated 11:00 PM is `overdueItems`'
    // as well as `dayContents`'. Before that the subtraction is unreachable on
    // this band, which is why the clock here is 11:30 PM rather than NOW.
    const lateEvening = new Date(2026, 8, 10, 23, 30);
    const schedule = todaySchedule(
      [item({ title: "stated 11:00", dueAt: at(2026, 8, 10, 23, 0) })],
      lateEvening,
    );
    expect(schedule.late.map((i) => i.title)).toEqual(["stated 11:00"]);
    expect(schedule.endOfDay).toEqual([]);
  });

  it("returns three empty bands for an empty day", () => {
    expect(todaySchedule([], NOW)).toEqual({ late: [], endOfDay: [], timed: [] });
  });
});

describe("monthDots (brief D6)", () => {
  const SEP = new Date(2026, 8, 15);

  it("is the same grid as monthCells, with the neighbouring days named", () => {
    const dots = monthDots([], SEP, NOW);
    const cells = monthCells([], SEP, NOW);
    expect(dots.map((d) => d.date.getTime())).toEqual(cells.map((c) => c.date.getTime()));
    expect(dots.map((d) => d.outside)).toEqual(cells.map((c) => !c.inMonth));
    expect(dots.filter((d) => d.outside).length).toBeGreaterThan(0);
    expect(dots.filter((d) => d.isToday)).toHaveLength(1);
  });

  it("carries a dot per deadline, in the course's own hue", () => {
    const dots = monthDots(
      [
        item({ title: "a", courseLabel: "CS357", dueAt: at(2026, 8, 15, 9) }),
        item({ title: "b", courseLabel: "ECE374", dueAt: at(2026, 8, 15, 23, 59) }),
      ],
      SEP,
      NOW,
    );
    const cell = dots.find((d) => d.date.getDate() === 15 && !d.outside)!;
    expect(cell.dots.map((one) => one.courseLabel)).toEqual(["CS357", "ECE374"]);
    expect(cell.more).toBe(0);
  });

  it("dims a finished deadline rather than dropping it", () => {
    // The beta report this came from: "completed assignments from PrairieLearn
    // don't show up in the calendar". A square with nothing in it asserts that
    // nothing was due.
    const cell = monthDots(
      [item({ title: "handed in", done: true, dueAt: at(2026, 8, 15, 9) })],
      SEP,
      NOW,
    ).find((d) => d.date.getDate() === 15 && !d.outside)!;
    expect(cell.dots).toEqual([{ courseLabel: "CS357", done: true, tone: "done" }]);
  });

  it("caps at four dots and counts the rest", () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      item({ title: `t${i}`, dueAt: at(2026, 8, 15, 9 + i) }),
    );
    const cell = monthDots(many, SEP, NOW).find((d) => d.date.getDate() === 15 && !d.outside)!;
    expect(MONTH_DOT_CAP).toBe(4);
    expect(cell.dots).toHaveLength(4);
    expect(cell.more).toBe(3);
  });

  it("sinks finished work so the cap never hides the one thing still owed", () => {
    // `sinkDone`'s whole reason: three struck-through pills can push the only
    // open deadline out of a capped cell, and "which days are still heavy" is
    // the one question a month answers.
    const cell = monthDots(
      [
        item({ title: "d1", done: true, dueAt: at(2026, 8, 15, 8) }),
        item({ title: "d2", done: true, dueAt: at(2026, 8, 15, 9) }),
        item({ title: "d3", done: true, dueAt: at(2026, 8, 15, 10) }),
        item({ title: "d4", done: true, dueAt: at(2026, 8, 15, 11) }),
        item({ title: "open", courseLabel: "ECE374", dueAt: at(2026, 8, 15, 23) }),
      ],
      SEP,
      NOW,
    ).find((d) => d.date.getDate() === 15 && !d.outside)!;
    expect(cell.dots[0]).toEqual({ courseLabel: "ECE374", done: false, tone: "open" });
  });

  it("never draws a hidden row", () => {
    const cell = monthDots(
      [item({ title: "hidden", hidden: true, dueAt: at(2026, 8, 15, 9) })],
      SEP,
      NOW,
    ).find((d) => d.date.getDate() === 15 && !d.outside)!;
    expect(cell.dots).toEqual([]);
  });
});

describe("dayList (brief D6, mock 2a)", () => {
  const DAY = new Date(2026, 8, 22);

  it("is everything on the day, soonest first", () => {
    // Mock 2a's tapped day: "Tue, Sep 22 · 3 due", 11:00 PM before 11:59 PM.
    const rows = dayList(
      [
        item({ title: "MP1 Report", dueAt: at(2026, 8, 22, 23, 59) }),
        item({ title: "HW5", dueAt: at(2026, 8, 22, 23, 0) }),
        item({ title: "L5", dueAt: at(2026, 8, 22, 9, 0) }),
        item({ title: "elsewhere", dueAt: at(2026, 8, 23, 9, 0) }),
      ],
      DAY,
      NOW,
    );
    expect(rows.map((r) => r.item.title)).toEqual(["L5", "HW5", "MP1 Report"]);
  });

  it("keeps a row whose time nobody stated, and says so", () => {
    // Worker house rule 3: §4.5's 23:59 is this code's invention, and the
    // caller must not print it as a clock.
    const rows = dayList(
      [
        item({ title: "assumed", dueAt: at(2026, 8, 22, 23, 59), timeAssumed: true }),
        item({ title: "stated", dueAt: at(2026, 8, 22, 21, 0) }),
      ],
      DAY,
      NOW,
    );
    expect(rows.map((r) => r.item.title)).toEqual(["stated", "assumed"]);
    expect(rows.map((r) => r.anchor.assumed)).toEqual([false, true]);
  });

  it("puts a stated instant before an assumed one at the same minute, whatever the titles", () => {
    // The timed/untimed seam, not a tie within a group: `dayContents` sorts
    // stated rows by title and assumed rows by title, and the two groups are
    // concatenated stated-first. A second title tie-break across the seam
    // would interleave them (R3 M6 — the case the deleted tie-break's
    // survival was really about). Titles chosen so alphabetical order gives
    // the wrong answer (mutation house rule 10).
    const rows = dayList(
      [
        item({ title: "Alpha (assumed)", dueAt: at(2026, 8, 22, 23, 59), timeAssumed: true }),
        item({ title: "Zebra (stated)", dueAt: at(2026, 8, 22, 23, 59) }),
      ],
      DAY,
      NOW,
    );
    expect(rows.map((r) => r.item.title)).toEqual(["Zebra (stated)", "Alpha (assumed)"]);
  });

  it("uses dayContents' visibility rules, so a hidden row stays hidden", () => {
    expect(
      dayList([item({ title: "hidden", hidden: true, dueAt: at(2026, 8, 22, 9) })], DAY, NOW),
    ).toEqual([]);
  });

  it("draws finished work rather than emptying the day", () => {
    expect(
      dayList([item({ title: "done", done: true, dueAt: at(2026, 8, 22, 9) })], DAY, NOW).map(
        (r) => r.item.title,
      ),
    ).toEqual(["done"]);
  });

  it("orders two things on the same minute by title rather than at random", () => {
    // Inherited from `dayContents`, which breaks its own ties by title, and
    // kept by `Array#sort` being stable. Asserted here because it is part of
    // this function's contract wherever it comes from — a month cell that
    // reshuffles on every redraw is a month cell nobody trusts.
    expect(
      dayList(
        [
          item({ title: "b", dueAt: at(2026, 8, 22, 23, 59) }),
          item({ title: "a", dueAt: at(2026, 8, 22, 23, 59) }),
        ],
        DAY,
        NOW,
      ).map((r) => r.item.title),
    ).toEqual(["a", "b"]);
  });

  it("really sorts, rather than relying on dayContents' grouping order", () => {
    /*
     * A deliberately unrealistic row (house rule 10): §4.5's runner fills in
     * **23:59** for a bare date, so every real `timeAssumed` row sorts last
     * anyway and a concatenation of timed-then-untimed is indistinguishable
     * from a sort. An assumed 9 AM is the input that tells them apart.
     */
    expect(
      dayList(
        [
          item({ title: "stated 9 PM", dueAt: at(2026, 8, 22, 21, 0) }),
          item({ title: "assumed 9 AM", dueAt: at(2026, 8, 22, 9, 0), timeAssumed: true }),
        ],
        DAY,
        NOW,
      ).map((r) => r.item.title),
    ).toEqual(["assumed 9 AM", "stated 9 PM"]);
  });

  it("puts a row whose own dueAt will not parse last, rather than at random", () => {
    /*
     * Reachable, and not hypothetical: `liveDeadline` falls back to `lateDueAt`
     * when `dueAt` is unreadable, so such a row is placed on the day by its
     * late window — and then this function re-reads `dueAt` for the untimed
     * half and gets NaN. Every comparison against NaN is false, so without the
     * guard the order is whatever V8 happens to do with an inconsistent
     * comparator. (`monthCells` builds its untimed anchors the same way.)
     */
    const rows = dayList(
      [
        // Both untimed, and named so `dayContents`' own title sort puts the
        // broken one *first* — otherwise the concatenation already answers
        // correctly and the guard is never reached (mutation house rule 4).
        item({
          title: "aaa broken",
          dueAt: "not a date",
          lateDueAt: at(2026, 8, 22, 10, 0),
          timeAssumed: true,
        }),
        item({ title: "bbb real", dueAt: at(2026, 8, 22, 21, 0), timeAssumed: true }),
      ],
      DAY,
      NOW,
    );
    expect(rows.map((r) => r.item.title)).toEqual(["bbb real", "aaa broken"]);
  });
});

describe("noDateGroups", () => {
  const MIXED = () => [
    item({ title: "late", dueAt: at(2026, 8, 8, 23, 59) }),
    item({ title: "unreadable", members: [member({ unparsedDueDate: "whenever" })] }),
    item({ title: "undated" }),
  ];

  it("holds the two groups the No date tab draws, undated first", () => {
    // Brief D3: "Holds the current Attention groups 'No date at all' and
    // 'Couldn't read' (the latter carries the amber check chip)". Mock 2c puts
    // the three undated rows above the one unreadable one.
    const groups = noDateGroups(MIXED(), NOW);
    expect(groups.map((g) => g.name)).toEqual(["No date at all", "Couldn't read"]);
    expect(groups.map((g) => g.items.map((i) => i.title))).toEqual([
      ["undated"],
      ["unreadable"],
    ]);
  });

  it("is the reverse of ATTENTION_ORDER, which leads with the unreadable ones", () => {
    // Pinned because the two orders are easy to unify by accident, and the
    // reason they differ is that ATTENTION_ORDER's other group was overdue work.
    expect(NO_DATE_ORDER).toEqual(["No date at all", "Couldn't read"]);
    expect(ATTENTION_ORDER.filter((name) => name !== "Overdue")).toEqual([
      "Couldn't read",
      "No date at all",
    ]);
  });

  it("never carries overdue work into the tab that offers 'Give it a date'", () => {
    expect(
      noDateGroups(MIXED(), NOW).flatMap((g) => g.items.map((i) => i.title)),
    ).not.toContain("late");
  });

  it("omits an empty group rather than drawing an empty heading", () => {
    expect(noDateGroups([item({ title: "undated" })], NOW).map((g) => g.name)).toEqual([
      "No date at all",
    ]);
    expect(noDateGroups([item({ title: "late", dueAt: at(2026, 8, 8, 12) })], NOW)).toEqual([]);
  });
});

describe("noDateCount", () => {
  it("counts both groups, unlike the Attention badge", () => {
    // Mock 2c wears `4` over three undated rows and one unreadable one. The
    // reason `attentionCount` leaves undated rows out — a number creeping up
    // all semester beside *late work* — does not apply to a tab whose whole
    // contents are those rows.
    const items = [
      item({ title: "survey" }),
      item({ title: "group" }),
      item({ title: "syllabus" }),
      item({ title: "HW2 Due", members: [member({ unparsedDueDate: "?" })] }),
    ];
    expect(noDateCount(items, NOW)).toBe(4);
    expect(attentionCount(items, NOW)).toBe(1);
  });

  it("does not count late work", () => {
    expect(noDateCount([item({ dueAt: at(2026, 8, 8, 23, 59) })], NOW)).toBe(0);
  });
});

describe("overdueItems", () => {
  it("is exactly the Overdue group, for the pill and the Needs-you screen", () => {
    const items = [
      item({ title: "late", dueAt: at(2026, 8, 8, 23, 59) }),
      item({ title: "undated" }),
      item({ title: "unreadable", members: [member({ unparsedDueDate: "?" })] }),
    ];
    expect(overdueItems(items, NOW).map((i) => i.title)).toEqual(["late"]);
  });

  it("inherits every exclusion the Overdue group makes", () => {
    // One count, one rule. A pill reading "2 late" over one row is the same
    // class of lie as a green dot over a source that was never fetched.
    expect(
      overdueItems(
        [
          item({ title: "sat exam", kind: "exam", dueAt: at(2026, 8, 9, 19) }),
          item({ title: "past event", kind: "event", dueAt: at(2026, 8, 9, 15) }),
          item({ title: "ticked", done: true, dueAt: at(2026, 8, 8, 12) }),
          item({ title: "ancient", dueAt: at(2026, 8, 1, 12) }),
        ],
        NOW,
      ),
    ).toEqual([]);
  });

  it("is empty rather than undefined when nothing is late", () => {
    expect(overdueItems([], NOW)).toEqual([]);
  });
});

describe("courseColours", () => {
  // Sushi's enrolment, and the set the screenshot he rejected was showing.
  const REAL = ["CS357", "CS411", "CS424", "CS425", "ECE374", "PHYS214", "PHYS435"];

  // Sushi, 2026-09-19, on the build before this one: "colors arent that much
  // different, they should be extremely different man cmon." This is the
  // sentence the whole scheme answers, and it is about *this* list.
  it("gives every one of the real courses a different colour", () => {
    const colours = [...courseColours(REAL).values()];
    expect(new Set(colours).size).toBe(REAL.length);
  });

  // The complaint in its smallest form: four CS courses used to be four shades
  // of one blue, and two of them read as the same colour.
  it("gives four courses in one department four different colours", () => {
    const colours = courseColours(REAL);
    const cs = ["CS357", "CS411", "CS424", "CS425"].map((c) => colours.get(c));
    expect(new Set(cs).size).toBe(4);
  });

  // The pair Sushi named in the first report: "CS 374 and CS 340 draw
  // identically".
  it("separates two CS courses whose numbers are close", () => {
    expect(courseColour("CS374")).not.toBe(courseColour("CS340"));
  });

  // Not luck: his three departments land in three different groups, and two
  // departments in different groups draw from disjoint slot sets, so *no*
  // CS course can ever take a PHYS or ECE course's colour.
  it("puts his three departments in three disjoint groups", () => {
    const groups = ["CS357", "ECE374", "PHYS214"].map(courseGroup);
    expect(new Set(groups).size).toBe(3);
    for (const a of ["CS357", "CS411", "CS424", "CS425"]) {
      for (const b of ["ECE374", "PHYS214", "PHYS435"]) {
        expect(courseColour(a) % COURSE_GROUPS, `${a} vs ${b}`).not.toBe(
          courseColour(b) % COURSE_GROUPS,
        );
      }
    }
  });

  it("keeps a group's slots inside the palette and disjoint from every other", () => {
    const seen = new Map<number, number>();
    for (let group = 0; group < COURSE_GROUPS; group++) {
      for (let within = 0; within < SLOTS_PER_GROUP; within++) {
        const slot = group + within * COURSE_GROUPS;
        expect(slot).toBeLessThan(COURSE_COLOURS);
        expect(seen.has(slot), `slot ${slot} is in two groups`).toBe(false);
        seen.set(slot, group);
      }
    }
    expect(seen.size).toBe(COURSE_COLOURS);
  });

  it("gives a course the same slot whatever else is on the list", () => {
    // The defect this replaces: index order meant enrolling in one more course
    // repainted every course after it. Nothing may repaint when a course is
    // *added* or when one is *removed*.
    const before = courseColours(["ECE374", "PHYS214"]);
    const after = courseColours(["CS357", "ECE374", "MATH257", "PHYS214", "STAT425"]);
    const fewer = courseColours(["ECE374"]);
    expect(after.get("ECE374")).toBe(before.get("ECE374"));
    expect(after.get("PHYS214")).toBe(before.get("PHYS214"));
    expect(fewer.get("ECE374")).toBe(before.get("ECE374"));
  });

  it("reads the department out of a Gradescope-shaped name", () => {
    expect(courseColours(["stat_425_120248_268442"]).get("stat_425_120248_268442")).toBe(
      courseColours(["STAT425"]).get("STAT425"),
    );
  });

  // §5.1's reading of a course code, not "the first three digits": a Canvas
  // label that leads with the term would otherwise be coloured by the year.
  // CS411 and not CS357: 2026 offers `202` to a "first three digits" reading,
  // and 202 and 357 agree modulo five, so CS357 could not tell the two
  // readings apart (mutation house rule 4).
  it("colours a label by its course code and not by a year in front of it", () => {
    expect(courseColour("Fall 2026 CS 411")).toBe(courseColour("CS411"));
  });

  it("gives a name with no course code in it a stable slot rather than throwing", () => {
    const name = "Kaufman office hours";
    const colour = courseColours([name]).get(name);
    expect(colour).toBe(courseColours(["CS357", name]).get(name));
    expect(colour).toBeGreaterThanOrEqual(0);
    expect(colour).toBeLessThan(COURSE_COLOURS);
  });

  // `bus_ilbc_open_249233` is §5.1's no-match path: the admin course whose id
  // digits must not be read as a course number. Two such labels must still be
  // able to differ — the label's own hash is what places them.
  it("separates two labels that have no course code at all", () => {
    expect(courseColour("bus_ilbc_open_249233")).not.toBe(courseColour("Kaufman office hours"));
  });

  it("stays inside the palette whatever it is given", () => {
    const many = [
      ...Array.from({ length: COURSE_COLOURS + 4 }, (_, i) => `DEPT${i}101`),
      "ECE374",
      "STAT425",
      "ME370",
      "PHIL103",
      "AE202",
      "SOC100",
      "Kaufman office hours",
      "bus_ilbc_open_249233",
      "",
    ];
    for (const course of many) {
      const colour = courseColour(course);
      expect(colour, course).toBeGreaterThanOrEqual(0);
      expect(colour, course).toBeLessThan(COURSE_COLOURS);
      expect(Number.isInteger(colour), course).toBe(true);
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

describe("examBoard — the things you have to turn up to", () => {
  /*
   * `exam` and `booking`, plus a Canvas quiz or exam by title (`canvasExam`).
   * §4.4 maps a PrairieTest reservation to `exam` and an unbooked window to
   * `booking`, and §4.1 promotes a Canvas event whose title says exam, midterm
   * or final. Every other source's quiz is work done from a laptop whenever,
   * and including it would refill this tab with most of PrairieLearn.
   */
  const booking = (windowEnd: string, title = "Book a slot") =>
    item({ title, kind: "booking", members: [member({ windowEnd })] });
  const exam = (dueAt: string, title = "Midterm 1") => item({ title, kind: "exam", dueAt });

  it("keeps homework out of it", () => {
    const board = examBoard(
      [
        item({ title: "HW5", dueAt: at(2026, 8, 14, 23, 59) }),
        item({ title: "PQ1 Practice Quiz", kind: "quiz", dueAt: at(2026, 8, 14, 23, 59) }),
        exam(at(2026, 8, 20, 19)),
      ],
      NOW,
    );
    expect(board.upcoming.map((p) => p.item.title)).toEqual(["Midterm 1"]);
  });

  describe("a Canvas quiz or exam", () => {
    // Sushi, 2026-09-23: "quizzes/exams on canvas should also show up in the
    // exam section, but they shouldnt be practice quizzes."
    const canvas = (title: string, kind: RawItem["kind"] = "quiz") =>
      item({
        title,
        kind,
        dueAt: at(2026, 8, 20, 23, 59),
        members: [{ ...member(), source: "canvas", title, kind }],
      });
    const board = (...items: Item[]) =>
      examBoard(items, NOW).upcoming.map((p) => p.item.title);

    it("is on the board when the title says quiz", () => {
      expect(board(canvas("Quiz 3: Monte Carlo"))).toEqual(["Quiz 3: Monte Carlo"]);
    });

    it("is on the board as a New Quiz, which the planner calls an assignment", () => {
      expect(board(canvas("Midterm 1", "assignment"))).toEqual(["Midterm 1"]);
    });

    it("stays off when the title says practice", () => {
      expect(board(canvas("Practice Quiz 3"), canvas("Midterm Practice", "assignment"))).toEqual(
        [],
      );
    });

    it("stays off when Canvas's quiz is really homework", () => {
      // The one real `quiz` row in fixtures/canvas/planner-items.json: CS 424
      // posts its homework as a Canvas quiz. The type alone would put it here.
      expect(board(canvas("Homework 1"))).toEqual([]);
    });

    it("is Canvas only — a PrairieLearn quiz stays off", () => {
      const pl = item({
        title: "Quiz 2",
        kind: "quiz",
        dueAt: at(2026, 8, 20, 23, 59),
        members: [{ ...member(), title: "Quiz 2", kind: "quiz" }],
      });
      expect(board(pl)).toEqual([]);
    });

    it("matches the word, not a substring", () => {
      // "Examples" contains "exam"; "Quizlet" contains "quiz".
      expect(board(canvas("Examples worksheet", "assignment"), canvas("Quizlet deck"))).toEqual(
        [],
      );
    });
  });

  it("has no horizon, because a final is further out than sixty days", () => {
    // Every other view stops at 60 days. In September that hides a December
    // final, which is the deadline a student most wants warning about.
    const board = examBoard([exam(at(2026, 11, 15, 8), "Final")], NOW);
    expect(board.upcoming.map((p) => p.item.title)).toEqual(["Final"]);
  });

  it("puts the soonest exam first", () => {
    const board = examBoard(
      [exam(at(2026, 11, 15, 8), "Final"), exam(at(2026, 8, 20, 19), "Midterm")],
      NOW,
    );
    expect(board.upcoming.map((p) => p.item.title)).toEqual(["Midterm", "Final"]);
  });

  it("separates a window nobody has booked", () => {
    const board = examBoard([booking(at(2026, 8, 22, 17))], NOW);
    expect(board.unbooked).toHaveLength(1);
    expect(board.upcoming).toEqual([]);
  });

  it("drops a booking window that has already closed", () => {
    // Not a thing to book any more, and not worth shouting about: the exam
    // either happened or was missed, and the source stops producing the row.
    expect(examBoard([booking(at(2026, 8, 9, 17))], NOW).unbooked).toEqual([]);
  });

  it("keeps a booking whose window has no end stated", () => {
    // House rule 1 at the view layer: an unreadable window costs the window,
    // not the row. Dropping it would hide the one item §7 nags daily about.
    expect(examBoard([item({ kind: "booking" })], NOW).unbooked).toHaveLength(1);
  });

  it("books the window closing soonest first", () => {
    const board = examBoard(
      [booking(at(2026, 8, 25, 17), "late"), booking(at(2026, 8, 20, 17), "early")],
      NOW,
    );
    expect(board.unbooked.map((i) => i.title)).toEqual(["early", "late"]);
  });

  it("keeps an exam sat in the last week, most recent first", () => {
    const board = examBoard(
      [exam(at(2026, 8, 9, 19), "Quiz 1"), exam(at(2026, 8, 6, 19), "Quiz 0")],
      NOW,
    );
    expect(board.recent.map((p) => p.item.title)).toEqual(["Quiz 1", "Quiz 0"]);
    expect(board.upcoming).toEqual([]);
  });

  it("forgets one sat longer ago than that", () => {
    expect(examBoard([exam(at(2026, 8, 1, 19))], NOW).recent).toEqual([]);
  });

  it("respects a hidden row", () => {
    const hidden = item({ kind: "exam", dueAt: at(2026, 8, 20, 19), hidden: true });
    expect(examBoard([hidden], NOW).upcoming).toEqual([]);
  });

  it("counts only what is asking for something", () => {
    // An exam already booked is a fact, not a task. A badge counting every
    // exam in the term is a permanent alarm — the same reason undated rows
    // left the Attention count.
    const items = [exam(at(2026, 8, 20, 19)), booking(at(2026, 8, 22, 17))];
    expect(examCount(items, NOW)).toBe(1);
  });

  it("shows nothing on the badge when every exam is booked", () => {
    expect(examCount([exam(at(2026, 8, 20, 19))], NOW)).toBe(0);
  });
});

describe("agendaRows (the popup's day)", () => {
  /*
   * The hour axis is the right shape for meetings and the wrong one for
   * deadlines. On a real day a 9 AM checkpoint and a 9 PM exam produce eleven
   * empty ruled hours between them — about 290px, in a 600px window that has
   * already spent 215 on chrome — so the exam is below the fold. This is the
   * sequence that replaces it in the popup; the grid stays in the full view.
   */
  const untimed = item({ title: "bare date", dueAt: at(2026, 8, 10, 23, 59), timeAssumed: true });
  const morning = item({ title: "checkpoint", dueAt: at(2026, 8, 10, 9, 0) });
  const evening = item({ title: "exam", dueAt: at(2026, 8, 10, 21, 0) });
  const eod = item({ title: "homework", dueAt: at(2026, 8, 10, 23, 59) });

  const shape = (rows: ReturnType<typeof agendaRows>) =>
    rows.map((row) =>
      row.kind === "item"
        ? row.placed.item.title
        : row.kind === "untimed"
          ? row.item.title
          : row.kind === "heading"
            ? `# ${row.text}`
            : "— now —",
    );

  it("puts the riskiest group first and the invented times out of the clock order", () => {
    // An invented 11:59 PM can be hiding a 5 PM cutoff; a stated one cannot.
    // Ordering the day by clock would file it last, next to a real 11:59 PM
    // deadline, with nothing to say which of the two is a guess.
    const rows = agendaRows(dayContents([untimed, morning, eod], SEP10, NOW), NOW, true);
    expect(shape(rows)).toEqual([
      "# Time not posted",
      "bare date",
      "checkpoint",
      "— now —",
      "# By end of day",
      "homework",
    ]);
  });

  it("spends nothing on an empty hour", () => {
    // The whole point. Twelve hours between these two, and two rows.
    const rows = agendaRows(dayContents([morning, evening], SEP10, NOW), NOW, true);
    expect(rows.filter((r) => r.kind === "item")).toHaveLength(2);
    expect(rows).toHaveLength(3); // the two items and the now marker between them
  });

  it("puts the now marker between what has passed and what has not", () => {
    const rows = agendaRows(dayContents([morning, evening], SEP10, NOW), NOW, true);
    expect(shape(rows)).toEqual(["checkpoint", "— now —", "exam"]);
  });

  it("draws no marker when it would separate nothing", () => {
    /*
     * A rule at the very top says what the empty space above the first row
     * already says, and a rule at the bottom says what the absence of anything
     * below it already says. Both cost a row and carry nothing.
     */
    const allAhead = agendaRows(dayContents([evening], SEP10, NOW), NOW, true);
    expect(shape(allAhead)).toEqual(["exam"]);
    const allPast = agendaRows(dayContents([morning], SEP10, NOW), NOW, true);
    expect(shape(allPast)).toEqual(["checkpoint"]);
  });

  it("draws no marker at all on a day that is not today", () => {
    // ‹ › moves the anchor. "Now" on next Tuesday is a line across a day the
    // clock has nothing to say about.
    const rows = agendaRows(dayContents([morning, evening], SEP10, NOW), NOW, false);
    expect(shape(rows)).toEqual(["checkpoint", "exam"]);
  });

  it("puts the marker above the end-of-day label, not between it and its rows", () => {
    const rows = agendaRows(dayContents([morning, eod], SEP10, NOW), NOW, true);
    expect(shape(rows)).toEqual(["checkpoint", "— now —", "# By end of day", "homework"]);
  });

  it("can put the marker inside the end-of-day pile, which is where it lands late", () => {
    // 11:45 PM, with one deadline gone at 11:30 and one still open at 11:59.
    const late = new Date(2026, 8, 10, 23, 45);
    const gone = item({ title: "closed", dueAt: at(2026, 8, 10, 23, 30) });
    const rows = agendaRows(dayContents([gone, eod], SEP10, late), late, true);
    expect(shape(rows)).toEqual(["# By end of day", "closed", "— now —", "homework"]);
  });

  it("draws exactly one marker", () => {
    // The boundary between the timed group and the end-of-day group is two
    // separate places the marker could be emitted from.
    const rows = agendaRows(dayContents([morning, evening, eod], SEP10, NOW), NOW, true);
    expect(rows.filter((r) => r.kind === "now")).toHaveLength(1);
  });

  it("says nothing about a day with nothing on it", () => {
    expect(agendaRows(dayContents([], SEP10, NOW), NOW, true)).toEqual([]);
  });
});

describe("weekDays, rolling", () => {
  it("starts the popup's week on today", () => {
    /*
     * Sushi's decision, and the reason: on a Friday, Sunday–Saturday puts five
     * days that have already happened above the only row anyone can still act
     * on, and today ends up the last thing on a 600px screen.
     */
    const friday = new Date(2026, 8, 11);
    const rolling = weekDays(friday, "rolling");
    expect(rolling[0]!.getDate()).toBe(11);
    expect(rolling.map((d) => d.getDate())).toEqual([11, 12, 13, 14, 15, 16, 17]);
  });

  it("leaves the full view's week alone", () => {
    // One definition of "week" per window, and the tab has room for the one
    // every other calendar uses.
    const friday = new Date(2026, 8, 11);
    expect(weekDays(friday).map((d) => d.getDate())).toEqual([6, 7, 8, 9, 10, 11, 12]);
    expect(weekDays(friday, "sunday")).toEqual(weekDays(friday));
  });

  it("still crosses a month boundary cleanly", () => {
    const late = new Date(2026, 8, 28);
    const days = weekDays(late, "rolling");
    expect(days.map((d) => `${d.getMonth()}-${d.getDate()}`)).toEqual([
      "8-28", "8-29", "8-30", "9-1", "9-2", "9-3", "9-4",
    ]);
  });

  it("marks today wherever it falls in the window", () => {
    const rolling = weekContents([], SEP10, NOW, "rolling");
    expect(rolling.map((d) => d.isToday)).toEqual([true, false, false, false, false, false, false]);
    const sunday = weekContents([], SEP10, NOW, "sunday");
    // Thursday is the fifth column of a Sunday-start week.
    expect(sunday.map((d) => d.isToday)).toEqual([false, false, false, false, true, false, false]);
  });
});

describe("finished work with a late window still open", () => {
  /*
   * The symptom Sushi reported: PHYS 435 Homework 2 was submitted, due Sep 9,
   * and Gradescope was still accepting it until Sep 16 — and it appeared
   * nowhere at all. `liveDeadline` promoted the anchor to Sep 16, so `isPast`
   * said no, so this filter dropped it as finished-but-not-yet-past; and
   * nothing drew it on Sep 9, which is where "a week you worked through should
   * not look like a week nothing happened in" says it belongs.
   *
   * Every completed PrairieLearn assessment with a reduced-credit tail went the
   * same way, which by October is most of a semester.
   */
  const submitted = () =>
    item({
      title: "Homework 2",
      status: "submitted",
      dueAt: at(2026, 8, 9, 17),
      lateDueAt: at(2026, 8, 16, 17),
      members: [member(undefined, "submitted")],
    });

  it("still shows it, on the day it was due", () => {
    const visible = visibleItems([submitted()], DEFAULT_SETTINGS, new Set(), NOW);
    expect(visible.map((i) => i.title)).toEqual(["Homework 2"]);

    const sep9 = dayContents(visible, new Date(2026, 8, 9), NOW);
    expect(allTimed(sep9).map((p) => p.item.title)).toEqual(["Homework 2"]);
  });

  it("does not also draw it on the late date", () => {
    // It is done. A struck-through row sitting in the future on a date it was
    // never due is the other half of getting this wrong.
    const sep16 = dayContents([submitted()], new Date(2026, 8, 16), NOW);
    expect(allTimed(sep16)).toEqual([]);
  });

  it("keeps hiding finished work that is still ahead, for the callers that ask", () => {
    // What `hideSubmitted` is actually for: something handed in early should
    // not sit in a *list of what is owed*. On the calendar it is drawn struck
    // through instead (Sushi, 2026-09-18), so only `dropFinished` drops it.
    const early = item({
      title: "handed in early",
      status: "submitted",
      dueAt: at(2026, 8, 14, 17),
      members: [member(undefined, "submitted")],
    });
    expect(
      visibleItems([early], DEFAULT_SETTINGS, new Set(), NOW, { dropFinished: true }),
    ).toEqual([]);
    expect(visibleItems([early], DEFAULT_SETTINGS, new Set(), NOW)).toHaveLength(1);
  });

  it("draws unfinished late work on its late date and still calls it late", () => {
    /*
     * Rewritten 2026-09-21. It used to assert `attentionGroups` was *empty* for
     * this row — the banding and the planning were one decision, so "the window
     * is still open" also meant "not late". Sushi, looking at exactly this row:
     * "i think if its late it should show up in late no matter what even if
     * its 80%."
     *
     * The half that has not changed is the grid: the row is still drawn on
     * Sep 16, because that is the date a student can still act on, and
     * `liveDeadline` still says so.
     */
    const unfinished = item({
      title: "not handed in",
      dueAt: at(2026, 8, 9, 17),
      lateDueAt: at(2026, 8, 16, 17),
    });
    const sep16 = dayContents([unfinished], new Date(2026, 8, 16), NOW);
    expect(allTimed(sep16).map((p) => p.item.title)).toEqual(["not handed in"]);
    expect(attentionGroups([unfinished], NOW).map((g) => g.name)).toEqual(["Overdue"]);
  });
});

/*
 * Sushi, 2026-09-18: "Show it struck through, including hand-ticked rows."
 *
 * The beta report: "completed assignments from PrairieLearn don't show up in
 * the calendar." They did not, on today or on any future day, because
 * `visibleItems` dropped finished work that was not yet past — so handing
 * something in at 2pm deleted it from a day it was still due on, and a finished
 * undated row had no past to fall into and was deleted from every day there is.
 */
describe("finished work is drawn, struck through", () => {
  const handedIn = (partial: Partial<Item> = {}) =>
    item({
      status: "submitted",
      members: [member(undefined, "submitted")],
      ...partial,
    });

  it("draws work handed in this afternoon on today, where it is still due", () => {
    const today = handedIn({ title: "PL homework", dueAt: at(2026, 8, 10, 23, 59) });
    const visible = visibleItems([today], DEFAULT_SETTINGS, new Set(), NOW);
    const contents = dayContents(visible, SEP10, NOW);
    // 11:59 PM is a default, so it is hoisted out of the hour axis — but it is
    // on the day, which is the whole report.
    expect(contents.endOfDay.map((p) => p.item.title)).toEqual(["PL homework"]);
    expect(itemTone(today, NOW)).toBe("done");
  });

  it("draws a finished undated row in the untimed band", () => {
    const undated = handedIn({ title: "no date", dueAt: at(2026, 8, 12), timeAssumed: true });
    const visible = visibleItems([undated], DEFAULT_SETTINGS, new Set(), NOW);
    const contents = dayContents(visible, new Date(2026, 8, 12), NOW);
    expect(contents.untimed.map((i) => i.title)).toEqual(["no date"]);
    expect(allTimed(contents)).toEqual([]);
  });

  it("draws a hand-ticked row struck through, on a future day", () => {
    // The hand tick is the only way a course-website row is ever finished:
    // those sources never report a submission.
    const ticked = item({ title: "ticked", done: true, dueAt: at(2026, 8, 12, 17) });
    const visible = visibleItems([ticked], DEFAULT_SETTINGS, new Set(), NOW);
    const contents = dayContents(visible, new Date(2026, 8, 12), NOW);
    expect(allTimed(contents).map((p) => p.item.title)).toEqual(["ticked"]);
    // `.row-done` / `.mpill--done` in the popup key off exactly this.
    expect(itemTone(ticked, NOW)).toBe("done");
  });

  it("keeps a booking off the grid, finished or not", () => {
    expect(
      visibleItems([item({ kind: "booking", dueAt: at(2026, 8, 12, 9) })], DEFAULT_SETTINGS),
    ).toEqual([]);
  });

  it("leaves the Attention tab alone: it asks for what is owed", () => {
    const owed = (items: Item[]) =>
      visibleItems(items, DEFAULT_SETTINGS, new Set(), NOW, { dropFinished: true });
    const done = handedIn({ title: "done", dueAt: at(2026, 8, 12, 17) });
    const undatedDone = handedIn({ title: "undated done" });
    expect(attentionCount(owed([done, undatedDone]), NOW)).toBe(0);
    expect(attentionGroups(owed([done, undatedDone]), NOW)).toEqual([]);
  });
});

describe("a month cell puts finished pills last (sinkDone)", () => {
  const donePill = (title: string, hour: number) =>
    item({
      title,
      status: "graded",
      dueAt: at(2026, 8, 12, hour),
      members: [member(undefined, "graded")],
    });

  const cellFor = (items: Item[], day: number) =>
    monthCells(items, SEP10, NOW).find((c) => dayKey(c.date) === `2026-09-${day}`)!;

  it("shows the one thing still owed when three finished rows would fill the cell", () => {
    // The cell draws MONTH_CELL_ROWS and then "+N more". Ordered by time, the
    // open row is fourth and invisible — and "which days are still heavy" is
    // the only question a month answers.
    const cell = cellFor(
      [
        donePill("done 9am", 9),
        donePill("done 10am", 10),
        donePill("done 11am", 11),
        item({ title: "still owed", dueAt: at(2026, 8, 12, 12) }),
      ],
      12,
    );
    expect(cell.items.slice(0, MONTH_CELL_ROWS).map((p) => p.item.title)).toContain(
      "still owed",
    );
    expect(cell.items.map((p) => p.item.title)).toEqual([
      "still owed",
      "done 9am",
      "done 10am",
      "done 11am",
    ]);
  });

  it("keeps timed before untimed inside each group", () => {
    // `sinkDone` is a stable partition, not a sort: the reason untimed comes
    // last is unchanged, and it has to survive the new rule.
    const cell = cellFor(
      [
        donePill("done timed", 9),
        item({ title: "open timed", dueAt: at(2026, 8, 12, 10) }),
        item({ title: "open untimed", dueAt: at(2026, 8, 12), timeAssumed: true }),
      ],
      12,
    );
    expect(cell.items.map((p) => p.item.title)).toEqual([
      "open timed",
      "open untimed",
      "done timed",
    ]);
  });
});

describe("quietDay (the week's 22px row)", () => {
  const done = (title: string) =>
    item({
      title,
      status: "graded",
      dueAt: at(2026, 8, 12, 9),
      members: [member(undefined, "graded")],
    });

  it("calls a day of nothing but finished work quiet", () => {
    // It used to be "no items", which was the same question only while
    // finished work never reached a view. A day whose four assignments are all
    // handed in is a day with four rows and nothing to do.
    const contents = dayContents([done("a"), done("b")], new Date(2026, 8, 12), NOW);
    expect(quietDay(contents, NOW)).toBe(true);
  });

  it("is not quiet when one row is still owed", () => {
    const contents = dayContents(
      [done("a"), item({ title: "owed", dueAt: at(2026, 8, 12, 10) })],
      new Date(2026, 8, 12),
      NOW,
    );
    expect(quietDay(contents, NOW)).toBe(false);
  });

  it("counts an untimed row, which is not on the hour axis to be counted", () => {
    const contents = dayContents(
      [item({ title: "owed", dueAt: at(2026, 8, 12), timeAssumed: true })],
      new Date(2026, 8, 12),
      NOW,
    );
    expect(contents.untimed).toHaveLength(1);
    expect(quietDay(contents, NOW)).toBe(false);
  });

  it("calls an empty day quiet, as it always has", () => {
    expect(quietDay(dayContents([], new Date(2026, 8, 12), NOW), NOW)).toBe(true);
  });
});

describe("weekStatus (brief D5, mock 1b)", () => {
  it("says the clock for ordinary open work", () => {
    // Mock 1b, Saturday: "9:00 PM" and "11:59 PM".
    expect(weekStatus(item({ dueAt: at(2026, 8, 12, 21, 0) }), NOW)).toBe(
      new Date(2026, 8, 12, 21, 0).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
    );
  });

  it("says EOD for a time this extension invented, and a clock for a stated one", () => {
    /*
     * Worker house rule 3. Mock 1b's Saturday has both in one card: CS 425's
     * MP1 Report at a stated "11:59 PM" and CS 424's Homework 1 at "EOD",
     * because the course site printed a bare date and §4.5's runner filled in
     * 23:59. Showing both as "11:59 PM" is the invention wearing a friendly
     * face, and a student who trusts it misses a 5 PM cutoff.
     */
    const assumed = item({ dueAt: at(2026, 8, 12, 23, 59), timeAssumed: true });
    const stated = item({ dueAt: at(2026, 8, 12, 23, 59) });
    expect(weekStatus(assumed, NOW)).toBe("EOD");
    expect(weekStatus(stated, NOW)).not.toBe("EOD");
  });

  it("says done, above everything else", () => {
    // Mock 1b, Monday: "done", struck through. Including a row that is also
    // overdue — finished work is not late, however long ago it was due.
    expect(weekStatus(item({ done: true, dueAt: at(2026, 8, 12, 21) }), NOW)).toBe("done");
    expect(weekStatus(item({ done: true, dueAt: at(2026, 8, 8, 21) }), NOW)).toBe("done");
  });

  it("says how late a row with an open window is, not 'late ok'", () => {
    /*
     * Rewritten 2026-09-21. This used to read "late ok" for a row whose full
     * credit had gone and whose window was still open — Sushi's decision moved
     * that row into the Late band, and "late ok" beside the word Late is the
     * word arguing with the heading over it.
     *
     * The count is from the deadline it *missed*, not the window it still has:
     * counting from the window would print "in 6d" on a late row.
     */
    const stillOpen = item({ dueAt: at(2026, 8, 9, 23, 59), lateDueAt: at(2026, 8, 16, 23, 59) });
    expect(weekStatus(stillOpen, NOW)).toBe(countdown(at(2026, 8, 9, 23, 59), NOW));
    expect(weekStatus(stillOpen, NOW)).toBe("18h late");
  });

  it("keeps 'late ok' for the one shape with no missed deadline", () => {
    // §4.3's no-popover fallback: PrairieLearn's credit *cell* says "80% until
    // …" and states no full-credit instant, so there is nothing to be late
    // from. This is the only row left that is amber rather than red.
    const onlyReduced = item({ lateDueAt: at(2026, 8, 16, 23, 59) });
    expect(itemTone(onlyReduced, NOW)).toBe("late");
    expect(weekStatus(onlyReduced, NOW)).toBe("late ok");
  });

  it("says how late, in countdown's own words", () => {
    // Mock 1b, Friday: "1d late". One wording, so the Today hero and the week
    // card cannot disagree about the same row.
    const overdue = item({ dueAt: at(2026, 8, 9, 18, 0) });
    expect(weekStatus(overdue, NOW)).toBe("1d late");
    expect(weekStatus(overdue, NOW)).toBe(countdown(at(2026, 8, 9, 18, 0), NOW));
    expect(weekStatus(item({ dueAt: at(2026, 8, 10, 16, 0) }), NOW)).toBe("2h late");
  });

  it("says how late rather than EOD for an overdue invented time", () => {
    // Elapsed time: 23:59 yesterday read at 18:00 is 18 hours late, and the
    // calendar turning over does not make it a day (R3 L9). Mock 1b's "1d late"
    // is a deadline a full day gone.
    expect(weekStatus(item({ dueAt: at(2026, 8, 9, 23, 59), timeAssumed: true }), NOW)).toBe(
      "18h late",
    );
    expect(weekStatus(item({ dueAt: at(2026, 8, 9, 17, 0), timeAssumed: true }), NOW)).toBe(
      "1d late",
    );
  });

  it("says nothing for a row with nothing to place", () => {
    expect(weekStatus(item({ title: "undated" }), NOW)).toBe("");
  });
});

describe("itemTone (one answer for the list and the month)", () => {
  /*
   * This decision lived inline in the popup's row renderer, so the month grid —
   * which draws pills, not rows — knew none of it: finished work there looked
   * exactly like work still owed, which is the one question a month is for. It
   * only became visible once finished work started appearing on the calendar at
   * all; before that the month had nothing to get wrong.
   */
  it("calls finished work done, however long ago it was due", () => {
    const submitted = item({
      status: "submitted",
      dueAt: at(2026, 8, 1, 12),
      members: [member(undefined, "submitted")],
    });
    expect(itemTone(submitted, NOW)).toBe("done");
    // And a hand-ticked row, which is the only way a course-website row is ever
    // finished — those sources never report a submission.
    expect(itemTone(item({ done: true, dueAt: at(2026, 8, 1, 12) }), NOW)).toBe("done");
  });

  it("never calls finished work overdue", () => {
    // The ordering is the point: the done check comes before the clock does.
    const late = item({
      status: "graded",
      dueAt: at(2026, 8, 1, 12),
      members: [member(undefined, "graded")],
    });
    expect(itemTone(late, NOW)).not.toBe("overdue");
  });

  it("separates lost from merely late", () => {
    /*
     * Rewritten 2026-09-21. Amber used to mean "full credit has gone, the
     * window is still open". Sushi: "i think 80% deadline shouldnt be yellow
     * its confusing to see that" — such a row is drawn under **Late** now, and
     * a red row under a red heading is one answer rather than two.
     *
     * What is left of amber is the shape with no full-credit instant to be
     * late from, which is §4.3's no-popover fallback and nothing else.
     */
    expect(itemTone(item({ dueAt: at(2026, 8, 1, 12) }), NOW)).toBe("overdue");
    expect(
      itemTone(item({ dueAt: at(2026, 8, 1, 12), lateDueAt: at(2026, 8, 20, 12) }), NOW),
    ).toBe("overdue");
    expect(itemTone(item({ lateDueAt: at(2026, 8, 20, 12) }), NOW)).toBe("late");
    expect(itemTone(item({ dueAt: at(2026, 8, 20, 12) }), NOW)).toBe("open");
  });

  it("never calls an event or a booking overdue", () => {
    // An event is over, not outstanding; a booking is a window with nothing to
    // hand in (§4.4).
    expect(itemTone(item({ kind: "event", dueAt: at(2026, 8, 1, 12) }), NOW)).toBe("event");
    expect(itemTone(item({ kind: "booking", dueAt: at(2026, 8, 1, 12) }), NOW)).toBe("booking");
  });

  it("says nothing about a row with no deadline at all", () => {
    // `open` earns no class on either surface, which is what an undated row
    // should look like.
    expect(itemTone(item({ title: "undated" }), NOW)).toBe("open");
  });
});

/**
 * A hidden row is hidden, whoever is asking.
 *
 * Audited 2026-09-12 after a beta report that hiding "doesn't work on the
 * calendar". It was not the cause — the popup pipes everything through
 * `visibleItems`, `groupItems` filters for the badge and §7 filters for
 * reminders, so every live path was already correct. But `dayContents`,
 * `weekContents`, `monthCells` and `attentionGroups` were correct *by
 * convention rather than by construction*: each returned the hidden row
 * happily when handed an unfiltered list, with no error, in one view, to a
 * student looking at a thing they had already asked to remove.
 */
describe("no view returns a hidden item, even given unfiltered input", () => {
  const NOW_HIDE = new Date(2026, 8, 14, 12, 0, 0);
  const hiddenRow = (title: string, dueAt: string): Item =>
    ({
      id: title, title, courseLabel: "CS357", kind: "assignment", dueAt,
      members: [], sources: ["gradescope"], url: "https://www.gradescope.com/x",
      status: "not_submitted", hidden: true, extra: {},
    }) as unknown as Item;
  const openRow = (title: string, dueAt: string): Item =>
    ({ ...hiddenRow(title, dueAt), hidden: false }) as Item;

  const items = [
    hiddenRow("Hidden timed", "2026-09-14T17:00:00-05:00"),
    hiddenRow("Hidden overdue", "2026-09-10T17:00:00-05:00"),
    openRow("Kept", "2026-09-14T23:59:00-05:00"),
  ];
  const titles = (list: readonly { title: string }[]) => list.map((i) => i.title);

  it("dayContents", () => {
    const contents = dayContents(items, NOW_HIDE, NOW_HIDE);
    const seen = [...allTimed(contents).map((p) => p.item.title), ...titles(contents.untimed)];
    expect(seen.filter((t) => t.startsWith("Hidden"))).toEqual([]);
  });

  it("weekContents and monthCells, which delegate to it", () => {
    const week = weekContents(items, NOW_HIDE, NOW_HIDE, "sunday").flatMap((d) =>
      allTimed(d.contents).map((p) => p.item.title),
    );
    expect(week.filter((t) => t.startsWith("Hidden"))).toEqual([]);
    const month = monthCells(items, NOW_HIDE, NOW_HIDE).flatMap((c) =>
      c.items.map((p) => p.item.title),
    );
    expect(month.filter((t) => t.startsWith("Hidden"))).toEqual([]);
  });

  it("attentionGroups, where an overdue hidden row would otherwise shout", () => {
    const seen = attentionGroups(items, NOW_HIDE).flatMap((g) => titles(g.items));
    expect(seen.filter((t) => t.startsWith("Hidden"))).toEqual([]);
  });
});

/**
 * Sushi, 2026-09-21: *"i think if its late it should show up in late no matter
 * what even if its 80%."*
 *
 * He was looking at a PrairieLearn MP whose 100% deadline had gone and whose
 * 80% tier ran until that night. It was drawn under **By end of day**, in
 * amber, among work that was not late at all — because `overdueItems` asked
 * `anchorOf`, which asks `liveDeadline`, which promotes such a row to the
 * window it still has. `missedDeadline` is the other half of that question.
 */
describe("the Late band and a reduced-credit window (Sushi, 2026-09-21)", () => {
  // NOW is Thursday 2026-09-10, 6:00 PM. Full credit went yesterday; 80% runs
  // until tonight at 11:59, so without the split this row is "end of day".
  const mp = (partial: Partial<Item> = {}) =>
    item({
      title: "MP1",
      dueAt: at(2026, 8, 9, 23, 59),
      lateDueAt: at(2026, 8, 10, 23, 59),
      ...partial,
    });

  it("moves the row out of By end of day and into Late", () => {
    const schedule = todaySchedule([mp()], NOW);
    expect(schedule.late.map((i) => i.title)).toEqual(["MP1"]);
    expect(schedule.endOfDay).toEqual([]);
    expect(schedule.timed).toEqual([]);
  });

  it("counts it once, so the band heading and the folio still add up", () => {
    const schedule = todaySchedule([mp(), item({ title: "tonight", dueAt: at(2026, 8, 10, 23, 59) })], NOW);
    expect(schedule.late.length + schedule.endOfDay.length + schedule.timed.length).toBe(2);
    expect(schedule.endOfDay.map((i) => i.title)).toEqual(["tonight"]);
  });

  it("gives it the Late band's own colour rather than amber", () => {
    // `row-late`'s warn edge is what Sushi called "yellow". The class is not
    // deleted — §4.3's no-popover shape still opts into it — this state stops.
    expect(itemTone(mp(), NOW)).toBe("overdue");
  });

  it("says how late it is, counted from the deadline it missed", () => {
    // From the 80% window it would read "in 6h" under a heading saying Late.
    expect(weekStatus(mp(), NOW)).toBe(countdown(at(2026, 8, 9, 23, 59), NOW));
  });

  it("keeps a finished row out of Late whichever deadline it is banded by", () => {
    const submitted = mp({ status: "submitted", members: [member(undefined, "submitted")] });
    expect(overdueItems([submitted], NOW)).toEqual([]);
    expect(itemTone(submitted, NOW)).toBe("done");
    // And the student's own tick, which no source can ever report for a course
    // site's rows.
    expect(overdueItems([mp({ done: true })], NOW)).toEqual([]);
  });

  it("holds it past §8.1's week while the window is open, and drops it after", () => {
    // The defect `liveDeadline`'s comment records: CS 357's L4a fell out of the
    // list on day seven while PrairieLearn was still paying 80% for a week.
    const ladder = mp({ dueAt: at(2026, 8, 1, 11), lateDueAt: at(2026, 8, 22, 23) });
    expect(overdueItems([ladder], NOW).map((i) => i.title)).toEqual(["MP1"]);
    expect(overdueItems([ladder], new Date(2026, 8, 23, 12))).toEqual([]);
  });

  it("orders Late by when each row was missed, not by the window it still has", () => {
    // Descending, most recently missed first. Ordered by the anchor instead,
    // the 80% row's future window would put it above work missed an hour ago.
    const rows = [
      mp({ title: "missed 6 days ago, 80% until Sep 22", dueAt: at(2026, 8, 4, 12), lateDueAt: at(2026, 8, 22, 23) }),
      mp({ title: "missed an hour ago", dueAt: at(2026, 8, 10, 17), lateDueAt: undefined }),
    ];
    expect(overdueItems(rows, NOW).map((i) => i.title)).toEqual([
      "missed an hour ago",
      "missed 6 days ago, 80% until Sep 22",
    ]);
  });

  it("leaves a row with no late window exactly where it was", () => {
    expect(todaySchedule([item({ title: "tonight", dueAt: at(2026, 8, 10, 23, 59) })], NOW).late).toEqual([]);
    expect(overdueItems([item({ title: "yesterday", dueAt: at(2026, 8, 9, 12) })], NOW)).toHaveLength(1);
  });
});

/**
 * §8.3 calendar export. RFC 5545 is unforgiving: one unescaped comma or one
 * over-long line corrupts every event after it, and real course titles contain
 * commas — "MP1 Report (4cr only, EXCEPT...)" is from this account's own data.
 */

import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, foldIcsLine, googleCalendarUrl, icsTimestamp } from "../src/core/ics.js";
import {
  OWN_TIME_NOTE_ALL_DAY,
  SOURCE_TIME_NOTE_ALL_DAY,
} from "../src/core/provenance.js";
import type { Item, RawItem } from "../src/sources/types.js";

function member(extra?: Record<string, string>): RawItem {
  return {
    source: "gradescope",
    sourceId: "1",
    courseRaw: "CS 357",
    title: "m",
    kind: "assignment",
    url: "https://www.gradescope.com/",
    status: "not_submitted",
    extra,
    fetchedAt: "2026-09-10T18:00:00.000Z",
  };
}

/** RFC 5545 folds at 75 octets, so an asserted sentence has to be put back. */
const unfold = (ics: string) => ics.replace(/\r\n /g, "");

function manualMember(): RawItem {
  return {
    source: "manual",
    sourceId: "m1",
    courseRaw: "CS 357",
    title: "m",
    kind: "assignment",
    status: "unknown",
    fetchedAt: "2026-09-10T18:00:00.000Z",
  };
}

function item(partial: Partial<Item> = {}): Item {
  return {
    id: "abc123",
    members: [member()],
    courseLabel: "CS357",
    title: "HW3 Errors and Big-O",
    kind: "assignment",
    url: "https://www.gradescope.com/courses/1/assignments/2",
    status: "not_submitted",
    hidden: false,
    done: false,
    notified: {},
    dueAt: "2026-09-11T22:00:00.000Z",
    ...partial,
  };
}

describe("icsTimestamp", () => {
  it("renders RFC 5545 UTC", () => {
    expect(icsTimestamp("2026-09-11T22:00:00.000Z")).toBe("20260911T220000Z");
    expect(icsTimestamp("2026-09-11T17:00:00-05:00")).toBe("20260911T220000Z");
  });

  it("throws rather than emitting a broken timestamp", () => {
    expect(() => icsTimestamp("nonsense")).toThrow();
  });
});

describe("escapeIcsText (RFC 5545 §3.3.11)", () => {
  it("escapes the four characters that break a property", () => {
    expect(escapeIcsText("MP1 Report (4cr only, EXCEPT sec 3)")).toBe(
      "MP1 Report (4cr only\\, EXCEPT sec 3)",
    );
    expect(escapeIcsText("a;b")).toBe("a\\;b");
    expect(escapeIcsText("a\\b")).toBe("a\\\\b");
    expect(escapeIcsText("a\nb")).toBe("a\\nb");
    // Backslash first, or the escapes escape each other.
    expect(escapeIcsText("a\\,b")).toBe("a\\\\\\,b");
  });
});

describe("foldIcsLine (RFC 5545 §3.1)", () => {
  it("leaves a short line alone", () => {
    expect(foldIcsLine("SUMMARY:short")).toBe("SUMMARY:short");
  });

  it("folds at 75 octets with a leading space on continuations", () => {
    const folded = foldIcsLine(`SUMMARY:${"x".repeat(200)}`);
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0]!.length).toBe(75);
    for (const line of lines.slice(1)) expect(line.startsWith(" ")).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"x".repeat(200)}`);
  });

  it("never splits a multi-byte character", () => {
    const folded = foldIcsLine(`SUMMARY:${"é".repeat(60)}`);
    expect(folded).not.toContain("�");
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"é".repeat(60)}`);
  });
});

describe("buildIcs", () => {
  const now = new Date("2026-09-10T18:00:00.000Z");

  it("wraps events in a valid calendar with CRLF endings", () => {
    const ics = buildIcs([item()], now);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics.split("\r\n").filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
  });

  it("makes a 15-minute event ending at the deadline (§8.3)", () => {
    const ics = buildIcs([item()], now);
    expect(ics).toContain("DTSTART:20260911T214500Z");
    expect(ics).toContain("DTEND:20260911T220000Z");
  });

  it("uses a stable UID so a re-import updates rather than duplicates", () => {
    expect(buildIcs([item()], now)).toContain("UID:abc123@illini-dash");
  });

  it("exports a reduced-credit deadline and says what it is", () => {
    const late = item({ dueAt: undefined, lateDueAt: "2026-09-22T23:59:00.000Z" });
    const ics = buildIcs([late], now);
    expect(ics).toContain("DTEND:20260922T235900Z");
    expect(ics).toContain("Reduced-credit deadline.");
  });

  it("marks a booking row as unbooked rather than as a deadline (§4.4)", () => {
    const ics = buildIcs([item({ kind: "booking", title: "Book a slot: Quiz 2" })], now);
    expect(ics).toContain("Not booked");
  });

  it("skips an item with no date at all rather than emitting a broken event", () => {
    const ics = buildIcs([item({ dueAt: undefined })], now);
    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
  });

  it("survives a title full of RFC-hostile characters", () => {
    const ics = buildIcs([item({ title: "A, B; C\\D\nE" })], now);
    const summary = ics.split("\r\n").find((l) => l.startsWith("SUMMARY:"))!;
    expect(summary).toBe("SUMMARY:CS357: A\\, B\\; C\\\\D\\nE");
    // One physical line per property: nothing leaked into the next.
    expect(ics.split("\r\n").filter((l) => l.startsWith("DTSTART"))).toHaveLength(1);
  });
});

describe("googleCalendarUrl (§8.3)", () => {
  it("builds a template link with no OAuth", () => {
    const url = new URL(googleCalendarUrl(item())!);
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20260911T214500Z/20260911T220000Z");
    expect(url.searchParams.get("text")).toBe("CS357: HW3 Errors and Big-O");
  });

  it("returns nothing for an undated item", () => {
    expect(googleCalendarUrl(item({ dueAt: undefined }))).toBeUndefined();
  });
});

describe("exporting a time this extension invented (§4.5)", () => {
  const now = new Date("2026-09-10T18:00:00.000Z");
  const assumed = () =>
    item({
      dueAt: "2026-09-18T23:59:00-05:00",
      timeAssumed: true,
    });

  it("writes an all-day event rather than a hard 11:59 PM one", () => {
    // A calendar entry at 11:59 PM looks more authoritative than a popup row,
    // and it is the one still being trusted three weeks later.
    const ics = buildIcs([assumed()], now);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260918");
    expect(ics).not.toMatch(/DTSTART:\d{8}T\d{6}Z/);
  });

  it("files it on the local day, not the UTC one", () => {
    // 23:59 Central is the *next* day in UTC, so a naive toISOString would put
    // every timeless course-site deadline one day late.
    expect(buildIcs([assumed()], now)).toContain("DTSTART;VALUE=DATE:20260918");
    expect(buildIcs([assumed()], now)).toContain("DTEND;VALUE=DATE:20260919");
  });

  it("says in the event that the time is not the course's, and that it is all-day", () => {
    // `toContain("no time")` passed against the short form too, so the .ics
    // description was the one surviving mutation of the 2026-09-19 pass. The
    // all-day half is the part only an exported event needs: the popup that
    // could have explained it is not there when the entry is read.
    const ics = unfold(buildIcs([assumed()], now));
    expect(ics).toContain(escapeIcsText(SOURCE_TIME_NOTE_ALL_DAY));
  });

  it("does not send the student to a course page on a row they typed", () => {
    // The manual row has no course site; the sentence that told them to go and
    // check one was the second half of Sushi's 2026-09-19 report.
    const mine = item({ members: [manualMember()], dueAt: "2026-09-18T23:59:00-05:00", timeAssumed: true });
    const ics = unfold(buildIcs([mine], now));
    expect(ics).toContain(escapeIcsText(OWN_TIME_NOTE_ALL_DAY));
    expect(ics).not.toContain("course site");
    expect(googleCalendarUrl(mine)!).not.toContain("course+site");
  });

  it("keeps a stated deadline as a timed event", () => {
    const ics = buildIcs([item({ dueAt: "2026-09-18T17:00:00-05:00" })], now);
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(ics).not.toContain("VALUE=DATE");
  });

  it("makes the Google Calendar link all-day too", () => {
    const url = googleCalendarUrl(assumed())!;
    expect(url).toContain("dates=20260918%2F20260919");
  });
});

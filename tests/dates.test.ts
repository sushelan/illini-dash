/**
 * §3.2 year inference, at its own seam. Every other test reaches `inferYear`
 * through a parser, so a case no fixture contains — a leap day — had no test.
 */

import { describe, expect, it } from "vitest";
import { inferYear } from "../src/core/dates.js";

const CHICAGO = "America/Chicago";

describe("inferYear (§3.2)", () => {
  it("finds a leap day in a later candidate year rather than throwing on an earlier one", () => {
    // Tue Feb 29 exists only in 2028. The defect: the reference year 2027 has
    // no Feb 29, `wallClockToIso` threw for it, and the throw ended the search
    // before 2028 was ever tried — so the row lost its date.
    const year = inferYear(
      { month: 2, day: 29, hour: 23, minute: 59 },
      "Tue",
      "2027-12-01T18:00:00Z",
      CHICAGO,
    );
    expect(year).toBe(2028);
  });

  describe("with no weekday, the year nearest the moment it was read", () => {
    // Sushi, 2026-10-01: "dec 15 read on jan 3 should mean last month".
    const read = (month: number, day: number, reference: string) =>
      inferYear({ month, day, hour: 23, minute: 59 }, undefined, reference, CHICAGO);

    it("reads Dec 15 on Jan 3 as last December, not next", () => {
      expect(read(12, 15, "2027-01-03T18:00:00Z")).toBe(2026);
    });

    it("still reads Jan 10 on Dec 20 as next January", () => {
      expect(read(1, 10, "2026-12-20T18:00:00Z")).toBe(2027);
    });

    it("reads a date in the same term as this year, either side of today", () => {
      expect(read(9, 7, "2026-09-18T18:00:00Z")).toBe(2026);
      expect(read(11, 30, "2026-09-18T18:00:00Z")).toBe(2026);
    });

    it("reads a date-less Feb 29 in the nearest year that has one", () => {
      // The old rule built this year's Feb 29 unconditionally and threw in 2027.
      expect(read(2, 29, "2027-12-01T18:00:00Z")).toBe(2028);
    });
  });
});

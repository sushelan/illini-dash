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
});

import { describe, expect, it } from "vitest";
import { reservationVerified } from "../src/core/reservation.js";
import type { Item, RawItem, Source } from "../src/sources/types.js";

/**
 * A booked PrairieTest row as `src/sources/prairietest.ts` records it: the
 * `/pt/student/reservation/{id}` link's id, in `extra.reservationId`.
 */
function member(source: Source, extra?: Record<string, string>): RawItem {
  return {
    source,
    sourceId: `${source}:exam-1`,
    courseRaw: "CS 225",
    courseCode: "CS225",
    title: "Midterm 1",
    kind: "exam",
    dueAt: "2026-10-08T19:00:00-05:00",
    status: "unknown",
    ...(extra ? { extra } : {}),
    fetchedAt: "2026-09-22T16:14:00Z",
  };
}

function exam(...members: RawItem[]): Item {
  return {
    id: "item-1",
    members,
    courseCode: "CS225",
    courseLabel: "CS 225",
    title: "Midterm 1",
    kind: "exam",
    dueAt: "2026-10-08T19:00:00-05:00",
    status: "unknown",
    hidden: false,
    done: false,
    notified: {},
  };
}

const booked = () => exam(member("prairietest", { reservationId: "884201" }));

describe("reservationVerified", () => {
  /*
   * AGENTS.md, worker rule 3: "A value this code invented is not a value the
   * source stated." The tick claims a seat is held; only a reservation id says
   * one is.
   */
  it("ticks an upcoming exam whose PrairieTest member carries a reservation id", () => {
    expect(reservationVerified(booked(), "upcoming")).toBe(true);
  });

  it("does not tick an upcoming PrairieTest exam with no reservation id", () => {
    expect(reservationVerified(exam(member("prairietest")), "upcoming")).toBe(false);
    expect(
      reservationVerified(exam(member("prairietest", { locationDetail: "CBTF Grainger" })), "upcoming"),
    ).toBe(false);
  });

  /*
   * The defect this function replaces. The "Not booked" card exists *because*
   * no seat has been taken, and it was the loudest place the old tick appeared:
   * the same PrairieTest that offers the booking window also owns the
   * reservation, so the source name matched on the one card that contradicts it.
   */
  it("never ticks the unbooked card, whatever evidence the item carries", () => {
    expect(reservationVerified(booked(), "unbooked")).toBe(false);
  });

  it("never ticks an exam already sat", () => {
    expect(reservationVerified(booked(), "recent")).toBe(false);
  });

  /*
   * House rule 5 / rule 10: a realistic fixture cannot separate "PrairieTest
   * said so" from "some source said so", so this member is deliberately
   * unrealistic — Canvas does not issue CBTF reservations and never writes this
   * key. It is here so that dropping the source check has something to fail on.
   */
  it("does not treat another source's reservationId-shaped extra as evidence", () => {
    expect(
      reservationVerified(exam(member("canvas", { reservationId: "884201" })), "upcoming"),
    ).toBe(false);
  });

  // House rule 5: `typeof x === "string"` passes `""`, and `""` is what a
  // half-read row leaves behind.
  it("rejects an empty or blank reservation id", () => {
    expect(reservationVerified(exam(member("prairietest", { reservationId: "" })), "upcoming")).toBe(false);
    expect(reservationVerified(exam(member("prairietest", { reservationId: "  " })), "upcoming")).toBe(false);
  });

  it("finds the evidence on any member of a merged item", () => {
    const merged = exam(member("canvas"), member("prairietest", { reservationId: "884201" }));
    expect(reservationVerified(merged, "upcoming")).toBe(true);
  });
});

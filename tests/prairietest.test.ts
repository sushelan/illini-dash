/**
 * PrairieTest parser tests (§4.4), against two real captures a week apart:
 * one with a booked exam and an empty available card, one with both populated.
 * Evidence for the expected values is in docs/prairietest-findings.md.
 */

import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { parseDateAttribute, parseDateRangeAttribute } from "../src/core/dates.js";
import {
  PRAIRIETEST_ORIGIN,
  examKey,
  isLoginResponse,
  parseHome,
  splitTerm,
} from "../src/sources/prairietest.js";
import { ParseError, type PageCtx } from "../src/sources/types.js";

function docOf(name: string): Document {
  const html = readFileSync(new URL(`../fixtures/prairietest/${name}`, import.meta.url), "utf8");
  return parseHTML(html).document as unknown as Document;
}
function docFrom(html: string): Document {
  return parseHTML(html).document as unknown as Document;
}

const page: PageCtx = {
  url: `${PRAIRIETEST_ORIGIN}/pt/`,
  fetchedAt: "2026-09-10T18:00:00.000Z",
};

const both = parseHome(docOf("home-booked-and-available.html"), page);
const bookedOnly = parseHome(docOf("home-booked-none-available.html"), page);

describe("parseHome — booked exam (real captures)", () => {
  const exam = both.find((i) => i.kind === "exam")!;

  it("reads the reservation as one exam item", () => {
    expect(exam.title).toBe("CS 357: Quiz 1");
    expect(exam.courseCode).toBe("CS357");
    expect(exam.extra?.["term"]).toBe("Fa26");
    expect(exam.status).toBe("unknown"); // §4.4: "submitted" is meaningless here
  });

  it("takes the instant from the attribute, not the visible text", () => {
    // The capture was taken on the day of the exam, so the visible text reads
    // "today, 9pm (CDT)" — §4.4's regex over that text would reject it outright.
    expect(exam.dueAt).toBe("2026-09-11T02:00:00.000Z");
    const html = readFileSync(
      new URL("../fixtures/prairietest/home-booked-and-available.html", import.meta.url),
      "utf8",
    );
    expect(html).toContain("today, 9pm (CDT)");
  });

  it("keeps the location and session details", () => {
    expect(exam.extra?.["location"]).toBe("Grainger Library 057");
    expect(exam.extra?.["locationDetail"]).toContain("basement of Grainger Library");
    expect(exam.extra?.["duration"]).toBe("50min");
    expect(exam.extra?.["format"]).toBe("In-person");
    expect(exam.extra?.["accommodations"]).toBe("No accommodations");
  });

  it("keeps a stable key across a reschedule (§3.1 as amended)", () => {
    // The two captures are a week apart. Between them the student rescheduled:
    // the reservation id changed 3573947 -> 3607740 and the room moved from DCL
    // L410 to Grainger 057. Keying on the reservation id — as §3.1 originally
    // said — would have changed the memberKey, breaking every override on this
    // exam and re-firing its notifications. The title-derived key does not move.
    const earlier = bookedOnly.find((i) => i.kind === "exam")!;
    expect(earlier.extra?.["reservationId"]).toBe("3573947");
    expect(exam.extra?.["reservationId"]).toBe("3607740");
    expect(earlier.extra?.["location"]).toBe("DCL L410");
    expect(exam.sourceId).toBe(earlier.sourceId);
  });
});

describe("parseHome — booking pseudo-item (§4.4's headline feature)", () => {
  const booking = both.find((i) => i.kind === "booking")!;

  it("emits one booking item for an exam open but not reserved", () => {
    expect(booking.title).toBe("Book a slot: CS 357: Quiz 2");
    expect(booking.status).toBe("not_submitted");
    expect(booking.sourceId.endsWith(":booking")).toBe(true);
  });

  it("dates it at the window start, flagged as an estimate", () => {
    // §4.4: deliberately early, because slots fill. The UI must word this as
    // "sessions Sep 21-23, not booked", never "due Sep 21".
    expect(booking.dueAt).toBe("2026-09-21T05:01:00.000Z");
    expect(booking.extra?.["windowStart"]).toBe("2026-09-21T05:01:00.000Z");
    expect(booking.extra?.["windowEnd"]).toBe("2026-09-24T04:59:00.000Z");
    expect(booking.extra?.["deadlineIsEstimate"]).toBe("true");
  });

  it("captures the exam id, which exists only on this card", () => {
    // §12 Q2, fully resolved: the available row links to /pt/student/exam/{id};
    // the booked row has no exam id at all, only a reservation id.
    expect(booking.extra?.["examId"]).toBe("76745");
    expect(booking.url).toBe(`${PRAIRIETEST_ORIGIN}/pt/student/exam/76745`);
  });

  it("emits no booking item when the available card is empty", () => {
    expect(bookedOnly.filter((i) => i.kind === "booking")).toEqual([]);
    expect(bookedOnly).toHaveLength(1);
  });
});

describe("the both-cards cross-check (§4.4)", () => {
  const card = (heading: string, body: string) =>
    `<div class="card"><div class="card-header"><h2>${heading}</h2></div>` +
    `<ul class="list-group">${body}</ul></div>`;
  const bookedRow = (title: string) =>
    `<li class="list-group-item"><div class="row">` +
    `<div class="col-1" data-testid="exam"><a href="/pt/student/reservation/1">${title}</a></div>` +
    `<div class="col-1" data-testid="date"><span data-format-date='{"date":"2026-09-11T02:00:00.000Z"}'>x</span></div>` +
    `</div></li>`;
  const availableRow = (title: string) =>
    `<li class="list-group-item"><div class="row">` +
    `<div class="col-1" data-testid="action"><a href="/pt/student/exam/9">Make a reservation</a></div>` +
    `<div class="col-1" data-testid="exam">${title}</div>` +
    `<div class="col-1" data-testid="dates"><span data-format-date-range='{"start":"2026-09-21T05:01:00.000Z","end":"2026-09-24T04:59:00.000Z"}'>x</span></div>` +
    `</div></li>`;

  it("suppresses the booking item once the exam is booked", () => {
    // Whether a booked exam also stays listed in the available card was never
    // confirmed, so the rule is written so it does not matter.
    const doc = docFrom(
      card("Exams available for reservations", availableRow("CS 357 (Fa26): Quiz 2")) +
        card("Exam reservations", bookedRow("CS 357 (Fa26): Quiz 2")),
    );
    const items = parseHome(doc, page);
    expect(items.map((i) => i.kind)).toEqual(["exam"]);
  });

  it("matches on title, since the two cards carry different ids", () => {
    const doc = docFrom(
      card("Exams available for reservations", availableRow("CS 357 (Fa26): Quiz 3")) +
        card("Exam reservations", bookedRow("CS 357 (Fa26): Quiz 2")),
    );
    expect(parseHome(doc, page).map((i) => i.kind).sort()).toEqual(["booking", "exam"]);
  });
});

describe("empty and missing cards (§0 rule 3)", () => {
  const emptyCard = (heading: string, text: string) =>
    `<div class="card"><div class="card-header"><h2>${heading}</h2></div>` +
    `<ul class="list-group"><li class="list-group-item"><i>${text}</i></li></ul></div>`;

  it("accepts both empty-card wordings, one per card", () => {
    // §4.4 recorded only one of these, and attributed it to the wrong card.
    const doc = docFrom(
      emptyCard(
        "Exams available for reservations",
        "You don't currently have any exams available for reservations.",
      ) + emptyCard("Exam reservations", "You don't have any upcoming reservations."),
    );
    expect(parseHome(doc, page)).toEqual([]);
  });

  it("throws when neither card is on the page", () => {
    expect(() => parseHome(docFrom("<p>hello</p>"), page)).toThrow(/no exam reservation cards/);
  });

  it("throws when a card is neither empty nor has rows", () => {
    const doc = docFrom(
      `<div class="card"><div class="card-header"><h2>Exam reservations</h2></div>` +
        `<div>something else entirely</div></div>`,
    );
    expect(() => parseHome(doc, page)).toThrow(/neither empty nor has rows/);
  });

  it("throws when a booked row has no date attribute", () => {
    const doc = docFrom(
      `<div class="card"><div class="card-header"><h2>Exam reservations</h2></div>` +
        `<ul class="list-group"><li class="list-group-item">` +
        `<div class="col-1" data-testid="exam">CS 357 (Fa26): Quiz 1</div>` +
        `</li></ul></div>`,
    );
    expect(() => parseHome(doc, page)).toThrow(/has no date attribute/);
  });
});

describe("splitTerm and examKey", () => {
  it("strips the term for display and keeps it", () => {
    expect(splitTerm("CS 357 (Fa26): Quiz 1")).toEqual({ title: "CS 357: Quiz 1", term: "Fa26" });
    expect(splitTerm("ECE 391 (Sp27): Midterm")).toEqual({
      title: "ECE 391: Midterm",
      term: "Sp27",
    });
  });

  it("leaves a title with no term alone", () => {
    expect(splitTerm("CS 357: Quiz 1")).toEqual({ title: "CS 357: Quiz 1" });
  });

  it("keys the same exam identically regardless of spacing or case", () => {
    expect(examKey("CS 357: Quiz 1")).toBe(examKey("cs 357:  quiz 1"));
    expect(examKey("CS 357: Quiz 1")).not.toBe(examKey("CS 357: Quiz 2"));
  });
});

describe("date attributes (§4.4, replacing the regexes)", () => {
  it("reads an instant and a range", () => {
    expect(
      parseDateAttribute('{"date":"2026-09-11T02:00:00.000Z","timezone":"America/Chicago"}'),
    ).toBe("2026-09-11T02:00:00.000Z");
    expect(
      parseDateRangeAttribute(
        '{"start":"2026-09-21T05:01:00.000Z","end":"2026-09-24T04:59:00.000Z"}',
      ),
    ).toEqual({ start: "2026-09-21T05:01:00.000Z", end: "2026-09-24T04:59:00.000Z" });
  });

  it("throws rather than guessing", () => {
    for (const bad of ["", "not json", "{}", '{"date":"tomorrow"}', '{"date":123}']) {
      expect(() => parseDateAttribute(bad), bad).toThrow(ParseError);
    }
    for (const bad of ['{"start":"2026-09-21T05:01:00Z"}', '{"start":"x","end":"y"}']) {
      expect(() => parseDateRangeAttribute(bad), bad).toThrow(ParseError);
    }
  });

  it("rejects a range that ends before it starts", () => {
    expect(() =>
      parseDateRangeAttribute(
        '{"start":"2026-09-24T04:59:00.000Z","end":"2026-09-21T05:01:00.000Z"}',
      ),
    ).toThrow(/ends before it starts/);
  });
});

describe("url handling", () => {
  it("refuses an off-origin or non-https link", () => {
    for (const href of ["//evil.example/x", "http://evil.example/x", "javascript:alert(1)"]) {
      const doc = docFrom(
        `<div class="card"><div class="card-header"><h2>Exam reservations</h2></div>` +
          `<ul class="list-group"><li class="list-group-item">` +
          `<div class="col-1" data-testid="exam"><a href="${href}">CS 357 (Fa26): Quiz 1</a></div>` +
          `<div class="col-1" data-testid="date"><span data-format-date='{"date":"2026-09-11T02:00:00.000Z"}'>x</span></div>` +
          `</li></ul></div>`,
      );
      expect(parseHome(doc, page)[0]!.url, href).toBe(page.url);
    }
  });
});

describe("isLoginResponse", () => {
  it("recognises an expired session and not the real page", () => {
    expect(isLoginResponse(401, page.url, "")).toBe(true);
    expect(isLoginResponse(200, `${PRAIRIETEST_ORIGIN}/pt/login`, "")).toBe(true);
    expect(
      isLoginResponse(
        200,
        page.url,
        readFileSync(
          new URL("../fixtures/prairietest/home-booked-and-available.html", import.meta.url),
          "utf8",
        ),
      ),
    ).toBe(false);
  });
});

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

/** Raw fixture text, for the checks that run before any DOM parsing. */
function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/prairietest/${name}`, import.meta.url), "utf8");
}

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

/** Both cards, always — a missing card is now a structural error. */
const CARD = (heading: string, body: string) =>
  `<div class="card"><div class="card-header"><h2>${heading}</h2></div>` +
  `<ul class="list-group">${body}</ul></div>`;
const EMPTY_RESERVATIONS = CARD(
  "Exam reservations",
  `<li class="list-group-item"><i>You don't have any upcoming reservations.</i></li>`,
);
const EMPTY_AVAILABLE = CARD(
  "Exams available for reservations",
  `<li class="list-group-item"><i>You don't currently have any exams available for reservations.</i></li>`,
);
const BOOKED_ROW = (title: string, dateJson = '{"date":"2026-09-11T02:00:00.000Z"}') =>
  `<li class="list-group-item"><div class="row">` +
  `<div class="col-1" data-testid="exam"><a href="/pt/student/reservation/1">${title}</a></div>` +
  `<div class="col-1" data-testid="date"><span data-format-date='${dateJson}'>x</span></div>` +
  `</div></li>`;
const AVAILABLE_ROW = (
  title: string,
  rangeJson = '{"start":"2026-09-21T05:01:00.000Z","end":"2026-09-24T04:59:00.000Z"}',
) =>
  `<li class="list-group-item"><div class="row">` +
  `<div class="col-1" data-testid="action"><a href="/pt/student/exam/9">Make a reservation</a></div>` +
  `<div class="col-1" data-testid="exam">${title}</div>` +
  `<div class="col-1" data-testid="dates"><span data-format-date-range='${rangeJson}'>x</span></div>` +
  `</div></li>`;

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
  const card = CARD;
  const bookedRow = BOOKED_ROW;
  const availableRow = AVAILABLE_ROW;

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
  it("accepts both empty-card wordings, one per card", () => {
    // §4.4 recorded only one of these, and attributed it to the wrong card.
    expect(parseHome(docFrom(EMPTY_AVAILABLE + EMPTY_RESERVATIONS), page)).toEqual([]);
  });

  it("throws when neither card is on the page", () => {
    expect(() => parseHome(docFrom("<p>hello</p>"), page)).toThrow(/missing PrairieTest card/);
  });

  it("names each missing card, so a reworded heading is diagnosable", () => {
    // A single reworded heading used to delete that card's whole contents
    // silently — a booked exam gone, or the booking nag ceasing to exist.
    expect(() =>
      parseHome(docFrom(EMPTY_AVAILABLE + CARD("Your exam reservations", BOOKED_ROW("X"))), page),
    ).toThrow(/missing PrairieTest card: Exam reservations/);
    expect(() =>
      parseHome(
        docFrom(EMPTY_RESERVATIONS + CARD("Exams open for reservations", AVAILABLE_ROW("X"))),
        page,
      ),
    ).toThrow(/missing PrairieTest card: Exams available for reservations/);
  });

  it("is not fooled by extra markup inside a heading", () => {
    const doc = docFrom(
      EMPTY_AVAILABLE +
        CARD("<span>Exam reservations</span>", BOOKED_ROW("CS 357 (Fa26): Quiz 1")),
    );
    expect(parseHome(doc, page)).toHaveLength(1);
  });

  it("throws when a card is neither empty nor has rows", () => {
    const doc = docFrom(
      EMPTY_AVAILABLE +
        `<div class="card"><div class="card-header"><h2>Exam reservations</h2></div>` +
        `<div>something else entirely</div></div>`,
    );
    expect(() => parseHome(doc, page)).toThrow(/neither empty nor has rows/);
  });

  it("throws when a booked row has no date hook at all", () => {
    // A missing hook is structural. An unreadable *value* is not — see below.
    const doc = docFrom(
      EMPTY_AVAILABLE +
        CARD(
          "Exam reservations",
          `<li class="list-group-item"><div class="col-1" data-testid="exam">CS 357 (Fa26): Quiz 1</div></li>`,
        ),
    );
    expect(() => parseHome(doc, page)).toThrow(/has no date attribute/);
  });
});

describe("regressions found by the adversarial review", () => {
  it("does not blank a card because an empty-state element lingers beside a real row", () => {
    // A hidden empty-state li left in the DOM used to blank the whole card,
    // silently — §0 rule 3's worst case.
    const doc = docFrom(
      EMPTY_RESERVATIONS +
        CARD(
          "Exams available for reservations",
          `<li class="list-group-item d-none"><i>You don't currently have any exams available for reservations.</i></li>` +
            AVAILABLE_ROW("CS 357 (Fa26): Quiz 2"),
        ),
    );
    expect(parseHome(doc, page).map((i) => i.kind)).toEqual(["booking"]);
  });

  it("does not blank a card because a row's own title contains the marker", () => {
    const doc = docFrom(
      EMPTY_AVAILABLE +
        CARD(
          "Exam reservations",
          BOOKED_ROW("CS 357 (Fa26): You don't have any upcoming reservations quiz"),
        ),
    );
    expect(parseHome(doc, page)).toHaveLength(1);
  });

  it("throws on two rows that would share one key", () => {
    // §3's raw map is keyed by memberKey, so a collision silently merges two
    // items into one — losing an exam session, or a daily nag.
    const dupBooked = docFrom(
      EMPTY_AVAILABLE +
        CARD("Exam reservations", BOOKED_ROW("CS 357 (Fa26): Quiz 1").repeat(2)),
    );
    expect(() => parseHome(dupBooked, page)).toThrow(/duplicate exam key/);

    const dupAvailable = docFrom(
      EMPTY_RESERVATIONS +
        CARD("Exams available for reservations", AVAILABLE_ROW("CS 357 (Fa26): Quiz 2").repeat(2)),
    );
    expect(() => parseHome(dupAvailable, page)).toThrow(/duplicate booking key/);
  });

  it("does not throw when a booked exam is also still listed as available", () => {
    // §4.4 deliberately refuses to depend on whether this happens, so the
    // duplicate guard must sit after the cross-card skip, not before it.
    const doc = docFrom(
      CARD("Exams available for reservations", AVAILABLE_ROW("CS 357 (Fa26): Quiz 1")) +
        CARD("Exam reservations", BOOKED_ROW("CS 357 (Fa26): Quiz 1")),
    );
    expect(parseHome(doc, page).map((i) => i.kind)).toEqual(["exam"]);
  });

  it("keeps a booked exam undated rather than losing the page to a bad date value", () => {
    const doc = docFrom(
      CARD("Exams available for reservations", AVAILABLE_ROW("CS 357 (Fa26): Quiz 2")) +
        CARD("Exam reservations", BOOKED_ROW("CS 357 (Fa26): Quiz 1", '{"date":"nonsense"}')),
    );
    const items = parseHome(doc, page);
    // The other card's booking item must survive.
    expect(items.map((i) => i.kind).sort()).toEqual(["booking", "exam"]);
    const exam = items.find((i) => i.kind === "exam")!;
    expect(exam.dueAt).toBeUndefined();
    expect(exam.extra?.["unparsedDate"]).toBe('{"date":"nonsense"}');
  });

  it("keeps a booking item undated rather than losing it to a bad window", () => {
    const doc = docFrom(
      EMPTY_RESERVATIONS +
        CARD(
          "Exams available for reservations",
          AVAILABLE_ROW(
            "CS 357 (Fa26): Quiz 2",
            '{"start":"2026-09-24T04:59:00.000Z","end":"2026-09-21T05:01:00.000Z"}',
          ),
        ),
    );
    const [item] = parseHome(doc, page);
    expect(item!.kind).toBe("booking");
    expect(item!.dueAt).toBeUndefined();
    expect(item!.extra?.["unparsedDateRange"]).toContain("2026-09-24");
    expect(item!.extra?.["windowStart"]).toBeUndefined();
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
    for (const bad of [
      "",
      "not json",
      "{}",
      '{"date":"tomorrow"}',
      '{"date":123}',
      // Date.parse accepts all of these; §3.2 does not.
      '{"date":"2026-09-11T02:00:00"}', // naive — a different instant per machine
      '{"date":"2026-09-11"}', // date-only — resolves to 7pm the previous day here
      '{"date":"Sep 11 2026 9:00 pm"}',
      '{"date":"2026-09-11T02:00:00+0500"}', // offset, but not RFC 3339
    ]) {
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
        EMPTY_AVAILABLE +
          CARD(
            "Exam reservations",
            `<li class="list-group-item">` +
              `<div class="col-1" data-testid="exam"><a href="${href}">CS 357 (Fa26): Quiz 1</a></div>` +
              `<div class="col-1" data-testid="date"><span data-format-date='{"date":"2026-09-11T02:00:00.000Z"}'>x</span></div>` +
              `</li>`,
          ),
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

describe("a student who has never signed in (§0 rule 2)", () => {
  it("is needs_login, not a broken page", () => {
    // 200 at the unchanged URL, a normal-looking title, and no exam cards — so
    // §4.4's missing-card guard threw and painted a red dot over a missing
    // session.
    expect(isLoginResponse(200, "https://us.prairietest.com/pt/", fixture("signed-out.html"))).toBe(
      true,
    );
  });

  it("is not fooled by a page that merely mentions the product", () => {
    // Adversarial for the same reason: "prairietest" appears in any URL on the
    // site, so a bare-substring marker would report every healthy sync as a
    // missing session. The marker is the auth *handoff path*, which only a
    // signed-out page has a reason to link to.
    const mentionsItself = fixture("home-booked-and-available.html").replace(
      "Quiz 1",
      "Quiz 1 — see us.prairietest.com for details",
    );
    expect(isLoginResponse(200, "https://us.prairietest.com/pt/", mentionsItself)).toBe(false);
  });

  it("does not call either real logged-in capture logged out", () => {
    for (const name of ["home-booked-none-available.html", "home-booked-and-available.html"]) {
      expect(
        isLoginResponse(200, "https://us.prairietest.com/pt/", fixture(name)),
        name,
      ).toBe(false);
    }
  });
});

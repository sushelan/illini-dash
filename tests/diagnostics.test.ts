/**
 * The diagnostics bundle. The property under test is what it does NOT contain:
 * it is meant to be safe to paste into a public GitHub issue.
 */

import { describe, expect, it } from "vitest";
import { buildDiagnostics, scrubError } from "../src/core/diagnostics.js";
import { emptyStore } from "../src/core/store.js";
import type { RawItem } from "../src/sources/types.js";

const NOW = new Date("2026-09-10T18:00:00.000Z");

function raw(partial: Partial<RawItem> & Pick<RawItem, "source" | "sourceId">): RawItem {
  return {
    courseRaw: "CS 357",
    courseCode: "CS357",
    title: "HW3 Errors and Big-O",
    kind: "assignment",
    url: "https://us.prairielearn.com/pl/course_instance/224254/assessment/1",
    status: "not_submitted",
    fetchedAt: "2026-09-10T13:00:00.000Z",
    ...partial,
  };
}

function input(overrides: Partial<Parameters<typeof buildDiagnostics>[0]> = {}) {
  const store = emptyStore();
  store.raw = {
    "prairielearn:224254:HW3": raw({
      source: "prairielearn",
      sourceId: "224254:HW3",
      dueAt: "2026-09-11T17:00:00-05:00",
    }),
    "canvas:assignment:9002": raw({
      source: "canvas",
      sourceId: "assignment:9002",
      title: "Homework 3",
    }),
  };
  return {
    store,
    buildId: "20260910T151000",
    extensionVersion: "0.1.0",
    browser: "Chrome/141.0.0.0",
    grantedOrigins: ["https://courses.grainger.illinois.edu/*"],
    alarms: ["sync", "notify:abc:24h", "notify:def:2h", "notify:def:booking"],
    notificationsBlocked: false,
    now: NOW,
    ...overrides,
  };
}

describe("what the bundle must not contain", () => {
  const report = JSON.stringify(buildDiagnostics(input()));

  it("carries no assignment titles", () => {
    expect(report).not.toContain("HW3 Errors and Big-O");
    expect(report).not.toContain("Homework 3");
  });

  it("carries no links to a student's own pages", () => {
    expect(report).not.toContain("course_instance");
    expect(report).not.toContain("224254/assessment");
  });

  it("scrubs the last error, rather than only offering a helper that could", () => {
    // The bundle has to actually call scrubError. `NeedsLogin` deliberately
    // carries 120 characters of the response body as evidence, which on a
    // logged-in page can be a name — right for the console, wrong for an issue.
    const dirty = input();
    dirty.store.sources.gradescope = {
      ...dirty.store.sources.gradescope,
      state: "needs_login",
      lastError:
        "401 at https://www.gradescope.com/account — Signed in as Jane Doe jdoe42@illinois.edu",
    };
    const out = JSON.stringify(buildDiagnostics(dirty));
    expect(out).not.toContain("Jane Doe");
    expect(out).not.toContain("jdoe42");
    expect(out).toContain("401");
  });

  it("keeps course codes, which are the catalog's and not the student's", () => {
    // Without them "one course contributes nothing" is unactionable.
    expect(report).toContain("CS357");
  });
});

describe("what the bundle answers", () => {
  const report = buildDiagnostics(input());

  it("says which sources worked, out of the ones being checked", () => {
    expect(report.health).toMatch(/^\d+\/\d+ ok$/);
  });

  it("breaks items down per course and per source", () => {
    // The table that answers "why is my list empty" without anyone reading out
    // a title: a course only one source knows about is visible at a glance.
    const cs357 = report.courses.find((c) => c.course === "CS357")!;
    expect(cs357.bySource).toEqual({ prairielearn: 1, canvas: 1 });
    expect(cs357.dated).toBe(1);
  });

  it("counts alarms by lead, so a missing reminder is visible", () => {
    expect(report.alarms.total).toBe(4);
    expect(report.alarms.byLead).toEqual({ sync: 1, "24h": 1, "2h": 1, booking: 1 });
  });

  it("reports whether Chrome is dropping notifications", () => {
    expect(buildDiagnostics(input({ notificationsBlocked: true })).notificationsBlocked).toBe(true);
  });

  it("reports granted origins, which decide whether an adapter can run", () => {
    expect(report.grantedOrigins).toEqual(["https://courses.grainger.illinois.edu/*"]);
  });
});

describe("scrubError", () => {
  it("drops the response body NeedsLogin quotes as evidence", () => {
    // On a logged-in page those 120 characters can be a name.
    const scrubbed = scrubError(
      "401 at https://www.gradescope.com/login — Signed in as Jane Doe jdoe42@illinois.edu Your Courses",
    )!;
    expect(scrubbed).toContain("<body omitted>");
    expect(scrubbed).not.toContain("Jane Doe");
    expect(scrubbed).not.toContain("jdoe42");
  });

  it("reduces a URL to its host, because the path carries ids", () => {
    const scrubbed = scrubError("parse error at https://us.prairielearn.com/pl/course_instance/224254")!;
    expect(scrubbed).toContain("us.prairielearn.com");
    expect(scrubbed).not.toContain("224254");
  });

  it("keeps the shape of the error, which is the useful part", () => {
    expect(scrubError("401 at https://x.test/a — body")).toContain("401");
  });

  it("passes undefined through", () => {
    expect(scrubError(undefined)).toBeUndefined();
  });
});

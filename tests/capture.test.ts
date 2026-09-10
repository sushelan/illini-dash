/**
 * The capture tool fetches whatever URL is typed into it, so the host allowlist
 * is the thing standing between a typo and the extension fetching the open web.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isAllowedCaptureUrl,
  isGrantedUpFront,
  originPattern,
  reportUrlFromHash,
} from "../src/capture.js";
import { probeMarkers } from "../src/core/markers.js";

describe("isAllowedCaptureUrl", () => {
  it("accepts the four source hosts and any illinois.edu subdomain", () => {
    for (const url of [
      "https://www.gradescope.com/courses/1352838",
      "https://canvas.illinois.edu/api/v1/courses",
      "https://us.prairielearn.com/pl/",
      "https://us.prairietest.com/pt/",
      "https://courses.grainger.illinois.edu/cs225/fa2026/",
    ]) {
      expect(isAllowedCaptureUrl(url), url).toBe(true);
    }
  });

  it("rejects other hosts, http, and junk", () => {
    for (const url of [
      "https://example.com/",
      "http://www.gradescope.com/",
      "https://gradescope.com.evil.test/",
      "https://notillinois.edu/",
      "not a url",
      "",
    ]) {
      expect(isAllowedCaptureUrl(url), url).toBe(false);
    }
  });
});

describe("host permissions for a capture (§2.3)", () => {
  it("knows which hosts the manifest already grants", () => {
    // The four sources are in host_permissions and fetch straight away.
    for (const url of [
      "https://www.gradescope.com/courses/1",
      "https://canvas.illinois.edu/api/v1/courses",
      "https://us.prairielearn.com/pl/",
      "https://us.prairietest.com/pt/",
    ]) {
      expect(isGrantedUpFront(url), url).toBe(true);
    }
  });

  it("knows which need a runtime grant, which is what CORS-blocked the capture", () => {
    // *.illinois.edu is optional_host_permissions, so without a grant the fetch
    // falls back to ordinary CORS rules and the browser blocks it — with an
    // error that says nothing about permissions.
    expect(isGrantedUpFront("https://courses.grainger.illinois.edu/cs424/fa2026/x.html")).toBe(
      false,
    );
    expect(isGrantedUpFront("https://cs.illinois.edu/x")).toBe(false);
    expect(isGrantedUpFront("not a url")).toBe(false);
  });

  it("builds the origin pattern chrome.permissions expects", () => {
    expect(originPattern("https://courses.grainger.illinois.edu/cs424/fa2026/secure/x.html")).toBe(
      "https://courses.grainger.illinois.edu/*",
    );
    // The path never widens or narrows the grant — it is per-origin.
    expect(originPattern("https://courses.grainger.illinois.edu/")).toBe(
      "https://courses.grainger.illinois.edu/*",
    );
  });
});

describe("probeMarkers", () => {
  it("reports which §4.3 markers a PrairieLearn assessments page contains", () => {
    const results = probeMarkers(
      "https://us.prairielearn.com/pl/course_instance/12345/assessments",
      `<td>100% until 23:59, Tue, Sep 8</td><td>Not started</td>`,
    );
    expect(results).toHaveLength(1);
    const byNeedle = Object.fromEntries(results[0]!.hits.map((h) => [h.needle, h.count]));
    expect(byNeedle["% until"]).toBe(1);
    expect(byNeedle["Not started"]).toBe(1);
    // Open question 1: absent in this sample, which is the answer we would record.
    expect(byNeedle["Access details"]).toBe(0);
    expect(byNeedle["data-bs-content"]).toBe(0);
  });

  it("counts repeats and matches nothing for an unrelated URL", () => {
    expect(
      probeMarkers("https://www.gradescope.com/courses/1", "table--primaryLink table--primaryLink")[0]!
        .hits.find((h) => h.needle === "table--primaryLink")!.count,
    ).toBe(2);
    expect(probeMarkers("https://example.com/", "anything")).toHaveLength(0);
  });
});

describe("probeMarkers against the real PrairieTest capture", () => {
  const html = readFileSync(
    new URL("../fixtures/prairietest/home-booked-none-available.html", import.meta.url),
    "utf8",
  );
  const hits = Object.fromEntries(
    probeMarkers("https://us.prairietest.com/pt/", html)[0]!.hits.map((h) => [h.needle, h.count]),
  );

  it("finds the row hooks and the machine-readable date (§12 Q2 evidence)", () => {
    expect(hits["data-format-date"]).toBeGreaterThan(0);
    expect(hits['data-testid="exam"']).toBeGreaterThan(0);
    expect(hits["/pt/student/reservation/"]).toBeGreaterThan(0);
  });

  it("records that no exam link and no available-card row exist in this capture", () => {
    // Both are load-bearing absences: §4.4 and §3.1 assume an exam id in the
    // href, and the booking pseudo-item has never been seen in real markup.
    expect(hits["Make a reservation"]).toBe(0);
    expect(hits["You don't currently have any exams available for reservations"]).toBe(1);
  });
});

describe("reportUrlFromHash", () => {
  it("accepts a page on a host the extension already reads", () => {
    expect(reportUrlFromHash("#report=" + encodeURIComponent("https://www.gradescope.com/courses/1"))).toBe(
      "https://www.gradescope.com/courses/1",
    );
  });

  it("refuses anything else, because a fragment is untrusted input", () => {
    // Any page can navigate to an extension page with any fragment, so the
    // options page validates rather than trusting whoever wrote it.
    for (const bad of [
      "https://evil.test/x",
      "http://www.gradescope.com/x",
      "javascript:alert(1)",
      "//other.host/x",
    ]) {
      expect(reportUrlFromHash("#report=" + encodeURIComponent(bad)), bad).toBeUndefined();
    }
  });

  it("does not throw on a malformed escape", () => {
    expect(() => reportUrlFromHash("#report=%E0%A4%A")).not.toThrow();
    expect(reportUrlFromHash("#report=%E0%A4%A")).toBeUndefined();
  });

  it("ignores an unrelated fragment", () => {
    expect(reportUrlFromHash("#settings")).toBeUndefined();
    expect(reportUrlFromHash("")).toBeUndefined();
  });
});

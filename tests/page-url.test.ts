/**
 * `src/core/page-url.ts` — the text a student typed, before any permission.
 *
 * Pure and DOM-free on purpose: the decision it makes used to live in three
 * `ui/options.ts` click handlers, where nothing could reach it.
 */

import { describe, expect, it } from "vitest";
import { normalizePageUrl } from "../src/core/page-url.js";

/** Narrowing helper: a rejection's sentence, or a failure naming what was accepted. */
function reasonFor(raw: string): string {
  const result = normalizePageUrl(raw);
  if (result.ok) throw new Error(`expected ${JSON.stringify(raw)} to be rejected, got ${result.url}`);
  return result.reason;
}

/** Narrowing helper: an acceptance's canonical URL. */
function urlFor(raw: string): string {
  const result = normalizePageUrl(raw);
  if (!result.ok) throw new Error(`expected ${JSON.stringify(raw)} to be accepted: ${result.reason}`);
  return result.url;
}

describe(
  'normalizePageUrl (finding I04: entering "not a url" into Settings\' "Read this page" ' +
    'answered "Chrome did not grant access to not a url, so it cannot be read." — ' +
    "no permission request ever happened; the string never parsed as a URL)",
  () => {
    describe("accepts a real web address, canonicalised", () => {
      it("keeps an https URL", () => {
        expect(urlFor("https://cs225.org/schedule")).toBe("https://cs225.org/schedule");
        expect(urlFor("https://courses.grainger.illinois.edu/ece411/fa2026/")).toBe(
          "https://courses.grainger.illinois.edu/ece411/fa2026/",
        );
      });

      it("keeps an http URL as http — it does not silently upgrade what was typed", () => {
        expect(urlFor("http://cs225.org/schedule")).toBe("http://cs225.org/schedule");
      });

      it("returns the canonical form, so the permission, the message and the text agree", () => {
        expect(urlFor("HTTPS://CS225.ORG/schedule")).toBe("https://cs225.org/schedule");
        expect(urlFor("  https://cs225.org/schedule  ")).toBe("https://cs225.org/schedule");
        expect(urlFor("https://cs225.org")).toBe("https://cs225.org/");
      });
    });

    describe("completes a scheme-less host", () => {
      it("prefixes https:// when the first segment looks like a host", () => {
        expect(urlFor("cs225.org/schedule")).toBe("https://cs225.org/schedule");
        expect(urlFor("courses.grainger.illinois.edu/ece411/fa2026/")).toBe(
          "https://courses.grainger.illinois.edu/ece411/fa2026/",
        );
      });

      it("prefixes https:// for a bare host with no path", () => {
        expect(urlFor("cs225.org")).toBe("https://cs225.org/");
      });

      it("reads a host and port as a host and port, not as a scheme", () => {
        // `cs225.org:8080` matches RFC 3986's scheme production as exactly as
        // `mailto:` does; calling it a scheme would reject it as a non-web one.
        expect(urlFor("cs225.org:8080/schedule")).toBe("https://cs225.org:8080/schedule");
      });
    });

    describe("rejects with a local reason — never Chrome's", () => {
      it("rejects the finding's own input", () => {
        expect(reasonFor("not a url")).toBe(
          "“not a url” is not a web address. Paste the page's full address, starting with https://.",
        );
      });

      it("rejects a bare word", () => {
        // The one input that reaches the "at least one dot" test: `not a url`
        // is refused for its spaces first. Without the dot, `schedule` becomes
        // `https://schedule/`, which `new URL` accepts.
        expect(reasonFor("schedule")).toBe(
          "“schedule” is not a web address. Paste the page's full address, starting with https://.",
        );
        expect(reasonFor("notaurl")).toContain("is not a web address");
      });

      it("rejects whitespace inside an otherwise-parseable URL", () => {
        // `new URL` would percent-encode the space and hand back a 404 in waiting.
        expect(reasonFor("https://cs225.org/sche dule")).toBe(
          "“https://cs225.org/sche dule” is not a web address. Paste the page's full address, starting with https://.",
        );
      });

      it("rejects a non-web scheme by name", () => {
        expect(reasonFor("javascript:alert(1)")).toBe(
          "Illini Dash can only read http(s) pages, not javascript: addresses.",
        );
        expect(reasonFor("file:///x")).toBe(
          "Illini Dash can only read http(s) pages, not file: addresses.",
        );
        expect(reasonFor("chrome://extensions")).toBe(
          "Illini Dash can only read http(s) pages, not chrome: addresses.",
        );
        expect(reasonFor("mailto:x")).toBe(
          "Illini Dash can only read http(s) pages, not mailto: addresses.",
        );
      });

      it("names the scheme lowercased, whatever was typed", () => {
        expect(reasonFor("MAILTO:x")).toBe(
          "Illini Dash can only read http(s) pages, not mailto: addresses.",
        );
      });

      it("rejects a scheme that is not a URL", () => {
        expect(reasonFor("https://")).toContain("is not a web address");
        expect(reasonFor("https://cs225.org:99999/x")).toContain("is not a web address");
      });

      it("rejects a protocol-relative address, whose host is not stated", () => {
        // Parser rule 7's `//other.host`: its first segment is empty, so it is
        // not a host, and prefixing would point at somewhere nobody typed.
        expect(reasonFor("//cs225.org/schedule")).toContain("is not a web address");
      });

      it("is total: the empty string is a rejection, not a throw or an accept", () => {
        expect(normalizePageUrl("")).toEqual({
          ok: false,
          reason: "Paste the page's full address, starting with https://.",
        });
        expect(normalizePageUrl("   ")).toEqual({
          ok: false,
          reason: "Paste the page's full address, starting with https://.",
        });
      });

      it("quotes at most 60 characters of the student's own text back at them", () => {
        // A status line in a 600px window is not a place to echo a paste.
        const long = `x${"y".repeat(200)}`;
        const reason = reasonFor(long);
        expect(reason).toContain(`“${`x${"y".repeat(59)}`}…”`);
        expect(reason).not.toContain(long);
        expect(reason.length).toBeLessThan(150);
      });

      it("never blames a permission for text that was never a URL (the finding)", () => {
        for (const bad of [
          "not a url",
          "schedule",
          "javascript:alert(1)",
          "file:///x",
          "chrome://extensions",
          "mailto:x",
          "https://",
          "",
        ]) {
          const reason = reasonFor(bad);
          expect(reason).not.toContain("Chrome");
          expect(reason).not.toContain("grant");
          expect(reason).not.toContain("permission");
        }
      });
    });
  },
);

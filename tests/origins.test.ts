/**
 * Which source a URL belongs to (`core/origins.ts`).
 *
 * This decides when a finished navigation counts as "they may have just signed
 * in", so a wrong answer here is either a source that never recovers or a fetch
 * on every page the student loads.
 */

import { describe, expect, it } from "vitest";
import { SOURCE_ORIGIN, sourceForUrl } from "../src/core/origins.js";

describe("sourceForUrl", () => {
  it("recognises each hosted source's own pages", () => {
    for (const [source, origin] of Object.entries(SOURCE_ORIGIN)) {
      expect(sourceForUrl(`${origin}/some/page?x=1`), origin).toBe(source);
      expect(sourceForUrl(`${origin}/`), origin).toBe(source);
    }
  });

  it("matches the host in full, not by suffix", () => {
    /*
     * Parser rule 6 one layer up. `endsWith("gradescope.com")` would accept
     * both of these, and the consequence is not cosmetic: this function decides
     * whether a page finishing in *any* tab makes the extension go and fetch.
     */
    // The one that is actually dangerous, and the one a plausible-looking test
    // misses: `notgradescope.com` does NOT end with `www.gradescope.com`, so a
    // suffix match passes a suite built only from names like that — it survived
    // exactly that way here. `evilwww.gradescope.com` does end with it.
    expect(sourceForUrl("https://evilwww.gradescope.com/")).toBeUndefined();
    expect(sourceForUrl("https://notgradescope.com/")).toBeUndefined();
    expect(sourceForUrl("https://www.gradescope.com.evil.test/")).toBeUndefined();
    expect(sourceForUrl("https://evil.test/?x=https://www.gradescope.com/")).toBeUndefined();
  });

  it("ignores a subdomain the extension has no permission for", () => {
    // `host_permissions` names `www.gradescope.com`, so Chrome would not reveal
    // this URL anyway — but a function that answers for it is one that has
    // stopped describing what this extension can actually read.
    expect(sourceForUrl("https://api.gradescope.com/")).toBeUndefined();
  });

  it("refuses anything that is not https", () => {
    expect(sourceForUrl("http://www.gradescope.com/")).toBeUndefined();
    expect(sourceForUrl("javascript:alert(1)//www.gradescope.com")).toBeUndefined();
  });

  it("survives a URL that will not parse", () => {
    // `tab.url` is whatever Chrome hands over, including "chrome://newtab" and,
    // on a torn-down tab, an empty string.
    for (const junk of ["", "not a url", "chrome://extensions", "about:blank"]) {
      expect(sourceForUrl(junk), junk).toBeUndefined();
    }
  });

  it("answers `site` for a course website that is switched on", () => {
    const hosts = ["courses.grainger.illinois.edu"];
    expect(
      sourceForUrl("https://courses.grainger.illinois.edu/cs424/fa2026/secure/schedule.html", hosts),
    ).toBe("site");
  });

  it("and not for one that is switched off", () => {
    // The host list is the *enabled* adapters, so a course site the student
    // never turned on does not make this extension fetch when they visit it.
    expect(sourceForUrl("https://courses.grainger.illinois.edu/ece310/fa2026/")).toBeUndefined();
  });
});

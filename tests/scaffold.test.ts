/** Proves the test harness (vitest + linkedom) works before any parser needs it. */

import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { looksLikeLoginUrl } from "../src/gate0.js";
import { memberKey, ParseError } from "../src/sources/types.js";

describe("test harness", () => {
  it("parses HTML with linkedom and queries it like a Document", () => {
    const { document } = parseHTML(
      `<table><tr role="row"><th class="table--primaryLink"><a href="/courses/1/assignments/2">MP1</a></th></tr></table>`,
    );
    const rows = document.querySelectorAll("tr th.table--primaryLink");
    expect(rows.length).toBe(1);
    expect(rows[0]!.textContent!.trim()).toBe("MP1");
  });
});

describe("gate0 helpers", () => {
  it("recognizes login/SSO landings", () => {
    expect(looksLikeLoginUrl("https://www.gradescope.com/login")).toBe(true);
    expect(looksLikeLoginUrl("https://shibboleth.illinois.edu/idp/profile")).toBe(true);
    expect(looksLikeLoginUrl("https://us.prairielearn.com/pl/")).toBe(false);
  });
});

describe("types", () => {
  it("builds memberKeys and has a loud parse error", () => {
    expect(memberKey("gradescope", "12345")).toBe("gradescope:12345");
    expect(new ParseError("no assignments table").name).toBe("ParseError");
  });
});

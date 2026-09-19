/**
 * `postUrl` — the thread a suggestion or a correction came out of.
 *
 * Every case here is one of house rules 5, 6 and 7 said about this function:
 * the shapes are matched with anchored regexes, the prefixes exactly, and the
 * answer is https on the source's own origin or it is `undefined`. Several of
 * the ids below are deliberately unrealistic (mutation rule 10 / house rule
 * 12): a realistic id makes a loosened regex indistinguishable from the right
 * one, and the whole risk of this function is a link that resolves and goes
 * somewhere else.
 */
import { describe, expect, it } from "vitest";
import { postUrl } from "../src/core/post-link.js";
import { CAMPUSWIRE_ORIGIN } from "../src/core/campuswire.js";
import { PIAZZA_ORIGIN } from "../src/core/piazza.js";
import { STUDENT_POST_ID } from "../src/core/overrides.js";

describe("postUrl", () => {
  it("addresses a Piazza post by its class and number", () => {
    // `piazza:<nid>:<nr>`, as `core/piazza.ts` builds it from the feed.
    expect(postUrl("piazza:k5p6s9m2d1x:412")).toBe(
      `${PIAZZA_ORIGIN}/class/k5p6s9m2d1x/post/412`,
    );
  });

  it("addresses a Campuswire post by its class code and number", () => {
    // `campuswire:<classCode>:<number>`, and the class code is what
    // `classCodeFromPath` read out of `/c/G794D32E4/feed`.
    expect(postUrl("campuswire:G794D32E4:682")).toBe(
      `${CAMPUSWIRE_ORIGIN}/c/G794D32E4/feed/682`,
    );
    // The two characters that function accepts beyond alphanumerics.
    expect(postUrl("campuswire:G7-94_D3:1")).toBe(`${CAMPUSWIRE_ORIGIN}/c/G7-94_D3/feed/1`);
  });

  it("answers nothing for a post with no page behind it", () => {
    // A pasted post never existed on a site this extension knows, and the
    // student's own correction is stamped `"student"` by `core/overrides.ts`.
    // Both must be `undefined` rather than a guess at a URL (house rule 6).
    expect(postUrl("paste:1758230000000")).toBeUndefined();
    expect(postUrl(STUDENT_POST_ID)).toBeUndefined();
    expect(postUrl(undefined)).toBeUndefined();
    expect(postUrl(42)).toBeUndefined();
  });

  it("refuses an empty part rather than building a URL that goes nowhere", () => {
    /*
     * House rule 5, in the form that costs a link instead of a field.
     * `"".length === 0` passes every truthiness check, and a `split(":")`
     * implementation answers `https://piazza.com/class//post/3` — which
     * parses, resolves, and lands on Piazza's class picker with no sign that
     * anything was lost.
     */
    expect(postUrl("piazza::3")).toBeUndefined();
    expect(postUrl("piazza:k5p6s9m2d1x:")).toBeUndefined();
    expect(postUrl("campuswire::682")).toBeUndefined();
    expect(postUrl("campuswire:G794D32E4:")).toBeUndefined();
    expect(postUrl("")).toBeUndefined();
  });

  it("is anchored at both ends, and matches the prefix exactly", () => {
    /*
     * Deliberately adversarial, and none of these can appear in a real store
     * — which is the point (house rule 12). An unanchored `piazza:(\\w+):(\\d+)`
     * matches every one of them, and each produces a link to a host this
     * extension has no business sending anyone to.
     */
    expect(postUrl("notpiazza:abc:1")).toBeUndefined();
    expect(postUrl("https://evil.example/piazza:abc:1")).toBeUndefined();
    expect(postUrl("piazza:abc:1 ")).toBeUndefined();
    expect(postUrl("piazza:abc:1/../../evil")).toBeUndefined();
    expect(postUrl("piazza:abc:1#x")).toBeUndefined();
    expect(postUrl("PIAZZA:abc:1")).toBeUndefined();
    expect(postUrl("campuswire:G1:2:3")).toBeUndefined();
  });

  it("refuses a part that could not have come from a parser", () => {
    // An id off a store an older or newer build wrote is data, not a typed
    // value (worker rule 8). A path separator or a host in the class slot is
    // how a "link to the post" becomes a link to somewhere else.
    expect(postUrl("piazza:a/b:1")).toBeUndefined();
    expect(postUrl("piazza:evil.example:1")).toBeUndefined();
    expect(postUrl("campuswire:a/b:1")).toBeUndefined();
    expect(postUrl(`piazza:${"a".repeat(41)}:1`)).toBeUndefined();
    expect(postUrl("piazza:abc:1234567890")).toBeUndefined();
  });

  it("only ever answers https on the source's own origin (house rule 7)", () => {
    for (const id of ["piazza:k5p6s9m2d1x:412", "campuswire:G794D32E4:682"]) {
      const url = new URL(postUrl(id)!);
      expect(url.protocol).toBe("https:");
      expect([new URL(PIAZZA_ORIGIN).host, new URL(CAMPUSWIRE_ORIGIN).host]).toContain(url.host);
    }
  });
});

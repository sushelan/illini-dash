/**
 * The round-trip parser is a pure function over a Document, so it runs here under
 * linkedom exactly as it runs in the offscreen document — the property every real
 * parser depends on (§2.1).
 */

import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { parseRoundtrip } from "../src/sources/roundtrip.js";
import { ParseError, type PageCtx } from "../src/sources/types.js";

const page: PageCtx = {
  url: "https://example.invalid/roundtrip",
  fetchedAt: "2026-09-03T00:00:00.000Z",
};

function doc(html: string): Document {
  return parseHTML(html).document as unknown as Document;
}

describe("parseRoundtrip", () => {
  it("returns one RawItem per row, preserving title and datetime", () => {
    const items = parseRoundtrip(
      doc(`<ul id="items">
             <li data-id="a1"><span class="title">MP1: Sound</span><time datetime="2026-09-09T17:00:00-05:00"></time></li>
             <li data-id="a2"><span class="title">Quiz 1</span></li>
           </ul>`),
      page,
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      sourceId: "a1",
      title: "MP1: Sound",
      dueAt: "2026-09-09T17:00:00-05:00",
      url: page.url,
      fetchedAt: page.fetchedAt,
    });
    expect(items[1]!.dueAt).toBeUndefined();
  });

  it("throws when the list is missing", () => {
    expect(() => parseRoundtrip(doc(`<p>nothing here</p>`), page)).toThrow(ParseError);
  });

  it("throws rather than returning [] when the list is present but empty (§0 rule 3)", () => {
    expect(() => parseRoundtrip(doc(`<ul id="items"></ul>`), page)).toThrow(ParseError);
  });

  it("throws when a row is missing its title", () => {
    expect(() => parseRoundtrip(doc(`<ul id="items"><li data-id="x"></li></ul>`), page)).toThrow(
      ParseError,
    );
  });
});

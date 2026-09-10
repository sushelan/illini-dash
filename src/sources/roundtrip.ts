/**
 * Trivial parser used to prove the offscreen round-trip (§10 step 3).
 *
 * It is not a source parser and never runs during a sync. It parses a made-up
 * markup shape so the plumbing can be exercised before any real fixture exists,
 * and it obeys the same contract every real parser will (§0 rule 3): a page with
 * the expected structure but zero rows is a ParseError, not an empty array.
 *
 *   <ul id="items">
 *     <li data-id="1"><span class="title">MP1</span><time datetime="…"></time></li>
 *   </ul>
 */

import { ParseError, type ParseFn, type RawItem } from "./types.js";

export const ROUNDTRIP_PARSER_ID = "__roundtrip";

export const parseRoundtrip: ParseFn = (doc, page): RawItem[] => {
  const list = doc.querySelector("#items");
  if (!list) throw new ParseError("no #items list");

  const rows = Array.from(list.querySelectorAll("li"));
  if (rows.length === 0) throw new ParseError("#items present but no rows");

  return rows.map((row, index): RawItem => {
    const title = row.querySelector(".title")?.textContent?.trim();
    if (!title) throw new ParseError(`row ${index} has no .title`);
    const due = row.querySelector("time")?.getAttribute("datetime") ?? undefined;
    return {
      source: "site",
      sourceId: row.getAttribute("data-id") ?? String(index),
      courseRaw: "Round-trip test",
      title,
      kind: "other",
      dueAt: due,
      url: page.url,
      status: "unknown",
      fetchedAt: page.fetchedAt,
    };
  });
};

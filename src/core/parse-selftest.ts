/**
 * End-to-end check of the offscreen round-trip (§10 step 3), run from the
 * service worker so it exercises the real message boundary rather than a mock.
 *
 * Three cases, because the plumbing has to carry results *and* failures: a good
 * page returns items, a structurally-empty page raises ParseError (§0 rule 3),
 * and an unknown parser id raises a plain Error.
 */

import { parseHtml } from "./offscreen-client.js";
import { ROUNDTRIP_PARSER_ID } from "../sources/roundtrip.js";
import type { ParserId } from "../sources/registry.js";
import type { SelftestCase } from "../messages.js";
import { ParseError, type PageCtx } from "../sources/types.js";

const PAGE: PageCtx = {
  url: "https://example.invalid/roundtrip",
  fetchedAt: new Date(0).toISOString(),
};

const POPULATED = `<!doctype html><html><body><ul id="items">
  <li data-id="a1"><span class="title">MP1: Sound</span><time datetime="2026-09-09T17:00:00-05:00"></time></li>
  <li data-id="a2"><span class="title">Quiz 1</span></li>
</ul></body></html>`;

const EMPTY = `<!doctype html><html><body><ul id="items"></ul></body></html>`;

export async function runParseSelftest(): Promise<SelftestCase[]> {
  const cases: SelftestCase[] = [];

  cases.push(
    await check(
      "round-trip returns items",
      "2 RawItems, titles and dueAt preserved",
      async () => {
        const items = await parseHtml(ROUNDTRIP_PARSER_ID, POPULATED, PAGE);
        if (items.length !== 2) throw new Error(`expected 2 items, got ${items.length}`);
        if (items[0]?.title !== "MP1: Sound") throw new Error(`title was ${items[0]?.title}`);
        if (items[0]?.dueAt !== "2026-09-09T17:00:00-05:00") {
          throw new Error(`dueAt was ${items[0]?.dueAt}`);
        }
        if (items[1]?.dueAt !== undefined) throw new Error("undated row gained a date");
        return `${items.length} items: ${items.map((i) => i.title).join(", ")}`;
      },
    ),
  );

  cases.push(
    await checkThrows(
      "empty rows raise ParseError",
      "ParseError crosses the message boundary as a ParseError",
      () => parseHtml(ROUNDTRIP_PARSER_ID, EMPTY, PAGE),
      (err) => err instanceof ParseError,
    ),
  );

  cases.push(
    await checkThrows(
      "unknown parser id raises Error",
      "a plumbing bug is not mistaken for a parse error",
      () => parseHtml("nope" as ParserId, POPULATED, PAGE),
      (err) => err instanceof Error && !(err instanceof ParseError),
    ),
  );

  for (const c of cases) console.log(`[selftest] ${c.passed ? "PASS" : "FAIL"} ${c.name}: ${c.detail}`);
  return cases;
}

async function check(
  name: string,
  expectation: string,
  run: () => Promise<string>,
): Promise<SelftestCase> {
  try {
    return { name, expectation, passed: true, detail: await run() };
  } catch (err) {
    return { name, expectation, passed: false, detail: describe(err) };
  }
}

async function checkThrows(
  name: string,
  expectation: string,
  run: () => Promise<unknown>,
  accept: (err: unknown) => boolean,
): Promise<SelftestCase> {
  try {
    await run();
    return { name, expectation, passed: false, detail: "did not throw" };
  } catch (err) {
    return { name, expectation, passed: accept(err), detail: describe(err) };
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

/**
 * How much prose the Settings page is allowed to carry.
 *
 * Sushi, 2026-09-20: "can u make the settings less text heavy." It had grown
 * 1,035 words — a 6,000px column in which every control explained itself in
 * two or three sentences, so the sentence that actually mattered (the one
 * beside the switch you were reaching for) was indistinguishable from the four
 * around it. The trim took it to ~740.
 *
 * Prose grows back one well-meant sentence at a time, and no existing test
 * could see it happen, so this is the budget: a caption says what a control
 * does, and the reasoning goes behind a `<details class="why">`, which is the
 * disclosure the page already uses and which this deliberately does not cap.
 *
 * **Static copy only.** The generated rows (`src/ui/options.ts`) are not in
 * this file, and a DOM test for them would need the whole options entry
 * booted; `tests/preview-acceptance.test.ts` is where that would go if it is
 * ever worth it. What is here is the half that is a document, which is also
 * the half where the long paragraphs were.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/options.html", import.meta.url), "utf8");

/**
 * The page with every disclosure taken out.
 *
 * The cap is on what a student reads *without asking* — a `<details>` is the
 * place long copy is supposed to go, so capping the words inside one would
 * make the rule "write less" rather than "put it behind the summary". The
 * report box's own 22-word explanation of why it wants a NetID is the case
 * that proves it: it is long, it is necessary, and it is read at the moment it
 * applies and at no other.
 */
const visible = html.replace(/<details[\s\S]*?<\/details>/g, "");

/** The text of every element carrying `class="… <name> …"`, whitespace collapsed. */
function textOf(name: string): { text: string; words: number }[] {
  const out: { text: string; words: number }[] = [];
  const open = new RegExp(`<(p|span)[^>]*class="[^"]*\\b${name}\\b[^"]*"[^>]*>`, "g");
  for (const match of visible.matchAll(open)) {
    const start = match.index! + match[0].length;
    const end = visible.indexOf(`</${match[1]}>`, start);
    const text = visible
      .slice(start, end)
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text !== "") out.push({ text, words: text.split(" ").length });
  }
  return out;
}

/**
 * The cap. 20 words is two short lines at this column width — enough for "what
 * this does and the one consequence", and not enough for a paragraph.
 */
const MAX_WORDS = 20;

describe("the Settings page's copy budget (2026-09-20)", () => {
  it("keeps every section lede to a caption", () => {
    const long = textOf("lede").filter((entry) => entry.words > MAX_WORDS);
    expect(
      long.map((entry) => `${entry.words} words: ${entry.text.slice(0, 60)}…`),
      "a lede over the cap belongs in a <details class=\"why\">",
    ).toEqual([]);
  });

  it("keeps every row caption to a caption", () => {
    const long = textOf("srow2--hint").filter((entry) => entry.words > MAX_WORDS);
    expect(
      long.map((entry) => `${entry.words} words: ${entry.text.slice(0, 60)}…`),
      "a hint over the cap belongs in a <details class=\"why\"> or on the control's title",
    ).toEqual([]);
  });

  it("still carries the long explanations, behind disclosures", () => {
    /*
     * The other half of the budget, and the reason it is not simply "write
     * less": nothing was deleted. The privacy statement in particular is the
     * same text as the store's privacy answers and `docs/store/privacy-policy.md`,
     * and it now sits inside a `<details>` rather than at the top of the
     * section as a 92-word paragraph.
     *
     * Counted, not merely present: a page that answers this test by dropping
     * its disclosures would be a page that cut the explanations instead of
     * moving them.
     */
    const disclosures = [...html.matchAll(/<details class="why"/g)].length;
    expect(disclosures).toBeGreaterThanOrEqual(5);
    // The privacy paragraph's slot, which `options.ts` fills at render, is one
    // of them now. If it ever moves back out, this fails with the lede cap.
    const privacy = html.indexOf('id="privacy"');
    expect(privacy).toBeGreaterThan(0);
    const before = html.lastIndexOf("<details", privacy);
    const closed = html.lastIndexOf("</details>", privacy);
    expect(before, "the privacy statement is inside a disclosure").toBeGreaterThan(closed);
  });
});

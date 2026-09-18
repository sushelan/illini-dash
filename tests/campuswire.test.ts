/**
 * `core/campuswire.ts` — the class feed as the browser renders it.
 *
 * Over `fixtures/campuswire/feed-ece408-sp26.html`, which is a real capture:
 * the whole point of this source is that there is no server HTML to fetch, so
 * the rendered DOM is the only evidence there will ever be.
 *
 * Two kinds of case appear below. The ones over the fixture unchanged say what
 * the real page produces. The ones that edit the DOM first are deliberate and
 * unrealistic (parser house rules 10 and 12): the trimmed capture happens to
 * contain no repeated post number and no broken preview, so a parser that
 * emitted duplicates or silently dropped a malformed row would pass every
 * assertion made against the capture as it stands.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import {
  ASSUMED_HOUR,
  classCodeFromPath,
  describeObserver,
  isClassFeed,
  parseFeed,
  postsToSend,
  type ObservedPost,
} from "../src/core/campuswire.js";
import { ingestPost } from "../src/core/suggest.js";
import { ParseError, type Item, type Overrides, type RawItem } from "../src/sources/types.js";

const HTML = readFileSync(
  new URL("../fixtures/campuswire/feed-ece408-sp26.html", import.meta.url),
  "utf8",
);

const PAGE = { classCode: "G794D32E4", observedAt: "2026-09-18T12:00:00-05:00" };

/** A fresh document each time, so a test that edits the DOM cannot leak. */
function feed(): Document {
  return parseHTML(HTML).document as unknown as Document;
}

function posts(doc: Document = feed()): ObservedPost[] {
  return parseFeed(doc, PAGE);
}

function byNumber(number: number, doc?: Document): ObservedPost {
  const found = posts(doc).find((post) => post.number === number);
  expect(found, `#${number} was not parsed`).toBeDefined();
  return found!;
}

describe("parseFeed over the real feed", () => {
  it("reads every preview on the page, in both shapes", () => {
    /*
     * Ten `.post-preview-wrapper` elements, ten distinct post numbers: seven in
     * the list (two of them in the pinned block) and three more in the hidden
     * "at a glance" column, which is a second shape for the same kind of thing.
     *
     * AMENDMENT (house rule 9), recorded in docs/campuswire-findings.md: the
     * fixture's own README says "trimmed from 54 previews to nine" and
     * describes the pinned block and the glance column as repeating posts from
     * the list. Neither is true of the capture as committed — it holds ten
     * previews and ten distinct numbers, and the glance column's three posts
     * (#567, #534, #597) appear nowhere else on the page. The capture wins, so
     * the duplicate-collapsing rule is pinned by a constructed case below
     * instead of by this one.
     */
    expect(posts().map((post) => post.number)).toEqual([
      682, 680, 679, 675, 645, 640, 638, 567, 534, 597,
    ]);
  });

  it("names each post by class and number, never by DOM position", () => {
    expect(byNumber(682).id).toBe("campuswire:G794D32E4:682");
  });

  it("tells an announcement from a question by the tooltip, exactly", () => {
    // "This is a note" is an announcement; "This question is resolved" is not.
    expect(byNumber(682).kind).toBe("note");
    expect(byNumber(679).kind).toBe("question");
    expect(posts().filter((post) => post.kind === "question").map((p) => p.number)).toEqual([679]);
  });

  it("does not accept a tooltip that merely contains the word", () => {
    /*
     * DELIBERATELY UNREALISTIC (parser house rules 10 and 12). Every tooltip on
     * the real page is either "This is a note" or "This question is …", and
     * neither `=== NOTE_TOOLTIP` nor `.includes("note")` can be told apart by
     * them — a substring match survives the whole capture untouched.
     *
     * House rule 6 is the rule this pins, and it was found twice before: "not
     * submitted" contains "submitted". A question whose tooltip mentions notes
     * must not become an announcement, because a note is what reaches the
     * deadline pipeline.
     */
    const doc = feed();
    const question = [...doc.querySelectorAll(".post-preview-wrapper")].find(
      (node) => node.querySelector(".post-ref")?.textContent === "#679",
    )!;
    question
      .querySelector(".post-type-icon")!
      .setAttribute("data-tippy-content", "This question is resolved — see the pinned notes");
    expect(byNumber(679, doc).kind).toBe("question");
  });

  it("reads the list shape's date, which has a like count glued to it", () => {
    // `.post-time` collapses to "005/17/26": the like count, an empty clock
    // icon, then the date. Reading the element's text and hunting for a date
    // inside it is what this case exists to refuse.
    expect(byNumber(682).postedAt).toBe("2026-05-17T12:00:00-05:00");
  });

  it("reads the glance shape's date, which is written out in a sentence", () => {
    expect(byNumber(567).postedAt).toBe("2026-04-28T12:00:00-05:00");
  });

  it("marks noon as assumed, because a preview states no clock", () => {
    // Worker rule 3: a value this code invented is not one Campuswire stated.
    expect(ASSUMED_HOUR).toBe(12);
    for (const post of posts()) {
      expect(post.postedAt, `#${post.number}`).toMatch(/T12:00:00[+-]\d{2}:\d{2}$/);
      expect(post.extra.timeAssumed, `#${post.number}`).toBe(true);
    }
  });

  it("carries the class as the sidebar names it, and §5.1's code from it", () => {
    expect(byNumber(645).courseHint).toBe("ECE 408: Applied Parallel Programming");
    expect(byNumber(645).courseCode).toBe("ECE408");
  });

  it("keeps the body whole, Markdown and all", () => {
    expect(byNumber(645).text).toContain("extend the final deadline of CNN project to 11:59pm today");
    expect(byNumber(682).text).toContain("**5/18 at 12:00 PM**");
  });

  it("keeps the title separate from the body", () => {
    expect(byNumber(645).title).toBe("Proj-CNN Mini Extension");
  });
});

describe("one post, however many times the page draws it", () => {
  /**
   * The capture has no repeated number, so the duplicate is constructed.
   *
   * On the live page the pinned block and the glance column repeat posts from
   * the list — that is what `fixtures/campuswire/README.md` describes and what
   * the trim removed. A parser keyed on the DOM node rather than the number
   * would emit the same deadline twice here and `seenPosts` could not stop it,
   * because each copy would have to invent its own id.
   */
  function withDuplicateOf(number: number): { doc: Document; clone: Element } {
    const doc = feed();
    const original = [...doc.querySelectorAll(".post-preview-wrapper")].find(
      (node) => node.querySelector(".post-ref")?.textContent === `#${number}`,
    );
    expect(original, `#${number} is not in the fixture`).toBeDefined();
    const clone = original!.cloneNode(true) as Element;
    original!.parentElement!.append(clone);
    return { doc, clone };
  }

  it("is one post", () => {
    const { doc } = withDuplicateOf(682);
    expect(doc.querySelectorAll(".post-preview-wrapper").length).toBe(11);
    expect(posts(doc).filter((post) => post.number === 682).length).toBe(1);
    expect(posts(doc).length).toBe(10);
  });

  it("keeps the first rendering, so the result does not depend on draw order", () => {
    const { doc, clone } = withDuplicateOf(682);
    clone.querySelector(".post-text")!.textContent = "REDRAWN";
    expect(byNumber(682, doc).text).not.toBe("REDRAWN");
  });

  it("refuses one number wearing two different posts", () => {
    // Parser house rule 4's real case. Keeping the first silently would merge
    // two announcements into one and lose the other with no error.
    const { doc, clone } = withDuplicateOf(682);
    clone.querySelector(".post-title h3")!.textContent = "Something else entirely";
    expect(() => parseFeed(doc, PAGE)).toThrow(ParseError);
    expect(() => parseFeed(doc, PAGE)).toThrow(/#682 appears twice/);
  });
});

describe("what makes this parser throw", () => {
  it("a feed container with nothing in it — silent empty is the worst outcome", () => {
    // House rule 2: a class feed that renders no previews is a redesign, not a
    // class nobody has posted in. `[]` here would freeze the list silently.
    const doc = feed();
    for (const node of doc.querySelectorAll(".post-preview-wrapper")) node.remove();
    expect(doc.querySelector(".posts-list-wrap")).not.toBeNull();
    expect(() => parseFeed(doc, PAGE)).toThrow(ParseError);
    expect(() => parseFeed(doc, PAGE)).toThrow(/changed shape/);
  });

  it("a preview with no post number", () => {
    const doc = feed();
    doc.querySelector(".post-ref")!.remove();
    expect(() => parseFeed(doc, PAGE)).toThrow(/no \.post-ref/);
  });

  it("a post number that is not a number", () => {
    // Not a bad value that costs its own field: this is the identity, and a
    // post with no id would re-apply its correction on every page load.
    const doc = feed();
    doc.querySelector(".post-ref")!.textContent = "#recent";
    expect(() => parseFeed(doc, PAGE)).toThrow(/post number is unreadable/);
  });

  it("a preview with no title", () => {
    const doc = feed();
    doc.querySelector(".post-title h3")!.remove();
    expect(() => parseFeed(doc, PAGE)).toThrow(/no \.post-title h3/);
  });

  it("a preview with no note-or-question marker", () => {
    /*
     * The most dangerous hook to soften. Defaulting an absent marker to
     * "question" drops every announcement on the page with nothing on screen to
     * say so; defaulting it to "note" feeds the grammar every classmate's guess.
     */
    const doc = feed();
    doc.querySelector(".post-type-icon[data-tippy-content]")!.removeAttribute("data-tippy-content");
    expect(() => parseFeed(doc, PAGE)).toThrow(/nothing left to tell a note from a question/);
  });

  it("a preview with neither date element", () => {
    const doc = feed();
    doc.querySelector(".post-time")!.remove();
    doc.querySelector(".post-preview-wrapper .author-name")?.remove();
    expect(() => parseFeed(doc, PAGE)).toThrow(/neither \.post-time nor \.author-name/);
  });

  it("a document that is not a class feed at all", () => {
    const doc = parseHTML("<main id='main-content'><div class='chat'></div></main>")
      .document as unknown as Document;
    expect(isClassFeed(doc)).toBe(false);
    expect(() => parseFeed(doc, PAGE)).toThrow(/not a class feed/);
  });

  it("a page whose class code the URL did not give up", () => {
    // `campuswire::682` would collide across every class the student is in.
    expect(() => parseFeed(feed(), { ...PAGE, classCode: "" })).toThrow(/class code/);
  });
});

describe("a date it cannot read costs its own field", () => {
  function withDate(text: string): ObservedPost {
    const doc = feed();
    const time = doc.querySelector(".post-time")!;
    time.textContent = text;
    return byNumber(682, doc);
  }

  it("keeps the post and records the raw text", () => {
    // House rule 1: the hook is there, the value is not readable. Dropping the
    // post would lose an announcement over a change in a footer.
    const post = withDate("last Tuesday");
    expect(post.number).toBe(682);
    expect(post.postedAt).toBeUndefined();
    expect(post.extra.unparsedDate).toBe("last Tuesday");
    expect(post.extra.timeAssumed).toBeUndefined();
  });

  it("refuses a date that does not exist", () => {
    // House rule 5: an anchored shape is not a real date. `13/40/26` matches
    // MM/DD/YY and is nothing.
    expect(withDate("13/40/26").postedAt).toBeUndefined();
    expect(withDate("13/40/26").extra.unparsedDate).toBe("13/40/26");
  });

  it("does not let the rest of the page pay for it", () => {
    const doc = feed();
    doc.querySelector(".post-time")!.textContent = "sometime";
    expect(posts(doc).length).toBe(10);
    expect(byNumber(680, doc).postedAt).toBe("2026-05-16T12:00:00-05:00");
  });
});

describe("the offset is computed for the date, not assumed", () => {
  it("is CST in January and CDT in May", () => {
    const doc = feed();
    doc.querySelector(".post-time")!.textContent = "01/14/26";
    expect(byNumber(682, doc).postedAt).toBe("2026-01-14T12:00:00-06:00");
    expect(byNumber(680).postedAt).toBe("2026-05-16T12:00:00-05:00");
  });
});

describe("classCodeFromPath", () => {
  it("reads a feed path", () => {
    expect(classCodeFromPath("/c/G794D32E4/feed")).toBe("G794D32E4");
    expect(classCodeFromPath("/c/G794D32E4")).toBe("G794D32E4");
    expect(classCodeFromPath("/c/G794D32E4/post/682")).toBe("G794D32E4");
  });

  it("refuses everything else, rather than returning an empty string", () => {
    for (const path of ["/", "/settings", "/classes", "/xc/ABC/feed", "//c/ABC/feed"]) {
      expect(classCodeFromPath(path), path).toBeUndefined();
    }
  });
});

describe("which posts reach the deadline pipeline", () => {
  it("notes only, by default", () => {
    /*
     * Sushi's decision: a student asking "is HW3 due Friday?" has not stated a
     * deadline, and `announce.ts` reads words, not authorship.
     */
    const plan = postsToSend(posts());
    expect(plan.payloads.map((p) => p.id)).not.toContain("campuswire:G794D32E4:679");
    expect(plan.payloads.length).toBe(9);
    expect(plan.skipped).toEqual([
      { number: 679, reason: "a question, not an announcement" },
    ]);
  });

  it("questions too, behind the flag", () => {
    const plan = postsToSend(posts(), { includeQuestions: true });
    expect(plan.payloads.length).toBe(10);
    expect(plan.skipped).toEqual([]);
  });

  it("never sends a post whose date it could not read", () => {
    // Every relative phrase in the post resolves against `postedAt`, so sending
    // one without it would anchor the grammar on a date this code picked.
    const doc = feed();
    doc.querySelector(".post-time")!.textContent = "sometime";
    const plan = postsToSend(posts(doc));
    expect(plan.payloads.map((p) => p.id)).not.toContain("campuswire:G794D32E4:682");
    expect(plan.skipped).toContainEqual({
      number: 682,
      reason: 'its date is unreadable ("sometime")',
    });
  });

  it("puts the title in front of the body, on its own line", () => {
    // An instructor routinely puts the only subject in the title.
    const payload = postsToSend(posts()).payloads.find((p) => p.id.endsWith(":645"))!;
    expect(payload.text.startsWith("Proj-CNN Mini Extension\n")).toBe(true);
    expect(payload.source).toBe("campuswire");
    expect(payload.courseHint).toBe("ECE 408: Applied Parallel Programming");
    expect(payload.postedAt).toBe("2026-05-04T12:00:00-05:00");
  });
});

describe("what the Settings row is allowed to say", () => {
  const NOW = new Date("2026-09-18T15:00:00-05:00");

  it("says Off when it is off", () => {
    expect(describeObserver({ enabled: false }, NOW)).toBe("Off");
    expect(describeObserver(undefined, NOW)).toBe("Off");
  });

  it("never claims a reading for a switch that was merely flipped", () => {
    // Worker rule 2: a green dot means "I read a page, and it was fine".
    expect(describeObserver({ enabled: true }, NOW)).toBe("On · nothing read yet");
    expect(describeObserver({ enabled: true, postsSeen: 0 }, NOW)).toBe("On · nothing read yet");
  });

  it("counts what actually arrived", () => {
    const line = describeObserver(
      { enabled: true, lastObservedAt: "2026-09-18T10:32:00-05:00", postsSeen: 3 },
      NOW,
    );
    expect(line).toMatch(/^On · last read .+ · 3 posts$/);
    expect(describeObserver(
      { enabled: true, lastObservedAt: "2026-09-18T10:32:00-05:00", postsSeen: 1 },
      NOW,
    )).toMatch(/· 1 post$/);
  });
});

/* -------------------------------------------------------------------------- */
/* Feed → notes → core/suggest.ts                                              */
/* -------------------------------------------------------------------------- */

const NO_OVERRIDES: Overrides = {
  mergeGroups: [],
  splitKeys: [],
  hiddenKeys: [],
  disabledCourses: [],
  doneKeys: [],
  keptCourses: [],
  courseNames: {},
  dueOverrides: {},
};

function member(partial: Partial<RawItem> & Pick<RawItem, "source" | "sourceId">): RawItem {
  return {
    courseRaw: "ECE 408",
    courseCode: "ECE408",
    title: "Thing",
    kind: "assignment",
    status: "not_submitted",
    fetchedAt: "2026-05-17T12:00:00-05:00",
    ...partial,
  };
}

/** What an ECE 408 student would have from Gradescope in the first week of May. */
function items(): Item[] {
  const make = (title: string, dueAt: string, sourceId: string): Item => ({
    id: title,
    members: [member({ source: "gradescope", sourceId, title })],
    courseCode: "ECE408",
    courseLabel: "ECE408",
    title,
    kind: "assignment",
    dueAt,
    status: "not_submitted",
    hidden: false,
    done: false,
    notified: {},
  });
  return [
    make("CNN Project Milestone 3", "2026-05-01T23:59:00-05:00", "m3"),
    make("CNN Competition", "2026-05-04T23:59:00-05:00", "comp"),
  ];
}

describe("the feed, end to end, through core/suggest.ts", () => {
  /*
   * When a student reading this class would have seen these posts.
   *
   * It was 2026-09-18 — the day the page was captured — until `ingestPost`
   * learned that "a mention whose instant is earlier than the moment it was
   * read is not something to ADD" (G1, from the first live Piazza sync, where
   * three of seven suggestions were for deadlines already gone). This feed is
   * from *May*, so read on 18 September every one of its deadlines is history
   * and the pipeline below correctly produces nothing at all. The date moves to
   * the week before the earliest post (#534, 04/24) so the file goes on
   * measuring what it was written to measure.
   */
  const NOW = "2026-04-24T09:00:00-05:00";

  function ingestAll() {
    const plan = postsToSend(posts());
    const suggestions: { postId: string; title: string; at: string; span: string }[] = [];
    const moves: Record<string, string> = {};
    const seen: Record<string, string> = {};
    for (const payload of plan.payloads) {
      const out = ingestPost(
        { items: items(), overrides: NO_OVERRIDES, suggestions: [], seenPosts: seen },
        payload,
        NOW,
      );
      Object.assign(seen, out.seenPosts);
      for (const [key, entry] of Object.entries(out.dueOverrides)) moves[key] = entry.at;
      for (const s of out.suggestions) {
        suggestions.push({ postId: s.postId, title: s.title, at: s.at, span: s.span });
      }
    }
    return { suggestions, moves, seen };
  }

  it("turns #682's 'due tomorrow' into a suggestion anchored on the post's own day", () => {
    /*
     * The noon convention earning its keep: `postedAt` is 05/17 at 12:00, so
     * "tomorrow" is the 18th. At 00:00 or 23:59 the same sentence is one
     * timezone step away from landing on the 17th or the 19th.
     *
     * The sentence restates the day with a clock — "due tomorrow, **5/18 at
     * 12:00 PM** (noon) CDT" — so the span covers both and the reading is the
     * stated noon, not the 23:59 this code would otherwise have invented.
     * `tests/announce-real.test.ts` works the instant out by hand.
     */
    const found = ingestAll().suggestions.find((s) => s.postId === "campuswire:G794D32E4:682");
    expect(found).toBeDefined();
    expect(found!.span).toBe("tomorrow, **5/18 at 12:00 PM");
    expect(found!.at).toBe("2026-05-18T12:00:00-05:00");
  });

  it("reads #567's 'extended to May 11'", () => {
    /*
     * Wave 4 changed this from a suggestion to a move: the sentence's subject
     * reads as "CNN competition" now instead of "", so `resolveMentions`
     * matches the student's own "CNN Competition" row and the 0.85 reading
     * clears `AUTO_MOVE_CONFIDENCE`.
     */
    const { moves, suggestions } = ingestAll();
    expect(suggestions.find((s) => s.postId === "campuswire:G794D32E4:567")).toBeUndefined();
    expect(moves["gradescope:comp"]).toBe("2026-05-11T23:59:00-05:00");
  });

  it("moves the two rows this student already has, and suggests the rest", () => {
    /*
     * This assertion used to read `expect(moves).toEqual({})`, above a comment
     * recording the open question: "`announce.ts` extracts an empty `subject`
     * from every sentence on this page, so `resolveMentions` can never match an
     * existing item … if the grammar is taught to read these, this test fails
     * and says so, which is the point." It was taught, in wave 4, and this is
     * what it says now.
     *
     * Milestone 3 lands on May 4 and not May 1: #534 states both, the later is
     * the one it calls "the final deadline", and the last mention in a post
     * wins. The competition moves to May 11 from #567. What is left over is
     * genuinely new — regrade windows and a form, none of which Gradescope
     * knows about — plus #597's exam sitting, which does not match the "Exam 2"
     * row because §5.2 fuses a numbered badge into one token (`exam2`) and the
     * sentence says only "exam".
     */
    const { moves, suggestions } = ingestAll();
    expect(moves).toEqual({
      "gradescope:m3": "2026-05-04T23:59:00-05:00",
      "gradescope:comp": "2026-05-11T23:59:00-05:00",
    });
    expect(suggestions.map((s) => s.postId).sort()).toEqual([
      "campuswire:G794D32E4:597",
      "campuswire:G794D32E4:675",
      "campuswire:G794D32E4:680",
      "campuswire:G794D32E4:682",
    ]);
  });

  it("reads each post once, whatever the page redraws", () => {
    const first = ingestAll();
    const again = ingestPost(
      { items: items(), overrides: NO_OVERRIDES, suggestions: [], seenPosts: first.seen },
      postsToSend(posts()).payloads[0]!,
      NOW,
    );
    expect(again.suggestions).toEqual([]);
    expect(again.skipped[0]!.reason).toMatch(/already read/);
  });
});

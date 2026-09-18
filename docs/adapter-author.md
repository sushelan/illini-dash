# When nothing is proposed: the on-device model

*Decision by Sushi, 2026-09-18.*

"Add a course site" in Settings reads a page and proposes an adapter for it. The
proposer in `src/core/detect.ts` is a search, not a model: every column of every
table crossed with every supported date format, kept when enough rows parse. It
is deterministic, mutation-testable, needs no download and works on every
machine — and it is the answer whenever it has one.

It does not always have one. CS 424's schedule has no header row, uses `rowspan`
so cells shift between rows, and packs two events into one cell. For pages like
it the honest answer has been "this needs a hand-written entry", which means
waiting for one person to read the markup — the bottleneck the self-serve flow
exists to remove.

So when the search returns nothing, and only then, Chrome's built-in model is
asked. What it proposes is run through the real runner on the page that was just
fetched, and the student confirms it by reading the rows it extracted.

## The shape

| Step | Where | What |
|---|---|---|
| Fetch the page | `background.ts` → `capture` | Unchanged. The HTML now comes back with the candidates (`htmlForAuthoring`), so nothing is fetched twice |
| Propose deterministically | offscreen → `core/detect.ts` | Unchanged. Candidates → the existing preview |
| **Summarise the page** | `core/skeleton.ts` | `skeletonise(doc, budgetChars)` — tags, ids, classes, table structure; scripts, styles, nav and footer dropped |
| **Ask** | `core/author.ts` + `ui/options.ts` | `buildPrompt` → `LanguageModel.prompt(text, { responseConstraint })` |
| **Check** | `core/author.ts` | `validateProposal` → `validateAdapter` + `runAdapter`, on the real DOM |
| Confirm | `ui/options.ts` | The same `renderCandidates` preview, "Use this one", "Copy for sharing" |

`core/author.ts` is model-agnostic: `authorAdapter` takes its prompt function as
an argument, so the whole ask-reject-retry loop is tested against recorded
strings with no model anywhere near the suite.

## Rules this feature is held to

1. **It never runs in the sync loop.** One click, in Settings, on a page the
   student pasted. Nothing here is on the path a deadline travels.
2. **Its absence is exactly today's behaviour.** The Prompt API needs 22GB of
   free disk and either a 4GB GPU or 16GB of RAM, so most student laptops will
   report `unavailable`. When the API is missing, or reports `unavailable`, or
   throws, the page says what it said before this existed. `downloadable` and
   `downloading` are stated in one line, because "there is a thing that could
   have tried" is a different answer from "nothing found".
3. **The model is asked for selectors, never for values.** A date it read off
   the page would be a value this code invented (worker rule 3), ranked above a
   real Canvas deadline by §5.3 and impossible to audit. It names a row selector
   and two column *headers*; `parseAdapterDate` reads them, the same code as
   everywhere else. It is asked for headers rather than `td:nth-child(2)` for
   house rule 3's reason: a positional cell turns one added column into a page
   of mis-dated items with no error.
4. **Its answer clears the same trust boundary a published adapter clears.**
   `validateAdapter` first — so `dateFormat` is one of the closed set, the host
   pattern is exactly the page's own host, and a host the extension already
   holds is refused — then `runAdapter`, then: at least one row, at least half
   of them dated, no `extra.unparsed*`, no empty titles. Anything else is a
   rejection whose reason is fed back for the next attempt, at most three.
5. **Nothing is saved without the student.** The preview shows the instants the
   extension recorded, not the text the page printed, because a column that
   reads plausibly and parses to the wrong day is exactly what a person who
   takes the course can see and nothing else can.
6. **The model's output is untrusted text.** It reaches the DOM only through
   `textContent`, like every other source-derived string (§8.1).

## The manifest needs no new permission

The Prompt API has been stable for extensions since **Chrome 138** and is
exposed to extension pages and workers with **no manifest entry at all**. The
old `aiLanguageModelOriginTrial` permission belonged to the origin trial that
ended; adding it now is an unknown permission, which Chrome rejects — the
extension fails to load. `manifest.json` is unchanged by this feature, and it
must stay that way.

`LanguageModel` is not in `@types/chrome`, so it is declared locally in
`src/types/language-model.d.ts`. Every call site is behind
`"LanguageModel" in self`.

## The context window

About 9,216 tokens, **shared between the prompt and the answer**, and read from
`session.contextWindow` at runtime rather than hard-coded — the number is a
property of whatever model Chrome shipped that week. `skeletonBudgetChars`
reserves 16% of it for the output, assumes ~4 characters per token, and
subtracts the fixed prompt text. A summary one token over the window is a
`QuotaExceededError` instead of an answer.

`skeletonise` treats that budget as a hard cap, and gives each table on the page
an equal share of it rather than filling up in document order. ECE 310 is why:
its homework table is *last*, after two staff tables, two timetables and an
18-week syllabus grid, and a summary that truncated in document order would
spend the whole budget on office hours and drop the one table with deadlines in
it. A model shown a page with no schedule on it answers anyway.

The selector it prints for each table is scoped `tbody tr` where there is a
`tbody`, because `table tr` also matches the header row: read through a
`columns.title` of "Exercises", `<th>Exercises</th>` comes back as an *undated
assignment called "Exercises"* that no course ever set.

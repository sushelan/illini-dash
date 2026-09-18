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

**Amended 2026-09-18.** The first version of this could only propose a header
table — `rows` + `columns` + `dateFormat` — while `runAdapter` had, the same
morning, gained `dueLabel`, `titleFrom` and `time` for ECE 411's page, whose
deadlines are `<li>`s reading `Due: 9/7` under an `<h3>` and which has no table
on it at all. Sushi pasted exactly that page in and got "Asking the on-device
model…" followed by the generic sentence about tables: the model ran, its
outcome was hidden, and it could not have succeeded anyway. Both halves of that
are fixed below — the three shapes, and the status line.

## The shape

| Step | Where | What |
|---|---|---|
| Fetch the page | `background.ts` → `capture` | Unchanged. The HTML now comes back with the candidates (`htmlForAuthoring`), so nothing is fetched twice |
| Propose deterministically | offscreen → `core/detect.ts` | Unchanged. Candidates → the existing preview |
| **Inventory the page** | `core/skeleton.ts` | `repeatedStructures(doc)` — the page's repeated element groups, each with a selector that has been run and matched |
| **Summarise the page** | `core/skeleton.ts` | `skeletonise(doc, budgetChars)` — tags, ids, classes, table structure; scripts, styles, nav and footer dropped |
| **Ask** | `core/author.ts` + `ui/options.ts` | `buildPrompt` → `LanguageModel.prompt(text, { responseConstraint })`, with `rows` enumerated from the inventory |
| **Ground** | `core/author.ts` | `groundProposal` — every selector checked against the DOM, before the runner is paid for |
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
   and, depending on the shape, two column *headers*, two row-relative selectors
   or a set of `dueLabel` labels copied off the page; `parseAdapterDate` reads
   what they point at, the same code as everywhere else. A selector that picks
   by position is refused outright, for house rule 3's reason: a positional cell
   turns one added column into a page of mis-dated items with no error.
4. **Its answer clears the same trust boundary a published adapter clears.**
   `validateAdapter` first — so `dateFormat` is one of the closed set, the host
   pattern is exactly the page's own host, a host the extension already holds is
   refused, `kind` is one of the registry's six and `filter.exclude` compiles —
   then `runAdapter`, then: at least one row, at least half of them dated, no
   `extra.unparsed*`, no empty titles, and not a filter that removed every row.
   Anything else is a rejection whose reason is fed back for the next attempt,
   at most three. The candidate handed to the preview is built out of the
   *validated adapter*, and `adapterFromCandidate` carries every one of its
   fields into the saved entry — it used to write `columns` and nothing else,
   so a validated `dueLabel` was dropped on the way to the store.
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

## One session per attempt, and what `kErrorUnknown` meant

The budget above is sized for an **empty** window, so every attempt has to start
from one. A `LanguageModel` session keeps its history: `authorAdapter` retries,
and prompting the same session a second time sent attempt 1's prompt, attempt
1's answer, *and* the whole of `base` — skeleton plus inventory — again. Attempt
2 was therefore about twice the budget, and Chrome answered it by throwing.

That is what Sushi saw on the ECE 411 assignments page on 2026-09-18:

> Chrome's built-in model tried 2 attempts and its last proposal read no
> deadlines: An unknown error occurred: kErrorUnknown

Two separate defects in one line. `kErrorUnknown` is the on-device model's
generic failure and it was, here, an overflowed context window — not a bad
proposal. And the sentence around it was wrong about what had happened at all:
`AuthorOutcome` had one failure branch, so `proposeWithModel` mapped every
`!ok` to `{ state: "rejected", reason: reason ?? failed }`, and a *throw* was
announced as a proposal that read no deadlines. There was no proposal. The
first live run survived three attempts only because that page's summary was
small enough to fit twice.

Both are fixed in the same place. `proposeWithModel` creates one pristine
session and hands `authorAdapter` a prompt function that `clone()`s it per
attempt, prompts the clone and destroys it — `clone()` copies the initial
prompts (the system half) and none of the conversation. Besides the budget, a
retry that could read its own previous answer is a retry tempted to repeat it,
when a different answer is the entire request. `AuthorOutcome` now carries a
`kind` of `"threw"` or `"rejected"`, and `modelOutcomeFor` — in `core/`, where
a test can reach it — maps the first to `ModelOutcome`'s `"failed"` state,
which has had the right sentence since it was written and had never been
reached from this path.

Two smaller things came with it. The retry suffix quotes the validator's reason,
and some reasons interpolate the page's whole inventory, so the quote is capped
at `MAX_RETRY_REASON_CHARS` (300) and `RETRY_SUFFIX_CHARS` is subtracted from
the skeleton budget up front — a long rejection can no longer push a retry over
the window. And `authorAdapter` takes an `onAttempt` callback, which the options
page logs as `[author] attempt N: rejected (prompt 8,421 chars, answer 96
chars) — …`, with `inputUsage`/`inputQuota` after each attempt where the session
exposes them. The live run left exactly one line behind, and "the answer was
bad" and "the prompt did not fit" have opposite fixes.

## The three shapes it may propose

The model states which shape it saw, and the shape decides which fields it may
name. They are the three `runAdapter` reads, and no others — `docs/adapters.md`
describes each one as a hand-written entry.

| `shape` | The page | What it names |
|---|---|---|
| `table` | a table with a header row | `rows`, `columns.title`, `columns.due`, optional `columns.link` |
| `list` | `Label: value` bullets under a heading | `rows`, `title`, `due`, `dueLabel`, optional `titleFrom`, optional `time` |
| `rows` | repeated blocks, no header row | `rows`, `title`, `due` |

Any of the three may also carry `kind` (`assignment`, `exam`, `quiz`, `event`,
`other`) and `filter.exclude`, a regular expression for the lines a course
leaves reading TBD, TBA or N/A. ECE 411's own page is nine of eleven lines like
that, and without the filter those nine arrive as undated rows — two dated out
of eleven is under the half the validator requires, so a *correct* proposal for
that page is rejected without one.

`shape` is not decoration. A proposal carrying both a table's `columns` and a
list's `dueLabel` is half of one answer and half of another: `runAdapter` reads
`columns` and ignores the rest, so the preview would come from the table while
the saved entry carried both. Naming the shape lets the validator refuse that in
one line, and it is the cheapest signal that the model read the page rather than
pattern-matched a table onto it.

### A selector the page has not got is refused before the runner

Live, 2026-09-18, on the public ECE 411 page: *"Chrome's built-in model tried 3
attempts and its last proposal read no deadlines: adapter proposed: no rows
matched `#schedule .event`"*. Nothing on that page is called `#schedule` or
`.event`. It was the example selector in this file's own system prompt, for a
different course — the nearest thing to a `rows` value anywhere in the model's
context, with nothing saying it belonged to another page. Three round trips of a
ten-second model call were spent on it.

Three changes, and none of them is "ask the model more nicely":

1. **The page says what it has.** `repeatedStructures(doc)` returns up to twelve
   repeated element groups — `#mp-information ul.simple > li ×16`, `#homework
   table tbody tr ×13` — each with a selector that was run against the document
   and matched the count printed beside it. That list goes in the first prompt
   and in every retry. The groups that read like schedule rows (a date, or a
   `Label: value`) come first, because the cap is twelve and a page has dozens;
   ordering by selector length was measured and it cut both of the answers above.
2. **`rows` is an enum of that list** in the JSON Schema, so a constrained decode
   cannot spell `#schedule .event`. The per-row selectors stay free text: their
   right answer is any tag, class or `tag@attribute` inside one row, and an enum
   guessed for them would exclude correct answers — which costs the page, where a
   wrong answer costs an attempt.
3. **Every selector is checked against the DOM** before `runAdapter` is called.
   `rows` must match at least one element and each row-relative selector must
   reach something from at least one row; the rejection names what the page
   *does* have, so the retry has somewhere to go. The examples in the system half
   now read `"rows": "ROWS"` — no real selector from any course is left in the
   prompt for a model to copy.

`modelStatusLine` says this failure differently, because it sends a person
somewhere different: *its proposals named parts of the page that do not exist
(last: `#schedule .event`)*, not *its last proposal read no deadlines*, which is
an invitation to go looking for deadlines that were never in question.

Two rejections are worth naming because they are house rules, not preferences:

- **A positional selector is refused**, not merely discouraged in the prompt.
  `p:nth-child(2)` is right until the course adds a bullet, and then every MP is
  dated from its release line with no error anywhere (house rule 3). `rows` is
  exempt: the summary itself offers `table:nth-of-type(2)` as a table's handle,
  and picking the second table on a page is not picking the second cell of a row.
- **A label is matched exactly.** `Due Date` contains `Due`; a substring match
  would hand `mp_pipeline` a deadline off a line the adapter never asked for,
  with nothing on the page looking wrong. The fixture
  `ece411-fa2026-assignments-dated.html` prints both lines deliberately, and the
  test that reads it is what pins the exact match.

`kind` and `filter.exclude` are checked by `validateAdapter` — the same gate a
published registry entry clears — rather than by a second copy of those rules
here. A `kind` this file waved past would reach `Item.kind` as a value no
`switch` in the UI has a branch for, and `examBoard` filters on it.

## The summary has to show a list, not mention one

`core/skeleton.ts` used to give tables 75% of the budget and render everything
else as flat outline lines. On a page whose schedule *is* a list, that gave the
model no `rows` selector to name, no sign that the `<h3>` above the bullets is
where `titleFrom` points, and the bullets themselves were the first thing a
tight budget dropped.

Labelled lists are now peers of tables in the same structure budget, and a LIST
block prints what a proposal needs:

```
LIST ul.simple
  rows selector: #mp-setup ul.simple > li
  every list like it: #mp-information ul.simple > li (5 lists)
  heading: h3 mp_setup
  titleFrom: section >> h3
  inside: div.body > section#assignments > section#mp-information > section#mp-setup
  LI | Release: 8/25
  LI | Due: 9/7
```

`every list like it` is there because the handle nearest one MP is `#mp-setup`,
and an adapter built on it silently covers a sixth of the course; the shipped
`ece411-fa26-mp` entry uses the wider selector.

A list qualifies only if it has two `<li>`s, half of them reading `Label:
value`, a heading above it to take a name from, and at least one value shaped
like a date. The last of those is the same test `detect.ts` applies to a table's
column: ECE 310's "Recommended Textbook: Applied Digital Signal Processing" is a
labelled list under a heading, and a share of the budget spent on it is rows of
the one table with deadlines in it dropped.

## What the student is told

Every end of this branch has a sentence, and `core/author.ts`'s
`modelStatusLine` decides which — in `core/`, because the options page is one of
the two files the suite cannot reach (worker rule 1) and because the defect this
replaces was three branches that said nothing.

| What happened | The status line |
|---|---|
| A proposal survived the runner | *Chrome's built-in model proposed an entry (N attempts).* Then the preview |
| It answered, and nothing it proposed read a deadline | *Chrome's built-in model tried N attempts and its last proposal read no deadlines: `<the validator's reason>`* |
| It answered, and named selectors the page has not got | *…its proposals named parts of the page that do not exist (last: `<the selector>`). A hand-written entry can still be written for it.* |
| `availability()` is not `available`, or the API is missing or throws | *Chrome's built-in model is not available on this computer.* |
| The model is downloadable, or downloading | One line saying which, because "there is a thing that could have tried" is a different answer from "nothing found" |
| The page was too large to summarise | *That page was too large to summarise for Chrome's built-in model.* |
| The session or the prompt threw | *…could not be used on this page: `<the message>`* — reached via `AuthorOutcome`'s `kind: "threw"`, never merged into the row above |

The deterministic search's own reason — why *it* found nothing — is printed
underneath, as a muted line, whenever no proposal survived. Both facts, in the
order they happened. Before this, the search's sentence was the status line and
the model's outcome was nothing at all.

`noCandidateReason`'s no-table sentence changed with it: it used to end "it is a
list rather than a table — those need a hand-written entry", which stopped being
true the morning `dueLabel` landed.

## Checking the three lines without a model

The Prompt API needs 22GB of free disk and either a 4GB GPU or 16GB of RAM, so
on most machines the only reachable branch is the one that says the model is
missing — which is how a model running and saying nothing went unnoticed.
`npm run preview` takes a switch:

```
dist/preview-options.html?model=ok       a proposal that validates, then the preview
dist/preview-options.html?model=fail     three answers that read no deadlines
dist/preview-options.html?model=absent   no model on this computer
```

The stub is installed with `Object.defineProperty` and a setter that ignores
writes, because Chrome installs the real `LanguageModel` on the window *after*
the page's own scripts run and plain assignment was silently overwritten — the
harness was measuring the machine it ran on rather than the branch it was asked
for.

One thing the switch cannot check is a real model's answer. That needs Sushi, on
the machine where `LanguageModel.availability()` returns `"available"`.

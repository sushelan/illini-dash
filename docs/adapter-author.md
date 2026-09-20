# When nothing is proposed: the on-device model

*Decision by Sushi, 2026-09-18.*

"Add a course site" in Settings reads a page and proposes an adapter for it. The
proposer in `src/core/detect.ts` is a search, not a model: it crosses the page's
own repeated element groups with the six ways `runAdapter` can locate a row's
date, and runs the real runner on every crossing that clears its thresholds. It
is deterministic, mutation-testable, needs no download and works on every
machine — and it is the answer whenever it has one.

**Amended 2026-09-20.** Until then it read **two page shapes** — a header table,
and a labelled list of `Due: 9/7` bullets — and three public UIUC course pages
students are in fell outside both. The paragraph here used to name CS 424 as the
page no search could reach: no header row, `rowspan` shifting cells between
rows, two events in one cell. It reaches it now, and CS 425 and ECE 374 A with
it, because "where is this row's date" is a *value* in the adapter rather than a
shape in the proposer (`docs/adapters.md`). A seventh page shape is no longer a
change to this file; a seventh **locator** is a field, a branch in `locateDue`
and a probe.

It still does not always have an answer, and the pages that defeat it now are
the ones whose deadlines are built by JavaScript after the page loads, or that
have a single deadline on them and so repeat nothing.

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
| **Inventory the page** | offscreen → `core/skeleton.ts` | `repeatedStructures(doc, timezone, reference)` — the page's repeated element groups, each with a selector that has been run and matched, a count, a sketch of one row's insides, how many of its rows carry a date, and **`locators`: every hook that reaches its dates, measured with `locateDue`** |
| Propose deterministically | offscreen → `core/detect.ts` | `searchCandidates` — each group × each of its locators, thresholded, built into a trial adapter and run through the real `runAdapter`; ranked and deduped by the rows they produce. Candidates → the existing preview, plus `nearest` for the failure sentence |
| **Summarise the page** | `core/skeleton.ts` | `skeletonise(doc, budgetChars)` — tags, ids, classes, table structure; scripts, styles, nav and footer dropped |
| **Ask** | `core/author.ts` + `ui/options.ts` | `buildPrompt` → `LanguageModel.prompt(text, { responseConstraint })`, with `rows` enumerated from the inventory and every key the validator can demand required |
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
name. `docs/adapters.md` describes each one as a hand-written entry.

**The model branch is untouched as of 2026-09-20, and these are still three.**
The deterministic search above no longer has page shapes at all, but
`core/author.ts`, `buildPrompt`, `proposalSchema` and `validateProposal` do —
they were not changed when the locators landed, so a model **cannot** propose
`duePrev`, `duePhrase`, `dueSlot`, `titleSlot`, `titleBefore` or `defaultTime`.
It does not need to for any page seen so far: every page that used to fall
through to the model is now read by the search, which is the branch that runs
first. Teaching the schema the locators is a later change, and it costs a
prompt, an enum per field and a round of live runs — the search reaching those
pages is what made it not urgent rather than what made it unnecessary.

Every answer carries the same six keys — `shape`, `rows`, `title`, `due`,
`dueLabel`, `dateFormat` — and the shape decides what two of them *mean* and
which are `""`:

| `shape` | The page | `title` / `due` | also |
|---|---|---|---|
| `table` | a table with a header row | the two columns' header **text** | optional `link` (a column header), `dueLabel` is `""` |
| `list` | `Label: value` bullets under a heading | selectors inside one bullet, or `""` for the bullet's own text | `dueLabel` required, optional `titleFrom`, optional `time` |
| `rows` | repeated blocks, no header row | selectors inside one block, or `""` for the block's own text | `dueLabel` is `""`, optional `time` |

`""` means "this shape has no use for this field", and for `title`/`due` on a
list or a rows page it means "the row's own text" — which the validator turns
into the runner's `.`, so nothing empty ever reaches the registry.

Any of the three may also carry `kind` (`assignment`, `exam`, `quiz`, `event`,
`other`) and `filter.exclude`, a regular expression for the lines a course
leaves reading TBD, TBA or N/A. ECE 411's own page is nine of eleven lines like
that, and without the filter those nine arrive as undated rows — two dated out
of eleven is under the half the validator requires, so a *correct* proposal for
that page is rejected without one.

`shape` is not decoration. A proposal carrying both a table's headers and a
list's `dueLabel` is half of one answer and half of another: `runAdapter` reads
`columns` and ignores the rest, so the preview would come from the table while
the saved entry carried both. Naming the shape lets the validator refuse that in
one line, and it is the cheapest signal that the model read the page rather than
pattern-matched a table onto it.

### The schema requires what the validator will demand

Live, 2026-09-18, ECE 411 again: *"Chrome's built-in model tried 3 attempts and
its last proposal read no deadlines: shape `"rows"` needs title"*. Three
attempts, every one the `rows` shape with no `title`, and the retry quoted that
sentence back twice without the model ever adding the key.

It could not. `proposalSchema` required `["shape", "rows", "dateFormat"]`, and
*which* fields each shape needs was decided in `validateProposal`, which the
model never sees. **A constrained decode emits exactly the keys the schema
requires and nothing it does not**, so the retry was asking for a key the
decoder was not allowed to write; no wording can fix that.

Chrome's `responseConstraint` takes flat JSON Schema — `type`, `enum`,
`properties`, `required`, `items` — so the per-shape conditional cannot be
expressed there (and three branching `oneOf` sub-schemas make a small model
answer worse where they are honoured at all). The requirement is therefore flat
and the meaning is per shape, stated in the prompt and in each field's
`description`.

The invariant, pinned by a test that generates the minimal object the schema
permits for each shape: **no proposal that satisfies the schema can be rejected
for a missing key — only for a wrong value.** A rejection a retry can act on is
one about a value it chose, so `shape "table": title must be the header text of
the column holding the assignment name, copied exactly from the page` replaces
`shape "table" needs columns`.

`columns` is gone from the model's vocabulary for the same reason: it was a key
whose absence was the commonest rejection and whose name the model had no other
use for. The validator assembles `columns` from `title`/`due` for a table, so
`Candidate` and the saved registry entry are unchanged.

### The inventory sketches one row's insides

`title` and `due` are selectors *relative to one row*, and the structures list
named the groups without ever showing what a row contains — so every row-relative
answer was a guess at markup the model had not been shown. Each entry now carries
one, from the first matching element:

```
#mp-information ul.simple > li  ×16  dated 4/16 (12 TBD) (label "Due|CP1 Due|CP2 Due|CP3 Due|Advance Features Due")  inside one row: p  e.g. "Due: 9/7"
#mp-information > section  ×5  dated 2/5 (3 TBD)  inside one row: h3, ul.simple  e.g. "mp_setup Release: 8/25 Due: 9/7"
```

Tags and classes, deduplicated (three `<p>`s are one answer), at most six of
them and 64 characters, with `text` last when the row states something of its
own — which is what makes `""` a visible option rather than a trick. A rejected
attempt gets the line again above "Answer again": `Inside one #mp-information
ul.simple > li row: p.`, clipped inside the same reserve `RETRY_SUFFIX_CHARS`
already budgets for.

### The attempt line says what the model emitted

`[author] attempt 1: rejected — answered shape "rows" with keys [shape, rows,
dateFormat] — …`. The keys are read off the answer, so the live run above would
have said in its first line that three keys arrived every time — the schema's
fingerprint rather than the model's mistake — instead of costing a night to
work out.

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

**Both halves of a scoped spec are compiled.** The probe used to compile only
the part before `>>`, so the inner half of `section >> h3:` went straight into
`row.closest(scope)?.querySelector(inner)` with no try — and a `SyntaxError`
there escaped `groundProposal`, `validateProposal` *and* `authorAdapter`'s loop.
That is not a rejection with a reason, it is the end of the run: the remaining
attempts lost, the model never told what was wrong, and `Expected name, found :`
— a CSS-parser message — shown to a student on a page the model answered
correctly on its second try. `section >> h3` is the literal example the prompt
gives, so a truncated copy of it is the likeliest small-model slip. House rule 1
one level up: a bad value costs its own proposal, never the run.

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

## The inventory says which groups carry dates, and the search reads them

*2026-09-19, from three live runs on the same page. Extended 2026-09-20, when
the search stopped having page shapes.*

ECE 411's assignments page went to the model three times, one build apart, and
never produced a row:

1. *"tried 3 attempts … no rows matched `#schedule .event`"* — an example
   selector from another course, fixed by the inventory and the grounding above.
2. *"shape \"rows\" needs title"* — fixed by making the schema demand what the
   validator demands.
3. *"its last proposal read no deadlines: only 1 of 3 rows carried a readable
   date"* — schema-valid, grounded, reaching the runner, and still wrong.

The third is the interesting one. The proposals were legal; the model simply
kept choosing a small group. The inventory it was shown, in order, was `li ×39`,
`ul > li ×37`, `#assignments ul.simple > li ×20`, `#mp-information ul.simple >
li ×16`, … — the right answer fourth, and **nothing anywhere saying which groups
actually had dates in them**. Ordering was row-likeness, then count, so a bare
`li` covering the whole page outranked the one group covering the course.

### Every group now says how much of it is dated

`RepeatedStructure.dated` is `{ rows, of, pending, sample, format, label? }`,
measured with `parseAdapterDateParts` — the reader `runAdapter` uses — and not
with a regex of the inventory's own. A tail the reader cannot consume counts as
*not* dated, because `validateProposal` refuses exactly that: a group counted
dated here that the runner would reject is a line pointing the model at a dead
end.

- **`pending` is TBD, TBA and N/A**, counted apart from undated. Both shipped
  entries drop those lines with `filter.exclude`, and a deadline the course has
  not set is not a line this read wrongly. It is the difference between reading
  ECE 411's MPs as *4 of 16* (a bad guess) and as *4 of 4 stated* (a term that
  has barely started), and the whole ordering turns on it.
- **`label` is the `dueLabel` convention**, every label ending in the word
  *due*: `Due|CP1 Due|CP2 Due|CP3 Due|Advance Features Due`, character for
  character what `ece411-fa26-mp` carries. Taken from *every* row rather than
  only the dated ones, because every checkpoint reads TBD today and a label list
  built from the dated lines would stop covering the course the moment one got a
  date. `Due Date` does not end in *due* and is not taken (house rule 6).
- **The sample is a line carrying that label.** The group's first dated line is
  `Release: 8/25`, which parses exactly as cleanly as a deadline and is not one.

The list is then ordered by **dated rows out of stated rows**, then by how many,
then by the old row-likeness and count. On ECE 411 `#mp-information ul.simple >
li` goes first; on ECE 310 `#homework table tbody tr` (13 of 13) goes above the
schedule table (13 of 34) — in both cases the selector a person wrote by hand.

### The retry names the groups that do carry dates

A rejection about dates now carries `dateProblem` — a flag, not a sentence to
match — and the retry appends, under the quoted reason:

```
Groups on this page that do carry dates: #mp-information ul.simple > li (4 of 16 dated, label "Due|CP1 Due|…"); …
```

Top three, capped at `MAX_DATED_NOTE_CHARS` and inside `RETRY_SUFFIX_CHARS`, so
the next answer is a copy rather than another search. It costs the page summary
about two rows; the reserve's test now allows a fifteenth of the smallest window
instead of a twentieth, and says why.

### And the deterministic proposer reads the whole page itself

`searchCandidates` takes each inventory group, each hook `locatorEvidence`
measured on it, and asks three questions before the runner is paid for:

- **at least `MIN_DATED_ROWS` (2) rows dated.** One stray "9/11" is not a
  schedule, and "1 of 1" is a 100% hit rate with a single sample behind it.
- **the share.** A named column needs `MIN_DATED_SHARE` (half) of the table's
  data rows, and placeholders count against it. Every other hook needs
  `MIN_HOOKED_SHARE` (**80%**) of the rows *it reached*, minus the ones that
  read TBD. Stricter for a reason: a column is named by the page's own header,
  so "most of it parses" confirms a choice the page made, while a label, a
  keyword, a preceding sibling or a `<time>` tag has nothing behind it but the
  fact that those lines read as dates.
- **what it builds is buildable.** A label candidate needs a `titleFrom` — the
  heading over the rows — because a row in a list has no name of its own and
  §3.1 hashes the title, so three rows titled "Due" collide on one `sourceId`.
  A grid candidate needs a column whose cells say "due" on the dated rows;
  without that page-side evidence the search would offer the column beside the
  date, which on CS 424 is the lecture topic.

Then the trial adapter goes through the **real runner** on the real page: at
least one row kept, no row kept with an empty name, and — for every hook but a
named column — no kept row whose value it could not read. A placeholder is not
such a value: `Due Date: TBD` is a deadline the course has not set, and read as
an unreadable one it refuses the whole page the week before a course fills one
in. A named column is exempt because a schedule has section breaks, "no class"
weeks and the odd note, and refusing a table over one of them refuses most real
schedules.

What survives is ranked — `dated`, then the share of what it keeps, then
**specificity** (a named column 6, a declared label 5, a preceding sibling 4, a
keyword 3, a `<time>` tag 2, a grid slot 1), then the narrowest group — and
deduped by the `(title, dueAt)` pairs it produced, so the same deadlines reached
through `li` and through `#mp-information ul.simple > li` are one proposal and
the narrower spelling is the one kept. A reading that finds a proper subset of a
kept one's rows goes too, within its own kind.

Over the real captures, every proposal lands on the entry a person wrote:

| Page | Hook | Proposal | Against |
|---|---|---|---|
| ECE 310 index | header | `#homework table tbody tr`, "due date" / "exercises" | 13 of 13 rows |
| ECE 411 assignments | label | the same sixteen `<li>`s as `ece411-fa26-mp`, *by element identity* | its two rows |
| CS 425 assignments | phrase | `duePhrase: "due"`, `titleBefore: ":"` | `cs425-fa26`'s eight |
| ECE 374 A homeworks / GPS | prev | `duePrev: "dt"`, `titleBefore: ":"`, `defaultTime: "21:00"` | each entry's eleven |
| CS 424 schedule | slot | `dueSlot: 1`, `titleSlot: 4`, `splitTitle: ";"` | `cs424-fa26`'s nine |

**None of those pages reaches the model at all.** Not everything is reachable:
the exam list on ECE 411's syllabus still is not, and `docs/ece411-findings.md`
says why — its labels are the exams' own names, so there is no shared due
convention to build a `dueLabel` from.

`defaultTime` is proposed where the page states one cutoff in prose **outside
every candidate's rows** and every dated row would otherwise land on an invented
23:59. ECE 374 A prints "Written homeworks are due every Tuesday at 9pm" above
its list; exactly one such clock, or none, because two sentences stating
different hours mean the page has no single default and picking one is an
invention.

### What a student is told now

`candidatesFoundLine` (in core, where a test can quote it) says what ran:
*"Found a list of 2 dated lines that looks like a schedule."*, *"Found one table
that looks like a schedule."*, *"Found 1 table and 1 list that could be the
schedule."* The old line said "table" whatever was found. A grid candidate
counts as a table — it *is* one, with nothing to name — rather than as a list.

The heading over each proposal is `locatorDescription`, which says where the
date and the name come from in the page's own terms — *"date in the “Due Date”
column, name in the “Exercises” column"*, *"date in the `<dt>` before each
entry"*, *"date in column 2 of a table with no header row, name in column 5"*.
It used to be the selector and the label spec, which is a true sentence about
the adapter and tells a student nothing about their page. Under it,
`candidateNotes` names every decision the search took on their behalf and that
the rows cannot show: the rows selector, the `N of M` count, that a grid is read
by position and a column added later breaks it, that cells are split on a
semicolon, and that every deadline with no stated time is set to 21:00 because
the page says so once. The preview carries the instant **and** the text it was
read from, because either alone hides a column that reads plausibly and lands on
the wrong day. Five proposals are drawn; the rest are behind "Show N more".

`noCandidateReason` no longer names the shapes it reads — there are none to name
— and it has four branches. When the search looked at something and refused it,
it says which and why: *"The nearest thing to a schedule is `ul > li`, where
only 5 of 7 rows carry a date this can read, which is under the 80% this
needs."* When it never got that far, it says what the page has: *"The nearest
thing to a schedule is `#schedule ul.simple > li`: 3 lines, 2 with a date this
can read."*, *"The largest repeated group, `li` (2 lines), carries no date this
can read."*, or — when the page repeats nothing at all — the JavaScript case and
the model. A student on an unreadable page learns something about their page
rather than about this feature.

### Running it without a browser

`npm run propose fixtures/sites/<page>.html` runs the inventory and the search
from the command line, out of the same TypeScript bundled in memory (the pattern
`scripts/scrub-file.mjs` uses — a second implementation here would be a proposer
that agrees with nothing). It prints the found-line, each candidate's fields,
its notes and its sample rows with what each date was read from, and on a page
that yields nothing it prints `noCandidateReason` plus what the page repeats and
which hooks reached anything. With `--url <page url>` it also prints the
registry entry "Use this one" would save, which makes the loop for a new course:
capture the page, run this, read the rows, paste the entry.

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
  rows selector: #mp-setup li
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

**The `rows selector:` line is the inventory's own spelling, and only ever
that.** These were two lists built by different code: `renderTable` and
`renderList` printed a selector for every block they drew, while
`proposalSchema` closes `rows` over `repeatedStructures`' top twelve. Measured
at the real budget, ECE 310 printed eight `rows selector:` lines of which **six
were absent from the enum** — including the exams table and the schedule table,
both cut by the cap — and ECE 411 printed two, both absent. The model was shown
a selector directly above the deadlines, told to copy one "character for
character", and then forbidden by the constrained decode from emitting it; where
the decode is unavailable, `#mp-setup ul.simple > li` validates, previews two
rows, and saves an adapter reading a sixth of ECE 411. `skeletonise` now takes
the inventory and prints the narrowest entry that covers the block — `#mp-setup
li` for the block above — and prints no line at all where the cap dropped the
group. One list, two readers (mutation rule 3).

**A table's rows never include its header row.** `#homework tr` is `#homework
table tbody tr` plus the `<thead>` line, and the inventory's sort is rowLike →
count → length, so being one element larger ranked the wrong spelling above the
right one on every table on every page (`#staff tr ×55` over `×39`, `#syllabus
tr ×36` over `×34`). That is the selector `detect.ts` documents as a defect —
read through a `columns.title` of "Exercises" it produces a row *titled*
Exercises with the words "Due Date" where its date should be. `repeatedStructures`
drops such a group, and an unconstrained decode that writes one anyway is now
refused by name: *rows `"#homework tr"` matches the table's header row as well as
its data rows. Use `"#homework table tbody tr"`*, rather than by the
unparsed-date check, whose reason named the row and gave a retry nothing to act
on. One predicate, `isHeaderRowOutsideTbody`, used by both.

**The inventory is bounded work, too.** `repeatedStructures` ran a fresh
`querySelectorAll` per candidate group and `proposeWithModel` calls it
synchronously on the options page's main thread — 2,177 calls for 15 distinct
selector strings on a 518KB page, which is 7.6s under linkedom and 2.7s in
Chrome with every other control frozen and no cancel, while `MAX_AUTHOR_HTML`
admits 2MB. It now evaluates each distinct selector once (output identical by
construction: `best` already kept the shortest spelling per matched set), which
takes the 12,000-element case from 10.1s to 337ms; `tests/skeleton.test.ts`
pins the bound.

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
| The fetch came back with a zero-length body | *That page came back empty, so there was nothing to show Chrome's built-in model.* |
| The `detected` message carried no `html` field at all | `staleWorkerNotice(["html"])` — *open chrome://extensions and click Reload* — plus the size limit as a second possibility |
| The session or the prompt threw | *…could not be used on this page: `<the message>`* — reached via `AuthorOutcome`'s `kind: "threw"`, never merged into the row above |

The last two rows are worth their own paragraph, because the second was
reported as the first for as long as this feature has existed. `html` was added
to the `detected` message in the same commit as the feature, and Chrome keeps
the running service worker while reloading extension pages from disk — so a
fresh options page routinely talks to a worker that never sends the field
(worker rule 8). `if (!html)` folded that into the size branch, and a student
with a 33KB course site was told a fact about their page while the actual fix
was one click on chrome://extensions, with the model branch silently never run.
`pageForAuthoring` in `core/author.ts` decides which of the three it was.
`chrome.runtime` messages are JSON, which drops an `undefined` value *with* its
key, so an absent `html` cannot yet distinguish "older worker" from "2MB page"
on its own: the stale-worker sentence names the cheap fix first and the size
second, and it collapses to one fact the moment `background.ts` states the size
decision positively — see `changesNeededElsewhere` in this wave's report.

A fourth, invisible ending has a sentence now too. "Use this one" awaited three
`send()` calls with no catch, and `send` *rejects* — with the sentence naming
the reload — when the worker has no handler for a message. That became an
unhandled promise rejection, invisible in the page and in the worker's console,
with the button left disabled reading "Saving…" and the candidate unrecoverable
without re-running detect and the model (UI rules 2 and 4).
`saveProposedAdapter` runs the three, checks all three responses, and returns
the message; the button re-enables and says what failed.

The deterministic search's own reason — why *it* found nothing — is printed
underneath, as a muted line, whenever no proposal survived. Both facts, in the
order they happened. Before this, the search's sentence was the status line and
the model's outcome was nothing at all.

`noCandidateReason`'s no-table sentence changed with it: it used to end "it is a
list rather than a table — those need a hand-written entry", which stopped being
true the morning `dueLabel` landed. It was rewritten again on 2026-09-19 to name
the two shapes the search read, and a third time on 2026-09-20 to name none —
a sentence enumerating what the search can read has to be rewritten every time
it learns something, and has been wrong between each rewrite and the one after
it. What the *page* has cannot go stale.

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

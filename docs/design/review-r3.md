# Review R3 — the core wave and the worker wiring the redesign added

Subject: `git diff 03ef3b4..HEAD -- src/core src/messages.ts src/background.ts tests`
plus the current `core/calendar.ts`, `core/grouping.ts`, `core/health.ts`,
`core/manual.ts`, `core/overrides.ts`, `core/theme.ts`, `src/messages.ts`,
`src/background.ts`, and the two UI files that consume them
(`ui/popup/shell.ts`'s `renderHealth` / `renderFooter`, `ui/popup/screens/needs-you.ts`).

R1 (feature parity) and R2 (UI house rules) were read first; nothing below repeats them.
This review is the one CLAUDE.md's review policy calls for — dedupe, the sync loop,
overrides and the store — read for **new** classes against the house rules.

Method: 47 mutations run against the whole 2065-test suite in an isolated git worktree,
every one with its match count asserted first (mutation house rule 1); nine probe suites
run against the real core functions; the six new test files re-run under four timezones.
Every finding below says whether it was verified by running code.

---

## 1. Counts

| Severity | Count |
|---|---:|
| **B** (blocking) | 3 |
| **M** | 5 |
| **L** | 7 |
| **Total** | **15** |

**The new class this review found:** *a decision was moved into `core/` exactly as the
brief asked, given a test suite, and then not called — while the surface it was written
for kept its own second copy.* That is mutation house rule 3's `resolveColumn` finding
inverted: not two copies that mask each other's mutations, but **one copy that is
mutation-tested and dead, and one copy that ships and is unreachable by any test**. It
produces a perfect illusion of coverage: `footerLine` has eleven tests and every mutation
of it is killed, and none of that says anything about the strip on screen. B1 is that
defect; B2 is the same rule (worker rule 2) failing in the one derivation that *is*
wired.

---

## 2. Findings, ranked

### B1 — `footerLine` has no caller. The footer that ships is a second copy, and it paints green over sources that were never read

- **Files:** `src/core/health.ts:592-641` (the dead one, and the only one with tests);
  `src/ui/popup/shell.ts:788-866` (the one that draws).
- **Verified by running code:** yes — `footerLine` executed directly, `renderFooter` read
  branch by branch.

`grep -rn "footerLine" src/ tests/ scripts/` returns **one definition and eleven test
references, and no caller in `src/`**. `renderFooter` re-derives the whole strip inline,
and the two disagree on three of four fields.

One ordinary state — three sources synced, a fourth switched on a second ago
(`statusAfterEnable` sets it `pending`) — measured:

```
footerLine   → {"dot":"pending","sources":"1 of 4 sources","synced":"synced 2m ago","tone":"pending"}
renderFooter →  ●(is-ok, green)  "4 sources"  ·  "synced 2 min ago"
```

`renderFooter` only says "M of N" when `bad > 0` (`shell.ts:815-818`), so a **pending**
source is counted as answering, and `tone = bad > 0 ? "warn" : "ok"` (`shell.ts:836`)
paints the dot green. That is worker house rule 2's own sentence — *a green dot must mean
"I fetched, and it was fine", never "I did not fetch"* — and it is the same defect
CLAUDE.md records as already shipped once (`set-source-enabled` painting `ok` on a source
the user had merely switched on).

W0's PROGRESS entry claims "every word of it is derived from an attempt that happened:
`summarize()` for the ratio". It uses `summarize()` and then throws the `pending` side of
it away. D10 says "Derived from `core/health.ts`"; it is not.

Three smaller disagreements ride along: no sources at all is `warn` + "No sources on" in
the shell and `pending` + "no sources" in core; the shell's clock is `timeAgo`
("2 min ago") where D10's mock and `footerLine`'s `compactAgo` say "2m ago"; and the
shell's `isSyncing()` branch sets the *dot* to pending where `footerLine` deliberately
separates `dot` from `tone`.

**Fix (one line of intent):** `renderFooter` calls `footerLine(sources, isSyncing(), now)`
and draws its four fields, deleting its own derivation.

---

### B2 — `needsYouPill` says "All clear", in green, while three of four sources have never been read

- **File:** `src/core/health.ts:517-534`.
- **Verified by running code:** yes.

```
sources: gradescope ok, canvas/prairielearn/prairietest pending (no lastAttemptAt)
needsYouPill → {"kind":"clear","tone":"ok","text":"All clear"}
footerLine   → {"dot":"pending","sources":"1 of 4 sources", …}
```

The `pending` branch fires only when **every** checkable source is pending
(`health.ts:530`), and the comment defends that: "once a single source has answered, the
counts below describe something real". They do not. `overdue` and `suggestions` are
counted over the items that *exist*, and the three sources that were never read
contribute no items — so the pill's "nothing is asking for you" is an assertion about
three fetches that did not happen, in the green tone reserved for "I looked and it was
fine". It is worker rule 2 one level up, and it is louder than the dot that caused the
rule: the header now says the student has no late work.

The reachable route is ordinary, not a corner: `statusAfterEnable` sets `pending` and
clears `lastAttemptAt` every time a source is switched on, which is exactly what the
first-run screen and Settings do. Until the next sync lands, the header is green and the
footer beside it is grey.

**Fix:** never return `tone: "ok"` while `summary.pending.length > 0` — either a
`pending`-toned "N not read yet", or `clear` with `tone: "pending"`.

---

### B3 — "Give it a date" accepts any year the regex allows; a wrong one removes the row from every tab, and the Undo is only reachable from the row

- **Files:** `src/core/manual.ts:80` (`DATE`), `:171-188` (`statedInstant`);
  `src/core/dates.ts:166-174` (`wallClockToIso`'s offset formatting);
  `src/core/overrides.ts:158-177`.
- **Verified by running code:** yes, three dates end to end through
  `studentDueOverride` → `applyDueOverride` → `dedupe` → every view function.

`DATE` is `^(\d{4})-(\d{2})-(\d{2})$` with no bound on the year, and `<input type="date">`
sets none either (`ui/editor.ts:226`). Measured:

```
TYPO 2016-09-22: dueAt=2016-09-22T23:59:00-05:00
  sectionFor=undefined  noDateCount=0  overdue=0  unreadable=[]
  attentionGroups=[]    sections=[]    todayBoard={all empty}
  gcal.shouldProject=true → an all-day Google Calendar event dated 2016-09-22

TYPO 0226-09-22: dueAt=0226-09-22T23:59:00-05:50.60000000000002   Date.parse → NaN
  noDateCount=1  unreadable=[]  gcal.shouldProject=true  (projectEvents drops it)
  retention: purged=[]  override kept
```

Three separate things go wrong, in order of how much they cost:

1. **The row leaves the No date tab and arrives nowhere.** With a `dueAt` set,
   `unreadableDeadline` is empty and `noDateCount` drops to 0; `sectionFor` returns
   `undefined` past the 7-day overdue window and past `HORIZON_DAYS`, so no section, no
   `todayBoard` group, no week card. The only surface that still draws it is the Month
   tab, navigated to that month — 120 presses of `‹` for a ten-year slip. And the undo
   (`Undo move`, `deadline.ts:247-257`) lives on the deadline screen, which is opened by
   pressing the row. `applyRetention` never clears it either: the *raw* item is still
   undated and still listed, so nothing purges the override. **The correction is
   permanent and unreachable.**
2. **A pre-1883 year produces a malformed instant.** `zoneOffsetMinutes` returns
   America/Chicago's LMT as `-350.6`, and `wallClockToIso` formats it with
   `pad(abs % 60)` — `-05:50.60000000000002`. `Date.parse` rejects it, and the string is
   then stored in `dueOverrides` and copied onto `Item.dueAt` by `buildItem`. The same
   value reaches `newManualItem` from the editor (measured).
3. **`shouldProject` returns `true` for an item whose instant will not parse**
   (`gcal.ts:174-186` — `legs()` tests `primary === undefined`, never whether it parses).
   `projectEvents` happens to drop it downstream, so nothing is pushed today; it is one
   refactor away from being pushed.

**Fix:** bound the year in `statedInstant` — the one place both surfaces already share —
with a sentence the student can act on ("Give a date in this school year"), and
`Math.round(offset)` in `wallClockToIso`.

---

### M4 — a date the student typed is headed "Moved by an announcement"

- **File:** `src/ui/popup/screens/deadline.ts:238-241`, with
  `src/core/overrides.ts:170` (`reason: "you"`).
- **Verified by:** reading (no DOM test exists).

`studentDueOverride` writes `reason: "you"`, so `movedByText` renders
`now due Tue, Sep 22 · from you` — which is right. The screen puts it under a heading
that says an announcement did it, and the row's tooltip is the bare word `you`. D8 named
that block for the announcement case; the redesign added a second producer and did not
split the heading. The comment right under it ("Only an override written by a post can be
taken back") is now also wrong in its own terms.

`STUDENT_POST_ID` exists precisely so this is one comparison.

**Fix:** head the card from `item.movedBy.postId === STUDENT_POST_ID` — "You set this
date" / "Moved by an announcement".

---

### M5 — a `set-due` outranks every later source date, for ever, with nothing on screen to say the source now disagrees

- **File:** `src/core/dedupe.ts:358` (`dueAt: moved?.at ?? dated?.dueAt`).
- **Verified by:** reading `buildItem` and running the merged-item probe.

`overrides.ts:130-140` argues the case for the moment the button is pressed: "nothing a
page said about this row's date was readable, and the student is the authority". That is
right then. It is not obviously right three weeks later, when PrairieTest finally
publishes the CBTF slot and the popup keeps showing the student's placeholder — silently,
because the only clue is the note M4 mislabels.

**What the documents say:** SPEC §5.3 does not mention `dueOverrides` at all (its
`dueAt` rule is the source precedence list); brief D3 says only "applies the existing due
override for source items". So the forever-wins behaviour is a code-level decision no
document states, in the one direction the project calls worst — silent.

Related, checked and clean: the override is keyed to **every** member key
(`applyDueOverride`, mutation R34 killed), survives a merge (`dueOverrideFor` takes the
newest `appliedAt` across the group's keys), survives a split (each singleton keeps its
own copy), and is dropped with the row by `withoutKeys` on purge. `timeAssumed` travels
correctly: a bare date yields `{timeAssumed: true}`, `buildItem` copies it to
`Item.timeAssumed`, and `ics.ts`, `gcal.ts` and `schedule.ts` all read it — so a date with
no clock becomes an all-day event and never a toast with a time in it (worker rule 3
holds end to end; mutations R30/R32 both killed).

**Needs a decision from Sushi, not a patch:** does a source's first stated date supersede
a student's placeholder, or does the row say "PrairieTest now says Nov 3 — use it?"

---

### M6 — PROGRESS's "redundant" classification for `dayList`'s title tie-break is wrong; the case is *untested*

- **File:** `src/core/calendar.ts:915-932`; PROGRESS "Wave 12 / W-core", mutation
  survivors paragraph.
- **Verified by running code:** yes (mutation P1 + probe 6).

Re-adding the tie-break survives the whole suite (`P1`, count asserted 1). PROGRESS reads
that as *redundant* — "`dayContents` already breaks its ties by title and `Array#sort` is
stable". That is true **within** a group and false **across** the timed/untimed seam,
which the code's own comment says: "a second copy would also be the *wrong* rule across
groups, interleaving a stated 11:59 with an invented one by title". Measured:

```
PROBE6  stated 23:59 "Zebra" / assumed 23:59 "Alpha", same day
current   → [["Zebra (stated)",false], ["Alpha (assumed)",true]]     ← correct
with P1   → Alpha first
```

So the mutation is a real behaviour change that no test can see. The classification that
fits is *untested*, and the action is a test (two rows at one instant, one stated and one
assumed, named so alphabetical order contradicts the right answer — mutation house rule
10's "deliberately unrealistic fixture"), not a deletion.

The deletion itself was still right. What is wrong is the note that says the case is
covered.

---

### M7 — the pill stays silent about a `needs_login` source that has no login URL

- **File:** `src/core/health.ts:524-528`.
- **Verified by running code:** yes.

`actionFor` returns `undefined` for `needs_login` when neither `LOGIN_URL[source]` nor
`status.loginUrl` is set, and `LOGIN_URL` has no entry for `site`, `piazza`, `campuswire`
or `manual` (printed). `needsYouPill` counts only sources with an action, so:

```
campuswire needs_login (no loginUrl), gradescope ok
pill       → {"kind":"clear","tone":"ok","text":"All clear"}
footerLine → {"dot":"warn","sources":"1 of 2 sources", …}
```

Green "All clear" beside an amber footer. The comment defends the filter — "a failure
nobody can act on is a sentence for the Needs-you screen, not a count on a button" — but
the pill is also the *only* thing in the header, and "All clear" is a claim, not the
absence of one. `loginUrl` is written from `err.page.url` (`sync.ts:481`), so the gap
only opens when a `LoginError` carries no page, which is the shape a 401-on-an-API-path
takes (parser rule 8's own case).

**Fix:** keep the filter for the *count*, but do not let an unactionable failure reach the
`clear` branch — `tone: "warn"`, "Something needs a look".

---

### M8 — every student-typed date is built in `SITE_TIMEZONE`; every view buckets it in the browser's zone

- **Files:** `src/background.ts:901` (`SITE_TIMEZONE`), `src/core/manual.ts:171-188`, against
  `calendar.ts`'s `startOfDay` / `dayKey` / `monthCells` and `grouping.ts`'s `daysAway`,
  which are all local-`Date` arithmetic.
- **Verified by running code:** yes — the suite itself fails outside Chicago.

```
TZ=America/Chicago  458 passed
TZ=Pacific/Auckland tests/overrides.test.ts ✗ "puts the row on the calendar…"
                    expected '2026-09-23' to be '2026-09-22'
```

A student outside Central time types `2026-09-22` into "Give it a date" or the editor,
gets Chicago 23:59, and the popup files the row on **Sep 23**. The redesign did not
invent the split — `newManualItem` has always taken `SITE_TIMEZONE` — but it added a
second surface that does it, and the HANDOFF's own open item ("Coursera, for the online CS
courses") is the population this hits.

**Fix:** either build student-typed instants in the browser's zone
(`Intl.DateTimeFormat().resolvedOptions().timeZone`), or say in the editor that dates are
campus time. One line either way; the decision is Sushi's.

---

### L9 — `countdown` says "1d late" for something two hours late

`src/core/grouping.ts:399-403`. The late branch tests `days >= 1` where `days` is whole
**calendar** days, so a deadline at 23:00 read at 01:00 is "1d late":

```
PROBE2  due 2026-09-18 23:00, now 2026-09-19 01:00 → "1d late"
        due 2026-09-19 00:30, now 2026-09-19 23:00 → "22h late"
```

The comment says "the coarsest unit that is still true"; `1d` is not true. It also feeds
`weekStatus`'s overdue word, so the week card overstates it too. **Fix:** compute the
late branch from `hours`/`minutes` (`hours >= 24 → Nd`), which is what mutation R28
substituted — and which the suite *killed*, so the current wording is deliberately
pinned. Verified by running.

### L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can

`src/background.ts:911-914`. The report line is
`${kind} "title" keys=[…] hidden=N done=N`. For `set-due` both numbers are constant and
the instant that was written, and the size of `dueOverrides`, are absent — so "the
override landed" and "the override was written to a key nothing matches" print
identically. Worker rule 5, in the handler the wave added. Verified by reading.

### L11 — `"attention"` survives in the popup's view table, with a comment asserting it still has a tab

`src/ui/popup/state.ts:164-178` keeps `attention: "Attention"` in `VIEW_LABEL` under
"until then `attention` keeps its tab, because dropping it before its replacement exists
would lose the only route to the undated rows". `VIEWS` no longer contains it, so the key
is dead and the comment is false. `src/ui/icons.ts:67` keeps `"tab-attention"`, also dead.
Everything else is clean: `storedView()` falls a stored `"attention"` back to `"day"`
(`state.ts:192-195`) and the full-view handoff validates against `VIEWS`
(`popup.ts:495`) — an installed beta's stored tab is handled correctly. Verified by grep
over `src/ scripts/ public/ adapters/` and by reading `storedView`.

### L12 — `compactAgo` is dead, and D10's "synced 2m ago" is not what ships

`src/core/health.ts:563-574` has exactly one caller, `footerLine`, which has none (B1).
The strip on screen uses `timeAgo`, i.e. "synced 2 min ago" / "synced yesterday" — the
wording `compactAgo`'s comment says is too wide for a 400px strip. Falls out of B1's fix.

### L13 — two of PROGRESS's four "survivors" are equivalent mutants, which is a different fact

`todayBoard`'s hero pool (P3) and `weekStatus`'s done/late order (P4) both survived here
too, and both are *unkillable*, not merely unreached: `sectionFor` never files a past
instant under "Today", so every eligible row today precedes every row tomorrow; and
`itemTone` returns one value, so two guards on different values cannot be reordered into
a different answer. A mutation no input can distinguish says nothing about the suite and
should not sit in a survivors list beside one that does. Both comments in the source are
accurate; it is the PROGRESS summary that flattens them. Verified by running.

### L14 — the suite pins no timezone, and one test defeats itself outside Chicago

`vitest.config.ts` sets no `TZ`. `tests/calendar.test.ts:95`
(`expect(late.toISOString().slice(0,10)).not.toBe("2026-09-10")`) passes only in a zone
behind UTC — it fails under `TZ=UTC`, `Europe/Berlin` and `Pacific/Auckland`. That is
mutation house rule 4's shape (a fixture that defeats itself looks like a gap), and every
new calendar/grouping test inherits the same silent dependency. **Fix:** `test: { env: {
TZ: "America/Chicago" } }`, and a second CI run under `TZ=UTC` if the zone split in M8 is
ever closed. Verified by running.

### L15 — a stale comment claims the No date badge counts suggestions

`src/ui/popup.ts:183-185`: "Plus the suggestions: each one is a question waiting for an
answer, and a tab that does not count them is a tab nobody opens to find them", sitting
above `nodate: noDateCount(owed, now)`, which counts no suggestions. Left over from the
Attention tab; D3 says the badge is the row count and the code is right. R2's L7 fixed
the tooltip and not this. Verified by reading.

---

## 3. Mutation table

47 mutations, all with `count` asserted before the patch (mutation house rule 1); two
initial attempts reported `count=2` and were **not** trusted — they were re-anchored and
both then killed instantly, which is the false-"survived" this rule exists for. Each
mutation was applied in an isolated worktree and the **whole** 2065-test suite was run.

| # | Mutation | File | count | Result | Classification |
|---|---|---|---:|---|---|
| P1 | `dayList`: re-add the title tie-break | calendar.ts | 1 | **SURVIVED** | **untested** (M6) — not redundant |
| P2 | `dayList`: drop the NaN guard | calendar.ts | 1 | KILLED | pinned (W-core's fix holds) |
| P3 | `todayBoard`: hero pool → today+tomorrow | calendar.ts | 1 | **SURVIVED** | equivalent mutant (L13) |
| P4 | `weekStatus`: swap `done` / `late ok` | calendar.ts | 1 | **SURVIVED** | equivalent mutant (L13) |
| R1 | `needsYouPill`: pending if *any* source pending | health.ts | 1 | KILLED | covered |
| R2 | `needsYouPill`: "Not synced yet" never fires | health.ts | 1 | KILLED | covered |
| R3 | `needsYouPill`: count all failing, not actionable | health.ts | 1 | KILLED | covered |
| R4 | `needsYouPill`: drop suggestions from the count | health.ts | 1 | KILLED | covered |
| R5 | `needsYouPill`: syncing no longer outranks | health.ts | 1 | KILLED | covered |
| R6 | `needsYouPill`: drop the "no sources on" branch | health.ts | 1 | KILLED | covered |
| R7 | `footerLine`: dot `ok` while pending | health.ts | 1 | KILLED | covered — **and dead code** (B1) |
| R8 | `footerLine`: always "N sources" | health.ts | 1 | KILLED (3) | covered — and dead code (B1) |
| R9 | `footerLine`: strip tone follows the dot while syncing | health.ts | 1 | KILLED | covered — and dead code |
| R10 | `footerLine`: oldest success instead of newest | health.ts | 1 | KILLED | covered (re-anchored after a count=2) |
| R11 | `footerLine`: count a disabled source's success | health.ts | 1 | KILLED (2) | covered |
| R12 | `quietState`: draw with a pending/failing source | health.ts | 1 | KILLED (2) | covered |
| R13 | `quietState`: drop `QUIET_MIN_DAYS` | health.ts | 1 | KILLED | covered |
| R14 | `quietState`: events can be "next up" | health.ts | 1 | KILLED | covered |
| R15 | `quietState`: weekday name past a week | health.ts | 1 | KILLED | covered |
| R16 | `quietState`: done work can be "next up" | health.ts | 1 | KILLED | covered |
| R37 | `summarize`: drop the `isFetchedSource` skip | health.ts | 1 | KILLED | covered (re-anchored after a count=2) |
| R43 | `compactAgo`: "just now" widened to an hour | health.ts | 1 | KILLED (2) | covered — dead code (L12) |
| R44 | `quietState`: "All N" counts `ok`, not `checkable` | health.ts | 1 | KILLED (2) | covered |
| R17 | `noDateCount`: count only the undated group | calendar.ts | 1 | KILLED | covered |
| R18 | `NO_DATE_ORDER` reversed | calendar.ts | 1 | KILLED (2) | covered |
| R19 | `overdueItems`: read the wrong group | calendar.ts | 1 | KILLED | covered |
| R20 | `monthDots`: cap removed | calendar.ts | 1 | KILLED | covered |
| R21 | `monthDots`: `outside` inverted | calendar.ts | 1 | KILLED (6) | covered |
| R22 | `weekStatus`: EOD branch removed | calendar.ts | 1 | KILLED | covered |
| R23 | `todayBoard`: `WEEK_PREVIEW_ROWS` not applied | calendar.ts | 1 | KILLED | covered |
| R24 | `todayBoard`: hero not removed from its group | calendar.ts | 1 | KILLED (4) | covered |
| R39 | `dayList`: untimed rows not marked assumed | calendar.ts | 1 | KILLED | covered (re-anchored after a count=2) |
| R40 | `todayBoard`: `NEXT_UP_WINDOW_DAYS` 7 → 700 | calendar.ts | 1 | KILLED (2) | covered |
| R41 | `doneLast`: finished work no longer sinks | calendar.ts | 1 | KILLED (4) | covered |
| R42 | `todayBoard`: `nextUpWhen` always "today" | calendar.ts | 1 | KILLED | covered |
| R45 | `noDateGroups`: missing group not filtered out | calendar.ts | 1 | KILLED (4) | covered |
| R25 | `countdown`: "inside a day" → same calendar day | grouping.ts | 1 | KILLED | covered |
| R26 | `countdown`: fine precision prints "in 4h 0m" | grouping.ts | 1 | KILLED | covered |
| R27 | `countdown`: non-finite instant renders | grouping.ts | 1 | KILLED | covered |
| R28 | `countdown`: late measured in hours, not calendar days | grouping.ts | 1 | KILLED (2) | covered — **pins L9's wording** |
| R29 | `countdown`: weekday used past a week | grouping.ts | 1 | KILLED | covered |
| R30 | `statedInstant`: blank time not marked assumed | manual.ts | 1 | KILLED (2) | covered |
| R31 | `manual`: a time with no date is accepted | manual.ts | 1 | KILLED | covered |
| R38 | `statedInstant`: zone ignored (UTC) | manual.ts | 1 | KILLED (11) | covered |
| R32 | `studentDueOverride`: `timeAssumed` never recorded | overrides.ts | 1 | KILLED | covered |
| R33 | `studentDueOverride`: `from` set with no prior date | overrides.ts | 1 | KILLED | covered |
| R34 | `applyDueOverride`: only the first member key | overrides.ts | 1 | KILLED | covered |
| R35 | `undoDueOverride`: removes nothing | overrides.ts | 1 | KILLED (2) | covered |
| R36 | `normalizeTweaks`: unknown falls back to `false` | theme.ts | 1 | KILLED (3) | covered |

**44 killed, 3 survived.** The three survivors are the three PROGRESS names, and the
fourth it lists (`dayList`'s NaN guard) is now genuinely killed. The core half of this
wave is the best-pinned code in the project; every defect above B3 is in the wiring
between it and the screen, or in a decision the tests agree with.

---

## 4. Timezone results

Run with `TZ=America/Chicago` unless stated. `daysAway`, `startOfDay` and `monthCells`
are whole-local-day arithmetic with `Math.round`, so the DST days do not shift anything.

| Case | Input | Result | Verdict |
|---|---|---|---|
| DST fall-back, 25-hour day | Oct 31 20:00 → Nov 1 20:00 (25 h apart) | `countdown` = "in 1d" | correct |
| DST spring-forward, 23-hour day | Mar 7 20:00 → Mar 8 20:00 (23 h) | "in 23h" | correct (inside a day's reach) |
| Month grid over the DST weekend | `monthDots(Nov 2026)` | 35 cells, **35 unique dates**, Nov 1 00:00 CDT → Nov 2 00:00 CST | correct — no skipped or doubled day |
| 23:59 boundary | now 23:59, due 00:01 tomorrow | "in 2m" (coarse and fine) | correct |
| Late across midnight | due 23:00, now 01:00 | **"1d late"** | **L9** |
| `statedInstant`, nonexistent clock | `2026-03-08 02:30` America/Chicago | `2026-03-08T02:30:00-05:00` = 01:30 local | silently shifted an hour; no refusal (folded into B3) |
| `statedInstant`, ambiguous clock | `2026-11-01 01:30` | `-05:00` (the first, CDT occurrence) | defensible, undocumented |
| `statedInstant`, bare date on the DST day | `2026-11-01` | `2026-11-01T23:59:00-06:00`, `timeAssumed: true` | correct offset |
| `statedInstant`, year bounds | `0000-01-01`, `9999-12-31` | accepted; `0226` yields `-05:50.60000000000002` | **B3** |
| `statedInstant`, impossible day | `2026-02-29` | `ManualItemError: There is no such date as 2026-02-29.` | correct |
| Whole new-core suite | `TZ=UTC` / `Europe/Berlin` / `Pacific/Auckland` | 1–2 failures | **L14**, and **M8** for the `overrides` one |

---

## 5. Checked and clean

Written down because each is a place a defect was expected and is not.

- **Undated manual items.** `ManualInput.date` optional: `newManualItem` yields a
  `RawItem` with **no** `dueAt` and **no** `extra.timeAssumed` (measured); a time or an
  end time with no date is refused (R31 killed). Such a row never reaches
  `applyRetention` at all — manual rows live in `store.manualItems`, not `store.raw`, so
  §5.4's undated three-miss purge cannot touch them, which is right. It counts 1 in
  `noDateCount`, 0 in `overdueItems`, produces `weekStatus === ""`, an empty `dayList`
  and an empty `todayBoard`. `ics.event`, `gcal.legs` and `googleCalendarUrl` all return
  nothing for it (no broken VEVENT, no push), and `schedule.ts` never schedules a lead
  without an instant. `editManualItem` keeps `sourceId`, so giving it a date later
  preserves every override keyed to it.
- **`background.ts` stays empty (worker rule 1).** The `set-due` branch
  (`background.ts:896-904`) is two core calls, a clock and `SITE_TIMEZONE`; no rule lives
  in it. A `ManualItemError` thrown by `statedInstant` propagates out of `mutate`'s
  `change` callback **before** `saveStore`, the queue releases it in a `finally`
  (`queue.ts:75-88`), the tail is the swallowed copy so nothing queues behind it, and
  `answer()` turns it into the same sentence the editor shows. No half-written store.
- **`undoDueOverride` is reachable from the UI** — `undo-move` from the deadline screen
  (`deadline.ts:247-257`) and from the row's moved-detail line (`rows.ts:418-424`), keyed
  on the item's *current* member keys. It is only unreachable in B3's case, where the row
  itself has stopped drawing.
- **Worker rule 3 end to end for `set-due`.** A bare date yields
  `{timeAssumed: true}`; `buildItem` copies it to `Item.timeAssumed`;
  `dedupe.ts:337` still prefers a member with a *stated* instant over an assumed one;
  `ics.ts:97/110/156`, `gcal.ts:205/231` and `schedule.ts:263/421` all branch on it, so the
  invention becomes an all-day event and never a clock in a toast.
- **Compat (worker rule 8).** The redesign added no field the popup dereferences.
  `POPUP_STATE_FIELDS` still covers `items`, `sources`, `courseNames`, `suggestions`;
  `settings` and `lastSyncAt` are read behind `??`. Nothing new is needed in
  `core/compat.ts`.
- **A stored `"attention"` from an installed beta.** `storedView()` falls back to `day`;
  the `openFullView` handoff validates against `VIEWS` before acting. Only the dead label
  in L11 is left.
- **`state.currentItems`** is the worker's unfiltered list (`popup.ts:150`), so
  `repaintChrome`'s pill during a sync counts the same `overdueItems` as `refresh`'s. The
  `lastHealth` it reads is the last state *fetched*, not a store read — no stale-disk
  claim.
- **`noDateCount` and the No date view read the same list** (`owed`), so the badge and the
  tab cannot disagree.

---

## 6. The one standing check worth adding

A build-time assertion that **every exported function in `src/core/` added for a UI
surface has at least one caller in `src/ui/` or `src/background.ts`**. `footerLine` and
`compactAgo` are 60 lines of mutation-tested, documented, *unreferenced* core, and the
suite's 2065 green tests made that look like coverage of the strip on screen. One
`grep -c` per new export at build time would have caught B1 the day it was written — and
it is the same three-line class of check as R1's merge-marker guard.

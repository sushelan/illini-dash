---
name: trace-symptom
description: Investigate a real illini-dash symptom that no test reproduces, by fanning agents over segments of one runtime path rather than reviewing a file. Use when something is broken in the browser but the suite is green, when reviewing one module has found nothing twice, when a beta report describes behaviour no fixture can reach, or when deciding between a full adversarial review and a trace.
---

# Tracing a symptom along a runtime path

CLAUDE.md, Review policy: *"Reviewing `background.ts` as a file had found nothing in four
steps. Fanning agents out over segments of one runtime path — bundle → storage → options
UI → permission → sync → offscreen → popup, one agent each, each asked how its segment
could produce the observed symptom — found the deadlock, the unqueued writer and the
repeating failed fetch in a single pass."*

**The unit of work is a hop in a chain, not a module.** Use this shape *"whenever a symptom
is real but no test reproduces it"*.

## 1. State the symptom as an observation

Write down what was seen, in the reporter's words, and what was *measured* — not what you
think it means. The handoff's row-menu bug is the model: *"The menu opens. Clicking any
item … does nothing at all,"* plus the decisive measurement (a capture-phase probe reading
**"waiting for a press…"**, so not even `pointerdown` reaches the menu).

Then write the **ruled-out table**: hypothesis, and *how it was eliminated, with evidence*.
Anything in that table is not re-checked. Not by you, and not by an agent you spawn — put
the table in every agent's prompt.

## 2. Cut the path into segments

Name the hops the symptom must pass through, end to end, for this repo. The trace that
worked: **bundle → storage → options UI → permission → sync → offscreen → popup**. Other
real paths: click → listener → `send()` → worker router → `core/` decision → queue →
store write → redraw; or alarm → sync → adapter runner → dedupe → grouping → popup.

One agent per hop. A hop is a place where a value changes hands — that is where the
defects were.

## 3. The prompt each agent gets

- the symptom and the decisive measurement, verbatim;
- the ruled-out table;
- **its segment only**, named by file and function;
- the question: *how could **this segment** produce exactly this symptom?* — not "review
  this file";
- CLAUDE.md's house rules, and the instruction to hunt for *new* classes;
- the demand for evidence: a file:line and the mechanism, not a suspicion.

Write it as a Workflow script: one worker per segment, each in its own worktree on its own
branch, each returning a structured report (`summary`, `filesChanged`, `openQuestions`);
the orchestrator merges the branches and reads the reports. Workers investigate — they do
not fix, because two workers fixing the same hop conflict and because the fix belongs
after verification. See the workflow-authoring skill for the script API.

## 4. Findings are leads, not results

*"Findings from a trace are **leads, not results**. Refuters killed several of these before
they reached Sushi, and of the survivors two needed correcting when I read the source
myself. Verify every one against the code before acting or reporting."*

So, per lead: open the file, read the actual code, and either reproduce the mechanism or
drop it. And: *"When a review's refuters fail (API errors), findings that could not be
judged are **unverified, not refuted** — surface them separately and verify by hand."*

## 5. Where a fix goes

Worker rule 1: *"The service worker is the file the suite cannot reach, so keep it empty…
Anything with a *decision* in it belongs in `core/`, where it can be pinned and mutated…
When a defect is found there, the fix includes moving the logic out — `core/queue.ts`
exists because a deadlock hid in the worker for four steps."* Then mutation-check the new
test (mutation-check skill), because a trace defect is by definition one no fixture
reached.

If the trace ends with a round-trip you had to spend, add the log line that would have
answered it (worker rule 5: *"Log both branches of any decision the user will have to
debug"*) rather than apologising for it.

## Trace or review?

Review policy: **full adversarial review** for `core/dedupe.ts` and the sync loop — *"where
G2 and G3 risk lives and where a defect is hardest to see by hand"*. **Light or none** for
behaviour-preserving refactors, UI, and anything the suite already pins by mutation. A
symptom with no failing test is a **trace**, not a review — *"parallelise *investigation* of
one symptom across independent segments more readily than implementation across features."*

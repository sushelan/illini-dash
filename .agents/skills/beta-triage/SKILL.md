---
name: beta-triage
description: Turn an illini-dash tester's or Sushi's bug report into findings, a fix and a PROGRESS entry. Use when a message describes something wrong in the running extension ("it says sign in needed but nothing to click", "no rows showed up", "the dot is green but empty"), when diagnostics or a "Report this page" file arrives, or when deciding whether a report is a G4 gate failure or an ordinary fix.
---

# Triaging a beta report

The beta *"has one tester and found six real defects in a day"*. Every one of these cost
several round trips of Sushi's time, *"which is the resource this project has least of"*.

## 1. Quote the report verbatim, first

Paste the tester's words into the working notes and into the PROGRESS entry, unedited:

> *"For reading the cs424 website it just says sign in needed but it doesnt link me to the
> sign in page."*

The wording carries the surface they were looking at and the thing they tried to press.
Do not normalise it into your own vocabulary — that is where the symptom gets lost.

## 2. Separate symptom from cause, and do not stop at the first cause

The symptom is what they saw. The cause is usually one level up and usually plural. In the
quote above the immediate cause was a missing `LOGIN_URL` entry for `site` — but chasing
it found the real shape: *"**Four surfaces were each deciding what a sign-in link is**, all
by reading `LOGIN_URL[source]` for themselves … One decision in four places, wrong in all
four for the same source."* One `signInUrl` replaced them.

Ask, every time: is this one place, or one decision copied into four?

## 3. Check the fixtures can even reach the state — they usually cannot

Worker rule 7: *"Live data is a source of truth the fixtures are not … three of the four
could not exist in a fixture test, because they need two sources, or a queue, or a
browser."*

So: can the suite reach this state at all? If not, that is itself a finding, and the fix
includes making it reachable — `?fail=sitelogin` had to exist before the harness could show
the signed-out course source, *"which is the same finding as every previous live defect"*.
Where a realistic fixture cannot distinguish a wrong implementation from a right one, move
the assertion to the fixture that can (`loginUrl: err.page.finalUrl` survived against the
401 fixture, which answers in place, and had to move to the Shibboleth capture).

## 4. Decide which log line would have answered it — and add it

Worker rule 5: *"Log both branches of any decision the user will have to debug. A silent
early return in the registry seed made 'already seeded, all healthy' and 'the seed never
ran' identical in the console."*

And UI rule 4: *"When a control does something asynchronous, say so on the control."*
"Hide" becoming "Applying…" *"distinguishes 'the click never ran' from 'the click ran and
the round trip failed' with no console at all. That one change produced more information
than four builds of logging."* Prefer that over a log line when the report is about a
control.

Check the report is not one of the two structural silences first (docs/dev-loop.md): a
stale worker (`STALE SERVICE WORKER: this page is build A, the worker is build B`), or a
message a listener declined, which resolves `undefined`. Compat rule (worker rule 8):
normalize every field a page dereferences in `core/compat.ts` and *"never let a render
function reject into a console the user does not have open"*.

## 5. Gate failure, or ordinary fix?

docs/pre-submit.md, "What fails G4 rather than being a bug to fix":

- **Data loss** — *"a hide, a merge, a split or a Mark done that came back, or a list that
  emptied itself. Stop and fix; §9 says zero."*
- **A parse error that never reached the screen** — *"a source that silently showed nothing
  while its dot stayed green. This is worker rule 2, and it is the failure this project
  keeps re-making."*
- Everything else is a fix or a documented amendment.

Ask for **Copy diagnostics** (Settings → Data) with *every* report, including "it looks
fine"; a **Report this page** file is *"the single most valuable thing a tester can send,
because a new fixture is what fixes a parser"*; and every use of **Split** is the G3
measurement n=1 could not make.

If the report contradicts a doc, rewrite the claim — *"a 'superseded' note under a wrong
sentence is not a fix"* — and then chase what was inferred from it, because those are
usually wrong too.

## 6. The PROGRESS.md entry

Dated heading, the quote, what was actually found, what changed, and the test count.

```markdown
## The one source with no login page — 2026-09-12

*"For reading the cs424 website it just says sign in needed but it doesnt link me to the
sign in page."*

<what the immediate cause was, and why the obvious reading of it was incomplete>

<the real shape: the decision that existed in four places, now one `signInUrl`>

<the mutation pass: what survived and what it proved — e.g. `loginUrl: err.page.finalUrl`
survived against the 401 fixture, which answers in place, so the assertion moved to the
Shibboleth capture>

Build, typecheck and all 1023 tests pass. G4/G5 unchanged.
```

Name the gate state in the last line whether or not it moved; the file is read for that.

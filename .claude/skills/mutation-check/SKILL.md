---
name: mutation-check
description: Prove a test is load-bearing before calling a behaviour covered in illini-dash. Use when writing or reviewing tests, when about to say something is "tested" or "covered", when a defect turns up in code the suite already touches, or when a mutation "survived" and you must decide what that means. Covers the scratch-copy procedure, the match-count assertion, and the untested / unreachable / redundant classification.
---

# Mutation check

CLAUDE.md, parser rule 10: *"A test that passes against a wrong implementation is not a
test. Before calling a behaviour covered, mutate the source in a scratch copy and confirm
the suite fails."*

Do this **before** claiming coverage, not after a review asks.

## The procedure

1. **Copy the file** you are about to mutate to the scratchpad (`cp src/core/x.ts
   $SCRATCH/x.ts.orig`) so a failed revert cannot lose work.
2. **Apply one mutation, asserting the match count first** (see below).
3. `npm test` — and read *which* test failed, not just that one did. A failure in an
   unrelated file means you mutated something else.
4. **Revert from the scratch copy**, then re-run `npm test` to confirm green again.
5. One mutation at a time. Two at once cannot tell you which test was load-bearing.

## Always assert the match count

Mutation-check rule 1: *"Verify the mutation applied. Twice, a `sed` reported 'survived'
when it had never patched anything — once the pattern omitted an optional-chaining dot
(`item.extra?.["k"]` vs `item.extra?["k"]`), once the leading whitespace was wrong.*
*A false 'survived' is worse than no mutation test: it says a behaviour is unpinned when
it is pinned, and the natural response is to write a redundant test or delete a live
guard."*

So never `sed -i`. Use python and fail loudly:

```python
import pathlib
p = pathlib.Path("src/core/health.ts")
s = p.read_text()
old = '  if (status.lastAttemptAt === undefined) return "pending";'
new = '  if (status.lastAttemptAt === undefined) return "ok";'
assert s.count(old) == 1, f"count={s.count(old)}"
p.write_text(s.replace(old, new))
```

Copy the `old` string out of the file you just read, including its indentation, rather
than retyping it.

## Worked example (this repo)

`core/health.ts` derives a source's dot from an attempt that happened (worker rule 2:
*"A green dot must mean 'I fetched, and it was fine' — never 'I did not fetch'"*).

- Mutate `"pending"` → `"ok"` for a source with no `lastAttemptAt`, as above.
- `npm test` → 11 failures across `tests/health.test.ts` and the surfaces that read it.
  The behaviour is pinned; revert (`git checkout src/core/health.ts`) and re-run: 1023
  passed.
- If it had passed, `health.test.ts` never asserted the cold-install case, and worker
  rule 2's whole defect class was unguarded.

## A survivor has three meanings — decide which before acting

Mutation-check rule 2:

- **Untested** — the common case. *"Write the test. Six of today's survivors were this,
  and every one was a behaviour a student would notice first."*
- **Unreachable** — *"the mutation cannot be triggered by any input the code accepts."*
  Example in-repo: with two lead times a third lead cannot exist, so `collapseOverdue`'s
  "leave a future lead alone" clause is unexercised. **Keep it, and say in a comment that
  it is unreachable today and why it stays.**
- **Redundant** — *"a second guard rejects exactly what the first does"* (`isRealWallClock`
  before `wallClockToIso`, which already throws the same error for the same inputs).
  **Delete it.** *"An unreachable branch that duplicates a reachable one is not defence,
  it is a second thing to read."*

## A survivor sometimes indicts the design

Mutation-check rule 3: `cellByHeader` and `headerExists` *"each wrote out the
header-matching rule, so loosening one was masked by the other staying strict, and no test
could reach it. The fix was not a cleverer test — it was one `resolveColumn` used by
both."* When a mutation cannot be reached because another copy of the same decision
compensates, **that is the finding** — report it as a design defect, not as a missing test.

## When the defect was in covered code

Worker rule 6: *"A mutation check proves a test is load-bearing, not that it pins the
right requirement."* The `state: "ok"` defect survived a mutation-checked suite *because a
test asserted it*. So when a defect turns up in covered code, **look for the test that was
pinning the bug**, and when writing a test from a spec line, **quote the line** in the
test's name or comment. If you change a test that was pinning old behaviour, quote the
decision that changes it there.

## Reporting

Report each mutation as `mutation` + `outcome` (killed / survived-untested-then-tested /
survived-unreachable / survived-redundant-deleted) and say what you did about it. A
mutation you could not make apply is not a result — fix the pattern and run it again.

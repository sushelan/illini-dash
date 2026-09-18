# Announcement fixtures

**These are constructed, not captured — and the real corpus is now somewhere
else.** Every file here was written by hand to exercise one clause of the
grammar in `src/core/announce.ts`, and they are named after the clause rather
than after a course.

The real announcements live in **`fixtures/campuswire/feed-ece408-sp26.html`**,
nine of them, captured from the rendered class feed. `tests/announce-real.test.ts`
reads them through `parseFeed` and runs the grammar over the text the instructors
actually typed. Read that file first: when the two disagree about what the
grammar should do, the capture wins (parser house rule 9).

It is worth being plain about what these fixtures cost, because it is the
clearest instance of worker house rule 7 this project has. They were written
from the spec, they all passed, and the first nine real posts found a subject
for **none** of them, dropped a stated clock, and produced nothing at all for
seven of the nine. Constructed fixtures pin the arithmetic and the refusals —
DST, year inference, the bare-`5:00` refusal — and they cannot tell you how
people write. Add a case here to pin a *rule*; add one to the capture's test to
pin what a real post *says*.

House rule 10 says a realistic fixture value can make a wrong implementation
indistinguishable from a right one, so three of these are **deliberately
unrealistic** and say so here:

- `mp3-due-friday.txt` has **two spaces** inside the date phrase
  (`at  11:59pm`). No instructor types that on purpose. It is there so the
  grounding rule is testable: a span built by reassembling or re-spacing the
  parsed parts stops being a substring of the file, and `ground()` throws.
- `contradictory-weekday.txt` says `Fri 10/3` in a post written on
  2026-09-18, and 2026-10-03 is a **Saturday**. The only year where "Fri" and
  "10/3" agree is 2025, which is before the post. It is there to pin the rule
  that a weekday contradicting its date is reported as `other` rather than
  resolved into a year-old deadline.
- `ambiguous-five.txt` says `at 5:00` and then says out loud that it will not
  disambiguate. A real post would rarely be so pointed. It pins the refusal of
  a bare `h:mm` under 13 with no meridiem, which `src/sources/site.ts` already
  refuses for the same reason.

Three more deliberately unrealistic cases were added in wave 4 and live inline
in `tests/announce.test.ts` rather than as files here, because each is one
sentence and its whole point is a single character:

- `"HW4 is due **Fri 10/2  at 11:59pm**."` — bold *and* the double space. An
  implementation that deleted the asterisks instead of masking them would offset
  every span by two characters, and against ordinary markup the wrong span would
  still look like a plausible date.
- `"HW5 is due tomorrow, 9/22 at 12:00 PM."` — a restated date that
  **contradicts** the relative one. No real post writes it; without it, a rule
  that simply took the later clock would pass every realistic case.
- `"Because of the outage, HW 2 is\nextended to Oct 10."` — a hard wrap that
  looks exactly like the title line the observers put in front of a post. The
  only thing telling them apart is the lower-case letter after the newline, and
  every real capture has a real title, so nothing in the capture can reach it.

One file here is **not** constructed, and is the only one that is not:

- `demo-signup-live.txt` is a post from Sushi's own CS 425 Piazza feed,
  transcribed from the Attention tab on 2026-09-18 — the row that read *"Note
  that the \*\*demo slot (signup) is due by this Friday at 11:59 pm."* It is
  here rather than in `fixtures/piazza/` because only the *text* was captured:
  the post's body is past the 120-character snippet in `feed.json`, and no
  `content.get` for it exists. It pins three live defects at once — a title
  carrying Markdown, a title that is a whole sentence, and a deadline (Friday 11
  September) that had already passed when the first sync read it on the 18th.
  Read with `postedAt = 2026-09-07T09:00:00-05:00`, a **Monday**, so that "this
  Friday" is the 11th.

Every other fixture is read with `postedAt = 2026-09-18T15:00:00-05:00` (a **Friday**,
which is what makes "next Friday" a +7 rather than a +0) except
`november-dst.txt`, whose expected instant is on the `-06:00` side of the
change.

# Announcement fixtures

**These are constructed, not captured.** Nobody has logged into Piazza or
Campuswire for this project yet (the Piazza source and the Campuswire observer
are both unbuilt), so there is no real post to capture. Every file here was
written by hand to exercise one clause of the grammar in `src/core/announce.ts`,
and they are named after the clause rather than after a course.

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

Every fixture is read with `postedAt = 2026-09-18T15:00:00-05:00` (a **Friday**,
which is what makes "next Friday" a +7 rather than a +0) except
`november-dst.txt`, whose expected instant is on the `-06:00` side of the
change.

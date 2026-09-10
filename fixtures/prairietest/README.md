# PrairieTest fixtures — provenance

## `signed-out.html`

**Real capture**, 2026-09-10, `https://us.prairietest.com/pt/` with **no session**.
4 KB, nothing scrubbed — nobody was signed in.

Like Gradescope, a student who has never signed in gets **200 at the unchanged
URL** with an ordinary-looking title (`Home — PrairieTest`) and simply no exam
cards. §4.4's missing-card guard then threw a `ParseError`, painting a red dot
over what is only a missing session (§0 rule 2).

The marker is the handoff link to PrairieLearn's auth endpoint
(`/pl/prairietest/auth`), which is the page's whole purpose when signed out and
appears in neither logged-in capture. Not the bare word `prairietest`, which
appears in any URL on the site — the suite pins that with a deliberately
adversarial copy of a real capture, per house rule 10.

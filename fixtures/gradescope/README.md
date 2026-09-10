# Gradescope fixtures — provenance

| File | Origin |
|---|---|
| `dashboard.html` | **Real capture**, logged in. 15 courses across 5 terms. |
| `course-1352838.html` | **Real capture**, logged in. PHYS435, 2 assignments covering the submitted and unsubmitted row shapes. |
| `signed-out.html` | **Real capture**, 2026-09-10, `https://www.gradescope.com/` with **no session**. Trimmed to the first 16 KB — see below. |

## `signed-out.html`

A student who has never signed in does not get a redirect or a 401. Gradescope
answers **200 at the unchanged URL** with `<title>Gradescope</title>` and the
marketing splash page, which none of `looksLoggedOut`'s generic tests catch. The
parser therefore ran on the splash, found no course cards and threw — a red
"the page changed" dot, with no login link, for the one situation where logging
in is the entire fix (§0 rule 2).

It is trimmed from 210 KB to the first 16 KB. That head carries the login form
and the `js-logInButton` hook, which is all `isLoginResponse` reads; the rest is
marketing copy that changes weekly and would rot the fixture for no gain. The
trim is noted in an HTML comment at the end of the file.

Nothing was scrubbed, because nobody was signed in. The only email addresses in
the full page are Gradescope's own placeholders (`email@example.com`,
`feedback@gradescope.com`).

**Why `js-logInButton` and not "Log In".** The marker has to be absent from a
healthy page, or every successful sync becomes a `needs_login` and the list
silently stops updating. A substring like `"Log In"` is not safe: an assignment
called *Log Interpretation* contains it. The suite pins that with a deliberately
adversarial copy of the real dashboard, per house rule 10 — realistic fixture
values made the loose and the correct marker indistinguishable, so the test
makes one unrealistic on purpose.

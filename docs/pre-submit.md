# The two walks before G5

Everything G5 needs is either done or is one of the two walks below. They are here
because neither can be run from the repo: one needs a Chrome profile that has never seen
this extension, the other needs ten other people.

Current state: `npm test` green, `npm run package` emits
`release/illini-dash-1.0.0-<build>.zip`, the privacy policy is live at
<https://sushelan.github.io/illini-dash/privacy.html>, and every permission and origin is
justified in `docs/store/listing.md` and disclosed in the policy — all four pinned by
`tests/manifest.test.ts`.

---

## Walk 1 — the clean-profile install (about 20 minutes)

**What it is for.** Every install so far has been onto a profile that already had the
extension, already had the sites signed in, and already had a store with data in it. None
of the first-run path has ever run on a machine that is not yours. The three things it
measures have never been observed even once:

- the setup tab opening **on install** rather than on the first click of the icon
- the pin card — the bubble Chrome shows for a newly installed extension
- a reminder actually arriving as an OS notification

### Setting up

Build the zip and unpack it somewhere you can point Chrome at:

```bash
npm run package && unzip -o release/illini-dash-1.0.0-*.zip -d /tmp/illini-clean-build && ls /tmp/illini-clean-build
```

Then launch a Chrome that shares nothing with your real one — no history, no cookies, no
extensions, no signed-in Google account:

```bash
open -na "Google Chrome" --args --user-data-dir=/tmp/illini-clean-profile --no-first-run
```

That window is a different browser as far as everything is concerned. Close it when you
are done and `rm -rf /tmp/illini-clean-profile` to throw the whole thing away.

### The walk

Do these **in order**, and write down what actually happened next to each rather than
whether it was fine. "Fine" is not an observation.

| # | Do | Look for | What a failure means |
|---|---|---|---|
| 1 | `chrome://extensions` → Developer mode on → **Load unpacked** → `/tmp/illini-clean-build` | The card loads with **no errors** and no yellow warning triangle | A manifest or file error that only appears on a clean load |
| 2 | Watch what happens **immediately after** the load | A tab opens by itself on the setup screen | `onInstalled` did not fire or did not open it; first-run has never been observed from an actual install |
| 3 | Read that screen without clicking | You can tell which sites to tick from the one-line hints alone | The hints are written for someone who already knows what PrairieTest is |
| 4 | Look at the toolbar | Chrome's own "extension added" bubble — does it name Illini Dash and show the right icon at toolbar size | The 32px icon, which was added late and never seen in the wild |
| 5 | Tick the four defaults, press **Open all sign-in pages**, sign in to each | Rows tick green one at a time; **Show my calendar** stays clickable throughout | A blocked first run |
| 6 | Open the popup | `Checked … · N of N sources OK · build <id>`, and the build id matches the zip's filename | A stale worker, or a green dot over a source that never fetched |
| 7 | Settings → Sources → switch a **course website** on | It goes "Checking…" → "Connected" **within a few seconds**, not at the next poll | The fix in `962add6`; this is the one that lands in every tester's first five minutes |
| 8 | Settings → Reminders → **Send a test reminder** | A real OS notification, with the course, the time, and the source name on the third line | The notification path has never once been seen fire outside a unit test |
| 9 | Quit Chrome entirely, reopen it, open the popup | The list is still there and the status line is not "Not synced yet" | Storage or the alarm not surviving a restart |
| 10 | `chrome://extensions` → Remove | It goes, and `/tmp/illini-clean-profile` is all that is left to delete | — |

**Step 8 is the one to not skip.** macOS silently drops notifications for an app that has
never been granted them, and Chrome's own permission for that lives in System Settings →
Notifications → Google Chrome. If nothing appears, check there before assuming the code is
wrong — and either way that is a finding worth a line in the beta guide, because ten
testers will hit it.

---

## Walk 2 — the beta (G4: one week, ten people)

§9 states the bar: **10 users across ≥ 3 majors for 1 week; zero data-loss bugs; every
parse error surfaced in the UI rather than swallowed; ≥ 7 of 10 say they would keep it
installed.**

### Why ten, and why not your friends in one major

G3 passed on **n=1** — your account produced exactly one cross-source merge opportunity
and it merged correctly, which is inside §9's budget of two corrections but does not
measure the budget at all. The specific thing that is unmeasured is §5.3's badge-token
trade: dropping the "≥ 2 tokens" rule lets `{mp2}` merge into `{mp2, checkpoint}`, and
nothing on your account has that shape. **Two different assignments collapsing into one
row is the worst thing this extension can do**, and only a spread of courses produces the
pairs that would show it. Ten CS students would mostly re-measure what your own account
already did.

Aim the spread at variety of *sources*, not of people: someone on smartPhysics (PHYS
211–214), someone who uses PrairieTest heavily, someone whose courses live mostly on
Canvas, and at least two people with a course that publishes its schedule on its own
website.

### Sending it

```bash
npm run package
```

Send each person the zip plus `docs/beta-install.md` — that guide already covers install,
first run, updating, and how to report the three kinds of problem. Nothing else needs
writing.

When you ship a fix mid-week, send the new zip and say **"reload the card at
chrome://extensions"** in the same message. The popup does say `STALE SERVICE WORKER` with
both build ids when they forget, but people do not read a status line they have no reason
to look at.

### What to collect, and from where

Three channels already exist in the build; you do not need a form for the first two.

1. **Copy diagnostics** (Settings → Data) — which sources worked, item counts per course,
   what failed and when. No titles, no links, nothing identifying. Ask for this with
   *every* report, including "it looks fine".
2. **Report this page** (right-click on a page whose deadline is missing) — fetches the
   page, scrubs it, hands them a file. This is the single most valuable thing a tester can
   send, because a new fixture is what fixes a parser.
3. **Every use of Split** on a row — ask them to tell you, with the two titles. This is the
   G3 measurement that n=1 could not make. `⋯` → Split.

### The exit question, at the end of the week

Ask exactly this, of all ten, and record the answer verbatim:

> Would you keep Illini Dash installed next semester? Yes / no — and what is the one
> thing that would change your answer?

Seven yeses is the gate. The second half is worth more than the first.

### The tracking table

| Tester | Major | Sources they use | Installed | Diagnostics received | Splits reported | Broken pages | Would keep? |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

### What fails G4 rather than being a bug to fix

- **Data loss** — a hide, a merge, a split or a Mark done that came back, or a list that
  emptied itself. Stop and fix; §9 says zero.
- **A parse error that never reached the screen** — a source that silently showed nothing
  while its dot stayed green. This is worker rule 2, and it is the failure this project
  keeps re-making.
- Everything else is a fix or a documented amendment, not a gate failure.

---

## Then G5

Once G4 passes, the remaining store items are the ones only an account can do:

- [ ] Register the Chrome Web Store developer account (one-time $5)
- [ ] Upload `release/illini-dash-1.0.0-<build>.zip`
- [ ] Paste <https://sushelan.github.io/illini-dash/privacy.html> into the Privacy tab
- [ ] Copy the per-permission justifications from `docs/store/listing.md` §Permissions
- [ ] Upload the screenshots from `docs/ux/after/` (1280×800) and the promo tile (440×280)
- [ ] Declare data use: **no data collected** — which is true, and the policy says why

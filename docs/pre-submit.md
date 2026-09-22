# The two walks before G5

Everything G5 needs is either done or is one of the two walks below. They are here
because neither can be run from the repo: one needs a Chrome profile that has never seen
this extension, the other needs ten other people.

Current state: `npm test` green, `npm run package` emits
`release/illini-dash-<version>-<build>.zip` — the version comes from
`public/manifest.json`, so never write it out by hand; the privacy policy is live at
<https://sushelan.github.io/illini-dash/privacy.html>; and every permission and origin is
justified in `docs/store/listing.md` and disclosed in `docs/store/privacy-policy.md`.
`tests/manifest.test.ts` pins five things: that every fetched origin is granted, that
every permission the manifest claims has a row in listing.md's justification table, that
the policy names every granted host and permission, that each block of
`privacy-practices.txt` fits the character limit its own header states, and that the
**published** page matches what `npm run site` generates today.

That last one is new on 2026-09-22, because the published page had been ten days stale
and was telling a reviewer that data is "never transmitted to the developer or any third
party" — false since the Calendar export shipped. Publishing is by hand, so when the
policy changes the step is:

```bash
npm run site && git checkout gh-pages && cp site/privacy.html site/index.html . && git add privacy.html index.html && git commit -m "…" && git push origin gh-pages
```

then `git checkout -` back. The test fails until that push happens, so the drift cannot
reach a reviewer again — but it reads the local `gh-pages` ref, so run
`git fetch origin gh-pages:gh-pages` if you have published from another machine.

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

Build the zip and unpack it **onto the Desktop**, not into `/tmp` — macOS hides `/tmp`
from every file picker, and step 1 goes through a file picker:

```bash
npm run package && unzip -o release/illini-dash-*.zip -d ~/Desktop/illini-clean-build && ls ~/Desktop/illini-clean-build
```

The glob is deliberate. `scripts/package.mjs` names the zip
`illini-dash-<manifest version>-<build id>.zip` and wipes `release/` before writing, so
after that command there is exactly one zip and the glob cannot go stale. A version
written into this document went stale the first time it was bumped — the line said
`1.0.0` while `package.json` said `1.2.0`, so the checklist unzipped a file that did not
exist. If you need the name itself, read it rather than type it:

```bash
ls release/
```

Then launch a Chrome that shares nothing with your real one — no history, no cookies, no
extensions, no signed-in Google account. The profile *can* live in `/tmp`, because it is
named on the command line and never seen by a picker:

```bash
open -na "Google Chrome" --args --user-data-dir=/tmp/illini-clean-profile --no-first-run
```

That window is a different browser as far as everything is concerned. When you are done,
`rm -rf /tmp/illini-clean-profile ~/Desktop/illini-clean-build` throws all of it away.

### Do you have to sign in?

**No — and the half that needs no login is the half worth doing.** Steps 1–4 and 8 are
the ones that have never been observed anywhere, and none of them touches a source.
Steps 5–6 and 9 re-measure a path the daily driver already exercises.

Step 7 is the interesting case. `adapters/registry.json` holds **eight** adapters now, not
two — every one of them passes its `minExtensionVersion` gate against the current build,
and `cs425-fa26` needs `1.2.0` exactly, so it is the one that proves the version in the
zip is the version the registry was written for. Only two of the eight matter here,
because only one of them is readable signed out:

| Adapter | URL | Signed out |
|---|---|---|
| `ece310-fa26` | `courses.grainger.illinois.edu/ece310/fa2026/` | **200 — public** |
| `cs424-fa26` | `courses.grainger.illinois.edu/cs424/fa2026/secure/schedule.html` | 401 — behind Illinois SSO |

The other six (`ece391-fa26`, `ece411-fa26-mp`, `ece411-fa26-exams`, `cs425-fa26`,
`cs374a-fa26-hw`, `cs374a-fa26-gps`) are public course pages too, and any of them would do
— `ece411-fa26-mp` is the one the store reviewer is pointed at in
[test-instructions.txt](store/test-instructions.txt), so exercising it here is worth more
than exercising a page nobody else will open.

So **enable ECE 310, not CS 424**, and step 7 runs end to end with nothing signed in: the
optional `*.illinois.edu` permission prompt, the fetch, the parse, and the state going to
Connected. That is the whole of the `962add6` fix, on a profile that has never seen this
extension.

If you do want the full end-to-end afterwards, you never sign into email — the four sites
redirect to Illinois SSO themselves, and a fresh profile has no trusted-device cookie, so
it is a NetID and a Duo push per site.

### The walk

Do these **in order**, and write down what actually happened next to each rather than
whether it was fine. "Fine" is not an observation. **L** marks the steps that need a
login; everything else runs signed out.

| # | | Do | Look for | What a failure means |
|---|---|---|---|---|
| 1 | | `chrome://extensions` (**typed**, not clicked) → Developer mode on, top right → **Load unpacked** → select the `illini-clean-build` **folder** itself, without opening it | The card loads with **no errors** and no yellow warning triangle | A manifest or file error that only appears on a clean load |
| 2 | | Open the card's **service worker** link → Console, filter `illini-dash` | `installed: install` followed by `first install — opening the setup tab`, and a tab that opened by itself | `onInstalled` did not fire, or fired and did not open it. Both branches are logged, so the console answers this even if you did not notice the tab at the time — which is exactly what happened on the 2026-09-12 run |
| 3 | | Read that screen without clicking | You can tell which sites to tick from the one-line hints alone | The hints are written for someone who already knows what PrairieTest is |
| 4 | | Look at the toolbar | Chrome's own "extension added" bubble — does it name Illini Dash and show the right icon at toolbar size | The 32px icon, which was added late and never seen in the wild |
| 5 | L | Tick the four defaults, press **Open all sign-in pages**, sign in to each, then **come back to the setup tab** | Rows tick green **without you pressing Sync** — returning to the tab re-checks anything waiting on a login | The 2026-09-12 defect: the screen redrew from a store nothing had refetched, so signing into all four changed nothing until Sync was pressed by hand |
| 6 | L | Open the popup. Then open Settings and put `#dev` on the end of the address (`chrome-extension://…/options.html#dev`) — the build ids are in the Developer section, which is hidden until the address asks for it | In the popup, the footer strip: a dot, then `N sources · synced just now`, with **Sync now** beside it. Under Developer: `This page: build …. Service worker: build ….`, both matching the zip's filename | A stale worker — and note that when the two ids **disagree**, a warning says so at the top of Settings without `#dev`, so a student never needs this address. A green dot over a source that never fetched |
| 7 | | Settings → Sources → switch **ECE 310** on (public; CS 424 is behind SSO) | It goes "Checking…" → "Connected" **within a few seconds**, not at the next poll | The fix in `962add6`; this is the one that lands in every tester's first five minutes |
| 8 | | Open **Settings** (the gear in the popup — it opens as an ordinary tab), right-click the page → **Inspect** → **Console**, and paste `await chrome.runtime.sendMessage({ type: "test-notification" })` | `{type: 'ok'}` printed in that console **and** a real macOS notification titled "Illini Dash — test reminder" | Four distinguishable answers, and the table under this one says what each means. The notification path has never once been seen fire outside a unit test |
| 9 | L | Quit Chrome entirely, reopen it, open the popup | The list is still there and the status line is not "Not synced yet" | Storage or the alarm not surviving a restart |
| 10 | | `chrome://extensions` → Remove | It goes, and `/tmp/illini-clean-profile` is all that is left to delete | — |

### Step 8, and why it is a line in a console rather than a button

**There is no "Send a test reminder" button any more, and it is not coming back.** It was
deleted on purpose in `5fc0357`, with four other controls that did by hand what already
happens; that was a simplification Sushi asked for, and restoring a prominent control to
make a checklist executable would be the tail wagging the dog. What survived the deletion
is the worker's handler — `src/background.ts:2574` still answers a `test-notification`
message, and `src/messages.ts:97` still declares it — so the path is reachable, just not
from anything a student can press. That is exactly what a developer-only step should look
like.

**Which console, and it matters.** A popup and the service worker have different consoles
and neither shows the other's output (CLAUDE.md, UI rule 1), and five rounds of "nothing
in the console" have already been spent on the wrong one. This step uses **the Settings
tab's own console** — Settings is an ordinary tab with ordinary devtools, so it is
right-click → Inspect → Console, no hunting. It must not be the service worker's console:
a worker's `chrome.runtime.sendMessage` is not delivered to that same worker's own
`onMessage` listener, so pasting it there returns nothing and proves nothing.

Paste exactly this:

```js
await chrome.runtime.sendMessage({ type: "test-notification" })
```

| What comes back | What it means |
|---|---|
| `{type: 'ok'}` **and** a notification appears | The path works. This is the observation that has never been made. |
| `{type: 'ok'}` and **no notification** | Chrome sent it and **macOS dropped it**. macOS silently discards notifications for an app that was never granted them: System Settings → Notifications → Google Chrome. Check there *before* suspecting the code. This is the one ten testers will hit, and `beta-install.md` says so. |
| `{type: 'error', message: 'Chrome is blocking notifications from Illini Dash…'}` | Chrome's own per-extension notification setting is off, one level above macOS. The message names the page to fix it at. Not a code defect. |
| `{type: 'error', message: 'unknown request type "test-notification" (worker build …)'}` | The running service worker is older than the zip you just loaded, and the build id in the message says which. Reload the card at `chrome://extensions` and repeat. |

A fifth outcome — the console throwing rather than returning — means the message never
reached a worker at all, which on a freshly loaded unpacked extension is a load failure
step 1 should already have caught.

**What this step does not cover.** It exercises `chrome.notifications.create` and the
blocked-notifications guard, which is precisely what the deleted button exercised — it
does **not** walk `fireNotification`, the lead-time arithmetic or quiet hours. Those are
pinned by the suite and by nothing else, and no hand-run on a clean profile has ever
reached them. Say that plainly rather than letting a green step 8 imply more than it
measured.

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

Two channels exist in the build. **The third one was deleted and has not been replaced**,
which is a decision for you before the beta starts rather than a fact to work around.

1. **Report this page** (right-click on a page whose deadline is missing, or Settings →
   Your data → "A deadline is missing" → Prepare report) — fetches the page, scrubs it,
   hands them a file. This is the single most valuable thing a tester can send, because a
   new fixture is what fixes a parser.
2. **Every use of Split** on a row — ask them to tell you, with the two titles. This is the
   G3 measurement that n=1 could not make. `⋯` → Split.
3. **Copy diagnostics is gone.** It was deleted in `5fc0357` on the reading that "the
   broken-page report carries the same facts and reaches a person". **It does not.** The
   report is a scrubbed copy of one HTML page; the diagnostics were which sources worked,
   item counts per course, and what failed and when — a different question, and the only
   one that can be asked of a tester whose answer is "it looks fine". `buildDiagnostics`
   in `src/core/diagnostics.ts` still exists and the worker still answers
   `get-diagnostics` (`src/background.ts:2549`), but nothing calls either, so a tester has
   no way to produce it.

   Settings → Your data → **Export JSON** is the only thing left, and it is not a
   substitute: it contains assignment titles and links, so it is not safe to paste into a
   thread and it is not what you would ask ten people for.

   **This is a decision, not a fix to make quietly** — see the note at the end of this
   document.

### The exit question, at the end of the week

Ask exactly this, of all ten, and record the answer verbatim:

> Would you keep Illini Dash installed next semester? Yes / no — and what is the one
> thing that would change your answer?

Seven yeses is the gate. The second half is worth more than the first.

### The tracking table

| Tester | Major | Sources they use | Installed | Splits reported | Broken pages | Would keep? |
|---|---|---|---|---|---|---|
| | | | | | | |

("Diagnostics received" was a column here. The control that produced them no longer
exists — see "What to collect" above — so it was a column nobody could ever fill.)

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

- [x] Register the Chrome Web Store developer account — done; item id
      `mimgaiaicopabbiabakmknkcbfekplei`, status Draft
- [ ] Upload the current zip from `release/` — `ls release/` names it; never type a
      version into this list. **Re-upload after any manifest change**, and the manifest
      has changed a great deal since the first upload: the draft was uploaded before
      `scripting`, `identity` + the `oauth2` block, and `cookies` were added, and before
      the version reached 1.2.0. The uploaded package's permission set is stale, so
      nothing below can be answered against what the reviewer currently sees
- [x] Paste <https://sushelan.github.io/illini-dash/privacy.html> into the Privacy tab
- [ ] Per-permission justifications — **all eleven blocks**, and replace every one rather
      than adding the new ones. The exact text is in
      [privacy-practices.txt](store/privacy-practices.txt), each block measured against
      the 1000-character limit its own header states, by `tests/manifest.test.ts`. This
      was ticked when the file held nine; `scripting` (2026-09-18, the Campuswire
      observer), `cookies` (Piazza) and `identity` (the Google Calendar scope) joined
      after the draft was uploaded, and the host-permission block now also names
      `www.googleapis.com`. Nothing in the developer console has been updated since
- [ ] Upload the screenshots from `docs/ux/after/` (1280×800) and the promo tile (440×280)
- [ ] Declare data use: **Website content only**.

      This said "no data collected", and that was wrong. Google's User Data FAQ: extensions
      must disclose how they handle user data *"even when data is processed or stored
      locally on a user's device and is not transmitted to external servers or third
      parties"*, where handle means "collecting, transmitting, using, or sharing". Local
      only is not exempt. Reasoning for every other box is in `privacy-practices.txt`.
- [ ] Certify the three statements, and **read the first one before ticking it**. "No
      selling or transferring to third parties" is still true, but the sentence this
      project used to carry — *"there is no transfer at all"* — is not. The optional
      Google Calendar sync transfers the student's own deadlines to the student's own
      Google account, at their request, never to the developer and never to a third
      party. `privacy-practices.txt`'s CERTIFY block states it that way; say the same
      thing in the console rather than the old, simpler, false version
- [ ] Test instructions (Access tab, 500-character limit) — drafted and approved by Sushi
      on 2026-09-19, in [test-instructions.txt](store/test-instructions.txt); paste the
      block between the two rules. A reviewer has no UIUC account and will otherwise see
      five sources saying "Sign in needed" and call it non-functional. The public page it
      walks them through is `ece411-fa26-mp`'s, which is live in `adapters/registry.json`
- [ ] Distribution tab → Visibility → **Unlisted**, then Submit for review

---

## Open for Sushi, not for the next agent

**The beta has no diagnostics channel.** See "What to collect" in Walk 2. Deleting Copy
diagnostics was right about the button and wrong about the replacement: the broken-page
report answers "this page is misparsed", and nothing answers "which sources worked and
how many items did each course produce" — which is the question you have to ask ten
people, including the nine who say it looks fine. Three ways out, and this is your call:

1. **Start G4 without it** and ask for a screenshot of Settings → Sources instead. Cheapest,
   and it loses the item counts, which is the number that catches a silently-empty source.
2. **Put the diagnostics back somewhere a student never looks** — `options.html#dev`
   already exists and is hidden until the hash. The handler and `buildDiagnostics` are
   both still there with no callers, so this is a button and a `send`, not a feature.
3. **Ask testers for a console line**, the way step 8 now does. Free, and it asks ten
   non-developers to open devtools, which several will not do.

Nothing else in this document is blocked on the answer.

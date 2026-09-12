# Progress

Spec: SPEC.md. Build order §10, gates §9. Detailed evidence lives in `docs/`.

`npm run build`, `npm run typecheck`, `npm test` (911 tests) all pass.

**Steps 1–12 are done. G0–G3 have passed. G4 and G5 are Sushi's and cannot start
from here.**

## UI reference refresh — 2026-09-11
- Updated light/navy surfaces, orange selected tabs and today marker, rounded course
  filters, sync toolbar, and full-width framed calendar with larger date navigation.
  No Illinois logo, building, or slogans. Existing calendar behavior is unchanged.
- Verified dark and light month previews and dark compact popup using the real popup
  document with canned data. Build, typecheck, and all 831 tests pass.
- G4/G5 remain pending. Native Chrome popup sizing still requires Sushi's extension
  reload; no body/html scroll container or popup width media query was added.

## UX plan for the store release — 2026-09-11
- Reviewed every surface in the real popup document (dark first), the full view and
  Settings; six "before" captures in `docs/ux/before/`. Findings and a seven-phase plan in
  [ux-plan.md](docs/ux-plan.md): three blockers (a sat exam counted as Overdue, the
  first-run primary button invisible in dark, white on the orange accent at 3.0:1), then
  the popup's 322px of chrome, a component system, Settings, first run, notifications and
  store assets. Five decisions for Sushi are listed in its §7.
- Nothing in the extension changed. G4/G5 unchanged.

## The one source with no login page — 2026-09-12

*"For reading the cs424 website it just says sign in needed but it doesnt link me to the
sign in page."*

`LOGIN_URL` has no entry for `site`, and the comment saying why is correct: *"a course
website is whatever host the adapter points at, and there is no single page to open."*
True in general — and the reason the one source a student cannot guess the address of was
also the one with nothing to press.

But the page **is** known, at the moment the logout is detected: it is the adapter URL
that just answered 401. `syncOneSource` records it (`SourceStatus.loginUrl`), and
`actionFor` falls back to it when there is no fixed form. For a Shibboleth-protected
course page that URL is both the sign-in trigger and the destination — the student lands
on the schedule rather than on a login form and then nowhere. The **requested** URL, not
`finalUrl`: `finalUrl` is the middle of a SAML handshake.

Chasing it found the real shape of the bug. **Four surfaces were each deciding what a
sign-in link is**, all by reading `LOGIN_URL[source]` for themselves: the first-run
checklist, the popover row, the empty state and the stale banner. One decision in four
places, wrong in all four for the same source. They go through one `signInUrl` now. One of
them had its own defect alongside: the button counted the sources and *then* skipped the
ones with no URL, so "Open all 5 sign-in pages" could open four and say nothing about the
fifth.

Two things about the mutation pass. `loginUrl: err.page.finalUrl` **survived**, because
the 401 fixture answers in place — `url === finalUrl` there, so it cannot tell them apart.
The assertion moved to the Shibboleth fixture, which is the only one where they differ
(parser rule 10: where a realistic fixture cannot distinguish a wrong implementation, use
the one that can). And the harness could not reach the state at all until `?fail=sitelogin`
existed, which is the same finding as every previous live defect.

**And the preview stated a version that does not exist.** `getManifest` was stubbed
`0.1.0` while the manifest said `1.0.0`, so every Settings capture — and
`docs/ux/after/options*.png` are candidates for the store listing — showed a version
nobody could install. It is defined in from `public/manifest.json` at bundle time now: a
harness that asserts a fact about the build has to read it from the build.

`node scripts/shots.mjs <name>` already filtered; using it turned a twelve-minute
iteration into thirty seconds.

973 tests, 38 shots.

## A course site on its own domain, and a slug where a course name should be — 2026-09-12

**cs124.org could not be added at all.** §2.3 declared `https://*.illinois.edu/*` as the
only optional host permission, reasoning that *"course sites live on many subdomains
(courses.grainger.illinois.edu, courses.engr.illinois.edu, cs.illinois.edu, …)"*. That was
not stale — it was **incomplete when written**. The CS department's course sites are their
own domains: cs124.org, cs128.org, cs225.org. The rule excluded precisely the students most
likely to want the feature.

Widened to every https host, **optional only**, Sushi's decision. It is safe because of a
rule that already existed: `validateAdapter` requires an adapter's `hostPattern` to name
its own host *exactly*, so a registry entry can never request more than the one site it
describes and the student sees that host in Chrome's own prompt. Widening the declaration
does not widen what any single adapter can ask for.

Widening it did expose one hole the exact-pattern rule cannot cover: **an adapter naming a
host the extension already holds**. Those need no permission prompt, so enabling one would
prompt for nothing, grant nothing, and then read arbitrary Canvas or Gradescope pages under
a permission granted at install for something else. Refused now, derived from the source
modules so a sixth source cannot be added without this list learning about it.

**And a Gradescope course was labelled `stat_425_120248_268442`**, overflowing its 60px
chip and painting on top of "homework 2 (UG)". Two defects in one screenshot:

1. **The chip did not clip.** A grid item does not clip to its track, and `.chip` had no
   `max-width`. Ellipsis rather than a wider track: the track is 60px because the title
   needs the rest, and one oddly-named course must not re-columnise every row.
2. **§5.1 declined the slug**, so the raw string became the label. `canvas-findings.md`
   recorded declining it as correct, **and it was — for Canvas**, which carries a
   human-readable `name` beside the slug and was amended to read that. Gradescope has no
   such field. The amendment was applied to one source and the finding it came from applied
   to two.

`\b` could not express the fix: an underscore **is** a word character, so there is no
boundary between `425` and the `_` after it. Both ends are explicit lookarounds now.

**The test was pinning the defect** (worker rule 6): `tests/gradescope.test.ts` asserted
that course 1273605 yields *no* code — and that course is `ece_408_120261_257494`, which
is ECE 408, a real course a real student is enrolled in. And `extractCourseCodes` had no
direct test at all until now, which is how one assertion inside a parser suite came to
define what every row on the calendar is called.

One mutation survived: `\b` at the *head* of the pattern, because every slug in every
fixture starts the string. A term-prefixed one (`fa26_stat_425_…`) reaches it, and no
capture in this repo has one — so the test says in as many words that the value is
invented (parser rule 10, house rule 12's form).

**Still open, and Sushi's call:** a course whose name contains no code at all still shows
its raw name. A manual rename would fix that, and is the right shape for names no rule can
derive — but it should stay the fallback, not the first answer: a student should not have
to type `STAT 425` for a label the slug already contains.

1000 tests.

## The debounce asked the wrong question — 2026-09-12

Sushi, diagnosing it exactly: *"When I go to the popup it checks. Then when I sign in and
come back within 10s, it doesn't check again cuz it's within the 10s time, so I have to
wait until that 10s period is over then come back to the popup for it to check."*

Right, and it is my error rather than a tuning problem. `RECHECK_AFTER_MS` asked **how long
has it been**. The question is **has anything happened**. Signing in is evidence; idle
tab-switching is not; a clock cannot tell them apart — so the debounce suppressed precisely
the case it exists to serve, and it suppressed the *navigation-triggered* sync too, which
is why the new listener did not rescue it either.

The worker records when a page last finished loading on each source's own site
(`storage.session`, since a navigation from a previous browser session says nothing about
this one's cookies), and `sourcesToRecheck` treats a navigation newer than the last attempt
as overriding the window entirely. Both the worker and the popup read the same map, or the
two would disagree about whether an attempt is stale — which is the ten seconds all over
again, one process apart.

**Self-limiting without a second timer**: once the re-check runs, `lastAttemptAt` is newer
than the navigation and the clause stops firing until the next page load. That is the
property worth keeping; a timer would have needed one more number to get wrong.

One mutation survived — `>` against `>=` on the tie — and it was a real undecided case
rather than an untested one. `lastAttemptAt` is stamped when the sync *starts*, so a
navigation on the same millisecond may or may not have been seen by the fetch, and **the
two mistakes are not equal**: an unnecessary re-check costs one request, a skipped one
costs the student half an hour of "Sign in needed" while signed in. Decided for `>=`, and
pinned.

988 tests.

## A screen that could not say "checking" — 2026-09-12

A screenshot: a fully signed-in Gradescope Course Dashboard, with the first-run screen on
top of it reading **Sign in needed**. *"Either there's a really long delay or it's waiting
on something to trigger the sync."*

**Both readings were available because the screen offered no third one.** The store is
written once, at the end of a sync, so for the five to ten seconds one takes, every row
asserts the *previous* answer with nothing to say it is being re-read. The header pill has
said "Checking…" throughout — and the first-run screen has no pill, which is exactly why
it needed its own word.

Two things were missing, not one:

1. **A sync this page started** set `syncing`, but nothing redrew until it finished, so
   the rows never showed it. `runSync` now redraws the checklist at the *start*.
2. **A sync the page did not start** was invisible entirely — and that is now the common
   case, because the navigation listener fires while the student is on Gradescope. The
   worker publishes an in-flight flag in `chrome.storage.session`, which is exactly the
   right lifetime: true for the life of the worker, meaningless after it, and a crashed
   worker cannot leave a window spinning on a flag written to disk.

**And the "Sign in needed" chip now carries what the site actually answered.** The two
error states had that tooltip and the one people get stuck on did not — which is the
difference between *the cookie is not reaching us* and *the page says something we
misread*, and nothing else on that screen can tell those apart.

The harness could not reach the state, again and for the same reason: its `storage.session`
stub answered `{}` forever, so "a sync is running" was unreachable by construction. It
keeps a real store now and the sync stub publishes the flag the way the worker does.
`?setup=1&slow=4000` shows every enabled row reading "Checking…" mid-sync and settling
after.

**This is a visibility fix, and it may not be the whole report.** If Gradescope still says
"Sign in needed" after a sync visibly completes, the tooltip now names the page that was
served, and `[sync]` carries the status, final URL and first 120 characters. The marker is
`js-logInButton`, documented as absent from the real signed-in dashboard capture — so a
house-rule-12 misfire is *not* the leading hypothesis, and the leading one is that the
session cookie is not reaching a service-worker fetch. Both are decided by the same line.

982 tests.

## The signal we never had: a page finishing on the site itself — 2026-09-12

*"Gradescope and prairietest dont sync until i click on smth in them after signing in."*

**The click was not completing the session. It was producing the trip back.** Every login
defect in this project has come through the same hole: the only thing that ever prompted a
re-check was the student *returning to the popup*. Sign in, stay on Gradescope, and
nothing happens; click around, wander back, and it works — which reads as "clicking fixes
it" and is really "looking at us fixes it".

Chrome does have the event, and it needs **no new permission**: `tabs.onUpdated` reveals a
tab's URL only to an extension that already holds a host permission for it. That is
exactly the five sites the student switched on — not history, not other tabs, and not the
SSO hosts in between, which is also why the *final* landing is the right moment to act on.

It fires on **every** completed navigation rather than only the first, and that is what
makes it correct whichever way the session actually settles: if the cookie is live at the
redirect we catch it there, and if the site needs one more click we catch that too. So it
does not depend on my being right about *why* Gradescope and PrairieTest lagged — which
matters, because I am not certain. Those two are the only sources whose signed-out
detection reads a body marker rather than a status code (house rule 11), so a transitional
page is a live hypothesis, and the `[sync]` line now carries the status, final URL and
first 120 characters of whatever was served.

`sourcesToRecheck` is what keeps this from being a fetch per page view: it answers only
for a source *currently* waiting on a login, and it holds the debounce.

`core/origins.ts` matches hostnames **in full**. `endsWith` would accept
`evilwww.gradescope.com`, and the consequence is not cosmetic — this function decides
whether a page finishing in any tab makes the extension go and fetch. The mutation
**survived** the first suite, because the hosts I had reached for (`notgradescope.com`,
`www.gradescope.com.evil.test`) do not end with `www.gradescope.com` and so pass a suffix
match too. House rule 12 in its most literal form: the adversarial case has to be built on
purpose, and a plausible-looking one is not it.

**The privacy policy now says this**, and is republished. No permission changed and no new
data is read, but "it notices when a page on one of those sites finishes loading in a tab"
is a true sentence about the extension that was not in the document, and the policy is the
one place that has to be complete rather than merely accurate.

982 tests.

## The sync took the sum of its sources — 2026-09-12

*"There's a delay when I log into gradescope, prairielearn and prairietest and on the sign
in screen it says they're not connected. It takes some time, maybe it gets hung."*

It was hung, in the sense that mattered. The loop **awaited each source in turn**, so a
sync cost the sum of its sources rather than the slowest one. With `REQUEST_TIMEOUT_MS` at
20 seconds and six sources, one site sitting on a request delays every source queued
behind it — and because the store is written **once**, at the end
(`background.ts:287`), the screen shows the pre-sync answer for the entire wait. Three
sources reading "not connected" while they are in fact being read is not a cosmetic
problem; it is the screen asserting something false.

Every source that is going to be read now starts before any of them is awaited. The
decision of *whether* to read still happens first, so §6's backoff is not quietly
defeated, and outcomes are still applied in `PLANS` order, so the store does not depend on
which host answered first.

**Safe because the fetches were already concurrent one level down.**
`MAX_CONCURRENT_PER_HOST` runs four requests per source at a time, so the offscreen parser
has always had several parses in flight; different sources are different hosts, so nothing
here shares a rate limit either. This is the one argument that makes the change small
rather than frightening.

The test asserts the property rather than the clock: **every source has begun fetching
before any of them has finished**, using a gate that records who asked and resolves
nothing until released. A wall-clock assertion would measure the machine and flake.
Mutated back to sequential: killed. Mutated to start a backed-off source: killed.

**And the `[sync]` line now carries a duration** — `prairielearn: ok (12 items, 9
requests, 8.4s)`. "The sync feels slow" is not actionable; "one source sat for 20.0s" and
"one source made nine requests" want opposite fixes and now say which. Worker rule 5: add
the line rather than spend another round trip in Sushi's browser. A resting source prints
no duration, because "0.0s" would read as "answered instantly" when it means "was never
asked".

## Export moved to the bar, and it cost thirteen pixels — 2026-09-12

*"There should be a calendar icon in the popup/full screen view at the top right directly
instead of having to go into settings each time to download a .ics."*

It lived under **Data & privacy**, which is where you go to understand what the extension
stores — not where you go to put this week in your calendar. It is an icon in the bar now,
in both windows, and `src/ui/download.ts` holds the one answer to "which items go in the
file" that Settings and the bar now share. Two copies of that filter is how one surface
ends up exporting hidden rows and the other does not.

**The popup is 400px and the sixth control cost the sentence.** Measured, not guessed:
"Gradescope didn't answer" went **13px** over and ellipsed. The pill is the only thing in
that bar that can shrink, and it is the thing that says what is wrong, so the 13 came back
off the fixed costs instead — two pixels from each of four icons (26 → 24), two from the
bar's padding, one from the pill's. All five pill sentences measure unclipped at
`bodyW: 400`.

**The full view's buttons were borrowing the popup's answer.** 28px in a 1280px bar made
the only three controls up there read as an afterthought. 34px, with 18px glyphs — still
smaller than the tab strip below, which is where the eye should land first.

**On making the .ics sync itself:** it cannot, and the reason is architectural rather than
effort. A calendar that updates itself is a *subscription* — a URL the calendar app polls
on its own schedule — and that needs a server. This extension has none, deliberately, and
the published privacy policy says so in as many words: "There is no server, no account, no
analytics, no telemetry." The button's status line says "a one-time copy, not a
subscription" for that reason. The nearest real alternative is **Add to Google Calendar**,
already on each row's `⋯` menu, which hands one deadline to a calendar that does sync.

975 tests.

## Still open — PrairieLearn and PrairieTest "have a delay to show connected"

Reported on the same run and **not diagnosed**. What the code establishes: the sync loop
is sequential over sources and the store is written **once**, after all of them
(`background.ts:287`). So within one sync no source can turn Connected before another —
they flip together. That leaves two candidates, wanting opposite fixes:

- they are genuinely the slowest (PrairieLearn fetches course instances, then an
  assessment list per course), and the whole sync waits on them; or
- a sync **skipped** them — a non-manual trigger skips sources in backoff
  (`sync.ts:581`), which would park them for up to half an hour after one early failure.

The `[sync] <source>: <state> (N items, R requests)` line distinguishes these in one
reading, and Sushi has been asked for it.

## Clean-profile run: signing in changed nothing until you pressed Sync — 2026-09-12

The first thing the clean-profile walk found, and it is the first five minutes of
every beta tester's install. Sushi: *"when I signed in, it didn't update the status
automatically... I signed into all of them and it still said not signed in, so I clicked
on show calendar anyway, and it still said not signed in. Only after I clicked the sync
button everything synced up."*

`beta-install.md` has been promising **"come back and the dot clears itself"** since the
guide was written. Nothing did it.

**`needs_login` is the only state whose fix happens where the extension cannot see it.**
Every other failure resolves on our own schedule — a network error clears when the site
answers, a parse error clears when we ship a selector. A login is fixed in a different
tab, on a different origin, by a form we never touch, and *no event crosses back*. So it
is the one state that has to be re-checked on the student's **return** rather than on the
poll, and it was the one state nothing re-checked.

The popup did have a `visibilitychange` listener. It called `refresh()`, which reads the
store and redraws — and the store still held the pre-login answer, because nothing had
fetched. A redraw of a stale fact is indistinguishable from a fact.

Two more layers were hiding underneath, and both are judgements that signing in
invalidates:

- the sync fired on popup open is `trigger: "popup"`, **debounced to five minutes**;
- a source that has failed a few times is **in backoff**, which every trigger except
  `manual` skips.

Both are correct reasoning about a source that has not changed. Signing in is exactly the
event that changes one, and neither had any way to hear about it. `core/health.ts` gains
`sourcesToRecheck`, which holds the rule and its own debounce — ten seconds, because
`visibilitychange` fires on every tab switch — and the three moments that mean "I am
back" now use it: opening the popup (a fresh document, so `visibilitychange` never fires
for it — opening *is* the return), returning to the full view or Settings, and pressing
**Show my calendar**, which is the clearest "I have finished signing in" a student can
say and was landing on a calendar still asserting nobody was.

A `Number.isFinite` guard written alongside it **survived its mutation and was deleted**:
`Date.parse` of nonsense is NaN, every comparison against NaN is false, and the
comparison already did the whole job. Mutation house rule 2's third case — a second guard
that rejects exactly what the first does is not defence. The test it was written for
stays, and now pins the surviving form: flipping `< WINDOW` to `!(>= WINDOW)` fails it.

And the harness could not have shown any of this, for the usual reason. The preview's
signed-out Gradescope carried `lastAttemptAt: new Date()` — a source that failed a login
*this second*, which is the one shape the return-from-signing-in path cannot occur in,
since the debounce suppresses it. Dated two minutes back, all three call sites are now
observable in the real popup document: opening fires `popup` then `manual`, returning
fires `manual`, and **Show my calendar** fires `manual`.

967 tests.

## The store documents, aligned and published — 2026-09-12

**The one store file no test read is the one that drifted.** `tests/manifest.test.ts`
pinned `listing.md` against the manifest and said nothing about `privacy-policy.md` — so
the listing stayed correct and the policy went stale, which is the worse way round: the
policy is the document with a public URL and a legal claim in it. It told students the
extension reads **four** sites while the manifest held an up-front host permission for
**five**. smartPhysics has been a first-class source since 2026-09-10, named in the
listing's own one-liner, and absent from the policy entirely. `contextMenus` was missing
too, and the registry fetch was described as "a public file on GitHub" rather than
`raw.githubusercontent.com`, which is the host a reviewer has to match against
`host_permissions`.

The policy is now derived from the same things the listing is — every source origin, every
manifest permission, the registry host, and the number of granted sites written as a
*count* rather than as a word typed once. The manifest `description` had the identical
gap, naming four of five sources under an install button that asks for all five. Five
mutations, five killed. `package.json` still said `0.1.0` next to a manifest at `1.0.0`.

**The policy is live**: <https://sushelan.github.io/illini-dash/privacy.html>, served from
an orphan `gh-pages` branch holding three files, so nothing in `docs/` becomes a website.
`scripts/site.mjs` generates it from `docs/store/privacy-policy.md` — a hand-written copy
would be a second policy checked by nothing, which is exactly how the first one went
stale. The renderer handles the markdown subset that file uses and **throws** on anything
else: a bullet list emitted as a literal dash on a legal page is silent-empty in its
public form. It caught its own first bug that way, when a markdown link leaked through as
literal text. Measured AA in both modes.

**[pre-submit.md](docs/pre-submit.md)** now holds the two walks that cannot be run from
here: the clean-profile install (ten ordered steps, each saying what a failure would mean
— the setup tab on install, the pin card, a real notification, and the course-site enable
from `962add6`, none of which has ever been observed outside a unit test), and the G4 beta
(why the spread has to be across *sources* rather than majors, since G3 passed on n=1 and
the badge-token trade is still unmeasured).

959 tests.

## Light carries the brand hue; switching a site on now reads it — 2026-09-12

**"Why is light mode just white and orange?"** Because the palette's own first principle
was only ever applied to one end of it: *"the page itself is navy, not grey with a blue
bar on top — that is the whole difference between an Illini product and a grey box wearing
a hat."* Light was `#ffffff` with two faintly blue tints, which is that grey box in white.
The light surfaces are a blue ramp now — `--bg #eaf1fb`, `--tint #dbe7f7`,
`--tint-strong #ccdcf2`, `--line #b5cce7` — with `--surface-raised` staying pure white,
which is what makes a menu read as *raised* rather than as more page. The course washes
were deepened with it: a wash tuned to sit on white is invisible on a blue ground.

Everything on those surfaces was re-measured against them rather than against white, and
**two things had slipped under AA**: `--ok` at 4.42:1 on the new header tint, and the
wordmark at 4.47:1. `tests/tokens.test.ts` now computes `--fg`, `--muted`, `--ok`,
`--warn` and `--err` against both `--bg` and `--tint` in all six palettes — and writing it
exposed a bug in the test itself, which resolved a dark theme's missing tokens through the
*light* root instead of `:root.is-dark`, reporting a 2.83:1 failure that did not exist.
A test that measures the wrong values is worse than no test.

**"I enabled the CS 424 course site and it still says checking."** Three separate faults
in one sentence:

1. **Nothing fetched.** Enabling a source or an adapter wrote the flag and stopped, so the
   state stayed `pending` until the next poll — up to half an hour of "Checking…", which
   is indistinguishable from broken. The first-run screen has always synced on enable;
   Settings was the one place that did not.
2. **`set-adapter-enabled` wrote `state: "ok"` by hand**, which is worker rule 2's own
   defect — a source reporting success before a single request. Masked only because
   `displayState` calls a never-attempted source `pending` anyway; switch a site off and
   on after it had run once and Settings said "Connected" over a fetch that never
   happened. It goes through `statusAfterEnable` now, like every other toggle.
3. **Settings never redrew.** The popup has listened to `chrome.storage.onChanged` since
   the calendar landed; this page never did, so even once the sync finished the screen
   kept saying "Checking…" until a reload. Guarded on a focused control, so the switch
   under your finger does not move.

**Week view: merging labels shifted the due time.** The source column was `auto`, and the
comment that chose it — *"empty on a single-source row, so the title gets those 44px
back"* — stopped being true the day source codes started appearing on every row rather
than only merged ones. The reason went; the `auto` stayed. Measured across 17 real rows,
the clock landed at **five different x positions**, 700 for `PL`, 711 for `WEB`, 729 for a
merged `CV WEB`. Fixed at 44px (two codes; three ellipse, and the tooltip has named them
in full all along) — now one x for all 17.

950 tests.

## Light mode, the wordmark, and a pill that closes — 2026-09-12

- **Light or dark is a setting now.** It was never one: every dark value lived behind
  `@media (prefers-color-scheme: dark)`, so a student on a dark machine could not have a
  light calendar and one on a light machine could not have a dark one. The stylesheet
  keys on **one class**, `is-dark`, resolved once by `resolveDark(mode, systemPrefersDark)`
  — because a media query cannot be overridden by a choice without writing every dark
  value twice, which is colour-layer.md rule 3 in its most expensive form. Settings gains
  a "Light or dark" group under the palette: Match my system (default) / Light / Dark.
  `color-scheme` is stated per mode so a forced-light calendar does not get dark
  scrollbars.

  Two consequences, both found by looking: the component gallery renders light without
  `applyMode()` (fixed), and the theme picker's swatches paint themselves in their own
  palette and do **not** inherit the root's class — so the picker previewed three light
  palettes on a dark page until `syncSwatchMode()` kept them in step.

- **The pill closes when you press it again.** `openHealthPopover` closed whatever was
  open and then opened its own, so the second press closed the panel and rebuilt it in
  the same gesture — the one thing everybody tries.

- **"Illini Dash" in the bar**, top left, with the health pill beside it, in both windows.
  `flex: none` on the wordmark and the pill absorbing the slack, since the pill already
  ellipses.

  The bar now carries five things in 400px, so the fixed costs were trimmed (26px icons,
  tighter gaps, "Retry" rather than "Try again") until all four pill sentences fit
  unclipped. **And the orange failed contrast**: `--accent` on the header tint is
  **2.86:1** at 12px bold — the same failure `--accent-ink` had in phase A, on the one
  word that names the product. `--brand-mark` is a darkened orange in light (4.82:1) and
  the accent itself in dark (5.74:1); `tests/tokens.test.ts` computes it for all six
  palettes, mutation-checked.

- Rendering reviewed as asked, in both modes, across popup / full view / Settings /
  first run: a sweep for overlapping siblings and clipped text found **no overlaps** and
  no clipping except the row title's intended ellipsis. Width invariant holds.

949 tests.

## Live run: the source list was cut off — 2026-09-12

Reported on the Attention tab, and the tab is the clue. **A floating panel is positioned
out of flow, so it contributes nothing to the document's height — and Chrome sizes an
extension popup by measuring exactly that.** Reproduced: a document 179px tall against a
panel that needs 218 from y=34. The browser clipped it half way down the fifth row, and
nothing could scroll to reveal the rest, because the popup was not scrollable — it was
small. The shorter the tab's list, the worse it gets, which is why Attention showed it
first.

This is the note at the top of `popup.css` from the other side. That one is about *taking
away* the height Chrome measures; this is a panel that never contributed any.

`placeFloating()` now does both halves, for the health popover and the row menu:

1. **Asks for the room** — a temporary pixel `min-height` on `body`, cleared on close.
   Not the forbidden thing from colour-layer.md: a percentage or viewport unit removes
   the intrinsic height, a pixel minimum supplies one. Measured: the document goes
   179 → 218 when the panel opens and back to nothing when it closes.
2. **Copes without it** — capped at what a popup can ever be (600px) and scrolls inside
   itself, so the worst case is a scrollbar rather than a row that is not there.

Also `position: fixed` rather than absolute, so the cap is against the window; menus close
on scroll, because a fixed panel does not travel with the document and one left open over
a scrolled list points at a different row.

**And the harness could not reach it**, which is why it shipped: opening the panel takes a
click. `?open=health` clicks the pill once the open-sync has settled, and `popup-sources`
is in `npm run shots` — on Attention, the shortest page and so the smallest window.

## Live run: the hour axis had no room above it — 2026-09-12

"8 AM" was touching the 11:59 PM row above it. Measured: the end-of-day band ended at
y=411, the grid started at y=414 — three pixels — and the first hour label started at
y=409, which is *five pixels above the grid* and two pixels inside the last end-of-day
row.

Every hour label is shifted up 5px so it straddles its own gridline, which is what makes
an axis read as an axis. **The first label has no line above it to straddle**, so those
5px put it outside the grid entirely, on top of whatever band is there. The grid takes
5px of top padding to hold it in, the gutter takes an equal negative margin so its tint
still reaches the grid's top edge, and a 14px margin separates the two blocks.

Gap 3px → 17px, label inside the grid, tint flush with the top edge — all three measured
rather than eyeballed.

## Live run: the month's vocabulary, and duplicate tabs — 2026-09-12

- **The month showed finished work as if it were still owed.** The "is this done, late,
  or lost" decision lived inline in the popup's `renderRow`, and the month draws pills
  rather than rows — so it knew none of it. Extracted to `itemTone()` in
  `core/calendar.ts`, used by both, tested and mutation-checked three ways. The month now
  strikes through and dims finished work, takes `--err` on the edge and the course code
  for overdue, and `--warn` for a window still open.

  Worth noting *why* this surfaced now: before the previous fix, finished work never
  appeared on the calendar at all, so the month had nothing to get wrong. One fix made
  the next defect visible.

- **Clicking Month opened a new tab every time**, and so did "Open in a tab". The popup
  cannot fix this itself — it is destroyed the moment it loses focus, so it has nowhere
  to remember the tab it opened. The worker owns it now (`open-full-view`), keeping the
  tab id in `chrome.storage.session`, which is exactly the right lifetime: a tab id means
  nothing after a browser restart and session storage is gone by then too.

  **No new permission.** `tabs.get` and `tabs.update` work on an id you already hold; the
  `tabs` permission is only needed to *search* for tabs or read their URLs, and the store
  listing says it is not requested. `tab.url` is redacted without it, so it is checked
  only when present — a tab the student navigated elsewhere must not be yanked back, and
  an undefined url is not evidence that they did.

  The *view* is handed over through `localStorage`: both documents are the same extension
  origin, so a write fires a `storage` event in an already-open tab. A dedicated key, not
  `VIEW_KEY` — that one is written on every ordinary tab change, and a full view that
  followed the popup around would be a surprise.

940 tests.

## Live run: tab icons, and a month that stops moving the page — 2026-09-12

- **Icons on the popup tabs.** Dropped in phase C on the grounds that five labelled tabs
  once measured 454px — but that was 12.5px type, 11px of padding either side and a 14px
  icon. At 12px, 5px and 12px the strip measures **365px**, so both fit and the reasoning
  for dropping them does not survive being measured.

  The first attempt fit with *three pixels* to spare, which is a coincidence rather than a
  margin, and the thing on the other side of it is the worst failure in this project. So
  the strip also carries a structural guard: `min-width: 0` on the tab and the label means
  that if it ever does overflow, the labels ellipse and the document stays 400px wide. A
  clipped word is a bug you can see; a popup that opens at 800px looks like a different
  product. Verified at two- and three-digit count badges.

- **Switching to Month no longer slides the whole page.** The header, tabs and chips were
  on the same `--full-max` as the calendar, so Month's wider cap moved the entire
  interface 200px sideways and switching back moved it home — the whole page answering a
  question only the calendar had asked. The chrome sits at a fixed gutter now
  (`--chrome-max`) and only the calendar frame changes width (`--frame-max`): measured at
  a 1000px window, the pill, tabs and chips are at x=24 in **both** views and the frame
  moves 50 → 24.

## Live run: finished work with a late window open — 2026-09-12

Two reports, one defect, and the largest one found so far by volume of missing rows.

- Gradescope PHYS 435 **Homework 2**: submitted, due Sep 9 5:00 PM, still "accepting late
  submissions" until Sep 16. It appeared nowhere.
- Every completed **PrairieLearn** assessment with a reduced-credit tail — "100% until
  Sep 15, 80% until Sep 22" with a score already on it. Same. By October that is most of
  a semester's work.

`liveDeadline` promotes a passed deadline to the late one, because a deadline that has
gone is not the one that matters *while the work can still be handed in late*. **That
premise is false for work that has been handed in**, and the consequence was compounding:
the anchor moved into the future, so `isPast` said no, so `visibleItems` dropped the row
as finished-but-not-yet-past — and nothing drew it on the day it was actually due either.
So it was hidden from the future for being done, and hidden from the past for not being
past. A finished item's deadline is the one it was finished against.

- `isItemDone || isTickedDone` gates the promotion. Unfinished late work is unchanged —
  that is the case the promotion exists for, and saying "overdue" about something
  Gradescope is still accepting was the defect it was written to fix.
- Merged rows need **every** source to agree before the promotion stops; one submitted
  member out of two is not finished.
- Nothing was pinning this: all 925 tests passed before and after the fix. Ten new tests
  across `grouping` and `calendar`, three mutation checks, and both real shapes are in the
  preview data now — verified in the real popup, where they land on Sep 9, struck through,
  at 5:00 PM and 11:59 PM.

935 tests.

## Live run: "course websites off, but CS424 is still loaded" — 2026-09-12

The report is the whole bug: Settings said **Off** and the calendar still showed that
source's rows. Two branches of `runSync` kept them, and both said so in their comments —
"disabling a source in the options page should not delete history the user may re-enable",
and the `disabled` outcome explicitly marking its keys as *seen* so §5.4's miss counter
could not purge them either.

That reasoning is wrong, and the argument it borrowed is the giveaway. Keeping rows is for
a source that **failed** — a transient, where the source is still being read and will
answer again, and §11's silent-shrink is the risk. A source that is switched off is not
being read at all: its rows can never update, can never be flagged stale (`staleNotice`
skips `disabled`), and can never be corrected. **A row on the calendar is a claim that some
source currently reports this deadline**, and nothing was standing behind these. Nothing is
lost either — switching a source back on runs a sync, which is where the rows come from.

- `runSync` drops a source's rows in both disabled branches; the backoff and failure
  branches keep theirs, which is the case the argument was always for.
- `withoutRows(store, prefix)` applies the same rule **the moment the switch is flipped**,
  in `set-source-enabled` and `set-adapter-enabled`. The loop alone would leave up to a
  poll interval — half an hour — of "Off" over visible rows, which is the gap that was
  seen. Overrides survive: dropping rows must not drop the user's own corrections.
- `sourcePrefix` / `adapterPrefix` are one copy of the prefix rule for three callers.
  Switching off one course site no longer has to wait for the whole source to be re-read.
- **Three tests were pinning the defect** and are rewritten to pin the requirement
  (worker rule 6). One of them — "keeps items from a previous run while the source is
  switched off" — was Sushi's exact scenario, asserted backwards.
- Six mutations. One survived: dropping the colon from `sourcePrefix` changes nothing,
  because no current source name is a prefix of another. That is the *unreachable* case
  from CLAUDE.md's mutation rules, so the colon stays and the comment says why rather than
  a test pretending to cover it.

925 tests.

## Live run: the full view — 2026-09-12

Two more from Sushi, both in the tab, both from screenshots at ~1000 CSS px (2× retina).

1. **"The current week items aren't showing up."** The full view's Week was Sunday–Saturday
   and he opened it on a **Saturday**, so "this week" was six days that had already
   happened plus today — an empty grid whose only useful control was the forward arrow.
   That is precisely why the popup went rolling, and the argument does not weaken in a
   bigger window; it gets *more* visible, because there is room to draw all six empty
   rows. **Both windows are rolling now**, which also buys the one thing Sunday–Saturday
   was supposed to: a single definition of "week". The **month** stays Sunday-first — it
   is a grid of calendar weeks and genuinely is a calendar.
2. **"The fullscreen UI looks very weird."** Measured: **584px between the end of a row's
   title and the clock belonging to it.** The title track is `1fr`, so it absorbed every
   spare pixel and shoved the fixed right-hand tracks against the frame — the exact
   scanning problem the fixed tracks exist to prevent, and the M12 view-level cap did
   nothing about it, because a 1100px cap is inert in a 1000px window.
   - The title track stops at **420px** (≈60 characters; the longest real title is 48) and
     a trailing `1fr` takes the slack *after* the row. Clocks still align in a column.
   - The list cap drops **1100 → 900**, which is what the rows actually occupy — and it
     engages at a 1000px window, which is the width a laptop opens a tab at. The month
     keeps 1400.
   - "Today" moved from `margin-left: auto` to beside the arrows. It was 700px from the
     two controls it undoes.

   Gap is 200–360px now, bounded by the reserved track rather than by the window: a
   reserved track is reserved whether or not the title fills it, so every pixel of
   headroom is a pixel of gap on every short title.

## Live run: three findings from Sushi — 2026-09-12

All three from one session with the real extension. The first two are the same defect.

1. **"Gradescope couldn't be read" when the whole fix was pressing Sync now.**
   `sync.ts` classifies a failure into `parse_error` and `network_error` — §6 has two
   branches for a reason — and `healthPill` then said "couldn't be read" for both. That
   is worker house rule 2's own recorded example, reintroduced by this work one layer up,
   in the function that replaced the dots. A `TypeError: Failed to fetch` was being
   announced as "the page changed", which sends someone to debug selectors that are fine.
   Now: **"Gradescope didn't answer"** (retryable) vs **"Canvas looks different"** (needs
   a build). Four words, not five, because "Gradescope couldn't be reached" truncated to
   `…couldn't be rea…` in a 400px bar — losing the one word the distinction turns on.
   A test pins the character budget.
2. **Clicking the text offered nothing.** `SourceRow` carried a `loginUrl`, so the *shape
   of the data* said only a login was actionable — a source that could not be reached
   rendered as a red row with no button, in the popover and in the pill. `actionFor()`
   now returns one for every failing state (`login` / `retry` / `open`), and the pill and
   the popover both derive theirs from it, so they cannot disagree. The action sits as a
   named button beside the pill — "Try again", "Open", "Sign in" — because a sentence
   naming a site should not need a second click to act on.
3. **Sync took 5–10 seconds with the header still asserting the last result.** The pill
   reads **"Checking…"** for the duration now, repainted before the request rather than
   after it. The spinner is capped at `SYNC_SPINNER_CAP_MS`:
   `chrome.runtime.sendMessage` does not reject when the worker is torn down mid-answer,
   so without it a dead worker left the button disabled and turning forever.

**Why the suite did not catch any of this.** None of the three states was reachable in
the harness — the stub had no failing source and answered `sync` instantly. `?fail=network`,
`?fail=parse` and a 1.2s sync delay fix that, and `popup-unreachable` / `popup-unreadable`
are in `npm run shots` so both sentences are rendered on every run. The general form is
CLAUDE.md's own: *live data is a source of truth the fixtures are not* — and the answer
to that is not only to read the live output, but to make the state it revealed reachable.

918 tests; the classification, the per-state action and the ranking each mutation-checked.

## UX plan — polish pass and what is left — 2026-09-12
- **m10** nothing renders below 10px any more (was 9px on "+N more" and 9.5px on the hour
  axis, the week's gutter and the month header). 10px is kept only for tracked uppercase
  labels and the hour axis; everything else is 11 or up.
- **§4.2** `tabular-nums` on every clock, date number and count. Proportional digits make
  "11:59 PM" narrower than "10:00 AM", so a column of clocks does not line up on its right
  edge — which is the one thing the row's fixed tracks exist to buy.
- **m4** month pills take two lines in the full view. A cell is 137px and the course code
  eats 45 of them, so a one-line pill cut most UIUC titles before the noun; the tab has
  the height and the popup does not draw a month at all.
- **m2** the last text glyphs are gone: the Attention fold's `▸`/`▾` is an SVG chevron
  that rotates.
- Final check in the real popup document, **dark, light and High contrast**: body 400 /
  `scrollWidth` 400 / `overflowY: visible`, nothing past 401px outside the course strip,
  smallest type 10px, chrome 145px healthy and 211px worst case. In High contrast the
  health dot keeps a shape per state, which survived the six-dots→one-pill change.

### Still Sushi's — nothing here can be done from this side

1. **Load the unpacked build and report the console.** `npm run build`, load `dist/`, open
   the popup. What to look for: the header pill, and no `Could not draw the list` banner.
2. **A clean-profile install (phase E).** Does a tab open by itself, does it lead with the
   pin card, and does "Show my calendar" work. This is the one thing `opensOnInstall`'s
   test cannot tell us, because the test is about the argument and the question is about
   Chrome.
3. **One reminder toast (phase F).** The title should lead with the assignment, and the
   small third line should name the site.
4. **G4's beta**, then the developer account, the privacy-policy URL on GitHub Pages, and
   the pre-submit walk in `docs/store/listing.md`.

## UX plan phase G — store readiness — 2026-09-12
Sushi's decisions: **icon A (Dash)**, **version 1.0.0**.

- **Icon.** `public/icon-src/dash.svg` — a navy tile, one heavy orange bar, a white tick
  — rendered to 16 / 32 / 48 / 128 by `npm run icons` (headless Chrome, no dependency).
  **32 was missing from the manifest**, and it is the size a toolbar icon is most often
  drawn at on a 2× display: Chrome was scaling 16 up or 48 down, and a two-shape mark at
  a fractional scale is a smudge. The first draft had two bars at 14 units and they
  merged into a blur at 16px; the shipped one spends the whole width on one 20-unit bar.
  `docs/ux/icons/candidates.png` is the sheet both candidates were judged on.
- **Screenshots were listed as BLOCKED — "needs a browser and real account data".**
  Neither is true: the harness renders the real `popup.js` and `options.js` with only
  `chrome.*` stubbed, against row shapes taken from Sushi's own account. All five store
  images are generated by `npm run shots` and regenerate when the UI changes, so they
  cannot go quietly stale.
- **Promo tile** 440×280 from `ui.css`'s own tokens and the shipping icon.
  **Reminder screenshot** composites the real `notificationContent` output into Chrome's
  toast shape — the one image that is a mock, and the wording is quoted by
  `schedule.test.ts` so it cannot promise what the build does not do.
- **Manifest**: version 1.0.0, `homepage_url`, `commands._execute_action` (Alt+Shift+D),
  the 32px icon. Five new assertions in `tests/manifest.test.ts`, including that every
  icon file the manifest names actually exists.
- `docs/store/listing.md` updated: screenshots and version are ticked, `commands` has a
  justification.
- 911 tests.
- **Still Sushi's, and only Sushi's:** the developer account, the privacy-policy URL on
  GitHub Pages, G4's beta, and the clean-profile pre-submit walk.

## UX plan phase F — notifications — 2026-09-12
- **m15** a toast leads with the work. `CS357 — assignment due in 2 hours` put the one
  thing a student already knows first and the thing they have to act on second; it is
  `HW3 Errors and Big-O — due tomorrow` / `CS357 · Fri 11:59 PM · in 1d` now.
- `contextMessage` — Chrome's small third line — carries **which site**. A student with
  five sources had to open the popup to find out where to go and do the thing.
- An exam toast carries its room and duration, from the `examDetail` the parser has
  produced all along and no toast ever showed.
- The booking nag leads with the verb: `Book a seat: CS 357: Quiz 2` / `CS357 · sessions
  Sep 21–24`. Still never worded as a deadline (§4.4).
- `clampTitle` clamps **only the work**, and the words after it are appended — a real
  UIUC title ("MP1 Report (4cr only, EXCEPT for students in MC3)") is 48 characters
  before anything is said about when it is due, so a naive clamp drops the half that
  matters. Three mutations, all caught.
- `INSTALL.txt` in the beta zip described the six dots and the build id in the status
  line, neither of which exists any more.
- 906 tests.

## UX plan phase E — first run and install — 2026-09-12
- **M13** nothing used to happen on install. `opensOnInstall(reason)` in `core/setup.ts`
  — tested and mutation-checked — and `onInstalled` opens `popup.html?view=full` on
  `install` only. `update` is the branch where this would be actively wrong: Chrome
  updates in the background, and a tab that opens over what someone was reading is the
  behaviour that gets an extension uninstalled. Both branches log (worker rule 5).
- A dismissible **"Pin Illini Dash to your toolbar"** card, with the two clicks. Chrome
  leaves a new extension unpinned, so the badge — the only thing that tells a student
  something is due without them asking — sits behind the puzzle-piece menu. It is the
  project's own "never fail silently" rule at the operating-system level.
  **Only in the tab**, which is the screen the install opens: in a 400px popup it cost
  ~90px and pushed "Show my calendar" below the fold, to give advice to somebody who has
  just demonstrated they can find the icon.
- The checklist uses the same switches and state chips as Settings. It had invented four
  wordings of its own ("✓ connected", "needs sign-in", "could not read", "not used"), and
  "Sign in" replaced the state rather than sitting beside it — leaving a row whose state
  was a verb.
- `setupSummary` gained a `found` argument: once every chosen source has answered it says
  **"Found 43 deadlines across 6 courses"** rather than "All 3 connected". The second is a
  fact about plumbing; the first is what the student installed this for. It falls back
  whenever nothing was found, because "Found 0 deadlines" reads as a failure.
- 901 tests.
- **Still Sushi's:** the clean-profile install check (does the tab open, does the pin card
  read right). See the list at the end of this file.

## UX plan phase D — Settings — 2026-09-12
- A 1900px essay becomes a page you can navigate: a sticky section list built from the
  sections themselves (`data-nav`, so there is one list rather than two that can
  disagree), one line of description per section, and the paragraphs behind a "Why?"
  disclosure — still there, and out of the way of anyone who wants a switch.
- Top line: `Illini Dash 0.1.0 · All 5 OK · 11:16 PM`, from the same `healthPill()` the
  popup's header uses, so the two surfaces cannot disagree about the same second.
- Rows are switch · name · who it is for · state chip. **Sources finally say who each
  site is for** — the first-run screen had those hints and Settings listed the same five
  names with nothing to tell them apart. One copy now, `SOURCE_HINT` in `core/names.ts`;
  `core/setup.ts` reads it too.
- Quiet hours are two `<input type="time">` rather than two numbers between 0 and 23; the
  poll interval is a select (15 / 30 / 60 / 120) rather than a box that accepted 17.
  A stored value outside the four is added as its own option rather than silently
  becoming the first one.
- Reset is alone in a bordered "Careful" block. "Permission missing" no longer reads
  "Sign in needed" — nothing about a Chrome host grant is a login.
- m8: the NetID and full-name fields are behind "Prepare a report" under Help, with the
  reason ("used *only* to find them in the page and take them out") above them rather
  than in the middle of Settings on a page whose pitch is "never sees a password".
- The theme picker shows three swatches per row — the page, the accent, a course colour.
  "High contrast" and "Neutral" do not say what they look like, and the choice is visual.
- Two stale-build warnings share one container in the page's own margins; the
  `?stale=1` harness confirms both render and the other eight sections still draw.
  A `chrome.runtime.getManifest()` throw took the whole page down while this was being
  built — guarded, and the stub gained the method (worker rule 8).

## UX plan phase C — popup information architecture — 2026-09-12

Sushi's three decisions from ux-plan §7: agenda, rolling week, one health pill. All three
as recommended.

**The budget, re-measured in the real popup document.** Healthy **145px** of chrome before
the first deadline (was 215; target 144), worst case **211px** (was 322; target ≤226).

| Block | Was | Now |
|---|---|---|
| Header | 48 | 41 |
| Stale banner | 48 | 33 |
| Booking strip | 50 | 33 |
| Tabs | 47 | 36 |
| Course chips | 81 | 36 |
| Date navigator | 39 | 32 |

- **M4** six 9px dots and the status line that restated them 800px lower become one
  health pill, from `healthPill()` in `core/health.ts`. Clicking it opens a per-source
  list built by `sourceRows()` — the same facts, from the same function, that Settings
  shows. Signing in outranks a parse error, for `staleNotice`'s reason: one is ten seconds
  of work and the other needs a new build.
- **M2** the popup's Day is an agenda (`agendaRows`). Eleven empty ruled hours between a
  9 AM checkpoint and a 9 PM exam cost ~290px and put the exam below the fold. The full
  view keeps the grid, where the height exists — `full-day-dark.png` is the evidence for
  both halves.
- **M3** the popup's Week is a rolling 7 days from today; the full view stays Sun–Sat.
- **M5** all five tabs are named. The old rule — five labels measure 454px — was measured
  at 12.5px with an icon on every tab; without the icons and at 12px they fit in 400 with
  room to spare, and the width check confirms it.
- **M6** one 36px scrolling chip row. `overflow-x` is on the strip, never on `body`.
- **M7** sync spins the button that started it. **M9/M11** the status line is gone except
  when something is actually wrong.
- **M11** rows are `<a href>` with a roving tabindex, `⋯` is visible at 35%, the menu
  handles ↑ ↓ Home End Esc and opens on Shift+F10 / `.`, and its first item names the site.
  A keyboard walk in the real document found a defect no test could: the arrow handler was
  re-attached on every draw, so after the popup's own open-sync one press moved three rows.
- **m11** `popup.css`'s three stacked "refresh" layers are one. `.bar` was set three times
  and `.tab[aria-selected]` four, with the cascade deciding.
- Amendment: in dark Illini a calendar row now takes `--pill-fill`, the single navy the
  month pill already used. Eight washes chosen for an 11px pill read as a patchwork behind
  a full-width row — colour-layer.md rule 2. Measured: all six rows composite to
  `rgb(26,48,80)` against a `rgb(11,23,38)` page.
- Amendment to the width check in colour-layer.md: an element inside a deliberately
  scrolling strip may sit past 401px. `scrollWidth === 400` is the authoritative test.
- 894 tests; `agendaRows`, the rolling window, `healthPill` and `sourceRows` each
  mutation-checked (six mutations, one of which reported a false "survived" until the
  match count was asserted).

## UX plan phase B — primitives — 2026-09-12
- One component layer in `ui.css`, below the palette and containing no colour values of
  its own: `.btn` (`-primary` / `-secondary` / `-quiet` / `-icon`, plus `-sm`), `.switch`,
  `.chip-base` / `-state` / `-count`, `.pill`, `.banner-line`, `.menu-surface` /
  `.menu-item`, `.field`. One focus ring, one hover, one disabled, and
  `accent-color: var(--accent)` for the native controls that survive.
- `src/ui/icons.ts`: 19 inline SVGs on one 16px/1.5-stroke grid, built with
  `createElementNS` the way `tabIcon` already was. Replaces `⚙ ⤢ ⋯ ‹ › ▸` — text glyphs
  differ per machine, sit on the text baseline, and have no hit area. `iconButton` makes
  the accessible name mandatory rather than optional; both are mutation-checked.
- `dist/components.html` — every primitive in every state, all three themes, driven by the
  real `icons.ts`. Also in the shot set, so it is checked dark and light each run.
  The eight button styles it replaces were one decision made eight times, in eight files,
  because there was no page on which they would ever be seen side by side.
- `scripts/package.mjs` no longer zips the development pages. `dist/` is what gets
  packaged, so a build run after a preview was shipping a component gallery and a
  canned-data copy of the popup inside the extension.
- 866 tests. Nothing in the extension consumes the primitives yet — phases C and D do.

## UX plan phase A — trust and correctness — 2026-09-12
- **B1** an exam already sat is no longer "Overdue". An exam has no submission, so
  `isItemDone` was never true for one and it fell through to the past branch for a week
  while the Exams tab called the same row "Just sat". Two tests, mutation-checked.
- **B2 + B3** new tokens `--primary` / `--primary-ink` / `--accent-wash` / `--focus` /
  `--surface-raised` in all six palettes, and `--accent-ink` back to `#1a0d04`.
  "Show my calendar" was `--brand` on a `--brand`-family page: 1.00:1 in dark, i.e.
  plain text. White on the orange accent was 2.87:1. `tests/tokens.test.ts` now parses
  `ui.css` and computes every pair, so neither can come back silently; both mutations
  were checked.
- **M8 + m1** one vocabulary module, `core/names.ts`. `GS`, `gradescope` and
  `gradescope: due date` are gone from every sentence; the two-letter code stays only in
  the row's source column. It also holds `timeAgo`, which retires
  `List updated 9/11/2026, 6:19:34 PM` (m6).
- **M9** the build id leaves the popup's status line and lands in Settings › Developer,
  beside the worker's. The stale-worker warnings are rewritten to say what happened and
  what to do (m7); the build ids stay in the one sentence they are the evidence for.
- **M12** the full view is capped again — 1100px for list-shaped views, 1400px for the
  month — keyed off `body[data-view]`, not a width media query. The comment that still
  argued for the cap now matches the code.
- `h3` had no rule at all, so "Older courses" rendered larger than "Courses". `SPEC.md §0`
  is out of the Sources copy.
- **m12, and the finding that matters most here.** The framed preview is deleted (it
  mounted `#list` and threw, and by construction it cannot reproduce a `body`-level
  sizing bug). `npm run preview` now emits `preview-popup.html`, `preview-options.html`
  (`?stale=1` for an older worker) and `shot.html`; `npm run shots` renders all ten
  surfaces dark and light to `docs/ux/after/`.

  **`--force-dark-mode` does not set `prefers-color-scheme`**, which ux-plan.md §6
  asserts and a probe disproved: on macOS headless Chrome follows the system theme, so on
  a dark machine every capture is dark with or without it, and the twenty "light" files
  were byte-identical to the dark ones. `--blink-settings=preferredColorScheme=0|1` is
  the one that works, and both halves now state it rather than leaving dark implicit.
- 857 tests, typecheck and build pass. Verified in the real popup document in **dark and
  light**: width invariant still 400/400/visible, no element past 401.

## Done

| Step | State |
|---|---|
| 1 — scaffold | TypeScript + esbuild → `dist/`, vitest + linkedom, manifest per §2.3, layout per §2.4, data model per §3. |
| 2 — **Gate 0** | **PASSED 2026-09-03, 4/4.** All four hosts return logged-in content to a `credentials: "include"` fetch from the service worker. The §2.2 content-script fallback is **not** needed. → [gate0-results.md](docs/gate0-results.md) |
| 3 — offscreen | **Verified in Chrome**, round-trip 3/3. `ParseError` survives the message boundary as a `ParseError`, so §6 can tell a structural surprise from a plumbing bug. |
| 4 — fixture capture | Options page fetches an allowlisted URL from the worker, scrubs it per Appendix A, probes it for §4 marker strings, downloads it. Also `npm run scrub` for re-scrubbing from the CLI. |
| 5 — Canvas | `src/sources/canvas.ts`, planner-only as decided. Adversarially reviewed; four code defects fixed. → [canvas-findings.md](docs/canvas-findings.md) |
| 6a — Gradescope | `src/sources/gradescope.ts` + `src/core/dates.ts`, 37 tests on two real fixtures. Adversarially reviewed: 12 findings, 11 survived, all fixed. → [gradescope-findings.md](docs/gradescope-findings.md) |
| 6c — PrairieTest | `src/sources/prairietest.ts`, both cards + the booking pseudo-item. 30 tests on **two** real captures a week apart. Adversarially reviewed: 12 findings, **all 12 survived refutation**, all fixed. → [prairietest-findings.md](docs/prairietest-findings.md) |
| 6b — PrairieLearn | `src/sources/prairielearn.ts` + the §3.2 half of `src/core/dates.ts` (wall-clock in a named zone, year inference, CDT/CST). 48 tests on the real fixture. Adversarially reviewed: 12 findings, **all 12 survived refutation**, all fixed. → [prairielearn-findings.md](docs/prairielearn-findings.md) |

## Review outcome — Gradescope
Two silent-empty paths that §4 forbids outright: a table whose **rows** stop matching the
row selector parsed to `[]` (the table element was guarded, the row class was not), and a
dashboard whose course cards moved returned healthy-looking empty term groups. Both now
throw. Also fixed: a row whose only `<time>` is the late date reported that late date as
`dueAt`; `mapStatus` matched by substring, so `Not Submitted` → `submitted` and
`Not yet graded` → `graded` (the fail-silent direction, which would then win §5.3's
"most done" merge); one bad `datetime` anywhere in a row — including the release date,
which §4.2 says is not even displayed — threw away every assignment in the course, while
an *empty* one silently dropped the date with no record; and `data-assignment-id` was
used unvalidated as both the memberKey and a URL path segment.

§4.2's class-independent date fallback ("cheap insurance", and §11's redesign mitigation)
was missing and is now implemented, matching `<time datetime>` by aria-label prefix —
never via the hidden Due Date column, which is state-dependent.

Nine of ten mutations the review found now fail the suite; the tenth is benign
(two independent guards reject the enrol button, so loosening one changes nothing).

## Review outcome — PrairieLearn
Three high-severity defects. **One unreadable popover discarded all 14 assessments** —
the same "cost must be one field, not the page" rule already fixed in Gradescope, and the
credit cell that could have rescued the row was gated off behind `!scheduleHtml` rather
than "no usable schedule". **§4.3's schedule-vs-cell cross-check did not exist**: the cell
was parsed on every row and thrown away, so swapping two rows' popovers produced two wrong
deadlines with no error, no marker and no log. **Positional `cells[1..3]`** meant an added
column yielded 14 undated rows, all URLs fallen back, and 8 rows reported `graded` because
the status reader was handed the credit text — columns now come from the table's own header.

Also fixed: `Number("") === 0` fabricated a 0-credit tier that dragged `dueAt` onto the
50% semester-long tail §4.3 explicitly rejects; a tie for the highest credit reported the
earlier window as the deadline and a still-full-credit window as `lateDueAt`;
`wallClockToIso` formatted its input verbatim, so `Sep 31` stored a date that does not
exist and `25:00` threw a `RangeError` (not a `ParseError`, so §6 would have called it a
plumbing bug); `inferYear` kept a year the weekday check had just rejected; and the row
URL had no scheme/origin check while a malformed href killed the page.

The DST path was entirely unpinned — hard-coding `-05:00` passed all 137 tests. Now pinned
by a December date, the fall-back hour, and the previous-year candidate. Eleven mutations
were tried; the two that survived the first pass have tests and now fail too.

| 7 — normalize + dedupe | `src/core/normalize.ts` §5.2, `src/core/dedupe.ts` §5.3 union-find + overrides + §5.4 retention. 41 tests, table-driven from real fixture titles. |
| 9 — notifications | `src/core/schedule.ts` §7: 24h/2h leads, quiet hours, the daily booking nag, alarms rebuilt after every sync. Plus the extension icons, without which `chrome.notifications.create` fails silently. |
| 10 — options, overrides, calendar | §8.2's options page, §8.1's row menu (hide/split/merge/calendar) over `src/core/overrides.ts`, and §8.3's `.ics` + Google Calendar links in `src/core/ics.ts`. |
| 11 — course-site adapters | §4.5's declarative runner (`src/sources/site.ts`), the registry trust boundary (`src/core/registry.ts`), the daily refresh and the runtime permission flow. Ships one real seed adapter, **cs424-fa26**. Shipped inert: the bundled registry was copied to `dist/` and never read, so no adapter could be enabled at all until the first live run. → [adapters.md](docs/adapters.md) |
| 12 — report, policy, listing | §8.2's report-a-broken-page flow, plus [privacy-policy.md](docs/store/privacy-policy.md) and [listing.md](docs/store/listing.md). |
| 8 — store + sync + popup | `src/core/store.ts` (§3 schema, migrations, §6 backoff), `src/core/sync.ts` (§6 loop, injected fetch/parse/clock), `src/core/grouping.ts` + `ui/popup.ts` (§8.1). 32 tests, driven end-to-end by the real fixtures. Review in flight. |

## Review outcome — dedupe + sync (the full review CLAUDE.md reserves for this layer)
16 findings, 14 survived, 7 code defects fixed. **None of the seven was pinned by the
260 tests that existed** — every fix left the suite green, which is what the mutation
pass is for.

Two would have broken the G2 run itself:
- A source reporting `ok` with **zero** items deleted every key it had, behind a green
  dot. Gradescope's own §0-rule-3 guard passes if *any* term has courses while its only
  consumer reads the current term alone, so a breakage confined to this term produced
  `{ok, 0 items}`. It happens before §5.4, so the 3-miss grace never applied. Now keyed
  on N→0, so Canvas's legitimately empty planner stays green.
- `hideSubmitted` hid a **merged** row whenever *any* member was done, taking the member
  that was still outstanding with it. If that half was also overdue there was no escape
  hatch at all — turning the setting off tested the same collapsed status.

Also: the Jaccard path was badge-blind, so `Quiz 1: LA + Python + Errors` and
`Quiz 10: …` merged at 0.667 — the exact pair §5.3 cites as proof the rule is safe;
union-find could put two rows of one source in a group, making one deadline unreachable
behind a row that looked like an honest two-source merge; §5.2's join list and §5.3's
badge shape disagreed above four letters, so identical exams merged or not on whether
staff typed "Exam" or "Midterm"; an item whose only deadline was `lateDueAt` rendered in
no section and read "no date", losing §4.3's whole reduced-credit case; and a *disabled*
source lost its undated items after three syncs, contradicting its own comment.

## Review outcome — PrairieTest
Three high-severity silent-failure paths. **A single reworded card heading deleted that
card's entire contents** — the guard fired only when *both* cards were missing, two lines
under a comment asserting the opposite invariant; a booked exam vanished with no error, or
§4.4's booking item and its §7 nag ceased to exist. **`isEmptyCard` substring-matched the
whole card subtree** and gated the row loop, so a hidden empty-state element left beside a
real row, or an exam whose title happened to contain the empty-state sentence, blanked the
card silently; emptiness is now decided per row, by the absence of the data hook. **No
duplicate-key guard** in the one source whose key is purely content-derived — two rows
sharing a key silently became one item in §3's `raw` map.

Also fixed: the date attributes accepted anything `Date.parse` tolerated, so a bare
`2026-09-11` would have stored a `dueAt` resolving to 7pm the *previous* day and fired
§7's −24h reminder ~29h early; and one unreadable value discarded the whole page — on a
single-page source, 100% of it — where the house rule is that a bad *value* costs its
field while a missing *hook* stays loud.

Seven mutations were tried against the fixed code; all seven fail.

## Review outcome — steps 9–12
16 findings, **all 16 survived refutation**, 13 code defects fixed. None was pinned by the
347 tests that existed.

Wrong interruptions: a catch-up reminder threw away the quiet-hours deferral the planner
had just computed and fired at 02:30; §7 read `dueAt` alone, so a reduced-credit deadline
that the popup and the `.ics` both show as live got no reminder at all; every store write
was an unserialized whole-store read-modify-write, so a sync landing over a notification
restored the empty `notified` and re-fired it — and one landing over a hide reverted it;
a split or merge dropped `notified` entirely and the reschedule two lines later re-fired
both halves; quiet-hours inputs were unvalidated, so a cleared box left midnight to 08:00
loud with the checkbox still on.

Trust: `validateAdapter` accepted a `hostPattern` broader than the adapter's own host.
`https://*.illinois.edu/*` is the manifest's own optional entry, so Chrome would grant
it — and since only the adapter *id* is stored, a later daily refresh could repoint its
`url` anywhere under that wildcard with no second prompt.

Silent losses: an adapter whose title selector broke returned `[]` rather than throwing;
`hiddenItemIds` was keyed by the group-derived `Item.id`, so a hide was spent the moment
a second source mirrored the row, and the stale id stayed armed forever — it is now
keyed by member keys and pruned by §5.4 like every other override; a notification's
click target lived only in worker memory, which MV3 discards ~30s after the toast, so
clicking opened nothing; the row menu survived a re-render and acted on stale ids while
still reporting success.

Eight mutations tried against the fixes; all eight fail.

## Fixtures captured

| Source | Files | Notes |
|---|---|---|
| Canvas | `courses-active.json`, `courses-active-term.json`, `planner-items.json`, `planner-items-empty.json`, `assignments-cs357.json`, `assignments-cs425.json`, `planner-items-SYNTHETIC.json` | The Sep 3 planner was genuinely `[]` and 0 of 67 assignments were dated. **Sep 10: `planner-items.json` is a real capture with one dated row**, so `parsePlannerItems` is measured against a real response for the first time. The synthetic fixture stays for the mappings one row cannot reach — see `fixtures/canvas/README.md`. |
| Gradescope | `dashboard.html`, `course-1352838.html` | 15 courses / 5 terms; PHYS435 with 2 assignments covering both the submitted and unsubmitted row shapes. |
| PrairieLearn | `assessments-cs357.html` | 8 assessments, all 8 credit popovers present. |
| Course site | `cs424-fa2026-schedule.html` | Real capture, 2026-09-10. Shibboleth-protected; answers 401 in place rather than redirecting. Drives the `cs424-fa26` seed adapter: 9 deadlines, all dated, across the CDT→CST flip. |
| PrairieTest | `home-booked-none-available.html`, `home-booked-and-available.html` | Sep 3 and Sep 10. Between them the student rescheduled Quiz 1, so the pair is live evidence for the §3.1 amendment. The Sep 10 capture has the first available-card row ever seen. |

## Next

**G4** — 10 beta users across ≥3 majors for a week, ≥7 saying they would keep it. Then
**G5**, which §9 gates behind it.

The full pre-beta checklist, and 88 verified feature ideas ranked with audit and skeptic
verdicts, are in [roadmap-ideas.md](docs/roadmap-ideas.md) (2026-09-10).

## Tier 0a — DONE 2026-09-10, all 13 items

Everything that needed no capture, decision or tester. 388 → 546 tests. Each item was
mutation-checked; six mutations survived a first pass and their tests were written before
the item landed (recorded in the commits).

| # | What changed |
|---|---|
| 1 | `SourceState` gains `pending`; no green dot before a fetch. `core/health.ts` owns the dots, the "3 of 4 sources OK" line, a stale-source banner and a **toolbar badge** — health outside an extension page for the first time. |
| 2 | A Chrome-blocked extension no longer marks reminders delivered (which silenced them forever). Catch-up fires one toast per deadline, not one per lead, and the title comes from the clock rather than the alarm's name. |
| 3 | A moved deadline re-arms its reminders and says "moved Tue → Fri". An assumed time turning into a stated one is not a move. |
| 4 | A still-open late or reduced-credit window is listed, worded and reminded on its own instant, and painted amber rather than overdue red. |
| 5 | An invented 23:59 is no longer shown as a clock, sorted as one, exported as a timed calendar event, or counted down to. |
| 6 | `doneKeys`: the student can tick work off, which two sources can never do for them. A source saying `missing` overrides the tick. |
| 7 | Not-for-credit work is chipped, sorted last and silent by default — §4.3 required this and nothing read the flag. |
| 8 | `core/quality.ts` surfaces the nine `unparsed*` flags the parsers already wrote. A row whose date failed to parse leads the list instead of vanishing. |
| 9 | Settings is titled Settings, developer tools are collapsed, and there is one "Course websites" control instead of two. |
| 10 | A new build lifts §6's backoff for the sources a code change could have fixed. |
| 11 | The adapter date grammar reads weekday prefixes, `at`/`@`, and 24-hour times; an ambiguous `5:00` is refused rather than guessed, and an unread tail is recorded. |
| 12 | `migrate` validates `raw` and `items` instead of casting them; `fixtures/store/v1.json` pins that an older store survives. |
| 13 | "Copy diagnostics" (counts and states, no titles or links) and a right-click "Report this page". |

### What the first post-Tier-0a sync found (2026-09-10)

Console from a reload: all four hosted sources `ok` (canvas 1, gradescope 5,
prairielearn 25, prairietest 2), the update hook logging `no source was resting`, and
the registry seed logging `bundle not seeded: 1 adapter(s) already stored` — every new
both-branch log line doing its job.

One defect, and one superseded claim:

- **A failed fetch was reported as `parse_error`.** The sync that fires right after an
  extension reload got `TypeError: Failed to fetch` for the CS 424 site; `syncSites`
  threw `ParseError` whenever *every* adapter failed, regardless of why. It healed on the
  next sync (`site: ok (9 items)`), but the label means "the page changed, go fix the
  selectors" and would have sent someone to debug selectors that were fine.
  `adapterFailureKind` now separates structural failures (a `ParseError`, or a 4xx —
  the adapter is asking for a URL the site will not serve) from network ones (a failed
  fetch, a 5xx), and the per-adapter warning names the kind so a recurrence is
  diagnosable without another trip to the browser.
- **Canvas is no longer empty on this account.** `[sync] canvas: ok (1 items)`, where
  canvas-findings.md claimed Canvas "cannot contribute any" deadlines here. That claim
  was never supported by its own evidence — 0 of 67 assignments dated on one day says
  nothing about whether an instructor will set a date — and it is corrected rather than
  annotated. It also unblocks G1's last gap: `parsePlannerItems` is the only parser in
  the project never tested against a real response, and a real planner fixture is now
  one capture away. **Taken the same day**: `fixtures/canvas/planner-items.json`, one
  dated CS 424 quiz. It pins the four things only a real response could — a *relative*
  `html_url`, an absent `course_code` (the code comes from `context_name`, per the §4.1
  amendment), four `submissions` keys the synthetic fixture never had, and §3.1's key
  shape on live ids. All four already worked. Still open: whether the
  first-fetch-after-reload failure recurs.

## Tier 0b — 4 of 7 done

| # | State |
|---|---|
| 14 — repo + registry | **Done.** Pushed to https://github.com/sushelan/illini-dash and made public. The registry URL returns 200, so **an adapter now reaches every installed copy within a day, with no new build and no store review.** Until then the daily refresh was dead code. |
| 15 — beta install kit | **Done.** `npm run package` → `release/illini-dash-<version>-<build>.zip`, build id in the filename, `INSTALL.txt` inside. [beta-install.md](docs/beta-install.md) is the tester-facing guide. The unlisted-store route was declined: it reorders §9 and a mid-week fix would wait days on review. |
| 16 — adapters 2 and 3 | **Half done.** ECE 310 shipped (13 homeworks, verified by running the shipped runner over a real capture). A third is cheap now — see "Adapters" below. |
| 17 — Canvas term filter | **Done**, see the resolved decision above. |
| 18 — non-CS first look | Not started. Publisher-host naming + a Canvas "No date" section. |
| 19 — PL/PT "not used by you" | Not started; the cheap half needs nothing from Sushi. |
| 20 — first-run page | Not started. |
| 21 — run G4 | Sushi's. |

## The UI pass (2026-09-10 → 11)

Started once Tier 0b's shippable half was done, because the list is the product and it
had never been looked at outside a fixture.

**The popup opened at 800×600 with the list in its left half.** `body { max-height:
600px; overflow-y: auto }` read like a faithful implementation of §8.1's "max height
600px" and was the cause: it makes `body` its own scroll container, which leaves the
document with no intrinsic height for Chrome to measure, so Chrome falls back to its
maximum. Chrome already caps a popup at 600 tall and scrolls it itself, so the cap is
satisfied by writing nothing. Sushi reported this three times before it was diagnosed —
the first two answers reasoned from a preview harness that wrapped the list in a
fixed-width `<div>`, which cannot reproduce a `body`-level sizing bug by construction.
`npm run preview` now emits **`preview-popup.html`** as well, the real `popup.html` with
only `chrome.*` stubbed. Written up in CLAUDE.md as its own section.

**Row layout.** The rows are a CSS grid with fixed tracks, so dates line up on one right
edge across every row instead of drifting with title length; `minmax(0, 1fr)` on the
title is the only track that shrinks. The date column stopped repeating what the section
heading already says (`formatDue` takes the section and picks relative, time, weekday or
date accordingly), which freed 42px. Qualifiers that used to compete with the title —
"no time", "moved Tue → Fri", a late window — moved to a second line spanning the row.

**Source labels were removed and put back.** They were dropped from single-source rows to
buy title width, on the grounds that §5.3 gives one purpose for them ("a merged row shows
both icons, so a false merge is visible"). Sushi pointed out that where a deadline lives
is separately useful: it says which site to open, it is what the row's click does, and it
is most of what makes a row checkable rather than asserted. Restored on every row, with
different hover text for the merged and single cases. Truncation went 3 → 5 of 17 rows,
against 8 of 17 (worst case 5px) before the pass.

**Still open — Sushi's call:** where the UI goes next. Function (search, chip filtering,
collapsible sections, keyboard nav), information already fetched and hidden (exam room and
duration, release times, the full credit ladder), or visual (course colours, a week grid).
Recommendation on file is function first, specifically search plus chip filtering, since a
real list runs past thirty rows with no way to narrow it. Also noted and untouched: the
health dots are hard to tell apart at 9px, yellow against green especially in dark mode —
shape or a letter would fix it.

### A worker on an older build killed the settings page (2026-09-11)

`TypeError: Cannot read properties of undefined (reading 'length')` on
`state.setAsideCourses`. That field arrived with Tier 0b.17; the page was build
20260911T011632 and the running worker was older, so it answered `get-options-state`
without it.

The crash was the symptom. The defect was that both UI surfaces treat a message from
another process as a typed object — `Response` is a compile-time claim about the
*sender's* build. Four sections had drawn and five had not, `refreshOptions` is called as
`void refreshOptions()` from a dozen controls so the rejection was uncaught, and the only
evidence was a line in a console most people never open, for a problem whose fix is one
click on chrome://extensions.

`src/core/compat.ts` normalizes every field a page dereferences and reports which were
absent, so the page renders and names the missing fields on screen. In core, not in the
UI, because it is a decision and the options page is as unreachable by the suite as
`background.ts` (worker rule 1). The popup had the same exposure and worse consequences —
no scrollback and no console, so a throw there is a blank rectangle — and it already
carried a hand-written `settings ?? DEFAULT_SETTINGS`, which is this defect found once and
patched at one call site; `items` and `sources` are dereferenced on the next two lines and
were unguarded. A *partial* settings object slipped past that guard too, so an older
worker's missing `hideSubmitted` would have read as "show everything". Both render paths
now catch and report into the one channel each surface has.

13 tests, 9 mutations, all killed — one only after adding the settings-backfill case it
first survived. Now house rule 8 for the worker and the loop.

## Two sources and an adapter mechanism added after Tier 0a

- **smartPhysics is a fifth source** (`src/sources/smartphysics.ts`), for PHYS 211–214,
  whose deadlines are at **8:00 AM** — the ones a 11:59 PM habit misses. It is a *source*
  and not an adapter because every course page is addressed by a per-student enrolment id,
  so no fixed adapter URL could serve two people; it gets a two-stage plan like
  Gradescope. Off by default, so a student who has never used it does not get a yellow
  "sign in" dot for a site they do not know. **Open:** the capture is a Fall 2025 course,
  because the account has no active enrolment, so the parser has never seen a live term.
- **`Adapter.columns`** reads a table's own header row instead of counting cells —
  house rule 3 in declarative form. It is what makes a table-shaped course page a
  five-minute job. It stops short of blind autodetection deliberately: ECE 310's own page
  has a column headed `Assessment Due` whose cells hold `HW1`, so anything scanning for a
  due-ish header reads an assignment name as a deadline.
- **Never-signed-in detection** for Gradescope and PrairieTest. Both answer 200 at the
  unchanged URL when the student has never signed in, so the parsers threw and the UI
  showed a red dot with nothing to click — see parser rules 11 and 12 in CLAUDE.md.

## Adapters — the delivery loop, now that the registry is live

Adding a course is: capture the page (public ones need no login), write the entry, push.
Every installed copy has it on its next daily refresh.

Shipped: `cs424-fa26`, `ece310-fa26`.

What is *not* generic, and why: course sites have no API, no feed and no shared markup, so
the judgement of which table and which column holds a deadline still needs a person once
per course. `columns` removes the mechanical half of that. The remaining per-course cost
is minutes for a table-shaped page; a prose page (CS 425 lists deadlines mid-sentence in
`<li>` items) still needs a schema field that does not exist yet.

**Next: Tier 0b items 18–20**, none of which need Sushi. Adapters two and three, the
Canvas term filter (now unblocked, see canvas-findings.md), the beta install kit, and G4.

Worth doing before handing this to ten people:

- ~~**The popup shows invented times as fact.**~~ **Done** in Tier 0a.5, and in three
  more places the note did not mention: the sort order, the calendar export and the
  reminders. Tier 0a.11 also found that some of those 23:59s were never assumed at all —
  the page stated a time and the date grammar matched past it.
- **`fixtures/sites/` has one seed and §4.5 wants 2–3.** One adapter is one shape of
  course page; the second is where the schema's gaps show up. `splitTitle` only exists
  because the first real page needed it.
- ~~**Two Options controls both read "Course websites"**~~ — **done** in Tier 0a.9. The
  per-source row is gone and the site source's health moved under Course websites.
- **G3 rests on a single merge.** See the gates section — the §5.3 BADGE_TOKEN trade is
  still unexercised, and G4 is what measures it.

## The first live run (2026-09-10)

Four defects in one day, none caught by the 382 tests passing at the time, three of them
in `background.ts`. Written up as house rules in CLAUDE.md; the short version:

| Defect | Why no test caught it |
|---|---|
| Bundled registry never read — no adapter could be enabled | Nothing tested that `dist/`'s copy was *loaded*, only that it was valid |
| `site: ok (0 items)` with no adapters enabled — a green dot over nothing | A test **asserted** `state: "ok"` for exactly this case |
| An invented 23:59 outranked a real Canvas deadline | Needs two sources at once; every fixture test runs one |
| Store queue deadlocked (`sync` → `reschedule` → `fireNotification`) | Lived in the worker, which the suite cannot reach |

The last one was ~20 minutes from wedging the extension on Sushi's machine: it fires the
first time a reminder comes due *during* a sync, and only default quiet hours (23:00–08:00)
were holding it off. It was found by tracing one runtime path across parallel agents —
bundle → storage → options → permission → sync → offscreen → popup — after reviewing
`background.ts` as a file had found nothing across four steps.

### The four defects, in detail
- **§4.5 bundled registry was never read.** The build copied `adapters/registry.json`
  into `dist/`, but the only code that filled `store.registry.adapters` was the daily
  GitHub fetch — and nothing is published at that URL yet. The stored list stayed empty,
  Options → Course websites listed nothing, and the CS 424 adapter could not be enabled,
  so no item was ever labelled WEB. The worker now seeds from the bundle when the stored
  list is empty; the remote fetch stays an *update*, never rolled back by the seed.

- **`site: ok (0 items)` was a lie.** With no adapter enabled, `syncSites` returned `[]`
  and the loop recorded `ok`, so the options page showed a green dot on a source that was
  fetching nothing. It now raises `SourceDisabled` and the loop records `disabled` —
  a third branch, because the failure branch would arm §6's backoff against a source that
  is merely switched off. The old behaviour was *asserted by a test*, which is how it
  survived a mutation-checked suite.
- **The bundle seed returned silently** when the store already had adapters, so a healthy
  store and a seed that never ran looked identical in the console. It logs both cases now.

### §5.3 amendment: an assumed time is the last resort, not the first
SOURCE_RANK puts `site` above `canvas` for `dueAt`, on the reasoning that the system a
student submits in owns its deadline. That holds only while the site *states* a time.
CS 424's schedule prints "HW1 Due" against a bare date, §4.5's runner fills in 23:59, and
the merged CS424 HW1 row therefore showed an invented instant in place of the real Canvas
one — looking authoritative while being wrong. `parseAdapterDateParts` now reports
`timeAssumed` and the runner records it in `extra`; `dedupe` prefers any member with a
stated instant and falls back to an assumed one only when it is the only instant there.
A site that does print a time still wins, as §5.3 intends.

### Three worker defects found by the path trace
All three lived in `background.ts`, the one file the suite cannot reach. The store queue
is now `core/queue.ts` so it can be.
- **The store queue deadlocked.** `sync()` held it for a whole run and called
  `reschedule()` → `fireNotification()`, which asked for it again; the inner request
  chained onto a tail that could not resolve until the outer work returned. It wedged
  permanently — `running` never cleared, so every later sync returned `skipped` until
  Chrome tore the worker down. It fires the first time a reminder comes due *during* a
  sync; on live data that was ~20 minutes away. `withStore` is now re-entrant.
- **`set-adapter-enabled` wrote the store outside the queue**, so ticking a course site
  while a sync was in flight was overwritten seconds later and the checkbox sprang back
  with no error. Same for `refresh-registry`. Both queued now, and enabling an adapter
  clears §6's backoff for the source.
- **A failing registry refresh retried on every sync** (the seed leaves `fetchedAt`
  unset by design). `registry.attemptedAt` now rests a failure without faking a success.


## Shared parser primitives
`src/core/parsing.ts` holds the rules that were previously written three or four times
each across the source modules — and reintroduced as defects after being fixed
elsewhere: `parseField` (a bad value costs its field, not the page), `KeyGuard`
(duplicate `sourceId` on one page), `sameOriginHttpsUrl`, `looksLoggedOut`, `isInstant`,
`nonEmpty`, `textOf`. Each is now pinned by tests from three or four different source
test files at once. The house rules they encode are in CLAUDE.md.

## Blocked on Sushi — the gates
- **G2 recall — PASSED.** 100% recall on live data, no phantom items. Canvas contributed
  0 items on the day it was measured, which was a pass rather than a failure because
  none of the 67 assignments captured on Sep 3 carried a due date.
  **Canvas is no longer empty** (`[sync] canvas: ok (1 items)`, 2026-09-10), so that
  exemption has expired: a Canvas source reporting 0 items is now something to explain
  like any other empty source. The stronger claim this note used to lean on — that
  Canvas "cannot contribute any" deadlines on this account — was an overreach and is
  corrected in [canvas-findings.md](docs/canvas-findings.md).
- **G3 dedupe — PASSES, on n=1.** Confirmed 2026-09-10, once course sites were finally
  running. The list holds exactly **one** cross-source merge, `CS424 · Homework 1` from
  Canvas + the CS 424 site (`CV WEB`), and Sushi confirmed it is the same assignment.
  One merge opportunity, one correct merge, **zero corrections** — inside §9's budget of
  two, but the budget was never tested. Nothing was under-merged either: no other item on
  the list has a counterpart in a second source.

  **This does not retire the threshold question.** §9's ≤2 corrections is meant to be
  measured against many merge opportunities; one is not a sample. The BADGE_TOKEN trade
  below is still unexercised in the wild — nothing on this account produced a `{mp2}` vs
  `{mp2, checkpoint}` shape. G4's ten testers are what actually measures this, and §5.3's
  threshold stays open until then.
- **G4 beta / G5 store** — both need Sushi and neither can start from here.

## Spec amendment made in step 7 — still not confirmed by G3
§5.3's "a subset match needs ≥ 2 tokens" rejected **both** pairs the spec names as its own
purpose, because §5.2 step 3 collapses `Lab 3` into the single token `lab3`:
`Lab 3`/`Lab 3 Report` (§5.3: "will merge, which is correct") and
`Homework 3`/`HW3 Errors and Big-O` (§4.3: the badge match "is the point").
`dedupe.ts` now also accepts a single *badge* token — letters bound to a number.

**This is a trade, not a free win**, and an earlier version of this note wrongly claimed
otherwise. The ≥2-token rule also bounded the *larger* side, and dropping it lets `{mp2}`
merge into `{mp2, checkpoint}`. The claim that "a badge is unique within a course" is
also falsified by this repo's own fixture: CS 357 ships both `GA 0` and `GA00`, which
§5.2 collapses to the same token. What keeps the trade survivable is the same-source
group check added after the review — §5.3's "never two rows from one source" is a
property of the *group*, and union-find was routing around the pairwise test.
§5.3 makes G3 the arbiter of the threshold itself — and G3 passed with a single
merge, which does not exercise this trade at all. It remains G4's job.

## VERIFY (§12-style, needs your browser eventually)
**Does PrairieTest render the "Exams available for reservations" card at all for a student
with no CBTF-enabled courses?** Both captures come from an account that has them, so
"both cards always render, empty or not" rests on n=1 for that card's empty case. The
parser now treats a missing card as a `ParseError`. If the assumption is wrong, a
non-CBTF beta tester would see a spurious red dot rather than a clean empty state — worth
checking at G4 rather than now.

## Decisions taken
- **Canvas scope** (2026-09-03): planner-only as specced, even though it yields 0 items
  on this account; mapping tested against a clearly-labelled synthetic fixture until
  real planner data appears at G4.
- **§3.1 `sourceId`** (2026-09-03): amended per source, with costs, in
  [sourceid-decision.md](docs/sourceid-decision.md).

## Open decision — RESOLVED and IMPLEMENTED 2026-09-10 (Tier 0b.17)
**§4.1's concluded-course filter.** `include[]=term` was captured
(`fixtures/canvas/courses-active-term.json`) and it settles the design: the real term
(262, `2026 - Fall`) carries real dates, while the stale course's term (109, `OPEN`)
has **null start and end** — an unbounded term, which is never "concluded". So the
filter keeps courses whose term brackets today, sets aside unbounded-term courses only
when a current term exists, and fails open when none does. Details and the code
consequences in [canvas-findings.md](docs/canvas-findings.md). Shipped: `coursesUrl()`
asks for `include[]=term`, `currentTermCourses` applies the rule, the loop drops planner
rows for held-back courses, and Options → Courses → **Older courses** lists what was held
back with a "Put back" button for anyone legitimately enrolled across two terms.

## Spec amendments forced by real data
- **§4.1 / §5.3** — Canvas `course_code` is an opaque slug (`cs_357_120268_263847`), not
  `"CS 225"`. §5.1 runs against `name` instead, and `courseLabel` must not use it.
- **§4.1** — no `while(1);` prefix on this deployment. Keep the detection, don't require it.
- **§4.3** — the credit table has a header row and no `<tbody>`; the 0-credit row's End
  is an em dash, not empty; `lateDueAt` must skip a 0-credit tier.
- **§4.4** — the *booked* row links to `/pt/student/reservation/{id}` and has no exam id;
  the *available* row's "Make a reservation" button links to `/pt/student/exam/{id}`.
  Both the exam instant and the reservation window are machine-readable JSON
  (`data-format-date`, `data-format-date-range`), so neither of §4.4's regexes nor
  §3.2's year inference is needed here — and the visible text is not even a fixed
  format ("today, 9pm (CDT)" on the day). The empty-card text in the spec belongs to the
  *other* card; there is one wording per card. A third card exists.
- **§4.2 / §3.1** — a Gradescope row is a `<button data-assignment-id>` before submission
  and an `<a>` after; both carry the same id. The hidden "Due Date" column is
  state-dependent and must not be used as `dueAt`.
- **§5.3** — `SOURCE_RANK` assumes every instant is one its source *stated*. §4.5's runner
  fills in 23:59 for a course page that prints a bare date, so a member whose time was
  assumed is now the last resort for `dueAt`, not the first choice. A site that prints a
  real time still outranks Canvas, as §5.3 intends. (2026-09-10, found on live data.)

## §12 open questions
- ~~1. PrairieLearn access-details in fetched HTML~~ — **yes**, resolved 2026-09-03.
- ~~2. PrairieTest available-row link~~ — **resolved**, and the question was mis-framed.
- ~~3. Gate 0 extension-context half~~ — **passed**.
- 4. PrairieLearn credit-string shapes in other courses — only CS 357 captured.
- 5. Any Moodle or client-rendered course sites this term — PrairieTest turned out to be
  server-rendered, so that worry is retired for it.

## Dev-loop note
Chrome caches the service worker until you press Reload on the extension card, so a
rebuilt page can talk to an old worker. Every bundle carries a build id and the UI says
**STALE SERVICE WORKER** when they disagree. → [dev-loop.md](docs/dev-loop.md)

# Chrome Web Store listing (§9 G5)

Draft copy and the permission justifications the review asks for. **Not submitted** —
G5 is a gate, and submission needs the developer account.

## Name

Illini Dash

## Short description (132 char limit)

> Every UIUC deadline — Canvas, Gradescope, PrairieLearn, PrairieTest, smartPhysics — on one calendar, with reminders.

(116 characters.)

## Detailed description

**Paste [description.txt](description.txt), not the copy below.** The store's Description
field is **plain text** — it preserves line breaks and nothing else — so the Markdown that
made this document readable would ship as literal asterisks and hyphens in the listing.
That is the whole reason the real copy lives in a `.txt` beside this file: a document
written to be read in a repo and a field that renders nothing are not the same medium, and
keeping one copy meant shipping the wrong one.

The store's own hint under that field is *"Focus on explaining what the item does and why
users should install it."* The draft below opened with a feature list, which answers
neither. `description.txt` leads with the problem — five sites, none of which shows you the
others — then what it does about it, then the privacy position, then the disclaimer.

### Earlier draft, kept for the wording only

> Illini Dash collects your deadlines from Canvas, Gradescope, PrairieLearn, PrairieTest
> and smartPhysics onto one calendar, so you are not checking five sites to find out what
> is due.
>
> - **Day, week and month.** Or a list of everything that needs attention. Your courses
>   are colour-coded and any of them can be switched off with one click.
> - **One entry per assignment.** The same work posted in Gradescope and mirrored into
>   Canvas shows up once, linked to the place you actually submit it.
> - **Exams in their own place.** Every midterm and final in the term, with the room and
>   how long it runs — including the ones further out than the rest of the calendar goes.
> - **CBTF exams and booking.** It shows your reserved exam sessions, and reminds you
>   daily about exams that are open for booking but not yet reserved — the deadline that
>   has no deadline.
> - **Reminders.** 24 hours and 2 hours before, with quiet hours so nothing wakes you.
> - **Reduced-credit deadlines.** PrairieLearn's "80% until Tuesday" is a real deadline
>   and it is shown as one.
> - **Your own course websites.** Plenty of courses keep the real schedule on their own
>   site. Paste the address and Illini Dash reads it, shows you what it found, and adds
>   it once you say it looks right.
> - **Calendar export.** A button in the toolbar saves everything as an .ics, and any
>   single item can be added to Google Calendar from its menu.
>
> **No account, no password, no server.** It reads the pages you are already logged into,
> in your browser, and stores everything on your own device. Nothing is ever uploaded.
>
> Built for UIUC. Not affiliated with the University of Illinois, Instructure,
> Gradescope or PrairieLearn.

## Category

**Workflow & Planning.**

"Productivity" is what this said, and that category no longer exists — the Chrome Web
Store replaced its old list, and a name that is not on the form is not an answer. The
nearest live category is Workflow & Planning, which is where calendars and task tools sit.

**Education** is the defensible alternative and is the wrong call here: it is where
courseware and study tools live — things you learn *from*. This is a planner that happens
to read coursework, and a student browsing Education is not looking for it. Pick one; the
store allows a single category and changing it later resets nothing.

## Store icon

`public/icon128.png` — 128×128, the same mark the toolbar uses at 16/32/48. Uploaded
separately from the zip even though the zip contains it: the listing icon is a store
asset, not a manifest one.

## Permission justifications

Store review asks for a sentence per permission. Keep them literal.

| Permission | Justification |
|---|---|
| `storage` | Stores the user's deadlines, settings and manual corrections locally on their device. No remote storage exists. |
| `alarms` | Schedules the periodic check for new deadlines and the individual deadline reminders. |
| `notifications` | Displays the deadline reminders the user has enabled. |
| `offscreen` | A Manifest V3 service worker has no DOM parser. Fetched course pages are parsed in an offscreen document using the browser's own inert HTML parser, which runs no scripts and loads no resources. |
| `contextMenus` | Adds one right-click item, "Report this page to Illini Dash", so a user can report a course page whose deadlines are not being read. It opens the extension's own settings page with the address filled in; nothing is sent anywhere without the user pressing a button. |
| `scripting` | Registers one content script, on `https://campuswire.com/*` only, and only after the user switches Campuswire on in the extension's settings and grants that host. The script reads the posts a class feed has already rendered, to find deadlines stated in them; it makes no request to Campuswire, reads no cookie, token or storage, and modifies nothing on the page. Switching Campuswire off unregisters it. Nothing is registered on install. |
| `host_permissions` for the five sites | The extension reads the user's own assignment and exam pages from canvas.illinois.edu, www.gradescope.com, us.prairielearn.com, us.prairietest.com and smart.physics.illinois.edu, using the session already present in the browser. It requests only pages the user's account can already see, and never writes to them. |
| `host_permissions` for `raw.githubusercontent.com` | One public JSON file, read once a day, listing which UIUC course websites are supported. It is fetched without cookies and carries nothing about the user. It is data, not code — see Remote code below. |
| `optional_host_permissions` | Some courses publish their schedule on their own website, and many UIUC course sites are their own domains (cs124.org, cs225.org) rather than university subdomains, so the host cannot be known in advance. Nothing is granted at install: a single host is requested at runtime, read-only, only when the user turns that course's site on, and Chrome's prompt names it. An adapter may not name a host already granted above. |
| `optional_host_permissions` for `campuswire.com` | Covered by the same `https://*/*` entry and opt-in the same way: nothing at install, and the origin is requested from the click on the Campuswire switch in Settings. It is read-only, and it is the one host read from a class feed the user already has open rather than fetched. See `scripting` above. |
| `cookies` | Reads one cookie, `session_id` on `piazza.com`, and only when the user has switched Piazza on. Piazza's own API requires that cookie's value to be echoed back as a `CSRF-Token` header, and the cookie is `HttpOnly`, so no other API can read it. It is sent only to piazza.com, in the request it authenticates, and is never stored. No other cookie on any other site is read. |
| `optional_host_permissions` for `piazza.com` | Covered by the same `https://*/*` entry and opt-in the same way: nothing at install, and the origin is requested from the click on the Piazza switch in Settings. It is read-only — the class list and each class's announcement feed, using the session already in the browser. |
| `identity` | Only for the optional Google Calendar sync, which is off until the user turns it on. It obtains an OAuth token for one scope, `https://www.googleapis.com/auth/calendar.app.created`, which permits creating a secondary calendar and reading or writing only calendars this extension itself created. It cannot see or change any other calendar in the account. The extension creates one calendar named "Illini Dash" and writes the user's own deadlines to it; turning the feature off deletes that calendar. No token is stored by the extension — Chrome holds the grant. |
| `optional_host_permissions` for `www.googleapis.com` | Covered by the same one-wildcard entry and opt-in the same way: nothing at install, and the origin is requested from the click on the Connect button in Settings. It is the Google Calendar API endpoint the events above are written to, and it is requested only by a user who has switched that feature on. |
| `commands` | One suggested keyboard shortcut (Alt+Shift+D) that opens the extension's own popup. It is the standard `_execute_action` command and does nothing else. |

**Single purpose:** collecting the user's own coursework deadlines from their university
accounts into one list.

**Why not `<all_urls>`, `tabs` or `webRequest`:** none is requested. Six origins are
granted up front; everything else is one host at a time, from a click, and read-only.

## Remote code

None. The extension executes no remotely loaded code. Course-site support is remote
**data** — a JSON file of CSS selectors, fetched daily and schema-validated before use.
It cannot introduce behaviour, only which page is read and which elements are selected.

## Data disclosure form

**[privacy-practices.txt](privacy-practices.txt) is the answer sheet; this is a pointer to
it.** Two copies of these answers drifted apart once and this was the stale one — it said
Website content was "not transmitted", which the Google Calendar sync made false, and it
listed the other boxes as "not collected", which is the wrong test. Google's User Data FAQ
asks how an extension *handles* data — "collecting, transmitting, using, or sharing" —
"even when data is processed or stored locally on a user's device". Local-only is not
exempt.

- **Website content: YES.** Assignment titles, course names, due dates and links are read
  out of pages and kept in `chrome.storage.local`.
- Every other box: no. The reasoning for each, including the one judgment call
  (**web history** — one integer per source in session storage, not a list of visited
  pages), is written out in `privacy-practices.txt` and should be read before certifying.

Certifications, all three true — but the first needs its real wording:

- **No selling or transferring to third parties.** There is exactly one transfer, and it
  is user-directed: the optional Google Calendar sync sends the student's own deadlines to
  the student's own Google account, after they press Connect. That is not a third party,
  and the developer receives nothing. The form answer says this; the sentence this project
  used to carry — "there is no transfer at all" — was true before 2026-09-18 and is not
  true now, so do not paste it.
- Data used only for the single purpose above.
- No use or transfer to determine creditworthiness.

## Screenshots — generated

`npm run shots` renders all five at 1280×800 into `docs/ux/after/`. They were blocked on
"needs a browser and real account data"; neither is true. The harness renders the *real*
pages — `dist/popup.js` and `dist/options.js` unmodified, with only `chrome.*` stubbed —
against the row shapes in `scripts/preview-data.ts`, which are real titles and real
shapes taken from Sushi's own account. So they are screenshots of the shipping build,
not mock-ups, and they regenerate when the UI changes rather than going quietly stale.

| # | File | What it shows |
|---|---|---|
| 1 | `full-week-dark.png` | A week with several days filled — the core value in one image |
| 2 | `full-month-dark.png` | The month, which is where the product looks like a product |
| 3 | `full-exams-dark.png` | Exams: a booked one with its room, an unbooked one above it |
| 4 | `full-setup-dark.png` | The first-run screen, with the pin card — what a new installer sees |
| 5 | `store-toast.png` | Three reminders, in Chrome's own toast shape |

Take them from the full view rather than the popup: a 400px popup inside a 1280-wide
frame is mostly empty space.

**The toast image is a composite and is the one thing here that is not a screenshot** —
a real Chrome notification cannot be captured from inside the extension. The wording on
it is copied from `notificationContent`'s actual output rather than written for the
picture, and `tests/schedule.test.ts` quotes the same strings, so the image cannot
promise something the build does not do.

Dark is the default set. Light versions of all of them exist beside them
(`-light.png`) if the store page looks better that way.

## Promo tile

`docs/ux/after/promo-tile.png`, 440×280, generated by the same command. It is drawn from
`ui.css`'s own tokens and the shipping icon, so it cannot drift into being a picture of
an older version.

The store also offers a 1400×560 marquee. Not made: it is optional, and a wide banner
with nothing to put in it is worse than no banner.

## The icon

`public/icon-src/dash.svg`, rendered to 16 / 32 / 48 / 128 by `npm run icons`.

A navy tile, one heavy orange bar, and a white tick. **32 was missing** and is the size a
toolbar icon is most often drawn at on a 2× display — Chrome was scaling 16 up or 48
down, and a two-shape mark at a fractional scale is a smudge.

The first draft had two bars at 14 units and they merged into a blur at 16px; the shipped
one spends the whole width on a single 20-unit bar and gives the tick the lower half to
itself. `docs/ux/icons/candidates.png` is the comparison both candidates were chosen
from, at every size and composited into a toolbar with a badge.

Not the Block I: the listing already says "not affiliated", and the mark is a registered
trademark.

## Before submitting (G5)

- [ ] Complete G4 first — §9 gates G5 behind it, and it is the only item here that
      cannot be done in an afternoon
- [ ] Register the developer account (one-time fee)
- [x] Publish the privacy policy at a public URL — **https://sushelan.github.io/illini-dash/privacy.html**,
      served from the `gh-pages` branch, generated by `npm run site` from
      `docs/store/privacy-policy.md`. Paste that URL into the dashboard's Privacy tab
- [x] Take the screenshots above — `npm run shots`, and they regenerate with the UI
- [x] Raise the version in `manifest.json` out of `0.x` — Sushi's decision: "0.1.0" beside
      a store review prompt reads as "do not rely on this yet", which is the opposite of
      what a deadline tracker needs to say. It went to 1.0.0 for that, and has moved since;
      `tests/manifest.test.ts` pins the shape and that it is not `0.x`, not a literal, so
      **read the number from `public/manifest.json` rather than from this list**
- [x] `homepage_url` and a keyboard shortcut (`Alt+Shift+D`) in the manifest —
      `tests/manifest.test.ts` asserts both
- [x] Confirm the GitHub registry URL in `src/core/registry.ts` points at the real repo —
      live and returning 200 since 2026-09-10
- [x] Every fetched origin is in `host_permissions` — `tests/manifest.test.ts` asserts it.
      smartPhysics was missing and would have failed for every PHYS 211–214 student
- [ ] Re-paste the permission justifications — **all eleven blocks in
      `privacy-practices.txt`, not just the new ones**. The uploaded draft was answered
      when there were nine. Since then `scripting` (2026-09-18, the Campuswire observer),
      `cookies` (Piazza's `session_id`) and `identity` (the Google Calendar scope) were
      added, the host-permission block grew `www.googleapis.com`, and the certification
      wording changed because a user-directed transfer now exists. None of it has reached
      the developer console. The uploaded package's permission set is stale for the same
      reason, so re-upload the zip first or the justifications will describe permissions
      the reviewer's copy does not request
- [x] Every permission has a justification — same test asserts it. `contextMenus` was
      missing

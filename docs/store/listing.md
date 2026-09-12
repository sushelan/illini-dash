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
| `host_permissions` for the five sites | The extension reads the user's own assignment and exam pages from these five sites using the session already present in the browser. It requests only pages the user's account can already see. |
| `optional_host_permissions` for `*.illinois.edu` | Some courses publish their schedule on their own website. This is requested at runtime, only when the user turns on a specific course website, and only for that site. |
| `commands` | One suggested keyboard shortcut (Alt+Shift+D) that opens the extension's own popup. It is the standard `_execute_action` command and does nothing else. |

**Single purpose:** collecting the user's own coursework deadlines from their university
accounts into one list.

**Why not `<all_urls>`, `tabs` or `webRequest`:** none is requested. The extension reads
six specific origins and nothing else.

## Remote code

None. The extension executes no remotely loaded code. Course-site support is remote
**data** — a JSON file of CSS selectors, fetched daily and schema-validated before use.
It cannot introduce behaviour, only which page is read and which elements are selected.

## Data disclosure form

- Personally identifiable information: **not collected**
- Health, financial, authentication, personal communications, location, web history,
  user activity: **not collected**
- Website content: read locally to extract deadlines; **not transmitted**

Certifications: does not sell data, uses data only for the single purpose above, does not
use or transfer data to determine creditworthiness.

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
- [x] Raise the version in `manifest.json` — **1.0.0**. Sushi's decision: "0.1.0" beside
      a store review prompt reads as "do not rely on this yet", which is the opposite of
      what a deadline tracker needs to say
- [x] `homepage_url` and a keyboard shortcut (`Alt+Shift+D`) in the manifest —
      `tests/manifest.test.ts` asserts both
- [x] Confirm the GitHub registry URL in `src/core/registry.ts` points at the real repo —
      live and returning 200 since 2026-09-10
- [x] Every fetched origin is in `host_permissions` — `tests/manifest.test.ts` asserts it.
      smartPhysics was missing and would have failed for every PHYS 211–214 student
- [x] Every permission has a justification — same test asserts it. `contextMenus` was
      missing

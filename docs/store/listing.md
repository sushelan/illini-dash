# Chrome Web Store listing (§9 G5)

Draft copy and the permission justifications the review asks for. **Not submitted** —
G5 is a gate, and submission needs the developer account.

## Name

Illini Dash

## Short description (132 char limit)

> Every UIUC deadline — Canvas, Gradescope, PrairieLearn, PrairieTest, smartPhysics — on one calendar, with reminders.

(116 characters.)

## Detailed description

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
> - **Calendar export.** One click to add an item to Google Calendar, or download
>   everything as an .ics.
>
> **No account, no password, no server.** It reads the pages you are already logged into,
> in your browser, and stores everything on your own device. Nothing is ever uploaded.
>
> Built for UIUC. Not affiliated with the University of Illinois, Instructure,
> Gradescope or PrairieLearn.

## Category

Productivity

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

## Screenshots — BLOCKED

Needs 1280×800 or 640×400 captures of a populated popup and the options page on a real
profile. Cannot be produced without a browser and real account data.

Suggested set, updated for the calendar UI:
1. The week view with several days filled — the core value in one image.
2. The full view showing a month, which is where the product looks like a product.
3. The Exams tab, with a booked exam showing its room and an unbooked one above it.
4. The first-run screen, which is what a new installer sees first.
5. A reminder notification.

Take them on the full view at 1280×800 rather than the popup: a 400px popup in a
1280-wide frame is mostly empty space.

## Before submitting (G5)

- [ ] Complete G4 first — §9 gates G5 behind it, and it is the only item here that
      cannot be done in an afternoon
- [ ] Register the developer account (one-time fee)
- [ ] Publish the privacy policy at a public URL (GitHub Pages) and link it in the listing
- [ ] Take the screenshots above
- [ ] Raise the version in `manifest.json` — 0.1.0 says pre-release, and the store
      version is the one users see
- [x] Confirm the GitHub registry URL in `src/core/registry.ts` points at the real repo —
      live and returning 200 since 2026-09-10
- [x] Every fetched origin is in `host_permissions` — `tests/manifest.test.ts` asserts it.
      smartPhysics was missing and would have failed for every PHYS 211–214 student
- [x] Every permission has a justification — same test asserts it. `contextMenus` was
      missing

# Chrome Web Store listing (§9 G5)

Draft copy and the permission justifications the review asks for. **Not submitted** —
G5 is a gate, and submission needs the developer account.

## Name

Illini Due

## Short description (132 char limit)

> Every UIUC deadline — Canvas, Gradescope, PrairieLearn, PrairieTest — in one list, deduplicated, with reminders.

(111 characters.)

## Detailed description

> Illini Due collects your deadlines from Canvas, Gradescope, PrairieLearn and
> PrairieTest into a single list, so you are not checking four sites to find out what is
> due.
>
> - **One list, deduplicated.** The same assignment posted in Gradescope and mirrored
>   into Canvas shows up once, linked to the place you actually submit it.
> - **CBTF exams and booking.** It shows your reserved exam sessions, and reminds you
>   daily about exams that are open for booking but not yet reserved — the deadline that
>   has no deadline.
> - **Reminders.** 24 hours and 2 hours before, with quiet hours so nothing wakes you.
> - **Reduced-credit deadlines.** PrairieLearn's "80% until Tuesday" is a real deadline
>   and it is shown as one.
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
| `host_permissions` for the four sites | The extension reads the user's own assignment and exam pages from these four sites using the session already present in the browser. It requests only pages the user's account can already see. |
| `optional_host_permissions` for `*.illinois.edu` | Some courses publish their schedule on their own website. This is requested at runtime, only when the user turns on a specific course website, and only for that site. |

**Single purpose:** collecting the user's own coursework deadlines from their university
accounts into one list.

**Why not `<all_urls>`, `tabs` or `webRequest`:** none is requested. The extension reads
five specific origins and nothing else.

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

Suggested set:
1. The popup with several sections filled — the core value in one image.
2. A merged row showing two source labels, with the row menu open.
3. The options page showing per-source health.
4. A reminder notification.

## Before submitting (G5)

- [ ] Publish the privacy policy at a public URL (GitHub Pages) and link it in the listing
- [ ] Take the screenshots above
- [ ] Confirm the version in `manifest.json`
- [ ] Confirm the GitHub registry URL in `src/core/registry.ts` points at the real repo
- [ ] Complete G4 first — §9 gates G5 behind it

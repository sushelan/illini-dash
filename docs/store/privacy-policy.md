# Illini Dash — Privacy Policy

_Last updated: 2026-09-10_

Illini Dash runs entirely in your browser. It reads assignment and exam information from
Canvas, Gradescope, PrairieLearn, PrairieTest, and course websites you explicitly
enable, using the login sessions already in your browser. It never sees or stores your
password. All data is stored locally in your browser's extension storage and is never
transmitted to the developer or any third party. The extension makes one network request
to GitHub once a day to update its list of supported course websites; that request
contains no personal data. Uninstalling the extension deletes all stored data.

## What it reads

While you are signed in, and only from sites you have enabled:

| Site | What is read |
|---|---|
| `canvas.illinois.edu` | Your active courses and your planner items, via Canvas's own API |
| `www.gradescope.com` | Your course list and each course's assignments table |
| `us.prairielearn.com` | Your course instances and their assessment lists |
| `us.prairietest.com` | Your exam reservations and exams open for reservation |
| A course website you enable | Only the single page that course's adapter names |

It requests the same pages your browser would if you clicked through the sites yourself,
no more often than every 15 minutes, and only pages your own account can already see.

## What leaves your browser

Nothing about you.

The only outbound request the extension makes that is not to one of the sites above is a
daily fetch of a public file on GitHub listing which course websites are supported. That
request is made without cookies and carries no information about you.

There is no server, no account, no analytics, no telemetry, and no error reporting.

## What is stored, and where

Deadlines, course names, your per-source and per-course settings, and your manual
corrections (hidden rows, merges, splits). All of it lives in `chrome.storage.local` on
the device you are using. It is not synced between devices. Nobody else can read it, and
neither can the developer.

Deadlines more than 60 days past are deleted automatically.

## Permissions, and why each is needed

| Permission | Why |
|---|---|
| `storage` | To keep your deadlines and settings on this device |
| `alarms` | To check for new deadlines on a schedule and to fire reminders |
| `notifications` | To show the reminders |
| `offscreen` | To read fetched pages with the browser's own HTML parser, which a service worker does not have |
| Access to the four sites above | To read your deadlines from them |
| Access to `*.illinois.edu` (optional) | Requested only if you turn on a specific course website, and only for that site |

It does not request access to all websites, to your browsing history, or to your tabs.

## Reporting a broken page

If you use "Report a broken page", the extension fetches that page, removes what it can
recognise as identifying, and hands you a file. **Nothing is uploaded.** Whether that
file goes anywhere is entirely your choice, and you should read it before attaching it
to a public issue — the scrubber removes what it recognises, which is not a guarantee.

## Contact

Open an issue at https://github.com/sushelan/illini-dash/issues.

# Illini Dash — Privacy Policy

_Last updated: 2026-09-18_

Illini Dash runs entirely in your browser. It reads assignment and exam information from
Canvas, Gradescope, PrairieLearn, PrairieTest, smartPhysics, and course websites you
explicitly enable, using the login sessions already in your browser. It never sees or stores your
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
| `smart.physics.illinois.edu` | Your PHYS 211–214 enrolments and each one's prelecture, checkpoint and homework list |
| A course website you enable | Only the single page that course's adapter names |
| `campuswire.com` (optional) | Only the posts already shown on a class feed you have open, and only if you switch Campuswire on |

It requests the same pages your browser would if you clicked through the sites yourself,
no more often than every 15 minutes, and only pages your own account can already see.

It also notices when a page **on one of those same sites** finishes loading in one of your
tabs, and only then, so that signing in is noticed straight away instead of up to half an
hour later. Chrome reveals a tab's address only to an extension that already has
permission for that site, so this sees nothing it could not already read. It is not a
history: the address is checked against the list above and discarded.

## What leaves your browser

Nothing about you.

The only outbound request the extension makes that is not to one of the sites above is a
daily fetch of one public file on `raw.githubusercontent.com`, listing which course
websites are supported. That request is made without cookies and carries no information
about you.

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
| `contextMenus` | To add one right-click item, "Report this page to Illini Dash", which opens this extension's own settings page with the address filled in. It uploads nothing. |
| `scripting` | To run the Campuswire reader inside a Campuswire class feed you have open, and only after you switch it on. Nothing is registered until then, and switching it off removes it |
| Access to `campuswire.com` (optional) | Requested only when you switch Campuswire on. Nothing is granted when you install |
| Access to the five sites above | To read your deadlines from them |
| Access to one course website (optional) | Requested only when you switch that course's site on, and only for that one site. Nothing is granted when you install. Many UIUC course sites are on their own domains rather than `illinois.edu`, so which host it is cannot be known in advance — Chrome names it in the prompt |

It does not request access to all websites, to your browsing history, or to your tabs.

## Campuswire

Campuswire is off unless you switch it on, and switching it on is the only thing that
asks Chrome for access to `campuswire.com`.

If you switch Campuswire on, Illini Dash reads the posts shown on a class feed while you
have it open, on your computer, to find deadlines; it sends nothing to Campuswire and
stores only the deadlines it found and which posts it has already read.

It reads only what that page has already drawn — the post titles, bodies, numbers and
dates in the feed list. It does not read your Campuswire login, your token, your chat
channels, your private messages, or any other page on the site, and it makes no request to
Campuswire of its own. Nothing about a post leaves your browser, and the post text itself
is not kept: what is stored is the deadline, and the post's number so the same post is not
read twice.

Switching it off unregisters the reader immediately. Revoking the site in
`chrome://extensions` does the same.

## Reporting a broken page

If you use "Report a broken page", the extension fetches that page, removes what it can
recognise as identifying, and hands you a file. **Nothing is uploaded.** Whether that
file goes anywhere is entirely your choice, and you should read it before attaching it
to a public issue — the scrubber removes what it recognises, which is not a guarantee.

## Contact

Open an issue at https://github.com/sushelan/illini-dash/issues.

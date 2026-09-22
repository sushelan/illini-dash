# Installing Illini Dash (beta)

Illini Dash puts every deadline from Canvas, Gradescope, PrairieLearn, PrairieTest,
smartPhysics and some course websites into one list.

It reads those sites using the logins already in your browser. It never sees a password,
and everything it knows is stored on your own machine. Uninstalling it deletes all of
that. Nothing is uploaded — with one exception you have to switch on yourself: if you
connect Google Calendar, your own deadlines are written to a calendar in your own Google
account. Nothing ever goes to whoever built this.

This is a beta, so it is not in the Chrome Web Store yet and you install it by hand.
That takes about two minutes.

---

## Install

1. Unzip the file you were sent. You will get a folder called something like
   `illini-dash-1.2.0-20260912T193354` — the version, then the exact build it was made
   from. Whatever numbers the file you were sent has are the right ones; this is only the
   shape.
   **Keep the folder somewhere you will not delete it** — Chrome loads the extension
   from that folder every time it starts, so it cannot go in the trash.
2. Open Chrome and type `chrome://extensions` in the address bar. (Links to
   `chrome://` pages do not work; it has to be typed.)
3. Turn on **Developer mode** with the switch at the top right.
4. Click **Load unpacked** and choose the folder you unzipped.
   Choose the folder itself, not a file inside it.
5. Click the puzzle-piece icon in the toolbar, find Illini Dash, and click the pin.

Chrome shows a bubble saying "Disable developer mode extensions" every time it starts.
That is normal for anything installed this way, and it goes away when the extension is
in the store. You can dismiss it.

## First run

The first time you click the icon it asks **which sites your courses use**, with a
one-line note on each saying who it is for. Canvas, Gradescope, PrairieLearn and
PrairieTest start ticked; smartPhysics does not, because it only serves PHYS 211–214.

Untick anything you do not take — a source you switched off stops being read and stops
asking you to sign in. **You can change all of it later in Settings**, so nothing here is
final.

Rows tick themselves green as each site starts working. **Open all 4 sign-in pages** — the
button counts, so it says whatever number is actually waiting — opens a tab for each one
you picked that is not signed in yet, which is faster than finding four sites by hand.
**Show my calendar** is clickable the whole time — it never blocks you.

This screen appears once. It does not come back when a session later expires; that shows
as a yellow dot and a banner instead, because the deadlines already fetched are still
worth seeing.

To see it again, open Settings → **Your data** → **Start over** → **Show it**. That
reopens the first-run screen with your answers still in it and changes nothing else.
**Reset**, directly below it, is not the way to do this — it deletes every hide, merge and
tick you have made. They sit next to each other on purpose, with the gentle one first.

## Check it worked

Click the Illini Dash icon.

- Under the title there is one line about the sources: a dot, then something like
  **`4 sources · synced just now`**, with **Sync Now** on its right.
- **Press that line.** It opens **Sources**: every site on its own row, what each one
  last did, and the one thing to press when something is wrong. Green means "it was
  fetched and it was fine"; grey means "not checked yet"; yellow means that source
  needs you to **Sign in**, and the button is on the row.
- A source that needs you also puts a yellow banner at the top of the popup with the
  same **Sign in** button, so you do not have to go looking.

Sign in to Canvas, Gradescope, PrairieLearn and PrairieTest in this browser if you have
not already. The extension can only read what you can read.

**If you do not use one of them** — plenty of people never touch PrairieTest — open
Settings with the gear icon and switch that source off. It stops being counted.

**If you take PHYS 211, 212, 213 or 214**, switch **smartPhysics** on in Settings. It is
off by default because most people are not in those courses, and it would otherwise sit
there asking them to sign into a site they have never used. Its deadlines are at 8:00 AM
rather than 11:59 PM, which is exactly the kind the usual habit misses.

### Optional, and each one is one click plus a Chrome permission box

None of these is needed to use the extension, and nothing is on until you turn it on.

- **A course website** (a schedule page with deadlines on it). Settings → Course
  websites. Chrome asks whether Illini Dash may read that site; that dialog is Chrome's,
  not ours, and saying no leaves everything else working.
- **Piazza** and **Campuswire**. Deadlines instructors state in a post, offered as
  suggestions you accept or ignore — nothing they find goes on your calendar by itself.
  Piazza reads your own session; Campuswire only reads a class feed while you have it
  open in a tab.
- **Google Calendar export.** Sends deadlines to a calendar in your own Google account.
  Sign-in happens on the Settings page, because a popup closes the moment Google's
  consent window takes focus.

### Which build you are on

**You should not have to check.** The build id used to be a line in the popup, 800px below
anything it described, and no student could use it. If the page and the background part
ever fall out of step — which happens when you unzip a new version and forget to reload
the card — Settings says so **at the top, by itself**, in a sentence that names both
builds and tells you to press Reload. Nothing to go looking for.

If you are asked for the id anyway, it is under Developer, which is deliberately not in
the sidebar: open Settings and add `#dev` to the end of the address.

## What to expect in the first week

- The list only goes 60 days out.
- Work you have already submitted is hidden by default. There is a switch for that in
  Settings.
- Some course websites publish a date with no time. Those rows say **"time not given"**
  rather than inventing one, and you should check the course page for the real cutoff.
- Rows marked **practice** are ones the source says do not count toward your grade.
- Reminders arrive 24 hours and 2 hours before a deadline, with quiet hours from 11 PM
  to 8 AM. Both are adjustable in Settings → Reminders, and you can switch them off.

  **If reminders never appear at all**, it is almost always macOS rather than the
  extension: macOS silently drops notifications for an app it was never asked about.
  Check **System Settings → Notifications → Google Chrome** is allowed. (There used to be
  a "Send a test reminder" button here to check this with; it was removed, and there is no
  in-app way to test one now. If you think reminders are broken, say so and send the
  screenshot below — do not wait for a deadline to prove it.)

## Updating

When you get a new zip:

1. Unzip it over the old folder, or into a new one.
2. Go to `chrome://extensions` and click the **reload icon** on the Illini Dash card.

Step 2 is the one people forget, and it matters: without it the pages update but the
background stays on the old build. You do not have to check — if it happens, Settings puts
a sentence at the top naming both builds and telling you to reload, and any button that
talks to the background — Hide, Mark done, Merge — answers with the same sentence rather
than doing nothing.

If you loaded the new zip into a *different* folder, remove the old entry from
`chrome://extensions` so you are not running two copies.

---

## If something looks wrong

**Anything at all — a red dot, an empty list, a deadline you know about that is not
there:**

Open the popup and **press the footer line** — the one that says something like
`4 sources · synced just now`. That opens **Sources**: every site on its own row, with
what each one last did and when. **Send a screenshot of that panel**, plus one sentence
saying what you expected to see instead.

That panel is the whole picture of which sources worked. It does not show how many items
each course produced, which is the other half — there is no longer a button that reports
that, so say in words which courses look short or empty.

(There used to be a **Copy diagnostics** button in Settings that produced all of this as
text with nothing identifying in it. It was removed. If a screenshot is awkward, say so
— it is worth putting back.)

**A deadline is on a site but missing from the list:**

This is the most useful bug you can report, and there is a shortcut for it. Right-click
the page that shows the deadline and choose **Report this page to Illini Dash**. That
opens Settings with the address filled in and the form already open. (By hand: Settings →
**Your data** → **A deadline is missing** → **Prepare a report**.) Press **Prepare
report**, which fetches the
page, removes what it can recognise as yours, and hands you a file to attach. Nothing is
sent automatically — you choose whether to send it.

If you are asked for your NetID and name on that screen, it is so they can be **removed**
from the file. They are not stored or sent anywhere.

**A deadline is in the list that should not be, or one row is really two:**

Use the `⋯` menu on the row. **Split** pulls a wrongly-merged row apart, **Hide** removes
one you do not want, **Mark done** is for work you finished that the source cannot tell
is finished — anything on a course website, or handed in on paper — and **Give it a
date** appears on a row whose source listed no date, or printed one nothing could read.
Those rows are gathered on the **Alerts** tab.

Tell us when you use Split, though. Merging two sources' copies of one assignment into
one row is the hardest thing this extension does, and every correction you make is a
measurement we need.

## Removing it

`chrome://extensions` → Remove. That deletes everything it stored. There is nothing on a
server to delete, because there is no server.

**If you connected Google Calendar, press Disconnect first.** That deletes the Illini Dash
calendar and its events from your Google account. Removing the extension without doing so
leaves that calendar behind, because an extension that is gone cannot tidy up after
itself; you can still delete it yourself in Google Calendar, and revoke the permission at
https://myaccount.google.com/permissions.

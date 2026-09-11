# Installing Illini Dash (beta)

Illini Dash puts every deadline from Canvas, Gradescope, PrairieLearn, PrairieTest and
some course websites into one list.

It reads those sites using the logins already in your browser. It never sees a password,
nothing is uploaded anywhere, and everything it knows is stored on your own machine.
Uninstalling it deletes all of that.

This is a beta, so it is not in the Chrome Web Store yet and you install it by hand.
That takes about two minutes.

---

## Install

1. Unzip the file you were sent. You will get a folder called something like
   `illini-dash-0.1.0-20260910T184016`.
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

Rows tick themselves green as each site starts working. **Open all sign-in pages** opens a
tab for each one you picked that is not signed in yet, which is faster than finding four
sites by hand. **Show my calendar** is clickable the whole time — it never blocks you.

This screen appears once. It does not come back when a session later expires; that shows
as a yellow dot and a banner instead, because the deadlines already fetched are still
worth seeing.

## Check it worked

Click the Illini Dash icon.

- The header shows one small dot per source. **Grey means "not checked yet"** and should
  turn green within a few seconds.
- **Yellow means that source needs you to sign in.** Click the dot and it opens the
  login page. Come back and the dot clears itself.
- **Red means something broke.** Hover it for the reason, and see "If something looks
  wrong" below.
- Under the dots you should see a line like
  `Checked 3:21 PM · 4 of 4 sources OK · build 20260910T184016`.

Sign in to Canvas, Gradescope, PrairieLearn and PrairieTest in this browser if you have
not already. The extension can only read what you can read.

**If you do not use one of them** — plenty of people never touch PrairieTest — open
Settings with the gear icon and switch that source off. It stops being counted.

**If you take PHYS 211, 212, 213 or 214**, switch **smartPhysics** on in Settings. It is
off by default because most people are not in those courses, and it would otherwise sit
there asking them to sign into a site they have never used. Its deadlines are at 8:00 AM
rather than 11:59 PM, which is exactly the kind the usual habit misses.

## What to expect in the first week

- The list only goes 60 days out.
- Work you have already submitted is hidden by default. There is a switch for that in
  Settings.
- Some course websites publish a date with no time. Those rows say **"time not given"**
  rather than inventing one, and you should check the course page for the real cutoff.
- Rows marked **practice** are ones the source says do not count toward your grade.
- Reminders arrive 24 hours and 2 hours before a deadline, with quiet hours from 11 PM
  to 8 AM. Settings has a **Send a test reminder** button if you want to confirm they
  reach you.

## Updating

When you get a new zip:

1. Unzip it over the old folder, or into a new one.
2. Go to `chrome://extensions` and click the **reload icon** on the Illini Dash card.
3. Open the popup and check the build id at the end of the status line matches the new
   zip's filename.

Step 2 is the one people forget, and it matters: without it the pages update but the
background stays on the old build. The popup notices and says **STALE SERVICE WORKER**
with both build ids when that happens.

If you loaded the new zip into a *different* folder, remove the old entry from
`chrome://extensions` so you are not running two copies.

---

## If something looks wrong

**Anything at all — a red dot, an empty list, a deadline you know about that is not
there:**

Open Settings (the gear in the popup), scroll to **Data**, and press
**Copy diagnostics**. That puts a summary on your clipboard: which sources worked, how
many items each course produced, what failed and when. It contains **no assignment
titles, no links and nothing that identifies you**, so it is safe to paste anywhere.
Send that.

**A deadline is on a site but missing from the list:**

This is the most useful bug you can report, and there is a shortcut for it. Right-click
the page that shows the deadline and choose **Report this page to Illini Dash**. That
opens Settings with the address filled in. Press **Prepare report**, which fetches the
page, removes what it can recognise as yours, and hands you a file to attach. Nothing is
sent automatically — you choose whether to send it.

If you are asked for your NetID and name on that screen, it is so they can be **removed**
from the file. They are not stored or sent anywhere.

**A deadline is in the list that should not be, or one row is really two:**

Use the `⋯` menu on the row. **Split** pulls a wrongly-merged row apart, **Hide** removes
one you do not want, and **Mark done** is for work you finished that the source cannot
tell is finished — anything on a course website, or handed in on paper.

Tell us when you use Split, though. Merging two sources' copies of one assignment into
one row is the hardest thing this extension does, and every correction you make is a
measurement we need.

## Removing it

`chrome://extensions` → Remove. That deletes everything it stored. There is nothing on a
server to delete, because there is no server.

# Google Stitch prompt — Illini Dash popup

Paste the brief as the first message in a new Stitch project (Web, custom frame
400×600). Ask for the Today screen first, then the others one at a time. Ask for dark
mode first. The brief fixes what cannot move (the frame, what has to be on screen, the
brand colours) and leaves the look to Stitch.

---

## The brief

```
Design the popup UI for "Illini Dash", a Chrome extension for University of Illinois
students. It pulls deadlines from all their course sites (Canvas, Gradescope,
PrairieLearn, PrairieTest, smartPhysics, Piazza, course web pages) into one list.
A student opens it several times a day for a five-second check: what's due, what's
late, and whether every source was actually read.

Frame: 400px wide. Chrome caps the popup at 600px tall and scrolls it, so the most
important content has to land in the first 600px. No browser chrome or window frame.

Brand: Illini navy and orange. Dark mode is the primary mode. Light mode should feel
like the same product. System font, no web fonts.

Tone: a calm, dense utility a student trusts — closer to Things, Fantastical or Linear
than to a dashboard or a landing page. Small type, tight rows, lots of information
without feeling crowded. No illustrations, no gradients, no marketing.

Every screen needs:
- A small header with the product name, a status pill ("All clear", "2 late",
  "1 needs you", "Syncing…"), an add button, and a more/overflow button.
- A way to switch between five views: Today, Week, Month, No date, Exams. "No date"
  and "Exams" show a count.
- A persistent footer that says how many sources synced and when, with a "Sync now"
  action. It turns amber when a source failed.
- Room for an optional warning banner above the content (e.g. "Gradescope: signed
  out — rows may be old  [Sign in]").

The deadline row is the core element. Each one has: the course (a colour per course),
a title, where it came from and any detail (a room, "opens 9 AM", "+2 more" when
several sources reported the same thing), and on the right how soon it is due plus the
clock time. Some rows are late (red), some are done (struck through), some only have a
date and no time ("end of day"), some are events like office hours rather than work.
Tapping a row opens a detail screen.

Screens to design:
1. Today — what's next, the rest of today, tomorrow, the rest of the week. Include a
   version where nothing is due and the app says so confidently.
2. Week — seven days, today highlighted, with a way to move between weeks.
3. Month — a compact grid with per-course dots, tapping a day lists it below.
4. No date — items whose date couldn't be read, with a "give it a date" action.
5. Exams — grouped by month, with room, duration, and a "Book" action when a slot
   still has to be reserved.
6. Deadline detail — course, title, due time with a countdown, facts (source, status,
   late window, "moved by a Piazza post"), and actions: mark done, add to calendar,
   hide course, hide this item.
7. Add/edit — title, course, kind, date, time, with a "no date yet" option.
8. Needs you — reached from the status pill: late items, suggestions from course
   posts, and sources needing sign-in or permission.
9. First run — pick which sources to read, one primary "Find my deadlines" button.

Keep rows starting close to the top of the popup; a big greeting or date headline
wastes the space the student came for. Five tabs must fit in one row at 400px.
Don't invent sources, settings or features beyond what's listed.

Start with Today, dark mode.
```

## If it drifts

- Big greeting or date block at the top → "Cut it, rows start near the top."
- Tabs wrap or move to the bottom → "Five tabs, one row, top of the content."
- Adds search, avatar, notifications, sidebar → "Header is name, pill, add, more only."
- Light when asked for dark → "Dark mode first."

## What to bring back

PNGs of each screen into `docs/design/stitch/`, dark and light. The exported CSS is a
spacing reference, not code to ship: the extension's CSS stays token-based and never
makes `html`/`body` a scroll container. Then check it against
`docs/popup-feature-inventory.md` the way R1 did for the last mock.

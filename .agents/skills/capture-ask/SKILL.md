---
name: capture-ask
description: Write the ask when illini-dash needs something only Sushi's browser can do — capture a fixture, read a console, click through UI, grant a permission, check a marker. Use before asking for any browser round-trip, when a question turns out to need a logged-in page, or when a VERIFY / §12 item is hit. Covers the one-action-at-a-time rule, which console to name, the options-page capture tool, the scrub step, and a template.
---

# Asking Sushi for a browser action

AGENTS.md: *"Sushi's time is the scarce resource. Every browser round-trip — load, log in,
capture, tick, read the console — is a real interruption."*

## Before you ask

*"Exhaust what the repo can answer: read `dist/`, run the adapter over the fixture, check
the built bundle actually contains the code in question."* Grep `dist/*.js` for the code
you doubt; run the parser over its fixture; read `docs/<source>-findings.md`.

Then check the ask is worth making: *"A question whose answers all lead to the same next
step is not worth asking."* And *"prefer a diagnostic that distinguishes several
hypotheses at once over a yes/no."*

If the round-trip would have been answered by a log line, **add the log line** (worker
rule 5: log both branches of any decision the user will have to debug) — do not just
apologise for the round-trip.

## The rules of the ask

- **One action at a time**, with exact steps and *the literal output to look for*.
- Say **what each possible answer would prove**. Three hypotheses, three answers.
- **Name the console.** UI rule 1: *"A popup and the service worker have different
  consoles, and neither shows the other's output."* Five rounds were spent on the
  `background.js` inspector, which *"structurally cannot contain a page's errors."*
  - worker: `chrome://extensions` → the Illini Dash card → **service worker** link
  - popup: right-click the popup → **Inspect popup**
  - **prefer the full view** — *"it is an ordinary tab with ordinary devtools"*
- Reload after a build: Chrome keeps the running worker. `STALE SERVICE WORKER: this page
  is build A, the worker is build B.` means hit **Reload** on the card (docs/dev-loop.md).

## Capturing a fixture (the usual ask)

Settings → **Developer** → **Fixture capture**. *"Fetches a page the way the sync loop
will, scrubs it per Appendix A, and hands it back as a download."*

1. Fill **NetID** and **Name** first — they are used only to scrub and are stored in that
   page only. Without them the scrubber cannot recognise the identifying strings.
2. Paste the URL, press **Fetch**. `isAllowedCaptureUrl` accepts **any https URL** — the
   `*.illinois.edu` rule went on 2026-09-18, because course sites live on cs124.org,
   cs128.org and cs225.org too. Which host it is on is decided by the permission, not
   here: the five source hosts are granted up front and anything else prompts by name,
   with `No permission for <origin>/*` if it has not been granted from a click.
3. Read the result box back to me: the final URL, the status, whether it redirected, the
   byte count, the login verdict, and the **Scrub report (Appendix A)** — every `MUST FIX`
   line matters.
4. Press **Download scrubbed (<filename>)**. If the button instead says **Download anyway
   (N unresolved — do not commit)**, stop and send the report, not the file.
5. Save it into `fixtures/<source>/`. **Never commit the raw download** — its button is
   labelled `Download raw (do not commit)` and its filename is prefixed
   `RAW-DO-NOT-COMMIT-`.

To re-scrub a file already on disk, no browser is needed:

```bash
npm run scrub -- <in> <out> --name "Given Family" --netid jdoe42
```

It uses the same `src/core/scrub.ts` the options page uses, prints the report, and
*"exits non-zero if it produced any warning, so a file that still looks identifying cannot
be committed by accident."*

Two failures worth naming in the ask: an optional-permission host answers
`No permission for <origin>/*` (Chrome must be asked from a click), and a Shibboleth page
answers **401 in place** rather than redirecting.

## Template

> **One thing, in the browser — about 2 minutes.**
>
> **Why:** <the hypothesis this settles, in one sentence>
>
> **Steps**
> 1. `chrome://extensions` → Reload on the Illini Dash card (the worker is older than the
>    build otherwise).
> 2. Open <the full view / the popup, right-click → Inspect popup / the card's service
>    worker link> → Console, filter `illini-dash`.
> 3. <the single action>
>
> **Read back the line that starts `…`.**
>
> | What you see | What it proves | What I do next |
> |---|---|---|
> | `<literal A>` | <hypothesis 1 holds> | <next step> |
> | `<literal B>` | <hypothesis 2 holds> | <next step> |
> | nothing at all | <the code never ran> | <next step> |

## What I must never ask you to do for me

AGENTS.md, "Things I have to do (you can't)": load the unpacked extension and report
console output; log into the sites and capture fixture HTML; grant permissions and click
through UI. *"Ask for these explicitly, one at a time, with exact steps."*

# Google Calendar sync

SPEC §8.3's third route, and the one exception §0 rule 1 now names. Off by default;
nothing here happens until a student presses **Connect** in Settings.

---

## What Sushi has to do before this can run

**Done, 2026-09-18:** both values below are in `public/manifest.json`. The key was
verified to derive the store's extension id before it was pasted (SHA-256 of the DER,
first 32 hex digits mapped a–p). The section stays as the record of where they came from.

Two values have to exist, and only Sushi can create them. Until they do, the Settings
section draws itself and says *"Google Calendar is not set up in this build yet: the OAuth
client id in manifest.json is still a placeholder"* — it does not fail silently, and it
does not open a window that errors.

Do these in order; the second needs the first.

### 1. The extension key → `public/manifest.json`

A "Chrome Extension" OAuth client is bound to an **extension id**, and an unpacked
extension's id is derived from its public key. Without a fixed `key` in the manifest, the
id changes and the OAuth client stops matching.

1. Open the Chrome Web Store developer dashboard, the **Illini Dash** draft
   (`mimgaiaicopabbiabakmknkcbfekplei`).
2. **Package** tab → **View public key**.
3. Copy the base64 between the `-----BEGIN PUBLIC KEY-----` lines, as one line with no
   newlines.
4. Add it to `public/manifest.json` as a top-level `"key": "<that base64>"`.

**It is deliberately not in the repo as a placeholder.** Chrome refuses to load an
unpacked extension whose `key` is not valid base64, and `dist/` is what gets loaded every
day (`docs/dev-loop.md`). A placeholder there would break the development loop to save one
paste. `tests/manifest.test.ts` asserts the field is absent, so adding the real one will
make that test fail — change the assertion to check the value is base64 when you paste it.

After pasting, `npm run build`, reload the card on `chrome://extensions`, and confirm the
id is still `mimgaiaicopabbiabakmknkcbfekplei`.

### 2. The OAuth client → `oauth2.client_id`

1. Google Cloud console → the project → **APIs & Services**.
2. Enable the **Google Calendar API** if it is not already.
3. **OAuth consent screen**:
   - User type **External**, and **publish it In production**. In Testing, tokens expire
     after seven days and only listed test accounts work.
   - App name: `Illini Dash`. User support email and developer contact: your address.
   - **Scopes**: add exactly one, `https://www.googleapis.com/auth/calendar.app.created`.
     The console will show it as **non-sensitive** — that is the whole reason this feature
     could be built. Do **not** add `calendar`, `calendar.events` or
     `calendar.events.owned`: each is sensitive, each triggers a verification review, and
     each grants access to every calendar the student has.
4. **Credentials → Create credentials → OAuth client ID → Application type: Chrome
   Extension**. Item ID: `mimgaiaicopabbiabakmknkcbfekplei`. This client type has **no
   client secret**, which is why `getAuthToken` is used rather than `launchWebAuthFlow`
   (that one would mean storing a refresh token and shipping a secret inside a zip anyone
   can unpack).
5. Copy the client id and paste it over `REPLACE_ME.apps.googleusercontent.com` in
   `public/manifest.json`'s `oauth2.client_id`.

`isGcalConfigured` in `src/core/gcal-config.ts` is what decides whether the id is real; it
validates the shape positively rather than comparing against the placeholder, so a
half-pasted id also reads as "not set up".

### 3. Then, in the browser

1. `npm run build`, reload the card.
2. Settings → **Google Calendar** → switch on.
3. Chrome asks for `https://www.googleapis.com/*`. Allow it.
4. Google's consent window appears, naming one permission about calendars this app
   creates. Allow it.
5. The row should read **Pushed N events · <time>**, where N is roughly the number of
   unfinished deadlines in the popup. A new calendar named **Illini Dash** should appear in
   calendar.google.com, in Illini orange.

If instead it reads **Blocked**, the @illinois.edu Workspace tenant refuses unverified
apps; sign a personal Google account into Chrome and press Connect again. That is a real
state with its own sentence, not an error.

---

## The design

| File | What it owns |
|---|---|
| `src/core/gcal-config.ts` | The scope, the placeholders, the calendar's name and colour, and `isGcalConfigured` |
| `src/core/gcal.ts` | **What goes on the calendar.** `projectEvents`, `diffEvents`, `eventBody`. Pure |
| `src/core/gcal-auth.ts` | **What every failure is called**, and the sentence a student reads. Pure |
| `src/core/gcal-client.ts` | The HTTP calls over an injected `fetch`, plus `pushEvents` and `purgeCalendar` |
| `src/core/store.ts` | The `gcal` block and its migration |
| `src/core/health.ts` | `gcalRow` — never green without a push behind it |
| `src/background.ts` | The token, the permission, the queue, the logging. No decisions |

### Decisions worth not re-litigating

- **One scope, and it is non-sensitive.** See above. This is the single fact the whole
  feature rests on, and `tests/manifest.test.ts` pins it against the three sensitive
  scopes by name.
- **A finished deadline is deleted, not dimmed.** The popup strikes finished work through;
  a calendar app cannot. A done deadline still occupying a slot is the complaint that
  started this.
- **An invented time becomes an all-day event.** §4.5's runner fills in 23:59 for a course
  page that prints a bare date. A calendar entry at 11:59 PM looks more authoritative than
  a row in a popup, and it is the one the student will still be trusting in three weeks
  (worker rule 3).
- **A green chip comes from a push, never from a connection.** `state: "connected"` means
  a token was obtained. `lastPushAt` and `lastPushCount` are written only by a push that
  returned, and they are what the chip prints (worker rule 2).
- **The diff runs against the store, not against Google.** `gcal.byItemId` holds an event
  id and the hash of the body we last wrote, so an unchanged deadline costs no request.
  `events.list` runs only at connect time or after a reset, to adopt events that are
  already there rather than duplicate them.
- **`PATCH`, never `PUT`.** `events.update` replaces the resource and drops
  `extendedProperties` — one call and every event on the calendar becomes an orphan this
  extension can neither find nor delete.
- **The push is started outside the store queue's hold.** `gcalPush` takes the queue
  itself; starting it from inside a sync's hold would run its first section re-entrantly
  and let the rest continue unqueued, which is worker rule 4's exact defect.

### What it costs

One `events.list` at connect. After that, one request per changed deadline per sync, and
none at all when nothing changed. A semester is a few hundred events; a typical sync sends
zero.

### Looking at it without a Google account

`npm run preview`, then `dist/preview-options.html?gcal=<state>`:

| `?gcal=` | What it draws |
|---|---|
| (absent) or `off` | The switch, off |
| `fresh` | Connected, nothing pushed yet — the state that must **not** be green |
| `connected` | Pushed 14 events · <time> — the only green one |
| `empty` | Pushed 0 events, which is a healthy answer and not a failure |
| `admin_blocked` | The @illinois.edu sentence |
| `expired`, `declined`, `rate_limited`, `calendar_missing` | One each |
| `?stale=1` | A worker from before this feature: the section reads "Off" and the banner names `gcal` |

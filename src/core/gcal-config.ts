/**
 * The two values Sushi has to paste in, and the one scope this extension asks
 * for — kept in core so the suite can assert about them and so the code that
 * has to *say* "this is not set up yet" has something to read.
 *
 * Why a config module and not just the manifest: `chrome.identity.getAuthToken`
 * reads `oauth2.client_id` out of the manifest and nowhere else, so the manifest
 * must carry it eventually. But until it is a real id, every Connect press ends
 * in an opaque `OAuth2 request failed` in a console nobody has open. The
 * placeholder is spelled here so `isGcalConfigured` can turn that into a
 * sentence on the row (worker rule 5: log — and say — both branches).
 *
 * The manifest `key` is deliberately *not* in `public/manifest.json`. Chrome
 * refuses to load an unpacked extension whose `key` is not valid base64, and
 * `dist/` is the thing Sushi loads every day (docs/dev-loop.md). A placeholder
 * there would break the whole development loop to save one paste; docs/gcal.md
 * says exactly where it goes instead.
 */

/**
 * The only scope this extension will ever request.
 *
 * Sushi checked the Google Cloud console on 2026-09-18: `calendar.app.created`
 * is classified **non-sensitive**, so there is no verification review and no
 * 100-user cap — which is precisely why SPEC §1's "Google Calendar OAuth sync"
 * row could be rewritten. It grants create-a-secondary-calendar and full access
 * to calendars this app created, and *no* access to any other calendar the
 * student has. `calendar.events` and `calendar.events.owned` are sensitive and
 * must never appear here: adding one turns a no-review feature into a months
 * long verification and hands the extension the student's whole calendar.
 */
export const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";

/**
 * The OAuth client id, as the manifest's `oauth2` block must also spell it.
 *
 * A "Chrome Extension" OAuth client, which carries no client secret: Chrome
 * holds the grant and hands out tokens. That is why `getAuthToken` is preferred
 * over `launchWebAuthFlow` for the beta — the latter would mean storing a
 * refresh token in `chrome.storage.local` and shipping a client secret inside a
 * file anybody can unzip.
 */
export const GCAL_CLIENT_ID_PLACEHOLDER = "REPLACE_ME.apps.googleusercontent.com";

/** The extension key placeholder, for the message that tells Sushi it is unset. */
export const GCAL_KEY_PLACEHOLDER = "REPLACE_ME";

/** The name of the one calendar this extension creates and writes to. */
export const GCAL_CALENDAR_NAME = "Illini Dash";

/** What that calendar's own description says, so it is obvious in Google's UI. */
export const GCAL_CALENDAR_DESCRIPTION =
  "Created by the Illini Dash Chrome extension. Every event here is a course " +
  "deadline it read from your course sites. Deleting this calendar removes them " +
  "all; nothing else in your Google account is touched.";

/**
 * §8.3's timezone. Every deadline this extension reads is a UIUC one.
 *
 * Sent with each timed event because Google resolves a floating time against
 * the *calendar's* zone otherwise, and a student travelling over winter break
 * would see every deadline shift.
 */
export const GCAL_TIMEZONE = "America/Chicago";

/**
 * The one host this feature talks to, and the match pattern it is granted by.
 *
 * *Optional*, not up front. §0 rule 1's amended wording makes Google Calendar
 * the single user-initiated exception to "nothing leaves the browser", and an
 * exception that appears in the install prompt for every student who will never
 * use it is not opt-in in any sense a reader would recognise. It is requested
 * from the Connect click, exactly as the Campuswire origin is, and covered by
 * the same one-wildcard `optional_host_permissions` entry the course-site
 * adapters use.
 *
 * It matters in its own right and not only for tidiness: without the grant, a
 * cross-origin `fetch` from the service worker is subject to CORS and fails as
 * `TypeError: Failed to fetch` — §6's *network* error, announced about a host
 * the extension was never allowed to try (the exact defect `manifest.test.ts`
 * exists for).
 */
export const GCAL_API_ORIGIN = "https://www.googleapis.com";
export const GCAL_MATCH = `${GCAL_API_ORIGIN}/*`;

/** Illini orange, so the calendar is findable in a list of grey ones. */
export const GCAL_CALENDAR_COLOR = "#E84A27";

/**
 * Whether the client id is a real one rather than the placeholder.
 *
 * Positive validation, not `!== placeholder` (house rule 5): a half-pasted id,
 * an empty string, or the console's "copy" having grabbed the client *secret*
 * all have to read as "not configured" rather than sail through into a
 * `getAuthToken` that fails for a reason nobody can see. Google's Chrome
 * Extension client ids are `<digits>-<lowercase/digits>.apps.googleusercontent.com`.
 */
export function isGcalConfigured(clientId: string | undefined): boolean {
  if (typeof clientId !== "string") return false;
  return /^\d{6,}-[a-z0-9]{10,}\.apps\.googleusercontent\.com$/.test(clientId);
}

/** What to say when it is not. Names the file and the field, because that is the fix. */
export const GCAL_NOT_CONFIGURED =
  "Google Calendar is not set up in this build yet: the OAuth client id in " +
  "manifest.json is still a placeholder. See docs/gcal.md.";

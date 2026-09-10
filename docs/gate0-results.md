# Gate 0 — cookie-authenticated fetch from the service worker

**Run 2026-09-03, from the extension's service worker (`chrome-extension://` origin), `credentials: "include"`.**
Result: **PASS, 4 of 4.** No redirects, no login landings. The §2.2 content-script
fallback is not needed.

| Source | Request | Status | Final URL | Redirected | Content-Type | Body |
|---|---|---|---|---|---|---|
| Canvas | `/api/v1/courses?enrollment_state=active&per_page=100` | 200 | unchanged | no | `application/json` | 3337 B |
| Gradescope | `https://www.gradescope.com/` | 200 | unchanged | no | `text/html` | 16880 B |
| PrairieLearn | `https://us.prairielearn.com/pl/` | 200 | unchanged | no | `text/html` | 20457 B |
| PrairieTest | `https://us.prairietest.com/pt/` | 200 | unchanged | no | `text/html` | 15440 B |

Logged-in content confirmed by body preview: Canvas returned a real course array;
Gradescope returned `<title>Your Courses | Gradescope</title>` (matches §4.2);
PrairieLearn `<title>Home | PrairieLearn</title>`; PrairieTest served its app shell
with an `HX-Assets-Version` meta (htmx). PL/PT logged-in state is inferred from
"200, no redirect, 15–20 KB" rather than from visible enrolled-course text in the
first 300 chars; step 4's fixture capture will confirm it directly.

## Findings that differ from, or add to, the spec

1. **No `while(1);` prefix on Canvas.** §4.1 says a browser-session call gets a
   `while(1);` JSON-hijacking prefix. This deployment does not add one — the body
   starts with `[{"id":58438,…`. The spec already says to *detect* the prefix rather
   than slice a fixed 9 characters, so the planned code is right either way; keep the
   detection, don't require the prefix.
2. **No `Link: rel="next"` header** on this response — one page of courses. Pagination
   handling (§4.1) still gets written; it just isn't exercised by this account yet.
3. **`enrollment_state=active` leaks a stale course.** The first entry is
   `"FA25 IBC NDA and Code of Conduct Forms"`, `start_at 2025-08-25`,
   `enrollment_term_id 109` — a year old. Confirms §4.1's note that concluded courses
   reach the planner; the course-map filter is load-bearing, not defensive.
4. **Some Canvas `course_code`s are opaque slugs.** That course's `course_code` is
   `bus_ilbc_open_249233`, which the §5.1 regex `\b([A-Z]{2,4})\s*-?\s*(\d{3}[A-Z]?)\b`
   will not match (and must not — a false match here would be worse). It falls to the
   `courseRaw` prefix fallback. Real input for the §5.1 tests in step 7.

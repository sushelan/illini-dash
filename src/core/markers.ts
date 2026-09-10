/**
 * Marker probe for captured pages.
 *
 * Two of the open questions in §12 are literally "fetch the page and see whether
 * this string is in it": whether PrairieLearn ships the access-details table in
 * the HTML (Q1) and whether the PrairieTest available-card row carries a link
 * (Q2). Rather than eyeball a 20 KB file, every capture is searched for the
 * strings the spec's parser rules depend on, and the result is displayed.
 *
 * Pure function over a string, so it is testable and runs anywhere.
 */

export interface Marker {
  /** The literal string to look for. */
  needle: string;
  /** Why it matters, shown next to the result. */
  why: string;
}

export interface MarkerHit extends Marker {
  count: number;
}

export interface MarkerGroup {
  label: string;
  /** Only probed when the captured URL matches. */
  urlPattern: RegExp;
  markers: Marker[];
}

export const MARKER_GROUPS: MarkerGroup[] = [
  {
    label: "Gradescope course page (§4.2)",
    urlPattern: /gradescope\.com\/courses\/\d+/,
    markers: [
      { needle: "table--primaryLink", why: "row selector: the assignment name cell" },
      { needle: "submissionTimeChart--dueDate", why: "due and late-due times" },
      { needle: "submissionTimeChart--releaseDate", why: "extra.releasedAt" },
      { needle: "submissionStatus", why: "status cell" },
      { needle: "Late Due Date", why: "the aria-label discriminator for late due" },
    ],
  },
  {
    label: "Gradescope dashboard (§4.2)",
    urlPattern: /gradescope\.com\/?$/,
    markers: [
      { needle: "Your Courses", why: "confirms the logged-in dashboard" },
      { needle: "/courses/", why: "course card links" },
    ],
  },
  {
    label: "PrairieLearn assessments (§4.3, open question 1)",
    urlPattern: /prairielearn\.com\/pl\/course_instance\/\d+\/assessments/,
    markers: [
      {
        needle: "Access details",
        why: "OPEN QUESTION 1: the credit schedule popover is in the fetched HTML",
      },
      {
        needle: "data-bs-content",
        why: "OPEN QUESTION 1: popover body carried as an attribute",
      },
      { needle: "% until", why: "the credit cell text fallback" },
      { needle: "Not started", why: "score cell → status" },
    ],
  },
  {
    label: "PrairieTest home (§4.4)",
    urlPattern: /prairietest\.com\/pt\/?$/,
    markers: [
      { needle: "Exam reservations", why: "the booked card heading" },
      {
        needle: "Exams available for reservations",
        why: "the available card heading",
      },
      { needle: "Testing center availability", why: "a third card §4.4 does not mention" },
      {
        needle: "data-format-date",
        why: "the machine-readable exam instant (ISO 8601 + IANA zone)",
      },
      { needle: 'data-testid="exam"', why: "row hook: title + reservation link" },
      { needle: 'data-testid="date"', why: "row hook: the time column" },
      { needle: 'data-testid="location"', why: "row hook: CBTF location" },
      {
        needle: "/pt/student/reservation/",
        why: "the reservations-card href — a RESERVATION id, not an exam id (§12 Q2)",
      },
      {
        needle: "You don't currently have any exams available for reservations",
        why: "legitimate empty AVAILABLE card (not a parse error)",
      },
      {
        needle: "You don't have any upcoming reservations",
        why: "legitimate empty RESERVATIONS card (not a parse error)",
      },
      {
        needle: "Make a reservation",
        why: "the available-row control — never yet observed in a capture",
      },
    ],
  },
  {
    label: "Canvas API (§4.1)",
    urlPattern: /canvas\.illinois\.edu\/api\//,
    markers: [
      { needle: "while(1);", why: "the JSON-hijacking prefix (absent on this deployment)" },
      { needle: "plannable_type", why: "planner item shape" },
      { needle: "course_code", why: "course map" },
    ],
  },
];

export interface ProbeResult {
  group: string;
  hits: MarkerHit[];
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/** Runs every marker group whose urlPattern matches `url`. */
export function probeMarkers(url: string, body: string): ProbeResult[] {
  return MARKER_GROUPS.filter((g) => g.urlPattern.test(url)).map((group) => ({
    group: group.label,
    hits: group.markers.map((m) => ({ ...m, count: countOccurrences(body, m.needle) })),
  }));
}

/**
 * Fixture scrubbing (Appendix A).
 *
 * Fixtures get committed, so anything identifying has to come out first. What
 * must NOT come out: course names, assignment names, dates, and the DOM
 * structure — those are exactly what the parsers are tested against. So this is
 * deliberately conservative. It replaces things it can recognize with certainty
 * and reports counts; it never rewrites markup or drops elements.
 *
 * Pure function, no I/O, so it is testable and runs the same in the options page
 * as in a test.
 */

export interface ScrubOptions {
  /** The student's NetID, if known. Replaced everywhere, case-insensitively. */
  netid?: string;
  /** The student's display name, e.g. "Jane Doe". Replaced with STUDENT. */
  name?: string;
}

/**
 * "blocker" means the output still looks identifying and must not be committed.
 * "note" is context — e.g. a substitution that never ran because nothing was
 * supplied for it. Mixing the two would make the loud one easy to skim past.
 */
export interface ScrubWarning {
  severity: "blocker" | "note";
  message: string;
}

export interface ScrubReport {
  /** Replacement label → how many substitutions were made. */
  counts: Record<string, number>;
  warnings: ScrubWarning[];
}

export interface ScrubResult {
  html: string;
  report: ScrubReport;
}

/** Order within the rules array is the run order; see the comments in scrubHtml. */
interface Rule {
  label: string;
  pattern: RegExp;
  replacement: string;
}

const BASE_RULES: Rule[] = [
  {
    label: "email address",
    pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    replacement: "student@illinois.edu",
  },
  {
    // UIN. The boundary is any word character or hyphen, not just a digit:
    // Canvas embeds 40-char hex hashes (resource_link_id) and UUIDs
    // (lti_context_id) that contain 9-digit runs bounded by hex letters, and a
    // digit-only lookaround happily rewrote the middle of those.
    label: "9-digit student id",
    pattern: /(?<![\w-])\d{9}(?![\w-])/g,
    replacement: "000000000",
  },
  {
    // Canvas embeds the student's own numeric user id in every enrolment object.
    // Appendix A calls for "any student IDs", and these cannot be matched by
    // shape — they are the same length as course ids — so they are matched by
    // the key that holds them.
    label: "identifying id field (number)",
    pattern:
      /("(?:user_id|sis_user_id|login_id|sis_login_id|integration_id|associated_user_id)"\s*:\s*)\d+/g,
    replacement: "$1" + "0",
  },
  {
    label: "identifying id field (string)",
    pattern:
      /("(?:user_id|sis_user_id|login_id|sis_login_id|integration_id|sortable_name|short_name|primary_email)"\s*:\s*")[^"]*(")/g,
    replacement: "$1REDACTED$2",
  },
  {
    // Gradescope embeds presigned S3 URLs for course files, carrying an AWS
    // access key id, an STS session token and a signature. They expire, but
    // they must not be committed. The parameter names and the URL shape are
    // kept so the markup a parser sees is unchanged.
    label: "aws presigned url credential",
    pattern:
      /((?:X-Amz-(?:Credential|Security-Token|Signature)|AWSAccessKeyId|Signature)=)[^&"'\s]+/gi,
    replacement: "$1SCRUBBED",
  },
  {
    // Session/CSRF material. Not PII, but it should not be committed either.
    label: "csrf token (meta)",
    pattern: /(<meta[^>]*name=["']csrf-token["'][^>]*content=["'])[^"']*(["'])/gi,
    replacement: "$1SCRUBBED$2",
  },
  {
    label: "csrf token (form input)",
    pattern:
      /(<input[^>]*name=["'](?:authenticity_token|__csrf_token|csrf_token)["'][^>]*value=["'])[^"']*(["'])/gi,
    replacement: "$1SCRUBBED$2",
  },
];

/** Escapes a user-supplied string for literal use in a RegExp. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Things worth a human's eye that this function will not touch on its own. */
const WARNING_PROBES: { label: string; pattern: RegExp }[] = [
  { label: "an Authorization or Bearer token", pattern: /\bBearer\s+[A-Za-z0-9._-]{16,}/ },
  { label: "a session cookie assignment", pattern: /document\.cookie\s*=/ },
  { label: "the word 'password'", pattern: /\bpassword\b/i },
  { label: "a UIUC NetID-looking word next to 'netid'", pattern: /netid["'\s:=>]+[a-z][a-z0-9]{2,}/i },
];

export function scrubHtml(html: string, options: ScrubOptions = {}): ScrubResult {
  const counts: Record<string, number> = {};
  const warnings: ScrubWarning[] = [];
  let output = html;

  const rules: Rule[] = [];

  // Name and NetID first: they are the most specific, and running them before
  // the email rule would leave "STUDENT@illinois.edu" behind, so they go after
  // emails but before anything else. Order within this array is the run order.
  rules.push(BASE_RULES[0]!); // email
  if (options.name?.trim()) {
    const full = options.name.trim();
    // The whole string first, then each part on its own. A page that renders
    // "Given Family" while you typed only "Family" would otherwise be left
    // reading "Given STUDENT" — which is exactly as identifying as before.
    const parts = full.split(/\s+/).filter((part) => part.length >= 3);
    // Dedupe: a single-word name would otherwise be added twice, and a part
    // equal to the placeholder would rewrite the page's own markup.
    const needles = [...new Set([full, ...parts])].filter(
      (needle) => needle.toUpperCase() !== "STUDENT",
    );
    for (const needle of needles) {
      rules.push({
        label: needle === full ? "student name" : `student name part "${needle}"`,
        pattern: new RegExp(`\\b${escapeRegExp(needle)}\\b`, "gi"),
        replacement: "STUDENT",
      });
    }
  }
  if (options.netid?.trim()) {
    rules.push({
      label: "netid",
      pattern: new RegExp(`\\b${escapeRegExp(options.netid.trim())}\\b`, "gi"),
      replacement: "netid",
    });
  }
  rules.push(...BASE_RULES.slice(1));

  for (const rule of rules) {
    let hits = 0;
    output = output.replace(rule.pattern, (...args) => {
      hits += 1;
      // Re-apply capture groups for the rules that use them.
      const groups = args.slice(1, -2) as string[];
      return rule.replacement.replace(/\$(\d)/g, (_, d: string) => groups[Number(d) - 1] ?? "");
    });
    if (hits > 0) counts[rule.label] = hits;
  }

  for (const probe of WARNING_PROBES) {
    if (probe.pattern.test(output)) {
      warnings.push({
        severity: "blocker",
        message: `Still contains ${probe.label} — check before committing.`,
      });
    }
  }

  // A capitalised word touching a replacement is very likely the rest of a name
  // that was only partly given — a real capture came back reading
  // "<given name> STUDENT", which is as identifying as before.
  for (const match of output.matchAll(
    /(?:([A-Z][a-z]{2,})\s+STUDENT|STUDENT\s+([A-Z][a-z]{2,}))/g,
  )) {
    const neighbour = match[1] ?? match[2];
    warnings.push({
      severity: "blocker",
      message:
        `"${match[0]}" — the word "${neighbour}" sits next to a replacement and is ` +
        `probably the rest of your name. Re-run with your full name.`,
    });
  }
  if (!options.netid?.trim()) {
    warnings.push({ severity: "note", message: "No NetID given, so no NetID substitution ran." });
  }
  if (!options.name?.trim()) {
    warnings.push({ severity: "note", message: "No name given, so no name substitution ran." });
  }

  return { html: output, report: { counts, warnings } };
}

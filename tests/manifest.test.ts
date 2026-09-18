/**
 * The manifest against the code that depends on it.
 *
 * A missing host permission does not fail at build time, at review time, or in
 * any test that stubs `fetch`. It fails in a browser, on one student's machine,
 * as `TypeError: Failed to fetch` — which §6 classifies as a network error, so
 * the UI says "could not be reached" about a host it was never allowed to try.
 *
 * smartPhysics shipped that way: a first-class source with no entry in
 * `host_permissions` and nothing requesting the optional one. It would have
 * failed for every PHYS 211-214 student the setup screen invites to switch it
 * on, and the beta guide tells them to.
 */

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CANVAS_ORIGIN } from "../src/sources/canvas.js";
import { GRADESCOPE_ORIGIN } from "../src/sources/gradescope.js";
import { PRAIRIELEARN_ORIGIN } from "../src/sources/prairielearn.js";
import { PRAIRIETEST_ORIGIN } from "../src/sources/prairietest.js";
import { SMARTPHYSICS_ORIGIN } from "../src/sources/smartphysics.js";
import { REGISTRY_URL } from "../src/core/registry.js";
import { SOURCE_NAME } from "../src/core/names.js";
import { CAMPUSWIRE_ORIGIN } from "../src/core/campuswire.js";
import { PIAZZA_ORIGIN } from "../src/core/piazza.js";

const build = readFileSync(new URL("../build.mjs", import.meta.url), "utf8");

const manifest = JSON.parse(
  readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"),
) as {
  permissions: string[];
  host_permissions: string[];
  optional_host_permissions: string[];
  version: string;
  description: string;
  homepage_url?: string;
  commands?: Record<string, { suggested_key?: { default?: string }; description?: string }>;
  icons: Record<string, string>;
  action: { default_icon: Record<string, string> };
};

/** Chrome's match-pattern semantics, for the shapes this manifest actually uses. */
function covers(pattern: string, origin: string): boolean {
  const url = new URL(origin);
  const match = /^https:\/\/(\*\.)?([^/]+)\/\*$/.exec(pattern);
  if (!match) return false;
  const [, wildcard, host] = match;
  return wildcard ? url.hostname === host || url.hostname.endsWith(`.${host}`) : url.hostname === host;
}

/**
 * The five hosted sources, each with the `Source` key its display name is
 * filed under. One list: the host-permission check and the privacy policy
 * must be talking about the same five sites, and the way they stopped being
 * the same was two lists.
 */
const SOURCES: ["canvas" | "gradescope" | "prairielearn" | "prairietest" | "smartphysics", string][] = [
  ["canvas", CANVAS_ORIGIN],
  ["gradescope", GRADESCOPE_ORIGIN],
  ["prairielearn", PRAIRIELEARN_ORIGIN],
  ["prairietest", PRAIRIETEST_ORIGIN],
  ["smartphysics", SMARTPHYSICS_ORIGIN],
];

describe("every origin the extension fetches is granted", () => {
  for (const [name, origin] of SOURCES) {
    it(`${name} (${origin})`, () => {
      // Up front, not optional: these five are fetched by the sync loop with no
      // user gesture anywhere near it, so an optional permission could never be
      // requested at the moment it is needed.
      const granted = manifest.host_permissions.some((pattern) => covers(pattern, origin));
      expect(granted, `${origin} is not in host_permissions`).toBe(true);
    });
  }

  it("the adapter registry", () => {
    expect(manifest.host_permissions.some((p) => covers(p, REGISTRY_URL))).toBe(true);
  });

  it("course websites stay optional, because they are not known in advance", () => {
    /*
     * §4.5: an adapter's host is whatever a registry entry says, so it cannot
     * be in the install prompt — it is requested from a click when the student
     * enables that course.
     *
     * AMENDED 2026-09-12 from `https://*.illinois.edu/` + wildcard. §2.3 assumed
     * course sites were illinois.edu subdomains; the CS department's are their
     * own domains (cs124.org, cs128.org, cs225.org), so that entry excluded the
     * highest-enrolment courses at the university. Nothing is granted at
     * install either way — `validateAdapter` requires an adapter's hostPattern
     * to name its own host exactly, so the widened entry cannot be used to ask
     * for more than one site at a time.
     */
    expect(manifest.optional_host_permissions).toEqual(["https://*/*"]);
    expect(manifest.host_permissions).not.toContain("https://*/*");
  });
});

const listing = readFileSync(new URL("../docs/store/listing.md", import.meta.url), "utf8");

/**
 * The rows of listing.md's permission-justification table, and nothing else.
 *
 * The check this replaces asked whether `` `scripting` `` appeared *anywhere*
 * in listing.md. It does — the pre-submit checklist at the bottom of the file
 * mentions it — so renaming the table row it was meant to be guarding left the
 * suite green with the justification gone. A justification is a row in that
 * table or it does not exist, so the anchor is the row.
 */
const justifications: string[][] = (() => {
  const lines = listing.split("\n");
  const start = lines.indexOf("## Permission justifications");
  expect(start, "listing.md has no Permission justifications section").toBeGreaterThanOrEqual(0);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return rest
    .slice(0, end === -1 ? rest.length : end)
    .filter((line) => line.startsWith("|") && !/^\|[\s|-]*\|$/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
})();

/** A row whose first cell names exactly this, in backticks. */
function hasRowFor(label: string): boolean {
  return justifications.some((cells) => cells[0] === `\`${label}\``);
}

/** A row — any cell of one — that names this host. */
function namedInTable(host: string): boolean {
  return justifications.some((cells) => cells.join(" ").includes(host));
}

/** The hostname a `https://host/*` match pattern grants. */
function hostOf(pattern: string): string {
  return pattern
    .replace(/^https:\/\//, "")
    .replace(/\/\*$/, "")
    .replace(/^\*\./, "");
}

describe("the permission list and its justifications", () => {
  for (const permission of [
    "storage",
    "alarms",
    "notifications",
    "offscreen",
    "contextMenus",
    // The Campuswire observer: a content script this extension registers at
    // runtime, because its host is optional and cannot be in the install prompt.
    "scripting",
    // Piazza: its API rejects a request unless the `session_id` cookie's value
    // comes back as a `CSRF-Token` header, and the cookie is HttpOnly — so this
    // is the only API in the browser that can read it.
    "cookies",
  ]) {
    it(`${permission} is justified for review`, () => {
      // Chrome's review asks for one per permission, and an unexplained
      // permission is a rejection. `contextMenus` was added for the
      // report-this-page item and never written down.
      expect(manifest.permissions).toContain(permission);
      expect(hasRowFor(permission), `${permission} has no row in listing.md's table`).toBe(true);
    });
  }

  it("claims no permission it does not justify", () => {
    for (const permission of manifest.permissions) {
      expect(hasRowFor(permission), `${permission} has no row in listing.md's table`).toBe(true);
    }
  });

  it("justifies every host it is granted at install", () => {
    /*
     * `raw.githubusercontent.com` sat in `host_permissions` with no row in the
     * table: a reviewer reading the justifications would have been told about
     * five sites while the prompt beside them asked for six. Derive the list
     * from the manifest rather than from a second copy written by hand.
     */
    for (const pattern of manifest.host_permissions) {
      const host = hostOf(pattern);
      expect(namedInTable(host), `${host} is granted but no row names it`).toBe(true);
    }
  });

  it("justifies every host it asks for at runtime", () => {
    /*
     * `optional_host_permissions` is one `https://*` entry, so the manifest
     * names none of the hosts that will actually be requested. What is
     * requested is what `chrome.permissions.request` is called with in `src/`:
     * today the Campuswire origin, spelled out in `src/ui/options.ts`, and each
     * adapter's own `hostPattern`, which comes from the registry and cannot be
     * spelled out anywhere. The literal one gets a host check; the derived one
     * gets its row.
     */
    const host = new URL(CAMPUSWIRE_ORIGIN).hostname;
    expect(namedInTable(host), `${host} is requested at runtime but no row names it`).toBe(true);
    expect(hasRowFor("optional_host_permissions"), "adapter hosts have no row").toBe(true);
  });
});

/**
 * The store documents against the limits they state about themselves.
 *
 * Each of these is a field with a character cap on the other side of a form,
 * and a document that runs over it is not discovered until someone is pasting
 * at 1am on the night of the submission. A 1455-character block sat in
 * `privacy-practices.txt` under a header promising 1000 until a human counted
 * it. The header states the limit, so the header is what the test reads — a
 * number written twice drifts, and the copy in the test is the one nobody
 * looks at.
 */
describe("the store documents fit the fields they are pasted into", () => {
  const practices = readFileSync(
    new URL("../docs/store/privacy-practices.txt", import.meta.url),
    "utf8",
  );

  // "All are plain text, all under 1000." — the file's own header.
  const limit = Number(/all under (\d+)\b/.exec(practices)?.[1]);
  const blocks = practices.split(/^-+ \[(\d+) of (\d+)\] --$/m);

  it("is a file of numbered blocks, all of them found", () => {
    // Silent empty, one document over: a marker line that stopped matching
    // would leave the loop below with nothing to assert and the suite green.
    expect(limit).toBeGreaterThan(0);
    expect(blocks.length).toBeGreaterThan(1);
    const total = Number(blocks[2]);
    expect((blocks.length - 1) / 3, `[n of ${total}] markers found`).toBe(total);
  });

  for (let i = 1; i < blocks.length; i += 3) {
    const n = blocks[i];
    const of = blocks[i + 1];
    // The block runs to the next marker or to the `====` rule that ends the
    // numbered section; its first two lines are the title and its underline.
    const lines = (blocks[i + 2] ?? "").split(/\n={10,}/)[0]!.split("\n");
    const title = lines[1];
    const body = lines.slice(3).join("\n").trim();

    it(`[${n} of ${of}] ${title} fits ${limit} characters`, () => {
      expect(body.length, `${title} is ${body.length} characters`).toBeLessThanOrEqual(limit);
      expect(body.length, `${title} is empty`).toBeGreaterThan(0);
    });
  }

  it("the store's test instructions fit their field", () => {
    const text = readFileSync(
      new URL("../docs/store/test-instructions.txt", import.meta.url),
      "utf8",
    );
    // "(Access tab, 500-character field)" — the file's own header. The block
    // between the two dashed rules is the text that gets pasted.
    const cap = Number(/(\d+)-character field/.exec(text)?.[1]);
    const parts = text.split(/^-{40,}$/m);
    expect(cap).toBeGreaterThan(0);
    expect(parts.length, "test-instructions.txt has no block between two rules").toBe(3);
    const body = (parts[1] ?? "").trim();
    expect(body.length, `the block is ${body.length} characters`).toBeLessThanOrEqual(cap);
    expect(body.length, "the block is empty").toBeGreaterThan(0);
  });

  it("the description fits the store's cap and is the plain text it claims to be", () => {
    /*
     * listing.md: "The store's Description field is **plain text** — it
     * preserves line breaks and nothing else — so the Markdown that made this
     * document readable would ship as literal asterisks and hyphens in the
     * listing." The cap the store enforces on that field is 16000.
     */
    const description = readFileSync(
      new URL("../docs/store/description.txt", import.meta.url),
      "utf8",
    );
    expect(description.length).toBeLessThanOrEqual(16000);
    expect(description.length).toBeGreaterThan(0);
    // A Markdown link ships as `[text](url)`, with the address hidden from the
    // one reader who might have followed it.
    expect(description, "a Markdown link would ship literally").not.toMatch(
      /\[[^\]\n]*\]\([^)\n]*\)/,
    );
    // A leading `#` ships as a `#`, not as a heading.
    expect(description.split("\n").filter((line) => line.startsWith("#"))).toEqual([]);
  });
});

/**
 * The privacy policy against the manifest.
 *
 * `listing.md` was pinned by the block above and stayed correct. The privacy
 * policy was pinned by nothing, and it is the file that drifted: it named four
 * sites when the manifest held an up-front permission for five, and it did not
 * mention `contextMenus` at all. That is the one store document with a public
 * URL and a legal claim in it, telling students the extension reads less than
 * it reads.
 *
 * Worker rule 2's shape, one document over: what the project *asserts* has to
 * be derived from what it actually does. So the policy is checked against the
 * manifest and the source modules, not against a reviewer's memory.
 */
describe("the privacy policy describes the extension that ships", () => {
  const policy = readFileSync(new URL("../docs/store/privacy-policy.md", import.meta.url), "utf8");

  for (const [name, origin] of SOURCES) {
    it(`names ${name}'s host, because it is read without asking again`, () => {
      expect(policy.includes(new URL(origin).hostname), `${origin} missing from the policy`).toBe(
        true,
      );
    });
  }

  it("names the registry host, the one request that is not to a source", () => {
    // "a public file on GitHub" is not a host a reviewer can check against
    // `host_permissions`; the hostname is.
    expect(policy.includes(new URL(REGISTRY_URL).hostname)).toBe(true);
  });

  it("discloses every permission the manifest claims", () => {
    for (const permission of manifest.permissions) {
      expect(policy.includes(`\`${permission}\``), `${permission} missing from the policy`).toBe(
        true,
      );
    }
  });

  it("counts the sites it grants, rather than a number written once by hand", () => {
    // The sentence that went stale said "the four sites above" while five were
    // granted. Anchor it on the count instead of on the word.
    const words = ["zero", "one", "two", "three", "four", "five", "six", "seven"];
    expect(policy).toContain(`the ${words[SOURCES.length]} sites above`);
  });
});

describe("the Campuswire observer", () => {
  const policy = readFileSync(new URL("../docs/store/privacy-policy.md", import.meta.url), "utf8");

  it("asks for no up-front permission on campuswire.com", () => {
    // Opt-in per site: nothing about Campuswire is in the install prompt, and
    // the origin is requested from the click on the Settings switch.
    expect(manifest.host_permissions.some((p) => covers(p, CAMPUSWIRE_ORIGIN))).toBe(false);
    expect(manifest.host_permissions).not.toContain(`${CAMPUSWIRE_ORIGIN}/*`);
    // Covered by the same wildcard the course-site adapters use, which the
    // block above pins to exactly `https://*/*`. `covers` does not model that
    // pattern, so this asserts the entry rather than the match.
    expect(manifest.optional_host_permissions).toEqual(["https://*/*"]);
  });

  it("ships the script the worker registers by name", () => {
    // `registerContentScripts` names a file in the bundle. If `build.mjs` stops
    // emitting it, the registration fails in the worker's console and the
    // switch goes on looking healthy.
    expect(build.includes('"campuswire-observer": "src/observers/campuswire.ts"')).toBe(true);
  });

  it("is disclosed in the privacy policy, in what it reads and what it does not", () => {
    expect(policy).toContain("campuswire.com");
    expect(policy).toContain("sends nothing to Campuswire");
    // The claim a reviewer will check against `scripting`: it reads a page the
    // student already has open, and only when switched on.
    expect(policy).toContain("off unless you switch it on");
  });
});

describe("the Piazza feed", () => {
  const policy = readFileSync(new URL("../docs/store/privacy-policy.md", import.meta.url), "utf8");

  it("asks for no up-front permission on piazza.com", () => {
    // Opt-in per site, like Campuswire: nothing about Piazza is in the install
    // prompt, and the origin is requested from the click on its switch.
    expect(manifest.host_permissions.some((p) => covers(p, PIAZZA_ORIGIN))).toBe(false);
    expect(manifest.host_permissions).not.toContain(`${PIAZZA_ORIGIN}/*`);
    expect(manifest.optional_host_permissions).toEqual(["https://*/*"]);
  });

  it("justifies the host it asks for at runtime", () => {
    // `optional_host_permissions` is one wildcard, so the manifest names none
    // of the hosts actually requested; this one is spelled out in the source.
    const host = new URL(PIAZZA_ORIGIN).hostname;
    expect(namedInTable(host), `${host} is requested at runtime but no row names it`).toBe(true);
  });

  it("is disclosed in the privacy policy, in what it reads and what it does not", () => {
    expect(policy).toContain("piazza.com");
    expect(policy).toContain("never reads other students' private posts");
    // The claim a reviewer will check against `cookies`: one cookie, one site,
    // never stored.
    expect(policy).toContain("`session_id`");
    expect(policy).toContain("off unless you switch it on");
  });
});

describe("what the store asks for", () => {
  it("ships a 32px icon, which the toolbar is most often drawn at", () => {
    /*
     * The manifest shipped 16 / 48 / 128, so on a 2x display Chrome had to
     * scale 16 up or 48 down for the toolbar — and a two-shape mark at a
     * fractional scale is a smudge. It is the one size a toolbar icon is seen
     * at most, and it was the one size missing.
     */
    for (const set of [manifest.icons, manifest.action.default_icon]) {
      expect(Object.keys(set).sort((a, b) => Number(a) - Number(b))).toEqual([
        "16",
        "32",
        "48",
        "128",
      ]);
    }
  });

  it("declares every icon file the manifest names", () => {
    // A manifest naming a file that is not there is a Chrome load error, and
    // `dist/` is assembled by copying `public/` wholesale.
    for (const file of Object.values(manifest.icons)) {
      expect(existsSync(new URL(`../public/${file}`, import.meta.url)), file).toBe(true);
    }
  });

  it("has somewhere for the listing to point", () => {
    // The store shows this as "Website" on the listing page; without it the
    // field is blank next to an extension that reads your coursework.
    expect(manifest.homepage_url).toMatch(/^https:\/\//);
  });

  it("offers a keyboard shortcut", () => {
    // A popup is otherwise only reachable by aiming at a 16px target, and the
    // whole point of this extension is being quick to check.
    expect(manifest.commands?.["_execute_action"]?.suggested_key?.default).toBeTruthy();
  });

  it("names every source it holds an up-front permission for", () => {
    /*
     * The store listing's own one-liner named smartPhysics; the manifest
     * description did not, so the text under the install button promised less
     * than the permission prompt beside it asked for. Chrome caps this at 132.
     */
    for (const [key] of SOURCES) {
      expect(manifest.description, key).toContain(SOURCE_NAME[key]);
    }
    expect(manifest.description.length).toBeLessThanOrEqual(132);
  });

  it("is not still calling itself a preview", () => {
    // Sushi's decision: 1.0.0 at submission. "0.1.0" beside a store review
    // prompt reads as "do not rely on this yet", which is the opposite of what
    // a deadline tracker needs to say.
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.version.startsWith("0.")).toBe(false);
  });
});

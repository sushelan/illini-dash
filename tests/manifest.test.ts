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

describe("the permission list and its justifications", () => {
  const listing = readFileSync(new URL("../docs/store/listing.md", import.meta.url), "utf8");

  for (const permission of [
    "storage",
    "alarms",
    "notifications",
    "offscreen",
    "contextMenus",
    // The Campuswire observer: a content script this extension registers at
    // runtime, because its host is optional and cannot be in the install prompt.
    "scripting",
  ]) {
    it(`${permission} is justified for review`, () => {
      // Chrome's review asks for one per permission, and an unexplained
      // permission is a rejection. `contextMenus` was added for the
      // report-this-page item and never written down.
      expect(manifest.permissions).toContain(permission);
      expect(listing.includes(`\`${permission}\``), `${permission} missing from listing.md`).toBe(
        true,
      );
    });
  }

  it("claims no permission it does not justify", () => {
    for (const permission of manifest.permissions) {
      expect(listing.includes(`\`${permission}\``), `${permission} missing from listing.md`).toBe(
        true,
      );
    }
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

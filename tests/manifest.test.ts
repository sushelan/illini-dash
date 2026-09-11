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

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CANVAS_ORIGIN } from "../src/sources/canvas.js";
import { GRADESCOPE_ORIGIN } from "../src/sources/gradescope.js";
import { PRAIRIELEARN_ORIGIN } from "../src/sources/prairielearn.js";
import { PRAIRIETEST_ORIGIN } from "../src/sources/prairietest.js";
import { SMARTPHYSICS_ORIGIN } from "../src/sources/smartphysics.js";
import { REGISTRY_URL } from "../src/core/registry.js";

const manifest = JSON.parse(
  readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"),
) as {
  permissions: string[];
  host_permissions: string[];
  optional_host_permissions: string[];
  version: string;
};

/** Chrome's match-pattern semantics, for the shapes this manifest actually uses. */
function covers(pattern: string, origin: string): boolean {
  const url = new URL(origin);
  const match = /^https:\/\/(\*\.)?([^/]+)\/\*$/.exec(pattern);
  if (!match) return false;
  const [, wildcard, host] = match;
  return wildcard ? url.hostname === host || url.hostname.endsWith(`.${host}`) : url.hostname === host;
}

describe("every origin the extension fetches is granted", () => {
  const SOURCES: [string, string][] = [
    ["canvas", CANVAS_ORIGIN],
    ["gradescope", GRADESCOPE_ORIGIN],
    ["prairielearn", PRAIRIELEARN_ORIGIN],
    ["prairietest", PRAIRIETEST_ORIGIN],
    ["smartphysics", SMARTPHYSICS_ORIGIN],
  ];

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
    // §4.5: an adapter's host is whatever a registry entry says, so it cannot
    // be in the install prompt — it is requested from a click when the student
    // enables that course.
    expect(manifest.optional_host_permissions).toContain("https://*.illinois.edu/*");
  });
});

describe("the permission list and its justifications", () => {
  const listing = readFileSync(new URL("../docs/store/listing.md", import.meta.url), "utf8");

  for (const permission of ["storage", "alarms", "notifications", "offscreen", "contextMenus"]) {
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

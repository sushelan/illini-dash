/**
 * Builds a distributable zip for the G4 beta.
 *
 * §9 gates G5 (the store) behind G4 (the beta), so the ten testers install a
 * non-store build by hand. Nothing in the repo produced an artifact or told
 * anyone how to use one, and a tester who cannot install is not one of the ten.
 *
 * The zip is stamped with the manifest version and the build id, because the
 * single most confusing thing about this extension during development has been
 * a page talking to an older service worker — and with testers, "which build are
 * you on" has to be answerable from the filename.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
const out = join(root, "release");

if (!existsSync(join(dist, "manifest.json"))) {
  console.error("No dist/manifest.json — run `npm run build` first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
// esbuild inlines the define as `BUILD_ID = true ? "…" : "dev"`, so the id is
// read from the assignment rather than from the log line that prints it.
const bundle = readFileSync(join(dist, "background.js"), "utf8");
const buildId = /BUILD_ID\s*=\s*[^"]*"(\d{8}T\d{6})"/.exec(bundle)?.[1];
if (!buildId) {
  // A zip whose name cannot say which build it holds is worse than no zip: the
  // whole point of the filename is answering "which build are you on".
  console.error("Could not read BUILD_ID out of dist/background.js — is the build current?");
  process.exit(1);
}
const name = `illini-dash-${manifest.version}-${buildId}.zip`;

// Written into the zip so the guide travels with the artifact. A tester who
// received the file three days ago and cannot find the message it came with
// still has the instructions.
const install = `Illini Dash ${manifest.version} (build ${buildId})

To install:

  1. Open Chrome and type  chrome://extensions  in the address bar.
  2. Turn on "Developer mode" (top right).
  3. Unzip this file, then click "Load unpacked" and choose the unzipped folder.
     Choose the folder itself, not a file inside it.
  4. Click the puzzle-piece icon in the toolbar and pin Illini Dash, so you can
     see the badge without hunting for it.

What happens on install:

  - A tab opens asking which sites your courses use. Answer it, sign in to any
    that ask, and press "Show my calendar".
  - Pin the extension when it asks: without the pin, the badge that counts what
    is due is hidden behind Chrome's puzzle-piece menu.

To check it is working:

  - Click the icon. The top left shows one pill: a green dot and "All 4 OK" when
    every source answered, amber and "Sign in to Gradescope" when one needs you,
    hollow and "Checking..." before the first sync has finished.
  - Click the pill for the per-source list, with a Sign in button on any row
    that needs one.
  - The build id is in Settings, under Developer.

To update when you get a new zip:

  1. Unzip it over the old folder (or into a new one).
  2. Go back to chrome://extensions and click the reload icon on the Illini Dash
     card. This step is easy to forget and matters: without it the pages update
     but the background stays on the old build, and you will see a warning that
     says STALE SERVICE WORKER.
  3. Open Settings (the gear in the popup), open Developer, and check the build
     id there matches the one in this file's name. If they differ, the page and
     the background part are on different builds and a warning says so.

If something looks wrong:

  Open Settings (the gear in the popup), go to Help, and press
  "Copy diagnostics". That puts a summary on your clipboard - which sources
  worked, how many items each course produced, and what failed. It contains no
  assignment titles, no links and nothing that identifies you. Paste it into the
  report.

  If a deadline you can see on a site is missing from the list, right-click that
  page and choose "Report this page to Illini Dash". That opens Settings with
  the page filled in; press "Prepare report" to get a scrubbed copy of it.
  Nothing is ever uploaded on its own.

Illini Dash reads the sites you are already signed into, in your browser, and
stores everything on your own device. It never sees a password and nothing is
uploaded.
`;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(join(dist, "INSTALL.txt"), install);

/**
 * The development pages do not ship.
 *
 * `npm run preview` writes `preview-*.html`, `shot.html` and `components.html`
 * into `dist/`, and `dist/` is what gets zipped — so a build run after a
 * preview was shipping a component gallery and a canned-data copy of the popup
 * inside the extension. Harmless to a tester and not harmless in a store
 * review, where every file in the package is something to explain.
 *
 * Excluded by name rather than by moving the preview output elsewhere, because
 * the preview pages have to sit beside the real `ui.css` and `popup.css` to be
 * worth anything.
 */
const DEV_ONLY = ["preview*", "shot.html", "components.html", "components.js", "probe.html"];

// `zip` ships with macOS and every Linux CI image; no dependency is added for a
// script that runs once per release.
execFileSync(
  "zip",
  ["-r", "-q", join(out, name), ".", "-x", ...DEV_ONLY],
  { cwd: dist },
);

const size = (execFileSync("wc", ["-c", join(out, name)], { encoding: "utf8" }).trim().split(/\s+/)[0] ?? "0");
console.log(`packaged -> release/${name} (${Math.round(Number(size) / 1024)} KB)`);
console.log(`  version ${manifest.version}, build ${buildId}`);
console.log(`  send it with docs/beta-install.md`);

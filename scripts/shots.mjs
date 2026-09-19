/**
 * Every surface, rendered to `docs/ux/after/`, dark first.
 *
 * Written because of one line of feedback: "u didnt rly change anything at
 * all", about a build that had changed a great deal — in a mode nobody had
 * looked at. Sushi's machine is dark, every screenshot taken to verify the
 * change was light, and the one person who had to be convinced was looking at
 * something nobody had seen. So dark is not an option flag here, it is the
 * first half of the default set.
 *
 * No dependency: headless Chrome is already on this machine. Adding Puppeteer
 * to take twenty screenshots would be a runtime dependency for a development
 * chore.
 *
 * **`--force-dark-mode` does not do this**, which the UX plan asserted and a
 * probe disproved. On macOS, headless Chrome follows the system theme for
 * `prefers-color-scheme`, so on Sushi's dark machine every capture came out
 * dark — with or without the flag — and the "light" half of the set was twenty
 * bytes-identical copies of the dark half. That is the same failure this script
 * exists to prevent, one level up: a verification step that cannot tell the two
 * cases apart.
 *
 * `--blink-settings=preferredColorScheme=` is the one that works, and it is
 * stated for *both* modes rather than only for the one being forced. Leaving
 * dark implicit would make the output depend on whose machine ran it.
 *
 *     preferredColorScheme=0  ->  dark    (measured, first pixel #000000)
 *     preferredColorScheme=1  ->  light   (measured, first pixel #ffffff)
 *
 *     npm run shots            # every surface, dark then light
 *     npm run shots -- popup   # only the shots whose name contains "popup"
 *
 * The pages come from `npm run preview`, so they are the real documents with
 * only `chrome.*` stubbed.
 */

import { execFile, spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
// `--design=<name>` renders every shot under that visual-language variant and
// writes to docs/ux/design/<name>/ instead, so the three explorations never
// overwrite the shipped captures.
const designArg = process.argv.find((a) => a.startsWith("--design="))?.slice("--design=".length);
const outDir = designArg
  ? join(root, "docs", "ux", "design", designArg)
  : join(root, "docs", "ux", "after");

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

/**
 * One capture. `size` is the window Chrome measures, which for the popup is the
 * 400×600 the extension actually gets.
 */
const SHOTS = [
  { name: "popup-day", query: "tab=day", size: [400, 600] },
  { name: "popup-week", query: "tab=week", size: [400, 600] },
  { name: "popup-exams", query: "tab=exams", size: [400, 600] },
  /*
   * The two tabs D3 and D6 added, which nothing else can reach.
   *
   * `popup-month` used to be full-view-only, so the 400px month had never been
   * captured at all; `popup-nodate` replaces `popup-attention`, whose tab no
   * longer exists (a stored `"attention"` falls back to `day`, which would have
   * made that shot a second copy of `popup-day` with no way to tell).
   */
  { name: "popup-month", query: "tab=month", size: [400, 600] },
  { name: "popup-nodate", query: "tab=nodate", size: [400, 600] },
  /*
   * The two failure states, which were unreachable in the harness.
   *
   * That is how the pill came to describe both with one sentence: nothing in
   * `npm run shots` could tell "couldn't be read" from "couldn't be reached",
   * so a live sync was the first thing that could, and by then it had been
   * wrong for a week.
   */
  /*
   * The source list — a tab of its own since 2026-09-19, so a plain `tab=`.
   *
   * It was a floating panel and shipped clipped half way down its fifth row,
   * which is why this shot exists at all; it then became the last section of
   * the Alerts tab, ~900px down a 600px window, and is now the Sources tab
   * (Sushi: "the sources page in alerts should be in the sources tab"). The
   * shot follows it rather than going on pressing something — a selector
   * spelled in a harness outliving what it named is UI house rule 4's finding.
   */
  { name: "popup-sources", query: "tab=sources", size: [400, 600] },
  // And the footer strip's own way in, which is the press that used to open
  // the panel. It has to land on the Sources tab, or the button that says
  // "8 sources · synced 2m ago" leads somewhere else.
  { name: "popup-sources-from-footer", query: "tab=day&open=health", size: [400, 600] },
  /*
   * The two sub-screens W3 owns, each behind an interaction the shot has to
   * perform: the deadline screen is a press on the first row (a real pointer
   * sequence — see the epilogue in preview.mjs), the editor a press on the
   * header's +.
   */
  { name: "popup-deadline", query: "tab=day&open=deadline", size: [400, 600] },
  { name: "popup-editor", query: "tab=day&editor=1", size: [400, 600] },
  { name: "popup-unreachable", query: "tab=day&fail=network", size: [400, 600] },
  { name: "popup-unreadable", query: "tab=day&fail=parse", size: [400, 600] },
  { name: "popup-setup", query: "tab=day&setup=1", size: [400, 600] },
  // The screen `onInstalled` actually opens. The pin card lives only here.
  { name: "full-setup", query: "tab=day&setup=1&view=full", size: [1280, 800] },
  { name: "full-month", query: "tab=month&view=full", size: [1280, 800] },
  { name: "full-week", query: "tab=week&view=full", size: [1280, 800] },
  { name: "full-day", query: "tab=day&view=full", size: [1280, 800] },
  /*
   * Tall enough for the whole page, rather than two shots and a fragment.
   *
   * A `#section` in the URL scrolls the page, and headless Chrome then
   * screenshots from the document origin anyway — so the "lower half" capture
   * came out as 1500px of empty navy. One tall window is the thing that works.
   */
  { name: "options", query: "page=options", size: [1280, 4100] },
  { name: "options-stale", query: "page=options&stale=1", size: [1280, 800] },
  // The course-website source signed out. It is the only source with no fixed
  // login form, which is how its row shipped reading "Sign in needed" with
  // nothing beside it — a state no capture could reach until `fail=sitelogin`
  // existed, and therefore one nobody had looked at.
  { name: "options-sitelogin", query: "page=options&fail=sitelogin", size: [1280, 1600] },
  { name: "components", query: "page=components", size: [960, 1700] },
  { name: "full-exams", query: "tab=exams&view=full", size: [1280, 800] },
  { name: "full-nodate", query: "tab=nodate&view=full", size: [1280, 800] },
  { name: "full-sources", query: "tab=sources&view=full", size: [1280, 800] },
  /*
   * Store assets, which are one file each rather than a dark and a light one.
   *
   * `fixed` says which scheme to render them in: a promo tile is printed into a
   * grid on the store's own page and has to look the same for everyone, so
   * shipping two of them and picking one by hand later is how the wrong one
   * gets uploaded.
   */
  { name: "promo-tile", query: "page=promo", size: [440, 280], fixed: "light" },
  { name: "store-toast", query: "page=toast", size: [1280, 800], fixed: "light" },
];

function chromePath() {
  const found = CHROME_CANDIDATES.find((path) => existsSync(path));
  if (!found) {
    console.error(
      "No Chrome or Chromium found. Looked in:\n  " + CHROME_CANDIDATES.join("\n  "),
    );
    process.exit(1);
  }
  return found;
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

/**
 * A static server for `dist/`, because `file://` blocks module scripts.
 *
 * On whatever port the OS hands out, not a fixed one. A fixed port dies with
 * EADDRINUSE exactly when someone already has `npm run preview` open, which is
 * the most likely moment to run this.
 */
function serve() {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(
      /^(\.\.[/\\])+/,
      "",
    );
    const file = join(dist, path === "/" ? "preview-popup.html" : path);
    if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

/**
 * One screenshot.
 *
 * `--virtual-time-budget` is what lets the page's own `send()` round trips and
 * `fit()` measurement finish before the frame is taken; without it the popup
 * captures mid-draw. Chrome sometimes lingers after writing the file, so the
 * process is given a deadline rather than being waited on forever.
 *
 * A profile directory **per capture**, deleted afterwards. Sharing one meant
 * that the SIGKILL below left a lock behind, and the next launch sat waiting on
 * it until its own deadline — which showed up as two or three shots failing per
 * run, never the same ones twice. A flaky harness is worse than a slow one: it
 * teaches you to ignore the word FAILED.
 */
async function capture(chrome, port, { name, query, size, fixed }, dark) {
  const suffix = fixed ? "" : dark ? "-dark" : "-light";
  const file = join(outDir, `${name}${suffix}.png`);
  if (fixed) dark = fixed === "dark";
  const profile = join(root, "node_modules", `.cache-shot-${name}${suffix}`);
  rmSync(profile, { recursive: true, force: true });
  const args = [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    `--user-data-dir=${profile}`,
    "--hide-scrollbars",
    "--virtual-time-budget=3000",
    `--window-size=${size[0]},${size[1]}`,
    `--screenshot=${file}`,
  ];
  args.push(`--blink-settings=preferredColorScheme=${dark ? 0 : 1}`);
  /*
   * `mode=` as well as the blink setting, and both for each end.
   *
   * The blink setting alone was enough while the mode defaulted to "system".
   * `DEFAULT_MODE` became "light" on 2026-09-19, and every `*-dark.png` here
   * quietly became a light capture under a dark name — a verification step that
   * cannot tell the two cases apart, which is the thing this file exists to
   * stop. `shot.html` seeds the key; the blink setting stays so that a "system"
   * profile still resolves the right way.
   */
  args.push(
    `http://127.0.0.1:${port}/shot.html?${query}&mode=${dark ? "dark" : "light"}` +
      `${designArg ? `&design=${designArg}` : ""}`,
  );

  const child = spawn(chrome, args, { stdio: "ignore" });
  const done = new Promise((resolve) => child.on("exit", resolve));
  const deadline = new Promise((resolve) => setTimeout(resolve, 20_000));
  await Promise.race([done, deadline]);
  child.kill("SIGKILL");
  rmSync(profile, { recursive: true, force: true });
  if (!existsSync(file)) {
    console.error(`  FAILED ${name}${suffix}`);
    return false;
  }
  console.log(`  ${name}${suffix}.png`);
  return true;
}

const filter = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const wanted = filter.length
  ? SHOTS.filter((shot) => filter.some((f) => shot.name.includes(f)))
  : SHOTS;

if (!existsSync(join(dist, "shot.html"))) {
  console.error("No dist/shot.html — run `npm run preview` first.");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const chrome = chromePath();
const server = await serve();
const port = server.address().port;
let failures = 0;
// Dark first, always. See the header.
let taken = 0;
for (const dark of [true, false]) {
  // A `fixed` shot is rendered once, on the dark pass, and skipped on the light
  // one — otherwise the second pass overwrites it with the wrong scheme.
  const pass = wanted.filter((shot) => !shot.fixed || dark);
  if (pass.length === 0) continue;
  console.log(dark ? "dark:" : "light:");
  for (const shot of pass) {
    taken += 1;
    if (!(await capture(chrome, port, shot, dark))) failures += 1;
  }
}
server.close();
console.log(`\n${taken - failures} shots -> ${outDir.slice(root.length)}/`);
// Reported, not swallowed: a missing file here means a page threw while
// drawing, and a script that exits 0 having written nothing is the silent
// empty this project ranks worst.
process.exit(failures > 0 ? 1 : 0);

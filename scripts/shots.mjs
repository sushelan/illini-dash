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
const outDir = join(root, "docs", "ux", "after");

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
  { name: "popup-attention", query: "tab=attention", size: [400, 600] },
  { name: "popup-setup", query: "tab=day&setup=1", size: [400, 600] },
  { name: "full-month", query: "tab=month&view=full", size: [1280, 800] },
  { name: "full-week", query: "tab=week&view=full", size: [1280, 800] },
  { name: "full-day", query: "tab=day&view=full", size: [1280, 800] },
  { name: "options", query: "page=options", size: [1280, 1600] },
  { name: "options-stale", query: "page=options&stale=1", size: [1280, 800] },
  { name: "components", query: "page=components", size: [960, 1700] },
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
async function capture(chrome, port, { name, query, size }, dark) {
  const suffix = dark ? "dark" : "light";
  const file = join(outDir, `${name}-${suffix}.png`);
  const profile = join(root, "node_modules", `.cache-shot-${name}-${suffix}`);
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
  args.push(`http://127.0.0.1:${port}/shot.html?${query}`);

  const child = spawn(chrome, args, { stdio: "ignore" });
  const done = new Promise((resolve) => child.on("exit", resolve));
  const deadline = new Promise((resolve) => setTimeout(resolve, 20_000));
  await Promise.race([done, deadline]);
  child.kill("SIGKILL");
  rmSync(profile, { recursive: true, force: true });
  if (!existsSync(file)) {
    console.error(`  FAILED ${name}-${suffix}`);
    return false;
  }
  console.log(`  ${name}-${suffix}.png`);
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
for (const dark of [true, false]) {
  console.log(dark ? "dark:" : "light:");
  for (const shot of wanted) {
    if (!(await capture(chrome, port, shot, dark))) failures += 1;
  }
}
server.close();
console.log(`\n${wanted.length * 2 - failures} shots -> docs/ux/after/`);
// Reported, not swallowed: a missing file here means a page threw while
// drawing, and a script that exits 0 having written nothing is the silent
// empty this project ranks worst.
process.exit(failures > 0 ? 1 : 0);

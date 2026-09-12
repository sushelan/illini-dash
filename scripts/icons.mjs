/**
 * Renders one SVG mark to the PNG sizes Chrome asks for.
 *
 *     npm run icons              # the chosen mark -> public/icon{16,32,48,128}.png
 *     npm run icons -- dash      # render a named candidate instead
 *     npm run icons -- --all     # every candidate, into docs/ux/icons/, for choosing
 *
 * No dependency. Headless Chrome is already on this machine for `npm run
 * shots`, and it rasterises an SVG at any size by screenshotting a page that is
 * exactly that size — which also means the preview is rendered by the same
 * engine that will draw the toolbar.
 *
 * **32 is not optional.** The manifest shipped 16 / 48 / 128, so on a 2× display
 * Chrome had to scale 16 up or 48 down for the toolbar, and a two-shape mark at
 * a fractional scale is a smudge. It is the one size a toolbar icon is most
 * often seen at.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const srcDir = join(root, "public", "icon-src");
const SIZES = [16, 32, 48, 128];

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];
const chrome = CHROME_CANDIDATES.find((path) => existsSync(path));
if (!chrome) {
  console.error("No Chrome or Chromium found; cannot rasterise.");
  process.exit(1);
}

/**
 * One PNG, at one size.
 *
 * The page is the SVG inline at exactly `size` square with no margin, on a
 * transparent background, so the screenshot *is* the icon rather than a crop of
 * a larger canvas.
 */
async function render(svg, out, size) {
  const page = join(root, "node_modules", `.cache-icon-${size}.html`);
  writeFileSync(
    page,
    `<!doctype html><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;background:transparent}
      svg{display:block;width:${size}px;height:${size}px}
    </style>${svg}`,
  );
  const profile = join(root, "node_modules", `.cache-icon-profile-${size}`);
  rmSync(profile, { recursive: true, force: true });
  const child = spawn(
    chrome,
    [
      "--headless=new",
      "--no-first-run",
      "--disable-gpu",
      `--user-data-dir=${profile}`,
      "--hide-scrollbars",
      "--default-background-color=00000000",
      "--force-device-scale-factor=1",
      `--window-size=${size},${size}`,
      `--screenshot=${out}`,
      `file://${page}`,
    ],
    { stdio: "ignore" },
  );
  await Promise.race([
    new Promise((resolve) => child.on("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 15_000)),
  ]);
  child.kill("SIGKILL");
  rmSync(profile, { recursive: true, force: true });
  rmSync(page, { force: true });
  return existsSync(out);
}

const args = process.argv.slice(2);
const all = args.includes("--all");
const named = args.find((a) => !a.startsWith("-"));

const candidates = readdirSync(srcDir)
  .filter((f) => f.endsWith(".svg"))
  .map((f) => ({ name: basename(f, ".svg"), file: join(srcDir, f) }));

if (all) {
  // Into docs, not into the extension: this is the set for choosing between.
  const out = join(root, "docs", "ux", "icons");
  mkdirSync(out, { recursive: true });
  for (const { name, file } of candidates) {
    const svg = readFileSync(file, "utf8");
    for (const size of SIZES) {
      const path = join(out, `${name}-${size}.png`);
      console.log((await render(svg, path, size)) ? `  ${name}-${size}.png` : `  FAILED ${name}-${size}`);
    }
  }
  console.log(`\\n${candidates.length} candidates -> docs/ux/icons/`);
} else {
  const chosen = candidates.find((c) => c.name === (named ?? "dash"));
  if (!chosen) {
    console.error(`No such candidate: ${named}. Have: ${candidates.map((c) => c.name).join(", ")}`);
    process.exit(1);
  }
  const svg = readFileSync(chosen.file, "utf8");
  for (const size of SIZES) {
    const path = join(root, "public", `icon${size}.png`);
    console.log((await render(svg, path, size)) ? `  icon${size}.png` : `  FAILED icon${size}`);
  }
  console.log(`\\n${chosen.name} -> public/icon{${SIZES.join(",")}}.png`);
}

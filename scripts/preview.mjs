/**
 * Renders the real popup against canned data, in an ordinary browser tab.
 *
 * The popup can only otherwise be looked at by loading the extension, opening
 * it, and having the right deadlines that week — so the states that matter most
 * (a late window, a moved deadline, a date that would not parse) are the ones
 * hardest to see. Every row shape lives here instead, and it drives the *real*
 * renderer: `dist/popup.js` unmodified, with `chrome.*` stubbed. A layout that
 * breaks here breaks in the extension.
 *
 * Run `npm run preview`, then open the URL it prints. `dist/` is rebuilt and
 * cleared by `npm run build`, so this regenerates both files each time.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
if (!existsSync(join(dist, "popup.js"))) {
  console.error("No dist/popup.js — run `npm run build` first.");
  process.exit(1);
}

const stubSource = join(root, "scripts", "preview-data.ts");
const stubOut = join(root, "node_modules", ".cache-preview-stub.js");
execFileSync(
  "npx",
  ["esbuild", stubSource, "--bundle", "--format=esm", `--outfile=${stubOut}`, "--log-level=error"],
  { cwd: root },
);

// The stub must define `chrome` before popup.js runs, so they are concatenated
// rather than loaded as two modules — module execution order across separate
// <script type=module> tags is not what you want to bet a harness on.
writeFileSync(
  join(dist, "preview.js"),
  `${readFileSync(stubOut, "utf8")}\n${readFileSync(join(dist, "popup.js"), "utf8")}`,
);

writeFileSync(
  join(dist, "preview.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Illini Dash — popup preview</title>
    <link rel="stylesheet" href="ui.css" />
    <link rel="stylesheet" href="popup.css" />
    <style>
      /* Harness chrome only. Everything inside .frame is the real popup. */
      body { width: auto; max-height: none; background: #ecedf0; margin: 0; padding: 16px; }
      @media (prefers-color-scheme: dark) { body { background: #16171a; } }
      .frame {
        width: 400px; margin: 0 auto; background: var(--bg);
        border: 1px solid rgba(127,127,127,.35); border-radius: 10px; overflow: hidden;
      }
    </style>
  </head>
  <body>
    <div class="frame">
      <header class="bar">
        <div id="dots" class="dots"></div>
        <div class="bar--right">
          <button id="sync" class="link">Sync now</button>
          <a id="full" href="#" class="link">⤢ full view</a>
          <a id="settings" href="#" class="link" title="Settings">⚙</a>
        </div>
      </header>
      <p id="status" class="muted"></p>
      <div id="blocked" class="banner banner-err" hidden></div>
      <div id="stale" class="banner" hidden></div>
      <main id="list"></main>
    </div>
    <script type="module" src="preview.js"></script>
  </body>
</html>
`,
);

console.log("preview built -> dist/preview.html");
console.log("  npx http-server dist -p 8731   (or any static server)");
console.log("  then open http://localhost:8731/preview.html");

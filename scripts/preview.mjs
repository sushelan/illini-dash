/**
 * Renders the real pages against canned data, in an ordinary browser tab.
 *
 * The popup can only otherwise be looked at by loading the extension, opening
 * it, and having the right deadlines that week — so the states that matter most
 * (a late window, a moved deadline, a date that would not parse) are the ones
 * hardest to see. Every row shape lives in `preview-data.ts` instead, and it
 * drives the *real* renderers: `dist/popup.js` and `dist/options.js`
 * unmodified, with `chrome.*` stubbed. A layout that breaks here breaks in the
 * extension.
 *
 * **Every page here is the real document.** A framed harness used to exist —
 * the popup's list inside a fixed-width `<div>` — and it cost three rounds of
 * Sushi's time: it cannot reproduce a `body`-level sizing bug by construction,
 * so two answers about the popup opening at 800px were reasoned from a page
 * that could not have the bug. It also went stale (it mounted `#list`, which
 * the popup stopped using) and threw. CLAUDE.md: when the symptom is about the
 * window, the harness has to be the real document.
 *
 * Run `npm run preview`, then open the URL it prints. `dist/` is rebuilt and
 * cleared by `npm run build`, so this regenerates every file each time.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

/**
 * The build id esbuild compiled into the pages.
 *
 * The stub answers `ping` with it, so the options page's stale-worker warning
 * stays quiet unless `?stale=1` asks for it. Read out of the bundle rather than
 * recomputed, because a second guess at the id would be a second copy of a
 * decision that only `build.mjs` makes.
 */
// From `options.js`: the popup no longer carries a build id at all (it was the
// last line every student read), so the options bundle is the one that has it.
const pageBuild =
  /BUILD_ID = [^;]*?"(\d{8}T\d{6})"/.exec(readFileSync(join(dist, "options.js"), "utf8"))?.[1] ??
  "dev";

const stub = readFileSync(stubOut, "utf8");
const prelude = `globalThis.__PREVIEW_BUILD__ = ${JSON.stringify(pageBuild)};\n`;

// The stub must define `chrome` before the page bundle runs, so they are
// concatenated rather than loaded as two modules — module execution order
// across separate <script type=module> tags is not what you want to bet a
// harness on.
for (const [page, out] of [
  ["popup.js", "preview.js"],
  ["options.js", "preview-options.js"],
]) {
  writeFileSync(join(dist, out), `${prelude}${stub}\n${readFileSync(join(dist, page), "utf8")}`);
}

/**
 * Exact copies of the shipped documents, pointed at the stubbed bundles.
 *
 * Nothing else changes: same `body { width: 400px }`, same stylesheet links,
 * same element ids. This is the only reason the harness can answer a question
 * about how wide Chrome will make the popup.
 */
for (const [source, target, from, to] of [
  ["popup.html", "preview-popup.html", "popup.js", "preview.js"],
  ["options.html", "preview-options.html", "options.js", "preview-options.js"],
]) {
  writeFileSync(
    join(dist, target),
    readFileSync(join(dist, source), "utf8").replace(from, to),
  );
}

/**
 * A one-line page that seeds `localStorage` and then hands over.
 *
 * `npm run shots` drives headless Chrome, which has no way to click a tab or
 * pick a theme before the screenshot. Both of those live in `localStorage`
 * (deliberately — reading them from the store would mean a message to the
 * worker and a flash of the wrong colours on every open), so this writes them
 * and redirects.
 *
 * It forwards every other query parameter, so `?tab=week&setup=1` and
 * `?page=options&stale=1` both work.
 */
writeFileSync(
  join(dist, "shot.html"),
  `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>seeding…</title></head>
  <body>
    <script>
      /*
       * \`tab\`, not \`view\`. The popup already uses \`?view=full\` to mean "this is
       * the tab, not the popup", and \`?view=month&view=full\` is one parameter
       * with two values — \`get\` returns the first, so every full-view shot came
       * out on whichever tab happened to be listed first.
       */
      const q = new URLSearchParams(location.search);
      try {
        if (q.has("tab")) localStorage.setItem("illini-dash.view", q.get("tab"));
        if (q.has("theme")) localStorage.setItem("illini-dash.theme", q.get("theme"));
        if (q.has("hidden")) localStorage.setItem("illini-dash.hiddenCourses", q.get("hidden"));
      } catch {
        /* A profile with site data blocked. The page still renders its default. */
      }
      const page = q.get("page") === "options" ? "preview-options.html" : "preview-popup.html";
      for (const key of ["page", "tab", "theme", "hidden"]) q.delete(key);
      location.replace(page + (q.toString() ? "?" + q.toString() : ""));
    </script>
  </body>
</html>
`,
);

// The framed page, removed. `dist/` is cleared by every build, so this only
// matters when preview runs against a tree that still has one lying around.
rmSync(join(dist, "preview.html"), { force: true });

console.log(`preview built (page build ${pageBuild})`);
console.log("  dist/preview-popup.html      the real popup, 400px — use this for anything about size");
console.log("  dist/preview-options.html    the real Settings page   (?stale=1 for an older worker)");
console.log("  dist/shot.html               seeds view/theme, then redirects — what npm run shots drives");
console.log("");
console.log("  npx http-server dist -p 8731   (or any static server)");
console.log("  then open http://localhost:8731/preview-popup.html");
console.log("  ?view=full for the tab, ?setup=1 for the first-run screen");

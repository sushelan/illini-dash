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
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
if (!existsSync(join(dist, "popup.js"))) {
  console.error("No dist/popup.js — run `npm run build` first.");
  process.exit(1);
}

const stubSource = join(root, "scripts", "preview-data.ts");
const stubOut = join(root, "node_modules", ".cache-preview-stub.js");
/*
 * The real version, defined in rather than typed twice.
 *
 * The stub hard-coded "0.1.0" while the manifest said 1.0.0, so every Settings
 * capture — and `docs/ux/after/options*.png` are candidate store screenshots —
 * showed a version that does not exist. A harness that states a fact about the
 * build has to read it from the build.
 */
const manifestVersion = JSON.parse(
  readFileSync(join(root, "public", "manifest.json"), "utf8"),
).version;
execFileSync(
  "npx",
  [
    "esbuild",
    stubSource,
    "--bundle",
    "--format=esm",
    `--outfile=${stubOut}`,
    "--log-level=error",
    `--define:__MANIFEST_VERSION__=${JSON.stringify(manifestVersion)}`,
  ],
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

/*
 * Wrapped in an IIFE, because the stub and the page bundle share one scope.
 *
 * They are concatenated into a single classic script (see below), so a name
 * declared at the top level of both collides and the *whole page* dies with
 * `Identifier 'instantOf' has already been declared` — before a single element
 * is drawn, with only a console nobody has open to say so. That became
 * reachable the moment the stub started importing `core/manual.ts` to answer
 * `add-manual-item` with the real refusals: the popup already pulls the same
 * module in through `core/sync.ts`.
 *
 * Everything the page needs from the stub it takes off `globalThis` —
 * `chrome`, and `fireStorageChange` — so nothing is lost by giving it a scope
 * of its own, and a harness that dies on load is the one failure a harness may
 * never have.
 */
const stub = `;(() => {\n${readFileSync(stubOut, "utf8")}\n})();`;
// Only the preview bundles receive this clock. Freeze before the stub AND real
// renderers run, so their dates agree; timers still advance for interactions.
const prelude = `globalThis.__PREVIEW_BUILD__ = ${JSON.stringify(pageBuild)};\n` +
  readFileSync(join(root, "scripts", "preview-clock.js"), "utf8");

// The stub must define `chrome` before the page bundle runs, so they are
// concatenated rather than loaded as two modules — module execution order
// across separate <script type=module> tags is not what you want to bet a
// harness on.
/**
 * `?open=health`, `?open=deadline` and `?editor=1`: the states that need a
 * press before they can be looked at.
 *
 * A real file rather than a template literal here. It used to be one, and the
 * `.pill` it pressed for `open=health` outlived the header pill it named by a
 * day — a selector inside a string in a build script is one nothing can read,
 * so every "Sources" capture taken through it was a picture of the calendar,
 * silently. `scripts/preview-open.js` publishes the table on
 * `globalThis.__PREVIEW_OPEN__`, and two tests hold it against the control the
 * popup actually renders and against `ui-acceptance.mjs`'s own presses.
 *
 * Appended after the page bundle rather than built into it: this is harness
 * scaffolding and has no business in the extension.
 */
const epilogue = readFileSync(join(root, "scripts", "preview-open.js"), "utf8");

for (const [page, out, tail] of [
  ["popup.js", "preview.js", epilogue],
  ["options.js", "preview-options.js", ""],
]) {
  writeFileSync(
    join(dist, out),
    `${prelude}${stub}\n${readFileSync(join(dist, page), "utf8")}\n${tail}`,
  );
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
        /*
         * The light/dark end, stated rather than inferred.
         *
         * It used to be left to \`preferredColorScheme\`, because the mode
         * defaulted to "system". \`DEFAULT_MODE\` became "light" on 2026-09-19
         * so the popup opens on the mock's palette — and from that moment every
         * \`*-dark.png\` in docs/ux/after was a light capture with "dark" in its
         * name. That is the exact failure the dark-first rule exists to prevent,
         * so the mode is now seeded like the view and the palette.
         */
        if (q.has("mode")) localStorage.setItem("illini-dash.mode", q.get("mode"));
        if (q.has("design")) localStorage.setItem("illini-dash.design", q.get("design"));
        else localStorage.removeItem("illini-dash.design");
        if (q.has("hidden")) localStorage.setItem("illini-dash.hiddenCourses", q.get("hidden"));
      } catch {
        /* A profile with site data blocked. The page still renders its default. */
      }
      const pages = {
        options: "preview-options.html",
        components: "components.html",
        promo: "promo.html",
        toast: "toast.html",
      };
      const page = pages[q.get("page")] || "preview-popup.html";
      // \`hash\`, not a literal # in the URL: a fragment on *this* page is never
      // sent on, so a shot asking for a section further down the Settings page
      // silently came out at the top.
      const hash = q.get("hash") ? "#" + q.get("hash") : "";
      for (const key of ["page", "tab", "theme", "mode", "hidden", "hash", "design"]) q.delete(key);
      location.replace(page + (q.toString() ? "?" + q.toString() : "") + hash);
    </script>
  </body>
</html>
`,
);

/**
 * The component gallery: every primitive in every state, on one page.
 *
 * Bundled from `scripts/components.ts`, which imports the real
 * `src/ui/icons.ts` — so an icon that is broken here is broken in the
 * extension. A component system nobody can look at is one that drifts, and the
 * eight button styles this replaced existed because there was no page on which
 * they would ever be seen side by side.
 */
execFileSync(
  "npx",
  [
    "esbuild",
    join(root, "scripts", "components.ts"),
    "--bundle",
    "--format=esm",
    `--outfile=${join(dist, "components.js")}`,
    "--log-level=error",
  ],
  { cwd: root },
);
copyFileSync(join(root, "scripts", "components.html"), join(dist, "components.html"));
// The store's promo tile, drawn from the same tokens and the same mark as the
// extension so it cannot drift into being a picture of an older version.
copyFileSync(join(root, "scripts", "promo.html"), join(dist, "promo.html"));
copyFileSync(join(root, "scripts", "toast.html"), join(dist, "toast.html"));

// The framed page, removed. `dist/` is cleared by every build, so this only
// matters when preview runs against a tree that still has one lying around.
rmSync(join(dist, "preview.html"), { force: true });

console.log(`preview built (page build ${pageBuild})`);
console.log("  dist/preview-popup.html      the real popup, 400px — use this for anything about size");
console.log("  dist/preview-options.html    the real Settings page   (?stale=1 for an older worker)");
console.log("  dist/components.html         every primitive in every state, all three themes");
console.log("  dist/shot.html               seeds view/theme, then redirects — what npm run shots drives");
console.log("");
console.log("  npx http-server dist -p 8731   (or any static server)");
console.log("  then open http://localhost:8731/preview-popup.html");
console.log("  ?view=full for the tab, ?setup=1 for the first-run screen, ?editor=1 for the add form");
console.log("  ?open=health presses the footer strip for Needs you, ?open=deadline for the deadline screen");

/**
 * Renders the published site from the documents that are already the source of
 * truth, into `site/`.
 *
 * `docs/store/privacy-policy.md` is what `tests/manifest.test.ts` checks
 * against the manifest. If the published page were written out by hand it would
 * be a second copy of the policy, checked by nothing — which is exactly how the
 * policy itself came to describe four sites while five were granted. So the
 * page is generated, and the only way to change what is published is to change
 * the file the test reads.
 *
 * The markdown subset here is small on purpose. Anything it does not recognise
 * **throws** rather than passing through as literal text: a bullet list
 * rendered as "- storage" on a legal page is the silent-empty failure in its
 * public form.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "site");

/* ---------------------------------------------------------------- inline -- */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escape = (text) => text.replace(/[&<>"]/g, (c) => ESCAPES[c]);

function inline(text) {
  let html = escape(text);
  html = html.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|\s)_([^_]+)_(?=$|[\s.,])/g, "$1<em>$2</em>");
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${href}">${label}</a>`);
  // Autolink, but never inside an href or a <code> span already emitted.
  html = html.replace(/(?<![">])\bhttps:\/\/[^\s<),]+/g, (url) => `<a href="${url}">${url}</a>`);
  if (/\[[^\]]*\]\(/.test(html)) throw new Error(`unrendered link: ${html}`);
  return html;
}

/* ----------------------------------------------------------------- blocks -- */

const UNSUPPORTED = /^\s*(?:[-*+]\s|\d+\.\s|>\s|```|!\[)/;

function renderBlock(block) {
  const lines = block.split("\n");

  const heading = /^(#{1,6})\s+(.*)$/.exec(lines[0]);
  if (heading) {
    if (lines.length > 1) throw new Error(`heading block has trailing lines:\n${block}`);
    const level = heading[1].length;
    return `<h${level}>${inline(heading[2])}</h${level}>`;
  }

  if (lines[0].startsWith("|")) {
    if (!/^\|[\s|:-]+\|$/.test(lines[1] ?? "")) throw new Error(`table without a rule:\n${block}`);
    const cells = (row) =>
      row
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => inline(cell.trim()));
    const head = cells(lines[0]).map((c) => `<th>${c}</th>`).join("");
    const body = lines
      .slice(2)
      .map((row) => `<tr>${cells(row).map((c) => `<td>${c}</td>`).join("")}</tr>`)
      .join("\n");
    return `<table>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
  }

  for (const line of lines) {
    if (UNSUPPORTED.test(line)) throw new Error(`unsupported markdown, extend site.mjs:\n${line}`);
  }
  return `<p>${inline(lines.join(" "))}</p>`;
}

function render(markdown) {
  return markdown
    .trim()
    .split(/\n{2,}/)
    .map((block) => renderBlock(block.trim()))
    .join("\n\n");
}

/* ------------------------------------------------------------------ page -- */

/** Brand values copied from `public/ui.css`; the site ships no stylesheet of the extension's. */
const STYLE = `
:root {
  color-scheme: light dark;
  --bg: #eaf1fb; --surface: #ffffff; --fg: #10264d; --muted: #44576f;
  --line: #b5cce7; --brand: #13294b; --accent: #ad3d02;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #0b1730; --surface: #12213f; --fg: #eaf1fb; --muted: #a8bcd8;
          --line: #24395f; --brand: #eaf1fb; --accent: #ff7a2f; }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 48px 20px 96px; background: var(--bg); color: var(--fg);
  font: 16px/1.65 system-ui, -apple-system, "Segoe UI", sans-serif;
}
main { max-width: 46rem; margin: 0 auto; }
h1 { font-size: 1.9rem; line-height: 1.2; letter-spacing: -.5px; margin: 0 0 .4em; }
h2 { font-size: 1.15rem; margin: 2.2em 0 .6em; padding-top: 1.1em; border-top: 1px solid var(--line); }
p { margin: 0 0 1em; }
a { color: var(--accent); }
code {
  font: .875em ui-monospace, SFMono-Regular, Menlo, monospace;
  background: color-mix(in srgb, var(--line) 45%, transparent);
  padding: .12em .38em; border-radius: 4px;
}
em { color: var(--muted); font-style: normal; font-size: .9rem; }
table { border-collapse: collapse; width: 100%; margin: 0 0 1.4em; display: block; overflow-x: auto; }
th, td { text-align: left; vertical-align: top; padding: .55em .8em; border-bottom: 1px solid var(--line); }
th { font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
tbody tr:last-child td { border-bottom: 0; }
.mark { display: inline-flex; align-items: center; gap: .55rem; margin-bottom: 2.5rem;
        font-weight: 700; letter-spacing: -.3px; color: var(--brand); text-decoration: none; }
.mark i { width: 12px; height: 22px; border-radius: 3px; background: var(--accent); }
footer { margin-top: 3rem; padding-top: 1.2rem; border-top: 1px solid var(--line);
         font-size: .875rem; color: var(--muted); }
`.trim();

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(title)}</title>
<style>
${STYLE}
</style>
</head>
<body>
<main>
<a class="mark" href="./"><i></i>Illini Dash</a>
${body}
<footer>Illini Dash is a student project and is not affiliated with, endorsed by, or connected to the University of Illinois. <a href="https://github.com/sushelan/illini-dash">Source on GitHub</a>.</footer>
</main>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ write -- */

const policy = readFileSync(join(root, "docs/store/privacy-policy.md"), "utf8");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "privacy.html"), page("Privacy Policy — Illini Dash", render(policy)));

const manifest = JSON.parse(readFileSync(join(root, "public/manifest.json"), "utf8"));
writeFileSync(
  join(out, "index.html"),
  page(
    "Illini Dash",
    render(
      `# Illini Dash

${manifest.description}

It runs entirely in your browser, reads only pages your own account can already see, and sends nothing anywhere.

## Links

| | |
|---|---|
| Privacy policy | [What it reads, what it stores, what leaves your browser](./privacy.html) |
| Source, issues, broken-page reports | https://github.com/sushelan/illini-dash |
`,
    ),
  ),
);
writeFileSync(join(out, ".nojekyll"), "");

console.log(`site -> site/index.html, site/privacy.html (policy ${policy.length} bytes)`);

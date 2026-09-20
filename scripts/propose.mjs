/**
 * Run the §4.5 adapter search over a saved page, from the command line.
 *
 *   node scripts/propose.mjs fixtures/sites/cs425-fa2026-assignments.html
 *   node scripts/propose.mjs page.html --url https://…/fa2026/assignments.html
 *
 * The same code the options page runs — `repeatedStructures` then
 * `searchCandidates`, bundled in memory out of the TypeScript so there is
 * exactly one implementation (the pattern `scripts/scrub-file.mjs` uses). A
 * second copy here would be a proposer that agrees with nothing.
 *
 * With `--url` it also prints the registry entry the student's "Use this one"
 * would save, which is what makes this the fastest way to write a new adapter:
 * capture the page, run this, read the rows, paste the entry.
 */

import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith("--"));
if (!input) {
  console.error("usage: node scripts/propose.mjs <file.html> [--url <page url>]");
  process.exit(2);
}
const urlFlag = args.indexOf("--url");
const pageUrl = urlFlag === -1 ? undefined : args[urlFlag + 1];

/**
 * The extension's own version, injected exactly as `build.mjs` and
 * `vitest.config.ts` inject it.
 *
 * Without it `EXTENSION_VERSION` falls back to `0.0.0` and §4.5's version gate
 * refuses every entry that uses a locator added in 1.1.0 — so this script would
 * quietly propose nothing on precisely the pages it exists for.
 */
const manifest = JSON.parse(await readFile(new URL("../public/manifest.json", import.meta.url), "utf8"));

const bundled = await build({
  stdin: {
    contents:
      'export * from "./src/core/detect.js";\n' +
      'export { repeatedStructures } from "./src/core/skeleton.js";\n',
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  write: false,
  logLevel: "silent",
  define: {
    __EXTENSION_VERSION__: JSON.stringify(manifest.version),
    __BUILD_ID__: JSON.stringify("propose"),
  },
});
const source = bundled.outputFiles[0].text;
const {
  adapterFromCandidate,
  candidateNotes,
  candidatesFoundLine,
  locatorDescription,
  noCandidateReason,
  repeatedStructures,
  searchCandidates,
  SITE_TIMEZONE,
  guessCourseCode,
} = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

const html = await readFile(input, "utf8");
const { document } = parseHTML(html);
const reference = new Date().toISOString();

const structures = repeatedStructures(document, SITE_TIMEZONE, reference);
const { candidates, nearest } = searchCandidates(
  document,
  reference,
  SITE_TIMEZONE,
  structures,
);

console.log(`${input}  (${document.querySelectorAll("*").length} elements)`);
console.log(candidatesFoundLine(candidates));

/** Every field of the proposal that is not a count or a sample row. */
const FIELDS = [
  "rows",
  "columns",
  "title",
  "due",
  "link",
  "dueLabel",
  "duePhrase",
  "duePrev",
  "dueSlot",
  "titleSlot",
  "titleBefore",
  "defaultTime",
  "titleFrom",
  "time",
  "splitTitle",
  "filter",
  "dateFormat",
];

for (const [index, candidate] of candidates.entries()) {
  console.log(`\n[${index + 1}] ${locatorDescription(candidate)}`);
  for (const note of candidateNotes(candidate)) console.log(`    ${note}`);
  const fields = FIELDS.filter((field) => candidate[field] !== undefined)
    .map((field) => `${field}=${JSON.stringify(candidate[field])}`)
    .join("  ");
  console.log(`    ${fields}`);
  for (const row of candidate.sample) {
    console.log(`      ${row.due}  ${row.title}${row.read ? `   ← ${row.read}` : ""}`);
  }
  if (pageUrl) {
    const code = guessCourseCode(pageUrl) ?? "COURSE";
    console.log(
      JSON.stringify(adapterFromCandidate(candidate, pageUrl, code, "fa26"), null, 2)
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n"),
    );
  }
}

if (candidates.length === 0) {
  console.log(`\n${noCandidateReason(document, structures, nearest)}`);
  console.log("\nWhat the page repeats:");
  for (const structure of structures.slice(0, 8)) {
    const hooks = structure.locators
      .map((locator) => `${locator.kind}:${locator.spec}=${locator.dated}`)
      .join(" ");
    console.log(
      `  ${structure.selector}  ×${structure.count}  dated ${structure.dated.rows}` +
        (hooks ? `  [${hooks}]` : ""),
    );
  }
}

/**
 * Re-scrub a captured file from the command line, using the same tested
 * scrubber the options page uses (src/core/scrub.ts) rather than a second
 * implementation that could drift from it.
 *
 *   node scripts/scrub-file.mjs <in> <out> --name "Given Family" --netid jdoe42
 *
 * Prints the scrub report and exits non-zero if it produced any warning, so a
 * file that still looks identifying cannot be committed by accident.
 */

import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";

const [input, output, ...rest] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: node scripts/scrub-file.mjs <in> <out> [--name N] [--netid I]");
  process.exit(2);
}

function flag(name) {
  const index = rest.indexOf(`--${name}`);
  return index === -1 ? undefined : rest[index + 1];
}

// Bundle the TypeScript scrubber in memory and import it, so there is exactly
// one implementation of Appendix A in the repo.
const bundled = await build({
  entryPoints: ["src/core/scrub.ts"],
  bundle: true,
  format: "esm",
  write: false,
  logLevel: "silent",
});
const source = bundled.outputFiles[0].text;
const { scrubHtml } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

const { html, report } = scrubHtml(await readFile(input, "utf8"), {
  name: flag("name"),
  netid: flag("netid"),
});

await writeFile(output, html);

console.log(`${input} -> ${output}`);
const counts = Object.entries(report.counts);
if (counts.length === 0) console.log("  replacements: none");
for (const [label, count] of counts) console.log(`  ${label}: ${count}`);
for (const warning of report.warnings) {
  const tag = warning.severity === "blocker" ? "MUST FIX" : "note";
  console.log(`  ${tag}: ${warning.message}`);
}

const blockers = report.warnings.filter((w) => w.severity === "blocker");
if (blockers.length > 0) {
  console.error(`\nRefusing to call this clean: ${blockers.length} unresolved.`);
  process.exit(1);
}

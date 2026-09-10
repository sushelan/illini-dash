import { build, context } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const outdir = "dist";

// Stamped into every bundle so the UI can tell when it is talking to a service
// worker built from older source (Chrome caches the worker until you hit Reload).
const buildId = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);

const options = {
  entryPoints: {
    background: "src/background.ts",
    popup: "src/ui/popup.ts",
    options: "src/ui/options.ts",
    offscreen: "src/offscreen.ts",
  },
  bundle: true,
  format: "esm",
  target: "chrome116",
  outdir,
  sourcemap: watch ? "inline" : false,
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  logLevel: "info",
};

async function copyStatic() {
  await cp("public", outdir, { recursive: true });
  await cp("adapters", `${outdir}/adapters`, { recursive: true });
}

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

if (watch) {
  const ctx = await context({ ...options, plugins: [{
    name: "copy-static",
    setup(b) { b.onEnd(() => copyStatic()); },
  }] });
  await ctx.watch();
  console.log(`watching... (build ${buildId})`);
} else {
  await build(options);
  await copyStatic();
  console.log(`built -> dist/ (build ${buildId})`);
}

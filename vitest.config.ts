import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

/**
 * The same `__EXTENSION_VERSION__` the bundle carries, from the same file.
 *
 * `build.mjs` reads `public/manifest.json` for it; a test run that read a
 * different number would pass §4.5's `minExtensionVersion` gate against a
 * version the extension never ships, which is precisely the mistake the gate
 * exists to catch.
 */
const version = JSON.parse(
  readFileSync(new URL("./public/manifest.json", import.meta.url), "utf8"),
).version as string;

export default defineConfig({
  define: { __EXTENSION_VERSION__: JSON.stringify(version) },
  test: {
    environment: "node",
    // The calendar helpers bucket in the browser's zone and the fixtures are
    // written for campus time; one calendar test defeats itself outside it
    // (R3 L14). Stated here so the suite means the same thing on every machine.
    env: { TZ: "America/Chicago" },
    include: ["tests/**/*.test.ts"],
  },
});

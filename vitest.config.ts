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
    //
    // The locale is the other half of that. The popup formats clocks and dates
    // with the machine's locale (`toLocaleTimeString(undefined, …)`), and the
    // assertions are written for en-US — "9:00 PM", not "21:00" — so under
    // LANG=en_GB 32 tests in five files failed on code that was right
    // (tests-health #2, 2026-09-27). A student in Britain seeing 21:00 is
    // correct; the pin is for the suite only. It has to be here rather than in
    // a setup file: the fork reads it before ICU picks its default locale, and
    // assigning process.env.LC_ALL at runtime does not move Intl's default.
    env: { TZ: "America/Chicago", LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" },
    include: ["tests/**/*.test.ts"],
  },
});

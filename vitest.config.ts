import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // The calendar helpers bucket in the browser's zone and the fixtures are
    // written for campus time; one calendar test defeats itself outside it
    // (R3 L14). Stated here so the suite means the same thing on every machine.
    env: { TZ: "America/Chicago" },
    include: ["tests/**/*.test.ts"],
  },
});

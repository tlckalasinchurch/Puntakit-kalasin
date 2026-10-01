import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      PUNTAKIT_TEST_AUTH: "1",
      NODE_ENV: "test",
      /**
       * The legacy cookie/JWT path (PUNTAKIT_TEST_AUTH=1) signs with this
       * secret. It is declared here — and only here — so the test runtime never
       * depends on a constant committed to the source tree. `server/lib/auth.ts`
       * throws when it is missing rather than falling back to a public value.
       */
      JWT_SECRET: "puntakit-vitest-only-secret-not-used-outside-tests",
      /**
       * Demo mode must never be active during a test run. `vitest.config.ts`
       * cannot rely on NODE_ENV to enforce that: `.env.local` (the documented
       * local dev file, present on developer machines but not in CI) sets
       * NODE_ENV=development and PUNTAKIT_DEMO_MODE=1, and it wins over these
       * values. The authoritative guard therefore lives in
       * `server/middleware/auth.ts` (`isDemoModeEnabled()` requires
       * PUNTAKIT_TEST_AUTH !== "1"); these entries are belt-and-braces so the
       * intent is visible next to the rest of the test contract.
       */
      PUNTAKIT_DEMO_MODE: "",
      VITE_PUNTAKIT_DEMO_MODE: "",
    },
    include: ["server/**/*.test.ts", "shared/**/*.test.ts", "client/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
});


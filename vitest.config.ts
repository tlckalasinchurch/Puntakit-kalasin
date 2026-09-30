import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      PUNTAKIT_TEST_AUTH: "1",
      NODE_ENV: "test",
    },
    include: ["server/**/*.test.ts", "shared/**/*.test.ts", "client/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
});

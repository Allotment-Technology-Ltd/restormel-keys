import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/testing-*/src/**/*.test.ts"],
    passWithNoTests: true,
    environment: "node",
  },
});

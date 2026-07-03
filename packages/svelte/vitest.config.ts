import { defineConfig } from "vitest/config";
import viteConfig from "./vite.config";

/** Merge Vite (Svelte plugin) with explicit Vitest options. Component tests use plain DOM assertions (no jest-dom matchers). */
const base =
  typeof viteConfig === "function"
    ? viteConfig({ command: "serve", mode: "test", isSsrBuild: false })
    : viteConfig;

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{js,ts}"],
    globals: true,
  },
  resolve: {
    ...base.resolve,
    conditions: ["browser"],
  },
});

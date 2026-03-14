import { resolve } from "path";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import dts from "vite-plugin-dts";

export default defineConfig(({ mode }) => ({
  plugins: [
    svelte(),
    dts({
      include: ["src"],
      outDir: "dist",
      staticImport: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
    },
    rollupOptions: {
      external: ["svelte", "@restormel/keys"],
      output: {
        entryFileNames: "[name].js",
        assetFileNames: (assetInfo) =>
          assetInfo.name === "theme.css" ? "theme.css" : "[name][extname]",
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{js,ts}"],
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
  resolve: {
    conditions: mode === "test" ? ["browser"] : [],
  },
}));

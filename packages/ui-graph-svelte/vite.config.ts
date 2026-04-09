import { resolve } from "path";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import dts from "vite-plugin-dts";

export default defineConfig({
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
      external: ["svelte", /^svelte\//, "@restormel/graph-core", /^@restormel\/graph-core\//],
      output: {
        entryFileNames: "[name].js",
        assetFileNames: "[name][extname]",
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
});

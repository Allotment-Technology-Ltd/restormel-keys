import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig(({ mode }) => ({
  plugins: [
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
      output: {
        entryFileNames: "index.js",
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
    conditions: process.env.VITEST ? ["browser", "import"] : [],
  },
}));

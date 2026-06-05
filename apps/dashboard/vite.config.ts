import { sveltekit } from "@sveltejs/kit/vite";
import type { UserConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const analyzeBundle = process.env.ANALYZE === "1";

const config: UserConfig = {
  plugins: [
    sveltekit(),
    ...(analyzeBundle
      ? [
          visualizer({
            filename: path.join(__dirname, ".analyze", "bundle-stats.html"),
            gzipSize: true,
            brotliSize: true,
            open: false,
          }),
        ]
      : []),
  ],
  // Load .env from the dashboard app directory (fixes 503 when dev is run from monorepo root)
  envDir: __dirname,
  optimizeDeps: {
    // Doc pages embed vite.config samples; exclude server-only toolchain from client prebundle.
    exclude: ["vite", "fsevents"],
  },
  server: {
    watch: {
      // Rebuilt workspace `dist/` output retriggers full SSR/HMR and can OOM Node during dev.
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/.svelte-kit/**",
        path.join(repoRoot, "packages/**/dist"),
        path.join(repoRoot, "packages/**/dist/**"),
      ],
    },
  },
};

export default config;

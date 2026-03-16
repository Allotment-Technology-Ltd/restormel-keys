import { sveltekit } from "@sveltejs/kit/vite";
import type { UserConfig } from "vite";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: UserConfig = {
  plugins: [sveltekit()],
  // Load .env from the dashboard app directory (fixes 503 when dev is run from monorepo root)
  envDir: __dirname,
};

export default config;

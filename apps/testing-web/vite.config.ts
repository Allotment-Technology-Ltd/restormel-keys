import { sveltekit } from "@sveltejs/kit/vite";
import type { UserConfig } from "vite";

/** Vite loads `.env` from the app directory when `pnpm dev` runs with cwd `apps/web`. */
const config: UserConfig = {
  plugins: [sveltekit()],
};

export default config;

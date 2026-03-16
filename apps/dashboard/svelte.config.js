import adapter from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: { runes: false },
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    paths: {
      base: "", // Served at /keys/dashboard on restormel.dev (no path prefix in app)
      relative: false,
    },
  },
};

export default config;

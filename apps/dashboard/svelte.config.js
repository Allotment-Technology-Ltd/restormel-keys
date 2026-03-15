import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    paths: {
      base: "/keys/dashboard",
      relative: false, // Emit absolute asset URLs (/keys/dashboard/_app/...) so they work behind the Worker proxy
    },
  },
};

export default config;

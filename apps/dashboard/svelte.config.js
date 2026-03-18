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
    // SvelteKit CSRF protection rejects cross-origin form-encoded POSTs.
    // The OIDC token endpoint (/keys/auth/token) receives exactly these from the portal.
    // Disabling is safe: all sensitive endpoints enforce security via JWT signature
    // or session validation — not relying on SvelteKit's CSRF tokens.
    csrf: { checkOrigin: false },
  },
};

export default config;

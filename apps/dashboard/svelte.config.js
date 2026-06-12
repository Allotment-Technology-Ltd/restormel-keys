import adapter from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: { runes: false },
  preprocess: vitePreprocess(),
  kit: {
    // Pin functions to London: Neon Postgres + Neon Auth live in aws-eu-west-2 and the
    // user base is UK/EU. Without this Vercel defaults to iad1 (US East) and every DB
    // round-trip crosses the Atlantic (~80ms each; measured `x-vercel-id: lhr1::iad1`).
    // Hobby supports one custom function region; route-level `config` exports (e.g. the
    // ingest drain's maxDuration) inherit it because they don't set `regions` themselves.
    adapter: adapter({ regions: ["lhr1"] }),
    paths: {
      base: "", // Served at /keys/dashboard on restormel.dev (no path prefix in app)
      relative: false,
    },
    // SvelteKit CSRF protection rejects cross-origin form-encoded POSTs.
    // The OIDC token endpoint (/keys/auth/token) receives exactly these from the portal.
    // Disabling is safe: all sensitive endpoints enforce security via JWT signature
    // or session validation — not relying on SvelteKit's CSRF tokens.
    // OIDC token endpoint accepts cross-origin form POSTs from the portal (see comment above).
    csrf: { trustedOrigins: ["*"] },
  },
};

export default config;

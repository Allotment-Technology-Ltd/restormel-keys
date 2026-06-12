// Switchable adapter: DEPLOY_TARGET=node → @sveltejs/adapter-node (Coolify/Docker);
// any other value (or unset) → @sveltejs/adapter-vercel (default, keeps Vercel prod/preview
// builds byte-identical during the dual-run window — infra Stage 2.1).
import adapterVercel from "@sveltejs/adapter-vercel";
import adapterNode from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const deployTarget = process.env.DEPLOY_TARGET ?? "vercel";
const isNodeAdapter = deployTarget === "node";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: { runes: false },
  preprocess: vitePreprocess(),
  kit: {
    adapter: isNodeAdapter
      ? adapterNode({ out: "build" })
      : // Pin functions to London: Neon Postgres + Neon Auth live in aws-eu-west-2 and the
        // user base is UK/EU. Without this Vercel defaults to iad1 (US East) and every DB
        // round-trip crosses the Atlantic (~80ms each; measured `x-vercel-id: lhr1::iad1`).
        // Hobby supports one custom function region; route-level `config` exports (e.g. the
        // ingest drain's maxDuration) inherit it because they don't set `regions` themselves.
        adapterVercel({ regions: ["lhr1"] }),
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

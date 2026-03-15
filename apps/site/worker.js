/**
 * Minimal Worker that serves static assets from the Astro build (dist/).
 * Used when deploying via `wrangler deploy` (Workers Git flow).
 */
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};

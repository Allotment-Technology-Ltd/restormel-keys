/**
 * tsx shim for SvelteKit's `$env/dynamic/private` virtual module.
 *
 * Outside the SvelteKit runtime (worker daemon, one-shot scripts), dynamic
 * private env is exactly `process.env` — same semantics as adapter-node.
 * Wired via `paths` in `apps/dashboard/scripts/tsconfig.json`.
 */
export const env: Record<string, string | undefined> = process.env;

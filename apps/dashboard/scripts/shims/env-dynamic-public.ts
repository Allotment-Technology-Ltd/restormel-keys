/**
 * tsx shim for SvelteKit's `$env/dynamic/public` virtual module.
 *
 * At runtime SvelteKit filters to `PUBLIC_`-prefixed vars; scripts read the
 * same names from `process.env`, so passing it through is equivalent here.
 */
export const env: Record<string, string | undefined> = process.env;

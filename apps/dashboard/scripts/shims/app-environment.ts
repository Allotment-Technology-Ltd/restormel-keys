/**
 * tsx shim for SvelteKit's `$app/environment` virtual module.
 * Scripts always run server-side outside a Vite build.
 */
export const browser = false;
export const building = false;
export const dev = process.env.NODE_ENV !== "production";
export const version = process.env.RESTORMEL_DASHBOARD_VERSION ?? "scripts";

/**
 * Env loading for dashboard Node scripts (seed, workers, etc.).
 *
 * Order (later wins): repo root `.env` → `apps/dashboard/.env` → `apps/dashboard/.env.local`
 *
 * Matches local behaviour with Vite (`envDir: apps/dashboard`): `.env.local` overrides `.env`, so you can
 * keep production `DATABASE_URL` in `.env` and development / preview DB in `.env.local` for `pnpm dev`
 * and local `pnpm run seed:*`.
 *
 * Vercel does not ship `.env.local`; production uses the project environment variables only.
 *
 * IMPORTANT: an *explicitly-exported* environment variable always wins over the `.env` files.
 * The `.env`/`.env.local` loads use `override: true` so they layer correctly amongst themselves
 * (`.env.local` > `.env`), but that would otherwise also clobber a value the caller set on purpose
 * — e.g. `DATABASE_URL=postgres://… pnpm run migrate`. To prevent that class of mis-targeting (a
 * command aimed at one DB being silently redirected to `.env.local`'s DB), we snapshot the process
 * env first and restore those preset values after loading the files.
 */
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardDir = resolve(__dirname, "..");
export const repoRootEnvPath = resolve(dashboardDir, "..", "..", ".env");
export const dashboardEnvPath = resolve(dashboardDir, ".env");
export const dashboardLocalEnvPath = resolve(dashboardDir, ".env.local");

// Vars explicitly present in the process environment before we load any .env file.
const explicitlyPreset = { ...process.env };

loadEnv({ path: repoRootEnvPath });
loadEnv({ path: dashboardEnvPath, override: true });
loadEnv({ path: dashboardLocalEnvPath, override: true });

// An explicitly-exported value must win over the .env files (12-factor): restore the snapshot.
for (const [key, value] of Object.entries(explicitlyPreset)) {
  process.env[key] = value;
}

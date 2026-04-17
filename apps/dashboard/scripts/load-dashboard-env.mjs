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
 */
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardDir = resolve(__dirname, "..");
export const repoRootEnvPath = resolve(dashboardDir, "..", "..", ".env");
export const dashboardEnvPath = resolve(dashboardDir, ".env");
export const dashboardLocalEnvPath = resolve(dashboardDir, ".env.local");

loadEnv({ path: repoRootEnvPath });
loadEnv({ path: dashboardEnvPath, override: true });
loadEnv({ path: dashboardLocalEnvPath, override: true });

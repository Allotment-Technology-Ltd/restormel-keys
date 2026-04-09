import { NeonRunsStore } from "./neon-runs-store.js";
import { InMemoryRunsStore, type RunsStore } from "./runs-store.js";

/**
 * Prefer **`RESTORMEL_RUNS_DATABASE_URL`** so the sidecar does not accidentally share semantics
 * with app `DATABASE_URL` unless you intend to use the same Neon project/branch.
 */
export function runsDatabaseUrlFromEnv(): string | undefined {
  const dedicated = process.env.RESTORMEL_RUNS_DATABASE_URL?.trim();
  if (dedicated) return dedicated;
  return process.env.DATABASE_URL?.trim() || undefined;
}

/**
 * Neon Postgres when a URL is set (applies migration **027** first); otherwise in-memory (dev / tests).
 */
export async function createRunsStoreFromEnv(): Promise<RunsStore> {
  const url = runsDatabaseUrlFromEnv();
  if (!url) {
    return new InMemoryRunsStore();
  }
  const store = new NeonRunsStore(url);
  try {
    await store.ping!();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Neon connection failed for Runs API (${msg}). Apply apps/dashboard/migrations/027_restormel_testing_run_jobs.sql (or packages/testing-runs-server/schema/027_*.sql) on this branch.`,
    );
  }
  return store;
}

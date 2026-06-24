/**
 * Postgres advisory lock for the deploy-time migration runner (multi-replica HA gate).
 *
 * WHY THIS EXISTS
 * ---------------
 * The dashboard container entrypoint (docker-entrypoint.sh) runs pending DB migrations on
 * EVERY container start, before the SvelteKit server boots. With a single replica this is
 * safe (one runner at a time). Once the dashboard is scaled to >1 replica, a
 * migration-carrying deploy starts two pods concurrently and BOTH would run the runner:
 * each migration is atomic and the schema_migrations insert is ON CONFLICT DO NOTHING, but
 * two replicas can still race the same pending DDL — e.g. two `CREATE TABLE` (without IF NOT
 * EXISTS) → one transaction fails on a duplicate object → that replica exits non-zero
 * (fail-closed) → the rollout crash-loops. This is the only blocker to dashboard HA.
 *
 * THE FIX
 * -------
 * Gate the whole run behind a Postgres advisory lock so exactly ONE replica runs migrations
 * at a time; the other(s) BLOCK on the lock, then proceed and find every migration already
 * applied → a clean no-op. Real migration errors are NEVER swallowed — the lock wrapper only
 * serialises the run; any error from runMigrations propagates unchanged (fail-closed intact),
 * and the lock is always released in a `finally`.
 *
 * SESSION LOCK (not pg_advisory_xact_lock) — deliberate
 * -----------------------------------------------------
 * A transaction-scoped lock (`pg_advisory_xact_lock`) is released at COMMIT of the
 * transaction that took it. The runner intentionally commits each migration in its OWN
 * transaction (so an independent CREATE INDEX CONCURRENTLY-style migration can run, and a
 * later failure does not roll back already-applied migrations). There is no single outer
 * transaction wrapping the run, so an xact lock could not span the whole run. We therefore
 * take a SESSION-level `pg_advisory_lock` on ONE dedicated connection, hold it across the
 * entire run, and explicitly `pg_advisory_unlock` it in `finally` (and also drop the
 * connection, which releases any session locks as a backstop).
 *
 * SAME CONNECTION / SAME DB AS THE MIGRATOR
 * -----------------------------------------
 * The lock is acquired from the SAME pg Pool the migrator's getDb() uses (keyed by the same
 * DATABASE_URL), so it is the same database/cluster — a sibling replica racing the migration
 * contends on the same lock key. We check out a dedicated client from that pool for the lock's
 * lifetime (a session lock must live on one connection, not be spread across pooled queries).
 *
 * NEON-HTTP PATH
 * --------------
 * The neon-http driver (Neon / ws:// URLs — the CI + legacy path) is STATELESS HTTP: it
 * cannot hold a session across calls, so a session advisory lock is not expressible on it.
 * The >1-replica HA target is in-cluster CNPG Postgres (the pg path), never Neon, so we skip
 * the lock on neon-http and run unguarded — byte-for-byte the prior behaviour. Prod HA is
 * fully covered because prod is pg.
 */

import { getPool, shouldUseNeonHttp } from "./db-adapter";

/**
 * Stable 32-bit lock-key pair for the dashboard migration runner.
 *
 * `pg_advisory_lock(int4, int4)` takes a (classid, objid) pair — we use a fixed, namespaced
 * pair so this lock can NEVER collide with any application-level advisory lock. The classid
 * `0x52444d4` would overflow int4; instead we use small, documented constants reserved for
 * this purpose. `RK` (Restormel Keys) → classid 0x524B = 21067; objid 1 = "dashboard
 * migrations". These are arbitrary-but-fixed; the only requirement is that every replica of
 * the dashboard migration runner uses the SAME pair (they do — this constant is the single
 * source of truth) and that nothing else in the schema uses the same pair.
 */
export const MIGRATION_LOCK_CLASS_ID = 21067; // 0x524B "RK"
export const MIGRATION_LOCK_OBJ_ID = 1; // dashboard migrations

/** Minimal structural subset of a pg client we rely on (injectable for tests). */
export interface LockClientLike {
  query(text: string, params?: unknown[]): Promise<unknown>;
  release(): void;
}

/** Minimal structural subset of a pg Pool we rely on (injectable for tests). */
export interface LockPoolLike {
  connect(): Promise<LockClientLike>;
}

/**
 * Run `fn` while holding the dashboard-migration advisory lock against the database at `url`.
 *
 * - pg path: checks out a dedicated client, takes a SESSION `pg_advisory_lock`, runs `fn`,
 *   then ALWAYS `pg_advisory_unlock`s and releases the client (in `finally`). A second replica
 *   blocks on `pg_advisory_lock` until the first releases.
 * - neon-http path: no session to lock — runs `fn` directly (see module header).
 *
 * `fn`'s result is returned unchanged; any error it throws propagates unchanged (fail-closed).
 *
 * @param url   DATABASE_URL — the SAME url the migrator's getDb() uses.
 * @param fn    the work to run under the lock (the migration run).
 * @param deps  injectable hooks (test seam): getPool / shouldUseNeonHttp / logger.
 */
export async function withMigrationLock<T>(
  url: string,
  fn: () => Promise<T>,
  deps: {
    getPool?: (u: string) => LockPoolLike;
    shouldUseNeonHttp?: (u: string) => boolean;
    log?: (msg: string) => void;
  } = {},
): Promise<T> {
  const useNeon = (deps.shouldUseNeonHttp ?? shouldUseNeonHttp)(url);
  const log = deps.log ?? console.log;

  if (useNeon) {
    // Stateless HTTP driver — a session advisory lock is not expressible and the >1-replica
    // HA target is never Neon. Run unguarded (prior behaviour). Prod (pg/CNPG) is covered.
    log(
      "[migration-lock] neon-http driver — advisory lock not applicable (single-replica/CI path); running migrations unguarded.",
    );
    return fn();
  }

  const pool = (deps.getPool ?? (getPool as unknown as (u: string) => LockPoolLike))(url);
  const client = await pool.connect();
  let locked = false;
  try {
    // BLOCKS until the lock is free. A sibling replica mid-migration holds it; we wait, then
    // proceed (and find every migration already applied → no-op). Session-scoped: held until
    // we explicitly unlock or the connection closes.
    log("[migration-lock] acquiring advisory lock (waits if another replica is migrating)...");
    await client.query("SELECT pg_advisory_lock($1, $2)", [
      MIGRATION_LOCK_CLASS_ID,
      MIGRATION_LOCK_OBJ_ID,
    ]);
    locked = true;
    log("[migration-lock] lock acquired — this replica owns the migration run.");
    // Run the migration work. Any error propagates UNCHANGED — fail-closed contract intact.
    return await fn();
  } finally {
    if (locked) {
      try {
        await client.query("SELECT pg_advisory_unlock($1, $2)", [
          MIGRATION_LOCK_CLASS_ID,
          MIGRATION_LOCK_OBJ_ID,
        ]);
        log("[migration-lock] lock released.");
      } catch {
        // Unlock failed (e.g. connection already dropped) — releasing the client below ends
        // the session and frees any held session locks regardless. Do not mask the original
        // outcome of fn() with an unlock error.
      }
    }
    // Releasing returns the client to the pool; if the connection is broken pg discards it.
    // Either way the session (and thus any session-level advisory lock) is no longer ours.
    client.release();
  }
}

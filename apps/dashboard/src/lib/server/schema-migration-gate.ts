/**
 * Schema-migration drift gate (Stage 1.7 follow-up — production login regression fix).
 *
 * Verifies that the `schema_migrations` high-water mark is at or beyond the
 * migration the running code requires. Two consumption modes:
 *
 * - `assert()` — STRICT: throws naming the missing migration. For boot/health
 *   checks and write paths where serving against a stale schema is unsafe.
 * - `warnIfBehind()` — FAIL-OPEN: never throws. Emits a loud structured log
 *   line (throttled) and lets the request proceed. For read/session paths:
 *   a missing bookkeeping row must never present to a signed-in user as
 *   "you are not logged in". If the schema is genuinely stale, the underlying
 *   query fails with its own specific error, which callers already handle.
 *
 * Caching rules (the original implementation cached a REJECTED promise for the
 * process lifetime, so one transient DB error or a late-arriving migration row
 * poisoned every subsequent request until redeploy):
 * - Success is cached forever (schema only moves forward).
 * - Failure is NEVER cached as a promise; re-checks are throttled by
 *   `recheckIntervalMs` so the DB is not hammered on every request.
 * - Concurrent callers share one in-flight check.
 */

export type SchemaGateSql = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown[]>;

export type SchemaMigrationGateOptions = {
  /** Highest migration filename the running code requires (e.g. "062_foo.sql"). */
  requiredMigration: string;
  /** Returns a neon-compatible tagged sql function. Resolved lazily per check. */
  getSql: () => SchemaGateSql;
  /** Minimum ms between re-checks after a failure (default 30s). */
  recheckIntervalMs?: number;
  /** Structured log sink (default console.error). */
  log?: (line: string) => void;
  /** Clock (injectable for tests). */
  now?: () => number;
};

export type SchemaMigrationGate = {
  /** Strict check — throws naming the missing migration. Success is cached. */
  assert(): Promise<void>;
  /** Fail-open check — never throws; logs structured drift errors (throttled). */
  warnIfBehind(): Promise<void>;
  /** Reset cached state (tests only). */
  reset(): void;
};

export function createSchemaMigrationGate(
  options: SchemaMigrationGateOptions,
): SchemaMigrationGate {
  const recheckIntervalMs = options.recheckIntervalMs ?? 30_000;
  const log = options.log ?? ((line: string) => console.error(line));
  const now = options.now ?? Date.now;

  let verifiedOk = false;
  let inFlight: Promise<void> | null = null;
  let lastFailureAtMs: number | null = null;

  async function check(): Promise<void> {
    const sql = options.getSql();
    let rows: { filename: string }[];
    try {
      rows = (await sql`
        SELECT filename FROM schema_migrations
        ORDER BY filename DESC
        LIMIT 1
      `) as { filename: string }[];
    } catch {
      throw new Error(
        `[deploy-time-migrations] schema_migrations table does not exist. ` +
          `Run the migration runner (pnpm --filter dashboard run migrate) before starting production. ` +
          `Required: ${options.requiredMigration}`,
      );
    }
    const hwm = rows[0]?.filename ?? "";
    if (hwm < options.requiredMigration) {
      throw new Error(
        `[deploy-time-migrations] Schema is behind. ` +
          `High-water mark: "${hwm || "(none)"}". ` +
          `Required: "${options.requiredMigration}". ` +
          `Run: pnpm --filter dashboard run migrate`,
      );
    }
  }

  /** Run one shared check; cache success, never cache failure. */
  async function runShared(): Promise<void> {
    if (verifiedOk) return;
    if (!inFlight) {
      inFlight = check()
        .then(() => {
          verifiedOk = true;
          lastFailureAtMs = null;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  }

  return {
    async assert(): Promise<void> {
      await runShared();
    },

    async warnIfBehind(): Promise<void> {
      if (verifiedOk) return;
      // Throttle: after a failure, skip re-checking (and re-logging) until the
      // interval elapses. Requests proceed fail-open in the meantime.
      if (lastFailureAtMs !== null && now() - lastFailureAtMs < recheckIntervalMs) {
        return;
      }
      try {
        await runShared();
      } catch (e) {
        lastFailureAtMs = now();
        const message = e instanceof Error ? e.message : String(e);
        log(
          JSON.stringify({
            event: "schema_migration_gate",
            level: "error",
            action: "fail_open",
            requiredMigration: options.requiredMigration,
            message: message.slice(0, 500),
            hint:
              "Schema high-water mark is behind or schema_migrations is missing. " +
              "Read path continuing fail-open. Apply migrations: " +
              "gh workflow run ci.yml --ref main -f run_db_migrations=true",
          }),
        );
      }
    },

    reset(): void {
      verifiedOk = false;
      inFlight = null;
      lastFailureAtMs = null;
    },
  };
}

/**
 * Idempotent dashboard migration runner logic (Stage 1.7 — deploy-time migrations).
 *
 * Pure logic module: no file I/O, no process.exit, no env loading — all injectable.
 * Called by apps/dashboard/scripts/apply-migrations.mts (CLI) and tested in
 * apply-migrations.test.ts (unit tests with mock sql).
 *
 * Design notes:
 * - Tolerates gaps and non-contiguous numbering: files are sorted by the numeric
 *   prefix extracted from the filename, then lexicographically as a tiebreaker.
 *   Two concurrently-merged migrations (e.g. 059 / 060 by different agents) will
 *   both be applied in the correct order with no renaming required.
 * - Each migration is wrapped in a transaction: the SQL file content + the
 *   schema_migrations insert are committed atomically via sql.transaction(), so
 *   a crash between apply and record cannot leave a partial state.
 * - The schema_migrations insert uses ON CONFLICT DO NOTHING — idempotent even
 *   if a migration was applied outside this runner.
 * - loadApplied() gracefully handles the schema_migrations table not yet existing
 *   (returns empty set); the table is created by 059_schema_migrations_tracking.sql.
 */

// ---------------------------------------------------------------------------
// Types (minimal neon-compatible interface for testability)
// ---------------------------------------------------------------------------

export interface SqlFn {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
  query(text: string, params?: unknown[]): Promise<unknown[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transaction: (fn: (txn: any) => unknown[]) => Promise<unknown[]>;
}

export interface RunnerResult {
  applied: string[];
  skipped: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the leading numeric prefix from a migration filename (e.g. 59 from "059_foo.sql"). */
export function numericPrefix(filename: string): number {
  const m = filename.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Sort migration filenames: numeric prefix first, then lexicographic tiebreak. */
export function sortMigrationFiles(files: string[]): string[] {
  return [...files].sort((a, b) => {
    const diff = numericPrefix(a) - numericPrefix(b);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/** Load the set of already-applied filenames from schema_migrations. */
export async function loadApplied(sql: SqlFn): Promise<Set<string>> {
  try {
    const rows = (await sql`SELECT filename FROM schema_migrations`) as { filename: string }[];
    return new Set(rows.map((r) => r.filename));
  } catch {
    // Table doesn't exist yet — created by 059_schema_migrations_tracking.sql.
    return new Set();
  }
}

/**
 * Apply pending migrations.
 *
 * @param sql       - neon sql function (real or mock in tests)
 * @param listFiles - return all filenames in the migrations dir (injectable for tests)
 * @param readFile  - return the SQL content for a given filename (injectable for tests)
 * @param log       - optional logging function (defaults to console.log)
 */
export async function runMigrations(
  sql: SqlFn,
  listFiles: () => string[],
  readFile: (name: string) => string,
  log: (msg: string) => void = console.log,
): Promise<RunnerResult> {
  const sqlFiles = sortMigrationFiles(listFiles().filter((f) => f.endsWith(".sql")));

  if (sqlFiles.length === 0) {
    throw new Error("No .sql files found in migrations directory");
  }

  const applied = await loadApplied(sql);
  const result: RunnerResult = { applied: [], skipped: [] };

  for (const filename of sqlFiles) {
    if (applied.has(filename)) {
      result.skipped.push(filename);
      continue;
    }

    const content = readFile(filename);
    log(`  --> applying ${filename}`);

    // Execute the migration and record it atomically in a single transaction.
    // sql.transaction() sends all queries over one HTTP request; each query is
    // passed as a prepared statement, so we use txn.query(raw, []) for the
    // migration content (raw SQL) and a parameterised query for the insert.
    try {
      await sql.transaction((txn) => [
        txn.query(content, []),
        txn.query(
          "INSERT INTO schema_migrations (filename, applied_at) VALUES ($1, NOW()) ON CONFLICT (filename) DO NOTHING",
          [filename],
        ),
      ]);
    } catch (err) {
      throw new Error(
        `Migration ${filename} failed. Cause: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    result.applied.push(filename);
  }

  return result;
}

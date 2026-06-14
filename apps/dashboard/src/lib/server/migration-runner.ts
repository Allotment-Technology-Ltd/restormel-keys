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

/**
 * Split a migration file into individual statements. The Neon HTTP driver rejects
 * multi-command prepared statements ("cannot insert multiple commands into a prepared
 * statement"), so each statement must be sent separately (still within one transaction).
 * Aware of: line comments (--), block comments, single-quoted strings, and
 * dollar-quoted blocks ($tag$ ... $tag$ — used by DO blocks/functions, e.g. migration 050).
 */
export function splitSqlStatements(content: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  const n = content.length;
  while (i < n) {
    const ch = content[i];
    const next = content[i + 1];
    // Line comment
    if (ch === "-" && next === "-") {
      const nl = content.indexOf("\n", i);
      const end = nl === -1 ? n : nl + 1;
      current += content.slice(i, end);
      i = end;
      continue;
    }
    // Block comment
    if (ch === "/" && next === "*") {
      const close = content.indexOf("*/", i + 2);
      const end = close === -1 ? n : close + 2;
      current += content.slice(i, end);
      i = end;
      continue;
    }
    // Single-quoted string ('' escapes)
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (content[j] === "'" && content[j + 1] === "'") j += 2;
        else if (content[j] === "'") { j += 1; break; }
        else j += 1;
      }
      current += content.slice(i, j);
      i = j;
      continue;
    }
    // Dollar-quoted block ($tag$ ... $tag$)
    if (ch === "$") {
      const m = content.slice(i).match(/^\$[A-Za-z_]*\$/);
      if (m) {
        const tag = m[0];
        const close = content.indexOf(tag, i + tag.length);
        const end = close === -1 ? n : close + tag.length;
        current += content.slice(i, end);
        i = end;
        continue;
      }
    }
    if (ch === ";") {
      statements.push(current);
      current = "";
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  statements.push(current);
  // Drop statements that are empty or comments-only.
  return statements
    .map((s) => s.trim())
    .filter((s) => {
      const noLineComments = s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim();
      return noLineComments.length > 0;
    });
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Ensure the tracking table exists BEFORE applying any migration. Each migration's record
 * step INSERTs into schema_migrations, but 059_schema_migrations_tracking.sql doesn't create
 * it until 58 files in — so a FROM-SCRATCH run (fresh local / self-hosted DB) fails on 001
 * without this. Idempotent: a no-op on existing DBs, and makes 059's own CREATE a no-op too.
 * Schema mirrors 059 exactly.
 */
export async function ensureTrackingTable(sql: SqlFn): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT        PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

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

  // Bootstrap the tracking table up-front so a from-scratch run works (the per-migration
  // INSERT needs it, but 059 creates it too late). No-op on existing DBs.
  await ensureTrackingTable(sql);

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
    // sql.transaction() sends all queries over one HTTP request, each as its own
    // prepared statement — Neon rejects multi-command prepared statements, so the
    // file is split into individual statements first (comment/dollar-quote aware).
    const statements = splitSqlStatements(content);
    try {
      await sql.transaction((txn) => [
        ...statements.map((stmt) => txn.query(stmt, [])),
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

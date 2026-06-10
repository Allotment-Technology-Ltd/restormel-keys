/**
 * Unit tests for the migration-runner.ts module (Stage 1.7).
 *
 * Exercises ordering, idempotency, gap-tolerance, and error propagation using
 * a fully-mocked sql function — no database connection required.
 */
import { describe, it, expect } from "vitest";
import {
  numericPrefix,
  sortMigrationFiles,
  loadApplied,
  runMigrations,
  type SqlFn,
} from "$lib/server/migration-runner";

// ---------------------------------------------------------------------------
// Mock sql builder
// ---------------------------------------------------------------------------

function makeMockSql(appliedRows: string[] = []): {
  sql: SqlFn;
  transactionCalls: Array<{ content: string; filename: string }>;
} {
  const transactionCalls: Array<{ content: string; filename: string }> = [];

  const tagged = (async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<unknown[]> => {
    // Tagged template call — SELECT filename FROM schema_migrations
    void strings;
    void values;
    return appliedRows.map((filename) => ({ filename }));
  }) as SqlFn;

  tagged.query = async (_text: string, _params?: unknown[]): Promise<unknown[]> => [];

  tagged.transaction = async (fn: (txn: unknown) => unknown[]): Promise<unknown[]> => {
    let recordedContent = "";
    let recordedFilename = "";
    const txn = {
      query: (text: string, params: unknown[] = []) => {
        if (text.includes("schema_migrations")) {
          recordedFilename = String(params[0] ?? "");
        } else {
          recordedContent = text;
        }
        return {};
      },
    };
    fn(txn);
    transactionCalls.push({ content: recordedContent, filename: recordedFilename });
    return [];
  };

  return { sql: tagged, transactionCalls };
}

// ---------------------------------------------------------------------------
// numericPrefix
// ---------------------------------------------------------------------------

describe("numericPrefix", () => {
  it("extracts the leading number", () => {
    expect(numericPrefix("059_schema_migrations_tracking.sql")).toBe(59);
    expect(numericPrefix("001_initial.sql")).toBe(1);
    expect(numericPrefix("100_foo.sql")).toBe(100);
  });

  it("returns 0 for filenames with no leading number", () => {
    expect(numericPrefix("no_prefix.sql")).toBe(0);
    expect(numericPrefix("")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// sortMigrationFiles
// ---------------------------------------------------------------------------

describe("sortMigrationFiles", () => {
  it("sorts by numeric prefix in ascending order", () => {
    const files = ["060_foo.sql", "001_initial.sql", "012_bar.sql", "100_baz.sql"];
    expect(sortMigrationFiles(files)).toEqual([
      "001_initial.sql",
      "012_bar.sql",
      "060_foo.sql",
      "100_baz.sql",
    ]);
  });

  it("handles gaps (non-contiguous numbers)", () => {
    const files = ["050_x.sql", "001_y.sql", "099_z.sql"];
    expect(sortMigrationFiles(files)).toEqual(["001_y.sql", "050_x.sql", "099_z.sql"]);
  });

  it("uses lexicographic tiebreak for equal numeric prefix", () => {
    const files = ["059_b.sql", "059_a.sql"];
    expect(sortMigrationFiles(files)).toEqual(["059_a.sql", "059_b.sql"]);
  });

  it("does not mutate the original array", () => {
    const original = ["060_foo.sql", "001_bar.sql"];
    const copy = [...original];
    sortMigrationFiles(original);
    expect(original).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// loadApplied
// ---------------------------------------------------------------------------

describe("loadApplied", () => {
  it("returns filenames from schema_migrations rows", async () => {
    const { sql } = makeMockSql(["001_initial.sql", "002_better_auth.sql"]);
    const result = await loadApplied(sql);
    expect(result).toEqual(new Set(["001_initial.sql", "002_better_auth.sql"]));
  });

  it("returns an empty set when schema_migrations does not exist (table missing)", async () => {
    const throwingSql = Object.assign(
      async () => {
        throw new Error('relation "schema_migrations" does not exist');
      },
      {
        query: async () => [] as unknown[],
        transaction: async () => [] as unknown[],
      },
    ) as SqlFn;
    const result = await loadApplied(throwingSql);
    expect(result).toEqual(new Set());
  });
});

// ---------------------------------------------------------------------------
// runMigrations
// ---------------------------------------------------------------------------

describe("runMigrations", () => {
  const noop = () => {};

  it("applies all files when none are already applied", async () => {
    const { sql, transactionCalls } = makeMockSql([]);

    const files = ["001_initial.sql", "002_better_auth.sql", "003_env.sql"];
    const fileContent: Record<string, string> = {
      "001_initial.sql": "CREATE TABLE foo (id TEXT PRIMARY KEY);",
      "002_better_auth.sql": "ALTER TABLE foo ADD COLUMN name TEXT;",
      "003_env.sql": "CREATE TABLE bar (id TEXT PRIMARY KEY);",
    };

    const result = await runMigrations(
      sql,
      () => files,
      (name) => fileContent[name] ?? "",
      noop,
    );

    expect(result.applied).toEqual(files);
    expect(result.skipped).toEqual([]);
    expect(transactionCalls).toHaveLength(3);
  });

  it("skips already-applied files", async () => {
    const { sql, transactionCalls } = makeMockSql(["001_initial.sql"]);

    const files = ["001_initial.sql", "002_better_auth.sql"];
    const fileContent: Record<string, string> = {
      "001_initial.sql": "-- already applied",
      "002_better_auth.sql": "ALTER TABLE x ADD COLUMN y TEXT;",
    };

    const result = await runMigrations(
      sql,
      () => files,
      (name) => fileContent[name] ?? "",
      noop,
    );

    expect(result.applied).toEqual(["002_better_auth.sql"]);
    expect(result.skipped).toEqual(["001_initial.sql"]);
    expect(transactionCalls).toHaveLength(1);
  });

  it("applies files in numeric order regardless of directory listing order", async () => {
    const { sql } = makeMockSql([]);

    const files = ["060_late.sql", "001_early.sql", "030_middle.sql"];
    const appliedOrder: string[] = [];
    const fileContent: Record<string, string> = {
      "001_early.sql": "SELECT 1;",
      "030_middle.sql": "SELECT 2;",
      "060_late.sql": "SELECT 3;",
    };

    await runMigrations(
      sql,
      () => files,
      (name) => {
        appliedOrder.push(name);
        return fileContent[name] ?? "";
      },
      noop,
    );

    expect(appliedOrder).toEqual(["001_early.sql", "030_middle.sql", "060_late.sql"]);
  });

  it("tolerates gaps in migration numbering", async () => {
    const { sql } = makeMockSql([]);

    // Simulates concurrent agent migrations with gaps (050, 059, 100)
    const files = ["050_x.sql", "059_y.sql", "100_z.sql"];
    const result = await runMigrations(
      sql,
      () => files,
      () => "SELECT 1;",
      noop,
    );

    expect(result.applied).toEqual(["050_x.sql", "059_y.sql", "100_z.sql"]);
  });

  it("is a no-op when all files are already applied", async () => {
    const { sql, transactionCalls } = makeMockSql(["001_initial.sql", "002_better_auth.sql"]);

    const files = ["001_initial.sql", "002_better_auth.sql"];
    const result = await runMigrations(
      sql,
      () => files,
      () => "SELECT 1;",
      noop,
    );

    expect(result.applied).toEqual([]);
    expect(result.skipped).toHaveLength(2);
    expect(transactionCalls).toHaveLength(0);
  });

  it("throws with migration filename when a transaction fails", async () => {
    const failingSql = Object.assign(
      async () => [] as unknown[],
      {
        query: async () => [] as unknown[],
        transaction: async () => {
          throw new Error("syntax error at or near CREATE");
        },
      },
    ) as SqlFn;

    await expect(
      runMigrations(
        failingSql,
        () => ["001_broken.sql"],
        () => "INVALID SQL;",
        noop,
      ),
    ).rejects.toThrow("Migration 001_broken.sql failed");
  });

  it("throws when there are no sql files to apply", async () => {
    const { sql } = makeMockSql([]);
    await expect(
      runMigrations(sql, () => [], () => "", noop),
    ).rejects.toThrow("No .sql files found");
  });

  it("records each applied file in schema_migrations inside the same transaction", async () => {
    const { sql, transactionCalls } = makeMockSql([]);

    await runMigrations(
      sql,
      () => ["001_initial.sql"],
      () => "CREATE TABLE foo (id TEXT PRIMARY KEY);",
      noop,
    );

    expect(transactionCalls).toHaveLength(1);
    // Both the SQL content and the tracking filename are submitted in the transaction
    expect(transactionCalls[0].content).toContain("CREATE TABLE foo");
    expect(transactionCalls[0].filename).toBe("001_initial.sql");
  });
});

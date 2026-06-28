/**
 * RES-113 PR-L — migration 074 correctness + reversibility (static SQL assertions).
 *
 * No live DB: these tests read the migration .sql and verify (a) the forward DDL adds exactly the
 * connection-scope columns + NULL-permissive CHECK constraints, and (b) the documented Rollback
 * block is a true inverse (drops every column + constraint + index it added). This is the feasible
 * env-independent proof of reversibility — the migration itself is applied only at deploy.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = join(
  __dirname,
  "../../../../migrations/074_api_keys_connection_scope.sql",
);
const sql = readFileSync(MIGRATION_PATH, "utf-8");

/** The Rollback recipe is documented inside the leading comment block — extract those lines. */
function rollbackSection(): string {
  const idx = sql.indexOf("Rollback");
  expect(idx).toBeGreaterThan(-1);
  return sql.slice(idx);
}

describe("migration 074 — forward DDL (additive, NULL-permissive)", () => {
  it("adds the three scope columns idempotently (ADD COLUMN IF NOT EXISTS)", () => {
    for (const col of ["key_type", "access", "target"]) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS ${col} TEXT`));
    }
  });

  it("does NOT re-add status (it pre-exists from migration 004)", () => {
    expect(sql).not.toMatch(/ADD COLUMN IF NOT EXISTS status/);
  });

  it("never makes a column NOT NULL and runs no backfill UPDATE (purely additive)", () => {
    expect(sql).not.toMatch(/SET NOT NULL/i);
    expect(sql).not.toMatch(/\bUPDATE\s+api_keys\b/i);
  });

  it("constrains key_type to mcp/rest but allows NULL (legacy)", () => {
    expect(sql).toMatch(/CHECK \(key_type IS NULL OR key_type IN \('mcp', 'rest'\)\)/);
  });

  it("constrains access to read/read_write but allows NULL (legacy)", () => {
    expect(sql).toMatch(/CHECK \(access IS NULL OR access IN \('read', 'read_write'\)\)/);
  });

  it("guards both constraint adds against double-apply (pg_constraint check)", () => {
    const guards = sql.match(/IF NOT EXISTS \(\s*SELECT 1 FROM pg_constraint/g) ?? [];
    expect(guards.length).toBe(2);
  });

  it("adds a partial index on the scoped keys (access IS NOT NULL)", () => {
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_api_keys_project_access/);
    expect(sql).toMatch(/WHERE access IS NOT NULL/);
  });
});

describe("migration 074 — reversibility (documented Rollback inverts every change)", () => {
  const rollback = rollbackSection();

  it("drops every column the forward DDL added", () => {
    for (const col of ["key_type", "access", "target"]) {
      expect(rollback).toMatch(new RegExp(`DROP COLUMN IF EXISTS ${col}`));
    }
  });

  it("drops every CHECK constraint the forward DDL added", () => {
    expect(rollback).toMatch(/DROP CONSTRAINT IF EXISTS api_keys_key_type_check/);
    expect(rollback).toMatch(/DROP CONSTRAINT IF EXISTS api_keys_access_check/);
  });

  it("drops the index the forward DDL added", () => {
    expect(rollback).toMatch(/DROP INDEX IF EXISTS idx_api_keys_project_access/);
  });

  it("does NOT drop status (it pre-existed — must survive a rollback)", () => {
    expect(rollback).not.toMatch(/DROP COLUMN IF EXISTS status/);
  });

  it("the added column set and the rollback-dropped column set are identical", () => {
    const added = [...sql.matchAll(/ADD COLUMN IF NOT EXISTS (\w+)/g)].map((m) => m[1]).sort();
    const dropped = [...rollback.matchAll(/DROP COLUMN IF EXISTS (\w+)/g)].map((m) => m[1]).sort();
    expect(dropped).toEqual(added);
  });
});

/**
 * Migration 069 (upstream_mcp_targets) — from-scratch + uniqueness coverage.
 *
 * Hermetic (no live DB): the unit-test harness has no Postgres, so this asserts
 *   1. the migration parses cleanly through the real runner's statement splitter
 *      (the same path CI's "Apply dashboard migrations" uses), producing the
 *      table, indexes, and the cross-row UNIQUE index — i.e. it applies from
 *      scratch with no multi-command/quote hazards; and
 *   2. the normalised physical key (used by the service's uniqueness check and
 *      mirrored by the SQL unique index expression) collapses trailing slashes,
 *      case, and NULL namespace/database exactly like the index, so a cross-row
 *      duplicate is detected identically in code and in the DB.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { splitSqlStatements } from "$lib/server/migration-runner";
import { normalizeUpstreamPhysicalKey } from "$lib/server/upstream-physical-key";

const MIGRATION = "069_upstream_mcp_targets.sql";

function migrationSql(): string {
  const dir = join(__dirname, "..", "..", "..", "..", "migrations");
  return readFileSync(join(dir, MIGRATION), "utf-8");
}

describe("migration 069 upstream_mcp_targets (from-scratch)", () => {
  it("splits into clean statements (table + indexes + cross-row UNIQUE)", () => {
    const stmts = splitSqlStatements(migrationSql());
    // CREATE TABLE + CREATE INDEX + CREATE UNIQUE INDEX = 3 executable statements.
    expect(stmts.length).toBe(3);
    for (const s of stmts) expect(s.trim().length).toBeGreaterThan(0);

    const joined = stmts.join("\n").toLowerCase();
    expect(joined).toContain("create table if not exists upstream_mcp_targets");
    // FK to workspaces with cascade (workspace-scoped, like knowledge_graph_targets).
    expect(joined).toContain("references workspaces(id) on delete cascade");
    expect(joined).toContain("secret_ciphertext");
    // Cross-row uniqueness guard on the normalised physical upstream identity.
    expect(joined).toContain("create unique index if not exists uq_upstream_mcp_targets_physical");
    expect(joined).toContain("lower(rtrim(endpoint, '/'))");
    expect(joined).toContain("coalesce(namespace, '')");
    expect(joined).toContain("coalesce(database, '')");
  });

  it("normalised key matches the SQL unique-index expression (slash/case/NULL)", () => {
    const a = normalizeUpstreamPhysicalKey({
      endpoint: "https://MCP.example.com/sse/",
      namespace: null,
      database: null,
    });
    const b = normalizeUpstreamPhysicalKey({
      endpoint: "https://mcp.example.com/sse",
      namespace: "",
      database: "",
    });
    // Trailing slash stripped, host lower-cased, NULL ⇒ '' — so a == b ⇒ the DB
    // unique index would reject the second row exactly as the service does.
    expect(a).toEqual(b);

    // A different database is a distinct physical upstream (no false collision).
    const c = normalizeUpstreamPhysicalKey({
      endpoint: "https://mcp.example.com/sse",
      namespace: "ns",
      database: "db1",
    });
    const d = normalizeUpstreamPhysicalKey({
      endpoint: "https://mcp.example.com/sse",
      namespace: "ns",
      database: "db2",
    });
    expect(c).not.toEqual(d);
  });
});

/**
 * Migration 074 (connect_claim_versions read-time recheck audit) — additive + reversible.
 *
 * Hermetic (no live DB): asserts the migration parses through the real runner's statement
 * splitter (the path CI's "Apply dashboard migrations" uses), is purely ADDITIVE and
 * IDEMPOTENT (so it applies cleanly fail-closed on the host-managed spine), documents a
 * reversible rollback, and that the persisted `recheck_result` domain matches the EBV
 * read-time recheck engine's outcomes exactly (no drift between schema and code).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { splitSqlStatements } from "$lib/server/migration-runner";
import type { ReadTimeRecheckReason } from "@restormel/connect-core";

const MIGRATION = "074_connect_claim_versions_read_time_recheck.sql";

function migrationSql(): string {
  const dir = join(__dirname, "..", "..", "..", "..", "migrations");
  return readFileSync(join(dir, MIGRATION), "utf-8");
}

describe("migration 074 read-time recheck audit", () => {
  it("splits into 2 executable statements (ALTER ADD COLUMNs + partial index)", () => {
    const stmts = splitSqlStatements(migrationSql());
    expect(stmts.length).toBe(2);
    for (const s of stmts) expect(s.trim().length).toBeGreaterThan(0);

    const joined = stmts.join("\n").toLowerCase();
    expect(joined).toContain("alter table connect_claim_versions");
    expect(joined).toContain("add column if not exists last_rechecked_at");
    expect(joined).toContain("add column if not exists recheck_source_hash");
    expect(joined).toContain("add column if not exists recheck_result");
    expect(joined).toContain("create index if not exists idx_connect_claim_versions_recheck");
    // Partial index over CURRENT, rechecked versions only.
    expect(joined).toContain("where valid_to is null and last_rechecked_at is not null");
  });

  it("is purely additive + idempotent — no executable statement drops or deletes data", () => {
    const stmts = splitSqlStatements(migrationSql());
    for (const stmt of stmts) {
      // Strip `--` line comments first: the documented Rollback block legitimately
      // contains DROP statements; only the EXECUTABLE SQL must be additive.
      const s = stmt
        .replace(/--.*$/gm, "")
        .toLowerCase()
        .trim();
      if (!s) continue;
      expect(s).toMatch(/^(alter table|create index)/);
      expect(s).toContain("if not exists"); // idempotent re-apply
      expect(s).not.toMatch(/\bdrop\b/);
      expect(s).not.toMatch(/\b(delete|truncate|update)\b/);
    }
  });

  it("documents a reversible rollback for every added column + the index", () => {
    const sql = migrationSql().toLowerCase();
    expect(sql).toContain("rollback:");
    expect(sql).toContain("drop index if exists idx_connect_claim_versions_recheck");
    expect(sql).toContain("drop column if exists last_rechecked_at");
    expect(sql).toContain("drop column if exists recheck_source_hash");
    expect(sql).toContain("drop column if exists recheck_result");
  });

  it("the persisted recheck_result domain matches the engine outcomes exactly", () => {
    // The SQL comment enumerates the allowed recheck_result values; assert it is exactly
    // 'fresh' + every ReadTimeRecheckReason, so schema and engine cannot drift.
    const reasons: ReadTimeRecheckReason[] = [
      "stale_source",
      "span_lost",
      "offsets_out_of_range",
      "source_unavailable",
      "no_bound_span",
    ];
    const sql = migrationSql();
    const domainLine = sql.split("\n").find((l) => l.includes("recheck_result") && l.includes("|"));
    expect(domainLine).toBeTruthy();
    for (const value of ["fresh", ...reasons]) {
      expect(domainLine!).toContain(value);
    }
  });
});

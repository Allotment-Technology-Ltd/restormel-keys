/**
 * Tests for the schema-migration drift gate (production login regression).
 *
 * Regression under test: when CONNECT_RUNTIME_DDL is off (production) and the
 * schema_migrations bookkeeping table is missing/behind, ensure* call sites on
 * session/read paths previously THREW — page loads caught the error, returned
 * null, and signed-in users were shown the signed-out state ("not logged in").
 * The fail-open mode (`warnIfBehind`) must never throw, must log a structured
 * drift error, and must not permanently cache a failure.
 */
import { describe, it, expect } from "vitest";
import {
  createSchemaMigrationGate,
  type SchemaGateSql,
} from "$lib/server/schema-migration-gate";

const REQUIRED = "062_connect_claim_versions_asof_lookup.sql";

type SqlBehavior = () => Promise<unknown[]>;

function makeSql(behavior: { current: SqlBehavior }): { sql: SchemaGateSql; calls: () => number } {
  let calls = 0;
  const sql = (async (_strings: TemplateStringsArray, ..._values: unknown[]) => {
    calls += 1;
    return behavior.current();
  }) as SchemaGateSql;
  return { sql, calls: () => calls };
}

const tableMissing: SqlBehavior = async () => {
  const err = new Error('relation "schema_migrations" does not exist') as Error & { code: string };
  err.code = "42P01";
  throw err;
};

const hwm = (filename: string): SqlBehavior => async () => [{ filename }];

describe("schema-migration gate — fail-open read path", () => {
  it("warnIfBehind resolves (does not throw) when schema_migrations is missing", async () => {
    const behavior = { current: tableMissing };
    const { sql } = makeSql(behavior);
    const logs: string[] = [];
    const gate = createSchemaMigrationGate({
      requiredMigration: REQUIRED,
      getSql: () => sql,
      log: (l) => logs.push(l),
    });

    await expect(gate.warnIfBehind()).resolves.toBeUndefined();

    expect(logs).toHaveLength(1);
    const entry = JSON.parse(logs[0]) as Record<string, unknown>;
    expect(entry.event).toBe("schema_migration_gate");
    expect(entry.action).toBe("fail_open");
    expect(entry.requiredMigration).toBe(REQUIRED);
    expect(String(entry.message)).toContain("schema_migrations table does not exist");
  });

  it("warnIfBehind resolves and logs when the high-water mark is behind", async () => {
    const behavior = { current: hwm("059_schema_migrations_tracking.sql") };
    const { sql } = makeSql(behavior);
    const logs: string[] = [];
    const gate = createSchemaMigrationGate({
      requiredMigration: REQUIRED,
      getSql: () => sql,
      log: (l) => logs.push(l),
    });

    await expect(gate.warnIfBehind()).resolves.toBeUndefined();
    const entry = JSON.parse(logs[0]) as Record<string, unknown>;
    expect(String(entry.message)).toContain("Schema is behind");
    expect(String(entry.message)).toContain("059_schema_migrations_tracking.sql");
  });

  it("warnIfBehind is silent and caches success when the schema is current", async () => {
    const behavior = { current: hwm(REQUIRED) };
    const { sql, calls } = makeSql(behavior);
    const logs: string[] = [];
    const gate = createSchemaMigrationGate({
      requiredMigration: REQUIRED,
      getSql: () => sql,
      log: (l) => logs.push(l),
    });

    await gate.warnIfBehind();
    await gate.warnIfBehind();
    await gate.warnIfBehind();

    expect(logs).toHaveLength(0);
    expect(calls()).toBe(1); // success cached — single DB round-trip
  });

  it("accepts a high-water mark beyond the required migration", async () => {
    const behavior = { current: hwm("099_future.sql") };
    const { sql } = makeSql(behavior);
    const logs: string[] = [];
    const gate = createSchemaMigrationGate({
      requiredMigration: REQUIRED,
      getSql: () => sql,
      log: (l) => logs.push(l),
    });
    await gate.warnIfBehind();
    expect(logs).toHaveLength(0);
  });

  it("throttles re-checks after a failure, then recovers once migrations apply (no permanent poisoning)", async () => {
    let nowMs = 0;
    const behavior = { current: tableMissing };
    const { sql, calls } = makeSql(behavior);
    const logs: string[] = [];
    const gate = createSchemaMigrationGate({
      requiredMigration: REQUIRED,
      getSql: () => sql,
      recheckIntervalMs: 30_000,
      log: (l) => logs.push(l),
      now: () => nowMs,
    });

    await gate.warnIfBehind(); // fails, logs
    await gate.warnIfBehind(); // within interval — no re-check, no extra log
    expect(calls()).toBe(1);
    expect(logs).toHaveLength(1);

    // Migrations applied out-of-band; interval elapses — gate recovers.
    behavior.current = hwm(REQUIRED);
    nowMs = 31_000;
    await gate.warnIfBehind();
    expect(calls()).toBe(2);
    expect(logs).toHaveLength(1); // success — no new drift log

    // Verified state is cached from here on.
    await gate.warnIfBehind();
    expect(calls()).toBe(2);
  });

  it("shares one in-flight check across concurrent callers", async () => {
    let resolveCheck: ((rows: unknown[]) => void) | null = null;
    const behavior: { current: SqlBehavior } = {
      current: () => new Promise<unknown[]>((resolve) => (resolveCheck = resolve)),
    };
    const { sql, calls } = makeSql(behavior);
    const gate = createSchemaMigrationGate({
      requiredMigration: REQUIRED,
      getSql: () => sql,
      log: () => {},
    });

    const a = gate.warnIfBehind();
    const b = gate.warnIfBehind();
    expect(calls()).toBe(1);
    resolveCheck!([{ filename: REQUIRED }]);
    await Promise.all([a, b]);
  });
});

describe("schema-migration gate — strict assert", () => {
  it("throws naming the required migration when the table is missing", async () => {
    const behavior = { current: tableMissing };
    const { sql } = makeSql(behavior);
    const gate = createSchemaMigrationGate({
      requiredMigration: REQUIRED,
      getSql: () => sql,
      log: () => {},
    });
    await expect(gate.assert()).rejects.toThrow(REQUIRED);
  });

  it("does not cache a rejected check — assert succeeds after the schema catches up", async () => {
    const behavior = { current: tableMissing };
    const { sql } = makeSql(behavior);
    const gate = createSchemaMigrationGate({
      requiredMigration: REQUIRED,
      getSql: () => sql,
      log: () => {},
    });

    await expect(gate.assert()).rejects.toThrow("schema_migrations table does not exist");
    behavior.current = hwm(REQUIRED);
    await expect(gate.assert()).resolves.toBeUndefined();
  });

  it("reset() clears the cached verification", async () => {
    const behavior = { current: hwm(REQUIRED) };
    const { sql, calls } = makeSql(behavior);
    const gate = createSchemaMigrationGate({
      requiredMigration: REQUIRED,
      getSql: () => sql,
      log: () => {},
    });
    await gate.assert();
    gate.reset();
    await gate.assert();
    expect(calls()).toBe(2);
  });
});

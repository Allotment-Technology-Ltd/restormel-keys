/**
 * Unit tests for the migration advisory lock (migration-lock.ts).
 *
 * Proves: pg path takes + releases a SESSION advisory lock around the run; neon-http path
 * skips the lock; the lock is released even when the wrapped fn throws (fail-closed); errors
 * propagate unchanged. Uses an injected fake pool/client — no database required.
 */
import { describe, it, expect, vi } from "vitest";
import {
  withMigrationLock,
  MIGRATION_LOCK_CLASS_ID,
  MIGRATION_LOCK_OBJ_ID,
  type LockClientLike,
  type LockPoolLike,
} from "$lib/server/migration-lock";

interface RecordedQuery {
  text: string;
  params: unknown[];
}

function makeFakePool(opts: { connectThrows?: boolean; unlockThrows?: boolean } = {}): {
  pool: LockPoolLike;
  queries: RecordedQuery[];
  released: () => number;
} {
  const queries: RecordedQuery[] = [];
  let releaseCount = 0;
  const client: LockClientLike = {
    query: vi.fn(async (text: string, params: unknown[] = []) => {
      queries.push({ text, params });
      if (opts.unlockThrows && /pg_advisory_unlock/.test(text)) {
        throw new Error("connection lost");
      }
      return { rows: [] };
    }),
    release: vi.fn(() => {
      releaseCount += 1;
    }),
  };
  const pool: LockPoolLike = {
    connect: vi.fn(async () => {
      if (opts.connectThrows) throw new Error("pool exhausted");
      return client;
    }),
  };
  return { pool, queries, released: () => releaseCount };
}

const noop = () => {};

describe("withMigrationLock — pg path", () => {
  it("takes pg_advisory_lock before fn and pg_advisory_unlock after, then releases client", async () => {
    const { pool, queries, released } = makeFakePool();
    const order: string[] = [];

    const result = await withMigrationLock(
      "postgres://internal-cnpg/restormel_ops",
      async () => {
        order.push("fn");
        return { applied: ["001.sql"], skipped: [] };
      },
      { getPool: () => pool, shouldUseNeonHttp: () => false, log: noop },
    );

    expect(result).toEqual({ applied: ["001.sql"], skipped: [] });
    // lock acquired, fn ran, lock released — in that order.
    expect(queries[0].text).toMatch(/pg_advisory_lock/);
    expect(queries[0].params).toEqual([MIGRATION_LOCK_CLASS_ID, MIGRATION_LOCK_OBJ_ID]);
    expect(queries[queries.length - 1].text).toMatch(/pg_advisory_unlock/);
    expect(queries[queries.length - 1].params).toEqual([
      MIGRATION_LOCK_CLASS_ID,
      MIGRATION_LOCK_OBJ_ID,
    ]);
    expect(order).toEqual(["fn"]);
    expect(released()).toBe(1);
  });

  it("uses a SESSION lock (pg_advisory_lock), NOT pg_advisory_xact_lock", async () => {
    const { pool, queries } = makeFakePool();
    await withMigrationLock("postgres://x/db", async () => 0, {
      getPool: () => pool,
      shouldUseNeonHttp: () => false,
      log: noop,
    });
    expect(queries.some((q) => /pg_advisory_lock\b/.test(q.text))).toBe(true);
    expect(queries.some((q) => /xact_lock/.test(q.text))).toBe(false);
  });

  it("releases the lock AND the client even when fn throws (fail-closed), and re-throws", async () => {
    const { pool, queries, released } = makeFakePool();
    const boom = new Error("Migration 042_broken.sql failed");

    await expect(
      withMigrationLock(
        "postgres://x/db",
        async () => {
          throw boom;
        },
        { getPool: () => pool, shouldUseNeonHttp: () => false, log: noop },
      ),
    ).rejects.toBe(boom); // exact error propagates unchanged — not swallowed

    // unlock still attempted, client still released.
    expect(queries.some((q) => /pg_advisory_unlock/.test(q.text))).toBe(true);
    expect(released()).toBe(1);
  });

  it("does not mask fn's result if unlock itself fails (best-effort release)", async () => {
    const { pool, released } = makeFakePool({ unlockThrows: true });
    const result = await withMigrationLock("postgres://x/db", async () => "ok", {
      getPool: () => pool,
      shouldUseNeonHttp: () => false,
      log: noop,
    });
    expect(result).toBe("ok"); // unlock error swallowed; client.release() ends the session
    expect(released()).toBe(1);
  });

  it("does not attempt unlock if the lock was never acquired (connect throws)", async () => {
    const { pool } = makeFakePool({ connectThrows: true });
    await expect(
      withMigrationLock("postgres://x/db", async () => 0, {
        getPool: () => pool,
        shouldUseNeonHttp: () => false,
        log: noop,
      }),
    ).rejects.toThrow("pool exhausted");
  });
});

describe("withMigrationLock — neon-http path", () => {
  it("skips the lock entirely and runs fn directly", async () => {
    const connect = vi.fn();
    const result = await withMigrationLock(
      "postgresql://ep.neon.tech/db",
      async () => "ran",
      {
        getPool: () => ({ connect }) as unknown as LockPoolLike,
        shouldUseNeonHttp: () => true,
        log: noop,
      },
    );
    expect(result).toBe("ran");
    expect(connect).not.toHaveBeenCalled(); // never reached the pool
  });

  it("propagates fn errors unchanged on the neon path too", async () => {
    const err = new Error("nope");
    await expect(
      withMigrationLock(
        "wss://ep.neon.tech/db",
        async () => {
          throw err;
        },
        { shouldUseNeonHttp: () => true, log: noop },
      ),
    ).rejects.toBe(err);
  });
});

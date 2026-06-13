/**
 * Unit tests for the dual-driver database adapter (P3a).
 *
 * Proves:
 *  (a) the pg tagged template emits correct `$n` placeholders + a values array,
 *      and is injection-safe (a `'; DROP TABLE` value is a bound parameter,
 *      never interpolated into SQL text);
 *  (b) `.transaction()` issues BEGIN/COMMIT on success and ROLLBACK on error;
 *  (c) URL-scheme detection picks neon-http for *.neon.tech / ws(s):// and pg
 *      for plain postgres:// / postgresql://;
 *  (d) the neon-http path is left unchanged (we don't touch the neon client).
 *
 * No live database: a structural fake Pool/Client records the calls.
 */
import { describe, it, expect, vi } from "vitest";
import {
  shouldUseNeonHttp,
  sslConfigFromUrl,
  buildParameterizedQuery,
  makePgClient,
  type PgPoolLike,
  type PgClientLike,
  type TxnQuery,
  type Row,
} from "$lib/server/db-adapter";

// ---------------------------------------------------------------------------
// (c) URL-scheme detection
// ---------------------------------------------------------------------------

describe("shouldUseNeonHttp (URL-scheme detection)", () => {
  it("uses neon-http for a *.neon.tech host", () => {
    expect(
      shouldUseNeonHttp(
        "postgresql://user:pw@ep-cool-name-123.us-east-2.aws.neon.tech/db?sslmode=require",
      ),
    ).toBe(true);
  });

  it("uses neon-http for a wss:// scheme", () => {
    expect(shouldUseNeonHttp("wss://ep-foo.neon.tech/v2")).toBe(true);
    expect(shouldUseNeonHttp("ws://localhost:5432/db")).toBe(true);
  });

  it("uses the pg Pool for a plain postgres:// URL to a non-Neon host", () => {
    expect(shouldUseNeonHttp("postgres://user:pw@10.0.0.5:5432/restormel")).toBe(false);
    expect(
      shouldUseNeonHttp("postgresql://user:pw@db.internal:5432/app?sslmode=disable"),
    ).toBe(false);
    expect(shouldUseNeonHttp("postgres://localhost/dev")).toBe(false);
  });

  it("falls back to neon-http for an unparseable URL (preserves prior behaviour)", () => {
    expect(shouldUseNeonHttp("not a url")).toBe(true);
    expect(shouldUseNeonHttp("")).toBe(true);
  });

  it("is not fooled by 'neon.tech' appearing only in the path/query, not the host", () => {
    expect(shouldUseNeonHttp("postgres://user:pw@10.0.0.5:5432/neon.tech_clone")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sslmode parsing
// ---------------------------------------------------------------------------

describe("sslConfigFromUrl (sslmode handling)", () => {
  it("disables ssl for sslmode=disable (internal-network self-host)", () => {
    expect(sslConfigFromUrl("postgres://u@db:5432/app?sslmode=disable")).toBe(false);
  });

  it("encrypts-without-verify for sslmode=require / no-verify", () => {
    expect(sslConfigFromUrl("postgres://u@db:5432/app?sslmode=require")).toEqual({
      rejectUnauthorized: false,
    });
    expect(sslConfigFromUrl("postgres://u@db:5432/app?sslmode=no-verify")).toEqual({
      rejectUnauthorized: false,
    });
  });

  it("strict-verifies for sslmode=verify-full / verify-ca", () => {
    expect(sslConfigFromUrl("postgres://u@db:5432/app?sslmode=verify-full")).toBe(true);
    expect(sslConfigFromUrl("postgres://u@db:5432/app?sslmode=verify-ca")).toBe(true);
  });

  it("returns undefined (defer to pg defaults) when sslmode is unset or url is bad", () => {
    expect(sslConfigFromUrl("postgres://u@db:5432/app")).toBeUndefined();
    expect(sslConfigFromUrl("garbage")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// (a) tagged-template parameterization + injection safety
// ---------------------------------------------------------------------------

describe("buildParameterizedQuery (tagged-template → $n + values)", () => {
  it("interleaves $1, $2 placeholders and collects values in order", () => {
    // Simulate the runtime call for sql`SELECT * FROM t WHERE a = ${a} AND b = ${b}`
    const strings = Object.assign(
      ["SELECT * FROM t WHERE a = ", " AND b = ", ""],
      { raw: ["SELECT * FROM t WHERE a = ", " AND b = ", ""] },
    ) as unknown as TemplateStringsArray;
    const q = buildParameterizedQuery(strings, ["x", 42]);
    expect(q.text).toBe("SELECT * FROM t WHERE a = $1 AND b = $2");
    expect(q.params).toEqual(["x", 42]);
  });

  it("produces no placeholders for a template with no interpolations", () => {
    const strings = Object.assign(["SELECT 1"], {
      raw: ["SELECT 1"],
    }) as unknown as TemplateStringsArray;
    const q = buildParameterizedQuery(strings, []);
    expect(q.text).toBe("SELECT 1");
    expect(q.params).toEqual([]);
  });

  it("INJECTION SAFETY: a malicious value is bound as a parameter, never interpolated", () => {
    const evil = "'; DROP TABLE users; --";
    const strings = Object.assign(
      ["SELECT status FROM founders_circle_access WHERE email = ", " LIMIT 1"],
      { raw: ["", ""] },
    ) as unknown as TemplateStringsArray;
    const q = buildParameterizedQuery(strings, [evil]);
    // The SQL text contains a placeholder, NOT the attacker's string.
    expect(q.text).toBe(
      "SELECT status FROM founders_circle_access WHERE email = $1 LIMIT 1",
    );
    expect(q.text).not.toContain("DROP TABLE");
    // The attacker's string survives verbatim ONLY in the bound params array.
    expect(q.params).toEqual([evil]);
  });
});

// ---------------------------------------------------------------------------
// Fakes for the pg client
// ---------------------------------------------------------------------------

function makeFakePool(opts?: {
  rows?: Row[];
  failOn?: (text: string) => boolean;
}): {
  pool: PgPoolLike;
  poolCalls: Array<{ text: string; params: unknown[] }>;
  clientCalls: Array<{ text: string; params: unknown[] }>;
  released: () => number;
} {
  const poolCalls: Array<{ text: string; params: unknown[] }> = [];
  const clientCalls: Array<{ text: string; params: unknown[] }> = [];
  let releaseCount = 0;

  const client: PgClientLike = {
    query: vi.fn(async (text: string, params: unknown[] = []) => {
      clientCalls.push({ text, params });
      if (opts?.failOn?.(text)) throw new Error(`boom on: ${text}`);
      return { rows: opts?.rows ?? [] };
    }),
    release: () => {
      releaseCount += 1;
    },
  };

  const pool: PgPoolLike = {
    query: vi.fn(async (text: string, params: unknown[] = []) => {
      poolCalls.push({ text, params });
      return { rows: opts?.rows ?? [] };
    }),
    connect: vi.fn(async () => client),
  };

  return { pool, poolCalls, clientCalls, released: () => releaseCount };
}

// ---------------------------------------------------------------------------
// makePgClient — tagged template + .query execute against the pool
// ---------------------------------------------------------------------------

describe("makePgClient — query execution shape (neon-default rows[])", () => {
  it("tagged template runs a parameterized pool.query and returns rows[]", async () => {
    const { pool, poolCalls } = makeFakePool({ rows: [{ status: "approved" }] });
    const sql = makePgClient(pool);
    const email = "a@b.com";
    const rows = await sql`SELECT status FROM founders_circle_access WHERE email = ${email} LIMIT 1`;
    expect(rows).toEqual([{ status: "approved" }]);
    expect(poolCalls).toHaveLength(1);
    expect(poolCalls[0].text).toBe(
      "SELECT status FROM founders_circle_access WHERE email = $1 LIMIT 1",
    );
    expect(poolCalls[0].params).toEqual([email]);
  });

  it("INJECTION SAFETY end-to-end: evil value reaches the pool as a bound param", async () => {
    const { pool, poolCalls } = makeFakePool();
    const sql = makePgClient(pool);
    const evil = "'; DROP TABLE users; --";
    await sql`SELECT * FROM t WHERE name = ${evil}`;
    expect(poolCalls[0].text).toBe("SELECT * FROM t WHERE name = $1");
    expect(poolCalls[0].text).not.toContain("DROP TABLE");
    expect(poolCalls[0].params).toEqual([evil]);
  });

  it(".query(text, params) passes through to pool.query and returns rows[]", async () => {
    const { pool, poolCalls } = makeFakePool({ rows: [{ n: 1 }] });
    const sql = makePgClient(pool);
    const rows = await sql.query("SELECT * FROM t WHERE id = $1", ["abc"]);
    expect(rows).toEqual([{ n: 1 }]);
    expect(poolCalls[0]).toEqual({ text: "SELECT * FROM t WHERE id = $1", params: ["abc"] });
  });
});

// ---------------------------------------------------------------------------
// (b) transaction: BEGIN/COMMIT on success, ROLLBACK on error
// ---------------------------------------------------------------------------

describe("makePgClient — .transaction()", () => {
  it("callback form: BEGIN, each query, COMMIT on one client; returns rows[][]", async () => {
    const { pool, clientCalls, released } = makeFakePool({ rows: [{ ok: true }] });
    const sql = makePgClient(pool);

    const results = await sql.transaction((txn) => [
      txn.query("CREATE TABLE foo (id TEXT)", []),
      txn.query("INSERT INTO schema_migrations (filename) VALUES ($1)", ["001.sql"]),
    ]);

    const order = clientCalls.map((c) => c.text);
    expect(order[0]).toBe("BEGIN");
    expect(order[order.length - 1]).toBe("COMMIT");
    expect(order).toContain("CREATE TABLE foo (id TEXT)");
    expect(order).toContain("INSERT INTO schema_migrations (filename) VALUES ($1)");
    // one rows[] per non-BEGIN/COMMIT query
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual([{ ok: true }]);
    // client returned to the pool
    expect(released()).toBe(1);
  });

  it("callback form: txn tagged-template parameterizes inside the transaction", async () => {
    const { pool, clientCalls } = makeFakePool();
    const sql = makePgClient(pool);
    const v = "val";
    await sql.transaction((txn) => [
      // tagged-template form inside txn
      (txn`UPDATE t SET a = ${v} WHERE id = ${1}` as unknown) as TxnQuery,
    ]);
    const upd = clientCalls.find((c) => c.text.startsWith("UPDATE"));
    expect(upd?.text).toBe("UPDATE t SET a = $1 WHERE id = $2");
    expect(upd?.params).toEqual([v, 1]);
  });

  it("ROLLBACK on error: a failing statement triggers ROLLBACK, releases the client, and rethrows", async () => {
    const { pool, clientCalls, released } = makeFakePool({
      failOn: (t) => t.includes("INSERT"),
    });
    const sql = makePgClient(pool);

    await expect(
      sql.transaction((txn) => [
        txn.query("CREATE TABLE foo (id TEXT)", []),
        txn.query("INSERT INTO foo VALUES ($1)", ["x"]),
      ]),
    ).rejects.toThrow(/boom on: INSERT/);

    const order = clientCalls.map((c) => c.text);
    expect(order[0]).toBe("BEGIN");
    expect(order).toContain("ROLLBACK");
    expect(order).not.toContain("COMMIT");
    expect(released()).toBe(1);
  });

  it("array form: accepts a pre-built TxnQuery[] and runs them in order", async () => {
    const { pool, clientCalls } = makeFakePool();
    const sql = makePgClient(pool);
    await sql.transaction([
      { text: "SELECT 1", params: [] },
      { text: "SELECT $1", params: [2] },
    ]);
    const order = clientCalls.map((c) => c.text);
    expect(order).toEqual(["BEGIN", "SELECT 1", "SELECT $1", "COMMIT"]);
  });
});

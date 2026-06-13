/**
 * Dual-driver database adapter (P3a).
 *
 * Exposes ONE query API — identical in shape to the Neon HTTP driver's default
 * `NeonQueryFunction` (`arrayMode: false`, `fullResults: false`) — backed by
 * EITHER:
 *
 *   - **neon-http** (`@neondatabase/serverless`) when the URL targets Neon
 *     (host contains `neon.tech`) or uses a websocket scheme (`ws://`/`wss://`).
 *     This is the existing behaviour, byte-for-byte unchanged.
 *
 *   - a **standard `pg` Pool** (TCP) when the URL is a plain
 *     `postgres://` / `postgresql://` pointing at any other host (e.g. a
 *     self-hosted Postgres on the internal network).
 *
 * Why: migrating off Neon to self-hosted Postgres becomes a `DATABASE_URL`
 * change with ZERO call-site changes and instant rollback. URL-scheme detection
 * lives in ONE place (this module); ~275 `getSql()` call sites are untouched.
 *
 * Security (SQL parameterisation): the pg-backed tagged template NEVER
 * string-interpolates interpolated values. `` sql`... ${a} ... ${b}` `` is
 * converted to a parameterised `pool.query('... $1 ... $2', [a, b])` — exactly
 * what neon-http does — so a value containing `'; DROP TABLE ...` is sent as a
 * bound parameter, not as SQL text. See db-adapter.test.ts for the injection
 * proof.
 *
 * Shape contract (default, the only mode this codebase uses):
 *   - tagged template `` sql`...${v}` ``  → Promise<rows[]>   (array of objects)
 *   - `sql.query(text, params)`            → Promise<rows[]>
 *   - `sql.transaction(queriesOrFn, opts?)`→ Promise<rows[][]> (one rows[] per query)
 *
 * neon-http behaviours the pg path does NOT replicate (intentional / by design):
 *   - neon-http batches a `.transaction()` over a SINGLE HTTP round-trip;
 *     pg runs an interactive `BEGIN ... COMMIT` on one pooled client (true
 *     server-side transaction). Atomicity is equivalent (arguably stronger).
 *   - `arrayMode`/`fullResults` are not surfaced — unused in this codebase.
 *   - PG error objects carry `.code` (SQLSTATE) just like neon-http, so the
 *     existing `e.code === "42P01"` style checks keep working on both paths.
 */

import { neon } from "@neondatabase/serverless";
import { Pool, type PoolConfig } from "pg";

// ---------------------------------------------------------------------------
// Public API shape (the neon-http default contract — rows mode)
// ---------------------------------------------------------------------------

/**
 * A result row in the default (object) mode. Matches neon-http's
 * `QueryRows<false>` = `Record<string, any>[]` element type EXACTLY so the
 * ~275 existing call sites (`rows[0]?.someColumn`) type-check unchanged.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

/** A deferred query built inside a `.transaction()` callback. */
export interface TxnQuery {
  text: string;
  params: unknown[];
}

/** The `txn` handle passed to a `.transaction(fn)` callback (neon-compatible). */
export interface TxnClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (strings: TemplateStringsArray, ...values: any[]): TxnQuery;
  query(text: string, params?: unknown[]): TxnQuery;
}

/**
 * The callable query API. Matches `NeonQueryFunction<false, false>` closely
 * enough that every existing call site (tagged template, `.query`,
 * `.transaction`) type-checks and behaves identically — including the loose
 * `Record<string, any>` row typing the call sites depend on.
 */
export interface DbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (strings: TemplateStringsArray, ...values: any[]): Promise<Row[]>;
  query(text: string, params?: unknown[]): Promise<Row[]>;
  transaction(
    queriesOrFn: TxnQuery[] | ((txn: TxnClient) => TxnQuery[]),
  ): Promise<Row[][]>;
}

// ---------------------------------------------------------------------------
// URL-scheme detection (the ONE place that decides the driver)
// ---------------------------------------------------------------------------

/**
 * Decide whether a `DATABASE_URL` should be served by the neon-http driver.
 *
 * neon-http when:
 *   - scheme is websocket (`ws://` / `wss://` — Neon's pooled WS protocol), OR
 *   - host contains `neon.tech` (Neon serverless / branch endpoints).
 *
 * Otherwise (plain `postgres://` / `postgresql://` to another host) → pg Pool.
 *
 * Parsing is defensive: an unparseable URL falls back to neon-http (the prior
 * behaviour), so this change can never make a previously-working URL fail to
 * route — it only *adds* the pg path for plain URLs.
 */
export function shouldUseNeonHttp(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Unparseable — preserve the historical behaviour (neon was always used).
    return true;
  }
  const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();
  if (scheme === "ws" || scheme === "wss") return true;
  if (parsed.hostname.toLowerCase().includes("neon.tech")) return true;
  return false;
}

// ---------------------------------------------------------------------------
// pg Pool construction (singleton per process, keyed by URL)
// ---------------------------------------------------------------------------

const poolCache = new Map<string, Pool>();

/**
 * Derive the `ssl` option for a `pg` Pool from the URL's `sslmode`.
 *
 * - `sslmode=disable` → `ssl: false` (typical for a Postgres on a trusted
 *   internal/private network where TLS is terminated elsewhere or unused).
 * - `sslmode=no-verify` / `sslmode=require` with `no-verify` intent →
 *   `{ rejectUnauthorized: false }` (encrypt, but don't verify the cert —
 *   common with self-hosted CAs).
 * - anything else / unset → `undefined` (let pg/libpq defaults apply; for a
 *   plain local box that means no SSL unless the server demands it).
 */
export function sslConfigFromUrl(url: string): PoolConfig["ssl"] {
  let sslmode: string | null = null;
  try {
    sslmode = new URL(url).searchParams.get("sslmode");
  } catch {
    sslmode = null;
  }
  const mode = (sslmode ?? "").toLowerCase();
  if (mode === "disable") return false;
  if (mode === "no-verify" || mode === "allow" || mode === "prefer") {
    return { rejectUnauthorized: false };
  }
  if (mode === "require") {
    // `require` in libpq means "encrypt, don't verify" — match that so a
    // self-signed cert on a self-hosted box doesn't break the connection.
    return { rejectUnauthorized: false };
  }
  // `verify-ca` / `verify-full` → strict verification.
  if (mode === "verify-ca" || mode === "verify-full") return true;
  // Unset: let the default apply (pg uses the connection-string/env defaults).
  return undefined;
}

/** Get (or lazily create) the singleton pg Pool for a given URL. */
export function getPool(url: string): Pool {
  const existing = poolCache.get(url);
  if (existing) return existing;
  const config: PoolConfig = { connectionString: url };
  const ssl = sslConfigFromUrl(url);
  if (ssl !== undefined) config.ssl = ssl;
  const pool = new Pool(config);
  poolCache.set(url, pool);
  return pool;
}

/** Test/teardown helper: close and forget all cached pools. */
export async function _closeAllPoolsForTesting(): Promise<void> {
  const pools = [...poolCache.values()];
  poolCache.clear();
  await Promise.all(pools.map((p) => p.end().catch(() => {})));
}

// ---------------------------------------------------------------------------
// pg → neon-shape adapter
// ---------------------------------------------------------------------------

/**
 * Minimal structural subset of `pg.Pool` the adapter relies on. Declared
 * explicitly so unit tests can inject a fake without a live database.
 */
export interface PgPoolLike {
  query(text: string, params?: unknown[]): Promise<{ rows: Row[] }>;
  connect(): Promise<PgClientLike>;
}

export interface PgClientLike {
  query(text: string, params?: unknown[]): Promise<{ rows: Row[] }>;
  release(): void;
}

/**
 * Build the parameterised query for a tagged-template invocation.
 *
 * `` sql`SELECT * FROM t WHERE a = ${a} AND b = ${b}` `` is invoked by the JS
 * runtime as `fn(strings, a, b)` where
 *   `strings = ['SELECT * FROM t WHERE a = ', ' AND b = ', '']`.
 * We interleave `$1`, `$2`, … between the static fragments and collect the
 * interpolated values into a params array — IDENTICAL to neon-http. The values
 * are NEVER concatenated into the SQL text, so injection is impossible.
 */
export function buildParameterizedQuery(
  strings: TemplateStringsArray,
  values: unknown[],
): TxnQuery {
  let text = "";
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      text += "$" + (i + 1);
    }
  }
  return { text, params: values };
}

/** Build the neon-shaped client over a `pg` Pool. */
export function makePgClient(pool: PgPoolLike): DbClient {
  const tagged = (async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Row[]> => {
    const { text, params } = buildParameterizedQuery(strings, values);
    const result = await pool.query(text, params);
    return result.rows;
  }) as DbClient;

  tagged.query = async (text: string, params: unknown[] = []): Promise<Row[]> => {
    const result = await pool.query(text, params);
    return result.rows;
  };

  tagged.transaction = async (
    queriesOrFn: TxnQuery[] | ((txn: TxnClient) => TxnQuery[]),
  ): Promise<Row[][]> => {
    // Resolve the list of deferred queries. The callback form mirrors
    // neon-http: `txn` builds (but does NOT execute) query descriptors; we run
    // them on one pooled client inside a real BEGIN/COMMIT.
    let queries: TxnQuery[];
    if (typeof queriesOrFn === "function") {
      const txn: TxnClient = ((
        strings: TemplateStringsArray,
        ...values: unknown[]
      ): TxnQuery => buildParameterizedQuery(strings, values)) as TxnClient;
      txn.query = (text: string, params: unknown[] = []): TxnQuery => ({
        text,
        params,
      });
      queries = queriesOrFn(txn);
    } else {
      queries = queriesOrFn;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const results: Row[][] = [];
      for (const q of queries) {
        const r = await client.query(q.text, q.params);
        results.push(r.rows);
      }
      await client.query("COMMIT");
      return results;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Swallow rollback failure — surface the original error below.
      }
      throw err;
    } finally {
      client.release();
    }
  };

  return tagged;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Return the query API for a `DATABASE_URL`. neon-http for Neon/ws URLs (the
 * `neon()` function is itself the callable client and already matches our
 * `DbClient` shape); a pg-Pool-backed adapter for plain Postgres URLs.
 */
export function getDb(url: string): DbClient {
  if (shouldUseNeonHttp(url)) {
    // neon() returns a NeonQueryFunction with the same callable + .query +
    // .transaction shape. Cast through the structural DbClient interface.
    return neon(url) as unknown as DbClient;
  }
  return makePgClient(getPool(url));
}

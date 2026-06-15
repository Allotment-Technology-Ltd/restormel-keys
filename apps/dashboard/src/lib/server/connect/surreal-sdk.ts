/**
 * WebSocket (ws/wss) + RPC transport for Bring-Your-Own SurrealDB, via the
 * official `surrealdb` SDK. The HTTP `/sql` client (graph-target-service.ts)
 * stays the path for http/https endpoints; this module is used only when the
 * configured endpoint scheme is `ws`/`wss` — SurrealDB's native, idiomatic
 * connection that the HTTP `/sql` REST API cannot serve.
 *
 * Returns the same `{ ok, data }` envelope shape as `surrealHttpQuery` so the
 * graph store and connection-test paths can dispatch by scheme transparently:
 * `data` is normalised to `[{ result }, …]` (one entry per statement), matching
 * the HTTP `/sql` response shape that callers already destructure.
 */
import { Surreal } from "surrealdb";
import { looksLikeSurrealJwt } from "$lib/server/connect/connection-string";
import { validateOutboundSurrealEndpoint } from "$lib/server/connect/outbound-surreal-endpoint";

export type SurrealSdkConn = {
  endpoint: string;
  namespace: string;
  database: string;
  username?: string | null;
  password?: string | null;
};

/** Default per-request timeout (ms) for outbound Surreal SDK calls. Shares the HTTP env knob. */
const SURREAL_SDK_TIMEOUT_MS = (() => {
  const raw = Number(process.env.RESTORMEL_SURREAL_HTTP_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 25_000;
})();

/** True when the endpoint must use the WebSocket SDK transport rather than HTTP /sql. */
export function isWebSocketSurrealEndpoint(endpoint: string): boolean {
  return /^wss?:\/\//i.test(endpoint.trim());
}

/** Map the stored base endpoint to the SDK's RPC URL (SurrealDB serves RPC at /rpc). */
export function surrealRpcUrl(endpoint: string): string {
  const base = endpoint.trim().replace(/\/+$/, "");
  return base.endsWith("/rpc") ? base : `${base}/rpc`;
}

/**
 * The runtime needs a global WebSocket (Node >= 22, or a browser). The SDK ships
 * no WebSocket polyfill, so fail with an actionable message rather than a cryptic
 * "WebSocket is not defined" from inside the driver.
 */
function webSocketAvailable(): boolean {
  return typeof (globalThis as { WebSocket?: unknown }).WebSocket !== "undefined";
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Surreal ${label} timed out after ${ms}ms`)), ms).unref?.(),
    ),
  ]);
}

function normalizeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Surreal WebSocket error";
  return msg.length > 280 ? `${msg.slice(0, 280)}…` : msg;
}

/**
 * Authenticate the connection, mirroring the HTTP path's ladder:
 * - a token (JWT, or a secret with no username) → `authenticate(token)`
 * - username + password → signin, trying database → namespace → root scope
 * - username only → error; neither → anonymous (no signin)
 */
async function authenticateSdk(db: Surreal, conn: SurrealSdkConn, ms: number): Promise<string | null> {
  const username = conn.username?.trim() ?? "";
  const secret = conn.password?.trim() ?? "";

  if (secret && (!username || looksLikeSurrealJwt(secret))) {
    try {
      await withTimeout(db.authenticate(secret), ms, "authenticate");
      return null;
    } catch (e) {
      return normalizeError(e);
    }
  }

  if (username && !secret) {
    return "Password is required with username.";
  }

  if (!username && !secret) {
    return null; // anonymous
  }

  const attempts = [
    { namespace: conn.namespace, database: conn.database, username, password: secret },
    { namespace: conn.namespace, username, password: secret },
    { username, password: secret },
  ];
  let lastError = "Surreal sign-in failed";
  for (const auth of attempts) {
    try {
      await withTimeout(db.signin(auth), ms, "sign-in");
      return null;
    } catch (e) {
      lastError = normalizeError(e);
    }
  }
  return `${lastError}. Check username/password and that the user is defined at root, namespace, or database level.`;
}

/**
 * Run a query over the SDK (ws/wss). Connects, authenticates, queries, and
 * always closes the socket. Var binding is native — no LET preamble needed.
 */
export async function surrealSdkQuery(params: {
  endpoint: string;
  namespace: string;
  database: string;
  username?: string | null;
  password?: string | null;
  sql: string;
  vars?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const endpointCheck = validateOutboundSurrealEndpoint(params.endpoint);
  if (!endpointCheck.ok) return { ok: false, error: endpointCheck.message };
  if (!webSocketAvailable()) {
    return {
      ok: false,
      error:
        "WebSocket transport unavailable in this runtime. A ws://wss:// Surreal endpoint needs Node 22+ (global WebSocket); upgrade the runtime or use an https:// endpoint.",
    };
  }

  const ms = params.timeoutMs ?? SURREAL_SDK_TIMEOUT_MS;
  const db = new Surreal();
  try {
    await withTimeout(
      db.connect(surrealRpcUrl(params.endpoint), {
        namespace: params.namespace,
        database: params.database,
      }),
      ms,
      "connect",
    );

    const authError = await authenticateSdk(db, params, ms);
    if (authError) return { ok: false, error: authError };

    const results = (await withTimeout(
      db.query(params.sql, params.vars),
      ms,
      "query",
    )) as unknown[];

    // Normalise to the HTTP /sql shape callers expect: [{ result }, …].
    const data = Array.isArray(results) ? results.map((result) => ({ result })) : [];
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: normalizeError(e) };
  } finally {
    await db.close().catch(() => {});
  }
}

/**
 * SurrealGraphStore — a GraphStore (graphrag-core port) backed by a
 * Bring-Your-Own SurrealDB over its HTTP /sql API. No driver dependency.
 *
 * Built from a workspace's configured graph target. When no target is
 * configured (or it is unreachable), retrieve falls back to degraded mode.
 */
import type { GraphStore } from "@restormel/graphrag-core";
import {
  decryptGraphTargetSecret,
  resolveSurrealBearerToken,
  surrealHttpQuery,
  type SurrealHttpConn,
} from "$lib/server/connect/graph-target-service";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";

class SurrealHttpGraphStore implements GraphStore {
  private bearerPromise: Promise<string | null> | null = null;

  constructor(private readonly conn: SurrealHttpConn) {}

  private bearerToken(): Promise<string | null> {
    if (!this.bearerPromise) {
      this.bearerPromise = resolveSurrealBearerToken(this.conn).then((auth) => {
        if (!auth.ok) throw new GraphStoreUnavailableError(auth.error);
        return auth.token;
      });
    }
    return this.bearerPromise;
  }

  async query<T>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    // Surreal HTTP /sql does not bind vars; inline a LET preamble when provided.
    const preamble = vars
      ? Object.entries(vars)
          .map(([k, v]) => `LET $${k} = ${JSON.stringify(v)};`)
          .join("\n")
      : "";
    const bearerToken = await this.bearerToken();
    const result = await surrealHttpQuery({
      ...this.conn,
      bearerToken,
      sql: preamble ? `${preamble}\n${sql}` : sql,
    });
    if (!result.ok) {
      throw new GraphStoreUnavailableError(result.error);
    }
    // Surreal returns [{ status, result }, ...]; surface the final statement's result.
    const envelopes = Array.isArray(result.data) ? result.data : [];
    const last = envelopes[envelopes.length - 1] as { result?: unknown } | undefined;
    return (last?.result ?? []) as T;
  }

  isDatabaseUnavailable(error: unknown): boolean {
    return error instanceof GraphStoreUnavailableError;
  }
}

class GraphStoreUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphStoreUnavailableError";
  }
}

/**
 * Build a GraphStore for the workspace, or null when no usable target exists.
 * Returning null lets callers keep honest `retrieval_degraded` metadata.
 */
export async function buildWorkspaceGraphStore(workspaceId: string): Promise<GraphStore | null> {
  const target = await getConnectGraphTargetForWorkspace(workspaceId);
  if (!target) return null;
  // graphrag-core retrieval speaks SurrealQL; Postgres-spine retrieval is a follow-on.
  if (target.provider !== "surreal" || !target.endpoint || !target.namespace || !target.database) {
    return null;
  }
  const password = decryptGraphTargetSecret(target);
  return new SurrealHttpGraphStore({
    endpoint: target.endpoint,
    namespace: target.namespace,
    database: target.database,
    username: target.username,
    password,
  });
}

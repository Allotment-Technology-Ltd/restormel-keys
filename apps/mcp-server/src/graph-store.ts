/**
 * graph-store — builds the graphrag-core wiring from {@link ServerConfig}.
 *
 * graphrag-core ships no database driver, so this module supplies the host
 * pieces it needs:
 *   - a {@link GraphStore} over the BYO SurrealDB HTTP /sql API (or Neo4j, when
 *     selected, via the AdapterFactory),
 *   - a {@link RetrievalConfig} (defaults to philosophyRetrievalConfig),
 *   - {@link GraphRagDeps} (store + embedder + origin resolver) for the orchestrator.
 *
 * The embedder is a no-op by default (no LLM key in a standalone deployment):
 * retrieval then runs on the engine's lexical/text path. A real embedder can be
 * injected by a host that imports this module programmatically.
 */
import {
  createGraphStoreAdapter,
  philosophyRetrievalConfig,
  RetrievalOrchestrator,
  type AdapterFactoryDeps,
  type EmbeddingPort,
  type GraphRagDeps,
  type GraphStore,
  type GraphStoreAdapter,
  type GraphStoreConnectionConfig,
  type RetrievalConfig,
} from "@restormel/graphrag-core";
import type { ServerConfig } from "./config.js";

/** Edge tables traversed when an operation does not name explicit edge types. */
function defaultEdgeTables(config: RetrievalConfig): string[] {
  return config.relations.traversalEdges.map((e) => e.table);
}

/** A connection over the BYO SurrealDB HTTP /sql API (no driver dependency). */
class SurrealHttpGraphStore implements GraphStore {
  constructor(
    private readonly url: string,
    private readonly creds: { username?: string; password?: string },
  ) {}

  async query<T>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    // Surreal HTTP /sql does not bind vars; inline a LET preamble when provided.
    const preamble = vars
      ? Object.entries(vars)
          .map(([k, v]) => `LET $${k} = ${JSON.stringify(v)};`)
          .join("\n")
      : "";
    const body = preamble ? `${preamble}\n${sql}` : sql;

    const headers: Record<string, string> = {
      "Content-Type": "text/plain",
      Accept: "application/json",
    };
    const { namespace, database } = parseSurrealTarget(this.url);
    if (namespace) headers["surreal-ns"] = namespace;
    if (database) headers["surreal-db"] = database;
    if (this.creds.username && this.creds.password) {
      const token = Buffer.from(`${this.creds.username}:${this.creds.password}`).toString("base64");
      headers.Authorization = `Basic ${token}`;
    }

    let res: Response;
    try {
      res = await fetch(stripSurrealTarget(this.url), { method: "POST", headers, body });
    } catch (err) {
      throw new GraphStoreUnavailableError(
        `SurrealDB request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!res.ok) {
      throw new GraphStoreUnavailableError(`SurrealDB returned HTTP ${res.status}.`);
    }
    const payload = (await res.json()) as Array<{ status?: string; result?: unknown }>;
    const envelopes = Array.isArray(payload) ? payload : [];
    const last = envelopes[envelopes.length - 1];
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

/** Extract namespace/database from a Surreal URL (path tail or ?ns=&db= query). */
function parseSurrealTarget(rawUrl: string): { namespace?: string; database?: string } {
  try {
    const u = new URL(rawUrl);
    const ns = u.searchParams.get("ns") ?? u.searchParams.get("namespace") ?? undefined;
    const db = u.searchParams.get("db") ?? u.searchParams.get("database") ?? undefined;
    if (ns || db) return { namespace: ns ?? undefined, database: db ?? undefined };
    // …/sql/<namespace>/<database>
    const segments = u.pathname.split("/").filter(Boolean);
    const sqlIdx = segments.indexOf("sql");
    if (sqlIdx >= 0 && segments.length >= sqlIdx + 3) {
      return { namespace: segments[sqlIdx + 1], database: segments[sqlIdx + 2] };
    }
    return {};
  } catch {
    return {};
  }
}

/** Return the base /sql URL with any namespace/database tail or query removed. */
function stripSurrealTarget(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.search = "";
    const segments = u.pathname.split("/").filter(Boolean);
    const sqlIdx = segments.indexOf("sql");
    if (sqlIdx >= 0) {
      u.pathname = "/" + segments.slice(0, sqlIdx + 1).join("/");
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

/** No-op embedder: standalone deployments without an embedding model run lexical retrieval. */
const noopEmbedder: EmbeddingPort = {
  embedQuery: async () => [] as number[],
};

export interface GraphRuntime {
  adapter: GraphStoreAdapter;
  orchestrator: RetrievalOrchestrator;
  retrievalConfig: RetrievalConfig;
  store: GraphStore;
}

/**
 * Build the adapter + orchestrator + deps from config.
 * `embedder` is optional so a programmatic host can inject a real one.
 */
export function buildGraphRuntime(
  config: ServerConfig,
  embedder: EmbeddingPort = noopEmbedder,
): GraphRuntime {
  const retrievalConfig = philosophyRetrievalConfig;
  const edgeTables = defaultEdgeTables(retrievalConfig);

  const connectionConfig: GraphStoreConnectionConfig = {
    type: config.graphStoreType,
    schemaMode: "fresh",
    credentials: config.graphStoreCreds,
  };

  let store: GraphStore;
  const factoryDeps: AdapterFactoryDeps = { defaultEdgeTables: edgeTables };
  if (config.graphStoreType === "surrealdb") {
    store = new SurrealHttpGraphStore(config.graphStoreUrl, config.graphStoreCreds);
    factoryDeps.surrealStore = store;
  } else {
    // Neo4j: the factory builds its own driver from config at connect().
    // We still need a GraphStore for the orchestrator's path/neighbour queries,
    // which speak SurrealQL — Neo4j path queries route through the adapter instead.
    store = new SurrealHttpGraphStore(config.graphStoreUrl, config.graphStoreCreds);
  }

  const adapter = createGraphStoreAdapter(connectionConfig, factoryDeps);

  const deps: GraphRagDeps = {
    store,
    embedder,
    resolveOriginBucket: () => "other",
  };

  const orchestrator = new RetrievalOrchestrator(retrievalConfig, deps);

  return { adapter, orchestrator, retrievalConfig, store };
}

export { SurrealHttpGraphStore, GraphStoreUnavailableError };

/**
 * AdapterFactory — resolves the correct {@link GraphStoreAdapter} for a workspace
 * from its stored {@link GraphStoreConnectionConfig}, defaulting to SurrealDB when
 * no config is present (NULL `graph_store_config` column → existing-workspace
 * behaviour, see risk 3 in docs/requirements/graph_store_adapter_architecture.md).
 *
 * graphrag-core ships no database driver. SurrealDB retrieval/ingest speaks over a
 * host-built {@link GraphStore} (e.g. the dashboard's SurrealHttpGraphStore over the
 * BYO Surreal HTTP /sql API), so the host injects that store via {@link AdapterFactoryDeps}.
 * The doc's idealised `new SurrealDBAdapter(config)` is reconciled here: the factory
 * reads the *type* from config and wires the host-provided driver bits.
 *
 * Foundation introduced in Build 1C; Neo4j added in Multi-DB Sprint 1 (Build 2A); Weaviate in
 * Sprint 2 (Build 5A). SurrealDB, Neo4j, and Weaviate are implemented; Neptune / ArangoDB resolve
 * to a clear {@link GraphStoreAdapterNotImplementedError} until their adapters land.
 */
import type { GraphStore } from "../ports.js";
import {
  type GraphStoreAdapter,
  type GraphStoreAdapterType,
  type GraphStoreConnectionConfig,
} from "./GraphStoreAdapter.js";
import { SurrealDBAdapter } from "./surrealdb/SurrealDBAdapter.js";
import { Neo4jAdapter, type Neo4jDriverLike } from "./neo4j/Neo4jAdapter.js";
import type { Neo4jSchemaOptions } from "./neo4j/neo4j-schema.js";
import { WeaviateAdapter, type WeaviateClientLike } from "./weaviate/WeaviateAdapter.js";

/** Thrown when a config selects an adapter type whose implementation has not shipped yet. */
export class GraphStoreAdapterNotImplementedError extends Error {
  readonly adapterType: GraphStoreAdapterType;
  constructor(adapterType: GraphStoreAdapterType) {
    super(
      `GraphStoreAdapter "${adapterType}" is not implemented yet. SurrealDB, Neo4j, and Weaviate ` +
        `are available; ${adapterType} lands in a later multi-DB sprint.`,
    );
    this.name = "GraphStoreAdapterNotImplementedError";
    this.adapterType = adapterType;
  }
}

/**
 * Host-supplied driver bits the factory needs to construct driver-backed adapters.
 * Each field is consumed only by the adapter that needs it (SurrealDB → `surrealStore`,
 * Neo4j → `neo4jDriver`; when omitted the Neo4j adapter builds its own from config at connect()).
 */
export interface AdapterFactoryDeps {
  /** Ready-to-use GraphStore backing the SurrealDB adapter (graphrag-core has no driver). */
  surrealStore?: GraphStore;
  /** Edge tables to traverse when a query does not specify edgeTypes (SurrealDB). */
  defaultEdgeTables?: string[];
  /** Node table name (SurrealDB; defaults to "claim"). */
  nodeTable?: string;
  /** Optional pre-built Neo4j driver (tests / hosts that own the driver lifecycle). */
  neo4jDriver?: Neo4jDriverLike;
  /** Optional Neo4j schema options (node label, embedding dimensions). */
  neo4jSchema?: Neo4jSchemaOptions;
  /** Host-provided Weaviate client shim (graphrag-core ships no Weaviate driver). */
  weaviateClient?: WeaviateClientLike;
  /** Weaviate collection name prefix (node = `<prefix>Claim`, edges = `<prefix>Edge`). */
  weaviateCollectionPrefix?: string;
  /** Embedding dimensions used when provisioning a fresh Weaviate collection. */
  weaviateEmbeddingDimensions?: number;
}

/** The default config applied when a workspace has no explicit `graph_store_config`. */
export const DEFAULT_GRAPH_STORE_CONFIG: GraphStoreConnectionConfig = {
  type: "surrealdb",
  schemaMode: "fresh",
  credentials: {},
};

/** Normalise a (possibly null) stored config into a concrete config, defaulting to SurrealDB. */
export function normalizeGraphStoreConfig(
  config: GraphStoreConnectionConfig | null | undefined,
): GraphStoreConnectionConfig {
  return config ?? { ...DEFAULT_GRAPH_STORE_CONFIG };
}

/** Resolve which adapter type a (possibly null) config selects. NULL → SurrealDB. */
export function resolveGraphStoreAdapterType(
  config: GraphStoreConnectionConfig | null | undefined,
): GraphStoreAdapterType {
  return config?.type ?? DEFAULT_GRAPH_STORE_CONFIG.type;
}

/**
 * Construct the adapter selected by `config`, defaulting to SurrealDB when `config`
 * is null/undefined. `deps` supplies the host-built driver bits each adapter needs.
 *
 * @throws {GraphStoreAdapterNotImplementedError} when the config selects an
 *         adapter type that has not been built yet.
 * @throws {Error} when the resolved adapter is SurrealDB but no `surrealStore` was provided.
 */
export function createGraphStoreAdapter(
  config: GraphStoreConnectionConfig | null | undefined,
  deps: AdapterFactoryDeps,
): GraphStoreAdapter {
  const type = resolveGraphStoreAdapterType(config);
  switch (type) {
    case "surrealdb": {
      if (!deps.surrealStore) {
        throw new Error(
          "createGraphStoreAdapter: SurrealDBAdapter requires a host-provided GraphStore " +
            "(deps.surrealStore). graphrag-core ships no database driver.",
        );
      }
      return new SurrealDBAdapter({
        store: deps.surrealStore,
        defaultEdgeTables: deps.defaultEdgeTables,
        nodeTable: deps.nodeTable,
      });
    }
    case "neo4j":
      return new Neo4jAdapter({
        ...(deps.neo4jDriver ? { driver: deps.neo4jDriver } : {}),
        ...(deps.neo4jSchema ? { schema: deps.neo4jSchema } : {}),
      });
    case "weaviate":
      return new WeaviateAdapter({
        ...(deps.weaviateClient ? { client: deps.weaviateClient } : {}),
        ...(deps.weaviateCollectionPrefix !== undefined ? { collectionPrefix: deps.weaviateCollectionPrefix } : {}),
        ...(deps.weaviateEmbeddingDimensions !== undefined ? { embeddingDimensions: deps.weaviateEmbeddingDimensions } : {}),
      });
    case "neptune":
    case "arangodb":
      throw new GraphStoreAdapterNotImplementedError(type);
    default: {
      // Exhaustiveness guard: a new GraphStoreAdapterType must be handled above.
      const exhaustive: never = type;
      throw new Error(`Unsupported graph store: ${String(exhaustive)}`);
    }
  }
}

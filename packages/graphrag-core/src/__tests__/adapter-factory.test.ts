import { describe, expect, it } from "vitest";
import type { GraphStore } from "../ports.js";
import {
  createGraphStoreAdapter,
  resolveGraphStoreAdapterType,
  normalizeGraphStoreConfig,
  GraphStoreAdapterNotImplementedError,
  DEFAULT_GRAPH_STORE_CONFIG,
} from "../adapters/AdapterFactory.js";
import { SurrealDBAdapter } from "../adapters/surrealdb/SurrealDBAdapter.js";
import { Neo4jAdapter, type Neo4jDriverLike } from "../adapters/neo4j/Neo4jAdapter.js";
import type { GraphStoreConnectionConfig } from "../adapters/GraphStoreAdapter.js";

const fakeNeo4jDriver: Neo4jDriverLike = {
  session() {
    return {
      async run() {
        return { records: [] };
      },
      async close() {},
    };
  },
  async close() {},
};

const fakeStore: GraphStore = {
  async query<T>(): Promise<T> {
    return [] as T;
  },
  isDatabaseUnavailable() {
    return false;
  },
};

describe("AdapterFactory", () => {
  describe("resolveGraphStoreAdapterType", () => {
    it("defaults to surrealdb when config is null", () => {
      expect(resolveGraphStoreAdapterType(null)).toBe("surrealdb");
      expect(resolveGraphStoreAdapterType(undefined)).toBe("surrealdb");
    });

    it("returns the configured type", () => {
      const config: GraphStoreConnectionConfig = {
        type: "neo4j",
        schemaMode: "fresh",
        credentials: {},
      };
      expect(resolveGraphStoreAdapterType(config)).toBe("neo4j");
    });
  });

  describe("normalizeGraphStoreConfig", () => {
    it("returns the SurrealDB default for null/undefined", () => {
      expect(normalizeGraphStoreConfig(null)).toEqual(DEFAULT_GRAPH_STORE_CONFIG);
      expect(normalizeGraphStoreConfig(undefined)).toEqual(DEFAULT_GRAPH_STORE_CONFIG);
    });

    it("passes through an explicit config unchanged", () => {
      const config: GraphStoreConnectionConfig = {
        type: "surrealdb",
        schemaMode: "existing",
        credentials: { username: "root" },
        namespace: "ns",
        database: "db",
      };
      expect(normalizeGraphStoreConfig(config)).toBe(config);
    });
  });

  describe("createGraphStoreAdapter", () => {
    it("builds a SurrealDBAdapter when no config is present (default)", () => {
      const adapter = createGraphStoreAdapter(null, { surrealStore: fakeStore });
      expect(adapter).toBeInstanceOf(SurrealDBAdapter);
      expect(adapter.adapterType).toBe("surrealdb");
    });

    it("builds a SurrealDBAdapter for an explicit surrealdb config", () => {
      const config: GraphStoreConnectionConfig = {
        type: "surrealdb",
        schemaMode: "fresh",
        credentials: {},
      };
      const adapter = createGraphStoreAdapter(config, {
        surrealStore: fakeStore,
        defaultEdgeTables: ["supports"],
        nodeTable: "claim",
      });
      expect(adapter).toBeInstanceOf(SurrealDBAdapter);
    });

    it("throws when SurrealDB is selected but no store is provided", () => {
      expect(() => createGraphStoreAdapter(null, {})).toThrow(/requires a host-provided GraphStore/);
    });

    it("builds a Neo4jAdapter for a neo4j config", () => {
      const config: GraphStoreConnectionConfig = {
        type: "neo4j",
        connectionString: "bolt://localhost:7687",
        schemaMode: "fresh",
        credentials: { username: "neo4j", password: "x" },
      };
      const adapter = createGraphStoreAdapter(config, { neo4jDriver: fakeNeo4jDriver });
      expect(adapter).toBeInstanceOf(Neo4jAdapter);
      expect(adapter.adapterType).toBe("neo4j");
    });

    it("throws GraphStoreAdapterNotImplementedError for not-yet-built adapters", () => {
      for (const type of ["weaviate", "neptune", "arangodb"] as const) {
        const config: GraphStoreConnectionConfig = { type, schemaMode: "fresh", credentials: {} };
        expect(() => createGraphStoreAdapter(config, { surrealStore: fakeStore })).toThrow(
          GraphStoreAdapterNotImplementedError,
        );
      }
    });
  });
});

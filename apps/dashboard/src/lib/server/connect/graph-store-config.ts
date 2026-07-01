/**
 * Multi-database graph store config (Build 2A; Weaviate added in Sprint 2 / Build 5A) persisted to
 * workspaces.graph_store_config (the JSONB column added in 1C migration 051). Holds the workspace's
 * selected GraphStoreAdapter type + connection details; the secret is encrypted at rest with the
 * existing provider-credential pattern and never echoed back.
 *
 * SurrealDB continues to use the dedicated graph-target flow (graph-target-service); this module
 * covers the driver-backed adapters — Neo4j and Weaviate.
 */
import { Neo4jAdapter, type GraphStoreHealthResult } from "@restormel/graphrag-core";
import { getSql } from "$lib/server/neon";
import {
  encryptProviderSecret,
  decryptProviderSecret,
  type EncryptedCredentialPayload,
} from "$lib/server/credential-crypto";

export type GraphStoreConfigType = "neo4j" | "weaviate";

/** Shape persisted in the JSONB column. The password/API key lives only in `secret_enc`. */
interface StoredNeo4jConfig {
  type: "neo4j";
  connection_string: string;
  database: string;
  username: string;
  secret_enc?: EncryptedCredentialPayload | null;
  updated_at: number;
}
interface StoredWeaviateConfig {
  type: "weaviate";
  endpoint: string;
  collection_prefix: string;
  secret_enc?: EncryptedCredentialPayload | null;
  updated_at: number;
}
type StoredGraphStoreConfig = StoredNeo4jConfig | StoredWeaviateConfig;

/** Redacted view returned to the UI — no secret material. */
export interface GraphStoreConfigUiView {
  type: GraphStoreConfigType;
  // Neo4j
  connection_string?: string;
  database?: string;
  username?: string;
  // Weaviate
  endpoint?: string;
  collection_prefix?: string;
  secret_set: boolean;
  updated_at: number;
}

export type GraphStoreConfigUpsert =
  | { type: "neo4j"; connectionString: string; database?: string; username?: string; password?: string }
  | { type: "weaviate"; endpoint: string; collectionPrefix?: string; password?: string };

function parseStored(raw: unknown): StoredGraphStoreConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const secret_enc = (rec.secret_enc ?? null) as EncryptedCredentialPayload | null;
  const updated_at = Number(rec.updated_at ?? 0);
  if (rec.type === "neo4j") {
    return {
      type: "neo4j",
      connection_string: String(rec.connection_string ?? ""),
      database: String(rec.database ?? "neo4j"),
      username: String(rec.username ?? "neo4j"),
      secret_enc,
      updated_at,
    };
  }
  if (rec.type === "weaviate") {
    return {
      type: "weaviate",
      endpoint: String(rec.endpoint ?? ""),
      collection_prefix: String(rec.collection_prefix ?? ""),
      secret_enc,
      updated_at,
    };
  }
  return null;
}

async function readStored(workspaceId: string): Promise<StoredGraphStoreConfig | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT graph_store_config AS config FROM workspaces WHERE id = ${workspaceId} LIMIT 1
  `;
  return parseStored((rows as { config?: unknown }[])[0]?.config);
}

export async function getWorkspaceGraphStoreConfigForUi(
  workspaceId: string,
): Promise<GraphStoreConfigUiView | null> {
  const stored = await readStored(workspaceId);
  if (!stored) return null;
  if (stored.type === "neo4j") {
    return {
      type: "neo4j",
      connection_string: stored.connection_string,
      database: stored.database,
      username: stored.username,
      secret_set: Boolean(stored.secret_enc),
      updated_at: stored.updated_at,
    };
  }
  return {
    type: "weaviate",
    endpoint: stored.endpoint,
    collection_prefix: stored.collection_prefix,
    secret_set: Boolean(stored.secret_enc),
    updated_at: stored.updated_at,
  };
}

export async function saveWorkspaceGraphStoreConfig(
  workspaceId: string,
  input: GraphStoreConfigUpsert,
): Promise<{ ok: true } | { ok: false; status: number; error: string; message: string }> {
  const existing = await readStored(workspaceId);

  // Keep an existing secret only when the saved config is the same adapter type.
  let secret_enc = existing?.type === input.type ? existing.secret_enc ?? null : null;
  if (input.password && input.password.trim()) {
    const enc = encryptProviderSecret(input.password.trim());
    if (!enc.ok) {
      return { ok: false, status: 500, error: "encryption_unavailable", message: enc.error };
    }
    secret_enc = enc.payload;
  }

  const stored: StoredGraphStoreConfig =
    input.type === "neo4j"
      ? {
          type: "neo4j",
          connection_string: input.connectionString.trim(),
          database: (input.database ?? "neo4j").trim() || "neo4j",
          username: (input.username ?? "neo4j").trim() || "neo4j",
          secret_enc,
          updated_at: Date.now(),
        }
      : {
          type: "weaviate",
          endpoint: input.endpoint.trim().replace(/\/$/, ""),
          collection_prefix: (input.collectionPrefix ?? "").trim(),
          secret_enc,
          updated_at: Date.now(),
        };

  const sql = getSql();
  await sql`
    UPDATE workspaces SET graph_store_config = ${JSON.stringify(stored)}::jsonb WHERE id = ${workspaceId}
  `;
  return { ok: true };
}

export async function clearWorkspaceGraphStoreConfig(workspaceId: string): Promise<void> {
  const sql = getSql();
  await sql`UPDATE workspaces SET graph_store_config = NULL WHERE id = ${workspaceId}`;
}

function decryptStoredSecret(stored: StoredGraphStoreConfig): string | null {
  if (!stored.secret_enc) return null;
  const dec = decryptProviderSecret({
    credentialCiphertext: stored.secret_enc.ciphertextB64,
    credentialIv: stored.secret_enc.ivB64,
    credentialAuthTag: stored.secret_enc.authTagB64,
    encryptionVersion: stored.secret_enc.encryptionVersion,
  });
  return dec.ok ? dec.secret : null;
}

/** Build the adapter for the workspace's saved config + run healthCheck. */
export async function testSavedGraphStoreConfig(workspaceId: string): Promise<GraphStoreHealthResult> {
  const stored = await readStored(workspaceId);
  if (!stored) return { ok: false, error: "No graph store config saved for this workspace." };
  const secret = decryptStoredSecret(stored) ?? "";
  if (stored.type === "weaviate") {
    return runWeaviateHealthCheck({ endpoint: stored.endpoint, apiKey: secret });
  }
  return runNeo4jHealthCheck({
    connectionString: stored.connection_string,
    database: stored.database,
    username: stored.username,
    password: secret,
  });
}

/** Test a draft config (form values) without persisting. Falls back to the saved secret when asked. */
export async function testGraphStoreConfigDraft(
  workspaceId: string,
  draft:
    | { type?: "neo4j"; connectionString: string; database?: string; username?: string; password?: string; useSavedSecret?: boolean }
    | { type: "weaviate"; endpoint: string; password?: string; useSavedSecret?: boolean },
): Promise<GraphStoreHealthResult> {
  let secret = draft.password?.trim() ?? "";
  if (!secret && draft.useSavedSecret) {
    const stored = await readStored(workspaceId);
    secret = (stored && decryptStoredSecret(stored)) || "";
  }
  if ("endpoint" in draft) {
    return runWeaviateHealthCheck({ endpoint: draft.endpoint.trim(), apiKey: secret });
  }
  return runNeo4jHealthCheck({
    connectionString: draft.connectionString.trim(),
    database: (draft.database ?? "neo4j").trim() || "neo4j",
    username: (draft.username ?? "neo4j").trim() || "neo4j",
    password: secret,
  });
}

/**
 * Read-only node-count probe of the workspace's saved Neo4j store (RES-113 PR-K /
 * REC-ADR-017 §2). Connects the proven Neo4jAdapter and reads `discoverSchema()`'s
 * estimated node count — a `MATCH (c:Claim) RETURN count(c)` read; no writes, no
 * DDL. Returns null count when no Neo4j config is saved. ENV-PENDING: verified
 * against a live Neo4j only on the integration environment.
 */
export async function probeSavedNeo4jNodeCount(
  workspaceId: string,
): Promise<{ ok: true; nodeCount: number } | { ok: false; error: string }> {
  const stored = await readStored(workspaceId);
  if (!stored || stored.type !== "neo4j") {
    return { ok: false, error: "No Neo4j store is configured for this workspace." };
  }
  const secret = decryptStoredSecret(stored) ?? "";
  const adapter = new Neo4jAdapter();
  try {
    await adapter.connect({
      type: "neo4j",
      connectionString: stored.connection_string,
      database: stored.database,
      credentials: { username: stored.username, password: secret },
      schemaMode: "fresh",
    });
    const discovered = await adapter.discoverSchema();
    return { ok: true, nodeCount: discovered.estimatedNodeCount };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Probe failed." };
  } finally {
    await adapter.disconnect().catch(() => undefined);
  }
}

async function runNeo4jHealthCheck(args: {
  connectionString: string;
  database: string;
  username: string;
  password: string;
}): Promise<GraphStoreHealthResult> {
  const adapter = new Neo4jAdapter();
  try {
    await adapter.connect({
      type: "neo4j",
      connectionString: args.connectionString,
      database: args.database,
      credentials: { username: args.username, password: args.password },
      schemaMode: "fresh",
    });
    return await adapter.healthCheck();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Connection failed." };
  } finally {
    await adapter.disconnect().catch(() => undefined);
  }
}

/**
 * Weaviate readiness probe. graphrag-core ships no Weaviate driver, so rather than build a full
 * client shim just to test connectivity, hit Weaviate's standard readiness endpoint
 * (GET /v1/.well-known/ready) with the API key. A 200 means the instance is reachable and ready.
 */
async function runWeaviateHealthCheck(args: { endpoint: string; apiKey: string }): Promise<GraphStoreHealthResult> {
  const started = Date.now();
  const base = args.endpoint.trim().replace(/\/$/, "");
  if (!base) return { ok: false, error: "Weaviate endpoint is required." };
  try {
    const res = await fetch(`${base}/v1/.well-known/ready`, {
      headers: args.apiKey ? { Authorization: `Bearer ${args.apiKey}` } : {},
    });
    return res.ok
      ? { ok: true, latencyMs: Date.now() - started }
      : { ok: false, latencyMs: Date.now() - started, error: `Weaviate readiness check returned HTTP ${res.status}.` };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : "Connection failed." };
  }
}

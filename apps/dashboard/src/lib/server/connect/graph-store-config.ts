/**
 * Multi-database graph store config (Build 2A) persisted to workspaces.graph_store_config
 * (the JSONB column added in 1C migration 051). Holds the workspace's selected
 * GraphStoreAdapter type + connection details; the secret is encrypted at rest with
 * the existing provider-credential pattern and never echoed back.
 *
 * SurrealDB continues to use the dedicated graph-target flow (graph-target-service);
 * this module covers the new adapters — Neo4j today.
 */
import { Neo4jAdapter, type GraphStoreHealthResult } from "@restormel/graphrag-core";
import { getSql } from "$lib/server/neon";
import {
  encryptProviderSecret,
  decryptProviderSecret,
  type EncryptedCredentialPayload,
} from "$lib/server/credential-crypto";

export type GraphStoreConfigType = "neo4j";

/** Shape persisted in the JSONB column. The password lives only in `secret_enc`. */
interface StoredGraphStoreConfig {
  type: GraphStoreConfigType;
  connection_string: string;
  database: string;
  username: string;
  secret_enc?: EncryptedCredentialPayload | null;
  updated_at: number;
}

/** Redacted view returned to the UI — no secret material. */
export interface GraphStoreConfigUiView {
  type: GraphStoreConfigType;
  connection_string: string;
  database: string;
  username: string;
  secret_set: boolean;
  updated_at: number;
}

export interface GraphStoreConfigUpsert {
  type: GraphStoreConfigType;
  connectionString: string;
  database?: string;
  username?: string;
  /** Plaintext password/token; omit to keep an existing saved secret. */
  password?: string;
}

function parseStored(raw: unknown): StoredGraphStoreConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (rec.type !== "neo4j") return null;
  return {
    type: "neo4j",
    connection_string: String(rec.connection_string ?? ""),
    database: String(rec.database ?? "neo4j"),
    username: String(rec.username ?? "neo4j"),
    secret_enc: (rec.secret_enc ?? null) as EncryptedCredentialPayload | null,
    updated_at: Number(rec.updated_at ?? 0),
  };
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
  return {
    type: stored.type,
    connection_string: stored.connection_string,
    database: stored.database,
    username: stored.username,
    secret_set: Boolean(stored.secret_enc),
    updated_at: stored.updated_at,
  };
}

export async function saveWorkspaceGraphStoreConfig(
  workspaceId: string,
  input: GraphStoreConfigUpsert,
): Promise<{ ok: true } | { ok: false; status: number; error: string; message: string }> {
  const existing = await readStored(workspaceId);

  let secret_enc = existing?.secret_enc ?? null;
  if (input.password && input.password.trim()) {
    const enc = encryptProviderSecret(input.password.trim());
    if (!enc.ok) {
      return { ok: false, status: 500, error: "encryption_unavailable", message: enc.error };
    }
    secret_enc = enc.payload;
  }

  const stored: StoredGraphStoreConfig = {
    type: input.type,
    connection_string: input.connectionString.trim(),
    database: (input.database ?? "neo4j").trim() || "neo4j",
    username: (input.username ?? "neo4j").trim() || "neo4j",
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
  const password = decryptStoredSecret(stored) ?? "";
  return runNeo4jHealthCheck({
    connectionString: stored.connection_string,
    database: stored.database,
    username: stored.username,
    password,
  });
}

/** Test a draft config (form values) without persisting. Falls back to the saved secret when asked. */
export async function testGraphStoreConfigDraft(
  workspaceId: string,
  draft: { connectionString: string; database?: string; username?: string; password?: string; useSavedSecret?: boolean },
): Promise<GraphStoreHealthResult> {
  let password = draft.password?.trim() ?? "";
  if (!password && draft.useSavedSecret) {
    const stored = await readStored(workspaceId);
    password = (stored && decryptStoredSecret(stored)) || "";
  }
  return runNeo4jHealthCheck({
    connectionString: draft.connectionString.trim(),
    database: (draft.database ?? "neo4j").trim() || "neo4j",
    username: (draft.username ?? "neo4j").trim() || "neo4j",
    password,
  });
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

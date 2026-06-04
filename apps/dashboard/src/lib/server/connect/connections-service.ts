/**
 * Cloud connector connections: create/list (encrypted secrets), build a live
 * SourceConnector (refreshing OAuth tokens as needed), browse, and import
 * selected documents into the normalized source-documents store.
 */
import { randomUUID } from "node:crypto";
import { chunkDocument, type SourceConnector, type SourceDocRef } from "@restormel/connect-core";
import type {
  ConnectS3ConnectionCreate,
  ConnectSourceConnection,
  ConnectSourceDocument,
} from "@restormel/contracts/connect";
import {
  decryptProviderSecret,
  encryptProviderSecret,
  isCredentialEncryptionConfigured,
} from "$lib/server/credential-crypto";
import {
  deleteConnectSourceConnection,
  getConnectSourceConnection,
  insertConnectSourceConnection,
  insertConnectSourceDocument,
  listConnectSourceConnections,
  updateConnectSourceConnection,
  type ConnectSourceConnectionRecord,
} from "$lib/server/neon";
import { pickParser } from "$lib/server/connect/parsers";
import { sourceDocumentRecordToApi } from "$lib/server/connect/source-documents";
import { buildS3Connector, type S3Config } from "$lib/server/connect/connectors/s3";
import { buildGoogleDriveConnector } from "$lib/server/connect/connectors/google-drive";
import { buildMicrosoftConnector } from "$lib/server/connect/connectors/microsoft";
import { googleRefresh, microsoftRefresh } from "$lib/server/connect/connectors/oauth";

export class ConnectionConfigError extends Error {}

function encryptOrThrow(plaintext: string): { ciphertext: string; iv: string; authTag: string; encryptionVersion: number } {
  if (!isCredentialEncryptionConfigured()) {
    throw new ConnectionConfigError("RESTORMEL_CREDENTIALS_ENCRYPTION_KEY is not configured.");
  }
  const enc = encryptProviderSecret(plaintext);
  if (!enc.ok) throw new ConnectionConfigError(enc.error);
  return {
    ciphertext: enc.payload.ciphertextB64,
    iv: enc.payload.ivB64,
    authTag: enc.payload.authTagB64,
    encryptionVersion: enc.payload.encryptionVersion,
  };
}

function decryptSecret(record: ConnectSourceConnectionRecord): string | null {
  if (!record.secretCiphertext) return null;
  const res = decryptProviderSecret({
    credentialCiphertext: record.secretCiphertext,
    credentialIv: record.secretIv,
    credentialAuthTag: record.secretAuthTag,
    encryptionVersion: record.secretEncryptionVersion,
  });
  return res.ok ? res.secret : null;
}

export function connectionRecordToApi(record: ConnectSourceConnectionRecord): ConnectSourceConnection {
  const provider = (["s3", "google_drive", "sharepoint"] as const).includes(record.provider as never)
    ? (record.provider as ConnectSourceConnection["provider"])
    : "s3";
  const status = (["connected", "needs_auth", "error"] as const).includes(record.status as never)
    ? (record.status as ConnectSourceConnection["status"])
    : "error";
  return {
    id: record.id,
    workspace_id: record.workspaceId,
    provider,
    ...(record.label ? { label: record.label } : {}),
    config: (record.config && typeof record.config === "object" ? (record.config as Record<string, unknown>) : {}),
    secret_set: Boolean(record.secretCiphertext),
    status,
    created_at: new Date(record.createdAt).toISOString(),
    updated_at: new Date(record.updatedAt).toISOString(),
  };
}

export async function listConnections(workspaceId: string): Promise<ConnectSourceConnection[]> {
  const rows = await listConnectSourceConnections(workspaceId);
  return rows.map(connectionRecordToApi);
}

export async function createS3Connection(
  workspaceId: string,
  input: ConnectS3ConnectionCreate,
): Promise<ConnectSourceConnection> {
  const secret = encryptOrThrow(input.secret_access_key);
  const record = await insertConnectSourceConnection({
    id: randomUUID(),
    workspaceId,
    provider: "s3",
    label: input.label ?? `S3 · ${input.bucket}`,
    config: {
      region: input.region,
      bucket: input.bucket,
      ...(input.prefix ? { prefix: input.prefix } : {}),
      ...(input.endpoint ? { endpoint: input.endpoint } : {}),
      access_key_id: input.access_key_id,
    },
    status: "connected",
    secret,
  });
  return connectionRecordToApi(record);
}

export async function removeConnection(workspaceId: string, id: string): Promise<void> {
  await deleteConnectSourceConnection({ id, workspaceId });
}

/** Persist an OAuth connection (Google Drive / SharePoint) from a refresh token. */
export async function createOAuthConnection(args: {
  workspaceId: string;
  provider: "google_drive" | "sharepoint";
  label: string;
  refreshToken: string;
}): Promise<ConnectSourceConnection> {
  const secret = encryptOrThrow(args.refreshToken);
  const record = await insertConnectSourceConnection({
    id: randomUUID(),
    workspaceId: args.workspaceId,
    provider: args.provider,
    label: args.label,
    config: {},
    status: "connected",
    secret,
  });
  return connectionRecordToApi(record);
}

/** Build a live SourceConnector, refreshing OAuth tokens for cloud providers. */
async function buildConnector(record: ConnectSourceConnectionRecord): Promise<SourceConnector> {
  if (record.provider === "s3") {
    const secret = decryptSecret(record);
    if (!secret) throw new ConnectionConfigError("S3 secret could not be read.");
    const cfg = record.config as Record<string, unknown>;
    const s3: S3Config = {
      region: String(cfg.region ?? ""),
      bucket: String(cfg.bucket ?? ""),
      prefix: cfg.prefix ? String(cfg.prefix) : undefined,
      endpoint: cfg.endpoint ? String(cfg.endpoint) : undefined,
      accessKeyId: String(cfg.access_key_id ?? ""),
    };
    return buildS3Connector(s3, secret);
  }

  const refreshToken = decryptSecret(record);
  if (!refreshToken) {
    await updateConnectSourceConnection({ id: record.id, workspaceId: record.workspaceId, status: "needs_auth" });
    throw new ConnectionConfigError("This connection needs to be re-authorized.");
  }
  try {
    if (record.provider === "google_drive") {
      const tokens = await googleRefresh(refreshToken);
      return buildGoogleDriveConnector(tokens.access_token);
    }
    if (record.provider === "sharepoint") {
      const tokens = await microsoftRefresh(refreshToken);
      // Microsoft may rotate the refresh token; persist the new one.
      if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
        await updateConnectSourceConnection({
          id: record.id,
          workspaceId: record.workspaceId,
          secret: encryptOrThrow(tokens.refresh_token),
        });
      }
      return buildMicrosoftConnector(tokens.access_token);
    }
  } catch (e) {
    await updateConnectSourceConnection({ id: record.id, workspaceId: record.workspaceId, status: "needs_auth" });
    throw new ConnectionConfigError(e instanceof Error ? e.message : "Token refresh failed.");
  }
  throw new ConnectionConfigError(`Unsupported connector: ${record.provider}`);
}

export async function browseConnection(args: {
  workspaceId: string;
  connectionId: string;
  prefix?: string;
}): Promise<SourceDocRef[]> {
  const record = await getConnectSourceConnection({ id: args.connectionId, workspaceId: args.workspaceId });
  if (!record) throw new ConnectionConfigError("Connection not found.");
  const connector = await buildConnector(record);
  if (!connector.list) return [];
  return connector.list({ prefix: args.prefix });
}

export async function importDocuments(args: {
  workspaceId: string;
  connectionId: string;
  refs: SourceDocRef[];
}): Promise<ConnectSourceDocument[]> {
  const record = await getConnectSourceConnection({ id: args.connectionId, workspaceId: args.workspaceId });
  if (!record) throw new ConnectionConfigError("Connection not found.");
  const connector = await buildConnector(record);
  const parser = pickParser("builtin");
  const sourceKind = record.provider;

  const out: ConnectSourceDocument[] = [];
  for (const ref of args.refs.slice(0, 100)) {
    const id = randomUUID();
    try {
      const fetched = await connector.fetch(ref);
      const parsed = await parser.parse(fetched);
      const chunks = chunkDocument(parsed.markdown);
      const rec = await insertConnectSourceDocument({
        id,
        workspaceId: args.workspaceId,
        sourceKind,
        name: fetched.name || ref.name,
        mime: fetched.mime,
        url: ref.uri ?? null,
        text: parsed.markdown,
        charCount: parsed.markdown.length,
        chunkCount: chunks.length,
        status: "parsed",
        parserProvider: parser.id,
      });
      out.push(sourceDocumentRecordToApi(rec));
    } catch (e) {
      const message = e instanceof Error ? e.message : "import failed";
      const rec = await insertConnectSourceDocument({
        id,
        workspaceId: args.workspaceId,
        sourceKind,
        name: ref.name,
        url: ref.uri ?? null,
        charCount: 0,
        chunkCount: 0,
        status: "failed",
        error: message.slice(0, 400),
      });
      out.push(sourceDocumentRecordToApi(rec));
    }
  }
  return out;
}

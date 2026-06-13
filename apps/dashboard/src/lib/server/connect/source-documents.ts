/**
 * Source-document service: add documents from URL or upload, parse them with the
 * pluggable parser, compute chunk counts (structure-aware), and persist normalized
 * text for later ingest jobs. Domain-agnostic and provider-pluggable.
 */
import { randomUUID } from "node:crypto";
import {
  BuiltinParseUnsupportedError,
  chunkDocument,
  type FetchedDocument,
} from "@restormel/connect-core";
import type {
  ConnectDomainPack,
  ConnectSourceDocument,
  ConnectSourceDocumentCreate,
  ConnectSourceProvenance,
} from "@restormel/contracts/connect";
import {
  parseStoredProvenance,
  provenancePreviewText,
  resolveDocumentDisplayName,
} from "$lib/server/connect/source-document-provenance";
import {
  deleteConnectSourceDocument,
  getConnectSourceDocumentsByIds,
  insertConnectSourceDocument,
  listConnectSourceDocumentsForWorkspace,
  type ConnectSourceDocumentRecord,
} from "$lib/server/neon";
import { pickParser } from "$lib/server/connect/parsers";

const MAX_FETCH_BYTES = 8_000_000;

export function sourceDocumentRecordToApi(row: ConnectSourceDocumentRecord): ConnectSourceDocument {
  const kind = (["upload", "url", "s3", "google_drive", "sharepoint"] as const).includes(
    row.sourceKind as never,
  )
    ? (row.sourceKind as ConnectSourceDocument["source_kind"])
    : "upload";
  const status = (["parsed", "failed", "pending"] as const).includes(row.status as never)
    ? (row.status as ConnectSourceDocument["status"])
    : "parsed";
  const provenance = parseStoredProvenance(row.provenance);
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    source_kind: kind,
    name: row.name,
    ...(row.mime ? { mime: row.mime } : {}),
    ...(row.url ? { url: row.url } : {}),
    ...(provenance ? { provenance } : {}),
    char_count: row.charCount,
    chunk_count: row.chunkCount,
    status,
    ...(row.error ? { error: row.error } : {}),
    ...(row.parserProvider ? { parser_provider: row.parserProvider } : {}),
    created_at: new Date(row.createdAt).toISOString(),
  };
}

export async function listSourceDocuments(workspaceId: string): Promise<ConnectSourceDocument[]> {
  const rows = await listConnectSourceDocumentsForWorkspace(workspaceId);
  return rows.map(sourceDocumentRecordToApi);
}

async function fetchUrlDocument(url: string): Promise<FetchedDocument> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Fetch failed (HTTP ${res.status}).`);
  const mime = (res.headers.get("content-type") ?? "text/html").split(";")[0].trim();
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_FETCH_BYTES) throw new Error("Document exceeds 8MB fetch limit.");
  const name = (() => {
    try {
      const u = new URL(url);
      const last = u.pathname.split("/").filter(Boolean).pop();
      return last || u.hostname;
    } catch {
      return url.slice(0, 120);
    }
  })();
  return { bytes: buf, mime, name };
}

function decodeUploadContent(input: ConnectSourceDocumentCreate): FetchedDocument {
  const content = input.content ?? "";
  const bytes =
    input.content_encoding === "base64"
      ? new Uint8Array(Buffer.from(content, "base64"))
      : new TextEncoder().encode(content);
  return { bytes, mime: input.mime ?? "text/plain", name: input.name ?? "upload.txt" };
}

function provenancePayload(input: ConnectSourceDocumentCreate): Record<string, unknown> | null {
  if (!input.provenance) return null;
  return { ...input.provenance };
}

export async function addSourceDocument(
  workspaceId: string,
  input: ConnectSourceDocumentCreate,
): Promise<ConnectSourceDocument> {
  const id = randomUUID();
  const sourceKind = input.kind;
  const provenance = input.provenance;
  let fetched: FetchedDocument;
  let url: string | null = null;
  try {
    if (input.kind === "url") {
      url = input.url ?? "";
      fetched = await fetchUrlDocument(url);
    } else {
      fetched = decodeUploadContent(input);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    const rec = await insertConnectSourceDocument({
      id,
      workspaceId,
      sourceKind,
      name: resolveDocumentDisplayName({
        fallbackName: input.name ?? url ?? "document",
        provenance,
        explicitName: input.name,
      }),
      url,
      charCount: 0,
      chunkCount: 0,
      status: "failed",
      error: message.slice(0, 400),
      provenance: provenancePayload(input),
    });
    return sourceDocumentRecordToApi(rec);
  }

  const parser = pickParser("builtin");
  const displayName = resolveDocumentDisplayName({
    fallbackName: fetched.name,
    provenance,
    explicitName: input.name,
  });
  try {
    const parsed = await parser.parse(fetched);
    const chunks = chunkDocument(parsed.markdown);
    const rec = await insertConnectSourceDocument({
      id,
      workspaceId,
      sourceKind,
      name: displayName,
      mime: fetched.mime,
      url,
      text: parsed.markdown,
      charCount: parsed.markdown.length,
      chunkCount: chunks.length,
      status: "parsed",
      parserProvider: parser.id,
      provenance: provenancePayload(input),
    });
    return sourceDocumentRecordToApi(rec);
  } catch (e) {
    const unsupported = e instanceof BuiltinParseUnsupportedError;
    const message = e instanceof Error ? e.message : "parse failed";
    const rec = await insertConnectSourceDocument({
      id,
      workspaceId,
      sourceKind,
      name: displayName,
      mime: fetched.mime,
      url,
      charCount: 0,
      chunkCount: 0,
      status: "failed",
      error: (unsupported ? message : `Parse failed: ${message}`).slice(0, 400),
      provenance: provenancePayload(input),
    });
    return sourceDocumentRecordToApi(rec);
  }
}

export async function removeSourceDocument(workspaceId: string, id: string): Promise<boolean> {
  return deleteConnectSourceDocument({ id, workspaceId });
}

/** Expand selected documents into ingest sources (text + title). Parsed docs only. */
export async function expandDocumentsToSources(
  workspaceId: string,
  ids: string[],
): Promise<
  { text: string; title: string; url?: string; provenance?: ConnectSourceProvenance }[]
> {
  const rows = await getConnectSourceDocumentsByIds({ ids, workspaceId });
  const out: { text: string; title: string; url?: string; provenance?: ConnectSourceProvenance }[] = [];
  // P2b: a doc whose cached text was cleared after a confirmed store read-back carries no
  // `text` but DOES carry `provenance.graph_source_key` (the Surreal source record id) — the
  // user's store is now authoritative. Resolve those from the store so a re-ingest still
  // works; lazily build the store only when such a doc appears.
  let storeResolution: { store: import("@restormel/graphrag-core").GraphStore; pack: ConnectDomainPack } | null = null;
  let storeResolutionTried = false;
  for (const r of rows) {
    if (r.status !== "parsed") continue;
    const provenance = parseStoredProvenance(r.provenance);
    const title = provenance?.title?.trim() || r.name;
    const url = provenance?.canonical_url ?? provenance?.url ?? r.url ?? undefined;

    let text = r.text && r.text.trim() ? r.text : null;
    if (!text && provenance?.graph_source_key?.trim()) {
      if (!storeResolutionTried) {
        storeResolutionTried = true;
        storeResolution = await buildStoreResolution(workspaceId).catch(() => null);
      }
      if (storeResolution) {
        const { fetchSurrealSourceRecordText } = await import(
          "$lib/server/connect/connect-source-text-resolve"
        );
        const fetched = await fetchSurrealSourceRecordText(
          storeResolution.store,
          provenance.graph_source_key,
          storeResolution.pack,
        ).catch(() => null);
        if (fetched?.fullText?.trim()) text = fetched.fullText;
      }
    }
    if (!text) continue;
    out.push({
      text,
      title,
      ...(url ? { url } : {}),
      ...(provenance ? { provenance } : {}),
    });
  }
  return out;
}

/** Build the store + pack needed to resolve P2b store-authoritative source text. */
async function buildStoreResolution(
  workspaceId: string,
): Promise<{ store: import("@restormel/graphrag-core").GraphStore; pack: ConnectDomainPack } | null> {
  const { getConnectGraphTargetForWorkspace } = await import("$lib/server/neon");
  const target = await getConnectGraphTargetForWorkspace(workspaceId);
  if (!target || target.provider !== "surreal") return null;
  const { buildWorkspaceGraphStore } = await import("$lib/server/connect/surreal-graph-store");
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return null;
  const { resolveWorkspaceDomainPack } = await import("$lib/server/connect/domain-pack-service");
  const pack = await resolveWorkspaceDomainPack(workspaceId, null);
  if (!pack) return null;
  return { store, pack };
}

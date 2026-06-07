/**
 * Resolve full or preview source text for graph unit review / re-validation.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { GraphStore } from "@restormel/graphrag-core";
import { surrealRecordRef } from "$lib/server/connect/graph-writer";
import {
  buildSourceSelectClause,
  extractSourcePreviewText,
  resolveSurrealSourceFullText,
} from "$lib/server/connect/surreal-source-text";
import { listConnectIngestJobsForWorkspace } from "$lib/server/neon";

export type ConnectSourceTextQuality = "full" | "preview" | "missing";

export function sourceTitlesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  return na === nb || na.includes(nb) || nb.includes(na);
}

function parseJobSources(raw: unknown): { title?: string; url?: string; text?: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        ...(typeof rec.title === "string" ? { title: rec.title } : {}),
        ...(typeof rec.url === "string" ? { url: rec.url } : {}),
        ...(typeof rec.text === "string" ? { text: rec.text } : {}),
      };
    });
}

export async function resolveConnectSourceText(args: {
  workspaceId: string;
  title: string | null;
  url: string | null;
  textPreview: string | null;
  surrealFullText?: string | null;
}): Promise<{ text: string; quality: ConnectSourceTextQuality }> {
  if (args.surrealFullText?.trim()) {
    return { text: args.surrealFullText.trim(), quality: "full" };
  }

  const jobs = await listConnectIngestJobsForWorkspace({ workspaceId: args.workspaceId, limit: 30 });
  for (const job of jobs) {
    for (const src of parseJobSources(job.sources)) {
      const titleMatch = sourceTitlesMatch(args.title, src.title ?? null);
      const urlMatch =
        args.url && src.url && src.url.trim().toLowerCase() === args.url.trim().toLowerCase();
      if ((titleMatch || urlMatch) && src.text?.trim()) {
        return { text: src.text.trim(), quality: "full" };
      }
    }
  }

  const { findConnectSourceDocumentText } = await import("$lib/server/neon");
  const docText = await findConnectSourceDocumentText({
    workspaceId: args.workspaceId,
    name: args.title,
    url: args.url,
  });
  if (docText?.trim()) return { text: docText.trim(), quality: "full" };

  if (args.textPreview?.trim()) {
    return { text: args.textPreview.trim(), quality: "preview" };
  }

  return { text: "", quality: "missing" };
}

export async function fetchSurrealSourceRecordText(
  store: GraphStore,
  sourceKey: string,
  pack: ConnectDomainPack,
): Promise<{
  title: string | null;
  url: string | null;
  textPreview: string | null;
  fullText: string | null;
}> {
  const empty = { title: null, url: null, textPreview: null, fullText: null };
  if (!sourceKey || sourceKey === "__unknown__" || !sourceKey.includes(":")) return empty;
  try {
    const select = buildSourceSelectClause(pack);
    const rows = await store.query<Record<string, unknown>[]>(
      `SELECT ${select} FROM ${surrealRecordRef(sourceKey)};`,
    );
    const row = rows[0];
    if (!row) return empty;

    const resolved = await resolveSurrealSourceFullText({
      store,
      pack,
      sourceRow: row,
      sourceId: sourceKey,
    });

    return {
      title: typeof row.title === "string" && row.title.trim() ? row.title.trim() : null,
      url: typeof row.url === "string" && row.url.trim() ? row.url.trim() : null,
      textPreview: extractSourcePreviewText(row),
      fullText: resolved.quality === "full" ? resolved.text : null,
    };
  } catch {
    return empty;
  }
}

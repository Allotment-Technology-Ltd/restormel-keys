/**
 * Resolve full source text from BYO Surreal graphs — inline on source records or
 * aggregated from linked passage rows (SOPHIA-style).
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { GraphStore } from "@restormel/graphrag-core";
import { surrealRecordRef } from "$lib/server/connect/graph-writer";

export const SOURCE_INLINE_TEXT_KEYS = [
  "text",
  "body",
  "content",
  "full_text",
  "raw_text",
  "document",
  "markdown",
] as const;

export const PASSAGE_TEXT_KEYS = ["text", "content", "body"] as const;

export type SurrealSourceTextOrigin = "inline" | "passage" | "preview_only" | "none";
export type SurrealSourceTextQuality = "full" | "preview" | "missing";

export type SurrealSourceTextResolution = {
  text: string;
  quality: SurrealSourceTextQuality;
  origin: SurrealSourceTextOrigin;
  passageCount?: number;
};

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const PASSAGE_ROW_LIMIT = 100;
const MAX_AGGREGATED_CHARS = 500_000;

function tableIdent(name: string, fallback: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENT.test(s) ? s : fallback;
}

function fieldIdent(name: string | null | undefined, fallback: string): string {
  return name && SAFE_IDENT.test(name) ? name : fallback;
}

function sourceIdPart(sourceId: string): string {
  return sourceId.includes(":") ? sourceId.split(":").slice(1).join(":") : sourceId;
}

function pickTextFromRow(
  row: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function extractInlineSourceText(
  row: Record<string, unknown>,
  configuredField?: string | null,
): string | null {
  if (configuredField) {
    const v = row[configuredField];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return pickTextFromRow(row, SOURCE_INLINE_TEXT_KEYS);
}

export function extractSourcePreviewText(row: Record<string, unknown>): string | null {
  const v = row.text_preview;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function capAggregatedText(parts: string[]): { text: string; count: number } {
  const out: string[] = [];
  let total = 0;
  for (const part of parts) {
    if (!part.trim()) continue;
    const next = total === 0 ? part : `\n\n${part}`;
    if (total + next.length > MAX_AGGREGATED_CHARS) break;
    out.push(part);
    total += next.length;
  }
  return { text: out.join("\n\n"), count: out.length };
}

export function buildSourceScanMeta(pack: ConnectDomainPack): {
  sourceTable: string;
  passageTable: string;
  inlineFields: string[];
  passageTextField: string;
  passageSourceField: string;
} {
  const schema = pack.graph_schema;
  const configuredInline = schema.source_text_field?.trim();
  return {
    sourceTable: tableIdent(schema.source_table, "source"),
    passageTable: tableIdent(schema.passage_table, "passage"),
    inlineFields: configuredInline
      ? [configuredInline, ...SOURCE_INLINE_TEXT_KEYS.filter((k) => k !== configuredInline)]
      : [...SOURCE_INLINE_TEXT_KEYS],
    passageTextField: fieldIdent(schema.passage_text_field, "text"),
    passageSourceField: fieldIdent(schema.passage_source_field, "source"),
  };
}

export function buildSourceSelectClause(pack: ConnectDomainPack): string {
  const meta = buildSourceScanMeta(pack);
  const fields = new Set([
    "id",
    "title",
    "url",
    "kind",
    "source_kind",
    "text_preview",
    ...meta.inlineFields,
  ]);
  return [...fields].join(", ");
}

/** SOPHIA-style graphs use order_in_source; Restormel ingest uses chunk_index. */
const PASSAGE_ORDER_CLAUSES = [
  "ORDER BY order_in_source ASC, id ASC",
  "ORDER BY chunk_index ASC, id ASC",
  "ORDER BY id ASC",
  "",
] as const;

type PassageQuerySpec = { sql: string; vars?: Record<string, unknown> };

function buildPassageTextQueries(args: {
  passageTable: string;
  passageTextField: string;
  passageSourceField: string;
  sourceTable: string;
  sourceId: string;
  sid: string;
}): PassageQuerySpec[] {
  const { passageTable, passageTextField, passageSourceField, sourceTable, sourceId, sid } = args;
  const recordRef = surrealRecordRef(sourceId);
  const specs: PassageQuerySpec[] = [];

  for (const orderClause of PASSAGE_ORDER_CLAUSES) {
    const orderSuffix = orderClause ? ` ${orderClause}` : "";
    const select = `SELECT ${passageTextField} AS text FROM ${passageTable} WHERE`;

    specs.push({
      sql: `${select} ${passageSourceField} = type::record('${sourceTable}', $sid)${orderSuffix} LIMIT ${PASSAGE_ROW_LIMIT};`,
      vars: { sid },
    });
    specs.push({
      sql: `${select} ${passageSourceField} = ${recordRef}${orderSuffix} LIMIT ${PASSAGE_ROW_LIMIT};`,
    });
    specs.push({
      sql: `${select} ${passageSourceField} = type::record($source_rid)${orderSuffix} LIMIT ${PASSAGE_ROW_LIMIT};`,
      vars: { source_rid: sourceId },
    });
  }

  return specs;
}

export async function fetchPassageTextForSource(
  store: GraphStore,
  pack: ConnectDomainPack,
  sourceId: string,
): Promise<{ text: string; passageCount: number } | null> {
  if (!sourceId || !sourceId.includes(":")) return null;

  const schema = pack.graph_schema;
  const sourceTable = tableIdent(schema.source_table, "source");
  const passageTable = tableIdent(schema.passage_table, "passage");
  const passageTextField = fieldIdent(schema.passage_text_field, "text");
  const passageSourceField = fieldIdent(schema.passage_source_field, "source");
  const sid = sourceIdPart(sourceId);

  const queries = buildPassageTextQueries({
    passageTable,
    passageTextField,
    passageSourceField,
    sourceTable,
    sourceId,
    sid,
  });

  for (const { sql, vars } of queries) {
    try {
      const rows = await store.query<{ text?: string }[]>(sql, vars);
      const parts = rows
        .map((r) => (typeof r.text === "string" ? r.text.trim() : ""))
        .filter(Boolean);
      if (parts.length === 0) continue;
      const { text, count } = capAggregatedText(parts);
      if (text) return { text, passageCount: count };
    } catch {
      // try next query shape (wrong ORDER BY field, record ref shape, etc.)
    }
  }
  return null;
}

export async function resolveSurrealSourceFullText(args: {
  store: GraphStore;
  pack: ConnectDomainPack;
  sourceRow?: Record<string, unknown>;
  sourceId?: string;
}): Promise<SurrealSourceTextResolution> {
  const configuredField = args.pack.graph_schema.source_text_field ?? null;
  let preview: string | null = null;

  if (args.sourceRow) {
    preview = extractSourcePreviewText(args.sourceRow);
    const inline = extractInlineSourceText(args.sourceRow, configuredField);
    if (inline) {
      return { text: inline, quality: "full", origin: "inline" };
    }
  }

  const sourceId =
    args.sourceId ??
    (args.sourceRow
      ? typeof args.sourceRow.id === "string"
        ? args.sourceRow.id
        : String(args.sourceRow.id ?? "")
      : "");
  if (sourceId && sourceId.includes(":")) {
    const passage = await fetchPassageTextForSource(args.store, args.pack, sourceId);
    if (passage?.text) {
      return {
        text: passage.text,
        quality: "full",
        origin: "passage",
        passageCount: passage.passageCount,
      };
    }
  }

  if (preview) {
    return { text: preview, quality: "preview", origin: "preview_only" };
  }

  return { text: "", quality: "missing", origin: "none" };
}

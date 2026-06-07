/**
 * Discover and import sources from a BYO graph store into the pipeline catalog.
 *
 * External graphs (not created by Restormel) often have source records with title/URL
 * but full text in a linked passage table. This module scans the SurrealDB source table,
 * resolves text inline or via passages, and imports into knowledge_source_documents
 * so that future re-validation passes can resolve source text without re-ingestion.
 */
import { randomUUID } from "node:crypto";
import {
  persistDomainPackSourceTextMapping,
  resolveWorkspaceDomainPack,
} from "./domain-pack-service";
import {
  isInvalidSourceTableMapping,
  isSourceTablePatchAllowed,
  probeSourceTextPackSuggestion,
  sourceTextPatchFromPack,
  type SourceTextPackSuggestion,
  type SourceTextSchemaPatch,
} from "./source-text-schema-probe";
import { buildWorkspaceGraphStore } from "./surreal-graph-store";
import {
  buildSourceScanMeta,
  buildSourceSelectClause,
  extractSourcePreviewText,
  resolveSurrealSourceFullText,
  type SurrealSourceTextOrigin,
} from "./surreal-source-text";
import {
  countGraphImportedCatalogSources,
  findConnectSourceDocumentText,
  getConnectGraphTargetForWorkspace,
  insertConnectSourceDocument,
} from "$lib/server/neon";

export type DiscoveredSource = {
  key: string;
  title: string | null;
  url: string | null;
  kind: string | null;
  hasFullText: boolean;
  hasPreviewText: boolean;
  textOrigin: SurrealSourceTextOrigin;
  passageCount?: number;
};

export type DiscoverSourcesScanMeta = {
  sourceTable: string;
  passageTable: string;
  inlineFields: string[];
  passageTextField: string;
  passageSourceField: string;
};

export type SourceTextMappingFields = SourceTextSchemaPatch;

export type DiscoverSourcesResult = {
  storeType: "surreal" | "postgres" | "none";
  sources: DiscoveredSource[];
  total: number;
  withText: number;
  withoutText: number;
  withPassageText: number;
  withInlineText: number;
  scanMeta?: DiscoverSourcesScanMeta;
  domainPackId?: string;
  packTitle?: string;
  packEditable?: boolean;
  currentMapping?: SourceTextMappingFields;
  packSuggestion?: SourceTextPackSuggestion | null;
  packSynced?: boolean;
  mappingInvalid?: boolean;
  pipelineCatalogCount?: number;
  importAlreadySatisfied?: boolean;
};

export type ImportSourcesResult = {
  imported: number;
  skipped: number;
  alreadyPresent: number;
  error?: string;
  message?: string;
};

const DISCOVER_CAP = 500;
const RESOLVE_BATCH = 20;

type RawSourceRow = Record<string, unknown>;

async function querySurrealSourceTable(
  store: Awaited<ReturnType<typeof buildWorkspaceGraphStore>>,
  pack: Awaited<ReturnType<typeof resolveWorkspaceDomainPack>>,
): Promise<RawSourceRow[]> {
  if (!store || !pack) return [];
  const sourceTable = pack.graph_schema.source_table.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const select = buildSourceSelectClause(pack);
  const q = `SELECT ${select} FROM ${sourceTable} LIMIT ${DISCOVER_CAP};`;
  try {
    return await store.query<RawSourceRow[]>(q);
  } catch {
    return [];
  }
}

async function resolveDiscoveredSource(
  store: NonNullable<Awaited<ReturnType<typeof buildWorkspaceGraphStore>>>,
  pack: NonNullable<Awaited<ReturnType<typeof resolveWorkspaceDomainPack>>>,
  row: RawSourceRow,
): Promise<DiscoveredSource> {
  const key = String(row.id ?? "");
  const previewText = extractSourcePreviewText(row);
  const kindRaw = row.kind ?? row.source_kind;
  const resolved = await resolveSurrealSourceFullText({
    store,
    pack,
    sourceRow: row,
    sourceId: key,
  });
  const hasFullText = resolved.quality === "full";

  return {
    key,
    title: typeof row.title === "string" && row.title.trim() ? row.title.trim() : null,
    url: typeof row.url === "string" && row.url.trim() ? row.url.trim() : null,
    kind: typeof kindRaw === "string" && kindRaw.trim() ? kindRaw.trim() : null,
    hasFullText,
    hasPreviewText: Boolean(previewText),
    textOrigin: resolved.origin,
    ...(resolved.passageCount != null ? { passageCount: resolved.passageCount } : {}),
  };
}

async function resolveSourcesInBatches(
  store: NonNullable<Awaited<ReturnType<typeof buildWorkspaceGraphStore>>>,
  pack: NonNullable<Awaited<ReturnType<typeof resolveWorkspaceDomainPack>>>,
  rows: RawSourceRow[],
): Promise<DiscoveredSource[]> {
  const sources: DiscoveredSource[] = [];
  for (let i = 0; i < rows.length; i += RESOLVE_BATCH) {
    const batch = rows.slice(i, i + RESOLVE_BATCH);
    const resolved = await Promise.all(batch.map((row) => resolveDiscoveredSource(store, pack, row)));
    sources.push(...resolved);
  }
  return sources;
}

async function runSourceDiscoveryScan(
  store: NonNullable<Awaited<ReturnType<typeof buildWorkspaceGraphStore>>>,
  pack: NonNullable<Awaited<ReturnType<typeof resolveWorkspaceDomainPack>>>,
): Promise<{
  sources: DiscoveredSource[];
  sourceRowCount: number;
  withText: number;
  withPassageText: number;
  withInlineText: number;
}> {
  const rows = await querySurrealSourceTable(store, pack);
  const sources = await resolveSourcesInBatches(store, pack, rows);
  const withText = sources.filter((s) => s.hasFullText).length;
  return {
    sources,
    sourceRowCount: rows.length,
    withText,
    withPassageText: sources.filter((s) => s.textOrigin === "passage").length,
    withInlineText: sources.filter((s) => s.textOrigin === "inline").length,
  };
}

export type DiscoverGraphSourcesOptions = {
  packId?: string | null;
  /** When true, apply a high-confidence pack patch and re-scan once. */
  autoSyncPack?: boolean;
};

export async function discoverGraphSources(
  workspaceId: string,
  options?: DiscoverGraphSourcesOptions,
): Promise<DiscoverSourcesResult> {
  const empty = {
    storeType: "none" as const,
    sources: [],
    total: 0,
    withText: 0,
    withoutText: 0,
    withPassageText: 0,
    withInlineText: 0,
  };

  const target = await getConnectGraphTargetForWorkspace(workspaceId);
  if (!target) return empty;

  if (target.provider !== "surreal") {
    return { ...empty, storeType: "postgres" };
  }

  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) {
    return { ...empty, storeType: "surreal" };
  }

  let pack = await resolveWorkspaceDomainPack(workspaceId, options?.packId);
  if (!pack) return { ...empty, storeType: "surreal" };

  let packSynced = false;
  let scan = await runSourceDiscoveryScan(store, pack);

  let packSuggestion = await probeSourceTextPackSuggestion({
    store,
    pack,
    sourceRowCount: scan.sourceRowCount,
    withText: scan.withText,
    total: scan.sources.length,
  });

  const shouldAutoSync =
    Boolean(options?.autoSyncPack) &&
    packSuggestion?.canAutoApply &&
    (packSuggestion.confidence === "high" || isInvalidSourceTableMapping(pack));

  if (shouldAutoSync && packSuggestion) {
    const mergedPatch = {
      ...sourceTextPatchFromPack(pack),
      ...packSuggestion.suggested,
    };
    const updated = await persistDomainPackSourceTextMapping(
      workspaceId,
      pack.id,
      mergedPatch,
    );
    if (updated) {
      pack = updated;
      packSynced = true;
      scan = await runSourceDiscoveryScan(store, pack);
      packSuggestion = await probeSourceTextPackSuggestion({
        store,
        pack,
        sourceRowCount: scan.sourceRowCount,
        withText: scan.withText,
        total: scan.sources.length,
      });
    }
  }

  const pipelineCatalogCount = await countGraphImportedCatalogSources(workspaceId);
  const importAlreadySatisfied =
    pipelineCatalogCount > 0 &&
    scan.withText > 0 &&
    pipelineCatalogCount >= scan.withText;

  return {
    storeType: "surreal",
    sources: scan.sources,
    total: scan.sources.length,
    withText: scan.withText,
    withoutText: scan.sources.length - scan.withText,
    withPassageText: scan.withPassageText,
    withInlineText: scan.withInlineText,
    scanMeta: buildSourceScanMeta(pack),
    domainPackId: pack.id,
    packTitle: pack.title,
    packEditable: !pack.is_builtin,
    currentMapping: sourceTextPatchFromPack(pack),
    packSuggestion,
    packSynced,
    mappingInvalid: isInvalidSourceTableMapping(pack),
    pipelineCatalogCount,
    importAlreadySatisfied,
  };
}

function normalizeManualMappingPatch(mapping: SourceTextSchemaPatch): SourceTextSchemaPatch {
  const patch: SourceTextSchemaPatch = {
    source_table: mapping.source_table.trim(),
    passage_table: mapping.passage_table.trim(),
  };
  const sourceTextField = mapping.source_text_field?.trim();
  const passageTextField = mapping.passage_text_field?.trim() || "text";
  const passageSourceField = mapping.passage_source_field?.trim();
  if (sourceTextField) patch.source_text_field = sourceTextField;
  if (patch.passage_table) patch.passage_text_field = passageTextField;
  if (passageSourceField) patch.passage_source_field = passageSourceField;
  return patch;
}

export async function applyManualSourceTextMapping(
  workspaceId: string,
  packId: string,
  mapping: SourceTextSchemaPatch,
): Promise<
  | { ok: true; result: DiscoverSourcesResult }
  | { ok: false; error: string; message: string }
> {
  const pack = await resolveWorkspaceDomainPack(workspaceId, packId);
  if (!pack) {
    return { ok: false, error: "pack_not_found", message: "Domain pack not found for this workspace." };
  }
  if (pack.is_builtin) {
    return {
      ok: false,
      error: "builtin_pack",
      message:
        "Built-in packs cannot be edited here. Duplicate the pack or import your Surreal schema as a custom pack.",
    };
  }

  const patch = normalizeManualMappingPatch(mapping);
  if (!patch.source_table || !patch.passage_table) {
    return {
      ok: false,
      error: "invalid_mapping",
      message: "Source table and passage table are required.",
    };
  }

  if (!isSourceTablePatchAllowed(pack, patch)) {
    return {
      ok: false,
      error: "invalid_mapping",
      message: `Source table cannot be the idea table (${pack.graph_schema.unit_table}), group table, or passage table.`,
    };
  }

  const updated = await persistDomainPackSourceTextMapping(workspaceId, packId, patch);
  if (!updated) {
    return {
      ok: false,
      error: "apply_failed",
      message: "Could not update the domain pack. Check table and field names.",
    };
  }

  const result = await discoverGraphSources(workspaceId, { packId, autoSyncPack: false });
  return { ok: true, result };
}

export async function syncDomainPackFromSourceScan(
  workspaceId: string,
  packId: string,
): Promise<
  | { ok: true; result: DiscoverSourcesResult }
  | { ok: false; error: string; message: string }
> {
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) {
    return { ok: false, error: "store_unreachable", message: "Could not reach your graph store." };
  }

  const pack = await resolveWorkspaceDomainPack(workspaceId, packId);
  if (!pack) {
    return { ok: false, error: "pack_not_found", message: "Domain pack not found for this workspace." };
  }
  if (pack.is_builtin) {
    return {
      ok: false,
      error: "builtin_pack",
      message: "Built-in packs cannot be auto-updated. Duplicate the pack or import your Surreal schema as a custom pack.",
    };
  }

  const scan = await runSourceDiscoveryScan(store, pack);
  const suggestion = await probeSourceTextPackSuggestion({
    store,
    pack,
    sourceRowCount: scan.sourceRowCount,
    withText: scan.withText,
    total: scan.sources.length,
  });
  if (!suggestion) {
    return {
      ok: false,
      error: "no_changes",
      message: "Current domain pack mapping already matches what we can detect in your graph.",
    };
  }

  const mergedPatch = {
    ...sourceTextPatchFromPack(pack),
    ...suggestion.suggested,
  };
  const updated = await persistDomainPackSourceTextMapping(
    workspaceId,
    packId,
    mergedPatch,
  );
  if (!updated) {
    return {
      ok: false,
      error: "apply_failed",
      message: "Could not update the domain pack.",
    };
  }

  const result = await discoverGraphSources(workspaceId, { packId, autoSyncPack: false });
  return { ok: true, result: { ...result, packSynced: true } };
}

/**
 * Copy source text from the BYO SurrealDB graph into knowledge_source_documents so that
 * resolveConnectSourceText can find it on the next re-validation pass.
 * Sources without full text are counted as skipped; nothing is re-ingested.
 */
export async function importGraphSourcesToPipeline(
  workspaceId: string,
  options?: { packId?: string | null },
): Promise<ImportSourcesResult> {
  const target = await getConnectGraphTargetForWorkspace(workspaceId);
  if (!target || target.provider !== "surreal") {
    return { imported: 0, skipped: 0, alreadyPresent: 0 };
  }

  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return { imported: 0, skipped: 0, alreadyPresent: 0 };

  const pack = await resolveWorkspaceDomainPack(workspaceId, options?.packId);
  if (!pack) return { imported: 0, skipped: 0, alreadyPresent: 0 };

  if (isInvalidSourceTableMapping(pack)) {
    return {
      imported: 0,
      skipped: 0,
      alreadyPresent: 0,
      error: "invalid_source_mapping",
      message:
        'Domain pack source_table matches the idea/unit table. Update the pack to use the bibliographic "source" table, then import again.',
    };
  }

  const sourceTable = pack.graph_schema.source_table.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const rows = await querySurrealSourceTable(store, pack);

  let imported = 0;
  let skipped = 0;
  let alreadyPresent = 0;

  for (const row of rows) {
    const resolved = await resolveSurrealSourceFullText({
      store,
      pack,
      sourceRow: row,
      sourceId: String(row.id ?? ""),
    });
    if (resolved.quality !== "full" || !resolved.text.trim()) {
      skipped++;
      continue;
    }

    const key = String(row.id ?? "");
    const title =
      typeof row.title === "string" && row.title.trim() ? row.title.trim() : null;
    const url = typeof row.url === "string" && row.url.trim() ? row.url.trim() : null;
    const displayName = title ?? url ?? (key.includes(":") ? key : null);
    if (!displayName) {
      skipped++;
      continue;
    }

    const existing = await findConnectSourceDocumentText({
      workspaceId,
      name: title ?? displayName,
      url,
    });
    if (existing) {
      alreadyPresent++;
      continue;
    }

    await insertConnectSourceDocument({
      id: randomUUID(),
      workspaceId,
      sourceKind: "graph_import",
      name: displayName,
      url: url ?? null,
      text: resolved.text,
      charCount: resolved.text.length,
      chunkCount: resolved.passageCount ?? 1,
      status: "parsed",
      parserProvider: "surreal_graph_import",
      provenance: {
        graph_source_key: key,
        source_table: sourceTable,
        text_origin: resolved.origin,
      },
    });
    imported++;
  }

  return { imported, skipped, alreadyPresent };
}

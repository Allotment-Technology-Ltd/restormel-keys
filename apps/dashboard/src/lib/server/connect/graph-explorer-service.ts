/**
 * Connect graph explorer — reads from Postgres spine or Bring-Your-Own Surreal,
 * depending on the workspace graph target (matches ingest GraphWriter routing).
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { GraphStore } from "@restormel/graphrag-core";
import { domainPackRecordToApi } from "$lib/server/connect/domain-pack-service";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import { formatSurrealRecordId, surrealRecordRef } from "$lib/server/connect/graph-writer";
import {
  getConnectDomainPackById,
  getConnectGraphExplorer,
  getConnectGraphStats,
  getConnectGraphTargetForWorkspace,
  listConnectDomainPacksForWorkspace,
  listConnectIngestJobsForWorkspace,
} from "$lib/server/neon";
import {
  isAwaitingHumanTriage,
  isUncheckedValidationStatus,
  matchesGraphRevalidateScope,
  normalizeValidationStatus,
} from "$lib/connect/validation-status";
import { sortGraphUnitsForReview } from "$lib/connect/graph-unit-sort";
import {
  loadSurrealExplorerUnitPage,
  loadSurrealExplorerUnitRows,
  paginateSurrealUnitRowsAll,
  pickSurrealUnitText,
  SURREAL_GRAPH_UNIT_PAGE_SIZE,
} from "$lib/server/connect/surreal-graph-units-load";

/** Initial SSR unit page size for graph explorer (more load via /api/connect/graph/units). */
export const GRAPH_EXPLORER_PAGE_SIZE = 150;

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function tableIdent(name: string, fallback: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENT.test(s) ? s : fallback;
}

export type ConnectGraphStatsView = {
  units: number;
  relations: number;
  groups: number;
  embedded: number;
  validation: {
    ok: number;
    weak: number;
    unsupported: number;
    unvalidated: number;
    awaiting_triage: number;
    unsupported_untriaged: number;
  };
};

export type ConnectGraphGroupView = {
  id: string;
  name: string;
  summary: string | null;
  members: { text: string; role: string | null; validationStatus: string | null }[];
};

export type ConnectGraphUnitView = {
  id: string;
  text: string;
  unitType: string | null;
  domain: string | null;
  validationStatus: string | null;
  validationNote: string | null;
  /** Registered ingest source title (document name or URL label). */
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceKind: string | null;
  /** Linked thinker/entity when the domain pack resolves authors on sources. */
  author: string | null;
};

function parseFetchedSource(source: unknown): {
  id: string | null;
  title: string | null;
  url: string | null;
  kind: string | null;
} {
  if (!source) return { id: null, title: null, url: null, kind: null };
  if (typeof source === "string") {
    return { id: source.includes(":") ? source : null, title: null, url: null, kind: null };
  }
  if (typeof source === "object" && !Array.isArray(source)) {
    const row = source as Record<string, unknown>;
    const id = formatSurrealRecordId(row.id) ?? (typeof row.id === "string" ? row.id : null);
    return {
      id,
      title: typeof row.title === "string" && row.title.trim() ? row.title.trim() : null,
      url: typeof row.url === "string" && row.url.trim() ? row.url.trim() : null,
      kind:
        typeof row.source_kind === "string" && row.source_kind.trim()
          ? row.source_kind.trim()
          : null,
    };
  }
  return { id: null, title: null, url: null, kind: null };
}

function firstThinkerName(thinkers: unknown): string | null {
  const list = Array.isArray(thinkers) ? thinkers : thinkers ? [thinkers] : [];
  for (const entry of list) {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const name = (entry as Record<string, unknown>).name;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
  }
  return null;
}

async function loadSourceMetadataById(
  store: GraphStore,
  pack: ConnectDomainPack,
  sourceIds: string[],
): Promise<Map<string, { title: string | null; url: string | null; kind: string | null }>> {
  const map = new Map<string, { title: string | null; url: string | null; kind: string | null }>();
  if (sourceIds.length === 0) return map;

  const refs = sourceIds.map((id) => surrealRecordRef(id)).join(", ");
  try {
    const rows = await store.query<Record<string, unknown>[]>(
      `SELECT id, title, url, source_kind FROM [${refs}];`,
    );
    for (const row of rows) {
      const id = formatSurrealRecordId(row.id) ?? (typeof row.id === "string" ? row.id : null);
      if (!id) continue;
      map.set(id, {
        title: typeof row.title === "string" && row.title.trim() ? row.title.trim() : null,
        url: typeof row.url === "string" && row.url.trim() ? row.url.trim() : null,
        kind:
          typeof row.source_kind === "string" && row.source_kind.trim()
            ? row.source_kind.trim()
            : null,
      });
    }
  } catch (err) {
    console.warn(
      "[connect-graph-explorer] source metadata hydration skipped:",
      err instanceof Error ? err.message : err,
    );
  }
  return map;
}

async function loadAuthorsBySourceId(
  store: GraphStore,
  pack: ConnectDomainPack,
  sourceIds: string[],
): Promise<Map<string, string>> {
  const linking = pack.entity_linking;
  if (!linking?.enabled || sourceIds.length === 0) return new Map();

  const entityTable = tableIdent(linking.entity_table ?? "thinker", "thinker");
  const sourceEdge = tableIdent(linking.source_edge ?? "authored", "authored");
  const map = new Map<string, string>();

  try {
    const rows = await store.query<
      {
        source_id?: string | { toString(): string };
        thinkers?: unknown;
        id?: string | { toString(): string };
      }[]
    >(
      `LET $source_ids = $sources;
       SELECT meta::id(id) AS source_id, <-${sourceEdge}<-${entityTable} AS thinkers FROM $source_ids FETCH thinkers;`,
      { sources: sourceIds },
    );
    for (const row of rows ?? []) {
      const sourceId =
        formatSurrealRecordId(row.source_id) ??
        formatSurrealRecordId(row.id) ??
        (typeof row.source_id === "string" ? row.source_id : null);
      const author = firstThinkerName(row.thinkers);
      if (sourceId && author) map.set(sourceId, author);
    }
  } catch {
    try {
      const refs = sourceIds.map((id) => surrealRecordRef(id)).join(", ");
      const rows = await store.query<{ thinkers?: unknown; id?: unknown }[]>(
        `SELECT id, <-${sourceEdge}<-${entityTable} AS thinkers FROM [${refs}] FETCH thinkers;`,
      );
      for (let i = 0; i < sourceIds.length; i += 1) {
        const author = firstThinkerName(rows[i]?.thinkers);
        if (author) map.set(sourceIds[i]!, author);
      }
    } catch {
      // Author enrichment is optional when thinker tables are absent.
    }
  }
  return map;
}

export type ConnectGraphView = {
  store: "postgres" | "surreal" | "none";
  storeLabel: string;
  /** When set, the graph target exists but connectivity has not been verified or failed last test. */
  targetStatus?: "untested" | "error";
  /** Active domain pack used to read Surreal tables (required for operator review writes). */
  domainPackId?: string | null;
  domainPackTitle?: string | null;
  reviewEnabled: boolean;
  stats: ConnectGraphStatsView | null;
  groups: ConnectGraphGroupView[];
  units: ConnectGraphUnitView[];
  /** Set when Surreal unit rows could not be loaded (stats may still be present). */
  unitsLoadError?: string | null;
  unitsPagination?: {
    offset: number;
    limit: number;
    loaded: number;
    total: number | null;
    hasMore: boolean;
  };
};

export type LoadConnectGraphViewOpts = {
  unitLimit?: number;
  unitOffset?: number;
};

export type LoadConnectGraphUnitsPageResult = {
  units: ConnectGraphUnitView[];
  hasMore: boolean;
  total: number | null;
  domainPackId: string | null;
  unitsLoadError?: string | null;
};

function paginationMeta(params: {
  offset: number;
  limit: number;
  loaded: number;
  total: number | null;
}): ConnectGraphView["unitsPagination"] {
  const total = params.total;
  const hasMore =
    total != null
      ? params.offset + params.loaded < total
      : params.loaded >= params.limit;
  return {
    offset: params.offset,
    limit: params.limit,
    loaded: params.loaded,
    total,
    hasMore,
  };
}

function isConfiguredSurrealTarget(
  target: Awaited<ReturnType<typeof getConnectGraphTargetForWorkspace>>,
): target is NonNullable<typeof target> & { provider: "surreal" } {
  return (
    target?.provider === "surreal" &&
    Boolean(target.endpoint?.trim() && target.namespace?.trim() && target.database?.trim())
  );
}

function surrealStoreLabel(
  target: NonNullable<Awaited<ReturnType<typeof getConnectGraphTargetForWorkspace>>>,
): string {
  if (target.status === "error") {
    return "SurrealDB graph store (connection error — re-test in Pipeline)";
  }
  if (target.status !== "ok") {
    return "SurrealDB graph store (connection not verified)";
  }
  return "SurrealDB graph store";
}

async function resolveDomainPacksForGraph(
  workspaceId: string,
): Promise<ConnectDomainPack[]> {
  const jobs = await listConnectIngestJobsForWorkspace({ workspaceId, limit: 25 });
  const orderedIds: string[] = [];
  for (const job of jobs) {
    if (job.status === "completed" && job.domainPackId && !orderedIds.includes(job.domainPackId)) {
      orderedIds.push(job.domainPackId);
    }
  }
  const rows = await listConnectDomainPacksForWorkspace(workspaceId);
  for (const row of rows) {
    if (!orderedIds.includes(row.id)) orderedIds.push(row.id);
  }

  const packs: ConnectDomainPack[] = [];
  for (const id of orderedIds) {
    const row = rows.find((r) => r.id === id) ?? (await getConnectDomainPackById({ id, workspaceId }));
    if (!row) continue;
    try {
      packs.push(domainPackRecordToApi(row));
    } catch {
      // skip invalid pack rows
    }
  }
  return packs;
}

async function surrealCount(store: GraphStore, table: string): Promise<number> {
  try {
    const rows = await store.query<{ count?: number }[]>(
      `SELECT count() AS count FROM ${table} GROUP ALL;`,
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function mapSurrealRawRows(
  store: GraphStore,
  pack: ConnectDomainPack,
  rows: Record<string, unknown>[],
  variant: string,
): Promise<{ units: ConnectGraphUnitView[]; unitsLoadError: string | null }> {
  const parsed = rows
    .map((u) => {
      const text = pickSurrealUnitText(u);
      if (!text) return null;
      const id =
        formatSurrealRecordId(u.id) ?? (typeof u.id === "string" ? u.id : crypto.randomUUID());
      const fetched = parseFetchedSource(u.source);
      const unitType =
        typeof u.unit_type === "string"
          ? u.unit_type
          : typeof u.type === "string"
            ? u.type
            : null;
      const domain = typeof u.domain === "string" ? u.domain : null;
      const validationNote = typeof u.validation_note === "string" ? u.validation_note : null;
      const sourceKind =
        typeof u.source_kind === "string" && u.source_kind.trim()
          ? u.source_kind.trim()
          : typeof u.sourceKind === "string" && u.sourceKind.trim()
            ? u.sourceKind.trim()
            : fetched.kind;
      return {
        id,
        text,
        unitType,
        domain,
        validationStatus: normalizeValidationStatus(
          typeof u.validation_status === "string" ? u.validation_status : null,
        ),
        validationNote,
        sourceTitle:
          (typeof u.source_title === "string" && u.source_title.trim()
            ? u.source_title.trim()
            : null) ?? fetched.title,
        sourceUrl:
          (typeof u.source_url === "string" && u.source_url.trim() ? u.source_url.trim() : null) ??
          fetched.url,
        sourceKind,
        author: null as string | null,
        sourceId: fetched.id,
      };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  let unitsLoadError: string | null = null;
  if (rows.length > 0 && parsed.length === 0) {
    unitsLoadError =
      `Loaded ${rows.length} row(s) but none had recognizable text — check that your unit table uses a text-like field (${variant === "star" ? "see server logs" : "text, statement, content, …"}).`;
  }

  const needsHydration = parsed.filter(
    (u) => u.sourceId && !u.sourceTitle && !u.sourceUrl && !u.sourceKind,
  );
  if (needsHydration.length > 0) {
    const metaById = await loadSourceMetadataById(
      store,
      pack,
      [...new Set(needsHydration.map((u) => u.sourceId!))],
    );
    for (const unit of parsed) {
      if (!unit.sourceId) continue;
      const meta = metaById.get(unit.sourceId);
      if (!meta) continue;
      unit.sourceTitle = unit.sourceTitle ?? meta.title;
      unit.sourceUrl = unit.sourceUrl ?? meta.url;
      unit.sourceKind = unit.sourceKind ?? meta.kind;
    }
  }

  let unitRows: ConnectGraphUnitView[] = parsed;
  try {
    const sourceIds = [
      ...new Set(parsed.map((u) => u.sourceId).filter((id): id is string => Boolean(id))),
    ];
    const authorsBySource = await loadAuthorsBySourceId(store, pack, sourceIds);
    unitRows = parsed.map(({ sourceId, ...unit }) => ({
      ...unit,
      author: sourceId ? (authorsBySource.get(sourceId) ?? null) : null,
    }));
  } catch (err) {
    console.warn(
      "[connect-graph-explorer] author enrichment skipped:",
      err instanceof Error ? err.message : err,
    );
  }
  return { units: unitRows, unitsLoadError };
}

async function loadSurrealGraphStats(
  workspaceId: string,
  pack: ConnectDomainPack,
): Promise<ConnectGraphStatsView | null> {
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return null;

  const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");
  const groupTable = tableIdent(pack.graph_schema.group_table, "group");
  const partOfEdge = tableIdent(pack.graph_schema.part_of_edge, "part_of");
  const edgeTables = [
    ...pack.graph_schema.relation_edges.map((e) => tableIdent(e, "relates_to")),
    partOfEdge,
  ];

  const units = await surrealCount(store, unitTable);
  let relations = 0;
  for (const edge of edgeTables) {
    relations += await surrealCount(store, edge);
  }
  const groups = await surrealCount(store, groupTable);

  let embedded = 0;
  try {
    const embeddedRows = await store.query<{ count?: number }[]>(
      `SELECT count() AS count FROM ${unitTable} WHERE embedding IS NOT NONE GROUP ALL;`,
    );
    embedded = Number(embeddedRows[0]?.count ?? 0);
  } catch (err) {
    console.warn(
      `[connect-graph-explorer] embedded count query failed for ${unitTable}:`,
      err instanceof Error ? err.message : err,
    );
    embedded = 0;
  }

  const validation = {
    ok: 0,
    weak: 0,
    unsupported: 0,
    unvalidated: 0,
    awaiting_triage: 0,
    unsupported_untriaged: 0,
  };
  try {
    const valRows = await store.query<{ validation_status?: string | null; count?: number }[]>(
      `SELECT validation_status, count() AS count FROM ${unitTable} GROUP BY validation_status;`,
    );
    for (const row of valRows) {
      const c = Number(row.count ?? 0);
      const s = normalizeValidationStatus(row.validation_status);
      if (s === "ok") validation.ok += c;
      else if (s === "weak") validation.weak += c;
      else if (s === "unsupported") validation.unsupported += c;
      else validation.unvalidated += c;
    }
  } catch {
    if (units > 0) validation.unvalidated = units;
  }

  try {
    const triageRows = await paginateSurrealUnitRowsAll<{
      validation_status?: string | null;
      validation_note?: string | null;
    }>(store, (limit, start) =>
      `SELECT validation_status, validation_note FROM ${unitTable} LIMIT ${limit} START ${start};`,
    );
    for (const row of triageRows) {
      if (isAwaitingHumanTriage(row.validation_status, row.validation_note)) {
        validation.awaiting_triage += 1;
      }
      if (matchesGraphRevalidateScope(row.validation_status, row.validation_note, "unsupported")) {
        validation.unsupported_untriaged += 1;
      }
    }
  } catch (err) {
    console.warn(
      `[connect-graph-explorer] quarantine count query failed for ${unitTable}:`,
      err instanceof Error ? err.message : err,
    );
  }

  return { units, relations, groups, embedded, validation };
}

/** Stats from the workspace graph store (Surreal or Postgres spine) — used by Connect hub and MCP setup. */
export async function resolveConnectGraphStats(
  workspaceId: string,
): Promise<ConnectGraphStatsView | null> {
  const target = await getConnectGraphTargetForWorkspace(workspaceId);

  if (isConfiguredSurrealTarget(target)) {
    const packs = await resolveDomainPacksForGraph(workspaceId);
    if (packs.length === 0) return null;
    let best: ConnectGraphStatsView | null = null;
    let bestUnits = 0;
    for (const pack of packs) {
      const stats = await loadSurrealGraphStats(workspaceId, pack);
      if (!stats) continue;
      if (stats.units > bestUnits) {
        best = stats;
        bestUnits = stats.units;
      }
    }
    return best;
  }

  if (target?.provider === "postgres" && target.useDashboardDatabase) {
    return getConnectGraphStats(workspaceId).catch(() => null);
  }

  const stats = await getConnectGraphStats(workspaceId).catch(() => null);
  return stats;
}

async function loadSurrealGraphView(
  workspaceId: string,
  pack: ConnectDomainPack,
  opts?: LoadConnectGraphViewOpts,
): Promise<ConnectGraphView | null> {
  const stats = await loadSurrealGraphStats(workspaceId, pack);
  if (!stats) return null;

  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return null;

  const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");
  const groupTable = tableIdent(pack.graph_schema.group_table, "group");
  const partOfEdge = tableIdent(pack.graph_schema.part_of_edge, "part_of");

  const units = stats.units;

  const unitLimit = Math.min(
    Math.max(opts?.unitLimit ?? GRAPH_EXPLORER_PAGE_SIZE, 1),
    SURREAL_GRAPH_UNIT_PAGE_SIZE,
  );
  const unitOffset = Math.max(opts?.unitOffset ?? 0, 0);

  let unitRows: ConnectGraphUnitView[] = [];
  let unitsLoadError: string | null = null;
  try {
    const { rows, variant } =
      unitOffset === 0 && unitLimit >= GRAPH_EXPLORER_PAGE_SIZE * 10
        ? await loadSurrealExplorerUnitRows(store, unitTable)
        : await loadSurrealExplorerUnitPage(store, unitTable, { start: unitOffset, limit: unitLimit });
    const mapped = await mapSurrealRawRows(store, pack, rows, variant);
    unitRows = mapped.units;
    unitsLoadError = mapped.unitsLoadError;
  } catch (err) {
    unitRows = [];
    unitsLoadError =
      err instanceof Error
        ? err.message
        : "Could not load ideas from SurrealDB for the review queue.";
    console.warn("[connect-graph-explorer] unit load failed:", unitsLoadError);
  }

  let groupRows: ConnectGraphGroupView[] = [];
  try {
    const rows = await store.query<
      { id?: string | { toString(): string }; name?: string; summary?: string | null }[]
    >(`SELECT id, name, summary FROM ${groupTable} LIMIT 20;`);
    groupRows = rows
      .filter((g) => typeof g.name === "string" && g.name.trim())
      .map((g) => {
        const idRaw = g.id;
        const id =
          formatSurrealRecordId(idRaw) ??
          (typeof idRaw === "string" ? idRaw : g.name!.trim());
        return {
          id,
          name: g.name!.trim(),
          summary: g.summary ?? null,
          members: [] as ConnectGraphGroupView["members"],
        };
      });

    if (groupRows.length > 0) {
      try {
        const memberRows = await store.query<
          {
            role?: string | null;
            text?: string;
            validation_status?: string | null;
            group_id?: string | { toString(): string };
          }[]
        >(
          `SELECT role, in.text AS text, in.validation_status AS validation_status, out AS group_id FROM ${partOfEdge} LIMIT 300;`,
        );
        for (const m of memberRows) {
          const gid =
            formatSurrealRecordId(m.group_id) ??
            (typeof m.group_id === "string" ? m.group_id : null);
          if (!gid || typeof m.text !== "string") continue;
          const group = groupRows.find((g) => g.id === gid);
          if (!group) continue;
          group.members.push({
            text: m.text,
            role: m.role ?? null,
            validationStatus: m.validation_status ?? null,
          });
        }
      } catch {
        // groups without member expansion still render
      }
    }
  } catch {
    groupRows = [];
  }

  return {
    store: "surreal",
    storeLabel: "SurrealDB graph store",
    domainPackId: pack.id,
    domainPackTitle: pack.title,
    reviewEnabled: true,
    stats,
    groups: groupRows,
    units: sortGraphUnitsForReview(unitRows),
    unitsLoadError,
    unitsPagination: paginationMeta({
      offset: unitOffset,
      limit: unitLimit,
      loaded: unitRows.length,
      total: units,
    }),
  };
}

/** Load graph explorer data from the workspace's configured graph store. */
export async function loadConnectGraphView(
  workspaceId: string,
  opts?: LoadConnectGraphViewOpts,
): Promise<ConnectGraphView> {
  const unitLimit = Math.min(Math.max(opts?.unitLimit ?? GRAPH_EXPLORER_PAGE_SIZE, 1), 5000);
  const unitOffset = Math.max(opts?.unitOffset ?? 0, 0);
  const viewOpts = { unitLimit, unitOffset };
  const target = await getConnectGraphTargetForWorkspace(workspaceId);

  // Ingest writes to Surreal whenever a target is configured; explorer must read the same store
  // even when status is still "untested" (save without test) or was reset on upsert.
  if (isConfiguredSurrealTarget(target)) {
    const storeLabel = surrealStoreLabel(target);
    const targetStatus: ConnectGraphView["targetStatus"] =
      target.status === "untested" || target.status === "error" ? target.status : undefined;
    const packs = await resolveDomainPacksForGraph(workspaceId);
    if (packs.length > 0) {
      let best: ConnectGraphView | null = null;
      let bestUnits = 0;
      for (const pack of packs) {
        const surreal = await loadSurrealGraphView(workspaceId, pack, viewOpts);
        if (!surreal) continue;
        const units = surreal.stats?.units ?? 0;
        if (units > bestUnits) {
          best = {
            ...surreal,
            storeLabel,
            reviewEnabled: true,
            ...(targetStatus ? { targetStatus } : {}),
          };
          bestUnits = units;
        }
      }
      if (best) return best;
    }
    return {
      store: "surreal",
      storeLabel,
      reviewEnabled: true,
      ...(targetStatus ? { targetStatus } : {}),
      stats: null,
      groups: [],
      units: [],
    };
  }

  if (target?.provider === "postgres" && target.useDashboardDatabase) {
    const [stats, explorer] = await Promise.all([
      getConnectGraphStats(workspaceId).catch(() => null),
      getConnectGraphExplorer(workspaceId, { unitLimit, unitOffset }).catch(() => ({
        groups: [],
        units: [],
      })),
    ]);
    const sorted = sortGraphUnitsForReview(explorer.units);
    return {
      store: "postgres",
      storeLabel: "Postgres graph spine",
      reviewEnabled: true,
      stats,
      groups: explorer.groups,
      units: sorted,
      unitsPagination: paginationMeta({
        offset: unitOffset,
        limit: unitLimit,
        loaded: sorted.length,
        total: stats?.units ?? null,
      }),
    };
  }

  // Legacy / no target: still surface Postgres spine rows if present.
  const [stats, explorer] = await Promise.all([
    getConnectGraphStats(workspaceId).catch(() => null),
    getConnectGraphExplorer(workspaceId, { unitLimit, unitOffset }).catch(() => ({
      groups: [],
      units: [],
    })),
  ]);
  const hasSpine = Boolean(stats && stats.units > 0);
  const sorted = sortGraphUnitsForReview(explorer.units);
  return {
    store: hasSpine ? "postgres" : "none",
    storeLabel: hasSpine ? "Postgres graph spine" : "No graph store connected",
    reviewEnabled: hasSpine,
    stats,
    groups: explorer.groups,
    units: sorted,
    unitsPagination: paginationMeta({
      offset: unitOffset,
      limit: unitLimit,
      loaded: sorted.length,
      total: stats?.units ?? null,
    }),
  };
}

/** Progressive unit fetch for graph explorer (client load-more). */
export async function loadConnectGraphUnitsPage(
  workspaceId: string,
  opts: { offset: number; limit: number; domainPackId?: string | null },
): Promise<LoadConnectGraphUnitsPageResult> {
  const offset = Math.max(opts.offset, 0);
  const limit = Math.min(Math.max(opts.limit, 1), SURREAL_GRAPH_UNIT_PAGE_SIZE);
  const target = await getConnectGraphTargetForWorkspace(workspaceId);

  if (isConfiguredSurrealTarget(target)) {
    const packs = await resolveDomainPacksForGraph(workspaceId);
    const pack =
      (opts.domainPackId ? packs.find((p) => p.id === opts.domainPackId) : null) ?? packs[0] ?? null;
    if (!pack) {
      return { units: [], hasMore: false, total: null, domainPackId: null };
    }
    const store = await buildWorkspaceGraphStore(workspaceId);
    if (!store) {
      return {
        units: [],
        hasMore: false,
        total: null,
        domainPackId: pack.id,
        unitsLoadError: "Could not connect to Surreal graph store.",
      };
    }
    const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");
    const total = await surrealCount(store, unitTable);
    try {
      const { rows, variant } = await loadSurrealExplorerUnitPage(store, unitTable, {
        start: offset,
        limit,
      });
      const mapped = await mapSurrealRawRows(store, pack, rows, variant);
      const sorted = sortGraphUnitsForReview(mapped.units);
      return {
        units: sorted,
        hasMore: offset + sorted.length < total,
        total,
        domainPackId: pack.id,
        unitsLoadError: mapped.unitsLoadError,
      };
    } catch (err) {
      return {
        units: [],
        hasMore: false,
        total,
        domainPackId: pack.id,
        unitsLoadError:
          err instanceof Error ? err.message : "Could not load ideas from SurrealDB.",
      };
    }
  }

  const stats = await getConnectGraphStats(workspaceId).catch(() => null);
  const explorer = await getConnectGraphExplorer(workspaceId, { unitLimit: limit, unitOffset: offset });
  const sorted = sortGraphUnitsForReview(explorer.units);
  const total = stats?.units ?? null;
  return {
    units: sorted,
    hasMore: total != null ? offset + sorted.length < total : sorted.length >= limit,
    total,
    domainPackId: null,
  };
}

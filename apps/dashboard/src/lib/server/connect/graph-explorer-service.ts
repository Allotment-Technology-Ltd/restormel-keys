/**
 * Connect graph explorer — reads from Postgres spine or Bring-Your-Own Surreal,
 * depending on the workspace graph target (matches ingest GraphWriter routing).
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { GraphStore } from "@restormel/graphrag-core";
import {
  domainPackRecordToApi,
  getSelectedDomainPackId,
  persistDomainPackVectorField,
} from "$lib/server/connect/domain-pack-service";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import { formatSurrealRecordId, surrealRecordRef } from "$lib/server/connect/graph-writer";
import {
  getConnectClaimVersionBreakdownPostgres,
  getConnectDomainPackById,
  getConnectGraphExplorer,
  getConnectGraphStats,
  getConnectGraphStatsCache,
  getConnectGraphTargetForWorkspace,
  listConnectDomainPacksForWorkspace,
  listConnectIngestJobsForWorkspace,
  setConnectGraphStatsCache,
} from "$lib/server/neon";
import {
  VERIFICATION_STATES,
  type UnitEvidenceSummary,
  type VerificationState,
} from "$lib/connect/evidence-dossier";
import {
  composeEvidenceSummaryFromSurrealRow,
  loadConnectUnitEvidenceSummaries,
} from "$lib/server/connect/evidence-dossier-service";
import {
  HUMAN_REVIEW_NOTE_PREFIX,
  isAwaitingHumanTriage,
  isUncheckedValidationStatus,
  matchesGraphRevalidateScope,
  normalizeValidationStatus,
} from "$lib/connect/validation-status";
import { sortGraphUnitsForReview } from "$lib/connect/graph-unit-sort";
import { loadGraphSourceCatalogStatus } from "$lib/server/connect/graph-source-catalog-status";
import {
  detectEmbeddedUnits,
  loadSurrealExplorerUnitPage,
  loadSurrealExplorerUnitRows,
  paginateSurrealUnitRows,
  pickSurrealUnitText,
  SURREAL_GRAPH_UNIT_PAGE_SIZE,
} from "$lib/server/connect/surreal-graph-units-load";
import {
  applyExplorerAsOf,
  type AsOfRequest,
  type AsOfStatus,
} from "$lib/server/connect/graph-explorer-as-of";

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
  /**
   * EBV summary (W2.2 Evidence Dossier) — verification state, bound span, latest
   * judgment. null = the claim predates evidence binding (additive field; older
   * consumers ignore it).
   */
  evidence?: UnitEvidenceSummary | null;
};

/** Per-state counts of CURRENT claim versions for the explorer's Evidence facet. */
export type ConnectEvidenceStateCounts = Record<VerificationState, number>;

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

export type ConnectGraphSourceCatalogStatusView = {
  pipelineCatalogCount: number;
  sourcesInPipeline: boolean;
};

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
  /** True while the fast unit-count skeleton is served; relations/groups/embedded are not yet computed. */
  statsPartial?: boolean;
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
  /** Pipeline catalog import status (durable across browser sessions). */
  sourceCatalogStatus?: ConnectGraphSourceCatalogStatusView;
  /**
   * Evidence facet counts (W2.2): current claim versions per verification state.
   * null = the store could not answer (never fabricated as zeros).
   */
  evidenceStates?: ConnectEvidenceStateCounts | null;
};

export type LoadConnectGraphViewOpts = {
  unitLimit?: number;
  unitOffset?: number;
  /** Skip Surreal unit queries on SSR — client loads via /api/connect/graph/units. */
  skipUnits?: boolean;
  /** Skip cluster/group edge queries on SSR — clusters tab loads lazily. */
  skipGroups?: boolean;
};

export type MapSurrealRawRowsOpts = {
  /** Author graph-walk is expensive; defer on list endpoints. */
  skipAuthorEnrichment?: boolean;
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

/**
 * The single domain pack to read the active graph with: the workspace's selected
 * pack (set when a Graph Library entry is activated), falling back to generic/first.
 * Avoids the old "scan every pack" fan-out that multiplied query cost on big graphs.
 */
async function resolveActiveDomainPackForGraph(
  workspaceId: string,
): Promise<ConnectDomainPack | null> {
  const selectedId = await getSelectedDomainPackId(workspaceId).catch(() => null);
  if (selectedId) {
    const row = await getConnectDomainPackById({ id: selectedId, workspaceId }).catch(() => null);
    if (row) {
      try {
        return domainPackRecordToApi(row);
      } catch {
        // fall through to default
      }
    }
  }
  const rows = await listConnectDomainPacksForWorkspace(workspaceId);
  const pick = rows.find((r) => r.slug === "generic") ?? rows[0] ?? null;
  if (!pick) return null;
  try {
    return domainPackRecordToApi(pick);
  } catch {
    return null;
  }
}

async function surrealCount(store: GraphStore, table: string): Promise<number> {
  const queries = [
    `SELECT count() AS count FROM ${table} GROUP ALL;`,
    `SELECT count() AS count FROM type::table('${table}') GROUP ALL;`,
  ];
  for (const sql of queries) {
    try {
      const rows = await store.query<{ count?: number }[]>(sql);
      const n = Number(rows[0]?.count ?? 0);
      if (n > 0) return n;
    } catch {
      // try next shape
    }
  }
  return 0;
}

function statsHaveGraphUnits(stats: ConnectGraphStatsView | null | undefined): boolean {
  return Boolean(stats && stats.units > 0);
}

/** BYO graphs: a cached `units: 0` is often a wrong pack — never treat it as authoritative. */
function surrealStatsCacheIsAuthoritative(
  cached: { stats: unknown; computedAt: number } | null,
): cached is { stats: ConnectGraphStatsView; computedAt: number } {
  if (!cached) return false;
  const stats = (cached.stats ?? null) as ConnectGraphStatsView | null;
  if (!statsHaveGraphUnits(stats)) return false;
  return Date.now() - cached.computedAt < STATS_CACHE_TTL_MS;
}

const SOPHIA_UNIT_TABLE_FALLBACKS = ["claim", "idea", "unit", "statement"] as const;

async function discoverBestUnitCount(
  store: GraphStore,
  packs: ConnectDomainPack[],
): Promise<{ units: number; domainPackId: string | null }> {
  let units = 0;
  let domainPackId: string | null = null;
  const triedTables = new Set<string>();

  for (const pack of packs) {
    const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");
    if (triedTables.has(unitTable)) continue;
    triedTables.add(unitTable);
    const count = await surrealCount(store, unitTable);
    if (count > units) {
      units = count;
      domainPackId = pack.id;
    }
  }

  if (units > 0) return { units, domainPackId };

  for (const table of SOPHIA_UNIT_TABLE_FALLBACKS) {
    if (triedTables.has(table)) continue;
    const count = await surrealCount(store, table);
    if (count > units) {
      units = count;
      domainPackId = packs.find((p) => tableIdent(p.graph_schema.unit_table, "unit") === table)?.id ?? null;
    }
  }

  return { units, domainPackId };
}

/** Single aggregate count with a WHERE clause; null when the query fails. */
export async function surrealCountWhere(
  store: GraphStore,
  table: string,
  where: string,
): Promise<number | null> {
  try {
    const rows = await store.query<{ count?: number }[]>(
      `SELECT count() AS count FROM ${table} WHERE ${where} GROUP ALL;`,
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return null;
  }
}

/**
 * Triage counts (awaiting human review, unsupported untriaged) for the unit table.
 *
 * Computed with aggregate count() queries so a large graph never has to be paged
 * fully into the dashboard's memory (that path OOM-crashed the app). Falls back to
 * a *bounded* scan if the Surreal build lacks `string::startsWith`, so it stays
 * safe (capped) even on the fallback path.
 */
async function surrealTriageCounts(
  store: GraphStore,
  unitTable: string,
): Promise<{ awaiting_triage: number; unsupported_untriaged: number }> {
  // A weak/unsupported unit is "untriaged" until an operator saves a verdict, which
  // writes a note beginning with HUMAN_REVIEW_NOTE_PREFIX ("Human review:").
  const notHumanReviewed =
    `(validation_note IS NONE OR string::startsWith(validation_note, '${HUMAN_REVIEW_NOTE_PREFIX}') != true)`;
  const [awaiting, unsupported] = await Promise.all([
    surrealCountWhere(
      store,
      unitTable,
      `(validation_status = 'weak' OR validation_status = 'unsupported') AND ${notHumanReviewed}`,
    ),
    surrealCountWhere(
      store,
      unitTable,
      `validation_status = 'unsupported' AND ${notHumanReviewed}`,
    ),
  ]);

  if (awaiting != null && unsupported != null) {
    return { awaiting_triage: awaiting, unsupported_untriaged: unsupported };
  }

  // Fallback: bounded scan (capped at SURREAL_GRAPH_UNIT_MAX) — approximate but never OOM.
  const result = { awaiting_triage: 0, unsupported_untriaged: 0 };
  try {
    const rows = await paginateSurrealUnitRows<{
      validation_status?: string | null;
      validation_note?: string | null;
    }>(store, (limit, start) =>
      `SELECT validation_status, validation_note FROM ${unitTable} LIMIT ${limit} START ${start};`,
    );
    for (const row of rows) {
      if (isAwaitingHumanTriage(row.validation_status, row.validation_note)) {
        result.awaiting_triage += 1;
      }
      if (matchesGraphRevalidateScope(row.validation_status, row.validation_note, "unsupported")) {
        result.unsupported_untriaged += 1;
      }
    }
  } catch (err) {
    console.warn(
      `[connect-graph-explorer] triage count fallback failed for ${unitTable}:`,
      err instanceof Error ? err.message : err,
    );
  }
  return result;
}

async function mapSurrealRawRows(
  store: GraphStore,
  pack: ConnectDomainPack,
  rows: Record<string, unknown>[],
  variant: string,
  mapOpts?: MapSurrealRawRowsOpts,
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
        // EBV summary from the unit record's evidence_* fields (W2.2); null = pre-EBV.
        evidence: composeEvidenceSummaryFromSurrealRow(u),
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
  if (!mapOpts?.skipAuthorEnrichment) {
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
  }
  return { units: unitRows, unitsLoadError };
}

/** Validation breakdown via a single GROUP BY scan. */
async function surrealValidationCounts(
  store: GraphStore,
  unitTable: string,
  unitFallback: number,
): Promise<{ ok: number; weak: number; unsupported: number; unvalidated: number }> {
  const out = { ok: 0, weak: 0, unsupported: 0, unvalidated: 0 };
  try {
    const valRows = await store.query<{ validation_status?: string | null; count?: number }[]>(
      `SELECT validation_status, count() AS count FROM ${unitTable} GROUP BY validation_status;`,
    );
    for (const row of valRows) {
      const c = Number(row.count ?? 0);
      const s = normalizeValidationStatus(row.validation_status);
      if (s === "ok") out.ok += c;
      else if (s === "weak") out.weak += c;
      else if (s === "unsupported") out.unsupported += c;
      else out.unvalidated += c;
    }
  } catch {
    if (unitFallback > 0) out.unvalidated = unitFallback;
  }
  return out;
}

function emptyEvidenceStateCounts(): ConnectEvidenceStateCounts {
  return { supported: 0, inferred: 0, unverified: 0, contradicted: 0, excluded: 0 };
}

/**
 * Evidence facet counts (W2.2) from a BYO Surreal unit table: one GROUP BY over
 * `verification_state`. Returns null when the store cannot answer — the facet
 * then shows "store could not answer" rather than fabricated zeros.
 */
export async function surrealEvidenceStateCounts(
  store: GraphStore,
  unitTable: string,
): Promise<ConnectEvidenceStateCounts | null> {
  try {
    const rows = await store.query<{ verification_state?: string | null; count?: number }[]>(
      `SELECT verification_state, count() AS count FROM ${unitTable} GROUP BY verification_state;`,
    );
    const out = emptyEvidenceStateCounts();
    for (const row of rows ?? []) {
      const s = typeof row.verification_state === "string" ? row.verification_state : null;
      if (s && (VERIFICATION_STATES as readonly string[]).includes(s)) {
        out[s as VerificationState] += Number(row.count ?? 0);
      }
    }
    return out;
  } catch {
    return null;
  }
}

/** Evidence facet counts from the Postgres spine (current claim versions). */
async function postgresEvidenceStateCounts(
  workspaceId: string,
): Promise<ConnectEvidenceStateCounts | null> {
  try {
    const breakdown = await getConnectClaimVersionBreakdownPostgres(workspaceId);
    const out = emptyEvidenceStateCounts();
    for (const [state, count] of Object.entries(breakdown.verificationStates)) {
      if ((VERIFICATION_STATES as readonly string[]).includes(state)) {
        out[state as VerificationState] += Number(count);
      }
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Recompute ONLY the validation breakdown + triage counts from the live store.
 * These change on every validate run, so they must not be trapped behind the
 * structural-stats cache (relations/groups/embedded) and its TTL — otherwise the
 * breakdown keeps showing stale 0s after a run. Cheap: one GROUP BY + two counts,
 * no per-row dereference. Best-effort — returns null on any error so callers fall
 * back to the cached validation mix.
 */
export async function refreshSurrealValidationBreakdown(
  store: GraphStore,
  unitTable: string,
  unitFallback: number,
): Promise<ConnectGraphStatsView["validation"] | null> {
  try {
    const [counts, triage] = await Promise.all([
      surrealValidationCounts(store, unitTable, unitFallback),
      surrealTriageCounts(store, unitTable),
    ]);
    return {
      ok: counts.ok,
      weak: counts.weak,
      unsupported: counts.unsupported,
      unvalidated: counts.unvalidated,
      awaiting_triage: triage.awaiting_triage,
      unsupported_untriaged: triage.unsupported_untriaged,
    };
  } catch {
    return null;
  }
}

async function loadSurrealGraphStats(
  workspaceId: string,
  pack: ConnectDomainPack,
  reuseStore?: GraphStore | null,
): Promise<{ stats: ConnectGraphStatsView; detectedVectorField: string } | null> {
  const store = reuseStore ?? (await buildWorkspaceGraphStore(workspaceId));
  if (!store) return null;

  const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");
  const groupTable = tableIdent(pack.graph_schema.group_table, "group");
  const partOfEdge = tableIdent(pack.graph_schema.part_of_edge, "part_of");
  const edgeTables = [
    ...pack.graph_schema.relation_edges.map((e) => tableIdent(e, "relates_to")),
    partOfEdge,
  ];

  // Fire every count concurrently — these are independent full-table aggregates and
  // were previously awaited serially, summing minutes of round-trips on a large graph.
  // `detectEmbeddedUnits` also probes common vector field names so a BYO graph that
  // stored vectors as `vector` (etc.) isn't reported as "0 embedded".
  const [units, edgeCounts, groups, embedDetect, triage] = await Promise.all([
    surrealCount(store, unitTable),
    Promise.all(edgeTables.map((edge) => surrealCount(store, edge))),
    surrealCount(store, groupTable),
    detectEmbeddedUnits(store, unitTable, pack.graph_schema.unit_vector_field),
    surrealTriageCounts(store, unitTable),
  ]);
  const relations = edgeCounts.reduce((sum, n) => sum + n, 0);
  const validationBreakdown = await surrealValidationCounts(store, unitTable, units);

  const validation = {
    ...validationBreakdown,
    awaiting_triage: triage.awaiting_triage,
    unsupported_untriaged: triage.unsupported_untriaged,
  };

  return {
    stats: { units, relations, groups, embedded: embedDetect.embedded, validation },
    detectedVectorField: embedDetect.field,
  };
}

/**
 * How long a cached Surreal stats entry (with units > 0) is treated as fresh.
 * Env-tunable: CONNECT_STATS_TTL_MS (legacy alias: RESTORMEL_GRAPH_STATS_CACHE_TTL_MS).
 * Default: 5 minutes.
 */
const STATS_CACHE_TTL_MS = (() => {
  const raw =
    Number(process.env.CONNECT_STATS_TTL_MS) ||
    Number(process.env.RESTORMEL_GRAPH_STATS_CACHE_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 5 * 60_000;
})();

/**
 * How long a "all packs returned 0 units" result suppresses the expensive multi-pack
 * probe fan-out.  A misconfigured workspace would wait at most this long before the
 * probe re-runs when the pack is corrected.
 * Env-tunable: CONNECT_PACK_PROBE_NEG_TTL_MS.  Default: 2 minutes.
 */
const PACK_PROBE_NEG_TTL_MS = (() => {
  const raw = Number(process.env.CONNECT_PACK_PROBE_NEG_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 2 * 60_000;
})();

/**
 * Short-lived in-process Postgres spine stats cache.
 * Avoids the 6-aggregate Neon round-trip being repeated 2–3× per hub load
 * (F6: pulse + scorecard + any other consumer all called getConnectGraphStats separately).
 *
 * TTL reuses CONNECT_STATS_TTL_MS — the same staleness guarantee as the Surreal path.
 * Cleared when forceRefresh is passed so post-ingest refreshes always get live data.
 *
 * In-flight deduplication: concurrent callers within the same Node.js tick share a
 * single Promise so even without the TTL cache the Neon round-trip happens at most once.
 */
const postgresStatsByWorkspace = new Map<
  string,
  { stats: ConnectGraphStatsView | null; at: number }
>();

const postgresStatsInFlight = new Map<string, Promise<ConnectGraphStatsView | null>>();

async function getConnectGraphStatsWithCache(
  workspaceId: string,
  forceRefresh?: boolean,
): Promise<ConnectGraphStatsView | null> {
  if (!forceRefresh) {
    const hit = postgresStatsByWorkspace.get(workspaceId);
    if (hit && Date.now() - hit.at < STATS_CACHE_TTL_MS) return hit.stats;
    const inFlight = postgresStatsInFlight.get(workspaceId);
    if (inFlight) return inFlight;
  }
  const job = getConnectGraphStats(workspaceId)
    .catch(() => null as ConnectGraphStatsView | null)
    .then((stats) => {
      postgresStatsByWorkspace.set(workspaceId, { stats, at: Date.now() });
      postgresStatsInFlight.delete(workspaceId);
      return stats;
    });
  if (!forceRefresh) postgresStatsInFlight.set(workspaceId, job);
  return job;
}

/** Evict the Postgres stats cache for a workspace (e.g. after a completed ingest run). */
export function invalidateConnectGraphStatsCache(workspaceId: string): void {
  postgresStatsByWorkspace.delete(workspaceId);
  postgresStatsInFlight.delete(workspaceId);
}

/**
 * Negative-result sentinel stored alongside stats cache.
 * When all packs returned 0 units the fan-out result is "negative".  We record
 * when that happened so subsequent loads within PACK_PROBE_NEG_TTL_MS skip the
 * expensive probe and serve the 0-unit result from cache immediately.
 *
 * Not mixed into surrealStatsCacheIsAuthoritative — authoritative needs > 0 units.
 * This is a separate suppression gate before triggering the full fan-out.
 */
const probeNegativeResultAt = new Map<string, number>();

/**
 * Compute Surreal stats for the active domain pack, reusing a single store/session.
 * Only falls back to scanning other packs (BYO schema auto-detect) when the active
 * pack returns zero units — so the common case is one pack, not N.
 *
 * Negative-result TTL (F7): when the multi-pack probe previously returned all-zeros
 * within CONNECT_PACK_PROBE_NEG_TTL_MS, the fan-out is suppressed and the stale
 * zero result is served immediately.  This stops misconfigured workspaces from
 * issuing 4+ full-table count()s per pack on every stats refresh.
 */
async function computeSurrealStats(
  workspaceId: string,
  opts?: { forceRefresh?: boolean },
): Promise<{ stats: ConnectGraphStatsView; domainPackId: string | null } | null> {
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return null;

  let best: { stats: ConnectGraphStatsView; domainPackId: string | null } | null = null;
  let bestUnits = -1;

  const activePack = await resolveActiveDomainPackForGraph(workspaceId);
  if (activePack) {
    const r = await loadSurrealGraphStats(workspaceId, activePack, store);
    // Fast path: the active pack matches real data — no need to probe the others.
    if (r && r.stats.units > 0) {
      probeNegativeResultAt.delete(workspaceId);
      await persistDetectedVectorField(workspaceId, activePack, r.detectedVectorField);
      return { stats: r.stats, domainPackId: activePack.id };
    }
    if (r) {
      best = { stats: r.stats, domainPackId: activePack.id };
      bestUnits = r.stats.units;
    }
  }

  // Negative-result TTL: skip the multi-pack probe if a previous scan already found
  // zero units for all packs within the suppression window.  forceRefresh overrides.
  if (!opts?.forceRefresh) {
    const negAt = probeNegativeResultAt.get(workspaceId);
    if (negAt !== undefined && Date.now() - negAt < PACK_PROBE_NEG_TTL_MS) {
      return best; // serve 0-unit result without re-probing every pack
    }
  }

  // Auto-detect: the active pack returned zero units, so it likely doesn't match this
  // BYO schema — probe the other packs and keep the one with the most units. Cached
  // afterwards, so this cold-miss-only fan-out doesn't recur on every load.
  const packs = (await resolveDomainPacksForGraph(workspaceId)).filter(
    (p) => p.id !== activePack?.id,
  );
  for (const pack of packs) {
    const r = await loadSurrealGraphStats(workspaceId, pack, store);
    if (r && r.stats.units > bestUnits) {
      best = { stats: r.stats, domainPackId: pack.id };
      bestUnits = r.stats.units;
      await persistDetectedVectorField(workspaceId, pack, r.detectedVectorField);
    }
  }

  // Record a negative result so the next load within the TTL skips this fan-out.
  if (bestUnits <= 0) {
    probeNegativeResultAt.set(workspaceId, Date.now());
  } else {
    probeNegativeResultAt.delete(workspaceId);
  }

  return best;
}

/**
 * When stats detected the embedding vector under a different field than the pack
 * records, persist it (non-builtin packs only) so re-embed writes and dense
 * retrieval target the same field the BYO graph already uses.
 */
async function persistDetectedVectorField(
  workspaceId: string,
  pack: ConnectDomainPack,
  detectedField: string,
): Promise<void> {
  if (!detectedField || detectedField === pack.graph_schema.unit_vector_field) return;
  await persistDomainPackVectorField(workspaceId, pack.id, detectedField).catch(() => {});
}

export type SurrealGraphReadContext = {
  store: GraphStore;
  pack: ConnectDomainPack;
  unitTable: string;
};

/**
 * Read context for aggregate readers (trust scorecard, audits) against the active
 * Surreal graph: the store session plus the unit table of the pack the cached stats
 * were computed with (so aggregate counts line up with resolveConnectGraphStats),
 * falling back to the workspace's selected/active pack. Null when no configured
 * Surreal target, unreachable store, or no pack.
 */
export async function resolveSurrealGraphReadContext(
  workspaceId: string,
): Promise<SurrealGraphReadContext | null> {
  const target = await getConnectGraphTargetForWorkspace(workspaceId);
  if (!isConfiguredSurrealTarget(target)) return null;
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return null;
  const statsPackId = await resolveCachedStatsPackId(workspaceId, target.id).catch(() => null);
  const pack =
    (statsPackId ? await loadDomainPackById(workspaceId, statsPackId) : null) ??
    (await resolveActiveDomainPackForGraph(workspaceId));
  if (!pack) return null;
  return { store, pack, unitTable: tableIdent(pack.graph_schema.unit_table, "unit") };
}

type QuickGraphStatsResult = {
  stats: ConnectGraphStatsView;
  domainPackId: string | null;
};

/** One fast unit count when the Postgres stats cache is empty or zero — avoids full aggregates. */
async function quickConnectGraphStats(workspaceId: string): Promise<QuickGraphStatsResult | null> {
  const target = await getConnectGraphTargetForWorkspace(workspaceId);
  if (!isConfiguredSurrealTarget(target)) {
    const stats = await getConnectGraphStats(workspaceId).catch(() => null);
    return stats ? { stats, domainPackId: null } : null;
  }
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return null;

  const [cachedPackId, activePack, packs] = await Promise.all([
    resolveCachedStatsPackId(workspaceId, target.id).catch(() => null),
    resolveActiveDomainPackForGraph(workspaceId),
    resolveDomainPacksForGraph(workspaceId),
  ]);

  const seen = new Set<string>();
  const probeOrder: ConnectDomainPack[] = [];
  for (const pack of [cachedPackId ? packs.find((p) => p.id === cachedPackId) : null, activePack, ...packs]) {
    if (!pack || seen.has(pack.id)) continue;
    seen.add(pack.id);
    probeOrder.push(pack);
  }

  const { units, domainPackId } = await discoverBestUnitCount(store, probeOrder.length ? probeOrder : packs);

  return {
    domainPackId,
    stats: {
      units,
      relations: 0,
      groups: 0,
      embedded: 0,
      validation: {
        ok: 0,
        weak: 0,
        unsupported: 0,
        unvalidated: units,
        awaiting_triage: 0,
        unsupported_untriaged: 0,
      },
    },
  };
}

/**
 * Return cached Surreal stats immediately when available; on a cold/zero cache serve
 * a fast *display-only* unit count so the page isn't blank.
 *
 * The skeleton is never written to the stats cache: it omits relations, groups,
 * embedded, and the validation mix, so persisting it would mask the real aggregates
 * (and be treated as authoritative, blocking the background refresh). The full
 * numbers are computed and cached by `scheduleConnectGraphStatsRefresh` /
 * `resolveConnectGraphStats` and appear once that completes.
 */
export async function peekConnectGraphStatsForView(
  workspaceId: string,
): Promise<{ stats: ConnectGraphStatsView | null; partial: boolean }> {
  const peeked = await peekConnectGraphStats(workspaceId);
  scheduleConnectGraphStatsRefresh(workspaceId);

  if (statsHaveGraphUnits(peeked)) return { stats: peeked, partial: false };

  const quick = await quickConnectGraphStats(workspaceId);
  if (quick) return { stats: quick.stats, partial: true };
  return { stats: peeked ?? null, partial: false };
}

/** Fire-and-forget stats recompute when the Postgres cache is missing or past TTL. */
export function scheduleConnectGraphStatsRefresh(workspaceId: string): void {
  void (async () => {
    const target = await getConnectGraphTargetForWorkspace(workspaceId);
    if (!isConfiguredSurrealTarget(target)) return;
    const cached = await getConnectGraphStatsCache({
      workspaceId,
      graphTargetId: target.id,
    }).catch(() => null);
    if (surrealStatsCacheIsAuthoritative(cached)) return;
    await resolveConnectGraphStats(workspaceId);
  })().catch(() => {});
}

/** Dedupe concurrent full Surreal stat scans (pulse stream + background refresh). */
const inFlightSurrealStatsCompute = new Map<
  string,
  Promise<{ stats: ConnectGraphStatsView; domainPackId: string | null } | null>
>();

function computeAndCacheSurrealStats(
  workspaceId: string,
  graphTargetId: string,
  forceRefresh?: boolean,
): Promise<{ stats: ConnectGraphStatsView; domainPackId: string | null } | null> {
  // forceRefresh bypasses the in-flight dedupe so a fresh computation is guaranteed.
  const existing = forceRefresh ? undefined : inFlightSurrealStatsCompute.get(workspaceId);
  if (existing) return existing;
  const job = (async () => {
    const computed = await computeSurrealStats(workspaceId, { forceRefresh });
    if (computed) {
      await setConnectGraphStatsCache({
        workspaceId,
        graphTargetId,
        stats: computed.stats,
        domainPackId: computed.domainPackId,
      }).catch(() => {});
    }
    return computed;
  })().finally(() => inFlightSurrealStatsCompute.delete(workspaceId));
  if (!forceRefresh) inFlightSurrealStatsCompute.set(workspaceId, job);
  return job;
}

/**
 * Type for the per-request memo that collapses redundant stats resolutions.
 * Pass an instance shared across all load functions within the same request.
 */
export type ConnectStatsRequestMemo = Map<string, Promise<ConnectGraphStatsView | null>>;

/**
 * Stats from the workspace graph store (Surreal or Postgres spine) — used by Connect hub and MCP setup.
 *
 * Per-request deduplication (F6): when a `requestMemo` is provided, subsequent calls
 * within the same request reuse the in-flight Promise without issuing a second store
 * scan.  The memo is keyed by workspaceId; forceRefresh evicts it so post-ingest
 * refreshes always get live data.
 */
export async function resolveConnectGraphStats(
  workspaceId: string,
  opts?: { forceRefresh?: boolean; requestMemo?: ConnectStatsRequestMemo },
): Promise<ConnectGraphStatsView | null> {
  const memo = opts?.requestMemo;
  const forceRefresh = opts?.forceRefresh ?? false;

  // Request-scoped deduplication: if a memo is provided and already has a promise for
  // this workspace, reuse it (unless force-refresh, which must bypass everything).
  if (memo && !forceRefresh) {
    const hit = memo.get(workspaceId);
    if (hit) return hit;
  }

  const statsPromise = _resolveConnectGraphStatsImpl(workspaceId, { forceRefresh });

  // Store in memo before awaiting so concurrent callers within the same request
  // immediately get the same promise rather than starting a second resolution.
  if (memo && !forceRefresh) {
    memo.set(workspaceId, statsPromise);
  }

  return statsPromise;
}

async function _resolveConnectGraphStatsImpl(
  workspaceId: string,
  opts: { forceRefresh: boolean },
): Promise<ConnectGraphStatsView | null> {
  const { forceRefresh } = opts;
  const target = await getConnectGraphTargetForWorkspace(workspaceId);

  if (isConfiguredSurrealTarget(target)) {
    // Serve cached stats when fresh — full count() scans on a large BYO graph are slow,
    // and recomputing them on every Connect tab load is the dominant cost we're avoiding.
    if (!forceRefresh) {
      const cached = await getConnectGraphStatsCache({
        workspaceId,
        graphTargetId: target.id,
      }).catch(() => null);
      if (surrealStatsCacheIsAuthoritative(cached)) {
        return (cached!.stats ?? null) as ConnectGraphStatsView | null;
      }
    }
    const computed = await computeAndCacheSurrealStats(workspaceId, target.id, forceRefresh);
    if (computed) return computed.stats;
    // Computation failed (e.g. store unreachable) — fall back to any stale cache.
    const stale = await getConnectGraphStatsCache({
      workspaceId,
      graphTargetId: target.id,
    }).catch(() => null);
    return stale ? ((stale.stats ?? null) as ConnectGraphStatsView | null) : null;
  }

  // Postgres spine path — cache the result within process to avoid repeating the 6-aggregate
  // query for every consumer in the same hub load (pulse + scorecard).
  if (target?.provider === "postgres" && target.useDashboardDatabase) {
    return getConnectGraphStatsWithCache(workspaceId, forceRefresh);
  }

  return getConnectGraphStatsWithCache(workspaceId, forceRefresh);
}

/**
 * Fast, compute-free stats for the initial page render: returns the cached value
 * (any age) for a BYO Surreal store, or the cheap Neon-spine stats otherwise.
 * Never scans the BYO store — pair with `resolveConnectGraphStats` to stream the
 * authoritative (possibly recomputed) numbers in afterwards.
 */
export async function peekConnectGraphStats(
  workspaceId: string,
): Promise<ConnectGraphStatsView | null> {
  const target = await getConnectGraphTargetForWorkspace(workspaceId);
  if (isConfiguredSurrealTarget(target)) {
    const cached = await getConnectGraphStatsCache({
      workspaceId,
      graphTargetId: target.id,
    }).catch(() => null);
    return cached ? ((cached.stats ?? null) as ConnectGraphStatsView | null) : null;
  }
  return getConnectGraphStats(workspaceId).catch(() => null);
}

/** Resolve the active domain pack id cached alongside the last computed stats (or null). */
async function resolveCachedStatsPackId(
  workspaceId: string,
  graphTargetId: string,
): Promise<string | null> {
  const cached = await getConnectGraphStatsCache({ workspaceId, graphTargetId }).catch(() => null);
  return cached?.domainPackId ?? null;
}

async function loadDomainPackById(
  workspaceId: string,
  packId: string,
): Promise<ConnectDomainPack | null> {
  const row = await getConnectDomainPackById({ id: packId, workspaceId }).catch(() => null);
  if (!row) return null;
  try {
    return domainPackRecordToApi(row);
  } catch {
    return null;
  }
}

async function loadSurrealGraphView(
  workspaceId: string,
  pack: ConnectDomainPack,
  stats: ConnectGraphStatsView,
  store: GraphStore,
  opts?: LoadConnectGraphViewOpts,
): Promise<ConnectGraphView> {
  const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");
  const groupTable = tableIdent(pack.graph_schema.group_table, "group");
  const partOfEdge = tableIdent(pack.graph_schema.part_of_edge, "part_of");

  const units = stats.units;

  const unitLimit = Math.min(
    Math.max(opts?.unitLimit ?? GRAPH_EXPLORER_PAGE_SIZE, 1),
    SURREAL_GRAPH_UNIT_PAGE_SIZE,
  );
  const unitOffset = Math.max(opts?.unitOffset ?? 0, 0);
  const skipUnits = opts?.skipUnits === true;
  const skipGroups = opts?.skipGroups === true;

  let unitRows: ConnectGraphUnitView[] = [];
  let unitsLoadError: string | null = null;
  if (!skipUnits) {
  try {
    const { rows, variant } =
      unitOffset === 0 && unitLimit >= GRAPH_EXPLORER_PAGE_SIZE * 10
        ? await loadSurrealExplorerUnitRows(store, unitTable)
        : await loadSurrealExplorerUnitPage(store, unitTable, { start: unitOffset, limit: unitLimit });
    const mapped = await mapSurrealRawRows(store, pack, rows, variant, {
      skipAuthorEnrichment: true,
    });
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
  }

  let groupRows: ConnectGraphGroupView[] = [];
  if (!skipGroups) try {
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
      limit: skipUnits ? GRAPH_EXPLORER_PAGE_SIZE : unitLimit,
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
  const [sourceCatalogStatus, target] = await Promise.all([
    loadGraphSourceCatalogStatus(workspaceId).catch(() => ({
      pipelineCatalogCount: 0,
      sourcesInPipeline: false,
    })),
    getConnectGraphTargetForWorkspace(workspaceId),
  ]);

  // Ingest writes to Surreal whenever a target is configured; explorer must read the same store
  // even when status is still "untested" (save without test) or was reset on upsert.
  if (isConfiguredSurrealTarget(target)) {
    const storeLabel = surrealStoreLabel(target);
    const targetStatus: ConnectGraphView["targetStatus"] =
      target.status === "untested" || target.status === "error" ? target.status : undefined;

    scheduleConnectGraphStatsRefresh(workspaceId);
    const deferUnits = opts?.skipUnits === true;
    const [statsResult, store, statsPackId, activePack] = await Promise.all([
      peekConnectGraphStatsForView(workspaceId).catch(() => null),
      deferUnits ? Promise.resolve(null) : buildWorkspaceGraphStore(workspaceId),
      resolveCachedStatsPackId(workspaceId, target.id).catch(() => null),
      resolveActiveDomainPackForGraph(workspaceId),
    ]);
    let stats = statsResult?.stats ?? null;
    const statsPartial = statsResult?.partial ?? false;
    const pack =
      (statsPackId ? await loadDomainPackById(workspaceId, statsPackId) : null) ?? activePack;
    const graphStore = store ?? (deferUnits ? null : await buildWorkspaceGraphStore(workspaceId));

    // The validation breakdown changes on every validate run; recompute it live and
    // overlay so the page never serves a stale cached 0/0/0 (structural counts —
    // relations/groups/embedded — stay cached). Cheap aggregate, best-effort.
    // The Evidence facet counts (W2.2) ride the same store session — one extra GROUP BY.
    let evidenceStates: ConnectEvidenceStateCounts | null = null;
    if (stats && pack) {
      const vStore = graphStore ?? (await buildWorkspaceGraphStore(workspaceId).catch(() => null));
      if (vStore) {
        const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");
        const [freshValidation, evidenceCounts] = await Promise.all([
          refreshSurrealValidationBreakdown(vStore, unitTable, stats.units),
          surrealEvidenceStateCounts(vStore, unitTable),
        ]);
        if (freshValidation) stats = { ...stats, validation: freshValidation };
        evidenceStates = evidenceCounts;
      }
    }

    if (pack && graphStore && stats) {
      const view = await loadSurrealGraphView(workspaceId, pack, stats, graphStore, {
        ...viewOpts,
        skipUnits: opts?.skipUnits,
        skipGroups: opts?.skipGroups ?? deferUnits,
      });
      return {
        ...view,
        storeLabel,
        reviewEnabled: true,
        sourceCatalogStatus,
        evidenceStates,
        ...(targetStatus ? { targetStatus } : {}),
        ...(statsPartial ? { statsPartial: true } : {}),
      };
    }
    if (pack && deferUnits) {
      return {
        store: "surreal",
        storeLabel,
        domainPackId: pack.id,
        domainPackTitle: pack.title,
        reviewEnabled: true,
        sourceCatalogStatus,
        evidenceStates,
        ...(targetStatus ? { targetStatus } : {}),
        ...(statsPartial ? { statsPartial: true } : {}),
        stats,
        groups: [],
        units: [],
        unitsPagination: paginationMeta({
          offset: 0,
          limit: GRAPH_EXPLORER_PAGE_SIZE,
          loaded: 0,
          total: stats?.units ?? null,
        }),
      };
    }
    return {
      store: "surreal",
      storeLabel,
      reviewEnabled: true,
      sourceCatalogStatus,
      evidenceStates,
      ...(targetStatus ? { targetStatus } : {}),
      ...(statsPartial ? { statsPartial: true } : {}),
      stats: stats ?? null,
      groups: [],
      units: [],
    };
  }

  if (target?.provider === "postgres" && target.useDashboardDatabase) {
    const [stats, explorer, evidenceStates] = await Promise.all([
      getConnectGraphStats(workspaceId).catch(() => null),
      getConnectGraphExplorer(workspaceId, { unitLimit, unitOffset }).catch(() => ({
        groups: [],
        units: [],
      })),
      postgresEvidenceStateCounts(workspaceId),
    ]);
    const sorted = sortGraphUnitsForReview(
      await enrichPostgresUnitsWithEvidence(workspaceId, explorer.units),
    );
    return {
      store: "postgres",
      storeLabel: "Postgres graph spine",
      reviewEnabled: true,
      sourceCatalogStatus,
      stats,
      evidenceStates,
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
  const [stats, explorer, evidenceStates] = await Promise.all([
    getConnectGraphStats(workspaceId).catch(() => null),
    getConnectGraphExplorer(workspaceId, { unitLimit, unitOffset }).catch(() => ({
      groups: [],
      units: [],
    })),
    postgresEvidenceStateCounts(workspaceId),
  ]);
  const hasSpine = Boolean(stats && stats.units > 0);
  const sorted = sortGraphUnitsForReview(
    await enrichPostgresUnitsWithEvidence(workspaceId, explorer.units),
  );
  return {
    store: hasSpine ? "postgres" : "none",
    storeLabel: hasSpine ? "Postgres graph spine" : "No graph store connected",
    reviewEnabled: hasSpine,
    sourceCatalogStatus,
    stats,
    evidenceStates,
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

/** Attach EBV summaries (W2.2) to a page of Postgres-spine unit views (one round-trip). */
async function enrichPostgresUnitsWithEvidence(
  workspaceId: string,
  units: ConnectGraphUnitView[],
): Promise<ConnectGraphUnitView[]> {
  if (units.length === 0) return units;
  const summaries = await loadConnectUnitEvidenceSummaries({
    workspaceId,
    unitIds: units.map((u) => u.id),
  });
  return units.map((u) => ({ ...u, evidence: summaries.get(u.id) ?? null }));
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
    const cachedStats = await peekConnectGraphStats(workspaceId).catch(() => null);
    const total = cachedStats?.units ?? (await surrealCount(store, unitTable));
    try {
      const { rows, variant } = await loadSurrealExplorerUnitPage(store, unitTable, {
        start: offset,
        limit,
      });
      const mapped = await mapSurrealRawRows(store, pack, rows, variant, {
        skipAuthorEnrichment: true,
      });
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
  const sorted = sortGraphUnitsForReview(
    await enrichPostgresUnitsWithEvidence(workspaceId, explorer.units),
  );
  const total = stats?.units ?? null;
  return {
    units: sorted,
    hasMore: total != null ? offset + sorted.length < total : sorted.length >= limit,
    total,
    domainPackId: null,
  };
}

/**
 * W2.5 — units page projected onto an as-of instant (or full audit view), with an
 * honest `as_of_status`. Loads the CURRENT page via `loadConnectGraphUnitsPage`, then
 * applies the temporal projection per store capability (Postgres spine answers; BYO
 * Surreal / no target degrade explicitly). A READ-only path: issues no mutations.
 */
export async function loadConnectGraphUnitsPageAsOf(
  workspaceId: string,
  opts: {
    offset: number;
    limit: number;
    domainPackId?: string | null;
    asOf: AsOfRequest | null;
  },
): Promise<LoadConnectGraphUnitsPageResult & { asOfStatus: AsOfStatus }> {
  const page = await loadConnectGraphUnitsPage(workspaceId, {
    offset: opts.offset,
    limit: opts.limit,
    domainPackId: opts.domainPackId,
  });

  if (!opts.asOf) {
    return { ...page, asOfStatus: { requested: false } };
  }

  const target = await getConnectGraphTargetForWorkspace(workspaceId).catch(() => null);
  const provider = target?.provider ?? null;
  const projected = await applyExplorerAsOf({
    workspaceId,
    provider,
    units: page.units,
    request: opts.asOf,
  });
  return { ...page, units: projected.units, asOfStatus: projected.asOfStatus };
}

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
  validation: { ok: number; weak: number; unsupported: number; unvalidated: number };
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
};

function reviewPriority(status: string | null | undefined): number {
  if (status === "unsupported") return 0;
  if (status === "weak") return 1;
  if (!status || status === "unvalidated") return 2;
  if (status === "ok") return 3;
  return 2;
}

function sortUnitsForReview(units: ConnectGraphUnitView[]): ConnectGraphUnitView[] {
  return [...units].sort((a, b) => {
    const p = reviewPriority(a.validationStatus) - reviewPriority(b.validationStatus);
    if (p !== 0) return p;
    return a.text.localeCompare(b.text);
  });
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

async function loadSurrealGraphView(
  workspaceId: string,
  pack: ConnectDomainPack,
): Promise<ConnectGraphView | null> {
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
    // SurrealQL: use `IS NOT NONE` (SOPHIA kg audit); `!= NONE` can under-count.
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

  const validation = { ok: 0, weak: 0, unsupported: 0, unvalidated: 0 };
  try {
    const valRows = await store.query<{ validation_status?: string | null; count?: number }[]>(
      `SELECT validation_status, count() AS count FROM ${unitTable} GROUP BY validation_status;`,
    );
    for (const row of valRows) {
      const c = Number(row.count ?? 0);
      const s = row.validation_status;
      if (s === "ok") validation.ok = c;
      else if (s === "weak") validation.weak = c;
      else if (s === "unsupported") validation.unsupported = c;
      else validation.unvalidated += c;
    }
  } catch {
    if (units > 0) validation.unvalidated = units;
  }

  let unitRows: ConnectGraphUnitView[] = [];
  try {
    const rows = await store.query<
      {
        id?: string | { toString(): string };
        text?: string;
        unit_type?: string | null;
        domain?: string | null;
        validation_status?: string | null;
        validation_note?: string | null;
        source?: unknown;
        source_title?: string | null;
        source_url?: string | null;
        source_kind?: string | null;
      }[]
    >(
      `SELECT id, text, unit_type, domain, validation_status, validation_note, source.title AS source_title, source.url AS source_url, source.source_kind AS source_kind, source FROM ${unitTable} FETCH source LIMIT 100;`,
    );
    const parsed = rows
      .filter((u) => typeof u.text === "string" && u.text.trim())
      .map((u) => {
        const id =
          formatSurrealRecordId(u.id) ??
          (typeof u.id === "string" ? u.id : crypto.randomUUID());
        const fetched = parseFetchedSource(u.source);
        return {
          id,
          text: u.text!.trim(),
          unitType: u.unit_type ?? null,
          domain: u.domain ?? null,
          validationStatus: u.validation_status ?? null,
          validationNote: u.validation_note ?? null,
          sourceTitle:
            (typeof u.source_title === "string" && u.source_title.trim()
              ? u.source_title.trim()
              : null) ?? fetched.title,
          sourceUrl:
            (typeof u.source_url === "string" && u.source_url.trim() ? u.source_url.trim() : null) ??
            fetched.url,
          sourceKind:
            (typeof u.source_kind === "string" && u.source_kind.trim()
              ? u.source_kind.trim()
              : null) ?? fetched.kind,
          author: null as string | null,
          sourceId: fetched.id,
        };
      });

    const sourceIds = [
      ...new Set(parsed.map((u) => u.sourceId).filter((id): id is string => Boolean(id))),
    ];
    const authorsBySource = await loadAuthorsBySourceId(store, pack, sourceIds);
    unitRows = parsed.map(({ sourceId, ...unit }) => ({
      ...unit,
      author: sourceId ? (authorsBySource.get(sourceId) ?? null) : null,
    }));
  } catch {
    unitRows = [];
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
    stats: { units, relations, groups, embedded, validation },
    groups: groupRows,
    units: sortUnitsForReview(unitRows),
  };
}

/** Load graph explorer data from the workspace's configured graph store. */
export async function loadConnectGraphView(workspaceId: string): Promise<ConnectGraphView> {
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
        const surreal = await loadSurrealGraphView(workspaceId, pack);
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
      getConnectGraphExplorer(workspaceId).catch(() => ({ groups: [], units: [] })),
    ]);
    return {
      store: "postgres",
      storeLabel: "Postgres graph spine",
      reviewEnabled: true,
      stats,
      groups: explorer.groups,
      units: sortUnitsForReview(explorer.units),
    };
  }

  // Legacy / no target: still surface Postgres spine rows if present.
  const [stats, explorer] = await Promise.all([
    getConnectGraphStats(workspaceId).catch(() => null),
    getConnectGraphExplorer(workspaceId).catch(() => ({ groups: [], units: [] })),
  ]);
  const hasSpine = Boolean(stats && stats.units > 0);
  return {
    store: hasSpine ? "postgres" : "none",
    storeLabel: hasSpine ? "Postgres graph spine" : "No graph store connected",
    reviewEnabled: hasSpine,
    stats,
    groups: explorer.groups,
    units: sortUnitsForReview(explorer.units),
  };
}

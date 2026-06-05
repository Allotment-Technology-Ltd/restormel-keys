/**
 * Lightweight relation edges for Connect graph cluster detail (bounded preview).
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import { domainPackRecordToApi } from "$lib/server/connect/domain-pack-service";
import { formatSurrealRecordId, surrealRecordRef } from "$lib/server/connect/graph-writer";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import { pickSurrealUnitText } from "$lib/server/connect/surreal-graph-units-load";
import {
  ensureIngestionRoutingSchema,
  getConnectDomainPackById,
  getConnectGraphTargetForWorkspace,
  getSql,
} from "$lib/server/neon";

export type GraphRelationPreviewRow = {
  relationType: string;
  fromText: string;
  toText: string;
  fromUnitId: string | null;
  toUnitId: string | null;
};

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function tableIdent(name: string, fallback: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENT.test(s) ? s : fallback;
}

function truncateText(text: string, max = 120): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function relationKey(row: GraphRelationPreviewRow): string {
  return `${row.relationType}|${row.fromText}|${row.toText}`;
}

async function resolveSurrealPack(
  workspaceId: string,
  domainPackId: string | null | undefined,
): Promise<ConnectDomainPack | null> {
  if (!domainPackId) return null;
  const row = await getConnectDomainPackById({ id: domainPackId, workspaceId });
  if (!row) return null;
  try {
    return domainPackRecordToApi(row);
  } catch {
    return null;
  }
}

async function loadPostgresRelationPreview(params: {
  workspaceId: string;
  unitIds: string[];
  limit: number;
}): Promise<GraphRelationPreviewRow[]> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const ids = [...new Set(params.unitIds)].filter(Boolean).slice(0, 80);
  if (ids.length === 0) return [];

  const rows = (await sql`
    SELECT
      r.relation_type,
      r.from_unit_id,
      r.to_unit_id,
      fu.text AS from_text,
      tu.text AS to_text
    FROM knowledge_graph_relations r
    JOIN knowledge_graph_units fu
      ON fu.id = r.from_unit_id AND fu.workspace_id = r.workspace_id
    JOIN knowledge_graph_units tu
      ON tu.id = r.to_unit_id AND tu.workspace_id = r.workspace_id
    WHERE r.workspace_id = ${params.workspaceId}
      AND (r.from_unit_id = ANY(${ids}) OR r.to_unit_id = ANY(${ids}))
    ORDER BY r.created_at DESC
    LIMIT ${params.limit}
  `) as {
    relation_type: string;
    from_unit_id: string;
    to_unit_id: string;
    from_text: string;
    to_text: string;
  }[];

  return rows
    .filter((r) => r.from_text?.trim() && r.to_text?.trim())
    .map((r) => ({
      relationType: r.relation_type,
      fromText: truncateText(r.from_text),
      toText: truncateText(r.to_text),
      fromUnitId: r.from_unit_id,
      toUnitId: r.to_unit_id,
    }));
}

async function loadSurrealRelationPreview(params: {
  workspaceId: string;
  pack: ConnectDomainPack;
  unitIds: string[];
  limit: number;
}): Promise<GraphRelationPreviewRow[]> {
  const store = await buildWorkspaceGraphStore(params.workspaceId);
  if (!store) return [];

  const partOfEdge = tableIdent(params.pack.graph_schema.part_of_edge, "part_of");
  const edgeTables = params.pack.graph_schema.relation_edges
    .map((e) => tableIdent(e, "relates_to"))
    .filter((t) => t !== partOfEdge);

  const refs = [...new Set(params.unitIds)]
    .filter(Boolean)
    .slice(0, 80)
    .map((id) => surrealRecordRef(id))
    .join(", ");
  if (!refs) return [];

  const out: GraphRelationPreviewRow[] = [];
  const seen = new Set<string>();

  for (const edgeTable of edgeTables) {
    if (out.length >= params.limit) break;
    const remaining = params.limit - out.length;
    try {
      const rows = await store.query<
        {
          from_id?: unknown;
          to_id?: unknown;
          from_text?: string | null;
          to_text?: string | null;
          in?: Record<string, unknown>;
          out?: Record<string, unknown>;
        }[]
      >(
        `SELECT
          in.id AS from_id,
          out.id AS to_id,
          in.text AS from_text,
          out.text AS to_text
        FROM ${edgeTable}
        WHERE in IN [${refs}] OR out IN [${refs}]
        LIMIT ${remaining};`,
      );
      for (const row of rows) {
        const fromText =
          (typeof row.from_text === "string" && row.from_text.trim()) ||
          pickSurrealUnitText((row.in ?? {}) as Record<string, unknown>) ||
          null;
        const toText =
          (typeof row.to_text === "string" && row.to_text.trim()) ||
          pickSurrealUnitText((row.out ?? {}) as Record<string, unknown>) ||
          null;
        if (!fromText || !toText) continue;
        const preview: GraphRelationPreviewRow = {
          relationType: edgeTable.replace(/_/g, " "),
          fromText: truncateText(fromText),
          toText: truncateText(toText),
          fromUnitId: formatSurrealRecordId(row.from_id),
          toUnitId: formatSurrealRecordId(row.to_id),
        };
        const key = relationKey(preview);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(preview);
        if (out.length >= params.limit) break;
      }
    } catch {
      // Optional edge tables may be absent on BYO schemas.
    }
  }

  return out;
}

export async function loadGraphRelationPreview(params: {
  workspaceId: string;
  unitIds: string[];
  limit?: number;
  domainPackId?: string | null;
}): Promise<
  | { ok: true; relations: GraphRelationPreviewRow[]; truncated: boolean }
  | { ok: false; status: number; message: string }
> {
  const limit = Math.min(Math.max(params.limit ?? 12, 1), 24);
  const unitIds = [...new Set(params.unitIds)].filter(Boolean).slice(0, 80);
  if (unitIds.length === 0) {
    return { ok: true, relations: [], truncated: false };
  }

  const target = await getConnectGraphTargetForWorkspace(params.workspaceId);
  if (!target) {
    return { ok: false, status: 503, message: "No graph store configured for this workspace." };
  }

  let relations: GraphRelationPreviewRow[] = [];

  if (target.provider === "postgres" && target.useDashboardDatabase) {
    relations = await loadPostgresRelationPreview({
      workspaceId: params.workspaceId,
      unitIds,
      limit: limit + 1,
    });
  } else if (target.provider === "surreal" && target.endpoint && target.namespace && target.database) {
    const pack = await resolveSurrealPack(params.workspaceId, params.domainPackId);
    if (!pack) {
      return {
        ok: false,
        status: 400,
        message: "Domain pack context is required to load relations from SurrealDB.",
      };
    }
    relations = await loadSurrealRelationPreview({
      workspaceId: params.workspaceId,
      pack,
      unitIds,
      limit: limit + 1,
    });
  } else {
    relations = await loadPostgresRelationPreview({
      workspaceId: params.workspaceId,
      unitIds,
      limit: limit + 1,
    });
  }

  const truncated = relations.length > limit;
  if (truncated) relations = relations.slice(0, limit);

  return { ok: true, relations, truncated };
}

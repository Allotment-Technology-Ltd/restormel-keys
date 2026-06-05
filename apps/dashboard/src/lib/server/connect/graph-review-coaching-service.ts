/**
 * On-demand LLM coaching for human graph unit review (operator expander).
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import { formatSurrealRecordId, surrealRecordRef } from "$lib/server/connect/graph-writer";
import { pickSurrealUnitText } from "$lib/server/connect/surreal-graph-units-load";
import {
  fetchSurrealSourceRecordText,
  resolveConnectSourceText,
} from "$lib/server/connect/connect-source-text-resolve";
import { domainPackRecordToApi } from "$lib/server/connect/domain-pack-service";
import {
  buildReviewCoachingSystemPrompt,
  buildReviewCoachingUserPrompt,
  coachingFromAiValidationNote,
  fallbackGraphReviewCoaching,
  inferSourceQualityForCoaching,
  parseGraphReviewCoachingResponse,
  type GraphReviewCoaching,
} from "$lib/connect/graph-review-coaching";
import { generateChat, isLlmConfigured } from "$lib/server/connect/llm-generate";
import {
  generateKnowledgeJsonChat,
  isConnectIngestLlmReady,
} from "$lib/server/connect/stage-route-generate";
import { resolveKnowledgeRouteExecutionContext } from "$lib/server/connect/stage-routing";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import {
  getConnectDomainPackById,
  getConnectGraphTargetForWorkspace,
  getSql,
  ensureIngestionRoutingSchema,
  listConnectDomainPacksForWorkspace,
} from "$lib/server/neon";

const SOURCE_EXCERPT_MAX = 1_800;
const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function tableIdent(name: string, fallback: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENT.test(s) ? s : fallback;
}

/** Idea fields already shown in graph review — avoids re-fetching Surreal/Postgres by id. */
export type GraphReviewCoachingUnitInput = {
  text: string;
  validationStatus?: string | null;
  validationNote?: string | null;
  unitType?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  sourceKind?: string | null;
};

type UnitCoachingContext = {
  id: string;
  text: string;
  validationStatus: string | null;
  validationNote: string | null;
  unitType: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceKind: string | null;
  sourcePreview: string | null;
  domainPackId: string | null;
  surrealSourceKey: string | null;
};

async function resolvePack(
  workspaceId: string,
  domainPackId: string | null | undefined,
): Promise<ConnectDomainPack | null> {
  let packRecord = domainPackId
    ? await getConnectDomainPackById({ id: domainPackId, workspaceId })
    : null;
  if (!packRecord) {
    const packs = await listConnectDomainPacksForWorkspace(workspaceId);
    packRecord =
      packs.find((p) => p.slug === "philosophy") ??
      packs.find((p) => p.slug === "generic") ??
      packs[0] ??
      null;
  }
  if (!packRecord) return null;
  try {
    return domainPackRecordToApi(packRecord);
  } catch {
    return null;
  }
}

async function loadPostgresUnit(
  workspaceId: string,
  unitId: string,
): Promise<UnitCoachingContext | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      u.id,
      u.text,
      u.validation_status,
      u.validation_note,
      u.unit_type,
      u.domain_pack_id,
      s.title AS source_title,
      s.url AS source_url,
      s.text_preview AS source_preview
    FROM knowledge_graph_units u
    LEFT JOIN knowledge_graph_sources s
      ON s.id = u.source_id AND s.workspace_id = u.workspace_id
    WHERE u.id = ${unitId} AND u.workspace_id = ${workspaceId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;
  const text = typeof row.text === "string" ? row.text.trim() : "";
  if (!text) return null;
  return {
    id: String(row.id),
    text,
    validationStatus:
      row.validation_status != null ? String(row.validation_status) : null,
    validationNote: row.validation_note != null ? String(row.validation_note) : null,
    unitType: row.unit_type != null ? String(row.unit_type) : null,
    sourceTitle: row.source_title != null ? String(row.source_title) : null,
    sourceUrl: row.source_url != null ? String(row.source_url) : null,
    sourceKind: null,
    sourcePreview: row.source_preview != null ? String(row.source_preview) : null,
    domainPackId: row.domain_pack_id != null ? String(row.domain_pack_id) : null,
    surrealSourceKey: null,
  };
}

function parseFetchedSource(source: unknown): {
  key: string | null;
  title: string | null;
  url: string | null;
  preview: string | null;
  kind: string | null;
} {
  if (typeof source === "string" && source.includes(":")) {
    return { key: source, title: null, url: null, preview: null, kind: null };
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { key: null, title: null, url: null, preview: null, kind: null };
  }
  const s = source as Record<string, unknown>;
  return {
    key: formatSurrealRecordId(s.id) ?? (typeof s.id === "string" ? s.id : null),
    title: typeof s.title === "string" ? s.title : null,
    url: typeof s.url === "string" ? s.url : null,
    preview: typeof s.text_preview === "string" ? s.text_preview : null,
    kind: typeof s.kind === "string" ? s.kind : null,
  };
}

function surrealUnitRecordRef(unitId: string, unitTable: string): string {
  const ref = unitId.includes(":") ? unitId : `${unitTable}:${unitId}`;
  return surrealRecordRef(ref);
}

async function loadSurrealUnit(
  workspaceId: string,
  unitId: string,
  pack: ConnectDomainPack,
): Promise<UnitCoachingContext | null> {
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return null;
  const safeTable = tableIdent(pack.graph_schema.unit_table, "unit");
  const recordRef = surrealUnitRecordRef(unitId, safeTable);
  try {
    let rows = await store.query<Record<string, unknown>[]>(
      `SELECT id, text, validation_status, validation_note, unit_type, source, source_kind, source.title AS source_title, source.url AS source_url FROM ${recordRef} FETCH source;`,
    );
    if (!rows[0]) {
      rows = await store.query<Record<string, unknown>[]>(`SELECT * FROM ${recordRef};`);
    }
    const row = rows[0];
    const text = row ? pickSurrealUnitText(row) : null;
    if (!row || !text) return null;
    const fetched = parseFetchedSource(row.source);
    const sourceTitle =
      (typeof row.source_title === "string" && row.source_title.trim()
        ? row.source_title.trim()
        : null) ?? fetched.title;
    const sourceUrl =
      (typeof row.source_url === "string" && row.source_url.trim()
        ? row.source_url.trim()
        : null) ?? fetched.url;
    return {
      id: formatSurrealRecordId(row.id) ?? unitId,
      text,
      validationStatus:
        row.validation_status != null ? String(row.validation_status) : null,
      validationNote: row.validation_note != null ? String(row.validation_note) : null,
      unitType: row.unit_type != null ? String(row.unit_type) : null,
      sourceTitle,
      sourceUrl,
      sourceKind:
        typeof row.source_kind === "string"
          ? row.source_kind
          : fetched.kind,
      sourcePreview: fetched.preview,
      domainPackId: pack.id,
      surrealSourceKey: fetched.key,
    };
  } catch {
    return null;
  }
}

function unitInputToContext(
  unitId: string,
  input: GraphReviewCoachingUnitInput,
  domainPackId: string | null,
): UnitCoachingContext | null {
  const text = input.text?.trim() ?? "";
  if (!text) return null;
  return {
    id: unitId,
    text,
    validationStatus: input.validationStatus ?? null,
    validationNote: input.validationNote ?? null,
    unitType: input.unitType ?? null,
    sourceTitle: input.sourceTitle ?? null,
    sourceUrl: input.sourceUrl ?? null,
    sourceKind: input.sourceKind ?? null,
    sourcePreview: null,
    domainPackId,
    surrealSourceKey: null,
  };
}

async function loadUnitContext(
  workspaceId: string,
  unitId: string,
  domainPackId: string | null | undefined,
): Promise<UnitCoachingContext | null> {
  const target = await getConnectGraphTargetForWorkspace(workspaceId);
  const pack = await resolvePack(workspaceId, domainPackId);
  if (target?.provider === "surreal" && pack) {
    const surreal = await loadSurrealUnit(workspaceId, unitId, pack);
    if (surreal) return surreal;
    return null;
  }
  return loadPostgresUnit(workspaceId, unitId);
}

export async function loadGraphReviewCoaching(params: {
  workspaceId: string;
  userId: string;
  unitId: string;
  domainPackId?: string | null;
  unit?: GraphReviewCoachingUnitInput | null;
}): Promise<
  | { ok: true; coaching: GraphReviewCoaching }
  | { ok: false; status: number; message: string; coaching?: GraphReviewCoaching }
> {
  const packId = params.domainPackId ?? null;
  const unit =
    params.unit != null
      ? unitInputToContext(params.unitId, params.unit, packId)
      : await loadUnitContext(params.workspaceId, params.unitId, packId);
  if (!unit) {
    return { ok: false, status: 404, message: "Idea not found in your graph store." };
  }

  let surrealFullText: string | null = null;
  if (unit.surrealSourceKey) {
    const store = await buildWorkspaceGraphStore(params.workspaceId);
    if (store) {
      const hints = await fetchSurrealSourceRecordText(store, unit.surrealSourceKey);
      unit.sourceTitle = unit.sourceTitle ?? hints.title;
      unit.sourceUrl = unit.sourceUrl ?? hints.url;
      unit.sourcePreview = unit.sourcePreview ?? hints.textPreview;
      surrealFullText = hints.fullText;
    }
  }

  const hasSourceLink = Boolean(unit.sourceUrl?.trim() || unit.sourceTitle?.trim());

  const noteCoaching = coachingFromAiValidationNote({
    validationStatus: unit.validationStatus,
    validationNote: unit.validationNote,
    sourceQuality: inferSourceQualityForCoaching({ hasSourceLink }),
  });
  if (noteCoaching) {
    return { ok: true, coaching: noteCoaching };
  }

  const resolved = await resolveConnectSourceText({
    workspaceId: params.workspaceId,
    title: unit.sourceTitle,
    url: unit.sourceUrl,
    textPreview: unit.sourcePreview,
    surrealFullText,
  });

  const fallback = () =>
    fallbackGraphReviewCoaching({
      validationStatus: unit.validationStatus,
      validationNote: unit.validationNote,
      sourceQuality: resolved.quality,
      hasSourceLink,
    });

  const routeCtx = await resolveKnowledgeRouteExecutionContext({
    workspaceId: params.workspaceId,
    userId: params.userId,
  });
  const llmReady =
    isLlmConfigured() ||
    (routeCtx
      ? await isConnectIngestLlmReady({ workspaceId: params.workspaceId, routeCtx })
      : false);

  if (!llmReady) {
    return { ok: true, coaching: fallback() };
  }

  try {
    const system = buildReviewCoachingSystemPrompt();
    const user = buildReviewCoachingUserPrompt({
      ideaText: unit.text,
      validationStatus: unit.validationStatus,
      validationNote: unit.validationNote,
      sourceTitle: unit.sourceTitle,
      sourceExcerpt: resolved.text.slice(0, SOURCE_EXCERPT_MAX),
      sourceQuality: resolved.quality,
    });
    const raw = isLlmConfigured()
      ? await generateChat({ system, user, jsonMode: true, temperature: 0.1 })
      : await generateKnowledgeJsonChat({
          ctx: routeCtx!,
          stage: "grouping",
          system,
          user,
        });
    const parsed = parseGraphReviewCoachingResponse(raw, resolved.quality);
    if (parsed) {
      return { ok: true, coaching: parsed };
    }
    return { ok: true, coaching: fallback() };
  } catch {
    return { ok: true, coaching: fallback() };
  }
}

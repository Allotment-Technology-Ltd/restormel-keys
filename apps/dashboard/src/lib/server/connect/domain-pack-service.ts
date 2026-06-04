/**
 * Knowledge domain pack service: seed built-in packs, map records to the public
 * contract, and validate upserts. A domain pack is the customisable layer that
 * makes the ingestion pipeline domain-agnostic (generalised from SOPHIA).
 */
import {
  DEFAULT_GENERIC_DOMAIN_PACK,
  ConnectDomainPackSchema,
  PHILOSOPHY_DOMAIN_PACK,
  type ConnectDomainPack,
  type ConnectDomainPackUpsert,
} from "@restormel/contracts/connect";
import {
  listConnectDomainPacksForWorkspace,
  upsertConnectDomainPack,
  getConnectDomainPackById,
  deleteConnectDomainPack,
  getConnectStageRoutingConfig,
  upsertConnectStageRoutingConfig,
  type ConnectDomainPackRecord,
} from "$lib/server/neon";

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

export function domainPackRecordToApi(row: ConnectDomainPackRecord): ConnectDomainPack {
  return ConnectDomainPackSchema.parse({
    id: row.id,
    workspace_id: row.workspaceId,
    slug: row.slug,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    ontology: row.ontology,
    prompts: row.prompts ?? {},
    graph_schema: row.graphSchema,
    passage_profile: row.passageProfile,
    ...(row.entityLinking ? { entity_linking: row.entityLinking } : {}),
    embedding: row.embedding,
    is_builtin: row.isBuiltin,
    created_at: msToIso(row.createdAt),
    updated_at: msToIso(row.updatedAt),
  });
}

async function seedBuiltinPack(workspaceId: string, pack: ConnectDomainPackUpsert): Promise<void> {
  await upsertConnectDomainPack({
    workspaceId,
    slug: pack.slug,
    title: pack.title,
    description: pack.description ?? null,
    ontology: pack.ontology,
    prompts: pack.prompts ?? {},
    graphSchema: pack.graph_schema,
    passageProfile: pack.passage_profile,
    entityLinking: pack.entity_linking ?? null,
    embedding: pack.embedding,
    isBuiltin: true,
  });
}

/** List packs for a workspace, seeding the built-in generic + philosophy packs on first use. */
export async function listDomainPacksForUi(workspaceId: string): Promise<ConnectDomainPack[]> {
  let rows = await listConnectDomainPacksForWorkspace(workspaceId);
  if (rows.length === 0) {
    await seedBuiltinPack(workspaceId, DEFAULT_GENERIC_DOMAIN_PACK);
    await seedBuiltinPack(workspaceId, PHILOSOPHY_DOMAIN_PACK);
    rows = await listConnectDomainPacksForWorkspace(workspaceId);
  }
  return rows.map(domainPackRecordToApi);
}

export async function saveDomainPack(
  workspaceId: string,
  input: ConnectDomainPackUpsert,
): Promise<ConnectDomainPack> {
  const row = await upsertConnectDomainPack({
    workspaceId,
    slug: input.slug,
    title: input.title,
    description: input.description ?? null,
    ontology: input.ontology,
    prompts: input.prompts ?? {},
    graphSchema: input.graph_schema,
    passageProfile: input.passage_profile,
    entityLinking: input.entity_linking ?? null,
    embedding: input.embedding,
    isBuiltin: false,
  });
  return domainPackRecordToApi(row);
}

export async function getDomainPackForUi(
  workspaceId: string,
  packId: string,
): Promise<ConnectDomainPack | null> {
  const row = await getConnectDomainPackById({ id: packId, workspaceId });
  return row ? domainPackRecordToApi(row) : null;
}

export type DomainPackMutationError = "not_found" | "builtin" | "slug_change";

export async function updateDomainPack(
  workspaceId: string,
  packId: string,
  input: ConnectDomainPackUpsert,
): Promise<{ pack: ConnectDomainPack } | { error: DomainPackMutationError }> {
  const existing = await getConnectDomainPackById({ id: packId, workspaceId });
  if (!existing) return { error: "not_found" };
  if (existing.isBuiltin) return { error: "builtin" };
  if (input.slug !== existing.slug) return { error: "slug_change" };
  const pack = await saveDomainPack(workspaceId, input);
  return { pack };
}

export async function deleteDomainPack(
  workspaceId: string,
  packId: string,
): Promise<{ deleted: true } | { error: DomainPackMutationError }> {
  const existing = await getConnectDomainPackById({ id: packId, workspaceId });
  if (!existing) return { error: "not_found" };
  if (existing.isBuiltin) return { error: "builtin" };
  const deleted = await deleteConnectDomainPack({ id: packId, workspaceId });
  if (!deleted) return { error: "not_found" };
  const selectedId = await getSelectedDomainPackId(workspaceId);
  if (selectedId === packId) {
    await setSelectedDomainPackId(workspaceId, null);
  }
  return { deleted: true };
}

export async function getSelectedDomainPackId(workspaceId: string): Promise<string | null> {
  const raw = await getConnectStageRoutingConfig(workspaceId);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const id = (raw as Record<string, unknown>).default_domain_pack_id;
  return typeof id === "string" ? id : null;
}

export async function setSelectedDomainPackId(
  workspaceId: string,
  packId: string | null,
): Promise<{ ok: true } | { error: "not_found" }> {
  if (packId) {
    const pack = await getConnectDomainPackById({ id: packId, workspaceId });
    if (!pack) return { error: "not_found" };
  }
  const raw = await getConnectStageRoutingConfig(workspaceId);
  const next =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  if (packId) next.default_domain_pack_id = packId;
  else delete next.default_domain_pack_id;
  await upsertConnectStageRoutingConfig(workspaceId, next);
  return { ok: true };
}

export function resolvePipelineDomainPack(
  packs: ConnectDomainPack[],
  selectedId: string | null,
): ConnectDomainPack | null {
  if (selectedId) {
    const selected = packs.find((p) => p.id === selectedId);
    if (selected) return selected;
  }
  return packs.find((p) => p.slug === "generic") ?? packs[0] ?? null;
}

/** Explicit ingest document ids for the next run; null = include all parsed documents. */
export async function getIngestDocumentSelection(workspaceId: string): Promise<string[] | null> {
  const raw = await getConnectStageRoutingConfig(workspaceId);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const ids = (raw as Record<string, unknown>).ingest_document_ids;
  if (!Array.isArray(ids)) return null;
  return ids.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function setIngestDocumentSelection(
  workspaceId: string,
  documentIds: string[] | null,
): Promise<void> {
  const raw = await getConnectStageRoutingConfig(workspaceId);
  const next =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  if (documentIds && documentIds.length > 0) next.ingest_document_ids = documentIds;
  else delete next.ingest_document_ids;
  await upsertConnectStageRoutingConfig(workspaceId, next);
}

/** Resolve which parsed documents to include in the next ingest run. */
export function resolveIngestDocuments<T extends { id: string; status: string }>(
  documents: T[],
  selection: string[] | null,
): T[] {
  const parsed = documents.filter((d) => d.status === "parsed");
  if (selection === null) return parsed;
  const allowed = new Set(selection);
  return parsed.filter((d) => allowed.has(d.id));
}

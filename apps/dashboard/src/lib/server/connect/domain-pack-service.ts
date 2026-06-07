/**
 * Knowledge domain pack service: seed built-in packs, map records to the public
 * contract, and validate upserts. A domain pack is the customisable layer that
 * makes the ingestion pipeline domain-agnostic (generalised from SOPHIA).
 */
import {
  DEFAULT_GENERIC_DOMAIN_PACK,
  ConnectDomainPackSchema,
  ConnectPackArchetypeSchema,
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
  getConnectGraphTargetForWorkspace,
  updateConnectGraphTargetBundle,
  type ConnectDomainPackRecord,
} from "$lib/server/neon";
import {
  assertEmbeddingDimensionsAllowed,
  getWorkspaceEmbeddingLock,
} from "$lib/server/connect/embedding-contract";
import {
  isSourceTablePatchAllowed,
  type SourceTextSchemaPatch,
} from "$lib/server/connect/source-text-schema-probe";

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Resolve the domain pack for graph operations (BYO schema import, philosophy, generic, or first). */
export async function resolveWorkspaceDomainPack(
  workspaceId: string,
  packId?: string | null,
): Promise<ConnectDomainPack | null> {
  let packRecord = packId
    ? await getConnectDomainPackById({ id: packId, workspaceId })
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
    quality_preset: row.qualityPreset === "starter" ? "starter" : "production",
    cross_model_validation: row.crossModelValidation,
    ...(row.archetype && ConnectPackArchetypeSchema.safeParse(row.archetype).success
      ? { archetype: row.archetype as ConnectDomainPack["archetype"] }
      : {}),
    prompt_template_version: row.promptTemplateVersion,
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
    qualityPreset: pack.quality_preset ?? "production",
    crossModelValidation: pack.cross_model_validation !== false,
    archetype: pack.archetype ?? null,
    promptTemplateVersion: pack.prompt_template_version ?? 1,
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

export type DomainPackMutationError = "not_found" | "builtin" | "slug_change" | "embedding_dimensions_locked";

async function assertPackEmbeddingAllowed(
  workspaceId: string,
  embedding: ConnectDomainPackUpsert["embedding"],
): Promise<{ ok: true } | { error: DomainPackMutationError; message: string }> {
  const dimensions = embedding?.dimensions ?? 1024;
  const lock = await getWorkspaceEmbeddingLock(workspaceId).catch(() => null);
  const check = assertEmbeddingDimensionsAllowed({ requestedDimensions: dimensions, lock });
  if (!check.ok) {
    return { error: "embedding_dimensions_locked", message: check.message };
  }
  return { ok: true };
}

export async function saveDomainPack(
  workspaceId: string,
  input: ConnectDomainPackUpsert,
): Promise<ConnectDomainPack> {
  const embedCheck = await assertPackEmbeddingAllowed(workspaceId, input.embedding);
  if ("error" in embedCheck) {
    throw new Error(embedCheck.message);
  }
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
    qualityPreset: input.quality_preset ?? "production",
    crossModelValidation: input.cross_model_validation !== false,
    archetype: input.archetype ?? null,
    promptTemplateVersion: input.prompt_template_version ?? 1,
    isBuiltin: false,
  });
  return domainPackRecordToApi(row);
}

/**
 * Persist the detected embedding vector field onto a (non-builtin) pack's schema,
 * so re-embed writes and dense retrieval target the same field a Bring-Your-Own
 * graph already uses. No-op for builtin packs (shared, never mutated).
 */
/** Merge detected source/passage text mapping onto a non-builtin domain pack. */
export async function persistDomainPackSourceTextMapping(
  workspaceId: string,
  packId: string,
  patch: Record<string, unknown>,
): Promise<ConnectDomainPack | null> {
  const row = await getConnectDomainPackById({ id: packId, workspaceId });
  if (!row || row.isBuiltin) return null;
  const existingPack = domainPackRecordToApi(row);
  if (!isSourceTablePatchAllowed(existingPack, patch as SourceTextSchemaPatch)) {
    return null;
  }
  const currentSchema =
    row.graphSchema && typeof row.graphSchema === "object" && !Array.isArray(row.graphSchema)
      ? (row.graphSchema as Record<string, unknown>)
      : {};
  const nextSchema = { ...currentSchema, ...patch };
  const unchanged = Object.entries(patch).every(
    ([key, value]) => currentSchema[key] === value,
  );
  if (unchanged) return domainPackRecordToApi(row);

  const updated = await upsertConnectDomainPack({
    workspaceId,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    ontology: row.ontology,
    prompts: row.prompts ?? {},
    graphSchema: nextSchema,
    passageProfile: row.passageProfile,
    entityLinking: row.entityLinking ?? null,
    embedding: row.embedding,
    qualityPreset: row.qualityPreset === "starter" ? "starter" : "production",
    crossModelValidation: row.crossModelValidation,
    archetype: row.archetype ?? null,
    promptTemplateVersion: row.promptTemplateVersion,
    isBuiltin: false,
  });
  return domainPackRecordToApi(updated);
}

export async function persistDomainPackVectorField(
  workspaceId: string,
  packId: string,
  field: string,
): Promise<void> {
  const row = await getConnectDomainPackById({ id: packId, workspaceId });
  if (!row || row.isBuiltin) return;
  const currentSchema =
    row.graphSchema && typeof row.graphSchema === "object" && !Array.isArray(row.graphSchema)
      ? (row.graphSchema as Record<string, unknown>)
      : {};
  if (currentSchema.unit_vector_field === field) return;
  await upsertConnectDomainPack({
    workspaceId,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    ontology: row.ontology,
    prompts: row.prompts ?? {},
    graphSchema: { ...currentSchema, unit_vector_field: field },
    passageProfile: row.passageProfile,
    entityLinking: row.entityLinking ?? null,
    embedding: row.embedding,
    qualityPreset: row.qualityPreset === "starter" ? "starter" : "production",
    crossModelValidation: row.crossModelValidation,
    archetype: row.archetype ?? null,
    promptTemplateVersion: row.promptTemplateVersion,
    isBuiltin: false,
  });
}

export async function getDomainPackForUi(
  workspaceId: string,
  packId: string,
): Promise<ConnectDomainPack | null> {
  const row = await getConnectDomainPackById({ id: packId, workspaceId });
  return row ? domainPackRecordToApi(row) : null;
}

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
  // Mirror onto the active graph so its saved bundle tracks this choice.
  const active = await getConnectGraphTargetForWorkspace(workspaceId);
  if (active) {
    await updateConnectGraphTargetBundle({
      graphTargetId: active.id,
      workspaceId,
      defaultDomainPackId: packId,
    });
  }
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
  // Mirror onto the active graph so its saved bundle tracks this selection.
  const active = await getConnectGraphTargetForWorkspace(workspaceId);
  if (active) {
    await updateConnectGraphTargetBundle({
      graphTargetId: active.id,
      workspaceId,
      settingsPatch: {
        ingest_document_ids: documentIds && documentIds.length > 0 ? documentIds : null,
      },
    });
  }
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

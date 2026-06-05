/**
 * Embedding model specs and workspace dimension locking for Connect graphs.
 * Once a graph has stored vectors, dimension length must stay consistent (re-embed is roadmap).
 */
import { getSql, ensureIngestionRoutingSchema } from "$lib/server/neon";
import {
  TOGETHER_GATEWAY_EMBEDDING_MODEL_ID,
  TOGETHER_GATEWAY_PROVIDER,
} from "$lib/server/connect/together-ingest-gateway";

export type EmbeddingModelSpec = {
  provider: string;
  defaultDimensions: number;
  /** Dimensions this model can output (Voyage/OpenAI matryoshka-style). */
  supportedDimensions: number[];
};

/** Known embedding models — align with model-catalog-seed and pack defaults. */
export const EMBEDDING_MODEL_SPECS: Record<string, EmbeddingModelSpec> = {
  "voyage-3": {
    provider: "voyage",
    defaultDimensions: 1024,
    supportedDimensions: [256, 512, 1024, 2048],
  },
  "voyage-3-large": {
    provider: "voyage",
    defaultDimensions: 1024,
    supportedDimensions: [256, 512, 1024, 2048],
  },
  "voyage-3-lite": {
    provider: "voyage",
    defaultDimensions: 512,
    supportedDimensions: [256, 512, 1024],
  },
  "text-embedding-3-large": {
    provider: "openai",
    defaultDimensions: 3072,
    supportedDimensions: [256, 1024, 3072],
  },
  "text-embedding-3-small": {
    provider: "openai",
    defaultDimensions: 1536,
    supportedDimensions: [512, 1536],
  },
  [TOGETHER_GATEWAY_EMBEDDING_MODEL_ID]: {
    provider: TOGETHER_GATEWAY_PROVIDER,
    defaultDimensions: 1024,
    supportedDimensions: [1024],
  },
};

export type WorkspaceEmbeddingLock = {
  dimensions: number;
  embeddedUnitCount: number;
  /** Best-effort model hint from pack config when vectors exist. */
  model?: string;
};

export function embeddingSpecForModel(modelId: string): EmbeddingModelSpec | null {
  return EMBEDDING_MODEL_SPECS[modelId] ?? null;
}

export function modelSupportsDimensions(modelId: string, dimensions: number): boolean {
  const spec = embeddingSpecForModel(modelId);
  if (!spec) return true;
  return spec.supportedDimensions.includes(dimensions);
}

/** Prefer Voyage when connected; otherwise first model that supports target dimensions. */
export function pickEmbeddingModelForDimensions(args: {
  providerTypes: Set<string>;
  dimensions: number;
  locked?: Pick<WorkspaceEmbeddingLock, "dimensions" | "model"> | null;
}): { modelId: string; provider: string; rationale: string } | null {
  const targetDimensions = args.locked?.dimensions ?? args.dimensions;

  if (args.locked?.model && modelSupportsDimensions(args.locked.model, targetDimensions)) {
    const spec = embeddingSpecForModel(args.locked.model);
    return {
      modelId: args.locked.model,
      provider: spec?.provider ?? "voyage",
      rationale: `Locked to ${args.locked.model} @ ${targetDimensions}d — graph already has embeddings at this size`,
    };
  }

  const candidates = Object.entries(EMBEDDING_MODEL_SPECS)
    .filter(([, spec]) => spec.supportedDimensions.includes(targetDimensions))
    .map(([modelId, spec]) => ({ modelId, ...spec }));

  const voyage = candidates.filter((c) => c.provider === "voyage");
  const together = candidates.filter((c) => c.provider === TOGETHER_GATEWAY_PROVIDER);
  const connected = (list: typeof candidates) => {
    if (args.providerTypes.size === 0) return list;
    return list.filter((c) => args.providerTypes.has(c.provider));
  };

  const ordered = [
    ...connected(voyage),
    ...connected(together),
    ...connected(candidates.filter((c) => c.provider !== "voyage" && c.provider !== TOGETHER_GATEWAY_PROVIDER)),
  ];
  const pick = ordered[0] ?? (args.providerTypes.size === 0 ? candidates[0] : undefined);
  if (!pick) return null;

  const voyagePreferred = pick.provider === "voyage";
  return {
    modelId: pick.modelId,
    provider: pick.provider,
    rationale: args.locked
      ? `Use ${pick.modelId} @ ${targetDimensions}d to match existing graph vectors`
      : voyagePreferred
        ? `Voyage default for pack target ${targetDimensions}d`
        : `${pick.modelId} supports ${targetDimensions}d with your connected providers`,
  };
}

/** When the workspace graph has embeddings, return locked dimension length (and optional model). */
export async function getWorkspaceEmbeddingLock(
  workspaceId: string,
  opts?: { modelHint?: string | null },
): Promise<WorkspaceEmbeddingLock | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const [dimRows, countRows] = await Promise.all([
    sql`
      SELECT jsonb_array_length(embedding)::int AS dim
      FROM knowledge_graph_units
      WHERE workspace_id = ${workspaceId} AND embedding IS NOT NULL
      LIMIT 1
    ` as unknown as Promise<{ dim: number | null }[]>,
    sql`
      SELECT count(*)::int AS c
      FROM knowledge_graph_units
      WHERE workspace_id = ${workspaceId} AND embedding IS NOT NULL
    ` as unknown as Promise<{ c: number }[]>,
  ]);

  const embeddedUnitCount = Number(countRows[0]?.c ?? 0);
  if (embeddedUnitCount === 0) return null;

  const dimensions = Number(dimRows[0]?.dim ?? 0);
  if (!dimensions || dimensions <= 0) return null;

  return {
    dimensions,
    embeddedUnitCount,
    ...(opts?.modelHint ? { model: opts.modelHint } : {}),
  };
}

export function assertEmbeddingDimensionsAllowed(args: {
  requestedDimensions: number;
  lock: WorkspaceEmbeddingLock | null;
}): { ok: true } | { ok: false; message: string } {
  if (!args.lock) return { ok: true };
  if (args.requestedDimensions === args.lock.dimensions) return { ok: true };
  return {
    ok: false,
    message: `This graph already has embeddings at ${args.lock.dimensions} dimensions. Change is blocked until re-embedding is available (see roadmap).`,
  };
}

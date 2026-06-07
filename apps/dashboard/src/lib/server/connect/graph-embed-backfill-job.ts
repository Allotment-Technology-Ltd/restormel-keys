export const CONNECT_GRAPH_EMBED_BACKFILL_JOB_KIND = "graph_embed_backfill" as const;

export type GraphEmbedBackfillScope = "missing_only" | "uniform_target";

export type GraphEmbedBackfillJobMeta = {
  kind: typeof CONNECT_GRAPH_EMBED_BACKFILL_JOB_KIND;
  embedding_route_id?: string | null;
  domain_pack_id?: string | null;
  /** When uniform_target, also re-embeds vectors that are not at target_dimensions. */
  scope?: GraphEmbedBackfillScope;
  target_dimensions?: number | null;
};

export function buildGraphEmbedBackfillJobSources(meta: GraphEmbedBackfillJobMeta): unknown[] {
  return [
    {
      text: "Connect graph embedding backfill (no new extraction).",
      title: "Embed missing ideas",
      _connect_job: meta,
    },
  ];
}

export function parseGraphEmbedBackfillJobMeta(sources: unknown): GraphEmbedBackfillJobMeta | null {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  const first = sources[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return null;
  const jobMeta = (first as Record<string, unknown>)._connect_job;
  if (!jobMeta || typeof jobMeta !== "object" || Array.isArray(jobMeta)) return null;
  const rec = jobMeta as Record<string, unknown>;
  if (rec.kind !== CONNECT_GRAPH_EMBED_BACKFILL_JOB_KIND) return null;
  const scopeRaw = rec.scope;
  const scope: GraphEmbedBackfillScope | undefined =
    scopeRaw === "uniform_target" ? "uniform_target" : scopeRaw === "missing_only" ? "missing_only" : undefined;
  const targetDimensions =
    typeof rec.target_dimensions === "number" && rec.target_dimensions > 0
      ? rec.target_dimensions
      : null;

  return {
    kind: CONNECT_GRAPH_EMBED_BACKFILL_JOB_KIND,
    embedding_route_id:
      typeof rec.embedding_route_id === "string" && rec.embedding_route_id.trim()
        ? rec.embedding_route_id.trim()
        : null,
    domain_pack_id:
      typeof rec.domain_pack_id === "string" && rec.domain_pack_id.trim()
        ? rec.domain_pack_id.trim()
        : null,
    ...(scope ? { scope } : {}),
    ...(targetDimensions ? { target_dimensions: targetDimensions } : {}),
  };
}

export function isGraphEmbedBackfillJob(sources: unknown): boolean {
  return parseGraphEmbedBackfillJobMeta(sources) != null;
}

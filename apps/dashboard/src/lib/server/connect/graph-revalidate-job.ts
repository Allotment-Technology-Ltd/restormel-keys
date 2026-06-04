import type { ConnectGraphRevalidateScope } from "@restormel/contracts/connect";

export const CONNECT_GRAPH_REVALIDATE_JOB_KIND = "graph_revalidate" as const;

export type GraphRevalidateJobMeta = {
  kind: typeof CONNECT_GRAPH_REVALIDATE_JOB_KIND;
  validation_route_id?: string | null;
  domain_pack_id?: string | null;
  scope: ConnectGraphRevalidateScope;
};

export function buildGraphRevalidateJobSources(meta: GraphRevalidateJobMeta): unknown[] {
  return [
    {
      text: "Connect graph re-validation (no new extraction).",
      title: "Graph re-validation",
      _connect_job: meta,
    },
  ];
}

export function parseGraphRevalidateJobMeta(sources: unknown): GraphRevalidateJobMeta | null {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  const first = sources[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return null;
  const jobMeta = (first as Record<string, unknown>)._connect_job;
  if (!jobMeta || typeof jobMeta !== "object" || Array.isArray(jobMeta)) return null;
  const rec = jobMeta as Record<string, unknown>;
  if (rec.kind !== CONNECT_GRAPH_REVALIDATE_JOB_KIND) return null;
  const scopeRaw = typeof rec.scope === "string" ? rec.scope.trim() : "unchecked";
  const scope: ConnectGraphRevalidateScope =
    scopeRaw === "all" || scopeRaw === "flagged" ? scopeRaw : "unchecked";
  return {
    kind: CONNECT_GRAPH_REVALIDATE_JOB_KIND,
    validation_route_id:
      typeof rec.validation_route_id === "string" && rec.validation_route_id.trim()
        ? rec.validation_route_id.trim()
        : null,
    domain_pack_id:
      typeof rec.domain_pack_id === "string" && rec.domain_pack_id.trim()
        ? rec.domain_pack_id.trim()
        : null,
    scope,
  };
}

export function isGraphRevalidateJob(sources: unknown): boolean {
  return parseGraphRevalidateJobMeta(sources) != null;
}

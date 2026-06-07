import type { ConnectGraphLinkSourcesScope } from "@restormel/contracts/connect";

export const CONNECT_GRAPH_LINK_SOURCES_JOB_KIND = "graph_link_sources" as const;

export type GraphLinkSourcesJobMeta = {
  kind: typeof CONNECT_GRAPH_LINK_SOURCES_JOB_KIND;
  domain_pack_id?: string | null;
  scope: ConnectGraphLinkSourcesScope;
  /** Readiness-run cohort id — link only units stamped to this run. */
  cohort_run_id?: string | null;
};

export function buildGraphLinkSourcesJobSources(meta: GraphLinkSourcesJobMeta): unknown[] {
  return [
    {
      text: "Connect graph source linking (no new extraction).",
      title: "Link sources to ideas",
      _connect_job: meta,
    },
  ];
}

export function parseGraphLinkSourcesJobMeta(sources: unknown): GraphLinkSourcesJobMeta | null {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  const first = sources[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return null;
  const jobMeta = (first as Record<string, unknown>)._connect_job;
  if (!jobMeta || typeof jobMeta !== "object" || Array.isArray(jobMeta)) return null;
  const rec = jobMeta as Record<string, unknown>;
  if (rec.kind !== CONNECT_GRAPH_LINK_SOURCES_JOB_KIND) return null;
  const scopeRaw = typeof rec.scope === "string" ? rec.scope.trim() : "unlinked_only";
  const scope: ConnectGraphLinkSourcesScope =
    scopeRaw === "all" ? "all" : "unlinked_only";
  return {
    kind: CONNECT_GRAPH_LINK_SOURCES_JOB_KIND,
    domain_pack_id:
      typeof rec.domain_pack_id === "string" && rec.domain_pack_id.trim()
        ? rec.domain_pack_id.trim()
        : null,
    scope,
    cohort_run_id:
      typeof rec.cohort_run_id === "string" && rec.cohort_run_id.trim()
        ? rec.cohort_run_id.trim()
        : null,
  };
}

export function isGraphLinkSourcesJob(sources: unknown): boolean {
  return parseGraphLinkSourcesJobMeta(sources) != null;
}

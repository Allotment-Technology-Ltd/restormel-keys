import type {
  ConnectGraphRevalidateMode,
  ConnectGraphRevalidateScope,
} from "@restormel/contracts/connect";

export const CONNECT_GRAPH_REVALIDATE_JOB_KIND = "graph_revalidate" as const;

const VALID_SCOPES = new Set<ConnectGraphRevalidateScope>([
  "all",
  "unchecked",
  "linked",
  "flagged",
  "quarantine",
  "unsupported",
]);

const VALID_MODES = new Set<ConnectGraphRevalidateMode>(["validate", "validate_and_remediate"]);

export type GraphRevalidateJobMeta = {
  kind: typeof CONNECT_GRAPH_REVALIDATE_JOB_KIND;
  validation_route_id?: string | null;
  remediation_route_id?: string | null;
  domain_pack_id?: string | null;
  scope: ConnectGraphRevalidateScope;
  mode: ConnectGraphRevalidateMode;
  /** Cap on units processed this run (bounded batch). */
  max_units?: number | null;
  /** Auto-enqueue the next batch until the scope is clear. */
  continue_in_background?: boolean;
};

export function buildGraphRevalidateJobSources(meta: GraphRevalidateJobMeta): unknown[] {
  const label =
    meta.mode === "validate_and_remediate"
      ? "Connect graph auto-remediation (validate + remediate)."
      : "Connect graph re-validation (no new extraction).";
  return [
    {
      text: label,
      title: meta.mode === "validate_and_remediate" ? "Graph auto-remediation" : "Graph re-validation",
      _connect_job: meta,
    },
  ];
}

function parseScope(raw: unknown): ConnectGraphRevalidateScope {
  const s = typeof raw === "string" ? raw.trim() : "unchecked";
  return VALID_SCOPES.has(s as ConnectGraphRevalidateScope)
    ? (s as ConnectGraphRevalidateScope)
    : "unchecked";
}

function parseMode(raw: unknown): ConnectGraphRevalidateMode {
  const m = typeof raw === "string" ? raw.trim() : "validate";
  return VALID_MODES.has(m as ConnectGraphRevalidateMode)
    ? (m as ConnectGraphRevalidateMode)
    : "validate";
}

export function parseGraphRevalidateJobMeta(sources: unknown): GraphRevalidateJobMeta | null {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  const first = sources[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return null;
  const jobMeta = (first as Record<string, unknown>)._connect_job;
  if (!jobMeta || typeof jobMeta !== "object" || Array.isArray(jobMeta)) return null;
  const rec = jobMeta as Record<string, unknown>;
  if (rec.kind !== CONNECT_GRAPH_REVALIDATE_JOB_KIND) return null;
  return {
    kind: CONNECT_GRAPH_REVALIDATE_JOB_KIND,
    validation_route_id:
      typeof rec.validation_route_id === "string" && rec.validation_route_id.trim()
        ? rec.validation_route_id.trim()
        : null,
    remediation_route_id:
      typeof rec.remediation_route_id === "string" && rec.remediation_route_id.trim()
        ? rec.remediation_route_id.trim()
        : null,
    domain_pack_id:
      typeof rec.domain_pack_id === "string" && rec.domain_pack_id.trim()
        ? rec.domain_pack_id.trim()
        : null,
    scope: parseScope(rec.scope),
    mode: parseMode(rec.mode),
    max_units:
      typeof rec.max_units === "number" && Number.isFinite(rec.max_units) && rec.max_units > 0
        ? Math.floor(rec.max_units)
        : null,
    continue_in_background: rec.continue_in_background === true,
  };
}

export function isGraphRevalidateJob(sources: unknown): boolean {
  return parseGraphRevalidateJobMeta(sources) != null;
}

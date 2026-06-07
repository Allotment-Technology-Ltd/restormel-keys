import type {
  ConnectGraphRemediationStrictness,
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

const VALID_MODES = new Set<ConnectGraphRevalidateMode>([
  "validate",
  "validate_and_remediate",
  "remediate",
]);

const VALID_STRICTNESS = new Set<ConnectGraphRemediationStrictness>([
  "conservative",
  "balanced",
  "strict",
]);

export type GraphRevalidateJobMeta = {
  kind: typeof CONNECT_GRAPH_REVALIDATE_JOB_KIND;
  validation_route_id?: string | null;
  remediation_route_id?: string | null;
  domain_pack_id?: string | null;
  scope: ConnectGraphRevalidateScope;
  mode: ConnectGraphRevalidateMode;
  /** "ai" runs the LLM check; "trust_provenance" accepts graph-native ideas with no LLM. */
  validation_mode?: "ai" | "trust_provenance";
  /** Remediation aggressiveness (modes "remediate" / "validate_and_remediate"). */
  remediation_strictness?: ConnectGraphRemediationStrictness;
  /** Min model confidence (0-1) before a remediation action applies. */
  remediation_threshold?: number | null;
  /** Cap on units processed this run (bounded batch). */
  max_units?: number | null;
  /** Auto-enqueue the next batch until the scope is clear. */
  continue_in_background?: boolean;
  /** Readiness-run cohort id — process only units stamped to this run. */
  cohort_run_id?: string | null;
};

export function buildGraphRevalidateJobSources(meta: GraphRevalidateJobMeta): unknown[] {
  const label =
    meta.mode === "validate_and_remediate"
      ? "Connect graph auto-remediation (validate + remediate)."
      : meta.mode === "remediate"
        ? "Connect graph remediation (flagged ideas, no re-validation)."
        : "Connect graph re-validation (no new extraction).";
  const title =
    meta.mode === "validate_and_remediate" || meta.mode === "remediate"
      ? "Graph auto-remediation"
      : "Graph re-validation";
  return [{ text: label, title, _connect_job: meta }];
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
    validation_mode: rec.validation_mode === "trust_provenance" ? "trust_provenance" : "ai",
    remediation_strictness:
      typeof rec.remediation_strictness === "string" &&
      VALID_STRICTNESS.has(rec.remediation_strictness as ConnectGraphRemediationStrictness)
        ? (rec.remediation_strictness as ConnectGraphRemediationStrictness)
        : "balanced",
    remediation_threshold:
      typeof rec.remediation_threshold === "number" &&
      Number.isFinite(rec.remediation_threshold) &&
      rec.remediation_threshold >= 0 &&
      rec.remediation_threshold <= 1
        ? rec.remediation_threshold
        : null,
    max_units:
      typeof rec.max_units === "number" && Number.isFinite(rec.max_units) && rec.max_units > 0
        ? Math.floor(rec.max_units)
        : null,
    continue_in_background: rec.continue_in_background === true,
    cohort_run_id:
      typeof rec.cohort_run_id === "string" && rec.cohort_run_id.trim()
        ? rec.cohort_run_id.trim()
        : null,
  };
}

export function isGraphRevalidateJob(sources: unknown): boolean {
  return parseGraphRevalidateJobMeta(sources) != null;
}

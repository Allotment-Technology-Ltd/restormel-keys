/**
 * W3.3 — Logs as a debugging product: pure filter + receipt helpers.
 *
 * Lives in $lib (NOT in the route file) so the filter→query-param mapping, the
 * time-range presets, the source taxonomy/classifier, and the receipt builder are
 * unit-testable under `vitest run src/lib` and reusable by both the page and any
 * future deep-link producer. No SvelteKit route exports here.
 *
 * Types are COPIED from the producing server module so the page and tests share one
 * shape without importing server code into the client bundle:
 *   - RequestLogRecord  → src/lib/server/neon.ts (line ~4569; `export type RequestLogRecord`)
 *   - metadata.explanation / metadata.violations  → src/routes/.../resolve/+server.ts insert sites
 *   - metadata.source / metadata.stage / metadata.ingest_job_id  → src/lib/server/connect-ingest-worker.ts insert site
 *   - failure errorCode vocabulary  → src/lib/server/connect/stage-route-generate.ts resolveAttemptFailureCode
 */

/** UI-facing request-log shape. Mirrors RequestLogRecord (neon.ts) + a trimmed metadata blob. */
export type LogRow = {
  id: string;
  projectId: string;
  environmentId: string;
  routeId: string | null;
  gatewayKeyId: string | null;
  providerType: string;
  finalModelId: string | null;
  requestStatus: string;
  latencyMs: number;
  ttftMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCost: number | null;
  fallbackCount: number | null;
  errorCode: string | null;
  createdAt: number;
  /** K5 traffic-source tag (metadata.source); null for gateway/legacy rows. */
  source: string | null;
  /** Trimmed, display-safe metadata for the receipt (explanation / violations / stage / ingest_job_id). */
  metadata: LogMetadata | null;
};

export type LogMetadata = {
  explanation?: string;
  violations?: { policyName?: string; type?: string; message?: string }[];
  stage?: string;
  ingestJobId?: string;
  limit?: number;
  used?: number;
};

// ---------------------------------------------------------------------------
// Time-range presets → since/until (ms epoch)
// ---------------------------------------------------------------------------

export type TimePreset = "15m" | "1h" | "24h" | "7d";

export const TIME_PRESETS: { value: TimePreset; label: string; ms: number }[] = [
  { value: "15m", label: "Last 15 min", ms: 15 * 60_000 },
  { value: "1h", label: "Last 1 hour", ms: 60 * 60_000 },
  { value: "24h", label: "Last 24 hours", ms: 24 * 60 * 60_000 },
  { value: "7d", label: "Last 7 days", ms: 7 * 24 * 60 * 60_000 },
];

export const DEFAULT_TIME_PRESET: TimePreset = "7d";

export function isTimePreset(v: string | null | undefined): v is TimePreset {
  return v === "15m" || v === "1h" || v === "24h" || v === "7d";
}

/** Map a time preset (and a now-anchor) to the {since, until} window for listRequestLogs. */
export function timePresetToWindow(
  preset: string | null | undefined,
  now: number,
): { since: number; until: number; preset: TimePreset } {
  const p = isTimePreset(preset) ? preset : DEFAULT_TIME_PRESET;
  const ms = TIME_PRESETS.find((t) => t.value === p)?.ms ?? TIME_PRESETS[TIME_PRESETS.length - 1].ms;
  return { since: now - ms, until: now, preset: p };
}

// ---------------------------------------------------------------------------
// Source taxonomy + classifier
// ---------------------------------------------------------------------------
//
// Only ONE source tag is written today (`connect_ingest`, by the ingest worker). All
// other rows carry a null source, so the meaningful buckets are derived, not stored:
//   - connect_ingest : metadata.source === "connect_ingest"  (Connect ingest resolves)
//   - agent          : a gateway-key request (gatewayKeyId != null)  ← Home links here (?source=agent)
//   - dashboard      : a session/dashboard resolve (no gateway key, no source tag)
// The `agent`/`dashboard` split is DERIVED honestly from gatewayKeyId; the PR states this.

export type SourceBucket = "connect_ingest" | "agent" | "dashboard";

export const SOURCE_OPTIONS: { value: SourceBucket; label: string }[] = [
  { value: "agent", label: "Agent / gateway" },
  { value: "connect_ingest", label: "Connect ingest" },
  { value: "dashboard", label: "Dashboard / session" },
];

export function isSourceBucket(v: string | null | undefined): v is SourceBucket {
  return v === "connect_ingest" || v === "agent" || v === "dashboard";
}

/** Classify a row into a source bucket (stored tag wins; otherwise derived from gatewayKeyId). */
export function classifyLogSource(row: Pick<LogRow, "source" | "gatewayKeyId">): SourceBucket {
  if (row.source === "connect_ingest") return "connect_ingest";
  if (row.gatewayKeyId != null && row.gatewayKeyId !== "") return "agent";
  return "dashboard";
}

/** Human label for a source bucket (sentence case for body; the badge upcases via CSS). */
export function sourceBucketLabel(bucket: SourceBucket): string {
  return SOURCE_OPTIONS.find((o) => o.value === bucket)?.label ?? bucket;
}

// ---------------------------------------------------------------------------
// Filter state ⇄ query params
// ---------------------------------------------------------------------------

export type LogFilterState = {
  projectId: string | null;
  routeId: string | null;
  status: string | null;
  source: SourceBucket | null;
  time: TimePreset;
  q: string | null;
  limit: number;
};

export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 200;

/** Parse a URLSearchParams (or plain record) into a normalized filter state. */
export function parseLogFilters(
  get: (key: string) => string | null,
): LogFilterState {
  const rawLimit = parseInt(get("limit") ?? String(DEFAULT_LIMIT), 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(MAX_LIMIT, Math.max(1, rawLimit)) : DEFAULT_LIMIT;
  const sourceRaw = get("source")?.trim() || null;
  const timeRaw = get("time")?.trim() || null;
  return {
    projectId: get("projectId")?.trim() || null,
    routeId: get("routeId")?.trim() || null,
    status: get("status")?.trim() || null,
    source: isSourceBucket(sourceRaw) ? sourceRaw : null,
    time: isTimePreset(timeRaw) ? timeRaw : DEFAULT_TIME_PRESET,
    q: get("q")?.trim() || null,
    limit,
  };
}

/** Build the query string for a filter state. Defaults are omitted (clean URLs / deep-links). */
export function logFiltersToQuery(state: Partial<LogFilterState>): string {
  const params = new URLSearchParams();
  if (state.projectId) params.set("projectId", state.projectId);
  if (state.routeId) params.set("routeId", state.routeId);
  if (state.status) params.set("status", state.status);
  if (state.source) params.set("source", state.source);
  if (state.time && state.time !== DEFAULT_TIME_PRESET) params.set("time", state.time);
  if (state.q) params.set("q", state.q);
  if (state.limit && state.limit !== DEFAULT_LIMIT) params.set("limit", String(state.limit));
  return params.toString();
}

/** True when any non-default filter is active (drives the "no matches" vs "no requests" empty state). */
export function hasActiveFilters(state: LogFilterState): boolean {
  return Boolean(
    state.projectId ||
      state.routeId ||
      state.status ||
      state.source ||
      state.q ||
      state.time !== DEFAULT_TIME_PRESET,
  );
}

// ---------------------------------------------------------------------------
// Client-side filtering (source + free-text), applied after the server time/route window
// ---------------------------------------------------------------------------
//
// The data layer (listRequestLogs) matches workspace + time + projectId + routeId in SQL.
// status, source, and free-text q are matched HERE because:
//   - status: the existing page already filters status post-query (kept additive).
//   - source: "agent"/"dashboard" are derived from gatewayKeyId (no stored column).
//   - q: request_logs has no full-text index; q matches the fields already returned.
// The PR states plainly what is and isn't searched.

/** Fields free-text search scans (stated in PR). No DB column added. */
export function logMatchesQuery(row: LogRow, q: string | null): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const hay = [
    row.requestStatus,
    row.providerType,
    row.finalModelId ?? "",
    row.routeId ?? "",
    row.errorCode ?? "",
    row.metadata?.explanation ?? "",
    row.source ?? "",
    row.id,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

/** Apply status + source + free-text filters to a server-windowed log list. */
export function applyClientFilters(rows: LogRow[], state: LogFilterState): LogRow[] {
  return rows.filter((row) => {
    if (state.status && row.requestStatus !== state.status) return false;
    if (state.source && classifyLogSource(row) !== state.source) return false;
    if (!logMatchesQuery(row, state.q)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Name resolution (UUID → human name) — pure map builders; the server load fetches
// the records and this builds the {id → name} maps the filter dropdowns render.
// Mirrors the routes/+page.server.ts precedent (listProjects/listRoutes carry .name).
// ---------------------------------------------------------------------------

export type NamedOption = { id: string; name: string };

/** Build {id → name} from records that expose id + name; later entries win on dup id. */
export function buildNameMap(records: { id: string; name: string }[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of records) {
    if (r.id) map[r.id] = r.name?.trim() || r.id;
  }
  return map;
}

/** Display name for an id, falling back to a short UUID prefix (never a raw 36-char UUID). */
export function displayName(id: string | null, map: Record<string, string>): string {
  if (!id) return "—";
  const name = map[id];
  if (name && name !== id) return name;
  return `${id.slice(0, 8)}…`;
}

/**
 * Filter-dropdown options: only ids that actually appear in the current log set, each
 * resolved to a name (falling back to a short prefix). Sorted by name for scanability.
 */
export function namedOptionsForIds(
  ids: string[],
  map: Record<string, string>,
): NamedOption[] {
  const seen = new Set<string>();
  const out: NamedOption[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = map[id];
    out.push({ id, name: name && name !== id ? name : `${id.slice(0, 8)}…` });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

// ---------------------------------------------------------------------------
// Receipt: request → route matched → policy outcomes → step attempts → response/error
// ---------------------------------------------------------------------------

export type ReceiptOutcome = "resolved" | "failed" | "blocked" | "limited" | "no_route" | "other";

/** Coarse outcome class for receipt styling + the failure-honest copy. */
export function receiptOutcome(status: string): ReceiptOutcome {
  if (status === "resolved") return "resolved";
  if (status === "policy_blocked") return "blocked";
  if (status === "no_route") return "no_route";
  if (status === "usage_limit_reached") return "limited";
  // route_unpublished / route_disabled / no_key_available / resolve_incomplete / *failed*
  if (
    status === "route_unpublished" ||
    status === "route_disabled" ||
    status === "no_key_available" ||
    status === "resolve_incomplete" ||
    status === "failed"
  )
    return "failed";
  return "other";
}

/** Is this a failure-class row (drives the "what went wrong" receipt section)? */
export function isFailureStatus(status: string): boolean {
  const o = receiptOutcome(status);
  return o === "failed" || o === "blocked" || o === "no_route" || o === "limited";
}

/** Plain-English line for a failure-class row's error, honest about what was recorded. */
export function failureExplanation(row: Pick<LogRow, "requestStatus" | "errorCode" | "metadata">): string {
  const exp = row.metadata?.explanation?.trim();
  if (exp) return exp;
  if (row.errorCode) return row.errorCode;
  switch (row.requestStatus) {
    case "no_route":
      return "No route matched this request's environment, workload, or stage.";
    case "policy_blocked":
      return "All resolved route steps were blocked by a guardrail policy.";
    case "usage_limit_reached":
      return "The workspace reached its monthly request limit.";
    default:
      return "Failure reason was not recorded for this request.";
  }
}

/** Policy outcomes for the receipt (empty array when none recorded). */
export function receiptPolicyChecks(
  row: Pick<LogRow, "requestStatus" | "errorCode" | "metadata">,
): { label: string }[] {
  const out: { label: string }[] = [];
  const violations = row.metadata?.violations;
  if (Array.isArray(violations)) {
    for (const v of violations) {
      const name = v.policyName ?? v.type ?? "policy";
      out.push({ label: v.message ? `${name}: ${v.message}` : name });
    }
  }
  if (out.length === 0 && row.requestStatus === "policy_blocked") {
    out.push({ label: "policy_blocked (details not recorded)" });
  }
  if (out.length === 0 && row.errorCode?.toLowerCase().includes("policy")) {
    out.push({ label: row.errorCode });
  }
  return out;
}

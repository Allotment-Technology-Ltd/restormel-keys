import type {
  DispatchRequest,
  DispatchResponse,
  DispatchVerifiedClaimEnvelope,
  DispatchVerifiedContextInput,
  DispatchVerifiedContextOutput,
} from "./types.js";
import {
  INTEGRATION_STACK_SCHEMA_VERSION,
  INTEGRATION_STACK_TEMPLATES,
  isIntegrationComponentId,
} from "./integration-stack-catalog.js";

const VALID_TASKS = new Set(["chat", "completion", "embedding"]);
const VALID_LATENCIES = new Set(["low", "balanced", "high"]);

// ---------------------------------------------------------------------------
// Verified-context validation helpers
// ---------------------------------------------------------------------------

const VALID_CLAIM_STATES = new Set([
  "supported",
  "inferred",
  "unverified",
  "contradicted",
  "excluded",
]);

const VALID_EVIDENCE_MATCHES = new Set(["exact", "normalized", "fuzzy"]);

function isValidVerifiedClaimEnvelope(value: unknown): value is DispatchVerifiedClaimEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const env = value as Record<string, unknown>;

  // claim
  if (typeof env.claim !== "object" || env.claim === null) return false;
  const claim = env.claim as Record<string, unknown>;
  if (typeof claim.id !== "string" || typeof claim.text !== "string") return false;

  // state
  if (typeof env.state !== "string" || !VALID_CLAIM_STATES.has(env.state)) return false;

  // evidence — must be an array (may be empty)
  if (!Array.isArray(env.evidence)) return false;
  for (const span of env.evidence) {
    if (typeof span !== "object" || span === null) return false;
    const s = span as Record<string, unknown>;
    if (typeof s.quote !== "string") return false;
    if (!Array.isArray(s.offsets) || s.offsets.length !== 2) return false;
    if (typeof s.offsets[0] !== "number" || typeof s.offsets[1] !== "number") return false;
    if (s.source_ref !== null && typeof s.source_ref !== "string") return false;
    if (s.source_hash !== null && typeof s.source_hash !== "string") return false;
    if (s.match !== undefined && s.match !== null && !VALID_EVIDENCE_MATCHES.has(s.match as string)) return false;
  }

  // judge (optional)
  if (env.judge !== undefined) {
    if (typeof env.judge !== "object" || env.judge === null) return false;
    const j = env.judge as Record<string, unknown>;
    if (j.model !== null && typeof j.model !== "string") return false;
    if (typeof j.prompt_version !== "number") return false;
    if (j.confidence !== null && typeof j.confidence !== "number") return false;
    if (typeof j.at !== "string") return false;
  }

  // citation
  if (env.citation !== null && typeof env.citation !== "string") return false;

  // trace_ref
  if (env.trace_ref !== null && typeof env.trace_ref !== "string") return false;

  // trust_score (optional)
  if (env.trust_score !== undefined && env.trust_score !== null && typeof env.trust_score !== "number") return false;

  return true;
}

function isValidVerifiedContextInput(value: unknown): value is DispatchVerifiedContextInput {
  if (typeof value !== "object" || value === null) return false;
  const ctx = value as Record<string, unknown>;
  if (!Array.isArray(ctx.claims)) return false;
  if (!ctx.claims.every(isValidVerifiedClaimEnvelope)) return false;
  if (ctx.retrieval_trace_ref !== undefined && ctx.retrieval_trace_ref !== null) {
    if (typeof ctx.retrieval_trace_ref !== "string") return false;
  }
  return true;
}

function isValidVerifiedContextOutput(value: unknown): value is DispatchVerifiedContextOutput {
  if (typeof value !== "object" || value === null) return false;
  const ctx = value as Record<string, unknown>;
  if (!Array.isArray(ctx.claims)) return false;
  if (!ctx.claims.every(isValidVerifiedClaimEnvelope)) return false;
  if (ctx.summary !== undefined) {
    if (typeof ctx.summary !== "object" || ctx.summary === null) return false;
    for (const [k, v] of Object.entries(ctx.summary as Record<string, unknown>)) {
      if (!VALID_CLAIM_STATES.has(k)) return false;
      if (typeof v !== "number") return false;
    }
  }
  if (ctx.retrieval_trace_ref !== undefined && ctx.retrieval_trace_ref !== null) {
    if (typeof ctx.retrieval_trace_ref !== "string") return false;
  }
  return true;
}

/**
 * Type guard for a single DispatchVerifiedClaimEnvelope.
 * Use when consuming individual claim envelopes from Connect v1 or the MCP tool.
 */
export function isDispatchVerifiedClaimEnvelope(value: unknown): value is DispatchVerifiedClaimEnvelope {
  return isValidVerifiedClaimEnvelope(value);
}

/**
 * Type guard for DispatchVerifiedContextInput (on DispatchRequest).
 */
export function isDispatchVerifiedContextInput(value: unknown): value is DispatchVerifiedContextInput {
  return isValidVerifiedContextInput(value);
}

/**
 * Type guard for DispatchVerifiedContextOutput (on DispatchResponse).
 */
export function isDispatchVerifiedContextOutput(value: unknown): value is DispatchVerifiedContextOutput {
  return isValidVerifiedContextOutput(value);
}

const TEMPLATE_IDS = new Set<string>(INTEGRATION_STACK_TEMPLATES.map((t) => t.id));
const MAX_STACK_COMPONENTS = 32;
const MAX_ROLE_LEN = 64;

function isValidIntegrationStack(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  if (s.schemaVersion !== INTEGRATION_STACK_SCHEMA_VERSION) return false;
  if (s.templateId !== undefined) {
    if (typeof s.templateId !== "string" || !TEMPLATE_IDS.has(s.templateId)) return false;
  }
  if (!Array.isArray(s.components)) return false;
  if (s.components.length === 0 || s.components.length > MAX_STACK_COMPONENTS) return false;
  for (const row of s.components) {
    if (typeof row !== "object" || row === null) return false;
    const c = row as Record<string, unknown>;
    if (typeof c.id !== "string" || !isIntegrationComponentId(c.id)) return false;
    if (c.role !== undefined) {
      if (typeof c.role !== "string" || c.role.length > MAX_ROLE_LEN) return false;
    }
  }
  return true;
}

export function isDispatchRequest(value: unknown): value is DispatchRequest {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.input !== "string") return false;
  if (obj.task !== undefined && !VALID_TASKS.has(obj.task as string)) return false;
  if (obj.constraints !== undefined) {
    if (typeof obj.constraints !== "object" || obj.constraints === null) return false;
    const c = obj.constraints as Record<string, unknown>;
    if (c.maxCost !== undefined && typeof c.maxCost !== "number") return false;
    if (c.latency !== undefined && !VALID_LATENCIES.has(c.latency as string)) return false;
    if (c.tokens !== undefined) {
      if (typeof c.tokens !== "object" || c.tokens === null) return false;
      const t = c.tokens as Record<string, unknown>;
      if (t.inputTokensM !== undefined && typeof t.inputTokensM !== "number") return false;
      if (t.outputTokensM !== undefined && typeof t.outputTokensM !== "number") return false;
    }
  }
  if (obj.user !== undefined) {
    if (typeof obj.user !== "object" || obj.user === null) return false;
    const u = obj.user as Record<string, unknown>;
    if (typeof u.id !== "string") return false;
    if (u.plan !== undefined && typeof u.plan !== "string") return false;
  }
  if (obj.routing !== undefined) {
    if (typeof obj.routing !== "object" || obj.routing === null) return false;
    const r = obj.routing as Record<string, unknown>;
    if (r.model !== undefined && typeof r.model !== "string") return false;
    if (r.provider !== undefined && typeof r.provider !== "string") return false;
  }
  if (obj.routingContext !== undefined) {
    if (typeof obj.routingContext !== "object" || obj.routingContext === null) return false;
    const rc = obj.routingContext as Record<string, unknown>;
    if (rc.routeId !== undefined && typeof rc.routeId !== "string") return false;
    if (rc.workload !== undefined && typeof rc.workload !== "string") return false;
    if (rc.stage !== undefined && typeof rc.stage !== "string") return false;
    if (rc.attemptNumber !== undefined && typeof rc.attemptNumber !== "number") return false;
    if (rc.failureKind !== undefined && typeof rc.failureKind !== "string") return false;
    if (rc.previousFailure !== undefined) {
      if (typeof rc.previousFailure !== "object" || rc.previousFailure === null) return false;
      const pf = rc.previousFailure as Record<string, unknown>;
      if (pf.selectedOrderIndex !== undefined && typeof pf.selectedOrderIndex !== "number") return false;
      if (pf.selectedStepId !== undefined && typeof pf.selectedStepId !== "string") return false;
    }
  }
  if (obj.routingPlan !== undefined) {
    if (typeof obj.routingPlan !== "object" || obj.routingPlan === null) return false;
  }
  if (obj.integrationStack !== undefined && !isValidIntegrationStack(obj.integrationStack)) return false;
  if (obj.verifiedContext !== undefined && !isValidVerifiedContextInput(obj.verifiedContext)) return false;
  return true;
}

export function isDispatchResponse(value: unknown): value is DispatchResponse {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.output !== "string") return false;
  if (obj.embedding !== undefined) {
    if (!Array.isArray(obj.embedding) || !obj.embedding.every((x) => typeof x === "number")) return false;
  }
  if (obj.outputText !== undefined && typeof obj.outputText !== "string") return false;
  if (typeof obj.provider !== "string") return false;
  if (typeof obj.model !== "string") return false;
  if (typeof obj.cost !== "number") return false;
  if (typeof obj.routing !== "object" || obj.routing === null) return false;
  const r = obj.routing as Record<string, unknown>;
  if (typeof r.reason !== "string") return false;
  if (obj.verifiedContext !== undefined && !isValidVerifiedContextOutput(obj.verifiedContext)) return false;
  return true;
}

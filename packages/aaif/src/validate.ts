import type { AAIFRequest, AAIFResponse } from "./types.js";
import {
  INTEGRATION_STACK_SCHEMA_VERSION,
  INTEGRATION_STACK_TEMPLATES,
  isIntegrationComponentId,
} from "./integration-stack-catalog.js";

const VALID_TASKS = new Set(["chat", "completion", "embedding"]);
const VALID_LATENCIES = new Set(["low", "balanced", "high"]);

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

export function isAAIFRequest(value: unknown): value is AAIFRequest {
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
  return true;
}

export function isAAIFResponse(value: unknown): value is AAIFResponse {
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
  return true;
}

import type { AAIFRequest, AAIFResponse } from "./types.js";

const VALID_TASKS = new Set(["chat", "completion", "embedding"]);
const VALID_LATENCIES = new Set(["low", "balanced", "high"]);

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

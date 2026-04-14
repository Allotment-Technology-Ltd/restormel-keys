/**
 * Model pool (Phase F): versioned JSON on `route_steps.model_pool` with deterministic member ordering
 * for resolver + simulate alignment.
 */
import { createHash } from "node:crypto";

/** Minimal step shape for pool expansion (avoids circular imports with db). */
export type RouteStepPoolFields = {
  providerPreference: string | null;
  modelId: string | null;
  modelPool?: Record<string, unknown> | null;
};

export const MODEL_POOL_JSON_VERSION = 1 as const;

export type ModelPoolSelectionStrategy =
  | "first_eligible"
  | "deterministic_hash"
  | "round_robin"
  | "weighted_random";

export type ModelPoolMemberV1 = {
  providerPreference: string;
  modelId: string;
  /** Used by `weighted_random` only; defaults to 1. */
  weight?: number;
};

export type ModelPoolV1 = {
  version: typeof MODEL_POOL_JSON_VERSION;
  selectionStrategy: ModelPoolSelectionStrategy;
  members: ModelPoolMemberV1[];
};

export type PoolMemberCandidate = {
  providerPreference: string | null;
  modelId: string | null;
  memberIndex: number;
};

function hashHex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Parse and validate `model_pool` JSON. Returns null if absent or invalid (caller treats as single-provider step). */
export function parseModelPool(raw: unknown): ModelPoolV1 | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== MODEL_POOL_JSON_VERSION) return null;
  const strat = o.selectionStrategy;
  if (
    strat !== "first_eligible" &&
    strat !== "deterministic_hash" &&
    strat !== "round_robin" &&
    strat !== "weighted_random"
  ) {
    return null;
  }
  if (!Array.isArray(o.members) || o.members.length === 0) return null;
  const members: ModelPoolMemberV1[] = [];
  for (const m of o.members) {
    if (!m || typeof m !== "object" || Array.isArray(m)) return null;
    const row = m as Record<string, unknown>;
    const providerPreference =
      typeof row.providerPreference === "string" ? row.providerPreference.trim() : "";
    const modelId = typeof row.modelId === "string" ? row.modelId.trim() : "";
    if (!providerPreference || !modelId) return null;
    let weight: number | undefined;
    if (row.weight !== undefined) {
      if (typeof row.weight !== "number" || !Number.isFinite(row.weight) || row.weight <= 0) return null;
      weight = row.weight;
    }
    members.push(
      weight !== undefined ? { providerPreference, modelId, weight } : { providerPreference, modelId }
    );
  }
  return {
    version: MODEL_POOL_JSON_VERSION,
    selectionStrategy: strat,
    members,
  };
}

/**
 * Expand pool members or a single synthetic candidate from `providerPreference` + `modelId`.
 */
export function expandPoolMembersFromStep(
  step: RouteStepPoolFields,
  routeDefaultModelId: string | null
): { pool: ModelPoolV1 | null; candidates: PoolMemberCandidate[] } {
  const parsed = parseModelPool(step.modelPool);
  if (parsed && parsed.members.length > 0) {
    return {
      pool: parsed,
      candidates: parsed.members.map((m, i) => ({
        providerPreference: m.providerPreference,
        modelId: m.modelId ?? routeDefaultModelId,
        memberIndex: i,
      })),
    };
  }
  return {
    pool: null,
    candidates: [
      {
        providerPreference: step.providerPreference,
        modelId: step.modelId ?? routeDefaultModelId,
        memberIndex: 0,
      },
    ],
  };
}

/** Order candidates for iteration (deterministic for tests). */
export function orderPoolCandidates(
  strategy: ModelPoolSelectionStrategy,
  candidates: PoolMemberCandidate[],
  seed: string,
  attemptNumber: number,
  orderIndex: number,
  pool: ModelPoolV1 | null
): PoolMemberCandidate[] {
  if (candidates.length <= 1) return [...candidates];
  const copy = [...candidates];
  switch (strategy) {
    case "first_eligible":
      return copy;
    case "deterministic_hash":
      return copy.sort((a, b) =>
        hashHex(`${seed}|${a.memberIndex}|${a.providerPreference}|${a.modelId}`).localeCompare(
          hashHex(`${seed}|${b.memberIndex}|${b.providerPreference}|${b.modelId}`)
        )
      );
    case "round_robin": {
      const start = (attemptNumber + orderIndex) % copy.length;
      return [...copy.slice(start), ...copy.slice(0, start)];
    }
    case "weighted_random": {
      if (!pool) return copy;
      const weights = pool.members.map((m) => (typeof m.weight === "number" && m.weight > 0 ? m.weight : 1));
      const total = weights.reduce((a, b) => a + b, 0);
      if (total <= 0) return copy;
      const pick = parseInt(hashHex(`${seed}|weighted`).slice(0, 8), 16) % total;
      let acc = 0;
      let startIdx = 0;
      for (let i = 0; i < weights.length; i++) {
        acc += weights[i];
        if (pick < acc) {
          startIdx = i;
          break;
        }
      }
      const ordered = copy.sort((a, b) => a.memberIndex - b.memberIndex);
      return [...ordered.slice(startIdx), ...ordered.slice(0, startIdx)];
    }
    default:
      return copy;
  }
}

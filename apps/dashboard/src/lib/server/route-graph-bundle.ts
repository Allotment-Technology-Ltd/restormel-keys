import type { RouteRecord, RouteStepRecord } from "./neon";

/** Matches `docs/schemas/route-graph-bundle.schema.json` `schemaVersion`. */
export const ROUTE_GRAPH_BUNDLE_SCHEMA_VERSION = "1.0.0" as const;

export type RouteGraphBundle = {
  schemaVersion: typeof ROUTE_GRAPH_BUNDLE_SCHEMA_VERSION;
  exportedAt: number;
  projectId: string;
  route: ReturnType<typeof serializeRouteForBundle>;
  steps: ReturnType<typeof serializeStepForBundle>[];
};

export function serializeRouteForBundle(route: RouteRecord) {
  return {
    id: route.id,
    projectId: route.projectId,
    environmentId: route.environmentId,
    name: route.name,
    description: route.description,
    defaultModelId: route.defaultModelId,
    billingMode: route.billingMode,
    routeMode: route.routeMode,
    stage: route.stage ?? null,
    workload: route.workload ?? null,
    enabled: route.enabled ?? true,
    version: route.version ?? null,
    publishedVersion: route.publishedVersion ?? null,
    status: route.status,
    createdBy: route.createdBy ?? null,
    updatedVia: route.updatedVia ?? null,
    updatedBy: route.updatedBy ?? null,
    changeSummary: route.changeSummary ?? null,
    contentHash: route.contentHash ?? null,
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,
  };
}

export function serializeStepForBundle(s: RouteStepRecord) {
  return {
    id: s.id,
    routeId: s.routeId,
    orderIndex: s.orderIndex,
    providerPreference: s.providerPreference,
    modelId: s.modelId,
    label: s.label ?? null,
    switchCriteria: s.switchCriteria ?? null,
    retryPolicy: s.retryPolicy ?? null,
    costPolicy: s.costPolicy ?? null,
    conditionBlock: s.conditionBlock,
    fallbackOn: s.fallbackOn,
    timeoutMs: s.timeoutMs,
    notes: s.notes ?? null,
    modelPool: s.modelPool ?? null,
    parallelGroupId: s.parallelGroupId ?? null,
    parallelBranchRole: s.parallelBranchRole ?? null,
    enabled: s.enabled,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export function buildRouteGraphBundle(projectId: string, route: RouteRecord, steps: RouteStepRecord[]): RouteGraphBundle {
  const sorted = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);
  return {
    schemaVersion: ROUTE_GRAPH_BUNDLE_SCHEMA_VERSION,
    exportedAt: Date.now(),
    projectId,
    route: serializeRouteForBundle(route),
    steps: sorted.map(serializeStepForBundle),
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Structural validation for GitOps import (bundle JSON from export or hand-edited).
 * Does not guarantee policy or catalog consistency — resolve/simulate cover that.
 */
export function validateRouteGraphBundleForImport(
  raw: unknown,
  expectedProjectId: string,
): { ok: true; bundle: RouteGraphBundle } | { ok: false; error: string; status: number } {
  if (!isPlainObject(raw)) return { ok: false, error: "invalid_bundle", status: 400 };
  if (raw.schemaVersion !== ROUTE_GRAPH_BUNDLE_SCHEMA_VERSION) {
    return { ok: false, error: "invalid_schema_version", status: 400 };
  }
  if (typeof raw.projectId !== "string" || raw.projectId.trim() !== expectedProjectId) {
    return { ok: false, error: "project_id_mismatch", status: 400 };
  }
  const exportedAt = raw.exportedAt;
  if (typeof exportedAt !== "number" || exportedAt < 0 || !Number.isFinite(exportedAt)) {
    return { ok: false, error: "invalid_exported_at", status: 400 };
  }
  const routeRaw = raw.route;
  if (!isPlainObject(routeRaw)) return { ok: false, error: "invalid_route", status: 400 };
  const environmentId = typeof routeRaw.environmentId === "string" ? routeRaw.environmentId.trim() : "";
  const name = typeof routeRaw.name === "string" ? routeRaw.name.trim() : "";
  if (!environmentId || !name) {
    return { ok: false, error: "route_requires_environment_id_and_name", status: 400 };
  }
  const routeProjectId =
    typeof routeRaw.projectId === "string" && routeRaw.projectId.trim()
      ? routeRaw.projectId.trim()
      : expectedProjectId;
  if (routeProjectId !== expectedProjectId) {
    return { ok: false, error: "route_project_id_mismatch", status: 400 };
  }
  const stepsRaw = raw.steps;
  if (!Array.isArray(stepsRaw)) return { ok: false, error: "steps_must_be_array", status: 400 };
  for (let i = 0; i < stepsRaw.length; i++) {
    const s = stepsRaw[i];
    if (!isPlainObject(s)) return { ok: false, error: `invalid_step_at_index_${i}`, status: 400 };
    if (typeof s.orderIndex !== "number" || !Number.isFinite(s.orderIndex)) {
      return { ok: false, error: `step_${i}_missing_order_index`, status: 400 };
    }
  }
  return { ok: true, bundle: raw as unknown as RouteGraphBundle };
}

/** Maps exported step rows to `replaceRouteStepsFromSnapshot` snapshots (route id comes from the DB call). */
export function bundleStepsToSnapshotsForDb(steps: RouteGraphBundle["steps"]): Record<string, unknown>[] {
  return steps.map((step) => {
    const s = step as Record<string, unknown>;
    const snap: Record<string, unknown> = {
      orderIndex: Number(s.orderIndex),
      enabled: s.enabled !== false,
    };
    if (typeof s.id === "string" && s.id.trim()) snap.id = s.id.trim();
    if (typeof s.providerPreference === "string") snap.providerPreference = s.providerPreference;
    else snap.providerPreference = s.providerPreference ?? null;
    if (typeof s.modelId === "string") snap.modelId = s.modelId;
    else snap.modelId = s.modelId ?? null;
    if (typeof s.label === "string") snap.label = s.label;
    else if (s.label === null) snap.label = null;
    for (const key of ["switchCriteria", "retryPolicy", "costPolicy", "conditionBlock"] as const) {
      const v = s[key];
      if (v !== undefined && v !== null && typeof v === "object" && !Array.isArray(v)) {
        snap[key] = v;
      } else if (v === null) {
        snap[key] = null;
      }
    }
    if (typeof s.fallbackOn === "string") snap.fallbackOn = s.fallbackOn;
    else snap.fallbackOn = s.fallbackOn ?? null;
    if (typeof s.timeoutMs === "number" && Number.isFinite(s.timeoutMs)) snap.timeoutMs = s.timeoutMs;
    else if (s.timeoutMs === null) snap.timeoutMs = null;
    if (typeof s.notes === "string") snap.notes = s.notes;
    else if (s.notes === null) snap.notes = null;
    if (s.modelPool !== undefined && s.modelPool !== null && typeof s.modelPool === "object") {
      snap.modelPool = s.modelPool;
    } else if (s.modelPool === null) snap.modelPool = null;
    if (typeof s.parallelGroupId === "string") snap.parallelGroupId = s.parallelGroupId;
    else if (s.parallelGroupId === null) snap.parallelGroupId = null;
    if (typeof s.parallelBranchRole === "string") snap.parallelBranchRole = s.parallelBranchRole;
    else if (s.parallelBranchRole === null) snap.parallelBranchRole = null;
    if (!("modelPool" in snap)) snap.modelPool = null;
    if (!("parallelGroupId" in snap)) snap.parallelGroupId = null;
    if (!("parallelBranchRole" in snap)) snap.parallelBranchRole = null;
    return snap;
  });
}

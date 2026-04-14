import { describe, it, expect } from "vitest";
import {
  buildRouteGraphBundle,
  ROUTE_GRAPH_BUNDLE_SCHEMA_VERSION,
  validateRouteGraphBundleForImport,
  bundleStepsToSnapshotsForDb,
  type RouteGraphBundle,
} from "./route-graph-bundle";
import type { RouteRecord, RouteStepRecord } from "./neon";

describe("buildRouteGraphBundle", () => {
  it("orders steps and sets schema version", () => {
    const route = {
      id: "r1",
      projectId: "p1",
      environmentId: "env",
      name: "test",
      description: null,
      defaultModelId: "gpt-4o-mini",
      billingMode: null,
      routeMode: "fallback_chain",
      stage: null,
      workload: null,
      enabled: true,
      version: 1,
      publishedVersion: 1,
      status: "active",
      createdBy: "u1",
      createdAt: 1,
      updatedAt: 2,
    } as RouteRecord;

    const steps: RouteStepRecord[] = [
      {
        id: "b",
        routeId: "r1",
        orderIndex: 1,
        providerPreference: "openai",
        modelId: "gpt-4o-mini",
        conditionBlock: null,
        fallbackOn: "error",
        timeoutMs: 5000,
        enabled: true,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "a",
        routeId: "r1",
        orderIndex: 0,
        providerPreference: "openai",
        modelId: "gpt-4o-mini",
        conditionBlock: null,
        fallbackOn: "error",
        timeoutMs: 5000,
        enabled: true,
        createdAt: "",
        updatedAt: "",
      },
    ];

    const bundle = buildRouteGraphBundle("p1", route, steps);
    expect(bundle.schemaVersion).toBe(ROUTE_GRAPH_BUNDLE_SCHEMA_VERSION);
    expect(bundle.projectId).toBe("p1");
    expect(bundle.steps.map((s) => s.id)).toEqual(["a", "b"]);
    expect(bundle.route.id).toBe("r1");
  });

  it("export-shaped bundle passes import structural validation (CI guard for GitOps round-trip)", () => {
    const route = {
      id: "r1",
      projectId: "p1",
      environmentId: "env1",
      name: "Primary",
      description: null,
      defaultModelId: "gpt-4o-mini",
      billingMode: null,
      routeMode: "fallback_chain",
      stage: null,
      workload: null,
      enabled: true,
      version: 1,
      publishedVersion: 1,
      status: "active",
      createdBy: "u1",
      createdAt: 1,
      updatedAt: 2,
    } as RouteRecord;

    const steps: RouteStepRecord[] = [
      {
        id: "s0",
        routeId: "r1",
        orderIndex: 0,
        providerPreference: "openai",
        modelId: "gpt-4o-mini",
        conditionBlock: null,
        fallbackOn: "error",
        timeoutMs: 5000,
        enabled: true,
        createdAt: "",
        updatedAt: "",
      },
    ];

    const bundle = buildRouteGraphBundle("p1", route, steps);
    const v = validateRouteGraphBundleForImport(bundle, "p1");
    expect(v.ok).toBe(true);
  });
});

describe("validateRouteGraphBundleForImport", () => {
  const minimalBundle = (projectId: string) => ({
    schemaVersion: ROUTE_GRAPH_BUNDLE_SCHEMA_VERSION,
    exportedAt: 1,
    projectId,
    route: {
      id: "r1",
      projectId,
      environmentId: "env1",
      name: "My route",
      description: null,
      defaultModelId: null,
      billingMode: null,
      routeMode: "fallback_chain",
      stage: null,
      workload: null,
      enabled: true,
      version: 1,
      publishedVersion: 1,
      status: "active",
      createdBy: null,
      updatedVia: null,
      updatedBy: null,
      changeSummary: null,
      contentHash: null,
      createdAt: 0,
      updatedAt: 0,
    },
    steps: [
      {
        id: "s1",
        routeId: "r1",
        orderIndex: 0,
        providerPreference: "openai",
        modelId: "gpt-4o-mini",
        label: null,
        switchCriteria: null,
        retryPolicy: null,
        costPolicy: null,
        conditionBlock: null,
        fallbackOn: "error",
        timeoutMs: 5000,
        notes: null,
        enabled: true,
        createdAt: "",
        updatedAt: "",
      },
    ],
  });

  it("accepts a valid bundle for the expected project", () => {
    const raw = minimalBundle("p1");
    const r = validateRouteGraphBundleForImport(raw, "p1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bundle.steps).toHaveLength(1);
  });

  it("rejects project id mismatch", () => {
    const r = validateRouteGraphBundleForImport(minimalBundle("other"), "p1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("project_id_mismatch");
  });

  it("rejects wrong schema version", () => {
    const raw = { ...minimalBundle("p1"), schemaVersion: "0.9.0" };
    const r = validateRouteGraphBundleForImport(raw, "p1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_schema_version");
  });
});

describe("bundleStepsToSnapshotsForDb", () => {
  it("maps exported steps to replaceRouteStepsFromSnapshot shape", () => {
    const snaps = bundleStepsToSnapshotsForDb([
      {
        id: "step-1",
        routeId: "r",
        orderIndex: 0,
        providerPreference: "openai",
        modelId: "gpt-4o-mini",
        label: null,
        switchCriteria: null,
        retryPolicy: null,
        costPolicy: null,
        conditionBlock: null,
        fallbackOn: "error",
        timeoutMs: 3000,
        notes: null,
        enabled: true,
        createdAt: "",
        updatedAt: "",
      },
    ] as RouteGraphBundle["steps"]);
    expect(snaps).toEqual([
      {
        id: "step-1",
        orderIndex: 0,
        enabled: true,
        providerPreference: "openai",
        modelId: "gpt-4o-mini",
        label: null,
        switchCriteria: null,
        retryPolicy: null,
        costPolicy: null,
        conditionBlock: null,
        fallbackOn: "error",
        timeoutMs: 3000,
        notes: null,
        modelPool: null,
        parallelGroupId: null,
        parallelBranchRole: null,
      },
    ]);
  });
});

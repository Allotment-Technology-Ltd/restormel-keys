import { describe, it, expect } from "vitest";
import { buildRoutingExplainChainData, summarizePolicyRule, ROUTING_EXPLAIN_CHAIN_CONTRACT } from "./route-explain-chain";
import type { RouteRecord, RouteStepRecord, PolicyRecord } from "./neon";

describe("summarizePolicyRule", () => {
  it("summarizes model allowlist", () => {
    expect(summarizePolicyRule("model_allowlist", { modelIds: ["a", "b"] })).toContain("models:");
  });

  it("handles missing rule", () => {
    expect(summarizePolicyRule("model_allowlist", null)).toBe("no rule payload");
  });
});

describe("buildRoutingExplainChainData", () => {
  const route = {
    id: "r1",
    projectId: "p1",
    environmentId: "e1",
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

  const policy: PolicyRecord = {
    id: "pol1",
    workspaceId: "w",
    name: "Allow",
    type: "model_allowlist",
    status: "active",
    ruleDefinition: { modelIds: ["gpt-4o-mini"] },
    createdBy: null,
    createdAt: 0,
    updatedAt: 0,
    updatedVia: null,
    updatedBy: null,
    changeSummary: null,
    contentHash: null,
  };

  it("sets contract version and narrative", () => {
    const data = buildRoutingExplainChainData({
      projectId: "p1",
      route,
      steps,
      contextualPolicies: [{ scope: "route", bindingId: "b1", policy }],
    });
    expect(data.contractVersion).toBe(ROUTING_EXPLAIN_CHAIN_CONTRACT);
    expect(data.routeId).toBe("r1");
    expect(data.steps.total).toBe(1);
    expect(data.policies).toHaveLength(1);
    expect(data.policies[0].scope).toBe("route");
    expect(data.narrative.length).toBeGreaterThanOrEqual(3);
  });

  it("includes ruleDefinition when requested", () => {
    const data = buildRoutingExplainChainData({
      projectId: "p1",
      route,
      steps,
      contextualPolicies: [{ scope: "route", bindingId: "b1", policy }],
      includePolicyRuleJson: true,
    });
    expect(data.policies[0].ruleDefinition).toEqual({ modelIds: ["gpt-4o-mini"] });
  });

  it("adds catalog crowdsignal narrative when catalogCrowdHints is supplied (empty)", () => {
    const data = buildRoutingExplainChainData({
      projectId: "p1",
      route,
      steps,
      contextualPolicies: [{ scope: "route", bindingId: "b1", policy }],
      catalogCrowdHints: [],
    });
    expect(data.catalogCrowdHints).toEqual([]);
    expect(data.narrative.some((l) => l.includes("Catalog crowdsignal query returned no non-zero"))).toBe(true);
  });

  it("adds catalog crowdsignal narrative when catalogCrowdHints has rows", () => {
    const data = buildRoutingExplainChainData({
      projectId: "p1",
      route,
      steps,
      contextualPolicies: [{ scope: "route", bindingId: "b1", policy }],
      catalogCrowdHints: [
        {
          stepId: "s0",
          catalogProviderId: "openai",
          providerModelId: "gpt-4o-mini",
          deprecatedReportCount: 1,
          retiredReportCount: 0,
        },
      ],
    });
    expect(data.catalogCrowdHints).toHaveLength(1);
    expect(data.narrative.some((l) => l.includes("Catalog crowdsignals"))).toBe(true);
  });
});

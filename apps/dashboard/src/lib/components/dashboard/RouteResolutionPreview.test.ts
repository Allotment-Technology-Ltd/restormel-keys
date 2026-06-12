// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import RouteResolutionPreview from "./RouteResolutionPreview.svelte";

// Real-shaped explain-chain payload (mirrors buildRoutingExplainChainData output)
const REAL_EXPLAIN_CHAIN_BODY = {
  data: {
    contractVersion: "2026-04-15",
    projectId: "proj-1",
    routeId: "route-abc",
    environmentId: "env-1",
    route: {
      id: "route-abc",
      name: "Production Route",
      isPublished: true,
      enabled: true,
      status: "active",
    },
    steps: {
      total: 2,
      enabledCount: 2,
      ordered: [
        { stepId: "s1", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o", enabled: true, label: "Primary" },
        { stepId: "s2", orderIndex: 1, providerPreference: "anthropic", modelId: "claude-3-opus", enabled: true, label: null },
      ],
    },
    policies: [
      { policyId: "pol-1", name: "Model allowlist", scope: "route", bindingId: "b1", type: "model_allowlist", status: "active", ruleSummary: "models: gpt-4o" },
    ],
    narrative: ["Route \"Production Route\" (route-abc) in environment env-1 for project proj-1."],
  },
};

const REAL_SIMULATE_BODY = {
  data: {
    contract_version: "2026-04-16",
    selectedStepId: "s1",
    providerType: "openai",
    modelId: "gpt-4o",
    explanation: "Step 0 selected — openai/gpt-4o",
    wouldRun: true,
    routingAttempts: [
      { stepId: "s1", orderIndex: 0, providerType: "openai", modelId: "gpt-4o", hypotheticalOutcome: "selected" },
      { stepId: "s2", orderIndex: 1, providerType: "anthropic", modelId: "claude-3-opus", hypotheticalOutcome: "not_selected" },
    ],
    stepDiagnostics: [
      { stepId: "s1", orderIndex: 0, providerType: "openai", modelId: "gpt-4o", policyViolations: [], executable: true },
      { stepId: "s2", orderIndex: 1, providerType: "anthropic", modelId: "claude-3-opus", policyViolations: [], executable: true },
    ],
    perStepEstimates: [
      { stepId: "s1", modelId: "gpt-4o", providerType: "openai", estimatedCostUsd: 0.000025, wouldRun: true },
      { stepId: "s2", modelId: "claude-3-opus", providerType: "anthropic", estimatedCostUsd: 0.000045, wouldRun: false },
    ],
    violations: [],
  },
};

function makeFetch(explainBody: unknown, simulateBody: unknown, simulateOk = true) {
  return async (url: RequestInfo | URL, _opts?: RequestInit): Promise<Response> => {
    const urlStr = typeof url === "string" ? url : url.toString();
    if (urlStr.includes("explain-chain")) {
      return { ok: true, status: 200, json: async () => explainBody } as Response;
    }
    return { ok: simulateOk, status: simulateOk ? 200 : 500, json: async () => simulateBody } as Response;
  };
}

describe("RouteResolutionPreview render", () => {
  it("shows idle Run button initially", () => {
    const { getByRole } = render(RouteResolutionPreview, {
      props: { projectId: "proj-1", routeId: "route-abc", environmentId: "env-1" },
    });
    expect(getByRole("button", { name: /run resolution preview/i })).toBeTruthy();
  });

  it("renders route name from real-shaped explain payload (data.route.name)", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = makeFetch(REAL_EXPLAIN_CHAIN_BODY, REAL_SIMULATE_BODY, true);
    try {
      const { getByRole, getByText } = render(RouteResolutionPreview, {
        props: { projectId: "proj-1", routeId: "route-abc", environmentId: "env-1" },
      });
      await fireEvent.click(getByRole("button", { name: /run resolution preview/i }));
      await tick();
      await tick();
      // Route name from data.route.name (not data.routeName)
      expect(getByText("Production Route")).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does NOT show UNPUBLISHED badge for published route (data.route.isPublished=true)", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = makeFetch(REAL_EXPLAIN_CHAIN_BODY, REAL_SIMULATE_BODY, true);
    try {
      const { getByRole, queryByText } = render(RouteResolutionPreview, {
        props: { projectId: "proj-1", routeId: "route-abc", environmentId: "env-1" },
      });
      await fireEvent.click(getByRole("button", { name: /run resolution preview/i }));
      await tick();
      await tick();
      // The UNPUBLISHED badge text must not appear for a published route
      expect(queryByText("UNPUBLISHED")).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("shows UNPUBLISHED badge when data.route.isPublished=false", async () => {
    const unpublishedBody = JSON.parse(JSON.stringify(REAL_EXPLAIN_CHAIN_BODY));
    unpublishedBody.data.route.isPublished = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = makeFetch(unpublishedBody, REAL_SIMULATE_BODY, true);
    try {
      const { getByRole, getByText } = render(RouteResolutionPreview, {
        props: { projectId: "proj-1", routeId: "route-abc", environmentId: "env-1" },
      });
      await fireEvent.click(getByRole("button", { name: /run resolution preview/i }));
      await tick();
      await tick();
      expect(getByText("UNPUBLISHED")).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("renders step list from data.steps.ordered (2 steps)", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = makeFetch(REAL_EXPLAIN_CHAIN_BODY, REAL_SIMULATE_BODY, true);
    try {
      const { getByRole, container } = render(RouteResolutionPreview, {
        props: { projectId: "proj-1", routeId: "route-abc", environmentId: "env-1" },
      });
      await fireEvent.click(getByRole("button", { name: /run resolution preview/i }));
      await tick();
      await tick();
      const stepItems = container.querySelectorAll(".step-item");
      expect(stepItems.length).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

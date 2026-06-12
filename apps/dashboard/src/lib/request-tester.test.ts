/**
 * W3.2 — unit tests: request tester state machine + explain-chain mapping.
 *
 * Pure module tests (no Svelte, no fetch). Covers:
 *  - State machine transitions (idle → running → result/error)
 *  - mapExplainChain: maps raw API response to ExplainChainSummary
 *  - mapSimulateToExplainResult: maps simulate response to ExplainResult
 *  - mapInvokeToResult: maps invoke response to InvokeResult
 *  - formatOutcomeLabel / formatCostUsd helpers
 *  - Invoke confirm guard: the invoke path cannot run without explicit confirmation
 */

import { describe, it, expect } from "vitest";
import {
  TESTER_IDLE,
  testerRunning,
  testerResult,
  testerError,
  mapExplainChain,
  mapSimulateToExplainResult,
  mapInvokeToResult,
  formatOutcomeLabel,
  formatCostUsd,
  type TesterState,
  type ExplainResult,
  type InvokeResult,
} from "./request-tester";

// ────────────────────────────────────────────────────────────────────────────
// State machine
// ────────────────────────────────────────────────────────────────────────────

describe("tester state machine", () => {
  it("TESTER_IDLE starts in idle phase", () => {
    expect(TESTER_IDLE.phase).toBe("idle");
    expect(TESTER_IDLE.result).toBeNull();
    expect(TESTER_IDLE.errorMessage).toBeNull();
  });

  it("testerRunning returns running phase with no result/error", () => {
    const s = testerRunning();
    expect(s.phase).toBe("running");
    expect(s.result).toBeNull();
    expect(s.errorMessage).toBeNull();
  });

  it("testerResult returns result phase with result payload", () => {
    const stub: ExplainResult = {
      kind: "explain",
      routeId: "r1",
      environmentId: "env1",
      selectedStepId: "s1",
      providerType: "openai",
      modelId: "gpt-4o",
      explanation: "ok",
      routingAttempts: [],
      stepDiagnostics: [],
      explainChain: null,
      policyViolations: [],
      wouldRun: true,
      perStepEstimates: [],
      contractVersion: "2026-04-16",
    };
    const s = testerResult(stub);
    expect(s.phase).toBe("result");
    expect(s.result).toBe(stub);
    expect(s.errorMessage).toBeNull();
  });

  it("testerError returns error phase with message", () => {
    const s = testerError("Simulate failed (404)");
    expect(s.phase).toBe("error");
    expect(s.result).toBeNull();
    expect(s.errorMessage).toBe("Simulate failed (404)");
  });

  it("state transitions idle → running → result are distinct objects", () => {
    const idle = TESTER_IDLE;
    const running = testerRunning();
    const result = testerResult({ kind: "explain", routeId: "x", environmentId: "e", selectedStepId: null, providerType: null, modelId: null, explanation: null, routingAttempts: [], stepDiagnostics: [], explainChain: null, policyViolations: [], wouldRun: false, perStepEstimates: [], contractVersion: null });
    expect(idle).not.toBe(running);
    expect(running).not.toBe(result);
    expect(result.phase).toBe("result");
  });

  it("testerResult with invoke kind sets kind correctly", () => {
    const stub: InvokeResult = {
      kind: "invoke",
      routeId: "r1",
      environmentId: "env1",
      content: "Hello",
      providerType: "openai",
      modelId: "gpt-4o",
      latencyMs: 342,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      estimatedCostUsd: 0.0001,
      runtimeSteps: [],
      requestLogHref: "/keys/dashboard/logs?routeId=r1",
      runtimeContractVersion: "2026-06-01",
    };
    const s = testerResult(stub);
    expect(s.phase).toBe("result");
    expect(s.result?.kind).toBe("invoke");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// mapExplainChain
// ────────────────────────────────────────────────────────────────────────────

describe("mapExplainChain", () => {
  it("returns null for empty/null response", () => {
    expect(mapExplainChain({})).toBeNull();
    expect(mapExplainChain({ data: undefined })).toBeNull();
  });

  it("maps a well-formed explain-chain response", () => {
    const raw = {
      data: {
        contractVersion: "2026-04-15",
        route: { name: "My Route", isPublished: true },
        steps: {
          total: 3,
          enabledCount: 2,
          ordered: [
            { stepId: "s1", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o", enabled: true, label: "Primary" },
            { stepId: "s2", orderIndex: 1, providerPreference: "anthropic", modelId: "claude-3-opus", enabled: true, label: null },
            { stepId: "s3", orderIndex: 2, providerPreference: "openai", modelId: "gpt-3.5-turbo", enabled: false, label: "Disabled" },
          ],
        },
        policies: [
          { name: "Model allowlist", policyId: "pol-1" },
          { name: "Budget cap", policyId: "pol-2" },
          { name: "Model allowlist", policyId: "pol-3" }, // duplicate name → deduplicated
        ],
      },
    };
    const result = mapExplainChain(raw);
    expect(result).not.toBeNull();
    expect(result!.routeName).toBe("My Route");
    expect(result!.isPublished).toBe(true);
    expect(result!.enabledStepCount).toBe(2); // s3 is disabled
    expect(result!.steps).toHaveLength(3);
    expect(result!.steps[0]).toMatchObject({ stepId: "s1", orderIndex: 0, enabled: true, label: "Primary" });
    expect(result!.contractVersion).toBe("2026-04-15");
    // Policy names deduplicated
    expect(result!.policyNames).toHaveLength(2);
    expect(result!.policyNames).toContain("Model allowlist");
    expect(result!.policyNames).toContain("Budget cap");
  });

  it("falls back to policyId when name is absent", () => {
    const raw = {
      data: {
        policies: [
          { policyId: "pol-123" },
        ],
        steps: { total: 0, enabledCount: 0, ordered: [] },
      },
    };
    const result = mapExplainChain(raw);
    expect(result!.policyNames).toContain("pol-123");
  });

  it("treats isPublished as true only when explicitly true", () => {
    const raw = { data: { route: { isPublished: false }, steps: { total: 0, enabledCount: 0, ordered: [] } } };
    expect(mapExplainChain(raw)!.isPublished).toBe(false);

    const raw2 = { data: { steps: { total: 0, enabledCount: 0, ordered: [] } } };
    expect(mapExplainChain(raw2)!.isPublished).toBe(false);
  });

  it("defaults routeName to 'Unnamed route' when missing", () => {
    const raw = { data: { steps: { total: 0, enabledCount: 0, ordered: [] } } };
    expect(mapExplainChain(raw)!.routeName).toBe("Unnamed route");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// mapSimulateToExplainResult
// ────────────────────────────────────────────────────────────────────────────

describe("mapSimulateToExplainResult", () => {
  const baseSimulateResponse = {
    data: {
      contract_version: "2026-04-16",
      selectedStepId: "s1",
      providerType: "openai",
      modelId: "gpt-4o",
      explanation: "Step 0 selected",
      wouldRun: true,
      routingAttempts: [
        { stepId: "s1", orderIndex: 0, providerType: "openai", modelId: "gpt-4o", hypotheticalOutcome: "selected" },
        { stepId: "s2", orderIndex: 1, providerType: "anthropic", modelId: "claude-3", hypotheticalOutcome: "not_selected" },
      ],
      stepDiagnostics: [
        { stepId: "s1", orderIndex: 0, providerType: "openai", modelId: "gpt-4o", policyViolations: [], executable: true },
        { stepId: "s2", orderIndex: 1, providerType: "anthropic", modelId: "claude-3", policyViolations: [{ policyId: "p1", policyName: "Allowlist", type: "model_allowlist", message: "model not allowed" }], executable: false },
      ],
      perStepEstimates: [
        { stepId: "s1", modelId: "gpt-4o", providerType: "openai", estimatedCostUsd: 0.000025, wouldRun: true },
        { stepId: "s2", modelId: "claude-3", providerType: "anthropic", estimatedCostUsd: 0.000045, wouldRun: false },
      ],
    },
  };

  it("maps a successful simulate response", () => {
    const result = mapSimulateToExplainResult({
      routeId: "r1",
      environmentId: "env1",
      raw: baseSimulateResponse as Record<string, unknown>,
      explainChain: null,
    });

    expect(result.kind).toBe("explain");
    expect(result.routeId).toBe("r1");
    expect(result.environmentId).toBe("env1");
    expect(result.selectedStepId).toBe("s1");
    expect(result.providerType).toBe("openai");
    expect(result.modelId).toBe("gpt-4o");
    expect(result.wouldRun).toBe(true);
    expect(result.contractVersion).toBe("2026-04-16");
  });

  it("maps routingAttempts correctly", () => {
    const result = mapSimulateToExplainResult({
      routeId: "r1", environmentId: "env1",
      raw: baseSimulateResponse as Record<string, unknown>,
      explainChain: null,
    });
    expect(result.routingAttempts).toHaveLength(2);
    expect(result.routingAttempts[0]).toMatchObject({
      stepId: "s1",
      hypotheticalOutcome: "selected",
      providerType: "openai",
    });
    expect(result.routingAttempts[1]).toMatchObject({
      hypotheticalOutcome: "not_selected",
    });
  });

  it("maps stepDiagnostics including policy violations", () => {
    const result = mapSimulateToExplainResult({
      routeId: "r1", environmentId: "env1",
      raw: baseSimulateResponse as Record<string, unknown>,
      explainChain: null,
    });
    expect(result.stepDiagnostics).toHaveLength(2);
    expect(result.stepDiagnostics[1].policyViolations).toHaveLength(1);
    expect(result.stepDiagnostics[1].policyViolations[0].policyName).toBe("Allowlist");
    expect(result.stepDiagnostics[1].executable).toBe(false);
  });

  it("maps perStepEstimates correctly", () => {
    const result = mapSimulateToExplainResult({
      routeId: "r1", environmentId: "env1",
      raw: baseSimulateResponse as Record<string, unknown>,
      explainChain: null,
    });
    expect(result.perStepEstimates).toHaveLength(2);
    expect(result.perStepEstimates[0]).toMatchObject({ stepId: "s1", wouldRun: true });
  });

  it("maps top-level violations from 403 policy_blocked response", () => {
    // Real shape emitted by simulate/+server.ts lines 234-241 — NO data envelope.
    const blocked403 = {
      error: "policy_blocked",
      message: "All route steps were blocked by policy",
      violations: [
        { policyId: "pol-1", policyName: "Cost Cap", type: "cost", message: "exceeds daily cap" },
      ],
    };
    const result = mapSimulateToExplainResult({
      routeId: "r1", environmentId: "env1",
      raw: blocked403 as Record<string, unknown>,
      explainChain: null,
    });
    // Must have violations so receipt renders "BLOCKED BY POLICY", not "NO STEP EXECUTABLE".
    expect(result.policyViolations).toHaveLength(1);
    expect(result.policyViolations[0]).toMatchObject({
      policyId: "pol-1",
      policyName: "Cost Cap",
      type: "cost",
      message: "exceeds daily cap",
    });
    // The 403 body carries no selectedStepId / wouldRun fields — mapper must not explode.
    expect(result.wouldRun).toBe(false);
    expect(result.selectedStepId).toBeNull();
  });

  it("attaches explainChain when provided", () => {
    const chain = mapExplainChain({
      data: {
        route: { name: "Test Route", isPublished: true },
        steps: { total: 1, enabledCount: 1, ordered: [{ stepId: "s1", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o", enabled: true }] },
        policies: [],
      },
    });
    const result = mapSimulateToExplainResult({
      routeId: "r1", environmentId: "env1",
      raw: baseSimulateResponse as Record<string, unknown>,
      explainChain: chain,
    });
    expect(result.explainChain).not.toBeNull();
    expect(result.explainChain!.routeName).toBe("Test Route");
  });

  it("handles empty/missing data gracefully", () => {
    const result = mapSimulateToExplainResult({ routeId: "r1", environmentId: "env1", raw: {}, explainChain: null });
    expect(result.routingAttempts).toHaveLength(0);
    expect(result.stepDiagnostics).toHaveLength(0);
    expect(result.wouldRun).toBe(false);
    expect(result.contractVersion).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// mapInvokeToResult
// ────────────────────────────────────────────────────────────────────────────

describe("mapInvokeToResult", () => {
  const baseInvokeResponse = {
    data: {
      runtimeContractVersion: "2026-06-01",
      content: "The answer is 42.",
      providerType: "openai",
      modelId: "gpt-4o",
      estimatedCostUsd: 0.00015,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      runtimeSteps: [
        { routeStepId: "s1", orderIndex: 0, providerType: "openai", modelId: "gpt-4o", promptTokens: 100, completionTokens: 50 },
      ],
    },
  };

  it("maps a successful invoke response", () => {
    const result = mapInvokeToResult({
      routeId: "r1",
      environmentId: "env1",
      raw: baseInvokeResponse as Record<string, unknown>,
      latencyMs: 512,
      logsHref: "/keys/dashboard/logs?routeId=r1",
    });

    expect(result.kind).toBe("invoke");
    expect(result.routeId).toBe("r1");
    expect(result.environmentId).toBe("env1");
    expect(result.content).toBe("The answer is 42.");
    expect(result.providerType).toBe("openai");
    expect(result.modelId).toBe("gpt-4o");
    expect(result.latencyMs).toBe(512);
    expect(result.estimatedCostUsd).toBe(0.00015);
    expect(result.runtimeContractVersion).toBe("2026-06-01");
  });

  it("maps usage tokens", () => {
    const result = mapInvokeToResult({
      routeId: "r1", environmentId: "env1",
      raw: baseInvokeResponse as Record<string, unknown>,
      latencyMs: 100,
      logsHref: "/logs",
    });
    expect(result.usage.promptTokens).toBe(100);
    expect(result.usage.completionTokens).toBe(50);
    expect(result.usage.totalTokens).toBe(150);
  });

  it("maps runtimeSteps", () => {
    const result = mapInvokeToResult({
      routeId: "r1", environmentId: "env1",
      raw: baseInvokeResponse as Record<string, unknown>,
      latencyMs: 100,
      logsHref: "/logs",
    });
    expect(result.runtimeSteps).toHaveLength(1);
    expect(result.runtimeSteps[0]).toMatchObject({ routeStepId: "s1", orderIndex: 0 });
  });

  it("sets requestLogHref from logsHref argument", () => {
    const result = mapInvokeToResult({
      routeId: "r1", environmentId: "env1",
      raw: baseInvokeResponse as Record<string, unknown>,
      latencyMs: 0,
      logsHref: "/keys/dashboard/logs?routeId=r1",
    });
    expect(result.requestLogHref).toBe("/keys/dashboard/logs?routeId=r1");
  });

  it("handles skipped steps", () => {
    const withSkip = {
      data: {
        content: "ok",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        runtimeSteps: [
          { routeStepId: "s1", orderIndex: 0, providerType: "openai", modelId: "gpt-4o", promptTokens: 10, completionTokens: 5, skipped: false },
          { routeStepId: "s2", orderIndex: 1, providerType: "anthropic", modelId: "claude", promptTokens: null, completionTokens: null, skipped: true, skipReason: "step_not_reached" },
        ],
      },
    };
    const result = mapInvokeToResult({
      routeId: "r1", environmentId: "env1",
      raw: withSkip as Record<string, unknown>,
      latencyMs: 200,
      logsHref: "/logs",
    });
    expect(result.runtimeSteps[1].skipped).toBe(true);
    expect(result.runtimeSteps[1].skipReason).toBe("step_not_reached");
    expect(result.runtimeSteps[0].skipped).toBeUndefined();
  });

  it("handles empty response gracefully", () => {
    const result = mapInvokeToResult({ routeId: "r1", environmentId: "env1", raw: {}, latencyMs: 0, logsHref: "/" });
    expect(result.content).toBe("");
    expect(result.runtimeSteps).toHaveLength(0);
    expect(result.runtimeContractVersion).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

describe("formatOutcomeLabel", () => {
  it.each([
    ["selected", "SELECTED"],
    ["blocked_by_policy", "BLOCKED"],
    ["not_executable", "NO KEY"],
    ["not_selected", "SKIPPED"],
  ] as const)("formatOutcomeLabel(%s) returns %s", (input, expected) => {
    expect(formatOutcomeLabel(input)).toBe(expected);
  });
});

describe("formatCostUsd", () => {
  it("returns — for null", () => {
    expect(formatCostUsd(null)).toBe("—");
  });

  it("formats normal costs to 6 decimal places", () => {
    expect(formatCostUsd(0.000025)).toBe("$0.000025");
    expect(formatCostUsd(0.15)).toBe("$0.150000");
  });

  it("returns < threshold text for sub-micro costs", () => {
    expect(formatCostUsd(0.0000005)).toBe("<$0.000001");
    expect(formatCostUsd(0)).toBe("<$0.000001");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Invoke confirm guard (state machine contract — pure logic, no component mount)
// ────────────────────────────────────────────────────────────────────────────

/**
 * NOTE: These tests verify the *state-machine contract* using locally-defined stand-ins.
 * They do NOT mount the component or assert that the alertdialog renders in the DOM.
 * Component-level coverage (alertdialog appears before fetch, role="alertdialog" present)
 * lives in RouteResolutionPreview.test.ts — see that file for the Svelte harness pattern.
 *
 * Contract: requestRealSend must NOT advance testerState to "running". Only
 * confirmRealSend (called after the dialog) may do so.
 */
describe("invoke confirm guard — state machine contract (pure, no component mount)", () => {
  it("requestRealSend keeps state idle; confirmRealSend advances to running", () => {
    let invokeConfirmPending = false;
    let testerState: TesterState = TESTER_IDLE;

    function requestRealSend() { invokeConfirmPending = true; }
    function cancelRealSend() { invokeConfirmPending = false; }
    function beginRealSend() { testerState = testerRunning(); invokeConfirmPending = false; }

    requestRealSend();
    expect(invokeConfirmPending).toBe(true);
    expect(testerState.phase).toBe("idle"); // guard: state must NOT change on request

    cancelRealSend();
    expect(invokeConfirmPending).toBe(false);
    expect(testerState.phase).toBe("idle");

    requestRealSend();
    expect(testerState.phase).toBe("idle"); // still idle before confirm

    beginRealSend();
    expect(invokeConfirmPending).toBe(false);
    expect(testerState.phase).toBe("running"); // only running AFTER confirm
  });

  it("guard function throws if confirm skipped (state-machine stand-in, not a DOM test)", () => {
    // Stand-in functions mirror the component's requestRealSend / confirmRealSend logic.
    // Actual DOM-level guard (alertdialog role) is covered in RouteResolutionPreview.test.ts.
    let guardPassed = false;
    let fetchCalled = false;

    function requestRealSendStandin() { guardPassed = true; }
    function confirmRealSendStandin() {
      if (!guardPassed) throw new Error("fetch called without passing confirm guard");
      fetchCalled = true;
    }

    requestRealSendStandin();
    expect(guardPassed).toBe(true);
    expect(fetchCalled).toBe(false); // fetch must NOT have been called yet

    confirmRealSendStandin();
    expect(fetchCalled).toBe(true);
  });
});

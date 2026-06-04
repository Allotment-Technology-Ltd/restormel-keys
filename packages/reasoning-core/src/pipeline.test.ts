import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReasoningCoreContext } from "./context.js";
import { runVerificationPipeline } from "./pipeline.js";

const mockedExtractClaims = vi.fn();
const mockedEvaluateReasoning = vi.fn();
const mockedEvaluateConstitution = vi.fn();
const mockedRunPassOutputs = vi.fn();

vi.mock("./extraction.js", () => ({
  extractClaims: (...args: unknown[]) => mockedExtractClaims(...args),
}));

vi.mock("./reasoning-eval.js", () => ({
  evaluateReasoning: (...args: unknown[]) => mockedEvaluateReasoning(...args),
}));

vi.mock("./constitution/evaluator.js", () => ({
  evaluateConstitutionWithTelemetry: (...args: unknown[]) => mockedEvaluateConstitution(...args),
}));

const mockCtx = {} as ReasoningCoreContext;

describe("runVerificationPipeline", () => {
  beforeEach(() => {
    mockedRunPassOutputs.mockReset();
    mockedExtractClaims.mockReset();
    mockedEvaluateReasoning.mockReset();
    mockedEvaluateConstitution.mockReset();

    mockedRunPassOutputs.mockImplementation(async (_input, callbacks) => {
      callbacks.onPassChunk("analysis", "A");
      callbacks.onPassChunk("critique", "C");
      callbacks.onPassChunk("synthesis", "S");
      callbacks.onMetadata(11, 22, 33, {
        claims_retrieved: 4,
        arguments_retrieved: 2,
        detected_domain: "test",
        domain_confidence: "high",
      });
    });

    mockedExtractClaims.mockResolvedValue({
      claims: [
        {
          id: "c1",
          text: "Test claim",
          claim_type: "empirical",
          scope: "moderate",
          confidence: 0.8,
        },
      ],
      relations: [],
      metadata: {
        source_length: 10,
        extraction_model: "test-model",
        extraction_duration_ms: 5,
        tokens_used: { input: 7, output: 3 },
      },
    });

    mockedEvaluateReasoning.mockResolvedValue({
      evaluation: {
        overall_score: 0.5,
        dimensions: [
          { dimension: "logical_structure", score: 0.5, explanation: "ok" },
          { dimension: "evidence_grounding", score: 0.5, explanation: "ok" },
          { dimension: "counterargument_coverage", score: 0.5, explanation: "ok" },
          { dimension: "scope_calibration", score: 0.5, explanation: "ok" },
          { dimension: "assumption_transparency", score: 0.5, explanation: "ok" },
          { dimension: "internal_consistency", score: 0.5, explanation: "ok" },
        ],
      },
      route: {
        provider: "vertex",
        modelId: "gemini-3-flash-preview",
        routeId: "verify",
        reason: "Restormel route",
      },
    });

    mockedEvaluateConstitution.mockResolvedValue({
      check: {
        rules_evaluated: 10,
        satisfied: [],
        violated: [],
        uncertain: [],
        not_applicable: [],
        overall_compliance: "pass",
      },
      telemetry: {
        constitution_input_tokens: 13,
        constitution_output_tokens: 9,
        constitution_llm_called: true,
        constitution_llm_failed: false,
        constitution_rule_violations: [],
      },
    });
  });

  it("returns full verification output when pass outputs are enabled", async () => {
    const result = await runVerificationPipeline(
      { text: "Hello world" },
      { ctx: mockCtx, includePassOutputs: true, runPassOutputs: mockedRunPassOutputs }
    );

    expect(mockedRunPassOutputs).toHaveBeenCalledTimes(1);
    expect(result.pass_outputs).toEqual({ analysis: "A", critique: "C", synthesis: "S" });
    expect(result.retrieval?.claims_retrieved).toBe(4);
    expect(result.extraction_input_tokens).toBe(7);
    expect(result.constitution_input_tokens).toBe(13);
  });

  it("skips domain-agnostic pass execution when pass outputs are disabled", async () => {
    const result = await runVerificationPipeline(
      { text: "Hello world" },
      { ctx: mockCtx, includePassOutputs: false }
    );

    expect(mockedRunPassOutputs).not.toHaveBeenCalled();
    expect(result.pass_outputs).toBeUndefined();
  });
});

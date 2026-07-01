import { afterEach, describe, expect, it, vi } from "vitest";
import { callStageModel } from "./model-call.js";
import type { IngestBackoffSignal } from "./backoff-signal.js";
import type {
  CostTracker,
  IngestionStagePlan,
  StageBudget,
  StageUsageTracker,
} from "../ports.js";

function freshCosts(): CostTracker {
  return { totalInputTokens: 0, totalOutputTokens: 0, vertexChars: 0, totalUsd: 0 };
}

function freshTracker(): StageUsageTracker {
  return { stage: "extraction", startInputTokens: 0, startOutputTokens: 0, startUsd: 0, retries: 0 };
}

function plan(): IngestionStagePlan {
  return {
    stage: "extraction",
    request: {} as IngestionStagePlan["request"],
    provider: "anthropic",
    model: "claude-test",
    estimatedCostUsd: 0,
    routingReason: "test",
    routingSource: "requested",
    route: { model: {}, modelId: "claude-test", provider: "anthropic" },
  };
}

const budget: StageBudget = { maxRetries: 2, timeoutMs: 5_000 };

describe("callStageModel onBackoff signal", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("emits a structured rate_limit backoff on a 429 then succeeds on retry", async () => {
    vi.useFakeTimers();
    const signals: IngestBackoffSignal[] = [];
    let calls = 0;
    const generateText = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("HTTP 429 Too Many Requests");
      return { text: "ok", usage: { inputTokens: 5, outputTokens: 5 }, finishReason: "stop" };
    });

    const promise = callStageModel({
      deps: { generateText },
      stage: "extraction",
      plan: plan(),
      budget,
      tracker: freshTracker(),
      costs: freshCosts(),
      timing: null,
      systemPrompt: "sys",
      userMessage: "user",
      onBackoff: (s) => signals.push(s),
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("ok");
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      stage: "extraction",
      provider: "anthropic",
      model: "claude-test",
      reason_code: "rate_limit",
      attempt: 2,
      max_attempts: 3,
      delay_ms: 1000,
    });
    expect(typeof signals[0]!.at).toBe("string");
  });

  it("never throws when the onBackoff sink throws", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const generateText = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("529 overloaded");
      return { text: "done", usage: { inputTokens: 1, outputTokens: 1 }, finishReason: "stop" };
    });
    const promise = callStageModel({
      deps: { generateText },
      stage: "extraction",
      plan: plan(),
      budget,
      tracker: freshTracker(),
      costs: freshCosts(),
      timing: null,
      systemPrompt: "sys",
      userMessage: "user",
      onBackoff: () => {
        throw new Error("sink boom");
      },
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("done");
  });

  it("does not emit when the call succeeds first time", async () => {
    const signals: IngestBackoffSignal[] = [];
    const generateText = vi.fn(async () => ({
      text: "first-try",
      usage: { inputTokens: 1, outputTokens: 1 },
      finishReason: "stop",
    }));
    const result = await callStageModel({
      deps: { generateText },
      stage: "extraction",
      plan: plan(),
      budget,
      tracker: freshTracker(),
      costs: freshCosts(),
      timing: null,
      systemPrompt: "sys",
      userMessage: "user",
      onBackoff: (s) => signals.push(s),
    });
    expect(result).toBe("first-try");
    expect(signals).toHaveLength(0);
  });

  it("does not retry (or emit) on a hard, non-transient failure", async () => {
    const signals: IngestBackoffSignal[] = [];
    const generateText = vi.fn(async () => {
      throw new Error("401 Unauthorized");
    });
    await expect(
      callStageModel({
        deps: { generateText },
        stage: "extraction",
        plan: plan(),
        budget,
        tracker: freshTracker(),
        costs: freshCosts(),
        timing: null,
        systemPrompt: "sys",
        userMessage: "user",
        onBackoff: (s) => signals.push(s),
      }),
    ).rejects.toThrow();
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(signals).toHaveLength(0);
  });
});

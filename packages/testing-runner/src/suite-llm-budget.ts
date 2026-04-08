import type { LlmBudget } from "@restormel/testing-core";
import type { LlmTokenUsage } from "./llm-usage.js";

export type BudgetBlock = {
  code: string;
  summary: string;
};

function hasDefinedNumericUsage(u: LlmTokenUsage): boolean {
  return (
    (u.promptTokens !== undefined && Number.isFinite(u.promptTokens)) ||
    (u.completionTokens !== undefined && Number.isFinite(u.completionTokens)) ||
    (u.totalTokens !== undefined && Number.isFinite(u.totalTokens))
  );
}

/**
 * Enforces suite- and goal-level `llm_budget` and aggregates provider token usage for {@link RunRecord.costEstimate}.
 */
export class SuiteLlmBudgetTracker {
  private readonly suiteStart = Date.now();
  private suiteCompletions = 0;
  private suiteAcRounds = 0;
  private goalCompletions = 0;
  private goalAcRounds = 0;
  private currentGoalId = "";
  private goalBudget: LlmBudget | undefined;
  private promptSum = 0;
  private completionSum = 0;
  private totalReportedSum = 0;
  /** True when at least one completion returned numeric `usage` fields (including zeros). */
  private providerReportedUsage = false;
  private estimateOnlyCalls = 0;

  constructor(private readonly suiteBudget: LlmBudget | undefined) {}

  beginGoal(goalId: string, goalBudget: LlmBudget | undefined): void {
    this.currentGoalId = goalId;
    this.goalBudget = goalBudget;
    this.goalCompletions = 0;
    this.goalAcRounds = 0;
  }

  wallClockMs(): number {
    return Date.now() - this.suiteStart;
  }

  /** Call before each chat completion (judge or AC agent). */
  tryConsumeLlm(kind: "ac_round" | "chat"): BudgetBlock | null {
    const wall = this.wallClockMs();
    if (this.suiteBudget?.maxWallClockMs !== undefined && wall >= this.suiteBudget.maxWallClockMs) {
      return {
        code: "SUITE_BUDGET_WALL_CLOCK",
        summary: `Suite llm_budget: wall clock ${wall}ms >= max_wall_clock_ms ${this.suiteBudget.maxWallClockMs}`,
      };
    }
    if (this.suiteBudget?.maxCompletions !== undefined && this.suiteCompletions >= this.suiteBudget.maxCompletions) {
      return {
        code: "SUITE_BUDGET_MAX_COMPLETIONS",
        summary: `Suite llm_budget: ${this.suiteCompletions} LLM calls >= max_completions ${this.suiteBudget.maxCompletions}`,
      };
    }
    if (
      kind === "ac_round" &&
      this.suiteBudget?.maxRounds !== undefined &&
      this.suiteAcRounds >= this.suiteBudget.maxRounds
    ) {
      return {
        code: "SUITE_BUDGET_MAX_ROUNDS",
        summary: `Suite llm_budget: ${this.suiteAcRounds} AC agent rounds >= max_rounds ${this.suiteBudget.maxRounds}`,
      };
    }
    if (this.goalBudget?.maxCompletions !== undefined && this.goalCompletions >= this.goalBudget.maxCompletions) {
      return {
        code: "GOAL_BUDGET_MAX_COMPLETIONS",
        summary: `Goal "${this.currentGoalId}" llm_budget: ${this.goalCompletions} LLM calls >= max_completions ${this.goalBudget.maxCompletions}`,
      };
    }
    if (
      kind === "ac_round" &&
      this.goalBudget?.maxRounds !== undefined &&
      this.goalAcRounds >= this.goalBudget.maxRounds
    ) {
      return {
        code: "GOAL_BUDGET_MAX_ROUNDS",
        summary: `Goal "${this.currentGoalId}" llm_budget: ${this.goalAcRounds} AC rounds >= max_rounds ${this.goalBudget.maxRounds}`,
      };
    }
    return null;
  }

  /** Suite wall clock or total completion cap — skip starting further goals without consuming a slot. */
  suiteNonAcWouldBlock(): BudgetBlock | null {
    const wall = this.wallClockMs();
    if (this.suiteBudget?.maxWallClockMs !== undefined && wall >= this.suiteBudget.maxWallClockMs) {
      return {
        code: "SUITE_BUDGET_WALL_CLOCK",
        summary: `Suite llm_budget: wall clock ${wall}ms >= max_wall_clock_ms ${this.suiteBudget.maxWallClockMs}`,
      };
    }
    if (this.suiteBudget?.maxCompletions !== undefined && this.suiteCompletions >= this.suiteBudget.maxCompletions) {
      return {
        code: "SUITE_BUDGET_MAX_COMPLETIONS",
        summary: `Suite llm_budget: ${this.suiteCompletions} LLM calls >= max_completions ${this.suiteBudget.maxCompletions}`,
      };
    }
    return null;
  }

  /** Before an ac_sequence goal: suite AC round budget already exhausted. */
  suiteAcBudgetWouldBlock(): BudgetBlock | null {
    if (this.suiteBudget?.maxRounds !== undefined && this.suiteAcRounds >= this.suiteBudget.maxRounds) {
      return {
        code: "SUITE_BUDGET_MAX_ROUNDS",
        summary: `Suite llm_budget: ${this.suiteAcRounds} AC agent rounds >= max_rounds ${this.suiteBudget.maxRounds}`,
      };
    }
    return null;
  }

  /** Call after an LLM request returns (count attempt even if model errored after HTTP 200). */
  recordLlmCall(kind: "ac_round" | "chat", usage?: LlmTokenUsage): void {
    this.suiteCompletions++;
    this.goalCompletions++;
    if (kind === "ac_round") {
      this.suiteAcRounds++;
      this.goalAcRounds++;
    }
    if (usage !== undefined && hasDefinedNumericUsage(usage)) {
      this.providerReportedUsage = true;
      this.promptSum += usage.promptTokens ?? 0;
      this.completionSum += usage.completionTokens ?? 0;
      const t = usage.totalTokens;
      if (t !== undefined && Number.isFinite(t)) this.totalReportedSum += t;
    } else {
      this.estimateOnlyCalls++;
    }
  }

  summarizeExecution(): { wallClockMs: number; llmCompletions: number; acAgentRounds: number } {
    return {
      wallClockMs: this.wallClockMs(),
      llmCompletions: this.suiteCompletions,
      acAgentRounds: this.suiteAcRounds,
    };
  }

  usageForCostEstimate(): {
    tokenUsage?: { prompt?: number; completion?: number; total?: number };
    usageSource: "provider" | "estimate" | "mixed";
  } {
    const hasProvider = this.providerReportedUsage;
    if (hasProvider && this.estimateOnlyCalls > 0) {
      return {
        tokenUsage: {
          prompt: this.promptSum > 0 ? this.promptSum : undefined,
          completion: this.completionSum > 0 ? this.completionSum : undefined,
          total: this.totalReportedSum > 0 ? this.totalReportedSum : undefined,
        },
        usageSource: "mixed",
      };
    }
    if (hasProvider) {
      return {
        tokenUsage: {
          prompt: this.promptSum > 0 ? this.promptSum : undefined,
          completion: this.completionSum > 0 ? this.completionSum : undefined,
          total: this.totalReportedSum > 0 ? this.totalReportedSum : undefined,
        },
        usageSource: "provider",
      };
    }
    return { usageSource: "estimate" };
  }
}

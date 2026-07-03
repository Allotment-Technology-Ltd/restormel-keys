import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { browserTracesToCoreEvents, createPlaywrightTestingSession } from "@restormel/testing-browser-playwright";
import type {
  AcceptanceCriterionDefinition,
  AcSequenceStepResult,
  GoalRunRecord,
  KeysModelMeta,
  TestGoal,
  TraceEvent,
  Verdict,
} from "@restormel/testing-core";
import { sanitizePathSegment } from "@restormel/testing-core";
import type { TestingBrowserSession } from "@restormel/testing-browser-playwright";
import type { AcAgentLoopResult } from "./ac-agent-loop.js";
import { resolveModel, type ResolvedModel } from "@restormel/testing-keys-adapter";
import { runBuiltInAcAgentLoop } from "./ac-agent-loop.js";
import { runAcShapedJudgeRubric } from "./ac-judge.js";
import { runAcPostCheck } from "./ac-post-checks.js";
import { evaluateBrowserSuccessCriteria } from "./evaluate-criteria.js";
import { judgeLogicalRefForCriteria } from "./judge-ref.js";
import { installBrowserEgressRouteBlockForSession } from "./egress-browser-context.js";
import { goalEntryUrl, type RunBrowserGoalOptions, type RunBrowserGoalResult } from "./browser-goal.js";
import { runMissionExecutorCommand } from "./shell-hooks.js";
import { runGoalAttempts, type AttemptOutcome } from "./retries.js";
import { TimeoutError, withTimeout } from "./timeout.js";

function nowIso(): string {
  return new Date().toISOString();
}

function worstVerdict(a: Verdict, b: Verdict): Verdict {
  const rank: Record<Verdict, number> = { passed: 0, indeterminate: 1, failed: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function aggregateStepVerdicts(steps: AcSequenceStepResult[]): Verdict {
  let v: Verdict = "passed";
  for (const s of steps) {
    v = worstVerdict(v, s.verdict);
  }
  return v;
}

function toKeysModelMeta(
  model: ResolvedModel,
  invocations: number,
  tokens?: { prompt?: number; completion?: number },
): KeysModelMeta {
  const m: KeysModelMeta = {
    logicalRef: model.meta.logicalRef,
    provider: model.meta.provider,
    model: model.meta.model,
    resolutionSource: model.meta.resolutionSource,
    invocationCount: invocations,
  };
  if (tokens?.prompt !== undefined) m.promptTokens = tokens.prompt;
  if (tokens?.completion !== undefined) m.completionTokens = tokens.completion;
  return m;
}

function refForAgent(goal: TestGoal, resolvedKeys: Record<string, string>): string | undefined {
  const mr = goal.acSequence?.builtInAgent.modelRef?.trim();
  if (mr) return mr;
  return (
    resolvedKeys.llm_primary ??
    resolvedKeys.llmPrimary ??
    resolvedKeys.judge ??
    resolvedKeys.llm_judge ??
    resolvedKeys.llmJudge
  );
}

async function captureStepScreenshot(
  session: TestingBrowserSession,
  artifactDir: string,
  goalId: string,
  acId: string,
  attemptIndex: number,
): Promise<string | undefined> {
  const safeGoal = sanitizePathSegment(goalId);
  const safeAc = sanitizePathSegment(acId) || "ac";
  const dir = join(artifactDir, "goals", safeGoal, "ac-sequence");
  await mkdir(dir, { recursive: true });
  const name = `attempt-${attemptIndex}-${safeAc}.png`;
  const abs = join(dir, name);
  try {
    await session.screenshot(abs);
    return join("goals", safeGoal, "ac-sequence", name);
  } catch {
    return undefined;
  }
}

function acIdsFragment(goal: TestGoal): Pick<GoalRunRecord, "acceptanceCriterionIds"> {
  if (goal.acceptanceCriterionIds === undefined || goal.acceptanceCriterionIds.length === 0) return {};
  return { acceptanceCriterionIds: [...goal.acceptanceCriterionIds] };
}

export type RunAcSequenceBrowserGoalOptions = RunBrowserGoalOptions & {
  suiteUserStory?: string;
  acceptanceCriteria: AcceptanceCriterionDefinition[];
  hookCwd: string;
};

/**
 * `execution_mode: ac_sequence` — walk acceptance criteria with the built-in LLM browser agent (R-BA-4),
 * optional per-AC judge JSON with `ac_id` (R-BA-5), and HTTP / DOM / shell post-checks (R-BA-6).
 */
export async function runAcSequenceBrowserGoal(options: RunAcSequenceBrowserGoalOptions): Promise<RunBrowserGoalResult> {
  const { goal, runId, acceptanceCriteria } = options;
  const cfg = goal.acSequence;
  if (!cfg) {
    throw new Error("runAcSequenceBrowserGoal: goal.acSequence missing");
  }

  const warnings: string[] = [];
  const keysModelMetaFragments: KeysModelMeta[] = [];
  const allTraces: TraceEvent[] = [];
  let stepCursor = options.startingStepIndex;

  const pushTrace = (partial: Omit<TraceEvent, "id" | "runId" | "goalId" | "stepIndex" | "timestamp">) => {
    allTraces.push({
      id: randomUUID(),
      runId,
      goalId: goal.id,
      stepIndex: stepCursor++,
      timestamp: nowIso(),
      ...partial,
    });
  };

  const agentRef = refForAgent(goal, options.resolvedKeys);
  if (!agentRef) {
    const gr: GoalRunRecord = {
      goalId: goal.id,
      verdict: "failed",
      reasonCode: "AC_AGENT_NO_MODEL_REF",
      summary: "ac_sequence requires built_in_agent.model_ref or llm_primary / judge in environment keys",
      retriesUsed: 0,
      evidenceRefs: [],
      ...acIdsFragment(goal),
    };
    return { goalRecord: gr, traces: allTraces, nextStepIndex: stepCursor, warnings, keysModelMetaFragments };
  }

  const agentResolve = await resolveModel(agentRef, options.keysAdapterOptions ?? {});
  if (!agentResolve.ok) {
    const gr: GoalRunRecord = {
      goalId: goal.id,
      verdict: "failed",
      reasonCode: "AC_AGENT_MODEL_RESOLVE_FAILED",
      summary: agentResolve.error.message,
      retriesUsed: 0,
      evidenceRefs: [],
      ...acIdsFragment(goal),
    };
    warnings.push(`Goal "${goal.id}": AC agent model resolution failed (${agentResolve.error.code})`);
    return { goalRecord: gr, traces: allTraces, nextStepIndex: stepCursor, warnings, keysModelMetaFragments };
  }
  const agentModel = agentResolve.model;
  warnings.push(...agentResolve.warnings);

  const sessionFactory = options.createBrowserSession ?? createPlaywrightTestingSession;
  const maxRounds = goal.llmBudget?.maxRounds ?? cfg.builtInAgent.maxRoundsPerCriterion ?? 12;

  let lastSteps: AcSequenceStepResult[] = [];

  const attemptResult = await runGoalAttempts({
    maxRetries: options.retryPolicy.maxRetries,
    backoffMs: options.retryPolicy.backoffMs,
    runAttempt: async (attemptIndex) => {
      pushTrace({
        kind: "observation",
        summary: `AC sequence attempt ${attemptIndex + 1} start`,
        metadata: { phase: "ac_sequence_attempt", attemptIndex },
      });

      let session: TestingBrowserSession | undefined;
      try {
        session = await sessionFactory({
          headless: options.headless ?? true,
          timeoutMs: options.timeoutMs,
          ...(options.storageStatePath !== undefined && options.storageStatePath.length > 0
            ? { storageState: options.storageStatePath }
            : {}),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        pushTrace({ kind: "error", summary: `Browser session failed: ${msg}`, metadata: { attemptIndex } });
        return {
          kind: "stop",
          verdict: "failed",
          reasonCode: "ADAPTER_ERROR",
          summary: `Browser adapter could not start a session: ${msg}`,
          retryable: false,
        } satisfies AttemptOutcome;
      }

      const steps: AcSequenceStepResult[] = [];
      let chatInvocations = 0;
      let agentPromptSum = 0;
      let agentCompletionSum = 0;

      try {
        await installBrowserEgressRouteBlockForSession(session, options.baseUrl, options.egressAllowHosts);
        const entryUrl = goalEntryUrl(options.baseUrl, goal.startPath);
        await withTimeout(
          session.navigate(entryUrl, { timeoutMs: options.timeoutMs, waitUntil: "load" }),
          options.timeoutMs + 2000,
          "navigation",
        );
        pushTrace({
          kind: "observation",
          summary: `Navigated to ${entryUrl}`,
          metadata: { phase: "ac_sequence_entry", attemptIndex },
        });

        for (let ci = 0; ci < acceptanceCriteria.length; ci++) {
          const ac = acceptanceCriteria[ci]!;
          let stepVerdict: Verdict = "passed";
          const notes: string[] = [];
          const stepEvidence: string[] = [];
          let agentRounds = 0;
          let agentOut: AcAgentLoopResult = {
            ok: true,
            roundsUsed: 0,
            finished: "done",
          };

          pushTrace({
            kind: "observation",
            summary: `AC ${ac.id}: start`,
            metadata: { phase: "ac_start", acId: ac.id, attemptIndex },
          });

          const baseExtra: Record<string, string | undefined> = {
            RESTORMEL_TESTING_AC_ID: ac.id,
            RESTORMEL_TESTING_AC_TEXT: ac.text,
            RESTORMEL_TESTING_AC_INDEX: String(ci),
            RESTORMEL_TESTING_BASE_URL: options.baseUrl,
            RESTORMEL_TESTING_GOAL_ID: goal.id,
            RESTORMEL_TESTING_RUN_ID: runId,
            RESTORMEL_TESTING_USER_STORY: options.suiteUserStory ?? "",
          };
          if (options.artifactDir !== undefined && options.artifactDir.trim() !== "") {
            baseExtra.RESTORMEL_TESTING_ARTIFACT_DIR = options.artifactDir;
          }

          if (cfg.criterionExecutor !== undefined && cfg.criterionExecutor.trim() !== "") {
            const cr = await runMissionExecutorCommand(cfg.criterionExecutor.trim(), {
              cwd: options.hookCwd,
              label: `ac_sequence criterion_executor (${goal.id} / ${ac.id})`,
              extraEnv: baseExtra,
            });
            if (!cr.ok) {
              stepVerdict = "failed";
              notes.push(`criterion_executor: ${cr.message}`);
              if (options.captureScreenshotOnFailure && options.artifactDir) {
                const shot = await captureStepScreenshot(session, options.artifactDir, goal.id, ac.id, attemptIndex);
                if (shot) stepEvidence.push(shot);
              }
              steps.push({
                criterionId: ac.id,
                verdict: "failed",
                reasonCode: "AC_CRITERION_EXECUTOR_FAILED",
                summary: notes.join(" | "),
                agentRoundsUsed: 0,
                evidenceRefs: stepEvidence,
              });
              pushTrace({
                kind: "assertion",
                summary: `AC ${ac.id}: failed`,
                metadata: { acId: ac.id, verdict: "failed", attemptIndex },
              });
              continue;
            }
          }

          const perAcBudget = options.timeoutMs * 4 + maxRounds * 5000;
          try {
            agentOut = await withTimeout(
              runBuiltInAcAgentLoop(session.page, ac, agentModel, options.baseUrl, {
                maxRounds,
                instructions: cfg.builtInAgent.instructions,
                egressAllowHosts: options.egressAllowHosts,
                suiteLlmBudget: options.suiteLlmBudget,
              }),
              perAcBudget,
              "ac_agent_loop",
            );
          } catch (e) {
            if (e instanceof TimeoutError) {
              agentOut = {
                ok: false,
                roundsUsed: maxRounds,
                reasonCode: "AC_AGENT_TIMEOUT",
                summary: e.message,
              };
            } else {
              throw e;
            }
          }

          chatInvocations += agentOut.roundsUsed;
          agentRounds = agentOut.roundsUsed;
          if (agentOut.aggregatedTokenUsage) {
            agentPromptSum += agentOut.aggregatedTokenUsage.promptTokens;
            agentCompletionSum += agentOut.aggregatedTokenUsage.completionTokens;
          }
          if (!agentOut.ok) {
            stepVerdict = worstVerdict(stepVerdict, "failed");
            notes.push(`agent: ${agentOut.summary}`);
          }

          const scMap = cfg.criterionSuccess?.[ac.id];
          if (scMap !== undefined) {
            const jRef = judgeLogicalRefForCriteria(scMap, options.resolvedKeys);
            let judgeM: ResolvedModel | undefined;
            if (jRef) {
              const jr = await resolveModel(jRef, options.keysAdapterOptions ?? {});
              if (jr.ok) {
                judgeM = jr.model;
                warnings.push(...jr.warnings);
              }
            }
            const det = await evaluateBrowserSuccessCriteria(session.page, scMap, {
              judgeModel: judgeM,
              suiteLlmBudget: options.suiteLlmBudget,
            });
            if (det.judgeModelInvocations && det.judgeModelInvocations > 0) {
              if (judgeM) {
                keysModelMetaFragments.push(
                  toKeysModelMeta(judgeM, det.judgeModelInvocations, {
                    prompt: det.judgePromptTokens,
                    completion: det.judgeCompletionTokens,
                  }),
                );
              }
            }
            stepVerdict = worstVerdict(stepVerdict, det.verdict);
            if (det.verdict !== "passed") notes.push(`criteria: ${det.summary}`);
          }

          const rub = cfg.criterionRubrics?.[ac.id];
          if (rub !== undefined) {
            const rref =
              rub.modelRef?.trim() ||
              options.resolvedKeys.llm_primary ||
              options.resolvedKeys.llmPrimary ||
              options.resolvedKeys.judge;
            if (!rref) {
              stepVerdict = worstVerdict(stepVerdict, "indeterminate");
              notes.push("criterion_rubrics: no model_ref / llm_primary");
            } else {
              const rr = await resolveModel(rref, options.keysAdapterOptions ?? {});
              if (!rr.ok) {
                stepVerdict = worstVerdict(stepVerdict, "indeterminate");
                notes.push(`criterion_rubrics resolve: ${rr.error.message}`);
              } else {
                warnings.push(...rr.warnings);
                const jr = await runAcShapedJudgeRubric(session.page, rub, rr.model, { id: ac.id, text: ac.text }, {
                  suiteLlmBudget: options.suiteLlmBudget,
                });
                if (jr.judgeModelInvocations && jr.judgeModelInvocations > 0) {
                  keysModelMetaFragments.push(
                    toKeysModelMeta(rr.model, jr.judgeModelInvocations, {
                      prompt: jr.judgePromptTokens,
                      completion: jr.judgeCompletionTokens,
                    }),
                  );
                }
                stepVerdict = worstVerdict(stepVerdict, jr.verdict);
                if (jr.verdict !== "passed") notes.push(`judge: ${jr.summary}`);
              }
            }
          }

          for (const pc of (cfg.postChecks ?? []).filter((p) => p.acId === ac.id)) {
            const pr = await runAcPostCheck(session.page, pc, {
              baseUrl: options.baseUrl,
              hookCwd: options.hookCwd,
              extraEnv: baseExtra,
            });
            if (!pr.ok) {
              stepVerdict = worstVerdict(stepVerdict, "failed");
              notes.push(`post_check: ${pr.summary}`);
              break;
            }
          }

          if (stepVerdict !== "passed" && options.captureScreenshotOnFailure && options.artifactDir) {
            const shot = await captureStepScreenshot(session, options.artifactDir, goal.id, ac.id, attemptIndex);
            if (shot) stepEvidence.push(shot);
          }

          const reasonCode =
            stepVerdict === "passed"
              ? "AC_STEP_OK"
              : !agentOut.ok
                ? agentOut.reasonCode
                : "AC_STEP_FAILED";

          steps.push({
            criterionId: ac.id,
            verdict: stepVerdict,
            reasonCode,
            summary: notes.length > 0 ? notes.join(" | ") : "OK",
            agentRoundsUsed: agentRounds,
            evidenceRefs: stepEvidence,
          });

          pushTrace({
            kind: "assertion",
            summary: `AC ${ac.id}: ${stepVerdict}`,
            metadata: { acId: ac.id, verdict: stepVerdict, attemptIndex },
          });
        }

        const drained = session.drainTraceEntries();
        const mapped = browserTracesToCoreEvents(drained, {
          runId,
          goalId: goal.id,
          startingStepIndex: stepCursor,
        });
        stepCursor += mapped.length;
        allTraces.push(...mapped);

        if (chatInvocations > 0) {
          keysModelMetaFragments.push(
            toKeysModelMeta(agentModel, chatInvocations, {
              prompt: agentPromptSum > 0 ? agentPromptSum : undefined,
              completion: agentCompletionSum > 0 ? agentCompletionSum : undefined,
            }),
          );
        }

        lastSteps = steps;
        const overall = aggregateStepVerdicts(steps);
        const failedCount = steps.filter((s) => s.verdict !== "passed").length;
        const summary =
          failedCount === 0
            ? "All acceptance criteria satisfied"
            : `${failedCount} acceptance criterion/criteria not satisfied`;

        if (overall === "passed") {
          return {
            kind: "stop",
            verdict: "passed",
            reasonCode: "AC_SEQUENCE_OK",
            summary,
          } satisfies AttemptOutcome;
        }
        if (overall === "indeterminate") {
          return {
            kind: "stop",
            verdict: "indeterminate",
            reasonCode: "AC_SEQUENCE_INDETERMINATE",
            summary,
          } satisfies AttemptOutcome;
        }

        return {
          kind: "retry",
          verdict: "failed",
          reasonCode: "AC_SEQUENCE_FAILED",
          summary,
          retryable: true,
        } satisfies AttemptOutcome;
      } catch (e) {
        const drained = session.drainTraceEntries();
        const mapped = browserTracesToCoreEvents(drained, {
          runId,
          goalId: goal.id,
          startingStepIndex: stepCursor,
        });
        stepCursor += mapped.length;
        allTraces.push(...mapped);

        if (e instanceof TimeoutError) {
          pushTrace({ kind: "error", summary: e.message, metadata: { attemptIndex, code: e.code } });
          lastSteps = steps;
          return {
            kind: "retry",
            verdict: "failed",
            reasonCode: "TIMEOUT",
            summary: e.message,
            retryable: true,
          } satisfies AttemptOutcome;
        }

        const msg = e instanceof Error ? e.message : String(e);
        pushTrace({ kind: "error", summary: msg, metadata: { attemptIndex } });
        lastSteps = steps;
        return {
          kind: "retry",
          verdict: "failed",
          reasonCode: "BROWSER_ERROR",
          summary: msg,
          retryable: true,
        } satisfies AttemptOutcome;
      } finally {
        await session.dispose().catch(() => undefined);
      }
    },
  });

  const allEvidence = lastSteps.flatMap((s) => s.evidenceRefs);
  const goalRecord: GoalRunRecord = {
    goalId: goal.id,
    verdict: attemptResult.verdict,
    reasonCode: attemptResult.reasonCode,
    summary: attemptResult.summary,
    retriesUsed: attemptResult.retriesUsed,
    evidenceRefs: [...new Set(allEvidence)],
    acSequenceSteps: lastSteps.length > 0 ? lastSteps : undefined,
    ...acIdsFragment(goal),
  };

  return {
    goalRecord,
    traces: allTraces,
    nextStepIndex: stepCursor,
    warnings,
    keysModelMetaFragments,
  };
}

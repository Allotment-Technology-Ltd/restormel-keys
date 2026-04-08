import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { browserTracesToCoreEvents, createPlaywrightTestingSession } from "@restormel/testing-browser-playwright";
import type {
  PlaywrightTestingSessionOptions,
  TestingBrowserSession,
} from "@restormel/testing-browser-playwright";
import type { GoalRunRecord, KeysModelMeta, TestGoal, TraceEvent } from "@restormel/testing-core";
import { sanitizePathSegment } from "@restormel/testing-core";
import type { RetryPolicy } from "@restormel/testing-core";
import { resolveModel, type KeysModelAdapterOptions, type ResolvedModel } from "@restormel/testing-keys-adapter";
import { evaluateBrowserSuccessCriteria } from "./evaluate-criteria.js";
import { judgeLogicalRefForCriteria } from "./judge-ref.js";
import { runGoalAttempts, type AttemptOutcome } from "./retries.js";
import { TimeoutError, withTimeout } from "./timeout.js";

export interface RunBrowserGoalOptions {
  runId: string;
  goal: TestGoal;
  baseUrl: string;
  timeoutMs: number;
  retryPolicy: RetryPolicy;
  artifactDir?: string;
  captureScreenshotOnFailure: boolean;
  headless?: boolean;
  /** Playwright storage state JSON path (from environment auth_ref). */
  storageStatePath?: string;
  createBrowserSession?: (opts?: PlaywrightTestingSessionOptions) => Promise<TestingBrowserSession>;
  resolvedKeys: Record<string, string>;
  keysAdapterOptions?: KeysModelAdapterOptions;
  startingStepIndex: number;
}

export interface RunBrowserGoalResult {
  goalRecord: GoalRunRecord;
  traces: TraceEvent[];
  nextStepIndex: number;
  warnings: string[];
  keysModelMetaFragments: KeysModelMeta[];
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Initial navigation URL: `base_url` with optional per-goal `start_path`. */
export function goalEntryUrl(baseUrl: string, startPath?: string): string {
  if (startPath === undefined || startPath.trim() === "") {
    return baseUrl;
  }
  try {
    return new URL(startPath.trim(), baseUrl).href;
  } catch {
    return baseUrl;
  }
}

function toKeysModelMeta(model: ResolvedModel, invocations: number): KeysModelMeta {
  return {
    logicalRef: model.meta.logicalRef,
    provider: model.meta.provider,
    model: model.meta.model,
    resolutionSource: model.meta.resolutionSource,
    invocationCount: invocations,
  };
}

async function captureScreenshot(
  session: TestingBrowserSession,
  artifactDir: string,
  goalId: string,
  attemptIndex: number,
): Promise<string | undefined> {
  const safeGoal = sanitizePathSegment(goalId);
  const dir = join(artifactDir, "goals", safeGoal);
  await mkdir(dir, { recursive: true });
  const name = `attempt-${attemptIndex}.png`;
  const abs = join(dir, name);
  try {
    await session.screenshot(abs);
    return join("goals", safeGoal, name);
  } catch {
    return undefined;
  }
}

export async function runBrowserGoal(options: RunBrowserGoalOptions): Promise<RunBrowserGoalResult> {
  const { goal, runId } = options;
  const warnings: string[] = [];
  const keysModelMetaFragments: KeysModelMeta[] = [];
  const allTraces: TraceEvent[] = [];
  const evidenceRefs: string[] = [];
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

  let judgeModel: ResolvedModel | undefined;
  if (goal.successCriteria.judgeRubric) {
    const ref = judgeLogicalRefForCriteria(goal.successCriteria, options.resolvedKeys);
    if (!ref) {
      warnings.push(`Goal "${goal.id}": judge_rubric has no model_ref and no llm_primary / judge key in environment`);
    } else {
      const res = await resolveModel(ref, options.keysAdapterOptions ?? {});
      if (res.ok) {
        warnings.push(...res.warnings);
        judgeModel = res.model;
      } else {
        warnings.push(`Goal "${goal.id}": model resolution failed (${res.error.code}): ${res.error.message}`);
      }
    }
  }

  const sessionFactory = options.createBrowserSession ?? createPlaywrightTestingSession;

  const attemptResult = await runGoalAttempts({
    maxRetries: options.retryPolicy.maxRetries,
    backoffMs: options.retryPolicy.backoffMs,
    runAttempt: async (attemptIndex) => {
      pushTrace({
        kind: "observation",
        summary: `Attempt ${attemptIndex + 1} start`,
        metadata: { phase: "attempt_start", attemptIndex },
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
        pushTrace({
          kind: "error",
          summary: `Browser session failed: ${msg}`,
          metadata: { attemptIndex },
        });
        return {
          kind: "stop",
          verdict: "failed",
          reasonCode: "ADAPTER_ERROR",
          summary: `Browser adapter could not start a session: ${msg}`,
          retryable: false,
        } satisfies AttemptOutcome;
      }

      try {
        const entryUrl = goalEntryUrl(options.baseUrl, goal.startPath);
        await withTimeout(
          session.navigate(entryUrl, { timeoutMs: options.timeoutMs, waitUntil: "load" }),
          options.timeoutMs + 2000,
          "navigation",
        );

        pushTrace({
          kind: "observation",
          summary: `Navigated to ${entryUrl}`,
          metadata: { phase: "post_navigate", attemptIndex, baseUrl: options.baseUrl, startPath: goal.startPath },
        });

        const evalResult = await withTimeout(
          evaluateBrowserSuccessCriteria(session.page, goal.successCriteria, {
            judgeModel,
          }),
          options.timeoutMs + 2000,
          "evaluation",
        );

        const drained = session.drainTraceEntries();
        const mapped = browserTracesToCoreEvents(drained, {
          runId,
          goalId: goal.id,
          startingStepIndex: stepCursor,
        });
        stepCursor += mapped.length;
        allTraces.push(...mapped);

        if (judgeModel && (evalResult.judgeModelInvocations ?? 0) > 0) {
          keysModelMetaFragments.push(toKeysModelMeta(judgeModel, evalResult.judgeModelInvocations ?? 1));
        }

        pushTrace({
          kind: "assertion",
          summary: evalResult.summary,
          metadata: {
            verdict: evalResult.verdict,
            reasonCode: evalResult.reasonCode,
            attemptIndex,
          },
        });

        if (evalResult.verdict === "passed") {
          return {
            kind: "stop",
            verdict: "passed",
            reasonCode: evalResult.reasonCode,
            summary: evalResult.summary,
          } satisfies AttemptOutcome;
        }

        if (evalResult.verdict === "indeterminate") {
          if (
            options.captureScreenshotOnFailure &&
            options.artifactDir &&
            (evalResult.reasonCode === "JUDGE_UNCERTAIN" ||
              evalResult.reasonCode === "JUDGE_HTTP_ERROR" ||
              evalResult.reasonCode === "JUDGE_PARSE_ERROR")
          ) {
            const rel = await captureScreenshot(session, options.artifactDir, goal.id, attemptIndex);
            if (rel) evidenceRefs.push(rel);
          }
          return {
            kind: "stop",
            verdict: "indeterminate",
            reasonCode: evalResult.reasonCode,
            summary: evalResult.summary,
          } satisfies AttemptOutcome;
        }

        if (options.captureScreenshotOnFailure && options.artifactDir) {
          const rel = await captureScreenshot(session, options.artifactDir, goal.id, attemptIndex);
          if (rel) evidenceRefs.push(rel);
        }

        return {
          kind: "retry",
          verdict: "failed",
          reasonCode: evalResult.reasonCode,
          summary: evalResult.summary,
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
          pushTrace({
            kind: "error",
            summary: e.message,
            metadata: { attemptIndex, code: e.code },
          });
          if (options.captureScreenshotOnFailure && options.artifactDir) {
            const rel = await captureScreenshot(session, options.artifactDir, goal.id, attemptIndex);
            if (rel) evidenceRefs.push(rel);
          }
          return {
            kind: "retry",
            verdict: "failed",
            reasonCode: "TIMEOUT",
            summary: e.message,
            retryable: true,
          } satisfies AttemptOutcome;
        }

        const msg = e instanceof Error ? e.message : String(e);
        pushTrace({
          kind: "error",
          summary: msg,
          metadata: { attemptIndex },
        });
        if (options.captureScreenshotOnFailure && options.artifactDir) {
          const rel = await captureScreenshot(session, options.artifactDir, goal.id, attemptIndex);
          if (rel) evidenceRefs.push(rel);
        }
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

  const goalRecord: GoalRunRecord = {
    goalId: goal.id,
    verdict: attemptResult.verdict,
    reasonCode: attemptResult.reasonCode,
    summary: attemptResult.summary,
    retriesUsed: attemptResult.retriesUsed,
    evidenceRefs: [...evidenceRefs],
  };

  return {
    goalRecord,
    traces: allTraces,
    nextStepIndex: stepCursor,
    warnings,
    keysModelMetaFragments,
  };
}

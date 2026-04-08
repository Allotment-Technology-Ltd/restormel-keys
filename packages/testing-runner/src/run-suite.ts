import { randomUUID } from "node:crypto";
import {
  formatConfigErrors,
  isSafeHttpUrl,
  loadConfigFromFile,
  resolvedKeysForEnvironment,
  resolveEnvironmentProfile,
  resolveSuite,
} from "@restormel/testing-config";
import { resolve } from "node:path";
import type { CostEstimate, KeysModelMeta, RunRecord, TraceEvent, Verdict } from "@restormel/testing-core";
import { runBrowserGoal } from "./browser-goal.js";
import { resolveStorageStatePath } from "./storage-state.js";
import type { RunLocalSuiteOptions, RunSuiteExecutionOptions, RunSuiteResult } from "./types.js";

function aggregateVerdict(goalVerdicts: Verdict[]): Verdict {
  if (goalVerdicts.some((v) => v === "failed")) return "failed";
  if (goalVerdicts.some((v) => v === "indeterminate")) return "indeterminate";
  return "passed";
}

function mergeKeysMeta(fragments: KeysModelMeta[]): KeysModelMeta[] {
  const byRef = new Map<string, KeysModelMeta>();
  for (const f of fragments) {
    const prev = byRef.get(f.logicalRef);
    if (!prev) {
      byRef.set(f.logicalRef, { ...f });
    } else {
      prev.invocationCount = (prev.invocationCount ?? 0) + (f.invocationCount ?? 0);
    }
  }
  return [...byRef.values()];
}

/**
 * Execute one suite from an already-loaded config (local CLI / programmatic use).
 */
export async function runSuiteFromConfig(options: RunSuiteExecutionOptions): Promise<RunSuiteResult> {
  const traces: TraceEvent[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const startedAt = new Date().toISOString();

  const suiteRes = resolveSuite(options.config, options.suiteId);
  if (!suiteRes.ok) {
    return { ok: false, errors: [formatConfigErrors(suiteRes.errors)], traces, warnings };
  }
  const suite = suiteRes.suite;

  const envId = options.environmentId ?? suite.environment;
  const envRes = resolveEnvironmentProfile(options.config, envId);
  if (!envRes.ok) {
    return { ok: false, errors: [formatConfigErrors(envRes.errors)], traces, warnings };
  }
  let profile = envRes.profile;

  const override = options.targetUrlOverride?.trim();
  if (override !== undefined && override.length > 0) {
    const urlCheck = isSafeHttpUrl(override);
    if (!urlCheck.ok) {
      return {
        ok: false,
        errors: [`Invalid target_url override: ${urlCheck.reason}`],
        traces,
        warnings,
      };
    }
    profile = { ...profile, baseUrl: override };
  }

  let goals = suite.goals;
  if (options.goalIds !== undefined && options.goalIds.length > 0) {
    const suiteGoalIds = new Set(suite.goals.map((g) => g.id));
    const missing = options.goalIds.filter((id) => !suiteGoalIds.has(id));
    if (missing.length > 0) {
      errors.push(`Unknown goal id(s) for suite "${suite.id}": ${missing.join(", ")}`);
      return { ok: false, errors, traces, warnings };
    }
    const pick = new Set(options.goalIds);
    goals = suite.goals.filter((g) => pick.has(g.id));
  }

  const resolvedKeys = resolvedKeysForEnvironment(options.config, envId);
  const storageStatePath =
    options.configFilePath !== undefined
      ? resolveStorageStatePath(profile, options.configFilePath)
      : undefined;

  const retryPolicy = suite.retryPolicy ?? { maxRetries: 0 };
  const timeoutMs = suite.defaultTimeoutMs ?? options.config.defaults?.defaultTimeoutMs ?? 30_000;
  const artifactPolicy = suite.artifactPolicy ?? options.config.defaults?.artifactPolicy;
  const shots = artifactPolicy?.screenshots ?? "on_failure";
  const captureScreenshotOnFailure = shots === "on_failure" || shots === "always";

  const runId = randomUUID();
  const trigger = options.trigger ?? "local";
  const goalRuns: RunRecord["goalRuns"] = [];
  let stepIndex = 0;
  const allKeysFragments: KeysModelMeta[] = [];

  for (const goal of goals) {
    if (goal.type !== "browser") {
      goalRuns.push({
        goalId: goal.id,
        verdict: "indeterminate",
        reasonCode: "GOAL_TYPE_UNSUPPORTED",
        summary: `Goal type "${goal.type}" is not supported by the local runner (browser only in this slice)`,
        retriesUsed: 0,
        evidenceRefs: [],
      });
      continue;
    }

    const bg = await runBrowserGoal({
      runId,
      goal,
      baseUrl: profile.baseUrl,
      timeoutMs,
      retryPolicy,
      artifactDir: options.artifactDir,
      captureScreenshotOnFailure,
      headless: options.headless,
      storageStatePath,
      createBrowserSession: options.createBrowserSession,
      resolvedKeys,
      keysAdapterOptions: options.keysAdapterOptions,
      startingStepIndex: stepIndex,
    });
    stepIndex = bg.nextStepIndex;
    traces.push(...bg.traces);
    warnings.push(...bg.warnings);
    goalRuns.push(bg.goalRecord);
    allKeysFragments.push(...bg.keysModelMetaFragments);
  }

  const verdict = aggregateVerdict(goalRuns.map((g) => g.verdict));
  const mergedMeta = mergeKeysMeta(allKeysFragments);
  const judgeInvocations = mergedMeta.reduce((n, m) => n + (m.invocationCount ?? 0), 0);
  let costEstimate: CostEstimate | undefined;
  if (judgeInvocations > 0) {
    costEstimate = {
      tokenEstimate: { input: 0, output: judgeInvocations * 120 },
    };
  }

  const run: RunRecord = {
    id: runId,
    suiteId: suite.id,
    environmentId: envId,
    trigger,
    commitSha: options.commitSha,
    repository: options.repository,
    startedAt,
    endedAt: new Date().toISOString(),
    verdict,
    goalRuns,
    keysModelMeta: mergedMeta.length > 0 ? mergedMeta : undefined,
    judgeInvocationCount: judgeInvocations,
    costEstimate,
  };

  const suiteMeta = {
    id: suite.id,
    description: suite.description,
    tags: suite.tags,
    environmentId: envId,
    goalCount: goals.length,
  };

  return { ok: true, run, traces, warnings, errors, suiteMeta };
}

/**
 * Load config from disk, then run one suite.
 */
export async function runLocalSuite(options: RunLocalSuiteOptions): Promise<RunSuiteResult> {
  const loaded = await loadConfigFromFile(options.configPath);
  if (!loaded.ok) {
    return {
      ok: false,
      errors: [formatConfigErrors(loaded.errors)],
      traces: [],
      warnings: [],
    };
  }
  const configFilePath = resolve(process.cwd(), options.configPath);
  return runSuiteFromConfig({
    config: loaded.config,
    suiteId: options.suiteId,
    environmentId: options.environmentId,
    targetUrlOverride: options.targetUrlOverride,
    goalIds: options.goalIds,
    trigger: options.trigger,
    commitSha: options.commitSha,
    repository: options.repository,
    artifactDir: options.artifactDir,
    keysAdapterOptions: options.keysAdapterOptions,
    headless: options.headless,
    createBrowserSession: options.createBrowserSession,
    configFilePath,
  });
}

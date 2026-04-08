import { randomUUID } from "node:crypto";
import {
  formatConfigErrors,
  isSafeHttpUrl,
  loadConfigFromFile,
  resolvedKeysForEnvironment,
  resolveEnvironmentProfile,
  resolveSuite,
} from "@restormel/testing-config";
import { dirname, resolve } from "node:path";
import {
  aggregateAcceptanceCriterionResults,
  type CostEstimate,
  type GoalRunRecord,
  type KeysModelMeta,
  type RunRecord,
  type TestGoal,
  type TraceEvent,
  type Verdict,
} from "@restormel/testing-core";
import { goalEntryUrl, runBrowserGoal } from "./browser-goal.js";
import { runAcSequenceBrowserGoal } from "./run-ac-sequence-goal.js";
import { toPostMissionObserveGoal } from "./post-mission-goal.js";
import { resolveStorageStatePath } from "./storage-state.js";
import { runMissionExecutorCommand, runShellHookCommands } from "./shell-hooks.js";
import type { RunLocalSuiteOptions, RunSuiteExecutionOptions, RunSuiteResult } from "./types.js";

function hookWorkingDirectory(configFilePath: string | undefined): string {
  return configFilePath !== undefined ? dirname(configFilePath) : process.cwd();
}

function suiteAdapterCommandsBefore(hooks: Record<string, string>): string[] {
  return Object.entries(hooks)
    .filter(([k]) => k !== "teardown")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

function suiteAdapterCommandsTeardown(hooks: Record<string, string>): string[] {
  const t = hooks["teardown"];
  return t !== undefined && t.trim() !== "" ? [t] : [];
}

function aggregateVerdict(goalVerdicts: Verdict[]): Verdict {
  if (goalVerdicts.some((v) => v === "failed")) return "failed";
  if (goalVerdicts.some((v) => v === "indeterminate")) return "indeterminate";
  return "passed";
}

function acIdsOnRecord(goal: TestGoal): Pick<GoalRunRecord, "acceptanceCriterionIds"> {
  if (goal.acceptanceCriterionIds === undefined || goal.acceptanceCriterionIds.length === 0) return {};
  return { acceptanceCriterionIds: [...goal.acceptanceCriterionIds] };
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
    goals = goals.filter((g) => pick.has(g.id));
  }

  if (options.acceptanceCriterionIds !== undefined && options.acceptanceCriterionIds.length > 0) {
    const want = new Set(options.acceptanceCriterionIds.map((s) => s.trim()).filter((s) => s.length > 0));
    if (want.size === 0) {
      errors.push(`acceptance_criterion_ids filter is empty after trimming`);
      return { ok: false, errors, traces, warnings };
    }
    const next = goals.filter(
      (g) =>
        g.acceptanceCriterionIds !== undefined &&
        g.acceptanceCriterionIds.some((id) => want.has(id)),
    );
    if (next.length === 0) {
      errors.push(
        `No goals reference acceptance criterion id(s): ${[...want].join(", ")} (set acceptance_criterion_ids on goals)`,
      );
      return { ok: false, errors, traces, warnings };
    }
    goals = next;
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
  const hookCwd = hookWorkingDirectory(options.configFilePath);

  const beforeSuiteHooks = suiteAdapterCommandsBefore(options.config.adapterHooks);
  if (beforeSuiteHooks.length > 0) {
    const hookRes = await runShellHookCommands(beforeSuiteHooks, {
      cwd: hookCwd,
      label: "adapter_hooks (before suite)",
    });
    if (!hookRes.ok) {
      return {
        ok: false,
        errors: [
          `${hookRes.message}. Set RESTORMEL_TESTING_SKIP_SHELL_HOOKS=1 to skip hook execution (e.g. untrusted CI).`,
        ],
        traces,
        warnings,
      };
    }
  }

  try {
    for (const goal of goals) {
      if (goal.type === "native") {
        goalRuns.push({
          goalId: goal.id,
          verdict: "indeterminate",
          reasonCode: "GOAL_TYPE_UNSUPPORTED",
          summary: `Goal type "native" is not supported by this runner yet`,
          retriesUsed: 0,
          evidenceRefs: [],
          ...acIdsOnRecord(goal),
        });
        continue;
      }

      if (goal.preconditions !== undefined && goal.preconditions.length > 0) {
        const preRes = await runShellHookCommands(goal.preconditions, {
          cwd: hookCwd,
          label: `preconditions (${goal.id})`,
        });
        if (!preRes.ok) {
          goalRuns.push({
            goalId: goal.id,
            verdict: "failed",
            reasonCode: "PRECONDITION_FAILED",
            summary: preRes.message,
            retriesUsed: 0,
            evidenceRefs: [],
            ...acIdsOnRecord(goal),
          });
          continue;
        }
      }

      if (goal.type !== "browser" && goal.type !== "performance") {
        goalRuns.push({
          goalId: goal.id,
          verdict: "indeterminate",
          reasonCode: "GOAL_TYPE_UNSUPPORTED",
          summary: `Goal type "${goal.type}" is not supported`,
          retriesUsed: 0,
          evidenceRefs: [],
          ...acIdsOnRecord(goal),
        });
        continue;
      }

      try {
        const isAgentBrowser = goal.type === "browser" && goal.executionMode === "agent";
        const isAcSequenceBrowser = goal.type === "browser" && goal.executionMode === "ac_sequence";

        if (isAgentBrowser) {
          const execCmd = goal.missionExecutor?.trim() ?? "";
          const missionText = goal.mission?.trim() ?? "";
          if (execCmd.length === 0 || missionText.length === 0) {
            goalRuns.push({
              goalId: goal.id,
              verdict: "failed",
              reasonCode: "CONFIG_INTERNAL",
              summary: `Goal "${goal.id}": agent mode requires non-empty mission and mission_executor`,
              retriesUsed: 0,
              evidenceRefs: [],
              ...acIdsOnRecord(goal),
            });
          } else {
            const extraEnv: Record<string, string | undefined> = {
              RESTORMEL_TESTING_MISSION: missionText,
              RESTORMEL_TESTING_BASE_URL: profile.baseUrl,
              RESTORMEL_TESTING_GOAL_ID: goal.id,
              RESTORMEL_TESTING_RUN_ID: runId,
            };
            if (goal.startPath !== undefined && goal.startPath.trim() !== "") {
              extraEnv.RESTORMEL_TESTING_START_URL = goalEntryUrl(profile.baseUrl, goal.startPath);
            }
            if (options.artifactDir !== undefined && options.artifactDir.trim() !== "") {
              extraEnv.RESTORMEL_TESTING_ARTIFACT_DIR = options.artifactDir;
            }
            if (storageStatePath !== undefined && storageStatePath.length > 0) {
              extraEnv.RESTORMEL_TESTING_STORAGE_STATE_PATH = storageStatePath;
            }
            if (goal.missionConstraints !== undefined) {
              extraEnv.RESTORMEL_TESTING_MISSION_CONSTRAINTS = JSON.stringify(goal.missionConstraints);
            }
            if (suite.userStory !== undefined || (suite.acceptanceCriteria !== undefined && suite.acceptanceCriteria.length > 0)) {
              extraEnv.RESTORMEL_TESTING_USER_STORY = suite.userStory ?? "";
              extraEnv.RESTORMEL_TESTING_ACCEPTANCE_CRITERIA_JSON = JSON.stringify({
                userStory: suite.userStory,
                acceptanceCriteria: suite.acceptanceCriteria ?? [],
              });
            }
            const missRes = await runMissionExecutorCommand(execCmd, {
              cwd: hookCwd,
              label: `mission_executor (${goal.id})`,
              extraEnv,
              maxDurationMsHint: goal.missionConstraints?.maxDurationMs,
            });
            if (!missRes.ok) {
              goalRuns.push({
                goalId: goal.id,
                verdict: "failed",
                reasonCode: "MISSION_EXECUTOR_FAILED",
                summary: missRes.message,
                retriesUsed: 0,
                evidenceRefs: [],
                ...acIdsOnRecord(goal),
              });
            } else {
              const observeGoal = toPostMissionObserveGoal(goal);
              const bg = await runBrowserGoal({
                runId,
                goal: observeGoal,
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
              goalRuns.push({ ...bg.goalRecord, ...acIdsOnRecord(goal) });
              allKeysFragments.push(...bg.keysModelMetaFragments);
            }
          }
        } else if (isAcSequenceBrowser) {
          const suiteAcs = suite.acceptanceCriteria ?? [];
          if (suiteAcs.length === 0) {
            goalRuns.push({
              goalId: goal.id,
              verdict: "failed",
              reasonCode: "CONFIG_INTERNAL",
              summary: `Goal "${goal.id}": ac_sequence requires suite acceptance_criteria`,
              retriesUsed: 0,
              evidenceRefs: [],
              ...acIdsOnRecord(goal),
            });
          } else {
            const acFilter =
              options.acceptanceCriterionIds !== undefined && options.acceptanceCriterionIds.length > 0
                ? new Set(options.acceptanceCriterionIds.map((s) => s.trim()).filter((s) => s.length > 0))
                : undefined;
            const goalAcSet =
              goal.acceptanceCriterionIds !== undefined && goal.acceptanceCriterionIds.length > 0
                ? new Set(goal.acceptanceCriterionIds)
                : undefined;
            const criteriaRun = suiteAcs.filter((c) => {
              if (goalAcSet !== undefined && !goalAcSet.has(c.id)) return false;
              if (acFilter !== undefined && !acFilter.has(c.id)) return false;
              return true;
            });
            if (criteriaRun.length === 0) {
              goalRuns.push({
                goalId: goal.id,
                verdict: "indeterminate",
                reasonCode: "AC_SEQUENCE_NO_CRITERIA",
                summary: "No acceptance criteria to run after goal and --ac filters",
                retriesUsed: 0,
                evidenceRefs: [],
                ...acIdsOnRecord(goal),
              });
            } else {
              const bg = await runAcSequenceBrowserGoal({
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
                suiteUserStory: suite.userStory,
                acceptanceCriteria: criteriaRun,
                hookCwd,
              });
              stepIndex = bg.nextStepIndex;
              traces.push(...bg.traces);
              warnings.push(...bg.warnings);
              goalRuns.push({ ...bg.goalRecord, ...acIdsOnRecord(goal) });
              allKeysFragments.push(...bg.keysModelMetaFragments);
            }
          }
        } else {
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
          goalRuns.push({ ...bg.goalRecord, ...acIdsOnRecord(goal) });
          allKeysFragments.push(...bg.keysModelMetaFragments);
        }
      } finally {
        if (goal.cleanup !== undefined && goal.cleanup.length > 0) {
          const cleanRes = await runShellHookCommands(goal.cleanup, {
            cwd: hookCwd,
            label: `cleanup (${goal.id})`,
          });
          if (!cleanRes.ok) {
            warnings.push(`cleanup (${goal.id}): ${cleanRes.message}`);
          }
        }
      }
    }
  } finally {
    const td = suiteAdapterCommandsTeardown(options.config.adapterHooks);
    if (td.length > 0) {
      const tearRes = await runShellHookCommands(td, {
        cwd: hookCwd,
        label: "adapter_hooks (teardown)",
      });
      if (!tearRes.ok) {
        warnings.push(`adapter_hooks teardown: ${tearRes.message}`);
      }
    }
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

  const acFilter =
    options.acceptanceCriterionIds !== undefined && options.acceptanceCriterionIds.length > 0
      ? new Set(options.acceptanceCriterionIds.map((s) => s.trim()).filter((s) => s.length > 0))
      : undefined;
  const acceptanceResults = aggregateAcceptanceCriterionResults(suite.acceptanceCriteria, goalRuns, {
    criterionFilter: acFilter,
  });

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
    ...(acceptanceResults !== undefined ? { acceptanceResults } : {}),
  };

  const suiteMeta = {
    id: suite.id,
    description: suite.description,
    userStory: suite.userStory,
    acceptanceCriteria: suite.acceptanceCriteria,
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
    acceptanceCriterionIds: options.acceptanceCriterionIds,
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

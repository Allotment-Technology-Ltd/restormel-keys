/**
 * Phase 2–4 hosted runtime: graph-linear pipeline with optional **consecutive** parallel batches
 * (same `parallelGroupId`). Chains assistant output between batches as a new user message.
 */
import type { RouteStepRecord } from "$lib/server/db";
import {
  loadRouteExecutionContext,
  selectExecutableMemberForStep,
  type RouteExecutionContext,
  type ResolvedRouteResult,
} from "$lib/server/route-resolver";
import { normalizeProviderToCanonicalApi } from "$lib/server/canonical-provider";
import {
  openAiCompatibleChatBaseUrl,
  postOpenAiCompatibleChat,
  type ChatMessage,
} from "$lib/server/runtime-openai-chat";
import { findDecryptedApiKeyForResolvedProvider } from "$lib/server/runtime-invoke";
import { defaultProviders, estimateCost, type ProviderDefinition } from "@restormel/keys";
import { canonicalApiToPolicyProvider } from "$lib/server/canonical-provider";
import {
  classifyUpstreamFailure,
  shouldAdvanceAfterUpstreamFailure,
} from "$lib/server/runtime-switch-eval";
import { partitionIntoBatches } from "$lib/server/runtime-invoke-batches";

function estimateCostUsdForStep(args: {
  modelId: string;
  providerType: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
}): number | null {
  const pt =
    canonicalApiToPolicyProvider(args.providerType ?? undefined) ?? args.providerType ?? null;
  const providers: ProviderDefinition[] = pt
    ? defaultProviders.filter((p) => p.id === pt)
    : defaultProviders;
  const est = estimateCost(args.modelId, providers);
  if (!est || est.inputPerMillion == null || est.outputPerMillion == null) return null;
  const pin = args.promptTokens ?? 0;
  const cout = args.completionTokens ?? 0;
  if (pin <= 0 && cout <= 0) return null;
  return (pin / 1e6) * est.inputPerMillion + (cout / 1e6) * est.outputPerMillion;
}

/** Max steps executed per HTTP request (abuse guard). */
export const RUNTIME_MAX_STEPS = 10;
/** Max wall time for the whole pipeline (ms). */
export const RUNTIME_MAX_WALL_MS = 300_000;

export type ParallelMergeStrategy = "first_wins" | "all_succeed";

export type RuntimeStepSummary = {
  routeStepId: string;
  orderIndex: number;
  providerType: string | null;
  modelId: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  skipped?: boolean;
  skipReason?: string;
};

export type RuntimePipelineOk = {
  ok: true;
  finalContent: string;
  aggregatedUsage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
  /** Sum of per-step estimated USD (null if unknown). */
  estimatedCostUsdTotal: number | null;
  runtimeSteps: RuntimeStepSummary[];
  /** Resolve-shaped snapshot for the last successful step (for contract fields). */
  resolvedForContract: ResolvedRouteResult;
};

export type RuntimePipelineFail = {
  ok: false;
  httpStatus: number;
  error: string;
  message?: string;
  routeId?: string;
  providerType?: string;
  code?: string;
};

function buildResolvedForLastStep(
  ctx: RouteExecutionContext,
  lastStep: RouteStepRecord,
  providerType: string,
  modelId: string,
  selectedPoolMemberIndex: number | null,
  explanation: string
): ResolvedRouteResult {
  return {
    workspaceId: ctx.workspaceId,
    projectId: ctx.projectId,
    environmentId: ctx.environmentId,
    route: ctx.route,
    steps: ctx.allSteps,
    selectedStep: lastStep,
    selectedStepId: lastStep.id,
    selectedOrderIndex: lastStep.orderIndex,
    switchReasonCode: "runtime_pipeline",
    providerType,
    modelId,
    selectedPoolMemberIndex,
    explanation,
    matchedCriteria: lastStep.switchCriteria ?? null,
    fallbackCandidates: [],
    stepChain: [],
  };
}

export async function runRuntimeInvokePipeline(args: {
  projectId: string;
  environmentId: string;
  userId: string;
  routeId: string;
  initialMessages: ChatMessage[];
  startedAt: number;
  /** Abort upstream HTTP (e.g. job cancellation). */
  abortSignal?: AbortSignal;
  /** Optional poll between batches (hosted jobs). */
  cancelCheck?: () => boolean | Promise<boolean>;
  /** Parallel batch merge when consecutive steps share `parallelGroupId`. */
  mergeStrategy?: ParallelMergeStrategy;
}): Promise<RuntimePipelineOk | RuntimePipelineFail> {
  const loaded = await loadRouteExecutionContext(
    args.projectId,
    args.environmentId,
    args.userId,
    args.routeId
  );
  if (!loaded.ok) {
    const { failure } = loaded;
    const status =
      failure.code === "route_unpublished"
        ? 409
        : failure.code === "route_disabled"
          ? 403
          : 404;
    return {
      ok: false,
      httpStatus: status,
      error: failure.code,
      message: failure.message ?? failure.code,
      ...(failure.routeId ? { routeId: failure.routeId } : {}),
    };
  }

  const { ctx } = loaded;
  const { route, orderedEnabledSteps, workspaceId, lifecycleByModel } = ctx;

  if (orderedEnabledSteps.length === 0) {
    return {
      ok: false,
      httpStatus: 422,
      error: "no_key_available",
      message: "No enabled route step available",
      routeId: route.id,
    };
  }

  if (orderedEnabledSteps.length > RUNTIME_MAX_STEPS) {
    return {
      ok: false,
      httpStatus: 422,
      error: "runtime_step_limit_exceeded",
      message: `Route has more than ${RUNTIME_MAX_STEPS} enabled steps; reduce steps or split routes.`,
      routeId: route.id,
    };
  }
  const toRun = orderedEnabledSteps;
  const batches = partitionIntoBatches(toRun);
  const mergeStrategy: ParallelMergeStrategy = args.mergeStrategy ?? "first_wins";

  let workingMessages: ChatMessage[] = args.initialMessages.map((m) => ({ ...m }));
  const runtimeSteps: RuntimeStepSummary[] = [];
  let sumPrompt = 0;
  let sumCompletion = 0;
  let sumTotal = 0;
  let sumCostUsd = 0;
  let sawCost = false;
  let lastContent = "";
  let lastPick: {
    step: RouteStepRecord;
    providerType: string;
    modelId: string;
    memberIndex: number | null;
  } | null = null;

  const seedBase = `${args.projectId}:${route.id}:${args.environmentId}:pipeline`;

  let globalIdx = 0;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    if (args.cancelCheck && (await args.cancelCheck())) {
      return {
        ok: false,
        httpStatus: 422,
        error: "job_cancelled",
        message: "Hosted runtime job was cancelled.",
        routeId: route.id,
      };
    }

    if (Date.now() - args.startedAt > RUNTIME_MAX_WALL_MS) {
      return {
        ok: false,
        httpStatus: 504,
        error: "runtime_wall_timeout",
        message: "Hosted runtime pipeline exceeded the maximum duration.",
        routeId: route.id,
      };
    }

    const batch = batches[batchIndex];
    const hasNextBatch = batchIndex < batches.length - 1;

    if (batch.length === 1) {
      const step = batch[0];
      const idx = globalIdx;
      globalIdx++;

      const picked = await selectExecutableMemberForStep(
        step,
        route,
        workspaceId,
        args.environmentId,
        route.id,
        lifecycleByModel,
        seedBase,
        idx
      );

      if (!picked.ok) {
        runtimeSteps.push({
          routeStepId: step.id,
          orderIndex: step.orderIndex,
          providerType: null,
          modelId: null,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          skipped: true,
          skipReason: "policy_or_not_executable",
        });
        continue;
      }

      const canonical =
        normalizeProviderToCanonicalApi(picked.canonicalProvider) ?? picked.canonicalProvider;
      const baseUrl = openAiCompatibleChatBaseUrl(canonical);
      if (!baseUrl) {
        runtimeSteps.push({
          routeStepId: step.id,
          orderIndex: step.orderIndex,
          providerType: canonical,
          modelId: picked.modelId,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          skipped: true,
          skipReason: "runtime_provider_not_supported",
        });
        continue;
      }

      const cred = await findDecryptedApiKeyForResolvedProvider({
        projectId: args.projectId,
        workspaceId,
        resolvedCanonicalProvider: picked.canonicalProvider,
      });
      if (!cred.ok) {
        const status = cred.code === "integration_not_found" ? 404 : 422;
        return {
          ok: false,
          httpStatus: status,
          error: cred.code,
          routeId: route.id,
        };
      }

      const timeoutMs =
        step.timeoutMs != null && step.timeoutMs > 0
          ? Math.min(step.timeoutMs, 300_000)
          : 120_000;

      const upstream = await postOpenAiCompatibleChat({
        baseUrl,
        apiKey: cred.apiKey,
        model: picked.modelId,
        messages: workingMessages,
        timeoutMs,
        signal: args.abortSignal,
      });

      if (!upstream.ok) {
        const kind = classifyUpstreamFailure(upstream.value);
        const canAdvance = shouldAdvanceAfterUpstreamFailure(step, kind) && hasNextBatch;
        if (canAdvance) {
          runtimeSteps.push({
            routeStepId: step.id,
            orderIndex: step.orderIndex,
            providerType: canonical,
            modelId: picked.modelId,
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
            skipped: true,
            skipReason: "upstream_failed_advancing",
          });
          continue;
        }
        return {
          ok: false,
          httpStatus: 502,
          error: "runtime_upstream_error",
          message: upstream.value.message,
          code: upstream.value.errorCode,
          routeId: route.id,
        };
      }

      const u = upstream.value.usage;
      const pt = u.promptTokens ?? 0;
      const ct = u.completionTokens ?? 0;
      const tt = u.totalTokens ?? pt + ct;
      sumPrompt += pt;
      sumCompletion += ct;
      sumTotal += tt;

      const stepUsd = estimateCostUsdForStep({
        modelId: picked.modelId,
        providerType: picked.canonicalProvider,
        promptTokens: u.promptTokens,
        completionTokens: u.completionTokens,
      });
      if (stepUsd != null) {
        sumCostUsd += stepUsd;
        sawCost = true;
      }

      lastContent = upstream.value.content;
      lastPick = {
        step,
        providerType: picked.canonicalProvider,
        modelId: picked.modelId,
        memberIndex: picked.memberIndex,
      };

      runtimeSteps.push({
        routeStepId: step.id,
        orderIndex: step.orderIndex,
        providerType: canonical,
        modelId: picked.modelId,
        promptTokens: u.promptTokens ?? null,
        completionTokens: u.completionTokens ?? null,
        totalTokens: u.totalTokens ?? null,
      });

      workingMessages = [
        ...args.initialMessages.map((m) => ({ ...m })),
        { role: "user", content: lastContent },
      ];
      continue;
    }

    // Parallel batch (consecutive same parallelGroupId) — fan-out upstream calls concurrently.
    const ac = new AbortController();
    if (args.abortSignal) {
      args.abortSignal.addEventListener("abort", () => ac.abort(), { once: true });
    }

    type Prep = {
      step: RouteStepRecord;
      idx: number;
      picked: Awaited<ReturnType<typeof selectExecutableMemberForStep>>;
      canonical: string;
      baseUrl: string | null;
      cred: Awaited<ReturnType<typeof findDecryptedApiKeyForResolvedProvider>>;
      timeoutMs: number;
    };

    const prepList: Prep[] = await Promise.all(
      batch.map(async (step, bi) => {
        const idx = globalIdx + bi;
        const picked = await selectExecutableMemberForStep(
          step,
          route,
          workspaceId,
          args.environmentId,
          route.id,
          lifecycleByModel,
          seedBase,
          idx
        );
        const canonical = picked.ok
          ? (normalizeProviderToCanonicalApi(picked.canonicalProvider) ?? picked.canonicalProvider)
          : "";
        const baseUrl = picked.ok ? openAiCompatibleChatBaseUrl(canonical) : null;
        const cred = picked.ok
          ? await findDecryptedApiKeyForResolvedProvider({
              projectId: args.projectId,
              workspaceId,
              resolvedCanonicalProvider: picked.canonicalProvider,
            })
          : ({ ok: false as const, code: "credential_unavailable" as const } as const);
        const timeoutMs =
          step.timeoutMs != null && step.timeoutMs > 0
            ? Math.min(step.timeoutMs, 300_000)
            : 120_000;
        return {
          step,
          idx,
          picked,
          canonical,
          baseUrl,
          cred: cred as Awaited<ReturnType<typeof findDecryptedApiKeyForResolvedProvider>>,
          timeoutMs,
        };
      })
    );

    for (const p of prepList) {
      if (!p.picked.ok) {
        runtimeSteps.push({
          routeStepId: p.step.id,
          orderIndex: p.step.orderIndex,
          providerType: null,
          modelId: null,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          skipped: true,
          skipReason: "policy_or_not_executable",
        });
        continue;
      }
      if (!p.baseUrl) {
        runtimeSteps.push({
          routeStepId: p.step.id,
          orderIndex: p.step.orderIndex,
          providerType: p.canonical,
          modelId: p.picked.modelId,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          skipped: true,
          skipReason: "runtime_provider_not_supported",
        });
        continue;
      }
      if (!p.cred.ok) {
        const status = p.cred.code === "integration_not_found" ? 404 : 422;
        return {
          ok: false,
          httpStatus: status,
          error: p.cred.code,
          routeId: route.id,
        };
      }
    }

    const upstreams = await Promise.all(
      prepList.map((p) => {
        if (!p.picked.ok || !p.baseUrl || !p.cred.ok) {
          return Promise.resolve({
            ok: false as const,
            value: { errorCode: "upstream_http_error" as const, httpStatus: 0, message: "skipped" },
          });
        }
        return postOpenAiCompatibleChat({
          baseUrl: p.baseUrl,
          apiKey: p.cred.apiKey,
          model: p.picked.modelId,
          messages: workingMessages,
          timeoutMs: p.timeoutMs,
          signal: ac.signal,
        });
      })
    );

    globalIdx += batch.length;

    if (mergeStrategy === "all_succeed") {
      const contents: string[] = [];
      for (let i = 0; i < prepList.length; i++) {
        const p = prepList[i];
        const up = upstreams[i];
        if (!p.picked.ok || !p.baseUrl) continue;
        if (!up.ok) {
          return {
            ok: false,
            httpStatus: 502,
            error: "runtime_upstream_error",
            message: up.value.message,
            code: up.value.errorCode,
            routeId: route.id,
          };
        }
        const u = up.value.usage;
        const pt = u.promptTokens ?? 0;
        const ct = u.completionTokens ?? 0;
        const tt = u.totalTokens ?? pt + ct;
        sumPrompt += pt;
        sumCompletion += ct;
        sumTotal += tt;
        const stepUsd = estimateCostUsdForStep({
          modelId: p.picked.modelId,
          providerType: p.picked.canonicalProvider,
          promptTokens: u.promptTokens,
          completionTokens: u.completionTokens,
        });
        if (stepUsd != null) {
          sumCostUsd += stepUsd;
          sawCost = true;
        }
        runtimeSteps.push({
          routeStepId: p.step.id,
          orderIndex: p.step.orderIndex,
          providerType: p.canonical,
          modelId: p.picked.modelId,
          promptTokens: u.promptTokens ?? null,
          completionTokens: u.completionTokens ?? null,
          totalTokens: u.totalTokens ?? null,
        });
        contents.push(up.value.content);
      }
      lastContent = contents.join("\n\n---\n\n");
      const lastP = prepList[prepList.length - 1];
      if (lastP.picked.ok) {
        lastPick = {
          step: lastP.step,
          providerType: lastP.picked.canonicalProvider,
          modelId: lastP.picked.modelId,
          memberIndex: lastP.picked.memberIndex,
        };
      }
      workingMessages = [
        ...args.initialMessages.map((m) => ({ ...m })),
        { role: "user", content: lastContent },
      ];
      continue;
    }

    // first_wins: first successful upstream in batch order drives chain content; all branches still billed in usage.
    let winnerIndex = -1;
    for (let i = 0; i < prepList.length; i++) {
      const p = prepList[i];
      const up = upstreams[i];
      if (!p.picked.ok || !p.baseUrl) continue;
      if (up.ok) {
        winnerIndex = i;
        break;
      }
    }

    if (winnerIndex < 0) {
      const canAdvanceParallel =
        hasNextBatch &&
        prepList.some((p, i) => {
          const up = upstreams[i];
          if (p.picked.ok && p.baseUrl && !up.ok) {
            const kind = classifyUpstreamFailure(up.value);
            return shouldAdvanceAfterUpstreamFailure(p.step, kind);
          }
          return false;
        });
      for (let i = 0; i < prepList.length; i++) {
        const p = prepList[i];
        const up = upstreams[i];
        if (!p.picked.ok || !p.baseUrl) continue;
        if (up.ok) continue;
        const kind = classifyUpstreamFailure(up.value);
        runtimeSteps.push({
          routeStepId: p.step.id,
          orderIndex: p.step.orderIndex,
          providerType: p.canonical,
          modelId: p.picked.modelId,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          skipped: true,
          skipReason: canAdvanceParallel
            ? "upstream_failed_advancing"
            : `parallel_upstream_failed:${kind}`,
        });
      }
      if (canAdvanceParallel) {
        continue;
      }
      return {
        ok: false,
        httpStatus: 502,
        error: "runtime_upstream_error",
        message: "Every branch in the parallel batch failed.",
        routeId: route.id,
      };
    }

    for (let i = 0; i < prepList.length; i++) {
      const p = prepList[i];
      const up = upstreams[i];
      if (!p.picked.ok || !p.baseUrl) continue;
      if (!up.ok) {
        const kind = classifyUpstreamFailure(up.value);
        runtimeSteps.push({
          routeStepId: p.step.id,
          orderIndex: p.step.orderIndex,
          providerType: p.canonical,
          modelId: p.picked.modelId,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          skipped: true,
          skipReason: `parallel_upstream_failed:${kind}`,
        });
        continue;
      }
      const u = up.value.usage;
      const pt = u.promptTokens ?? 0;
      const ct = u.completionTokens ?? 0;
      const tt = u.totalTokens ?? pt + ct;
      sumPrompt += pt;
      sumCompletion += ct;
      sumTotal += tt;
      const stepUsd = estimateCostUsdForStep({
        modelId: p.picked.modelId,
        providerType: p.picked.canonicalProvider,
        promptTokens: u.promptTokens,
        completionTokens: u.completionTokens,
      });
      if (stepUsd != null) {
        sumCostUsd += stepUsd;
        sawCost = true;
      }
      if (i === winnerIndex) {
        runtimeSteps.push({
          routeStepId: p.step.id,
          orderIndex: p.step.orderIndex,
          providerType: p.canonical,
          modelId: p.picked.modelId,
          promptTokens: u.promptTokens ?? null,
          completionTokens: u.completionTokens ?? null,
          totalTokens: u.totalTokens ?? null,
        });
        lastContent = up.value.content;
        lastPick = {
          step: p.step,
          providerType: p.picked.canonicalProvider,
          modelId: p.picked.modelId,
          memberIndex: p.picked.memberIndex,
        };
      } else {
        runtimeSteps.push({
          routeStepId: p.step.id,
          orderIndex: p.step.orderIndex,
          providerType: p.canonical,
          modelId: p.picked.modelId,
          promptTokens: u.promptTokens ?? null,
          completionTokens: u.completionTokens ?? null,
          totalTokens: u.totalTokens ?? null,
          skipped: true,
          skipReason: "parallel_superseded",
        });
      }
    }

    workingMessages = [
      ...args.initialMessages.map((m) => ({ ...m })),
      { role: "user", content: lastContent },
    ];
  }

  if (!lastPick) {
    return {
      ok: false,
      httpStatus: 422,
      error: "resolve_incomplete",
      message:
        "No step produced output: each step was skipped (policy block or provider not supported for hosted runtime).",
      routeId: route.id,
    };
  }

  const resolvedForContract = buildResolvedForLastStep(
    ctx,
    lastPick.step,
    lastPick.providerType,
    lastPick.modelId,
    lastPick.memberIndex,
    `runtime_pipeline lastStep=${lastPick.step.orderIndex}`
  );

  return {
    ok: true,
    finalContent: lastContent,
    aggregatedUsage: {
      promptTokens: sumPrompt > 0 ? sumPrompt : null,
      completionTokens: sumCompletion > 0 ? sumCompletion : null,
      totalTokens: sumTotal > 0 ? sumTotal : null,
    },
    estimatedCostUsdTotal: sawCost ? sumCostUsd : null,
    runtimeSteps,
    resolvedForContract,
  };
}

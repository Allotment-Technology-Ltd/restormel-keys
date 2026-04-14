/**
 * Executes a claimed hosted runtime job: pipeline + persist result (shared by sync POST and worker).
 */
import {
  getHostedRuntimeJobById,
  updateHostedRuntimeJobById,
  type HostedRuntimeJobRecord,
} from "$lib/server/db";
import type { ChatMessage } from "$lib/server/runtime-openai-chat";
import {
  runRuntimeInvokePipeline,
  type ParallelMergeStrategy,
} from "$lib/server/runtime-invoke-chain";
import { buildRuntimeInvokeSuccessData, RUNTIME_INVOKE_CONTRACT_VERSION } from "$lib/server/resolve-response";

export type JobRequestSummary = {
  environmentId: string;
  messages: ChatMessage[];
  mergeStrategy?: ParallelMergeStrategy;
  runtimeContractVersion?: string;
};

function parseRequestSummary(row: HostedRuntimeJobRecord): JobRequestSummary | null {
  const raw = row.requestSummary;
  if (!raw || typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const environmentId = typeof o.environmentId === "string" ? o.environmentId : "";
  const messages = o.messages;
  if (!environmentId || !Array.isArray(messages) || messages.length === 0) return null;
  const mergeFromColumn =
    row.mergeStrategy === "all_succeed" || row.mergeStrategy === "first_wins"
      ? row.mergeStrategy
      : undefined;
  const mergeFromSummary =
    o.mergeStrategy === "all_succeed" || o.mergeStrategy === "first_wins"
      ? o.mergeStrategy
      : undefined;
  const merge = mergeFromSummary ?? mergeFromColumn;
  const out: JobRequestSummary = {
    environmentId,
    messages: messages as ChatMessage[],
    ...(merge ? { mergeStrategy: merge } : {}),
  };
  return out;
}

/** Run pipeline for a job row already in `processing` (or sync path after transition). */
export async function runHostedRuntimeJobPipeline(
  row: HostedRuntimeJobRecord
): Promise<void> {
  const req = parseRequestSummary(row);
  if (!req) {
    await updateHostedRuntimeJobById({
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      status: "failed",
      errorCode: "invalid_job_payload",
      errorMessage: "request_summary.messages or environmentId missing",
    });
    return;
  }

  const fresh = await getHostedRuntimeJobById(row.id);
  if (fresh?.cancelRequestedAt != null && fresh.cancelRequestedAt > 0) {
    await updateHostedRuntimeJobById({
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      status: "cancelled",
    });
    return;
  }

  const startedAt = Date.now();
  const pipeline = await runRuntimeInvokePipeline({
    projectId: row.projectId,
    environmentId: req.environmentId,
    userId: row.userId,
    routeId: row.routeId,
    initialMessages: req.messages,
    startedAt,
    mergeStrategy: req.mergeStrategy ?? "first_wins",
    cancelCheck: async () => {
      const r = await getHostedRuntimeJobById(row.id);
      return r != null && r.cancelRequestedAt != null && r.cancelRequestedAt > 0;
    },
  });

  const again = await getHostedRuntimeJobById(row.id);
  if (again?.cancelRequestedAt != null && again.cancelRequestedAt > 0) {
    await updateHostedRuntimeJobById({
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      status: "cancelled",
    });
    return;
  }

  if (!pipeline.ok) {
    const p = pipeline;
    if (p.error === "job_cancelled") {
      await updateHostedRuntimeJobById({
        id: row.id,
        projectId: row.projectId,
        userId: row.userId,
        status: "cancelled",
      });
      return;
    }
    await updateHostedRuntimeJobById({
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      status: "failed",
      errorCode: p.error,
      errorMessage: p.message ?? p.error,
    });
    return;
  }

  const resolved = pipeline.resolvedForContract;
  const data = buildRuntimeInvokeSuccessData({
    resolved,
    traceId: null,
    estimatedCostUsd: pipeline.estimatedCostUsdTotal,
    content: pipeline.finalContent,
    usage: {
      promptTokens: pipeline.aggregatedUsage.promptTokens ?? null,
      completionTokens: pipeline.aggregatedUsage.completionTokens ?? null,
      totalTokens: pipeline.aggregatedUsage.totalTokens ?? null,
    },
    runtimeSteps: pipeline.runtimeSteps.map((r) => ({
      routeStepId: r.routeStepId,
      orderIndex: r.orderIndex,
      providerType: r.providerType,
      modelId: r.modelId,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
      ...(r.skipped ? { skipped: true, skipReason: r.skipReason } : {}),
    })),
  });

  await updateHostedRuntimeJobById({
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    status: "completed",
    resultSummary: { ...data, jobId: row.id, runtimeContractVersion: RUNTIME_INVOKE_CONTRACT_VERSION },
  });
}

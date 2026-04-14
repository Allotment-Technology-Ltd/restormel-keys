/**
 * Hosted runtime jobs: persisted pipeline (linear + parallel fan-out), optional async queue,
 * idempotent replay via `Idempotency-Key` / `idempotencyKey`, cancellation via DELETE.
 */
import type { ChatMessage } from "$lib/server/runtime-openai-chat";
import type { ParallelMergeStrategy } from "$lib/server/runtime-invoke-chain";
import {
  findHostedRuntimeJobByIdempotencyKey,
  getHostedRuntimeJobById,
  getRouteWithSteps,
  hashHostedRuntimeIdempotencyKey,
  insertHostedRuntimeJob,
  updateHostedRuntimeJobById,
  type HostedRuntimeJobRecord,
} from "$lib/server/db";
import { runHostedRuntimeJobPipeline } from "$lib/server/hosted-runtime-job-runner";
import { RUNTIME_INVOKE_CONTRACT_VERSION } from "$lib/server/resolve-response";

export type HostedRuntimeJobSuccessPayload = {
  jobId: string;
  status: "completed";
  runtimeContractVersion: string;
  data: Record<string, unknown>;
};

export type HostedRuntimeJobFailedPayload = {
  jobId: string;
  status: "failed";
  error: string;
  message?: string;
  httpStatus: number;
  routeId?: string;
};

export type CreateHostedRuntimeJobResult =
  | { type: "completed"; payload: HostedRuntimeJobSuccessPayload }
  | { type: "failed"; payload: HostedRuntimeJobFailedPayload }
  | { type: "async_accepted"; jobId: string; status: "queued" | "processing"; scheduleWorkerDrain: boolean }
  | { type: "cancelled"; jobId: string };

function isPgUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}

function errorCodeToHttpStatus(code: string | null): number {
  switch (code) {
    case "no_route":
      return 404;
    case "invalid_job_payload":
      return 400;
    default:
      return 422;
  }
}

function rowToSuccessPayload(row: HostedRuntimeJobRecord): HostedRuntimeJobSuccessPayload {
  const rs = row.resultSummary;
  if (!rs || typeof rs !== "object") {
    throw new Error("hosted_runtime_job: completed row missing result_summary");
  }
  const o = rs as Record<string, unknown>;
  const rcv =
    typeof o.runtimeContractVersion === "string" ? o.runtimeContractVersion : RUNTIME_INVOKE_CONTRACT_VERSION;
  return {
    jobId: row.id,
    status: "completed",
    runtimeContractVersion: rcv,
    data: { ...o },
  };
}

function rowToFailedPayload(row: HostedRuntimeJobRecord): HostedRuntimeJobFailedPayload {
  const code = row.errorCode ?? "failed";
  return {
    jobId: row.id,
    status: "failed",
    error: code,
    message: row.errorMessage ?? undefined,
    httpStatus: errorCodeToHttpStatus(row.errorCode),
    routeId: row.routeId,
  };
}

function mapExistingRow(row: HostedRuntimeJobRecord): CreateHostedRuntimeJobResult {
  switch (row.status) {
    case "completed":
      return { type: "completed", payload: rowToSuccessPayload(row) };
    case "failed":
      return { type: "failed", payload: rowToFailedPayload(row) };
    case "cancelled":
      return { type: "cancelled", jobId: row.id };
    case "queued":
    case "processing":
      return {
        type: "async_accepted",
        jobId: row.id,
        status: row.status,
        scheduleWorkerDrain: false,
      };
    default:
      return {
        type: "async_accepted",
        jobId: row.id,
        status: "queued",
        scheduleWorkerDrain: false,
      };
  }
}

export async function createAndRunHostedRuntimeJob(args: {
  jobId: string;
  projectId: string;
  userId: string;
  routeId: string;
  environmentId: string;
  messages: ChatMessage[];
  async?: boolean;
  idempotencyKey?: string | null;
  mergeStrategy?: ParallelMergeStrategy;
}): Promise<CreateHostedRuntimeJobResult> {
  const requestSummary = {
    environmentId: args.environmentId,
    messages: args.messages,
    messageCount: args.messages.length,
    runtimeContractVersion: RUNTIME_INVOKE_CONTRACT_VERSION,
    ...(args.mergeStrategy ? { mergeStrategy: args.mergeStrategy } : {}),
  };

  const idempotencyKeyHash =
    args.idempotencyKey && args.idempotencyKey.trim().length > 0
      ? hashHostedRuntimeIdempotencyKey({
          projectId: args.projectId,
          routeId: args.routeId,
          userId: args.userId,
          environmentId: args.environmentId,
          idempotencyKey: args.idempotencyKey.trim(),
        })
      : null;

  if (idempotencyKeyHash) {
    const existing = await findHostedRuntimeJobByIdempotencyKey(
      args.projectId,
      args.userId,
      idempotencyKeyHash
    );
    if (existing) {
      return mapExistingRow(existing);
    }
  }

  try {
    await insertHostedRuntimeJob({
      id: args.jobId,
      projectId: args.projectId,
      routeId: args.routeId,
      userId: args.userId,
      environmentId: args.environmentId,
      requestSummary,
      idempotencyKeyHash,
      mergeStrategy: args.mergeStrategy ?? null,
    });
  } catch (e) {
    if (idempotencyKeyHash && isPgUniqueViolation(e)) {
      const existing = await findHostedRuntimeJobByIdempotencyKey(
        args.projectId,
        args.userId,
        idempotencyKeyHash
      );
      if (existing) {
        return mapExistingRow(existing);
      }
    }
    throw e;
  }

  const rw = await getRouteWithSteps(args.routeId, args.projectId, args.userId);
  if (!rw) {
    await updateHostedRuntimeJobById({
      id: args.jobId,
      projectId: args.projectId,
      userId: args.userId,
      status: "failed",
      errorCode: "no_route",
      errorMessage: "Route not found",
    });
    return {
      type: "failed",
      payload: {
        jobId: args.jobId,
        status: "failed",
        error: "no_route",
        message: "Route not found",
        httpStatus: 404,
      },
    };
  }

  const wantAsync = args.async === true;

  if (wantAsync) {
    return {
      type: "async_accepted",
      jobId: args.jobId,
      status: "queued",
      scheduleWorkerDrain: true,
    };
  }

  await updateHostedRuntimeJobById({
    id: args.jobId,
    projectId: args.projectId,
    userId: args.userId,
    status: "processing",
  });

  const row = await getHostedRuntimeJobById(args.jobId);
  if (!row) {
    return {
      type: "failed",
      payload: {
        jobId: args.jobId,
        status: "failed",
        error: "job_missing",
        message: "Job row missing after insert",
        httpStatus: 500,
        routeId: rw.route.id,
      },
    };
  }

  await runHostedRuntimeJobPipeline(row);

  const final = await getHostedRuntimeJobById(args.jobId);
  if (!final) {
    return {
      type: "failed",
      payload: {
        jobId: args.jobId,
        status: "failed",
        error: "job_missing",
        message: "Job row missing after pipeline",
        httpStatus: 500,
        routeId: rw.route.id,
      },
    };
  }

  if (final.status === "completed") {
    return { type: "completed", payload: rowToSuccessPayload(final) };
  }
  if (final.status === "failed") {
    return { type: "failed", payload: rowToFailedPayload(final) };
  }
  if (final.status === "cancelled") {
    return { type: "cancelled", jobId: final.id };
  }

  return {
    type: "failed",
    payload: {
      jobId: args.jobId,
      status: "failed",
      error: "unexpected_job_status",
      message: `Expected terminal status after sync pipeline, got ${final.status}`,
      httpStatus: 500,
      routeId: rw.route.id,
    },
  };
}

export function jobRecordToPublicPayload(
  row: HostedRuntimeJobRecord
): Record<string, unknown> {
  return {
    jobId: row.id,
    status: row.status,
    environmentId: row.environmentId,
    routeId: row.routeId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.mergeStrategy ? { mergeStrategy: row.mergeStrategy } : {}),
    ...(row.cancelRequestedAt != null && row.cancelRequestedAt > 0
      ? { cancelRequestedAt: row.cancelRequestedAt }
      : {}),
    ...(row.resultSummary && typeof row.resultSummary === "object"
      ? { result: row.resultSummary }
      : {}),
    ...(row.errorCode
      ? { error: row.errorCode, message: row.errorMessage ?? row.errorCode }
      : {}),
  };
}

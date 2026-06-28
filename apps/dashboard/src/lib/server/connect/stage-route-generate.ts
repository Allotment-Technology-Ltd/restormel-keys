/**
 * Knowledge ingestion LLM calls via Keys route resolve (visual route builder).
 * Falls back to legacy OPENAI_API_KEY + model chains when routing is not configured.
 */
import {
  classifyBackoffReason,
  computeBackoffDelayMs,
  isRateLimitBackoffReason,
  type ExtractionGenerate,
  type EmbeddingPort,
} from "@restormel/connect-core";
import type { EmbeddingPort as GraphRagEmbeddingPort } from "@restormel/graphrag-core";
import {
  CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE,
  type ConnectModelStage,
} from "@restormel/contracts/connect";
import { INGESTION_WORKLOAD } from "$lib/server/ingestion-routing";
import { resolveRouteForExecution } from "$lib/server/route-resolver";
import { findDecryptedApiKeyForResolvedProvider } from "$lib/server/runtime-invoke";
import { openAiCompatibleChatBaseUrl, postOpenAiCompatibleChat } from "$lib/server/runtime-openai-chat";
import { resolveVendorOpenAiChatModelId } from "$lib/server/runtime-model-upstream";
import {
  connectEmbedTimeoutMs,
  isLlmConfigured,
  makeEmbedder,
  makeStageGenerate,
} from "$lib/server/connect/llm-generate";
import { getConnectStageModels } from "$lib/server/neon";
import {
  resolveKnowledgeRouteExecutionContext,
  type ConnectRouteExecutionContext,
} from "$lib/server/connect/stage-routing";

export type StageGenerates = {
  extraction: ExtractionGenerate;
  grouping: ExtractionGenerate;
  validation: ExtractionGenerate;
  remediation: ExtractionGenerate;
};

const MAX_ROUTE_ATTEMPTS = 12;

/**
 * Wall-clock ceiling for one logical stage call across ALL route fallback attempts.
 * Each attempt may legitimately take up to its 180s upstream timeout, so 12 attempts
 * against a wedged provider chain used to spin for ~36 minutes with zero operator
 * feedback — indistinguishable from a frozen run. Fast failures (auth, missing key,
 * 4xx) still get the full 12 attempts; only slow-timeout chains are cut short.
 */
export function routeRetryDeadlineMs(): number {
  const raw = Number(process.env.CONNECT_ROUTE_RETRY_DEADLINE_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 15 * 60_000;
}

/** True when the retry loop must stop and surface the last upstream error. */
export function routeRetryDeadlineExceeded(startedAtMs: number, nowMs = Date.now()): boolean {
  return nowMs - startedAtMs >= routeRetryDeadlineMs();
}

function routeRetryDeadlineError(lastErr: unknown): Error {
  const prior = lastErr instanceof Error ? ` Last error: ${lastErr.message}` : "";
  return new Error(
    `Route retry deadline exceeded (${Math.round(routeRetryDeadlineMs() / 1000)}s) — giving up on remaining fallback steps.${prior}`,
  );
}

/** Keep upstream LLM error when route retry exhausts fallback steps. */
export function mergeRouteResolveFailure(
  lastErr: unknown,
  attemptNumber: number,
  failure: { message?: string; code: string },
): Error {
  const resolverMsg = failure.message ?? failure.code;
  const prior = lastErr instanceof Error ? lastErr.message.trim() : "";
  if (attemptNumber > 0 && prior && /no further steps/i.test(resolverMsg)) {
    return new Error(`Route fallback exhausted after: ${prior}`);
  }
  return new Error(resolverMsg);
}

/**
 * W3.3 (PR #292 follow-up #2) — failure-coverage error codes for Connect-ingest
 * resolve attempts that fail BEFORE the upstream call. K5 only wrote a request_logs
 * row when the upstream chat/embed HTTP call errored, so a total no_route resolve, a
 * provider/model-less route step, an unsupported provider, and (most importantly)
 * missing/undecryptable provider credentials all wrote nothing — making the most
 * common ingest failures invisible in /logs. These codes tag the `failed` row so the
 * failure is debuggable. Codes are stable, lowercase, and mirror the resolve endpoint's
 * `failure.code` vocabulary where it overlaps (`+server.ts`: no_route / no_key_available /
 * resolve_incomplete). Pure + exported so the mapping is unit-tested in src/lib.
 */
export type ConnectResolveFailureSite =
  | "route_resolve_failed" // resolveRouteForExecution returned !ok (no_route, no_key_available, …)
  | "resolve_incomplete" // resolved a step but it carries no provider/model
  | "provider_unsupported" // resolved provider is not OpenAI-compatible / not an embedding provider
  | "credentials_missing"; // no decryptable provider key for the resolved provider

export function resolveAttemptFailureCode(
  site: ConnectResolveFailureSite,
  detail?: { resolverCode?: string | null; credentialCode?: string | null },
): string {
  switch (site) {
    case "route_resolve_failed":
      // Prefer the resolver's own code (no_route, no_key_available, resolve_incomplete…)
      // so /logs shows the same failure vocabulary the HTTP resolve endpoint records.
      return (detail?.resolverCode && detail.resolverCode.trim()) || "no_route";
    case "credentials_missing":
      return detail?.credentialCode && detail.credentialCode.trim()
        ? `credentials_missing:${detail.credentialCode.trim()}`
        : "credentials_missing";
    default:
      return site;
  }
}

async function callResolvedChat(args: {
  ctx: ConnectRouteExecutionContext;
  stage: ConnectModelStage;
  system: string;
  user: string;
  jsonMode?: boolean;
}): Promise<string> {
  const ingestionStage = CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE[args.stage];
  const routeIdOverride = args.ctx.routing.routes?.[args.stage];
  const startedAtMs = Date.now();
  let attemptNumber = 0;
  let previousFailure:
    | { selectedOrderIndex?: number | null; selectedStepId?: string | null }
    | undefined;
  let lastErr: unknown;

  for (let i = 0; i < MAX_ROUTE_ATTEMPTS; i++) {
    if (i > 0 && routeRetryDeadlineExceeded(startedAtMs)) {
      throw routeRetryDeadlineError(lastErr);
    }
    const outcome = await resolveRouteForExecution(
      args.ctx.projectId,
      args.ctx.environmentId,
      args.ctx.userId,
      {
        routeId: routeIdOverride,
        workload: INGESTION_WORKLOAD,
        stage: ingestionStage,
        attemptNumber,
        previousFailure,
        failureKind: "upstream_error",
      },
    );

    if (!outcome.ok) {
      lastErr = mergeRouteResolveFailure(lastErr, attemptNumber, outcome.failure);
      // W3.3: a total resolve failure (no_route etc.) previously wrote no log row.
      writeResolveAttempt(args.ctx, args.stage, {
        status: "failed",
        routeId: outcome.failure.routeId ?? routeIdOverride ?? null,
        latencyMs: Date.now() - startedAtMs,
        errorCode: resolveAttemptFailureCode("route_resolve_failed", {
          resolverCode: outcome.failure.code,
        }),
        attemptNumber,
      });
      break;
    }

    const resolved = outcome.result;
    const providerType = resolved.providerType ?? "";
    const modelId = resolved.modelId ?? "";
    if (!providerType || !modelId) {
      lastErr = new Error(resolved.explanation ?? "No provider/model on resolved route");
      // W3.3: a step missing provider/model previously wrote no log row.
      writeResolveAttempt(args.ctx, args.stage, {
        status: "failed",
        routeId: resolved.route?.id ?? routeIdOverride ?? null,
        provider: providerType || null,
        modelId: modelId || null,
        latencyMs: Date.now() - startedAtMs,
        errorCode: resolveAttemptFailureCode("resolve_incomplete"),
        attemptNumber,
      });
      if (attemptNumber < MAX_ROUTE_ATTEMPTS - 1) {
        attemptNumber++;
        previousFailure = {
          selectedStepId: resolved.selectedStepId,
          selectedOrderIndex: resolved.selectedOrderIndex,
        };
        continue;
      }
      break;
    }

    const baseUrl = openAiCompatibleChatBaseUrl(providerType);
    if (!baseUrl) {
      lastErr = new Error(`Provider ${providerType} is not OpenAI-compatible for Knowledge ingestion yet`);
      // W3.3: an unsupported provider previously wrote no log row.
      writeResolveAttempt(args.ctx, args.stage, {
        status: "failed",
        routeId: resolved.route?.id ?? routeIdOverride ?? null,
        provider: providerType,
        modelId,
        latencyMs: Date.now() - startedAtMs,
        errorCode: resolveAttemptFailureCode("provider_unsupported"),
        attemptNumber,
      });
      attemptNumber++;
      previousFailure = {
        selectedStepId: resolved.selectedStepId,
        selectedOrderIndex: resolved.selectedOrderIndex,
      };
      continue;
    }

    const keyOutcome = await findDecryptedApiKeyForResolvedProvider({
      projectId: args.ctx.projectId,
      workspaceId: resolved.workspaceId,
      resolvedCanonicalProvider: providerType,
    });
    if (!keyOutcome.ok) {
      lastErr = new Error(`Provider credentials missing (${keyOutcome.code})`);
      // W3.3: the most common ingest failure — a missing/undecryptable provider key —
      // previously wrote no log row, so "why did my ingest fail?" was unanswerable in /logs.
      writeResolveAttempt(args.ctx, args.stage, {
        status: "failed",
        routeId: resolved.route?.id ?? routeIdOverride ?? null,
        provider: providerType,
        modelId,
        latencyMs: Date.now() - startedAtMs,
        errorCode: resolveAttemptFailureCode("credentials_missing", {
          credentialCode: keyOutcome.code,
        }),
        attemptNumber,
      });
      attemptNumber++;
      previousFailure = {
        selectedStepId: resolved.selectedStepId,
        selectedOrderIndex: resolved.selectedOrderIndex,
      };
      continue;
    }

    const upstreamModel = await resolveVendorOpenAiChatModelId(providerType, modelId);
    const callStartedMs = Date.now();
    const chat = await postOpenAiCompatibleChat({
      baseUrl,
      apiKey: keyOutcome.apiKey,
      model: upstreamModel,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      timeoutMs: 180_000,
      jsonMode: args.jsonMode,
    });

    if (chat.ok) {
      // K5: capture which route/step/provider/model actually served this stage,
      // and tag the resolve into request logs (source=connect_ingest). Capture
      // must never break a run, hence the defensive try.
      recordStageAttribution(args.ctx, args.stage, resolved, providerType, modelId, attemptNumber);
      writeResolveAttempt(args.ctx, args.stage, {
        status: "resolved",
        routeId: resolved.route?.id ?? routeIdOverride ?? null,
        provider: providerType,
        modelId,
        latencyMs: Date.now() - callStartedMs,
        attemptNumber,
      });
      return chat.value.content;
    }

    writeResolveAttempt(args.ctx, args.stage, {
      status: "failed",
      routeId: resolved.route?.id ?? routeIdOverride ?? null,
      provider: providerType,
      modelId,
      latencyMs: Date.now() - callStartedMs,
      errorCode: "upstream_error",
      attemptNumber,
    });
    lastErr = new Error(chat.value.message);
    // RES-113 PR-I: surface a real backoff before retrying the next route step.
    await maybeBackoffBeforeRetry({
      ctx: args.ctx,
      stage: args.stage,
      provider: providerType,
      modelId,
      errorMessage: chat.value.message,
      attemptNumber,
      willRetry: i < MAX_ROUTE_ATTEMPTS - 1 && !routeRetryDeadlineExceeded(startedAtMs),
    });
    attemptNumber++;
    previousFailure = {
      selectedStepId: resolved.selectedStepId,
      selectedOrderIndex: resolved.selectedOrderIndex,
    };
  }

  throw lastErr instanceof Error ? lastErr : new Error("All route attempts failed");
}

/**
 * K5 capture helpers — fire-and-forget. Run attribution and request-log tagging
 * must never throw into the pipeline (a logging failure can't fail a stage).
 */
function recordStageAttribution(
  ctx: ConnectRouteExecutionContext,
  stage: ConnectModelStage,
  resolved: {
    route?: { id: string; name: string } | null;
    projectId?: string | null;
    selectedStepId?: string | null;
    selectedOrderIndex?: number | null;
  },
  provider: string,
  modelId: string,
  attemptNumber: number,
): void {
  if (!ctx.onStageServed) return;
  try {
    ctx.onStageServed(stage, {
      routeId: resolved.route?.id ?? null,
      routeName: resolved.route?.name ?? null,
      projectId: resolved.projectId ?? ctx.projectId,
      stepId: resolved.selectedStepId ?? null,
      stepOrderIndex: resolved.selectedOrderIndex ?? null,
      provider,
      modelId,
      attemptNumber,
    });
  } catch {
    /* attribution capture is best-effort */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * RES-113 PR-I — on a transient rate-limit/overload failure, publish a structured
 * backoff signal AND apply a bounded backoff sleep before the next route attempt, so the
 * M1 console's amber "provider rate-limited" state lights from a REAL signal. No-op (and
 * therefore zero timing change) unless `ctx.onBackoff` is wired — that wiring is itself
 * flag-gated in the worker. Only genuine throttling (rate_limit/overloaded) triggers it;
 * plain 5xx/timeout keep today's silent immediate failover. Best-effort: never throws.
 */
async function maybeBackoffBeforeRetry(args: {
  ctx: ConnectRouteExecutionContext;
  stage: ConnectModelStage;
  provider?: string | null;
  modelId?: string | null;
  errorMessage: string;
  /** 0-based attempt index that just failed. */
  attemptNumber: number;
  /** False when no further route attempts remain — skip the wasted sleep. */
  willRetry: boolean;
}): Promise<void> {
  if (!args.ctx.onBackoff || !args.willRetry) return;
  const reason = classifyBackoffReason(args.errorMessage);
  if (!reason || !isRateLimitBackoffReason(reason)) return;
  const nextAttempt = args.attemptNumber + 1; // 1-based upcoming retry
  const delayMs = computeBackoffDelayMs(nextAttempt);
  try {
    args.ctx.onBackoff({
      stage: args.stage,
      ...(args.provider ? { provider: args.provider } : {}),
      ...(args.modelId ? { model: args.modelId } : {}),
      reasonCode: reason,
      attempt: nextAttempt,
      delayMs,
      at: new Date().toISOString(),
    });
  } catch {
    /* backoff telemetry is best-effort */
  }
  await sleep(delayMs);
}

function writeResolveAttempt(
  ctx: ConnectRouteExecutionContext,
  stage: ConnectModelStage,
  rec: {
    status: "resolved" | "failed";
    routeId?: string | null;
    provider?: string | null;
    modelId?: string | null;
    latencyMs: number;
    errorCode?: string | null;
    attemptNumber: number;
  },
): void {
  if (!ctx.onResolveAttempt) return;
  try {
    ctx.onResolveAttempt(stage, rec);
  } catch {
    /* request-log tagging is best-effort */
  }
}

/** JSON chat completion via resolved ingestion route (Graph Designer, previews). */
export async function generateKnowledgeJsonChat(args: {
  ctx: ConnectRouteExecutionContext;
  stage?: ConnectModelStage;
  system: string;
  user: string;
}): Promise<string> {
  return callResolvedChat({
    ctx: args.ctx,
    stage: args.stage ?? "extraction",
    system: args.system,
    user: args.user,
    jsonMode: true,
  });
}

async function embedViaRoute(
  ctx: ConnectRouteExecutionContext,
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const ingestionStage = CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE.embedding;
  const routeIdOverride = ctx.routing.routes?.embedding;
  const startedAtMs = Date.now();
  let attemptNumber = 0;
  let previousFailure:
    | { selectedOrderIndex?: number | null; selectedStepId?: string | null }
    | undefined;
  let lastErr: unknown;

  for (let i = 0; i < MAX_ROUTE_ATTEMPTS; i++) {
    if (i > 0 && routeRetryDeadlineExceeded(startedAtMs)) {
      throw routeRetryDeadlineError(lastErr);
    }
    const outcome = await resolveRouteForExecution(ctx.projectId, ctx.environmentId, ctx.userId, {
      routeId: routeIdOverride,
      workload: INGESTION_WORKLOAD,
      stage: ingestionStage,
      attemptNumber,
      previousFailure,
      failureKind: "upstream_error",
    });

    if (!outcome.ok) {
      lastErr = mergeRouteResolveFailure(lastErr, attemptNumber, outcome.failure);
      // W3.3: a total embedding resolve failure (no_route etc.) wrote no log row.
      writeResolveAttempt(ctx, "embedding", {
        status: "failed",
        routeId: outcome.failure.routeId ?? routeIdOverride ?? null,
        latencyMs: Date.now() - startedAtMs,
        errorCode: resolveAttemptFailureCode("route_resolve_failed", {
          resolverCode: outcome.failure.code,
        }),
        attemptNumber,
      });
      break;
    }

    const resolved = outcome.result;
    const providerType = resolved.providerType ?? "";
    const modelId = resolved.modelId ?? "";
    if (!providerType || !modelId) {
      lastErr = new Error(resolved.explanation ?? "No embedding model resolved");
      // W3.3: an embedding step missing provider/model wrote no log row.
      writeResolveAttempt(ctx, "embedding", {
        status: "failed",
        routeId: resolved.route?.id ?? routeIdOverride ?? null,
        provider: providerType || null,
        modelId: modelId || null,
        latencyMs: Date.now() - startedAtMs,
        errorCode: resolveAttemptFailureCode("resolve_incomplete"),
        attemptNumber,
      });
      attemptNumber++;
      previousFailure = {
        selectedStepId: resolved.selectedStepId,
        selectedOrderIndex: resolved.selectedOrderIndex,
      };
      continue;
    }

    const keyOutcome = await findDecryptedApiKeyForResolvedProvider({
      projectId: ctx.projectId,
      workspaceId: resolved.workspaceId,
      resolvedCanonicalProvider: providerType,
    });
    if (!keyOutcome.ok) {
      lastErr = new Error(`Provider credentials missing (${keyOutcome.code})`);
      // W3.3: missing/undecryptable embedding-provider credentials wrote no log row.
      writeResolveAttempt(ctx, "embedding", {
        status: "failed",
        routeId: resolved.route?.id ?? routeIdOverride ?? null,
        provider: providerType,
        modelId,
        latencyMs: Date.now() - startedAtMs,
        errorCode: resolveAttemptFailureCode("credentials_missing", {
          credentialCode: keyOutcome.code,
        }),
        attemptNumber,
      });
      attemptNumber++;
      previousFailure = {
        selectedStepId: resolved.selectedStepId,
        selectedOrderIndex: resolved.selectedOrderIndex,
      };
      continue;
    }

    const pt = providerType.trim().toLowerCase();
    if (!isConnectEmbeddingProvider(pt)) {
      lastErr = new Error(
        `Embedding via ${providerType} is not supported in Connect ingest yet — use openai, voyage, together, or vercel`,
      );
      // W3.3: an unsupported embedding provider wrote no log row.
      writeResolveAttempt(ctx, "embedding", {
        status: "failed",
        routeId: resolved.route?.id ?? routeIdOverride ?? null,
        provider: pt,
        modelId,
        latencyMs: Date.now() - startedAtMs,
        errorCode: resolveAttemptFailureCode("provider_unsupported"),
        attemptNumber,
      });
      attemptNumber++;
      previousFailure = {
        selectedStepId: resolved.selectedStepId,
        selectedOrderIndex: resolved.selectedOrderIndex,
      };
      continue;
    }

    const embedStartedMs = Date.now();
    try {
      const upstreamModel = await resolveVendorOpenAiChatModelId(pt, modelId);
      const vectors = await knowledgeEmbedWithKey(texts, upstreamModel, keyOutcome.apiKey, pt);
      // K5: capture the embedding stage's served route/step/provider/model + tag the log.
      recordStageAttribution(ctx, "embedding", resolved, pt, modelId, attemptNumber);
      writeResolveAttempt(ctx, "embedding", {
        status: "resolved",
        routeId: resolved.route?.id ?? routeIdOverride ?? null,
        provider: pt,
        modelId,
        latencyMs: Date.now() - embedStartedMs,
        attemptNumber,
      });
      return vectors;
    } catch (e) {
      writeResolveAttempt(ctx, "embedding", {
        status: "failed",
        routeId: resolved.route?.id ?? routeIdOverride ?? null,
        provider: pt,
        modelId,
        latencyMs: Date.now() - embedStartedMs,
        errorCode: "upstream_error",
        attemptNumber,
      });
      lastErr = e;
      // RES-113 PR-I: surface a real backoff before retrying the next embedding step.
      await maybeBackoffBeforeRetry({
        ctx,
        stage: "embedding",
        provider: pt,
        modelId,
        errorMessage: e instanceof Error ? e.message : String(e),
        attemptNumber,
        willRetry: i < MAX_ROUTE_ATTEMPTS - 1 && !routeRetryDeadlineExceeded(startedAtMs),
      });
      attemptNumber++;
      previousFailure = {
        selectedStepId: resolved.selectedStepId,
        selectedOrderIndex: resolved.selectedOrderIndex,
      };
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("Embedding route resolution failed");
}

const CONNECT_EMBEDDING_PROVIDERS = new Set(["openai", "together", "vercel", "voyage"]);

function isConnectEmbeddingProvider(provider: string): boolean {
  return CONNECT_EMBEDDING_PROVIDERS.has(provider.trim().toLowerCase());
}

function embeddingApiBase(provider: string): string | null {
  switch (provider.trim().toLowerCase()) {
    case "together":
      return "https://api.together.xyz/v1";
    case "vercel":
      return "https://ai-gateway.vercel.sh/v1";
    case "voyage":
      return "https://api.voyageai.com/v1";
    case "openai":
      return "https://api.openai.com/v1";
    default:
      return null;
  }
}

async function knowledgeEmbedWithKey(
  texts: string[],
  model: string,
  apiKey: string,
  provider: string,
): Promise<number[][]> {
  const base = embeddingApiBase(provider);
  if (!base) {
    throw new Error(`Embedding provider ${provider} is not supported`);
  }
  const out: number[][] = [];
  const BATCH = 96;
  const timeoutMs = connectEmbedTimeoutMs();
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    let res: Response;
    try {
      res = await fetch(`${base}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, input: batch }),
        // A wedged upstream must fail the stage, not hang the whole run silently.
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
        throw new Error(`Embedding request timed out after ${timeoutMs}ms`);
      }
      throw e;
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Embedding request failed (HTTP ${res.status}). ${detail.slice(0, 160)}`.trim());
    }
    const data = (await res.json()) as { data?: { embedding: number[] }[] };
    for (const item of data.data ?? []) out.push(item.embedding);
  }
  return out;
}

function makeRouteStageGenerate(
  ctx: ConnectRouteExecutionContext,
  stage: ConnectModelStage,
): ExtractionGenerate {
  return ({ system, user }) => callResolvedChat({ ctx, stage, system, user, jsonMode: true });
}

function withRouteOverride(
  routeCtx: ConnectRouteExecutionContext,
  stage: ConnectModelStage,
  routeId?: string | null,
): ConnectRouteExecutionContext {
  if (!routeId?.trim()) return routeCtx;
  return {
    ...routeCtx,
    routing: {
      ...routeCtx.routing,
      routes: {
        ...routeCtx.routing.routes,
        [stage]: routeId.trim(),
      },
    },
  };
}

/** Validation LLM call with optional route override (graph re-validation). */
export function buildValidationStageGenerate(
  routeCtx: ConnectRouteExecutionContext,
  validationRouteId?: string | null,
): ExtractionGenerate {
  return makeRouteStageGenerate(withRouteOverride(routeCtx, "validation", validationRouteId), "validation");
}

/** Remediation LLM call with optional route override (graph auto-remediation). */
export function buildRemediationStageGenerate(
  routeCtx: ConnectRouteExecutionContext,
  remediationRouteId?: string | null,
): ExtractionGenerate {
  return makeRouteStageGenerate(withRouteOverride(routeCtx, "remediation", remediationRouteId), "remediation");
}

/** Embedding port with optional route override (graph embed backfill). */
export function buildEmbedStagePort(
  routeCtx: ConnectRouteExecutionContext,
  embeddingRouteId?: string | null,
): EmbeddingPort {
  const ctx = withRouteOverride(routeCtx, "embedding", embeddingRouteId);
  return (texts) => embedViaRoute(ctx, texts);
}

/** Build stage generates + embedder from Keys routing, with legacy env/model fallback. */
export async function buildKnowledgeStageGenerates(args: {
  workspaceId: string;
  routeCtx: ConnectRouteExecutionContext | null;
}): Promise<{ generates: StageGenerates; embed: EmbeddingPort; usesRoutes: boolean }> {
  if (args.routeCtx) {
    const ctx = args.routeCtx;
    return {
      usesRoutes: true,
      generates: {
        extraction: makeRouteStageGenerate(ctx, "extraction"),
        grouping: makeRouteStageGenerate(ctx, "grouping"),
        validation: makeRouteStageGenerate(ctx, "validation"),
        remediation: makeRouteStageGenerate(ctx, "remediation"),
      },
      embed: (texts) => embedViaRoute(ctx, texts),
    };
  }

  const legacy = await getConnectStageModels(args.workspaceId);
  return {
    usesRoutes: false,
    generates: {
      extraction: makeStageGenerate(legacy.extraction),
      grouping: makeStageGenerate(legacy.grouping),
      validation: makeStageGenerate(legacy.validation),
      remediation: makeStageGenerate(legacy.remediation),
    },
    embed: makeEmbedder(legacy.embedding),
  };
}

/** True when route-based ingestion can run (routing config or legacy OPENAI_API_KEY). */
export async function isConnectIngestLlmReady(args: {
  workspaceId: string;
  routeCtx: ConnectRouteExecutionContext | null;
}): Promise<boolean> {
  if (args.routeCtx) return true;
  return isLlmConfigured();
}

export { knowledgeLlmModel } from "$lib/server/connect/llm-generate";

/** Embedder for Connect Retrieve — Keys embedding route with legacy OPENAI_API_KEY fallback. */
export async function buildGraphRagEmbedder(args: {
  workspaceId: string;
  userId: string;
  projectId?: string | null;
}): Promise<GraphRagEmbeddingPort> {
  const routeCtx = await resolveKnowledgeRouteExecutionContext({
    workspaceId: args.workspaceId,
    userId: args.userId,
    projectId: args.projectId,
  });
  if (routeCtx) {
    return {
      embedQuery: async (text: string) => {
        const vectors = await embedViaRoute(routeCtx, [text]);
        return vectors[0] ?? [];
      },
    };
  }
  const legacy = await getConnectStageModels(args.workspaceId);
  const batch = makeEmbedder(legacy.embedding);
  return {
    embedQuery: async (text: string) => {
      const vectors = await batch([text]);
      return vectors[0] ?? [];
    },
  };
}

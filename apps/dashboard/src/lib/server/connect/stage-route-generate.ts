/**
 * Knowledge ingestion LLM calls via Keys route resolve (visual route builder).
 * Falls back to legacy OPENAI_API_KEY + model chains when routing is not configured.
 */
import type { ExtractionGenerate, EmbeddingPort } from "@restormel/connect-core";
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
      break;
    }

    const resolved = outcome.result;
    const providerType = resolved.providerType ?? "";
    const modelId = resolved.modelId ?? "";
    if (!providerType || !modelId) {
      lastErr = new Error(resolved.explanation ?? "No provider/model on resolved route");
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
      attemptNumber++;
      previousFailure = {
        selectedStepId: resolved.selectedStepId,
        selectedOrderIndex: resolved.selectedOrderIndex,
      };
      continue;
    }

    const upstreamModel = await resolveVendorOpenAiChatModelId(providerType, modelId);
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

    if (chat.ok) return chat.value.content;

    lastErr = new Error(chat.value.message);
    attemptNumber++;
    previousFailure = {
      selectedStepId: resolved.selectedStepId,
      selectedOrderIndex: resolved.selectedOrderIndex,
    };
  }

  throw lastErr instanceof Error ? lastErr : new Error("All route attempts failed");
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
      break;
    }

    const resolved = outcome.result;
    const providerType = resolved.providerType ?? "";
    const modelId = resolved.modelId ?? "";
    if (!providerType || !modelId) {
      lastErr = new Error(resolved.explanation ?? "No embedding model resolved");
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
      attemptNumber++;
      previousFailure = {
        selectedStepId: resolved.selectedStepId,
        selectedOrderIndex: resolved.selectedOrderIndex,
      };
      continue;
    }

    try {
      const upstreamModel = await resolveVendorOpenAiChatModelId(pt, modelId);
      return await knowledgeEmbedWithKey(texts, upstreamModel, keyOutcome.apiKey, pt);
    } catch (e) {
      lastErr = e;
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

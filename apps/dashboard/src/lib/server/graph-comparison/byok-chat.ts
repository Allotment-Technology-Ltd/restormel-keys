/**
 * BYOK chat for the "Proof" graph-comparison panel — resolves the workspace's Keys
 * route to a provider/model + the user's decrypted key, then streams (or JSON-completes)
 * an OpenAI-compatible chat. Mirrors the resolve/retry loop in
 * `connect/stage-route-generate.ts:callResolvedChat` so all LLM cost lands on the user's
 * keys (no Restormel `OPENAI_API_KEY` exposure). The comparison reuses the ingestion
 * "extraction" stage as its chat-capable route.
 */
import {
  CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE,
  type ConnectModelStage,
} from "@restormel/contracts/connect";
import { INGESTION_WORKLOAD } from "$lib/server/ingestion-routing";
import { resolveRouteForExecution } from "$lib/server/route-resolver";
import { findDecryptedApiKeyForResolvedProvider } from "$lib/server/runtime-invoke";
import {
  openAiCompatibleChatBaseUrl,
  postOpenAiCompatibleChat,
  streamOpenAiCompatibleChat,
  type ChatMessage,
} from "$lib/server/runtime-openai-chat";
import { resolveVendorOpenAiChatModelId } from "$lib/server/runtime-model-upstream";
import {
  resolveKnowledgeRouteExecutionContext,
  type ConnectRouteExecutionContext,
} from "$lib/server/connect/stage-routing";

const MAX_ROUTE_ATTEMPTS = 8;
const CHAT_STAGE: ConnectModelStage = "extraction";

export type ByokChatTarget = {
  baseUrl: string;
  apiKey: string;
  /** Upstream (vendor) model id to send on the wire. */
  upstreamModel: string;
  /** Canonical provider + the route's model id, for the panel sub-label. */
  providerType: string;
  modelId: string;
};

export type ResolveChatTargetResult =
  | { ok: true; target: ByokChatTarget }
  | { ok: false; error: string };

/** Resolve the Keys route execution context for a session (null when no routing configured). */
export async function resolveByokChatContext(args: {
  workspaceId: string;
  userId: string;
  projectId?: string | null;
}): Promise<ConnectRouteExecutionContext | null> {
  return resolveKnowledgeRouteExecutionContext(args);
}

/**
 * Resolve a concrete provider/model/key for the comparison, walking the route's fallback
 * steps on failure (same advancement strategy as the ingestion path).
 */
export async function resolveByokChatTarget(args: {
  ctx: ConnectRouteExecutionContext;
  /** Optional route id from the panel's MODEL dropdown; falls back to the stage's default route. */
  routeId?: string;
}): Promise<ResolveChatTargetResult> {
  const ingestionStage = CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE[CHAT_STAGE];
  const routeIdOverride = args.routeId?.trim() || args.ctx.routing.routes?.[CHAT_STAGE];

  let attemptNumber = 0;
  let previousFailure:
    | { selectedOrderIndex?: number | null; selectedStepId?: string | null }
    | undefined;
  let lastError = "No chat route could be resolved for this workspace.";

  for (let i = 0; i < MAX_ROUTE_ATTEMPTS; i++) {
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
      lastError = outcome.failure.message ?? outcome.failure.code;
      break;
    }

    const resolved = outcome.result;
    const advance = () => {
      attemptNumber++;
      previousFailure = {
        selectedStepId: resolved.selectedStepId,
        selectedOrderIndex: resolved.selectedOrderIndex,
      };
    };

    const providerType = resolved.providerType ?? "";
    const modelId = resolved.modelId ?? "";
    if (!providerType || !modelId) {
      lastError = resolved.explanation ?? "No provider/model on resolved route";
      advance();
      continue;
    }

    const baseUrl = openAiCompatibleChatBaseUrl(providerType);
    if (!baseUrl) {
      lastError = `Provider ${providerType} is not OpenAI-compatible for chat yet.`;
      advance();
      continue;
    }

    const keyOutcome = await findDecryptedApiKeyForResolvedProvider({
      projectId: args.ctx.projectId,
      workspaceId: resolved.workspaceId,
      resolvedCanonicalProvider: providerType,
    });
    if (!keyOutcome.ok) {
      lastError = `Provider credentials missing (${keyOutcome.code}).`;
      advance();
      continue;
    }

    const upstreamModel = await resolveVendorOpenAiChatModelId(providerType, modelId);
    return {
      ok: true,
      target: { baseUrl, apiKey: keyOutcome.apiKey, upstreamModel, providerType, modelId },
    };
  }

  return { ok: false, error: lastError };
}

/** Stream assistant text deltas from a resolved BYOK target. */
export async function* streamByokChat(args: {
  target: ByokChatTarget;
  system: string;
  user: string;
  signal?: AbortSignal;
}): AsyncGenerator<string, void, unknown> {
  const messages: ChatMessage[] = [
    { role: "system", content: args.system },
    { role: "user", content: args.user },
  ];
  yield* streamOpenAiCompatibleChat({
    baseUrl: args.target.baseUrl,
    apiKey: args.target.apiKey,
    model: args.target.upstreamModel,
    messages,
    signal: args.signal,
    timeoutMs: 120_000,
  });
}

/** One-shot JSON completion from a resolved BYOK target (used for the quality-delta call). */
export async function generateByokJson(args: {
  target: ByokChatTarget;
  system: string;
  user: string;
  signal?: AbortSignal;
}): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const chat = await postOpenAiCompatibleChat({
    baseUrl: args.target.baseUrl,
    apiKey: args.target.apiKey,
    model: args.target.upstreamModel,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    jsonMode: true,
    timeoutMs: 60_000,
    signal: args.signal,
  });
  return chat.ok ? { ok: true, content: chat.value.content } : { ok: false, error: chat.value.message };
}

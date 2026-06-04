/**
 * Dashboard-hosted ReasoningCoreContext for Knowledge Verify (Phase 6).
 */
import type { ReasoningCoreContext, ModelRoute } from "@restormel/reasoning-core";
import { listEnvironments } from "$lib/server/db";
import { resolveRouteForExecution } from "$lib/server/route-resolver";
import { findDecryptedApiKeyForResolvedProvider } from "$lib/server/runtime-invoke";
import {
  openAiCompatibleChatBaseUrl,
  postOpenAiCompatibleChat,
} from "$lib/server/runtime-openai-chat";
import { resolveVendorOpenAiChatModelId } from "$lib/server/runtime-model-upstream";

export type DashboardModelHandle = {
  providerType: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
};

async function resolveExecutionRoute(args: {
  projectId: string;
  userId: string;
  environmentId?: string;
  workload: string;
  stage: string;
}): Promise<
  | { ok: true; handle: DashboardModelHandle; route: ModelRoute }
  | { ok: false; code: string; message: string }
> {
  let environmentId = args.environmentId?.trim();
  if (!environmentId) {
    const envs = await listEnvironments(args.projectId, args.userId);
    environmentId = envs[0]?.id;
  }
  if (!environmentId) {
    return { ok: false, code: "no_environment", message: "No environment configured for project" };
  }

  const outcome = await resolveRouteForExecution(args.projectId, environmentId, args.userId, {
    workload: args.workload,
    stage: args.stage,
  });
  if (!outcome.ok) {
    return {
      ok: false,
      code: outcome.failure.code ?? "no_route",
      message: outcome.failure.message ?? "Route resolution failed",
    };
  }

  const resolved = outcome.result;
  const providerType = resolved.providerType ?? "";
  const modelId = resolved.modelId ?? "";
  if (!providerType || !modelId) {
    return { ok: false, code: "no_model", message: "Resolved route has no provider/model" };
  }

  const baseUrl = openAiCompatibleChatBaseUrl(providerType);
  if (!baseUrl) {
    return {
      ok: false,
      code: "unsupported_provider",
      message: `Provider ${providerType} is not OpenAI-compatible on hosted Knowledge Verify yet`,
    };
  }

  const keyOutcome = await findDecryptedApiKeyForResolvedProvider({
    projectId: args.projectId,
    workspaceId: resolved.workspaceId,
    resolvedCanonicalProvider: providerType,
  });
  if (!keyOutcome.ok) {
    return {
      ok: false,
      code: keyOutcome.code,
      message: "Provider credentials are not configured for this workspace",
    };
  }

  const upstreamModel = await resolveVendorOpenAiChatModelId(providerType, modelId);
  const handle: DashboardModelHandle = {
    providerType,
    modelId: upstreamModel,
    baseUrl,
    apiKey: keyOutcome.apiKey,
  };

  return {
    ok: true,
    handle,
    route: {
      model: handle,
      modelId,
      provider: providerType,
      resolvedRouteId: resolved.route.id ?? null,
      resolvedExplanation: resolved.explanation ?? null,
    },
  };
}

export function createDashboardReasoningContext(args: {
  projectId: string;
  userId: string;
  environmentId?: string;
}): ReasoningCoreContext {
  return {
    generateText: async ({ model, system, prompt, maxOutputTokens }) => {
      const handle = model as DashboardModelHandle;
      const chat = await postOpenAiCompatibleChat({
        baseUrl: handle.baseUrl,
        apiKey: handle.apiKey,
        model: handle.modelId,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        timeoutMs: 120_000,
      });
      if (!chat.ok) {
        throw new Error(chat.value.message);
      }
      return {
        text: chat.value.content,
        usage: {
          inputTokens: chat.value.usage.promptTokens,
          outputTokens: chat.value.usage.completionTokens,
        },
      };
    },
    resolveExtractionRoute: async () => {
      const resolved = await resolveExecutionRoute({
        ...args,
        workload: "verification",
        stage: "verification_extraction",
      });
      if (!resolved.ok) {
        throw new Error(`${resolved.code}: ${resolved.message}`);
      }
      return resolved.route;
    },
    resolveReasoningRoute: async () => {
      const resolved = await resolveExecutionRoute({
        ...args,
        workload: "verification",
        stage: "verification_reasoning",
      });
      if (!resolved.ok) {
        throw new Error(`${resolved.code}: ${resolved.message}`);
      }
      return resolved.route;
    },
  };
}

export async function probeDashboardVerifyReadiness(args: {
  projectId: string;
  userId: string;
  environmentId?: string;
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const extraction = await resolveExecutionRoute({
    ...args,
    workload: "verification",
    stage: "verification_extraction",
  });
  if (!extraction.ok) return extraction;
  return { ok: true };
}

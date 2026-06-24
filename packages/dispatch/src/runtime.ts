/**
 * Dispatch runtime helpers:
 * - resolves provider/model via `@restormel/keys` routing
 * - estimates cost via `keys.estimateCost`
 * - returns a DispatchResponse shape
 *
 * Note: Dispatch runtime helpers here do not call the upstream model directly.
 * Instead, they provide deterministic routing + cost and let the host provide
 * the final `output` (optionally via `generate` callback).
 */
import type { KeysInstance, ProviderId } from "@restormel/keys";
import type { DispatchRequest, DispatchResponse } from "./types.js";
import { isDispatchRequest } from "./validate.js";

export type DispatchGenerateOutput = (ctx: {
  request: DispatchRequest;
  provider: ProviderId;
  model: string;
  cost: number;
  routingReason: string;
}) => Promise<string> | string;

export interface ExecuteDispatchOptions {
  /**
   * Optional routing overrides for the runtime helper.
   * If provided, they will be reconciled with pricing-based provider selection.
   */
  providerId?: ProviderId;
  modelId?: string;

  /** Token volume hints (in millions) used for deterministic cost estimation. */
  inputTokensM?: number;
  outputTokensM?: number;

  /**
   * Optional callback for the host to produce the final `output`.
   * This keeps secrets out of the Dispatch package and avoids raw key logging.
   */
  generate?: DispatchGenerateOutput;

  /** Fallback output if `generate` is not provided. Default: `request.input`. */
  output?: string;

  /**
   * For `task: "embedding"`, supply the numeric vector. `output` defaults to `JSON.stringify(embedding)` unless
   * `generate` / `output` override it.
   */
  embedding?: number[];
}

function nonNegativeNumber(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  return value;
}

function pickTokensM(req: DispatchRequest, opts: ExecuteDispatchOptions) {
  const input =
    nonNegativeNumber(opts.inputTokensM) ??
    nonNegativeNumber(req.constraints?.tokens?.inputTokensM) ??
    1;
  const output =
    nonNegativeNumber(opts.outputTokensM) ??
    nonNegativeNumber(req.constraints?.tokens?.outputTokensM) ??
    1;
  return { inputTokensM: input, outputTokensM: output };
}

function buildRoutingReason(params: {
  provider: ProviderId;
  model: string;
  source: "byok" | "platform";
  providerHint?: ProviderId | undefined;
  providerFromPricing?: ProviderId | undefined;
  latency?: "low" | "balanced" | "high";
}) {
  const parts: string[] = [];
  parts.push(`Resolved ${params.provider}/${params.model}`);
  parts.push(params.source === "byok" ? "using BYOK key" : "using platform key");
  if (params.providerHint && params.providerFromPricing && params.providerHint !== params.providerFromPricing) {
    parts.push(`provider hint ignored; pricing selected ${params.providerFromPricing}`);
  }
  if (params.latency) parts.push(`latency=${params.latency}`);
  return parts.join(" · ");
}

export async function executeDispatchRequest(
  request: DispatchRequest,
  keys: KeysInstance,
  options: ExecuteDispatchOptions = {},
): Promise<DispatchResponse> {
  if (!isDispatchRequest(request)) {
    throw new Error("invalid_dispatch_request");
  }

  const modelId =
    options.modelId?.trim() ||
    request.routing?.model?.trim() ||
    keys.getAllModelIds()?.[0] ||
    null;

  if (!modelId) throw new Error("no_models_configured");

  const pricing = keys.estimateCost(modelId);
  if (!pricing) throw new Error("unknown_model_for_pricing");

  const providerFromPricing = (pricing.providerId ?? "") as ProviderId;
  const providerHint = options.providerId?.trim() || request.routing?.provider?.trim();
  const provider: ProviderId = (providerHint as ProviderId) || providerFromPricing;

  // If a provider hint is specified and contradicts pricing provider selection,
  // we reconcile by using pricing provider to keep routing/pricing consistent.
  const finalProvider: ProviderId = provider === providerFromPricing ? provider : providerFromPricing;

  const resolved = await keys.resolve(finalProvider, modelId);

  const { inputTokensM, outputTokensM } = pickTokensM(request, options);

  const inputPerMillion = pricing.inputPerMillion ?? 0;
  const outputPerMillion = pricing.outputPerMillion ?? 0;
  const unit = pricing.unit ?? "USD";
  const inputCost = inputPerMillion * inputTokensM;
  const outputCost = outputPerMillion * outputTokensM;
  const totalCost = inputCost + outputCost;

  if (typeof request.constraints?.maxCost === "number" && totalCost > request.constraints.maxCost) {
    throw new Error(
      `max_cost_exceeded (maxCost=${request.constraints.maxCost} ${unit}; estimated=${totalCost} ${unit})`,
    );
  }

  const reason = buildRoutingReason({
    provider: finalProvider,
    model: modelId,
    source: resolved.source,
    providerHint: providerHint ? (providerHint as ProviderId) : undefined,
    providerFromPricing,
    latency: request.constraints?.latency,
  });

  const task = request.task ?? "chat";

  const rawOutput =
    options.generate
      ? await options.generate({
          request,
          provider: finalProvider,
          model: modelId,
          cost: totalCost,
          routingReason: reason,
        })
      : options.output ?? request.input;

  let output = rawOutput;
  const embedding =
    task === "embedding" && Array.isArray(options.embedding) && options.embedding.length > 0
      ? options.embedding
      : undefined;

  if (embedding) {
    if (options.output !== undefined) {
      output = options.output;
    } else if (options.generate) {
      output = rawOutput;
    } else {
      output = JSON.stringify(embedding);
    }
  }

  const outputText = task === "embedding" ? undefined : output;

  const response: DispatchResponse = {
    output,
    ...(embedding ? { embedding } : {}),
    ...(outputText !== undefined ? { outputText } : {}),
    provider: finalProvider,
    model: modelId,
    cost: totalCost,
    routing: { reason },
  };

  return response;
}


/**
 * Map catalog `modelId` → vendor `model` for OpenAI-compatible upstream calls when they differ.
 * Together, OpenRouter, AiZolo, etc. often use different upstream strings than catalog ids.
 */
import { listProviderModelVariants } from "$lib/server/db";
import {
  TOGETHER_GATEWAY_EMBEDDING_MODEL_ID,
  TOGETHER_GATEWAY_EMBEDDING_UPSTREAM,
  togetherUpstreamModelId,
} from "$lib/server/connect/together-ingest-gateway";

export async function resolveVendorOpenAiChatModelId(
  canonicalProvider: string,
  catalogModelId: string,
): Promise<string> {
  const k = canonicalProvider.trim().toLowerCase();
  const mid = catalogModelId.trim();

  if (mid === TOGETHER_GATEWAY_EMBEDDING_MODEL_ID) {
    return TOGETHER_GATEWAY_EMBEDDING_UPSTREAM;
  }

  const variants = await listProviderModelVariants(mid);
  const hit = variants.find((v) => (v.catalogProviderId ?? v.providerIntegrationType).toLowerCase() === k);
  const vendor = hit?.providerModelId?.trim();
  if (vendor) return vendor;

  if (k === "together") {
    return togetherUpstreamModelId(mid) ?? mid;
  }

  return mid;
}

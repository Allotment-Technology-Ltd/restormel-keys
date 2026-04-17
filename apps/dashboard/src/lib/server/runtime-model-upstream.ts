/**
 * Map catalog `modelId` → vendor `model` for OpenAI-compatible upstream calls when they differ.
 */
import { listProviderModelVariants } from "$lib/server/db";

export async function resolveVendorOpenAiChatModelId(
  canonicalProvider: string,
  catalogModelId: string,
): Promise<string> {
  const k = canonicalProvider.trim().toLowerCase();
  if (k !== "aizolo") return catalogModelId;
  const variants = await listProviderModelVariants(catalogModelId);
  const hit = variants.find((v) => (v.catalogProviderId ?? v.providerIntegrationType).toLowerCase() === "aizolo");
  const vendor = hit?.providerModelId?.trim();
  return vendor || catalogModelId;
}

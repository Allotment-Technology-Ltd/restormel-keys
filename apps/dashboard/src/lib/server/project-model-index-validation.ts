/**
 * Validate (providerType, modelId) for project model index mutations against catalog + canonical providers.
 */
import {
  CANONICAL_PROVIDER_TYPES,
  canonicalApiToPolicyProvider,
  normalizeProviderToCanonicalApi,
} from "$lib/server/canonical-provider";
import { getModel, listProviderModelVariants } from "$lib/server/db";

const CANONICAL_SET = new Set<string>(CANONICAL_PROVIDER_TYPES);

export type ProjectModelIndexValidationError = {
  code: string;
  detail: string;
};

export async function validateProjectModelBindingPair(
  providerRaw: unknown,
  modelIdRaw: unknown
): Promise<
  | { ok: true; canonicalProvider: string; modelId: string }
  | { ok: false; error: ProjectModelIndexValidationError }
> {
  const modelId = typeof modelIdRaw === "string" ? modelIdRaw.trim() : "";
  if (!modelId) {
    return { ok: false, error: { code: "validation_failed", detail: "modelId is required" } };
  }
  if (typeof providerRaw !== "string" || !providerRaw.trim()) {
    return { ok: false, error: { code: "validation_failed", detail: "providerType is required" } };
  }
  const canonical = normalizeProviderToCanonicalApi(providerRaw);
  if (!canonical || !CANONICAL_SET.has(canonical)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        detail: `Unknown providerType; use canonical values: ${CANONICAL_PROVIDER_TYPES.join(", ")} (aliases: google, vertex → vertex)`,
      },
    };
  }
  const model = await getModel(modelId);
  if (!model) {
    return { ok: false, error: { code: "unknown_model", detail: `Unknown model id: ${modelId}` } };
  }
  const policyPt = canonicalApiToPolicyProvider(canonical) ?? canonical;
  const variants = await listProviderModelVariants(modelId);
  if (variants.length > 0) {
    const match = variants.some((v) => v.providerIntegrationType === policyPt);
    if (!match) {
      return {
        ok: false,
        error: {
          code: "provider_model_mismatch",
          detail: `Model ${modelId} has no catalog variant for provider integration type ${policyPt}`,
        },
      };
    }
  }
  return { ok: true, canonicalProvider: canonical, modelId };
}

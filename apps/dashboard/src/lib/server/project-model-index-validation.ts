/**
 * Validate (providerType, modelId) for project model index mutations against catalog + canonical providers.
 * `execution`: strict Keys catalog + canonical providers. `registry`: host merge metadata (length/sanity only).
 */
import {
  CANONICAL_PROVIDER_TYPES,
  canonicalApiToPolicyProvider,
  normalizeProviderToCanonicalApi,
} from "$lib/server/canonical-provider";
import { isViableCatalogModel, isViableCatalogVariantAvailability } from "$lib/server/catalog-viability";
import { getModel, listProviderModelVariants } from "$lib/server/db";
import type { ProjectModelBindingKind } from "$lib/server/neon";

const CANONICAL_SET = new Set<string>(CANONICAL_PROVIDER_TYPES);

/** Max lengths for `bindingKind: registry` rows (arbitrary strings, no catalog FK). */
export const REGISTRY_PROVIDER_MAX_LEN = 128;
export const REGISTRY_MODEL_ID_MAX_LEN = 512;

export type ProjectModelIndexValidationError = {
  code: string;
  detail: string;
};

function hasDisallowedControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 32) return true;
  }
  return false;
}

/**
 * Normalize registry provider for storage (lowercase slug; does not map to canonical execution set).
 */
function normalizeRegistryProvider(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

export function validateRegistryBinding(
  providerRaw: unknown,
  modelIdRaw: unknown
):
  | { ok: true; providerType: string; modelId: string }
  | { ok: false; error: ProjectModelIndexValidationError } {
  if (typeof providerRaw !== "string" || !String(providerRaw).trim()) {
    return { ok: false, error: { code: "validation_failed", detail: "providerType is required" } };
  }
  const modelId = typeof modelIdRaw === "string" ? modelIdRaw.trim() : "";
  if (!modelId) {
    return { ok: false, error: { code: "validation_failed", detail: "modelId is required" } };
  }
  const providerType = normalizeRegistryProvider(providerRaw);
  if (!providerType) {
    return { ok: false, error: { code: "validation_failed", detail: "providerType is required" } };
  }
  if (providerType.length > REGISTRY_PROVIDER_MAX_LEN) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        detail: `providerType must be at most ${REGISTRY_PROVIDER_MAX_LEN} characters`,
      },
    };
  }
  if (modelId.length > REGISTRY_MODEL_ID_MAX_LEN) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        detail: `modelId must be at most ${REGISTRY_MODEL_ID_MAX_LEN} characters`,
      },
    };
  }
  if (hasDisallowedControlChars(providerType) || hasDisallowedControlChars(modelId)) {
    return {
      ok: false,
      error: { code: "validation_failed", detail: "providerType and modelId must not contain control characters" },
    };
  }
  return { ok: true, providerType, modelId };
}

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
        detail: `Unknown providerType; use canonical values: ${CANONICAL_PROVIDER_TYPES.join(", ")} (aliases: google, vertex → vertex), or bindingKind \"registry\" for other providers`,
      },
    };
  }
  const model = await getModel(modelId);
  if (!model) {
    return { ok: false, error: { code: "unknown_model", detail: `Unknown model id: ${modelId}` } };
  }
  if (!isViableCatalogModel(model)) {
    return {
      ok: false,
      error: {
        code: "model_unavailable",
        detail: `Catalog model ${modelId} is deprecated, retired, or past its documented retirement date.`,
      },
    };
  }
  const policyPt = canonicalApiToPolicyProvider(canonical) ?? canonical;
  const variants = await listProviderModelVariants(modelId);
  if (variants.length > 0) {
    const match = variants.find((v) => v.providerIntegrationType === policyPt);
    if (!match) {
      return {
        ok: false,
        error: {
          code: "provider_model_mismatch",
          detail: `Model ${modelId} has no catalog variant for provider integration type ${policyPt}`,
        },
      };
    }
    if (!isViableCatalogVariantAvailability(match.availabilityStatus)) {
      return {
        ok: false,
        error: {
          code: "variant_unavailable",
          detail: `Catalog variant for ${modelId} on ${policyPt} is not available (retired or unavailable at the provider).`,
        },
      };
    }
  }
  return { ok: true, canonicalProvider: canonical, modelId };
}

export function parseBindingKind(raw: unknown): ProjectModelBindingKind {
  return raw === "registry" ? "registry" : "execution";
}

export async function validateProjectModelBindingRow(
  kind: ProjectModelBindingKind,
  providerRaw: unknown,
  modelIdRaw: unknown
): Promise<
  | { ok: true; canonicalProvider: string; modelId: string; bindingKind: ProjectModelBindingKind }
  | { ok: false; error: ProjectModelIndexValidationError }
> {
  if (kind === "registry") {
    const r = validateRegistryBinding(providerRaw, modelIdRaw);
    if (!r.ok) return r;
    return {
      ok: true,
      canonicalProvider: r.providerType,
      modelId: r.modelId,
      bindingKind: "registry",
    };
  }
  const e = await validateProjectModelBindingPair(providerRaw, modelIdRaw);
  if (!e.ok) return e;
  return { ok: true, canonicalProvider: e.canonicalProvider, modelId: e.modelId, bindingKind: "execution" };
}

/** Map validation error to a request field hint for `errors[].field`. */
export function validationErrorField(code: string, detail: string): "modelId" | "providerType" {
  if (
    code === "unknown_model" ||
    code === "provider_model_mismatch" ||
    code === "model_unavailable" ||
    code === "variant_unavailable"
  )
    return "modelId";
  if (code === "validation_failed") {
    if (detail.includes("modelId")) return "modelId";
    if (detail.includes("providerType")) return "providerType";
  }
  return "providerType";
}

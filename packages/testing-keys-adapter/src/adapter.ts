import type { KeysModelAdapterOptions, KeysAdapterError, ModelResolutionResult, ResolvedModel } from "./types.js";
import { keysHttpBearerFromProcessEnv } from "./env-from-process.js";
import { createHttpKeysTransport } from "./transport-http.js";
import { readSecretFromEnv } from "./materialize.js";

const REF_PREFIX = "ref:restormel-keys:";

function isValidLogicalRef(ref: string): boolean {
  if (typeof ref !== "string" || ref.length === 0 || ref.length > 512) return false;
  if (ref.startsWith(REF_PREFIX) && ref.length > REF_PREFIX.length) return true;
  return false;
}

function fail(code: KeysAdapterError["code"], message: string, cause?: unknown): ModelResolutionResult {
  return { ok: false, error: { code, message, cause } };
}

function buildResolved(
  logicalRef: string,
  provider: string,
  model: string,
  modelId: string,
  apiKey: string,
  source: ResolvedModel["meta"]["resolutionSource"],
  providerBaseUrl?: string,
): ResolvedModel {
  return {
    meta: {
      logicalRef,
      provider,
      model,
      resolutionSource: source,
      invocationCount: 0,
    },
    modelId,
    providerBaseUrl,
    credentials: { apiKey },
  };
}

/**
 * Resolve a single logical model ref for test execution. Keys first; optional OpenAI env fallback.
 */
export async function resolveModel(
  logicalRef: string,
  options: KeysModelAdapterOptions = {},
): Promise<ModelResolutionResult> {
  const warnings: string[] = [];

  if (!isValidLogicalRef(logicalRef)) {
    return fail("invalid_ref", `Expected logical ref "${REF_PREFIX}…", got ${JSON.stringify(logicalRef)}`);
  }

  const transport =
    options.transport ??
    (options.keysApiBaseUrl
      ? createHttpKeysTransport({
          baseUrl: options.keysApiBaseUrl,
          getKeysApiToken: () => keysHttpBearerFromProcessEnv(options.keysApiTokenEnvVar),
        })
      : undefined);

  if (transport) {
    const tr = await transport.resolve(logicalRef);
    if (tr.ok) {
      if (tr.inlineApiKey !== undefined && tr.inlineApiKey !== "") {
        return {
          ok: true,
          warnings,
          model: buildResolved(
            logicalRef,
            tr.provider,
            tr.model,
            tr.model,
            tr.inlineApiKey,
            "keys",
            tr.baseUrl,
          ),
        };
      }
      const mat = readSecretFromEnv(tr.secretEnvVar);
      if (!mat.ok) {
        return fail("keys_missing_secret_binding", `Keys resolved model but ${mat.message}`);
      }
      return {
        ok: true,
        warnings,
        model: buildResolved(
          logicalRef,
          tr.provider,
          tr.model,
          tr.model,
          mat.apiKey,
          "keys",
          tr.baseUrl,
        ),
      };
    }
    warnings.push(
      `Keys resolution failed (${tr.code}): ${tr.message}. ${
        options.openAiEnvFallback?.enabled ? "Attempting documented env fallback." : "No fallback configured."
      }`,
    );
  } else {
    warnings.push(
      "Keys transport not configured (no transport and no keysApiBaseUrl). BYOK should flow through Restormel / Keys when available.",
    );
  }

  const fb = options.openAiEnvFallback;
  if (!fb?.enabled) {
    if (!transport) {
      return fail(
        "keys_not_configured",
        "Configure Keys (keysApiBaseUrl or transport) or enable openAiEnvFallback for the documented non-Keys escape hatch.",
      );
    }
    return fail("fallback_disabled", "Keys resolution failed and OpenAI env fallback is disabled.");
  }

  if (fb.forLogicalRef !== undefined && fb.forLogicalRef !== logicalRef) {
    return fail("fallback_disabled", `Env fallback is restricted to ref ${fb.forLogicalRef}; got ${logicalRef}`);
  }

  const apiKeyVar = fb.apiKeyEnvVar ?? "OPENAI_API_KEY";
  const key = process.env[apiKeyVar];
  if (key === undefined || key === "") {
    return fail("fallback_missing_env", `Fallback enabled but ${apiKeyVar} is unset or empty.`);
  }

  const modelId = fb.defaultModel ?? "gpt-4o-mini";
  const baseUrl = fb.baseUrl;

  warnings.push(
    `RESTORMEL_TESTING_KEYS_FALLBACK: using ${apiKeyVar} for OpenAI-compatible calls. Prefer Restormel / Keys for BYOK and auditability.`,
  );

  return {
    ok: true,
    warnings,
    model: buildResolved(logicalRef, "openai", modelId, modelId, key, "env_fallback", baseUrl),
  };
}

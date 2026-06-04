/**
 * Field-level validation before publishing a route (executable steps for resolve).
 */
import type { RouteRecord, RouteStepRecord } from "$lib/server/db";
import {
  isExecutableProviderModelPair,
  normalizeProviderToCanonicalApi,
} from "$lib/server/canonical-provider";

export type RoutePublishFieldError = {
  stepId?: string;
  orderIndex?: number;
  field: string;
  message: string;
};

export function validateRouteStepsForPublish(
  route: RouteRecord,
  steps: RouteStepRecord[]
): RoutePublishFieldError[] {
  const errors: RoutePublishFieldError[] = [];
  const enabled = steps.filter((s) => s.enabled).sort((a, b) => a.orderIndex - b.orderIndex);

  if (enabled.length === 0) {
    errors.push({
      field: "steps",
      message: "At least one enabled step is required before publish.",
    });
    return errors;
  }

  for (const s of enabled) {
    const modelId = s.modelId ?? route.defaultModelId ?? null;
    const exec = isExecutableProviderModelPair(s.providerPreference, modelId);
    if (!exec.ok) {
      if (exec.reason === "missing_or_unknown_provider") {
        errors.push({
          stepId: s.id,
          orderIndex: s.orderIndex,
          field: "providerPreference",
          message:
            "Unknown or empty provider. Use openai, anthropic, google, mistral, together, voyage, openrouter, vercel, portkey, or aizolo.",
        });
      } else {
        errors.push({
          stepId: s.id,
          orderIndex: s.orderIndex,
          field: "modelId",
          message: "Model id is required on the step or set route defaultModelId.",
        });
      }
      continue;
    }
    const canonical = normalizeProviderToCanonicalApi(s.providerPreference);
    if (!canonical) {
      errors.push({
        stepId: s.id,
        orderIndex: s.orderIndex,
        field: "providerPreference",
        message: "Provider could not be normalized to a canonical API type.",
      });
    }
  }

  return errors;
}

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { deleteRouteStep, getModel, getRoute, listRouteSteps, updateRouteStep } from "$lib/server/db";

const PROVIDER_TYPES = new Set(["openai", "anthropic", "google", "openrouter", "vercel", "portkey"]);
const FALLBACK_ON = new Set(["error", "rate_limit", "no_key", "policy_block", "any"]);

function projectScope(locals: App.Locals, projectId: string): { projectId: string; userId: string } | null {
  if (!locals.user) return null;
  if (locals.user.authType === "gateway_key" && locals.user.projectIdForKey !== projectId) return null;
  return { projectId, userId: locals.user.uid };
}

function invalid(detail: string) {
  return json({ error: "invalid_step_schema", detail }, { status: 400 });
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = projectScope(locals, params.id);
  if (!scope) return json({ error: "forbidden" }, { status: 403 });

  const route = await getRoute(params.routeId, scope.projectId, scope.userId);
  if (!route) return json({ error: "route_not_found" }, { status: 404 });

  let body: {
    orderIndex?: number;
    providerPreference?: string | null;
    modelId?: string | null;
    conditionBlock?: Record<string, unknown> | null;
    fallbackOn?: string | null;
    timeoutMs?: number | null;
    enabled?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.orderIndex !== undefined) {
    if (typeof body.orderIndex !== "number" || !Number.isFinite(body.orderIndex) || !Number.isInteger(body.orderIndex) || body.orderIndex < 0) {
      return invalid("orderIndex must be an integer >= 0");
    }
    const existing = await listRouteSteps(params.routeId, scope.projectId, scope.userId);
    if (existing.some((s) => s.id !== params.stepId && s.orderIndex === body.orderIndex)) {
      return json({ error: "duplicate_order_index" }, { status: 409 });
    }
  }

  if (body.providerPreference !== undefined) {
    if (body.providerPreference !== null && typeof body.providerPreference !== "string") {
      return invalid("providerPreference must be a string or null");
    }
    if (typeof body.providerPreference === "string" && !PROVIDER_TYPES.has(body.providerPreference)) {
      return invalid(`providerPreference must be one of: ${Array.from(PROVIDER_TYPES).join(", ")}`);
    }
  }

  if (body.fallbackOn !== undefined) {
    if (body.fallbackOn !== null && typeof body.fallbackOn !== "string") return invalid("fallbackOn must be a string or null");
    if (typeof body.fallbackOn === "string" && !FALLBACK_ON.has(body.fallbackOn)) {
      return invalid(`fallbackOn must be one of: ${Array.from(FALLBACK_ON).join(", ")}`);
    }
  }

  if (body.modelId !== undefined && body.modelId !== null) {
    if (typeof body.modelId !== "string") return invalid("modelId must be a string or null");
    const model = await getModel(body.modelId.trim());
    if (!model) return invalid("modelId must be a known model ID from the model catalog");
  }

  const step = await updateRouteStep(
    params.stepId,
    params.routeId,
    scope.projectId,
    scope.userId,
    body
  );
  if (!step) return json({ error: "route_not_found" }, { status: 404 });
  return json({ data: step });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = projectScope(locals, params.id);
  if (!scope) return json({ error: "forbidden" }, { status: 403 });
  const route = await getRoute(params.routeId, scope.projectId, scope.userId);
  if (!route) return json({ error: "route_not_found" }, { status: 404 });
  const ok = await deleteRouteStep(params.stepId, params.routeId, scope.projectId, scope.userId);
  if (!ok) return json({ error: "route_not_found" }, { status: 404 });
  return json({ ok: true });
};

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createRouteStep, getModel, getRoute, listRouteSteps } from "$lib/server/db";

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

/** GET: list steps for route (ordered by orderIndex). */
export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = projectScope(locals, params.id);
  if (!scope) return json({ error: "forbidden" }, { status: 403 });

  const route = await getRoute(params.routeId, scope.projectId, scope.userId);
  if (!route) return json({ error: "route_not_found" }, { status: 404 });

  const steps = await listRouteSteps(params.routeId, scope.projectId, scope.userId);
  return json({ data: steps });
};

/** POST: create step. Body: orderIndex, providerPreference?, modelId?, conditionBlock?, fallbackOn?, timeoutMs?, enabled?. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
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

  const orderIndex = typeof body.orderIndex === "number" && Number.isFinite(body.orderIndex) ? body.orderIndex : 0;
  if (!Number.isInteger(orderIndex) || orderIndex < 0) return invalid("orderIndex must be an integer >= 0");

  const providerPreference = body.providerPreference ?? null;
  if (providerPreference !== null && typeof providerPreference !== "string") {
    return invalid("providerPreference must be a string or null");
  }
  if (typeof providerPreference === "string" && !PROVIDER_TYPES.has(providerPreference)) {
    return invalid(`providerPreference must be one of: ${Array.from(PROVIDER_TYPES).join(", ")}`);
  }

  const modelId = body.modelId ?? null;
  if (modelId !== null && typeof modelId !== "string") return invalid("modelId must be a string or null");
  if (typeof modelId === "string" && modelId.trim() !== "") {
    const model = await getModel(modelId.trim());
    if (!model) return invalid("modelId must be a known model ID from the model catalog");
  }

  const fallbackOn = body.fallbackOn ?? "error";
  if (fallbackOn !== null && typeof fallbackOn !== "string") return invalid("fallbackOn must be a string or null");
  if (typeof fallbackOn === "string" && !FALLBACK_ON.has(fallbackOn)) {
    return invalid(`fallbackOn must be one of: ${Array.from(FALLBACK_ON).join(", ")}`);
  }

  const existing = await listRouteSteps(params.routeId, scope.projectId, scope.userId);
  if (existing.some((s) => s.orderIndex === orderIndex)) {
    return json({ error: "duplicate_order_index" }, { status: 409 });
  }

  const step = await createRouteStep({
    routeId: params.routeId,
    projectId: scope.projectId,
    userId: scope.userId,
    orderIndex,
    providerPreference,
    modelId,
    conditionBlock: body.conditionBlock ?? undefined,
    fallbackOn,
    timeoutMs: body.timeoutMs ?? undefined,
    enabled: body.enabled,
  });
  if (!step) return json({ error: "route_not_found" }, { status: 404 });
  return json({ data: step }, { status: 201 });
};

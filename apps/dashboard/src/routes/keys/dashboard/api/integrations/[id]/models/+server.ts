import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { getProviderIntegration, listUsageAggregates } from "$lib/server/db";

/**
 * GET: discovered model metadata for this integration.
 *
 * v1 implementation: infer models from ingested usage_aggregates for the workspace/providerType.
 * This provides a minimal “model discovery” path for gateway-backed imports (OpenRouter activity, etc.).
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const integration = await getProviderIntegration(params.id, ctx.workspaceId);
  if (!integration) return json({ error: "Not found" }, { status: 404 });
  try {
    // Pull a bounded window of aggregates and infer unique model IDs.
    const data = await listUsageAggregates(ctx.workspaceId, {
      limit: 500,
      providerType: integration.providerType,
    });
    const models = Array.from(
      new Set(
        data
          .map((r) => r.modelId)
          .filter((m): m is string => typeof m === "string" && m.trim() !== "")
      )
    )
      .slice(0, 200)
      .map((modelId) => ({ modelId }));
    return json({ data: models });
  } catch (e) {
    console.error("[integrations/[id]/models] failed:", e);
    return json({ error: "Failed to load discovered models" }, { status: 500 });
  }
};

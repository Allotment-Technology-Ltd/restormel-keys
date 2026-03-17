import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { getProviderIntegration, insertUsageAggregate } from "$lib/server/db";
import { openRouterActivityToAggregates, parseOpenRouterActivityJson } from "$lib/server/import/openrouter-activity";

/**
 * Import OpenRouter activity export or API JSON into usage_aggregates.
 *
 * Input:
 * - JSON body: { data: [...] } in OpenRouter /activity schema, OR
 * - multipart/form-data with a file field named "file" containing JSON (same shape)
 *
 * Notes:
 * - This importer stores aggregates only (no request-level logs).
 * - No raw gateway/provider secrets are accepted here.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });

  const integration = await getProviderIntegration(params.id, ctx.workspaceId);
  if (!integration) return json({ error: "Not found" }, { status: 404 });

  let payload: unknown;
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return json({ error: "Missing file" }, { status: 400 });
      const text = await file.text();
      payload = JSON.parse(text);
    } else {
      payload = await request.json();
    }
  } catch {
    return json({ error: "Invalid input (expected JSON or multipart file)" }, { status: 400 });
  }

  let rows;
  try {
    rows = parseOpenRouterActivityJson(payload);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Invalid OpenRouter activity JSON" }, { status: 400 });
  }

  const aggregates = openRouterActivityToAggregates(rows);
  const maxRows = 2000;
  if (aggregates.length > maxRows) {
    return json({ error: `Too many rows (${aggregates.length}). Limit is ${maxRows}.` }, { status: 400 });
  }

  try {
    for (const a of aggregates) {
      await insertUsageAggregate({
        granularity: a.granularity,
        periodStart: a.periodStart,
        periodEnd: a.periodEnd,
        workspaceId: ctx.workspaceId,
        projectId: null,
        environmentId: null,
        routeId: null,
        gatewayKeyId: null,
        providerType: a.providerType,
        modelId: a.modelId,
        requestCount: a.requestCount,
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        cachedTokens: 0,
        estimatedCost: a.estimatedCost,
        avgLatencyMs: null,
        errorRate: null,
        fallbackRate: null,
      });
    }
  } catch (e) {
    console.error("[integrations/import/openrouter-activity] insertUsageAggregate failed:", e);
    return json({ error: "Failed to import aggregates" }, { status: 500 });
  }

  return json({
    ok: true,
    data: {
      integrationId: integration.id,
      importedRows: aggregates.length,
      granularity: "day",
    },
  });
};


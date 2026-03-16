/**
 * GET: List usage aggregates for the current workspace, or aggregate from request_logs on the fly.
 * Query: limit, periodStart, periodEnd, projectId, routeId, providerType, modelId, gatewayKeyId, granularity.
 * If source=request_logs and since/until are set, returns on-the-fly aggregation from request_logs (for when pre-aggregated table is empty).
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { listUsageAggregates, aggregateRequestLogsToUsage } from "$lib/server/db";

export const GET: RequestHandler = async ({ url, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });

  const source = url.searchParams.get("source")?.toLowerCase();
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");

  if (source === "request_logs" && since && until) {
    const sinceNum = parseInt(since, 10);
    const untilNum = parseInt(until, 10);
    if (Number.isNaN(sinceNum) || Number.isNaN(untilNum) || sinceNum >= untilNum) {
      return json({ error: "Invalid since/until for source=request_logs" }, { status: 400 });
    }
    const projectId = url.searchParams.get("projectId")?.trim() || undefined;
    try {
      const data = await aggregateRequestLogsToUsage(ctx.workspaceId, {
        since: sinceNum,
        until: untilNum,
        projectId,
      });
      return json({ data, source: "request_logs" });
    } catch (e) {
      console.error("[usage-aggregates] aggregateRequestLogsToUsage failed:", e);
      return json({ error: "Failed to aggregate usage" }, { status: 500 });
    }
  }

  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10) || 100));
  const periodStart = url.searchParams.get("periodStart");
  const periodEnd = url.searchParams.get("periodEnd");
  const projectId = url.searchParams.get("projectId")?.trim() || undefined;
  const routeId = url.searchParams.get("routeId")?.trim() || undefined;
  const providerType = url.searchParams.get("providerType")?.trim() || undefined;
  const modelId = url.searchParams.get("modelId")?.trim() || undefined;
  const gatewayKeyId = url.searchParams.get("gatewayKeyId")?.trim() || undefined;
  const granularity = url.searchParams.get("granularity")?.trim() || undefined;

  const periodStartNum = periodStart ? parseInt(periodStart, 10) : undefined;
  const periodEndNum = periodEnd ? parseInt(periodEnd, 10) : undefined;

  try {
    const data = await listUsageAggregates(ctx.workspaceId, {
      limit,
      periodStart: periodStartNum,
      periodEnd: periodEndNum,
      projectId,
      routeId,
      providerType,
      modelId,
      gatewayKeyId,
      granularity,
    });
    return json({ data });
  } catch (e) {
    console.error("[usage-aggregates] listUsageAggregates failed:", e);
    return json({ error: "Failed to load usage aggregates" }, { status: 500 });
  }
};

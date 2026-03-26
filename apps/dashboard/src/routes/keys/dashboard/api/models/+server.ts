import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { listModels } from "$lib/server/db";

/** GET: list models (catalog). Query: lifecycleState, family, limit, offset, includeUnhealthy. Public read. */
export const GET: RequestHandler = async ({ url }) => {
  const lifecycleState = url.searchParams.get("lifecycleState")?.trim() || undefined;
  const family = url.searchParams.get("family")?.trim() || undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam != null ? Math.min(Math.max(1, parseInt(limitParam, 10) || 100), 500) : 100;
  const offsetParam = url.searchParams.get("offset");
  const offset = offsetParam != null ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;
  const includeUnhealthy =
    url.searchParams.get("includeUnhealthy") === "1" ||
    url.searchParams.get("includeUnhealthy")?.toLowerCase() === "true";
  const data = await listModels({ lifecycleState, family, limit, offset, includeUnhealthy });
  return json({ data });
};

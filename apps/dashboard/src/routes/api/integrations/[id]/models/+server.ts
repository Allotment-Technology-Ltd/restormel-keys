import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { getProviderIntegration } from "$lib/server/db";

/** GET: discovered model metadata for this integration. Placeholder; returns empty array until provider-specific discovery is wired. */
export const GET: RequestHandler = async ({ params, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const integration = await getProviderIntegration(params.id, ctx.workspaceId);
  if (!integration) return json({ error: "Not found" }, { status: 404 });
  return json({ data: [] });
};

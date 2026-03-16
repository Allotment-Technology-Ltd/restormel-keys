import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { getProviderIntegration, updateProviderVerification } from "$lib/server/db";

/** POST: run verification hook (placeholder; sets status + lastVerifiedAt). Provider-specific logic can be added in a separate module. */
export const POST: RequestHandler = async ({ params, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return json({ error: "Unauthorized" }, { status: 401 });
  const integration = await getProviderIntegration(params.id, ctx.workspaceId);
  if (!integration) return json({ error: "Not found" }, { status: 404 });
  const updated = await updateProviderVerification(
    params.id,
    ctx.workspaceId,
    "pending",
    ctx.actorId,
    ctx.actorType
  );
  if (!updated) return json({ error: "Not found" }, { status: 404 });
  return json({
    data: {
      verificationStatus: updated.verificationStatus,
      lastVerifiedAt: updated.lastVerifiedAt,
    },
  });
};

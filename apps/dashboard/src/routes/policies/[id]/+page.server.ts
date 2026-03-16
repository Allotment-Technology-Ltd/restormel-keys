import type { PageServerLoad } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { getPolicy, listPolicyBindings } from "$lib/server/db";

export const load: PageServerLoad = async ({ params, locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return { policy: null, bindings: [], error: "Unauthorized" };
  try {
    const policy = await getPolicy(params.id, ctx.workspaceId);
    if (!policy) return { policy: null, bindings: [], error: "Not found" };
    const bindings = await listPolicyBindings(params.id, ctx.workspaceId);
    return { policy, bindings, error: null };
  } catch (e) {
    console.error("[policies/[id]] load failed:", e);
    return { policy: null, bindings: [], error: "Unable to load policy" };
  }
};

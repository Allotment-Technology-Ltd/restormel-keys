import type { PageServerLoad } from "./$types";
import { getWorkspaceAndActor } from "$lib/server/integrations-auth";
import { listPolicies } from "$lib/server/db";

export const load: PageServerLoad = async ({ locals }) => {
  const ctx = await getWorkspaceAndActor(locals);
  if (!ctx) return { policies: [], error: null as string | null };
  try {
    const policies = await listPolicies(ctx.workspaceId);
    return { policies, error: null };
  } catch (e) {
    console.error("[policies] load failed:", e);
    return { policies: [], error: "Unable to load policies" };
  }
};

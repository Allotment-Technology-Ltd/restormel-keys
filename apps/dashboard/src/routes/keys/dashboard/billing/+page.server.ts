import type { PageServerLoad } from "./$types";
import { getWorkspaceEntitlements } from "$lib/server/entitlements";

export const load: PageServerLoad = async ({ locals }) => {
  const entitlements = await getWorkspaceEntitlements(locals);
  return {
    entitlements,
    invoices: [],
  };
};

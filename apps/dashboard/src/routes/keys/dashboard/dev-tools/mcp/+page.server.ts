/**
 * R5: /dev-tools/mcp → /agents/catalogs (MERGE-INTO per ux-contracts §A).
 * W2.4's generated MCP catalog now mounts at Agents / Catalogs tab.
 */
import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

export const load: PageServerLoad = ({ url }) => {
  const search = url.search && url.search !== "?" ? url.search : "";
  throw redirect(308, DASHBOARD_BASE + "/agents/catalogs" + search);
};

/**
 * R5: /dev-tools → /agents/catalogs (MERGE-INTO per ux-contracts §A).
 * CLI & agents was always consumption-wiring; W2.4's MCP catalog mounts at Agents/Catalogs.
 */
import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

export const load: PageServerLoad = ({ url }) => {
  const search = url.search && url.search !== "?" ? url.search : "";
  throw redirect(308, DASHBOARD_BASE + "/agents/catalogs" + search);
};

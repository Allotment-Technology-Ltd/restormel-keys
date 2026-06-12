/** R5: /dev-tools/cli → /agents/catalogs (MERGE-INTO). */
import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

export const load: PageServerLoad = ({ url }) => {
  const search = url.search && url.search !== "?" ? url.search : "";
  throw redirect(308, DASHBOARD_BASE + "/agents/catalogs" + search);
};

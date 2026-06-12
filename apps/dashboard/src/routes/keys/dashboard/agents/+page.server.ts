import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

/** R5: /agents → /agents/wiring (Wiring is the default tab). */
export const load: PageServerLoad = ({ url }) => {
  const search = url.search && url.search !== "?" ? url.search : "";
  throw redirect(308, DASHBOARD_BASE + "/agents/wiring" + search);
};

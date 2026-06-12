import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

/** R5: /prove → /prove/proof (Proof is the default tab). */
export const load: PageServerLoad = ({ url }) => {
  const search = url.search && url.search !== "?" ? url.search : "";
  throw redirect(308, DASHBOARD_BASE + "/prove/proof" + search);
};

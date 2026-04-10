import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { ADMIN_BASE } from "$lib/dashboard-base";

/** @deprecated Use `/keys/admin/users` */
export const load: PageServerLoad = async () => {
  throw redirect(301, ADMIN_BASE + "/users");
};

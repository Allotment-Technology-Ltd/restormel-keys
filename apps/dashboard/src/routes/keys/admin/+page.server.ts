import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { ADMIN_BASE } from "$lib/dashboard-base";

export const load: PageServerLoad = async () => {
  throw redirect(302, ADMIN_BASE + "/users");
};

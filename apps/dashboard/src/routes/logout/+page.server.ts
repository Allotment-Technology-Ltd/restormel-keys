import { redirect } from "@sveltejs/kit";
import type { Load } from "./$types";

const SESSION_COOKIE_NAME = "session";

export const load: Load = async ({ cookies }) => {
  cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
  throw redirect(302, "/keys/dashboard/login");
};

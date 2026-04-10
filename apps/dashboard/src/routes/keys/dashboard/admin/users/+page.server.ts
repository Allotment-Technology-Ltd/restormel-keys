import type { PageServerLoad } from "./$types";
import { listUsersForServiceOwnerAdmin } from "$lib/server/admin-users";

export const load: PageServerLoad = async () => {
  const adminUsers = await listUsersForServiceOwnerAdmin();
  return { adminUsers };
};

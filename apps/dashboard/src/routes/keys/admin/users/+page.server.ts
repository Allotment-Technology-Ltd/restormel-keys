import type { AdminUserListRow } from "$lib/admin-user-list";
import type { PageServerLoad } from "./$types";
import { listUsersForServiceOwnerAdmin } from "$lib/server/admin-users";

export const load: PageServerLoad = async () => {
  try {
    const adminUsers = await listUsersForServiceOwnerAdmin();
    return { adminUsers, adminUsersError: null as string | null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin/users] load failed:", msg.slice(0, 200));
    return {
      adminUsers: [] as AdminUserListRow[],
      adminUsersError:
        "Could not load users. Ensure DATABASE_URL points at the database that holds Better Auth tables (`user`, `service_admins`) and that migrations have been applied.",
    };
  }
};

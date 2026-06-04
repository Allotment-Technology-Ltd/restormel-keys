import type { AdminUserListRow } from "$lib/admin-user-list";
import type { PageServerLoad } from "./$types";
import { listUsersForServiceOwnerAdmin } from "$lib/server/admin-users";
import { listServiceAdminEmails } from "$lib/server/service-admin-emails";
import type { ServiceAdminEmailRow } from "$lib/server/service-admin-emails";

export const load: PageServerLoad = async () => {
  try {
    const adminUsers = await listUsersForServiceOwnerAdmin();
    const operatorEmails = await listServiceAdminEmails();
    return {
      adminUsers,
      operatorEmails,
      adminUsersError: null as string | null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin/users] load failed:", msg.slice(0, 200));
    return {
      adminUsers: [] as AdminUserListRow[],
      operatorEmails: [] as ServiceAdminEmailRow[],
      adminUsersError:
        "Could not load users. Ensure DATABASE_URL points at the database that holds Better Auth tables (`user`, `service_admins`) and that migrations have been applied.",
    };
  }
};

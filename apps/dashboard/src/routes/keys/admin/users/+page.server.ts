import type { AdminUserListRow } from "$lib/admin-user-list";
import type { PageServerLoad } from "./$types";
import { listUsersForServiceOwnerAdmin } from "$lib/server/admin-users";
import {
  isServiceAdminEmailsTableReady,
  listServiceAdminEmails,
} from "$lib/server/service-admin-emails";
import type { ServiceAdminEmailRow } from "$lib/server/service-admin-emails";

export const load: PageServerLoad = async () => {
  try {
    const adminUsers = await listUsersForServiceOwnerAdmin();
    const operatorEmailsReady = await isServiceAdminEmailsTableReady();
    const operatorEmails = operatorEmailsReady ? await listServiceAdminEmails() : [];
    return {
      adminUsers,
      operatorEmails,
      operatorEmailsMigrationRequired: !operatorEmailsReady,
      adminUsersError: null as string | null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin/users] load failed:", msg.slice(0, 200));
    return {
      adminUsers: [] as AdminUserListRow[],
      operatorEmails: [] as ServiceAdminEmailRow[],
      operatorEmailsMigrationRequired: false,
      adminUsersError:
        "Could not load users. Ensure DATABASE_URL points at the database with app tables (`users`, `service_admins`) and that migrations have been applied.",
    };
  }
};

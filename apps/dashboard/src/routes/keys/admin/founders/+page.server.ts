import type { PageServerLoad } from "./$types";
import { listFoundersAccessForAdmin } from "$lib/server/founders-access";
import { requireServiceAdminSession } from "$lib/server/session-user";

export const load: PageServerLoad = async ({ locals }) => {
  // W4.6a SECURITY: defense-in-depth — never serialize founders access requests under
  // degraded/forged auth even if the layout gate were ever changed.
  requireServiceAdminSession(locals);
  let rows: Awaited<ReturnType<typeof listFoundersAccessForAdmin>> = [];
  let loadError: string | null = null;
  try {
    rows = await listFoundersAccessForAdmin();
  } catch {
    loadError = "Could not load Founders Circle access requests.";
  }
  return { foundersAccess: rows, foundersLoadError: loadError };
};

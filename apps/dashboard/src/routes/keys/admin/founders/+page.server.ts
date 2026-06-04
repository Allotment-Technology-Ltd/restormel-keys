import type { PageServerLoad } from "./$types";
import { listFoundersAccessForAdmin } from "$lib/server/founders-access";

export const load: PageServerLoad = async () => {
  let rows: Awaited<ReturnType<typeof listFoundersAccessForAdmin>> = [];
  let loadError: string | null = null;
  try {
    rows = await listFoundersAccessForAdmin();
  } catch {
    loadError = "Could not load Founders Circle access requests.";
  }
  return { foundersAccess: rows, foundersLoadError: loadError };
};

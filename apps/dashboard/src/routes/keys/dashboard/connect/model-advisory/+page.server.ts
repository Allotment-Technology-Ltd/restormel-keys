/**
 * Model advisory is now a lens of the unified Models page (feat/unified-models-page).
 * The standalone /connect/model-advisory route redirects to /models?view=rank, which
 * mounts the same <ModelAdvisoryPanel/>. The panel component stays where it is — it is
 * imported by the unified page. Keeping this route as a 308 preserves deep links and
 * the existing nav/palette destination.
 */
import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

export const load: PageServerLoad = () => {
  throw redirect(308, DASHBOARD_BASE + "/models?view=rank");
};

import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { hasProAccess } from "$lib/server/feature-gates";

export const load: PageServerLoad = async ({ locals, fetch, url }) => {
  if (!locals.user) {
    throw redirect(302, `${DASHBOARD_BASE}/login?redirect=${encodeURIComponent(url.pathname)}`);
  }

  const pro = hasProAccess(locals, "healthcheck");

  const projectId = url.searchParams.get("projectId");
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const res = await fetch(`${DASHBOARD_BASE}/api/healthcheck${qs}`);
  const payload = (await res.json().catch(() => ({}))) as unknown;

  return {
    pro,
    projectId,
    health: res.ok ? payload : { error: "Failed to load healthcheck" },
  };
};


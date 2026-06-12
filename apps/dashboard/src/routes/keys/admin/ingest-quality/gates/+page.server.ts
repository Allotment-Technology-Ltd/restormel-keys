import type { PageServerLoad } from "./$types";
import { INGEST_QUALITY_POSTHOG_DASHBOARD_URL } from "$lib/server/posthog-dashboard-embed";
import { computeGateStatuses } from "$lib/server/connect/ingest-quality-gates-data";
import { listProductionG2SampleJobs } from "$lib/server/neon";
import { requireServiceAdminSession } from "$lib/server/session-user";

const G2_SAMPLE_LIMIT = 10;

export const load: PageServerLoad = async ({ locals }) => {
  // W4.6a SECURITY: defense-in-depth — never serialize production G2 sample jobs under
  // degraded/forged auth even if the layout gate were ever changed.
  requireServiceAdminSession(locals);
  try {
    const g2Sample = await listProductionG2SampleJobs({ limit: G2_SAMPLE_LIMIT });
    return {
      g2Sample,
      gateStatuses: computeGateStatuses(g2Sample),
      posthogDashboardUrl: INGEST_QUALITY_POSTHOG_DASHBOARD_URL,
      loadError: null as string | null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      g2Sample: [],
      gateStatuses: computeGateStatuses([]),
      posthogDashboardUrl: INGEST_QUALITY_POSTHOG_DASHBOARD_URL,
      loadError: msg.slice(0, 280),
    };
  }
};

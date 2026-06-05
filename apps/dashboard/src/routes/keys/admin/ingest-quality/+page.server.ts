import type { PageServerLoad } from "./$types";
import { checkIngestQualityG2Gate } from "$lib/server/connect/ingest-quality-apply";
import { summarizeReviewSignals } from "$lib/server/connect/ingest-quality-thresholds";
import { listIngestQualityRuns, listReviewSignalsForEval } from "$lib/server/neon";
import {
  INGEST_QUALITY_POSTHOG_DASHBOARD_URL,
  resolveIngestQualityPostHogEmbedUrl,
} from "$lib/server/posthog-dashboard-embed";

const DEFAULT_DAYS = 7;

export const load: PageServerLoad = async () => {
  try {
    const [rows, runs, g2, posthogEmbedUrl] = await Promise.all([
      listReviewSignalsForEval({ days: DEFAULT_DAYS }),
      listIngestQualityRuns({ limit: 10 }),
      checkIngestQualityG2Gate(),
      resolveIngestQualityPostHogEmbedUrl(),
    ]);
    return {
      days: DEFAULT_DAYS,
      summary: summarizeReviewSignals(rows, DEFAULT_DAYS),
      runs,
      g2,
      posthogDashboardUrl: INGEST_QUALITY_POSTHOG_DASHBOARD_URL,
      posthogEmbedUrl,
      loadError: null as string | null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      days: DEFAULT_DAYS,
      summary: {
        windowDays: DEFAULT_DAYS,
        signalCount: 0,
        agreementPct: 0,
        topOverrides: [],
        aggregatesByArchetype: [],
      },
      runs: [],
      g2: {
        pass: false,
        reasons: ["Could not load G2 metrics."],
        ok_pct: 0,
        unsupported_pct: 0,
        sample_jobs: 0,
      },
      posthogDashboardUrl: INGEST_QUALITY_POSTHOG_DASHBOARD_URL,
      posthogEmbedUrl: null as string | null,
      loadError: msg.slice(0, 280),
    };
  }
};

/**
 * RES-113 PR-8 — Metrics-page data source for verification economics (placement
 * spec §3.3 / §5 item 9; copy pack §2.8).
 *
 * Reuses the EXISTING ingest-job list query (no new query shape): per-corpus
 * measurements ride each run's persisted `quality_report.verification_economics`
 * (recorded by the cascade's EconomicsRecorder once it wires into ingest), and
 * this helper aggregates them per corpus over the page's time window. Until a
 * run records economics, this returns [] and the Metrics section renders nothing
 * (honest absence — state earns pixels). Called ONLY when `m1PlugPoints` is ON,
 * so the flag-OFF load path is unchanged.
 */
import { listConnectIngestJobsForWorkspace } from "$lib/server/neon";
import {
  aggregateEconomicsByCorpus,
  type RunVerificationEconomics,
} from "$lib/connect/verification-economics";

/** Most-recent runs scanned for recorded economics (matches the list query's max page). */
const RUN_SCAN_LIMIT = 100;

export async function loadVerificationEconomicsByCorpus(params: {
  workspaceId: string;
  sinceMs: number;
  untilMs: number;
  projectId?: string | null;
}): Promise<RunVerificationEconomics[]> {
  const jobs = await listConnectIngestJobsForWorkspace({
    workspaceId: params.workspaceId,
    limit: RUN_SCAN_LIMIT,
    ...(params.projectId ? { projectId: params.projectId } : {}),
  }).catch(() => []);

  const entries: RunVerificationEconomics[] = [];
  for (const job of jobs) {
    if (job.createdAt < params.sinceMs || job.createdAt > params.untilMs) continue;
    const recorded = job.progress?.quality_report?.verification_economics;
    if (recorded && recorded.length > 0) entries.push(...recorded);
  }
  return aggregateEconomicsByCorpus(entries);
}

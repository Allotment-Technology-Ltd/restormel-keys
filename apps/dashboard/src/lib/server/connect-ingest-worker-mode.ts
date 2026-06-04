import { getConnectGraphTargetForWorkspace, type ConnectIngestJobRecord } from "$lib/server/neon";

export type ConnectIngestWorkerMode = "stub" | "full";

/**
 * Stub = stage simulation only (no graph writes).
 * Full = write to configured Postgres spine or Surreal BYO.
 *
 * Default: full when a graph store is connected; stub otherwise.
 * Override with CONNECT_INGEST_WORKER_MODE=stub|full.
 */
export async function resolveConnectIngestWorkerMode(
  job: ConnectIngestJobRecord,
): Promise<ConnectIngestWorkerMode> {
  const forced = process.env.CONNECT_INGEST_WORKER_MODE?.trim().toLowerCase();
  if (forced === "stub") return "stub";
  if (forced === "full") return "full";

  const target = await getConnectGraphTargetForWorkspace(job.workspaceId);
  return target ? "full" : "stub";
}

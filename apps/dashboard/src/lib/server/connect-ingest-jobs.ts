/**
 * Knowledge Ingest job persistence (Phase 9 / 5b) + worker dequeue (Phase 10 / 5d).
 */
export {
  getConnectIngestJobForWorkspace,
  insertConnectIngestJob,
  connectIngestJobRecordToApi,
  listConnectIngestJobsForWorkspace,
  claimNextPendingConnectIngestJob,
  updateConnectIngestJobById,
  cancelConnectIngestJobForWorkspace,
  appendConnectIngestJobLog,
  listConnectIngestJobLogsSince,
  countConnectIngestJobLogs,
  type ConnectIngestJobRecord,
  type ConnectIngestJobProgress,
} from "$lib/server/neon";

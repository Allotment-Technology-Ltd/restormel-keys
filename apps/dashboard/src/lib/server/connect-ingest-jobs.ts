/**
 * Knowledge Ingest job persistence (Phase 9 / 5b) + worker dequeue (Phase 10 / 5d).
 */
export {
  getConnectIngestJobForWorkspace,
  insertConnectIngestJob,
  connectIngestJobRecordToApi,
  listConnectIngestJobsForWorkspace,
  countConnectIngestJobsForWorkspace,
  claimNextPendingConnectIngestJob,
  updateConnectIngestJobById,
  cancelConnectIngestJobForWorkspace,
  deleteConnectIngestJobForWorkspace,
  bulkCleanupIngestJobsForWorkspace,
  appendConnectIngestJobLog,
  listConnectIngestJobLogsSince,
  countConnectIngestJobLogs,
  getIdempotencyKey,
  storeIdempotencyKey,
  type ConnectIngestJobRecord,
  type ConnectIngestJobProgress,
} from "$lib/server/neon";

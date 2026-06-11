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
  heartbeatConnectIngestJobLease,
  reclaimStaleRunningConnectIngestJobs,
  requeueReclaimedConnectIngestJob,
  CONNECT_INGEST_DEFAULT_LEASE_MS,
  CONNECT_INGEST_WORKER_LOST_ERROR,
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
  type ConnectIngestJobResumeCheckpoint,
} from "$lib/server/neon";

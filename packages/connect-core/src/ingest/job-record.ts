import type {
  ConnectIngestJob,
  ConnectIngestStage,
} from "@restormel/contracts/connect";

/** Canonical stage order for hosted Knowledge Ingest (matches @restormel/contracts). */
export const CONNECT_INGEST_PIPELINE_STAGES: readonly ConnectIngestStage[] = [
  "extracting",
  "relating",
  "grouping",
  "embedding",
  "validating",
  "remediating",
  "storing",
] as const;

export function buildInitialConnectIngestJob(args: {
  id: string;
  workspace_id: string;
  label?: string;
  stop_after_stage?: ConnectIngestStage;
  now?: Date;
}): ConnectIngestJob {
  const nowIso = (args.now ?? new Date()).toISOString();
  return {
    id: args.id,
    workspace_id: args.workspace_id,
    status: "pending",
    label: args.label,
    created_at: nowIso,
    updated_at: nowIso,
    stages: CONNECT_INGEST_PIPELINE_STAGES.map((stage) => ({
      stage,
      status: "pending" as const,
    })),
    ...(args.stop_after_stage ? { current_stage: args.stop_after_stage } : {}),
  };
}

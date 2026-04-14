/**
 * Single source of truth for ingestion workload/stage strings on routes (API + UI).
 * Align with SOPHIA ingestion pipeline stages where applicable.
 */
export const INGESTION_WORKLOAD = "ingestion" as const;

/** Allowed `stage` values when `workload === ingestion`. */
export const INGESTION_STAGE_IDS = [
  "ingestion_extraction",
  "ingestion_relations",
  "ingestion_grouping",
  "ingestion_validation",
  "ingestion_remediation",
  "ingestion_embedding",
  "ingestion_json_repair",
] as const;

export type IngestionStageId = (typeof INGESTION_STAGE_IDS)[number];

export const INGESTION_STAGES = new Set<string>(INGESTION_STAGE_IDS);

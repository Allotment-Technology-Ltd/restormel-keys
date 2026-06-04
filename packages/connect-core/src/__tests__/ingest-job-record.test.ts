import { describe, expect, it } from "vitest";
import {
  CONNECT_INGEST_PIPELINE_STAGES,
  buildInitialConnectIngestJob,
} from "../ingest/job-record.js";

describe("buildInitialConnectIngestJob", () => {
  it("creates pending job with full stage ladder", () => {
    const job = buildInitialConnectIngestJob({
      id: "550e8400-e29b-41d4-a716-446655440099",
      workspace_id: "550e8400-e29b-41d4-a716-446655440000",
      label: "wave-1",
      now: new Date("2026-06-01T12:00:00.000Z"),
    });
    expect(job.status).toBe("pending");
    expect(job.stages).toHaveLength(CONNECT_INGEST_PIPELINE_STAGES.length);
    expect(job.stages?.every((s) => s.status === "pending")).toBe(true);
    expect(job.created_at).toBe("2026-06-01T12:00:00.000Z");
  });
});

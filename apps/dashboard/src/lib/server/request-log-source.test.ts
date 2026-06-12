import { describe, expect, it } from "vitest";
import {
  requestLogMetadataWithSource,
  requestLogSourceFromMetadata,
} from "./request-log-source";

/**
 * K5 — request-log source tagging. Connect ingest resolves write a row tagged
 * source=connect_ingest into the existing request_logs.metadata JSONB (no migration).
 */
describe("requestLogMetadataWithSource", () => {
  it("folds the source into metadata.source and preserves existing keys", () => {
    expect(
      requestLogMetadataWithSource({ stage: "validation", ingest_job_id: "j1" }, "connect_ingest"),
    ).toEqual({ stage: "validation", ingest_job_id: "j1", source: "connect_ingest" });
  });

  it("sets source on empty metadata", () => {
    expect(requestLogMetadataWithSource(null, "connect_ingest")).toEqual({ source: "connect_ingest" });
  });

  it("returns metadata unchanged (or null) when no source is given", () => {
    expect(requestLogMetadataWithSource({ a: 1 }, null)).toEqual({ a: 1 });
    expect(requestLogMetadataWithSource(null, "")).toBeNull();
    expect(requestLogMetadataWithSource(undefined, undefined)).toBeNull();
  });
});

describe("requestLogSourceFromMetadata", () => {
  it("reads source from a parsed JSONB object", () => {
    expect(requestLogSourceFromMetadata({ source: "connect_ingest", stage: "extraction" })).toBe(
      "connect_ingest",
    );
  });

  it("reads source from a raw JSON string (driver variance)", () => {
    expect(requestLogSourceFromMetadata('{"source":"connect_ingest"}')).toBe("connect_ingest");
  });

  it("returns null for legacy/gateway rows (no metadata or no source)", () => {
    expect(requestLogSourceFromMetadata(null)).toBeNull();
    expect(requestLogSourceFromMetadata({})).toBeNull();
    expect(requestLogSourceFromMetadata({ source: "  " })).toBeNull();
    expect(requestLogSourceFromMetadata("not json")).toBeNull();
    expect(requestLogSourceFromMetadata(["arr"])).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  buildGraphRevalidateJobSources,
  parseGraphRevalidateJobMeta,
} from "./graph-revalidate-job";

describe("graph-revalidate-job", () => {
  it("round-trips revalidation job metadata in sources", () => {
    const sources = buildGraphRevalidateJobSources({
      kind: "graph_revalidate",
      validation_route_id: "00000000-0000-4000-8000-000000000099",
      remediation_route_id: null,
      domain_pack_id: "00000000-0000-4000-8000-000000000001",
      scope: "unchecked",
      mode: "validate",
      validation_mode: "ai",
    });
    expect(parseGraphRevalidateJobMeta(sources)).toEqual({
      kind: "graph_revalidate",
      validation_route_id: "00000000-0000-4000-8000-000000000099",
      remediation_route_id: null,
      domain_pack_id: "00000000-0000-4000-8000-000000000001",
      scope: "unchecked",
      mode: "validate",
      validation_mode: "ai",
      remediation_strictness: "balanced",
      remediation_threshold: null,
      max_units: null,
      continue_in_background: false,
      cohort_run_id: null,
    });
  });

  it("round-trips auto-remediation metadata", () => {
    const sources = buildGraphRevalidateJobSources({
      kind: "graph_revalidate",
      validation_route_id: null,
      remediation_route_id: "00000000-0000-4000-8000-000000000088",
      domain_pack_id: null,
      scope: "quarantine",
      mode: "validate_and_remediate",
      validation_mode: "ai",
    });
    expect(parseGraphRevalidateJobMeta(sources)).toEqual({
      kind: "graph_revalidate",
      validation_route_id: null,
      remediation_route_id: "00000000-0000-4000-8000-000000000088",
      domain_pack_id: null,
      scope: "quarantine",
      mode: "validate_and_remediate",
      validation_mode: "ai",
      remediation_strictness: "balanced",
      remediation_threshold: null,
      max_units: null,
      continue_in_background: false,
      cohort_run_id: null,
    });
  });

  it("defaults unknown scope and mode safely", () => {
    const sources = [
      {
        _connect_job: {
          kind: "graph_revalidate",
          scope: "bogus",
          mode: "invalid",
        },
      },
    ];
    expect(parseGraphRevalidateJobMeta(sources)).toEqual({
      kind: "graph_revalidate",
      validation_route_id: null,
      remediation_route_id: null,
      domain_pack_id: null,
      scope: "unchecked",
      mode: "validate",
      validation_mode: "ai",
      remediation_strictness: "balanced",
      remediation_threshold: null,
      max_units: null,
      continue_in_background: false,
      cohort_run_id: null,
    });
  });

  it("round-trips batch + background fields", () => {
    const sources = buildGraphRevalidateJobSources({
      kind: "graph_revalidate",
      scope: "unchecked",
      mode: "validate",
      validation_mode: "ai",
      max_units: 2000,
      continue_in_background: true,
    });
    const meta = parseGraphRevalidateJobMeta(sources);
    expect(meta?.max_units).toBe(2000);
    expect(meta?.continue_in_background).toBe(true);
  });

  it("round-trips a readiness cohort run id", () => {
    const sources = buildGraphRevalidateJobSources({
      kind: "graph_revalidate",
      scope: "linked",
      mode: "validate",
      validation_mode: "ai",
      cohort_run_id: "run-abc-123",
    });
    const meta = parseGraphRevalidateJobMeta(sources);
    expect(meta?.cohort_run_id).toBe("run-abc-123");
  });

  it("round-trips trust-provenance validation mode", () => {
    const sources = buildGraphRevalidateJobSources({
      kind: "graph_revalidate",
      scope: "unchecked",
      mode: "validate",
      validation_mode: "trust_provenance",
    });
    const meta = parseGraphRevalidateJobMeta(sources);
    expect(meta?.validation_mode).toBe("trust_provenance");
  });

  it("defaults validation mode to ai when omitted", () => {
    const sources = [{ _connect_job: { kind: "graph_revalidate", scope: "unchecked" } }];
    const meta = parseGraphRevalidateJobMeta(sources);
    expect(meta?.validation_mode).toBe("ai");
  });

  it("round-trips remediate mode with strictness + threshold", () => {
    const sources = buildGraphRevalidateJobSources({
      kind: "graph_revalidate",
      scope: "quarantine",
      mode: "remediate",
      validation_mode: "ai",
      remediation_strictness: "strict",
      remediation_threshold: 0.5,
    });
    const meta = parseGraphRevalidateJobMeta(sources);
    expect(meta?.mode).toBe("remediate");
    expect(meta?.remediation_strictness).toBe("strict");
    expect(meta?.remediation_threshold).toBe(0.5);
  });

  it("defaults strictness to balanced and threshold to null", () => {
    const sources = [{ _connect_job: { kind: "graph_revalidate", scope: "quarantine", mode: "remediate" } }];
    const meta = parseGraphRevalidateJobMeta(sources);
    expect(meta?.remediation_strictness).toBe("balanced");
    expect(meta?.remediation_threshold).toBeNull();
  });
});

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
    });
    expect(parseGraphRevalidateJobMeta(sources)).toEqual({
      kind: "graph_revalidate",
      validation_route_id: "00000000-0000-4000-8000-000000000099",
      remediation_route_id: null,
      domain_pack_id: "00000000-0000-4000-8000-000000000001",
      scope: "unchecked",
      mode: "validate",
      max_units: null,
      continue_in_background: false,
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
    });
    expect(parseGraphRevalidateJobMeta(sources)).toEqual({
      kind: "graph_revalidate",
      validation_route_id: null,
      remediation_route_id: "00000000-0000-4000-8000-000000000088",
      domain_pack_id: null,
      scope: "quarantine",
      mode: "validate_and_remediate",
      max_units: null,
      continue_in_background: false,
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
      max_units: null,
      continue_in_background: false,
    });
  });

  it("round-trips batch + background fields", () => {
    const sources = buildGraphRevalidateJobSources({
      kind: "graph_revalidate",
      scope: "unchecked",
      mode: "validate",
      max_units: 2000,
      continue_in_background: true,
    });
    const meta = parseGraphRevalidateJobMeta(sources);
    expect(meta?.max_units).toBe(2000);
    expect(meta?.continue_in_background).toBe(true);
  });
});

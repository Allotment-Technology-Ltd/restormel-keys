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
      domain_pack_id: "00000000-0000-4000-8000-000000000001",
      scope: "unchecked",
    });
    expect(parseGraphRevalidateJobMeta(sources)).toEqual({
      kind: "graph_revalidate",
      validation_route_id: "00000000-0000-4000-8000-000000000099",
      domain_pack_id: "00000000-0000-4000-8000-000000000001",
      scope: "unchecked",
    });
  });
});

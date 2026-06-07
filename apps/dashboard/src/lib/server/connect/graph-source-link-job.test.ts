import { describe, expect, it } from "vitest";
import {
  buildGraphLinkSourcesJobSources,
  parseGraphLinkSourcesJobMeta,
} from "./graph-source-link-job";

describe("graph-source-link-job", () => {
  it("round-trips source-link job metadata in sources", () => {
    const sources = buildGraphLinkSourcesJobSources({
      kind: "graph_link_sources",
      domain_pack_id: "00000000-0000-4000-8000-000000000001",
      scope: "unlinked_only",
    });
    expect(parseGraphLinkSourcesJobMeta(sources)).toEqual({
      kind: "graph_link_sources",
      domain_pack_id: "00000000-0000-4000-8000-000000000001",
      scope: "unlinked_only",
      cohort_run_id: null,
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  buildGraphEmbedBackfillJobSources,
  parseGraphEmbedBackfillJobMeta,
} from "./graph-embed-backfill-job";

describe("graph embed backfill job meta", () => {
  it("round-trips job sources", () => {
    const sources = buildGraphEmbedBackfillJobSources({
      kind: "graph_embed_backfill",
      embedding_route_id: "11111111-1111-4111-8111-111111111111",
      domain_pack_id: null,
    });
    expect(parseGraphEmbedBackfillJobMeta(sources)).toEqual({
      kind: "graph_embed_backfill",
      embedding_route_id: "11111111-1111-4111-8111-111111111111",
      domain_pack_id: null,
    });
  });

  it("rejects other job kinds", () => {
    const sources = [
      {
        text: "other",
        _connect_job: { kind: "graph_revalidate", scope: "all", mode: "validate" },
      },
    ];
    expect(parseGraphEmbedBackfillJobMeta(sources)).toBeNull();
  });
});

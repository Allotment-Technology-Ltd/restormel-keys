import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode } from "@restormel/graph-core/viewModel";
import { computeGraphLayoutFromBody, layoutPositionsRecord } from "./graph-v1-layout";

describe("computeGraphLayoutFromBody", () => {
  it("matches in-process graph-core layout for a minimal graph", () => {
    const nodes: GraphNode[] = [
      { id: "s1", type: "source", label: "Source 1" },
      { id: "c1", type: "claim", label: "Claim 1" },
    ];
    const edges: GraphEdge[] = [{ from: "s1", to: "c1", type: "contains" }];
    const expected = layoutPositionsRecord(nodes, edges, 800, 600);

    const result = computeGraphLayoutFromBody({
      contract_version: "2026-06-01",
      width: 800,
      height: 600,
      snapshot: { nodes, edges, ghostNodes: [], ghostEdges: [] },
    });

    expect("layout" in result).toBe(true);
    if (!("layout" in result)) return;
    expect(result.layout.positions).toEqual(expected);
    expect(result.meta.nodeCount).toBe(2);
  });

  it("returns 400 when nodes are missing", () => {
    const result = computeGraphLayoutFromBody({ snapshot: { nodes: [], edges: [] } });
    expect(result).toMatchObject({ error: "invalid_snapshot", status: 400 });
  });

  it("accepts flat snapshot at top level", () => {
    const result = computeGraphLayoutFromBody({
      nodes: [{ id: "a", type: "source", label: "A" }],
      edges: [],
      width: 640,
      height: 480,
    });
    expect("layout" in result).toBe(true);
    if (!("layout" in result)) return;
    expect(result.layout.width).toBe(640);
    expect(result.layout.positions.a).toBeDefined();
  });
});

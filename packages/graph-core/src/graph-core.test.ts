import { describe, expect, it } from "vitest";
import { computeLayout } from "./layout.js";
import { formatTraceTag, getNodeTraceLabel, getNodeTraceTags } from "./trace.js";
import type { GraphEdge, GraphNode } from "./viewModel.js";

describe("@restormel/graph-core layout", () => {
  it("places sources on an outer ring and claims inward", () => {
    const nodes: GraphNode[] = [
      { id: "s1", type: "source", label: "Source 1" },
      { id: "c1", type: "claim", label: "Claim 1" },
    ];
    const edges: GraphEdge[] = [{ from: "s1", to: "c1", type: "contains" }];
    const positions = computeLayout(nodes, edges, 800, 600);
    const s1 = positions.get("s1");
    const c1 = positions.get("c1");
    expect(s1).toBeDefined();
    expect(c1).toBeDefined();
    const dS = Math.hypot(s1!.x - 400, s1!.y - 300);
    const dC = Math.hypot(c1!.x - 400, c1!.y - 300);
    expect(dS).toBeGreaterThan(dC);
  });

  it("is deterministic for the same inputs", () => {
    const nodes: GraphNode[] = [
      { id: "a", type: "source", label: "A" },
      { id: "b", type: "claim", label: "B" },
    ];
    const edges: GraphEdge[] = [{ from: "a", to: "b", type: "contains" }];
    const p1 = computeLayout(nodes, edges, 640, 480);
    const p2 = computeLayout(nodes, edges, 640, 480);
    expect(p1.get("a")).toEqual(p2.get("a"));
    expect(p1.get("b")).toEqual(p2.get("b"));
  });
});

describe("@restormel/graph-core trace", () => {
  it("collects trace tags in stable order", () => {
    const node: GraphNode = {
      id: "n1",
      type: "claim",
      label: "L",
      isSeed: true,
      pass_origin: "analysis",
      conflict_status: "contested",
      unresolved_tension_id: "t1",
      provenance_id: "p1",
    };
    expect(getNodeTraceTags(node)).toEqual([
      "seed",
      "analysis",
      "contested",
      "tension",
      "provenanced",
    ]);
  });

  it("uses traversed when not seed", () => {
    const node: GraphNode = {
      id: "n2",
      type: "claim",
      label: "L",
      isTraversed: true,
      pass_origin: "retrieval",
    };
    expect(getNodeTraceTags(node)).toContain("traversed");
    expect(getNodeTraceTags(node)).toContain("retrieval");
  });

  it("formats trace label with max tag cap", () => {
    const node: GraphNode = {
      id: "n3",
      type: "claim",
      label: "L",
      isSeed: true,
      pass_origin: "synthesis",
      conflict_status: "unresolved",
      unresolved_tension_id: "x",
      provenance_id: "y",
    };
    expect(getNodeTraceLabel(node, 2)).toBe("seed · synthesis");
  });

  it("formatTraceTag replaces underscores", () => {
    expect(formatTraceTag("seed_pool_pruned")).toBe("seed pool pruned");
  });
});

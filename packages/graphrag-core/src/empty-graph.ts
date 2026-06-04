import type { GraphData } from "@restormel/graph-core/viewModel";

export function emptyGraphData(): GraphData {
  return { nodes: [], edges: [], ghostNodes: [], ghostEdges: [] };
}

export type { GraphData } from "@restormel/graph-core/viewModel";

import type { GraphEdge, GraphNode } from "@restormel/graph-core/viewModel";

/**
 * GraphCanvas props — identical to Contract v0 {@link GraphRendererProps} in `@restormel/graph-core/viewModel`.
 * Re-exported for ergonomic imports from this package.
 */
export type { GraphRendererProps as GraphCanvasProps } from "@restormel/graph-core/viewModel";

/** Props for the inline NodeDetail panel. */
export interface NodeDetailProps {
  node: GraphNode;
  edges: GraphEdge[];
  nodes: GraphNode[];
  position: { x: number; y: number };
  onClose: () => void;
  onJumpToReferences?: () => void;
}

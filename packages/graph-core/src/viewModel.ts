/**
 * RESTORMEL GRAPH CONTRACT v0
 * DO NOT MODIFY WITHOUT PLATFORM REVIEW
 *
 * Frozen DTOs for interactive graph rendering. This file is the only graph-core surface
 * that defines cross-platform data shape for Restormel Graph MVP.
 *
 * Rules:
 * - No imports from SOPHIA, `@restormel/contracts`, or any app package.
 * - No runtime logic — types and interfaces only.
 *
 * Portable graph view-model for rendering (Restormel Graph).
 * Hosts map domain snapshots into these shapes; renderers consume `GraphData` + optional semantics.
 */

export type GraphPhase = 'retrieval' | 'analysis' | 'critique' | 'synthesis';

export type GraphNodeKind = 'source' | 'claim';

export type GraphConflictStatus = 'none' | 'contested' | 'unresolved' | 'resolved';

export type GraphArcKind =
  | 'contains'
  | 'supports'
  | 'contradicts'
  | 'responds-to'
  | 'depends-on'
  | 'defines'
  | 'qualifies'
  | 'assumes'
  | 'resolves';

export type GraphRejectionReasonCode =
  | 'seed_pool_pruned'
  | 'duplicate_traversal'
  | 'duplicate_relation'
  | 'missing_endpoint'
  | 'confidence_gate'
  | 'source_integrity_gate';

/** Vertex shown in the interactive graph canvas. */
export interface GraphNode {
  id: string;
  type: GraphNodeKind;
  label: string;
  phase?: GraphPhase;
  domain?: string;
  sourceTitle?: string;
  traversalDepth?: number;
  relevance?: number;
  isSeed?: boolean;
  isTraversed?: boolean;
  confidenceBand?: 'high' | 'medium' | 'low';
  depth_level?: number;
  evidence_strength?: number;
  novelty_score?: number;
  derived_from?: string[];
  pass_origin?: GraphPhase;
  conflict_status?: GraphConflictStatus;
  unresolved_tension_id?: string;
  provenance_id?: string;
}

/** Directed typed edge between vertices. */
export interface GraphEdge {
  from: string;
  to: string;
  type: GraphArcKind;
  weight?: number;
  phaseOrigin?: GraphPhase;
  depth_level?: number;
  evidence_strength?: number;
  novelty_score?: number;
  derived_from?: string[];
  pass_origin?: GraphPhase;
  conflict_status?: GraphConflictStatus;
  unresolved_tension_id?: string;
  provenance_id?: string;
  relation_rationale?: string;
  relation_confidence?: number;
  evidence_count?: number;
  evidence_sources?: string[];
}

/** Rejected / ghost vertex (optional overlay). */
export interface GraphGhostNode {
  id: string;
  label: string;
  reasonCode: GraphRejectionReasonCode;
  consideredIn?: 'seed_pool' | 'traversal' | 'relations';
  sourceTitle?: string;
  confidence?: number;
  anchorNodeId?: string;
  pass_origin?: GraphPhase;
}

/** Rejected / ghost edge (optional overlay). */
export interface GraphGhostEdge {
  id: string;
  from: string;
  to: string;
  type: GraphArcKind;
  reasonCode: GraphRejectionReasonCode;
  relation_confidence?: number;
  rationale_source?: string;
  pass_origin?: GraphPhase;
}

/** Bundle passed to a graph renderer (nodes + primary edges + optional ghost layer). */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  ghostNodes: GraphGhostNode[];
  ghostEdges: GraphGhostEdge[];
}

export type GraphViewportCommandType = 'fit' | 'reset-layout';

export interface GraphViewportCommand {
  type: GraphViewportCommandType;
  nonce: number;
}

/**
 * Semantic styling keyed by node id and by edge key `from:type:to`
 * (see `graphCanvasEdgeKey` in host or duplicate in ui package).
 */
export type GraphNodeSemanticStyle = {
  kind: string;
  shape: 'circle' | 'square' | 'diamond' | 'hexagon' | 'rounded-rect';
  fill: string;
  stroke: string;
  glyph?: string;
  radius?: number;
  state?: 'default' | 'verified' | 'unresolved' | 'contradicted' | 'synthesis';
};

export type GraphEdgeSemanticStyle = {
  kind: string;
  stroke: string;
  strokeWidth?: number;
  dasharray?: string;
  marker?: 'arrow-blue' | 'arrow-teal' | 'arrow-coral' | 'arrow-amber' | 'arrow-purple' | 'none';
  state?: 'default' | 'verified' | 'unresolved' | 'contradicted' | 'synthesis';
};

/** Props contract for the Svelte graph canvas (`@restormel/ui-graph-svelte`). */
export interface GraphRendererProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  ghostNodes?: GraphGhostNode[];
  ghostEdges?: GraphGhostEdge[];
  showGhostLayer?: boolean;
  showInlineDetail?: boolean;
  showStatusChip?: boolean;
  showViewportControls?: boolean;
  viewportCommand?: GraphViewportCommand | null;
  nodeSemanticStyles?: Record<string, GraphNodeSemanticStyle>;
  edgeSemanticStyles?: Record<string, GraphEdgeSemanticStyle>;
  width?: number;
  height?: number;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  pinnedNodeIds?: string[];
  pathNodeIds?: string[];
  pathEdges?: Array<{ from: string; to: string }>;
  focusNodeIds?: string[];
  focusEdgeIds?: string[];
  dimOutOfScope?: boolean;
  selectedNodeId?: string | null;
  onSelectedNodeChange?: (nodeId: string | null) => void;
  onNodeSelect?: (nodeId: string) => void;
  onJumpToReferences?: (nodeId: string) => void;
}

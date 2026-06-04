/**
 * Graph v1 layout — parse request body and compute orbital positions via graph-core.
 */
import { computeLayout } from "@restormel/graph-core/layout";
import type { GraphEdge, GraphNode } from "@restormel/graph-core/viewModel";

export const GRAPH_LAYOUT_CONTRACT_VERSION = "2026-06-01.graph.layout.v1";

export type GraphLayoutSuccess = {
  contractVersion: string;
  generatedAt: string;
  layout: {
    width: number;
    height: number;
    positions: Record<string, { x: number; y: number }>;
  };
  meta: { nodeCount: number; edgeCount: number };
};

export type GraphLayoutFailure = {
  error: string;
  message?: string;
  status: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseNode(raw: unknown, index: number): GraphNode | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const type = raw.type === "source" || raw.type === "claim" ? raw.type : null;
  const label = typeof raw.label === "string" ? raw.label : "";
  if (!id || !type || !label) return null;
  return { ...raw, id, type, label } as GraphNode;
}

function parseEdge(raw: unknown): GraphEdge | null {
  if (!isRecord(raw)) return null;
  const from = typeof raw.from === "string" ? raw.from.trim() : "";
  const to = typeof raw.to === "string" ? raw.to.trim() : "";
  const type = typeof raw.type === "string" ? raw.type.trim() : "";
  if (!from || !to || !type) return null;
  return { ...raw, from, to, type } as GraphEdge;
}

function parseDimension(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function computeGraphLayoutFromBody(body: unknown): GraphLayoutSuccess | GraphLayoutFailure {
  if (!isRecord(body)) {
    return { error: "invalid_json", message: "Expected JSON object", status: 400 };
  }

  const snapshot = isRecord(body.snapshot) ? body.snapshot : body;
  const rawNodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
  const rawEdges = Array.isArray(snapshot.edges) ? snapshot.edges : [];

  if (rawNodes.length === 0) {
    return { error: "invalid_snapshot", message: "snapshot.nodes must be a non-empty array", status: 400 };
  }
  if (rawNodes.length > 2000) {
    return { error: "snapshot_too_large", message: "Maximum 2000 nodes per layout request", status: 413 };
  }

  const nodes: GraphNode[] = [];
  for (let i = 0; i < rawNodes.length; i++) {
    const node = parseNode(rawNodes[i], i);
    if (!node) {
      return {
        error: "invalid_node",
        message: `nodes[${i}] requires id, type (source|claim), and label`,
        status: 400,
      };
    }
    nodes.push(node);
  }

  const edges: GraphEdge[] = [];
  for (let i = 0; i < rawEdges.length; i++) {
    const edge = parseEdge(rawEdges[i]);
    if (!edge) {
      return {
        error: "invalid_edge",
        message: `edges[${i}] requires from, to, and type`,
        status: 400,
      };
    }
    edges.push(edge);
  }

  const width = parseDimension(body.width ?? snapshot.width, 800, 320, 4096);
  const height = parseDimension(body.height ?? snapshot.height, 600, 240, 4096);

  const layoutMap = computeLayout(nodes, edges, width, height);
  const positions: Record<string, { x: number; y: number }> = {};
  for (const [id, pos] of layoutMap.entries()) {
    positions[id] = { x: pos.x, y: pos.y };
  }

  return {
    contractVersion: GRAPH_LAYOUT_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    layout: { width, height, positions },
    meta: { nodeCount: nodes.length, edgeCount: edges.length },
  };
}

/** Deterministic parity helper for tests — same inputs as graph-core layout tests. */
export function layoutPositionsRecord(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
): Record<string, { x: number; y: number }> {
  const map = computeLayout(nodes, edges, width, height);
  const out: Record<string, { x: number; y: number }> = {};
  for (const [id, pos] of map.entries()) out[id] = { x: pos.x, y: pos.y };
  return out;
}

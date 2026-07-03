import { mount, unmount } from "svelte";
import { GraphCanvas } from "@restormel/ui-graph-svelte";
import type {
  GraphEdge,
  GraphGhostEdge,
  GraphGhostNode,
  GraphNode,
  GraphViewportCommand,
} from "@restormel/graph-core/viewModel";
import type {
  GraphCanvasEdgeSemanticStyle,
  GraphCanvasNodeSemanticStyle,
} from "@restormel/ui-graph-svelte";
import { defaultGraphThemeCss } from "./theme-inline.js";

const TAG = "rg-graph-canvas";

export class RgGraphCanvasElement extends HTMLElement {
  static observedAttributes = ["width", "height", "show-ghost-layer"];

  private _root: ShadowRoot | null = null;
  private _container: HTMLDivElement | null = null;
  private _mountInstance: ReturnType<typeof mount> | null = null;

  private _nodes: GraphNode[] = [];
  private _edges: GraphEdge[] = [];
  private _ghostNodes: GraphGhostNode[] = [];
  private _ghostEdges: GraphGhostEdge[] = [];
  private _width = 800;
  private _height = 600;
  private _showGhostLayer = true;
  private _showInlineDetail = true;
  private _showStatusChip = true;
  private _showViewportControls = true;
  private _viewportCommand: GraphViewportCommand | null = null;
  private _nodeSemanticStyles: Record<string, GraphCanvasNodeSemanticStyle> = {};
  private _edgeSemanticStyles: Record<string, GraphCanvasEdgeSemanticStyle> = {};
  private _pinnedNodeIds: string[] = [];
  private _pathNodeIds: string[] = [];
  private _pathEdges: Array<{ from: string; to: string }> = [];
  private _focusNodeIds: string[] = [];
  private _focusEdgeIds: string[] = [];
  private _dimOutOfScope = false;
  private _selectedNodeId: string | undefined;

  get nodes(): GraphNode[] {
    return this._nodes;
  }
  set nodes(v: GraphNode[]) {
    this._nodes = Array.isArray(v) ? v : [];
    this._update();
  }

  get edges(): GraphEdge[] {
    return this._edges;
  }
  set edges(v: GraphEdge[]) {
    this._edges = Array.isArray(v) ? v : [];
    this._update();
  }

  get ghostNodes(): GraphGhostNode[] {
    return this._ghostNodes;
  }
  set ghostNodes(v: GraphGhostNode[]) {
    this._ghostNodes = Array.isArray(v) ? v : [];
    this._update();
  }

  get ghostEdges(): GraphGhostEdge[] {
    return this._ghostEdges;
  }
  set ghostEdges(v: GraphGhostEdge[]) {
    this._ghostEdges = Array.isArray(v) ? v : [];
    this._update();
  }

  get width(): number {
    return this._width;
  }
  set width(v: number) {
    this._width = Number.isFinite(v) ? v : 800;
    this._update();
  }

  get height(): number {
    return this._height;
  }
  set height(v: number) {
    this._height = Number.isFinite(v) ? v : 600;
    this._update();
  }

  get showGhostLayer(): boolean {
    return this._showGhostLayer;
  }
  set showGhostLayer(v: boolean) {
    this._showGhostLayer = Boolean(v);
    this._update();
  }

  get showInlineDetail(): boolean {
    return this._showInlineDetail;
  }
  set showInlineDetail(v: boolean) {
    this._showInlineDetail = Boolean(v);
    this._update();
  }

  get showStatusChip(): boolean {
    return this._showStatusChip;
  }
  set showStatusChip(v: boolean) {
    this._showStatusChip = Boolean(v);
    this._update();
  }

  get showViewportControls(): boolean {
    return this._showViewportControls;
  }
  set showViewportControls(v: boolean) {
    this._showViewportControls = Boolean(v);
    this._update();
  }

  get viewportCommand(): GraphViewportCommand | null {
    return this._viewportCommand;
  }
  set viewportCommand(v: GraphViewportCommand | null) {
    this._viewportCommand = v ?? null;
    this._update();
  }

  get nodeSemanticStyles(): Record<string, GraphCanvasNodeSemanticStyle> {
    return this._nodeSemanticStyles;
  }
  set nodeSemanticStyles(v: Record<string, GraphCanvasNodeSemanticStyle>) {
    this._nodeSemanticStyles = v ?? {};
    this._update();
  }

  get edgeSemanticStyles(): Record<string, GraphCanvasEdgeSemanticStyle> {
    return this._edgeSemanticStyles;
  }
  set edgeSemanticStyles(v: Record<string, GraphCanvasEdgeSemanticStyle>) {
    this._edgeSemanticStyles = v ?? {};
    this._update();
  }

  get pinnedNodeIds(): string[] {
    return this._pinnedNodeIds;
  }
  set pinnedNodeIds(v: string[]) {
    this._pinnedNodeIds = Array.isArray(v) ? v : [];
    this._update();
  }

  get pathNodeIds(): string[] {
    return this._pathNodeIds;
  }
  set pathNodeIds(v: string[]) {
    this._pathNodeIds = Array.isArray(v) ? v : [];
    this._update();
  }

  get pathEdges(): Array<{ from: string; to: string }> {
    return this._pathEdges;
  }
  set pathEdges(v: Array<{ from: string; to: string }>) {
    this._pathEdges = Array.isArray(v) ? v : [];
    this._update();
  }

  get focusNodeIds(): string[] {
    return this._focusNodeIds;
  }
  set focusNodeIds(v: string[]) {
    this._focusNodeIds = Array.isArray(v) ? v : [];
    this._update();
  }

  get focusEdgeIds(): string[] {
    return this._focusEdgeIds;
  }
  set focusEdgeIds(v: string[]) {
    this._focusEdgeIds = Array.isArray(v) ? v : [];
    this._update();
  }

  get dimOutOfScope(): boolean {
    return this._dimOutOfScope;
  }
  set dimOutOfScope(v: boolean) {
    this._dimOutOfScope = Boolean(v);
    this._update();
  }

  get selectedNodeId(): string | undefined {
    return this._selectedNodeId;
  }
  set selectedNodeId(v: string | undefined) {
    this._selectedNodeId = v ?? undefined;
    this._update();
  }

  attributeChangedCallback(name: string, _old: string | null, newVal: string | null): void {
    if (name === "width") this._width = parseInt(newVal ?? "800", 10) || 800;
    if (name === "height") this._height = parseInt(newVal ?? "600", 10) || 600;
    if (name === "show-ghost-layer") this._showGhostLayer = newVal !== "false";
    this._update();
  }

  connectedCallback(): void {
    if (this._root) return;
    if (this.hasAttribute("width")) this._width = parseInt(this.getAttribute("width") ?? "800", 10) || 800;
    if (this.hasAttribute("height")) this._height = parseInt(this.getAttribute("height") ?? "600", 10) || 600;
    if (this.hasAttribute("show-ghost-layer")) {
      this._showGhostLayer = this.getAttribute("show-ghost-layer") !== "false";
    }
    this._root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = defaultGraphThemeCss;
    this._root.appendChild(style);
    this._container = document.createElement("div");
    this._container.className = "graph-canvas-container";
    this._root.appendChild(this._container);
    this._update();
  }

  disconnectedCallback(): void {
    if (this._mountInstance) {
      unmount(this._mountInstance);
      this._mountInstance = null;
    }
    this._container = null;
    this._root = null;
  }

  private _update(): void {
    if (!this._container || !this._root) return;
    if (this._mountInstance) {
      unmount(this._mountInstance);
      this._mountInstance = null;
    }
    if (this._nodes.length === 0) return;

    this._mountInstance = mount(GraphCanvas, {
      target: this._container,
      props: {
        nodes: this._nodes,
        edges: this._edges,
        ghostNodes: this._ghostNodes,
        ghostEdges: this._ghostEdges,
        showGhostLayer: this._showGhostLayer,
        showInlineDetail: this._showInlineDetail,
        showStatusChip: this._showStatusChip,
        showViewportControls: this._showViewportControls,
        viewportCommand: this._viewportCommand,
        nodeSemanticStyles: this._nodeSemanticStyles,
        edgeSemanticStyles: this._edgeSemanticStyles,
        width: this._width,
        height: this._height,
        pinnedNodeIds: this._pinnedNodeIds,
        pathNodeIds: this._pathNodeIds,
        pathEdges: this._pathEdges,
        focusNodeIds: this._focusNodeIds,
        focusEdgeIds: this._focusEdgeIds,
        dimOutOfScope: this._dimOutOfScope,
        selectedNodeId: this._selectedNodeId,
        onNodeSelect: (nodeId: string) => {
          this.dispatchEvent(
            new CustomEvent("rg-node-select", {
              bubbles: true,
              composed: true,
              detail: { nodeId },
            })
          );
        },
        onSelectedNodeChange: (nodeId: string | null) => {
          this._selectedNodeId = nodeId ?? undefined;
          this.dispatchEvent(
            new CustomEvent("rg-selected-node-change", {
              bubbles: true,
              composed: true,
              detail: { nodeId },
            })
          );
        },
        onJumpToReferences: (nodeId: string) => {
          this.dispatchEvent(
            new CustomEvent("rg-jump-to-references", {
              bubbles: true,
              composed: true,
              detail: { nodeId },
            })
          );
        },
      },
    });
  }
}

if (!customElements.get(TAG)) {
  customElements.define(TAG, RgGraphCanvasElement);
}

import { resolve } from "path";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import dts from "vite-plugin-dts";

/** vite-plugin-dts emits `export { SvelteComponent as default }` for .svelte files — useless for strict consumers. */
const graphCanvasDts = `import type { Component } from "svelte";
import type { GraphRendererProps } from "@restormel/graph-core/viewModel";

declare const GraphCanvas: Component<GraphRendererProps>;
export default GraphCanvas;
`;

const nodeDetailDts = `import type { Component } from "svelte";
import type { GraphEdge, GraphNode } from "@restormel/graph-core/viewModel";

export interface NodeDetailProps {
  node: GraphNode;
  edges: GraphEdge[];
  nodes: GraphNode[];
  position: { x: number; y: number };
  onClose: () => void;
  onJumpToReferences?: () => void;
}

declare const NodeDetail: Component<NodeDetailProps>;
export default NodeDetail;
`;

export default defineConfig({
  plugins: [
    svelte(),
    dts({
      include: ["src"],
      outDir: "dist",
      staticImport: true,
      beforeWriteFile: (filePath, content) => {
        const normalized = filePath.replace(/\\/g, "/");
        if (normalized.endsWith("/lib/GraphCanvas.svelte.d.ts")) {
          return { filePath, content: graphCanvasDts };
        }
        if (normalized.endsWith("/lib/NodeDetail.svelte.d.ts")) {
          return { filePath, content: nodeDetailDts };
        }
        return { filePath, content };
      },
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
    },
    rollupOptions: {
      external: ["svelte", /^svelte\//, "@restormel/graph-core", /^@restormel\/graph-core\//],
      output: {
        entryFileNames: "[name].js",
        assetFileNames: "[name][extname]",
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
});

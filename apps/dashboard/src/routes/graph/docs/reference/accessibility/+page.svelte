<script lang="ts">
  import DocArticle from "$lib/graph/components/docs/DocArticle.svelte";
  import { graphBase as base } from "$lib/graph/paths.js";
  import { GITHUB_REPO_URL } from "$lib/site-nav";
</script>

<DocArticle
  title="Accessibility & input model"
  description="Public expectations for keyboard use, ARIA roles, focus, and known limitations of GraphCanvas and NodeDetail in @restormel/ui-graph-svelte."
>
  <div class="doc-prose">
    <p>
      This page describes the <strong>intended</strong> accessibility and interaction contract of the published canvas. For
      behaviour changes, trust the
      <a href="{GITHUB_REPO_URL}/tree/main/packages/ui-graph-svelte" rel="noopener noreferrer">source</a> and published
      <code>.d.ts</code> for the version you pin.
    </p>

    <h2>Roles and labels</h2>
    <ul>
      <li>
        The graph container uses <code>role="application"</code> with an <code>aria-label</code> describing the visualization
        (wording may vary slightly by build).
      </li>
      <li>
        Optional viewport controls render as <code>role="toolbar"</code> with labeled buttons (zoom, fit, reset layout,
        fullscreen when enabled).
      </li>
      <li>
        Nodes and edges that participate in keyboard interaction use <code>tabindex="0"</code>,
        <code>aria-label</code> / type descriptions, and <code>aria-pressed</code> where selection applies.
      </li>
      <li>
        Ghost (rejected) nodes and edges are grouped with <code>aria-label</code> text that distinguishes them from the main
        graph.
      </li>
      <li>
        A status region may expose zoom percentage with <code>aria-live="polite"</code> when the status chip is shown.
      </li>
    </ul>

    <h2>Keyboard</h2>
    <ul>
      <li>
        <strong>Tab / Shift+Tab:</strong> moves through focusable nodes, edges, toolbar buttons, and other focusable chrome in
        DOM order (not a custom geometric “roving” order).
      </li>
      <li>
        <strong>Enter / Space</strong> on a focused node selects it (and opens inline detail when enabled). On a focused edge,
        activates edge selection / detail behaviour consistent with pointer use.
      </li>
      <li>
        <strong>Escape</strong> clears node selection, edge selection, and highlight state (global listener in addition to
        per-element handling). <code>NodeDetail</code> traps focus and closes via Escape or the close control.
      </li>
    </ul>

    <h2>Pointer and motion</h2>
    <ul>
      <li>Pan: pointer drag on the SVG background; zoom: wheel with default prevented (sensitive to trackpad delta).</li>
      <li>
        No separate “reduced motion” flag today — zoom/pan are immediate. Hosts can wrap the canvas in their own motion
        preferences if required.
      </li>
    </ul>

    <h2>Known limitations</h2>
    <ul>
      <li>
        Focus order follows the DOM / tab order of rendered elements, not graph topology. Very large graphs can mean long tab
        sequences unless the host pre-filters data.
      </li>
      <li>
        <code>role="application"</code> signals an interactive widget; some screen-reader users may prefer supplemental
        off-canvas summaries for dense graphs.
      </li>
      <li>High-contrast themes depend on host-supplied CSS variables; see the integration guide.</li>
    </ul>

    <p>
      <a href="{base}/docs/reference/api">← API reference</a> ·
      <a href="{base}/docs/reference/performance">Performance notes</a>
    </p>
  </div>
</DocArticle>

<script lang="ts">
  import { graphBase as base } from "$lib/graph/paths.js";
  import DocArticle from "$lib/graph/components/docs/DocArticle.svelte";
</script>

<DocArticle
  title="Overview"
  description="Restormel Graph is a small, contracts-free graph stack for Svelte apps: frozen DTOs in @restormel/graph-core and an interactive canvas in @restormel/ui-graph-svelte."
>
  <div class="doc-prose">
    <p>
      It exists so product teams can ship <strong>consistent graph UIs</strong> without copying divergent canvas code or
      importing Restormel <strong>reasoning contracts</strong> into the renderer layer. Your application owns adapters that
      map domain state into <strong>GraphData</strong>; the packages own layout helpers, trace/workspace utilities, and
      the SVG canvas.
    </p>
    <p>
      It is <strong>not</strong> a general graph database, a knowledge-reasoning engine, or an OpenAPI-style HTTP product.
      It is <strong>not</strong> a replacement for application-specific compare/lineage/projection modules—those stay in
      your app or in separate extensions.
    </p>
    <p>
      Next: <a href="{base}/docs/how-it-fits-together">How it fits together</a> ·
      <a href="{base}/docs/integration/sveltekit">SvelteKit integration</a> (canonical)
    </p>
  </div>
</DocArticle>

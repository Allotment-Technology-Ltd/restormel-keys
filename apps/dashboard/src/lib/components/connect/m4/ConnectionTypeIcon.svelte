<script lang="ts">
  /**
   * M4 connection-type icons (RES-113 PR-E). Small inline SVGs — never single
   * letters (08_ARTEFACTS.md: the single-letter avatars read poorly; use icons):
   *   mcp → plug · rest → exchange arrows · widget → chat bubble ·
   *   sdk → code brackets · graphql → node-graph.
   * currentColor throughout so the brutalist border/fill tokens drive the colour.
   */
  import type { ConnectionMethodId } from "./connection-model";

  export let method: ConnectionMethodId;
  export let size = 18;
</script>

<svg
  class="conn-icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if method === "mcp"}
    <!-- plug -->
    <path d="M9 2v6" />
    <path d="M15 2v6" />
    <path d="M6 8h12v3a6 6 0 0 1-12 0V8Z" />
    <path d="M12 17v5" />
  {:else if method === "rest"}
    <!-- exchange arrows -->
    <path d="M4 8h13l-3-3" />
    <path d="M20 16H7l3 3" />
  {:else if method === "widget"}
    <!-- chat bubble -->
    <path d="M4 5h16v11H9l-5 4V5Z" />
    <path d="M8 10h8" />
    <path d="M8 13h5" />
  {:else if method === "sdk"}
    <!-- code brackets -->
    <path d="M9 7 4 12l5 5" />
    <path d="m15 7 5 5-5 5" />
  {:else if method === "graphql"}
    <!-- node graph -->
    <circle cx="12" cy="4" r="2" />
    <circle cx="5" cy="18" r="2" />
    <circle cx="19" cy="18" r="2" />
    <path d="M12 6 6 16" />
    <path d="m12 6 6 10" />
    <path d="M7 18h10" />
  {/if}
</svg>

<style>
  .conn-icon {
    display: block;
    flex: 0 0 auto;
  }
</style>

<script lang="ts">
  /**
   * M4 connection-type icons (RES-113 PR-7). Small inline SVGs — never single
   * letters (08_ARTEFACTS.md: the single-letter avatars read poorly; use icons):
   *   mcp → plug · rest → exchange arrows. MVP ships MCP + REST only
   * (REC-ADR-018 addendum §1) — the widget/SDK/GraphQL icons left with their
   * deferred methods. currentColor throughout so the brutalist tokens drive colour.
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
  {/if}
</svg>

<style>
  .conn-icon {
    display: block;
    flex: 0 0 auto;
  }
</style>

<script lang="ts">
  /**
   * Static brutalist knowledge-graph preview for marketing proof cards.
   * Inspired by SOPHIA graph workspace (source → claim → group) — no live canvas dependency.
   */
  export let ariaLabel = "Sample knowledge graph with sources, claims, and groups";
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 200 120"
  width="100%"
  height="100%"
  role="img"
  aria-label={ariaLabel}
  class="graph-preview"
>
  <title>{ariaLabel}</title>
  <!-- Canvas field -->
  <rect x="0" y="0" width="200" height="120" fill="var(--brut-white, #fff)" stroke="var(--brut-ink, #000)" stroke-width="2"/>
  <!-- Grid ticks -->
  <g opacity="0.15" stroke="var(--brut-ink, #000)" stroke-width="1">
    <line x1="0" y1="40" x2="200" y2="40"/>
    <line x1="0" y1="80" x2="200" y2="80"/>
    <line x1="50" y1="0" x2="50" y2="120"/>
    <line x1="150" y1="0" x2="150" y2="120"/>
  </g>
  <!-- Edges -->
  <g stroke="var(--brut-ink, #000)" stroke-width="2" fill="none">
    <line x1="44" y1="34" x2="88" y2="58"/>
    <line x1="44" y1="86" x2="88" y2="58"/>
    <line x1="112" y1="58" x2="156" y2="38"/>
    <line x1="112" y1="58" x2="156" y2="78"/>
    <!-- Ghost edge (dashed) -->
    <line x1="156" y1="38" x2="156" y2="78" stroke-dasharray="4 3" opacity="0.45"/>
  </g>
  <!-- Source nodes -->
  <g>
    <rect x="8" y="18" width="36" height="32" fill="var(--brut-blue, #4d96ff)" stroke="var(--brut-ink, #000)" stroke-width="2"/>
    <text x="26" y="38" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7" font-weight="700" fill="var(--brut-ink, #000)">SRC</text>
    <rect x="8" y="70" width="36" height="32" fill="var(--brut-blue, #4d96ff)" stroke="var(--brut-ink, #000)" stroke-width="2"/>
    <text x="26" y="90" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7" font-weight="700" fill="var(--brut-ink, #000)">SRC</text>
  </g>
  <!-- Claim node -->
  <rect x="76" y="42" width="36" height="32" fill="var(--brut-neon, #ffde4d)" stroke="var(--brut-ink, #000)" stroke-width="2"/>
  <text x="94" y="62" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7" font-weight="700" fill="var(--brut-ink, #000)">CLAIM</text>
  <!-- Group nodes -->
  <rect x="144" y="22" width="36" height="32" fill="var(--brut-coral, #ff6b6b)" stroke="var(--brut-ink, #000)" stroke-width="2"/>
  <text x="162" y="42" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7" font-weight="700" fill="var(--brut-ink, #000)">GRP</text>
  <rect x="144" y="62" width="36" height="32" fill="var(--brut-canvas, #f0e6d2)" stroke="var(--brut-ink, #000)" stroke-width="2"/>
  <text x="162" y="82" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7" font-weight="700" fill="var(--brut-ink, #000)">GRP</text>
  <!-- Ghost node hint -->
  <circle cx="168" cy="92" r="4" fill="var(--brut-ink, #000)" opacity="0.25"/>
  <!-- Legend -->
  <text x="6" y="114" font-family="ui-monospace, monospace" font-size="6" fill="var(--brut-muted, #333)">12 nodes · 18 edges · ghost layer</text>
</svg>

<style>
  .graph-preview {
    display: block;
    min-height: 5.5rem;
  }
</style>

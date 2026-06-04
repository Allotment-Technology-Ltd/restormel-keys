<script lang="ts">
  /** Canonical Restormel brand mark + lockup (neo-brutalist). Inline SVG — inherits --brut-font. */
  export let variant: "lockup" | "mark" = "lockup";
  /** Rendered height in CSS pixels. */
  export let height = 32;
  export let title = "Restormel";
  export let decorative = false;
  /** Show neon + blueprint accent rules under the wordmark (lockup only). */
  export let accent = true;

  const MARK = 64;
  const LOCKUP_W = 292;
  const LOCKUP_H = 64;

  $: aspect = variant === "mark" ? 1 : LOCKUP_W / LOCKUP_H;
  $: width = Math.round(height * aspect);
  $: viewBox = variant === "mark" ? `0 0 ${MARK} ${MARK}` : `0 0 ${LOCKUP_W} ${LOCKUP_H}`;
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox={viewBox}
  width={width}
  height={height}
  fill="none"
  role={decorative ? "presentation" : "img"}
  aria-hidden={decorative ? true : undefined}
  aria-label={decorative ? undefined : title}
  class="restormel-logo"
>
  {#if !decorative}
    <title>{title}</title>
  {/if}

  <g class="restormel-logo-mark">
    <rect x="8" y="8" width="48" height="48" fill="var(--brut-ink, #000)" />
    <rect
      x="4"
      y="4"
      width="48"
      height="48"
      fill="var(--brut-white, #fff)"
      stroke="var(--brut-ink, #000)"
      stroke-width="4"
    />
    <rect x="12" y="12" width="15" height="15" fill="var(--brut-blue, #4d96ff)" />
    <rect x="29" y="12" width="15" height="15" fill="var(--brut-neon, #ffde4d)" />
    <rect x="12" y="29" width="15" height="15" fill="var(--brut-coral, #ff6b6b)" />
    <rect x="29" y="29" width="15" height="15" fill="var(--brut-canvas, #f0e6d2)" />
    <line x1="28" y1="12" x2="28" y2="44" stroke="var(--brut-ink, #000)" stroke-width="3" />
    <line x1="12" y1="28" x2="44" y2="28" stroke="var(--brut-ink, #000)" stroke-width="3" />
    <rect
      x="23"
      y="23"
      width="10"
      height="10"
      fill="var(--brut-neon, #ffde4d)"
      stroke="var(--brut-ink, #000)"
      stroke-width="2"
    />
    <path d="M11 11 H15 V13 H13 V15 H11 Z" fill="var(--brut-blue, #4d96ff)" />
    <path d="M53 11 H49 V13 H51 V15 H53 Z" fill="var(--brut-blue, #4d96ff)" />
    <path d="M11 53 H15 V51 H13 V49 H11 Z" fill="var(--brut-blue, #4d96ff)" />
    <path d="M53 53 H49 V51 H51 V49 H53 Z" fill="var(--brut-blue, #4d96ff)" />
    <rect x="0" y="26" width="4" height="12" fill="var(--brut-ink, #000)" />
    <rect x="52" y="26" width="8" height="12" fill="var(--brut-ink, #000)" />
  </g>

  {#if variant === "lockup"}
    <text
      x="76"
      y="43"
      fill="var(--brut-ink, #000)"
      font-family="var(--brut-font, ui-monospace, monospace)"
      font-size="28"
      font-weight="800"
      letter-spacing="0.1em"
    >
      RESTORMEL
    </text>
    {#if accent}
      <rect
        x="76"
        y="52"
        width="118"
        height="4"
        fill="var(--brut-neon, #ffde4d)"
        stroke="var(--brut-ink, #000)"
        stroke-width="1"
      />
      <rect
        x="76"
        y="58"
        width="72"
        height="3"
        fill="var(--brut-blue, #4d96ff)"
        stroke="var(--brut-ink, #000)"
        stroke-width="1"
      />
    {/if}
  {/if}
</svg>

<style>
  .restormel-logo {
    display: block;
    flex-shrink: 0;
  }
</style>

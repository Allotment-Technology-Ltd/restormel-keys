<script lang="ts">
  /**
   * Hero visual — suite layer thesis + outcomes.
   * Complements ProductDemo (step-by-step); does not repeat route/connect config cards.
   */
  export let suiteExpanded = true;

  const capabilitiesFull = [
    { id: "route", label: "Route", sub: "Keys · fallback chains" },
    { id: "assure", label: "Assure", sub: "Testing · CI gates" },
    { id: "visualise", label: "Visualise", sub: "Graph · explorer UI" },
    { id: "connect", label: "Connect", sub: "Ingest · verify · retrieve" },
  ] as const;

  const capabilitiesCompact = [
    { id: "route", label: "Route", sub: "Keys · fallback chains" },
    { id: "connect", label: "Connect", sub: "Ingest · verify · retrieve" },
  ] as const;

  $: capabilities = suiteExpanded ? capabilitiesFull : capabilitiesCompact;

  $: outcomes = suiteExpanded
    ? [
        { title: "Swap models without redeploying", body: "Change resolve chains in the dashboard — your app keeps the same API." },
        { title: "Agents grounded in verified context", body: "Ingest sources once; retrieve and verify claims against material." },
        { title: "Catch regressions before users do", body: "Restormel Testing runs behavior checks in CI with your real routes." },
      ]
    : [
        { title: "Swap models without redeploying", body: "Fallback chains and policies live in one workspace — not in app code." },
        { title: "Agents grounded in verified context", body: "Pipeline from sources to graph store with claim verification built in." },
        { title: "BYOK end to end", body: "Provider keys and graph data stay in infrastructure you control." },
      ];
</script>

<figure class="hero-visual" aria-labelledby="hero-visual-heading">
  <figcaption id="hero-visual-heading" class="hero-visual-eyebrow">How Restormel sits in your stack</figcaption>

  <div class="hero-visual-flow" aria-hidden="true">
    <svg class="hero-flow-svg" viewBox="0 0 440 120" preserveAspectRatio="xMidYMid meet">
      <!-- Your product -->
      <rect class="flow-box flow-box-app" x="8" y="28" width="96" height="64" rx="0" />
      <text class="flow-label" x="56" y="52" text-anchor="middle">Your product</text>
      <text class="flow-sublabel" x="56" y="68" text-anchor="middle">App · agent · CI</text>
      <!-- Arrow 1 -->
      <line class="flow-line" x1="108" y1="60" x2="128" y2="60" />
      <polygon class="flow-arrow" points="128,56 136,60 128,64" />
      <!-- Restormel layer -->
      <rect class="flow-box flow-box-suite" x="140" y="16" width="160" height="88" rx="0" />
      <text class="flow-label flow-label-suite" x="220" y="38" text-anchor="middle">Restormel</text>
      <text class="flow-sublabel flow-sublabel-suite" x="220" y="52" text-anchor="middle">One signed-in layer</text>
      <!-- mini capability ticks inside suite box -->
      <line class="flow-tick" x1="156" y1="62" x2="284" y2="62" />
      <text class="flow-cap" x="220" y="78" text-anchor="middle">
        {suiteExpanded ? "Route · Assure · Graph · Connect" : "Route · Connect"}
      </text>
      <!-- Arrow 2 -->
      <line class="flow-line" x1="304" y1="60" x2="324" y2="60" />
      <polygon class="flow-arrow" points="324,56 332,60 324,64" />
      <!-- Your stack -->
      <rect class="flow-box flow-box-stack" x="336" y="28" width="96" height="64" rx="0" />
      <text class="flow-label" x="384" y="52" text-anchor="middle">Your stack</text>
      <text class="flow-sublabel" x="384" y="68" text-anchor="middle">Providers · DB · keys</text>
    </svg>
  </div>

  <ul class="hero-cap-grid" aria-label="Restormel capabilities">
    {#each capabilities as cap (cap.id)}
      <li class="hero-cap-cell">
        <span class="hero-cap-label">{cap.label}</span>
        <span class="hero-cap-sub">{cap.sub}</span>
      </li>
    {/each}
  </ul>

  <ul class="hero-outcome-grid" aria-label="What you get">
    {#each outcomes as item, i}
      <li class="hero-outcome-cell">
        <span class="hero-outcome-idx" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
        <div>
          <p class="hero-outcome-title">{item.title}</p>
          <p class="hero-outcome-body">{item.body}</p>
        </div>
      </li>
    {/each}
  </ul>

  <p class="hero-visual-foot">
    <a class="hero-visual-scroll" href="#first-run-demo">Walk the first-run pipeline below ↓</a>
  </p>
</figure>

<style>
  .hero-visual {
    margin: 0;
    border: var(--border);
    box-shadow: var(--shadow-md);
    background: var(--color-surface);
    display: flex;
    flex-direction: column;
  }

  .hero-visual-eyebrow {
    margin: 0;
    padding: 0.65rem 0.875rem;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    border-bottom: var(--border);
    background: var(--color-bg-deep);
    color: var(--color-ink);
  }

  .hero-visual-flow {
    padding: var(--space-4) var(--space-3);
    border-bottom: var(--border);
    background: var(--color-bg);
  }

  .hero-flow-svg {
    display: block;
    width: 100%;
    max-width: 28rem;
    margin: 0 auto;
    height: auto;
  }

  .hero-flow-svg .flow-box {
    fill: var(--color-surface);
    stroke: var(--color-ink);
    stroke-width: 2;
  }

  .hero-flow-svg .flow-box-suite {
    fill: var(--color-yellow);
  }

  .hero-flow-svg .flow-label {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    fill: var(--color-ink);
  }

  .hero-flow-svg .flow-sublabel {
    font-family: var(--font-mono);
    font-size: 7px;
    fill: var(--color-ink-muted);
  }

  .hero-flow-svg .flow-line {
    stroke: var(--color-ink);
    stroke-width: 2;
  }

  .hero-flow-svg .flow-arrow {
    fill: var(--color-ink);
  }

  .hero-flow-svg .flow-tick {
    stroke: color-mix(in oklab, var(--color-ink) 35%, transparent);
    stroke-width: 1;
  }

  .hero-flow-svg .flow-cap {
    font-family: var(--font-mono);
    font-size: 6.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    fill: var(--color-ink);
  }

  .hero-cap-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    border-bottom: var(--border);
  }

  .hero-cap-cell {
    padding: var(--space-3);
    border-right: var(--border-thin);
    border-bottom: var(--border-thin);
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .hero-cap-cell:nth-child(2n) {
    border-right: none;
  }

  .hero-cap-grid:has(.hero-cap-cell:nth-child(4)) .hero-cap-cell:nth-last-child(-n + 2) {
    border-bottom: none;
  }

  .hero-cap-grid:not(:has(.hero-cap-cell:nth-child(4))) .hero-cap-cell {
    border-bottom: none;
  }

  .hero-cap-label {
    font-family: var(--font-display);
    font-size: var(--text-display-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    line-height: 1;
    color: var(--color-ink);
  }

  .hero-cap-sub {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
    letter-spacing: 0.04em;
  }

  .hero-outcome-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .hero-outcome-cell {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-thin);
    align-items: start;
  }

  .hero-outcome-cell:last-child {
    border-bottom: none;
  }

  .hero-outcome-idx {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink-faint);
    letter-spacing: 0.08em;
    padding-top: 0.1rem;
  }

  .hero-outcome-title {
    margin: 0 0 0.25rem;
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    font-weight: 600;
    color: var(--color-ink);
    line-height: 1.35;
  }

  .hero-outcome-body {
    margin: 0;
    font-size: var(--text-body-sm);
    color: var(--color-ink-muted);
    line-height: 1.45;
  }

  .hero-visual-foot {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border-top: var(--border);
    background: var(--color-bg-deep);
    text-align: center;
  }

  .hero-visual-scroll {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink);
    text-decoration: none;
  }

  .hero-visual-scroll:hover {
    text-decoration: underline;
  }

  @media (min-width: 640px) {
    .hero-cap-grid {
      grid-template-columns: repeat(4, 1fr);
    }

    .hero-cap-grid:not(:has(.hero-cap-cell:nth-child(4))) {
      grid-template-columns: repeat(2, 1fr);
    }

    .hero-cap-cell {
      border-bottom: none;
      border-right: var(--border-thin);
    }

    .hero-cap-cell:last-child {
      border-right: none;
    }
  }

  @media (max-width: 639px) {
    .hero-cap-grid:has(.hero-cap-cell:nth-child(4)) .hero-cap-cell:nth-child(3),
    .hero-cap-grid:has(.hero-cap-cell:nth-child(4)) .hero-cap-cell:nth-child(4) {
      border-bottom: none;
    }
  }
</style>

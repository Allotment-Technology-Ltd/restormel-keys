<script lang="ts">
  import type { SuiteModule } from "$lib/suite/suite-modules";

  export let modules: SuiteModule[] = [];

  const keysCode = `# resolve chain config
route:   production-default
primary: openai/gpt-4o-mini
fallback: anthropic/claude-3-5
policy:  cost-cap-pass`;

  const connectCode = `# verified-context layer
ingest:   sources → bound claims
retrieve: graph + vector hybrid
verify:   bar ≥90% supported / ≤2% unsupp.
domain:   configurable schema`;

  function tagClass(mod: SuiteModule): string {
    return mod.id === "keys" ? "yellow" : mod.id === "connect" ? "blue" : "secondary";
  }

  function tagLabel(mod: SuiteModule): string {
    return mod.capability;
  }

  function subtitle(mod: SuiteModule): string {
    if (mod.id === "keys") return "Model routing & BYOK custody";
    if (mod.id === "connect") return "Agent-ready knowledge infrastructure";
    return mod.summary.split("—")[0]?.trim() ?? mod.summary;
  }

  function codeSample(mod: SuiteModule): string {
    if (mod.id === "keys") return keysCode;
    if (mod.id === "connect") return connectCode;
    return mod.proofLabel;
  }

  function linkLabel(mod: SuiteModule): string {
    const label = mod.dashboardLabel;
    return label.endsWith("→") ? label : `${label} →`;
  }
</script>

<div class="products-grid">
  {#each modules as mod (mod.id)}
    <article class="product-card" data-card>
      <div class="product-card-head">
        <div>
          <h3 class="product-card-name">{mod.product}</h3>
          <p class="product-card-sub">{subtitle(mod)}</p>
        </div>
        <span class="product-tag" class:yellow={tagClass(mod) === "yellow"} class:blue={tagClass(mod) === "blue"}>
          {tagLabel(mod)}
        </span>
      </div>
      <div class="product-card-body">
        <p class="product-card-desc">{mod.summary}</p>
        <pre class="product-code" aria-label="Sample {mod.proofLabel}"><code>{codeSample(mod)}</code></pre>
        <a class="product-link" href={mod.href}>{linkLabel(mod)}</a>
      </div>
    </article>
  {/each}
</div>

<style>
  .products-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  .product-card {
    background: var(--color-surface);
    border: 2px solid var(--color-ink);
    border-radius: 0;
    box-shadow: 4px 4px 0 var(--color-ink);
    transition: transform 100ms ease, box-shadow 100ms ease;
  }

  .product-card:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 var(--color-ink);
  }

  .product-card-head {
    padding: 1rem 1.25rem;
    border-bottom: var(--border);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .product-card-name {
    font-family: var(--font-display);
    font-size: var(--text-display-sm);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    margin: 0;
    color: var(--color-ink);
  }

  .product-card-sub {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-ink-faint);
    margin: 2px 0 0;
  }

  .product-tag {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 3px 8px;
    border: var(--border);
    background: transparent;
    color: var(--color-ink);
  }

  .product-tag.yellow {
    background: var(--color-yellow);
  }

  .product-tag.blue {
    background: var(--color-blue);
    color: var(--color-surface);
  }

  .product-card-body {
    padding: 1.25rem;
  }

  .product-card-desc {
    font-size: var(--text-body-sm);
    color: var(--color-ink-muted);
    line-height: var(--text-body-line-height);
    margin: 0 0 1rem;
  }

  .product-code {
    background: var(--code-bg);
    border: 2px solid var(--code-bg);
    border-left: 3px solid var(--color-yellow);
    border-radius: 0;
    box-shadow: 3px 3px 0 var(--color-yellow);
    padding: 0.875rem 1rem 0.875rem calc(1rem + 3px);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.8;
    color: #d4cebc;
    overflow-x: auto;
    margin: 0;
    white-space: pre;
  }

  .product-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-ink);
    text-decoration: none;
    margin-top: 1rem;
    border-bottom: 2px solid var(--color-ink);
    transition: gap 0.15s ease;
  }

  .product-link:hover {
    gap: 9px;
    background: transparent;
    text-decoration: none;
  }

  @media (max-width: 900px) {
    .products-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  export let data: {
    model: {
      id: string;
      canonicalName: string;
      family: string | null;
      lifecycleState: string | null;
      description: string | null;
      contextWindow: number | null;
      maxOutputTokens: number | null;
      modalities: string[] | null;
      capabilities: string[] | null;
      editorialSummary: string | null;
      deprecationDate: number | null;
      retirementDate: number | null;
      replacementModelId: string | null;
      sourceLastVerifiedAt: number | null;
    } | null;
    variants: {
      id: string;
      providerIntegrationType: string;
      catalogProviderId: string;
      providerModelId: string;
      availabilityStatus: string | null;
      pricingRef: string | null;
      inDefaultAllowlist: boolean;
      crowdObservation: {
        deprecatedReportCount: number;
        retiredReportCount: number;
        firstReportedAt: number | null;
        lastReportedAt: number | null;
      } | null;
    }[];
    error: string | null;
  };

  function lifecycleBadge(state: string | null): string {
    if (!state) return "—";
    const s = state.toLowerCase();
    if (s === "deprecated" || s === "retired") return "deprecated";
    if (s === "preview" || s === "beta") return "preview";
    return "current";
  }

  function formatDate(ts: number | null): string {
    if (ts == null) return "—";
    return new Date(ts).toLocaleDateString();
  }

  $: allowlistAligned = data.variants.filter((v) => v.inDefaultAllowlist).length;
  $: variantTotal = data.variants.length;
</script>

{#if data.error || !data.model}
  <p class="error-msg" role="alert">{data.error ?? "Model not found."}</p>
  <p><a href={DASHBOARD_BASE + "/models"} class="back-link">← Back to Model catalog</a></p>
{:else}
  <p><a href={DASHBOARD_BASE + "/models"} class="back-link">← Back to Model catalog</a></p>
  <h1 class="page-title">{data.model.canonicalName}</h1>
  <p class="page-desc">
    <span class="lifecycle-badge lifecycle-{lifecycleBadge(data.model.lifecycleState)}">
      {data.model.lifecycleState ?? "—"}
    </span>
    {#if data.model.family}
      · Family: {data.model.family}
    {/if}
  </p>
  <section class="section section-compact" aria-labelledby="catalog-context-heading">
    <h2 id="catalog-context-heading" class="section-title">Canonical catalog context</h2>
    <p class="section-desc">
      This page shows <strong>database-backed</strong> catalog rows. The public feed at
      <a href="/keys/dashboard/api/catalog"><code>/keys/dashboard/api/catalog</code></a>
      (contract <code>2026-03-26.catalog.v6</code>) merges these variants with the default allowlist in
      <code>@restormel/keys</code>, crowd observations, and credential-free provider signals (OpenRouter, status pages).
      Read <a href="/keys/docs/guides/canonical-catalog">Canonical catalog</a> for how clients should consume upgrades and freshness.
    </p>
    {#if variantTotal > 0}
      <p class="catalog-stats">
        <span class="chip">Default allowlist: {allowlistAligned}/{variantTotal} variants</span>
      </p>
    {/if}
  </section>

  {#if data.model.description}
    <section class="section">
      <h2 class="section-title">Description</h2>
      <p class="section-desc">{data.model.description}</p>
    </section>
  {/if}

  <section class="section" aria-labelledby="summary-heading">
    <h2 id="summary-heading" class="section-title">Summary</h2>
    <dl class="summary-dl">
      {#if data.model.contextWindow != null}
        <dt>Context window</dt>
        <dd>{data.model.contextWindow.toLocaleString()}</dd>
      {/if}
      {#if data.model.maxOutputTokens != null}
        <dt>Max output tokens</dt>
        <dd>{data.model.maxOutputTokens.toLocaleString()}</dd>
      {/if}
      {#if data.model.modalities?.length}
        <dt>Modalities</dt>
        <dd>{data.model.modalities.join(", ")}</dd>
      {/if}
      {#if data.model.deprecationDate != null || data.model.retirementDate != null}
        <dt>Deprecation</dt>
        <dd>{formatDate(data.model.deprecationDate)}</dd>
        <dt>Retirement</dt>
        <dd>{formatDate(data.model.retirementDate)}</dd>
      {/if}
      {#if data.model.replacementModelId}
        <dt>Replacement</dt>
        <dd><a href={DASHBOARD_BASE + "/models/" + data.model.replacementModelId}>{data.model.replacementModelId}</a></dd>
      {/if}
      <dt>Source</dt>
      <dd>{data.model.sourceLastVerifiedAt != null ? "Last verified: " + formatDate(data.model.sourceLastVerifiedAt) : "Not yet verified"}</dd>
    </dl>
    {#if data.model.editorialSummary}
      <p class="editorial">{data.model.editorialSummary}</p>
    {/if}
  </section>

  {#if data.model.lifecycleState && (data.model.lifecycleState.toLowerCase() === "deprecated" || data.model.lifecycleState.toLowerCase() === "retired")}
    <section class="section" aria-labelledby="migration-heading">
      <h2 id="migration-heading" class="section-title">Migration</h2>
      <p class="section-desc">
        {#if data.model.replacementModelId}
          Consider migrating to <a href={DASHBOARD_BASE + "/models/" + data.model.replacementModelId}>{data.model.replacementModelId}</a>.
        {/if}
        See <a href={DASHBOARD_BASE + "/lifecycle"}>Lifecycle & Migrations</a> for guidance.
      </p>
    </section>
  {/if}

  <section class="section" aria-labelledby="variants-heading">
    <h2 id="variants-heading" class="section-title">Provider variants</h2>
    <p class="section-desc">
      Each row is a concrete provider model id. <strong>Catalog provider id</strong> is what the allowlist and crowd keys use (falls back to integration type when unset).
      Pricing and rate limits are referenced by ref (not shown here).
    </p>
    {#if data.variants.length === 0}
      <p class="muted">No provider variants in catalog yet. Full discovery can populate this.</p>
    {:else}
      <ul class="variant-list">
        {#each data.variants as v}
          <li class="variant-row">
            <span class="variant-provider">{v.catalogProviderId}</span>
            <span class="variant-integration muted-small">{v.providerIntegrationType}</span>
            <span class="variant-model-id">{v.providerModelId}</span>
            {#if v.inDefaultAllowlist}
              <span class="chip chip-allow">on default allowlist</span>
            {:else}
              <span class="chip chip-off">not on default allowlist</span>
            {/if}
            {#if v.crowdObservation}
              <span class="chip chip-crowd" title="Crowd reports from apps (deprecated / retired vendor signals)">
                crowd: dep {v.crowdObservation.deprecatedReportCount} · ret {v.crowdObservation.retiredReportCount}
                {#if v.crowdObservation.lastReportedAt != null}
                  · last {formatDate(v.crowdObservation.lastReportedAt)}
                {/if}
              </span>
            {/if}
            {#if v.availabilityStatus}
              <span class="variant-status">{v.availabilityStatus}</span>
            {/if}
            {#if v.pricingRef}
              <span class="variant-pricing">pricing ref set</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .back-link {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    margin-bottom: var(--space-4);
    display: inline-block;
  }
  .back-link:hover {
    text-decoration: underline;
  }
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
  }
  .lifecycle-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: var(--text-xs);
  }
  .lifecycle-current {
    background: var(--color-yellow);
    color: var(--color-ink);
  }
  .lifecycle-preview {
    background: var(--rm-surface);
    color: var(--rm-text);
    border: 1px solid var(--rm-border);
  }
  .lifecycle-deprecated {
    background: var(--coral-alert);
    color: white;
  }
  .section {
    margin-bottom: var(--space-6);
  }
  .section-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-1);
  }
  .section-compact {
    padding: var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
  }
  .catalog-stats {
    margin: var(--space-2) 0 0;
    font-size: var(--text-sm);
  }
  .section-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-3);
    line-height: 1.5;
  }
  .section-desc a {
    color: var(--rm-sage);
  }
  .muted-small {
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .chip {
    display: inline-block;
    border: 1px solid var(--rm-border);
    border-radius: 999px;
    padding: 2px 8px;
    font-size: var(--text-xs);
    color: var(--rm-muted);
    background: var(--rm-bg);
  }
  .chip-allow {
    border-color: var(--rm-sage);
    color: var(--rm-text);
  }
  .chip-off {
    opacity: 0.85;
  }
  .chip-crowd {
    border-color: var(--coral-alert);
    color: var(--rm-text);
  }
  .summary-dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-1) var(--space-4);
    font-size: var(--text-sm);
  }
  .summary-dl dt {
    color: var(--rm-muted);
  }
  .summary-dl dd {
    margin: 0;
  }
  .editorial {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    margin-top: var(--space-3);
  }
  .variant-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .variant-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
    font-size: var(--text-sm);
  }
  .variant-provider {
    font-weight: 500;
    color: var(--rm-text);
  }
  .variant-model-id {
    color: var(--rm-muted);
  }
  .variant-status, .variant-pricing {
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .muted {
    font-size: var(--text-sm);
    color: var(--rm-dim);
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
</style>

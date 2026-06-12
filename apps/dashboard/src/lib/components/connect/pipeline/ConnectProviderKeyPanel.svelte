<script lang="ts">
  /**
   * R4 — the provider-key step of the guided flow (§1.1 step 2). Lightweight:
   * the full verify-on-save UI lives on `/integrations`; this panel routes there
   * through the `returnTo=pipeline-setup&step=provider` loop (the layout's return
   * banner brings the operator back to this exact step). Shown only when no
   * provider integration exists yet; once one is verified it confirms and the
   * footer's Continue advances to Sources.
   */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { withReturnTo } from "$lib/connect/pipeline-config";

  /** At least one provider integration exists. */
  export let hasProviderKey = false;
  /** Chat + embedding routes are publishable (a verified key alone isn't enough to run). */
  export let modelsReady = false;

  const INTEGRATIONS_HREF = withReturnTo(DASHBOARD_BASE + "/integrations", {
    kind: "pipeline-setup",
    step: "provider",
  });
</script>

<div class="provider-panel">
  {#if hasProviderKey}
    <div class="provider-verified" role="status">
      <span class="provider-glyph" aria-hidden="true">✓</span>
      <div class="provider-verified-body">
        <p class="provider-verified-title">Provider key connected — verified.</p>
        <p class="provider-verified-sub">
          {#if modelsReady}
            Chat and embedding routes are ready. Continue to choose your sources.
          {:else}
            Publish at least one chat route and one embedding route so ingest can extract, group,
            validate, and embed your documents.
          {/if}
        </p>
        <div class="provider-actions">
          <a class="btn btn-outline btn-sm" href={INTEGRATIONS_HREF}>Manage provider keys →</a>
        </div>
      </div>
    </div>
  {:else}
    <div class="provider-empty">
      <p class="provider-empty-title">No provider key yet</p>
      <p class="provider-empty-sub">
        Add one AI provider key — it's verified live against the provider the moment you save (a
        real authentication probe, not a placebo). You'll land back here when it's connected.
      </p>
      <div class="provider-actions">
        <a class="btn btn-primary" href={INTEGRATIONS_HREF}>Add a provider key →</a>
      </div>
    </div>
  {/if}
</div>

<style>
  .provider-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .provider-empty,
  .provider-verified {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-4);
    border: var(--border);
    background: var(--color-bg);
  }
  .provider-empty {
    flex-direction: column;
  }
  .provider-glyph {
    font-family: var(--font-mono);
    font-weight: 900;
    font-size: var(--text-display-sm, 1.5rem);
    color: var(--color-ink);
    line-height: 1;
  }
  .provider-verified-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .provider-empty-title,
  .provider-verified-title {
    font-family: var(--font-display);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    margin: 0;
    color: var(--color-ink);
  }
  .provider-empty-sub,
  .provider-verified-sub {
    margin: 0;
    color: var(--color-ink-muted);
  }
  .provider-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }
</style>

<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import PlaceholderPage from "$lib/components/PlaceholderPage.svelte";
</script>

<PlaceholderPage
  title="Lifecycle & Migrations"
  description="Lifecycle state for models, plus what you can do today to reduce deprecation risk during route resolution."
  links={[
    { href: DASHBOARD_BASE + "/models", label: "Model catalog (lifecycle state is shown per model)" },
    { href: "/keys/docs/walkthrough/phase-4-policies", label: "Walkthrough: Phase 4 policies (deprecated_model_block)" },
  ]}
/>

<section class="section" aria-labelledby="available-heading">
  <h2 id="available-heading" class="section-title">Available now</h2>
  <ul class="section-list">
    <li><strong>Model catalog lifecycle state</strong> — Each model shows a lifecycle state (current / preview / deprecated / retired) at <a href={DASHBOARD_BASE + "/models"}>Models</a>.</li>
    <li><strong>Deprecated-model blocking</strong> — Use the <code>deprecated_model_block</code> policy to block deprecated models during resolution. See <a href="/keys/docs/walkthrough/phase-4-policies">Phase 4 policies</a> for the creation flow and test curl examples.</li>
  </ul>
</section>

<section class="section" aria-labelledby="coming-heading">
  <h2 id="coming-heading" class="section-title">Coming later</h2>
  <ul class="section-list">
    <li><strong>Proactive notices</strong> — deprecation notifications when models move to deprecated/retired.</li>
    <li><strong>Migration guidance</strong> — replacement suggestions and “what to change” checklists when a model is deprecated.</li>
    <li><strong>Automatic recommendations</strong> — safer defaults and suggested route updates when better replacements exist.</li>
  </ul>
</section>

<p class="honest-note" role="status">
  <strong>Accuracy note:</strong> Treat catalog lifecycle labels as <strong>advisory</strong> until provider-backed ingestion is
  enabled in your deployment. Do not rely on them alone for automated compliance gates.
</p>

<style>
  .honest-note {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin-top: var(--space-4);
    padding: var(--space-3);
    background: var(--rm-surface-raised);
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
  }
  .section {
    margin-top: var(--space-6);
  }
  .section-title {
    font-size: var(--text-lg);
    margin: 0 0 var(--space-2);
  }
  .section-list {
    margin: 0;
    padding-left: var(--space-5);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .section-list li {
    margin: 0 0 var(--space-2);
  }
</style>

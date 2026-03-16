<script lang="ts">
  import { base } from "$app/paths";
  import PlaceholderPage from "$lib/components/PlaceholderPage.svelte";
</script>

<PlaceholderPage
  title="Lifecycle & Migrations"
  description="Model lifecycle events, deprecation notices, and migration guidance. This section will show when models move to deprecated or retired, and suggest replacements."
  links={[
    { href: base + "/models", label: "Model catalog (lifecycle state is shown per model)" },
  ]}
/>

<p class="honest-note" role="status">
  <strong>Placeholder.</strong> Full lifecycle accuracy depends on the ingestion system. Until then, lifecycle state in the model catalog may be placeholder-driven. We do not fabricate deprecation or migration dates here.
</p>
<p class="honest-note" role="status">
  Migration recommendations (e.g. prefer the replacement model when a model is deprecated) can be documented on this page. We do not hardcode confidence or fake verification; show source timestamps or “not yet verified” where appropriate.
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
</style>

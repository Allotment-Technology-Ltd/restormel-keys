<script lang="ts">
  import "$lib/components/connect/pipeline/connect-pipeline.css";
  import { HOME_HREF } from "$lib/nav-config";
</script>

<svelte:head>
  <title>Ingest – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="connect-pipeline">
  <section aria-labelledby="pipeline-heading">
    <p class="pipeline-exit">
      <a href={HOME_HREF}>← Home</a>
      <span class="pipeline-exit-note">Setup wizard — side tasks open in place with a return link.</span>
    </p>
    <h1 id="pipeline-heading" class="h1">Ingest your sources</h1>
    <p class="lede">Provider key, sources, domain, and review &amp; launch — your graph store is set up automatically. Wire agents from the Agents section afterwards.</p>
    <slot />
  </section>
</div>

<style>
  .pipeline-exit {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
  }
  .pipeline-exit a {
    font-weight: 700;
    color: var(--rm-text);
  }
  .pipeline-exit-note {
    color: var(--rm-muted);
    font-size: var(--text-xs);
  }
</style>

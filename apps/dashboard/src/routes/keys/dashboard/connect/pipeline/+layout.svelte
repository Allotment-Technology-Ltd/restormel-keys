<script lang="ts">
  import "$lib/components/connect/pipeline/connect-pipeline.css";
  import { CONNECT_HUB_HREF } from "$lib/nav-config";
</script>

<svelte:head>
  <title>Set up pipeline – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="connect-pipeline">
  <section aria-labelledby="pipeline-heading">
    <p class="pipeline-exit">
      <a href={CONNECT_HUB_HREF}>← Connect home</a>
      <span class="pipeline-exit-note">Setup wizard — side tasks open in place with a return link.</span>
    </p>
    <h1 id="pipeline-heading" class="h1">Set up your pipeline</h1>
    <p class="lede">Five short steps — graph store, domain, sources, review, then start your run.</p>
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

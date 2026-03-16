<script lang="ts">
  /** Section title (e.g. "Provider Integrations") */
  export let title: string;
  /** Short description of what this section will do */
  export let description: string;
  /** Optional links to related pages that exist */
  export let links: { href: string; label: string }[] = [];
</script>

<div class="placeholder" role="region" aria-labelledby="placeholder-heading">
  <h1 id="placeholder-heading" class="page-title">{title}</h1>
  <p class="page-desc">{description}</p>
  <p class="placeholder-note">This section is not fully implemented yet. It will be available in a future update.</p>
  {#if links.length > 0}
    <ul class="placeholder-links">
      {#each links as link}
        <li><a href={link.href}>{link.label}</a></li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .placeholder {
    max-width: var(--rm-container-narrow);
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
    margin: 0 0 var(--space-3);
  }
  .placeholder-note {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    font-style: italic;
    margin: 0 0 var(--space-4);
  }
  .placeholder-links {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .placeholder-links li {
    margin-bottom: var(--space-2);
  }
  .placeholder-links a {
    font-size: var(--text-sm);
    color: var(--rm-sage);
  }
  .placeholder-links a:hover {
    text-decoration: underline;
  }
</style>

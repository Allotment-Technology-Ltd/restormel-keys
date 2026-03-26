<script lang="ts">
  const docsIndex = [
    { title: "Docs overview", href: "/keys/docs", tags: "overview intro" },
    { title: "Walkthrough", href: "/keys/docs/walkthrough", tags: "phase migration" },
    { title: "Integrations walkthrough", href: "/keys/docs/integrations-walkthrough", tags: "cli mcp aaif" },
    { title: "Provider access modes", href: "/keys/docs/guides/provider-access-modes", tags: "gateway byok direct" },
    { title: "OpenRouter guide", href: "/keys/docs/guides/openrouter", tags: "openrouter" },
    { title: "Vercel AI Gateway guide", href: "/keys/docs/guides/vercel-ai-gateway", tags: "vercel gateway" },
    { title: "Portkey guide", href: "/keys/docs/guides/portkey", tags: "portkey" },
    {
      title: "Canonical catalog",
      href: "/keys/docs/guides/canonical-catalog",
      tags: "models providers catalog feed api integration third party global",
    },
    {
      title: "Cloud API",
      href: "/keys/docs/cloud-api",
      tags: "api resolve policies routes openapi gateway key models bindings project index allowlist ingestion picker",
    },
    { title: "Integrations overview", href: "/keys/docs/integrations", tags: "cli mcp aaif" },
    { title: "Compatibility", href: "/keys/docs/compatibility", tags: "next react svelte" },
  ];

  let q = "";
  $: results = docsIndex.filter((d) =>
    `${d.title} ${d.tags}`.toLowerCase().includes(q.trim().toLowerCase())
  );
</script>

<svelte:head>
  <title>Search docs — Restormel Keys</title>
</svelte:head>

<h1>Search docs</h1>
<p class="intro">Find the right Restormel docs path by keyword.</p>
<label class="search-label" for="docs-search">Keyword</label>
<input id="docs-search" bind:value={q} class="search-input" placeholder="e.g. resolve, byok, mcp, openrouter" />

<ul class="results">
  {#each results as item}
    <li><a href={item.href}>{item.title}</a></li>
  {/each}
</ul>

<style>
  .intro { color: var(--rm-muted); margin: 0 0 var(--space-3); }
  .search-label { display: block; font-size: var(--text-xs); color: var(--rm-muted); margin-bottom: var(--space-1); }
  .search-input {
    width: 100%;
    max-width: 32rem;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-bg);
    color: var(--rm-text);
    padding: var(--space-2) var(--space-3);
    margin-bottom: var(--space-3);
  }
  .results { margin: 0; padding-left: var(--space-5); }
  .results a { color: var(--rm-sage); }
</style>

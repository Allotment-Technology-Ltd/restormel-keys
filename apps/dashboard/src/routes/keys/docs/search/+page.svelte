<script lang="ts">
  import { page } from "$app/stores";
  import type { ModuleFlags } from "$lib/module-flags-types";
  import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

  type DocsIndexEntry = { title: string; href: string; tags: string };

  const docsIndexAll: DocsIndexEntry[] = [
    { title: "Docs overview", href: "/keys/docs", tags: "overview intro" },
    { title: "Walkthrough", href: "/keys/docs/walkthrough", tags: "phase migration" },
    { title: "Integrations walkthrough", href: "/keys/docs/integrations-walkthrough", tags: "cli mcp aaif" },
    {
      title: "Environment vocabulary",
      href: "/keys/docs/guides/environment-vocabulary",
      tags: "env RESTORMEL_GATEWAY_KEY RESTORMEL_SERVER_TOKEN RESTORMEL_EVALUATE_URL RESTORMEL_CONTROL_PLANE_URL RESTORMEL_KEYS_BASE CI staging secrets plot mcp",
    },
    {
      title: "Keys + Testing onboarding",
      href: "/keys/docs/guides/keys-testing-onboarding",
      tags: "testing restormel judge_rubric resolve connections hosted credentials RESTORMEL_PROJECT_ID doctor cli",
    },
    {
      title: "Database for self-hosters: Neon",
      href: "/keys/docs/guides/database-neon-for-self-hosters",
      tags: "neon postgres database self-host self host DATABASE_URL NEON_AUTH migration preview branch surreal graph sophia ingestion",
    },
    { title: "Provider access modes", href: "/keys/docs/guides/provider-access-modes", tags: "gateway byok direct" },
    { title: "OpenRouter guide", href: "/keys/docs/guides/openrouter", tags: "openrouter" },
    { title: "AiZolo quick start", href: "/keys/docs/guides/aizolo", tags: "aizolo chat completions openai compatible" },
    { title: "Vercel AI Gateway guide", href: "/keys/docs/guides/vercel-ai-gateway", tags: "vercel gateway" },
    { title: "Portkey guide", href: "/keys/docs/guides/portkey", tags: "portkey" },
    {
      title: "Canonical catalog",
      href: "/keys/docs/guides/canonical-catalog",
      tags: "models providers catalog feed api integration third party global",
    },
    {
      title: "Integration catalog",
      href: "/keys/docs/guides/integration-catalog",
      tags: "integrations neon vercel openrouter portkey zuplo github actions stack ecosystem third party index",
    },
    {
      title: "Verified context",
      href: "/keys/docs/guides/verified-context",
      tags: "verified context connect evidence provenance trace audit verification rules g2 trust score claims envelope ebv",
    },
    {
      title: "Context-regression CI",
      href: "/keys/docs/guides/context-regression-ci",
      tags: "ci gate github action forgejo connect eval baseline regression tolerance sticky comment quality bar g2 efficacy weekly cross-model exit codes",
    },
    {
      title: "Cloud API",
      href: "/keys/docs/cloud-api",
      tags: "api resolve policies routes openapi gateway key models bindings project index allowlist ingestion picker",
    },
    { title: "Integrations overview", href: "/keys/docs/integrations", tags: "cli mcp aaif" },
    { title: "Compatibility", href: "/keys/docs/compatibility", tags: "next react svelte" },
  ];

  function docsIndexForFlags(flags: ModuleFlags): DocsIndexEntry[] {
    return docsIndexAll.filter((d) => {
      if (!flags.testing && d.href === "/keys/docs/guides/keys-testing-onboarding") return false;
      if (!flags.environments && d.href === "/keys/docs/guides/environment-vocabulary") return false;
      if (
        !flags.gatewayProviders &&
        (d.href === "/keys/docs/guides/openrouter" ||
          d.href === "/keys/docs/guides/portkey" ||
          d.href === "/keys/docs/guides/vercel-ai-gateway")
      ) {
        return false;
      }
      return true;
    });
  }

  let q = "";
  $: flags = $page.data.moduleFlags ?? MVP_MODULE_DEFAULTS;
  $: docsIndex = docsIndexForFlags(flags);
  $: results = docsIndex.filter((d) =>
    `${d.title} ${d.tags}`.toLowerCase().includes(q.trim().toLowerCase()),
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
  {#each results as doc}
    <li><a href={doc.href}>{doc.title}</a></li>
  {/each}
</ul>

<style>
  .intro {
    color: var(--rm-muted);
    margin-bottom: var(--space-4);
  }
  .search-label {
    display: block;
    font-size: var(--text-sm);
    font-weight: 500;
    margin-bottom: var(--space-2);
  }
  .search-input {
    width: 100%;
    max-width: 28rem;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    margin-bottom: var(--space-4);
  }
  .results {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-2);
  }
  .results a {
    color: var(--rm-sage);
    text-decoration: none;
  }
  .results a:hover {
    text-decoration: underline;
  }
</style>

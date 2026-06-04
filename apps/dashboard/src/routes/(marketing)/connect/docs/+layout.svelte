<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { page } from "$app/stores";
  import { absoluteUrl } from "$lib/seo";
  import DocsShell from "$lib/components/docs/DocsShell.svelte";
  import { knowledgeDocsNavBlocks } from "$lib/connect/docs-nav";

  const STORAGE_KEY = "rk_knowledge_docs_sidebar_collapsed";

  $: pathname = $page.url.pathname;
  $: docsPathRaw = pathname.startsWith("/connect/docs")
    ? pathname.slice("/connect/docs".length) || ""
    : "";
  $: docsPath = docsPathRaw.replace(/^\/+/, "");
  $: pathSegments = docsPath ? docsPath.split("/").filter(Boolean) : [];
  $: breadcrumbItems = [
    { name: "Connect", path: "/connect" },
    { name: "Docs", path: "/connect/docs" },
    ...pathSegments.map((segment, i) => {
      const path = "/connect/docs/" + pathSegments.slice(0, i + 1).join("/");
      const name = segment.replace(/-/g, " ");
      return { name, path };
    }),
  ];

  $: footerLinks = [
    { href: DASHBOARD_BASE + "/connect", label: "Connect hub" },
    { href: "/keys/docs", label: "Keys docs" },
  ];
</script>

<svelte:head>
  <title>Docs — Restormel Connect</title>
  <meta property="og:site_name" content="Restormel Connect" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={absoluteUrl($page.url, $page.url.pathname)} />
  <meta property="twitter:card" content="summary" />
</svelte:head>

<DocsShell storageKey={STORAGE_KEY} navBlocks={knowledgeDocsNavBlocks} {breadcrumbItems} {footerLinks}>
  <aside slot="banner" class="docs-cross-product" aria-label="Related product">
    <strong>Restormel Keys</strong>
    — every Connect LLM stage resolves through Keys:
    <a href="/keys/docs">Keys documentation</a>
    ·
    <a href={DASHBOARD_BASE + "/connect"}>Connect hub</a> (dashboard)
  </aside>
  <slot />
</DocsShell>

<style>
  .docs-cross-product {
    font-size: var(--text-xs);
    color: var(--brut-ink);
    font-weight: 600;
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-2);
    padding: var(--space-3) var(--space-4);
    border: var(--brut-border-micro) solid var(--brut-ink);
    border-radius: 0;
    background: var(--brut-neon);
  }
  .docs-cross-product a {
    color: var(--brut-ink);
    font-weight: 800;
  }
  .docs-cross-product strong {
    color: var(--brut-ink);
  }
</style>

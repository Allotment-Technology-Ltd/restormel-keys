<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { developerPortalUrl } from "$lib/developer-portal-url";
  import { page } from "$app/stores";
  import { absoluteUrl } from "$lib/seo";
  import DocsShell from "$lib/components/docs/DocsShell.svelte";
  import type { LayoutData } from "./$types";

  export let data: LayoutData;

  const STORAGE_KEY = "rk_docs_sidebar_collapsed";

  $: pathname = $page.url.pathname;
  $: docsPathRaw = pathname.startsWith("/keys/docs") ? pathname.slice("/keys/docs".length) || "" : "";
  $: docsPath = docsPathRaw.replace(/^\/+/, "");
  $: pathSegments = docsPath ? docsPath.split("/").filter(Boolean) : [];
  $: breadcrumbItems = [
    { name: "Keys", path: "/keys" },
    { name: "Docs", path: "/keys/docs" },
    ...pathSegments.map((segment, i) => {
      const path = "/keys/docs/" + pathSegments.slice(0, i + 1).join("/");
      const name = segment.replace(/-/g, " ");
      return { name, path };
    }),
  ];

  $: portalUrl = developerPortalUrl();
  $: footerLinks = [
    { href: portalUrl, label: "API portal", external: true },
    { href: DASHBOARD_BASE, label: "Dashboard" },
    { href: DASHBOARD_BASE + "/login", label: "Sign in" },
  ];
</script>

<svelte:head>
  <title>Docs — Restormel Keys</title>
  <meta property="og:site_name" content="Restormel Keys" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={absoluteUrl($page.url, $page.url.pathname)} />
  <meta property="twitter:card" content="summary" />

  <script type="application/ld+json">
    {JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbItems.map((b, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: b.name,
        item: absoluteUrl($page.url, b.path),
      })),
    })}
  </script>
</svelte:head>

<DocsShell
  storageKey={STORAGE_KEY}
  navBlocks={data.keysDocsNavBlocks}
  {breadcrumbItems}
  {footerLinks}
>
  <div slot="banner">
    {#if data.moduleFlags.testing}
      <aside class="docs-cross-product" aria-label="Related product">
        <strong>Restormel Testing</strong>
        — CI goals, runner, and Keys-backed env:
        <a href="/testing/docs">Testing documentation</a>
        ·
        <a href={DASHBOARD_BASE + "/testing"}>Testing hub</a> (dashboard)
      </aside>
    {/if}
  </div>
  <slot />
</DocsShell>

<style>
  .docs-cross-product {
    font-size: var(--text-xs);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-2);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface-2);
  }
  .docs-cross-product a {
    color: var(--rm-sage);
    font-weight: 500;
  }
  .docs-cross-product strong {
    color: var(--rm-text);
  }
</style>

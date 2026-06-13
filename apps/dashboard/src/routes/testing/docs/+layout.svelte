<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { testingBase as base } from "$lib/testing/paths.js";
  import { page } from "$app/stores";
  import { absoluteUrl } from "$lib/seo";
  import DocsShell from "$lib/components/docs/DocsShell.svelte";
  import { testingDocsShellNav } from "$lib/testing/docs-nav.js";

  const STORAGE_KEY = "rk_testing_docs_sidebar_collapsed";
  const docsPrefix = `${base}/docs`;

  $: pathname = $page.url.pathname;
  $: navBlocks = testingDocsShellNav(base);
  $: docsPathRaw = pathname.startsWith(docsPrefix) ? pathname.slice(docsPrefix.length) || "" : "";
  $: docsPath = docsPathRaw.replace(/^\/+/, "");
  $: pathSegments = docsPath ? docsPath.split("/").filter(Boolean) : [];
  $: breadcrumbItems = [
    { name: "Testing", path: base },
    { name: "Docs", path: docsPrefix },
    ...pathSegments.map((segment, i) => {
      const path = `${docsPrefix}/` + pathSegments.slice(0, i + 1).join("/");
      const name = segment.replace(/-/g, " ");
      return { name, path };
    }),
  ];

  $: footerLinks = [
    { href: `${base}/docs`, label: "Docs home" },
    { href: DASHBOARD_BASE + "/testing", label: "Testing hub" },
    { href: DASHBOARD_BASE + "/login", label: "Sign in" },
  ];
</script>

<svelte:head>
  <title>Docs — Restormel Testing</title>
  <link rel="canonical" href={absoluteUrl($page.url, $page.url.pathname)} />
  <meta property="og:site_name" content="Restormel Testing" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={absoluteUrl($page.url, $page.url.pathname)} />
  <meta property="og:image" content={$page.url.origin + "/og/default.png"} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:image" content={$page.url.origin + "/og/default.png"} />

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

<DocsShell storageKey={STORAGE_KEY} {navBlocks} {breadcrumbItems} {footerLinks}>
  <aside slot="banner" class="docs-keys-cta" aria-label="Keys and Testing setup">
    <strong>Using Restormel Keys?</strong>
    Canonical setup for hosted credentials + CI env:
    <a href="https://restormel.dev/keys/docs/guides/keys-testing-onboarding" rel="noopener noreferrer"
      >Keys + Testing onboarding</a
    >
    · Dashboard hub:
    <a href="https://restormel.dev/keys/dashboard/testing" rel="noopener noreferrer">Restormel Testing</a>
    · Agents: MCP tools <code>testing.journey</code>, <code>testing.ci_env_template</code>,
    <code>testing.resolve_probe</code>.
  </aside>
  <slot />
</DocsShell>

<style>
  .docs-keys-cta {
    font-size: var(--text-xs);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface-2);
  }

  .docs-keys-cta a {
    color: var(--rm-sage);
    font-weight: 500;
  }

  .docs-keys-cta code {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: 0.88em;
  }
</style>

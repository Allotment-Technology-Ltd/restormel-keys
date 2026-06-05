<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { developerPortalUrl } from "$lib/developer-portal-url";
  import { page } from "$app/stores";
  import DocsShell from "$lib/components/docs/DocsShell.svelte";
  import { suiteDocsShellNav } from "$lib/suite/docs-nav";
  import SiteHeader from "$lib/components/site/SiteHeader.svelte";
  import SiteFooter from "$lib/components/site/SiteFooter.svelte";
  import { marketingShellPropsFromPage } from "$lib/marketing-shell-props";
  import "$lib/styles/marketing-shell.css";

  const STORAGE_KEY = "rm_suite_docs_sidebar_collapsed";

  $: shell = marketingShellPropsFromPage($page);
  $: user = shell.user;
  $: pathname = shell.pathname;
  $: docsPathRaw = pathname.startsWith("/docs") ? pathname.slice("/docs".length) || "" : "";
  $: docsPath = docsPathRaw.replace(/^\/+/, "");
  $: pathSegments = docsPath ? docsPath.split("/").filter(Boolean) : [];
  $: breadcrumbItems = [
    { name: "Restormel", path: "/" },
    { name: "Docs", path: "/docs" },
    ...pathSegments.map((segment, i) => {
      const path = "/docs/" + pathSegments.slice(0, i + 1).join("/");
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
  $: navBlocks = suiteDocsShellNav($page.data.moduleFlags ?? undefined);
</script>

<svelte:head>
  <title>Docs — Restormel</title>
</svelte:head>

<div class="marketing-shell">
  <SiteHeader {user} {pathname} />
  <DocsShell storageKey={STORAGE_KEY} navBlocks={navBlocks} {breadcrumbItems} {footerLinks}>
    <slot />
  </DocsShell>
  <SiteFooter moduleFlags={shell.moduleFlags} suiteModulesForUi={shell.suiteModulesForUi} />
</div>

<style>
  .marketing-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
</style>

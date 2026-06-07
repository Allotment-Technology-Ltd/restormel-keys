<script lang="ts">
  /**
   * API reference — rendered with Scalar directly from the live OpenAPI spec
   * (static/keys/openapi.json, copied at build time from the gateway's
   * config/routes.oas.json by scripts/copy-openapi.mjs). Client-side only so the
   * Vercel/SSR build cost stays ~zero and we never hit the zudoku build problem.
   */
  import { onMount, onDestroy } from "svelte";
  import "@scalar/api-reference/style.css";

  let container: HTMLDivElement;
  let app: { destroy?: () => void } | undefined;
  let failed = false;

  // Nudge Scalar toward the Restormel neo-brutalist look (square corners, ink
  // borders, yellow accent). Full theming pass tracked in the docs-IA work.
  const customCss = `
    .scalar-app {
      --scalar-radius: 0px;
      --scalar-radius-lg: 0px;
      --scalar-radius-xl: 0px;
      --scalar-font: "DM Sans", system-ui, sans-serif;
      --scalar-font-code: "Space Mono", ui-monospace, monospace;
    }
    .light-mode {
      --scalar-color-accent: #0c0c0c;
      --scalar-background-1: #f3ead0;
      --scalar-background-2: #fffef0;
      --scalar-background-3: #e8dfbf;
      --scalar-border-color: #0c0c0c;
      --scalar-button-1: #ffd600;
      --scalar-button-1-color: #0c0c0c;
    }
  `;

  onMount(async () => {
    try {
      const { createApiReference } = await import("@scalar/api-reference");
      app = createApiReference(container, {
        url: "/keys/openapi.json",
        layout: "modern",
        withDefaultFonts: false,
        hideDarkModeToggle: false,
        customCss,
        // The spec already declares the gateway servers; keep the download button
        // so users can grab the raw OpenAPI.
        hideDownloadButton: false,
      });
    } catch (e) {
      console.error("[api-reference] failed to mount Scalar", e);
      failed = true;
    }
  });

  onDestroy(() => {
    try {
      app?.destroy?.();
    } catch {
      /* noop */
    }
  });
</script>

<svelte:head>
  <title>API reference — Restormel Keys</title>
  <meta
    name="description"
    content="Restormel Keys API reference — every gateway endpoint, schema, and a built-in request console, generated from the live OpenAPI specification."
  />
</svelte:head>

{#if failed}
  <div class="api-reference-fallback">
    <h1>API reference</h1>
    <p>
      The interactive reference failed to load. You can view or download the raw
      OpenAPI specification directly:
      <a href="/keys/openapi.json">/keys/openapi.json</a>.
    </p>
  </div>
{/if}

<div class="api-reference-host" bind:this={container} aria-label="API reference"></div>

<style>
  /* Let Scalar fill the docs content column and manage its own scroll. */
  .api-reference-host {
    min-height: calc(100vh - 12rem);
  }
  .api-reference-fallback {
    padding: var(--space-6, 1.5rem) 0;
  }
</style>

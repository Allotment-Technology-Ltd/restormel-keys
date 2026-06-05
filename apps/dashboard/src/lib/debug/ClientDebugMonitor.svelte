<script lang="ts">
  /**
   * Dev-only overlay — NOT mounted in root layout (was crashing via stale HMR + invalid afterNavigate cleanup).
   * Debug capture runs from hooks.client.ts (`setupClientDebugCapture`). Use NDJSON log or `__rmClientDebugDump()`.
   */
  import { browser, dev } from "$app/environment";
  import { page } from "$app/stores";
  import { afterNavigate } from "$app/navigation";
  import { onMount } from "svelte";
  import {
    CLIENT_DEBUG_STORAGE_KEY,
    reportClientDebug,
    setupClientDebugCapture,
    type ClientDebugEvent,
  } from "$lib/debug/client-debug";

  let lastEvents: ClientDebugEvent[] = [];
  let expanded = false;

  onMount(() => {
    setupClientDebugCapture();
    refreshFromStorage();
    const id = window.setInterval(refreshFromStorage, 2000);
    return () => window.clearInterval(id);
  });

  /** `afterNavigate` has no unsubscribe API — register once, do not call a cleanup fn. */
  if (browser && dev) {
    afterNavigate((navigation) => {
      reportClientDebug(
        "ClientDebugMonitor:afterNavigate",
        "navigation completed",
        {
          from: navigation.from?.url?.pathname ?? null,
          to: navigation.to?.url?.pathname ?? null,
          type: navigation.type,
          willUnload: navigation.willUnload,
        },
        "CX-NAV"
      );
      refreshFromStorage();
    });
  }

  function refreshFromStorage(): void {
    if (!browser) return;
    try {
      const raw = sessionStorage.getItem(CLIENT_DEBUG_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) lastEvents = parsed.slice(-12).reverse();
    } catch {
      // ignore
    }
  }

  let lastReportedStatus = 0;
  $: if (browser && dev && $page.status >= 400 && $page.status !== lastReportedStatus) {
    lastReportedStatus = $page.status;
    reportClientDebug(
      "ClientDebugMonitor:page",
      "SvelteKit page entered error state",
      {
        status: $page.status,
        pathname: $page.url.pathname,
        search: $page.url.search,
        error: $page.error,
      },
      "CX-PAGE"
    );
  }
  $: if (browser && dev && $page.status < 400) {
    lastReportedStatus = 0;
  }

  $: latest = lastEvents[0];
  $: showPanel = dev && $page.status >= 400;
</script>

{#if dev && showPanel}
  <aside class="rm-debug-panel" aria-live="polite">
    <header class="rm-debug-head">
      <strong>Client debug</strong>
      <span class="rm-debug-badge">status {$page.status}</span>
      <button type="button" class="rm-debug-toggle" on:click={() => (expanded = !expanded)}>
        {expanded ? "Collapse" : "Expand"}
      </button>
    </header>
    {#if $page.error}
      <pre class="rm-debug-pre">{JSON.stringify($page.error, null, 2)}</pre>
    {/if}
    {#if latest}
      <p class="rm-debug-latest">
        <code>{latest.location}</code> — {latest.message}
      </p>
    {/if}
    {#if expanded}
      <ol class="rm-debug-list">
        {#each lastEvents as ev (ev.timestamp + ev.location)}
          <li>
            <code>{ev.location}</code>
            <span>{ev.message}</span>
            {#if ev.data?.error}
              <pre class="rm-debug-pre sm">{JSON.stringify(ev.data.error, null, 2)}</pre>
            {/if}
          </li>
        {/each}
      </ol>
      <p class="rm-debug-hint">DevTools: <code>__rmClientDebugDump()</code> · file: <code>apps/dashboard/.dev/client-debug-3ca71a.ndjson</code></p>
    {/if}
  </aside>
{/if}

<style>
  .rm-debug-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 99999;
    max-height: 45vh;
    overflow: auto;
    padding: var(--space-3);
    background: #1a1a1a;
    color: #f5f5f5;
    border-top: 3px solid #e8ff47;
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }
  .rm-debug-head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    margin-bottom: var(--space-2);
  }
  .rm-debug-badge {
    background: #e8ff47;
    color: #1a1a1a;
    padding: 2px 6px;
    font-weight: 700;
  }
  .rm-debug-toggle {
    margin-left: auto;
    cursor: pointer;
    border: 1px solid #f5f5f5;
    background: transparent;
    color: inherit;
    padding: 4px 8px;
  }
  .rm-debug-pre {
    margin: 0 0 var(--space-2);
    padding: var(--space-2);
    background: #2a2a2a;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .rm-debug-pre.sm {
    font-size: 10px;
    max-height: 8rem;
  }
  .rm-debug-latest {
    margin: 0 0 var(--space-2);
  }
  .rm-debug-list {
    margin: 0;
    padding-left: 1.25rem;
  }
  .rm-debug-list li {
    margin-bottom: var(--space-2);
  }
  .rm-debug-hint {
    margin: var(--space-2) 0 0;
    opacity: 0.85;
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";

  const STORAGE_KEY = "rk_usage_path";

  type UsagePath = "app" | "terminal" | "agent";

  let selected: UsagePath | null = null;
  let dismissed = false;

  onMount(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "app" || stored === "terminal" || stored === "agent") {
      selected = stored;
    }
  });

  function select(path: UsagePath) {
    selected = path;
    localStorage.setItem(STORAGE_KEY, path);
  }

  function dismiss() {
    dismissed = true;
  }

  const options: { id: UsagePath; label: string; desc: string; href: string; linkLabel: string }[] = [
    {
      id: "app",
      label: "In my app",
      desc: "Use the SDK to integrate routing, cost estimation, and provider resolution.",
      href: "/keys/docs",
      linkLabel: "SDK docs",
    },
    {
      id: "terminal",
      label: "In my terminal",
      desc: "Use the CLI to validate configuration and inspect routing from your terminal.",
      href: "/keys/docs/integrations/cli",
      linkLabel: "CLI quickstart",
    },
    {
      id: "agent",
      label: "In my agent or IDE",
      desc: "Connect Restormel to your agent workflow via MCP tools.",
      href: "/keys/docs/integrations/mcp",
      linkLabel: "MCP setup",
    },
  ];

  $: selectedOption = options.find((o) => o.id === selected);
</script>

{#if !dismissed}
  <section class="usage-path" aria-labelledby="usage-path-heading">
    {#if !selected}
      <h2 id="usage-path-heading" class="usage-path-title">How do you want to use Restormel?</h2>
      <div class="usage-path-options">
        {#each options as opt}
          <button type="button" class="usage-path-option" on:click={() => select(opt.id)}>
            <span class="option-label">{opt.label}</span>
            <span class="option-desc">{opt.desc}</span>
          </button>
        {/each}
      </div>
    {:else if selectedOption}
      <div class="usage-path-selected">
        <div class="selected-header">
          <h2 id="usage-path-heading" class="usage-path-title">Your workflow: {selectedOption.label}</h2>
          <button type="button" class="dismiss-btn" on:click={dismiss} aria-label="Dismiss">Dismiss</button>
        </div>
        <p class="selected-desc">{selectedOption.desc}</p>
        <div class="selected-actions">
          <a href={selectedOption.href} class="btn-link">{selectedOption.linkLabel} &rarr;</a>
          <a href={DASHBOARD_BASE + "/dev-tools"} class="btn-link">Developer tools</a>
          <button type="button" class="change-btn" on:click={() => { selected = null; localStorage.removeItem(STORAGE_KEY); }}>
            Change
          </button>
        </div>
      </div>
    {/if}
  </section>
{/if}

<style>
  .usage-path {
    max-width: var(--rm-container-narrow, 36rem);
    margin-bottom: var(--space-5);
  }
  .usage-path-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-3);
  }
  .usage-path-options {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .usage-path-option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-4);
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .usage-path-option:hover {
    border-color: var(--rm-sage);
    background: color-mix(in oklab, var(--rm-sage) 6%, var(--rm-surface-raised));
  }
  .usage-path-option:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 2px;
  }
  .option-label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
  }
  .option-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .usage-path-selected {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-4);
  }
  .selected-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .selected-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: var(--space-2) 0 var(--space-3);
  }
  .selected-actions {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    flex-wrap: wrap;
  }
  .btn-link {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    text-decoration: none;
    font-weight: 500;
  }
  .btn-link:hover {
    text-decoration: underline;
  }
  .dismiss-btn,
  .change-btn {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }
  .dismiss-btn:hover,
  .change-btn:hover {
    color: var(--rm-muted);
  }
</style>

<script lang="ts">
  type CodeTab = {
    id?: string;
    label: string;
    language?: string;
    code: string;
  };

  export let code: string | undefined = undefined;
  export let language: string | undefined = undefined;
  export let label: string | undefined = undefined;
  export let tabs: CodeTab[] | undefined = undefined;

  let activeIdx = 0;
  let copied = false;

  $: hasTabs = Array.isArray(tabs) && tabs.length > 0;
  $: active = hasTabs ? tabs![activeIdx] : null;
  $: displayedCode = hasTabs ? active!.code : code ?? "";
  $: displayedLanguage = hasTabs ? active!.language : language;

  async function copy() {
    const text = displayedCode;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      window.setTimeout(() => (copied = false), 1200);
    } catch {
      // Fallback: select & copy
      const el = document.getElementById(codeId);
      if (!el) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      try {
        document.execCommand("copy");
        copied = true;
        window.setTimeout(() => (copied = false), 1200);
      } finally {
        sel?.removeAllRanges();
      }
    }
  }

  const codeId = `code-${Math.random().toString(16).slice(2)}`;
</script>

<div class="codeblock" data-has-tabs={hasTabs} data-language={displayedLanguage ?? ""}>
  <div class="codeblock-toolbar">
    {#if hasTabs}
      <div class="codeblock-tabs" role="tablist" aria-label="Code variants">
        {#each tabs as tab, i (tab.id ?? tab.label)}
          <button
            type="button"
            class="codeblock-tab"
            role="tab"
            aria-selected={i === activeIdx}
            on:click={() => (activeIdx = i)}
          >
            {tab.label}
          </button>
        {/each}
      </div>
    {:else}
      <div class="codeblock-label">
        {#if label}
          <span class="codeblock-lang">{label}</span>
        {:else if displayedLanguage}
          <span class="codeblock-lang">{displayedLanguage}</span>
        {:else}
          <span class="codeblock-lang">Code</span>
        {/if}
      </div>
    {/if}

    <button type="button" class="codeblock-copy" on:click={copy}>
      {#if copied}
        Copied
      {:else}
        Copy
      {/if}
    </button>
  </div>

  <pre class="codeblock-pre"><code id={codeId}>{displayedCode}</code></pre>
</div>

<style>
  .codeblock {
    background: color-mix(in oklab, var(--rm-surface) 85%, black 15%);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    overflow: hidden;
    margin: 0 0 var(--space-4);
  }

  .codeblock-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--rm-border);
    background: color-mix(in oklab, var(--rm-surface-raised, var(--rm-surface)) 80%, black 20%);
  }

  .codeblock-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 2rem;
  }

  .codeblock-lang {
    font-size: var(--text-xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--rm-muted);
  }

  .codeblock-tabs {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .codeblock-tab {
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
    color: var(--rm-muted);
    font-size: var(--text-xs);
    padding: 0.35rem 0.6rem;
    border-radius: var(--radius);
    cursor: pointer;
  }
  .codeblock-tab[aria-selected="true"] {
    color: var(--rm-fg, var(--rm-text, #fff));
    border-color: color-mix(in oklab, var(--rm-primary) 60%, var(--rm-border));
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--rm-primary) 22%, transparent);
  }

  .codeblock-copy {
    border: 1px solid var(--rm-border);
    background: var(--rm-bg);
    color: var(--rm-muted);
    font-size: var(--text-xs);
    padding: 0.35rem 0.6rem;
    border-radius: var(--radius);
    cursor: pointer;
    min-width: 4.5rem;
    text-align: center;
  }
  .codeblock-copy:hover {
    background: var(--rm-surface);
    color: var(--rm-fg, var(--rm-text, #fff));
  }

  .codeblock-pre {
    margin: 0;
    padding: var(--space-4);
    overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--rm-fg, var(--rm-text, #fff));
  }
</style>

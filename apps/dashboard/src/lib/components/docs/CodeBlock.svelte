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
    background: var(--code-bg);
    border: var(--border);
    border-radius: 0;
    box-shadow: var(--shadow-md);
    overflow: hidden;
    margin: 0 0 var(--space-4);
  }

  .codeblock-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--border-thin);
    background: var(--code-bg);
  }

  .codeblock-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 2rem;
  }

  .codeblock-lang {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    letter-spacing: var(--text-mono-tracking);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--code-keyword);
  }

  .codeblock-tabs {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .codeblock-tab {
    border: var(--border-thin);
    background: var(--code-bg);
    color: var(--color-surface);
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    padding: 0.35rem 0.6rem;
    border-radius: 0;
    cursor: pointer;
  }
  .codeblock-tab[aria-selected="true"] {
    color: var(--color-ink);
    background: var(--color-yellow);
    border-color: var(--color-ink);
  }

  .codeblock-copy {
    border: var(--border-thin);
    background: var(--color-yellow);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    text-transform: uppercase;
    padding: 0.35rem 0.6rem;
    border-radius: 0;
    cursor: pointer;
    min-width: 4.5rem;
    text-align: center;
  }
  .codeblock-copy:hover {
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .codeblock-pre {
    margin: 0;
    padding: var(--space-5) var(--space-5);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    font-family: var(--font-mono);
    /* 13.5px — readable command lines / JSON (was 11px label size). */
    font-size: 0.84375rem;
    line-height: 1.6;
    color: var(--code-fg);
    background: var(--code-bg);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  @media (max-width: 640px) {
    .codeblock-pre {
      padding: var(--space-4);
    }
  }
</style>

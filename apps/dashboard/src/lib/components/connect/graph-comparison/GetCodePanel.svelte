<script lang="ts">
  /**
   * Phase 3 Stage 2 — "Get Code" from a console answer.
   *
   * After a verified answer renders, a one-click production snippet (curl + Node/TS)
   * that reproduces the SAME `retrieve_context` query against POST /connect/v1/graph.
   * The console becomes the on-ramp to the API (the Stripe/Anthropic "Get Code" pattern).
   *
   * SECURITY: the snippet builder never embeds a raw key — only an env-var reference
   * and (optionally) the non-secret key PREFIX as a hint. See get-code-snippet.ts.
   */
  import CodeBlock from "$lib/components/docs/CodeBlock.svelte";
  import { buildGetCodeSnippet } from "$lib/connect/get-code-snippet";

  /** Opaque workspace id (UUID) — required on the Connect request body. */
  export let workspaceId: string | null = null;
  /** The exact question the console just answered. */
  export let question: string;
  /** Project scope matching the Gateway key (optional). */
  export let projectId: string | null = null;
  /** Non-secret Gateway key prefix hint (`rk_xxxxxxxx…`); never the full key. */
  export let keyPrefixHint: string | null = null;
  /** Public API origin, e.g. "https://restormel.dev". */
  export let apiBase: string | undefined = undefined;
  /** Claim budget to mirror the console's retrieval. */
  export let maxClaims = 24;

  let open = false;

  // Build lazily + reactively so the snippet always reflects the answered question.
  $: snippet =
    workspaceId && question.trim()
      ? buildGetCodeSnippet({
          workspaceId,
          question,
          projectId,
          keyPrefixHint,
          apiBase,
          maxClaims,
        })
      : null;
</script>

{#if snippet}
  <section class="getcode">
    <button
      type="button"
      class="getcode-toggle brut-focus"
      aria-expanded={open}
      on:click={() => (open = !open)}
    >
      <span class="caret" class:open aria-hidden="true">▶</span>
      GET CODE — REPRODUCE THIS QUERY AGAINST THE API
    </button>

    {#if open}
      <div class="getcode-body">
        <p class="getcode-lede">
          The exact <code>retrieve_context</code> call this answer came from, against
          <code>POST {`/connect/v1/graph`}</code>. Set your Gateway key as
          <code>RESTORMEL_GATEWAY_KEY</code> in the environment — it is never written
          into this snippet.
        </p>
        <CodeBlock tabs={snippet.tabs} />
      </div>
    {/if}
  </section>
{/if}

<style>
  .getcode {
    border: var(--border);
    box-shadow: var(--shadow-md);
    background: var(--color-surface);
  }

  .getcode-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: var(--color-ink);
    color: var(--color-surface);
    border: 0;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    text-align: left;
  }

  .caret {
    display: inline-block;
    font-size: 9px;
    transition: transform 0.12s ease;
  }
  .caret.open {
    transform: rotate(90deg);
  }

  .getcode-body {
    padding: var(--space-4);
  }

  .getcode-lede {
    margin: 0 0 var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    line-height: 1.6;
    color: var(--color-ink-muted);
  }

  .getcode-lede code {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: var(--color-bg-deep);
    padding: 1px 5px;
    border: var(--border-thin);
  }

  @media (prefers-reduced-motion: reduce) {
    .caret {
      transition: none;
    }
  }
</style>

<script lang="ts">
  import type { IngestQualityCallout } from "$lib/connect/ingest-quality-messages";

  export let callout: IngestQualityCallout;

  $: role = callout.variant === "error" ? "alert" : "status";
</script>

<aside class="iq-callout iq-callout-{callout.variant}" {role} aria-labelledby="iq-callout-title">
  <p id="iq-callout-title" class="iq-callout-title">{callout.title}</p>
  <p class="iq-callout-summary">{callout.summary}</p>
  {#if callout.details.length > 0}
    <ul class="iq-callout-list">
      {#each callout.details as line}
        <li>{line}</li>
      {/each}
    </ul>
  {/if}
  {#if callout.nextSteps.length > 0}
    <p class="iq-callout-label">What to do next</p>
    <ol class="iq-callout-steps">
      {#each callout.nextSteps as step}
        <li>{step}</li>
      {/each}
    </ol>
  {/if}
</aside>

<style>
  .iq-callout {
    padding: var(--space-3) var(--space-4);
    border: var(--border);
    margin-bottom: var(--space-3);
    font-size: var(--text-sm);
  }
  .iq-callout-error {
    background: var(--state-fail-bg);
  }
  .iq-callout-warn {
    background: var(--state-warn-bg);
  }
  .iq-callout-info {
    background: var(--color-surface);
    color: var(--color-ink);
  }
  .iq-callout-success {
    background: var(--state-ok-bg);
  }
  .iq-callout-title {
    margin: 0 0 var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .iq-callout-summary {
    margin: 0 0 var(--space-2);
    line-height: 1.5;
  }
  .iq-callout-label {
    margin: var(--space-3) 0 var(--space-1);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    color: var(--color-ink-muted);
  }
  .iq-callout-list,
  .iq-callout-steps {
    margin: 0;
    padding-left: 1.25rem;
    line-height: 1.5;
  }
  .iq-callout-list li + li,
  .iq-callout-steps li + li {
    margin-top: var(--space-1);
  }
</style>

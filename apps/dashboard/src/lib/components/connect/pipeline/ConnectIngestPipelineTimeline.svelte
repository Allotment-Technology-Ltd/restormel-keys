<script lang="ts">
  import type { ConnectIngestStageProgress } from "@restormel/connect-core/ingest/worker-stub";
  import { buildConnectPipelineStageRows } from "@restormel/connect-core/ingest/pipeline-focus";
  import { formatIngestEta, resolveIngestStageDisplayStatus } from "$lib/connect/ingest-progress-ui";

  export let stages: ConnectIngestStageProgress[] = [];
  export let currentStageKey: string | null | undefined = null;
  export let currentAction: string | null | undefined = null;
  export let jobStatus = "pending";

  $: rows = buildConnectPipelineStageRows(stages, currentStageKey);

  function displayStatus(stageKey: string, status: string): string {
    return resolveIngestStageDisplayStatus({
      stageKey,
      row: { stage: stageKey, status },
      jobStatus,
      currentStage: currentStageKey,
    });
  }

  function stageEtaLabel(progress: ConnectIngestStageProgress["progress"]): string {
    if (!progress) return "—";
    return formatIngestEta(progress.eta_seconds);
  }
</script>

<ol class="pipeline" aria-label="Pipeline stages">
  {#each rows as row, i (row.key)}
    {@const status = displayStatus(row.key, row.status)}
    <li
      class="pipeline-step"
      class:pipeline-step--active={row.isCurrent && status === "running"}
      class:pipeline-step--done={status === "completed" || status === "skipped"}
    >
      <span class="pipeline-idx">{String(i + 1).padStart(2, "0")}</span>
      <span class="pipeline-label">{row.label}</span>
      <span class="pipeline-meta">
        <span class="pipeline-status">{status}</span>
        {#if status === "running" && row.progress}
          <span class="pipeline-eta">
            {row.progress.percent}% · ETA {stageEtaLabel(row.progress)}
            {#if row.progress.total > 1}
              · {row.progress.processed}/{row.progress.total}
            {/if}
            {#if row.isCurrent && currentAction}
              · {currentAction}
            {/if}
          </span>
        {:else if (status === "completed" || status === "skipped") && row.progress?.total}
          <span class="pipeline-eta pipeline-eta--done">done</span>
        {/if}
      </span>
    </li>
  {/each}
</ol>

<style>
  .pipeline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .pipeline-step {
    display: grid;
    grid-template-columns: 2.5rem 1fr auto;
    align-items: start;
    gap: var(--space-2);
    padding: var(--space-2);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    font-family: var(--rm-font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    transition: background-color 300ms ease, color 300ms ease;
  }

  .pipeline-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.125rem;
    min-width: 6.5rem;
  }

  .pipeline-eta {
    font-size: 0.625rem;
    letter-spacing: 0.04em;
    color: var(--rm-dim);
    text-transform: none;
  }

  .pipeline-eta--done {
    text-transform: uppercase;
  }

  .pipeline-step--active {
    background: var(--brut-neon);
    box-shadow: var(--brut-shadow-hover);
  }

  .pipeline-step--done {
    background: var(--brut-ink);
    color: var(--brut-white);
  }

  .pipeline-step--done .pipeline-status::before {
    content: "✓ ";
  }

  .pipeline-idx {
    font-weight: 700;
  }

  .pipeline-status {
    text-transform: uppercase;
    color: var(--rm-dim);
  }

  @media (prefers-reduced-motion: reduce) {
    .pipeline-step {
      transition: none;
    }
  }
</style>

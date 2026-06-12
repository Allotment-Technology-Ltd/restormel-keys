<script lang="ts">
  import { pipelineWizardHref, withReturnTo } from "$lib/connect/pipeline-config";
  import { CLAIMS_HREF, INGEST_ROUTES_HREF } from "$lib/nav-config";
  import {
    FIRST_GRAPH_ONBOARDING_DOC_HREF,
    type FirstGraphGuideState,
  } from "$lib/connect/first-graph-guide";

  export let guide: FirstGraphGuideState;

  const GUIDE_DOC = FIRST_GRAPH_ONBOARDING_DOC_HREF;

  let expanded = false;
  let openPhase: string | null = null;

  type Phase = {
    id: string;
    title: string;
    done: boolean;
    doneLabel: string;
    before: { label: string; href: string }[];
    dashboardHref: string;
    dashboardLabel: string;
    body: string;
    optional?: boolean;
  };

  $: phases = buildPhases(guide);

  function buildPhases(g: FirstGraphGuideState): Phase[] {
    return [
      {
        id: "store",
        title: "1. Connect Surreal Cloud",
        done: g.surrealStoreReady,
        doneLabel: "SurrealDB connected and tested",
        before: [
          { label: "Create a Surreal Cloud account", href: "https://surrealdb.com/cloud" },
          {
            label: "Surreal Cloud connecting guide",
            href: "https://surrealdb.com/docs/build/deployment/surrealdb-cloud/connecting/via-sdk",
          },
        ],
        dashboardHref: pipelineWizardHref("store"),
        dashboardLabel: "Open graph store setup",
        body: "Create an instance in Surreal Cloud, copy your wss:// connection string, paste it in the pipeline, and run Test connection before saving.",
      },
      {
        id: "models",
        title: "2. Add AI keys and ingestion routes",
        done: g.modelsReady,
        doneLabel: "Chat and embedding routes published",
        before: [
          { label: "OpenRouter (chat models)", href: "https://openrouter.ai/" },
          { label: "OpenAI (chat or embeddings)", href: "https://platform.openai.com/" },
          { label: "Mistral (chat models)", href: "https://mistral.ai/" },
          { label: "Together (embeddings)", href: "https://www.together.ai/" },
          { label: "Voyage (embeddings)", href: "https://www.voyageai.com/" },
          { label: "Vercel AI Gateway", href: "https://vercel.com/docs/ai-gateway" },
        ],
        dashboardHref: withReturnTo(INGEST_ROUTES_HREF, { kind: "pipeline-setup", step: "sources" }),
        dashboardLabel: "Open Models & keys",
        body:
          "Add at least two model capabilities: one chat model for extraction, grouping, validation, and remediation, and one embedding model. " +
          "Save provider keys under Connections, bind a project, then publish ingestion routes — one chat route and one embedding route are enough to start. " +
          "Supported embedding providers today: OpenAI, Together, Voyage, and Vercel AI Gateway.",
      },
      {
        id: "corpus",
        title: "3. Load the starter corpus",
        done: g.starterCorpusLoaded,
        doneLabel: "Three starter documents ready",
        before: [],
        dashboardHref: pipelineWizardHref("sources"),
        dashboardLabel: "Open Sources step",
        body:
          "Load three Restormel-authored philosophy demo passages (CC0). They are sized for a small first graph — expect on the order of 15–40 ideas, not a full corpus.",
      },
      {
        id: "describe",
        title: "4. Describe your graph schema",
        done: g.customPackSaved,
        doneLabel: "Custom domain pack saved",
        before: [],
        dashboardHref: pipelineWizardHref("domain"),
        dashboardLabel: "Open Graph Designer",
        body:
          "Use Graph Designer to describe what to extract. Paste the suggested intent, review the draft (unit types, relations, relationship patterns), then save your pack. " +
          "The built-in philosophy pack is reference-only — this walkthrough uses describe so you experience schema generation.",
      },
      {
        id: "run",
        title: "5. Run your first ingest",
        done: g.hasIngestJob,
        doneLabel: "At least one ingest run started",
        before: [
          {
            label: "Hosted ingest worker runbook",
            href: "https://github.com/restormel/restormel-keys/blob/main/docs/runbooks/connect-ingest-hosted-worker.md",
          },
        ],
        dashboardHref: pipelineWizardHref("launch"),
        dashboardLabel: "Start ingest run",
        body:
          "Name your run, select your domain pack and starter documents, then start. Production deployments need CONNECT_INGEST_WORKER_MODE=full on the ingest worker.",
      },
      {
        id: "explore",
        title: "6. Explore your graph",
        done: g.hasGraph,
        doneLabel: "Graph has extracted ideas",
        before: [],
        dashboardHref: CLAIMS_HREF,
        dashboardLabel: "Browse knowledge graph",
        body: "Review extracted ideas, connections, groups, and validation results. Watch live ingest progress from the Runs tab if your job is still running.",
      },
    ];
  }

  $: completedPhases = phases.filter((p) => p.done).length;

  function togglePhase(id: string) {
    openPhase = openPhase === id ? null : id;
  }
</script>

<details class="first-graph-guide" bind:open={expanded}>
  <summary class="guide-summary">
    <span class="guide-summary-header">
      <span class="guide-summary-title">First graph setup</span>
      <span class="guide-counter" aria-label="{completedPhases} of {phases.length} phases complete">{completedPhases}/{phases.length}</span>
    </span>
    <span class="guide-summary-meta">
      ~30 min · includes third-party accounts · {completedPhases} of {phases.length} phases complete
    </span>
  </summary>

  <div class="guide-body">
    <p class="guide-lead">
      Follow this Surreal-first path to connect a graph store, wire chat and embedding models, load demo documents,
      describe your schema, and run ingestion. Expand each phase for vendor links and dashboard shortcuts.
      <a href={GUIDE_DOC}>Full walkthrough doc</a>
    </p>

    <ol class="guide-phases" aria-label="First graph setup phases">
      {#each phases as phase (phase.id)}
        <li class="guide-phase" class:guide-phase-done={phase.done}>
          <button
            type="button"
            class="guide-phase-toggle"
            aria-expanded={openPhase === phase.id}
            on:click={() => togglePhase(phase.id)}
          >
            <span class="guide-phase-marker" aria-hidden="true">{phase.done ? "✓" : "○"}</span>
            <span class="guide-phase-title">{phase.title}</span>
            <span class="badge {phase.done ? 'status-success' : 'status-muted'}">
              {phase.done ? "done" : "to do"}
            </span>
          </button>

          {#if openPhase === phase.id}
            <div class="guide-phase-panel">
              <p class="guide-phase-body">{phase.body}</p>

              {#if phase.before.length > 0}
                <div class="guide-block">
                  <h3 class="guide-block-title">Before you start</h3>
                  <ul class="guide-links">
                    {#each phase.before as link}
                      <li>
                        <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}

              <div class="guide-block">
                <h3 class="guide-block-title">In the dashboard</h3>
                <a class="btn btn-outline" href={phase.dashboardHref}>{phase.dashboardLabel}</a>
              </div>

              <p class="guide-done-when">
                <strong>Done when:</strong> {phase.doneLabel}
              </p>
            </div>
          {/if}
        </li>
      {/each}
    </ol>
  </div>
</details>

<style>
  .first-graph-guide {
    border: var(--border-thin);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    margin-bottom: var(--space-5);
  }
  .guide-summary {
    cursor: pointer;
    list-style: none;
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .guide-summary-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .guide-counter {
    font-family: var(--font-display);
    font-size: var(--text-display-metric);
    font-weight: 900;
    line-height: var(--text-display-line-height);
    letter-spacing: var(--text-display-tracking);
    color: var(--rm-text);
  }
  .guide-summary::-webkit-details-marker {
    display: none;
  }
  .guide-summary-title {
    font-weight: 600;
    color: var(--rm-text);
  }
  .guide-summary-meta {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .guide-body {
    padding: var(--space-4) var(--space-4) var(--space-4);
    border-top: var(--border-thin);
  }
  .guide-lead {
    margin: var(--space-4) 0;
    color: var(--rm-muted);
    font-size: var(--text-sm);
    line-height: 1.55;
  }
  .guide-phases {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .guide-phase {
    border: var(--border-thin);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
  }
  .guide-phase-done {
    border-color: color-mix(in oklab, var(--rm-sage) 40%, var(--rm-border));
  }
  .guide-phase-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    color: inherit;
    font: inherit;
  }
  .guide-phase-toggle:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 2px;
  }
  .guide-phase-marker {
    flex: 0 0 auto;
    width: 1.25rem;
    text-align: center;
    color: var(--rm-muted);
  }
  .guide-phase-done .guide-phase-marker {
    color: var(--rm-sage);
  }
  .guide-phase-title {
    flex: 1;
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--rm-text);
  }
  .guide-phase-panel {
    padding: 0 var(--space-4) var(--space-4);
    border-top: var(--border-thin);
  }
  .guide-phase-body {
    margin: var(--space-3) 0;
    color: var(--rm-muted);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .guide-block {
    margin-bottom: var(--space-3);
  }
  .guide-block-title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-dim);
  }
  .guide-links {
    margin: 0;
    padding-left: 1.25rem;
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .guide-done-when {
    margin: var(--space-3) 0 0;
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .badge {
    border: var(--border-thin);
    border-radius: var(--rm-radius);
    padding: 0 var(--space-2);
    font-family: var(--font-mono);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    font-size: var(--text-mono-sm);
  }
</style>

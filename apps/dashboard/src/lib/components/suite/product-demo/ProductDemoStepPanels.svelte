<script lang="ts">
  import type { DemoStepId } from "./product-demo-data";
  import BrutalBadge from "$lib/components/brutalist/BrutalBadge.svelte";
  import BrutalCard from "$lib/components/brutalist/BrutalCard.svelte";
  import ProductDemoRoutePreview from "./ProductDemoRoutePreview.svelte";
  import ConnectIngestPipelineTimeline from "$lib/components/connect/pipeline/ConnectIngestPipelineTimeline.svelte";
  import { ingestStatusVariant } from "$lib/connect/ingest-progress-ui";
  import {
    DEMO_ADDING_PROVIDER,
    DEMO_CONNECTIONS,
    DEMO_DOMAIN_DRAFT,
    DEMO_DOMAIN_INTENT,
    DEMO_GRAPH_STATS,
    DEMO_GRAPH_UNITS,
    DEMO_MCP_SNIPPET,
    DEMO_MCP_TOOL_RESULT,
    DEMO_INGEST_JOB,
    DEMO_INGEST_STAGES,
    DEMO_PROVIDER_OPTIONS,
  } from "./product-demo-mock-data";

  export let stepId: DemoStepId;
  export let visibleLogLines: string[] = [];

  $: ingestVariant = ingestStatusVariant(DEMO_INGEST_JOB.status);
</script>

<div class="demo-panel-scale">
  {#if stepId === "keys"}
    <h2 class="page-title">Connect a Provider</h2>
    <p class="page-desc">
      Connect your provider so Restormel Testing and routing can resolve models. Keys stay in your infra — no proxy.
    </p>
    <div class="list-head">
      <h3 class="section-title">Your connections</h3>
      <span class="btn btn-primary demo-static-btn">+ Add connection</span>
    </div>
    <ul class="demo-integration-list" aria-label="Provider connections">
      {#each DEMO_CONNECTIONS as conn}
        <li class="demo-integration-row">
          <div class="demo-integration-link">
            <span class="demo-int-name">{conn.name}</span>
            <span class="demo-int-type">{conn.type}</span>
            <span class="demo-int-status status-success">
              {conn.status} · {conn.verified} · {conn.masked}
            </span>
          </div>
        </li>
      {/each}
    </ul>
    <div class="demo-int-add" aria-hidden="true">
      <p class="wizard-step">Adding provider</p>
      <p class="wizard-title">Select provider type</p>
      <div class="provider-grid provider-grid-four">
        {#each DEMO_PROVIDER_OPTIONS as opt}
          <span class="provider-btn" class:provider-btn-active={opt.value === DEMO_ADDING_PROVIDER}>{opt.label}</span>
        {/each}
      </div>
    </div>
  {:else if stepId === "routes"}
    <h2 class="page-title">production-default</h2>
    <p class="page-desc">Build your resolve chain visually — primary model, fallbacks, and parallel branches.</p>
    <div class="route-visual-panel demo-route-visual">
      <ProductDemoRoutePreview />
    </div>
    <div class="card demo-route-draft" aria-hidden="true">
      <p class="card-desc"><strong>dev-experimental</strong> — draft route (add models from the map…)</p>
    </div>
  {:else if stepId === "database"}
    <header class="wizard-header">
      <p class="wizard-kicker">Step 1 · Graph store</p>
      <h2 class="wizard-title">Choose where your graph lives</h2>
      <p class="wizard-lead">Connect SurrealDB you manage, or use your workspace database.</p>
    </header>
    <div class="wizard-panel card">
      <p class="connected" role="status">
        Connected to <code>ws://localhost:8000</code> · ns <code>restormel</code> · db <code>production</code>
        <span class="badge status-success">connected</span>
      </p>
      <form class="form advanced">
        <div class="row">
          <label class="field">
            <span class="field-label">Namespace</span>
            <input class="input" type="text" value="restormel" readonly tabindex="-1" aria-readonly="true" />
          </label>
          <label class="field">
            <span class="field-label">Database</span>
            <input class="input" type="text" value="production" readonly tabindex="-1" aria-readonly="true" />
          </label>
        </div>
        <label class="field">
          <span class="field-label">Username</span>
          <input class="input" type="text" value="root" readonly tabindex="-1" aria-readonly="true" />
        </label>
        <div class="actions">
          <span class="btn btn-secondary demo-static-btn">Test connection</span>
        </div>
        <p class="notice" role="status">Connection succeeded — ping 4ms</p>
        <p class="field-hint">Supports SurrealDB · PostgreSQL (pgvector) · Qdrant · Weaviate</p>
      </form>
    </div>
  {:else if stepId === "graph-config"}
    <header class="wizard-header">
      <p class="wizard-kicker">Step 2 · Domain</p>
      <h2 class="wizard-title">Define your domain with a prompt</h2>
      <p class="wizard-lead">Describe what your graph should capture — we'll draft an ontology from your intent.</p>
    </header>
    <div class="wizard-panel card">
      <div class="designer">
        <h3 class="designer-title">Design with AI</h3>
        <label class="field">
          <span class="field-label">What should this graph capture?</span>
          <textarea class="input" rows="4" readonly tabindex="-1" aria-readonly="true">{DEMO_DOMAIN_INTENT}</textarea>
        </label>
        <div class="actions">
          <span class="btn btn-primary demo-static-btn">Generate draft</span>
        </div>
        <div class="parsed-preview" role="status" aria-label="Generated ontology preview">
          <p class="parsed-preview-title">Draft ontology</p>
          <dl class="parsed-preview-list">
            <div>
              <dt>Unit types</dt>
              <dd>{DEMO_DOMAIN_DRAFT.unitTypes}</dd>
            </div>
            <div>
              <dt>Relations</dt>
              <dd>{DEMO_DOMAIN_DRAFT.relations}</dd>
            </div>
            <div>
              <dt>Verify</dt>
              <dd>{DEMO_DOMAIN_DRAFT.verify}</dd>
            </div>
          </dl>
        </div>
        <button type="button" class="btn-link demo-static-link">Regenerate schema</button>
      </div>
    </div>
  {:else if stepId === "ingest"}
    <section class="demo-run-console" aria-labelledby="demo-run-heading">
      <header class="demo-run-head">
        <div>
          <p class="demo-run-kicker">Pipeline run</p>
          <h2 id="demo-run-heading" class="demo-run-title">{DEMO_INGEST_JOB.label}</h2>
          <p class="demo-run-meta">
            <BrutalBadge variant={ingestVariant} label={DEMO_INGEST_JOB.status} />
            <code class="demo-run-id">{DEMO_INGEST_JOB.id}</code>
          </p>
        </div>
      </header>
      <div class="demo-run-grid">
        <BrutalCard fill="canvas" title="Progress">
          <div class="demo-progress-panel">
            <div class="demo-progress-readout" aria-live="polite">
              <span class="demo-progress-pct">{DEMO_INGEST_JOB.percent}<span class="demo-progress-pct-suffix">%</span></span>
              <span class="demo-progress-eta">Run progress</span>
            </div>
            <div
              class="demo-progress-track"
              role="progressbar"
              aria-valuenow={DEMO_INGEST_JOB.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Ingest progress"
            >
              <div class="demo-progress-fill" style:width="{DEMO_INGEST_JOB.percent}%"></div>
              <div class="demo-progress-segments" aria-hidden="true">
                {#each Array(7) as _}
                  <span></span>
                {/each}
              </div>
            </div>
            <p class="demo-progress-detail">
              {DEMO_INGEST_JOB.processed} of {DEMO_INGEST_JOB.total} stages complete
            </p>
          </div>
        </BrutalCard>
        <BrutalCard fill="white" title="Pipeline">
          <p class="demo-run-muted">Stage state from the worker — current stage and per-stage progress.</p>
          <ConnectIngestPipelineTimeline
            stages={DEMO_INGEST_STAGES}
            currentStageKey={DEMO_INGEST_JOB.currentStage}
            currentAction={DEMO_INGEST_JOB.currentAction}
            jobStatus={DEMO_INGEST_JOB.status}
          />
        </BrutalCard>
        <BrutalCard fill="white" title="Activity log">
          <p class="demo-run-muted">{visibleLogLines.length} lines shown</p>
          <pre class="demo-log-screen" aria-live="polite"><code>{visibleLogLines.join("\n") || "— awaiting worker output —"}</code></pre>
        </BrutalCard>
      </div>
    </section>
  {:else if stepId === "validate"}
    <header class="wizard-header">
      <p class="wizard-kicker">Claims</p>
      <h2 class="wizard-title">Explore and verify the graph</h2>
      <p class="wizard-lead">
        Review supported ideas, flagged claims, and provenance. When you are satisfied, open the MCP tab to wire agents.
      </p>
    </header>
    <div class="demo-graph-bento" aria-label="Graph statistics">
      <div class="demo-graph-stat">
        <span class="demo-graph-stat-value">{DEMO_GRAPH_STATS.units}</span>
        <span class="demo-graph-stat-label">Ideas</span>
      </div>
      <div class="demo-graph-stat">
        <span class="demo-graph-stat-value">2.1k</span>
        <span class="demo-graph-stat-label">Edges</span>
      </div>
      <div class="demo-graph-stat">
        <span class="demo-graph-stat-value">{DEMO_GRAPH_STATS.verifiedPct}%</span>
        <span class="demo-graph-stat-label">Verified</span>
      </div>
    </div>
    <BrutalCard fill="white" title="Flagged for review">
      <ul class="demo-units-list">
        {#each DEMO_GRAPH_UNITS as unit}
          <li class="demo-unit-row">
            <p class="demo-unit-text">{unit.text}</p>
            <p class="demo-unit-meta">
              <BrutalBadge
                variant={unit.status === "ok" ? "blue" : "neon"}
                label={unit.status === "ok" ? "Supported" : "Weak"}
              />
              · {unit.sources} source{unit.sources === 1 ? "" : "s"}
            </p>
          </li>
        {/each}
      </ul>
      <div class="actions">
        <span class="btn btn-primary demo-static-btn">Open Claims</span>
        <span class="demo-next-hint" aria-hidden="true">Next → MCP tab</span>
      </div>
    </BrutalCard>
  {:else if stepId === "agents"}
    <header class="wizard-header">
      <p class="wizard-kicker">Agents · MCP</p>
      <h2 class="wizard-title">Launch agents on your graph</h2>
      <p class="wizard-lead">
        Your corpus stays on <strong>Bring-Your-Own Surreal</strong>. Add one MCP snippet — Cursor, Claude Desktop, or
        any MCP host — then call <code>connect.search</code> for structured context packs.
      </p>
    </header>
    <div class="demo-mcp-layout">
      <BrutalCard fill="white" title="Tools">
        <ul class="demo-mcp-tools">
          <li><code class="demo-mcp-tool">connect.search</code> — semantic search → context pack</li>
          <li><code class="demo-mcp-tool">connect.get_context_for</code> — topic or seed claim traversal</li>
          <li><code class="demo-mcp-tool">connect.graph.*</code> — expand, find paths, reasoning-mode subgraphs (supported-only)</li>
        </ul>
      </BrutalCard>
      <BrutalCard fill="white" title="mcp.json snippet">
        <pre class="demo-mcp-pre" aria-label="Sample MCP configuration"><code>{DEMO_MCP_SNIPPET}</code></pre>
      </BrutalCard>
    </div>
    <BrutalCard fill="white" title="Sample tool result">
      <pre class="demo-mcp-result" aria-label="Sample connect.search response"><code>{DEMO_MCP_TOOL_RESULT}</code></pre>
    </BrutalCard>
    <div class="actions demo-mcp-actions">
      <span class="btn btn-primary demo-static-btn">Copy MCP snippet</span>
      <span class="demo-static-link">Connect hub · Dev tools</span>
    </div>
  {/if}
</div>

<style>
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-3);
    line-height: 1.5;
  }
  .section-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0;
  }
  .list-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .demo-static-btn,
  .demo-static-link {
    pointer-events: none;
    cursor: default;
  }
  .demo-static-link {
    display: inline-block;
    margin-top: var(--space-2);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--rm-text);
    text-decoration: underline;
  }
  .provider-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }
  .provider-grid-four {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .provider-btn {
    padding: var(--space-2);
    border: var(--border-thin);
    background: var(--color-surface);
    font-size: var(--text-xs);
    text-align: center;
  }
  .provider-btn-active {
    border-color: var(--color-ink);
    background: var(--color-yellow);
    font-weight: 700;
  }
  .wizard-step {
    margin: 0;
    color: var(--rm-dim);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .demo-next-hint {
    display: block;
    margin-top: var(--space-3);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--rm-muted);
    font-family: var(--font-mono);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .demo-mcp-layout {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  @media (max-width: 720px) {
    .demo-mcp-layout {
      grid-template-columns: 1fr;
    }
  }
  .demo-mcp-tools {
    margin: 0;
    padding-left: 1.1rem;
    font-size: var(--text-sm);
    line-height: 1.55;
    color: var(--rm-text);
  }
  .demo-mcp-tool {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
  }
  .demo-mcp-pre,
  .demo-mcp-result {
    margin: 0;
    padding: var(--space-2);
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1.55;
    overflow-x: auto;
    background: var(--color-bg);
    border: var(--border-thin);
  }
  .demo-mcp-actions {
    margin-top: var(--space-3);
  }
  .wizard-title {
    margin: var(--space-1) 0 var(--space-2);
    color: var(--rm-text);
    font-size: var(--text-sm);
    font-weight: 600;
  }
  @media (max-width: 640px) {
    .provider-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>

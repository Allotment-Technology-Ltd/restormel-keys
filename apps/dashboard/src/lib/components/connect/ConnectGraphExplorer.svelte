<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { goto } from "$app/navigation";
  import { CONNECT_PIPELINE_API } from "$lib/connect/pipeline-config";
  import { pipelineWizardHref } from "$lib/connect/pipeline-config";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import BrutalBadge from "$lib/components/brutalist/BrutalBadge.svelte";
  import BrutalBentoCell from "$lib/components/brutalist/BrutalBentoCell.svelte";
  import BrutalBentoGrid from "$lib/components/brutalist/BrutalBentoGrid.svelte";
  import BrutalButton from "$lib/components/brutalist/BrutalButton.svelte";
  import BrutalCard from "$lib/components/brutalist/BrutalCard.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import BrutalPageHeader from "$lib/components/brutalist/BrutalPageHeader.svelte";

  type Member = { text: string; role: string | null; validationStatus: string | null };
  type Group = { id: string; name: string; summary: string | null; members: Member[] };
  type Unit = {
    id: string;
    text: string;
    unitType: string | null;
    domain: string | null;
    validationStatus: string | null;
    validationNote: string | null;
    sourceTitle: string | null;
    sourceUrl: string | null;
    sourceKind: string | null;
    author: string | null;
  };
  type Stats = {
    units: number;
    relations: number;
    groups: number;
    embedded: number;
    validation: { ok: number; weak: number; unsupported: number; unvalidated: number };
  };
  type Graph = {
    store?: "postgres" | "surreal" | "none";
    storeLabel?: string;
    targetStatus?: "untested" | "error";
    domainPackId?: string | null;
    domainPackTitle?: string | null;
    reviewEnabled?: boolean;
    stats: Stats | null;
    groups: Group[];
    units: Unit[];
  };

  export let graph: Graph;

  export let revalidate: {
    enabled: boolean;
    routes: { id: string; name: string; isDefault: boolean }[];
    defaultRouteId: string | null;
  } | null = null;

  const CONNECT_BASE = DASHBOARD_BASE + "/connect";

  type FilterId = "review" | "all" | "ok" | "weak" | "unsupported" | "unvalidated";

  const FILTERS: { id: FilterId; label: string }[] = [
    { id: "review", label: "Flagged" },
    { id: "all", label: "All ideas" },
    { id: "ok", label: "Supported" },
    { id: "weak", label: "Weak" },
    { id: "unsupported", label: "Unsupported" },
    { id: "unvalidated", label: "Unchecked" },
  ];

  let filter: FilterId = "review";
  let units: Unit[] = graph.units;
  let stats: Stats | null = graph.stats;
  let selectedId: string | null = null;
  let reviewNote = "";
  let savingId: string | null = null;
  let actionError: string | null = null;
  let revalidateScope: "all" | "unchecked" | "flagged" = "unchecked";
  let revalidateRouteId = revalidate?.defaultRouteId ?? "";
  let revalidating = false;
  let revalidateError: string | null = null;

  $: units = graph.units;
  $: stats = graph.stats;
  $: storeLabel = graph.storeLabel ?? "Graph store";
  $: reviewEnabled = graph.reviewEnabled !== false && graph.store !== "none";
  $: needsReviewCount = stats
    ? stats.validation.weak + stats.validation.unsupported
    : 0;
  $: uncheckedCount = stats ? stats.validation.unvalidated : 0;

  $: filteredUnits =
    filter === "all"
      ? units
      : filter === "review"
        ? units.filter((u) => {
            const s = u.validationStatus ?? "unvalidated";
            return s === "weak" || s === "unsupported";
          })
        : units.filter((u) => (u.validationStatus ?? "unvalidated") === filter);

  $: {
    if (filteredUnits.length === 0) {
      selectedId = null;
    } else if (!selectedId || !filteredUnits.some((u) => u.id === selectedId)) {
      selectedId = filteredUnits[0].id;
    }
  }

  $: selectedUnit = selectedId ? units.find((u) => u.id === selectedId) ?? null : null;

  function statusLabel(status: string | null): string {
    if (status === "ok") return "Supported";
    if (status === "weak") return "Weak";
    if (status === "unsupported") return "Unsupported";
    return "Unchecked";
  }

  function badgeVariant(status: string | null): "neon" | "blue" | "coral" | "canvas" {
    if (status === "ok") return "blue";
    if (status === "weak") return "neon";
    if (status === "unsupported") return "coral";
    return "canvas";
  }

  function hasProvenance(unit: Unit): boolean {
    return Boolean(unit.author || unit.sourceTitle || unit.sourceUrl || unit.sourceKind);
  }

  function sourceKindLabel(kind: string | null): string | null {
    if (!kind) return null;
    if (kind === "url") return "URL";
    if (kind === "text") return "Text";
    if (kind === "upload") return "Upload";
    return kind.replace(/_/g, " ");
  }

  function selectUnit(unit: Unit) {
    selectedId = unit.id;
    reviewNote = "";
    actionError = null;
  }

  function statBucket(status: string | null): keyof Stats["validation"] {
    if (status === "ok") return "ok";
    if (status === "weak") return "weak";
    if (status === "unsupported") return "unsupported";
    return "unvalidated";
  }

  function bumpLocalStats(oldStatus: string | null, newStatus: string) {
    if (!stats) return;
    const oldKey = statBucket(oldStatus);
    const newKey = statBucket(newStatus);
    stats = {
      ...stats,
      validation: {
        ...stats.validation,
        [oldKey]: Math.max(0, stats.validation[oldKey] - 1),
        [newKey]: stats.validation[newKey] + 1,
      },
    };
  }

  function removeLocalUnit(unit: Unit) {
    if (!stats) return;
    const key = statBucket(unit.validationStatus);
    stats = {
      ...stats,
      units: Math.max(0, stats.units - 1),
      validation: {
        ...stats.validation,
        [key]: Math.max(0, stats.validation[key] - 1),
      },
    };
    units = units.filter((u) => u.id !== unit.id);
    if (selectedId === unit.id) {
      selectedId = null;
      reviewNote = "";
    }
  }

  async function submitReview(unit: Unit, status: "ok" | "weak" | "unsupported") {
    if (!reviewEnabled || savingId) return;
    actionError = null;
    savingId = unit.id;
    const note = reviewNote.trim() || null;
    try {
      const res = await fetch(
        `${CONNECT_PIPELINE_API}/graph/units/${encodeURIComponent(unit.id)}/validation`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            note,
            domain_pack_id: graph.domainPackId ?? null,
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        actionError = body.message ?? `Review failed (HTTP ${res.status}).`;
        return;
      }
      const prev = unit.validationStatus;
      units = units.map((u) =>
        u.id === unit.id
          ? {
              ...u,
              validationStatus: status,
              validationNote: note ?? (status === "ok" ? "Human review: supported" : `Human review: ${status}`),
            }
          : u,
      );
      bumpLocalStats(prev, status);
      reviewNote = "";
      void invalidateAll();
    } catch {
      actionError = "Network error while saving your review.";
    } finally {
      savingId = null;
    }
  }

  async function removeFromGraph(unit: Unit) {
    if (!reviewEnabled || savingId) return;
    const preview = unit.text.length > 120 ? `${unit.text.slice(0, 120)}…` : unit.text;
    if (
      !confirm(
        `Remove this idea from your graph?\n\n"${preview}"\n\nIt will no longer appear in retrieval. This cannot be undone.`,
      )
    ) {
      return;
    }
    actionError = null;
    savingId = unit.id;
    try {
      const res = await fetch(
        `${CONNECT_PIPELINE_API}/graph/units/${encodeURIComponent(unit.id)}/validation`,
        { method: "DELETE" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        actionError = body.message ?? `Could not remove (HTTP ${res.status}).`;
        return;
      }
      removeLocalUnit(unit);
      void invalidateAll();
    } catch {
      actionError = "Network error while removing this idea.";
    } finally {
      savingId = null;
    }
  }

  async function startRevalidation() {
    if (!revalidate?.enabled || revalidating) return;
    revalidateError = null;
    revalidating = true;
    try {
      const res = await fetch(`${CONNECT_PIPELINE_API}/graph/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: revalidateScope,
          ...(revalidateRouteId ? { validation_route_id: revalidateRouteId } : {}),
          ...(graph.domainPackId ? { domain_pack_id: graph.domainPackId } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof body.message === "string"
            ? body.message
            : typeof body.error === "string"
              ? body.error.replace(/_/g, " ")
              : `Could not start re-validation (HTTP ${res.status}).`;
        revalidateError = msg;
        return;
      }
      const jobId = body.job?.id;
      if (!jobId) {
        revalidateError = "Re-validation started but no job id was returned.";
        return;
      }
      await goto(`${CONNECT_BASE}/ingest/${jobId}?from=graph`);
    } catch {
      revalidateError = "Network error while starting re-validation.";
    } finally {
      revalidating = false;
    }
  }
</script>

<div class="connect-graph-explorer">
  <BrutalPageHeader
    kicker="Connect · Quality review"
    title="Knowledge graph"
    description="Inspect ideas extracted from your sources, confirm AI validation, and keep agent context trustworthy. {storeLabel}{graph.domainPackTitle ? ` · pack: ${graph.domainPackTitle}` : ''}."
  />

  {#if !stats || stats.units === 0}
    <BrutalCard fill="canvas" title="Empty graph">
      <p class="brut-muted">
        {#if graph.store === "surreal"}
          {#if graph.targetStatus === "error"}
            Could not reach your SurrealDB store. Fix credentials in Pipeline → Graph store, then refresh.
          {:else if graph.targetStatus === "untested"}
            SurrealDB is configured but not verified. Test the connection, then refresh.
          {:else}
            Your Surreal store has no matching units yet. Run ingestion with the same domain pack schema as your tables.
          {/if}
        {:else if graph.store === "none"}
          Connect a graph store in Pipeline, then run ingestion.
        {:else}
          Run ingestion to populate your graph.
        {/if}
      </p>
      <div class="empty-actions">
        {#if graph.store === "surreal" && graph.targetStatus}
          <BrutalButton variant="blue" href={pipelineWizardHref("store")}>Graph store setup</BrutalButton>
        {:else}
          <BrutalButton variant="blue" href={pipelineWizardHref("run")}>Start a run</BrutalButton>
        {/if}
        <BrutalButton variant="canvas" href={CONNECT_BASE}>Connect home</BrutalButton>
      </div>
    </BrutalCard>
  {:else}
    <BrutalBentoGrid columns={4}>
      <BrutalBentoCell fill="white" label="Ideas">
        <p class="bento-stat">{stats.units.toLocaleString()}</p>
      </BrutalBentoCell>
      <BrutalBentoCell fill="blue" label="Connections">
        <p class="bento-stat">{stats.relations.toLocaleString()}</p>
      </BrutalBentoCell>
      <BrutalBentoCell fill="canvas" label="Groups">
        <p class="bento-stat">{stats.groups.toLocaleString()}</p>
      </BrutalBentoCell>
      <BrutalBentoCell fill="neon" label="Embedded">
        <p class="bento-stat">{stats.embedded.toLocaleString()}</p>
      </BrutalBentoCell>
      <BrutalBentoCell span={4} fill="white" label="Validation breakdown">
        <ul class="validation-breakdown" aria-label="Validation counts">
          <li><span class="vb-label">Supported</span><strong>{stats.validation.ok}</strong></li>
          <li><span class="vb-label">Weak</span><strong>{stats.validation.weak}</strong></li>
          <li><span class="vb-label">Unsupported</span><strong>{stats.validation.unsupported}</strong></li>
          <li><span class="vb-label">Unchecked</span><strong>{stats.validation.unvalidated}</strong></li>
        </ul>
        {#if needsReviewCount > 0}
          <p class="review-hint">
            <strong>{needsReviewCount}</strong> idea{needsReviewCount === 1 ? "" : "s"} flagged weak or unsupported — review those before trusting retrieval.
          </p>
        {:else if uncheckedCount > 0}
          <p class="review-hint brut-muted">
            <strong>{uncheckedCount}</strong> idea{uncheckedCount === 1 ? "" : "s"} unchecked — use re-validation below or re-run ingestion.
          </p>
        {:else}
          <p class="review-hint brut-muted">All loaded ideas have a validation verdict. Spot-check supported items any time.</p>
        {/if}
      </BrutalBentoCell>
    </BrutalBentoGrid>

    {#if revalidate?.enabled}
      <div class="revalidate-panel">
      <BrutalCard fill="white" title="Re-validate existing graph">
        <p class="revalidate-lede brut-muted">
          Re-run AI validation on ideas already in your graph — no re-extraction. Useful after pipeline fixes or when
          you want a second opinion from a different model.
        </p>
        <div class="revalidate-form">
          <label class="revalidate-field" for="revalidate-scope">
            <span class="revalidate-label">Scope</span>
            <select id="revalidate-scope" class="revalidate-input brut-focus" bind:value={revalidateScope} disabled={revalidating}>
              <option value="unchecked">Unchecked only ({uncheckedCount.toLocaleString()})</option>
              <option value="flagged">Flagged only ({needsReviewCount.toLocaleString()})</option>
              <option value="all">All ideas ({stats.units.toLocaleString()})</option>
            </select>
          </label>
          <label class="revalidate-field" for="revalidate-route">
            <span class="revalidate-label">Validation model</span>
            <select
              id="revalidate-route"
              class="revalidate-input brut-focus"
              bind:value={revalidateRouteId}
              disabled={revalidating}
            >
              {#if revalidate.routes.length === 0}
                <option value="">Workspace default</option>
              {:else}
                <option value="">Workspace default routing</option>
                {#each revalidate.routes as route (route.id)}
                  <option value={route.id}>
                    {route.name}{route.isDefault ? " (workspace default)" : ""}
                  </option>
                {/each}
              {/if}
            </select>
          </label>
        </div>
        {#if revalidateError}
          <BrutalErrorBanner title="Re-validation not started" message={revalidateError} />
        {/if}
        <div class="revalidate-actions">
          <button
            type="button"
            class="brutal-btn brut-pressable brut-focus brut-fill-blue revalidate-btn"
            disabled={revalidating}
            on:click={startRevalidation}
          >
            {revalidating ? "Starting…" : "Start re-validation"}
          </button>
          <p class="revalidate-note brut-muted">
            Opens the run monitor — validation statuses update in place when the job completes.
          </p>
        </div>
      </BrutalCard>
      </div>
    {/if}

    {#if actionError}
      <BrutalErrorBanner title="Review not saved" message={actionError} />
    {/if}

    <div class="graph-layout">
      <section class="review-panel" aria-labelledby="review-queue-heading">
        <div class="panel-head">
          <h2 id="review-queue-heading" class="panel-title">Review queue</h2>
          <p class="panel-lede brut-muted">
            {#if reviewEnabled}
              Select an idea, read the AI note, then approve, override, or remove items that are true but not relevant to your graph.
            {:else}
              Read-only preview — connect a graph store to enable operator review.
            {/if}
          </p>
        </div>

        <div class="filter-row" role="tablist" aria-label="Filter ideas by validation">
          {#each FILTERS as f (f.id)}
            <button
              type="button"
              class="filter-chip"
              class:filter-chip-active={filter === f.id}
              role="tab"
              aria-selected={filter === f.id}
              on:click={() => {
                filter = f.id;
                selectedId = null;
              }}
            >
              {f.label}
              {#if f.id === "review" && needsReviewCount > 0}
                <span class="filter-count">{needsReviewCount}</span>
              {/if}
            </button>
          {/each}
        </div>

        {#if filteredUnits.length === 0}
          <BrutalCard fill="canvas">
            <p class="brut-muted">No ideas match this filter.</p>
          </BrutalCard>
        {:else}
          <ul class="unit-list" aria-label="Ideas to review">
            {#each filteredUnits as unit (unit.id)}
              <li>
                <button
                  type="button"
                  class="unit-row"
                  class:unit-row-selected={selectedUnit?.id === unit.id}
                  on:click={() => selectUnit(unit)}
                  aria-pressed={selectedUnit?.id === unit.id}
                >
                  <div class="unit-row-top">
                    <BrutalBadge variant={badgeVariant(unit.validationStatus)} label={statusLabel(unit.validationStatus)} />
                    {#if unit.unitType}<span class="unit-meta">{unit.unitType}</span>{/if}
                    {#if unit.domain}<span class="unit-meta unit-domain">{unit.domain}</span>{/if}
                  </div>
                  <p class="unit-row-text">{unit.text}</p>
                  {#if hasProvenance(unit)}
                    <p class="unit-provenance">
                      {#if unit.author}<span class="prov-author">{unit.author}</span>{/if}
                      {#if unit.sourceTitle}
                        {#if unit.author}<span class="prov-sep" aria-hidden="true">·</span>{/if}
                        <span class="prov-source">{unit.sourceTitle}</span>
                      {/if}
                    </p>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <aside class="detail-panel" aria-labelledby="detail-heading">
        {#if selectedUnit}
          <BrutalCard fill="white" title="Selected idea">
            <h2 id="detail-heading" class="visually-hidden">Selected idea detail</h2>
            <div class="detail-badges">
              <BrutalBadge variant={badgeVariant(selectedUnit.validationStatus)} label={statusLabel(selectedUnit.validationStatus)} />
            </div>
            <p class="detail-text">{selectedUnit.text}</p>

            {#if hasProvenance(selectedUnit)}
              <dl class="provenance-block brut-fill-canvas">
                <dt class="provenance-label">Provenance</dt>
                <dd class="provenance-body">
                  {#if selectedUnit.author}
                    <p class="prov-row">
                      <span class="prov-key">Author</span>
                      <span class="prov-value">{selectedUnit.author}</span>
                    </p>
                  {/if}
                  {#if selectedUnit.sourceTitle || selectedUnit.sourceUrl}
                    <p class="prov-row">
                      <span class="prov-key">Source</span>
                      <span class="prov-value">
                        {#if selectedUnit.sourceUrl}
                          <a
                            class="prov-link brut-focus"
                            href={selectedUnit.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {selectedUnit.sourceTitle ?? selectedUnit.sourceUrl}
                          </a>
                        {:else}
                          {selectedUnit.sourceTitle}
                        {/if}
                      </span>
                    </p>
                  {/if}
                  {#if selectedUnit.sourceKind}
                    <p class="prov-row">
                      <span class="prov-key">Kind</span>
                      <span class="prov-value">{sourceKindLabel(selectedUnit.sourceKind)}</span>
                    </p>
                  {/if}
                </dd>
              </dl>
            {/if}

            {#if selectedUnit.validationNote}
              <div class="ai-note brut-fill-canvas">
                <p class="ai-note-label">AI validation note</p>
                <p class="ai-note-body">{selectedUnit.validationNote}</p>
              </div>
            {/if}

            {#if reviewEnabled}
              <label class="note-field" for="review-note">
                <span class="note-label">Your note (optional)</span>
                <textarea
                  id="review-note"
                  class="note-input brut-focus"
                  rows="2"
                  maxlength="500"
                  placeholder="Why you agree or disagree with the AI verdict…"
                  bind:value={reviewNote}
                  disabled={savingId === selectedUnit.id}
                ></textarea>
              </label>

              <div class="review-actions" role="group" aria-label="Set validation verdict">
                <button
                  type="button"
                  class="brutal-btn brut-pressable brut-focus brut-fill-blue"
                  disabled={savingId === selectedUnit.id}
                  on:click={() => submitReview(selectedUnit, "ok")}
                >
                  {savingId === selectedUnit.id ? "Saving…" : "Approve · supported"}
                </button>
                <button
                  type="button"
                  class="brutal-btn brut-pressable brut-focus brut-fill-neon"
                  disabled={savingId === selectedUnit.id}
                  on:click={() => submitReview(selectedUnit, "weak")}
                >
                  Mark weak
                </button>
                <button
                  type="button"
                  class="brutal-btn brut-pressable brut-focus brut-fill-coral"
                  disabled={savingId === selectedUnit.id}
                  on:click={() => submitReview(selectedUnit, "unsupported")}
                >
                  Mark unsupported
                </button>
              </div>

              <div class="remove-section">
                <p class="remove-lede brut-muted">
                  True but off-topic? Remove it from the graph so agents never retrieve it — for example
                  historical trivia that does not serve your domain.
                </p>
                <button
                  type="button"
                  class="brutal-btn brut-pressable brut-focus remove-btn"
                  disabled={savingId === selectedUnit.id}
                  on:click={() => removeFromGraph(selectedUnit)}
                >
                  {savingId === selectedUnit.id ? "Working…" : "Remove from graph"}
                </button>
              </div>
            {/if}
          </BrutalCard>
        {:else}
          <BrutalCard fill="canvas" title="Select an idea">
            <p class="brut-muted">Pick an item from the queue to inspect AI validation and record your verdict.</p>
          </BrutalCard>
        {/if}

        {#if graph.groups.length > 0}
          <section class="groups-panel" aria-labelledby="groups-heading">
            <h2 id="groups-heading" class="panel-title">Groups</h2>
            <ul class="groups-list">
              {#each graph.groups as g (g.id)}
                <li class="group-item brut-fill-canvas">
                  <div class="group-head">
                    <strong>{g.name}</strong>
                    <span class="brut-muted">{g.members.length} members</span>
                  </div>
                  {#if g.summary}<p class="group-summary">{g.summary}</p>{/if}
                  {#if g.members.length > 0}
                    <ul class="member-list">
                      {#each g.members.slice(0, 6) as m}
                        <li>
                          {#if m.role}<span class="member-role">{m.role}</span>{/if}
                          <span>{m.text}</span>
                          {#if m.validationStatus}
                            <BrutalBadge variant={badgeVariant(m.validationStatus)} label={statusLabel(m.validationStatus)} />
                          {/if}
                        </li>
                      {/each}
                      {#if g.members.length > 6}
                        <li class="brut-muted">+{g.members.length - 6} more</li>
                      {/if}
                    </ul>
                  {/if}
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      </aside>
    </div>
  {/if}
</div>

<style>
  .connect-graph-explorer {
    max-width: 72rem;
  }

  .bento-stat {
    margin: 0;
    font-size: var(--text-3xl);
    font-weight: 900;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .validation-breakdown {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-3);
  }

  @media (max-width: 700px) {
    .validation-breakdown {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .validation-breakdown li {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    border: var(--brut-border-micro) solid var(--brut-ink);
    padding: var(--space-2);
    background: var(--brut-white);
  }

  .vb-label {
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brut-muted);
  }

  .review-hint {
    margin: var(--space-3) 0 0;
    font-size: var(--text-sm);
  }

  .revalidate-panel {
    margin-top: var(--space-4);
  }

  .revalidate-lede {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  .revalidate-form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .revalidate-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .revalidate-label {
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brut-muted);
  }

  .revalidate-input {
    min-height: 44px;
    padding: 0.5rem 0.75rem;
    font: inherit;
    font-size: var(--text-sm);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
  }

  .revalidate-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .revalidate-btn {
    width: fit-content;
    min-width: 12rem;
  }

  .revalidate-note {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.4;
  }

  .empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }

  .graph-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 0.9fr);
    gap: var(--space-4);
    align-items: start;
    margin-top: var(--space-4);
  }

  @media (max-width: 960px) {
    .graph-layout {
      grid-template-columns: 1fr;
    }
  }

  .panel-head {
    margin-bottom: var(--space-3);
  }

  .panel-title {
    margin: 0 0 var(--space-1);
    font-size: var(--text-lg);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .panel-lede {
    margin: 0;
    font-size: var(--text-sm);
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .filter-chip {
    min-height: 44px;
    padding: 0.375rem 0.75rem;
    font: inherit;
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    color: var(--brut-ink);
    cursor: pointer;
    box-shadow: var(--brut-shadow);
    transition: var(--brut-transition);
  }

  .filter-chip-active {
    background: var(--color-yellow);
    box-shadow: var(--brut-shadow-hover);
    transform: translate(2px, 2px);
  }

  .filter-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    margin-left: 0.35rem;
    padding: 0 0.25rem;
    background: var(--brut-ink);
    color: var(--brut-neon);
    font-size: 0.625rem;
  }

  .unit-list {
    list-style: none;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-height: 36rem;
    overflow: auto;
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-ink);
    padding: var(--brut-border-width);
  }

  .review-actions .brutal-btn {
    width: 100%;
    min-height: 44px;
    padding: 0.5rem 1rem;
    font-family: inherit;
    font-size: inherit;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: var(--brut-border-width) solid var(--brut-ink);
  }

  .review-actions .brutal-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }

  .remove-section {
    margin-top: var(--space-4);
    padding-top: var(--space-3);
    border-top: var(--brut-border-width) dashed var(--brut-ink);
  }

  .remove-lede {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    line-height: 1.45;
  }

  .remove-btn {
    width: 100%;
    min-height: 44px;
    padding: 0.5rem 1rem;
    font-family: inherit;
    font-size: inherit;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-white);
    color: var(--brut-ink);
  }

  .remove-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }

  .unit-row {
    width: 100%;
    text-align: left;
    padding: var(--space-3);
    border: none;
    background: var(--brut-canvas);
    color: var(--brut-ink);
    cursor: pointer;
    font: inherit;
    box-shadow: var(--brut-shadow);
    transition: var(--brut-transition);
  }

  .unit-row:hover {
    box-shadow: var(--brut-shadow-hover);
    transform: translate(2px, 2px);
  }

  .unit-row-selected {
    background: var(--brut-neon);
    box-shadow: var(--brut-shadow-none);
    transform: translate(4px, 4px);
  }

  .unit-row-top {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    margin-bottom: var(--space-2);
  }

  .unit-meta {
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brut-ink);
  }

  .unit-domain {
    opacity: 0.65;
  }

  .unit-row-text {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  .unit-provenance {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    line-height: 1.35;
    color: var(--brut-muted);
  }

  .prov-author {
    font-weight: 800;
    color: var(--brut-ink);
  }

  .prov-sep {
    margin: 0 0.25rem;
  }

  .prov-source {
    font-style: italic;
  }

  .provenance-block {
    margin: 0 0 var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-ink);
  }

  .provenance-label {
    margin: 0 0 var(--space-1);
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brut-muted);
  }

  .provenance-body {
    margin: 0;
  }

  .prov-row {
    margin: 0;
    display: grid;
    grid-template-columns: 4.5rem minmax(0, 1fr);
    gap: var(--space-2);
    font-size: var(--text-sm);
    line-height: 1.4;
  }

  .prov-row + .prov-row {
    margin-top: var(--space-1);
  }

  .prov-key {
    font-weight: 800;
    text-transform: uppercase;
    font-size: var(--text-xs);
    letter-spacing: 0.04em;
    color: var(--brut-muted);
  }

  .prov-value {
    min-width: 0;
    word-break: break-word;
  }

  .prov-link {
    color: var(--brut-ink);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }

  .prov-link:hover {
    color: var(--brut-blue);
  }

  .detail-text {
    margin: 0 0 var(--space-3);
    font-size: var(--text-base);
    line-height: 1.5;
    font-weight: 600;
  }

  .detail-badges {
    margin-bottom: var(--space-2);
  }

  .ai-note {
    border: var(--brut-border-micro) solid var(--brut-ink);
    padding: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .ai-note-label {
    margin: 0 0 var(--space-1);
    font-size: var(--text-xs);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .ai-note-body {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  .note-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
  }

  .note-label {
    font-size: var(--text-xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .note-input {
    width: 100%;
    min-height: 4.5rem;
    padding: var(--space-2) var(--space-3);
    font-family: inherit;
    font-size: var(--text-sm);
    border: var(--brut-border-micro) solid var(--brut-ink);
    border-radius: 0;
    background: var(--brut-white);
    resize: vertical;
  }

  .review-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .groups-panel {
    margin-top: var(--space-4);
  }

  .groups-list {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .group-item {
    border: var(--brut-border-micro) solid var(--brut-ink);
    padding: var(--space-3);
  }

  .group-head {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    align-items: baseline;
    margin-bottom: var(--space-1);
  }

  .group-summary {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--brut-muted);
  }

  .member-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-xs);
  }

  .member-list li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    align-items: baseline;
  }

  .member-role {
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>

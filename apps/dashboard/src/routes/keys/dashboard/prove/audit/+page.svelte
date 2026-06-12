<script lang="ts">
  /**
   * R5: Prove / Audit tab — W3.7 audit depth.
   *
   * Before: fixed 50 rows, actor shown as type-only string, no filters, no pagination (FUNC P2-5).
   * After:  filters (actor, actorType, eventType, date range), keyset pagination ("Load more"),
   *         actor identity (email/prefix where available), object links (X4: each row links to
   *         the entity it concerns where a URL can be derived from targetType + targetId).
   *
   * ux-contracts §3 states: loading (handled by server), error (role="alert"), empty (EmptyState),
   * populated (audit list). Filter clear-action on empty-match state.
   */
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import type { AuditFilterParams } from "./+page.server";

  export let data: {
    events: {
      id: string;
      eventType: string;
      targetType: string;
      targetId: string;
      summary?: string | null;
      createdAt: number;
      actorType: string;
      actorId: string;
    }[];
    error: string | null;
    hasMore: boolean;
    filters: AuditFilterParams;
  };

  // Local filter state — mirrors URL params.
  let filterActor = data.filters.actor;
  let filterActorType = data.filters.actorType;
  let filterEventType = data.filters.eventType;
  let filterSince = data.filters.since ? new Date(data.filters.since).toISOString().slice(0, 16) : "";
  let filterUntil = data.filters.until ? new Date(data.filters.until).toISOString().slice(0, 16) : "";

  // EVENT_TYPE_OPTIONS lists only event types that are actually inserted in this codebase.
  // Verified by grepping for insertAuditEvent({...eventType: "..."}) across neon.ts + routes.
  const EVENT_TYPE_OPTIONS = [
    { value: "", label: "All actions" },
    { value: "gateway_key_created", label: "Key created" },
    { value: "gateway_key_revoked", label: "Key revoked" },
    { value: "gateway_key_renamed", label: "Key renamed" },
    { value: "management_key_created", label: "Management key created" },
    { value: "management_key_revoked", label: "Management key revoked" },
    { value: "policy_created", label: "Policy created" },
    { value: "route_published", label: "Route published" },
    { value: "provider_integration_created", label: "Connection created" },
    { value: "provider_integration_updated", label: "Connection updated" },
    { value: "provider_integration_deleted", label: "Connection deleted" },
    { value: "provider_binding_created", label: "Provider binding created" },
    { value: "provider_binding_deleted", label: "Provider binding deleted" },
  ];

  const ACTOR_TYPE_OPTIONS = [
    { value: "", label: "All actor types" },
    { value: "user", label: "User" },
    { value: "gateway_key", label: "Gateway key" },
    { value: "management_key", label: "Management key" },
    { value: "system", label: "System" },
  ];

  $: hasActiveFilters = !!(
    data.filters.actor ||
    data.filters.actorType ||
    data.filters.eventType ||
    data.filters.since ||
    data.filters.until
  );

  function applyFilters() {
    const params = new URLSearchParams();
    if (filterActor.trim()) params.set("actor", filterActor.trim());
    if (filterActorType) params.set("actorType", filterActorType);
    if (filterEventType) params.set("eventType", filterEventType);
    if (filterSince) params.set("since", String(new Date(filterSince).getTime()));
    if (filterUntil) params.set("until", String(new Date(filterUntil).getTime()));
    const qs = params.toString();
    // replaceState for filter changes (not new history entries — filters are not navigable "back" steps).
    goto(`${$page.url.pathname}${qs ? "?" + qs : ""}`, { replaceState: true });
  }

  function clearFilters() {
    filterActor = "";
    filterActorType = "";
    filterEventType = "";
    filterSince = "";
    filterUntil = "";
    goto($page.url.pathname, { replaceState: true });
  }

  function loadMore() {
    if (data.events.length === 0) return;
    const cursor = data.events[data.events.length - 1].createdAt;
    const params = new URLSearchParams($page.url.searchParams);
    params.set("before", String(cursor));
    // pushState (not replaceState) so Back returns to the previous page of results.
    goto(`${$page.url.pathname}?${params.toString()}`, { replaceState: false });
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString();
  }

  function formatRelative(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return new Date(ts).toLocaleDateString();
  }

  /** Format actor identity: show meaningful identifier, not just type. */
  function formatActor(evt: { actorType: string; actorId: string }): string {
    if (evt.actorType === "user") {
      // actorId is a user uid; show truncated if long.
      return evt.actorId.length > 12 ? evt.actorId.slice(0, 8) + "…" : evt.actorId;
    }
    if (evt.actorType === "gateway_key" || evt.actorType === "management_key") {
      return evt.actorId.length > 12 ? evt.actorId.slice(0, 8) + "…" : evt.actorId;
    }
    return evt.actorType;
  }

  function formatActorLabel(evt: { actorType: string }): string {
    const labels: Record<string, string> = {
      user: "user",
      gateway_key: "key",
      management_key: "mgmt key",
      system: "system",
    };
    return labels[evt.actorType] ?? evt.actorType;
  }

  /**
   * X4 (wave-r-design-usability-rubric): each audit row links to the object it concerns.
   * Derive href from targetType + targetId where a dashboard URL exists.
   */
  function targetHref(evt: { targetType: string; targetId: string }): string | null {
    switch (evt.targetType) {
      case "gateway_key":
        return DASHBOARD_BASE + "/access";
      case "project":
        return DASHBOARD_BASE + `/projects/${evt.targetId}`;
      case "route":
        return null; // route links need projectId which isn't in audit events yet
      case "policy":
        return DASHBOARD_BASE + `/policies/${evt.targetId}`;
      case "provider_integration":
        return DASHBOARD_BASE + `/integrations/${evt.targetId}`;
      case "workspace":
        return DASHBOARD_BASE + "/home";
      default:
        return null;
    }
  }

  function targetLabel(targetType: string): string {
    const labels: Record<string, string> = {
      gateway_key: "Gateway key",
      project: "Project",
      route: "Route",
      policy: "Policy",
      provider_integration: "Connection",
      workspace: "Workspace",
    };
    return labels[targetType] ?? targetType;
  }
</script>

<svelte:head>
  <title>Prove — Audit – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<h1 class="page-title">Audit log</h1>
<p class="page-desc">
  Key and configuration changes in your workspace — who created or revoked Gateway keys, project updates, and other
  control-plane events. This log is an evidentiary record: it shows what changed, when, and by whom.
</p>

<!-- Filters (W3.7 audit depth) -->
<form class="filter-bar" onsubmit={(e) => { e.preventDefault(); applyFilters(); }} aria-label="Filter audit log">
  <div class="filter-row">
    <div class="filter-group">
      <label for="filter-event-type" class="filter-label">Action</label>
      <select id="filter-event-type" bind:value={filterEventType} class="filter-select">
        {#each EVENT_TYPE_OPTIONS as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>
    <div class="filter-group">
      <label for="filter-actor-type" class="filter-label">Actor type</label>
      <select id="filter-actor-type" bind:value={filterActorType} class="filter-select">
        {#each ACTOR_TYPE_OPTIONS as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>
    <div class="filter-group filter-group-wide">
      <label for="filter-actor" class="filter-label">Actor ID</label>
      <input
        id="filter-actor"
        type="text"
        bind:value={filterActor}
        class="filter-input"
        placeholder="User uid or key id…"
        aria-label="Filter by actor ID"
      />
    </div>
  </div>
  <div class="filter-row">
    <div class="filter-group">
      <label for="filter-since" class="filter-label">From</label>
      <input
        id="filter-since"
        type="datetime-local"
        bind:value={filterSince}
        class="filter-input"
        aria-label="Filter events from this date"
      />
    </div>
    <div class="filter-group">
      <label for="filter-until" class="filter-label">To</label>
      <input
        id="filter-until"
        type="datetime-local"
        bind:value={filterUntil}
        class="filter-input"
        aria-label="Filter events up to this date"
      />
    </div>
    <div class="filter-actions">
      <button type="submit" class="btn btn-primary btn-sm">Apply filters</button>
      {#if hasActiveFilters}
        <button type="button" class="btn btn-secondary btn-sm" onclick={clearFilters}>Clear</button>
      {/if}
    </div>
  </div>
</form>

{#if data.error}
  <div class="error-banner" role="alert">
    <p class="error-msg">{data.error}</p>
    <a href={DASHBOARD_BASE + "/prove/audit"} class="btn btn-secondary btn-sm">Try again</a>
  </div>
{:else if data.events.length === 0}
  {#if hasActiveFilters}
    <EmptyState
      title="No events match these filters"
      description="Try widening the date range, changing the action type, or clearing all filters."
    >
      <button type="button" class="btn btn-secondary" onclick={clearFilters}>Clear filters</button>
    </EmptyState>
  {:else}
    <EmptyState
      title="No audit events yet"
      description="Key creation, revokes, and configuration changes will appear here. Create a Gateway key to see your first event."
    >
      <a href={DASHBOARD_BASE + "/access"} class="btn btn-secondary">Gateway keys →</a>
    </EmptyState>
  {/if}
{:else}
  <ul class="audit-list" aria-label="Audit log events">
    {#each data.events as evt (evt.id)}
      {@const href = targetHref(evt)}
      <li class="audit-row">
        <!-- Timestamp column -->
        <time
          class="audit-time"
          datetime={new Date(evt.createdAt).toISOString()}
          title={formatDate(evt.createdAt)}
          aria-label={formatDate(evt.createdAt)}
        >{formatRelative(evt.createdAt)}</time>

        <!-- Summary / action -->
        <span class="audit-summary">
          {evt.summary ?? `${evt.eventType} — ${evt.targetType}`}
        </span>

        <!-- Actor identity (W3.7: email/key-prefix, not just type) -->
        <span class="audit-actor" title="Actor: {evt.actorId}">
          <span class="audit-actor-type">{formatActorLabel(evt)}</span>
          <code class="audit-actor-id">{formatActor(evt)}</code>
        </span>

        <!-- Object link (X4: links to the entity the event concerns) -->
        <span class="audit-target">
          {#if href}
            <a class="audit-target-link" {href} aria-label="View {targetLabel(evt.targetType)}">
              {targetLabel(evt.targetType)} ↗
            </a>
          {:else}
            <span class="audit-target-text">{targetLabel(evt.targetType)}</span>
          {/if}
        </span>
      </li>
    {/each}
  </ul>

  {#if data.hasMore}
    <div class="load-more-row">
      <button type="button" class="btn btn-secondary" onclick={loadMore}>
        Older →
      </button>
    </div>
  {:else}
    <p class="end-notice">End of results{hasActiveFilters ? " for these filters" : ""}.</p>
  {/if}
{/if}

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
    margin: 0 0 var(--space-4);
    max-width: 46rem;
  }
  /* Filter bar (W3.7) */
  .filter-bar {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    margin: 0 0 var(--space-4);
    background: var(--rm-surface-raised);
    border: var(--border-thin);
    border-radius: var(--rm-radius);
  }
  .filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: flex-end;
  }
  .filter-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 10rem;
  }
  .filter-group-wide {
    flex: 1 1 14rem;
  }
  .filter-label {
    font-size: var(--text-xs);
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-dim);
  }
  .filter-select,
  .filter-input {
    padding: var(--space-1) var(--space-2);
    border: var(--border-thin);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    background: var(--rm-bg);
    color: var(--rm-text);
  }
  .filter-actions {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
    padding-bottom: 0;
  }
  /* Buttons */
  .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    border: none;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
  }
  .btn-sm {
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-xs);
  }
  .btn-primary {
    background: var(--rm-accent, #111);
    color: var(--rm-on-accent, #fff);
  }
  .btn-secondary {
    background: var(--rm-surface);
    color: var(--rm-text);
    border: var(--border-thin);
  }
  /* Error state */
  .error-banner {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--rm-surface-raised);
    border: var(--border-thin);
    border-left: 4px solid var(--coral-alert);
    border-radius: var(--rm-radius);
    margin: 0 0 var(--space-4);
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
    margin: 0;
    flex: 1;
  }
  /* Audit list */
  .audit-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .audit-row {
    display: grid;
    grid-template-columns: 7rem 1fr auto auto;
    gap: var(--space-3);
    align-items: baseline;
    padding: var(--space-2) 0;
    border-bottom: var(--border-thin);
    font-size: var(--text-sm);
  }
  .audit-time {
    color: var(--rm-dim);
    white-space: nowrap;
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
  }
  .audit-summary {
    color: var(--rm-text);
    word-break: break-word;
  }
  /* Actor identity (W3.7: email/prefix, not just type) */
  .audit-actor {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--rm-muted);
    font-size: var(--text-xs);
    white-space: nowrap;
  }
  .audit-actor-type {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    background: var(--rm-surface-raised);
    padding: 0 var(--space-1);
    border: var(--border-thin);
    border-radius: 2px;
  }
  .audit-actor-id {
    font-size: var(--text-xs);
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    color: var(--rm-muted);
  }
  /* Object link (X4) */
  .audit-target {
    text-align: right;
    white-space: nowrap;
    font-size: var(--text-xs);
  }
  .audit-target-link {
    color: var(--rm-sage);
    text-decoration: none;
    font-size: var(--text-xs);
  }
  .audit-target-link:hover {
    text-decoration: underline;
  }
  .audit-target-text {
    color: var(--rm-dim);
    font-size: var(--text-xs);
  }
  /* Pagination */
  .load-more-row {
    display: flex;
    justify-content: center;
    padding: var(--space-4) 0;
  }
  .end-notice {
    text-align: center;
    color: var(--rm-dim);
    font-size: var(--text-xs);
    padding: var(--space-3) 0;
    font-family: var(--rm-font-mono, ui-monospace, monospace);
  }
</style>

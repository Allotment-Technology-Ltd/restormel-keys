<script lang="ts">
  /**
   * Phase 3 Stage 4 — "Publish = deploy the answer-serving config".
   *
   * Promotes the current verified-query routing to LIVE so the user's app can call
   * it (MCP / AAIF / REST). Concretely it publishes the unpublished chat-stage
   * routes that back the console answer — resolving the publish-stranding (K-P0-3)
   * without hopping into the 3,461-line route builder. After publish, the live
   * endpoint (POST /connect/v1/graph) serves this config — the very endpoint the
   * "Get Code" snippet (below the answer) targets.
   *
   * Reuses POST /keys/dashboard/prove/api/publish-config. No route-step logic here.
   */
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher<{ published: void }>();
  const PUBLISH_API = "/keys/dashboard/prove/api/publish-config";

  /** How many chat-stage routes are unpublished (from the routing-strip snapshot). */
  export let needsPublishCount = 0;
  /** True once at least one chat route is published (live) — drives the "live" state. */
  export let hasLiveConfig = false;

  type Outcome = {
    stage: string;
    routeId: string;
    status: "published" | "already_published" | "validation_failed" | "not_found";
    errors?: { field: string; message: string }[];
  };

  let status: "idle" | "publishing" | "done" | "error" = "idle";
  let error: string | null = null;
  let result:
    | { ok: boolean; live: boolean; publishedCount: number; failedCount: number; outcomes: Outcome[] }
    | null = null;

  async function publish(): Promise<void> {
    status = "publishing";
    error = null;
    result = null;
    try {
      const res = await fetch(PUBLISH_API, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        status = "error";
        error = data?.message ?? data?.error ?? `HTTP ${res.status}`;
        return;
      }
      result = data;
      status = "done";
      dispatch("published");
    } catch (e) {
      status = "error";
      error = e instanceof Error ? e.message : "Publish failed.";
    }
  }

  $: failedOutcomes = (result?.outcomes ?? []).filter(
    (o) => o.status === "validation_failed" || o.status === "not_found",
  );
</script>

<section class="publish" aria-label="Publish the answer-serving config">
  <div class="publish-head">
    <div class="publish-headings">
      <span class="publish-tag">SHIP IT · GO LIVE FOR YOUR APP</span>
      <p class="publish-lede">
        Make this exact setup live so your app gets the same verified answers you just saw
        (<code>POST /connect/v1/graph</code> — the endpoint the snippet below calls).
      </p>
    </div>

    {#if status === "done" && result?.live}
      <span class="publish-state publish-state-live" aria-live="polite">● LIVE</span>
    {:else if hasLiveConfig && needsPublishCount === 0}
      <span class="publish-state publish-state-live">● LIVE</span>
    {:else if needsPublishCount > 0}
      <span class="publish-state publish-state-draft">{needsPublishCount} UNPUBLISHED</span>
    {/if}
  </div>

  {#if status !== "done"}
    <button
      type="button"
      class="publish-btn brut-pressable brut-focus"
      disabled={status === "publishing"}
      on:click={publish}
    >
      {#if status === "publishing"}
        PUBLISHING…
      {:else if hasLiveConfig && needsPublishCount === 0}
        RE-PUBLISH CONFIG →
      {:else}
        PUBLISH & GO LIVE →
      {/if}
    </button>
  {/if}

  {#if status === "error"}
    <p class="publish-msg publish-msg-error" role="alert">✗ {error}</p>
  {/if}

  {#if status === "done" && result}
    {#if result.live}
      <p class="publish-msg publish-msg-ok" role="status">
        ✓ You're live. Your app gets these verified answers now — grab the snippet below to wire it in.
      </p>
    {:else}
      <p class="publish-msg publish-msg-warn" role="alert">
        Published {result.publishedCount}
        {result.publishedCount === 1 ? "route" : "routes"}, but
        {result.failedCount}
        {result.failedCount === 1 ? "route" : "routes"} could not go live.
      </p>
      <ul class="publish-fails">
        {#each failedOutcomes as o (o.routeId)}
          <li class="publish-fail">
            <strong>{o.stage}:</strong>
            {#if o.status === "validation_failed"}
              {o.errors?.[0]?.message ?? "missing executable provider/model — set one in Advanced."}
            {:else}
              route not found.
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .publish {
    border: var(--border);
    box-shadow: var(--shadow-md);
    background: var(--color-surface);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .publish-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .publish-headings {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .publish-tag {
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    color: var(--color-ink);
  }

  .publish-lede {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    line-height: 1.5;
    color: var(--color-ink-muted);
  }
  .publish-lede code {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: var(--color-bg-deep);
    padding: 1px 5px;
    border: var(--border-thin);
  }

  .publish-state {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 2px 8px;
    border: var(--border-thin);
    white-space: nowrap;
  }
  .publish-state-live {
    background: var(--color-yellow);
    color: var(--color-ink);
    border-color: var(--color-ink);
  }
  .publish-state-draft {
    background: transparent;
    color: var(--color-ink-muted);
    border-color: var(--color-ink-muted);
    border-style: dashed;
  }

  .publish-btn {
    align-self: flex-start;
    background: var(--color-ink);
    color: var(--color-surface);
    border: var(--border);
    border-radius: 0;
    box-shadow: 3px 3px 0 0 var(--color-ink);
    padding: var(--space-2) var(--space-4);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--text-mono-md);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    min-height: 40px;
  }
  .publish-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .publish-msg {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: var(--space-2) var(--space-3);
    border: var(--border-thin);
  }
  .publish-msg-ok {
    background: var(--color-yellow);
    color: var(--color-ink);
    border-color: var(--color-ink);
  }
  .publish-msg-error,
  .publish-msg-warn {
    background: var(--state-fail-bg, #fee2e2);
    color: var(--state-fail-fg, #991b1b);
    border-color: var(--state-fail-fg, #991b1b);
  }

  .publish-fails {
    margin: 0;
    padding-left: var(--space-4);
    font-family: var(--font-body);
    font-size: var(--text-body-sm);
    color: var(--color-ink-muted);
  }
  .publish-fail {
    margin: 0 0 var(--space-1);
  }
</style>

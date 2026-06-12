<script lang="ts">
  export let data: {
    entitlements: {
      plan: "free" | "pro";
      projectLimit: number;
      monthlyRequestLimit: number;
      isServiceAdmin?: boolean;
      isFounderUser?: boolean;
      foundingProExpiresAt?: number | null;
    } | null;
    paddleKeyConfigured: boolean;
    hasCustomerId: boolean;
    paddleSubscriptionStatus: string | null;
    invoices: Array<{ id: string; amount: string; issuedAt: string }>;
  };

  $: isPro = data.entitlements?.plan === "pro";
  $: isOp = data.entitlements?.isServiceAdmin === true;
  $: isFounder = data.entitlements?.isFounderUser === true;

  // Portal is actionable when: the Paddle API key is on this deployment AND the
  // workspace has a customer ID (they have checked out at least once).
  $: canOpenPortal = data.paddleKeyConfigured && data.hasCustomerId;

  let portalLoading = false;
  let portalError: string | null = null;

  async function openPortal() {
    portalLoading = true;
    portalError = null;
    try {
      const res = await fetch("/keys/dashboard/api/billing/portal-session", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.url) {
        portalError =
          body?.error ?? "Unable to open billing portal. Please try again or contact support.";
        return;
      }
      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch {
      portalError = "Unable to open billing portal. Please check your connection and try again.";
    } finally {
      portalLoading = false;
    }
  }
</script>

<h1 class="page-title">Subscription & Billing</h1>
<p class="page-desc">View your current plan, usage limits, and invoice history.</p>

{#if isOp}
  <p class="operator-banner" role="status">
    You are signed in as a <strong>service operator</strong>. Subscription limits are waived for
    internal testing; this is not end-customer billing.
  </p>
{/if}

<section class="grid" aria-label="Billing overview">
  <article class="card">
    <h2>Current plan</h2>
    <p class="plan">{isOp ? "Pro (operator)" : isPro ? "Pro" : "Free"}</p>
    <ul>
      <li>Projects: {data.entitlements?.projectLimit ?? 0}</li>
      <li>Monthly requests: {(data.entitlements?.monthlyRequestLimit ?? 0).toLocaleString()}</li>
    </ul>

    {#if isOp}
      <p class="muted small">No subscription required for operator accounts.</p>
    {:else if isFounder && isPro}
      <p class="muted small">
        Pro access via the Founding Programme.
        {#if data.entitlements?.foundingProExpiresAt}
          Expires {new Date(data.entitlements.foundingProExpiresAt).toLocaleDateString()}.
        {/if}
      </p>
    {:else if isPro}
      {#if canOpenPortal}
        <button
          class="btn btn-primary"
          on:click={openPortal}
          disabled={portalLoading}
          aria-label="Open Paddle billing portal in a new tab"
        >
          {portalLoading ? "Opening…" : "Manage subscription"}
        </button>
      {:else}
        <p class="muted small">
          To update payment details, cancel, or download invoices, visit
          <a
            href="https://vendors.paddle.com"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-link"
          >
            Paddle's customer portal
          </a>
          — the link is in your receipt emails.
        </p>
      {/if}
    {:else}
      <a class="btn btn-primary" href="/keys/pricing">Upgrade to Pro</a>
    {/if}
  </article>

  <article class="card">
    <h2>Invoices</h2>
    {#if data.invoices.length > 0}
      <ul>
        {#each data.invoices as invoice}
          <li>{invoice.issuedAt} · {invoice.amount}</li>
        {/each}
      </ul>
    {:else if isPro && !isFounder && !isOp}
      <p class="muted">
        Invoice history is available in the Paddle billing portal. Use the "Manage subscription"
        button above, or find your receipts in email from Paddle.
      </p>
    {:else if isPro}
      <p class="muted">No invoices — your Pro access is not via a paid subscription.</p>
    {:else}
      <p class="muted">No invoices yet. Invoices will appear here after your first payment.</p>
    {/if}

    {#if canOpenPortal && isPro && !isOp && !isFounder}
      <button
        class="btn btn-secondary"
        on:click={openPortal}
        disabled={portalLoading}
        aria-label="Open Paddle billing portal in a new tab"
      >
        {portalLoading ? "Opening…" : "Open Paddle billing portal"}
      </button>
    {/if}

    {#if portalError}
      <p class="error" role="alert">{portalError}</p>
    {/if}
  </article>
</section>

{#if data.paddleSubscriptionStatus && data.paddleSubscriptionStatus !== "active" && isPro && !isOp}
  <p class="status-banner" role="status">
    Subscription status: <strong>{data.paddleSubscriptionStatus}</strong>. If this is unexpected,
    <a
      href="https://vendors.paddle.com"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-link"
    >
      open the Paddle portal
    </a>
    or contact support.
  </p>
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
  }
  .operator-banner,
  .status-banner {
    margin: 0 0 var(--space-4);
    padding: var(--space-3);
    border-radius: var(--rm-radius);
    border: var(--border-thin);
    background: var(--rm-surface);
    color: var(--rm-muted);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .muted.small {
    font-size: var(--text-xs);
    margin: var(--space-2) 0 0;
  }
  .grid {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: 1fr;
  }
  @media (min-width: 960px) {
    .grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  .card {
    border: var(--border-thin);
    border-radius: var(--rm-radius);
    background: var(--rm-surface-raised);
    padding: var(--space-4);
  }
  .card h2 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-base);
    color: var(--rm-text);
  }
  .plan {
    margin: 0 0 var(--space-2);
    color: var(--rm-text);
    font-size: var(--text-xl);
    font-weight: 700;
  }
  .card ul {
    margin: 0 0 var(--space-3);
    padding-left: var(--space-4);
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .muted {
    margin: 0 0 var(--space-3);
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .btn {
    display: inline-block;
    text-decoration: none;
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    cursor: pointer;
    border: none;
    font-family: inherit;
  }
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-primary {
    background: var(--rm-sage, #6b7f6e);
    color: var(--rm-on-sage, #fff);
  }
  .btn-secondary {
    border: var(--border-thin);
    color: var(--rm-text);
    background: var(--rm-surface);
  }
  .inline-link {
    color: var(--rm-text);
    text-decoration: underline;
  }
  .error {
    margin: var(--space-2) 0 0;
    color: var(--rm-error, #c0392b);
    font-size: var(--text-sm);
  }
</style>

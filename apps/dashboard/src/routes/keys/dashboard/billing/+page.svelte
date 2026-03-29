<script lang="ts">
  export let data: {
    entitlements: {
      plan: "free" | "pro";
      projectLimit: number;
      monthlyRequestLimit: number;
    } | null;
    invoices: Array<{ id: string; amount: string; issuedAt: string }>;
  };

  $: isPro = data.entitlements?.plan === "pro";
</script>

<h1 class="page-title">Subscription & Billing</h1>
<p class="page-desc">View your current plan, usage limits, and invoice history.</p>

<section class="grid" aria-label="Billing overview">
  <article class="card">
    <h2>Current plan</h2>
    <p class="plan">{isPro ? "Pro" : "Free"}</p>
    <ul>
      <li>Projects: {data.entitlements?.projectLimit ?? 0}</li>
      <li>Monthly requests: {(data.entitlements?.monthlyRequestLimit ?? 0).toLocaleString()}</li>
    </ul>
    {#if isPro}
      <a class="btn btn-primary" href="/keys/dashboard/billing">Manage subscription</a>
    {:else}
      <a class="btn btn-primary" href="/keys/pricing">Upgrade to Pro</a>
    {/if}
  </article>

  <article class="card">
    <h2>Invoices</h2>
    {#if data.invoices.length === 0}
      <p class="muted">No invoices yet - they will appear here when you subscribe to Pro.</p>
    {:else}
      <ul>
        {#each data.invoices as invoice}
          <li>{invoice.issuedAt} · {invoice.amount}</li>
        {/each}
      </ul>
    {/if}
    {#if isPro}
      <a class="btn btn-secondary" href="/keys/dashboard/billing">Open Paddle billing portal</a>
    {/if}
  </article>
</section>

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
    border: 1px solid var(--rm-border);
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
  }
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .btn-secondary {
    border: 1px solid var(--rm-border);
    color: var(--rm-text);
    background: var(--rm-surface);
  }
</style>

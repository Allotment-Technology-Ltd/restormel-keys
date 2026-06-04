<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { page } from "$app/stores";

  $: email = $page.data.user?.email ?? null;
</script>

<svelte:head>
  <title>Access pending — Restormel Founders Circle</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<article class="pending-page container">
  <h1>Your access request is pending</h1>
  <p class="lead">
    Restormel is invite-only while we onboard the Founders Circle in small cohorts. We received your
    request{#if email} for {email}{/if} — an operator will approve it before you can use the dashboard.
  </p>
  <ul class="steps">
    <li>We review applications manually — usually within a few business days.</li>
    <li>When approved, sign in again with the same email to enter the workspace.</li>
    <li>Need to change details? Submit a fresh application on the Founders page.</li>
  </ul>
  <div class="actions">
    <a class="btn btn-primary" href="/founders">Founders Circle</a>
    <a class="btn btn-ghost" href={DASHBOARD_BASE + "/logout"}>Sign out</a>
  </div>
</article>

<style>
  .pending-page {
    max-width: 36rem;
    padding: var(--space-8) var(--space-4) var(--space-12);
  }
  .lead {
    line-height: 1.6;
    color: var(--rm-muted);
  }
  .steps {
    margin: var(--space-6) 0;
    padding-left: var(--space-5);
    color: var(--rm-muted);
    line-height: 1.55;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
</style>

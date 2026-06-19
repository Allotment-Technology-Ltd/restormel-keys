<script lang="ts">
  // Legacy `export let` (dashboard uses compilerOptions.runes: false).
  import { enhance } from "$app/forms";
  import type { ActionData, PageData } from "./$types";

  export let data: PageData;
  export let form: ActionData;

  let submitting = false;

  // The page has three terminal states, all neutral (never confirm/deny an address):
  //   done      → "you're unsubscribed"
  //   invalid   → "this link is no longer valid" (forged / garbage / expired)
  //   error     → transient server error, try again
  $: status = form?.status ?? null;
</script>

<svelte:head>
  <title>Unsubscribe — Restormel Keys</title>
  <meta name="robots" content="noindex,nofollow" />
  <meta name="description" content="Unsubscribe from Restormel Keys marketing email." />
</svelte:head>

<main class="unsub">
  <div class="cap">
    <span class="kicker">Restormel Keys</span>
    <h1>Unsubscribe</h1>
  </div>

  <section class="card" aria-live="polite">
    {#if status === "done"}
      <p class="lead">You’re unsubscribed.</p>
      <p class="muted">
        You’ll no longer receive marketing email (product updates, newsletter, release notes) from
        Restormel Keys. This can take a moment to propagate.
      </p>
      <p class="muted small">
        Service and security email (sign-in, billing, security alerts) is required to operate your
        account and can’t be turned off here.
      </p>
    {:else if status === "rate_limited"}
      <p class="lead">Too many requests.</p>
      <p class="muted">
        Please wait {form && "retryAfterSeconds" in form ? form.retryAfterSeconds : 60}s and try
        again.
      </p>
    {:else if status === "invalid"}
      <p class="lead">This link is no longer valid.</p>
      <p class="muted">
        It may have expired or already been used. If you’re signed in, manage every email category
        from your <a class="link" href="/keys/dashboard/settings">email preferences</a>.
      </p>
    {:else if status === "error"}
      <p class="lead">Something went wrong.</p>
      <p class="muted">We couldn’t process that just now. Please try again in a moment.</p>
      {#if data.tokenLooksValid}
        <form method="POST" use:enhance={() => { submitting = true; return async ({ update }) => { await update(); submitting = false; }; }}>
          <input type="hidden" name="token" value={data.token} />
          <input type="hidden" name="List-Unsubscribe" value="One-Click" />
          <button class="brut-btn" type="submit" disabled={submitting}>
            {submitting ? "Working…" : "Try again"}
          </button>
        </form>
      {/if}
    {:else if data.tokenLooksValid}
      <p class="lead">Confirm you want to unsubscribe.</p>
      <p class="muted">
        Stop receiving marketing email — product updates, the newsletter, and release notes — from
        Restormel Keys. Service and security email can’t be disabled here.
      </p>
      <form method="POST" use:enhance={() => { submitting = true; return async ({ update }) => { await update(); submitting = false; }; }}>
        <input type="hidden" name="token" value={data.token} />
        <input type="hidden" name="List-Unsubscribe" value="One-Click" />
        <button class="brut-btn" type="submit" disabled={submitting}>
          {submitting ? "Unsubscribing…" : "Unsubscribe"}
        </button>
      </form>
    {:else}
      <p class="lead">This link is no longer valid.</p>
      <p class="muted">
        It may have expired or already been used. If you’re signed in, manage every email category
        from your <a class="link" href="/keys/dashboard/settings">email preferences</a>.
      </p>
    {/if}
  </section>
</main>

<style>
  .unsub {
    max-width: 34rem;
    margin: var(--space-8, 3rem) auto;
    padding: 0 var(--space-4, 1rem);
    font-family: var(--rm-font-body, system-ui, sans-serif);
    color: var(--rm-text, #0c0c0c);
  }
  .cap {
    background: var(--rm-accent, #f4d35e);
    border: var(--border, 3px solid #0c0c0c);
    border-bottom: none;
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  }
  .kicker {
    display: block;
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: var(--text-xs, 0.75rem);
    color: var(--rm-text, #0c0c0c);
  }
  .cap h1 {
    margin: var(--space-1, 0.25rem) 0 0;
    font-family: var(--rm-font-display, "Barlow Condensed", sans-serif);
    font-size: var(--text-2xl, 1.75rem);
    font-weight: 700;
    line-height: 1.05;
  }
  .card {
    background: var(--rm-surface, #fff);
    border: var(--border, 3px solid #0c0c0c);
    box-shadow: var(--shadow-md, 6px 6px 0 #0c0c0c);
    padding: var(--space-5, 1.5rem) var(--space-4, 1rem);
  }
  .lead {
    margin: 0 0 var(--space-3, 0.75rem);
    font-size: var(--text-lg, 1.125rem);
    font-weight: 600;
  }
  .muted {
    margin: 0 0 var(--space-3, 0.75rem);
    color: var(--rm-muted, #555);
    font-size: var(--text-sm, 0.9rem);
    line-height: 1.5;
  }
  .muted.small {
    font-size: var(--text-xs, 0.78rem);
  }
  .link {
    color: var(--rm-sage, #2f6f4f);
    font-weight: 600;
  }
  .brut-btn {
    display: inline-block;
    margin-top: var(--space-2, 0.5rem);
    padding: var(--space-2, 0.6rem) var(--space-5, 1.5rem);
    background: var(--rm-accent, #f4d35e);
    color: var(--rm-text, #0c0c0c);
    border: var(--border, 3px solid #0c0c0c);
    box-shadow: var(--shadow-sm, 4px 4px 0 #0c0c0c);
    border-radius: 0;
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: var(--text-sm, 0.9rem);
    font-weight: 700;
    cursor: pointer;
    min-height: 44px;
    transition: transform 0.05s ease, box-shadow 0.05s ease;
  }
  .brut-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-md, 6px 6px 0 #0c0c0c);
  }
  .brut-btn:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--rm-text, #0c0c0c);
  }
  .brut-btn:disabled {
    opacity: 0.6;
    cursor: default;
    transform: none;
    box-shadow: var(--shadow-sm, 4px 4px 0 #0c0c0c);
  }
</style>

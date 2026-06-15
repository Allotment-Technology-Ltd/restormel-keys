<script lang="ts">
  /**
   * Cookie / analytics consent banner (PECR + UK GDPR). PostHog runs cookieless until the
   * visitor opts in (see hooks.client.ts + $lib/analytics/consent). This banner records the
   * choice and applies it live: granting upgrades PostHog to persistent capture; denying opts
   * it out. It only appears when no decision has been made yet.
   *
   * Link target note: points to the live privacy policy (which covers analytics) until the
   * dedicated Cookie Policy (legal/cookie-policy.md) is finalised by counsel and approved, at
   * which point this should point to /legal/cookie-policy.
   */
  import { onMount } from "svelte";
  import { getConsentState, setConsentState } from "$lib/analytics/consent";

  let show = false;

  onMount(() => {
    show = getConsentState() === "unknown";
  });

  async function choose(state: "granted" | "denied") {
    setConsentState(state);
    show = false;
    try {
      const posthog = (await import("posthog-js")).default;
      if (state === "granted") {
        posthog.set_config?.({ persistence: "localStorage+cookie" });
        posthog.opt_in_capturing?.();
      } else {
        posthog.opt_out_capturing?.();
      }
    } catch {
      // analytics not loaded (e.g. no PostHog key) — the choice is still recorded in the cookie.
    }
  }
</script>

{#if show}
  <div class="cookie-consent" role="dialog" aria-live="polite" aria-label="Cookie consent">
    <p class="text">
      We use strictly necessary cookies to run the site, and — only with your consent —
      privacy-friendly product analytics (PostHog, EU region) to improve Restormel. See our
      <a href="/keys/privacy">Privacy Policy</a>.
    </p>
    <div class="actions">
      <button type="button" class="reject" on:click={() => choose("denied")}>Reject non-essential</button>
      <button type="button" class="accept" on:click={() => choose("granted")}>Accept analytics</button>
    </div>
  </div>
{/if}

<style>
  .cookie-consent {
    position: fixed;
    inset: auto 1rem 1rem 1rem;
    z-index: 60;
    max-width: 32rem;
    margin-left: auto;
    background: var(--rm-surface, #fff);
    color: var(--rm-text, #1a1a1a);
    border: 1px solid var(--rm-border, #d9d9d9);
    border-radius: 0.6rem;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
    padding: 1rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .text {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--rm-muted, #444);
  }
  .text a {
    color: var(--rm-sage, #2f6f4f);
  }
  .actions {
    display: flex;
    gap: 0.6rem;
    justify-content: flex-end;
  }
  button {
    border-radius: 0.45rem;
    padding: 0.45rem 0.9rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--rm-border, #cfcfcf);
  }
  .reject {
    background: transparent;
    color: var(--rm-text, #1a1a1a);
  }
  .accept {
    background: var(--rm-sage, #2f6f4f);
    color: #fff;
    border-color: var(--rm-sage, #2f6f4f);
  }
</style>

<script lang="ts">
  import { enhance } from "$app/forms";
  import { ADMIN_BASE, DASHBOARD_BASE } from "$lib/dashboard-base";
  import type { ActionData, PageData } from "./$types";

  export let data: PageData & {
    emailPreferences: {
      flags: { productUpdates: boolean; newsletter: boolean; releaseNotes: boolean };
      unsubscribedAt: string | null;
      consentSource: string | null;
    };
  };
  export let form: ActionData;

  $: isOp = data.user?.isServiceAdmin === true;
  $: displayName = (data.user?.name ?? "").trim();
  $: prefs = data.emailPreferences;

  let savingPrefs = false;
</script>

<h1 class="page-title">Profile &amp; settings</h1>
<p class="page-desc">Profile, email preferences, subscription, and sign-out.</p>

{#if data.user}
  {#if isOp}
    <section class="settings-section" aria-labelledby="admin-heading">
      <h2 id="admin-heading" class="section-title">Service owner</h2>
      <p class="section-desc">
        Open the <strong>admin console</strong> (avatar menu → Admin) for user management and package insights. Prefer
        assigning an <strong>admin</strong> (or <code>service_admin</code> / <code>operator</code>) role in
        <strong>Neon Auth</strong> when your project exposes <code>user.role</code> on the session — that is the easiest
        way to grant operator access. You can also use the <code>service_admins</code> table or deployment env vars; see
        the service-admin runbook.
      </p>
      <p class="section-links">
        <a class="link" href={ADMIN_BASE + "/users"}>User management</a>
        <span class="sep" aria-hidden="true">·</span>
        <a class="link" href={ADMIN_BASE + "/package-registry"}>Package registry insights</a>
      </p>
    </section>
  {/if}

  <section class="settings-section" aria-labelledby="profile-heading">
    <h2 id="profile-heading" class="section-title">Profile</h2>
    <dl class="settings-list">
      <dt>Display name</dt>
      <dd>{displayName || "—"}</dd>
    </dl>
    <p class="section-note">
      Your display name comes from your sign-in provider and is read-only here. Update it with your
      identity provider (e.g. GitHub) and it will refresh on your next sign-in.
    </p>
  </section>

  <section class="settings-section" aria-labelledby="account-heading">
    <h2 id="account-heading" class="section-title">Account</h2>
    <dl class="settings-list">
      <dt>User ID</dt>
      <dd><code>{data.user.uid}</code></dd>
      {#if data.user.email}
        <dt>Email</dt>
        <dd>{data.user.email}</dd>
      {/if}
    </dl>
    <p class="section-note">Your email is managed by your sign-in provider and can’t be changed here.</p>
  </section>

  <section class="settings-section" aria-labelledby="email-prefs-heading">
    <h2 id="email-prefs-heading" class="section-title">Email preferences</h2>
    <p class="section-desc">
      Choose which marketing email you receive. Changes save to your account immediately.
    </p>

    {#if prefs.unsubscribedAt}
      <p class="prefs-banner">
        You previously unsubscribed from all marketing email. Turning any category back on below will
        re-subscribe you.
      </p>
    {/if}

    <form
      method="POST"
      action="?/emailPreferences"
      use:enhance={() => {
        savingPrefs = true;
        return async ({ update }) => {
          await update({ reset: false });
          savingPrefs = false;
        };
      }}
    >
      <ul class="prefs-list">
        <li class="prefs-row">
          <label class="prefs-label">
            <input type="checkbox" name="product_updates" checked={prefs.flags.productUpdates} />
            <span>
              <strong>Product updates</strong>
              <span class="prefs-desc">New features, changes, and improvements.</span>
            </span>
          </label>
        </li>
        <li class="prefs-row">
          <label class="prefs-label">
            <input type="checkbox" name="newsletter" checked={prefs.flags.newsletter} />
            <span>
              <strong>Newsletter</strong>
              <span class="prefs-desc">Occasional roundups and announcements.</span>
            </span>
          </label>
        </li>
        <li class="prefs-row">
          <label class="prefs-label">
            <input type="checkbox" name="release_notes" checked={prefs.flags.releaseNotes} />
            <span>
              <strong>Release notes</strong>
              <span class="prefs-desc">Detailed notes when we ship a release.</span>
            </span>
          </label>
        </li>
      </ul>

      <div class="prefs-actions">
        <button class="btn btn-primary" type="submit" disabled={savingPrefs}>
          {savingPrefs ? "Saving…" : "Save preferences"}
        </button>
        {#if form?.prefStatus === "saved"}
          <span class="prefs-status ok" role="status">Saved.</span>
        {:else if form?.prefStatus === "error"}
          <span class="prefs-status err" role="status">Couldn’t save — try again.</span>
        {:else if form?.prefStatus === "no_email"}
          <span class="prefs-status err" role="status">No email on your account.</span>
        {/if}
      </div>
    </form>

    <p class="section-note">
      Service and security email — sign-in, billing, and security alerts — is required to operate
      your account and <strong>can’t be disabled</strong>.
    </p>
  </section>

  <section class="settings-section" aria-labelledby="subscription-heading">
    <h2 id="subscription-heading" class="section-title">Subscription</h2>
    <p class="section-desc">Manage your subscription and view invoices.</p>
    <p class="section-links">
      <a class="link" href={DASHBOARD_BASE + "/billing"}>Manage subscription</a>
      <span class="sep" aria-hidden="true">·</span>
      <a class="link" href="/keys/pricing">View pricing</a>
    </p>
  </section>

  <section class="settings-section" aria-labelledby="signout-heading">
    <h2 id="signout-heading" class="section-title">Sign out</h2>
    <p class="section-desc">Sign out of the dashboard on this device.</p>
    <a class="btn btn-secondary" href={DASHBOARD_BASE + "/logout"} data-sveltekit-reload>Sign out</a>
  </section>
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
  .settings-section {
    margin: 0 0 var(--space-6);
    padding: var(--space-4);
    background: var(--rm-surface);
    border: var(--border-thin);
    border-radius: var(--radius-md);
  }
  .section-title {
    margin: 0 0 var(--space-1);
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
  }
  .section-desc {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .settings-list {
    margin: 0;
  }
  .settings-list dt {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    margin-top: var(--space-3);
  }
  .settings-list dd {
    margin: var(--space-1) 0 0;
    font-size: var(--text-sm);
  }
  .settings-list dd code {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .section-links {
    margin: 0;
    font-size: var(--text-sm);
  }
  .link {
    color: var(--rm-sage);
    font-weight: 500;
    text-decoration: none;
  }
  .link:hover {
    text-decoration: underline;
  }
  .sep {
    color: var(--rm-dim);
    margin: 0 var(--space-2);
  }
  .btn {
    display: inline-block;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    border: none;
    cursor: pointer;
    text-decoration: none;
  }
  .btn-secondary {
    background: var(--rm-surface-raised);
    color: var(--rm-text);
    border: var(--border-thin);
  }
  .btn-secondary:hover {
    border-color: var(--rm-sage);
    color: var(--rm-sage);
    text-decoration: none;
  }
  .btn-primary {
    background: var(--rm-accent, #f4d35e);
    color: var(--rm-text);
    border: var(--border, 3px solid var(--rm-text));
    border-radius: 0;
    box-shadow: var(--shadow-sm, 4px 4px 0 var(--rm-text));
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 700;
    min-height: 44px;
  }
  .btn-primary:hover {
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-md, 6px 6px 0 var(--rm-text));
  }
  .btn-primary:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--rm-text);
  }
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: default;
    transform: none;
    box-shadow: var(--shadow-sm, 4px 4px 0 var(--rm-text));
  }
  .section-note {
    margin: var(--space-3) 0 0;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    line-height: 1.5;
  }
  .prefs-banner {
    margin: 0 0 var(--space-3);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-text);
    background: var(--rm-accent-soft, #fbf3cf);
    border: var(--border-thin);
    border-left: 4px solid var(--rm-accent, #f4d35e);
  }
  .prefs-list {
    list-style: none;
    margin: 0 0 var(--space-4);
    padding: 0;
  }
  .prefs-row {
    border-top: var(--border-thin);
    padding: var(--space-3) 0;
  }
  .prefs-row:first-child {
    border-top: none;
  }
  .prefs-label {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    cursor: pointer;
    min-height: 44px;
  }
  .prefs-label input[type="checkbox"] {
    margin-top: 3px;
    width: 1.1rem;
    height: 1.1rem;
    accent-color: var(--rm-sage, #2f6f4f);
    flex: none;
  }
  .prefs-label strong {
    display: block;
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .prefs-desc {
    display: block;
    font-size: var(--text-xs);
    color: var(--rm-muted);
    margin-top: 2px;
  }
  .prefs-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .prefs-status {
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .prefs-status.ok {
    color: var(--rm-sage, #2f6f4f);
  }
  .prefs-status.err {
    color: var(--rm-danger, #b3261e);
  }
</style>

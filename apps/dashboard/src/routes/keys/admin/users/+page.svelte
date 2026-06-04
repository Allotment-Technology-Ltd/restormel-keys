<script lang="ts">
  import { ADMIN_BASE, DASHBOARD_BASE } from "$lib/dashboard-base";
  import type { AdminUserListRow } from "$lib/admin-user-list";

  export let data: {
    adminUsers: AdminUserListRow[];
    operatorEmails: import("$lib/server/service-admin-emails").ServiceAdminEmailRow[];
    adminUsersError: string | null;
  };

  let rows = data.adminUsers;
  let operatorEmails = data.operatorEmails;
  let savingId: string | null = null;
  let operatorEmailInput = "";
  let operatorSaving = false;
  let errorMessage: string | null = null;
  /** Bumps to remount checkboxes after a failed toggle (browser flips before we respond). */
  let checkboxEpoch: Record<string, number> = {};

  $: rows = data.adminUsers;
  $: operatorEmails = data.operatorEmails;

  async function addOperatorEmail() {
    errorMessage = null;
    operatorSaving = true;
    try {
      const res = await fetch(`${ADMIN_BASE}/api/operator-emails`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: operatorEmailInput.trim() }),
        credentials: "same-origin",
      });
      const payload = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        errorMessage = payload.message ?? payload.error ?? `Request failed (${res.status})`;
        return;
      }
      const email = operatorEmailInput.trim().toLowerCase();
      operatorEmailInput = "";
      if (!operatorEmails.some((r) => r.email === email)) {
        operatorEmails = [{ email, createdAtMs: Date.now(), createdByUserId: null, note: null }, ...operatorEmails];
      }
    } catch {
      errorMessage = "Network error. Try again.";
    } finally {
      operatorSaving = false;
    }
  }

  async function removeOperatorEmail(email: string) {
    errorMessage = null;
    operatorSaving = true;
    try {
      const res = await fetch(`${ADMIN_BASE}/api/operator-emails`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        errorMessage = payload.message ?? payload.error ?? `Request failed (${res.status})`;
        return;
      }
      operatorEmails = operatorEmails.filter((r) => r.email !== email);
    } catch {
      errorMessage = "Network error. Try again.";
    } finally {
      operatorSaving = false;
    }
  }

  async function toggleDbOperator(row: AdminUserListRow, next: boolean) {
    errorMessage = null;
    savingId = row.id;
    try {
      const res = await fetch(`${ADMIN_BASE}/api/users/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceOwner: next }),
        credentials: "same-origin",
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        errorMessage = payload.message ?? payload.error ?? `Request failed (${res.status})`;
        checkboxEpoch = { ...checkboxEpoch, [row.id]: (checkboxEpoch[row.id] ?? 0) + 1 };
        return;
      }
      rows = rows.map((r) =>
        r.id === row.id
          ? {
              ...r,
              dbServiceOwner: next,
              isServiceOwner: next || r.operatorViaEnvUserId || r.serviceOwnerImmutable,
            }
          : r
      );
    } catch {
      errorMessage = "Network error. Try again.";
      checkboxEpoch = { ...checkboxEpoch, [row.id]: (checkboxEpoch[row.id] ?? 0) + 1 };
    } finally {
      savingId = null;
    }
  }
</script>

<h1 class="page-title">User management</h1>
<p class="page-desc">
  Service owners can grant or revoke <strong>dashboard operator</strong> access (stored in <code>service_admins</code>).
  Primary operator emails from configuration always retain operator access. Add operator emails below before
  someone signs in for the first time.
</p>

<section class="operator-emails" aria-labelledby="operator-emails-heading">
  <h2 id="operator-emails-heading" class="section-title">Operator emails</h2>
  <p class="section-desc">These emails receive administrator access on their next sign-in (without editing env vars).</p>
  <form class="operator-form" on:submit|preventDefault={addOperatorEmail}>
    <label class="operator-label">
      <span class="sr-only">Email address</span>
      <input
        type="email"
        name="email"
        autocomplete="email"
        placeholder="operator@example.com"
        bind:value={operatorEmailInput}
        required
        disabled={operatorSaving}
      />
    </label>
    <button type="submit" class="btn-add" disabled={operatorSaving || !operatorEmailInput.trim()}>
      Add operator email
    </button>
  </form>
  {#if operatorEmails.length > 0}
    <ul class="operator-list">
      {#each operatorEmails as row}
        <li>
          <span>{row.email}</span>
          <button
            type="button"
            class="btn-remove"
            disabled={operatorSaving}
            on:click={() => removeOperatorEmail(row.email)}
          >
            Remove
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

{#if data.adminUsersError}
  <p class="banner-error" role="alert">{data.adminUsersError}</p>
{/if}

{#if errorMessage}
  <p class="banner-error" role="alert">{errorMessage}</p>
{/if}

<div class="table-wrap">
  <table class="users-table" aria-label="Registered users">
    <thead>
      <tr>
        <th scope="col">Email</th>
        <th scope="col">Name</th>
        <th scope="col">Access</th>
        <th scope="col">Operator (database)</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row}
        <tr>
          <td>{row.email || "—"}</td>
          <td>{row.name || "—"}</td>
          <td>
            {#if row.isServiceOwner}
              <span class="badge badge-owner">Service owner</span>
              {#if row.serviceOwnerImmutable}
                <span class="hint">allowlist</span>
              {:else if row.operatorViaEnvUserId && !row.dbServiceOwner}
                <span class="hint">env user id</span>
              {/if}
            {:else}
              <span class="badge">End user</span>
            {/if}
          </td>
          <td>
            {#if row.serviceOwnerImmutable}
              <span class="hint">Always on (email allowlist)</span>
            {:else}
              <label class="toggle">
                {#key `${row.id}-${row.dbServiceOwner}-${checkboxEpoch[row.id] ?? 0}`}
                  <input
                    type="checkbox"
                    checked={row.dbServiceOwner}
                    disabled={savingId === row.id}
                    aria-busy={savingId === row.id}
                    on:change={(e) => {
                      const el = e.currentTarget;
                      void toggleDbOperator(row, el.checked);
                    }}
                  />
                {/key}
                <span class="sr-only">Database operator for {row.email || row.id}</span>
              </label>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<p class="page-foot">
  <a class="link" href={DASHBOARD_BASE + "/settings"}>Profile &amp; settings</a>
</p>

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
    max-width: 42rem;
  }
  .section-title {
    font-size: var(--text-lg);
    margin: 0 0 var(--space-2);
  }
  .section-desc {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
  }
  .operator-emails {
    margin-bottom: var(--space-6);
    padding: var(--space-4);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface);
  }
  .operator-form {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .operator-label input {
    min-height: 44px;
    min-width: min(100%, 18rem);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
  }
  .btn-add,
  .btn-remove {
    min-height: 44px;
    padding: 0 var(--space-3);
    font-size: var(--text-sm);
    border-radius: var(--radius-sm);
    border: 1px solid var(--rm-border);
    cursor: pointer;
    background: var(--rm-bg);
  }
  .btn-add:disabled,
  .btn-remove:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .operator-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .operator-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    font-size: var(--text-sm);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
  .banner-error {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--rm-danger, #b91c1c) 12%, transparent);
    color: var(--rm-text);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
  }
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface);
  }
  .users-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .users-table th,
  .users-table td {
    padding: var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--rm-border);
  }
  .users-table th {
    font-weight: 600;
    color: var(--rm-dim);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--rm-bg-elevated, var(--rm-surface));
    border: 1px solid var(--rm-border);
    font-size: var(--text-xs);
  }
  .badge-owner {
    border-color: color-mix(in srgb, var(--rm-accent, #2563eb) 40%, var(--rm-border));
    color: var(--rm-text);
  }
  .hint {
    display: block;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    margin-top: var(--space-1);
  }
  .toggle input {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
  .page-foot {
    margin-top: var(--space-6);
    font-size: var(--text-sm);
  }
  .link {
    color: var(--rm-accent, #2563eb);
    text-decoration: underline;
  }
</style>

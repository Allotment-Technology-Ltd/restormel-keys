<script lang="ts">
  import { ADMIN_BASE, DASHBOARD_BASE } from "$lib/dashboard-base";
  import type { AdminUserListRow } from "$lib/admin-user-list";

  export let data: { adminUsers: AdminUserListRow[]; adminUsersError: string | null };

  let rows = data.adminUsers;
  let savingId: string | null = null;
  let errorMessage: string | null = null;
  /** Bumps to remount checkboxes after a failed toggle (browser flips before we respond). */
  let checkboxEpoch: Record<string, number> = {};

  $: rows = data.adminUsers;

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
  Primary operator emails from configuration always retain operator access.
</p>

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

<script lang="ts">
  import { ADMIN_BASE } from "$lib/dashboard-base";
  import type { FoundersAccessRow } from "$lib/server/founders-access";
  import type { FoundersSendStatusBrief } from "./+page.server";

  export let data: {
    foundersAccess: FoundersAccessRow[];
    foundersLoadError: string | null;
    sendStatus: Record<string, FoundersSendStatusBrief>;
  };

  // Last transactional email outcome for a row (approval / apply-confirmation), surfaced so the
  // operator can SEE whether the approval email actually delivered — the "no way of knowing" gap.
  function sendLabel(email: string): { text: string; kind: "ok" | "fail" | "none" } {
    const s = data.sendStatus?.[email];
    if (!s) return { text: "—", kind: "none" };
    const verb =
      s.category === "founders_approved"
        ? "Approval email"
        : s.category === "founders_rejected"
          ? "Rejection email"
          : s.category === "founders_deleted"
            ? "Removal email"
            : "Confirmation email";
    if (s.success) {
      return { text: `${verb}: sent ✓ ${new Date(s.sentAtMs).toLocaleString()}`, kind: "ok" };
    }
    return { text: `${verb}: FAILED — ${s.errorReason ?? "unknown"}`, kind: "fail" };
  }

  let rows = data.foundersAccess;
  let savingEmail: string | null = null;
  let errorMessage: string | null = null;
  // Per-row opt-in: notify the applicant when their request is deleted. Default OFF — deleting
  // test/spam entries shouldn't email anyone; the operator ticks this for a genuine person.
  let notifyOnDelete: Record<string, boolean> = {};

  $: rows = data.foundersAccess;
  $: pendingCount = rows.filter((r) => r.status === "pending").length;

  function formatWhen(ms: number | null): string {
    if (!ms) return "—";
    return new Date(ms).toLocaleString();
  }

  async function setStatus(row: FoundersAccessRow, status: "approved" | "rejected") {
    errorMessage = null;
    savingEmail = row.email;
    try {
      const res = await fetch(
        `${ADMIN_BASE}/api/founders/${encodeURIComponent(row.email)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
          credentials: "same-origin",
        }
      );
      const payload = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        errorMessage = payload.message ?? payload.error ?? `Request failed (${res.status})`;
        return;
      }
      rows = rows.map((r) =>
        r.email === row.email ? { ...r, status, reviewedAtMs: Date.now() } : r
      );
    } catch {
      errorMessage = "Network error. Try again.";
    } finally {
      savingEmail = null;
    }
  }

  async function deleteRow(row: FoundersAccessRow) {
    const notify = notifyOnDelete[row.email] === true;
    const confirmMsg = notify
      ? `Delete the Founders Circle request for ${row.email} AND email them that it was removed? This cannot be undone.`
      : `Delete the Founders Circle request for ${row.email}? This cannot be undone. (No email will be sent.)`;
    if (!window.confirm(confirmMsg)) return;

    errorMessage = null;
    savingEmail = row.email;
    try {
      const qs = notify ? "?notify=1" : "";
      const res = await fetch(
        `${ADMIN_BASE}/api/founders/${encodeURIComponent(row.email)}${qs}`,
        {
          method: "DELETE",
          credentials: "same-origin",
        }
      );
      const payload = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        errorMessage = payload.message ?? payload.error ?? `Request failed (${res.status})`;
        return;
      }
      // Optimistically drop the row.
      rows = rows.filter((r) => r.email !== row.email);
    } catch {
      errorMessage = "Network error. Try again.";
    } finally {
      savingEmail = null;
    }
  }
</script>

<h1 class="page-title">Founders Circle access</h1>
<p class="page-desc">
  Approve or reject dashboard access for early-access applicants. Approved emails can sign in; pending
  users are held on <a href="/founders/pending">/founders/pending</a>.
  {#if pendingCount > 0}
    <strong>{pendingCount} pending</strong>.
  {/if}
</p>

{#if data.foundersLoadError}
  <p class="banner-error" role="alert">{data.foundersLoadError}</p>
{/if}

{#if errorMessage}
  <p class="banner-error" role="alert">{errorMessage}</p>
{/if}

<div class="table-wrap">
  <table class="access-table" aria-label="Founders Circle access requests">
    <thead>
      <tr>
        <th scope="col">Email</th>
        <th scope="col">Name</th>
        <th scope="col">Status</th>
        <th scope="col">Submitted</th>
        <th scope="col">Email</th>
        <th scope="col">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#if rows.length === 0}
        <tr>
          <td colspan="6" class="empty">No applications yet.</td>
        </tr>
      {:else}
        {#each rows as row}
          <tr>
            <td>{row.email}</td>
            <td>{row.applicantName || "—"}</td>
            <td>
              <span class="badge" class:badge-approved={row.status === "approved"} class:badge-pending={row.status === "pending"} class:badge-rejected={row.status === "rejected"}>
                {row.status}
              </span>
            </td>
            <td>{formatWhen(row.submittedAtMs)}</td>
            <td>
              {#key data.sendStatus}
                {@const sl = sendLabel(row.email)}
                <span
                  class="send-status"
                  class:send-ok={sl.kind === "ok"}
                  class:send-fail={sl.kind === "fail"}
                  class:send-none={sl.kind === "none"}
                  title={sl.text}
                >
                  {sl.text}
                </span>
              {/key}
            </td>
            <td class="actions">
              {#if row.status !== "approved"}
                <button
                  type="button"
                  class="btn-action btn-approve"
                  disabled={savingEmail === row.email}
                  on:click={() => setStatus(row, "approved")}
                >
                  Approve
                </button>
              {/if}
              {#if row.status !== "rejected"}
                <button
                  type="button"
                  class="btn-action btn-reject"
                  disabled={savingEmail === row.email}
                  on:click={() => setStatus(row, "rejected")}
                >
                  Reject
                </button>
              {/if}
              <span class="delete-group">
                <button
                  type="button"
                  class="btn-action btn-delete"
                  disabled={savingEmail === row.email}
                  on:click={() => deleteRow(row)}
                >
                  Delete
                </button>
                <label class="notify-toggle" title="Email the applicant that their request was removed (default: silent)">
                  <input
                    type="checkbox"
                    bind:checked={notifyOnDelete[row.email]}
                    disabled={savingEmail === row.email}
                  />
                  email applicant
                </label>
              </span>
            </td>
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>

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
  .page-desc a {
    color: var(--rm-accent, #2563eb);
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
  .access-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .access-table th,
  .access-table td {
    padding: var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--rm-border);
    vertical-align: middle;
  }
  .access-table th {
    font-weight: 600;
    color: var(--rm-dim);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .empty {
    color: var(--rm-dim);
    text-align: center;
  }
  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--rm-border);
    font-size: var(--text-xs);
    text-transform: capitalize;
  }
  .badge-pending {
    background: color-mix(in srgb, var(--brut-neon, #ffde4d) 35%, var(--rm-surface));
  }
  .badge-approved {
    background: color-mix(in srgb, #16a34a 15%, var(--rm-surface));
  }
  .badge-rejected {
    background: color-mix(in srgb, var(--rm-danger, #b91c1c) 12%, var(--rm-surface));
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .btn-action {
    min-height: 36px;
    padding: 0 var(--space-3);
    font-size: var(--text-xs);
    font-weight: 600;
    border-radius: var(--radius-sm);
    border: 1px solid var(--rm-border);
    cursor: pointer;
    background: var(--rm-surface);
  }
  .btn-action:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-approve {
    border-color: color-mix(in srgb, #16a34a 40%, var(--rm-border));
  }
  .btn-reject {
    border-color: color-mix(in srgb, var(--rm-danger, #b91c1c) 35%, var(--rm-border));
  }
  .delete-group {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .btn-delete {
    border-color: color-mix(in srgb, var(--rm-danger, #b91c1c) 60%, var(--rm-border));
    background: color-mix(in srgb, var(--rm-danger, #b91c1c) 8%, var(--rm-surface));
  }
  .notify-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: var(--text-xs);
    color: var(--rm-dim);
    cursor: pointer;
    white-space: nowrap;
  }
  .notify-toggle input {
    cursor: pointer;
  }
  .send-status {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
    display: inline-block;
    max-width: 22rem;
  }
  .send-ok {
    color: #166534;
  }
  .send-fail {
    color: var(--rm-danger, #b91c1c);
    font-weight: 600;
  }
  .send-none {
    color: var(--rm-dim);
  }
</style>

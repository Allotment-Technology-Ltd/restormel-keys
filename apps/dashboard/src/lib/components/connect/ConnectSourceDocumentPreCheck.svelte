<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { ConnectSourceProvenance } from "@restormel/contracts/connect";

  export let apiBase: string;
  /** `url` — page URL form; `upload` — parent supplies file payload via runUploadPreview */
  export let mode: "url" | "upload" = "url";
  export let url = "";
  export let disabled = false;

  const dispatch = createEventDispatcher<{
    imported: { id: string; name: string; status: string; chunk_count?: number };
    cleared: void;
  }>();

  type PreviewResult = {
    suggested_name: string;
    mime?: string;
    provenance: ConnectSourceProvenance;
    warnings?: string[];
  };

  let previewing = false;
  let importing = false;
  let message: string | null = null;
  let messageError = false;
  let preview: PreviewResult | null = null;

  let displayName = "";
  let canonicalUrl = "";
  let authorsText = "";
  let description = "";
  let siteName = "";
  let pendingUpload: {
    content: string;
    content_encoding: "utf8" | "base64";
    mime: string;
    name: string;
  } | null = null;

  function authorsFromText(): string[] {
    return authorsText
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  function buildProvenance(): ConnectSourceProvenance {
    const base = preview?.provenance ?? {};
    return {
      ...base,
      ...(displayName.trim() ? { title: displayName.trim() } : {}),
      ...(canonicalUrl.trim() ? { canonical_url: canonicalUrl.trim() } : {}),
      ...(mode === "url" && url.trim() ? { url: url.trim() } : {}),
      ...(authorsFromText().length ? { authors: authorsFromText() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(siteName.trim() ? { site_name: siteName.trim() } : {}),
    };
  }

  function applyPreviewToFields(p: PreviewResult) {
    preview = p;
    displayName = p.suggested_name;
    canonicalUrl = p.provenance.canonical_url ?? p.provenance.url ?? (mode === "url" ? url.trim() : "");
    authorsText = (p.provenance.authors ?? []).join(", ");
    description = p.provenance.description ?? "";
    siteName = p.provenance.site_name ?? "";
  }

  export async function runUploadPreview(payload: {
    name: string;
    mime: string;
    content: string;
    content_encoding: "utf8" | "base64";
  }) {
    pendingUpload = payload;
    previewing = true;
    message = null;
    messageError = false;
    preview = null;
    try {
      const res = await fetch(`${apiBase}/sources/documents/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "upload", ...payload }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        messageError = true;
        message = d.message ?? `Preview failed (HTTP ${res.status}).`;
        return;
      }
      applyPreviewToFields(d as PreviewResult);
      message = "Review metadata below, then import.";
    } catch {
      messageError = true;
      message = "Network error during preview.";
    } finally {
      previewing = false;
    }
  }

  async function runUrlPreview() {
    const trimmed = url.trim();
    if (!trimmed) return;
    previewing = true;
    message = null;
    messageError = false;
    preview = null;
    try {
      const res = await fetch(`${apiBase}/sources/documents/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "url", url: trimmed }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        messageError = true;
        message = d.message ?? `Preview failed (HTTP ${res.status}).`;
        return;
      }
      applyPreviewToFields(d as PreviewResult);
      message = "Review provenance below, then import to parse and chunk the page.";
    } catch {
      messageError = true;
      message = "Network error during preview.";
    } finally {
      previewing = false;
    }
  }

  export async function confirmImport(uploadPayload?: {
    content: string;
    content_encoding: "utf8" | "base64";
    mime: string;
    name: string;
  }) {
    if (!preview && mode === "url") {
      await runUrlPreview();
      if (!preview) return;
    }
    importing = true;
    message = null;
    messageError = false;
    try {
      const provenance = buildProvenance();
      const body =
        mode === "url"
          ? {
              kind: "url" as const,
              url: url.trim(),
              name: displayName.trim() || undefined,
              provenance,
            }
          : {
              kind: "upload" as const,
              ...uploadPayload!,
              name: displayName.trim() || uploadPayload?.name,
              provenance,
            };
      const res = await fetch(`${apiBase}/sources/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        messageError = true;
        message = d.message ?? `Import failed (HTTP ${res.status}).`;
        return;
      }
      const doc = d.document;
      if (doc?.status === "failed") {
        messageError = true;
        message = doc.error ?? "Could not parse this source.";
        return;
      }
      message = `Imported “${doc?.name ?? displayName}” (${doc?.chunk_count ?? 0} chunk(s)).`;
      preview = null;
      dispatch("imported", doc);
      dispatch("cleared");
    } catch {
      messageError = true;
      message = "Network error during import.";
    } finally {
      importing = false;
    }
  }

  function clearPreview() {
    preview = null;
    pendingUpload = null;
    message = null;
    dispatch("cleared");
  }
</script>

{#if mode === "url"}
  <div class="precheck-actions">
    <button
      type="button"
      class="btn btn-secondary"
      disabled={disabled || previewing || !url.trim()}
      on:click={runUrlPreview}
    >
      {previewing ? "Checking…" : "Preview metadata"}
    </button>
  </div>
{/if}

{#if preview}
  <section class="precheck-panel" aria-labelledby="precheck-heading">
    <h4 id="precheck-heading" class="precheck-title">Source preview</h4>
    <p class="precheck-lede">Adjust fields before full parse and ingest. These populate graph source provenance.</p>
    {#if preview.warnings?.length}
      <ul class="precheck-warnings">
        {#each preview.warnings as w}
          <li>{w}</li>
        {/each}
      </ul>
    {/if}
    <div class="precheck-grid">
      <label class="field">
        <span class="field-label">Title / display name</span>
        <input class="input" type="text" bind:value={displayName} disabled={importing} />
      </label>
      <label class="field">
        <span class="field-label">Canonical URL</span>
        <input class="input" type="url" bind:value={canonicalUrl} disabled={importing} placeholder="https://…" />
      </label>
      <label class="field">
        <span class="field-label">Authors</span>
        <input
          class="input"
          type="text"
          bind:value={authorsText}
          disabled={importing}
          placeholder="Ada Lovelace, Charles Babbage"
        />
      </label>
      <label class="field">
        <span class="field-label">Publisher / site</span>
        <input class="input" type="text" bind:value={siteName} disabled={importing} />
      </label>
      <label class="field precheck-span">
        <span class="field-label">Description</span>
        <textarea class="input" rows="3" bind:value={description} disabled={importing} />
      </label>
    </div>
    <div class="precheck-actions">
      <button
        type="button"
        class="btn btn-primary"
        disabled={importing || !displayName.trim() || (mode === "upload" && !pendingUpload)}
        on:click={() => confirmImport(mode === "upload" ? pendingUpload ?? undefined : undefined)}
      >
        {importing ? "Importing…" : mode === "url" ? "Import page" : "Import document"}
      </button>
      <button type="button" class="btn btn-secondary" disabled={importing} on:click={clearPreview}>Clear preview</button>
    </div>
  </section>
{/if}

{#if message}
  <p class:err={messageError} class:notice={!messageError} role="status">{message}</p>
{/if}

<style>
  .precheck-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .precheck-panel {
    margin-top: var(--space-4);
    padding: var(--space-4);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-md);
    background: var(--rm-surface);
  }
  .precheck-title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-base);
    font-weight: 600;
  }
  .precheck-lede {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .precheck-warnings {
    margin: 0 0 var(--space-3);
    padding-left: var(--space-4);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .precheck-grid {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: 1fr;
  }
  @media (min-width: 40rem) {
    .precheck-grid {
      grid-template-columns: 1fr 1fr;
    }
    .precheck-span {
      grid-column: 1 / -1;
    }
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .field-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--rm-dim);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .input {
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-family: inherit;
  }
  textarea.input {
    min-height: 5rem;
    resize: vertical;
  }
  .err {
    color: var(--rm-text);
    font-size: var(--text-sm);
    padding: var(--space-2);
    background: color-mix(in srgb, var(--rm-danger, #b91c1c) 12%, transparent);
    border-radius: var(--radius-sm);
  }
  .notice {
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
</style>

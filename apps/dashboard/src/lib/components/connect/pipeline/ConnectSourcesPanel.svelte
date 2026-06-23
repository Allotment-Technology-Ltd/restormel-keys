<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import {
    CONNECT_PIPELINE_API,
    withReturnTo,
    type DocRef,
    type SourceConnection,
    type SourceDocument,
    type PipelineWizardStepId,
  } from "$lib/connect/pipeline-config";
  import { formatDocMeta, formatSourceKind, pipelineStatusClass } from "$lib/connect/pipeline-utils";
  import ConnectSourceDocumentPreCheck from "$lib/components/connect/ConnectSourceDocumentPreCheck.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";

  export let embedded = false;
  export let wizardStep: PipelineWizardStepId | null = null;

  const dispatch = createEventDispatcher<{ updated: void }>();
  const API_BASE = CONNECT_PIPELINE_API;

  function notifyUpdated() {
    dispatch("updated");
  }

  let loading = true;
  let loadError: string | null = null;
  let loadErrorAuth = false;

  let connections: SourceConnection[] = [];
  let connNotice: string | null = null;
  let connProviders = { s3: true, google_drive: false, sharepoint: false };
  let connBanner: { ok: boolean; text: string } | null = null;
  let showS3Form = false;
  let s3 = {
    label: "",
    region: "us-east-1",
    bucket: "",
    prefix: "",
    endpoint: "",
    access_key_id: "",
    secret_access_key: "",
  };
  let savingS3 = false;
  let s3Msg: string | null = null;
  let s3Error = false;
  let browseConnId: string | null = null;
  let browseRefs: DocRef[] = [];
  let browseSel: Record<string, boolean> = {};
  let browsing = false;
  let browseMsg: string | null = null;
  /** Distinguishes a real failure from an empty browse result ("No documents found."). */
  let browseError = false;
  let importing = false;
  let crawl = { root_url: "", max_pages: 10, same_host_only: true, use_sitemap: true };
  let crawling = false;
  let crawlMsg: string | null = null;
  let crawlError = false;

  let pageUrl = "";
  let pageUrlMsg: string | null = null;
  let pageUrlError = false;
  let urlPreCheck: ConnectSourceDocumentPreCheck;

  let loadingStarter = false;
  let starterMsg: string | null = null;
  let starterError = false;
  let starterLoaded = false;

  let documents: SourceDocument[] = [];
  let loadingDocuments = false;
  let documentsError: string | null = null;
  let documentsNotice: string | null = null;
  let documentsNoticeError = false;

  let selectionExplicit = false;
  let selectedDocIds: Record<string, boolean> = {};
  let savingSelection = false;

  $: parsedDocuments = documents.filter((d) => d.status === "parsed");
  $: selectedDocCount = parsedDocuments.filter((d) => selectedDocIds[d.id]).length;
  $: allParsedSelected = parsedDocuments.length > 0 && selectedDocCount === parsedDocuments.length;
  const INTEGRATIONS_HREF = withReturnTo(DASHBOARD_BASE + "/integrations", {
    kind: "pipeline-setup",
    step: wizardStep ?? "sources",
  });

  function syncSelectionUi() {
    const next: Record<string, boolean> = { ...selectedDocIds };
    for (const doc of parsedDocuments) {
      if (!(doc.id in next)) {
        next[doc.id] = !selectionExplicit;
      }
    }
    for (const id of Object.keys(next)) {
      if (!parsedDocuments.some((d) => d.id === id)) delete next[id];
    }
    selectedDocIds = next;
  }

  async function loadSelection() {
    try {
      const res = await fetch(API_BASE + "/sources/documents/selection");
      if (!res.ok) return;
      const d = await res.json();
      selectionExplicit = d.document_ids !== null;
      const effective = new Set<string>((d.effective_document_ids ?? []) as string[]);
      const next: Record<string, boolean> = {};
      for (const doc of parsedDocuments) {
        next[doc.id] = selectionExplicit ? effective.has(doc.id) : true;
      }
      selectedDocIds = next;
    } catch {
      // non-fatal
    }
  }

  async function persistSelection() {
    savingSelection = true;
    try {
      const ids = parsedDocuments.filter((d) => selectedDocIds[d.id]).map((d) => d.id);
      const payload =
        ids.length === 0
          ? { document_ids: [] as string[] }
          : ids.length === parsedDocuments.length
            ? { document_ids: null }
            : { document_ids: ids };
      const res = await fetch(API_BASE + "/sources/documents/selection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        await resyncSelectionAfterFailure();
        return;
      }
      const d = await res.json();
      selectionExplicit = d.document_ids !== null;
      documentsNotice = null;
      documentsNoticeError = false;
      notifyUpdated();
    } catch {
      await resyncSelectionAfterFailure();
    } finally {
      savingSelection = false;
    }
  }

  /** A failed save must not leave the checkboxes claiming a selection the server never got. */
  async function resyncSelectionAfterFailure() {
    documentsNotice = "Could not save your selection — it has been reset to the last saved state. Try again.";
    documentsNoticeError = true;
    await loadSelection();
    syncSelectionUi();
  }

  async function setDocSelected(docId: string, checked: boolean) {
    selectedDocIds = { ...selectedDocIds, [docId]: checked };
    await persistSelection();
  }

  async function selectAllParsed() {
    selectedDocIds = Object.fromEntries(parsedDocuments.map((d) => [d.id, true]));
    await persistSelection();
  }

  async function clearDocSelection() {
    selectedDocIds = Object.fromEntries(parsedDocuments.map((d) => [d.id, false]));
    await persistSelection();
  }

  async function includeImportedDocs(imported: { id?: string; status?: string }[]) {
    const ids = imported.filter((x) => x.status === "parsed" && x.id).map((x) => x.id!);
    if (ids.length === 0) return;
    selectionExplicit = true;
    selectedDocIds = { ...selectedDocIds, ...Object.fromEntries(ids.map((id) => [id, true])) };
    await persistSelection();
  }

  async function loadDocuments() {
    loadingDocuments = true;
    documentsError = null;
    try {
      const res = await fetch(API_BASE + "/sources/documents");
      if (res.status === 401) {
        documentsError = "Sign in to view documents.";
        documents = [];
        return;
      }
      if (res.ok) {
        const d = await res.json();
        documents = (d.documents ?? []).sort(
          (a: SourceDocument, b: SourceDocument) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        starterLoaded = documents.some((doc) => doc.name.startsWith("Starter:"));
        await loadSelection();
        syncSelectionUi();
      } else {
        documentsError = "Could not load documents.";
      }
    } catch {
      documentsError = "Could not load documents.";
    } finally {
      loadingDocuments = false;
    }
  }

  async function loadConnections() {
    loading = true;
    loadError = null;
    loadErrorAuth = false;
    try {
      const res = await fetch(API_BASE + "/sources/connections");
      if (res.status === 401) {
        loadError = "Sign in to manage sources.";
        loadErrorAuth = true;
        return;
      }
      if (res.ok) {
        const d = await res.json();
        connections = d.connections ?? [];
        connProviders = d.providers ?? connProviders;
      }
    } catch {
      loadError = "Could not load source connections.";
    } finally {
      loading = false;
    }
  }

  function readConnectorBanner() {
    if (typeof location === "undefined") return;
    const q = new URLSearchParams(location.search);
    const connected = q.get("connector_connected");
    const error = q.get("connector_error");
    if (connected) connBanner = { ok: true, text: `Connected ${connected.replace("_", " ")}.` };
    else if (error) connBanner = { ok: false, text: `Connector error: ${error.replace(/_/g, " ")}.` };
  }

  async function addS3() {
    savingS3 = true;
    s3Msg = null;
    s3Error = false;
    try {
      const res = await fetch(API_BASE + "/sources/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "s3",
          ...(s3.label.trim() ? { label: s3.label.trim() } : {}),
          region: s3.region.trim(),
          bucket: s3.bucket.trim(),
          ...(s3.prefix.trim() ? { prefix: s3.prefix.trim() } : {}),
          ...(s3.endpoint.trim() ? { endpoint: s3.endpoint.trim() } : {}),
          access_key_id: s3.access_key_id.trim(),
          secret_access_key: s3.secret_access_key,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        s3Error = true;
        s3Msg = d.message ?? `Could not add (HTTP ${res.status}).`;
        return;
      }
      s3Msg = "S3 connection saved.";
      s3 = {
        label: "",
        region: "us-east-1",
        bucket: "",
        prefix: "",
        endpoint: "",
        access_key_id: "",
        secret_access_key: "",
      };
      showS3Form = false;
      await loadConnections();
      await loadDocuments();
      notifyUpdated();
    } catch {
      s3Error = true;
      s3Msg = "Network error while saving.";
    } finally {
      savingS3 = false;
    }
  }

  async function deleteConnection(id: string) {
    if (!confirm("Remove this connection?")) return;
    connNotice = null;
    try {
      const res = await fetch(API_BASE + "/sources/connections/" + id, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        connNotice = d.message ?? "Could not remove the connection. Try again.";
        return;
      }
      if (browseConnId === id) {
        browseConnId = null;
        browseRefs = [];
      }
      await loadConnections();
      await loadDocuments();
      notifyUpdated();
    } catch {
      connNotice = "Network error while removing the connection. Try again.";
    }
  }

  async function deleteDocument(id: string, name: string) {
    if (!confirm(`Remove "${name}" from your workspace?`)) return;
    documentsNotice = null;
    documentsNoticeError = false;
    try {
      const res = await fetch(`${API_BASE}/sources/documents/${id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        documentsNotice = d.message ?? "Could not remove document.";
        documentsNoticeError = true;
        return;
      }
      documentsNotice = `"${name}" removed.`;
      await loadDocuments();
      notifyUpdated();
    } catch {
      documentsNotice = "Network error while removing document.";
      documentsNoticeError = true;
    }
  }

  async function browse(id: string) {
    browseConnId = id;
    browsing = true;
    browseMsg = null;
    browseError = false;
    browseRefs = [];
    browseSel = {};
    try {
      const res = await fetch(API_BASE + "/sources/connections/" + id + "/browse");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        browseError = true;
        browseMsg = d.message ?? `Could not browse (HTTP ${res.status}).`;
        return;
      }
      browseRefs = d.refs ?? [];
      if (browseRefs.length === 0) {
        browseMsg = "No documents found in this connection — check the bucket and prefix.";
      }
    } catch {
      browseError = true;
      browseMsg = "Network error while browsing.";
    } finally {
      browsing = false;
    }
  }

  async function importSelected() {
    if (!browseConnId) return;
    const refs = browseRefs.filter((r) => browseSel[r.id]);
    if (refs.length === 0) {
      browseError = true;
      browseMsg = "Select at least one document to import.";
      return;
    }
    importing = true;
    browseMsg = null;
    browseError = false;
    try {
      const res = await fetch(API_BASE + "/sources/connections/" + browseConnId + "/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refs }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        browseError = true;
        browseMsg = d.message ?? `Import failed (HTTP ${res.status}).`;
        return;
      }
      const docs = d.documents ?? [];
      const failed = docs.filter((x: { status: string }) => x.status === "failed").length;
      browseError = failed > 0;
      browseMsg = `Imported ${docs.length - failed} document(s)${failed ? `, ${failed} failed` : ""}.`;
      browseSel = {};
      await loadDocuments();
      await includeImportedDocs(docs);
      notifyUpdated();
    } catch {
      browseError = true;
      browseMsg = "Network error while importing.";
    } finally {
      importing = false;
    }
  }

  async function onUrlDocumentImported(
    event: CustomEvent<{ id: string; name: string; status: string; chunk_count?: number }>,
  ) {
    const doc = event.detail;
    pageUrlError = false;
    pageUrlMsg =
      doc.status === "failed"
        ? "Could not parse this page."
        : `Imported “${doc.name}” (${doc.chunk_count ?? 0} chunk(s)).`;
    pageUrl = "";
    await loadDocuments();
    if (doc.id && doc.status === "parsed") await includeImportedDocs([doc]);
    notifyUpdated();
  }

  async function runCrawl() {
    crawling = true;
    crawlMsg = null;
    crawlError = false;
    try {
      const res = await fetch(API_BASE + "/sources/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(crawl),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        crawlError = true;
        crawlMsg = d.message ?? `Crawl failed (HTTP ${res.status}).`;
        return;
      }
      const docs = d.documents ?? [];
      const ok = docs.filter((x: { status: string }) => x.status === "parsed").length;
      crawlMsg = `Discovered ${d.discovered} page(s); imported ${ok}.`;
      await loadDocuments();
      await includeImportedDocs(docs);
      notifyUpdated();
    } catch {
      crawlError = true;
      crawlMsg = "Network error while crawling.";
    } finally {
      crawling = false;
    }
  }

  async function loadStarterCorpus() {
    loadingStarter = true;
    starterMsg = null;
    starterError = false;
    try {
      const res = await fetch(API_BASE + "/sources/starter-corpus", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        starterError = true;
        starterMsg = d.message ?? `Could not load starter corpus (HTTP ${res.status}).`;
        return;
      }
      starterLoaded = true;
      const count = (d.documents ?? []).length;
      starterMsg = d.already_loaded
        ? `Starter corpus already loaded (${count} document(s)).`
        : `Loaded ${count} starter document(s) for your first graph.`;
      await loadDocuments();
      await includeImportedDocs(d.documents ?? []);
      notifyUpdated();
    } catch {
      starterError = true;
      starterMsg = "Network error while loading starter corpus.";
    } finally {
      loadingStarter = false;
    }
  }

  onMount(() => {
    readConnectorBanner();
    loadConnections();
    loadDocuments();
  });
</script>

{#if loading}
  <p class="muted" role="status">Loading sources…</p>
{:else if loadError}
  <BrutalErrorBanner title="Sources" message={loadError} />
  <div class="actions">
    {#if loadErrorAuth}
      <a class="btn btn-primary btn-sm" href="{DASHBOARD_BASE}/login">Sign in</a>
    {:else}
      <button type="button" class="btn btn-primary btn-sm" on:click={loadConnections}>Try again</button>
    {/if}
  </div>
{:else}
  <div class="wizard-panel" class:card={!embedded}>
    {#if !embedded}
      <h2 class="h2">Sources &amp; connectors</h2>
      <p class="card-desc">
        Import from a web page, S3, Google Drive, SharePoint, or a multi-page crawl — documents accumulate in
        your workspace. Select which parsed documents to include in your next ingest run.
      </p>
    {/if}
    {#if connBanner}
      <p class:err={!connBanner.ok} class:notice={connBanner.ok} role={connBanner.ok ? "status" : "alert"}>{connBanner.text}</p>
    {/if}

    <div class="starter-corpus">
      <h3 class="preview-sub">First graph starter corpus</h3>
      {#if starterMsg}
        <p class:err={starterError} class:notice={!starterError} role={starterError ? "alert" : "status"}>{starterMsg}</p>
      {/if}
      <div class="actions">
        <button
          type="button"
          class="btn btn-primary"
          disabled={loadingStarter}
          on:click={loadStarterCorpus}
        >
          {loadingStarter ? "Loading…" : starterLoaded ? "Reload starter documents" : "Load 3 starter documents"}
        </button>
      </div>
      <p class="field-hint">Restormel-authored CC0 passages — safe to use for first runs and demos.</p>
    </div>

    <section class="doc-inventory" aria-labelledby="doc-inventory-heading">
      <div class="doc-inventory-head">
        <h3 id="doc-inventory-heading" class="preview-sub">Your documents</h3>
        <span class="doc-inventory-count">
          {selectedDocCount} selected for next run
          {#if parsedDocuments.length > 0}
            · {parsedDocuments.length} parsed
          {/if}
          {#if documents.length > 0}
            · {documents.length} total
          {/if}
        </span>
      </div>
      {#if allParsedSelected}
        <p class="sources-select-banner" role="status">
          All documents selected — deselect any you want to exclude from this run.
        </p>
      {/if}
      {#if parsedDocuments.length > 0}
        <div class="doc-selection-actions">
          <button type="button" class="btn btn-inline btn-outline" disabled={savingSelection} on:click={selectAllParsed}>
            Select all parsed
          </button>
          <button type="button" class="btn btn-inline btn-outline" disabled={savingSelection} on:click={clearDocSelection}>
            Clear selection
          </button>
        </div>
      {/if}
      {#if loadingDocuments}
        <p class="muted" role="status">Loading documents…</p>
      {:else if documentsError}
        <p class="err" role="alert">{documentsError}</p>
      {:else}
        {#if documentsNotice}
          <p class:err={documentsNoticeError} class:notice={!documentsNoticeError} role={documentsNoticeError ? "alert" : "status"}>{documentsNotice}</p>
        {/if}
        {#if documents.length === 0}
          <div class="sources-empty" role="status">
            <span class="sources-empty-icon" aria-hidden="true">□</span>
            <h4 class="sources-empty-title">No documents yet</h4>
            <p class="sources-empty-body">Load the starter corpus to try your first run, or import a URL below.</p>
            <button
              type="button"
              class="btn btn-primary"
              disabled={loadingStarter}
              on:click={loadStarterCorpus}
            >
              {loadingStarter ? "Loading…" : "Load 3 starter documents"}
            </button>
            <!-- Source-first reassurance (journey Phase 1, dossier §5 stage ①):
                 adding documents is the concrete START — no credentials needed
                 here. Models/keys are bound at the next stage, deferrable.
                 Reuses the global `muted` utility (no local style block here). -->
            <p class="muted sources-empty-reassure">
              No keys needed yet — we'll set up models after you've picked sources.
            </p>
          </div>
        {:else}
        <ul class="doc-inventory-list">
          {#each documents as doc (doc.id)}
            <li class="doc-inventory-row">
              {#if doc.status === "parsed"}
                <label class="doc-select">
                  <input
                    type="checkbox"
                    checked={selectedDocIds[doc.id] ?? false}
                    disabled={savingSelection}
                    on:change={(e) => setDocSelected(doc.id, e.currentTarget.checked)}
                  />
                  <span class="visually-hidden">Include in next run</span>
                </label>
              {:else}
                <span class="doc-select-spacer" aria-hidden="true"></span>
              {/if}
              <div class="doc-inventory-main">
                <div class="doc-title-row">
                  <span class="doc-name" title={doc.name}>{doc.name}</span>
                  <span class="tag tag-source">{formatSourceKind(doc.source_kind, doc.name)}</span>
                  <span class="tag tag-status tag-status-{doc.status === 'parsed' ? 'ok' : 'err'}">
                    {doc.status === "parsed" ? "Parsed" : doc.status === "failed" ? "Error" : doc.status}
                  </span>
                </div>
                <span class="doc-inventory-meta">{doc.chunk_count} chunks · {doc.char_count.toLocaleString()} chars</span>
              </div>
              {#if doc.status === "failed" && doc.error}
                <span class="doc-inventory-error" title={doc.error}>{doc.error}</span>
              {/if}
              <button
                type="button"
                class="doc-remove-btn"
                aria-label="Remove {doc.name}"
                on:click={() => deleteDocument(doc.id, doc.name)}
              >
                ×
              </button>
            </li>
          {/each}
        </ul>
        {/if}
      {/if}
    </section>

    <section class="page-import" aria-labelledby="page-import-heading">
      <h3 id="page-import-heading" class="preview-sub">Import a web page</h3>
      <p class="muted">
        Fetch and parse one URL — no link following. Preview metadata (title, authors, canonical link) before the full parse.
      </p>
      <div class="form">
        <label class="field">
          <span class="field-label">Page URL</span>
          <input
            class="input"
            type="url"
            bind:value={pageUrl}
            placeholder="https://plato.stanford.edu/entries/existentialism/"
          />
        </label>
        <div class="page-import-actions">
          <ConnectSourceDocumentPreCheck
            bind:this={urlPreCheck}
            apiBase={API_BASE}
            mode="url"
            bind:url={pageUrl}
            on:imported={onUrlDocumentImported}
          />
          <details class="preview-hint-details">
            <summary>Why preview metadata first?</summary>
            <p class="field-hint">
              Preview shows title, authors, and canonical URL before a full parse — useful when the page title differs from what you expect.
            </p>
          </details>
        </div>
        {#if pageUrlMsg}
          <p class:err={pageUrlError} class:notice={!pageUrlError} role={pageUrlError ? "alert" : "status"}>{pageUrlMsg}</p>
        {/if}
      </div>
    </section>

    <div class="connector-cards">
      <button type="button" class="connector-card" on:click={() => (showS3Form = !showS3Form)}>
        <span class="connector-card-name">S3 bucket</span>
        <span class="connector-card-state">Add connection</span>
      </button>
      {#if connProviders.google_drive}
        <a class="connector-card" href={API_BASE + "/sources/connectors/google/authorize"} data-sveltekit-reload>
          <span class="connector-card-name">Google Drive</span>
          <span class="connector-card-state">Connect →</span>
        </a>
      {:else}
        <div class="connector-card connector-card-muted">
          <span class="connector-card-name">Google Drive</span>
          <span class="connector-card-state">Not configured</span>
          <a class="connector-card-setup" href={INTEGRATIONS_HREF}>Set up →</a>
        </div>
      {/if}
      {#if connProviders.sharepoint}
        <a class="connector-card" href={API_BASE + "/sources/connectors/microsoft/authorize"} data-sveltekit-reload>
          <span class="connector-card-name">SharePoint</span>
          <span class="connector-card-state">Connect →</span>
        </a>
      {:else}
        <div class="connector-card connector-card-muted">
          <span class="connector-card-name">SharePoint</span>
          <span class="connector-card-state">Not configured</span>
          <a class="connector-card-setup" href={INTEGRATIONS_HREF}>Set up →</a>
        </div>
      {/if}
    </div>

    {#if showS3Form}
      <form class="form" on:submit|preventDefault={addS3}>
        <div class="row">
          <label class="field"><span class="field-label">Label</span><input class="input" bind:value={s3.label} placeholder="Docs bucket" /></label>
          <label class="field"><span class="field-label">Region</span><input class="input" bind:value={s3.region} placeholder="us-east-1" required /></label>
        </div>
        <div class="row">
          <label class="field"><span class="field-label">Bucket</span><input class="input" bind:value={s3.bucket} placeholder="my-bucket" required /></label>
          <label class="field"><span class="field-label">Prefix (optional)</span><input class="input" bind:value={s3.prefix} placeholder="docs/" /></label>
        </div>
        <label class="field"><span class="field-label">Endpoint (optional, for R2/MinIO)</span><input class="input" type="url" bind:value={s3.endpoint} placeholder="https://&lt;account&gt;.r2.cloudflarestorage.com" /></label>
        <div class="row">
          <label class="field"><span class="field-label">Access key ID</span><input class="input" bind:value={s3.access_key_id} autocomplete="off" required /></label>
          <label class="field"><span class="field-label">Secret access key</span><input class="input" type="password" bind:value={s3.secret_access_key} autocomplete="new-password" required /></label>
        </div>
        {#if s3Msg}<p class:err={s3Error} class:notice={!s3Error} role={s3Error ? "alert" : "status"}>{s3Msg}</p>{/if}
        <div class="actions">
          <button type="submit" class="btn btn-primary" disabled={savingS3}>{savingS3 ? "Saving…" : "Save S3 connection"}</button>
        </div>
      </form>
    {/if}

    {#if connNotice}
      <p class="err" role="alert">{connNotice}</p>
    {/if}
    {#if connections.length > 0}
      <ul class="packs">
        {#each connections as c (c.id)}
          <li class="pack">
            <span class="pack-title">{c.label ?? c.provider}</span>
            <code class="pack-slug">{c.provider}</code>
            <span class="badge {c.status === 'connected' ? 'status-success' : c.status === 'needs_auth' ? 'status-warning' : 'status-error'}">{c.status}</span>
            <span style="margin-left:auto; display:flex; gap:var(--space-2);">
              <button type="button" class="btn btn-inline btn-secondary" on:click={() => browse(c.id)}>Browse</button>
              <button type="button" class="btn btn-inline btn-danger" on:click={() => deleteConnection(c.id)}>Remove</button>
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">No cloud connections yet.</p>
    {/if}

    {#if browseConnId}
      <div class="browse">
        <h3 class="preview-sub">Browse &amp; import</h3>
        {#if browsing}
          <p class="muted" role="status">Loading…</p>
        {:else if browseRefs.length === 0}
          {#if browseMsg}
            <p class:err={browseError} class:notice={!browseError} role={browseError ? "alert" : "status"}>{browseMsg}</p>
          {/if}
        {:else}
          <ul class="docs">
            {#each browseRefs as r (r.id)}
              <li class="doc">
                <label class="doc-label">
                  <input type="checkbox" bind:checked={browseSel[r.id]} />
                  <span class="doc-name">{r.name}</span>
                </label>
                {#if r.size}<span class="pack-slug">{Math.round(r.size / 1024)} KB</span>{/if}
              </li>
            {/each}
          </ul>
          {#if browseMsg}
            <p class:err={browseError} class:notice={!browseError} role={browseError ? "alert" : "status"}>{browseMsg}</p>
          {/if}
          <div class="actions">
            <button type="button" class="btn btn-primary" on:click={importSelected} disabled={importing}>{importing ? "Importing…" : "Import selected"}</button>
          </div>
        {/if}
      </div>
    {/if}

    <details class="disclosure">
      <summary>Crawl a website (multiple pages)</summary>
      <p class="muted disclosure-lede">
        Follow links or sitemap.xml from a root URL. For one article only, use <strong>Import a web page</strong> above.
      </p>
      <form class="form" on:submit|preventDefault={runCrawl}>
        <label class="field"><span class="field-label">Root URL</span><input class="input" type="url" bind:value={crawl.root_url} placeholder="https://docs.example.com" required /></label>
        <div class="row">
          <label class="field"><span class="field-label">Max pages</span><input class="input" type="number" min="1" max="50" bind:value={crawl.max_pages} /></label>
          <label class="field"><span class="field-label" style="display:flex;gap:var(--space-2);align-items:center;"><input type="checkbox" bind:checked={crawl.same_host_only} /> Same host only</span></label>
          <label class="field"><span class="field-label" style="display:flex;gap:var(--space-2);align-items:center;"><input type="checkbox" bind:checked={crawl.use_sitemap} /> Use sitemap.xml</span></label>
        </div>
        {#if crawlMsg}<p class:err={crawlError} class:notice={!crawlError} role={crawlError ? "alert" : "status"}>{crawlMsg}</p>{/if}
        <div class="actions">
          <button type="submit" class="btn btn-primary" disabled={crawling || !crawl.root_url.trim()}>{crawling ? "Crawling…" : "Crawl & import"}</button>
        </div>
      </form>
    </details>
  </div>
{/if}

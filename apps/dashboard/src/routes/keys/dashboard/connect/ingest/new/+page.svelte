<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import ConnectSourceDocumentPreCheck from "$lib/components/connect/ConnectSourceDocumentPreCheck.svelte";
  import SignInNotice from "$lib/components/connect/SignInNotice.svelte";

  const CONNECT_BASE = DASHBOARD_BASE + "/connect";
  const API_BASE = DASHBOARD_BASE + "/api/connect";

  const STAGES = [
    "extracting",
    "relating",
    "grouping",
    "embedding",
    "validating",
    "remediating",
    "storing",
  ];

  type Pack = { id: string; slug: string; title: string };
  type Profile = {
    id: string;
    title: string;
    domain_pack_id: string;
    graph_target_id?: string;
    default_stop_after_stage?: string;
  };
  type Target = { id: string; status: string; connection: { endpoint: string } } | null;

  let label = "";
  let urlsText = "";
  let pastedTitle = "";
  let pastedText = "";
  let stopAfterStage = "";
  let domainPackId = "";
  let profileId = "";

  let packs: Pack[] = [];
  let profiles: Profile[] = [];
  let target: Target = null;

  type Doc = {
    id: string;
    name: string;
    source_kind: string;
    status: string;
    char_count: number;
    chunk_count: number;
    error?: string;
  };
  let documents: Doc[] = [];
  let selectedDocs: Record<string, boolean> = {};
  let docUrl = "";
  let docMsg: string | null = null;
  let docError = false;
  let docPreCheck: ConnectSourceDocumentPreCheck;

  let loading = true;
  let submitting = false;
  let error: string | null = null;
  let loadError: string | null = null;
  let signedOut = false;

  // Dry-run preview
  type Warning = { code: string; severity: string; message: string };
  type Unit = { id: string; text: string; type?: string; domain?: string };
  type Relation = { from: string; relation: string; to: string };
  let previewing = false;
  let previewError = false;
  let previewMsg: string | null = null;
  let previewUnits: Unit[] = [];
  let previewRelations: Relation[] = [];
  let previewWarnings: Warning[] = [];
  let previewMeta: { pack?: string; schema_mode?: string; sampled_from?: string | null } | null = null;

  async function loadConfig() {
    loading = true;
    loadError = null;
    signedOut = false;
    try {
      const [packsRes, profilesRes, targetRes] = await Promise.all([
        fetch(API_BASE + "/domain-packs"),
        fetch(API_BASE + "/pipeline/profiles"),
        fetch(API_BASE + "/pipeline/graph-target"),
      ]);
      if (packsRes.status === 401) {
        signedOut = true;
        return;
      }
      if (packsRes.ok) {
        const d = await packsRes.json();
        packs = d.packs ?? [];
        const generic = packs.find((p) => p.slug === "generic");
        domainPackId = generic?.id ?? packs[0]?.id ?? "";
      }
      if (profilesRes.ok) {
        const d = await profilesRes.json();
        profiles = d.profiles ?? [];
      }
      if (targetRes.ok) {
        const d = await targetRes.json();
        target = d.target ?? null;
      }
      await loadDocuments();
    } catch {
      loadError = "Could not load pipeline configuration.";
    } finally {
      loading = false;
    }
  }

  async function loadDocuments() {
    try {
      const res = await fetch(API_BASE + "/sources/documents");
      if (res.ok) {
        const d = await res.json();
        documents = d.documents ?? [];
      }
    } catch {
      // non-fatal
    }
  }

  async function onDocumentImported(event: CustomEvent<{ id: string; name: string; status: string; chunk_count?: number }>) {
    const doc = event.detail;
    docError = doc.status === "failed";
    docMsg =
      doc.status === "failed"
        ? "Could not parse this document."
        : `Added "${doc.name}" (${doc.chunk_count ?? 0} chunks).`;
    if (doc.status === "parsed") selectedDocs[doc.id] = true;
    docUrl = "";
    await loadDocuments();
  }

  async function previewFile(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    if (!file) return;
    docMsg = null;
    docError = false;
    try {
      const isText = file.type.startsWith("text/") || /\.(txt|md|markdown|html?|csv|json)$/i.test(file.name);
      let content: string;
      let encoding: "utf8" | "base64";
      if (isText) {
        content = await file.text();
        encoding = "utf8";
      } else {
        const buf = new Uint8Array(await file.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        content = btoa(bin);
        encoding = "base64";
      }
      await docPreCheck.runUploadPreview({
        name: file.name,
        mime: file.type || "text/plain",
        content,
        content_encoding: encoding,
      });
    } catch {
      docError = true;
      docMsg = "Could not read the file.";
    } finally {
      inputEl.value = "";
    }
  }

  onMount(loadConfig);

  function applyProfile() {
    const p = profiles.find((x) => x.id === profileId);
    if (!p) return;
    domainPackId = p.domain_pack_id;
    stopAfterStage = p.default_stop_after_stage ?? "";
  }

  function buildSources(): { url?: string; text?: string; title?: string }[] {
    const sources: { url?: string; text?: string; title?: string }[] = [];
    for (const line of urlsText.split("\n").map((l) => l.trim()).filter(Boolean)) {
      sources.push({ url: line });
    }
    if (pastedText.trim()) {
      sources.push({ text: pastedText.trim(), ...(pastedTitle.trim() ? { title: pastedTitle.trim() } : {}) });
    }
    return sources;
  }

  async function runPreview() {
    previewing = true;
    previewError = false;
    previewMsg = null;
    try {
      const documentIds = Object.keys(selectedDocs).filter((id) => selectedDocs[id]);
      const text = pastedText.trim() || undefined;
      if (documentIds.length === 0 && !text) {
        previewError = true;
        previewMsg = "Select a document or paste text to preview extraction.";
        return;
      }
      const res = await fetch(API_BASE + "/extraction/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(domainPackId ? { domain_pack_id: domainPackId } : {}),
          ...(documentIds.length ? { document_ids: documentIds } : {}),
          ...(text ? { text } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        previewError = true;
        previewMsg = d.message ?? `Preview failed (HTTP ${res.status}).`;
        return;
      }
      previewUnits = d.result?.units ?? [];
      previewRelations = d.result?.relations ?? [];
      previewWarnings = d.result?.warnings ?? [];
      previewMeta = {
        pack: d.pack?.title,
        schema_mode: d.pack?.schema_mode,
        sampled_from: d.sampled_from,
      };
      previewMsg = `Previewed ${previewUnits.length} unit(s) and ${previewRelations.length} relationship(s) from ${d.chunks_previewed} chunk(s).`;
    } catch {
      previewError = true;
      previewMsg = "Network error while previewing.";
    } finally {
      previewing = false;
    }
  }

  async function submit() {
    error = null;
    const sources = buildSources();
    const documentIds = Object.keys(selectedDocs).filter((id) => selectedDocs[id]);
    if (sources.length === 0 && documentIds.length === 0) {
      error = "Add at least one document, source URL, or pasted text.";
      return;
    }
    submitting = true;
    try {
      const res = await fetch(API_BASE + "/ingest/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(sources.length ? { sources } : {}),
          ...(documentIds.length ? { document_ids: documentIds } : {}),
          ...(label.trim() ? { label: label.trim() } : {}),
          ...(stopAfterStage ? { stop_after_stage: stopAfterStage } : {}),
          ...(domainPackId ? { domain_pack_id: domainPackId } : {}),
          ...(profileId ? { pipeline_profile_id: profileId } : {}),
          ...(target?.id ? { graph_target_id: target.id } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        error = d.message ?? `Could not create job (HTTP ${res.status}).`;
        return;
      }
      const d = await res.json();
      const id = d.job?.id;
      await goto(CONNECT_BASE + "/ingest/" + (id ?? ""));
    } catch {
      error = "Network error while creating the job.";
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>New ingest job – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section aria-labelledby="new-job-heading">
  <h1 id="new-job-heading" class="h1">New ingest job</h1>
  <p class="lede">
    Sources are processed through your configured pipeline (domain pack + graph store). Provide URLs and/or pasted
    text.
  </p>

  {#if loading}
    <p class="muted" role="status">Loading configuration…</p>
  {:else if signedOut}
    <SignInNotice message="Sign in to create ingest runs." />
  {:else if loadError}
    <p class="err" role="alert">{loadError}</p>
  {:else}
    {#if !target}
      <p class="notice" role="status">
        No graph store is connected yet. You can still create a job, but it will run in stub mode until you
        <a href={CONNECT_BASE + "/pipeline?step=store"}>configure a graph store</a>.
      </p>
    {/if}

    <form on:submit|preventDefault={submit} class="form">
      {#if profiles.length > 0}
        <label class="field">
          <span class="field-label">Pipeline profile (optional)</span>
          <select class="input" bind:value={profileId} on:change={applyProfile}>
            <option value="">None — choose settings manually</option>
            {#each profiles as p}
              <option value={p.id}>{p.title}</option>
            {/each}
          </select>
        </label>
      {/if}

      <label class="field">
        <span class="field-label">Label</span>
        <input class="input" type="text" bind:value={label} placeholder="e.g. Wave 1 — product docs" />
      </label>

      <label class="field">
        <span class="field-label">Domain pack</span>
        <select class="input" bind:value={domainPackId}>
          {#each packs as p}
            <option value={p.id}>{p.title}</option>
          {/each}
        </select>
        <span class="field-hint">The domain pack defines the ontology, prompts, and graph schema used for this corpus.</span>
      </label>

      <fieldset class="field fieldset">
        <legend class="field-label">Documents</legend>
        <span class="field-hint">
          Preview title, authors, and links before full parse. Binary formats (PDF, DOCX) need a managed parser on import.
        </span>
        <div class="doc-add">
          <input class="input" type="url" bind:value={docUrl} placeholder="https://example.com/article" />
          <label class="btn btn-secondary file-btn">
            Choose file to preview
            <input type="file" on:change={previewFile} hidden accept=".txt,.md,.markdown,.html,.htm,.csv,.json,text/*" />
          </label>
        </div>
        <ConnectSourceDocumentPreCheck
          bind:this={docPreCheck}
          apiBase={API_BASE}
          mode="url"
          bind:url={docUrl}
          on:imported={onDocumentImported}
        />
        {#if docMsg}<p class:err={docError} class:doc-ok={!docError} role="status">{docMsg}</p>{/if}
        {#if documents.length > 0}
          <ul class="docs">
            {#each documents as doc (doc.id)}
              <li class="doc">
                <label class="doc-label">
                  <input type="checkbox" bind:checked={selectedDocs[doc.id]} disabled={doc.status !== "parsed"} />
                  <span class="doc-name">{doc.name}</span>
                </label>
                {#if doc.status === "parsed"}
                  <span class="doc-meta">{doc.chunk_count} chunks · {doc.char_count.toLocaleString()} chars</span>
                {:else}
                  <span class="doc-meta doc-failed">{doc.status}{doc.error ? ` — ${doc.error}` : ""}</span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </fieldset>

      <label class="field">
        <span class="field-label">Or add source URLs (one per line)</span>
        <textarea class="input" rows="3" bind:value={urlsText} placeholder="https://example.com/article-1&#10;https://example.com/article-2"></textarea>
      </label>

      <fieldset class="field fieldset">
        <legend class="field-label">Or paste text</legend>
        <input class="input" type="text" bind:value={pastedTitle} placeholder="Optional title" />
        <textarea class="input" rows="5" bind:value={pastedText} placeholder="Paste source text to ingest…"></textarea>
      </fieldset>

      <label class="field">
        <span class="field-label">Stop after stage (optional)</span>
        <select class="input" bind:value={stopAfterStage}>
          <option value="">Run full pipeline</option>
          {#each STAGES as s}
            <option value={s}>{s}</option>
          {/each}
        </select>
        <span class="field-hint">Useful for a dry run — e.g. stop after <code>extracting</code> to inspect units before storing.</span>
      </label>

      <section class="preview" aria-labelledby="preview-heading">
        <div class="preview-head">
          <h2 id="preview-heading" class="preview-title">Dry-run preview</h2>
          <button type="button" class="btn btn-secondary" on:click={runPreview} disabled={previewing}>
            {previewing ? "Previewing…" : "Preview extraction"}
          </button>
        </div>
        <p class="field-hint">
          Runs the selected domain pack's extraction over a small sample (no data is stored). Check the units,
          relationships, and warnings before committing to a full run.
        </p>
        {#if previewMsg}<p class:err={previewError} class:doc-ok={!previewError} role="status">{previewMsg}</p>{/if}
        {#if previewMeta && !previewError}
          <p class="field-hint">
            Pack: <strong>{previewMeta.pack}</strong> · schema mode: <code>{previewMeta.schema_mode}</code>{#if previewMeta.sampled_from} · sampled from “{previewMeta.sampled_from}”{/if}
          </p>
        {/if}
        {#if previewWarnings.length > 0}
          <ul class="warnings">
            {#each previewWarnings as w}
              <li class="warning {w.severity === 'warning' ? 'warn' : 'info'}">{w.message}</li>
            {/each}
          </ul>
        {/if}
        {#if previewUnits.length > 0}
          <div class="preview-grid">
            <div>
              <h3 class="preview-sub">Units ({previewUnits.length})</h3>
              <ul class="units">
                {#each previewUnits as u}
                  <li><span class="unit-type">{u.type ?? "unit"}</span> {u.text}</li>
                {/each}
              </ul>
            </div>
            <div>
              <h3 class="preview-sub">Relationships ({previewRelations.length})</h3>
              {#if previewRelations.length > 0}
                <ul class="rels">
                  {#each previewRelations as r}
                    <li><code>{r.from}</code> —{r.relation}→ <code>{r.to}</code></li>
                  {/each}
                </ul>
              {:else}
                <p class="field-hint">No relationships — units would be disconnected.</p>
              {/if}
            </div>
          </div>
        {/if}
      </section>

      {#if error}
        <p class="err" role="alert">{error}</p>
      {/if}

      <div class="actions">
        <button type="submit" class="btn btn-primary" disabled={submitting}>
          {submitting ? "Creating…" : "Create job"}
        </button>
        <a class="btn btn-secondary" href={CONNECT_BASE + "/ingest"}>Cancel</a>
      </div>
    </form>
  {/if}
</section>

<style>
  .h1 {
    margin: 0 0 var(--space-1);
    font-size: var(--text-2xl);
    color: var(--rm-text);
  }
  .lede {
    margin: 0 0 var(--space-4);
    color: var(--rm-muted);
    max-width: 42rem;
  }
  .muted {
    color: var(--rm-muted);
  }
  .err {
    color: var(--coral-alert);
  }
  .notice {
    border: 1px solid var(--rm-border);
    background: var(--rm-surface-raised);
    color: var(--rm-muted);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--rm-radius);
    margin-bottom: var(--space-4);
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 42rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .fieldset {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-3);
  }
  .field-label {
    font-size: var(--text-sm);
    color: var(--rm-text);
    font-weight: 500;
  }
  .field-hint {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .actions {
    display: flex;
    gap: var(--space-3);
  }
  .doc-add {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    flex-wrap: wrap;
    margin-top: var(--space-2);
  }
  .doc-add .input {
    flex: 1;
    min-width: 14rem;
  }
  .file-btn {
    cursor: pointer;
  }
  .doc-ok {
    color: var(--rm-muted);
    font-size: var(--text-xs);
    margin: var(--space-1) 0 0;
  }
  .docs {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .doc {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-2) var(--space-3);
  }
  .doc-label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .doc-name {
    color: var(--rm-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .doc-meta {
    color: var(--rm-muted);
    font-size: var(--text-xs);
    flex: 0 0 auto;
  }
  .doc-failed {
    color: var(--coral-alert);
  }
  .preview {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .preview-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .preview-title {
    margin: 0;
    font-size: var(--text-base);
    color: var(--rm-text);
  }
  .preview-grid {
    display: grid;
    gap: var(--space-4);
  }
  @media (min-width: 720px) {
    .preview-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  .preview-sub {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .warnings {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .warning {
    font-size: var(--text-sm);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
  }
  .warning.warn {
    color: var(--amber-insight);
    border-color: color-mix(in oklab, var(--amber-insight) 45%, var(--rm-border));
  }
  .warning.info {
    color: var(--rm-muted);
  }
  .units,
  .rels {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .unit-type {
    display: inline-block;
    color: var(--rm-sage);
    font-size: var(--text-xs);
    margin-right: var(--space-1);
  }
</style>

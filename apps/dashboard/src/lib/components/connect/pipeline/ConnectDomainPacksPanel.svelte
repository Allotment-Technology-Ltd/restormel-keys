<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import {
    CONNECT_PIPELINE_API,
    type DomainPack,
    type PipelineWizardStepId,
    withReturnTo,
  } from "$lib/connect/pipeline-config";
  import { csvList } from "$lib/connect/pipeline-utils";
  import {
    FIRST_GRAPH_ONBOARDING_DOC_HREF,
    STARTER_CORPUS_NAME_PREFIX,
    SUGGESTED_GRAPH_DESIGNER_INTENT,
  } from "$lib/connect/first-graph-guide";
  import ConnectDomainTemplateSelector from "$lib/components/connect/ConnectDomainTemplateSelector.svelte";
  import type { UseCase } from "$lib/content/use-cases";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";

  export let embedded = false;
  export let wizardStep: PipelineWizardStepId | null = null;
  export let modelsReady = true;

  const CONNECT_BASE = DASHBOARD_BASE + "/connect";

  const dispatch = createEventDispatcher<{ updated: void; stepState: { canContinue: boolean } }>();
  const API_BASE = CONNECT_PIPELINE_API;

  function notifyUpdated() {
    dispatch("updated");
  }

  let loading = true;
  let loadError: string | null = null;
  let loadErrorAuth = false;

  let packs: DomainPack[] = [];
  let embeddingLock: { dimensions: number; embeddedUnitCount: number; model?: string } | null = null;
  let selectedPackId: string | null = null;
  let selectingPack = false;
  let packMsg: string | null = null;
  let packMsgError = false;
  let viewingPackId: string | null = null;
  let viewingPack: Record<string, unknown> | null = null;
  let loadingPackView = false;
  let savingPack = false;
  let np = {
    slug: "",
    title: "",
    description: "",
    unit_noun: "statement",
    group_noun: "topic",
    domains: "",
    unit_types: "assertion, definition, example",
    relation_types: "supports, contradicts, relates_to",
    group_roles: "summary, key_point, supporting_detail",
    unit_table: "statement",
    group_table: "topic",
    source_table: "source",
    passage_table: "passage",
    source_text_field: "",
    passage_text_field: "",
    passage_source_field: "",
    schema_mode: "guided",
    embedding_model: "voyage-3",
    embedding_dimensions: 1024,
    quality_preset: "production" as "production" | "starter",
    cross_model_validation: true,
    archetype: "generic",
    prompt_extraction: "",
    prompt_validation: "",
  };
  let draftPatterns: { from_unit_type: string; relation: string; to_unit_type: string }[] = [];
  let showPackCreator = false;
  let draftGenerated = false;
  let draftSavedNotice: string | null = null;
  let editingPackId: string | null = null;
  let loadingPackEdit = false;

  const defaultPackForm = () => ({
    slug: "",
    title: "",
    description: "",
    unit_noun: "statement",
    group_noun: "topic",
    domains: "",
    unit_types: "assertion, definition, example",
    relation_types: "supports, contradicts, relates_to",
    group_roles: "summary, key_point, supporting_detail",
    unit_table: "statement",
    group_table: "topic",
    source_table: "source",
    passage_table: "passage",
    source_text_field: "",
    passage_text_field: "",
    passage_source_field: "",
    schema_mode: "guided",
    embedding_model: "voyage-3",
    embedding_dimensions: 1024,
    quality_preset: "production" as "production" | "starter",
    cross_model_validation: true,
    archetype: "generic",
    prompt_extraction: "",
    prompt_validation: "",
  });

  function resetPackForm() {
    editingPackId = null;
    np = defaultPackForm();
    draftPatterns = [];
    setPackMsg(null);
  }

  function setPackMsg(message: string | null, isError = false) {
    packMsg = message;
    packMsgError = isError;
  }

  function buildPackBody() {
    const relationNames = csvList(np.relation_types);
    const patterns = draftPatterns.filter(
      (p) => relationNames.length === 0 || relationNames.includes(p.relation),
    );
    return {
      slug: np.slug.trim(),
      title: np.title.trim(),
      ...(np.description.trim() ? { description: np.description.trim() } : {}),
      ontology: {
        unit_noun: np.unit_noun.trim() || "statement",
        group_noun: np.group_noun.trim() || "topic",
        domains: csvList(np.domains),
        unit_types: csvList(np.unit_types),
        relation_types: relationNames.map((name) => ({ name })),
        group_roles: csvList(np.group_roles),
        relationship_patterns: patterns,
        schema_mode: np.schema_mode,
      },
      graph_schema: {
        source_table: np.source_table.trim() || "source",
        passage_table: np.passage_table.trim() || "passage",
        unit_table: np.unit_table.trim() || "statement",
        group_table: np.group_table.trim() || "topic",
        part_of_edge: "part_of",
        relation_edges: relationNames,
        ...(np.source_text_field.trim() ? { source_text_field: np.source_text_field.trim() } : {}),
        ...(np.passage_text_field.trim() ? { passage_text_field: np.passage_text_field.trim() } : {}),
        ...(np.passage_source_field.trim()
          ? { passage_source_field: np.passage_source_field.trim() }
          : {}),
      },
      passage_profile: { marker_lexicon: [], min_passage_chars: 400, max_passage_chars: 6000 },
      embedding: {
        model: np.embedding_model.trim() || "voyage-3",
        dimensions: Number(np.embedding_dimensions) || 1024,
      },
      quality_preset: np.quality_preset,
      cross_model_validation: np.cross_model_validation,
      archetype: np.archetype,
      prompts: {
        ...(np.prompt_extraction.trim() ? { extraction: np.prompt_extraction.trim() } : {}),
        ...(np.prompt_validation.trim() ? { validation: np.prompt_validation.trim() } : {}),
      },
    };
  }

  function applyPackToForm(pack: {
    slug: string;
    title: string;
    description?: string;
    ontology: {
      unit_noun: string;
      group_noun: string;
      domains?: string[];
      unit_types?: string[];
      relation_types?: { name: string }[];
      group_roles?: string[];
      relationship_patterns?: { from_unit_type: string; relation: string; to_unit_type: string }[];
      schema_mode?: string;
    };
    graph_schema?: {
      unit_table?: string;
      group_table?: string;
      source_table?: string;
      passage_table?: string;
      source_text_field?: string;
      passage_text_field?: string;
      passage_source_field?: string;
    };
    embedding?: { model?: string; dimensions?: number };
    quality_preset?: "production" | "starter";
    cross_model_validation?: boolean;
    archetype?: string;
    prompts?: { extraction?: string; validation?: string };
  }) {
    const o = pack.ontology;
    np = {
      slug: pack.slug ?? "",
      title: pack.title ?? "",
      description: pack.description ?? "",
      unit_noun: o.unit_noun ?? "statement",
      group_noun: o.group_noun ?? "topic",
      domains: (o.domains ?? []).join(", "),
      unit_types: (o.unit_types ?? []).join(", "),
      relation_types: (o.relation_types ?? []).map((r) => r.name).join(", "),
      group_roles: (o.group_roles ?? []).join(", "),
      unit_table: pack.graph_schema?.unit_table ?? "unit",
      group_table: pack.graph_schema?.group_table ?? "group",
      source_table: pack.graph_schema?.source_table ?? "source",
      passage_table: pack.graph_schema?.passage_table ?? "passage",
      source_text_field: pack.graph_schema?.source_text_field ?? "",
      passage_text_field: pack.graph_schema?.passage_text_field ?? "",
      passage_source_field: pack.graph_schema?.passage_source_field ?? "",
      schema_mode: o.schema_mode ?? "guided",
      embedding_model: pack.embedding?.model ?? "voyage-3",
      embedding_dimensions: pack.embedding?.dimensions ?? 1024,
      quality_preset: pack.quality_preset ?? "production",
      cross_model_validation: pack.cross_model_validation !== false,
      archetype: pack.archetype ?? "generic",
      prompt_extraction: pack.prompts?.extraction ?? "",
      prompt_validation: pack.prompts?.validation ?? "",
    };
    draftPatterns = o.relationship_patterns ?? [];
  }

  async function startEditPack(packId: string) {
    loadingPackEdit = true;
    setPackMsg(null);
    try {
      const res = await fetch(`${API_BASE}/domain-packs/${packId}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPackMsg(d.message ?? `Could not load pack (HTTP ${res.status}).`, true);
        return;
      }
      applyPackToForm(d.pack);
      editingPackId = packId;
      showPackCreator = true;
    } catch {
      setPackMsg("Network error while loading the pack.", true);
    } finally {
      loadingPackEdit = false;
    }
  }

  async function deletePack(p: DomainPack) {
    if (p.is_builtin) return;
    if (!confirm(`Delete "${p.title}"? Pipeline profiles using this pack will lose that link.`)) return;
    setPackMsg(null);
    try {
      const res = await fetch(`${API_BASE}/domain-packs/${p.id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPackMsg(d.message ?? `Could not delete pack (HTTP ${res.status}).`, true);
        return;
      }
      if (editingPackId === p.id) resetPackForm();
      if (viewingPackId === p.id) {
        viewingPackId = null;
        viewingPack = null;
      }
      if (selectedPackId === p.id) selectedPackId = null;
      setPackMsg(`"${p.title}" deleted.`);
      await loadPacks();
      notifyUpdated();
    } catch {
      setPackMsg("Network error while deleting pack.", true);
    }
  }

  let designIntent = "";
  let designDomain = "";
  let designing = false;
  let designMsg: string | null = null;
  let designError = false;
  let designRationale: string | null = null;
  let designSampled: string[] = [];
  let starterDocumentIds: string[] = [];

  type SurrealSchemaTable = {
    name: string;
    kind: string;
    count: number;
    relation_in?: string;
    relation_out?: string;
    has_text_field?: boolean;
  };
  type SurrealSchemaSuggested = {
    source_table: string;
    passage_table: string;
    unit_table: string;
    group_table: string;
    part_of_edge: string;
    relation_edges: string[];
  };

  let surrealTargetReady = false;
  let discoveringSchema = false;
  let importingSchema = false;
  let schemaMsg: string | null = null;
  let schemaError = false;
  let schemaWarnings: string[] = [];
  let schemaTables: SurrealSchemaTable[] = [];
  let schemaSuggested: SurrealSchemaSuggested | null = null;
  let schemaImportTitle = "";
  let schemaImportSlug = "";
  let schemaMapping: SurrealSchemaSuggested = {
    source_table: "source",
    passage_table: "passage",
    unit_table: "unit",
    group_table: "group",
    part_of_edge: "part_of",
    relation_edges: [],
  };

  async function loadGraphTargetStatus() {
    try {
      const res = await fetch(`${API_BASE}/pipeline/graph-target`);
      if (!res.ok) return;
      const d = await res.json();
      surrealTargetReady = d.target?.provider === "surreal" && d.target?.status === "ok";
    } catch {
      surrealTargetReady = false;
    }
  }

  async function discoverSurrealSchema() {
    discoveringSchema = true;
    schemaMsg = null;
    schemaError = false;
    schemaWarnings = [];
    schemaTables = [];
    schemaSuggested = null;
    try {
      const res = await fetch(`${API_BASE}/pipeline/surreal-schema`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        schemaError = true;
        schemaMsg = d.message ?? `Could not read Surreal schema (HTTP ${res.status}).`;
        return;
      }
      schemaTables = d.tables ?? [];
      schemaSuggested = d.suggested ?? null;
      schemaWarnings = d.warnings ?? [];
      if (d.draft) {
        schemaImportTitle = d.draft.title ?? "";
        schemaImportSlug = d.draft.slug ?? "";
      }
      if (schemaSuggested) {
        schemaMapping = { ...schemaSuggested };
      }
      schemaMsg = `Found ${schemaTables.length} table(s) in ${d.namespace}/${d.database}. Review mapping below, then save as a domain pack.`;
    } catch {
      schemaError = true;
      schemaMsg = "Network error while reading Surreal schema.";
    } finally {
      discoveringSchema = false;
    }
  }

  async function importSurrealSchema() {
    importingSchema = true;
    schemaMsg = null;
    schemaError = false;
    try {
      const res = await fetch(`${API_BASE}/pipeline/surreal-schema/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: schemaImportTitle.trim() || undefined,
          slug: schemaImportSlug.trim() || undefined,
          mapping: schemaMapping,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        schemaError = true;
        schemaMsg = d.message ?? `Could not import schema (HTTP ${res.status}).`;
        return;
      }
      setPackMsg(`Imported domain pack "${d.pack?.title ?? "Surreal schema"}".`);
      schemaMsg = "Domain pack saved and selected for your next run.";
      await loadPacks();
      if (d.pack?.id) await selectPack(d.pack.id);
      notifyUpdated();
    } catch {
      schemaError = true;
      schemaMsg = "Network error while importing Surreal schema.";
    } finally {
      importingSchema = false;
    }
  }

  function useSchemaInEditor() {
    if (!schemaSuggested) return;
    np = {
      ...defaultPackForm(),
      slug: schemaImportSlug || schemaSuggested.unit_table + "-surreal",
      title: schemaImportTitle || `Surreal — ${schemaSuggested.unit_table}`,
      unit_noun: schemaMapping.unit_table.replace(/_/g, " "),
      group_noun: schemaMapping.group_table.replace(/_/g, " "),
      unit_table: schemaMapping.unit_table,
      group_table: schemaMapping.group_table,
      source_table: schemaMapping.source_table,
      passage_table: schemaMapping.passage_table,
      relation_types: schemaMapping.relation_edges.join(", "),
    };
    showPackCreator = true;
    setPackMsg("Surreal mapping loaded into the editor — adjust ontology, then save.");
  }

  function useSuggestedIntent() {
    designIntent = SUGGESTED_GRAPH_DESIGNER_INTENT;
    designDomain = "philosophy starter";
  }

  function onTemplateSelect(template: UseCase) {
    designIntent = template.starterPrompt;
    np = {
      ...np,
      unit_types: template.graphShape.nodeTypes.join(", "),
      relation_types: template.graphShape.edgeTypes.join(", "),
    };
    const domainLabel = template.id.replace(/-/g, " ");
    if (!designDomain.trim()) {
      designDomain = domainLabel;
    }
  }

  let designIntentEl: HTMLTextAreaElement | undefined;

  async function loadStarterDocumentIds() {
    try {
      const res = await fetch(API_BASE + "/sources/documents");
      if (!res.ok) return;
      const d = await res.json();
      starterDocumentIds = (d.documents ?? [])
        .filter(
          (doc: { name?: string; status?: string }) =>
            doc.name?.startsWith(STARTER_CORPUS_NAME_PREFIX) && doc.status === "parsed",
        )
        .map((doc: { id: string }) => doc.id);
    } catch {
      /* non-fatal */
    }
  }

  async function loadPacks() {
    loading = true;
    loadError = null;
    loadErrorAuth = false;
    try {
      const res = await fetch(API_BASE + "/domain-packs");
      if (res.status === 401) {
        loadError = "Sign in to manage domain packs.";
        loadErrorAuth = true;
        return;
      }
      if (res.ok) {
        const d = await res.json();
        packs = d.packs ?? [];
        embeddingLock = d.embedding_lock ?? null;
        if (embeddingLock) {
          np.embedding_dimensions = embeddingLock.dimensions;
          if (embeddingLock.model) np.embedding_model = embeddingLock.model;
        }
        selectedPackId =
          d.selected_domain_pack_id ??
          packs.find((p: DomainPack) => p.slug === "generic")?.id ??
          packs[0]?.id ??
          null;
      }
    } catch {
      loadError = "Could not load domain packs.";
    } finally {
      loading = false;
    }
  }

  async function selectPack(packId: string) {
    if (selectedPackId === packId) return;
    selectingPack = true;
    setPackMsg(null);
    try {
      const res = await fetch(API_BASE + "/domain-packs/selection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_pack_id: packId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPackMsg(d.message ?? `Could not select pack (HTTP ${res.status}).`, true);
        return;
      }
      selectedPackId = packId;
      const title = packs.find((p) => p.id === packId)?.title ?? "Domain pack";
      setPackMsg(`Using "${title}" for pipeline runs.`);
      notifyUpdated();
    } catch {
      setPackMsg("Network error while selecting pack.", true);
    } finally {
      selectingPack = false;
    }
  }

  async function viewPack(packId: string) {
    if (viewingPackId === packId && viewingPack) {
      viewingPackId = null;
      viewingPack = null;
      return;
    }
    loadingPackView = true;
    viewingPackId = packId;
    viewingPack = null;
    try {
      const res = await fetch(`${API_BASE}/domain-packs/${packId}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPackMsg(d.message ?? `Could not load pack details (HTTP ${res.status}).`, true);
        viewingPackId = null;
        return;
      }
      viewingPack = d.pack;
    } catch {
      setPackMsg("Network error while loading pack details.", true);
      viewingPackId = null;
    } finally {
      loadingPackView = false;
    }
  }

  function packDetailLines(pack: Record<string, unknown>) {
    const ontology = (pack.ontology ?? {}) as DomainPack["ontology"];
    const relations = (ontology.relation_types ?? []).map((r) => r.name).filter(Boolean);
    const unitTypes = ontology.unit_types ?? [];
    const roles = ontology.group_roles ?? [];
    return [
      pack.description ? String(pack.description) : null,
      `${ontology.unit_noun ?? "unit"} grouped into ${ontology.group_noun ?? "group"} · schema ${ontology.schema_mode ?? "guided"}`,
      unitTypes.length ? `Unit types: ${unitTypes.join(", ")}` : null,
      relations.length ? `Relations: ${relations.join(", ")}` : null,
      roles.length ? `Group roles: ${roles.join(", ")}` : null,
      ontology.domains?.length ? `Domains: ${ontology.domains.join(", ")}` : null,
    ].filter(Boolean) as string[];
  }

  async function designPack() {
    if (designIntent.trim().length < 8) {
      designError = true;
      designMsg = "Describe what your graph should capture (a sentence or two).";
      return;
    }
    designing = true;
    designMsg = null;
    designError = false;
    designRationale = null;
    designSampled = [];
    try {
      const res = await fetch(API_BASE + "/domain-packs/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: designIntent.trim(),
          ...(designDomain.trim() ? { domain_name: designDomain.trim() } : {}),
          ...(starterDocumentIds.length > 0 ? { document_ids: starterDocumentIds } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        designError = true;
        designMsg = d.message ?? `Could not generate a draft (HTTP ${res.status}).`;
        return;
      }
      const draft = d.draft;
      const o = draft.ontology;
      np = {
        slug: draft.slug ?? "",
        title: draft.title ?? "",
        description: draft.description ?? "",
        unit_noun: o.unit_noun ?? "statement",
        group_noun: o.group_noun ?? "topic",
        domains: (o.domains ?? []).join(", "),
        unit_types: (o.unit_types ?? []).join(", "),
        relation_types: (o.relation_types ?? []).map((r: { name: string }) => r.name).join(", "),
        group_roles: (o.group_roles ?? []).join(", "),
        unit_table: draft.graph_schema?.unit_table ?? "unit",
        group_table: draft.graph_schema?.group_table ?? "group",
        source_table: draft.graph_schema?.source_table ?? "source",
        passage_table: draft.graph_schema?.passage_table ?? "passage",
        source_text_field: draft.graph_schema?.source_text_field ?? "",
        passage_text_field: draft.graph_schema?.passage_text_field ?? "",
        passage_source_field: draft.graph_schema?.passage_source_field ?? "",
        schema_mode: o.schema_mode ?? "guided",
        embedding_model: draft.embedding?.model ?? "voyage-3",
        embedding_dimensions: draft.embedding?.dimensions ?? 1024,
        quality_preset: "production",
        cross_model_validation: true,
        archetype: draft.archetype ?? "generic",
        prompt_extraction: draft.prompts?.extraction ?? "",
        prompt_validation: draft.prompts?.validation ?? "",
      };
      draftPatterns = o.relationship_patterns ?? [];
      designRationale = d.rationale ?? null;
      designSampled = d.sampled ?? [];
      editingPackId = null;
      showPackCreator = true;
      draftGenerated = true;
      designMsg = "Draft ready below — review, edit, and save.";
    } catch {
      designError = true;
      designMsg = "Network error while generating the draft.";
    } finally {
      designing = false;
    }
  }

  async function savePack() {
    savingPack = true;
    setPackMsg(null);
    try {
      const body = buildPackBody();
      const url = editingPackId ? `${API_BASE}/domain-packs/${editingPackId}` : `${API_BASE}/domain-packs`;
      const res = await fetch(url, {
        method: editingPackId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPackMsg(d.message ?? `Could not save pack (HTTP ${res.status}).`, true);
        return;
      }
      const savedId = (d.pack?.id as string | undefined) ?? editingPackId;
      setPackMsg(editingPackId ? "Domain pack updated." : "Domain pack saved.");
      draftSavedNotice = "New domain pack saved — you can edit it later under Domain.";
      draftGenerated = true;
      resetPackForm();
      showPackCreator = false;
      await loadPacks();
      if (savedId) await selectPack(savedId);
      notifyUpdated();
    } catch {
      setPackMsg("Network error while saving pack.", true);
    } finally {
      savingPack = false;
    }
  }

  let lastDispatchedCanContinue: boolean | null = null;
  $: {
    // Honest gate: a pack is selected or a draft exists. Merely opening the creator
    // disclosure must not light up "Domain selected → Continue".
    const canContinue = Boolean(selectedPackId) || draftGenerated;
    if (canContinue !== lastDispatchedCanContinue) {
      lastDispatchedCanContinue = canContinue;
      dispatch("stepState", { canContinue });
    }
  }

  onMount(() => {
    loadPacks();
    loadStarterDocumentIds();
    loadGraphTargetStatus();
  });
</script>

{#if loading}
  <p class="muted" role="status">Loading domain packs…</p>
{:else if loadError}
  <BrutalErrorBanner title="Domain packs" message={loadError} />
  <div class="actions">
    {#if loadErrorAuth}
      <a class="btn btn-primary btn-sm" href="{DASHBOARD_BASE}/login">Sign in</a>
    {:else}
      <button type="button" class="btn btn-primary btn-sm" on:click={loadPacks}>Try again</button>
    {/if}
  </div>
{:else}
  <div class="wizard-panel" class:card={!embedded}>
    {#if !embedded}
      <h2 class="h2">Domain packs</h2>
    {/if}

    {#if embedded && wizardStep && !modelsReady}
      <div class="domain-routes-warning" role="status">
        Routes not configured — Graph Designer needs at least one chat route to generate a domain.
        <a href={withReturnTo(CONNECT_BASE + "/models", { kind: "pipeline-setup", step: wizardStep })}>Configure Models &amp; keys →</a>
      </div>
    {/if}

    {#if draftSavedNotice}
      <p class="domain-draft-notice" role="status">{draftSavedNotice}</p>
    {/if}

    {#if packMsg}
      <p class:err={packMsgError} class:notice={!packMsgError} role={packMsgError ? "alert" : "status"}>{packMsg}</p>
    {/if}

    <section class="domain-section-a" aria-labelledby="pack-picker-heading">
      <h3 id="pack-picker-heading" class="preview-sub">Use an existing pack</h3>
      <p class="field-hint">Built-in packs are ready to use. Select one for extraction previews and ingest runs.</p>

    {#if packs.length > 0}
        <ul class="packs">
          {#each packs as p (p.id)}
            <li class="pack" class:pack-selected={selectedPackId === p.id}>
              <label class="pack-select-label">
                <input
                  type="radio"
                  name="selected-domain-pack"
                  value={p.id}
                  checked={selectedPackId === p.id}
                  disabled={selectingPack}
                  on:change={() => selectPack(p.id)}
                />
                <span class="pack-main">
                  <span class="pack-title-row">
                    <span class="pack-title">{p.title}</span>
                    {#if p.is_builtin}
                      <span class="tag tag-builtin">Built-in</span>
                    {:else}
                      <span class="tag tag-custom">Custom</span>
                    {/if}
                  </span>
                  <code class="pack-slug">{p.slug}</code>
                  <span class="pack-onto">
                    {p.ontology.unit_noun} → {p.ontology.group_noun}{#if p.ontology.domains.length}; {p.ontology.domains.length} domains{/if}
                  </span>
                  {#if p.description}<span class="pack-desc">{p.description}</span>{/if}
                </span>
              </label>
              <details class="pack-overflow">
                <summary class="pack-overflow-trigger" aria-label="Pack actions for {p.title}">···</summary>
                <div class="pack-overflow-menu">
                  <button
                    type="button"
                    class="pack-overflow-item"
                    on:click={() => viewPack(p.id)}
                    disabled={loadingPackView && viewingPackId === p.id}
                  >
                    {viewingPackId === p.id && viewingPack ? "Hide" : "View"}
                  </button>
                  {#if !p.is_builtin}
                    <button
                      type="button"
                      class="pack-overflow-item"
                      on:click={() => startEditPack(p.id)}
                      disabled={loadingPackEdit}
                    >
                      Edit
                    </button>
                    <button type="button" class="pack-overflow-item pack-overflow-danger" on:click={() => deletePack(p)}>
                      Delete
                    </button>
                  {/if}
                </div>
              </details>
              {#if viewingPackId === p.id}
                <div class="pack-detail" role="region" aria-label="{p.title} details">
                  {#if loadingPackView}
                    <p class="muted">Loading details…</p>
                  {:else if viewingPack}
                    <ul class="pack-detail-list">
                      {#each packDetailLines(viewingPack) as line}
                        <li>{line}</li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              {/if}
            </li>
          {/each}
        </ul>
    {:else}
      <p class="muted">
        No domain packs yet — <a href="#design-new-heading">design one with AI below</a> or create a
        custom pack.
      </p>
    {/if}

      <details class="disclosure surreal-import-accordion">
        <summary>Import from SurrealDB</summary>
        <div class="surreal-schema-inner">
      <h3 id="surreal-schema-heading" class="visually-hidden">Import from SurrealDB</h3>
      <p class="field-hint">
        Already have a graph in Surreal (e.g. from SOPHIA or your own DEFINE TABLE scripts)? Discover tables and
        relation edges from your connected store, then create a matching domain pack for ingest.
      </p>
      {#if !surrealTargetReady}
        <p class="notice" role="status">
          Connect and test a SurrealDB graph store on the <strong>Graph store</strong> step first.
        </p>
      {:else}
        <div class="actions">
          <button
            type="button"
            class="btn btn-secondary"
            disabled={discoveringSchema}
            on:click={discoverSurrealSchema}
          >
            {discoveringSchema ? "Reading schema…" : "Discover schema from Surreal"}
          </button>
        </div>
      {/if}
      {#if schemaMsg}
        <p class:err={schemaError} class:notice={!schemaError} role={schemaError ? "alert" : "status"}>{schemaMsg}</p>
      {/if}
      {#if schemaWarnings.length > 0}
        <ul class="schema-warnings">
          {#each schemaWarnings as w}
            <li>{w}</li>
          {/each}
        </ul>
      {/if}
      {#if schemaTables.length > 0}
        <details class="disclosure" open>
          <summary>{schemaTables.length} Surreal tables discovered</summary>
          <ul class="schema-table-list">
            {#each schemaTables as t (t.name)}
              <li>
                <code>{t.name}</code>
                <span class="badge status-muted">{t.kind}</span>
                {#if t.count > 0}<span class="muted">{t.count.toLocaleString()} rows</span>{/if}
                {#if t.relation_in && t.relation_out}
                  <span class="muted">{t.relation_in} → {t.relation_out}</span>
                {/if}
              </li>
            {/each}
          </ul>
        </details>
        <form class="form schema-mapping" on:submit|preventDefault={importSurrealSchema}>
          <div class="row">
            <label class="field">
              <span class="field-label">Pack title</span>
              <input class="input" type="text" bind:value={schemaImportTitle} required />
            </label>
            <label class="field">
              <span class="field-label">Slug</span>
              <input class="input" type="text" bind:value={schemaImportSlug} required />
            </label>
          </div>
          <div class="row">
            <label class="field">
              <span class="field-label">Unit table</span>
              <input class="input" type="text" bind:value={schemaMapping.unit_table} required />
            </label>
            <label class="field">
              <span class="field-label">Group table</span>
              <input class="input" type="text" bind:value={schemaMapping.group_table} required />
            </label>
          </div>
          <div class="row">
            <label class="field">
              <span class="field-label">Source table</span>
              <input class="input" type="text" bind:value={schemaMapping.source_table} />
            </label>
            <label class="field">
              <span class="field-label">Passage table</span>
              <input class="input" type="text" bind:value={schemaMapping.passage_table} />
            </label>
            <label class="field">
              <span class="field-label">Part-of edge</span>
              <input class="input" type="text" bind:value={schemaMapping.part_of_edge} />
            </label>
          </div>
          <label class="field">
            <span class="field-label">Relation edges (comma-separated)</span>
            <input
              class="input"
              type="text"
              value={schemaMapping.relation_edges.join(", ")}
              on:input={(e) => {
                schemaMapping = {
                  ...schemaMapping,
                  relation_edges: csvList(e.currentTarget.value),
                };
              }}
            />
          </label>
          <div class="actions">
            <button type="submit" class="btn btn-primary" disabled={importingSchema}>
              {importingSchema ? "Saving…" : "Save as domain pack"}
            </button>
            <button type="button" class="btn btn-secondary" on:click={useSchemaInEditor}>
              Edit in pack editor first
            </button>
          </div>
        </form>
      {/if}
        </div>
      </details>
    </section>

    <hr class="domain-section-divider" />

    <section class="domain-section-b" aria-labelledby="design-new-heading">
      <h3 id="design-new-heading" class="preview-sub">Or design a new domain</h3>

    <ConnectDomainTemplateSelector
      currentValue={designIntent}
      intentAnchor={designIntentEl ?? null}
      on:select={(e) => onTemplateSelect(e.detail)}
    />

    <div class="designer">
      <h3 class="designer-title">Design with AI</h3>
      <p class="field-hint">
        Describe what your graph should capture and we'll draft an ontology from your intent and a sample of your
        documents. Load the <a href={FIRST_GRAPH_ONBOARDING_DOC_HREF}>starter corpus</a> first for best results.
      </p>
      {#if starterDocumentIds.length > 0}
        <p class="field-hint">Using {starterDocumentIds.length} starter document(s) as the design sample.</p>
      {/if}
      <label class="field">
        <span class="field-label">What should this graph capture?</span>
        <textarea
          class="input"
          rows="3"
          bind:this={designIntentEl}
          bind:value={designIntent}
          placeholder="e.g. Capture legal holdings from case law and how later cases affirm, distinguish, or overrule earlier ones."
        ></textarea>
      </label>
      <div class="actions">
        <button type="button" class="btn btn-secondary" on:click={useSuggestedIntent}>
          Use suggested first-graph intent
        </button>
      </div>
      <label class="field">
        <span class="field-label">Domain name (optional)</span>
        <input class="input" type="text" bind:value={designDomain} placeholder="e.g. case law, clinical trials, product specs" />
      </label>
      {#if designMsg}<p class:err={designError} class:notice={!designError} role={designError ? "alert" : "status"}>{designMsg}</p>{/if}
      {#if designSampled.length > 0}
        <p class="field-hint">Sampled: {designSampled.join(", ")}</p>
      {/if}
      {#if designRationale}<p class="rationale">{designRationale}</p>{/if}
      <div class="actions">
        <button type="button" class="btn btn-primary" on:click={designPack} disabled={designing}>
          {designing ? "Designing…" : "Generate draft"}
        </button>
      </div>
    </div>

    <details class="disclosure" bind:open={showPackCreator}>
      <summary>{editingPackId ? "Edit custom domain pack" : "Create a custom domain pack (advanced)"}</summary>
      <form class="form" on:submit|preventDefault={savePack}>
        <div class="row">
          <label class="field">
            <span class="field-label">Slug (kebab-case)</span>
            <input
              class="input"
              type="text"
              bind:value={np.slug}
              placeholder="legal-cases"
              required
              readonly={Boolean(editingPackId)}
              aria-readonly={Boolean(editingPackId)}
            />
            {#if editingPackId}
              <span class="field-hint">Slug is fixed after creation. Duplicate by saving under a new slug.</span>
            {/if}
          </label>
          <label class="field">
            <span class="field-label">Title</span>
            <input class="input" type="text" bind:value={np.title} placeholder="Legal cases" required />
          </label>
        </div>
        <label class="field">
          <span class="field-label">Description</span>
          <input class="input" type="text" bind:value={np.description} />
        </label>
        <div class="row">
          <label class="field">
            <span class="field-label">Unit noun</span>
            <input class="input" type="text" bind:value={np.unit_noun} placeholder="holding" />
          </label>
          <label class="field">
            <span class="field-label">Group noun</span>
            <input class="input" type="text" bind:value={np.group_noun} placeholder="case" />
          </label>
        </div>
        <label class="field">
          <span class="field-label">Domains / taxonomy (comma-separated, optional)</span>
          <input class="input" type="text" bind:value={np.domains} placeholder="contract, tort, criminal" />
        </label>
        <label class="field">
          <span class="field-label">Unit types (comma-separated)</span>
          <input class="input" type="text" bind:value={np.unit_types} />
        </label>
        <label class="field">
          <span class="field-label">Relation types (comma-separated)</span>
          <input class="input" type="text" bind:value={np.relation_types} />
          <span class="field-hint">Each becomes a graph edge name.</span>
        </label>
        <label class="field">
          <span class="field-label">Group roles (comma-separated)</span>
          <input class="input" type="text" bind:value={np.group_roles} />
        </label>
        <label class="field">
          <span class="field-label">Pack archetype</span>
          <select class="input" bind:value={np.archetype}>
            <option value="generic">Generic — balanced defaults</option>
            <option value="argumentative">Argumentative — claims, discourse relations</option>
            <option value="factual">Factual — reference, low inference</option>
            <option value="procedural">Procedural — SOPs, obligations</option>
            <option value="product_docs">Product docs — APIs, specs</option>
          </select>
        </label>
        <details class="field">
          <summary class="field-label">Stage prompts (optional overrides)</summary>
          <p class="field-hint">Use placeholders: {"{unit_noun}"}, {"{pack_title}"}, {"{unit_types}"}.</p>
          <label class="field">
            <span class="field-label">Extraction prompt</span>
            <textarea class="input" rows="3" bind:value={np.prompt_extraction}></textarea>
          </label>
          <label class="field">
            <span class="field-label">Validation prompt</span>
            <textarea class="input" rows="3" bind:value={np.prompt_validation}></textarea>
          </label>
        </details>
        <label class="field">
          <span class="field-label">Schema mode</span>
          <select class="input" bind:value={np.schema_mode}>
            <option value="guided">Guided — prefer declared types, allow justified additions</option>
            <option value="strict">Strict — only declared types/relations</option>
            <option value="open">Open — discover types from the corpus</option>
          </select>
        </label>
        {#if draftPatterns.length > 0}
          <div class="field">
            <span class="field-label">Relationship patterns (from the draft)</span>
            <ul class="patterns">
              {#each draftPatterns as p}
                <li><code>{p.from_unit_type}</code> —{p.relation}→ <code>{p.to_unit_type}</code></li>
              {/each}
            </ul>
            <span class="field-hint">These ground how units connect. Saved with the pack.</span>
          </div>
        {/if}
        <div class="row">
          <label class="field">
            <span class="field-label">Unit table</span>
            <input class="input" type="text" bind:value={np.unit_table} />
          </label>
          <label class="field">
            <span class="field-label">Group table</span>
            <input class="input" type="text" bind:value={np.group_table} />
          </label>
        </div>
        <details class="source-text-mapping">
          <summary class="field-label">Source text mapping (BYO Surreal)</summary>
          <p class="field-hint">
            When full text lives in a passage table (not on source records), set table and field names here so
            graph scans and re-validation can resolve source content.
          </p>
          <div class="row">
            <label class="field">
              <span class="field-label">Source table</span>
              <input class="input" type="text" bind:value={np.source_table} />
            </label>
            <label class="field">
              <span class="field-label">Passage table</span>
              <input class="input" type="text" bind:value={np.passage_table} />
            </label>
          </div>
          <div class="row">
            <label class="field">
              <span class="field-label">Source text field (optional)</span>
              <input class="input" type="text" bind:value={np.source_text_field} placeholder="text" />
            </label>
            <label class="field">
              <span class="field-label">Passage text field (optional)</span>
              <input class="input" type="text" bind:value={np.passage_text_field} placeholder="text" />
            </label>
            <label class="field">
              <span class="field-label">Passage → source field (optional)</span>
              <input class="input" type="text" bind:value={np.passage_source_field} placeholder="source" />
            </label>
          </div>
        </details>
        <div class="row">
          <label class="field">
            <span class="field-label">Quality preset</span>
            <select class="input" bind:value={np.quality_preset}>
              <option value="production">Production — validate, remediate, higher chunk cap (default)</option>
              <option value="starter">Demo (Starter) — faster, reduced coverage</option>
            </select>
            {#if np.quality_preset === "starter"}
              <span class="field-hint err">Starter reduces chunk coverage and skips some production gates — not for agent-facing graphs.</span>
            {/if}
          </label>
          <label class="field checkbox-field">
            <input type="checkbox" bind:checked={np.cross_model_validation} />
            <span class="field-label">Cross-model validation (validator ≠ extractor when routes allow)</span>
          </label>
        </div>
        <div class="row">
          <label class="field">
            <span class="field-label">Embedding model</span>
            <input
              class="input"
              type="text"
              bind:value={np.embedding_model}
              disabled={Boolean(embeddingLock)}
              aria-describedby="embedding-lock-hint"
            />
          </label>
          <label class="field">
            <span class="field-label">Embedding dimensions</span>
            <input
              class="input"
              type="number"
              bind:value={np.embedding_dimensions}
              disabled={Boolean(embeddingLock)}
              aria-describedby="embedding-lock-hint"
            />
          </label>
        </div>
        {#if embeddingLock}
          <p id="embedding-lock-hint" class="field-hint">
            This graph already has embeddings at {embeddingLock.dimensions} dimensions — change is blocked until
            re-embedding is available (see roadmap). Voyage is recommended for new graphs.
          </p>
        {:else}
          <p id="embedding-lock-hint" class="field-hint">
            Pick dimensions before the first embed; the graph locks to that vector size afterward. Voyage models
            support 256–2048d (default 1024).
          </p>
        {/if}
        {#if packMsg && showPackCreator}<p class:err={packMsgError} class:notice={!packMsgError} role={packMsgError ? "alert" : "status"}>{packMsg}</p>{/if}
        <div class="actions">
          {#if editingPackId}
            <button type="button" class="btn btn-secondary" on:click={() => { resetPackForm(); showPackCreator = false; }}>
              Cancel
            </button>
          {/if}
          <button type="submit" class="btn btn-primary" disabled={savingPack}>
            {savingPack ? "Saving…" : editingPackId ? "Update domain pack" : "Save domain pack"}
          </button>
        </div>
      </form>
    </details>
    </section>
  </div>
{/if}

<style>
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>

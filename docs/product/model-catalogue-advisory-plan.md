# Model catalogue — open selection + suitability & cost advisory plan

**Status:** Plan (not built) · decided by product owner 2026-06-13
**Owner:** Allotment Technology Ltd
**Last reviewed:** 2026-06-13
**Related:** [CONNECT-PRODUCT.md](./CONNECT-PRODUCT.md) · [CONNECT-EXTRACTION-MAP.md](./CONNECT-EXTRACTION-MAP.md) · [database-strategy-roadmap.md](../infra/database-strategy-roadmap.md) · [model-catalog-ingestion.md](../reference/model-catalog-ingestion.md) · [catalog-governance.md](../reference/catalog-governance.md)

> **One-paragraph summary:** Today the dashboard steers users toward a handful of providers via a hand-curated per-stage pick list, while a richer 145-model catalogue (capabilities, dimensions, pricing) and a legacy hardcoded list drift alongside it. This plan makes the **catalogue itself do the advisory work**: any connected provider's models are selectable (plus free-text), each carrying a *derived* suitability verdict and cost per stage — advice layered on, never gating (the one hard guard is embedding, both directions). It is **provider-neutral by principle** (no Anthropic or any-provider bias; users can filter by jurisdiction / processing region) and kept **broad and current** by scheduled, provider-agnostic discovery that auto-adds new models and removes deprecated ones. It is built behind a store-agnostic catalogue repository so it ships before — and consolidates onto — the Neon→replacement Postgres migration, and is delivered by parallel, model-tiered agents with UI/UX as a first-class workstream.

> **Guiding principle — provider equality.** Restormel treats providers and models from everywhere in the world on equal terms: no provider — Anthropic included — gets ranked, defaulted, or sourced with privilege. Ordering is by derived suitability + cost + the user's own filters, never provider identity. Users who want to use only providers/models from a chosen region (e.g. EU-only, non-US) can filter the catalogue to achieve it (§3.8).

This plan grew out of a self-hosting-inference investigation (run ingestion on Ollama/vLLM to cut API cost). The conclusion there was **not to self-host** — cheap OpenAI-compatible APIs (DeepSeek/gpt-oss) + Voyage embeddings already cut cost ~90% with no infra, and a 24/7 GPU never beats per-token at dogfood volume. The real opportunity is the catalogue, which is what this plan covers.

### Delivery principles (this plan is executed, not just specced)
- **Parallel, multi-discipline agents.** Workstreams run concurrently, each owned by an agent matched to its complexity — model tier and thinking budget chosen per §8, never one-size-fits-all.
- **UI/UX is a first-class workstream, throughout.** Every user-facing surface (stage pickers, suitability badges, cost, the embedding dimension-lock, aggregator cross-model hints) is designed before it is built and signed off after; no user-facing change ships without design review (§3.7, §8).
- **Orchestrated fan-out, gated integration.** A dedicated **orchestrator** agent owns the dependency graph and assignment; a dedicated **merge & deploy** agent gates integration on per-PR review + security verdicts and drives the Coolify deploy — never merging before the dispatched verdict lands.
- **Skilled and self-extending.** Each lane is provisioned with the skills suited to its work, and every agent can author new skills (`skill-creator`) when it hits a reusable gap; the orchestrator curates the shared library (§8.4).

---

## 1. Decisions (locked)

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | Source of truth | **Consolidate to one catalogue — on the replacement Postgres, not Neon** | Three drifting sources today. Tie consolidation to the [database-strategy-roadmap.md](../infra/database-strategy-roadmap.md) migration; build behind a store-agnostic repo so it ships first and snaps on later. |
| D2 | Selectable scope | **Catalogue + free-text** | Every catalogue model for a connected provider is selectable and shown rich; any other id is typeable, flagged "unknown suitability". |
| D3 | Guard strength | **Embedding hard (both directions); chat advisory** | Embedding stage rejects non-embedding models and chat stages reject embedding-only models. Chat-stage fit (structured output, cross-model family) warns but never blocks. |
| D4 | Surfaces | **General Keys model-binding layer** | Implement once at the binding layer so Connect ingestion, Verify, Retrieve, and gateway routes inherit it. Models-browser columns and live provider `/models` fetch are deferred. |
| D5 | Free-text × policy | **Free-text auto-registers as an `unverified` catalogue row** | `model_allowlist` policy requires ids to exist in the live catalogue; a policy-exempt free-text model would be unreferenceable (governance hole) and a second code path. Auto-register reuses the existing `registry` binding-kind mechanism; mark `lifecycle: unverified`, `suitability: unknown`. |
| D6 | Aggregator providers | **Together and Aizolo are first-class; cross-model resolves the *underlying* family** | A single aggregator key fronts many model families, so a one-key user can still meet the judge≠extractor cross-model requirement. The suitability engine must compare underlying families, not the aggregator provider name. Existing handling: `together-ingest-gateway.ts`, `AIZOLO_VENDOR_MODEL_IDS` / `aizoloCatalogModelId`. |
| D7 | Provider equality + geo filter | **Neutral ranking; catalogue filterable by jurisdiction / processing region** | Restormel principle: no Anthropic (or any) bias in defaults, ranking, or sourcing. Catalogue carries a jurisdiction/region facet; users can restrict selection to chosen regions (e.g. EU-only, exclude US/CN). Aggregators are tagged by *processing* region, not the underlying vendor's origin (§3.8). |
| D8 | Coverage + currency | **Broad provider-agnostic discovery; scheduled auto-refresh; deprecations auto-removed** | A neutral catalogue must go far and wide (all providers + regions, including via aggregator listings) and stay current automatically: scheduled discovery adds and enriches new models and flips deprecated→retired (auto-hidden), with a periodic review pass. Breadth is itself part of neutrality (§3.9). |

---

## 2. Current state (what exists, what drifts)

**Three parallel "model truths":**

1. **`DEFAULT_MODEL_CATALOG`** ([packages/contracts/src/providers.ts](../../packages/contracts/src/providers.ts)) — hardcoded per-provider id lists, no metadata. **Confirmed zero source consumers** in the repo (likely only live via the published `@restormel/keys` npm package). Effectively legacy.
2. **The rich catalogue** — `apps/dashboard/data/model-catalog-seed.json` (145 models) → Neon `models` / `provider_model_variants` (see [model-catalog-ingestion.md](../reference/model-catalog-ingestion.md)). Carries `capabilities` (`ingestion_extraction`, `ingestion_validation`, `embedding`, `ingestion_embedding`…), `supportsStructuredOutput`, `supportsTools`, `modalities`, `editorialSummary`, `pricingRef`. This is what `GET /api/models` and the Models browser read.
3. **`INGEST_STAGE_MODEL_GUIDANCE`** ([apps/dashboard/src/lib/server/connect/model-guidance.ts](../../apps/dashboard/src/lib/server/connect/model-guidance.ts)) — a hand-curated ~20-model pick list per stage, with `production`/`economy` tiers and cross-model logic.

**The "steering" is source 3, not the contract lists.** `buildCrossModelProductionChain` picks `recs[0]` off the curated list; connect a provider it does not cover and you get *"No recommended model for your connected providers"* — a dead-end rather than open selection with advice. Providers themselves are already broad: 12 BYOK providers exist (vertex, anthropic, openai, groq, mistral, deepseek, together, openrouter, aizolo, cohere, perplexity, voyage). Two of these — **Together** and **Aizolo** — are *aggregators*: one key fronts many underlying model families (Together maps catalogue ids to upstream `provider/model` strings in `together-ingest-gateway.ts`; Aizolo encodes the vendor in the id, e.g. `aizolo-openai-…`, `aizolo-claude-…`, `aizolo-deepseek-…`). They are the practical way a solo user meets the cross-model ingestion requirement without managing two or three separate provider accounts.

**Already present and reusable:**
- Per-model `capabilities` tags + `supportsStructuredOutput` + `modalities` → enough to *derive* suitability instead of curating it.
- Per-model pricing via `pricingRef` → keys `estimateCost`; stage token estimates in [packages/connect-core/src/ingest/plan.ts](../../packages/connect-core/src/ingest/plan.ts) → enough for a projected `$/run`.
- Embedding dimension lock: `getWorkspaceEmbeddingLock` reads the **actual** stored vector length from the graph, and `EMBEDDING_MODEL_SPECS` knows each model's supported (matryoshka) dimensions ([apps/dashboard/src/lib/server/connect/embedding-contract.ts](../../apps/dashboard/src/lib/server/connect/embedding-contract.ts)).
- `registry` binding kind already stores arbitrary `model_id` strings with no FK (the free-text mechanism — see [model-catalog-ingestion.md](../reference/model-catalog-ingestion.md) "Project model index").

**Integration model "discovery" is weak today:** `GET /keys/dashboard/api/integrations/[id]/models` infers model ids from observed `usage_aggregates`, not from a real catalogue or provider list.

---

## 3. Target architecture

### 3.1 `CatalogueRepository` interface (the decoupling keystone)
All new advisory/selection code depends on an interface — `listModelsForProvider`, `getModel`, `capabilitiesFor`, `pricingFor`, `variantsFor`, `registerUnverifiedModel` — with a Neon-backed implementation today and a replacement-Postgres implementation later. **No new code calls `getSql()` directly.** This is what lets §3.2–§3.5 ship before the DB migration without deepening Neon coupling, then snap onto the replacement (D1).

### 3.2 Derived suitability — per `(model, stage)`
Replaces the hand-curated list as the *source* of advice (curated rationales become editorial overlays, not an allowlist):

| Verdict | Rule | Behaviour |
|---|---|---|
| `wrong_type` | embedding stage + model not embedding-capable, **or** chat stage + embedding-only model | **Hard block** (both directions, D3) |
| `recommended` | stage capability tag present + stage requirements met | Sorted first, positive badge |
| `usable` | text-generation capable, no disqualifier | Allowed, neutral |
| `caveat` | chat-capable but a soft requirement missing (extraction without structured output; same-family validation) | Allowed, **warn + rationale** |
| `unknown` | free-text model not yet enriched | Allowed, "no fit/cost data" |

"Embedding-only" = has an embedding capability and **no** chat/text-generation capability. Correctness of the two-way guard depends on the capability tags being clean (see §6 QA).

### 3.3 Cost
Per model/variant: `pricingRef` → keys `estimateCost` → `$/1M` input+output, plus a projected **`$/run`** at the stage picker using the `plan.ts` token estimates. Models without pricing show **"cost unknown"**, never `$0` (the `$0` failure mode documented in [llm-token-usd-rates.ts](../../packages/connect-core/src/ingest/llm-token-usd-rates.ts) must not reach the UI).

### 3.4 Open selection (not gating)
For a connected provider, the dropdown lists **all** catalogue models for that provider, each with a suitability badge + cost, sorted recommended-first — nothing filtered out except the embedding hard-guard direction. A free-text field accepts any id and, per D5, **auto-registers it as an `unverified` catalogue row** (provenance `user-added`) so policy, cost, and suitability stay uniform.

### 3.5 Embedding overlay (the one stage-specific piece)
- Surface `getWorkspaceEmbeddingLock` in the embedding binding context, e.g. *"This graph is embedded at 1024d with voyage-3 (12,403 units). Only 1024d-capable models are selectable until you re-embed."*
- Lock the embedding dropdown to dimension-compatible models (`modelSupportsDimensions`) once a lock exists.
- **Fix the Surreal `DIMENSION 768` hardcode** in [packages/graphrag-core/src/surreal-retrieval-enhancements.ts](../../packages/graphrag-core/src/surreal-retrieval-enhancements.ts) (line ~201) — derive the HNSW index dimension from the pack/lock target (Voyage default is 1024d; OpenAI 1536/3072; Neo4j default 1536). Existing 768 Surreal graphs need a reindex; coordinate with the re-embed roadmap item.

### 3.6 Aggregator (gateway) providers — Together & Aizolo
Aggregators are first-class in selection and especially valuable for cross-model ingestion: one key gives access to multiple underlying model families, so a single-key workspace can put the extractor on one family and the validator/judge on another (judge family ≠ extractor family) without a second provider account.

Requirements for the suitability engine:
- **Resolve the underlying family per aggregator-fronted model**, not the aggregator provider name. Together's upstream is the `provider/model` string in `TOGETHER_GATEWAY_CHAT_MODELS`; Aizolo's vendor is encoded in the catalogue id via `aizoloCatalogModelId`. Store/derive this as the model's `underlyingFamily` so the cross-model `caveat` rule (§3.2) compares families correctly.
- **Treat an aggregator key as satisfying multiple stages** when its fronted models span ≥2 families (the existing `isIngestProviderSatisfied` / `resolveIngestRecommendationProvider` logic already does this for Together; generalise it to Aizolo).
- **Surface the benefit**: when only an aggregator key is connected, the embedding/validation pickers should *highlight* the cross-model-capable pairings rather than emit the single-provider `sameProviderFallback` warning.
- Aggregator embedding models (e.g. Together's `multilingual-e5-large` @1024d) participate in the §3.5 dimension lock like any other embedding model.

### 3.7 UX & UI surfaces (designed, not incidental)
The dashboard is neo-brutalist (skill `restormel-neu-brutalist-ui`); all new surfaces use those primitives and tokens. Touchpoints, each with the states it must design for:
- **Stage model picker** — every catalogue model for the connected provider, each row with a suitability badge + cost (`$/1M` and projected `$/run`), recommended-first; free-text entry with an explicit `unverified` treatment.
- **Suitability badge system** — five states (`recommended` / `usable` / `caveat` / `unknown` / `wrong_type`-disabled), accessible and distinct, with a one-line rationale on expand; `caveat` names the soft-requirement missed; `wrong_type` is disabled with its reason.
- **Cost display** — `$/1M` + projected `$/run`, plus the "cost unknown" state (never `$0`).
- **Embedding dimension-lock panel** — the headline graph fact (model + dimensions + embedded unit count) and the "only Nd-capable models selectable until re-embed" lock; clear empty (no vectors yet) vs locked states.
- **Aggregator cross-model hint** — when only a Together/Aizolo key is connected, surface the cross-model-capable pairing instead of the single-provider warning (§3.6).
- **Region / jurisdiction filter** — a picker-level facet to restrict options to chosen provider jurisdictions / processing regions (e.g. EU-only); when a filter empties a stage's options, say so and why (§3.8) — never silently substitute an excluded provider.

Provider rows render in a neutral order (suitability + cost), with no provider visually privileged. Design references: `restormel-neu-brutalist-ui`, `restormel-product-flow-diagrams`, and the existing `docs/reviews/connect-wizard-ux-review.md` kit. Copy and usability quality are owned by the design agent (§8).

### 3.8 Provider neutrality & geographic filtering
A first-class expression of the provider-equality principle.
- **Neutral ranking.** The suitability engine and default pickers rank by `(verdict, cost, user filters)` only — never by provider identity. No provider is hardcoded above another; the legacy curated picks are retired as the *source* of ranking (§3.2). Neutrality is QA-asserted (§6).
- **Jurisdiction / region facet.** Each provider (and, where it differs, each variant) carries `homeJurisdiction` (vendor's legal home — e.g. US, EU/FR, UK, CA, CN) and `processingRegion(s)` (where inference actually runs, including any operator-selectable regions). Sourced with equal authority across all providers (§8.4).
- **Aggregator nuance.** For Together/Aizolo the region that matters for data sovereignty is the **aggregator's processing region**, not the underlying vendor's origin — a US aggregator fronting a French model still processes in the US. Tag accordingly so the filter never gives a false sovereignty guarantee.
- **User filter.** Users can restrict the selectable catalogue to chosen jurisdictions / processing regions (e.g. "EU processing only", "exclude US and CN"). The filter composes with suitability + cost; emptying a stage surfaces honestly. Ties into the data-residency goals in [database-strategy-roadmap.md](../infra/database-strategy-roadmap.md).

### 3.9 Catalogue coverage & currency (broad and self-maintaining)
Neutrality requires *coverage*: a region filter or a "best model for this stage" badge is only honest if the catalogue actually knows the field. So the catalogue must go far and wide and stay current automatically.
- **Breadth ("far and wide").** Discovery is provider-agnostic and global — all 12 BYOK providers plus active scanning for new providers/models, deliberately including non-US and regional labs (Mistral EU, DeepSeek/Qwen/Kimi CN, Cohere CA, and emerging providers) so the region filter (§3.8) has real options. Aggregator listings (OpenRouter, Together, Aizolo) are high-leverage breadth sources — they already enumerate hundreds of models across providers.
- **Sourcing.** Per-provider authoritative sources (provider model APIs / pricing / docs) for *every* provider, plus aggregator catalogues for reach. Each discovered model is enriched with capabilities, pricing, `homeJurisdiction` / `processingRegion`, and the inputs the suitability engine needs (§3.2).
- **Automated refresh.** Build on the existing scheduled action (`model-catalog-weekly.yml`, daily) and `seed:catalog:from-keys`, and promote the deferred external-signals path (`catalog-external-signals.ts`, gated today by `RESTORMEL_CATALOG_EXTERNAL_SIGNALS`) into the live pipeline. The job: discover → enrich → upsert; detect deprecations and set `lifecycleState` / `deprecationDate` / `retirementDate`; retired and past-retirement models are auto-hidden by the existing viability filter; `replacementModelId` gives existing bindings a migration hint. Never fabricate `sourceLastVerifiedAt`.
- **Review cadence.** Automated daily refresh **plus** a periodic review pass (a scheduled cloud agent on the data/catalogue lane) that verifies new entries, sanity-checks pricing and region tags, and approves lifecycle transitions. Deprecated → removed from selection automatically.
- **Guardrails.** Auto-discovered models land `active` but `provenance: discovered` with suitability `derived-unreviewed` until the review pass; missing pricing or region → flagged `unverified` (same treatment as free-text, §3.4) — never a silent `$0` or a silent sovereignty guarantee.
- **Coverage is part of neutrality.** QA asserts representative current coverage per provider and per region — a catalogue that only deeply tracks Anthropic/OpenAI is biased even when ranking is neutral (§6).

#### 3.9.1 Per-provider sourcing
One **source adapter** per provider (model list → pricing → region → capabilities), all writing through the `CatalogueRepository` (§3.1). Adding a provider = adding an adapter, never special-casing. **Endpoints, pricing, and regions below are training-cutoff approximations — the adapter author verifies each at build;** where an API omits pricing/capabilities, enrich from the provider's docs; where no machine-readable list exists, maintain a curated source behind the review gate (§3.9.2).

| Provider | Model list | Pricing | Home · processing region | Notes |
|---|---|---|---|---|
| OpenAI | `GET /v1/models` | docs (pricing page) | US · US | list omits pricing/caps → enrich from docs |
| Anthropic | Models API `GET /v1/models` | **`claude-api` skill** / docs | US · US | display names in API; pricing not in API |
| Google (`vertex`) | AI Studio `…/v1beta/models` (or Vertex `models.list`) | Vertex GenAI pricing page | US · **selectable** (Vertex regional endpoints) | token limits + methods in API |
| Groq | `…/openai/v1/models` (OpenAI-compat) | pricing page | US · US | fast open-weights host |
| Mistral | `GET /v1/models` | pricing page | **EU/FR · EU** | EU-hosted → key option for the EU filter |
| DeepSeek | `GET /models` (OpenAI-compat) | api-docs pricing (already in repo) | **CN · CN** | key option for CN include/exclude |
| Together | `GET /v1/models` (**returns pricing**) | same response | US · US (aggregator) | breadth + pricing in one call |
| OpenRouter | `GET /api/v1/models` (**id, pricing, context, top_provider, architecture**) | same response | US · **routed** (aggregator) | richest single breadth source; processing = routed provider |
| Aizolo | OpenAI-compat `…/v1/models` + repo `AIZOLO_VENDOR_MODEL_IDS` | vendor passthrough / docs | **verify · verify** (aggregator) | underlying vendor encoded in id; confirm HQ/region |
| Cohere | `GET /v1/models` | pricing page | CA · multi-cloud (configurable) | |
| Perplexity | docs model list (no clean `/models` historically) | docs | US · US | may need a docs-sourced list |
| Voyage | docs model list | pricing page | US · US | embeddings; dims already in `EMBEDDING_MODEL_SPECS` |

**Aggregator breadth + reconciliation.** Seed breadth from OpenRouter + Together `/models` (hundreds of models across providers, with pricing), then **reconcile to canonical per-provider model ids** so the same underlying model isn't duplicated across direct and aggregator routes — it becomes one canonical `models` row with multiple `provider_model_variants` (the existing shape). This preserves neutrality (one canonical model, many routes) and prevents double-counting.

#### 3.9.2 Refresh cadence & lifecycle rules
| Data | Cadence | Rule |
|---|---|---|
| Model lists + API-provided pricing (Together, OpenRouter, any `/models` with pricing) | **Daily** (existing action) | Discover → enrich → upsert |
| Docs-sourced pricing / capabilities (most direct providers) | **Weekly** | Stage diffs as `pending-review`; the review agent approves — never silently overwrite a verified price with a scrape |
| `homeJurisdiction` / `processingRegion` map | **Quarterly** or on provider change | Curated, governance-gated, **never auto-trusted**; aggregator processing region = the aggregator's (or "routed") |
| Deprecation / retirement | **Daily detection** | Absent from a provider's list for **N consecutive runs** (confirmation window, e.g. 3) → `deprecated` + `deprecationDate`; provider-announced retirement → `retirementDate` + `replacementModelId`; viability filter auto-hides. **Never retire on a single transient API failure.** |
| New-model landing | On discovery | `active` + `provenance: discovered` + `suitability: derived-unreviewed`; `unverified` if pricing/region missing; promoted by the review agent |

---

## 4. Phasing vs the DB migration

| Phase | DB-migration dependency | Work |
|---|---|---|
| **0 — ship now** | None | `CatalogueRepository` interface over current Neon; derived-suitability + cost module; wire into general binding API/UI as advisory; embedding hard-guard + dimension-lock surfacing; Surreal dimension fix; capability/pricing QA backfill on the 145 seed models |
| **1 — rides the migration** | Yes | Swap repo implementation to the replacement Postgres; retire `DEFAULT_MODEL_CATALOG` + the curated allowlist; repoint the public canonical-catalog feed to the single source. **Single source achieved.** |
| **2 — deferred** | None | Models-browser suitability/cost columns; live provider `/models` enumeration *at the picker* (per-request) |
| **Ongoing — freshness** | No (behind the repo) | Provider-agnostic scheduled discovery + enrichment + lifecycle transitions; periodic review agent; deprecated/retired auto-removed (§3.9). Builds on the existing daily catalogue action. |

---

## 5. Discovered issues to fix as part of this
- **Surreal HNSW `DIMENSION 768`** mismatch vs 1024/1536/3072 embedding lengths (§3.5).
- **Capability-tag hygiene:** embedding models must not carry chat capabilities (and vice-versa), or the two-way hard guard misfires.
- **`$0` cost display:** ensure "cost unknown" everywhere a `pricingRef` is missing.
- **Public canonical-catalog feed** (`/keys/docs/guides/canonical-catalog`, `keys-catalog-sync.md`) must keep reading the single source post-consolidation — do not fork it.

## 6. Risks
- **Enforcing the embedding guard can break existing bindings** if any current embedding route points at an untagged model. Enforce hard on **new** binds; **warn-and-audit** existing ones before flipping.
- **Suitability is only as good as the capability tags** — Phase 0 needs a QA pass over the 145 seed models before the guard goes hard.
- **Free-text registration must not let `unverified` rows masquerade as vetted** — surface lifecycle/provenance clearly wherever these models appear (binding UI, policy editor, cost views).
- **Aggregator family resolution must be correct or the cross-model guarantee is illusory** (§3.6) — if `underlyingFamily` is missing or wrong for a Together/Aizolo model, the judge≠extractor check can pass when both stages actually share a family. QA the family mapping alongside the §6 capability-tag pass.
- **Provider-bias creep** (§3.8) — neutral ranking must be *verified*: QA asserts that for a fixed input the picker order favours no provider (Anthropic included) and that no default privileges one vendor. `claude-api` is an Anthropic-model reference only; every other provider needs equally authoritative sourcing (§8.4), or the catalogue silently skews.
- **Region-metadata accuracy** — wrong `homeJurisdiction` / `processingRegion` tags (especially for aggregators) give false data-sovereignty guarantees; treat region tags as governance-critical and QA them like pricing.
- **Stale or drifting catalogue** (§3.9) — without the scheduled refresh + review, pricing/lifecycle drift and new models go missing, quietly re-biasing toward whatever was last hand-seeded. The refresh job and its review pass are load-bearing for both currency *and* neutrality; monitor the job and alert on failure. Auto-discovery also risks false entries (hallucinated ids, wrong pricing) — hence the `unverified` landing state + review gate.

## 7. Out of scope
Self-hosting / GPU inference (settled: cheap-API + Voyage embeddings); Models-browser column enrichment; live provider model fetch *at the picker* (per-request enumeration — note: scheduled **batch** discovery for catalogue freshness is **in** scope, §3.9); re-embedding tooling (separate roadmap item, only referenced by the dimension-lock).

---

## 8. Delivery — parallel multi-agent execution
Executed as a fan-out of specialised agents, not a single linear build, following the team's multi-agent orchestration and merge-after-review-verdict practices. Core principles: match model + thinking level to task complexity; keep UI/UX in the loop on every user-facing surface; orchestrate dependencies explicitly; gate integration behind review.

### 8.1 Agent roster
| Lane | Responsibility | Model · thinking | Skills / refs |
|---|---|---|---|
| **Orchestrator** | Owns the dependency graph, assigns work, sequences join points, tracks status across lanes | Opus · high | — |
| **Backend core** | `CatalogueRepository` interface; derived-suitability engine; cross-model + aggregator `underlyingFamily` resolution (the hard logic) | Opus · high→max | — |
| **Backend integration** | Wire suitability/cost into the binding API; free-text auto-register; `model_allowlist` interplay | Sonnet · medium-high | — |
| **Data / catalogue** | Capability-tag + pricing QA on the 145 seed models; aggregator family mapping; `$0`→"unknown" | Sonnet · medium (Haiku for rote) | `model-catalog-ingestion`, `catalog-governance` |
| **UI/UX design** | Design every §3.7 surface first; badge / cost / lock states; copy; sign off implementations | Fable (fallback: Opus · high — Fable currently unavailable) | `restormel-neu-brutalist-ui`, `restormel-product-flow-diagrams`, connect-wizard-ux-review |
| **Frontend** | Implement the Svelte components from the approved design | Sonnet · medium | `restormel-neu-brutalist-ui` |
| **Graph / embedding** | Surreal `DIMENSION` fix + dimension-lock data; reindex coordination | Sonnet/Opus · medium-high | — |
| **Security review** | Pre-PR high-risk pass (BYOK, encrypted keys, policy, free-text registration as an abuse vector) | Opus · high | `restormel-high-risk-security` |
| **Merge & deploy** | PR merge order; gate on per-PR review + security verdict; keep CI green; Coolify deploy | Sonnet/Opus · medium | merge-after-review-verdict, Coolify runbooks |

### 8.2 Parallelisation
- **Day-one parallel (no cross-deps):** UI/UX design, data/catalogue QA, and the graph/embedding Surreal fix all start immediately.
- **Long pole:** the Backend-core `CatalogueRepository` interface — it unblocks backend integration and, via the design's component contracts, frontend.
- **Join points (orchestrator-managed):** suitability engine ready → frontend binds real data; design sign-off → frontend is merge-eligible; capability QA complete → the embedding hard-guard flips from warn to block.
- **Serialised by design:** merge & deploy is a single integrator lane, gated on review/security verdicts; it never merges before the dispatched verdict lands.

### 8.3 Model & thinking tiering (a principle, not an afterthought)
Novel architecture and cross-model/aggregator resolution → **Opus, high/max** thinking. Mechanical wiring, CRUD, component implementation → **Sonnet, medium**. Rote data QA → **Sonnet/Haiku, low/medium**. Design, usability, copy → **Fable**. Don't spend max-thinking on rote work; don't under-resource the hard logic.

**Availability fallback (required).** Model assignments degrade gracefully: if the preferred tier is unavailable at delivery time, substitute the next-best *available* model at an **equal-or-higher** thinking budget — never silently drop a lane or under-resource it. Specifically, the **design lane falls back Fable → Opus (high thinking)** for design/usability/copy (Fable is currently unavailable); Sonnet is the floor for that lane, not the target. The orchestrator records the substitution so it's visible in delivery status.

### 8.4 Skills — provisioning & authoring
Every lane is provisioned with the skills suited to its work, and every agent can author new skills when it hits a reusable gap.

**Suitable existing skills per lane:**
- **Orchestrator** — `skill-creator` (mint + curate team skills); owns the shared skill library (dedupe, naming, promotion).
- **Backend core** — `restormel-keys-routing` (resolve/simulate, ingestion workload + stage keys), `restormel-keys-vs-platform` (repo-root vs platform mirror); `claude-api` as the authoritative reference **for Anthropic models only** — one of several per-provider sources, never the catalogue default.
- **Backend integration** — `restormel-keys-routing`, `code-review`, `verify`.
- **Data / catalogue** — governance refs `model-catalog-ingestion` + `catalog-governance`; authoritative per-provider sourcing for *every* provider (Anthropic via `claude-api`, plus equal-authority sources for OpenAI / Google / Together / DeepSeek / Mistral / Cohere / Groq / …); `schedule` for the recurring refresh/review agent; likely authors `restormel-catalogue-qa` and `restormel-catalogue-refresh` (below).
- **UI/UX design** — `restormel-neu-brutalist-ui`, `restormel-product-flow-diagrams`, `restormel-design-imagery`, Figma `figma-generate-design` / `figma-generate-library` / `figma-code-connect`, `canvas-design` for static mockups.
- **Frontend** — `restormel-neu-brutalist-ui`, `figma-code-connect` (design→Svelte mapping), `restormel-keys-vs-platform` (tokens), `verify` / `run`.
- **Graph / embedding** — `restormel-keys-routing` (ingestion stage), governance/runbook refs; likely authors an embedding-dimension-contract skill.
- **Security review** — `restormel-high-risk-security`, `security-review`.
- **Merge & deploy** — `code-review`, `verify`, `run`, Coolify runbooks; gated by merge-after-review-verdict.

**Authoring new skills (required capability).** Any agent that identifies a reusable, repeatable capability not covered above authors a skill via `skill-creator`, committed under the repo `skills/` directory following existing conventions (product-specific skills named `restormel-*`). New skills are shared across lanes immediately; the **orchestrator curates** (dedupe, naming, promoting one-offs to durable skills) so the library doesn't fragment. Candidate net-new skills this plan is likely to need:
- `restormel-model-suitability` — derive the §3.2 verdicts + aggregator `underlyingFamily` resolution consistently.
- `restormel-catalogue-qa` — the §6 capability-tag + pricing QA pass (embedding-only hygiene, `$0`→"unknown"), **provider-neutral cross-provider sourcing (no Anthropic bias)**, and `homeJurisdiction` / `processingRegion` tagging (§3.8).
- `restormel-catalogue-refresh` — the §3.9 scheduled discovery → enrich → lifecycle pipeline (provider-agnostic breadth incl. aggregator listings; deprecation/retirement handling), run on a schedule with the `unverified` landing state + review gate.
- `restormel-merge-deploy-gate` — the verdict-gated merge + Coolify deploy runbook as a repeatable skill.

---

## 9. Open dependencies
- **Replacement Postgres target & timing.** Phase 1 (single-source consolidation) rides the [database-strategy-roadmap.md](../infra/database-strategy-roadmap.md) migration; the destination store and its timing gate Phase 1. Phase 0 is deliberately independent of it.
- **Public canonical-catalog feed.** `/keys/docs/guides/canonical-catalog` + `keys-catalog-sync.md` must repoint to the single source at consolidation; confirm the feed's external consumers before the switch.
- **Re-embed tooling.** The §3.5 dimension-lock references it; the Surreal `DIMENSION` fix may strand existing 768-d graphs until re-embed exists — sequence with that roadmap item.
- **Catalogue metadata quality.** Derived suitability, the hard guard, neutrality, and the region filter all depend on clean capability / pricing / region tags; the Phase-0 QA pass (and the `restormel-catalogue-qa` skill) is a prerequisite, not a nice-to-have.

## 10. Definition of done
- Any connected provider's models are selectable for any stage, each showing a derived suitability verdict + cost; free-text models are accepted and auto-registered `unverified`.
- Embedding hard-blocks non-embedding models (and vice-versa); the embedding dimension-lock is surfaced and enforced; the Surreal index dimension is derived, not hardcoded.
- Ranking is provably provider-neutral (QA-asserted); users can filter by jurisdiction / processing region with honest empty states.
- Aggregator keys (Together / Aizolo) satisfy cross-model via underlying-family resolution.
- The catalogue is broad (representative current coverage per provider and region) and self-maintaining (scheduled discovery + review; deprecated auto-removed).
- One source of truth on the replacement Postgres; legacy lists retired; the public feed repointed.

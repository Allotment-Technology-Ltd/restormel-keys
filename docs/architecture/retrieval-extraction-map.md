---
title: Retrieval Extraction Map — @restormel/graphrag-core
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# Retrieval Extraction Map — `@restormel/graphrag-core`

**Phase 0 deliverable. Audit only — no code was changed to produce this document.**

Date: 2026-06-05
Branch: `release/connect-graph-pipeline-2026-06`
Author: extraction audit

---

## 0. Reconciliation with the plan document

The original Phase 0 prompt was written against the **SOPHIA** repository layout
(`src/lib/server/retrieval.ts`, `seedSetConstructor.ts`, …). Those paths **do not exist in
`restormel-keys`.** The *extract-and-move* half of the plan has already landed: the engine lives
in `packages/graphrag-core/src/`, the pass-specific packing lives in `packages/context-packs/src/`,
and Restormel Connect already consumes it.

| Plan assumption | Reality in this repo |
| --- | --- |
| Source at `src/lib/server/retrieval.ts` etc. | Lives in `packages/graphrag-core/src/retrieve-context.ts` etc. |
| `@restormel/graphrag-core` is "a stub" | Fully populated, 8 source files, ~2.8k LOC, tests, consumed by Connect |
| Engine still needs extracting from SOPHIA | Extract done; **decouple from philosophy is NOT done** |
| `RetrievalConfig` to be designed | Still absent — only `RetrievalOptions` / `RetrievalResult` exist |

So this map audits **the already-extracted package as it stands here**, and the remaining work it
documents is the *generalisation / decoupling* needed before Connect can drive the engine for
non-philosophy domains. Surreal `src/lib/server` references in the plan are out of scope.

---

## 1. Package file inventory

`packages/graphrag-core/src/` (line counts approximate):

| File | LOC | Role |
| --- | --- | --- |
| `ports.ts` | 25 | Injected port interfaces (`GraphStore`, `EmbeddingPort`, `OriginBucketResolver`, `GraphRagDeps`) |
| `hybrid-candidate-generation.ts` | 184 | Dense+lexical seed generation, RRF fusion, corpus-level detection |
| `kg-balance.ts` | 78 | Inquiry-time origin/domain balance multiplier |
| `surreal-retrieval-enhancements.ts` | 178 | Surreal-specific optional retrieval helpers (BM25, native graph, passage-grounded, taxonomy routing, index/event DDL) |
| `seed-set-constructor.ts` | 322 | MMR + role-quota + KG-balance seed selection |
| `retrieve-context.ts` | 1949 | The engine: `retrieveContext`, `retrieveContextFromSeed`, `buildContextBlock`, `formatThinkerContextBlock`, beam traversal, closure, enrichment |
| `empty-graph.ts` | 7 | `emptyGraphData()` helper (re-exports `GraphData`) |
| `index.ts` | 71 | Public barrel |

Sibling package consumed downstream of retrieval:

| File | Role |
| --- | --- |
| `packages/context-packs/src/contextPacks.ts` + `types.ts` | `buildPassSpecificContextPacks()` — analysis/critique/synthesis packing (own philosophy coupling) |

---

## 2. Per-file audit

### 2.1 `ports.ts` — **clean injection layer (no decoupling needed)**

**Exports:** `GraphStore`, `EmbeddingPort`, `OriginBucketResolver`, `RetrievalOriginBalanceKey`, `GraphRagDeps`.

**Consumed by:** every engine file (`store`/`embedder`), plus 10 Connect host files use `GraphStore`/`EmbeddingPort` as the integration seam:
- `apps/dashboard/src/lib/server/connect/surreal-graph-store.ts` (implements `GraphStore`)
- `…/connect/stage-route-generate.ts` (implements `EmbeddingPort`)
- `…/connect/{graph-writer,graph-explorer-service,graph-source-link-service,surreal-schema-introspect,surreal-graph-units-load,connect-source-text-resolve}.ts` (typed against `GraphStore`)
- `…/connect-v1/{retrieve-service,retrieval-mapper}.ts`

**Dependency categories:** none — this *is* the (a) infrastructure boundary. Already correct.

**Philosophy coupling:** none. `RetrievalOriginBalanceKey = "sep" | "gutenberg" | "other"` is corpus-origin
coupling (SEP = Stanford Encyclopedia of Philosophy, Gutenberg) but it is parameterised — the host
supplies `resolveOriginBucket`, and the ideal mix is data, not control flow. Keep as a *named default*, see §4.

---

### 2.2 `hybrid-candidate-generation.ts` — **mostly pure**

**Exports:** `detectCorpusLevelQuery`, `extractLexicalTerms`, `fuseHybridCandidates`, types `HybridCandidate`, `HybridFusionResult`.

**Consumed by:** `retrieve-context.ts` (all three); re-exported from `index.ts`; `__tests__/hybrid-candidate-generation.test.ts`.

**Dependencies:** none external.
- (c) pure utility: `normalize`, `uniq`, `rrf`, `termCoverage`, `diversifyBySource`, `fuseHybridCandidates`, `STOPWORDS`.

**Philosophy coupling (→ config):**
| Line | Construct | Note |
| --- | --- | --- |
| `46–56` | `CORPUS_LEVEL_SIGNALS` = `'across philosophy'`, `'across traditions'`, `'across thinkers'`, … | Corpus-overview trigger phrases |
| `100` | `knownPhrases` = `['public reason', 'epistemic injustice', 'non-identity problem']` | Hardcoded domain term boosts |

Everything else (quoted phrases, hyphenated terms, long-token, bigram extraction) is domain-agnostic.

---

### 2.3 `kg-balance.ts` — **infra + one domain import**

**Exports:** `IDEAL_RETRIEVAL_ORIGIN_FRACTIONS`, `RETRIEVAL_ORIGIN_BALANCE_STRENGTH`, `RETRIEVAL_DOMAIN_BALANCE_STRENGTH`, `isRetrievalKgBalanceEnabled`, `computeKgBalanceMultiplier`.

**Consumed by:** `retrieve-context.ts`, `seed-set-constructor.ts`; re-exported from `index.ts`; `__tests__/kg-balance.test.ts`.

**Dependencies:**
- (b) domain-coupled: `import type { PhilosophicalDomain } from "@restormel/contracts/domains"` (`L1`) — used only as a `string` (`L37`, `String(domain)` at `L69`). **Soft coupling; can become `string`.**
- (a) infrastructure: `process.env.RETRIEVAL_KG_BALANCE` (`L17`).
- (c) pure: `normalizeFractions`, the multiplier math.

**Philosophy coupling (→ config):**
| Line | Construct |
| --- | --- |
| `7–11` | `IDEAL_RETRIEVAL_ORIGIN_FRACTIONS` = `{ sep: 0.42, gutenberg: 0.33, other: 0.25 }` |
| `13–14` | balance strengths `0.95` / `0.85` |

---

### 2.4 `surreal-retrieval-enhancements.ts` — **infrastructure (schema-coupled)**

**Exports:** `isRetrievalBm25Enabled`, `isRetrievalNativeGraphEnabled`, `isRetrievalPassageGroundedEnabled`, `isRetrievalTaxonomyRoutingEnabled`, `isKgEnforcePassageOnAcceptEnabled`, `fetchBm25ClaimCandidates`, `fetchNativeGraphNeighbors`, `fetchPassageGroundedClaimIds`, `fetchTaxonomySeedClaimIds`, `ensureClaimSearchIndex`, `ensurePassageEmbeddingIndex`, `ensureClaimAcceptPassageEvent`.

**Consumed by:** `retrieve-context.ts`; re-exported from `index.ts`. (The `ensure*` DDL helpers are exported but not referenced inside the package — host-side schema bootstrap.)

**Dependencies:** (a) infrastructure only — `GraphStore` port + `process.env.RETRIEVAL_*` flags.

**Philosophy coupling:** none in *names*, but the SQL is **SOPHIA-schema-coupled**: it assumes tables/edges
`claim`, `passage`, `grounded_in`, `about_subject`, `authored`, and field `text @@`/`confidence`
(`L25`, `L48–54`, `L106–113`, `L139–151`, `L163`, `L170–174`). These are graph-schema assumptions, not
philosophy taxonomy — they belong in config as **schema/edge names**, not as a domain model (see §4 `relations`/`schema`).

---

### 2.5 `seed-set-constructor.ts` — **heavily role-coupled**

**Exports:** `constructSeedSet`, types `SeedRole`, `SeedCandidate`, `SeedBalanceStats`, `SeedSetConstructionResult`.

**Consumed by:** `retrieve-context.ts` (`constructSeedSet`, `SeedBalanceStats`); re-exported from `index.ts`; `__tests__/seed-set-constructor.test.ts`.

**Dependencies:**
- internal: `HybridCandidate` (hybrid), `computeKgBalanceMultiplier` + `RetrievalOriginBalanceKey` (kg-balance).
- (c) pure: cosine/token similarity, MMR loop.

**Philosophy coupling (→ config):**
| Line | Construct |
| --- | --- |
| `7` | `SeedRole = 'support' \| 'objection' \| 'reply' \| 'definition_distinction'` |
| `45` | `ROLE_ORDER` |
| `86–94` | `roleForCandidate()` maps `claim_type` `objection`/`response`/`reply`/`definition` + text contains `'distinction'` |
| `96–103` | `makeEmptyRoleCounts()` (role keys) |
| `122–124` | `hasObjectionReplyPresence()` — objection/reply diversity metric |
| `126–129` | `isMonoPerspective()` (uses role keys) |
| `131–150` | `computeDefaultQuotas()` — quota ladder forces objection/reply/definition slots |
| `165` | `topUpOrder` |
| `307`, `315–316` | `SeedBalanceStats` role fields + `mmr_quota_v1` strategy tag |

The MMR/balance mechanics are generic; only the **role taxonomy and quota ladder** are philosophy-shaped.

---

### 2.6 `retrieve-context.ts` — **the engine; densest coupling**

**Exports:** `retrieveContext`, `retrieveContextFromSeed`, `buildContextBlock`, `formatThinkerContextBlock`, and result types
`RetrievedClaim`, `RetrievedRelation`, `RetrievedArgument`, `ThinkerSummary`, `ThinkerContext`,
`RejectedClaim/RelationReasonCode`, `RejectedClaim/RelationCandidate`, `ClosureUnitTrace`,
`RetrievalClosureStats`, `RetrievalSeedTrace`, `RetrievalQueryDecompositionTrace`,
`RetrievalPruningSummaryTrace`, `RetrievalResult`, `RetrievalOptions`.

**Consumed by:** `apps/dashboard/src/lib/server/connect-v1/retrieve-service.ts` (engine calls);
`retrieval-mapper.ts` (`RetrievalResult` type); re-exported from `index.ts`.

**Dependencies:**
- (a) infrastructure: `GraphRagDeps`/`GraphStore` (ports), all `store.query(...)` SQL, `process.env.RETRIEVAL_KNN_EF` (`L43`), `RETRIEVAL_REQUIRE_VERIFIED` (`L58`, `L1014`).
- (b) domain-coupled: `PhilosophicalDomain` (`L20`, threaded through ~15 type fields); the constant tables and helpers below.
- (c) pure: `computeHopConfidenceThreshold`, `parseRelationStrengthWeight`, score math.

**Hardcoded philosophy constructs (→ config), with line refs:**

| Line(s) | Construct | Value |
| --- | --- | --- |
| `250–259` | `RELATION_TRAVERSAL_BEAM_SPECS` (edge-prior table) | supports `1.04`, contradicts `1.16`, depends_on `0.92`, responds_to `1.2`, defines `0.9`, qualifies `0.88`, refines `0.86`, exemplifies `0.82` |
| `261–270` | `RELATION_FETCH_SPECS` (table → relation_type, incl. aliasing `refines→qualifies`, `exemplifies→supports`) | 8 edges |
| `272` | `THESIS_CLAIM_TYPES` | `thesis`, `conclusion` |
| `273` | `OBJECTION_CLAIM_TYPES` | `objection`, `counterargument`, `counter_argument` |
| `274` | `REPLY_CLAIM_TYPES` | `response`, `reply`, `rebuttal` |
| `317–318` | thesis fallback types | `premise`, `support`, `methodological` |
| `328–331` | `computeHopConfidenceThreshold` clamps | `0.2`/`0.85`/`0.9`/`+0.08`/hop |
| `333–344` | `computeDomainExpansionWeight` | same-target `1.05`, off-target `0.72`, same-anchor `1.0`, off-anchor `0.84`, default `0.92` |
| `346–352` | `parseRelationStrengthWeight` | strong `1.08`, weak `0.86` |
| `354–505` | **Thinker enrichment** — `toThinkerSummary`, `capThinkerContext`, `fetchThinkerContext` (Surreal `authored`/`influenced_by`/`student_of` traversal), `formatThinkerDisplayName`, `formatThinkerContextBlock` ("PHILOSOPHICAL LINEAGE CONTEXT … Wikidata") |
| `534–535` | traversal default ladders (`maxHops`, `claimCap` by `topK`) |
| `739` | BM25 fallback row hardcodes `domain: 'ethics'`, `claim_type: 'premise'` |
| `1025–1030` | hop tuning: `maxNewClaimsPerHop`, `beamWidthPerHop`, `beamQueryLimitPerTable`, `hopDecayFactor 0.78`, `traversalBaseConfidence 0.38` |
| `1060–1168` | beam loop over `RELATION_TRAVERSAL_BEAM_SPECS` |
| `1297–1302` | argument membership `roleRank`: `conclusion`/`key_premise`/`supporting_premise` |
| `1357–1591` | **Closure enforcement** (thesis→objection→reply) — `selectMajorThesisIds`, `fetchRelationNeighbors('contradicts'\|'responds_to')`, `pickClosureCandidate` typed by objection/reply matchers |
| `1615–1673` | relation resolution over `RELATION_FETCH_SPECS` |
| `1696–1730` | argument fetch — `part_of` roles `conclusion`/`key_premise` |
| `1817` | `traversal_mode: 'beam_trusted_v1'` (literal in trace) |
| `1868–1873` | `buildContextBlock` header "=== PHILOSOPHICAL KNOWLEDGE GRAPH CONTEXT ===" / "SOPHIA's curated philosophical knowledge graph" |
| `1930` | footer "Use Google Search to verify, challenge, or extend these claims…" |

**Graph schema names** also hardcoded throughout the SQL (not philosophy, but host-schema):
`claim`, `passage`, `source`, `part_of` (+ `role` field), and the 8 relation edge tables; review-state
vocabulary `accepted`/`candidate`/`needs_review`/`rejected`/`merged`; verification-state
`validated`/`flagged`/`NONE`.

---

### 2.7 `empty-graph.ts` — **independent**

**Exports:** `emptyGraphData()`, `GraphData` (re-export). **Consumed by:** `index.ts` barrel only (within package).
**Dependency:** `@restormel/graph-core/viewModel` — (a) infrastructure/view-model, unrelated to retrieval. No coupling.

---

### 2.8 `index.ts` — barrel

Re-exports everything above. No logic. Will need to additionally export `RetrievalConfig` + a SOPHIA preset once §4 lands.

---

### 2.9 `packages/context-packs/src/` — **parallel philosophy coupling (downstream)**

Not imported by `graphrag-core`; the **host** maps `RetrievalResult → ContextPackRetrievalInput`
(`retrieval-mapper.ts:14`) and calls `buildPassSpecificContextPacks`. It carries its **own** taxonomy
that must be decoupled in lockstep, otherwise generalising the engine leaves packing philosophy-bound.

**Consumed by:** `apps/dashboard/.../connect-v1/retrieval-mapper.ts`; `packages/state/src/{correlation,types}.ts`; several docs `.svelte` pages.

**Hardcoded constructs (→ config):**
| Line | Construct |
| --- | --- |
| `types.ts:62` | `ContextPackPass = "analysis" \| "critique" \| "synthesis"` (SOPHIA three-pass model) |
| `types.ts:64` | `ContextPackRole = "support" \| "objection" \| "reply" \| "definition_distinction"` |
| `types.ts:85–89` | `reply_chain_count`, contradiction-resolution stats |
| `contextPacks.ts:23–24,41–42` | role classification (`objection`/`reply`) |
| `contextPacks.ts:29–31` | depth token budgets per pass |
| `contextPacks.ts:61–94` | per-pass role scoring weights |
| `contextPacks.ts:101–115` | relation-type rank per pass (`supports`/`contradicts`/`responds_to`) |
| `contextPacks.ts:140,209` | role iteration lists |

---

## 3. Dependency graph & decouple order (leaves first)

Internal `graphrag-core` import edges (A → B means A imports B):

```
index.ts ──────────────► (everything)
empty-graph.ts ────────► @restormel/graph-core/viewModel        [independent leaf]

retrieve-context.ts ──► ports.ts                                [LEAF]
                      ├► hybrid-candidate-generation.ts          [LEAF]
                      ├► kg-balance.ts ──► contracts/domains      (PhilosophicalDomain)
                      ├► seed-set-constructor.ts ──► hybrid, kg-balance
                      └► surreal-retrieval-enhancements.ts ──► ports.ts
```

Because the files are already in place, "move order" is now **decouple order** — introduce config at
the leaves so dependents inherit it without churn:

1. **`ports.ts`** — add `RetrievalConfig` type here (or a new `config.ts` leaf). No behaviour change.
2. **`hybrid-candidate-generation.ts`** — accept `corpusLevelSignals` / `knownPhrases` params (default to current constants).
3. **`kg-balance.ts`** — drop `PhilosophicalDomain` import → `string`; take ideal fractions/strengths from config.
4. **`seed-set-constructor.ts`** — parameterise `SeedRole` taxonomy, `roleForCandidate`, quota ladder.
5. **`surreal-retrieval-enhancements.ts`** — parameterise table/edge names (schema config).
6. **`retrieve-context.ts`** — thread `RetrievalConfig` through: edge priors, claim-type sets, closure, enrichment hook, presentation strings; replace `PhilosophicalDomain` with `string` (config-validated).
7. **`context-packs`** (separate package, parallel) — parameterise passes/roles/weights.
8. **`index.ts`** — export `RetrievalConfig` + `sophiaRetrievalConfig` preset.
9. **Host (`retrieve-service.ts`)** — pass the preset (and Connect can later swap in a domain-specific config).

Each step is independently shippable: defaults equal today's hardcoded values, so SOPHIA/Connect behaviour is unchanged until a non-default config is supplied.

---

## 4. Proposed `RetrievalConfig`

A single object carrying everything currently hardcoded, so the engine becomes domain-agnostic.
The current SOPHIA values become a `sophiaRetrievalConfig` preset; passing nothing keeps today's behaviour.

```ts
/** Carried alongside GraphRagDeps; defaults reproduce SOPHIA's philosophy behaviour. */
export interface RetrievalConfig {
  /** Claim-type taxonomy (replaces THESIS/OBJECTION/REPLY sets + thesis fallbacks). */
  claimTaxonomy: {
    thesisTypes: string[];          // ['thesis','conclusion']
    objectionTypes: string[];       // ['objection','counterargument','counter_argument']
    replyTypes: string[];           // ['response','reply','rebuttal']
    thesisFallbackTypes: string[];  // ['premise','support','methodological']
    normalize?: (claimType: string) => string; // default trim+lowercase
  };

  /** Seed-role model (replaces SeedRole union, roleForCandidate, quota ladder). */
  seedRoles: {
    order: string[];                                   // ['support','objection','reply','definition_distinction']
    classify: (c: { claim_type: string; text: string }) => string;
    defaultQuotas: (topK: number) => Record<string, number>;
    /** Pair used for "presence"/closure diversity metrics. */
    diversityPair: [string, string];                   // ['objection','reply']
  };

  /** Relation taxonomy + edge priors (replaces RELATION_TRAVERSAL_BEAM_SPECS / RELATION_FETCH_SPECS). */
  relations: {
    traversalEdges: Array<{ table: string; edgePrior: number }>;
    fetchEdges: Array<{ table: string; relationType: string }>;
    contradictionEdge: string;       // 'contradicts'  (closure objection lookup)
    replyEdge: string;               // 'responds_to'  (closure reply lookup)
    strengthWeights: { strong: number; weak: number; default: number }; // 1.08/0.86/1
  };

  /** Argument structure schema (replaces part_of role ranks + membership names). */
  arguments: {
    membershipEdge: string;          // 'part_of'
    conclusionRole: string;          // 'conclusion'
    keyPremiseRole: string;          // 'key_premise'
    membershipRoleRank: Record<string, number>; // {conclusion:0,key_premise:1,supporting_premise:2}
  };

  /** Closure policy (thesis→objection→reply). */
  closure: {
    enabled: boolean;                // true
    maxMajorTheses: (topK: number) => number; // clamp(ceil(topK/4),1,3)
  };

  /** Traversal defaults & tuning (replaces inline magic numbers). */
  traversal: {
    mode: string;                    // 'beam_trusted_v1'  (also surfaced in trace + contracts/api.ts)
    defaultMaxHops: (topK: number) => number;
    defaultClaimCap: (topK: number) => number;
    hopDecayFactor: number;          // 0.78
    baseConfidence: number;          // 0.38
    hopThreshold: { min: number; max: number; perHop: number }; // 0.2 / 0.9 / 0.08
    beam: { newPerHop: (topK: number) => number; width: (topK: number) => number; queryLimitPerTable: (topK: number) => number };
    domainExpansionWeights: {
      sameTarget: number; offTarget: number; sameAnchor: number; offAnchor: number; neutral: number;
    };                               // 1.05 / 0.72 / 1.0 / 0.84 / 0.92
    trustedEdgesOnly: boolean;       // true
  };

  /** Domain model (replaces the hard PhilosophicalDomain dependency). */
  domain: {
    enabled: boolean;
    values?: readonly string[];      // optional allow-list (validation only)
    fallbackDomain?: string;         // 'ethics' (BM25 fallback row)
    fallbackClaimType?: string;      // 'premise'
  };

  /** Inquiry-time origin/domain balance (replaces IDEAL_RETRIEVAL_ORIGIN_FRACTIONS + strengths). */
  originBalance: {
    enabled: boolean;
    idealFractions: Record<string, number>; // { sep:0.42, gutenberg:0.33, other:0.25 }
    originStrength: number;          // 0.95
    domainStrength: number;          // 0.85
  };

  /** Lexical hints (replaces CORPUS_LEVEL_SIGNALS + knownPhrases). */
  lexical: { corpusLevelSignals: string[]; knownPhrases: string[] };

  /** Graph schema names (replaces hardcoded table/field literals in SQL). */
  schema: {
    claimTable: string;              // 'claim'
    passageTable: string;            // 'passage'
    sourceTable: string;             // 'source'
    reviewStates: { accepted: string; candidate: string; needsReview: string; rejected: string; merged: string };
    verificationStates: { validated: string; flagged: string };
    requireVerified: boolean;        // from RETRIEVAL_REQUIRE_VERIFIED
  };

  /** Optional enrichment hook (replaces hardcoded thinker/Wikidata enrichment). */
  enrichment?: {
    fetch: (store: GraphStore, claimIds: string[]) => Promise<unknown | null>;
    format: (ctx: unknown) => string;
  };

  /** Output presentation (replaces buildContextBlock header/intro/footer prose). */
  presentation: {
    header: string;   // '=== PHILOSOPHICAL KNOWLEDGE GRAPH CONTEXT ==='
    intro: string;
    footer: string;
  };
}
```

Notes / open questions for review before code moves:

- **`PhilosophicalDomain` → `string`.** It is used purely as a string key everywhere in the engine
  (`String(domain)` in kg-balance; equality in `computeDomainExpansionWeight`). Replacing the import
  with `string` + an optional `domain.values` allow-list removes the only hard `@restormel/contracts`
  type dependency. The host can still pass `PhilosophicalDomain` values.
- **`traversal.mode` literal is duplicated downstream.** `'beam_trusted_v1'` is also baked into
  `packages/contracts/src/api.ts:358` and `packages/graph-reasoning-extensions/src/projection.ts:94`
  (trace consumers). If the mode becomes configurable, those union types must widen or stay as the
  canonical default.
- **`schema` vs `relations`.** Edge **table names** (`supports`, `part_of`, …) are arguably schema, but
  their **priors and semantics** are domain config; the split above keeps priors in `relations` and raw
  table names referenced from there, with non-relation tables in `schema`.
- **Enrichment hook shape.** Current thinker enrichment returns `ThinkerContext` and formats a fixed
  block; a generic `fetch`/`format` pair keeps `RetrievalResult.thinker_context` populated for SOPHIA
  while letting other domains supply their own (or none).
- **context-packs** needs a sibling `ContextPackConfig` (passes, roles, weights, budgets) — same pattern,
  separate package, parallel phase.

---

## 5. Engine call sites to update after config lands

All live in **one host file** — `apps/dashboard/src/lib/server/connect-v1/retrieve-service.ts`:

| Line | Call | Change needed |
| --- | --- | --- |
| `111–116` | `retrieveContextFromSeed(seedId, query, graphRagDeps, retrievalOptions)` | pass `RetrievalConfig` (via deps or options) |
| `118` | `retrieveContext(query, graphRagDeps, retrievalOptions)` | pass `RetrievalConfig` |
| `121` | `buildContextBlock(retrieval)` | optionally accept config for presentation strings |

`retrieveContextFromSeed` (`retrieve-context.ts:1938`) internally delegates to `retrieveContext`
(`:1945`) — it only needs to forward the config.

**Indirect / type-only consumers** (no call, but affected by shape changes):
- `…/connect-v1/retrieval-mapper.ts:12` — imports `RetrievalResult` (would see any result-shape change).
- 9 Connect host files import `GraphStore`/`EmbeddingPort` only — **unaffected** by config (ports unchanged).
- `packages/contracts/src/api.ts:358`, `packages/graph-reasoning-extensions/src/projection.ts:94` — hardcode the `'beam_trusted_v1'` trace literal; revisit if `traversal.mode` becomes non-constant.

**Tests touching the surface:** `packages/graphrag-core/src/__tests__/{hybrid-candidate-generation,kg-balance,seed-set-constructor}.test.ts`;
`apps/dashboard` connect-v1 retrieve tests (mock Neon, per commit `2b55cce`).

---

## 6. Acceptance check

- ✅ Public exports + consumers documented per file (§2), with the engine call sites enumerated (§5).
- ✅ Dependencies categorised (a) infrastructure / (b) domain-coupled / (c) pure utility (§2).
- ✅ Every hardcoded philosophy construct listed with line references (§2.6 table, plus §2.2/§2.3/§2.5/§2.9).
- ✅ Dependency graph + leaf-first decouple order (§3).
- ✅ Proposed `RetrievalConfig` covering taxonomy, relations/edge priors, traversal defaults,
  verification/schema policy, enrichment hooks, balance, lexical hints, presentation (§4).
- ✅ Call-site list for `retrieveContext` / `retrieveContextFromSeed` / `buildContextBlock` (§5).

**No code was changed.** Next phase: introduce `RetrievalConfig` at the leaves (§3 step 1) with a
`sophiaRetrievalConfig` preset, defaults equal to current values, so SOPHIA and Connect behaviour is
byte-identical until a different config is supplied.

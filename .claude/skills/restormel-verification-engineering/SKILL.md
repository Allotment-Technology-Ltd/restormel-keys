---
name: restormel-verification-engineering
description: >-
  Craft standard for building or reviewing the dual-mode verification engine
  (REC-ADR-023): the extraction claim/evidence contract and source_locator
  provenance chain, claim decomposition and grounding, the cheap->expensive
  verifier cascade with first-class abstention, the hash-keyed exact-match
  verdict cache, evaluation honesty around the >=90%/<=2% weekly CI-gate bar,
  LLM-judge bias mitigations, and unit-economics instrumentation in
  packages/connect-core. Use when building or reviewing build steps 1A/1B or
  the cascade-validation harness, a PR touches
  packages/connect-core/src/ingest or src/stages, or work involves claims,
  verdicts, provenance, extractors, or verifier components — not dashboard UI
  (plug-point UX is ADR step 5), route/pool configuration
  (restormel-keys-routing), or the pre-PR security gate
  (restormel-high-risk-security).
---

# Restormel verification engineering

Canonical references: [docs/decisions/ingest-connector-architecture-adr.md](../../../docs/decisions/ingest-connector-architecture-adr.md) (REC-ADR-023 — dual-mode architecture, four invariants, build sequence 1A–5), [planning/spikes/ingest-connector-extraction-spike.md](../../../planning/spikes/ingest-connector-extraction-spike.md) (REC-TECH-014 — extraction contract + swap test), [planning/ingest-cost-architecture-report-a.md](../../../planning/ingest-cost-architecture-report-a.md) (REC-PLAN-023 — cascade, verdict cache, instrumentation), [planning/component-licensing-menu-report-b.md](../../../planning/component-licensing-menu-report-b.md) (REC-GOV-022 — CLEARED/BLOCKED/AMBIGUOUS verdicts), [planning/horizon/strategic-review-2026-07-01-decisions.md](../../../planning/horizon/strategic-review-2026-07-01-decisions.md) (D-2026-07-02-1 — at-risk posture, rollback mitigation, scope bound).

Every rule below is checkable against a diff or a test run; if you cannot name the check, the rule does not belong here.

## Severity and gate

| Severity | Meaning | Gate |
|---|---|---|
| Blocker | Violates an ADR invariant, the D-2026-07-02-1 scope bound, or fabricates/corrupts a verdict or provenance chain | BLOCK |
| Major | Erodes evaluation honesty, cache correctness, or clean removability | BLOCK unless waived in the PR description with rationale |
| Minor | Idiom or instrumentation gap | PASS with a follow-up ticket linked in the PR description |

The four ADR invariants (REC-ADR-023) hold in every config, both modes — any violation is a Blocker:

| # | Invariant |
|---|---|
| 1 | The checker is always a different model family from whatever generated or extracted the content, spine-enforced |
| 2 | Span-bound provenance + version hash, depth disclosed (A/B, P1/P2) |
| 3 | Abstention-to-human as a real outcome, never suppressed |
| 4 | ≥90%/≤2% bar measured *after* cascade + abstention via the weekly CI gate, never assumed |

## 1. Component eligibility and removability (D-2026-07-02-1, REC-GOV-022)

| Rule | Pass criteria |
|---|---|
| No BLOCKED component, anywhere | Zero references to NV-Embed-v2, Patronus Lynx 8B/70B, Bespoke-MiniCheck-7B, or any Jina weights (excluded per REC-GOV-022; v3/v4 are CC-BY-NC) anywhere under `packages/` or in `pnpm-lock.yaml` — code, deps, model-ID strings, configs, production-path fixtures, and code comments alike; exclusion rationale lives in `docs/`/`planning/` only, so the grep is binary |
| No AMBIGUOUS component either | lytang MiniCheck and Surya equally excluded, same binary grep scope; per D-2026-07-02-1, "rollback cannot cure a licence breach" — the at-risk posture does not reopen these sets |
| Mistral OCR: API only, pure extraction | Self-host = NEEDS COMMERCIAL LICENCE; only the hosted API in pure-extraction mode (never the Document-AI schema tier) may appear |
| At-risk wiring drawn only from the recommended set | New integrations use PaddleOCR-VL, Mistral OCR API pure-extraction, HHEM-2.1-Open, Granite Guardian, frontier verification APIs, or voyage-context-4 (D-2026-07-02-1 scope bound) |
| Every integration cleanly removable | Component reached only through a port interface (`ingest-ports.ts`/`ports.ts` pattern; network/credentialed implementations live in the host app, mirroring the GraphStore port pattern); checkable on the current diff: the component id greps only to its adapter, its test, and config, and the diff touches no spine module — so a future removal is delete adapter + config entry, zero verification-spine edits |
| Removal orphans cached state, never corrupts it | Component id + version present in cache keys and provenance records, so ripping a component out leaves unreachable cache entries, not wrong ones |
| The removal story is written down | The PR description for any new at-risk integration names the files deleted and cache entries orphaned by a rollback |
| Launch bar unchanged | Before any external-user launch, counsel CLEARED verdicts are a precondition again — D-2026-07-02-1 changes sequencing, not the launch bar |

**How to verify:**
- `grep -riE 'nv-embed|patronus|lynx|bespoke|jina|lytang|surya' packages/ pnpm-lock.yaml` — zero hits; these names may appear only under `docs/` and `planning/`. Any hit under `packages/` or in the lockfile fails, comment or not.
- Grep the new component's id across `packages/` — hits confined to its adapter file, its test, and config; the diff touches no spine module.
- PR description contains the removal story; if absent, request changes.

## 2. Claim/evidence contract and provenance-chain integrity (REC-TECH-014, REC-ADR-023)

| Rule | Pass criteria |
|---|---|
| Contract shape is exact | `extract()` returns `{ document: {source_id, version_hash_inputs, language, page_count, capability_tier}, text_units: [{text, source_locator, confidence, block_type?, reading_order?}] }`; types imported from `@restormel/contracts/connect`, never redefined; no connector-specific fields leak past the adapter |
| Verbatim text, always | `text_units[].text` is verbatim — no LLM reshaping, no "cleaning"; harmonization used for eval scoring (whitespace collapse, Unicode mapping) lives in the eval harness, never in stored canonical text |
| Normalization is offset-preserving or forbidden | Downstream of anchoring, any transform (Unicode NFC/NFKC, whitespace collapse, zero-width strip, line-break flattening) records an alignment map back to canonical text (HF `NormalizedString`-style), or does not exist |
| Offset unit declared | Locator offsets pinned to a stated unit (UTF-8 bytes or Unicode code points) in the contract — never implicit JS `.length` semantics (a single emoji is length 1 in Python, 2 in JS) |
| Locator survives end-to-end | `source_locator` ({kind:"spatial",page,bbox} or {kind:"textual",offset,length,path?}) intact through extraction→chunking→embedding→retrieval→verification; door-agnostic (also serves proxy Tier P2) |
| Chunkers record their edits | Chunkers that inject text (contextual prefixes, header injection) record the mapping back to canonical text; chunking itself is Restormel-owned — connectors never chunk (REC-ADR-023 §2) |
| Tier honesty | Provenance tier A (spatial) / B (textual) set from the locator kind actually produced, never inflated; depth disclosed as A/B and P1/P2 (ADR invariant 2) |
| Claims anchor fully | Every claim carries (source_id, source-version hash, locator, verbatim quote) — never a chunk index alone |
| Both hashes stored | Hash the canonical extracted text AND the raw file, store both; quote-in-doc re-match is the self-checking fallback that detects broken offsets |
| Verifier sees the bound quote only | Verifier input = bound quote + minimal decontextualizing context, not the whole document |
| Pattern generalizes | Extraction is instance #1 of the connector pattern; the embedding connector (voyage-context-4, ADR step 3) is instance #2 — the same contract and locator rules apply |

**How to verify:**
- Round-trip test in `src/__tests__/` (or colocated `*.test.ts` per existing pattern): for a fixture doc, every claim's locator re-resolves to a span byte-identical to the stored quote after the full pipeline.
- `grep -rnE '\.trim\(|\.replace\(|\.normalize\(' packages/connect-core/src/ingest packages/connect-core/src/stages` — every hit is upstream of anchoring or paired with alignment tracking.
- Contract types resolve to `@restormel/contracts/connect` imports, not local redefinitions.

## 3. Claim decomposition and grounding granularity (2026 decompose-then-verify practice)

| Rule | Pass criteria |
|---|---|
| Decontextualize before verifying | Every subclaim has pronouns/ellipsis resolved before it reaches a verifier; the decontextualized form is stored next to the verbatim source quote, never in place of it |
| Granularity tuned to the verifier | Decomposition atomicity is a config of the verifier tier, keyed by verifier tier id — not a global constant |
| Dedupe and filter trivial claims | Repeated or uninformative subclaims are deduped before scoring — raw claim-count metrics are gameable by verbose trivial facts |
| Claim→span, never claim→document | Each claim is entailment-scored against its bound passage only; below the calibrated threshold → `"unverifiable"`, never a document-level pass |
| Single-pass allowed at ingest | Joint decompose+verify (VeriFastScore-style) is acceptable for door-1 throughput if it emits the same per-claim verdict + locator schema |

Reference note (motivates the granularity rule; the check is only the config keying): optimal decomposition granularity is verifier-dependent — verifier-aligned decomposition shows gains up to +6.24 macro-F1.

**How to verify:**
- Unit test: a paragraph with an unresolved pronoun produces subclaims whose stored decontextualized text resolves it, while the bound quote stays verbatim.
- Grep decomposition config — granularity keyed by verifier tier id, not a bare constant.
- Test: duplicate subclaims collapse before scoring; verifier call count reflects the deduped set.

## 4. Cascade design and abstention (REC-PLAN-023, REC-ADR-023 §3)

| Rule | Pass criteria |
|---|---|
| Tier order fixed | Cheap pre-filter (HHEM-2.1-Open class) → mid-tier independent checker (Granite Guardian 8B class) → frontier escalation → abstain-to-human |
| Cross-model independence | Adjacent tiers use different model families/architectures, spine-enforced — derived from ADR invariant 1 (checker family ≠ generator/extractor family) plus the ADR's family-independent cascade design; same-family escalation is decorrelation theatre and buys nothing |
| Abstention is schema, not an error path | Verdict type is a closed string-literal union (connect-core idiom) including `"unverifiable"`/`"abstained"` as first-class values (ADR invariant 3; 2026 evidence: binary grading rewards guessing — abstention must be reportable, not swallowed) |
| Never fabricate a verdict | No code path maps timeout, parse failure, or budget exhaustion to a pass; failures surface as named error classes or an abstention verdict |
| Budget exhaustion is labelled | Door-2 latency-budget exhaustion → labelled-unverified (annotated mode) or withheld (strict mode), never silent pass |
| Calibrated thresholds only | Escalation thresholds derive from calibrated confidence (isotonic/Platt on held-out labels) and live in versioned config with calibration provenance — never inline constants |
| Know when a cascade loses | A cascade only beats a single strong checker when stage-1 confidence is calibrated and error costs are asymmetric; the calibration artifact reports a per-corpus stage-1 confidence informativeness metric (e.g. AUROC against final verdicts) — an uninformative corpus gets a recorded finding and a simplification follow-up linked in the PR description |
| Per-tier audit trail | Every claim logs per-stage verdict + confidence, making every cached verdict re-checkable and every tier removable (the D-2026-07-02-1 rollback requirement applied to the cascade) |
| Both modes, same invariants | Batch-at-ingest (door 1) and in-path cache-first (door 2) run the identical cascade contract; mode changes only the latency budget and exhaustion behavior |
| Abstention is tested, not assumed | Test suites include AbstentionBench-style cases: false premises, underspecified claims, stale/absent evidence |

The target verdict shape (closed string-literal union per connect-core idiom, checkable by the type system). This is the *proposed* schema — it supersedes the shipped `EntailmentVerdict` union (`"entailed" | "not_entailed" | "abstain"`, `src/ingest/entailment.ts`): `entailed`→`supported`, `abstain`→`abstained`, and `not_entailed` splits into `contradicted` vs `unverifiable`. Existing `EntailmentVerdict` code is not a violation; new code mixing the two vocabularies in one module is.

```ts
type Verdict =
  | "supported"
  | "contradicted"
  | "unverifiable"   // evidence insufficient for THIS claim+span
  | "abstained";     // cascade exhausted -> routed to human
// Adding a variant is an ADR-level change; mapping errors to
// "supported" is a Blocker. Errors are named error classes.
```

**How to verify:**
- Fixture tests with absent evidence and false premises assert the cascade returns `"abstained"` — not a throw, not a pass.
- Grep escalation threshold values — loaded from config with a calibration-source reference, no inline constants.
- Diff model configs across adjacent tiers — families differ.
- The calibration artifact contains the per-corpus stage-1 informativeness metric; an uninformative corpus has a linked follow-up.
- `pnpm --filter @restormel/connect-core test` green; per-tier verdict + confidence present in structured logs on a mock run.

## 5. LLM-judge tiers (2026 judge-bias evidence)

| Rule | Pass criteria |
|---|---|
| Different family than the generator | Judge model family/provider differs from whatever produced the claim (ADR invariant 1); a model never grades its own output in prod (self-preference bias) |
| Order-swap on pairwise judging | Pairwise comparisons run twice with positions swapped; disagreement resolves to tie or escalates (position bias, replicated across 15 judges / 150k instances) |
| Length-controlled grading | Scoring is length-controlled or reference-guided (verbosity bias) |
| Frozen, versioned prompts | Judge prompts are versioned artifacts; any prompt or model change ships with re-calibration against a human-labeled spot-check set AND bumps the cache-key prompt version |
| No unsupervised debate | Debate-style multi-judge setups require a meta-judge — debate amplifies bias, it does not cancel it; any debate config names its meta-judge component id |
| Judges are the escalation tier, not the default | Small fine-tuned entailment checkers handle the in-path default; LLM judges are reserved for world-knowledge, multi-hop, or rationale-needed cases |

**How to verify:**
- Any diff touching a judge prompt also touches the prompt-version constant and includes re-calibration numbers in the PR description.
- Grep judge vs generator model config for family overlap — none.
- Order-swap covered by a unit test on the pairwise path.
- Grep any debate-style judge config for a meta-judge component id — present, or the config does not exist.

## 6. Verdict-cache discipline (REC-PLAN-023, widened per 2026 practice)

| Rule | Pass criteria |
|---|---|
| Exact-match only | No semantic/similarity/fuzzy lookup anywhere in the verdict-return path — a near-miss hit silently flips a verdict, the exact failure the product exists to prevent, and similarity matching is adversarially exploitable via lexical variants |
| Paraphrase reuse = retrieval only | If reuse-across-paraphrase is ever built, it is candidate retrieval feeding a fresh check, never a verdict return (see conflict resolutions below) |
| Full key composition | Key = hash over: canonical claim text ‖ source-span ‖ source-version-hash ‖ checker id + model version ‖ checker config (temperature, tools) ‖ prompt/template version — REC-PLAN-023's four fields with "checker-version" read wide |
| Order-invariant serialization | Key inputs serialize deterministically (sorted keys) before hashing, so semantically identical configs cannot produce distinct keys |
| Invalidation by construction | Version-in-key makes stale entries unreachable on deploy; lazy GC by TTL/LRU; explicit purge only for recalled verdicts (checker bug), served by a checker-version→entries index |
| Extractor swap invalidates dependents | Extractor name + version recorded in document provenance; a swap re-versions the content hash, so dependent verdicts miss automatically |
| Every lookup logged | Hit/miss logged per lookup with the counterfactual tier it short-circuited (feeds §8) |

Key composition (every field mandatory; omitting one is a Blocker):

```ts
verdictCacheKey = hash(canonicalSerialize({
  claimTextCanonical,     // decontextualized claim, declared offset unit
  sourceSpan,             // locator, not chunk index
  sourceVersionHash,      // canonical extracted-text hash
  checkerId, checkerModelVersion,
  checkerConfig,          // temperature, tools, params — sorted keys
  promptTemplateVersion,
}));
```

**How to verify:**
- Key-discrimination tests: identical claim + span with a changed checker config or prompt version must miss.
- A serialization test enumerates every key field and asserts key-order invariance.
- `grep -rinE 'similar|embed|cosine' ` in the cache module — zero hits.
- Purge path covered by a test that walks the checker-version index; TTL/LRU config present.

## 7. Evaluation honesty (weekly CI gate; 2026 eval-statistics practice)

| Rule | Pass criteria |
|---|---|
| The bar is measured, never assumed | ≥90%/≤2% measured *after* cascade + abstention on the weekly CI gate, per corpus and per mode (ADR invariant 4) |
| Three numbers, never one | Every eval report shows accuracy, error rate, abstention rate as separate figures, with confident errors penalized more than abstentions — no blended single score |
| Fixture vs live labelled | Every reported number tagged fixture-replay or live-run; cache-hit rate reported alongside accuracy (a hash-keyed cache makes bare "accuracy" ambiguous) |
| Private eval set | Production-drawn, ≥100 items, refreshed past model cutoffs; disjointness from tuning data enforced by the next rule. (Rationale, not diff-checkable: the set is never published or tuned on — public benchmarks presumed contaminated) |
| Threshold-fitting data is training data | Anything used to fit escalation thresholds, calibration maps, or cache policy is disjoint from the reported eval set; re-split whenever a cascade stage changes |
| Error bars mandatory | CIs/SEs on every headline number; paired differences when comparing verifier variants; the harness SE computation clusters by source-document id when items share a source (per-doc claim clusters can inflate naive SEs ~3×), asserted by a harness unit test; per-corpus breakdown, never aggregate-only |
| Risk–coverage reported | Publish the selective-prediction curve so operating points are chosen deliberately, not implied by a default threshold |
| Extractor evals are binary unit tests | Presence of exact sentences, table-cell relations, reading order — machine-checkable, stratified by doc type; edit distance / NED / TEDS are secondary signals only |
| Swap test is provable, not asserted | Same frozen corpus + doc versions through default and curated alternative; (a) spine diff between runs is empty, (b) both consumed via the identical contract, (c) span-anchoring + verification-outcome deltas documented, stratified by doc type (REC-TECH-014 §Scope 4) |
| Harness inputs are dual | The cascade-validation harness (ADR step 2) runs both CI-gate corpora and one wrapped MCP server (Redis Iris candidate); results reported per input source |

**How to verify:**
- The CI-gate job emits the accuracy/error/abstention triple with CIs, keyed (corpus, mode).
- The eval-report template has a required fixture-vs-live field; reports missing it fail CI.
- A harness unit test asserts SE computation groups by source-document id when items share a source.
- Grep calibration/threshold-fitting scripts for eval-set paths — disjoint from the reported set.
- A swap-test PR attaches the empty spine diff and the delta table.

## 8. Unit-economics instrumentation (REC-PLAN-023; OTel GenAI conventions)

| Rule | Pass criteria |
|---|---|
| OTel GenAI spans per model call | Every call emits `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`/`output_tokens`, plus custom `cost_usd`, `tier`, `mode`, `corpus` |
| Authoritative token counts | Tokens read from provider `usage` fields, never client-side estimates |
| Five first-class metrics | cost/claim, cache-hit rate, tier distribution, abstention rate, latency per tier — per corpus AND per mode, feeding the weekly CI gate and the Stage-5 go/no-go |
| Tier attribution | Each verification tagged with the deciding tier; headline unit metric = cost per verified claim with CIs, decomposable as C = c_cheap + β·c_expensive (β = escalation rate) |
| Escalation rate is a live SLO | Alert on escalation-rate shift — verifier drift silently escalates all traffic and destroys unit economics |
| Cache hits valued honestly | A hit is worth the counterfactual tier cost it avoided; plan for realistic 20–45% hit rates, instrument for silent degradation |

Cascade tiers ride routes/pools — how those model calls get routed (resolve/simulate/explain-chain) belongs to [restormel-keys-routing](../restormel-keys-routing/SKILL.md); this skill owns which attributes every call must carry.

**How to verify:**
- Span-attribute assertion test on a mock verification run covers the full attribute set.
- Grep cost paths for client-side token estimators — none.
- The harness output contains all five metrics keyed (corpus, mode); alerting config includes an escalation-rate rule.

## Where the records and the 2026 research disagree — explicit resolutions

- **MiniCheck.** Research names MiniCheck-class small entailment checkers the default cheap tier (a 770M model ≈ GPT-4 accuracy at ~400× lower cost); REC-GOV-022 marks lytang MiniCheck AMBIGUOUS and Bespoke-MiniCheck-7B BLOCKED. Resolution: the *architecture pattern* (small fine-tuned cross-encoder, claim→span entailment) carries; the checkpoints do not. Cheap tier = HHEM-2.1-Open or another CLEARED/permissively-licensed checkpoint. D-2026-07-02-1's at-risk posture does not reopen this — rollback cannot cure a licence breach.
- **Cache-key width.** REC-PLAN-023 specifies hash(claim + source-span + source-version-hash + checker-version); 2026 practice adds checker config and prompt/template version. Resolution: adopt the superset — read the record's "checker-version" to include config and prompt version. A narrower key is a Blocker: stale verdicts would survive prompt changes.
- **Semantic caching.** REC-ADR-023 permits "a separate, audited layer with a measured false-positive rate"; REC-PLAN-023 disqualifies it unless gated by a shadow-eval loop and a conservative (≥0.97) threshold; 2026 evidence shows similarity-matched verdicts fail silently and are adversarially exploitable. Resolution: any such layer may only do candidate retrieval that feeds a fresh check — it never returns a verdict. This satisfies all three texts; the strict reading wins for moat-core.
- **Gate posture.** REC-GOV-022's decision rule (licence tests 1–4 + 7 clean before a managed default/swap) vs D-2026-07-02-1 (proceed at risk). Resolution: D-2026-07-02-1 is later and controlling for the trial phase, but only over the CLEARED/provisionally-CLEARED set, and the gate reinstates in full before any external-user launch — sequencing changed, the launch bar did not.

## Anti-patterns

- A `try/catch` around a verifier call that returns a pass verdict (or silently drops the claim) on error.
- "Cleaning" extracted text (trim, whitespace collapse, Unicode NFC) after anchoring with no offset alignment map.
- Provenance tier hard-coded to `"A"` regardless of the locator kind actually produced.
- Chunk-index-only citations ("chunk 14 of doc X") instead of locator + verbatim quote.
- Cache key built from claim text + doc id only; or any `similarityThreshold` near the verdict cache.
- An escalation threshold as a bare `0.7` in source with no calibration provenance.
- Judge and generator config pointing at the same model family; or a judge prompt edited without a version bump.
- An eval report with one blended accuracy number — no abstention rate, no CIs, no fixture/live label.
- Aggregate-only corpus results hiding one failing corpus behind three passing ones.
- Claim decomposition that pads the count with trivial repeated facts to flatter the score.
- A new extractor/verifier dependency imported directly in a stage module instead of injected through a port.
- A threshold-tuning script reading from the reported eval set.

## Workflow

1. **Before starting:** run the checkout-freshness check (git fetch + compare origin/main — see repo-hygiene-sweep); re-read the canonical records above for the surface you touch; confirm any new component against REC-GOV-022's verdict tables and the D-2026-07-02-1 scope bound.
2. **Design:** name the port the component sits behind; write the removal story (which files get deleted, which cache entries orphan) into the PR description — D-2026-07-02-1 makes removability a review item, not a nicety.
3. **Implement per connect-core idioms:** file-header block comment stating the design rationale; ports in `ingest-ports.ts`/`ports.ts` with host-app implementations for network/credentialed code; `readonly id` const discriminants; string-literal verdict unions; named error classes; defensive parsing (`parseJsonLoose`-style, per-field typeof narrowing); ESM `.js` import suffixes; connect-core stays MIT with no DB/Surreal deps.
4. **Test:** add the provenance round-trip test, the abstention fixtures, the decomposition-decontextualization test, and the cache-key discrimination test relevant to your change; vitest `describe/it` behaviour-named tests with boundary assertions, in `src/__tests__/` or colocated `*.test.ts` per the existing pattern; `pnpm --filter @restormel/connect-core test`.
5. **Instrument:** confirm new call paths emit the §8 attribute set before anything ships; wire the five first-class metrics for any new tier or mode.
6. **Pre-PR:** run the pre-PR gate per [restormel-high-risk-security](../restormel-high-risk-security/SKILL.md); attach swap-test artifacts if you touched a connector; attach re-calibration results if you touched a judge prompt, model, or threshold.

## Related skills and docs

| Resource | Use |
|---|---|
| [restormel-high-risk-security](../restormel-high-risk-security/SKILL.md) | Pre-PR security gate, secrets/BYOK checklist, hygiene scripts — run it, do not restate it |
| [restormel-keys-routing](../restormel-keys-routing/SKILL.md) | How cascade-tier model calls get routed (routes/pools, resolve/simulate/explain-chain, SOPHIA workload routing); this skill owns *what* the cascade must do |
| [REC-ADR-023](../../../docs/decisions/ingest-connector-architecture-adr.md) | Four invariants, dual-mode architecture, build sequence — the spine contract |
| [REC-TECH-014](../../../planning/spikes/ingest-connector-extraction-spike.md) | Extraction contract fields + the provable swap test |
| [REC-PLAN-023](../../../planning/ingest-cost-architecture-report-a.md) | Cascade tiers, cache key, instrumentation metric set |
| [REC-GOV-022](../../../planning/component-licensing-menu-report-b.md) | Component verdicts — check before any new integration |
| [D-2026-07-02-1](../../../planning/horizon/strategic-review-2026-07-01-decisions.md) | At-risk posture, rollback mitigation, scope bound, launch bar |

## Staleness & upkeep

- Verify checkout freshness (git fetch + compare origin/main) before treating cited file paths as current.
- Update this skill when: counsel returns on REC-GOV-022 (the at-risk rows in §1 then tighten or die); any component moves between CLEARED/BLOCKED/AMBIGUOUS; the ADR build sequence advances past step 2 (cascade-validation harness); the cache-key composition, CI-gate bar, or extraction contract revs; the `Verdict` union migration lands and `EntailmentVerdict` retires (§4 then drops the mapping note); the embedding connector (instance #2) lands and needs its own contract rows.
- Before any external-user launch work begins, rewrite §1 to require counsel CLEARED verdicts — D-2026-07-02-1 reinstates the full gate at that boundary.
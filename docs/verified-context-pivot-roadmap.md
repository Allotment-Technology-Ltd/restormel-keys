# Verified Context — Pivot Delivery Roadmap

**Thesis** (from the June 2026 functionality/competitive review): routing is a commodity
(LiteLLM/OpenRouter/Portkey-OSS), graph-building is crowded (Mem0/Zep/Cognee/MS GraphRAG),
output evals are taken (Braintrust/DeepEval/Promptfoo) — but **provably trustworthy context**
is an empty category with a Gartner digital-provenance tailwind, and Restormel's verification
spine (validation → remediation fail-safe gates, G2 bar, trust score, provenance traces,
verification rules, cross-model validation) already enforces it end-to-end.

## Delivery protocol (how we run this)

1. **One stage per agent run.** Each stage carries a ready-to-fire, self-contained prompt
   (same style as [`docs/reviews/connect-ingest-failopen-fix.md`](reviews/connect-ingest-failopen-fix.md)
   — bounded scope, acceptance criteria, STOP gates, verification commands). The delivered
   prompt inlines every context pointer a cold agent needs (files to read, how to run, the
   ADR, the no-keys harness idiom) so the agent needs nothing beyond the repo.
2. **Definition of done per stage:** PR with tests + docs, typecheck/test green, a repro or
   demo command in the PR body.
3. **End every run by naming the next prompt.** The agent's final message states which stage
   the user should commit to next (and any prerequisite that must clear first), so the user
   has an explicit go/no-go.
4. **Findings are raised as questions, not silently actioned.** If during a run the agent
   finds something that changes scope, sequencing, or a downstream prompt, it STOPs and
   raises it as a question to the user. Proposed changes are prioritised against the rest of
   the roadmap; affected downstream prompts are adjusted *before* proceeding. The roadmap is
   the single source of truth and is edited when a decision lands.
5. **Live-key boundary.** Keyless agent runs deliver code + fixtures + stub-tested harness +
   the exact run command. Measurements that need live model keys (efficacy numbers, the
   STOP-gated bar sign-off) are a human/CI step run by whoever holds the keys; the agent does
   not hold or commit keys. A stage's keyed and keyless portions may be split if that keeps a
   single agent run shippable.

**The claims-integrity rule (non-negotiable).** Restormel must be able to verify *in the
way the marketing says it does*. The G2 bar and trust score report the pipeline's
**self-judgment**; they say nothing about whether the judge itself catches fabricated or
subtly-wrong claims. The architectural answer is
[ADR: Evidence-Bound Verification](decisions/evidence-bound-verification.md) — every claim
bound to quoted evidence spans with source-version hashes (deterministically re-checkable,
Layer 1) plus a narrow span-scoped entailment judge with abstention (Layer 2). Therefore:
(a) verifier efficacy is measured against ground truth (Stage 1.0a) before and after EBV
lands, (b) every public claim maps to an automated, continuously-running piece of evidence
in the claims ledger (Stage 1.0b), and (c) Stage 1.3 marketing may only use ledger rows
marked **proven**. If measured efficacy does not support a phrase, the phrase changes —
not the measurement. The falsifiability test for any surface that says "verified": a
skeptical user can click through to the quoted span in the source and check it themselves.

**Sequencing.**

| Order | Stage | Pivot | Depends on |
|---|---|---|---|
| 0 | Focus cuts (checklist, no agent) | — | — |
| 2 | ✅ EBV ADR sign-off — **approved 2026-06-09** | P1 | — |
| 1 | ✅ 1.0a Verifier efficacy benchmark — **measured + bars signed off 2026-06-10** (see below) | P1 | — |
| 3 | ✅ 1.0c EBV Layer 1 — core (PR #194) + dashboard wiring (PR #199) | P1 | EBV ADR |
| 4 | ✅ 1.0d EBV Layer 2 — span-scoped entailment + abstention/review (PR #204) | P1 | 1.0c |
| 5 | ✅ 1.0a′ post-EBV before/after — **accepted 2026-06-10** ([snapshot](../scripts/reviews/verifier-efficacy-results-2026-06-10-ebv.json), PR #204: misattributed 83.3→100% same-model, false-flag 14.5→4.3% cross-model, ~3× cheaper/run) | P1 | 1.0d |
| 6 | ✅ 2.1 Headless `connect eval` CLI (PR #197) | P2 | — (parallel with 1.0c/d) |
| 7 | ✅ 1.0b Marketing claims ledger (PR #206 — [`verified-context-claims-ledger.md`](verified-context-claims-ledger.md)) | P1 | 1.0a′ |
| 8 | ✅ 1.1 Verified-context API surface (PR #209 — verified-claim envelope, auditor guide, retrieval-vocabulary fix) | P1 | 1.0c |
| 9 | ✅ 1.2 Trust scorecard incl. % evidence-bound (PR #212) | P1 | 1.1 |
| 10 | ✅ 2.2 Quality baseline + regression diff (PR #207 — exit 3 = regression) | P2 | 2.1 |
| 11 | ✅ 1.3 Marketing reposition + docs/OpenAPI audit (PR #216) | P1 | 1.0b, 1.1, 1.2 |
| 12 | ✅ 2.3 CI gate (PR #211) — `connect-eval-github-action` + Forgejo variant, dogfooded warn-mode on Connect-pipeline PRs, weekly cross-model efficacy workflow enforcing the signed-off bars | P2 | 2.2 |
| 13 | ✅ 4.1 Verified-retrieval MCP tool (PR #TBD) | P4 | 1.1 |
| 14 | ✅ 1.4 Spine observability hardening — H1/H3 closed (PR #208) | P1 | — |
| 14a | ✅ 1.5 Ingest runtime reliability + dashboard performance — freeze causes fixed, P1 follow-ups documented (PR #220) | P1 | — |
| 15 | ✅ 2.4 Regression history dashboard (PR #217) | P2 | 2.3 |
| 15a | **1.6 Durable run execution** (HIGH PRIORITY — from the [Stage 1.5 review](reviews/connect-runtime-reliability-perf.md)) ← **NEXT** | P1 | 1.5 |
| 15b | ✅ 1.7 Deploy-time migrations — runtime DDL off in prod (PR #224) | P1 | 1.5 |
| 15c | ✅ 1.8 Stats caching + single resolution — 1 stats call/hub request (PR #223) | P1 | 1.5 |
| 15d | ✅ 1.9 Writer batching phase 2 — one round-trip per Surreal batch (PR #233) | P1 | 1.5, 3.2 |
| 16 | ✅ 3.1 Verified-memory design ADR (PR #195) | P3 | 1.0c |
| 17 | ✅ 3.2 Incremental re-ingest (PR #225; Surreal BYO degrades to full ingest pending 3.2b) | P3 | 3.1 |
| 17a | 3.2b BYO Surreal incremental re-ingest — **user-controlled opt-in version table** (ADR open question 1 decided 2026-06-10) | P3 | 3.2 |
| 18 | ✅ 4.2 MCP quickstart + catalog listings prepared in-repo (PR #232; external submissions await product owner) | P4 | 4.1, 1.0b |
| 19 | 3.3 Temporal validity + as-of retrieval | P3 | 3.2 |
| 20 | 3.4 Agent memory write API | P3 | 3.3, 4.1 |
| 21 | ✅ 4.3 AAIF verification envelope (PR #231) | P4 | 4.1 |

**Stage 1.0a — measured baseline + signed-off bars (2026-06-10).** Snapshot:
[`scripts/reviews/verifier-efficacy-results-2026-06-10.json`](../scripts/reviews/verifier-efficacy-results-2026-06-10.json)
(PR #202; with-extraction, 3 runs; extractor `openai:gpt-4o-mini`; validators
`openai:gpt-4o-mini` same-model control, `together:meta-llama/Llama-3.3-70B-Instruct-Turbo`
cross-model). Measured: cross-model recall 100% on all three planted-bad tiers
(fabricated/overstated/misattributed), false-flag 14.5%, affirm-unseen (fail-open probe) 0%;
same-model recall 100%/83.3%/83.3%, false-flag 4.3%, **affirm-unseen 66.7%**; cross−same
all-bad strict recall delta **+11.6pp**. Publishable bars **signed off by the product owner
2026-06-10** (claims-ledger rows may cite them as proven once 2.3 re-runs them in CI):

- fabricated-tier recall ≥ 95% (cross-model, measured 100%)
- cross-model misattribution recall ≥ 90% (measured 100%)
- false-flag rate ≤ 15% (cross-model, measured 14.5%)
- affirm-unseen (fail-open probe) = 0% under cross-model routing (measured 0%)

Bars are bound to cross-model routing — the same-model control (66.7% affirm-unseen) is
the measured argument for why routing validator family ≠ extractor family is the product
default, not an option. A model/route change that drops any bar breaks the ledger's
"proven" status until it recovers (operating note below).

---

## Stage 0 — Focus cuts (do by hand, no agent run)

- Freeze gateway feature work: Keys is the control plane for verified context, not a
  LiteLLM competitor. New gateway features need a written exception.
- Finish ONE BYO store well: Surreal. Keep Neo4j/Weaviate at config-only (the wizard now
  says so honestly — PR #190); do not widen the adapter matrix until P3 lands.
- Hold the legacy npm deprecation line (2026-12-01, `npm-to-rest-keys.md`).
- Merge the in-flight quality PRs first: #189 (fail-safe coverage), #190 (wizard UX),
  #191 (ingest progress).

---

## Pivot 1 — The Verified Context Layer (front the spine)

### Stage 1.0a — Verifier efficacy benchmark (prove the gate catches what we claim)

```
ROLE
You are a senior engineer building ground-truth measurement of the validation stage
ITSELF. The pipeline's G2 metrics report what the validator concluded; this stage
measures whether the validator's conclusions are correct.

TARGET
A labeled benchmark proving (or disproving, honestly) that Connect's validation stage
catches bad claims, measured under FULL CROSS-MODEL routing (validator family ≠ extractor
family — the production property the marketing claim depends on). Fixtures where we KNOW
which claims are unsupported because we planted them, and a harness reporting validator
recall/precision per difficulty tier, per family pairing, and same-model vs cross-model.

FIRST
- packages/connect-core/src/ingest/validation.ts (validateUnits / validateUnitsBatch —
  the real path; DI generate of type ExtractionGenerate) and golden-eval.ts (fixture
  shape, computeG2Metrics, fingerprinting).
- plan.ts (how cross-model validation routing is expressed — validator deliberately a
  different family than the extractor).
- apps/dashboard/src/lib/server/connect/stage-route-generate.ts and llm-generate.ts:
  the production wiring that builds per-stage ExtractionGenerate functions bound to
  resolved routes (StageGenerates.validation vs .extraction). This is how cross-family
  independence is realized; the benchmark must exercise it, not a single-provider proxy.
- scripts/reviews/connect-ingest-failopen-repro.ts for the harness/script idiom (note:
  that one is no-keys; THIS harness needs live keys for ≥2 families).

ACCEPTANCE CRITERIA
- Labeled fixture set under packages/connect-core/src/ingest/golden/fixtures/:
  Restormel-authored (or CC0) source texts with claim sets labeled supported/unsupported,
  planted bad claims at three tiers — (1) fabricated (no basis), (2) overstated (source
  says less), (3) misattributed (true ELSEWHERE in the corpus, cited to the wrong source).
  Tier 3 is the one competitors fail and the one EBV must structurally fix later; author
  it properly, do not skip it.
- Cross-model harness: runs the real validateUnits path with a validation-stage generate
  bound to a DIFFERENT family than the extraction generate. PREFER driving the production
  route stack (stage-route-generate) so the measured path == the shipped path; if standing
  up the workspace/route config proves disproportionate to a benchmark, STOP and ask before
  falling back to a harness-level multi-family adapter. Report per family-pairing AND a
  same-model control (validator family == extractor family) so the cross-model DELTA is the
  headline number.
- Versioned JSON output: recall on planted-bad per tier, precision on known-good
  (false-flag rate), per pairing, cross-model vs same-model delta, verdict calibration
  (weak vs unsupported per tier). Harness supports --runs N; reports mean ± spread
  (judges are stochastic).
- PREREQUISITES the PR must document: which two families/routes were used, their model
  versions, and the workspace/route setup (so the run is reproducible). Keys are NEVER
  committed.
- STOP-and-ask gate: propose minimum publishable bars (e.g. fabricated-tier recall ≥ X%,
  cross-model misattribution recall ≥ Z%, false-flag ≤ Y%) WITH measured numbers in hand;
  a human signs off. Do not pick bars unilaterally; do not tune prompts to the benchmark
  here (that is a later stage with a held-out split).
- The PR reports measured numbers verbatim, including failures. Poor efficacy IS a valid
  deliverable — it sets how strong Stage 1.3's language may be and seeds the EBV urgency.

LIVE-KEY BOUNDARY (per the delivery protocol)
This stage splits cleanly: the agent run delivers fixtures + harness + stub-tested code +
the documented run command + route/workspace setup notes (keyless, shippable as a PR). The
keyed cross-model measurement and the bar sign-off are the human/CI step run by whoever
holds the family-A and family-B keys. Do not block the PR on the agent possessing keys.

PROCESS
pnpm --filter @restormel/connect-core typecheck && test (harness unit-tested with a
deterministic stub generate); then the keyed run, output quoted in the PR + committed as a
dated, model-versioned results snapshot.

Use effort: xhigh.
```

### Stage 1.0c — EBV Layer 1: evidence binding + deterministic verification

```
ROLE
Senior engineer implementing Layer 1 of the signed-off Evidence-Bound Verification ADR
(docs/decisions/evidence-bound-verification.md). If the ADR is not signed off, STOP.

TARGET
Every extracted claim carries evidence spans (exact quote + char offsets + source-version
content hash); a deterministic post-extraction step verifies each span exists at its
offsets in the cited source version; verification states become
supported|inferred|unverified|contradicted|excluded with an unverified→review queue.
A claim with no bindable evidence can never be "supported".

FIRST
Read the ADR in full. Then: extraction contract + analyzeExtraction (extract.ts,
prompt-compose.ts EXTRACTION_OUTPUT_CONTRACT — the evidence? field exists), the passage
schema fields in domain packs (passage_table, source_text_field, passage_text_field),
both graph writers (graph-writer.ts), provenance-trace contracts, and the
verification-rules engine (packages/graphrag-core/src/verification/rules/) — Layer 1
checks belong there as declarative rules.

ACCEPTANCE CRITERIA
- Extraction prompts require supporting quotes; the binder resolves quotes to offsets
  with exact match after normalization, bounded fuzzy fallback recorded as fuzzy.
- Source versions get content hashes at parse time; bindings record the hash.
- Deterministic re-check is exposed as a pure function AND a verification rule, runnable
  without any LLM (extend the no-keys repro-script idiom with an EBV script).
- Misattribution is structurally caught: a test plants a quote from source B cited
  against source A and the binding fails.
- States persisted by both writers; unverified claims enter a reviewable state — reuse
  the existing reversible soft-exclude machinery for storage; if a genuinely new state
  column/table is required on user-owned Surreal schemas, STOP and propose the migration.
- Backfill command for existing graphs: bind where recoverable, else mark unverified —
  never silently demote to excluded or silently keep as supported.
- connect-core + dashboard typecheck/tests green; new unit tests for binder edge cases
  (unicode/whitespace normalization, repeated quotes, near-duplicate spans).

Use effort: xhigh. Layer 1 only — do NOT touch the LLM validation stage in this run.
```

### Stage 1.0d — EBV Layer 2: span-scoped entailment with abstention

```
ROLE
Senior engineer replacing prefix-batch validation with span-scoped entailment per the
EBV ADR. Requires Stage 1.0c merged.

TARGET
The validation stage becomes: per claim, judge "does THIS bound span entail THIS claim?"
(claim + its 1–3 spans only — no 12k source prefix). Verdicts: entailed | not_entailed |
abstain + confidence, recorded with model id, prompt version, timestamp. Abstention and
low confidence route to the review queue (never laundered into weak). Cross-model
routing retained (judge family ≠ extractor family, plan.ts).

ACCEPTANCE CRITERIA
- The fail-safe coverage semantics from PR #189 are preserved exactly: an omitted or
  unparseable verdict is a coverage gap, never a pass.
- Verdict metadata (model, prompt version, time) lands in the provenance trace; the
  same claim can be re-judged later and both verdicts retained (audit history).
- k-sample self-consistency available behind a pack/preset flag for high-stakes packs;
  disagreement → review.
- Batching is per-passage (multiple claims sharing a span may share a call) — show the
  cost comparison vs the old validator in the PR using the 1.0a harness corpus.
- Remediation integration: "repair" re-binds evidence for repaired text before it can
  return to supported (re-validate already exists; re-bind is the new requirement).
- Old validation path stays available behind a flag for one release for comparison runs,
  then is removed (note the removal condition in the PR).
- Run the Stage 1.0a harness and report before/after numbers verbatim in the PR.

Use effort: xhigh. STOP if the entailment task needs a new model route capability that
plan.ts cannot express — propose the routing change first.
```

### Stage 1.0b — Marketing claims ledger (every public claim maps to evidence)

```
ROLE
Engineer-writer creating the contract between what Restormel says and what it can prove.

TARGET
docs/verified-context-claims-ledger.md: a table where every public marketing claim maps
to (a) the precise measurable assertion behind it, (b) the automated evidence — a test,
benchmark, repro script, or CI gate that runs continuously, (c) current status:
proven | partial | unproven. Stage 1.3 and Stage 4.2 copy may only use "proven" rows.

FIRST
Read the Stage 1.0a results, packages/connect-core/src/__tests__/stages.test.ts +
golden-eval.test.ts (the fail-safe coverage proofs from PR #189),
scripts/reviews/connect-ingest-failopen-repro.ts, the provenance-trace and
verification-rules tests, and assertG2Targets.

ACCEPTANCE CRITERIA
- Seed rows at minimum (each phrased as the marketing-facing sentence, then the
  assertion, then the evidence pointer):
  · "Every claim is validated against its source" → coverage finalizers default
    omitted units to non-passing (stages.test.ts, repro C1) → proven.
  · "Unsupported claims are excluded, not blended" → remediation fail-safe + orchestrator
    soft-exclude + (post-4.1) MCP strict mode test → status as measured.
  · "A different model family checks the extraction" → plan.ts routing test → verify one
    exists; if not, write it in this stage.
  · "The validator catches fabricated claims" → Stage 1.0a fabricated-tier recall ≥
    signed-off bar, re-run in CI → status from the benchmark.
  · "Every claim carries a provenance trace" → Stage 1.1 envelope test → status.
  · "Published quality bar: ≥90% supported, ≤2% unsupported" → assertG2Targets +
    (post-2.3) CI gate → status.
- Each "proven" row names the exact test/command a skeptic can run.
- Rows that are partial/unproven get an owner stage in this roadmap (link it).
- A PR-template note (or CONTRIBUTING section) requiring marketing-copy PRs to cite
  ledger rows; the restormel-suite-integrations-marketing skill register is updated to
  reference the ledger as canonical truth.
- No code changes beyond any missing test identified above.

Use effort: high.
```

### Stage 1.1 — Verified-context API surface

```
ROLE
You are a senior engineer turning existing internal verification machinery into the
product's headline API surface. Minimal new logic; maximal exposure of what exists.

TARGET
Every Connect retrieval/read response must be able to carry, per claim: verification
status (ok|weak|unsupported|excluded), source citation, provenance trace link, and the
graph's trust score. The machinery exists; the contract does not.

FIRST
1. Read docs/reviews/connect-ingest-context.md (orientation) and the merged v1 surfaces:
   apps/dashboard/src/lib/server/connect-v1/provenance-trace-builder.ts, trace-handler.ts,
   verification-rules-handler.ts, retrieve-service.ts, and the routes under
   src/routes/(marketing)/connect/v1/ (traces/[traceId], traces/[traceId]/export,
   verification-rules). Also packages/contracts/src/provenance-trace.ts and
   verification-rules.ts, and packages/graphrag-core/src/verification/rules/.
2. Map which retrieval responses already include verification fields and which do not.

ACCEPTANCE CRITERIA
- A single documented response envelope (in @restormel/contracts) for "verified claim":
  { claim, state, evidence: [{quote, offsets, source_ref, source_hash}], judge?: {model,
  prompt_version, confidence, at}, citation, trace_ref, trust_score? } — per the EBV ADR
  (docs/decisions/evidence-bound-verification.md); reuse existing contract types, do NOT
  invent parallel shapes. If a needed field has no existing source of truth, STOP and
  ask before adding schema.
- Connect v1 retrieve responses include the envelope per returned unit; unverified or
  excluded units are flagged, never silently blended.
- One canonical guide at /keys/docs/guides/verified-context explaining: the pipeline's
  fail-safe gates, the G2 bar, trace export, verification rules — written for a buyer's
  auditor, not just a developer (use the restormel-admin-technical-writing skill register).
- apps/dashboard/static/keys/openapi.json regenerated to cover the surfaced endpoints.
- Existing tests pass; new tests cover the envelope on the retrieve path.

PROCESS
1. Contract first (packages/contracts), then handler wiring, then docs.
2. Run and report verbatim:
   pnpm --filter @restormel/contracts test && pnpm --filter dashboard check && pnpm --filter dashboard test
3. PR: before/after response examples, the envelope contract quote, doc link.

Use effort: xhigh. Scope is exposure + docs, not new verification logic.
```

### Stage 1.2 — Trust scorecard (per-graph, public-shaped)

```
ROLE
Senior engineer productizing the run quality report into a persistent per-graph scorecard.

TARGET
A graph's quality must be inspectable at any time — not only in the run console after an
ingest. Surface: trust score (kg-audit/trust-score.ts), G2 metrics (ok/weak/unsupported,
ok_pct vs the 90% bar), coverage gaps (count of "coverage_gap" validation notes and
defaulted remediation drops — see PR #189 semantics), embedding coverage, last-verified-at.

FIRST
Read apps/dashboard/src/lib/server/connect/run-quality-report.ts, kg-audit/trust-score.ts,
graph-explorer-service (resolveConnectGraphStats), and the admin ingest-quality page
(src/routes/keys/admin/ingest-quality, IngestQualityCallout).

ACCEPTANCE CRITERIA
- GET endpoint under connect v1 returning the scorecard for the workspace's active graph;
  envelope versioned in @restormel/contracts.
- Dashboard scorecard panel on the Connect hub (BrutalCard, ux-contracts state model:
  loading/error/empty each with recovery) and a "what lowered this score" breakdown.
- Scorecard appears in the pipeline launch step's "What to expect" block when a previous
  run exists (extends ConnectPipelineReviewLaunch — keep the wizard gating intact).
- No new stats queries invented where resolveConnectGraphStats already serves (note its
  store-aware force-refresh semantics from PR #191).

PROCESS
Typecheck + dashboard tests + svelte-check; PR with screenshots of the scorecard states.
Use effort: xhigh.
```

### Stage 1.3 — Marketing reposition ("the context layer your auditors can read")

```
ROLE
Product marketing engineer updating the suite story. Use the restormel-suite-integrations-
marketing and restormel-use-cases-page skills; honor restormel-neu-brutalist-ui and the
copy registry (docs/ux-contracts.md §2 — note the new Connect nouns).

TARGET
/, /connect (marketing), /keys/use-cases: lead with Verified Context — provenance-traced,
quality-gated knowledge for agents in regulated domains. Keys is repositioned as the
control plane FOR verified context; gateway comparisons are removed, not rebutted.

ACCEPTANCE CRITERIA
- Every quality/verification claim on the page cites a row in
  docs/verified-context-claims-ledger.md with status "proven" — quote the row in the PR.
  If a phrase you want has no proven row, weaken the phrase or STOP and flag the gap;
  never ship the phrase on a partial/unproven row.
- Hero + proof section demonstrating "why did the agent say that?": claim → citation →
  trace export, using the Stage 1.1 guide as canonical truth (link, don't duplicate).
- The G2 bar and trust score stated as published, testable quality bars; verifier
  efficacy numbers (Stage 1.0a) stated with their measurement date and model versions.
- One regulated-industry use case block (legal/pharma/finance) with the audit-trail angle.
- No invented benchmarks or competitor claims; same-links compliance per the integration
  docs hub rules.

PROCESS
svelte-check + visual pass; PR with before/after screenshots.
Use effort: high.
```

### Stage 1.5 — Ingest runtime reliability + dashboard performance (added 2026-06-10, priority)

```
ROLE
Senior engineer diagnosing three product-owner-reported runtime problems. Primarily a
DIAGNOSIS stage with bounded high-confidence fixes; scope-changing findings are raised
as questions per the delivery protocol.

REPORTED PROBLEMS
1. Ingestion/revalidation/remediation runs freeze randomly — no progress, no error.
2. Graph stats take far too long to load.
3. The dashboard is generally laggy — poor user experience.

DELIVERABLES
- docs/reviews/connect-runtime-reliability-perf.md: findings with evidence (file:line,
  code path, mechanism), classified P0 (freeze) / P1 (major latency) / P2 (general lag),
  a concrete proposed fix + risk per finding, and a "needs runtime data" telemetry list.
- Bounded fixes in the same PR for high-confidence low-risk items only (timeouts on
  unbounded LLM calls, batching per-row DB loops, missing indexes, duplicate query
  collapse). No orchestrator restructuring; no fail-safe semantics changes.
- connect-core + dashboard typecheck/tests green.

Use effort: xhigh on the freeze diagnosis.
```

### Stage 1.4 — Spine observability hardening (closes review items H1/H3)

```
ROLE
Senior engineer closing the two confirmed-but-deferred findings from
docs/reviews/connect-ingest-context.md §6 now that C1–C3 are fixed (PR #189).

TARGET
H1: loose-JSON parse loss is fail-safe but silent — parsers must signal "parse failed /
batch lost" so orchestrators can warn and re-ask once. H3: extraction gate ignores
orphan_units / dangling_relation / no_relations warnings, and the strict pattern_violation
branch still allows persist.

FIRST
Reproduce current behavior with scripts/reviews/connect-ingest-failopen-repro.ts (H1
section). Read validation.ts/remediation.ts parsers, extraction-gates.ts, extract.ts
analyzeExtraction, and the dashboard callers (ingest-full-runner.ts,
graph-remediation-pass.ts — both recently changed in PR #191; build on that shape).

ACCEPTANCE CRITERIA
- Parsers expose parse-failure signal WITHOUT breaking the existing return contract for
  current callers (e.g. an optional structured result alongside the legacy function, or a
  widened return the callers adopt in the same PR). If you conclude the only clean fix
  breaks @restormel/connect-core's public API for external consumers, STOP and ask.
- On a lost batch the orchestrator logs a coverage-shortfall warning with the omitted ref
  count and re-asks that batch exactly once before fail-safe defaults apply.
- evaluateExtractionGate gates on orphan/dangling thresholds — thresholds must be
  pack-or-preset-driven, not hardcoded; production preset blocks, starter warns. The
  pattern_violation branch's allowPersist contradiction is resolved deliberately and
  documented in the PR.
- Repro updated: H1 section shows the warn + re-ask; new H3 section added.
- pnpm --filter @restormel/connect-core typecheck && test; dashboard check + test.

Use effort: xhigh. STOP-and-ask gate as above — do not silently break public API.
```

---

## Stages 1.6–1.9 — runtime reliability follow-ups (added 2026-06-10, from the Stage 1.5 review)

Source of truth for findings/evidence: [docs/reviews/connect-runtime-reliability-perf.md](reviews/connect-runtime-reliability-perf.md).

### Stage 1.6 — Durable run execution (removes the P0 freeze class)

```
ROLE
Senior engineer making ingest runs survive instance recycling. Review finding F1: runs
execute as a detached promise inside a request invocation; a killed instance leaves the
job 'running' forever (no stale reclaim). waitUntil (PR #220) extends the window but is
not durability.

TARGET
Jobs carry a lease + heartbeat; a reclaim path returns stale 'running' jobs to a
restartable state (never silently re-running side effects — resume must respect the
existing resume-stage checkpoints); execution moves out of the request path (cron-drain
route with maxDuration, designed so a Coolify worker can replace it per the infra
migration). A frozen run becomes a visible, restartable failure.

ACCEPTANCE
- Lease/heartbeat columns via migration; claim honors lease expiry; reclaim marks the job
  + run console with a clear 'reclaimed after stall' event (operator-visible, never silent).
- Heartbeat is written by the worker loop, not the progress reporter alone.
- Resume after reclaim reuses completed-stage checkpoints (resume-stage.ts) — no
  double-spend on completed LLM stages.
- Unit tests for lease expiry, reclaim, no-double-claim (two concurrent claimers), and
  checkpointed resume. Dashboard check/tests green.
Use effort: xhigh — concurrency correctness is the whole point.
```

### Stage 1.7 — Deploy-time migrations (review F5)

```
ROLE
Senior engineer retiring the runtime DDL ensure (~120 sequential statements before the
first query on cold start — the largest stats/dashboard latency contributor).

TARGET
Migrations under apps/dashboard/migrations/ are applied at deploy time (the CI job
"Apply dashboard migrations" exists — make it authoritative); runtime ensure* functions
become no-ops behind a flag default-off in production (kept for dev), with a startup
assertion that the schema version matches.

ACCEPTANCE
- One migrations table tracking applied files; deploy workflow applies pending ones
  before traffic shifts; .forgejo variant updated in the same PR.
- Runtime ensures gated by CONNECT_RUNTIME_DDL (default on in dev, off in prod build);
  prod boot verifies schema version and fails loudly with the missing-migration name.
- Rollback note per migration documented. Dashboard check/tests green.
```

### Stage 1.8 — Stats caching + single resolution per request (review F6/F7)

```
ROLE
Senior engineer collapsing redundant stats work per hub load.

TARGET
One stats resolution shared per request (hub pulse + scorecard + history reuse it); a
short-TTL spine cache with explicit force-refresh preserved (PR #191 semantics); a
negative-result TTL for Surreal domain-pack probing so cold caches stop probing every
pack on every load.

ACCEPTANCE
- resolveConnectGraphStats called at most once per hub request (test asserts call count);
  force-refresh path still bypasses caches.
- Cache TTLs env-tunable; defaults documented; stale-while-refresh acceptable but never
  stale force-refresh.
- Measured before/after: count of spine/Surreal queries per hub load quoted in the PR.
Dashboard check/tests green.
```

### Stage 1.9 — Writer batching phase 2 (review F4 residue; AFTER 3.2 merges)

```
ROLE
Senior engineer finishing the round-trip elimination PR #220 started.

TARGET
Order-preserving batch insert for extraction writes; batched Surreal scripts for
evidence/state/judgment writes with the per-unit read-back verification semantics
preserved (degraded persistence stays visible, never silent).

ACCEPTANCE
- Round-trips per 300-unit source measured before/after and quoted in the PR.
- persisted/missed reporting identical in shape and meaning; SCHEMAFULL warning intact.
- Builds on Stage 3.2's merged writer changes — do not fork them.
```

## Pivot 2 — Context Regression CI ("evals for your knowledge, not your prompts")

### Stage 2.1 — Headless `connect eval` CLI

```
ROLE
Senior engineer adding a headless quality-evaluation command to the existing CLI.

TARGET
`keys connect eval` (packages/cli — follow the command pattern of src/commands/replay.ts
and rules.ts): runs the golden evaluation against a graph/source set without the dashboard,
emits a JSON verdict { g2: {ok,weak,unsupported,ok_pct,unsupported_pct}, trust_score,
coverage_gaps, pass, reasons } and human-readable summary, with STABLE EXIT CODES
(0 pass / 1 quality-fail / 2 config-error — follow packages/validate's precedent).

FIRST
Read packages/connect-core/src/ingest/golden-eval.ts (computeG2Metrics, assertG2Targets,
PHILOSOPHY_STARTER_GOLDEN, goldenExtractionEvalFingerprint), packages/cli/src/commands/*,
and how readiness runs execute evaluation server-side. Decide and state in the PR whether
the CLI calls the Connect v1 API (preferred — keys + gateway auth exist) or runs locally.

ACCEPTANCE CRITERIA
- Command works against a live workspace with RESTORMEL_GATEWAY_KEY; --json and --fixture
  flags; documented in packages/cli README + /keys/docs.
- Verdict schema versioned in @restormel/contracts (it becomes the CI contract).
- Unit tests for verdict mapping + exit codes (vitest, see replay-diff.test.ts style).
- If evaluation requires a server capability that doesn't exist yet (e.g. a v1 endpoint
  to trigger golden eval), STOP and propose the minimal endpoint before building it.

Use effort: xhigh.
```

### Stage 2.2 — Quality baseline + regression diff

```
ROLE
Senior engineer adding baseline/diff semantics to `keys connect eval`.

TARGET
`keys connect eval --baseline <file|ref>` compares the current verdict to a stored
baseline and reports REGRESSIONS: ok_pct delta beyond tolerance, NEW unsupported claims
(by claim identity, not count), trust-score drop, new coverage gaps. Baselines are keyed
by source-set fingerprint (goldenExtractionEvalFingerprint) so a changed corpus is a new
baseline, not a regression.

ACCEPTANCE CRITERIA
- `--save-baseline` writes a committed-friendly JSON artifact; diff output is a markdown
  table suitable for PR comments (follow packages/cli/src/replay-format.ts conventions).
- Regression verdict has its own exit code distinct from absolute-bar failure.
- New-unsupported-claim detection cites the claim text + source ref (this is the headline
  feature — a reviewer must see WHICH claim went bad).
- Tests cover: no-change, threshold regression, new unsupported claim, fingerprint change.

Use effort: xhigh.
```

### Stage 2.3 — CI gate: GitHub Action + Forgejo workflow

```
ROLE
Senior engineer packaging Stage 2.2 as a CI gate.

TARGET
A composite GitHub Action (follow packages/testing-github-action exactly — inputs,
action.yml, README) plus a .forgejo/workflows example, that runs `keys connect eval
--baseline`, posts/updates ONE sticky PR comment with the regression table, and fails the
check on regression. Remember .forgejo/workflows overrides .github on the Forgejo mirror;
push the .forgejo variant in the same PR.

ACCEPTANCE CRITERIA
- Action inputs: gateway key (secret), project/workspace ref, baseline path, tolerance.
- Sticky comment (update-in-place, no comment spam) with the markdown diff table.
- Dogfood: wire it into THIS repo's CI against the philosophy starter fixture so every
  PR to connect-core proves the gate works (non-blocking warn mode initially; flag to
  flip to blocking later — note the flip condition in the PR body).
- Claims-integrity wiring: a scheduled (weekly) run executes the Stage 1.0a efficacy
  benchmark UNDER CROSS-MODEL ROUTING (≥2 model families' keys provisioned as CI secrets)
  and fails if any signed-off bar regresses — this is what keeps the claims ledger's
  "proven" rows continuously true as models/routes change. The run updates a dated results
  snapshot the ledger links to. Note the cross-model key cost in the PR; if weekly
  cross-model CI is too costly, propose a cheaper cadence/sampling and flag for sign-off.
- Docs page: /keys/docs/guides/context-regression-ci.

Use effort: xhigh.
```

### Stage 2.4 — Regression history in the dashboard

```
ROLE
Senior engineer surfacing eval/regression history per graph.

TARGET
A "Quality history" panel on the Connect hub: timeline of eval verdicts (CLI- and
run-produced), G2/trust trends, regression events. Follow the readiness-runs library
pattern (ConnectReadinessLibrary, graph-revalidate-service) and BrutalCard idiom.

ACCEPTANCE CRITERIA
- Verdicts persisted via a v1 ingest endpoint the CLI/Action can POST to (auth: gateway
  key); schema shared with Stage 2.1 contracts.
- ux-contracts state model on the panel; empty state explains how to wire the CI gate
  (link to the Stage 2.3 guide).
- Dashboard check + tests green.

Use effort: high.
```

---

## Pivot 3 — Verified Memory (temporal + incremental)

### Stage 3.1 — Design ADR (STOP-gated; no implementation)

```
ROLE
Software architect. Deliverable is an ADR in docs/decisions/ — NO code changes.

TARGET
docs/decisions/verified-memory-incremental-ingest.md deciding:
1. Claim identity & versioning across re-ingests (stable unit identity when source text
   shifts; supersession chain with provenance to the prior version).
2. Temporal validity (valid_from / valid_to / superseded_by) — where it lives per store
   (Neon spine vs Surreal BYO) and how the readiness-runs cohort invariant (Surreal
   unit-id format must match across services) is preserved.
3. Incremental re-ingest contract: a changed source re-runs extraction/validation for its
   own units only; cost model vs full re-ingest; how G2/trust are recomputed without
   whole-graph passes.
4. What is explicitly NOT being built (no LOCOMO benchmark chase; no real-time
   conversational memory in this phase).

FIRST
Read docs/decisions/aaif-envelope-placement.md for ADR shape; graph-writer.ts (both
writers), source-documents + selection services, golden-eval fingerprinting, and the
remediation supersession semantics (soft-exclude, never hard-delete).

ACCEPTANCE CRITERIA
- Options considered with trade-offs; a recommendation; migration sketch for existing
  graphs; explicit open questions list.
- END by presenting the recommendation for human sign-off. Do NOT proceed to
  implementation in this run regardless of confidence.

Use effort: xhigh.
```

### Stage 3.2 — Incremental re-ingest (implements the ADR)

```
ROLE
Senior engineer implementing the signed-off ADR (docs/decisions/
verified-memory-incremental-ingest.md). If the ADR is not merged/signed off, STOP.

TARGET
Re-ingesting a changed source updates only that source's claims: unchanged units keep
their verification state; changed units re-validate; removed units are superseded
(reversible, provenance-chained) — never orphaned or silently kept.

ACCEPTANCE CRITERIA (beyond the ADR's own)
- A re-ingest of an UNCHANGED source is a near-no-op (assert call counts in tests).
- Provenance trace shows the supersession chain.
- The Stage 2.2 regression diff correctly attributes changes to the re-ingested source.
- Full pipeline run behavior unchanged for first-time ingests.
- connect-core + dashboard typecheck/tests; repro-style script demonstrating
  unchanged/changed/removed-source scenarios committed under scripts/.

Use effort: xhigh.
```

### Stage 3.3 — Temporal validity + as-of retrieval

```
ROLE
Senior engineer adding fact-validity windows per the ADR.

TARGET
Claims carry valid_from/valid_to/superseded_by; Connect v1 retrieve accepts as_of and
returns only claims valid at that instant, with superseded claims available behind an
explicit flag (audit view). The verified-claim envelope (Stage 1.1) gains the temporal
fields.

ACCEPTANCE CRITERIA
- Both writers (Postgres spine, Surreal) honor the fields; cohort invariant preserved.
- as_of queries covered by tests including a supersession boundary case.
- Scorecard (1.2) shows % of graph with temporal coverage.
- STOP if the Surreal BYO schema requires breaking changes to user-owned tables —
  propose the migration rather than applying it.

Use effort: xhigh.
```

### Stage 3.4 — Agent memory write API ("verified memory")

```
ROLE
Senior engineer opening a write path for agent observations through the SAME quality gate.

TARGET
POST /connect/v1/memory: an agent submits observations; they enter a small-batch
validation (+ remediation for weak) pass before persisting as claims with provenance
"agent_observation" + the submitting key's identity. Nothing reaches retrieval unverified.

ACCEPTANCE CRITERIA
- Reuses validation/remediation core (no parallel pipeline); batch size tuned for small
  payloads; rate/size limits enforced at the route.
- Rejected/weak observations are returned to the caller with reasons (fail-closed, but
  transparent).
- MCP tool added in @restormel/mcp (pairs with Stage 4.1 retrieval).
- Security review pass per the restormel-high-risk-security skill before PR (new write
  surface + auth).

Use effort: xhigh.
```

---

### Stage 3.2b — BYO Surreal incremental re-ingest (user-controlled opt-in)

```
ROLE
Senior engineer implementing the decided ADR open question 1
(docs/decisions/verified-memory-incremental-ingest.md): the USER decides whether
Restormel may create a version table in their BYO Surreal database.

TARGET
A workspace/store-level setting (default OFF) "Allow Restormel to manage claim versions
in this database". OFF: current Stage 3.2 behavior (Surreal re-ingest degrades to full
ingest with the explicit operator log). ON: Surreal re-ingest gains the full incremental
contract — restormel_claim_versions table created in the user's DB (additive-only,
clearly named), carried/changed/removed semantics matching the Postgres spine path.

ACCEPTANCE
- Setting persisted with the store connection config; surfaced in the setup wizard's
  store step with an honest explanation (what the table stores, additive-only, how to
  revoke); wizard gating intact; ux-contracts state model respected.
- OFF path unchanged and tested (degradation log still explicit, never silent).
- ON path: version chains in the user's Surreal DB; unchanged-source near-no-op holds;
  supersession reversible; unit-id shapes untouched (cohort invariant).
- Table creation failure (permissions) degrades to the OFF path with an operator-visible
  warning — never blocks the run, never silently pretends versions exist.
- Dashboard check/tests + connect-core tests green.
```

## Pivot 4 — MCP-native distribution

### Stage 4.1 — Verified-retrieval MCP tool

```
ROLE
Senior engineer making @restormel/mcp the reference "verified context" tool.

TARGET
An MCP retrieval tool whose results are verified-claim envelopes (Stage 1.1): claim +
status + citation + trace link. Unverified/excluded content is flagged or omitted per a
tool parameter (strict|annotated). Tool descriptions must teach the agent to cite.

FIRST
Read packages/mcp (existing tools, suite-tool-names.ts), the Stage 1.1 contract, and the
keys auth flow used by the MCP server (apps/mcp-server).

ACCEPTANCE CRITERIA
- Tool returns structured content suitable for direct citation by the calling agent;
  includes the trace export URL.
- strict mode returns ONLY ok-status claims; annotated returns all with statuses.
- Versioned alongside AAIF naming conventions; tests for both modes.
- Works against a live workspace via gateway key; documented in packages/mcp README.

Use effort: xhigh.
```

### Stage 4.2 — Quickstart + catalog distribution

```
ROLE
DevRel engineer making setup one command and the listing discoverable.

TARGET
`keys init --mcp` (or extend keys-cli init) emits a ready MCP config for Claude
Code/Desktop and Cursor; a /keys/docs/guides/mcp-verified-context quickstart; submission
PRs/listings prepared for the major MCP registries/catalogs (list them in the PR; do not
publish credentials).

ACCEPTANCE CRITERIA
- Fresh-machine walkthrough verified end-to-end and recorded in the PR (commands + output).
- Quickstart follows the integration-docs-hub same-links rules.
- Catalog metadata (name, description, categories) frames the tool as verified/citation-
  grounded retrieval — distribution copy matches the Stage 1.3 positioning.

Use effort: high.
```

### Stage 4.3 — AAIF verification envelope

```
ROLE
Senior engineer aligning AAIF so non-MCP agent frameworks consume the same contract.

TARGET
AAIF carries the verified-claim envelope in its context payloads (placement per
docs/decisions/aaif-envelope-placement.md — extend that ADR, don't contradict it), so a
LangChain/LlamaIndex/etc. integration gets verification metadata without MCP.

ACCEPTANCE CRITERIA
- packages/aaif schema + validate.test.ts coverage; runtime helper exposes
  verification fields; version bump per the package's semver discipline.
- One reference integration snippet in docs (consumption only, no new SDK).
- STOP if envelope placement requires a breaking AAIF major — propose first.

Use effort: xhigh.
```

---

## Operating notes

- **One stage per agent run**, PR-reviewed before the next fires. Stages marked
  STOP-gated must end at the gate even if the agent is confident.
- **Claims integrity is the standing gate**: no public claim ships without a
  claims-ledger row marked proven; the efficacy benchmark (1.0a) re-runs on a schedule
  (2.3) so "proven" stays true as models change. If a model/route change drops a bar,
  the marketing copy is treated as broken until the bar recovers or the copy is updated.
- **Re-baseline this doc** after stages 1.0a, 1.2, 2.3, and 3.1 land — each materially
  changes what later prompts should reference (1.0a especially: its measured numbers
  decide how strong Stage 1.3's language is allowed to be).
- **Marketing (1.3) waits for 1.0b + 1.1 + 1.2** so the site never claims what the API
  can't show or the benchmark can't support.
- Keep the dogfood loop: every pipeline-quality stage must extend
  scripts/reviews/connect-ingest-failopen-repro.ts or add a sibling script proving the
  behavior without live keys where feasible.

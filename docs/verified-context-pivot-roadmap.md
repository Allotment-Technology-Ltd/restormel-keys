# Verified Context — Pivot Delivery Roadmap

**Thesis** (from the June 2026 functionality/competitive review): routing is a commodity
(LiteLLM/OpenRouter/Portkey-OSS), graph-building is crowded (Mem0/Zep/Cognee/MS GraphRAG),
output evals are taken (Braintrust/DeepEval/Promptfoo) — but **provably trustworthy context**
is an empty category with a Gartner digital-provenance tailwind, and Restormel's verification
spine (validation → remediation fail-safe gates, G2 bar, trust score, provenance traces,
verification rules, cross-model validation) already enforces it end-to-end.

**How to use this doc.** Each stage is independently shippable and carries a ready-to-fire
prompt for a repo-grounded agent (Fable 5 / Opus via CLI), in the same style as
[`docs/reviews/connect-ingest-failopen-fix.md`](reviews/connect-ingest-failopen-fix.md) —
bounded scope, acceptance criteria, STOP gates, verification commands. Fire one stage per
agent run; review the PR; then fire the next. Definition of done for every stage: PR with
tests + docs, typecheck/test green, repro or demo command included in the PR body.

**The claims-integrity rule (non-negotiable).** Restormel must be able to verify *in the
way the marketing says it does*. The G2 bar and trust score report the pipeline's
**self-judgment**; they say nothing about whether the judge itself catches fabricated or
subtly-wrong claims. Therefore: (a) verifier efficacy is measured against ground truth
(Stage 1.0a) before any positioning work, (b) every public claim maps to an automated,
continuously-running piece of evidence in the claims ledger (Stage 1.0b), and (c) Stage
1.3 marketing may only use ledger rows marked **proven**. If measured efficacy does not
support a phrase, the phrase changes — not the measurement.

**Sequencing.**

| Order | Stage | Pivot | Depends on |
|---|---|---|---|
| 0 | Focus cuts (checklist, no agent) | — | — |
| 1 | 1.0a Verifier efficacy benchmark (ground truth) | P1 | — |
| 2 | 1.1 Verified-context API surface | P1 | — |
| 3 | 1.2 Trust scorecard | P1 | 1.1 |
| 4 | 2.1 Headless `connect eval` CLI | P2 | — (parallel with 1.x) |
| 5 | 1.0b Marketing claims ledger | P1 | 1.0a |
| 6 | 2.2 Quality baseline + regression diff | P2 | 2.1 |
| 7 | 1.3 Marketing reposition | P1 | 1.0b, 1.1, 1.2 |
| 8 | 2.3 CI gate (GitHub Action + Forgejo; runs 1.0a efficacy too) | P2 | 2.2 |
| 9 | 4.1 Verified-retrieval MCP tool | P4 | 1.1 |
| 10 | 1.4 Spine observability hardening (H1/H3) | P1 | — |
| 11 | 2.4 Regression history dashboard | P2 | 2.3 |
| 12 | 3.1 Verified-memory design ADR (STOP-gated) | P3 | — |
| 13 | 3.2 Incremental re-ingest | P3 | 3.1 |
| 14 | 4.2 MCP quickstart + catalog distribution | P4 | 4.1, 1.0b |
| 15 | 3.3 Temporal validity + as-of retrieval | P3 | 3.2 |
| 16 | 3.4 Agent memory write API | P3 | 3.3, 4.1 |
| 17 | 4.3 AAIF verification envelope | P4 | 4.1 |

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
catches bad claims: fixtures where we KNOW which claims are unsupported because we
planted them, and a harness reporting validator recall/precision per difficulty tier
and per model route.

FIRST
Read packages/connect-core/src/ingest/validation.ts, golden-eval.ts (fixture shape,
fingerprinting), plan.ts (cross-model validation routing — validator deliberately a
different model family than the extractor), the philosophy starter fixture, and
scripts/reviews/connect-ingest-failopen-repro.ts for the no-keys harness idiom.

ACCEPTANCE CRITERIA
- A labeled fixture set under packages/connect-core/src/ingest/golden/fixtures/:
  Restormel-authored (or CC0) source texts paired with claim sets labeled
  supported / unsupported, with planted bad claims at three tiers —
  (1) fabricated (no basis in source), (2) overstated (source says less),
  (3) misattributed (true elsewhere in the corpus, wrong source). Tier 3 is the one
  competitors fail; do not skip it because it is hard to author.
- An efficacy harness (script under scripts/, or `keys connect eval --efficacy` if
  Stage 2.1 has landed) that runs the real validateUnits path against the fixtures and
  reports, in versioned JSON: recall on planted-bad per tier, precision on known-good
  (false-flag rate), per route/model, cross-model vs same-model delta, and verdict
  calibration (how often "weak" vs "unsupported" is assigned to each tier).
- Repeatability: N-run variance reported (LLM judges are stochastic); the harness
  supports --runs N and reports mean ± spread.
- STOP-and-ask gate: propose the minimum publishable bars (e.g. "fabricated-tier
  recall ≥ X%, false-flag rate ≤ Y%") with the measured numbers in hand — a human
  signs off on the bars. Do not pick the bars unilaterally, and do not tune prompts
  to the benchmark in this stage (that is a follow-up with a held-out split).
- The PR reports the measured numbers verbatim, including failures. If efficacy is
  poor, that IS the deliverable — it redirects Stage 1.3's language and creates the
  prompt-improvement backlog.

PROCESS
pnpm --filter @restormel/connect-core typecheck && test; harness run output quoted in
the PR. Requires live model keys for the real measurement — run locally, commit the
harness + fixtures + a results snapshot (dated, model-versioned), not the keys.

Use effort: xhigh.
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
  { claim, status, citation, trace_ref, trust_score? } — reuse existing contract types;
  do NOT invent parallel shapes. If a needed field has no existing source of truth,
  STOP and ask before adding schema.
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
  benchmark and fails if any signed-off bar regresses — this is what keeps the claims
  ledger's "proven" rows continuously true as models/routes change. The run updates a
  dated results snapshot the ledger links to.
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

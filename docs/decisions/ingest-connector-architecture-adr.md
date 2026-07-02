---
id: REC-ADR-023
title: "ADR — Ingest Pipeline as a Connector Abstraction with a Dual-Mode Tiered Verification Cascade"
class: decision
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-07-01
last-reviewed: 2026-07-01
review-interval: P12M
retention: permanent
related: [REC-ADR-001, REC-PLAN-026, REC-PLAN-023, REC-GOV-022, REC-PLAN-025]
---

> **Filed via Cowork horizon handover, 2026-07-01.** Decision record, sibling to `docs/decisions/records-architecture.md` (REC-ADR-001). **Status: Proposed** (see body). Linked build items: the extraction-connector spike (build step 1A) and the cascade-validation harness (step 2) are raised as PBIs; production component wiring is **GATED** on counsel clearance of REC-GOV-022. **Proposed id/status — reconcile against `records/register.yaml` at merge.**

# ADR: Ingest Pipeline as a Connector Abstraction with a Dual-Mode Tiered Verification Cascade

**Status:** Proposed
**Revision:** v2 — 2026-07-01, after strategic review. Adds dual-mode verification, the P1/P2 proxy tiers, first-class instrumentation, and a re-sequenced build. Supersedes v1 of this draft (batch-only).
**Hat:** PRODUCT
**Scope:** Technical architecture and UX only. Component licensing/commercial-terms review is a separate, parallel workstream and is out of scope here.
**Record ID:** to be assigned by Cowork on landing, per `records/SCHEMA.md`
**Supersedes:** the implicit status quo — a monolithic ingest pipeline, no connector abstraction, uncached per-claim frontier verification, batch-only consumption
**Related:** the ingest-connector spike brief (Claude Code); the cost-architecture and component research; the relentless-simplicity product principle; the P1/P2 proxy-tier decision (2026-07-01); Stage 5 (verifying proxy) in `/planning`

## Context

The current ingestion pipeline (extract → chunk → embed → retrieve/rerank → verify → store) is effectively monolithic: each stage's component is baked in, and the moat-core verification step runs a full check — implicitly a frontier-model call — on every claim, uninstrumented and uncached. Three consequences follow: verification cost is invisible and uncontrolled; the pipeline can't serve different deployment needs (managed vs self-host vs air-gapped) without forking; and it can't support the product's stated UX direction.

Two constraints decide this revision.

**Relentless simplicity.** Most users should connect a source and get verified context out, at one low price, with zero component choices. A minority will want to swap a component or run a different deployment topology; that should be a short, curated, one-click choice, never an assembly job. Restormel makes the cheap, complex decisions internally and hides them.

**Two doors, one engine.** The strategic review (2026-07-01) surfaced what v1 of this draft left silent: the verification engine must serve **two consumption modes**, because the strategy has two doors sharing one engine:
- **Door 1 — the first-party Connect pipeline:** corpora Restormel ingests; verification can run once, at ingest.
- **Door 2 — the verifying proxy (the strategic wedge):** third-party MCP/KB responses verified **in-path, per-request**. The programme plan treats the proxy go/no-go as the ceiling-setting question; an ingest-only architecture would foreclose it.

The proxy's open question is precisely economic — added latency and cost per verified third-party response. The cascade and hash-keyed cache below are the mechanisms that answer it. This re-architecture is therefore not door-1 housekeeping; done dual-mode, it is the enabling work for door 2.

Two further inputs converge on the same architecture:
- An **ingest-connector spike** proposed a contract-first abstraction for the extraction stage, with the source span/offset model as the provenance through-line, designed as instance #1 of a pattern reusable at later stages.
- **Component and cost research** found that the moat's own primitives — source-version hashing and abstention — double as cost-control mechanisms (caching and triage), and identified a current field of small, independent verifier models plus open-weight substrate components competitive with frontier/commercial options on the narrow tasks the pipeline needs.

This ADR adopts all of it as one architecture.

## Decision

**1. Every ingest stage sits behind a connector contract**, not a hardcoded component. The contract the verification spine consumes from any extractor — and, by extension, any ingest-stage component — is:

```
extract(source_document) -> {
  document: { source_id, version_hash_inputs, language, page_count,
              capability_tier },          # "spatial" | "textual"
  text_units: [{
    text,                                 # verbatim, faithful — no LLM reshaping
    source_locator:
        { kind: "spatial", page, bbox }   # rich provenance
      | { kind: "textual", offset, length, path? },
    confidence,                           # -> ingest-level abstention
    block_type?, reading_order?
  }]
}
```

`source_locator` is the through-line: it must survive extraction → chunking → embedding → retrieval → verification so a verified claim traces back to the exact source span, regardless of which component populates each stage. **Extraction is instance #1**; embedding/retrieval is instance #2, reusing the same contract.

The contract is **door-agnostic**: `source_locator` + `version_hash_inputs` are also what enables full-depth proxy verification (Tier P2, below) over third-party sources whose corpora Restormel has ingested and hashed. The ingest work is load-bearing for door 2, not a detour from it.

Two provenance fidelity tiers are supported and must be honestly labelled, never inflated: **Tier A (spatial)** — bounding boxes, full click-through-to-span; **Tier B (textual)** — offsets only, text-anchored provenance with no visual highlight.

**2. Chunking stays Restormel-owned**, not delegated to a component's internal auto-chunking. Some embedding models offer to chunk a document for you; accepting that would let chunk boundaries drift from the extractor's span anchors and break the provenance thread. Boundary control is retained even when an embedding component's contextualisation is used.

**3. The moat-core verifier is restructured into a tiered, cached cascade serving two consumption modes.**

*The engine (mode-independent):*
- A **cheap pre-filter** (a small, fast independent model) clears the unambiguous majority of claims.
- A **mid-tier independent checker** (a small-to-mid open-weight model, family-independent of common generation/extraction models) handles the ambiguous remainder.
- A **frontier-tier escalation** (a different-family, high-capability model) handles the hardest residual cases.
- Anything still uncertain **abstains to human review** — never forced to a verdict.
- A **hash-keyed verdict cache**, keyed on (claim, source span, source-version hash, checker version), reuses verdicts whenever the underlying source hasn't changed, and invalidates automatically when it has.

*The modes:*
- **Batch-at-ingest (default; door 1):** first-party corpora are verified once, at ingest, in batch — exploiting batch pricing and GPU utilisation. Retrieval reads stored verdicts; no verification runs per-query.
- **In-path (proxy; door 2):** a third-party response is verified per-request — **cache-first** (a hash hit returns a prior verdict at negligible latency); on miss, the cascade runs synchronously under an **explicit latency budget**; on budget exhaustion or residual uncertainty the claim is returned **labelled unverified** (annotated mode) or **withheld** (strict mode), per the existing trust-state vocabulary — never silently passed as verified. Abstention, already the moat's answer to uncertainty, doubles as its answer to latency.

One engine, two modes, no fork.

*Proxy verification depth is tiered, and the tier is always disclosed:*
- **Tier P1 — response-groundedness:** the claim is checked against evidence carried in the third-party response itself. Available for any source; roughly the grounding-vendor capability; explicitly *not* the full moat.
- **Tier P2 — full depth:** where the underlying source is ingested/hashed (or fetchable and hashable), the claim binds to a verbatim span + source-version hash, deterministically re-checkable — the moat, extended over third-party context. Honest tier-labelling applies: never imply P2 depth on a P1 check.

**4. Per-verification unit economics are instrumented as a first-class output.** Cost per claim, cache-hit rate, cascade-tier distribution, abstention rate, and latency per tier — reported **per corpus and per mode**, feeding the weekly CI gate. This is the prerequisite for (a) any credible cost or margin statement and (b) the Stage-5 (proxy) go/no-go. The research's first finding was that none of this is currently visible; this decision fixes that.

**5. Deployment and jurisdiction are presets that re-bundle the same architecture**, not separate codepaths — e.g. *Fully-managed*, *Highest-accuracy*, *Regional-residency*, *Self-host/air-gapped*. One pipeline, multiple configurations, selected as a single choice rather than assembled.

**6. The UX surfaces all of this in three tiers:**
- **Default** — connect a source, get verified context. Zero choices.
- **Presets** — one click swaps a whole vetted bundle (the deployment presets above).
- **Plug-points** — a collapsed, curated "change" dropdown per slot (Extract / Embed / Verify / Store), for the minority who ask. Each option is pre-vetted to preserve the invariants below; the system enforces them programmatically — for example, it will not let a verifier swap land on the same model family as the generator — so the user never has to reason about cross-model independence themselves.

**Illustrative current defaults** (from the component research, assessed on technical merit — size, independence, benchmark behaviour, self-host footprint; **specific selection is configuration, not part of this architectural decision, and may be revised independently**): a compact open-weight extractor with bounding-box output as the default extraction connector, with a higher-fidelity API-based extractor as a curated alternative; a small, fast open-weight entailment model as the cascade pre-filter; a mid-sized, family-independent open-weight model as the primary checker; a frontier model as the escalation tier.

## The invariants this must hold, in every configuration and both modes

1. **Cross-model independence** — the checker is always a different model family from whatever generated or extracted the content, enforced by the spine, not left to the user.
2. **Span-bound provenance** — every verified claim traces to a verbatim source span + source-version hash, deterministically re-checkable, regardless of which connector populated the stage. In proxy mode, depth is disclosed per the P1/P2 tiers.
3. **Abstention-to-human** — uncertain claims abstain rather than receive a forced verdict. In in-path mode, budget exhaustion resolves to labelled-unverified or withheld, never to a silent pass.
4. **The published bar holds** — ≥90% supported / ≤2% unsupported, validated on representative corpora via the weekly CI gate, never assumed of a new or swapped component, and measured *after* the cascade and abstention are applied.

## Consequences

**Positive:**
- **Margin visibility and proxy viability first; price headroom second.** In gated learning mode with no published pricing, the near-term prize is that verification cost becomes measurable and controllable (instrumentation + cascade + cache) and the proxy becomes economically answerable. Lower cost-to-user is the downstream consequence once pricing goes public — a real benefit, honestly sequenced.
- The pipeline becomes genuinely swappable — a cheaper or better default can replace today's choice without touching the spine, and new connector instances (starting with embedding/retrieval) reuse the same contract.
- **One architecture serves every deployment preset and both doors** — no fork between the first-party pipeline and the proxy.
- The UX stays simple because the complexity is structural and hidden — the three-tier model means most users never see any of this.

**Negative / risks:**
- The curated-swap and plug-point paths introduce variable provenance fidelity depending on what's plugged in; mitigated by the fidelity-tier model (A/B, P1/P2) and mandatory, honest tier-labelling — never implying richer provenance than a component or source supports.
- The cascade and cache add real engineering complexity inside the verification layer itself, where correctness matters most.
- **In-path mode adds a real-time burden** — latency budgets, synchronous cascade execution, timeout semantics — inside that same layer. Mitigated by cache-first design and abstention-as-degradation, but it is genuinely harder than batch, and it is where door 2 is won or lost.
- Small/mid-tier checkers have a quality ceiling on hard, ambiguous claims; abstention rate — and therefore human-review load — must be monitored per domain and corpus, not assumed constant.
- **The door-2 window risk:** this re-architecture must not delay the proxy answer. Mitigated by the build sequence below — the cascade and its validation harness produce the proxy economics early, in parallel with the extraction spike, not after the full pipeline lands.
- Naming specific components here is illustrative; treating them as locked-in before validation would be a mistake this ADR explicitly avoids.

## Validation required before replacing the live pipeline

- Confirm the ≥90%/≤2% bar holds **after** the cascade and abstention are applied — not on the raw pre-filter — on representative legal, pharma and finance corpora, via the existing weekly CI gate.
- Calibrate cascade thresholds and the abstention band per domain; thresholds tuned on one corpus should not be assumed to transfer to another.
- **In-path mode validation:** latency-budget adherence and timeout-abstention behaviour under load; cache-hit rates under representative proxy traffic; labelled/withheld outcomes mapped exactly to the trust-state vocabulary.
- **Instrumentation acceptance:** cost per claim, cache-hit rate, tier distribution, abstention rate, and latency per tier visible per corpus and per mode — before any go/no-go is read off them.
- **The Stage-5 economic read:** the cascade-validation harness (build step 2) must produce added latency and added cost per verified third-party response, caching/abstention on, over at least one wrapped commodity MCP server. This is the proxy go/no-go input, and it is deliberately decoupled from remote serving (Stage 3 / D1 / D2), which governs transport and auth, not measurement.
- Run a span-anchoring regression test confirming offsets/bounding boxes survive intact through chunking, embedding, and storage.
- Confirm cache correctness: exact-match keying only for moat-core verdicts; if any semantic/approximate caching is ever introduced, it must run as a separate, audited layer with a measured false-positive rate, not silently inside the moat-core path.
- Run the connector swap test: confirm a component can be replaced behind the contract without any change to the verification spine.

## Build sequence (re-sequenced: 1A and 1B run in parallel)

1A. **Connector contract + extraction instance** (the spike) — proves Tier A and Tier B provenance and the swap test.
1B. **Verifier cascade + hash-keyed cache + instrumentation** — the mode-independent core.
2. **Cascade-validation harness — one harness, two input types:** (i) first-party corpus claims → validates the ≥90%/≤2% bar post-cascade via the weekly CI gate; (ii) responses from one wrapped commodity third-party MCP server (Redis Iris is the named candidate from the signal shelf) → measures in-path latency and cost per verified response. Output: the bar result *and* the Stage-5 economics, before Stage 3 exists.
3. **Embedding/retrieval connector** (instance #2), reusing the contract.
4. **Deployment presets** assembled from the now-configurable components.
5. **Curated plug-point UX** (DESIGN-hat follow-on: the dropdown itself, copy, and disclosure pattern).

## Alternatives considered

- **Keep the status quo** (hardcoded, uncached, per-claim frontier verification). Rejected — leaves the largest identified cost lever untouched, keeps unit economics invisible, and can't serve multiple deployment presets without forking.
- **Batch-only verification (v1 of this ADR).** Rejected by the strategic review — it forecloses in-path proxy mode and with it door 2, the strategy's wedge.
- **Adopt an existing ingestion framework** (e.g. LlamaIndex, LangChain, Unstructured pipelines) instead of a Restormel contract. Rejected — none preserves a verbatim-span + source-version-hash through-line end-to-end, and none enforces checker model-family independence. Verification is the product: build the thin spine, adopt commodity substrate behind the contract. (Consistent with the standing build-vs-adopt discipline.)
- **Expose every stage to full user assembly** (BYO-everything). Rejected — directly contradicts relentless simplicity; most users neither want nor should need to assemble a pipeline.
- **Cascade the verifier without a connector abstraction** (cheapen verification in place, leave the substrate hardcoded). Rejected — captures part of the cost saving but none of the swappability, preset, or future-connector benefit; doesn't generalise to embedding/retrieval.

## Out of scope

Component licensing and commercial-terms review (separate workstream); pricing/packaging of presets; the visual/interaction design of the plug-point dropdown; adoption of any named component as a permanent default; the remote-serving transport and auth for the proxy (Stage 3, gated on D1/D2) — this ADR covers the engine and its modes, not the serving layer.

## Spike 1A findings (extraction-connector instance #1, 2026-07-02)

Build step 1A landed as `feat/ingest-connector-spike-1a`. Findings folded back per the spike DoD:

- **Contract proven.** The `extract(source_document) -> { document, text_units }` contract from Decision 1 is implemented verbatim in `@restormel/contracts/connect` (`ConnectExtractionResultSchema`), with `source_locator` as a discriminated `spatial | textual` union, an explicitly declared `offset_unit` (UTF-16, JS-native slice — the emoji-length trap is closed by declaration, not convention), and `version_hash_inputs` carrying both the canonical-text and raw-file SHA-256 plus the extractor id+version (so an extractor swap re-versions the source hash and dependent verdicts miss the cache by construction).
- **Tier A and Tier B both demonstrated.** PaddleOCR-VL (managed default, spatial/Tier A) and Mistral OCR API pure-extraction (curated alternative, Tier A) both emit bbox + offset locators; a dependency-free textual fallback proves honest Tier-B degradation. The tier label is derived mechanically from the locators actually produced — one textual unit downgrades the whole document, so "usually emits bboxes" cannot masquerade as Tier A.
- **Swap test is provable, not asserted.** The same source runs through default and alternative via the identical `ExtractionConnector.extract()` contract, across **all three doc types** (legal/pharma/finance), not just one; the verification spine is untouched (zero spine-module edits in the diff — the only edits to existing files are additive contract schemas and barrel exports). A cross-connector outcome-delta report documents unit-count, tier, span-anchor-rate, and token-overlap deltas. **Verification outcomes (Scope §4c)** are compared in the model-free half a spike can honestly measure: whether each claim quote **binds** to a byte-identical evidence span in each connector (the exact input a verifier receives — a claim that binds under the default but not the alternative would make the verifier abstain for want of bound evidence, a real verifier-visible delta, exercised by a negative test). The **judge-verdict half** (entailed/contradicted/abstained on the bound span) is **deferred to the cascade — build step 1B**: it needs a cross-model entailment judge (`entailment.ts`) and a live credential, both out of 1A scope, and fabricating a fixture verdict would breach eval-honesty. This split is disclosed here, not implied in a code comment.
- **Provenance survives as a model-free re-check.** Every unit's locator re-resolves byte-identically to its stored verbatim text; a corrupted offset is caught deterministically with no model — the self-checking fallback the moat depends on.
- **Removability verified.** An excise dry-run (`git rm` the Mistral OCR adapter + its config/barrel/test/fixture references) left connect-core building and testing green, touching only five files and no spine module — the D-2026-07-02-1 rollback mitigation is real, not aspirational. Rollback runbooks filed for both at-risk adapters.
- **Honest execution boundary.** With no GPU (PaddleOCR-VL weights) and no `MISTRAL_API_KEY` in the build environment, both network adapters were exercised end-to-end against fixture-backed contract doubles that return the exact vendor response shapes; the mapping/provenance code is real and fully tested, but a **live** PaddleOCR-VL server run and a **live** Mistral OCR API run still need a GPU endpoint and a credential respectively. Every harness report is stamped `execution: "fixture"`.
- **Indicative throughput measured; per-page cost honestly null (Scope §5).** The indicative harness now measures **throughput** — wall-clock pages/second around `extract()` — reported alongside `execution` so a fixture number is never read as a live-connector number. **Per-page cost is `null` under fixtures**: the doubles carry no vendor price and connect-core is credential-free (no billing surface), so cost is populated by the host app on a live run from provider `usage`/pricing via an injected hook — never a client-side estimate (§8). Reporting `null` is the honest state, not a silent omission; the earlier harness docstring that claimed it reported "throughput/cost" without any such field was corrected. **Fidelity note:** `fidelityPassRate` is **circular under fixtures** (the required sentences are drawn from the doubles' own blocks) — it proves the mapping/round-trip plumbing, not live OCR fidelity; the real fidelity number is the step-2 private-eval harness, whose corpus must stay disjoint from these fixtures (not yet enforced — see step-2 item below).
- **Deferred to build step 2, tracked here (in lieu of a separate records register).** This spike deliberately does NOT measure: the ≥90%/≤2% bar (cascade-validation harness + weekly CI gate); the full §8 cost/latency OTel attribute set on model-call paths; the judge-verdict swap-test delta (needs the cross-model judge + credential); and the private-eval-set disjointness enforcement for fidelity. These are the step-2 follow-up items. The spike DoD's "findings landed as records per SCHEMA / tracked in Forgejo" sub-item is recorded HERE in the ADR (the repo has no separate records register for this class of finding, and Forgejo issue/PR creation was not in the routed build scope) — flagged so it is an explicit disclosure, not a silent skip.
- **Licensing gate — exact commands and named false positives (BLOCKED/AMBIGUOUS scan).** Two greps were run from the `restormel-keys` worktree root. (1) The **plug-points** §1 grep — `grep -rniE 'nv[-_]?embed|patronus|lynx|bespoke[-_]?minicheck|minicheck|jina|lytang|surya' packages/ apps/ --include='*.ts' --include='*.js' --include='*.json' --include='*.yaml' --include='*.yml' --exclude-dir=node_modules` — returns **zero hits (PASS)**. (2) The **verification-engineering** §1 grep — `grep -riE 'nv-embed|patronus|lynx|bespoke|jina|lytang|surya' packages/ pnpm-lock.yaml` — returns **5 hits, all in `pnpm-lock.yaml`, all pre-existing on origin/main and untouched by this diff**: four `@lynx-js/react` lines (ByteDance's Lynx UI framework, a `better-auth` peer dependency — NOT Patronus Lynx) and one `jina` substring inside a base64 `sha512` integrity hash. Neither is a wired component and neither is renamable third-party lockfile text; the diff touches no `package.json` or lockfile. Documented rather than reported as a bare "zero hits".

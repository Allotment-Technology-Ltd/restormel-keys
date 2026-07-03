---
title: ADR: Evidence-Bound Verification (EBV) — what verified must mean
class: decision
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-09
last-reviewed: 2026-06-13
review-interval: P12M
---

# ADR: Evidence-Bound Verification (EBV) — what "verified" must mean

**Status:** **Approved 2026-06-09** (direction approved by product owner). No implementation
has been done yet — Layer 1 lands in Verified Context roadmap Stage 1.0c, Layer 2 in Stage
1.0d. Supersedes the implicit definition of "validated" used by the current Connect pipeline;
foundation for the Verified Context roadmap (`docs/product/verified-context-pivot-roadmap.md`) and for
the verified-memory pivot (P3).

## Context: why the current validation does not earn user trust

Today a claim is "validated" when an LLM judge — shown the **first 12k characters** of the
source plus a batch of up to 25 claims — emits `ok | weak | unsupported`
(`packages/connect-core/src/ingest/validation.ts`). The recent fail-open fixes (PR #189) made
the *coverage* fail-safe: omitted verdicts no longer default to `ok`. But the verdict itself
remains **an unanchored opinion**:

1. **No evidence link.** The verdict is a label, not a pointer. A user (or auditor) shown
   "status: ok" cannot see *which passage* supports the claim. The claim is unfalsifiable from
   the product surface — which is precisely the property users refuse to trust.
2. **The judge often cannot see the evidence.** Claims extracted from chunk 47 are judged
   against a 12k-char source prefix. The per-unit `sourceTextByRef` path exists but is optional
   and not wired by the full-run orchestrator (review finding H2). A judge that can't see the
   passage is guessing, in either direction.
3. **Verdicts are not reproducible.** Same claim, same source, re-run → possibly different
   label (stochastic judge, no recorded basis). Nothing about the verdict can be deterministically
   re-checked later, so verification silently rots when sources or models change.
4. **No abstention or review state.** The judge must answer; there is no "cannot verify →
   human review" path (the C2 remediation gap met the same missing state). Uncertainty is
   currently laundered into `weak`.
5. **The misattribution hole.** A claim that is true *somewhere else in the corpus* but
   attributed to the wrong source will frequently pass a plausibility-judging LLM. This is the
   hardest tier in the efficacy benchmark (roadmap Stage 1.0a) and the one that most damages
   trust when caught by a customer.
6. **Trust score measures structure, not truth** (embedding coverage, orphan rates) — useful
   hygiene, but it cannot support the marketing sentence "claims you can trust."

Conclusion: the current design asks users to trust an **opinion of a model about text it may
not have seen, recorded without evidence, unreproducible after the fact**. The user's
instinct is correct — that is not verification.

## Decision (proposed): every claim is bound to evidence, and verification is two-layered

**The core move: demote the LLM from oracle to entailment-checker, and make evidence — not
the model's say-so — the unit of trust.**

### 1. Evidence binding (at extraction)

Every extracted claim MUST carry one or more **evidence spans**: exact quotes with character
offsets into the stored passage/source record, plus the **content hash of the source version**
they were taken from. The extraction contract already has an `evidence?` field and the graph
schema already has passage tables (`passage_table`, `source_text_field`, …) — this makes the
field mandatory-with-consequences rather than decorative.

A claim with no locatable evidence span can never be `supported`. At best it is `inferred`
(see states below).

### 2. Layer 1 — deterministic verification (cheap, reproducible, tamper-evident)

A non-LLM check, runnable by anyone at any time:

- the quoted span **exists** at the recorded offsets in the source version (exact match after
  normalization; bounded fuzzy fallback recorded as such);
- the source version's content hash matches the hash recorded at binding time;
- the span belongs to the *cited* source (this structurally closes the misattribution hole:
  a true-but-misattributed claim fails Layer 1 against its cited source, no judgment needed).

Layer 1 results are recorded in the provenance trace (`@restormel/contracts`
`provenance-trace.ts`) as `{ span, offsets, source_hash, checked_at, result }`. Because it is
deterministic over hashed content, it is **re-runnable at read time**: strict retrieval can
require a fresh Layer-1 pass (or unchanged source hash) before serving a claim, so
verification cannot silently rot. The natural implementation home is the verification-rules
engine (`packages/graphrag-core/src/verification/rules/`), which exists for exactly this kind
of deterministic, declarative check.

### 3. Layer 2 — span-scoped entailment (probabilistic, narrow, measurable)

The cross-model judge is kept, but its task is narrowed from "judge 25 claims against a 12k
prefix" to: **"does THIS span entail THIS claim?"** — one claim, its 1–3 bound spans, nothing
else. This is a well-studied NLI-shaped task: better calibrated, cheaper per token, and
benchmarkable. The judge:

- returns `entailed | not_entailed | abstain` with confidence;
- MAY abstain — abstention routes to the review queue instead of being laundered into `weak`;
- has its verdict recorded with **model id, prompt version, and timestamp** so every verdict
  is attributable and re-runnable under the same or newer judges;
- for high-stakes packs, runs k-sample self-consistency (majority verdict, disagreement →
  review).

Cross-model routing (validator ≠ extractor family, `plan.ts`) is retained — it now means the
*entailment checker* is independent of the *extractor*, which is the meaningful independence.

### 4. Verification states (replaces ok/weak/unsupported as the product-facing truth)

| State | Meaning | Requires |
|---|---|---|
| `supported` | Evidence-bound and entailed | Layer 1 pass + Layer 2 entailed |
| `inferred` | Entailed by multiple spans / derived; no single direct span | Layer 2 entailed, Layer 1 partial — always labeled as inference |
| `unverified` | Judge abstained, low confidence, or no evidence bindable | → human review queue |
| `contradicted` | Evidence found that entails the negation | → review; excluded from strict retrieval |
| `excluded` | Remediation/operator decision; reversible (existing soft-exclude) | — |

This finally creates the **review/hold state** the C2 remediation fix flagged as the missing
orchestrator concept: remediation's coverage-gap drops and Layer-2 abstentions land in the
same reviewable place instead of disappearing.

### 5. Human attestation (the regulated-buyer tier)

A review queue where a human confirms/overrides a claim's state; attestations are recorded in
the provenance trace with identity and timestamp. "Verified" in marketing can then honestly
mean: *deterministically evidence-checked, independently entailment-checked, and optionally
human-attested — with the full chain exportable.*

### 6. What the user sees (the falsifiability test)

Every `supported` claim in any surface (dashboard, MCP tool, AAIF envelope, trace export)
renders: the claim, the quoted span highlighted in its source, the source version hash, the
judge + confidence + date, and any attestation. **The trust test is: a skeptical user can
click through and check the quote themselves.** If a surface cannot show that chain, it must
not say "verified."

## Consequences

- **Pipeline changes:** extraction prompt/contract requires evidence quotes; a new
  deterministic bind/verify step after extraction; validation stage rewritten as span-scoped
  entailment (the existing `sourceTextByRef` path is the seed); remediation's `repair` must
  re-bind evidence for the repaired text (it already re-validates).
- **Contracts:** verified-claim envelope (roadmap Stage 1.1) carries evidence spans, source
  hashes, judge metadata, state — not just a status string.
- **Trust score** gains a component that actually measures grounding: % of served claims that
  are evidence-bound and Layer-1-fresh.
- **Efficacy benchmark (Stage 1.0a)** measures the whole system before/after EBV; the
  misattributed tier should move from "hope the judge notices" to "structurally caught."
- **Cost:** Layer 1 is ~free. Layer 2 is more calls but far smaller contexts; batch by
  passage. Expected same order of magnitude as today's validation spend; measure in 1.0a.
- **Migration:** existing graphs get a backfill pass (bind evidence where recoverable);
  claims that cannot bind become `unverified` (visible, reviewable) — **not** silently demoted
  or silently kept. This is itself a trust statement.
- **Verified memory (P3)** inherits the right primitives: source-version hashes and claim
  supersession give incremental re-ingest and temporal validity a sound anchor (a claim's
  verification is valid *for a source version*).

## Alternatives considered

1. **Better prompts / bigger context for the current judge** — rejected as the headline fix:
   improves the opinion, still ships an unfalsifiable label with no evidence chain and no
   reproducibility. (Worth doing *inside* Layer 2 anyway.)
2. **Dedicated NLI models only (no LLM judge)** — rejected alone: brittle on long/technical
   spans and domain vocabulary; viable as a cheap pre-filter inside Layer 2 later.
3. **Human review only** — does not scale; kept as the attestation tier, not the mechanism.
4. **Blockchain/cryptographic provenance chains** — overkill for the trust problem at hand;
   content hashes + signed export cover tamper-evidence. Revisit only on explicit buyer pull.

## Next step

Review and confirm. On sign-off: amend the Verified Context roadmap stages 1.0c/1.0d
(already drafted to reference this ADR), implement Layer 1 first (deterministic binding —
biggest trust gain per effort, no model dependency), then Layer 2. Stage 1.0a's benchmark
runs before and after as the published proof.

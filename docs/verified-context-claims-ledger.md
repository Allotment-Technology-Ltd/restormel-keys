# Verified Context — Claims Ledger

**This document is the contract between what Restormel says and what it can prove.**
Every public marketing claim about verification quality maps to (a) the precise measurable
assertion behind it, (b) the automated evidence — a test, benchmark, repro script, or CI
gate, and (c) its current status. Per the
[roadmap's claims-integrity rule](verified-context-pivot-roadmap.md), **Stage 1.3 and
Stage 4.2 marketing copy may only use rows marked `proven`** — if a phrase you want has
no proven row, weaken the phrase or add the evidence first; never the other way round.

Marketing-copy PRs must cite the ledger rows they rely on (see the PR-template note and
`CONTRIBUTING` below). When a model/route change drops a measured bar, every row citing it
is treated as broken — the copy changes or the bar recovers.

Signed-off bars (product owner, 2026-06-10 — quoted in the
[roadmap](verified-context-pivot-roadmap.md)): fabricated-tier recall ≥ 95%, cross-model
misattribution recall ≥ 90%, false-flag ≤ 15%, affirm-unseen = 0% under cross-model routing.

## Ledger

| # | Marketing claim | Measurable assertion | Automated evidence (what a skeptic runs) | Status |
|---|---|---|---|---|
| 1 | "Every claim is validated against its source" | No unit skips judgment: an omitted or unparseable verdict defaults to a non-passing state (legacy: `weak` coverage gap; EBV L2: `abstain` → review), never to supported. | `pnpm --filter @restormel/connect-core exec vitest run src/__tests__/stages.test.ts src/__tests__/entailment.test.ts` — "fails omitted units safe as weak (coverage gap)" + "an omitted claim is a coverage-gap abstention, never a pass"; live repro: `pnpm exec tsx scripts/reviews/connect-ingest-failopen-repro.ts` (C1/C3 section) | **proven** |
| 2 | "Every supported claim is backed by a verbatim quote you can check yourself" | `supported` requires a deterministically bound evidence span (quote + offsets + source-version hash) in the cited source AND span-scoped entailment; no binding → at best `inferred`, never `supported`. | `pnpm --filter @restormel/connect-core exec vitest run src/__tests__/evidence-binding.test.ts src/__tests__/entailment.test.ts` — binder offset/hash tests + "supported requires Layer 1 bound AND entailed"; re-check is a pure function (`verifyEvidenceSpan`), no model needed | **proven** |
| 3 | "Misattributed claims are caught structurally, not by model opinion" | A quote cited against the wrong source fails Layer-1 binding deterministically. Measured: misattributed-tier recall 100% under EBV (both pairings, 3 runs, 2026-06-10). | `evidence-binding.test.ts` — "misattribution: a quote from a different source does NOT bind to the cited one"; measured snapshot [`verifier-efficacy-results-2026-06-10-ebv.json`](../scripts/reviews/verifier-efficacy-results-2026-06-10-ebv.json) | **proven** |
| 4 | "Unsupported claims are excluded, not blended" | Remediation fail-safe: an omitted remediation verdict defaults to `drop` (reversible soft-exclude), never `keep`; orchestrator soft-excludes rather than hard-deletes. Strict-mode retrieval omission is Stage 4.1's MCP test. | `stages.test.ts` — "fails omitted units safe as drop (not keep)"; repro C2 section. Retrieval-side strict-mode proof pending. | **partial** — owner: [Stage 4.1](verified-context-pivot-roadmap.md) |
| 5 | "A different model family checks the extraction" | The planner requests an independent family (Gemini/vertex) for validation by default when no operator pins exist; operator pins win deliberately. Measured why it matters: same-family judge affirmed unseen claims 66.7% of the time, cross-family 0% (2026-06-10 baseline). | `pnpm --filter @restormel/connect-core exec vitest run src/__tests__/ingest-plan.test.ts` — "routes validation to an independent model family by default (cross-model check)"; baseline snapshot [`verifier-efficacy-results-2026-06-10.json`](../scripts/reviews/verifier-efficacy-results-2026-06-10.json) | **proven** |
| 6 | "The validator catches fabricated claims" | Fabricated-tier recall ≥ 95% (signed-off bar). Measured 100% ± 0 across both pairings and both paths (legacy + EBV), 3 runs, 2026-06-10. Stays proven only while re-measured as models change. | Snapshots above; re-run: `pnpm exec tsx scripts/reviews/verifier-efficacy.ts --validator … --ebv --runs 3` (keys required). Scheduled CI re-run lands in Stage 2.3 — until then this row is dated evidence, not continuous. | **proven** (dated 2026-06-10) — continuous enforcement owner: [Stage 2.3](verified-context-pivot-roadmap.md) |
| 7 | "Every claim carries a provenance trace" | Connect v1 retrieve responses carry, per claim: verification state, citation, trace ref; traces are exportable. | `pnpm --filter @restormel/contracts test` (verified-claim envelope schema) + `pnpm --filter dashboard test` — connect-v1 retrieve/orchestrator envelope tests (PR #209); trace builder/handler tests (`provenance-trace-builder.test.ts`, `trace-handler.test.ts`) | **proven** |
| 8 | "Published quality bar: ≥90% supported, ≤2% unsupported" | `assertG2Targets` enforces ok_pct ≥ 90 and unsupported_pct ≤ 2 (`G2_OK_PCT_TARGET`/`G2_UNSUPPORTED_PCT_MAX`); `keys connect eval` returns exit 1 when a graph misses the bar. | `pnpm --filter @restormel/connect-core exec vitest run src/__tests__/golden-eval.test.ts`; headless: `keys connect eval --json` (Stage 2.1, PR #197). Weekly re-measurement owner: Stage 2.3. | **proven** |
| 9 | "Verification can't silently rot" | Layer-1 re-check fails closed on source hash mismatch, changed text at offsets, or out-of-range offsets — re-runnable at read time with no model. | `evidence-binding.test.ts` — "fails closed on hash mismatch / text changed / out-of-range offsets" | **proven** |
| 10 | "Uncertainty goes to human review, not into the graph" | Layer-2 abstention, low confidence, and k-sample disagreement land in `unverified` (review queue) and are excluded from remediation; they are never laundered into a passing state. | `entailment.test.ts` — "low confidence and abstention route to unverified (review)", "disagreement (no strict majority) abstains"; runner routes abstained refs around remediation (`ingest-full-runner.ts`) | **proven** |

## Rules for editing this ledger

1. **A row becomes `proven` only when its evidence column names a command a skeptic can
   run** (or a committed, dated measurement snapshot). Opinions, intentions, and code
   comments are not evidence.
2. **Partial/unproven rows must name an owner stage** in the
   [roadmap](verified-context-pivot-roadmap.md) — a row with no path to proven gets its
   marketing phrase weakened instead.
3. **Dated measurement rows (e.g. #6) decay**: once Stage 2.3's scheduled efficacy run
   exists, the evidence pointer moves to the CI gate and the date qualifier drops. If a
   scheduled run breaches a signed-off bar, flip the row to **broken** and treat dependent
   copy as broken until it recovers.
4. **Marketing-copy PRs cite rows**: any PR touching `/`, `/connect` (marketing),
   `/keys/use-cases`, or catalog/distribution copy must list the ledger row numbers backing
   each quality/verification phrase (see `.github/PULL_REQUEST_TEMPLATE.md`).

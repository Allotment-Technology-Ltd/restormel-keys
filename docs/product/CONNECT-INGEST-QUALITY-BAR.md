---
title: Connect ingest quality bar
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# Connect ingest quality bar

Canonical quality gates for Restormel Connect ingestion (aligned with SOPHIA Phase-0 §3).

## Definition of done

A release is **best-in-class aligned** when all gates pass on the **reference philosophy pack** and at least one **non-philosophy template pack**:

| Gate | Metric | Initial target |
|------|--------|----------------|
| **G1 Extraction structure** | Golden dry-run: zero `pattern_violation` / `orphan_units` at strict mode | 100% pass before run allowed |
| **G2 Faithfulness** | Units `ok` after remediation (production runs) | ≥90% per source; <2% `unsupported` |
| **G3 Corpus health** | Kg audit trust score v1 | ≥85 on reference corpus post-ingest |
| **G4 Retrieval** | Golden-query context hit@k vs SOPHIA baseline | No regression vs archived benchmark |
| **G5 Operator loop** | Median time run complete → triage complete | [Connect Ingest Quality](https://eu.posthog.com/project/123553/dashboard/726666) — `connect_review_completed.time_since_ingest_complete_ms` |
| **G6 Pipeline truth** | Production runs use `connect-core` + full worker | 0% stub-complete with zero units in production preset |
| **G7 Regression** | CI blocks pack/prompt changes that fail golden eval | Required on `packages/connect-core` + pack seeds |

Until **G1–G4** pass in staging, do not claim best-in-class externally — report progress against this table.

## Defaults (locked)

- **`quality_preset: production`** on all new domain packs and ingest runs.
- **Starter** is explicit opt-down only (Demo / fast try) with UI warning.
- Production enforces validate + remediate stages, higher chunk cap (32 default, 100 ceiling), and fails runs with zero units.

## Measurement artifacts

| Artifact | Location |
|----------|----------|
| Golden fixture (philosophy starter) | `packages/connect-core/src/ingest/golden-eval.ts` |
| Trust score formula | `packages/connect-core/src/kg-audit/trust-score.ts` |
| Pre-scan gate | `packages/connect-core/src/ingest/pre-scan.ts` |
| Run quality report | `apps/dashboard/src/lib/server/connect/run-quality-report.ts` (includes `quarantine_count`, `quarantine_pct`) |
| Review telemetry | `knowledge_review_signals` + PostHog `connect_review_completed` |
| Threshold automation | Restormel Admin [`/keys/admin/ingest-quality`](https://restormel.dev/keys/admin/ingest-quality) (manual evaluate + apply); dev script `scripts/connect-review-signal-thresholds.mjs` |
| Gates reference + G2 sample | Restormel Admin [`/keys/admin/ingest-quality/gates`](https://restormel.dev/keys/admin/ingest-quality/gates) (G1–G7 what/how/why, live G2 sample links) |
| Prompt composer | `packages/connect-core/src/ingest/prompt-compose.ts` |
| Model guidance | `apps/dashboard/src/lib/server/connect/model-guidance.ts` |

## CI

Golden eval fingerprint tests run with `@restormel/connect-core` (`golden-eval.test.ts`). Extend with downstream extract metrics as full runner fixtures land.

## Related

- [CONNECT-PRODUCT.md](./CONNECT-PRODUCT.md)
- [SOPHIA-CONNECT-INGEST-CUTOVER.md](../runbooks/sophia-connect-ingest-cutover.md)

# Rollback runbook — PaddleOCR-VL extraction connector

At-risk integration under **D-2026-07-02-1** (trial phase, no external users; rollback
is the mitigation). REC-GOV-022 verdict: **CLEARED** (Apache-2.0, commercial + service-to-3P;
"PaddleOCR-VL / PaddleOCR-VL-1.5 (0.9B) | Apache-2.0 | CLEARED"). Managed default for the
extraction slot (build step 1A of REC-ADR-023).

| Field | Value |
|---|---|
| **Config key** | `paddleocr:paddleocr-vl-1.5` (`EXTRACTION_CONNECTOR_KEYS.default`, `packages/connect-core/src/ingest/extraction-selection.ts`) |
| **Secret name** | None in connect-core. The self-hosted PaddleOCR-VL server endpoint is configured in the **host app's** injected `PaddleOcrVlTransport`; if that endpoint is authenticated the credential is `ADAPTER_PADDLEOCR_ENDPOINT` / `ADAPTER_PADDLEOCR_API_KEY` in Infisical (host-side, not read by connect-core). |
| **Adapter id + version in cache keys** | `extractor_id="paddleocr-vl"`, `extractor_version="1.5.0"` (recorded in `document.version_hash_inputs`; folds into the source-version hash → verdict cache keys) |
| **Purge commands** | Evict derived artifacts keyed by this extractor: delete verdict-cache entries whose `source_version_hash` derived from `extractor_id="paddleocr-vl"`, and re-queue affected documents for re-verification through the fallback/replacement. The extractor id+version in the version hash means a swap already re-versions dependent verdicts, so a swap alone orphans (never corrupts) prior entries. |
| **Fallback adapter** | `mistral:ocr-4` (curated alternative, Tier A) or `builtin:textual-fallback` (Tier B degradation) — swap via the single composition-root config key; fail-closed otherwise (never a silent pass). |
| **Rehearsal log** | `pending` — tier-1 (disable) + tier-2 (evict) staging rehearsal must be recorded here before first production use. |

## Rollback tiers

1. **Disable (same day):** change `EXTRACTION_CONNECTOR_KEYS.default` selection at the
   composition root to the fallback key; redeploy the host app. No spine edit.
2. **Evict (days):** purge verdict-cache entries + embeddings keyed to
   `paddleocr-vl@1.5.0`; re-queue affected docs through the replacement.
3. **Excise (within the sprint):** `git rm packages/connect-core/src/ingest/extraction-connectors/paddleocr-vl.ts`,
   remove its `EXTRACTION_CONNECTOR_KEYS.default` case in `extraction-selection.ts`, remove
   its barrel exports in `packages/connect-core/src/index.ts`, remove its conformance/test
   references and fixture transport, delete the host secret from Infisical, run the
   removability checklist, record the removal in `planning/horizon/strategic-review-2026-07-01-decisions.md`.

## Removability note

The adapter is reached only through the `ExtractionConnector` port. Its id greps to the
adapter file, the selection config, the barrel export, the test, and the fixtures — no
verification-spine module. Removal is delete-adapter + delete-config, zero spine edits.

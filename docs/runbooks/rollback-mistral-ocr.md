# Rollback runbook — Mistral OCR extraction connector (API, pure-extraction)

At-risk integration under **D-2026-07-02-1** (trial phase, no external users; rollback is
the mitigation). REC-GOV-022 verdict: **CLEARED (API) — verify** ("Mistral OCR (OCR 3 / OCR 4)
— API | Proprietary Premier model under Mistral commercial API ToS | CLEARED (API) — verify").
**Self-host is NEEDS COMMERCIAL LICENCE and is NOT wired** — this adapter is API-only,
pure-extraction mode only (never the Document-AI schema tier). Curated alternative for the
extraction slot.

| Field | Value |
|---|---|
| **Config key** | `mistral:ocr-4` (`EXTRACTION_CONNECTOR_KEYS.mistralOcr`, `packages/connect-core/src/ingest/extraction-selection.ts`) |
| **Secret name** | `ADAPTER_MISTRAL_API_KEY` (Infisical; **host-side only** — connect-core reads no `process.env`; the key lives in the host's injected `MistralOcrTransport`). |
| **Adapter id + version in cache keys** | `extractor_id="mistral-ocr"`, `extractor_version="ocr-4"` (in `document.version_hash_inputs` → source-version hash → verdict cache keys) |
| **Purge commands** | Delete verdict-cache entries whose `source_version_hash` derived from `extractor_id="mistral-ocr"`; re-queue affected documents through the managed default (`paddleocr:paddleocr-vl-1.5`). |
| **Fallback adapter** | `paddleocr:paddleocr-vl-1.5` (managed default, Tier A) or `builtin:textual-fallback` (Tier B). |
| **Rehearsal log** | `pending` — tier-1 + tier-2 staging rehearsal must be recorded here before first production use. |

## Rollback tiers

1. **Disable (same day):** stop selecting `mistral:ocr-4` at the composition root; redeploy.
2. **Evict (days):** purge verdict-cache entries + embeddings keyed to `mistral-ocr@ocr-4`;
   re-queue affected docs through the default.
3. **Excise (within the sprint):** `git rm packages/connect-core/src/ingest/extraction-connectors/mistral-ocr.ts`,
   remove its `EXTRACTION_CONNECTOR_KEYS.mistralOcr` case in `extraction-selection.ts`, remove
   its barrel exports in `index.ts`, remove its conformance/test references and fixture
   transport, **delete `ADAPTER_MISTRAL_API_KEY` from Infisical**, run the removability
   checklist, record the removal in the decisions file.

## Guardrail reminders (part of the licence gate, not optional)

- **API only** — no weight download / self-host path exists in the adapter or any manifest.
- **Pure-extraction only** — the transport must call the OCR endpoint, never the
  Document-AI / structured-schema tier (that reshapes via an LLM upstream of verification).
- Removal is delete-adapter + delete-config + delete-secret, zero verification-spine edits.

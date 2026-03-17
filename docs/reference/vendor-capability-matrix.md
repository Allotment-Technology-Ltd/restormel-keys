# Vendor capability matrix (for ingestion)

**Goal:** Enable “best of gateway + Restormel control layer” by importing models/usage/logs into Restormel. This matrix documents what each vendor supports via **API** vs **export**, what auth they require, and any plan/retention constraints.

## Principles

- Restormel should support **two ingestion modes**:
  - **Export/upload**: user downloads a report/export and uploads it (no ongoing access).
  - **Connector**: builder-run job/CLI pulls data from vendor APIs and POSTs summaries to Restormel.
- Prefer **aggregates first**, then request-level logs (volume + privacy).

---

## OpenRouter

- **API access**: **Yes**
  - **Aggregated usage endpoint**: `GET https://openrouter.ai/api/v1/activity`
  - **Auth**: **Management API key** (Bearer token)
  - **Range/retention**: last **30 completed UTC days** (per docs)
  - **Fields** (high-signal): date, model, provider_name, requests, prompt_tokens, completion_tokens, reasoning_tokens, usage (USD), byok_usage_inference (USD)
- **Export**: **Yes**
  - CSV/PDF export from `openrouter.ai/activity` (group by Model / API key / Creator)
- **Best v1 ingestion**:
  - **Usage aggregates** from `/activity` (daily granularity)
  - **Model discovery**: infer model slugs observed in activity; optionally map into Restormel catalog
- **Notes**:
  - Cost data includes OpenRouter spend and estimated BYOK spend; document which metric Restormel uses.

## Portkey

- **API access**: **Yes (broad)**, but some features may be plan-gated
  - **Logs export API** exists (JSONL export flows)
  - **Auth**: `x-portkey-api-key` header
- **Export**: **Yes**
  - Product “Logs export” produces JSONL suitable for ingestion
- **Best v1 ingestion**:
  - **Request logs ingestion** via JSONL export (if available)
  - **Usage aggregates** derived from ingested logs
  - **Model discovery** from log fields (provider/model)
- **Notes**:
  - Treat Portkey exports as potentially high-volume; enforce size/retention limits in Restormel.

## Vercel AI Gateway

- **API access**: **Unknown/unclear** (docs emphasize dashboard views and export)
- **Export**: **Yes**
  - Vercel AI Gateway Observability UI includes “Logs… you can sort or export the logs”
- **Best v1 ingestion**:
  - **Export/upload** first (format detection: CSV/JSON)
  - **Connector** later if Vercel exposes an API for logs/usage
- **Notes**:
  - Observability retention/extended timeframes require “Observability Plus” (plan gating).

---

## Recommended ingestion order (v1)

1. **OpenRouter usage aggregates** (API) + upload fallback
2. **Portkey logs export** (upload) → derive usage aggregates
3. **Vercel log export** (upload) → derive usage aggregates
4. Expand to **request logs** (optional) once retention + privacy constraints are in place


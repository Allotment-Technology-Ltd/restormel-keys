---
title: Ingest quality signal briefs
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# Ingest quality signal briefs

Threshold evaluation runs from **Restormel Admin → Ingest quality** (`/keys/admin/ingest-quality`).

Gate definitions (G1–G7), what/how/why, and the **G2 production sample** with per-job links: [`/keys/admin/ingest-quality/gates`](/keys/admin/ingest-quality/gates).

Service admins can:

1. **Evaluate** — query `knowledge_review_signals` for the selected window and detect fired thresholds
2. **Review** — brief markdown stored in `knowledge_ingest_quality_runs` (aggregates only)
3. **Apply** — bump `prompt_template_version` on **builtin** domain packs when the G2 gate passes

Briefs contain counts and themes only — no user graph unit bodies or source text.

## PostHog embed (admin UI)

The service-admin page embeds the [Connect Ingest Quality](https://eu.posthog.com/project/123553/dashboard/726666) dashboard when a public embed URL is available.

1. In PostHog: open the dashboard → **Share** → enable public sharing → copy the **embed** URL (`https://eu.posthog.com/embedded/…`).
2. Set `POSTHOG_INGEST_QUALITY_DASHBOARD_EMBED_URL` on the dashboard app (Vercel / `.env.local`).

Alternatively, set `POSTHOG_API_KEY` (personal API key with `sharing_configuration:read` + `sharing_configuration:write`) and `POSTHOG_PROJECT_ID=123553`; the server will enable sharing and resolve the embed URL at load time.

## Local dev

- **Export:** `DATABASE_URL=… pnpm --filter dashboard exec node ../../scripts/connect-review-signal-export.mjs 7`
- **Evaluate (CLI):** `pnpm --filter dashboard exec node ../../scripts/connect-review-signal-thresholds.mjs --from-db`

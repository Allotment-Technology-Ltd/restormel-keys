---
name: restormel-admin-technical-writing
description: Restormel service-admin reference pages (ingest quality, gates, operator consoles). Self-contained technical prose, scannable structure, actionable next steps on-page — not link farms to repo files.
---

# Admin technical writing (Restormel Keys)

Use for `/keys/admin/**` reference and operator pages. Audience: service admins who need decisions, not a file tree tour.

## Principles

1. **One page, one job.** The reader should understand targets, measurement, and what to do next without opening GitHub, multiple admin routes, or engineering docs.
2. **Lead with the decision.** Open with definition-of-done, then a scannable summary table (gate / target / live status / blocker).
3. **Prose over pointers.** Explain *what* is measured and *why* it matters in plain sentences. Repo paths belong in a single “Engineering reference” footer link, not seven per-gate link lists.
4. **No duplication.** Do not repeat the same link (PostHog, G2 sample, ingest runs) on every card. Put shared actions in one “Related actions” block.
5. **Live vs offline.** Label gates that are manual/offline/CI-only. Never imply a live badge exists when data is not loaded on this page.
6. **Accessible structure.** `h1` → `h2` sections → gate `h3` with stable `id` anchors. Tables need `<th scope="col">`. Status uses text + color, not color alone.
7. **Tone.** Direct, precise, calm. Short paragraphs. Monospace only for codes (`ok_pct`, event names), not whole sentences.

## Page skeleton (gates / quality reference)

1. Back link + `h1` + one-paragraph lead (purpose, audience, relationship to operator loop).
2. **At a glance** — table: gate name, target, status badge, one-line metric.
3. **How this fits the operator loop** — 3–5 sentences connecting G2/G5/G7 to Evaluate / Apply on ingest-quality.
4. **Gate reference** — one card per gate: badge, target callout, 2–4 sentences (measurement + rationale + if blocked what to do). No per-gate link lists.
5. **Live sample** (if applicable) — table + column glossary inline.
6. **Related actions** — ≤5 working in-app or PostHog links.

## Anti-patterns

- Bullets of GitHub `blob/main/...` paths as primary content.
- Repeating “What / Target / How / Why” dl grids that restate the summary table.
- “See engineering doc” in every section — one canonical doc link at the bottom.
- `external: true` on same-origin paths (`/graph/docs`, `/keys/...`).

## Verification

- Every `href` resolves in dev (`/keys/admin/...`, `/keys/dashboard/...`, `/graph/docs`).
- Anchors (`#g2-sample`) only used for in-page scroll, not as faux buttons on the same section.
- After edits: `pnpm --filter dashboard exec vitest run ingest-quality-gates-data` if gate data logic changed.

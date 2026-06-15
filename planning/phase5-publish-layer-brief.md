---
id: REC-PLAN-005
title: Phase 5 — publish layer (implementation brief)
class: planning
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P12M
approved-by: founder
approved-on: 2026-06-15
retention: review-only
related: [REC-PLAN-002, REC-GOV-001, REC-GOV-005]
---

# Phase 5 — publish layer (brief for Claude Code)

Phase 5 is SvelteKit work in `apps/dashboard`, so it's a **Claude Code build**. This is the spec
+ acceptance; the implementing PRs land via Cursor.

## Goal
Render records to the web **gated by `classification`** — only `public` ever reaches public
routes — and **replace the hardcoded legal Svelte pages with managed `legal/` records**, each
showing effective dates + version history. Plus a sub-processor change-notification hook.

## Build
1. **Classification-gated rendering (build-time).** Read each record's front-matter at build;
   **only `classification: public` renders to public routes.** Reuse the front-matter parser
   (mirror `scripts/records/lib.mjs`); never ship `internal`/`confidential`/`restricted` to a
   public route. Same definition of "public" as the Drive mirror — keep them consistent.
2. **Legal/API pages with history.** Render `public` records with **effective date(s) and
   version history**, drawn from `supersedes` lineage + git commit history of the file.
3. **Internal/authed route (Decision #4).** `internal`/`confidential` behind auth (Forgejo
   OAuth / reverse-proxy auth — founder's call). If undecided, **ship public-only and defer**.
4. **Sub-processor change-notification hook.** When `governance/suppliers.yaml` changes on
   `main`, fire a notification (the customer-facing sub-processor change obligation). A Forgejo
   Action on `suppliers.yaml` paths is the natural home; surface the public view on the trust page.

## Public pages — migrate + add
Create the `legal/` record root (CODEOWNERS already covers `/legal/`). Each page becomes a
markdown record (`class: legal`, `classification: public`, with `effective`/`supersedes`), and
the existing route renders the record instead of hardcoded markup.

**Migrate (reuse existing text verbatim — do NOT rewrite):**
- `apps/dashboard/src/routes/keys/privacy/+page.svelte` → `legal/privacy-policy.md`
- `apps/dashboard/src/routes/keys/terms/+page.svelte` → `legal/terms.md`
- `apps/dashboard/src/routes/keys/refund-policy/+page.svelte` → `legal/refund-policy.md`
  (Extract current content into the record; the route becomes a renderer. Keep the same URLs.)

**Add (NEW — scaffold with `[PLACEHOLDER — counsel]`, do not invent legal text):**
- `legal/cookie-policy.md` + a **consent/cookie banner** (PECR/UK-GDPR — PostHog EU analytics
  needs consent + disclosure).
- `legal/sub-processors.md` — public sub-processor list, the published view of
  `governance/suppliers.yaml`; wired to the change-notification hook. Reinforces the trust-layer
  positioning.
- `legal/acceptable-use.md` — standard SaaS AUP.
- `legal/dpa.md` — Data Processing Agreement for B2B customers (counsel; downloadable).
- `legal/company-information.md` — UK legal disclosure required on the site: company name
  **Allotment Technology Ltd**, number **16925574**, registered office `[CONFIRM]`, place of
  registration (England & Wales). Mostly factual — confirm the registered office.

**Later (not blocking):** a Security/Trust Centre page (ties to the ISO posture) and an SLA.

## Acceptance
- Public site renders **only** `public` records — nothing internal leaks (add a test).
- The three legal pages render from `legal/` records at their existing URLs; effective dates +
  prior versions shown.
- New legal docs exist as scaffolds with counsel placeholders clearly flagged — no invented text.
- Sub-processor changes trigger the notification path; the public sub-processor page reflects them.

## Guardrails
- Reuse the records front-matter convention; one parser, one definition of "public".
- **Never fabricate legal content** — migrate existing, scaffold new for counsel.
- Forgejo origin only; never the github mirror.
- Consider adding `legal/` to the Drive-mirror roots so public legal docs are editable in Drive too.

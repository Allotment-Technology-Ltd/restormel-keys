---
title: Phase 2 CI/CD — Lighthouse-CI for public routes
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# Phase 2 CI/CD — Lighthouse-CI for public routes

Landed as part of the Phase 2 CI/CD swarm.  
Tracking PR: "Phase 2 — CI/CD: Lighthouse-CI for public routes (Forgejo + GitHub)"

---

## Where the workflows live

| Runner | File |
|--------|------|
| Forgejo (primary) | `.forgejo/workflows/lighthouse.yml` |
| GitHub Actions (mirror) | `.github/workflows/lighthouse.yml` |

Both workflows are equivalent in intent. The Forgejo workflow uses `@lhci/cli` directly
(installed via npm); the GitHub workflow uses `treosh/lighthouse-ci-action` which wraps
the same CLI and adds convenient artifact upload.

The `.forgejo/workflows/` directory takes precedence over `.github/` on the Forgejo
runner (Forgejo's documented override behaviour). The GitHub mirror re-runs the
`.github/` copy harmlessly.

---

## What it does

1. Builds the full workspace (`pnpm run build:platform-packages`) followed by
   `pnpm --filter dashboard run build`.
2. Starts `vite preview` on `127.0.0.1:4173` (the same preview server used in
   integration tests).
3. Runs Lighthouse against four public routes:
   - `/` — landing / home
   - `/keys` — keys overview
   - `/keys/pricing` — pricing page
   - `/keys/docs` — docs entry point
4. Reports four categories: **Performance**, **Accessibility**, **Best-Practices**, **SEO**.
5. Uploads raw JSON reports as a workflow artifact (30-day retention).

---

## How to read results

### Forgejo

1. Open the workflow run in the Forgejo Actions UI.
2. The `Assert Lighthouse scores` step prints a table of pass/warn/fail per category per URL.
3. Download the `lighthouse-reports-<sha>` artifact for the raw `.json` and `.html` files.
   Open `.html` files locally in a browser for the full interactive Lighthouse report.

### GitHub Actions

1. Open the workflow run in the GitHub Actions UI.
2. The `Run Lighthouse CI` step prints scores and a link to the public LHCI storage URL
   (valid for ~30 days, no login required).
3. The `Lighthouse results` artifact tab contains the same `.json`/`.html` files.

---

## Current mode: warn-only (non-blocking)

Neither workflow will fail the PR today. The thresholds are warn-only:

| Category | Warn below |
|----------|-----------|
| Performance | 0.70 |
| Accessibility | 0.90 |
| Best-Practices | 0.90 |
| SEO | 0.90 |

### Flip to blocking

When scores have been stable for a few runs:

1. **Forgejo** — in `.forgejo/workflows/lighthouse.yml`, remove `|| true` from the
   `lhci assert` step and tighten `minScore` values as desired.
2. **GitHub** — add a `.lighthouserc.yml` at the repo root with
   `assert.preset: lighthouse:recommended` (or custom thresholds), then set
   `failOnError: true` in the `treosh/lighthouse-ci-action` step.

Commit both changes together so both runners enforce the gate simultaneously.

---

## Coolify deploy is unaffected

This workflow only reads the Vite build output locally inside the runner. It does not
interact with the Coolify API, the Forgejo container registry, or any deployment
webhook. A Lighthouse failure (once blocking) blocks the PR merge but does not
interrupt an already-running Coolify deploy.

---

## Trigger paths

The workflow runs only when dashboard source or shared packages change:

```
apps/dashboard/**
packages/**
.forgejo/workflows/lighthouse.yml   (Forgejo)
.github/workflows/lighthouse.yml    (GitHub)
```

Docs-only or infra-only changes do not trigger a Lighthouse run.

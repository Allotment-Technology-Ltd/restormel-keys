---
title: Testing Strategy
class: governance
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# Testing Strategy

What is verified when. **Single source** for verification scope; scripts are in `scripts/`, CI in `.github/workflows/`.

**Phase 00 (now):** Repo hygiene, docs presence, secret scanning, dependency policy, config/workspace validation; CI runs these.

**Phase 01+:** Lint, typecheck, unit tests for core, targeted integration tests for critical interfaces.

**Later:** E2E, browser matrix, bundle/performance budgets, dashboard/billing tests, observability.

**Scripts:** review-docs.sh, check-secrets.sh, check-repo-hygiene.sh, check-dependency-policy.sh (see bootstrap-plan).

**Run locally (coding quality):** From repo root, `pnpm run quality` runs dashboard typecheck (svelte-check), dashboard build, dashboard unit tests, review-docs, check-secrets, and repo hygiene. Use this before committing to catch Svelte parse/type errors, build failures, and doc/secret/hygiene issues. Optional: `RUN_SMOKE=1 pnpm run quality` also smoke-tests key docs routes (preview server + GET); or run `pnpm run smoke:dashboard` after a build to verify docs pages return 2xx (catches runtime errors like undefined refs in templates). `pnpm run check:dashboard` runs only dashboard check + build.

**Dashboard + Restormel Testing (dogfood):** CI runs **`testing run --suite dashboard-critical`** against **[`examples/dashboard-dogfood/restormel-testing.yaml`](../examples/dashboard-dogfood/restormel-testing.yaml)** after `vite preview` on the built dashboard (same job as the `testing-basic-web` integration). Canonical doc: [testing/dashboard-dogfood.md](../archive/testing/testing/dashboard-dogfood.md).

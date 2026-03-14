# Testing Strategy

What is verified when. **Single source** for verification scope; scripts are in `scripts/`, CI in `.github/workflows/`.

**Phase 00 (now):** Repo hygiene, docs presence, secret scanning, dependency policy, config/workspace validation; CI runs these.

**Phase 01+:** Lint, typecheck, unit tests for core, targeted integration tests for critical interfaces.

**Later:** E2E, browser matrix, bundle/performance budgets, dashboard/billing tests, observability.

**Scripts:** review-docs.sh, check-secrets.sh, check-repo-hygiene.sh, check-dependency-policy.sh (see bootstrap-plan).

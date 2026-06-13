# Reliability Standards

Canonical reliability baseline. Aligns to [bootstrap-plan.md](../archive/2026-03-build-pack/bootstrap-plan.md). Operational procedures: [runbooks.md](../runbooks/README.md). Release gate: [release-readiness.md](release-readiness.md).

## Principles

- Safe failure over silent failure; clear failure over hidden partial success.
- Errors preserve user trust; destructive or state-changing behavior is auditable.
- Future hosted components use explicit readiness and rollback discipline.

## Mandatory baseline

- **Logging:** Structured; no secrets.
- **Hosted (future):** Health/readiness; rollback expectations for releases and destructive changes.
- **Changes:** Migration/change-safety notes before irreversible actions.
- **Degraded mode:** Defined behavior for dependency outages or validation failures.
- **Incidents:** Stub in [runbooks.md](../runbooks/README.md); expand when operations exist.
- **Release:** Readiness gate before more complex hosted flows ([release-readiness.md](release-readiness.md)).

## Phase 00

Expectations only. Implementation when product coding starts (Phase 01+).

## Maintenance

Update when reliability principles or baseline requirements change (e.g. new hosted component, incident process). Keep runbooks and release-readiness in sync; do not duplicate their content here.

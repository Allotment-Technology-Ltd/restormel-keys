# Release Readiness

Phase and release gate expectations. **Single source** for “when can we move?” Checklist content in [bootstrap-checklist.md](archive/2026-03-build-pack/bootstrap-checklist.md).

**Phase 00 → Phase 01:** May begin when bootstrap-checklist is satisfied, root and docs/ are coherent, rules/skills/subagents/scripts/workflows exist per [bootstrap-plan.md](archive/2026-03-build-pack/bootstrap-plan.md), baselines are documented, no product logic added, and release-readiness-checker (or equivalent) has been run and approved.

**Approval:** Gate lift is manual. **Gate lifted:** Phase 00 complete; Phase 01 implementation may begin. No provider, routing, billing, or hosted logic was added during Phase 00.

**Later releases:** Run readiness audit against required docs, scaffolding, scripts, workflows. Use release-prep skill and release-readiness-checker as needed.

## NPM Release Gate (tag-driven)

Package publishing is intentionally decoupled from regular CI runs:
- `.github/workflows/ci.yml` validates quality on PRs and `main` pushes.
- `.github/workflows/publish.yml` publishes to npm **only** on tags matching `keys-v*`.

When changes touch publishable packages under `packages/`, release readiness must include:
1. Version bumps committed for the packages being released.
2. Changelog/release notes updated with downstream-impacting changes.
3. Explicit tag plan recorded (`keys-vX.Y.Z`) and owner assigned.
4. Post-merge tag push executed to trigger publish workflow.

Without the `keys-v*` tag push, package changes do not reach npm.

## API `contractVersion` bump policy

Version strings in JSON are **not** semver for the whole product; they label specific payloads:

| Surface | Field | When to bump |
|--------|--------|----------------|
| Resolve + simulate success | `data.contractVersion` | Any change to required success fields, semantics of `providerType` / `modelId`, `stepChain`, `fallbackCandidates`, or `decisionMetadata` shape |
| Catalog | `contractVersion` | Any breaking or material change to catalog schema (document in changelog) |
| Evaluate and other endpoints | Follow same rule when documented as stable | Bump when integrators must change parsing |

**Process:** increment the constant in code (e.g. `RESOLVE_SIMULATE_CONTRACT_VERSION`), update `docs/api/openapi.yaml` examples, [resolve-to-execution-contract.md](guides/resolve-to-execution-contract.md), and `CHANGELOG.md`. For `@restormel/keys` types, bump `packages/core` and release with a `keys-v*` tag.

---
title: Runbook — npm maintenance window (Phase 7)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-04
last-reviewed: 2026-06-13
review-interval: P12M
---

# Runbook — npm maintenance window (Phase 7)

**Programme:** [PHASE7-SUITE-MIGRATION-STATUS.md](../archive/suite-migration-status/PHASE7-SUITE-MIGRATION-STATUS.md)  
**Canonical spec:** [SUITE-ARCHITECTURE-MIGRATION.md](../architecture/SUITE-ARCHITECTURE-MIGRATION.md) § Phase 7  

---

## Deprecated packages (bugfix-only until **2026-12-01**)

| Package | Replacement |
| --- | --- |
| `@restormel/keys` | Keys REST (`/keys/v1/*`) + dashboard client patterns — [npm-to-rest-keys.md](../guides/npm-to-rest-keys.md) |
| `@restormel/keys-svelte` | `@restormel/keys-elements` |
| `@restormel/keys-react` | `@restormel/keys-elements` |
| `@restormel/ui-graph-svelte` | `@restormel/graph-elements` + `POST /graph/v1/layout` |

**Still actively published:** `keys-elements`, `graph-elements`, `keys-cli`, `mcp`, `aaif`, `@restormel/testing-*`, platform + knowledge packages.

---

## CI publish token (`NPM_TOKEN`)

GitHub Actions publish workflows (`publish.yml`, `publish-graph.yml`, `publish-restormel-platform.yml`, and recovery `workflow_dispatch` jobs) read **`NPM_TOKEN`** from repository secrets.

- Use an npm **granular** or **automation** token scoped to publish `@restormel/*`.
- Enable **Bypass 2FA for automation** on the token (otherwise publishes fail with `EOTP`).
- Store only in GitHub Secrets; never commit. Package matrix: [npm-packages.md](../reference/npm-packages.md).

After updating the secret, re-run failed jobs with `gh run rerun <run-id> --failed` or trigger the relevant recovery workflow on `main`.

---

## Maintainer policy during the window

1. **Allowed:** security fixes, regression bugfixes, dependency bumps required for CI/security.
2. **Not allowed:** new public API surface, new components, feature flags, marketing-only README expansions that imply long-term support.
3. **Publish trains:** `keys-v*` and `graph-v*` may still publish deprecated packages for patch releases — treat them as maintenance-only in release notes.
4. **Versioning:** patch bumps only on deprecated packages unless a coordinated security exception is documented in CHANGELOG.

---

## Window open checklist (Phase 7 merge)

- [ ] README banners show **deprecated** + archive date on all four packages
- [ ] Package CHANGELOG entries record maintenance window
- [ ] `scripts/smoke-consumer-elements-only.sh` passes in CI
- [ ] SOPHIA: `@restormel/keys-svelte` not in production `dependencies`
- [ ] Comms draft (blog / GitHub discussion) scheduled

---

## Window close checklist (**2026-12-01** target)

Run from a maintainer machine with npm publish access:

```bash
# Example — adjust message before running
npm deprecate @restormel/keys@'*' 'Archived 2026-12-01. Use Keys REST and @restormel/keys-elements.'
npm deprecate @restormel/keys-svelte@'*' 'Archived 2026-12-01. Use @restormel/keys-elements.'
npm deprecate @restormel/keys-react@'*' 'Archived 2026-12-01. Use @restormel/keys-elements.'
npm deprecate @restormel/ui-graph-svelte@'*' 'Archived 2026-12-01. Use @restormel/graph-elements and Graph REST.'
```

Then:

- [ ] Final patch publish if needed
- [ ] Remove deprecated packages from default publish docs / walkthrough “install” paths
- [ ] SOPHIA: remove archived deps (except any explicitly deferred — Graph WC should complete in Phase 8 **before** ui-graph-svelte archive)
- [ ] Update [PHASE7-SUITE-MIGRATION-STATUS.md](../archive/suite-migration-status/PHASE7-SUITE-MIGRATION-STATUS.md) to **closed**

---

## Automated smoke (elements-only consumer)

```bash
bash scripts/smoke-consumer-elements-only.sh
```

Verifies `@restormel/keys-elements` and `@restormel/graph-elements` build, export files exist, and a minimal consumer `package.json` does **not** pull deprecated adapter packages.

---

## Related

- [npm-to-rest-keys.md](../guides/npm-to-rest-keys.md)
- [restormel-graph-sophia-consumer.md](../archive/deferred-products/restormel-graph-sophia-consumer.md)
- [npm-packages.md](../reference/npm-packages.md)

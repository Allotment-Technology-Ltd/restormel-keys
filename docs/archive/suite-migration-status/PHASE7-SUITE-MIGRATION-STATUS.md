# Phase 7 — Suite migration status (npm maintenance window)

**Programme:** [SUITE-ARCHITECTURE-MIGRATION.md](./SUITE-ARCHITECTURE-MIGRATION.md)  
**Branch:** `cursor/phase7-npm-maintenance-0cf6`  
**Last updated:** 2026-06-01  

---

## Goal

Six-month **bugfix-only** npm maintenance window for deprecated Keys + Graph **UI adapter** packages, then archive. **Testing npm unchanged.** Preferred integrator paths: **Keys REST**, **`@restormel/keys-elements`**, **Graph REST**, **`@restormel/graph-elements`**.

---

## Maintenance window

| Field | Value |
| --- | --- |
| **Window opens** | 2026-06-01 (Phase 7 merge) |
| **Target archive date** | 2026-12-01 |
| **Policy** | Bugfix-only semver (patch) on deprecated packages; no new features |

---

## Package disposition

| Package | Phase 7 action | After window |
| --- | --- | --- |
| `@restormel/keys` | Bugfix-only; README deprecation banner | npm **deprecate** → archive |
| `@restormel/keys-svelte` | Bugfix-only | deprecate → archive |
| `@restormel/keys-react` | Bugfix-only | deprecate → archive |
| `@restormel/ui-graph-svelte` | Bugfix-only; SOPHIA may keep until Phase 8 | deprecate → archive |
| `@restormel/keys-elements` | **Keep publishing** | Active |
| `@restormel/graph-elements` | **Keep publishing** | Active |
| `@restormel/keys-cli`, `mcp`, `aaif` | **Keep publishing** | Active |
| Platform + knowledge packages | **Keep publishing** | Active |
| `@restormel/testing-*` | **Unchanged** | Active |

Runbook: [docs/runbooks/npm-maintenance-window.md](../runbooks/npm-maintenance-window.md).

---

## Deliverables (this slice)

| Item | Status |
| --- | --- |
| `PHASE7-SUITE-MIGRATION-STATUS.md` | Done |
| npm maintenance runbook | Done |
| README deprecation banners + archive date | Done |
| Package CHANGELOG archive notices | Done |
| `scripts/smoke-consumer-elements-only.sh` | Done |
| Publish workflow maintenance comments | Done |
| SOPHIA: `@restormel/keys-svelte` → devDependency | Done |

---

## SOPHIA scope (Phase 7 vs 8)

| Dependency | Phase 7 | Phase 8 |
| --- | --- | --- |
| `@restormel/keys-svelte` | Moved to **devDependencies** (dev route only) | Remove after archive |
| `@restormel/keys` (headless) | **Keep** — REST migration is ongoing | Re-evaluate at archive |
| `@restormel/ui-graph-svelte` | **Keep** (programme) | WC cutover → `@restormel/graph-elements` |

---

## Automated gate

```bash
# restormel-keys
bash scripts/smoke-consumer-elements-only.sh
pnpm run test:platform-packages

# sophia — production deps must not include keys-svelte
node -e "const p=require('./package.json'); if(p.dependencies?.['@restormel/keys-svelte']) process.exit(1)"
pnpm test
```

---

## Manual gate (pending)

| Review | Pass criteria |
| --- | --- |
| Deprecation comms | Blog/changelog announcement with archive date |
| npm `deprecate` | Run at window **close** (not window open) |
| Consumer migration | New apps use elements + REST only |

Record in PR: `Stage gate: automated ✅ manual ☐`

---

## Next phase

**Programme complete (Phases 0–8).** See [PHASE8-SUITE-MIGRATION-STATUS.md](./PHASE8-SUITE-MIGRATION-STATUS.md) for SOPHIA reference-consumer sign-off and Graph Web Component cutover.

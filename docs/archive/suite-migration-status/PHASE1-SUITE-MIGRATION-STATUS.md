# Phase 1 — Suite migration status (Keys REST + Web Components GA)

**Programme:** [SUITE-ARCHITECTURE-MIGRATION.md](./SUITE-ARCHITECTURE-MIGRATION.md)  
**Branch:** `cursor/phase1-keys-rest-ga-0cf6`  
**Last updated:** 2026-06-01  

---

## Goal

External integrators can use Keys **without** `@restormel/keys` npm for hot paths; Web Components documented as primary UI.

---

## Deliverables

| Priority | Item | Status |
| --- | --- | --- |
| P0 | `/keys/v1/*` handlers (resolve, catalog, models, policies/evaluate) | Done — `apps/dashboard/src/routes/keys/v1/` |
| P0 | Zuplo `routes.oas.json` + `KEYS_SITE_ORIGIN` | Done — `scripts/validate-zuplo-keys-v1.mjs` |
| P0 | `docs/guides/npm-to-rest-keys.md` | Done |
| P1 | `@restormel/keys-elements` CDN / unpkg docs | Done — `packages/elements/README.md` |
| P1 | Maintenance mode on keys / keys-svelte / keys-react READMEs | Done |
| P1 | Restormel Dashboard shell + Knowledge/Graph hub stubs | Done — `nav-config.ts`, hub pages |

---

## Automated gate

Run from repo root:

```bash
pnpm --filter dashboard run test -- src/routes/keys/v1/keys-v1-api.test.ts src/lib/nav-config.test.ts
pnpm --filter dashboard run build
node scripts/validate-openapi-suite-draft.mjs
node scripts/validate-zuplo-keys-v1.mjs
pnpm run review-docs
pnpm run hygiene
pnpm run check-secrets
```

---

## Manual gate (pending)

| Review | Pass criteria |
| --- | --- |
| External integrator smoke | Non-Svelte app calls resolve via gateway or site origin |
| OpenAPI review | Product owner accepts Keys v1 namespace |
| Zuplo env | `KEYS_SITE_ORIGIN=https://restormel.dev` set in gateway environments |

Record in PR: `Stage gate: automated ✅ manual ☐`

---

## Next phase

**Phase 2 — Graph Layout REST + Web Components** — see [PHASE2-SUITE-MIGRATION-STATUS.md](./PHASE2-SUITE-MIGRATION-STATUS.md).

**Phase 3** follows after Phase 2 manual sign-off.

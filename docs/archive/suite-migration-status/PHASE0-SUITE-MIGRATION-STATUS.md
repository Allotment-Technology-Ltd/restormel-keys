# Phase 0 — Suite architecture migration (status)

**Programme:** [SUITE-ARCHITECTURE-MIGRATION.md](./SUITE-ARCHITECTURE-MIGRATION.md)  
**Phase:** 0 — Programme foundation  
**Status:** Complete — **automated gate passed** (2026-06-01); manual gate pending product owner sign-off  
**Last updated:** 2026-06-01  

---

## Deliverables checklist

| Item | Deliverable | Status |
| --- | --- | --- |
| Migration plan | `SUITE-ARCHITECTURE-MIGRATION.md` | Done |
| Resolved decisions (§10) | Restormel Dashboard, tenancy, packages, Phase 8 Graph WC | Done |
| Extraction map | `CONNECT-EXTRACTION-MAP.md` | Done |
| Knowledge product brief | `CONNECT-PRODUCT.md` | Done |
| Horizon alignment | `HORIZON-PLATFORM-PROGRAMME.md` § Restormel Connect | Done |
| Restormel Dashboard IA | `THEME-L-IA-MATRIX.md` | Done |
| Knowledge Zod contracts | `@restormel/contracts/connect` | Done |
| OpenAPI namespace draft | `docs/api/openapi-suite-v1-draft.yaml` | Done |
| SOPHIA pointer | `sophia/docs/sophia/platform-migration.md` | Done |

---

## Automated stage gate

Run from repo roots on the phase branch:

### restormel-keys

```bash
pnpm --filter @restormel/contracts run build
pnpm --filter @restormel/contracts test
pnpm run review-docs
bash scripts/check-secrets.sh
bash scripts/check-repo-hygiene.sh
node scripts/validate-openapi-suite-draft.mjs
```

### sophia

```bash
pnpm run docs:verify-present
```

Record CI output in the Phase 0 PR. **Testing delivery migration** must not appear in diff scope.

**Last run (2026-06-01):** `@restormel/contracts` build + 13 tests pass; `review-docs`, secrets, hygiene, `validate-openapi-suite-draft.mjs` pass; sophia `docs:verify-present` pass.

---

## Manual stage gate

| Review | Pass criteria | Sign-off |
| --- | --- | --- |
| Architecture | Extraction boundaries match CONNECT-EXTRACTION-MAP; Testing excluded | _Pending_ |
| Security | No secrets; workspace tenancy documented | _Pending_ |
| Docs | Single canonical plan; documentation-strategy row present | _Pending_ |
| Product | Phase ordering + Knowledge fourth product approved | _Pending_ |

**Template:** `Stage gate: automated ✅ manual ✅ (initials, date)` on PR #155+.

---

## Next phase

**Next:** [Phase 1 — Keys REST + Web Components GA](./PHASE1-SUITE-MIGRATION-STATUS.md) — in progress on branch `cursor/phase1-keys-rest-ga-0cf6`.

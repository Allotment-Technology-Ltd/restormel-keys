# Phase 6 — Suite migration status (Knowledge product launch)

**Programme:** [SUITE-ARCHITECTURE-MIGRATION.md](./SUITE-ARCHITECTURE-MIGRATION.md)  
**Branch:** `cursor/phase6-knowledge-launch-0cf6`  
**Last updated:** 2026-06-01  

---

## Goal

Fourth suite product live on **restormel.dev**: public **Knowledge REST**, **MCP tools**, **operator hub** refresh, and **/connect** marketing/docs.

---

## Deliverables

| Item | Status |
| --- | --- |
| `POST /connect/v1/verify` → `@restormel/reasoning-core` | Done (requires verify route + provider credentials) |
| `POST /connect/v1/retrieve` → `@restormel/graphrag-core` | Done (degraded until workspace graph index) |
| Ingest REST (`/connect/v1/ingest/jobs*`) | Done (workspace-scoped job persistence, Phase 9; stub worker, Phase 10) |
| Zuplo Knowledge v1 routes + `validate-zuplo-connect-v1.mjs` | Done |
| MCP `knowledge.*` tools (validate + optional hosted proxy) | Done |
| Dashboard hub `/keys/dashboard/connect` | Done (REST overview + links) |
| Marketing `/connect` + `/connect/docs` | Done (minimal) |
| Graph operator hub expansion | Partial (docs links; snapshot persistence still Phase 6 follow-up) |

---

## SOPHIA consumer cutover

| Item | Status |
| --- | --- |
| `CONNECT_API_BASE` HTTP client | Done (optional flag) |
| Integration tests flag on/off | Done (unit tests) |

---

## Automated gate

```bash
# restormel-keys
pnpm --filter dashboard test -- src/routes/connect/v1/connect-v1-api.test.ts
node scripts/validate-zuplo-connect-v1.mjs
pnpm --filter @restormel/mcp test

# sophia
pnpm vitest run src/lib/server/knowledge/knowledgeApiClient.test.ts
pnpm test
```

---

## Manual gate (pending)

| Review | Pass criteria |
| --- | --- |
| BYOK verify chain | Dashboard route + Connections → successful `POST /connect/v1/verify` |
| Retrieve with graph | Workspace graph index attached; non-degraded retrieve |
| Ingest jobs | Phase **5b** landed; staging wave-1 ingest baseline |
| Launch checklist | PRD launch day walkthrough (all four product hubs) |

Record in PR: `Stage gate: automated ✅ manual ☐`

---

## Next phase

**Phase 8 — SOPHIA reference-consumer sign-off (+ Graph Web Components)** — see [PHASE7-SUITE-MIGRATION-STATUS.md](./PHASE7-SUITE-MIGRATION-STATUS.md) and [SUITE-ARCHITECTURE-MIGRATION.md § Phase 8](./SUITE-ARCHITECTURE-MIGRATION.md#phase-8--sophia-reference-consumer-sign-off--graph-web-components). Phase 7 tracked in [PHASE7-SUITE-MIGRATION-STATUS.md](./PHASE7-SUITE-MIGRATION-STATUS.md).

Complete Phase **5b–5d** ingest persistence before calling Knowledge Ingest “GA”.

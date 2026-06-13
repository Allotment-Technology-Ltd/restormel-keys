# Migrate from `@restormel/keys` npm to Keys REST (Phase 1)

**Status:** Canonical integrator guide  
**Audience:** App developers moving off in-process `@restormel/keys` for hot paths  
**Programme:** [SUITE-ARCHITECTURE-MIGRATION.md](../architecture/SUITE-ARCHITECTURE-MIGRATION.md) Phase 1  

Restormel Keys hot paths — **resolve**, **catalog**, **models**, and **policy evaluation** — are available as **versioned HTTP APIs** at `/keys/v1/*`. Use a **Gateway key** (`rk_…`) as `Authorization: Bearer …` on the dashboard origin or through the Zuplo edge gateway.

---

## When to use REST vs npm

| Use REST (`/keys/v1/*`) | Keep npm (`@restormel/keys`) for now |
| --- | --- |
| Any language or framework (Go, Python, Ruby, plain Node without bundling Keys) | Local BYOK resolution in the same process (legacy apps) |
| Edge or serverless callers with a Gateway key | Offline / air-gapped demos |
| New integrations after Phase 1 GA | Until you migrate — npm stays in **maintenance mode** (bugfixes only) |

**UI:** Prefer **`@restormel/keys-elements`** (Web Components) for new frontends. Svelte/React npm adapters are maintenance mode; see [keys-elements CDN install](../../packages/elements/README.md#cdn-via-unpkg).

---

## Base URLs

| Surface | Base URL | Notes |
| --- | --- | --- |
| **Hosted dashboard** | `https://restormel.dev` | Paths are `/keys/v1/…` (not under `/keys/dashboard`) |
| **Legacy dashboard API** | `https://restormel.dev/keys/dashboard` | `/api/*` — still supported; prefer `/keys/v1/*` for new code |
| **Zuplo gateway** | Your gateway host (e.g. `https://restormel-keys-gateway-main-bc13eba.zuplo.app`) | Consumer key `zpka_…` at edge; Zuplo forwards with backend `rk_…` |

Environment variable (same shape as Testing): set **`RESTORMEL_KEYS_BASE`** to the **site origin** (scheme + host, no path), e.g. `https://restormel.dev`. See [restormel-environment-vocabulary.md](./restormel-environment-vocabulary.md).

---

## Authentication

All `/keys/v1/*` runtime endpoints require a **project Gateway key**:

```http
Authorization: Bearer rk_…
```

Create keys in **Restormel Dashboard** → **Gateway keys**. Resolve and policy evaluate enforce **project scope** for Gateway keys (the key’s project must match `{projectId}` in the path or body).

**Catalog** and **models** are public read (no auth required on the dashboard origin). Zuplo may still require a consumer key at the edge depending on your gateway policy configuration.

---

## Endpoints (Phase 1)

### Resolve

```http
POST /keys/v1/projects/{projectId}/resolve
Content-Type: application/json
Authorization: Bearer rk_…

{
  "environmentId": "<uuid>",
  "routeId": "<optional>",
  "stage": "production",
  "workload": "chat",
  "estimatedInputTokens": 1200
}
```

**Success (200):** `{ "data": { … } }` — provider, model, route metadata (same as legacy `POST /keys/dashboard/api/projects/{id}/resolve`).

**Common errors:** `401` unauthorized, `402` usage limit, `403` policy blocked, `404` route not found, `422` resolve incomplete.

### Catalog

```http
GET /keys/v1/catalog?limit=100&offset=0
```

Returns contract version, providers, models, variants, and external signals (same body as `GET /keys/dashboard/api/catalog`).

### Models

```http
GET /keys/v1/models?lifecycleState=active&limit=50
```

Paged model list (same as `GET /keys/dashboard/api/models`).

### Policy evaluate

```http
POST /keys/v1/policies/evaluate
Content-Type: application/json
Authorization: Bearer rk_…

{
  "projectId": "<uuid>",
  "modelId": "gpt-4o",
  "providerType": "openai"
}
```

Gateway keys cannot evaluate against a different `projectId` than the key’s project.

---

## Example: curl resolve via site origin

```bash
export RESTORMEL_KEYS_BASE="https://restormel.dev"
export RESTORMEL_GATEWAY_KEY="rk_…"
export PROJECT_ID="…"
export ENVIRONMENT_ID="…"

curl -sS -X POST "$RESTORMEL_KEYS_BASE/keys/v1/projects/$PROJECT_ID/resolve" \
  -H "Authorization: Bearer $RESTORMEL_GATEWAY_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"environmentId\":\"$ENVIRONMENT_ID\",\"workload\":\"chat\"}"
```

---

## Example: fetch catalog (no auth)

```bash
curl -sS "$RESTORMEL_KEYS_BASE/keys/v1/catalog?limit=10"
```

---

## Zuplo edge

Configure **`KEYS_SITE_ORIGIN`** in Zuplo (e.g. `https://restormel.dev`) for `/keys/v1/*` routes. Control-plane CRUD continues to use **`KEYS_BACKEND_URL`** (`https://restormel.dev/keys/dashboard`). See [zuplo-setup.md](../runbooks/zuplo-setup.md).

OpenAPI: [openapi-suite-v1-draft.yaml](../api/openapi-suite-v1-draft.yaml) (Keys v1 implemented in Phase 1).

---

## Migration checklist

1. Replace in-process `keys.resolve()` calls with `POST …/keys/v1/projects/{id}/resolve` where network latency is acceptable.
2. Point catalog/model pickers at `GET /keys/v1/catalog` or `/keys/v1/models`.
3. Move policy checks to `POST /keys/v1/policies/evaluate`.
4. For UI, adopt `@restormel/keys-elements` or call REST from your framework.
5. Keep `@restormel/keys` only for offline BYOK until Phase 7 maintenance window completes.

**Restormel Testing** continues to use `POST /v1/testing/resolve-model` — unchanged in Phase 1.

---

## Related docs

- [keys-routing-contract.md](../architecture/keys-routing-contract.md)
- [keys-testing-onboarding.md](keys-testing-onboarding.md)
- [restormel-environment-vocabulary.md](./restormel-environment-vocabulary.md)
- [SUITE-ARCHITECTURE-MIGRATION.md](../architecture/SUITE-ARCHITECTURE-MIGRATION.md)

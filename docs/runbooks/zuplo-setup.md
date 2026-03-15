# Zuplo gateway setup — Restormel Keys (Prompt 3.6)

This runbook sets up the **Zuplo API gateway** for the Keys cloud API. External clients call Zuplo with **consumer keys** (`zpka_...`); Zuplo validates them, applies policies, and forwards requests to the **dashboard backend** (Cloud Run) using a single **backend API key** (`sk-rk-...`).

**Reference:** SOPHIA repo `docs/reference/operations/runbooks/zuplo-phase1-runbook.md` (same policy patterns; Keys uses its own project and backend URL).

**Gate:** External call through Zuplo → Cloud Run returns 200. Developer portal shows API docs.

**DO NOT:** Modify the dashboard backend to add Zuplo-specific logic. Consumer keys never hit the backend directly; only the backend key is sent to Cloud Run.

---

## 1. Create Zuplo project

1. Log in to [Zuplo](https://zuplo.com) (or your Zuplo host).
2. Create a new project: **`restormel-keys-gateway`**.
3. Note the project URL (e.g. `https://restormel-keys-gateway.<region>.zuplo.app`).

---

## 2. Configure routes (proxy to Cloud Run)

1. In the Zuplo project, open **Routes** (or **API** → **Routes**).
2. Add a route that proxies to the Keys dashboard backend:
   - **Path:** e.g. `/*` or `/v1/*` (match the path prefix you want to expose).
   - **Upstream (backend):** Cloud Run URL for the dashboard, e.g.  
     `https://keys-dashboard-<hash>.europe-west2.run.app`  
     or the canonical URL if behind a load balancer (e.g. `https://restormel.dev/keys/dashboard`).
   - **Path rewrite (if needed):** If the gateway exposes `/v1/...` but the backend expects `/keys/dashboard/api/...`, configure the rewrite so the backend receives the path it expects (e.g. strip `/v1` and add `/keys/dashboard/api`).
3. Ensure the backend base path matches how the dashboard is deployed (see [phase-3-deployment](../reference/phase-3-deployment.md)). The dashboard serves under base path `/keys/dashboard`, so backend paths are `/keys/dashboard/api/health`, `/keys/dashboard/api/projects`, etc.

---

## 3. Inbound policies (order matters)

Attach the following **inbound** policies to the route, in this order:

| Order | Policy | Purpose |
|-------|--------|---------|
| 1 | **api-key-inbound** | Validate Zuplo consumer API key; reject missing or invalid keys (401). |
| 2 | **rate-limit-inbound** | Apply rate limits per consumer key. |
| 3 | **quota-inbound** | Enforce quota (e.g. daily/monthly) per consumer key. |
| 4 | **inject-backend-auth** | Add `Authorization: Bearer <KEYS_BACKEND_API_KEY>` (or equivalent header) before forwarding to Cloud Run. |

Create each policy in the Zuplo dashboard if it does not exist (same pattern as SOPHIA’s `sophia-api-gateway`). The backend must accept only the injected backend key and must **reject** Zuplo consumer keys (`zpka_...`) if they are sent directly to the backend (see §7).

---

## 4. Backend API key (Zuplo env)

1. Create a **backend API key** for server-to-server calls from Zuplo to Cloud Run. This key must be in the format used by your backend (e.g. `sk-rk-<random>`). Store it in your secrets manager; do not commit it.
2. In the Zuplo project, open **Settings** → **Environment Variables** (or **Secrets**).
3. Add a variable:
   - **Name:** `KEYS_BACKEND_API_KEY`
   - **Value:** the backend key (e.g. `sk-rk-...`).
   - **Mark as secret** so it is not shown in logs or the UI.
4. Configure the **inject-backend-auth** policy to use this variable (e.g. set the `Authorization` header to `Bearer ${KEYS_BACKEND_API_KEY}`).

The dashboard backend must accept this key for programmatic API requests. It must **not** accept Zuplo consumer keys (`zpka_...`) on direct calls to Cloud Run.

---

## 5. Developer portal and OpenAPI spec

1. In Zuplo, open **Developer Portal** (or **Docs**).
2. Enable the developer portal for the project.
3. Add or link an **OpenAPI spec** that describes the Keys cloud API (projects, project keys, health). You can:
   - Write a minimal OpenAPI (e.g. `openapi: 3.0`, paths for `/api/health`, `/api/projects`, `/api/projects/{id}`, `/api/projects/{id}/keys`), or
   - Use an exported spec from the dashboard if one exists, or
   - Use a spec maintained in this repo (e.g. `docs/api/openapi.yaml`) and paste or import it into Zuplo.
4. Configure the portal to show authentication (API key in header or query) and example requests so developers can try the API.

**Gate:** Developer portal is live and shows the API docs.

---

## 6. Create backend API key (via dashboard)

1. In the **Keys dashboard** (Cloud Run), log in and create or select a project.
2. Create an **API key** for the project (or use a dedicated “gateway” project). This key is the one you will use as **KEYS_BACKEND_API_KEY** in Zuplo (§4).
3. Store the key securely; configure it in Zuplo as in §4. The backend must accept this key for requests that Zuplo forwards (inject-backend-auth).

---

## 7. Validation

Run these checks to meet the gate:

| Check | Expected |
|-------|----------|
| **Missing auth** | Request to Zuplo with no API key → **401** from Zuplo. |
| **Invalid key** | Request to Zuplo with invalid or revoked consumer key → **401** from Zuplo. |
| **Valid consumer key** | Request to Zuplo with valid consumer key → Zuplo forwards to Cloud Run with backend key → **200** (or appropriate response) from backend. |
| **Direct backend rejects zpka_** | Request **directly** to Cloud Run (bypassing Zuplo) with `Authorization: Bearer zpka_...` → backend returns **401** or **403** (backend must not accept Zuplo consumer keys). |

Ensure the dashboard backend is configured so that:

- It accepts the **backend key** (`sk-rk-...`) for server-to-server calls (e.g. from Zuplo).
- It **rejects** Zuplo consumer keys (`zpka_...`) when they are sent directly to the backend (so clients cannot bypass Zuplo).

---

## Summary

| Item | Value |
|------|--------|
| Zuplo project | `restormel-keys-gateway` |
| Backend | Cloud Run dashboard URL (e.g. `https://keys-dashboard-<hash>.run.app` or canonical URL with `/keys/dashboard` base path). |
| Policy chain | api-key-inbound → rate-limit-inbound → quota-inbound → inject-backend-auth |
| Backend key env | `KEYS_BACKEND_API_KEY` (secret; `sk-rk-...`) |
| Consumer keys | Issued by Zuplo; used by clients; never sent to backend. |
| Direct backend | Must reject `zpka_` keys. |

For deployment of the dashboard and site, see [phase-3-deployment](../reference/phase-3-deployment.md).

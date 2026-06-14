---
title: Zuplo config reference (Restormel Keys)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-03-15
last-reviewed: 2026-03-15
review-interval: P12M
---

# Zuplo config reference (Restormel Keys)

**Purpose:** Reference shapes for `config/routes.oas.json` and `config/policies.json` so a Cursor agent (or human) can generate or update a Zuplo gateway project from code. These files are **not** the live Zuplo project — they are templates to copy into your Zuplo project repo (or the project created in the portal and synced via GitHub).

**Canonical runbook:** [zuplo-setup.md](../zuplo-setup.md) — use it for manual steps, field meanings, and §8 for CLI/agent workflow.

**Files:**

- `config-routes.example.json` — copy or merge into your Zuplo project’s `config/routes.oas.json`. Path `/*` may need to match whatever the Route Designer uses for catch-all (e.g. some UIs use a different wildcard format).
- `config-policies.example.json` — copy or merge into your Zuplo project’s `config/policies.json`. Policy names must match the `policies.inbound` array in the route.

**Usage:**

1. Create a Zuplo project (portal or `zuplo project create --name restormel-keys-gateway`).
2. In that project’s repo (or the folder you deploy from), ensure `config/routes.oas.json` and `config/policies.json` exist. Use the examples in this folder as the target shape.
3. Set environment variables `KEYS_BACKEND_URL` and `KEYS_BACKEND_API_KEY` (CLI or portal); do not commit secrets.
4. Deploy: push to the connected GitHub branch, or run `zuplo deploy` from the project root with `ZUPLO_API_KEY` set.

**Security:** No secrets in this folder. The inject-backend-auth policy references `$env(KEYS_BACKEND_API_KEY)`; the actual value is set in Zuplo (Settings → Environment Variables, mark as secret).

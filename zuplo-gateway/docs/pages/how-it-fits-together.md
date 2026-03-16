---
title: How it all fits together
description: How the dashboard, gateway, this portal, and Restormel Keys docs relate.
---

This page explains how the different parts of Restormel Keys fit together and how a user gets here.

## The four places

| Place | URL | Purpose |
|-------|-----|--------|
| **Product docs** | [restormel.dev/keys/docs](https://restormel.dev/keys/docs/) | Framework guides, install, BYOK concepts. Start here for building with Keys in your app. |
| **Dashboard** | [restormel.dev/keys/dashboard](https://restormel.dev/keys/dashboard) | Sign in, create projects, **create Gateway keys** (`rk_...`). You get your backend key and manage projects here. |
| **API Gateway** | `https://restormel-keys-gateway-main-bc13eba.zuplo.app` | The **API** itself. Call `/api/health`, `/api/projects`, etc. with a **consumer key** (`zpka_...`). The gateway is not a website — opening it in a browser at `/` returns 404; use the API paths or this portal. |
| **This Developer Portal** | You are here | **API reference**, schemas, and “Try it” for the Cloud API. Use the **API Reference** link in the sidebar for endpoints and request/response schemas. |

## How a user gets here

1. **From product docs** — [restormel.dev/keys/docs](https://restormel.dev/keys/docs/) has a **Cloud API** section that links to this Developer Portal.
2. **From the Dashboard** — After creating a project and Gateway key, the dashboard can point you to the Cloud API docs (this portal) for how to call the API.
3. **Direct** — Bookmark or share this portal URL: `https://restormel-keys-gateway-main-bc13eba.zuplo.site`

## Flow in short

- **You (developer)** sign in at the **Dashboard** and create a project and a Gateway key → that key is used by the **gateway** when it forwards requests to the dashboard backend.
- **Your users or services** call the **Gateway** with a **consumer key** (`zpka_...`) issued by Zuplo (API Key Service). They do **not** use the dashboard or the `rk_...` key directly.
- **This Developer Portal** documents the gateway API (paths, schemas, auth) and lets you try requests with a consumer key.

## Modules and schemas

- The **API Reference** section in the sidebar is generated from the OpenAPI spec (`config/routes.oas.json`). That spec includes **components/schemas** (e.g. `Project`, `KeyInfo`). Use **API Reference** to see endpoints and their request/response schemas.
- The `modules` and `schemas` folders in the Zuplo project file tree are for optional custom code; the API schemas you see in the portal come from `routes.oas.json`.

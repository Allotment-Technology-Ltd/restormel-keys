---
title: How it all fits together
description: How the dashboard, gateway, this portal, and Restormel Keys docs relate.
---

This page explains how the different parts of Restormel Keys fit together and how a user gets here.

## Two surfaces (use the right one)

| Surface | Base URL | Auth | Used for |
|---|---|---|---|
| **Dashboard API** | `https://restormel.dev/keys/dashboard/api/...` | Gateway Key (`rk_...`) | Resolve, policies/evaluate, routes/steps (runtime operations) |
| **Zuplo Gateway API** | `https://restormel-keys-gateway-main-bc13eba.zuplo.app/api/...` | Consumer key (`zpka_...`) | Projects + Gateway key CRUD (control-plane) |

```mermaid
flowchart TB
  Dev[Developer] -->|GitHub login| Portal[Developer Portal (Zudoku)]
  Dev --> Dash[Restormel Dashboard]
  Dash -->|creates project + Gateway Key (rk_...)| Runtime[Dashboard API]
  Portal -->|\"Try it\" uses consumer key (zpka_...)| Gateway[Zuplo Gateway API]
  Gateway -->|forwards + injects backend auth| Backend[Dashboard backend]
```

## The four places

| Place | URL | Purpose |
|-------|-----|--------|
| **Product docs** | [restormel.dev/keys/docs](https://restormel.dev/keys/docs/) | Framework guides, install, BYOK concepts. Start here for building with Keys in your app. |
| **Dashboard** | [restormel.dev/keys/dashboard](https://restormel.dev/keys/dashboard) | Sign in, create projects, **create Gateway keys** (`rk_...`). You get your backend key and manage projects here. |
| **Dashboard API** | `https://restormel.dev/keys/dashboard/api/...` | Runtime operations (Resolve, policies/evaluate, routes/steps). Call from your backend with a **Gateway Key** (`rk_...`). |
| **API Gateway** | `https://restormel-keys-gateway-main-bc13eba.zuplo.app` | The **API** itself. Call `/api/health`, `/api/projects`, etc. with a **consumer key** (`zpka_...`). The gateway is not a website — opening it in a browser at `/` returns 404; use the API paths or this portal. |
| **This Developer Portal** | You are here | **API reference**, schemas, and “Try it” for the Cloud API. Use the **API Reference** link in the sidebar for endpoints and request/response schemas. |

## How a user gets here

1. **From product docs** — [restormel.dev/keys/docs](https://restormel.dev/keys/docs/) has a **Cloud API** section that links to this Developer Portal.
2. **From the Dashboard** — After creating a project and Gateway key, the dashboard can point you to the Cloud API docs (this portal) for how to call the API.
3. **Direct** — Bookmark or share this portal URL: `https://restormel-keys-gateway-main-bc13eba.zuplo.site`

## Flow in short

- **You (developer)** sign in at the **Dashboard** and create a project and a Gateway key (`rk_...`).
- **Your backend** calls the **Dashboard API** directly with the Gateway key for runtime operations like Resolve and policy evaluate.
- **Your users or services** call the **Zuplo Gateway API** with a **consumer key** (`zpka_...`) issued by Zuplo (API Key Service). They do **not** use the `rk_...` key directly.
- **This Developer Portal** documents the **Zuplo Gateway API** and lets you try requests with a consumer key.

## Which endpoint lives where

| Operation | API surface | Auth |
|----------|-------------|------|
| Resolve | Dashboard API (`/keys/dashboard/api/...`) | Gateway Key (`rk_...`) |
| Policy evaluate | Dashboard API (`/keys/dashboard/api/...`) | Gateway Key (`rk_...`) |
| Routes / Steps | Dashboard API (`/keys/dashboard/api/...`) | Gateway Key (`rk_...`) |
| Projects / Gateway key CRUD | Zuplo Gateway API (`/api/...`) | consumer key (`zpka_...`) |

## Modules and schemas

- The **API Reference** section in the sidebar is generated from the OpenAPI spec (`config/routes.oas.json`). That spec includes **components/schemas** (e.g. `Project`, `KeyInfo`). Use **API Reference** to see endpoints and their request/response schemas.
- The `modules` and `schemas` folders in the Zuplo project file tree are for optional custom code; the API schemas you see in the portal come from `routes.oas.json`.

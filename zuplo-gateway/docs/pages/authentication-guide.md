---
title: Authentication
description: Sign in, get your consumer key, and understand which key goes where.
---

# Authentication

Restormel Keys uses **two different keys** for two different API surfaces.

## 1) Consumer key (Gateway API)

Use a **Zuplo consumer key** (`zpka_...`) to call the **Zuplo Gateway API** documented in this portal.

- **Base URL**: `https://restormel-keys-gateway-main-bc13eba.zuplo.app`
- **Header**: `Authorization: Bearer zpka_...`
- **Get your key**: sign in, then visit **[My Consumer Key](/my-keys)**.

## 2) Gateway Key (Dashboard API)

Use a **Gateway Key** (`rk_...`) to call the **Dashboard API** for runtime operations.

- **Base URL**: `https://restormel.dev/keys/dashboard/api`
- **Header**: `Authorization: Bearer rk_...`
- **Create**: in the [Restormel dashboard](https://restormel.dev/keys/dashboard) under Access.

## Security notes

- Never expose `rk_...` keys in browser code. Call Dashboard API endpoints from your backend only.
- Consumer keys (`zpka_...`) are for the gateway API surface and can be used with the portal “Try it”.


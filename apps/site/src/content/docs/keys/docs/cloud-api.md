---
title: Cloud API
description: Call the Restormel Keys API via the Zuplo gateway — reference docs and Try it.
---

The **Cloud API** lets you manage projects and keys over HTTP. It is exposed through a Zuplo gateway with rate limiting, quotas, and consumer-key auth.

## Where to use it

- **API reference and Try it:** [Restormel Keys Developer Portal](https://restormel-keys-gateway-main-bc13eba.zuplo.site) — full endpoint list, request/response schemas, and interactive “Try it” with a consumer key.
- **Gateway base URL (for API calls):** `https://restormel-keys-gateway-main-bc13eba.zuplo.app` — call `/api/health`, `/api/projects`, `/api/projects/{id}`, `/api/projects/{id}/keys`. The gateway root (`/`) is not a page; use these paths.
- **Dashboard:** [restormel.dev/keys/dashboard](https://restormel.dev/keys/dashboard) — sign in, create projects, and create the **backend** API key that the gateway uses when forwarding to the Keys backend.

## How it fits together

1. You use the **dashboard** to create projects and API keys.
2. You (or your services) call the **gateway** with a **consumer key** (`zpka_...`) from Zuplo’s API Key Service.
3. The **Developer Portal** (link above) documents the API and lets you try requests.

See the portal’s [How it all fits together](https://restormel-keys-gateway-main-bc13eba.zuplo.site/how-it-fits-together) page for the full picture.

## Quick links

- [Developer Portal (API reference + Try it)](https://restormel-keys-gateway-main-bc13eba.zuplo.site)
- [Introduction & authentication](https://restormel-keys-gateway-main-bc13eba.zuplo.site/introduction)
- [Dashboard](https://restormel.dev/keys/dashboard)

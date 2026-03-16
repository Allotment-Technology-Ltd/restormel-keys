---
title: Introduction
description: Restormel Keys Cloud API — gateway and developer portal.
---

Restormel Keys exposes a **Cloud API** via a Zuplo gateway. This portal is the **API reference** for that API.

- **Clients** call the Zuplo gateway using a **consumer key** (`zpka_...`).
- Zuplo validates the consumer key (API key policy, rate limit, quota).
- Zuplo forwards the request to the dashboard backend and injects a **backend key** (`rk_...`) as `Authorization: Bearer ...`.

**Next:** [How it all fits together](/how-it-fits-together) (dashboard, gateway, this portal, product docs).  
Use the **API Reference** in the sidebar for endpoints, schemas, and **Try it**.


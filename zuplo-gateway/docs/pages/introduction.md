---
title: Introduction
description: Restormel Keys gateway documentation.
---

Restormel Keys exposes a **Cloud API** via a Zuplo gateway.

- **Clients** call the Zuplo gateway using a **consumer key** (`zpka_...`).
- Zuplo validates the consumer key (API key policy, rate limit, quota).
- Zuplo forwards the request to the dashboard backend and injects a **backend key** (`rk_...`) as `Authorization: Bearer ...`.

Use the **API Reference** section to explore endpoints and try requests.


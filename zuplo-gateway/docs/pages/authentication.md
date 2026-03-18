---
title: Authentication
description: How authentication works through the Zuplo gateway.
---

All API requests require a **Zuplo consumer API key**.

Send it as a Bearer token:

```bash
curl -i "https://restormel-keys-gateway-main-bc13eba.zuplo.app/api/health" \
  -H "Authorization: Bearer zpka_REDACTED"
```

Notes:

- **Do not** send the `zpka_...` key directly to the dashboard backend; it should only be accepted by Zuplo.
- Zuplo injects `Authorization: Bearer $env(KEYS_BACKEND_API_KEY)` when forwarding to the backend.

For **Dashboard API** runtime operations (Resolve, policy evaluate, routes/steps), do not use the consumer key at all. Call `https://restormel.dev/keys/dashboard/api/...` from your backend with your **Gateway Key** (`rk_...`).


---
title: Webhooks and audit — MVP specification
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-04-10
last-reviewed: 2026-06-13
review-interval: P12M
---

# Webhooks and audit — MVP specification

**Status:** Canonical reference for the first outbound webhook train. Complements the dashboard **audit** API (`GET /keys/dashboard/api/audit`).

## Goals

- **Push** notifications for selected control-plane events (MVP: `policy.published`).
- **HMAC-signed** JSON bodies—no provider secrets in payloads.
- **Encrypted at rest** signing secrets (same master key as hosted provider credentials).

## HTTP API

Authenticated with **session** or **management key** (same class as integrations APIs). Gateway keys cannot manage webhooks.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/keys/dashboard/api/webhooks` | List subscriptions |
| POST | `/keys/dashboard/api/webhooks` | Create (`url`, optional `event_types`) |
| DELETE | `/keys/dashboard/api/webhooks?id=<uuid>` | Remove |

`POST` returns `signing_secret` **once**. Store it in your receiver to verify `X-Restormel-Signature`.

**503** when `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY` is unset (cannot encrypt signing secrets).

## Delivery

- Fires after successful **policy publish** (non-blocking).
- Header `X-Restormel-Event: policy.published`
- Header `X-Restormel-Signature: v1=<hex>` where hex = HMAC-SHA256(secret, raw_body)
- Body shape:

```json
{
  "event": "policy.published",
  "occurred_at": "2026-04-10T12:00:00.000Z",
  "workspace_id": "…",
  "data": {
    "policy_id": "…",
    "version": 3
  }
}
```

## SIEM / audit

- **Pull:** continue using audit API for historical rows.
- **Push:** ingest webhooks into your queue; **redact** or **hash** identifiers per your retention policy.

## Related

- In-app: `/keys/docs/integrations/webhooks-audit`
- [Security baseline](../governance/security-baseline.md)
- [Threat model starter](../governance/threat-model-starter.md) (webhook section)

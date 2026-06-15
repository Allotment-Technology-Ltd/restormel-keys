---
id: REC-LEG-003
title: Privacy Policy
class: legal
owner: founder
status: draft
classification: public
control-tier: 2
created: 2026-03-18
last-reviewed: 2026-06-15
review-interval: P12M
retention: P6Y-after-superseded
effective: 2026-03-18
related: [REC-GOV-005, REC-GOV-007, REC-GOV-003]
---

> **[PLACEHOLDER — counsel] — reconcile before publishing.** This is the existing policy migrated
> **verbatim**; it is `status: draft` so the publish gate keeps it off the public site until reviewed.
> Before approval it must be brought into line with the approved governance, **without drift**:
> - **Sub-processors (§4) and international transfers (§5)** still reflect the prior Vercel / Neon / US
>   setup. The current, authoritative list — EU self-hosted (Hetzner, Helsinki) — is published at
>   [/legal/sub-processors](/legal/sub-processors) from `governance/suppliers.yaml`.
> - **Data categories + lawful bases** must be confirmed against `governance/data-inventory.yaml` and
>   the RoPA (`governance/ropa.yaml`, REC-GOV-007).
> - **Controller / ICO** details below are the confirmed facts.
>
> Counsel to finalise the binding wording. The live `/keys/privacy` page is unchanged until then.

## 1. Who we are

Restormel Keys is operated by **Allotment Technology Ltd** (company no. **16925574**, registered in England and Wales; registered office 71–75 Shelton Street, London, WC2H 9JQ). We act as the controller for personal data described in this policy.

We are registered with the UK Information Commissioner's Office (ICO), registration **ZC092549**.

Contact: [contact@restormel.dev](mailto:contact@restormel.dev)

## 2. What we process

### Account and authentication

When you sign in to the Dashboard, we receive identifiers (such as your GitHub-linked account email and an internal user ID) via our authentication provider. We use these to create your workspace and let you manage projects.

### Billing and payments (Paddle as merchant of record)

If you subscribe to Pro, Paddle processes payments as Merchant of Record. We do not store full card details. We store billing metadata needed to reflect your plan status (for example: plan, subscription status, and provider customer/subscription identifiers).

### Product usage and operational data

We process request metadata and operational logs (for example timestamps, request status, and performance metrics) to operate the service, improve reliability, and investigate abuse and incidents.

### Keys and credentials (BYOK-first)

Restormel Keys is BYOK-first. You can keep provider material entirely in your gateway or secret store, or optionally use **Connections** to store provider API keys **encrypted at rest** when your deployment operator configures encryption.

- **Gateway Keys** (used to call Restormel APIs) are stored as a prefix + hash; we do not store raw values.
- **Provider credentials** (OpenAI/Anthropic/etc.): if you add a **hosted API key** in the Dashboard, we store ciphertext (not plaintext) where encryption is enabled; the UI shows masked labels only and does not display the full secret after save. You may instead enter a **credential reference** (non-secret label) if you keep the real secret elsewhere. Rotate or revoke from Connections when your security policy requires it.

### Analytics

We may use product analytics (for example PostHog) to understand feature usage and improve the product. We do not intentionally send secrets to analytics tools.

## 3. Why we process data (legal bases)

- **Contract**: to provide the Dashboard, APIs, and subscription features you request.
- **Legitimate interests**: service security, abuse prevention, diagnostics, and product improvement.
- **Legal obligation**: finance/tax records and lawful requests where required.

## 4. Sharing and sub-processors

We do not sell personal data. We share data with vendors only to provide Restormel Keys, such as:

- **Authentication provider**: to support sign-in and sessions.
- **Neon**: hosted Postgres database.
- **Vercel**: hosting for the Dashboard and site surfaces.
- **Paddle**: checkout, subscriptions, and billing administration (Merchant of Record).
- **Zuplo**: control-plane API gateway (where enabled).
- **PostHog**: product analytics (where enabled).

## 5. International transfers

Some processors may handle data outside the UK/EEA (including in the US). Where required, we rely on appropriate safeguards made available by our providers.

## 6. Retention

- **Account/workspace records**: retained while your account is active.
- **Billing records**: retained as required for accounting and compliance.
- **Operational logs**: retained for a limited period for security and reliability.

## 7. Your rights

Depending on your location and applicable law, you may request access, correction, deletion, portability, restriction, or objection. Send requests to [contact@restormel.dev](mailto:contact@restormel.dev). We may verify identity before acting.

## 8. Children

Restormel Keys is intended for users 18+ and is not directed to children.

## 9. Security

We use technical and organizational controls, including encryption in transit, access controls, and production access restrictions. Never share raw keys in support messages.

## 10. Changes

We may update this policy. Material updates will be reflected by a new version and effective date.

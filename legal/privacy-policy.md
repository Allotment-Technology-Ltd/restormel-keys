---
id: REC-LEG-003
title: Privacy Policy
class: legal
owner: founder
status: approved
classification: public
control-tier: 2
created: 2026-03-18
last-reviewed: 2026-06-15
review-interval: P12M
approved-by: founder
approved-on: 2026-06-15
retention: P6Y-after-superseded
effective: 2026-06-15
related: [REC-GOV-005, REC-GOV-007, REC-GOV-003]
---

## 1. Who we are

Restormel Keys is operated by **Allotment Technology Ltd** (company no. **16925574**, registered in England and Wales; registered office 71–75 Shelton Street, London, WC2H 9JQ). We act as the controller for personal data described in this policy.

We are registered with the UK Information Commissioner's Office (ICO), registration **ZC092549**.

Contact: [contact@restormel.dev](mailto:contact@restormel.dev)

## 2. Where your data is held

Restormel is **self-hosted in the EU** (Hetzner, Helsinki, Finland). Your account data, keys/control-plane data, and audit logs reside in a **self-hosted PostgreSQL database in the EU**. We use a small number of sub-processors for specific functions (analytics, billing, error tracking, email) — the current, authoritative list, with role and location, is published at **[/legal/sub-processors](/legal/sub-processors)** and kept up to date.

## 3. What we process

### Account and authentication

When you sign in to the Dashboard we create an account using **BetterAuth** (self-hosted). We hold your **email and name**, session tokens, and OAuth account links; where you sign in with GitHub, this may include your GitHub avatar URL. We do not collect a company name or phone number. This data is held in our self-hosted EU PostgreSQL database.

### Keys, projects, and control-plane data

We store your projects, routing configurations, policies, budgets, entitlements, and related control-plane data, linked to your account. **Gateway API keys are stored as a prefix + hash — never in plaintext.** If you use **Connections** to store provider (BYOK) credentials, they are held **encrypted at rest** as ciphertext where your deployment operator has enabled encryption; the UI shows masked labels only. You may instead store a non-secret **credential reference** and keep the real secret elsewhere.

### Connect ingest and verification

Ingest job metadata, verification results, and provenance traces are operational data and do **not** contain user-identifiable content. Knowledge-graph data lives in **your own BYO graph store** (e.g. SurrealDB), not in Restormel.

### Product usage, operational logs, and audit events

We process request metadata and operational logs (timestamps, request status, performance metrics) to run the service and investigate abuse and incidents. We keep **audit events** (user ID, action, timestamp, and **IP address**) for security and accountability, in our self-hosted EU database.

### Billing and payments (Paddle as merchant of record)

If you subscribe, **Paddle** acts as Merchant of Record and holds the billing and payment data (name, email, address, payment details) on its side. **We store only Paddle's opaque subscription/customer IDs** — no name, email, address, or payment details on our systems.

### Analytics

We use **PostHog (EU region)** for product analytics. Events are **pseudonymous** (device/session identifiers only; we do not send your email or name). Non-essential analytics run **only with your consent** — you choose in the cookie banner, and analytics stay off (cookieless) until you opt in.

### Error tracking

We use **Sentry** for error tracking. Error payloads are configured to contain **no personal data** (`sendDefaultPii` is off).

### Email

We use **Google Workspace (Gmail)** for correspondence, which may include your name, email address, and message content when you contact us.

## 4. Why we process data (legal bases)

- **Contract** (UK GDPR Art 6(1)(b)) — to provide the Dashboard, APIs, and subscription features you request (terms accepted at sign-up).
- **Legitimate interests** (Art 6(1)(f)) — service security and protection of users, product improvement and reliability, and customer support.
- **Legal obligation** (Art 6(1)(c)) — finance/tax records (Companies Act 2006, HMRC) and lawful requests.
- **Consent** (PECR / Art 6(1)(a)) — non-essential analytics cookies, which you can accept or reject.

## 5. Sharing and sub-processors

We do **not** sell personal data. We share data with sub-processors only to provide the service. The current list — what each provides, its role, and its location — is at **[/legal/sub-processors](/legal/sub-processors)**; material changes are notified per our sub-processor change policy. The sub-processors that may handle data relevant to your use of the service include EU-hosted infrastructure (Hetzner), EU product analytics (PostHog), billing (Paddle, UK/EU), error tracking (Sentry), and email (Google Workspace).

## 6. International transfers

Restormel's infrastructure is in the **EU**. A small number of sub-processors operate outside the UK/EEA (for example Sentry and Google Workspace in the US, and an optional US-edge API gateway where enabled). Where personal data is involved, we rely on appropriate safeguards (such as Standard Contractual Clauses / the UK IDTA) made available by those providers. Error-tracking and the optional edge gateway are configured to keep personal data **off** those paths.

## 7. Retention

- **Account/workspace records and keys/control-plane data**: retained while your account is active; deleted on account closure.
- **Billing records**: held by Paddle per its policy; we retain only opaque IDs for the duration of the subscription.
- **Operational logs**: retained for a limited period for security and reliability.
- **Audit events**: 12 months hot, then archived for up to 6 years.
- **Analytics**: PostHog EU default (currently 2 years), reviewed annually.

## 8. Your rights

Depending on your location and applicable law, you may request access, correction, deletion, portability, restriction, or objection. Send requests to [contact@restormel.dev](mailto:contact@restormel.dev). We may verify identity before acting.

## 9. Children

Restormel Keys is intended for users 18+ and is not directed to children.

## 10. Security

We use technical and organizational controls, including encryption in transit, **encrypted-at-rest storage for BYOK credentials**, **hashing of gateway API keys (never plaintext)**, access controls, and production-access restrictions. Never share raw keys in support messages.

## 11. Changes

We may update this policy. Material updates will be reflected by a new version and effective date.

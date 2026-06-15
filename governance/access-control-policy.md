---
id: REC-POL-002
title: Access Control Policy
class: governance
owner: founder
status: draft
classification: internal
control-tier: 2
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P12M
retention: P6Y-after-superseded
---

# Access Control Policy

> **Status: DRAFT skeleton.** Structure provided; specifics are `[PLACEHOLDER — founder]`.

## 1. Purpose & scope
Govern how access to Restormel systems and data is granted, reviewed and revoked. Supports the
Information Security Policy (`REC-POL-001`).

## 2. Principles
- **Least privilege / need-to-know** — access is the minimum required for a role/task.
- **Individual accountability** — named accounts, no shared logins where avoidable.
- **Strong authentication** — `[PLACEHOLDER: MFA requirements per system.]`
- **Secrets handling** — credentials never committed; BYOK custody honoured; tokens scoped and
  short-lived (e.g. the Cowork relay token).

## 3. Systems in scope
`[PLACEHOLDER — founder: list from the asset inventory — Forgejo, Coolify, Neon, PostHog,
Paddle, Google Workspace, Notion, Sentry, Mettle, FreeAgent, etc.]`

## 4. Joiner / mover / leaver
`[PLACEHOLDER: grant on role start, change on role change, revoke on departure. Solo founder
today — expand when the team grows.]`

## 5. Access review
Access is reviewed **quarterly** via the access-review playbook; results are filed as evidence
(`evidence/access-reviews/`). Anomalies (over-privilege, stale tokens, shared logins) are
remediated and recorded.

## 6. Review
Annual review (`P12M`) and on material change.

---
title: "DRAFT — Marketing email (Brevo) privacy-notice disclosure — GATED publish-when-live"
class: legal
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-19
last-reviewed: 2026-06-19
review-interval: P12M
retention: review-only
---

# DRAFT — Marketing-email privacy disclosure (Brevo) — DO NOT PUBLISH YET

> **GATED — publish-when-live (REC-PLAN-017 D9).** This text is prepared in advance but MUST NOT be
> added to the public privacy notice (`legal/privacy-policy.md` / restormel.dev/keys/privacy) until the
> **first marketing send** goes out. `classification: internal` keeps it off the public site (only
> `public` renders). When the marketing stream goes live: move the relevant section into the public
> privacy notice, set the lawful-basis/retention placeholders with founder/counsel, bump the notice
> version, and add Brevo to the public sub-processor list (`legal/sub-processors.md`) — coordinated with
> the `cowork/suppliers-brevo-entri` PR (#143).

## Scaffold — to insert into the public privacy notice's "Marketing communications" section

**Marketing communications.** If you opt in to product updates, newsletters, or release notes, we process
your **email address, name, and email-engagement data** (opens/clicks) to send those communications.

- **Lawful basis:** `[PLACEHOLDER — founder/counsel: consent (UK GDPR Art 6(1)(a)) for net-new sign-ups; PECR soft opt-in for existing customers/enquirers re: similar products]`.
- **Processor:** **Brevo** (Sendinblue SAS, France) — EU-hosted (OVH FR/DE; Google Cloud Belgium). DPA accepted under Brevo's GCU. The authoritative consent/preference ledger is held in our own EU database (`email_preferences`); Brevo holds the operational send list.
- **Your controls:** every marketing email carries a one-click unsubscribe (RFC 8058); you can manage
  per-category preferences in-product (Profile & settings → email preferences) at any time.
- **Retention:** `[PLACEHOLDER — founder/counsel: retain while subscribed; on unsubscribe keep a minimal suppression record to honour the opt-out]`.
- **Transfers:** none outside the EU/UK adequacy scope for this activity (Brevo EU region).

## Cross-references
- RoPA `PROC-009` (marketing communications) — already on `main` via PR #132.
- Data inventory `DAT-013` (subscriber list + consent ledger) — already on `main` via PR #132.
- Supplier register: Brevo — reconcile #132's entry (currently "planned/not-yet-engaged", now stale) with
  the live details in PR #143 (`cowork/suppliers-brevo-entri`) + add the Brevo DPA PDF evidence.

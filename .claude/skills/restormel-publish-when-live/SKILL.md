---
name: restormel-publish-when-live
description: >-
  THE core go-to-market principle for Restormel: never market, announce, or publicly document anything
  that is not yet shipped and live. Build the whole capability up front, then publish per the launch
  calendar. Use whenever writing marketing copy, public docs/legal, changelog/release notes, social, OR
  emails/newsletters — and whenever deciding whether something is safe to make public. Gate public-facing
  claims behind "is it live?".
---

# Restormel — publish-when-live

The standing core principle. Resolves the tension between building fast and not over-promising.

## The principle
**Build everything up front; publish only what is live.** A feature, integration, page, or email may be
fully built, merged, and ready — but its *public-facing* announcement, marketing copy, public docs, and
public legal text stay **gated** until the thing is actually shipped and working in production. Then it is
published on the launch calendar, not ad-hoc.

## Why
- Marketing or docs describing unshipped behaviour is, in effect, a false claim — it erodes trust and (for
  data/privacy text) can be inaccurate-by-construction.
- Premature public records (e.g. a privacy-notice section for a marketing programme that hasn't sent a
  single email, or a sub-processor listed before it's engaged) create governance drift.
- It lets engineering move fast (build ahead) without forcing GTM to expose half-states.

## How to apply
- **Before making anything public, ask: "is this live in prod for real users right now?"** If no, keep it
  in draft / behind a flag / out of the public site, and add it to the launch calendar instead.
- Build copy, templates, legal updates, and pages **ahead of time** — but mark them DRAFT/gated and do not
  link them from public surfaces until the feature is live.
- Public legal/privacy text (sub-processors, RoPA-derived notices) goes live **with or just before** the
  processing it describes — never ahead of it (see [[restormel-isms-records]]).
- Email/marketing: this is decision **D9 in REC-PLAN-017** — newsletter/release-notes templates and the
  public privacy-notice marketing section are built now but **published only when the marketing stream is
  live**. Transactional email (already live) is exempt — it's operational, not marketing.

## What it forbids
- Announcing/marketing/social-posting an unshipped feature.
- Adding a marketing section to the public privacy notice before the marketing stream sends.
- Listing a sub-processor publicly before it's engaged and processing.
- Changelog/release-notes entries for things not actually released.

## Related
- Build-ahead delivery: [[restormel-swarm-delivery]]. Governance records: [[restormel-isms-records]].
- Suite/marketing IA: restormel-suite-integrations-marketing. Email plan: REC-PLAN-017 (D9).

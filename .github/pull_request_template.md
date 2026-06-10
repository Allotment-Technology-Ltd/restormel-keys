## What changed
<!-- Brief description of changes -->

## Why
<!-- Reason for the change -->

## Canonical docs updated
<!-- List root or docs/ docs you updated (STATUS, ROADMAP, CHANGELOG, etc.) -->
- [ ] N/A
- [ ] Updated: ___

## Marketing claims (only if this PR touches marketing/landing/catalog copy)
<!-- Quality/verification phrases may only ship on PROVEN rows of
     docs/verified-context-claims-ledger.md — cite the row numbers backing each phrase. -->
- [ ] N/A (no marketing copy)
- [ ] Ledger rows cited: ___

## Security impact
- [ ] None
- [ ] Low (docs/process only)
- [ ] Higher (describe below)

## Pre-PR security gate
- [ ] N/A (no code / no security-sensitive docs)
- [ ] Ran [pre-PR security review](docs/guides/pre-pr-security-review.md) — gate **PASS** (restormel-high-risk-security + hygiene scripts; Aikido if MCP connected)
- [ ] Neon operator 2FA org policy confirmed (only if migrations/production DB/access docs changed)

## Reliability impact
- [ ] None
- [ ] Describe if relevant

## Checks run
- [ ] Pre-PR security ([guide](docs/guides/pre-pr-security-review.md))
- [ ] `scripts/check-repo-hygiene.sh`
- [ ] `scripts/review-docs.sh`
- [ ] `scripts/check-secrets.sh`
- [ ] `scripts/check-dependency-policy.sh`
- [ ] Other (lint/typecheck if applicable): ___

## Scope confirmation
- [ ] This PR respects Phase 00 bootstrap constraints (no product/business logic unless gate lifted)

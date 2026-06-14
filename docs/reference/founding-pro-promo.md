---
title: Founding Pro promo (first N signups)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-03-18
last-reviewed: 2026-03-18
review-interval: P12M
---

# Founding Pro promo (first N signups)

## Behaviour

- The **first 50 users** (by Better Auth `"user"."createdAt"`, tie-break `id`) receive **12 calendar months of Pro** on their default workspace.
- **New users**: when their default workspace is **first created**, if their signup rank is ≤ cap they get `plan = pro` and `plan_expires_at` = now + 12 months.
- **Existing users**: migration `008_workspace_plan_expires_at.sql` backfills the same for users already in the top 50 who are still on **free** and have **no Paddle billing refs**.
- After expiry, the workspace is downgraded to **free** on the next entitlements resolution (lazy DB update).
- **Paid Pro** (Paddle) sets `plan_expires_at = NULL` so access does not expire on a fixed calendar date.

## Environment (optional)

| Variable | Default | Meaning |
|----------|---------|---------|
| `FOUNDING_PROMO_MAX_USERS` | `50` | How many signup slots get Pro (by order). Set to `0` to stop granting **new** workspaces only (migration already applied). |
| `FOUNDING_PROMO_MONTHS` | `12` | Length of Pro access. |

## Ops

1. Apply migration **008** after **002** (Better Auth `"user"` table must exist).
2. Adjust cap/months before first production users if needed; changing cap after launch only affects **new** workspace creation, not already-granted promos.

## Code

- `getAuthUserSignupRank`, `foundingPromoMaxUsers`, `foundingPromoMonths` — `apps/dashboard/src/lib/server/neon.ts`
- Entitlements + expiry downgrade — `apps/dashboard/src/lib/server/entitlements.ts`

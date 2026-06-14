---
title: Viewing user subscription data in Neon
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-03-19
last-reviewed: 2026-03-19
review-interval: P12M
---

# Viewing user subscription data in Neon

**Purpose:** See which subscription level each workspace is on, when it's due for renewal, and when it expired or was cancelled.

## Prerequisites

- Migrations through **010_user_subscription_overview_view.sql** have been applied to your Neon branch. Run any pending migrations from `apps/dashboard/migrations/` in order (001 → 010).

## View: `user_subscription_overview`

In **Neon Console** → your project → **SQL Editor**, run:

```sql
SELECT * FROM user_subscription_overview ORDER BY plan_updated_at DESC;
```

Or open **Tables** / **Views** and select `user_subscription_overview`.

### Columns

| Column | Meaning |
|--------|--------|
| `user_id` | Workspace owner (Better Auth user ID); same as `workspaces.owner_user_id` |
| `workspace_id` | Workspace id |
| `subscription_plan` | `free` or `pro` |
| `plan_updated_at` | Unix ms when plan was last changed |
| `renewal_or_expiry_at` | Unix ms when time-limited Pro ends (NULL = paid Pro, no calendar expiry) |
| `renewal_or_expiry_at_utc` | Same as above, as timestamptz (UTC) |
| `plan_ended_at` | Unix ms when Pro was downgraded or cancelled (set on expiry or Paddle cancel) |
| `plan_ended_at_utc` | Same as above, as timestamptz (UTC) |
| `paddle_subscription_id`, `paddle_subscription_status`, `paddle_customer_id` | Paddle billing refs |
| `subscription_state` | Derived: `active`, `expired`, `free`, `lapsed`, or Paddle status (`cancelled`, `past_due`, etc.) |

The view uses **only the `workspaces` table** (no join to `user`), so it works when auth tables live in another schema or database (e.g. Neon Auth). To get name, email, or joined-at, join this view to your user store on `user_id` in your reporting tool or a separate query.

## Setting `plan_ended_at`

- **Automatic (time-limited Pro):** When Pro expires, the app downgrades the workspace and sets `plan_ended_at` to the former `plan_expires_at`.
- **Paddle cancel:** The billing webhook handles `subscription.canceled`: it finds the workspace by `paddle_subscription_id`, then sets `plan = 'free'`, `plan_ended_at = now`, and `paddle_subscription_status = 'cancelled'`. For this to work, `transaction.completed` must have stored `subscription_id` and `customer_id` on the workspace (the webhook does this when the transaction completes).

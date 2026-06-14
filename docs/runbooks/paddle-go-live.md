---
title: Paddle go-live — Restormel Keys (production)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-03-18
last-reviewed: 2026-04-10
review-interval: P12M
---

# Paddle go-live — Restormel Keys (production)

This runbook takes Paddle from sandbox-only to **production live** for Restormel Keys.

## Goal

- Production Paddle checkout works for **Pro (£10/month)**.
- Webhooks update workspace plan to **pro** after successful payment.
- Paddle domain review passes (footer links to **Terms**, **Privacy**, **Refund policy**).

## 0. Preconditions

- Legal pages are live:
  - `https://restormel.dev/keys/terms`
  - `https://restormel.dev/keys/privacy`
  - `https://restormel.dev/keys/refund-policy`
- Footer includes links to those pages.
- Pricing page can start checkout (Pro button has a configured `priceId`).

## 1. Paddle: switch to production

In Paddle:

- Create/enable your **production** store.
- Set the domain to `restormel.dev`.
- Add the website footer links in Paddle settings if requested by review.

## 2. Create the Pro product + price (production)

You have two supported paths:

### Option A — Paddle UI (recommended)

1. Create Product: **Restormel Keys Pro**
2. Create a recurring price:
   - Currency: GBP
   - Interval: monthly
   - Amount: **£10.00**
3. Copy the **price id**.

### Option B — Scripted bootstrap (catalog only)

From repo root:

```bash
PADDLE_ENVIRONMENT=production \
PADDLE_API_KEY="<paddle_api_key_placeholder>" \
pnpm tsx scripts/bootstrap-paddle.ts -- --force-create --write-env=apps/dashboard/.env.paddle.generated
```

This writes env var lines including `PADDLE_PRICE_KEYS_PRO_MONTHLY_GBP=...`.

The same script also provisions catalog entries for **Keys Team** (`PADDLE_PRICE_KEYS_TEAM_MONTHLY_GBP` / `_USD`) and **Platform** bundle (`PADDLE_PRICE_PLATFORM_MONTHLY_GBP` / `_USD`), defaulting to **£35** / **$84** monthly unless you override with `PADDLE_SETUP_*` minor-unit env vars. There is no first-party Paddle CLI; use the Dashboard, Billing API, or this repo script. Self-serve checkout for Team/Platform remains off until product entitlements catch up — see webhook handling for `tier` on Pro today.

## 3. App env vars (production)

Set these in your production environment (Vercel or your deployment target). **Do not commit values.**

### Client (public)

- `PUBLIC_PADDLE_CLIENT_TOKEN`: Paddle **production** client token.

### Server (private)

- `PADDLE_ENVIRONMENT=production`
- `PADDLE_API_KEY`: Paddle production API key.
- `PADDLE_WEBHOOK_SECRET`: Paddle webhook secret for signature verification.
- `PADDLE_PRICE_KEYS_PRO_MONTHLY_GBP`: the Pro monthly GBP price id (from step 2).

Notes:

- Checkout uses `PADDLE_API_KEY` server-side to create transactions.
- The pricing page renders the Pro button with the configured price id.

## 4. Webhook wiring

### 4.1 Configure Paddle webhook destination

Create a webhook/notification in Paddle pointing to:

- `https://restormel.dev/keys/dashboard/api/billing/webhook`

Use the signing secret as `PADDLE_WEBHOOK_SECRET`.

### 4.2 Ensure event types include “transaction completed”

The current implementation updates the workspace plan to Pro when it receives:

- `transaction.completed` (and defensively also `checkout.completed`)

If your Paddle account uses different event names, update the handler mapping.

## 5. Validation checklist (production)

### 5.1 Pricing page starts checkout

1. Visit `https://restormel.dev/keys/pricing`
2. Click **Upgrade to Pro**
3. Confirm Paddle overlay opens (no “plan not configured” message).

### 5.2 Webhook signature is verified

- With `PADDLE_WEBHOOK_SECRET` set, an invalid signature should return **401**.

### 5.3 Plan flips to Pro

After a successful transaction:

- Verify the workspace `plan` in Neon is set to `pro`.

## 6. Domain review (Paddle)

If Paddle flags missing legal links:

- Confirm the footer includes:
  - Terms
  - Privacy
  - Refund policy
- Confirm these URLs return 200 and are crawlable:
  - `/keys/terms`
  - `/keys/privacy`
  - `/keys/refund-policy`

## 7. Rollback

To disable checkout quickly:

- Unset `PUBLIC_PADDLE_CLIENT_TOKEN` (pricing page will not initialize Paddle).
- Or remove/blank `PADDLE_PRICE_KEYS_PRO_MONTHLY_GBP` (button will show an error on click).

## 8. GBP-anchored USD automation

To keep USD aligned with FX while GBP remains canonical, run:

```bash
# report only
node scripts/sync-paddle-usd-prices.mjs

# apply: create/reuse USD Paddle prices, update Vercel prod env
PADDLE_API_KEY="<paddle_api_key_placeholder>" \
VERCEL_TOKEN="<vercel_token_placeholder>" \
node scripts/sync-paddle-usd-prices.mjs --apply --redeploy
```

What it does:

- Uses canonical GBP minor units (`CANONICAL_PRO_MONTHLY_GBP_MINOR`, `CANONICAL_PRO_ANNUAL_GBP_MINOR`).
- Fetches GBP→USD rate (default `frankfurter.app`) and applies rounding policy.
- Creates new USD prices when drift exceeds threshold.
- Updates Vercel production vars:
  - `PADDLE_PRICE_KEYS_PRO_MONTHLY_USD`
  - `PADDLE_PRICE_KEYS_PRO_ANNUAL_USD`
- Optional production redeploy (`--redeploy`) so pricing UI picks new IDs.


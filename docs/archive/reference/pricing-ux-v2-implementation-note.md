# Pricing/UX v2 implementation note

## Summary (what changed)

- **Two-tier model**: Public UX now presents **Free** and **Pro (£10/month)** only.
- **No hosted key custody**: Updated user-facing docs/dashboard copy to reinforce **user-controlled keys** and remove/avoid “hosted vault” framing.
- **Entitlements baseline**:
  - Free: **1 project**, **1,000 requests/month**
  - Pro: higher limits (implementation currently sets **10 projects** and **100,000 requests/month** as a safe default)
- **Upgrade UX**: Added calm, inline notices in the dashboard Overview for usage warning/limit reached and “unlock insights / production readiness / multi-provider complexity”.
- **Billing plumbing**: Added a minimal persisted **workspace plan** (`free`/`pro`) and a webhook handler that can flip a workspace to Pro on completed checkout (using Paddle `custom_data`).
- **Analytics**: Added minimal PostHog wiring (only when `PUBLIC_POSTHOG_KEY` is set) and started capturing:
  - `pricing_view`
  - `upgrade_clicked`
  - `checkout_started`
  - `checkout_completed`

## Hosted-key language removals / reframes

- Reframed docs and onboarding copy to state: **keys remain user-controlled** and **Restormel is not a custodian**.
- Removed “future hosted vault” language where it read like a planned/default product capability.

## Remaining ambiguity / follow-ups recommended

1. **Paddle event coverage**: The webhook currently updates plan on `transaction.completed`/`checkout.completed` (defensive best-guess). Confirm the exact Paddle event types used in production and expand mapping for cancellations/downgrades.
2. **Plan display in UI**: Dashboard billing/settings pages are still minimal. Consider showing the current plan (Free/Pro) and usage remaining directly.
3. **Limit enforcement scope**:
   - Requests/month is enforced in `POST /api/projects/{id}/resolve` (Free tier).
   - Project limit is enforced in `POST /api/projects` (Free tier).
   Review whether any other “request-like” endpoints should count toward limits.
4. **Complete funnel coverage**: Add remaining PostHog events (`project_created`, `key_added`, `key_validated`, `first_request_completed`, `usage_limit_warning`, `usage_limit_reached`, `insights_locked_viewed`) at the specific UI interaction points.


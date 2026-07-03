---
title: Public-page analytics — spec (PostHog EU)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# Public-page analytics — spec (PostHog EU)

Phase 2 / W5 foundation for measuring the **public** marketing + docs surface of
the Restormel dashboard app. Extends the **existing** PostHog EU Cloud project
(no tool switch). Code lives in `apps/dashboard/src/lib/analytics/*`,
`apps/dashboard/src/lib/posthog.ts`, and `apps/dashboard/src/hooks.client.ts`.

- **PostHog project:** Allotment Technology Ltd — project `123553` (EU Cloud,
  `https://eu.i.posthog.com`).
- **Org:** `019c31cd-b3e6-0000-7a30-d26c006dda57`.

---

## 1. How it fits together

```
page-owner code ──> track("event", { ...props })   ($lib/analytics)
                          │  (typed, SSR/crash-safe wrapper of posthog.capture)
                          ▼
hooks.client.ts ──> posthog.init (consent-gated)
                ├─ enriched pageview props: route_group, signed_in
                ├─ outbound_link_click  (delegated capture listener)
                └─ scroll_depth 25/50/75/100  (rAF-throttled, reset per nav)
```

- **Typed taxonomy** — `src/lib/analytics/events.ts` is the single source of
  truth: `AnalyticsEventMap` (name → payload) plus the runtime-iterable
  `ANALYTICS_EVENTS` list (compile-time checked to cover every event).
- **`track()` helper** — `src/lib/analytics/track.ts`. The only sanctioned way
  to emit a custom event. Type-safe, no-ops outside the browser, never throws.
- **Global handlers** — `src/lib/analytics/global-handlers.ts`, wired once from
  `hooks.client.ts`. Page-owners do NOT add global listeners.
- **Consent** — `src/lib/analytics/consent.ts` (see §4).
- **Route-group classifier** — `src/lib/analytics/route-group.ts`.

Page-owner agents import from the barrel:

```ts
import { track, ANALYTICS_EVENTS } from "$lib/analytics";
track("hero_cta_click", { surface: "home", cta: "get_started" });
```

---

## 2. Event taxonomy

All custom events are lowercase snake_case, payloads are **flat scalars only**,
and **no PII** (no email, name, free text, IP, raw URL/query). `$pageview`,
`$pageleave`, and `$autocapture` are PostHog built-ins (not modelled here).

| Event | Owner | Payload (PII-free) |
|---|---|---|
| `hero_cta_click` | page-owners | `surface`, `cta`, `variant?` |
| `signup_clicked` *(existing)* | page-owners | `surface?`, `variant?` |
| `suite_intent_selected` *(existing)* | page-owners | `intent` (`run` \| `embed`) |
| `pricing_viewed` | page-owners | `surface`, `plan?` |
| `docs_search` | page-owners | `query_length` (bucket), `results_count` (int) |
| `doc_page_engaged` | page-owners | `section`, `depth?` |
| `outbound_link_click` | **global handler** | `target_host`, `from_group`, `rel?` |
| `founders_apply_started` | page-owners | `surface` |
| `founders_apply_submitted` | page-owners | `surface`, `modules_selected?` (count) |
| `dashboard_onboarding_step` *(existing)* | dashboard | `step` |
| `dashboard_feature_interest` *(existing)* | dashboard | `feature`, `action`, `item?` |
| `scroll_depth` | **global handler** | `depth` (25/50/75/100), `group` |

> **Note on `docs_search`:** the query string is deliberately **not** captured
> (PII / free-text risk). We capture a length **bucket** + result count so we can
> still spot content gaps (zero-result searches) without storing what users typed.

### Always-on event properties (registered globally)

Set via `posthog.register` on boot and every SPA navigation, so they ride along
on **every** event including `$pageview`:

- `route_group` — coarse PII-free group: `home | marketing | pricing | founders
  | docs | integrations | graph | testing | connect | dashboard | auth | admin
  | legal | other` (see `route-group.ts`).
- `signed_in` — boolean derived from the rendered page data (`page.data.user`).

---

## 3. Global handlers (hooks.client.ts only)

1. **Enriched pageviews** — `route_group` + `signed_in` registered as super
   properties; refreshed on each navigation.
2. **Outbound links** — one delegated, capture-phase `click` listener. Fires
   `outbound_link_click` for anchors whose resolved host differs from the
   current host (http/https only; ignores `#`, `mailto:`, `tel:`, `sms:`,
   `javascript:`). Sends **host only** — never the full URL.
3. **Scroll depth** — passive, `requestAnimationFrame`-throttled scroll listener
   emits `scroll_depth` once per milestone (25/50/75/100%) per page; resets on
   SPA navigation. Short pages count as 100% immediately.

---

## 4. Consent — cookieless-until-consent (EU)

Implemented in `src/lib/analytics/consent.ts`; enforced in `hooks.client.ts`.

- **Default (`unknown`)** — PostHog initialises with `persistence: "memory"` and
  `autocapture: false`. We get aggregate, non-persistent measurement with **no
  identifying cookie or localStorage** written before the visitor decides. This
  is the ePrivacy/GDPR-friendly posture for EU traffic without a hard cookie wall.
- **`granted`** — upgrade to `persistence: "localStorage+cookie"` and enable
  autocapture (full analytics with cross-visit identity).
- **`denied`** — `posthog.opt_out_capturing()`; nothing further is sent.

The decision is stored in a single first-party cookie `rk_analytics_consent`
(enum value only, ~6-month max-age, `SameSite=Lax`, `Secure` on https). No
identifiers in the cookie. **Consent UI/banner is out of W5 scope** — layout /
page-owner agents render it and call `setConsentState("granted"|"denied")`; the
new persistence/opt-out takes effect on the next load (or wire a live
`posthog.set_config` upgrade later).

---

## 5. Dashboards (CREATED in PostHog — live)

All four were created in project `123553` (MCP authenticated). Tagged
`analytics-w5` + `public-pages`.

| Dashboard | ID | URL |
|---|---|---|
| Public Pages — Traffic | 745448 | https://eu.posthog.com/project/123553/dashboard/745448 |
| Public Pages — Bounce & Engagement | 745449 | https://eu.posthog.com/project/123553/dashboard/745449 |
| Public Pages — Docs Engagement | 745451 | https://eu.posthog.com/project/123553/dashboard/745451 |
| Public Pages — Founders Funnel | 745452 | https://eu.posthog.com/project/123553/dashboard/745452 |

### Traffic (745448)
- Pageviews & unique visitors (daily) — `$pageview` total + dau.
- Pageviews by `route_group`.
- Top pages by `$pathname` (table, top 20).
- Top referrers by `$referring_domain` (table, top 20).
- Signed-in vs anonymous (`signed_in` breakdown, pie).

### Bounce & Engagement (745449)
- Scroll-depth funnel — `scroll_depth` broken down by `depth`.
- Bounce proxy — `$pageview` `unique_session` trend.
- Outbound link clicks by `target_host` (table).
- Hero CTA clicks by `cta`.

### Docs Engagement (745451)
- Docs pageviews (daily) — `$pageview` where `route_group = docs`.
- Docs searches (daily) — `docs_search` total.
- Zero-result docs searches — `docs_search` where `results_count = 0` (content gaps).
- Doc page engagement by `section` — `doc_page_engaged` (table).

### Founders Funnel (745452)
- Funnel: founders pageview → `founders_apply_started` → `founders_apply_submitted`.
- Founders started vs submitted (daily trend).

> Until page-owner agents wire the CTA-level events (`hero_cta_click`,
> `pricing_viewed`, `docs_search`, `doc_page_engaged`, `founders_apply_*`), those
> tiles show zero volume by design — `$pageview`, `scroll_depth`, and
> `outbound_link_click` populate immediately from the global handlers.

---

## 6. Weekly digest (SPEC — create manually)

The automated weekly AI digest was **not** auto-created: the environment blocked
creating a recurring email subscription to an inferred recipient. Create it in
PostHog (Settings → Subscriptions, or the MCP `subscriptions-create`) with the
**recipient of your choice**:

- **Kind:** AI prompt subscription (`resource_type: ai_prompt`).
- **Frequency:** weekly, interval 1, Monday ~08:00.
- **Target:** email (or Slack) — owner's choice.
- **Prompt:**

  > Weekly digest for Restormel public marketing + docs pages (PostHog EU,
  > project 123553). Cover the last 7 days vs the prior 7 days.
  > 1. **Traffic** — total pageviews, unique visitors (`$pageview` dau), WoW
  >    change, pageviews by `route_group`; top 5 pages by `$pathname`; top
  >    referrers by `$referring_domain`.
  > 2. **Engagement & bounce** — `scroll_depth` distribution by `depth`
  >    (25/50/75/100), flagging pages where few pass 50%; single-pageview
  >    (`$pageview` `unique_session`) bounce proxy; `hero_cta_click` by `cta`;
  >    `outbound_link_click` by `target_host`.
  > 3. **Docs** — docs pageviews (`route_group=docs`), `docs_search` volume, and
  >    zero-result searches (`docs_search` where `results_count=0`) as a
  >    content-gap signal; `doc_page_engaged` by `section`.
  > 4. **Founders funnel** — view → `founders_apply_started` →
  >    `founders_apply_submitted` step conversion + WoW change.
  > Lead with 3–5 action-oriented highlights, then the sections. Note explicitly
  > if an event has zero volume (page-owner agents may not have wired it yet).
  > No PII — these events are identifier-free by design.

---

## 7. PII & privacy guarantees

- No event payload contains email, name, free text, IP, or raw URL/query.
- `outbound_link_click` records destination **host only**.
- `docs_search` records a length **bucket** + result count, never the query.
- Pre-consent: memory-only persistence, no identifying storage, autocapture off.

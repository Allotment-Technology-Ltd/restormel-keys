---
id: REC-PLAN-028
title: Product email system — transactional + marketing streams, neo-brutalist Svelte templates, consent & preferences
class: planning
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-18
last-reviewed: 2026-06-18
review-interval: P6M
retention: review-only
---

# REC-PLAN-028 — Product email system

Plan for evolving Restormel Keys email from the current minimal transactional-only setup into a
governed, **two-stream** email system (transactional + marketing) that is on-brand
(neo-brutalist), deliverable (won't land in spam), and privacy-compliant (UK GDPR / PECR —
consent, unsubscribe, in-product preferences). Authored 2026-06-18.

Related: [REC-PLAN-001](planning-context.md) (planning context), `governance/suppliers.yaml`
(REC-GOV-005), `governance/ropa.yaml` (REC-GOV-003), `governance/risk-register.yaml`
(REC-GOV-002), `governance/data-inventory.yaml` (REC-GOV-007).

---

## 1. Current state (2026-06-18)

| Area | Today |
|------|-------|
| Transport | **Migadu** SMTP (implicit TLS, port 465) via `nodemailer` — `apps/dashboard/src/lib/server/email/send-mail.ts` |
| Mailboxes | `admin@` (postmaster + security/ops), `notify@` (transactional From), `contact@` (Reply-To / general) on `restormel.dev` |
| What sends | Better Auth hooks only: **email verification** + **password reset**, plus a **security-alert** path. All **plain-text**, no HTML, no design system. |
| Identity map | transactional: `From notify@`, `Reply-To contact@`; security/ops: `From + Reply-To admin@` (owner decision, keep stable) |
| Founder-access "approved" notification | **Does not exist** — `apps/dashboard/src/routes/keys/admin/api/founders/[email]/+server.ts` flips status only, no email |
| Marketing / newsletter / release notes | **None** — no list, no broadcast, no unsubscribe, no preferences |
| User settings | `keys/dashboard/settings/+page.svelte` exists but minimal (account info + subscription link + sign-out); **no profile editing, no email preferences** |
| DNS | `restormel.dev` registered on Vercel; Migadu MX/SPF/DKIM/DMARC active for the root domain |
| Governance | Migadu recorded in `suppliers.yaml` (scoped `allotmentology.tech`); no marketing sub-processor; no marketing RoPA activity |

**Problem statement (from the brief):** the setup is limited; we want on-brand Svelte emails, a clean
separation of transactional vs marketing so reputation/spam risk is contained, the ability for users to
unsubscribe and manage email settings in-product, and all decisions captured in governance records.

---

## 2. Locked decisions (2026-06-18)

| # | Decision | Rationale |
|---|----------|-----------|
| **D1** | **Two strictly separated streams**: *transactional* (auth, access grants, account/security) and *marketing* (newsletters, release notes, product updates). Never mix in one message or one sending reputation. | Mixing marketing into a transactional pipeline is the #1 cause of auth mail landing in spam and of CAN-SPAM/PECR breaches. |
| **D2** | **Transactional stays on Migadu**, moved onto a **dedicated sending subdomain** (proposed `send.restormel.dev`). | Already working, low volume, EU. Subdomain isolates its reputation from both human mail on the root and the marketing stream. |
| **D3** | **Marketing on a managed EU ESP — Brevo (free tier, 300 emails/day)** sending from a separate subdomain (proposed `news.restormel.dev`). | Managed deliverability + EU residency; free at current scale. Brevo holds the operational send list (recorded as a sub-processor). |
| **D4** | **Subdomain split on `restormel.dev`** (not a separate root domain): `send.` for transactional, `news.` for marketing, each with its own SPF/DKIM/DMARC. | Strong reputation isolation without buying/maintaining a second domain; keeps brand consistent. |
| **D5** | **Consent model**: **PECR soft opt-in** for existing customers/applicants (Founders Circle members + people who applied/enquired — same-product updates, clear unsubscribe), **double opt-in** for net-new newsletter sign-ups. | Soft opt-in (PECR reg. 22(3)) is lawful for existing customers/enquirers re: similar products; double opt-in is best practice + protects deliverability for cold sign-ups. |
| **D6** | **Sovereign consent ledger**: the authoritative consent + preference record lives in **our own Postgres** (`email_preferences` table on AST-003), not only in Brevo. Brevo is the send list; our DB is the source of truth. | Sovereignty principle; lets us prove consent, honour unsubscribe instantly in-product, and re-platform ESPs without losing the consent audit trail. |
| **D7** | **Svelte for email authoring**: templates are `.svelte` components rendered server-side via `render()` from `svelte/server`, using **inline styles** (no scoped `<style>`, no CSS custom properties — both are stripped by major email clients) sourced from a single `theme.ts` mirroring the `--rm-*` neo-brutalist tokens. | Proven approach; lets us reuse the design language with type-safety; inline styles + table layout = email-client robustness. |
| **D8** | **Pilot first**: the net-new **"Founders access approved"** email is the design-system proof, wired into the approval handler. Everything else is staged behind it. | Smallest end-to-end slice that exercises the whole Svelte→HTML→Migadu path and delivers immediate product value. |
| **D9** | **No public marketing claims/legal edits until the marketing stream is live** (per the publish-when-live norm). Public privacy-notice + sub-processor-page updates are gated to Phase 2 launch. | Don't describe a marketing programme that isn't shipped; avoids inaccurate public records. |

---

## 3. Architecture — two streams

```
                         ┌─────────────────────────────────────────┐
   TRANSACTIONAL         │  App (SvelteKit dashboard, server)       │
   (auth, access,        │   send-mail.ts  ──►  Migadu SMTP (465)   │──►  send.restormel.dev
    security, receipts)  │   Svelte templates → render() → HTML     │     (SPF/DKIM/DMARC)
                         └─────────────────────────────────────────┘
                                          │ consent/prefs read
                                          ▼
                         ┌─────────────────────────────────────────┐
   MARKETING             │  email_preferences  (our Postgres = SoT) │
   (newsletter,          │            │  sync subscribe/unsub        │
    release notes,       │            ▼                              │
    product updates)     │   Brevo (EU)  ──►  bulk send             │──►  news.restormel.dev
                         └─────────────────────────────────────────┘     (separate SPF/DKIM/DMARC)
```

**Why two subdomains:** a spam complaint or blocklist hit on the marketing subdomain cannot drag down
auth-email delivery, because each subdomain has independent sending reputation. The root `restormel.dev`
stays for human mailbox correspondence (`admin@/notify@/contact@`).

### 3.1 DNS / deliverability checklist (Phase 1 + 2)
For **each** sending subdomain:
- **SPF**: `v=spf1 include:<provider> -all` (Migadu for `send.`, Brevo for `news.`).
- **DKIM**: provider-issued selector(s); 2048-bit.
- **DMARC** on the org: start `p=none; rua=mailto:dmarc@restormel.dev` (monitor), tighten to
  `p=quarantine` → `p=reject` once aligned. Subdomain policy via `sp=`.
- **Return-Path / bounce** alignment per provider; **MX** only where the provider requires it.
- **PTR / custom tracking domain** for Brevo (branded open/click links on `news.` not Brevo's domain).
- **List-Unsubscribe** + **List-Unsubscribe-Post** headers (one-click, RFC 8058) on **all marketing** mail.
- Warm-up: marketing volume ramps gradually; transactional volume is already established.

> Founder action: DNS records are added in the **Vercel** DNS dashboard for `restormel.dev`.

---

## 4. Svelte email rendering (D7)

Pattern (proven this phase by the pilot):
1. `apps/dashboard/src/lib/server/email/theme.ts` — resolved hex tokens + web-safe font stacks
   (single source mirroring `packages/keys-tokens` `--rm-*`). **No CSS variables in output** (Gmail strips them).
2. `…/email/templates/*.svelte` — table-based layout, **inline `style=""` only**. A shared
   `EmailShell.svelte` provides the brutalist frame (cream canvas, ink-bordered card, offset-shadow
   emulation, header lockup, footer with address + an `unsubscribe` slot used by marketing only).
3. `…/email/render.ts` — `renderEmail(Component, props)` calls `render()` from `svelte/server`, wraps
   `.body` in the full `<!DOCTYPE html>` document (with a progressive-enhancement `<style>` for the
   web font + responsive + dark-mode), and returns `{ html, text }` (plain-text alternative is mandatory).

**Brutalist-in-email constraints (documented for future templates):**
- Hard 2px ink **borders** are the guaranteed brutalist signal (universally supported).
- **Offset shadow** (`box-shadow: 5px 5px 0`) is progressive — supported in Apple/iOS Mail, stripped by
  Outlook/Word engine. Emulate with a stacked bordered cell so the look degrades gracefully; never rely on it.
- Display font (Barlow Condensed), mono (Space Mono), body (DM Sans) are Google Fonts — **not present in
  most clients**. Inline web-safe fallbacks (`Arial`/`Arial Narrow`/`Courier New`) carry the layout;
  the web font is a `<style>` enhancement only.
- Layout is **table-based**, max-width ~600px, single column, all spacing via cell padding.

---

## 5. Email catalogue

### 5.1 Transactional (stream A — Migadu, `send.`) — never carries marketing, no unsubscribe link
| Email | Trigger | Status |
|-------|---------|--------|
| Email verification | Better Auth `sendVerificationEmail` | exists (plain-text) → re-skin (Phase 3) |
| Password reset | Better Auth `sendResetPassword` | exists (plain-text) → re-skin (Phase 3) |
| **Founders access approved** | operator approves in admin | **NEW — pilot (Phase 1)** |
| Founders application received | application submitted | candidate (Phase 3) |
| Founders access rejected/declined | operator rejects | candidate (Phase 3, optional/considered) |
| Security alert | ops path | exists → keep `admin@` identity, re-skin (Phase 3) |
| Billing receipts / dunning | Paddle webhooks | candidate (Paddle may already email; confirm to avoid duplicates) |

### 5.2 Marketing (stream B — Brevo, `news.`) — every message carries one-click unsubscribe + preference link
| Email | Cadence | Phase |
|-------|---------|-------|
| Product newsletter | ad-hoc / monthly | Phase 2 |
| Release notes | per release | Phase 2 |
| Onboarding/lifecycle (post double opt-in) | drip | Phase 4 (later) |

---

## 6. Consent, unsubscribe & preference centre (D5/D6)

- **`email_preferences` table** (our Postgres, the consent ledger):
  `user_id/email`, per-category opt-in flags (`product_updates`, `newsletter`, `release_notes`),
  `consent_source` (soft-opt-in | double-opt-in | import), `consent_at`, `unsubscribed_at`,
  `unsub_token` (signed, single-purpose), audit timestamps.
- **Unsubscribe**: every marketing email has (a) the RFC 8058 one-click `List-Unsubscribe` header and
  (b) a visible footer link to a no-login `/keys/email/unsubscribe?token=…` page. Unsubscribe writes our
  DB first (source of truth), then syncs suppression to Brevo. Honoured immediately.
- **Double opt-in** (net-new): sign-up → confirmation email (transactional) → click → consent recorded.
- **Soft opt-in** (existing Founders/applicants): may receive same-product updates with clear opt-out;
  consent_source recorded as `soft-opt-in` with the lawful-basis note. **Transactional email is never
  gated by marketing preferences.**
- **Granularity**: users choose per-category; "unsubscribe from all marketing" is always one click.

---

## 7. User profile & settings page (new)

The `settings` page is extended into a real **Profile & settings** surface (neo-brutalist, per
`restormel-neu-brutalist-ui`):
- **Profile**: display name (editable), email (read-only — managed by auth provider), avatar (from OAuth).
- **Email preferences**: per-category marketing toggles bound to `email_preferences`; clear statement
  that transactional/security email cannot be disabled while the account is active.
- **Account**: user ID, connected login (GitHub), subscription link, data-export/closure pointer.
- **Sign out** (existing).

Build phase: **Phase 3** (after the transactional re-skin), wired to the Phase-2 `email_preferences` table.

---

## 8. Governance record changes

**Made now (this plan's PR) — decisions already taken / risks now live:**
- `suppliers.yaml` (REC-GOV-005): **add Brevo** (marketing email sub-processor, EU, *planned/gated* —
  not yet processing) and **expand Migadu** to cover Restormel product transactional email. The
  `notify-subprocessor-change.mjs` Art-28 notifier fires on merge — founder to confirm timing vs. engagement.
- `ropa.yaml` (REC-GOV-003): add **PROC-009** "Marketing communications (Restormel)" (PLANNED;
  consent + PECR soft opt-in); add **Migadu** as a recipient on **PROC-001** (transactional product email).
- `data-inventory.yaml` (REC-GOV-007): add **DAT-013** "Marketing subscriber list & consent records"
  (our `email_preferences` ledger + Brevo send list).
- `risk-register.yaml` (REC-GOV-002): add **RISK-012** email deliverability/reputation + marketing-consent compliance.

**DPIA screening:** marketing-to-a-consented-list is **not** high-risk processing (no special-category
data, no large-scale systematic monitoring, no profiling with legal/similar effects). **Screening outcome:
no full DPIA required**; revisit if we add behavioural profiling/segmentation or import third-party lists.
(Recorded here per the ISMS screening convention; no `evidence/dpia/` file filed.)

**Deferred to Phase 2 launch (publish-when-live, D9):**
- Public **privacy notice** (`legal/privacy-policy.md`, /keys/privacy): add the marketing-communications
  section (lawful basis, categories, retention, right to object/withdraw) — and clear the existing notice
  action items (remove Vercel-as-host, remove Neon, add Hetzner, clarify BetterAuth).
- Public **sub-processors page** (`legal/sub-processors.md`): add Brevo once engaged.
- Brevo **DPA acceptance** + EU-residency confirmation recorded against the supplier entry.

---

## 9. Phased delivery

| Phase | Scope | Gate |
|-------|-------|------|
| **1 — Pilot (this session)** | Svelte email infra (`theme.ts`, `EmailShell.svelte`, `render.ts`) + **Founders access approved** template wired into the approval handler (fail-open on send error). Governance records above. | High-risk-security review → founder merge |
| **2 — Marketing stack** | Brevo account (EU) + `news.` subdomain DNS; `email_preferences` table + unsubscribe page + double/soft opt-in; first newsletter/release-notes template; public legal updates. | Founder; DNS; DPA |
| **3 — Transactional re-skin + profile page** | Re-skin verification/reset/security emails to the design system; `send.` subdomain; build Profile & settings + email-preferences UI. | — |
| **4 — Lifecycle (later)** | Onboarding drips, segmentation (only if a DPIA re-screen passes). | DPIA re-screen |

---

## 10. Open items / founder actions
- [ ] Confirm sending subdomains (`send.` / `news.`) or alternatives; add DNS at Vercel.
- [ ] Decide Art-28 sub-processor-change notification timing for Brevo (on-merge vs. at-engagement).
- [ ] Create Brevo (EU) account; accept DPA; confirm EU residency; record against supplier entry.
- [ ] Confirm whether Paddle already sends billing receipts (avoid duplicate transactional mail).
- [ ] Approve this plan (status: draft → approved) to unlock Phase 2.

## 11. References
- Current transport: `apps/dashboard/src/lib/server/email/send-mail.ts`
- Approval handler: `apps/dashboard/src/routes/keys/admin/api/founders/[email]/+server.ts`,
  `apps/dashboard/src/lib/server/founders-access.ts`
- Tokens: `packages/keys-tokens/src/brutalist-rm.css`
- Design skill: `restormel-neu-brutalist-ui`; governance routing: `restormel-isms-governance`

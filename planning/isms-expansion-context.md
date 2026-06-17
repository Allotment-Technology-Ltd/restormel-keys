---
id: REC-PLAN-002
title: Allotment Technology — ISMS company-wide expansion context pack
class: planning
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-17
last-reviewed: 2026-06-17
review-interval: P6M
approved-by: founder
approved-on: 2026-06-17
retention: review-only
related: [REC-PLAN-001, REC-GOV-004, REC-GOV-006, REC-GOV-007]
---

# Allotment Technology Ltd — ISMS company-wide expansion context pack

> **Purpose:** portable context for a Claude Cowork session tasked with expanding the Restormel
> ISMS to company-wide scope across all ATL products. Self-contained as of 2026-06-17.
>
> **How to use this doc:** load the `restormel-isms` skill first, read this doc, then proceed to
> interview Adam for the facts needed to expand each governance document. Follow the same
> methodology used to build the Restormel ISMS (interview → draft → approve → cowork-relay →
> Forgejo PR). Never invent facts; mark unknowns as `[PLACEHOLDER — founder: confirm]`.
> Guardrails section (§7) is mandatory reading before any work begins.

---

## 1. Organisation overview

**Allotment Technology Ltd** — UK LTD, sole director: Adam Boon (adam.boon1984@googlemail.com).
ICO registration: ZC092549.

Products and sites under governance:

| Product | Domain | Status | Personal data | Notes |
|---|---|---|---|---|
| Restormel | restormel.dev | Live (invite-only) | Yes — users, keys, billing | ISMS Phase 1 complete. All 8 governance docs approved. |
| allotmentology.tech | allotmentology.tech | In development | TBC — SSO users, possible mailing list | Company portal; provides SSO for Restormel. **Phase 2 target.** |
| Plot | plotbudget.com | Pre-revenue | Yes — mailing list | Budget/allotment planner. Own infra planned. **Phase 3 target.** |
| Sophia | usesophia.app | Pre-revenue | Yes — mailing list | AI assistant. Own infra planned. **Phase 4 target.** |

**Agreed rollout order:** Restormel ✅ → allotmentology.tech 🔄 → plotbudget.com ⏳ → usesophia.app ⏳

---

## 2. Restormel ISMS — Phase 1 complete (do not re-do)

All 8 Tier-2 governance documents approved and committed to `restormel-keys` on Forgejo.

| Record ID | Document | Repo path | Current scope |
|---|---|---|---|
| REC-POL-001 | Information Security Policy | governance/information-security-policy.md | Restormel only |
| REC-POL-002 | Access Control Policy | governance/access-control-policy.md | Restormel; MFA remediation pending (RISK-008) |
| REC-GOV-002 | Risk Register | governance/risk-register.yaml | 8 risks (RISK-001–008) |
| REC-GOV-003 | RoPA | governance/ropa.yaml | 6 processing activities (PROC-001–006) |
| REC-GOV-004 | Statement of Applicability | governance/soa.md | All 93 ISO 27001:2022 Annex A controls |
| REC-GOV-005 | Supplier Register | governance/suppliers.yaml | 15 suppliers (keyed by name; no SUP- ids) |
| REC-GOV-006 | Asset Inventory | governance/asset-inventory.yaml | 14 assets (AST-001–014) |
| REC-GOV-007 | Data Inventory | governance/data-inventory.yaml | 10 data rows (DAT-001–010) |

**Outstanding Phase 1 actions (not blocked on expansion, but track):**
- **A1** — Accept Hetzner AVV in Hetzner portal (RISK-003)
- **A2** — Accept Google Workspace DPA in Admin console (RISK-003)
- **RISK-008** — MFA enablement remediation (urgent; scheduled task)
- **RISK-006** — Complete incident response playbook before first paying customer

---

## 3. Technical setup (carry forward from Phase 1)

**Primary git host:** Forgejo at `https://git.allotmentology.tech` (org: `Allotment-Technology-Ltd`,
repo: `restormel-keys`). GitHub is push-only mirror — never canonical.

**cowork-relay:** watches `~/Claude/Projects/Restormel/cowork-outbox/`. A bundle placed there
becomes a Forgejo branch + PR. Format: `cowork-outbox/<topic>/bundle.yaml + pr_body.md + files/ + .ready`.
Branch name must start with `cowork/`. `.ready` is written last, after all other files.
Config: `cowork-relay/cowork-relay.conf`. Format spec: `cowork-relay/BUNDLE-FORMAT.md`.

**Compute:** Coolify (self-hosted, Hetzner Helsinki). BetterAuth (self-hosted). Self-hosted
Postgres on Coolify. PostHog EU (analytics). Zuplo (API gateway — US service). Paddle (billing).
Vercel (restormel.dev deployment). Neon Postgres decommissioning ~2026-06-30.

**Infrastructure note for expansion:** confirm with Adam whether allotmentology.tech runs on
the same Coolify instance as Restormel, or is separately hosted. This matters for asset and
risk entries.

---

## 4. Expansion approach — the core design decision

The cleanest model for a sole-director micro-entity: **expand the existing 8 documents in place**
rather than creating separate document sets per product. Each document grows to be company-wide,
with a `product:` tag on per-product rows where scope differs.

Benefits: single source of truth, no cross-document synchronisation burden, proportionate overhead.

Avoid: separate ISMS per product — that is enterprise overhead that a solo-founder company does
not need.

---

## 5. What each document needs, per expansion phase

### 5.1 Phase 2: allotmentology.tech

allotmentology.tech is a shared-service asset — it provides SSO for Restormel. A breach here
affects Restormel users. This makes it higher-stakes than a standalone marketing site.

**governance/information-security-policy.md (REC-POL-001)**
- Expand §1 scope from "Restormel" to "Allotment Technology Ltd — all products"
- Add multi-product governance cadence paragraph

**governance/access-control-policy.md (REC-POL-002)**
- Expand scope statement
- Add allotmentology.tech systems to the MFA table (SSO admin, portal admin)
- Add note that SSO service is a shared-service: access changes affect all products

**governance/asset-inventory.yaml (REC-GOV-006)**
- Update ISMS scope statement to company-wide
- Add AST-008 onwards for allotmentology.tech assets (domain, hosting, SSO service)
- Tag each asset with `product:` field

**governance/data-inventory.yaml (REC-GOV-007)**
- Add DAT-011 onwards for allotmentology.tech data (SSO user records, contact/enquiry data,
  mailing list if present)
- Tag each row with `product: allotmentology.tech`

**governance/suppliers.yaml (REC-GOV-005)**
- Audit: most Phase 1 suppliers are shared (Hetzner, GitHub, Google Workspace, Sentry, PostHog,
  Paddle, Zuplo). Add `products: [restormel, allotmentology.tech]` field to shared suppliers.
- Add SUP-015 onwards for any net-new suppliers unique to allotmentology.tech.

**governance/ropa.yaml (REC-GOV-003)**
- Add PROC-007 onwards for allotmentology.tech processing activities (SSO identity management,
  company portal usage, any contact/enquiry handling, mailing list if applicable)
- Confirm lawful bases: Contract for SSO users; Legitimate Interests or Consent for marketing

**governance/risk-register.yaml (REC-GOV-002)**
- Add RISK-009 onwards for expansion risks; at minimum:
  - SSO single-point-of-compromise risk (shared service across products)
  - allotmentology.tech privacy notice risk (if collecting data without a published notice)
  - Company portal access control risk

**governance/soa.md (REC-GOV-004)**
- Update scope statement in header
- Re-review any controls currently Partial that are now Implemented due to broader evidence base
- Update relevant evidence refs

### 5.2 Phase 3: plotbudget.com additions

Plot is pre-revenue but has a mailing list — personal data is live now, so GDPR obligations
apply regardless of revenue. Key adds:

- Asset: plotbudget.com domain + any hosting (own infra or shared Coolify?)
- Data: mailing list members (name, email; lawful basis: Consent / Legitimate Interests)
- RoPA: PROC-* for mailing list processing
- Risk: mailing list without documented retention/deletion procedure
- Supplier: any net-new (email platform? Landing page host?)
- Privacy notice: does plotbudget.com have one published? If not, this is urgent.

### 5.3 Phase 4: usesophia.app additions

Same pattern as Plot, plus AI-specific considerations:
- If Sophia processes personal data through AI inference: document the AI model provider as
  a sub-processor; consider ISO 42001 relevance (AI governance standard — assess after Phase 4).
- Mailing list: same pattern as Plot.
- AI data flows: what personal data (if any) flows into the AI inference layer? This needs a
  specific RoPA entry and potentially an AI-specific risk entry.

---

## 6. Interview questions per phase

Run these at the start of the relevant phase session.

### Phase 2 — allotmentology.tech

| # | Question |
|---|---|
| Q1 | Is allotmentology.tech hosted on the same Coolify/Hetzner instance as Restormel, or is it separately hosted? |
| Q2 | What data does allotmentology.tech currently collect or plan to collect? (SSO user records, contact forms, mailing list?) |
| Q3 | Does allotmentology.tech have its own privacy notice published, or will it inherit/share Restormel's? |
| Q4 | What is the timeline for SSO going live — is it already live for any users, or still in development? |
| Q5 | Any net-new suppliers for allotmentology.tech not already in suppliers.yaml (e.g. a separate domain registrar, different CDN, email platform)? |
| Q6 | Does allotmentology.tech have its own GitHub/Forgejo repo, or does it share restormel-keys? |

### Phase 3 — plotbudget.com

| # | Question |
|---|---|
| Q1 | Where is plotbudget.com currently hosted? (Same Coolify, or elsewhere?) |
| Q2 | What email platform handles the Plot mailing list? (Mailchimp, Resend, Postmark, etc.) |
| Q3 | Is there a published privacy notice at plotbudget.com/privacy? |
| Q4 | Approximately how many subscribers on the Plot mailing list? |
| Q5 | What is the lawful basis for the mailing list? (Consent — did they opt in explicitly? Or Legitimate Interests?) |

### Phase 4 — usesophia.app

| # | Question |
|---|---|
| Q1 | Does Sophia's AI inference process any personal data (e.g. user queries, documents they upload)? |
| Q2 | Which AI model providers does Sophia use, and do those providers process personal data as sub-processors? |
| Q3 | Where is Sophia hosted? (Same Coolify, or elsewhere?) |
| Q4 | Is there a published privacy notice at usesophia.app? |
| Q5 | What is the lawful basis for the Sophia mailing list? |

---

## 7. Guardrails (mandatory — carry forward from Phase 1)

- **Never invent facts.** If you don't know, mark `[PLACEHOLDER — founder: confirm]`.
- **Forgejo is the primary host.** GitHub is a mirror. All governance records go via cowork-relay.
- **Proportionate.** Sole-director micro-entity. Don't gold-plate or over-engineer.
- **Never flip CI to blocking** on any document until it is approved and committed.
- **One document at a time.** Complete, approve, and ship before starting the next.
- **Explicit approval required** before writing any cowork-relay bundle.
- **Preserve existing IDs.** The registries below are the source of truth for what's taken.
- **Expand, don't duplicate.** Update the existing governance docs in place; don't create
  parallel document sets.

---

## 8. Document ID registry — do not reuse any of these

Assets: AST-001 to AST-014 taken (AST-014 = SurrealDB, added 2026-06-17). **Next: AST-015.**
  [Reconciled 2026-06-17: this previously read "AST-001–007 / next AST-008" — stale. Main has
  since assigned AST-008 (Company Google Drive), AST-009–012 (infra split), AST-013 (Infisical),
  AST-014 (SurrealDB).]
Data rows: DAT-001 to DAT-010 taken. **Next: DAT-011.**
Processing activities: PROC-001 to PROC-006 taken. **Next: PROC-007.**
Risks: RISK-001 to RISK-010 taken. **Next: RISK-011.** (RISK-009 = box-migration; RISK-010 = Infisical SPOF.)
Suppliers: keyed by **name** — there are no `SUP-` numeric ids in suppliers.yaml, so the old
  "SUP-001–014 / next SUP-015" guidance is moot. Add a new supplier as a named entry; prefer
  `products:` tags over duplicates for shared suppliers.
Records: REC-GOV-002–007, REC-POL-001–002, REC-PLAN-001–002, REC-ADR-001 taken.

---

## 9. Skills and context documents for the new session

Load these at the start of a new Cowork session:

1. **Skill: `restormel-isms`** — load first; provides ISMS operating conventions
2. **Read: `planning/isms-expansion-context.md`** (this document) — the expansion plan
3. **Read: `governance/asset-inventory.yaml`** — current assets and IDs in use
4. **Read: `governance/suppliers.yaml`** — current supplier register
5. **Read: `governance/information-security-policy.md`** — current scope statement
6. **Read: `governance/ropa.yaml`** — current processing activities
7. **Read: `governance/risk-register.yaml`** — current risks

Then run the Phase 2 interview questions (§6) before writing anything.

---

## 10. Future consideration: ISO 42001 (AI governance)

ISO 42001:2023 is the AI management system standard. Once Sophia is in scope (Phase 4),
assess whether ATL should pursue ISO 42001 alongside ISO 27001. Key triggers: if Sophia
processes personal data through AI inference; if enterprise customers in regulated sectors
require it. Flag this as an open decision at the start of Phase 4.

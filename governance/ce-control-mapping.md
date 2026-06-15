---
id: REC-GOV-021
title: Cyber Essentials control mapping & gap analysis
class: governance
owner: founder
status: draft
classification: internal
control-tier: 2
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P6M
retention: P6Y-after-superseded
related: [REC-POL-001, REC-POL-002, REC-POL-003, REC-GOV-002, REC-GOV-004, REC-GOV-005, REC-GOV-006]
---

# Cyber Essentials control mapping & gap analysis

> **DRAFT — founder validation required.** Several "current state" rows assert real-world facts
> that only the founder can confirm (MFA enablement, macOS firewall, Hetzner firewall rules,
> auto-update settings). Those are marked **⚠ confirm**. Do not treat this as evidence of
> compliance until the rows are confirmed and the linked remediations are closed. We are
> *preparing for* Cyber Essentials — not certified.

## 1. Purpose and scope

Maps the **five Cyber Essentials technical controls** across every in-scope system, records the
current state, the gap, the remediation, the owner, and **how each control is kept continuous**
(the enforcement hook). This is the working artifact behind the Phase 7 CE+ programme and the
walk-through for the CE+ technical audit (§9).

**Standard basis:** Cyber Essentials *Requirements for IT Infrastructure* **v3.3**, assessed via
the **Danzell question set V16.3** (in force from April 2026; current as of this record's date).
Two v3.3 deltas matter: **passwords ≥12 characters** (A4.3 / A5.5 option C; up from 8) and
**passwordless / passkeys** as an explicit option. **Danzell reconciliation: DONE** — every row
below carries its Danzell question reference (CE-A0 closed).

> **Hard auto-fail questions** (a "no" fails the whole assessment): **A6.4** & **A6.5** (high/critical
> updates within 14 days, OS/firmware and software) and **A7.16** & **A7.17** (MFA on all cloud-service
> administrators and users). These set the non-negotiable bar for Waves 1–2.

### 1.1 CE scope statement (maps to Danzell §A2)

In scope = everything that can access organisational data or services from the internet. Cloud
services **cannot** be excluded (A2.9), and end-user devices **cannot** be excluded (A2.6).

- **End-user devices (A2.6):** founder MacBook (AST-006) — the sole endpoint.
- **Servers (A2.7):** the Hetzner host (AST-003) running Coolify, Forgejo, self-hosted Postgres,
  BetterAuth, and the SvelteKit app.
- **Cloud services (A2.9 — IaaS/PaaS/SaaS):** Hetzner (IaaS), Zuplo (PaaS gateway), Google
  Workspace/Gmail, Google Drive (AST-008), Mettle, FreeAgent, Paddle, Notion, Sentry, PostHog EU,
  GitHub, Vercel (DNS), Neon (decommissioning), Anthropic Claude/Cowork. **Every one needs MFA**
  (A7.14–A7.17).

Out of scope (ISMS boundary, REC-POL-001 §2): Plot, Sophia, allotmentology.tech.

**Whole-organisation scope (A2.1)** is recommended — simpler than a partial scope, and there is no
separate segregated dev/test network today. **Caveat:** Danzell §A2 requires any dev/test/pentest
network to be segregated by *firewall or VLAN* if excluded; the SoA notes prod doubles as staging
(A.8.31). If a separate staging network is later introduced, it must be firewall/VLAN-segregated or
brought fully in scope.

**Remote-worker boundary (A2.4.1/A4.1.1):** one home/remote worker (the founder). The home router
is *not* in scope; the **macOS software firewall on AST-006** is the assessed boundary control.

### 1.2 Domains

1. **Developer surfaces** — AST-006 MacBook, Claude Code / Cursor, the Mac relay, secrets estate (AST-007).
2. **Operational configuration** — AST-003 Hetzner host, Coolify, Forgejo, CI/CD, SvelteKit app, Zuplo.
3. **Admin & accountancy tooling** — Google Workspace/Gmail, Mettle, FreeAgent, Paddle, Google Drive, Notion, Sentry/PostHog.

Status: **Met · Partial · Gap · N/A — justified**. Owner: **F** = founder (real-world control),
**CC** = Claude Code (repo/host/CI), **auto** = enforced by CI / the Phase 6 agent.

---

## 2. Control 1 — Firewalls & internet gateways  *(Danzell A4)*

| Domain / system | Danzell | Current state | Status | Gap | Remediation (owner) | Enforcement |
|---|---|---|---|---|---|---|
| Dev — MacBook (AST-006) | A4.1, A4.1.1 | macOS application firewall state not recorded | **⚠ confirm / Gap** | Software firewall must be ON (required on devices on untrusted networks) | Enable macOS firewall + stealth mode; record in security-baseline.md (F) | Mac hardening checklist; attestation |
| Dev — Mac login (firewall admin pw) | A4.2, A4.3 | Mac login password = the "firewall password" for a software-firewall device | **⚠ confirm** | Device password must meet A4.3: option C (≥12 char) or A (MFA + 8) | Set ≥12-char Mac login password; record option (F) | Baseline; access review |
| Ops — Hetzner host (AST-003) | A4.1, A4.1.1, A4.7 | "Hetzner network isolation; Coolify networking" (SoA A.8.20 Partial); ruleset not codified | **Partial** | Server software firewall (UFW) + default-deny inbound (A4.7) not evidenced | Hetzner Cloud Firewall + host UFW as code: deny inbound except 443 (+22 from allow-list) (CC) | **CE-E1** config-drift check |
| Ops — Postgres / BetterAuth | A4.7 | Behind host; exposure not evidenced | **⚠ confirm** | DB/auth ports must not accept unauthenticated inbound from internet | Confirm 5432 bound to localhost/private net (CC) | External vuln scan (CE+ Test 1) |
| Ops — inbound rules process | A4.5, A4.6, A4.8 | Only 443 public (app); no documented rule-review or business-case log | **Gap** | Document business case for each open port; review rules ≤12 months | Record allowed-inbound register + annual review (F/CC) | CE-E1; annual review task |
| Ops — firewall admin over internet | A4.9–A4.11 | Coolify/Hetzner panels reachable over internet | **⚠ confirm** | If admin UI is internet-facing it needs MFA or IP allow-list | Confirm panel access is MFA-protected or IP-restricted; document (F) | Access review |
| Admin — SaaS | A4.1 | Provider-managed boundary | **N/A — justified** | Provider responsibility | Document split (F) | Supplier review |

---

## 3. Control 2 — Secure configuration  *(Danzell A5)*

| Domain / system | Danzell | Current state | Status | Gap | Remediation (owner) | Enforcement |
|---|---|---|---|---|---|---|
| Dev — MacBook (AST-006) | A5.1, A5.2, A5.3, A5.8 | FileVault on; screen-lock; .env gitignored | **Partial** | Remove unused apps/accounts; **disable auto-run of downloaded files (A5.8)**; written baseline | macOS baseline in `docs/governance/security-baseline.md`; confirm settings (F) | Mac hardening checklist |
| Dev — device unlock | A5.9, A5.10 | Mac auto-lock + login credential | **⚠ confirm** | Confirm locking mechanism + method recorded | Record unlock method (Touch ID/password) (F) | Baseline |
| Ops — host / Coolify / Forgejo | A5.1, A5.2, A5.3 | SSH key-only, password auth disabled (REC-POL-002 §4); repo-anchored config (SoA A.8.9 Met) | **Partial** | Remove default accounts/services; no default admin passwords; codify hardening | Codify host/Coolify/Forgejo hardening baseline; remove defaults (CC) | **CE-E1** config-drift check |
| **Ops — Restormel app / Forgejo / Coolify as external services** | **A5.4, A5.5, A5.6, A5.7** | App auth = BetterAuth; these are internet-facing services providing data access → **A5.4 = Yes** | **Partial** | A5.5 auth option (MFA / ≥12-char / passwordless) + **A5.7 brute-force protection** must be evidenced for each | Confirm BetterAuth password policy ≥12 char or MFA; throttle/lockout after ≤10 attempts; same for Coolify/Forgejo (CC) | External scan; baseline |
| All — password policy | A5.3, A5.5 | MFA required (REC-POL-002 §3); length not yet set to v3.3 minimum | **Gap** | Enforce **≥12-char** where configurable; prefer passkeys | Set 12-char min on configurable services; passkeys where supported (F); state in REC-POL-003 | Access review; REC-POL-003 |
| Admin — SaaS accounts | A5.1, A5.2 | Standard config | **Partial** | Remove unused integrations/admin; secure recovery options | Review each account's config + recovery (F) | Quarterly access review |

---

## 4. Control 3 — User access control  *(Danzell A7) — headline domain, RISK-008*

| Domain / system | Danzell | Current state | Status | Gap | Remediation (owner) | Enforcement |
|---|---|---|---|---|---|---|
| **MFA — all cloud services** | **A7.14, A7.16, A7.17** *(auto-fail)* | **RISK-008 (High): MFA not yet confirmed**; priority order in REC-POL-002 §3 | **Gap** | MFA on **all** cloud admins (A7.16) **and** users (A7.17) — any gap fails CE | Enrol MFA in §3 priority order; passkeys where supported; list any MFA-less service (A7.15) (F) | **CE-E2** MFA-table check |
| Unique credentials / no sharing | A7.2 | Named accounts; no shared logins (REC-POL-002) | **Met** | — | Maintain (F) | Access review |
| Account creation / approval | A7.1, A7.5 | Solo founder; JML defined for future (REC-POL-002 §5) | **Partial** | Document the (trivial) approval process for the record | State founder-approves process (F) | REC-POL-002 |
| Least privilege | A7.4 | Least-privilege principle applied | **Met** | — | Maintain | Quarterly review |
| Leaver deprovisioning | A7.3 | N/A solo; 24h revoke defined for future | **N/A — justified** | Re-assess at first hire | — | REC-POL-002 §5 |
| Admin account separation | A7.6, A7.7, A7.8, A7.9 | Founder uses admin-level accounts day-to-day | **Partial/Gap** | A7.7: admin accounts must not browse web/email; A7.6 separate admin accounts (esp. Google Workspace super-admin, host root) | Create separate admin vs daily-use accounts where feasible; track admins (A7.8); review (A7.9) (F) | Access review |
| Password quality / brute-force | A7.10, A7.11, A7.12, A7.13 | MFA required; password manager use not evidenced | **Partial** | ≥12-char or MFA; no forced expiry/complexity; documented compromise process | Adopt password manager; document controls in REC-POL-003 (F) | REC-POL-003; access review |
| Dev — relay / Claude Code tokens | A7.2, A7.4 | Relay token + SSH keys on AST-006; tied to AST-007 | **Partial** | Least-privilege token scope + unified storage | Scope relay token to push-branch only; migrate to Infisical (AST-007) (F/CC) | Secrets-store audit |

---

## 5. Control 4 — Malware protection  *(Danzell A8)*

CE accepts (A) anti-malware **and/or** (B) application allow-listing (code-signing / app store).

| Domain / system | Danzell | Current state | Status | Gap | Remediation (owner) | Enforcement |
|---|---|---|---|---|---|---|
| Dev — MacBook (AST-006) | A8.1(B), A8.4, A8.5 | Gatekeeper + XProtect (SoA A.8.7) | **Partial** | Choose route B for macOS: Gatekeeper ON, install only signed/notarised + App Store; **maintain approved-app list (A8.5)** | Confirm Gatekeeper; document approved-app list + notarisation posture in baseline (F) | Mac checklist; CE+ malware test |
| Ops — Hetzner Linux host | A8.1(B/C) | "OS defaults on Coolify" (SoA A.8.7) | **Partial** | Document Linux approach: software only from trusted repos / via CI (allow-listing); justify no AV or add ClamAV | Document server malware-protection approach in baseline (CC) | Config baseline; deploy-only-via-CI |
| Admin — Gmail / browser | A8.3 | Gmail native filtering; macOS download handling | **Partial** | Confirm browser/anti-malware warns on malicious sites (A8.3) | Document email/browser handling in baseline (F) | CE+ email + browser tests |
| All — application dependencies | (supports A6.5) | Renovate PRs; pnpm lockfile; CI secret scan | **Met** | Supply-chain coverage in place | Maintain Renovate (CC) | **CE-E3** update gate |

> Note: A8.1 lists anti-malware "for in-scope devices running Windows or macOS." For macOS the
> allow-listing route (B) via Gatekeeper + App Store + notarisation is acceptable and avoids a
> third-party AV; if the assessor prefers route A, macOS has no bundled AV, so be ready to justify B.

---

## 6. Control 5 — Security update management  *(Danzell A6)*

| Domain / system | Danzell | Current state | Status | Gap | Remediation (owner) | Enforcement |
|---|---|---|---|---|---|---|
| Dev — MacBook OS + apps | A6.1, A6.4, A6.4.1, A6.5, A6.5.1 | "Apple auto-updates enabled" (SoA A.7.13) | **⚠ confirm** | Confirm auto-update ON for OS **and** apps; macOS version in support | Confirm + record in baseline (F) | Mac checklist |
| Dev — browsers / email / office | A6.2.1, A6.2.3, A6.2.4 | Chrome/Safari; Gmail (web); Google Workspace | **⚠ confirm** | List browsers + versions; confirm all supported | Record browser/app versions (F) | Baseline |
| Ops — Hetzner host OS | A6.1, A6.4 *(auto-fail)* | Patch cadence not codified | **Gap** | Enable unattended security upgrades; **high/critical within 14 days**; track OS/Node EOL | Enable `unattended-upgrades`; document patch SLA (CC) | **CE-E3** + config check |
| Ops — Coolify / Forgejo | A6.2, A6.4 | Updated manually | **Partial** | Define update cadence for self-hosted platforms | Add to patch SLA; periodic update (CC/F) | CE-E3 |
| Ops/All — app dependencies | A6.5, A6.5.1 *(auto-fail)* | Renovate automates PRs; CI gate (SoA A.8.8) | **Partial → Met w/ gate** | CI gate that **fails** on a dependency CVSS ≥7 older than 14 days | Add CVSS/14-day gate to CI (CC) | **CE-E3** (core continuous control) |
| All — unsupported / unlicensed | A6.3, A6.6, A6.7 | Not formally tracked | **Partial** | Confirm no unsupported/unlicensed software; remove or sub-set out | Inventory + attest; remove EOL (F/CC) | Baseline; CE+ device scan |
| Admin — SaaS | A6.1 | Provider-patched | **N/A — justified** | Provider responsibility | Note in baseline | Supplier review |

---

## 7. Gap summary & priority (sequenced)

| # | Gap | Danzell | Auto-fail? | Risk | Wave | Owner |
|---|---|---|---|---|---|---|
| CE-A1 | **MFA on all cloud admins + users** | A7.16/A7.17 | **Yes** | RISK-008 | 1 | F |
| CE-A2 | **Secrets estate fragmented** → Infisical (self-hosted EU) | A7.2/A7.4 | No | RISK-002/AST-007 | 1 | F+CC |
| CE-A3 | Host UFW + default-deny inbound; DB not exposed | A4.1.1/A4.7 | No | RISK-001 | 2 | CC |
| CE-A4 | macOS firewall + ≥12-char device password | A4.1.1/A4.3 | No | — | 1–3 | F |
| CE-A5 | Host/Coolify/Forgejo + macOS secure-config baselines | A5.1–A5.3 | No | — | 2 | CC+F |
| CE-A6 | App/Forgejo/Coolify external-service auth + brute-force (A5.7) | A5.4–A5.7 | No | — | 2 | CC |
| CE-A7 | OS patch automation + **CVSS/14-day CI gate** | A6.4/A6.5 | **Yes** | — | 2 | CC |
| CE-A8 | macOS Gatekeeper + approved-app list; disable auto-run | A8.1/A8.5/A5.8 | No | — | 3 | F |
| CE-A9 | Admin-account separation (no web/email on admin) | A7.6/A7.7 | No | — | 2–3 | F |
| CE-A10 | ≥12-char password policy + password manager + passkeys | A5.5/A7.11 | No | — | 1–3 | F |
| CE-A0 | Danzell reconciliation | all | — | — | **DONE** | — |

---

## 8. Scope declaration starter (Danzell §A1–A2) — founder to confirm

| Q | Answer (draft) |
|---|---|
| A1.1 Org name | Allotment Technology Ltd |
| A1.2 Type | LTD |
| A1.3 Employees | 1 (sole director) |
| A1.4 Reg number | 16925574 |
| A1.5 Registered address | `[CONFIRM]` |
| A2.1 Scope | Whole organisation |
| A2.4.1 Home/remote workers | 1 |
| A2.4.2 How they connect | Home broadband → macOS software firewall; SSH (key-only) to Hetzner host |
| A2.5 Network equipment | Home worker relies on software firewall (macOS) — no org-managed router/firewall |
| A2.6 Laptops/desktops | 1 × Apple MacBook running macOS `[version — confirm in support]` |
| A2.7 Servers | 1 × Hetzner Cloud server running `[Ubuntu/Debian version]` hosting Coolify, Forgejo, Postgres, BetterAuth, SvelteKit app |
| A2.9 Cloud services | Hetzner (IaaS), Zuplo (PaaS), Google Workspace, Google Drive, Mettle, FreeAgent, Paddle, Notion, Sentry, PostHog EU, GitHub, Vercel, Anthropic Claude/Cowork, Neon (decommissioning) |
| A2.10 IT responsible person | Adam Boon, Director |

---

## 9. CE+ technical-audit readiness (walk-through)

With one endpoint (AST-006) and one server, device **sampling** is trivial — the sample is
effectively the whole estate. CE+ runs Sample 1 against all five tests; findings are remediated
within the 30-day window; Sample 2 (same size) re-confirms.

| CE+ test | Checks | Readiness | Blocking gap |
|---|---|---|---|
| 1. External vulnerability scan | Host + app endpoints; no CVSS ≥7 unpatched >14 days | Depends on CE-A7 + CE-A3 | Patch SLA, firewall, DB exposure |
| 2. Authenticated device scan | MacBook patch levels, unsupported software, config | Depends on CE-A4/A8 + baseline | Mac baseline |
| 3. Malware protection test | Gatekeeper/XProtect vs test file | Depends on CE-A8 | Gatekeeper confirmation |
| 4. MFA test | MFA enforced on cloud services + email | Depends on CE-A1 | MFA enrolment |
| 5. Account separation / least privilege | Admin vs standard; no over-privilege | Depends on CE-A9 | Admin separation |
| Email + browser handling | Safe handling of malicious file/link | Depends on CE-A8 | Email/browser baseline |

---

## 10. Continuous enforcement (so we *keep* meeting it)

Extending the Phase 6 evidence/posture agent and CI — converting point-in-time controls into
evidenced, continuous ones:

- **CE-E1 — config/firewall drift:** CI checks the host firewall + secure-config baseline match the
  committed config-as-code; drift opens an issue. *(A4, A5)*
- **CE-E2 — access-review + MFA freshness:** the agent checks `evidence/access-reviews/` is within
  cadence and the REC-POL-002 §3 MFA table shows no ⚠ rows. *(A7.14–A7.17)*
- **CE-E3 — update management:** Renovate + a CI gate that fails on any dependency CVSS ≥7 older
  than 14 days, mirroring A6.4/A6.5 and the CE+ scan threshold; OS patch evidence captured. *(A6)*
- **Secret-scan** (already on CI) + the post-AST-007 unified-store audit. *(A5, A7)*

Enforcement specs are handed to Claude Code in the Wave 2 hardening brief.

## 11. Review

6-monthly (P6M) and event-triggered (any new system, MFA/firewall/patch change). Reconciled to the
SoA (REC-GOV-004) and risk register (REC-GOV-002) at each review.

---
id: REC-GOV-004
title: Statement of Applicability (ISO 27001:2022 Annex A)
class: governance
owner: founder
status: approved
classification: internal
control-tier: 2
created: 2026-06-15
last-reviewed: 2026-06-19
review-interval: P12M
retention: P6Y-after-superseded
approved-by: Adam Boon
approved-on: 2026-06-19
---

# Statement of Applicability (SoA)

ISO 27001:2022 Annex A — all 93 controls. Scope: Allotment Technology Ltd in-scope products and
shared infrastructure — Restormel (restormel.dev; Keys + Connect) and allotmentology.tech
(founder-only company portal; planned contact/enquiry form). Plot and Sophia are out of scope
until later phases. Organisation: Allotment Technology Ltd (sole director). ICO registration: ZC092549.

Per-control row: `control | title | applicable? | justification | status | evidence ref`

**Status values:** Implemented · Partial · Planned · N/A — justified

---

## A.5 Organisational controls (37)

| Control | Title | Applicable | Justification / Notes | Status | Evidence |
|---|---|---|---|---|---|
| A.5.1 | Policies for information security | Yes | Top-level ISMS policy and access control policy in place | Implemented | REC-POL-001, REC-POL-002 |
| A.5.2 | Information security roles and responsibilities | Yes | Sole founder is ISMS owner; roles documented in REC-POL-001 §3 | Implemented | REC-POL-001 |
| A.5.3 | Segregation of duties | N/A — justified | Solo founder; segregation not achievable without additional staff. Compensating controls: quarterly access review + audit logging (DAT-010). Reviewed when first employee joins. | N/A — justified | RISK-007 |
| A.5.4 | Management responsibilities | Yes | Founder as sole manager; commitment stated in REC-POL-001 | Implemented | REC-POL-001 |
| A.5.5 | Contact with authorities | Partial | ICO is the relevant authority (UK GDPR Art 33). ICO registration ZC092549 confirmed. Proactive contact procedure to be documented in incident response playbook. | Partial | RISK-006; playbooks/incident-capture.md |
| A.5.6 | Contact with special interest groups | N/A — justified | No formal group membership at this stage; threat intelligence monitored via NCSC advisories and GitHub security alerts. Review when team grows. | N/A — justified | — |
| A.5.7 | Threat intelligence | Partial | Passive monitoring: NCSC feeds, GitHub Dependabot/Renovate security alerts, Sentry error tracking. No formal threat intel subscription; proportionate to solo-founder stage. | Partial | Renovate config; Sentry |
| A.5.8 | Information security in project management | Yes | ISMS governance embedded in development workflow: Forgejo CI enforces records schema; governance docs co-located in product repo (restormel-keys) | Implemented | REC-ADR-001; CI pipeline |
| A.5.9 | Inventory of information and other associated assets | Yes | Asset inventory and data inventory maintained and approved | Implemented | REC-GOV-006, REC-GOV-007 |
| A.5.10 | Acceptable use of information and other associated assets | Yes | Policy commitments in REC-POL-001 §4; no employees so self-applied by founder. Expand when team joins. | Implemented | REC-POL-001 |
| A.5.11 | Return of assets | N/A — justified | No employees or contractors; all assets held by founder. Procedure to be documented before first team member onboarded. | N/A — justified | — |
| A.5.12 | Classification of information | Yes | Three-tier scheme: confidential / internal / public. Applied in data-inventory.yaml and all governance doc front-matter. | Implemented | REC-GOV-007; governance front-matter |
| A.5.13 | Labelling of information | Partial | Classification reflected in YAML front-matter of all governance records. Production data and application objects not yet systematically labelled. Planned for Phase 5. | Partial | REC-GOV-007 front-matter |
| A.5.14 | Information transfer | Partial | TLS enforced for all data in transit. DPAs in place for sub-processors. UK→US transfer safeguards partially confirmed; Google Workspace and Zuplo DPAs outstanding (RISK-003); allotmentology.tech enquiry notifications (PROC-008) also route to Google Workspace. | Partial | REC-GOV-005; RISK-003 |
| A.5.15 | Access control | Yes | Access control policy approved | Implemented | REC-POL-002 |
| A.5.16 | Identity management | Yes | BetterAuth (self-hosted on AST-003); named accounts only; no shared logins; allotmentology.tech runs a self-contained BetterAuth instance (AST-017). Coolify dashboard (coolify.allotmentology.tech) is accessed via Traefik forwardAuth gate backed by the portal BetterAuth session — a controlled forward-auth gate, not a federated IdP. | Implemented | REC-POL-002; AST-003; AST-017 |
| A.5.17 | Authentication information | Partial | MFA required per REC-POL-002 §3; enablement in progress across all systems (RISK-008); remediation task scheduled. allotmentology.tech portal & Migadu MFA on (positive); RISK-008 still open for Priority-1 systems. | Partial | REC-POL-002 §3; RISK-008 |
| A.5.18 | Access rights | Yes | Least-privilege principle; quarterly access review; access rights reviewed and documented | Implemented | REC-POL-002 §5–6; evidence/access-reviews/ |
| A.5.19 | Information security in supplier relationships | Yes | Supplier / sub-processor register maintained; DPA status tracked per supplier | Implemented | REC-GOV-005 |
| A.5.20 | Addressing IS within supplier agreements | Partial | DPAs accepted (standard terms) for most suppliers; two require explicit in-portal acceptance (Hetzner AVV, Google Workspace DPA) — outstanding action items A1 and A2; Migadu DPA & get.tech registrant terms also pending. | Partial | REC-GOV-005; RISK-003 |
| A.5.21 | Managing IS in the ICT supply chain | Partial | Open-source dependencies tracked via Renovate; no formal SBOM. Proportionate at current stage; review when product reaches enterprise customers. | Partial | renovate.json |
| A.5.22 | Monitoring, review and change management of supplier services | Partial | Annual supplier review in governance cadence; no real-time monitoring of supplier security posture. Proportionate at solo-founder stage. | Partial | REC-GOV-000 cadence; isms-annual-management-review task |
| A.5.23 | Information security for use of cloud services | Yes | Cloud services documented in REC-GOV-005 with DPA status, data location, and sovereignty flag; sovereignty policy in REC-POL-001 §4; get.tech and Migadu added to REC-GOV-005 | Implemented | REC-GOV-005; REC-POL-001 |
| A.5.24 | IS incident management planning and preparation | Partial | incident-capture.md playbook skeleton exists; not yet complete. Accepted risk at pre-customer stage; must be complete before first paying customer (RISK-006). | Partial | playbooks/incident-capture.md; RISK-006 |
| A.5.25 | Assessment and decision on IS events | Partial | Sentry error monitoring + PostHog anomaly detection in place; formal event assessment process not yet documented. Tied to RISK-006. | Partial | Sentry; PostHog EU; RISK-006 |
| A.5.26 | Response to information security incidents | Partial | Playbook skeleton in place; full response procedure not yet documented. RISK-006. | Partial | playbooks/incident-capture.md; RISK-006 |
| A.5.27 | Learning from information security incidents | Planned | No incidents to date; retrospective process to be established as part of incident response playbook. | Planned | RISK-006 |
| A.5.28 | Collection of evidence | Partial | Audit events table (DAT-010, 12 months online / 6 years archived); governance records in Forgejo with long retention. Formal evidence collection procedure not yet documented. | Partial | DAT-010; REC-GOV-006 retention |
| A.5.29 | Information security during disruption | Partial | Hetzner automated backups in place; GitHub mirror provides code redundancy. Formal BCP not yet documented. RISK-001. | Partial | RISK-001; AST-003 Hetzner backups |
| A.5.30 | ICT readiness for business continuity | Partial | Same rationale as A.5.29. DR runbook to be documented in restormel-ops. Target RTO < 4 hours. | Partial | RISK-001 |
| A.5.31 | Legal, statutory, regulatory and contractual requirements | Yes | UK GDPR compliance: RoPA (REC-GOV-003), DPAs (REC-GOV-005), privacy notices (restormel.dev/keys/privacy + allotmentology.tech/privacy v1.1, 2026-06-19), data-inventory (REC-GOV-007). ICO registration: ZC092549. Companies Act: statutory records (FreeAgent/Mettle, 7-year retention). RISK-011 closed. | Implemented | REC-GOV-003; REC-GOV-007; REC-GOV-005; https://allotmentology.tech/privacy |
| A.5.32 | Intellectual property rights | Yes | Product code in private Forgejo repo; LICENSE file present; third-party OSS managed via pnpm with Renovate tracking | Implemented | LICENSE; renovate.json; restormel-keys repo |
| A.5.33 | Protection of records | Yes | Governance records in Forgejo with SCHEMA.md-defined retention periods; 6-year minimum for governance documents; audit events 6-year archive (DAT-010) | Implemented | records/SCHEMA.md; REC-GOV-007 retention |
| A.5.34 | Privacy and protection of PII | Yes | Restormel PII protections in place (RoPA, data-inventory, published notice, DPAs). allotmentology.tech privacy notice v1.1 published 2026-06-19 at https://allotmentology.tech/privacy; enquiry form live; PROC-008 and DAT-012 updated to live state; RISK-011 closed. | Implemented | REC-GOV-003; REC-GOV-007; restormel.dev/keys/privacy; https://allotmentology.tech/privacy (v1.1, 2026-06-19); RISK-011 |
| A.5.35 | Independent review of information security | Planned | No independent review yet; planned before ISO 27001 certification attempt. Proportionate at pre-certification stage. | Planned | — |
| A.5.36 | Compliance with policies, rules and standards | Yes | Quarterly access review; annual management review; CI enforces governance record schema; scheduled Cowork tasks enforce cadence | Implemented | REC-GOV-000; playbooks/; isms-annual-management-review task |
| A.5.37 | Documented operating procedures | Partial | Playbooks documented in restormel-ops (quarterly-access-review, policy-review, incident-capture, annual-management-review, governance-drafting). DR/recovery procedures not yet fully documented (RISK-001). | Partial | playbooks/; RISK-001 |

---

## A.6 People controls (8)

| Control | Title | Applicable | Justification / Notes | Status | Evidence |
|---|---|---|---|---|---|
| A.6.1 | Screening | N/A — justified | No employees or contractors. Sole founder. Procedure to be documented before first hire. | N/A — justified | — |
| A.6.2 | Terms and conditions of employment | N/A — justified | No employees. Sole founder. Review when first team member joins. | N/A — justified | — |
| A.6.3 | IS awareness, education and training | Yes | Sole founder is ISMS owner; continuous learning through ISMS implementation itself. No additional training programme at this stage; review when team grows. | Implemented | REC-POL-001; this SoA |
| A.6.4 | Disciplinary process | N/A — justified | No employees. Sole founder. | N/A — justified | — |
| A.6.5 | Responsibilities after termination or change of employment | N/A — justified | No employees. Asset return and access revocation procedures to be drafted before first hire. | N/A — justified | — |
| A.6.6 | Confidentiality or non-disclosure agreements | Planned | No employees or contractors currently engaged. NDA template to be prepared before engaging any contractor with access to source code or customer data. | Planned | — |
| A.6.7 | Remote working | Yes | Sole founder works remotely (home office). MacBook (AST-001) with FileVault AES-256; screen lock; .env gitignored; sensitive material not printed. Committed to in REC-POL-001. | Implemented | REC-POL-001; AST-001 |
| A.6.8 | Information security event reporting | Partial | No formal reporting channel needed (no employees). Founder reports to self; incident-capture.md playbook covers initial capture and ICO notification (Art 33 — ZC092549). RISK-006. | Partial | playbooks/incident-capture.md; RISK-006 |

---

## A.7 Physical controls (14)

| Control | Title | Applicable | Justification / Notes | Status | Evidence |
|---|---|---|---|---|---|
| A.7.1 | Physical security perimeters | N/A — justified | No company office or data centre. Compute hosted on Hetzner Helsinki — 2-server cluster — with encrypted backups to a Hetzner Storage Box in Falkenstein, DE (physical perimeters managed and certified by Hetzner). Home office is sole physical location — standard residential security applies. | N/A — justified | REC-GOV-005 (Hetzner); AST-003 |
| A.7.2 | Physical entry | N/A — justified | Same rationale as A.7.1. No company premises. Hetzner data centre physical access is Hetzner's responsibility under their DPA/AVV. | N/A — justified | REC-GOV-005 (Hetzner) |
| A.7.3 | Securing offices, rooms and facilities | N/A — justified | No company office. Home office: standard residential locks; no visitors granted system access. No dedicated server room. | N/A — justified | — |
| A.7.4 | Physical security monitoring | N/A — justified | No company office CCTV. Compute infrastructure on Hetzner (their responsibility). Proportionate for remote solo founder. | N/A — justified | — |
| A.7.5 | Protecting against physical and environmental threats | Partial | MacBook (AST-001) secured at home; FileVault mitigates theft risk. Environmental threats for compute: Hetzner's responsibility (multi-zone Helsinki data centre). | Partial | AST-001; REC-GOV-005 (Hetzner) |
| A.7.6 | Working in secure areas | N/A — justified | No designated secure areas. Home office is sole work location. | N/A — justified | — |
| A.7.7 | Clear desk and clear screen | Yes | Screen lock on MacBook (auto-lock on idle). No printing of sensitive information. Committed to in REC-POL-001. | Implemented | REC-POL-001 |
| A.7.8 | Equipment siting and protection | Partial | MacBook stored at home; no dedicated secure room. FileVault and screen lock as compensating controls. Acceptable risk at solo-founder stage. | Partial | AST-001 |
| A.7.9 | Security of assets off-premises | Yes | MacBook (AST-001) is the only portable asset. FileVault full-disk encryption; remote wipe capability. Policy in REC-POL-001. | Implemented | REC-POL-001; AST-001 |
| A.7.10 | Storage media | Partial | No removable media used for production data. Local MacBook SSD encrypted via FileVault. No removable media policy needed at this stage; review when team joins. | Partial | AST-001 |
| A.7.11 | Supporting utilities | N/A — justified | No company premises. Home office uses standard residential utilities. Compute on Hetzner (UPS, power, cooling — their responsibility). | N/A — justified | REC-GOV-005 (Hetzner) |
| A.7.12 | Cabling security | N/A — justified | No company data centre or server room. All compute is cloud-hosted. | N/A — justified | — |
| A.7.13 | Equipment maintenance | Partial | MacBook maintained via Apple OS/security updates (auto-updates enabled). Compute on Hetzner (hardware maintenance their responsibility). | Partial | AST-001; REC-GOV-005 (Hetzner) |
| A.7.14 | Secure disposal or re-use of equipment | Yes | FileVault ensures data is inaccessible on device disposal. Apple secure erase procedure to be followed when MacBook is replaced. No removable media to dispose of. | Implemented | REC-POL-001; AST-001 |

---

## A.8 Technological controls (34)

| Control | Title | Applicable | Justification / Notes | Status | Evidence |
|---|---|---|---|---|---|
| A.8.1 | User endpoint devices | Yes | MacBook (AST-001): FileVault AES-256; screen lock; auto-updates; no production credentials in plaintext; .env gitignored. REC-POL-001. | Implemented | REC-POL-001; AST-001 |
| A.8.2 | Privileged access rights | Yes | Admin access restricted to founder. Production credentials held in Coolify environment variables (not in code). Least privilege applied to all API keys and service accounts. | Implemented | REC-POL-002; AST-003 |
| A.8.3 | Information access restriction | Yes | BetterAuth (self-hosted) for product authentication; API keys scoped per project (rk_* gateway keys); no guest/anonymous access to sensitive functions; the allotmentology.tech portal is founder-only (AST-017). | Implemented | REC-POL-002; AST-004; AST-017 |
| A.8.4 | Access to source code | Yes | Private Forgejo repos; founder-only write access; GitHub is read/push-only mirror; branch protection on main enforced by CI; no external contributor access; allotmentology-tech repo (AST-015) is Forgejo + push-only GitHub mirror, founder-only. | Implemented | AST-002 (Forgejo); AST-015; CI branch protection |
| A.8.5 | Secure authentication | Partial | BetterAuth (self-hosted) in production; MFA requirement defined in REC-POL-002 §3; enablement in progress across all systems (RISK-008). Remediation task scheduled. allotmentology.tech portal & Migadu MFA on (positive); RISK-008 still open for Priority-1 systems. | Partial | REC-POL-002 §3; RISK-008 |
| A.8.6 | Capacity management | Partial | PostHog EU tracks usage metrics; no formal capacity planning or auto-scaling configured on single Coolify instance. Proportionate at pre-scale stage; review before launch. | Partial | RISK-001; PostHog EU |
| A.8.7 | Protection against malware | Partial | macOS Gatekeeper + XProtect on MacBook. Server-side: OS defaults on Coolify. npm/pnpm dependency scanning via Renovate. No EDR at this stage. Proportionate. | Partial | Renovate; AST-001 macOS security |
| A.8.8 | Management of technical vulnerabilities | Partial | Renovate automates dependency update PRs; Forgejo CI includes build-time security checks; GitHub security advisories mirrored. No formal VDP yet; planned before enterprise customers. | Partial | renovate.json; CI pipeline |
| A.8.9 | Configuration management | Yes | All infrastructure configuration repo-anchored in Forgejo; no manual production changes; Coolify manages server config; governance records enforce approved-by/on fields. | Implemented | REC-ADR-001; Forgejo CI; Coolify |
| A.8.10 | Information deletion | Partial | Retention periods defined in REC-GOV-007; Neon decommission scheduled (~2026-06-30); deletion procedures not yet automated. Formal deletion runbook to be documented. | Partial | REC-GOV-007; RISK-001 |
| A.8.11 | Data masking | Partial | DAT-002 pseudonymised by design; PII minimisation applied across data-inventory. No formal data masking tooling at this stage. | Partial | REC-GOV-007; DAT-002 |
| A.8.12 | Data leakage prevention | Partial | .env gitignored (confirmed); Forgejo secret scanner on CI; pre-commit hooks. No dedicated DLP tooling. RISK-002 tracks credential exposure as a monitored gap. | Partial | RISK-002; CI secret scan |
| A.8.13 | Information backup | Yes | Hetzner automated backups for self-hosted Postgres (AST-003); Forgejo repo mirrored to GitHub (AST-002); governance records in Forgejo with 6-year retention. Recovery objective in RISK-001; encrypted Hetzner Storage Box, Falkenstein (AST-012) is the offsite backup target. | Implemented | AST-003 Hetzner backups; AST-012; RISK-001; AST-002 |
| A.8.14 | Redundancy of information processing facilities | Partial | Single Coolify instance on Hetzner (no hot standby or multi-AZ). GitHub mirror provides code redundancy. Hetzner Helsinki is a tier-3 facility with redundant power. Formal HA not yet configured. | Partial | RISK-001; AST-003 |
| A.8.15 | Logging | Yes | DAT-010 audit_events table (12 months online / 6 years archived); Sentry error logging; PostHog EU event logging. Logging scope and retention defined in REC-GOV-007. | Implemented | DAT-010; Sentry; PostHog EU |
| A.8.16 | Monitoring activities | Partial | Sentry for error monitoring; PostHog EU for usage analytics; no SIEM or formal security event monitoring. Proportionate at solo-founder stage. | Partial | Sentry; PostHog EU |
| A.8.17 | Clock synchronization | Yes | NTP enforced by Hetzner infrastructure; Coolify host clock NTP-synchronized; all governance record timestamps in ISO 8601 UTC. | Implemented | Hetzner NTP; governance front-matter |
| A.8.18 | Use of privileged utility programs | Yes | No privileged utility programs used in production except via Coolify dashboard; access logged; REC-POL-002. | Implemented | REC-POL-002; Coolify |
| A.8.19 | Installation of software on operational systems | Yes | Software installed via Coolify CI/CD pipeline only; no manual installs on production server; dependency changes via Renovate PRs with CI gate before merge. | Implemented | CI pipeline; renovate.json; Coolify |
| A.8.20 | Networks security | Partial | Hetzner network isolation; Coolify managed networking; TLS enforced on all public endpoints. No internal network segmentation yet (single instance). Review for multi-service architecture. | Partial | AST-003; TLS config |
| A.8.21 | Security of network services | Partial | Zuplo API gateway for public Cloud API; TLS on all service endpoints. Zuplo is a US service — UK→US transfer documented in REC-GOV-005 (RISK-003). | Partial | REC-GOV-005 (Zuplo); RISK-003 |
| A.8.22 | Segregation of networks | Partial | No formal network segmentation. Single Coolify instance; no DMZ. Proportionate at this stage; review before enterprise customers. | Partial | RISK-001 |
| A.8.23 | Web filtering | N/A — justified | No employees. Sole founder. No enterprise web proxy required at this stage. Review when team grows. | N/A — justified | — |
| A.8.24 | Use of cryptography | Yes | TLS 1.2+ for all data in transit; FileVault AES-256 at rest (MacBook); Hetzner encrypted storage; BYOK model — provider credentials stored as ciphertext only; key management per REC-POL-001 §4; encrypted backups at Falkenstein (AST-012). | Implemented | REC-POL-001 §4; AST-001; AST-012; BYOK architecture |
| A.8.25 | Secure development lifecycle | Yes | Forgejo CI/CD with branch protection; PRs required for all merges to main; Renovate for dependency management; evidence-bound quality gates in CI; REC-ADR-001. | Implemented | REC-ADR-001; CI pipeline; renovate.json |
| A.8.26 | Application security requirements | Partial | Security requirements addressed in design (BYOK, least privilege, pseudonymisation, data minimisation). No formal threat model documented yet. Planned before ISO 27001 certification attempt. | Partial | BYOK architecture; REC-POL-002 |
| A.8.27 | Secure system architecture and engineering principles | Yes | Least privilege (BYOK, scoped rk_* keys); defence in depth (BetterAuth + app-level ACL + Zuplo gateway); data minimisation; pseudonymisation in DAT-002; ISMS separated from production credentials. | Implemented | REC-ADR-001; REC-POL-002; BYOK architecture |
| A.8.28 | Secure coding | Partial | TypeScript strict mode; pnpm lockfile for dependency integrity; Renovate security patch PRs; OWASP Top 10 awareness applied by founder. No formal SAST tool yet. Plan: add SAST before enterprise launch. | Partial | TypeScript config; renovate.json |
| A.8.29 | Security testing in development and acceptance | Partial | Forgejo CI runs quality and evidence-bound efficacy gates; no formal penetration test yet. Planned before first enterprise customer. | Partial | CI pipeline; evidence/posture/ |
| A.8.30 | Outsourced development | N/A — justified | No outsourced development. Sole founder writes all code. Review when contractors are engaged. | N/A — justified | — |
| A.8.31 | Separation of dev, test and production environments | Partial | Forgejo CI has distinct build / test / deploy stages; no separate staging infrastructure (planned). Production Coolify instance also used for staging; the allotmentology.tech app also runs on the shared 2-server Helsinki cluster, reinforcing the gap. RISK-001. | Partial | CI pipeline; RISK-001 |
| A.8.32 | Change management | Yes | All changes via Forgejo PRs with CI gates; unapproved merges to main blocked; cowork-relay governs governance record changes; governance docs require approved-by/approved-on fields. | Implemented | CI branch protection; cowork-relay; governance front-matter |
| A.8.33 | Test information | Yes | No production data used in tests; test datasets are synthetic or generated fixtures. No PII in test datasets (confirmed by founder). | Implemented | CI test suite; test fixtures |
| A.8.34 | Protection of IS during audit testing | N/A — justified | No formal audit testing conducted yet. When audit testing is conducted (pre-certification), a separate test environment will be used (per A.8.31). Review before ISO 27001 certification audit. | N/A — justified | — |

---

## Control summary

| Theme | Total | Implemented | Partial | Planned | N/A — justified |
|---|---|---|---|---|---|
| A.5 Organisational | 37 | 14 | 16 | 3 | 4 |
| A.6 People | 8 | 3 | 1 | 1 | 3 |
| A.7 Physical | 14 | 4 | 4 | 0 | 6 |
| A.8 Technological | 34 | 14 | 14 | 0 | 6 |
| **Total** | **93** | **35** | **35** | **4** | **19** |

> Key gaps driving the Partial count: MFA remediation (RISK-008, urgent), incident response
> playbook (RISK-006), UK→US transfer DPAs (RISK-003), staging environment (RISK-001). These
> are all tracked in the risk register and will be closed before ISO 27001 certification.

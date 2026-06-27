---
id: REC-POL-003
title: Cyber Security Policy (Cyber Essentials controls)
class: governance
owner: founder
status: approved
classification: internal
control-tier: 2
created: 2026-06-15
last-reviewed: 2026-06-27
review-interval: P12M
retention: P6Y-after-superseded
approved-by: founder
approved-on: 2026-06-27
related: [REC-POL-001, REC-POL-002, REC-GOV-004, REC-GOV-021]
---

# Cyber Security Policy

**Allotment Technology Ltd** · Version 2026-06-15 · Effective `[on approval]`

> **DRAFT.** Sets the commitments behind Cyber Essentials certification. Sibling to the Information
> Security Policy (REC-POL-001) and Access Control Policy (REC-POL-002); the live gap analysis is
> the CE control mapping (REC-GOV-021). We are *preparing for* Cyber Essentials — not certified.

## 1. Purpose and scope

Establishes the technical security commitments required to achieve and continuously maintain
**Cyber Essentials** (and, subsequently, **Cyber Essentials Plus**) under IASME *Requirements for
IT Infrastructure v3.3* (Danzell question set). It translates the five CE controls into standing
commitments and patching/access SLAs.

Scope is the Cyber Essentials scope defined in REC-GOV-021 §1.1: the founder MacBook (AST-006), the
Hetzner host and everything it self-hosts (AST-003), and all cloud services in the asset inventory
(REC-GOV-006) and supplier register (REC-GOV-005). Cloud services and end-user devices cannot be
excluded.

## 2. The five controls — standing commitments

### 2.1 Firewalls & internet gateways
Every in-scope device runs a correctly configured firewall. The **macOS application firewall is
enabled** on AST-006 (the assessed boundary for the home-based worker) and a **host firewall (UFW)
plus the Hetzner Cloud Firewall** protect the server with **default-deny inbound** — only the
ports with a documented business need are open (currently 443 for the app; SSH restricted to an
allow-list, key-only). Inbound rules are documented with a business case, reviewed at least every
12 months, and removed when no longer needed. Any internet-facing administrative interface is
protected by MFA or an IP allow-list. Default firewall/device administrative passwords are changed
to ≥12 characters (or MFA).

### 2.2 Secure configuration
Devices and services are hardened from default: unnecessary software, services, and user accounts
are removed or disabled; no default or guessable passwords remain; auto-execution of downloaded
files is disabled; and devices auto-lock with a credential before granting access. Hardened
baselines for the MacBook and the host/Coolify/Forgejo are documented as config-as-code in
`docs/governance/security-baseline.md`. Internet-facing services that provide access to non-public
data (the Restormel app, Forgejo, Coolify) authenticate users and protect authentication against
brute force (throttling or lockout after no more than 10 attempts).

### 2.3 User access control
Access follows least privilege with individual, uniquely credentialed accounts (no sharing), per
the Access Control Policy (REC-POL-002). **MFA is enabled on every cloud service for every
administrator and user where it is available** — this is a Cyber Essentials pass/fail requirement
(Danzell A7.16/A7.17). Passwordless / passkeys are preferred where supported. Administrative
activity uses separate accounts that are not used for web browsing or email; the list of
administrators is tracked and reviewed at least quarterly via the access-review playbook.

### 2.4 Malware protection
Every in-scope device has an active malware-protection mechanism. The MacBook uses the
application-allow-listing route (macOS Gatekeeper + notarised/App Store applications, with a
maintained list of approved applications). The Linux host restricts software to trusted
repositories installed via the CI/CD pipeline — no arbitrary downloads. Browser/OS protections
warn against known-malicious sites. Application dependencies are continuously scanned (Renovate).

### 2.5 Security update management — patching SLA
All in-scope software is licensed and vendor-supported; unsupported software is removed or moved to
a firewall/VLAN-segregated out-of-scope network. **All high-risk or critical updates — those the
vendor marks critical/high, or with a CVSSv3 base score ≥7 — are applied within 14 days of
release** (Danzell A6.4/A6.5; a pass/fail requirement). Automatic updates are enabled wherever
possible: macOS OS and apps, the host's `unattended-upgrades`, and Renovate-driven dependency PRs
gated by CI. End-of-life dates for operating systems and key runtimes are tracked.

## 3. Continuous assurance

CE controls are kept continuous, not point-in-time, through the enforcement hooks in REC-GOV-021
§10: CI config/firewall-drift checks (CE-E1), the access-review + MFA-freshness check in the Phase
6 evidence agent (CE-E2), and the update-management gate that fails CI on any dependency with CVSS
≥7 older than 14 days (CE-E3). Evidence accumulates in `evidence/`.

## 4. Roles and responsibilities

The founder (Adam Boon, sole director) is accountable for all CE controls while the company is
solo-led, and is the person responsible for managing in-scope IT systems (Danzell A2.10).
Real-world controls (enabling MFA, device settings, the assessment booking) are performed by the
founder; repository, host, and CI controls are implemented via Claude Code through the relay/PR/CI
flow. This section is expanded when the first team member joins.

## 5. Certification approach

Readiness first, then certify. The sequence is **Cyber Essentials (self-assessment via the Danzell
question set) first, then Cyber Essentials Plus** (independent technical audit). Timing is tied to
closing the gaps in REC-GOV-021 — the MFA and 14-day-patching auto-fail items first — not to a
fixed calendar date. The public trust page states "preparing for Cyber Essentials" and is not
upgraded until certification is actually achieved.

## 6. Exceptions

Per REC-POL-001 §5: written founder approval plus a risk-register entry with a review date no more
than 12 months out. Undocumented exceptions are not permitted.

## 7. Review

Annual (P12M), next via `isms-annual-management-review` (15 December 2026), and event-triggered on
any change to in-scope systems, MFA, firewall, or patching posture. Control statuses are reconciled
to the SoA (REC-GOV-004) and the CE control mapping (REC-GOV-021) at each review.

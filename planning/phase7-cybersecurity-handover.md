---
id: REC-PLAN-006
title: Phase 7 — cyber security governance (CE+) kickoff brief
class: planning
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P12M
approved-by: founder
approved-on: 2026-06-15
retention: review-only
related: [REC-PLAN-002, REC-POL-001, REC-POL-002, REC-GOV-006]
---

# Phase 7 — cyber security governance (CE+) kickoff brief

The canonical kickoff for Phase 7. Start a **new Cowork chat in this project** and use the prompt
below (recommended model/thinking at the end).

---

## Handover prompt

```
You are planning and driving PHASE 7 of the Restormel records/governance programme:
CYBER SECURITY GOVERNANCE for Cyber Essentials Plus (CE+) — achieving it, and continuously
meeting it. Company: Allotment Technology Ltd (no. 16925574), a solo-founder UK LTD building
Restormel (the verified-context layer for AI products), on the side. Proportionate to that
stage — lean, real, enforced; not a 200-person compliance bureaucracy.

HOW THIS PROGRAMME WORKS (don't re-litigate; build on it)
- Canonical system of record = the restormel-keys repo on self-hosted Forgejo
  (git.allotmentology.tech). GitHub is a push-only mirror — never write to it.
- Records architecture is live (Phases 0–6 on main): a front-matter convention
  (records/SCHEMA.md), a generated register, governance/ + evidence/ records, warn-only CI
  (records-governance), a Drive⇄Forgejo mirror, and a scheduled Phase 6 evidence/posture agent.
- Three surfaces: this Cowork project (operate/draft/ship), the Claude chat project (think),
  Claude Code in Cursor (build the repo). Cowork can't push to Forgejo or run git in the repo
  (sandbox is network-blocked + no-delete); it stages bundles in cowork-outbox/ and a Mac relay
  turns them into branch→PR→CI→merge. Bundle format: cowork-relay/BUNDLE-FORMAT.md (write .ready
  LAST). Heavy code/host work hands off to Claude Code via a brief.
- The "self-maintaining records" maintenance norm applies (records/SCHEMA.md): when you change a
  managed fact, stage the matching register update in the same turn. Never fabricate
  governance/legal content; never overclaim compliance ("working towards", not "certified").

READ FIRST (existing inputs)
- The "CE 2026 Danzell Question Set" (in this project's knowledge) — the CE assessment questions.
- docs/governance/security-baseline.md; governance/access-control-policy.md (REC-POL-002),
  information-security-policy.md (REC-POL-001), risk-register.yaml, suppliers.yaml,
  asset-inventory.yaml, data-inventory.yaml, soa.md. Note especially:
  AST-003 Coolify/Forgejo host = Hetzner, Helsinki (EU); AST-006 founder MacBook (FileVault on);
  AST-007 = distributed-secrets control gap (a CE+ priority); the quarterly access-review playbook.

PHASE 7 SCOPE — map the five CE controls (firewalls; secure configuration; user access control;
malware protection; security update management) across THREE domains, then make them ENFORCED and
CONTINUOUS (config-as-code + automated checks + evidence), not point-in-time:
1. Developer surfaces — Claude Code, Cursor, the founder Mac: secrets handling (close AST-007),
   token/credential scope + storage (the relay/Forgejo tokens, .env, keychain), MCP connector
   permissions, code-execution boundaries, prompt-injection exposure, device hardening, updates.
2. Operational configuration — Hetzner host, Coolify, Forgejo, CI/CD, the SvelteKit app:
   firewalls/network, secure config + hardening, least-privilege access + MFA, patching SLAs.
3. Admin & accountancy tooling — FreeAgent, Mettle, Google Workspace/Gmail, the company Google
   Drive: account access control + MFA, device security, the receipts workflow.

DELIVERABLES (as records, via the relay)
- A CE+ control-mapping + gap analysis: each of the 5 controls × each in-scope system → current
  state → gap → remediation. Reconcile to the Danzell question set.
- A remediation plan (proportionate, sequenced); the secrets-estate unification (AST-007) is the
  headline item.
- ENFORCEMENT: extend the Phase 6 evidence agent / CI to check CE-relevant controls (e.g. update
  management via the existing dependency scanning/Renovate; access-review cadence; config drift),
  so "continue to meet it" is automated and evidenced.
- Hardening briefs handed to Claude Code (host/CI/app) and to the founder for the manual,
  real-world controls (MFA enrolment, device settings, the CE/CE+ assessment booking with IASME).
- Update governance: a Cyber Security / CE+ policy + the SoA control statuses; keep the public
  trust page (legal/trust-and-compliance.md) accurate — "preparing for Cyber Essentials".

GUARDRAILS: Forgejo origin only; relay/PR/CI for every change; don't fabricate; don't overclaim;
sovereignty (UK/EU, BYOK); real-world controls (MFA, scans, assessment) are the founder's to
perform — you prepare, brief, and evidence them. Start by reading the inputs above, then propose
the Phase 7 plan + the CE+ control-mapping structure before drafting records.
```

---

## How to run it
- **Surface:** a new **Cowork** chat in this project (needs repo reads + relay output + the
  dev-surface hardening) — not the planning chat project.
- **Model:** **Claude Opus 4.8** for the planning + CE+ control-mapping (complex, security-
  sensitive judgement). Switch to **Sonnet 4.6** for routine bundle-drafting/execution once the
  plan is set, to save time/cost.
- **Thinking:** **high / extended** for the gap analysis and control-mapping; standard for routine
  record drafting.

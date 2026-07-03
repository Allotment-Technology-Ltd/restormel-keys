---
name: restormel-isms-governance
description: >-
  Restormel / Allotment Technology Ltd ISMS operating conventions AND record-filing hub. Use whenever
  work touches governance, policy, records, evidence, compliance, audit, ISO 27001 or ISO 42001,
  Cyber Essentials, GDPR / ROPA / DPIA, risk, asset or sub-processor changes, access reviews, or
  incidents — including "log this incident", "is this compliant", "update the policy". Routes filing
  to the right template (REC-TPL-001..004) and governs repo-anchored records in restormel-keys.
  Merged from restormel-isms + restormel-isms-governance.
---

# Restormel ISMS governance (conventions + record filing)

The ISMS is **repo-anchored**: canonical system of record is **`restormel-keys`** on Forgejo
(`git.allotmentology.tech`). **Forgejo is the governance plane; GitHub is push-only mirror.**

Defer to canonical repo docs — do not invent governance:

- `records/SCHEMA.md` (`REC-GOV-001`) — metadata convention, control tiers, register rules
- `docs/decisions/records-architecture.md` (`REC-ADR-001`) — architecture rationale
- `governance/` (policies) and `evidence/` (proof)
- `restormel-ops/OPERATING-MANUAL.md` and `playbooks/` — recurring human work

---

## Part 1 — Operating conventions

### Core distinctions

- **Documents vs records.** A *document* is current guidance; a *record* is dated proof something happened.
- **Four control tiers.** See `records/SCHEMA.md`; don't guess tier.
- **Certification framing:** Cyber Essentials / ISO 27001 = gates; ISO 42001 = differentiator. Mark status `[PLACEHOLDER — founder/counsel]` until real.

### Standing rules

1. **Never invent governance or legal content.** Use `[PLACEHOLDER — founder/counsel]` and flag.
2. **Self-maintaining records.** When a managed fact changes (asset, sub-processor, data flow, decision), stage the matching register update **in the same change**.

### Sovereignty guardrails

- Cowork / Claude chat are **not** the audit trail — no regulated data there.
- Log US-SaaS sub-processors; keep verification path sovereign.
- Canonical history = repo + CI.

### Act by surface

- **Claude chat:** draft skeleton + handoff to Cowork / Claude Code.
- **Cowork:** bundle → relay → PR on `restormel-keys`; include register updates in same bundle.
- **Claude Code / Cursor:** write under `records/`/`governance/`/`evidence/`; open PR to Forgejo `main`.

---

## Part 2 — Record filing router

ISMS scope: **Restormel product + supporting infrastructure.** Controller: **Allotment Technology Ltd** (16925574).

### MANDATORY: after any incident, file a record

After remediation, file **REC-TPL-004** → `evidence/incidents/<date>-<slug>.md`. Example: **REC-INC-001**.

| Situation | Template | File to | id prefix |
|-----------|----------|---------|-----------|
| Incident / outage / alert remediated | `evidence/templates/incident.md` | `evidence/incidents/<date>-<slug>.md` | REC-INC-* |
| High-risk processing | `evidence/templates/dpia.md` | `evidence/dpia/<name>.md` | REC-EVID-* |
| Quarterly access review | `evidence/templates/access-review.md` | `evidence/access-reviews/<YYYY-QN>-access-review.md` | REC-EVID-* |
| ISMS posture / audit | `evidence/templates/posture-report.md` | `evidence/posture/<date>-posture.md` | REC-EVID-* |
| Small one-line event | — | append `evidence/ledger.jsonl` | — |

### Event-triggered governance updates

| Event | Update |
|-------|--------|
| Sub-processor / connector change | `governance/suppliers.yaml` + `ropa.yaml` |
| New data category / processing | `governance/data-inventory.yaml` + `ropa.yaml` |
| Infra change | `governance/asset-inventory.yaml` + `suppliers.yaml` |
| Security incident | `governance/risk-register.yaml` + incident record |
| Access change | `governance/access-control-policy.md` + `asset-inventory.yaml` |
| CE control change | `governance/ce-control-mapping.md` + policies + `soa.md` |

### Filing process (append-only)

1. Copy matching template; save to correct `evidence/<subdir>/`.
2. Set Tier-3 frontmatter (`class: evidence`, `control-tier: 3`, owner, approved-by, approved-on, retention).
3. Fill while facts are fresh; ship via PR — never silently edit approved records.
4. Register is **generated** by `scripts/records/register.mjs` — don't hand-edit ids.

### Validators

Run `scripts/records/frontmatter-validate.mjs` after filing. CI: `.forgejo/workflows/records-governance.yml`.

---

## Related skills

- `restormel-infra-alert-response` — alert triage; closes by routing here for incident record
- `restormel-vuln-triage` — scanner/CVE decisions
- `restormel-product-ops` — when governance work also needs a backlog item

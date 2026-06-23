---
id: REC-EVID-001
title: "DPIA — Neon quick-start managed-DB tier (per-workspace, EU-region, non-sovereign)"
class: evidence
owner: founder
status: draft
classification: confidential
control-tier: 3
created: 2026-06-23
last-reviewed: 2026-06-23
review-interval: P12M
retention: P6Y-after-superseded
approved-by: "[PLACEHOLDER — confirm] founder"
approved-on: "[PLACEHOLDER — confirm]"
related: [REC-TPL-003, REC-ADR-009, REC-ADR-008, REC-GOV-003, REC-GOV-005]
---

# DPIA — Neon quick-start managed-DB tier

> Filed from REC-TPL-003 (DPIA template). **GO-LIVE GATE:** no customer data may land on Neon
> until this DPIA + RoPA PROC-010 + the suppliers.yaml sub-processor entry are filed AND
> founder-approved (see go-live conditions in §5). Append-only once approved. References
> REC-ADR-009 (PR #285) and the Step-1 design (Section B, `scratchpad/tenant-db-provisioning-design.md`).

## 1. Processing described

Per-workspace managed Postgres on **Neon** for **opt-in, non-sovereign quick-start** workspaces
(RoPA **PROC-010**). Data processed: Connect ingest content, verification results, provenance
traces, and workspace/project metadata (workspace product data), plus per-workspace DB connection
credentials held as ciphertext in the Restormel vault. Data subjects: registered users and their
end-users. Each workspace = **one isolated Neon project** in AWS **eu-central-1 (Frankfurt)**, with
the region **pinned at project creation (immutable)**. The **default alternative** is the EU/UK
self-hosted **sovereign CNPG** tier (REC-ADR-008 / REC-ADR-009); Neon is a clearly-labelled
non-sovereign quick-start option, never the default.

## 2. Necessity & proportionality

The tier provides a ~1-second, zero-ops quick-start database without standing up sovereign
capacity per trial workspace, funded by the Neon open-source-programme credit (~USD 5000/yr). It is
**opt-in and clearly labelled non-sovereign**; the **sovereign default** plus a **one-click
migrate-to-sovereign** path always exist. Data is minimised (only workspace product data the user
generates) and bounded by per-project quotas. Proportionate: no user is forced onto Neon, and the
sovereign path is always available, so the additional transfer risk is incurred only by users who
knowingly choose convenience over sovereignty.

## 3. Risks to individuals

- **R1 — International transfer / US government access.** Neon Inc. is US-controlled, so US
  government access (Schrems-II / FISA 702 / CLOUD Act) is in scope **despite** EU-region data
  residency.
- **R2 — Tenant-isolation failure** (cross-workspace data exposure).
- **R3 — Credential exposure** (per-workspace connection string leakage).
- **R4 — Incomplete erasure** (Neon project not deleted on workspace closure / Art-17 request).
- **R5 — Lock-in / OSS-credit exhaustion** forcing an unmanaged migration or service interruption.

## 4. Mitigations

- **R1:** EU-region pin (immutable at creation) **+ Neon DPA + SCCs/IDTA** ([PLACEHOLDER — confirm]
  before first customer project) + clear non-sovereign labelling + sovereign default and one-click
  fallback + a Transfer Risk Assessment (TRA) to accompany. EU residency reduces but does **not
  eliminate** the government-access risk.
- **R2:** one Neon project per workspace (physical isolation), no shared credentials.
- **R3:** connection strings encrypted at rest (PROC-001 `credential-crypto` AES-GCM control),
  never logged or printed; rotation via the Neon API.
- **R4:** `DELETE /projects/{id}` wired to delete / day-0 reset / Art-17 erasure — whole-project,
  atomic, evidence-logged.
- **R5:** usage metering + budget guard + BYO-key / user-pays / migrate-to-sovereign fallbacks (no
  silent suspension).

> **Backup-residue caveat (FLAG):** physical erasure on the sovereign tier (CNPG Barman, fsn1)
> retains WAL/base for up to 30 days; Neon project deletion erases the project but
> backup-residue/retention behaviour for the Neon-managed tier must be confirmed against the Neon
> contract and stated to data subjects. [PLACEHOLDER — confirm] founder/counsel.

## 5. Residual risk & decision

**Residual risk: [MEDIUM — pending founder/counsel sign-off].** EU residency + SCCs/IDTA reduce but
do **not eliminate** the Schrems-II government-access risk inherent to a US-controlled processor;
accepted **only** because the tier is opt-in, clearly labelled non-sovereign, and shadowed by a
sovereign default with one-click migration.

**Reviewer:** [PLACEHOLDER — confirm] founder  **Date:** [PLACEHOLDER — confirm]

**Go-live conditions (ALL required before the first customer project on Neon):**
1. Neon DPA + SCCs/IDTA confirmed/accepted (suppliers.yaml `dpa:` field).
2. Neon OSS-programme terms + attribution/usage obligations confirmed.
3. Public privacy notice updated to list Neon (quick-start tier) as a sub-processor and describe
   the EU-region / non-sovereign nature (§3 of https://restormel.dev/keys/privacy).
4. Sub-processor change-notification hook fired (Phase 5, `notify-subprocessor-change.mjs` on the
   suppliers.yaml change to main).
5. [PLACEHOLDER — confirm with counsel] international transfer on a US-managed DB is adequately
   covered by the chosen transfer instrument (TRA documented).
6. `restormel-high-risk-security` review passed before ANY provisioning / direct-credential /
   Postgres-route build (separate gate, REC-ADR-009 §5).

## Cross-record actions on filing (founder / ISMS owner)

On approval, also reconcile: `data-inventory.yaml` (new DAT entry with SCC/IDTA language),
`asset-inventory.yaml` (new ACTIVE Neon asset, distinct from the decommissioning AST-004),
`risk-register.yaml` (new Schrems-II transfer risk — do NOT conflate with RISK-004), and
`ce-control-mapping.md` / `soa.md` / `access-control-policy.md` (add the new active Neon
relationship). The legacy Neon backup decommission (RISK-004, by 2026-06-30) must still complete on
schedule — this is a separate, NEW relationship.

---
id: REC-EVID-003
title: "DR restore drill — per-jewel automated drill GREEN; §4 whole-sequence cold-start NOT yet run (2026-06-26)"
class: evidence
owner: adam
status: approved
classification: internal
control-tier: 3
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P12M
approved-by: adam
approved-on: 2026-06-27
retention: P6Y
---

# DR restore drill — evidence record (2026-06-26)

> Filed 2026-06-27 to close the evidence-trail gap a review surfaced: a DR drill ran 2026-06-26 and
> was the basis for deleting standby infra (.150 + BX11), but **no ISMS record had been filed**.
> This record captures what was actually exercised — and, importantly, what was **not**.

## Summary

On **2026-06-26** the **automated per-jewel restore drill** (crown-jewels program §3d) ran and went
**GREEN** — all 6 jewels PASS, 0 SKIPs, RTO ~185s, clean teardown. This proves each crown jewel is
**individually restorable** from the off-cluster fsn1 S3 store. The cadence is now **ACTIVE** (weekly).

**However, the §4 whole-sequence cold-start drill — which the program's own runbook defines as the
formal Stage-C gate — has NOT been run.** Its scripts (`scripts/dr/coldstart/`) are still TODO-stubbed
for every live-infra step and no `evidence-dr-coldstart-*.md` artifact exists. So a **formal Stage-C
PASS cannot be substantiated**. Standby infra (`.150` + BX11) was nonetheless **deleted on 2026-06-26**
on the strength of the per-jewel drill; recovery snapshot **`401960703`** is retained as the only
remaining insurance against an untested ordered-rebuild gap.

## What the drill mechanism does (gitops PR #57, merged 2026-06-26)

**Tier A — §3d weekly per-jewel drill** (`monitoring/dr-restore-drill/`): a CronJob (ns `monitoring`,
Mon 04:00 UTC) restores ONE of each jewel into a throwaway `dr-drill-<ts>` namespace, asserts, reports
PASS/FAIL + RTO per jewel, emits a `DR-DRILL-EVIDENCE` log block (Loki), pings a dead-man's switch on
PASS / Telegram + non-zero exit on FAIL, then tears down. Jewels: **J5+J4** decrypt the sealed
`escrow/dr-drill-canary.age` with the in-cluster age key + match the canary sha256; **J2** pull an
image from the S3 registry mirror; **J3/J6/J7/J8** CNPG `bootstrap.recovery` of ONE Postgres cluster
per run (rotated by ISO week); **J9** restic-restore the latest Surreal dump; **J1** restic-restore one
bare Forgejo repo + `git fsck`; **J10** fetch newest etcd `--etcd-s3` snapshot + `etcdctl snapshot
status`. Guards: ships `suspend:true` (founder-activated), image digest-pinned, least-priv RBAC, a
ValidatingAdmissionPolicy blocking deletes outside `^dr-drill-`, read-only against the store. A
PrometheusRule pages on `DRRestoreDrillFailed` and `DRRestoreDrillStale` (>8d).

**Tier B — §4 quarterly whole-sequence cold-start** (`scripts/dr/coldstart/`): rebuild the ENTIRE
estate on a fresh Hetzner box from fsn1 S3 + the founder's offline escrow key alone, in dependency
order (Infisical → Forgejo+registry → ESO+Argo → platform → data → apps), measuring per-step RTO. The
runbook states: *"The first §4 pass is Stage C — the gate before anything is deleted."*

## Drill result — evidence

| Item | Finding | Source |
|---|---|---|
| §3d per-jewel drill ran + PASS | YES — final re-run fully GREEN, 6/6 jewels, 0 SKIP, RTO 185s, exit 0, clean teardown | gitops PRs #57/#58/#59/#60 (merged 2026-06-26); `50-cronjob.yaml` `suspend:false`, image `dr-drill-tools:v3@sha256:5141aa2b…fe47` ("ACTIVATED after a GREEN manual run") |
| Weekly cadence active | YES (`suspend:false`, PR #59); alerting wired | `monitoring/dr-restore-drill/{50-cronjob,60-prometheusrule}.yaml` |
| §4 cold-start whole-sequence run | **NO** — scripts TODO-stubbed; no `evidence-dr-coldstart-*.md` exists anywhere | `scripts/dr/coldstart/assertions.sh` (`: # TODO` per step); README "not fully push-button" |
| Standby retired on this basis | `.150` + BX11 DELETED 2026-06-26; snapshot `401960703` retained | memory `bx11-150-decommission` |

## Governance-trail gaps found (being remediated by this record + follow-ups)

- **This record (REC-EVID-003)** is the first filed DR-drill evidence; `evidence/ledger.jsonl` was empty
  and no REC-POS/prior REC-EVID for DR existed.
- **REC-PLAN-021** (the family-jewels off-cluster DR plan) and **REC-POL-005** (BCP/DR policy) are **not
  in the register** despite their planning/policy issues (#322, #191) being closed — they live in
  uncommitted worktrees, never merged to main. Register reconciliation is owed.
- Asset-inventory update **PR #339** (add the K3s cluster, supersede dead .150/.167 Coolify assets) is
  still **OPEN** (tracked as RES-74).

## Conclusion + recommended actions (founder decisions)

The estate has **proven per-jewel restorability** and an active weekly drill — a genuinely strong
position. The **residual risk** is that teardown of the standby **preceded** the defined Stage-C proof:
the ordered end-to-end rebuild (§4) that the standby used to backstop has never been exercised. The
per-jewel drill restores only a *rolling sample* (one PG cluster + one repo per run), not the dependency
-ordered whole-estate cold start.

1. **Do NOT delete recovery snapshot `401960703`** until a §4 cold-start drill passes. (Headline.)
2. **Run the §4 whole-sequence cold-start drill** to earn a genuine Stage-C PASS; file its
   `evidence-dr-coldstart-*.md` (and supersede/extend this record).
3. **Reconcile the register** — land REC-PLAN-021 + REC-POL-005; merge PR #339 (RES-74).
4. Close out the open DR work items (real CNPG restore against the live path; Surreal restore
   verification; Phase-8 resilience; restormel-ops Forgejo SPOF restore; cross-region/AZ DR — backups
   are currently single-region fsn1).

_Review basis: read-only review 2026-06-27 of gitops `monitoring/dr-restore-drill/` + `scripts/dr/coldstart/`,
restormel-keys `records/register.yaml` + `evidence/`, and the crown-jewels memory notes. A cluster-side
confirmation of the green Job (`kube_cronjob_status_last_successful_time`) was deliberately not run and
remains an optional independent check._

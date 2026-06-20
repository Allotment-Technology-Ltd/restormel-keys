# K3s migration — execution sequence (post-rehearsal)

> **Status:** execution plan · **Created:** 2026-06-20 · **Owner:** founder
> The ordered, do-this-next runbook for the *real* sovereign-stack migration, written
> after the **Path-A rehearsal passed** (2026-06-20). It sequences and gates the work;
> the **what/why** lives in [`full-migration-plan-k3s.md`](full-migration-plan-k3s.md)
> (Decisions register = authoritative) + [`k3s-cluster-target-design.md`](k3s-cluster-target-design.md);
> the **how** of each manifest is in `deploy/k3s/**`. Nothing here auto-applies — every
> infra step is a manual, founder-gated operator action.

## Rehearsal-validated foundation (2026-06-20)

A full Path-A rehearsal stood the cluster up on a temp CX43, validated, and tore it
down clean. **Proven:** provisioning, k3s v1.34.8, Cilium, Hetzner CCM + CSI (dynamic
`hcloud-volumes` attach), autoscaler, and **CNPG → Barman → S3 backup** landing in
`restormel-cnpg-backups-fsn1` (object-verified). See `deploy/k3s/README.md` §Rehearsal.
**Already in place:** corrected `cluster_config.yaml` (#194), SSH key
(`adam@allotment-hetzner`), `restormel-internal` network, firewall on all boxes, the S3
bucket + creds (AST-019), operator tooling (`hetzner-k3s`/`kubectl`/`helm`).

**Still to validate at first real apply** (not exercised in the rehearsal): ESO ←
Infisical, cert-manager DNS-01, Traefik, the **Barman Cloud _plugin_** path (needs
cert-manager; rehearsal used in-tree), SurrealDB.

---

## Phase 0 — Pre-apply gates (resolve before standing up the durable cluster)

| Gate | Status / action |
|------|-----------------|
| **Operator access model** | Wire kube-API over the private-net tunnel + set `tls-san` for 127.0.0.1/private IP; keep the firewall re-point helper. See `deploy/k3s/cluster/operator-access.md`. |
| **ESO bootstrap secret** | Create the out-of-band Infisical machine-identity Secret (clientId/clientSecret) — the ONE secret not delivered by ESO itself (`secrets/machine-identity-bootstrap.example.yaml`). |
| **Docker-capable runner** | The new GitOps image-build pipeline needs a docker/buildkit-capable runner; `.166` has no docker socket (#184 flag). Provision before the image-build cutover. |
| **PlotBudget prod domain** | Needed for Supabase `SITE_URL`/JWT + ingress `Certificate` (Phase 2/B). Founder to supply. |
| **Surreal RPO + restic repo** | Confirm hourly export RPO target + provision the `restic-surreal-k3s` repo on BX11. |
| **Barman PLUGIN (prod path)** | Validate the Barman Cloud *plugin* (not in-tree) end-to-end on first apply — needs cert-manager up first. |

---

## Phase 1 — Stand up the durable cluster + the platform stack

1. **Create** — `hetzner-k3s create` (fresh cx43 bootstrap node; reuses `.5`). [validated]
2. **ESO ← Infisical** — install External Secrets Operator; create the bootstrap
   machine-identity Secret; apply `secrets/secretstore-infisical.yaml` + `externalsecrets.yaml`.
3. **cert-manager + Hetzner DNS-01 webhook** — install; apply
   `ingress/clusterissuer-letsencrypt.yaml` (needs the `hetzner-dns-token` ExternalSecret from step 2).
4. **Traefik** — `helm install -f ingress/traefik-helm-values.yaml` (DaemonSet, :80/:443).
5. **CNPG operator + Barman Cloud PLUGIN** — install both (plugin needs cert-manager from
   step 3). Apply the `ObjectStore` (`objectstore-fsn1.yaml`) → **validate a backup lands
   in the bucket via the plugin** (the rehearsal proved in-tree; this proves the prod path).
6. **Argo CD + app-of-apps** — install; bootstrap `gitops/` ; **prod sync stays manual/gated**.
   Preserves the PBI lifecycle callback (now an Argo PostSync hook — still to implement, #184).

**Gate:** platform healthy (ESO syncing, certs issuing, ingress routing, CNPG backing up,
Argo synced) before any data moves.

---

## Phase 2 — Per-product data migration (short maintenance windows; lowest-risk first)

Each: pg_dump from the Coolify-hosted source → restore into the CNPG cluster → cut the
app's DSN over → verify (incl. a Barman backup + a restore spot-check) → keep the old
source as rollback until signed off.

1. **Allotmentology** → `pg-platform` (shared cluster, dedicated DB/role). Lowest blast radius.
2. **Restormel** (`restormel_ops`, **live prod**) → `pg-restormel` (dedicated, HA). Tightest window.
3. **SurrealDB** → in-cluster 1-replica StatefulSet; **keep `surreal.restormel.dev`**; hourly
   export → restic → BX11. **Flip consumers shared-root → scoped users** (ESO scaffolding
   already in #186) — route through `restormel-high-risk-security` (auth/creds change).
4. **PlotBudget (Phase B)** → `pg-plotbudget` + self-hosted Supabase (bootstrap from #192:
   roles/schemas/grants, stock image). **Hard gate:** RLS go/no-go — run the 158-policy
   matrix AS the user via PostgREST; any cross-household leak = NO-GO (BCP/DR §, runbook
   `plotbudget-auth-rls.md`). Needs the prod domain (Phase 0).
5. **UseSophia (Phase B)** → its Neon Postgres → `pg-platform`; Neon Auth → Better Auth;
   re-point to the in-cluster SurrealDB.

---

## Phase 3 — Fold the existing boxes in, retire the temp node

Per `cluster/nodes-target.md`, hand-join (never reprovision) in lowest-risk order
**`.166` → `.150` → `.167`** (prod box last), moving each box's workloads onto the cluster
as it frees. Embedded etcd grows 1→3 (transient 4 during join). Once all three are joined
and stable, **delete the temp bootstrap node** (stop the €20-credit burn).

---

## Phase 4 — Cutover + decommission

1. **DNS → Hetzner DNS** (DNS-01 wildcards; deSEC fallback; avoid Cloudflare).
2. **Retire Coolify** — the Argo pull-based pipeline replaces the push-deploy (resolves the
   broken auto-deploy, REC-INC-006 — never reintroduce a runner→on-box-API step).
3. **Decommission Neon** — only after the deferred code removal (AUTH_PROVIDER default→self,
   drop `@neondatabase` deps, retire the standby) per the database-strategy notes.

---

## Phase 5 — Validate, evidence, govern

- **Restore drill** from `restormel-cnpg-backups-fsn1` (BCP/DR REC-POL-005 §5) + the Surreal
  restore-from-BX11 drill. RTO ≤ 2h / RPO ≤ 5min(PG)/~1h(Surreal) re-confirmed against measurement.
- **DR drill** (region-loss tabletop → restore from fsn1).
- **Governance** as state moves: update `asset-inventory.yaml` (cluster nodes, retiring boxes),
  `suppliers.yaml` (Coolify/Neon removal), and file an incident record for any cutover blip.

---

## Threaded-through risks / open decisions

- **Durable-cluster topology** — 3 boxes as HA control-plane (Decisions register) vs any change.
- **Dynamic operator IP** — mitigated by the private-tunnel model (Phase 0).
- **Barman plugin on Hetzner** — first real validation in Phase 1.5 (less-trodden than in-tree).
- **Image-build runner** — docker-capable runner is a Phase 0 prereq for the GitOps build step.
- **PlotBudget RLS** — the single hardest gate (financial data, 158 policies); Phase 2.4.

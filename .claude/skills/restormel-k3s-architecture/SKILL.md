# Restormel K3s architecture

Conventions for designing/operating the sovereign **K3s + CloudNativePG** cluster that replaces Coolify.
Use when planning or building anything on the target Kubernetes stack (cluster, CNPG, ingress, secrets,
backups, GitOps). Canonical design: [planning/k3s-cluster-target-design.md](../../../planning/k3s-cluster-target-design.md);
migration context: [planning/full-migration-plan-k3s.md](../../../planning/full-migration-plan-k3s.md).
Verify live infra via the **restormel-infra-access** skill (never trust remembered UUIDs/IPs).

## Conventions (do not silently deviate — each was a deliberate cost/risk call)

1. **3 existing boxes = schedulable embedded-etcd control-plane; workers ARE those nodes.** Burst is a
   separate **scale-to-zero, `NoSchedule`-tainted** pool (`min=0`), opt-in only. No dedicated worker
   nodes without an explicit cost decision.
2. **Reuse the existing private net** (`existing_network_name`, `172.16.0.0/16`). **Adopt boxes
   in-place, prod last** (`.166`→`.150`→`.167`); never let `hetzner-k3s` reprovision a box running prod.
   (Path A — a temporary node, e.g. via one-off credit — is the de-risking alternative for the live-box
   conversion.)
3. **Bootstrap-safety rule (load-bearing):** the deploy system (Forgejo + GitOps repo + registry + CI
   runner) and the secret source (**Infisical**) stay **off-cluster**. Never make the means-to-deploy or
   the secret source depend on the cluster being healthy. Forgejo/Infisical PG migrate into CNPG only as
   a separately-gated post-cutover step (consider keeping Infisical out permanently).
4. **CNPG topology = hybrid:** one shared `pg-platform` cluster for mergeable DBs + dedicated clusters
   for prod (`pg-restormel`) and Supabase (`pg-plotbudget`). `instances: 2` (not 3) on the 8 GB boxes;
   separate `walStorage`; **tight CSI volume sizing** (10–20 Gi).
5. **Barman → Hetzner Object Storage, region-matched endpoint** (`hel1.your-objectstorage.com`);
   continuous WAL + daily base + recovery-window retention; S3 creds via ESO, never plaintext. Plan the
   **Barman Cloud Plugin** migration (native `barmanObjectStore` deprecated ≥ CNPG 1.26).
6. **Secrets = ESO ← self-hosted Infisical** (authoritative). Per-`ExternalSecret` scoping (only the keys
   a pod needs); the sole out-of-band secret is the Infisical machine-identity bootstrap. No
   sealed-secrets fork of the source of truth. etcd encrypted at rest.
7. **Ingress = Traefik (own Helm release, NOT Coolify's) + cert-manager**; **CNI = Cilium**
   (NetworkPolicy isolates prod DB traffic on shared nodes); **no paid LB by default** (single-node
   ingress via Traefik DaemonSet); **no paid registry** (use Forgejo's).
8. **GitOps = Argo CD** (UI visibility for solo ops; Flux is the lighter fallback). The deploy step
   replaces the Coolify-API call but **preserves the PBI lifecycle callbacks**. **Prod sync stays
   manual/gated** (prod is never main-auto-deploy); DB migrations fail-closed.
9. **`surreal.restormel.dev` is a hard invariant** — keep it resolving to the cluster ingress for
   UseSophia. SurrealDB is a **1-replica StatefulSet** (rocksdb single-writer); DR is
   `surreal export`→restic→BX11; retire the shared root cred for scoped users (route auth changes through
   **restormel-high-risk-security**).
10. **Cost discipline:** target near-zero new spend (object storage ~€5 + tight CSI volumes only); burst
    scales to zero; reuse boxes + Forgejo registry; no LB by default. Any new recurring cost needs an
    explicit founder decision.

## Pinned facts (verify before relying)
- Boxes: `.167`=172.16.0.3 (CX33, prod), `.150`=172.16.0.2 (CX33, ops/Surreal/Infisical — tightest),
  `.166`=172.16.0.4 (CX43 16 GB, CI — most headroom). Helsinki `hel1`.
- Tool versions at design time: hetzner-k3s v2.5.0, CNPG 1.27, ESO Infisical provider. Re-check on use.
- Stateful stores to move: 4+ Postgres (restormel `restormel_ops`, restormel-postgres, allotmentology,
  Forgejo PG, Infisical PG) + SurrealDB. Coolify is retired.

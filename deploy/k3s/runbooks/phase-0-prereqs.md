# Phase A kickoff — active scope + prerequisites

> Companion to [`planning/k3s-migration-execution-sequence.md`](../../../planning/k3s-migration-execution-sequence.md).
> The rehearsal proved the mechanics (2026-06-20); this is what must be true before
> the **real** Phase-A apply. Every step is a manual, founder-gated operator action.

## Active scope (founder decision, 2026-06-20)

**Phase A = get Restormel + Allotmentology onto K3s first** ("up and walking"), then
come to the other products. Concretely:

- **IN scope now:** the platform stack (ESO → cert-manager → Traefik → CNPG + Barman
  plugin → Argo CD), **`pg-restormel`** (`restormel_ops`), **`pg-platform`**
  (allotmentology DB), and **SurrealDB** (a Restormel dependency — knowledge graph /
  Connect). Plus their backups (CNPG → `restormel-cnpg-backups-fsn1`; Surreal → BX11).
- **DEFERRED to a later phase:** **PlotBudget** (`pg-plotbudget` + self-hosted Supabase)
  and **UseSophia**. Their manifests stay in the repo **unapplied** — do NOT `kubectl
  apply` `deploy/k3s/supabase/**`, `cluster-pg-plotbudget.yaml`, or the
  `plotbudget-supabase-prod` / `usesophia-prod` Argo apps during Phase A.

## ⚠ MUST-FIX before applying ESO — secret-store wiring is inconsistent

The rehearsal used a manual Secret, so this wasn't exercised. Across the manifests the
ExternalSecrets point at **three different store names** and **two bootstrap-secret
names**, and the same store is defined as both a namespaced `SecretStore` and (commented)
a `ClusterSecretStore`. An ExternalSecret referencing a store that isn't defined fails
at apply. Reconcile to ONE store + ONE bootstrap name first.

| File | Store ref | Bootstrap secret |
|------|-----------|------------------|
| `secrets/secretstore-infisical.yaml` (defines) | `infisical-restormel-ops` (SecretStore) | `infisical-machine-identity` |
| `secrets/externalsecrets.yaml` | `infisical-restormel-ops` | — |
| `cnpg/eso-secret-placeholders.yaml` | **`infisical-restormel`** (ClusterSecretStore) ✗ | — |
| `surreal/10-externalsecret.yaml` (defines `infisical-prod`) | `infisical-prod` | **`infisical-universal-auth`** ✗ |
| `supabase/10-externalsecret.yaml` (defines `infisical-prod`) | `infisical-prod` | **`infisical-universal-auth`** ✗ (deferred phase) |

**Recommended canonical wiring** (a focused PR will apply this — route via
`restormel-high-risk-security`, secrets boundary): one **`ClusterSecretStore`** named
`infisical-restormel-ops` (cluster-wide; all namespaces reference it), bootstrap secret
**`infisical-machine-identity`** in the `external-secrets` namespace. Also de-duplicate
`cnpg/eso-secret-placeholders.yaml` vs `secrets/externalsecrets.yaml` (one source of the
CNPG S3 + role ExternalSecrets). The Phase-B `supabase/` ExternalSecrets get re-pointed
when that phase activates.

## Founder-action prerequisites (Phase A)

### 1. ESO machine-identity bootstrap secret  *(blocks Phase 1 step 2)*
The one secret ESO can't deliver to itself. Steps:
1. In Infisical (`secrets.restormel.dev`) → **create a Machine Identity** (Universal
   Auth), grant it **read** on project `restormel-ops` / env `prod` (path `/`). Copy its
   **clientId** + **clientSecret** (secret shown once).
2. After ESO is installed, create the bootstrap Secret **out-of-band** (never committed):
   ```bash
   kubectl create secret generic infisical-machine-identity -n external-secrets \
     --from-literal=clientId='<clientId>' --from-literal=clientSecret='<clientSecret>'
   ```
   (matches `secrets/machine-identity-bootstrap.example.yaml`; annotated `Prune=false`.)
3. Apply the (reconciled) `SecretStore` + the ExternalSecrets; ESO authenticates and
   renders the k8s Secrets. Verify: `kubectl get externalsecrets -A` all `SecretSynced`.

### 2. Docker/buildkit-capable runner  *(blocks the GitOps image-build step)*
The new Argo pipeline builds + pushes images from CI; the `.166` Forgejo runner has
**no docker socket** (#184 flag). Either add docker/buildkit to the `.166` runner
(needs box SSH + founder approval) or stand up a dedicated build runner. Until then,
images can be built/pushed manually for the first cutover.

### 3. SurrealDB RPO + restic repo  *(blocks Surreal cutover, Phase 2.3)*
Confirm the hourly-export RPO target is acceptable, and provision the
**`restic-surreal-k3s`** repo on BX11 (the Surreal backup CronJob targets it). The
shared-root → scoped-user auth flip routes through `restormel-high-risk-security`.

> **NOT a Phase-A prereq:** the PlotBudget production domain — that's Phase B (Supabase
> `SITE_URL`/JWT + ingress). Don't let it block getting Restormel + Allotmentology up.

## Then — Phase-A apply (subset of the execution sequence)

Follow `k3s-migration-execution-sequence.md` **Phase 1** (cluster + stack; validate the
**Barman plugin** path against `restormel-cnpg-backups-fsn1`) → **Phase 2.1–2.3 only**
(Allotmentology → `pg-platform`, Restormel → `pg-restormel`, SurrealDB) → **Phase 3**
(fold boxes in) → **Phase 4/5** (DNS, retire Coolify, drills). Skip 2.4 (PlotBudget) and
2.5 (UseSophia) until their phase.

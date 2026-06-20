# Deploy-pipeline rewrite — Coolify API → Argo CD GitOps

**Plan only.** This documents how `.forgejo/workflows/deploy-dashboard.yml` changes once
the K3s cluster + Argo CD are live. **The live workflow is NOT rewritten in this PR** — the
target shape and the diff are documented here so the cutover PR is mechanical and reviewable.

Source of truth: `planning/k3s-cluster-target-design.md` §8.

## 1. Today (Coolify)

`.forgejo/workflows/deploy-dashboard.yml` (read it for the exact code) does:

1. **Trigger** — prod on a `dashboard-v*` tag (auto-created per main merge by
   `auto-tag-release.yml`) or `workflow_dispatch=prod`; staging on `workflow_dispatch=staging`.
2. **Deploy step** — `curl` the **Coolify API** at `http://10.0.1.1:8000/api/v1/deploy?uuid=…&force=true`
   per app UUID (dashboard then worker, **serial**), then poll `…/deployments/<id>` until
   `finished`/`failed`. Coolify builds the image *from source itself* — no registry, no
   build-and-push job. Guarded by `COOLIFY_TOKEN` (absent ⇒ clean no-op on the GitHub mirror).
3. **PBI lifecycle callback** (`if: success()`) — flips every issue at `status/ready-deploy`
   to `status/deployed` (by label **ID**, dropping the prior `status/*` first) and closes it,
   via the Forgejo API with `FORGEJO_TOKEN`.

What changes: **only step 2** (the deploy mechanism). Steps 1 and 3 are preserved.

## 2. Target (GitOps with Argo CD)

```
push to main / dashboard-v* tag
        │
        ▼
[ Forgejo Action — OFF-CLUSTER runner on .166 ]        (design §8: CI stays off-cluster)
  1. build image   (workspace Docker build, same Dockerfile.dashboard / .worker)
  2. push image     → registry.allotmentology.tech/restormel/{dashboard,worker}:<sha>   (€0 Forgejo registry)
  3. bump tag       → edit values/restormel-{dashboard,worker}-<env>.yaml in restormel-gitops,
                      commit "deploy(<env>): dashboard <sha>", push to restormel-gitops main
        │
        ▼
[ Argo CD — IN-CLUSTER ]
  4a. STAGING : auto-sync (or Image Updater writes the tag) → rolls automatically
  4b. PROD    : Application is OutOfSync → ***OPERATOR SYNCS BY HAND*** (manual gate)
        │
        ▼
  5. PBI lifecycle callback — flip status/ready-deploy PBIs → status/deployed + close
       STAGING : in-workflow step (auto-sync ⇒ deploy completes in-band)  ← PRESERVED UNCHANGED
       PROD    : Argo PostSync HOOK Job (fires on the operator's Sync success)
                 → charts/restormel-dashboard/templates/pbi-lifecycle-postsync.yaml
                   (label-ID logic kept byte-for-byte from commit 6bc3edac; outbound-only)
```

### Why "CI bumps the tag in git" is the primary path (not Image Updater) for prod
- **Deterministic + auditable**: every prod release is a commit in `restormel-gitops`
  (`deploy(prod): dashboard <sha>`), revertable by reverting that commit — the GitOps
  analogue of the current "named, revertable `dashboard-v*` tag" property.
- **Keeps the manual gate honest**: CI only *proposes* the new tag (a git commit). Argo
  shows prod OutOfSync; the operator clicks Sync. Image Updater on prod would auto-write
  **and** auto-sync, erasing the gate — so it's **staging-only** (see
  `applications/workloads/restormel-dashboard-staging.yaml`).

## 3. Trigger mapping (unchanged semantics)

| Trigger | Today | Target |
|---|---|---|
| main merge (app paths) | `auto-tag-release.yml` → `dashboard-v*` tag → Coolify prod deploy | `auto-tag-release.yml` stays; tag build/push image + bump **prod** values → **Argo OutOfSync → manual sync** |
| `workflow_dispatch=staging` | Coolify staging deploy | build/push + bump **staging** values → Argo **auto-syncs** |
| `workflow_dispatch=prod` | Coolify prod deploy | build/push + bump **prod** values → **manual Argo sync** (or run `argocd app sync restormel-dashboard-prod`) |
| preview (`preview-deploy.yml`) | point Coolify preview app at ref | bump `values/restormel-preview.yaml` (tag + replicaCount) → **manual sync** |

The `dashboard-v*` tag stays the prod release artifact: the build/push/bump job keys off it
exactly as the Coolify job does today, so every prod release still maps to a named,
revertable tag **and** a revertable gitops commit.

## 4. Diff shape for `.forgejo/workflows/deploy-dashboard.yml` (cutover PR)

**Removed** from each deploy job: the Coolify block — `API="http://10.0.1.1:8000/api/v1"`,
the `deploy_and_wait()` curl-to-`/deploy` + poll-`/deployments`, the `*_UUID` envs, and the
`COOLIFY_TOKEN` guard.

**Added** — a build-and-bump job on the off-cluster runner (sketch; not wired live here):

```yaml
# NOTE: requires a Docker-capable off-cluster runner (.166) — the current runner's
# job containers have NO docker socket (that's WHY today's pipeline calls Coolify
# instead of building). Cutover prerequisite: a buildx/buildkit-enabled runner label.
- name: Build, push to Forgejo registry, bump tag in gitops repo
  shell: bash
  env:
    REG: registry.allotmentology.tech
    REG_USER: ${{ secrets.FORGEJO_REGISTRY_USER }}      # from Infisical via Forgejo secret
    REG_TOKEN: ${{ secrets.FORGEJO_REGISTRY_TOKEN }}
    GITOPS_TOKEN: ${{ secrets.FORGEJO_PM_TOKEN }}        # write to restormel-gitops
    ENV_NAME: prod        # or staging
  run: |
    set -euo pipefail
    [ -z "${REG_TOKEN:-}" ] && { echo "no registry token — no-op (mirror/fork)"; exit 0; }
    SHA="$(git rev-parse --short=12 HEAD)"
    echo "${REG_TOKEN}" | docker login "${REG}" -u "${REG_USER}" --password-stdin
    docker build -f Dockerfile.dashboard -t "${REG}/restormel/dashboard:${SHA}" .
    docker build -f Dockerfile.worker    -t "${REG}/restormel/worker:${SHA}" .
    docker push "${REG}/restormel/dashboard:${SHA}"
    docker push "${REG}/restormel/worker:${SHA}"
    # bump the tag in the gitops repo (one line per app) — Argo sees OutOfSync
    git clone "https://x:${GITOPS_TOKEN}@git.allotmentology.tech/Allotment-Technology-Ltd/restormel-gitops.git" gitops
    cd gitops
    yq -i ".image.tag = \"${SHA}\"" "values/restormel-dashboard-${ENV_NAME}.yaml"
    yq -i ".image.tag = \"${SHA}\"" "values/restormel-worker-${ENV_NAME}.yaml"
    git -c user.name=forgejo-ci -c user.email=ci@allotmentology.tech \
        commit -am "deploy(${ENV_NAME}): dashboard+worker ${SHA}"
    git push origin main
    # PROD: stop here — Argo shows OutOfSync; OPERATOR syncs by hand (manual gate).
    # STAGING: Argo auto-syncs; nothing more to do.
```

**STAGING** keeps the existing in-workflow `Lifecycle — close PBIs that were awaiting this
deploy` step **copied verbatim** (auto-sync ⇒ the deploy completes in-band, so `if: success()`
on the deploy job is still the right trigger; it only talks to the Forgejo issues API with
`FORGEJO_TOKEN`).

**PROD** moves that same logic to an Argo **PostSync hook Job** —
`charts/restormel-dashboard/templates/pbi-lifecycle-postsync.yaml` (implemented in this PR;
closes #184). Because prod's CI job ends at "tag bumped + committed" and the deploy is not complete
until the operator Syncs, the prod flip MUST fire on **Sync success**, not on the build/bump
job. The hook is the faithful "deployed == synced" trigger. **The label-ID flip logic is
preserved byte-for-byte** (only `apt-get install jq` is dropped — the hook image already ships
curl+jq; and the bash `auth=(...)` array is inlined per-curl because the hook runs under
POSIX `/bin/sh`).

> **The manual-sync gate and CI** (resolved): for prod, CI's job ends at "tag bumped +
> committed". The deploy is *not* complete until the operator syncs. So the prod PBI flip is
> the **PostSync hook Job (option (a))** — PBIs flip exactly when the operator's prod **Sync
> succeeds** (most faithful to "live = synced"). Staging retains the **in-workflow step
> (option (b))** since auto-sync completes the deploy in-band. Either way the **label-ID flip
> logic is preserved byte-for-byte**.

## 5. PBI lifecycle callback — PRESERVED (do not rewrite)

The existing step is correct and must survive the cutover unchanged. Reproduced here as the
contract to preserve (see the live file for the canonical copy):

- Reads org labels, resolves `status/deployed` **by ID** (org labels are a silent no-op by
  name — the `fix/pm-lifecycle-label-ids` fix, commit `6bc3edac`).
- For each open issue carrying `status/ready-deploy`: deletes any existing `status/*` label
  (status is exclusive), POSTs `status/deployed` by ID, PATCHes the issue closed.
- Guarded by `FORGEJO_TOKEN` (absent ⇒ clean skip).

**Only the trigger point moves** (workflow step for staging → Argo PostSync hook for prod);
the body is identical. This is the single most important preservation requirement of the
rewrite (design §8: "Preserve the PBI lifecycle callbacks — only the deploy step swaps").

### Prod PostSync hook — outbound-only (REC-INC-006 invariant)

The prod hook Job (`charts/restormel-dashboard/templates/pbi-lifecycle-postsync.yaml`) makes **egress HTTPS calls only**,
to the **public** Forgejo API `https://git.allotmentology.tech/api/v1`. It is NOT a
runner→on-box step and never dials a box private IP (no `10.0.1.1` / `172.16.0.2` /
cluster-internal host), so it cannot recreate the ephemeral-subnet route collision of
REC-INC-006. Its only inbound dependency is the ESO-delivered `forgejo-pm-token` Secret
(cluster-local; key `FORGEJO_PM_TOKEN` from the `infrastructure` Infisical project via the
`infisical-infra` ClusterSecretStore). Token absent ⇒ the script no-ops cleanly, exactly like
the workflow guard.

## 6. Bootstrap order (operator, once)

1. **ESO + per-project Infisical `ClusterSecretStore`s** (`infisical-infra`,
   `infisical-restormel`, `infisical-allotmentology`; sophia/plotbudget are Phase B — see
   `deploy/k3s/secrets/secretstore-infisical.yaml`, PR #200). The **one** out-of-band secret is
   the shared Infisical machine-identity bootstrap Secret `infisical-machine-identity` in ns
   `external-secrets` (design §6).
2. **Argo CD** — `helm upgrade --install argocd argo/argo-cd --version 9.5.22 -n argocd
   --create-namespace -f bootstrap/argocd-values.yaml`.
3. **`bootstrap/appprojects.yaml`** + **`bootstrap/argocd-repo-externalsecret.yaml`** (repo +
   registry creds via ESO — both from `infisical-infra`).
4. **`root/root-app.yaml`** (`kubectl apply -n argocd -f …`) — renders addons + workloads.
5. **cluster-addons** auto-syncs (CNPG, Surreal, Supabase[B], ingress, cert-manager, ESO).
6. Workloads: staging auto-syncs; **operator syncs prod by hand**. The prod dashboard sync
   then runs the **PBI lifecycle PostSync hook** automatically on success.

**Forgejo + Infisical + the CI runner stay OFF-cluster** through migration (design §8) — the
deployer must not depend on the cluster it deploys.

## 7. Open items / prerequisites (flag to founder)

- **Docker-capable off-cluster runner** on `.166` is a hard prerequisite — today's runner has
  no docker socket (the reason the current pipeline calls Coolify instead of building). Either
  a rootless buildkit/buildx runner, or use a scale-to-zero burst node for builds.
- **PBI-callback trigger point** — **RESOLVED**: prod = Argo PostSync hook Job (implemented,
  `charts/restormel-dashboard/templates/pbi-lifecycle-postsync.yaml`, #184); staging =
  in-workflow step. Logic preserved byte-for-byte either way.
- **Forgejo container registry** must be enabled + a scoped push/pull token minted into
  Infisical (`FORGEJO_REGISTRY_USER/TOKEN`, infrastructure project). The PostSync hook image
  `registry.allotmentology.tech/restormel/ci-curl-jq:1` must be pushed to that registry first
  (a 2-line Dockerfile: `FROM alpine; RUN apk add --no-cache curl jq`), and the prod namespace
  needs the `forgejo-registry-pull` imagePullSecret (or use a public curl+jq image to avoid the
  bootstrap dependency).
- **`FORGEJO_PM_TOKEN`** (Forgejo bot, issue-write on restormel-keys) must exist in the
  `infrastructure` Infisical project so the prod PostSync hook's `forgejo-pm-token`
  ExternalSecret resolves. Today the workflow uses the Forgejo Actions secret `FORGEJO_TOKEN`;
  the hook needs the same identity delivered via ESO.
- Phase B (usesophia, plotbudget/Supabase) deploys are disabled until Phase B; PlotBudget prod
  domain is an open §10 question that blocks its Supabase `SITE_URL`/JWT.

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
[ Forgejo Action — PBI lifecycle callback ]  ← PRESERVED UNCHANGED
  5. on success, flip status/ready-deploy PBIs → status/deployed + close (label-ID logic kept)
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

**Unchanged** — the entire `Lifecycle — close PBIs that were awaiting this deploy` step
(below) is **copied verbatim**. It does not touch Coolify or Argo; it only talks to the
Forgejo issues API with `FORGEJO_TOKEN`. It stays `if: success()` on the deploy job.

> **The manual-sync gate and CI**: for prod, CI's job ends at "tag bumped + committed". The
> deploy is *not* complete until the operator syncs. So the **PBI lifecycle callback must
> NOT fire on the build/bump job for prod** — it must fire on **deploy completion**. Two
> clean options (decide in the cutover PR):
> - **(a) Argo PostSync hook** — a `Job` with the lifecycle script as an
>   `argocd.argoproj.io/hook: PostSync` resource in the prod chart, so PBIs flip exactly
>   when the operator's prod **Sync succeeds** (most faithful to "live = synced").
> - **(b) keep it in the workflow** for **staging** (auto-sync ⇒ deploy completes in-band),
>   and run the prod lifecycle flip from the PostSync hook (a). This keeps the existing
>   label-ID logic; it just moves *where* it runs for prod.
> Recommended: **(a)** for prod (truthful "deployed" = "synced"), **(b)**'s in-workflow form
> retained for staging. Either way the **label-ID flip logic is preserved byte-for-byte**.

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

## 6. Bootstrap order (operator, once)

1. **ESO + Infisical `ClusterSecretStore`** (`infisical-prod`) — machine-identity bootstrap is
   the only out-of-band secret (design §6).
2. **Argo CD** — `helm upgrade --install argocd argo/argo-cd --version 9.5.22 -n argocd
   --create-namespace -f bootstrap/argocd-values.yaml`.
3. **`bootstrap/appprojects.yaml`** + **`bootstrap/argocd-repo-externalsecret.yaml`** (repo +
   registry creds via ESO).
4. **`root/root-app.yaml`** (`kubectl apply -n argocd -f …`) — renders addons + workloads.
5. **cluster-addons** auto-syncs (CNPG, Surreal, Supabase[B], ingress, cert-manager, ESO).
6. Workloads: staging auto-syncs; **operator syncs prod by hand**.

**Forgejo + Infisical + the CI runner stay OFF-cluster** through migration (design §8) — the
deployer must not depend on the cluster it deploys.

## 7. Open items / prerequisites (flag to founder)

- **Docker-capable off-cluster runner** on `.166` is a hard prerequisite — today's runner has
  no docker socket (the reason the current pipeline calls Coolify instead of building). Either
  a rootless buildkit/buildx runner, or use a scale-to-zero burst node for builds.
- **PBI-callback trigger point** for prod: PostSync hook (recommended) vs workflow — decide in
  the cutover PR (§5). Logic preserved either way.
- **Forgejo container registry** must be enabled + a scoped push/pull token minted into
  Infisical (`FORGEJO_REGISTRY_USER/TOKEN`).
- Phase B (usesophia, plotbudget/Supabase) deploys are disabled until Phase B; PlotBudget prod
  domain is an open §10 question that blocks its Supabase `SITE_URL`/JWT.

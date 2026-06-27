# Operator runbook -- docker/buildkit-capable CI runner (Phase-A prereq)

**Give the off-cluster CI a way to build + push container images and bump the gitops manifest.**
Open Phase-A prerequisite from [`phase-0-prereqs.md`](phase-0-prereqs.md) section 2 and section 7
of [`../gitops/DEPLOY-PIPELINE.md`](../gitops/DEPLOY-PIPELINE.md): the `.166` Forgejo Actions
runner has **no docker socket** (#184 flag) -- which is why today's pipeline calls the Coolify API
to build from source instead of building itself. The Argo CD pull-based pipeline (design section
8) needs CI to build the image; until this runner exists, the first cutover builds by hand
(section 6). **Reference:** k3s-design section 8 (off-cluster runner, EUR0 Forgejo registry),
`DEPLOY-PIPELINE.md`, incident **REC-INC-006**.

> **Authoring docs only.** Nothing here is applied; no manifest or live workflow is changed. An
> operator runs these on `.166` with founder approval (box SSH + Forgejo admin UI). The workflow
> diff itself is owned by `DEPLOY-PIPELINE.md` section 4.

---

## 0. The hard invariant -- outbound-only, pull-based (REC-INC-006)

REC-INC-006 (prod auto-deploy silently broke for ~14 merges) traced to a **CI per-job container
trying to reach an on-box control-plane API** (Coolify): the per-job network reaches the internet
but **cannot route to the host's own services**. The fix is to **remove that dependency**. The
build runner does **outbound work only**:

| Allowed (outbound) | Forbidden (never reintroduce) |
|---|---|
| `git fetch`/`clone` source + `restormel-gitops` | `curl` an on-box control-plane API (Coolify/Argo/kube-API) to *trigger* a deploy |
| `docker login` + **push** to `registry.allotmentology.tech` | runner -> cluster `kubectl apply` / `argocd app sync` |
| `git push` the bumped `image.tag` commit | runner -> `10.0.1.1` / `172.16.0.2` (any host-local) call |

The deploy completes **by Argo CD pulling from git inside the cluster** -- never by the runner
pushing in. The runner only produces an image and proposes a git commit; any step needing it to
reach the cluster or an on-box API is wrong by construction.

---

## 1. Decisions

- **Placement:** off-cluster on `.166` (CX43, most headroom: 13 G RAM / 120 G disk). The deployer
  must not depend on the cluster it deploys. (design section 8)
- **Registry:** Forgejo built-in registry `registry.allotmentology.tech` (EUR0). Images
  `.../restormel/{dashboard,worker}:<sha>`. (design section 8, `DEPLOY-PIPELINE.md` section 2)
- **Secrets:** `FORGEJO_REGISTRY_USER`/`FORGEJO_REGISTRY_TOKEN` + gitops write token
  `FORGEJO_PM_TOKEN` are Forgejo Actions secrets from Infisical -- **never** committed. (section 6)
- **Phase:** Phase A (Restormel dashboard + worker only). PlotBudget/UseSophia builds deferred.

---

## 2. Two options (pick one -- founder decision)

**Option A -- add docker/buildkit to the existing `.166` runner (recommended, EUR0).** Let the
current runner run docker-based job containers -- via the host docker socket, or (preferred)
rootless **buildkit/buildx** so jobs build without a privileged socket. Pros: EUR0, one box,
reuses the proven runner. Cons: noisy build neighbour shares the box; the host-socket path is
privileged (mitigated by rootless buildkit). Keep builds off the prod nodes.

**Option B -- a dedicated build runner.** A second `act_runner` with a distinct label
(`docker-build`), or a scale-to-zero burst node (design section 8 overflow pool); build jobs
target it via `runs-on: docker-build`. Pros: isolation; heavy builds don't starve normal CI; EUR0
at rest. Cons: more moving parts.

> **Default:** Option A with **rootless buildkit** at EUR0; keep Option B as the scale path. The
> host socket is mounted **only if** rootless buildkit is not viable, and is flagged for security
> review.

---

## 3. Setup -- Option A (rootless buildkit on `.166`)

> Run on `.166` as the runner's service user. Founder approval + box SSH required. Touching CI
> capabilities + a registry token routes through **`restormel-high-risk-security`** first.

**3.1 Rootless buildkit daemon (no privileged host socket):**

```bash
buildkitd --addr unix://$XDG_RUNTIME_DIR/buildkit/buildkitd.sock --oci-worker=true &
docker buildx create --name ci-rootless \
  --driver remote unix://$XDG_RUNTIME_DIR/buildkit/buildkitd.sock --use
docker buildx inspect --bootstrap   # verify the builder is ready
```

**3.2 (Fallback only, privileged)** -- if rootless buildkit is not viable: in
`/etc/act_runner/config.yaml` under `container:` add `valid_volumes: ["/var/run/docker.sock"]` and
`options: "-v /var/run/docker.sock:/var/run/docker.sock"` so job containers get a docker endpoint.
Prefer 3.1; this path must be approved in the security review. Restart the runner
(`systemctl restart act_runner`) and confirm it re-registers under **Forgejo -> Site
Administration -> Actions -> Runners**.

**3.3 Forgejo registry -- enable + mint a scoped push token:**

1. Confirm the **container registry is enabled** and resolves at `registry.allotmentology.tech`
   (design section 8) -- a no-op `docker login` from the box proves it.
2. Mint a **scoped push/pull token** for an org/CI machine user (package read+write on the
   `restormel` org only). Store it in Infisical as `FORGEJO_REGISTRY_TOKEN`
   (+ `FORGEJO_REGISTRY_USER`); **never** commit it.
3. Add the gitops write token `FORGEJO_PM_TOKEN` (write to `restormel-gitops`) the same way.
4. Wire all three into **Forgejo Actions secrets** (repo + org) -- same as `FORGEJO_TOKEN`.

> **Token-rotation (REC-INC-006 follow-up):** rotating any of these must update **every** consumer
> -- Infisical **and** Forgejo Actions (repo + org). A stale shadowing secret was a contributing
> issue in REC-INC-006.

---

## 4. Setup -- Option B (dedicated / labelled runner)

Same buildkit + registry-token steps as section 3, on a separate identity: register a second
`act_runner` (separate token) with label `docker-build`; build jobs select it via
`runs-on: docker-build`. Keep the standard runner **without** docker access -- normal CI
(lint/test/security scan) is unchanged and never gains a socket. A burst node registers on boot
and deregisters on teardown.

---

## 5. The build job (contract -- owned by `DEPLOY-PIPELINE.md` section 4)

This runbook makes the *capability* exist; the workflow body lives in `DEPLOY-PIPELINE.md`
section 4. The runner must support exactly that job, which is **outbound-only**:

```
[ Forgejo Action -- build-capable OFF-CLUSTER runner ]
  1. buildx build  -f Dockerfile.dashboard / .worker
  2. docker push   -> registry.allotmentology.tech/restormel/{dashboard,worker}:<sha>
  3. git bump      -> edit values/restormel-{dashboard,worker}-<env>.yaml in restormel-gitops,
                      commit "deploy(<env>): ... <sha>", push to restormel-gitops main
        |
        v
[ Argo CD -- IN-CLUSTER ]  pulls -> staging + PROD auto-sync the reviewed artefact (REC-ADR-011)
```

There is **no step 4 on the runner** -- Argo CD pulls. This is the REC-INC-006 invariant in code
(preserved: the runner is still outbound-only; only the final reconcile is now automatic, not a
manual operator Sync -- REC-ADR-011).

---

## 6. Interim (before the runner is ready) -- manual build + push

Outbound-only, same target, from the workstation or `.166` (pull the token from Infisical at
point-of-use; let it expire from scrollback):

```bash
REG=registry.allotmentology.tech; SHA="$(git rev-parse --short=12 HEAD)"
echo "<FORGEJO_REGISTRY_TOKEN>" | docker login "$REG" -u "<FORGEJO_REGISTRY_USER>" --password-stdin
docker build -f Dockerfile.dashboard -t "$REG/restormel/dashboard:$SHA" . && docker push "$REG/restormel/dashboard:$SHA"
docker build -f Dockerfile.worker -t "$REG/restormel/worker:$SHA" . && docker push "$REG/restormel/worker:$SHA"
# Then bump image.tag in restormel-gitops by hand and push; Argo auto-syncs prod (REC-ADR-011).
```

Satisfies the `restormel.md` pre-check "images built and pushed to the Forgejo registry" without
the automated runner.

---

## 7. Verification

- [ ] **Runner Online + build-capable** in Forgejo -> Actions -> Runners (`docker-build` for
      Option B); `docker buildx inspect --bootstrap` runs cleanly in a throwaway job.
- [ ] **Registry push works** -- a throwaway image (`.../restormel/_smoke:test`) pushes + pulls
      back, then is deleted.
- [ ] **gitops write works** -- the runner can `git push` a commit to `restormel-gitops` with
      `FORGEJO_PM_TOKEN`.
- [ ] **Outbound-only confirmed (REC-INC-006)** -- the job log shows **no** call to any on-box
      control-plane (`10.0.1.1`, `172.16.0.2`, kube-API `:6443`, Argo).
- [ ] **Standard CI unchanged** -- Security scan + lint/test still pass; the standard runner still
      has no docker socket (Option B).
- [ ] **Secrets hygiene** -- the three tokens live in Infisical + Forgejo Actions; none appear in
      any committed file or job log.

---

## 8. Follow-ups / flags

- **Deploy-failure alert** (REC-INC-006 systemic gap) -- the build/push/bump job must alert on
  failure (Telegram/PostHog); the broken streak was silent for ~14 merges.
- **Surface HTTP/exit status** in build + push steps (no bare `-sf`) so a failure reads "auth" vs
  "network" immediately.
- **Security review** before minting the registry token and (if used) the privileged-socket path.
- **Scale path** -- builds contending with normal CI -> move to Option B (burst pool, section 8).

---
id: REC-INC-026
title: "On-cluster Forgejo runner OOMKilled during portal CI image build — transient CPUThrottlingHigh alert"
class: evidence
owner: founder
status: closed
classification: internal
control-tier: 3
created: 2026-06-29
last-reviewed: 2026-06-29
review-interval: P12M
approved-by: founder
approved-on: 2026-06-29
retention: P6Y
related: [REC-INC-022, REC-INC-024]
---

# Incident — Forgejo runner OOMKilled during portal CI image build (2026-06-29)

- **Detected:** 2026-06-29 ~13:10 UTC   **Reported by:** founder (Telegram CPU-throttle alert) + operator (CI run 7106 failure)   **Severity:** low
- **What happened:** A retry of the `allotmentology.tech` portal container build (`.forgejo/workflows/build-push.yml`, `image` job, run 7106, triggered via `workflow_dispatch` to produce `allotmentology-web:d8d93456e6f4`) ran on the **on-cluster `forgejo-runner`** pod. The `runner` container — limited to **512Mi memory** — was **`OOMKilled` (exit 137) at 13:10:53Z** while executing `next build` for the Next.js 16 portal. Before the OOM, the runner + its `dind` sidecar pegged their CPU limits (runner 1 CPU, dind 2 CPU), tripping the stock **`CPUThrottlingHigh`** alert that paged Telegram. An earlier run (7104) had failed the same way.
- **Impact:** **No production impact.** The live portal (`allotmentology-web:99b915b78c56`) and all estate services were unaffected — node CPU stayed low (node2 16%, node3 21%, master1 11%) and the runner auto-restarted clean within seconds. The only consequences were (a) one transient CPU-throttle alert and (b) the `image` CI job failing, which blocked *only* the pending `/qa` portal redeploy. The `web` CI job (node-only lint/test/build) passed normally on the same runner label.
- **Response:**
  - ~13:10 — CPU-throttle alert received; CI run 7106 observed `failure` (image job).
  - Diagnosed: `kubectl` showed the `forgejo-runner` `runner` container `lastState.terminated.reason=OOMKilled`, restartCount 3, last termination 13:10:53Z — coincident with the build window. Node CPU already back to baseline → alert self-resolved.
  - Root-caused to the runner being structurally too small / wrong-surfaced for a portal build (see below) — a retry would just OOM a fourth time.
  - Remediated by building the image on the **proven isolated path**: a one-off **privileged `buildkit` Job on `restormel-node2`** (own 6Gi memory / 3 CPU limits, decoupled from the runner) cloning `allotmentology.tech@d8d93456e6f4`, building `web/Dockerfile` (target `runtime`) and pushing `allotmentology-web:d8d93456e6f4`. This is the same mechanism that cleanly built the `qa-file-issue` image.
- **Root cause:** `build-push.yml`'s `image` job needs a real Docker daemon (host socket via `container.docker_host: automount`) **and** enough memory for `next build`. It was authored for the now-**retired `.166` build box** runner (host docker socket, ample RAM). The current **on-cluster `forgejo-runner` cannot satisfy either condition** — it has no host docker socket, strips `--privileged`, and caps the runner container at 512Mi — so a portal build OOM-kills the runner. This is the documented `deploy-pipeline-k3s` limitation (in-CI image builds are unsupported on the on-cluster runner; the sanctioned workaround is a privileged buildkit Job).
- **Follow-ups:**
  1. **(OPEN — founder infra decision)** Provide a sustainable portal image-build path. Options: (a) a **dedicated build-runner** with adequate resources + a privileged/docker surface; (b) raise the on-cluster runner limits **and** give it a working build surface; or (c) **formally adopt the one-off privileged buildkit Job** as the sanctioned mechanism and **guard/remove `build-push.yml`'s `image` job** so retries don't OOM-loop. Tracked under the `deploy-pipeline-k3s` "founder decision A vs dedicated build-runner" open item.
  2. Consider **tuning/disabling the stock `CPUThrottlingHigh` alert** on the lean heterogeneous cluster — same noisy-stock-rule pattern as the `KubeMemoryOvercommit`/`NodeMemoryLimitOvercommit` tuning in REC-INC-022 / REC-INC-024 (`kube-overcommit-alerts-lean-cluster`). A short bursty CI build legitimately throttling against a CPU limit is not actionable.
- **Closed:** 2026-06-29 (self-resolved within seconds; image rebuilt via the isolated buildkit Job; no data or availability loss).

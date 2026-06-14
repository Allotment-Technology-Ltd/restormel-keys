# Security Monitoring Roadmap

Dependency scanning and infrastructure monitoring for the self-hosted Coolify/Hetzner stack. This document covers the two workstreams (scanning gate + infra observability), the vulnerability management policy, a phased delivery checklist, and the agent orchestration model.

Related docs: [docs/security/vulnerability-management.md](../security/vulnerability-management.md) · [docs/runbooks/infra-alert-response.md](../runbooks/infra-alert-response.md) · [docs/governance/threat-model-starter.md](../governance/threat-model-starter.md)

---

## Context

The UK/EU self-host migration is complete: production and staging serve from Coolify on Hetzner box `77.42.125.150` (prod box, 7.6 GB RAM + 4 GB swap). A second box `77.42.124.167` (`surreal-box`, 8 GB + 2 GB swap) runs SurrealDB and is adopted as a second Coolify server. Forgejo (`git.allotmentology.tech`) is the **primary** CI; GitHub is a mirror and fallback.

**What already exists (extend, do not rebuild):**

- `.github/actions/js-security-scan` — TruffleHog `--only-verified` + `pnpm audit --audit-level critical`. Runs only in the GitHub-mirror `ci.yml`. The **primary Forgejo pipeline has zero security scanning**, and no pipeline scans container images shipped to the Forgejo registry.
- Dependabot (GitHub mirror only): weekly grouped npm + actions PRs.
- `repo-hygiene.yml`: weekly regex secret-check + structure check.
- PostHog error tracking and insights MCP are connected, but app errors are not captured (no `handleError` hook wired).
- `audit_events` table records admin and security-relevant actions.
- Reusable CI primitive: `.forgejo/actions/pnpm-workspace-install`. Reusable cron pattern: `/etc/cron.d/surreal-backup`.
- **Automated disk pruning installed on prod box:** `/opt/maintenance/disk-guard.sh` + `/etc/cron.d/disk-guard` prunes Docker build cache every 15 minutes when root fs ≥ 80%. Replicate on `surreal-box`.

**Hard constraints:** the monitoring control plane goes on `surreal-box`, never the prod box. Box-RAM and cost are hard constraints — the prod box is RAM-tight and ran OOM once during migration. All box operations must be serialised (two parallel workspace builds OOM the prod box).

**Disk exhaustion is a first-class failure mode.** A live outage during the P3 Postgres cutover was caused by the prod box hitting 100% disk: Coolify accumulates built images and build cache, its native cleanup runs once a day (too coarse for a burst of builds), and the Coolify cleanup API rejects programmatic frequency changes (UI only). The disk-guard cron backstops ≥ 80%; Coolify docker-cleanup should be tightened in the UI to hourly at ~65%.

---

## Owner pre-build steps

Do these before greenlighting the Phase 1 build. Steps 1–2 are console clicks; step 3 unblocks all monitoring and alerting.

**1. Rotate secrets shared during migration.**

- Hetzner Cloud → Security → API Tokens → regenerate.
- Coolify → Keys & Tokens → regenerate.
- Hetzner Robot → Storage Box → reset password.
- The box-Postgres password and Neon connection URLs also require rotation, but those need a coordinated env update and redeploy. Do them with an agent in a dedicated session.

**2. Tighten Coolify's Docker cleanup (≈ 1 min).**

Coolify → your server → Settings: Docker cleanup frequency → hourly, threshold → ~65%. The disk-guard cron backstops at 80%, so this is extra margin.

**3. Create one alert channel — a Telegram bot (≈ 2 min, Phase 1 precondition).**

Without a notification channel, every alert in Workstreams B, B1–B6 fires into the void. Telegram is free, needs no SMTP credentials, and is consumed natively by PostHog, Beszel, and Uptime-Kuma.

- In Telegram, message `@BotFather` → `/newbot` → follow prompts → copy the bot token.
- Send the new bot any message so it can reply to you.
- Provide the token so alerts can be wired in Phase 1.

---

## Workstream A — Dependency and code scanning (OSS, Forgejo-primary)

The gate must live in the **primary Forgejo pipeline** as a required PR check. Scanners run as pinned static binaries in `run:` steps — not GitHub Marketplace actions, which may not resolve on the self-hosted act-runner, and to avoid docker-in-docker. The GitHub-mirror `security` job remains a secondary net and home for Dependabot.

| # | Tool | Catches | Where |
|---|------|---------|-------|
| A1 | **OSV-Scanner** against `pnpm-lock.yaml` | Transitive CVEs across the full monorepo lockfile (Dependabot surfaces these as PRs but never gates) | New `security` job in `.forgejo/workflows/ci.yml` |
| A2 | **gitleaks** (offline, full rules + entropy) | Committed secrets and key leaks — broader than the current 3-pattern regex | Same job; replaces and augments the regex check |
| A3 | **pnpm audit** (`--audit-level high` warn, `critical` block) | npm advisory CVEs | Same job (ported from existing composite) |
| A4 | **Trivy config** scan + **Trivy fs** | Dockerfiles and `deploy/docker-compose.coolify.yml` misconfig; deps and secrets (no built image required) | `security` job in Forgejo CI |
| A4b | **Trivy image** on-box | OS/layer CVEs on the Coolify-built image (Coolify builds on-box, not in CI) | Coolify Scheduled Task on the prod box |
| A5 | **Semgrep OSS** (pinned rulesets, no `--config auto`) | SAST on server routes — SSRF, injection, authz smells | **Phase 2**, warn-only first |

Note on A4: `.forgejo/workflows/deploy-dashboard.yml` deliberately does not build or push images — Coolify builds from source on the box. Running `trivy image` in CI would duplicate the build and risk OOM. Use `trivy config` and `trivy fs` in CI; `trivy image` runs on-box via Coolify Scheduled Task.

**A6 — weekly drift scan (Phase 2):** extend `repo-hygiene.yml` to run OSV-Scanner + `trivy image` against the currently deployed image tag. A newly disclosed CVE on an unchanged dependency raises an alert with no code change. Output goes to a Forgejo issue and PostHog event.

**A7 — branch protection:** mark the Forgejo `security` job a required status check on PRs to `main`. Agent D flips this only after the gate is proven green on a real PR.

Create a `.forgejo/actions/security-scan` composite mirroring `.github/actions/js-security-scan` so both pipelines share one definition.

---

## Workstream B — Infra and security monitoring (PostHog + self-hosted, cross-box)

### B1 — App errors and security events via PostHog

Add SvelteKit `hooks.server.ts` + `hooks.client.ts` `handleError` → PostHog exception capture (`posthog-node` server-side, existing `posthog-js` client-side). This replaces the planned Sentry integration with PostHog, which is already in the stack.

Emit structured security events to PostHog: auth failures, `audit_events` admin actions, rate-limit hits, webhook-signature failures, credential-resolve calls, ingest error rate.

Build PostHog Insights + Alerts (via MCP `alert-create` / `insight-create`) for: **5xx spike**, **auth-failure spike**, **DB-compute/egress runaway** (the primary outage class), **ingest error rate**. Alerts route through the Telegram bot.

Bound PostHog security-event volume so observability does not quietly recreate a cost runaway.

### B2 — Host metrics: Beszel (cross-box, self-hosted)

Beszel is a lightweight Go agent+hub, well suited to low-RAM boxes. Hub on `surreal-box`; agents on both boxes. Each box's CPU, RAM, disk, and swap are visible from the other.

Threshold alerts catch OOM before it kills the process and disk-fill from Surreal backups accumulating over time. Disk and inode alerts should fire at ~75%, ahead of the disk-guard backstop at 80%.

### B3 — Uptime: Uptime-Kuma (self-hosted + external dead-man's-switch)

Uptime-Kuma on `surreal-box` probes public endpoints: `restormel.dev`, `/keys/v1/catalog`, `surreal.restormel.dev`, Forgejo.

Add a single free external dead-man's-switch (healthchecks.io or UptimeRobot free tier) as the outermost pager. This covers the gap that pure self-hosting cannot: if both boxes are down, neither can alert.

### B4 — Edge and host defence

- **Traefik rate-limit + in-flight-request middleware** via Coolify labels on the public dashboard route. Caps abusive bursts and the egress-runaway class. Phase 1, no new container.
- **fail2ban** for SSH on both boxes. Phase 1, low effort.
- **CrowdSec + Traefik bouncer** (EU/self-hosted IPS parsing Traefik access logs; LAPI on `surreal-box`, bouncer on prod). **Phase 2.**

### B5 — Log aggregation (Phase 2)

Ship Docker and Traefik logs to PostHog Logs or a small self-hosted Loki on `surreal-box`. Phase 1 relies on Beszel + PostHog + in-place log parsing by CrowdSec.

### B6 — Actionable alerts (cross-cutting)

Every alert (PostHog, Beszel, Uptime-Kuma, fail2ban/CrowdSec) fires through a template that embeds a Remediation block: concrete first action + runbook link + auto-captured context (top 3 processes for a RAM alert). No bare metric alerts.

Runbook: [docs/runbooks/infra-alert-response.md](../runbooks/infra-alert-response.md). Repeatable skill: `restormel-infra-alert-response`.

PostHog anomaly and health-check Signals scouts provide "strange activity" detection (auth/egress/error anomalies) on top of static thresholds.

**Missing gap — Forgejo backup (none exists):** Forgejo is now the primary git and CI host. A `forgejo dump` cron to the off-box Storage Box (modelled on `surreal-backup`) is a Phase 1 owner item. A live rehearsal during the P3 cutover showed exactly how a Forgejo crash (Postgres PANIC, no space) can cut off owner access.

---

## Vulnerability management

Full triage process and SLA table: [docs/security/vulnerability-management.md](../security/vulnerability-management.md).

Summary of the self-healing loop: OSV-Scanner/Renovate finds a vuln → if a fix version exists, a PR is auto-opened → CI + the A-gate run → auto-merge if green and within policy; otherwise escalate. Auto-merge policy: patch/minor devDependencies and known-safe ranges auto-merge on green; any-severity security fix is raised immediately and prioritised; major bumps and runtime-critical packages never auto-merge.

| Severity (CVSS) | SLA | CI gate |
|---|---|---|
| Critical 9.0–10.0 (or KEV) | 72 h (24 h if KEV) | Block — fail build on fixable |
| High 7.0–8.9 | 7 days | Block — fail build on fixable |
| Medium 4.0–6.9 | 30 days | Warn + auto-open tracked issue |
| Low 0.1–3.9 | 90 days | Informational |

---

## Phased rollout checklist

### Owner manual items (no tooling replaces these)

- [ ] Stand up one alert channel (Telegram bot) — precondition for all monitoring alerts.
- [ ] Rotate Hetzner API token, Coolify tokens, Storage Box password, box-Postgres password, Neon URLs.
- [x] ~~Add swap to the prod box~~ — DONE 2026-06-13 (4 GB swapfile).
- [ ] Tighten Coolify docker-cleanup in UI (frequency → hourly, threshold → ~65%).
- [ ] Add `forgejo dump` backup cron → off-box Storage Box.
- [ ] Replicate disk-guard cron on `surreal-box`.

### Phase 1 — high value, low effort, low RAM

1. [ ] Port OSS security gate into Forgejo CI: OSV-Scanner + gitleaks + pnpm audit as `.forgejo/actions/security-scan` composite; severity-gated per SLA table; required PR check (A1–A3, A7). Owned by Agent A.
2. [ ] Add Trivy config + fs scan to Forgejo CI `security` job; Trivy image scan via Coolify Scheduled Task on prod box (A4, A4b). Owned by Agent A.
3. [ ] Stand up self-hosted Renovate (Forgejo cron) + auto-merge policy (see `docs/security/vulnerability-management.md`). Owned by Agent A.
4. [ ] Wire PostHog error capture (server + client `handleError`) + 4 core PostHog alerts, all using the actionable-alert template (B1, B6). Owned by Agent B.
5. [ ] Beszel hub on `surreal-box` + agents on both boxes; RAM/disk/swap alerts with remediation text (B2, B6). Owned by Agent C.
6. [ ] Uptime-Kuma on `surreal-box` + one external dead-man's-switch; Traefik rate-limit middleware; fail2ban SSH on both boxes (B3, B4a, B4b). Owned by Agent C.

### Phase 2 — deeper coverage

7. [ ] Semgrep SAST gate on server routes (A5) — warn-only then block.
8. [ ] CrowdSec + Traefik bouncer (B4c).
9. [ ] Weekly OSV/Trivy drift scan → auto-triaged issue/PostHog alert with SLA clock (A6).
10. [ ] PostHog Signals scouts for anomaly/health detection (B6); log aggregation — PostHog Logs or Loki on `surreal-box` (B5).

### Phase 3 — maturity

- SBOM generation and provenance on `@restormel/*` publish.
- Anomaly-alert tuning.
- Periodic restore-from-backup drills.
- Security-review cadence tied to `restormel-high-risk-security` skill.

---

## Delivery model

The build uses a fan-out swarm with serialised box ops. All live-box work is owned by one infra agent that serialises internally. Repository and code agents run in isolated worktrees. Merge discipline: never merge before the dispatched per-PR review verdict lands (`merge-after-review-verdict` memory).

| Agent | Scope | Isolation |
|-------|-------|-----------|
| **Orchestrator** | Sequences waves, holds owner-gated items, resolves cross-cutting decisions, owns Phase 2/3 backlog. Does not write feature code. | Main session |
| **A — CI Scanning** | Workstream A: Forgejo `security` composite (OSV-Scanner + gitleaks + pnpm audit + Trivy), mirror parity. | Worktree + own PR |
| **B — App Observability** | Workstream B1: SvelteKit `handleError` hooks → PostHog exception capture; structured security events; PostHog Insights/Alerts via MCP. | Worktree + own PR |
| **C — Infra Monitoring** | Workstreams B2–B4 on live boxes: Beszel hub+agents, Uptime-Kuma, Traefik rate-limit, fail2ban. Serialises all box ops; prod-touching steps owner-gated. | Direct on boxes, serial |
| **D — CI Coordinator** | Watches CI on every agent PR; keeps branches green and rebased; dispatches per-PR security review; merges only on green + passing verdict; flips branch protection (A7) after gate proven. | — |
| **E — Docs & Policy** | This file; refreshes `SECURITY.md` + `threat-model-starter.md`; authors new docs and skills. | Worktree + own PR |

**Parallelism gates:** D flips the Forgejo required-check (A7) only after A's gate is proven green on a real PR. C's prod-touching steps and the manual owner items are owner-gated. Phase 2 items are dispatched by the Orchestrator after Phase 1 merges.

---

## Files touched by this build

**New (CI/code — Agent A):**
- `.forgejo/actions/security-scan/action.yml`
- `security` job in `.forgejo/workflows/ci.yml`
- Trivy steps in `.forgejo/workflows/deploy-dashboard.yml`
- Self-hosted Renovate config (`renovate.json` + Forgejo cron workflow)
- `scripts/security/severity-gate.mjs`

**New (app code — Agent B):**
- `apps/dashboard/src/hooks.server.ts`
- `apps/dashboard/src/hooks.client.ts`

**New (box/infra — Agent C):**
- Beszel + Uptime-Kuma compose/Coolify resources on `surreal-box`
- Traefik middleware labels on prod
- `/etc/cron.d` entries and fail2ban configs on both boxes

**New (docs/skills — Agent E, this PR):**
- `docs/infra/security-monitoring-roadmap.md` (this file)
- `docs/security/vulnerability-management.md`
- `docs/runbooks/infra-alert-response.md`
- Skills: `restormel-vuln-triage`, `restormel-ci-self-heal`, `restormel-infra-alert-response`
- Updated `SECURITY.md`
- Updated `docs/governance/threat-model-starter.md`

**Reuse:**
- `.forgejo/actions/pnpm-workspace-install`
- Existing `audit_events` table
- Existing PostHog env wiring
- `repo-hygiene.yml` cron pattern
- Coolify Scheduled Tasks mechanism
- `/opt/maintenance/disk-guard.sh` pattern (replicate on `surreal-box`)
- `restormel-high-risk-security` + `restormel-admin-technical-writing` skills

---

## Verification (per Phase 1 item)

**Scanning:** open a PR adding a deliberately vulnerable dep and a planted fake secret → the Forgejo `security` job fails on the High/Critical; Trivy flags a known-CVE base image. Confirm the check is required (PR cannot merge red).

**Self-heal + SLA:** introduce a dep with a known fixable High CVE → Renovate raises a prioritised PR; CI goes green → Agent D auto-merges within policy. Plant an unfixable High → an issue is opened with a 7-day SLA label and the `schedule` timer escalates as the window approaches.

**Errors:** throw a test exception in a dashboard route → it appears in PostHog Error Tracking; the 5xx alert fires to Telegram.

**Host metrics:** open Beszel → both boxes report; simulate memory pressure on prod → RAM alert fires from `surreal-box` and includes the remediation block and top-process context.

**Uptime:** stop the prod dashboard container → Uptime-Kuma alerts. Stop both monitors → the external dead-man's-switch alerts.

**Edge:** burst the public route past the rate-limit → 429; brute-force SSH from a throwaway host → fail2ban bans it.

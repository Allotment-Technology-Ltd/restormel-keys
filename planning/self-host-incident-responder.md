---
id: REC-PLAN-013
title: "Self-Hosted Incident Responder (Forgejo-native, Claude Agent SDK) — Spec C"
class: planning
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-16
last-reviewed: 2026-06-16
review-interval: P6M
retention: review-only
related: [REC-PLAN-012, REC-INC-001]
---

# Self-Hosted Incident Responder (Forgejo-native) — Spec C

**Status: draft for founder review.** A self-hosted, **Forgejo-native, EU-sovereign** incident
responder built on the **Claude Agent SDK** — the principled alternative to a GitHub-bound Claude
Code Cloud routine. Triggered by the existing monitoring/alert pipeline, it triages an incident
against the repo + the runbook/ISMS skills, proposes a fix as a **Forgejo draft PR**, and **files the
incident record** — **human-in-the-loop** for anything prod-affecting. The only external dependency is
the Claude **model API** (inference); the repo, host, secrets, CI, and git stay on our infra + Forgejo.

## Why (vs the Claude Code Cloud routine)
- Claude Code Cloud routines are **GitHub-native** (no Forgejo/Gitea connector) and run in an
  Anthropic-managed environment whose config is **plaintext-visible** (no secret vault). Routing
  incident response through GitHub breaks the **Forgejo-primary CI model** and the EU-sovereign /
  self-host posture the whole estate is built on.
- Spec C keeps everything on our infra + Forgejo. The Cloud "mirror-as-read-only" approach (where the
  responder reads the GitHub mirror and a human lands the fix on Forgejo) is an acceptable
  **near-zero-setup interim**; this is the durable answer.

## Architecture

```
 Monitor (Uptime-Kuma / PostHog / Beszel)
        │  authenticated webhook (HMAC) — alert payload
        ▼
 Webhook receiver on the BUILD/OPS box (.150)   ── rate-limited, 1 run/alert, concurrency cap
        │  spawn
        ▼
 Responder run = Claude Agent SDK container
   • repo cloned from FORGEJO (scoped token, private net 172.16.x)
   • repo CLAUDE.md + skills: restormel-infra-alert-response, restormel-isms-governance
   • scoped tool surface (below); ANTHROPIC_API_KEY + scoped Forgejo token from the box secret store
        │
        ├─► Forgejo: push `responder/<incident>` branch + open a DRAFT PR (proposed fix)
        ├─► file the incident record (evidence/incidents/<date>-<slug>.md) in that PR
        └─► Telegram: post a summary + the PR/record links back to the channel
                                   │
                                   ▼
                         Human on-call reviews → lands on Forgejo (real PR + gate)
```

- Runs on the **build/ops box (.150)** (per REC-PLAN-012) — never the prod-runtime box.
- **Human-in-the-loop:** never executes prod-destructive actions; it STOPS and recommends.

## Tool surface — least privilege (enforced, not advisory)
- **ALLOW:** read the repo; a **read-only** investigation shell (inspect code/logs it is given; no
  mutation; egress limited to Forgejo + the Anthropic API); git commit + push to **`responder/*`
  branches only**; Forgejo API to open **DRAFT** PRs + comment; write the incident-record file.
- **DENY (and absent from the env entirely):** prod SSH / box shell; Hetzner / Coolify / SurrealDB /
  Postgres credentials; `DATABASE_URL`; Forgejo merge/admin; deploys; firewall/network/credential
  actions; anything destructive. The responder holds **no prod credentials** — it is repo-centric, the
  human applies prod.

## Security / sovereignty
- **Forgejo bot account** (`@incident-responder`) with a **scoped token**: read + push `responder/*`
  branches + open PRs; **NOT** merge/admin. Held in the box secret store (the `~/.config/restormel`
  pattern / a Coolify env secret), rotatable — **never in the repo**.
- **Webhook authenticated** (HMAC shared secret from the monitor) so arbitrary POSTs can't trigger a
  run; rate-limited.
- **Network:** responder reaches Forgejo over the **private network** (172.16.x) + Anthropic API
  egress only.
- **Audit:** every run logged (alert in, the agent's actions, the PR + record out) — the responder's
  own actions are auditable, feeding the ISMS.
- **One documented residual:** the **Claude model API** is external (inference, not a data host) —
  unavoidable for any Claude-based responder, cloud or self-hosted. No customer data or secrets leave;
  only the alert text + repo context the agent reasons over.

## GATES (owner — needed before/at the marked phases)
- **G1** — Forgejo bot account + scoped token (read / push `responder/*` / open PR; no merge/admin).
- **G2** — `ANTHROPIC_API_KEY` for the responder + a **cost cap** (per-run + daily budget).
- **G3** — sign-off on the **human-in-the-loop policy** (the DENY list above) — the load-bearing decision.
- **G4** — placement on the **build/ops box (.150)** (REC-PLAN-012); must NOT run on prod-runtime.
- **G5** — webhook auth secret + which monitors fire it.

## Phases (each: do → verify → rollback)

### Phase 0 — Prereqs & SDK choice
Confirm G1–G5. Pick the Agent SDK runtime (TS or Python). **Verify against the Claude Agent SDK docs**
that it can load the repo's `CLAUDE.md` + `.claude/skills/*` as the agent's instructions (so the
responder reuses `restormel-infra-alert-response` + `restormel-isms-governance` verbatim). *Verify:* a
hello-world SDK agent runs in a container with the model key. *Rollback:* n/a.

### Phase 1 — Responder harness (container)
Build the responder: clone the Forgejo repo (scoped token, private net); load CLAUDE.md + skills;
system prompt = the responder standing prompt (triage → investigate read-only → propose → STOP on
prod-destructive → file the record); wire the scoped tool surface + the **mandatory incident-record
step**. *Verify:* a manual run on a synthetic alert produces a `responder/*` branch, a Forgejo **draft
PR**, and an incident record — and refuses a prod-destructive action. *Rollback:* container only.

### Phase 2 — Webhook receiver (.150)
A tiny **authenticated** HTTP service on the build/ops box: validate the HMAC, **rate-limit** (1 run
per alert, concurrency cap, daily cap), spawn a responder run with the alert payload. *Verify:* authed
POST spawns a run; unauthed/over-rate rejected. *Rollback:* stop the service.

### Phase 3 — Wire the monitors
Point Uptime-Kuma / PostHog / Beszel alerts at the webhook (**keep** the existing Telegram alert; the
responder posts its summary + PR/record links **back** to Telegram). *Verify:* a synthetic end-to-end
alert → Forgejo draft PR + incident record + Telegram summary. *Rollback:* unwire the webhook — alerts
still reach Telegram unchanged.

### Phase 4 — Guardrails & cost
Enforce: no prod creds in the env; the tool allowlist; human-in-the-loop; the audit log; cost +
concurrency caps; webhook auth. *Verify:* a prod-destructive attempt → responder STOPS + recommends;
caps hold under a burst. *Rollback:* disable the webhook.

### Phase 5 — Soak & handoff
Run on real alerts in **propose-only** mode for a period; tune the standing prompt; confirm the on-call
flow (review the responder's PR + record → land on Forgejo). Close out when the on-call trusts it.

## Risks
- **Model-API dependency** — the one non-sovereign edge; documented residual (inference only).
- **Cost runaway** — per-run + daily budget caps; webhook rate-limited (the very failure mode the
  monitoring plan warned about — see REC-INC-001's lineage).
- **Unintended agent action** — scoped tool surface (no prod creds, no destructive) + human-in-the-loop
  + full audit.
- **Webhook abuse** — HMAC auth + rate limit.
- **Skill / CLAUDE.md drift** — the responder uses the repo's live skills; the self-maintaining-records
  norm keeps them current.

## Relation
Runs on the build/ops box per **REC-PLAN-012**; automates the invocation of the
`restormel-infra-alert-response` + `restormel-isms-governance` skills; automates filing records like
**REC-INC-001**. Supersedes the GitHub-bound Cloud routine as the durable approach; the Cloud
mirror-read is the interim.

## Out of scope
Prod-destructive autonomy (deploys / DB / infra — always human-applied); auto-merge of the responder's
PRs (human reviews + merges on Forgejo); replacing the human on-call (this assists, it does not replace).

## Next step
Founder review of the **gates** — especially **G3** (the human-in-the-loop / DENY policy) and **G1**
(token scope). On sign-off: Phase 0 → 1.
